const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/', async (req, res) => {
  try {
    // Fetch top 10 users sorted by ELO rating in descending order
    const topUsers = await User.find()
      .sort({ 'eloRating': -1 })
      .limit(10)
      .select('username eloRating wins matches avatarSeed');
    
    // Map to structure expected by the frontend
    const mappedUsers = topUsers.map(u => ({
      _id: u._id,
      username: u.username,
      avatarSeed: u.avatarSeed || 'default-seed',
      stats: {
        eloRating: u.eloRating,
        wins: u.wins,
        totalMatches: u.matches
      }
    }));
    
    res.json(mappedUsers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
