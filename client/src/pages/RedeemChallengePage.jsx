import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LatexRenderer from '../components/LatexRenderer';
import { sounds } from '../utils/sound';
import Confetti from '../components/Confetti';

const RedeemChallengePage = () => {
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [challengeCompleted, setChallengeCompleted] = useState(false);
  const [challengeSuccess, setChallengeSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    startRedeemChallenge();
  }, []);

  const startRedeemChallenge = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/mistakes/redeem/start');
      if (res.data?.ok) {
        setChallenge(res.data);
      }
    } catch (err) {
      console.error('Failed to start redeem challenge:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentQ = challenge?.questions?.[currentIndex];

  const handleAnswerSubmit = async (optKey) => {
    if (selectedOption || submitting || !currentQ) return;
    setSelectedOption(optKey);
    setSubmitting(true);
    sounds.click();

    try {
      const res = await api.post(`/api/mistakes/redeem/${challenge.challengeId}/answer`, {
        questionId: currentQ.questionId,
        selectedAnswer: optKey
      });

      if (res.data?.ok) {
        setCurrentResult(res.data);
        if (res.data.correct) {
          sounds.correct();
        } else {
          sounds.wrong();
        }

        if (res.data.allAnswered) {
          setChallengeCompleted(true);
          if (res.data.status === 'COMPLETED') {
            setChallengeSuccess(true);
            setShowConfetti(true);
            sounds.victory();
          }
        }
      }
    } catch (err) {
      console.error('Failed to submit challenge answer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    sounds.click();
    setSelectedOption(null);
    setCurrentResult(null);

    if (currentIndex + 1 < (challenge?.questions?.length || 0)) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dh-bg text-dh-text flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <span className="text-4xl animate-bounce inline-block">⚡</span>
            <p className="font-heading font-black text-white">Preparing Daily Redeem Challenge...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dh-bg text-dh-text flex flex-col pb-16">
      {showConfetti && <Confetti />}

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-6 space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/notebook')}
            className="text-xs font-heading font-bold text-dh-text-muted hover:text-white"
          >
            ← Exit Challenge
          </button>
          <span className="text-xs font-heading font-black text-dh-green px-3 py-1 rounded-full bg-dh-green/10 border border-dh-green/30">
            Redeem Gauntlet • Q{currentIndex + 1}/3
          </span>
        </div>

        {challengeCompleted ? (
          <div className="bg-dh-card border-2 border-dh-border rounded-3xl p-8 text-center space-y-6 shadow-2xl animate-fade-in">
            <span className="text-6xl">{challengeSuccess ? '🏆' : '💀'}</span>
            <h2 className="text-2xl font-heading font-black text-white">
              {challengeSuccess ? 'Challenge Mastered!' : 'Challenge Failed'}
            </h2>
            <p className="text-sm text-dh-text-muted">
              {challengeSuccess
                ? 'Flawless 3/3! You have successfully redeemed your errors and earned bonus rewards.'
                : 'You need 3/3 correct answers to claim the Redeem Challenge bonus. Keep practicing in the Smart Drill!'}
            </p>

            {challengeSuccess && (
              <div className="flex justify-center gap-4 py-2">
                <div className="px-5 py-3 rounded-2xl bg-dh-accent/10 border border-dh-accent/40 text-dh-accent-light font-heading font-black text-sm">
                  +75 XP Awarded
                </div>
                <div className="px-5 py-3 rounded-2xl bg-dh-green/10 border border-dh-green/40 text-dh-green font-heading font-black text-sm">
                  +50 Coins
                </div>
              </div>
            )}

            <button
              onClick={() => navigate('/notebook')}
              className="w-full py-4 rounded-2xl bg-dh-accent text-black font-heading font-black text-base shadow-lg shadow-dh-accent/20 active:scale-95 transition-all"
            >
              Back to Mistake Notebook
            </button>
          </div>
        ) : (
          <div className="bg-dh-card border-2 border-dh-border rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
            {/* Question Header */}
            <div className="flex items-center justify-between border-b border-dh-border/60 pb-3">
              <span className="text-xs font-heading font-black uppercase text-dh-text-muted">
                Redeem Challenge • Question {currentIndex + 1} of 3
              </span>
              <span className="text-[10px] font-heading font-black px-2.5 py-0.5 rounded-full bg-dh-accent/20 text-dh-accent-light border border-dh-accent/40 uppercase">
                High Stakes
              </span>
            </div>

            {/* Question Text */}
            <div className="text-lg md:text-xl font-medium text-white leading-relaxed">
              <LatexRenderer text={currentQ?.questionText || ''} />
            </div>

            {/* Diagram */}
            {currentQ?.hasDiagram && currentQ?.diagramUrl && (
              <div className="flex justify-center my-4">
                <img
                  src={currentQ.diagramUrl}
                  alt="Diagram"
                  className="max-h-60 rounded-xl border border-dh-border bg-dh-surface p-2"
                />
              </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              {Object.entries(currentQ?.options || {}).map(([key, val]) => {
                const optKey = key.toUpperCase();
                const isSelected = selectedOption === optKey;
                const isCorrect = currentResult && optKey === currentResult.solution?.correctOption?.toUpperCase();
                const isWrongSelection = currentResult && isSelected && !currentResult.correct;

                let btnStyle = 'bg-dh-surface border-dh-border/80 text-white hover:border-dh-accent';
                if (currentResult) {
                  if (isCorrect) btnStyle = 'bg-dh-green/20 border-dh-green text-dh-green font-bold';
                  else if (isWrongSelection) btnStyle = 'bg-dh-red/20 border-dh-red text-dh-red font-bold';
                  else btnStyle = 'bg-dh-surface/40 border-dh-border text-dh-text-muted opacity-50';
                } else if (isSelected) {
                  btnStyle = 'bg-dh-accent text-black font-bold';
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleAnswerSubmit(optKey)}
                    disabled={Boolean(selectedOption) || submitting}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between gap-4 transition-all active:scale-[0.99] ${btnStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center font-heading font-black text-sm flex-shrink-0">
                        {optKey}
                      </span>
                      <span className="text-sm md:text-base font-normal">
                        <LatexRenderer text={val} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Next / Continue button */}
            {currentResult && !challengeCompleted && (
              <div className="pt-4 border-t border-dh-border">
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full py-4 rounded-2xl bg-dh-accent hover:bg-yellow-400 text-black font-heading font-black text-base transition-all shadow-lg shadow-dh-accent/20 active:scale-95"
                >
                  Next Challenge Question ➔
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default RedeemChallengePage;
