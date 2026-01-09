import { useMemo, useState } from 'react';
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
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Timer,
  Loader2,
  BarChart3,
  Filter,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConferences } from '@/hooks/useConferences';
import { useTemplates } from '@/hooks/useTemplates';
import { Conference } from '@/types';

// Chart colors from CSS variables
const CHART_COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(172, 66%, 50%)',
  'hsl(45, 93%, 47%)',
  'hsl(0, 84%, 60%)',
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
  const { allConferences, isLoading: loadingConferences } = useConferences();
  const { allTemplates, isLoading: loadingTemplates } = useTemplates();

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');

  const isLoading = loadingConferences || loadingTemplates;

  // Apply filters to conferences
  const filteredConferences = useMemo(() => {
    return allConferences.filter((conference) => {
      // Date filter
      if (startDate || endDate) {
        const conferenceDate = new Date(conference.createdAt);
        if (startDate && conferenceDate < new Date(startDate)) return false;
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (conferenceDate > endOfDay) return false;
        }
      }

      // Template filter
      if (selectedTemplate !== 'all' && conference.templateId !== selectedTemplate) {
        return false;
      }

      return true;
    });
  }, [allConferences, startDate, endDate, selectedTemplate]);

  // Calculate stats from filtered conferences
  const stats = useMemo(() => ({
    total: filteredConferences.length,
    pending: filteredConferences.filter(c => c.status === 'pending').length,
    inProgress: filteredConferences.filter(c => c.status === 'in_progress').length,
    completed: filteredConferences.filter(c => c.status === 'completed').length,
    divergent: filteredConferences.filter(c => c.status === 'divergent').length,
  }), [filteredConferences]);

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

    filteredConferences.forEach((conference) => {
      conference.items
        .filter((item) => item.status === 'divergent' || item.userResponse === 'divergent')
        .forEach((item) => {
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
  }, [filteredConferences, allTemplates]);

  // Average completion time
  const avgCompletionTime = useMemo(() => {
    const completedConferences = filteredConferences.filter(
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
  }, [filteredConferences]);

  // Monthly conferences data for bar chart
  const monthlyData = useMemo(() => {
    const months: Record<string, { name: string; total: number; completed: number; divergent: number }> = {};
    
    filteredConferences.forEach((conference) => {
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
  }, [filteredConferences]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedTemplate('all');
  };

  const hasActiveFilters = startDate || endDate || selectedTemplate !== 'all';

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

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Filtros</CardTitle>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template">
                  <SelectValue placeholder="Todos os templates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os templates</SelectItem>
                  {allTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasActiveFilters && (
            <p className="text-sm text-muted-foreground mt-3">
              Mostrando {filteredConferences.length} de {allConferences.length} conferências
            </p>
          )}
        </CardContent>
      </Card>

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
