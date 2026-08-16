const mongoose = require('mongoose');

const DuelSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true,
    minlength: 6,
    maxlength: 6,
    trim: true,
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  hostUsername: {
    type: String,
    required: true,
  },
  hostAvatar: {
    type: String,
    default: 'default-seed',
  },
  hostTitle: {
    type: String,
    default: 'Challenger',
  },
  guestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  guestUsername: {
    type: String,
    default: null,
  },
  guestAvatar: {
    type: String,
    default: null,
  },
  guestTitle: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'live', 'completed', 'expired', 'cancelled'],
    default: 'pending',
    index: true,
  },
  config: {
    subject: {
      type: String,
      default: 'Fluid Mechanics',
    },
    questionCount: {
      type: Number,
      default: 5,
      min: 5,
      max: 20,
    },
    secondsPerQ: {
      type: Number,
      default: 20,
      min: 10,
      max: 60,
    },
  },
  roomId: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
}, { timestamps: true });

// Partial index: code is unique while active
DuelSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'accepted', 'live'] } },
  }
);

// TTL index to automatically remove expired pending duel invites after 24 hours
DuelSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { status: 'pending' },
  }
);

module.exports = mongoose.model('Duel', DuelSchema);
