import { io } from 'socket.io-client';
import { API_URL } from './api';

export const socket = io(API_URL, {
  autoConnect: true,
  auth: (cb) => {
    const token = localStorage.getItem('dheeth_token');
    cb({ token });
  },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
