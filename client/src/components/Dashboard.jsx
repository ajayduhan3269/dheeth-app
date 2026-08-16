import React, { useEffect, useState, useContext, useRef, useCallback } from 'react';
import api, { getAvatarUrl } from '../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { socket } from '../socket';
import Leaderboard from './Leaderboard';
import ModeToggle from './ModeToggle';
import AnimatedNumber from './AnimatedNumber';
import Confetti from './Confetti';
import CreateDuelModal from './CreateDuelModal';
import JoinDuelModal from './JoinDuelModal';
import { useAppMode } from '../context/AppModeContext';
import { sounds } from '../utils/sound';

/* ─── Compact Top-Bar Target Mini-Ring ────────────────────── */
const TargetMiniRing = ({ current = 0, goal = 50, size = 34, strokeWidth = 3.5, onClick }) => {
  const pct = Math.min((current / Math.max(goal, 1)) * 100, 100);
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const isDone = pct >= 100;

  return (
    <button
      onClick={onClick}
      title={`Daily Target: ${current}/${goal} Qs`}
      className="relative flex items-center justify-center rounded-xl bg-dh-card/90 border border-dh-border hover:border-dh-accent/60 p-1 transition-all active:scale-95 group flex-shrink-0"
      style={{ width: size + 6, height: size + 6 }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#334155" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={isDone ? '#00e676' : '#38bdf8'}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {isDone ? (
          <span className="text-xs font-black text-dh-accent animate-pulse">✓</span>
        ) : (
          <span className="text-[10px] font-heading font-black text-white">{current}</span>
        )}
      </div>
    </button>
  );
};

/* ─── War alert banner ─────────────────────────────────────── */
const WarAlert = ({ onGoToMap }) => (
  <button
    onClick={onGoToMap}
    className="w-full flex items-center gap-3.5 bg-gradient-to-r from-red-950/50 via-dh-card to-red-950/40 border-2 border-b-4 border-dh-red/60 rounded-2xl px-4 py-3.5 text-left hover:border-dh-red active:translate-y-[2px] transition-all group shadow-lg"
  >
    <div className="w-10 h-10 rounded-xl bg-dh-red/20 border border-dh-red/40 flex items-center justify-center text-xl flex-shrink-0 animate-bounce-subtle">
      ⚔️
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-heading font-black text-dh-red text-sm">War Map Under Attack!</p>
        <span className="text-[9px] font-heading font-black px-1.5 py-0.2 rounded bg-dh-red/20 text-dh-red border border-dh-red/40 uppercase animate-pulse">
          Alert
        </span>
      </div>
      <p className="text-dh-text-muted text-xs truncate mt-0.5">Defend and reinforce your state castles now →</p>
    </div>
    <span className="text-dh-red font-heading font-bold text-xs group-hover:translate-x-1 transition-transform pr-1">
      Defend →
    </span>
  </button>
);

/* ─── "Continue Journey" Hero Card ─────────────────────────── */
const JourneyHeroCard = ({ journeyNext, onNavigate }) => {
  if (!journeyNext) return null;
  const { subjectName, nodeTitle, nodesDone, nodesTotal, subjectEmoji } = journeyNext;
  const pct = nodesTotal > 0 ? Math.round((nodesDone / nodesTotal) * 100) : 0;

  return (
    <div
      onClick={() => { sounds.click(); onNavigate('/journey'); }}
      className="w-full bg-gradient-to-br from-dh-card via-dh-surface to-dh-card border-2 border-b-4 border-dh-accent/40 hover:border-dh-accent/70 rounded-3xl p-5 text-left active:translate-y-[2px] transition-all group relative overflow-hidden shadow-xl cursor-pointer"
    >
      {/* Ambient background glow */}
      <div className="absolute -top-12 -right-12 w-44 h-44 bg-dh-accent/10 rounded-full blur-3xl pointer-events-none group-hover:bg-dh-accent/20 transition-all duration-500" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Subject Icon Container */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-dh-accent/20 to-emerald-950/40 border-2 border-dh-accent/40 flex items-center justify-center text-3xl flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
            {subjectEmoji || '📚'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-heading font-black uppercase tracking-widest text-dh-accent bg-dh-accent/15 px-2.5 py-0.5 rounded-full border border-dh-accent/40">
                Continue Journey
              </span>
              <span className="text-xs font-heading font-bold text-dh-text-muted">
                {nodesDone}/{nodesTotal} Levels
              </span>
            </div>
            <h2 className="font-heading font-black text-white text-lg leading-tight truncate">
              {subjectName}
            </h2>
            <p className="text-dh-accent-light text-xs font-semibold truncate mt-0.5">
              Next: <span className="text-white font-bold">{nodeTitle}</span>
            </p>

            {/* Progress bar */}
            <div className="mt-2.5 flex items-center gap-2 max-w-xs">
              <div className="flex-1 h-2 bg-dh-border rounded-full overflow-hidden border border-dh-border/40">
                <div
                  className="h-full bg-gradient-to-r from-dh-accent to-emerald-400 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(0,230,118,0.5)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-heading font-black text-dh-accent flex-shrink-0">
                {pct}%
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sounds.click();
            onNavigate('/journey');
          }}
          className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-dh-accent text-black font-heading font-black text-xs uppercase tracking-wider hover:brightness-110 shadow-lg shadow-dh-accent/20 flex items-center justify-center gap-2 flex-shrink-0 group-hover:scale-105 active:scale-95 transition-all"
        >
          <span>Resume Level</span>
          <span className="text-sm">▶</span>
        </button>
      </div>
    </div>
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
  'Highway Engineering': '🛣️',
  'Steel Structures': '🔩',
  'Concrete Structures': '🧱',
  'Indian Polity': '🏛️',
  'History': '📜',
  'Geography': '🌍',
  'Economics': '📊',
  'Science & Technology': '🔬',
  'Current Affairs': '📰',
  'Surveying': '🔭',
  'Ancient History': '🏺',
  'Medieval History': '🏰',
  'Modern History': '📜',
  'Biology': '🧬',
  'Polity': '🏛️',
  'World Core & Climate': '🌏',
  'Indian Geography & Resources': '🗺️',
};

const SubjectCard = ({ subject, index, onClick, disabled }) => {
  const emoji = SUBJECT_ICONS[subject] || '⚡';
  return (
    <button
      disabled={disabled}
      onClick={() => onClick(subject)}
      className="bg-dh-card/90 hover:bg-dh-card p-4 rounded-2xl border-2 border-b-4 border-dh-border hover:border-dh-accent/60 text-left transition-all active:translate-y-[2px] active:border-b-2 disabled:opacity-50 group relative overflow-hidden shadow-md"
      style={{ animation: `pop-in ${0.12 + index * 0.05}s ease-out both` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-dh-accent/0 to-dh-accent/0 group-hover:from-dh-accent/5 group-hover:to-dh-accent/10 transition-all duration-300 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-dh-surface border border-dh-border group-hover:border-dh-accent/40 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform shadow-inner">
            {emoji}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-heading font-bold text-dh-text group-hover:text-white transition-colors leading-tight truncate">
              {subject}
            </h4>
            <p className="text-dh-text-muted text-[11px] mt-0.5">Speed Duel • 60s</p>
          </div>
        </div>

        <div className="w-8 h-8 rounded-lg bg-dh-surface border border-dh-border/70 group-hover:bg-dh-accent group-hover:text-black group-hover:border-dh-accent flex items-center justify-center text-xs font-heading font-black text-dh-text-muted transition-all flex-shrink-0">
          ⚔️
        </div>
      </div>
    </button>
  );
};

/* ─── Searching Overlay Card ────────────────────────────────── */
const SearchingCard = ({ failed, onCancel, onRetry, lastSubject }) => (
  <div className={`mt-6 flex flex-col items-center gap-3 bg-dh-accent/10 text-dh-accent-light font-heading font-bold text-base px-8 py-6 rounded-2xl border ${failed ? 'border-dh-red/50' : 'border-dh-accent/30 animate-pulse'}`}>
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
  const [showCreateDuel, setShowCreateDuel] = useState(false);
  const [showJoinDuel, setShowJoinDuel] = useState(false);
  const [showTargetPopover, setShowTargetPopover] = useState(false);

  const searchTimeoutRef = useRef(null);
  const popoverRef = useRef(null);

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
          const doneCount = nodes.filter((n) => progress[n.nodeId]?.status === 'completed').length;
          const nextNode = nodes.find((n) => progress[n.nodeId]?.status !== 'completed');
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

      if (mapRes.status === 'fulfilled') {
        setMapOwned(mapRes.value.data.conqueredCount || 0);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, [mode]);

  useEffect(() => {
    fetchAll();
    const handleFocus = () => fetchAll();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchAll, location.key]);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowTargetPopover(false);
      }
    };
    if (showTargetPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTargetPopover]);

  /* ── Socket setup ──────────────────────────────────────── */
  useEffect(() => {
    const checkOngoingMatch = () => {
      socket.emit('match:sync', (response) => {
        if (response && response.ok) {
          const { matchId, currentQuestionIndex, questionEndsAt, players, subject, questions } = response;

          const playerIds = Object.keys(players);
          const myId = currentUser?.id || currentUser?._id;
          const opponentId = playerIds.find((id) => id !== String(myId)) || playerIds[0];

          const payload = {
            roomId: matchId,
            subject,
            questions,
            currentQuestionIndex,
            questionEndsAt,
            players,
            matchPhase: 'active',
            player: { id: myId, username: players[myId]?.username, avatarSeed: players[myId]?.avatarSeed },
            opponent: { id: opponentId, username: players[opponentId]?.username, avatarSeed: players[opponentId]?.avatarSeed },
          };
          navigate('/match', { state: { matchData: payload, remountKey: matchId + '_' + Date.now() } });
        }
      });
    };

    socket.on('connect', checkOngoingMatch);
    if (socket.connected) {
      checkOngoingMatch();
    }

    socket.on('match_found', (payload) => {
      setIsSearching(false);
      setSearchFailed(false);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      navigate('/match', { state: { matchData: payload } });
    });
    socket.on('disconnect', () => setIsSearching(false));
    socket.on('error', () => {
      setIsSearching(false);
      setSearchFailed(true);
    });

    return () => {
      socket.off('connect', checkOngoingMatch);
      socket.off('match_found');
      socket.off('disconnect');
      socket.off('error');
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [navigate, currentUser]);

  /* ── Auto-queue from map redirect ─────────────────────── */
  const autoQueuedRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const quickMatch = params.get('quickMatch');
    const targetState = params.get('targetState');
    if (!quickMatch) {
      autoQueuedRef.current = false;
      return;
    }
    if (autoQueuedRef.current) return;
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

  /* ── Streak milestone confetti ─────────────────────────── */
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

  // Determine user rank glow color
  const elo = stats?.eloRating || 1200;
  const rankGlow =
    elo >= 1800
      ? 'border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)] text-cyan-300'
      : elo >= 1500
      ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] text-amber-300'
      : 'border-dh-accent shadow-[0_0_8px_rgba(0,230,118,0.4)] text-dh-accent';

  /* ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-dh-bg w-full text-dh-text" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      {showConfetti && <Confetti count={60} />}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 1. TOP COMMAND BAR (Unified Gamified Control Center)   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-dh-bg/90 backdrop-blur-xl border-b border-dh-border/70 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Left: Player Identity Pill (Clickable -> Profile) */}
          <button
            onClick={() => { sounds.click(); navigate('/profile'); }}
            className="flex items-center gap-2.5 bg-dh-card/90 hover:bg-dh-card px-2.5 py-1.5 rounded-2xl border border-dh-border hover:border-dh-accent/60 transition-all active:scale-95 group text-left min-w-0"
            title="View Profile & Stats"
          >
            <div className={`relative w-8 h-8 rounded-full border-2 ${rankGlow.split(' ')[0]} bg-dh-surface overflow-hidden flex-shrink-0 shadow-sm`}>
              <img
                src={getAvatarUrl(stats?.equippedAvatar || stats?.avatarSeed || currentUser?.username || 'default')}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 pr-1">
              <p className="font-heading font-black text-white text-xs leading-none truncate max-w-[100px] sm:max-w-[130px]">
                {stats?.username || currentUser?.username || 'Player'}
              </p>
              <p className={`text-[10px] font-heading font-black leading-none mt-1 ${rankGlow.split(' ')[2]}`}>
                ⚡ {elo}
              </p>
            </div>
          </button>

          {/* Right: Gamified Stats Cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Daily Target Mini Ring + Popover */}
            <div className="relative" ref={popoverRef}>
              <TargetMiniRing
                current={daily?.dailyQuestionsAnswered || 0}
                goal={daily?.dailyGoal || 50}
                onClick={() => setShowTargetPopover((v) => !v)}
              />

              {/* Target Mini-Modal Popover */}
              {showTargetPopover && (
                <div className="absolute right-0 top-12 z-50 w-72 p-4 rounded-2xl bg-dh-card/95 backdrop-blur-xl border-2 border-dh-border shadow-2xl animate-pop-in text-left">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-heading font-black text-white text-xs uppercase tracking-wider">
                      🎯 Daily Practice Quests
                    </h4>
                    <span className="text-[10px] font-heading font-bold text-dh-accent">
                      {daily?.dailyQuestionsAnswered || 0}/50 Qs
                    </span>
                  </div>

                  {/* 3-Tier Daily Quests */}
                  <div className="space-y-2 mb-3">
                    {/* Tier 1 */}
                    <div className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                      (daily?.dailyQuestionsAnswered || 0) >= 10 
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' 
                        : 'bg-dh-surface border-dh-border text-dh-text-muted'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span>{(daily?.dailyQuestionsAnswered || 0) >= 10 ? '✅' : '⚪'}</span>
                        <span className="font-heading font-bold">10 Qs: Streak Lock</span>
                      </div>
                      <span className="font-black text-amber-400">+50 🪙</span>
                    </div>

                    {/* Tier 2 */}
                    <div className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                      (daily?.dailyQuestionsAnswered || 0) >= 25 
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' 
                        : 'bg-dh-surface border-dh-border text-dh-text-muted'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span>{(daily?.dailyQuestionsAnswered || 0) >= 25 ? '✅' : '⚪'}</span>
                        <span className="font-heading font-bold">25 Qs: Focus Bonus</span>
                      </div>
                      <span className="font-black text-amber-400">+100 🪙</span>
                    </div>

                    {/* Tier 3 */}
                    <div className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                      (daily?.dailyQuestionsAnswered || 0) >= 50 
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' 
                        : 'bg-dh-surface border-dh-border text-dh-text-muted'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span>{(daily?.dailyQuestionsAnswered || 0) >= 50 ? '✅' : '⚪'}</span>
                        <span className="font-heading font-bold">50 Qs: Master Grinder</span>
                      </div>
                      <span className="font-black text-cyan-300">+200 🪙 + 🛡️</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-dh-surface border border-dh-border text-xs">
                    <span className="font-heading font-bold text-dh-text">Streak Shields:</span>
                    <span className="font-heading font-black text-cyan-300">
                      🛡️ {daily?.streakFreeze || 0}/2 Available
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Streak Chip */}
            {daily !== null && (
              <div
                onClick={() => { sounds.click(); setShowTargetPopover(true); }}
                className="flex items-center gap-1 bg-dh-card/90 hover:bg-dh-card px-2.5 py-1.5 rounded-xl border border-orange-500/40 cursor-pointer shadow-sm active:scale-95 transition-all"
                title="Current Daily Streak"
              >
                <span className="text-sm">🔥</span>
                <span className="font-heading font-black text-orange-400 text-xs tabular-nums">
                  {daily?.streak || 0}
                </span>
              </div>
            )}

            {/* Coins Chip */}
            <div
              onClick={() => { sounds.click(); navigate('/shop'); }}
              className="flex items-center gap-1 bg-dh-card/90 hover:bg-dh-card px-2.5 py-1.5 rounded-xl border border-dh-yellow/40 cursor-pointer shadow-sm active:scale-95 transition-all"
              title="Coin Inventory (Tap for Shop)"
            >
              <span className="text-sm">🪙</span>
              <span className="font-heading font-black text-dh-yellow text-xs tabular-nums">
                <AnimatedNumber value={coins} duration={500} />
              </span>
            </div>

            {/* Streak Shield Chip (if available) */}
            {daily?.streakFreeze > 0 && (
              <div
                className="hidden sm:flex items-center gap-1 bg-dh-card/90 px-2 py-1.5 rounded-xl border border-cyan-500/40 shadow-sm"
                title="Active Streak Freezes"
              >
                <span className="text-xs">🛡️</span>
                <span className="font-heading font-black text-cyan-300 text-xs">
                  {daily.streakFreeze}
                </span>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={() => {
                sounds.click();
                logout();
              }}
              className="flex items-center gap-1 bg-dh-card/90 hover:bg-dh-red/20 px-2.5 py-1.5 rounded-xl border border-dh-border hover:border-dh-red/50 text-dh-text-muted hover:text-dh-red transition-all active:scale-95 shadow-sm text-xs font-heading font-bold"
              title="Log Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l2.473-2.47a.75.75 0 10-1.06-1.06l-3.75 3.75a.75.75 0 000 1.06l3.75 3.75a.75.75 0 101.06-1.06l-2.473-2.47H18.25A.75.75 0 0019 10z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 2. BODY CONTENT (Streamlined, Zero-Clutter Layout)     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 space-y-4">
        {/* Mode Toggle (Civil Eng vs General Studies) */}
        <ModeToggle />

        {/* Dynamic High-Priority Alert or Hero */}
        {mapOwned > 0 ? (
          <WarAlert onGoToMap={() => { sounds.click(); navigate('/map'); }} />
        ) : null}

        {/* Primary Hero: Continue Journey */}
        <JourneyHeroCard journeyNext={journeyNext} onNavigate={navigate} />

        {/* ═════════════════════════════════════════════════════ */}
        {/* 3. QUICK ACTIONS 2-COLUMN HUB                        */}
        {/* ═════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ⚔️ 1v1 Friend Challenge Tile */}
          <div className="bg-dh-card/90 p-4 rounded-2xl border-2 border-b-4 border-dh-accent/30 flex flex-col justify-between shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-dh-accent/15 border border-dh-accent/30 flex items-center justify-center text-xl flex-shrink-0">
                ⚔️
              </div>
              <div className="min-w-0">
                <h3 className="font-heading font-black text-white text-sm">1v1 Friend Duel</h3>
                <p className="text-dh-text-muted text-[11px] truncate">Direct Link & 6-Digit Code</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { sounds.click(); setShowCreateDuel(true); }}
                className="flex-1 py-2 rounded-xl bg-dh-accent text-black font-heading font-black text-xs uppercase tracking-wide hover:brightness-110 active:scale-95 transition-all shadow"
              >
                🔥 Create
              </button>
              <button
                onClick={() => { sounds.click(); setShowJoinDuel(true); }}
                className="flex-1 py-2 rounded-xl bg-dh-surface border border-dh-border hover:border-dh-accent/50 text-white font-heading font-bold text-xs uppercase tracking-wide active:scale-95 transition-all"
              >
                🔑 Join Code
              </button>
            </div>
          </div>

          {/* 🧠 AI Mistake Notebook Tile */}
          <div
            onClick={() => { sounds.click(); navigate('/notebook'); }}
            className="bg-dh-card/90 hover:bg-dh-card p-4 rounded-2xl border-2 border-b-4 border-indigo-500/40 hover:border-indigo-500/70 flex flex-col justify-between shadow-md cursor-pointer group active:translate-y-[2px] transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-105 transition-transform">
                🧠
              </div>
              <div className="min-w-0">
                <h3 className="font-heading font-black text-white text-sm">Mistake Drills</h3>
                <p className="text-dh-text-muted text-[11px] truncate">Spaced Repetition & Weak Qs</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-indigo-400 font-heading font-black text-xs group-hover:text-indigo-300">
              <span>Practice Weak Areas</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════ */}
        {/* 4. ARENA BATTLES (Subject Matchmaking Grid)          */}
        {/* ═════════════════════════════════════════════════════ */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider">
                Start a Battle
              </h3>
            </div>
            <span className="text-dh-text-muted text-[11px] font-heading font-bold uppercase tracking-widest bg-dh-surface px-2.5 py-0.5 rounded-full border border-dh-border/60">
              {subjects.length} Subjects
            </span>
          </div>

          {/* Subject Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
        </div>

        {/* Searching Card Overlay */}
        {isSearching && (
          <SearchingCard
            failed={searchFailed}
            onCancel={cancelSearch}
            onRetry={joinQueue}
            lastSubject={lastSubject}
          />
        )}

        {/* ═════════════════════════════════════════════════════ */}
        {/* 5. LEADERBOARD SECTION                               */}
        {/* ═════════════════════════════════════════════════════ */}
        <div className="pt-6" id="leaderboard">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🏆</span>
            <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider">
              Leaderboard Rankings
            </h3>
            <div className="h-px flex-1 bg-dh-border" />
          </div>
          <Leaderboard />
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────── */}
      <CreateDuelModal isOpen={showCreateDuel} onClose={() => setShowCreateDuel(false)} />
      <JoinDuelModal isOpen={showJoinDuel} onClose={() => setShowJoinDuel(false)} />
    </div>
  );
}