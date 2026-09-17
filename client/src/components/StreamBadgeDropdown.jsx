import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStream } from '../context/ExamStreamContext';
import { STREAM_META } from '../config/streams';
import { sounds } from '../utils/sound';

const STREAM_ORDER = ['civil', 'ssc_cgl', 'banking'];

export default function StreamBadgeDropdown({ className = '' }) {
  const { selectedStream, setStream, meta, isSwitching } = useStream();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = useCallback(
    async (id) => {
      setOpen(false);
      if (id === selectedStream) return;
      sounds.click?.();
      await setStream(id);
    },
    [selectedStream, setStream]
  );

  const Option = ({ id }) => {
    const s = STREAM_META[id];
    const active = id === selectedStream;
    return (
      <button
        type="button"
        onClick={() => pick(id)}
        className={`flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-all active:scale-95 ${
          active
            ? 'bg-dh-surface border-dh-accent'
            : 'border-transparent hover:border-dh-border hover:bg-dh-surface/60'
        }`}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-lg"
          style={{
            borderColor: `${s.accent}55`,
            background: `${s.accent}15`,
          }}
        >
          {s.icon}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-heading font-black uppercase tracking-tight text-white">
            {s.label}
          </span>
          <span className="block truncate text-[10px] font-heading font-bold text-dh-text-muted">
            {s.exams.slice(0, 3).join(' • ')}
          </span>
        </div>
        {active && (
          <span className="text-xs font-black text-dh-accent">✓</span>
        )}
      </button>
    );
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isSwitching}
        onClick={() => {
          sounds.click?.();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1.5 rounded-xl border-2 border-dh-border hover:border-dh-accent/60 bg-dh-card/90 px-3 py-1.5 transition-all active:scale-95 disabled:opacity-60 shadow-sm"
        style={{
          borderColor: open ? meta.accent : undefined,
        }}
      >
        <span className="text-sm">{meta.icon}</span>
        <span className="max-w-[100px] truncate text-xs font-heading font-black uppercase tracking-wide text-white sm:max-w-none">
          {meta.shortLabel}
        </span>
        <span
          className={`text-[10px] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          style={{ color: meta.accent }}
        >
          ▾
        </span>
      </button>

      {/* Desktop dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 hidden w-72 rounded-2xl border-2 border-dh-border bg-dh-card p-2.5 shadow-2xl md:block animate-pop-in"
        >
          <p className="mb-2 px-1 text-[10px] font-heading font-black uppercase tracking-widest text-dh-text-muted">
            Switch Target Exam
          </p>
          <div className="space-y-1">
            {STREAM_ORDER.map((id) => (
              <Option key={id} id={id} />
            ))}
          </div>
          <p className="mt-2.5 border-t border-dh-border pt-2 px-1 text-[9px] font-heading text-dh-text-muted">
            Progress and notebook are saved per stream.
          </p>
        </div>
      )}

      {/* Mobile bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t-4 border-dh-border bg-dh-card p-4 pb-8 animate-pop-in">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-dh-border" />
            <p className="mb-3 text-center text-[10px] font-heading font-black uppercase tracking-widest text-dh-text-muted">
              Switch Target Exam
            </p>
            <div className="space-y-2">
              {STREAM_ORDER.map((id) => (
                <Option key={id} id={id} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
