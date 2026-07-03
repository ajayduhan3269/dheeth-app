const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/auth');
const statesData = require('../../data/statesData.json');

// --- War Map constants ---
const SHIELD_HOURS = 12;          // protection after capture/buyout
const TRIBUTE_RATE = 5;           // coins per hour per castle level
const TRIBUTE_CAP_HOURS = 24;     // max accrual window
const MAX_CASTLE_LEVEL = 5;
const UPGRADE_COST_PER_LEVEL = 300;
const BUYOUT_UNCLAIMED_COST = 300;
const BUYOUT_COST_PER_LEVEL = 800;

const isShielded = (conquest) =>
  conquest?.shieldUntil && new Date(conquest.shieldUntil) > new Date();

const pendingTributeFor = (conquest) => {
  const last = conquest.lastTributeAt
    ? new Date(conquest.lastTributeAt)
    : new Date(conquest.ownedSince || Date.now());
  const hours = Math.min(
    Math.floor((Date.now() - last.getTime()) / 3600000),
    TRIBUTE_CAP_HOURS
  );
  return Math.max(hours, 0) * TRIBUTE_RATE * (conquest.castleLevel || 1);
};

// Full war map state
router.get('/states', verifyToken, async (req, res) => {
  try {
    const allUsers = await User.find({ 'conqueredStates.0': { $exists: true } }).select('username conqueredStates');
    const conquestMap = {};
    allUsers.forEach(u => {
      (u.conqueredStates || []).forEach(c => {
        conquestMap[c.stateId] = {
          username: u.username,
          castleLevel: c.castleLevel || 1,
          shieldUntil: c.shieldUntil || null,
        };
      });
    });

    const states = statesData.map(s => ({
      ...s,
      conquered: !!conquestMap[s.id],
      conqueredBy: conquestMap[s.id]?.username || null,
      castleLevel: conquestMap[s.id]?.castleLevel || 0,
      shieldUntil: conquestMap[s.id]?.shieldUntil || null,
    }));

    const user = await User.findById(req.user.id).select('conqueredStates coins');
    const myConquests = (user.conqueredStates || []).map(c => ({
      stateId: c.stateId,
      castleLevel: c.castleLevel || 1,
      ownedSince: c.ownedSince,
      shieldUntil: c.shieldUntil || null,
      pendingTribute: pendingTributeFor(c),
    }));
    const pendingTribute = myConquests.reduce((sum, c) => sum + c.pendingTribute, 0);

    res.json({
      success: true,
      data: states,
      conqueredCount: myConquests.length,
      totalStates: statesData.length,
      myConquests,
      coins: user.coins || 0,
      pendingTribute,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Collect accrued tribute from all owned states
router.post('/tribute', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    let total = 0;
    (user.conqueredStates || []).forEach(c => {
      const amt = pendingTributeFor(c);
      if (amt > 0) {
        total += amt;
        c.lastTributeAt = new Date();
      }
    });

    if (total === 0) {
      return res.status(400).json({ message: 'No tribute to collect yet. States earn coins every hour.' });
    }

    user.coins = (user.coins || 0) + total;
    await user.save();
    res.json({ success: true, message: `Collected ${total} 🪙 in tribute!`, collected: total, coins: user.coins });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Upgrade castle level (defense against sieges)
router.post('/upgrade', verifyToken, async (req, res) => {
  try {
    const { stateId } = req.body;
    const user = await User.findById(req.user.id);
    const conquest = user.conqueredStates.find(c => c.stateId === stateId);
    if (!conquest) return res.status(400).json({ message: 'You do not own this state' });
    if (conquest.castleLevel >= MAX_CASTLE_LEVEL) return res.status(400).json({ message: 'Castle already at max level' });

    const cost = conquest.castleLevel * UPGRADE_COST_PER_LEVEL;
    if (user.coins < cost) return res.status(400).json({ message: `Need ${cost} coins, you have ${user.coins}` });

    user.coins -= cost;
    conquest.castleLevel += 1;
    await user.save();

    res.json({ success: true, message: `Castle upgraded to level ${conquest.castleLevel}!`, castleLevel: conquest.castleLevel, coins: user.coins });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Pay to conquer instantly (blocked by shields, expensive vs battles)
router.post('/buyout', verifyToken, async (req, res) => {
  try {
    const { stateId } = req.body;
    const state = statesData.find(s => s.id === stateId);
    if (!state) return res.status(404).json({ message: 'State not found' });

    const user = await User.findById(req.user.id);
    if (user.conqueredStates.some(c => c.stateId === stateId)) {
      return res.status(400).json({ message: 'You already own this state' });
    }

    const allUsers = await User.find({ 'conqueredStates.stateId': stateId });
    const owner = allUsers.find(u => u.conqueredStates.some(c => c.stateId === stateId));
    const ownerConquest = owner?.conqueredStates.find(c => c.stateId === stateId);

    if (ownerConquest && isShielded(ownerConquest)) {
      return res.status(400).json({ message: 'This state is shielded and cannot be bought out right now' });
    }

    const cost = ownerConquest
      ? (ownerConquest.castleLevel || 1) * BUYOUT_COST_PER_LEVEL
      : BUYOUT_UNCLAIMED_COST;
    if (user.coins < cost) return res.status(400).json({ message: `Need ${cost} coins, you have ${user.coins}` });

    // Compensate the previous owner
    if (owner) {
      owner.conqueredStates = owner.conqueredStates.filter(c => c.stateId !== stateId);
      owner.coins = (owner.coins || 0) + Math.floor(cost * 0.5);
      await owner.save();
    }

    user.coins -= cost;
    user.conqueredStates.push({
      stateId,
      castleLevel: 1,
      ownedSince: new Date(),
      shieldUntil: new Date(Date.now() + SHIELD_HOURS * 3600 * 1000),
      lastTributeAt: new Date(),
    });
    await user.save();

    res.json({
      success: true,
      message: `${state.name} bought out! A 12h shield protects it.`,
      conqueredStates: user.conqueredStates,
      coins: user.coins,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Empire leaderboard ranked by war power
router.get('/leaderboard', verifyToken, async (req, res) => {
  try {
    const users = await User.find({ 'conqueredStates.0': { $exists: true } }).select('username conqueredStates');
    const leaderboard = users
      .map(u => {
        const statesCount = (u.conqueredStates || []).length;
        const totalLevel = (u.conqueredStates || []).reduce((sum, c) => sum + (c.castleLevel || 1), 0);
        return {
          username: u.username,
          statesCount,
          totalLevel,
          power: statesCount * 100 + totalLevel * 50,
        };
      })
      .sort((a, b) => b.power - a.power)
      .slice(0, 20)
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    res.json({ success: true, data: leaderboard });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
