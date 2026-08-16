import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { socket } from '../socket';
import api, { getAvatarUrl } from '../api';
import { sounds } from '../utils/sound';

const SUBJECT_EMOJIS = {
  'Fluid Mechanics': '💧',
  'Soil Mechanics': '🪨',
  'Structural Analysis': '🏗️',
  'Environmental Engineering': '🌿',
  'Building Materials': '🧱',
  'Irrigation Engineering': '🌾',
  'Surveying': '🔭',
  'Highway Engineering': '🛣️',
  'Polity': '🏛️',
  'History': '📜',
  'Geography': '🌍',
  'Biology': '🧬',
  'Economics': '📊',
  'Science & Technology': '🔬',
};

const DuelLobbyPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useContext(AuthContext);

  const [duel, setDuel] = useState(null);
  const [rivalry, setRivalry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [peerStatus, setPeerStatus] = useState(null);

  // If user is not authenticated, redirect to /auth preserving the destination
  useEffect(() => {
    if (!authLoading && !currentUser) {
      sessionStorage.setItem('auth_redirect', `/duel/${code}`);
      navigate(`/auth?redirect=/duel/${code}`, { replace: true });
    }
  }, [currentUser, authLoading, code, navigate]);

  useEffect(() => {
    if (!code) return;

    let isMounted = true;

    const fetchDuel = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/duel/${code.toUpperCase()}`);
        if (isMounted && res.data?.ok) {
          setDuel(res.data.duel);
          setRivalry(res.data.rivalry);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || 'Challenge not found or has expired.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDuel();

    // Join duel room for live updates
    socket.emit('duel:join_lobby', { code: code.toUpperCase() });

    const handlePeerJoined = (data) => {
      sounds.success?.();
      setPeerStatus(`${data.username} opened your challenge!`);
    };

    const handleCancelled = (data) => {
      if (data.code?.toUpperCase() === code?.toUpperCase()) {
        setError('This duel was cancelled by the host.');
      }
    };

    socket.on('duel:peer_joined', handlePeerJoined);
    socket.on('duel:cancelled', handleCancelled);

    return () => {
      isMounted = false;
      socket.off('duel:peer_joined', handlePeerJoined);
      socket.off('duel:cancelled', handleCancelled);
    };
  }, [code]);

  const handleAccept = () => {
    setAccepting(true);
    sounds.click();

    socket.emit('duel:accept', { code: code.toUpperCase() }, (res) => {
      if (res && !res.ok) {
        setAccepting(false);
        setError(res.error || 'Failed to accept duel.');
      }
      // On success, match_found socket event triggers App.jsx navigation to /match
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    sounds.click();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!duel) return;
    sounds.click();
    const shareUrl = window.location.href;
    const message = `🔥 *DHEETH 1v1 Quiz Duel!*\n\nI challenge you to a live quiz duel in *${duel.config.subject}* (${duel.config.questionCount} Qs · ${duel.config.secondsPerQ}s).\n\n👉 *Accept Challenge here:* ${shareUrl}\n\n⚔️ Or enter Code: *${duel.code}*`;

    if (navigator.share) {
      navigator.share({
        title: 'DHEETH 1v1 Challenge',
        text: message,
        url: shareUrl,
      }).catch(() => {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
      });
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  if (authLoading || (loading && !error)) {
    return (
      <div className="min-h-screen bg-dh-bg flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-full border-4 border-dh-accent border-t-transparent animate-spin mb-4" />
        <p className="text-dh-accent font-heading font-black text-base animate-pulse">
          Entering DHEETH Arena...
        </p>
      </div>
    );
  }

  // Error or Expired state
  if (error || !duel || duel.status === 'expired' || duel.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-dh-bg flex items-center justify-center p-4">
        <div className="bg-dh-card border-4 border-dh-border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in">
          <div className="text-5xl mb-4">⌛</div>
          <h2 className="text-xl font-heading font-black text-white mb-2">
            Challenge Unavailable
          </h2>
          <p className="text-dh-text-muted text-sm mb-6">
            {error || 'This duel link has expired or was already completed.'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 rounded-xl bg-dh-accent text-black font-heading font-black text-sm uppercase tracking-wide border-b-4 border-dh-accent-dark hover:bg-dh-accent/90 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Already Claimed
  if (duel.status === 'accepted' || duel.status === 'live' || duel.status === 'completed') {
    return (
      <div className="min-h-screen bg-dh-bg flex items-center justify-center p-4">
        <div className="bg-dh-card border-4 border-dh-border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in">
          <div className="text-5xl mb-4">⚔️</div>
          <h2 className="text-xl font-heading font-black text-white mb-2">
            Duel Already Started!
          </h2>
          <p className="text-dh-text-muted text-sm mb-6">
            Someone already accepted this challenge with <span className="text-white font-bold">{duel.hostUsername}</span>.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 rounded-xl bg-dh-accent text-black font-heading font-black text-sm uppercase tracking-wide border-b-4 border-dh-accent-dark hover:bg-dh-accent/90 transition-all"
          >
            Find Another Match
          </button>
        </div>
      </div>
    );
  }

  const isHost = currentUser && String(currentUser.id || currentUser._id) === String(duel.hostId);

  // Host's waiting view if they open their own link
  if (isHost) {
    return (
      <div className="min-h-screen bg-dh-bg flex items-center justify-center p-4">
        <div className="bg-dh-card border-4 border-dh-border rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-fade-in relative overflow-hidden">
          <div className="w-16 h-16 mx-auto rounded-full bg-dh-accent/20 border-2 border-dh-accent flex items-center justify-center text-3xl mb-4 relative">
            <span className="animate-ping absolute inset-0 rounded-full bg-dh-accent/30 pointer-events-none" />
            <span>⚔️</span>
          </div>

          <h2 className="text-2xl font-heading font-black text-white mb-1">
            Your Duel is Live!
          </h2>
          <p className="text-xs text-dh-text-muted mb-4">
            Share this link with a friend so they can accept your challenge in <span className="text-dh-accent font-bold">{duel.config.subject}</span>.
          </p>

          <div className="bg-dh-accent/10 border border-dh-accent/30 rounded-2xl p-3 mb-5 text-left">
            <p className="text-xs text-dh-accent font-heading font-black mb-0.5">
              👑 You are the Creator ({currentUser?.username})
            </p>
            <p className="text-[11px] text-dh-text-muted leading-relaxed">
              To test accepting this duel from your browser, open this link in a tab where you are logged in with a <strong>different test account</strong>, or send it to a friend!
            </p>
          </div>

          <div className="bg-dh-surface border-2 border-dh-border rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
            <span className="font-heading font-black text-lg text-dh-accent tracking-widest truncate">
              {duel.code}
            </span>
            <button
              onClick={handleCopy}
              className="py-2 px-4 rounded-xl bg-dh-card border border-dh-border hover:border-dh-accent text-xs font-heading font-bold text-white transition-all flex items-center gap-1.5 flex-shrink-0"
            >
              {copied ? '✓ Copied' : '📋 Copy Link'}
            </button>
          </div>

          {peerStatus && (
            <div className="bg-dh-green/15 border border-dh-green/40 text-dh-green text-xs font-heading font-bold py-2 px-3 rounded-xl mb-4 animate-bounce">
              🎉 {peerStatus}
            </div>
          )}

          <button
            onClick={handleShareWhatsApp}
            className="w-full py-3.5 mb-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] border-b-4 border-[#128C7E] active:border-b-0 active:translate-y-1 font-heading font-black text-white text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <span className="text-lg">💬</span> Share on WhatsApp
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-heading font-bold text-dh-text-muted hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Guest Challenge Acceptance Screen
  const hostAvatar = getAvatarUrl(duel.hostAvatar || duel.hostUsername);
  const myAvatar = getAvatarUrl(currentUser?.equippedAvatar || currentUser?.avatarSeed || currentUser?.username);

  // Compute rivalry score breakdown
  const myIdStr = (currentUser?.id || currentUser?._id || '').toString();
  const hostIdStr = (duel.hostId || '').toString();
  let rivalrySummary = 'First Head-to-Head Duel! ⚡';

  if (rivalry && rivalry.totalDuels > 0) {
    const isPlayerA = rivalry.players[0]?.toString() === myIdStr;
    const myWins = isPlayerA ? rivalry.scoreA : rivalry.scoreB;
    const oppWins = isPlayerA ? rivalry.scoreB : rivalry.scoreA;

    if (myWins > oppWins) {
      rivalrySummary = `You lead the series ${myWins}–${oppWins} 👑`;
    } else if (oppWins > myWins) {
      rivalrySummary = `${duel.hostUsername} leads ${oppWins}–${myWins} ⚔️`;
    } else {
      rivalrySummary = `Series Tied at ${myWins}–${oppWins} 🤝`;
    }
  }

  return (
    <div className="min-h-screen bg-dh-bg flex items-center justify-center p-4">
      <div className="bg-dh-card border-4 border-dh-border rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden animate-scale-in">
        
        {/* Header Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dh-accent/10 border border-dh-accent/30 text-dh-accent text-xs font-heading font-bold uppercase tracking-widest mb-4">
          <span>🔥</span> Live 1v1 Challenge
        </div>

        {/* Rivalry Banner */}
        <div className="bg-dh-surface/90 border border-dh-border rounded-xl py-1.5 px-4 mb-5 text-[11px] font-heading font-black text-dh-accent tracking-wide shadow-inner">
          {rivalrySummary}
        </div>

        {/* VS Avatars Display */}
        <div className="flex items-center justify-center gap-6 mb-6">
          {/* Host */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="absolute -inset-1 bg-dh-red rounded-full opacity-60 blur-[3px]" />
              <img
                src={hostAvatar}
                alt={duel.hostUsername}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full relative z-10 border-3 border-dh-red bg-dh-surface object-cover shadow-lg"
              />
            </div>
            <p className="font-heading font-black text-white text-sm mt-2 truncate max-w-[100px]">
              {duel.hostUsername}
            </p>
            <span className="text-[10px] font-heading font-bold text-dh-red bg-dh-red/10 px-2 py-0.5 rounded-full border border-dh-red/30 mt-0.5">
              {duel.hostTitle || 'Challenger'}
            </span>
          </div>

          {/* VS Center */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-3xl font-heading font-black text-dh-secondary animate-pulse">
              VS
            </span>
            <span className="text-[10px] font-heading font-bold text-dh-text-muted uppercase tracking-wider mt-1">
              DUEL
            </span>
          </div>

          {/* You (Guest) */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="absolute -inset-1 bg-dh-accent rounded-full opacity-60 blur-[3px]" />
              <img
                src={myAvatar}
                alt="You"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full relative z-10 border-3 border-dh-accent bg-dh-surface object-cover shadow-lg"
              />
            </div>
            <p className="font-heading font-black text-white text-sm mt-2 truncate max-w-[100px]">
              {currentUser?.username || 'You'}
            </p>
            <span className="text-[10px] font-heading font-bold text-dh-accent bg-dh-accent/10 px-2 py-0.5 rounded-full border border-dh-accent/30 mt-0.5">
              {currentUser?.title || 'Contender'}
            </span>
          </div>
        </div>

        {/* Match Subject & Conditions Box */}
        <div className="bg-dh-surface border-2 border-dh-border rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{SUBJECT_EMOJIS[duel.config.subject] || '⚡'}</span>
            <div>
              <p className="text-[10px] font-heading font-bold text-dh-text-muted uppercase">
                Subject
              </p>
              <h4 className="text-base font-heading font-black text-white">
                {duel.config.subject}
              </h4>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dh-border text-center">
            <div>
              <span className="block text-[10px] text-dh-text-muted font-bold">Questions</span>
              <span className="text-xs font-heading font-black text-white">{duel.config.questionCount || 5} Rounds</span>
            </div>
            <div>
              <span className="block text-[10px] text-dh-text-muted font-bold">Timer</span>
              <span className="text-xs font-heading font-black text-white">{duel.config.secondsPerQ || 20}s / Q</span>
            </div>
            <div>
              <span className="block text-[10px] text-dh-text-muted font-bold">Scoring</span>
              <span className="text-xs font-heading font-black text-dh-accent">Speed x Streak</span>
            </div>
          </div>
        </div>

        {/* Accept Button */}
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full py-4 rounded-2xl bg-dh-green hover:bg-dh-green-light border-b-4 border-dh-green-dark active:border-b-0 active:translate-y-1 font-heading font-black text-white text-base uppercase tracking-wider transition-all shadow-xl shadow-dh-green/20 mb-3 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {accepting ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Starting Arena Match...
            </>
          ) : (
            'Accept Duel ⚔️'
          )}
        </button>

        {/* Decline */}
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-heading font-bold text-dh-text-muted hover:text-dh-red transition-colors py-1"
        >
          Decline & Return to Dashboard
        </button>
      </div>
    </div>
  );
};

export default DuelLobbyPage;
