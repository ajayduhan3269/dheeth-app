import React, { useState, useEffect } from 'react';
import api from '../api';
import Latex from 'react-latex-next';
import { useNavigate } from 'react-router-dom';

const SavedQuestions = () => {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="min-h-screen bg-dh-bg py-8 px-4">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-heading font-black text-white">Saved Questions</h1>
          <span className="text-dh-text-muted text-sm font-heading font-bold">{bookmarks.length} saved</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-dh-text-muted font-heading font-bold animate-pulse">Loading saved questions...</div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-20 bg-dh-card rounded-2xl border-2 border-b-4 border-dh-border">
            <div className="text-4xl mb-3">📚</div>
            <h2 className="text-xl font-heading font-bold text-dh-text-muted mb-2">No Saved Questions</h2>
            <p className="text-dh-text-muted/70">Questions you save from match reviews will appear here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {bookmarks.map((b, idx) => (
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
                  <Latex>{b.questionText}</Latex>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {b.options.map((opt, optIdx) => {
                    const optLetter = String.fromCharCode(65 + optIdx);
                    const isCorrect = optLetter === b.correctOption;
                    
                    return (
                      <div key={optIdx} className={`p-4 rounded-xl border-2 flex items-start gap-3 transition-colors ${
                        isCorrect 
                          ? 'bg-dh-green/10 border-dh-green/40 text-dh-green' 
                          : 'bg-dh-card border-dh-border text-dh-text-muted'
                      }`}>
                        <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full font-mono font-bold text-sm ${
                          isCorrect ? 'bg-dh-green text-black' : 'bg-dh-border text-dh-text-muted'
                        }`}>
                          {optLetter}
                        </div>
                        <div className="flex-1 pt-1 overflow-hidden">
                          <Latex>{opt}</Latex>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {b.explanation && (
                  <div className="mt-6 p-4 bg-dh-accent/5 border-l-4 border-dh-accent rounded-r-lg text-dh-text text-sm">
                    <span className="font-heading font-bold text-dh-accent-light">Explanation: </span> 
                    <Latex>{b.explanation}</Latex>
                  </div>
                )}
                
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default SavedQuestions;