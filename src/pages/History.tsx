import { useState } from 'react';
import { History as HistoryIcon, Plus, ChevronRight, Calendar, Sparkles, Brain, X, Wand2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useHistoryStore } from '@/stores/historyStore';
import { useUserStore } from '@/stores/userStore';
import { AddWorkoutModal } from '@/components/AddWorkoutModal';
import { GeneratedWorkoutPreview } from '@/components/GeneratedWorkoutPreview';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Workout, WorkoutPhase } from '@/types';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

const History = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAICoach, setShowAICoach] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [generatedWorkout, setGeneratedWorkout] = useState<Workout | null>(null);
  
  const completedWorkouts = useHistoryStore((state) => state.completedWorkouts);
  const user = useUserStore((state) => state.user);

  const handleAnalyze = () => {
    if (completedWorkouts.length === 0) {
      toast.error('Complete some workouts first to get AI analysis');
      return;
    }
    
    setIsAnalyzing(true);
    setShowAICoach(true);
    
    // Simulate AI analysis - in production this would call Lovable AI
    setTimeout(() => {
      const workoutCount = completedWorkouts.length;
      const avgDuration = Math.round(completedWorkouts.reduce((acc, w) => acc + w.duration, 0) / workoutCount / 60);
      const totalXP = completedWorkouts.reduce((acc, w) => acc + w.xpEarned, 0);
      const tooHardCount = completedWorkouts.filter(w => w.difficulty === 'too_hard').length;
      const tooEasyCount = completedWorkouts.filter(w => w.difficulty === 'too_easy').length;
      
      let suggestion = `## Training Analysis\n\n`;
      suggestion += `Based on your **${workoutCount} logged workouts**, here's what I see:\n\n`;
      suggestion += `📊 **Stats Overview:**\n`;
      suggestion += `- Average session: ${avgDuration} minutes\n`;
      suggestion += `- Total XP earned: ${totalXP.toLocaleString()}\n\n`;
      
      if (tooHardCount > tooEasyCount) {
        suggestion += `⚠️ **Observation:** You've marked ${tooHardCount} sessions as "too hard". Consider:\n`;
        suggestion += `- Adding more rest between rounds\n`;
        suggestion += `- Focusing on technique over power\n`;
        suggestion += `- Reducing combo complexity temporarily\n\n`;
      } else if (tooEasyCount > tooHardCount) {
        suggestion += `💪 **Observation:** You've marked ${tooEasyCount} sessions as "too easy". Time to level up:\n`;
        suggestion += `- Increase round duration\n`;
        suggestion += `- Add more complex combos\n`;
        suggestion += `- Reduce rest periods\n\n`;
      }
      
      suggestion += `### Recommended Next Workout\n`;
      suggestion += `Based on your progress, I recommend a **${user?.experienceLevel === 'beginner' ? 'moderate intensity' : 'high intensity'}** session focusing on:\n`;
      suggestion += `- Defense drills (slips and rolls)\n`;
      suggestion += `- 3-4 punch combo variations\n`;
      suggestion += `- ${user?.experienceLevel === 'beginner' ? '3 rounds' : '5 rounds'} with 1:1 work/rest ratio\n`;
      
      setAnalysis(suggestion);
      setIsAnalyzing(false);
    }, 2000);
  };

  const handleCreateFromAnalysis = () => {
    const generateId = () => crypto.randomUUID();
    
    // Determine workout parameters based on analysis
    const tooHardCount = completedWorkouts.filter(w => w.difficulty === 'too_hard').length;
    const tooEasyCount = completedWorkouts.filter(w => w.difficulty === 'too_easy').length;
    
    let difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
    let rounds = 4;
    let roundDuration = 180;
    let restDuration = 60;
    
    if (tooHardCount > tooEasyCount) {
      difficulty = 'beginner';
      rounds = 3;
      roundDuration = 150;
      restDuration = 90;
    } else if (tooEasyCount > tooHardCount) {
      difficulty = 'advanced';
      rounds = 6;
      roundDuration = 180;
      restDuration = 45;
    }
    
    // Generate combos based on difficulty
    const combos: string[][] = [];
    const beginnerCombos = [['1', '2'], ['1', '2', '3'], ['1', '1', '2'], ['2', '3', '2']];
    const intermediateCombos = [['1', '2', '3', '2'], ['1', '2', 'SLIP L', '2', '3'], ['1', '6', '3', '2'], ['1', '2', '5', '3', '2']];
    const advancedCombos = [['1', '2', '3', '4', '5', '6'], ['1', '2', 'SLIP L', '2', '3', '2'], ['1', '2', '5', '6', '3', '2'], ['SLIP L', '2', '3', '2', '5', '6']];
    
    const comboSet = difficulty === 'beginner' ? beginnerCombos : 
                     difficulty === 'intermediate' ? intermediateCombos : advancedCombos;
    
    for (let i = 0; i < rounds; i++) {
      combos.push(comboSet[i % comboSet.length]);
    }
    
    const warmupPhases: WorkoutPhase[] = [{
      id: generateId(),
      name: 'Dynamic Warmup',
      repeats: 1,
      segments: [
        { id: generateId(), name: 'Jump Rope', type: 'active', segmentType: 'work', duration: 120 },
        { id: generateId(), name: 'Rest', type: 'rest', segmentType: 'rest', duration: 30 },
        { id: generateId(), name: 'Shadow Boxing', type: 'active', segmentType: 'shadowboxing', duration: 120 },
      ],
    }];
    
    const grindPhases: WorkoutPhase[] = [{
      id: generateId(),
      name: 'Main Rounds',
      repeats: rounds,
      segments: [
        { id: generateId(), name: 'Combo Work', type: 'active', segmentType: 'combo', duration: roundDuration },
        { id: generateId(), name: 'Rest', type: 'rest', segmentType: 'rest', duration: restDuration },
      ],
    }];
    
    const cooldownPhases: WorkoutPhase[] = [{
      id: generateId(),
      name: 'Cooldown',
      repeats: 1,
      segments: [
        { id: generateId(), name: 'Light Shadow', type: 'active', segmentType: 'shadowboxing', duration: 90 },
        { id: generateId(), name: 'Stretch', type: 'active', segmentType: 'work', duration: 120 },
      ],
    }];
    
    let totalDuration = 0;
    [...warmupPhases, ...grindPhases, ...cooldownPhases].forEach(phase => {
      const phaseDur = phase.segments.reduce((acc, s) => acc + s.duration, 0);
      totalDuration += phaseDur * phase.repeats;
    });
    
    const workout: Workout = {
      id: generateId(),
      name: 'AI Coach Workout',
      icon: '🧠',
      difficulty,
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
      combos,
    };
    
    setGeneratedWorkout(workout);
    setShowAICoach(false);
  };

  return (
    <AppLayout>
      <div className="min-h-screen pb-24">
        {/* Header */}
        <header className="px-4 pt-8 pb-4 safe-top">
          <div className="flex items-center gap-3 mb-4">
            <HistoryIcon className="w-6 h-6 text-volt" />
            <h1 className="text-2xl font-black text-foreground tracking-wider">
              WORKOUT LOG
            </h1>
          </div>
          
          {/* Action buttons below header */}
          <div className="flex gap-2">
            <Button
              onClick={handleAnalyze}
              variant="outline"
              className="flex-1 border-volt text-volt hover:bg-volt/10"
            >
              <Brain className="w-4 h-4 mr-2" />
              AI Coach
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex-1 bg-volt text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Log Workout
            </Button>
          </div>
        </header>

        {/* Workout List */}
        <div className="px-4 space-y-3">
          {completedWorkouts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-surface-3 p-8 text-center">
              <p className="text-muted-foreground uppercase tracking-wider mb-2">
                No History Yet
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Complete a workout or log one manually to get started
              </p>
              <Button
                onClick={() => setShowAddModal(true)}
                className="btn-primary-glow"
              >
                Log a Workout
              </Button>
            </div>
          ) : (
            completedWorkouts.map((workout) => {
              const isExpanded = expandedId === workout.id;
              return (
                <div
                  key={workout.id}
                  className="bg-surface-1 rounded-xl border border-surface-3 overflow-hidden"
                >
                  {/* Header Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : workout.id)}
                    className="w-full flex items-center gap-3 p-4"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground">{workout.workoutName}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(workout.completedAt), { addSuffix: true })}
                        </span>
                        <span>{formatDuration(workout.duration)}</span>
                        <span className="text-volt font-semibold">+{workout.xpEarned} XP</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-90'
                      )}
                    />
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-surface-3">
                      {/* Difficulty */}
                      {workout.difficulty && (
                        <div className="flex items-center gap-2 mt-3 mb-2">
                          <span className="text-xs text-muted-foreground">Difficulty:</span>
                          <span
                            className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded',
                              workout.difficulty === 'too_easy' && 'bg-green-500/20 text-green-400',
                              workout.difficulty === 'just_right' && 'bg-volt/20 text-volt',
                              workout.difficulty === 'too_hard' && 'bg-orange-500/20 text-orange-400'
                            )}
                          >
                            {workout.difficulty === 'too_easy' && 'Too Easy'}
                            {workout.difficulty === 'just_right' && 'Just Right'}
                            {workout.difficulty === 'too_hard' && 'Too Hard'}
                          </span>
                        </div>
                      )}

                      {/* Round Feedback */}
                      {workout.roundFeedback && workout.roundFeedback.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-2">Round Ratings</p>
                          <div className="flex flex-wrap gap-1">
                            {workout.roundFeedback.map((rf) => (
                              <div
                                key={rf.roundNumber}
                                className="flex items-center gap-1 bg-surface-2 rounded px-2 py-1"
                              >
                                <span className="text-[10px] text-muted-foreground">R{rf.roundNumber}</span>
                                <span className="text-xs font-bold text-volt">{rf.rating}/5</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {workout.notes && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">Journal</p>
                          <p className="text-sm text-foreground leading-relaxed bg-surface-2 rounded-lg p-3">
                            {workout.notes}
                          </p>
                        </div>
                      )}

                      {/* Date */}
                      <p className="text-[10px] text-muted-foreground mt-3">
                        {format(new Date(workout.completedAt), 'EEEE, MMMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <AddWorkoutModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* AI Coach Modal */}
      {showAICoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAICoach(false)}
          />
          
          <div className="relative w-full max-w-md max-h-[80vh] bg-surface-1 rounded-2xl border border-surface-3 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-volt/20 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-volt" />
                </div>
                <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                  AI Coach
                </h2>
              </div>
              <button 
                onClick={() => setShowAICoach(false)}
                className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 border-2 border-volt/30 border-t-volt rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground">Analyzing your training history...</p>
                </div>
              ) : analysis ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  {analysis.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) {
                      return <h2 key={i} className="text-lg font-bold text-foreground mt-0">{line.replace('## ', '')}</h2>;
                    }
                    if (line.startsWith('### ')) {
                      return <h3 key={i} className="text-base font-semibold text-foreground mt-4">{line.replace('### ', '')}</h3>;
                    }
                    if (line.startsWith('- ')) {
                      return <p key={i} className="text-sm text-muted-foreground my-1 flex items-start gap-2">
                        <span className="text-volt">•</span>
                        {line.replace('- ', '')}
                      </p>;
                    }
                    if (line.includes('**')) {
                      const parts = line.split('**');
                      return <p key={i} className="text-sm text-muted-foreground my-2">
                        {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-foreground">{part}</strong> : part)}
                      </p>;
                    }
                    return line ? <p key={i} className="text-sm text-muted-foreground my-2">{line}</p> : null;
                  })}
                </div>
              ) : null}
            </div>

            {/* Actions */}
            {!isAnalyzing && analysis && (
              <div className="p-4 border-t border-surface-3 flex gap-3 flex-shrink-0">
                <Button 
                  variant="outline"
                  onClick={() => setShowAICoach(false)}
                  className="flex-1 border-surface-3 text-foreground hover:bg-surface-2"
                >
                  Close
                </Button>
                <Button 
                  onClick={handleCreateFromAnalysis}
                  className="flex-1 bg-volt text-primary-foreground hover:bg-volt/90"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Create Workout
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generated Workout Preview */}
      {generatedWorkout && (
        <GeneratedWorkoutPreview
          workout={generatedWorkout}
          onClose={() => setGeneratedWorkout(null)}
          onWorkoutUpdate={(updated) => setGeneratedWorkout(updated)}
        />
      )}
    </AppLayout>
  );
};

export default History;
