import React from 'react';
import { useAppMode } from '../context/AppModeContext';

const ModeToggle = () => {
  const { mode, toggleMode } = useAppMode();

  return (
    <div className="flex items-center justify-center gap-1 bg-dh-surface p-1 rounded-xl border border-dh-border w-fit mx-auto">
      <button
        onClick={() => toggleMode('tech')}
        className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-heading font-bold transition-all duration-300 ${
          mode === 'tech'
            ? 'bg-dh-purple text-white shadow-lg shadow-dh-purple/30 scale-105'
            : 'text-dh-text-muted hover:text-dh-text'
        }`}
      >
        <span className="text-base">🏗️</span>
        <span>Civil Eng</span>
      </button>
      <button
        onClick={() => toggleMode('gs')}
        className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-heading font-bold transition-all duration-300 ${
          mode === 'gs'
            ? 'bg-dh-orange text-white shadow-lg shadow-dh-orange/30 scale-105'
            : 'text-dh-text-muted hover:text-dh-text'
        }`}
      >
        <span className="text-base">🌍</span>
        <span>GS</span>
      </button>
    </div>
  );
};

export default ModeToggle;