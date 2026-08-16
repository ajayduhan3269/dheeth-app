const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const pushService = require('../services/pushService');

/**
 * GET /api/notifications/vapid-key
 * Returns the public VAPID key needed for client-side subscription
 */
router.get('/vapid-key', (req, res) => {
  try {
    const publicKey = pushService.getVapidPublicKey();
    res.json({ ok: true, publicKey });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/notifications/subscribe
 * Saves the client's PushSubscription
 */
router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ ok: false, error: 'Valid subscription object is required.' });
    }

    const userId = req.user.id || req.user._id || req.user.userId;
    const result = await pushService.saveSubscription(userId, subscription);
    res.json({ ok: true, count: result.count });
  } catch (err) {
    console.error('Error saving push subscription:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/notifications/unsubscribe
 * Removes a push subscription endpoint
 */
router.post('/unsubscribe', verifyToken, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user.id || req.user._id || req.user.userId;
    if (endpoint) {
      await pushService.removeSubscription(userId, endpoint);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/notifications/test
 * Sends a test push notification to the logged-in user
 */
router.post('/test', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id || req.user.userId;
    const result = await pushService.sendPushToUser(userId, {
      title: '⚔️ DHEETH Push Alert Test',
      body: 'Push notifications are working perfectly! You will get alerted when friends accept your challenges.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: '/dashboard' },
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
