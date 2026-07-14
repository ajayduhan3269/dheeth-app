import React, { createContext, useState, useEffect } from 'react';
import { socket } from '../socket';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists on initial load
    const token = localStorage.getItem('dheeth_token');
    const user = localStorage.getItem('dheeth_user');
    
    if (token && user) {
      setCurrentUser(JSON.parse(user));
      socket.connect();
    }
    setLoading(false);
  }, []);

  const login = (token, user) => {
    localStorage.setItem('dheeth_token', token);
    localStorage.setItem('dheeth_user', JSON.stringify(user));
    setCurrentUser(user);
    socket.connect();
  };

  const logout = () => {
    localStorage.removeItem('dheeth_token');
    localStorage.removeItem('dheeth_user');
    setCurrentUser(null);
    socket.disconnect();
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
