import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, User, Users, Dumbbell, Target, Home as HomeIcon, Swords, Trophy, Check, Lock, Globe, GraduationCap, ClipboardList, Users2, TrendingUp, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { experienceLevelToPrestige } from '@/lib/xpSystem';
import { cn } from '@/lib/utils';
import clockedLogo from '@/assets/clocked-logo.png';

type Step = 'welcome' | 'role' | 'name' | 'experience' | 'equipment' | 'fightClub' | 'goals' | 'complete';

const experienceLevels = [
  { id: 'complete_beginner', label: 'Rookie', desc: 'Never trained combat sports' },
  { id: 'beginner', label: 'Beginner', desc: 'Some basic training experience' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Regular training for 1+ years' },
  { id: 'advanced', label: 'Advanced', desc: 'Competitive experience' },
  { id: 'pro', label: 'Pro', desc: 'Professional fighter' },
] as const;

const equipmentOptions = [
  { id: 'gloves', label: 'Boxing Gloves', icon: '🧤' },
  { id: 'wraps', label: 'Hand Wraps', icon: '🩹' },
  { id: 'heavyBag', label: 'Heavy Bag', icon: '🎯' },
  { id: 'speedBag', label: 'Speed Bag', icon: '💨' },
  { id: 'doubleEndBag', label: 'Double End Bag', icon: '🔴' },
  { id: 'jumpRope', label: 'Jump Rope', icon: '🪢' },
  { id: 'weights', label: 'Weights', icon: '🏋️' },
];

// Fighter goals
const fighterGoalOptions = [
  { id: 'learn_boxing', label: 'Learn Boxing', icon: Swords },
  { id: 'get_fit', label: 'Get Fit', icon: Dumbbell },
  { id: 'competition', label: 'Compete', icon: Trophy },
  { id: 'home_workout', label: 'Home Workouts', icon: HomeIcon },
  { id: 'supplement_training', label: 'Supplement Training', icon: Target },
];

// Coach goals
const coachGoalOptions = [
  { id: 'organize_team', label: 'Organize My Team', icon: ClipboardList },
  { id: 'improve_athletes', label: 'Improve Athlete Skills', icon: TrendingUp },
  { id: 'track_progress', label: 'Track Progress', icon: Target },
  { id: 'build_programs', label: 'Build Training Programs', icon: GraduationCap },
  { id: 'grow_roster', label: 'Grow My Roster', icon: Users2 },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { completeOnboarding } = useUserStore();
  const { profile, updateProfile, setInitialPrestige } = useProfile();
  const { loadCompleteBeginnerPresets, loadBeginnerPresets, loadIntermediatePresets, loadAdvancedPresets, loadProPresets } = useWorkoutStore();
  
  // If user just signed up (has ?continue=true), skip welcome and go to role selection
  const shouldContinue = searchParams.get('continue') === 'true';
  const [step, setStep] = useState<Step>(shouldContinue && user ? 'role' : 'welcome');
  const [role, setRole] = useState<'fighter' | 'coach'>('fighter');
  const [name, setName] = useState('');
  const [experience, setExperience] = useState<string>('beginner');
  const [equipment, setEquipment] = useState<Record<string, boolean>>({});
  const [goals, setGoals] = useState<string[]>([]);
  
  // Coach-specific state
  const [fightClubName, setFightClubName] = useState('');
  const [fightClubType, setFightClubType] = useState<'private' | 'public'>('private');
  const [athleteCount, setAthleteCount] = useState('');

  // If user is logged in and we have continue param, start at role selection
  useEffect(() => {
    if (shouldContinue && user && step === 'welcome') {
      setStep('role');
    }
  }, [shouldContinue, user, step]);

  const handleNext = (selectedRole?: 'fighter' | 'coach') => {
    const roleToUse = selectedRole || role;
    // Coaches skip equipment (they have all), but get fightClub step
    const steps: Step[] = roleToUse === 'coach'
      ? ['welcome', 'role', 'name', 'fightClub', 'goals', 'complete']
      : ['welcome', 'role', 'name', 'experience', 'equipment', 'goals', 'complete'];
    
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleComplete = async () => {
    // Coaches are automatically pro level and have all equipment
    const finalExperience = role === 'coach' ? 'pro' : experience;
    const finalEquipment = role === 'coach' 
      ? { gloves: true, wraps: true, heavyBag: true, speedBag: true, doubleEndBag: true, jumpRope: true, weights: true }
      : equipment;
    
    // Get prestige from experience level
    const prestige = experienceLevelToPrestige(finalExperience);
    
    // Update profile in database with prestige and other onboarding data
    try {
      await updateProfile.mutateAsync({
        name: name || (role === 'coach' ? 'Coach' : 'Fighter'),
        role,
        experience_level: finalExperience,
        equipment: finalEquipment,
        goals: goals,
        prestige,
        current_level: 1,
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
    
    // Also update local store for immediate UI feedback
    completeOnboarding({
      role,
      name: name || (role === 'coach' ? 'Coach' : 'Fighter'),
      experienceLevel: finalExperience as any,
      equipment: finalEquipment as any,
      goals: goals as any,
    });
    
    // Load appropriate presets based on experience level
    if (finalExperience === 'complete_beginner') {
      loadCompleteBeginnerPresets();
    } else if (finalExperience === 'beginner') {
      loadBeginnerPresets();
      loadIntermediatePresets();
    } else if (finalExperience === 'advanced') {
      loadAdvancedPresets();
    } else if (finalExperience === 'pro') {
      loadProPresets();
    }
    
    navigate('/');
  };

  const toggleEquipment = (id: string) => {
    setEquipment(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleGoal = (id: string) => {
    setGoals(prev => 
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const goalOptions = role === 'coach' ? coachGoalOptions : fighterGoalOptions;
  
  // Get step count for progress dots
  const getSteps = () => {
    return role === 'coach'
      ? ['role', 'name', 'fightClub', 'goals']
      : ['role', 'name', 'experience', 'equipment', 'goals'];
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Progress dots */}
      {step !== 'welcome' && step !== 'complete' && (
        <div className="flex justify-center gap-2 pt-8 pb-4">
          {getSteps().map((s, i, arr) => (
            <div
              key={s}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                step === s ? 'bg-volt' : 
                arr.indexOf(step) > i ? 'bg-volt/50' : 'bg-surface-3'
              )}
            />
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center animate-fade-in">
            <img 
              src={clockedLogo} 
              alt="Clocked Logo" 
              className="w-[26rem] h-[26rem] mx-auto object-contain -mb-32"
            />
            <p className="text-lg text-muted-foreground mb-8">
              Knockout Intelligence.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Button 
                onClick={() => navigate('/auth?mode=signup')} 
                className="btn-primary-glow w-40 py-2 h-auto text-sm"
              >
                GET STARTED
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                onClick={() => navigate('/auth?mode=login')} 
                variant="outline"
                className="w-40 py-2 h-auto text-sm bg-surface-1 border-surface-3 hover:bg-surface-2"
              >
                LOGIN
                <LogIn className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Role Selection */}
        {step === 'role' && (
          <div className="w-full max-w-md animate-fade-in">
            <h2 className="text-2xl font-black text-foreground text-center mb-2">
              Who are you?
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              This helps us personalize your experience
            </p>

            <div className="space-y-4">
              <button
                onClick={() => { setRole('fighter'); handleNext('fighter'); }}
                className={cn(
                  'w-full p-6 rounded-2xl border-2 text-left transition-all',
                  role === 'fighter' 
                    ? 'border-volt bg-volt/10' 
                    : 'border-surface-3 bg-surface-1 hover:border-surface-2'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-volt/20 flex items-center justify-center">
                    <User className="w-7 h-7 text-volt" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">I'M A FIGHTER</h3>
                    <p className="text-sm text-muted-foreground">Training solo or with a coach</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setRole('coach'); handleNext('coach'); }}
                className={cn(
                  'w-full p-6 rounded-2xl border-2 text-left transition-all',
                  role === 'coach' 
                    ? 'border-volt bg-volt/10' 
                    : 'border-surface-3 bg-surface-1 hover:border-surface-2'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-volt/20 flex items-center justify-center">
                    <Users className="w-7 h-7 text-volt" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">I'M A COACH</h3>
                    <p className="text-sm text-muted-foreground">Train fighters, create programs</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Name */}
        {step === 'name' && (
          <div className="w-full max-w-md animate-fade-in">
            <h2 className="text-2xl font-black text-foreground text-center mb-2">
              What should we call you?
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              Enter your name or nickname
            </p>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-14 text-lg bg-surface-1 border-surface-3 text-center mb-6"
              autoFocus
            />

            <Button onClick={() => handleNext()} className="btn-primary-glow w-full h-14 text-lg">
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Experience (fighters only) */}
        {step === 'experience' && (
          <div className="w-full max-w-md animate-fade-in">
            <h2 className="text-2xl font-black text-foreground text-center mb-2">
              Experience Level
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              How much combat sports experience do you have?
            </p>

            <div className="space-y-3 mb-6">
              {experienceLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setExperience(level.id)}
                  className={cn(
                    'w-full p-4 rounded-xl border text-left transition-all',
                    experience === level.id 
                      ? 'border-volt bg-volt/10' 
                      : 'border-surface-3 bg-surface-1'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{level.label}</h3>
                      <p className="text-sm text-muted-foreground">{level.desc}</p>
                    </div>
                    {experience === level.id && (
                      <Check className="w-5 h-5 text-volt" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <Button onClick={() => handleNext()} className="btn-primary-glow w-full h-14 text-lg">
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Equipment (fighters only) */}
        {step === 'equipment' && (
          <div className="w-full max-w-md animate-fade-in">
            <h2 className="text-2xl font-black text-foreground text-center mb-2">
              Your Equipment
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              What equipment do you have access to?
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {equipmentOptions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleEquipment(item.id)}
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all',
                    equipment[item.id] 
                      ? 'border-volt bg-volt/10' 
                      : 'border-surface-3 bg-surface-1'
                  )}
                >
                  <span className="text-2xl mb-2 block">{item.icon}</span>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </button>
              ))}
            </div>

            <Button onClick={() => handleNext()} className="btn-primary-glow w-full h-14 text-lg">
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Fight Club Setup (coaches only) */}
        {step === 'fightClub' && (
          <div className="w-full max-w-md animate-fade-in">
            <h2 className="text-2xl font-black text-foreground text-center mb-2">
              Set Up Your Fight Club
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              Create a space for your athletes to train together
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Fight Club Name
                </label>
                <Input
                  value={fightClubName}
                  onChange={(e) => setFightClubName(e.target.value)}
                  placeholder="e.g. Iron Fist Boxing"
                  className="h-12 bg-surface-1 border-surface-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Number of Athletes
                </label>
                <Input
                  type="number"
                  value={athleteCount}
                  onChange={(e) => setAthleteCount(e.target.value)}
                  placeholder="How many fighters on your roster?"
                  className="h-12 bg-surface-1 border-surface-3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Visibility
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFightClubType('private')}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      fightClubType === 'private' 
                        ? 'border-volt bg-volt/10' 
                        : 'border-surface-3 bg-surface-1'
                    )}
                  >
                    <Lock className="w-5 h-5 text-volt mb-2" />
                    <h3 className="font-semibold text-foreground text-sm">Private</h3>
                    <p className="text-xs text-muted-foreground">Invite only</p>
                  </button>
                  <button
                    onClick={() => setFightClubType('public')}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      fightClubType === 'public' 
                        ? 'border-volt bg-volt/10' 
                        : 'border-surface-3 bg-surface-1'
                    )}
                  >
                    <Globe className="w-5 h-5 text-volt mb-2" />
                    <h3 className="font-semibold text-foreground text-sm">Public</h3>
                    <p className="text-xs text-muted-foreground">Anyone can join</p>
                  </button>
                </div>
              </div>
            </div>

            <Button onClick={() => handleNext()} className="btn-primary-glow w-full h-14 text-lg">
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            
            <button 
              onClick={() => handleNext()} 
              className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Goals */}
        {step === 'goals' && (
          <div className="w-full max-w-md animate-fade-in">
            <h2 className="text-2xl font-black text-foreground text-center mb-2">
              {role === 'coach' ? 'Your Coaching Goals' : 'Your Goals'}
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              {role === 'coach' ? 'What do you want to achieve with your team?' : 'What do you want to achieve?'}
            </p>

            <div className="space-y-3 mb-6">
              {goalOptions.map((goal) => {
                const Icon = goal.icon;
                return (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    className={cn(
                      'w-full p-4 rounded-xl border text-left transition-all',
                      goals.includes(goal.id) 
                        ? 'border-volt bg-volt/10' 
                        : 'border-surface-3 bg-surface-1'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-volt" />
                        <span className="font-semibold text-foreground">{goal.label}</span>
                      </div>
                      {goals.includes(goal.id) && (
                        <Check className="w-5 h-5 text-volt" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <Button onClick={() => setStep('complete')} className="btn-primary-glow w-full h-14 text-lg">
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <div className="text-center animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-volt/20 flex items-center justify-center mx-auto mb-8">
              <Check className="w-12 h-12 text-volt" />
            </div>
            <h2 className="text-3xl font-black text-foreground mb-2">
              You're All Set!
            </h2>
            <p className="text-muted-foreground mb-8 max-w-sm">
              {role === 'coach' 
                ? "Your Fight Club is ready. Start building workouts for your athletes."
                : (experience === 'complete_beginner' || experience === 'beginner') 
                  ? "We've loaded 3 beginner workouts to get you started."
                  : "Time to build your first workout and get training."
              }
            </p>
            <Button onClick={handleComplete} className="btn-primary-glow w-full max-w-xs h-14 text-lg">
              {role === 'coach' ? "LET'S WORK" : 'START TRAINING'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
