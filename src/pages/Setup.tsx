import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Database, 
  Mail, 
  User, 
  Settings as SettingsIcon,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Server,
  Check,
  X,
  Download,
  ShieldAlert,
  HardDrive,
  RefreshCw,
  Wifi,
  WifiOff,
  ExternalLink
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DatabaseConfig, SmtpConfig, AppPreferences } from '@/types';

// Steps without backend config - it's now auto-detected
const steps = [
  { id: 'database', title: 'Banco de Dados', icon: Database, description: 'Configure a conexão com o PostgreSQL' },
  { id: 'smtp', title: 'Email (SMTP)', icon: Mail, description: 'Configure o servidor de envio de emails' },
  { id: 'admin', title: 'Administrador', icon: User, description: 'Crie o primeiro usuário administrador' },
  { id: 'preferences', title: 'Preferências', icon: SettingsIcon, description: 'Defina as configurações gerais' },
];

interface TestResult {
  success: boolean;
  message: string;
  databaseExists?: boolean;
  tables?: string[];
  permissions?: {
    canCreateDb: boolean;
    isSuperuser: boolean;
    username?: string;
  };
  warning?: string;
  schemaVersion?: string;
  backup?: {
    fileName?: string;
    size?: number;
    error?: string;
  };
}

interface BackendStatus {
  connected: boolean;
  checking: boolean;
  version?: string;
  uptime?: number;
  error?: string;
  url: string;
}

export default function Setup() {
  const navigate = useNavigate();
  const { 
    backendUrl, 
    setBackendUrl, 
    updateDatabaseConfig, 
    updateSmtpConfig, 
    updatePreferences, 
    completeSetup, 
    testDatabaseConnection, 
    testSmtpConnection,
    initializeDatabase 
  } = useAppSettings();
  const { register } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [initResult, setInitResult] = useState<TestResult | null>(null);
  const [createBackupBeforeInit, setCreateBackupBeforeInit] = useState(true);

  // Backend connection status
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    connected: false,
    checking: true,
    url: backendUrl
  });
  const [showCustomUrlConfig, setShowCustomUrlConfig] = useState(false);
  const [customBackendUrl, setCustomBackendUrl] = useState(backendUrl);

  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    host: 'localhost',
    port: 5432,
    database: 'conferencia_app',
    username: 'postgres',
    password: '',
  });

  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
    host: '',
    port: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'Conferência de Migração',
  });

  const [adminConfig, setAdminConfig] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [prefsConfig, setPrefsConfig] = useState<AppPreferences>({
    companyName: '',
    theme: 'system',
    timezone: 'America/Sao_Paulo',
    backendUrl: backendUrl,
    emailNotifications: true,
  });

  // Check backend connection
  const checkBackendConnection = useCallback(async (url: string) => {
    setBackendStatus(prev => ({ ...prev, checking: true, url }));
    
    try {
      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        setBackendStatus({
          connected: true,
          checking: false,
          version: data.version,
          uptime: data.uptime,
          url
        });
        setBackendUrl(url);
        setPrefsConfig(prev => ({ ...prev, backendUrl: url }));
        return true;
      } else {
        setBackendStatus({
          connected: false,
          checking: false,
          error: `Resposta inválida (${response.status})`,
          url
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setBackendStatus({
        connected: false,
        checking: false,
        error: errorMessage.includes('timeout') 
          ? 'Tempo limite excedido' 
          : 'Não foi possível conectar',
        url
      });
      return false;
    }
  }, [setBackendUrl]);

  // Initial connection check
  useEffect(() => {
    checkBackendConnection(backendUrl);
  }, []);

  const handleRetryConnection = () => {
    checkBackendConnection(backendStatus.url);
  };

  const handleApplyCustomUrl = async () => {
    const success = await checkBackendConnection(customBackendUrl);
    if (success) {
      setShowCustomUrlConfig(false);
      toast.success('Backend conectado com sucesso!');
    } else {
      toast.error('Não foi possível conectar ao backend');
    }
  };

  const handleTestDatabase = async () => {
    setIsTesting(true);
    setTestResult(null);
    setInitResult(null);
    
    const result = await testDatabaseConnection(dbConfig);
    setTestResult(result);
    
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    
    setIsTesting(false);
  };

  const handleInitializeDatabase = async () => {
    setIsInitializing(true);
    setInitResult(null);
    
    const result = await initializeDatabase({ ...dbConfig, createBackup: createBackupBeforeInit });
    setInitResult(result);
    
    if (result.success) {
      toast.success(result.message);
      if (result.backup?.fileName) {
        toast.info(`Backup criado: ${result.backup.fileName}`);
      }
    } else {
      toast.error(result.message);
    }
    
    setIsInitializing(false);
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/setup/create-backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Backup criado: ${data.fileName}`);
      } else {
        toast.error(data.message || 'Erro ao criar backup');
      }
    } catch (error) {
      toast.error('Erro ao criar backup');
    }
    
    setIsBackingUp(false);
  };

  const handleTestSmtp = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    const result = await testSmtpConnection(smtpConfig);
    setTestResult(result);
    
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    
    setIsTesting(false);
  };

  const handleNext = async () => {
    setIsLoading(true);
    setTestResult(null);
    setInitResult(null);

    try {
      if (currentStep === 0) {
        // Database step - must be initialized
        if (!initResult?.success) {
          toast.error('Por favor, inicialize o banco de dados antes de continuar');
          setIsLoading(false);
          return;
        }
        await updateDatabaseConfig(dbConfig);
      } else if (currentStep === 1) {
        await updateSmtpConfig(smtpConfig);
      } else if (currentStep === 2) {
        if (adminConfig.password !== adminConfig.confirmPassword) {
          toast.error('As senhas não coincidem');
          setIsLoading(false);
          return;
        }
        if (adminConfig.password.length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres');
          setIsLoading(false);
          return;
        }
        await register(adminConfig.email, adminConfig.password, adminConfig.name);
      } else if (currentStep === 3) {
        await updatePreferences(prefsConfig);
        await completeSetup();
        toast.success('Configuração concluída com sucesso!');
        navigate('/dashboard');
        return;
      }

      setCurrentStep(currentStep + 1);
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setTestResult(null);
    setInitResult(null);
    setCurrentStep(currentStep - 1);
  };

  const canProceed = () => {
    // Can't proceed if backend is not connected
    if (!backendStatus.connected) return false;

    switch (currentStep) {
      case 0:
        return initResult?.success === true;
      case 1:
        return true; // SMTP is optional
      case 2:
        return adminConfig.email && adminConfig.password && adminConfig.name && 
               adminConfig.password === adminConfig.confirmPassword;
      case 3:
        return prefsConfig.companyName.length > 0;
      default:
        return true;
    }
  };

  // Backend Status Banner Component
  const BackendStatusBanner = () => (
    <div className={`rounded-lg border p-3 mb-4 transition-colors ${
      backendStatus.connected 
        ? 'bg-status-completed/10 border-status-completed/30' 
        : 'bg-destructive/10 border-destructive/30'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {backendStatus.checking ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : backendStatus.connected ? (
            <Wifi className="h-5 w-5 text-status-completed" />
          ) : (
            <WifiOff className="h-5 w-5 text-destructive" />
          )}
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium text-sm ${
                backendStatus.connected ? 'text-status-completed' : 'text-destructive'
              }`}>
                {backendStatus.checking 
                  ? 'Verificando conexão...' 
                  : backendStatus.connected 
                    ? 'Backend conectado' 
                    : 'Backend desconectado'}
              </span>
              {backendStatus.connected && backendStatus.version && (
                <span className="text-xs text-muted-foreground">
                  v{backendStatus.version}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {backendStatus.url || 'URL automática'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!backendStatus.connected && !backendStatus.checking && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRetryConnection}
              className="h-8"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Tentar novamente
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCustomUrlConfig(!showCustomUrlConfig)}
            className="h-8"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error message */}
      {!backendStatus.connected && !backendStatus.checking && backendStatus.error && (
        <p className="text-xs text-destructive mt-2 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {backendStatus.error}
        </p>
      )}

      {/* Custom URL configuration */}
      <Collapsible open={showCustomUrlConfig} onOpenChange={setShowCustomUrlConfig}>
        <CollapsibleContent className="mt-3 pt-3 border-t border-border/50">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Server className="h-3 w-3" />
              <span>Configurar URL personalizada do backend</span>
            </div>
            
            <div className="flex gap-2">
              <Input
                value={customBackendUrl}
                onChange={(e) => setCustomBackendUrl(e.target.value)}
                placeholder="http://localhost:3001 ou https://api.seudominio.com"
                className="h-9 text-sm"
              />
              <Button 
                onClick={handleApplyCustomUrl}
                disabled={backendStatus.checking || !customBackendUrl}
                size="sm"
                className="h-9"
              >
                {backendStatus.checking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span className="ml-1">Aplicar</span>
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              <p className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Deixe vazio para usar URL relativa (recomendado em produção com nginx)
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <Alert>
              <Database className="h-4 w-4" />
              <AlertDescription>
                Configure a conexão com o PostgreSQL. O sistema irá criar o banco de dados e as tabelas necessárias automaticamente.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db-host">Host</Label>
                <Input
                  id="db-host"
                  value={dbConfig.host}
                  onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                  placeholder="localhost ou IP"
                  disabled={!backendStatus.connected}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-port">Porta</Label>
                <Input
                  id="db-port"
                  type="number"
                  value={dbConfig.port}
                  onChange={(e) => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) })}
                  disabled={!backendStatus.connected}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-database">Nome do Banco</Label>
              <Input
                id="db-database"
                value={dbConfig.database}
                onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                placeholder="conferencia_app"
                disabled={!backendStatus.connected}
              />
              <p className="text-xs text-muted-foreground">
                Se o banco não existir, ele será criado automaticamente.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db-user">Usuário</Label>
                <Input
                  id="db-user"
                  value={dbConfig.username}
                  onChange={(e) => setDbConfig({ ...dbConfig, username: e.target.value })}
                  placeholder="postgres"
                  disabled={!backendStatus.connected}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-pass">Senha</Label>
                <Input
                  id="db-pass"
                  type="password"
                  value={dbConfig.password}
                  onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                  disabled={!backendStatus.connected}
                />
              </div>
            </div>

            {/* Backup option */}
            {testResult?.success && testResult?.databaseExists && (
              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <Checkbox
                  id="create-backup"
                  checked={createBackupBeforeInit}
                  onCheckedChange={(checked) => setCreateBackupBeforeInit(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="create-backup" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Criar backup antes de inicializar
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Recomendado para proteger dados existentes
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleTestDatabase} 
                disabled={isTesting || isInitializing || !backendStatus.connected}
              >
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                1. Testar Conexão
              </Button>
              <Button 
                type="button" 
                onClick={handleInitializeDatabase} 
                disabled={isInitializing || isTesting || !testResult?.success || !backendStatus.connected}
              >
                {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                2. Criar Banco e Tabelas
              </Button>
              {testResult?.success && testResult?.databaseExists && (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleCreateBackup} 
                  disabled={isBackingUp || isInitializing || !backendStatus.connected}
                >
                  {isBackingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Download className="mr-2 h-4 w-4" />
                  Backup Manual
                </Button>
              )}
            </div>

            {/* Permission warning */}
            {testResult?.warning && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-line">
                  {testResult.warning}
                </AlertDescription>
              </Alert>
            )}

            {/* Permission info */}
            {testResult?.success && testResult?.permissions && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="font-medium mb-1 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Permissões do usuário "{testResult.permissions.username || dbConfig.username}"
                </div>
                <div className="flex gap-4 text-xs">
                  <span className={testResult.permissions.canCreateDb ? "text-green-600" : "text-orange-600"}>
                    {testResult.permissions.canCreateDb ? "✓" : "✗"} Criar banco de dados
                  </span>
                  <span className={testResult.permissions.isSuperuser ? "text-green-600" : "text-muted-foreground"}>
                    {testResult.permissions.isSuperuser ? "✓ Superusuário" : "Usuário comum"}
                  </span>
                </div>
              </div>
            )}

            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                <AlertDescription>
                  {testResult.message}
                  {testResult.databaseExists === false && (
                    <span className="block mt-1 text-sm">
                      O banco será criado ao clicar em "Criar Banco e Tabelas".
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {initResult && (
              <Alert variant={initResult.success ? "default" : "destructive"}>
                {initResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {initResult.message}
                  {initResult.schemaVersion && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Versão do schema: {initResult.schemaVersion}
                    </div>
                  )}
                  
                  {initResult.backup?.fileName && (
                    <div className="mt-2 p-2 bg-secondary/50 rounded text-xs">
                      <span className="font-medium">📦 Backup criado:</span> {initResult.backup.fileName}
                      {initResult.backup.size && (
                        <span className="ml-2 text-muted-foreground">
                          ({(initResult.backup.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                  )}
                  
                  {initResult.backup?.error && (
                    <div className="mt-2 text-xs text-orange-600">
                      ⚠️ Aviso de backup: {initResult.backup.error}
                    </div>
                  )}
                  
                  {initResult.tables && initResult.tables.length > 0 && (
                    <div className="mt-2">
                      <span className="font-medium">Tabelas criadas:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {initResult.tables.map(table => (
                          <span key={table} className="text-xs bg-secondary px-2 py-0.5 rounded">
                            {table}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Configure o servidor SMTP para envio de emails (links de conferência, lembretes, etc.). Esta etapa é opcional.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">Host SMTP</Label>
                <Input
                  id="smtp-host"
                  value={smtpConfig.host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  disabled={!backendStatus.connected}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">Porta</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  value={smtpConfig.port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) })}
                  disabled={!backendStatus.connected}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-user">Usuário</Label>
                <Input
                  id="smtp-user"
                  value={smtpConfig.username}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                  placeholder="seu@email.com"
                  disabled={!backendStatus.connected}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-pass">Senha</Label>
                <Input
                  id="smtp-pass"
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                  disabled={!backendStatus.connected}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-from-email">Email Remetente</Label>
                <Input
                  id="smtp-from-email"
                  type="email"
                  value={smtpConfig.fromEmail}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                  placeholder="noreply@empresa.com"
                  disabled={!backendStatus.connected}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-from-name">Nome Remetente</Label>
                <Input
                  id="smtp-from-name"
                  value={smtpConfig.fromName}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                  disabled={!backendStatus.connected}
                />
              </div>
            </div>
            
            {smtpConfig.host && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleTestSmtp} 
                disabled={isTesting || !backendStatus.connected}
              >
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Testar Conexão SMTP
              </Button>
            )}

            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription>
                Crie o primeiro usuário administrador do sistema. Este usuário terá acesso total a todas as funcionalidades.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="admin-name">Nome Completo</Label>
              <Input
                id="admin-name"
                value={adminConfig.name}
                onChange={(e) => setAdminConfig({ ...adminConfig, name: e.target.value })}
                placeholder="Seu nome"
                disabled={!backendStatus.connected}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={adminConfig.email}
                onChange={(e) => setAdminConfig({ ...adminConfig, email: e.target.value })}
                placeholder="admin@empresa.com"
                disabled={!backendStatus.connected}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin-pass">Senha</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  value={adminConfig.password}
                  onChange={(e) => setAdminConfig({ ...adminConfig, password: e.target.value })}
                  disabled={!backendStatus.connected}
                />
                <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-confirm">Confirmar Senha</Label>
                <Input
                  id="admin-confirm"
                  type="password"
                  value={adminConfig.confirmPassword}
                  onChange={(e) => setAdminConfig({ ...adminConfig, confirmPassword: e.target.value })}
                  disabled={!backendStatus.connected}
                />
              </div>
            </div>
            
            {adminConfig.password && adminConfig.confirmPassword && adminConfig.password !== adminConfig.confirmPassword && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>As senhas não coincidem</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pref-company">Nome da Empresa</Label>
              <Input
                id="pref-company"
                value={prefsConfig.companyName}
                onChange={(e) => setPrefsConfig({ ...prefsConfig, companyName: e.target.value })}
                placeholder="Minha Empresa"
                disabled={!backendStatus.connected}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pref-theme">Tema Padrão</Label>
                <select
                  id="pref-theme"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={prefsConfig.theme}
                  onChange={(e) => setPrefsConfig({ ...prefsConfig, theme: e.target.value as 'light' | 'dark' | 'system' })}
                  disabled={!backendStatus.connected}
                >
                  <option value="system">Sistema</option>
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-timezone">Fuso Horário</Label>
                <select
                  id="pref-timezone"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={prefsConfig.timezone}
                  onChange={(e) => setPrefsConfig({ ...prefsConfig, timezone: e.target.value })}
                  disabled={!backendStatus.connected}
                >
                  <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/Bahia">Bahia (GMT-3)</option>
                  <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                </select>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="pref-email-notifications"
                  checked={prefsConfig.emailNotifications ?? true}
                  onChange={(e) => setPrefsConfig({ ...prefsConfig, emailNotifications: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                  disabled={!backendStatus.connected}
                />
                <Label htmlFor="pref-email-notifications" className="text-sm font-normal">
                  Ativar notificações por email ao criar conferências
                </Label>
              </div>
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Ao finalizar, o sistema estará pronto para uso. Você será redirecionado para o painel principal.
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Configuração Inicial</h1>
          <p className="text-muted-foreground mt-2">Configure o sistema para começar a usar</p>
        </div>

        {/* Backend Status Banner - Always visible */}
        <BackendStatusBanner />

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-colors ${
                    isCompleted
                      ? 'bg-status-completed text-status-completed-foreground'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <StepIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-6 sm:w-12 h-1 mx-0.5 sm:mx-1 rounded ${
                      isCompleted ? 'bg-status-completed' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const StepIcon = steps[currentStep].icon;
                return <StepIcon className="h-5 w-5 text-primary" />;
              })()}
              {steps[currentStep].title}
            </CardTitle>
            <CardDescription>{steps[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}

            <div className="flex justify-between mt-6 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0 || isLoading}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button 
                onClick={handleNext} 
                disabled={isLoading || !canProceed()}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
                {currentStep < steps.length - 1 && <ChevronRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
