const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  eloRating: {
    type: Number,
    default: 1200,
  },
  matches: {
    type: Number,
    default: 0,
  },
  wins: {
    type: Number,
    default: 0,
  },
  avatarSeed: {
    type: String,
    default: 'default-seed',
  },
  bio: {
    type: String,
    default: 'Aspiring Civil Engineer',
  },
  title: {
    type: String,
    default: 'Novice',
  },
  subjectXP: {
    type: Map,
    of: Number,
    default: {},
  },
  seenQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  wrongQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  journeyProgress: {
    type: Map,
    of: new mongoose.Schema({
      nodeId: String,
      status: { type: String, enum: ['locked', 'available', 'completed'], default: 'locked' },
      bestScore: { type: Number, default: 0 },
      completedAt: Date
    }, { _id: false }),
    default: {}
  },
  coins: { type: Number, default: 0 },
  dailyQuestionsAnswered: { type: Number, default: 0 },
  dailyWins: { type: Number, default: 0 },
  dailyGoal: { type: Number, default: 50 },
  lastActiveDate: { type: String, default: '' },
  streak: { type: Number, default: 0 },
  streakFreeze: { type: Number, default: 0 },
  ownedItems: [{ type: String }],
  equippedAvatar: { type: String, default: 'default-seed' },
  conqueredStates: [{
    stateId: { type: String },
    castleLevel: { type: Number, default: 1 },
    ownedSince: { type: Date, default: Date.now },
    shieldUntil: { type: Date, default: null },
    lastTributeAt: { type: Date, default: Date.now },
    lastMaintainedAt: { type: Date, default: Date.now },
  }],
  siegeCooldowns: [{
    stateId: String,
    expiresAt: Date,
  }],
  friends: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    status: { type: String, enum: ['pending', 'pending_sent', 'pending_received', 'accepted'], default: 'pending' }
  }],
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
