import React, { useState } from 'react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { CheckCircle2, XCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import Confetti from './Confetti';

const formatLatex = (text) => {
  if (!text) return '';
  if (typeof text === 'string' && text.includes('\\') && !text.includes('$')) {
    return `$${text}$`;
  }
  return text;
};

export default function EndMatchScreen({ questions, playerScore, opponentScore }) {
  const isWinner = playerScore > opponentScore;
  const isTie = playerScore === opponentScore;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-dh-surface text-dh-text rounded-xl shadow-lg mt-10 border border-dh-border">
      <div className="text-center mb-10">
        <h1 className={`text-4xl font-heading font-bold mb-4 ${isWinner ? 'text-dh-green' : isTie ? 'text-dh-accent' : 'text-dh-red'}`}>
          {isWinner ? 'Victory!' : isTie ? 'Draw!' : 'Defeat!'}
        </h1>
        <div className="flex justify-center space-x-12 text-2xl font-heading font-semibold">
          <div className="text-dh-green">You: {playerScore}</div>
          <div className="text-dh-text-muted">Bot/Opponent: {opponentScore}</div>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4">
        <h2 className="text-2xl font-heading font-bold text-white mb-4">Match Review</h2>
        {questions.map((q, index) => (
          <div key={index} className="bg-dh-card p-6 rounded-lg shadow-lg border border-dh-border">
            <div className="text-lg text-dh-text font-semibold mb-4">
              <Latex>{formatLatex(`Q${index + 1}: ${q.questionText}`)}</Latex>
            </div>

            {q.hasDiagram && q.diagramUrl && (
              <div className="my-4">
                <img src={q.diagramUrl} alt="Question Diagram" className="max-w-full rounded-md border border-dh-border" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              {Object.entries(q.options || {}).map(([key, value]) => (
                <div 
                  key={key} 
                  className={`p-3 rounded-md border ${q.correctOption === key ? 'border-dh-green bg-dh-green/10' : 'border-dh-border bg-dh-surface'}`}
                >
                  <span className="font-mono font-bold uppercase mr-2">{key}:</span>
                  <Latex>{formatLatex(value)}</Latex>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-dh-accent/5 border-l-4 border-dh-accent rounded-r-md">
              <h4 className="text-dh-accent-light font-heading font-bold mb-2">Explanation:</h4>
              <div className="text-dh-text">
                <Latex>{formatLatex(q.explanation || 'No explanation available.')}</Latex>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}