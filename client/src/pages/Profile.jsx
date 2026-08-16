import React, { useState, useEffect, useContext } from 'react';
import api, { getAvatarUrl } from '../api';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { useAppMode } from '../context/AppModeContext';
import { AuthContext } from '../context/AuthContext';
import ModeToggle from '../components/ModeToggle';
import { isPushSupported, getNotificationPermission, subscribeToPush, unsubscribeFromPush, sendTestPush } from '../utils/pushNotifications';
import { sounds } from '../utils/sound';

const Profile = () => {
  const { logout } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendMsg, setFriendMsg] = useState('');
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [processingUser, setProcessingUser] = useState(null);
  const [challengingFriendId, setChallengingFriendId] = useState(null);
  const [waitingForFriendId, setWaitingForFriendId] = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [pushPermission, setPushPermission] = useState(getNotificationPermission());
  const [pushBusy, setPushBusy] = useState(false);
  const [pushFeedback, setPushFeedback] = useState('');
  const { mode } = useAppMode();
  const navigate = useNavigate();

  useEffect(() => {
    setPushPermission(getNotificationPermission());
  }, []);

  const handleTogglePush = async () => {
    setPushBusy(true);
    setPushFeedback('');
    sounds.click?.();
    try {
      if (pushPermission === 'granted') {
        await unsubscribeFromPush();
        setPushPermission(getNotificationPermission());
        setPushFeedback('Push notifications disabled.');
      } else {
        const res = await subscribeToPush();
        setPushPermission(getNotificationPermission());
        if (res.ok) {
          sounds.success?.();
          setPushFeedback('✓ Push notifications active! You will receive live match alerts.');
        } else {
          setPushFeedback(res.error || 'Failed to enable notifications.');
        }
      }
    } catch (err) {
      setPushFeedback(err.message || 'Error updating push settings.');
    } finally {
      setPushBusy(false);
      setTimeout(() => setPushFeedback(''), 4000);
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushFeedback('');
    sounds.click?.();
    try {
      await sendTestPush();
      sounds.success?.();
      setPushFeedback('🚀 Test push notification sent! Check your phone/browser.');
    } catch (err) {
      setPushFeedback(err.message || 'Failed to send test push.');
    } finally {
      setPushBusy(false);
      setTimeout(() => setPushFeedback(''), 5000);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/api/user/me');
        setProfile(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
    fetchFriends();

    const intervalId = setInterval(() => {
      fetchFriends();
    }, 15000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await api.get(`/api/questions/subjects?category=${mode}`);
        if (res.data.success) {
          setAvailableSubjects(res.data.data);
        }
      } catch (err) {}
    };
    fetchSubjects();
  }, [mode]);

  useEffect(() => {
    const handleMatchFound = () => setWaitingForFriendId(null);
    const handleDeclined = () => {
      setWaitingForFriendId(null);
      alert('Your challenge was declined.');
    };

    socket.on('match_found', handleMatchFound);
    socket.on('match_request_declined', handleDeclined);

    return () => {
      socket.off('match_found', handleMatchFound);
      socket.off('match_request_declined', handleDeclined);
    };
  }, [waitingForFriendId]);

  const fetchFriends = async () => {
    try {
      const res = await api.get('/api/friends');
      const allFriends = res.data.data || [];
      setFriends(allFriends.filter((f) => f.status === 'accepted'));
      setIncomingRequests(allFriends.filter((f) => f.status === 'pending_received' || f.status === 'pending'));
    } catch (_) {}
  };

  const handleSendFriendRequest = async () => {
    if (!friendUsername.trim()) return;
    try {
      await api.post('/api/friends/request', { username: friendUsername.trim() });
      setFriendMsg('Friend request sent!');
      setFriendUsername('');
    } catch (err) {
      setFriendMsg(err.response?.data?.message || 'Failed to send request');
    }
    setTimeout(() => setFriendMsg(''), 3000);
  };

  const handleAcceptRequest = async (username) => {
    setProcessingUser(username);
    try {
      await api.post('/api/friends/accept', { username });
      await fetchFriends();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingUser(null);
    }
  };

  const handleDeclineRequest = async (username) => {
    setProcessingUser(username);
    try {
      await api.post('/api/friends/remove', { username });
      await fetchFriends();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dh-bg flex items-center justify-center text-dh-text font-heading font-bold text-xl animate-pulse">
        Loading Profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-dh-bg flex items-center justify-center text-dh-red font-heading font-bold text-xl">
        Failed to load profile.
      </div>
    );
  }

  const elo = profile.eloRating || 1200;
  const rankTier =
    elo >= 1800
      ? { title: 'Diamond Grandmaster', glow: 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)] text-cyan-300' }
      : elo >= 1500
      ? { title: 'Gold Challenger', glow: 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)] text-amber-300' }
      : { title: 'Silver Aspirant', glow: 'border-emerald-400 shadow-[0_0_15px_rgba(0,230,118,0.4)] text-emerald-400' };

  const matches = profile.matches || 0;
  const wins = profile.wins || 0;
  const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
  const currentAvatar = profile.equippedAvatar || profile.avatarSeed || 'default-seed';

  return (
    <div className="min-h-screen bg-dh-bg py-6 px-4 pb-28">
      <div className="max-w-2xl mx-auto space-y-5" style={{ animation: 'fadeInUp 0.4s ease-out forwards' }}>
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-dh-text-muted hover:text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors"
          >
            <span>←</span>
            <span>Arena Dashboard</span>
          </button>

          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dh-card border border-dh-border hover:border-dh-red/50 text-dh-text-muted hover:text-dh-red font-heading font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
          >
            <span>🚪</span>
            <span>Log Out</span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 1. PLAYER HERO PASSPORT                                */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="bg-gradient-to-br from-dh-card via-dh-surface to-dh-card rounded-3xl border-2 border-b-4 border-dh-border p-6 text-center relative overflow-hidden shadow-xl">
          {/* Ambient Glow */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-dh-accent/10 rounded-full blur-3xl pointer-events-none" />

          {/* Avatar Container */}
          <div className="relative inline-block mb-3">
            <div className={`w-28 h-28 rounded-full border-4 ${rankTier.glow.split(' ')[0]} bg-dh-card overflow-hidden mx-auto shadow-2xl p-1`}>
              <img
                src={getAvatarUrl(currentAvatar)}
                alt={profile.username}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            {/* Rank Badge */}
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-dh-card border border-dh-border text-[10px] font-heading font-black text-white shadow uppercase tracking-wider whitespace-nowrap">
              ⚡ {elo} ELO
            </span>
          </div>

          <h1 className="text-2xl font-heading font-black text-white mt-3">
            {profile.username}
          </h1>
          <p className={`text-xs font-heading font-bold mt-0.5 uppercase tracking-wider ${rankTier.glow.split(' ')[2]}`}>
            {rankTier.title}
          </p>

          {/* Customize in Shop Action */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => navigate('/shop')}
              className="px-5 py-2 rounded-xl bg-dh-card border-2 border-dh-border hover:border-dh-accent/60 text-dh-accent hover:text-white font-heading font-black text-xs uppercase tracking-wide flex items-center gap-2 shadow transition-all active:scale-95"
            >
              <span>🛒</span>
              <span>Avatar Shop & Inventory</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 2. CAREER COMBAT STATS                                 */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-dh-card/90 p-4 rounded-2xl border-2 border-b-4 border-dh-border text-center shadow-md">
            <p className="text-dh-text-muted text-[10px] font-heading font-black uppercase tracking-wider mb-1">Rating</p>
            <p className="text-2xl font-heading font-black text-dh-accent leading-tight">
              {elo}
            </p>
            <p className="text-[10px] font-bold text-dh-text-muted mt-0.5">Peak Rank</p>
          </div>

          <div className="bg-dh-card/90 p-4 rounded-2xl border-2 border-b-4 border-dh-border text-center shadow-md">
            <p className="text-dh-text-muted text-[10px] font-heading font-black uppercase tracking-wider mb-1">Total Duels</p>
            <p className="text-2xl font-heading font-black text-white leading-tight">
              {matches}
            </p>
            <p className="text-[10px] font-bold text-dh-text-muted mt-0.5">{wins} Wins</p>
          </div>

          <div className="bg-dh-card/90 p-4 rounded-2xl border-2 border-b-4 border-dh-border text-center shadow-md">
            <p className="text-dh-text-muted text-[10px] font-heading font-black uppercase tracking-wider mb-1">Win Rate</p>
            <p className="text-2xl font-heading font-black text-dh-green leading-tight">
              {winRate}%
            </p>
            <p className="text-[10px] font-bold text-dh-text-muted mt-0.5">{matches - wins} Losses</p>
          </div>
        </div>

        {/* Inventory Strip */}
        <div className="grid grid-cols-3 gap-2 bg-dh-card p-3 rounded-2xl border border-dh-border text-center text-xs">
          <div>
            <span className="text-dh-text-muted font-bold mr-1.5">🪙 Coins:</span>
            <span className="font-heading font-black text-dh-yellow">{profile.coins || 0}</span>
          </div>
          <div>
            <span className="text-dh-text-muted font-bold mr-1.5">🔥 Streak:</span>
            <span className="font-heading font-black text-orange-400">{profile.streak || 0}d</span>
          </div>
          <div>
            <span className="text-dh-text-muted font-bold mr-1.5">🛡️ Shields:</span>
            <span className="font-heading font-black text-cyan-300">{profile.streakFreeze || 0}</span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="pt-1">
          <ModeToggle />
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 3. QUICK FEATURE TILES                                 */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => navigate('/shop')}
            className="p-3.5 bg-dh-card hover:bg-dh-surface border-2 border-b-4 border-purple-500/40 rounded-2xl flex flex-col items-center gap-1 active:translate-y-[2px] transition-all"
          >
            <span className="text-2xl">🛒</span>
            <span className="font-heading font-black text-xs text-purple-300 uppercase tracking-wide">Shop</span>
          </button>

          <button
            onClick={() => navigate('/saved-questions')}
            className="p-3.5 bg-dh-card hover:bg-dh-surface border-2 border-b-4 border-dh-accent/40 rounded-2xl flex flex-col items-center gap-1 active:translate-y-[2px] transition-all"
          >
            <span className="text-2xl">📚</span>
            <span className="font-heading font-black text-xs text-dh-accent uppercase tracking-wide">Saved Qs</span>
          </button>

          <button
            onClick={() => navigate('/group-room')}
            className="p-3.5 bg-dh-card hover:bg-dh-surface border-2 border-b-4 border-dh-blue/40 rounded-2xl flex flex-col items-center gap-1 active:translate-y-[2px] transition-all"
          >
            <span className="text-2xl">👥</span>
            <span className="font-heading font-black text-xs text-dh-blue uppercase tracking-wide">Group</span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 3.5. PUSH NOTIFICATION & MATCH ALERTS SETTINGS         */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="bg-dh-card rounded-2xl border-2 border-b-4 border-dh-border p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🔔</span>
              <h2 className="text-sm font-heading font-black text-white uppercase tracking-wider">
                1v1 Match Push Alerts
              </h2>
            </div>
            <span className={`text-[11px] font-heading font-black px-2.5 py-0.5 rounded-full border ${
              pushPermission === 'granted'
                ? 'bg-dh-green/15 text-dh-green border-dh-green/40'
                : 'bg-dh-surface text-dh-text-muted border-dh-border'
            }`}>
              {pushPermission === 'granted' ? 'Active' : 'Disabled'}
            </span>
          </div>

          <p className="text-xs text-dh-text-muted mb-4 leading-relaxed">
            Get instant lock-screen & dropdown notifications when friends accept your 1v1 quiz challenges — even if your mobile browser is closed.
          </p>

          <div className="flex flex-wrap gap-2">
            {pushPermission !== 'granted' ? (
              <button
                onClick={handleTogglePush}
                disabled={pushBusy}
                className="flex-1 py-3 px-4 rounded-xl bg-dh-accent text-black font-heading font-black text-xs uppercase tracking-wide hover:brightness-110 active:scale-95 transition-all shadow flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>📲</span> {pushBusy ? 'Enabling...' : 'Enable Dropdown Alerts'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleTestPush}
                  disabled={pushBusy}
                  className="flex-1 py-3 px-4 rounded-xl bg-dh-surface border-2 border-dh-accent/40 text-dh-accent font-heading font-bold text-xs hover:bg-dh-accent/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span>🚀</span> {pushBusy ? 'Sending...' : 'Send Test Alert'}
                </button>
                <button
                  onClick={handleTogglePush}
                  disabled={pushBusy}
                  className="py-3 px-4 rounded-xl bg-dh-surface border border-dh-border text-dh-text-muted hover:text-white text-xs font-heading font-bold transition-all disabled:opacity-50"
                >
                  Turn Off
                </button>
              </>
            )}
          </div>

          {pushFeedback && (
            <p className="mt-3 text-xs font-heading font-bold text-dh-accent animate-fade-in">
              {pushFeedback}
            </p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 4. SOCIAL & FRIENDS DUELS                              */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="bg-dh-card rounded-2xl border-2 border-b-4 border-dh-border p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">👥</span>
              <h2 className="text-sm font-heading font-black text-white uppercase tracking-wider">
                Friends & Rivals
              </h2>
            </div>
            <span className="text-[11px] font-heading font-bold text-dh-text-muted bg-dh-surface px-2.5 py-0.5 rounded-full border border-dh-border">
              {friends.length} Friends
            </span>
          </div>

          {/* Add Friend Input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendFriendRequest()}
              placeholder="Add friend by username..."
              className="flex-1 bg-dh-surface border border-dh-border rounded-xl px-3.5 py-2.5 text-dh-text text-xs focus:outline-none focus:border-dh-accent placeholder-dh-text-muted"
            />
            <button
              onClick={handleSendFriendRequest}
              className="px-4 py-2.5 bg-dh-accent text-black rounded-xl font-heading font-black text-xs uppercase tracking-wide hover:brightness-110 active:scale-95 transition-all shadow"
            >
              Add
            </button>
          </div>

          {friendMsg && (
            <p className="text-dh-green font-heading font-bold text-xs mb-3 animate-fade-in">
              {friendMsg}
            </p>
          )}

          {/* Friends List */}
          {friends.length > 0 ? (
            <div className="space-y-2">
              {friends.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-dh-surface rounded-xl px-3.5 py-2.5 border border-dh-border relative"
                >
                  <div className="relative">
                    <img
                      src={getAvatarUrl(f.username)}
                      alt={f.username}
                      className="w-9 h-9 rounded-full bg-dh-card border border-dh-border"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-dh-surface ${
                        f.isOnline ? 'bg-dh-green' : 'bg-slate-600'
                      }`}
                      title={f.isOnline ? 'Online' : 'Offline'}
                    />
                  </div>
                  <span className="font-heading font-bold text-dh-text text-sm flex-1 truncate">
                    {f.username}
                  </span>

                  {waitingForFriendId === f.userId ? (
                    <span className="text-dh-text-muted text-xs font-heading font-bold animate-pulse">
                      Waiting...
                    </span>
                  ) : (
                    <button
                      disabled={!f.isOnline}
                      onClick={() =>
                        setChallengingFriendId(challengingFriendId === f.userId ? null : f.userId)
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-heading font-black uppercase tracking-wide transition-all ${
                        f.isOnline
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
                          : 'bg-dh-card text-dh-text-muted border border-dh-border opacity-50 cursor-not-allowed'
                      }`}
                    >
                      ⚔️ Duel
                    </button>
                  )}

                  {/* Subject Pick Dropdown */}
                  {challengingFriendId === f.userId && !waitingForFriendId && (
                    <div className="absolute right-0 top-12 bg-dh-card border-2 border-dh-border rounded-2xl p-2 shadow-2xl z-20 flex flex-col gap-1 w-52 max-h-56 overflow-y-auto animate-pop-in">
                      <p className="text-[10px] font-heading font-black text-dh-text-muted px-2 py-1 uppercase tracking-wider">
                        Choose Subject:
                      </p>
                      {availableSubjects.map((subj) => (
                        <button
                          key={subj}
                          onClick={() => {
                            socket.emit('send_match_request', { friendId: f.userId, subject: subj, mode });
                            setChallengingFriendId(null);
                            setWaitingForFriendId(f.userId);
                          }}
                          className="text-left text-xs font-heading font-bold text-dh-text hover:bg-dh-surface p-2 rounded-xl truncate transition-colors"
                        >
                          {subj}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dh-text-muted text-xs text-center py-4 italic">
              No friends added yet. Enter a username above to connect!
            </p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 5. INCOMING FRIEND REQUESTS                            */}
        {/* ═══════════════════════════════════════════════════════ */}
        {incomingRequests.length > 0 && (
          <div className="bg-dh-card rounded-2xl border-2 border-b-4 border-dh-border p-5 shadow-lg">
            <h2 className="text-sm font-heading font-black text-white uppercase tracking-wider mb-3">
              Incoming Friend Requests ({incomingRequests.length})
            </h2>
            <div className="space-y-2">
              {incomingRequests.map((req, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-dh-surface rounded-xl px-3.5 py-2.5 border border-dh-border"
                >
                  <img
                    src={getAvatarUrl(req.username)}
                    alt={req.username}
                    className="w-9 h-9 rounded-full bg-dh-card"
                  />
                  <span className="font-heading font-bold text-dh-text text-xs flex-1 truncate">
                    {req.username}
                  </span>
                  <button
                    disabled={processingUser === req.username}
                    onClick={() => handleAcceptRequest(req.username)}
                    className="px-3 py-1 bg-dh-green/15 text-dh-green border border-dh-green/30 rounded-lg text-xs font-heading font-black uppercase hover:bg-dh-green/25 disabled:opacity-50 transition-all"
                  >
                    Accept
                  </button>
                  <button
                    disabled={processingUser === req.username}
                    onClick={() => handleDeclineRequest(req.username)}
                    className="px-3 py-1 bg-dh-red/15 text-dh-red border border-dh-red/30 rounded-lg text-xs font-heading font-black uppercase hover:bg-dh-red/25 disabled:opacity-50 transition-all"
                  >
                    Decline
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;