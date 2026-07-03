import React, { useState, useEffect, useCallback, useRef } from 'react';
import api, { getAvatarUrl } from '../api';
import AnimatedNumber from '../components/AnimatedNumber';
import { sounds } from '../utils/sound';

/* ─── Skeleton card ───────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="bg-dh-card rounded-2xl p-4 border-2 border-b-4 border-dh-border animate-pulse">
    <div className="flex justify-center mb-3">
      <div className="w-20 h-20 rounded-full bg-dh-surface" />
    </div>
    <div className="h-4 bg-dh-surface rounded-full mb-2 mx-auto w-3/4" />
    <div className="h-3 bg-dh-surface rounded-full mb-4 mx-auto w-full" />
    <div className="h-9 bg-dh-surface rounded-xl" />
  </div>
);

/* ─── Toast notification ──────────────────────────────────── */
const Toast = ({ msg, type }) => {
  if (!msg) return null;
  const colour =
    type === 'success'
      ? 'bg-dh-green border-dh-accent/40 text-black'
      : 'bg-dh-red border-dh-red/40 text-white';
  return (
    <div
      className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl border-2 border-b-4
        font-heading font-black text-sm uppercase tracking-wide shadow-xl
        animate-[slide-up_0.3s_ease-out_forwards] ${colour}`}
    >
      {type === 'success' ? '✅' : '❌'} {msg}
    </div>
  );
};

/* ─── Item card ───────────────────────────────────────────── */
const ItemCard = ({ item, onBuy, onEquip }) => {
  const borderClass = item.owned && item.equipped
    ? 'border-dh-green shadow-[0_4px_0_0_#58cc02]'
    : item.owned
    ? 'border-dh-accent/40'
    : 'border-dh-border';

  const emoji = item.id === 'streak-freeze' ? '❄️' : item.type === 'consumable' ? '⚡' : null;

  return (
    <div
      className={`bg-dh-card rounded-2xl p-4 border-2 border-b-4 ${borderClass}
        transition-all duration-200 hover:scale-[1.03] hover:-translate-y-0.5 flex flex-col`}
    >
      {/* Avatar / icon */}
      <div className="flex justify-center mb-3">
        {item.type === 'avatar' ? (
          <img
            src={getAvatarUrl(item.id)}
            alt={item.name}
            className="w-20 h-20 rounded-full bg-dh-surface border-2 border-dh-border"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-dh-accent/20 flex items-center justify-center text-3xl">
            {emoji}
          </div>
        )}
      </div>

      {/* Labels */}
      <h3 className="font-heading font-bold text-dh-text text-base text-center">{item.name}</h3>
      <p className="text-dh-text-muted text-xs text-center mt-1 mb-3 flex-1">{item.description}</p>

      {/* Action */}
      <div className="flex flex-col gap-2">
        {item.owned ? (
          item.type === 'avatar' ? (
            <button
              onClick={() => onEquip(item.id)}
              className={`w-full py-2.5 rounded-xl font-heading font-black text-sm uppercase tracking-wide transition-all
                ${item.equipped
                  ? 'bg-dh-green/20 text-dh-green border-2 border-dh-green/40 cursor-default'
                  : 'bg-dh-accent border-b-4 border-dh-accent-dark text-black active:translate-y-[2px] active:border-b-0'
                }`}
            >
              {item.equipped ? 'Equipped ✓' : 'Equip'}
            </button>
          ) : (
            <div className="text-center text-dh-green font-heading font-bold text-sm py-2">
              Owned ✓
            </div>
          )
        ) : (
          <button
            onClick={() => onBuy(item.id)}
            className="w-full py-2.5 rounded-xl font-heading font-black text-sm uppercase tracking-wide
              bg-dh-yellow border-b-4 border-dh-yellow-dark text-black
              active:translate-y-[2px] active:border-b-0 transition-all
              hover:brightness-110"
          >
            🪙 {item.price}
          </button>
        )}
      </div>
    </div>
  );
};

/* ─── Main Shop page ──────────────────────────────────────── */
const Shop = () => {
  const [items, setItems] = useState([]);
  const [coins, setCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const toastTimerRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  // Clear any pending toast timer on unmount
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const fetchShop = useCallback(async () => {
    try {
      const res = await api.get('/api/shop/items');
      setItems(res.data.data);
      setCoins(res.data.coins);
    } catch (err) {
      console.error('Failed to fetch shop:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  const handleBuy = async (itemId) => {
    try {
      sounds.click();
      const res = await api.post('/api/shop/buy', { itemId });
      setCoins(res.data.coins);
      sounds.coin();
      showToast(res.data.message, 'success');
      fetchShop();
    } catch (err) {
      sounds.damage();
      showToast(err.response?.data?.message || 'Purchase failed', 'error');
    }
  };

  const handleEquip = async (itemId) => {
    try {
      sounds.click();
      await api.post('/api/shop/equip', { itemId });
      sounds.win();
      showToast('Avatar equipped!', 'success');
      fetchShop();
    } catch (err) {
      sounds.damage();
      showToast(err.response?.data?.message || 'Equip failed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-dh-bg pb-32 px-4 pt-6">
      <Toast msg={toast.msg} type={toast.type} />

      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-black text-dh-text">Avatar Shop</h1>
            <p className="text-dh-text-muted text-sm">Spend your hard-earned coins!</p>
          </div>

          {/* Animated coin counter */}
          <div className="flex items-center gap-2 bg-dh-card px-4 py-2.5 rounded-xl border-2 border-b-4 border-dh-yellow/50 shadow-[0_4px_0_0_#e6a700]">
            <span className="text-xl">🪙</span>
            <span className="font-heading font-black text-dh-yellow text-xl tabular-nums">
              <AnimatedNumber value={coins} duration={700} />
            </span>
          </div>
        </div>

        {/* Category label */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-dh-border" />
          <span className="text-dh-text-muted text-xs font-heading font-bold uppercase tracking-widest">
            All Items
          </span>
          <div className="h-px flex-1 bg-dh-border" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onBuy={handleBuy}
                  onEquip={handleEquip}
                />
              ))}
        </div>

        {!loading && items.length === 0 && (
          <div className="text-center py-20 text-dh-text-muted font-heading font-bold">
            No items available right now.
          </div>
        )}
      </div>
    </div>
  );
};

export default Shop;