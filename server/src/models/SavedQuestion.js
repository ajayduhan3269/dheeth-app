const mongoose = require('mongoose');

const savedQuestionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOption: { type: String, required: true },
  explanation: { type: String },
  subject: { type: String, required: true },
  savedAt: { type: Date, default: Date.now }
});

savedQuestionSchema.index({ userId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('SavedQuestion', savedQuestionSchema);
