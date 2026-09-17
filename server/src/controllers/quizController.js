const Question = require('../models/Question');
const User = require('../models/User');
const {
  buildStreamFilter,
  normalizeStream,
  FALLBACK_SUBJECTS,
} = require('../config/streams');

exports.getRandomQuestions = async (req, res) => {
  try {
    const { topic, category, stream: rawStream, subject } = req.query;
    const stream = normalizeStream(rawStream);

    const extra = {};
    if (topic) {
      extra.topic = { $regex: new RegExp(`^${topic}$`, 'i') };
    }

    const matchStage = buildStreamFilter(stream, {
      category: stream === 'civil' ? category : undefined,
      subject,
      extra,
    });

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
    const { stream: rawStream, category } = req.query;
    const stream = normalizeStream(rawStream);

    const filter = buildStreamFilter(stream, {
      category: stream === 'civil' ? category : undefined,
    });

    let subjects = await Question.distinct('subject', filter);

    // If stream is not civil and subjects are empty or sparse, supplement with fallback subjects
    const fallback = FALLBACK_SUBJECTS[stream] || [];
    if (fallback.length > 0) {
      const existingLower = new Set(subjects.map(s => s.toLowerCase()));
      for (const f of fallback) {
        if (!existingLower.has(f.subject.toLowerCase())) {
          subjects.push(f.subject);
        }
      }
    }

    res.status(200).json({
      success: true,
      data: subjects,
      stream,
      category: category || null,
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
    const { topic, category, subject, nodeIndex, stream: rawStream } = req.query;
    const stream = normalizeStream(rawStream);
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

      const extra = {};
      if (req.query.topic) {
        extra.topic = req.query.topic;
      }

      const query = buildStreamFilter(stream, {
        subject,
        category: stream === 'civil' ? category : undefined,
        extra,
      });

      const questions = await Question.find(query)
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

    // ── Standard solo practice mode ──
    const extra = {};
    if (topic) extra.topic = { $regex: new RegExp(`^${topic}$`, 'i') };

    const matchStage = buildStreamFilter(stream, {
      category: stream === 'civil' ? category : undefined,
      subject,
      extra,
    });

    const wrongIds = user.wrongQuestions || [];

    // Prioritize wrong questions first
    let questions = [];
    if (wrongIds.length > 0) {
      const wrongMatch = { $and: [matchStage, { _id: { $in: wrongIds } }] };
      questions = await Question.aggregate([
        { $match: wrongMatch },
        { $sample: { size: 5 } }
      ]);
    }

    // Fill remaining slots with unseen questions
    if (questions.length < 5) {
      const seenIds = user.seenQuestions || [];
      const remainingFilter = {
        $and: [
          matchStage,
          {
            _id: {
              $nin: [...new Set([...seenIds.map(id => id.toString()), ...questions.map(q => q._id.toString())])]
            }
          }
        ]
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
        $and: [
          matchStage,
          { _id: { $nin: selectedIds } }
        ]
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
