import React, { useState, useEffect } from 'react';
import Latex from 'react-latex-next';
import { formatLatex } from '../utils/latex';

const QuizEngine = ({ questions, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);

  const currentQuestion = questions[currentIndex];
  const optionLetters = ['A', 'B', 'C', 'D'];

  useEffect(() => {
    if (isAnswered) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAnswered]);

  const handleTimeOut = () => {
    setIsAnswered(true);
  };

  const handleOptionClick = (letter) => {
    if (isAnswered) return;
    
    setSelectedOption(letter);
    setIsAnswered(true);

    if (letter === currentQuestion.correctOption) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTimeLeft(60);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      onComplete(score);
    }
  };

  const getOptionClasses = (letter) => {
    let baseClass = "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 text-lg font-medium ";
    
    if (!isAnswered) {
      return baseClass + "border-dh-border hover:border-dh-accent hover:bg-dh-accent/5 text-dh-text bg-dh-card cursor-pointer";
    }

    if (letter === currentQuestion.correctOption) {
      return baseClass + "border-dh-green bg-dh-green/10 text-dh-green";
    }
    
    if (letter === selectedOption && letter !== currentQuestion.correctOption) {
      return baseClass + "border-dh-red bg-dh-red/10 text-dh-red";
    }

    return baseClass + "border-dh-border bg-dh-surface text-dh-text-muted opacity-60 cursor-not-allowed";
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-dh-surface rounded-3xl shadow-xl overflow-hidden animate-fade-in border border-dh-border">
      {/* Progress Bar & Header */}
      <div className="bg-dh-card p-6 border-b border-dh-border flex justify-between items-center relative overflow-hidden">
        <div 
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-dh-accent to-dh-accent-light transition-all duration-1000 linear"
          style={{ width: `${(timeLeft / 60) * 100}%` }}
        ></div>
        <span className="text-dh-text-muted font-heading font-semibold text-sm tracking-widest uppercase">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <div className={`flex items-center justify-center w-12 h-12 rounded-full border-4 font-mono font-bold text-lg
          ${timeLeft <= 5 ? 'border-dh-red text-dh-red animate-pulse' : 'border-dh-accent text-dh-accent'}`}>
          {timeLeft}
        </div>
      </div>

      <div className="p-8">
        <h2 className="text-2xl font-heading font-bold text-dh-text mb-8 leading-relaxed">
          <Latex>{formatLatex(currentQuestion.questionText)}</Latex>
        </h2>

        <div className="space-y-4">
          {currentQuestion.options.map((option, index) => {
            const letter = optionLetters[index];
            return (
              <button
                key={letter}
                onClick={() => handleOptionClick(letter)}
                disabled={isAnswered}
                className={getOptionClasses(letter)}
              >
                <span className="inline-block w-8 font-mono font-bold mr-2">{letter}.</span>
                <Latex>{formatLatex(option)}</Latex>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mt-8 pt-6 border-t border-dh-border animate-fade-in-up">
            <div className={`p-4 rounded-xl mb-6 flex items-start gap-4 ${selectedOption === currentQuestion.correctOption ? 'bg-dh-green/10 text-dh-green' : 'bg-dh-accent/5 text-dh-accent-light'}`}>
              <div className="flex-1">
                <span className="font-heading font-bold block mb-1">Explanation:</span>
                <Latex>{formatLatex(currentQuestion.explanation)}</Latex>
              </div>
            </div>
            <button
              onClick={handleNext}
              className="w-full bg-dh-accent hover:bg-yellow-400 text-black font-heading font-bold py-4 rounded-xl transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizEngine;