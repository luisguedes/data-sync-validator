import { useState } from 'react';
import { 
  Plus, Search, Filter, Clock, CheckCircle2, AlertTriangle,
  ClipboardCheck, Link as LinkIcon, Eye, MoreHorizontal, Trash2, Edit
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConferences } from '@/hooks/useConferences';
import { useTemplates } from '@/hooks/useTemplates';
import { useConnections } from '@/hooks/useConnections';
import { ConferenceFormModal, ConferenceFormData } from '@/components/conferences/ConferenceFormModal';
import { DeleteConferenceDialog } from '@/components/conferences/DeleteConferenceDialog';
import { toast } from 'sonner';
import type { ConferenceStatus, Conference } from '@/types';

const statusConfig = {
  pending: { label: 'Aguardando', icon: Clock, className: 'bg-status-pending text-status-pending-foreground' },
  in_progress: { label: 'Em Andamento', icon: ClipboardCheck, className: 'bg-status-in-progress text-status-in-progress-foreground' },
  completed: { label: 'Concluída', icon: CheckCircle2, className: 'bg-status-completed text-status-completed-foreground' },
  divergent: { label: 'Divergências', icon: AlertTriangle, className: 'bg-status-divergent text-status-divergent-foreground' },
};

export default function Conferences() {
  const navigate = useNavigate();
  const { conferences, searchTerm, setSearchTerm, statusFilter, setStatusFilter, createConference, deleteConference, copyLink, isLoading } = useConferences();
  const { allTemplates: templates } = useTemplates();
  const { allConnections: connections } = useConnections();
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedConference, setSelectedConference] = useState<Conference | null>(null);

  const handleCreate = () => {
    setSelectedConference(null);
    setIsFormModalOpen(true);
  };

  const handleSubmit = (data: ConferenceFormData) => {
    const template = templates.find(t => t.id === data.templateId);
    if (!template) return;
    createConference(data, template);
    toast.success('Conferência criada com sucesso');
    setIsFormModalOpen(false);
  };

  const handleDelete = (conference: Conference) => {
    setSelectedConference(conference);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedConference) {
      deleteConference(selectedConference.id);
      toast.success('Conferência excluída');
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCopyLink = (conference: Conference) => {
    copyLink(conference);
    toast.success('Link copiado!');
  };

  const getTemplateName = (id: string) => templates.find(t => t.id === id)?.name || 'Template desconhecido';
  const getConnectionName = (id: string) => connections.find(c => c.id === id)?.name || 'Conexão desconhecida';

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Conferências</h1>
          <p className="text-muted-foreground">Gerencie todas as conferências de migração</p>
        </div>
        <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />Nova Conferência</Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar conferências..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ConferenceStatus | 'all')}>
          <SelectTrigger className="w-[180px]"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Aguardando</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="divergent">Divergências</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {conferences.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma conferência encontrada. <Button variant="link" onClick={handleCreate}>Criar nova conferência</Button></CardContent></Card>
        ) : conferences.map((conference) => {
          const status = statusConfig[conference.status];
          const StatusIcon = status.icon;
          const completedItems = conference.items.filter(i => i.status !== 'pending').length;
          const progress = conference.items.length > 0 ? Math.round((completedItems / conference.items.length) * 100) : 0;

          return (
            <Card key={conference.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${status.className}`}><StatusIcon className="h-5 w-5" /></div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{conference.name}</h3>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{conference.clientName} • {conference.clientEmail}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{getTemplateName(conference.templateId)}</span><span>•</span><span>{getConnectionName(conference.connectionId)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">{completedItems}/{conference.items.length} itens</div>
                      <div className="w-32 h-2 bg-muted rounded-full mt-1">
                        <div className={`h-full rounded-full transition-all ${conference.status === 'divergent' ? 'bg-status-divergent' : conference.status === 'completed' ? 'bg-status-completed' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/conferences/${conference.id}`)}><Eye className="mr-2 h-4 w-4" />Ver</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleCopyLink(conference)}><LinkIcon className="mr-2 h-4 w-4" />Copiar Link</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(conference)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ConferenceFormModal open={isFormModalOpen} onOpenChange={setIsFormModalOpen} conference={selectedConference} templates={templates} connections={connections} onSubmit={handleSubmit} />
      <DeleteConferenceDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} conference={selectedConference} onConfirm={handleConfirmDelete} />
    </div>
  );
}
