import React, { useMemo } from 'react';

const COLORS = ['#00e676', '#ffc800', '#1cb0f6', '#ce82ff', '#ff4b4b', '#ff9600'];

const Confetti = ({ count = 50 }) => {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        duration: 2 + Math.random() * 1.5,
        delay: Math.random() * 0.4,
      })),
    [count]
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pieces.map(p => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default Confetti;
