import React, { useEffect, useState, useContext, useMemo } from 'react';
import api, { getAvatarUrl } from '../api';
import { useNavigate } from 'react-router-dom';
import Latex from 'react-latex-next';
import LatexRenderer from '../components/LatexRenderer';
import { useAppMode } from '../context/AppModeContext';
import { AuthContext } from '../context/AuthContext';
import ModeToggle from '../components/ModeToggle';
import Confetti from '../components/Confetti';
import AnimatedNumber from '../components/AnimatedNumber';
import PageSkeleton from '../components/PageSkeleton';
import { sounds } from '../utils/sound';
import { formatLatex } from '../utils/latex';

const SUBJECT_META = {
  'Fluid Mechanics': { icon: '🌊', gradient: 'from-cyan-500 to-blue-700' },
  'Soil Mechanics': { icon: '⛰️', gradient: 'from-amber-500 to-orange-700' },
  'Structural Analysis': { icon: '🏗️', gradient: 'from-purple-500 to-indigo-700' },
  'General Studies': { icon: '📚', gradient: 'from-emerald-500 to-teal-700' },
  'Building Materials': { icon: '🧱', gradient: 'from-rose-500 to-red-700' },
  'Highway Engineering': { icon: '🛣️', gradient: 'from-slate-500 to-gray-700' },
  'Irrigation Engineering': { icon: '🌾', gradient: 'from-lime-500 to-green-700' },
  'Environmental Engineering': { icon: '🌿', gradient: 'from-teal-500 to-emerald-700' },
  'Surveying': { icon: '🔭', gradient: 'from-blue-500 to-indigo-700' },
  'Ancient History': { icon: '🏺', gradient: 'from-amber-500 to-amber-700' },
  'Medieval History': { icon: '🏰', gradient: 'from-rose-600 to-red-800' },
  'Modern History': { icon: '📜', gradient: 'from-slate-500 to-slate-700' },
  'Biology': { icon: '🧬', gradient: 'from-emerald-500 to-green-700' },
  'Polity': { icon: '🏛️', gradient: 'from-blue-600 to-indigo-800' },
  'World Core & Climate': { icon: '🌏', gradient: 'from-cyan-600 to-blue-800' },
  'Indian Geography & Resources': { icon: '🗺️', gradient: 'from-amber-600 to-orange-800' },
};

// Winding horizontal offsets for the Duolingo-style path (in px)
const PATH_OFFSETS = [0, 52, 84, 52, 0, -52, -84, -52];

// Helper to compute 1-3 star ratings based on score percentage
const getStarCount = (score) => {
  if (!score || score < 70) return 1;
  if (score >= 90) return 3;
  if (score >= 80) return 2;
  return 1;
};

// Reusable Star Rating Bar
const StarRating = ({ count, className = "" }) => (
  <div className={`flex items-center gap-1 ${className}`}>
    {[1, 2, 3].map((star) => (
      <span
        key={star}
        className={`text-sm transition-all duration-300 ${
          star <= count
            ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] scale-110'
            : 'text-slate-600 opacity-60'
        }`}
      >
        ★
      </span>
    ))}
  </div>
);

// Journey Node Component
const JourneyNode = ({
  node,
  index,
  status,
  bestScore,
  isCurrentActive,
  avatarUrl,
  onClick,
}) => {
  const isMilestone = node.isMilestone || (node.nodeIndex !== undefined ? (node.nodeIndex + 1) % 5 === 0 : (index + 1) % 5 === 0);
  const stars = getStarCount(bestScore);
  const offset = PATH_OFFSETS[index % PATH_OFFSETS.length];

  // ─────────────────────────────────────────────────────────────
  // 1. MILESTONE CHEST NODES (Every 5th Node)
  // ─────────────────────────────────────────────────────────────
  if (isMilestone) {
    return (
      <div
        style={{ transform: `translateX(${offset}px)` }}
        className="flex flex-col items-center relative my-3 group"
      >
        {/* Active Avatar Pin on Milestone */}
        {isCurrentActive && status === 'available' && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center animate-avatar-pin pointer-events-none">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 via-amber-400 to-yellow-400 opacity-90 blur-[3px]" />
              <div className="relative w-12 h-12 rounded-full border-2 border-white bg-dh-card shadow-2xl overflow-hidden p-0.5">
                <img src={avatarUrl} alt="You" className="w-full h-full object-cover rounded-full" />
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full border border-white shadow uppercase tracking-wider whitespace-nowrap">
                BOSS CHEST
              </span>
            </div>
            <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[7px] border-t-amber-400 mt-0.5" />
          </div>
        )}

        <div className="relative">
          {/* Milestone Completed State */}
          {status === 'completed' ? (
            <div className="flex flex-col items-center">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                <StarRating count={stars} />
              </div>
              <button
                onClick={onClick}
                className="w-[84px] h-[84px] rounded-3xl bg-gradient-to-br from-amber-400/30 via-yellow-500/20 to-amber-950/60 border-4 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5),0_6px_0_0_#b45309] flex flex-col items-center justify-center text-3xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer relative overflow-hidden group-hover:border-amber-300"
                aria-label={`Milestone Chest Level ${node.title}`}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent pointer-events-none" />
                <span className="animate-bounce-subtle drop-shadow-lg">🎁</span>
                {/* Completed Gold Checkmark Badge */}
                <div className="absolute -bottom-1 -right-1 z-20 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-xs font-black shadow-lg">
                  ✓
                </div>
              </button>
            </div>
          ) : status === 'available' ? (
            /* Milestone Active/Available State */
            <div className="flex flex-col items-center">
              <button
                onClick={onClick}
                className="w-[80px] h-[80px] rounded-3xl bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-600 border-4 border-amber-300 ring-4 ring-cyan-400/90 shadow-[0_0_25px_rgba(6,182,212,0.8),0_0_35px_rgba(251,191,36,0.8),0_6px_0_0_#9a3412] flex items-center justify-center text-3xl font-black text-white hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer animate-chest-glow relative overflow-hidden"
                aria-label={`Milestone Chest Level ${node.title}`}
              >
                <span className="animate-pulse drop-shadow-xl">🎁</span>
              </button>
            </div>
          ) : (
            /* Milestone Locked State (Frosted Glass) */
            <button
              disabled
              className="w-[80px] h-[80px] rounded-3xl backdrop-blur-md bg-white/[0.05] border-2 border-white/15 shadow-[inset_0_1px_2px_rgba(255,255,255,0.15)] flex flex-col items-center justify-center text-2xl text-slate-400 opacity-70 cursor-not-allowed select-none transition-all relative overflow-hidden"
              aria-label={`Locked Milestone Chest ${node.title}`}
            >
              <span className="grayscale opacity-60">🧰</span>
              <span className="absolute bottom-1.5 text-[10px] text-slate-400 font-black flex items-center gap-0.5">
                🔒
              </span>
            </button>
          )}
        </div>

        {/* Milestone Node Info Badge */}
        <div className="mt-2.5 flex flex-col items-center gap-1">
          <div className={`px-3 py-0.5 rounded-full border text-[11px] font-heading font-black tracking-wide flex items-center gap-1 shadow-sm ${
            status === 'completed'
              ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
              : status === 'available'
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 animate-pulse'
              : 'bg-white/[0.04] border-white/10 text-slate-400'
          }`}>
            <span>★ {node.title || `Level ${index + 1}`} ★</span>
          </div>

          {/* Reward Preview Pill */}
          <div className={`px-2.5 py-0.5 rounded-md border text-[10px] font-heading font-extrabold flex items-center gap-1.5 ${
            status === 'completed'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
              : status === 'available'
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
              : 'bg-white/[0.03] border-white/10 text-slate-500'
          }`}>
            <span>🪙 +150</span>
            <span>•</span>
            <span>🛡️ Shield</span>
            {status === 'completed' && <span className="text-emerald-400 ml-0.5">✓</span>}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACTIVE NODE (80px glowing cyan/gold dual ring + avatar pin)
  // ─────────────────────────────────────────────────────────────
  if (status === 'available') {
    return (
      <div
        style={{ transform: `translateX(${offset}px)` }}
        className="flex flex-col items-center relative my-2 group"
      >
        {/* Animated Floating Avatar Pin */}
        {isCurrentActive && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center animate-avatar-pin pointer-events-none">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 to-amber-400 opacity-80 blur-[2px]" />
              <div className="relative w-12 h-12 rounded-full border-2 border-white bg-dh-card shadow-2xl overflow-hidden p-0.5">
                <img src={avatarUrl} alt="You" className="w-full h-full object-cover rounded-full" />
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-cyan-500 text-black text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full border border-white shadow uppercase tracking-wider">
                YOU
              </span>
            </div>
            <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[7px] border-t-cyan-400 mt-0.5" />
          </div>
        )}

        <div className="relative">
          <button
            onClick={onClick}
            className="w-[80px] h-[80px] rounded-full bg-gradient-to-br from-cyan-500 via-teal-500 to-blue-600 border-4 border-amber-300 ring-4 ring-cyan-400/90 shadow-[0_0_20px_rgba(6,182,212,0.8),0_0_35px_rgba(251,191,36,0.6),0_6px_0_0_#0e7490] flex items-center justify-center text-3xl font-black text-white hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer animate-dual-ring relative overflow-hidden"
            aria-label={node.title}
          >
            <span className="ml-1 text-white drop-shadow-md">▶</span>
          </button>
        </div>

        <span className="mt-2.5 px-3 py-1 rounded-full border-2 border-cyan-400/60 bg-dh-card text-cyan-300 text-xs font-heading font-bold shadow-dh-soft">
          {node.title}
        </span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. COMPLETED NODE (Gold border, checkmark, 1-3 stars ★★★)
  // ─────────────────────────────────────────────────────────────
  if (status === 'completed') {
    return (
      <div
        style={{ transform: `translateX(${offset}px)` }}
        className="flex flex-col items-center relative my-2 group"
      >
        {/* 1-3 Stars on Top of Node */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
          <StarRating count={stars} />
        </div>

        <div className="relative">
          <button
            onClick={onClick}
            className="w-[76px] h-[76px] rounded-full border-4 border-amber-400 bg-gradient-to-b from-amber-400/25 via-amber-500/15 to-amber-950/50 shadow-[0_4px_0_0_#d97706,0_0_16px_rgba(245,158,11,0.4)] text-amber-300 font-extrabold cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center relative overflow-hidden group-hover:border-amber-300"
            aria-label={node.title}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none" />
            <span className="text-2xl drop-shadow-md">👑</span>

            {/* Prominent Checkmark Badge */}
            <div className="absolute -bottom-1 -right-1 z-20 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-xs font-black shadow-md">
              ✓
            </div>
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-amber-400/50 bg-dh-card shadow-dh-soft">
          <span className="text-xs font-heading font-bold text-dh-text">
            {node.title}
          </span>
          {bestScore > 0 && (
            <span className="text-[10px] font-heading font-black text-amber-400 bg-amber-400/15 px-1.5 py-0.2 rounded-full border border-amber-400/30">
              {bestScore}%
            </span>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. LOCKED NODE (Frosted glass with lock icon)
  // ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{ transform: `translateX(${offset}px)` }}
      className="flex flex-col items-center relative my-2 select-none"
    >
      <div className="relative">
        <button
          disabled
          className="w-[76px] h-[76px] rounded-full backdrop-blur-md bg-white/[0.04] border-2 border-white/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.12)] text-slate-400 flex items-center justify-center text-2xl cursor-not-allowed opacity-60 transition-all"
          aria-label={`Locked ${node.title}`}
        >
          <span>🔒</span>
        </button>
      </div>
      <span className="mt-2.5 px-3 py-1 rounded-full border border-white/10 text-slate-500 text-xs font-heading font-bold bg-white/[0.02]">
        {node.title}
      </span>
    </div>
  );
};

const Journey = () => {
  const navigate = useNavigate();
  const { mode } = useAppMode();
  const { currentUser, refreshUser } = useContext(AuthContext);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [progress, setProgress] = useState({});
  const [coins, setCoins] = useState(0);
  const [streakFreeze, setStreakFreeze] = useState(0);
  const [activeNode, setActiveNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quizActive, setQuizActive] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizDone, setQuizDone] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [savedInSession, setSavedInSession] = useState(new Set());
  const [milestoneRewardClaimed, setMilestoneRewardClaimed] = useState(null);

  // Avatar URL for active node pin
  const userAvatarUrl = useMemo(() => {
    return getAvatarUrl(
      currentUser?.equippedAvatar || currentUser?.avatarSeed || currentUser?.username || 'default-seed'
    );
  }, [currentUser]);

  useEffect(() => {
    fetchData();
    setSelectedSubject(null);
  }, [mode]);

  const fetchData = async () => {
    try {
      const [subRes, progRes] = await Promise.all([
        api.get(`/api/journey/subjects?category=${mode}`),
        api.get('/api/journey/progress'),
      ]);
      if (subRes.data.success) setSubjects(subRes.data.data);
      if (progRes.data.success) {
        setProgress(progRes.data.data.progress || {});
        setCoins(progRes.data.data.coins || 0);
        setStreakFreeze(progRes.data.data.streakFreeze || 0);
      }
    } catch (err) {
      console.error('Failed to fetch journey data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectSelect = (subjectObj) => {
    setSelectedSubject(subjectObj);
    if (subjectObj.category === 'gs' && subjectObj.chapters) {
      const flatNodes = subjectObj.chapters.flatMap((c) => c.nodes);
      setNodes(flatNodes);
    } else {
      setNodes(subjectObj.nodes || []);
    }
    window.__journeySubject = subjectObj.subject;
  };

  const handleNodeClick = async (node) => {
    try {
      let url = `/api/questions/solo-practice?subject=${encodeURIComponent(selectedSubject.subject)}&nodeIndex=${node.nodeIndex}`;
      if (node.chapterName) {
        url += `&topic=${encodeURIComponent(node.chapterName)}`;
      }
      const res = await api.get(url);
      if (res.data.success && res.data.data.length > 0) {
        setActiveNode(node);
        setQuizQuestions(res.data.data);
        setQuizActive(true);
        setQIndex(0);
        setQuizScore(0);
        setQuizAnswers([]);
        setQuizAnswered(false);
        setQuizSelected(null);
        setQuizDone(false);
        setQuizResult(null);
        setMilestoneRewardClaimed(null);
      }
    } catch (err) {
      console.error('Failed to load practice questions:', err);
    }
  };

  const handleQuizAnswer = (key) => {
    if (quizAnswered) return;
    setQuizSelected(key);
    setQuizAnswered(true);

    const isCorrect = key.toLowerCase() === (quizQuestions[qIndex].correctOption || '').toLowerCase();
    setQuizAnswers((prev) => [
      ...prev,
      {
        questionId: quizQuestions[qIndex]._id,
        selectedOption: key.toUpperCase(),
        isCorrect,
      },
    ]);

    if (isCorrect) {
      setQuizScore((p) => p + 1);
      sounds.correct?.();
    } else {
      sounds.wrong?.();
    }
  };

  const handleQuizNext = () => {
    if (qIndex < quizQuestions.length - 1) {
      setQIndex((p) => p + 1);
      setQuizSelected(null);
      setQuizAnswered(false);
    } else {
      setQuizDone(true);
      const passScore = Math.ceil(quizQuestions.length * 0.7);
      setQuizResult(quizScore >= passScore);
    }
  };

  const handleComplete = async () => {
    if (completing || !activeNode) return;
    setCompleting(true);

    try {
      const res = await api.post('/api/journey/complete', {
        subject: selectedSubject.subject,
        nodeId: activeNode.nodeId,
        score: quizScore,
        totalQuestions: quizQuestions.length,
        answers: quizAnswers,
      });
      if (res.data.success) {
        const d = res.data.data;
        if (d.progress) setProgress(d.progress);
        if (typeof d.totalCoins === 'number') setCoins(d.totalCoins);
        if (typeof d.streakFreeze === 'number') setStreakFreeze(d.streakFreeze);
        if (d.streakShieldAwarded || d.isMilestone) {
          setMilestoneRewardClaimed({
            coins: d.coinsAwarded,
            streakShield: d.streakShieldAwarded,
          });
        }
        sounds.win();
        if (d.coinsAwarded > 0) setTimeout(() => sounds.coin(), 500);
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 3500);
        if (refreshUser) refreshUser();

        // Reset quiz state
        setQuizActive(false);
        setQuizQuestions([]);
        setQuizAnswers([]);
        setQuizDone(false);
        setQuizResult(null);
        setActiveNode(null);
      }
    } catch (err) {
      console.error('Failed to complete node:', err);
    } finally {
      setCompleting(false);
    }
  };

  const handleSaveJourneyQuestion = async (q) => {
    try {
      await api.post('/api/bookmarks', {
        questionId: q._id,
        questionText: q.questionText,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.solution || q.explanation || '',
        subject: selectedSubject?.subject || '',
      });
      setSavedInSession((prev) => {
        const s = new Set(prev);
        s.add(q._id || q.questionText);
        return s;
      });
    } catch (err) {
      console.error('Failed to save question:', err);
    }
  };

  const handleBack = () => {
    if (quizActive) {
      setQuizActive(false);
      setQuizDone(false);
      setQuizAnswers([]);
      setActiveNode(null);
      return;
    }
    if (selectedSubject) {
      setSelectedSubject(null);
      window.__journeySubject = null;
      return;
    }
    navigate('/dashboard');
  };

  const getNodeStatus = (node, index) => {
    const entry = progress[node.nodeId];
    if (entry?.status) return entry.status;
    if (index === 0) return 'available';
    const prev = nodes[index - 1];
    if (prev && progress[prev.nodeId]?.status === 'completed') return 'available';
    return 'locked';
  };

  // Find the primary current active node (the first available node)
  const currentActiveNodeId = useMemo(() => {
    const active = nodes.find((n, idx) => getNodeStatus(n, idx) === 'available');
    return active?.nodeId || null;
  }, [nodes, progress]);

  if (loading) {
    return <PageSkeleton blocks={4} />;
  }

  // ─────────────────────────────────────────────────────────────
  // QUIZ MODE (Active Question View)
  // ─────────────────────────────────────────────────────────────
  if (quizActive && quizQuestions.length > 0 && !quizDone) {
    const q = quizQuestions[qIndex];
    const correctLetter = (q.correctOption || '').toUpperCase();
    return (
      <div className="min-h-screen bg-dh-bg px-4 py-6">
        <div className="max-w-md mx-auto">
          <button onClick={handleBack} className="text-dh-text-muted font-heading font-bold text-sm mb-4 hover:text-dh-accent transition-colors">
            ← Back to Journey
          </button>
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-heading font-bold text-dh-text-muted uppercase">Question {qIndex + 1}/{quizQuestions.length}</span>
            <span className="text-sm font-heading font-bold text-dh-accent">Score: {quizScore}</span>
          </div>
          <div className="bg-dh-card rounded-2xl p-5 mb-4 border border-dh-border">
            <div className="flex justify-between items-start gap-2">
              <div className="text-base font-semibold text-dh-text flex-1">
                <Latex>{formatLatex(q.questionText)}</Latex>
              </div>
              {quizAnswered && (
                <button
                  onClick={() => handleSaveJourneyQuestion(q)}
                  disabled={savedInSession.has(q._id || q.questionText)}
                  className={`flex-shrink-0 text-2xl transition-all duration-200 ${savedInSession.has(q._id || q.questionText) ? 'text-dh-accent scale-110' : 'text-dh-text-muted hover:text-dh-accent hover:scale-110'}`}
                  title="Bookmark Question"
                >
                  {savedInSession.has(q._id || q.questionText) ? '★' : '☆'}
                </button>
              )}
            </div>
            {q.hasDiagram && q.diagramUrl && (
              <img src={q.diagramUrl} alt="Diagram" className="mt-3 max-h-36 rounded-lg object-contain bg-dh-surface" />
            )}
          </div>
          <div className="space-y-2.5">
            {Object.entries(q.options).map(([key, opt]) => {
              const optLetter = key.toUpperCase();

              let btnClass = 'border-dh-border bg-dh-card text-dh-text hover:border-dh-accent/60';
              if (quizAnswered) {
                if (optLetter === correctLetter) {
                  btnClass = 'border-dh-green bg-dh-green/10 text-dh-green font-heading font-bold';
                } else if (optLetter === quizSelected) {
                  btnClass = 'border-dh-red bg-dh-red/10 text-dh-red font-heading font-bold';
                } else {
                  btnClass = 'border-dh-border bg-dh-surface text-dh-text-muted opacity-50';
                }
              }
              return (
                <button
                  key={key}
                  onClick={() => handleQuizAnswer(optLetter)}
                  disabled={quizAnswered}
                  className={`w-full p-3.5 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${btnClass}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm ${quizAnswered && optLetter === correctLetter ? 'bg-dh-green text-black' : quizAnswered && optLetter === quizSelected ? 'bg-dh-red text-white' : 'bg-dh-surface text-dh-text-muted'}`}>
                    {key}
                  </span>
                  <span className="flex-1"><Latex>{formatLatex(opt)}</Latex></span>
                </button>
              );
            })}
          </div>
          {quizAnswered && (
            <button onClick={handleQuizNext} className="w-full mt-4 py-3 bg-dh-accent text-white rounded-xl font-heading font-bold text-lg hover:bg-dh-accent-light transition-all">
              {qIndex < quizQuestions.length - 1 ? 'Next →' : 'See Results'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // QUIZ RESULTS & LEVEL OUTCOME REVIEW
  // ─────────────────────────────────────────────────────────────
  if (quizDone) {
    const passScore = Math.ceil(quizQuestions.length * 0.7);
    const passed = quizScore >= passScore;
    const accuracyPct = Math.round((quizScore / quizQuestions.length) * 100);
    const earnedStars = getStarCount(accuracyPct);
    const isCurrentMilestone = activeNode?.isMilestone || (activeNode?.nodeIndex !== undefined && (activeNode.nodeIndex + 1) % 5 === 0);

    return (
      <div className="min-h-screen bg-dh-bg px-4 py-6 pb-28">
        <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="text-xs font-heading font-bold text-dh-text-muted hover:text-white flex items-center gap-1.5 transition-colors"
            >
              ← Back to Map
            </button>
            <span className="text-xs font-heading font-black text-dh-accent px-3 py-1 rounded-full bg-dh-card border border-dh-border">
              {selectedSubject?.subject} • Level Review
            </span>
          </div>

          {/* Level Outcome Hero Card */}
          <div className={`p-6 rounded-3xl border-2 text-center relative overflow-hidden shadow-2xl ${
            passed
              ? 'bg-gradient-to-br from-amber-500/20 via-dh-card to-emerald-950/40 border-amber-400/50'
              : 'bg-gradient-to-br from-dh-red/20 via-dh-card to-rose-950/40 border-dh-red/40'
          }`}>
            <div className="text-5xl mb-2 animate-bounce-subtle">{passed ? (isCurrentMilestone ? '🎁' : '🎉') : '😢'}</div>
            <h2 className="text-2xl font-heading font-black text-white mb-1">
              {passed ? (isCurrentMilestone ? 'Milestone Chest Cleared!' : 'Level Cleared!') : 'Not Quite!'}
            </h2>

            {/* Stars Display on Victory */}
            {passed && (
              <div className="flex justify-center my-3">
                <StarRating count={earnedStars} className="text-2xl gap-2" />
              </div>
            )}

            <p className="text-sm text-dh-text-muted mb-4">
              Score: {quizScore}/{quizQuestions.length} {passed ? `(Pass: ${passScore}) • ${accuracyPct}%` : `(Need: ${passScore}) • ${accuracyPct}%`}
            </p>

            {/* Milestone Bonus Callout */}
            {passed && isCurrentMilestone && (
              <div className="mb-5 p-3 rounded-2xl bg-amber-500/20 border-2 border-amber-400/60 max-w-sm mx-auto flex items-center justify-center gap-3">
                <span className="text-2xl animate-pulse">👑</span>
                <div className="text-left">
                  <p className="text-xs font-heading font-black text-amber-300 uppercase tracking-wider">Milestone Chest Reward</p>
                  <p className="text-xs font-bold text-white">🪙 +150 Coins & 🛡️ +1 Streak Shield</p>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              {passed ? (
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-black rounded-2xl font-heading font-black text-base hover:brightness-110 shadow-lg transition-all"
                >
                  {completing ? 'Claiming Reward...' : '🎁 Claim Reward & Continue'}
                </button>
              ) : (
                <button
                  onClick={handleBack}
                  className="w-full sm:w-auto px-8 py-3.5 bg-dh-accent text-white rounded-2xl font-heading font-bold text-base hover:bg-dh-accent-light transition-all"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>

          {/* Detailed Question Review & Solutions */}
          <div className="space-y-4 pt-2">
            <h3 className="text-lg font-heading font-black text-white flex items-center gap-2">
              <span>📖</span> Question Review & Solutions
            </h3>

            <div className="space-y-4">
              {quizQuestions.map((q, idx) => {
                const userAnsObj = quizAnswers[idx] || quizAnswers.find((a) => a.questionId === q._id);
                const userOpt = userAnsObj?.selectedOption || null;
                const correctOpt = (q.correctOption || '').toUpperCase();
                const isUserCorrect = userOpt && correctOpt && userOpt.toLowerCase() === correctOpt.toLowerCase();
                const isSaved = savedInSession.has(q._id || q.questionText);

                return (
                  <div key={idx} className="bg-dh-card rounded-2xl p-5 border border-dh-border shadow-lg space-y-4 text-left">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 text-sm sm:text-base font-semibold text-dh-text leading-relaxed">
                        <span className="text-dh-text-muted mr-2 font-heading font-bold">{idx + 1}.</span>
                        <LatexRenderer text={q.questionText} />
                      </div>
                      <button
                        onClick={() => handleSaveJourneyQuestion(q)}
                        disabled={isSaved}
                        className={`flex-shrink-0 px-3 py-1 rounded-full border text-xs font-heading font-bold transition-all ${
                          isSaved
                            ? 'border-dh-accent text-dh-accent bg-dh-accent/10'
                            : 'border-dh-border text-dh-text-muted hover:border-dh-accent hover:text-white'
                        }`}
                      >
                        {isSaved ? '★ Saved' : '☆ Save'}
                      </button>
                    </div>

                    {q.hasDiagram && q.diagramUrl && (
                      <div className="my-2 flex justify-center">
                        <img src={q.diagramUrl} alt="Diagram" className="max-h-52 rounded-xl border border-dh-border" />
                      </div>
                    )}

                    {/* Options list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(q.options || {}).map(([key, opt]) => {
                        const optLetter = key.toUpperCase();
                        const isThisCorrect = optLetter === correctOpt;
                        const isThisUserSelection = optLetter === userOpt;

                        let optClass = 'bg-dh-surface border-dh-border text-dh-text-muted';
                        if (isThisCorrect) {
                          optClass = 'bg-dh-green/15 border-dh-green text-dh-green font-bold';
                        } else if (isThisUserSelection && !isUserCorrect) {
                          optClass = 'bg-dh-red/15 border-dh-red text-dh-red font-bold';
                        }

                        return (
                          <div key={key} className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${optClass}`}>
                            <span className="font-heading font-black text-xs">{optLetter}.</span>
                            <span className="flex-1 text-xs"><LatexRenderer text={opt} /></span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Answer Strip */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-dh-surface text-xs font-heading font-bold">
                      <div>
                        <span className="text-dh-text-muted uppercase mr-2">Your Answer:</span>
                        <span className={isUserCorrect ? 'text-dh-green' : 'text-dh-red'}>
                          {userOpt || 'No Answer'} {isUserCorrect ? '✓' : '✗'}
                        </span>
                      </div>
                      {!isUserCorrect && (
                        <div>
                          <span className="text-dh-text-muted uppercase mr-2">Correct:</span>
                          <span className="text-dh-green">{correctOpt}</span>
                        </div>
                      )}
                    </div>

                    {/* Step-by-Step Explanation */}
                    <div className="p-4 rounded-xl bg-dh-surface/90 border-l-4 border-dh-accent space-y-1">
                      <p className="text-xs font-heading font-black text-dh-accent uppercase tracking-wider">
                        💡 Step-by-Step Solution:
                      </p>
                      <div className="text-sm text-dh-text">
                        <LatexRenderer text={q.solution || q.explanation || 'No explanation available.'} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SUBJECT SELECTOR GRID
  // ─────────────────────────────────────────────────────────────
  if (!selectedSubject) {
    return (
      <div className="min-h-screen bg-dh-bg pb-28 px-4 pt-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-heading font-black text-dh-text">Your Journey</h1>
              <p className="text-dh-text-muted text-sm">Master subjects one level at a time</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Coins Counter */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dh-card border-2 border-dh-border">
                <span className="text-base">🪙</span>
                <span className="font-heading font-black text-dh-yellow text-sm"><AnimatedNumber value={coins} /></span>
              </div>
              {/* Streak Shields Counter */}
              {streakFreeze > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dh-card border-2 border-cyan-500/40">
                  <span className="text-base">🛡️</span>
                  <span className="font-heading font-black text-cyan-300 text-sm"><AnimatedNumber value={streakFreeze} /></span>
                </div>
              )}
            </div>
          </div>
          <div className="mb-6">
            <ModeToggle />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {subjects.map((sub, idx) => {
              const meta = SUBJECT_META[sub.subject] || { icon: '📖', gradient: 'from-zinc-600 to-zinc-800' };
              const subNodes = sub.category === 'gs' && sub.chapters ? sub.chapters.flatMap((c) => c.nodes) : (sub.nodes || []);
              const total = subNodes.length;
              const completed = subNodes.filter((n) => progress[n.nodeId]?.status === 'completed').length;
              const pct = total > 0 ? (completed / total) * 100 : 0;
              const label = completed === 0 ? 'START' : completed === total ? 'MASTERED' : 'CONTINUE';
              return (
                <button
                  key={idx}
                  onClick={() => handleSubjectSelect(sub)}
                  className="bg-dh-card rounded-2xl p-5 border-2 border-b-4 border-dh-border hover:border-dh-accent/50 text-left transition-all active:translate-y-[2px] active:border-b-2 group relative overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${meta.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.gradient} border-b-4 border-black/30 flex items-center justify-center text-2xl shadow-lg`}>
                      {meta.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-heading font-bold text-dh-text text-lg">{sub.subject}</h3>
                      <p className="text-dh-text-muted text-xs mt-0.5">{sub.totalQuestions} questions</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 h-2.5 bg-dh-surface rounded-full overflow-hidden border border-dh-border/50">
                          <div className="h-full bg-dh-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-heading font-bold text-dh-text-muted">{completed}/{total}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-heading font-black tracking-widest px-2.5 py-1 rounded-lg border-2 ${label === 'MASTERED'
                        ? 'text-dh-yellow border-dh-yellow/50 bg-dh-yellow/10'
                        : 'text-dh-accent border-dh-accent/40 bg-dh-accent/10'
                      }`}>
                      {label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // DUOLINGO-STYLE JOURNEY MAP (Subject Selected)
  // ─────────────────────────────────────────────────────────────
  const meta = SUBJECT_META[selectedSubject.subject] || { icon: '📖', gradient: 'from-zinc-600 to-zinc-800' };
  const completedCount = nodes.filter((n) => progress[n.nodeId]?.status === 'completed').length;
  const allDone = nodes.length > 0 && completedCount === nodes.length;

  return (
    <div className="min-h-screen bg-dh-bg flex flex-col font-sans">
      {celebrate && <Confetti />}

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-dh-bg/90 backdrop-blur-md border-b-2 border-dh-border">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={handleBack}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-dh-card border-2 border-b-4 border-dh-border text-dh-text-muted font-bold hover:text-dh-text active:border-b-2 active:translate-y-[2px] transition-all"
          >
            ←
          </button>
          <span className="font-heading font-black text-dh-text uppercase tracking-wide text-sm truncate max-w-[180px]">
            {selectedSubject.subject}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dh-card border-2 border-dh-border">
              <span className="text-base">🪙</span>
              <span className="font-heading font-black text-dh-yellow text-sm"><AnimatedNumber value={coins} /></span>
            </div>
            {streakFreeze > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-dh-card border-2 border-cyan-500/40" title="Streak Shields available">
                <span className="text-sm">🛡️</span>
                <span className="font-heading font-black text-cyan-300 text-xs"><AnimatedNumber value={streakFreeze} /></span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-md mx-auto px-4">
        {/* Subject Header Banner */}
        <div className={`mt-4 rounded-2xl bg-gradient-to-r ${meta.gradient} border-b-4 border-black/40 p-5 flex items-center justify-between shadow-lg`}>
          <div>
            <p className="text-[11px] font-heading font-black text-white/70 uppercase tracking-widest">{selectedSubject.totalQuestions} Questions</p>
            <h1 className="text-xl font-heading font-black text-white">{selectedSubject.subject}</h1>
            <p className="text-xs font-bold text-white/80 mt-1">{completedCount}/{nodes.length} levels completed</p>
          </div>
          <div className="text-4xl drop-shadow-lg">{meta.icon}</div>
        </div>

        {/* ── GS Chapter-Based Journey ── */}
        {selectedSubject.category === 'gs' && selectedSubject.chapters ? (
          <div className="flex flex-col gap-10 pt-8 pb-32">
            {selectedSubject.chapters.map((chapter, chapIdx) => {
              const firstNodeOfChap = chapter.nodes[0];
              const flatIndex = nodes.findIndex((n) => n.nodeId === firstNodeOfChap?.nodeId);
              const status = firstNodeOfChap ? getNodeStatus(firstNodeOfChap, flatIndex) : 'locked';
              const isLocked = status === 'locked';

              const chapCompleted = chapter.nodes.filter((n) => progress[n.nodeId]?.status === 'completed').length;
              const allChapDone = chapter.nodes.length > 0 && chapCompleted === chapter.nodes.length;

              return (
                <div key={chapIdx} className={`transition-opacity duration-300 ${isLocked ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                  <div className={`relative rounded-2xl border-2 mb-6 p-4 bg-dh-card overflow-hidden ${allChapDone ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : isLocked ? 'border-dh-border' : 'border-dh-accent/50'}`}>
                    {allChapDone && <div className="absolute inset-0 bg-amber-400/10" />}
                    <h2 className="relative z-10 text-sm font-heading font-black text-dh-text-muted uppercase tracking-widest mb-1">Chapter {chapIdx + 1}</h2>
                    <h3 className="relative z-10 text-xl font-heading font-black text-dh-text">{chapter.chapterName}</h3>
                    <div className="relative z-10 flex items-center justify-between mt-1">
                      <p className="text-xs font-bold text-dh-text-muted">{chapCompleted}/{chapter.nodes.length} levels completed</p>
                      {allChapDone && <span className="px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider">Mastered</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-7">
                    {chapter.nodes.map((node, nodeIdx) => {
                      const overallIdx = nodes.findIndex((n) => n.nodeId === node.nodeId);
                      const nodeStatus = getNodeStatus(node, overallIdx);
                      const best = progress[node.nodeId]?.bestScore || 0;
                      const isCurrentActive = node.nodeId === currentActiveNodeId;

                      return (
                        <JourneyNode
                          key={node.nodeId}
                          node={node}
                          index={nodeIdx}
                          status={nodeStatus}
                          bestScore={best}
                          isCurrentActive={isCurrentActive}
                          avatarUrl={userAvatarUrl}
                          onClick={() => nodeStatus !== 'locked' && handleNodeClick(node)}
                        />
                      );
                    })}

                    {/* Chapter Trophy Finish */}
                    <div className="flex flex-col items-center mt-2">
                      <div className={`flex items-center justify-center w-[64px] h-[64px] rounded-full border-b-4 text-3xl shadow-lg ${allChapDone
                          ? 'bg-amber-400 border-amber-600 animate-bounce-subtle shadow-[0_0_20px_rgba(251,191,36,0.5)]'
                          : 'bg-dh-card border-dh-border grayscale opacity-60'
                        }`}>
                        🏆
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Standard Subject Winding Path ── */
          <div className="flex flex-col items-center gap-7 pt-12 pb-32">
            {nodes.map((node, index) => {
              const nodeStatus = getNodeStatus(node, index);
              const best = progress[node.nodeId]?.bestScore || 0;
              const isCurrentActive = node.nodeId === currentActiveNodeId;

              return (
                <JourneyNode
                  key={node.nodeId}
                  node={node}
                  index={index}
                  status={nodeStatus}
                  bestScore={best}
                  isCurrentActive={isCurrentActive}
                  avatarUrl={userAvatarUrl}
                  onClick={() => nodeStatus !== 'locked' && handleNodeClick(node)}
                />
              );
            })}

            {/* Subject Mastered Trophy Finish Node */}
            <div className="flex flex-col items-center mt-4">
              <div className={`flex items-center justify-center w-[76px] h-[76px] rounded-full border-b-8 text-3xl shadow-xl transition-all ${allDone
                  ? 'bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 border-amber-600 animate-bounce-subtle shadow-[0_0_25px_rgba(251,191,36,0.6)]'
                  : 'backdrop-blur-md bg-white/[0.04] border-2 border-white/10 grayscale opacity-60'
                }`}>
                🏆
              </div>
              <span className="mt-3 text-xs font-heading font-black uppercase tracking-widest text-dh-text-muted">
                {allDone ? '🌟 Subject Mastered! 🌟' : 'Finish all levels'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Journey;
