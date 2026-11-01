import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { plateClass, type PlateOptions } from './plate-class';

interface PlateProps extends PlateOptions, HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
}

/** The basic graphic: on-air type on a slanted plate. */
export function Plate({ as: Tag = 'span', tone, back, bleed, className, children, ...props }: PlateProps) {
  return (
    <Tag className={cn(plateClass({ tone, back, bleed }), 'fx', className)} {...props}>
      {children}
    </Tag>
  );
}
