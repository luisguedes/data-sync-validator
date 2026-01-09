import { useState, useEffect, useCallback } from 'react';
import { Conference, ConferenceStatus, ConferenceItem, ChecklistTemplate, EmailHistoryEntry, EmailStatus } from '@/types';

const STORAGE_KEY = 'app_conferences';

// Mock initial data
const initialConferences: Conference[] = [
  {
    id: '1',
    name: 'Migração Loja Central',
    clientName: 'João Silva',
    clientEmail: 'joao@email.com',
    connectionId: '1',
    templateId: '1',
    status: 'pending',
    linkToken: 'abc123',
    linkExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    stores: [{ id: 's1', name: 'Loja Central', storeId: '001' }],
    expectedInputValues: {},
    items: [],
    emailHistory: [],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    createdBy: 'admin',
  },
  {
    id: '2',
    name: 'Validação Dados Financeiros',
    clientName: 'Maria Santos',
    clientEmail: 'maria@email.com',
    connectionId: '1',
    templateId: '2',
    status: 'in_progress',
    linkToken: 'def456',
    linkExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    stores: [{ id: 's2', name: 'Filial Norte', storeId: '002' }],
    expectedInputValues: {},
    items: [],
    emailHistory: [
      {
        id: 'e1',
        type: 'conference_link',
        to: 'maria@email.com',
        subject: 'Link para Conferência: Validação Dados Financeiros',
        status: 'sent',
        sentAt: new Date('2024-01-14T10:30:00'),
      }
    ],
    createdAt: new Date('2024-01-14'),
    updatedAt: new Date('2024-01-16'),
    createdBy: 'admin',
  },
  {
    id: '3',
    name: 'Conferência Estoque',
    clientName: 'Pedro Costa',
    clientEmail: 'pedro@email.com',
    connectionId: '2',
    templateId: '1',
    status: 'completed',
    linkToken: 'ghi789',
    linkExpiresAt: new Date('2024-01-20'),
    stores: [{ id: 's3', name: 'Matriz', storeId: '000' }],
    expectedInputValues: {},
    items: [],
    emailHistory: [
      {
        id: 'e2',
        type: 'conference_link',
        to: 'pedro@email.com',
        subject: 'Link para Conferência: Conferência Estoque',
        status: 'sent',
        sentAt: new Date('2024-01-10T09:00:00'),
      },
      {
        id: 'e3',
        type: 'completion',
        to: 'pedro@email.com',
        subject: 'Conferência Concluída: Conferência Estoque',
        status: 'sent',
        sentAt: new Date('2024-01-12T16:45:00'),
      }
    ],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-12'),
    createdBy: 'admin',
    completedAt: new Date('2024-01-12'),
  },
  {
    id: '4',
    name: 'Migração Filial Norte',
    clientName: 'Ana Oliveira',
    clientEmail: 'ana@email.com',
    connectionId: '1',
    templateId: '1',
    status: 'divergent',
    linkToken: 'jkl012',
    linkExpiresAt: new Date('2024-01-25'),
    stores: [{ id: 's4', name: 'Filial Norte', storeId: '002' }],
    expectedInputValues: {},
    items: [],
    emailHistory: [
      {
        id: 'e4',
        type: 'conference_link',
        to: 'ana@email.com',
        subject: 'Link para Conferência: Migração Filial Norte',
        status: 'failed',
        sentAt: new Date('2024-01-08T11:00:00'),
        error: 'Erro de conexão com servidor SMTP',
      }
    ],
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-10'),
    createdBy: 'admin',
  },
];

export interface ConferenceFormData {
  name: string;
  clientName: string;
  clientEmail: string;
  connectionId: string;
  templateId: string;
  stores: { id: string; name: string; storeId: string }[];
  expectedInputValues: Record<string, { value: string | number; storeId?: string }>;
  linkExpiresInDays: number;
}

function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateItemsFromTemplate(template: ChecklistTemplate, stores: { id: string; storeId: string }[]): ConferenceItem[] {
  const items: ConferenceItem[] = [];
  
  template.sections.forEach(section => {
    section.items.forEach(item => {
      if (item.scope === 'global') {
        items.push({
          id: `${item.id}_global`,
          templateItemId: item.id,
          status: 'pending',
        });
      } else {
        // per_store - create one item per store
        stores.forEach(store => {
          items.push({
            id: `${item.id}_${store.id}`,
            templateItemId: item.id,
            status: 'pending',
          });
        });
      }
    });
  });
  
  return items;
}

export function useConferences() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConferenceStatus | 'all'>('all');

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setConferences(parsed.map((c: Conference) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        linkExpiresAt: new Date(c.linkExpiresAt),
        completedAt: c.completedAt ? new Date(c.completedAt) : undefined,
      })));
    } else {
      setConferences(initialConferences);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialConferences));
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage
  const saveConferences = useCallback((newConferences: Conference[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConferences));
    setConferences(newConferences);
  }, []);

  // Create conference
  const createConference = useCallback((data: ConferenceFormData, template: ChecklistTemplate): Conference => {
    const newConference: Conference = {
      id: String(Date.now()),
      name: data.name,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      connectionId: data.connectionId,
      templateId: data.templateId,
      status: 'pending',
      linkToken: generateToken(),
      linkExpiresAt: new Date(Date.now() + data.linkExpiresInDays * 24 * 60 * 60 * 1000),
      stores: data.stores,
      expectedInputValues: data.expectedInputValues,
      items: generateItemsFromTemplate(template, data.stores),
      emailHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
    };
    
    saveConferences([...conferences, newConference]);
    return newConference;
  }, [conferences, saveConferences]);

  // Update conference
  const updateConference = useCallback((id: string, data: Partial<ConferenceFormData>): Conference | null => {
    const index = conferences.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    const updated: Conference = {
      ...conferences[index],
      ...data,
      updatedAt: new Date(),
    };
    
    const newConferences = [...conferences];
    newConferences[index] = updated;
    saveConferences(newConferences);
    return updated;
  }, [conferences, saveConferences]);

  // Delete conference
  const deleteConference = useCallback((id: string): boolean => {
    const index = conferences.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    saveConferences(conferences.filter(c => c.id !== id));
    return true;
  }, [conferences, saveConferences]);

  // Get conference by ID
  const getConference = useCallback((id: string): Conference | undefined => {
    return conferences.find(c => c.id === id);
  }, [conferences]);

  // Get conference by token
  const getConferenceByToken = useCallback((token: string): Conference | undefined => {
    return conferences.find(c => c.linkToken === token && new Date(c.linkExpiresAt) > new Date());
  }, [conferences]);

  // Update conference item
  const updateConferenceItem = useCallback((
    conferenceId: string,
    itemId: string,
    updates: Partial<ConferenceItem>
  ): Conference | null => {
    const conference = conferences.find(c => c.id === conferenceId);
    if (!conference) return null;
    
    const updatedItems = conference.items.map(item =>
      item.id === itemId ? { ...item, ...updates, respondedAt: new Date() } : item
    );
    
    // Calculate new status
    const allResponded = updatedItems.every(item => item.status !== 'pending');
    const hasDivergent = updatedItems.some(item => item.status === 'divergent' || item.userResponse === 'divergent');
    
    let newStatus: ConferenceStatus = conference.status;
    if (conference.status === 'pending' && updatedItems.some(item => item.status !== 'pending')) {
      newStatus = 'in_progress';
    }
    if (allResponded) {
      newStatus = hasDivergent ? 'divergent' : 'completed';
    }
    
    const updated: Conference = {
      ...conference,
      items: updatedItems,
      status: newStatus,
      updatedAt: new Date(),
      completedAt: allResponded ? new Date() : conference.completedAt,
    };
    
    const newConferences = conferences.map(c => c.id === conferenceId ? updated : c);
    saveConferences(newConferences);
    return updated;
  }, [conferences, saveConferences]);

  // Execute query (simulated)
  const executeQuery = useCallback(async (
    conferenceId: string,
    itemId: string,
    _query: string
  ): Promise<{ success: boolean; result?: unknown; error?: string }> => {
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // Random result simulation
    const rand = Math.random();
    if (rand < 0.1) {
      return { success: false, error: 'Erro de conexão com o banco de dados' };
    }
    
    const mockResult = rand < 0.5 
      ? { value: Math.floor(Math.random() * 1000) }
      : { rows: Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({ id: i + 1 })) };
    
    // Update item with result
    const conference = conferences.find(c => c.id === conferenceId);
    if (conference) {
      const item = conference.items.find(i => i.id === itemId);
      if (item) {
        updateConferenceItem(conferenceId, itemId, {
          queryResult: mockResult,
          executedAt: new Date(),
          status: 'auto_ok', // Will be overwritten by user response if needed
        });
      }
    }
    
    return { success: true, result: mockResult };
  }, [conferences, updateConferenceItem]);

  // Regenerate link
  const regenerateLink = useCallback((id: string, expiresInDays: number = 7): Conference | null => {
    const conference = conferences.find(c => c.id === id);
    if (!conference) return null;
    
    const updated: Conference = {
      ...conference,
      linkToken: generateToken(),
      linkExpiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    };
    
    const newConferences = conferences.map(c => c.id === id ? updated : c);
    saveConferences(newConferences);
    return updated;
  }, [conferences, saveConferences]);

  // Add email to history
  const addEmailToHistory = useCallback((
    conferenceId: string,
    emailEntry: Omit<EmailHistoryEntry, 'id'>
  ): Conference | null => {
    const conference = conferences.find(c => c.id === conferenceId);
    if (!conference) return null;

    const entry: EmailHistoryEntry = {
      ...emailEntry,
      id: `email_${Date.now()}`,
    };

    const updated: Conference = {
      ...conference,
      emailHistory: [...(conference.emailHistory || []), entry],
      updatedAt: new Date(),
    };

    const newConferences = conferences.map(c => c.id === conferenceId ? updated : c);
    saveConferences(newConferences);
    return updated;
  }, [conferences, saveConferences]);

  // Copy link to clipboard
  const copyLink = useCallback((conference: Conference): string => {
    const link = `${window.location.origin}/client/${conference.linkToken}`;
    navigator.clipboard.writeText(link);
    return link;
  }, []);

  // Stats
  const stats = {
    total: conferences.length,
    pending: conferences.filter(c => c.status === 'pending').length,
    inProgress: conferences.filter(c => c.status === 'in_progress').length,
    completed: conferences.filter(c => c.status === 'completed').length,
    divergent: conferences.filter(c => c.status === 'divergent').length,
  };

  // Filtered conferences
  const filteredConferences = conferences.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Get recent conferences (last 5)
  const recentConferences = [...conferences]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 5);

  return {
    conferences: filteredConferences,
    allConferences: conferences,
    recentConferences,
    stats,
    isLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    createConference,
    updateConference,
    deleteConference,
    getConference,
    getConferenceByToken,
    updateConferenceItem,
    executeQuery,
    regenerateLink,
    copyLink,
    addEmailToHistory,
  };
}
