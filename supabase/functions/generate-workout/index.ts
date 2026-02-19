import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are KOI (Knockout Intelligence), the AI workout builder for the Get Clocked boxing fitness app.

Your job: convert the user's workout request into a structured JSON object that the timer engine can consume. You MUST return ONLY valid JSON matching the ParsedWorkoutResult schema below. No markdown, no explanation, no preamble — just JSON.

## OUTPUT SCHEMA

{
  "name": string,           // Workout name (e.g. "Heavy Bag Blast", "Full Training Session")
  "rounds": number | null,  // Total grind rounds (null for multi-phase)
  "roundDuration": number | null,  // Seconds per round (null for multi-phase)
  "restDuration": number | null,   // Seconds rest (null for multi-phase)
  "difficulty": "beginner" | "intermediate" | "advanced",
  "combos": string[][],     // All combos across workout (for backward compat)
  "phases": Phase[],        // The workout structure (see below)
  "tags": string[],         // Auto-tags: "boxing", "cardio", "hiit", "strength", "conditioning", "defense", "footwork"
  "megasetRepeats": number, // Repeat entire grind N times (default 1, only >1 if user explicitly requests)
  "hasWarmup": boolean,
  "hasCooldown": boolean,
  "parsedRounds": boolean,    // true if user specified rounds
  "parsedDurations": boolean, // true if user specified durations
  "parsedCombos": boolean,    // true if user specified specific combos
  "hasMultipleBlocks": boolean // true if multiple distinct phase blocks
}

Phase = {
  "name": string,
  "phaseType": "continuous" | "circuit",
  "section": "warmup" | "grind" | "cooldown",
  "repeats": number,        // Number of times to cycle through segments
  "segments": Segment[],
  "combos"?: string[][],    // Phase-level combo library
  "comboOrder"?: "sequential" | "random"
}

Segment = {
  "name": string,
  "type": "active" | "rest",
  "segmentType": "shadowboxing" | "combo" | "speedbag" | "doubleend" | "exercise" | "rest" | "sparring",
  "duration": number,       // SECONDS
  "activityType"?: "combos" | "shadowbox" | "run" | "pushups" | "custom"
}

## BOXING NOTATION
Punches: 1=Jab, 2=Cross, 3=Lead Hook, 4=Rear Hook, 5=Lead Uppercut, 6=Rear Uppercut, 7=Lead Body Hook, 8=Rear Body Hook
Defense: SLIP L, SLIP R, ROLL L, ROLL R, DUCK, PULL, BLOCK, PARRY
Movement: STEP IN, STEP OUT, CIRCLE L, CIRCLE R, PIVOT

## TIER RULES
- Rookie/Beginner: Punches 1-4 (maybe 5-6 late). Max combo length 3-4. No defense in combos.
- Intermediate: Punches 1-6. Max combo length 4-5. SLIP and ROLL allowed.
- Advanced/Pro: All punches 1-8. Combos up to 6-8. All defense and movement.

## SEGMENT TYPE RULES
- "combo" = Heavy bag work. Use when user has gloves+wraps+heavy bag or mentions heavy bag.
- "shadowboxing" = Shadow boxing. Always available. Gets combos from same round.
- "speedbag" = Speed bag. Combos array uses drill NAMES: ["Doubles"], ["Fist Rolls (Forward)"], etc.
- "doubleend" = Double end bag. Like combo but different badge.
- "exercise" = Conditioning/bodyweight. Combos array uses exercise NAMES: ["Burpees"], ["Plank Hold"].
- "rest" = Rest period. Always type:"rest", segmentType:"rest", name:"Rest".

## SPEED BAG DRILL NAMES (use exactly)
Doubles, Triples, Front Fist Circles (Forward), Front Fist Circles (Reverse), Fist Rolls (Forward), Fist Rolls (Reverse), Side to Side, Outward Singles, Under & Over (Forward), Under & Over (Reverse), Backfists, One-Two Rhythm, Double Right Single Left, Triple Elbow Strike

## EXERCISE NAMES (use exactly, Title Case)
Push-Ups, Burpees, Squats, Mountain Climbers, Jumping Jacks, High Knees, Butt Kicks, Squat Jumps, Jumping Lunges, Bicycle Crunches, Flutter Kicks, Russian Twists, Plank Hold, Bear Crawls, Box Jumps, Tuck Jumps, Star Jumps, Leg Raises, Shoulder Taps, V-Ups, Wall Sit, Lunges, Crunches, Skaters, Lateral Shuffles, Calf Raises, Step-Ups, Inchworms, Dead Bugs, Bird Dogs, Glute Bridges, Jump Rope, Dynamic Stretches, Light Jogging, Arm Circles, Leg Swings, Hip Circles, Foam Rolling, Static Stretching, Deep Breathing, Light Stretching, Shadowboxing, Heavy Bag, Footwork Drills, Defense Drills, Bob & Weave

## STRUCTURE RULES
1. Warmup phases use section:"warmup". Cooldown phases use section:"cooldown". Everything else is section:"grind".
2. phase.repeats = how many rounds. Segments define ONE cycle. Timer loops segments × repeats.
3. Superset = multiple active segments in one phase (e.g., heavy bag + burpees + rest).
4. Always end grind phases with a rest segment (unless user says "no rest").
5. megasetRepeats only >1 when user explicitly says "repeat everything twice" or similar.
6. For sequential comboOrder, provide exactly as many combos as phase.repeats.
7. Durations are always in SECONDS. 3 minutes = 180. 1 min 30 sec = 90.
8. Default warmup if not specified: Jump Rope 120s → Active Rest 30s → Shadow Boxing 120s
9. Default cooldown if not specified: Light Shadow 90s → Stretch 120s
10. Skip warmup/cooldown if user says "no warmup", "skip warmup", "quick", etc.
11. If user has no equipment, only use shadowboxing and exercise segments — no combo/speedbag/doubleend.
12. ALWAYS return just JSON. No markdown fences, no explanation, just the JSON object.`;

interface GenerateRequest {
  prompt: string;
  userTier: string;
  equipment: Record<string, boolean>;
  experienceLevel: string;
  historyInsights?: {
    averageDifficulty: string | null;
    recentTrend: string | null;
    preferredDuration: number;
    suggestedDifficultyAdjust: number;
    totalWorkouts: number;
  };
}

// Valid boxing combo tokens
const VALID_BOXING_TOKENS = new Set([
  '1','2','3','4','5','6','7','8',
  'SLIP L','SLIP R','ROLL L','ROLL R','DUCK','PULL','BLOCK','PARRY',
  'STEP IN','STEP OUT','CIRCLE L','CIRCLE R','PIVOT'
]);

function autoRepair(result: any): any {
  if (!result.megasetRepeats || result.megasetRepeats < 1) result.megasetRepeats = 1;
  if (result.megasetRepeats > 5) result.megasetRepeats = 5;
  if (!result.tags) result.tags = [];
  if (result.hasWarmup === undefined) {
    result.hasWarmup = result.phases?.some((p: any) => p.section === 'warmup') ?? false;
  }
  if (result.hasCooldown === undefined) {
    result.hasCooldown = result.phases?.some((p: any) => p.section === 'cooldown') ?? false;
  }
  if (!result.combos) result.combos = [];

  for (const phase of (result.phases || [])) {
    if (!phase.repeats || phase.repeats < 1) phase.repeats = 1;
    if (!phase.comboOrder) phase.comboOrder = 'sequential';

    for (const seg of (phase.segments || [])) {
      // Clamp durations
      if (seg.duration < 5) seg.duration = 10;
      if (seg.duration > 600) seg.duration = 300;

      // Infer segmentType from name if missing
      if (seg.type === 'active' && !seg.segmentType) {
        const nameLower = (seg.name || '').toLowerCase();
        if (nameLower.includes('shadow')) seg.segmentType = 'shadowboxing';
        else if (nameLower.includes('heavy bag') || nameLower.includes('combo')) seg.segmentType = 'combo';
        else if (nameLower.includes('speed bag')) seg.segmentType = 'speedbag';
        else if (nameLower.includes('double end')) seg.segmentType = 'doubleend';
        else if (nameLower.includes('sparring')) seg.segmentType = 'sparring';
        else seg.segmentType = 'exercise';
      }

      // Fix rest segments
      if (seg.type === 'rest') {
        seg.segmentType = 'rest';
      }
    }
  }

  return result;
}

function validateParsedResult(result: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!result.phases || !Array.isArray(result.phases) || result.phases.length === 0) {
    errors.push('No phases array or empty phases');
    return { valid: false, errors };
  }

  const hasGrind = result.phases.some((p: any) => p.section === 'grind');
  if (!hasGrind) errors.push('No grind phase found');

  if (!['beginner', 'intermediate', 'advanced'].includes(result.difficulty)) {
    errors.push(`Invalid difficulty: ${result.difficulty}`);
  }

  if (result.megasetRepeats < 1 || result.megasetRepeats > 5) {
    errors.push(`Invalid megasetRepeats: ${result.megasetRepeats}`);
  }

  for (const phase of result.phases) {
    if (!phase.repeats || phase.repeats < 1) {
      errors.push(`Phase "${phase.name}" has invalid repeats: ${phase.repeats}`);
    }
    if (!phase.segments || phase.segments.length === 0) {
      errors.push(`Phase "${phase.name}" has no segments`);
    }

    for (const seg of (phase.segments || [])) {
      if (seg.duration < 5 || seg.duration > 600) {
        errors.push(`Segment "${seg.name}" has invalid duration: ${seg.duration}s`);
      }
      if (seg.type === 'active' && !seg.segmentType) {
        errors.push(`Active segment "${seg.name}" missing segmentType`);
      }
      if (seg.type === 'rest' && seg.segmentType !== 'rest') {
        errors.push(`Rest segment "${seg.name}" has wrong segmentType: ${seg.segmentType}`);
      }
    }

    // Validate boxing combos
    if (phase.combos) {
      for (let i = 0; i < phase.combos.length; i++) {
        const combo = phase.combos[i];
        if (!Array.isArray(combo) || combo.length === 0) continue;
        // Only validate if it looks like a boxing combo (first token is a number 1-8)
        const isBoxingCombo = VALID_BOXING_TOKENS.has(combo[0]);
        if (isBoxingCombo) {
          for (const token of combo) {
            if (!VALID_BOXING_TOKENS.has(token)) {
              errors.push(`Invalid boxing token "${token}" in phase "${phase.name}" combo ${i}`);
            }
          }
        }
        // Non-boxing combos (exercise names, drill names) are valid as-is
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function buildUserMessage(req: GenerateRequest): string {
  const equipmentList = Object.entries(req.equipment || {})
    .filter(([_, has]) => has)
    .map(([name]) => name)
    .join(', ') || 'none';

  let context = `Tier: ${req.userTier}\nEquipment: ${equipmentList}\nExperience: ${req.experienceLevel}`;

  if (req.historyInsights && req.historyInsights.totalWorkouts > 0) {
    const h = req.historyInsights;
    context += `\nHistory: ${h.totalWorkouts} workouts completed, avg difficulty: ${h.averageDifficulty || 'unknown'}, trend: ${h.recentTrend || 'unknown'}, preferred duration: ${h.preferredDuration} min, difficulty adjustment: ${h.suggestedDifficultyAdjust > 0 ? '+' : ''}${h.suggestedDifficultyAdjust}`;
  }

  return `${context}\n\nUser request: ${req.prompt}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const body: GenerateRequest = await req.json();

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured', fallback: true }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(body) },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI generation failed', fallback: true }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.choices?.[0]?.message?.content || '';

    if (!rawText) {
      console.error('Empty response from AI');
      return new Response(
        JSON.stringify({ error: 'Empty AI response', fallback: true }),
        { status: 422, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    // Strip markdown fences if present
    let jsonStr = rawText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('JSON parse error:', e, 'Raw:', rawText.substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Invalid JSON from AI', fallback: true }),
        { status: 422, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    // Auto-repair before validation
    parsed = autoRepair(parsed);

    // Validate
    const validation = validateParsedResult(parsed);
    if (!validation.valid) {
      console.error('Validation errors after repair:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', errors: validation.errors, fallback: true, partial: parsed }),
        { status: 422, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    console.log(`Generated workout: "${parsed.name}" with ${parsed.phases?.length} phases`);

    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );

  } catch (e) {
    console.error('Edge function error:', e);
    return new Response(
      JSON.stringify({ error: 'Internal error', fallback: true }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
});
