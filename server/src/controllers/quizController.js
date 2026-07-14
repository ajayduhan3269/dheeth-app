const Question = require('../models/Question');
const User = require('../models/User');

exports.getRandomQuestions = async (req, res) => {
  try {
    const { topic, category } = req.query;
    
    const matchStage = {};
    if (topic) {
      matchStage.topic = { $regex: new RegExp(`^${topic}$`, 'i') };
    }
    if (category) {
      matchStage.category = category;
    }

    const selectedQuestions = await Question.aggregate([
      { $match: matchStage },
      { $sample: { size: 5 } }
    ]);

    res.status(200).json({
      success: true,
      count: selectedQuestions.length,
      data: selectedQuestions
    });
  } catch (error) {
    console.error('Error fetching random questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questions from database.',
      error: error.message
    });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const subjects = await Question.distinct('subject', filter);
    res.status(200).json({
      success: true,
      data: subjects
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subjects from database.',
      error: error.message
    });
  }
};

exports.getSoloPracticeQuestions = async (req, res) => {
  try {
    const { topic, category, subject, nodeIndex } = req.query;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ── Journey mode: deterministic batch by subject + nodeIndex ──
    if (subject && nodeIndex !== undefined) {
      const batchSize = 10;
      const idx = parseInt(nodeIndex, 10);
      const skip = idx * batchSize;

      // Fetch a deterministic, ordered batch so each node always serves the same questions
      const questions = await Question.find({ subject })
        .sort({ _id: 1 })
        .skip(skip)
        .limit(batchSize)
        .lean();

      return res.status(200).json({
        success: true,
        count: questions.length,
        data: questions
      });
    }

    // ── Legacy topic-based random mode (for non-journey callers) ──
    const matchStage = {};
    if (topic) matchStage.topic = { $regex: new RegExp(`^${topic}$`, 'i') };
    if (category) matchStage.category = category;

    const wrongIds = user.wrongQuestions || [];

    // Prioritize wrong questions first
    let questions = [];
    if (wrongIds.length > 0) {
      const wrongMatch = { ...matchStage, _id: { $in: wrongIds } };
      questions = await Question.aggregate([
        { $match: wrongMatch },
        { $sample: { size: 5 } }
      ]);
    }

    // Fill remaining slots with unseen questions
    if (questions.length < 5) {
      const seenIds = user.seenQuestions || [];
      const remainingFilter = {
        ...matchStage,
        _id: {
          $nin: [...new Set([...seenIds.map(id => id.toString()), ...questions.map(q => q._id.toString())])]
        }
      };
      const additional = await Question.aggregate([
        { $match: remainingFilter },
        { $sample: { size: 5 - questions.length } }
      ]);
      questions = [...questions, ...additional];
    }

    // Stage 3: Fill remaining slots with general pool questions (seen or unseen), excluding already selected
    if (questions.length < 5) {
      const selectedIds = questions.map(q => q._id);
      const remainingFilter = {
        ...matchStage,
        _id: { $nin: selectedIds }
      };
      const additional = await Question.aggregate([
        { $match: remainingFilter },
        { $sample: { size: 5 - questions.length } }
      ]);
      questions = [...questions, ...additional];
    }

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (error) {
    console.error('Error fetching solo practice questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch practice questions.',
      error: error.message
    });
  }
};

