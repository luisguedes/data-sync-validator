import { useState, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell,
  Clock,
  Mail,
  AlertTriangle,
  Loader2,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Conference } from '@/types';
import { useEmailService } from '@/hooks/useEmailService';

interface ReminderSettingsProps {
  conferences: Conference[];
  onSendReminder: (conferenceId: string) => Promise<void>;
}

interface ReminderConfig {
  enabled: boolean;
  daysThreshold: number;
  autoSend: boolean;
}

const STORAGE_KEY = 'app_reminder_settings';

export function ReminderSettings({ conferences, onSendReminder }: ReminderSettingsProps) {
  const { isEmailEnabled } = useEmailService();
  const [config, setConfig] = useState<ReminderConfig>({
    enabled: true,
    daysThreshold: 3,
    autoSend: false,
  });
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setConfig(JSON.parse(stored));
    }
  }, []);

  // Save settings to localStorage
  const saveConfig = (newConfig: ReminderConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    setConfig(newConfig);
    toast.success('Configurações de lembrete salvas!');
  };

  // Get pending conferences older than threshold
  const pendingConferences = conferences.filter(c => {
    if (c.status !== 'pending') return false;
    const daysSinceCreation = differenceInDays(new Date(), new Date(c.createdAt));
    return daysSinceCreation >= config.daysThreshold;
  });

  // Handle send reminder
  const handleSendReminder = async (conferenceId: string) => {
    if (!isEmailEnabled()) {
      toast.error('Notificações por email estão desativadas');
      return;
    }

    setSendingReminder(conferenceId);
    try {
      await onSendReminder(conferenceId);
      toast.success('Lembrete enviado com sucesso!');
    } catch {
      toast.error('Erro ao enviar lembrete');
    } finally {
      setSendingReminder(null);
    }
  };

  // Send all reminders
  const handleSendAllReminders = async () => {
    if (!isEmailEnabled()) {
      toast.error('Notificações por email estão desativadas');
      return;
    }

    for (const conference of pendingConferences) {
      await handleSendReminder(conference.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Configurações de Lembretes
          </CardTitle>
          <CardDescription>
            Configure lembretes automáticos para conferências pendentes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">Ativar Lembretes</Label>
              <p className="text-sm text-muted-foreground">
                Monitorar conferências pendentes e sugerir lembretes
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => saveConfig({ ...config, enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="daysThreshold">Dias até lembrete</Label>
            <div className="flex items-center gap-2">
              <Input
                id="daysThreshold"
                type="number"
                min={1}
                max={30}
                value={config.daysThreshold}
                onChange={(e) => setConfig({ ...config, daysThreshold: parseInt(e.target.value) || 3 })}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                dias após a criação
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Conferências pendentes há mais de {config.daysThreshold} dias aparecerão na lista de lembretes
            </p>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">Envio Automático</Label>
              <p className="text-sm text-muted-foreground">
                Enviar lembretes automaticamente (em breve)
              </p>
            </div>
            <Switch
              checked={config.autoSend}
              onCheckedChange={(checked) => saveConfig({ ...config, autoSend: checked })}
              disabled
            />
          </div>

          <Button onClick={() => saveConfig(config)}>
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      {/* Pending Conferences Card */}
      {config.enabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-status-pending" />
                  Conferências Aguardando Lembrete
                </CardTitle>
                <CardDescription>
                  Conferências pendentes há mais de {config.daysThreshold} dias
                </CardDescription>
              </div>
              {pendingConferences.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handleSendAllReminders}
                  disabled={!isEmailEnabled()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Todos
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pendingConferences.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <Bell className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p>Nenhuma conferência precisa de lembrete</p>
                  <p className="text-sm mt-1">
                    Todas as conferências estão dentro do prazo de {config.daysThreshold} dias
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingConferences.map((conference) => {
                  const daysPending = differenceInDays(new Date(), new Date(conference.createdAt));
                  const lastReminder = conference.emailHistory?.filter(e => e.type === 'reminder').pop();
                  
                  return (
                    <div 
                      key={conference.id} 
                      className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{conference.name}</h4>
                          <Badge variant="outline" className="text-status-pending border-status-pending">
                            {daysPending} dias
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conference.clientName} - {conference.clientEmail}
                        </p>
                        {lastReminder && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Último lembrete: {format(new Date(lastReminder.sentAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendReminder(conference.id)}
                        disabled={sendingReminder === conference.id || !isEmailEnabled()}
                      >
                        {sendingReminder === conference.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        <span className="ml-2">Enviar</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {!isEmailEnabled() && pendingConferences.length > 0 && (
              <div className="flex items-center gap-2 mt-4 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">
                  Notificações por email estão desativadas. Ative nas configurações para enviar lembretes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
