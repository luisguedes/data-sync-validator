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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Bell,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  Shield,
  Trash2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Key,
  Activity,
} from 'lucide-react';
import { getAuthHeaders } from '@/services/authService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SecurityAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  details: Record<string, unknown>;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

interface SecurityAlertsProps {
  backendUrl: string;
}

const SEVERITY_CONFIG = {
  low: { 
    icon: Info, 
    color: 'bg-blue-500', 
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Baixa' 
  },
  medium: { 
    icon: AlertTriangle, 
    color: 'bg-yellow-500', 
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    label: 'Média' 
  },
  high: { 
    icon: AlertOctagon, 
    color: 'bg-orange-500', 
    textColor: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    borderColor: 'border-orange-200 dark:border-orange-800',
    label: 'Alta' 
  },
  critical: { 
    icon: Shield, 
    color: 'bg-red-500', 
    textColor: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Crítica' 
  },
};

const TYPE_LABELS: Record<string, string> = {
  'brute_force': 'Força Bruta',
  'multiple_failed_logins': 'Falhas de Login',
  'admin_action': 'Ação Admin',
  'user_deleted': 'Usuário Deletado',
  'apikey_deleted': 'API Key Deletada',
  'mass_deletion': 'Deleção em Massa',
  'unusual_activity': 'Atividade Incomum',
  'new_admin': 'Novo Admin',
};

export function SecurityAlerts({ backendUrl }: SecurityAlertsProps) {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, hasMore: false });
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  
  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<string>('false');

  const fetchAlerts = useCallback(async (resetOffset = false) => {
    if (!backendUrl) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(pagination.limit));
      params.set('offset', String(resetOffset ? 0 : pagination.offset));
      
      if (severityFilter && severityFilter !== 'all') params.set('severity', severityFilter);
      if (acknowledgedFilter && acknowledgedFilter !== 'all') params.set('acknowledged', acknowledgedFilter);
      
      const response = await fetch(`${backendUrl}/api/alerts?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
        setUnacknowledgedCount(data.unacknowledgedCount || 0);
        setPagination(prev => ({
          ...prev,
          ...data.pagination,
          offset: resetOffset ? 0 : prev.offset,
        }));
      } else if (response.status === 403) {
        toast.error('Sem permissão para visualizar alertas');
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Erro ao carregar alertas');
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, pagination.limit, pagination.offset, severityFilter, acknowledgedFilter]);

  useEffect(() => {
    fetchAlerts(true);
  }, [severityFilter, acknowledgedFilter]);

  useEffect(() => {
    // Initial fetch
    fetchAlerts(true);
    
    // Poll for new alerts every 30 seconds
    const interval = setInterval(() => {
      fetchAlerts(pagination.offset === 0);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/alerts/${alertId}/acknowledge`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        toast.success('Alerta reconhecido');
        fetchAlerts();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Erro ao reconhecer alerta');
      }
    } catch (error) {
      toast.error('Erro ao conectar com o backend');
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/alerts/acknowledge-all`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchAlerts(true);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Erro ao reconhecer alertas');
      }
    } catch (error) {
      toast.error('Erro ao conectar com o backend');
    }
  };

  const handleDeleteOld = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/alerts/old?days=30`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchAlerts(true);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Erro ao limpar alertas');
      }
    } catch (error) {
      toast.error('Erro ao conectar com o backend');
    }
  };

  const handleNextPage = () => {
    setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
  };

  const handlePrevPage = () => {
    setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
  };

  useEffect(() => {
    if (pagination.offset > 0) {
      fetchAlerts();
    }
  }, [pagination.offset]);

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return timestamp;
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMinutes = Math.floor((now - then) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `${diffMinutes}m atrás`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h atrás`;
    return `${Math.floor(diffMinutes / 1440)}d atrás`;
  };

  if (!backendUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas de Segurança
          </CardTitle>
          <CardDescription>Configure a URL do backend primeiro</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Configure a URL do backend na aba "Backend Local" para visualizar alertas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={unacknowledgedCount > 0 ? 'border-orange-500' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{unacknowledgedCount}</p>
              </div>
              <Bell className={`h-8 w-8 ${unacknowledgedCount > 0 ? 'text-orange-500 animate-pulse' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>
        
        {(['critical', 'high', 'medium', 'low'] as const).slice(0, 3).map((severity) => {
          const config = SEVERITY_CONFIG[severity];
          const count = alerts.filter(a => a.severity === severity && !a.acknowledged).length;
          const Icon = config.icon;
          
          return (
            <Card key={severity}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{config.label}</p>
                    <p className={`text-2xl font-bold ${count > 0 ? config.textColor : ''}`}>{count}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${count > 0 ? config.textColor : 'text-muted-foreground'}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Alerts Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Alertas de Segurança
          </CardTitle>
          <CardDescription>
            Monitoramento de atividades suspeitas e ações críticas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Actions and Filters */}
          <div className="flex flex-wrap gap-4 justify-between">
            <div className="flex gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Severidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={acknowledgedFilter} onValueChange={setAcknowledgedFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="false">Pendentes</SelectItem>
                  <SelectItem value="true">Reconhecidos</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => fetchAlerts(true)} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            <div className="flex gap-2">
              {unacknowledgedCount > 0 && (
                <Button variant="outline" onClick={handleAcknowledgeAll}>
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Reconhecer Todos
                </Button>
              )}
              <Button variant="outline" onClick={handleDeleteOld}>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Antigos
              </Button>
            </div>
          </div>

          {/* Alerts List */}
          {isLoading && alerts.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Nenhum alerta encontrado</p>
              <p className="text-muted-foreground">O sistema está funcionando normalmente</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {alerts.map((alert) => {
                  const config = SEVERITY_CONFIG[alert.severity];
                  const Icon = config.icon;
                  
                  return (
                    <div 
                      key={alert.id}
                      className={`p-4 rounded-lg border ${config.borderColor} ${config.bgColor} ${alert.acknowledged ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${config.color}`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{alert.title}</h4>
                              <Badge variant="outline" className={config.textColor}>
                                {config.label}
                              </Badge>
                              <Badge variant="secondary">
                                {TYPE_LABELS[alert.type] || alert.type}
                              </Badge>
                              {alert.acknowledged && (
                                <Badge variant="outline" className="text-green-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Reconhecido
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(alert.timestamp)}
                              </span>
                              <span className="font-medium">{getRelativeTime(alert.timestamp)}</span>
                              {alert.details.ip && (
                                <span>IP: {String(alert.details.ip).replace('::ffff:', '')}</span>
                              )}
                              {alert.acknowledgedBy && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {alert.acknowledgedBy}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {!alert.acknowledged && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleAcknowledge(alert.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {alerts.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} de {pagination.total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={pagination.offset === 0 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!pagination.hasMore || isLoading}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">Tipos de Alertas Monitorados</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li><strong className="text-red-600">Crítico:</strong> Deleção em massa de dados</li>
            <li><strong className="text-orange-600">Alta:</strong> Tentativas de força bruta, usuários deletados, novos admins</li>
            <li><strong className="text-yellow-600">Média:</strong> Múltiplas falhas de login, API keys deletadas</li>
            <li><strong className="text-blue-600">Baixa:</strong> Atividades incomuns, alterações de configuração</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
