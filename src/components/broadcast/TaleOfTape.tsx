import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TapeRow {
  label: string;
  left: ReactNode;
  right: ReactNode;
}

interface TaleOfTapeProps {
  left?: ReactNode;
  right?: ReactNode;
  rows: TapeRow[];
  className?: string;
}

/** Two columns of numbers with the label down the middle, the way a fight broadcast compares fighters. */
export function TaleOfTape({ left, right, rows, className }: TaleOfTapeProps) {
  return (
    <div className={className}>
      {(left || right) && (
        <div className="tape-row border-0 py-1">
          <b className="fx text-[2.75rem] !text-foreground">{left}</b>
          <span className="fx text-2xl text-volt">vs</span>
          <b className="fx text-[2.75rem]">{right}</b>
        </div>
      )}
      {rows.map((row) => (
        <TapeLine key={row.label} {...row} />
      ))}
    </div>
  );
}

export function TapeLine({ label, left, right, className }: TapeRow & { className?: string }) {
  return (
    <div className={cn('tape-row', className)}>
      <b className="fx">{left}</b>
      <span className="lab">{label}</span>
      <b className="fx">{right}</b>
    </div>
  );
}
