import { 
  ClipboardCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Plus,
  TrendingUp,
  Database,
  FileText,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useConferences } from '@/hooks/useConferences';
import { useConnections } from '@/hooks/useConnections';
import { useTemplates } from '@/hooks/useTemplates';

const statusConfig = {
  pending: {
    label: 'Aguardando',
    icon: Clock,
    className: 'bg-status-pending text-status-pending-foreground',
  },
  in_progress: {
    label: 'Em Andamento',
    icon: ClipboardCheck,
    className: 'bg-status-in-progress text-status-in-progress-foreground',
  },
  completed: {
    label: 'Concluída',
    icon: CheckCircle2,
    className: 'bg-status-completed text-status-completed-foreground',
  },
  divergent: {
    label: 'Divergências',
    icon: AlertTriangle,
    className: 'bg-status-divergent text-status-divergent-foreground',
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { recentConferences, stats, isLoading: loadingConferences } = useConferences();
  const { allConnections, isLoading: loadingConnections } = useConnections();
  const { allTemplates, isLoading: loadingTemplates } = useTemplates();

  const isLoading = loadingConferences || loadingConnections || loadingTemplates;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo, {user?.name}! Aqui está o resumo das suas conferências.
          </p>
        </div>
        <Button asChild>
          <Link to="/conferences/new">
            <Plus className="mr-2 h-4 w-4" />
            Nova Conferência
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">conferências criadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aguardando
            </CardTitle>
            <Clock className="h-4 w-4 text-status-pending" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-pending">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">aguardando cliente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concluídas
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-status-completed" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-completed">{stats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">finalizadas com sucesso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Divergências
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-status-divergent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-divergent">{stats.divergent}</div>
            <p className="text-xs text-muted-foreground mt-1">requerem atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link to="/connections">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Conexões</CardTitle>
                <CardDescription>
                  {allConnections.length} banco{allConnections.length !== 1 && 's'} configurado{allConnections.length !== 1 && 's'}
                </CardDescription>
              </div>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link to="/templates">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-3 rounded-lg bg-secondary/10">
                <FileText className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-lg">Templates</CardTitle>
                <CardDescription>
                  {allTemplates.length} modelo{allTemplates.length !== 1 && 's'} disponíve{allTemplates.length !== 1 ? 'is' : 'l'}
                </CardDescription>
              </div>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link to="/conferences">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <ClipboardCheck className="h-6 w-6 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg">Conferências</CardTitle>
                <CardDescription>Ver todas as conferências</CardDescription>
              </div>
            </CardHeader>
          </Link>
        </Card>
      </div>

      {/* Recent Conferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conferências Recentes</CardTitle>
              <CardDescription>Últimas conferências criadas ou atualizadas</CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link to="/conferences">Ver todas</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentConferences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardCheck className="mx-auto h-10 w-10 mb-3 opacity-50" />
              <p>Nenhuma conferência criada ainda.</p>
              <Button asChild className="mt-4">
                <Link to="/conferences/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeira Conferência
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentConferences.map((conference) => {
                const status = statusConfig[conference.status];
                const StatusIcon = status.icon;

                return (
                  <div
                    key={conference.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${status.className}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{conference.name}</p>
                        <p className="text-sm text-muted-foreground">{conference.clientName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/conferences/${conference.id}`}>Ver detalhes</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
