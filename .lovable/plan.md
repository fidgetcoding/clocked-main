

# Move Sign Out Button to Header

## Problem
The sign out button currently sits in its own large card section, taking up unnecessary visual space.

## Solution
Move the sign out button to the header row, aligned to the right of "SETTINGS", as a compact icon button.

---

## Changes

### File: `src/pages/Settings.tsx`

**1. Update the header** (lines 109-116)
Move the LogOut button inline with the title:

```tsx
<header className="flex items-center gap-3 px-4 pt-8 pb-6 safe-top">
  <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')} className="text-muted-foreground">
    <ArrowLeft className="w-6 h-6" />
  </button>
  <h1 className="text-2xl font-black text-foreground tracking-wider flex-1">
    SETTINGS
  </h1>
  <button 
    onClick={handleSignOut}
    disabled={isSigningOut}
    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
    title="Sign Out"
  >
    <LogOut className="w-5 h-5" />
  </button>
</header>
```

**2. Remove the sign out card section** (lines 136-146)
Delete the entire card-workout div containing the sign out button.

---

## Visual Result

**Before:**
```
[←] SETTINGS
─────────────────
[Sound Alerts Card]
─────────────────
[    Sign Out    ]  ← Large button in card
─────────────────
v1.0
```

**After:**
```
[←] SETTINGS           [⎋]  ← Compact icon button
─────────────────────────
[Sound Alerts Card]
─────────────────────────
v1.0
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/Settings.tsx` | Add LogOut button to header, remove sign out card |

