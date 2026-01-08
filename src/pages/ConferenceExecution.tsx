import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Store,
  Copy,
  RefreshCw,
  MessageSquare,
  Paperclip,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConferences } from '@/hooks/useConferences';
import { useTemplates } from '@/hooks/useTemplates';
import { useConnections } from '@/hooks/useConnections';
import { toast } from 'sonner';
import { ConferenceItem, TemplateItem, TemplateSection, ItemStatus } from '@/types';

const statusConfig: Record<ItemStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, className: 'bg-muted text-muted-foreground' },
  auto_ok: { label: 'Auto OK', icon: CheckCircle2, className: 'bg-status-completed/20 text-status-completed' },
  correct: { label: 'Correto', icon: CheckCircle2, className: 'bg-status-completed text-status-completed-foreground' },
  divergent: { label: 'Divergente', icon: AlertTriangle, className: 'bg-status-divergent text-status-divergent-foreground' },
  warn: { label: 'Atenção', icon: AlertTriangle, className: 'bg-amber-500/20 text-amber-600' },
  fail: { label: 'Falha', icon: X, className: 'bg-destructive text-destructive-foreground' },
};

export default function ConferenceExecution() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getConference, updateConferenceItem, executeQuery, copyLink, regenerateLink } = useConferences();
  const { getTemplate } = useTemplates();
  const { connections } = useConnections();
  
  const [conference, setConference] = useState(getConference(id || ''));
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [executingItems, setExecutingItems] = useState<Set<string>>(new Set());
  const [itemObservations, setItemObservations] = useState<Record<string, string>>({});
  
  const template = conference ? getTemplate(conference.templateId) : undefined;
  const connection = conference ? connections.find(c => c.id === conference.connectionId) : undefined;
  
  useEffect(() => {
    if (id) {
      const conf = getConference(id);
      setConference(conf);
      if (conf && template) {
        setExpandedSections(new Set(template.sections.map(s => s.id)));
      }
    }
  }, [id, getConference, template]);
  
  // Calculate progress
  const progress = useMemo(() => {
    if (!conference) return { completed: 0, total: 0, percentage: 0, divergent: 0 };
    
    const items = conference.items;
    const completed = items.filter(i => i.status !== 'pending').length;
    const divergent = items.filter(i => i.status === 'divergent' || i.userResponse === 'divergent').length;
    
    return {
      completed,
      total: items.length,
      percentage: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
      divergent,
    };
  }, [conference]);
  
  if (!conference || !template) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Conferência não encontrada</h2>
          <Button onClick={() => navigate('/conferences')}>Voltar</Button>
        </div>
      </div>
    );
  }
  
  const handleExecuteItem = async (item: ConferenceItem, templateItem: TemplateItem, storeId?: string) => {
    const itemKey = `${item.id}`;
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
        const value = conference.expectedInputValues[inputKey]?.value;
        if (value !== undefined) {
          query = query.replace(new RegExp(`:${templateItem.expectedInputBinding}`, 'g'), String(value));
        }
      }
      
      const result = await executeQuery(conference.id, item.id, query);
      
      if (result.success) {
        toast.success('Query executada com sucesso');
        // Refresh conference data
        setConference(getConference(conference.id));
      } else {
        toast.error(result.error || 'Erro ao executar query');
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
    const observation = itemObservations[item.id] || '';
    updateConferenceItem(conference.id, item.id, {
      userResponse: response,
      status: response,
      observation,
      respondedBy: 'admin',
    });
    setConference(getConference(conference.id));
    toast.success(response === 'correct' ? 'Item marcado como correto' : 'Item marcado como divergente');
  };
  
  const handleCopyLink = () => {
    const link = copyLink(conference);
    toast.success('Link copiado para a área de transferência', { description: link });
  };
  
  const handleRegenerateLink = () => {
    regenerateLink(conference.id);
    setConference(getConference(conference.id));
    toast.success('Novo link gerado com sucesso');
  };
  
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
  
  const getItemForSection = (templateItem: TemplateItem, storeId?: string): ConferenceItem | undefined => {
    if (templateItem.scope === 'global') {
      return conference.items.find(i => i.templateItemId === templateItem.id);
    }
    return conference.items.find(i => i.id === `${templateItem.id}_${storeId}`);
  };
  
  const renderItem = (templateItem: TemplateItem, section: TemplateSection, storeId?: string) => {
    const conferenceItem = getItemForSection(templateItem, storeId);
    if (!conferenceItem) return null;
    
    const status = statusConfig[conferenceItem.status];
    const StatusIcon = status.icon;
    const isExecuting = executingItems.has(conferenceItem.id);
    const store = storeId ? conference.stores.find(s => s.id === storeId) : undefined;
    
    // Filter by selected store
    if (selectedStore !== 'all' && templateItem.scope === 'per_store' && storeId !== selectedStore) {
      return null;
    }
    
    return (
      <Card key={conferenceItem.id} className="border-l-4" style={{ borderLeftColor: conferenceItem.status === 'divergent' ? 'hsl(var(--status-divergent))' : conferenceItem.status === 'correct' || conferenceItem.status === 'auto_ok' ? 'hsl(var(--status-completed))' : 'hsl(var(--border))' }}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{templateItem.title}</h4>
                <Badge variant="outline" className={status.className}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
                {templateItem.scope === 'per_store' && store && (
                  <Badge variant="secondary">
                    <Store className="h-3 w-3 mr-1" />
                    {store.name}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{templateItem.description}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExecuteItem(conferenceItem, templateItem, store?.storeId)}
                    disabled={isExecuting}
                  >
                    {isExecuting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Executar Query</TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          {/* Query preview */}
          <div className="p-3 bg-muted rounded-md">
            <code className="text-xs break-all">{templateItem.query}</code>
          </div>
          
          {/* Result */}
          {conferenceItem.queryResult && (
            <div className="p-3 bg-accent/50 rounded-md">
              <Label className="text-xs text-muted-foreground">Resultado:</Label>
              <pre className="text-sm mt-1 overflow-auto max-h-32">
                {JSON.stringify(conferenceItem.queryResult, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Response section */}
          {conferenceItem.status !== 'pending' && conferenceItem.status !== 'fail' && (
            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-2">
                <Label className="text-sm">Observação</Label>
                <Textarea
                  placeholder="Adicione uma observação (opcional)"
                  value={itemObservations[conferenceItem.id] || conferenceItem.observation || ''}
                  onChange={(e) => setItemObservations(prev => ({ ...prev, [conferenceItem.id]: e.target.value }))}
                  rows={2}
                />
              </div>
              
              {conferenceItem.userResponse ? (
                <div className="flex items-center gap-2">
                  <Badge className={conferenceItem.userResponse === 'correct' ? 'bg-status-completed' : 'bg-status-divergent'}>
                    {conferenceItem.userResponse === 'correct' ? 'Marcado como Correto' : 'Marcado como Divergente'}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-status-completed border-status-completed hover:bg-status-completed/10"
                    onClick={() => handleRespondItem(conferenceItem, 'correct')}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Correto
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-status-divergent border-status-divergent hover:bg-status-divergent/10"
                    onClick={() => handleRespondItem(conferenceItem, 'divergent')}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Divergente
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  
  const renderSection = (section: TemplateSection) => {
    const isExpanded = expandedSections.has(section.id);
    
    // Count items status in section
    const sectionItems = section.items.flatMap(item => {
      if (item.scope === 'global') {
        return [conference.items.find(i => i.templateItemId === item.id)].filter(Boolean);
      }
      return conference.stores.map(store => 
        conference.items.find(i => i.id === `${item.id}_${store.id}`)
      ).filter(Boolean);
    }) as ConferenceItem[];
    
    const completedCount = sectionItems.filter(i => i.status !== 'pending').length;
    const divergentCount = sectionItems.filter(i => i.status === 'divergent').length;
    
    return (
      <Collapsible key={section.id} open={isExpanded} onOpenChange={() => toggleSection(section.id)}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {completedCount}/{sectionItems.length}
                  </Badge>
                  {divergentCount > 0 && (
                    <Badge variant="outline" className="bg-status-divergent/10 text-status-divergent">
                      {divergentCount} divergências
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {section.items.map(templateItem => {
                if (templateItem.scope === 'global') {
                  return renderItem(templateItem, section);
                }
                // Render per store
                return conference.stores.map(store => renderItem(templateItem, section, store.id));
              })}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/conferences')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{conference.name}</h1>
            <p className="text-muted-foreground">
              {conference.clientName} • {conference.clientEmail}
            </p>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <span>{template.name} (v{template.version})</span>
              <span>•</span>
              <span>{connection?.name || 'Conexão desconhecida'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Link
          </Button>
          <Button variant="outline" size="sm" onClick={handleRegenerateLink}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Novo Link
          </Button>
        </div>
      </div>
      
      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso da Conferência</span>
            <span className="text-sm text-muted-foreground">
              {progress.completed} de {progress.total} itens ({progress.percentage}%)
            </span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
          {progress.divergent > 0 && (
            <p className="text-sm text-status-divergent mt-2">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              {progress.divergent} divergência(s) encontrada(s)
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* Store filter */}
      {conference.stores.length > 1 && (
        <div className="flex items-center gap-4">
          <Label>Filtrar por Loja:</Label>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Lojas</SelectItem>
              {conference.stores.map(store => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name} ({store.storeId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* Sections */}
      <div className="space-y-4">
        {template.sections
          .sort((a, b) => a.order - b.order)
          .map(renderSection)}
      </div>
    </div>
  );
}
