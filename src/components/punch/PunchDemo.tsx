import { useEffect, useMemo, useRef, useState } from 'react';
import { PUNCH_LABELS } from '@/lib/punch/round';
import { DEMO_BONES, DEMO_PEAK_FRAME, DEMO_SECONDS, demoPoseAt, punchDemoFrames, type DemoJoint } from '@/lib/punch/punchDemo';
import type { PunchClass, Stance } from '@/lib/punch/types';
import { cn } from '@/lib/utils';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED_MOTION).matches);
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_MOTION);
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

const fixed = (n: number) => n.toFixed(1);

/** A small looping stick fighter throwing the punch, mirrored for southpaws. The throwing arm is lit. */
export function PunchDemo({ punch, stance, className }: { punch: PunchClass; stance: Stance; className?: string }) {
  const still = usePrefersReducedMotion();
  const demo = useMemo(() => punchDemoFrames(punch, stance), [punch, stance]);
  const svg = useRef<SVGSVGElement>(null);

  // Moves the joints straight on the DOM each frame, so the loop never re-renders the calibration screen
  useEffect(() => {
    const root = svg.current;
    if (still || !demo || !root) return;
    const lines = Array.from(root.querySelectorAll<SVGLineElement>('line[data-from]'));
    const dots = Array.from(root.querySelectorAll<SVGCircleElement>('circle[data-joint]'));
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const pose = demoPoseAt(demo.frames, (now - start) / 1000 / DEMO_SECONDS, demo.arc);
      for (const line of lines) {
        const a = pose[line.dataset.from as DemoJoint];
        const b = pose[line.dataset.to as DemoJoint];
        line.setAttribute('x1', fixed(a[0]));
        line.setAttribute('y1', fixed(a[1]));
        line.setAttribute('x2', fixed(b[0]));
        line.setAttribute('y2', fixed(b[1]));
      }
      for (const dot of dots) {
        const at = pose[dot.dataset.joint as DemoJoint];
        dot.setAttribute('cx', fixed(at[0]));
        dot.setAttribute('cy', fixed(at[1]));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [demo, still]);

  if (!demo) return null;

  const { frames, side, arrow, viewBox } = demo;
  const shown = frames[still ? DEMO_PEAK_FRAME : 0];
  const throwing = (joint: DemoJoint) => joint === `${side}Shoulder` || joint === `${side}Elbow` || joint === `${side}Wrist`;
  const glove: DemoJoint = side === 'l' ? 'lWrist' : 'rWrist';
  const otherWrist: DemoJoint = side === 'l' ? 'rWrist' : 'lWrist';
  const bone = ([from, to]: readonly [DemoJoint, DemoJoint]) => {
    const lit = throwing(to);
    return (
      <line
        key={`${from}-${to}`}
        data-from={from}
        data-to={to}
        x1={shown[from][0]}
        y1={shown[from][1]}
        x2={shown[to][0]}
        y2={shown[to][1]}
        className={lit ? 'stroke-volt' : 'stroke-foreground'}
        strokeOpacity={lit ? 1 : 0.75}
        strokeWidth={lit ? 10 : 8}
        strokeLinecap="round"
      />
    );
  };

  return (
    <svg
      ref={svg}
      viewBox={viewBox}
      className={cn('h-28 w-auto shrink-0', className)}
      role="img"
      aria-label={`How to throw a ${PUNCH_LABELS[punch].toLowerCase()}`}
      data-testid="punch-demo"
      data-punch={punch}
    >
      {DEMO_BONES.filter(([, to]) => !throwing(to)).map(bone)}
      {/* Which way the glove travels: straight, round, or up. Over the body, under the lit arm */}
      <path d={arrow.path} fill="none" className="stroke-volt" strokeOpacity={0.85} strokeWidth={4} strokeLinecap="round" />
      <polygon points={arrow.head} className="fill-volt" fillOpacity={0.85} />
      {DEMO_BONES.filter(([, to]) => throwing(to)).map(bone)}
      <circle data-joint="head" cx={shown.head[0]} cy={shown.head[1]} r={13} className="fill-foreground" fillOpacity={0.75} />
      <circle data-joint={otherWrist} cx={shown[otherWrist][0]} cy={shown[otherWrist][1]} r={6} className="fill-foreground" fillOpacity={0.75} />
      <circle data-joint={glove} cx={shown[glove][0]} cy={shown[glove][1]} r={10} className="fill-volt" />
    </svg>
  );
}
