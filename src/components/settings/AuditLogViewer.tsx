import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  FileText,
  Loader2,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Mail,
  Shield,
  Key,
  Settings,
  Activity,
} from 'lucide-react';
import { getAuthHeaders } from '@/services/authService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  action: string;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  ip: string;
  userAgent: string | null;
  details: Record<string, unknown>;
  success: boolean;
}

interface AuditStats {
  total: number;
  success: number;
  failure: number;
  byAction: Record<string, number>;
  byUser: Record<string, number>;
  byDay: Record<string, number>;
  periodDays: number;
}

interface AuditLogViewerProps {
  backendUrl: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ComponentType<{className?: string}>; color: string }> = {
  'auth.login.success': { label: 'Login', icon: CheckCircle, color: 'bg-green-500' },
  'auth.login.failed': { label: 'Login Falhou', icon: XCircle, color: 'bg-red-500' },
  'auth.logout': { label: 'Logout', icon: User, color: 'bg-gray-500' },
  'auth.register': { label: 'Registro', icon: User, color: 'bg-blue-500' },
  'auth.token.refresh': { label: 'Token Refresh', icon: RefreshCw, color: 'bg-gray-400' },
  'user.create': { label: 'Usuário Criado', icon: User, color: 'bg-green-500' },
  'user.update': { label: 'Usuário Atualizado', icon: User, color: 'bg-yellow-500' },
  'user.delete': { label: 'Usuário Deletado', icon: User, color: 'bg-red-500' },
  'user.activate': { label: 'Usuário Ativado', icon: CheckCircle, color: 'bg-green-500' },
  'user.deactivate': { label: 'Usuário Desativado', icon: XCircle, color: 'bg-orange-500' },
  'apikey.create': { label: 'API Key Criada', icon: Key, color: 'bg-green-500' },
  'apikey.update': { label: 'API Key Atualizada', icon: Key, color: 'bg-yellow-500' },
  'apikey.delete': { label: 'API Key Deletada', icon: Key, color: 'bg-red-500' },
  'apikey.regenerate': { label: 'API Key Regenerada', icon: Key, color: 'bg-blue-500' },
  'email.sent': { label: 'Email Enviado', icon: Mail, color: 'bg-green-500' },
  'email.failed': { label: 'Email Falhou', icon: Mail, color: 'bg-red-500' },
  'settings.update': { label: 'Config. Atualizada', icon: Settings, color: 'bg-purple-500' },
  'conference.create': { label: 'Conferência Criada', icon: Activity, color: 'bg-green-500' },
  'conference.update': { label: 'Conferência Atualizada', icon: Activity, color: 'bg-yellow-500' },
  'conference.delete': { label: 'Conferência Deletada', icon: Activity, color: 'bg-red-500' },
  'conference.complete': { label: 'Conferência Concluída', icon: CheckCircle, color: 'bg-green-600' },
};

export function AuditLogViewer({ backendUrl }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, hasMore: false });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [successFilter, setSuccessFilter] = useState<string>('all');
  const [availableActions, setAvailableActions] = useState<string[]>([]);

  const fetchLogs = useCallback(async (resetOffset = false) => {
    if (!backendUrl) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(pagination.limit));
      params.set('offset', String(resetOffset ? 0 : pagination.offset));
      
      if (searchQuery) params.set('search', searchQuery);
      if (actionFilter && actionFilter !== 'all') params.set('action', actionFilter);
      if (successFilter && successFilter !== 'all') params.set('success', successFilter);
      
      const response = await fetch(`${backendUrl}/api/audit-logs?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setPagination(prev => ({
          ...prev,
          ...data.pagination,
          offset: resetOffset ? 0 : prev.offset,
        }));
        if (data.actions) {
          setAvailableActions(data.actions);
        }
      } else if (response.status === 403) {
        toast.error('Sem permissão para visualizar logs');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Erro ao carregar logs de auditoria');
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, pagination.limit, pagination.offset, searchQuery, actionFilter, successFilter]);

  const fetchStats = useCallback(async () => {
    if (!backendUrl) return;
    
    setIsLoadingStats(true);
    try {
      const response = await fetch(`${backendUrl}/api/audit-logs/stats?days=7`, {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchLogs(true);
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const handleSearch = () => {
    fetchLogs(true);
  };

  const handleNextPage = () => {
    setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
  };

  const handlePrevPage = () => {
    setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
  };

  useEffect(() => {
    if (pagination.offset > 0) {
      fetchLogs();
    }
  }, [pagination.offset]);

  const getActionBadge = (action: string, success: boolean) => {
    const config = ACTION_LABELS[action] || { label: action, icon: Activity, color: 'bg-gray-500' };
    const Icon = config.icon;
    
    return (
      <Badge 
        variant="outline" 
        className={`flex items-center gap-1 ${!success ? 'border-red-500 text-red-500' : ''}`}
      >
        <span className={`w-2 h-2 rounded-full ${success ? config.color : 'bg-red-500'}`} />
        {config.label}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return timestamp;
    }
  };

  const getDetailsPreview = (details: Record<string, unknown>): string => {
    const { message, target, subject, error } = details as {
      message?: string;
      target?: string;
      subject?: string;
      error?: string;
    };
    
    if (error) return `❌ ${error}`;
    if (message) return message;
    if (target && subject) return `${target}: ${subject}`;
    if (target) return target;
    return '-';
  };

  if (!backendUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Logs de Auditoria
          </CardTitle>
          <CardDescription>Configure a URL do backend primeiro</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Configure a URL do backend na aba "Backend Local" para visualizar logs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total (7 dias)</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sucesso</p>
                  <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Falhas</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failure}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Usuários Ativos</p>
                  <p className="text-2xl font-bold">{Object.keys(stats.byUser).length}</p>
                </div>
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Logs Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Logs de Auditoria
          </CardTitle>
          <CardDescription>
            Histórico de ações realizadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nos logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); }}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {availableActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {ACTION_LABELS[action]?.label || action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={successFilter} onValueChange={(v) => { setSuccessFilter(v); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Sucesso</SelectItem>
                <SelectItem value="false">Falha</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => fetchLogs(true)} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Logs Table */}
          {isLoading && logs.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum log encontrado
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Data/Hora</TableHead>
                    <TableHead className="w-[160px]">Ação</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead className="w-[100px]">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        {getActionBadge(log.action, log.success)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.userName || '-'}</div>
                          <div className="text-xs text-muted-foreground">{log.userEmail || 'Anônimo'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">
                        {getDetailsPreview(log.details)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.ip?.replace('::ffff:', '') || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Pagination */}
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
        </CardContent>
      </Card>
    </div>
  );
}
