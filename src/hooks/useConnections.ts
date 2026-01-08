import { useState, useEffect, useCallback } from 'react';
import { DbConnection } from '@/types';

const STORAGE_KEY = 'app_connections';

// Mock initial data
const initialConnections: DbConnection[] = [
  {
    id: '1',
    name: 'Produção - Loja Central',
    host: '192.168.1.100',
    port: 5432,
    database: 'loja_central',
    username: 'app_user',
    password: '***',
    status: 'active',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    createdBy: 'admin',
  },
  {
    id: '2',
    name: 'Homologação',
    host: '192.168.1.50',
    port: 5432,
    database: 'homolog_db',
    username: 'homolog_user',
    password: '***',
    status: 'active',
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-08'),
    createdBy: 'admin',
  },
];

export interface ConnectionFormData {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export function useConnections() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Load connections from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setConnections(parsed.map((c: DbConnection) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      })));
    } else {
      setConnections(initialConnections);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialConnections));
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage whenever connections change
  const saveConnections = useCallback((newConnections: DbConnection[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConnections));
    setConnections(newConnections);
  }, []);

  // Create connection
  const createConnection = useCallback((data: ConnectionFormData): DbConnection => {
    const newConnection: DbConnection = {
      id: crypto.randomUUID(),
      ...data,
      status: 'inactive',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'current_user',
    };
    saveConnections([...connections, newConnection]);
    return newConnection;
  }, [connections, saveConnections]);

  // Update connection
  const updateConnection = useCallback((id: string, data: Partial<ConnectionFormData>): DbConnection | null => {
    const index = connections.findIndex(c => c.id === id);
    if (index === -1) return null;

    const updated: DbConnection = {
      ...connections[index],
      ...data,
      updatedAt: new Date(),
    };
    const newConnections = [...connections];
    newConnections[index] = updated;
    saveConnections(newConnections);
    return updated;
  }, [connections, saveConnections]);

  // Delete connection
  const deleteConnection = useCallback((id: string): boolean => {
    const newConnections = connections.filter(c => c.id !== id);
    if (newConnections.length === connections.length) return false;
    saveConnections(newConnections);
    return true;
  }, [connections, saveConnections]);

  // Test connection (mock)
  const testConnection = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const connection = connections.find(c => c.id === id);
    if (!connection) {
      return { success: false, message: 'Conexão não encontrada' };
    }

    // Simulate random success/failure for demo
    const success = Math.random() > 0.3;
    
    // Update status
    const newConnections = connections.map(c => 
      c.id === id 
        ? { ...c, status: success ? 'active' as const : 'error' as const, updatedAt: new Date() }
        : c
    );
    saveConnections(newConnections);

    return {
      success,
      message: success 
        ? 'Conexão estabelecida com sucesso!' 
        : 'Falha ao conectar. Verifique as credenciais.',
    };
  }, [connections, saveConnections]);

  // Test connection with form data (before saving)
  const testConnectionData = useCallback(async (data: ConnectionFormData): Promise<{ success: boolean; message: string }> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const success = Math.random() > 0.3;
    return {
      success,
      message: success 
        ? 'Conexão estabelecida com sucesso!' 
        : 'Falha ao conectar. Verifique as credenciais.',
    };
  }, []);

  // Filtered connections
  const filteredConnections = connections.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.database.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return {
    connections: filteredConnections,
    allConnections: connections,
    isLoading,
    searchTerm,
    setSearchTerm,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    testConnectionData,
  };
}
