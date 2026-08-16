import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../api';
import { socket } from '../socket';
import { subscribeToPush } from '../utils/pushNotifications';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('dheeth_token');
    if (!token) return null;
    try {
      const res = await api.get('/api/user/me');
      if (res.data) {
        setCurrentUser(res.data);
        localStorage.setItem('dheeth_user', JSON.stringify(res.data));

        // If user already granted notification permission, ensure backend has current subscription
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          subscribeToPush().catch(() => {});
        }

        return res.data;
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
    return null;
  }, []);

  useEffect(() => {
    // Check if token exists on initial load
    const token = localStorage.getItem('dheeth_token');
    const user = localStorage.getItem('dheeth_user');
    
    if (token && user) {
      setCurrentUser(JSON.parse(user));
      socket.connect();
      refreshUser();
    }
    setLoading(false);
  }, [refreshUser]);

  const login = (token, user) => {
    localStorage.setItem('dheeth_token', token);
    localStorage.setItem('dheeth_user', JSON.stringify(user));
    setCurrentUser(user);
    socket.connect();
    refreshUser();
  };

  const logout = () => {
    localStorage.removeItem('dheeth_token');
    localStorage.removeItem('dheeth_user');
    setCurrentUser(null);
    socket.disconnect();
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, refreshUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
