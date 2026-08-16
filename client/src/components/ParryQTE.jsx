import React, { useEffect, useState } from 'react';
import { sounds } from '../utils/sound';

const ParryQTE = ({ parryDeadlineAt, onParry }) => {
  const [timeLeftMs, setTimeLeftMs] = useState(1500);
  const [parried, setParried] = useState(false);

  useEffect(() => {
    sounds.loss?.(); // Alert tone for incoming attack
    if ('vibrate' in navigator) {
      try { navigator.vibrate([100, 50, 100]); } catch (_) {}
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, parryDeadlineAt - Date.now());
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [parryDeadlineAt]);

  const handleParryClick = (e) => {
    e.preventDefault();
    if (parried || timeLeftMs <= 0) return;
    setParried(true);
    sounds.capture?.();
    if ('vibrate' in navigator) {
      try { navigator.vibrate(150); } catch (_) {}
    }
    onParry();
  };

  const progressPct = Math.max(0, Math.min(100, (timeLeftMs / 1500) * 100));

  return (
    <div
      role="alertdialog"
      aria-label="Incoming Ink Attack! Tap to Parry"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="text-center mb-6">
        <span className="inline-block text-4xl mb-2 animate-bounce">⚠️</span>
        <h2 className="text-2xl font-heading font-black text-white uppercase tracking-wider">
          Incoming Ink Attack!
        </h2>
        <p className="text-sm font-heading font-bold text-dh-red animate-pulse">
          Tap PARRY to reflect the sabotage!
        </p>
      </div>

      <div className="relative flex items-center justify-center">
        {/* Outer Circular Progress Ring */}
        <svg width="180" height="180" className="-rotate-90">
          <circle
            cx="90"
            cy="90"
            r="80"
            stroke="#2a2a4a"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="90"
            cy="90"
            r="80"
            stroke="#10b981"
            strokeWidth="8"
            fill="none"
            strokeDasharray={2 * Math.PI * 80}
            strokeDashoffset={(2 * Math.PI * 80) * (1 - progressPct / 100)}
            strokeLinecap="round"
            className="transition-all duration-75 ease-linear"
          />
        </svg>

        {/* Big Parry Action Button */}
        <button
          type="button"
          onPointerDown={handleParryClick}
          disabled={parried || timeLeftMs <= 0}
          className={`absolute w-36 h-36 rounded-full font-heading font-black text-2xl tracking-widest flex flex-col items-center justify-center transition-all active:scale-90 shadow-2xl ${
            parried
              ? 'bg-emerald-400 text-black border-4 border-white shadow-emerald-400/80 scale-105'
              : 'bg-gradient-to-br from-emerald-400 to-green-600 text-black border-4 border-emerald-200 shadow-emerald-500/80 animate-pulse'
          }`}
        >
          <span>{parried ? 'PARRIED!' : 'PARRY'}</span>
          <span className="text-xs font-bold opacity-80">🛡️ TAP NOW</span>
        </button>
      </div>

      <div className="mt-8 text-xs font-heading font-bold text-dh-text-muted">
        {(timeLeftMs / 1000).toFixed(1)}s remaining
      </div>
    </div>
  );
};

export default ParryQTE;
