const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

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

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);
  handleMatchmaking(io, socket);
  setupGameplaySockets(io, socket);
  setupGroupQuiz(io, socket);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
