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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Conference, EmailHistoryEntry, EmailStatus } from '@/types';

const STATUS_COLORS = {
  sent: 'hsl(142, 71%, 45%)',
  failed: 'hsl(0, 84%, 60%)',
  pending: 'hsl(45, 93%, 47%)',
};

const STATUS_LABELS = {
  sent: 'Enviados',
  failed: 'Falhas',
  pending: 'Pendentes',
};

const TYPE_LABELS = {
  conference_link: 'Link de Conferência',
  reminder: 'Lembrete',
  completion: 'Conclusão',
};

interface EmailDashboardProps {
  conferences: Conference[];
}

export function EmailDashboard({ conferences }: EmailDashboardProps) {
  // Collect all email history entries
  const allEmails = useMemo(() => {
    return conferences.flatMap(c => c.emailHistory || []);
  }, [conferences]);

  // Email stats
  const emailStats = useMemo(() => {
    const sent = allEmails.filter(e => e.status === 'sent').length;
    const failed = allEmails.filter(e => e.status === 'failed').length;
    const pending = allEmails.filter(e => e.status === 'pending').length;
    const total = allEmails.length;
    
    const resent = allEmails.filter(e => {
      const conference = conferences.find(c => 
        c.emailHistory?.some(h => h.id === e.id)
      );
      if (!conference) return false;
      const linkEmails = conference.emailHistory?.filter(
        h => h.type === 'conference_link' && h.to === e.to
      );
      return linkEmails && linkEmails.length > 1;
    }).length;

    return {
      total,
      sent,
      failed,
      pending,
      resent,
      deliveryRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
    };
  }, [allEmails, conferences]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    return [
      { name: STATUS_LABELS.sent, value: emailStats.sent, color: STATUS_COLORS.sent },
      { name: STATUS_LABELS.failed, value: emailStats.failed, color: STATUS_COLORS.failed },
      { name: STATUS_LABELS.pending, value: emailStats.pending, color: STATUS_COLORS.pending },
    ].filter(item => item.value > 0);
  }, [emailStats]);

  // Emails by type
  const typeData = useMemo(() => {
    const byType: Record<string, number> = {};
    allEmails.forEach(email => {
      const type = email.type;
      byType[type] = (byType[type] || 0) + 1;
    });

    return Object.entries(byType).map(([type, count]) => ({
      name: TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type,
      count,
    }));
  }, [allEmails]);

  // Daily email volume (last 7 days)
  const dailyData = useMemo(() => {
    const last7Days: Record<string, { date: string; sent: number; failed: number }> = {};
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = format(date, 'yyyy-MM-dd');
      const label = format(date, 'dd/MM', { locale: ptBR });
      last7Days[key] = { date: label, sent: 0, failed: 0 };
    }

    allEmails.forEach(email => {
      const dateKey = format(new Date(email.sentAt), 'yyyy-MM-dd');
      if (last7Days[dateKey]) {
        if (email.status === 'sent') {
          last7Days[dateKey].sent++;
        } else if (email.status === 'failed') {
          last7Days[dateKey].failed++;
        }
      }
    });

    return Object.values(last7Days);
  }, [allEmails]);

  // Recent failures
  const recentFailures = useMemo(() => {
    return allEmails
      .filter(e => e.status === 'failed')
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, 5);
  }, [allEmails]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Emails
            </CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{emailStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">emails enviados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Entrega
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-status-completed" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-completed">{emailStats.deliveryRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{emailStats.sent} de {emailStats.total} entregues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Falhas
            </CardTitle>
            <XCircle className="h-4 w-4 text-status-divergent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-status-divergent">{emailStats.failureRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{emailStats.failed} falhas no envio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reenviados
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{emailStats.resent}</div>
            <p className="text-xs text-muted-foreground mt-1">emails reenviados</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status de Envio</CardTitle>
            <CardDescription>Distribuição dos emails por status</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <Mail className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p>Nenhum email enviado</p>
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
                    formatter={(value: number) => [value, 'Emails']}
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

        {/* Daily Volume Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Volume Diário</CardTitle>
            <CardDescription>Emails enviados nos últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyData.every(d => d.sent === 0 && d.failed === 0) ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p>Nenhum email nos últimos 7 dias</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
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
                  <Bar dataKey="sent" name="Enviados" fill={STATUS_COLORS.sent} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Falhas" fill={STATUS_COLORS.failed} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Type Distribution & Recent Failures */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Emails by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Emails por Tipo</CardTitle>
            <CardDescription>Quantidade de emails por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            {typeData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>Nenhum email registrado</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={typeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={150}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Emails']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    name="Quantidade" 
                    fill="hsl(217, 91%, 60%)" 
                    radius={[0, 4, 4, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Failures */}
        <Card>
          <CardHeader>
            <CardTitle>Falhas Recentes</CardTitle>
            <CardDescription>Últimos erros de envio de email</CardDescription>
          </CardHeader>
          <CardContent>
            {recentFailures.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <div className="text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 mb-3 text-status-completed opacity-50" />
                  <p>Nenhuma falha registrada</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {recentFailures.map((email) => (
                  <div 
                    key={email.id} 
                    className="p-3 border rounded-lg bg-destructive/5 border-destructive/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{email.to}</p>
                        <p className="text-xs text-muted-foreground truncate">{email.subject}</p>
                        {email.error && (
                          <p className="text-xs text-destructive mt-1">{email.error}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(email.sentAt), "dd/MM HH:mm")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
