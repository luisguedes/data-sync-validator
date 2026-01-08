import { useEffect, useState } from 'react';
import { Code, Settings, AlertTriangle } from 'lucide-react';
import { TemplateItem, ExpectedInput, ValidationRule } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface ItemEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TemplateItem | null;
  expectedInputs: ExpectedInput[];
  onSave: (item: TemplateItem) => void;
}

const validationTypes = [
  { value: 'single_number_required', label: 'Número único obrigatório', description: 'Query deve retornar exatamente um número' },
  { value: 'must_return_rows', label: 'Deve retornar linhas', description: 'Query deve retornar pelo menos uma linha' },
  { value: 'must_return_no_rows', label: 'Não deve retornar linhas', description: 'Query não deve retornar nenhuma linha' },
  { value: 'number_equals_expected', label: 'Igual ao valor esperado', description: 'Resultado deve ser igual ao input esperado' },
  { value: 'number_matches_expected_with_tolerance', label: 'Com tolerância', description: 'Resultado pode variar dentro de uma tolerância' },
];

export function ItemEditorModal({
  open,
  onOpenChange,
  item,
  expectedInputs,
  onSave,
}: ItemEditorModalProps) {
  const [formData, setFormData] = useState<TemplateItem | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
    }
  }, [item]);

  if (!formData) return null;

  const handleChange = <K extends keyof TemplateItem>(field: K, value: TemplateItem[K]) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleValidationChange = (type: ValidationRule['type']) => {
    setFormData(prev => {
      if (!prev) return null;
      const newRule: ValidationRule = { type };
      if (type === 'number_matches_expected_with_tolerance') {
        newRule.tolerance = prev.validationRule.tolerance || 0.01;
      }
      return { ...prev, validationRule: newRule };
    });
  };

  const handleToleranceChange = (tolerance: number) => {
    setFormData(prev => {
      if (!prev) return null;
      return { ...prev, validationRule: { ...prev.validationRule, tolerance } };
    });
  };

  const handleSave = () => {
    if (!formData) return;

    if (!formData.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    if (!formData.query.trim()) {
      toast.error('Query SQL é obrigatória');
      return;
    }

    // Validate SELECT only
    const queryUpper = formData.query.toUpperCase().trim();
    if (!queryUpper.startsWith('SELECT')) {
      toast.error('Apenas queries SELECT são permitidas');
      return;
    }

    onSave(formData);
    toast.success('Item salvo com sucesso!');
  };

  const needsBinding = ['number_equals_expected', 'number_matches_expected_with_tolerance'].includes(formData.validationRule.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Editor de Item
          </DialogTitle>
          <DialogDescription>
            Configure a query, regras de validação e bindings do item
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="query">Query SQL</TabsTrigger>
            <TabsTrigger value="validation">Validação</TabsTrigger>
          </TabsList>

          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Ex: Total de Vendas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">Chave</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => handleChange('key', e.target.value)}
                  placeholder="Ex: total_vendas"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Descrição do item para o cliente"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Escopo</Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value: 'global' | 'per_store') => handleChange('scope', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="per_store">Por Loja</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.scope === 'global' 
                    ? 'Executado uma vez para toda conferência'
                    : 'Executado para cada loja separadamente'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Auto-resolve</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={formData.autoResolve}
                    onCheckedChange={(checked) => handleChange('autoResolve', checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.autoResolve ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, marca automaticamente como OK se a validação passar
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Query Tab */}
          <TabsContent value="query" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="query">Query SQL *</Label>
                <Badge variant="outline" className="text-xs">
                  <Code className="h-3 w-3 mr-1" />
                  Apenas SELECT
                </Badge>
              </div>
              <Textarea
                id="query"
                value={formData.query}
                onChange={(e) => handleChange('query', e.target.value)}
                placeholder="SELECT COUNT(*) FROM tabela WHERE ..."
                className="font-mono text-sm min-h-[150px]"
              />
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Variáveis disponíveis:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><code className="bg-muted px-1 rounded">:store_id</code> - ID da loja (para escopo per_store)</li>
                  <li><code className="bg-muted px-1 rounded">:data_inicio</code> - Data de início da conferência</li>
                  <li><code className="bg-muted px-1 rounded">:data_fim</code> - Data de fim da conferência</li>
                  {expectedInputs.map(input => (
                    <li key={input.key}>
                      <code className="bg-muted px-1 rounded">:{input.key}</code> - {input.label}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Validation Tab */}
          <TabsContent value="validation" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Regra de Validação</Label>
              <Select
                value={formData.validationRule.type}
                onValueChange={(value: ValidationRule['type']) => handleValidationChange(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div>{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.validationRule.type === 'number_matches_expected_with_tolerance' && (
              <div className="space-y-2">
                <Label htmlFor="tolerance">Tolerância</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tolerance"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.validationRule.tolerance || 0.01}
                    onChange={(e) => handleToleranceChange(parseFloat(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    ({((formData.validationRule.tolerance || 0.01) * 100).toFixed(0)}% de variação permitida)
                  </span>
                </div>
              </div>
            )}

            {needsBinding && (
              <div className="space-y-2">
                <Label>Binding do Valor Esperado</Label>
                <Select
                  value={formData.expectedInputBinding || ''}
                  onValueChange={(value) => handleChange('expectedInputBinding', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um input esperado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {expectedInputs.map((input) => (
                      <SelectItem key={input.key} value={input.key}>
                        <div className="flex items-center gap-2">
                          <span>{input.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {input.scope === 'global' ? 'Global' : 'Por Loja'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O resultado da query será comparado com este valor informado pelo cliente
                </p>

                {needsBinding && !formData.expectedInputBinding && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Esta regra de validação requer um binding. Selecione um input esperado.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
