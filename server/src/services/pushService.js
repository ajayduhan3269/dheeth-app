const webPush = require('web-push');
const User = require('../models/User');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BKNWN1utO-aroUdxV3R1PVEeluWUfkSiWTorqpo-EstCnWagMdywmZMhkM4UT3ej2pkwm2ULhEVpR74L6oEspRY';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'FnIs4AR75uVelrDXx75tzODOjoHsgeIahRd66UKdEMk';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@dheeth.com';

try {
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[PushService] VAPID details configured successfully.');
} catch (err) {
  console.error('[PushService] Failed to set VAPID details:', err.message);
}

/**
 * Get the public VAPID key for frontend clients to subscribe
 */
const getVapidPublicKey = () => VAPID_PUBLIC_KEY;

/**
 * Save a push subscription for a user
 */
const saveSubscription = async (userId, subscription) => {
  if (!userId || !subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error('Invalid subscription data');
  }

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  if (!user.pushSubscriptions) {
    user.pushSubscriptions = [];
  }

  // Check if endpoint is already saved
  const existingIdx = user.pushSubscriptions.findIndex(s => s.endpoint === subscription.endpoint);
  if (existingIdx >= 0) {
    user.pushSubscriptions[existingIdx] = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      createdAt: new Date(),
    };
  } else {
    user.pushSubscriptions.push({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      createdAt: new Date(),
    });
  }

  // Keep at most 5 active devices/subscriptions per user
  if (user.pushSubscriptions.length > 5) {
    user.pushSubscriptions = user.pushSubscriptions.slice(-5);
  }

  await user.save();
  return { success: true, count: user.pushSubscriptions.length };
};

/**
 * Remove a push subscription for a user
 */
const removeSubscription = async (userId, endpoint) => {
  if (!userId || !endpoint) return;
  await User.updateOne(
    { _id: userId },
    { $pull: { pushSubscriptions: { endpoint } } }
  );
};

/**
 * Send a push notification to a specific user (all registered active devices)
 */
const sendPushToUser = async (userId, payload) => {
  if (!userId) return { success: false, reason: 'No userId provided' };

  try {
    const user = await User.findById(userId).select('pushSubscriptions username');
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
      console.log(`[PushService] No push subscriptions found for user: ${userId}`);
      return { success: false, reason: 'No subscriptions' };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title || '⚔️ DHEETH Challenge Alert',
      body: payload.body || 'Your 1v1 match is ready to play!',
      icon: payload.icon || '/favicon.svg',
      badge: payload.badge || '/favicon.svg',
      tag: payload.tag || `dheeth-${Date.now()}`,
      data: payload.data || { url: '/' },
    });

    const sendPromises = user.pushSubscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          notificationPayload,
          {
            TTL: 300, // 5 minutes time-to-live for live match urgency
            urgency: 'high',
          }
        );
        return { success: true, endpoint: sub.endpoint };
      } catch (err) {
        // If 404 or 410, subscription is no longer valid; prune it
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[PushService] Pruning expired push endpoint for ${user.username}`);
          await removeSubscription(userId, sub.endpoint);
        } else {
          console.error(`[PushService] Push error for ${user.username}:`, err.message);
        }
        return { success: false, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const deliveredCount = results.filter(r => r.success).length;
    console.log(`[PushService] Dispatched push to ${user.username}: ${deliveredCount}/${user.pushSubscriptions.length} delivered`);
    return { success: true, deliveredCount };
  } catch (err) {
    console.error(`[PushService] Fatal error sending push to ${userId}:`, err);
    return { success: false, error: err.message };
  }
};

module.exports = {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushToUser,
};
