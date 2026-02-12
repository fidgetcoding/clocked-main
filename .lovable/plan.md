

## Speed Bag Drill Presets in Combo Builder + Dynamic Labels

### Problem
1. When you click "Add" under the combos section for a **speed bag** segment, the modal shows punch combo presets (Jab Cross, Triple Jab, etc.) instead of the speed bag drill library (Singles, Doubles, Fist Rolls, etc.)
2. The label "Combos (N)" and the empty state text "No combos -- segments will be freestyle" don't change based on the segment type. Speed bag segments should say "Drills" instead of "Combos"

### Solution

#### 1. Track which segment type triggered the combo builder

When the "Add" button is clicked, we already track `editingPhaseId`. We need to also determine the **dominant combo-capable segment type** in that phase (speed bag vs punch combo bags). Add a piece of state like `editingSegmentContext` that gets set to `'speedbag'` or `'combo'` when the modal opens.

The logic: look at the combo-capable segments in the phase. If any segment is `speedbag`, set context to `'speedbag'`. Otherwise, it's standard combo mode.

#### 2. Show speed bag drills in the Presets tab

When `editingSegmentContext === 'speedbag'`:
- The modal title changes from "Add Combo" to "Add Drill"
- The "Presets" tab shows the `SPEED_BAG_DRILLS` array from `speedBagDrills.ts` instead of `comboPresets`
- Each drill card shows the drill name and description
- Clicking a drill adds its `id` (or a formatted drill token like the drill name) to the phase combos array
- The "Custom" tab hides or shows speed-bag-appropriate input (or is hidden entirely since speed bag drills are predefined patterns, not buildable sequences)

#### 3. Dynamic labels in the phase combo section

The inline section under each phase needs context-aware labels:
- **Speed bag segments**: "Drills (N)" instead of "Combos (N)", empty state says "No drills -- segments will be freestyle"
- **Heavy bag / Double end / Shadowboxing**: Keep current "Combos (N)" and "No combos -- segments will be freestyle"

#### Files to modify

- **`src/pages/Build.tsx`** -- All changes are here:
  - Add state for segment context tracking
  - Set context when "Add" / "Edit" buttons are clicked
  - Conditionally render speed bag drills vs punch combo presets in the modal
  - Update the "Combos" label and empty state text based on segment types in the phase

### Technical Details

```text
State addition:
  editingSegmentContext: 'speedbag' | 'combo' (default: 'combo')

Detection logic (when "Add" clicked):
  Look at phase.segments for any with segmentType === 'speedbag'
  If found -> set context to 'speedbag'
  Otherwise -> 'combo'

Speed bag preset items:
  Import SPEED_BAG_DRILLS from '@/data/speedBagDrills'
  Each drill becomes a selectable preset
  When selected, add [drill.name] as a single-element combo array
  e.g., clicking "Doubles" adds ["Doubles"] to phase.combos

Label mapping:
  speedbag context:
    - Section header: "Drills (N)"
    - Add button: "Add"
    - Empty state: "No drills -- segments will be freestyle"
    - Modal title: "Add Drill" / "Edit Drill"
    - Preset header: "SPEED BAG DRILLS"
  
  combo context:
    - Section header: "Combos (N)"  (unchanged)
    - Modal title: "Add Combo" / "Edit Combo"  (unchanged)
    - Preset header: "{DIFFICULTY} PRESETS"  (unchanged)

Custom tab for speed bag:
  Hide the punch/defense/movement key grids
  Show a simple text input or hide Custom entirely
  (speed bag drills are named patterns, not buildable number sequences)
```
