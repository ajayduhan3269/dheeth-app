const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('friends');
    res.json({ success: true, data: user.friends || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/request', verifyToken, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: 'Username is required' });

    const target = await User.findOne({ username });
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target._id.toString() === req.user.id) return res.status(400).json({ message: 'Cannot add yourself' });

    const sender = await User.findById(req.user.id);
    if (sender.friends.some(f => f.userId.toString() === target._id.toString())) {
      return res.status(400).json({ message: 'Already friends or request pending' });
    }

    sender.friends.push({ userId: target._id, username: target.username, status: 'pending' });
    target.friends.push({ userId: sender._id, username: sender.username, status: 'pending' });
    await sender.save();
    await target.save();

    res.json({ success: true, message: 'Friend request sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/accept', verifyToken, async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findById(req.user.id);
    const friend = await User.findOne({ username });
    if (!friend) return res.status(404).json({ message: 'User not found' });

    const myReq = user.friends.find(f => f.userId.toString() === friend._id.toString());
    const theirReq = friend.friends.find(f => f.userId.toString() === user._id.toString());
    if (!myReq || !theirReq) return res.status(400).json({ message: 'No pending request' });

    myReq.status = 'accepted';
    theirReq.status = 'accepted';
    await user.save();
    await friend.save();

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/remove', verifyToken, async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findById(req.user.id);
    const friend = await User.findOne({ username });
    if (!friend) return res.status(404).json({ message: 'User not found' });

    user.friends = user.friends.filter(f => f.userId.toString() !== friend._id.toString());
    friend.friends = friend.friends.filter(f => f.userId.toString() !== user._id.toString());
    await user.save();
    await friend.save();

    res.json({ success: true, message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;