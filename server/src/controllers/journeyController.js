const User = require('../models/User');
const Question = require('../models/Question');

// Icon lookup — add new subjects here as you seed them
const SUBJECT_ICONS = {
  'Fluid Mechanics': '💧',
  'Building Materials': '🧱',
  'Highway Engineering': '🛣️',
  'Irrigation Engineering': '🌾',
  'Environmental Engineering': '🌿',
  'Soil Mechanics': '🪨',
  'Structural Analysis': '🏗️',
  'General Studies': '🌍',
  'Ancient History': '🏺',
  'Medieval History': '🏰',
  'Modern History': '📜',
  'Biology': '🧬',
  'Polity': '🏛️',
  'World Core & Climate': '🌏',
  'Indian Geography & Resources': '🗺️',
};

const BATCH_SIZE = 10; // questions per journey node

exports.getJourneySubjects = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};

    // Get only subjects that actually have questions in the DB
    const subjectNames = await Question.distinct('subject', filter);

    // For each subject, count questions and auto-generate nodes
    const subjects = await Promise.all(
      subjectNames.map(async (subject) => {
        if (category === 'gs') {
          const chaptersData = await Question.aggregate([
            { $match: { subject, category: 'gs' } },
            { $group: { _id: "$topic", count: { $sum: 1 }, minId: { $min: "$_id" } } },
            { $sort: { minId: 1 } }
          ]);

          let totalQuestionsForSubject = 0;
          const chapters = chaptersData.map((chap) => {
            const chapterName = chap._id || 'General';
            const totalQuestions = chap.count;
            totalQuestionsForSubject += totalQuestions;
            const nodeCount = Math.ceil(totalQuestions / BATCH_SIZE);

            const nodes = [];
            for (let i = 0; i < nodeCount; i++) {
              const isLast = i === nodeCount - 1;
              const questionsInNode = isLast ? totalQuestions - i * BATCH_SIZE : BATCH_SIZE;
              nodes.push({
                nodeId: `${subject.toLowerCase().replace(/\s+/g, '_')}_${chapterName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_level_${i + 1}`,
                title: `Level ${i + 1}`,
                chapterName,
                nodeIndex: i,
                coins: i < 5 ? 50 : i < 15 ? 75 : 100,
                questionsRequired: questionsInNode,
                passScore: 70,
              });
            }
            return { chapterName, totalQuestions, nodes };
          });

          return {
            subject,
            category: 'gs',
            icon: SUBJECT_ICONS[subject] || '📖',
            totalQuestions: totalQuestionsForSubject,
            chapters
          };
        } else {
          const totalQuestions = await Question.countDocuments({ ...filter, subject });
          const nodeCount = Math.ceil(totalQuestions / BATCH_SIZE);

          const nodes = [];
          for (let i = 0; i < nodeCount; i++) {
            const isLast = i === nodeCount - 1;
            const questionsInNode = isLast ? totalQuestions - i * BATCH_SIZE : BATCH_SIZE;
            nodes.push({
              nodeId: `${subject.toLowerCase().replace(/\s+/g, '_')}_level_${i + 1}`,
              title: `Level ${i + 1}`,
              nodeIndex: i,
              coins: i < 5 ? 50 : i < 15 ? 75 : 100, // escalating rewards
              questionsRequired: questionsInNode,
              passScore: 70,
            });
          }

          return {
            subject,
            category: category || 'tech',
            icon: SUBJECT_ICONS[subject] || '📖',
            totalQuestions,
            nodes,
          };
        }
      })
    );

    // Sort alphabetically for consistency
    subjects.sort((a, b) => a.subject.localeCompare(b.subject));

    res.json({ success: true, data: subjects });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getJourneyProgress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const progress = {};
    if (user.journeyProgress) {
      user.journeyProgress.forEach((value, key) => {
        progress[key] = value;
      });
    }

    res.json({ success: true, data: { progress, coins: user.coins || 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.completeNode = async (req, res) => {
  try {
    const { subject, nodeId, score, totalQuestions, answers } = req.body;
    if (!subject || !nodeId || score === undefined) {
      return res.status(400).json({ success: false, message: 'subject, nodeId, and score are required' });
    }

    // Determine category to regenerate nodes correctly
    const sampleQuestion = await Question.findOne({ subject });
    if (!sampleQuestion) {
      return res.status(404).json({ success: false, message: 'Subject not found or has no questions' });
    }
    const category = sampleQuestion.category || 'tech';

    let nodes = [];
    if (category === 'gs') {
      const chaptersData = await Question.aggregate([
        { $match: { subject, category: 'gs' } },
        { $group: { _id: "$topic", count: { $sum: 1 }, minId: { $min: "$_id" } } },
        { $sort: { minId: 1 } }
      ]);
      chaptersData.forEach((chap) => {
        const chapterName = chap._id || 'General';
        const qCount = chap.count;
        const nodeCount = Math.ceil(qCount / BATCH_SIZE);
        for (let i = 0; i < nodeCount; i++) {
          const isLast = i === nodeCount - 1;
          const questionsInNode = isLast ? qCount - i * BATCH_SIZE : BATCH_SIZE;
          nodes.push({
            nodeId: `${subject.toLowerCase().replace(/\s+/g, '_')}_${chapterName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_level_${i + 1}`,
            nodeIndex: i,
            coins: i < 5 ? 50 : i < 15 ? 75 : 100,
            questionsRequired: questionsInNode,
            passScore: 70,
          });
        }
      });
    } else {
      const questionCount = await Question.countDocuments({ subject });
      const nodeCount = Math.ceil(questionCount / BATCH_SIZE);
      for (let i = 0; i < nodeCount; i++) {
        const isLast = i === nodeCount - 1;
        const questionsInNode = isLast ? questionCount - i * BATCH_SIZE : BATCH_SIZE;
        nodes.push({
          nodeId: `${subject.toLowerCase().replace(/\s+/g, '_')}_level_${i + 1}`,
          nodeIndex: i,
          coins: i < 5 ? 50 : i < 15 ? 75 : 100,
          questionsRequired: questionsInNode,
          passScore: 70,
        });
      }
    }

    const node = nodes.find(n => n.nodeId === nodeId);
    if (!node) return res.status(404).json({ success: false, message: 'Node not found' });

    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const passed = percentage >= node.passScore;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.journeyProgress) user.journeyProgress = new Map();

    const existingProgress = user.journeyProgress.get(nodeId) || { status: 'available', bestScore: 0 };
    const currentBest = existingProgress.bestScore || 0;
    const wasCompleted = existingProgress.status === 'completed';
    let coinsAwarded = 0;

    if (passed) {
      user.journeyProgress.set(nodeId, {
        nodeId,
        status: 'completed',
        bestScore: Math.max(percentage, currentBest),
        completedAt: existingProgress.completedAt || new Date()
      });

      // Unlock next node
      const nodeIndex = nodes.findIndex(n => n.nodeId === nodeId);
      if (nodeIndex >= 0 && nodeIndex < nodes.length - 1) {
        const nextNodeId = nodes[nodeIndex + 1].nodeId;
        const nextProgress = user.journeyProgress.get(nextNodeId);
        if (!nextProgress || nextProgress.status === 'locked') {
          user.journeyProgress.set(nextNodeId, { nodeId: nextNodeId, status: 'available', bestScore: nextProgress?.bestScore || 0 });
        }
      }

      // Award coins only on first completion
      if (!wasCompleted) {
        coinsAwarded = node.coins;
        user.coins = (user.coins || 0) + node.coins;
      }
    } else if (percentage > currentBest) {
      user.journeyProgress.set(nodeId, { nodeId, status: 'available', bestScore: percentage });
    }

    // Process seen and wrong questions for spaced repetition
    if (answers && Array.isArray(answers)) {
      if (!user.seenQuestions) user.seenQuestions = [];
      if (!user.wrongQuestions) user.wrongQuestions = [];

      answers.forEach(ans => {
        if (!ans.questionId) return;
        const qIdStr = ans.questionId.toString();
        
        // Add to seen if not already there
        if (!user.seenQuestions.some(id => id.toString() === qIdStr)) {
          user.seenQuestions.push(ans.questionId);
        }
      });

      // Limit seen questions list to the last 50 questions (FIFO sliding window)
      const MAX_SEEN_LIMIT = 50;
      if (user.seenQuestions.length > MAX_SEEN_LIMIT) {
        user.seenQuestions = user.seenQuestions.slice(-MAX_SEEN_LIMIT);
      }

      answers.forEach(ans => {
        if (!ans.questionId) return;
        const qIdStr = ans.questionId.toString();

        // Handle wrong/right for spaced repetition
        const isWrongListIdx = user.wrongQuestions.findIndex(id => id.toString() === qIdStr);
        if (ans.isCorrect) {
          // Remove from wrong list if they got it right!
          if (isWrongListIdx !== -1) {
            user.wrongQuestions.splice(isWrongListIdx, 1);
          }
        } else {
          // Add to wrong list if not already there
          if (isWrongListIdx === -1) {
            user.wrongQuestions.push(ans.questionId);
          }
        }
      });
    }

    await user.save();

    const progressObj = {};
    user.journeyProgress.forEach((value, key) => {
      progressObj[key] = value;
    });

    res.json({
      success: true,
      data: {
        passed,
        percentage,
        coinsAwarded,
        totalCoins: user.coins,
        progress: progressObj
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};