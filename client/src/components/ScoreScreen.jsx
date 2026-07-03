import React from 'react';

const ScoreScreen = ({ score, totalQuestions, onRestart }) => {
  const percentage = Math.round((score / totalQuestions) * 100);
  
  let message = "";
  if (percentage === 100) message = "Perfect Score! Master of Engineering!";
  else if (percentage >= 80) message = "Excellent Job! You really know your stuff.";
  else if (percentage >= 60) message = "Good effort! A little more revision and you're set.";
  else message = "Keep studying! You'll get there.";

  return (
    <div className="w-full max-w-md mx-auto bg-dh-surface rounded-3xl shadow-xl overflow-hidden p-8 text-center animate-fade-in-up border border-dh-border">
      <h2 className="text-3xl font-heading font-extrabold text-dh-text mb-2">Quiz Completed!</h2>
      <p className="text-dh-text-muted mb-8">{message}</p>
      
      <div className="relative w-48 h-48 mx-auto mb-8">
        <svg className="w-full h-full" viewBox="0 0 36 36">
          <path
            className="text-dh-border"
            strokeWidth="3"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="text-dh-accent transition-all duration-1000 ease-out"
            strokeDasharray={`${percentage}, 100`}
            strokeWidth="3"
            strokeLinecap="round"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-heading font-black text-dh-text">{score}</span>
          <span className="text-sm font-medium text-dh-text-muted">out of {totalQuestions}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-dh-green/10 p-4 rounded-xl border border-dh-green/20">
          <div className="text-dh-green text-2xl font-heading font-bold">{score}</div>
          <div className="text-dh-green text-sm font-medium">Correct</div>
        </div>
        <div className="bg-dh-red/10 p-4 rounded-xl border border-dh-red/20">
          <div className="text-dh-red text-2xl font-heading font-bold">{totalQuestions - score}</div>
          <div className="text-dh-red text-sm font-medium">Incorrect</div>
        </div>
      </div>

      <button
        onClick={onRestart}
        className="w-full py-4 rounded-xl bg-dh-accent hover:bg-yellow-400 text-black font-heading font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
        Back to Dashboard
      </button>
    </div>
  );
};

export default ScoreScreen;