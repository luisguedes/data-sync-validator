import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Conference } from '@/types';

interface NotificationConfig {
  checkInterval: number; // in minutes
  expirationWarningHours: number; // hours before expiration to warn
}

const DEFAULT_CONFIG: NotificationConfig = {
  checkInterval: 5, // check every 5 minutes
  expirationWarningHours: 24, // warn 24 hours before expiration
};

export function useNotifications(conferences: Conference[], config = DEFAULT_CONFIG) {
  const notifiedExpirationsRef = useRef<Set<string>>(new Set());
  const notifiedFailuresRef = useRef<Set<string>>(new Set());

  const checkExpiringConferences = useCallback(() => {
    const now = new Date();
    const warningThreshold = config.expirationWarningHours * 60 * 60 * 1000;

    conferences.forEach((conference) => {
      // Skip completed conferences
      if (conference.status === 'completed') return;
      
      const expiresAt = new Date(conference.linkExpiresAt);
      const timeUntilExpiration = expiresAt.getTime() - now.getTime();
      
      // Already expired
      if (timeUntilExpiration <= 0 && !notifiedExpirationsRef.current.has(`expired-${conference.id}`)) {
        notifiedExpirationsRef.current.add(`expired-${conference.id}`);
        toast.error(`Conferência Expirada`, {
          description: `"${conference.name}" para ${conference.clientName} expirou.`,
          duration: 10000,
          action: {
            label: 'Ver',
            onClick: () => window.location.href = '/conferences',
          },
        });
      }
      // About to expire
      else if (
        timeUntilExpiration > 0 && 
        timeUntilExpiration <= warningThreshold && 
        !notifiedExpirationsRef.current.has(`warning-${conference.id}`)
      ) {
        notifiedExpirationsRef.current.add(`warning-${conference.id}`);
        const hoursLeft = Math.ceil(timeUntilExpiration / (60 * 60 * 1000));
        toast.warning(`Conferência Expirando`, {
          description: `"${conference.name}" expira em ${hoursLeft}h.`,
          duration: 8000,
          action: {
            label: 'Ver',
            onClick: () => window.location.href = '/conferences',
          },
        });
      }
    });
  }, [conferences, config.expirationWarningHours]);

  const checkFailedEmails = useCallback(() => {
    conferences.forEach((conference) => {
      if (!conference.emailHistory) return;
      
      conference.emailHistory.forEach((email) => {
        const failureKey = `${conference.id}-${email.sentAt}`;
        
        if (email.status === 'failed' && !notifiedFailuresRef.current.has(failureKey)) {
          // Only notify for recent failures (last 5 minutes)
          const emailTime = new Date(email.sentAt).getTime();
          const now = Date.now();
          const fiveMinutesAgo = now - (5 * 60 * 1000);
          
          if (emailTime >= fiveMinutesAgo) {
            notifiedFailuresRef.current.add(failureKey);
            toast.error(`Falha no Envio de Email`, {
              description: `Email para ${conference.clientEmail} falhou.`,
              duration: 10000,
              action: {
                label: 'Detalhes',
                onClick: () => window.location.href = '/conferences',
              },
            });
          } else {
            // Mark old failures as notified to avoid showing on next check
            notifiedFailuresRef.current.add(failureKey);
          }
        }
      });
    });
  }, [conferences]);

  const checkPendingReminders = useCallback(() => {
    const storedSettings = localStorage.getItem('reminderSettings');
    if (!storedSettings) return;

    const settings = JSON.parse(storedSettings);
    if (!settings.enabled) return;

    const now = new Date();
    const thresholdDate = new Date(now.getTime() - (settings.daysThreshold * 24 * 60 * 60 * 1000));

    const pendingConferences = conferences.filter((conf) => {
      if (conf.status !== 'pending') return false;
      const createdAt = new Date(conf.createdAt);
      return createdAt < thresholdDate;
    });

    if (pendingConferences.length > 0) {
      const notificationKey = `pending-reminder-${now.toDateString()}`;
      if (!notifiedExpirationsRef.current.has(notificationKey)) {
        notifiedExpirationsRef.current.add(notificationKey);
        toast.info(`${pendingConferences.length} conferência(s) pendente(s)`, {
          description: `Há conferências aguardando há mais de ${settings.daysThreshold} dias.`,
          duration: 8000,
          action: {
            label: 'Ver',
            onClick: () => window.location.href = '/settings',
          },
        });
      }
    }
  }, [conferences]);

  // Run checks on mount and at intervals
  useEffect(() => {
    // Initial check
    checkExpiringConferences();
    checkFailedEmails();
    checkPendingReminders();

    // Set up interval
    const intervalId = setInterval(() => {
      checkExpiringConferences();
      checkFailedEmails();
      checkPendingReminders();
    }, config.checkInterval * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [checkExpiringConferences, checkFailedEmails, checkPendingReminders, config.checkInterval]);

  // Also check when conferences change
  useEffect(() => {
    checkFailedEmails();
  }, [conferences, checkFailedEmails]);

  return {
    checkExpiringConferences,
    checkFailedEmails,
    checkPendingReminders,
  };
}
