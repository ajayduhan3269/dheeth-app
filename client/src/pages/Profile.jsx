import React, { useState, useEffect } from 'react';
import api, { getAvatarUrl } from '../api';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [bio, setBio] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [friends, setFriends] = useState([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendMsg, setFriendMsg] = useState('');
  const navigate = useNavigate();

  const seedOptions = ['shadow-ninja', 'cyber-ronin', 'arcane-mage', 'blade-master', 'star-voyager', 'iron-sentinel', 'midnight-hero', 'solar-knight'];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/api/user/me');
        setProfile(res.data);
        setBio(res.data.bio || '');
        setAvatarSeed(res.data.equippedAvatar || res.data.avatarSeed || 'default-seed');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const res = await api.get('/api/friends');
      setFriends(res.data.data.filter(f => f.status === 'accepted'));
    } catch (_) {}
  };

  const handleSendFriendRequest = async () => {
    try {
      await api.post('/api/friends/request', 
        { username: friendUsername }
      );
      setFriendMsg('Friend request sent!');
      setFriendUsername('');
    } catch (err) {
      setFriendMsg(err.response?.data?.message || 'Failed');
    }
    setTimeout(() => setFriendMsg(''), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await api.put('/api/user/profile', { avatarSeed, bio, equippedAvatar: avatarSeed });
      setProfile(res.data);
      setMessage('Profile updated successfully!');
    } catch (err) {
      setMessage('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-dh-bg flex items-center justify-center text-dh-text font-heading font-bold text-xl animate-pulse">Loading Profile...</div>;
  if (!profile) return <div className="min-h-screen bg-dh-bg flex items-center justify-center text-dh-red font-heading font-bold text-xl">Failed to load profile.</div>;

  return (
    <div className="min-h-screen bg-dh-bg py-8 px-4">
      <div className="max-w-3xl mx-auto bg-dh-card rounded-2xl border-2 border-b-4 border-dh-border overflow-hidden" style={{ animation: 'fadeInUp 0.5s ease-out forwards' }}>
        
        {/* Profile Banner */}
        <div className="bg-gradient-to-br from-dh-purple/80 to-dh-blue-dark p-8 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-dh-surface/30" />
          <img 
            src={getAvatarUrl(avatarSeed)} 
            alt="Avatar" 
            className="w-28 h-28 mx-auto bg-dh-card rounded-full border-4 border-white/30 shadow-lg mb-4 relative z-10"
          />
          <h1 className="text-3xl font-heading font-black relative z-10">{profile.username}</h1>
        </div>

        {/* Stats Row */}
        <div className="flex bg-dh-card border-b border-dh-border divide-x divide-dh-border">
          <div className="flex-1 p-5 text-center">
            <div className="text-dh-text-muted text-xs font-heading font-bold uppercase mb-1 tracking-wider">ELO Rating</div>
            <div className="text-3xl font-heading font-black text-dh-accent">{profile.eloRating}</div>
          </div>
          <div className="flex-1 p-5 text-center">
            <div className="text-dh-text-muted text-xs font-heading font-bold uppercase mb-1 tracking-wider">Total Matches</div>
            <div className="text-3xl font-heading font-black text-dh-text">{profile.matches}</div>
          </div>
          <div className="flex-1 p-5 text-center">
            <div className="text-dh-text-muted text-xs font-heading font-bold uppercase mb-1 tracking-wider">Wins</div>
            <div className="text-3xl font-heading font-black text-dh-green">{profile.wins}</div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex gap-3 p-6 pb-0">
          <button onClick={() => navigate('/shop')} className="flex-1 py-3 bg-dh-purple border-b-4 border-purple-800 rounded-xl font-heading font-black text-sm text-white uppercase tracking-wide active:translate-y-[2px] active:border-b-0 transition-all">
            🛒 Shop
          </button>
          <button onClick={() => navigate('/saved-questions')} className="flex-1 py-3 bg-dh-accent border-b-4 border-dh-accent-dark rounded-xl font-heading font-black text-sm text-white uppercase tracking-wide active:translate-y-[2px] active:border-b-0 transition-all">
            📚 Saved Q's
          </button>
          <button onClick={() => navigate('/group-room')} className="flex-1 py-3 bg-dh-blue border-b-4 border-dh-blue-dark rounded-xl font-heading font-black text-sm text-white uppercase tracking-wide active:translate-y-[2px] active:border-b-0 transition-all">
            👥 Group
          </button>
        </div>

        {/* Friends Section */}
        <div className="p-6">
          <h2 className="text-xl font-heading font-bold text-dh-text mb-4">Friends</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={friendUsername}
              onChange={e => setFriendUsername(e.target.value)}
              placeholder="Add by username..."
              className="flex-1 bg-dh-surface border border-dh-border rounded-xl p-3 text-dh-text text-sm focus:outline-none focus:border-dh-accent"
            />
            <button onClick={handleSendFriendRequest} className="px-4 py-3 bg-dh-accent border-b-4 border-dh-accent-dark text-white rounded-xl font-heading font-black text-sm uppercase tracking-wide active:translate-y-[2px] active:border-b-0 transition-all">
              Send
            </button>
          </div>
          {friendMsg && <p className="text-dh-green font-heading font-bold text-xs mb-3">{friendMsg}</p>}
          {friends.length > 0 ? (
            <div className="space-y-2">
              {friends.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-dh-surface rounded-xl px-4 py-3 border border-dh-border">
                  <img src={getAvatarUrl(f.username)} alt={f.username} className="w-10 h-10 rounded-full bg-dh-card" />
                  <span className="font-heading font-bold text-dh-text flex-1">{f.username}</span>
                  <span className="text-dh-green text-xs font-heading font-bold">✓ Friends</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dh-text-muted text-sm">No friends yet. Add some opponents!</p>
          )}
        </div>

        {/* Customize Section */}
        <div className="p-6 md:p-8 border-t border-dh-border">
          <h2 className="text-xl font-heading font-bold text-dh-text mb-6">Customize Profile</h2>
          
          {/* Avatar Selector */}
          <div className="mb-8">
            <label className="block text-xs font-heading font-bold text-dh-text-muted uppercase mb-3 tracking-wider">Choose an Avatar</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {seedOptions.map(seed => (
                <div 
                  key={seed} 
                  onClick={() => setAvatarSeed(seed)}
                  className={`cursor-pointer rounded-xl border-2 transition-all p-1 ${
                    avatarSeed === seed 
                      ? 'border-dh-accent bg-dh-accent/10 shadow-md shadow-dh-accent/20 scale-110' 
                      : 'border-dh-border hover:border-dh-accent/50 bg-dh-card'
                  }`}
                >
                  <img src={getAvatarUrl(seed)} alt={seed} className="w-full h-auto rounded-lg bg-dh-card" />
                </div>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="mb-8">
            <label className="block text-xs font-heading font-bold text-dh-text-muted uppercase mb-2 tracking-wider">Bio</label>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-dh-card border-2 border-dh-border rounded-xl p-4 focus:outline-none focus:border-dh-accent text-dh-text transition-colors resize-none placeholder-dh-text-muted"
              rows="3"
              placeholder="Tell us about yourself..."
            />
          </div>

          {/* Save */}
          <div className="flex items-center justify-between">
            <div className={`font-heading font-bold text-sm ${message.includes('success') ? 'text-dh-green' : 'text-dh-red'}`}>{message}</div>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="ml-auto bg-dh-accent border-b-4 border-dh-accent-dark text-white font-heading font-black uppercase tracking-wide py-3 px-8 rounded-xl transition-all disabled:opacity-50 active:translate-y-[2px] active:border-b-0"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;