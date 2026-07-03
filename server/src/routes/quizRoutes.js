const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

// Get random questions for quiz flow
router.get('/random', quizController.getRandomQuestions);

// Get all available subjects
router.get('/subjects', quizController.getSubjects);

// Get solo practice questions (prioritizes wrongQuestions, filters seenQuestions)
router.get('/solo-practice', require('../middleware/auth'), quizController.getSoloPracticeQuestions);

module.exports = router;
