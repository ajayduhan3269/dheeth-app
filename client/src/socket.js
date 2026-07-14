import { io } from 'socket.io-client';
import { API_URL } from './api';

export const socket = io(API_URL, {
  autoConnect: false,
  auth: (cb) => {
    const token = localStorage.getItem('dheeth_token');
    cb({ token });
  },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on('connect_error', (err) => {
  if (err.message.includes('Authentication error')) {
    localStorage.removeItem('dheeth_token');
    localStorage.removeItem('dheeth_user');
    if (window.location.pathname !== '/auth' && window.location.pathname !== '/register') {
      window.location.href = '/auth';
    }
  }
});
