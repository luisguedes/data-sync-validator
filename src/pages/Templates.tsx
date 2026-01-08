import { useState } from 'react';
import { Plus, Search, MoreHorizontal, FileText, Copy, Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTemplates } from '@/hooks/useTemplates';
import { TemplateFormModal } from '@/components/templates/TemplateFormModal';
import { ImportTemplateModal } from '@/components/templates/ImportTemplateModal';
import { DeleteTemplateDialog } from '@/components/templates/DeleteTemplateDialog';
import { ChecklistTemplate } from '@/types';
import { toast } from 'sonner';

export default function Templates() {
  const {
    templates,
    isLoading,
    searchTerm,
    setSearchTerm,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    importFromJson,
    exportToJson,
  } = useTemplates();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const handleCreate = () => {
    setSelectedTemplate(null);
    setModalMode('create');
    setIsFormModalOpen(true);
  };

  const handleEdit = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    setModalMode('edit');
    setIsFormModalOpen(true);
  };

  const handleDelete = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (data: { name: string; description: string; version: string }) => {
    if (modalMode === 'create') {
      createTemplate({
        ...data,
        expectedInputs: [],
        sections: [],
      });
      toast.success('Template criado com sucesso!');
    } else if (selectedTemplate) {
      updateTemplate(selectedTemplate.id, data);
      toast.success('Template atualizado com sucesso!');
    }
  };

  const handleConfirmDelete = () => {
    if (selectedTemplate) {
      deleteTemplate(selectedTemplate.id);
      toast.success('Template excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      setSelectedTemplate(null);
    }
  };

  const handleDuplicate = (template: ChecklistTemplate) => {
    const duplicated = duplicateTemplate(template.id);
    if (duplicated) {
      toast.success(`Template "${duplicated.name}" criado com sucesso!`);
    }
  };

  const handleExport = (template: ChecklistTemplate) => {
    const json = exportToJson(template.id);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/\s+/g, '_').toLowerCase()}_v${template.version}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Template exportado com sucesso!');
    }
  };

  const handleImport = (json: string) => {
    const result = importFromJson(json);
    if (result.success) {
      toast.success(`Template "${result.template?.name}" importado com sucesso!`);
    }
    return result;
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
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground">
            Gerencie os modelos de checklist para conferências
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar JSON
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-secondary/10">
                  <FileText className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{template.name}</CardTitle>
                    <Badge variant="outline">v{template.version}</Badge>
                  </div>
                  <CardDescription className="mt-1">{template.description}</CardDescription>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(template)}>
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport(template)}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDelete(template)}
                  >
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">{template.sections.length}</span>
                  <span>seções</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">
                    {template.sections.reduce((acc, s) => acc + s.items.length, 0)}
                  </span>
                  <span>itens</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">
                    {template.expectedInputs.length}
                  </span>
                  <span>inputs esperados</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Atualizado em</span>
                  <span className="font-medium text-foreground">
                    {template.updatedAt.toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {templates.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum template encontrado</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchTerm
              ? 'Tente ajustar sua busca.'
              : 'Comece criando ou importando um template.'}
          </p>
          {!searchTerm && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importar JSON
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Template
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <TemplateFormModal
        open={isFormModalOpen}
        onOpenChange={setIsFormModalOpen}
        onSubmit={handleSubmit}
        template={selectedTemplate}
        mode={modalMode}
      />

      <ImportTemplateModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImport={handleImport}
      />

      <DeleteTemplateDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        template={selectedTemplate}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
