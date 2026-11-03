import {
  ANGLE_POINTS,
  ANGLE_SPOTS,
  countedShare,
  HEIGHT_NAMES,
  HEIGHTS,
  positionName,
  spotTitle,
  type AngleSpot,
  type LabRow,
  type LabStance,
} from '@/lib/lab/angleSpots';

interface Props {
  stance: LabStance;
  current: AngleSpot;
  rows: Record<string, LabRow>;
  skipped: string[];
  disabled: boolean;
  onPick: (spot: AngleSpot) => void;
}

/** Every spot at a glance, position by height, plus the checks. Done spots show how much they counted. */
export function SpotGrid({ stance, current, rows, skipped, disabled, onPick }: Props) {
  const button = (spot: AngleSpot, label: string) => {
    const row = rows[spot.id];
    const state = row ? 'done' : skipped.includes(spot.id) ? 'skipped' : 'todo';
    const tone = row ? 'bg-volt/20 text-foreground' : state === 'skipped' ? 'bg-surface-3/40 text-muted-foreground line-through' : 'bg-surface-3/70';
    return (
      <button
        key={spot.id}
        data-spot-state={state}
        aria-label={`Spot ${spot.id}: ${spotTitle(spot, stance)}`}
        disabled={disabled}
        onClick={() => onPick(spot)}
        className={`w-full rounded-lg px-1.5 py-2 text-sm font-bold tabular-nums ${tone} ${spot === current ? 'ring-2 ring-volt' : ''} disabled:opacity-60`}
      >
        {row ? `${Math.round(countedShare(row.score) * 100)}%` : label}
      </button>
    );
  };

  return (
    <div className="space-y-4" data-testid="spot-grid">
      <table className="w-full border-separate border-spacing-1 text-left">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted-foreground">
            <th className="font-semibold">Spot</th>
            {HEIGHTS.map((height) => (
              <th key={height} className="font-semibold text-center">
                {HEIGHT_NAMES[height]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ANGLE_POINTS.map((point) => (
            <tr key={point.angle}>
              <th className="pr-1 text-sm font-bold whitespace-nowrap">{positionName(point.angle, stance)}</th>
              {HEIGHTS.map((height) => {
                const spot = ANGLE_SPOTS.find((candidate) => !candidate.check && candidate.angle === point.angle && candidate.height === height)!;
                return <td key={height}>{button(spot, spot.id)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-2">
        {ANGLE_SPOTS.filter((spot) => spot.check).map((spot) => (
          <div key={spot.id}>
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{spot.check === 'swing' ? 'Swing check' : 'No bag'}</p>
            {button(spot, spot.id)}
          </div>
        ))}
      </div>
    </div>
  );
}
