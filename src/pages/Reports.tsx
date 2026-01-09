import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Timer,
  Loader2,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConferences } from '@/hooks/useConferences';
import { useTemplates } from '@/hooks/useTemplates';

// Chart colors from CSS variables
const CHART_COLORS = [
  'hsl(217, 91%, 60%)',   // chart-1 (primary/blue)
  'hsl(262, 83%, 58%)',   // chart-2 (purple)
  'hsl(172, 66%, 50%)',   // chart-3 (teal)
  'hsl(45, 93%, 47%)',    // chart-4 (yellow/warning)
  'hsl(0, 84%, 60%)',     // chart-5 (red)
];

const STATUS_COLORS = {
  pending: 'hsl(45, 93%, 47%)',
  in_progress: 'hsl(217, 91%, 60%)',
  completed: 'hsl(142, 71%, 45%)',
  divergent: 'hsl(0, 84%, 60%)',
};

const STATUS_LABELS = {
  pending: 'Aguardando',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  divergent: 'Divergências',
};

export default function Reports() {
  const { allConferences, stats, isLoading: loadingConferences } = useConferences();
  const { allTemplates, isLoading: loadingTemplates } = useTemplates();

  const isLoading = loadingConferences || loadingTemplates;

  // Status distribution data for pie chart
  const statusData = useMemo(() => {
    return [
      { name: STATUS_LABELS.pending, value: stats.pending, color: STATUS_COLORS.pending },
      { name: STATUS_LABELS.in_progress, value: stats.inProgress || 0, color: STATUS_COLORS.in_progress },
      { name: STATUS_LABELS.completed, value: stats.completed, color: STATUS_COLORS.completed },
      { name: STATUS_LABELS.divergent, value: stats.divergent, color: STATUS_COLORS.divergent },
    ].filter(item => item.value > 0);
  }, [stats]);

  // Most common divergences (items with divergent status)
  const divergenceData = useMemo(() => {
    const divergenceCount: Record<string, { name: string; count: number }> = {};

    allConferences.forEach((conference) => {
      conference.items
        .filter((item) => item.status === 'divergent' || item.userResponse === 'divergent')
        .forEach((item) => {
          // Find template item to get the name
          const template = allTemplates.find((t) => t.id === conference.templateId);
          const templateItem = template?.sections
            .flatMap((s) => s.items)
            .find((ti) => ti.id === item.templateItemId);
          
          const itemName = templateItem?.title || item.templateItemId;
          
          if (!divergenceCount[item.templateItemId]) {
            divergenceCount[item.templateItemId] = { name: itemName, count: 0 };
          }
          divergenceCount[item.templateItemId].count++;
        });
    });

    return Object.values(divergenceCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allConferences, allTemplates]);

  // Average completion time
  const avgCompletionTime = useMemo(() => {
    const completedConferences = allConferences.filter(
      (c) => c.status === 'completed' && c.completedAt
    );

    if (completedConferences.length === 0) return null;

    const totalMs = completedConferences.reduce((sum, c) => {
      const start = new Date(c.createdAt).getTime();
      const end = new Date(c.completedAt!).getTime();
      return sum + (end - start);
    }, 0);

    const avgMs = totalMs / completedConferences.length;
    const avgHours = Math.round(avgMs / (1000 * 60 * 60));
    const avgDays = Math.round(avgMs / (1000 * 60 * 60 * 24));

    return avgDays > 0 ? `${avgDays} dia${avgDays !== 1 ? 's' : ''}` : `${avgHours} hora${avgHours !== 1 ? 's' : ''}`;
  }, [allConferences]);

  // Monthly conferences data for bar chart
  const monthlyData = useMemo(() => {
    const months: Record<string, { name: string; total: number; completed: number; divergent: number }> = {};
    
    allConferences.forEach((conference) => {
      const date = new Date(conference.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      if (!months[monthKey]) {
        months[monthKey] = { name: monthName, total: 0, completed: 0, divergent: 0 };
      }
      
      months[monthKey].total++;
      if (conference.status === 'completed') months[monthKey].completed++;
      if (conference.status === 'divergent') months[monthKey].divergent++;
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, data]) => data);
  }, [allConferences]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completionRate = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  const divergenceRate = stats.total > 0 
    ? Math.round((stats.divergent / stats.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">
          Análise de conferências, divergências e performance
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Conferências
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
              Taxa de Conclusão
            </CardTitle>
            <Clock className="h-4 w-4 text-status-completed" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-completed">{completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.completed} de {stats.total} concluídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Divergências
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-status-divergent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-divergent">{divergenceRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.divergent} conferências com divergências</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Médio de Conclusão
            </CardTitle>
            <Timer className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{avgCompletionTime || '--'}</div>
            <p className="text-xs text-muted-foreground mt-1">média para conclusão</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <CardDescription>Proporção de conferências por status atual</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p>Nenhuma conferência para exibir</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'Conferências']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly Conferences Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Conferências por Mês</CardTitle>
            <CardDescription>Evolução mensal das conferências</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p>Nenhuma conferência para exibir</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" name="Total" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Concluídas" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="divergent" name="Divergências" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Divergences Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Divergências Mais Comuns</CardTitle>
          <CardDescription>Itens que mais apresentam divergências nas conferências</CardDescription>
        </CardHeader>
        <CardContent>
          {divergenceData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                <AlertTriangle className="mx-auto h-10 w-10 mb-3 opacity-50" />
                <p>Nenhuma divergência registrada</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={divergenceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={200}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  formatter={(value: number) => [value, 'Ocorrências']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  name="Divergências" 
                  fill={CHART_COLORS[4]} 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
