const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Question = require('../models/Question');
const verifyToken = require('../middleware/auth');
const statesData = require('../../data/statesData.json');

const SHIELD_HOURS = 12;
const RAID_SHIELD_HOURS = 24;
const TRIBUTE_RATE = 5;
const TRIBUTE_CAP_HOURS = 24;
const MAX_CASTLE_LEVEL = 5;
const UPGRADE_COST_PER_LEVEL = 300;
const SIEGE_ENTRY_FEE = 100;
const SIEGE_COOLDOWN_HOURS = 2;
const FAILED_SIEGE_BOUNTY = 50;
const DECAY_HOURS = 48;
const ADJACENCY_BONUS = 0.25;

const isShielded = (conquest) =>
  conquest?.shieldUntil && new Date(conquest.shieldUntil) > new Date();

const pendingTributeFor = (conquest, adjacentOwnedCount = 0) => {
  const last = conquest.lastTributeAt
    ? new Date(conquest.lastTributeAt)
    : new Date(conquest.ownedSince || Date.now());
  const hours = Math.min(
    Math.floor((Date.now() - last.getTime()) / 3600000),
    TRIBUTE_CAP_HOURS
  );
  const baseTribute = Math.max(hours, 0) * TRIBUTE_RATE * (conquest.castleLevel || 1);
  const multiplier = 1 + (ADJACENCY_BONUS * adjacentOwnedCount);
  return Math.floor(baseTribute * multiplier);
};

const getAdjacentOwnedCount = (stateId, ownedStateIds) => {
  const state = statesData.find(s => s.id === stateId);
  if (!state || !state.neighbors) return 0;
  return state.neighbors.filter(nId => ownedStateIds.has(nId)).length;
};

const applyDecay = (conquest) => {
  if (!conquest.lastMaintainedAt) {
    conquest.lastMaintainedAt = conquest.ownedSince || new Date();
  }
  const hoursSinceMaintenance = (Date.now() - new Date(conquest.lastMaintainedAt).getTime()) / 3600000;
  const levelsToDecay = Math.floor(hoursSinceMaintenance / DECAY_HOURS);
  if (levelsToDecay > 0 && conquest.castleLevel > 1) {
    conquest.castleLevel = Math.max(1, conquest.castleLevel - levelsToDecay);
    return true;
  }
  return false;
};

const getDecayWarning = (conquest) => {
  if (!conquest.lastMaintainedAt) return false;
  const hoursSince = (Date.now() - new Date(conquest.lastMaintainedAt).getTime()) / 3600000;
  return hoursSince >= (DECAY_HOURS - 12);
};

const fetchQuestions = async (subject, count) => {
  let questions = await Question.aggregate([
    { $match: { subject } },
    { $sample: { size: count } }
  ]);
  if (questions.length < count) {
    const existingIds = questions.map(q => q._id);
    const more = await Question.aggregate([
      { $match: { subject, _id: { $nin: existingIds } } },
      { $sample: { size: count - questions.length } }
    ]);
    questions = [...questions, ...more];
  }
  return questions;
};

router.get('/states', verifyToken, async (req, res) => {
  try {
    const allUsers = await User.find({ 'conqueredStates.0': { $exists: true } }).select('username conqueredStates');
    const savePromises = [];
    const conquestMap = {};
    for (const u of allUsers) {
      let needsSave = false;
      (u.conqueredStates || []).forEach(c => {
        if (applyDecay(c)) needsSave = true;
        conquestMap[c.stateId] = {
          username: u.username,
          userId: u._id.toString(),
          castleLevel: c.castleLevel || 1,
          shieldUntil: c.shieldUntil || null,
        };
      });
      if (needsSave) savePromises.push(u.save());
    }
    if (savePromises.length > 0) await Promise.all(savePromises);
    
    const user = await User.findById(req.user.id).select('conqueredStates coins siegeCooldowns');
    const ownedStateIds = new Set((user.conqueredStates || []).map(c => c.stateId));
    let userNeedsSave = false;
    (user.conqueredStates || []).forEach(c => {
      if (applyDecay(c)) userNeedsSave = true;
    });
    if (userNeedsSave) await user.save();
    
    const states = statesData.map(s => {
      // Fix 5: Read from cooldown array instead of map
      const cooldownEntry = (user.siegeCooldowns || []).find(c => c.stateId === s.id);
      const siegeCooldownUntil = cooldownEntry?.expiresAt || null;
      const onCooldown = siegeCooldownUntil && new Date(siegeCooldownUntil) > new Date();
      return {
        ...s,
        conquered: !!conquestMap[s.id],
        conqueredBy: conquestMap[s.id]?.username || null,
        castleLevel: conquestMap[s.id]?.castleLevel || 0,
        shieldUntil: conquestMap[s.id]?.shieldUntil || null,
        siegeCooldownUntil: onCooldown ? siegeCooldownUntil : null,
      };
    });
    
    const myConquests = (user.conqueredStates || []).map(c => {
      const adjCount = getAdjacentOwnedCount(c.stateId, ownedStateIds);
      return {
        stateId: c.stateId,
        castleLevel: c.castleLevel || 1,
        ownedSince: c.ownedSince,
        shieldUntil: c.shieldUntil || null,
        pendingTribute: pendingTributeFor(c, adjCount),
        adjacencyBonus: adjCount,
        decayWarning: getDecayWarning(c),
        lastMaintainedAt: c.lastMaintainedAt,
      };
    });
    const pendingTribute = myConquests.reduce((sum, c) => sum + c.pendingTribute, 0);
    res.json({ success: true, data: states, conqueredCount: myConquests.length, totalStates: statesData.length, myConquests, coins: user.coins || 0, pendingTribute });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/tribute', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const ownedStateIds = new Set((user.conqueredStates || []).map(c => c.stateId));
    let total = 0;
    (user.conqueredStates || []).forEach(c => {
      const adjCount = getAdjacentOwnedCount(c.stateId, ownedStateIds);
      const amt = pendingTributeFor(c, adjCount);
      if (amt > 0) { total += amt; c.lastTributeAt = new Date(); }
    });
    if (total === 0) return res.status(400).json({ message: 'No tribute to collect yet.' });
    user.coins = (user.coins || 0) + total;
    await user.save();
    res.json({ success: true, collected: total, coins: user.coins });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/upgrade', verifyToken, async (req, res) => {
  try {
    const { stateId } = req.body;
    const user = await User.findById(req.user.id);
    const conquest = user.conqueredStates.find(c => c.stateId === stateId);
    if (!conquest) return res.status(400).json({ message: 'You do not own this state' });
    if (conquest.castleLevel >= MAX_CASTLE_LEVEL) return res.status(400).json({ message: 'Already at max level' });
    const cost = conquest.castleLevel * UPGRADE_COST_PER_LEVEL;
    if (user.coins < cost) return res.status(400).json({ message: 'Not enough coins' });
    user.coins -= cost;
    conquest.castleLevel += 1;
    await user.save();
    res.json({ success: true, castleLevel: conquest.castleLevel, coins: user.coins });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/siege/start', verifyToken, async (req, res) => {
  try {
    const { stateId } = req.body;
    const state = statesData.find(s => s.id === stateId);
    if (!state) return res.status(404).json({ message: 'State not found' });
    const user = await User.findById(req.user.id);
    if (user.conqueredStates.some(c => c.stateId === stateId)) {
      return res.status(400).json({ message: 'You already own this state.' });
    }
    
    // Fix 5: Check cooldown array instead of map
    const cooldownEntry = (user.siegeCooldowns || []).find(c => c.stateId === stateId);
    const cooldownUntil = cooldownEntry?.expiresAt;
    if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
      const minutesLeft = Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 60000);
      return res.status(400).json({ message: 'On cooldown. Try again in ' + minutesLeft + ' minutes.' });
    }
    
    const allUsers = await User.find({ 'conqueredStates.stateId': stateId });
    const owner = allUsers.find(u => u.conqueredStates.some(c => c.stateId === stateId));
    const ownerConquest = owner?.conqueredStates.find(c => c.stateId === stateId);
    if (ownerConquest && isShielded(ownerConquest)) {
      return res.status(400).json({ message: 'This state is protected right now.' });
    }
    const castleLevel = ownerConquest?.castleLevel || 0;
    if (castleLevel >= 3) {
      return res.status(400).json({ message: 'Too strong. Use multi-round mode instead.' });
    }
    
    // Fix 3: Fee removed from here — deducted in /siege/complete instead
    
    // Fix 4: Check question pool size before fetching
    const questionCount = await Question.countDocuments({ subject: state.subject });
    if (questionCount < 5) {
      return res.status(400).json({ message: 'Not enough questions for this subject.' });
    }
    
    const questions = await fetchQuestions(state.subject, 5);
    const difficulty = { requiredCorrect: 4, timePerQuestion: castleLevel >= 1 ? 30 : 0, castleLevel };
    res.json({
      success: true,
      questions: questions.map(q => ({ _id: q._id, questionText: q.questionText, options: q.options, hasDiagram: q.hasDiagram, diagramUrl: q.diagramUrl })),
      difficulty, stateId, stateName: state.name,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/siege/complete', verifyToken, async (req, res) => {
  try {
    const { stateId, answers } = req.body;
    if (!stateId || !answers || !Array.isArray(answers)) return res.status(400).json({ message: 'stateId and answers required' });
    const state = statesData.find(s => s.id === stateId);
    if (!state) return res.status(404).json({ message: 'State not found' });
    
    const questionIds = answers.map(a => a.questionId);
    const questions = await Question.find({ _id: { $in: questionIds } });
    const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
    let correctCount = 0;
    
    // Fix 6: Null check before calling toLowerCase
    answers.forEach(a => {
      const q = questionMap[a.questionId];
      if (q && a.selectedOption != null && a.selectedOption.toLowerCase() === q.correctOption?.toLowerCase()) correctCount++;
    });
    
    const user = await User.findById(req.user.id);
    
    // Fix 3: Deduct fee in complete regardless of pass/fail
    if (user.coins < SIEGE_ENTRY_FEE) {
      return res.status(400).json({ message: 'Not enough coins to complete siege.' });
    }
    user.coins -= SIEGE_ENTRY_FEE;
    
    const passed = correctCount >= 4;
    if (passed) {
      // Fix 1: Use atomic updateOne for removal + defender bounty
      await User.updateOne(
        { 'conqueredStates.stateId': stateId, _id: { $ne: user._id } },
        { $pull: { conqueredStates: { stateId: stateId } }, $inc: { coins: FAILED_SIEGE_BOUNTY } }
      );
      
      user.conqueredStates.push({ stateId, castleLevel: 1, ownedSince: new Date(), shieldUntil: new Date(Date.now() + SHIELD_HOURS * 3600000), lastTributeAt: new Date(), lastMaintainedAt: new Date() });
      
      // Fix 5: Clear cooldown using array filter
      user.siegeCooldowns = (user.siegeCooldowns || []).filter(c => c.stateId !== stateId);
      await user.save();
      res.json({ success: true, passed: true, correctCount });
    } else {
      // Fix 5: Set cooldown using array logic
      if (!user.siegeCooldowns) user.siegeCooldowns = [];
      const existingIndex = user.siegeCooldowns.findIndex(c => c.stateId === stateId);
      const newCooldown = { stateId, expiresAt: new Date(Date.now() + SIEGE_COOLDOWN_HOURS * 3600000) };
      if (existingIndex >= 0) {
        user.siegeCooldowns[existingIndex] = newCooldown;
      } else {
        user.siegeCooldowns.push(newCooldown);
      }
      await user.save();
      
      // Fix 1: Atomically award defender bounty
      await User.updateOne(
        { 'conqueredStates.stateId': stateId, _id: { $ne: user._id } },
        { $inc: { coins: FAILED_SIEGE_BOUNTY } }
      );
      
      res.json({ success: true, passed: false, correctCount, cooldownMinutes: SIEGE_COOLDOWN_HOURS * 60 });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/raid/start', verifyToken, async (req, res) => {
  try {
    const { stateId } = req.body;
    const state = statesData.find(s => s.id === stateId);
    if (!state) return res.status(404).json({ message: 'State not found' });
    const user = await User.findById(req.user.id);
    if (user.conqueredStates.some(c => c.stateId === stateId)) return res.status(400).json({ message: 'You already own this state.' });
    const allUsers = await User.find({ 'conqueredStates.stateId': stateId });
    const owner = allUsers.find(u => u.conqueredStates.some(c => c.stateId === stateId));
    const ownerConquest = owner?.conqueredStates.find(c => c.stateId === stateId);
    if (!ownerConquest || ownerConquest.castleLevel < 3) return res.status(400).json({ message: 'Only for Castle Lv3+ states.' });
    if (isShielded(ownerConquest)) return res.status(400).json({ message: 'State is protected.' });
    
    // Fix 4: Check question pool size before fetching
    const questionCount = await Question.countDocuments({ subject: state.subject });
    if (questionCount < 15) {
      return res.status(400).json({ message: 'Not enough questions for this subject.' });
    }
    
    const questions = await fetchQuestions(state.subject, 15);
    const rounds = [questions.slice(0, 5), questions.slice(5, 10), questions.slice(10, 15)];
    res.json({
      success: true,
      rounds: rounds.map((round, i) => ({ roundNumber: i + 1, questions: round.map(q => ({ _id: q._id, questionText: q.questionText, options: q.options, hasDiagram: q.hasDiagram, diagramUrl: q.diagramUrl })) })),
      castleLevel: ownerConquest.castleLevel, stateId, stateName: state.name,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/raid/complete', verifyToken, async (req, res) => {
  try {
    const { stateId, roundResults } = req.body;
    if (!stateId || !roundResults || !Array.isArray(roundResults)) return res.status(400).json({ message: 'stateId and roundResults required' });
    const state = statesData.find(s => s.id === stateId);
    if (!state) return res.status(404).json({ message: 'State not found' });
    
    const allQuestionIds = roundResults.flatMap(r => r.answers.map(a => a.questionId));
    const questions = await Question.find({ _id: { $in: allQuestionIds } });
    const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
    let roundsPassed = 0;
    let totalRounds = roundResults.length;
    const roundDetails = [];
    
    for (const round of roundResults) {
      let correct = 0;
      (round.answers || []).forEach(a => {
        const q = questionMap[a.questionId];
        // Fix 6: Null check before calling toLowerCase
        if (q && a.selectedOption != null && a.selectedOption.toLowerCase() === q.correctOption?.toLowerCase()) correct++;
      });
      const passed = correct >= 4;
      if (passed) roundsPassed++;
      roundDetails.push({ correct, total: 5, passed });
    }
    
    const user = await User.findById(req.user.id);
    const allUsers = await User.find({ 'conqueredStates.stateId': stateId });
    const owner = allUsers.find(u => u.conqueredStates.some(c => c.stateId === stateId));
    const ownerConquest = owner?.conqueredStates.find(c => c.stateId === stateId);
    if (!ownerConquest) return res.status(400).json({ message: 'State no longer occupied.' });
    
    const allRoundsPassed = roundsPassed === totalRounds;
    if (allRoundsPassed) {
      // Fix 1: Use atomic updateOne for removal + defender bounty
      await User.updateOne(
        { 'conqueredStates.stateId': stateId, _id: { $ne: user._id } },
        { $pull: { conqueredStates: { stateId: stateId } }, $inc: { coins: FAILED_SIEGE_BOUNTY } }
      );
      
      user.conqueredStates.push({ stateId, castleLevel: 1, ownedSince: new Date(), shieldUntil: new Date(Date.now() + RAID_SHIELD_HOURS * 3600000), lastTributeAt: new Date(), lastMaintainedAt: new Date() });
      await user.save();
      res.json({ success: true, captured: true, roundsPassed, totalRounds, roundDetails });
    } else {
      // Fix 2: Single save — castle level + defender bounty combined
      ownerConquest.castleLevel = Math.min(MAX_CASTLE_LEVEL, ownerConquest.castleLevel + 1);
      owner.coins = (owner.coins || 0) + FAILED_SIEGE_BOUNTY;
      await owner.save();
      
      res.json({ success: true, captured: false, roundsPassed, totalRounds, roundDetails, castleRegenerated: true, newCastleLevel: ownerConquest.castleLevel });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/maintain', verifyToken, async (req, res) => {
  try {
    const { stateId, action, answers } = req.body;
    const user = await User.findById(req.user.id);
    const conquest = user.conqueredStates.find(c => c.stateId === stateId);
    if (!conquest) return res.status(400).json({ message: 'You do not own this state' });
    const state = statesData.find(s => s.id === stateId);
    if (!state) return res.status(404).json({ message: 'State not found' });
    if (action === 'start') {
      // Fix 4: Check question pool size before fetching
      const questionCount = await Question.countDocuments({ subject: state.subject });
      if (questionCount < 3) {
        return res.status(400).json({ message: 'Not enough questions for this subject.' });
      }
      
      const questions = await fetchQuestions(state.subject, 3);
      return res.json({ success: true, questions: questions.map(q => ({ _id: q._id, questionText: q.questionText, options: q.options, hasDiagram: q.hasDiagram, diagramUrl: q.diagramUrl })), stateId, stateName: state.name });
    }
    if (action === 'complete') {
      if (!answers || !Array.isArray(answers)) return res.status(400).json({ message: 'answers required' });
      const questionIds = answers.map(a => a.questionId);
      const questions = await Question.find({ _id: { $in: questionIds } });
      const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
      let correctCount = 0;
      // Fix 6: Null check before calling toLowerCase
      answers.forEach(a => { const q = questionMap[a.questionId]; if (q && a.selectedOption != null && a.selectedOption.toLowerCase() === q.correctOption?.toLowerCase()) correctCount++; });
      if (correctCount >= 2) { conquest.lastMaintainedAt = new Date(); await user.save(); return res.json({ success: true, passed: true, correctCount }); }
      else { return res.json({ success: true, passed: false, correctCount }); }
    }
    return res.status(400).json({ message: 'Invalid action.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/leaderboard', verifyToken, async (req, res) => {
  try {
    const users = await User.find({ 'conqueredStates.0': { $exists: true } }).select('username conqueredStates');
    const leaderboard = users.map(u => { const sc = (u.conqueredStates || []).length; const tl = (u.conqueredStates || []).reduce((s, c) => s + (c.castleLevel || 1), 0); return { username: u.username, statesCount: sc, totalLevel: tl, power: sc * 100 + tl * 50 }; }).sort((a, b) => b.power - a.power).slice(0, 20).map((e, i) => ({ rank: i + 1, ...e }));
    res.json({ success: true, data: leaderboard });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
