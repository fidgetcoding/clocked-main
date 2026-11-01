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
import { describeSavedSession, type SessionSnapshot } from '@/lib/sessionRecovery';

interface ResumeSessionDialogProps {
  name: string;
  saved: SessionSnapshot;
  onResume: () => void;
  onDiscard: () => void;
}

export function ResumeSessionDialog({ name, saved, onResume, onDiscard }: ResumeSessionDialogProps) {
  return (
    <AlertDialog open>
      <AlertDialogContent className="bg-surface-1 border-surface-3">
        <AlertDialogHeader>
          <AlertDialogTitle>Pick up where you left off?</AlertDialogTitle>
          <AlertDialogDescription>{describeSavedSession(name, saved)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onDiscard} className="bg-surface-2 border-surface-3 hover:bg-surface-3">
            Discard
          </AlertDialogCancel>
          <AlertDialogAction onClick={onResume} className="bg-volt text-primary-foreground hover:bg-volt/90">
            Resume
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
