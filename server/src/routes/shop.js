const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

const SHOP_ITEMS = [
  { id: 'avatar-robot', name: 'Iron Sentinel', description: 'A fearless mechanized hero', price: 500, type: 'avatar' },
  { id: 'avatar-ninja', name: 'Shadow Ninja', description: 'Strikes from the darkness', price: 800, type: 'avatar' },
  { id: 'avatar-wizard', name: 'Arcane Mage', description: 'Wields ancient sorcery', price: 1000, type: 'avatar' },
  { id: 'avatar-cyber', name: 'Cyber Ronin', description: 'Neon-soaked street warrior', price: 1500, type: 'avatar' },
  { id: 'avatar-samurai', name: 'Blade Master', description: 'Honor-bound warrior of the blade', price: 2000, type: 'avatar' },
  { id: 'avatar-alien', name: 'Star Voyager', description: 'Traveler from the deep cosmos', price: 2500, type: 'avatar' },
  { id: 'streak-freeze', name: 'Streak Freeze', description: 'Protect your streak for one day', price: 300, type: 'consumable' },
  { id: 'xp-boost', name: 'XP Boost', description: 'Double XP for next 3 matches', price: 500, type: 'consumable' },
];

router.get('/items', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('ownedItems equippedAvatar coins');
    const items = SHOP_ITEMS.map(item => ({
      ...item,
      owned: user.ownedItems.includes(item.id),
      equipped: user.equippedAvatar === item.id,
    }));
    res.json({ success: true, data: items, coins: user.coins });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/buy', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.body;
    const user = await User.findById(req.user.id);
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (user.ownedItems.includes(itemId)) return res.status(400).json({ message: 'Already owned' });
    if (user.coins < item.price) return res.status(400).json({ message: 'Not enough coins' });

    user.coins -= item.price;
    user.ownedItems.push(itemId);
    await user.save();

    res.json({ success: true, message: `Purchased ${item.name}`, coins: user.coins, ownedItems: user.ownedItems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/equip', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.body;
    const user = await User.findById(req.user.id);
    if (!user.ownedItems.includes(itemId)) return res.status(400).json({ message: 'Item not owned' });
    user.equippedAvatar = itemId;
    user.avatarSeed = itemId; // Sync avatarSeed so it shows up in matches and dashboards
    await user.save();
    res.json({ success: true, message: 'Avatar equipped', equippedAvatar: user.equippedAvatar });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;