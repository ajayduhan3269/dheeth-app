const Question = require('../models/Question');
const User = require('../models/User');
const { initializeMatch, startQuestionTimer } = require('./gameplay');
const { botEngine } = require('../services/botEngine');
const { buildStreamFilter, normalizeStream } = require('../config/streams');

const queues = {};

const getQueueKey = (subject, stream, mode) => {
  const s = normalizeStream(stream);
  return s === 'civil' ? `${subject}::${mode}` : `${subject}::${s}`;
};

async function fetchMatchQuestions(subject, stream, category, seenIds = []) {
  const isCivil = stream === 'civil';
  let matchFilter = buildStreamFilter(stream, {
    subject,
    category: isCivil ? category : undefined,
  });

  if (seenIds.length > 0) {
    matchFilter = { $and: [matchFilter, { _id: { $nin: seenIds } }] };
  }

  let questions = await Question.aggregate([{ $match: matchFilter }, { $sample: { size: 5 } }]);

  // Stage 2: Fill remaining slots with general pool questions (excluding already selected)
  if (questions.length < 5) {
    const selectedIds = questions.map(q => q._id);
    const remainingCount = 5 - questions.length;
    const additionalFilter = {
      $and: [
        buildStreamFilter(stream, { subject, category: isCivil ? category : undefined }),
        { _id: { $nin: selectedIds } }
      ]
    };
    const additional = await Question.aggregate([
      { $match: additionalFilter },
      { $sample: { size: remainingCount } }
    ]);
    questions = [...questions, ...additional];
  }

  // Stage 3: Fill remaining slots with subject-only questions within the stream
  if (questions.length < 5) {
    const selectedIds = questions.map(q => q._id);
    const remainingCount = 5 - questions.length;
    const additionalFilter = {
      $and: [
        buildStreamFilter(stream, { subject }),
        { _id: { $nin: selectedIds } }
      ]
    };
    const additional = await Question.aggregate([
      { $match: additionalFilter },
      { $sample: { size: remainingCount } }
    ]);
    questions = [...questions, ...additional];
  }

  return questions;
}

async function startHumanMatch(io, p1, p2, subject, category, stream = 'civil') {
  const roomId = `room_${Date.now()}`;
  p1.socket.join(roomId);
  p2.socket.join(roomId);
  
  p1.socket.activeRoomId = roomId;
  p2.socket.activeRoomId = roomId;

  const mergedSeenIds = [...new Set([...(p1.user.seenIds || []), ...(p2.user.seenIds || [])])];
  const questions = await fetchMatchQuestions(subject, stream, category, mergedSeenIds);

  if (questions.length === 0) {
    io.to(p1.socketId).emit('error', { message: `Not enough questions found for ${subject}.` });
    io.to(p2.socketId).emit('error', { message: `Not enough questions found for ${subject}.` });
    return;
  }

  const basePayload = { roomId, subject, questions, isBotMatch: false, mode: category, stream };
  const p1Id = p1.user.userId || p1.user.id;
  const p2Id = p2.user.userId || p2.user.id;

  io.to(p1.socketId).emit('match_found', { 
    ...basePayload, 
    targetState: p1.targetState,
    player: { id: p1Id, username: p1.user.username, avatarSeed: p1.user.avatarSeed, title: p1.user.title },
    opponent: { id: p2Id, username: p2.user.username, avatarSeed: p2.user.avatarSeed, title: p2.user.title } 
  });

  io.to(p2.socketId).emit('match_found', { 
    ...basePayload, 
    targetState: p2.targetState,
    player: { id: p2Id, username: p2.user.username, avatarSeed: p2.user.avatarSeed, title: p2.user.title },
    opponent: { id: p1Id, username: p1.user.username, avatarSeed: p1.user.avatarSeed, title: p1.user.title } 
  });

  console.log(`[Match] Human vs Human started in ${roomId} (${category}, stream: ${stream})`);
  
  initializeMatch(roomId, subject, questions, 
    { socketId: p1.socketId, username: p1.user.username, userId: p1Id, avatarSeed: p1.user.avatarSeed, targetState: p1.targetState, eloRating: p1.user.eloRating || 1200 }, 
    { socketId: p2.socketId, username: p2.user.username, userId: p2Id, avatarSeed: p2.user.avatarSeed, targetState: p2.targetState, eloRating: p2.user.eloRating || 1200 }, 
    false);
  setTimeout(() => startQuestionTimer(io, roomId), 3500);
}

async function processJoinQueue(io, socket, subject, category, targetState, rawStream) {
  const stream = normalizeStream(rawStream);
  console.log(`\n--- DEBUG: join_queue triggered for subject: ${subject}, stream: ${stream}, mode: ${category}, targetState: ${targetState} ---`);
  
  const queueKey = getQueueKey(subject, stream, category);
  
  if (!queues[queueKey]) queues[queueKey] = [];

  const isAlreadyInQueue = queues[queueKey].some(p => p.socketId === socket.id);
  if (isAlreadyInQueue) {
    console.log(`[Queue] ${socket.user?.username} already in queue for ${queueKey}`);
    return;
  }

  const userId = socket.user.id || socket.user.userId;
  const dbUser = await User.findById(userId);
  const avatarSeed = dbUser?.equippedAvatar || dbUser?.avatarSeed || 'default-seed';
  const title = dbUser?.title || 'Novice';
  const eloRating = dbUser?.eloRating || 1200;
  const seenIds = dbUser?.seenQuestions || [];

  const player = {
    socketId: socket.id,
    socket: socket,
    targetState: targetState,
    stream: stream,
    user: { ...socket.user, avatarSeed, title, eloRating, seenIds }
  };

  queues[queueKey] = queues[queueKey].filter(p => {
    const pUid = p.user.userId || p.user.id;
    const duplicate = p.socketId === socket.id || String(pUid) === String(userId);
    if (duplicate && p.botTimeout) clearTimeout(p.botTimeout);
    return !duplicate;
  });

  queues[queueKey].push(player);
  console.log(`[Queue] ${socket.user?.username} joined ${queueKey}. Queue size: ${queues[queueKey].length}`);

  // 1. CHECK FOR HUMAN VS HUMAN MATCH
  if (queues[queueKey].length >= 2) {
    const p1 = queues[queueKey].shift();
    const p2 = queues[queueKey].shift();

    if (p1.botTimeout) clearTimeout(p1.botTimeout);
    if (p2.botTimeout) clearTimeout(p2.botTimeout);

    await startHumanMatch(io, p1, p2, subject, category, stream);
    return;
  }

  // 2. SET UP BOT FALLBACK (5 Seconds)
  player.botTimeout = setTimeout(async () => {
    if (!queues[queueKey].includes(player)) return;
    queues[queueKey] = queues[queueKey].filter(p => p.socketId !== socket.id);
    
    const roomId = `room_bot_${Date.now()}`;
    socket.join(roomId);
    socket.activeRoomId = roomId;

    const seenIds = player.user.seenIds || [];
    const questions = await fetchMatchQuestions(subject, stream, category, seenIds);

    if (questions.length === 0) {
      return socket.emit('error', { message: `Not enough questions found for ${subject}.` });
    }

    const pId = socket.user.userId || socket.user.id;
    const botProfile = botEngine.generateBotProfile(player.user, subject, category);

    const matchPayload = {
      roomId,
      subject,
      questions,
      isBotMatch: true,
      mode: category,
      stream,
      targetState: player.targetState,
      player: { id: pId, username: socket.user.username, avatarSeed: player.user.avatarSeed, title: player.user.title },
      opponent: { 
        id: "bot", 
        username: botProfile.username, 
        avatarSeed: botProfile.avatarSeed, 
        title: botProfile.title,
        eloRating: botProfile.eloRating,
        archetype: botProfile.archetype,
        isBot: true 
      } 
    };

    io.to(roomId).emit('match_found', matchPayload);
    console.log(`[Match] Human vs Bot started for ${socket.user.username} vs ${botProfile.username} (${category}, stream: ${stream}, ELO: ${botProfile.eloRating})`);
    
    initializeMatch(roomId, subject, questions, 
      { socketId: socket.id, username: socket.user.username, userId: pId, avatarSeed: player.user.avatarSeed, targetState: player.targetState, eloRating: player.user.eloRating || 1200 }, 
      { socketId: "bot_socket_id", username: botProfile.username, userId: "bot", avatarSeed: botProfile.avatarSeed, title: botProfile.title, eloRating: botProfile.eloRating, archetype: botProfile.archetype }, 
      true);
    setTimeout(() => startQuestionTimer(io, roomId), 3500);
  }, 5000);
}

const handleMatchmaking = (io, socket) => {
  socket.on('join_queue', async ({ subject, mode, targetState, stream }, ack) => {
    console.log(`[Matchmaking] join_queue received: subject=${subject}, stream=${stream}, mode=${mode}, targetState=${targetState}, socket.id=${socket.id}`);
    try {
      await processJoinQueue(io, socket, subject, mode || 'tech', targetState, stream);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('Matchmaking error:', err);
      socket.emit('error', { message: 'Matchmaking failed. Please try again.' });
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  socket.on('quick_match', async ({ mode, stream: rawStream }) => {
    try {
      const stream = normalizeStream(rawStream);
      const category = mode || 'tech';
      const filter = buildStreamFilter(stream, { category: stream === 'civil' ? category : undefined });
      let subjects = await Question.distinct('subject', filter);
      if (subjects.length === 0) {
        subjects = await Question.distinct('subject');
      }
      if (subjects.length === 0) {
        return socket.emit('error', { message: 'No subjects found.' });
      }
      const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
      socket.emit('quick_match_redirect', { subject: randomSubject, mode: category, stream });
      await processJoinQueue(io, socket, randomSubject, category, null, stream);
    } catch (err) {
      console.error('Quick match error:', err);
      socket.emit('error', { message: 'Quick match failed. Please try again.' });
    }
  });

  socket.on('send_match_request', ({ friendId, subject, mode, stream }) => {
    const friendSocketId = global.connectedUsers?.get(friendId);
    
    if (friendSocketId) {
      io.to(friendSocketId).emit('match_request_received', {
        userId: socket.user.id || socket.user.userId,
        username: socket.user.username,
        subject,
        mode,
        stream
      });
    } else {
      socket.emit('error', { message: 'User is offline' });
    }
  });

  socket.on('accept_match_request', async ({ senderId, subject, mode, stream }) => {
    const senderSocketId = global.connectedUsers?.get(senderId);
    
    if (senderSocketId) {
      const senderSocket = io.sockets.sockets.get(senderSocketId);
      if (senderSocket) {
        
        const fetchUserData = async (usrSocket) => {
          const uId = usrSocket.user.id || usrSocket.user.userId;
          const dbUser = await User.findById(uId);
          return {
            socketId: usrSocket.id,
            socket: usrSocket,
            user: { 
              ...usrSocket.user, 
              avatarSeed: dbUser?.equippedAvatar || dbUser?.avatarSeed || 'default-seed',
              title: dbUser?.title || 'Novice',
              seenIds: dbUser?.seenQuestions || []
            }
          };
        };

        const p1 = await fetchUserData(senderSocket);
        const p2 = await fetchUserData(socket);
        
        await startHumanMatch(io, p1, p2, subject, mode, normalizeStream(stream));
      }
    } else {
      socket.emit('error', { message: 'Sender is offline or disconnected' });
    }
  });

  socket.on('decline_match_request', ({ senderId }) => {
    const senderSocketId = global.connectedUsers?.get(senderId);
    
    if (senderSocketId) {
      io.to(senderSocketId).emit('match_request_declined', {
        userId: socket.user.id || socket.user.userId
      });
    }
  });

  socket.on('cancel_search', () => {
    console.log(`[Queue] ${socket.user?.username} cancelled search`);
    for (const key in queues) {
      const before = queues[key].length;
      queues[key] = queues[key].filter(p => p.socketId !== socket.id);
      if (before !== queues[key].length) {
        console.log(`[Queue] ${socket.user?.username} removed from ${key}`);
      }
    }
  });

  socket.on('disconnect', () => {
    for (const key in queues) {
      const before = queues[key].length;
      queues[key] = queues[key].filter(p => p.socketId !== socket.id);
      if (before !== queues[key].length) {
        console.log(`[Queue] ${socket.user?.username} removed from ${key}`);
      }
    }
  });
};

module.exports = { handleMatchmaking };