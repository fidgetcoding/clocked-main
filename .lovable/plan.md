

# Reset All Users' XP and Level Progress

## What This Does
Resets every user's gamification progress (XP, level, streaks, workout counts) back to the starting baseline, while keeping all other profile data intact (name, handle, bio, avatar, equipment, preferences, role, etc.).

## What Gets Reset
- `total_xp` → 0
- `current_level` → 1
- `current_streak` → 0
- `longest_streak` → 0
- `workouts_completed` → 0
- `combos_landed` → 0
- `total_training_seconds` → 0
- `sessions_completed_this_year` → 0
- `last_workout_date` → NULL
- `streak_multiplier` → 1.0

## What Stays Untouched
- Name, handle, bio, avatar
- Role, experience level, prestige tier
- Equipment, goals, preferences
- Account creation date
- Workout history records (the log entries stay, just the counters reset)

## Technical Details

### Single SQL update via the data insert tool
```sql
UPDATE profiles SET
  total_xp = 0,
  current_level = 1,
  current_streak = 0,
  longest_streak = 0,
  workouts_completed = 0,
  combos_landed = 0,
  total_training_seconds = 0,
  sessions_completed_this_year = 0,
  last_workout_date = NULL,
  streak_multiplier = 1.0,
  updated_at = now();
```

No code changes needed -- the app already reads these values from the database on each load, so the next time any user opens the app, it will reflect the reset state.

