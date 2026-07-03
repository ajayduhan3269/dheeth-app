const express = require('express');
const router = express.Router();
const journeyController = require('../controllers/journeyController');
const verifyToken = require('../middleware/auth');

router.get('/subjects', verifyToken, journeyController.getJourneySubjects);
router.get('/progress', verifyToken, journeyController.getJourneyProgress);
router.post('/complete', verifyToken, journeyController.completeNode);

module.exports = router;