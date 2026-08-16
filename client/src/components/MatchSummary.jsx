import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LatexRenderer from './LatexRenderer';
import { socket } from '../socket';
import api, { getAvatarUrl } from '../api';
import Confetti from './Confetti';
import { sounds } from '../utils/sound';

/* ---------- Pure CSS Ambient Particles ---------- */
const Particles = ({ color = '#fbbf24', count = 12 }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {Array.from({ length: count }).map((_, i) => (
      <span
        key={i}
        className="absolute bottom-0 h-1.5 w-1.5 rounded-full opacity-0"
        style={{
          left: `${(i * 91) % 100}%`,
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: `dh-particle ${1.5 + (i % 4) * 0.4}s ease-out ${i * 0.15}s infinite`,
        }}
      />
    ))}
  </div>
);

const MatchSummary = ({ summaryData, subject, matchPayload }) => {
  const navigate = useNavigate();
  const [savedQuestions, setSavedQuestions] = useState(new Set());
  const [rematchStatus, setRematchStatus] = useState('none');
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [opponentRequestedRematch, setOpponentRequestedRematch] = useState(false);
  const [friendStatus, setFriendStatus] = useState('none');
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (summaryData.winner === 'user') {
      setShowConfetti(true);
      const c = summaryData.conquest;
      if (c && typeof c === 'object' && c.type === 'captured') {
        sounds.capture();
      } else {
        sounds.win();
      }
    } else if (summaryData.winner === 'opponent') {
      sounds.damage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleRematchStatus = (data) => {
      setAcceptedCount(data.acceptedCount);
      const oppId = matchPayload?.opponent?.id;
      const oppName = matchPayload?.opponent?.username;
      if (
        (oppId && data.requestedByUserIds?.includes(oppId.toString())) ||
        (oppName && data.lastRequesterUsername === oppName)
      ) {
        setOpponentRequestedRematch(true);
        sounds.success?.();
      }
    };
    
    const handleRematchAccepted = (payload) => {
      setRematchStatus('accepted');
      sounds.capture();
      setTimeout(() => {
         navigate('/match', { 
           state: { 
             matchData: payload, 
             remountKey: `${payload.roomId || 'rematch'}_${Date.now()}` 
           }, 
           replace: true 
         });
      }, 1500);
    };

    socket.on('rematch_status', handleRematchStatus);
    socket.on('rematch_accepted', handleRematchAccepted);

    return () => {
      socket.off('rematch_status', handleRematchStatus);
      socket.off('rematch_accepted', handleRematchAccepted);
    };
  }, [navigate, matchPayload]);

  const handleRematch = () => {
    setRematchStatus('waiting');
    socket.emit('request_rematch', { roomId: matchPayload.roomId });
  };

  const handleDashboard = () => {
    navigate('/dashboard');
  };

  const handleSaveQuestion = async (q) => {
    try {
      await api.post('/api/bookmarks', {
        questionId: q.questionId,
        questionText: q.questionText,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation,
        subject: subject
      });
      
      setSavedQuestions(prev => {
        const newSet = new Set(prev);
        newSet.add(q.questionId || q.questionText);
        return newSet;
      });
    } catch (err) {
      console.error('Failed to save question:', err);
      alert('Could not save the question. Please try again.');
    }
  };

  const { winner, userStats, botStats, questionsReview, conquest } = summaryData;

  let bannerConfig = { gradient: 'from-dh-card to-dh-surface', text: 'Draw', textColor: 'text-dh-text', emoji: '🤝' };
  if (winner === 'user') {
    bannerConfig = { gradient: 'from-emerald-500/30 via-dh-card to-emerald-500/20', text: 'Victory!', textColor: 'text-emerald-400', emoji: '🏆' };
  } else if (winner === 'opponent') {
    bannerConfig = { gradient: 'from-rose-500/30 via-dh-card to-rose-500/20', text: 'Defeat', textColor: 'text-rose-400', emoji: '💀' };
  }

  if (rematchStatus === 'accepted') {
     const playerName = matchPayload?.player?.username || 'You';
     const opponentName = matchPayload?.opponent?.username || 'Opponent';
     const playerAvatar = getAvatarUrl(matchPayload?.player?.avatarSeed || playerName);
     const opponentAvatar = getAvatarUrl(matchPayload?.opponent?.avatarSeed || opponentName);
     return (
       <div className="fixed inset-0 z-50 bg-dh-bg flex flex-col items-center justify-center overflow-hidden">
         {/* Ambient corner glows */}
         <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-dh-accent/10 blur-3xl" />
         <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-dh-red/10 blur-3xl" />

         <span className="inline-block text-[10px] font-heading font-black uppercase tracking-[0.3em] text-dh-accent mb-6 px-3 py-1 rounded-full bg-dh-accent/10 border border-dh-accent/20">
           Rematch Accepted
         </span>

         {/* Avatars facing off */}
         <div className="flex items-center gap-6 mb-8">
           <div className="flex flex-col items-center">
             <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-dh-accent to-dh-yellow shadow-lg shadow-dh-accent/20">
               <img src={playerAvatar} alt={playerName} className="w-full h-full rounded-full object-cover bg-dh-card" />
             </div>
             <p className="text-dh-text font-heading font-bold text-sm mt-3">{playerName}</p>
           </div>
           <div className="text-2xl font-heading font-black text-dh-yellow animate-pulse">VS</div>
           <div className="flex flex-col items-center">
             <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-dh-red to-orange-500 shadow-lg shadow-dh-red/20">
               <img src={opponentAvatar} alt={opponentName} className="w-full h-full rounded-full object-cover bg-dh-card" />
             </div>
             <p className="text-dh-text font-heading font-bold text-sm mt-3">{opponentName}</p>
           </div>
         </div>

         <h1 className="text-3xl md:text-4xl font-heading font-black text-white uppercase tracking-widest text-center animate-dh-pop">
           Rematch <span className="text-dh-accent">On!</span>
         </h1>
         <p className="text-dh-text-muted text-sm mt-2 mb-8">
           {summaryData?.roundNumber ? `Round ${summaryData.roundNumber + 1}. Settle the score. ⚔️` : 'Round two. Settle the score. ⚔️'}
         </p>

         {/* Arena loading bar */}
         <div className="w-56 h-1.5 rounded-full bg-dh-card overflow-hidden">
           <div className="h-full rounded-full bg-gradient-to-r from-dh-accent to-dh-yellow animate-arena-fill" />
         </div>
         <p className="text-dh-accent font-heading font-black text-[11px] uppercase tracking-[0.3em] mt-3">
           Entering the arena…
         </p>
       </div>
     );
  }

  const isDecider = summaryData.rivalry?.isDecider;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 bg-dh-surface rounded-3xl shadow-2xl border border-dh-border" style={{ animation: 'fadeInUp 0.5s ease-out forwards' }}>
      {showConfetti && <Confetti />}
      
      {/* Banner */}
      <div className={`w-full py-6 rounded-2xl mb-4 text-center bg-gradient-to-r ${bannerConfig.gradient} border border-slate-700/50 relative overflow-hidden shadow-lg backdrop-blur-xl`}>
        <Particles color={winner === 'user' ? '#00e676' : '#ff4b4b'} count={14} />
        <span className="text-3xl mb-1 block">{bannerConfig.emoji}</span>
        <h1 className={`text-3xl md:text-5xl font-heading font-black uppercase tracking-widest ${bannerConfig.textColor} relative z-10 drop-shadow-[0_0_20px_currentColor]`}>
          {bannerConfig.text}
        </h1>
        <p className="relative z-10 text-xs font-medium text-slate-400 mt-1">
          {winner === 'user' ? 'Dominance asserted. Well played! 🏆' : 'Close battle. Run it back? ⚔️'}
        </p>
      </div>

      {/* Perfect Recall 100% Accuracy Banner */}
      {userStats.isPerfectRecall && (
        <div className="animate-dh-pop relative overflow-hidden w-full mb-5 py-3.5 px-5 rounded-2xl border border-amber-400/60 bg-slate-800/90 shadow-[0_0_25px_rgba(251,191,36,0.2)] flex items-center justify-between text-left backdrop-blur-xl">
          <div className="animate-dh-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/10 to-transparent" />
          <div className="flex items-center gap-3 relative z-10">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400/15 text-2xl">🏆</span>
            <div>
              <p className="font-heading font-black text-amber-300 text-sm uppercase tracking-wider">
                PERFECT RECALL! (100% ACCURACY)
              </p>
              <p className="text-xs text-amber-200/80 font-body">Flawless match! Mastery bonus awarded: +25% Subject XP & Bonus Coins</p>
            </div>
          </div>
          <span className="relative z-10 text-xs font-heading font-black bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 px-3 py-1 rounded-full uppercase tracking-wider shadow-[0_0_12px_rgba(251,191,36,0.5)]">
            +25% XP
          </span>
        </div>
      )}

      {/* Head to Head Rivalry Banner (Session Series) */}
      {summaryData.rivalry && (
        <div className={`w-full mb-6 p-4 rounded-2xl border shadow-lg flex flex-col items-center relative overflow-hidden backdrop-blur-xl transition-all ${
          isDecider 
            ? 'border-amber-400/70 shadow-[0_0_30px_rgba(251,191,36,0.25)] bg-gradient-to-br from-slate-800/90 to-amber-950/40' 
            : 'border-slate-700/60 bg-slate-800/90'
        }`}>
          {isDecider && <Particles color="#fbbf24" count={10} />}
          {isDecider && (
            <div className="relative mb-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[10px] font-heading font-black uppercase tracking-[0.25em] text-amber-300 drop-shadow-[0_0_8px_#fbbf24]">
              👑 Series Decider • Game 3
            </div>
          )}
          <div className={`flex items-center gap-2 mb-2 ${isDecider ? '' : 'mt-1'}`}>
            <span className={`text-xs font-heading font-black uppercase tracking-widest ${isDecider ? 'text-amber-300' : 'text-dh-accent'}`}>
              {isDecider ? '⚔️ The Deciding Match' : '⚔️ Session Rivalry Series'}
            </span>
            {summaryData.roundNumber && (
              <span className="text-[10px] bg-dh-surface border border-dh-border text-dh-text-muted px-2 py-0.5 rounded-full font-heading font-bold">
                Game #{summaryData.roundNumber}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-8 my-1">
            <div className="text-center">
              <span className="block text-3xl font-mono font-black tabular-nums text-dh-green">
                {summaryData.rivalry.myWins}
              </span>
              <span className="text-xs font-heading font-bold text-dh-text-muted uppercase">You</span>
            </div>
            <div className="text-xs font-heading font-black text-dh-text-muted tracking-widest uppercase">
              VS
            </div>
            <div className="text-center">
              <span className={`block text-3xl font-mono font-black tabular-nums ${isDecider ? 'text-amber-300' : 'text-dh-red'}`}>
                {summaryData.rivalry.opponentWins}
              </span>
              <span className="text-xs font-heading font-bold text-dh-text-muted uppercase">
                {matchPayload?.opponent?.username || 'Opponent'}
              </span>
            </div>
          </div>
          <p className="text-[10px] font-heading text-dh-text-muted mt-1">Series resets when returning to Dashboard</p>
        </div>
      )}

      {/* Conquest notification */}
      {conquest && (() => {
        const c = typeof conquest === 'string' ? { type: 'captured', stateName: conquest } : conquest;
        const cfg = {
          captured: { emoji: '🗺️', text: `You captured ${c.stateName}! 🏆`, cls: 'from-dh-green/20 to-dh-accent/20 border-dh-green/40', txt: 'text-dh-green' },
          damaged: { emoji: '💥', text: `Siege successful! ${c.stateName}'s castle dropped to Lv${c.castleLevel}. Win again to capture it!`, cls: 'from-dh-yellow/20 to-dh-secondary/20 border-dh-yellow/40', txt: 'text-dh-yellow' },
          shielded: { emoji: '🛡️', text: `${c.stateName} is under shield protection. Attack again once it expires!`, cls: 'from-dh-blue/20 to-dh-purple/20 border-dh-blue/40', txt: 'text-dh-blue' },
        }[c.type];
        if (!cfg) return null;
        return (
          <div className={`w-full mb-6 py-4 px-5 rounded-2xl bg-gradient-to-r ${cfg.cls} border text-center animate-pulse`}>
            <span className="text-2xl mr-2">{cfg.emoji}</span>
            <span className={`font-heading font-bold ${cfg.txt} text-lg`}>{cfg.text}</span>
          </div>
        );
      })()}

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-dh-card/90 p-5 rounded-2xl border border-emerald-500/30 flex flex-col items-center backdrop-blur-md">
          <h2 className="text-sm font-heading font-bold text-emerald-400 mb-1 uppercase tracking-wider">You</h2>
          <div className="text-4xl font-mono font-black tabular-nums text-emerald-400 mb-1">{userStats.score} pts</div>
          <p className="text-emerald-400/80 font-semibold mb-2 text-xs">{userStats.correctAnswers} Correct Answers</p>
          <div className="flex gap-4 mt-1">
            <p className={`font-heading font-bold text-xs ${userStats.eloChange > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {userStats.eloChange > 0 ? '+' : ''}{userStats.eloChange} ELO
            </p>
            <p className="font-heading font-bold text-xs text-sky-400">
              +{userStats.xpGained || 0} XP
            </p>
          </div>
        </div>

        <div className="bg-dh-card/90 p-5 rounded-2xl border border-rose-500/30 flex flex-col items-center backdrop-blur-md">
          <h2 className="text-sm font-heading font-bold text-rose-400 mb-1 uppercase tracking-wider">{matchPayload?.opponent?.username || 'Opponent'}</h2>
          <div className="text-4xl font-mono font-black tabular-nums text-rose-400 mb-1">{botStats.score} pts</div>
          <p className="text-rose-400/80 font-semibold text-xs">{botStats.correctAnswers} Correct Answers</p>
        </div>
      </div>

      {/* Smart Near-Miss / Match Attribution Insight */}
      {(() => {
        const scoreDiff = Math.abs(userStats.score - botStats.score);
        let insight = null;
        if (winner === 'opponent') {
          if (userStats.correctAnswers === botStats.correctAnswers && userStats.correctAnswers > 0) {
            insight = { emoji: '⚡', title: 'Equal Accuracy!', desc: `Both answered ${userStats.correctAnswers} correctly. Response speed decided the match.`, border: 'border-sky-400/30 bg-sky-950/20 text-sky-300' };
          } else if (scoreDiff <= 40) {
            insight = { emoji: '🔥', title: 'Heartbreaker!', desc: `Lost by only ${scoreDiff} points! Settle the score in a rematch?`, border: 'border-amber-400/30 bg-amber-950/20 text-amber-300' };
          } else {
            insight = { emoji: '🧠', title: 'Learning Opportunity', desc: 'Review the missed questions below to master them for next time.', border: 'border-slate-700 bg-dh-card text-dh-text-muted' };
          }
        } else if (winner === 'user') {
          if (scoreDiff <= 30) {
            insight = { emoji: '🛡️', title: 'Clutch Victory!', desc: `Held on by just ${scoreDiff} points! Defend your lead in Round 2.`, border: 'border-emerald-400/30 bg-emerald-950/20 text-emerald-300' };
          } else {
            insight = { emoji: '👑', title: 'Dominant Win!', desc: `Outstanding recall! +${userStats.xpGained || 0} XP gained.`, border: 'border-emerald-400/30 bg-emerald-950/20 text-emerald-300' };
          }
        }
        if (!insight) return null;
        return (
          <div className={`w-full mb-4 p-3.5 rounded-2xl border ${insight.border} flex items-center gap-3 animate-dh-pop shadow-sm backdrop-blur-md`}>
            <span className="text-2xl flex-shrink-0">{insight.emoji}</span>
            <div className="min-w-0 text-left">
              <p className="font-heading font-black text-xs uppercase tracking-wide">{insight.title}</p>
              <p className="text-xs font-body opacity-90 mt-0.5">{insight.desc}</p>
            </div>
          </div>
        );
      })()}

      {/* Opponent Rematch Alert Banner */}
      {opponentRequestedRematch && rematchStatus !== 'waiting' && rematchStatus !== 'accepted' && (
        <div className="w-full mb-3 py-3 px-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-between animate-bounce">
          <span className="text-sm font-heading font-black text-emerald-300 flex items-center gap-2">
            <span>🔥</span> {matchPayload?.opponent?.username || 'Opponent'} is waiting for a rematch!
          </span>
          <span className="text-xs bg-emerald-400 text-black font-heading font-black px-2.5 py-0.5 rounded-full uppercase">
            1/2 Ready
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2.5 mb-6">
        <button
          onClick={handleRematch}
          disabled={rematchStatus === 'waiting'}
          className={`group relative w-full overflow-hidden rounded-2xl py-4 text-base font-heading font-black tracking-wide text-slate-950 transition-transform active:scale-[0.98] ${
            rematchStatus === 'waiting'
              ? 'bg-dh-accent/30 text-dh-accent-light cursor-wait animate-pulse border border-dh-accent/30'
              : isDecider
              ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.45)]'
              : 'bg-gradient-to-r from-emerald-400 via-dh-accent to-emerald-400 shadow-[0_0_28px_rgba(0,230,118,0.4)]'
          }`}
        >
          <span className="animate-dh-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <span className="relative">
            {rematchStatus === 'waiting'
              ? `⏳ Waiting for ${matchPayload?.opponent?.username || 'Opponent'}...`
              : opponentRequestedRematch
              ? `⚡ Accept ${matchPayload?.opponent?.username || 'Opponent'}'s Rematch`
              : isDecider ? 'Fight Decider Match 👑' : 'Request Rematch 🤝'}
          </span>
          <span className="relative ml-2 rounded-full bg-slate-950/20 px-2 py-0.5 text-[11px] font-heading font-black text-slate-900">
            {acceptedCount > 0 ? `${acceptedCount}/2 Ready` : '1v1'}
          </span>
        </button>

        <div className="flex gap-2.5">
          <button
            onClick={handleDashboard}
            disabled={rematchStatus !== 'none'}
            className="flex-1 rounded-2xl border border-slate-700 bg-dh-card/90 py-3 text-sm font-heading font-bold text-slate-300 backdrop-blur-md transition-colors hover:border-slate-500 hover:text-white active:scale-[0.98] disabled:opacity-50"
          >
            Back to Dashboard
          </button>
          <button
            onClick={async () => {
              const shareText = `⚔️ DHEETH Battle: I scored ${userStats.score} pts (${userStats.correctAnswers}/${questionsReview.length} correct) in ${subject}! Can you beat my score? 🚀`;
              if (navigator.share) {
                try { await navigator.share({ title: 'Dheeth 1v1 Battle Result', text: shareText }); } catch (_) {}
              } else {
                await navigator.clipboard.writeText(shareText);
                alert('Battle result copied to clipboard! 📋');
              }
            }}
            className="flex-1 rounded-2xl border border-sky-400/40 bg-sky-400/10 py-3 text-sm font-heading font-bold text-sky-300 backdrop-blur-md transition-colors hover:bg-sky-400/20 active:scale-[0.98]"
          >
            Share Battle Report 📤
          </button>
        </div>
      </div>

      {/* Friend Request */}
      {matchPayload?.opponent?.username && friendStatus === 'none' && (
        <button
          onClick={async () => {
            try {
              await api.post('/api/friends/request', { username: matchPayload.opponent.username });
              setFriendStatus('sent');
            } catch (err) {
              alert(err.response?.data?.message || 'Failed to send request');
            }
          }}
          className="w-full mb-8 py-2.5 rounded-2xl font-heading font-bold text-xs border border-dh-accent/30 text-dh-accent-light hover:bg-dh-accent/10 transition-all"
        >
          + Add {matchPayload.opponent.username} as Friend
        </button>
      )}
      {friendStatus === 'sent' && (
        <p className="text-center text-dh-green font-heading font-bold text-xs mb-8">✓ Friend request sent to {matchPayload?.opponent?.username}</p>
      )}

      {/* Match Review Section */}
      <div className="border-t border-dh-border pt-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg md:text-xl font-heading font-bold text-dh-text">Match Review</h3>
          <span className="text-xs font-heading font-bold text-dh-text-muted">
            {userStats.correctAnswers}/{questionsReview.length} Correct
          </span>
        </div>
        <div className="space-y-4">
          {questionsReview.map((q, idx) => {
            const toOptionStr = (val) => {
              if (!val) return '';
              if (typeof val === 'string') return val;
              if (typeof val === 'object' && val.selectedOption) return String(val.selectedOption);
              return String(val);
            };

            const userOpt = toOptionStr(q.userSelectedOption);
            const oppOpt = toOptionStr(q.opponentSelectedOption);
            const correctOpt = toOptionStr(q.correctOption);

            const isUserCorrect = Boolean(userOpt && correctOpt && userOpt.toLowerCase() === correctOpt.toLowerCase());
            const isOppCorrect = Boolean(oppOpt && correctOpt && oppOpt.toLowerCase() === correctOpt.toLowerCase());
            const isSaved = savedQuestions.has(q.questionId || q.questionText);

            return (
              <div 
                key={idx} 
                className={`rounded-2xl p-4 md:p-5 border transition-all backdrop-blur-md ${
                  q.isSwingQuestion 
                    ? 'bg-amber-950/20 border-amber-500/60 shadow-[0_0_20px_rgba(251,191,36,0.15)] relative' 
                    : 'bg-dh-card/90 border-slate-700/60'
                }`}
              >
                {q.isSwingQuestion && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-heading font-black text-[10px] uppercase tracking-wider mb-3 shadow-sm">
                    ⚡ Pivotal Swing Question (Decided Match)
                  </div>
                )}
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div className="flex-1 text-sm md:text-base font-semibold text-dh-text">
                    <span className="text-dh-text-muted mr-2 font-bold">{idx + 1}.</span>
                    <LatexRenderer text={q.questionText} />
                  </div>
                  <button 
                    onClick={() => handleSaveQuestion(q)}
                    disabled={isSaved}
                    className={`flex-shrink-0 text-xl transition-colors ${isSaved ? 'text-amber-400' : 'text-dh-text-muted hover:text-amber-400'}`}
                    title="Bookmark Question"
                  >
                    {isSaved ? '★' : '☆'}
                  </button>
                </div>

                {q.hasDiagram && q.diagramUrl && (
                  <div className="my-3 flex justify-center">
                    <img src={q.diagramUrl} alt="Question Diagram" className="max-h-48 rounded-xl border border-dh-border object-contain bg-dh-surface/60 p-1" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3">
                  {Object.entries(q.options || {}).map(([key, opt]) => {
                    const optLetter = key.toUpperCase();
                    let optClass = "bg-dh-surface/80 border-slate-700 text-dh-text-muted";
                    
                    if (correctOpt && optLetter.toLowerCase() === correctOpt.toLowerCase()) {
                      optClass = "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 font-heading font-bold";
                    } else if (userOpt && optLetter.toLowerCase() === userOpt.toLowerCase() && !isUserCorrect) {
                      optClass = "bg-rose-500/10 border-rose-500/50 text-rose-300";
                    }

                    return (
                      <div key={key} className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs ${optClass}`}>
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${correctOpt && optLetter.toLowerCase() === correctOpt.toLowerCase() ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-dh-text-muted'}`}>
                          {key}
                        </div>
                        <span className="flex-1 leading-snug"><LatexRenderer text={opt} /></span>
                      </div>
                    );
                  })}
                </div>

                {/* Clean player pick comparison chips */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className={`rounded-xl border px-3 py-2 flex items-center justify-between ${
                    isUserCorrect 
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' 
                      : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                  }`}>
                    <span className="font-heading font-bold text-[10px] uppercase opacity-75">You</span>
                    <span className="font-bold flex items-center gap-1.5">
                      {isUserCorrect ? '✓' : '✗'} {userOpt ? `Option ${userOpt}` : 'No answer'}
                    </span>
                  </div>
                  <div className={`rounded-xl border px-3 py-2 flex items-center justify-between ${
                    isOppCorrect 
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' 
                      : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                  }`}>
                    <span className="font-heading font-bold text-[10px] uppercase opacity-75">{matchPayload?.opponent?.username || 'Opponent'}</span>
                    <span className="font-bold flex items-center gap-1.5">
                      {isOppCorrect ? '✓' : '✗'} {oppOpt ? `Option ${oppOpt}` : 'No answer'}
                    </span>
                  </div>
                </div>

                {q.explanation && (
                  <div className="mt-3.5 p-3.5 bg-dh-surface/90 border border-slate-700/80 rounded-xl">
                    <h4 className="text-dh-accent font-heading font-bold mb-1.5 text-xs flex items-center gap-1.5">
                      <span>💡</span> Solution & Concept:
                    </h4>
                    <div className="text-dh-text text-xs leading-relaxed">
                      <LatexRenderer text={q.explanation} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MatchSummary;