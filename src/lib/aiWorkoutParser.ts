// =====================================================
// AI Workout Parser - Framework-based prompt parsing
// =====================================================

import { parseComboString, extractCombosFromPrompt, containsComboNotation } from './comboParser';
import { Workout, WorkoutPhase, WorkoutSegment } from '@/types';

// =====================================================
// Default Durations (from Clombo Framework)
// =====================================================

export const DEFAULT_DURATIONS = {
  // Boxing-specific
  boxingRound: 180,      // 3 minutes
  boxingRest: 60,        // 1 minute
  
  // Warmup/Cooldown
  warmup: 300,           // 5 minutes
  cooldown: 300,         // 5 minutes
  
  // Cardio intervals
  sprint: 30,
  jog: 60,
  jumpRope: 120,
  
  // Strength
  strengthSet: 30,
  strengthRest: 30,
  
  // HIIT
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
  // Flags for what was explicitly parsed vs defaulted
  parsedRounds: boolean;
  parsedDurations: boolean;
  parsedCombos: boolean;
}

// =====================================================
// Main Parser Function
// =====================================================

/**
 * Parse a workout prompt using the Clombo Framework rules
 * Returns structured data that can be converted to a Workout object
 */
export function parseWorkoutInput(prompt: string, userLevel: string = 'beginner'): ParsedWorkoutResult {
  const lowerPrompt = prompt.toLowerCase();
  
  // Initialize result with defaults
  const result: ParsedWorkoutResult = {
    name: 'AI Workout',
    rounds: undefined,
    roundDuration: undefined,
    restDuration: undefined,
    difficulty: inferDifficulty(lowerPrompt, userLevel),
    combos: [],
    phases: [],
    tags: detectTags(prompt),
    supersetRepeats: 1,
    hasWarmup: !lowerPrompt.includes('no warmup') && !lowerPrompt.includes('skip warmup'),
    hasCooldown: !lowerPrompt.includes('no cooldown') && !lowerPrompt.includes('skip cooldown'),
    parsedRounds: false,
    parsedDurations: false,
    parsedCombos: false,
  };
  
  // Parse rounds
  const roundsResult = parseRounds(lowerPrompt);
  if (roundsResult !== null) {
    result.rounds = roundsResult;
    result.parsedRounds = true;
  }
  
  // Parse durations
  const durations = parseDurations(lowerPrompt);
  if (durations.workDuration !== null) {
    result.roundDuration = durations.workDuration;
    result.parsedDurations = true;
  }
  if (durations.restDuration !== null) {
    result.restDuration = durations.restDuration;
    result.parsedDurations = true;
  }
  
  // Parse combos
  const combos = parseCombos(prompt);
  if (combos.length > 0) {
    result.combos = combos;
    result.parsedCombos = true;
  }
  
  // Parse superset/repeat everything
  result.supersetRepeats = parseSupersetRepeats(lowerPrompt);
  
  // Generate workout name
  result.name = generateWorkoutName(lowerPrompt, result);
  
  // Parse exercises between rounds
  const exercises = parseInterspersedExercises(lowerPrompt);
  
  // Build phases
  result.phases = buildPhases(result, exercises);
  
  return result;
}

// =====================================================
// Individual Parsing Functions
// =====================================================

/**
 * Parse round count from prompt
 */
function parseRounds(prompt: string): number | null {
  // Pattern: "X rounds" or "X round"
  const roundMatch = prompt.match(/(\d+)\s*(?:round|rnd|set|interval)s?\b/i);
  if (roundMatch) {
    return parseInt(roundMatch[1]);
  }
  
  // Pattern: "round X" (less common)
  const roundAltMatch = prompt.match(/round\s*(\d+)/i);
  if (roundAltMatch) {
    return parseInt(roundAltMatch[1]);
  }
  
  return null;
}

/**
 * Parse work and rest durations from prompt
 */
function parseDurations(prompt: string): { workDuration: number | null; restDuration: number | null } {
  let workDuration: number | null = null;
  let restDuration: number | null = null;
  
  // Work duration patterns
  // "3 min rounds", "2 minute rounds", "180 second rounds"
  const workMinMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(?:min|minute)s?\s*(?:round|work|on|each)/i);
  if (workMinMatch) {
    workDuration = Math.round(parseFloat(workMinMatch[1]) * 60);
  }
  
  const workSecMatch = prompt.match(/(\d+)\s*(?:sec|second)s?\s*(?:round|work|on|each)/i);
  if (workSecMatch) {
    workDuration = parseInt(workSecMatch[1]);
  }
  
  // Also check for "round time: X" or "work: X min"
  const roundTimeMatch = prompt.match(/(?:round\s*time|work\s*time|on\s*time)[:\s]*(\d+(?:\.\d+)?)\s*(?:min|minute|sec|second)?s?/i);
  if (roundTimeMatch) {
    const value = parseFloat(roundTimeMatch[1]);
    // If no unit and value is small, assume minutes
    workDuration = value < 10 ? Math.round(value * 60) : Math.round(value);
  }
  
  // Rest duration patterns
  // "30 second rest", "1 min rest", "rest: 60s"
  const restMinMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(?:min|minute)s?\s*(?:rest|break|off)/i);
  if (restMinMatch) {
    restDuration = Math.round(parseFloat(restMinMatch[1]) * 60);
  }
  
  const restSecMatch = prompt.match(/(\d+)\s*(?:sec|second)s?\s*(?:rest|break|off)/i);
  if (restSecMatch) {
    restDuration = parseInt(restSecMatch[1]);
  }
  
  // "with X rest"
  const withRestMatch = prompt.match(/with\s*(\d+)\s*(?:sec|second|s)?\s*rest/i);
  if (withRestMatch) {
    restDuration = parseInt(withRestMatch[1]);
  }
  
  const withRestMinMatch = prompt.match(/with\s*(\d+)\s*(?:min|minute)s?\s*rest/i);
  if (withRestMinMatch) {
    restDuration = parseInt(withRestMinMatch[1]) * 60;
  }
  
  return { workDuration, restDuration };
}

/**
 * Parse combo strings from prompt
 */
function parseCombos(prompt: string): string[][] {
  const combos: string[][] = [];
  
  // Extract combo-like patterns
  const comboStrings = extractCombosFromPrompt(prompt);
  
  for (const comboStr of comboStrings) {
    const parsed = parseComboString(comboStr);
    if (parsed.length > 0) {
      combos.push(parsed);
    }
  }
  
  // Also try to parse the entire prompt if it looks like a simple combo
  if (combos.length === 0 && containsComboNotation(prompt)) {
    // Check if the prompt is primarily a combo description
    const words = prompt.split(/\s+/);
    if (words.length <= 15) {
      const parsed = parseComboString(prompt);
      if (parsed.length >= 2) {
        combos.push(parsed);
      }
    }
  }
  
  return combos;
}

/**
 * Parse superset/repeat everything instructions
 */
function parseSupersetRepeats(prompt: string): number {
  // "do the whole thing twice", "repeat everything twice"
  if (/(?:whole\s*thing|everything|all)\s*(?:twice|2\s*times|two\s*times)/i.test(prompt)) {
    return 2;
  }
  
  if (/(?:whole\s*thing|everything|all)\s*(?:three\s*times|3\s*times)/i.test(prompt)) {
    return 3;
  }
  
  // "X supersets"
  const supersetMatch = prompt.match(/(\d+)\s*superset/i);
  if (supersetMatch) {
    return parseInt(supersetMatch[1]);
  }
  
  // "run it back"
  if (/run\s*it\s*back/i.test(prompt)) {
    return 2;
  }
  
  return 1;
}

/**
 * Infer difficulty from prompt and user level
 */
function inferDifficulty(prompt: string, userLevel: string): 'beginner' | 'intermediate' | 'advanced' {
  if (/\b(advanced|pro|hard|intense|brutal|killer)\b/i.test(prompt)) {
    return 'advanced';
  }
  if (/\b(intermediate|medium|moderate)\b/i.test(prompt)) {
    return 'intermediate';
  }
  if (/\b(beginner|easy|simple|basic|starter|newbie)\b/i.test(prompt)) {
    return 'beginner';
  }
  
  // Default to user's level
  if (userLevel === 'advanced' || userLevel === 'pro') return 'advanced';
  if (userLevel === 'intermediate') return 'intermediate';
  return 'beginner';
}

/**
 * Detect tags based on keywords in prompt
 */
export function detectTags(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const tags: string[] = [];
  
  for (const [tag, keywords] of Object.entries(KEYWORD_TAGS)) {
    if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
      tags.push(tag);
    }
  }
  
  // Always add boxing if we have punch-related content
  if (!tags.includes('boxing') && containsComboNotation(prompt)) {
    tags.push('boxing');
  }
  
  return tags;
}

/**
 * Parse exercises to do between rounds (e.g., "10 pushups between rounds")
 */
function parseInterspersedExercises(prompt: string): Array<{ name: string; reps?: number; duration?: number }> {
  const exercises: Array<{ name: string; reps?: number; duration?: number }> = [];
  
  // Pattern: "X pushups between rounds", "10 burpees after each round"
  const patterns = [
    /(\d+)\s*(pushups?|push-ups?|burpees?|squats?|situps?|sit-ups?|pullups?|pull-ups?|curlups?|curl-ups?)\s*(?:between|after|each)/gi,
    /(?:between|after)\s*(?:each\s*)?(?:round)?\s*(?:do\s*)?(\d+)\s*(pushups?|burpees?|squats?)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(prompt)) !== null) {
      const reps = parseInt(match[1]);
      const exerciseName = match[2].toLowerCase().replace(/-/g, '').replace(/s$/, '');
      
      // Normalize exercise name
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

/**
 * Generate a workout name based on parsed content
 */
function generateWorkoutName(prompt: string, result: ParsedWorkoutResult): string {
  const tags = result.tags;
  
  if (tags.includes('defense') || prompt.includes('defense')) {
    return 'Defense Drill';
  }
  if (tags.includes('footwork')) {
    return 'Footwork Focus';
  }
  if (tags.includes('hiit')) {
    return 'HIIT Boxing';
  }
  if (prompt.includes('heavy bag') || prompt.includes('bag work')) {
    return 'Heavy Bag Blast';
  }
  if (prompt.includes('shadow')) {
    return 'Shadow Session';
  }
  if (tags.includes('cardio') || prompt.includes('conditioning')) {
    return 'Cardio Conditioning';
  }
  if (result.rounds && result.rounds >= 6) {
    return 'Full Session';
  }
  if (result.parsedCombos && result.combos.length > 0) {
    return 'Combo Drill';
  }
  
  return 'Quick Burn';
}

/**
 * Build workout phases from parsed data
 */
function buildPhases(
  result: ParsedWorkoutResult,
  exercises: Array<{ name: string; reps?: number; duration?: number }>
): ParsedPhase[] {
  const phases: ParsedPhase[] = [];
  
  // Warmup phase
  if (result.hasWarmup) {
    phases.push({
      name: 'Dynamic Warmup',
      phaseType: 'continuous',
      section: 'warmup',
      repeats: 1,
      segments: [
        {
          name: 'Jump Rope',
          type: 'active',
          segmentType: 'work',
          duration: 120,
          activityType: 'run',
        },
        {
          name: 'Active Rest',
          type: 'rest',
          segmentType: 'rest',
          duration: 30,
        },
        {
          name: 'Shadow Boxing',
          type: 'active',
          segmentType: 'shadowboxing',
          duration: 120,
          activityType: 'shadowbox',
        },
      ],
    });
  }
  
  // Main rounds (grind phase)
  const rounds = result.rounds ?? 3;
  const roundDuration = result.roundDuration ?? DEFAULT_DURATIONS.boxingRound;
  const restDuration = result.restDuration ?? DEFAULT_DURATIONS.boxingRest;
  
  const grindSegments: ParsedSegment[] = [];
  
  // Work segment
  grindSegments.push({
    name: result.parsedCombos ? 'Combo Work' : 'Boxing',
    type: 'active',
    segmentType: result.parsedCombos ? 'combo' : 'shadowboxing',
    duration: roundDuration,
    activityType: result.parsedCombos ? 'combos' : 'shadowbox',
  });
  
  // Add interspersed exercises if any
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
  
  // Rest segment
  grindSegments.push({
    name: 'Rest',
    type: 'rest',
    segmentType: 'rest',
    duration: restDuration,
  });
  
  phases.push({
    name: result.tags.includes('hiit') ? 'HIIT Rounds' : 'Main Rounds',
    phaseType: 'circuit',
    section: 'grind',
    repeats: rounds,
    segments: grindSegments,
  });
  
  // Cooldown phase
  if (result.hasCooldown) {
    phases.push({
      name: 'Cooldown',
      phaseType: 'continuous',
      section: 'cooldown',
      repeats: 1,
      segments: [
        {
          name: 'Light Shadow',
          type: 'active',
          segmentType: 'shadowboxing',
          duration: 90,
          activityType: 'shadowbox',
        },
        {
          name: 'Stretch',
          type: 'active',
          segmentType: 'work',
          duration: 120,
          activityType: 'custom',
        },
      ],
    });
  }
  
  return phases;
}

// =====================================================
// Convert ParsedWorkoutResult to Workout object
// =====================================================

/**
 * Convert parsed result to a full Workout object
 * This maintains compatibility with existing timer engine
 */
export function parsedResultToWorkout(result: ParsedWorkoutResult): Workout {
  const generateId = () => crypto.randomUUID();
  
  // Convert parsed phases to WorkoutPhase objects
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
      case 'warmup':
        warmupPhases.push(workoutPhase);
        break;
      case 'grind':
        grindPhases.push(workoutPhase);
        break;
      case 'cooldown':
        cooldownPhases.push(workoutPhase);
        break;
    }
  }
  
  // Calculate total duration
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

/**
 * Check if a prompt provides enough information for a good workout
 * Returns suggestions if the prompt is too vague
 */
export function checkPromptQuality(prompt: string): {
  isComplete: boolean;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  const lowerPrompt = prompt.toLowerCase();
  
  // Check minimum length
  if (prompt.trim().length < 10) {
    suggestions.push("Try adding more detail - e.g., '5 rounds of boxing with 30 second rest'");
  }
  
  // Check for rounds
  if (!/\d+\s*(?:round|set|interval)/i.test(lowerPrompt)) {
    suggestions.push("Specify rounds - e.g., '6 rounds'");
  }
  
  // Check for duration
  if (!/\d+\s*(?:min|sec|minute|second)/i.test(lowerPrompt)) {
    suggestions.push("Add timing - e.g., '3 min rounds with 1 min rest'");
  }
  
  return {
    isComplete: suggestions.length === 0,
    suggestions,
  };
}
