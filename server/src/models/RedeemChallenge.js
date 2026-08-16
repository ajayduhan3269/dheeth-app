const mongoose = require('mongoose');
const { Schema } = mongoose;

const redeemChallengeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    challengeId: { type: String, required: true, unique: true, index: true },
    questions: [
      {
        questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
        answered: { type: Boolean, default: false },
        correct: { type: Boolean, default: false },
        selectedAnswer: { type: Schema.Types.Mixed, default: null }
      }
    ],
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED'],
      default: 'ACTIVE'
    },
    rewardsClaimed: { type: Boolean, default: false },
    xpAwarded: { type: Number, default: 0 },
    shieldAwarded: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RedeemChallenge', redeemChallengeSchema);
