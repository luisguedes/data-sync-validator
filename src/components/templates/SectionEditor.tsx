import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, GripVertical, Trash2, Edit, Code, Settings, AlertCircle } from 'lucide-react';
import { TemplateSection, TemplateItem, ExpectedInput } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

interface SectionEditorProps {
  section: TemplateSection;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (data: Partial<TemplateSection>) => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: TemplateItem) => void;
  onDeleteItem: (itemId: string) => void;
  expectedInputs: ExpectedInput[];
}

const validationLabels: Record<string, string> = {
  single_number_required: 'Número único',
  must_return_rows: 'Deve retornar linhas',
  must_return_no_rows: 'Não deve retornar linhas',
  number_equals_expected: 'Igual ao esperado',
  number_matches_expected_with_tolerance: 'Tolerância',
};

export function SectionEditor({
  section,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
  expectedInputs,
}: SectionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);
  const [editKey, setEditKey] = useState(section.key);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const handleSaveEdit = () => {
    onUpdate({ title: editTitle, key: editKey });
    setIsEditing(false);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setDeleteDialogOpen(false);
  };

  const handleConfirmDeleteItem = () => {
    if (deleteItemId) {
      onDeleteItem(deleteItemId);
      setDeleteItemId(null);
    }
  };

  const getBindingLabel = (binding?: string) => {
    if (!binding) return null;
    const input = expectedInputs.find(i => i.key === binding);
    return input?.label || binding;
  };

  return (
    <>
      <Card className="overflow-hidden">
        <Collapsible open={isExpanded} onOpenChange={onToggle}>
          <CardHeader className="p-0">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Título da seção"
                      className="h-8"
                    />
                    <Input
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                      placeholder="Chave"
                      className="h-8 w-32"
                    />
                    <Button size="sm" onClick={handleSaveEdit}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{section.title}</span>
                        <Badge variant="outline" className="text-xs font-mono">{section.key}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {section.items.length} {section.items.length === 1 ? 'item' : 'itens'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="space-y-2 ml-7">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors group"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.title}</span>
                        <Badge variant="secondary" className="text-xs">
                          {item.scope === 'global' ? 'Global' : 'Por Loja'}
                        </Badge>
                        {item.autoResolve && (
                          <Badge variant="outline" className="text-xs text-status-completed">
                            Auto-resolve
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Code className="h-3 w-3" />
                          <span className="font-mono truncate max-w-[200px]">{item.query.slice(0, 40)}...</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          <Settings className="h-3 w-3 mr-1" />
                          {validationLabels[item.validationRule.type] || item.validationRule.type}
                        </Badge>
                        {item.expectedInputBinding && (
                          <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/20">
                            → {getBindingLabel(item.expectedInputBinding)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => onEditItem(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteItemId(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={onAddItem}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Item
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Delete Section Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Excluir Seção
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a seção "{section.title}"? 
              Isso também excluirá todos os {section.items.length} itens contidos nela.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item Dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Excluir Item
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteItem}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
