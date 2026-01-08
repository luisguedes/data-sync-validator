import { useState } from 'react';
import { Plus, Save, GripVertical } from 'lucide-react';
import { ChecklistTemplate, TemplateSection, TemplateItem, ExpectedInput } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionEditor } from './SectionEditor';
import { ItemEditorModal } from './ItemEditorModal';
import { ExpectedInputsEditor } from './ExpectedInputsEditor';
import { toast } from 'sonner';
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

interface TemplateEditorProps {
  template: ChecklistTemplate;
  onSave: (template: ChecklistTemplate) => void;
  onCancel: () => void;
}

interface SortableSectionWrapperProps {
  section: TemplateSection;
  children: React.ReactNode;
}

function SortableSectionWrapper({ section, children }: SortableSectionWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging && 'z-50 opacity-90 shadow-lg'
      )}
    >
      <div
        className="absolute left-0 top-4 z-10 cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div className="pl-8">
        {children}
      </div>
    </div>
  );
}

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [editedTemplate, setEditedTemplate] = useState<ChecklistTemplate>({ ...template });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(template.sections.map(s => s.id)));
  const [editingItem, setEditingItem] = useState<{ sectionId: string; item: TemplateItem } | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

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

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleBasicInfoChange = (field: keyof ChecklistTemplate, value: string) => {
    setEditedTemplate(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSection = () => {
    const newSection: TemplateSection = {
      id: crypto.randomUUID(),
      key: `section_${editedTemplate.sections.length + 1}`,
      title: 'Nova Seção',
      order: editedTemplate.sections.length + 1,
      items: [],
    };
    setEditedTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setExpandedSections(prev => new Set([...prev, newSection.id]));
  };

  const handleUpdateSection = (sectionId: string, data: Partial<TemplateSection>) => {
    setEditedTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId ? { ...s, ...data } : s
      ),
    }));
  };

  const handleDeleteSection = (sectionId: string) => {
    setEditedTemplate(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId),
    }));
  };

  const handleAddItem = (sectionId: string) => {
    const section = editedTemplate.sections.find(s => s.id === sectionId);
    if (!section) return;

    const newItem: TemplateItem = {
      id: crypto.randomUUID(),
      key: `item_${section.items.length + 1}`,
      title: 'Novo Item',
      description: 'Descrição do item',
      order: section.items.length + 1,
      query: 'SELECT COUNT(*) FROM tabela',
      validationRule: { type: 'single_number_required' },
      scope: 'global',
      autoResolve: true,
    };

    setEditingItem({ sectionId, item: newItem });
    setIsItemModalOpen(true);
  };

  const handleEditItem = (sectionId: string, item: TemplateItem) => {
    setEditingItem({ sectionId, item: { ...item } });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = (item: TemplateItem) => {
    if (!editingItem) return;

    setEditedTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== editingItem.sectionId) return s;
        
        const existingIndex = s.items.findIndex(i => i.id === item.id);
        if (existingIndex >= 0) {
          // Update existing item
          const newItems = [...s.items];
          newItems[existingIndex] = item;
          return { ...s, items: newItems };
        } else {
          // Add new item
          return { ...s, items: [...s.items, item] };
        }
      }),
    }));
    setIsItemModalOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (sectionId: string, itemId: string) => {
    setEditedTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId 
          ? { ...s, items: s.items.filter(i => i.id !== itemId) }
          : s
      ),
    }));
  };

  const handleExpectedInputsChange = (inputs: ExpectedInput[]) => {
    setEditedTemplate(prev => ({ ...prev, expectedInputs: inputs }));
  };

  const handleSave = () => {
    if (!editedTemplate.name.trim()) {
      toast.error('Nome do template é obrigatório');
      return;
    }
    onSave(editedTemplate);
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = editedTemplate.sections.findIndex(s => s.id === active.id);
      const newIndex = editedTemplate.sections.findIndex(s => s.id === over.id);

      const newSections = arrayMove(editedTemplate.sections, oldIndex, newIndex).map((section, idx) => ({
        ...section,
        order: idx + 1,
      }));

      setEditedTemplate(prev => ({
        ...prev,
        sections: newSections,
      }));
    }
  };

  const totalItems = editedTemplate.sections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Editar Template</h1>
          <p className="text-muted-foreground">Configure seções, itens e regras de validação. Arraste para reordenar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Salvar Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="structure" className="space-y-4">
        <TabsList>
          <TabsTrigger value="structure">Estrutura</TabsTrigger>
          <TabsTrigger value="inputs">Inputs Esperados ({editedTemplate.expectedInputs.length})</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>

        {/* Structure Tab */}
        <TabsContent value="structure" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span><strong className="text-foreground">{editedTemplate.sections.length}</strong> seções</span>
              <span><strong className="text-foreground">{totalItems}</strong> itens</span>
            </div>
            <Button onClick={handleAddSection}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Seção
            </Button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext
              items={editedTemplate.sections.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {editedTemplate.sections.map((section, index) => (
                  <SortableSectionWrapper key={section.id} section={section}>
                    <SectionEditor
                      section={section}
                      index={index}
                      isExpanded={expandedSections.has(section.id)}
                      onToggle={() => toggleSection(section.id)}
                      onUpdate={(data) => handleUpdateSection(section.id, data)}
                      onDelete={() => handleDeleteSection(section.id)}
                      onAddItem={() => handleAddItem(section.id)}
                      onEditItem={(item) => handleEditItem(section.id, item)}
                      onDeleteItem={(itemId) => handleDeleteItem(section.id, itemId)}
                      expectedInputs={editedTemplate.expectedInputs}
                    />
                  </SortableSectionWrapper>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {editedTemplate.sections.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">Nenhuma seção criada</p>
                <Button variant="outline" onClick={handleAddSection}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeira seção
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Expected Inputs Tab */}
        <TabsContent value="inputs">
          <ExpectedInputsEditor
            inputs={editedTemplate.expectedInputs}
            onChange={handleExpectedInputsChange}
          />
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Template</label>
                  <Input
                    value={editedTemplate.name}
                    onChange={(e) => handleBasicInfoChange('name', e.target.value)}
                    placeholder="Ex: Migração Completa"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Versão</label>
                  <Input
                    value={editedTemplate.version}
                    onChange={(e) => handleBasicInfoChange('version', e.target.value)}
                    placeholder="Ex: 1.0.0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Input
                  value={editedTemplate.description}
                  onChange={(e) => handleBasicInfoChange('description', e.target.value)}
                  placeholder="Descrição do template"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Item Editor Modal */}
      <ItemEditorModal
        open={isItemModalOpen}
        onOpenChange={setIsItemModalOpen}
        item={editingItem?.item || null}
        expectedInputs={editedTemplate.expectedInputs}
        onSave={handleSaveItem}
      />
    </div>
  );
}
