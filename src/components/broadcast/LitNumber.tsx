import { Fragment } from 'react';
import { cn } from '@/lib/utils';

// Seven segments drawn as shapes, so there's no font to host. Each digit is 60 wide by 100 tall.
const SEGMENTS = [
  '6,0 54,0 46,10 14,10', // top
  '60,3 60,47 50,42 50,13', // top right
  '60,53 60,97 50,87 50,58', // bottom right
  '6,100 54,100 46,90 14,90', // bottom
  '0,53 10,58 10,87 0,97', // bottom left
  '0,3 10,13 10,42 0,47', // top left
  '4,50 14,44 46,44 56,50 46,56 14,56', // middle
];
const LIT: Record<string, number[]> = {
  '0': [0, 1, 2, 3, 4, 5],
  '1': [1, 2],
  '2': [0, 1, 3, 4, 6],
  '3': [0, 1, 2, 3, 6],
  '4': [1, 2, 5, 6],
  '5': [0, 2, 3, 5, 6],
  '6': [0, 2, 3, 4, 5, 6],
  '7': [0, 1, 2],
  '8': [0, 1, 2, 3, 4, 5, 6],
  '9': [0, 1, 2, 3, 5, 6],
  '-': [6],
};
const DIGIT_STEP = 72;
const MARK_STEP = 26;

function layOut(text: string) {
  let x = 0;
  const parts = [...text].map((char) => {
    const at = x;
    x += char in LIT ? DIGIT_STEP : MARK_STEP;
    return { char, at };
  });
  return { parts, width: Math.max(1, x - 12) };
}

/**
 * A number as a lit readout on a dark inset, leaning on the same line as the plates. The real text stays in the
 * page for screen readers. Fills its box with `fill`, otherwise sized from the text around it.
 */
export function LitNumber({ value, fill, className }: { value: string | number; fill?: boolean; className?: string }) {
  const text = String(value);
  const { parts, width } = layOut(text);
  return (
    <span className={cn('lit', fill && 'lit-fill', className)}>
      <span className="sr-only">{text}</span>
      <svg aria-hidden="true" viewBox={`0 0 ${width} 100`} preserveAspectRatio="xMidYMid meet">
        {parts.map(({ char, at }, index) => (
          <Fragment key={index}>
            {char in LIT &&
              SEGMENTS.map((points, segment) => (
                <polygon key={segment} points={points} transform={`translate(${at})`} className={LIT[char].includes(segment) ? 'lit-on' : 'lit-off'} />
              ))}
            {char === ':' && (
              <>
                <rect x={at + 2} y={26} width={10} height={12} className="lit-on" />
                <rect x={at + 2} y={62} width={10} height={12} className="lit-on" />
              </>
            )}
            {(char === '.' || char === ',') && <rect x={at + 2} y={88} width={10} height={12} className="lit-on" />}
          </Fragment>
        ))}
      </svg>
    </span>
  );
}

/** Words stay words, and every number in them becomes a little readout. "Round 6 of 12" carries two. */
export function LitText({ children }: { children: string }) {
  return (
    <>
      {children.split(/(\d[\d:,.]*\d|\d)/).map((part, index) => (index % 2 ? <LitNumber key={index} value={part} className="lit-inline" /> : part))}
    </>
  );
}
