import React, { useState, useEffect } from 'react';
import api from '../api';
import { socket } from '../socket';
import { sounds } from '../utils/sound';
import { useAppMode } from '../context/AppModeContext';
import { isPushSupported, getNotificationPermission, subscribeToPush } from '../utils/pushNotifications';

const SUBJECTS_BY_CATEGORY = {
  tech: [
    { name: 'Fluid Mechanics', emoji: '💧', color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-400' },
    { name: 'Building Materials', emoji: '🧱', color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-400' },
    { name: 'Environmental Engineering', emoji: '🌿', color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400' },
    { name: 'Highway Engineering', emoji: '🛣️', color: 'from-slate-500/20 to-zinc-500/10 border-slate-500/30 text-slate-300' },
    { name: 'Irrigation Engineering', emoji: '🌾', color: 'from-lime-500/20 to-green-500/10 border-lime-500/30 text-lime-400' },
    { name: 'Surveying', emoji: '🔭', color: 'from-indigo-500/20 to-purple-500/10 border-indigo-500/30 text-indigo-400' },
    { name: 'Civil Engineering', emoji: '🏗️', color: 'from-orange-500/20 to-red-500/10 border-orange-500/30 text-orange-400' },
  ],
  gs: [
    { name: 'Polity', emoji: '🏛️', color: 'from-sky-500/20 to-indigo-500/10 border-sky-500/30 text-sky-400' },
    { name: 'Ancient History', emoji: '🏺', color: 'from-amber-700/20 to-orange-700/10 border-amber-600/30 text-amber-300' },
    { name: 'Medieval History', emoji: '🏰', color: 'from-rose-600/20 to-red-600/10 border-rose-500/30 text-rose-400' },
    { name: 'Modern History', emoji: '📜', color: 'from-slate-600/20 to-gray-600/10 border-slate-500/30 text-slate-300' },
    { name: 'Indian Geography & Resources', emoji: '🗺️', color: 'from-amber-600/20 to-yellow-600/10 border-amber-500/30 text-amber-400' },
    { name: 'World Core & Climate', emoji: '🌏', color: 'from-teal-500/20 to-emerald-500/10 border-teal-500/30 text-teal-400' },
    { name: 'Biology', emoji: '🧬', color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-400' },
  ],
};

const CreateDuelModal = ({ isOpen, onClose, onDuelCreated }) => {
  const { mode: appMode } = useAppMode();
  const [selectedCategory, setSelectedCategory] = useState(appMode === 'gs' ? 'gs' : 'tech');
  const [selectedSubject, setSelectedSubject] = useState(
    SUBJECTS_BY_CATEGORY[appMode === 'gs' ? 'gs' : 'tech'][0].name
  );
  const [questionCount, setQuestionCount] = useState(5);
  const [secondsPerQ, setSecondsPerQ] = useState(30);
  const [loading, setLoading] = useState(false);
  const [createdDuel, setCreatedDuel] = useState(null);
  const [copied, setCopied] = useState(false);
  const [peerStatus, setPeerStatus] = useState(null);
  const [pushStatus, setPushStatus] = useState(getNotificationPermission());
  const [enablingPush, setEnablingPush] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialCat = appMode === 'gs' ? 'gs' : 'tech';
      setSelectedCategory(initialCat);
      setSelectedSubject(SUBJECTS_BY_CATEGORY[initialCat][0].name);
      setPushStatus(getNotificationPermission());
    }
  }, [isOpen, appMode]);

  const handleCategoryChange = (cat) => {
    sounds.click?.();
    setSelectedCategory(cat);
    const catSubjects = SUBJECTS_BY_CATEGORY[cat] || SUBJECTS_BY_CATEGORY.tech;
    setSelectedSubject(catSubjects[0]?.name || 'Fluid Mechanics');
  };

  const handleEnablePush = async () => {
    setEnablingPush(true);
    sounds.click?.();
    try {
      const res = await subscribeToPush();
      if (res.ok) {
        setPushStatus('granted');
        sounds.success?.();
      } else if (res.permission === 'denied') {
        setPushStatus('denied');
        alert('Notification permission was blocked in browser settings. Please enable it to receive match alerts.');
      }
    } catch (err) {
      console.error('Push error:', err);
    } finally {
      setEnablingPush(false);
    }
  };

  useEffect(() => {
    if (!createdDuel?.code) return;

    // Join room to track if opponent opens lobby
    socket.emit('duel:join_lobby', { code: createdDuel.code });

    const handlePeerJoined = (data) => {
      sounds.success?.();
      setPeerStatus(`${data.username} opened your challenge!`);
    };

    const handleMatchFound = () => {
      handleClose();
    };

    socket.on('duel:peer_joined', handlePeerJoined);
    socket.on('match_found', handleMatchFound);

    return () => {
      socket.off('duel:peer_joined', handlePeerJoined);
      socket.off('match_found', handleMatchFound);
    };
  }, [createdDuel]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    setLoading(true);
    sounds.click();
    try {
      const res = await api.post('/api/duel/create', {
        subject: selectedSubject,
        category: selectedCategory,
        questionCount,
        secondsPerQ,
      });

      if (res.data?.ok) {
        setCreatedDuel(res.data.duel);
        sounds.success?.();
        onDuelCreated?.(res.data.duel);
      }
    } catch (err) {
      console.error('Failed to create duel:', err);
      alert(err.response?.data?.error || 'Failed to create duel challenge.');
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = () => {
    if (!createdDuel) return '';
    return `${window.location.origin}/duel/${createdDuel.code}`;
  };

  const handleShareWhatsApp = () => {
    if (!createdDuel) return;
    sounds.click();
    const shareUrl = getShareUrl();
    const catLabel = createdDuel.config?.category === 'gs' ? '🌍 GS' : '🏗️ Civil Eng';
    const message = `🔥 *DHEETH 1v1 Quiz Duel!*\n\nI challenge you to a live quiz duel in *${createdDuel.config.subject}* [${catLabel}] (${createdDuel.config.questionCount} Questions · ${createdDuel.config.secondsPerQ}s).\n\n👉 *Accept Challenge here:* ${shareUrl}\n\n⚔️ Or enter Code: *${createdDuel.code}*`;

    // Try Web Share API first if on mobile
    if (navigator.share) {
      navigator.share({
        title: 'DHEETH 1v1 Challenge',
        text: message,
        url: shareUrl,
      }).catch(() => {
        // User cancelled or fallback
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
      });
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const handleCopyLink = () => {
    const url = getShareUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    sounds.click();
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    setCreatedDuel(null);
    setPeerStatus(null);
    onClose();
  };

  const currentSubjects = SUBJECTS_BY_CATEGORY[selectedCategory] || SUBJECTS_BY_CATEGORY.tech;

  return (
    <div className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-dh-card border-4 border-dh-border rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-dh-text-muted hover:text-white text-xl font-bold w-8 h-8 rounded-full bg-dh-surface flex items-center justify-center transition-colors"
        >
          ✕
        </button>

        {!createdDuel ? (
          <>
            {/* Step 1: Configuration Form */}
            <div className="w-14 h-14 mx-auto rounded-2xl bg-dh-accent/15 border-2 border-dh-accent/40 flex items-center justify-center text-3xl mb-4 shadow-lg shadow-dh-accent/10">
              ⚔️
            </div>
            <h2 className="text-2xl font-heading font-black text-white mb-1">
              Challenge a Friend
            </h2>
            <p className="text-xs text-dh-text-muted mb-5">
              Create a custom 1v1 live quiz duel in Civil Engineering or GS!
            </p>

            {/* Category Selector (Civil Eng vs General Studies) */}
            <div className="mb-4 text-left">
              <label className="block text-[11px] font-heading font-bold text-dh-text-muted uppercase tracking-wider mb-2">
                Exam Stream
              </label>
              <div className="flex items-center justify-center p-1 bg-dh-surface rounded-2xl border border-dh-border">
                <button
                  type="button"
                  onClick={() => handleCategoryChange('tech')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-heading font-black flex items-center justify-center gap-1.5 transition-all ${
                    selectedCategory === 'tech'
                      ? 'bg-dh-purple text-white shadow-lg shadow-dh-purple/30 scale-[1.02]'
                      : 'text-dh-text-muted hover:text-white'
                  }`}
                >
                  <span className="text-sm">🏗️</span>
                  <span>Civil Eng</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange('gs')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-heading font-black flex items-center justify-center gap-1.5 transition-all ${
                    selectedCategory === 'gs'
                      ? 'bg-dh-orange text-white shadow-lg shadow-dh-orange/30 scale-[1.02]'
                      : 'text-dh-text-muted hover:text-white'
                  }`}
                >
                  <span className="text-sm">🌍</span>
                  <span>General Studies (GS)</span>
                </button>
              </div>
            </div>

            {/* Subject Picker */}
            <div className="text-left mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-heading font-bold text-dh-text-muted uppercase tracking-wider">
                  Choose Subject
                </label>
                <span className="text-[10px] font-heading font-bold text-dh-text-muted uppercase">
                  {currentSubjects.length} Available
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {currentSubjects.map((sub) => {
                  const isSelected = selectedSubject === sub.name;
                  return (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() => {
                        setSelectedSubject(sub.name);
                        sounds.click();
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        isSelected
                          ? `bg-gradient-to-r ${sub.color} border-dh-accent shadow-md scale-[1.02]`
                          : 'bg-dh-surface border-dh-border/60 hover:border-dh-border text-dh-text'
                      }`}
                    >
                      <span className="text-lg">{sub.emoji}</span>
                      <span className="text-xs font-heading font-bold truncate">
                        {sub.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rounds & Timer Row */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-left">
              {/* Question Count */}
              <div>
                <label className="block text-[10px] font-heading font-bold text-dh-text-muted uppercase tracking-wider mb-1.5">
                  Rounds
                </label>
                <div className="grid grid-cols-3 gap-1 bg-dh-surface p-1 rounded-xl border border-dh-border">
                  {[5, 10, 15].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        setQuestionCount(cnt);
                        sounds.click();
                      }}
                      className={`py-1.5 text-xs font-heading font-bold rounded-lg transition-all ${
                        questionCount === cnt
                          ? 'bg-dh-accent text-black shadow-sm font-black'
                          : 'text-dh-text-muted hover:text-white'
                      }`}
                    >
                      {cnt} Qs
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer per Q */}
              <div>
                <label className="block text-[10px] font-heading font-bold text-dh-text-muted uppercase tracking-wider mb-1.5">
                  Time per Q
                </label>
                <div className="grid grid-cols-3 gap-1 bg-dh-surface p-1 rounded-xl border border-dh-border">
                  {[15, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setSecondsPerQ(sec);
                        sounds.click();
                      }}
                      className={`py-1.5 text-xs font-heading font-bold rounded-lg transition-all ${
                        secondsPerQ === sec
                          ? 'bg-dh-accent text-black shadow-sm font-black'
                          : 'text-dh-text-muted hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-dh-accent hover:bg-dh-accent/90 border-b-4 border-dh-accent-dark active:border-b-0 active:translate-y-1 font-heading font-black text-black text-base uppercase tracking-wider shadow-lg shadow-dh-accent/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Generating Challenge...
                </>
              ) : (
                'Generate Duel Invite 🚀'
              )}
            </button>
          </>
        ) : (
          <>
            {/* Step 2: Duel Ready / Share Screen */}
            <div className="w-16 h-16 mx-auto rounded-full bg-dh-accent/20 border-2 border-dh-accent flex items-center justify-center text-3xl mb-4 relative">
              <span className="animate-ping absolute inset-0 rounded-full bg-dh-accent/30 pointer-events-none" />
              <span>🔥</span>
            </div>

            <h2 className="text-2xl font-heading font-black text-white mb-1">
              Your Duel is Ready!
            </h2>
            <p className="text-xs text-dh-text-muted mb-4">
              Share this with your friend in <span className="text-dh-accent font-bold">{createdDuel.config.subject}</span> ({createdDuel.config?.category === 'gs' ? '🌍 GS' : '🏗️ Civil Eng'}). As soon as they accept, the match starts!
            </p>

            {/* Monospace Code Display */}
            <div className="bg-dh-surface border-2 border-dh-border rounded-2xl p-4 mb-4 flex items-center justify-center gap-2">
              {createdDuel.code.split('').map((char, index) => (
                <div
                  key={index}
                  className="w-9 h-11 bg-dh-bg border border-dh-accent/40 rounded-xl flex items-center justify-center text-xl font-heading font-black text-dh-accent shadow-inner tracking-wider"
                >
                  {char}
                </div>
              ))}
            </div>

            {/* Peer Status Toast */}
            {peerStatus ? (
              <div className="bg-dh-green/15 border border-dh-green/40 text-dh-green text-xs font-heading font-bold py-2 px-3 rounded-xl mb-4 animate-bounce">
                🎉 {peerStatus}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs font-heading font-bold text-dh-text-muted mb-3">
                <div className="w-2 h-2 rounded-full bg-dh-accent animate-ping" />
                Waiting for friend to accept...
              </div>
            )}

            {/* Web Push Notification Prompt / Status */}
            {isPushSupported() && pushStatus !== 'granted' && (
              <div className="bg-dh-accent/10 border-2 border-dh-accent/40 rounded-2xl p-3 mb-4 text-left flex items-start gap-3 animate-fade-in shadow-inner">
                <span className="text-2xl shrink-0 mt-0.5">🔔</span>
                <div className="flex-1">
                  <p className="text-xs font-heading font-black text-white">Get Dropdown Match Alert</p>
                  <p className="text-[11px] text-dh-text-muted font-body mt-0.5 leading-tight">
                    Get an instant push notification on your mobile screen when an opponent accepts (even if browser is closed).
                  </p>
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    disabled={enablingPush}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-dh-accent text-black font-heading font-black text-[11px] uppercase tracking-wide hover:brightness-110 active:scale-95 transition-all shadow flex items-center gap-1.5"
                  >
                    {enablingPush ? (
                      <>
                        <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        Enabling...
                      </>
                    ) : (
                      'Enable Match Alerts 📲'
                    )}
                  </button>
                </div>
              </div>
            )}

            {isPushSupported() && pushStatus === 'granted' && (
              <div className="bg-dh-green/10 border border-dh-green/30 rounded-xl py-2 px-3 mb-3 flex items-center justify-center gap-2 text-[11px] font-heading font-bold text-dh-green">
                <span>✓</span> Push notifications active! We'll alert your phone when they accept.
              </div>
            )}

            {/* 1-Tap WhatsApp Share Button */}
            <button
              onClick={handleShareWhatsApp}
              className="w-full py-4 mb-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] border-b-4 border-[#128C7E] active:border-b-0 active:translate-y-1 font-heading font-black text-white text-sm uppercase tracking-wide flex items-center justify-center gap-2.5 shadow-xl shadow-[#25D366]/20 transition-all"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              Share on WhatsApp
            </button>

            {/* Copy Link Button */}
            <button
              onClick={handleCopyLink}
              className="w-full py-3 rounded-xl bg-dh-surface border-2 border-dh-border hover:border-dh-accent text-xs font-heading font-bold text-white transition-all flex items-center justify-center gap-2 mb-3"
            >
              <span>{copied ? '✓' : '📋'}</span>
              {copied ? 'Link Copied to Clipboard!' : 'Copy Direct Duel Link'}
            </button>

            <button
              onClick={handleClose}
              className="text-xs font-heading font-bold text-dh-text-muted hover:text-white transition-colors py-1"
            >
              Done & Return to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateDuelModal;
