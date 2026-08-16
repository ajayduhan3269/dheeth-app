import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import LatexRenderer from './LatexRenderer';
import MatchSummary from './MatchSummary';
import PowerUpDock from './PowerUpDock';
import FloatingEmoteMenu from './FloatingEmoteMenu';
import api, { getAvatarUrl } from '../api';
import { sounds } from '../utils/sound';
import { playReactionSound, getSoundTypeForEmoji } from '../utils/audioFx';

const MatchScreen = ({ matchPayload }) => {
  const pId = matchPayload.player.id;
  const oId = matchPayload.opponent.id;

  const getOptionLetter = (ans) => {
    if (!ans) return null;
    if (typeof ans === 'string') return ans.toUpperCase();
    if (typeof ans === 'object' && ans.selectedOption) return String(ans.selectedOption).toUpperCase();
    return null;
  };

  const extractInitial = (payload) => {
    const qIndex = payload.currentQuestionIndex || 0;
    const pData = payload.players?.[pId];
    const oData = payload.players?.[oId];
    const myAnswer = pData?.hasAnswered ? getOptionLetter(pData?.answers?.[qIndex]) : null;
    const oppAnswer = oData?.hasAnswered ? getOptionLetter(oData?.answers?.[qIndex]) : null;
    const timeUp = payload.questionEndsAt && Date.now() >= payload.questionEndsAt;
    const bothAnswered = Boolean(pData?.hasAnswered && oData?.hasAnswered);
    const isRevealed = Boolean((timeUp && pData?.hasAnswered) || bothAnswered);
    const correctOpt = payload.questions?.[qIndex]?.correctOption?.toUpperCase();
    
    return {
      currentIndex: qIndex,
      questionEndsAt: payload.questionEndsAt || 0,
      playerScore: pData?.score || 0,
      playerCorrectCount: pData?.correctAnswers || 0,
      playerStreak: pData?.currentStreak || 0,
      opponentScore: oData?.score || 0,
      opponentCorrectCount: oData?.correctAnswers || 0,
      opponentConnected: oData?.connected ?? true,
      selectedOption: myAnswer,
      feedbackState: isRevealed ? (myAnswer === correctOpt ? 'correct' : 'wrong') : null,
      correctOption: isRevealed ? correctOpt : null,
      opponentSelected: isRevealed ? oppAnswer : null
    };
  };

  const initial = extractInitial(matchPayload);

  const [matchPhase, setMatchPhase] = useState(matchPayload.waitingForHost ? 'waiting_host' : (matchPayload.matchPhase || 'intro'));
  const [secondsPerQ, setSecondsPerQ] = useState(Number(matchPayload.secondsPerQ) || 20);
  const [timeLeft, setTimeLeft] = useState(Number(matchPayload.secondsPerQ) || 20);
  const [questionEndsAt, setQuestionEndsAt] = useState(initial.questionEndsAt);
  const [currentIndex, setCurrentIndex] = useState(initial.currentIndex);
  
  const [playerScore, setPlayerScore] = useState(initial.playerScore);
  const [playerCorrectCount, setPlayerCorrectCount] = useState(initial.playerCorrectCount);
  const [opponentScore, setOpponentScore] = useState(initial.opponentScore);
  const [opponentCorrectCount, setOpponentCorrectCount] = useState(initial.opponentCorrectCount);
  const [opponentConnected, setOpponentConnected] = useState(initial.opponentConnected);

  const [selectedOption, setSelectedOption] = useState(initial.selectedOption);
  const [isMatchOver, setIsMatchOver] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [activeReactions, setActiveReactions] = useState([]);
  const [mutedReactions, setMutedReactions] = useState(() => {
    try {
      return localStorage.getItem('dheeth_mute_reactions') === 'true';
    } catch {
      return false;
    }
  });
  const lastReactionTimeRef = useRef(0);
  const [playerStreak, setPlayerStreak] = useState(initial.playerStreak);
  const [feedbackState, setFeedbackState] = useState(initial.feedbackState);
  const [correctOption, setCorrectOption] = useState(initial.correctOption);
  const [opponentSelected, setOpponentSelected] = useState(initial.opponentSelected);
  const [showLightning, setShowLightning] = useState(false);
  const [vibrate, setVibrate] = useState(false);
  const [scoreDiff, setScoreDiff] = useState(null);
  const prevScoreRef = useRef(initial.playerScore);
  const [savedMatchQuestions, setSavedMatchQuestions] = useState(new Set());

  // EMP Disruptor Power-Up States
  const [powerupSlot, setPowerupSlot] = useState(matchPayload.myPowerupSlot || null);
  const [isActivatingPowerup, setIsActivatingPowerup] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState([]);

  useEffect(() => {
    socket.emit('match:sync', (response) => {
      if (response && response.ok) {
        const updated = extractInitial(response);
        setCurrentIndex(updated.currentIndex);
        if (updated.questionEndsAt) setQuestionEndsAt(updated.questionEndsAt);
        setPlayerScore(updated.playerScore);
        setPlayerCorrectCount(updated.playerCorrectCount);
        setPlayerStreak(updated.playerStreak);
        setOpponentScore(updated.opponentScore);
        setOpponentCorrectCount(updated.opponentCorrectCount);
        setOpponentConnected(updated.opponentConnected);
        setSelectedOption(updated.selectedOption);
        setFeedbackState(updated.feedbackState);
        setCorrectOption(updated.correctOption);
        setOpponentSelected(updated.opponentSelected);
      }
    });
  }, [matchPayload.roomId]);

  useEffect(() => {
    if (matchPhase === 'intro') {
      const introTimer = setTimeout(() => {
        setMatchPhase('active');
      }, 2500);
      return () => clearTimeout(introTimer);
    }
  }, [matchPhase]);

  // Local timer based on absolute end time
  useEffect(() => {
    if (matchPhase !== 'active' || !questionEndsAt) return;
    
    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.round((questionEndsAt - now) / 1000));
      setTimeLeft(prev => {
        if (prev > 5 && remaining <= 5 && remaining > 0) sounds.tick();
        return remaining;
      });
    };
    
    tick(); // initial
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [questionEndsAt, matchPhase]);

  useEffect(() => {
    socket.on('timer_sync', (data) => {
      if (data.secondsPerQ) setSecondsPerQ(Number(data.secondsPerQ));
      setQuestionEndsAt(data.questionEndsAt);
      setCurrentIndex((prevIdx) => {
        if (prevIdx === 0) {
          setSelectedOption(null);
          setFeedbackState(null);
          setCorrectOption(null);
          setOpponentSelected(null);
          setEliminatedOptions([]);
        }
        return prevIdx;
      });
    });

    socket.on('player:connection', (data) => {
      if (data.userId === matchPayload.opponent.id || data.userId === 'bot') {
        setOpponentConnected(data.connected);
      }
    });

    socket.on('score_update', (data) => {
      const me = data.players[matchPayload.player.id];
      const opp = data.players[matchPayload.opponent.id] || Object.values(data.players).find(p => p.userId !== matchPayload.player.id);
      if (me) {
        setPlayerScore(me.score);
        setPlayerCorrectCount(me.correctAnswers || 0);
        prevScoreRef.current = me.score;
      }
      if (opp) {
        setOpponentScore(opp.score);
        setOpponentCorrectCount(opp.correctAnswers || 0);
      }
    });

    socket.on('answer_result', (data) => {
      setFeedbackState(data.isCorrect ? 'correct' : 'wrong');
      setCorrectOption(data.correctOption?.toUpperCase());
      setPlayerStreak(prev => (data.isCorrect ? prev + 1 : 0));
      if (data.isCorrect) {
        sounds.correct();
        const newKey = Date.now();
        const scoreVal = data.scoreGained || (data.breakdown ? data.breakdown.total : 100);
        setScoreDiff({ value: scoreVal, breakdown: data.breakdown, key: newKey });
        setTimeout(() => {
          setScoreDiff(prev => (prev && prev.key === newKey ? null : prev));
        }, 2200);
      } else {
        sounds.wrong();
        setVibrate(true);
        setTimeout(() => setVibrate(false), 500);
      }
    });

    socket.on('reveal_answers', (data) => {
      setCorrectOption(data.correctOption?.toUpperCase() || null);
      const opponentData = Object.values(data.players).find(p => p.userId === matchPayload.opponent.id);
      setOpponentSelected(getOptionLetter(opponentData?.answers?.[data.questionIndex]));
    });

    socket.on('match_over', (data) => {
      setIsMatchOver(true);
      setSummaryData(data);
    });

    socket.on('next_question', (data) => {
      setCurrentIndex(data.questionIndex);
      if (data.questionEndsAt) setQuestionEndsAt(data.questionEndsAt);
      setSelectedOption(null);
      setFeedbackState(null);
      setCorrectOption(null);
      setOpponentSelected(null);
      setEliminatedOptions([]);
    });

    socket.on('receive_reaction', (data) => {
      if (mutedReactions || !data?.emoji) return;
      const id = Date.now() + Math.random();
      setActiveReactions(prev => [...prev.slice(-4), { emoji: data.emoji, id, isSelf: false }]);
      playReactionSound(getSoundTypeForEmoji(data.emoji));
      setTimeout(() => setActiveReactions(prev => prev.filter(r => r.id !== id)), 2200);
    });

    // EMP Power-up socket events
    socket.on('powerup:charge_update', (data) => {
      setPowerupSlot(data.slot || null);
      if (data.slot) sounds.streak?.();
    });

    socket.on('powerup:effect_applied', (data) => {
      if (data.type === 'EMP' && data.eliminatedOptionIds) {
        setEliminatedOptions(data.eliminatedOptionIds.map(x => x.toUpperCase()));
        sounds.capture?.();
      }
    });

    socket.on('duel:both_connected', () => {
      sounds.success?.();
      setMatchPhase('intro');
    });

    socket.on('duel:host_timeout', (data) => {
      alert(data?.message || 'Challenge standby expired.');
      navigate('/dashboard');
    });

    return () => {
      socket.off('timer_sync');
      socket.off('player:connection');
      socket.off('score_update');
      socket.off('answer_result');
      socket.off('reveal_answers');
      socket.off('match_over');
      socket.off('next_question');
      socket.off('receive_reaction');
      socket.off('powerup:charge_update');
      socket.off('powerup:effect_applied');
      socket.off('duel:both_connected');
      socket.off('duel:host_timeout');
    };
  }, [matchPayload, pId]);

  useEffect(() => {
    // Lightning strike on every 3-answer streak (3, 6, 9...)
    if (playerStreak >= 3 && playerStreak % 3 === 0) {
      setShowLightning(true);
      sounds.streak();
      const t = setTimeout(() => setShowLightning(false), 1500);
      return () => clearTimeout(t);
    }
  }, [playerStreak]);

  const handleAnswer = (option) => {
    if (selectedOption) return;
    setSelectedOption(option);
    socket.emit('submit_answer', { roomId: matchPayload.roomId, selectedOption: option });
  };

  const sendReaction = (emoji) => {
    const now = Date.now();
    if (now - lastReactionTimeRef.current < 1500) return; // 1.5s local cooldown
    lastReactionTimeRef.current = now;

    socket.emit('send_reaction', { roomId: matchPayload.roomId, emoji });
    const id = Date.now() + Math.random();
    setActiveReactions(prev => [...prev.slice(-4), { emoji, id, isSelf: true }]);
    playReactionSound(getSoundTypeForEmoji(emoji));
    setTimeout(() => setActiveReactions(prev => prev.filter(r => r.id !== id)), 2200);
  };

  const toggleMuteReactions = () => {
    setMutedReactions(prev => {
      const next = !prev;
      try {
        localStorage.setItem('dheeth_mute_reactions', String(next));
      } catch {}
      return next;
    });
  };

  const handleActivatePowerup = (slot) => {
    if (!slot || isActivatingPowerup) return;
    setIsActivatingPowerup(true);
    socket.emit('powerup:activate', { roomId: matchPayload.roomId, powerupInstanceId: slot.instanceId }, (ack) => {
      setIsActivatingPowerup(false);
      if (ack?.ok) {
        setPowerupSlot(null);
      }
    });
  };

  const handleSaveMatchQuestion = async (q) => {
    const key = q._id || q.questionId || q.questionText;
    if (savedMatchQuestions.has(key)) return;
    try {
      await api.post('/api/bookmarks', {
        questionId: q._id || q.questionId,
        questionText: q.questionText,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation || q.solution || '',
        subject: matchPayload.subject || ''
      });
      setSavedMatchQuestions(prev => {
        const s = new Set(prev);
        s.add(key);
        return s;
      });
    } catch (err) {
      console.error('Failed to save question:', err);
    }
  };

  if (isMatchOver && summaryData) {
    return <MatchSummary summaryData={summaryData} subject={matchPayload.subject} matchPayload={matchPayload} />;
  }

  const totalQuestions = matchPayload.questions.length;
  const currentQ = matchPayload.questions[currentIndex];
  const timerPercent = (timeLeft / (secondsPerQ || 20)) * 100;
  const playerAvatar = getAvatarUrl(matchPayload.player.avatarSeed || matchPayload.player.username);
  const opponentAvatar = getAvatarUrl(matchPayload.opponent.avatarSeed || matchPayload.opponent.username);

  return (
    <div className={`min-h-screen bg-dh-bg flex flex-col ${vibrate ? 'animate-vibration' : ''}`}>

      {/* Streak Lightning Overlay */}
      {showLightning && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* Screen flash */}
          <div className="absolute inset-0 bg-white animate-screen-flash" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-7xl animate-lightning-strike drop-shadow-[0_0_25px_#ffc800]">⚡</div>
          <div className="absolute top-1/3 left-1/4 text-5xl animate-lightning-strike drop-shadow-[0_0_20px_#ffc800]" style={{ animationDelay: '0.1s' }}>⚡</div>
          <div className="absolute top-1/3 right-1/4 text-5xl animate-lightning-strike drop-shadow-[0_0_20px_#ffc800]" style={{ animationDelay: '0.2s' }}>⚡</div>
          {/* Streak callout */}
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 animate-pop-in text-center">
            <span className="block text-4xl md:text-5xl font-heading font-black text-dh-yellow uppercase tracking-widest drop-shadow-[0_0_20px_#ffc800]">
              {playerStreak} Streak!
            </span>
            <span className="block text-sm font-heading font-bold text-white/80 uppercase tracking-[0.3em] mt-1">
              On Fire 🔥
            </span>
          </div>
        </div>
      )}

      {/* Standby Waiting for Host (When friend accepted while host was offline) */}
      {matchPhase === 'waiting_host' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full border-4 border-dh-accent border-t-transparent animate-spin mb-6 shadow-[0_0_30px_rgba(0,230,118,0.3)]" />
          <h2 className="text-2xl md:text-3xl font-heading font-black text-white mb-2">
            Waiting for Host to Enter...
          </h2>
          <p className="text-dh-text-muted text-sm max-w-sm mb-6">
            Push alert sent to <span className="text-white font-bold">{matchPayload.opponent?.username || 'Host'}</span>. The match will start the moment they open the notification!
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dh-accent/10 border border-dh-accent/30 text-dh-accent text-xs font-heading font-black animate-pulse shadow-md">
            <span className="w-2 h-2 rounded-full bg-dh-accent animate-ping" />
            <span>📱 Notification Dispatched • Standby Active</span>
          </div>
        </div>
      )}

      {/* Intro Animation */}
      {matchPhase === 'intro' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="animate-match-found text-center max-w-sm w-full">
            {matchPayload.isDuel && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-dh-accent/15 border border-dh-accent/40 text-dh-accent font-heading font-black text-xs uppercase tracking-widest mb-4">
                <span>⚔️</span> Friend Duel • Round {matchPayload.roundNumber || 1}
              </div>
            )}
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="flex flex-col items-center">
                <img src={playerAvatar} alt="You" className="w-20 h-20 rounded-full border-3 border-dh-accent shadow-lg shadow-dh-accent/40 bg-dh-card" />
                <p className="text-dh-text font-heading font-bold text-sm mt-2">{matchPayload.player.username}</p>
                {matchPayload.rivalry && (
                  <span className="text-[10px] font-heading font-black text-dh-accent bg-dh-accent/10 px-2 py-0.5 rounded-full mt-1">
                    {matchPayload.rivalry.scoreHost} Wins
                  </span>
                )}
              </div>
              <div className="text-3xl font-heading font-black text-dh-secondary animate-pulse">VS</div>
              <div className="flex flex-col items-center">
                <img src={opponentAvatar} alt="Opponent" className="w-20 h-20 rounded-full border-3 border-dh-red shadow-lg shadow-dh-red/40 bg-dh-card" />
                <p className="text-dh-text font-heading font-bold text-sm mt-2">{matchPayload.opponent.username}</p>
                {matchPayload.rivalry && (
                  <span className="text-[10px] font-heading font-black text-dh-red bg-dh-red/10 px-2 py-0.5 rounded-full mt-1">
                    {matchPayload.rivalry.scoreGuest} Wins
                  </span>
                )}
              </div>
            </div>
            <div className="text-dh-accent text-lg font-heading font-bold animate-pulse">
              {matchPayload.isDuel ? '⚔️ DUEL COMMENCING!' : 'MATCH FOUND!'}
            </div>
          </div>
        </div>
      )}

      {/* Active Match - QuizUp Style */}
      {matchPhase === 'active' && (
        <div className="min-h-screen w-full bg-dh-black flex flex-col font-sans text-white relative overflow-hidden">
          
          {/* Vertical Score Progress Bars (Left and Right edges) */}
          <div className="absolute left-0 top-0 bottom-0 w-2 md:w-3 bg-dh-surface z-0">
            <div 
              className="absolute bottom-0 left-0 w-full bg-dh-accent transition-all duration-500 ease-out shadow-[0_0_15px_#00e676]"
              style={{ height: `${(playerCorrectCount / totalQuestions) * 100}%` }}
            ></div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-2 md:w-3 bg-dh-surface z-0">
            <div 
              className="absolute bottom-0 right-0 w-full bg-dh-red transition-all duration-500 ease-out shadow-[0_0_15px_#ff4b4b]"
              style={{ height: `${(opponentCorrectCount / totalQuestions) * 100}%` }}
            ></div>
          </div>

          <div className="flex-1 flex flex-col items-center px-4 md:px-8 py-4 relative z-10 w-full max-w-4xl mx-auto">
            
            {/* =========================================
                TOP BAR (Scores & Timer)
                ========================================= */}
            <div className="w-full flex items-start justify-between mb-8">
              
              {/* Player Section (Left) */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  {/* Player Avatar Speech Bubble (Positioned below avatar to prevent top clipping) */}
                  {activeReactions.filter(r => r.isSelf).slice(-1).map(r => (
                    <div 
                      key={r.id}
                      className="absolute top-13 left-0 md:top-16 z-30 animate-bubble-self pointer-events-none flex items-center justify-center bg-slate-900/95 text-white px-2.5 py-1 rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.6)] border-2 border-dh-accent font-black text-2xl filter drop-shadow-lg"
                    >
                      <span>{r.emoji}</span>
                      <div className="absolute -top-1.5 left-4 w-2.5 h-2.5 bg-slate-900 border-t-2 border-l-2 border-dh-accent rotate-45" />
                    </div>
                  ))}

                  <div 
                    className={`absolute -inset-1 rounded-full opacity-75 blur-[2px] transition-all ${
                      playerScore >= opponentScore && playerScore > 0 
                        ? 'bg-dh-accent animate-dh-pulse-ring' 
                        : 'bg-dh-accent/40'
                    }`}
                  />
                  <img 
                    src={playerAvatar}
                    alt="You"
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full relative z-10 border-2 border-dh-accent bg-dh-card object-cover"
                  />
                  {playerScore >= opponentScore && playerScore > 0 && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 text-xs drop-shadow-[0_0_6px_#fbbf24]">
                      👑
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm md:text-base text-white">
                    {matchPayload.player.username}
                  </span>
                  <span className="font-mono font-black text-xl md:text-2xl text-dh-accent tracking-wider tabular-nums">
                    {playerScore}
                  </span>
                </div>
              </div>

              {/* Timer Section (Center) */}
              <div className="flex flex-col items-center justify-center pt-2">
                <span className="text-[10px] md:text-xs font-bold text-[#1cb0f6] tracking-widest uppercase mb-1">
                  Time Left
                </span>
                <span 
                  className={`font-mono text-3xl md:text-5xl font-black tabular-nums transition-colors ${
                    timeLeft <= 5 
                      ? 'animate-dh-tick-flash text-dh-red' 
                      : 'text-[#1cb0f6]'
                  }`}
                  style={{ textShadow: timeLeft <= 5 ? '0 0 14px #ff4b4b' : '0 0 8px rgba(28,176,246,0.4)' }}
                >
                  {timeLeft}
                </span>
              </div>

              {/* Opponent Section (Right) */}
              <div className="flex items-center gap-3 justify-end">
                <div className="flex flex-col items-end">
                  <span className="font-bold text-sm md:text-base text-white flex items-center gap-2">
                    {!opponentConnected && <span className="text-[10px] bg-dh-red/20 text-dh-red px-2 py-0.5 rounded-full animate-pulse border border-dh-red/40">Reconnecting...</span>}
                    {matchPayload.opponent.username}
                  </span>
                  <span className="font-mono font-black text-xl md:text-2xl text-dh-red tracking-wider tabular-nums">
                    {opponentScore}
                  </span>
                </div>
                <div className="relative">
                  {/* Opponent Avatar Speech Bubble (Positioned below avatar to prevent top clipping) */}
                  {activeReactions.filter(r => !r.isSelf).slice(-1).map(r => (
                    <div 
                      key={r.id}
                      className="absolute top-13 right-0 md:top-16 z-30 animate-bubble-opp pointer-events-none flex items-center justify-center bg-slate-900/95 text-white px-2.5 py-1 rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.6)] border-2 border-dh-red font-black text-2xl filter drop-shadow-lg"
                    >
                      <span>{r.emoji}</span>
                      <div className="absolute -top-1.5 right-4 w-2.5 h-2.5 bg-slate-900 border-t-2 border-r-2 border-dh-red rotate-45" />
                    </div>
                  ))}

                  <div 
                    className={`absolute -inset-1 rounded-full opacity-75 blur-[2px] transition-all ${
                      opponentScore > playerScore 
                        ? 'bg-dh-red animate-dh-pulse-ring' 
                        : opponentConnected ? 'bg-dh-red/40' : 'bg-dh-text-muted/20'
                    }`}
                  />
                  <img 
                    src={opponentAvatar}
                    alt="Opponent"
                    className={`w-12 h-12 md:w-16 md:h-16 rounded-full relative z-10 border-2 ${opponentConnected ? 'border-dh-red' : 'border-dh-text-muted opacity-50'} bg-dh-card object-cover`}
                  />
                  {opponentScore > playerScore && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 text-xs drop-shadow-[0_0_6px_#fbbf24]">
                      👑
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Score popup & Live Component Breakdown */}
            {scoreDiff && (
              <div key={scoreDiff.key} className="pointer-events-none absolute left-1/2 top-20 z-50 -translate-x-1/2 animate-dh-float-out">
                <div className="animate-dh-pop flex flex-col items-center gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-heading tracking-tight text-emerald-400 drop-shadow-[0_0_18px_rgba(0,230,118,0.75)]">
                    +{scoreDiff.value} pts
                  </span>
                  {scoreDiff.breakdown && (
                    <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
                      <span className="rounded-full border border-sky-400/40 bg-sky-400/15 px-2.5 py-0.5 text-[10px] font-heading font-black text-sky-300 backdrop-blur-md shadow-sm">
                        🎯 +100 Base
                      </span>
                      {scoreDiff.breakdown.speed > 0 && (
                        <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-2.5 py-0.5 text-[10px] font-heading font-black text-amber-300 backdrop-blur-md shadow-sm">
                          ⚡ +{scoreDiff.breakdown.speed}s Speed
                        </span>
                      )}
                      {scoreDiff.breakdown.streak > 0 && (
                        <span className="rounded-full border border-orange-400/40 bg-orange-400/15 px-2.5 py-0.5 text-[10px] font-heading font-black text-orange-400 backdrop-blur-md shadow-sm">
                          🔥 +{scoreDiff.breakdown.streak} Streak
                        </span>
                      )}
                      {scoreDiff.breakdown.isFinalRound && (
                        <span className="animate-dh-shimmer rounded-full border border-yellow-300/50 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-3 py-0.5 text-[10px] font-heading font-black text-slate-950 backdrop-blur-md shadow-[0_0_12px_rgba(251,191,36,0.6)]">
                          👑 1.5x CLUTCH
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =========================================
                QUESTION AREA
                ========================================= */}
            {(() => {
              const qText = currentQ?.questionText || '';
              const isTableOrLongQuestion = Boolean(
                qText.includes('\\begin{array}') ||
                qText.includes('\\begin{tabular}') ||
                qText.includes('\\begin{matrix}') ||
                qText.includes('List I') ||
                qText.includes('List-I') ||
                qText.includes('Match the following') ||
                qText.includes('Match List') ||
                qText.length > 100
              );

              return (
                <>
                  {matchPayload.rivalry && (
                    <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-dh-surface/90 border border-dh-border text-xs font-heading font-bold text-dh-text-muted mb-3 shadow-sm">
                      <span className="text-dh-accent font-black">Round #{matchPayload.roundNumber || 1}</span>
                      <span className="text-dh-border">•</span>
                      <span>Rivalry: <strong className="text-dh-green font-black">{matchPayload.rivalry.scoreHost}</strong> - <strong className="text-dh-red font-black">{matchPayload.rivalry.scoreGuest}</strong></span>
                    </div>
                  )}

                  <div className="w-full flex flex-col items-center flex-1 justify-center mb-4 max-w-2xl px-1">
                    <div className={`w-full font-normal text-white leading-relaxed ${
                      isTableOrLongQuestion 
                        ? 'text-sm sm:text-base md:text-lg text-left bg-dh-surface/60 border border-slate-700/70 rounded-2xl p-3.5 sm:p-4 shadow-md' 
                        : 'text-xl sm:text-2xl md:text-3xl text-center mb-2'
                    }`}>
                      <LatexRenderer text={currentQ.questionText} />
                    </div>

                    {/* Bookmark button — appears after answer reveal */}
                    {feedbackState && (
                      <button
                        onClick={() => handleSaveMatchQuestion(currentQ)}
                        disabled={savedMatchQuestions.has(currentQ._id || currentQ.questionId || currentQ.questionText)}
                        className={`mt-2.5 mb-2 px-4 py-1 rounded-full border-2 text-xs font-heading font-bold transition-all duration-200 ${
                          savedMatchQuestions.has(currentQ._id || currentQ.questionId || currentQ.questionText)
                            ? 'border-dh-accent text-dh-accent bg-dh-accent/10'
                            : 'border-white/30 text-white/70 hover:border-dh-accent hover:text-dh-accent bg-white/5'
                        }`}
                      >
                        {savedMatchQuestions.has(currentQ._id || currentQ.questionId || currentQ.questionText) ? '★ Saved' : '☆ Save Question'}
                      </button>
                    )}
                    
                    {currentQ.hasDiagram && currentQ.diagramUrl && (
                      <div className="w-full max-w-sm my-2 flex justify-center">
                        <img 
                          src={currentQ.diagramUrl} 
                          alt="Diagram" 
                          className="w-full rounded-xl object-contain border border-white/20 bg-dh-surface/60 max-h-48"
                        />
                      </div>
                    )}
                  </div>

                  {/* =========================================
                      OPTIONS GRID (2x2)
                      ========================================= */}
                  <div className={`relative w-full grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3.5 pb-2 ${isTableOrLongQuestion ? 'max-w-2xl' : ''}`}>
                    {Object.entries(currentQ.options).map(([key, value]) => {
                      const keyUpper = key.toUpperCase();
                      const isCorrect = keyUpper === correctOption;
                      const isPlayerSelected = keyUpper === selectedOption;
                      const isOpponentSelected = keyUpper === opponentSelected;
                      const isEliminated = eliminatedOptions.includes(keyUpper);

                      let bgClass = "bg-white text-black";
                      
                      if (feedbackState) { // Revealed
                        if (isCorrect) {
                           bgClass = "bg-dh-accent text-white";
                        } else if (isPlayerSelected) {
                           bgClass = "bg-dh-red text-white";
                        } else if (isOpponentSelected) {
                           bgClass = "bg-[#444] text-white"; // Opponent picked wrong
                        } else {
                           bgClass = "bg-white text-black opacity-70";
                        }
                      } else { // Not revealed
                        if (isPlayerSelected) bgClass = "bg-dh-accent text-white";
                        else if (isEliminated) bgClass = "bg-slate-900/60 text-slate-500 line-through border-2 border-dashed border-cyan-500/40 cursor-not-allowed opacity-30";
                      }

                      return (
                        <button
                          key={key}
                          onClick={() => !feedbackState && !isEliminated && handleAnswer(keyUpper)}
                          disabled={!!feedbackState || !!selectedOption || isEliminated}
                          className={`relative w-full ${
                            isTableOrLongQuestion 
                              ? 'p-3 sm:p-4 min-h-[52px] sm:min-h-[60px] text-xs sm:text-sm md:text-base' 
                              : 'p-4 md:p-6 min-h-[70px] md:min-h-[80px] text-base sm:text-lg md:text-xl'
                          } flex items-center justify-center text-center font-bold rounded-xl transition-all duration-150 ${bgClass} hover:opacity-90 active:scale-[0.98] overflow-hidden shadow-sm`}
                        >
                          {/* Player Avatar Indicator (Left) */}
                          {(isPlayerSelected || (feedbackState && isPlayerSelected)) && (
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full border-2 border-white bg-dh-accent shadow-lg z-20">
                               <img src={playerAvatar} alt="You" className="w-full h-full rounded-full" />
                            </div>
                          )}
                          
                          {/* Opponent Avatar Indicator (Right) - ONLY SHOW AFTER REVEAL */}
                          {(feedbackState && isOpponentSelected) && (
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full border-2 border-white bg-dh-red shadow-lg z-20">
                               <img src={opponentAvatar} alt="Opp" className="w-full h-full rounded-full" />
                            </div>
                          )}
                          
                          <span className="relative z-10 w-full px-8 leading-snug"><LatexRenderer text={value} /></span>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
            
            {/* Tactical Power-Up Dock */}
            <PowerUpDock
              powerupSlot={powerupSlot}
              onActivate={handleActivatePowerup}
              disabled={!!selectedOption || !!feedbackState}
              isActivating={isActivatingPowerup}
            />

          </div>
        </div>
      )}

      {/* Floating Action Button Emote Menu */}
      {matchPhase === 'active' && (
        <FloatingEmoteMenu
          onSendReaction={sendReaction}
          mutedOpponent={mutedReactions}
          onToggleMute={toggleMuteReactions}
          disabled={isMatchOver}
        />
      )}

      {/* Floating Reaction Stream Particles */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {activeReactions.map(r => (
          <div 
            key={r.id} 
            className="absolute text-3xl sm:text-4xl animate-particle-stream select-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.6)]"
            style={{ 
              left: r.isSelf ? 'calc(80% + 15px)' : 'calc(20% - 15px)', 
              bottom: '15%',
              '--rot': r.isSelf ? '12deg' : '-12deg'
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MatchScreen;