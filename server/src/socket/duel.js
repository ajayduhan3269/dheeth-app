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
        { returnDocument: 'after' }
      );

      if (!duel) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Duel was just accepted by someone else or expired' });
        return;
      }

      // Fetch questions based on subject & configured question count & category
      const GS_SUBJECTS = ['Ancient History', 'Medieval History', 'Modern History', 'Polity', 'Biology', 'Indian Geography & Resources', 'World Core & Climate'];
      const subject = duel.config.subject;
      const category = duel.config.category || (GS_SUBJECTS.includes(subject) ? 'gs' : 'tech');
      const count = duel.config.questionCount || 5;

      let questions = await Question.aggregate([
        { $match: { subject } },
        { $sample: { size: count } },
      ]);

      if (questions.length === 0) {
        // Fallback: match category first so GS questions never pull Tech questions
        questions = await Question.aggregate([
          { $match: { category } },
          { $sample: { size: count } }
        ]);
        if (questions.length === 0) {
          questions = await Question.aggregate([{ $sample: { size: count } }]);
        }
      }

      if (!questions || questions.length === 0) {
        if (typeof callback === 'function') callback({ ok: false, error: 'No questions available for this duel subject in database.' });
        return;
      }

      const roomId = `room_duel_${Date.now()}`;
      duel.roomId = roomId;
      duel.status = 'live';
      await duel.save();

      const hostSocketId = global.connectedUsers.get(duel.hostId.toString());
      const guestSocketId = socket.id;

      // Check if host is actively viewing the duel lobby screen
      const hostSocket = hostSocketId ? io.sockets.sockets.get(hostSocketId) : null;
      const isHostActiveInLobby = Boolean(hostSocket && hostSocket.rooms && hostSocket.rooms.has(`duel:${code}`));

      // Make guest socket join the game room
      socket.join(roomId);
      socket.activeRoomId = roomId;

      if (isHostActiveInLobby && hostSocket) {
        hostSocket.join(roomId);
        hostSocket.activeRoomId = roomId;
      }

      // Fetch rivalry record for VS splash
      const rivalry = await Rivalry.getOrCreateRivalry(duel.hostId, fullUser._id);

      const basePayload = {
        roomId,
        subject: duel.config.subject,
        questions,
        isBotMatch: false,
        mode: category,
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
        waitingForHost: !isHostActiveInLobby,
        player: p2Data,
        opponent: p1Data,
      });

      // Notify host (p1) via WebSocket if actively in lobby
      if (isHostActiveInLobby && hostSocket) {
        hostSocket.emit('match_found', {
          ...basePayload,
          waitingForHost: false,
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
        { socketId: isHostActiveInLobby ? hostSocketId : '', username: duel.hostUsername, userId: duel.hostId.toString(), avatarSeed: duel.hostAvatar, eloRating: hostElo },
        { socketId: guestSocketId, username: fullUser.username, userId: fullUser._id.toString(), avatarSeed: guestAvatar, eloRating: guestElo },
        false,
        { secondsPerQ: duel.config.secondsPerQ || 20, questionCount: count, roundNumber: 1, waitingForHost: !isHostActiveInLobby, mode: category }
      );

      if (isHostActiveInLobby) {
        // Start the countdown / first question timer immediately after 3.5s intro
        setTimeout(() => startQuestionTimer(io, roomId), 3500);
      } else {
        // Standby window: wait up to 150s (2.5 minutes) for host to receive push notification and join
        const { activeMatches } = require('./gameplay');
        const match = activeMatches[roomId];
        if (match) {
          match.standbyTimeout = setTimeout(() => {
            if (match && match.waitingForHost) {
              io.to(roomId).emit('duel:host_timeout', {
                message: 'Host did not connect in time. Challenge standby expired.',
              });
              match.status = 'cancelled';
              Duel.updateOne({ roomId }, { status: 'expired' }).catch(() => {});
              delete activeMatches[roomId];
            }
          }, 150_000); // 150 seconds (2.5 mins)
        }
      }

      if (typeof callback === 'function') {
        callback({ ok: true, roomId, waitingForHost: !isHostOnline });
      }
    } catch (err) {
      console.error('Error accepting duel in socket:', err);
      if (typeof callback === 'function') callback({ ok: false, error: err.message || 'Failed to start duel' });
    }
  });

  // 4. Host or Guest joins/reconnects to an active live duel (from Notification or Direct Link)
  socket.on('duel:join_live_match', async (data, ack) => {
    try {
      const { code, roomId } = data || {};
      const user = socket.user;
      if (!user) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Authentication required' });
        return;
      }

      const userId = (user.id || user._id || user.userId).toString();
      const duel = await Duel.findOne({ code: String(code || '').toUpperCase() });
      if (!duel) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Duel not found' });
        return;
      }

      const targetRoomId = roomId || duel.roomId;
      const { activeMatches, startQuestionTimer } = require('./gameplay');
      const match = activeMatches[targetRoomId];

      if (!match || match.status !== 'active') {
        if (typeof ack === 'function') ack({ ok: false, error: 'Match session is no longer active' });
        return;
      }

      // Join socket room
      socket.join(targetRoomId);
      socket.activeRoomId = targetRoomId;

      if (match.players[userId]) {
        match.players[userId].socketId = socket.id;
        match.players[userId].connected = true;
      }

      // If match was waiting for host, only transition to live when HOST connects:
      if (match.waitingForHost) {
        const isHostConnecting = String(userId) === String(match.hostUserId || duel.hostId);
        const guestPlayer = match.guestUserId ? match.players[match.guestUserId] : null;
        const isGuestConnected = guestPlayer ? Boolean(guestPlayer.connected) : true;

        if (isHostConnecting && isGuestConnected) {
          if (match.standbyTimeout) {
            clearTimeout(match.standbyTimeout);
            match.standbyTimeout = null;
          }
          match.waitingForHost = false;

          Duel.updateOne({ roomId: targetRoomId }, { status: 'live' }).catch(() => {});

          io.to(targetRoomId).emit('duel:both_connected', {
            roomId: targetRoomId,
            message: 'Both contenders ready! Commencing match!',
          });

          // Launch synchronized 3.5s countdown timer
          setTimeout(() => startQuestionTimer(io, targetRoomId), 3500);
        }
      }

      if (typeof ack === 'function') ack({ ok: true, roomId: targetRoomId, waitingForHost: Boolean(match.waitingForHost) });
    } catch (err) {
      console.error('Error in duel:join_live_match:', err);
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  // 5. Cancel duel
  socket.on('duel:cancel', async (data, callback) => {
    try {
      const code = String(data?.code || '').trim().toUpperCase();
      const user = socket.user;
      if (!code || !user) return;

      const userId = user.id || user._id || user.userId;
      const duel = await Duel.findOneAndUpdate(
        { code, hostId: userId, status: 'pending' },
        { $set: { status: 'cancelled' } },
        { returnDocument: 'after' }
      );

      io.to(`duel:${code}`).emit('duel:cancelled', { code, reason: 'Host cancelled the challenge' });
      if (typeof callback === 'function') callback({ ok: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ ok: false, error: err.message });
    }
  });
}

module.exports = { setupDuelSockets };
