import type { SmtpConfig } from '@/types';
import { getAuthHeaders, getToken } from './authService';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  message: string;
  messageId?: string;
}

// Get backend configuration from localStorage
// In production with nginx proxy, use relative URL (empty string)
// In development, use localhost:3001
const getBackendUrl = (): string => {
  // First check if we have a stored backend URL
  const storedUrl = localStorage.getItem('backend_url');
  if (storedUrl) {
    return storedUrl;
  }
  
  const settings = localStorage.getItem('app_settings');
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      if (parsed.preferences?.backendUrl) {
        return parsed.preferences.backendUrl;
      }
    } catch {
      // ignore parse errors
    }
  }
  
  // Auto-detect: if running on same origin (production with nginx), use relative URLs
  // This works because nginx proxies /api/* to the backend
  const isProduction = window.location.hostname !== 'localhost' && 
                       !window.location.hostname.includes('127.0.0.1');
  
  return isProduction ? '' : 'http://localhost:3001';
};

/**
 * Envia email através do backend local
 * Usa JWT token para autenticação (mais seguro que API key no frontend)
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const backendUrl = getBackendUrl();
  
  try {
    const response = await fetch(`${backendUrl}/api/send-email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(options),
    });

    if (response.status === 401) {
      return {
        success: false,
        message: 'Sessão expirada. Faça login novamente.',
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        message: 'Sem permissão para enviar emails.',
      };
    }

    if (response.status === 429) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Limite de requisições excedido. Tente novamente em ${error.retryAfter || 60} segundos.`,
      };
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      return {
        success: false,
        message: error.message || `Erro HTTP: ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: 'Email enviado com sucesso!',
      messageId: result.messageId,
    };
  } catch (error) {
    // Se o backend não estiver disponível, simula o envio (modo desenvolvimento)
    console.warn('Backend não disponível, simulando envio de email:', options);
    return {
      success: true,
      message: 'Email simulado (backend não configurado)',
    };
  }
}

/**
 * Testa a conexão com o backend e SMTP
 */
export async function testBackendConnection(): Promise<EmailResult> {
  const backendUrl = getBackendUrl();
  
  try {
    const response = await fetch(`${backendUrl}/api/test-smtp`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'Sessão expirada ou sem permissão.',
      };
    }

    const result = await response.json();
    return {
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Backend não disponível',
    };
  }
}

/**
 * Obtém informações de saúde do backend
 */
export async function getBackendHealth(): Promise<{
  status: string;
  authMethods?: string[];
  usersCount?: number;
  smtp?: string;
  uptime?: number;
} | null> {
  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/api/health`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Obtém informações detalhadas do backend (requer auth)
 */
export async function getBackendHealthDetailed(): Promise<{
  status: string;
  authMethod: string;
  yourPermission: string;
  checks: Record<string, unknown>;
  stats: Record<string, unknown>;
} | null> {
  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/api/health/detailed`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Gera o HTML do email de notificação de conferência
 */
export function generateConferenceEmailHtml(params: {
  clientName: string;
  conferenceName: string;
  accessLink: string;
  expiresAt?: string;
}): string {
  const { clientName, conferenceName, accessLink, expiresAt } = params;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acesso à Conferência de Migração</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #18181b;">
                Conferência de Migração
              </h1>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Olá <strong>${clientName}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Você foi convidado(a) para acompanhar a conferência de migração: <strong>${conferenceName}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px;">
              <a href="${accessLink}" 
                 style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 6px;">
                Acessar Conferência
              </a>
            </td>
          </tr>
          ${expiresAt ? `
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="margin: 0; font-size: 14px; color: #71717a;">
                ⏱️ Este link expira em: <strong>${expiresAt}</strong>
              </p>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 20px 40px; background-color: #fafafa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                Se você não solicitou este acesso, ignore este email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Gera o texto plano do email
 */
export function generateConferenceEmailText(params: {
  clientName: string;
  conferenceName: string;
  accessLink: string;
  expiresAt?: string;
}): string {
  const { clientName, conferenceName, accessLink, expiresAt } = params;
  
  let text = `Olá ${clientName},

Você foi convidado(a) para acompanhar a conferência de migração: ${conferenceName}

Acesse através do link: ${accessLink}`;

  if (expiresAt) {
    text += `

⏱️ Este link expira em: ${expiresAt}`;
  }

  text += `

Se você não solicitou este acesso, ignore este email.`;

  return text;
}
