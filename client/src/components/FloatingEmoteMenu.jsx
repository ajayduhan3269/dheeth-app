import React, { useState, useEffect, useRef } from 'react';
import { playReactionSound, getSoundTypeForEmoji } from '../utils/audioFx';

const EMOTE_LIST = [
  { emoji: '🤔', label: 'Thinking', key: '1' },
  { emoji: '🔥', label: 'Fire', key: '2' },
  { emoji: '🤯', label: 'Mind Blown', key: '3' },
  { emoji: '😮', label: 'Shocked', key: '4' },
  { emoji: '😰', label: 'Sweating', key: '5' },
  { emoji: '👏', label: 'Well Played', key: '6' },
  { emoji: '🤝', label: 'Respect', key: '7' },
  { emoji: '💀', label: 'Dead', key: '8' }
];

export default function FloatingEmoteMenu({
  onSendReaction,
  mutedOpponent,
  onToggleMute,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

  // Keyboard shortcut listener (keys 1 - 8 & Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (disabled || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= EMOTE_LIST.length) {
        e.preventDefault();
        const selected = EMOTE_LIST[num - 1];
        if (selected) {
          handleSelect(selected.emoji);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled]);

  const handleSelect = (emoji) => {
    if (disabled) return;
    playReactionSound(getSoundTypeForEmoji(emoji));
    if (navigator.vibrate) navigator.vibrate(10);
    onSendReaction(emoji);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="fixed bottom-5 right-4 md:bottom-8 md:right-8 z-40 select-none">
      {/* Expanded Radial / Arc Emote Palette */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 flex flex-col items-end gap-2 animate-dh-pop">
          {/* Glassmorphic Palette Container */}
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/20 p-2.5 rounded-2xl shadow-2xl flex flex-wrap max-w-[280px] gap-2 justify-center items-center">
            {EMOTE_LIST.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(item.emoji)}
                className="group relative w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-2xl hover:scale-125 hover:-translate-y-1 transition-all active:scale-95 shadow-md cursor-pointer"
                title={`${item.label} (Press ${item.key})`}
              >
                <span>{item.emoji}</span>
                <span className="absolute -top-2 -right-1 text-[9px] font-mono font-black text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-1 rounded-full border border-white/10">
                  {item.key}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Mute Indicator Toolbar */}
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg text-xs text-slate-300">
            <span>Opponent Emotes:</span>
            <button
              type="button"
              onClick={onToggleMute}
              className={`px-2 py-0.5 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer ${
                mutedOpponent ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {mutedOpponent ? '🔇 Muted' : '🔊 Active'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Trigger Button (FAB) */}
      <div className="flex items-center gap-2">
        {/* Compact Mute Toggle Button */}
        <button
          type="button"
          onClick={onToggleMute}
          className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-md border shadow-lg transition-all active:scale-90 cursor-pointer ${
            mutedOpponent
              ? 'bg-slate-900/80 border-rose-500/40 text-rose-400'
              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white hover:bg-slate-900/90'
          }`}
          title={mutedOpponent ? "Unmute Opponent Reactions" : "Mute Opponent Reactions"}
        >
          <span className="text-sm">{mutedOpponent ? '🔇' : '🔊'}</span>
        </button>

        {/* Main Floating Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(prev => !prev)}
          className={`relative w-13 h-13 flex items-center justify-center rounded-full border-2 shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer ${
            isOpen 
              ? 'bg-gradient-to-tr from-dh-accent to-emerald-400 border-white text-slate-900 rotate-12 scale-105 shadow-dh-accent/50'
              : 'bg-slate-900/90 hover:bg-slate-800 border-white/20 hover:border-dh-accent/60 text-white shadow-black/60 hover:scale-105'
          }`}
          title="Send Reaction (Press 1-8)"
          aria-label="Open reactions"
        >
          <span className="text-2xl transition-transform duration-300">
            {isOpen ? '✕' : '💬'}
          </span>
          {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-dh-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-dh-accent"></span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
