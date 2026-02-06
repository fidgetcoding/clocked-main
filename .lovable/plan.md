
# Remove Unused Haptic Feedback Code

## Summary
Clean up all haptic-related code since it's not being used anywhere in the app.

---

## Files to Modify

### 1. Delete File
**`src/hooks/useHaptics.ts`** - Remove entirely (unused hook)

### 2. Clean Up Type Definitions
**`src/types/index.ts`**
Remove from `preferences`:
- `hapticEnabled: boolean`
- `hapticRoundChange?: boolean`
- `hapticWarning?: boolean`

### 3. Clean Up Default Values
**`src/stores/userStore.ts`**
Remove from default preferences:
- `hapticEnabled: true`

**`src/hooks/useProfile.ts`**
Remove from default preferences:
- `hapticEnabled: true`

---

## Summary Table

| File | Action |
|------|--------|
| `src/hooks/useHaptics.ts` | Delete file |
| `src/types/index.ts` | Remove haptic preference fields |
| `src/stores/userStore.ts` | Remove `hapticEnabled` default |
| `src/hooks/useProfile.ts` | Remove `hapticEnabled` default |

---

## Result
- No more dead haptic code
- Cleaner codebase
- Can always re-add haptics later when/if needed
