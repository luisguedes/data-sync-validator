import type { SmtpConfig } from '@/types';

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

interface BackendSettings {
  url: string;
  apiKey?: string;
}

// Get backend configuration from localStorage
const getBackendSettings = (): BackendSettings => {
  const settings = localStorage.getItem('app_settings');
  if (settings) {
    const parsed = JSON.parse(settings);
    return {
      url: parsed.preferences?.backendUrl || 'http://localhost:3001',
      apiKey: parsed.preferences?.backendApiKey || '',
    };
  }
  return {
    url: 'http://localhost:3001',
    apiKey: '',
  };
};

/**
 * Envia email através do backend local
 * O backend deve expor POST /api/send-email
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const { url: backendUrl, apiKey } = getBackendSettings();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add API key if configured
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  
  try {
    const response = await fetch(`${backendUrl}/api/send-email`, {
      method: 'POST',
      headers,
      body: JSON.stringify(options),
    });

    if (response.status === 401) {
      return {
        success: false,
        message: 'API key não fornecida. Configure a chave nas configurações.',
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        message: 'API key inválida. Verifique a chave nas configurações.',
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
  const { url: backendUrl, apiKey } = getBackendSettings();
  
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  try {
    const response = await fetch(`${backendUrl}/api/test-smtp`, {
      method: 'GET',
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'Falha na autenticação. Verifique a API key.',
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
  authEnabled: boolean;
  smtp: string;
  uptime: number;
} | null> {
  const { url: backendUrl } = getBackendSettings();

  try {
    const response = await fetch(`${backendUrl}/api/health`);
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
