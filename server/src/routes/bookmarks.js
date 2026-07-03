const express = require('express');
const router = express.Router();
const SavedQuestion = require('../models/SavedQuestion');
const verifyToken = require('../middleware/auth');

router.post('/', verifyToken, async (req, res) => {
  try {
    const { questionId, questionText, options, correctOption, explanation, subject } = req.body;
    
    if (questionId) {
      const existing = await SavedQuestion.findOne({ userId: req.user.id, questionId });
      if (existing) {
        return res.status(200).json({ message: 'Already saved', savedQuestion: existing });
      }
    }

    const savedQuestion = new SavedQuestion({
      userId: req.user.id,
      questionId,
      questionText,
      options,
      correctOption,
      explanation,
      subject
    });

    await savedQuestion.save();
    res.status(201).json({ message: 'Question saved', savedQuestion });
  } catch (err) {
    console.error('Bookmark Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const bookmarks = await SavedQuestion.find({ userId: req.user.id }).sort({ savedAt: -1 });
    res.json(bookmarks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await SavedQuestion.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Bookmark removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
