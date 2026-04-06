

## Problem

This is a remixed project with a fresh database. The migration files created all the **table structures** and **functions**, but:

1. **No trigger on `auth.users`** — The `on_auth_user_created` trigger that auto-creates profiles on signup is missing. The trigger targets `auth.users` (a reserved schema), so it likely wasn't applied during the remix. This means new signups don't get a profile row, breaking the entire app.

2. **`clubs` table is empty** — The "Early Adopters" club INSERT was in a migration but didn't carry over.

3. **`tier_presets` table is empty** — No seed data was ever inserted via migration (it was likely inserted manually or via admin tools in the original project).

4. **No profiles** — Since the trigger is missing, even if you sign up, no profile is created.

## Plan

### Step 1: Re-create the `auth.users` trigger via migration
Create a migration to attach `handle_new_user()` to `auth.users`:
```sql
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```
This ensures new signups automatically get a profile.

### Step 2: Seed the Early Adopters club via data insert
Insert the club row:
```sql
INSERT INTO public.clubs (id, name, icon, description, type, member_cap)
VALUES ('ea000000-0000-0000-0000-000000000001', 'Early Adopters', '🚀',
        'The first 100 fighters to join CLOCKED. Welcome to the crew!', 'public', 100)
ON CONFLICT (id) DO NOTHING;
```

### Step 3: Seed tier presets via data insert
Insert preset rows for each tier × equipment mode (shadow/bag). The `useTierPresets` hook expects rows with `tier`, `equipment_mode`, `name`, `description`, and a `loadout` JSON column. We'll create presets for: rookie, beginner, intermediate, advanced, pro — both shadow and bag modes (10 rows total).

### Step 4: Verify profile creation works
After the trigger is re-created, signing up or logging in should auto-create a profile. If the current user already exists in `auth.users` but has no profile, we may need to manually insert one or have them re-authenticate.

### Technical Details
- Step 1 requires a **migration** (it modifies `auth` schema trigger)
- Steps 2-3 use the **data insert tool** (inserting rows into existing tables)
- No code changes needed — the hooks (`useClubs`, `useTierPresets`, `usePresetSeeding`) already work correctly, they just need data
- The tier preset `loadout` JSON needs an `experienceLevel` field matching the tier name, which `generateLoadoutWorkout` uses

