import { registerPushSubscription, removePushSubscription } from "@/lib/server/notifications/preferences";

export function canUseWebPush() {
  return typeof window !== "undefined" && window.isSecureContext &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function applicationKey(publicKey: string) {
  const padded = publicKey.replaceAll("-", "+").replaceAll("_", "/");
  const bytes = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0)).buffer;
}

export async function enableBrowserPush(publicKey: string) {
  if (!canUseWebPush()) throw new Error("This browser does not support Web Push on this connection");
  // This function must only run from an explicit user click.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted");
  const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  const old = await registration.pushManager.getSubscription();
  if (old) await old.unsubscribe();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationKey(publicKey),
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    await subscription.unsubscribe();
    throw new Error("Browser did not provide a usable push subscription");
  }
  try {
    await registerPushSubscription({
      data: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
    });
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
}

export async function disableBrowserPush(removeFromAccount: boolean) {
  if (!canUseWebPush()) return;
  const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    if (removeFromAccount) await removePushSubscription({ data: { endpoint: subscription.endpoint } });
  } finally {
    await subscription.unsubscribe();
  }
}
