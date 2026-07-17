import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Latex from 'react-latex-next';
import { AuthContext } from '../context/AuthContext';
import MapOfIndia from '../components/IndiaMap';
import Confetti from '../components/Confetti';
import AnimatedNumber from '../components/AnimatedNumber';
import PageSkeleton from '../components/PageSkeleton';
import { sounds } from '../utils/sound';
import { formatLatex } from '../utils/latex';

const formatTimeLeft = (until) => {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const MapOfIndiaPage = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [states, setStates] = useState([]);
  const [conqueredCount, setConqueredCount] = useState(0);
  const [totalStates, setTotalStates] = useState(0);
  const [myConquests, setMyConquests] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [coins, setCoins] = useState(0);
  const [pendingTribute, setPendingTribute] = useState(0);
  const [tab, setTab] = useState('map');
  const [leaderboard, setLeaderboard] = useState([]);
  const [celebrate, setCelebrate] = useState(false);

  // --- Quiz overlay state ---
  const [quizMode, setQuizMode] = useState(null); // 'siege' | 'raid' | 'maintain' | null
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizDifficulty, setQuizDifficulty] = useState(null);
  const [quizStateId, setQuizStateId] = useState(null);
  const [quizStateName, setQuizStateName] = useState('');
  const [qIndex, setQIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizTimer, setQuizTimer] = useState(0);
  const [quizResult, setQuizResult] = useState(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  // Raid-specific
  const [raidRounds, setRaidRounds] = useState([]);
  const [raidCurrentRound, setRaidCurrentRound] = useState(0);
  const [raidRoundAnswers, setRaidRoundAnswers] = useState([]);
  const [raidCastleLevel, setRaidCastleLevel] = useState(0);

  useEffect(() => { fetchMapData(); }, []);
  useEffect(() => { if (tab === 'empires') fetchLeaderboard(); }, [tab]);

  const fetchMapData = async () => {
    try {
      const res = await api.get('/api/map/states');
      setStates(res.data.data);
      setConqueredCount(res.data.conqueredCount);
      setTotalStates(res.data.totalStates);
      setMyConquests(res.data.myConquests || []);
      setCoins(res.data.coins || 0);
      setPendingTribute(res.data.pendingTribute || 0);
    } catch (err) {
      console.error('Failed to fetch map data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/api/map/leaderboard');
      setLeaderboard(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  const flashMsg = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3500);
  };

  const handleCollectTribute = async () => {
    try {
      const res = await api.post('/api/map/tribute', {});
      flashMsg(res.data.message);
      sounds.coin();
      setCoins(res.data.coins);
      setPendingTribute(0);
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Nothing to collect');
    }
  };

  const handleUpgrade = async () => {
    try {
      const res = await api.post('/api/map/upgrade', { stateId: selectedState.id });
      flashMsg(res.data.message);
      sounds.coin();
      setCoins(res.data.coins);
      setSelectedState(null);
      fetchMapData();
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Upgrade failed');
    }
  };

  const handleAttack = () => {
    const mode = selectedState.subject === 'General Studies' ? 'gs' : 'tech';
    navigate(`/dashboard?quickMatch=${selectedState.subject}&mode=${mode}&targetState=${selectedState.id}`);
  };

  // ============================================================
  // SIEGE
  // ============================================================
  const handleStartSiege = async () => {
    try {
      sounds.siege();
      const res = await api.post('/api/map/siege/start', { stateId: selectedState.id });
      if (res.data.success) {
        setQuizMode('siege');
        setQuizQuestions(res.data.questions);
        setQuizDifficulty(res.data.difficulty);
        setQuizStateId(res.data.stateId);
        setQuizStateName(res.data.stateName);
        setQIndex(0);
        setQuizAnswers([]);
        setQuizSelected(null);
        setQuizAnswered(false);
        setQuizResult(null);
        setQuizTimer(res.data.difficulty.timePerQuestion || 0);
        setSelectedState(null);
      }
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to start siege');
    }
  };

  const handleCompleteSiege = async (allAnswers) => {
    setQuizSubmitting(true);
    try {
      const res = await api.post('/api/map/siege/complete', {
        stateId: quizStateId,
        answers: allAnswers,
      });
      setQuizResult(res.data);
      if (res.data.passed) {
        sounds.capture();
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 3200);
      } else {
        sounds.damage();
      }
      fetchMapData();
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Siege completion failed');
      setQuizMode(null);
    } finally {
      setQuizSubmitting(false);
    }
  };

  // ============================================================
  // RAID
  // ============================================================
  const handleStartRaid = async () => {
    try {
      sounds.siege();
      const res = await api.post('/api/map/raid/start', { stateId: selectedState.id });
      if (res.data.success) {
        setQuizMode('raid');
        setRaidRounds(res.data.rounds);
        setRaidCurrentRound(0);
        setRaidRoundAnswers([]);
        setRaidCastleLevel(res.data.castleLevel);
        setQuizStateId(res.data.stateId);
        setQuizStateName(res.data.stateName);
        // Load first round
        setQuizQuestions(res.data.rounds[0].questions);
        setQIndex(0);
        setQuizAnswers([]);
        setQuizSelected(null);
        setQuizAnswered(false);
        setQuizResult(null);
        setQuizTimer(0);
        setSelectedState(null);
      }
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to start raid');
    }
  };

  const handleCompleteRaid = async (allRoundAnswers) => {
    setQuizSubmitting(true);
    try {
      const res = await api.post('/api/map/raid/complete', {
        stateId: quizStateId,
        roundResults: allRoundAnswers.map(answers => ({ answers })),
      });
      setQuizResult(res.data);
      if (res.data.captured) {
        sounds.capture();
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 3200);
      } else {
        sounds.damage();
      }
      fetchMapData();
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Raid completion failed');
      setQuizMode(null);
    } finally {
      setQuizSubmitting(false);
    }
  };

  // ============================================================
  // MAINTAIN
  // ============================================================
  const handleStartMaintain = async () => {
    try {
      sounds.maintain();
      const res = await api.post('/api/map/maintain', { stateId: selectedState.id, action: 'start' });
      if (res.data.success) {
        setQuizMode('maintain');
        setQuizQuestions(res.data.questions);
        setQuizStateId(res.data.stateId);
        setQuizStateName(res.data.stateName);
        setQIndex(0);
        setQuizAnswers([]);
        setQuizSelected(null);
        setQuizAnswered(false);
        setQuizResult(null);
        setQuizDifficulty(null);
        setQuizTimer(0);
        setSelectedState(null);
      }
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Failed to start maintenance');
    }
  };

  const handleCompleteMaintain = async (allAnswers) => {
    setQuizSubmitting(true);
    try {
      const res = await api.post('/api/map/maintain', {
        stateId: quizStateId,
        action: 'complete',
        answers: allAnswers,
      });
      setQuizResult(res.data);
      if (res.data.passed) {
        sounds.maintain();
      } else {
        sounds.wrong();
      }
      fetchMapData();
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Maintenance failed');
      setQuizMode(null);
    } finally {
      setQuizSubmitting(false);
    }
  };

  // ============================================================
  // Shared quiz answer handler
  // ============================================================
  const handleAnswer = (key) => {
    if (quizAnswered) return;
    setQuizSelected(key);
    setQuizAnswered(true);
    sounds.click();

    const newAnswers = [...quizAnswers, {
      questionId: quizQuestions[qIndex]._id,
      selectedOption: key,
    }];
    setQuizAnswers(newAnswers);
  };

  const handleNext = () => {
    if (qIndex < quizQuestions.length - 1) {
      setQIndex(p => p + 1);
      setQuizSelected(null);
      setQuizAnswered(false);
      // Reset timer for siege mode
      if (quizMode === 'siege' && quizDifficulty?.timePerQuestion) {
        setQuizTimer(quizDifficulty.timePerQuestion);
      }
    } else {
      // Quiz finished for this batch
      if (quizMode === 'siege') {
        handleCompleteSiege(quizAnswers);
      } else if (quizMode === 'maintain') {
        handleCompleteMaintain(quizAnswers);
      } else if (quizMode === 'raid') {
        // Save this round's answers
        const updatedRoundAnswers = [...raidRoundAnswers, quizAnswers];
        setRaidRoundAnswers(updatedRoundAnswers);

        if (raidCurrentRound < raidRounds.length - 1) {
          // Next round
          const nextRound = raidCurrentRound + 1;
          setRaidCurrentRound(nextRound);
          setQuizQuestions(raidRounds[nextRound].questions);
          setQIndex(0);
          setQuizAnswers([]);
          setQuizSelected(null);
          setQuizAnswered(false);
        } else {
          // All rounds done
          handleCompleteRaid(updatedRoundAnswers);
        }
      }
    }
  };

  // Siege timer effect
  useEffect(() => {
    if (quizMode !== 'siege' || !quizDifficulty?.timePerQuestion || quizAnswered || quizResult) return;
    if (quizTimer <= 0) {
      // Auto-submit wrong answer on timeout
      handleAnswer(null);
      return;
    }
    const t = setTimeout(() => setQuizTimer(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [quizTimer, quizMode, quizDifficulty, quizAnswered, quizResult]);

  const exitQuiz = () => {
    setQuizMode(null);
    setQuizResult(null);
    setQuizQuestions([]);
    setRaidRounds([]);
    setRaidRoundAnswers([]);
  };

  if (loading) return <PageSkeleton blocks={3} />;

  // ============================================================
  // QUIZ OVERLAY (Siege / Raid / Maintain)
  // ============================================================
  if (quizMode && quizQuestions.length > 0 && !quizResult) {
    const q = quizQuestions[qIndex];
    const correctLetter = ''; // Don't reveal during quiz
    const modeLabel = quizMode === 'siege' ? '⚔️ Siege Challenge'
      : quizMode === 'raid' ? `🏰 Raid — Round ${raidCurrentRound + 1}/${raidRounds.length}`
      : '🔧 Maintenance';
    const diffLabel = quizMode === 'siege' && quizDifficulty
      ? `Castle Defense Lv${quizDifficulty.castleLevel} · ${quizDifficulty.requiredCorrect}/5 to pass${quizDifficulty.timePerQuestion ? ` · ${quizDifficulty.timePerQuestion}s/question` : ''}`
      : quizMode === 'raid' ? `4/5 correct per round to breach`
      : '2/3 correct to maintain';

    return (
      <div className="min-h-screen bg-dh-bg px-4 py-6">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <button onClick={exitQuiz} className="text-dh-text-muted font-heading font-bold text-sm mb-3 hover:text-dh-accent transition-colors">
            ← Abandon {quizMode === 'raid' ? 'Raid' : quizMode === 'maintain' ? 'Maintenance' : 'Siege'}
          </button>

          <div className="bg-dh-card rounded-2xl border-2 border-b-4 border-dh-border p-4 mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-heading font-black text-dh-accent uppercase tracking-wide">{modeLabel}</span>
              <span className="text-xs font-heading font-bold text-dh-text-muted">
                {quizStateName}
              </span>
            </div>
            <p className="text-[11px] font-bold text-dh-text-muted">{diffLabel}</p>
          </div>

          {/* Progress + Timer */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-heading font-bold text-dh-text-muted uppercase">
              Question {qIndex + 1}/{quizQuestions.length}
            </span>
            {quizMode === 'siege' && quizDifficulty?.timePerQuestion > 0 && (
              <span className={`text-sm font-heading font-black px-3 py-1 rounded-xl border-2 ${
                quizTimer <= 5
                  ? 'text-dh-red border-dh-red/50 bg-dh-red/10 animate-pulse'
                  : 'text-dh-text border-dh-border bg-dh-card'
              }`}>
                ⏱ {quizTimer}s
              </span>
            )}
          </div>

          {/* Question */}
          <div className="bg-dh-card rounded-2xl p-5 mb-4 border border-dh-border">
            <div className="text-base font-semibold text-dh-text">
              <Latex>{formatLatex(q.questionText)}</Latex>
            </div>
            {q.hasDiagram && q.diagramUrl && (
              <img src={q.diagramUrl} alt="Diagram" className="mt-3 max-h-36 rounded-lg object-contain bg-dh-surface" />
            )}
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {Object.entries(q.options).map(([key, opt]) => {
              const optLetter = key.toUpperCase();
              let btnClass = 'border-dh-border bg-dh-card text-dh-text hover:border-dh-accent/60';
              if (quizAnswered) {
                if (optLetter === quizSelected) {
                  btnClass = 'border-dh-yellow bg-dh-yellow/10 text-dh-yellow font-heading font-bold';
                } else {
                  btnClass = 'border-dh-border bg-dh-surface text-dh-text-muted opacity-50';
                }
              }
              return (
                <button
                  key={key}
                  onClick={() => handleAnswer(optLetter)}
                  disabled={quizAnswered}
                  className={`w-full p-3.5 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${btnClass}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm ${
                    quizAnswered && optLetter === quizSelected
                      ? 'bg-dh-yellow text-black'
                      : 'bg-dh-surface text-dh-text-muted'
                  }`}>
                    {key}
                  </span>
                  <span className="flex-1"><Latex>{formatLatex(opt)}</Latex></span>
                </button>
              );
            })}
          </div>

          {quizAnswered && (
            <button onClick={handleNext} className="w-full mt-4 py-3 bg-dh-accent text-white rounded-xl font-heading font-bold text-lg hover:bg-dh-accent-light transition-all">
              {qIndex < quizQuestions.length - 1 ? 'Next →' : (
                quizMode === 'raid' && raidCurrentRound < raidRounds.length - 1
                  ? `Next Round →`
                  : 'Submit Results'
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // QUIZ RESULT SCREEN
  // ============================================================
  if (quizResult) {
    const isSiege = quizMode === 'siege';
    const isRaid = quizMode === 'raid';
    const isMaintain = quizMode === 'maintain';
    const passed = isSiege ? quizResult.passed
      : isRaid ? quizResult.captured
      : quizResult.passed;

    return (
      <div className="min-h-screen bg-dh-bg px-4 py-6 flex items-center justify-center">
        {celebrate && <Confetti />}
        <div className="max-w-sm w-full bg-dh-card rounded-3xl p-6 border-2 border-b-4 border-dh-border text-center">
          <div className="text-5xl mb-4">
            {passed ? (isMaintain ? '🔧' : '🏰') : (isRaid ? '💥' : '😢')}
          </div>
          <h2 className="text-2xl font-heading font-black text-dh-text mb-2">
            {isSiege && passed && 'State Captured!'}
            {isSiege && !passed && 'Siege Failed!'}
            {isRaid && passed && 'Fortress Breached!'}
            {isRaid && !passed && 'Raid Repelled!'}
            {isMaintain && passed && 'Castle Maintained!'}
            {isMaintain && !passed && 'Maintenance Failed!'}
          </h2>
          <p className="text-dh-text-muted text-sm mb-2">{quizStateName}</p>
          <p className="text-dh-text-muted text-sm mb-4">{quizResult.message}</p>

          {isRaid && quizResult.roundDetails && (
            <div className="flex justify-center gap-2 mb-4">
              {quizResult.roundDetails.map((rd, i) => (
                <div key={i} className={`px-3 py-2 rounded-xl border-2 ${
                  rd.passed
                    ? 'border-dh-green/50 bg-dh-green/10 text-dh-green'
                    : 'border-dh-red/50 bg-dh-red/10 text-dh-red'
                } font-heading font-bold text-xs`}>
                  R{i + 1}: {rd.correct}/5 {rd.passed ? '✓' : '✗'}
                </div>
              ))}
            </div>
          )}

          {isRaid && !passed && quizResult.castleRegenerated && (
            <p className="text-dh-red text-xs font-heading font-bold mb-4">
              Castle regenerated to Lv{quizResult.newCastleLevel}!
            </p>
          )}

          {isSiege && !passed && quizResult.cooldownMinutes && (
            <p className="text-dh-text-muted text-xs font-bold mb-4">
              Cooldown: {Math.floor(quizResult.cooldownMinutes / 60)}h — you can siege this state again after the cooldown.
            </p>
          )}

          <button
            onClick={exitQuiz}
            className="w-full py-3 bg-dh-accent text-white rounded-xl font-heading font-bold text-lg hover:bg-dh-accent-light transition-all"
          >
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN MAP UI
  // ============================================================
  const mine = selectedState ? myConquests.some(c => c.stateId === selectedState.id) : false;
  const myConquest = selectedState ? myConquests.find(c => c.stateId === selectedState.id) : null;
  const shieldLeft = selectedState?.shieldUntil ? formatTimeLeft(selectedState.shieldUntil) : null;
  const siegeCooldownLeft = selectedState?.siegeCooldownUntil ? formatTimeLeft(selectedState.siegeCooldownUntil) : null;
  const castleLevel = selectedState?.castleLevel || 0;

  return (
    <div className="min-h-screen w-full bg-dh-bg flex flex-col font-sans text-dh-text pb-28">
      {celebrate && <Confetti />}

      {/* HEADER */}
      <div className="w-full max-w-2xl mx-auto pt-4 px-4">
        <div className="bg-dh-card rounded-2xl border-2 border-b-4 border-dh-border p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/dashboard')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-dh-surface border-2 border-b-4 border-dh-border text-dh-text font-bold active:translate-y-[2px] active:border-b-2 transition-all">
                ←
              </button>
              <h1 className="text-xl font-heading font-black uppercase tracking-wide">⚔️ War Map</h1>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dh-surface border-2 border-dh-border">
              <span className="text-base">🪙</span>
              <span className="font-heading font-black text-dh-yellow text-sm"><AnimatedNumber value={coins} /></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-heading font-bold text-dh-text-muted">
                <span>Your Empire</span>
                <span>{conqueredCount}/{totalStates} states</span>
              </div>
              <div className="w-full bg-dh-surface rounded-full h-3 border border-dh-border overflow-hidden">
                <div
                  className="bg-dh-accent h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalStates > 0 ? Math.round((conqueredCount / totalStates) * 100) : 0}%` }}
                />
              </div>
            </div>
            <button
              onClick={handleCollectTribute}
              disabled={pendingTribute === 0}
              className={`px-4 py-2 rounded-xl border-2 border-b-4 font-heading font-black text-xs uppercase tracking-wider transition-all active:translate-y-[2px] active:border-b-2 ${
                pendingTribute > 0
                  ? 'bg-dh-yellow border-dh-yellow-dark text-black animate-bounce-subtle'
                  : 'bg-dh-surface border-dh-border text-dh-text-muted cursor-not-allowed'
              }`}
            >
              💰 Tribute {pendingTribute > 0 ? `+${pendingTribute}` : ''}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mt-3">
          {[
            { id: 'map', label: '🗺️ Map' },
            { id: 'empires', label: '🏆 Empires' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl border-2 border-b-4 font-heading font-black text-sm uppercase tracking-wider transition-all active:translate-y-[2px] active:border-b-2 ${
                tab === t.id
                  ? 'bg-dh-accent border-dh-accent-dark text-white'
                  : 'bg-dh-card border-dh-border text-dh-text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification */}
      {actionMsg && (
        <div className="max-w-2xl mx-auto mt-3 px-4 w-full">
          <div className="bg-dh-accent border-b-4 border-dh-accent-dark text-white text-center p-3 rounded-2xl font-heading font-bold animate-pop-in">
            {actionMsg}
          </div>
        </div>
      )}

      {/* Starter guide */}
      {tab === 'map' && conqueredCount === 0 && (
        <div className="max-w-2xl mx-auto mt-3 px-4 w-full">
          <div className="bg-dh-blue/10 border-2 border-b-4 border-dh-blue/40 rounded-2xl p-4">
            <p className="font-heading font-black text-dh-blue text-sm uppercase tracking-wide mb-2">🚩 Claim your first territory</p>
            <ol className="text-xs font-bold text-dh-text-muted space-y-1 list-decimal list-inside">
              <li>Tap any <span className="text-dh-text">gray tile</span> — it's unclaimed</li>
              <li>Hit <span className="text-dh-blue">⚔️ Siege Challenge</span> to prove your knowledge (5 questions, 100 🪙 fee)</li>
              <li>Score 4/5 and the state is yours, protected by a 12h shield 🛡️</li>
            </ol>
            <p className="text-[11px] font-bold text-dh-yellow mt-2">Tip: Owning neighboring states earns you bonus tribute!</p>
          </div>
        </div>
      )}

      {/* MAP TAB */}
      {tab === 'map' && (
        <div className="flex-1 w-full max-w-2xl mx-auto p-4">
          <div className="w-full bg-dh-card rounded-3xl border-2 border-b-4 border-dh-border p-4 relative overflow-hidden">
            <MapOfIndia states={states} myConquests={myConquests} onStateClick={setSelectedState} selectedId={selectedState?.id} />
          </div>
          <p className="text-center text-xs text-dh-text-muted font-bold mt-3">
            Win quiz battles to capture states. Maintain your castles to prevent decay!
          </p>
        </div>
      )}

      {/* EMPIRES TAB */}
      {tab === 'empires' && (
        <div className="flex-1 w-full max-w-2xl mx-auto p-4 flex flex-col gap-2">
          {leaderboard.length === 0 && (
            <div className="text-center text-dh-text-muted font-bold py-10">No empires yet. Be the first conqueror!</div>
          )}
          {leaderboard.map(entry => {
            const isMe = currentUser && entry.username === currentUser.username;
            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;
            return (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-b-4 ${
                  isMe ? 'bg-dh-accent/10 border-dh-accent/50' : 'bg-dh-card border-dh-border'
                }`}
              >
                <span className="w-8 text-center font-heading font-black text-lg">
                  {medal || entry.rank}
                </span>
                <div className="flex-1">
                  <p className={`font-heading font-bold ${isMe ? 'text-dh-accent' : 'text-dh-text'}`}>
                    {entry.username} {isMe && '(You)'}
                  </p>
                  <p className="text-[11px] font-bold text-dh-text-muted">
                    🗺️ {entry.statesCount} states · 🏰 {entry.totalLevel} castle levels
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-dh-surface border border-dh-border">
                  <span className="text-sm">⚡</span>
                  <span className="font-heading font-black text-dh-yellow text-sm">{entry.power}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STATE DRAWER */}
      {selectedState && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={() => setSelectedState(null)}
        >
          <div
            className="w-full md:max-w-md bg-dh-card rounded-t-3xl md:rounded-3xl border-t-4 md:border-4 border-dh-border p-6 pb-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-heading font-black text-dh-text">{selectedState.name}</h2>
                <p className="text-dh-text-muted text-xs font-bold mt-0.5">Battle subject: {selectedState.subject}</p>
              </div>
              <button
                onClick={() => setSelectedState(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-dh-surface border-2 border-b-4 border-dh-border text-dh-muted font-bold active:translate-y-[2px] active:border-b-2 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Ownership + defense info */}
            <div className="bg-dh-surface rounded-2xl border-2 border-dh-border p-4 mb-4">
              {selectedState.conquered ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-heading font-black ${mine ? 'text-dh-accent' : 'text-dh-red'}`}>
                      {mine ? '🟢 Your territory' : `🔴 Held by ${selectedState.conqueredBy}`}
                    </span>
                    {shieldLeft && (
                      <span className="text-xs font-heading font-black text-dh-blue bg-dh-blue/10 border border-dh-blue/40 rounded-lg px-2 py-1">
                        🛡️ {shieldLeft}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-dh-text-muted">Castle defense:</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-4 h-4 rounded-sm border ${
                            i < (selectedState.castleLevel || 1)
                              ? mine ? 'bg-dh-accent border-dh-accent-dark' : 'bg-dh-red border-dh-red-dark'
                              : 'bg-dh-card border-dh-border'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-heading font-black text-dh-text">Lv{selectedState.castleLevel || 1}</span>
                  </div>
                  {mine && myConquest && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-bold text-dh-yellow">
                        💰 Earning tribute · {myConquest.adjacencyBonus > 0 ? `+${Math.round(myConquest.adjacencyBonus * 25)}% adjacency bonus` : 'Own neighbors for bonus!'}
                      </p>
                      {myConquest.decayWarning && (
                        <p className="text-[11px] font-heading font-black text-orange-400 animate-pulse">
                          ⚠️ Castle decaying soon! Maintain it to reset the timer.
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-sm font-heading font-black text-dh-text-muted">⬛ Unclaimed territory</span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {/* MY STATE: upgrade defense */}
              {mine && (
                <button
                  onClick={handleUpgrade}
                  disabled={(myConquest?.castleLevel || 1) >= 5}
                  className={`w-full p-4 rounded-2xl border-b-4 text-left flex items-center gap-4 active:translate-y-1 active:border-b-0 transition-all ${
                    (myConquest?.castleLevel || 1) >= 5
                      ? 'bg-dh-surface border-dh-border text-dh-text-muted cursor-not-allowed'
                      : 'bg-dh-accent border-dh-accent-dark text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">🏰</div>
                  <div className="flex flex-col">
                    <span className="text-lg font-heading font-black uppercase tracking-wide leading-tight">
                      {(myConquest?.castleLevel || 1) >= 5 ? 'Max Defense' : 'Fortify Castle'}
                    </span>
                    <span className="text-xs font-bold opacity-80">
                      {(myConquest?.castleLevel || 1) >= 5
                        ? 'This fortress is impenetrable'
                        : `${(myConquest?.castleLevel || 1) * 300} 🪙 · +1 attack absorbed`}
                    </span>
                  </div>
                </button>
              )}

              {/* MY STATE: maintain castle (always visible) */}
              {mine && (
                <button
                  onClick={handleStartMaintain}
                  className={`w-full p-4 rounded-2xl border-b-4 text-left flex items-center gap-4 active:translate-y-1 active:border-b-0 transition-all ${
                    myConquest?.decayWarning 
                      ? 'border-orange-600 bg-orange-500 text-white animate-pulse' 
                      : 'border-dh-blue-dark bg-dh-blue text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">🔧</div>
                  <div className="flex flex-col">
                    <span className="text-lg font-heading font-black uppercase tracking-wide leading-tight">
                      {myConquest?.decayWarning ? 'Maintain Castle' : 'Maintain Castle (Proactive)'}
                    </span>
                    <span className="text-xs font-bold opacity-80">3 quick questions to prevent decay</span>
                  </div>
                </button>
              )}

              {/* ENEMY STATE: 1v1 battle */}
              {selectedState.conquered && !mine && (
                <button
                  onClick={handleAttack}
                  disabled={!!shieldLeft}
                  className={`w-full p-4 rounded-2xl border-b-4 text-left flex items-center gap-4 active:translate-y-1 active:border-b-0 transition-all ${
                    shieldLeft
                      ? 'bg-dh-surface border-dh-border text-dh-text-muted cursor-not-allowed'
                      : 'bg-dh-red border-dh-red-dark text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">⚔️</div>
                  <div className="flex flex-col">
                    <span className="text-lg font-heading font-black uppercase tracking-wide leading-tight">
                      {shieldLeft ? `Shielded (${shieldLeft})` : 'Battle 1v1'}
                    </span>
                    <span className="text-xs font-bold opacity-80">
                      {shieldLeft ? 'Cannot attack until shield expires' : 'Find an opponent and fight for this state'}
                    </span>
                  </div>
                </button>
              )}

              {/* UNCLAIMED or ENEMY Castle ≤2: Siege Challenge */}
              {!mine && (!selectedState.conquered || castleLevel < 3) && (
                <button
                  onClick={handleStartSiege}
                  disabled={!!shieldLeft || !!siegeCooldownLeft}
                  className={`w-full p-4 rounded-2xl border-b-4 text-left flex items-center gap-4 active:translate-y-1 active:border-b-0 transition-all ${
                    shieldLeft || siegeCooldownLeft
                      ? 'bg-dh-surface border-dh-border text-dh-text-muted cursor-not-allowed'
                      : 'bg-dh-blue border-dh-blue-dark text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">⚡</div>
                  <div className="flex flex-col">
                    <span className="text-lg font-heading font-black uppercase tracking-wide leading-tight">
                      {siegeCooldownLeft ? `Cooldown (${siegeCooldownLeft})` : 'Siege Challenge'}
                    </span>
                    <span className="text-xs font-bold opacity-80">
                      {siegeCooldownLeft
                        ? 'Wait for cooldown to expire'
                        : shieldLeft
                          ? 'Shielded — cannot siege'
                          : `Solo quiz · 100 🪙 fee on completion · Score 4/5 to conquer`}
                    </span>
                  </div>
                </button>
              )}

              {/* ENEMY Castle 3+: Raid Fortress */}
              {!mine && selectedState.conquered && castleLevel >= 3 && (
                <button
                  onClick={handleStartRaid}
                  disabled={!!shieldLeft}
                  className={`w-full p-4 rounded-2xl border-b-4 text-left flex items-center gap-4 active:translate-y-1 active:border-b-0 transition-all ${
                    shieldLeft
                      ? 'bg-dh-surface border-dh-border text-dh-text-muted cursor-not-allowed'
                      : 'bg-gradient-to-r from-dh-red to-dh-accent border-dh-red-dark text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">🏰</div>
                  <div className="flex flex-col">
                    <span className="text-lg font-heading font-black uppercase tracking-wide leading-tight">
                      {shieldLeft ? `Shielded (${shieldLeft})` : 'Raid Fortress'}
                    </span>
                    <span className="text-xs font-bold opacity-80">
                      {shieldLeft
                        ? 'Cannot raid until shield expires'
                        : `3 rounds × 5 questions · Castle Lv${castleLevel} · No fee, high stakes`}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapOfIndiaPage;
