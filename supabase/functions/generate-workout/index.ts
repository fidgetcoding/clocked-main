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
  "name": string,
  "rounds": number | null,
  "roundDuration": number | null,
  "restDuration": number | null,
  "difficulty": "beginner" | "intermediate" | "advanced",
  "combos": string[][],
  "phases": Phase[],
  "tags": string[],
  "megasetRepeats": number,
  "hasWarmup": boolean,
  "hasCooldown": boolean,
  "parsedRounds": boolean,
  "parsedDurations": boolean,
  "parsedCombos": boolean,
  "hasMultipleBlocks": boolean
}

Phase = {
  "name": string,
  "phaseType": "continuous" | "circuit",
  "section": "warmup" | "grind" | "cooldown",
  "repeats": number,
  "segments": Segment[],
  "combos"?: string[][],
  "comboOrder"?: "sequential" | "random"
}

Segment = {
  "name": string,
  "type": "active" | "rest",
  "segmentType": "shadowboxing" | "combo" | "speedbag" | "doubleend" | "exercise" | "rest" | "sparring",
  "duration": number,
  "activityType"?: "combos" | "shadowbox" | "run" | "pushups" | "custom"
}

## BOXING NOTATION
Punches: 1=Jab, 2=Cross, 3=Lead Hook, 4=Rear Hook, 5=Lead Uppercut, 6=Rear Uppercut, 7=Lead Body Hook, 8=Rear Body Hook
Defense: SLIP L, SLIP R, ROLL L, ROLL R, DUCK, PULL, BLOCK, PARRY
Movement: STEP IN, STEP OUT, CIRCLE L, CIRCLE R, PIVOT

## TIER RULES
- Rookie/Beginner: Punches 1-4 only. Max combo length 3-4. No defense moves in combos.
- Intermediate: Punches 1-6. Max combo length 4-5. SLIP and ROLL allowed.
- Advanced/Pro: All punches 1-8. Combos up to 6-8. All defense and movement.

## SEGMENT TYPE RULES
- "combo" = Heavy bag. Use when user mentions heavy bag or has gloves+wraps+bag.
- "shadowboxing" = Shadow boxing. Always available.
- "speedbag" = Speed bag. Combos array uses drill NAMES (see list below).
- "doubleend" = Double end bag.
- "exercise" = Conditioning/bodyweight. Combos array uses exercise NAMES (see list below).
- "rest" = Rest period. type:"rest", segmentType:"rest", name:"Rest".

## SPEED BAG DRILL NAMES (use exactly)
Doubles, Triples, Front Fist Circles (Forward), Front Fist Circles (Reverse), Fist Rolls (Forward), Fist Rolls (Reverse), Side to Side, Outward Singles, Under & Over (Forward), Under & Over (Reverse), Backfists, One-Two Rhythm, Double Right Single Left, Triple Elbow Strike

## EXERCISE NAMES (use exactly, Title Case)
Push-Ups, Burpees, Squats, Mountain Climbers, Jumping Jacks, High Knees, Butt Kicks, Squat Jumps, Jumping Lunges, Bicycle Crunches, Flutter Kicks, Russian Twists, Plank Hold, Bear Crawls, Box Jumps, Tuck Jumps, Star Jumps, Leg Raises, Shoulder Taps, V-Ups, Wall Sit, Lunges, Crunches, Skaters, Lateral Shuffles, Calf Raises, Step-Ups, Inchworms, Dead Bugs, Bird Dogs, Glute Bridges, Jump Rope, Dynamic Stretches, Light Jogging, Arm Circles, Leg Swings, Hip Circles, Foam Rolling, Static Stretching, Deep Breathing, Light Stretching, Shadowboxing, Heavy Bag, Footwork Drills, Defense Drills, Bob & Weave

## ═══════════════════════════════════════════════════
## CRITICAL STRUCTURE RULES — READ CAREFULLY
## ═══════════════════════════════════════════════════

### RULE 1: PHASES vs ROUNDS — THIS IS THE MOST IMPORTANT RULE
❌ WRONG: Creating one phase per round (e.g., "Round 1", "Round 2", "Round 3" as separate phases)
✅ CORRECT: Create ONE phase with repeats = number of rounds. Segments define a single cycle.

Example: "5 rounds heavy bag, 3 min, 1 min rest" →
{
  "phases": [{
    "name": "Heavy Bag",
    "section": "grind",
    "repeats": 5,
    "segments": [
      {"name": "Heavy Bag", "type": "active", "segmentType": "combo", "duration": 180},
      {"name": "Rest", "type": "rest", "segmentType": "rest", "duration": 60}
    ],
    "combos": [["1","2"],["1","2","3"],["1","2","3","2"],["1","1","2"],["2","3","2"]],
    "comboOrder": "sequential"
  }]
}
NOT: 5 separate phases named "Round 1" through "Round 5".

### RULE 2: COMBO FORMAT — EVERY TOKEN MUST BE A SEPARATE ARRAY ELEMENT
❌ WRONG: ["1-2-3"] or ["1 2 3"] — hyphen-joined or space-joined strings
✅ CORRECT: ["1","2","3"] — each punch/defense is its own string element

Examples:
- Jab-Cross-Hook = ["1","2","3"]
- Double jab cross = ["1","1","2"]
- Jab-Cross-Slip-Hook = ["1","2","SLIP L","3"]
- Jab-Cross-Body Hook = ["1","2","7"]

For speed bag: [["Doubles"],["Triples"],["Side to Side"]] — each drill name is one-element array
For exercises: [["Burpees"],["Mountain Climbers"]] — each exercise is one-element array

### RULE 3: ALWAYS GENERATE COMBOS FOR BOXING/SHADOWBOXING PHASES
Every phase with segmentType "combo" or "shadowboxing" MUST have combos on the phase.
- Number of combos = phase.repeats (one combo per round)
- comboOrder: "sequential"
- Combos must follow TIER RULES for complexity

### RULE 4: WARMUP & COOLDOWN — DEFAULT ON, SKIP ONLY IF ASKED
- DEFAULT: Always include a warmup phase (section:"warmup") and cooldown phase (section:"cooldown")
- SKIP ONLY if user says "no warmup", "skip warmup", "no cooldown", "quick session", etc.
- Warmup: Jump Rope 120s → High Knees 60s → Shadowboxing 120s (adapt if no equipment)
- Cooldown: Light Shadowboxing 90s → Static Stretching 120s
- If user has NO equipment: use High Knees/Jumping Jacks for warmup instead of Jump Rope

### RULE 5: DURATION FORMAT
- All durations are in SECONDS
- "3 minutes" = 180, "1 min" = 60, "30 sec" = 30, "1 min 30 sec" = 90, "90 seconds" = 90
- NEVER interpret "90 seconds" as 90 minutes (5400s)

### RULE 6: SUPERSETS
A superset = multiple active segments in ONE phase.
- Each active segment has its own duration
- The rest segment comes at the END of the cycle
- phase.repeats = number of rounds
Example: "3 rounds: heavy bag 2min + burpees 1min, 45sec rest":
segments: [heavy_bag 120s, burpees 60s, rest 45s], repeats: 3

### RULE 7: SPEED BAG & EXERCISE PER-ROUND CONTENT
When user specifies "Round 1: X, Round 2: Y" for speed bag or conditioning:
- Put these as combos on the phase: [["X"],["Y"]]
- Segment name stays generic (e.g., "Speed Bag" or "Conditioning")
- Do NOT embed round content in segment names

### RULE 8: EQUIPMENT CONSTRAINTS
- No equipment → ONLY shadowboxing and exercise segments. NO combo/speedbag/doubleend.
- No gloves/bag → NO combo segments. Use shadowboxing instead.
- Has speed bag → can use speedbag segments.

### RULE 9: MEGASET REPEATS
Only set megasetRepeats > 1 when user explicitly says "repeat everything twice", "run it back", "do it again", etc.
Default is always megasetRepeats: 1.

### RULE 10: DIFFICULTY OVERRIDE
If user explicitly says "beginner", "advanced", etc. in their prompt, use that — even if their tier is different.

## ═══════════════════════════════════════════════════
## COMPLETE EXAMPLE OUTPUT
## ═══════════════════════════════════════════════════

Prompt: "3 rounds heavy bag, 2 min, 30 sec rest" (intermediate tier, has gloves+bag)

{
  "name": "Heavy Bag Session",
  "rounds": 3,
  "roundDuration": 120,
  "restDuration": 30,
  "difficulty": "intermediate",
  "combos": [["1","2","3"],["1","2","SLIP L","3"],["1","1","2","3","2"]],
  "phases": [
    {
      "name": "Warm Up",
      "phaseType": "continuous",
      "section": "warmup",
      "repeats": 1,
      "segments": [
        {"name": "Jump Rope", "type": "active", "segmentType": "exercise", "duration": 120},
        {"name": "High Knees", "type": "active", "segmentType": "exercise", "duration": 60},
        {"name": "Shadow Boxing", "type": "active", "segmentType": "shadowboxing", "duration": 120}
      ]
    },
    {
      "name": "Heavy Bag",
      "phaseType": "continuous",
      "section": "grind",
      "repeats": 3,
      "combos": [["1","2","3"],["1","2","SLIP L","3"],["1","1","2","3","2"]],
      "comboOrder": "sequential",
      "segments": [
        {"name": "Heavy Bag", "type": "active", "segmentType": "combo", "duration": 120},
        {"name": "Rest", "type": "rest", "segmentType": "rest", "duration": 30}
      ]
    },
    {
      "name": "Cool Down",
      "phaseType": "continuous",
      "section": "cooldown",
      "repeats": 1,
      "segments": [
        {"name": "Light Shadowboxing", "type": "active", "segmentType": "shadowboxing", "duration": 90},
        {"name": "Static Stretching", "type": "active", "segmentType": "exercise", "duration": 120}
      ]
    }
  ],
  "tags": ["boxing"],
  "megasetRepeats": 1,
  "hasWarmup": true,
  "hasCooldown": true,
  "parsedRounds": true,
  "parsedDurations": true,
  "parsedCombos": false,
  "hasMultipleBlocks": false
}

ALWAYS return just the JSON object. No markdown fences, no explanation.`;

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

function splitHyphenCombo(token: string): string[] {
  // Split "1-2-3" into ["1","2","3"]
  return token.split('-').map(t => t.trim()).filter(t => t.length > 0);
}

function autoRepairCombos(combos: any[]): string[][] {
  return combos.map(combo => {
    if (!Array.isArray(combo) || combo.length === 0) return [];
    // Detect and fix hyphen-joined combos like ["1-2-3"]
    if (combo.length === 1 && typeof combo[0] === 'string' && combo[0].includes('-')) {
      const parts = splitHyphenCombo(combo[0]);
      // Only split if it looks like boxing notation (first part is a single digit 1-8)
      if (parts.length > 1 && /^[1-8]$/.test(parts[0])) {
        return parts;
      }
    }
    return combo.map(String);
  });
}

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

  // Fix top-level combos
  if (result.combos.length > 0) {
    result.combos = autoRepairCombos(result.combos);
  }

  for (const phase of (result.phases || [])) {
    if (!phase.repeats || phase.repeats < 1) phase.repeats = 1;
    if (!phase.comboOrder) phase.comboOrder = 'sequential';

    // Fix phase-level combos
    if (phase.combos && Array.isArray(phase.combos)) {
      phase.combos = autoRepairCombos(phase.combos);
      // Sync first grind phase combos to top-level if top-level is empty
      if (result.combos.length === 0 && phase.section === 'grind') {
        result.combos = phase.combos;
      }
    }

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

    // Validate and auto-fix boxing combos
    if (phase.combos) {
      for (let i = 0; i < phase.combos.length; i++) {
        const combo = phase.combos[i];
        if (!Array.isArray(combo) || combo.length === 0) continue;
        // Only validate if it looks like a boxing combo (first token is a number 1-8 or defense/movement)
        const isBoxingCombo = VALID_BOXING_TOKENS.has(combo[0]);
        if (isBoxingCombo) {
          for (const token of combo) {
            if (!VALID_BOXING_TOKENS.has(token)) {
              errors.push(`Invalid boxing token "${token}" in phase "${phase.name}" combo ${i}`);
            }
          }
        }
        // Non-boxing combos (exercise names, drill names) are valid as-is
        // Check for malformed hyphen-joined combos like ["1-2-3"] and reject them
        if (combo.length === 1 && /^\d[-\d]+/.test(combo[0])) {
          errors.push(`Malformed combo in phase "${phase.name}" combo ${i}: tokens must be separate array elements, not hyphen-joined`);
        }
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
