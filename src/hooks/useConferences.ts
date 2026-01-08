import { useState, useEffect, useCallback } from 'react';
import { Conference, ConferenceStatus } from '@/types';

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
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-10'),
    createdBy: 'admin',
  },
];

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
  };
}
