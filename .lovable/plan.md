
# Workout Session Confirmation Dialogs & XP Protection

## Overview
Add confirmation prompts before discarding workout progress, and ensure XP is always awarded even if the user quits without manually logging the workout.

## Changes

### 1. Add Confirmation Dialog Component
Use the existing Alert Dialog from Radix UI to create confirmation prompts for destructive actions.

### 2. Modify Home Button Behavior
- Instead of immediately navigating home, show a confirmation dialog
- Dialog asks: "Leave workout? Your progress will be saved and XP will be awarded."
- If confirmed: Award XP, then navigate home
- If cancelled: Stay in workout

### 3. Modify Restart Button Behavior  
- Instead of immediately resetting, show a confirmation dialog
- Dialog asks: "Restart workout? This will reset your progress."
- If confirmed: Award current XP (since they did work), then reset timer to beginning
- If cancelled: Stay in current position

### 4. XP Protection on Exit
When user confirms leaving or restarting:
- Award any accumulated XP to their profile
- Log the partial workout to history (optional - can be a simpler "quit" entry)

---

## Technical Implementation

### File: `src/pages/WorkoutSession.tsx`

**New State Variables:**
- `showExitConfirm` - boolean to control exit confirmation dialog
- `showRestartConfirm` - boolean to control restart confirmation dialog

**New Handler Functions:**

```text
handleConfirmExit()
- Award accumulated XP if > 0 and not already awarded
- Navigate to home

handleConfirmRestart()  
- Award accumulated XP if > 0 and not already awarded
- Reset workout state (existing handleReset logic)
- Reset XP tracking for new attempt
```

**UI Changes:**
- Home button: Opens exit confirmation dialog instead of navigating directly
- Restart button: Opens restart confirmation dialog instead of resetting directly
- Add two AlertDialog components for the confirmation prompts

### Dialog Content

**Exit Dialog:**
- Title: "Leave Workout?"
- Description: Shows XP earned so far that will be saved
- Actions: "Cancel" (stay) / "Leave & Save XP" (confirm)

**Restart Dialog:**
- Title: "Restart Workout?"
- Description: Notes that current progress will be saved before restarting
- Actions: "Cancel" (stay) / "Restart" (confirm)

---

## User Flow After Changes

1. **User clicks Home during workout:**
   - Confirmation dialog appears
   - Cancel → returns to workout
   - Confirm → XP awarded, navigates home

2. **User clicks Restart during workout:**
   - Confirmation dialog appears  
   - Cancel → returns to workout
   - Confirm → XP awarded, workout resets to beginning

3. **User completes workout normally:**
   - No change - continues to work as before with journal screen

4. **User clicks Complete Early:**
   - No change - works as before, awards XP and shows journal
