import { cn } from '@/lib/utils';

export type PlateTone = 'lime' | 'white' | 'black' | 'red' | 'graphite' | 'steel' | 'gold' | 'outline' | 'clear';
export type PlateBleed = 'left' | 'right' | 'both';

export interface PlateOptions {
  tone?: PlateTone;
  /** Leans the other way. Defense plates do this, so a slip reads differently from a jab across the room. */
  back?: boolean;
  /** Runs off the edge of the screen. */
  bleed?: PlateBleed;
}

export const plateClass = ({ tone = 'graphite', back, bleed }: PlateOptions = {}) =>
  cn(
    'plate',
    `plate-${tone}`,
    back && 'plate-back',
    (bleed === 'left' || bleed === 'both') && 'plate-bleed-l',
    (bleed === 'right' || bleed === 'both') && 'plate-bleed-r',
  );
