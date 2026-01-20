import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, User, Users, Dumbbell, Target, Home as HomeIcon, Swords, Trophy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { cn } from '@/lib/utils';

type Step = 'welcome' | 'role' | 'name' | 'experience' | 'equipment' | 'goals' | 'complete';

const experienceLevels = [
  { id: 'complete_beginner', label: 'Complete Beginner', desc: 'Never trained combat sports' },
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
  { id: 'jumpRope', label: 'Jump Rope', icon: '🪢' },
  { id: 'weights', label: 'Weights', icon: '🏋️' },
];

const goalOptions = [
  { id: 'learn_boxing', label: 'Learn Boxing', icon: Swords },
  { id: 'get_fit', label: 'Get Fit', icon: Dumbbell },
  { id: 'competition', label: 'Compete', icon: Trophy },
  { id: 'home_workout', label: 'Home Workouts', icon: HomeIcon },
  { id: 'supplement_training', label: 'Supplement Training', icon: Target },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { completeOnboarding } = useUserStore();
  const { loadBeginnerPresets } = useWorkoutStore();
  
  const [step, setStep] = useState<Step>('welcome');
  const [role, setRole] = useState<'fighter' | 'coach'>('fighter');
  const [name, setName] = useState('');
  const [experience, setExperience] = useState<string>('beginner');
  const [equipment, setEquipment] = useState<Record<string, boolean>>({});
  const [goals, setGoals] = useState<string[]>([]);

  const handleNext = (selectedRole?: 'fighter' | 'coach') => {
    // If coach is selected, skip experience step (coaches are pro level)
    const roleToUse = selectedRole || role;
    const steps: Step[] = roleToUse === 'coach'
      ? ['welcome', 'role', 'name', 'equipment', 'goals', 'complete']
      : ['welcome', 'role', 'name', 'experience', 'equipment', 'goals', 'complete'];
    
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleComplete = () => {
    // Coaches are automatically pro level
    const finalExperience = role === 'coach' ? 'pro' : experience;
    
    completeOnboarding({
      role,
      name: name || (role === 'coach' ? 'Coach' : 'Fighter'),
      experienceLevel: finalExperience as any,
      equipment: equipment as any,
      goals: goals as any,
    });
    
    // Load beginner presets if beginner
    if (finalExperience === 'complete_beginner' || finalExperience === 'beginner') {
      loadBeginnerPresets();
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress dots */}
      {step !== 'welcome' && step !== 'complete' && (
        <div className="flex justify-center gap-2 pt-8 pb-4">
          {(role === 'coach' 
            ? ['role', 'name', 'equipment', 'goals']
            : ['role', 'name', 'experience', 'equipment', 'goals']
          ).map((s, i, arr) => (
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

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-volt flex items-center justify-center mx-auto mb-8">
              <span className="text-5xl">⚡</span>
            </div>
            <h1 className="text-4xl font-black text-foreground tracking-tight mb-2">
              GET CLOCKED.
            </h1>
            <p className="text-lg text-muted-foreground mb-12">
              Your Corner. Always There.
            </p>
            <Button onClick={() => handleNext()} className="btn-primary-glow w-full max-w-xs h-14 text-lg">
              LET'S GET STARTED
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
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

        {/* Experience */}
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

        {/* Equipment */}
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

        {/* Goals */}
        {step === 'goals' && (
          <div className="w-full max-w-md animate-fade-in">
            <h2 className="text-2xl font-black text-foreground text-center mb-2">
              Your Goals
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              What do you want to achieve?
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
              {(experience === 'complete_beginner' || experience === 'beginner') 
                ? "We've loaded 3 beginner workouts to get you started."
                : "Time to build your first workout and get training."}
            </p>
            <Button onClick={handleComplete} className="btn-primary-glow w-full max-w-xs h-14 text-lg">
              START TRAINING
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
