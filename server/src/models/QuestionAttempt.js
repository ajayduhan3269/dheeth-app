const mongoose = require('mongoose');
const { Schema } = mongoose;

const questionAttemptSchema = new Schema(
  {
    attemptId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    matchId: { type: String, default: null },
    mode: {
      type: String,
      enum: ['FRIEND_DUEL', 'RANKED', 'BOT', 'DRILL', 'REDEEM', 'GS', 'TECH', 'gs', 'tech', 'duel', 'DUEL'],
      default: 'RANKED',
      required: true
    },
    subject: { type: String, required: true, index: true },
    topic: { type: String, default: 'General' },
    correct: { type: Boolean, required: true },
    selectedAnswer: { type: Schema.Types.Mixed, default: null },
    correctAnswer: { type: Schema.Types.Mixed, required: true },
    timeSpentMs: { type: Number, required: true },
    usedPowerup: { type: Boolean, default: false },
    powerupType: { type: String, default: null },
    answeredAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

questionAttemptSchema.index({ userId: 1, subject: 1, topic: 1, answeredAt: -1 });

module.exports = mongoose.model('QuestionAttempt', questionAttemptSchema);
