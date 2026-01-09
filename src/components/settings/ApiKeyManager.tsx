import { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Copy, 
  Check, 
  Eye, 
  EyeOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ApiKey {
  id: string;
  name: string;
  permission: 'read' | 'full' | 'admin';
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  keyPreview?: string;
}

interface ApiKeyManagerProps {
  backendUrl: string;
  adminApiKey: string;
}

const PERMISSION_LABELS = {
  read: { label: 'Somente Leitura', icon: Shield, color: 'bg-blue-500' },
  full: { label: 'Acesso Completo', icon: ShieldCheck, color: 'bg-green-500' },
  admin: { label: 'Administrador', icon: ShieldAlert, color: 'bg-red-500' },
};

export function ApiKeyManager({ backendUrl, adminApiKey }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [yourPermission, setYourPermission] = useState<string>('');
  
  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermission, setNewKeyPermission] = useState<'read' | 'full' | 'admin'>('read');
  const [isCreating, setIsCreating] = useState(false);
  
  // Created key display
  const [createdKey, setCreatedKey] = useState<{ name: string; key: string } | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Delete dialog
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Regenerate dialog
  const [regenerateKeyId, setRegenerateKeyId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratedKey, setRegeneratedKey] = useState<string | null>(null);

  const fetchKeys = async () => {
    if (!backendUrl || !adminApiKey) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/keys`, {
        headers: { 'x-api-key': adminApiKey },
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          toast.error('API Key inválida ou sem permissão');
          return;
        }
        throw new Error('Erro ao buscar chaves');
      }
      
      const data = await response.json();
      setKeys(data.keys || []);
      setYourPermission(data.yourPermission || '');
    } catch (error) {
      toast.error('Erro ao conectar ao backend');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [backendUrl, adminApiKey]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Nome da chave é obrigatório');
      return;
    }
    
    setIsCreating(true);
    try {
      const response = await fetch(`${backendUrl}/api/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': adminApiKey,
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          permission: newKeyPermission,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar chave');
      }
      
      const data = await response.json();
      setCreatedKey({ name: data.key.name, key: data.key.key });
      setIsCreateOpen(false);
      setNewKeyName('');
      setNewKeyPermission('read');
      fetchKeys();
      toast.success('API Key criada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar chave');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (keyId: string, active: boolean) => {
    try {
      const response = await fetch(`${backendUrl}/api/keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': adminApiKey,
        },
        body: JSON.stringify({ active }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao atualizar chave');
      }
      
      fetchKeys();
      toast.success(active ? 'Chave ativada' : 'Chave desativada');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar chave');
    }
  };

  const handleDelete = async () => {
    if (!deleteKeyId) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`${backendUrl}/api/keys/${deleteKeyId}`, {
        method: 'DELETE',
        headers: { 'x-api-key': adminApiKey },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao deletar chave');
      }
      
      fetchKeys();
      toast.success('API Key deletada');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao deletar chave');
    } finally {
      setIsDeleting(false);
      setDeleteKeyId(null);
    }
  };

  const handleRegenerate = async () => {
    if (!regenerateKeyId) return;
    
    setIsRegenerating(true);
    try {
      const response = await fetch(`${backendUrl}/api/keys/${regenerateKeyId}/regenerate`, {
        method: 'POST',
        headers: { 'x-api-key': adminApiKey },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao regenerar chave');
      }
      
      const data = await response.json();
      setRegeneratedKey(data.key.key);
      fetchKeys();
      toast.success('API Key regenerada');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao regenerar chave');
    } finally {
      setIsRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copiado para a área de transferência');
  };

  const getPermissionBadge = (permission: string) => {
    const config = PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS];
    if (!config) return null;
    
    const Icon = config.icon;
    return (
      <Badge variant="secondary" className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (!backendUrl || !adminApiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gerenciamento de API Keys
          </CardTitle>
          <CardDescription>
            Configure a URL do backend e a API Key admin para gerenciar as chaves
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <p className="text-sm text-muted-foreground">
              Configure a URL do backend e uma API Key com permissão de administrador nas configurações acima.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Gerenciamento de API Keys
              </CardTitle>
              <CardDescription>
                Crie e gerencie chaves de acesso ao backend
                {yourPermission && (
                  <span className="ml-2">
                    (Sua permissão: <strong>{yourPermission}</strong>)
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchKeys} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {yourPermission === 'admin' && (
                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Chave
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhuma API Key encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Uso</TableHead>
                  <TableHead>Requisições</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">
                      <div>
                        {key.name}
                        {key.keyPreview && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {key.keyPreview}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getPermissionBadge(key.permission)}</TableCell>
                    <TableCell>
                      {yourPermission === 'admin' ? (
                        <Switch
                          checked={key.active}
                          onCheckedChange={(checked) => handleToggleActive(key.id, checked)}
                        />
                      ) : (
                        <Badge variant={key.active ? 'default' : 'secondary'}>
                          {key.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {key.lastUsedAt ? (
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(key.lastUsedAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>{key.usageCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {yourPermission === 'admin' && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRegenerateKeyId(key.id)}
                            title="Regenerar chave"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteKeyId(key.id)}
                            className="text-destructive hover:text-destructive"
                            title="Deletar chave"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova API Key</DialogTitle>
            <DialogDescription>
              Crie uma nova chave de acesso para o backend
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Nome da Chave</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex: Frontend App, Mobile App..."
              />
            </div>
            <div className="space-y-2">
              <Label>Nível de Permissão</Label>
              <Select value={newKeyPermission} onValueChange={(v) => setNewKeyPermission(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Somente Leitura</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="full">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Acesso Completo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      <span>Administrador</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {newKeyPermission === 'read' && 'Pode apenas ler informações (health checks, status SMTP)'}
                {newKeyPermission === 'full' && 'Pode ler e enviar emails'}
                {newKeyPermission === 'admin' && 'Acesso total, incluindo gerenciamento de chaves'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Created Key Dialog */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Chave Criada com Sucesso!
            </DialogTitle>
            <DialogDescription>
              Copie a chave abaixo. Ela só será exibida uma vez!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <p className="font-medium">{createdKey?.name}</p>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showCreatedKey ? 'text' : 'password'}
                  value={createdKey?.key || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCreatedKey(!showCreatedKey)}
                >
                  {showCreatedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(createdKey?.key || '')}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Guarde esta chave em local seguro. Ela não poderá ser recuperada.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A chave será permanentemente removida
              e qualquer aplicação usando esta chave perderá acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Confirmation */}
      <AlertDialog 
        open={!!regenerateKeyId && !regeneratedKey} 
        onOpenChange={() => setRegenerateKeyId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave atual será invalidada e uma nova será gerada.
              Qualquer aplicação usando a chave atual perderá acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate}>
              {isRegenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Show Regenerated Key */}
      <Dialog 
        open={!!regeneratedKey} 
        onOpenChange={() => { setRegeneratedKey(null); setRegenerateKeyId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <RefreshCw className="h-5 w-5" />
              Chave Regenerada!
            </DialogTitle>
            <DialogDescription>
              Copie a nova chave abaixo. Ela só será exibida uma vez!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showCreatedKey ? 'text' : 'password'}
                  value={regeneratedKey || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCreatedKey(!showCreatedKey)}
                >
                  {showCreatedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(regeneratedKey || '')}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                A chave anterior foi invalidada. Atualize suas aplicações.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setRegeneratedKey(null); setRegenerateKeyId(null); }}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
