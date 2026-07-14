const { v4: uuidv4 } = require('uuid');
const Question = require('../models/Question');
const User = require('../models/User');

const rooms = {};

function generateJoinCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function setupGroupQuiz(io, socket) {
  // Host creates a room
  socket.on('create_room', async ({ subject, mode }) => {
    try {
      const questions = await Question.aggregate([
        { $match: { subject, category: mode || 'tech' } },
        { $sample: { size: 10 } }
      ]);

      if (questions.length < 5) {
        return socket.emit('error', { message: 'Not enough questions for this subject' });
      }

      const code = generateJoinCode();
      const roomId = uuidv4();

      rooms[code] = {
        id: roomId,
        code,
        host: socket.id,
        hostId: socket.userId,
        subject,
        mode: mode || 'tech',
        players: [{ socketId: socket.id, username: socket.username, ready: false, score: 0 }],
        questions: questions.map(q => ({
          _id: q._id,
          question: q.question,
          options: q.options,
          subject: q.subject,
          topic: q.topic,
          category: q.category,
          explanation: q.explanation,
          diagram: q.diagram,
        })),
        currentQuestion: 0,
        started: false,
        answers: {},
      };

      socket.join(code);
      socket.emit('room_created', { code, roomId });
      io.to(code).emit('room_update', rooms[code].players.map(p => ({ username: p.username, score: p.score, ready: p.ready })));
    } catch (err) {
      console.error('Create room error:', err);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // Player joins a room
  socket.on('join_room', async ({ code }) => {
    try {
      const room = rooms[code];
      if (!room) return socket.emit('error', { message: 'Room not found' });
      if (room.started) return socket.emit('error', { message: 'Game already started' });
      if (room.players.length >= 8) return socket.emit('error', { message: 'Room is full' });

      room.players.push({ socketId: socket.id, username: socket.username, ready: false, score: 0 });
      socket.join(code);
      socket.emit('room_joined', { code, players: room.players.map(p => ({ username: p.username, score: p.score, ready: p.ready })) });
      io.to(code).emit('room_update', room.players.map(p => ({ username: p.username, score: p.score, ready: p.ready })));
    } catch (err) {
      console.error('Join room error:', err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Player ready toggle
  socket.on('player_ready', ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) player.ready = !player.ready;
    io.to(code).emit('room_update', room.players.map(p => ({ username: p.username, score: p.score, ready: p.ready })));
  });

  // Host starts the game
  socket.on('start_group_quiz', async ({ code }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error', { message: 'Room not found' });
    if (room.host !== socket.id) return socket.emit('error', { message: 'Only host can start' });
    if (room.players.length < 2) return socket.emit('error', { message: 'Need at least 2 players' });

    room.started = true;
    room.currentQuestion = 0;
    room.answers = {};
    io.to(code).emit('group_quiz_start', {
      totalQuestions: room.questions.length,
      timePerQuestion: 20,
    });
    sendQuestionToRoom(io, code);
  });

  // Submit answer for group quiz
  socket.on('group_submit_answer', ({ code, answer }) => {
    const room = rooms[code];
    if (!room || !room.started) return;

    const qIndex = room.currentQuestion;
    if (qIndex >= room.questions.length) return;

    const correctOption = room.questions[qIndex].correctOption;
    const isCorrect = answer === correctOption;

    room.answers[socket.id] = answer;

    // Check if all answered
    const answeredCount = Object.keys(room.answers).length;
    if (answeredCount >= room.players.length) {
      // Reveal and go next
      revealAndNext(io, code);
    }
  });

  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code];
      const idx = room.players.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          delete rooms[code];
        } else if (room.host === socket.id) {
          room.host = room.players[0].socketId;
          io.to(code).emit('new_host', { hostSocketId: room.host });
        }
        io.to(code).emit('room_update', room.players.map(p => ({ username: p.username, score: p.score, ready: p.ready })));
      }
    }
  });
}

function sendQuestionToRoom(io, code) {
  const room = rooms[code];
  const q = room.questions[room.currentQuestion];
  if (!q) return endGroupQuiz(io, code);

  room.answers = {};
  const questionData = {
    question: q.question,
    options: q.options,
    subject: q.subject,
    topic: q.topic,
    diagram: q.diagram,
    questionNumber: room.currentQuestion + 1,
    totalQuestions: room.questions.length,
  };

  io.to(code).emit('new_group_question', questionData);

  // Auto-advance after 20s
  setTimeout(() => {
    if (rooms[code] && rooms[code].currentQuestion === room.currentQuestion) {
      revealAndNext(io, code);
    }
  }, 20000);
}

function revealAndNext(io, code) {
  const room = rooms[code];
  if (!room) return;

  const q = room.questions[room.currentQuestion];
  if (!q) return endGroupQuiz(io, code);

  // Score correct answers
  room.players.forEach(p => {
    if (room.answers[p.socketId] === q.correctOption) {
      p.score += 10;
    }
  });

  io.to(code).emit('group_answer_reveal', {
    correctOption: q.correctOption,
    explanation: q.explanation,
    scores: room.players.map(p => ({ username: p.username, score: p.score })),
    answers: room.answers,
  });

  room.currentQuestion++;
  setTimeout(() => {
    if (rooms[code]) {
      sendQuestionToRoom(io, code);
    }
  }, 10000);
}

async function endGroupQuiz(io, code) {
  const room = rooms[code];
  if (!room) return;

  const sorted = [...room.players].sort((a, b) => b.score - a.score);

  // Update user stats
  for (const player of sorted) {
    try {
      await User.findByIdAndUpdate(player.socketId.replace('socket_', ''), {
        $inc: { coins: player.score > 0 ? player.score : 0 },
      });
    } catch (_) {}
  }

  io.to(code).emit('group_quiz_end', {
    leaderboard: sorted.map((p, i) => ({
      rank: i + 1,
      username: p.username,
      score: p.score,
    })),
  });

  delete rooms[code];
}

module.exports = { setupGroupQuiz };