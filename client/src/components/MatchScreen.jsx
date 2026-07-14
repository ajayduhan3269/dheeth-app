import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import Latex from 'react-latex-next';
import MatchSummary from './MatchSummary';
import api, { getAvatarUrl } from '../api';
import { sounds } from '../utils/sound';
import { formatLatex } from '../utils/latex';

const MatchScreen = ({ matchPayload }) => {
  const [matchPhase, setMatchPhase] = useState('intro');
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerCorrectCount, setPlayerCorrectCount] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentCorrectCount, setOpponentCorrectCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isMatchOver, setIsMatchOver] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [activeReactions, setActiveReactions] = useState([]);
  const [playerStreak, setPlayerStreak] = useState(0);
  const [feedbackState, setFeedbackState] = useState(null);
  const [correctOption, setCorrectOption] = useState(null);
  const [opponentSelected, setOpponentSelected] = useState(null);
  const [showLightning, setShowLightning] = useState(false);
  const [vibrate, setVibrate] = useState(false);
  const [scoreDiff, setScoreDiff] = useState(null);
  const prevScoreRef = useRef(0);
  const [savedMatchQuestions, setSavedMatchQuestions] = useState(new Set());

  useEffect(() => {
    const introTimer = setTimeout(() => {
      setMatchPhase('active');
    }, 2500);
    return () => clearTimeout(introTimer);
  }, []);

  useEffect(() => {
    socket.on('timer_tick', (data) => {
      setTimeLeft(data.timeLeft);
      if (data.timeLeft <= 5 && data.timeLeft > 0) sounds.tick();
    });

    socket.on('score_update', (data) => {
      const me = data.players[matchPayload.player.id] || data.players[socket.id];
      const opp = data.players[matchPayload.opponent.id] || Object.values(data.players).find(p => p.socketId !== socket.id && p.socketId !== matchPayload.player.id);
      if (me) {
        setPlayerScore(me.score);
        setPlayerCorrectCount(me.correctAnswers || 0);
        const diff = me.score - prevScoreRef.current;
        if (diff > 0) {
          const newKey = Date.now();
          setScoreDiff({ value: diff, key: newKey });
          setTimeout(() => {
            setScoreDiff(prev => (prev && prev.key === newKey ? null : prev));
          }, 1500);
        }
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
      } else {
        sounds.wrong();
        setVibrate(true);
        setTimeout(() => setVibrate(false), 500);
      }
    });

    socket.on('reveal_answers', (data) => {
      setCorrectOption(data.correctOption?.toUpperCase() || null);
      const opponentData = Object.values(data.players).find(p => p.userId === matchPayload.opponent.id);
      setOpponentSelected(opponentData?.answers?.[data.questionIndex]?.toUpperCase() || null);
    });

    socket.on('match_over', (data) => {
      setIsMatchOver(true);
      setSummaryData(data);
    });

    socket.on('next_question', (data) => {
      setCurrentIndex(data.questionIndex);
      setSelectedOption(null);
      setFeedbackState(null);
      setCorrectOption(null);
      setOpponentSelected(null);
    });

    socket.on('receive_reaction', (data) => {
      const id = Date.now();
      setActiveReactions(prev => [...prev, { emoji: data.emoji, id }]);
      setTimeout(() => setActiveReactions(prev => prev.filter(r => r.id !== id)), 2000);
    });

    return () => {
      socket.off('timer_tick');
      socket.off('score_update');
      socket.off('answer_result');
      socket.off('reveal_answers');
      socket.off('match_over');
      socket.off('next_question');
      socket.off('receive_reaction');
    };
  }, [matchPayload]);

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
    socket.emit('send_reaction', { roomId: matchPayload.roomId, emoji });
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
  const timerPercent = (timeLeft / 60) * 100;
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

      {/* Intro Animation */}
      {matchPhase === 'intro' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="animate-match-found text-center">
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="flex flex-col items-center">
                <img src={playerAvatar} alt="You" className="w-20 h-20 rounded-full border-3 border-dh-accent shadow-lg shadow-dh-accent/40 bg-dh-card" />
                <p className="text-dh-text font-heading font-bold text-sm mt-2">{matchPayload.player.username}</p>
              </div>
              <div className="text-3xl font-heading font-black text-dh-secondary animate-pulse">VS</div>
              <div className="flex flex-col items-center">
                <img src={opponentAvatar} alt="Opponent" className="w-20 h-20 rounded-full border-3 border-dh-red shadow-lg shadow-dh-red/40 bg-dh-card" />
                <p className="text-dh-text font-heading font-bold text-sm mt-2">{matchPayload.opponent.username}</p>
              </div>
            </div>
            <div className="text-dh-accent text-lg font-heading font-bold animate-pulse">MATCH FOUND!</div>
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
                  <div className="absolute -inset-1 bg-dh-accent rounded-full opacity-70 blur-[2px]"></div>
                  <img 
                    src={playerAvatar}
                    alt="You"
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full relative z-10 border-2 border-dh-accent bg-dh-card"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm md:text-base text-white">
                    {matchPayload.player.username}
                  </span>
                  <span className="font-black text-xl md:text-2xl text-dh-accent tracking-wider">
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
                  className={`text-3xl md:text-5xl font-black text-[#1cb0f6] ${timeLeft <= 5 ? 'animate-pulse-fast !text-dh-red text-shadow-red' : ''}`}
                  style={{ textShadow: timeLeft <= 5 ? '0 0 10px #ff4b4b' : 'none' }}
                >
                  {timeLeft}
                </span>
              </div>

              {/* Opponent Section (Right) */}
              <div className="flex items-center gap-3 justify-end">
                <div className="flex flex-col items-end">
                  <span className="font-bold text-sm md:text-base text-white">
                    {matchPayload.opponent.username}
                  </span>
                  <span className="font-black text-xl md:text-2xl text-dh-red tracking-wider">
                    {opponentScore}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute -inset-1 bg-dh-red rounded-full opacity-70 blur-[2px]"></div>
                  <img 
                    src={opponentAvatar}
                    alt="Opponent"
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full relative z-10 border-2 border-dh-red bg-dh-card"
                  />
                </div>
              </div>
            </div>

            {/* Score popup */}
            {scoreDiff && (
              <div key={scoreDiff.key} className="absolute top-20 left-12 z-40 animate-slide-up pointer-events-none">
                <span className="text-dh-accent text-2xl font-black drop-shadow-[0_0_8px_#00e676]">+{scoreDiff.value}</span>
              </div>
            )}

            {/* =========================================
                QUESTION AREA
                ========================================= */}
            <div className="w-full flex flex-col items-center flex-1 justify-center mb-6">
              <h2 className="text-2xl md:text-4xl font-normal text-center text-white mb-6 leading-tight max-w-2xl px-2">
                <Latex>{formatLatex(currentQ.questionText)}</Latex>
              </h2>

              {/* Bookmark button — appears after answer reveal */}
              {feedbackState && (
                <button
                  onClick={() => handleSaveMatchQuestion(currentQ)}
                  disabled={savedMatchQuestions.has(currentQ._id || currentQ.questionId || currentQ.questionText)}
                  className={`mb-4 px-4 py-1.5 rounded-full border-2 text-sm font-heading font-bold transition-all duration-200 ${
                    savedMatchQuestions.has(currentQ._id || currentQ.questionId || currentQ.questionText)
                      ? 'border-dh-accent text-dh-accent bg-dh-accent/10'
                      : 'border-white/30 text-white/70 hover:border-dh-accent hover:text-dh-accent bg-white/5'
                  }`}
                >
                  {savedMatchQuestions.has(currentQ._id || currentQ.questionId || currentQ.questionText) ? '★ Saved' : '☆ Save'}
                </button>
              )}
              
              {currentQ.hasDiagram && currentQ.diagramUrl && (
                <div className="w-full max-w-sm mb-6 flex justify-center">
                  <img 
                    src={currentQ.diagramUrl} 
                    alt="Diagram" 
                    className="w-full rounded-md object-contain border border-white/20 bg-dh-surface/60"
                    style={{ maxHeight: '250px' }}
                  />
                </div>
              )}
            </div>

            {/* =========================================
                OPTIONS GRID (2x2)
                ========================================= */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 pb-4">
              {Object.entries(currentQ.options).map(([key, value]) => {
                const keyUpper = key.toUpperCase();
                const isCorrect = keyUpper === correctOption;
                const isPlayerSelected = keyUpper === selectedOption;
                const isOpponentSelected = keyUpper === opponentSelected;
                
                // Pure QuizUp logic: 
                // Default: white background, black text.
                // If I selected it (and not revealed yet): Green background.
                // Upon reveal:
                // Correct answer becomes Green.
                // If I picked wrong, it stays Red.
                // We add little pointer triangles if player or opponent selected it.

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
                }

                return (
                  <button
                    key={key}
                    onClick={() => !feedbackState && handleAnswer(keyUpper)}
                    disabled={!!feedbackState || !!selectedOption}
                    className={`relative w-full p-4 md:p-6 min-h-[80px] flex items-center justify-center text-center text-lg md:text-xl font-bold rounded-sm transition-all duration-150 ${bgClass} hover:opacity-90 active:scale-[0.98] overflow-hidden`}
                  >
                    {/* Player Avatar Indicator (Left) */}
                    {(isPlayerSelected || (feedbackState && isPlayerSelected)) && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-dh-accent shadow-lg z-20">
                         <img src={playerAvatar} alt="You" className="w-full h-full rounded-full" />
                      </div>
                    )}
                    
                    {/* Opponent Avatar Indicator (Right) - ONLY SHOW AFTER REVEAL */}
                    {(feedbackState && isOpponentSelected) && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-dh-red shadow-lg z-20">
                         <img src={opponentAvatar} alt="Opp" className="w-full h-full rounded-full" />
                      </div>
                    )}
                    
                    <span className="relative z-10 w-full px-10"><Latex>{formatLatex(value)}</Latex></span>
                  </button>
                );
              })}
            </div>
            
            {/* Reaction Bar */}
            <div className="w-full flex items-center justify-center gap-6 py-2">
               {['😂', '🔥', '😢', '💀', '👀'].map((emoji, idx) => (
                 <button
                   key={idx}
                   onClick={() => sendReaction(emoji)}
                   className="text-2xl opacity-60 hover:opacity-100 hover:scale-125 hover:-translate-y-2 transition-all active:scale-90"
                 >
                   {emoji}
                 </button>
               ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Reactions */}
      {activeReactions.map(r => (
        <div key={r.id} className="floating-emoji animate-floatUp absolute text-4xl z-50 pointer-events-none" style={{ left: `${10 + Math.random() * 60}%`, bottom: '0' }}>{r.emoji}</div>
      ))}
    </div>
  );
};

export default MatchScreen;