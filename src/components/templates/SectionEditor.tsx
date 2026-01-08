import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, GripVertical, Trash2, Edit, Code, Settings, AlertCircle, AlertTriangle } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

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

export interface ItemValidationIssue {
  type: 'error' | 'warning';
  message: string;
}

export function validateItem(item: TemplateItem, expectedInputs: ExpectedInput[]): ItemValidationIssue[] {
  const issues: ItemValidationIssue[] = [];

  // Check for empty or invalid query
  if (!item.query.trim()) {
    issues.push({ type: 'error', message: 'Query SQL está vazia' });
  } else if (!item.query.toUpperCase().trim().startsWith('SELECT')) {
    issues.push({ type: 'error', message: 'Query deve começar com SELECT' });
  }

  // Check for missing binding when required
  const needsBinding = ['number_equals_expected', 'number_matches_expected_with_tolerance'].includes(item.validationRule.type);
  if (needsBinding && !item.expectedInputBinding) {
    issues.push({ type: 'error', message: 'Binding de input esperado é obrigatório para esta regra de validação' });
  }

  // Check if binding references a valid expected input
  if (item.expectedInputBinding) {
    const bindingExists = expectedInputs.some(input => input.key === item.expectedInputBinding);
    if (!bindingExists) {
      issues.push({ type: 'error', message: `Input esperado "${item.expectedInputBinding}" não existe` });
    }
  }

  // Warning for missing title
  if (!item.title.trim()) {
    issues.push({ type: 'warning', message: 'Item sem título' });
  }

  // Warning for missing description
  if (!item.description.trim()) {
    issues.push({ type: 'warning', message: 'Item sem descrição' });
  }

  return issues;
}

const validationLabels: Record<string, string> = {
  single_number_required: 'Número único',
  must_return_rows: 'Deve retornar linhas',
  must_return_no_rows: 'Não deve retornar linhas',
  number_equals_expected: 'Igual ao esperado',
  number_matches_expected_with_tolerance: 'Tolerância',
};

interface SortableItemRowProps {
  item: TemplateItem;
  onEditItem: (item: TemplateItem) => void;
  onDeleteItem: (itemId: string) => void;
  getBindingLabel: (binding?: string) => string | null;
  expectedInputs: ExpectedInput[];
}

function SortableItemRow({ item, onEditItem, onDeleteItem, getBindingLabel, expectedInputs }: SortableItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const issues = validateItem(item, expectedInputs);
  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors group',
        isDragging && 'z-50 opacity-90 shadow-lg ring-2 ring-primary/20',
        hasErrors && 'border-destructive/50 bg-destructive/5',
        !hasErrors && hasWarnings && 'border-yellow-500/50 bg-yellow-500/5'
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none p-0.5 hover:bg-muted rounded mt-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.title || <span className="text-muted-foreground italic">Sem título</span>}</span>
          <Badge variant="secondary" className="text-xs">
            {item.scope === 'global' ? 'Global' : 'Por Loja'}
          </Badge>
          {item.autoResolve && (
            <Badge variant="outline" className="text-xs text-status-completed">
              Auto-resolve
            </Badge>
          )}
          {(hasErrors || hasWarnings) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    {hasErrors && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    {!hasErrors && hasWarnings && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-1">
                    {errors.map((issue, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        <span className="text-xs">{issue.message}</span>
                      </div>
                    ))}
                    {warnings.map((issue, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        <span className="text-xs">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {item.description || <span className="italic">Sem descrição</span>}
        </p>
        
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          <div className={cn(
            "flex items-center gap-1",
            !item.query.trim() ? "text-destructive" : "text-muted-foreground"
          )}>
            <Code className="h-3 w-3" />
            <span className="font-mono truncate max-w-[200px]">
              {item.query.trim() ? `${item.query.slice(0, 40)}...` : 'Query vazia'}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            <Settings className="h-3 w-3 mr-1" />
            {validationLabels[item.validationRule.type] || item.validationRule.type}
          </Badge>
          {item.expectedInputBinding && (
            <Badge className={cn(
              "text-xs",
              expectedInputs.some(i => i.key === item.expectedInputBinding)
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "bg-destructive/10 text-destructive hover:bg-destructive/20"
            )}>
              → {getBindingLabel(item.expectedInputBinding) || `${item.expectedInputBinding} (não encontrado)`}
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
          onClick={() => onDeleteItem(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = section.items.findIndex(item => item.id === active.id);
      const newIndex = section.items.findIndex(item => item.id === over.id);

      const newItems = arrayMove(section.items, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        order: idx + 1,
      }));

      onUpdate({ items: newItems });
    }
  };

  // Calculate section-level validation issues
  const sectionIssues = section.items.flatMap(item => validateItem(item, expectedInputs));
  const sectionErrors = sectionIssues.filter(i => i.type === 'error').length;
  const sectionWarnings = sectionIssues.filter(i => i.type === 'warning').length;

  return (
    <>
      <Card className={cn(
        "overflow-hidden",
        sectionErrors > 0 && "border-destructive/30",
        sectionErrors === 0 && sectionWarnings > 0 && "border-yellow-500/30"
      )}>
        <Collapsible open={isExpanded} onOpenChange={onToggle}>
          <CardHeader className="p-0">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                
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
                        {sectionErrors > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {sectionErrors} erro{sectionErrors > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {sectionErrors === 0 && sectionWarnings > 0 && (
                          <Badge className="text-xs bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {sectionWarnings} aviso{sectionWarnings > 1 ? 's' : ''}
                          </Badge>
                        )}
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
              <div className="space-y-2 ml-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={section.items.map(item => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {section.items.map((item) => (
                      <SortableItemRow
                        key={item.id}
                        item={item}
                        onEditItem={onEditItem}
                        onDeleteItem={(id) => setDeleteItemId(id)}
                        getBindingLabel={getBindingLabel}
                        expectedInputs={expectedInputs}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

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
