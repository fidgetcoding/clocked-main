/**
 * Combo pools organized by tier with escalating difficulty segments.
 * Each tier has 10 rounds split into named segments.
 * Combos are arrays of strings: punches (1-8) and defense moves.
 * 
 * Selection rules:
 * 1. Default = RANDOM within each segment
 * 2. No combo repeats within same workout (if pool large enough)
 * 3. If pool ≤ round count, allow repeats but never back-to-back
 * 4. User can toggle SEQUENTIAL in settings
 * 5. Combos pre-selected at workout generation, not during playback
 */

export type TierName = 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro';

export interface ComboPoolSegment {
  name: string;
  rounds: [number, number]; // [startRound, endRound] inclusive, 1-indexed
  pool: string[][]; // array of combos, each combo is an array of moves
}

export interface TierComboPools {
  tier: TierName;
  segments: ComboPoolSegment[];
}

// ─── ROOKIE ────────────────────────────────────────────
// 4 Easy + 3 Medium + 3 Hard
// No defense. Punches 1-3 first, introduce 4 in medium, 5-6 in hard.
const ROOKIE_POOLS: TierComboPools = {
  tier: 'rookie',
  segments: [
    {
      name: 'Easy',
      rounds: [1, 4],
      pool: [
        ['1', '1'],
        ['1', '2'],
        ['2', '1'],
        ['2', '2'],
        ['1', '3'],
        ['2', '3'],
        ['3', '2'],
        ['3', '1'],
      ],
    },
    {
      name: 'Medium',
      rounds: [5, 7],
      pool: [
        ['1', '1', '2'],
        ['2', '1', '2'],
        ['1', '2', '3'],
        ['1', '2', '1'],
        ['2', '3', '2'],
        ['2', '1', '3'],
        ['3', '2', '1'],
        ['1', '3', '2'],
        ['1', '2', '4'],
        ['2', '3', '4'],
        ['3', '2', '3'],
        ['1', '4', '3'],
      ],
    },
    {
      name: 'Hard',
      rounds: [8, 10],
      pool: [
        ['1', '2', '5'],
        ['2', '1', '6'],
        ['5', '2', '3'],
        ['6', '3', '2'],
        ['1', '6', '3'],
        ['2', '5', '2'],
        ['3', '2', '5'],
        ['4', '1', '6'],
        ['1', '4', '5'],
        ['2', '3', '6'],
        ['5', '6', '1'],
        ['6', '1', '2'],
      ],
    },
  ],
};

// ─── BEGINNER ──────────────────────────────────────────
// 2 Warmup + 3 Build + 3 Slip Intro + 2 Advanced Slip
const BEGINNER_POOLS: TierComboPools = {
  tier: 'beginner',
  segments: [
    {
      name: 'Warmup',
      rounds: [1, 2],
      pool: [
        ['1', '2'], ['2', '1'], ['1', '3'], ['2', '3'],
        ['3', '2'], ['3', '1'], ['1', '4'], ['4', '1'],
        ['1', '6'], ['6', '1'], ['5', '2'], ['2', '5'],
        ['6', '3'], ['4', '3'], ['3', '4'], ['5', '6'],
      ],
    },
    {
      name: 'Build',
      rounds: [3, 5],
      pool: [
        ['1', '2', '3'], ['1', '2', '1'], ['1', '1', '2'],
        ['2', '1', '2'], ['2', '3', '2'], ['2', '1', '3'],
        ['2', '3', '4'], ['1', '2', '5'], ['2', '1', '6'],
        ['1', '3', '2'], ['3', '2', '3'], ['1', '6', '3'],
        ['5', '2', '3'], ['6', '3', '2'], ['1', '4', '5'],
        ['2', '5', '2'],
      ],
    },
    {
      name: 'Slip Intro',
      rounds: [6, 8],
      pool: [
        ['1', '2', 'slip left'], ['2', '3', 'slip left'],
        ['1', '2', '3', 'slip left'], ['2', '1', '3', 'slip left'],
        ['1', '1', '2', 'slip left'], ['2', '3', '2', 'slip left'],
        ['3', '2', 'slip left'], ['1', '2', '4', 'slip left'],
        ['2', '1', '2', 'slip left'], ['1', '3', '2', 'slip left'],
        ['1', '6', '3', 'slip left'], ['2', '5', '2', 'slip left'],
      ],
    },
    {
      name: 'Advanced Slip',
      rounds: [9, 10],
      pool: [
        ['1', 'slip left', '2'], ['2', 'slip right', '3'],
        ['1', '2', 'slip left', '3'], ['2', '3', 'slip right', '2'],
        ['1', 'slip left', '3', '2'], ['1', 'slip right', '2', '3'],
        ['2', 'slip left', '3', 'slip left'],
        ['1', '2', 'slip right', '3', '2'],
        ['slip left', '2', '3'], ['slip right', '1', '2', '3'],
      ],
    },
  ],
};

// ─── INTERMEDIATE ──────────────────────────────────────
// 1 Warmup + 2 Slip Foundation + 2 Slip Combos + 3 Roll Intro + 2 Combined
const INTERMEDIATE_POOLS: TierComboPools = {
  tier: 'intermediate',
  segments: [
    {
      name: 'Warmup',
      rounds: [1, 1],
      pool: [
        ['1', '2'], ['2', '1'], ['2', '3'], ['3', '2'],
        ['1', '3'], ['1', '6'], ['5', '2'], ['2', '4'],
        ['6', '1'], ['4', '3'], ['3', '4'], ['5', '6'],
        ['6', '3'], ['1', '4'],
      ],
    },
    {
      name: 'Slip Foundation',
      rounds: [2, 3],
      pool: [
        ['1', '2', 'slip left'], ['2', '3', 'slip right'],
        ['1', 'slip left', '2'], ['2', 'slip right', '3'],
        ['slip left', '3', '2'], ['slip right', '2', '3'],
        ['1', 'slip right', '6'], ['slip left', '5', '2'],
        ['2', 'slip left', '2'], ['1', '2', 'slip right'],
      ],
    },
    {
      name: 'Slip Combos',
      rounds: [4, 5],
      pool: [
        ['1', '2', '3', 'slip left'], ['1', 'slip left', '3', '2'],
        ['2', '3', 'slip right', '2'], ['1', '2', 'slip left', '3'],
        ['slip right', '2', '3', '2'], ['1', 'slip left', '2', '3'],
        ['2', '1', 'slip right', '3'], ['3', '2', 'slip left', '3'],
        ['1', 'slip left', '5', '2'], ['slip left', '6', '3', '2'],
        ['2', '3', 'slip left', '5'], ['1', 'slip right', '6', '3'],
      ],
    },
    {
      name: 'Roll Introduction',
      rounds: [6, 8],
      pool: [
        ['1', '2', '3', 'roll L'], ['1', '2', 'roll R', '3'],
        ['2', '3', '2', 'roll L'], ['roll R', '3', '2'],
        ['1', '2', 'roll L', '3'], ['2', 'roll R', '3', '2'],
        ['1', '6', 'roll L', '3'], ['3', '2', 'roll R', '3'],
        ['1', '2', '3', 'roll R', '3'], ['5', '2', 'roll L', '3'],
        ['roll L', '3', '2', '3'], ['roll R', '3', '2', '1'],
      ],
    },
    {
      name: 'Combined',
      rounds: [9, 10],
      pool: [
        ['1', '2', 'slip left', '3', 'roll L'],
        ['1', 'slip left', '2', '3', 'roll R', '3'],
        ['2', '3', 'roll L', '3', 'slip left'],
        ['1', '2', 'roll R', '3', '2', 'slip left'],
        ['slip right', '2', '3', 'roll L', '3', '2'],
        ['1', '2', '3', 'slip left', 'roll R', '3', '2'],
        ['2', 'slip right', '3', 'roll L', '3'],
        ['1', '6', 'slip left', '3', 'roll R'],
        ['roll L', '3', '2', 'slip left', '3'],
        ['slip left', '5', '2', 'roll R', '3', '2'],
        ['2', '3', 'roll L', '3', '2'],
        ['1', '2', 'slip right', '6', '3'],
      ],
    },
  ],
};

// ─── ADVANCED ──────────────────────────────────────────
// 1 Warmup + 1 Build + 3 Mid + 3 Advanced + 2 Full Armada
const ADVANCED_POOLS: TierComboPools = {
  tier: 'advanced',
  segments: [
    {
      name: 'Warmup',
      rounds: [1, 1],
      pool: [
        ['1', '2', 'slip left'], ['2', '3', 'roll L'],
        ['1', '2', 'pullback'], ['2', '3', 'slip right'],
        ['1', 'roll R', '2'], ['pullback', '1', '2'],
      ],
    },
    {
      name: 'Build',
      rounds: [2, 2],
      pool: [
        ['1', '2', '3', 'slip left'], ['2', '3', '2', 'roll L'],
        ['1', '2', '3', 'pullback'], ['2', '1', '2', 'slip right'],
        ['1', '6', '3', 'roll R'], ['2', 'slip left', '3', '2'],
        ['pullback', '1', '2', '3'], ['1', '2', 'roll L', '3'],
      ],
    },
    {
      name: 'Mid',
      rounds: [3, 5],
      pool: [
        ['1', '2', '3', '2', 'slip left'],
        ['1', '2', 'slip left', '3', '2'],
        ['2', '3', '2', 'roll L', '3'],
        ['1', '6', '3', '2', 'pullback'],
        ['1', '2', '3', 'roll R', '3', '2'],
        ['2', 'slip right', '3', '2', '3'],
        ['1', '2', 'pullback', '2', '3'],
        ['5', '2', '3', '2', 'slip left'],
        ['1', '2', '7', '8', 'roll L'],
        ['2', '3', 'slip left', '5', '2'],
        ['pullback', '1', '2', '3', '2'],
        ['1', '2', 'roll R', '5', '6'],
        ['6', '3', '2', 'slip right', '3'],
        ['1', '7', '2', '8', 'slip left'],
      ],
    },
    {
      name: 'Advanced',
      rounds: [6, 8],
      pool: [
        ['1', '2', '3', 'roll L', '3', '2', 'slip left'],
        ['1', 'slip left', '2', '3', 'pullback', '2'],
        ['2', '3', 'slip right', '5', '2', 'roll R'],
        ['1', '2', 'roll L', '3', '2', 'pullback'],
        ['6', '3', '2', 'slip left', '3', 'roll R', '3'],
        ['1', '2', '3', 'slip left', 'roll L', '3', '2'],
        ['2', 'pullback', '1', '2', '3', 'slip left'],
        ['1', '7', '8', 'slip right', '2', '3'],
        ['5', '2', 'roll L', '3', '2', 'slip left'],
        ['1', '2', 'slip left', '5', 'roll R', '3', '2'],
        ['pullback', '2', '3', 'roll L', '3', 'slip left'],
        ['2', '3', '2', 'pullback', '1', '6', '3'],
      ],
    },
    {
      name: 'Full Armada',
      rounds: [9, 10],
      pool: [
        ['1', '2', '3', 'slip left', 'roll L', '3', '2', 'pullback'],
        ['2', 'slip right', '3', '2', 'roll R', '5', '2', '3'],
        ['1', '2', 'pullback', '1', '2', '3', 'slip left', '3', '2'],
        ['6', '5', '2', '3', 'roll L', '3', 'slip left', '2'],
        ['1', 'slip left', '2', '3', 'roll R', '3', 'pullback', '2', '3'],
        ['2', '3', '2', 'slip right', '5', '6', 'roll L', '3', '2'],
        ['1', '2', '7', 'roll R', '3', '2', 'pullback', '8'],
        ['pullback', '1', '2', 'slip left', '3', 'roll L', '3', '2'],
        ['1', '2', '3', 'roll R', '5', '2', 'slip left', '3', '2'],
        ['2', '7', '8', 'slip right', '1', '2', '3', 'roll L', '3'],
      ],
    },
  ],
};

// ─── PRO ───────────────────────────────────────────────
// 2 Warmup + 2 All-Defense + 3 Weaved 4+ Punch + 3 True Pro 5+ Punch
const PRO_POOLS: TierComboPools = {
  tier: 'pro',
  segments: [
    {
      name: 'Warmup',
      rounds: [1, 2],
      pool: [
        ['1', '2', '3', 'slip left', 'roll L'],
        ['2', 'slip right', '3', '2', 'roll R'],
        ['1', 'slip left', '2', '3', 'roll L'],
        ['6', '3', '2', 'roll R', 'slip left'],
        ['2', '3', 'roll L', '3', 'slip right'],
        ['1', '2', 'slip left', '3', 'roll R', '3'],
        ['roll L', '3', '2', 'slip left', '2'],
        ['1', '6', 'slip right', '3', 'roll L'],
      ],
    },
    {
      name: 'All Defense',
      rounds: [3, 4],
      pool: [
        ['1', '2', '3', 'pullback', 'circle left'],
        ['2', 'slip right', '3', 'roll R', 'circle right'],
        ['1', 'pullback', '2', '3', 'circle left'],
        ['2', '3', '2', 'circle right', 'pullback'],
        ['slip left', '3', '2', 'pullback', 'circle left'],
        ['1', '2', 'circle right', 'slip left', '3'],
        ['circle left', '1', '2', '3', 'pullback'],
        ['pullback', 'circle right', '2', '3', '2'],
        ['1', '2', '3', 'roll L', 'circle left', '2'],
        ['slip right', '5', '2', 'circle left', '3'],
      ],
    },
    {
      name: 'Weaved 4+ Punch',
      rounds: [5, 7],
      pool: [
        ['1', '2', 'slip left', '3', '2', 'roll L', '3'],
        ['2', '3', 'roll R', '3', '2', 'pullback', 'circle left'],
        ['1', '6', 'slip right', '3', '2', 'roll L', '5'],
        ['1', '2', '3', 'slip left', 'roll R', '3', '2', 'circle right'],
        ['2', 'pullback', '1', '2', '3', 'circle left', '2'],
        ['5', '6', 'roll L', '3', '2', 'slip left', '3'],
        ['1', '2', 'circle right', '1', '2', '3', 'roll L'],
        ['7', '8', 'slip left', '2', '3', 'roll R', '3'],
        ['1', 'slip right', '6', '3', 'pullback', '2', '3'],
        ['2', '3', '2', 'slip left', '5', '6', 'roll L'],
        ['circle left', '1', '2', '7', 'roll R', '3', '2'],
        ['1', '2', 'pullback', '5', '6', '3', 'slip left'],
        ['slip right', '2', '3', 'circle left', '1', '2', 'roll L'],
        ['1', '7', 'slip left', '2', '8', 'roll R', '3', '2'],
      ],
    },
    {
      name: 'True Pro',
      rounds: [8, 10],
      pool: [
        ['1', '2', '3', 'slip left', 'roll L', '3', '2', 'pullback', '2', '3'],
        ['2', 'slip right', '3', '2', 'roll R', '5', '2', '3', 'circle left'],
        ['1', '2', 'pullback', '1', '2', '3', 'slip left', '3', '2', 'roll L'],
        ['6', '5', '2', '3', 'roll R', '3', 'slip left', '2', 'circle right'],
        ['1', 'slip left', '2', '3', 'roll L', '3', 'pullback', '2', '3', '2'],
        ['2', '3', '2', 'slip right', '5', '6', 'roll R', '3', '2', 'slip left'],
        ['1', '2', 'circle left', '1', '6', '3', 'roll L', '3', '2', 'pullback'],
        ['7', '8', 'slip right', '2', '3', 'roll R', '5', '2', 'circle left', '3'],
        ['1', '2', '3', 'slip left', 'roll L', '3', '2', 'pullback', 'circle right', '2', '3'],
        ['2', 'pullback', '1', '2', 'slip left', '3', 'roll R', '5', '6', '3', '2'],
        ['circle right', '1', '2', '7', 'roll L', '3', '2', 'slip left', '8', '2'],
        ['1', 'slip right', '6', '5', '2', 'roll R', '3', 'pullback', '1', '2', '3'],
      ],
    },
  ],
};

// ─── Exports ───────────────────────────────────────────

export const COMBO_POOLS: Record<TierName, TierComboPools> = {
  rookie: ROOKIE_POOLS,
  beginner: BEGINNER_POOLS,
  intermediate: INTERMEDIATE_POOLS,
  advanced: ADVANCED_POOLS,
  pro: PRO_POOLS,
};

/**
 * Select combos for a 10-round workout from the tier's pools.
 * @param tier - The user's experience tier
 * @param sequential - If true, pick combos in pool order; otherwise random
 * @returns Array of 10 combos (one per round)
 */
export function selectCombosForWorkout(
  tier: TierName,
  sequential: boolean = false
): string[][] {
  const pools = COMBO_POOLS[tier];
  const selected: string[][] = [];
  const usedIndices = new Map<number, Set<number>>(); // segmentIndex -> used pool indices

  for (const [segIdx, segment] of pools.segments.entries()) {
    const [start, end] = segment.rounds;
    const roundCount = end - start + 1;
    const pool = segment.pool;
    usedIndices.set(segIdx, new Set());

    for (let r = 0; r < roundCount; r++) {
      if (sequential) {
        selected.push(pool[r % pool.length]);
      } else {
        // Random without repeats (if pool large enough)
        const used = usedIndices.get(segIdx)!;
        let availableIndices = Array.from({ length: pool.length }, (_, i) => i)
          .filter(i => !used.has(i));

        // If exhausted, reset but avoid back-to-back
        if (availableIndices.length === 0) {
          used.clear();
          availableIndices = Array.from({ length: pool.length }, (_, i) => i);
          // Avoid back-to-back
          const lastCombo = selected[selected.length - 1];
          if (lastCombo) {
            const lastIdx = pool.findIndex(c => c === lastCombo);
            if (lastIdx >= 0 && availableIndices.length > 1) {
              availableIndices = availableIndices.filter(i => i !== lastIdx);
            }
          }
        }

        const pick = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        used.add(pick);
        selected.push(pool[pick]);
      }
    }
  }

  return selected;
}
