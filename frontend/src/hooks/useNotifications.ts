/**
 * Re-export useNotifications hook backed by the global NotificationContext.
 * Ensures a single shared polling loop and avoids duplicate subscriptions.
 */
export { useNotifications } from '../context/NotificationContext';
