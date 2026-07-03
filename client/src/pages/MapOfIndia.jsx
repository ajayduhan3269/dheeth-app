import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import MapOfIndia from '../components/IndiaMap';
import Confetti from '../components/Confetti';
import AnimatedNumber from '../components/AnimatedNumber';
import PageSkeleton from '../components/PageSkeleton';
import { sounds } from '../utils/sound';

const formatTimeLeft = (until) => {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const MapOfIndiaPage = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [states, setStates] = useState([]);
  const [conqueredCount, setConqueredCount] = useState(0);
  const [totalStates, setTotalStates] = useState(0);
  const [myConquests, setMyConquests] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [coins, setCoins] = useState(0);
  const [pendingTribute, setPendingTribute] = useState(0);
  const [tab, setTab] = useState('map');
  const [leaderboard, setLeaderboard] = useState([]);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    fetchMapData();
  }, []);

  useEffect(() => {
    if (tab === 'empires') fetchLeaderboard();
  }, [tab]);

  const fetchMapData = async () => {
    try {
      const res = await api.get('/api/map/states');
      setStates(res.data.data);
      setConqueredCount(res.data.conqueredCount);
      setTotalStates(res.data.totalStates);
      setMyConquests(res.data.myConquests || []);
      setCoins(res.data.coins || 0);
      setPendingTribute(res.data.pendingTribute || 0);
    } catch (err) {
      console.error('Failed to fetch map data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/api/map/leaderboard');
      setLeaderboard(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  const flashMsg = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleCollectTribute = async () => {
    try {
      const res = await api.post('/api/map/tribute', {});
      flashMsg(res.data.message);
      sounds.coin();
      setCoins(res.data.coins);
      setPendingTribute(0);
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Nothing to collect');
    }
  };

  const handleUpgrade = async () => {
    try {
      const res = await api.post('/api/map/upgrade',
        { stateId: selectedState.id }
      );
      flashMsg(res.data.message);
      sounds.coin();
      setCoins(res.data.coins);
      setSelectedState(null);
      fetchMapData();
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Upgrade failed');
    }
  };

  const handleBuyout = async () => {
    try {
      const res = await api.post('/api/map/buyout',
        { stateId: selectedState.id }
      );
      flashMsg(res.data.message);
      sounds.capture();
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 3200);
      setCoins(res.data.coins);
      setSelectedState(null);
      fetchMapData();
    } catch (err) {
      flashMsg(err.response?.data?.message || 'Buyout failed');
    }
  };

  const handleAttack = () => {
    const mode = selectedState.subject === 'General Studies' ? 'gs' : 'tech';
    navigate(`/dashboard?quickMatch=${selectedState.subject}&mode=${mode}&targetState=${selectedState.id}`);
  };

  if (loading) {
    return <PageSkeleton blocks={3} />;
  }

  const mine = selectedState ? myConquests.some(c => c.stateId === selectedState.id) : false;
  const myConquest = selectedState ? myConquests.find(c => c.stateId === selectedState.id) : null;
  const shieldLeft = selectedState?.shieldUntil ? formatTimeLeft(selectedState.shieldUntil) : null;
  const buyoutCost = selectedState
    ? (selectedState.conquered ? (selectedState.castleLevel || 1) * 800 : 300)
    : 0;

  return (
    <div className="min-h-screen w-full bg-dh-bg flex flex-col font-sans text-dh-text pb-28">
      {celebrate && <Confetti />}

      {/* HEADER */}
      <div className="w-full max-w-2xl mx-auto pt-4 px-4">
        <div className="bg-dh-card rounded-2xl border-2 border-b-4 border-dh-border p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/dashboard')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-dh-surface border-2 border-b-4 border-dh-border text-dh-text font-bold active:translate-y-[2px] active:border-b-2 transition-all">
                ←
              </button>
              <h1 className="text-xl font-heading font-black uppercase tracking-wide">⚔️ War Map</h1>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dh-surface border-2 border-dh-border">
              <span className="text-base">🪙</span>
              <span className="font-heading font-black text-dh-yellow text-sm"><AnimatedNumber value={coins} /></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-heading font-bold text-dh-text-muted">
                <span>Your Empire</span>
                <span>{conqueredCount}/{totalStates} states</span>
              </div>
              <div className="w-full bg-dh-surface rounded-full h-3 border border-dh-border overflow-hidden">
                <div
                  className="bg-dh-accent h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalStates > 0 ? Math.round((conqueredCount / totalStates) * 100) : 0}%` }}
                />
              </div>
            </div>
            <button
              onClick={handleCollectTribute}
              disabled={pendingTribute === 0}
              className={`px-4 py-2 rounded-xl border-2 border-b-4 font-heading font-black text-xs uppercase tracking-wider transition-all active:translate-y-[2px] active:border-b-2 ${
                pendingTribute > 0
                  ? 'bg-dh-yellow border-dh-yellow-dark text-black animate-bounce-subtle'
                  : 'bg-dh-surface border-dh-border text-dh-text-muted cursor-not-allowed'
              }`}
            >
              💰 Tribute {pendingTribute > 0 ? `+${pendingTribute}` : ''}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mt-3">
          {[
            { id: 'map', label: '🗺️ Map' },
            { id: 'empires', label: '🏆 Empires' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl border-2 border-b-4 font-heading font-black text-sm uppercase tracking-wider transition-all active:translate-y-[2px] active:border-b-2 ${
                tab === t.id
                  ? 'bg-dh-accent border-dh-accent-dark text-white'
                  : 'bg-dh-card border-dh-border text-dh-text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification */}
      {actionMsg && (
        <div className="max-w-2xl mx-auto mt-3 px-4 w-full">
          <div className="bg-dh-accent border-b-4 border-dh-accent-dark text-white text-center p-3 rounded-2xl font-heading font-bold animate-pop-in">
            {actionMsg}
          </div>
        </div>
      )}

      {/* Starter guide for new commanders */}
      {tab === 'map' && conqueredCount === 0 && (
        <div className="max-w-2xl mx-auto mt-3 px-4 w-full">
          <div className="bg-dh-blue/10 border-2 border-b-4 border-dh-blue/40 rounded-2xl p-4">
            <p className="font-heading font-black text-dh-blue text-sm uppercase tracking-wide mb-2">🚩 Claim your first territory</p>
            <ol className="text-xs font-bold text-dh-text-muted space-y-1 list-decimal list-inside">
              <li>Tap any <span className="text-dh-text">gray tile</span> - it's unclaimed and free to take</li>
              <li>Hit <span className="text-dh-blue">⚡ Claim Territory</span> to enter a quiz battle on that state's subject</li>
              <li>Win the battle - the state is yours, protected by a 12h shield 🛡️</li>
            </ol>
            <p className="text-[11px] font-bold text-dh-yellow mt-2">Tip: pick a state whose subject you're strongest in. It earns you 5 🪙/hour once captured!</p>
          </div>
        </div>
      )}

      {/* MAP TAB */}
      {tab === 'map' && (
        <div className="flex-1 w-full max-w-2xl mx-auto p-4">
          <div className="w-full bg-dh-card rounded-3xl border-2 border-b-4 border-dh-border p-4 relative overflow-hidden">
            <MapOfIndia states={states} myConquests={myConquests} onStateClick={setSelectedState} selectedId={selectedState?.id} />
          </div>
          <p className="text-center text-xs text-dh-text-muted font-bold mt-3">
            Win quiz battles to capture states. Castles absorb one attack per level - upgrade to defend!
          </p>
        </div>
      )}

      {/* EMPIRES TAB */}
      {tab === 'empires' && (
        <div className="flex-1 w-full max-w-2xl mx-auto p-4 flex flex-col gap-2">
          {leaderboard.length === 0 && (
            <div className="text-center text-dh-text-muted font-bold py-10">No empires yet. Be the first conqueror!</div>
          )}
          {leaderboard.map(entry => {
            const isMe = currentUser && entry.username === currentUser.username;
            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;
            return (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-b-4 ${
                  isMe ? 'bg-dh-accent/10 border-dh-accent/50' : 'bg-dh-card border-dh-border'
                }`}
              >
                <span className="w-8 text-center font-heading font-black text-lg">
                  {medal || entry.rank}
                </span>
                <div className="flex-1">
                  <p className={`font-heading font-bold ${isMe ? 'text-dh-accent' : 'text-dh-text'}`}>
                    {entry.username} {isMe && '(You)'}
                  </p>
                  <p className="text-[11px] font-bold text-dh-text-muted">
                    🗺️ {entry.statesCount} states · 🏰 {entry.totalLevel} castle levels
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-dh-surface border border-dh-border">
                  <span className="text-sm">⚡</span>
                  <span className="font-heading font-black text-dh-yellow text-sm">{entry.power}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STATE DRAWER */}
      {selectedState && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={() => setSelectedState(null)}
        >
          <div
            className="w-full md:max-w-md bg-dh-card rounded-t-3xl md:rounded-3xl border-t-4 md:border-4 border-dh-border p-6 pb-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-heading font-black text-dh-text">{selectedState.name}</h2>
                <p className="text-dh-text-muted text-xs font-bold mt-0.5">Battle subject: {selectedState.subject}</p>
              </div>
              <button
                onClick={() => setSelectedState(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-dh-surface border-2 border-b-4 border-dh-border text-dh-muted font-bold active:translate-y-[2px] active:border-b-2 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Ownership + defense info */}
            <div className="bg-dh-surface rounded-2xl border-2 border-dh-border p-4 mb-4">
              {selectedState.conquered ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-heading font-black ${mine ? 'text-dh-accent' : 'text-dh-red'}`}>
                      {mine ? '🟢 Your territory' : `🔴 Held by ${selectedState.conqueredBy}`}
                    </span>
                    {shieldLeft && (
                      <span className="text-xs font-heading font-black text-dh-blue bg-dh-blue/10 border border-dh-blue/40 rounded-lg px-2 py-1">
                        🛡️ {shieldLeft}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-dh-text-muted">Castle defense:</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-4 h-4 rounded-sm border ${
                            i < (selectedState.castleLevel || 1)
                              ? mine ? 'bg-dh-accent border-dh-accent-dark' : 'bg-dh-red border-dh-red-dark'
                              : 'bg-dh-card border-dh-border'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-heading font-black text-dh-text">Lv{selectedState.castleLevel || 1}</span>
                  </div>
                  {mine && myConquest && (
                    <p className="text-[11px] font-bold text-dh-yellow mt-2">
                      💰 Earning {5 * (myConquest.castleLevel || 1)} 🪙/hour {myConquest.pendingTribute > 0 && `· ${myConquest.pendingTribute} pending`}
                    </p>
                  )}
                </>
              ) : (
                <span className="text-sm font-heading font-black text-dh-text-muted">⬛ Unclaimed territory</span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {/* MY STATE: upgrade defense */}
              {mine && (
                <button
                  onClick={handleUpgrade}
                  disabled={(myConquest?.castleLevel || 1) >= 5}
                  className={`w-full p-4 rounded-2xl border-b-4 text-left flex items-center gap-4 active:translate-y-1 active:border-b-0 transition-all ${
                    (myConquest?.castleLevel || 1) >= 5
                      ? 'bg-dh-surface border-dh-border text-dh-text-muted cursor-not-allowed'
                      : 'bg-dh-accent border-dh-accent-dark text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">🏰</div>
                  <div className="flex flex-col">
                    <span className="text-lg font-heading font-black uppercase tracking-wide leading-tight">
                      {(myConquest?.castleLevel || 1) >= 5 ? 'Max Defense' : 'Fortify Castle'}
                    </span>
                    <span className="text-xs font-bold opacity-80">
                      {(myConquest?.castleLevel || 1) >= 5
                        ? 'This fortress is impenetrable'
                        : `${(myConquest?.castleLevel || 1) * 300} 🪙 · +1 attack absorbed · +5 🪙/hr tribute`}
                    </span>
                  </div>
                </button>
              )}

              {/* ENEMY STATE: siege */}
              {selectedState.conquered && !mine && (
                <button
                  onClick={handleAttack}
                  disabled={!!shieldLeft}
                  className={`w-full p-4 rounded-2xl border-b-4 text-left flex items-center gap-4 active:translate-y-1 active:border-b-0 transition-all ${
                    shieldLeft
                      ? 'bg-dh-surface border-dh-border text-dh-text-muted cursor-not-allowed'
                      : 'bg-dh-red border-dh-red-dark text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">⚔️</div>
                  <div className="flex flex-col">
                    <span className="text-lg font-heading font-black uppercase tracking-wide leading-tight">
                      {shieldLeft ? `Shielded (${shieldLeft})` : (selectedState.castleLevel || 1) > 1 ? 'Siege Castle' : 'Capture State'}
                    </span>
                    <span className="text-xs font-bold opacity-80">
                      {shieldLeft
                        ? 'Cannot attack until shield expires'
                        : (selectedState.castleLevel || 1) > 1
                          ? `Win a battle to break 1 defense (${selectedState.castleLevel} left)`
                          : 'Win a battle to take this state!'}
                    </span>
                  </div>
                </button>
              )}

              {/* UNCLAIMED: battle to claim */}
              {!selectedState.conquered && (
                <button
                  onClick={handleAttack}
                  className="w-full p-4 rounded-2xl border-b-4 border-dh-blue-dark bg-dh-blue text-white text-left flex items-center gap-4 active:translate-y-1 active:border-b-0 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">⚡</div>
                  <div className="flex flex-col">
                    <span className="text-lg font-heading font-black uppercase tracking-wide leading-tight">Claim Territory</span>
                    <span className="text-xs font-bold opacity-80">Win a {selectedState.subject} battle to plant your flag</span>
                  </div>
                </button>
              )}

              {/* Buyout (not mine, not shielded) */}
              {!mine && (
                <button
                  onClick={handleBuyout}
                  disabled={!!shieldLeft}
                  className={`w-full p-4 rounded-2xl border-b-4 text-left flex items-center gap-4 active:translate-y-1 active:border-b-0 transition-all ${
                    shieldLeft
                      ? 'bg-dh-surface border-dh-border text-dh-text-muted cursor-not-allowed'
                      : 'bg-dh-yellow border-dh-yellow-dark text-black'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-xl shrink-0">💰</div>
                  <div className="flex flex-col">
                    <span className="text-lg font-heading font-black uppercase tracking-wide leading-tight">Buyout</span>
                    <span className="text-xs font-bold opacity-80">
                      {shieldLeft ? 'Shielded states cannot be bought' : `Instant takeover for ${buyoutCost} 🪙`}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapOfIndiaPage;
