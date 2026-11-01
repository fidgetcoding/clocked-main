import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export type LogoKind = 'word' | 'mark' | 'watch';

interface LogoProps {
  kind?: LogoKind;
  className?: string;
}

/** The real logo as a mask, so it takes the current text colour. */
export function Logo({ kind = 'word', className }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="Clocked"
      className={cn('brand-logo', className)}
      style={{ '--logo': `url(${import.meta.env.BASE_URL}brand/logo-${kind}.png)` } as CSSProperties}
    />
  );
}
