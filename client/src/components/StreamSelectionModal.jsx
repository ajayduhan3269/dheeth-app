import React, { useState, useCallback, useEffect } from 'react';
import { useStream } from '../context/ExamStreamContext';
import { STREAM_META } from '../config/streams';
import { sounds } from '../utils/sound';

const STREAM_ORDER = ['ssc_cgl', 'civil', 'banking'];

export default function StreamSelectionModal({ onComplete }) {
  const { setStream, needsStreamSelection } = useStream();
  const [hovered, setHovered] = useState(null);
  const [pending, setPending] = useState(null);

  // Non-dismissible on first onboarding: lock scroll, ignore Escape
  useEffect(() => {
    if (!needsStreamSelection) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const stopEscape = (e) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    window.addEventListener('keydown', stopEscape, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', stopEscape, true);
    };
  }, [needsStreamSelection]);

  const choose = useCallback(
    async (id) => {
      if (pending) return;
      sounds.click?.();
      setPending(id);
      await setStream(id);
      onComplete?.(id);
    },
    [pending, setStream, onComplete]
  );

  if (!needsStreamSelection) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stream-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 px-4 py-8 backdrop-blur-md animate-fade-in"
    >
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-dh-accent/15 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl animate-pop-in">
        <header className="mb-6 text-center">
          <span className="mb-3 inline-block rounded-full border-2 border-dh-accent/40 bg-dh-accent/10 px-4 py-1 text-[11px] font-heading font-black uppercase tracking-widest text-dh-accent">
            Step 1 of 1 · Target Exam
          </span>
          <h1
            id="stream-modal-title"
            className="text-3xl font-heading font-black uppercase tracking-tight text-white sm:text-4xl"
          >
            Choose Your <span className="text-dh-accent">Stream</span>
          </h1>
          <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-dh-text-muted">
            Select your target exam arena. You can switch anytime from the top bar without losing your stats.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {STREAM_ORDER.map((id) => {
            const s = STREAM_META[id];
            const isHot = hovered === id;
            const isLoading = pending === id;

            return (
              <button
                key={id}
                type="button"
                disabled={!!pending}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(id)}
                onClick={() => choose(id)}
                style={{
                  borderColor: isHot ? s.accent : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: isHot
                    ? `0 0 0 1px ${s.accent}, 0 18px 45px -12px ${s.glow}`
                    : 'none',
                }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-4 bg-dh-card p-5 text-left transition-all duration-200 hover:-translate-y-1 active:scale-95 disabled:opacity-60 focus:outline-none"
              >
                {/* Top accent bar */}
                <div
                  className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  style={{ background: s.accent }}
                />

                <div>
                  <div className="mb-3 flex items-start justify-between">
                    <span
                      className="grid h-14 w-14 place-items-center rounded-xl border-2 text-2xl transition-transform duration-200 group-hover:scale-110"
                      style={{
                        borderColor: `${s.accent}55`,
                        background: `${s.accent}15`,
                      }}
                    >
                      {s.icon}
                    </span>
                    {id === 'civil' && (
                      <span className="rounded-md border-2 border-orange-500/50 bg-orange-500/10 px-2 py-0.5 text-[10px] font-heading font-black uppercase tracking-wider text-orange-400">
                        Civil + GS
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-heading font-black uppercase tracking-tight text-white">
                    {s.label}
                  </h2>
                  <p
                    className="mt-0.5 text-[11px] font-heading font-bold uppercase tracking-wide"
                    style={{ color: s.accent }}
                  >
                    {s.tagline}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {s.exams.map((e) => (
                      <span
                        key={e}
                        className="rounded border border-dh-border bg-dh-bg px-2 py-0.5 text-[9px] font-heading font-bold uppercase tracking-wider text-dh-text-muted"
                      >
                        {e}
                      </span>
                    ))}
                  </div>

                  <p className="mt-3 text-[11px] leading-relaxed text-dh-text-muted">
                    {s.focus}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-dh-border pt-3">
                  <span className="text-[10px] font-heading font-black uppercase tracking-widest text-dh-text-muted">
                    {isLoading ? 'Entering Arena…' : 'Enter Arena'}
                  </span>
                  <span
                    className="text-base font-black transition-transform group-hover:translate-x-1"
                    style={{ color: s.accent }}
                  >
                    {isLoading ? '…' : '→'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-center text-[11px] font-heading font-bold uppercase tracking-widest text-dh-text-muted">
          Already studying Civil Engineering? Select 🏗️ — your syllabus is 100% preserved.
        </p>
      </div>
    </div>
  );
}
