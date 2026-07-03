import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Latex from 'react-latex-next';
import { socket } from '../socket';
import { useAppMode } from '../context/AppModeContext';

const SUBJECTS = [
  { id: 'Fluid Mechanics', label: 'Fluid Mechanics' },
  { id: 'Soil Mechanics', label: 'Soil Mechanics' },
  { id: 'Structural Analysis', label: 'Structural Analysis' },
  { id: 'General Studies', label: 'General Studies' },
];

const GroupRoom = () => {
  const navigate = useNavigate();
  const { mode } = useAppMode();
  const [view, setView] = useState('menu'); // menu | create | join | lobby | playing | finished
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0].id);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [scores, setScores] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [correctOption, setCorrectOption] = useState(null);
  const [results, setResults] = useState([]);
  const [timer, setTimer] = useState(20);
  const timerRef = useRef(null);

  useEffect(() => {
    socket.on('room_created', (data) => {
      setCode(data.code);
      setView('lobby');
    });

    socket.on('room_joined', (data) => {
      setCode(data.code);
      setPlayers(data.players);
      setView('lobby');
    });

    socket.on('room_update', (data) => {
      setPlayers(data);
    });

    socket.on('group_quiz_start', (data) => {
      setTotalQuestions(data.totalQuestions);
      setView('playing');
    });

    socket.on('new_group_question', (data) => {
      setCurrentQuestion(data);
      setQuestionNumber(data.questionNumber);
      setSelectedOption(null);
      setRevealed(false);
      setCorrectOption(null);
      setTimer(20);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('group_answer_reveal', (data) => {
      clearInterval(timerRef.current);
      setRevealed(true);
      setCorrectOption(data.correctOption);
      setScores(data.scores);
    });

    socket.on('group_quiz_end', (data) => {
      clearInterval(timerRef.current);
      setResults(data.leaderboard);
      setView('finished');
    });

    socket.on('error', (data) => {
      alert(data.message);
    });

    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('room_update');
      socket.off('group_quiz_start');
      socket.off('new_group_question');
      socket.off('group_answer_reveal');
      socket.off('group_quiz_end');
      socket.off('error');
      clearInterval(timerRef.current);
    };
  }, []);

  const handleCreate = () => {
    socket.emit('create_room', { subject, mode });
  };

  const handleJoin = () => {
    if (joinCode.length !== 4) return alert('Enter a valid 4-digit code');
    socket.emit('join_room', { code: joinCode });
  };

  const handleReady = () => {
    socket.emit('player_ready', { code });
  };

  const handleStart = () => {
    socket.emit('start_group_quiz', { code });
  };

  const handleAnswer = (opt) => {
    if (revealed || selectedOption) return;
    setSelectedOption(opt);
    socket.emit('group_submit_answer', { code, answer: opt });
  };

  const allReady = players.length > 0 && players.every(p => p.ready);

  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-dh-bg pb-24 px-4 pt-6 flex items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-black text-dh-text">Group Quiz</h1>
            <p className="text-dh-text-muted text-sm">Play with friends!</p>
          </div>
          <button onClick={() => setView('create')} className="w-full py-4 bg-dh-accent border-b-4 border-dh-accent-dark text-white rounded-2xl font-heading font-black text-lg uppercase tracking-wide active:translate-y-[2px] active:border-b-0 transition-all">
            🔥 Create a Room
          </button>
          <button onClick={() => setView('join')} className="w-full py-4 bg-dh-card border-2 border-b-4 border-dh-border text-dh-text rounded-2xl font-heading font-black text-lg uppercase tracking-wide active:translate-y-[2px] active:border-b-2 transition-all">
            🔑 Join a Room
          </button>
          <button onClick={() => navigate(-1)} className="w-full py-3 text-dh-text-muted font-heading font-bold text-sm hover:text-dh-text transition-all">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-dh-bg pb-24 px-4 pt-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-dh-card rounded-2xl p-6 border-2 border-b-4 border-dh-border">
          <h2 className="text-2xl font-heading font-black text-dh-text mb-6">Create Room</h2>
          <label className="block text-sm font-heading font-bold text-dh-text-muted mb-2">Subject</label>
          <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full bg-dh-surface text-dh-text border border-dh-border rounded-xl p-3 mb-6 font-body">
            {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={handleCreate} className="w-full py-3 bg-dh-accent border-b-4 border-dh-accent-dark text-white rounded-xl font-heading font-black text-lg uppercase tracking-wide active:translate-y-[2px] active:border-b-0 transition-all">
            Generate Room Code
          </button>
          <button onClick={() => setView('menu')} className="w-full py-3 text-dh-text-muted font-heading font-bold text-sm hover:text-dh-text transition-all mt-3">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="min-h-screen bg-dh-bg pb-24 px-4 pt-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-dh-card rounded-2xl p-6 border-2 border-b-4 border-dh-border">
          <h2 className="text-2xl font-heading font-black text-dh-text mb-6">Join Room</h2>
          <input
            type="text"
            maxLength={4}
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Enter 4-digit code"
            className="w-full bg-dh-surface text-dh-text border border-dh-border rounded-xl p-4 text-center text-3xl tracking-[0.5em] font-heading font-bold mb-6"
          />
          <button onClick={handleJoin} className="w-full py-3 bg-dh-accent border-b-4 border-dh-accent-dark text-white rounded-xl font-heading font-black text-lg uppercase tracking-wide active:translate-y-[2px] active:border-b-0 transition-all">
            Join
          </button>
          <button onClick={() => setView('menu')} className="w-full py-3 text-dh-text-muted font-heading font-bold text-sm hover:text-dh-text transition-all mt-3">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (view === 'lobby') {
    return (
      <div className="min-h-screen bg-dh-bg pb-24 px-4 pt-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-dh-card rounded-2xl p-6 border-2 border-b-4 border-dh-accent/40 text-center">
          <h2 className="text-2xl font-heading font-black text-dh-text mb-2">Room Code</h2>
          <div className="text-5xl tracking-[0.3em] font-heading font-black text-dh-accent mb-6">{code}</div>
          <p className="text-dh-text-muted text-sm mb-6">Share this code with your friends!</p>

          <div className="mb-6">
            <h3 className="text-sm font-heading font-bold text-dh-text-muted mb-3 uppercase">Players ({players.length})</h3>
            <div className="space-y-2">
              {players.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-dh-surface rounded-lg px-4 py-2 border border-dh-border">
                  <span className="font-heading font-bold text-dh-text">{p.username}</span>
                  <span className={`text-sm font-heading font-bold ${p.ready ? 'text-dh-green' : 'text-dh-text-muted'}`}>
                    {p.ready ? '✓ Ready' : 'Not Ready'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleReady} className={`flex-1 py-3 rounded-xl font-heading font-bold text-lg transition-all ${players.find(p => p.socketId === socket.id)?.ready ? 'bg-dh-green text-black' : 'bg-dh-surface text-dh-text border border-dh-border'}`}>
              {players.find(p => p.socketId === socket.id)?.ready ? 'Ready ✓' : 'Ready Up'}
            </button>
            <button
              onClick={handleStart}
              disabled={!allReady}
              className={`flex-1 py-3 rounded-xl font-heading font-black text-lg uppercase tracking-wide transition-all ${allReady ? 'bg-dh-accent border-b-4 border-dh-accent-dark text-white active:translate-y-[2px] active:border-b-0' : 'bg-dh-border text-dh-text-muted cursor-not-allowed'}`}
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'playing' && currentQuestion) {
    return (
      <div className="min-h-screen bg-dh-bg pb-24 px-4 pt-6">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-dh-text-muted font-heading font-bold text-sm">Q{questionNumber}/{totalQuestions}</span>
            <div className={`font-heading font-bold text-lg ${timer <= 5 ? 'text-dh-red animate-pulse' : 'text-dh-accent'}`}>{timer}s</div>
            <div className="flex gap-2">
              {scores.slice(0, 5).map((s, i) => (
                <span key={i} className="text-xs font-heading font-bold text-dh-text-muted">{s.username}: {s.score}</span>
              ))}
            </div>
          </div>

          {/* Time bar */}
          <div className="h-1.5 bg-dh-surface rounded-full mb-6 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${timer <= 5 ? 'bg-dh-red' : 'bg-dh-accent'}`} style={{ width: `${(timer / 20) * 100}%` }} />
          </div>

          {/* Question */}
          <div className="bg-dh-card rounded-xl p-5 border border-dh-border mb-5">
            <div className="text-base font-semibold text-dh-text">
              <Latex>{currentQuestion.question}</Latex>
            </div>
            {currentQuestion.diagram && (
              <img src={currentQuestion.diagram} alt="Diagram" className="mt-4 rounded-lg max-w-full" />
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(currentQuestion.options).map(([key, opt]) => {
              const optLetter = key.toUpperCase();
              let btnClass = 'bg-dh-card border-dh-border text-dh-text';
              if (revealed) {
                if (optLetter === correctOption) {
                  btnClass = 'bg-dh-green/20 border-dh-green text-dh-green font-heading font-bold';
                } else if (optLetter === selectedOption && selectedOption !== correctOption) {
                  btnClass = 'bg-dh-red/20 border-dh-red text-dh-red';
                } else {
                  btnClass = 'bg-dh-card border-dh-border text-dh-text-muted opacity-50';
                }
              } else if (selectedOption === optLetter) {
                btnClass = 'bg-dh-accent/20 border-dh-accent text-dh-accent font-heading font-bold';
              }
              return (
                <button
                  key={key}
                  onClick={() => handleAnswer(optLetter)}
                  disabled={revealed || selectedOption !== null}
                  className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${btnClass} ${!revealed && !selectedOption ? 'hover:border-dh-accent hover:bg-dh-accent/10' : ''}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm ${revealed && optLetter === correctOption ? 'bg-dh-green text-black' : 'bg-dh-border text-dh-text-muted'}`}>
                    {key}
                  </span>
                  <span className="flex-1"><Latex>{opt}</Latex></span>
                </button>
              );
            })}
          </div>

          {/* Revealed explanation */}
          {revealed && correctOption && (
            <div className="mt-5 p-4 bg-dh-accent/5 border-l-4 border-dh-accent rounded-r-md">
              <h4 className="text-dh-accent-light font-heading font-bold mb-2 text-sm">Explanation:</h4>
              <div className="text-dh-text text-sm">
                <Latex>{currentQuestion.explanation || 'No explanation available.'}</Latex>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'finished') {
    return (
      <div className="min-h-screen bg-dh-bg pb-24 px-4 pt-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-dh-card rounded-2xl p-6 border border-dh-accent/30 text-center">
          <h2 className="text-3xl font-heading font-black text-dh-accent mb-6">🏆 Results</h2>
          <div className="space-y-3 mb-8">
            {results.map((r) => (
              <div key={r.rank} className={`flex items-center justify-between p-4 rounded-xl ${r.rank === 1 ? 'bg-gradient-to-r from-dh-accent/20 to-yellow-900/20 border border-dh-accent/30' : 'bg-dh-surface border border-dh-border'}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-heading font-bold text-sm ${r.rank === 1 ? 'bg-dh-accent text-black' : r.rank === 2 ? 'bg-dh-text-muted text-black' : r.rank === 3 ? 'bg-orange-500 text-black' : 'bg-dh-border text-dh-text-muted'}`}>
                    #{r.rank}
                  </span>
                  <span className="font-heading font-bold text-dh-text">{r.username}</span>
                </div>
                <span className="font-heading font-black text-dh-accent">{r.score} pts</span>
              </div>
            ))}
          </div>
          <div className="text-dh-green font-heading font-bold text-sm mb-6">🎉 Coins awarded for correct answers!</div>
          <button onClick={() => navigate('/dashboard')} className="w-full py-3 bg-dh-accent text-black rounded-xl font-heading font-bold text-lg hover:bg-yellow-400 transition-all">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default GroupRoom;