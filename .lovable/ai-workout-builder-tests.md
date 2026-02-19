# KOI AI Workout Builder — Test Suite v1.0

## How to Use This Document

Each test has:
- **Prompt**: Exactly what to type into the AI Builder modal
- **User Context**: Tier/equipment to set before testing (if relevant)
- **Expected Output**: What the generated workout MUST look like in the Build page
- **Timer Check**: Key things to verify if you tap Play and run through the timer
- **Pass/Fail Criteria**: Binary — it either matches or it doesn't

Tests are grouped into categories. Run them in order — earlier categories test fundamentals, later ones test edge cases that depend on fundamentals working.

---

## CATEGORY 1: Single-Phase Boxing (The Foundation)

These are the simplest possible prompts. If these break, nothing else will work.

---

### Test 1.1 — Basic Heavy Bag with Explicit Parameters

**Prompt**: `5 rounds heavy bag, 3 min rounds, 1 min rest`

**User Context**: Intermediate tier, has gloves + wraps + heavy bag

**Expected Output**:
- Workout name: Something boxing-related (e.g. "Heavy Bag Blast", "Heavy Bag Session")
- Difficulty: intermediate
- **WARMUP section**: 1 phase, contains warmup activities (jump rope, shadow boxing, etc.)
- **ROUNDS section**: 1 grind phase
  - Phase repeats: **5**
  - Active segment: **H badge** (segmentType: combo), duration **3:00** (180s)
  - Rest segment: **R badge**, duration **1:00** (60s)
  - COMBOS: Should have **5 combos** (one per round), using punches 1-6 only (intermediate tier)
  - Combo Order: sequential
- **COOLDOWN section**: 1 phase with light shadow + stretch or similar

**Timer Check**: Play → should cycle through 5 rounds of 3:00 work + 1:00 rest, displaying a different combo each round.

**Pass/Fail**: ✅ if H badge, 5 repeats, 180s/60s durations, 5 combos, warmup + cooldown present. ❌ if any of these are wrong.

---

### Test 1.2 — Shadowboxing Only

**Prompt**: `3 rounds shadowboxing, 2 minutes each, 30 sec rest`

**User Context**: Beginner tier, NO equipment

**Expected Output**:
- **ROUNDS section**: 1 grind phase
  - Active segment: **S badge** (segmentType: shadowboxing), duration **2:00** (120s)
  - Rest segment: duration **0:30** (30s)
  - Phase repeats: **3**
  - COMBOS: 3 combos, using punches 1-4 only (beginner tier — no 5/6/7/8, no defense)
- Warmup should NOT contain jump rope (no equipment) — should use High Knees or similar

**Pass/Fail**: ✅ if S badge (not H or E), 3 repeats, 120s/30s, beginner-appropriate combos. ❌ if heavy bag badge appears despite no equipment, or if combos contain advanced punches.

---

### Test 1.3 — Heavy Bag with User-Specified Combos

**Prompt**: `4 rounds heavy bag, 2 min rounds, 45 sec rest. Round 1: 1-2. Round 2: 1-2-3. Round 3: 1-2-slip-3. Round 4: 1-1-2-3-6-3-2.`

**Expected Output**:
- Phase repeats: **4**
- Active segment: **H badge**, duration **2:00** (120s)
- Rest segment: duration **0:45** (45s)
- COMBOS (4), sequential:
  - Round 1: `1 - 2`
  - Round 2: `1 - 2 - 3`
  - Round 3: `1 - 2 - SLIP L - 3`
  - Round 4: `1 - 1 - 2 - 3 - 6 - 3 - 2`

**Timer Check**: Play → each round should display the correct combo. Round 3 should show SLIP L, not just "SLIP".

**Pass/Fail**: ✅ if all 4 combos match exactly. ❌ if any combo is wrong, missing, or reordered.

---

### Test 1.4 — No Warmup / No Cooldown

**Prompt**: `5 rounds heavy bag, 3 min, 1 min rest. No warmup. Skip cooldown.`

**Expected Output**:
- **NO warmup section** (0 warmup phases)
- **NO cooldown section** (0 cooldown phases)
- ROUNDS section only: 5 repeats, 180s work, 60s rest

**Pass/Fail**: ✅ if only grind phases exist. ❌ if warmup or cooldown appears despite "no warmup" and "skip cooldown".

---

### Test 1.5 — No Rest

**Prompt**: `3 rounds heavy bag, 2 minutes each, no rest`

**Expected Output**:
- Phase repeats: 3
- Active segment: 120s
- Either: no rest segment at all, OR rest segment with 0s duration

**Timer Check**: Rounds should flow directly into each other with no rest countdown.

**Pass/Fail**: ✅ if no rest between rounds. ❌ if 30s or 60s rest appears despite "no rest".

---

## CATEGORY 2: Multi-Phase Workouts

These test the AI's ability to generate multiple distinct grind phases.

---

### Test 2.1 — Full Training Session (Multi-Block)

**Prompt**:
```
1 round warm up, 3 minutes, no rest. Dynamic stretches.

3 rounds shadowboxing, 2 minutes each, 30 sec rest.

3 rounds heavy bag, 3 minutes each, 1 min rest.

1 round cool down, 3 minutes, no rest. Foam rolling.
```

**Expected Output**:
- **4 phases total**
- Phase 1: WARMUP — "Dynamic Stretches" or similar, 1 repeat, 180s, section: warmup
- Phase 2: GRIND — **S badge** (shadowboxing), 3 repeats, 120s work, 30s rest
- Phase 3: GRIND — **H badge** (combo), 3 repeats, 180s work, 60s rest
- Phase 4: COOLDOWN — "Foam Rolling" or similar, 1 repeat, 180s, section: cooldown

**Key Check**: Shadowboxing phase MUST have S badge, heavy bag phase MUST have H badge. They are separate phases, not merged.

**Pass/Fail**: ✅ if 4 distinct phases with correct badges, durations, and section assignments. ❌ if phases are merged, badges are wrong, or sections are misassigned.

---

### Test 2.2 — Boxing + Speed Bag + Conditioning

**Prompt**:
```
3 rounds heavy bag, 3 min each, 1 min rest. Round 1: 1-2-3. Round 2: 1-2-5-2. Round 3: 1-2-3-6-3-2.

2 rounds speed bag, 2 minutes each, 30 sec rest. Round 1: doubles. Round 2: backfists.

2 rounds conditioning, 45 seconds each, 20 sec rest. Round 1: burpees. Round 2: mountain climbers.
```

**Expected Output**:
- Phase 1: **H badge**, 3 repeats, COMBOS(3) = `1-2-3`, `1-2-5-2`, `1-2-3-6-3-2`
- Phase 2: **SB badge** (speedbag), 2 repeats, COMBOS(2) = `Doubles`, `Backfists`
- Phase 3: **E badge** (exercise), 2 repeats, COMBOS(2) = `Burpees`, `Mountain Climbers`

**Key Check**: Three different badge types across three phases. Speed bag combos are drill NAMES not punch numbers. Conditioning combos are exercise NAMES.

**Pass/Fail**: ✅ if all three phases have correct badge types and correct combo content (punch numbers vs drill names vs exercise names). ❌ if speed bag shows punch numbers or if conditioning shows punch notation.

---

### Test 2.3 — Double End Bag

**Prompt**: `3 rounds double end bag, 2 min each, 30 sec rest`

**User Context**: Has gloves + wraps + double end bag

**Expected Output**:
- Active segment: **DB badge** (segmentType: doubleend), 120s
- Rest: 30s
- Phase repeats: 3

**Pass/Fail**: ✅ if DB badge appears (not H or S). ❌ if it falls back to heavy bag badge.

---

## CATEGORY 3: Supersets

---

### Test 3.1 — Basic Superset

**Prompt**: `3 rounds superset: heavy bag 2 minutes and burpees 1 minute. 45 sec rest between rounds.`

**Expected Output**:
- 1 grind phase with **2 active segments per cycle**:
  - Segment 1: **H badge**, "Heavy Bag", 120s
  - Segment 2: **E badge**, "Burpees", 60s
  - Segment 3: **R badge**, "Rest", 45s
- Phase repeats: **3**
- Phase name should contain "Superset" or both exercise names

**Timer Check**: Each round goes Heavy Bag (2:00) → Burpees (1:00) → Rest (0:45), then repeats 3 times.

**Pass/Fail**: ✅ if two active segments per cycle with different badges and independent durations. ❌ if it creates separate phases or uses the same duration for both.

---

### Test 3.2 — Superset with Per-Round Combos

**Prompt**: `3 rounds superset: heavy bag 2 minutes and burpees 1 minute. 45 sec rest. Round 1: 1-2. Round 2: 1-2-3. Round 3: 1-1-2-3-2.`

**Expected Output**:
- Same structure as 3.1
- COMBOS(3): `1-2`, `1-2-3`, `1-1-2-3-2`
- Combos are on the **phase**, assigned to the heavy bag segment during playback
- Segment names should be clean: "Heavy Bag" and "Burpees" — NOT "Round 1: 1-2" or containing combo text

**Pass/Fail**: ✅ if combos exist on phase, segment names are clean. ❌ if combo notation leaks into segment names.

---

### Test 3.3 — Superset with Independent Durations

**Prompt**: `4 rounds: shadowboxing 2 min then jump rope 1 min. 30 sec rest.`

**Expected Output**:
- Segment 1: **S badge**, 120s
- Segment 2: **E badge**, "Jump Rope", 60s
- Segment 3: rest, 30s
- Phase repeats: 4
- **Durations are independent**: Shadow is 120s, Jump Rope is 60s — NOT both 120s or both 90s

**Pass/Fail**: ✅ if each exercise has its own specified duration. ❌ if they share the same duration.

---

## CATEGORY 4: Vague / Creative Prompts (LLM Reasoning)

These are the prompts that the regex parser CANNOT handle. They test the AI's ability to reason and generate.

---

### Test 4.1 — Duration-Based ("20 minutes")

**Prompt**: `20 minute intermediate workout`

**Expected Output**:
- Total duration should be approximately **1,100-1,300 seconds** (18-22 min range)
- Difficulty: intermediate
- Should have some structure (not just one 20-min phase)
- Combos should be intermediate-appropriate (punches 1-6, possibly SLIP/ROLL)

**Pass/Fail**: ✅ if total duration is within ±20% of 1200s AND has reasonable structure. ❌ if total is wildly off (e.g., 5 minutes or 45 minutes) or if it's a single unstructured phase.

---

### Test 4.2 — "Surprise Me"

**Prompt**: `surprise me. intermediate. 25 minutes.`

**Expected Output**:
- Should generate a complete workout (~25 min)
- Should have warmup + grind + cooldown
- Should have combos appropriate to intermediate tier
- Should not be empty or a fallback "3 rounds heavy bag" default

**Pass/Fail**: ✅ if it generates something creative with variety (not just basic heavy bag rounds). ❌ if it clearly falls back to the regex parser default.

---

### Test 4.3 — Focus Area Request

**Prompt**: `Heavy on defense and head movement. 6 rounds, 2 min each.`

**Expected Output**:
- Combos should contain **defensive moves**: SLIP L, SLIP R, ROLL L, ROLL R, DUCK, etc.
- Not just straight punching combos
- At least 50% of combos should contain a defense move

**Pass/Fail**: ✅ if combos contain defense notation. ❌ if combos are all pure punching with no defense.

---

### Test 4.4 — Body Shot Focus

**Prompt**: `5 rounds body work, focus on body shots. Intermediate.`

**Expected Output**:
- Combos should include punch **7** (lead body hook) and/or **8** (rear body hook)
- Should have body-targeting combinations like `1-2-7`, `1-1-2-7-8`, `2-3-7`, etc.

**Pass/Fail**: ✅ if combos include 7 and/or 8. ❌ if no body shots appear despite explicit request.

---

### Test 4.5 — Fighter Style Reference

**Prompt**: `Give me a Canelo Alvarez style workout. Advanced. 8 rounds.`

**Expected Output**:
- Should generate an advanced workout
- Should have 8 grind rounds (or close to it)
- Combos should be advanced (punches 1-8, defense, movement)
- Longer combos (5-8 moves) reflecting advanced level

**Pass/Fail**: ✅ if advanced combos, ~8 rounds, reasonable boxing structure. ❌ if it falls back to beginner combos or ignores the round count.

---

## CATEGORY 5: Equipment Constraints

---

### Test 5.1 — No Equipment at All

**Prompt**: `5 rounds, 3 min each, 1 min rest`

**User Context**: No equipment selected (no gloves, no wraps, no bags, no rope)

**Expected Output**:
- Active segments should be **S badge** (shadowboxing) ONLY — no H, SB, or DB badges
- Warmup should NOT include jump rope — should use High Knees, Jumping Jacks, or similar
- No `combo` or `speedbag` or `doubleend` segment types anywhere

**Pass/Fail**: ✅ if shadowboxing only, no equipment-dependent segments. ❌ if heavy bag badge appears.

---

### Test 5.2 — Speed Bag Only

**Prompt**: `4 rounds speed bag, 2 min each, 30 sec rest`

**User Context**: Has speed bag, nothing else

**Expected Output**:
- **SB badge** on active segments
- Should NOT add heavy bag segments
- Warmup should not require equipment

**Pass/Fail**: ✅ if SB badge only, no H badge. ❌ if heavy bag work appears.

---

### Test 5.3 — Full Gym Setup

**Prompt**: `Complete boxing session, 30 minutes`

**User Context**: ALL equipment (gloves, wraps, heavy bag, double end bag, speed bag, jump rope, treadmill)

**Expected Output**:
- Should use multiple equipment types across phases
- Could include H badge (heavy bag), SB (speed bag), DB (double end bag) segments
- Warmup could use jump rope
- Total ~30 minutes

**Pass/Fail**: ✅ if it leverages available equipment variety. ❌ if it ignores equipment and only does shadowboxing.

---

## CATEGORY 6: Tier / Difficulty

---

### Test 6.1 — Beginner Combo Complexity

**Prompt**: `5 rounds heavy bag, 3 min, 1 min rest`

**User Context**: Beginner (or complete_beginner) tier

**Expected Output**:
- Combos should use ONLY punches **1-4** (jab, cross, lead hook, rear hook)
- Combo length: **2-3 moves** max
- NO defense moves in combos (no SLIP, ROLL, etc.)
- NO punches 5-8

**Pass/Fail**: ✅ if all combos are simple (1-4 only, 2-3 moves). ❌ if combos contain 5/6/7/8 or defense.

---

### Test 6.2 — Advanced Combo Complexity

**Prompt**: `5 rounds heavy bag, 3 min, 1 min rest`

**User Context**: Advanced tier

**Expected Output**:
- Combos CAN include punches **1-8**
- Combos CAN include defense (SLIP, ROLL, DUCK) and movement (STEP IN, CIRCLE)
- Combo length: **4-7 moves**
- Should be noticeably more complex than beginner

**Pass/Fail**: ✅ if combos are longer and use wider punch/defense vocabulary. ❌ if combos are identical to beginner output.

---

### Test 6.3 — Explicit Difficulty Override

**Prompt**: `3 rounds heavy bag, beginner level`

**User Context**: Advanced tier (the explicit "beginner" in prompt should override)

**Expected Output**:
- Difficulty: **beginner** (not advanced)
- Combos should be beginner-appropriate despite user being advanced tier

**Pass/Fail**: ✅ if difficulty is beginner and combos are simple. ❌ if it ignores the explicit "beginner" and generates advanced combos.

---

## CATEGORY 7: Megasets

---

### Test 7.1 — Repeat Everything Twice

**Prompt**: `3 rounds heavy bag, 2 min, 30 sec rest. 2 rounds conditioning, 1 min, 20 sec rest. Round 1: burpees. Round 2: squats. Repeat everything twice.`

**Expected Output**:
- `megasetRepeats: 2` (or equivalent flag)
- Grind section should play through TWICE in the timer:
  - First pass: 3 heavy bag rounds → 2 conditioning rounds
  - Second pass: 3 heavy bag rounds → 2 conditioning rounds again

**Timer Check**: After the conditioning rounds finish the first time, it should loop back to heavy bag rounds for the second megaset pass.

**Pass/Fail**: ✅ if the timer plays through grind twice. ❌ if it only plays once or if megasetRepeats is missing.

---

### Test 7.2 — "Run It Back"

**Prompt**: `5 rounds heavy bag, 3 min, 1 min rest. Run it back.`

**Expected Output**:
- `megasetRepeats: 2` (equivalent to "repeat everything twice")

**Pass/Fail**: ✅ if megaset = 2. ❌ if it ignores "run it back".

---

## CATEGORY 8: Speed Bag Specifics

---

### Test 8.1 — Speed Bag with Named Drills

**Prompt**: `4 rounds speed bag, 1 min 30 sec each, 30 sec rest. Round 1: doubles. Round 2: triples. Round 3: fist rolls. Round 4: side to side.`

**Expected Output**:
- **SB badge**, 4 repeats, 90s work, 30s rest
- COMBOS(4) containing drill **names** (not numbers):
  - `Doubles`
  - `Triples`
  - `Fist Rolls (Forward)` (or close variant)
  - `Side to Side`

**Timer Check**: Each round should display the drill name, NOT punch numbers.

**Pass/Fail**: ✅ if drill names display correctly. ❌ if it shows punch numbers or generic "Speed Bag" with no drill names.

---

### Test 8.2 — Speed Bag Freestyle (No Drills)

**Prompt**: `3 rounds speed bag, 2 min each, 30 sec rest`

**Expected Output**:
- **SB badge**, 3 repeats
- NO combos on the phase (freestyle mode)
- Segment name should indicate freestyle

**Pass/Fail**: ✅ if no combos are assigned (freestyle). ❌ if random punch combos are attached to speed bag.

---

## CATEGORY 9: Conditioning / Exercise Library

---

### Test 9.1 — Conditioning with Per-Round Exercises

**Prompt**: `4 rounds conditioning, 1 min each, 30 sec rest. Round 1: burpees. Round 2: mountain climbers. Round 3: push-ups. Round 4: squat jumps.`

**Expected Output**:
- **E badge** (exercise), 4 repeats
- COMBOS(4) containing exercise names:
  - `Burpees`
  - `Mountain Climbers`
  - `Push-Ups`
  - `Squat Jumps`
- Only **1 active segment** per cycle (not 4 separate segments)

**Timer Check**: Each round should display the exercise name for that round.

**Pass/Fail**: ✅ if exercise names display per-round via combos. ❌ if it creates 4 separate phases or shows punch notation.

---

### Test 9.2 — Mixed Exercises Per Round

**Prompt**: `2 rounds conditioning, 1 min 30 sec each, 45 sec rest. Round 1: mountain climbers and squat jumps. Round 2: push-ups and plank.`

**Expected Output**:
- 2 repeats
- COMBOS(2):
  - `Mountain Climbers & Squat Jumps` (or similar combined format)
  - `Push-Ups & Plank Hold`

**Pass/Fail**: ✅ if combined exercise names display correctly. ❌ if "and" causes parsing issues.

---

## CATEGORY 10: Edge Cases & Regression

---

### Test 10.1 — Extremely Short Prompt

**Prompt**: `boxing`

**Expected Output**:
- Should generate SOMETHING valid (not crash or return empty)
- Should have at least a grind phase with boxing content
- Difficulty should default to user's tier

**Pass/Fail**: ✅ if a valid workout is generated. ❌ if it errors, returns empty, or shows a blank workout.

---

### Test 10.2 — Extremely Long / Complex Prompt

**Prompt**:
```
Start with 2 rounds of jump rope, 2 minutes each, 30 sec rest.

Then 2 rounds shadowboxing, 2 min each, 30 sec rest. Round 1: jab cross. Round 2: jab cross hook.

Then 4 rounds heavy bag, 3 minutes each, 1 min rest. Round 1: 1-2. Round 2: 1-2-3-2. Round 3: 1-1-2-5-2. Round 4: 1-2-3-6-3-2.

Then 2 rounds speed bag, 2 min each, 30 sec rest. Round 1: doubles. Round 2: side to side.

Then 3 rounds conditioning, 45 sec each, 20 sec rest. Round 1: burpees. Round 2: mountain climbers. Round 3: plank.

Then 1 round cooldown, 3 minutes, no rest. Foam rolling.
```

**Expected Output**:
- **6 distinct phases** with correct section assignments
- Jump rope: E badge, warmup section
- Shadowboxing: S badge, grind section, 2 combos
- Heavy bag: H badge, grind section, 4 combos
- Speed bag: SB badge, grind section, 2 drill names
- Conditioning: E badge, grind section, 3 exercise names
- Cooldown: cooldown section

**Pass/Fail**: ✅ if all 6 phases parse with correct badges and content. ❌ if any phase is missing, merged, or has wrong badge.

---

### Test 10.3 — Non-Boxing Language

**Prompt**: `HIIT circuit: 30 sec work, 15 sec rest, 8 rounds. Burpees, mountain climbers, squat jumps, push-ups.`

**Expected Output**:
- Should generate a conditioning-focused workout
- 8 rounds with 30s/15s timing
- E badge segments
- Tags should include "hiit" and/or "conditioning"

**Pass/Fail**: ✅ if it handles non-boxing HIIT prompts. ❌ if it tries to force boxing combos onto pure conditioning.

---

### Test 10.4 — Duration in Seconds

**Prompt**: `3 rounds, 90 seconds each, 30 seconds rest`

**Expected Output**:
- Active segment: **1:30** (90 seconds), NOT 90 minutes
- Rest: **0:30** (30 seconds)

**Pass/Fail**: ✅ if durations are correct in seconds. ❌ if it interprets "90 seconds" as 90 minutes (5400s).

---

### Test 10.5 — Mixed Duration Formats

**Prompt**: `4 rounds, 1 min 30 sec each, 45 sec rest`

**Expected Output**:
- Active segment: **1:30** (90 seconds)
- Rest: **0:45** (45 seconds)

**Pass/Fail**: ✅ if "1 min 30 sec" = 90s. ❌ if it only captures the "1 min" part (60s).

---

### Test 10.6 — Fallback Recovery

**Prompt**: `asdfghjkl random garbage text 123`

**Expected Output**:
- Should NOT crash
- Should either: generate a sensible default workout (AI interprets as best it can), OR fall back to the regex parser which produces a basic workout
- Should have at least one grind phase

**Pass/Fail**: ✅ if app doesn't crash and produces some workout. ❌ if error, blank screen, or infinite loading.

---

### Test 10.7 — Combo Notation Accuracy

**Prompt**: `3 rounds. Round 1: double jab cross uppercut. Round 2: jab cross slip left hook. Round 3: rear uppercut lead hook cross.`

**Expected Output**:
- Round 1: `1 - 1 - 2 - 5` (double jab = two 1s, cross = 2, uppercut = 5)
- Round 2: `1 - 2 - SLIP L - 3` (jab = 1, cross = 2, slip left = SLIP L, hook = 3)
- Round 3: `6 - 3 - 2` (rear uppercut = 6, lead hook = 3, cross = 2)

**Pass/Fail**: ✅ if word-to-number translation is correct. ❌ if "double jab" doesn't produce two 1s, or "rear uppercut" doesn't produce 6.

---

## CATEGORY 11: Timer Playback Verification

These tests REQUIRE actually playing the workout and watching the timer to verify segment flow.

---

### Test 11.1 — Basic Timer Flow

**Setup**: Generate "3 rounds heavy bag, 2 min, 30 sec rest" and press Play.

**Verify**:
- [ ] Countdown (10s) before workout starts
- [ ] Round 1 starts with 2:00 timer, H badge displayed
- [ ] Combo shown during active segment
- [ ] At 0:00, transitions to Rest (0:30)
- [ ] After rest, Round 2 starts with new combo
- [ ] After Round 3, transitions to cooldown (not back to Round 1)
- [ ] Workout ends after cooldown

---

### Test 11.2 — Superset Timer Flow

**Setup**: Generate "3 rounds superset: heavy bag 2 min and burpees 1 min. 45 sec rest." and Play.

**Verify**:
- [ ] Round 1: Heavy Bag (2:00) → Burpees (1:00) → Rest (0:45)
- [ ] Round 2: Heavy Bag (2:00) → Burpees (1:00) → Rest (0:45)
- [ ] Round 3: Heavy Bag (2:00) → Burpees (1:00) → Rest (0:45)
- [ ] Badge changes from H → E → R within each round

---

### Test 11.3 — Multi-Phase Timer Flow

**Setup**: Generate the multi-phase workout from Test 2.1 and Play.

**Verify**:
- [ ] Warmup plays first (Dynamic Stretches 3:00)
- [ ] Shadowboxing rounds play next (3 × 2:00 + 0:30)
- [ ] Heavy bag rounds play after shadow (3 × 3:00 + 1:00)
- [ ] Cooldown plays last (Foam Rolling 3:00)
- [ ] Phase name changes as you move between phases
- [ ] Badge changes between S and H sections

---

### Test 11.4 — Megaset Timer Flow

**Setup**: Generate from Test 7.1 and Play.

**Verify**:
- [ ] First pass: 3 heavy bag rounds → 2 conditioning rounds
- [ ] Second pass begins: heavy bag rounds start again
- [ ] Full workout plays through TWICE

---

## RESULTS TEMPLATE

Copy this table and fill in as you test:

| Test | Prompt Summary | Result | Notes |
|------|---------------|--------|-------|
| 1.1 | 5 rds heavy bag 3min/1min | ✅/❌ | |
| 1.2 | 3 rds shadowboxing 2min/30s | ✅/❌ | |
| 1.3 | 4 rds with specific combos | ✅/❌ | |
| 1.4 | No warmup no cooldown | ✅/❌ | |
| 1.5 | No rest | ✅/❌ | |
| 2.1 | Full multi-phase session | ✅/❌ | |
| 2.2 | Boxing + SB + conditioning | ✅/❌ | |
| 2.3 | Double end bag | ✅/❌ | |
| 3.1 | Basic superset | ✅/❌ | |
| 3.2 | Superset with combos | ✅/❌ | |
| 3.3 | Superset independent durations | ✅/❌ | |
| 4.1 | 20 min workout | ✅/❌ | |
| 4.2 | Surprise me | ✅/❌ | |
| 4.3 | Defense focus | ✅/❌ | |
| 4.4 | Body shot focus | ✅/❌ | |
| 4.5 | Fighter style | ✅/❌ | |
| 5.1 | No equipment | ✅/❌ | |
| 5.2 | Speed bag only | ✅/❌ | |
| 5.3 | Full gym | ✅/❌ | |
| 6.1 | Beginner combos | ✅/❌ | |
| 6.2 | Advanced combos | ✅/❌ | |
| 6.3 | Explicit difficulty override | ✅/❌ | |
| 7.1 | Repeat everything twice | ✅/❌ | |
| 7.2 | Run it back | ✅/❌ | |
| 8.1 | Speed bag with drills | ✅/❌ | |
| 8.2 | Speed bag freestyle | ✅/❌ | |
| 9.1 | Conditioning per-round | ✅/❌ | |
| 9.2 | Mixed exercises per round | ✅/❌ | |
| 10.1 | Extremely short prompt | ✅/❌ | |
| 10.2 | 6-phase complex prompt | ✅/❌ | |
| 10.3 | HIIT non-boxing | ✅/❌ | |
| 10.4 | Duration in seconds | ✅/❌ | |
| 10.5 | Mixed duration formats | ✅/❌ | |
| 10.6 | Garbage input | ✅/❌ | |
| 10.7 | Word combo notation | ✅/❌ | |
| 11.1 | Timer basic flow | ✅/❌ | |
| 11.2 | Timer superset flow | ✅/❌ | |
| 11.3 | Timer multi-phase flow | ✅/❌ | |
| 11.4 | Timer megaset flow | ✅/❌ | |

---

## BUG REPORT FORMAT

When a test fails, report using this structure:

```
## BUG — Test X.X: [Test Name]

### What happened:
[Screenshot + description of actual behavior]

### What should have happened:
[Expected behavior from this test spec]

### Severity:
- CRITICAL: Timer breaks, app crashes, data loss
- HIGH: Wrong workout structure, wrong combos, wrong durations
- MEDIUM: Wrong badge type, wrong exercise names, cosmetic
- LOW: Naming, missing tags, minor formatting

### Root cause (if identifiable):
[Is this an LLM output issue, validation issue, or compilation issue?]

### Suggested fix:
[Specific guidance for Lovable]
```
