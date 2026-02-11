

# Switch Body Metrics to American Defaults with ft/in Height

## Current State
- Default unit is metric (kg/cm), with a toggle to switch to imperial (lbs/in)
- Height in imperial mode shows inches only (e.g., "68 in") instead of feet + inches

## Changes

### File: `src/pages/EditProfile.tsx`

**1. Default to imperial (American units)**
- Change `useState(false)` to `useState(true)` for `useImperial`
- Update the `useEffect` that initializes values so it converts from stored metric to imperial by default

**2. Split height into feet + inches in imperial mode**
- Replace the single height input with two inputs (ft and in) when imperial is selected
- Show a single cm input when metric is selected
- Store internally in cm (no database changes needed)
- Conversion: `totalInches = (feet * 12) + inches`, then `cm = totalInches * 2.54`

**3. Update toggle label**
- Default (imperial) shows: "Switch to kg/cm"
- Toggled (metric) shows: "Switch to lbs/ft"

**4. Update the unit conversion on toggle**
- When toggling from imperial to metric: convert lbs to kg, ft/in to cm
- When toggling from metric to imperial: convert kg to lbs, cm to ft/in

### State changes
- Replace single `heightInput` string with `heightFt` and `heightIn` strings for imperial mode, keeping `heightInput` for cm mode
- Add a conversion helper that handles ft/in to cm and back

### No database or backend changes needed
Weight and height remain stored in kg and cm internally.

## Technical Details

### New state variables
- `heightFt` (string) -- feet portion in imperial mode
- `heightIn` (string) -- inches portion in imperial mode
- `useImperial` default changes from `false` to `true`

### Conversion logic
- lbs to kg: `val / 2.20462`
- kg to lbs: `val * 2.20462`
- ft/in to cm: `((ft * 12) + in) * 2.54`
- cm to ft/in: `totalInches = cm / 2.54`, `ft = floor(totalInches / 12)`, `in = round(totalInches % 12)`

### onBlur save for height (imperial)
When either ft or in field blurs, compute total cm from both fields and save to profile.

