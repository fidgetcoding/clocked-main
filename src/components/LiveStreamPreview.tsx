import { OnAir, Plate } from '@/components/broadcast';
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
// chat, running timer or footage that could pass for a stream.
export const LiveStreamPreview = ({ onClose }: LiveStreamPreviewProps) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent data-testid="live-stream-preview" className="sm:max-w-sm">
      <DialogHeader>
        <Plate tone="graphite" className="h-8 w-fit px-3 text-xl">Preview</Plate>
        <DialogTitle>Live training</DialogTitle>
        <DialogDescription>This is a preview. Nothing is streaming and nobody is watching.</DialogDescription>
      </DialogHeader>

      {/* Two empty feeds split on the slant, the way a shared round would sit */}
      <div className="relative aspect-video max-h-[45dvh] w-full overflow-hidden bg-surface-1">
        <div className="absolute inset-y-0 -right-8 left-[58%] -skew-x-[14deg] bg-surface-2" />
        <div className="absolute inset-y-0 left-[58%] w-1.5 -skew-x-[14deg] bg-volt" />
        <OnAir state="off" className="absolute left-3 top-3">Not on air</OnAir>
        <p className="lab lab-w absolute bottom-3 left-3 max-w-[48%]">Your session would show here</p>
      </div>

      <div>
        <h3 className="fx mb-1 text-2xl">What's coming</h3>
        <ul>
          {PLANNED.map((item) => (
            <li key={item} className="prose-w border-b border-surface-3 py-1.5 text-base">{item}</li>
          ))}
        </ul>
      </div>
    </DialogContent>
  </Dialog>
);
