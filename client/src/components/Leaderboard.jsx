import React, { useEffect, useState } from 'react';
import api, { getAvatarUrl } from '../api';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const res = await api.get('/api/leaderboard');
        setLeaders(res.data);
      } catch (error) {
        console.error('Error fetching leaderboard', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaders();
  }, []);

  if (loading) return <div className="text-center text-dh-text-muted py-4 font-heading font-bold tracking-widest uppercase animate-pulse">Loading rankings...</div>;

  const getMedalEmoji = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return null;
  };

  return (
    <div className="bg-dh-card rounded-2xl overflow-hidden border-2 border-b-4 border-dh-border">
      <div className="bg-dh-surface px-6 py-4 border-b-2 border-dh-border flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-dh-accent">
          <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.035-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
        </svg>
        <h3 className="text-lg font-heading font-bold text-white uppercase tracking-wider">Top Engineers</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-dh-border">
          <thead className="bg-dh-card/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-heading font-bold text-dh-text-muted uppercase tracking-wider">Rank</th>
              <th className="px-6 py-4 text-left text-xs font-heading font-bold text-dh-text-muted uppercase tracking-wider">Username</th>
              <th className="px-6 py-4 text-center text-xs font-heading font-bold text-dh-text-muted uppercase tracking-wider">ELO</th>
              <th className="px-6 py-4 text-center text-xs font-heading font-bold text-dh-text-muted uppercase tracking-wider">Win Rate</th>
            </tr>
          </thead>
          <tbody className="bg-dh-surface divide-y divide-dh-border">
            {leaders.map((user, index) => (
              <tr key={user._id} className={`${index === 0 ? "bg-dh-accent/5" : "hover:bg-dh-card/50"} transition-colors`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-heading font-bold text-dh-text">
                  {getMedalEmoji(index) || `#${index + 1}`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-dh-text">
                  <div className="flex items-center gap-3">
                    <img 
                      src={getAvatarUrl(user.avatarSeed || 'default-seed')} 
                      alt="Avatar" 
                      className="w-10 h-10 rounded-full bg-dh-card border border-dh-border shadow-sm"
                    />
                    <span>{user.username}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-heading font-black text-dh-accent" style={{ textShadow: '0 0 8px rgba(255, 204, 0, 0.5)' }}>
                  {user.stats.eloRating}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-dh-text-muted font-medium">
                  {user.stats.totalMatches > 0 
                    ? Math.round((user.stats.wins / user.stats.totalMatches) * 100) 
                    : 0}%
                </td>
              </tr>
            ))}
            {leaders.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-dh-text-muted font-medium">
                  No engineers ranked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}