import React, { useEffect, useState, useContext, useRef, useCallback } from 'react';
import api, { getAvatarUrl } from '../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { socket } from '../socket';
import Leaderboard from './Leaderboard';
import ModeToggle from './ModeToggle';
import AnimatedNumber from './AnimatedNumber';
import Confetti from './Confetti';
import { useAppMode } from '../context/AppModeContext';
import { sounds } from '../utils/sound';

/* ─── Tiny helpers ─────────────────────────────────────────── */
const CircularProgress = ({ current, goal, size = 88, strokeWidth = 7 }) => {
  const pct = Math.min((current / goal) * 100, 100);
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#2a2a4a" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={pct >= 100 ? '#58cc02' : '#00e676'}
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-heading font-black text-dh-accent leading-none">{current}</span>
        <span className="text-[9px] font-heading font-bold text-dh-text-muted">/ {goal}</span>
        {pct >= 100 && <span className="text-[8px] text-dh-green font-black">✓</span>}
      </div>
    </div>
  );
};

/* ─── War alert banner ─────────────────────────────────────── */
const WarAlert = ({ onGoToMap }) => (
  <button
    onClick={onGoToMap}
    className="w-full flex items-center gap-3 bg-dh-red/10 border-2 border-b-4 border-dh-red/40
      rounded-2xl px-4 py-3 text-left hover:bg-dh-red/15 active:translate-y-[2px] active:border-b-2
      transition-all group"
  >
    <span className="text-2xl animate-bounce-subtle">⚔️</span>
    <div className="flex-1 min-w-0">
      <p className="font-heading font-black text-dh-red text-sm">Your territories are vulnerable!</p>
      <p className="text-dh-text-muted text-xs truncate">Fortify your castles on the War Map →</p>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className="w-4 h-4 text-dh-red flex-shrink-0 group-hover:translate-x-1 transition-transform">
      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  </button>
);

/* ─── "Continue Journey" hero card ─────────────────────────── */
const JourneyHeroCard = ({ journeyNext, onNavigate }) => {
  if (!journeyNext) return null;
  const { subjectName, nodeTitle, nodesDone, nodesTotal, subjectEmoji } = journeyNext;
  const pct = nodesTotal > 0 ? Math.round((nodesDone / nodesTotal) * 100) : 0;

  return (
    <button
      onClick={() => { sounds.click(); onNavigate('/journey'); }}
      className="w-full bg-gradient-to-br from-dh-accent/10 via-dh-surface to-dh-accent/5
        border-2 border-b-4 border-dh-accent/40 rounded-2xl p-5 text-left
        hover:border-dh-accent/70 active:translate-y-[2px] active:border-b-2 transition-all group"
    >
      <div className="flex items-center gap-4">
        {/* Icon bubble */}
        <div className="w-14 h-14 rounded-2xl bg-dh-accent/20 flex items-center justify-center text-2xl flex-shrink-0 border border-dh-accent/30">
          {subjectEmoji || '📚'}
        </div>

        <div className="flex-1 min-w-0">
          {/* Badge */}
          <span className="inline-block text-[10px] font-heading font-black uppercase tracking-widest
            text-dh-accent bg-dh-accent/10 px-2 py-0.5 rounded-full border border-dh-accent/30 mb-1">
            Continue Journey
          </span>
          <h2 className="font-heading font-black text-white text-base leading-tight truncate">
            {subjectName}
          </h2>
          <p className="text-dh-text-muted text-xs truncate mt-0.5">
            Next: {nodeTitle}
          </p>
          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-dh-border rounded-full overflow-hidden">
              <div
                className="h-full bg-dh-accent rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-heading font-bold text-dh-accent flex-shrink-0">
              {nodesDone}/{nodesTotal}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className="w-5 h-5 text-dh-accent flex-shrink-0 group-hover:translate-x-1 transition-transform">
          <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
      </div>
    </button>
  );
};

/* ─── Subject battle card ──────────────────────────────────── */
const SUBJECT_ICONS = {
  'Fluid Mechanics': '💧',
  'Soil Mechanics': '🪨',
  'Structural Analysis': '🏗️',
  'Geotechnical Engineering': '⛏️',
  'Environmental Engineering': '🌿',
  'Building Materials': '🧱',
  'Irrigation Engineering': '🌾',
  'Transportation Engineering': '🛣️',
  'Steel Structures': '🔩',
  'Concrete Structures': '🧱',
  'Indian Polity': '🏛️',
  'History': '📜',
  'Geography': '🌍',
  'Economics': '📊',
  'Science & Technology': '🔬',
  'Current Affairs': '📰',
};

const SubjectCard = ({ subject, index, onClick, disabled }) => {
  const emoji = SUBJECT_ICONS[subject] || '⚡';
  return (
    <button
      disabled={disabled}
      onClick={() => onClick(subject)}
      className="bg-dh-card p-4 rounded-2xl border-2 border-b-4 border-dh-border
        hover:border-dh-accent/60 text-left transition-all active:translate-y-[2px] active:border-b-2
        disabled:opacity-50 group relative overflow-hidden"
      style={{ animation: `pop-in ${0.15 + index * 0.07}s ease-out both` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-dh-accent/0 to-dh-accent/0
        group-hover:from-dh-accent/5 group-hover:to-dh-accent/5 transition-all duration-500" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-dh-accent/10 border border-dh-accent/20
          flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
          {emoji}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-heading font-bold text-dh-text group-hover:text-white transition-colors leading-tight">
            {subject}
          </h4>
          <p className="text-dh-text-muted text-[11px] mt-0.5">15-second timer match</p>
        </div>
      </div>
    </button>
  );
};

/* ─── Searching overlay card ────────────────────────────────── */
const SearchingCard = ({ failed, onCancel, onRetry, lastSubject }) => (
  <div className={`mt-6 flex flex-col items-center gap-3 bg-dh-accent/10
    text-dh-accent-light font-heading font-bold text-base px-8 py-6 rounded-2xl border
    ${failed ? 'border-dh-red/50' : 'border-dh-accent/30 animate-pulse'}`}>
    {failed ? (
      <>
        <div className="flex items-center gap-2 text-dh-red">
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          Connection timed out
        </div>
        <p className="text-xs text-dh-text-muted font-body">Server may be busy. Please retry.</p>
        <div className="flex gap-3 mt-1">
          <button onClick={onCancel} className="text-sm text-dh-text-muted hover:text-dh-red font-body border border-dh-border px-4 py-1.5 rounded-lg">Cancel</button>
          <button onClick={() => onRetry(lastSubject)} className="text-sm text-white bg-dh-accent hover:bg-dh-accent/80 font-body px-4 py-1.5 rounded-lg">Retry</button>
        </div>
      </>
    ) : (
      <>
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Searching for Opponent…
        </div>
        <p className="text-dh-text-muted text-xs font-body">A bot joins in ~5 s if no one's online</p>
        <button onClick={onCancel} className="text-sm text-dh-text-muted hover:text-dh-red font-body mt-1">Cancel</button>
      </>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════ */
/*  Main Dashboard                                             */
/* ═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { currentUser, logout } = useContext(AuthContext);
  const { mode } = useAppMode();
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [journeyNext, setJourneyNext] = useState(null);
  const [daily, setDaily] = useState(null);
  const [mapOwned, setMapOwned] = useState(0);
  const [coins, setCoins] = useState(0);

  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [lastSubject, setLastSubject] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const searchTimeoutRef = useRef(null);

  /* ── Data fetching ─────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    try {
      const [userRes, dailyRes, subjectsRes, journeySubjectsRes, journeyProgressRes, mapRes] = await Promise.allSettled([
        api.get('/api/user/me'),
        api.get('/api/daily'),
        api.get(`/api/questions/subjects?category=${mode}`),
        api.get(`/api/journey/subjects?category=${mode}`),
        api.get('/api/journey/progress'),
        api.get('/api/map/states'),
      ]);

      if (userRes.status === 'fulfilled') {
        setStats(userRes.value.data);
        setCoins(userRes.value.data.coins ?? 0);
      }
      if (dailyRes.status === 'fulfilled') setDaily(dailyRes.value.data.data);
      if (subjectsRes.status === 'fulfilled' && subjectsRes.value.data.success) {
        setSubjects(subjectsRes.value.data.data);
      }

      // Compute "next journey node" hint
      if (journeySubjectsRes.status === 'fulfilled' && journeyProgressRes.status === 'fulfilled') {
        const journeySubjects = journeySubjectsRes.value.data.data || [];
        const progress = journeyProgressRes.value.data.data?.progress || {};
        let next = null;
        for (const subj of journeySubjects) {
          const nodes = subj.nodes || [];
          const doneCount = nodes.filter(n => progress[n.nodeId]?.status === 'completed').length;
          const nextNode = nodes.find(n => progress[n.nodeId]?.status !== 'completed');
          if (nextNode) {
            next = {
              subjectName: subj.subject,
              nodeTitle: nextNode.title,
              nodesDone: doneCount,
              nodesTotal: nodes.length,
              subjectEmoji: subj.icon || '📚',
            };
            break;
          }
        }
        setJourneyNext(next);
      }

      // Count owned map states (server already computes this)
      if (mapRes.status === 'fulfilled') {
        setMapOwned(mapRes.value.data.conqueredCount || 0);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, [mode]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Socket setup ──────────────────────────────────────── */
  useEffect(() => {
    socket.on('match_found', (payload) => {
      setIsSearching(false);
      setSearchFailed(false);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      navigate('/match', { state: { matchData: payload } });
    });
    socket.on('disconnect', () => setIsSearching(false));
    socket.on('error', () => { setIsSearching(false); setSearchFailed(true); });

    return () => {
      socket.off('match_found');
      socket.off('disconnect');
      socket.off('error');
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [navigate]);

  /* ── Auto-queue from map redirect ─────────────────────── */
  const autoQueuedRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const quickMatch = params.get('quickMatch');
    const targetState = params.get('targetState');
    if (!quickMatch) {
      autoQueuedRef.current = false; // ready for the next map redirect
      return;
    }
    if (autoQueuedRef.current) return; // StrictMode runs effects twice in dev
    autoQueuedRef.current = true;
    joinQueue(quickMatch, targetState);
    navigate('/dashboard', { replace: true });
  }, [location.search]);

  /* ── Queue logic ───────────────────────────────────────── */
  const joinQueue = (subject, targetState = null) => {
    sounds.click();
    setSearchFailed(false);
    setIsSearching(true);
    setLastSubject(subject);
    searchTimeoutRef.current = setTimeout(() => setSearchFailed(true), 10000);
    socket.emit('join_queue', { subject, mode, targetState }, () => {});
  };

  const cancelSearch = () => {
    setIsSearching(false);
    setSearchFailed(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    socket.emit('cancel_search');
  };

  /* ── Streak milestone confetti (once per milestone) ────── */
  useEffect(() => {
    if (daily?.streak > 0 && daily.streak % 7 === 0) {
      const lastCelebrated = localStorage.getItem('dheeth_streak_celebrated');
      if (lastCelebrated === String(daily.streak)) return;
      localStorage.setItem('dheeth_streak_celebrated', String(daily.streak));
      setShowConfetti(true);
      sounds.win();
      const t = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(t);
    }
  }, [daily?.streak]);

  /* ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-dh-bg w-full text-dh-text" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      {showConfetti && <Confetti count={60} />}

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">

        {/* ── Top bar ──────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-heading font-black text-white tracking-wide leading-none">
              DHEETH <span className="text-dh-accent">Arena</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${mode === 'gs' ? 'bg-dh-orange' : 'bg-dh-purple'}`} />
              <span className="text-[10px] font-heading font-bold text-dh-text-muted uppercase tracking-wider">
                {mode === 'gs' ? 'General Studies' : 'Technical'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Coin chip */}
            <div className="flex items-center gap-1.5 bg-dh-card px-3 py-1.5 rounded-xl border-2 border-b-[3px] border-dh-yellow/40">
              <span className="text-base">🪙</span>
              <span className="font-heading font-black text-dh-yellow text-sm tabular-nums">
                <AnimatedNumber value={coins} duration={600} />
              </span>
            </div>
            {/* Streak chip */}
            {daily && (
              <div className="flex items-center gap-1 bg-dh-card px-2.5 py-1.5 rounded-xl border-2 border-b-[3px] border-dh-orange/40">
                <span className="text-base">🔥</span>
                <span className="font-heading font-black text-dh-orange text-sm">{daily.streak}</span>
              </div>
            )}
            {/* Logout */}
            <button
              onClick={logout}
              className="text-dh-text-muted font-heading font-bold hover:text-dh-red px-2.5 py-1.5
                transition-all text-xs uppercase tracking-wider rounded-xl bg-dh-card border-2 border-b-[3px]
                border-dh-border hover:border-dh-red/50 active:translate-y-[2px]"
            >
              Out
            </button>
          </div>
        </div>

        {/* Mode toggle */}
        <ModeToggle />

        {/* ── Hero: Continue Journey ────────────────────── */}
        <div className="mt-5">
          <JourneyHeroCard journeyNext={journeyNext} onNavigate={navigate} />
        </div>

        {/* ── Stats row ─────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {/* Player card */}
            <div className="col-span-3 md:col-span-1 bg-dh-card p-4 rounded-2xl border-2 border-b-4 border-dh-border flex items-center gap-3 relative overflow-hidden">
              <div className="absolute -top-10 -left-10 w-28 h-28 bg-dh-accent/5 rounded-full blur-2xl pointer-events-none" />
              <img
                src={getAvatarUrl(stats.avatarSeed || 'default')}
                alt="Avatar"
                className="w-11 h-11 rounded-full bg-dh-surface border-2 border-dh-border flex-shrink-0"
              />
              <div className="relative z-10 min-w-0">
                <p className="font-heading font-black text-white text-sm truncate">{stats.username}</p>
                <p className="text-dh-accent font-heading font-black text-xs">ELO {stats.eloRating}</p>
                <p className="text-dh-text-muted text-[11px]">{stats.wins}W / {stats.matches - stats.wins}L</p>
              </div>
            </div>

            {/* Daily target */}
            {daily && (
              <div className="col-span-3 md:col-span-2 bg-dh-card p-4 rounded-2xl border-2 border-b-4 border-dh-border flex items-center gap-4">
                <CircularProgress current={daily.dailyQuestionsAnswered} goal={daily.dailyGoal} />
                <div>
                  <h3 className="font-heading font-bold text-dh-text text-sm">Daily Target</h3>
                  <p className="text-dh-text-muted text-xs">Answer {daily.dailyGoal} Qs to keep streak!</p>
                  {daily.streakFreeze > 0 && (
                    <span className="text-xs text-dh-blue font-bold">🧊 Freeze ×{daily.streakFreeze}</span>
                  )}
                  {daily.reward && (
                    <div className="mt-1.5 bg-dh-accent/20 text-dh-accent text-xs font-heading font-black
                      px-2.5 py-1 rounded-full border border-dh-accent/40 animate-bounce inline-block">
                      🎉 +500 coins & Streak Freeze!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── War alert (only if they have territories) ─── */}
        {mapOwned > 0 && (
          <div className="mt-4">
            <WarAlert onGoToMap={() => { sounds.click(); navigate('/map'); }} />
          </div>
        )}

        {/* ── Section header ─────────────────────────────── */}
        <div className="flex items-center gap-3 mt-6 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚔️</span>
            <h3 className="text-base font-heading font-black text-white uppercase tracking-wide">
              Start a Battle
            </h3>
          </div>
          <div className="h-px flex-1 bg-dh-border" />
          <span className="text-dh-text-muted text-[11px] font-heading font-bold uppercase tracking-widest">
            {subjects.length} subjects
          </span>
        </div>

        {/* ── Subject grid ──────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subjects.map((subj, i) => (
            <SubjectCard
              key={subj}
              subject={subj}
              index={i}
              onClick={(s) => joinQueue(s)}
              disabled={isSearching}
            />
          ))}
        </div>

        {/* ── Searching state ───────────────────────────── */}
        {isSearching && (
          <SearchingCard
            failed={searchFailed}
            onCancel={cancelSearch}
            onRetry={joinQueue}
            lastSubject={lastSubject}
          />
        )}

        {/* ── Leaderboard ───────────────────────────────── */}
        <div className="mt-10" id="leaderboard">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-lg">🏆</span>
            <h3 className="text-base font-heading font-black text-white uppercase tracking-wide">Leaderboard</h3>
            <div className="h-px flex-1 bg-dh-border" />
          </div>
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}