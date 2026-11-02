import { Plate, FitText } from '@/components/broadcast';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

// Colour bars for a dead channel, on the same slant as everything else
const BARS = ['bg-foreground', 'bg-volt', 'bg-muted-foreground', 'bg-alert-red', 'bg-surface-3', 'bg-volt', 'bg-tech-black'];

const NotFound = () => {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-tech-black">
      <div className="relative min-h-24 flex-1 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-y-0 -inset-x-10 grid -skew-x-[14deg] grid-cols-7">
          {BARS.map((bar, index) => (
            <i key={index} className={cn('block', bar)} />
          ))}
        </div>
      </div>
      <Plate tone="white" bleed="both" className="-mt-6 flex w-full px-4 py-2">
        <FitText className="h-16 sm:h-24 [@media(max-height:500px)]:h-12" max={110}>Please stand by</FitText>
      </Plate>
      <div className="mx-auto w-full max-w-[46rem] px-4 pt-4">
        <h1 className="fx text-[clamp(2.75rem,12vw,4rem)]">404</h1>
        <p className="fx mt-1 text-3xl">Oops! Page not found</p>
        <p className="prose-w mt-2 text-lg leading-snug">
          There's no fight on this channel. The ring announcer has been talking for an hour.
        </p>
        <a href="/" className={cn(buttonVariants({ size: 'lg' }), 'my-4 w-full [@media(max-height:500px)]:h-12 [@media(max-height:500px)]:text-2xl')}>
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
