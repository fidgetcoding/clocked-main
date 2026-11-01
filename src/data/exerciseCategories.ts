export const EXERCISE_CATEGORIES = {
  'Warmup / Cooldown': [
    'Jump Rope', 'Dynamic Stretches', 'Static Stretching', 'Arm Circles',
    'Leg Swings', 'Hip Circles', 'Torso Twists', 'Light Jogging',
    'Foam Rolling', 'Deep Breathing', 'Cool Down Walk', 'Light Stretching',
  ],
  Core: [
    'Sit-Ups', 'Crunches', 'Plank Hold', 'Side Plank', 'Leg Raises',
    'Flutter Kicks', 'Bicycle Crunches', 'V-Ups', 'Russian Twists',
    'Dead Bugs', 'Shoulder Taps',
  ],
  'Lower Body': [
    'Squats', 'Lunges', 'Squat Jumps', 'Jumping Lunges', 'Box Jumps',
    'Step-Ups', 'Calf Raises', 'Wall Sit', 'Glute Bridges', 'Skaters',
    'Lateral Shuffles',
  ],
  'Upper Body': ['Push-Ups', 'Dips', 'Pull-Ups'],
  'Full Body': [
    'Burpees', 'Mountain Climbers', 'Tuck Jumps', 'Star Jumps',
    'Bear Crawls', 'Inchworms', 'Bird Dogs', 'Kettlebell Swings',
    'Med Ball Slams', 'Battle Ropes', 'Sled Push',
  ],
  Cardio: ['Jumping Jacks', 'High Knees', 'Butt Kicks', 'Rowing Sprints'],
} as const;

// All built-in exercise names for checking if something is "custom"
const ALL_BUILTIN_EXERCISES = new Set(
  Object.values(EXERCISE_CATEGORIES).flat().map(n => n.toLowerCase())
);

export function isBuiltinExercise(name: string): boolean {
  return ALL_BUILTIN_EXERCISES.has(name.toLowerCase());
}
