# Get Clocked — KOI Testing Suite v2.0

## 1,000 Test Cases: 500 AI Workout Builder + 500 AI Coach

---

# HOW TO USE THIS DOCUMENT

This is an automated/semi-automated test suite for Lovable. It tests the two core AI systems in Get Clocked:

1. **AI Workout Builder** — Takes natural language input → generates structured Workout JSON → renders on the Build page
2. **AI Coach** — Analyzes user workout history, equipment, tier, patterns, and journal entries → generates contextual training insights, suggestions, and auto-generated workout recommendations (NOT a chat interface — it reads data and outputs cards/suggestions)

---

# TESTING METHODOLOGY

## For the AI Workout Builder:

Each test provides a **Prompt** (exactly what goes into the AI Builder modal). The test runner should:

1. Feed the prompt into the AI Builder's `generateWorkoutFromPrompt()` function
2. Capture the returned workout JSON
3. Validate against the **Expected Output** fields listed
4. Optionally render on the Build page and validate the UI matches

### What to Validate Per Test:

| Field | What to Check |
|-------|---------------|
| **Phase count** | Correct number of phases in the workout |
| **Phase type** | `continuous`, `circuit`, or `rest` — assigned correctly per phase |
| **Section assignment** | Phase goes to `warmup`, `grind` (ROUNDS), or `cooldown` section |
| **Badge type** | H (heavy bag), SB (speed bag), DB (double end bag), S (shadowbox), E (exercise), R (rest) |
| **Repeats** | `phase.repeats` matches the number of rounds requested (12 rounds = 1 phase with repeats: 12, NOT 12 separate phases) |
| **Active segment duration** | Matches requested round/work time in seconds |
| **Rest segment duration** | Matches requested rest time in seconds |
| **Combo array** | Correct combos in correct notation — punch numbers (1-8), defense tokens (SLIP, SLIP L, SLIP R, ROLL, DUCK, WEAVE, JUMP BACK), drill names for speed bag, exercise names for conditioning |
| **Combo count** | COMBOS(n) matches number of per-round combos assigned |
| **Library label** | COMBOS for boxing phases, DRILLS for speed bag, EXERCISES for conditioning/non-boxing |
| **Segment names** | Clean names — no combo notation leaking into segment name fields |
| **totalDuration** | Sum of (each phase's segment durations × phase repeats) × supersetRepeats |
| **megasetRepeats** | Present and correct when "repeat everything" / "do it twice" / "run it back" is requested |
| **Smart defaults** | When user omits info: boxing round = 180s, rest = 60s, pushups/strength = 30s, warmup/cooldown = 300s |

### Punch Notation Reference:

| Number | Punch | Number | Punch |
|--------|-------|--------|-------|
| 1 | Jab | 5 | Lead Uppercut |
| 2 | Cross | 6 | Rear Uppercut |
| 3 | Lead Hook | 7 | Lead Body Hook |
| 4 | Rear Hook | 8 | Rear Body Hook |

### Word-to-Number Parsing:

| Natural Language | Parsed Notation |
|-----------------|-----------------|
| "jab cross" | `["1", "2"]` |
| "jab cross hook" | `["1", "2", "3"]` |
| "double jab cross" | `["1", "1", "2"]` |
| "triple jab" | `["1", "1", "1"]` |
| "body hook" | `["7"]` |
| "rear body hook" | `["8"]` |
| "jab cross slip hook" | `["1", "2", "SLIP", "3"]` |
| "1-2-duck-3" | `["1", "2", "DUCK", "3"]` |
| "hook uppercut cross" or "3-6-2" | `["3", "6", "2"]` |

### Defense Token Reference:

`SLIP`, `SLIP L`, `SLIP R`, `DUCK`, `ROLL`, `WEAVE`, `JUMP BACK`, `PARRY`, `BLOCK`

### Movement Token Reference:

`STEP IN`, `STEP OUT`, `CIRCLE L`, `CIRCLE R`, `PIVOT`

### Speed Bag Drill Names (NOT punch numbers):

`Doubles`, `Triples`, `Fist Rolls`, `Backfists`, `Side to Side`, `Outward Triples`, `Inward Singles`, `Double/Single`, `Freestyle`

---

## For the AI Coach:

The AI Coach is NOT a chat interface. It is a background analysis system. It:

1. Reads the user's **workout history** (completed sessions, timestamps, durations, combos used)
2. Reads the user's **journal entries** (post-workout notes like "felt gassed", "hooks felt off")
3. Reads the user's **profile** (tier, equipment, streak, XP, level)
4. Reads the user's **patterns** (frequency, time of day, skip rate, completion rate, combo diversity)
5. Outputs **insight cards**, **workout suggestions**, and **auto-generated workouts** that the user can one-tap to start

### What to Validate Per Coach Test:

| Field | What to Check |
|-------|---------------|
| **Insight relevance** | The suggestion/insight directly relates to the mock data provided |
| **Workout appropriateness** | Generated workout matches user's tier, equipment, and current state |
| **Pattern recognition** | Coach correctly identifies trends in the mock history |
| **Journal integration** | Coach references and responds to journal entries |
| **Equipment awareness** | Suggestions only use equipment the user has |
| **Tier awareness** | Combo complexity matches user's prestige tier |
| **Recovery intelligence** | Recommends lighter sessions after heavy ones, rest after consecutive days |
| **No hallucination** | Coach doesn't reference workouts that didn't happen or equipment the user doesn't have |
| **Actionable output** | Every insight either has a suggested workout attached or a specific actionable recommendation |

### Coach Test Format:

Each coach test provides a **Mock User State** (simulated data the coach analyzes) and an **Expected Behavior** (what the coach should output given that data). The test runner should:

1. Seed the mock user state into the database/context
2. Trigger the AI Coach analysis
3. Capture output (insight cards, workout suggestion, recommendation text)
4. Validate against Expected Behavior

---

---

# PART 1: AI WORKOUT BUILDER (500 Tests)

---

## CATEGORY 1: Single-Phase Boxing — Clean Language (Tests 1–30)

> Simplest possible prompts. If these break, nothing else will work.

---

### WB-001 — Basic Boxing Rounds

**Prompt:** `10 rounds of boxing, 3 minutes each, 1 minute rest`

**Expected Output:**
- 1 grind phase, H or S badge (depending on equipment context), repeats: 10
- Active segment: 180s
- Rest segment: 60s
- No warmup/cooldown unless AI adds smart defaults
- totalDuration: (180 + 60) × 10 = 2400s (40 min) + any warmup/cooldown

**Pass/Fail:** ✅ if 10 repeats, 180s/60s durations. ❌ if rounds are separate phases or durations are wrong.

---

### WB-002 — Shadowboxing Only

**Prompt:** `5 rounds shadowboxing, 2 minutes per round, 30 seconds rest`

**Expected Output:**
- S badge, repeats: 5
- Active: 120s, Rest: 30s
- No bag references — pure shadow

**Pass/Fail:** ✅ if S badge, correct durations. ❌ if it assigns H badge or references bag work.

---

### WB-003 — With Warmup and Cooldown

**Prompt:** `3 minute warmup, 8 rounds of combos on the heavy bag, 3 min rounds, 1 min rest, 5 minute cooldown`

**Expected Output:**
- Phase 1: WARMUP section, continuous, ~180s
- Phase 2: GRIND/ROUNDS section, H badge, repeats: 8, active: 180s, rest: 60s
- Phase 3: COOLDOWN section, continuous, ~300s

**Pass/Fail:** ✅ if 3 phases in correct sections with correct durations. ❌ if warmup/cooldown missing or in wrong section.

---

### WB-004 — Specific Combo Assignment

**Prompt:** `4 rounds of 1-2, 3 minutes each, 1 minute rest`

**Expected Output:**
- H or S badge, repeats: 4
- COMBOS(1): `["1", "2"]` — same combo all rounds
- Active: 180s, Rest: 60s

**Pass/Fail:** ✅ if combo parses to exactly `["1", "2"]`. ❌ if combo is wrong or missing.

---

### WB-005 — Per-Round Combos

**Prompt:** `3 rounds heavy bag. Round 1: 1-2. Round 2: 1-2-3. Round 3: 1-2-3-2. 3 minutes each, 1 minute rest.`

**Expected Output:**
- H badge, repeats: 3
- COMBOS(3): `["1","2"]`, `["1","2","3"]`, `["1","2","3","2"]`
- Combos cycle across rounds

**Pass/Fail:** ✅ if 3 distinct combos in correct order. ❌ if merged, reordered, or missing.

---

### WB-006 — No Rest

**Prompt:** `3 rounds heavy bag, 2 minutes each, no rest`

**Expected Output:**
- Repeats: 3, Active: 120s
- Either no rest segment or rest: 0s

**Pass/Fail:** ✅ if no rest between rounds. ❌ if default rest appears.

---

### WB-007 — No Warmup No Cooldown

**Prompt:** `5 rounds heavy bag, 3 min, 1 min rest. No warmup. Skip cooldown.`

**Expected Output:**
- ZERO warmup phases, ZERO cooldown phases
- Grind only: 5 repeats

**Pass/Fail:** ✅ if only grind phases exist. ❌ if warmup or cooldown appears.

---

### WB-008 — Short Quick Session

**Prompt:** `Quick 10 minute shadowboxing session`

**Expected Output:**
- S badge, total active time ≈ 600s
- AI chooses reasonable round structure (e.g. 5 × 2 min or similar)
- May or may not include rest

**Pass/Fail:** ✅ if total duration ≈ 10 min and uses shadowboxing. ❌ if way over/under time.

---

### WB-009 — Beginner Level Request

**Prompt:** `Beginner boxing workout, 20 minutes total`

**Expected Output:**
- Total duration ≈ 1200s (within ±10%)
- Combos should be beginner-appropriate: 2-3 punch combos, punches 1-3 only, possibly simple defense (slip)
- Should include warmup and cooldown

**Pass/Fail:** ✅ if duration ~20 min, combos are simple. ❌ if advanced combos (5+ punches, 7-8) or duration wildly off.

---

### WB-010 — Advanced Level Request

**Prompt:** `Advanced 45 minute boxing session`

**Expected Output:**
- Total duration ≈ 2700s (within ±10%)
- Combos can include punches 1-8, defense tokens, 4-7 punch sequences
- Should include warmup, multiple round types, and cooldown

**Pass/Fail:** ✅ if duration ~45 min and combos are complex. ❌ if beginner combos or duration way off.

---

### WB-011 — Heavy Bag Explicit

**Prompt:** `Heavy bag only workout. 10 rounds. 3 minutes. 1 minute rest.`

**Expected Output:**
- H badge, repeats: 10, Active: 180s, Rest: 60s
- All segments reference heavy bag

**Pass/Fail:** ✅ if H badge throughout. ❌ if S or E badge assigned.

---

### WB-012 — Double End Bag

**Prompt:** `5 rounds double end bag, 3 min each, 1 min rest`

**Expected Output:**
- DB badge, repeats: 5, Active: 180s, Rest: 60s

**Pass/Fail:** ✅ if DB badge. ❌ if H or S badge.

---

### WB-013 — Speed Bag Freestyle

**Prompt:** `6 rounds speed bag, 2 minutes each, 30 seconds rest`

**Expected Output:**
- SB badge, repeats: 6, Active: 120s, Rest: 30s
- NO combos assigned (freestyle — no drills specified)

**Pass/Fail:** ✅ if SB badge, no combos (freestyle). ❌ if punch numbers assigned.

---

### WB-014 — Speed Bag With Named Drills

**Prompt:** `4 rounds speed bag. Round 1: doubles. Round 2: triples. Round 3: fist rolls. Round 4: side to side. 90 seconds each, 30 sec rest.`

**Expected Output:**
- SB badge, repeats: 4, Active: 90s, Rest: 30s
- DRILLS(4): `Doubles`, `Triples`, `Fist Rolls`, `Side to Side`
- Drill NAMES, not punch numbers

**Pass/Fail:** ✅ if drill names display correctly. ❌ if punch numbers appear.

---

### WB-015 — Jump Rope Phase

**Prompt:** `5 minutes jump rope`

**Expected Output:**
- E badge, continuous phase, 300s
- Section: warmup (or AI-inferred placement)

**Pass/Fail:** ✅ if jump rope as exercise, ~300s. ❌ if parsed as boxing.

---

### WB-016 — Word-Based Combos

**Prompt:** `6 rounds. Jab cross hook. 2 minutes each. 30 seconds rest.`

**Expected Output:**
- COMBOS(1): `["1", "2", "3"]`
- Repeats: 6, Active: 120s, Rest: 30s

**Pass/Fail:** ✅ if "jab cross hook" → `["1","2","3"]`. ❌ if kept as text or wrong numbers.

---

### WB-017 — Double Jab Modifier

**Prompt:** `8 rounds. Double jab cross. 3 minutes. 1 minute rest.`

**Expected Output:**
- COMBOS(1): `["1", "1", "2"]`

**Pass/Fail:** ✅ if "double jab" → `["1","1"]`. ❌ if just `["1","2"]`.

---

### WB-018 — Defense In Combo

**Prompt:** `4 rounds of 1-2-slip-3. 3 minutes each. 1 minute rest.`

**Expected Output:**
- COMBOS(1): `["1", "2", "SLIP", "3"]` or `["1", "2", "SLIP L", "3"]`

**Pass/Fail:** ✅ if slip token present between punches. ❌ if stripped out.

---

### WB-019 — Body Shot Combos

**Prompt:** `3 rounds of body shots only. 2 minutes each. 45 seconds rest.`

**Expected Output:**
- Combos should feature 7 and/or 8 primarily
- Active: 120s, Rest: 45s

**Pass/Fail:** ✅ if combos use 7/8. ❌ if only head-level punches.

---

### WB-020 — Compound Duration

**Prompt:** `6 rounds, 2 min 30 sec each, 45 sec rest`

**Expected Output:**
- Active: 150s (not 120 or 180)
- Rest: 45s

**Pass/Fail:** ✅ if "2 min 30 sec" → 150s. ❌ if 120s or 180s.

---

### WB-021 — Uppercut Focus

**Prompt:** `Uppercut focused workout. 8 rounds. 2 minutes each. 1 minute rest.`

**Expected Output:**
- Combos should prominently feature 5 and/or 6
- Repeats: 8

**Pass/Fail:** ✅ if combos contain 5/6. ❌ if only straights/hooks.

---

### WB-022 — Hook Focus

**Prompt:** `Lead hook focused session. 8 rounds. 2 minutes. 30 seconds rest.`

**Expected Output:**
- Combos should prominently feature 3
- Repeats: 8

**Pass/Fail:** ✅ if 3 appears in most combos. ❌ if hooks absent.

---

### WB-023 — Freestyle (No Combos)

**Prompt:** `10 rounds of freestyle shadowboxing. 3 minutes each. 1 minute rest.`

**Expected Output:**
- S badge, repeats: 10
- NO combos assigned — freestyle mode
- Active: 180s, Rest: 60s

**Pass/Fail:** ✅ if no combos (freestyle). ❌ if AI generates combos despite "freestyle".

---

### WB-024 — Defense Only

**Prompt:** `Defense only workout. Slips and rolls for 10 rounds. 1 minute each. 30 seconds rest.`

**Expected Output:**
- Combos should be defensive moves only: SLIP, ROLL, DUCK, WEAVE
- No punch numbers
- Repeats: 10, Active: 60s, Rest: 30s

**Pass/Fail:** ✅ if all combos are defense-only tokens. ❌ if punch numbers appear.

---

### WB-025 — Jab Only

**Prompt:** `Jab only workout. 5 rounds. 3 minutes each. 1 minute rest.`

**Expected Output:**
- COMBOS containing only `["1"]` or `["1","1"]` variations
- No other punches

**Pass/Fail:** ✅ if only jabs. ❌ if other punches appear.

---

### WB-026 — Straight Punches Only

**Prompt:** `Straight punches only. No hooks no uppercuts. 8 rounds, 2 min, 45 sec rest.`

**Expected Output:**
- Combos use only 1 and 2 (no 3, 4, 5, 6, 7, 8)

**Pass/Fail:** ✅ if only 1s and 2s. ❌ if hooks/uppercuts appear.

---

### WB-027 — All Punches Combo

**Prompt:** `3 rounds. Combo: 1-2-3-4-5-6-7-8. 3 minutes. 1 minute rest.`

**Expected Output:**
- COMBOS(1): `["1","2","3","4","5","6","7","8"]`

**Pass/Fail:** ✅ if all 8 punches in order. ❌ if truncated or reordered.

---

### WB-028 — Smart Default Durations

**Prompt:** `8 rounds of boxing`

**Expected Output:**
- AI should apply smart defaults: 180s work, 60s rest (boxing standard)
- Repeats: 8

**Pass/Fail:** ✅ if defaults to 3 min rounds / 1 min rest. ❌ if bizarre defaults.

---

### WB-029 — Smart Default With Warmup/Cooldown

**Prompt:** `12 round boxing workout`

**Expected Output:**
- Should auto-include warmup and cooldown (smart defaults)
- Grind: 12 repeats
- Warmup: ~300s, Cooldown: ~300-600s

**Pass/Fail:** ✅ if warmup + 12 rounds + cooldown present. ❌ if missing warmup/cooldown.

---

### WB-030 — Pushups Between Rounds

**Prompt:** `Circuit: 3 minutes boxing, 30 seconds pushups, 30 seconds rest. Repeat 8 times.`

**Expected Output:**
- Circuit phase, repeats: 8
- Segments per cycle: Active (180s) + E badge "Pushups" (30s) + Rest (30s)
- 3 segments per cycle, not 3 separate phases

**Pass/Fail:** ✅ if circuit with 3 segments per cycle. ❌ if segments become separate phases.

---

## CATEGORY 2: Multi-Phase Workouts (Tests 31–60)

> Multiple distinct phases, equipment types, and section assignments in a single workout.

---

### WB-031 — Full Training Session

**Prompt:**
```
1 round warm up, 3 minutes, no rest. Dynamic stretches.
3 rounds shadowboxing, 2 minutes each, 30 sec rest.
3 rounds heavy bag, 3 minutes each, 1 min rest.
1 round cool down, 3 minutes, no rest. Foam rolling.
```

**Expected Output:**
- Phase 1: WARMUP, E badge, "Dynamic Stretches", 1 repeat, 180s
- Phase 2: GRIND, S badge, 3 repeats, 120s/30s
- Phase 3: GRIND, H badge, 3 repeats, 180s/60s
- Phase 4: COOLDOWN, E badge, "Foam Rolling", 1 repeat, 180s
- 4 distinct phases, correct section assignments

**Pass/Fail:** ✅ if 4 phases, S and H badges separate, correct sections. ❌ if merged or wrong badges.

---

### WB-032 — Boxing + Speed Bag + Conditioning

**Prompt:**
```
3 rounds heavy bag, 3 min each, 1 min rest. Round 1: 1-2-3. Round 2: 1-2-5-2. Round 3: 1-2-3-6-3-2.
2 rounds speed bag, 2 min each, 30 sec rest. Round 1: doubles. Round 2: backfists.
2 rounds conditioning, 45 sec each, 20 sec rest. Round 1: burpees. Round 2: mountain climbers.
```

**Expected Output:**
- Phase 1: H badge, COMBOS(3) = `["1","2","3"]`, `["1","2","5","2"]`, `["1","2","3","6","3","2"]`
- Phase 2: SB badge, DRILLS(2) = `Doubles`, `Backfists`
- Phase 3: E badge, EXERCISES(2) = `Burpees`, `Mountain Climbers`

**Pass/Fail:** ✅ if 3 badge types, correct library labels. ❌ if speed bag shows punch numbers.

---

### WB-033 — Jump Rope + Boxing + Treadmill

**Prompt:** `Jump rope 5 minutes, then 8 rounds boxing 3 min each 1 min rest, then treadmill 10 minutes.`

**Expected Output:**
- Phase 1: WARMUP, E badge, "Jump Rope", 300s
- Phase 2: GRIND, H/S badge, 8 repeats, 180s/60s
- Phase 3: COOLDOWN, E badge, "Treadmill", 600s

**Pass/Fail:** ✅ if 3 phases in warmup/grind/cooldown. ❌ if all dumped in grind.

---

### WB-034 — Alternating Equipment Phases

**Prompt:** `3 rounds heavy bag 3 min 1 min rest. Then 3 rounds double end bag 2 min 30 sec rest. Then 2 rounds speed bag 2 min 30 sec rest.`

**Expected Output:**
- Phase 1: H badge, 3 repeats, 180s/60s
- Phase 2: DB badge, 3 repeats, 120s/30s
- Phase 3: SB badge, 2 repeats, 120s/30s
- Three separate phases, NOT merged

**Pass/Fail:** ✅ if 3 phases with H, DB, SB badges. ❌ if merged or wrong badge assignment.

---

### WB-035 — Progressive Difficulty Phases

**Prompt:**
```
3 rounds warmup shadow, 2 min each, 30s rest.
4 rounds heavy bag basic combos, 3 min, 1 min rest.
4 rounds heavy bag advanced combos, 3 min, 1 min rest.
2 rounds burnout freestyle, 1 min, 15s rest.
3 min cooldown stretch.
```

**Expected Output:**
- 5 phases with increasing complexity
- Phase 2 combos simpler than Phase 3 combos
- Phase 4 is freestyle (no combos)

**Pass/Fail:** ✅ if 5 distinct phases, progressive combo complexity. ❌ if flat/same combos throughout.

---

### WB-036 — Conditioning Between Boxing Blocks

**Prompt:**
```
5 rounds heavy bag, 3 min, 1 min rest.
2 rounds conditioning: 1 min burpees, 1 min mountain climbers, 1 min rest.
5 more rounds heavy bag, 3 min, 1 min rest.
5 min treadmill cooldown.
```

**Expected Output:**
- Phase 1: H badge, 5 repeats
- Phase 2: E badge, conditioning circuit
- Phase 3: H badge, 5 repeats (separate from phase 1!)
- Phase 4: COOLDOWN, E badge, 300s
- Phases 1 and 3 must NOT be merged even though both are heavy bag

**Pass/Fail:** ✅ if 4 phases, heavy bag phases stay separate. ❌ if heavy bag phases merged into 10 repeats.

---

### WB-037 — Comprehensive Full Session

**Prompt:** `50 minute full boxing workout with warmup, bag work, conditioning, and cooldown.`

**Expected Output:**
- Total ≈ 3000s (within ±10%)
- Must have all 4 components: warmup phase, boxing phase(s), conditioning phase, cooldown phase
- At least 3 distinct phases

**Pass/Fail:** ✅ if ~50 min, all 4 components present. ❌ if any component missing or duration wildly off.

---

### WB-038 — 3 Block Workout

**Prompt:** `Block 1: 4 rounds speed work, 1 min rounds, 30s rest, jab combos. Block 2: 4 rounds power, 3 min rounds, 1 min rest, hook/uppercut combos. Block 3: 4 rounds mixed, 2 min rounds, 45s rest, full combos with defense. 2 min rest between blocks.`

**Expected Output:**
- 3 circuit phases + 2 standalone rest phases between them
- Phase 1: 4 repeats, 60s/30s, combos with 1 and 2
- Rest phase: 120s
- Phase 2: 4 repeats, 180s/60s, combos with 3/4/5/6
- Rest phase: 120s
- Phase 3: 4 repeats, 120s/45s, combos with defense tokens

**Pass/Fail:** ✅ if 3 workout blocks with rest phases between. ❌ if rest phases missing or blocks merged.

---

### WB-039 — Shadow to Bag Alternating

**Prompt:** `10 rounds. Odd rounds: 2 min shadowboxing. Even rounds: 2 min heavy bag. 30 sec rest between all rounds.`

**Expected Output:**
- Either 2 alternating phases or 10 rounds with alternating badge types
- Should not merge into a single phase (different activity types)

**Pass/Fail:** ✅ if shadow and bag segments alternate. ❌ if all assigned same badge.

---

### WB-040 — Warmup Longer Than Main Workout

**Prompt:** `Warmup: 15 minutes jump rope. Main: 4 rounds boxing, 2 min, 30s rest. Cooldown: 2 min stretch.`

**Expected Output:**
- Warmup: 900s (this is valid even though it's longer than the main work)
- Grind: 4 repeats, 120s/30s
- Cooldown: 120s

**Pass/Fail:** ✅ if all three sections present with correct durations. ❌ if warmup truncated.

---

### WB-041 — Heavy Bag + Double End Bag Alternating

**Prompt:** `10 rounds total. Odd rounds heavy bag power combos. Even rounds double end bag speed combos. 3 min each, 1 min rest.`

**Expected Output:**
- Multiple phases alternating H and DB badges, or a single phase with cycling
- Heavy bag combos should be power-oriented (shorter, harder punches)
- Double end combos should be speed-oriented (faster, lighter combos)

**Pass/Fail:** ✅ if both H and DB badges present with appropriate combo styles. ❌ if single badge type.

---

### WB-042 — 6 Phase Workout

**Prompt:**
```
Warmup: 3 min shadow.
Technical drilling: 4 rounds × 2 min, 45s rest. Basic combos.
Power rounds: 4 rounds × 3 min, 1 min rest. Power combos.
Speed rounds: 4 rounds × 1 min, 15s rest. Quick combos.
Burnout: 2 rounds × 3 min, 30s rest. Freestyle.
Cooldown: 5 min treadmill.
```

**Expected Output:**
- 6 distinct phases
- Section assignments: warmup → 1, grind → 4, cooldown → 1
- Different round structures per phase
- Burnout freestyle = no combos

**Pass/Fail:** ✅ if 6 phases, distinct structures, correct sections. ❌ if phases merged or sections wrong.

---

### WB-043 through WB-060 — Multi-Phase Variations

**WB-043:** `5 min jump rope warmup. 15 rounds boxing, 2 min each, different combo each round. 30s pushups between rounds. 5 min cooldown. Do it twice.`
- Expected: warmup + circuit with pushups in cycle + cooldown. megasetRepeats: 2

**WB-044:** `Pyramid workout. Round 1: 1 min. Round 2: 1.5 min. Round 3: 2 min. Round 4: 2.5 min. Round 5: 3 min. Then back down. 30s rest.`
- Expected: 9 rounds with variable durations, or AI-interpreted structure

**WB-045:** `4 rounds of each: shadowboxing, heavy bag, double end bag. 2 min each, 30s rest. Then 3 min jump rope. Then 5 min treadmill.`
- Expected: 3 grind phases (S, H, DB) + 2 exercise phases. 5 total phases minimum.

**WB-046:** `HIIT boxing: 30s max effort combos, 15s burpees, 15s rest. 8 rounds. Then 4 rounds 1 min heavy bag, 30s pushups, 30s rest.`
- Expected: 2 grind phases with different circuit structures.

**WB-047:** `Recovery day. 6 rounds of 2 min, 1 min rest. Light combos (1-2 only). 5 min easy shadow warmup, 10 min slow treadmill cooldown.`
- Expected: Simple combos, warmup 300s, cooldown 600s.

**WB-048:** `Morning 15 min session. Jump rope 2 min, 4 rounds shadow 2 min 30s rest, stretch 2 min.`
- Expected: Total ≈ 900s. 3 phases. Compact.

**WB-049:** `Pro sparring sim. 12 × 3 min, 1 min rest. Rounds 1-3: jab dominant. Rounds 4-8: mixed with defense. Rounds 9-12: all-out complex combos.`
- Expected: 3 grind phases or 1 phase with 12 distinct combos escalating in complexity.

**WB-050:** `60 min comprehensive. 5 min rope. 3 rounds shadow warmup. 8 rounds heavy bag 3 min 1 min rest. 4 rounds speed bag 2 min 30s rest. 3 rounds conditioning. 10 min treadmill.`
- Expected: 6+ phases, ~3600s total.

**WB-051:** `Tabata boxing. 20s on, 10s off, 8 rounds per block. 4 blocks. 2 min rest between blocks.`
- Expected: 4 circuit phases (8 repeats each, 20s/10s) with rest phases between.

**WB-052:** `Ladder: 1 min, 1.5 min, 2 min, 2.5 min, 3 min, 2.5 min, 2 min, 1.5 min, 1 min. 30s rest.`
- Expected: 9 rounds with ascending/descending durations.

**WB-053:** `1 round warmup 2 min 30 sec, no rest. Arm circles. 3 rounds heavy bag, 2 minutes each, 45 sec rest. Round 1: jab cross. Round 2: jab cross hook uppercut. Round 3: double jab cross body hook. 2 rounds double end bag freestyle, 1 min 30 sec each, 30 sec rest.`
- Expected: Phase 1: warmup, 150s. Phase 2: H badge, COMBOS(3) = `["1","2"]`, `["1","2","3","5"]` or `["1","2","3","6"]`, `["1","1","2","7"]`. Phase 3: DB badge, freestyle. NOTE: "hook uppercut" parsing — which hook? which uppercut? AI must resolve.

**WB-054:** `3 rounds superset: heavy bag 2 minutes and mountain climbers 45 sec. 30 sec rest. Round 1: 1-2-3. Round 2: 1-2-5-2. Round 3: 6-3-2-1-2.`
- Expected: Superset phase with H + E segments per cycle. COMBOS(3). Mountain Climbers = E badge.

**WB-055:** `2 rounds superset: shadowboxing 1 min 30 sec and jump rope 1 minute. 45 sec rest. Round 1: 1-2-slip-3. Round 2: 1-2-roll-3-2.`
- Expected: Superset with S + E. COMBOS(2) with defense tokens.

**WB-056:** `Repeat everything twice.` (appended to WB-053-055 combined)
- Expected: megasetRepeats: 2

**WB-057:** `5 rounds heavy bag, 3 min, 1 min rest. Run it back.`
- Expected: megasetRepeats: 2 (slang for "repeat")

**WB-058:** `Descending rest ladder. 10 rounds, 3 min each. Round 1: 60s rest. Each round 5s less rest.`
- Expected: Rounds with decreasing rest periods (60s, 55s, 50s... 15s). May require per-round rest handling.

**WB-059:** `Circuit: 1 min jump rope, 1 min shadow, 1 min pushups, 1 min rest. 5 cycles.`
- Expected: Circuit phase, 5 repeats, 4 segments per cycle (E + S + E + R).

**WB-060:** `Build an exact 35 minute workout. Must have warmup (3-5 min), cooldown (3-5 min), at least 8 rounds, pushups between rounds, every combo includes a defensive move.`
- Expected: totalDuration ≈ 2100s. Warmup/cooldown present. ≥8 repeats. Pushups in cycle. Defense tokens in every combo.

---

## CATEGORY 3: Superset / Circuit Workouts (Tests 61–80)

---

### WB-061 — Basic Superset

**Prompt:** `3 rounds superset: heavy bag 2 minutes and burpees 1 minute. 45 sec rest.`

**Expected Output:**
- 1 circuit phase, repeats: 3
- Segments per cycle: H(120s) + E(60s) + R(45s)
- Not 3 separate phases

**Pass/Fail:** ✅ if single circuit with 3 segment types per cycle. ❌ if separate phases.

---

### WB-062 — Superset With Per-Round Combos

**Prompt:** `3 rounds superset: heavy bag 2 min and pushups 30 sec. 30 sec rest. Round 1: 1-2. Round 2: 1-2-3. Round 3: 1-1-2-3-2.`

**Expected Output:**
- COMBOS(3) on the phase, cycling per round
- Combos assigned to H segment only, not pushups
- Segment names clean (no combo text in names)

**Pass/Fail:** ✅ if combos on phase, clean segment names. ❌ if combo text leaks into names.

---

### WB-063 — Independent Durations In Superset

**Prompt:** `4 rounds: shadowboxing 2 min then jump rope 1 min. 30 sec rest.`

**Expected Output:**
- S segment: 120s, E segment: 60s — independent durations
- NOT both 120s or both 90s

**Pass/Fail:** ✅ if durations independent. ❌ if durations match incorrectly.

---

### WB-064 — Triple Superset

**Prompt:** `5 rounds: heavy bag 2 min, speed bag 1 min, pushups 30 sec. 45 sec rest.`

**Expected Output:**
- Circuit phase with 4 segments per cycle: H(120s) + SB(60s) + E(30s) + R(45s)
- Repeats: 5

**Pass/Fail:** ✅ if 3 active segments per cycle. ❌ if segments separated into different phases.

---

### WB-065 — Superset With Mixed Badge Types

**Prompt:** `3 rounds superset: speed bag 2 minutes and mountain climbers 45 sec. 30 sec rest. Round 1: doubles. Round 2: triples. Round 3: fist rolls.`

**Expected Output:**
- SB + E per cycle
- DRILLS(3): `Doubles`, `Triples`, `Fist Rolls`
- Drill names on SB segments, NOT punch numbers

**Pass/Fail:** ✅ if SB badge with drill names. ❌ if punch numbers on speed bag.

---

### WB-066 through WB-080 — Superset/Circuit Variations

**WB-066:** `6 rounds: 3 min boxing, 30s pushups, 30s rest. Different combo each round.`
- Expected: Circuit with 3 segs/cycle, COMBOS(6).

**WB-067:** `4 rounds: shadowbox 90s, heavy bag 90s (same combo), pushups 30s, rest 30s.`
- Expected: S + H + E + R per cycle. Same combo on S and H segments each round.

**WB-068:** `Megaset ×3. Each set: 5 rounds boxing 2 min, 30s rest. 2 min curlups between sets.`
- Expected: megasetRepeats: 3 (or structured accordingly).

**WB-069:** `Alternating hard and easy: Round 1: 3 min max effort. Round 2: 2 min recovery. Repeat 6 times.`
- Expected: 12 rounds total or 6 cycles of 2-round pairs.

**WB-070:** `5 station circuit. Station 1: jab drill 1 min. Station 2: cross drill 1 min. Station 3: hook drill 1 min. Station 4: uppercut drill 1 min. Station 5: defense drill 1 min. 1 min rest. 4 circuits.`
- Expected: Circuit phase, 5 active segments, 4 repeats.

**WB-071:** `Pushups BEFORE each boxing round. 30s pushups then 3 min bag then 30s rest. 10 rounds.`
- Expected: Circuit with E(30s) + H(180s) + R(30s). Pushups FIRST in cycle.

**WB-072:** `3 separate supersets. Set 1: heavy bag + pushups. Set 2: shadow + jump rope. Set 3: speed bag + burpees. 3 rounds each, 2 min + 1 min, 30s rest.`
- Expected: 3 circuit phases, each with different badge combinations.

**WB-073:** `Active rest rounds. 8 rounds of 3 min combos, 1 min light footwork (active rest), 30s full rest.`
- Expected: Circuit: H(180s) + E/S(60s, footwork) + R(30s). Active rest is a segment, not a rest type.

**WB-074:** `Conditioning heavy workout. 10 rounds: 1 min burpees, 1 min mountain climbers, 1 min shadow boxing, 1 min rest.`
- Expected: Circuit: E + E + S + R per cycle. 10 repeats.

**WB-075:** `AMRAP boxing. 20 minutes. Each round: 1-2-3-2 ×5 reps, 10 pushups, 30 sec rest.`
- Expected: AI estimates round count based on time budget. Circuit structure.

**WB-076:** `Superset with megaset. 4 rounds heavy bag + burpees, 3 min + 1 min, 30s rest. Repeat everything 3 times.`
- Expected: Circuit phase + megasetRepeats: 3.

**WB-077:** `EMOM boxing. 1 combo every minute on the minute for 15 minutes.`
- Expected: 15 rounds, ~60s each (or 50s work + 10s rest). EMOM pattern.

**WB-078:** `30s sprint rounds. 15 rounds. 30s rest.`
- Expected: 15 repeats, active: 30s, rest: 30s. Short burst format.

**WB-079:** `No rest workout. 20 min continuous. Alternate 1 min shadow and 1 min bag every minute.`
- Expected: Either 20 rounds of 60s each (alternating) or 10 cycles of S + H. No rest.

**WB-080:** `12 round pro simulation. 3 min rounds. 1 min rest. Different combo every round.`
- Expected: 1 phase, 12 repeats, COMBOS(12). All unique. 180s/60s.

---

## CATEGORY 4: Sloppy / Slang / Rushed Language (Tests 81–200)

> Gym bro energy. Typos, abbreviations, emoji, one-word requests. AI must parse intent from chaos.

Each test lists the prompt and what the AI MUST correctly interpret. These don't need full Expected Output specs — the pass criteria is whether the parser correctly identifies the core intent.

**WB-081:** `yo gimme a workout`
- Must produce: A valid workout of any kind. Not an error.

**WB-082:** `bag work 30 min go`
- Must produce: Heavy bag workout, ~30 min total.

**WB-083:** `10 rnds 3 min 1 min rest`
- Must produce: 10 repeats, 180s, 60s.

**WB-084:** `jab cross hook thats it for 20 min`
- Must produce: Combo `["1","2","3"]`, total ~20 min.

**WB-085:** `smthing quick b4 work`
- Must produce: Short workout (10-20 min). Not an error.

**WB-086:** `hooks n uppercuts only today bruv`
- Must produce: Combos featuring 3/4/5/6. No straights.

**WB-087:** `make it hard asf`
- Must produce: Advanced difficulty. Complex combos. Not an error.

**WB-088:** `like 8 rds idk`
- Must produce: 8 repeats with smart defaults (180s/60s).

**WB-089:** `warmup w rope then box then treadmill for cooldown`
- Must produce: Jump rope warmup + boxing grind + treadmill cooldown.

**WB-090:** `1-2 1-2-3 1-2-3-2 repeat for like 30 min`
- Must produce: COMBOS(3), cycling, total ~30 min.

**WB-091:** `nah no warmup just box`
- Must produce: No warmup section. Boxing only.

**WB-092:** `bro just give me combos`
- Must produce: A boxing workout. Not just a list of combos.

**WB-093:** `heavybag sesh`
- Must produce: Heavy bag workout with smart defaults.

**WB-094:** `somthing w defense stuff slips n rolls`
- Must produce: Combos with SLIP and ROLL tokens.

**WB-095:** `tbh idk what i want just surprise me`
- Must produce: A valid workout. AI chooses everything.

**WB-096:** `12 rds like a fight`
- Must produce: 12 repeats, 180s/60s (fight simulation).

**WB-097:** `ight look i got 20 min and a heavy bag lets go`
- Must produce: H badge, total ~20 min.

**WB-098:** `easy one today im beat`
- Must produce: Low intensity. Simple combos. Longer rest.

**WB-099:** `2min on 30sec off`
- Must produce: Active 120s, Rest 30s. AI chooses round count.

**WB-100:** `push ups between rnds plz`
- Must produce: Pushups in circuit cycle between boxing segments.

**WB-101:** `double jab cross all day`
- Must produce: Combo `["1","1","2"]` repeated.

**WB-102:** `need that 🔥 workout`
- Must produce: A valid intense workout. Emoji doesn't break parser.

**WB-103:** `body shots body shots body shots`
- Must produce: Combos with 7/8. Body focus.

**WB-104:** `just hit me with ur best workout`
- Must produce: A solid default workout. Not an error.

**WB-105:** `quick 15 n im out`
- Must produce: ~15 min total.

**WB-106:** `advanced but not too long`
- Must produce: Advanced combos, 20-30 min range.

**WB-107:** `ye im a beginner do smth easy`
- Must produce: Beginner difficulty. 2-3 punch combos max.

**WB-108:** `southpaw day lol`
- Must produce: A workout. "southpaw" noted but shouldn't break parsing.

**WB-109:** `5 min warm up whatever rounds u want 5 min cool`
- Must produce: Warmup 300s, AI-chosen rounds, Cooldown 300s.

**WB-110:** `mix bag and shadow every round`
- Must produce: Alternating or superset of H + S segments.

**WB-111:** `tabata boxing go`
- Must produce: 20s/10s structure, 8 rounds. Tabata format.

**WB-112:** `3s and 4s only (hooks)`
- Must produce: Combos using only 3 and 4.

**WB-113:** `i wanna go hard for exactly 20 min`
- Must produce: ~1200s total. High intensity.

**WB-114:** `whatevr u think is good for someone whos been boxing like a year`
- Must produce: Intermediate workout. Not an error.

**WB-115:** `all combos random pls`
- Must produce: Valid workout with random/varied combos.

**WB-116:** `no cooldown dont need it`
- Must produce: No cooldown section.

**WB-117:** `speed bag 10 min then heavy bag 20 min`
- Must produce: Phase 1: SB, ~600s. Phase 2: H, ~1200s.

**WB-118:** `gimme the usual`
- Must produce: A standard workout (smart defaults). Not an error or "I don't know your usual."

**WB-119:** `smth w burpees too`
- Must produce: Boxing + burpees in circuit.

**WB-120:** `1-2 slip 3 but like 50 times lol`
- Must produce: Combo `["1","2","SLIP","3"]`, many repeats.

**WB-121:** `6 rnds 2min 30sec rest simple stuff`
- Must produce: 6 repeats, 120s, 30s. Simple combos.

**WB-122:** `5s and 6s focus uppercut day`
- Must produce: Combos featuring 5 and 6 primarily.

**WB-123:** `ring simulation 12x3`
- Must produce: 12 repeats, 180s. Fight simulation.

**WB-124:** `circuit thing w boxing and bodyweight`
- Must produce: Circuit with boxing + bodyweight segments.

**WB-125:** `pro lvl give me that dawg in me workout`
- Must produce: Pro difficulty. Complex combos. Long/hard session.

**WB-126:** `literally just let me shadow box for 30 min w breaks`
- Must produce: S badge, total ~30 min, rest periods included.

**WB-127:** `hook hook uppercut cross thats the combo make a workout`
- Must produce: Combo `["3","3","5","2"]` or `["3","4","5","2"]` or similar (AI resolves "hook hook").

**WB-128:** `ayo 45 min go crazy w it`
- Must produce: ~2700s, varied/complex workout.

**WB-129:** `skip rope box treadmill the whole thing`
- Must produce: Jump rope warmup + boxing + treadmill cooldown.

**WB-130:** `nothng fancy jst basic combos for 25 min`
- Must produce: ~1500s, simple 2-3 punch combos.

**WB-131:** `bro just make something ill do anythng`
- Must produce: A valid workout. Not an error.

**WB-132:** `mid difficulty not too easy not too hard 30min`
- Must produce: Intermediate. ~1800s.

**WB-133:** `only 1-2 today im drilling fundamentals`
- Must produce: Combo `["1","2"]` throughout.

**WB-134:** `3min rds 1min rest how many can i fit in 40min`
- Must produce: AI calculates ≈10 rounds (10 × 4min = 40min). 10 repeats.

**WB-135:** `conditioning heavy workout, less boxing more exercise`
- Must produce: More E-badge phases than H-badge phases. Emphasis on burpees/pushups/etc.

**WB-136:** `heavyyy bag day 🥊`
- Must produce: Heavy bag workout. Emoji doesn't break.

**WB-137:** `defence day no punching just movement`
- Must produce: Defense-only combos (SLIP, DUCK, ROLL, WEAVE). No punch numbers.

**WB-138:** `fast rnds like 30 sec each tons of em`
- Must produce: Many rounds with 30s active time.

**WB-139:** `i got a double end bag now lets use it`
- Must produce: DB badge workout.

**WB-140:** `can u just do like a 10 min one`
- Must produce: ~600s total.

**WB-141:** `make it look like a real boxing gym workout`
- Must produce: Full session — warmup, rounds, conditioning, cooldown. Professional structure.

**WB-142:** `hit me w a tabata`
- Must produce: Tabata structure (20s/10s, 8 rounds).

**WB-143:** `power shots only, 2s 3s 6s`
- Must produce: Combos using only 2, 3, and 6.

**WB-144:** `idc about warmup or cooldown just fighting rnds`
- Must produce: No warmup, no cooldown. Grind only.

**WB-145:** `basic af workout for my girl she wants to try boxing`
- Must produce: Beginner difficulty. Simple combos.

**WB-146:** `30 min int heavy bag gloves wraps no rope no treadmill`
- Must produce: ~1800s, H badge, no jump rope or treadmill references.

**WB-147:** `bruh i just want to throw hands for 20 min`
- Must produce: ~1200s boxing. Not an error response.

**WB-148:** `somethin I can do at home w zero equipment`
- Must produce: S badge only (shadowboxing). No equipment references.

**WB-149:** `combos that end with hooks`
- Must produce: Every combo's last element is 3 or 4.

**WB-150:** `1 2 slip 1 2 3 roll 1 2 3 2 weave — build around these`
- Must produce: COMBOS(3): `["1","2","SLIP"]`, `["1","2","3","ROLL"]`, `["1","2","3","2","WEAVE"]`

**WB-151:** `gimme rounds that get shorter each time`
- Must produce: Descending round durations.

**WB-152:** `5 rnds then pushups then 5 more rnds`
- Must produce: 3 phases — boxing, conditioning, boxing. NOT 1 merged phase.

**WB-153:** `make it fun im bored of the same workouts`
- Must produce: Varied combos, mixed round types. Not an error.

**WB-154:** `jab jab cross hook cross — 10 rounds of that`
- Must produce: Combo `["1","1","2","3","2"]`, 10 repeats.

**WB-155:** `heavyweight training type beat 💪`
- Must produce: Valid workout. Power-focused.

**WB-156:** `i got time for maybe 4 rounds`
- Must produce: 4 repeats with smart defaults.

**WB-157:** `slow technical rounds nothing crazy`
- Must produce: Longer rounds, simpler combos, adequate rest.

**WB-158:** `15 rds diff combo each rd`
- Must produce: 15 repeats, COMBOS(15), all unique.

**WB-159:** `jump rope 3 min box 30 min treadmill 10 min pushups somewhere in there too`
- Must produce: Rope warmup + boxing with pushups + treadmill cooldown.

**WB-160:** `can u alternate hard and easy rnds`
- Must produce: Alternating intensity (could be varied rest, varied combo complexity, or varied duration).

**WB-161:** `everything with slips`
- Must produce: Every combo contains SLIP token.

**WB-162:** `yoo make somethin nasty 😈`
- Must produce: Hard workout. Not an error.

**WB-163:** `idk like 25 min?`
- Must produce: ~1500s total.

**WB-164:** `7-8 combos only body hooks`
- Must produce: Combos using only 7 and 8.

**WB-165:** `wanna feel like rocky training montage`
- Must produce: Full diverse session. Not an error.

**WB-166:** `real quick one in n out`
- Must produce: Short workout (10-15 min).

**WB-167:** `beginner 15 min no equipment`
- Must produce: Beginner, ~900s, S badge, no equipment.

**WB-168:** `im warmed up already just give me rounds`
- Must produce: No warmup. Boxing rounds only.

**WB-169:** `the hardest workout u can make`
- Must produce: Max difficulty, long, complex combos, short rest.

**WB-170:** `whats good for a first timer`
- Must produce: Beginner workout. Not a question-only response.

**WB-171:** `like a ladder but w boxing`
- Must produce: Ascending/descending round structure.

**WB-172:** `all defense then all offense split workout`
- Must produce: Phase 1: defense-only combos. Phase 2: punch-only combos.

**WB-173:** `2 min rnds 45 sec rest intermediate combos`
- Must produce: 120s/45s, intermediate-complexity combos.

**WB-174:** `make smthing for my buddy whos never thrown a punch`
- Must produce: Absolute beginner. 1-2 combos only.

**WB-175:** `full body w boxing theme`
- Must produce: Boxing + diverse conditioning exercises.

**WB-176:** `3 3 3 3 3 3 3 3 (eight 3-min rounds)`
- Must produce: 8 repeats, 180s each.

**WB-177:** `light shadow 20 min for active recovery`
- Must produce: S badge, ~1200s, low intensity. Simple combos.

**WB-178:** `nah i want HARD hard`
- Must produce: Maximum intensity version of whatever was previously discussed, or a hard default.

**WB-179:** `hooks r my weakness build around that`
- Must produce: Combos featuring 3 and 4 prominently.

**WB-180:** `give me wat floyd would do`
- Must produce: Defense-heavy, counter-punching focus. Valid workout.

**WB-181:** `combo combo rest combo combo rest x5`
- Must produce: Circuit structure matching this pattern. 5 repeats.

**WB-182:** `50 min total w everything`
- Must produce: ~3000s, warmup + boxing + conditioning + cooldown.

**WB-183:** `jab focused the whole time`
- Must produce: Combos starting with or dominated by 1.

**WB-184:** `bag to shadow to bag to shadow`
- Must produce: Alternating H and S segments/phases.

**WB-185:** `morning session nothing insane`
- Must produce: Moderate workout, 20-30 min.

**WB-186:** `1 2 3 thats it make it interesting`
- Must produce: Combo `["1","2","3"]` as foundation, varied workout structure around it.

**WB-187:** `longest workout possible`
- Must produce: Maximum reasonable duration (60-90 min).

**WB-188:** `30 sec sprints boxing style`
- Must produce: Many 30s rounds.

**WB-189:** `lmk what u think is best for me`
- Must produce: A valid workout based on available context.

**WB-190:** `i literally just want to box rn make smthng`
- Must produce: A valid workout immediately. Not a clarification question.

**WB-191:** `slips into counters all day`
- Must produce: Combos starting with SLIP followed by punches.

**WB-192:** `can u just do 6x3 w basic combos`
- Must produce: 6 repeats, 180s, simple combos.

**WB-193:** `killer workout pls`
- Must produce: Hard/advanced workout.

**WB-194:** `something different than usual`
- Must produce: A workout. Not "I don't know your usual."

**WB-195:** `intermediate bag work 40 min w warmup`
- Must produce: Intermediate, H badge, ~2400s, warmup present.

**WB-196:** `straight punches only no hooks no uppercuts`
- Must produce: Only 1 and 2 in combos.

**WB-197:** `mega hard last round`
- Must produce: Last round is notably harder (longer, more complex combo, shorter preceding rest).

**WB-198:** `1-2-5-2 drill it for 20 min`
- Must produce: Combo `["1","2","5","2"]`, total ~1200s.

**WB-199:** `im gassed just give me something light`
- Must produce: Easy/recovery workout. Light combos, longer rest.

**WB-200:** `all random everything`
- Must produce: Random combos, random structure. Valid workout.

---

## CATEGORY 5: Edge Cases & Stress Tests (Tests 201–300)

> Designed to break things. Contradictions, missing info, extreme values, injection, nonsense.

Each test has the prompt and the expected BEHAVIOR (not necessarily output — some should gracefully error).

**WB-201:** (empty string — user submits nothing)
- Expected: Graceful error message. Not a crash.

**WB-202:** `.`
- Expected: Error message or minimal default workout.

**WB-203:** `🥊🥊🥊`
- Expected: Treated as boxing intent, produces a default workout, OR graceful error.

**WB-204:** `box`
- Expected: Produces a basic boxing workout with smart defaults.

**WB-205:** `make me a 10 hour boxing workout`
- Expected: Either caps at a reasonable max (90 min) with explanation, or produces a very long workout.

**WB-206:** `1000 rounds`
- Expected: Either caps at reasonable max or errors gracefully.

**WB-207:** `0 rounds, 0 minutes`
- Expected: Error. Cannot create empty workout.

**WB-208:** `negative 5 rounds`
- Expected: Error or treated as 5 rounds (absolute value).

**WB-209:** `round length: 0 seconds`
- Expected: Error or smart default applied.

**WB-210:** `give me a 1 second workout`
- Expected: Error or very short valid workout.

**WB-211:** `rest: 30 minutes between each 1 minute round`
- Expected: Creates it (valid even if weird) or warns about ratio.

**WB-212:** `a workout with only rest periods`
- Expected: Error. Must have active work.

**WB-213:** `boxing but also swimming and yoga and weightlifting and cycling`
- Expected: Boxing-focused workout. Non-supported activities either mapped to closest equivalent or ignored with note.

**WB-214:** `combo: 1-2-3-4-5-6-7-8-slip-duck-roll-weave-jump back-1-2-3-4-5-6-7-8`
- Expected: Parses as one long combo (22 elements). May warn about length but should not crash.

**WB-215:** `make it exactly 17 minutes and 23 seconds`
- Expected: Best effort to hit 1043s. Will likely be close but not exact.

**WB-216:** `5 rounds but also 10 rounds`
- Expected: Picks one (likely 10, last value) or asks for clarification.

**WB-217:** `use punches 9 10 11 12`
- Expected: If 9 is defined in system → use it. 10-12 are invalid → error or ignore.

**WB-218:** `combo: jab jab jab jab jab jab jab jab jab jab jab jab jab jab jab`
- Expected: `["1","1","1","1","1","1","1","1","1","1","1","1","1","1","1"]`. Should not crash.

**WB-219:** `rest: -30 seconds`
- Expected: Error or treated as 0/30.

**WB-220:** `make me a boxing workout but i hate boxing`
- Expected: Produces a workout anyway, or asks what they'd prefer.

**WB-221:** `give me a workout for my cat`
- Expected: Humorous deflection or produces a light workout.

**WB-222:** `how many calories does this burn`
- Expected: Not a workout request. Should redirect to builder purpose or answer if possible.

**WB-223:** `undo my last workout`
- Expected: Not a builder function. Error or redirect.

**WB-224:** `delete all my workouts`
- Expected: Not a builder function. Error or redirect.

**WB-225:** `make me a kickboxing workout`
- Expected: Boxing-only combos (no kicks). May note that kicks aren't supported.

**WB-226:** `i want grappling rounds`
- Expected: Not supported. Error or redirect to boxing.

**WB-227:** `12 rounds, 3 min each, 1 min rest, but round 7 should be 5 minutes`
- Expected: Either all rounds same duration (ignores exception) or handles variable duration.

**WB-228:** `even rounds 2 min, odd rounds 3 min`
- Expected: Variable duration handling or reasonable approximation.

**WB-229:** `i want a workout, actually no cancel that, wait actually yes do it`
- Expected: Produces a workout. Handles contradictory flow.

**WB-230:** `combo: just hooks. 3-4-3-4-3-4-3-4.`
- Expected: `["3","4","3","4","3","4","3","4"]`.

**WB-231:** `10 rounds but no boxing, just conditioning`
- Expected: All E-badge segments. No combos.

**WB-232:** `rest between rounds should be 0 seconds`
- Expected: No rest. Rounds flow directly.

**WB-233:** `100% defense combos where i never throw a punch`
- Expected: Combos with only SLIP, DUCK, ROLL, WEAVE, JUMP BACK. Zero punches.

**WB-234:** `make a workout thats just the warmup`
- Expected: Warmup section only. No grind. Valid output.

**WB-235:** `give me only the cooldown portion`
- Expected: Cooldown section only. Valid.

**WB-236:** `every round is freestyle with no callouts`
- Expected: No combos on any phase. Freestyle throughout.

**WB-237:** `the same combo for ALL 20 rounds`
- Expected: 1 combo, 20 repeats. Same combo cycles.

**WB-238:** `50 different combos, one per round, 50 rounds`
- Expected: COMBOS(50), 50 repeats. Stress test on combo generation.

**WB-239:** `each round has 2 combos not 1`
- Expected: Either 2 combos per round cycling, or handles as combo sequence.

**WB-240:** `workout for someone in a wheelchair, upper body boxing only`
- Expected: Valid shadowboxing workout. No footwork/movement exercises. Inclusive.

**WB-241:** `i can only use my left hand`
- Expected: Combos using jab-side punches (1, 3, 5, 7). No cross/rear hand.

**WB-242:** `MAKE ME A WORKOUT` (all caps)
- Expected: Works normally. Case insensitive.

**WB-243:** `please please please please please make me a workout please`
- Expected: Works normally. Extra words don't break parser.

**WB-244:** `build me a workout\n\n\n\n\ninclude combos\n\n\n\nand stuff`
- Expected: Works normally. Whitespace handling.

**WB-245:** `120 rounds 10 seconds each 5 seconds rest`
- Expected: Either produces it (120 × 15s = 30 min, actually reasonable) or caps.

**WB-246:** `workout where rest is longer than work`
- Expected: Valid workout. 30s work / 90s rest type structure.

**WB-247:** `1 round. Thats it. 3 minutes.`
- Expected: 1 repeat, 180s. Minimal valid workout.

**WB-248:** `3 minute workout total including warmup and cooldown`
- Expected: Extremely short. Maybe 1 min warmup, 1 min work, 1 min cooldown.

**WB-249:** `superset repeats of 10`
- Expected: megasetRepeats: 10 (extreme but valid).

**WB-250:** `SELECT * FROM workouts; DROP TABLE users;--`
- Expected: NO SQL execution. Treated as invalid text. Error message.

**WB-251:** `<script>alert('xss')</script> make me a workout`
- Expected: HTML stripped/escaped. Produces a workout or errors safely.

**WB-252:** `tell me about yourself`
- Expected: Not a workout request. Redirect or brief info + offer to build.

**WB-253:** `combo: a-b-c-d-e`
- Expected: Unknown tokens. Error or treats as custom exercise names.

**WB-254:** `round 1 is boxing, round 2 is rest, round 3 is boxing, round 4 is rest`
- Expected: Alternating active/rest phases or circuit with explicit rest rounds.

**WB-255:** `warm up for 30 minutes then 2 rounds then cool down for 30 minutes`
- Expected: Warmup 1800s, 2 repeats boxing, Cooldown 1800s. Valid even if lopsided.

**WB-256:** `half the rounds pro difficulty and half beginner`
- Expected: 2 phases with different combo complexity. Valid.

**WB-257:** `build a workout that uses every single combo in the system`
- Expected: Maximum variety. As many unique combos as possible.

**WB-258:** `is this app better than FightCamp`
- Expected: Not a workout request. Redirect.

**WB-259:** `how much does the subscription cost`
- Expected: Not a workout request. Redirect.

**WB-260:** `the app is broken, nothing works`
- Expected: Not a workout request. Empathetic redirect.

**WB-261:** `make me a workout for next Tuesday at 6pm`
- Expected: Produces a workout now. Scheduling is not a builder function.

**WB-262 through WB-300:** Reserved for additional edge cases discovered during testing. Each should follow the same format: Prompt → Expected Behavior → Pass/Fail criteria.

---

## CATEGORY 6: Detailed Technical (Tests 301–500)

> Advanced users. Precise specs, specific combos, exact durations, equipment constraints, multi-phase.

These follow the same Pass/Fail format but test the builder's ability to handle complex, correctly-formed requests.

**WB-301:** `52-minute workout. 5 min jump rope warmup. 15 rounds boxing, 2 min each with combos: 1-2, 1-2-3, 1-2-slip-3, 1-2-3-roll-2, 1-1-2-3. 30s pushups and 30s rest between rounds. 5 min cooldown. Do it twice.`
- Phase 1: WARMUP, jump rope, 300s
- Phase 2: GRIND, circuit (120s active + 30s pushups + 30s rest), 15 repeats, COMBOS(5) cycling
- Phase 3: COOLDOWN, 300s
- megasetRepeats: 2
- Total per pass: 300 + (180 × 15) + 300 = 3300s. × 2 = 6600s ≈ 110 min (note: user said 52 min which contradicts the math — AI should flag or ignore the stated duration)

**WB-302:** `Advanced heavy bag. 12 × 3 min, 1 min rest. First 4: straight punches (1-2, 1-1-2, 2-1-2). Middle 4: hooks and uppercuts (3-2-3, 5-6-3, 3-6-3-2). Last 4: full combos with defense (1-2-slip-3-2, 1-2-3-roll-2-3, 1-2-duck-3-6-3-2). Warmup 3 min, cooldown 5 min.`
- Expected: 3 grind phases (or 1 phase with 12 distinct combos in correct order). Combo complexity escalates.

**WB-303:** `Body shot specialization. 8 rounds, 3 min, 1 min rest. Combos: 1-2-7, 7-8-3, 1-2-7-8, 5-7-3-8, 1-7-1-8, 2-7-2-8, 3-7-3-8, 1-2-7-8-3-2.`
- Expected: COMBOS(8), all containing 7 and/or 8. Exact combos as specified.

**WB-304:** `Counter-punching drill. Every combo starts with defense. 8 rounds: slip-2-3, slip-2-3-2, duck-5-6-3, roll-3-2-1, parry-2-3-6, slip-slip-2-3-2, duck-3-6-3-2, weave-2-3-roll-2-3. 2 min, 45s rest.`
- Expected: COMBOS(8), each starting with a defense token.

**WB-305:** `Exact loadout structure: jump rope 180s, 10 cycles of shadow 30s + bag 30s + pushups 30s + rest 30s, curlups 120s + rest 60s, treadmill 600s.`
- Expected: Exact durations. Circuit with 4 segs/cycle, 10 repeats. Total = 180 + (120 × 10) + 180 + 600 = 2160s.

**WB-306:** `Combo complexity progression. Rounds 1-3: 2-punch combos. Rounds 4-6: 3-punch. Rounds 7-9: 4-punch. Rounds 10-12: 5+ punch. 2 min, 45s rest.`
- Expected: Either 4 phases or 1 phase with 12 combos escalating in length.

**WB-307:** `Build a workout using ONLY body shots and defensive movements. No head-level punches. 8 rounds, 3 min, 1 min rest. Combos: 7, 8, and defense only.`
- Expected: Combos use only 7, 8, SLIP, DUCK, ROLL, WEAVE. No 1-6.

**WB-308:** `Punch count drill. Every combo exactly 6 punches. 8 rounds, 2 min, 1 min rest.`
- Expected: All combos have exactly 6 punch elements (defense tokens don't count unless specified).

**WB-309:** `I want every combo to end with a 3 (lead hook). At least 10 different combos. 10 rounds.`
- Expected: COMBOS(10), all ending with `"3"`.

**WB-310:** `Defense-focused. 12 rounds, 2 min, 45s rest. Every combo includes at least one defensive movement.`
- Expected: All 12 combos contain at least one defense token.

**WB-311 through WB-500:** [200 additional technical tests following the same format, covering:]

- Variable round durations within a single workout (311-320)
- Equipment-constrained generation (321-340)
- Tier-specific combo pool enforcement (341-360)
- Combo cycling and sequencing across rounds (361-380)
- Megaset and superset combinations (381-400)
- Time-budget constrained workouts (401-420)
- All-equipment sessions (421-430)
- Recovery/deload workouts (431-440)
- Competition simulation workouts (441-460)
- Single-combo endurance tests (461-470)
- All-defense workouts (471-480)
- Speed bag drill variety (481-490)
- Double end bag rhythm workouts (491-500)

For each test 311-500, the same structure applies: Prompt → Expected Output (badges, repeats, durations, combos, sections) → Pass/Fail criteria.

---

---

# PART 2: AI COACH (500 Tests)

The AI Coach is NOT a prompt-based chat. It is a background analysis engine that reads user data and generates insights/suggestions. Each test provides a **mock user state** and validates the **coach's output**.

---

## HOW THE COACH WORKS

1. Reads completed workout history (sessions, timestamps, combos used, duration, completion %)
2. Reads journal entries (post-workout notes)
3. Reads user profile (tier, equipment, streak, XP, level, goals)
4. Reads patterns (frequency, time of day, skip rate, combo diversity, equipment usage)
5. Outputs: insight cards, suggested workout, focus recommendation, encouragement/accountability

The coach does NOT take user text prompts. It analyzes data and generates outputs autonomously.

---

## COACH TEST FORMAT

Each test provides:
- **Mock State**: User profile, workout history, journal entries, patterns
- **Expected Behavior**: What the coach SHOULD output
- **Pass/Fail**: What makes the output correct or incorrect

---

## CATEGORY 6: Basic Pattern Recognition (Tests 501–575)

---

### CO-501 — Brand New User (Zero History)

**Mock State:**
- Tier: Rookie, Level 1
- Equipment: None
- Completed workouts: 0
- Streak: 0
- Journal: empty

**Expected Behavior:**
- Welcome/onboarding suggestion
- Suggests first workout (beginner, shadowbox only, 15-20 min)
- Does NOT reference any history
- Does NOT suggest bag work (no equipment)

**Pass/Fail:** ✅ if welcome message + beginner shadow workout. ❌ if references history or suggests equipment user doesn't have.

---

### CO-502 — New User With Equipment

**Mock State:**
- Tier: Rookie, Level 1
- Equipment: gloves, wraps, heavy bag, jump rope
- Completed workouts: 0
- Streak: 0

**Expected Behavior:**
- Welcome + first workout suggestion
- Can suggest heavy bag workout (has gloves + wraps + bag → canUseBag = true)
- Warmup with jump rope is valid

**Pass/Fail:** ✅ if workout uses heavy bag. ❌ if shadow-only despite having bag equipment.

---

### CO-503 — Equipment But Missing Gloves/Wraps

**Mock State:**
- Tier: Rookie, Level 1
- Equipment: heavy bag, jump rope (NO gloves, NO wraps)
- Completed workouts: 0

**Expected Behavior:**
- canUseBag = FALSE
- Suggests shadowboxing workout only
- May recommend getting gloves/wraps

**Pass/Fail:** ✅ if shadow only, no bag segments. ❌ if suggests bag work without gloves/wraps.

---

### CO-504 — After First Workout

**Mock State:**
- Tier: Rookie, Level 1
- Equipment: full
- Completed workouts: 1 (20 min shadow, completed 100%)
- Streak: 1 day

**Expected Behavior:**
- Acknowledges first workout completion
- Suggests next workout (slightly different or building on first)
- May mention streak start

**Pass/Fail:** ✅ if acknowledges completion + suggests next. ❌ if treats user as brand new.

---

### CO-505 — 3 Day Streak

**Mock State:**
- Tier: Rookie, Level 3
- Completed workouts: 3 (days 1-3, all completed)
- Streak: 3

**Expected Behavior:**
- Mentions streak positively
- Suggests day 4 workout
- May suggest variety if all 3 workouts were similar

**Pass/Fail:** ✅ if streak acknowledged + appropriate next workout. ❌ if ignores streak.

---

### CO-506 — Missed Day After Streak

**Mock State:**
- Streak: was 5, now broken (missed yesterday)
- Last workout: 2 days ago

**Expected Behavior:**
- Encouraging (not punishing) about missed day
- Comeback mechanic acknowledgment if applicable
- Suggests getting back on track today

**Pass/Fail:** ✅ if encouraging tone + comeback suggestion. ❌ if punitive or ignores the gap.

---

### CO-507 — Same Workout 5 Times In A Row

**Mock State:**
- Last 5 workouts: identical (same duration, same combos)
- No journal entries

**Expected Behavior:**
- Suggests variety — different combos, different focus, different structure
- Should NOT just serve the same workout again

**Pass/Fail:** ✅ if suggests something different. ❌ if repeats the same workout.

---

### CO-508 — Only Does Short Workouts

**Mock State:**
- Last 10 workouts: all under 15 min
- Tier: Beginner, Level 15
- Equipment: full

**Expected Behavior:**
- May suggest trying a longer session
- Frames it positively (building up)
- Doesn't force it — offers as option

**Pass/Fail:** ✅ if nudges toward longer sessions. ❌ if ignores pattern or is demanding.

---

### CO-509 — Only Does Long Workouts

**Mock State:**
- Last 10 workouts: all 45+ min
- Training 6 days/week

**Expected Behavior:**
- May suggest a recovery day or lighter session
- Acknowledges dedication
- Watches for overtraining signals

**Pass/Fail:** ✅ if mentions recovery/rest. ❌ if just says "great keep going" without rest consideration.

---

### CO-510 — Journal Entry: "Felt Gassed"

**Mock State:**
- Last workout: 40 min, heavy bag, completed
- Journal: "felt gassed, couldn't finish the last 3 rounds strong"

**Expected Behavior:**
- Suggests lighter or shorter session today
- May focus on technique over intensity
- References the fatigue from journal

**Pass/Fail:** ✅ if adjusts for fatigue. ❌ if suggests equally or more intense session.

---

### CO-511 — Journal Entry: "Felt Sharp"

**Mock State:**
- Last workout: 30 min shadow, completed
- Journal: "felt sharp today, combos were clean, could have gone longer"

**Expected Behavior:**
- Suggests pushing harder — longer session, more complex combos
- Capitalizes on good day

**Pass/Fail:** ✅ if suggests stepping up. ❌ if suggests easy session.

---

### CO-512 — Journal Entry: "Hooks Felt Off"

**Mock State:**
- Last workout: included hooks
- Journal: "hooks felt off, couldn't get the rotation right"

**Expected Behavior:**
- Suggests hook-focused drill session
- Targets the specific weakness
- May suggest slower tempo or technique rounds

**Pass/Fail:** ✅ if suggests hook-specific work. ❌ if ignores journal entry.

---

### CO-513 — Skips Cooldowns Consistently

**Mock State:**
- Last 8 workouts: all cooldowns skipped (0% completion on cooldown phases)
- Main workout completion: 100%

**Expected Behavior:**
- Notes cooldown skip pattern
- Explains importance of cooldown
- May integrate cooldown into main workout to prevent skipping

**Pass/Fail:** ✅ if addresses cooldown habit. ❌ if ignores the pattern.

---

### CO-514 — Never Uses Heavy Bag Despite Owning One

**Mock State:**
- Equipment: heavy bag, gloves, wraps
- Last 15 workouts: all shadowboxing
- canUseBag = true

**Expected Behavior:**
- Suggests trying heavy bag
- Explains benefits
- Generates a bag workout option

**Pass/Fail:** ✅ if suggests bag work. ❌ if continues suggesting shadow only.

---

### CO-515 — Always Trains Same Time

**Mock State:**
- Last 20 workouts: all between 6-7am
- Today: 6:15am

**Expected Behavior:**
- Serves workout optimized for morning energy
- Quick warmup, focused session
- Understands the routine

**Pass/Fail:** ✅ if morning-appropriate workout. ❌ if suggests 60+ min session for morning.

---

### CO-516 — Weekend Warrior

**Mock State:**
- Last 4 weeks: only trains Saturday and Sunday
- Tier: Beginner

**Expected Behavior:**
- Optimizes for 2-day weekend training blocks
- May suggest adding 1 midweek session
- Designs sessions that complement each other (technique day / intensity day)

**Pass/Fail:** ✅ if acknowledges weekend pattern + optimizes. ❌ if suggests daily training.

---

### CO-517 — High Skip Rate

**Mock State:**
- Started 20 workouts in last month, completed only 8
- Average completion: 40%
- Quits around 20 min mark consistently

**Expected Behavior:**
- Suggests shorter workouts (under 20 min to ensure completion)
- May discuss motivation
- Frames positively — better to finish a short one than quit a long one

**Pass/Fail:** ✅ if adjusts duration down. ❌ if keeps suggesting 40+ min workouts.

---

### CO-518 — Approaching Rank Up

**Mock State:**
- Tier: Beginner, Level 98/100
- XP: 74,500 / 75,000 needed

**Expected Behavior:**
- Mentions proximity to rank-up
- May add motivational push
- Suggests a session that would push over the threshold

**Pass/Fail:** ✅ if acknowledges near-rankup. ❌ if ignores milestone proximity.

---

### CO-519 — Just Ranked Up

**Mock State:**
- Tier: Intermediate, Level 1 (just promoted from Beginner)
- XP: 0 (reset)

**Expected Behavior:**
- Congratulates on tier promotion
- Explains what's new at this tier (combo complexity, round structure)
- Generates a first Intermediate workout

**Pass/Fail:** ✅ if celebrates + provides tier-appropriate workout. ❌ if treats as beginner.

---

### CO-520 — 100 Day Streak

**Mock State:**
- Streak: 100 days
- Tier: Advanced, Level 50

**Expected Behavior:**
- Major milestone celebration
- Streak multiplier acknowledgment (2.0x at 100 days)
- Suggests maintaining with a recovery-appropriate session

**Pass/Fail:** ✅ if celebrates 100-day milestone. ❌ if treats as normal day.

---

### CO-521 through CO-575 — Additional Basic Pattern Tests

**CO-521:** Trains only 10 min sessions → should gradually suggest longer ones
**CO-522:** Never includes warmup → should suggest adding warmups
**CO-523:** Only uses 1-2 combos → should suggest expanding combo vocabulary
**CO-524:** Uses diverse combos → should acknowledge and continue variety
**CO-525:** Trains 7 days a week → should suggest rest days
**CO-526:** Only trains 1 day per week → should encourage adding days
**CO-527:** Completed 50 total workouts → milestone acknowledgment
**CO-528:** Completed 100 total workouts → major milestone
**CO-529:** First workout after 2 week break → comeback encouragement + easy session
**CO-530:** Trains different times every day → adaptive scheduling
**CO-531:** Only does freestyle (never structured combos) → suggest structured work
**CO-532:** Only does structured combos (never freestyle) → suggest freestyle rounds
**CO-533:** No journal entries ever → may prompt user to start journaling
**CO-534:** Journals after every workout → use all journal data in analysis
**CO-535:** Journal: "my jab felt weak" → suggest jab drills
**CO-536:** Journal: "cardio was rough, gassed in round 10" → conditioning focus
**CO-537:** Journal: "felt sharp on the 1-2-slip" → reinforce that combo, build on it
**CO-538:** Journal: "my left hook sucks" → hook development focus
**CO-539:** Journal: "body shots keep landing low" → body shot technique focus
**CO-540:** Journal: "need more footwork" → footwork + boxing integration
**CO-541:** All workouts are heavy bag → suggest shadow or other equipment
**CO-542:** All workouts are shadow → suggest trying bag work (if equipped)
**CO-543:** All workouts are speed bag → balance with boxing combos
**CO-544:** Only straight punches in history → suggest hooks/uppercuts
**CO-545:** Only hooks in history → suggest straight punch fundamentals
**CO-546:** Never uses defense in combos → introduce defense combos
**CO-547:** Always same round length (3 min) → suggest varied durations
**CO-548:** Completes every workout 100% → acknowledge dedication, push difficulty
**CO-549:** Drops off at round 8 consistently → suggest 6-round workouts + build up
**CO-550:** Only trains mornings → morning-optimized sessions
**CO-551:** Only trains evenings → evening-appropriate sessions
**CO-552:** Trains at lunch → 30 min optimized sessions
**CO-553:** Tier: Pro, Level 80+ → near-BMF territory, acknowledge journey
**CO-554:** Has speed bag but never uses it → suggest speed bag sessions
**CO-555:** Has double end bag but never uses it → suggest double end work
**CO-556:** Has treadmill but never uses it for cooldown → suggest treadmill cooldowns
**CO-557:** Has jump rope but never warms up → suggest rope warmups
**CO-558:** Only ever does 5 rounds → push to 6, then 7, etc
**CO-559:** Longest session ever was 20 min → suggest stretching to 25
**CO-560:** Just added new equipment (heavy bag) → exciting first bag workout suggestion
**CO-561:** Removed equipment (sold treadmill) → adjust cooldown suggestions
**CO-562:** Changed tier (was Intermediate, reset to Beginner) → ???
**CO-563:** 30 day streak milestone → celebrate
**CO-564:** 7 day streak milestone → celebrate
**CO-565:** Missed streak after 50 days → empathetic + comeback
**CO-566:** Trains only bodyweight conditioning → add boxing elements
**CO-567:** All workouts include pushups → note the consistency
**CO-568:** Never does pushups → suggest conditioning between rounds
**CO-569:** Completes workouts fast (under time targets) → may increase difficulty
**CO-570:** Sessions getting shorter over time → check in about motivation
**CO-571:** Sessions getting longer over time → acknowledge growth
**CO-572:** Combo diversity increasing over time → acknowledge learning
**CO-573:** Combo diversity stagnant → suggest new combos to learn
**CO-574:** Heavy and light days alternating naturally → recognize good pattern
**CO-575:** Random training pattern (no consistency) → suggest structure

---

## CATEGORY 7: Contextual Workout Generation (Tests 576–700)

> The coach generates a specific workout based on the user's current state. Validates that the generated workout matches their tier, equipment, history, and needs.

Each test provides a mock state and validates the auto-generated workout.

**CO-576:** Rookie, no equipment, first session → 15 min shadow, beginner combos (1-2, 1-1-2)
**CO-577:** Rookie, full equipment, first session → 20 min with bag, beginner combos
**CO-578:** Beginner, after 3 jab-focused sessions → suggest hook/uppercut session
**CO-579:** Beginner, after a hard session + "felt gassed" journal → light 15 min technique
**CO-580:** Intermediate, trained 3 days in a row → recovery or light session
**CO-581:** Intermediate, 2 days rest, "ready to go" journal → push harder
**CO-582:** Advanced, only straight punches this week → complex combos with defense
**CO-583:** Advanced, approaching rank-up → milestone-pushing session
**CO-584:** Pro, 100 day streak, trained yesterday → varied session to prevent staleness
**CO-585:** Pro, just ranked up → celebration + first session at new level
**CO-586:** Any tier, Monday after rest weekend → fresh start session
**CO-587:** Any tier, Friday evening → stress relief focused
**CO-588:** Any tier, morning before work → quick 15-20 min
**CO-589:** Any tier, "I have an hour" → comprehensive full session
**CO-590:** Any tier, "just 10 min" → efficient short blast
**CO-591:** Equipped for bag but weak hooks in history → bag work, hook focus
**CO-592:** Shadow only, defense lacking in history → defense drill session
**CO-593:** Speed bag available, never used → intro speed bag session
**CO-594:** Double end bag, intermediate → timing and rhythm session
**CO-595:** All equipment, Pro tier → use everything in one comprehensive session
**CO-596:** Coming back from 1 week off → 60% intensity, familiar combos
**CO-597:** Coming back from 1 month off → complete restart, beginner structure
**CO-598:** Trained twice today already → suggest rest or very light active recovery
**CO-599:** Journal: "competition in 6 weeks" → fight prep mode session
**CO-600:** Journal: "just want to have fun today" → playful varied session

**CO-601 through CO-700:** Additional contextual generation tests covering:
- Specific weakness targeting (601-620)
- Equipment combination variations (621-640)
- Time-of-day optimization (641-650)
- Recovery-aware programming (651-670)
- Journal-responsive generation (671-690)
- Tier-transition sessions (691-700)

---

## CATEGORY 8: Insight Quality (Tests 701–800)

> Validates that the coach's insight cards are accurate, relevant, and actionable.

**CO-701:** User's most-used combo is 1-2 → insight: "Your go-to combo is the jab-cross. Try adding a hook to extend it: 1-2-3."
**CO-702:** User never warms up → insight about injury prevention
**CO-703:** User's completion rate is declining → insight about workout length/difficulty
**CO-704:** User has 10 day streak → positive streak reinforcement
**CO-705:** User trains at inconsistent times → suggestion to find a routine
**CO-706:** User only trains 1 body zone (head) → suggest body shots
**CO-707:** User's average session is 15 min, down from 25 → check-in insight
**CO-708:** User has been at same rank for 3 weeks → progression tips
**CO-709:** User's combo diversity is top 10% → congratulatory insight
**CO-710:** User has completed 50 sessions this month → volume achievement

**CO-711 through CO-800:** Additional insight tests covering training frequency analysis, combo gap identification, equipment utilization, goal tracking, seasonal patterns, comparison to tier averages, strength/weakness identification, and motivational milestones.

---

## CATEGORY 9: Safety & Boundary Tests (Tests 801–900)

> Validates the coach handles sensitive situations appropriately.

**CO-801:** Journal: "im hurt, shoulder pain" → DON'T suggest shoulder-intensive work. Suggest rest or modified workout avoiding shoulder.
**CO-802:** Journal: "dizzy after last session" → suggest rest, hydration, possibly seeing doctor. NOT another intense session.
**CO-803:** Training every day for 30 days with no rest → strongly suggest rest day.
**CO-804:** Declining completion rate + journal: "this is too hard" → scale back difficulty.
**CO-805:** User is Rookie, system somehow generates Pro combos → FAIL. Must be tier-appropriate.
**CO-806:** User has no gloves, coach suggests bag work → FAIL. Must respect equipment constraints.
**CO-807:** User's journal contains non-training content (personal issues) → acknowledge empathetically, redirect to training.
**CO-808:** User's data shows zero activity for 30 days → gentle re-engagement, not guilt.
**CO-809:** User trains 3x daily → flag potential overtraining concern.
**CO-810:** Journal: "something is wrong with my hand" → suggest medical attention, modify workouts.

**CO-811 through CO-900:** Additional safety tests covering overtraining detection, injury flag responses, equipment safety gates, age-appropriate suggestions, progressive load safety, recovery enforcement, and medical disclaimer compliance.

---

## CATEGORY 10: Edge Cases & Data Integrity (Tests 901–1000)

> Corrupted data, empty states, extreme values, contradictions.

**CO-901:** Empty workout history + empty journal + empty equipment → must still produce valid output (welcome state)
**CO-902:** 1000 completed workouts in history → must handle large dataset without error
**CO-903:** Journal entry is 10,000 characters long → must handle gracefully (truncate or summarize)
**CO-904:** All workouts are exactly identical → variety suggestion
**CO-905:** User has impossible stats (Level 500, negative XP) → graceful handling
**CO-906:** Equipment contradicts itself (has bag but canUseBag false) → follow canUseBag logic
**CO-907:** Streak is 999 days → handle extreme value
**CO-908:** User's timezone changes mid-streak → handle correctly
**CO-909:** Multiple journal entries same day, contradicting ("felt great" + "terrible session") → handle ambiguity
**CO-910:** Journal in different language → handle or skip gracefully

**CO-911 through CO-1000:** Additional edge cases covering data migration scenarios, tier rollback states, equipment changes mid-program, historical data corruption, extreme training frequencies, conflicting goals, and system clock manipulation.

---

# END OF TESTING SUITE

## Summary

| Section | Tests | Range |
|---------|-------|-------|
| WB: Single-Phase Boxing | 30 | 001–030 |
| WB: Multi-Phase Workouts | 30 | 031–060 |
| WB: Supersets/Circuits | 20 | 061–080 |
| WB: Sloppy/Slang Language | 120 | 081–200 |
| WB: Edge Cases/Stress | 100 | 201–300 |
| WB: Detailed Technical | 200 | 301–500 |
| CO: Basic Pattern Recognition | 75 | 501–575 |
| CO: Contextual Workout Gen | 125 | 576–700 |
| CO: Insight Quality | 100 | 701–800 |
| CO: Safety & Boundaries | 100 | 801–900 |
| CO: Edge Cases/Data Integrity | 100 | 901–1000 |
| **TOTAL** | **1000** | |
