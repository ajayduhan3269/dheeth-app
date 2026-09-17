const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
    req.user = jwt.verify(token, secret);
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { avatarSeed, bio } = req.body;
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (avatarSeed !== undefined) user.avatarSeed = avatarSeed;
    if (bio !== undefined) user.bio = bio;

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

const { STREAMS } = require('../config/streams');

router.patch('/stream', verifyToken, async (req, res) => {
  try {
    const { targetExam } = req.body;
    if (!STREAMS.includes(targetExam)) {
      return res.status(400).json({
        success: false,
        message: `Invalid stream. Expected one of: ${STREAMS.join(', ')}`,
      });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { targetExam } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, targetExam: user.targetExam, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
