import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Database, 
  Mail, 
  User, 
  Settings as SettingsIcon,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import type { DatabaseConfig, SmtpConfig, AppPreferences } from '@/types';

const steps = [
  { id: 'database', title: 'Banco de Dados', icon: Database, description: 'Configure a conexão com o PostgreSQL da aplicação' },
  { id: 'smtp', title: 'Email (SMTP)', icon: Mail, description: 'Configure o servidor de envio de emails' },
  { id: 'admin', title: 'Administrador', icon: User, description: 'Crie o primeiro usuário administrador' },
  { id: 'preferences', title: 'Preferências', icon: SettingsIcon, description: 'Defina as configurações gerais' },
];

export default function Setup() {
  const navigate = useNavigate();
  const { updateDatabaseConfig, updateSmtpConfig, updatePreferences, completeSetup, testDatabaseConnection, testSmtpConnection } = useAppSettings();
  const { register } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

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
    backendUrl: 'http://localhost:3001',
    emailNotifications: true,
  });

  const handleTestDatabase = async () => {
    setIsTesting(true);
    const result = await testDatabaseConnection(dbConfig);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setIsTesting(false);
  };

  const handleTestSmtp = async () => {
    setIsTesting(true);
    const result = await testSmtpConnection(smtpConfig);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setIsTesting(false);
  };

  const handleNext = async () => {
    setIsLoading(true);

    try {
      if (currentStep === 0) {
        await updateDatabaseConfig(dbConfig);
      } else if (currentStep === 1) {
        await updateSmtpConfig(smtpConfig);
      } else if (currentStep === 2) {
        if (adminConfig.password !== adminConfig.confirmPassword) {
          toast.error('As senhas não coincidem');
          setIsLoading(false);
          return;
        }
        await register(adminConfig.email, adminConfig.password, adminConfig.name);
      } else if (currentStep === 3) {
        await updatePreferences(prefsConfig);
        completeSetup();
        toast.success('Configuração concluída com sucesso!');
        navigate('/dashboard');
        return;
      }

      setCurrentStep(currentStep + 1);
    } catch {
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db-host">Host</Label>
                <Input
                  id="db-host"
                  value={dbConfig.host}
                  onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                  placeholder="localhost ou IP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-port">Porta</Label>
                <Input
                  id="db-port"
                  type="number"
                  value={dbConfig.port}
                  onChange={(e) => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) })}
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
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db-user">Usuário</Label>
                <Input
                  id="db-user"
                  value={dbConfig.username}
                  onChange={(e) => setDbConfig({ ...dbConfig, username: e.target.value })}
                  placeholder="postgres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-pass">Senha</Label>
                <Input
                  id="db-pass"
                  type="password"
                  value={dbConfig.password}
                  onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={handleTestDatabase} disabled={isTesting}>
              {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Testar Conexão
            </Button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">Host SMTP</Label>
                <Input
                  id="smtp-host"
                  value={smtpConfig.host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">Porta</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  value={smtpConfig.port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) })}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-pass">Senha</Label>
                <Input
                  id="smtp-pass"
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-from-name">Nome Remetente</Label>
                <Input
                  id="smtp-from-name"
                  value={smtpConfig.fromName}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={handleTestSmtp} disabled={isTesting}>
              {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Email de Teste
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Nome Completo</Label>
              <Input
                id="admin-name"
                value={adminConfig.name}
                onChange={(e) => setAdminConfig({ ...adminConfig, name: e.target.value })}
                placeholder="Seu nome"
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-confirm">Confirmar Senha</Label>
                <Input
                  id="admin-confirm"
                  type="password"
                  value={adminConfig.confirmPassword}
                  onChange={(e) => setAdminConfig({ ...adminConfig, confirmPassword: e.target.value })}
                />
              </div>
            </div>
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
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pref-theme">Tema Padrão</Label>
                <select
                  id="pref-theme"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={prefsConfig.theme}
                  onChange={(e) => setPrefsConfig({ ...prefsConfig, theme: e.target.value as 'light' | 'dark' | 'system' })}
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={prefsConfig.timezone}
                  onChange={(e) => setPrefsConfig({ ...prefsConfig, timezone: e.target.value })}
                >
                  <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/Bahia">Bahia (GMT-3)</option>
                  <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                </select>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Backend Local (Emails)</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pref-backend">URL do Backend</Label>
                  <Input
                    id="pref-backend"
                    value={prefsConfig.backendUrl || ''}
                    onChange={(e) => setPrefsConfig({ ...prefsConfig, backendUrl: e.target.value })}
                    placeholder="http://localhost:3001"
                  />
                  <p className="text-xs text-muted-foreground">
                    Endpoint do servidor Node.js para envio de emails
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="pref-email-notifications"
                    checked={prefsConfig.emailNotifications ?? true}
                    onChange={(e) => setPrefsConfig({ ...prefsConfig, emailNotifications: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="pref-email-notifications" className="text-sm font-normal">
                    Ativar notificações por email ao criar conferências
                  </Label>
                </div>
              </div>
            </div>
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

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                    isCompleted
                      ? 'bg-status-completed text-status-completed-foreground'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 h-1 mx-1 rounded ${
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
              <Button onClick={handleNext} disabled={isLoading}>
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
