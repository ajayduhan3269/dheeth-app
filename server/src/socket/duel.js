const Duel = require('../models/Duel');
const User = require('../models/User');
const Question = require('../models/Question');
const Rivalry = require('../models/Rivalry');
const { initializeMatch, startQuestionTimer } = require('./gameplay');
const pushService = require('../services/pushService');

function setupDuelSockets(io, socket) {
  // 1. Clock synchronization for fair timers
  socket.on('time:sync', (data, ack) => {
    const t0 = data?.t0 || Date.now();
    const serverNow = Date.now();
    if (typeof ack === 'function') {
      ack({ t0, serverNow });
    } else {
      socket.emit('time:sync:ack', { t0, serverNow });
    }
  });

  // 2. Join duel waiting room / lobby
  socket.on('duel:join_lobby', async (data) => {
    const code = String(data?.code || '').trim().toUpperCase();
    if (!code) return;

    const roomName = `duel:${code}`;
    socket.join(roomName);

    const user = socket.user;
    if (user) {
      // Notify other occupants (e.g. host) that friend has opened the lobby
      socket.to(roomName).emit('duel:peer_joined', {
        userId: user.id || user._id || user.userId,
        username: user.username,
        avatarSeed: user.avatarSeed || user.equippedAvatar || 'default-seed',
        title: user.title || 'Challenger',
      });
    }
  });

  // 3. Accept a duel challenge (Atomic CAS)
  socket.on('duel:accept', async (data, callback) => {
    try {
      const code = String(data?.code || '').trim().toUpperCase();
      if (!code) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Invalid challenge code' });
        return;
      }

      const user = socket.user;
      if (!user) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Authentication required' });
        return;
      }

      const currentUserId = (user.id || user._id || user.userId).toString();

      // Find the duel to check host
      const existing = await Duel.findOne({ code });
      if (!existing) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Duel challenge not found' });
        return;
      }

      if (existing.hostId.toString() === currentUserId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'You cannot accept your own challenge' });
        return;
      }

      if (existing.status !== 'pending') {
        if (typeof callback === 'function') callback({ ok: false, error: 'This duel has already been accepted or expired' });
        return;
      }

      const fullUser = await User.findById(currentUserId);
      const guestAvatar = fullUser?.equippedAvatar || fullUser?.avatarSeed || 'default-seed';
      const guestTitle = fullUser?.title || 'Contender';

      // Atomic Compare-And-Swap
      const duel = await Duel.findOneAndUpdate(
        { code, status: 'pending', guestId: null, expiresAt: { $gt: new Date() } },
        {
          $set: {
            guestId: fullUser._id,
            guestUsername: fullUser.username,
            guestAvatar,
            guestTitle,
            status: 'accepted',
          },
        },
        { new: true }
      );

      if (!duel) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Duel was just accepted by someone else or expired' });
        return;
      }

      // Fetch questions based on subject & configured question count
      const subject = duel.config.subject;
      const count = duel.config.questionCount || 5;

      let questions = await Question.aggregate([
        { $match: { subject } },
        { $sample: { size: count } },
      ]);

      if (questions.length === 0) {
        // Fallback: any questions
        questions = await Question.aggregate([{ $sample: { size: count } }]);
      }

      const roomId = `room_duel_${Date.now()}`;
      duel.roomId = roomId;
      duel.status = 'live';
      await duel.save();

      const hostSocketId = global.connectedUsers.get(duel.hostId.toString());
      const guestSocketId = socket.id;

      // Make both sockets join the game room
      socket.join(roomId);
      if (hostSocketId && io.sockets.sockets.get(hostSocketId)) {
        const hostSocket = io.sockets.sockets.get(hostSocketId);
        hostSocket.join(roomId);
        hostSocket.activeRoomId = roomId;
      }
      socket.activeRoomId = roomId;

      // Fetch rivalry record for VS splash
      const rivalry = await Rivalry.getOrCreateRivalry(duel.hostId, fullUser._id);

      const basePayload = {
        roomId,
        subject: duel.config.subject,
        questions,
        isBotMatch: false,
        mode: 'duel',
        isDuel: true,
        duelCode: duel.code,
        ratingMode: 'friendly',
        secondsPerQ: duel.config.secondsPerQ || 20,
        rivalry: {
          scoreHost: duel.hostId.toString() === rivalry.players[0].toString() ? rivalry.scoreA : rivalry.scoreB,
          scoreGuest: fullUser._id.toString() === rivalry.players[0].toString() ? rivalry.scoreA : rivalry.scoreB,
          totalDuels: rivalry.totalDuels,
          streak: rivalry.currentStreak,
        },
      };

      const p1Data = {
        id: duel.hostId.toString(),
        username: duel.hostUsername,
        avatarSeed: duel.hostAvatar,
        title: duel.hostTitle,
      };

      const p2Data = {
        id: fullUser._id.toString(),
        username: fullUser.username,
        avatarSeed: guestAvatar,
        title: guestTitle,
      };

      // Notify guest (p2)
      socket.emit('match_found', {
        ...basePayload,
        player: p2Data,
        opponent: p1Data,
      });

      // Notify host (p1) via WebSocket if connected
      if (hostSocketId) {
        io.to(hostSocketId).emit('match_found', {
          ...basePayload,
          player: p1Data,
          opponent: p2Data,
        });
      }

      // Dispatched background Web Push notification (for mobile / closed browser)
      pushService.sendPushToUser(duel.hostId, {
        title: '⚔️ 1v1 Challenge Accepted!',
        body: `${fullUser.username} accepted your challenge in ${duel.config.subject}! Tap to start! 🚀`,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: `duel-${duel.code}`,
        data: {
          url: `/duel/${duel.code}`,
          duelCode: duel.code,
          roomId,
        },
      }).catch(pErr => console.error('[PushService] Challenge push error:', pErr));

      const hostUser = await User.findById(duel.hostId);
      const hostElo = hostUser?.eloRating || 1200;
      const guestElo = fullUser?.eloRating || 1200;

      // Initialize match in gameplay state
      initializeMatch(
        roomId,
        subject,
        questions,
        { socketId: hostSocketId || '', username: duel.hostUsername, userId: duel.hostId.toString(), avatarSeed: duel.hostAvatar, eloRating: hostElo },
        { socketId: guestSocketId, username: fullUser.username, userId: fullUser._id.toString(), avatarSeed: guestAvatar, eloRating: guestElo },
        false,
        { secondsPerQ: duel.config.secondsPerQ || 20, questionCount: count, roundNumber: 1 }
      );

      // Start the countdown / first question timer
      setTimeout(() => startQuestionTimer(io, roomId), 3500);

      if (typeof callback === 'function') {
        callback({ ok: true, roomId });
      }
    } catch (err) {
      console.error('Error accepting duel in socket:', err);
      if (typeof callback === 'function') callback({ ok: false, error: err.message || 'Failed to start duel' });
    }
  });

  // 4. Cancel duel
  socket.on('duel:cancel', async (data, callback) => {
    try {
      const code = String(data?.code || '').trim().toUpperCase();
      const user = socket.user;
      if (!code || !user) return;

      const userId = user.id || user._id || user.userId;
      const duel = await Duel.findOneAndUpdate(
        { code, hostId: userId, status: 'pending' },
        { $set: { status: 'cancelled' } },
        { new: true }
      );

      io.to(`duel:${code}`).emit('duel:cancelled', { code, reason: 'Host cancelled the challenge' });
      if (typeof callback === 'function') callback({ ok: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ ok: false, error: err.message });
    }
  });
}

module.exports = { setupDuelSockets };
