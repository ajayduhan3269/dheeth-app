import React, { useState, useEffect } from 'react';
import { useServerHealth } from '../context/ServerHealthContext';

const PRO_TIPS = [
  '⚡ Pro Tip: Answer within 2 seconds to capture the maximum +25s Speed Bonus!',
  '🔥 Pro Tip: 3 consecutive correct answers trigger an electrifying Lightning Streak!',
  '👑 Pro Tip: Clutch Final Round awards a 1.5x points multiplier for epic comebacks!',
  '📖 Pro Tip: Star tricky questions to practice them later in your Mistake Notebook!',
  '🛡️ Pro Tip: Complete 50 daily questions to claim free Streak Shields in your shop!',
  '⚔️ Pro Tip: Send 1v1 WhatsApp links to friends for live head-to-head quiz duels!',
];

const ServerWarmupSplash = () => {
  const { isOffline, isTimedOut, secondsWaiting, retryCheck } = useServerHealth();
  const [tipIndex, setTipIndex] = useState(0);

  // Rotate tips every 3.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % PRO_TIPS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // Compute status ticker text
  const getStatusText = () => {
    if (secondsWaiting < 4) return 'Connecting to DHEETH Arena...';
    if (secondsWaiting < 10) return 'Waking up cloud server from standby... ⚡';
    if (secondsWaiting < 22) return 'Spinning up quiz database & match rooms... (~15s on cold start)';
    return 'Almost ready! Finalizing secure real-time connection...';
  };

  // Estimated progress percentage (asymptotic approach to 95%)
  const progressPct = Math.min(94, Math.round((secondsWaiting / 20) * 100));

  return (
    <div className="fixed inset-0 z-[9999] bg-dh-bg flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-dh-accent/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Card Container */}
      <div className="relative z-10 max-w-sm w-full bg-dh-card/90 border-2 border-slate-700/80 rounded-3xl p-7 shadow-2xl backdrop-blur-xl flex flex-col items-center animate-fade-in">
        
        {/* State 1: Offline */}
        {isOffline ? (
          <>
            <div className="w-20 h-20 rounded-full bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center text-4xl mb-4 shadow-lg shadow-rose-500/20 animate-bounce-subtle">
              📡
            </div>
            <h2 className="text-2xl font-heading font-black text-white mb-2">
              You are Offline
            </h2>
            <p className="text-dh-text-muted text-xs leading-relaxed mb-6">
              Please check your internet or Wi-Fi connection to enter the DHEETH Arena.
            </p>
            <button
              onClick={retryCheck}
              className="w-full py-3.5 rounded-xl bg-dh-accent hover:bg-dh-accent-light text-slate-950 font-heading font-black text-sm uppercase tracking-wide shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>🔄</span> Retry Connection
            </button>
          </>
        ) : isTimedOut ? (
          /* State 2: Long Wake-Up Timeout (>40s) */
          <>
            <div className="w-20 h-20 rounded-full bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-4xl mb-4 shadow-lg shadow-amber-500/20 animate-pulse">
              ⌛
            </div>
            <h2 className="text-xl font-heading font-black text-white mb-2">
              Server Taking a Moment...
            </h2>
            <p className="text-dh-text-muted text-xs leading-relaxed mb-6">
              Cloud server instances take up to 25s to spin up on cold start. Tap below to reconnect.
            </p>
            <button
              onClick={retryCheck}
              className="w-full py-3.5 rounded-xl bg-dh-accent hover:bg-dh-accent-light text-slate-950 font-heading font-black text-sm uppercase tracking-wide shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>⚡</span> Reconnect Now
            </button>
          </>
        ) : (
          /* State 3: Active Warm-Up / Cold Start Initializing */
          <>
            {/* Pulsing Animated Emblem */}
            <div className="relative mb-5">
              <div className="absolute -inset-2 rounded-full bg-dh-accent/30 blur-md animate-dh-pulse-ring" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border-2 border-dh-accent/60 flex items-center justify-center text-4xl shadow-xl shadow-dh-accent/20">
                <span className="animate-bounce-subtle">⚔️</span>
              </div>
            </div>

            <h1 className="text-2xl font-heading font-black text-white tracking-tight mb-1">
              DHEETH ARENA
            </h1>

            {/* Status ticker */}
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-dh-accent animate-ping" />
              <p className="text-xs font-heading font-bold text-dh-accent tracking-wide animate-pulse">
                {getStatusText()}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-5 border border-slate-700/60 relative">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-dh-accent to-emerald-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_#00e676]"
                style={{ width: `${Math.max(10, progressPct)}%` }}
              />
            </div>

            {/* Pro Tip Card */}
            <div className="w-full bg-slate-900/80 border border-slate-700/60 rounded-2xl p-3.5 text-left min-h-[70px] flex items-center transition-all duration-300">
              <p className="text-[11px] font-semibold text-slate-300 leading-relaxed italic">
                {PRO_TIPS[tipIndex]}
              </p>
            </div>

            <span className="text-[10px] font-heading font-bold text-slate-500 uppercase tracking-widest mt-4">
              {secondsWaiting}s elapsed
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default ServerWarmupSplash;
