const jwt = require('jsonwebtoken');

const socketAuthMiddleware = (socket, next) => {
  // Extract token from socket handshake auth object
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    // Verify token using the existing secret (or fallback if not in env)
    const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
    const decoded = jwt.verify(token, secret);
    // Attach user info to the socket instance for downstream use
    socket.user = decoded; 
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = socketAuthMiddleware;
