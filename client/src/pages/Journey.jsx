import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import Latex from 'react-latex-next';
import { useAppMode } from '../context/AppModeContext';
import ModeToggle from '../components/ModeToggle';
import Confetti from '../components/Confetti';
import AnimatedNumber from '../components/AnimatedNumber';
import PageSkeleton from '../components/PageSkeleton';
import { sounds } from '../utils/sound';

const SUBJECT_META = {
  'Fluid Mechanics': { icon: '🌊', gradient: 'from-cyan-500 to-blue-700' },
  'Soil Mechanics': { icon: '⛰️', gradient: 'from-amber-500 to-orange-700' },
  'Structural Analysis': { icon: '🏗️', gradient: 'from-purple-500 to-indigo-700' },
  'General Studies': { icon: '📚', gradient: 'from-emerald-500 to-teal-700' },
  'Building Materials': { icon: '🧱', gradient: 'from-rose-500 to-red-700' },
  'Highway Engineering': { icon: '🛣️', gradient: 'from-slate-500 to-gray-700' },
  'Irrigation Engineering': { icon: '🌾', gradient: 'from-lime-500 to-green-700' },
  'Environmental Engineering': { icon: '🌿', gradient: 'from-teal-500 to-emerald-700' },
};

// Winding horizontal offsets for the Duolingo-style path (in px)
const PATH_OFFSETS = [0, 52, 84, 52, 0, -52, -84, -52];

const Journey = () => {
  const navigate = useNavigate();
  const { mode } = useAppMode();
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [progress, setProgress] = useState({});
  const [coins, setCoins] = useState(0);
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
      }
    } catch (err) {
      console.error('Failed to fetch journey data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectSelect = (subjectObj) => {
    setSelectedSubject(subjectObj);
    setNodes(subjectObj.nodes || []);
    window.__journeySubject = subjectObj.subject;
  };

  const handleNodeClick = async (node) => {
    try {
      // Journey mode: fetch deterministic batch by subject + nodeIndex
      const res = await api.get(
        `/api/questions/solo-practice?subject=${encodeURIComponent(selectedSubject.subject)}&nodeIndex=${node.nodeIndex}`
      );
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
    setQuizAnswers(prev => [...prev, {
      questionId: quizQuestions[qIndex]._id,
      isCorrect
    }]);

    if (isCorrect) {
      setQuizScore(p => p + 1);
    }
  };

  const handleQuizNext = () => {
    if (qIndex < quizQuestions.length - 1) {
      setQIndex(p => p + 1);
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
        answers: quizAnswers
      });
      if (res.data.success) {
        const d = res.data.data;
        if (d.progress) setProgress(d.progress);
        if (typeof d.totalCoins === 'number') setCoins(d.totalCoins);
        sounds.win();
        if (d.coinsAwarded > 0) setTimeout(() => sounds.coin(), 500);
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 3200);
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

  if (loading) {
    return <PageSkeleton blocks={4} />;
  }

  // Quiz Mode
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
            <div className="text-base font-semibold text-dh-text">
              <Latex>{q.questionText}</Latex>
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
                  <span className="flex-1"><Latex>{opt}</Latex></span>
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

  // Quiz Results
  if (quizDone) {
    const passScore = Math.ceil(quizQuestions.length * 0.7);
    const passed = quizScore >= passScore;
    return (
      <div className="min-h-screen bg-dh-bg px-4 py-6 flex items-center justify-center">
        <div className="max-w-sm w-full bg-dh-card rounded-3xl p-6 border border-dh-border text-center">
          <div className="text-5xl mb-4">{passed ? '🎉' : '😢'}</div>
          <h2 className="text-2xl font-heading font-black text-dh-text mb-2">{passed ? 'Node Complete!' : 'Not Quite!'}</h2>
          <p className="text-dh-text-muted text-sm mb-6">
            Score: {quizScore}/{quizQuestions.length} {passed ? `(Pass: ${passScore})` : `(Need: ${passScore})`}
          </p>
          {passed ? (
            <button onClick={handleComplete} disabled={completing} className="w-full py-3 bg-dh-secondary text-black rounded-xl font-heading font-bold text-lg hover:bg-dh-secondary-light transition-all">
              {completing ? 'Claiming Reward...' : '🎁 Claim Reward'}
            </button>
          ) : (
            <button onClick={handleBack} className="w-full py-3 bg-dh-accent text-white rounded-xl font-heading font-bold text-lg hover:bg-dh-accent-light transition-all">
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Subject Grid (no subject selected)
  if (!selectedSubject) {
    return (
      <div className="min-h-screen bg-dh-bg pb-28 px-4 pt-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-heading font-black text-dh-text">Your Journey</h1>
              <p className="text-dh-text-muted text-sm">Master subjects one level at a time</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dh-card border-2 border-dh-border">
              <span className="text-base">🪙</span>
              <span className="font-heading font-black text-dh-yellow text-sm"><AnimatedNumber value={coins} /></span>
            </div>
          </div>
          <div className="mb-6">
            <ModeToggle />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {subjects.map((sub, idx) => {
              const meta = SUBJECT_META[sub.subject] || { icon: '📖', gradient: 'from-zinc-600 to-zinc-800' };
              const total = (sub.nodes || []).length;
              const completed = (sub.nodes || []).filter(n => progress[n.nodeId]?.status === 'completed').length;
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
                    <span className={`text-[10px] font-heading font-black tracking-widest px-2.5 py-1 rounded-lg border-2 ${
                      label === 'MASTERED'
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

  // Duolingo-style winding path (subject selected)
  const meta = SUBJECT_META[selectedSubject.subject] || { icon: '📖', gradient: 'from-zinc-600 to-zinc-800' };
  const completedCount = nodes.filter(n => progress[n.nodeId]?.status === 'completed').length;
  const allDone = nodes.length > 0 && completedCount === nodes.length;

  return (
    <div className="min-h-screen bg-dh-bg flex flex-col font-sans">
      {celebrate && <Confetti />}
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-dh-bg/90 backdrop-blur-md border-b-2 border-dh-border">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={handleBack}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-dh-card border-2 border-b-4 border-dh-border text-dh-text-muted font-bold hover:text-dh-text active:border-b-2 active:translate-y-[2px] transition-all"
          >
            ←
          </button>
          <span className="font-heading font-black text-dh-text uppercase tracking-wide text-sm">
            {selectedSubject.subject}
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dh-card border-2 border-dh-border">
            <span className="text-base">🪙</span>
            <span className="font-heading font-black text-dh-yellow text-sm"><AnimatedNumber value={coins} /></span>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-md mx-auto px-4">
        {/* Unit banner */}
        <div className={`mt-4 rounded-2xl bg-gradient-to-r ${meta.gradient} border-b-4 border-black/40 p-5 flex items-center justify-between shadow-lg`}>
          <div>
            <p className="text-[11px] font-heading font-black text-white/70 uppercase tracking-widest">{selectedSubject.totalQuestions} Questions</p>
            <h1 className="text-xl font-heading font-black text-white">{selectedSubject.subject}</h1>
            <p className="text-xs font-bold text-white/80 mt-1">{completedCount}/{nodes.length} levels completed</p>
          </div>
          <div className="text-4xl drop-shadow-lg">{meta.icon}</div>
        </div>

        {/* Winding path */}
        <div className="flex flex-col items-center gap-7 pt-12 pb-32">
          {nodes.map((node, index) => {
            const status = getNodeStatus(node, index);
            const best = progress[node.nodeId]?.bestScore || 0;
            const offset = PATH_OFFSETS[index % PATH_OFFSETS.length];

            let btnClass = 'relative z-10 flex items-center justify-center w-[76px] h-[76px] rounded-full text-3xl font-extrabold transition-all duration-100 ';
            if (status === 'completed') {
              btnClass += 'bg-dh-yellow border-b-8 border-dh-yellow-dark text-white cursor-pointer hover:translate-y-[2px] hover:border-b-4 active:translate-y-[4px] active:border-b-0';
            } else if (status === 'available') {
              btnClass += 'bg-dh-accent border-b-8 border-dh-accent-dark text-white cursor-pointer hover:translate-y-[2px] hover:border-b-4 active:translate-y-[4px] active:border-b-0';
            } else {
              btnClass += 'bg-dh-card border-b-8 border-dh-border text-dh-muted cursor-not-allowed';
            }

            return (
              <div key={node.nodeId} style={{ transform: `translateX(${offset}px)` }} className="flex flex-col items-center">
                <div className="relative">
                  {status === 'available' && (
                    <>
                      <div className="absolute -inset-2 rounded-full border-4 border-dh-accent/30 animate-pulse pointer-events-none" />
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-20 bg-dh-card border-2 border-dh-border rounded-xl px-3 py-1 text-[10px] font-heading font-black text-dh-accent uppercase tracking-widest whitespace-nowrap animate-bounce-subtle shadow-dh-soft">
                        Start
                      </div>
                    </>
                  )}
                  {status === 'completed' && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl z-20 drop-shadow-md">👑</div>
                  )}
                  <button
                    onClick={() => status !== 'locked' && handleNodeClick(node)}
                    disabled={status === 'locked'}
                    className={btnClass}
                    aria-label={node.title}
                  >
                    {status === 'locked' ? '🔒' : status === 'completed' ? '⭐' : '▶'}
                  </button>
                  {status === 'completed' && best > 0 && (
                    <div className="absolute -bottom-1 -right-2 z-20 bg-dh-card border-2 border-dh-yellow rounded-full px-1.5 py-0.5 text-[9px] font-heading font-black text-dh-yellow">
                      {best}%
                    </div>
                  )}
                </div>
                <span className={`mt-3 px-3 py-1 rounded-full border-2 text-xs font-heading font-bold ${
                  status === 'locked'
                    ? 'border-dh-border/60 text-dh-muted bg-transparent'
                    : 'border-dh-border text-dh-text bg-dh-card shadow-dh-soft'
                }`}>
                  {node.title}
                </span>
              </div>
            );
          })}

          {/* Trophy finish node */}
          <div className="flex flex-col items-center mt-2">
            <div className={`flex items-center justify-center w-[76px] h-[76px] rounded-full border-b-8 text-3xl ${
              allDone
                ? 'bg-dh-yellow border-dh-yellow-dark animate-bounce-subtle'
                : 'bg-dh-card border-dh-border grayscale opacity-60'
            }`}>
              🏆
            </div>
            <span className="mt-3 text-xs font-heading font-black uppercase tracking-widest text-dh-text-muted">
              {allDone ? 'Subject Mastered!' : 'Finish all levels'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Journey;
