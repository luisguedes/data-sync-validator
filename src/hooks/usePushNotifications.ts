import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthHeaders } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';

interface SecurityAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
}

interface UsePushNotificationsOptions {
  backendUrl: string;
  enabled: boolean;
  pollingInterval?: number; // in ms
  onNewAlert?: (alert: SecurityAlert) => void;
}

export function usePushNotifications({
  backendUrl,
  enabled,
  pollingInterval = 15000,
  onNewAlert,
}: UsePushNotificationsOptions) {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isPolling, setIsPolling] = useState(false);
  const lastCheckRef = useRef<string>(new Date().toISOString());
  const seenAlertsRef = useRef<Set<string>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if notifications are supported
  useEffect(() => {
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  // Show browser notification
  const showNotification = useCallback((alert: SecurityAlert) => {
    if (permission !== 'granted') return;
    
    const severityEmoji = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🚨',
      critical: '🔴',
    };
    
    const severityLabels = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      critical: 'CRÍTICA',
    };
    
    try {
      const notification = new Notification(
        `${severityEmoji[alert.severity]} Alerta ${severityLabels[alert.severity]}`,
        {
          body: `${alert.title}\n${alert.description}`,
          icon: '/favicon.ico',
          tag: alert.id, // Prevents duplicate notifications
          requireInteraction: alert.severity === 'critical' || alert.severity === 'high',
          silent: false,
        }
      );
      
      notification.onclick = () => {
        window.focus();
        notification.close();
        // Navigate to alerts if possible
        if (window.location.pathname !== '/settings') {
          window.location.href = '/settings';
        }
      };
      
      // Auto-close after 10 seconds for non-critical alerts
      if (alert.severity !== 'critical') {
        setTimeout(() => notification.close(), 10000);
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [permission]);

  // Fetch new alerts
  const checkForNewAlerts = useCallback(async () => {
    if (!backendUrl || !enabled || !user || user.role !== 'admin') return;
    
    try {
      const response = await fetch(
        `${backendUrl}/api/alerts/new?lastCheck=${encodeURIComponent(lastCheckRef.current)}`,
        { headers: getAuthHeaders() }
      );
      
      if (response.ok) {
        const data = await response.json();
        lastCheckRef.current = data.serverTime;
        
        // Process new alerts
        for (const alert of data.alerts || []) {
          if (!seenAlertsRef.current.has(alert.id)) {
            seenAlertsRef.current.add(alert.id);
            showNotification(alert);
            onNewAlert?.(alert);
          }
        }
        
        // Keep seen alerts set from growing too large
        if (seenAlertsRef.current.size > 1000) {
          const arr = Array.from(seenAlertsRef.current);
          seenAlertsRef.current = new Set(arr.slice(-500));
        }
      }
    } catch (error) {
      console.error('Error checking for new alerts:', error);
    }
  }, [backendUrl, enabled, user, showNotification, onNewAlert]);

  // Start/stop polling
  useEffect(() => {
    if (enabled && permission === 'granted' && user?.role === 'admin' && backendUrl) {
      setIsPolling(true);
      lastCheckRef.current = new Date().toISOString();
      
      // Initial check
      checkForNewAlerts();
      
      // Start polling
      pollingIntervalRef.current = setInterval(checkForNewAlerts, pollingInterval);
      
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsPolling(false);
      };
    }
  }, [enabled, permission, user?.role, backendUrl, pollingInterval, checkForNewAlerts]);

  // Register subscription with backend
  const registerSubscription = useCallback(async () => {
    if (!backendUrl) return;
    
    try {
      await fetch(`${backendUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: { endpoint: 'browser-notification' },
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.error('Error registering subscription:', error);
    }
  }, [backendUrl]);

  // Test notification
  const testNotification = useCallback(() => {
    if (permission !== 'granted') {
      return false;
    }
    
    showNotification({
      id: 'test-' + Date.now(),
      type: 'test',
      severity: 'medium',
      title: 'Notificação de Teste',
      description: 'As notificações push estão funcionando corretamente!',
      timestamp: new Date().toISOString(),
    });
    
    return true;
  }, [permission, showNotification]);

  return {
    isSupported,
    permission,
    isPolling,
    requestPermission,
    testNotification,
    registerSubscription,
  };
}
