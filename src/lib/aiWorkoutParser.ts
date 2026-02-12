// =====================================================
// AI Workout Parser - Block-based multi-phase parsing
// =====================================================

import { parseComboString, extractCombosFromPrompt, containsComboNotation } from './comboParser';
import { Workout, WorkoutPhase, WorkoutSegment } from '@/types';
import { HistoryInsights, getAdjustedDifficulty, getAdjustedRestDuration, getAdjustedRounds } from './workoutHistoryAnalysis';
import { detectBagType, detectAllSpeedBagDrills, detectSpeedBagDrill, containsSpeedBagVocabulary, DetectedBagType } from '@/data/speedBagDrills';

// =====================================================
// Default Durations
// =====================================================

export const DEFAULT_DURATIONS = {
  boxingRound: 180,
  boxingRest: 60,
  warmup: 300,
  cooldown: 300,
  sprint: 30,
  jog: 60,
  jumpRope: 120,
  strengthSet: 30,
  strengthRest: 30,
  hiitWork: 30,
  hiitRest: 15,
} as const;

// =====================================================
// Keyword Detection
// =====================================================

export const KEYWORD_TAGS: Record<string, string[]> = {
  boxing: ['box', 'punch', 'jab', 'cross', 'hook', 'uppercut', 'combo', 'heavy bag', 'shadowbox', 'sparring', 'mitt', 'double end bag', 'double-end bag'],
  cardio: ['cardio', 'jump rope', 'run', 'sprint', 'jog', 'treadmill', 'conditioning'],
  hiit: ['hiit', 'interval', 'tabata', 'circuit', 'amrap', 'emom'],
  strength: ['pushup', 'pullup', 'squat', 'burpee', 'plank', 'situp', 'curlup', 'strength'],
  defense: ['slip', 'roll', 'duck', 'parry', 'block', 'defense', 'defensive'],
  footwork: ['footwork', 'movement', 'circle', 'step', 'pivot', 'angle'],
};

// =====================================================
// Parsed Result Types
// =====================================================

export interface ParsedPhase {
  name: string;
  phaseType: 'continuous' | 'circuit' | 'rest';
  section: 'warmup' | 'grind' | 'cooldown';
  repeats: number;
  segments: ParsedSegment[];
  combos?: string[][];
  comboOrder?: 'sequential' | 'random';
}

export interface ParsedSegment {
  name: string;
  type: 'active' | 'rest';
  segmentType?: 'work' | 'rest' | 'shadowboxing' | 'combo' | 'speedbag' | 'doubleend';
  duration: number;
  exercise?: string;
  activityType?: 'combos' | 'shadowbox' | 'run' | 'pushups' | 'custom';
  reps?: number;
}

export interface ParsedWorkoutResult {
  name: string;
  rounds?: number;
  roundDuration?: number;
  restDuration?: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  combos: string[][];
  phases: ParsedPhase[];
  tags: string[];
  megasetRepeats: number;
  hasWarmup: boolean;
  hasCooldown: boolean;
  parsedRounds: boolean;
  parsedDurations: boolean;
  parsedCombos: boolean;
  hasMultipleBlocks: boolean;
}

// =====================================================
// Block-based parsing types
// =====================================================

interface SupersetExercise {
  name: string;
  duration: number;
}

interface ParsedBlock {
  rawText: string;
  section: 'warmup' | 'grind' | 'cooldown';
  rounds: number;
  workDuration: number;
  restDuration: number;
  noRest: boolean;
  activityName: string;
  perRoundActivities: Array<{ name: string; round: number }>;
  combos: string[][];
  superset: SupersetExercise[] | null;
  supersetRestBetween: number | null;
  speedBagDrills: string[][];
}

// =====================================================
// ORDINAL MAP for "First round", "Second round", etc.
// =====================================================

const ORDINAL_MAP: Record<string, number> = {
  'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
  'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5,
};

// =====================================================
// Step 1: Split prompt into blocks
// =====================================================

function splitIntoBlocks(prompt: string): string[] {
  // Split on double newlines first
  let blocks = prompt.split(/\n\s*\n/).filter(b => b.trim().length > 0);
  
  // If only one block, try splitting on single newlines
  if (blocks.length <= 1) {
    blocks = prompt.split(/\n/).filter(b => b.trim().length > 0);
  }
  
  // If still one block, try splitting on sentences that start with a round count
  if (blocks.length <= 1) {
    const text = prompt.trim();
    // Split when we see "N round(s)" at a sentence boundary
    const parts: string[] = [];
    const pattern = /(?:^|(?<=\.\s+))(\d+\s+rounds?\b)/gi;
    let lastIdx = 0;
    let match;
    
    // Use a simpler approach: split on ". " followed by digit+round
    const sentences = text.split(/\.\s+/);
    let currentBlock = '';
    
    for (const sentence of sentences) {
      const startsWithRounds = /^\d+\s+rounds?\b/i.test(sentence.trim());
      if (startsWithRounds && currentBlock.trim()) {
        parts.push(currentBlock.trim());
        currentBlock = sentence;
      } else {
        currentBlock += (currentBlock ? '. ' : '') + sentence;
      }
    }
    if (currentBlock.trim()) {
      parts.push(currentBlock.trim());
    }
    
    if (parts.length > 1) {
      blocks = parts;
    }
  }
  
  return blocks;
}

// =====================================================
// Step 2: Classify a block's section
// =====================================================

function classifySection(text: string): 'warmup' | 'grind' | 'cooldown' {
  const lower = text.toLowerCase();
  if (/\b(warm\s*up|warmup)\b/i.test(lower)) return 'warmup';
  if (/\b(cool\s*down|cooldown)\b/i.test(lower)) return 'cooldown';
  return 'grind';
}

// =====================================================
// Step 3: Parse durations from a block
// =====================================================

function parseDurationFromText(text: string): number | null {
  const lower = text.toLowerCase();
  
  // "X min Y sec each" / "X minute Y second each"
  const minSecMatch = lower.match(/(\d+)\s*min(?:ute)?s?\s*(\d+)\s*sec(?:ond)?s?\s*(?:each|per|round)?/i);
  if (minSecMatch) {
    return parseInt(minSecMatch[1]) * 60 + parseInt(minSecMatch[2]);
  }
  
  // "X min(utes) each/per round"
  const minEachMatch = lower.match(/(\d+)\s*min(?:ute)?s?\s*(?:each|per\s*round)/i);
  if (minEachMatch) {
    return parseInt(minEachMatch[1]) * 60;
  }
  
  // "X minutes each" — handle "1 min 30 sec each"
  const minSecComboMatch = lower.match(/(\d+)\s*min(?:ute)?s?\s+(\d+)\s*sec/i);
  if (minSecComboMatch) {
    return parseInt(minSecComboMatch[1]) * 60 + parseInt(minSecComboMatch[2]);
  }
  
  // "X minutes" standalone (for work duration in context like "5 rounds heavy bag, 3 minutes")
  const minMatch = lower.match(/(\d+)\s*min(?:ute)?s?(?:\s+each)?/i);
  if (minMatch) {
    return parseInt(minMatch[1]) * 60;
  }
  
  // "X sec(onds) each"
  const secEachMatch = lower.match(/(\d+)\s*sec(?:ond)?s?\s*(?:each|per\s*round)/i);
  if (secEachMatch) {
    return parseInt(secEachMatch[1]);
  }
  
  // "X sec(onds)" standalone
  const secMatch = lower.match(/(\d+)\s*sec(?:ond)?s?/i);
  if (secMatch) {
    return parseInt(secMatch[1]);
  }
  
  return null;
}

function parseRestFromText(text: string): { duration: number | null; noRest: boolean } {
  const lower = text.toLowerCase();
  
  // "no rest"
  if (/\bno\s+rest\b/i.test(lower)) {
    return { duration: 0, noRest: true };
  }
  
  // "X sec rest/break"
  const secRestMatch = lower.match(/(\d+)\s*sec(?:ond)?s?\s*(?:rest|break)/i);
  if (secRestMatch) {
    return { duration: parseInt(secRestMatch[1]), noRest: false };
  }
  
  // "X min rest/break"
  const minRestMatch = lower.match(/(\d+)\s*min(?:ute)?s?\s*(?:rest|break)/i);
  if (minRestMatch) {
    return { duration: parseInt(minRestMatch[1]) * 60, noRest: false };
  }
  
  // "rest between rounds" with duration nearby
  // "30 sec rest between rounds"
  const restBetweenMatch = lower.match(/(\d+)\s*(?:sec|min)(?:ond|ute)?s?\s*rest\s*(?:between|after)/i);
  if (restBetweenMatch) {
    const val = parseInt(restBetweenMatch[1]);
    const isMin = /min/i.test(restBetweenMatch[0]);
    return { duration: isMin ? val * 60 : val, noRest: false };
  }
  
  return { duration: null, noRest: false };
}

function parseRoundsFromText(text: string): number | null {
  const lower = text.toLowerCase();
  const match = lower.match(/(\d+)\s*(?:round|rnd|set)s?\b/i);
  if (match) return parseInt(match[1]);
  return null;
}

// =====================================================
// Step 4: Parse per-round activities
// =====================================================

function parsePerRoundActivities(text: string): Array<{ name: string; round: number }> {
  const activities: Array<{ name: string; round: number }> = [];
  const lower = text.toLowerCase();
  
  // Pattern: "First round X. Second round Y." or "Round 1: X. Round 2: Y."
  // Ordinal pattern
  for (const [ordinal, num] of Object.entries(ORDINAL_MAP)) {
    const pattern = new RegExp(`${ordinal}\\s+round[:\\s]+([^.]+)`, 'i');
    const match = lower.match(pattern);
    if (match) {
      activities.push({ name: cleanActivityName(match[1].trim()), round: num });
    }
  }
  
  // "Round N: activity" pattern
  const roundPattern = /round\s*(\d+)\s*[:\s]+([^.]+)/gi;
  let match;
  while ((match = roundPattern.exec(lower)) !== null) {
    const roundNum = parseInt(match[1]);
    const activity = match[2].trim();
    // Check if this is a combo (contains dash notation like 1-2-3, or just numbers/dashes)
    const strippedActivity = activity.replace(/[^0-9\s-]/g, '').trim();
    if (/^\d+[-\s]/.test(activity) || (strippedActivity.length > 0 && /^[\d\s-]+$/.test(strippedActivity) && /\d/.test(strippedActivity))) {
      // This is a combo assignment, not an activity name — skip here, combos are parsed separately
      continue;
    }
    // Only add if it looks like an activity name (not just numbers)
    if (!/^\d[-\d\s]+$/.test(activity)) {
      activities.push({ name: cleanActivityName(activity), round: roundNum });
    }
  }
  
  return activities.sort((a, b) => a.round - b.round);
}

function cleanActivityName(name: string): string {
  // Remove trailing punctuation, leading/trailing whitespace
  let cleaned = name.replace(/[.,;:!]+$/, '').trim();
  // Title case
  cleaned = cleaned.replace(/\b\w/g, c => c.toUpperCase());
  return cleaned;
}

// =====================================================
// Step 5: Infer activity name from block text
// =====================================================

function inferActivityName(text: string): string {
  const lower = text.toLowerCase();
  
  if (/heavy\s*bag/i.test(lower)) return 'Heavy Bag Work';
  if (/speed\s*bag/i.test(lower)) return 'Speed Bag';
  if (/double.?end\s*bag/i.test(lower)) return 'Double End Bag';
  if (/shadow\s*box/i.test(lower)) return 'Shadowboxing';
  if (/jump\s*rope/i.test(lower)) return 'Jump Rope';
  if (/bodyweight|body\s*weight/i.test(lower)) return 'Bodyweight Burnout';
  if (/hiit/i.test(lower)) return 'HIIT Rounds';
  if (/cardio|conditioning/i.test(lower)) return 'Cardio Conditioning';
  if (/sparring/i.test(lower)) return 'Sparring';
  if (/mitt/i.test(lower)) return 'Mitt Work';
  if (/footwork/i.test(lower)) return 'Footwork Drills';
  if (/defense|defensive/i.test(lower)) return 'Defense Drills';
  if (/stretch/i.test(lower)) return 'Stretching';
  if (/warm\s*up/i.test(lower)) return 'Warmup';
  if (/cool\s*down/i.test(lower)) return 'Cooldown';
  
  return 'Training';
}

// =====================================================
// Step 6: Parse combos from block text
// =====================================================

function parseCombosFromBlock(text: string): string[][] {
  const combos: string[][] = [];
  
  // Extract "Round N: combo" patterns specifically
  const roundComboPattern = /round\s*(\d+)\s*[:\s]+\s*([\d][\d\s-]*[\d])/gi;
  let match;
  while ((match = roundComboPattern.exec(text)) !== null) {
    const comboStr = match[2].trim();
    const parsed = parseComboString(comboStr);
    if (parsed.length > 0) {
      combos.push(parsed);
    }
  }
  
  // If no round-specific combos found, try general extraction
  if (combos.length === 0) {
    const comboStrings = extractCombosFromPrompt(text);
    for (const comboStr of comboStrings) {
      const parsed = parseComboString(comboStr);
      if (parsed.length > 0) {
        combos.push(parsed);
      }
    }
  }
  
  return combos;
}

// =====================================================
// Step 6b: Parse superset from block text
// =====================================================

const EXERCISE_NAMES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /heavy\s*bag\s*(?:freestyle|combo\s*work|work)?/i, name: 'Heavy Bag' },
  { pattern: /speed\s*bag/i, name: 'Speed Bag' },
  { pattern: /double[\s-]*end\s*bag/i, name: 'Double End Bag' },
  { pattern: /shadow\s*box(?:ing)?/i, name: 'Shadowboxing' },
  { pattern: /jump\s*rope/i, name: 'Jump Rope' },
  { pattern: /burpees?/i, name: 'Burpees' },
  { pattern: /push[\s-]*ups?/i, name: 'Pushups' },
  { pattern: /pull[\s-]*ups?/i, name: 'Pullups' },
  { pattern: /squats?/i, name: 'Squats' },
  { pattern: /sit[\s-]*ups?/i, name: 'Situps' },
  { pattern: /planks?/i, name: 'Plank' },
  { pattern: /mountain\s*climbers?/i, name: 'Mountain Climbers' },
  { pattern: /mitt\s*work/i, name: 'Mitt Work' },
  { pattern: /sparring/i, name: 'Sparring' },
  { pattern: /footwork(?:\s*drills?)?/i, name: 'Footwork' },
  { pattern: /stretch(?:ing)?/i, name: 'Stretching' },
  { pattern: /cardio/i, name: 'Cardio' },
  { pattern: /conditioning/i, name: 'Conditioning' },
  { pattern: /hiit/i, name: 'HIIT' },
  { pattern: /body\s*weight\s*(?:burnout)?/i, name: 'Bodyweight' },
  { pattern: /bob(?:bing)?\s*(?:and|&)\s*weav(?:ing|e)/i, name: 'Bob & Weave' },
  { pattern: /defense\s*drills?/i, name: 'Defense Drills' },
];

function extractExerciseWithDuration(text: string): { name: string; duration: number | null; raw: string } | null {
  const lower = text.trim().toLowerCase();
  
  for (const { pattern, name } of EXERCISE_NAMES) {
    if (pattern.test(lower)) {
      // Check for "freestyle" modifier
      const isFreestyle = /freestyle/i.test(lower);
      const finalName = isFreestyle ? `${name} Freestyle` : name;
      
      // Extract duration attached to this exercise
      const dur = parseDurationFromText(text);
      return { name: finalName, duration: dur, raw: text.trim() };
    }
  }
  
  // Fallback: if text has meaningful words, use it as a custom exercise
  const cleaned = text.replace(/\d+\s*(?:min(?:ute)?s?|sec(?:ond)?s?)\s*/gi, '').trim();
  if (cleaned.length > 2 && !/^\s*$/.test(cleaned)) {
    const dur = parseDurationFromText(text);
    return { name: cleanActivityName(cleaned), duration: dur, raw: text.trim() };
  }
  
  return null;
}

function parseSupersetFromBlock(text: string): { exercises: SupersetExercise[]; restBetween: number | null } | null {
  const lower = text.toLowerCase();
  
  // Strip round info and rest-between-rounds info to isolate exercise content
  const stripped = lower
    .replace(/\d+\s*(?:round|rnd|set)s?\b/gi, '')
    .replace(/\d+\s*(?:min(?:ute)?s?|sec(?:ond)?s?)\s*(?:rest|break)\s*(?:between\s*rounds?)?/gi, '')
    .trim();
  
  const hasSupersetKeyword = /\bsuperset\b/i.test(lower);
  
  let part1: string | null = null;
  let part2: string | null = null;
  
  if (hasSupersetKeyword) {
    // Remove "superset" keyword and split on "and" / "with" / "&"
    const afterSuperset = stripped.replace(/.*superset\s*[:\-]?\s*/i, '');
    const splitMatch = afterSuperset.match(/^(.+?)\s+(?:and|with|&)\s+(.+?)(?:\.|$)/i);
    if (splitMatch) {
      // Use greedy-ish: split at the LAST "and"/"with" to handle exercise names with those words
      const andIdx = afterSuperset.search(/\s+(?:and|with|&)\s+/i);
      if (andIdx > 0) {
        const andMatch = afterSuperset.match(/\s+(?:and|with|&)\s+/i)!;
        part1 = afterSuperset.slice(0, andIdx).trim();
        part2 = afterSuperset.slice(andIdx + andMatch[0].length).replace(/[.,;]+$/, '').trim();
      }
    }
  }
  
  // "X and Y back to back" or "X and Y no rest between"
  if (!part1 || !part2) {
    const backToBackMatch = stripped.match(/(.+?)\s+(?:and|&)\s+(.+?)\s+(?:back\s+to\s+back|no\s+rest\s+between)/i);
    if (backToBackMatch) {
      part1 = backToBackMatch[1].trim();
      part2 = backToBackMatch[2].trim();
    }
  }
  
  // "X then Y", "X straight into Y", "X into Y"
  if (!part1 || !part2) {
    const thenMatch = stripped.match(/(.+?)\s+(?:then|straight\s+into)\s+(.+?)(?:\.|$)/i);
    if (thenMatch) {
      const ex1 = extractExerciseWithDuration(thenMatch[1]);
      const ex2 = extractExerciseWithDuration(thenMatch[2].replace(/[.,;]+$/, ''));
      if (ex1 && ex2) {
        part1 = thenMatch[1].trim();
        part2 = thenMatch[2].replace(/[.,;]+$/, '').trim();
      }
    }
    
    // "X into Y" — only if both are recognizable exercises
    if (!part1 || !part2) {
      const intoMatch = stripped.match(/(.+?)\s+into\s+(.+?)(?:\.|$)/i);
      if (intoMatch) {
        const ex1 = extractExerciseWithDuration(intoMatch[1]);
        const ex2 = extractExerciseWithDuration(intoMatch[2].replace(/[.,;]+$/, ''));
        if (ex1 && ex2) {
          part1 = intoMatch[1].trim();
          part2 = intoMatch[2].replace(/[.,;]+$/, '').trim();
        }
      }
    }
  }
  
  if (!part1 || !part2) return null;
  
  const ex1 = extractExerciseWithDuration(part1);
  const ex2 = extractExerciseWithDuration(part2);
  
  if (!ex1 || !ex2) return null;
  
  // Check for rest between the exercises in the superset
  let restBetween: number | null = null;
  const restBetweenMatch = lower.match(/(\d+)\s*(?:sec(?:ond)?s?|min(?:ute)?s?)\s*(?:rest|break)\s*(?:between\s*(?:exercises|them|sets)|in\s*between)/i);
  if (restBetweenMatch) {
    const val = parseInt(restBetweenMatch[1]);
    restBetween = /min/i.test(restBetweenMatch[0]) ? val * 60 : val;
  }
  
  // Default durations if not specified per-exercise: use the block-level work duration
  const blockWorkDuration = parseDurationFromText(text);
  const defaultDur = blockWorkDuration ?? DEFAULT_DURATIONS.boxingRound;
  
  return {
    exercises: [
      { name: ex1.name, duration: ex1.duration ?? defaultDur },
      { name: ex2.name, duration: ex2.duration ?? defaultDur },
    ],
    restBetween,
  };
}

// =====================================================
// Step 7: Parse a single block into structured data
// =====================================================

function parseBlock(blockText: string): ParsedBlock {
  const section = classifySection(blockText);
  const rounds = parseRoundsFromText(blockText) ?? 1;
  const workDuration = parseDurationFromText(blockText);
  const rest = parseRestFromText(blockText);
  const activityName = inferActivityName(blockText);
  const perRoundActivities = parsePerRoundActivities(blockText);
  const combos = parseCombosFromBlock(blockText);
  
  // Check for superset pattern
  const supersetResult = parseSupersetFromBlock(blockText);
  
  // Detect speed bag drills from per-round activities
  const bagType = detectBagType(blockText);
  const speedBagDrills: string[][] = [];
  
  if (bagType === 'speedbag' && perRoundActivities.length > 0) {
    // Check if per-round activities are speed bag drill names
    for (const activity of perRoundActivities) {
      const drill = detectSpeedBagDrill(activity.name);
      if (drill) {
        speedBagDrills.push([drill.name]);
      }
    }
  }
  
  // If we found speed bag drills from per-round activities, also check the full text
  // for drills not in per-round format
  if (bagType === 'speedbag' && speedBagDrills.length === 0) {
    const detectedDrills = detectAllSpeedBagDrills(blockText);
    for (const drill of detectedDrills) {
      speedBagDrills.push([drill.name]);
    }
  }
  
  // Default durations based on section
  let defaultWork: number;
  if (section === 'warmup') defaultWork = 60;
  else if (section === 'cooldown') defaultWork = 120;
  else defaultWork = DEFAULT_DURATIONS.boxingRound;
  
  let defaultRest: number;
  if (section === 'warmup') defaultRest = 30;
  else if (section === 'cooldown') defaultRest = 0;
  else defaultRest = DEFAULT_DURATIONS.boxingRest;
  
  return {
    rawText: blockText,
    section,
    rounds,
    workDuration: workDuration ?? defaultWork,
    restDuration: rest.duration ?? defaultRest,
    noRest: rest.noRest,
    activityName: supersetResult 
      ? `${supersetResult.exercises[0].name} & ${supersetResult.exercises[1].name} Superset`
      : activityName,
    perRoundActivities,
    combos,
    superset: supersetResult?.exercises ?? null,
    supersetRestBetween: supersetResult?.restBetween ?? null,
    speedBagDrills,
  };
}

// =====================================================
// Step 8: Convert parsed blocks into phases
// =====================================================

function blockToPhase(block: ParsedBlock): ParsedPhase {
  const segments: ParsedSegment[] = [];
  
  // Superset: 2+ active segments in one phase
  if (block.superset && block.superset.length >= 2) {
    for (let i = 0; i < block.superset.length; i++) {
      const ex = block.superset[i];
      segments.push({
        name: ex.name,
        type: 'active',
        segmentType: inferSegmentType(ex.name),
        duration: ex.duration,
        activityType: inferActivityType(ex.name),
      });
      
      // Add rest between superset exercises if specified
      if (i < block.superset.length - 1 && block.supersetRestBetween && block.supersetRestBetween > 0) {
        segments.push({
          name: 'Rest',
          type: 'rest',
          segmentType: 'rest',
          duration: block.supersetRestBetween,
        });
      }
    }
    
    // Add rest after the pair (between rounds)
    if (!block.noRest && block.restDuration > 0) {
      segments.push({
        name: 'Rest',
        type: 'rest',
        segmentType: 'rest',
        duration: block.restDuration,
      });
    }
    
    return {
      name: block.activityName,
      phaseType: 'circuit',
      section: block.section,
      repeats: block.rounds,
      segments,
    };
  }
  
  // Speed bag with drills: create a single SB segment + populate drill library
  if (block.speedBagDrills.length > 0) {
    segments.push({
      name: 'Speed Bag',
      type: 'active',
      segmentType: 'speedbag',
      duration: block.workDuration,
      activityType: 'custom',
    });
    
    // Add rest
    if (!block.noRest && block.restDuration > 0) {
      segments.push({
        name: 'Rest',
        type: 'rest',
        segmentType: 'rest',
        duration: block.restDuration,
      });
    }
    
    return {
      name: block.activityName,
      phaseType: 'circuit',
      section: block.section,
      repeats: block.speedBagDrills.length,
      segments,
      combos: block.speedBagDrills,
      comboOrder: 'sequential',
    };
  }
  
  if (block.perRoundActivities.length > 0) {
    // Per-round activities: create individual segments
    for (let i = 0; i < block.perRoundActivities.length; i++) {
      const activity = block.perRoundActivities[i];
      segments.push({
        name: activity.name,
        type: 'active',
        segmentType: inferSegmentType(activity.name),
        duration: block.workDuration,
        activityType: inferActivityType(activity.name),
      });
      
      // Add rest between activities (not after the last one unless rest is specified)
      if (i < block.perRoundActivities.length - 1 && !block.noRest && block.restDuration > 0) {
        segments.push({
          name: 'Rest',
          type: 'rest',
          segmentType: 'rest',
          duration: block.restDuration,
        });
      }
    }
  } else {
    // Single activity per round
    const hasCombos = block.combos.length > 0;
    const bagType = detectBagType(block.rawText);
    const isSpeedBag = bagType === 'speedbag';
    
    segments.push({
      name: block.activityName,
      type: 'active',
      segmentType: isSpeedBag ? 'speedbag' : (hasCombos ? 'combo' : inferSegmentType(block.activityName)),
      duration: block.workDuration,
      activityType: isSpeedBag ? 'custom' : (hasCombos ? 'combos' : inferActivityType(block.activityName)),
    });
  }
  
  // Add rest at end of phase cycle (unless no rest or cooldown with no rest)
  if (!block.noRest && block.restDuration > 0 && block.perRoundActivities.length === 0) {
    segments.push({
      name: 'Rest',
      type: 'rest',
      segmentType: 'rest',
      duration: block.restDuration,
    });
  }
  
  return {
    name: block.activityName,
    phaseType: block.perRoundActivities.length > 0 ? 'continuous' : 'circuit',
    section: block.section,
    repeats: block.perRoundActivities.length > 0 ? 1 : block.rounds,
    segments,
    combos: block.combos.length > 0 ? block.combos : undefined,
    comboOrder: block.combos.length > 0 ? 'sequential' : undefined,
  };
}

function inferSegmentType(name: string): 'work' | 'rest' | 'shadowboxing' | 'combo' | 'speedbag' | 'doubleend' {
  const lower = name.toLowerCase();
  if (/shadow/i.test(lower)) return 'shadowboxing';
  if (/double[\s-]*end|de\s*bag|reflex\s*bag|floor\s*to\s*ceiling|spring\s*bag/i.test(lower)) return 'doubleend';
  if (/speed[\s-]*bag|small\s*bag|platform\s*bag|swivel\s*bag/i.test(lower)) return 'speedbag';
  if (/combo|heavy[\s-]*bag|bag\s*work|mitt|pad|power\s*bag|big\s*bag/i.test(lower)) return 'combo';
  return 'work';
}

/**
 * Determine the correct segment name based on bag type and whether drills/combos are specified.
 * Enforces the freestyle rule: no specification = Freestyle.
 */
function getBagSegmentName(bagType: DetectedBagType, hasDrillsOrCombos: boolean, drillName?: string): string {
  switch (bagType) {
    case 'speedbag':
      if (drillName) return `Speed Bag ${drillName}`;
      return hasDrillsOrCombos ? 'Speed Bag Drill' : 'Speed Bag Freestyle';
    case 'doubleend':
      return hasDrillsOrCombos ? 'Double End Bag Combo Work' : 'Double End Bag Freestyle';
    case 'heavybag':
      return hasDrillsOrCombos ? 'Heavy Bag Combo Work' : 'Heavy Bag Freestyle';
    default:
      return hasDrillsOrCombos ? 'Combo Work' : 'Freestyle';
  }
}

function inferActivityType(name: string): 'combos' | 'shadowbox' | 'run' | 'pushups' | 'custom' {
  const lower = name.toLowerCase();
  if (/shadow/i.test(lower)) return 'shadowbox';
  if (/jump\s*rope|run|jog|sprint/i.test(lower)) return 'run';
  if (/combo/i.test(lower)) return 'combos';
  return 'custom';
}

// =====================================================
// Main Parser Function (multi-block)
// =====================================================

export function parseWorkoutInput(
  prompt: string, 
  userLevel: string = 'beginner',
  historyInsights?: HistoryInsights
): ParsedWorkoutResult {
  const lowerPrompt = prompt.toLowerCase();
  
  // Determine difficulty (step 1: keyword + user level)
  let baseDifficulty = inferDifficulty(lowerPrompt, userLevel);
  if (historyInsights) {
    baseDifficulty = getAdjustedDifficulty(baseDifficulty, historyInsights);
  }
  
  // Split into blocks
  const blockTexts = splitIntoBlocks(prompt);
  const isMultiBlock = blockTexts.length > 1;
  
  // Parse each block
  const parsedBlocks = blockTexts.map(parseBlock);
  
  // Collect all combos across blocks
  const allCombos: string[][] = [];
  for (const block of parsedBlocks) {
    allCombos.push(...block.combos);
  }
  
  // Build phases from blocks
  let phases: ParsedPhase[];
  const hasSupersetBlock = parsedBlocks.some(b => b.superset !== null);
  
  if (isMultiBlock) {
    phases = parsedBlocks.map(blockToPhase);
  } else if (hasSupersetBlock) {
    // Superset detected in single block — use blockToPhase for the grind,
    // but still wrap with warmup/cooldown from legacy logic
    const singleBlock = parsedBlocks[0];
    const hasWarmup = !lowerPrompt.includes('no warmup') && !lowerPrompt.includes('skip warmup');
    const hasCooldown = !lowerPrompt.includes('no cooldown') && !lowerPrompt.includes('skip cooldown');
    
    phases = [];
    if (hasWarmup) {
      phases.push({
        name: 'Dynamic Warmup',
        phaseType: 'continuous',
        section: 'warmup',
        repeats: 1,
        segments: [
          { name: 'Jump Rope', type: 'active', segmentType: 'work', duration: 120, activityType: 'run' },
          { name: 'Active Rest', type: 'rest', segmentType: 'rest', duration: 30 },
          { name: 'Shadow Boxing', type: 'active', segmentType: 'shadowboxing', duration: 120, activityType: 'shadowbox' },
        ],
      });
    }
    phases.push(blockToPhase(singleBlock));
    if (hasCooldown) {
      phases.push({
        name: 'Cooldown',
        phaseType: 'continuous',
        section: 'cooldown',
        repeats: 1,
        segments: [
          { name: 'Light Shadow', type: 'active', segmentType: 'shadowboxing', duration: 90, activityType: 'shadowbox' },
          { name: 'Stretch', type: 'active', segmentType: 'work', duration: 120, activityType: 'custom' },
        ],
      });
    }
  } else {
    // Single block: use legacy-style phase building with interspersed exercises
    const singleBlock = parsedBlocks[0];
    const exercises = parseInterspersedExercises(lowerPrompt);
    phases = buildLegacyPhases(singleBlock, exercises, allCombos.length > 0, lowerPrompt);
  }
  
  // Detect tags, megaset, warmup/cooldown flags
  const tags = detectTags(prompt);
  const megasetRepeats = parseMegasetRepeats(lowerPrompt);
  
  // Check what was explicitly parsed
  const anyRoundsParsed = parsedBlocks.some(b => parseRoundsFromText(b.rawText) !== null);
  const anyDurationsParsed = parsedBlocks.some(b => parseDurationFromText(b.rawText) !== null || parseRestFromText(b.rawText).duration !== null);
  const anyCombosParsed = allCombos.length > 0;
  
  // For multi-block prompts, warmup/cooldown are detected from blocks
  const hasWarmupBlock = isMultiBlock && parsedBlocks.some(b => b.section === 'warmup');
  const hasCooldownBlock = isMultiBlock && parsedBlocks.some(b => b.section === 'cooldown');
  
  // Step 2+3: Auto-upgrade difficulty if combo content exceeds inferred tier
  if (allCombos.length > 0) {
    const comboDifficulty = classifyDifficultyFromCombos(allCombos);
    baseDifficulty = higherDifficulty(baseDifficulty, comboDifficulty);
  }

  const result: ParsedWorkoutResult = {
    name: 'AI Workout',
    rounds: isMultiBlock ? undefined : (parsedBlocks[0]?.rounds ?? 3),
    roundDuration: isMultiBlock ? undefined : parsedBlocks[0]?.workDuration,
    restDuration: isMultiBlock ? undefined : parsedBlocks[0]?.restDuration,
    difficulty: baseDifficulty,
    combos: allCombos,
    phases,
    tags,
    megasetRepeats,
    hasWarmup: isMultiBlock ? hasWarmupBlock : !lowerPrompt.includes('no warmup') && !lowerPrompt.includes('skip warmup'),
    hasCooldown: isMultiBlock ? hasCooldownBlock : !lowerPrompt.includes('no cooldown') && !lowerPrompt.includes('skip cooldown'),
    parsedRounds: anyRoundsParsed,
    parsedDurations: anyDurationsParsed,
    parsedCombos: anyCombosParsed,
    hasMultipleBlocks: isMultiBlock,
  };
  
  // Apply history adjustments for single-block when no explicit values
  if (!isMultiBlock && historyInsights) {
    if (!anyRoundsParsed && result.rounds) {
      result.rounds = getAdjustedRounds(result.rounds, historyInsights);
    }
    if (!anyDurationsParsed && result.restDuration) {
      result.restDuration = getAdjustedRestDuration(result.restDuration, historyInsights);
    }
  }
  
  // Generate name
  result.name = generateWorkoutName(lowerPrompt, result, isMultiBlock, parsedBlocks);
  
  return result;
}

// =====================================================
// Legacy single-block phase building (backward compat)
// =====================================================

function buildLegacyPhases(
  block: ParsedBlock,
  exercises: Array<{ name: string; reps?: number; duration?: number }>,
  hasCombos: boolean,
  prompt: string
): ParsedPhase[] {
  const phases: ParsedPhase[] = [];
  const hasWarmup = !prompt.includes('no warmup') && !prompt.includes('skip warmup');
  const hasCooldown = !prompt.includes('no cooldown') && !prompt.includes('skip cooldown');
  
  // Detect bag type from prompt
  const bagType = detectBagType(prompt);
  const isSpeedBag = bagType === 'speedbag';
  const isDoubleEnd = bagType === 'doubleend';
  const speedBagDrills = isSpeedBag ? detectAllSpeedBagDrills(prompt) : [];
  const hasSpeedBagDrills = speedBagDrills.length > 0;
  
  // Determine segment type and name based on bag type
  let segmentType: 'combo' | 'speedbag' | 'doubleend' | 'shadowboxing' = 'combo';
  let segmentName = 'Heavy Bag Freestyle';
  
  if (isSpeedBag) {
    segmentType = 'speedbag';
    segmentName = hasSpeedBagDrills 
      ? `Speed Bag ${speedBagDrills[0].name}` 
      : 'Speed Bag Freestyle';
  } else if (isDoubleEnd) {
    segmentType = 'doubleend';
    segmentName = hasCombos ? 'Double End Bag Combo Work' : 'Double End Bag Freestyle';
  } else if (hasCombos) {
    segmentName = 'Heavy Bag Combo Work';
  } else if (prompt.includes('shadow')) {
    segmentType = 'shadowboxing';
    segmentName = 'Shadowboxing';
  } else {
    // No bag specified, no combos = Heavy Bag Freestyle (most common default)
    segmentName = 'Heavy Bag Freestyle';
  }
  
  if (hasWarmup) {
    phases.push({
      name: 'Dynamic Warmup',
      phaseType: 'continuous',
      section: 'warmup',
      repeats: 1,
      segments: [
        { name: 'Jump Rope', type: 'active', segmentType: 'work', duration: 120, activityType: 'run' },
        { name: 'Active Rest', type: 'rest', segmentType: 'rest', duration: 30 },
        { name: 'Shadow Boxing', type: 'active', segmentType: 'shadowboxing', duration: 120, activityType: 'shadowbox' },
      ],
    });
  }
  
  const grindSegments: ParsedSegment[] = [];
  grindSegments.push({
    name: segmentName,
    type: 'active',
    segmentType: segmentType,
    duration: block.workDuration,
    activityType: isSpeedBag ? 'custom' : (hasCombos ? 'combos' : 'shadowbox'),
  });
  
  for (const exercise of exercises) {
    grindSegments.push({
      name: exercise.name,
      type: 'active',
      segmentType: 'work',
      duration: exercise.duration ?? 30,
      exercise: exercise.name,
      activityType: 'custom',
      reps: exercise.reps,
    });
  }
  
  grindSegments.push({
    name: 'Rest',
    type: 'rest',
    segmentType: 'rest',
    duration: block.restDuration,
  });
  
  phases.push({
    name: /hiit/i.test(prompt) ? 'HIIT Rounds' : 'Main Rounds',
    phaseType: 'circuit',
    section: 'grind',
    repeats: block.rounds,
    segments: grindSegments,
  });
  
  if (hasCooldown) {
    phases.push({
      name: 'Cooldown',
      phaseType: 'continuous',
      section: 'cooldown',
      repeats: 1,
      segments: [
        { name: 'Light Shadow', type: 'active', segmentType: 'shadowboxing', duration: 90, activityType: 'shadowbox' },
        { name: 'Stretch', type: 'active', segmentType: 'work', duration: 120, activityType: 'custom' },
      ],
    });
  }
  
  return phases;
}

// =====================================================
// Individual Helper Functions (kept from original)
// =====================================================

function parseMegasetRepeats(prompt: string): number {
  if (/(?:whole\s*thing|everything|all)\s*(?:twice|2\s*times|two\s*times)/i.test(prompt)) return 2;
  if (/(?:whole\s*thing|everything|all)\s*(?:three\s*times|3\s*times)/i.test(prompt)) return 3;
  const megasetMatch = prompt.match(/(\d+)\s*megaset/i);
  if (megasetMatch) return parseInt(megasetMatch[1]);
  if (/run\s*it\s*back/i.test(prompt)) return 2;
  return 1;
}

function inferDifficulty(prompt: string, userLevel: string): 'beginner' | 'intermediate' | 'advanced' {
  if (/\b(advanced|pro|hard|intense|brutal|killer)\b/i.test(prompt)) return 'advanced';
  if (/\b(intermediate|medium|moderate)\b/i.test(prompt)) return 'intermediate';
  if (/\b(beginner|easy|simple|basic|starter|newbie)\b/i.test(prompt)) return 'beginner';
  // Map prestige and experienceLevel strings to difficulty tiers
  if (userLevel === 'advanced' || userLevel === 'pro') return 'advanced';
  if (userLevel === 'intermediate') return 'intermediate';
  if (userLevel === 'beginner' || userLevel === 'complete_beginner' || userLevel === 'rookie') return 'beginner';
  return 'beginner';
}

// =====================================================
// Classify difficulty from actual combo content
// =====================================================

const DIFFICULTY_SCORES = { beginner: 0, intermediate: 1, advanced: 2 } as const;

export function classifyDifficultyFromCombos(combos: string[][]): 'beginner' | 'intermediate' | 'advanced' {
  let maxLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner';

  for (const combo of combos) {
    for (const token of combo) {
      const upper = token.toUpperCase().trim();
      // Advanced indicators
      if (['7', '8'].includes(upper) || upper === 'STEP IN' || upper === 'STEP OUT') {
        return 'advanced'; // Can't go higher, short-circuit
      }
      // Intermediate indicators
      if (['5', '6'].includes(upper) || upper === 'PULL' || upper === 'BLOCK' || upper === 'CIRCLE L' || upper === 'CIRCLE R') {
        maxLevel = 'intermediate';
      }
    }
  }

  return maxLevel;
}

function higherDifficulty(
  a: 'beginner' | 'intermediate' | 'advanced',
  b: 'beginner' | 'intermediate' | 'advanced'
): 'beginner' | 'intermediate' | 'advanced' {
  return DIFFICULTY_SCORES[a] >= DIFFICULTY_SCORES[b] ? a : b;
}

export function detectTags(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const tags: string[] = [];
  for (const [tag, keywords] of Object.entries(KEYWORD_TAGS)) {
    if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
      tags.push(tag);
    }
  }
  if (!tags.includes('boxing') && containsComboNotation(prompt)) {
    tags.push('boxing');
  }
  return tags;
}

function parseInterspersedExercises(prompt: string): Array<{ name: string; reps?: number; duration?: number }> {
  const exercises: Array<{ name: string; reps?: number; duration?: number }> = [];
  const patterns = [
    /(\d+)\s*(pushups?|push-ups?|burpees?|squats?|situps?|sit-ups?|pullups?|pull-ups?|curlups?|curl-ups?)\s*(?:between|after|each)/gi,
    /(?:between|after)\s*(?:each\s*)?(?:round)?\s*(?:do\s*)?(\d+)\s*(pushups?|burpees?|squats?)/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(prompt)) !== null) {
      const reps = parseInt(match[1]);
      const exerciseName = match[2].toLowerCase().replace(/-/g, '').replace(/s$/, '');
      let normalized = exerciseName;
      if (exerciseName.includes('push')) normalized = 'Pushups';
      else if (exerciseName.includes('burpee')) normalized = 'Burpees';
      else if (exerciseName.includes('squat')) normalized = 'Squats';
      else if (exerciseName.includes('sit')) normalized = 'Situps';
      else if (exerciseName.includes('curl')) normalized = 'Curlups';
      else if (exerciseName.includes('pull')) normalized = 'Pullups';
      exercises.push({ name: normalized, reps });
    }
  }
  return exercises;
}

// =====================================================
// Workout Name Generation
// =====================================================

function generateWorkoutName(
  prompt: string, 
  result: ParsedWorkoutResult, 
  isMultiBlock: boolean,
  blocks: ParsedBlock[]
): string {
  // Multi-block prompt with warmup + grind + cooldown = full session
  if (isMultiBlock) {
    const hasWarmup = blocks.some(b => b.section === 'warmup');
    const hasCooldown = blocks.some(b => b.section === 'cooldown');
    const grindBlocks = blocks.filter(b => b.section === 'grind');
    
    if (hasWarmup && hasCooldown && grindBlocks.length >= 2) return 'Full Training Session';
    if (grindBlocks.length >= 3) return 'Complete Workout';
    if (grindBlocks.length >= 2) return 'Multi-Phase Session';
    
    // Single grind block with warmup/cooldown
    if (grindBlocks.length === 1) {
      const mainActivity = grindBlocks[0].activityName;
      if (mainActivity !== 'Training') return mainActivity;
    }
  }
  
  // Superset-specific name: use the block-generated name
  const hasSupersetPhase = blocks.some(b => b.superset !== null);
  if (hasSupersetPhase && !isMultiBlock) {
    const supersetBlock = blocks.find(b => b.superset !== null);
    if (supersetBlock) return supersetBlock.activityName;
  }
  
  const tags = result.tags;
  const bagType = detectBagType(prompt);
  
  // Speed bag and double end bag get specific names
  if (bagType === 'speedbag') {
    const drills = detectAllSpeedBagDrills(prompt);
    return drills.length > 0 ? 'Speed Bag Drill' : 'Speed Bag Session';
  }
  if (bagType === 'doubleend') return 'Double End Bag Session';
  
  if (result.parsedCombos && result.combos.length > 0) {
    if (result.combos.length >= 4) return 'Combo Blitz';
    return 'Combo Drill';
  }
  if (tags.includes('hiit')) return 'HIIT Boxing';
  if (prompt.includes('heavy bag') || prompt.includes('bag work')) return 'Heavy Bag Blast';
  if (prompt.includes('shadow')) return 'Shadow Session';
  if (tags.includes('footwork')) return 'Footwork Focus';
  if (tags.includes('defense') && !tags.includes('boxing')) return 'Defense Drill';
  if (tags.includes('cardio') || prompt.includes('conditioning')) return 'Cardio Conditioning';
  if (result.rounds && result.rounds >= 6) return 'Full Session';
  if (tags.includes('boxing')) return 'Boxing Session';
  return 'Quick Burn';
}

// =====================================================
// Convert ParsedWorkoutResult to Workout object
// =====================================================

export function parsedResultToWorkout(result: ParsedWorkoutResult): Workout {
  const generateId = () => crypto.randomUUID();
  
  const warmupPhases: WorkoutPhase[] = [];
  const grindPhases: WorkoutPhase[] = [];
  const cooldownPhases: WorkoutPhase[] = [];
  
  for (const phase of result.phases) {
    const workoutPhase: WorkoutPhase = {
      id: generateId(),
      name: phase.name,
      repeats: phase.repeats,
      segments: phase.segments.map(seg => ({
        id: generateId(),
        name: seg.name,
        type: seg.type,
        segmentType: seg.segmentType,
        duration: seg.duration,
        reps: seg.reps,
      } as WorkoutSegment)),
      ...(phase.combos && phase.combos.length > 0 ? { combos: phase.combos } : {}),
      ...(phase.comboOrder ? { comboOrder: phase.comboOrder } : {}),
    };
    
    switch (phase.section) {
      case 'warmup': warmupPhases.push(workoutPhase); break;
      case 'grind': grindPhases.push(workoutPhase); break;
      case 'cooldown': cooldownPhases.push(workoutPhase); break;
    }
  }
  
  let totalDuration = 0;
  for (const phase of result.phases) {
    const phaseDur = phase.segments.reduce((acc, s) => acc + s.duration, 0);
    totalDuration += phaseDur * phase.repeats;
  }
  totalDuration *= result.megasetRepeats;
  
  return {
    id: generateId(),
    name: result.name,
    icon: '🥊',
    difficulty: result.difficulty,
    totalDuration,
    isPreset: false,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    sections: {
      warmup: warmupPhases,
      grind: grindPhases,
      cooldown: cooldownPhases,
    },
    combos: result.combos.length > 0 ? result.combos : undefined,
  };
}

// =====================================================
// Prompt Quality Check
// =====================================================

export function checkPromptQuality(prompt: string): {
  isComplete: boolean;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  const lowerPrompt = prompt.toLowerCase();
  
  if (prompt.trim().length < 10) {
    suggestions.push("Try adding more detail - e.g., '5 rounds of boxing with 30 second rest'");
  }
  if (!/\d+\s*(?:round|set|interval)/i.test(lowerPrompt)) {
    suggestions.push("Specify rounds - e.g., '6 rounds'");
  }
  if (!/\d+\s*(?:min|sec|minute|second)/i.test(lowerPrompt)) {
    suggestions.push("Add timing - e.g., '3 min rounds with 1 min rest'");
  }
  
  return { isComplete: suggestions.length === 0, suggestions };
}
