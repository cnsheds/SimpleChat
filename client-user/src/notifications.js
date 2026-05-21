export function canUseNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!canUseNotifications()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!canUseNotifications()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function messagePreview(message) {
  if (message?.msg_type === 'image') return '[图片]';
  return message?.content || '收到新消息';
}

export function showIncomingNotification(title, options = {}) {
  if (!canUseNotifications() || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  try {
    const notification = new Notification(title, options);
    notification.onclick = () => window.focus();
  } catch {
    // Some browsers expose Notification but still reject construction.
  }
}
