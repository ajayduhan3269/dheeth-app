import { io } from 'socket.io-client';
import { API_URL } from './api';

export const socket = io(API_URL, {
  autoConnect: false,
  auth: (cb) => {
    const token = localStorage.getItem('dheeth_token');
    cb({ token });
  },
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

socket.on('connect_error', (err) => {
  if (err.message && err.message.includes('Authentication error: Invalid token')) {
    localStorage.removeItem('dheeth_token');
    localStorage.removeItem('dheeth_user');
    if (window.location.pathname !== '/auth' && window.location.pathname !== '/register' && !window.location.pathname.startsWith('/duel/') && !window.location.pathname.startsWith('/d/')) {
      window.location.href = '/auth';
    }
  }
});
