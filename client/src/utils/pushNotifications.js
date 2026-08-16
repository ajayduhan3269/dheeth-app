import api from '../api';

/**
 * Convert a base64 string to a Uint8Array (required for VAPID applicationServerKey)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Web Push notifications are supported in this browser
 */
export const isPushSupported = () => {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

/**
 * Get current notification permission state
 */
export const getNotificationPermission = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
};

/**
 * Request notification permission and register push subscription with backend
 */
export const subscribeToPush = async () => {
  if (!isPushSupported()) {
    return { ok: false, error: 'Push notifications are not supported by this browser.' };
  }

  try {
    // 1. Request browser notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, permission, error: 'Notification permission was not granted.' };
    }

    // 2. Wait for Service Worker registration
    let registration = null;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch (_) {
      // Fallback: register service worker if needed
      registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    }

    if (!registration || !registration.pushManager) {
      return { ok: false, error: 'Service Worker PushManager is unavailable.' };
    }

    // 3. Fetch public VAPID key from backend
    const keyRes = await api.get('/api/notifications/vapid-key');
    const vapidPublicKey = keyRes.data?.publicKey;
    if (!vapidPublicKey) {
      return { ok: false, error: 'Could not fetch VAPID key from server.' };
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // 4. Subscribe to Push Manager
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // 5. Send subscription to DHEETH backend
    const subJSON = subscription.toJSON();
    await api.post('/api/notifications/subscribe', {
      subscription: {
        endpoint: subJSON.endpoint,
        keys: subJSON.keys,
      },
    });

    return { ok: true, permission: 'granted', subscription };
  } catch (err) {
    console.error('[PushNotifications] Subscription error:', err);
    return { ok: false, error: err.response?.data?.error || err.message || 'Failed to subscribe' };
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPush = async () => {
  if (!isPushSupported()) return { ok: false };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.post('/api/notifications/unsubscribe', { endpoint });
    }
    return { ok: true };
  } catch (err) {
    console.error('[PushNotifications] Unsubscribe error:', err);
    return { ok: false, error: err.message };
  }
};

/**
 * Send a test push notification to the current user
 */
export const sendTestPush = async () => {
  try {
    const res = await api.post('/api/notifications/test');
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Failed to trigger test push');
  }
};
