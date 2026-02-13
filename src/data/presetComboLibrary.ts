/**
 * Complete Preset Combo Library — 740 combos across 5 prestige tiers.
 * This is the FULL menu of every available combo in the app.
 * The loadout (comboPools.ts) uses a SUBSET of these.
 *
 * Notation: Punches as numbers (1-10), defense as SLIP L/R, ROLL L/R, PULL, CIRCLE L/R.
 */

export interface PresetCategory {
  name: string;
  combos: string[][];
}

export interface TierPresets {
  tier: string;
  categories: PresetCategory[];
}

// Helper: parse "1-2-slip left-3-roll L" → ['1','2','SLIP L','3','ROLL L']
const p = (s: string): string[] =>
  s.split('-').map(t => {
    const v = t.trim();
    switch (v) {
      case 'slip left': return 'SLIP L';
      case 'slip right': return 'SLIP R';
      case 'roll L': return 'ROLL L';
      case 'roll R': return 'ROLL R';
      case 'pullback': return 'PULL';
      case 'circle left': return 'CIRCLE L';
      case 'circle right': return 'CIRCLE R';
      default: return v;
    }
  });

const pm = (arr: string[]): string[][] => arr.map(p);

// ─── ROOKIE (75 combos) ──────────────────────────────
const ROOKIE: TierPresets = {
  tier: 'rookie',
  categories: [
    {
      name: '2-Punch Combos',
      combos: pm([
        '1-1','1-2','2-1','2-2','1-3','3-1','2-3','3-2','1-4','4-1',
        '1-5','5-1','1-6','6-1','2-4','4-2','2-5','5-2','2-6','6-2',
        '3-4','4-3','5-6','6-5','3-6',
      ]),
    },
    {
      name: '3-Punch Combos',
      combos: pm([
        '1-1-2','1-2-1','2-1-2','1-2-3','1-2-4','1-2-5','1-2-6','2-1-3',
        '2-1-6','2-3-2','2-3-4','3-2-1','3-2-3','3-2-5','1-3-2','1-4-3',
        '1-4-5','1-6-3','2-5-2','2-3-6','4-1-6','5-2-3','6-3-2','5-6-1',
        '6-1-2','1-5-2','2-6-3','3-4-1','4-3-2','5-2-5','6-5-2','1-6-5',
        '2-5-6','3-6-1','4-5-2',
      ]),
    },
    {
      name: '4-Punch Combos',
      combos: pm([
        '1-2-3-2','1-2-3-4','1-2-5-2','1-2-5-6','1-1-2-3','1-2-1-2',
        '2-3-2-1','1-6-3-2','1-2-3-6','2-1-2-3','5-2-3-2','6-5-2-3',
        '1-3-2-3','2-3-4-1','1-4-3-2',
      ]),
    },
  ],
};

// ─── BEGINNER (110 combos) ───────────────────────────
const BEGINNER: TierPresets = {
  tier: 'beginner',
  categories: [
    {
      name: '2-Punch Combos',
      combos: pm([
        '1-2','2-1','1-3','3-1','2-3','3-2','1-4','4-1','1-6','6-1',
        '5-2','2-5','6-3','4-3','3-4','5-6','6-5','1-5','2-6','4-5',
      ]),
    },
    {
      name: '3-Punch No Defense',
      combos: pm([
        '1-2-3','1-2-1','1-1-2','2-1-2','2-3-2','2-1-3','2-3-4','1-2-5',
        '2-1-6','1-3-2','3-2-3','1-6-3','5-2-3','6-3-2','1-4-5','2-5-2',
        '1-2-6','1-5-6','2-6-3','3-4-1','4-3-2','5-6-1','6-1-2','1-2-4',
        '3-2-1',
      ]),
    },
    {
      name: '3-Punch + Slip at End',
      combos: pm([
        '1-2-slip left','2-3-slip left','1-2-slip right','2-3-slip right',
        '3-2-slip left','3-2-slip right','1-3-slip left','2-1-slip right',
        '1-6-slip left','2-5-slip right','5-2-slip left','6-3-slip right',
        '1-4-slip left','4-3-slip right','1-1-slip left','2-2-slip right',
        '5-6-slip left','6-5-slip right','4-1-slip left','3-4-slip right',
      ]),
    },
    {
      name: '4-Punch + Slip at End',
      combos: pm([
        '1-2-3-slip left','2-1-3-slip left','1-1-2-slip left','2-3-2-slip left',
        '1-2-4-slip left','2-1-2-slip left','1-3-2-slip left','1-6-3-slip left',
        '2-5-2-slip left','1-2-3-slip right','2-1-2-slip right','1-2-5-slip left',
        '2-3-4-slip right','5-2-3-slip left','6-3-2-slip right',
      ]),
    },
    {
      name: 'Slip Mid-Combo',
      combos: pm([
        '1-slip left-2','2-slip right-3','1-slip left-3','2-slip left-1',
        '1-slip right-2','2-slip right-1','1-2-slip left-3','2-3-slip right-2',
        '1-slip left-3-2','1-slip right-2-3','2-slip left-3-slip left',
        '1-2-slip right-3-2','slip left-2-3','slip right-1-2-3','slip left-1-2',
        'slip right-2-3-2','1-slip left-6','2-slip right-5','slip left-3-2-1',
        'slip right-2-1-2',
      ]),
    },
    {
      name: '4-Punch No Defense',
      combos: pm([
        '1-2-3-2','1-2-5-2','1-6-3-2','1-2-3-4','1-1-2-3','2-3-2-1',
        '5-2-3-2','2-1-2-3','1-2-5-6','6-5-2-3',
      ]),
    },
  ],
};

// ─── INTERMEDIATE (150 combos) ───────────────────────
const INTERMEDIATE: TierPresets = {
  tier: 'intermediate',
  categories: [
    {
      name: '2-Punch Warmup',
      combos: pm([
        '1-2','2-1','2-3','3-2','1-3','1-6','5-2','2-4','6-1','4-3',
        '3-4','5-6','6-3','1-4','1-5','2-5','2-6','6-5','4-1','3-6',
      ]),
    },
    {
      name: '2-Punch + Defense',
      combos: pm([
        '1-2-slip left','2-3-slip right','1-slip left-2','2-slip right-3',
        'slip left-3-2','slip right-2-3','1-slip right-6','slip left-5-2',
        '2-slip left-2','1-2-slip right','1-2-roll L','2-3-roll R',
        'roll L-3-2','roll R-2-3','1-2-pullback',
      ]),
    },
    {
      name: '3-Punch + Slip',
      combos: pm([
        '1-2-3-slip left','1-slip left-3-2','2-3-slip right-2','1-2-slip left-3',
        'slip right-2-3-2','1-slip left-2-3','2-1-slip right-3','3-2-slip left-3',
        '1-slip left-5-2','slip left-6-3-2','2-3-slip left-5','1-slip right-6-3',
        '1-2-slip right-6','slip left-2-5-2','2-slip left-3-4','1-2-3-slip right',
        'slip right-1-2-3','2-slip right-3-2','1-slip left-4-3','slip left-3-4-1',
      ]),
    },
    {
      name: '3-Punch + Roll',
      combos: pm([
        '1-2-3-roll L','1-2-roll R-3','2-3-2-roll L','roll R-3-2','1-2-roll L-3',
        '2-roll R-3-2','1-6-roll L-3','3-2-roll R-3','1-2-3-roll R-3',
        '5-2-roll L-3','roll L-3-2-3','roll R-3-2-1','1-2-roll L-5',
        '2-3-roll R-2','roll L-5-2-3','roll R-6-3-2','1-roll L-3-2',
        '2-roll R-5-2','roll L-1-2-3','roll R-2-3-2',
      ]),
    },
    {
      name: '4-Punch Mixed Defense',
      combos: pm([
        '1-2-slip left-3-roll L','1-slip left-2-3-roll R-3','2-3-roll L-3-slip left',
        '1-2-roll R-3-2-slip left','slip right-2-3-roll L-3-2',
        '1-2-3-slip left-roll R-3-2','2-slip right-3-roll L-3',
        '1-6-slip left-3-roll R','roll L-3-2-slip left-3',
        'slip left-5-2-roll R-3-2','2-3-roll L-3-2','1-2-slip right-6-3',
        '1-2-3-2-slip left','2-3-2-roll L-3','1-slip left-3-2-roll R',
        '2-roll R-3-slip left-3','1-2-roll L-slip left-3',
        'slip right-3-2-roll L-3','roll L-2-3-slip right-2',
        '1-2-slip left-roll R-3','roll R-3-slip left-2-3',
        '1-2-3-pullback-2','2-3-2-pullback-1','1-2-pullback-3-2',
        'pullback-1-2-3',
      ]),
    },
    {
      name: 'Body Hook Combos',
      combos: pm([
        '1-2-7','1-2-8','7-2-3','8-1-2','1-7-2','2-8-3','1-2-7-2','1-2-8-3',
        '7-8-1-2','1-7-8-2','2-3-7-2','1-2-7-8','7-2-3-2','8-3-2-1',
        '1-7-2-3','2-8-1-2','3-7-2-8','1-2-7-slip left','2-3-8-roll L',
        '7-8-slip right-2','1-7-roll L-3','2-8-roll R-3-2','1-2-7-8-roll L',
        '7-2-slip left-3-2','8-3-roll R-1-2',
      ]),
    },
    {
      name: '5+ Punch Advanced',
      combos: pm([
        '1-2-3-2-1','1-2-5-6-3','1-2-3-4-1','2-3-2-3-2','1-1-2-3-2',
        '5-6-1-2-3','1-2-3-5-2','6-5-2-3-2','1-2-3-2-5','2-1-2-3-4',
        '1-2-7-8-3','7-8-1-2-3','1-2-3-7-2','2-3-7-8-2','1-7-2-3-2',
        '1-2-3-2-slip left-3','2-3-roll L-3-2-1','1-2-slip left-3-roll R-3',
        'slip right-2-3-2-roll L','1-2-3-roll L-3-slip left',
        'roll R-3-2-slip left-3-2','1-2-pullback-2-3-2','2-3-2-pullback-1-2',
        '1-slip left-2-3-2-roll L','2-roll R-3-2-slip left-3',
      ]),
    },
  ],
};

// ─── ADVANCED (175 combos) ───────────────────────────
const ADVANCED: TierPresets = {
  tier: 'advanced',
  categories: [
    {
      name: 'Warmup / Foundation',
      combos: pm([
        '1-2-slip left','2-3-roll L','1-2-pullback','2-3-slip right',
        '1-roll R-2','pullback-1-2','1-slip left-3','2-roll R-3',
        'slip right-2-1','roll L-3-2','1-2-roll L','2-3-pullback',
        'pullback-2-3','slip left-1-2','roll R-2-3',
      ]),
    },
    {
      name: '3-Punch + Defense',
      combos: pm([
        '1-2-3-slip left','2-3-2-roll L','1-2-3-pullback','2-1-2-slip right',
        '1-6-3-roll R','2-slip left-3-2','pullback-1-2-3','1-2-roll L-3',
        '1-slip left-2-3','2-roll R-3-2','slip right-1-2-3','roll L-3-2-3',
        '1-2-3-roll R','2-3-pullback-2','slip left-3-2-1','roll R-2-1-2',
        'pullback-2-3-2','1-slip right-6-3','2-roll L-5-2','slip left-5-2-3',
      ]),
    },
    {
      name: '4-Punch Mixed Defense',
      combos: pm([
        '1-2-3-2-slip left','1-2-slip left-3-2','2-3-2-roll L-3',
        '1-6-3-2-pullback','1-2-3-roll R-3-2','2-slip right-3-2-3',
        '1-2-pullback-2-3','5-2-3-2-slip left','1-2-7-8-roll L',
        '2-3-slip left-5-2','pullback-1-2-3-2','1-2-roll R-5-6',
        '6-3-2-slip right-3','1-7-2-8-slip left','1-2-3-slip left-2',
        '2-3-roll R-3-2','1-slip left-2-3-2','roll L-3-2-1-2',
        'pullback-2-3-2-1','slip right-2-3-4-1','1-2-7-slip left-3',
        '2-8-3-roll L-2','7-8-2-slip right-3','1-2-8-pullback-3',
        '2-7-roll R-3-2',
      ]),
    },
    {
      name: '5-Punch All Defense Types',
      combos: pm([
        '1-2-3-roll L-3-2-slip left','1-slip left-2-3-pullback-2',
        '2-3-slip right-5-2-roll R','1-2-roll L-3-2-pullback',
        '6-3-2-slip left-3-roll R-3','1-2-3-slip left-roll L-3-2',
        '2-pullback-1-2-3-slip left','1-7-8-slip right-2-3',
        '5-2-roll L-3-2-slip left','1-2-slip left-5-roll R-3-2',
        'pullback-2-3-roll L-3-slip left','2-3-2-pullback-1-6-3',
        '1-2-3-pullback-2-3-2','2-slip right-3-2-roll L-3',
        '1-roll R-3-2-slip left-3','pullback-1-2-roll L-3-2',
        'slip left-2-3-pullback-2-3','1-2-roll R-3-slip left-3-2',
        '2-3-slip left-roll L-3-2','1-pullback-2-3-2-slip left',
        'roll L-3-2-pullback-1-2','slip right-2-roll L-3-2-1',
        '1-2-7-roll R-3-2-pullback','2-8-slip left-3-roll L-3',
        '1-7-2-slip right-8-roll L',
      ]),
    },
    {
      name: 'Body-Head Combinations',
      combos: pm([
        '7-3','8-2','7-2-3','8-1-2','1-2-7-3','1-2-8-2','7-8-3-2',
        '7-3-2-1','8-2-3-2','1-7-3-2','2-8-2-3','1-2-7-3-2','7-8-1-2-3',
        '1-7-8-3-2','2-8-7-2-3','1-2-7-2-8','7-3-slip left-2',
        '8-2-roll L-3','1-2-7-slip right-3','7-8-roll L-3-2',
        '1-7-pullback-2-3','2-8-slip left-3-roll R','7-3-2-pullback-8',
        '8-2-3-slip left-7','1-7-8-slip right-2-3',
      ]),
    },
    {
      name: 'Power Combinations — KO Sequences',
      combos: pm([
        '2-3-2','2-3-4','5-2-3','6-5-2','5-6-3-2','6-5-2-3','2-3-2-3',
        '5-2-3-4','6-3-4-2','2-5-2-3','6-5-6-3','5-2-5-6','2-3-6-5-2',
        '5-6-3-2-3','6-5-2-3-2','2-5-6-3-2','5-6-5-2-3','6-3-2-5-6',
        '2-3-2-5-6-3','5-6-3-2-3-2',
      ]),
    },
    {
      name: 'Full Armada — 6+ Moves',
      combos: pm([
        '1-2-3-slip left-roll L-3-2-pullback',
        '2-slip right-3-2-roll R-5-2-3',
        '1-2-pullback-1-2-3-slip left-3-2',
        '6-5-2-3-roll L-3-slip left-2',
        '1-slip left-2-3-roll R-3-pullback-2-3',
        '2-3-2-slip right-5-6-roll L-3-2',
        '1-2-7-roll R-3-2-pullback-8',
        'pullback-1-2-slip left-3-roll L-3-2',
        '1-2-3-roll R-5-2-slip left-3-2',
        '2-7-8-slip right-1-2-3-roll L-3',
        '1-2-3-2-pullback-5-6-3-2',
        '7-8-slip left-2-3-roll R-3-2',
        '1-2-slip left-7-roll L-3-2-pullback',
        '2-3-roll R-8-slip left-3-2-1',
        '1-pullback-2-3-slip left-roll L-3-2',
        'slip right-2-3-2-roll R-5-6-3',
        '1-2-roll L-7-8-slip left-3-2',
        '2-slip right-3-pullback-1-2-3-2',
        'roll L-3-2-slip left-5-6-pullback-2',
        '1-7-2-8-roll R-3-2-slip left-3',
      ]),
    },
    {
      name: 'Counter-Punching Patterns',
      combos: pm([
        'slip left-2','slip right-3','roll L-3-2','roll R-2-3','pullback-1-2',
        'slip left-2-3','slip right-3-2','roll L-3-2-1','roll R-2-3-2',
        'pullback-1-2-3','slip left-2-3-2','slip right-3-2-3','roll L-5-2-3',
        'roll R-6-3-2','pullback-2-3-2','slip left-2-roll L-3',
        'slip right-3-roll R-2','roll L-3-slip left-2-3',
        'pullback-2-slip left-3-2','slip left-6-3-roll R-2',
        'slip right-5-2-roll L-3','roll L-3-2-pullback-2',
        'pullback-1-2-slip left-3','roll R-2-3-slip right-2',
        'slip left-2-3-roll L-3-2',
      ]),
    },
  ],
};

// ─── PRO (230 combos) ────────────────────────────────
const PRO: TierPresets = {
  tier: 'pro',
  categories: [
    {
      name: 'Warmup / All-Defense Foundation',
      combos: pm([
        '1-2-3-slip left-roll L','2-slip right-3-2-roll R',
        '1-slip left-2-3-roll L','6-3-2-roll R-slip left',
        '2-3-roll L-3-slip right','1-2-slip left-3-roll R-3',
        'roll L-3-2-slip left-2','1-6-slip right-3-roll L',
        '1-2-3-pullback-circle left','2-slip right-3-roll R-circle right',
        '1-pullback-2-3-circle left','2-3-2-circle right-pullback',
        'slip left-3-2-pullback-circle left','1-2-circle right-slip left-3',
        'circle left-1-2-3-pullback','pullback-circle right-2-3-2',
        '1-2-3-roll L-circle left-2','slip right-5-2-circle left-3',
        'circle right-2-3-slip left-roll L','1-pullback-circle left-2-3',
      ]),
    },
    {
      name: 'Circle Footwork Combos',
      combos: pm([
        '1-2-circle left','2-3-circle right','1-2-3-circle left',
        '2-3-2-circle right','circle left-1-2','circle right-2-3',
        '1-2-circle left-3','2-3-circle right-2','circle left-1-2-3',
        'circle right-2-3-2','1-2-3-circle left-2','2-3-2-circle right-3',
        'circle left-3-2-1','circle right-2-1-2','1-circle left-2-3',
        '2-circle right-3-2','circle left-5-2-3','circle right-6-3-2',
        '1-2-circle left-5-2','2-3-circle right-6-3',
        'circle left-1-2-circle right','1-2-3-circle left-2-3',
        'circle right-2-3-circle left-1-2','1-circle left-2-circle right-3',
        'circle left-circle right-1-2-3',
      ]),
    },
    {
      name: 'Weaved 4+ Punch',
      combos: pm([
        '1-2-slip left-3-2-roll L-3',
        '2-3-roll R-3-2-pullback-circle left',
        '1-6-slip right-3-2-roll L-5',
        '1-2-3-slip left-roll R-3-2-circle right',
        '2-pullback-1-2-3-circle left-2',
        '5-6-roll L-3-2-slip left-3',
        '1-2-circle right-1-2-3-roll L',
        '7-8-slip left-2-3-roll R-3',
        '1-slip right-6-3-pullback-2-3',
        '2-3-2-slip left-5-6-roll L',
        'circle left-1-2-7-roll R-3-2',
        '1-2-pullback-5-6-3-slip left',
        'slip right-2-3-circle left-1-2-roll L',
        '1-7-slip left-2-8-roll R-3-2',
        '1-2-roll L-circle left-3-2-1',
        '2-3-slip right-circle right-1-2-3',
        'pullback-1-2-3-circle left-slip left-2',
        'circle right-2-3-roll L-3-slip left',
        '1-2-circle left-pullback-2-3-2',
        'slip left-3-roll R-circle right-2-3',
        '1-2-7-circle left-8-roll R-3',
        '2-8-slip right-circle left-3-2-1',
        '7-8-roll L-circle right-2-3-2',
        'circle left-7-2-8-slip left-3-2',
        '1-2-slip left-circle right-3-roll L-3',
      ]),
    },
    {
      name: 'True Pro — 5+ Punch Full Armada',
      combos: pm([
        '1-2-3-slip left-roll L-3-2-pullback-2-3',
        '2-slip right-3-2-roll R-5-2-3-circle left',
        '1-2-pullback-1-2-3-slip left-3-2-roll L',
        '6-5-2-3-roll R-3-slip left-2-circle right',
        '1-slip left-2-3-roll L-3-pullback-2-3-2',
        '2-3-2-slip right-5-6-roll R-3-2-slip left',
        '1-2-circle left-1-6-3-roll L-3-2-pullback',
        '7-8-slip right-2-3-roll R-5-2-circle left-3',
        '1-2-3-slip left-roll L-3-2-pullback-circle right-2-3',
        '2-pullback-1-2-slip left-3-roll R-5-6-3-2',
        'circle right-1-2-7-roll L-3-2-slip left-8-2',
        '1-slip right-6-5-2-roll R-3-pullback-1-2-3',
        '1-2-3-2-slip left-roll L-3-pullback-circle left-2',
        '2-3-circle right-1-2-slip left-3-roll R-3-2',
        'pullback-1-2-circle left-3-roll L-3-2-slip left',
        '1-7-8-roll R-3-2-pullback-circle right-2-3',
        'slip left-2-3-roll L-7-8-circle left-3-2-1',
        '2-8-circle right-1-2-3-slip left-roll L-3-2',
        '1-2-pullback-7-circle left-3-roll R-slip left-2-3',
        'circle left-1-2-3-slip right-roll R-5-6-3-pullback',
        '1-2-3-roll L-circle right-2-3-slip left-5-2',
        '2-slip right-7-8-roll L-3-circle left-2-pullback',
        '1-6-circle right-2-3-slip left-roll L-3-2-pullback',
        '7-2-8-slip left-3-roll R-circle right-1-2-3',
        'pullback-circle left-1-2-slip right-3-roll L-3-2-1',
      ]),
    },
    {
      name: 'Body-Head Attack Patterns',
      combos: pm([
        '7-3','8-2','7-3-2','8-2-3','7-8-3-2','1-2-7-3','1-2-8-2',
        '7-2-3-2','8-3-2-1','1-7-8-3-2','2-8-7-2-3','7-8-1-2-3',
        '1-2-7-3-2','7-3-slip left-2-3','8-2-roll R-3-2',
        '1-7-slip left-3-2','2-8-roll L-3-pullback',
        '7-8-slip right-2-3-circle left','1-7-8-roll R-3-2-slip left',
        '2-8-7-pullback-2-3-circle right','7-3-2-circle left-1-2',
        '8-2-3-circle right-2-1','1-2-7-8-circle left-3-2',
        '7-8-circle right-5-6-3-2','1-7-2-8-3-circle left-2-pullback',
      ]),
    },
    {
      name: 'Counter-Punching Mastery',
      combos: pm([
        'slip left-2-3','slip right-3-2','roll L-3-2-1','roll R-2-3-2',
        'pullback-1-2-3','circle left-1-2','circle right-2-3',
        'slip left-2-circle right-3','slip right-3-circle left-2',
        'roll L-3-circle right-2-3','roll R-2-circle left-3-2',
        'pullback-2-circle left-1-2','circle left-1-slip right-3-2',
        'circle right-2-slip left-3-2','slip left-6-3-roll R-circle left',
        'slip right-5-2-roll L-circle right','pullback-2-3-circle left-1',
        'circle left-slip left-2-3-roll R','roll L-3-circle right-2-pullback',
        'slip left-2-pullback-3-circle left','circle right-roll L-3-2-slip left',
        'pullback-circle left-1-2-3-roll R','slip right-circle right-2-3-pullback',
        'roll R-slip left-2-3-circle left-1',
        'circle left-circle right-1-2-pullback-3',
      ]),
    },
    {
      name: 'Speed Combinations — Rapid Fire',
      combos: pm([
        '1-1-2','1-1-1-2','1-2-1-2','1-1-2-3','1-2-1','2-1-2-1',
        '1-1-2-1-2','1-2-1-2-3','1-1-2-3-2','2-1-1-2-3','1-1-1-2-3',
        '1-2-1-1-2','1-1-2-1-2-3','2-1-2-1-2','1-1-2-slip left-3',
        '1-2-1-slip right-3','1-1-2-roll L-3','1-2-1-2-slip left',
        '1-1-2-3-slip right','2-1-1-2-circle left',
      ]),
    },
    {
      name: 'Pressure Combinations — Inside Fighting',
      combos: pm([
        '5-6','5-6-3','6-5-2','3-5-6','5-6-3-2','6-5-2-3','3-4-5-6',
        '5-6-5-6','6-5-6-3','5-2-5-6','3-4-3-4','5-6-3-4','6-5-3-4',
        '5-6-7-8','7-8-5-6','5-6-3-2-3','6-5-2-3-2','3-5-6-3-2',
        '5-6-7-8-3','7-8-5-6-3-2',
      ]),
    },
    {
      name: 'Signature Fight Patterns',
      combos: pm([
        '1-2-3-roll L-3','1-2-slip left-3-2','2-3-2-slip right-2',
        '1-2-3-pullback-2-3','slip left-2-3-roll L-3-2',
        '1-2-roll R-3-2-circle left','pullback-1-2-slip left-3-2',
        'circle right-2-3-slip left-roll L-3',
        '1-slip left-2-roll R-3-pullback-2',
        '2-roll L-3-slip right-2-circle left',
        '1-2-3-circle right-slip left-3-roll L',
        'pullback-circle left-2-3-roll R-3-2',
        'slip right-2-circle right-3-roll L-pullback',
        '1-7-slip left-8-roll R-3-circle left-2',
        '2-8-circle right-7-slip left-3-roll L-2',
      ]),
    },
    {
      name: 'Body Uppercut Combos — 9 & 10',
      combos: pm([
        // 2-3 Punch
        '9-3','10-2','9-10','1-9','2-10','9-2-3','10-3-2','1-2-9','1-2-10',
        '9-10-3-2',
        // Body Attack Patterns — Mixed 7-10
        '7-9-3','8-10-2','9-7-3-2','10-8-2-3','1-2-9-10','7-8-9-10',
        '1-9-10-3','2-10-9-2','9-7-8-3-2','10-8-7-2-3',
        // Full Body-Head Combos with 9-10
        '9-3-2-slip left','10-2-3-roll L','1-2-9-slip right-3',
        '9-10-roll L-3-2','7-9-3-circle left-2','8-10-2-circle right-3',
        '1-2-9-10-3-2-slip left','9-7-3-pullback-2-10',
        '1-9-slip left-10-roll R-3-2',
        '7-8-9-10-circle left-3-2-pullback',
      ]),
    },
    {
      name: '2-Punch Body Uppercuts',
      combos: pm([
        '1-9','2-10','9-2','10-1','9-3','10-3','5-10','9-6',
      ]),
    },
    {
      name: '3-Punch Body Uppercuts',
      combos: pm([
        '1-2-9','1-2-10','1-9-2','2-10-3','9-2-3','10-1-2','9-10-3',
        '10-9-2','1-9-3','2-10-2','7-9-3','8-10-2','9-3-2','10-2-3','9-10-2',
      ]),
    },
    {
      name: '4-Punch Body Uppercuts',
      combos: pm([
        '1-2-9-3','1-2-10-3','1-9-2-3','2-10-3-2','9-10-1-2','10-9-2-3',
        '1-2-9-10','7-8-9-10','9-3-2-1','10-2-3-2','1-9-10-3','2-10-9-2',
        '9-2-10-3','7-9-3-2','8-10-2-3',
      ]),
    },
    {
      name: 'Body Uppercut + Defense',
      combos: pm([
        '1-2-9-slip left','2-10-slip right-3','9-slip left-2-3',
        '10-roll L-3-2','1-9-roll R-3-2','2-10-pullback-1-2',
        '9-10-slip left-3-2','1-2-9-circle left','2-10-circle right-3',
        '9-roll L-3-circle right','10-slip right-2-circle left',
        '1-9-10-roll L-3-2',
      ]),
    },
    {
      name: '5+ Punch Body Uppercut Combos',
      combos: pm([
        '1-2-9-10-3-2','7-8-9-10-1-2','1-9-2-10-3-2',
        '9-10-slip left-3-2-1','1-2-7-9-3-roll L','2-8-10-slip right-3-2',
        '9-10-7-8-circle left-3-2','1-2-9-slip left-10-roll R-3',
        '7-9-8-10-slip left-3-2','1-2-9-10-circle right-3-pullback',
      ]),
    },
  ],
};

// ─── Exports ─────────────────────────────────────────

export const PRESET_COMBO_LIBRARY: Record<string, TierPresets> = {
  rookie: ROOKIE,
  beginner: BEGINNER,
  intermediate: INTERMEDIATE,
  advanced: ADVANCED,
  pro: PRO,
};

/**
 * Get all preset combos for a specific tier, flattened into ComboPreset format
 * for backwards compatibility with the existing picker.
 */
export function getPresetsByTier(tier: string): { categories: PresetCategory[] } {
  return PRESET_COMBO_LIBRARY[tier] || { categories: [] };
}

/**
 * Get ALL presets for a tier as a flat array of combos (for search/filtering).
 */
export function getAllPresetsFlat(tier: string): string[][] {
  const lib = PRESET_COMBO_LIBRARY[tier];
  if (!lib) return [];
  return lib.categories.flatMap(c => c.combos);
}
