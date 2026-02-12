# LOVABLE: Workout Architecture & Combo System Complete Rebuild

---

We're rebuilding the workout and combo system from scratch. The old 59-minute / 15-cycle / 3-workout structure is DEPRECATED. Here's the new architecture.

---

## PART 1: THE STANDARD WORKOUT

Every user gets ONE loadout workout based on their prestige tier (experience level) and equipment from onboarding. The structure is the same across all tiers — only the COMBOS and EQUIPMENT SETUP change.

### Workout Structure (~35 minutes total)

```
WARMUP
  └── Jump Rope OR High Knees ......... 3:00 (equipment-dependent)

ROUNDS (10 Boxing Cycles × 2:00 each + Conditioning = 22:00)
  Each cycle:
  ├── Shadowboxing .................... 0:30
  ├── Bag Work OR Extended Shadow ..... 0:30 (equipment-dependent)
  ├── Pushups ......................... 0:30
  └── Rest ............................ 0:30

  After 10 cycles (still part of ROUNDS):
  ├── Curlups ......................... 1:00
  └── Rest ............................ 1:00

COOLDOWN
  └── Treadmill OR Jog in Place ....... 10:00 (equipment-dependent)
```

### How Each Boxing Cycle Works

Each of the 10 cycles has a COMBO assigned. The combo displays during both shadow and bag segments:
- **Shadowboxing (0:30):** Work the combo at 30-40% intensity, focus on form
- **Bag Work (0:30):** Same combo at full power on the bag

The 10 cycles each have a DIFFERENT combo pulled from escalating difficulty pools (see Part 3). Curlups + rest happen immediately after the 10th cycle, still within the ROUNDS section, before transitioning to cooldown.

### Equipment Logic

During onboarding, users select equipment. This is stored in their profile.

**Bags:**
- If user has Heavy Bag or Double-End Bag (selected as primary): each cycle = 0:30 shadow + 0:30 bag work
- If no bag (or only speed bag): each cycle = 1:00 shadowboxing continuous
- Speed Bag: NEVER in loadout workouts. Custom workouts only.

**Jump Rope:**
- If user has jump rope: 3:00 Jump Rope warmup
- If no jump rope: 3:00 High Knees (same warmup purpose)

**Treadmill:**
- If user has treadmill: 10:00 Treadmill cooldown
- If no treadmill: 10:00 Jog in Place

**If user changes equipment in settings:** Regenerate workout structure with new config, keep combo tier.

### Equipment Data Model

```typescript
interface UserEquipment {
  jumpRope: boolean;
  heavyBag: boolean;
  doubleEndBag: boolean;
  speedBag: boolean;
  treadmill: boolean;
  primaryBag: 'heavy' | 'double_end' | 'none';
}
```

---

## PART 2: PUNCH & DEFENSE SYSTEMS

### Punch Numbers

| # | Punch | Hand |
|---|-------|------|
| 1 | Jab | Lead (odd) |
| 2 | Cross | Rear (even) |
| 3 | Lead Hook | Lead (odd) |
| 4 | Rear Hook | Rear (even) |
| 5 | Lead Uppercut | Lead (odd) |
| 6 | Rear Uppercut | Rear (even) |
| 7 | Lead Body Hook | Lead (odd) |
| 8 | Rear Body Hook | Rear (even) |

Odd = lead hand. Even = rear hand.

### Defense Moves

| Move | Description |
|------|-------------|
| Slip Left | Move head left to avoid straight punch |
| Slip Right | Move head right to avoid straight punch |
| Roll L | Roll/duck under a hook, moving left |
| Roll R | Roll/duck under a hook, moving right |
| Pullback | Lean torso back to make punches fall short |
| Circle Left | Pivot on lead foot, move laterally left |
| Circle Right | Pivot on lead foot, move laterally right |

### Tier System — How It Works

**Nothing is "locked."** Users can freely toggle between tier views in the preset library to see what's available at each level. Their onboarding selection determines what their loadout workout contains and what the preset library shows by default, but they can switch views anytime.

Three distinct things:
1. **Loadout** = Pre-built default workout auto-generated from onboarding. Press play and go.
2. **Preset Library** = Menu of pre-made combos organized by tier. Users see their tier by default but can toggle to browse other tiers.
3. **Custom Combo Builder** = Separate tool (already exists in the app) where users tap to build combos from available punches and defense moves.

### What Each Tier's LOADOUT Contains:

| | Rookie | Beginner | Intermediate | Advanced | Pro |
|--|--------|----------|-------------|----------|-----|
| Punches 1-3 | ✅ Primary | ✅ | ✅ | ✅ | ✅ |
| Punch 4 | ✅ Intro | ✅ | ✅ | ✅ | ✅ |
| Punches 5-6 | ✅ Late | ✅ | ✅ | ✅ | ✅ |
| Punches 7-8 | — | — | — | ✅ | ✅ |
| Slip L/R | — | ✅ | ✅ | ✅ | ✅ |
| Roll L/R | — | — | ✅ | ✅ | ✅ |
| Pullback | — | — | — | ✅ | ✅ |
| Circle L/R | — | — | — | — | ✅ |

### What Each Tier's PRESET LIBRARY Shows (Default View):

| | Rookie | Beginner | Intermediate | Advanced | Pro |
|--|--------|----------|-------------|----------|-----|
| Punches 1-6 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Punches 7-8 | — | — | ✅ | ✅ | ✅ |
| Slip L/R | ✅ | ✅ | ✅ | ✅ | ✅ |
| Roll L/R | — | ✅ | ✅ | ✅ | ✅ |
| Pullback | — | — | ✅ | ✅ | ✅ |
| Circle L/R | — | — | — | ✅ | ✅ |

Users can toggle to any other tier's view anytime.

---

## PART 3: COMBO POOLS BY TIER

The 10 rounds are divided into escalating SEGMENTS. Each segment has a pool of combos. The app randomly picks one combo per round from the segment's pool.

**Selection rules:**
1. Default = RANDOM within each segment
2. No combo repeats within same workout (if pool large enough)
3. If pool ≤ round count, allow repeats but never back-to-back
4. User can toggle SEQUENTIAL in settings
5. Combos pre-selected at workout generation, not during playback

---

### ROOKIE (4 Easy + 3 Medium + 3 Hard)

**Loadout:** 1 workout. No defense. Punches 1-3 first, introduce 4 in medium, 5-6 in hard.
**Preset Library:** Punches 1-6, Slip Left, Slip Right

**Rounds 1-4 — EASY (2-Punch, Punches 1-3 Only):**
```
1-1
1-2
2-1
2-2
1-3
2-3
3-2
3-1
```

**Rounds 5-7 — MEDIUM (3-Punch, Introducing Punch 4):**
```
1-1-2
2-1-2
1-2-3
1-2-1
2-3-2
2-1-3
3-2-1
1-3-2
1-2-4
2-3-4
3-2-3
1-4-3
```

**Rounds 8-10 — HARD (3-Punch, Introducing 5 & 6. Strict hand alternation: odd-even-odd or even-odd-even, unless double jab/cross):**
```
1-2-5
2-1-6
5-2-3
6-3-2
1-6-3
2-5-2
3-2-5
4-1-6
1-4-5
2-3-6
5-6-1
6-1-2
```

---

### BEGINNER (2 Warmup + 3 Build + 3 Slip Intro + 2 Advanced Slip)

**Loadout:** 1 workout. Slips introduced.
**Preset Library:** Punches 1-6, Slip L/R, Roll L/R

**Rounds 1-2 — WARMUP (2-Punch, No Defense, all 6 punches):**
```
1-2
2-1
1-3
2-3
3-2
3-1
1-4
4-1
1-6
6-1
5-2
2-5
6-3
4-3
3-4
5-6
```

**Rounds 3-5 — BUILD (3-Punch, No Defense):**
```
1-2-3
1-2-1
1-1-2
2-1-2
2-3-2
2-1-3
2-3-4
1-2-5
2-1-6
1-3-2
3-2-3
1-6-3
5-2-3
6-3-2
1-4-5
2-5-2
```

**Rounds 6-8 — SLIP INTRO (2-3 Punch + Slip Left at End):**
```
1-2-slip left
2-3-slip left
1-2-3-slip left
2-1-3-slip left
1-1-2-slip left
2-3-2-slip left
3-2-slip left
1-2-4-slip left
2-1-2-slip left
1-3-2-slip left
1-6-3-slip left
2-5-2-slip left
```

**Rounds 9-10 — ADVANCED SLIP (Slip Left/Right, End or Middle):**
```
1-slip left-2
2-slip right-3
1-2-slip left-3
2-3-slip right-2
1-slip left-3-2
1-slip right-2-3
2-slip left-3-slip left
1-2-slip right-3-2
slip left-2-3
slip right-1-2-3
```

---

### INTERMEDIATE (1 Warmup + 2 Slip Foundation + 2 Slip Combos + 3 Roll Intro + 2 Combined)

**Loadout:** 1 workout. Rolls introduced (Roll L, Roll R).
**Preset Library:** Punches 1-8, Slip L/R, Roll L/R, Pullback

**Round 1 — WARMUP (2-Punch, No Defense, all 6 punches):**
```
1-2
2-1
2-3
3-2
1-3
1-6
5-2
2-4
6-1
4-3
3-4
5-6
6-3
1-4
```

**Rounds 2-3 — SLIP FOUNDATION (2-Punch + Slip, Any Position):**
```
1-2-slip left
2-3-slip right
1-slip left-2
2-slip right-3
slip left-3-2
slip right-2-3
1-slip right-6
slip left-5-2
2-slip left-2
1-2-slip right
```

**Rounds 4-5 — SLIP COMBOS (3-Punch + Slip):**
```
1-2-3-slip left
1-slip left-3-2
2-3-slip right-2
1-2-slip left-3
slip right-2-3-2
1-slip left-2-3
2-1-slip right-3
3-2-slip left-3
1-slip left-5-2
slip left-6-3-2
2-3-slip left-5
1-slip right-6-3
```

**Rounds 6-8 — ROLL INTRODUCTION (Rolls Only, No Slips — isolate the new skill):**
```
1-2-3-roll L
1-2-roll R-3
2-3-2-roll L
roll R-3-2
1-2-roll L-3
2-roll R-3-2
1-6-roll L-3
3-2-roll R-3
1-2-3-roll R-3
5-2-roll L-3
roll L-3-2-3
roll R-3-2-1
```

**Rounds 9-10 — COMBINED (Slips AND Rolls Together. 4-punch combos allowed here):**
```
1-2-slip left-3-roll L
1-slip left-2-3-roll R-3
2-3-roll L-3-slip left
1-2-roll R-3-2-slip left
slip right-2-3-roll L-3-2
1-2-3-slip left-roll R-3-2
2-slip right-3-roll L-3
1-6-slip left-3-roll R
roll L-3-2-slip left-3
slip left-5-2-roll R-3-2
2-3-roll L-3-2
1-2-slip right-6-3
```

---

### ADVANCED (1 Warmup + 1 Build + 3 Mid + 3 Advanced + 2 Full Armada)

**Loadout:** 1 workout. Pullback enters. Body hooks 7-8 enter.
**Preset Library:** Punches 1-8, Slip L/R, Roll L/R, Pullback, Circle L/R

**Round 1 — WARMUP (2-Punch + 1 Defense):**
```
1-2-slip left
2-3-roll L
1-2-pullback
2-3-slip right
1-roll R-2
pullback-1-2
```

**Round 2 — BUILD (3-Punch + 1-2 Defense):**
```
1-2-3-slip left
2-3-2-roll L
1-2-3-pullback
2-1-2-slip right
1-6-3-roll R
2-slip left-3-2
pullback-1-2-3
1-2-roll L-3
```

**Rounds 3-5 — MID (4-Punch + Mixed Defense, body hooks 7-8):**
```
1-2-3-2-slip left
1-2-slip left-3-2
2-3-2-roll L-3
1-6-3-2-pullback
1-2-3-roll R-3-2
2-slip right-3-2-3
1-2-pullback-2-3
5-2-3-2-slip left
1-2-7-8-roll L
2-3-slip left-5-2
pullback-1-2-3-2
1-2-roll R-5-6
6-3-2-slip right-3
1-7-2-8-slip left
```

**Rounds 6-8 — ADVANCED (All 3 Defense Types Mixed):**
```
1-2-3-roll L-3-2-slip left
1-slip left-2-3-pullback-2
2-3-slip right-5-2-roll R
1-2-roll L-3-2-pullback
6-3-2-slip left-3-roll R-3
1-2-3-slip left-roll L-3-2
2-pullback-1-2-3-slip left
1-7-8-slip right-2-3
5-2-roll L-3-2-slip left
1-2-slip left-5-roll R-3-2
pullback-2-3-roll L-3-slip left
2-3-2-pullback-1-6-3
```

**Rounds 9-10 — FULL ARMADA (6+ Moves, Multiple Defense Types):**
```
1-2-3-slip left-roll L-3-2-pullback
2-slip right-3-2-roll R-5-2-3
1-2-pullback-1-2-3-slip left-3-2
6-5-2-3-roll L-3-slip left-2
1-slip left-2-3-roll R-3-pullback-2-3
2-3-2-slip right-5-6-roll L-3-2
1-2-7-roll R-3-2-pullback-8
pullback-1-2-slip left-3-roll L-3-2
1-2-3-roll R-5-2-slip left-3-2
2-7-8-slip right-1-2-3-roll L-3
```

---

### PRO (2 Warmup + 2 All-Defense + 3 Weaved 4+ Punch + 3 True Pro 5+ Punch)

**Loadout:** 1 workout. Everything including circles.
**Preset Library:** Everything — all punches, all defense

**Rounds 1-2 — WARMUP (3-Punch + Slips & Rolls):**
```
1-2-3-slip left-roll L
2-slip right-3-2-roll R
1-slip left-2-3-roll L
6-3-2-roll R-slip left
2-3-roll L-3-slip right
1-2-slip left-3-roll R-3
roll L-3-2-slip left-2
1-6-slip right-3-roll L
```

**Rounds 3-4 — ALL DEFENSE (3-Punch + All Defense Including Circles):**
```
1-2-3-pullback-circle left
2-slip right-3-roll R-circle right
1-pullback-2-3-circle left
2-3-2-circle right-pullback
slip left-3-2-pullback-circle left
1-2-circle right-slip left-3
circle left-1-2-3-pullback
pullback-circle right-2-3-2
1-2-3-roll L-circle left-2
slip right-5-2-circle left-3
```

**Rounds 5-7 — WEAVED 4+ PUNCH (Complex Offense-Defense):**
```
1-2-slip left-3-2-roll L-3
2-3-roll R-3-2-pullback-circle left
1-6-slip right-3-2-roll L-5
1-2-3-slip left-roll R-3-2-circle right
2-pullback-1-2-3-circle left-2
5-6-roll L-3-2-slip left-3
1-2-circle right-1-2-3-roll L
7-8-slip left-2-3-roll R-3
1-slip right-6-3-pullback-2-3
2-3-2-slip left-5-6-roll L
circle left-1-2-7-roll R-3-2
1-2-pullback-5-6-3-slip left
slip right-2-3-circle left-1-2-roll L
1-7-slip left-2-8-roll R-3-2
```

**Rounds 8-10 — TRUE PRO (5+ Punch, Full Armada):**
```
1-2-3-slip left-roll L-3-2-pullback-2-3
2-slip right-3-2-roll R-5-2-3-circle left
1-2-pullback-1-2-3-slip left-3-2-roll L
6-5-2-3-roll R-3-slip left-2-circle right
1-slip left-2-3-roll L-3-pullback-2-3-2
2-3-2-slip right-5-6-roll R-3-2-slip left
1-2-circle left-1-6-3-roll L-3-2-pullback
7-8-slip right-2-3-roll R-5-2-circle left-3
1-2-3-slip left-roll L-3-2-pullback-circle right-2-3
2-pullback-1-2-slip left-3-roll R-5-6-3-2
circle right-1-2-7-roll L-3-2-slip left-8-2
1-slip right-6-5-2-roll R-3-pullback-1-2-3
```

---

## PART 4: ONBOARDING

### Screen 1: Experience Level

| Tier | Description |
|------|-------------|
| Rookie | "Never trained combat sports" |
| Beginner | "Some basic training experience" |
| Intermediate | "Regular training for 1+ years" |
| Advanced | "Competitive experience" |
| Pro | "Professional fighter" |

### Screen 2: Equipment (multi-select checkboxes)

- [ ] Jump Rope
- [ ] Heavy Bag
- [ ] Double-End Bag
- [ ] Speed Bag
- [ ] Treadmill
- [ ] None of the above

### Screen 3: Primary Bag (ONLY if 2+ bags selected)

- Heavy Bag
- Double-End Bag

### After Onboarding

1. Store user profile with experience level + equipment
2. Look up combo pools for their tier
3. Generate loadout workout with equipment substitutions applied
4. Present on home screen, ready to play

---

## PART 5: IMPLEMENTATION NOTES

1. **Combos are arrays of strings:** `["1", "2", "slip left", "3", "roll L"]`
2. **Segment config = configuration, NOT hardcoded.** Store which rounds map to which pool per tier.
3. **No back-to-back combo repeats** within a workout.
4. **Combos pre-selected at workout start**, not during playback.
5. **This replaces the old system entirely.** Old 59-min / 15-cycle / 3-workout structure is deprecated.
6. **Equipment persists.** Changes in settings regenerate structure, keep combo tier.
7. **Equipment substitutes:** No rope → High Knees. No treadmill → Jog in Place. No bag → 60s shadow. Speed bag → custom only.
8. **Defense display:** Different color/style from punches. Format: "1-2-SLIP LEFT-3-ROLL L"
9. **Tier toggle:** Users can freely switch tier views in preset library. Loadout stays based on onboarding tier.
10. **Curlups + rest = part of ROUNDS section**, after 10th cycle, before cooldown.

---

Let me know if anything needs clarification before building.
