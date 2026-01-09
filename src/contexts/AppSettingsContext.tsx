import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AppSettings, DatabaseConfig, SmtpConfig, AppPreferences } from '@/types';

interface DatabaseTestResult {
  success: boolean;
  message: string;
  databaseExists?: boolean;
  permissions?: {
    canCreateDb: boolean;
    isSuperuser: boolean;
    username?: string;
  };
  warning?: string;
}

interface DatabaseInitResult {
  success: boolean;
  message: string;
  tables?: string[];
  schemaVersion?: string;
  backup?: {
    fileName?: string;
    size?: number;
    error?: string;
  };
}

interface AppSettingsContextType {
  settings: AppSettings;
  isLoading: boolean;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  updateDatabaseConfig: (config: DatabaseConfig) => Promise<boolean>;
  updateSmtpConfig: (config: SmtpConfig) => Promise<boolean>;
  updatePreferences: (prefs: AppPreferences) => Promise<boolean>;
  completeSetup: () => Promise<void>;
  testDatabaseConnection: (config: DatabaseConfig) => Promise<DatabaseTestResult>;
  testSmtpConnection: (config: SmtpConfig) => Promise<{ success: boolean; message: string }>;
  initializeDatabase: (config: DatabaseConfig) => Promise<DatabaseInitResult>;
  refreshSettings: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const defaultSettings: AppSettings = {
  isConfigured: false,
  database: null,
  smtp: null,
  preferences: null,
};

// Get backend URL from localStorage or auto-detect
// In production with nginx proxy, use relative URL (empty string)
// In development, use localhost:3001
const getStoredBackendUrl = () => {
  const stored = localStorage.getItem('backend_url');
  if (stored) {
    return stored;
  }
  
  // Auto-detect: if running on same origin (production with nginx), use relative URLs
  // This works because nginx proxies /api/* to the backend
  const isProduction = typeof window !== 'undefined' && 
                       window.location.hostname !== 'localhost' && 
                       !window.location.hostname.includes('127.0.0.1');
  
  return isProduction ? '' : 'http://localhost:3001';
};

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [backendUrl, setBackendUrlState] = useState(getStoredBackendUrl);

  const setBackendUrl = (url: string) => {
    localStorage.setItem('backend_url', url);
    setBackendUrlState(url);
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/setup/status`);
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({
          ...prev,
          isConfigured: data.isConfigured,
        }));
      }
    } catch (error) {
      console.log('Backend not available, using local settings');
      // Fallback to localStorage
      const stored = localStorage.getItem('app_settings');
      if (stored) {
        try {
          setSettings(JSON.parse(stored));
        } catch {
          setSettings(defaultSettings);
        }
      }
    }
  };

  useEffect(() => {
    fetchSettings().finally(() => setIsLoading(false));
  }, [backendUrl]);

  const refreshSettings = async () => {
    setIsLoading(true);
    await fetchSettings();
    setIsLoading(false);
  };

  const updateDatabaseConfig = async (config: DatabaseConfig): Promise<boolean> => {
    try {
      const response = await fetch(`${backendUrl}/api/setup/save-database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (response.ok) {
        setSettings(prev => ({ ...prev, database: config }));
        return true;
      }
      return false;
    } catch (error) {
      // Fallback to localStorage
      const newSettings = { ...settings, database: config };
      localStorage.setItem('app_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
      return true;
    }
  };

  const updateSmtpConfig = async (config: SmtpConfig): Promise<boolean> => {
    try {
      const response = await fetch(`${backendUrl}/api/setup/save-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (response.ok) {
        setSettings(prev => ({ ...prev, smtp: config }));
        return true;
      }
      return false;
    } catch (error) {
      const newSettings = { ...settings, smtp: config };
      localStorage.setItem('app_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
      return true;
    }
  };

  const updatePreferences = async (prefs: AppPreferences): Promise<boolean> => {
    try {
      const response = await fetch(`${backendUrl}/api/setup/save-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      
      if (response.ok) {
        setSettings(prev => ({ ...prev, preferences: prefs }));
        return true;
      }
      return false;
    } catch (error) {
      const newSettings = { ...settings, preferences: prefs };
      localStorage.setItem('app_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
      return true;
    }
  };

  const completeSetup = async () => {
    try {
      await fetch(`${backendUrl}/api/setup/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.log('Backend not available for complete setup');
    }
    
    const newSettings = { ...settings, isConfigured: true };
    localStorage.setItem('app_settings', JSON.stringify(newSettings));
    setSettings(newSettings);
  };

  const testDatabaseConnection = async (config: DatabaseConfig): Promise<DatabaseTestResult> => {
    try {
      const response = await fetch(`${backendUrl}/api/setup/test-database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      const data = await response.json();
      return {
        success: data.success,
        message: data.message,
        databaseExists: data.databaseExists,
        permissions: data.permissions,
        warning: data.warning,
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Não foi possível conectar ao backend. Verifique se o servidor está rodando.' 
      };
    }
  };

  const testSmtpConnection = async (config: SmtpConfig): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${backendUrl}/api/setup/test-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      const data = await response.json();
      return {
        success: data.success,
        message: data.message,
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Não foi possível conectar ao backend. Verifique se o servidor está rodando.' 
      };
    }
  };

  const initializeDatabase = async (config: DatabaseConfig): Promise<DatabaseInitResult> => {
    try {
      const response = await fetch(`${backendUrl}/api/setup/initialize-database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      const data = await response.json();
      return {
        success: data.success,
        message: data.message,
        tables: data.tables,
        schemaVersion: data.schemaVersion,
        backup: data.backup,
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Não foi possível conectar ao backend. Verifique se o servidor está rodando.' 
      };
    }
  };

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        isLoading,
        backendUrl,
        setBackendUrl,
        updateDatabaseConfig,
        updateSmtpConfig,
        updatePreferences,
        completeSetup,
        testDatabaseConnection,
        testSmtpConnection,
        initializeDatabase,
        refreshSettings,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
}
