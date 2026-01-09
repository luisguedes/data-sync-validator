import { createContext, useContext, ReactNode } from 'react';
import { useNotificationCenter, Notification } from '@/hooks/useNotificationCenter';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  soundEnabled: boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Notification;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  toggleSound: () => void;
  playSound: (type: Notification['type']) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notificationCenter = useNotificationCenter();

  return (
    <NotificationContext.Provider value={notificationCenter}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
