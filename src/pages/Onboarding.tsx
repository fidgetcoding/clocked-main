import type { UserProfile } from '@/types';
import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BroadcastPage, FitText, Logo, Plate, SectionChyron, SegmentBar, Ticker, plateClass } from '@/components/broadcast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserStore } from '@/stores/userStore';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useAuth } from '@/contexts/useAuth';
import { hasFinishedOnboarding, useProfile } from '@/hooks/useProfile';
import { STANCE_OPTIONS } from '@/hooks/useStance';
import type { Stance } from '@/lib/punch/types';
import { experienceLevelToPrestige } from '@/lib/xpSystem';
import { generateLoadoutWorkout } from '@/lib/loadoutGenerator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Step = 'welcome' | 'role' | 'name' | 'stance' | 'experience' | 'equipment' | 'coachTools' | 'goals' | 'complete';

const experienceLevels = [
  { id: 'complete_beginner', label: 'Rookie', desc: 'Never trained combat sports' },
  { id: 'beginner', label: 'Beginner', desc: 'Some basic training experience' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Regular training for 1+ years' },
  { id: 'advanced', label: 'Advanced', desc: 'Competitive experience' },
  { id: 'pro', label: 'Pro', desc: 'Professional fighter' },
] as const;

// Equipment groups: essentials first, then bags, then cardio
const equipmentOptions = [
  { id: 'gloves', label: 'Boxing Gloves', group: 'essentials' },
  { id: 'wraps', label: 'Hand Wraps', group: 'essentials' },
  { id: 'heavyBag', label: 'Heavy Bag', group: 'bags' },
  { id: 'doubleEndBag', label: 'Double End Bag', group: 'bags' },
  { id: 'speedBag', label: 'Speed Bag', group: 'bags' },
  { id: 'jumpRope', label: 'Jump Rope', group: 'cardio' },
  { id: 'treadmill', label: 'Treadmill', group: 'cardio' },
];

// Fighter goals
const fighterGoalOptions = [
  { id: 'learn_boxing', label: 'Learn Boxing' },
  { id: 'get_fit', label: 'Get Fit' },
  { id: 'competition', label: 'Compete' },
  { id: 'home_workout', label: 'Home Workouts' },
  { id: 'supplement_training', label: 'Supplement Training' },
];

// Coach goals
const coachGoalOptions = [
  { id: 'organize_team', label: 'Organize My Team' },
  { id: 'improve_athletes', label: 'Improve Athlete Skills' },
  { id: 'track_progress', label: 'Track Progress' },
  { id: 'build_programs', label: 'Build Training Programs' },
  { id: 'grow_roster', label: 'Grow My Roster' },
];

// The welcome card: lime, cut by one true 14 degree slash
const welcomeSlash: CSSProperties = {
  background:
    'linear-gradient(104deg, hsl(var(--tech-black)) 0 12%, hsl(var(--electric-volt)) 12% 84%, hsl(var(--tech-black)) 84% 87%, hsl(var(--electric-volt)) 87% 89%, hsl(var(--tech-black)) 89%)',
};

// Test-pattern stripes behind a show that isn't made yet
const pilotStripes: CSSProperties = {
  background: 'repeating-linear-gradient(104deg, hsl(var(--surface-1)) 0 34px, hsl(var(--surface-2)) 34px 68px)',
};

/** The bottom of a step: the one way forward, then the crawl. */
const OnwardBar = ({ label, onClick, ticker }: { label: string; onClick: () => void; ticker: (string | false)[] }) => (
  <div className="sticky bottom-0 z-10 mt-4 bg-tech-black">
    <div className="px-5 py-3">
      <Button size="lg" className="w-full [@media(max-height:500px)]:h-12 [@media(max-height:500px)]:text-2xl" onClick={onClick}>
        {label}
      </Button>
    </div>
    <Ticker items={ticker} tone="dark" className="[@media(max-height:600px)]:hidden" />
  </div>
);

interface PreShowProps {
  show: string;
  segment: number;
  segments: number;
  title: ReactNode;
  sub: ReactNode;
  ticker?: (string | false)[];
  /** Leave out where picking a plate moves on by itself. */
  onNext?: () => void;
  children?: ReactNode;
}

/** One segment of the pre-show: the bug, how far along, the headline, then the graphics for this step. */
const PreShow = ({ show, segment, segments, title, sub, ticker = [], onNext, children }: PreShowProps) => (
  <BroadcastPage show={show} className="flex flex-col">
    <div className="px-4 pt-4">
      <div className="mb-1.5 flex justify-between">
        <span className="lab lab-lime">Pre-show</span>
        <span className="lab">Segment {segment} of {segments}</span>
      </div>
      <SegmentBar total={segments} filled={segment - 1} current={segment - 1} height="0.5rem" label={`Segment ${segment} of ${segments}`} />
    </div>
    <div className="animate-fade-in px-4 pt-5">
      <h2 className="fx text-[clamp(2.75rem,13vw,4.5rem)] [@media(max-height:500px)]:text-4xl">{title}</h2>
      <p className="prose-w mt-2 text-lg leading-snug">{sub}</p>
    </div>
    <div className="mt-4 flex-1">{children}</div>
    {onNext ? <OnwardBar label="Continue" onClick={onNext} ticker={ticker} /> : <div className="pb-6" />}
  </BroadcastPage>
);

/** A choice as a plate off the left edge. Lime means it's in. */
const ChoicePlate = ({ on, onClick, width, children }: { on: boolean; onClick: () => void; width: string; children: ReactNode }) => (
  <button
    type="button"
    aria-pressed={on}
    onClick={onClick}
    style={{ width }}
    className={cn(plateClass({ tone: on ? 'lime' : 'graphite', bleed: 'left' }), 'flex min-h-[3.75rem] justify-between gap-3 py-1.5 pl-4 pr-6 text-left')}
  >
    {children}
  </button>
);

/** Which foot leads, from above: the lead foot filled, the rear foot outlined. */
const StanceFeet = ({ leftLeads }: { leftLeads: boolean }) => (
  <svg viewBox="30 16 120 124" aria-hidden="true" className="size-24 shrink-0 [@media(max-height:500px)]:size-14">
    <g transform="skewX(-14) translate(36 0)">
      <rect x={leftLeads ? 32 : 84} y="22" width="30" height="62" fill="currentColor" />
      <rect x={leftLeads ? 84 : 32} y="72" width="30" height="62" fill="none" stroke="currentColor" strokeWidth="4" />
    </g>
  </svg>
);

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { completeOnboarding } = useUserStore();
  const { profile, isLoading: profileLoading, updateProfile, setInitialPrestige } = useProfile();
  // workoutStore preset methods removed — loadout generator handles everything
  const { addWorkout: addWorkoutToDb } = useWorkouts();
  
  // If user just signed up (has ?continue=true), skip welcome and go to role selection
  const shouldContinue = searchParams.get('continue') === 'true';
  const [step, setStep] = useState<Step>(shouldContinue && user ? 'role' : 'welcome');
  const [role, setRole] = useState<'fighter' | 'coach'>('fighter');
  const [name, setName] = useState('');
  const [stance, setStance] = useState<Stance>('orthodox');
  const [experience, setExperience] = useState<string>('beginner');
  const [equipment, setEquipment] = useState<Record<string, boolean>>({});
  const [primaryBag, setPrimaryBag] = useState<'heavy' | 'double_end' | 'none'>('none');
  const [goals, setGoals] = useState<string[]>([]);
  
  // If user is logged in and we have continue param, start at role selection
  useEffect(() => {
    if (shouldContinue && user && step === 'welcome') {
      setStep('role');
    }
  }, [shouldContinue, user, step]);

  // The email link lands every account here, new or returning. Returning accounts go
  // straight to the app so finishing onboarding can't reset their prestige and level.
  useEffect(() => {
    if (user && profile && hasFinishedOnboarding(profile)) {
      completeOnboarding({
        name: profile.name,
        role: profile.role,
        experienceLevel: profile.experience_level as UserProfile['experienceLevel'],
        prestige: profile.prestige,
        currentLevel: profile.current_level,
      });
      navigate('/', { replace: true });
    }
  }, [user, profile, completeOnboarding, navigate]);

  // A guest who already finished goes back to their app instead of being set up again, which
  // would add a second loadout. Links carry ?continue or a hash, and those keep their own flow.
  const checkedReturningGuest = useRef(false);
  useEffect(() => {
    if (authLoading || checkedReturningGuest.current) return;
    checkedReturningGuest.current = true;
    const { userIsGuest, hasCompletedOnboarding } = useUserStore.getState();
    if (!user && userIsGuest && hasCompletedOnboarding && !shouldContinue && !window.location.hash) {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, shouldContinue, navigate]);

  // An expired or already-used link comes back with the reason in the URL hash
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('error')) {
      toast.error('That sign-in link has expired. Request a new one.');
      navigate('/auth', { replace: true });
    }
  }, [navigate]);

  const handleNext = (selectedRole?: 'fighter' | 'coach') => {
    const roleToUse = selectedRole || role;
    // Coaches skip equipment (they have all), and hear that coach tools aren't built yet
    const steps: Step[] = roleToUse === 'coach'
      ? ['welcome', 'role', 'name', 'stance', 'coachTools', 'goals', 'complete']
      : ['welcome', 'role', 'name', 'stance', 'experience', 'equipment', 'goals', 'complete'];
    
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const [isCompleting, setIsCompleting] = useState(false);
  
  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    // Coaches are automatically pro level and have all equipment
    const finalExperience = role === 'coach' ? 'pro' : experience;
    const coachEquip = { gloves: true, wraps: true, heavyBag: true, speedBag: true, doubleEndBag: true, jumpRope: true, treadmill: true };
    const finalEquipmentBools = role === 'coach' ? coachEquip : equipment;
    const finalPrimaryBag = role === 'coach' ? 'heavy' as const : primaryBag;
    const finalEquipmentWithBag = { ...finalEquipmentBools, primaryBag: finalPrimaryBag };
    
    // Get prestige from experience level
    const prestige = experienceLevelToPrestige(finalExperience);
    
    // Update profile in database with prestige and other onboarding data
    try {
      await updateProfile.mutateAsync({
        name: name.trim() || (role === 'coach' ? 'Coach' : 'Fighter'),
        role,
        experience_level: finalExperience,
        equipment: finalEquipmentWithBag as UserProfile['equipment'],
        goals: goals,
        prestige,
        current_level: 1,
        preferences: { ...profile?.preferences, stance } as NonNullable<typeof profile>['preferences'],
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
    
    // Also update local store for immediate UI feedback
    completeOnboarding({
      role,
      name: name.trim() || (role === 'coach' ? 'Coach' : 'Fighter'),
      experienceLevel: finalExperience as UserProfile['experienceLevel'],
      equipment: finalEquipmentWithBag as UserProfile['equipment'],
      goals: goals as UserProfile['goals'],
    });
    
    // Generate exactly ONE loadout workout based on tier + equipment
    const loadoutEquipment = {
      gloves: !!finalEquipmentBools.gloves,
      wraps: !!finalEquipmentBools.wraps,
      jumpRope: !!finalEquipmentBools.jumpRope,
      heavyBag: !!finalEquipmentBools.heavyBag,
      doubleEndBag: !!finalEquipmentBools.doubleEndBag,
      speedBag: !!finalEquipmentBools.speedBag,
      treadmill: !!finalEquipmentBools.treadmill,
      primaryBag: finalPrimaryBag,
    };
    const loadout = generateLoadoutWorkout(finalExperience, loadoutEquipment);
    
    // Save the single loadout to database
    try {
      await addWorkoutToDb.mutateAsync(loadout);
    } catch (error) {
      console.error('Failed to save loadout workout:', error);
    }
    
    navigate('/');
  };

  const toggleEquipment = (id: string) => {
    setEquipment(prev => {
      const newVal = !prev[id];
      const updated = { ...prev, [id]: newVal };
      // If turning off a bag that's the primary, reset primaryBag
      if (!newVal) {
        if (id === 'heavyBag' && primaryBag === 'heavy') {
          setPrimaryBag(updated.doubleEndBag ? 'double_end' : 'none');
        } else if (id === 'doubleEndBag' && primaryBag === 'double_end') {
          setPrimaryBag(updated.heavyBag ? 'heavy' : 'none');
        }
      }
      // Only set primaryBag when BOTH bags are selected — single bag needs no primary distinction
      if (newVal) {
        if (id === 'heavyBag' && updated.doubleEndBag) setPrimaryBag(primaryBag === 'none' ? 'heavy' : primaryBag);
        else if (id === 'doubleEndBag' && updated.heavyBag) setPrimaryBag(primaryBag === 'none' ? 'double_end' : primaryBag);
        // Single bag selected — no primary needed
      }
      // If only one bag remains, reset primaryBag to none
      if (!(updated.heavyBag && updated.doubleEndBag)) {
        setPrimaryBag('none');
      }
      return updated;
    });
  };

  const togglePrimaryBag = (bagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (bagId === 'heavyBag') setPrimaryBag('heavy');
    else if (bagId === 'doubleEndBag') setPrimaryBag('double_end');
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
      ? ['role', 'name', 'stance', 'coachTools', 'goals']
      : ['role', 'name', 'stance', 'experience', 'equipment', 'goals'];
  };

  // Hold the first screen until we know whether a signed-in account has been here before
  if ((shouldContinue && authLoading) || (user && profileLoading)) {
    return <div className="min-h-dvh bg-background" />;
  }

  const stepList = getSteps();
  const segment = stepList.indexOf(step) + 1;
  const segments = stepList.length;
  const onAirName = name.trim() || (role === 'coach' ? 'Coach' : 'Fighter');

  if (step === 'welcome') {
    return (
      <div className="flex min-h-dvh flex-col overflow-x-clip" style={welcomeSlash}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-4 [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:py-1">
          <Logo kind="mark" className="aspect-[900/670] w-[min(64vw,21rem)] text-tech-black [@media(max-height:500px)]:w-28 [@media(max-height:600px)]:w-44" />
          <Plate tone="black" bleed="both" className="fx w-full px-4 pb-1 pt-2 text-[clamp(2rem,10.5vw,3.5rem)] [@media(max-height:500px)]:text-3xl">
            Knockout Intelligence.
          </Plate>
          <div className="flex w-full max-w-md flex-col gap-3 px-6 [@media(max-height:500px)]:max-w-xl [@media(max-height:500px)]:flex-row">
            <Button variant="black" size="lg" onClick={() => handleNext()} className="w-full text-volt [@media(max-height:500px)]:h-12 [@media(max-height:500px)]:text-2xl">
              GET STARTED
            </Button>
            <Button variant="white" onClick={() => navigate('/auth')} className="w-full">
              LOGIN
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'role') {
    const roles = [
      { id: 'fighter', title: "I'M A FIGHTER", sub: 'Training solo or with a coach' },
      { id: 'coach', title: "I'M A COACH", sub: 'Train here today. Coach tools are coming soon.' },
    ] as const;
    return (
      <PreShow
        show="Casting"
        segment={segment}
        segments={segments}
        title="Who are you?"
        sub="This helps us personalize your experience"
      >
        <div className="space-y-4">
          {roles.map((option) => {
            const on = role === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => { setRole(option.id); handleNext(option.id); }}
                className="block w-full text-left focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-foreground"
              >
                <Plate tone={on ? 'lime' : 'graphite'} bleed="both" className={cn('flex w-full px-4 py-2', !on && 'text-muted-foreground')}>
                  <FitText className={cn(on ? 'h-20' : 'h-16', '[@media(max-height:500px)]:h-12')} max={88}>{option.title}</FitText>
                </Plate>
                <span className={cn('prose-w block px-4 pt-2 text-lg leading-snug', !on && 'text-muted-foreground')}>{option.sub}</span>
              </button>
            );
          })}
        </div>
      </PreShow>
    );
  }

  if (step === 'name') {
    return (
      <PreShow
        show="Name graphic"
        segment={segment}
        segments={segments}
        title="What should we call you?"
        sub="Enter your name or nickname"
        ticker={['Your lower third, on every session']}
        onNext={() => handleNext()}
      >
        <div className="overflow-hidden pb-1" aria-hidden="true">
          <Plate tone="white" bleed="left" className="flex w-[88%] py-2 pl-4 pr-8 [@media(max-height:500px)]:py-1">
            <FitText className="h-24 [@media(max-height:600px)]:h-14 [@media(max-height:500px)]:h-12" max={110}>{onAirName}</FitText>
          </Plate>
          <div className="mt-1.5">
            <Plate tone="lime" bleed="left" className="h-9 pl-4 pr-6 text-[1.75rem]">
              {role === 'coach' ? 'Coach' : 'Fighter'}
            </Plate>
          </div>
        </div>
        <label className="mt-4 block px-4">
          <span className="lab">This is your lower third</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            className="h-14 text-2xl"
            autoFocus
          />
        </label>
      </PreShow>
    );
  }

  if (step === 'stance') {
    return (
      <PreShow
        show="Tale of the tape"
        segment={segment}
        segments={segments}
        title="Your Stance"
        sub="Which hand leads? Most right-handers lead with the left."
        ticker={['Lead foot filled, rear foot outlined', 'Tells the punch camera which hand is your lead']}
        onNext={() => handleNext()}
      >
        <div className="space-y-3">
          {STANCE_OPTIONS.map((option) => {
            const on = stance === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => setStance(option.value)}
                className={cn(plateClass({ tone: on ? 'lime' : 'graphite', bleed: 'both' }), 'flex w-full justify-between gap-2 py-2 pl-4 pr-3 text-left', !on && 'text-muted-foreground')}
              >
                <span className="min-w-0">
                  <span className="fx block text-[clamp(2.75rem,14vw,4.5rem)] [@media(max-height:500px)]:text-4xl">{option.label}</span>
                  <span className={cn('mt-1 block text-lg font-semibold leading-tight', !on && 'text-foreground')}>{option.hint}</span>
                </span>
                <StanceFeet leftLeads={option.value === 'orthodox'} />
              </button>
            );
          })}
        </div>
      </PreShow>
    );
  }

  if (step === 'experience') {
    return (
      <PreShow
        show="Weigh-in"
        segment={segment}
        segments={segments}
        title="Experience Level"
        sub="How much combat sports experience do you have?"
        ticker={['Your division sets your first loadout']}
        onNext={() => handleNext()}
      >
        <div className="space-y-2">
          {experienceLevels.map((level, index) => {
            const on = experience === level.id;
            return (
              <ChoicePlate key={level.id} on={on} onClick={() => setExperience(level.id)} width={`${86 + index * 3}%`}>
                <span className="min-w-0">
                  <span className="fx block text-[2.125rem]">{level.label}</span>
                  <span className={cn('block text-[0.9375rem] font-semibold leading-tight', !on && 'text-muted-foreground')}>{level.desc}</span>
                </span>
                {on && <span className="fx text-xl">Picked</span>}
              </ChoicePlate>
            );
          })}
        </div>
      </PreShow>
    );
  }

  if (step === 'equipment') {
    const inCorner = equipmentOptions.filter((item) => equipment[item.id]).length;
    return (
      <PreShow
        show="Equipment check"
        segment={segment}
        segments={segments}
        title="Your Equipment"
        sub="What equipment do you have access to?"
        ticker={[`${inCorner} in the corner`, primaryBag !== 'none' && `${primaryBag === 'heavy' ? 'Heavy' : 'Double end'} is your primary`]}
        onNext={() => handleNext()}
      >
        <div className="border-t border-surface-2">
          {equipmentOptions.map((item) => {
            const isBag = item.id === 'heavyBag' || item.id === 'doubleEndBag';
            const isSelected = !!equipment[item.id];
            const isPrimary = (item.id === 'heavyBag' && primaryBag === 'heavy') ||
                              (item.id === 'doubleEndBag' && primaryBag === 'double_end');
            const showPrimary = isBag && isSelected && equipment.heavyBag && equipment.doubleEndBag;
            return (
              <div key={item.id} className="flex flex-wrap items-center justify-end gap-x-3 border-b border-surface-2 pr-4">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleEquipment(item.id)}
                  className="flex min-h-[3.25rem] min-w-0 grow basis-[15rem] items-center justify-between gap-3 py-1.5 pl-4 text-left transition-colors hover:bg-surface-1 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-foreground"
                >
                  <span className={cn('fx pr-1 text-[1.875rem]', !isSelected && 'text-muted-foreground')}>{item.label}</span>
                  <Plate tone={isSelected ? 'lime' : 'graphite'} className={cn('h-7 w-12 shrink-0 text-xl', !isSelected && 'text-muted-foreground')}>
                    {isSelected ? 'In' : 'Out'}
                  </Plate>
                </button>
                {showPrimary && (
                  <button
                    type="button"
                    aria-pressed={isPrimary}
                    onClick={(e) => togglePrimaryBag(item.id, e)}
                    title="Set as primary bag"
                    className={cn(plateClass({ tone: isPrimary ? 'white' : 'outline' }), 'fx mb-1 h-11 shrink-0 px-2.5 text-lg')}
                  >
                    {isPrimary ? 'Primary' : 'Set primary'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </PreShow>
    );
  }

  // Coach tools aren't built yet, so this says so instead of collecting a roster nothing would save
  if (step === 'coachTools') {
    return (
      <BroadcastPage show="Pilot episode" className="flex flex-col">
        <div className="mt-4 flex-1">
          <div className="overflow-hidden py-5" style={pilotStripes}>
            <SectionChyron className="plate-slap h-10 text-[2rem]">Coming soon</SectionChyron>
            <h2 className="fx mt-4 px-4 text-[clamp(3.25rem,15vw,5.5rem)] [@media(max-height:500px)]:text-5xl">Coach Tools Are Coming</h2>
          </div>
          <p className="prose-w mt-4 px-4 text-xl leading-snug">
            Rosters, programs and a coach marketplace aren't built yet. You can use all of Clocked's training today, and your profile will show you as a coach.
          </p>
          <p className="lab mt-4 px-4">In production: Rosters. Programs. Coach marketplace.</p>
        </div>
        <OnwardBar label="Continue" onClick={() => handleNext()} ticker={['Coach tools coming soon', 'All training works today']} />
      </BroadcastPage>
    );
  }

  if (step === 'goals') {
    return (
      <PreShow
        show="Storylines"
        segment={segment}
        segments={segments}
        title={role === 'coach' ? 'Your Coaching Goals' : 'Your Goals'}
        sub={role === 'coach' ? 'What do you want to achieve with your team?' : 'What do you want to achieve?'}
        ticker={[`${goals.length} ${goals.length === 1 ? 'storyline' : 'storylines'} picked`]}
        onNext={() => setStep('complete')}
      >
        <div className="space-y-2.5">
          {goalOptions.map((goal, index) => {
            const on = goals.includes(goal.id);
            return (
              <ChoicePlate key={goal.id} on={on} onClick={() => toggleGoal(goal.id)} width={`${88 + (index % 2) * 6}%`}>
                <span className="fx min-w-0 whitespace-normal text-[clamp(1.5rem,7.5vw,2.75rem)]">{goal.label}</span>
                {on && <span className="fx shrink-0 text-xl">Picked</span>}
              </ChoicePlate>
            );
          })}
        </div>
      </PreShow>
    );
  }

  return (
    <BroadcastPage show="All set" className="flex flex-col">
      <div className="bg-slash flex flex-1 flex-col justify-center overflow-hidden py-6">
        <h2 className="px-4">
          <FitText className="fx h-24 [@media(max-height:500px)]:h-14" max={110}>You're All Set!</FitText>
        </h2>
        <div className="mt-4">
          <Plate tone="white" bleed="left" className="flex w-[88%] py-2 pl-4 pr-8">
            <FitText className="h-20 [@media(max-height:500px)]:h-12" max={96}>{onAirName}</FitText>
          </Plate>
        </div>
        <div className="mt-1.5">
          <Plate tone="graphite" bleed="left" className="h-9 pl-4 pr-6 text-[1.75rem]">Loadout ready</Plate>
        </div>
        <p className="prose-w mt-4 max-w-lg px-4 text-xl leading-snug">
          {role === 'coach'
            ? "Your loadout is ready. Coach tools are on the way, so for now, let's train."
            : "Your personalized loadout is ready. Let's get to work."
          }
        </p>
      </div>
      <OnwardBar
        label={role === 'coach' ? "LET'S WORK" : 'START TRAINING'}
        onClick={handleComplete}
        ticker={[]}
      />
    </BroadcastPage>
  );
};

export default Onboarding;
