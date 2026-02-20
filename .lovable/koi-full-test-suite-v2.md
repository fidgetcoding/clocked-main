# KOI AI Workout Builder — FULL TEST SUITE

## INSTRUCTIONS FOR LOVABLE

1. Run ALL tests below by calling the `generate-workout` edge function for each one
2. **DO NOT FIX ANYTHING** until all tests complete — we need the full picture
3. Report results in the exact format specified at the bottom
4. After reporting, list the top 5 failures by severity and suggest fixes

For each test, invoke:
```typescript
const { data, error } = await supabase.functions.invoke('generate-workout', {
  body: {
    prompt: "...",
    userTier: "...",
    equipment: { ... },
    experienceLevel: "..."
  }
});
```

Then validate `data` against each checkpoint. Mark ✅ or ❌ per checkpoint.

---

## ══════════════════════════════════════════════════════
## CATEGORY 1: BASIC SINGLE-PHASE (Foundation Tests)
## ══════════════════════════════════════════════════════

### TEST 1.2 — Shadowboxing Only (Beginner, No Equipment)

**Call**:
```json
{
  "prompt": "3 rounds shadowboxing, 2 minutes each, 30 sec rest",
  "userTier": "beginner",
  "equipment": { "gloves": false, "wraps": false, "heavyBag": false, "doubleEndBag": false, "speedBag": false, "jumpRope": false, "treadmill": false },
  "experienceLevel": "beginner"
}
```

**Checkpoints**:
- [ ] A: Response is valid JSON, no error/fallback
- [ ] B: At least one phase has section === "warmup"
- [ ] C: At least one phase has section === "cooldown"
- [ ] D: Grind phase has repeats === 3
- [ ] E: Grind active segment segmentType === "shadowboxing" (NOT "combo")
- [ ] F: Grind active segment duration === 120
- [ ] G: Grind rest segment duration === 30
- [ ] H: Phase combos exist with exactly 3 entries
- [ ] I: ALL combo tokens are from set {1,2,3,4} ONLY — no 5,6,7,8
- [ ] J: NO combo contains SLIP, ROLL, DUCK, PULL, BLOCK, PARRY
- [ ] K: Combos are token arrays like ["1","2","3"] not ["1-2-3"]
- [ ] L: Warmup does NOT contain segment named "Jump Rope" (no equipment)

---

### TEST 1.3 — User-Specified Combos (Exact Token Match)

**Call**:
```json
{
  "prompt": "4 rounds heavy bag, 2 min rounds, 45 sec rest. Round 1: 1-2. Round 2: 1-2-3. Round 3: 1-2-slip-3. Round 4: 1-1-2-3-6-3-2.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Grind phase repeats === 4
- [ ] B: Active segment segmentType === "combo"
- [ ] C: Active segment duration === 120
- [ ] D: Rest segment duration === 45
- [ ] E: Phase combos has exactly 4 entries
- [ ] F: Combo[0] === ["1","2"]
- [ ] G: Combo[1] === ["1","2","3"]
- [ ] H: Combo[2] contains "SLIP L" (or "SLIP") and "3" — should be ["1","2","SLIP L","3"]
- [ ] I: Combo[3] === ["1","1","2","3","6","3","2"]
- [ ] J: comboOrder === "sequential"

---

### TEST 1.5 — No Rest Requested

**Call**:
```json
{
  "prompt": "3 rounds heavy bag, 2 minutes each, no rest",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Grind phase repeats === 3
- [ ] B: Active segment duration === 120
- [ ] C: NO rest segment with duration > 0 (either no rest segment, or duration === 0)

---

## ══════════════════════════════════════════════════════
## CATEGORY 2: MULTI-PHASE WORKOUTS
## ══════════════════════════════════════════════════════

### TEST 2.1 — Full Multi-Phase Session (4 Blocks)

**Call**:
```json
{
  "prompt": "1 round warm up, 3 minutes, no rest. Dynamic stretches.\n\n3 rounds shadowboxing, 2 minutes each, 30 sec rest.\n\n3 rounds heavy bag, 3 minutes each, 1 min rest.\n\n1 round cool down, 3 minutes, no rest. Foam rolling.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Total phases >= 4
- [ ] B: A phase with section "warmup" exists
- [ ] C: Warmup phase name contains "Dynamic" or "Stretches" or "Warm"
- [ ] D: A grind phase exists with active segmentType "shadowboxing", repeats === 3, active duration === 120
- [ ] E: A SEPARATE grind phase exists with active segmentType "combo", repeats === 3, active duration === 180
- [ ] F: Shadowboxing and heavy bag are DIFFERENT phases (not merged into one)
- [ ] G: A phase with section "cooldown" exists
- [ ] H: Cooldown name contains "Foam" or "Rolling" or "Cool"
- [ ] I: Both grind phases have combos arrays

---

### TEST 2.2 — Three Badge Types (H + SB + E)

**Call**:
```json
{
  "prompt": "3 rounds heavy bag, 3 min each, 1 min rest. Round 1: 1-2-3. Round 2: 1-2-5-2. Round 3: 1-2-3-6-3-2.\n\n2 rounds speed bag, 2 minutes each, 30 sec rest. Round 1: doubles. Round 2: backfists.\n\n2 rounds conditioning, 45 seconds each, 20 sec rest. Round 1: burpees. Round 2: mountain climbers.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": true, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: At least 3 distinct grind phases
- [ ] B: Phase with segmentType "combo" — repeats===3, combos has 3 entries of punch tokens
- [ ] C: Combo phase combo[0] includes tokens "1","2","3"
- [ ] D: Combo phase combo[1] includes tokens "1","2","5","2"
- [ ] E: Combo phase combo[2] includes tokens "1","2","3","6","3","2"
- [ ] F: Phase with segmentType "speedbag" — repeats===2, active duration===120
- [ ] G: Speedbag combos are drill NAMES: one contains "Doubles", another contains "Backfists"
- [ ] H: Speedbag combos are NOT punch numbers
- [ ] I: Phase with segmentType "exercise" — repeats===2, active duration===45
- [ ] J: Exercise combos contain "Burpees" and "Mountain Climbers" as names
- [ ] K: Exercise rest duration === 20

---

### TEST 2.3 — Double End Bag

**Call**:
```json
{
  "prompt": "3 rounds double end bag, 2 min each, 30 sec rest",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": false, "doubleEndBag": true, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Active segment segmentType === "doubleend" (NOT "combo")
- [ ] B: Repeats === 3
- [ ] C: Active duration === 120
- [ ] D: Rest duration === 30

---

## ══════════════════════════════════════════════════════
## CATEGORY 3: SUPERSETS
## ══════════════════════════════════════════════════════

### TEST 3.2 — Superset with Per-Round Combos

**Call**:
```json
{
  "prompt": "3 rounds superset: heavy bag 2 minutes and burpees 1 minute. 45 sec rest. Round 1: 1-2. Round 2: 1-2-3. Round 3: 1-1-2-3-2.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Exactly 1 grind phase (NOT 3 separate phases)
- [ ] B: Phase has >= 2 active segments
- [ ] C: One active segment has segmentType "combo" and duration 120
- [ ] D: Another active segment has segmentType "exercise" and duration 60
- [ ] E: Rest segment duration === 45
- [ ] F: Phase repeats === 3
- [ ] G: Phase combos has 3 entries
- [ ] H: Combo[0] === ["1","2"]
- [ ] I: Combo[1] === ["1","2","3"]
- [ ] J: Combo[2] === ["1","1","2","3","2"]
- [ ] K: Segment names do NOT contain "Round" or combo notation

---

### TEST 3.3 — Superset Independent Durations

**Call**:
```json
{
  "prompt": "4 rounds: shadowboxing 2 min then jump rope 1 min. 30 sec rest.",
  "userTier": "intermediate",
  "equipment": { "gloves": false, "wraps": false, "heavyBag": false, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: 1 grind phase with >= 2 active segments
- [ ] B: Shadowboxing segment duration === 120
- [ ] C: Jump Rope segment duration === 60
- [ ] D: Durations are DIFFERENT (120 ≠ 60)
- [ ] E: Rest duration === 30
- [ ] F: Phase repeats === 4

---

## ══════════════════════════════════════════════════════
## CATEGORY 4: VAGUE / CREATIVE PROMPTS (LLM Reasoning)
## ══════════════════════════════════════════════════════

### TEST 4.1 — Duration-Based

**Call**:
```json
{
  "prompt": "20 minute intermediate workout",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Valid JSON, no error/fallback
- [ ] B: Has at least 1 grind phase
- [ ] C: difficulty === "intermediate"
- [ ] D: Calculate total: sum of (each phase's segment durations × repeats) × megasetRepeats. Result is between 900s and 1500s (15-25 min)
- [ ] E: At least one grind phase has combos
- [ ] F: Combos use only punches 1-6 (intermediate)

---

### TEST 4.2 — Surprise Me

**Call**:
```json
{
  "prompt": "surprise me. intermediate. 25 minutes.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Valid JSON
- [ ] B: Has warmup, grind, cooldown sections
- [ ] C: Total duration approximately 1200-1800s (20-30 min)
- [ ] D: At least 3 grind rounds total
- [ ] E: Combos exist and are intermediate-appropriate (1-6)

---

### TEST 4.3 — Defense Focus

**Call**:
```json
{
  "prompt": "Heavy on defense and head movement. 6 rounds, 2 min each, 45 sec rest.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Grind repeats === 6
- [ ] B: Active duration === 120
- [ ] C: Rest duration === 45
- [ ] D: Combos have 6 entries
- [ ] E: At least 3 of 6 combos contain a defense token (SLIP L, SLIP R, ROLL L, ROLL R, DUCK, PULL, BLOCK)
- [ ] F: Not ALL combos are pure punching (at least half have defense)

---

### TEST 4.4 — Body Shots

**Call**:
```json
{
  "prompt": "5 rounds body work, focus on body shots. Intermediate.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Grind phase with 5 repeats
- [ ] B: At least 3 of 5 combos contain token "7" or "8" (body punches)
- [ ] C: difficulty === "intermediate"

---

## ══════════════════════════════════════════════════════
## CATEGORY 5: EQUIPMENT CONSTRAINTS
## ══════════════════════════════════════════════════════

### TEST 5.1 — No Equipment At All

**Call**:
```json
{
  "prompt": "5 rounds, 3 min each, 1 min rest",
  "userTier": "beginner",
  "equipment": { "gloves": false, "wraps": false, "heavyBag": false, "doubleEndBag": false, "speedBag": false, "jumpRope": false, "treadmill": false },
  "experienceLevel": "beginner"
}
```

**Checkpoints**:
- [ ] A: ALL active segments have segmentType "shadowboxing" or "exercise" — NEVER "combo", "speedbag", "doubleend"
- [ ] B: No segment has name "Heavy Bag" or "Speed Bag" or "Double End Bag"
- [ ] C: Warmup does NOT contain "Jump Rope" segment
- [ ] D: Active duration === 180
- [ ] E: Rest duration === 60

---

## ══════════════════════════════════════════════════════
## CATEGORY 6: TIER / DIFFICULTY
## ══════════════════════════════════════════════════════

### TEST 6.1 — Beginner Combos

**Call**:
```json
{
  "prompt": "5 rounds heavy bag, 3 min, 1 min rest",
  "userTier": "beginner",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "beginner"
}
```

**Checkpoints**:
- [ ] A: ALL combo tokens are from {1,2,3,4} ONLY
- [ ] B: NO combo contains 5,6,7,8
- [ ] C: NO combo contains SLIP, ROLL, DUCK, PULL, BLOCK, PARRY, STEP, CIRCLE, PIVOT
- [ ] D: Average combo length <= 4 tokens
- [ ] E: difficulty === "beginner"

---

### TEST 6.2 — Advanced Combos

**Call**:
```json
{
  "prompt": "5 rounds heavy bag, 3 min, 1 min rest",
  "userTier": "advanced",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "advanced"
}
```

**Checkpoints**:
- [ ] A: At least 2 combos contain token "5", "6", "7", or "8"
- [ ] B: At least 1 combo contains defense (SLIP, ROLL, DUCK, etc.)
- [ ] C: Average combo length >= 4 tokens
- [ ] D: difficulty === "advanced"
- [ ] E: Combos are MORE complex than TEST 6.1 (longer, more variety)

---

### TEST 6.3 — Explicit Difficulty Override

**Call**:
```json
{
  "prompt": "3 rounds heavy bag, beginner level",
  "userTier": "advanced",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "advanced"
}
```

**Checkpoints**:
- [ ] A: difficulty === "beginner" (NOT "advanced")
- [ ] B: Combos use only punches 1-4 (beginner appropriate)
- [ ] C: Combo lengths are 2-3 tokens

---

## ══════════════════════════════════════════════════════
## CATEGORY 7: MEGASETS
## ══════════════════════════════════════════════════════

### TEST 7.2 — "Run It Back"

**Call**:
```json
{
  "prompt": "5 rounds heavy bag, 3 min, 1 min rest. Run it back.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: megasetRepeats === 2
- [ ] B: Grind phase repeats === 5 (NOT 10 — the rounds don't double)

---

## ══════════════════════════════════════════════════════
## CATEGORY 8: SPEED BAG
## ══════════════════════════════════════════════════════

### TEST 8.2 — Speed Bag Freestyle (No Drills Specified)

**Call**:
```json
{
  "prompt": "3 rounds speed bag, 2 min each, 30 sec rest",
  "userTier": "intermediate",
  "equipment": { "gloves": false, "wraps": false, "heavyBag": false, "doubleEndBag": false, "speedBag": true, "jumpRope": false, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Active segmentType === "speedbag"
- [ ] B: Phase combos is either undefined, null, or empty array (freestyle)
- [ ] C: Repeats === 3
- [ ] D: Active duration === 120
- [ ] E: No punch notation (1-8) in combos if any exist

---

## ══════════════════════════════════════════════════════
## CATEGORY 9: CONDITIONING
## ══════════════════════════════════════════════════════

### TEST 9.1 — Per-Round Exercises

**Call**:
```json
{
  "prompt": "4 rounds conditioning, 1 min each, 30 sec rest. Round 1: burpees. Round 2: mountain climbers. Round 3: push-ups. Round 4: squat jumps.",
  "userTier": "intermediate",
  "equipment": { "gloves": false, "wraps": false, "heavyBag": false, "doubleEndBag": false, "speedBag": false, "jumpRope": false, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: 1 grind phase (NOT 4 separate phases)
- [ ] B: Phase repeats === 4
- [ ] C: Active segmentType === "exercise"
- [ ] D: Active duration === 60
- [ ] E: Rest duration === 30
- [ ] F: Phase combos has 4 entries
- [ ] G: Combo[0] contains "Burpees"
- [ ] H: Combo[1] contains "Mountain Climbers"
- [ ] I: Combo[2] contains "Push-Ups"
- [ ] J: Combo[3] contains "Squat Jumps"
- [ ] K: Only 1 active segment per cycle (not 4 separate ones)
- [ ] L: comboOrder === "sequential"

---

## ══════════════════════════════════════════════════════
## CATEGORY 10: EDGE CASES
## ══════════════════════════════════════════════════════

### TEST 10.1 — One-Word Prompt

**Call**:
```json
{
  "prompt": "boxing",
  "userTier": "beginner",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "beginner"
}
```

**Checkpoints**:
- [ ] A: Valid JSON response (no crash, no 500 error)
- [ ] B: Has at least 1 grind phase
- [ ] C: Grind phase has repeats >= 1
- [ ] D: Has segments with duration > 0

---

### TEST 10.3 — HIIT Non-Boxing

**Call**:
```json
{
  "prompt": "HIIT circuit: 30 sec work, 15 sec rest, 8 rounds. Burpees, mountain climbers, squat jumps, push-ups.",
  "userTier": "intermediate",
  "equipment": { "gloves": false, "wraps": false, "heavyBag": false, "doubleEndBag": false, "speedBag": false, "jumpRope": false, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Active segmentType === "exercise" (NOT "combo")
- [ ] B: Active duration === 30
- [ ] C: Rest duration === 15
- [ ] D: Total repeats >= 4 (could be 8 rounds of 1 exercise, or 2 rounds of 4)
- [ ] E: Combos contain exercise names (not punch numbers)
- [ ] F: Tags include "hiit" or "conditioning"

---

### TEST 10.4 — Duration in Seconds

**Call**:
```json
{
  "prompt": "3 rounds, 90 seconds each, 30 seconds rest",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Active duration === 90 (NOT 5400)
- [ ] B: Rest duration === 30
- [ ] C: Repeats === 3

---

### TEST 10.5 — Mixed Duration Format

**Call**:
```json
{
  "prompt": "4 rounds, 1 min 30 sec each, 45 sec rest",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Active duration === 90 (NOT 60 and NOT 130)
- [ ] B: Rest duration === 45
- [ ] C: Repeats === 4

---

### TEST 10.6 — Garbage Input (Fallback)

**Call**:
```json
{
  "prompt": "asdfghjkl random garbage text 123",
  "userTier": "beginner",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "beginner"
}
```

**Checkpoints**:
- [ ] A: No 500 error (function doesn't crash)
- [ ] B: Either: valid JSON with at least 1 phase, OR fallback:true so client uses regex parser
- [ ] C: If valid JSON: has at least 1 grind phase with duration > 0

---

### TEST 10.7 — Word-Based Combo Notation

**Call**:
```json
{
  "prompt": "3 rounds heavy bag. Round 1: double jab cross uppercut. Round 2: jab cross slip left hook. Round 3: rear uppercut lead hook cross.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: 3 combos on the grind phase
- [ ] B: Combo[0] ≈ ["1","1","2","5"] (double jab=1,1; cross=2; uppercut=5)
- [ ] C: Combo[1] ≈ ["1","2","SLIP L","3"] (jab=1; cross=2; slip left=SLIP L; hook=3)
- [ ] D: Combo[2] ≈ ["6","3","2"] (rear uppercut=6; lead hook=3; cross=2)
- [ ] E: All tokens are valid (in VALID_BOXING_TOKENS set)

---

## ══════════════════════════════════════════════════════
## EXTRA TESTS: COMMON FAILURE PATTERNS
## ══════════════════════════════════════════════════════

### TEST E.1 — Combo Count Must Match Repeats (Sequential)

**Call**:
```json
{
  "prompt": "6 rounds heavy bag, 3 min, 1 min rest",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Grind phase repeats === 6
- [ ] B: Phase combos has EXACTLY 6 entries (one per round)
- [ ] C: comboOrder === "sequential"

---

### TEST E.2 — 12 Rounds (Stress Test for One-Phase-Per-Round Regression)

**Call**:
```json
{
  "prompt": "12 rounds heavy bag, 3 min, 1 min rest",
  "userTier": "advanced",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "advanced"
}
```

**Checkpoints**:
- [ ] A: 1 grind phase (NOT 12 separate phases)
- [ ] B: Phase repeats === 12
- [ ] C: Combos has 12 entries
- [ ] D: Combos are advanced-appropriate (some contain 5-8, defense, or movement)

---

### TEST E.3 — Warmup Specified, Cooldown Not

**Call**:
```json
{
  "prompt": "2 rounds jump rope warm up, 2 minutes each, 30 sec rest.\n\n5 rounds heavy bag, 3 min, 1 min rest.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Warmup phase exists with section "warmup"
- [ ] B: Warmup contains "Jump Rope", repeats === 2, duration === 120
- [ ] C: Grind phase with "combo" segmentType, repeats === 5
- [ ] D: A cooldown phase ALSO exists (user didn't say skip it — AI should auto-add)

---

### TEST E.4 — Full Complex Prompt (6 Blocks)

**Call**:
```json
{
  "prompt": "2 rounds jump rope, 2 minutes each, 30 sec rest.\n\n2 rounds shadowboxing, 2 min each, 30 sec rest. Round 1: jab cross. Round 2: jab cross hook.\n\n4 rounds heavy bag, 3 minutes each, 1 min rest. Round 1: 1-2. Round 2: 1-2-3-2. Round 3: 1-1-2-5-2. Round 4: 1-2-3-6-3-2.\n\n2 rounds speed bag, 2 min each, 30 sec rest. Round 1: doubles. Round 2: side to side.\n\n3 rounds conditioning, 45 sec each, 20 sec rest. Round 1: burpees. Round 2: mountain climbers. Round 3: plank.\n\n1 round cooldown, 3 minutes, no rest. Foam rolling.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": true, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: Total phases >= 6
- [ ] B: Jump rope phase — section "warmup" or "grind", segmentType "exercise"
- [ ] C: Shadowboxing phase — segmentType "shadowboxing", repeats 2, 2 combos (punch tokens)
- [ ] D: Heavy bag phase — segmentType "combo", repeats 4, 4 combos matching specified notation
- [ ] E: Heavy bag combo[0] = ["1","2"]
- [ ] F: Heavy bag combo[3] = ["1","2","3","6","3","2"]
- [ ] G: Speed bag phase — segmentType "speedbag", repeats 2, combos with drill names
- [ ] H: Conditioning phase — segmentType "exercise", repeats 3, combos with exercise names
- [ ] I: Cooldown phase — section "cooldown", name contains "Foam" or "Rolling"
- [ ] J: No phase is merged with another (6 distinct phases)

---

### TEST E.5 — "No Rest" Edge in Validation

**Call**:
```json
{
  "prompt": "5 rounds heavy bag, 3 min, no rest between rounds. No warmup. No cooldown.",
  "userTier": "intermediate",
  "equipment": { "gloves": true, "wraps": true, "heavyBag": true, "doubleEndBag": false, "speedBag": false, "jumpRope": true, "treadmill": false },
  "experienceLevel": "intermediate"
}
```

**Checkpoints**:
- [ ] A: No warmup phases
- [ ] B: No cooldown phases
- [ ] C: Grind phase repeats === 5, active duration === 180
- [ ] D: Either no rest segment, or rest duration === 0
- [ ] E: Response does NOT fail validation (some validators reject duration 0 — check if this causes errors)

---

## ══════════════════════════════════════════════════════
## RESULTS REPORTING FORMAT
## ══════════════════════════════════════════════════════

Report results using this EXACT format:

```
## TEST RESULTS — [DATE]

### SUMMARY
Total tests: XX
Passing: XX (XX%)
Failing: XX
Errors: XX

### DETAILED RESULTS

| Test | Result | Failed Checkpoints | Notes |
|------|--------|-------------------|-------|
| 1.2  | ✅/❌  | (list A,B,C etc)  | brief note |
| 1.3  | ✅/❌  | ...               | ...   |
| ...  | ...    | ...               | ...   |

### TOP 5 CRITICAL FAILURES (ranked by severity)

1. **[Test X.X — Checkpoint Y]**: What happened. Expected: ___. Got: ___. 
   Likely root cause: ___
   
2. **[Test X.X — Checkpoint Y]**: ...

3. ...

### RAW AI OUTPUTS FOR FAILING TESTS
For each failing test, paste the actual JSON that came back so we can diagnose.
```

## CRITICAL: DO NOT FIX ANYTHING UNTIL ALL TESTS ARE RUN AND REPORTED.
