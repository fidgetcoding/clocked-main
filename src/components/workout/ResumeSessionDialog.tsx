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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pick up where you left off?</AlertDialogTitle>
          <AlertDialogDescription>{describeSavedSession(name, saved)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>
            Discard
          </AlertDialogCancel>
          <AlertDialogAction onClick={onResume}>
            Resume
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
