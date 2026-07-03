const Question = require('../models/Question');
const User = require('../models/User');
const { initializeMatch, startQuestionTimer } = require('./gameplay');

const queues = {};

const getQueueKey = (subject, mode) => `${subject}::${mode}`;

async function processJoinQueue(io, socket, subject, category, targetState) {
  console.log(`\n--- DEBUG: join_queue triggered for subject: ${subject}, mode: ${category}, targetState: ${targetState} ---`);
  
  const queueKey = getQueueKey(subject, category);
  
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
  const seenIds = dbUser?.seenQuestions || [];

  const player = {
    socketId: socket.id,
    socket: socket,
    targetState: targetState,
    user: { ...socket.user, avatarSeed, title, seenIds }
  };

  // Re-check AFTER the awaits above: two rapid join_queue emits (e.g. React
  // StrictMode double-effect) can both pass the early check before either has
  // pushed. Remove any stale entry for this socket OR this user so the queue
  // can never contain the same person twice - which previously caused the
  // server to match a player against themselves.
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

    const roomId = `room_${Date.now()}`;
    p1.socket.join(roomId);
    p2.socket.join(roomId);
    
    p1.socket.activeRoomId = roomId;
    p2.socket.activeRoomId = roomId;

    const mergedSeenIds = [...new Set([...(p1.user.seenIds || []), ...(p2.user.seenIds || [])])];
    
    // Level 1: subject + category + unseen filter
    let questions;
    let matchFilter = { subject, category };
    if (mergedSeenIds.length > 0) {
      matchFilter._id = { $nin: mergedSeenIds };
    }
    questions = await Question.aggregate([{ $match: matchFilter }, { $sample: { size: 5 } }]);

    // Level 2: subject + category
    if (questions.length < 5) {
      questions = await Question.aggregate([{ $match: { subject, category } }, { $sample: { size: 5 } }]);
    }

    // Level 3: subject only (in case category field is missing)
    if (questions.length < 5) {
      questions = await Question.aggregate([{ $match: { subject } }, { $sample: { size: 5 } }]);
    }

    if (questions.length === 0) {
      io.to(p1.socketId).emit('error', { message: `Not enough questions found for ${subject}.` });
      io.to(p2.socketId).emit('error', { message: `Not enough questions found for ${subject}.` });
      return;
    }

    const basePayload = { roomId, subject, questions, isBotMatch: false, mode: category };
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

    console.log(`[Match] Human vs Human started in ${roomId} (${category})`);
    
    initializeMatch(roomId, subject, questions, 
      { socketId: p1.socketId, username: p1.user.username, userId: p1Id, avatarSeed: p1.user.avatarSeed, targetState: p1.targetState }, 
      { socketId: p2.socketId, username: p2.user.username, userId: p2Id, avatarSeed: p2.user.avatarSeed, targetState: p2.targetState }, 
      false);
    setTimeout(() => startQuestionTimer(io, roomId), 3500);
    return;
  }

  // 2. SET UP BOT FALLBACK (5 Seconds)
  player.botTimeout = setTimeout(async () => {
    // If this exact entry was already removed (matched, cancelled, or replaced
    // by a newer join), don't start a duplicate bot match.
    if (!queues[queueKey].includes(player)) return;
    queues[queueKey] = queues[queueKey].filter(p => p.socketId !== socket.id);
    
    const roomId = `room_bot_${Date.now()}`;
    socket.join(roomId);
    socket.activeRoomId = roomId;

    // Try 3 levels of fallback for question fetching
    let questions;

    // Level 1: subject + category + unseen filter
    let matchFilter = { subject, category };
    const seenIds = player.user.seenIds || [];
    if (seenIds.length > 0) {
      matchFilter._id = { $nin: seenIds };
    }
    questions = await Question.aggregate([{ $match: matchFilter }, { $sample: { size: 5 } }]);

    // Level 2: subject + category (ignore seen filter)
    if (questions.length < 5) {
      questions = await Question.aggregate([{ $match: { subject, category } }, { $sample: { size: 5 } }]);
    }

    // Level 3: subject only (in case category field is missing from seeded data)
    if (questions.length < 5) {
      questions = await Question.aggregate([{ $match: { subject } }, { $sample: { size: 5 } }]);
    }

    if (questions.length === 0) {
      return socket.emit('error', { message: `Not enough questions found for ${subject}.` });
    }

    const pId = socket.user.userId || socket.user.id;
    const botName = 'DHEETH Bot';

    const matchPayload = {
      roomId,
      subject,
      questions,
      isBotMatch: true,
      mode: category,
      targetState: player.targetState,
      player: { id: pId, username: socket.user.username, avatarSeed: player.user.avatarSeed, title: player.user.title },
      opponent: { id: "bot", username: botName, avatarSeed: "bot-ronin", title: "Gatekeeper" } 
    };

    io.to(roomId).emit('match_found', matchPayload);
    console.log(`[Match] Human vs Bot started for ${socket.user.username} (${category})`);
    
    initializeMatch(roomId, subject, questions, 
      { socketId: socket.id, username: socket.user.username, userId: pId, avatarSeed: player.user.avatarSeed, targetState: player.targetState }, 
      { socketId: "bot_socket_id", username: botName, userId: "bot", avatarSeed: "bot-ronin" }, 
      true);
    setTimeout(() => startQuestionTimer(io, roomId), 3500);
  }, 5000);
}

const handleMatchmaking = (io, socket) => {
  socket.on('join_queue', async ({ subject, mode, targetState }, ack) => {
    console.log(`[Matchmaking] join_queue received: subject=${subject}, mode=${mode}, targetState=${targetState}, socket.id=${socket.id}`);
    try {
      await processJoinQueue(io, socket, subject, mode || 'tech', targetState);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('Matchmaking error:', err);
      socket.emit('error', { message: 'Matchmaking failed. Please try again.' });
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  socket.on('quick_match', async ({ mode }) => {
    try {
      const category = mode || 'tech';
      let subjects = await Question.distinct('subject', { category });
      if (subjects.length === 0) {
        subjects = await Question.distinct('subject');
      }
      if (subjects.length === 0) {
        return socket.emit('error', { message: 'No subjects found.' });
      }
      const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
      socket.emit('quick_match_redirect', { subject: randomSubject, mode: category });
      await processJoinQueue(io, socket, randomSubject, category);
    } catch (err) {
      console.error('Quick match error:', err);
      socket.emit('error', { message: 'Quick match failed. Please try again.' });
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