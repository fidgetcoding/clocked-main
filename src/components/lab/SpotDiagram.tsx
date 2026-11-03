import { clockDegrees, clockHour, DISTANCE_FEET, HEIGHT_LABELS, positionName, type AngleSpot, type LabStance } from '@/lib/lab/angleSpots';

const RING = 78;
const BAG_AT = 38;

const polar = (degrees: number, radius: number) => {
  const r = (degrees * Math.PI) / 180;
  return { x: Math.sin(r) * radius, y: -Math.cos(r) * radius };
};

/** From above: you in the middle facing 12, the bag, and where the laptop goes, mirrored for southpaws. */
export function SpotDiagram({ spot, stance }: { spot: AngleSpot; stance: LabStance }) {
  const hour = clockHour(spot.angle, stance);
  const laptopDeg = clockDegrees(hour);
  const laptop = polar(laptopDeg, RING);
  // Clear of you, so the line never runs over your gloves or name
  const from = polar(laptopDeg, 22);
  // Past the bag and off to one side of the line, so it sits on nothing
  const along = polar(laptopDeg, RING * 0.72);
  const aside = polar(laptopDeg + 90, 10);
  const feet = { x: along.x + aside.x, y: along.y + aside.y };
  // Lead hand forward: the left for orthodox
  const leadX = stance === 'orthodox' ? -7 : 7;
  const faceLaptop = spot.bag === 'none';

  return (
    <figure className="w-full" data-testid="spot-diagram">
      <svg viewBox="-110 -110 220 220" className="w-full h-auto" role="img" aria-label={`Laptop at ${hour} o'clock`}>
        <circle r={RING} className="fill-none stroke-muted-foreground/40" strokeWidth={0.8} strokeDasharray="2 3" />
        {Array.from({ length: 12 }, (_, i) => {
          const h = i === 0 ? 12 : i;
          const p = polar(i * 30, RING + 14);
          return (
            <text key={h} x={p.x} y={p.y + 3.5} textAnchor="middle" className="fill-muted-foreground" fontSize={i % 3 === 0 ? 11 : 7} fontWeight={i % 3 === 0 ? 700 : 400}>
              {h}
            </text>
          );
        })}

        <line x1={from.x} y1={from.y} x2={laptop.x} y2={laptop.y} className="stroke-volt" strokeWidth={1.2} strokeDasharray="4 3" />
        <text x={feet.x} y={feet.y + 3} textAnchor="middle" className="fill-volt" fontSize={8} fontWeight={700}>
          {DISTANCE_FEET} FT
        </text>

        {spot.bag !== 'none' && (
          <g>
            <circle cx={0} cy={-BAG_AT} r={11} className="fill-surface-3 stroke-foreground" strokeWidth={1.2} />
            <text x={0} y={-BAG_AT + 3} textAnchor="middle" className="fill-foreground" fontSize={7} fontWeight={700}>
              BAG
            </text>
          </g>
        )}

        <g transform={faceLaptop ? `rotate(${laptopDeg})` : undefined}>
          <ellipse rx={13} ry={7} className="fill-foreground" />
          <circle r={5.5} className="fill-background stroke-foreground" strokeWidth={1.2} />
          <circle cx={leadX} cy={-14} r={4} className="fill-volt" />
          <circle cx={-leadX} cy={-9} r={4} className="fill-muted-foreground" />
          <text x={leadX * 2.4} y={-16} textAnchor="middle" className="fill-volt" fontSize={6} fontWeight={700}>
            LEAD
          </text>
          <text x={0} y={18} textAnchor="middle" className="fill-foreground" fontSize={7} fontWeight={700}>
            YOU
          </text>
        </g>

        {/* Your own sides, so the clock never has to be worked out */}
        <text x={-52} y={16} textAnchor="middle" className="fill-muted-foreground" fontSize={8} fontWeight={800}>
          YOUR LEFT
        </text>
        <text x={52} y={16} textAnchor="middle" className="fill-muted-foreground" fontSize={8} fontWeight={800}>
          YOUR RIGHT
        </text>
        <text x={0} y={40} textAnchor="middle" className="fill-muted-foreground" fontSize={8} fontWeight={800}>
          BEHIND YOU
        </text>

        <g transform={`translate(${laptop.x} ${laptop.y}) rotate(${laptopDeg})`}>
          <rect x={-14} y={-4} width={28} height={9} rx={1.5} className="fill-volt" />
          <rect x={-12} y={-2.5} width={24} height={2} className="fill-background" />
        </g>
      </svg>
      <figcaption className="mt-2 text-center text-2xl font-black uppercase tracking-wider text-volt">Laptop: {positionName(spot.angle, stance)} · {HEIGHT_LABELS[spot.height]}</figcaption>
    </figure>
  );
}
