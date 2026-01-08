import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
import { useConnections, ConnectionFormData } from '@/hooks/useConnections';
import { ConnectionFormModal } from '@/components/connections/ConnectionFormModal';
import { DeleteConnectionDialog } from '@/components/connections/DeleteConnectionDialog';
import { DbConnection } from '@/types';
import { toast } from 'sonner';

export default function Connections() {
  const {
    connections,
    isLoading,
    searchTerm,
    setSearchTerm,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    testConnectionData,
  } = useConnections();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<DbConnection | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleCreate = () => {
    setSelectedConnection(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEdit = (connection: DbConnection) => {
    setSelectedConnection(connection);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDelete = (connection: DbConnection) => {
    setSelectedConnection(connection);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (data: ConnectionFormData) => {
    if (modalMode === 'create') {
      createConnection(data);
      toast.success('Conexão criada com sucesso!');
    } else if (selectedConnection) {
      updateConnection(selectedConnection.id, data);
      toast.success('Conexão atualizada com sucesso!');
    }
  };

  const handleConfirmDelete = () => {
    if (selectedConnection) {
      deleteConnection(selectedConnection.id);
      toast.success('Conexão excluída com sucesso!');
      setIsDeleteDialogOpen(false);
      setSelectedConnection(null);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    const result = await testConnection(id);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setTestingId(null);
  };

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
          <h1 className="text-3xl font-bold">Conexões</h1>
          <p className="text-muted-foreground">
            Gerencie as conexões com bancos de dados PostgreSQL
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Conexão
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conexões..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Connections Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => (
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
                  <DropdownMenuItem onClick={() => handleEdit(connection)}>
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTestConnection(connection.id)}>
                    {testingId === connection.id ? 'Testando...' : 'Testar Conexão'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDelete(connection)}
                  >
                    Excluir
                  </DropdownMenuItem>
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
                  {testingId === connection.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : connection.status === 'active' ? (
                    <Badge className="bg-status-completed text-status-completed-foreground">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Ativo
                    </Badge>
                  ) : connection.status === 'error' ? (
                    <Badge className="bg-status-divergent text-status-divergent-foreground">
                      <XCircle className="mr-1 h-3 w-3" />
                      Erro
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      Não testado
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add New Card */}
        <Card
          className="border-dashed hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
          onClick={handleCreate}
        >
          <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px] text-muted-foreground">
            <Plus className="h-10 w-10 mb-2" />
            <span>Adicionar Conexão</span>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {connections.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Database className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Nenhuma conexão encontrada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchTerm
              ? 'Tente ajustar sua busca.'
              : 'Comece criando uma nova conexão com banco de dados.'}
          </p>
          {!searchTerm && (
            <Button className="mt-4" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conexão
            </Button>
          )}
        </div>
      )}

      {/* Modals */}
      <ConnectionFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={handleSubmit}
        onTest={testConnectionData}
        connection={selectedConnection}
        mode={modalMode}
      />

      <DeleteConnectionDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        connection={selectedConnection}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
