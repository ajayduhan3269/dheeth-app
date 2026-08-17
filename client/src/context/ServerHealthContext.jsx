import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';

const ServerHealthContext = createContext({
  isServerReady: false,
  isChecking: true,
  isOffline: false,
  isTimedOut: false,
  secondsWaiting: 0,
  retryCheck: () => {},
});

export const useServerHealth = () => useContext(ServerHealthContext);

export const ServerHealthProvider = ({ children }) => {
  const [isServerReady, setIsServerReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [secondsWaiting, setSecondsWaiting] = useState(0);

  const pollTimerRef = useRef(null);
  const secondsTimerRef = useRef(null);
  const isCancelledRef = useRef(false);

  const checkHealth = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      setIsChecking(false);
      return false;
    }

    setIsOffline(false);

    try {
      // Resilient fast probe with 15s timeout so booting cloud instances are not prematurely aborted
      const res = await axios.get(`${API_URL}/api/health`, {
        timeout: 15000,
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (res.data?.ok || res.status === 200) {
        if (!isCancelledRef.current) {
          setIsServerReady(true);
          setIsChecking(false);
          setIsTimedOut(false);
          if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
          if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);
        }
        return true;
      }
    } catch (_) {
      // Backend is either sleeping (cold start), booting up, or establishing DB connection
    }

    if (!isCancelledRef.current) {
      // Schedule next probe in 2 seconds to rapidly detect when server wakes up
      pollTimerRef.current = setTimeout(checkHealth, 2000);
    }
    return false;
  }, []);

  const retryCheck = useCallback(() => {
    setIsTimedOut(false);
    setIsChecking(true);
    setSecondsWaiting(0);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    isCancelledRef.current = false;

    // Track elapsed waiting time for status ticker
    secondsTimerRef.current = setInterval(() => {
      setSecondsWaiting((prev) => {
        const next = prev + 1;
        if (next >= 40) {
          setIsTimedOut(true);
        }
        return next;
      });
    }, 1000);

    // Initial probe
    checkHealth();

    const handleOnline = () => {
      setIsOffline(false);
      checkHealth();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isCancelledRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkHealth]);

  return (
    <ServerHealthContext.Provider
      value={{
        isServerReady,
        isChecking,
        isOffline,
        isTimedOut,
        secondsWaiting,
        retryCheck,
      }}
    >
      {children}
    </ServerHealthContext.Provider>
  );
};
