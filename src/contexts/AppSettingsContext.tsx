import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AppSettings, DatabaseConfig, SmtpConfig, AppPreferences } from '@/types';

interface AppSettingsContextType {
  settings: AppSettings;
  isLoading: boolean;
  updateDatabaseConfig: (config: DatabaseConfig) => Promise<boolean>;
  updateSmtpConfig: (config: SmtpConfig) => Promise<boolean>;
  updatePreferences: (prefs: AppPreferences) => Promise<boolean>;
  completeSetup: () => void;
  testDatabaseConnection: (config: DatabaseConfig) => Promise<{ success: boolean; message: string }>;
  testSmtpConnection: (config: SmtpConfig) => Promise<{ success: boolean; message: string }>;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const defaultSettings: AppSettings = {
  isConfigured: false,
  database: null,
  smtp: null,
  preferences: null,
};

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load settings from localStorage (in production, this would be from the backend)
    const stored = localStorage.getItem('app_settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings(parsed);
      } catch {
        setSettings(defaultSettings);
      }
    }
    setIsLoading(false);
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    localStorage.setItem('app_settings', JSON.stringify(newSettings));
    setSettings(newSettings);
  };

  const updateDatabaseConfig = async (config: DatabaseConfig): Promise<boolean> => {
    const newSettings = { ...settings, database: config };
    saveSettings(newSettings);
    return true;
  };

  const updateSmtpConfig = async (config: SmtpConfig): Promise<boolean> => {
    const newSettings = { ...settings, smtp: config };
    saveSettings(newSettings);
    return true;
  };

  const updatePreferences = async (prefs: AppPreferences): Promise<boolean> => {
    const newSettings = { ...settings, preferences: prefs };
    saveSettings(newSettings);
    return true;
  };

  const completeSetup = () => {
    const newSettings = { ...settings, isConfigured: true };
    saveSettings(newSettings);
  };

  const testDatabaseConnection = async (config: DatabaseConfig): Promise<{ success: boolean; message: string }> => {
    // Mock test - in production, this would actually test the connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (config.host && config.port && config.database && config.username) {
      return { success: true, message: 'Conexão estabelecida com sucesso!' };
    }
    return { success: false, message: 'Falha ao conectar. Verifique as credenciais.' };
  };

  const testSmtpConnection = async (config: SmtpConfig): Promise<{ success: boolean; message: string }> => {
    // Mock test - in production, this would actually test the SMTP connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (config.host && config.port && config.fromEmail) {
      return { success: true, message: 'Email de teste enviado com sucesso!' };
    }
    return { success: false, message: 'Falha ao conectar ao servidor SMTP.' };
  };

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        isLoading,
        updateDatabaseConfig,
        updateSmtpConfig,
        updatePreferences,
        completeSetup,
        testDatabaseConnection,
        testSmtpConnection,
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
