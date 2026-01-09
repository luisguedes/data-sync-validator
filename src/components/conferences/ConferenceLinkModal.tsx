import { useState } from 'react';
import { Copy, Mail, Check, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Conference } from '@/types';

interface ConferenceLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conference: Conference | null;
  onResendEmail: (conference: Conference) => Promise<{ success: boolean; message: string }>;
  onRegenerateLink: (id: string) => Conference | null;
}

export function ConferenceLinkModal({
  open,
  onOpenChange,
  conference,
  onResendEmail,
  onRegenerateLink,
}: ConferenceLinkModalProps) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!conference) return null;

  const link = `${window.location.origin}/client/${conference.linkToken}`;
  const expiresAt = format(new Date(conference.linkExpiresAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResendEmail = async () => {
    setSending(true);
    setEmailResult(null);
    try {
      const result = await onResendEmail(conference);
      setEmailResult(result);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } finally {
      setSending(false);
    }
  };

  const handleRegenerateLink = () => {
    setRegenerating(true);
    try {
      const updated = onRegenerateLink(conference.id);
      if (updated) {
        toast.success('Novo link gerado com sucesso!');
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleOpenLink = () => {
    window.open(link, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Conferência Criada!
            <Badge variant="outline" className="bg-status-completed/10 text-status-completed">
              Sucesso
            </Badge>
          </DialogTitle>
          <DialogDescription>
            A conferência <strong>{conference.name}</strong> foi criada. Compartilhe o link abaixo com {conference.clientName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Link Section */}
          <div className="space-y-2">
            <Label>Link de Acesso</Label>
            <div className="flex gap-2">
              <Input value={link} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-status-completed" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={handleOpenLink}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Expiration Info */}
          <div className="text-sm text-muted-foreground">
            ⏱️ Link válido até: <strong>{expiresAt}</strong>
          </div>

          {/* Client Info */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="text-sm font-medium">{conference.clientName}</p>
            <p className="text-sm text-muted-foreground">{conference.clientEmail}</p>
          </div>

          {/* Email Result */}
          {emailResult && (
            <Alert variant={emailResult.success ? 'default' : 'destructive'}>
              <AlertDescription>{emailResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button onClick={handleResendEmail} disabled={sending} className="w-full">
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {sending ? 'Enviando...' : 'Enviar Email para Cliente'}
            </Button>
            
            <Button variant="outline" onClick={handleRegenerateLink} disabled={regenerating}>
              {regenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Gerar Novo Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
