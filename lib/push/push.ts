/* eslint-disable @typescript-eslint/no-explicit-any */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported on this browser/device.');
    return { success: false, error: 'Push notifications are not supported on this device/browser.' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check push subscription
    let subscription = await registration.pushManager.getSubscription();

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('VAPID public key is missing.');
      return { success: false, error: 'VAPID public key is missing.' };
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to subscribe on server');
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to register push subscription:', error);
    return { success: false, error: error.message };
  }
}
