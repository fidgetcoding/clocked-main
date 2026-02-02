

# Voice Announcements & Journal Entry - Analysis and Implementation Plan

## Current State

### What's Already Working
- **Post-Workout Journal**: When you complete a workout, there's a screen where you can add notes about how it went and rate the difficulty. This gets saved to your workout history.
- **3-Second Countdown Voice**: Code exists to announce "3, 2, 1" when there are 3 seconds left in a segment

### What's Missing
1. **Voice for workout phases** - No announcement of what's coming next (combo drills, rest periods, or reading the combo punches aloud)
2. **10-second warning voice** - No voice tells you "10 seconds left"
3. **Voice may not be triggering** - The current 3-second countdown might fail silently if the browser blocks speech or if there's no user interaction first

---

## Implementation Plan

### 1. Fix Voice Reliability
Add proper initialization and error handling for the Web Speech API:
- Initialize speech synthesis after user taps "Start"
- Add fallback handling if speech is unavailable
- Ensure voices are loaded before attempting to speak

### 2. Add 10-Second Warning Voice
When `timeRemaining === 10`, announce "10 seconds" using the same speech system

### 3. Add Phase Announcement Voice
When transitioning to a new segment, announce:
- **For rest periods**: "Rest"
- **For combo drills**: Read the combo aloud (e.g., "1, 2, 3, 2")
- **For shadowboxing**: "Shadowboxing" or "Freestyle"
- **For warmup/cooldown segments**: Announce the segment name

### 4. Respect User Preferences
Connect the existing Settings toggles to control these features:
- `voiceAnnouncements` - Master toggle for all voice
- `voiceCountdown` - 10-second and 3-second countdown
- `voiceComboCallouts` - Combo punch announcements

---

## Technical Details

### Files to Modify
- `src/pages/WorkoutSession.tsx` - Add voice announcement logic

### Voice Announcement Triggers
| Time/Event | What to Say | Preference Key |
|------------|-------------|----------------|
| Segment start | Phase name + combo (if applicable) | `voiceAnnouncements` |
| 10 seconds left | "10 seconds" | `voiceCountdown` |
| 3 seconds left | "3, 2, 1" | `voiceCountdown` |
| Combo segment start | Read combo aloud | `voiceComboCallouts` |

### Speech Helper Function
Create a helper that:
- Checks if speech synthesis is available
- Queues announcements properly
- Handles errors gracefully
- Uses consistent voice settings (rate, pitch)

### Example Implementation
```typescript
// Helper to speak text
const speak = (text: string) => {
  if ('speechSynthesis' in window && preferences?.voiceAnnouncements !== false) {
    speechSynthesis.cancel(); // Clear queue
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  }
};

// On segment transition
useEffect(() => {
  if (!isPreparation && currentSegment && isRunning) {
    const announcement = currentSegment.type === 'rest' 
      ? 'Rest' 
      : currentSegment.name;
    speak(announcement);
    
    // If it's a combo, also read the punches
    if (displayCombo && preferences?.voiceComboCallouts !== false) {
      setTimeout(() => speak(displayCombo.join(', ')), 1500);
    }
  }
}, [currentSegmentIndex]);

// 10-second warning
useEffect(() => {
  if (timeRemaining === 10 && isRunning && !isPaused) {
    if (preferences?.voiceCountdown !== false) {
      speak('10 seconds');
    }
  }
}, [timeRemaining]);
```

---

## Summary

**Journal entry exists** - it's on the workout completion screen where you can add notes

**Voice features need work:**
1. Add 10-second warning voice
2. Add phase/combo announcement voice
3. Fix reliability of existing 3-second countdown
4. Connect to Settings preferences

