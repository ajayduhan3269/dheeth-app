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

    const { subject, questionCount, secondsPerQ } = req.body;

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
            subject: subject || 'Fluid Mechanics',
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
      { new: true }
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
