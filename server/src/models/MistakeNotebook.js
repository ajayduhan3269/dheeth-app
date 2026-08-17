const mongoose = require('mongoose');
const { Schema } = mongoose;

const occurrenceSchema = new Schema(
  {
    attemptId: { type: String, required: true },
    matchId: { type: String, default: null },
    mode: { 
      type: String, 
      enum: ['FRIEND_DUEL', 'RANKED', 'BOT', 'DRILL', 'REDEEM', 'GS', 'TECH', 'gs', 'tech', 'duel', 'DUEL'], 
      default: 'RANKED',
      required: true 
    },
    selectedAnswer: { type: Schema.Types.Mixed, default: null },
    correctAnswer: { type: Schema.Types.Mixed, required: true },
    timeSpentMs: { type: Number, required: true, min: 0 },
    occurredAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const mistakeNotebookSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    exam: { type: String, default: 'GATE', trim: true },
    subject: { type: String, required: true, trim: true },
    topic: { type: String, default: 'General', trim: true },
    subtopic: { type: String, default: null, trim: true },
    level: { type: Number, enum: [1, 2, 3], default: 1, required: true },
    active: { type: Boolean, default: true, required: true },
    firstMissedAt: { type: Date, default: Date.now },
    lastMissedAt: { type: Date, default: Date.now },
    lastReviewedAt: { type: Date, default: null },
    lastCorrectAt: { type: Date, default: null },
    level2AchievedAt: { type: Date, default: null },
    masteredAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: Date.now },
    wrongCount: { type: Number, default: 1, min: 0 },
    drillCorrectCount: { type: Number, default: 0, min: 0 },
    totalReviewCount: { type: Number, default: 0, min: 0 },
    lastSelectedAnswer: { type: Schema.Types.Mixed, default: null },
    correctAnswerSnapshot: { type: Schema.Types.Mixed, required: true },
    lastTimeSpentMs: { type: Number, default: 0, min: 0 },
    occurrences: { type: [occurrenceSchema], default: [] },
    revisionReason: {
      type: String,
      enum: ['RECENT_MISS', 'FAILED_REVIEW', 'MASTERED'],
      default: 'RECENT_MISS'
    }
  },
  { timestamps: true }
);

// Indexes for high-speed queue and summary queries
mistakeNotebookSchema.index(
  { userId: 1, questionId: 1 },
  { unique: true, name: 'uniq_user_question' }
);
mistakeNotebookSchema.index(
  { userId: 1, active: 1, nextReviewAt: 1, level: 1 },
  { name: 'drill_due_queue' }
);
mistakeNotebookSchema.index(
  { userId: 1, subject: 1, active: 1, level: 1 },
  { name: 'subject_summary' }
);
mistakeNotebookSchema.index(
  { userId: 1, subject: 1, topic: 1, lastMissedAt: -1 },
  { name: 'weakness_breakdown' }
);

module.exports = mongoose.model('MistakeNotebook', mistakeNotebookSchema);
