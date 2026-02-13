// User Profile Types
export interface UserProfile {
  id: string;
  createdAt: Date;
  onboardingComplete: boolean;
  role: 'fighter' | 'coach';
  name: string;
  
  // Fighter fields
  experienceLevel?: 'complete_beginner' | 'beginner' | 'intermediate' | 'advanced' | 'pro';
  knowledge?: {
    handWrapping: boolean;
    numberedPunches: boolean;
    heavyBagExperience: boolean;
  };
  equipment?: {
    gloves: boolean;
    wraps: boolean;
    heavyBag: boolean;
    speedBag: boolean;
    doubleEndBag: boolean;
    jumpRope: boolean;
    treadmill: boolean;
    primaryBag?: 'heavy' | 'double_end' | 'none';
  };
  goals?: Array<'learn_boxing' | 'get_fit' | 'competition' | 'home_workout' | 'supplement_training'>;
  
  // Coach fields
  coachInfo?: {
    gymName: string;
    location?: string;
    disciplines: string[];
  };
  
  // Social
  coachId?: string;
  fighterIds?: string[];
  fightClubIds?: string[];
  
  // Activity Status
  isActive: boolean;
  isInWorkout: boolean;
  currentWorkoutName?: string;
  lastActiveAt: Date;
  
  // Stats
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  workoutsCompleted: number;
  prestige?: 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro';
  currentLevel?: number;
  
  preferences: {
    voiceType: 'male' | 'female' | 'system';
    soundEnabled: boolean;
    // Sound alerts
    voiceAnnouncements?: boolean;
    voiceCountdown?: boolean;
    voiceComboCallouts?: boolean;
    tenSecondWarning?: boolean;
  };
}

// Workout Types
export type SegmentType = 'work' | 'rest' | 'shadowboxing' | 'combo' | 'speedbag' | 'doubleend' | 'exercise' | 'sparring';

// Activity type for AI-generated segments
export type ActivityType = 'combos' | 'shadowbox' | 'run' | 'pushups' | 'custom';

// Phase type for AI-generated phases
export type PhaseType = 'continuous' | 'circuit' | 'rest';

export interface WorkoutSegment {
  id: string;
  name: string;
  type: 'active' | 'rest';
  segmentType?: SegmentType; // More specific type
  duration: number; // in seconds
  intensity?: string;
  reps?: number;
  comboIndex?: number | 'cycle';
  combo?: string[];
  // NEW: AI-generated workout support
  exercise?: string;           // Custom exercise name (e.g., "Burpees")
  activityType?: ActivityType; // Activity classification
}

export interface WorkoutPhase {
  id: string;
  name: string;
  repeats: number;
  section?: 'warmup' | 'grind' | 'cooldown';
  segments: WorkoutSegment[];
  // NEW: Phase type hint for display/logic
  phaseType?: PhaseType;
  // Combo order: 'sequential' plays combos in list order, 'random' shuffles them
  comboOrder?: 'sequential' | 'random';
  // Per-phase combos (takes priority over workout-level combos)
  combos?: string[][];
}

export interface WorkoutSection {
  warmup: WorkoutPhase[];
  grind: WorkoutPhase[];
  cooldown: WorkoutPhase[];
}

export interface Workout {
  id: string;
  name: string;
  icon: string;
  difficulty: 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro';
  totalDuration: number; // in seconds
  isPreset: boolean;
  isArchived: boolean;
  createdAt: Date;
  lastUsed?: Date;
  timesCompleted: number;
  sections: WorkoutSection;
  combos?: string[][];
  // NEW: AI-generated workout support
  megasetRepeats?: number;  // Repeat entire ROUNDS block X times (default 1)
  tags?: string[];           // Auto-generated tags (boxing, hiit, strength, etc.)
}

// Workout Log Types
export interface RoundFeedback {
  roundNumber: number;
  rating: number; // 1-5
  notes?: string;
}

export interface CompletedWorkout {
  id: string;
  workoutId?: string;
  workoutName: string;
  completedAt: Date;
  duration: number; // in seconds
  xpEarned: number;
  difficulty?: 'too_easy' | 'just_right' | 'too_hard';
  notes?: string;
  roundFeedback?: RoundFeedback[];
  isManualEntry: boolean;
}

// Timer Types
export interface QuickTimerSettings {
  roundTime: number; // in seconds
  restTime: number; // in seconds
  rounds: number;
  warningTime: number; // in seconds
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentRound: number;
  totalRounds: number;
  isRestPeriod: boolean;
  timeRemaining: number;
  totalElapsed: number;
}

// Gamification Types
export type Rank = 
  | 'regional'
  | 'amateur'
  | 'semi_pro'
  | 'pro_circuit'
  | 'ranked'
  | 'top_15'
  | 'top_10'
  | 'top_5'
  | 'contender'
  | 'champion'
  | 'undisputed'
  | 'goat';

export const RANK_THRESHOLDS: Record<Rank, number> = {
  regional: 0,
  amateur: 500,
  semi_pro: 1500,
  pro_circuit: 3500,
  ranked: 7000,
  top_15: 12000,
  top_10: 20000,
  top_5: 35000,
  contender: 55000,
  champion: 80000,
  undisputed: 120000,
  goat: 200000,
};

export const RANK_NAMES: Record<Rank, string> = {
  regional: 'Regional',
  amateur: 'Amateur',
  semi_pro: 'Semi-Pro',
  pro_circuit: 'Pro Circuit',
  ranked: 'Ranked',
  top_15: 'Top 15',
  top_10: 'Top 10',
  top_5: 'Top 5',
  contender: 'Contender',
  champion: 'Champion',
  undisputed: 'Undisputed',
  goat: 'G.O.A.T.',
};

// Community Types
export interface FightClub {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'public' | 'private';
  coachId?: string;
  memberIds: string[];
  memberCount: number;
  activeNow: number;
  inviteCode?: string;
  settings: {
    allowChat: boolean;
    showLeaderboard: boolean;
    requireApproval: boolean;
  };
}

export interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userStatus: 'live' | 'active' | 'recent' | 'offline';
  type: 'workout_complete' | 'currently_training' | 'rank_up' | 'preset_shared' | 'streak_milestone';
  content: {
    workoutName?: string;
    xpEarned?: number;
    elapsedTime?: number;
    newRank?: string;
    presetId?: string;
    streakDays?: number;
    message?: string;
  };
  createdAt: Date;
  likes: number;
  comments: number;
}

export interface SharedPreset {
  id: string;
  workoutId: string;
  creatorId: string;
  creatorUsername: string;
  isVerified: boolean;
  name: string;
  description: string;
  tags: string[];
  difficulty: 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro';
  duration: number;
  downloads: number;
  rating: number;
  ratingCount: number;
}
