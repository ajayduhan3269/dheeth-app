const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/auth');
const Duel = require('../models/Duel');
const User = require('../models/User');
const Rivalry = require('../models/Rivalry');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateDuelCode() {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

// Optional Auth middleware (for GET /api/duel/:code when user may or may not be authenticated)
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
      req.user = jwt.verify(token, secret);
    } catch (_) {
      // Ignore invalid token on optional auth
    }
  }
  next();
}

// POST /api/duel/create — Generate a new 1v1 duel invite
router.post('/create', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id || req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const { subject, category, questionCount, secondsPerQ } = req.body;
    const GS_SUBJECTS = ['Ancient History', 'Medieval History', 'Modern History', 'Polity', 'Biology', 'Indian Geography & Resources', 'World Core & Climate'];
    const chosenSubject = subject || 'Fluid Mechanics';
    const resolvedCategory = (category === 'gs' || category === 'tech') 
      ? category 
      : (GS_SUBJECTS.includes(chosenSubject) ? 'gs' : 'tech');

    // Cancel any previous pending duels by this host to keep code space clean
    await Duel.updateMany(
      { hostId: user._id, status: 'pending' },
      { $set: { status: 'cancelled' } }
    );

    const now = Date.now();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000); // 24 hours expiry

    let createdDuel = null;
    let attempts = 0;

    while (attempts < 5 && !createdDuel) {
      const code = generateDuelCode();
      try {
        createdDuel = await Duel.create({
          code,
          hostId: user._id,
          hostUsername: user.username,
          hostAvatar: user.equippedAvatar || user.avatarSeed || 'default-seed',
          hostTitle: user.title || 'Challenger',
          config: {
            subject: chosenSubject,
            category: resolvedCategory,
            questionCount: Number(questionCount) || 5,
            secondsPerQ: Number(secondsPerQ) || 20,
          },
          status: 'pending',
          expiresAt,
        });
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate code collision, retry
          attempts++;
        } else {
          throw err;
        }
      }
    }

    if (!createdDuel) {
      return res.status(500).json({ ok: false, error: 'Could not generate a unique duel code. Please retry.' });
    }

    return res.json({
      ok: true,
      code: createdDuel.code,
      duel: createdDuel,
    });
  } catch (err) {
    console.error('Error creating duel:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Server error creating duel.' });
  }
});

// GET /api/duel/active/mine — Fetch user's active pending or live duels for Dashboard management
router.get('/active/mine', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id || req.user.userId;
    const now = new Date();

    // Check for pending duel created by user that has not expired
    const pendingDuel = await Duel.findOne({
      hostId: userId,
      status: 'pending',
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    // Check for active live duel in progress involving user
    let liveDuel = await Duel.findOne({
      $or: [{ hostId: userId }, { guestId: userId }],
      status: 'live',
    }).sort({ updatedAt: -1 });

    // Verify if the live duel actually has an ongoing in-memory match
    if (liveDuel) {
      const { activeMatches } = require('../socket/gameplay');
      const inMemoryMatch = liveDuel.roomId ? activeMatches[liveDuel.roomId] : null;
      if (!inMemoryMatch || (inMemoryMatch.status !== 'active' && !inMemoryMatch.waitingForHost)) {
        // Match has concluded or expired; mark completed so banner is immediately removed
        await Duel.updateOne({ _id: liveDuel._id }, { status: 'completed' });
        liveDuel = null;
      }
    }

    return res.json({
      ok: true,
      pendingDuel: pendingDuel || null,
      liveDuel: liveDuel || null,
    });
  } catch (err) {
    console.error('Error fetching active duels for user:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch active challenges' });
  }
});

// GET /api/duel/:code/match-payload — Fetch full matchData for a live duel (for notification/reconnect entry)
router.get('/:code/match-payload', verifyToken, async (req, res) => {
  try {
    const rawCode = req.params.code ? req.params.code.trim().toUpperCase() : '';
    const userId = (req.user.id || req.user._id || req.user.userId).toString();

    const duel = await Duel.findOne({ code: rawCode });
    if (!duel) {
      return res.status(404).json({ ok: false, error: 'Duel not found' });
    }

    const isHost = duel.hostId.toString() === userId;
    const isGuest = duel.guestId && duel.guestId.toString() === userId;

    if (!isHost && !isGuest) {
      return res.status(403).json({ ok: false, error: 'You are not a participant in this duel.' });
    }

    if (duel.status !== 'live' && duel.status !== 'accepted') {
      return res.status(400).json({ ok: false, error: `Duel is not live (status: ${duel.status})` });
    }

    const { getMatchByRoomId } = require('../socket/gameplay');
    const match = getMatchByRoomId(duel.roomId);

    if (!match) {
      // Auto-expire/complete stale duel in MongoDB so frontend doesn't loop endlessly
      await Duel.updateOne({ _id: duel._id }, { status: 'completed' });
      return res.status(404).json({ ok: false, error: 'Match session is no longer active or has ended.' });
    }

    const rivalry = await Rivalry.getOrCreateRivalry(duel.hostId, duel.guestId);

    const p1Data = {
      id: duel.hostId.toString(),
      username: duel.hostUsername,
      avatarSeed: duel.hostAvatar,
      title: duel.hostTitle,
    };

    const p2Data = {
      id: duel.guestId.toString(),
      username: duel.guestUsername,
      avatarSeed: duel.guestAvatar,
      title: duel.guestTitle,
    };

    const matchData = {
      roomId: duel.roomId,
      subject: match.subject || duel.config.subject,
      questions: match.questions,
      isBotMatch: false,
      mode: 'duel',
      isDuel: true,
      duelCode: duel.code,
      ratingMode: 'friendly',
      secondsPerQ: match.secondsPerQ || duel.config.secondsPerQ || 20,
      waitingForHost: Boolean(match.waitingForHost),
      player: isHost ? p1Data : p2Data,
      opponent: isHost ? p2Data : p1Data,
      rivalry: {
        scoreHost: duel.hostId.toString() === rivalry.players[0].toString() ? rivalry.scoreA : rivalry.scoreB,
        scoreGuest: duel.guestId.toString() === rivalry.players[0].toString() ? rivalry.scoreA : rivalry.scoreB,
        totalDuels: rivalry.totalDuels,
        streak: rivalry.currentStreak,
      },
    };

    return res.json({
      ok: true,
      matchData,
      duel,
    });
  } catch (err) {
    console.error('Error fetching duel match payload:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch match session' });
  }
});

// GET /api/duel/:code — Fetch duel details + Head-to-Head rivalry stats
router.get('/:code', optionalAuth, async (req, res) => {
  try {
    const rawCode = req.params.code ? req.params.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{4,10}$/.test(rawCode)) {
      return res.status(400).json({ ok: false, error: 'Invalid challenge code format.' });
    }

    const duel = await Duel.findOne({ code: rawCode });
    if (!duel) {
      return res.status(404).json({ ok: false, error: 'Duel challenge not found or has expired.' });
    }

    // Check expiry
    if (new Date() > duel.expiresAt && duel.status === 'pending') {
      duel.status = 'expired';
      await duel.save();
    }

    let rivalry = null;
    const currentUserId = req.user ? (req.user.id || req.user._id || req.user.userId) : null;

    if (currentUserId && currentUserId.toString() !== duel.hostId.toString()) {
      rivalry = await Rivalry.getOrCreateRivalry(duel.hostId, currentUserId);
    }

    return res.json({
      ok: true,
      duel,
      rivalry,
    });
  } catch (err) {
    console.error('Error fetching duel:', err);
    return res.status(500).json({ ok: false, error: 'Server error fetching duel details.' });
  }
});

// POST /api/duel/:code/cancel — Host cancels a pending duel
router.post('/:code/cancel', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id || req.user.userId;
    const code = req.params.code.trim().toUpperCase();

    const duel = await Duel.findOneAndUpdate(
      { code, hostId: userId, status: 'pending' },
      { $set: { status: 'cancelled' } },
      { returnDocument: 'after' }
    );

    if (!duel) {
      return res.status(400).json({ ok: false, error: 'Could not cancel duel. It may have already started or expired.' });
    }

    return res.json({ ok: true, duel });
  } catch (err) {
    console.error('Error cancelling duel:', err);
    return res.status(500).json({ ok: false, error: 'Server error cancelling duel.' });
  }
});

module.exports = router;

