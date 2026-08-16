import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import LatexRenderer from '../components/LatexRenderer';
import { sounds } from '../utils/sound';

const MistakeDrillPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subjectParam = searchParams.get('subject');

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolveResult, setResolveResult] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    fetchDrillQueue();
  }, [subjectParam]);

  const fetchDrillQueue = async () => {
    setLoading(true);
    try {
      const url = subjectParam
        ? `/api/mistakes/drill?subject=${encodeURIComponent(subjectParam)}&limit=10`
        : '/api/mistakes/drill?limit=10';
      const res = await api.get(url);
      if (res.data?.ok) {
        setQuestions(res.data.questions || []);
      }
    } catch (err) {
      console.error('Failed to load drill queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentQ = questions[currentIndex];

  const handleSubmitAnswer = async (optKey) => {
    if (selectedOption || isSubmitting || !currentQ) return;
    setSelectedOption(optKey);
    setIsSubmitting(true);
    sounds.click();

    try {
      const res = await api.post('/api/mistakes/resolve', {
        questionId: currentQ.questionId,
        selectedAnswer: optKey
      });

      if (res.data?.ok) {
        setResolveResult(res.data);
        if (res.data.correct) {
          sounds.correct();
        } else {
          sounds.wrong();
        }
      }
    } catch (err) {
      console.error('Failed to resolve answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    sounds.click();
    setSelectedOption(null);
    setResolveResult(null);
    setCompletedCount(prev => prev + 1);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Done with batch
      setCurrentIndex(questions.length);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dh-bg text-dh-text flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <span className="text-4xl animate-spin inline-block">🧠</span>
            <p className="font-heading font-black text-white">Loading Spaced Repetition Drill...</p>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0 || currentIndex >= questions.length) {
    return (
      <div className="min-h-screen bg-dh-bg text-dh-text flex flex-col">
        <main className="flex-1 max-w-lg w-full mx-auto px-4 flex flex-col items-center justify-center text-center">
          <div className="bg-dh-card border-2 border-dh-border rounded-3xl p-8 space-y-6 shadow-2xl animate-fade-in">
            <span className="text-6xl">🎉</span>
            <h2 className="text-2xl font-heading font-black text-white">
              Drill Batch Completed!
            </h2>
            <p className="text-sm text-dh-text-muted">
              You reviewed <strong>{completedCount || questions.length}</strong> questions in this session. Your mastery levels have been updated in the Leitner spaced review queue.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => navigate('/notebook')}
                className="w-full py-3.5 rounded-2xl bg-dh-accent text-black font-heading font-black text-sm shadow-lg shadow-dh-accent/20 active:scale-95 transition-all"
              >
                Back to Mistake Notebook
              </button>
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  setCompletedCount(0);
                  fetchDrillQueue();
                }}
                className="w-full py-3.5 rounded-2xl bg-dh-surface border border-dh-border text-white font-heading font-bold text-sm hover:border-dh-accent transition-all"
              >
                Start Another Drill Batch 🔄
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dh-bg text-dh-text flex flex-col pb-16">
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-6 space-y-6">
        {/* Top Header & Progress */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/notebook')}
            className="text-xs font-heading font-bold text-dh-text-muted hover:text-white flex items-center gap-1"
          >
            ← Exit Drill
          </button>
          <span className="text-xs font-heading font-black text-dh-accent px-3 py-1 rounded-full bg-dh-card border border-dh-border">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>

        {/* Question Card */}
        <div className="bg-dh-card border-2 border-dh-border rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-dh-border/60 pb-3">
            <span className="text-xs font-heading font-black uppercase text-dh-text-muted tracking-wider">
              {currentQ.subject} • {currentQ.topic || 'General'}
            </span>
            <span className={`text-[10px] font-heading font-black px-2.5 py-0.5 rounded-full uppercase ${
              currentQ.level === 1 ? 'bg-dh-red/20 text-dh-red border border-dh-red/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              Level {currentQ.level} • {currentQ.level === 1 ? 'Critical' : 'In Review'}
            </span>
          </div>

          {/* Question Text */}
          <div className="text-lg md:text-xl font-medium text-white leading-relaxed">
            <LatexRenderer text={currentQ.questionText} />
          </div>

          {/* Diagram if available */}
          {currentQ.hasDiagram && currentQ.diagramUrl && (
            <div className="flex justify-center my-4">
              <img
                src={currentQ.diagramUrl}
                alt="Diagram"
                className="max-h-60 rounded-xl border border-dh-border bg-dh-surface p-2"
              />
            </div>
          )}

          {/* Options Grid */}
          <div className="grid grid-cols-1 gap-3 pt-2">
            {Object.entries(currentQ.options || {}).map(([key, val]) => {
              const optKey = key.toUpperCase();
              const isSelected = selectedOption === optKey;
              const isCorrect = resolveResult && optKey === resolveResult.solution?.correctOption?.toUpperCase();
              const isWrongSelection = resolveResult && isSelected && !resolveResult.correct;

              let btnStyle = 'bg-dh-surface border-dh-border/80 text-white hover:border-dh-accent hover:bg-dh-surface/90';
              if (resolveResult) {
                if (isCorrect) {
                  btnStyle = 'bg-dh-green/20 border-dh-green text-dh-green font-bold ring-2 ring-dh-green/30';
                } else if (isWrongSelection) {
                  btnStyle = 'bg-dh-red/20 border-dh-red text-dh-red font-bold ring-2 ring-dh-red/30';
                } else {
                  btnStyle = 'bg-dh-surface/40 border-dh-border text-dh-text-muted opacity-50';
                }
              } else if (isSelected) {
                btnStyle = 'bg-dh-accent text-black font-bold';
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSubmitAnswer(optKey)}
                  disabled={Boolean(selectedOption) || isSubmitting}
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
                  {resolveResult && isCorrect && (
                    <span className="text-lg text-dh-green">✓</span>
                  )}
                  {resolveResult && isWrongSelection && (
                    <span className="text-lg text-dh-red">✗</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Solution & Explanation Drawer */}
          {resolveResult && (
            <div className="mt-6 pt-6 border-t-2 border-dh-border space-y-4 animate-fade-in">
              {/* Level transition banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                resolveResult.correct
                  ? 'bg-dh-green/15 border-dh-green/40 text-dh-green'
                  : 'bg-dh-red/15 border-dh-red/40 text-dh-red'
              }`}>
                <div className="space-y-0.5">
                  <h4 className="font-heading font-black text-sm flex items-center gap-2">
                    <span>{resolveResult.correct ? '📈 Promotion!' : '⚠️ Needs Practice'}</span>
                    <span>
                      {resolveResult.correct
                        ? `Level ${resolveResult.transition?.fromLevel} ➔ Level ${resolveResult.transition?.toLevel} ${resolveResult.transition?.toLevel === 3 ? '(Mastered! 🏆)' : ''}`
                        : 'Reset to Level 1 (Critical)'}
                    </span>
                  </h4>
                  <p className="text-xs text-dh-text-muted">
                    {resolveResult.correct
                      ? resolveResult.transition?.toLevel === 3
                        ? 'Congratulations! This error has been cleared from your active mistake ledger.'
                        : 'Scheduled for confirmation review in 48 hours.'
                      : 'Added back to immediate review queue.'}
                  </p>
                </div>
              </div>

              {/* Detailed Step-by-Step LaTeX Explanation */}
              <div className="bg-dh-surface p-5 rounded-2xl border border-dh-border space-y-2 text-left">
                <h5 className="font-heading font-black text-sm text-dh-accent uppercase tracking-wider">
                  📖 Step-by-Step Solution & Concept
                </h5>
                <div className="text-sm text-dh-text leading-relaxed">
                  <LatexRenderer text={resolveResult.solution?.explanation || 'No explanation available.'} />
                </div>
              </div>

              {/* Next Question Button */}
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-4 rounded-2xl bg-dh-accent hover:bg-yellow-400 text-black font-heading font-black text-base transition-all shadow-lg shadow-dh-accent/20 active:scale-95"
              >
                {currentIndex + 1 < questions.length ? 'Next Question ➔' : 'Complete Drill ➔'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MistakeDrillPage;
