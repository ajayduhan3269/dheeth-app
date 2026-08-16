const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MistakeNotebook = require('../models/MistakeNotebook');
const QuestionAttempt = require('../models/QuestionAttempt');
const Question = require('../models/Question');
const RedeemChallenge = require('../models/RedeemChallenge');
const User = require('../models/User');

const verifyToken = require('../middleware/auth');

// Auth middleware helper
const requireAuth = (req, res, next) => {
  verifyToken(req, res, () => {
    req.userId = req.user.id || req.user.userId || req.user._id;
    next();
  });
};

/**
 * GET /api/mistakes/summary
 * Returns overall mastery %, level counts, subject breakdown, and topic telemetry
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const now = new Date();

    const [notebookItems, attempts] = await Promise.all([
      MistakeNotebook.find({ userId }).lean(),
      QuestionAttempt.find({ userId }).lean()
    ]);

    let uniqueMistakes = notebookItems.length;
    let active = 0;
    let critical = 0; // Level 1
    let review = 0;   // Level 2
    let mastered = 0; // Level 3
    let dueNow = 0;

    const subjectsMap = {};
    const topicsMap = {};

    notebookItems.forEach(item => {
      if (item.active) active++;
      if (item.level === 1) critical++;
      else if (item.level === 2) review++;
      else if (item.level === 3) mastered++;

      if (item.active && item.nextReviewAt && new Date(item.nextReviewAt) <= now) {
        dueNow++;
      }

      // Subject summary
      const sub = item.subject || 'General';
      if (!subjectsMap[sub]) {
        subjectsMap[sub] = { subject: sub, active: 0, critical: 0, review: 0, mastered: 0, total: 0 };
      }
      subjectsMap[sub].total++;
      if (item.active) subjectsMap[sub].active++;
      if (item.level === 1) subjectsMap[sub].critical++;
      else if (item.level === 2) subjectsMap[sub].review++;
      else if (item.level === 3) subjectsMap[sub].mastered++;

      // Topic breakdown
      const topKey = `${sub}:::${item.topic || 'General'}`;
      if (!topicsMap[topKey]) {
        topicsMap[topKey] = { subject: sub, topic: item.topic || 'General', activeMistakes: 0 };
      }
      if (item.active) topicsMap[topKey].activeMistakes++;
    });

    // Accuracy from attempts
    const attemptsByTopic = {};
    const attemptsBySubject = {};
    attempts.forEach(att => {
      const s = att.subject || 'General';
      const t = `${s}:::${att.topic || 'General'}`;

      if (!attemptsBySubject[s]) attemptsBySubject[s] = { total: 0, correct: 0 };
      attemptsBySubject[s].total++;
      if (att.correct) attemptsBySubject[s].correct++;

      if (!attemptsByTopic[t]) attemptsByTopic[t] = { total: 0, correct: 0 };
      attemptsByTopic[t].total++;
      if (att.correct) attemptsByTopic[t].correct++;
    });

    const subjects = Object.values(subjectsMap).map(s => {
      const att = attemptsBySubject[s.subject] || { total: 0, correct: 0 };
      const attPct = att.total > 0 ? Math.round((att.correct / att.total) * 100) : 100;
      const masteryPct = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 100;
      return {
        ...s,
        attemptAccuracyPercent: attPct,
        masteryPercent: masteryPct
      };
    });

    const topics = Object.entries(topicsMap).map(([k, val]) => {
      const att = attemptsByTopic[k] || { total: 0, correct: 0 };
      const acc = att.total > 0 ? Math.round((att.correct / att.total) * 100) : 0;
      return {
        subject: val.subject,
        topic: val.topic,
        attempts: att.total,
        correct: att.correct,
        accuracyPercent: acc,
        activeMistakes: val.activeMistakes
      };
    });

    const masteryPercent = uniqueMistakes > 0 ? Math.round((mastered / uniqueMistakes) * 100) : 100;

    res.json({
      ok: true,
      totals: {
        uniqueMistakes,
        active,
        critical,
        review,
        mastered,
        dueNow,
        masteryPercent
      },
      subjects,
      topics
    });
  } catch (err) {
    console.error('Error in /api/mistakes/summary:', err);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

/**
 * GET /api/mistakes/drill
 * Returns prioritized due review questions (without revealing answers)
 */
router.get('/drill', requireAuth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { subject, limit = 10 } = req.query;
    const now = new Date();

    const query = {
      userId,
      active: true,
      nextReviewAt: { $lte: now }
    };
    if (subject) query.subject = subject;

    let items = await MistakeNotebook.find(query)
      .populate('questionId')
      .sort({ level: 1, wrongCount: -1, lastMissedAt: -1 })
      .limit(Number(limit))
      .lean();

    // If not enough due, fetch any active mistakes
    if (items.length < Number(limit)) {
      const remainingLimit = Number(limit) - items.length;
      const existingIds = items.map(i => i.questionId?._id);
      const fallbackQuery = {
        userId,
        active: true,
        questionId: { $nin: existingIds }
      };
      if (subject) fallbackQuery.subject = subject;

      const fallbackItems = await MistakeNotebook.find(fallbackQuery)
        .populate('questionId')
        .sort({ level: 1, wrongCount: -1 })
        .limit(remainingLimit)
        .lean();

      items = [...items, ...fallbackItems];
    }

    const drillQuestions = items
      .filter(i => i.questionId)
      .map(item => {
        const q = item.questionId;
        return {
          notebookId: item._id,
          questionId: q._id,
          subject: item.subject,
          topic: item.topic,
          level: item.level,
          wrongCount: item.wrongCount,
          lastSelectedAnswer: item.lastSelectedAnswer,
          questionText: q.questionText,
          options: q.options,
          hasDiagram: q.hasDiagram,
          diagramUrl: q.diagramUrl
        };
      });

    res.json({
      ok: true,
      questions: drillQuestions
    });
  } catch (err) {
    console.error('Error in /api/mistakes/drill:', err);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

/**
 * POST /api/mistakes/resolve
 * Grades a drill answer and updates the Leitner spaced repetition level
 */
router.post('/resolve', requireAuth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { questionId, selectedAnswer, timeSpentMs = 0 } = req.body;

    if (!questionId || !selectedAnswer) {
      return res.status(400).json({ ok: false, error: 'Missing questionId or selectedAnswer' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ ok: false, error: 'Question not found' });
    }

    const isCorrect = selectedAnswer.toString().trim().toLowerCase() === question.correctOption.toString().trim().toLowerCase();
    const now = new Date();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;

    let notebook = await MistakeNotebook.findOne({ userId, questionId });
    if (!notebook) {
      notebook = new MistakeNotebook({
        userId,
        questionId,
        exam: 'GATE',
        subject: question.subject || 'General',
        topic: question.topic || 'General',
        level: 1,
        active: true,
        correctAnswerSnapshot: question.correctOption,
        firstMissedAt: now,
        lastMissedAt: now
      });
    }

    const fromLevel = notebook.level;
    let toLevel = fromLevel;
    let nextReviewAt = now;

    if (isCorrect) {
      notebook.drillCorrectCount = (notebook.drillCorrectCount || 0) + 1;
      notebook.totalReviewCount = (notebook.totalReviewCount || 0) + 1;
      notebook.lastCorrectAt = now;

      if (fromLevel === 1) {
        toLevel = 2;
        notebook.level = 2;
        notebook.level2AchievedAt = now;
        nextReviewAt = new Date(now.getTime() + fortyEightHoursMs);
        notebook.nextReviewAt = nextReviewAt;
        notebook.active = true;
      } else if (fromLevel === 2) {
        // Level 2 -> Level 3 promotion only if 48 hours have elapsed since Level 2 achieved
        const achievedAt = notebook.level2AchievedAt ? new Date(notebook.level2AchievedAt).getTime() : 0;
        if (now.getTime() - achievedAt >= fortyEightHoursMs) {
          toLevel = 3;
          notebook.level = 3;
          notebook.active = false;
          notebook.masteredAt = now;
          notebook.revisionReason = 'MASTERED';
          nextReviewAt = null;
          notebook.nextReviewAt = null;
        } else {
          // Maintained Level 2
          toLevel = 2;
          nextReviewAt = new Date(achievedAt + fortyEightHoursMs);
          notebook.nextReviewAt = nextReviewAt;
        }
      }
    } else {
      // Wrong in review -> reset to Level 1
      toLevel = 1;
      notebook.level = 1;
      notebook.active = true;
      notebook.wrongCount = (notebook.wrongCount || 0) + 1;
      notebook.lastMissedAt = now;
      notebook.nextReviewAt = now;
      notebook.level2AchievedAt = null;
      notebook.masteredAt = null;
      notebook.revisionReason = 'FAILED_REVIEW';
    }

    notebook.lastReviewedAt = now;
    notebook.lastSelectedAnswer = selectedAnswer;
    notebook.lastTimeSpentMs = timeSpentMs;

    await notebook.save();

    // Record immutable attempt
    const attemptId = `drill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await QuestionAttempt.create({
      attemptId,
      userId,
      questionId,
      mode: 'DRILL',
      subject: question.subject || 'General',
      topic: question.topic || 'General',
      correct: isCorrect,
      selectedAnswer,
      correctAnswer: question.correctOption,
      timeSpentMs,
      answeredAt: now
    });

    res.json({
      ok: true,
      correct: isCorrect,
      transition: {
        fromLevel,
        toLevel,
        active: notebook.active,
        nextReviewAt
      },
      solution: {
        correctOption: question.correctOption,
        explanation: question.explanation,
        questionText: question.questionText,
        options: question.options,
        hasDiagram: question.hasDiagram,
        diagramUrl: question.diagramUrl
      }
    });
  } catch (err) {
    console.error('Error in /api/mistakes/resolve:', err);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

/**
 * POST /api/mistakes/redeem/start
 * Starts a 3-question daily redeem challenge
 */
router.post('/redeem/start', requireAuth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const now = new Date();

    // Check active challenge
    const existing = await RedeemChallenge.findOne({
      userId,
      status: 'ACTIVE',
      expiresAt: { $gt: now }
    }).populate('questions.questionId');

    if (existing) {
      return res.json({
        ok: true,
        challengeId: existing.challengeId,
        questions: existing.questions.map(q => ({
          questionId: q.questionId?._id,
          questionText: q.questionId?.questionText,
          options: q.questionId?.options,
          hasDiagram: q.questionId?.hasDiagram,
          diagramUrl: q.questionId?.diagramUrl,
          answered: q.answered
        }))
      });
    }

    // Pick 3 active mistakes (or sample general questions if fewer than 3)
    let mistakes = await MistakeNotebook.find({ userId, active: true })
      .populate('questionId')
      .sort({ wrongCount: -1, level: 1 })
      .limit(3)
      .lean();

    let questionDocs = mistakes.map(m => m.questionId).filter(Boolean);

    if (questionDocs.length < 3) {
      const remainingCount = 3 - questionDocs.length;
      const existingIds = questionDocs.map(q => q._id);
      const extraQuestions = await Question.aggregate([
        { $match: { _id: { $nin: existingIds } } },
        { $sample: { size: remainingCount } }
      ]);
      questionDocs = [...questionDocs, ...extraQuestions];
    }

    const challengeId = `red_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min window

    const challenge = await RedeemChallenge.create({
      userId,
      challengeId,
      questions: questionDocs.map(q => ({
        questionId: q._id,
        answered: false,
        correct: false
      })),
      status: 'ACTIVE',
      expiresAt
    });

    res.json({
      ok: true,
      challengeId,
      questions: questionDocs.map(q => ({
        questionId: q._id,
        questionText: q.questionText,
        options: q.options,
        hasDiagram: q.hasDiagram,
        diagramUrl: q.diagramUrl,
        answered: false
      }))
    });
  } catch (err) {
    console.error('Error in /api/mistakes/redeem/start:', err);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

/**
 * POST /api/mistakes/redeem/:challengeId/answer
 * Submits an answer in a Redeem Challenge
 */
router.post('/redeem/:challengeId/answer', requireAuth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { challengeId } = req.params;
    const { questionId, selectedAnswer } = req.body;

    const challenge = await RedeemChallenge.findOne({ userId, challengeId, status: 'ACTIVE' });
    if (!challenge) {
      return res.status(404).json({ ok: false, error: 'Active challenge not found' });
    }

    const qItem = challenge.questions.find(q => q.questionId.toString() === questionId.toString());
    if (!qItem) {
      return res.status(400).json({ ok: false, error: 'Question not part of this challenge' });
    }

    const question = await Question.findById(questionId);
    const isCorrect = selectedAnswer.toString().trim().toLowerCase() === question.correctOption.toString().trim().toLowerCase();

    qItem.answered = true;
    qItem.correct = isCorrect;
    qItem.selectedAnswer = selectedAnswer;

    // Check if challenge is completed
    const allAnswered = challenge.questions.every(q => q.answered);
    let rewardIssued = false;

    if (allAnswered) {
      const allCorrect = challenge.questions.every(q => q.correct);
      if (allCorrect) {
        challenge.status = 'COMPLETED';
        challenge.rewardsClaimed = true;
        challenge.xpAwarded = 75;
        challenge.shieldAwarded = true;
        rewardIssued = true;

        // Reward user
        const user = await User.findById(userId);
        if (user) {
          user.xp = (user.xp || 0) + 75;
          user.coins = (user.coins || 0) + 50;
          await user.save();
        }
      } else {
        challenge.status = 'FAILED';
      }
    }

    await challenge.save();

    res.json({
      ok: true,
      correct: isCorrect,
      allAnswered,
      status: challenge.status,
      rewardIssued,
      solution: {
        correctOption: question.correctOption,
        explanation: question.explanation
      }
    });
  } catch (err) {
    console.error('Error in /api/mistakes/redeem/:challengeId/answer:', err);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
