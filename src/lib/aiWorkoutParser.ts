// =====================================================
// AI Workout Parser - Block-based multi-phase parsing
// =====================================================

import { parseComboString, extractCombosFromPrompt, containsComboNotation } from './comboParser';
import { Workout, WorkoutPhase, WorkoutSegment } from '@/types';
import { HistoryInsights, getAdjustedDifficulty, getAdjustedRestDuration, getAdjustedRounds } from './workoutHistoryAnalysis';

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
  boxing: ['box', 'punch', 'jab', 'cross', 'hook', 'uppercut', 'combo', 'heavy bag', 'shadowbox', 'sparring', 'mitt'],
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
}

export interface ParsedSegment {
  name: string;
  type: 'active' | 'rest';
  segmentType?: 'work' | 'rest' | 'shadowboxing' | 'combo';
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
  supersetRepeats: number;
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
    // Check if this is a combo (contains dash notation like 1-2-3)
    if (/^\d+[-\s]/.test(activity) || /^[\d\s-]+$/.test(activity.replace(/[^0-9\s-]/g, ''))) {
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
    activityName,
    perRoundActivities,
    combos,
  };
}

// =====================================================
// Step 8: Convert parsed blocks into phases
// =====================================================

function blockToPhase(block: ParsedBlock): ParsedPhase {
  const segments: ParsedSegment[] = [];
  
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
    segments.push({
      name: block.activityName,
      type: 'active',
      segmentType: hasCombos ? 'combo' : inferSegmentType(block.activityName),
      duration: block.workDuration,
      activityType: hasCombos ? 'combos' : inferActivityType(block.activityName),
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
  };
}

function inferSegmentType(name: string): 'work' | 'rest' | 'shadowboxing' | 'combo' {
  const lower = name.toLowerCase();
  if (/shadow/i.test(lower)) return 'shadowboxing';
  if (/combo|bag|mitt|pad/i.test(lower)) return 'combo';
  return 'work';
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
  
  // Determine difficulty
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
  if (isMultiBlock) {
    phases = parsedBlocks.map(blockToPhase);
  } else {
    // Single block: use legacy-style phase building with interspersed exercises
    const singleBlock = parsedBlocks[0];
    const exercises = parseInterspersedExercises(lowerPrompt);
    phases = buildLegacyPhases(singleBlock, exercises, allCombos.length > 0, lowerPrompt);
  }
  
  // Detect tags, superset, warmup/cooldown flags
  const tags = detectTags(prompt);
  const supersetRepeats = parseSupersetRepeats(lowerPrompt);
  
  // Check what was explicitly parsed
  const anyRoundsParsed = parsedBlocks.some(b => parseRoundsFromText(b.rawText) !== null);
  const anyDurationsParsed = parsedBlocks.some(b => parseDurationFromText(b.rawText) !== null || parseRestFromText(b.rawText).duration !== null);
  const anyCombosParsed = allCombos.length > 0;
  
  // For multi-block prompts, warmup/cooldown are detected from blocks
  const hasWarmupBlock = isMultiBlock && parsedBlocks.some(b => b.section === 'warmup');
  const hasCooldownBlock = isMultiBlock && parsedBlocks.some(b => b.section === 'cooldown');
  
  const result: ParsedWorkoutResult = {
    name: 'AI Workout',
    rounds: isMultiBlock ? undefined : (parsedBlocks[0]?.rounds ?? 3),
    roundDuration: isMultiBlock ? undefined : parsedBlocks[0]?.workDuration,
    restDuration: isMultiBlock ? undefined : parsedBlocks[0]?.restDuration,
    difficulty: baseDifficulty,
    combos: allCombos,
    phases,
    tags,
    supersetRepeats,
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
    name: hasCombos ? 'Combo Work' : 'Boxing',
    type: 'active',
    segmentType: hasCombos ? 'combo' : 'shadowboxing',
    duration: block.workDuration,
    activityType: hasCombos ? 'combos' : 'shadowbox',
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

function parseSupersetRepeats(prompt: string): number {
  if (/(?:whole\s*thing|everything|all)\s*(?:twice|2\s*times|two\s*times)/i.test(prompt)) return 2;
  if (/(?:whole\s*thing|everything|all)\s*(?:three\s*times|3\s*times)/i.test(prompt)) return 3;
  const supersetMatch = prompt.match(/(\d+)\s*superset/i);
  if (supersetMatch) return parseInt(supersetMatch[1]);
  if (/run\s*it\s*back/i.test(prompt)) return 2;
  return 1;
}

function inferDifficulty(prompt: string, userLevel: string): 'beginner' | 'intermediate' | 'advanced' {
  if (/\b(advanced|pro|hard|intense|brutal|killer)\b/i.test(prompt)) return 'advanced';
  if (/\b(intermediate|medium|moderate)\b/i.test(prompt)) return 'intermediate';
  if (/\b(beginner|easy|simple|basic|starter|newbie)\b/i.test(prompt)) return 'beginner';
  if (userLevel === 'advanced' || userLevel === 'pro') return 'advanced';
  if (userLevel === 'intermediate') return 'intermediate';
  return 'beginner';
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
  
  const tags = result.tags;
  
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
  totalDuration *= result.supersetRepeats;
  
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
