const User = require('../models/User');
const Question = require('../models/Question');
const Rivalry = require('../models/Rivalry');
const Duel = require('../models/Duel');
const MistakeNotebook = require('../models/MistakeNotebook');
const QuestionAttempt = require('../models/QuestionAttempt');
const { evaluatePowerupGrants, applyEmp } = require('../services/powerupEngine');
const { botEngine } = require('../services/botEngine');
const { botEmoteEngine } = require('../services/botEmoteEngine');
const { emoteRateLimiter } = require('../services/emoteRateLimiter');
const statesData = require('../../data/statesData.json');

const activeMatches = {};
const rematchState = {};
const activeMatchByUser = {}; // userId -> roomId
const disconnectGraceTimers = new Map(); // `${roomId}:${userId}` -> Timeout
const GRACE_PERIOD_MS = 30_000;

const clearMatchGraceTimers = (roomId) => {
  for (const [key, timer] of disconnectGraceTimers.entries()) {
    if (key.startsWith(`${roomId}:`)) {
      clearTimeout(timer);
      disconnectGraceTimers.delete(key);
    }
  }
};

const SHIELD_HOURS = 12;

const normalizeAttemptMode = (m) => {
  if (!m) return 'RANKED';
  const s = String(m).trim().toUpperCase();
  if (s === 'GS' || s === 'TECH') return 'RANKED';
  if (s === 'DUEL' || s === 'FRIEND' || s === 'FRIEND_DUEL') return 'FRIEND_DUEL';
  if (s === 'BOT' || s === 'BOT_MATCH') return 'BOT';
  if (s === 'DRILL') return 'DRILL';
  if (s === 'REDEEM') return 'REDEEM';
  return 'RANKED';
};

async function recordAttemptAndMistake({ userId, question, isCorrect, selectedOption, timeSpentMs, mode, matchId, usedPowerup, powerupType }) {
  if (!userId || userId === 'bot' || !question || !question._id) return;
  const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const answeredAt = new Date();
  const resolvedMode = normalizeAttemptMode(mode);

  try {
    // 1. Immutable Attempt Record
    await QuestionAttempt.create({
      attemptId,
      userId,
      questionId: question._id,
      matchId: matchId || null,
      mode: resolvedMode,
      subject: question.subject || 'General',
      topic: question.topic || 'General',
      correct: Boolean(isCorrect),
      selectedAnswer: selectedOption || null,
      correctAnswer: question.correctOption,
      timeSpentMs: timeSpentMs || 0,
      usedPowerup: Boolean(usedPowerup),
      powerupType: powerupType || null,
      answeredAt
    });

    // 2. Mistake Notebook Entry (Level 1)
    if (!isCorrect) {
      await MistakeNotebook.findOneAndUpdate(
        { userId, questionId: question._id },
        {
          $set: {
            exam: 'GATE',
            subject: question.subject || 'General',
            topic: question.topic || 'General',
            level: 1,
            active: true,
            lastMissedAt: answeredAt,
            nextReviewAt: answeredAt,
            lastSelectedAnswer: selectedOption,
            correctAnswerSnapshot: question.correctOption,
            lastTimeSpentMs: timeSpentMs || 0,
            revisionReason: 'RECENT_MISS',
            masteredAt: null,
            level2AchievedAt: null
          },
          $setOnInsert: { firstMissedAt: answeredAt },
          $inc: { wrongCount: 1 },
          $push: {
            occurrences: {
              $each: [{
                attemptId,
                matchId: matchId || null,
                mode: resolvedMode,
                selectedAnswer: selectedOption,
                correctAnswer: question.correctOption,
                timeSpentMs: timeSpentMs || 0,
                occurredAt: answeredAt
              }],
              $slice: -20
            }
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }
  } catch (err) {
    console.error('[MistakeCapture] Error:', err.message);
  }
}

const handleConquest = async (userId, targetStateId) => {
  if (!userId || userId === 'bot' || userId === 'bot_user_id' || !targetStateId) return null;
  try {
    const state = statesData.find(s => s.id === targetStateId);
    if (!state) return null;
    const user = await User.findById(userId);
    if (!user) return null;
    if (user.conqueredStates.some(c => c.stateId === state.id)) return null;

    const allUsers = await User.find({ 'conqueredStates.stateId': state.id });
    const owner = allUsers.find(u => u.conqueredStates.some(c => c.stateId === state.id));

    if (owner && owner._id.toString() !== userId.toString()) {
      const conquest = owner.conqueredStates.find(c => c.stateId === state.id);

      // Shield blocks any takeover
      if (conquest.shieldUntil && new Date(conquest.shieldUntil) > new Date()) {
        return { type: 'shielded', stateName: state.name };
      }

      // Castle defense absorbs the hit (siege)
      if ((conquest.castleLevel || 1) > 1) {
        conquest.castleLevel -= 1;
        await owner.save();
        return { type: 'damaged', stateName: state.name, castleLevel: conquest.castleLevel };
      }

      // Castle broken - state is captured
      owner.conqueredStates = owner.conqueredStates.filter(c => c.stateId !== state.id);
      await owner.save();
    }

    user.conqueredStates.push({
      stateId: state.id,
      castleLevel: 1,
      ownedSince: new Date(),
      shieldUntil: new Date(Date.now() + SHIELD_HOURS * 3600 * 1000),
      lastTributeAt: new Date(),
    });
    await user.save();
    return { type: 'captured', stateName: state.name, castleLevel: 1 };
  } catch (_) {
    return null;
  }
};

const extractAnswerOption = (ans) => {
  if (!ans) return null;
  if (typeof ans === 'string') return ans.trim();
  if (typeof ans === 'object') {
    if (ans.selectedOption != null) return String(ans.selectedOption).trim();
    if (ans.selectedAnswer != null) return String(ans.selectedAnswer).trim();
  }
  return null;
};

const updateSeenAndWrongQuestions = async (userId, questions, playerAnswers) => {
  if (!userId || userId === 'bot' || userId === 'bot_user_id' || userId.startsWith('guest_') || !questions || !Array.isArray(questions)) return;
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const questionIds = questions.map(q => q._id).filter(Boolean);
    const wrongIds = [];

    questions.forEach((q, idx) => {
      const ansObj = playerAnswers ? playerAnswers[idx] : null;
      const userOpt = extractAnswerOption(ansObj);
      const correctOpt = String(q.correctOption || '').trim();

      // If answered incorrectly or timed out with wrong/null answer
      if (ansObj && (!userOpt || userOpt.toLowerCase() !== correctOpt.toLowerCase())) {
        wrongIds.push(q._id);
      }
    });

    // Add seen questions (avoid duplicates)
    const existingSeen = new Set((user.seenQuestions || []).map(id => id.toString()));
    const newSeen = questionIds.filter(id => !existingSeen.has(id.toString()));
    if (newSeen.length > 0) {
      if (!user.seenQuestions) user.seenQuestions = [];
      user.seenQuestions.push(...newSeen);
    }

    // Limit seen questions list to the last 50 questions (FIFO sliding window)
    const MAX_SEEN_LIMIT = 50;
    if (user.seenQuestions && user.seenQuestions.length > MAX_SEEN_LIMIT) {
      user.seenQuestions = user.seenQuestions.slice(-MAX_SEEN_LIMIT);
    }

    // Update wrong questions: add new wrong ones, remove correctly answered ones
    const existingWrong = new Set((user.wrongQuestions || []).map(id => id.toString()));
    const wrongToAdd = wrongIds.filter(id => !existingWrong.has(id.toString()));
    const wrongToRemove = [];
    questions.forEach((q, idx) => {
      const ansObj = playerAnswers ? playerAnswers[idx] : null;
      const userOpt = extractAnswerOption(ansObj);
      const correctOpt = String(q.correctOption || '').trim();
      if (userOpt && userOpt.toLowerCase() === correctOpt.toLowerCase() && existingWrong.has(q._id.toString())) {
        wrongToRemove.push(q._id);
      }
    });

    if (wrongToAdd.length > 0) {
      if (!user.wrongQuestions) user.wrongQuestions = [];
      user.wrongQuestions.push(...wrongToAdd);
    }
    if (wrongToRemove.length > 0) {
      user.wrongQuestions = user.wrongQuestions.filter(
        id => !wrongToRemove.some(removeId => removeId.toString() === id.toString())
      );
    }

    await user.save();
  } catch (err) {
    console.error(`Failed to update seen/wrong questions for user ${userId}:`, err);
  }
};

const updateDailyProgress = async (userId, questionsAnswered = 5, isWin = false) => {
  if (!userId || userId === 'bot') return;
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    if (user.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (user.lastActiveDate !== yesterday && user.streak > 0) {
        if (user.streakFreeze > 0) user.streakFreeze -= 1;
        else user.streak = 0;
      }
      user.dailyQuestionsAnswered = 0;
      user.dailyWins = 0;
      user.dailyTiersClaimed = [];
      user.lastActiveDate = today;
    }

    const prevCount = user.dailyQuestionsAnswered || 0;
    user.dailyQuestionsAnswered = prevCount + (questionsAnswered || 5);
    if (isWin) user.dailyWins = (user.dailyWins || 0) + 1;

    const tiersClaimed = new Set(user.dailyTiersClaimed || []);
    let bonusCoins = 0;

    // Tier 1 (10 Qs): +50 Coins + 1 Streak Day
    if (user.dailyQuestionsAnswered >= 10 && !tiersClaimed.has(10)) {
      tiersClaimed.add(10);
      bonusCoins += 50;
      user.streak = (user.streak || 0) + 1;
    }

    // Tier 2 (25 Qs): +100 Coins
    if (user.dailyQuestionsAnswered >= 25 && !tiersClaimed.has(25)) {
      tiersClaimed.add(25);
      bonusCoins += 100;
    }

    // Tier 3 (50 Qs Stretch Goal): +200 Coins + 1 Streak Freeze (Max 2 capped)
    if (user.dailyQuestionsAnswered >= 50 && !tiersClaimed.has(50)) {
      tiersClaimed.add(50);
      bonusCoins += 200;
      if ((user.streakFreeze || 0) < 2) {
        user.streakFreeze = (user.streakFreeze || 0) + 1;
      }
    }

    user.dailyTiersClaimed = Array.from(tiersClaimed);
    user.coins = (user.coins || 0) + bonusCoins;

    await user.save();
  } catch (err) {
    console.error('Failed to update daily progress:', err);
  }
};

/**
 * Calculates true zero-inflation Elo delta using expected probability (FIDE/Glicko standard)
 * @param {number} ratingA - Player A current Elo
 * @param {number} ratingB - Opponent current Elo
 * @param {number} scoreA - 1 (Win), 0.5 (Draw), 0 (Loss)
 * @param {number} matchesA - Total matches played
 */
const calculateEloDelta = (ratingA = 1200, ratingB = 1200, scoreA = 1, matchesA = 0) => {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));

  // Dynamic K-factor: K=32 for beginners (<30 matches), K=16 for high-rated masters (>1800), K=24 standard
  let k = 24;
  if (matchesA < 30) k = 32;
  else if (ratingA >= 1800) k = 16;

  const delta = Math.round(k * (scoreA - expectedA));

  // Guaranteed minimal delta for decisive victories/defeats
  if (scoreA === 1 && delta <= 0) return 2;
  if (scoreA === 0 && delta >= 0) return -2;
  return delta;
};

const updatePlayerStats = async (userId, isWinner, isDraw, subject, correctAnswers, opponentRating = 1200) => {
  if (!userId || userId === 'bot' || userId === 'bot_user_id' || userId.startsWith('guest_')) {
    return { xpGained: 0, newLevel: 0, eloChange: 0 };
  }

  const winIncrement = isWinner ? 1 : 0;
  const scoreResult = isWinner ? 1 : (isDraw ? 0.5 : 0);

  // Knowledge XP: Base reward + 8 XP per correct answer + 30 for win
  const xpGained = (isWinner ? 30 : (isDraw ? 15 : 10)) + (correctAnswers * 8);
  const coinsGained = isWinner ? 40 : (isDraw ? 20 : 10);

  try {
    const user = await User.findById(userId);
    if (!user) return { xpGained: 0, newLevel: 0, eloChange: 0 };

    // Dynamic True Elo Rating calculation
    const eloChange = calculateEloDelta(user.eloRating || 1200, opponentRating || 1200, scoreResult, user.matches || 0);
    user.eloRating = Math.max(100, (user.eloRating || 1200) + eloChange);

    user.coins = (user.coins || 0) + coinsGained;

    if (!user.subjectXP) user.subjectXP = new Map();
    const currentXP = user.subjectXP.get(subject) || 0;
    const newXP = currentXP + xpGained;
    user.subjectXP.set(subject, newXP);

    user.matches = (user.matches || 0) + 1;
    user.wins = (user.wins || 0) + winIncrement;

    let maxXP = newXP;
    user.subjectXP.forEach((xp) => {
      if (xp > maxXP) maxXP = xp;
    });

    const calculateLevel = (xp) => Math.floor(Math.sqrt(xp / 100));
    const globalLevel = calculateLevel(maxXP);

    let newTitle = 'Novice';
    if (globalLevel >= 15) newTitle = 'Dheeth Legend';
    else if (globalLevel >= 10) newTitle = 'Master';
    else if (globalLevel >= 5) newTitle = 'Adept';

    user.title = newTitle;
    await user.save();

    return { xpGained, newTitle, newLevel: calculateLevel(newXP), eloChange };
  } catch (err) {
    console.error(`Failed to update stats for user ${userId}:`, err);
    return { xpGained: 0, newLevel: 0, eloChange: 0 };
  }
};

const initializeMatch = (roomId, subject, questions, p1, p2, isBotMatch, config = {}) => {
  const secondsPerQ = Number(config?.secondsPerQ) || 60;
  const match = {
    roomId,
    subject,
    questions,
    currentQuestionIndex: 0,
    isBotMatch,
    secondsPerQ,
    questionCount: questions.length,
    roundNumber: Number(config?.roundNumber) || 1,
    sessionRivalry: config?.sessionRivalry || null,
    waitingForHost: Boolean(config?.waitingForHost),
    mode: config?.mode || 'RANKED',
    timerTimeout: null,
    botAnswerTimeout: null,
    status: 'active',
    questionEndsAt: 0,
    questionStartedAt: 0,
    pendingEffects: {}, // effectId -> { type, sourceUserId, targetUserId, parryDeadlineAt, ... }
    players: {
      [p1.userId]: {
        socketId: p1.socketId,
        username: p1.username,
        userId: p1.userId,
        avatarSeed: p1.avatarSeed,
        title: p1.title || 'Novice',
        archetype: p1.archetype || null,
        targetState: p1.targetState,
        eloRating: p1.eloRating || 1200,
        score: 0,
        grossBaseScore: 0,
        answers: [],
        hasAnswered: false,
        correctAnswers: 0,
        currentStreak: 0,
        multiplier: 1,
        connected: true,
        activePowerupThisQuestion: null,
        powerupState: {
          slot: null,
          underdogGrants: 0,
          wrongStreakGrants: 0,
          momentumGrants: 0,
          successfulParries: 0
        }
      },
      [p2.userId]: {
        socketId: p2.socketId,
        username: p2.username,
        userId: p2.userId,
        avatarSeed: p2.avatarSeed,
        title: p2.title || 'Novice',
        archetype: p2.archetype || null,
        targetState: p2.targetState,
        eloRating: p2.eloRating || 1200,
        score: 0,
        grossBaseScore: 0,
        answers: [],
        hasAnswered: false,
        correctAnswers: 0,
        currentStreak: 0,
        multiplier: 1,
        connected: true,
        activePowerupThisQuestion: null,
        powerupState: {
          slot: null,
          underdogGrants: 0,
          wrongStreakGrants: 0,
          momentumGrants: 0,
          successfulParries: 0
        }
      }
    }
  };
  activeMatches[roomId] = match;
  if (p1.userId !== 'bot') activeMatchByUser[p1.userId] = roomId;
  if (p2.userId !== 'bot') activeMatchByUser[p2.userId] = roomId;
};

const startQuestionTimer = (io, roomId) => {
  const match = activeMatches[roomId];
  if (!match) return;

  const seconds = Number(match.secondsPerQ) || 60;
  match.questionStartedAt = Date.now();
  match.questionEndsAt = Date.now() + seconds * 1000;

  Object.values(match.players).forEach(p => {
    p.hasAnswered = false;
    p.activePowerupThisQuestion = null;
  });

  if (match.timerTimeout) clearTimeout(match.timerTimeout);
  if (match.botAnswerTimeout) clearTimeout(match.botAnswerTimeout);

  io.to(roomId).emit('timer_sync', { questionEndsAt: match.questionEndsAt, secondsPerQ: seconds });

  match.timerTimeout = setTimeout(() => {
    handleQuestionDeadline(io, roomId);
  }, seconds * 1000);

  if (match.isBotMatch) {
    const botPlayer = Object.values(match.players).find(p => p.userId === 'bot');
    const humanPlayer = Object.values(match.players).find(p => p.userId !== 'bot');
    if (botPlayer) {
      const currentQ = match.questions[match.currentQuestionIndex];
      const decision = botEngine.determineBotAction({
        question: currentQ,
        botPlayer,
        humanPlayer,
        roundIndex: match.currentQuestionIndex,
        totalRounds: match.questions.length,
        secondsPerQ: seconds
      });

      // Emit dynamic emote if triggered (Formula dread or archetype decision)
      const formulaEmote = botEmoteEngine.evaluateEvent('QUESTION_STARTED', match);
      const chosenEmote = decision.emote || (formulaEmote ? formulaEmote.emoji : null);
      if (chosenEmote) {
        setTimeout(() => {
          const currentMatch = activeMatches[roomId];
          if (currentMatch && currentMatch.status === 'active' && !currentMatch.players['bot']?.hasAnswered) {
            io.to(roomId).emit('receive_reaction', { emoji: chosenEmote, senderId: 'bot' });
          }
        }, Math.min(1200, Math.floor(decision.thinkingTime / 2)));
      }

      match.botAnswerTimeout = setTimeout(() => {
        const currentMatch = activeMatches[roomId];
        if (!currentMatch || currentMatch.status !== 'active') return;

        const bot = currentMatch.players['bot'];
        if (bot && !bot.hasAnswered) {
          bot.hasAnswered = true;

          const isCorrect = decision.isCorrect;
          const selectedOption = decision.selectedOption;
          const timeSpentMs = decision.thinkingTime;
          const timeSpentSec = timeSpentMs / 1000;
          const durationSec = currentMatch.secondsPerQ || 20;

          bot.answers = bot.answers || [];
          bot.correctAnswers = bot.correctAnswers || 0;
          bot.currentStreak = bot.currentStreak || 0;

          if (isCorrect) {
            bot.correctAnswers += 1;
            bot.currentStreak += 1;

            // Base 100 + Speed (max 25 with 2s grace) + Additive Streak (+10 / +20)
            const basePoints = 100;
            const decayWindow = Math.max(1, durationSec - 2);
            const speedFraction = Math.max(0, Math.min(1, (durationSec - Math.max(2, timeSpentSec)) / decayWindow));
            const speedBonus = Math.round(25 * speedFraction);
            const streakBonus = bot.currentStreak >= 5 ? 20 : (bot.currentStreak >= 3 ? 10 : 0);

            const isFinalRound = currentMatch.currentQuestionIndex === currentMatch.questions.length - 1;
            const roundMultiplier = isFinalRound ? 1.5 : 1;

            const rawScore = basePoints + speedBonus + streakBonus;
            const grossEarned = Math.round(rawScore * roundMultiplier);

            bot.answers[currentMatch.currentQuestionIndex] = {
              selectedOption,
              isCorrect: true,
              timeSpentMs,
              isTimeout: false
            };
            bot.grossBaseScore = (bot.grossBaseScore || 0) + rawScore;
            bot.score += grossEarned;
          } else {
            bot.currentStreak = 0;
            bot.answers[currentMatch.currentQuestionIndex] = {
              selectedOption,
              isCorrect: false,
              timeSpentMs,
              isTimeout: false
            };
            // 0 points on wrong answer (no negative match score)
          }

          io.to(roomId).emit('score_update', { players: currentMatch.players });

          const allAnswered = Object.values(currentMatch.players).every(p => p.hasAnswered);
          if (allAnswered) {
            clearTimeout(currentMatch.timerTimeout);
            if (currentMatch.botAnswerTimeout) clearTimeout(currentMatch.botAnswerTimeout);
            io.to(roomId).emit('reveal_answers', {
              players: currentMatch.players,
              questionIndex: currentMatch.currentQuestionIndex,
              correctOption: currentMatch.questions[currentMatch.currentQuestionIndex].correctOption
            });
            setTimeout(() => moveToNextQuestion(io, roomId), 3000);
          }
        }
      }, decision.thinkingTime);
    }
  }
};

const handleQuestionDeadline = (io, roomId) => {
  const match = activeMatches[roomId];
  if (!match || match.status !== 'active') return;

  const currentQ = match.questions[match.currentQuestionIndex];

  // Process timeouts for any player who didn't submit
  Object.values(match.players).forEach(p => {
    if (!p.hasAnswered) {
      p.hasAnswered = true;
      p.currentStreak = 0;
      // 0 points on timeout, resets streak

      p.answers = p.answers || [];
      p.answers[match.currentQuestionIndex] = {
        selectedOption: null,
        isCorrect: false,
        timeSpentMs: (match.secondsPerQ || 20) * 1000,
        isTimeout: true
      };

      if (p.userId && p.userId !== 'bot') {
        recordAttemptAndMistake({
          userId: p.userId,
          question: currentQ,
          isCorrect: false,
          selectedOption: null,
          timeSpentMs: (match.secondsPerQ || 20) * 1000,
          mode: match.mode || 'RANKED',
          matchId: roomId,
          usedPowerup: Boolean(p.activePowerupThisQuestion),
          powerupType: p.activePowerupThisQuestion
        });
      }
    }
  });

  io.to(roomId).emit('time_up');
  io.to(roomId).emit('reveal_answers', {
    players: match.players,
    questionIndex: match.currentQuestionIndex,
    correctOption: match.questions[match.currentQuestionIndex].correctOption
  });

  setTimeout(() => {
    moveToNextQuestion(io, roomId);
  }, 3000);
};

const moveToNextQuestion = (io, roomId) => {
  const match = activeMatches[roomId];
  if (!match) return;

  if (match.botAnswerTimeout) {
    clearTimeout(match.botAnswerTimeout);
    delete match.botAnswerTimeout;
  }
  if (match.timerTimeout) clearTimeout(match.timerTimeout);

  // Evaluate EMP Power-up grants for both players at end of round
  const powerupUpdates = evaluatePowerupGrants(match, match.currentQuestionIndex + 1);
  powerupUpdates.forEach(update => {
    const playerObj = match.players[update.userId];
    if (playerObj && playerObj.socketId) {
      io.to(playerObj.socketId).emit('powerup:charge_update', {
        reason: update.reason,
        slot: update.slot
      });
    }
  });

  match.currentQuestionIndex++;
  if (match.currentQuestionIndex >= match.questions.length) {
    match.status = 'finishing';
    clearMatchGraceTimers(roomId);

    const playersList = Object.values(match.players);
    const p1 = playersList[0];
    const p2 = playersList[1];

    const p1Id = p1 ? p1.userId : null;
    const p2Id = p2 ? p2.userId : null;

    const p1Score = p1 ? p1.score : 0;
    const p2Score = p2 ? p2.score : 0;

    let isDraw = p1Score === p2Score;
    let p1Wins = p1Score > p2Score;
    let p2Wins = p2Score > p1Score;

    if (isDraw) {
      // Tiebreaker 1: Total correct answers
      const p1Answers = p1?.correctAnswers || 0;
      const p2Answers = p2?.correctAnswers || 0;
      if (p1Answers > p2Answers) {
        p1Wins = true;
        isDraw = false;
      } else if (p2Answers > p1Answers) {
        p2Wins = true;
        isDraw = false;
      } else {
        // Tiebreaker 2: Speed on correct answers (faster total correct recall wins)
        const p1Time = (p1?.answers || []).filter(a => a.isCorrect).reduce((acc, a) => acc + (a.timeSpentMs || 0), 0);
        const p2Time = (p2?.answers || []).filter(a => a.isCorrect).reduce((acc, a) => acc + (a.timeSpentMs || 0), 0);
        if (p1Time > 0 && p2Time > 0) {
          if (p1Time < p2Time) {
            p1Wins = true;
            isDraw = false;
          } else if (p2Time < p1Time) {
            p2Wins = true;
            isDraw = false;
          }
        }
      }
    }

    const p1Rating = p1?.eloRating || 1200;
    const p2Rating = p2?.eloRating || 1200;

    // Session-based Rivalry (resets to 0-0 when leaving match arena to home)
    const sessionRivalry = match.sessionRivalry || { [p1Id || 'p1']: 0, [p2Id || 'p2']: 0 };
    if (p1Wins && p1Id) sessionRivalry[p1Id] = (sessionRivalry[p1Id] || 0) + 1;
    if (p2Wins && p2Id) sessionRivalry[p2Id] = (sessionRivalry[p2Id] || 0) + 1;

    const p1SessionWins = p1Id ? (sessionRivalry[p1Id] || 0) : 0;
    const p2SessionWins = p2Id ? (sessionRivalry[p2Id] || 0) : 0;
    const isDeciderGame = p1SessionWins === 1 && p2SessionWins === 1;

    // Perfect Recall Mastery check (100% accuracy)
    const p1Perfect = (p1?.correctAnswers || 0) === match.questions.length && match.questions.length > 0;
    const p2Perfect = (p2?.correctAnswers || 0) === match.questions.length && match.questions.length > 0;

    // Detect Swing Question: pivotal question where winner got it right and loser missed
    let swingIndex = -1;
    let maxSwing = -1;
    match.questions.forEach((q, idx) => {
      const a1 = p1?.answers?.[idx];
      const a2 = p2?.answers?.[idx];
      if (p1Wins && a1?.isCorrect && !a2?.isCorrect) {
        const val = a1.timeSpentMs || 1;
        if (val > maxSwing) { maxSwing = val; swingIndex = idx; }
      } else if (p2Wins && a2?.isCorrect && !a1?.isCorrect) {
        const val = a2.timeSpentMs || 1;
        if (val > maxSwing) { maxSwing = val; swingIndex = idx; }
      }
    });

    Promise.all([
      updateUserMatchCompletion(p1Id, {
        isWinner: p1Wins,
        isDraw,
        subject: match.subject,
        correctAnswers: p1?.correctAnswers || 0,
        opponentRating: p2Rating,
        questions: match.questions,
        playerAnswers: p1?.answers,
        questionCount: match.questions.length,
      }),
      updateUserMatchCompletion(p2Id, {
        isWinner: p2Wins,
        isDraw,
        subject: match.subject,
        correctAnswers: p2?.correctAnswers || 0,
        opponentRating: p1Rating,
        questions: match.questions,
        playerAnswers: p2?.answers,
        questionCount: match.questions.length,
      }),
    ]).then(async ([p1Stats, p2Stats]) => {
      console.log(`Stats updated for room. Match Over.`);

      // Update persistent DB Rivalry record if both are human players
      let rivalryRecord = null;
      if (p1 && p2 && p1Id && p2Id && p1Id !== 'bot' && p2Id !== 'bot') {
        try {
          rivalryRecord = await Rivalry.getOrCreateRivalry(p1Id, p2Id);
          rivalryRecord.totalDuels = (rivalryRecord.totalDuels || 0) + 1;
          rivalryRecord.lastPlayedAt = new Date();

          const isP1UserA = rivalryRecord.players[0]?.toString() === p1Id.toString();

          if (p1Wins) {
            if (isP1UserA) rivalryRecord.scoreA = (rivalryRecord.scoreA || 0) + 1;
            else rivalryRecord.scoreB = (rivalryRecord.scoreB || 0) + 1;

            if (rivalryRecord.currentStreak?.holderId?.toString() === p1Id.toString()) {
              rivalryRecord.currentStreak.count = (rivalryRecord.currentStreak.count || 0) + 1;
            } else {
              rivalryRecord.currentStreak = { holderId: p1Id, count: 1 };
            }
          } else if (p2Wins) {
            if (isP1UserA) rivalryRecord.scoreB = (rivalryRecord.scoreB || 0) + 1;
            else rivalryRecord.scoreA = (rivalryRecord.scoreA || 0) + 1;

            if (rivalryRecord.currentStreak?.holderId?.toString() === p2Id.toString()) {
              rivalryRecord.currentStreak.count = (rivalryRecord.currentStreak.count || 0) + 1;
            } else {
              rivalryRecord.currentStreak = { holderId: p2Id, count: 1 };
            }
          } else if (isDraw) {
            rivalryRecord.draws = (rivalryRecord.draws || 0) + 1;
          }
          await rivalryRecord.save();
        } catch (rErr) {
          console.error('Error updating rivalry:', rErr);
        }
      }

      // Conquer state for winners
      const p1Conquest = p1Wins ? await handleConquest(p1Id, p1?.targetState) : null;
      const p2Conquest = p2Wins ? await handleConquest(p2Id, p2?.targetState) : null;

      const extractSelectedOption = (ans) => {
        if (!ans) return null;
        if (typeof ans === 'string') return ans;
        if (typeof ans === 'object' && ans.selectedOption) return ans.selectedOption;
        return null;
      };

      const createSummary = (isPlayer1) => {
        const me = (isPlayer1 ? p1 : p2) || { score: 0, correctAnswers: 0, answers: [] };
        const opp = (isPlayer1 ? p2 : p1) || { score: 0, correctAnswers: 0, answers: [] };
        const meWins = isPlayer1 ? p1Wins : p2Wins;
        const meEloChange = isPlayer1 ? (p1Stats.eloChange || 0) : (p2Stats.eloChange || 0);
        const myStats = isPlayer1 ? p1Stats : p2Stats;
        const isPerfect = isPlayer1 ? p1Perfect : p2Perfect;

        const conquest = isPlayer1 ? p1Conquest : p2Conquest;
        return {
          winner: isDraw ? 'draw' : (meWins ? 'user' : 'opponent'),
          userStats: {
            score: me.score,
            correctAnswers: me.correctAnswers || 0,
            eloChange: meEloChange,
            xpGained: myStats.xpGained || 0,
            isPerfectRecall: isPerfect
          },
          conquest,
          botStats: { score: opp.score, correctAnswers: opp.correctAnswers || 0 },
          rivalry: {
            myWins: isPlayer1 ? p1SessionWins : p2SessionWins,
            opponentWins: isPlayer1 ? p2SessionWins : p1SessionWins,
            totalDuels: (p1SessionWins + p2SessionWins),
            isDecider: isDeciderGame,
            roundNumber: match.roundNumber || 1,
            streak: rivalryRecord ? rivalryRecord.currentStreak : null,
          },
          roundNumber: match.roundNumber || 1,
          questionsReview: match.questions.map((q, idx) => ({
            questionId: q._id,
            questionText: q.questionText,
            options: q.options,
            correctOption: q.correctOption,
            explanation: q.explanation,
            hasDiagram: q.hasDiagram,
            diagramUrl: q.diagramUrl,
            isSwingQuestion: idx === swingIndex,
            userSelectedOption: extractSelectedOption(me.answers ? me.answers[idx] : null),
            opponentSelectedOption: extractSelectedOption(opp.answers ? opp.answers[idx] : null)
          }))
        };
      };

      if (p1 && p1.userId && p1.userId !== 'bot' && p1.socketId) {
        io.to(p1.socketId).emit('match_over', createSummary(true));
        delete activeMatchByUser[p1.userId];
      }
      if (p2 && p2.userId && p2.userId !== 'bot' && p2.socketId) {
        io.to(p2.socketId).emit('match_over', createSummary(false));
        delete activeMatchByUser[p2.userId];
      }

      // Bot post-match GG / respect reaction
      if (match.isBotMatch) {
        const botScore = (p1.userId === 'bot' ? p1.score : p2.score) || 0;
        const humanScore = (p1.userId !== 'bot' ? p1.score : p2.score) || 0;
        const humanWon = humanScore > botScore;
        const isDraw = humanScore === botScore;
        const ggIntent = botEmoteEngine.evaluateEvent('MATCH_ENDED', match, { humanWon, isDraw });
        if (ggIntent) {
          setTimeout(() => {
            io.to(roomId).emit('receive_reaction', { emoji: ggIntent.emoji, senderId: 'bot' });
          }, ggIntent.delayMs);
        }
      }

      // Save session rivalry to rematch state before deleting
      rematchState[roomId] = {
        subject: match.subject || 'General',
        p1: p1 ? { socketId: p1.socketId || '', username: p1.username || '', userId: p1.userId || '', avatarSeed: p1.avatarSeed || '', targetState: p1.targetState || null } : null,
        p2: p2 ? { socketId: p2.socketId || '', username: p2.username || '', userId: p2.userId || '', avatarSeed: p2.avatarSeed || '', targetState: p2.targetState || null } : null,
        isBotMatch: Boolean(match.isBotMatch),
        secondsPerQ: match.secondsPerQ || 20,
        questionCount: match.questionCount || 5,
        roundNumber: (match.roundNumber || 1) + 1,
        sessionRivalry,
        rivalryRecord,
        requests: {}
      };

      Duel.updateOne({ roomId }, { status: 'completed' }).catch(() => { });
      delete activeMatches[roomId];
    }).catch(err => {
      console.error(`[Match] Error finalizing ${roomId}:`, err);
      if (p1 && p1.userId) delete activeMatchByUser[p1.userId];
      if (p2 && p2.userId) delete activeMatchByUser[p2.userId];
      Duel.updateOne({ roomId }, { status: 'completed' }).catch(() => { });
      delete activeMatches[roomId];
    });
  } else {
    io.to(roomId).emit('next_question', { questionIndex: match.currentQuestionIndex, questionEndsAt: match.questionEndsAt });
    startQuestionTimer(io, roomId);
  }
};

const finishMatchForfeit = (io, roomId, loserId, winnerId) => {
  const match = activeMatches[roomId];
  if (!match || match.status !== 'active') return;

  match.status = 'finishing';
  clearMatchGraceTimers(roomId);
  if (match.timerTimeout) clearTimeout(match.timerTimeout);
  if (match.botAnswerTimeout) clearTimeout(match.botAnswerTimeout);
  if (match.standbyTimeout) clearTimeout(match.standbyTimeout);

  io.to(roomId).emit('opponent_disconnected', {
    message: 'Opponent fled the arena. You win by forfeit!'
  });

  const remainingPlayer = match.players ? match.players[winnerId] : null;
  const loserPlayer = match.players ? match.players[loserId] : null;

  const winnerRating = remainingPlayer?.eloRating || 1200;
  const loserRating = loserPlayer?.eloRating || 1200;

  Promise.all([
    loserId && loserId !== 'bot'
      ? updateUserMatchCompletion(loserId, {
        isWinner: false,
        isDraw: false,
        subject: match.subject,
        correctAnswers: 0,
        opponentRating: winnerRating,
        questionCount: 5,
      })
      : Promise.resolve({ xpGained: 0, newLevel: 0, eloChange: 0 }),
    winnerId && winnerId !== 'bot'
      ? updateUserMatchCompletion(winnerId, {
        isWinner: true,
        isDraw: false,
        subject: match.subject,
        correctAnswers: remainingPlayer?.correctAnswers || 0,
        opponentRating: loserRating,
        questionCount: 5,
      })
      : Promise.resolve({ xpGained: 0, newLevel: 0, eloChange: 0 })
  ]).then(() => console.log(`[Match] Stats updated after forfeit for room ${roomId}`))
    .catch(err => console.error('[Match] Forfeit stats error:', err));

  if (loserId) delete activeMatchByUser[loserId];
  if (winnerId) delete activeMatchByUser[winnerId];
  Duel.updateOne({ roomId }, { status: 'completed' }).catch(() => { });
  delete activeMatches[roomId];
};

const finishMatchAbandoned = (io, roomId) => {
  const match = activeMatches[roomId];
  if (!match || match.status !== 'active') return;

  match.status = 'abandoned';
  clearMatchGraceTimers(roomId);
  if (match.timerTimeout) clearTimeout(match.timerTimeout);
  if (match.botAnswerTimeout) clearTimeout(match.botAnswerTimeout);
  if (match.standbyTimeout) clearTimeout(match.standbyTimeout);

  io.to(roomId).emit('match_abandoned', {
    message: 'Both players disconnected. Match cancelled.'
  });

  Object.keys(match.players || {}).forEach(uid => {
    if (uid && uid !== 'bot') delete activeMatchByUser[uid];
  });
  Duel.updateOne({ roomId }, { status: 'completed' }).catch(() => { });
  delete activeMatches[roomId];
};

const setupGameplaySockets = (io, socket) => {
  socket.on('match:sync', (ack) => {
    const userId = socket.user?.id || socket.user?.userId;
    if (!userId) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized' });
      return;
    }

    const roomId = activeMatchByUser[userId];
    if (!roomId) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No active match' });
      return;
    }

    const match = activeMatches[roomId];
    if (!match || match.status !== 'active') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Match not active' });
      return;
    }

    const player = match.players[userId];
    if (!player) return;

    const timerKey = `${roomId}:${userId}`;
    if (disconnectGraceTimers.has(timerKey)) {
      clearTimeout(disconnectGraceTimers.get(timerKey));
      disconnectGraceTimers.delete(timerKey);
    }

    // Disconnect stale socket if exists
    if (player.socketId && player.socketId !== socket.id) {
      const oldSocket = io.sockets.sockets.get(player.socketId);
      if (oldSocket) oldSocket.disconnect(true);
    }

    player.socketId = socket.id;
    player.connected = true;
    socket.join(roomId);
    socket.activeRoomId = roomId;

    io.to(roomId).emit('player:connection', { userId, connected: true });

    // If duel was waiting for host, and host is now joining:
    if (match.waitingForHost) {
      if (match.standbyTimeout) {
        clearTimeout(match.standbyTimeout);
        match.standbyTimeout = null;
      }
      match.waitingForHost = false;

      Duel.updateOne({ roomId }, { status: 'live' }).catch(() => { });

      io.to(roomId).emit('duel:both_connected', {
        roomId,
        message: 'Both contenders ready! Commencing match!',
      });

      // Synchronously launch question timer
      setTimeout(() => startQuestionTimer(io, roomId), 3500);
    }

    if (typeof ack === 'function') {
      ack({
        ok: true,
        matchId: roomId,
        currentQuestionIndex: match.currentQuestionIndex,
        questionEndsAt: match.questionEndsAt,
        players: match.players,
        subject: match.subject,
        questions: match.questions,
        waitingForHost: Boolean(match.waitingForHost),
        matchPhase: match.waitingForHost ? 'waiting_host' : 'intro',
        myPowerupSlot: player.powerupState?.slot || null
      });
    }
  });

  socket.on('submit_answer', (data) => {
    const userId = socket.user?.id || socket.user?.userId;
    const { roomId, selectedOption } = data;
    const match = activeMatches[roomId];
    if (!match || match.status !== 'active') return;

    const player = match.players[userId];
    if (player && !player.hasAnswered) {
      player.hasAnswered = true;

      const currentQ = match.questions[match.currentQuestionIndex];
      const timeSpentMs = Math.max(0, Date.now() - match.questionStartedAt);
      const timeSpentSec = timeSpentMs / 1000;
      const durationSec = match.secondsPerQ || 20;
      const isCorrect = String(selectedOption || '').trim().toLowerCase() === String(currentQ.correctOption || '').trim().toLowerCase();

      player.answers = player.answers || [];
      player.answers[match.currentQuestionIndex] = {
        selectedOption,
        isCorrect,
        timeSpentMs,
        isTimeout: false
      };

      let scoreGained = 0;
      let scoreBreakdown = { base: 0, speed: 0, streak: 0, isFinalRound: false, multiplier: 1, total: 0 };

      if (isCorrect) {
        player.correctAnswers = (player.correctAnswers || 0) + 1;
        player.currentStreak = (player.currentStreak || 0) + 1;

        // 1. Accuracy Base Points (+100)
        const basePoints = 100;

        // 2. Speed Bonus with 2-second grace period (Max +25)
        const decayWindow = Math.max(1, durationSec - 2);
        const speedFraction = Math.max(0, Math.min(1, (durationSec - Math.max(2, timeSpentSec)) / decayWindow));
        const speedBonus = Math.round(25 * speedFraction);

        // 3. Additive Streak Bonus (+0 for 1-2, +10 for 3-4, +20 for 5+)
        const streakBonus = player.currentStreak >= 5 ? 20 : (player.currentStreak >= 3 ? 10 : 0);

        // 4. Final Round (1.5x clutch multiplier)
        const isFinalRound = match.currentQuestionIndex === match.questions.length - 1;
        const roundMultiplier = isFinalRound ? 1.5 : 1;

        const rawQuestionScore = basePoints + speedBonus + streakBonus;
        scoreGained = Math.round(rawQuestionScore * roundMultiplier);

        player.grossBaseScore = (player.grossBaseScore || 0) + rawQuestionScore;
        player.score += scoreGained;

        scoreBreakdown = {
          base: basePoints,
          speed: speedBonus,
          streak: streakBonus,
          isFinalRound,
          multiplier: roundMultiplier,
          total: scoreGained
        };
      } else {
        // Wrong answer: 0 points (no negative match score), reset streak
        player.currentStreak = 0;
        scoreBreakdown = { base: 0, speed: 0, streak: 0, isFinalRound: false, multiplier: 1, total: 0 };
      }

      // Record attempt and mistake telemetry
      recordAttemptAndMistake({
        userId,
        question: currentQ,
        isCorrect,
        selectedOption,
        timeSpentMs,
        mode: match.mode || 'RANKED',
        matchId: roomId,
        usedPowerup: Boolean(player.activePowerupThisQuestion),
        powerupType: player.activePowerupThisQuestion
      });

      socket.emit('answer_result', {
        isCorrect,
        selectedOption,
        correctOption: currentQ.correctOption,
        scoreGained,
        breakdown: scoreBreakdown
      });
      io.to(roomId).emit('score_update', { players: match.players });

      // Bot psychological reactions to human answer and streaks
      if (match.isBotMatch) {
        const shockIntent = botEmoteEngine.evaluateEvent('HUMAN_ANSWERED', match, { isCorrect, timeSpentMs });
        if (shockIntent) {
          setTimeout(() => {
            const cur = activeMatches[roomId];
            if (cur && cur.status === 'active' && cur.currentQuestionIndex === match.currentQuestionIndex) {
              io.to(roomId).emit('receive_reaction', { emoji: shockIntent.emoji, senderId: 'bot' });
            }
          }, shockIntent.delayMs);
        } else if (player.currentStreak >= 3) {
          const streakIntent = botEmoteEngine.evaluateEvent('STREAK_MILESTONE', match, { streak: player.currentStreak, playerId: userId });
          if (streakIntent) {
            setTimeout(() => {
              const cur = activeMatches[roomId];
              if (cur && cur.status === 'active' && cur.currentQuestionIndex === match.currentQuestionIndex) {
                io.to(roomId).emit('receive_reaction', { emoji: streakIntent.emoji, senderId: 'bot' });
              }
            }, streakIntent.delayMs);
          }
        }
      }

      const allAnswered = Object.values(match.players).every(p => p.hasAnswered);
      if (allAnswered) {
        clearTimeout(match.timerTimeout);
        if (match.botAnswerTimeout) clearTimeout(match.botAnswerTimeout);
        io.to(roomId).emit('reveal_answers', {
          players: match.players,
          questionIndex: match.currentQuestionIndex,
          correctOption: match.questions[match.currentQuestionIndex].correctOption
        });

        // Clutch pressure check at round close
        if (match.isBotMatch) {
          const clutchIntent = botEmoteEngine.evaluateEvent('SCORE_UPDATED', match);
          if (clutchIntent) {
            setTimeout(() => {
              const cur = activeMatches[roomId];
              if (cur && cur.status === 'active') {
                io.to(roomId).emit('receive_reaction', { emoji: clutchIntent.emoji, senderId: 'bot' });
              }
            }, clutchIntent.delayMs);
          }
        }

        setTimeout(() => moveToNextQuestion(io, roomId), 3000);
      }
    }
  });

  // Power-up Activation
  socket.on('powerup:activate', (data, ack) => {
    const userId = socket.user?.id || socket.user?.userId;
    const { roomId, powerupInstanceId } = data || {};
    const match = activeMatches[roomId];
    if (!match || match.status !== 'active') {
      if (typeof ack === 'function') ack({ ok: false, message: 'Match not active' });
      return;
    }

    const player = match.players[userId];
    if (!player) {
      if (typeof ack === 'function') ack({ ok: false, message: 'Player not in match' });
      return;
    }

    if (player.hasAnswered) {
      if (typeof ack === 'function') ack({ ok: false, message: 'Already answered this question' });
      return;
    }

    const slot = player.powerupState?.slot;
    if (!slot || slot.status !== 'READY' || (powerupInstanceId && slot.instanceId !== powerupInstanceId)) {
      if (typeof ack === 'function') ack({ ok: false, message: 'Power-up not ready' });
      return;
    }

    slot.status = 'CONSUMED';
    player.activePowerupThisQuestion = slot.type;
    const cardType = slot.type;
    player.powerupState.slot = null;

    // Acknowledge card consumption to sender
    if (typeof ack === 'function') ack({ ok: true, type: cardType });
    socket.emit('powerup:charge_update', { reason: 'CONSUMED', slot: null });

    const currentQ = match.questions[match.currentQuestionIndex];
    const opponent = Object.values(match.players).find(p => p.userId !== userId);

    if (cardType === 'EMP') {
      const eliminated = applyEmp(currentQ, match.roomId, match.currentQuestionIndex);
      socket.emit('powerup:effect_applied', {
        type: 'EMP',
        phase: 'ACTIVE',
        sourceUserId: userId,
        targetUserId: userId,
        eliminatedOptionIds: eliminated
      });
    }
  });

  socket.on('request_rematch', async (data) => {
    const { roomId } = data;
    const state = rematchState[roomId];
    if (!state) return;

    const userId = (socket.user?.id || socket.user?.userId || '').toString();
    const username = socket.user?.username || 'Opponent';

    state.requests[socket.id] = { userId, username };
    io.to(roomId).emit('rematch_status', {
      acceptedCount: Object.keys(state.requests).length,
      requestedByUserIds: Object.values(state.requests).map(r => r.userId),
      lastRequesterUsername: username
    });

    if (state.isBotMatch) {
      if (!state.botTimeout) {
        state.botTimeout = setTimeout(async () => {
          const qCount = state.questionCount || 5;
          let questions = await Question.aggregate([{ $match: { subject: state.subject } }, { $sample: { size: qCount } }]);
          if (questions.length === 0) {
            const cat = state.mode === 'gs' ? 'gs' : 'tech';
            questions = await Question.aggregate([{ $match: { category: cat } }, { $sample: { size: qCount } }]);
          }
          const pId = socket.user.id || socket.user.userId;
          const dbUser = await User.findById(pId);
          const pAvatar = dbUser?.equippedAvatar || socket.user.avatarSeed || 'default-seed';
          const botOpp = state.p2.userId === 'bot' ? state.p2 : state.p1;
          const newRoomId = `room_${Date.now()}`;

          socket.leave(roomId);
          socket.join(newRoomId);
          socket.activeRoomId = newRoomId;

          const matchPayload = {
            roomId: newRoomId, subject: state.subject, questions, isBotMatch: true,
            secondsPerQ: state.secondsPerQ || 20,
            roundNumber: state.roundNumber || 2,
            player: { id: pId, username: socket.user.username, avatarSeed: pAvatar },
            opponent: {
              id: "bot",
              username: botOpp.username,
              avatarSeed: botOpp.avatarSeed || "bot-ronin",
              title: botOpp.title || "Novice",
              eloRating: botOpp.eloRating || 1200,
              archetype: botOpp.archetype || null,
              isBot: true
            }
          };

          socket.emit('rematch_accepted', matchPayload);
          initializeMatch(newRoomId, state.subject, questions,
            { socketId: socket.id, username: socket.user.username, userId: pId, avatarSeed: pAvatar, targetState: socket.user.targetState, eloRating: socket.user.eloRating || 1200 },
            { socketId: "bot_socket_id", username: botOpp.username, userId: "bot", avatarSeed: botOpp.avatarSeed || "bot-ronin", title: botOpp.title, eloRating: botOpp.eloRating, archetype: botOpp.archetype },
            true,
            { secondsPerQ: state.secondsPerQ, roundNumber: state.roundNumber, sessionRivalry: state.sessionRivalry, mode: state.mode });
          setTimeout(() => startQuestionTimer(io, newRoomId), 3500);

          delete rematchState[roomId];
        }, Math.random() * 2000 + 1500);
      }
    } else {
      if (Object.keys(state.requests).length === 2) {
        const qCount = state.questionCount || 5;
        let questions = await Question.aggregate([{ $match: { subject: state.subject } }, { $sample: { size: qCount } }]);
        if (questions.length === 0) {
          const cat = state.mode === 'gs' ? 'gs' : 'tech';
          questions = await Question.aggregate([{ $match: { category: cat } }, { $sample: { size: qCount } }]);
        }
        const newRoomId = `room_${Date.now()}`;

        if (state.p1.socketId && io.sockets.sockets.get(state.p1.socketId)) {
          const s1 = io.sockets.sockets.get(state.p1.socketId);
          s1.leave(roomId);
          s1.join(newRoomId);
          s1.activeRoomId = newRoomId;
        }
        if (state.p2.socketId && io.sockets.sockets.get(state.p2.socketId)) {
          const s2 = io.sockets.sockets.get(state.p2.socketId);
          s2.leave(roomId);
          s2.join(newRoomId);
          s2.activeRoomId = newRoomId;
        }

        const p1WinsCount = state.rivalryRecord ? (state.rivalryRecord.players[0]?.toString() === state.p1.userId.toString() ? state.rivalryRecord.scoreA : state.rivalryRecord.scoreB) : 0;
        const p2WinsCount = state.rivalryRecord ? (state.rivalryRecord.players[1]?.toString() === state.p2.userId.toString() ? state.rivalryRecord.scoreB : state.rivalryRecord.scoreA) : 0;

        const p1Payload = {
          roomId: newRoomId, subject: state.subject, questions, isBotMatch: false,
          secondsPerQ: state.secondsPerQ || 20,
          roundNumber: state.roundNumber || 2,
          isDuel: true,
          rivalry: state.rivalryRecord ? {
            scoreHost: p1WinsCount,
            scoreGuest: p2WinsCount,
            totalDuels: state.rivalryRecord.totalDuels,
            streak: state.rivalryRecord.currentStreak,
          } : null,
          player: { id: state.p1.userId, username: state.p1.username, avatarSeed: state.p1.avatarSeed },
          opponent: { id: state.p2.userId, username: state.p2.username, avatarSeed: state.p2.avatarSeed }
        };
        const p2Payload = {
          roomId: newRoomId, subject: state.subject, questions, isBotMatch: false,
          secondsPerQ: state.secondsPerQ || 20,
          roundNumber: state.roundNumber || 2,
          isDuel: true,
          rivalry: state.rivalryRecord ? {
            scoreHost: p2WinsCount,
            scoreGuest: p1WinsCount,
            totalDuels: state.rivalryRecord.totalDuels,
            streak: state.rivalryRecord.currentStreak,
          } : null,
          player: { id: state.p2.userId, username: state.p2.username, avatarSeed: state.p2.avatarSeed },
          opponent: { id: state.p1.userId, username: state.p1.username, avatarSeed: state.p1.avatarSeed }
        };

        io.to(state.p1.socketId).emit('rematch_accepted', p1Payload);
        io.to(state.p2.socketId).emit('rematch_accepted', p2Payload);

        initializeMatch(newRoomId, state.subject, questions, state.p1, state.p2, false, { secondsPerQ: state.secondsPerQ, roundNumber: state.roundNumber, sessionRivalry: state.sessionRivalry });
        setTimeout(() => startQuestionTimer(io, newRoomId), 3500);

        delete rematchState[roomId];
      }
    }
  });

  socket.on('send_reaction', (data) => {
    const { roomId, emoji } = data || {};
    if (!roomId || !emoji) return;

    const match = activeMatches[roomId];
    const currentRound = match ? (match.currentQuestionIndex || 0) : 0;
    const limitKey = `${roomId}:${socket.id}`;
    const limitResult = emoteRateLimiter.consume(limitKey, currentRound);
    if (!limitResult.allowed) return;

    socket.to(roomId).emit('receive_reaction', { emoji, senderId: socket.user?.userId || socket.id });
  });

  socket.on('disconnect', () => {
    const userId = socket.user?.id || socket.user?.userId;
    if (!userId) return;

    const roomId = activeMatchByUser[userId];
    if (!roomId) return;

    const match = activeMatches[roomId];
    if (!match || match.status !== 'active') return;

    const player = match.players[userId];
    if (!player || player.socketId !== socket.id) return;

    player.connected = false;
    io.to(roomId).emit('player:connection', { userId, connected: false });

    const timerKey = `${roomId}:${userId}`;
    if (disconnectGraceTimers.has(timerKey)) {
      clearTimeout(disconnectGraceTimers.get(timerKey));
      disconnectGraceTimers.delete(timerKey);
    }

    const timer = setTimeout(() => {
      disconnectGraceTimers.delete(timerKey);
      if (!activeMatches[roomId] || activeMatches[roomId].status !== 'active') return;

      const opponent = Object.values(match.players).find(p => p.userId !== userId);
      const oppTimerKey = opponent ? `${roomId}:${opponent.userId}` : null;
      const oppHasGraceTimer = oppTimerKey ? disconnectGraceTimers.has(oppTimerKey) : false;

      if (!opponent || (!opponent.connected && oppHasGraceTimer)) {
        finishMatchAbandoned(io, roomId);
      } else {
        finishMatchForfeit(io, roomId, userId, opponent.userId);
      }
    }, GRACE_PERIOD_MS);

    disconnectGraceTimers.set(timerKey, timer);
  });
};

const getMatchByRoomId = (roomId) => activeMatches[roomId] || null;

module.exports = { initializeMatch, startQuestionTimer, setupGameplaySockets, activeMatches, getMatchByRoomId };

