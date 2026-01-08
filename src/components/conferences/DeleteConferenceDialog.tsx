import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Conference } from '@/types';

interface DeleteConferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conference: Conference | null;
  onConfirm: () => void;
}

export function DeleteConferenceDialog({
  open,
  onOpenChange,
  conference,
  onConfirm,
}: DeleteConferenceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Conferência</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a conferência{' '}
            <span className="font-semibold text-foreground">{conference?.name}</span>?
            <br />
            <br />
            Esta ação não pode ser desfeita. O link do cliente deixará de funcionar e todos os
            dados da conferência serão perdidos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
