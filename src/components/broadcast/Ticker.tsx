import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface TickerProps {
  items: (string | null | undefined | false)[];
  tone?: 'lime' | 'dark';
  paused?: boolean;
  className?: string;
}

// Enough copies that the crawl never shows a gap on a wide screen
const TARGET_WIDTH_CHARS = 420;
const PIXELS_PER_SECOND_PER_CHAR = 0.16;

/** The crawl along the bottom. It only ever carries real numbers. */
export function Ticker({ items, tone = 'lime', paused, className }: TickerProps) {
  const shown = items.filter((item): item is string => !!item);
  if (shown.length === 0) return null;

  const length = shown.join('').length + shown.length * 6;
  const copies = Math.max(2, Math.ceil(TARGET_WIDTH_CHARS / length));
  const style = {
    '--ticker-shift': `-${100 / copies}%`,
    '--ticker-duration': `${Math.max(16, length * PIXELS_PER_SECOND_PER_CHAR * 3)}s`,
  } as CSSProperties;

  const row = (key: number, hidden: boolean) => (
    <span key={key} aria-hidden={hidden || undefined}>
      {shown.map((item, index) => (
        <span key={index}>
          {item}
          <i aria-hidden="true">///</i>
        </span>
      ))}
    </span>
  );

  return (
    <div className={cn('ticker', tone === 'dark' && 'ticker-dark', paused && 'ticker-paused', className)} data-ticker>
      <div className="ticker-track" style={style}>
        {Array.from({ length: copies }, (_, index) => row(index, index > 0))}
      </div>
    </div>
  );
}
