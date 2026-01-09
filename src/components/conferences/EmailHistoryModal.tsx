import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mail, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmailHistoryEntry } from '@/types';

interface EmailHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailHistory: EmailHistoryEntry[];
  conferenceName: string;
}

const statusConfig = {
  pending: {
    label: 'Aguardando',
    icon: Clock,
    className: 'bg-status-pending text-status-pending-foreground',
  },
  sent: {
    label: 'Enviado',
    icon: CheckCircle2,
    className: 'bg-status-completed text-status-completed-foreground',
  },
  failed: {
    label: 'Falhou',
    icon: XCircle,
    className: 'bg-status-divergent text-status-divergent-foreground',
  },
};

const typeLabels = {
  conference_link: 'Link da Conferência',
  reminder: 'Lembrete',
  completion: 'Conclusão',
};

export function EmailHistoryModal({
  open,
  onOpenChange,
  emailHistory,
  conferenceName,
}: EmailHistoryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Histórico de Emails
          </DialogTitle>
          <DialogDescription>
            Emails enviados para a conferência "{conferenceName}"
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96">
          {emailHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Mail className="h-10 w-10 mb-3 opacity-50" />
              <p>Nenhum email enviado ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emailHistory.map((entry) => {
                const status = statusConfig[entry.status];
                const StatusIcon = status.icon;

                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${status.className}`}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {typeLabels[entry.type]}
                        </Badge>
                        <Badge className={`text-xs ${status.className}`}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">
                        {entry.subject}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Para: {entry.to}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(entry.sentAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {entry.error && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {entry.error}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
