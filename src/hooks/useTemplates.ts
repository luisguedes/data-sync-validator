import { useState, useEffect, useCallback } from 'react';
import { ChecklistTemplate, TemplateSection, ExpectedInput } from '@/types';

const STORAGE_KEY = 'app_templates';

// Mock initial data based on v2.1 structure
const initialTemplates: ChecklistTemplate[] = [
  {
    id: '1',
    name: 'Migração Completa v2.1',
    description: 'Template completo para validação de migração de dados financeiros e operacionais',
    version: '2.1.0',
    expectedInputs: [
      { key: 'valor_total_vendas', label: 'Valor Total de Vendas', type: 'currency', scope: 'global', required: true },
      { key: 'qtd_clientes', label: 'Quantidade de Clientes', type: 'number', scope: 'global', required: true },
      { key: 'saldo_caixa', label: 'Saldo em Caixa', type: 'currency', scope: 'per_store', required: true },
    ],
    sections: [
      {
        id: 's1',
        key: 'financeiro',
        title: 'Dados Financeiros',
        order: 1,
        items: [
          {
            id: 'i1',
            key: 'total_vendas',
            title: 'Total de Vendas',
            description: 'Verifica se o total de vendas migrado corresponde ao esperado',
            order: 1,
            query: 'SELECT SUM(valor) as total FROM vendas WHERE data >= :data_inicio',
            validationRule: { type: 'number_equals_expected' },
            scope: 'global',
            expectedInputBinding: 'valor_total_vendas',
            autoResolve: true,
          },
          {
            id: 'i2',
            key: 'saldo_caixa_item',
            title: 'Saldo em Caixa por Loja',
            description: 'Verifica o saldo de caixa de cada loja',
            order: 2,
            query: 'SELECT saldo FROM caixa WHERE loja_id = :store_id',
            validationRule: { type: 'number_matches_expected_with_tolerance', tolerance: 0.01 },
            scope: 'per_store',
            expectedInputBinding: 'saldo_caixa',
            autoResolve: true,
          },
        ],
      },
      {
        id: 's2',
        key: 'clientes',
        title: 'Dados de Clientes',
        order: 2,
        items: [
          {
            id: 'i3',
            key: 'qtd_clientes_item',
            title: 'Quantidade de Clientes',
            description: 'Verifica a quantidade total de clientes migrados',
            order: 1,
            query: 'SELECT COUNT(*) as total FROM clientes WHERE ativo = true',
            validationRule: { type: 'number_equals_expected' },
            scope: 'global',
            expectedInputBinding: 'qtd_clientes',
            autoResolve: true,
          },
        ],
      },
    ],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
    createdBy: 'admin',
  },
  {
    id: '2',
    name: 'Validação Financeira',
    description: 'Template focado em dados financeiros: saldos, movimentações, contas',
    version: '1.0.0',
    expectedInputs: [
      { key: 'saldo_total', label: 'Saldo Total', type: 'currency', scope: 'global', required: true },
    ],
    sections: [
      {
        id: 's3',
        key: 'saldos',
        title: 'Saldos',
        order: 1,
        items: [
          {
            id: 'i4',
            key: 'saldo_geral',
            title: 'Saldo Geral',
            description: 'Verifica o saldo geral do sistema',
            order: 1,
            query: 'SELECT SUM(saldo) as total FROM contas',
            validationRule: { type: 'number_equals_expected' },
            scope: 'global',
            expectedInputBinding: 'saldo_total',
            autoResolve: true,
          },
        ],
      },
    ],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
    createdBy: 'admin',
  },
];

export interface TemplateFormData {
  name: string;
  description: string;
  version: string;
  expectedInputs: ExpectedInput[];
  sections: TemplateSection[];
}

export function useTemplates() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Load templates from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setTemplates(parsed.map((t: ChecklistTemplate) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      })));
    } else {
      setTemplates(initialTemplates);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTemplates));
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage
  const saveTemplates = useCallback((newTemplates: ChecklistTemplate[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates));
    setTemplates(newTemplates);
  }, []);

  // Create template
  const createTemplate = useCallback((data: TemplateFormData): ChecklistTemplate => {
    const newTemplate: ChecklistTemplate = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'current_user',
    };
    saveTemplates([...templates, newTemplate]);
    return newTemplate;
  }, [templates, saveTemplates]);

  // Update template
  const updateTemplate = useCallback((id: string, data: Partial<TemplateFormData>): ChecklistTemplate | null => {
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) return null;

    const updated: ChecklistTemplate = {
      ...templates[index],
      ...data,
      updatedAt: new Date(),
    };
    const newTemplates = [...templates];
    newTemplates[index] = updated;
    saveTemplates(newTemplates);
    return updated;
  }, [templates, saveTemplates]);

  // Delete template
  const deleteTemplate = useCallback((id: string): boolean => {
    const newTemplates = templates.filter(t => t.id !== id);
    if (newTemplates.length === templates.length) return false;
    saveTemplates(newTemplates);
    return true;
  }, [templates, saveTemplates]);

  // Duplicate template
  const duplicateTemplate = useCallback((id: string): ChecklistTemplate | null => {
    const template = templates.find(t => t.id === id);
    if (!template) return null;

    const duplicated: ChecklistTemplate = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} (Cópia)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      sections: template.sections.map(s => ({
        ...s,
        id: crypto.randomUUID(),
        items: s.items.map(i => ({ ...i, id: crypto.randomUUID() })),
      })),
    };
    saveTemplates([...templates, duplicated]);
    return duplicated;
  }, [templates, saveTemplates]);

  // Import from JSON
  const importFromJson = useCallback((jsonString: string): { success: boolean; template?: ChecklistTemplate; error?: string } => {
    try {
      const data = JSON.parse(jsonString);
      
      // Validate basic structure
      if (!data.name || !data.sections) {
        return { success: false, error: 'JSON inválido: faltam campos obrigatórios (name, sections)' };
      }

      const template: ChecklistTemplate = {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description || '',
        version: data.version || '1.0.0',
        expectedInputs: data.expected_inputs || data.expectedInputs || [],
        sections: (data.sections || []).map((s: TemplateSection, idx: number) => ({
          id: crypto.randomUUID(),
          key: s.key || `section_${idx}`,
          title: s.title,
          order: s.order || idx + 1,
          items: (s.items || []).map((i: any, iidx: number) => ({
            id: crypto.randomUUID(),
            key: i.key || `item_${iidx}`,
            title: i.title,
            description: i.description || '',
            order: i.order || iidx + 1,
            query: i.query || '',
            validationRule: i.validation_rule || i.validationRule || { type: 'single_number_required' },
            scope: i.scope || 'global',
            expectedInputBinding: i.expected_input_binding || i.expectedInputBinding,
            autoResolve: i.auto_resolve ?? i.autoResolve ?? true,
          })),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'current_user',
      };

      saveTemplates([...templates, template]);
      return { success: true, template };
    } catch (e) {
      return { success: false, error: 'Erro ao parsear JSON: formato inválido' };
    }
  }, [templates, saveTemplates]);

  // Export to JSON
  const exportToJson = useCallback((id: string): string | null => {
    const template = templates.find(t => t.id === id);
    if (!template) return null;

    const exportData = {
      name: template.name,
      description: template.description,
      version: template.version,
      expected_inputs: template.expectedInputs.map(ei => ({
        key: ei.key,
        label: ei.label,
        type: ei.type,
        scope: ei.scope,
        required: ei.required,
        hint: ei.hint,
      })),
      sections: template.sections.map(s => ({
        key: s.key,
        title: s.title,
        order: s.order,
        items: s.items.map(i => ({
          key: i.key,
          title: i.title,
          description: i.description,
          order: i.order,
          query: i.query,
          validation_rule: i.validationRule,
          scope: i.scope,
          expected_input_binding: i.expectedInputBinding,
          auto_resolve: i.autoResolve,
        })),
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }, [templates]);

  // Get template by ID
  const getTemplate = useCallback((id: string): ChecklistTemplate | undefined => {
    return templates.find(t => t.id === id);
  }, [templates]);

  // Filtered templates
  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return {
    templates: filteredTemplates,
    allTemplates: templates,
    isLoading,
    searchTerm,
    setSearchTerm,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    importFromJson,
    exportToJson,
    getTemplate,
  };
}
