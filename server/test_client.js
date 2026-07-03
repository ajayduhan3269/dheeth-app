const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' }); // Adjusted path since we are in server dir

async function runTest() {
  const token = jwt.sign(
    { id: '12345', username: 'TestUser123' },
    process.env.JWT_SECRET || 'fallback_secret_key_change_me',
    { expiresIn: '1d' }
  );

  console.log('Connecting to socket with token:', token);

  const socket = io('http://localhost:5000', {
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('Connected with socket ID:', socket.id);
    console.log('Emitting join_queue for "Soil Mechanics"');
    socket.emit('join_queue', { subject: 'Soil Mechanics' });
  });

  socket.on('connect_error', (err) => {
    console.error('Connection Error:', err.message);
  });

  socket.on('match_found', (payload) => {
    console.log('--- RECEIVED match_found ---');
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  });

  socket.on('error', (err) => {
    console.error('Socket Error Event:', err);
  });

  // Wait 15 seconds for bot timeout to definitely fire
  setTimeout(() => {
    console.log('Timeout reached (15s). Did not receive match_found.');
    process.exit(1);
  }, 15000);
}

runTest();
