import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Users,
  Mail,
  LogIn,
  AlertTriangle,
  AlertOctagon,
  Info,
  Loader2,
  RefreshCw,
  Clock,
  Globe,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { getAuthHeaders } from '@/services/authService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface DashboardData {
  timestamp: string;
  uptime: number;
  alertStats: {
    total: number;
    unacknowledged: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    last24h: number;
    last7d: number;
  };
  loginStats: {
    successful24h: number;
    failed24h: number;
    successful7d: number;
    failed7d: number;
    uniqueIPs24h: number;
  };
  emailStats: {
    sent24h: number;
    failed24h: number;
    sent7d: number;
    failed7d: number;
  };
  userStats: {
    total: number;
    active: number;
    admins: number;
    newLast7d: number;
  };
  activityTimeline: Array<{
    hour: string;
    logins: number;
    failures: number;
    alerts: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    userEmail: string | null;
    timestamp: string;
    success: boolean;
    ip: string;
  }>;
  topFailedIPs: Array<{
    ip: string;
    count: number;
  }>;
  latestAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    timestamp: string;
  }>;
}

interface SecurityDashboardProps {
  backendUrl: string;
}

const ACTION_LABELS: Record<string, string> = {
  'auth.login.success': 'Login',
  'auth.login.failed': 'Login falhou',
  'auth.logout': 'Logout',
  'auth.register': 'Registro',
  'auth.token.refresh': 'Token refresh',
  'user.create': 'Usuário criado',
  'user.update': 'Usuário atualizado',
  'user.delete': 'Usuário deletado',
  'apikey.create': 'API Key criada',
  'apikey.delete': 'API Key deletada',
  'email.sent': 'Email enviado',
  'email.failed': 'Email falhou',
  'conference.create': 'Conferência criada',
  'conference.update': 'Conferência atualizada',
  'conference.delete': 'Conferência deletada',
};

const SEVERITY_CONFIG = {
  low: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500' },
  medium: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500' },
  high: { icon: AlertOctagon, color: 'text-orange-500', bg: 'bg-orange-500' },
  critical: { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500' },
};

export function SecurityDashboard({ backendUrl }: SecurityDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!backendUrl) return;
    
    try {
      const response = await fetch(`${backendUrl}/api/security/dashboard`, {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastUpdate(new Date());
      } else if (response.status === 403) {
        toast.error('Sem permissão para acessar o dashboard');
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchDashboard, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboard]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  const formatDateTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return timestamp;
    }
  };

  if (!backendUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard de Segurança</CardTitle>
          <CardDescription>Configure a URL do backend primeiro</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Erro ao carregar dados do dashboard</p>
          <Button onClick={fetchDashboard} className="mt-4">
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.activityTimeline.map(item => ({
    ...item,
    time: formatTime(item.hour),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Dashboard de Segurança
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitoramento em tempo real • Uptime: {formatUptime(data.uptime)}
            {lastUpdate && ` • Atualizado: ${format(lastUpdate, 'HH:mm:ss')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-pulse text-green-500" />
                Ao vivo
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2 text-muted-foreground" />
                Pausado
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchDashboard}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className={data.alertStats.critical > 0 ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Críticos</p>
                <p className={`text-2xl font-bold ${data.alertStats.critical > 0 ? 'text-red-600' : ''}`}>
                  {data.alertStats.critical}
                </p>
              </div>
              <ShieldAlert className={`h-6 w-6 ${data.alertStats.critical > 0 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className={data.alertStats.high > 0 ? 'border-orange-500' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Alta</p>
                <p className={`text-2xl font-bold ${data.alertStats.high > 0 ? 'text-orange-600' : ''}`}>
                  {data.alertStats.high}
                </p>
              </div>
              <AlertOctagon className={`h-6 w-6 ${data.alertStats.high > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Média</p>
                <p className="text-2xl font-bold">{data.alertStats.medium}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Alertas 24h</p>
                <p className="text-2xl font-bold">{data.alertStats.last24h}</p>
              </div>
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Logins 24h</p>
                <p className="text-2xl font-bold text-green-600">{data.loginStats.successful24h}</p>
              </div>
              <LogIn className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={data.loginStats.failed24h > 10 ? 'border-red-500' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Falhas 24h</p>
                <p className={`text-2xl font-bold ${data.loginStats.failed24h > 10 ? 'text-red-600' : ''}`}>
                  {data.loginStats.failed24h}
                </p>
              </div>
              <XCircle className={`h-6 w-6 ${data.loginStats.failed24h > 10 ? 'text-red-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Atividade 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="logins" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  dot={false}
                  name="Logins"
                />
                <Line 
                  type="monotone" 
                  dataKey="failures" 
                  stroke="hsl(0, 84%, 60%)" 
                  strokeWidth={2}
                  dot={false}
                  name="Falhas"
                />
                <Line 
                  type="monotone" 
                  dataKey="alerts" 
                  stroke="hsl(38, 92%, 50%)" 
                  strokeWidth={2}
                  dot={false}
                  name="Alertas"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resumo 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950">
                  <span className="text-sm">Logins bem-sucedidos</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    {data.loginStats.successful7d}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950">
                  <span className="text-sm">Logins falhados</span>
                  <Badge variant="secondary" className="bg-red-100 text-red-700">
                    {data.loginStats.failed7d}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <span className="text-sm">Emails enviados</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    {data.emailStats.sent7d}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="text-sm">Usuários ativos</span>
                  <Badge variant="secondary">{data.userStats.active}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="text-sm">Admins</span>
                  <Badge variant="secondary">{data.userStats.admins}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="text-sm">IPs únicos (24h)</span>
                  <Badge variant="secondary">{data.loginStats.uniqueIPs24h}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lower Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Latest Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Alertas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.latestAlerts.length === 0 ? (
              <div className="text-center py-6">
                <ShieldCheck className="h-10 w-10 mx-auto text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum alerta pendente</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {data.latestAlerts.map((alert) => {
                    const config = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.low;
                    const Icon = config.icon;
                    
                    return (
                      <div key={alert.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                        <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{alert.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(alert.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-1">
                {data.recentActivity.slice(0, 10).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-1.5 text-sm">
                    {item.success ? (
                      <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    <span className="truncate flex-1">
                      {ACTION_LABELS[item.action] || item.action}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Top Failed IPs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              IPs Suspeitos (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topFailedIPs.length === 0 ? (
              <div className="text-center py-6">
                <ShieldCheck className="h-10 w-10 mx-auto text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum IP suspeito</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {data.topFailedIPs.map((item, index) => (
                    <div key={item.ip} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <span className={`text-xs font-mono w-4 ${index < 3 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                        {index + 1}
                      </span>
                      <code className="flex-1 text-xs truncate">{item.ip.replace('::ffff:', '')}</code>
                      <Badge variant={item.count >= 10 ? 'destructive' : 'secondary'} className="text-xs">
                        {item.count} falhas
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
