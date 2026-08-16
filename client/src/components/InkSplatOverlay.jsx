import React, { useEffect, useRef } from 'react';

const InkSplatOverlay = ({ clearsAt, onClear }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to parent bounds
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Draw dark splatters
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw irregular ink droplets
    ctx.fillStyle = '#05050a';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 40 + 20;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Interactive erasing via swipe/scratch
    const erase = (clientX, clientY) => {
      const b = canvas.getBoundingClientRect();
      const x = clientX - b.left;
      const y = clientY - b.top;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 45, 0, Math.PI * 2);
      ctx.fill();
    };

    const handlePointerMove = (e) => {
      if (e.buttons > 0 || e.pointerType === 'touch') {
        erase(e.clientX, e.clientY);
      }
    };

    const handlePointerDown = (e) => {
      erase(e.clientX, e.clientY);
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);

    // Auto-clear when clearsAt timestamp expires
    const remainingMs = Math.max(0, clearsAt - Date.now());
    const timer = setTimeout(() => {
      if (onClear) onClear();
    }, remainingMs || 4000);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      clearTimeout(timer);
    };
  }, [clearsAt, onClear]);

  return (
    <div className="absolute inset-0 z-40 rounded-2xl overflow-hidden pointer-events-auto select-none animate-fade-in shadow-2xl">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none"
      />
      <div className="absolute top-3 left-0 right-0 text-center pointer-events-none">
        <span className="inline-block px-3 py-1 rounded-full bg-dh-red text-black font-heading font-black text-xs uppercase tracking-wider shadow-lg animate-pulse">
          🦑 INK BLIND! Scratch to wipe!
        </span>
      </div>
    </div>
  );
};

export default InkSplatOverlay;
