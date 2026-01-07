/**
 * Utility functions for managing notifications
 */

export interface Notification {
  id: number;
  type: 'campaign' | 'performance' | 'team' | 'post_scraped' | 'top_performer' | 'bulk_scraped';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

/**
 * Format timestamp to relative time
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes} min ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * Add a new notification
 */
export function addNotification(notification: Omit<Notification, 'id' | 'time' | 'read'>): void {
  if (typeof window === 'undefined') return;

  try {
    // Get existing notifications
    const saved = localStorage.getItem('dttracker-notifications');
    const existing: Notification[] = saved ? JSON.parse(saved) : [];

    // Create new notification
    const newNotification: Notification = {
      id: Date.now(),
      ...notification,
      time: 'Just now',
      read: false,
    };

    // Add to beginning of array
    const updated = [newNotification, ...existing];

    // Save to localStorage
    localStorage.setItem('dttracker-notifications', JSON.stringify(updated));

    // Dispatch event to update UI
    window.dispatchEvent(new Event('notifications-updated'));
  } catch (error) {
    console.error('Failed to add notification:', error);
  }
}






