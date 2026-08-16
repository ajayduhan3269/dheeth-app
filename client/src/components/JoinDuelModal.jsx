import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sounds } from '../utils/sound';

const JoinDuelModal = ({ isOpen, onClose }) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const inputRefs = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setError('');
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index, value) => {
    const char = value.slice(-1).toUpperCase();
    if (char && !/^[A-Z0-9]$/.test(char)) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setError('');
    sounds.click();

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit on last digit
    if (char && index === 5 && newDigits.every(d => d !== '')) {
      handleJoin(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setDigits(newDigits);
    sounds.click();

    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();

    if (pasted.length >= 6) {
      handleJoin(newDigits.join(''));
    }
  };

  const handleJoin = (codeToJoin) => {
    const fullCode = (codeToJoin || digits.join('')).trim().toUpperCase();
    if (fullCode.length < 6) {
      setError('Please enter a full 6-character code');
      sounds.wrong?.();
      return;
    }

    sounds.click();
    onClose();
    navigate(`/duel/${fullCode}`);
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-dh-card border-4 border-dh-border rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dh-text-muted hover:text-white text-xl font-bold w-8 h-8 rounded-full bg-dh-surface flex items-center justify-center transition-colors"
        >
          ✕
        </button>

        <div className="w-14 h-14 mx-auto rounded-2xl bg-dh-accent/15 border-2 border-dh-accent/40 flex items-center justify-center text-3xl mb-4 shadow-lg shadow-dh-accent/10">
          🔑
        </div>

        <h2 className="text-2xl font-heading font-black text-white mb-1">
          Enter Duel Code
        </h2>
        <p className="text-xs text-dh-text-muted mb-6">
          Enter the 6-character room code sent by your friend.
        </p>

        {/* 6 PIN Input Boxes */}
        <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (inputRefs.current[idx] = el)}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className="w-11 h-14 bg-dh-surface border-2 border-dh-border focus:border-dh-accent text-center text-2xl font-heading font-black text-white rounded-xl outline-none shadow-inner uppercase transition-all"
            />
          ))}
        </div>

        {error && (
          <p className="text-xs font-heading font-bold text-dh-red mb-4 animate-shake">
            ⚠️ {error}
          </p>
        )}

        <button
          onClick={() => handleJoin()}
          className="w-full py-3.5 rounded-2xl bg-dh-accent hover:bg-dh-accent/90 border-b-4 border-dh-accent-dark active:border-b-0 active:translate-y-1 font-heading font-black text-black text-sm uppercase tracking-wider shadow-lg shadow-dh-accent/20 transition-all mb-2"
        >
          Join Arena ⚔️
        </button>
      </div>
    </div>
  );
};

export default JoinDuelModal;
