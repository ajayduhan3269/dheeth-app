const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');

process.on('uncaughtException', (err) => {
  const errMsg = `[${new Date().toISOString()}] UNCAUGHT EXCEPTION:\n${err.stack || err}\n`;
  try { fs.appendFileSync('crash.log', errMsg); } catch (_) {}
  console.error('UNCAUGHT EXCEPTION (Server kept alive):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  const errMsg = `[${new Date().toISOString()}] UNHANDLED REJECTION:\n${reason?.stack || reason}\n`;
  try { fs.appendFileSync('crash.log', errMsg); } catch (_) {}
  console.error('UNHANDLED REJECTION (Server kept alive):', reason);
});

const adminRoutes = require('./routes/adminRoutes');
const quizRoutes = require('./routes/quizRoutes');
const authRoutes = require('./routes/auth');
const { handleMatchmaking } = require('./socket/matchmaking');
const { setupGameplaySockets } = require('./socket/gameplay');
const { setupGroupQuiz } = require('./socket/groupQuiz');
const socketAuthMiddleware = require('./socket/authMiddleware');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();
const server = http.createServer(app);

// CORS configuration for Socket.io and Express
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Initialize global map to track connected users
global.connectedUsers = new Map();

io.use(socketAuthMiddleware);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/questions', quizRoutes);
app.use('/api/user', require('./routes/user'));
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/bookmarks', require('./routes/bookmarks'));
app.use('/api/journey', require('./routes/journey'));
app.use('/api/daily', require('./routes/dailyProgress'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/map', require('./routes/mapGame'));
app.use('/api/duel', require('./routes/duel'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/mistakes', require('./routes/mistakes'));
app.use('/share', require('./routes/share'));
app.use('/d', require('./routes/share'));

// Health check endpoint for fast frontend probe and cold-start detection
app.get('/api/health', (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  res.json({
    ok: true,
    status: 'online',
    db: isDbReady ? 'connected' : 'connecting',
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
  });
});

// Basic route to test the server
app.get('/', (req, res) => {
  res.json({ message: 'Server is running successfully with Socket.io!' });
});

// Database Connection Setup
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL;

if (!MONGO_URI) {
  console.error('CRITICAL ERROR: MONGODB_URI or MONGODB_URL is missing in .env file.');
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
})
  .then(() => console.log('MongoDB Connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

const { startDecayCron } = require('./cron/castleDecayCron');

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);
  
  // Track the user globally upon connection with normalized string key
  if (socket.user) {
    const uId = String(socket.user.id || socket.user._id || socket.user.userId || '');
    if (uId) {
      global.connectedUsers.set(uId, socket.id);
    }
  }

  handleMatchmaking(io, socket);
  setupGameplaySockets(io, socket);
  setupGroupQuiz(io, socket);
  require('./socket/duel').setupDuelSockets(io, socket);

  socket.on('disconnect', () => {
    if (socket.user) {
      const uId = String(socket.user.id || socket.user._id || socket.user.userId || '');
      if (uId && global.connectedUsers.get(uId) === socket.id) {
        global.connectedUsers.delete(uId);
      }
    }
  });
});

// Start Cron Jobs
startDecayCron();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
