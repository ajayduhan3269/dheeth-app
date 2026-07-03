import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Latex from 'react-latex-next';
import { socket } from '../socket';
import api, { getAvatarUrl } from '../api';
import Confetti from './Confetti';
import { sounds } from '../utils/sound';

const MatchSummary = ({ summaryData, subject, matchPayload }) => {
  const navigate = useNavigate();
  const [savedQuestions, setSavedQuestions] = useState(new Set());
  const [rematchStatus, setRematchStatus] = useState('none');
  const [acceptedCount, setAcceptedCount] = useState(0);
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
    };
    
    const handleRematchAccepted = (payload) => {
      setRematchStatus('accepted');
      sounds.capture();
      setTimeout(() => {
         navigate('/match', { state: { matchData: payload, remountKey: Date.now() }, replace: true });
      }, 2000);
    };

    socket.on('rematch_status', handleRematchStatus);
    socket.on('rematch_accepted', handleRematchAccepted);

    return () => {
      socket.off('rematch_status', handleRematchStatus);
      socket.off('rematch_accepted', handleRematchAccepted);
    };
  }, [navigate]);

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
    bannerConfig = { gradient: 'from-dh-green to-green-800', text: 'Victory!', textColor: 'text-black', emoji: '🏆' };
  } else if (winner === 'opponent') {
    bannerConfig = { gradient: 'from-dh-red to-red-800', text: 'Defeat', textColor: 'text-white', emoji: '💀' };
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

         <span className="inline-block text-[10px] font-heading font-black uppercase tracking-[0.3em]
           text-dh-green bg-dh-green/10 px-4 py-1.5 rounded-full border border-dh-green/30 mb-10"
           style={{ animation: 'pop-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
           ✓ Both players ready
         </span>

         {/* VS clash */}
         <div className="flex items-center justify-center gap-6 md:gap-14 mb-10">
           <div className="flex flex-col items-center animate-clash-left">
             <div className="relative">
               <span className="absolute -inset-1 rounded-full bg-dh-accent opacity-60 blur-[3px]" />
               <img src={playerAvatar} alt={playerName}
                 className="relative w-24 h-24 md:w-28 md:h-28 rounded-full border-2 border-dh-accent bg-dh-card" />
             </div>
             <p className="text-dh-text font-heading font-bold text-sm mt-3">{playerName}</p>
           </div>

           <div className="relative flex items-center justify-center">
             <span className="absolute -inset-4 rounded-full border-2 border-dh-yellow/30 animate-ping" />
             <span className="text-4xl md:text-5xl font-heading font-black text-dh-yellow drop-shadow-[0_0_15px_#ffc800] animate-pulse">
               VS
             </span>
           </div>

           <div className="flex flex-col items-center animate-clash-right">
             <div className="relative">
               <span className="absolute -inset-1 rounded-full bg-dh-red opacity-60 blur-[3px]" />
               <img src={opponentAvatar} alt={opponentName}
                 className="relative w-24 h-24 md:w-28 md:h-28 rounded-full border-2 border-dh-red bg-dh-card" />
             </div>
             <p className="text-dh-text font-heading font-bold text-sm mt-3">{opponentName}</p>
           </div>
         </div>

         <h1 className="text-3xl md:text-4xl font-heading font-black text-white uppercase tracking-widest text-center animate-pop-in">
           Rematch <span className="text-dh-accent">On!</span>
         </h1>
         <p className="text-dh-text-muted text-sm mt-2 mb-8">Round two. Settle the score. ⚔️</p>

         {/* Arena loading bar (fills over the 2s redirect) */}
         <div className="w-56 h-1.5 rounded-full bg-dh-card overflow-hidden">
           <div className="h-full rounded-full bg-gradient-to-r from-dh-accent to-dh-yellow animate-arena-fill" />
         </div>
         <p className="text-dh-accent font-heading font-black text-[11px] uppercase tracking-[0.3em] mt-3">
           Entering the arena…
         </p>
       </div>
     );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-5 md:p-8 bg-dh-surface rounded-2xl shadow-2xl border border-dh-border" style={{ animation: 'fadeInUp 0.5s ease-out forwards' }}>
      {showConfetti && <Confetti />}
      {/* Banner */}
      <div className={`w-full py-5 rounded-xl mb-4 text-center bg-gradient-to-r ${bannerConfig.gradient} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <span className="text-3xl mb-1 block">{bannerConfig.emoji}</span>
        <h1 className={`text-3xl md:text-4xl font-heading font-black uppercase tracking-widest ${bannerConfig.textColor} relative z-10`}>
          {bannerConfig.text}
        </h1>
      </div>

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
          <div className={`w-full mb-6 py-4 px-5 rounded-xl bg-gradient-to-r ${cfg.cls} border text-center animate-pulse`}>
            <span className="text-2xl mr-2">{cfg.emoji}</span>
            <span className={`font-heading font-bold ${cfg.txt} text-lg`}>{cfg.text}</span>
          </div>
        );
      })()}

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-dh-card p-6 rounded-xl border border-dh-green/20 flex flex-col items-center">
          <h2 className="text-lg font-heading font-bold text-dh-green mb-3">You</h2>
          <div className="text-4xl font-heading font-black text-dh-green mb-2">{userStats.score} pts</div>
          <p className="text-dh-green/70 font-semibold mb-2 text-sm">{userStats.correctAnswers} Correct Answers</p>
          <div className="flex gap-4 mt-1">
            <p className={`font-heading font-bold text-sm ${userStats.eloChange > 0 ? 'text-dh-green' : 'text-dh-red'}`}>
              {userStats.eloChange > 0 ? '+' : ''}{userStats.eloChange} ELO
            </p>
            <p className="font-heading font-bold text-sm text-dh-accent-light">
              +{userStats.xpGained || 0} XP
            </p>
          </div>
        </div>

        <div className="bg-dh-card p-6 rounded-xl border border-dh-red/20 flex flex-col items-center">
          <h2 className="text-lg font-heading font-bold text-dh-red mb-3">Opponent</h2>
          <div className="text-4xl font-heading font-black text-dh-red mb-2">{botStats.score} pts</div>
          <p className="text-dh-red/70 font-semibold text-sm">{botStats.correctAnswers} Correct Answers</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 mb-4">
        <button
          onClick={handleRematch}
          disabled={rematchStatus === 'waiting'}
          className={`flex-1 py-4 rounded-xl font-heading font-bold text-lg transition-all ${
            rematchStatus === 'waiting' 
              ? 'bg-dh-accent/30 text-dh-accent-light cursor-wait animate-pulse border border-dh-accent/30' 
              : 'bg-dh-accent hover:bg-yellow-400 text-black shadow-lg shadow-dh-accent/20 hover:shadow-dh-accent/40'
          }`}
        >
          {rematchStatus === 'waiting' ? `Waiting for Opponent... (${acceptedCount}/2)` : 'Request Rematch 🤝'}
        </button>
        <button
          onClick={handleDashboard}
          disabled={rematchStatus !== 'none'}
          className="flex-1 bg-dh-card hover:bg-dh-border text-dh-text py-4 rounded-xl font-heading font-bold text-lg transition-colors border border-dh-border disabled:opacity-50"
        >
          Back to Dashboard
        </button>
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
          className="w-full mb-10 py-3 rounded-xl font-heading font-bold text-sm border border-dh-accent/30 text-dh-accent-light hover:bg-dh-accent/10 transition-all"
        >
          + Add {matchPayload.opponent.username} as Friend
        </button>
      )}
      {friendStatus === 'sent' && (
        <p className="text-center text-dh-green font-heading font-bold text-sm mb-10">✓ Friend request sent to {matchPayload?.opponent?.username}</p>
      )}

      {/* Match Review */}
      <div className="border-t-2 border-dh-border pt-8">
        <h3 className="text-xl font-heading font-bold text-dh-text mb-6">Match Review</h3>
        <div className="space-y-5">
          {questionsReview.map((q, idx) => {
            const isUserCorrect = q.userSelectedOption?.toLowerCase() === q.correctOption?.toLowerCase();
            const isOppCorrect = q.opponentSelectedOption?.toLowerCase() === q.correctOption?.toLowerCase();
            const isSaved = savedQuestions.has(q.questionId || q.questionText);

            return (
              <div key={idx} className="bg-dh-card rounded-xl p-5 border border-dh-border">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="flex-1 text-base font-semibold text-dh-text">
                    <span className="text-dh-text-muted mr-2">{idx + 1}.</span>
                    <Latex>{q.questionText}</Latex>
                  </div>
                  <button 
                    onClick={() => handleSaveQuestion(q)}
                    disabled={isSaved}
                    className={`flex-shrink-0 text-2xl transition-colors ${isSaved ? 'text-dh-accent' : 'text-dh-text-muted hover:text-dh-accent'}`}
                    title="Bookmark Question"
                  >
                    {isSaved ? '★' : '☆'}
                  </button>
                </div>

                {q.hasDiagram && q.diagramUrl && (
                  <div className="my-4">
                    <img src={q.diagramUrl} alt="Question Diagram" className="max-w-full rounded-md border border-dh-border" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {Object.entries(q.options || {}).map(([key, opt]) => {
                    const optLetter = key.toUpperCase();
                    let optClass = "bg-dh-surface border-dh-border text-dh-text-muted";
                    
                    if (optLetter.toLowerCase() === q.correctOption?.toLowerCase()) {
                      optClass = "bg-dh-green/10 border-dh-green/40 text-dh-green font-heading font-bold";
                    } else if (optLetter.toLowerCase() === q.userSelectedOption?.toLowerCase() && !isUserCorrect) {
                      optClass = "bg-dh-red/10 border-dh-red/40 text-dh-red";
                    }

                    return (
                      <div key={key} className={`p-3 rounded-lg border flex items-center gap-3 ${optClass}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm ${optLetter.toLowerCase() === q.correctOption?.toLowerCase() ? 'bg-dh-green text-black' : 'bg-dh-border text-dh-text-muted'}`}>
                          {key}
                        </div>
                        <span className="flex-1"><Latex>{opt}</Latex></span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-6 mt-4 pt-4 border-t border-dh-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-heading font-bold text-dh-text-muted uppercase">You:</span>
                    <span className={`font-heading font-bold text-sm ${isUserCorrect ? 'text-dh-green' : 'text-dh-red'}`}>
                      {q.userSelectedOption || 'No Answer'} {isUserCorrect ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-heading font-bold text-dh-text-muted uppercase">Opponent:</span>
                    <span className={`font-heading font-bold text-sm ${isOppCorrect ? 'text-dh-green' : 'text-dh-red'}`}>
                      {q.opponentSelectedOption || 'No Answer'} {isOppCorrect ? '✓' : '✗'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 p-4 bg-dh-accent/5 border-l-4 border-dh-accent rounded-r-md">
                  <h4 className="text-dh-accent-light font-heading font-bold mb-2 text-sm">Explanation:</h4>
                  <div className="text-dh-text text-sm">
                    <Latex>{q.explanation || 'No explanation available.'}</Latex>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MatchSummary;