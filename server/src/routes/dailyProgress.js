const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

const getTodayStr = () => new Date().toISOString().split('T')[0];

router.get('/', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const today = getTodayStr();
    let reset = false;

    if (user.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const wasActiveYesterday = user.lastActiveDate === yesterday;

      if (!wasActiveYesterday && user.streak > 0) {
        if (user.streakFreeze > 0) {
          user.streakFreeze -= 1;
        } else {
          user.streak = 0;
        }
      }

      // Reset daily counters
      user.dailyQuestionsAnswered = 0;
      user.dailyWins = 0;
      user.lastActiveDate = today;
      reset = true;
      await user.save();
    }

    res.json({
      success: true,
      data: {
        dailyQuestionsAnswered: user.dailyQuestionsAnswered,
        dailyWins: user.dailyWins,
        dailyGoal: user.dailyGoal,
        streak: user.streak,
        streakFreeze: user.streakFreeze,
        coins: user.coins || 0,
        reset
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/increment', verifyToken, async (req, res) => {
  try {
    const { type } = req.body; // 'question' or 'win'
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const today = getTodayStr();
    if (user.lastActiveDate !== today) {
      user.dailyQuestionsAnswered = 0;
      user.dailyWins = 0;
      user.lastActiveDate = today;
    }

    const prevCount = type === 'win' ? user.dailyWins : user.dailyQuestionsAnswered;

    if (type === 'win') {
      user.dailyWins += 1;
    } else {
      user.dailyQuestionsAnswered += 1;
    }

    const newCount = type === 'win' ? user.dailyWins : user.dailyQuestionsAnswered;
    let reward = null;

    // Check if cross the daily goal threshold
    if (prevCount < user.dailyGoal && newCount >= user.dailyGoal) {
      user.coins = (user.coins || 0) + 500;
      user.streak += 1;
      user.streakFreeze = (user.streakFreeze || 0) + 1;
      user.lastActiveDate = today;
      reward = { coins: 500, streak: user.streak, streakFreeze: 1 };
    }

    await user.save();

    res.json({
      success: true,
      data: {
        dailyQuestionsAnswered: user.dailyQuestionsAnswered,
        dailyWins: user.dailyWins,
        dailyGoal: user.dailyGoal,
        streak: user.streak,
        streakFreeze: user.streakFreeze,
        coins: user.coins || 0,
        reward
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/goal', verifyToken, async (req, res) => {
  try {
    const { dailyGoal } = req.body;
    if (!dailyGoal || dailyGoal < 1) {
      return res.status(400).json({ message: 'Daily goal must be at least 1' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.dailyGoal = dailyGoal;
    await user.save();
    res.json({ success: true, data: { dailyGoal: user.dailyGoal } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;