import { useCallback } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { 
  sendEmail, 
  generateConferenceEmailHtml, 
  generateConferenceEmailText,
  type EmailResult 
} from '@/services/emailService';
import type { Conference } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function useEmailService() {
  const { settings } = useAppSettings();

  const isEmailEnabled = useCallback(() => {
    return settings.preferences?.emailNotifications ?? false;
  }, [settings.preferences?.emailNotifications]);

  const getBackendUrl = useCallback(() => {
    return settings.preferences?.backendUrl || 'http://localhost:3001';
  }, [settings.preferences?.backendUrl]);

  const sendConferenceNotification = useCallback(async (
    conference: Conference
  ): Promise<EmailResult> => {
    if (!isEmailEnabled()) {
      return {
        success: false,
        message: 'Notificações por email estão desativadas',
      };
    }

    const baseUrl = window.location.origin;
    const accessLink = `${baseUrl}/conferencia/${conference.linkToken}`;
    const expiresAt = format(
      new Date(conference.linkExpiresAt), 
      "dd 'de' MMMM 'de' yyyy 'às' HH:mm", 
      { locale: ptBR }
    );

    const html = generateConferenceEmailHtml({
      clientName: conference.clientName,
      conferenceName: conference.name,
      accessLink,
      expiresAt,
    });

    const text = generateConferenceEmailText({
      clientName: conference.clientName,
      conferenceName: conference.name,
      accessLink,
      expiresAt,
    });

    return sendEmail({
      to: conference.clientEmail,
      subject: `Acesso à Conferência: ${conference.name}`,
      html,
      text,
    });
  }, [isEmailEnabled]);

  const sendNewLinkNotification = useCallback(async (
    conference: Conference
  ): Promise<EmailResult> => {
    if (!isEmailEnabled()) {
      return {
        success: false,
        message: 'Notificações por email estão desativadas',
      };
    }

    const baseUrl = window.location.origin;
    const accessLink = `${baseUrl}/conferencia/${conference.linkToken}`;
    const expiresAt = format(
      new Date(conference.linkExpiresAt), 
      "dd 'de' MMMM 'de' yyyy 'às' HH:mm", 
      { locale: ptBR }
    );

    const html = generateConferenceEmailHtml({
      clientName: conference.clientName,
      conferenceName: conference.name,
      accessLink,
      expiresAt,
    });

    const text = generateConferenceEmailText({
      clientName: conference.clientName,
      conferenceName: conference.name,
      accessLink,
      expiresAt,
    });

    return sendEmail({
      to: conference.clientEmail,
      subject: `Novo Link de Acesso: ${conference.name}`,
      html,
      text,
    });
  }, [isEmailEnabled]);

  const testBackendConnection = useCallback(async (): Promise<EmailResult> => {
    const backendUrl = getBackendUrl();
    
    try {
      const response = await fetch(`${backendUrl}/api/health`);
      if (response.ok) {
        return { success: true, message: 'Backend conectado!' };
      }
      return { success: false, message: 'Backend não respondeu corretamente' };
    } catch {
      return { success: false, message: 'Não foi possível conectar ao backend' };
    }
  }, [getBackendUrl]);

  const testSmtpConnection = useCallback(async (): Promise<EmailResult> => {
    const backendUrl = getBackendUrl();
    
    try {
      const response = await fetch(`${backendUrl}/api/test-smtp`);
      const result = await response.json();
      return result;
    } catch {
      return { success: false, message: 'Não foi possível testar conexão SMTP' };
    }
  }, [getBackendUrl]);

  return {
    isEmailEnabled,
    getBackendUrl,
    sendConferenceNotification,
    sendNewLinkNotification,
    testBackendConnection,
    testSmtpConnection,
  };
}
