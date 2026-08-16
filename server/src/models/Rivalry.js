const mongoose = require('mongoose');

const RivalrySchema = new mongoose.Schema({
  pairKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  scoreA: {
    type: Number,
    default: 0,
  },
  scoreB: {
    type: Number,
    default: 0,
  },
  draws: {
    type: Number,
    default: 0,
  },
  totalDuels: {
    type: Number,
    default: 0,
  },
  currentStreak: {
    holderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  lastPlayedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Helper to generate normalized pairKey and find or create rivalry record
RivalrySchema.statics.getOrCreateRivalry = async function(userAId, userBId) {
  const strA = userAId.toString();
  const strB = userBId.toString();
  const sorted = [strA, strB].sort();
  const pairKey = `${sorted[0]}:${sorted[1]}`;

  let rivalry = await this.findOne({ pairKey });
  if (!rivalry) {
    rivalry = await this.create({
      pairKey,
      players: [sorted[0], sorted[1]],
      scoreA: 0,
      scoreB: 0,
      draws: 0,
      totalDuels: 0,
      currentStreak: { holderId: null, count: 0 },
      lastPlayedAt: new Date(),
    });
  }
  return rivalry;
};

module.exports = mongoose.model('Rivalry', RivalrySchema);
