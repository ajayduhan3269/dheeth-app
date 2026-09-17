import React from 'react';
import { useStream } from '../context/ExamStreamContext';
import { sounds } from '../utils/sound';

const ModeToggle = ({ className = '' }) => {
  const { subMode, toggleSubMode, showSubModeToggle } = useStream();

  // Hidden entirely outside Civil Engineering stream
  if (!showSubModeToggle) return null;

  return (
    <div
      role="tablist"
      aria-label="Civil Engineering Stream Selector"
      className={`flex items-center justify-center gap-1 bg-dh-surface p-1 rounded-xl border border-dh-border w-fit mx-auto ${className}`}
    >
      <button
        role="tab"
        aria-selected={subMode === 'tech'}
        onClick={() => {
          sounds.click?.();
          toggleSubMode('tech');
        }}
        className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs sm:text-sm font-heading font-bold transition-all duration-300 ${
          subMode === 'tech'
            ? 'bg-dh-purple text-white shadow-lg shadow-dh-purple/30 scale-105'
            : 'text-dh-text-muted hover:text-dh-text'
        }`}
      >
        <span className="text-base">🏗️</span>
        <span>Civil Eng</span>
      </button>
      <button
        role="tab"
        aria-selected={subMode === 'gs'}
        onClick={() => {
          sounds.click?.();
          toggleSubMode('gs');
        }}
        className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs sm:text-sm font-heading font-bold transition-all duration-300 ${
          subMode === 'gs'
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