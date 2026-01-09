import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Bell,
  BellRing,
  Mail,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  X,
  TestTube,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getAuthHeaders } from '@/services/authService';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface AlertNotificationSettingsProps {
  backendUrl: string;
}

interface NotificationSettings {
  emailEnabled: boolean;
  emailRecipients: string[];
  pushEnabled: boolean;
  minSeverityForEmail: string;
  minSeverityForPush: string;
}

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Baixa (todos os alertas)' },
  { value: 'medium', label: 'Média ou superior' },
  { value: 'high', label: 'Alta ou superior' },
  { value: 'critical', label: 'Apenas críticos' },
];

export function AlertNotificationSettings({ backendUrl }: AlertNotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    emailRecipients: [],
    pushEnabled: true,
    minSeverityForEmail: 'high',
    minSeverityForPush: 'medium',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [newEmail, setNewEmail] = useState('');

  const {
    isSupported: pushSupported,
    permission: pushPermission,
    isPolling,
    requestPermission,
    testNotification,
  } = usePushNotifications({
    backendUrl,
    enabled: settings.pushEnabled,
    pollingInterval: 15000,
    onNewAlert: (alert) => {
      // This is handled by the hook itself
    },
  });

  const fetchSettings = useCallback(async () => {
    if (!backendUrl) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/alerts/settings`, {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        setSubscriptionCount(data.subscriptionCount || 0);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (newSettings: Partial<NotificationSettings>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`${backendUrl}/api/alerts/settings`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success('Configurações salvas');
      } else {
        toast.error('Erro ao salvar configurações');
      }
    } catch (error) {
      toast.error('Erro ao conectar com o backend');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEmail = (enabled: boolean) => {
    const updated = { ...settings, emailEnabled: enabled };
    setSettings(updated);
    saveSettings({ emailEnabled: enabled });
  };

  const handleTogglePush = (enabled: boolean) => {
    const updated = { ...settings, pushEnabled: enabled };
    setSettings(updated);
    saveSettings({ pushEnabled: enabled });
  };

  const handleEmailSeverityChange = (value: string) => {
    const updated = { ...settings, minSeverityForEmail: value };
    setSettings(updated);
    saveSettings({ minSeverityForEmail: value });
  };

  const handlePushSeverityChange = (value: string) => {
    const updated = { ...settings, minSeverityForPush: value };
    setSettings(updated);
    saveSettings({ minSeverityForPush: value });
  };

  const handleAddEmail = () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Email inválido');
      return;
    }
    if (settings.emailRecipients.includes(newEmail)) {
      toast.error('Email já adicionado');
      return;
    }
    const updated = [...settings.emailRecipients, newEmail];
    setSettings({ ...settings, emailRecipients: updated });
    saveSettings({ emailRecipients: updated });
    setNewEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    const updated = settings.emailRecipients.filter(e => e !== email);
    setSettings({ ...settings, emailRecipients: updated });
    saveSettings({ emailRecipients: updated });
  };

  const handleRequestPushPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success('Notificações push ativadas!');
    } else {
      toast.error('Permissão de notificação negada');
    }
  };

  const handleTestPush = () => {
    if (testNotification()) {
      toast.success('Notificação de teste enviada');
    } else {
      toast.error('Permita notificações primeiro');
    }
  };

  if (!backendUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Configurações de Notificação
          </CardTitle>
          <CardDescription>Configure a URL do backend primeiro</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notificações por Email
          </CardTitle>
          <CardDescription>
            Envie alertas críticos por email para administradores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar notificações por email</Label>
              <p className="text-sm text-muted-foreground">
                Enviar emails quando alertas forem detectados
              </p>
            </div>
            <Switch
              checked={settings.emailEnabled}
              onCheckedChange={handleToggleEmail}
              disabled={isSaving}
            />
          </div>

          {settings.emailEnabled && (
            <>
              <div className="space-y-2">
                <Label>Severidade mínima para email</Label>
                <Select
                  value={settings.minSeverityForEmail}
                  onValueChange={handleEmailSeverityChange}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Emails adicionais (além dos admins)</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                  />
                  <Button onClick={handleAddEmail} variant="outline" disabled={isSaving}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {settings.emailRecipients.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1">
                      {email}
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Todos os administradores ativos receberão emails automaticamente
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações Push do Navegador
          </CardTitle>
          <CardDescription>
            Receba alertas em tempo real mesmo quando a aba não está em foco
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushSupported ? (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span>Seu navegador não suporta notificações push</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ativar notificações push</Label>
                  <p className="text-sm text-muted-foreground">
                    Receber alertas no navegador
                  </p>
                </div>
                <Switch
                  checked={settings.pushEnabled}
                  onCheckedChange={handleTogglePush}
                  disabled={isSaving}
                />
              </div>

              {settings.pushEnabled && (
                <>
                  {/* Permission Status */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    {pushPermission === 'granted' ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div className="flex-1">
                          <p className="font-medium text-green-600">Notificações permitidas</p>
                          <p className="text-sm text-muted-foreground">
                            {isPolling ? 'Verificando alertas...' : 'Aguardando ativação'}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleTestPush}>
                          <TestTube className="h-4 w-4 mr-2" />
                          Testar
                        </Button>
                      </>
                    ) : pushPermission === 'denied' ? (
                      <>
                        <XCircle className="h-5 w-5 text-destructive" />
                        <div className="flex-1">
                          <p className="font-medium text-destructive">Notificações bloqueadas</p>
                          <p className="text-sm text-muted-foreground">
                            Permita notificações nas configurações do navegador
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <VolumeX className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">Permissão necessária</p>
                          <p className="text-sm text-muted-foreground">
                            Clique para permitir notificações
                          </p>
                        </div>
                        <Button onClick={handleRequestPushPermission}>
                          <Volume2 className="h-4 w-4 mr-2" />
                          Permitir
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Severidade mínima para push</Label>
                    <Select
                      value={settings.minSeverityForPush}
                      onValueChange={handlePushSeverityChange}
                      disabled={isSaving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {subscriptionCount} dispositivo(s) inscrito(s) para notificações
                  </p>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">Como funciona</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Email:</strong> Enviado imediatamente quando um alerta é criado (configure SMTP no backend)</li>
            <li>• <strong>Push:</strong> Notificação do navegador aparece mesmo quando a aba não está visível</li>
            <li>• Alertas são detectados automaticamente baseados em padrões de segurança</li>
            <li>• Administradores podem reconhecer alertas para removê-los da fila</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
