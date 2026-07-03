const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyToken = require('../middleware/auth');

// Bulk upload route for questions (auth-protected)
router.post('/bulk-upload', verifyToken, adminController.bulkUploadQuestions);

module.exports = router;
