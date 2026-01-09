import { useState, useEffect } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useEmailService } from '@/hooks/useEmailService';
import { useConferences } from '@/hooks/useConferences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Settings as SettingsIcon, 
  Database, 
  Mail, 
  Server,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Bell,
} from 'lucide-react';
import type { AppPreferences } from '@/types';
import { ReminderSettings } from '@/components/settings/ReminderSettings';

export default function Settings() {
  const { settings, updatePreferences, updateSmtpConfig, updateDatabaseConfig } = useAppSettings();
  const { testBackendConnection, testSmtpConnection, sendNewLinkNotification } = useEmailService();
  const { allConferences, addEmailToHistory, getConference } = useConferences();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [smtpStatus, setSmtpStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  const [preferences, setPreferences] = useState<AppPreferences>({
    companyName: settings.preferences?.companyName || '',
    theme: settings.preferences?.theme || 'system',
    timezone: settings.preferences?.timezone || 'America/Sao_Paulo',
    backendUrl: settings.preferences?.backendUrl || 'http://localhost:3001',
    emailNotifications: settings.preferences?.emailNotifications ?? true,
  });

  useEffect(() => {
    if (settings.preferences) {
      setPreferences({
        companyName: settings.preferences.companyName || '',
        theme: settings.preferences.theme || 'system',
        timezone: settings.preferences.timezone || 'America/Sao_Paulo',
        backendUrl: settings.preferences.backendUrl || 'http://localhost:3001',
        emailNotifications: settings.preferences.emailNotifications ?? true,
      });
    }
  }, [settings.preferences]);

  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      await updatePreferences(preferences);
      toast.success('Preferências salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar preferências');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestBackend = async () => {
    setIsTesting(true);
    const result = await testBackendConnection();
    if (result.success) {
      setBackendStatus('connected');
      toast.success(result.message);
    } else {
      setBackendStatus('error');
      toast.error(result.message);
    }
    setIsTesting(false);
  };

  const handleTestSmtp = async () => {
    setIsTesting(true);
    const result = await testSmtpConnection();
    if (result.success) {
      setSmtpStatus('connected');
      toast.success(result.message);
    } else {
      setSmtpStatus('error');
      toast.error(result.message);
    }
    setIsTesting(false);
  };

  const getStatusIcon = (status: 'unknown' | 'connected' | 'error') => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const handleSendReminder = async (conferenceId: string) => {
    const conference = getConference(conferenceId);
    if (!conference) return;

    const result = await sendNewLinkNotification(conference);
    
    addEmailToHistory(conferenceId, {
      type: 'reminder',
      to: conference.clientEmail,
      subject: `Lembrete: ${conference.name}`,
      status: result.success ? 'sent' : 'failed',
      sentAt: new Date(),
      error: result.success ? undefined : result.message,
    });

    if (!result.success) {
      throw new Error(result.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Configurações
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie as configurações do sistema
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="backend">Backend Local</TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Lembretes
          </TabsTrigger>
          <TabsTrigger value="database">Banco de Dados</TabsTrigger>
          <TabsTrigger value="smtp">Email (SMTP)</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Preferências Gerais</CardTitle>
              <CardDescription>Configurações gerais da aplicação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nome da Empresa</Label>
                <Input
                  id="company-name"
                  value={preferences.companyName}
                  onChange={(e) => setPreferences({ ...preferences, companyName: e.target.value })}
                  placeholder="Minha Empresa"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Tema</Label>
                  <select
                    id="theme"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={preferences.theme}
                    onChange={(e) => setPreferences({ ...preferences, theme: e.target.value as 'light' | 'dark' | 'system' })}
                  >
                    <option value="system">Sistema</option>
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuso Horário</Label>
                  <select
                    id="timezone"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={preferences.timezone}
                    onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                  >
                    <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                    <option value="America/Manaus">Manaus (GMT-4)</option>
                    <option value="America/Bahia">Bahia (GMT-3)</option>
                    <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                  </select>
                </div>
              </div>

              <Button onClick={handleSavePreferences} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Preferências
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backend">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Backend Local
              </CardTitle>
              <CardDescription>
                Configure o servidor Node.js local para envio de emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backend-url">URL do Backend</Label>
                <div className="flex gap-2">
                  <Input
                    id="backend-url"
                    value={preferences.backendUrl || ''}
                    onChange={(e) => setPreferences({ ...preferences, backendUrl: e.target.value })}
                    placeholder="http://localhost:3001"
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={handleTestBackend} disabled={isTesting}>
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  {getStatusIcon(backendStatus)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Endpoint do servidor que processa os envios de email
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base">Notificações por Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Enviar email automaticamente ao criar conferências
                  </p>
                </div>
                <Switch
                  checked={preferences.emailNotifications ?? true}
                  onCheckedChange={(checked) => setPreferences({ ...preferences, emailNotifications: checked })}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSavePreferences} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Configurações
                </Button>
                <Button variant="outline" onClick={handleTestSmtp} disabled={isTesting}>
                  {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Testar SMTP
                  {getStatusIcon(smtpStatus)}
                </Button>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Como configurar o backend?</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Consulte a documentação em <code className="bg-muted px-1 rounded">docs/backend-setup.md</code> para instruções completas de como configurar o servidor Node.js na sua VPS.
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Instale Node.js, Express e Nodemailer</li>
                  <li>Configure as variáveis de ambiente SMTP</li>
                  <li>Inicie o servidor na porta configurada</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders">
          <ReminderSettings 
            conferences={allConferences}
            onSendReminder={handleSendReminder}
          />
        </TabsContent>

        <TabsContent value="database">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Banco de Dados
              </CardTitle>
              <CardDescription>
                Configurações de conexão com PostgreSQL
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-muted-foreground">
                  A configuração do banco de dados foi definida durante a instalação inicial.
                  Para alterar, execute o assistente de configuração novamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Servidor SMTP
              </CardTitle>
              <CardDescription>
                Configurações do servidor de email (configurado no backend)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground mb-2">
                  As configurações SMTP são gerenciadas no arquivo <code className="bg-muted px-1 rounded">.env</code> do seu backend local.
                </p>
                <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
{`SMTP_HOST=localhost
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_usuario
SMTP_PASS=sua_senha
SMTP_FROM=noreply@seudominio.com
SMTP_FROM_NAME=Sistema de Migração`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
