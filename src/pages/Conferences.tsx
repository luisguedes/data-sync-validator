import { 
  Plus, 
  Search, 
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Link as LinkIcon,
  Eye,
  MoreHorizontal
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConferenceStatus } from '@/types';

// Mock data
const mockConferences = [
  {
    id: '1',
    name: 'Migração Loja Central',
    clientName: 'João Silva',
    clientEmail: 'joao@email.com',
    connectionName: 'Produção - Loja Central',
    templateName: 'Migração Completa v2.1',
    status: 'pending' as ConferenceStatus,
    progress: 0,
    totalItems: 24,
    completedItems: 0,
    createdAt: new Date('2024-01-15'),
    expiresAt: new Date('2024-01-22'),
  },
  {
    id: '2',
    name: 'Validação Dados Financeiros',
    clientName: 'Maria Santos',
    clientEmail: 'maria@empresa.com',
    connectionName: 'Homologação',
    templateName: 'Validação Financeira',
    status: 'in_progress' as ConferenceStatus,
    progress: 45,
    totalItems: 12,
    completedItems: 5,
    createdAt: new Date('2024-01-14'),
    expiresAt: new Date('2024-01-21'),
  },
  {
    id: '3',
    name: 'Conferência Estoque',
    clientName: 'Pedro Costa',
    clientEmail: 'pedro@loja.com',
    connectionName: 'Produção - Loja Central',
    templateName: 'Conferência de Estoque',
    status: 'completed' as ConferenceStatus,
    progress: 100,
    totalItems: 8,
    completedItems: 8,
    createdAt: new Date('2024-01-10'),
    completedAt: new Date('2024-01-12'),
  },
  {
    id: '4',
    name: 'Migração Filial Norte',
    clientName: 'Ana Oliveira',
    clientEmail: 'ana@filial.com',
    connectionName: 'Servidor Antigo',
    templateName: 'Migração Completa v2.1',
    status: 'divergent' as ConferenceStatus,
    progress: 100,
    totalItems: 24,
    completedItems: 24,
    divergences: 3,
    createdAt: new Date('2024-01-08'),
  },
];

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

export default function Conferences() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Conferências</h1>
          <p className="text-muted-foreground">
            Gerencie todas as conferências de migração
          </p>
        </div>
        <Button asChild>
          <Link to="/conferences/new">
            <Plus className="mr-2 h-4 w-4" />
            Nova Conferência
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar conferências..." className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Aguardando</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="completed">Concluída</SelectItem>
              <SelectItem value="divergent">Divergências</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conferences List */}
      <div className="space-y-4">
        {mockConferences.map((conference) => {
          const status = statusConfig[conference.status];
          const StatusIcon = status.icon;

          return (
            <Card key={conference.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Left side */}
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${status.className}`}>
                      <StatusIcon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{conference.name}</h3>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {conference.clientName} • {conference.clientEmail}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{conference.templateName}</span>
                        <span>•</span>
                        <span>{conference.connectionName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-4">
                    {/* Progress */}
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {conference.completedItems}/{conference.totalItems} itens
                      </div>
                      <div className="w-32 h-2 bg-muted rounded-full mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${
                            conference.status === 'divergent'
                              ? 'bg-status-divergent'
                              : conference.status === 'completed'
                              ? 'bg-status-completed'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${conference.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/conferences/${conference.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <LinkIcon className="mr-2 h-4 w-4" />
                            Copiar Link
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Modo Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* Divergences warning */}
                {conference.status === 'divergent' && conference.divergences && (
                  <div className="mt-4 p-3 rounded-lg bg-status-divergent/10 border border-status-divergent/20">
                    <div className="flex items-center gap-2 text-status-divergent">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {conference.divergences} divergência(s) encontrada(s)
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
