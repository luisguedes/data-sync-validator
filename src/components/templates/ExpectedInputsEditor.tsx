import { useState } from 'react';
import { Plus, Trash2, Edit, GripVertical, DollarSign, Hash, Type, AlertCircle } from 'lucide-react';
import { ExpectedInput } from '@/types';
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
import { toast } from 'sonner';

interface ExpectedInputsEditorProps {
  inputs: ExpectedInput[];
  onChange: (inputs: ExpectedInput[]) => void;
}

const typeIcons = {
  number: Hash,
  currency: DollarSign,
  text: Type,
};

const typeLabels = {
  number: 'Número',
  currency: 'Moeda',
  text: 'Texto',
};

export function ExpectedInputsEditor({ inputs, onChange }: ExpectedInputsEditorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInput, setEditingInput] = useState<ExpectedInput | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const [formData, setFormData] = useState<ExpectedInput>({
    key: '',
    label: '',
    type: 'number',
    scope: 'global',
    required: true,
    hint: '',
  });

  const handleAdd = () => {
    setEditingInput(null);
    setFormData({
      key: '',
      label: '',
      type: 'number',
      scope: 'global',
      required: true,
      hint: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (input: ExpectedInput) => {
    setEditingInput(input);
    setFormData({ ...input });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.key.trim()) {
      toast.error('Chave é obrigatória');
      return;
    }

    if (!formData.label.trim()) {
      toast.error('Label é obrigatória');
      return;
    }

    // Validate key format
    if (!/^[a-z][a-z0-9_]*$/.test(formData.key)) {
      toast.error('Chave deve começar com letra minúscula e conter apenas letras, números e underscore');
      return;
    }

    // Check for duplicate keys
    const isDuplicate = inputs.some(i => i.key === formData.key && i.key !== editingInput?.key);
    if (isDuplicate) {
      toast.error('Já existe um input com esta chave');
      return;
    }

    if (editingInput) {
      onChange(inputs.map(i => i.key === editingInput.key ? formData : i));
      toast.success('Input atualizado!');
    } else {
      onChange([...inputs, formData]);
      toast.success('Input adicionado!');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (key: string) => {
    onChange(inputs.filter(i => i.key !== key));
    setDeleteKey(null);
    toast.success('Input removido!');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inputs Esperados</CardTitle>
              <CardDescription>
                Campos que o cliente preencherá antes de iniciar a conferência
              </CardDescription>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Input
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {inputs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum input esperado configurado</p>
              <p className="text-sm mt-1">
                Adicione inputs para que o cliente informe valores antes da conferência
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {inputs.map((input) => {
                const Icon = typeIcons[input.type];
                return (
                  <div
                    key={input.key}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors group"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{input.label}</span>
                        <Badge variant="outline" className="text-xs font-mono">{input.key}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {typeLabels[input.type]}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {input.scope === 'global' ? 'Global' : 'Por Loja'}
                        </Badge>
                        {input.required && (
                          <Badge className="text-xs bg-destructive/10 text-destructive hover:bg-destructive/20">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                      {input.hint && (
                        <p className="text-sm text-muted-foreground mt-1">{input.hint}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEdit(input)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteKey(input.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingInput ? 'Editar Input' : 'Novo Input Esperado'}
            </DialogTitle>
            <DialogDescription>
              Configure o campo que será exibido para o cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Ex: Valor Total de Vendas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">Chave *</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="Ex: valor_total_vendas"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'number' | 'currency' | 'text') => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Número
                      </div>
                    </SelectItem>
                    <SelectItem value="currency">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Moeda
                      </div>
                    </SelectItem>
                    <SelectItem value="text">
                      <div className="flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        Texto
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Escopo</Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value: 'global' | 'per_store') => setFormData(prev => ({ ...prev, scope: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="per_store">Por Loja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hint">Dica (opcional)</Label>
              <Input
                id="hint"
                value={formData.hint || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, hint: e.target.value }))}
                placeholder="Texto de ajuda para o cliente"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.required}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, required: checked }))}
              />
              <Label>Campo obrigatório</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingInput ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteKey} onOpenChange={(open) => !open && setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Remover Input
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este input esperado? 
              Itens que utilizam este binding precisarão ser atualizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteKey && handleDelete(deleteKey)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
