import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Sparkles, Wand2, Mic, MicOff, TrendingUp, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TrendingWorkout } from '@/data/trendingWorkouts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { Workout, WorkoutPhase } from '@/types';
import { parseWorkoutInput, parsedResultToWorkout, checkPromptQuality } from '@/lib/aiWorkoutParser';
import { analyzeWorkoutHistory, getInsightsSummary, HistoryInsights } from '@/lib/workoutHistoryAnalysis';

interface AIBuilderModalProps {
  onClose: () => void;
  onGenerate?: (prompt: string, baseWorkout?: TrendingWorkout) => void;
  baseWorkout?: TrendingWorkout;
  onWorkoutGenerated?: (workout: Workout) => void;
}

const SUGGESTION_CHIPS = [
  '5 round heavy bag boxing',
  '20 min HIIT cardio',
  'Beginner shadowboxing',
  '30 min conditioning',
  'Speed and footwork drills',
];

// Check if SpeechRecognition is available
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

// Parse prompt to extract workout parameters
export function parseWorkoutPrompt(prompt: string, userLevel: string = 'beginner') {
  const lowerPrompt = prompt.toLowerCase();
  
  // Extract rounds/sets
  let rounds = 3;
  const roundMatch = lowerPrompt.match(/(\d+)\s*(round|set|interval)/);
  if (roundMatch) rounds = parseInt(roundMatch[1]);
  
  // Extract duration
  let roundDuration = 180; // 3 min default
  let restDuration = 60; // 1 min default
  
  const minMatch = lowerPrompt.match(/(\d+)\s*min/);
  if (minMatch) {
    const totalMins = parseInt(minMatch[1]);
    if (totalMins <= 10) {
      rounds = 3;
      roundDuration = Math.floor((totalMins * 60) / rounds * 0.7);
      restDuration = Math.floor((totalMins * 60) / rounds * 0.3);
    } else if (totalMins <= 20) {
      rounds = 5;
      roundDuration = Math.floor((totalMins * 60) / rounds * 0.7);
      restDuration = Math.floor((totalMins * 60) / rounds * 0.3);
    } else {
      rounds = 8;
      roundDuration = Math.floor((totalMins * 60) / rounds * 0.7);
      restDuration = Math.floor((totalMins * 60) / rounds * 0.3);
    }
  }
  
  // Extract difficulty
  let difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
  if (lowerPrompt.includes('advanced') || lowerPrompt.includes('pro') || lowerPrompt.includes('hard')) {
    difficulty = 'advanced';
  } else if (lowerPrompt.includes('intermediate') || lowerPrompt.includes('medium')) {
    difficulty = 'intermediate';
  } else if (lowerPrompt.includes('beginner') || lowerPrompt.includes('easy')) {
    difficulty = 'beginner';
  } else {
    // Use user's level as default
    if (userLevel === 'advanced' || userLevel === 'pro') difficulty = 'advanced';
    else if (userLevel === 'intermediate') difficulty = 'intermediate';
  }
  
  // Extract workout type/focus
  const hasHIIT = lowerPrompt.includes('hiit') || lowerPrompt.includes('interval');
  const hasShadowboxing = lowerPrompt.includes('shadow');
  const hasHeavyBag = lowerPrompt.includes('heavy bag') || lowerPrompt.includes('bag work');
  const hasCardio = lowerPrompt.includes('cardio') || lowerPrompt.includes('conditioning');
  const hasDefense = lowerPrompt.includes('defense') || lowerPrompt.includes('defensive') || lowerPrompt.includes('slip') || lowerPrompt.includes('roll');
  const hasFootwork = lowerPrompt.includes('footwork') || lowerPrompt.includes('movement');
  
  // Generate combos based on focus
  const combos: string[][] = [];
  for (let i = 0; i < rounds; i++) {
    let combo: string[] = [];
    
    if (hasDefense) {
      // Defense-focused combos
      const defensePatterns = [
        ['1', '2', 'SLIP L', '2'],
        ['1', 'SLIP R', '2', '3'],
        ['1', '2', 'ROLL L', '3', '2'],
        ['SLIP L', 'SLIP R', '2', '3', '2'],
        ['1', '2', 'PULL', '2', '3'],
      ];
      combo = defensePatterns[i % defensePatterns.length];
    } else if (hasFootwork) {
      // Footwork-focused combos
      const footworkPatterns = [
        ['1', '1', '2', 'CIRCLE L'],
        ['1', '2', 'CIRCLE R', '2', '3'],
        ['STEP IN', '1', '2', '3', 'STEP OUT'],
        ['CIRCLE L', '1', '2', 'CIRCLE R', '2'],
      ];
      combo = footworkPatterns[i % footworkPatterns.length];
    } else {
      // Standard punch combos by difficulty
      const beginnerCombos = [
        ['1', '2'],
        ['1', '2', '3'],
        ['1', '1', '2'],
        ['1', '2', '3', '2'],
        ['2', '3', '2'],
      ];
      const intermediateCombos = [
        ['1', '2', '3', '2'],
        ['1', '2', '5', '3', '2'],
        ['1', '6', '3', '2'],
        ['1', '2', '3', '6', '3', '2'],
        ['1', '2', 'SLIP L', '2', '3', '2'],
      ];
      const advancedCombos = [
        ['1', '2', '3', '4', '5', '6'],
        ['1', '2', '5', '6', '3', '2'],
        ['SLIP L', '2', '3', '2', '5', '6', '3'],
        ['1', '2', 'ROLL L', '7', '8', '3', '2'],
        ['1', '1', '2', '3', '2', '5', '6', '3', '2'],
      ];
      
      if (difficulty === 'advanced') {
        combo = advancedCombos[i % advancedCombos.length];
      } else if (difficulty === 'intermediate') {
        combo = intermediateCombos[i % intermediateCombos.length];
      } else {
        combo = beginnerCombos[i % beginnerCombos.length];
      }
    }
    
    combos.push(combo);
  }
  
  // Build workout name
  let name = 'AI Workout';
  if (hasHeavyBag) name = 'Heavy Bag Blast';
  else if (hasShadowboxing) name = 'Shadow Session';
  else if (hasHIIT) name = 'HIIT Boxing';
  else if (hasCardio) name = 'Cardio Conditioning';
  else if (hasDefense) name = 'Defense Drill';
  else if (hasFootwork) name = 'Footwork Focus';
  else if (rounds >= 5) name = 'Full Session';
  else name = 'Quick Burn';
  
  return {
    name,
    rounds,
    roundDuration,
    restDuration,
    difficulty,
    combos,
    hasWarmup: lowerPrompt.includes('warmup') || lowerPrompt.includes('warm up') || !lowerPrompt.includes('quick'),
    hasCooldown: lowerPrompt.includes('cooldown') || lowerPrompt.includes('cool down') || !lowerPrompt.includes('quick'),
    hasShadowboxing,
    hasHIIT,
  };
}

// Generate a full workout object from parsed prompt
// Uses new framework-based parser with fallback to legacy logic
export function generateWorkoutFromPrompt(
  prompt: string, 
  userLevel: string = 'beginner',
  historyInsights?: HistoryInsights | null
): Workout {
  // Try the new framework-based parser first
  const parsedResult = parseWorkoutInput(prompt, userLevel, historyInsights ?? undefined);
  
  // Check if the new parser extracted meaningful data
  const hasSpecificData = parsedResult.parsedRounds || parsedResult.parsedDurations || parsedResult.parsedCombos;
  
  if (hasSpecificData) {
    // Use the new parser's output
    const workout = parsedResultToWorkout(parsedResult);
    
    // If no combos were parsed, generate them using legacy logic
    if (!parsedResult.parsedCombos || parsedResult.combos.length === 0) {
      const legacyParsed = parseWorkoutPrompt(prompt, userLevel);
      workout.combos = legacyParsed.combos;
    }
    
    // Add tags if detected
    if (parsedResult.tags.length > 0) {
      workout.tags = parsedResult.tags;
    }
    
    return workout;
  }
  
  // Fallback to legacy parsing for simple/vague prompts
  const parsed = parseWorkoutPrompt(prompt, userLevel);
  const generateId = () => crypto.randomUUID();
  
  // Warmup phases
  const warmupPhases: WorkoutPhase[] = parsed.hasWarmup ? [{
    id: generateId(),
    name: 'Dynamic Warmup',
    repeats: 1,
    segments: [
      { id: generateId(), name: 'Jump Rope', type: 'active', segmentType: 'work', duration: 120 },
      { id: generateId(), name: 'Active Rest', type: 'rest', segmentType: 'rest', duration: 30 },
      { id: generateId(), name: 'Shadow Boxing', type: 'active', segmentType: 'shadowboxing', duration: 120 },
    ],
  }] : [];
  
  // Main rounds
  const grindPhases: WorkoutPhase[] = [{
    id: generateId(),
    name: parsed.hasHIIT ? 'HIIT Rounds' : 'Main Rounds',
    repeats: parsed.rounds,
    segments: [
      { 
        id: generateId(), 
        name: parsed.hasShadowboxing ? 'Shadowboxing' : 'Combo Work', 
        type: 'active', 
        segmentType: parsed.hasShadowboxing ? 'shadowboxing' : 'combo', 
        duration: parsed.roundDuration 
      },
      { id: generateId(), name: 'Rest', type: 'rest', segmentType: 'rest', duration: parsed.restDuration },
    ],
  }];
  
  // Cooldown phases
  const cooldownPhases: WorkoutPhase[] = parsed.hasCooldown ? [{
    id: generateId(),
    name: 'Cooldown',
    repeats: 1,
    segments: [
      { id: generateId(), name: 'Light Shadow', type: 'active', segmentType: 'shadowboxing', duration: 90 },
      { id: generateId(), name: 'Stretch', type: 'active', segmentType: 'work', duration: 120 },
    ],
  }] : [];
  
  // Calculate total duration
  let totalDuration = 0;
  [...warmupPhases, ...grindPhases, ...cooldownPhases].forEach(phase => {
    const phaseDur = phase.segments.reduce((acc, s) => acc + s.duration, 0);
    totalDuration += phaseDur * phase.repeats;
  });
  
  return {
    id: generateId(),
    name: parsed.name,
    icon: '🥊',
    difficulty: parsed.difficulty,
    totalDuration,
    isPreset: false,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    sections: {
      warmup: warmupPhases,
      grind: grindPhases,
      cooldown: cooldownPhases,
    },
    combos: parsed.combos,
  };
}

export const AIBuilderModal = ({ onClose, onGenerate, baseWorkout, onWorkoutGenerated }: AIBuilderModalProps) => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const { history } = useWorkoutHistory();
  
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationDone, setGenerationDone] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [promptHints, setPromptHints] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  
  // Analyze workout history for personalization
  const historyInsights = useMemo(() => {
    if (!history || history.length === 0) return null;
    return analyzeWorkoutHistory(history);
  }, [history]);
  
  const insightsSummary = useMemo(() => {
    if (!historyInsights) return null;
    return getInsightsSummary(historyInsights);
  }, [historyInsights]);

  // Check prompt quality as user types
  useEffect(() => {
    if (prompt.trim().length > 5) {
      const quality = checkPromptQuality(prompt);
      setPromptHints(quality.suggestions);
    } else {
      setPromptHints([]);
    }
  }, [prompt]);

  // Initialize speech recognition
  useEffect(() => {
    if (!SpeechRecognition) {
      console.log('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setPrompt(prev => prev + (prev ? ' ' : '') + final);
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please enable it in your browser settings.');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) {
        // Restart if we're still supposed to be listening
        try {
          recognition.start();
        } catch (e) {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  const toggleListening = useCallback(async () => {
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      try {
        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current?.start();
        setIsListening(true);
        toast.success('Listening... speak your workout idea');
      } catch (error) {
        toast.error('Could not access microphone');
      }
    }
  }, [isListening]);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationDone(false);
    
    // Stop listening if active
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    
    // Parse the prompt and generate workout
    const workout = generateWorkoutFromPrompt(
      prompt, 
      user?.experienceLevel || 'beginner',
      historyInsights
    );
    
    // If we have a callback, use that (for inline usage)
    if (onWorkoutGenerated) {
      // Animate progress then deliver
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 25 + 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setGenerationProgress(100);
          setGenerationDone(true);
          setTimeout(() => {
            onWorkoutGenerated(workout);
            setIsGenerating(false);
            onClose();
          }, 600);
        } else {
          setGenerationProgress(Math.min(progress, 95));
        }
      }, 200);
      return;
    }
    
    // Animate progress bar then navigate
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setGenerationProgress(100);
        setGenerationDone(true);
        setTimeout(() => {
          toast.success(`Generated "${workout.name}" - now customize it!`);
          const workoutData = encodeURIComponent(JSON.stringify(workout));
          navigate(`/build?ai=${workoutData}`, { replace: true });
        }, 600);
      } else {
        setGenerationProgress(Math.min(progress, 95));
      }
    }, 200);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-1 rounded-2xl border border-surface-3 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-volt/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-volt" />
            </div>
            <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
              Generate with AI
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Base Workout Info (if customizing) */}
          {baseWorkout && (
            <div className="bg-volt/10 border border-volt/20 rounded-xl p-3">
              <p className="text-xs text-volt font-medium uppercase tracking-wider mb-1">
                Customizing
              </p>
              <p className="text-sm text-foreground font-semibold">{baseWorkout.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Describe what you'd like to change or add to this workout
              </p>
            </div>
          )}

          {/* History Insights Banner */}
          {insightsSummary && !baseWorkout && (
            <div className="bg-surface-2 border border-volt/20 rounded-xl p-3 flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-volt mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="text-volt font-medium">💡 Personalized: </span>
                {insightsSummary}
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-surface-2 rounded-xl p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Describe your ideal workout:</p>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>Number of rounds (e.g., "5 rounds")</li>
              <li>Duration (e.g., "20 min session")</li>
              <li>Focus area (e.g., "defense drills", "heavy bag")</li>
              <li>Difficulty (beginner, intermediate, advanced)</li>
            </ul>
          </div>

          {/* Prompt Input with Voice Button */}
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                value={prompt + (interimTranscript ? (prompt ? ' ' : '') + interimTranscript : '')}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={baseWorkout 
                  ? "E.g. Make it shorter, add more rest, focus on defense..."
                  : "E.g. 5 round heavy bag workout with defense combos"
                }
                className={cn(
                  "min-h-[100px] bg-surface-2 border-surface-3 text-foreground placeholder:text-muted-foreground resize-none pr-14",
                  isListening && "border-volt"
                )}
              />
              
              {/* Voice Button */}
              <button
                onClick={toggleListening}
                className={cn(
                  'absolute right-3 bottom-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
                  isListening 
                    ? 'bg-volt text-primary-foreground animate-pulse shadow-[0_0_20px_hsl(var(--electric-volt)/0.6)]' 
                    : 'bg-surface-3 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                )}
              >
                {isListening ? (
                  <Mic className="w-5 h-5" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {isListening && (
              <p className="text-xs text-volt animate-pulse flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-volt" />
                Listening... tap mic to stop
              </p>
            )}
            
            {/* Prompt Quality Hints */}
            {promptHints.length > 0 && prompt.trim().length > 10 && (
              <div className="space-y-1">
                {promptHints.slice(0, 2).map((hint, i) => (
                  <p key={i} className="text-xs text-muted-foreground/70">
                    💡 {hint}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Suggestion Chips */}
          {!baseWorkout && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Quick suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTION_CHIPS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      prompt === suggestion
                        ? 'bg-volt text-primary-foreground'
                        : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-surface-3 space-y-3">
          {/* Progress Bar (visible during generation) */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-volt rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <p className={cn(
                "text-xs text-center font-medium transition-colors",
                generationDone ? "text-volt" : "text-muted-foreground"
              )}>
                {generationDone ? (
                  <span className="flex items-center justify-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Workout built!
                  </span>
                ) : (
                  `Building workout... ${Math.round(generationProgress)}%`
                )}
              </p>
            </div>
          )}
          
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={onClose}
              disabled={isGenerating}
              className="flex-1 border-surface-3 text-foreground hover:bg-surface-2"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="flex-1 bg-volt text-primary-foreground hover:bg-volt/90 disabled:opacity-50"
            >
              {isGenerating ? (
                generationDone ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Done!
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                    Generating...
                  </>
                )
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
