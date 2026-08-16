import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { sounds } from '../utils/sound';
import BottomNav from '../components/BottomNav';

const CircularMasteryDial = ({ percentage, size = 110, strokeWidth = 9 }) => {
  const pct = Math.min(Math.max(percentage, 0), 100);
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1f1f38" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={pct >= 80 ? '#00e676' : pct >= 50 ? '#ffb300' : '#ff5252'}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-heading font-black text-white leading-none">{pct}%</span>
        <span className="text-[10px] font-heading font-bold text-dh-text-muted mt-1 uppercase">Mastery</span>
      </div>
    </div>
  );
};

const MistakeNotebookPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('ALL');

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/mistakes/summary');
      if (res.data?.ok) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to load mistake notebook summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const totals = summary?.totals || {
    uniqueMistakes: 0,
    active: 0,
    critical: 0,
    review: 0,
    mastered: 0,
    dueNow: 0,
    masteryPercent: 100
  };

  const filteredTopics = (summary?.topics || []).filter(t => {
    if (selectedSubject === 'ALL') return true;
    return t.subject === selectedSubject;
  });

  return (
    <div className="min-h-screen bg-dh-bg text-dh-text flex flex-col pb-24">
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-6 space-y-6">
        {/* Page Title & Intro */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-black text-white flex items-center gap-2">
              <span>🧠</span> AI Mistake Notebook
            </h1>
            <p className="text-xs md:text-sm text-dh-text-muted mt-0.5">
              Leitner Spaced Repetition • Eradicate repeating exam errors
            </p>
          </div>
          <button
            onClick={() => { sounds.click(); fetchSummary(); }}
            className="p-2 rounded-xl bg-dh-card border border-dh-border hover:border-dh-accent text-xs font-heading font-bold"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Hero Mastery Overview Card */}
        <div className="bg-gradient-to-br from-dh-card via-dh-surface to-dh-card/90 border-2 border-dh-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <CircularMasteryDial percentage={totals.masteryPercent} />
              <div className="space-y-1 text-left">
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-dh-accent/10 border border-dh-accent/30 text-[10px] font-heading font-black text-dh-accent uppercase">
                  Active Error Ledger
                </div>
                <h2 className="text-xl font-heading font-black text-white">
                  {totals.active} Active Mistakes
                </h2>
                <p className="text-xs text-dh-text-muted">
                  {totals.dueNow} questions currently scheduled for spaced review
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  sounds.click();
                  navigate('/notebook/drill');
                }}
                disabled={totals.active === 0}
                className="px-6 py-3.5 rounded-2xl bg-dh-accent hover:bg-yellow-400 text-black font-heading font-black text-sm transition-all shadow-lg shadow-dh-accent/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>🧠</span> Start Smart Drill ({totals.dueNow || totals.active})
              </button>
              <button
                onClick={() => {
                  sounds.click();
                  navigate('/notebook/redeem');
                }}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-dh-green to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-heading font-black text-sm transition-all shadow-lg shadow-dh-green/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>⚡</span> Daily Redeem
              </button>
            </div>
          </div>

          {/* Leitner Level Badges Row */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-dh-border/60">
            <div className="bg-dh-red/10 border border-dh-red/30 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-heading font-black uppercase text-dh-red block">Level 1 • Critical</span>
              <span className="text-2xl font-heading font-black text-dh-red">{totals.critical}</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-heading font-black uppercase text-amber-400 block">Level 2 • In Review</span>
              <span className="text-2xl font-heading font-black text-amber-400">{totals.review}</span>
            </div>
            <div className="bg-dh-green/10 border border-dh-green/30 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-heading font-black uppercase text-dh-green block">Level 3 • Mastered</span>
              <span className="text-2xl font-heading font-black text-dh-green">{totals.mastered}</span>
            </div>
          </div>
        </div>

        {/* Subject Mastery Cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-heading font-black text-white">Subject Mastery Breakdown</h3>
            <div className="flex gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
              <button
                onClick={() => setSelectedSubject('ALL')}
                className={`px-3 py-1 text-xs font-heading font-bold rounded-lg transition-all ${
                  selectedSubject === 'ALL' ? 'bg-dh-accent text-black font-black' : 'bg-dh-card text-dh-text-muted hover:text-white border border-dh-border'
                }`}
              >
                All
              </button>
              {(summary?.subjects || []).map(s => (
                <button
                  key={s.subject}
                  onClick={() => setSelectedSubject(s.subject)}
                  className={`px-3 py-1 text-xs font-heading font-bold rounded-lg transition-all truncate max-w-[120px] ${
                    selectedSubject === s.subject ? 'bg-dh-accent text-black font-black' : 'bg-dh-card text-dh-text-muted hover:text-white border border-dh-border'
                  }`}
                >
                  {s.subject}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(summary?.subjects || []).map(sub => (
              <div
                key={sub.subject}
                className="bg-dh-card border border-dh-border rounded-2xl p-4 space-y-3 hover:border-dh-border/80 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-heading font-black text-white text-base leading-tight">
                      {sub.subject}
                    </h4>
                    <p className="text-[11px] text-dh-text-muted mt-0.5">
                      {sub.active} active errors • {sub.mastered} mastered
                    </p>
                  </div>
                  <span className="text-xs font-heading font-black px-2 py-0.5 rounded-full bg-dh-surface border border-dh-border text-dh-accent">
                    {sub.masteryPercent}% Mastery
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-dh-surface rounded-full overflow-hidden flex">
                  <div style={{ width: `${sub.masteryPercent}%` }} className="bg-dh-green h-full transition-all duration-700" />
                  <div style={{ width: `${100 - sub.masteryPercent}%` }} className="bg-dh-red/60 h-full transition-all duration-700" />
                </div>

                <div className="flex justify-between items-center text-[10px] font-heading font-bold text-dh-text-muted pt-1">
                  <span>Critical: <strong className="text-dh-red">{sub.critical}</strong></span>
                  <span>Review: <strong className="text-amber-400">{sub.review}</strong></span>
                  <span>Accuracy: <strong className="text-white">{sub.attemptAccuracyPercent}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Weakness Radar Heatmap */}
        <div>
          <h3 className="text-lg font-heading font-black text-white mb-3">Topic Error Frequency</h3>
          {filteredTopics.length === 0 ? (
            <div className="bg-dh-card rounded-2xl p-8 text-center border border-dh-border text-dh-text-muted text-sm">
              ✨ No active errors recorded for this subject! Outstanding performance.
            </div>
          ) : (
            <div className="bg-dh-card border border-dh-border rounded-2xl divide-y divide-dh-border overflow-hidden">
              {filteredTopics.map((top, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-dh-surface/40 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-heading font-bold text-dh-text-muted uppercase">
                      {top.subject}
                    </span>
                    <h5 className="font-heading font-bold text-sm text-white">
                      {top.topic}
                    </h5>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-xs font-heading font-black text-dh-red block">
                        {top.activeMistakes} Active Errors
                      </span>
                      <span className="text-[10px] text-dh-text-muted">
                        {top.accuracyPercent}% attempt accuracy
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default MistakeNotebookPage;
