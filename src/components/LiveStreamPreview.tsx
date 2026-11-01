import { Radio } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface LiveStreamPreviewProps {
  onClose: () => void;
}

const PLANNED = [
  'Stream a session to your club',
  'Chat by text or voice while you train',
  "See who's training with you",
];

// Where live training will go once it's built. Nothing here is real yet, so it shows no viewers,
// chat or running timer that could pass for a stream.
export const LiveStreamPreview = ({ onClose }: LiveStreamPreviewProps) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent data-testid="live-stream-preview" className="max-w-sm">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <DialogTitle>Live training</DialogTitle>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground">
            Preview
          </span>
        </div>
        <DialogDescription>This is a preview. Nothing is streaming and nobody is watching.</DialogDescription>
      </DialogHeader>

      <div className="aspect-video rounded-lg bg-gradient-to-br from-surface-1 to-surface-2 flex flex-col items-center justify-center gap-2">
        <Radio className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Your session would show here</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">What's coming</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {PLANNED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </DialogContent>
  </Dialog>
);
