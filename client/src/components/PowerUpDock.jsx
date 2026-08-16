import React from 'react';
import { sounds } from '../utils/sound';

const POWERUP_METADATA = {
  EMP: {
    icon: '✂️',
    title: 'EMP Disruptor (50-50)',
    desc: 'Vaporizes 2 wrong options',
    color: 'from-cyan-500/20 to-blue-500/10 border-cyan-400 text-cyan-300',
    ring: 'ring-cyan-400/40'
  }
};

const PowerUpDock = ({ powerupSlot, onActivate, disabled, isActivating }) => {
  if (!powerupSlot || powerupSlot.status !== 'READY') return null;

  const meta = POWERUP_METADATA[powerupSlot.type] || POWERUP_METADATA.EMP;

  const handleClick = () => {
    if (disabled || isActivating) return;
    sounds.click();
    onActivate(powerupSlot);
  };

  return (
    <div className="w-full mt-3 mb-2 flex justify-center animate-fade-in">
      <button
        type="button"
        disabled={disabled || isActivating}
        onClick={handleClick}
        className={`w-full max-w-sm p-3 rounded-2xl border-2 bg-gradient-to-r ${meta.color} bg-dh-card/90 backdrop-blur-md shadow-xl flex items-center justify-between transition-all active:scale-95 ${
          disabled ? 'opacity-50 cursor-not-allowed border-dh-border' : `ring-2 ${meta.ring} hover:scale-[1.02] cursor-pointer animate-pulse-subtle`
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
            {meta.icon}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-sm text-white tracking-wide">
                {meta.title}
              </span>
              <span className="text-[9px] font-heading font-bold px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-dh-text-muted">
                Exp Q{powerupSlot.expiresAfterRound}
              </span>
            </div>
            <p className="text-[11px] text-dh-text-muted font-medium line-clamp-1">
              {meta.desc}
            </p>
          </div>
        </div>

        <div className="flex items-center">
          <span className="bg-white text-black font-heading font-black text-xs px-3 py-1.5 rounded-xl shadow-md uppercase tracking-wider">
            {isActivating ? 'Activating...' : 'Use ⚡'}
          </span>
        </div>
      </button>
    </div>
  );
};

export default PowerUpDock;
