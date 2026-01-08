import { Plus, Search, MoreHorizontal, Database, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock data
const mockConnections = [
  {
    id: '1',
    name: 'Produção - Loja Central',
    host: '192.168.1.100',
    port: 5432,
    database: 'loja_central',
    status: 'active' as const,
    createdAt: new Date('2024-01-10'),
  },
  {
    id: '2',
    name: 'Homologação',
    host: '192.168.1.50',
    port: 5432,
    database: 'homolog_db',
    status: 'active' as const,
    createdAt: new Date('2024-01-08'),
  },
  {
    id: '3',
    name: 'Servidor Antigo',
    host: '10.0.0.5',
    port: 5432,
    database: 'legacy_system',
    status: 'error' as const,
    createdAt: new Date('2024-01-05'),
  },
];

export default function Connections() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Conexões</h1>
          <p className="text-muted-foreground">
            Gerencie as conexões com bancos de dados PostgreSQL
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Conexão
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar conexões..." className="pl-9" />
        </div>
      </div>

      {/* Connections Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockConnections.map((connection) => (
          <Card key={connection.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{connection.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {connection.host}:{connection.port}
                  </CardDescription>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Editar</DropdownMenuItem>
                  <DropdownMenuItem>Testar Conexão</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Banco:</span>
                  <span className="font-mono">{connection.database}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {connection.status === 'active' ? (
                    <Badge className="bg-status-completed text-status-completed-foreground">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge className="bg-status-divergent text-status-divergent-foreground">
                      <XCircle className="mr-1 h-3 w-3" />
                      Erro
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add New Card */}
        <Card className="border-dashed hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer">
          <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px] text-muted-foreground">
            <Plus className="h-10 w-10 mb-2" />
            <span>Adicionar Conexão</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
