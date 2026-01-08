import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Play, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Store,
  Check,
  X,
  Loader2,
  ShieldAlert,
  ArrowRight,
  ListChecks
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConferences } from '@/hooks/useConferences';
import { useTemplates } from '@/hooks/useTemplates';
import { toast } from 'sonner';
import { ConferenceItem, TemplateItem, TemplateSection, ItemStatus, ExpectedInput } from '@/types';

type WizardStep = 'loading' | 'expired' | 'not_found' | 'expected_inputs' | 'sections' | 'summary';

const statusConfig: Record<ItemStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, className: 'bg-muted text-muted-foreground' },
  auto_ok: { label: 'Auto OK', icon: CheckCircle2, className: 'bg-status-completed/20 text-status-completed' },
  correct: { label: 'Correto', icon: CheckCircle2, className: 'bg-status-completed text-status-completed-foreground' },
  divergent: { label: 'Divergente', icon: AlertTriangle, className: 'bg-status-divergent text-status-divergent-foreground' },
  warn: { label: 'Atenção', icon: AlertTriangle, className: 'bg-amber-500/20 text-amber-600' },
  fail: { label: 'Falha', icon: X, className: 'bg-destructive text-destructive-foreground' },
};

export default function ClientConference() {
  const { token } = useParams<{ token: string }>();
  const { getConferenceByToken, updateConferenceItem, executeQuery, updateConference, getConference } = useConferences();
  const { getTemplate } = useTemplates();
  
  const [step, setStep] = useState<WizardStep>('loading');
  const [conference, setConference] = useState(token ? getConferenceByToken(token) : undefined);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [executingItems, setExecutingItems] = useState<Set<string>>(new Set());
  const [itemObservations, setItemObservations] = useState<Record<string, string>>({});
  const [expectedInputValues, setExpectedInputValues] = useState<Record<string, string | number>>({});
  
  const template = conference ? getTemplate(conference.templateId) : undefined;
  
  // Initialize expected input values from conference
  useEffect(() => {
    if (conference && template) {
      const values: Record<string, string | number> = {};
      Object.entries(conference.expectedInputValues).forEach(([key, val]) => {
        values[key] = val.value;
      });
      setExpectedInputValues(values);
    }
  }, [conference?.id, template?.id]);
  
  // Check token validity
  useEffect(() => {
    if (!token) {
      setStep('not_found');
      return;
    }
    
    // Small delay to simulate loading and ensure localStorage is populated
    const timer = setTimeout(() => {
      const conf = getConferenceByToken(token);
      if (!conf) {
        // Check if token exists but is expired
        // For simplicity, we'll just show not_found
        setStep('not_found');
        return;
      }
      
      if (new Date(conf.linkExpiresAt) < new Date()) {
        setStep('expired');
        return;
      }
      
      setConference(conf);
      setStep('expected_inputs');
    }, 500);
    
    return () => clearTimeout(timer);
  }, [token, getConferenceByToken]);
  
  // Calculate progress
  const progress = useMemo(() => {
    if (!conference) return { completed: 0, total: 0, percentage: 0, divergent: 0, correct: 0 };
    
    const items = conference.items;
    const completed = items.filter(i => i.userResponse).length;
    const divergent = items.filter(i => i.userResponse === 'divergent').length;
    const correct = items.filter(i => i.userResponse === 'correct').length;
    
    return {
      completed,
      total: items.length,
      percentage: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
      divergent,
      correct,
    };
  }, [conference]);
  
  // Get expected inputs from template
  const expectedInputs = useMemo(() => {
    if (!template) return [];
    return template.expectedInputs || [];
  }, [template]);
  
  // Get sorted sections
  const sections = useMemo(() => {
    if (!template) return [];
    return [...template.sections].sort((a, b) => a.order - b.order);
  }, [template]);
  
  const currentSection = sections[currentSectionIndex];
  
  // Handle expected input change
  const handleExpectedInputChange = (inputId: string, value: string, storeId?: string) => {
    const key = storeId ? `${inputId}_${storeId}` : inputId;
    setExpectedInputValues(prev => ({ ...prev, [key]: value }));
  };
  
  // Save expected inputs and move to sections
  const handleSaveExpectedInputs = () => {
    if (!conference) return;
    
    const inputValues: Record<string, { value: string | number; storeId?: string }> = {};
    Object.entries(expectedInputValues).forEach(([key, value]) => {
      const parts = key.split('_');
      const inputId = parts[0];
      const storeId = parts.length > 1 ? parts.slice(1).join('_') : undefined;
      inputValues[key] = { value, storeId };
    });
    
    updateConference(conference.id, { expectedInputValues: inputValues });
    setConference(getConference(conference.id));
    setStep('sections');
    toast.success('Valores esperados salvos!');
  };
  
  const handleExecuteItem = async (item: ConferenceItem, templateItem: TemplateItem, storeId?: string) => {
    if (!conference) return;
    
    const itemKey = item.id;
    setExecutingItems(prev => new Set(prev).add(itemKey));
    
    try {
      // Substitute variables in query
      let query = templateItem.query;
      if (storeId) {
        query = query.replace(/:store_id/g, storeId);
      }
      // Replace expected input bindings
      if (templateItem.expectedInputBinding) {
        const inputKey = storeId ? `${templateItem.expectedInputBinding}_${storeId}` : templateItem.expectedInputBinding;
        const value = expectedInputValues[inputKey] || conference.expectedInputValues[inputKey]?.value;
        if (value !== undefined) {
          query = query.replace(new RegExp(`:${templateItem.expectedInputBinding}`, 'g'), String(value));
        }
      }
      
      const result = await executeQuery(conference.id, item.id, query);
      
      if (result.success) {
        toast.success('Verificação executada');
        setConference(getConference(conference.id));
        // Auto expand item to show result
        setExpandedItems(prev => new Set(prev).add(item.id));
      } else {
        toast.error(result.error || 'Erro ao executar verificação');
      }
    } finally {
      setExecutingItems(prev => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };
  
  const handleRespondItem = (item: ConferenceItem, response: 'correct' | 'divergent') => {
    if (!conference) return;
    
    const observation = itemObservations[item.id] || '';
    updateConferenceItem(conference.id, item.id, {
      userResponse: response,
      status: response,
      observation,
      respondedBy: conference.clientName,
    });
    setConference(getConference(conference.id));
    toast.success(response === 'correct' ? 'Marcado como correto' : 'Marcado como divergente');
  };
  
  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };
  
  const getItemForSection = (templateItem: TemplateItem, storeId?: string): ConferenceItem | undefined => {
    if (!conference) return undefined;
    if (templateItem.scope === 'global') {
      return conference.items.find(i => i.templateItemId === templateItem.id);
    }
    return conference.items.find(i => i.id === `${templateItem.id}_${storeId}`);
  };
  
  // Check if current section is complete
  const isSectionComplete = useMemo(() => {
    if (!currentSection || !conference) return false;
    
    const sectionItems = currentSection.items.flatMap(item => {
      if (item.scope === 'global') {
        return [conference.items.find(i => i.templateItemId === item.id)].filter(Boolean);
      }
      return conference.stores.map(store => 
        conference.items.find(i => i.id === `${item.id}_${store.id}`)
      ).filter(Boolean);
    }) as ConferenceItem[];
    
    return sectionItems.every(i => i.userResponse);
  }, [currentSection, conference]);
  
  const handleNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      setExpandedItems(new Set());
    } else {
      setStep('summary');
    }
  };
  
  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
      setExpandedItems(new Set());
    } else {
      setStep('expected_inputs');
    }
  };
  
  // Render loading state
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando conferência...</p>
        </div>
      </div>
    );
  }
  
  // Render not found state
  if (step === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldAlert className="h-16 w-16 text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-bold">Link Inválido</h1>
            <p className="text-muted-foreground">
              O link que você está tentando acessar não existe ou não é válido.
              Por favor, verifique o link ou entre em contato com o responsável.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Render expired state
  if (step === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Clock className="h-16 w-16 text-status-divergent mx-auto" />
            <h1 className="text-2xl font-bold">Link Expirado</h1>
            <p className="text-muted-foreground">
              O link de acesso a esta conferência expirou.
              Por favor, entre em contato com o responsável para obter um novo link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!conference || !template) {
    return null;
  }
  
  // Render expected inputs step (Passo 0)
  if (step === 'expected_inputs') {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <Badge variant="outline" className="mb-2">Passo 0</Badge>
            <h1 className="text-2xl font-bold">{conference.name}</h1>
            <p className="text-muted-foreground">
              Bem-vindo(a), {conference.clientName}! Antes de iniciar a conferência,
              informe os valores esperados do seu sistema.
            </p>
          </div>
          
          {/* Expected Inputs Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Números Esperados
              </CardTitle>
              <CardDescription>
                Informe os valores que você espera encontrar com base no seu sistema atual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {expectedInputs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum valor esperado configurado para este template.
                </p>
              ) : (
                expectedInputs.map((input: ExpectedInput) => {
                  if (input.scope === 'global') {
                    return (
                      <div key={input.key} className="space-y-2">
                        <Label htmlFor={input.key}>
                          {input.label}
                          {input.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <Input
                          id={input.key}
                          type={input.type}
                          placeholder={`Informe ${input.label.toLowerCase()}`}
                          value={expectedInputValues[input.key] || ''}
                          onChange={(e) => handleExpectedInputChange(input.key, e.target.value)}
                        />
                      </div>
                    );
                  }
                  
                  // Per store inputs
                  return (
                    <div key={input.key} className="space-y-4">
                      <Label className="text-base font-medium">{input.label}</Label>
                      <div className="grid gap-3">
                        {conference.stores.map(store => (
                          <div key={`${input.key}_${store.id}`} className="flex items-center gap-3">
                            <Badge variant="secondary" className="shrink-0">
                              <Store className="h-3 w-3 mr-1" />
                              {store.name}
                            </Badge>
                            <Input
                              type={input.type}
                              placeholder={`${input.label} para ${store.name}`}
                              value={expectedInputValues[`${input.key}_${store.id}`] || ''}
                              onChange={(e) => handleExpectedInputChange(input.key, e.target.value, store.id)}
                              className="flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
              
              <Button 
                onClick={handleSaveExpectedInputs} 
                className="w-full"
                size="lg"
              >
                Iniciar Conferência
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Render summary step
  if (step === 'summary') {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <CheckCircle2 className="h-16 w-16 text-status-completed mx-auto" />
            <h1 className="text-2xl font-bold">Conferência Finalizada!</h1>
            <p className="text-muted-foreground">
              Obrigado por completar a conferência, {conference.clientName}.
            </p>
          </div>
          
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold text-status-completed">{progress.correct}</p>
                  <p className="text-sm text-muted-foreground">Itens Corretos</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold text-status-divergent">{progress.divergent}</p>
                  <p className="text-sm text-muted-foreground">Divergências</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground text-center">
                  Total de itens verificados: {progress.completed} de {progress.total}
                </p>
                <Progress value={progress.percentage} className="h-2 mt-2" />
              </div>
              
              {progress.divergent > 0 && (
                <div className="p-4 bg-status-divergent/10 rounded-lg border border-status-divergent/20">
                  <p className="text-sm text-status-divergent">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    {progress.divergent} divergência(s) foram identificadas e serão analisadas pela equipe.
                  </p>
                </div>
              )}
              
              <Button 
                variant="outline" 
                onClick={() => { setStep('sections'); setCurrentSectionIndex(0); }}
                className="w-full"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Revisar Respostas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Render sections wizard
  const renderItem = (templateItem: TemplateItem, storeId?: string) => {
    const conferenceItem = getItemForSection(templateItem, storeId);
    if (!conferenceItem) return null;
    
    const status = statusConfig[conferenceItem.status];
    const StatusIcon = status.icon;
    const isExecuting = executingItems.has(conferenceItem.id);
    const isExpanded = expandedItems.has(conferenceItem.id);
    const store = storeId ? conference.stores.find(s => s.id === storeId) : undefined;
    
    return (
      <Card key={conferenceItem.id}>
        <Collapsible open={isExpanded} onOpenChange={() => toggleItem(conferenceItem.id)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <CardTitle className="text-base">{templateItem.title}</CardTitle>
                    {templateItem.scope === 'per_store' && store && (
                      <Badge variant="secondary" className="mt-1">
                        <Store className="h-3 w-3 mr-1" />
                        {store.name}
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={status.className}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <p className="text-sm text-muted-foreground">{templateItem.description}</p>
              
              {/* Execute button */}
              {conferenceItem.status === 'pending' && (
                <Button
                  onClick={() => handleExecuteItem(conferenceItem, templateItem, store?.storeId)}
                  disabled={isExecuting}
                  className="w-full"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Executar Verificação
                    </>
                  )}
                </Button>
              )}
              
              {/* Result */}
              {conferenceItem.queryResult && (
                <div className="p-3 bg-accent/50 rounded-md">
                  <Label className="text-xs text-muted-foreground">Resultado da verificação:</Label>
                  <pre className="text-sm mt-1 overflow-auto max-h-32">
                    {JSON.stringify(conferenceItem.queryResult, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Response section */}
              {conferenceItem.status !== 'pending' && conferenceItem.status !== 'fail' && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-2">
                    <Label className="text-sm">Observação (opcional)</Label>
                    <Textarea
                      placeholder="Adicione uma observação se necessário..."
                      value={itemObservations[conferenceItem.id] || conferenceItem.observation || ''}
                      onChange={(e) => setItemObservations(prev => ({ ...prev, [conferenceItem.id]: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  
                  {conferenceItem.userResponse ? (
                    <div className="flex items-center gap-2">
                      <Badge className={conferenceItem.userResponse === 'correct' ? 'bg-status-completed' : 'bg-status-divergent'}>
                        {conferenceItem.userResponse === 'correct' ? (
                          <><Check className="h-3 w-3 mr-1" /> Marcado como Correto</>
                        ) : (
                          <><X className="h-3 w-3 mr-1" /> Marcado como Divergente</>
                        )}
                      </Badge>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="text-status-completed border-status-completed hover:bg-status-completed/10"
                        onClick={() => handleRespondItem(conferenceItem, 'correct')}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Está Correto
                      </Button>
                      <Button
                        variant="outline"
                        className="text-status-divergent border-status-divergent hover:bg-status-divergent/10"
                        onClick={() => handleRespondItem(conferenceItem, 'divergent')}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Divergente
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline">
              Seção {currentSectionIndex + 1} de {sections.length}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {progress.completed}/{progress.total} itens
            </span>
          </div>
          <Progress value={(currentSectionIndex + 1) / sections.length * 100} className="h-1" />
        </div>
        
        {/* Section title */}
        <div>
          <h1 className="text-xl font-bold">{currentSection?.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verifique cada item abaixo e confirme se está correto ou divergente.
          </p>
        </div>
        
        {/* Items */}
        <div className="space-y-3">
          {currentSection?.items.map(templateItem => {
            if (templateItem.scope === 'global') {
              return renderItem(templateItem);
            }
            return conference.stores.map(store => renderItem(templateItem, store.id));
          })}
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handlePrevSection}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            {currentSectionIndex === 0 ? 'Valores Esperados' : 'Seção Anterior'}
          </Button>
          <Button onClick={handleNextSection}>
            {currentSectionIndex === sections.length - 1 ? 'Finalizar' : 'Próxima Seção'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
