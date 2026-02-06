

# AI Coach History Analysis & Round Feedback Integration

## Overview
Two major enhancements:
1. **Add round-by-round feedback** to the workout completion screen (currently missing)
2. **Make AI coach analyze workout history** to personalize future workout suggestions

---

## Part 1: Add Round Feedback to Workout Completion Screen

### Current Problem
When you finish a timed workout, the completion screen only offers:
- Overall difficulty rating (Too Easy / Just Right / Too Hard)
- Notes textarea

The "Advanced" mode with round-by-round ratings (1-5 scale) only exists in the manual "Log Past Workout" modal.

### Solution
Add a Basic/Advanced toggle to the workout completion screen that enables per-round feedback.

### Technical Changes

**File: `src/pages/WorkoutSession.tsx`**

1. **Add state for round feedback:**
```typescript
const [feedbackMode, setFeedbackMode] = useState<'basic' | 'advanced'>('basic');
const [roundFeedback, setRoundFeedback] = useState<RoundFeedback[]>([]);
```

2. **Calculate round count from workout structure:**
The workout already has `flatSegments` with `repeatIndex` - we can count unique grind rounds from this.

3. **Add round rating handler:**
```typescript
const handleRoundRating = (roundNum: number, rating: number) => {
  setRoundFeedback(prev => {
    const existing = prev.find(r => r.roundNumber === roundNum);
    if (existing) {
      return prev.map(r => r.roundNumber === roundNum ? { ...r, rating } : r);
    }
    return [...prev, { roundNumber: roundNum, rating }];
  });
};
```

4. **Update handleLog to include round_feedback:**
```typescript
round_feedback: feedbackMode === 'advanced' ? roundFeedback : [],
```

5. **Add UI to completion screen:**
- Basic/Advanced toggle buttons (styled like AddWorkoutModal)
- When Advanced: Show scrollable list of rounds with 1-5 rating buttons
- Calculate rounds from workout phases (grind section repeats)

### UI Layout for Completion Screen

```
┌─────────────────────────────────┐
│           🏆                     │
│    WORKOUT COMPLETE!            │
│    [Workout Name]               │
│                                 │
│  ┌─────────┐  ┌─────────┐       │
│  │ 32:45   │  │ +485    │       │
│  │Duration │  │XP Earned│       │
│  └─────────┘  └─────────┘       │
│                                 │
│  ┌──────────┬──────────┐        │
│  │  Basic   │ Advanced │        │  ← NEW toggle
│  └──────────┴──────────┘        │
│                                 │
│  [Notes textarea]               │
│                                 │
│  Difficulty:                    │
│  [Too Easy] [Just Right] [Hard] │
│                                 │
│  ─── Advanced Mode Only ───     │
│  Rate Each Round:               │
│  R1  [1][2][3][4][5]           │  ← NEW
│  R2  [1][2][3][4][5]           │
│  R3  [1][2][3][4][5]           │
│  ...                            │
│                                 │
│  [Log Workout]                  │
│  [Done - Go Home]               │
└─────────────────────────────────┘
```

---

## Part 2: AI Coach Learns from History

### Current Problem
The AI generates workouts based ONLY on:
- The user's text/voice prompt
- User's experience level from profile

It ignores all historical data including:
- Past difficulty ratings
- Round feedback
- Workout frequency
- Which workouts were rated "too hard" or "too easy"

### Solution
Create a history analysis system that informs AI workout generation.

### Technical Changes

**File: `src/lib/workoutHistoryAnalysis.ts` (NEW)**

Create a utility that analyzes workout history:

```typescript
interface HistoryInsights {
  averageDifficulty: 'too_easy' | 'just_right' | 'too_hard' | null;
  recentTrend: 'getting_easier' | 'stable' | 'getting_harder' | null;
  weakRounds: number[]; // Rounds consistently rated low
  strongRounds: number[]; // Rounds consistently rated high
  preferredDuration: number; // Average workout duration in minutes
  lastWorkoutDate: Date | null;
  totalWorkouts: number;
  suggestedAdjustments: string[];
}

export function analyzeWorkoutHistory(history: WorkoutHistoryEntry[]): HistoryInsights
```

**Analysis Logic:**
1. Calculate average difficulty rating from recent 10 workouts
2. Identify trend: Are workouts getting easier/harder over time?
3. Aggregate round feedback: Which rounds are consistently rated 1-2 (weak) vs 4-5 (strong)?
4. Generate suggestions:
   - If average = "too_easy" → suggest "Try increasing intensity or adding rounds"
   - If average = "too_hard" → suggest "Consider shorter rounds or more rest"
   - If certain rounds are always weak → suggest "Build up to harder rounds gradually"

**File: `src/lib/aiWorkoutParser.ts`**

Enhance the parser to accept history insights:

```typescript
export function parseWorkoutInput(
  prompt: string, 
  userLevel: string = 'beginner',
  historyInsights?: HistoryInsights  // NEW optional parameter
): ParsedWorkoutResult
```

**Auto-adjustments based on history:**
- If `averageDifficulty === 'too_easy'`: Default to user's level + 1 difficulty
- If `averageDifficulty === 'too_hard'`: Reduce default rounds by 1-2, increase rest duration
- If trend shows improvement: Gradually increase complexity

**File: `src/components/AIBuilderModal.tsx`**

1. Import `useWorkoutHistory` hook
2. Call `analyzeWorkoutHistory(history)` on mount
3. Pass insights to `generateWorkoutFromPrompt()`
4. Show insights summary in UI (optional):
   ```
   💡 Based on your history: Your last 5 workouts were rated "just right" - 
   you're ready for more challenge!
   ```

---

## Implementation Order

1. **Round Feedback UI** (WorkoutSession.tsx)
   - Add state variables
   - Add Basic/Advanced toggle
   - Add round rating UI
   - Update handleLog function

2. **History Analysis Utility** (NEW file)
   - Create analyzeWorkoutHistory function
   - Define HistoryInsights interface
   - Implement analysis logic

3. **Integrate into AI Generator** (AIBuilderModal.tsx)
   - Fetch workout history
   - Run analysis
   - Pass insights to parser
   - (Optional) Show insights in UI

---

## Data Flow After Implementation

```
                    ┌─────────────────┐
                    │  Workout Done   │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Completion Screen          │
              │  - Notes                    │
              │  - Overall Difficulty       │
              │  - Round-by-Round Ratings   │ ← NEW
              └──────────────┬──────────────┘
                             │
                    ┌────────▼────────┐
                    │  workout_history │
                    │  (Supabase)      │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │  History Analysis           │ ← NEW
              │  - Average difficulty       │
              │  - Weak/strong rounds       │
              │  - Trends over time         │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  AI Workout Generator       │
              │  - Prompt parsing           │
              │  - User level               │
              │  - History-based tweaks     │ ← NEW
              └──────────────┬──────────────┘
                             │
                    ┌────────▼────────┐
                    │  Personalized   │
                    │  Workout        │
                    └─────────────────┘
```

---

## Summary

| Feature | Current | After |
|---------|---------|-------|
| Round feedback in completion screen | ❌ | ✅ |
| AI reads workout history | ❌ | ✅ |
| AI adjusts based on difficulty ratings | ❌ | ✅ |
| AI identifies weak rounds | ❌ | ✅ |
| Personalized suggestions | ❌ | ✅ |

