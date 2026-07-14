import React, { useState, useEffect } from 'react';
import api from '../api';
import Latex from 'react-latex-next';
import { useNavigate } from 'react-router-dom';
import { formatLatex } from '../utils/latex';

// Normalise options to a consistent array of { key, text } pairs
const normaliseOptions = (opts) => {
  if (!opts) return [];
  if (Array.isArray(opts)) {
    return opts.map((text, i) => ({ key: String.fromCharCode(65 + i), text }));
  }
  // Object format: { a: "...", b: "...", ... }
  return Object.entries(opts).map(([key, text]) => ({ key: key.toUpperCase(), text }));
};

const SavedQuestions = () => {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceSelected, setPracticeSelected] = useState(null);
  const [practiceAnswered, setPracticeAnswered] = useState(false);
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceDone, setPracticeDone] = useState(false);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const res = await api.get('/api/bookmarks');
      setBookmarks(res.data);
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/bookmarks/${id}`);
      setBookmarks(prev => prev.filter(b => b._id !== id));
    } catch (err) {
      console.error('Failed to delete bookmark:', err);
      alert('Could not delete bookmark.');
    }
  };

  // Practice mode handlers
  const startPractice = () => {
    const shuffled = [...bookmarks].sort(() => Math.random() - 0.5);
    setShuffledQuestions(shuffled);
    setPracticeMode(true);
    setPracticeIndex(0);
    setPracticeSelected(null);
    setPracticeAnswered(false);
    setPracticeScore(0);
    setPracticeDone(false);
  };

  const handlePracticeAnswer = (key) => {
    if (practiceAnswered) return;
    setPracticeSelected(key);
    setPracticeAnswered(true);
    const q = shuffledQuestions[practiceIndex];
    if (key === (q.correctOption || '').toUpperCase()) {
      setPracticeScore(s => s + 1);
    }
  };

  const handlePracticeNext = () => {
    if (practiceIndex < shuffledQuestions.length - 1) {
      setPracticeIndex(i => i + 1);
      setPracticeSelected(null);
      setPracticeAnswered(false);
    } else {
      setPracticeDone(true);
    }
  };

  const exitPractice = () => {
    setPracticeMode(false);
    setPracticeDone(false);
  };

  // Practice Mode — Active Quiz
  if (practiceMode && !practiceDone && shuffledQuestions.length > 0) {
    const q = shuffledQuestions[practiceIndex];
    const opts = normaliseOptions(q.options);
    const correctLetter = (q.correctOption || '').toUpperCase();

    return (
      <div className="min-h-screen bg-dh-bg px-4 py-6">
        <div className="max-w-md mx-auto">
          <button onClick={exitPractice} className="text-dh-text-muted font-heading font-bold text-sm mb-4 hover:text-dh-accent transition-colors">
            ← Exit Practice
          </button>
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-heading font-bold text-dh-text-muted uppercase">Question {practiceIndex + 1}/{shuffledQuestions.length}</span>
            <span className="text-sm font-heading font-bold text-dh-accent">Score: {practiceScore}</span>
          </div>

          {/* Subject badge */}
          {q.subject && (
            <span className="inline-block mb-3 bg-dh-accent/15 text-dh-accent-light text-xs font-heading font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-dh-accent/20">
              {q.subject}
            </span>
          )}

          <div className="bg-dh-card rounded-2xl p-5 mb-4 border border-dh-border">
            <div className="text-base font-semibold text-dh-text">
              <Latex>{formatLatex(q.questionText)}</Latex>
            </div>
          </div>

          <div className="space-y-2.5">
            {opts.map(({ key, text }) => {
              const optLetter = key.toUpperCase();
              let btnClass = 'border-dh-border bg-dh-card text-dh-text hover:border-dh-accent/60';
              if (practiceAnswered) {
                if (optLetter === correctLetter) {
                  btnClass = 'border-dh-green bg-dh-green/10 text-dh-green font-heading font-bold';
                } else if (optLetter === practiceSelected) {
                  btnClass = 'border-dh-red bg-dh-red/10 text-dh-red font-heading font-bold';
                } else {
                  btnClass = 'border-dh-border bg-dh-surface text-dh-text-muted opacity-50';
                }
              }
              return (
                <button
                  key={key}
                  onClick={() => handlePracticeAnswer(optLetter)}
                  disabled={practiceAnswered}
                  className={`w-full p-3.5 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${btnClass}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm ${practiceAnswered && optLetter === correctLetter ? 'bg-dh-green text-black' : practiceAnswered && optLetter === practiceSelected ? 'bg-dh-red text-white' : 'bg-dh-surface text-dh-text-muted'}`}>
                    {key}
                  </span>
                  <span className="flex-1"><Latex>{formatLatex(text)}</Latex></span>
                </button>
              );
            })}
          </div>

          {/* Explanation after answering */}
          {practiceAnswered && q.explanation && (
            <div className="mt-4 p-4 bg-dh-accent/5 border-l-4 border-dh-accent rounded-r-lg text-dh-text text-sm animate-fade-in">
              <span className="font-heading font-bold text-dh-accent-light">Explanation: </span>
              <Latex>{formatLatex(q.explanation)}</Latex>
            </div>
          )}

          {practiceAnswered && (
            <button onClick={handlePracticeNext} className="w-full mt-4 py-3 bg-dh-accent text-white rounded-xl font-heading font-bold text-lg hover:bg-dh-accent-light transition-all">
              {practiceIndex < shuffledQuestions.length - 1 ? 'Next →' : 'See Results'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Practice Mode — Results
  if (practiceDone) {
    const pct = Math.round((practiceScore / shuffledQuestions.length) * 100);
    const passed = pct >= 70;
    return (
      <div className="min-h-screen bg-dh-bg px-4 py-6 flex items-center justify-center">
        <div className="max-w-sm w-full bg-dh-card rounded-3xl p-6 border border-dh-border text-center" style={{ animation: 'fadeInUp 0.5s ease-out forwards' }}>
          <div className="text-5xl mb-4">{passed ? '🎉' : '💪'}</div>
          <h2 className="text-2xl font-heading font-black text-dh-text mb-2">{passed ? 'Great Revision!' : 'Keep Practicing!'}</h2>
          <p className="text-dh-text-muted text-sm mb-2">
            Score: {practiceScore}/{shuffledQuestions.length} ({pct}%)
          </p>
          <div className="w-full h-3 bg-dh-surface rounded-full overflow-hidden mb-6 border border-dh-border/50">
            <div className={`h-full rounded-full transition-all duration-1000 ${passed ? 'bg-dh-green' : 'bg-dh-accent'}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-3">
            <button onClick={startPractice} className="flex-1 py-3 bg-dh-accent text-white rounded-xl font-heading font-bold text-lg hover:bg-dh-accent-light transition-all">
              🔄 Retry
            </button>
            <button onClick={exitPractice} className="flex-1 py-3 bg-dh-card text-dh-text rounded-xl font-heading font-bold text-lg border-2 border-dh-border hover:border-dh-accent/50 transition-all">
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main saved questions list
  return (
    <div className="min-h-screen bg-dh-bg py-8 px-4">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-heading font-black text-white">Saved Questions</h1>
          <span className="text-dh-text-muted text-sm font-heading font-bold">{bookmarks.length} saved</span>
        </div>

        {/* Practice button */}
        {bookmarks.length > 0 && (
          <button
            onClick={startPractice}
            className="w-full mb-6 py-4 bg-gradient-to-r from-dh-accent to-dh-green text-black rounded-2xl font-heading font-black text-lg uppercase tracking-wide border-b-4 border-black/20 active:translate-y-[2px] active:border-b-0 transition-all shadow-lg shadow-dh-accent/20 hover:shadow-dh-accent/40"
          >
            ⚡ Practice Saved Questions ({bookmarks.length})
          </button>
        )}

        {loading ? (
          <div className="text-center py-20 text-dh-text-muted font-heading font-bold animate-pulse">Loading saved questions...</div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-20 bg-dh-card rounded-2xl border-2 border-b-4 border-dh-border">
            <div className="text-4xl mb-3">📚</div>
            <h2 className="text-xl font-heading font-bold text-dh-text-muted mb-2">No Saved Questions</h2>
            <p className="text-dh-text-muted/70 mb-4">Bookmark questions during quizzes or matches — they'll appear here for revision.</p>
            <button onClick={() => navigate('/journey')} className="px-6 py-2.5 bg-dh-accent text-white rounded-xl font-heading font-bold text-sm hover:bg-dh-accent-light transition-all">
              Start a Journey →
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {bookmarks.map((b, idx) => {
              const opts = normaliseOptions(b.options);
              return (
                <div 
                  key={b._id} 
                  className="bg-dh-card rounded-2xl p-6 border-2 border-b-4 border-dh-border" 
                  style={{ animation: `fadeInUp ${0.3 + idx * 0.08}s ease-out forwards` }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-dh-accent/15 text-dh-accent-light text-xs font-heading font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-dh-accent/20">
                      {b.subject}
                    </span>
                    <button 
                      onClick={() => handleDelete(b._id)}
                      className="text-dh-text-muted hover:text-dh-red font-heading font-bold text-xs uppercase tracking-wide bg-dh-surface hover:bg-dh-red/10 px-3 py-1.5 rounded-xl transition-all border-2 border-b-4 border-dh-border hover:border-dh-red/40 active:translate-y-[2px] active:border-b-2"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="text-lg font-semibold text-dh-text mb-6">
                    <Latex>{formatLatex(b.questionText)}</Latex>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {opts.map(({ key, text }) => {
                      const isCorrect = key === (b.correctOption || '').toUpperCase();
                      
                      return (
                        <div key={key} className={`p-4 rounded-xl border-2 flex items-start gap-3 transition-colors ${
                          isCorrect 
                            ? 'bg-dh-green/10 border-dh-green/40 text-dh-green' 
                            : 'bg-dh-card border-dh-border text-dh-text-muted'
                        }`}>
                          <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full font-mono font-bold text-sm ${
                            isCorrect ? 'bg-dh-green text-black' : 'bg-dh-border text-dh-text-muted'
                          }`}>
                            {key}
                          </div>
                          <div className="flex-1 pt-1 overflow-hidden">
                            <Latex>{formatLatex(text)}</Latex>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {b.explanation && (
                    <div className="mt-6 p-4 bg-dh-accent/5 border-l-4 border-dh-accent rounded-r-lg text-dh-text text-sm">
                      <span className="font-heading font-bold text-dh-accent-light">Explanation: </span> 
                      <Latex>{formatLatex(b.explanation)}</Latex>
                    </div>
                  )}
                  
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};

export default SavedQuestions;