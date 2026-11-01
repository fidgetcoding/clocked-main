import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FitTextProps {
  children: ReactNode;
  className?: string;
  /** Largest size to reach, in px, whatever the box. */
  max?: number;
  align?: 'left' | 'center' | 'right';
  /** Height of a line relative to the type size. */
  lineHeight?: number;
}

const MEASURE_SIZE = 200;

/**
 * Fills its box with one line of type: the clock, a headline. The box takes its size from the
 * layout (flex or a set height), and the text never pushes it around, so the graphics around it hold still.
 */
export function FitText({ children, className, max = 1200, align = 'left', lineHeight = 0.86 }: FitTextProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const key = typeof children === 'string' ? children.length : undefined;

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const fit = () => {
      text.style.fontSize = `${MEASURE_SIZE}px`;
      const width = text.scrollWidth || 1;
      const height = box.clientHeight;
      const byWidth = (box.clientWidth / width) * MEASURE_SIZE;
      const byHeight = height > 0 ? height / lineHeight : Infinity;
      text.style.fontSize = `${Math.floor(Math.min(max, byWidth, byHeight))}px`;
    };

    fit();
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) fit();
    });
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [key, max, lineHeight]);

  return (
    <div ref={boxRef} className={cn('relative min-w-0 w-full', className)}>
      <span
        ref={textRef}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 whitespace-nowrap',
          align === 'left' && 'left-0',
          align === 'right' && 'right-0',
          align === 'center' && 'left-1/2 -translate-x-1/2',
        )}
        style={{ lineHeight }}
      >
        {children}
      </span>
    </div>
  );
}
