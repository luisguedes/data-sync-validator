import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Store, AlertCircle } from 'lucide-react';
import { Conference, Store as StoreType, ChecklistTemplate, DbConnection, ExpectedInput } from '@/types';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConferenceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conference?: Conference | null;
  templates: ChecklistTemplate[];
  connections: DbConnection[];
  onSubmit: (data: ConferenceFormData) => void;
}

export interface ConferenceFormData {
  name: string;
  clientName: string;
  clientEmail: string;
  connectionId: string;
  templateId: string;
  stores: StoreType[];
  expectedInputValues: Record<string, { value: string | number; storeId?: string }>;
  linkExpiresInDays: number;
}

export function ConferenceFormModal({
  open,
  onOpenChange,
  conference,
  templates,
  connections,
  onSubmit,
}: ConferenceFormModalProps) {
  const [formData, setFormData] = useState<ConferenceFormData>({
    name: '',
    clientName: '',
    clientEmail: '',
    connectionId: '',
    templateId: '',
    stores: [{ id: '1', name: 'Loja Principal', storeId: '001' }],
    expectedInputValues: {},
    linkExpiresInDays: 7,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedTemplate = templates.find((t) => t.id === formData.templateId);
  const selectedConnection = connections.find((c) => c.id === formData.connectionId);

  useEffect(() => {
    if (conference) {
      setFormData({
        name: conference.name,
        clientName: conference.clientName,
        clientEmail: conference.clientEmail,
        connectionId: conference.connectionId,
        templateId: conference.templateId,
        stores: conference.stores,
        expectedInputValues: conference.expectedInputValues,
        linkExpiresInDays: 7,
      });
    } else {
      setFormData({
        name: '',
        clientName: '',
        clientEmail: '',
        connectionId: '',
        templateId: '',
        stores: [{ id: '1', name: 'Loja Principal', storeId: '001' }],
        expectedInputValues: {},
        linkExpiresInDays: 7,
      });
    }
    setErrors({});
  }, [conference, open]);

  const handleAddStore = () => {
    const newId = String(formData.stores.length + 1);
    setFormData((prev) => ({
      ...prev,
      stores: [
        ...prev.stores,
        { id: newId, name: `Loja ${newId}`, storeId: String(prev.stores.length + 1).padStart(3, '0') },
      ],
    }));
  };

  const handleRemoveStore = (storeId: string) => {
    if (formData.stores.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      stores: prev.stores.filter((s) => s.id !== storeId),
    }));
  };

  const handleStoreChange = (storeId: string, field: 'name' | 'storeId', value: string) => {
    setFormData((prev) => ({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? { ...s, [field]: value } : s)),
    }));
  };

  const handleExpectedInputChange = (key: string, value: string | number, storeId?: string) => {
    const inputKey = storeId ? `${key}_${storeId}` : key;
    setFormData((prev) => ({
      ...prev,
      expectedInputValues: {
        ...prev.expectedInputValues,
        [inputKey]: { value, storeId },
      },
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!formData.clientName.trim()) newErrors.clientName = 'Nome do cliente é obrigatório';
    if (!formData.clientEmail.trim()) newErrors.clientEmail = 'Email do cliente é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail))
      newErrors.clientEmail = 'Email inválido';
    if (!formData.connectionId) newErrors.connectionId = 'Selecione uma conexão';
    if (!formData.templateId) newErrors.templateId = 'Selecione um template';

    // Validate stores
    formData.stores.forEach((store, index) => {
      if (!store.name.trim()) newErrors[`store_${index}_name`] = 'Nome da loja é obrigatório';
      if (!store.storeId.trim()) newErrors[`store_${index}_id`] = 'ID da loja é obrigatório';
    });

    // Validate required expected inputs
    if (selectedTemplate) {
      selectedTemplate.expectedInputs.forEach((input) => {
        if (input.required) {
          if (input.scope === 'global') {
            const value = formData.expectedInputValues[input.key];
            if (!value || !String(value.value).trim()) {
              newErrors[`input_${input.key}`] = `${input.label} é obrigatório`;
            }
          } else {
            formData.stores.forEach((store) => {
              const key = `${input.key}_${store.id}`;
              const value = formData.expectedInputValues[key];
              if (!value || !String(value.value).trim()) {
                newErrors[`input_${key}`] = `${input.label} é obrigatório para ${store.name}`;
              }
            });
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
      onOpenChange(false);
    }
  };

  const renderExpectedInputField = (input: ExpectedInput, storeId?: string) => {
    const key = storeId ? `${input.key}_${storeId}` : input.key;
    const value = formData.expectedInputValues[key]?.value || '';
    const error = errors[`input_${key}`];

    return (
      <div key={key} className="space-y-1">
        <Label className="text-sm">
          {input.label}
          {input.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          type={input.type === 'number' || input.type === 'currency' ? 'number' : 'text'}
          placeholder={input.hint || `Digite ${input.label.toLowerCase()}`}
          value={value}
          onChange={(e) => {
            const val = input.type === 'number' || input.type === 'currency' 
              ? parseFloat(e.target.value) || '' 
              : e.target.value;
            handleExpectedInputChange(input.key, val, storeId);
          }}
          className={error ? 'border-destructive' : ''}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{conference ? 'Editar Conferência' : 'Nova Conferência'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome da Conferência <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Migração Loja Central"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkExpires">Validade do Link (dias)</Label>
              <Input
                id="linkExpires"
                type="number"
                min={1}
                max={30}
                value={formData.linkExpiresInDays}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, linkExpiresInDays: parseInt(e.target.value) || 7 }))
                }
              />
            </div>
          </div>

          {/* Client Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">
                  Nome do Cliente <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => setFormData((p) => ({ ...p, clientName: e.target.value }))}
                  placeholder="João Silva"
                  className={errors.clientName ? 'border-destructive' : ''}
                />
                {errors.clientName && <p className="text-xs text-destructive">{errors.clientName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientEmail">
                  Email do Cliente <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData((p) => ({ ...p, clientEmail: e.target.value }))}
                  placeholder="joao@email.com"
                  className={errors.clientEmail ? 'border-destructive' : ''}
                />
                {errors.clientEmail && <p className="text-xs text-destructive">{errors.clientEmail}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Connection & Template */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Conexão <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.connectionId}
                onValueChange={(v) => setFormData((p) => ({ ...p, connectionId: v }))}
              >
                <SelectTrigger className={errors.connectionId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent>
                  {connections.filter((c) => c.status === 'active').map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.connectionId && <p className="text-xs text-destructive">{errors.connectionId}</p>}
              {selectedConnection && (
                <p className="text-xs text-muted-foreground">
                  {selectedConnection.host}:{selectedConnection.port} / {selectedConnection.database}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Template <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.templateId}
                onValueChange={(v) => setFormData((p) => ({ ...p, templateId: v, expectedInputValues: {} }))}
              >
                <SelectTrigger className={errors.templateId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} (v{t.version})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.templateId && <p className="text-xs text-destructive">{errors.templateId}</p>}
              {selectedTemplate && (
                <p className="text-xs text-muted-foreground">
                  {selectedTemplate.sections.length} seções,{' '}
                  {selectedTemplate.sections.reduce((acc, s) => acc + s.items.length, 0)} itens
                </p>
              )}
            </div>
          </div>

          {/* Stores */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" />
                Lojas
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={handleAddStore}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Loja
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.stores.map((store, index) => (
                <div key={store.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Badge variant="secondary" className="mt-1">{index + 1}</Badge>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome da Loja</Label>
                      <Input
                        value={store.name}
                        onChange={(e) => handleStoreChange(store.id, 'name', e.target.value)}
                        placeholder="Nome da loja"
                        className={errors[`store_${index}_name`] ? 'border-destructive' : ''}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">ID da Loja (para queries)</Label>
                      <Input
                        value={store.storeId}
                        onChange={(e) => handleStoreChange(store.id, 'storeId', e.target.value)}
                        placeholder="001"
                        className={errors[`store_${index}_id`] ? 'border-destructive' : ''}
                      />
                    </div>
                  </div>
                  {formData.stores.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveStore(store.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Expected Inputs */}
          {selectedTemplate && selectedTemplate.expectedInputs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Valores Esperados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Global inputs */}
                {selectedTemplate.expectedInputs.filter((i) => i.scope === 'global').length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Valores Globais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedTemplate.expectedInputs
                        .filter((i) => i.scope === 'global')
                        .map((input) => renderExpectedInputField(input))}
                    </div>
                  </div>
                )}

                {/* Per-store inputs */}
                {selectedTemplate.expectedInputs.filter((i) => i.scope === 'per_store').length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Valores por Loja</h4>
                    {formData.stores.map((store) => (
                      <div key={store.id} className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{store.name}</span>
                          <Badge variant="outline" className="text-xs">{store.storeId}</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedTemplate.expectedInputs
                            .filter((i) => i.scope === 'per_store')
                            .map((input) => renderExpectedInputField(input, store.id))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {Object.keys(errors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Corrija os erros acima antes de salvar.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{conference ? 'Salvar Alterações' : 'Criar Conferência'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
