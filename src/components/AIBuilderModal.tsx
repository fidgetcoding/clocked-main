import { useState } from 'react';
import { X, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TrendingWorkout } from '@/data/trendingWorkouts';
import { cn } from '@/lib/utils';

interface AIBuilderModalProps {
  onClose: () => void;
  onGenerate: (prompt: string, baseWorkout?: TrendingWorkout) => void;
  baseWorkout?: TrendingWorkout;
}

const SUGGESTION_CHIPS = [
  '5 round heavy bag boxing',
  '20 min HIIT cardio',
  'Beginner shadowboxing',
  '30 min conditioning',
  'Speed and footwork drills',
];

export const AIBuilderModal = ({ onClose, onGenerate, baseWorkout }: AIBuilderModalProps) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    // Simulate generation delay then call onGenerate
    setTimeout(() => {
      onGenerate(prompt, baseWorkout);
      setIsGenerating(false);
    }, 1500);
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

          {/* Prompt Input */}
          <div className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={baseWorkout 
                ? "E.g. Make it shorter, add more rest, focus on defense..."
                : "E.g. 5 round heavy bag boxing workout with HIIT intervals"
              }
              className="min-h-[100px] bg-surface-2 border-surface-3 text-foreground placeholder:text-muted-foreground resize-none"
            />
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
        <div className="p-4 border-t border-surface-3 flex gap-3">
          <Button 
            variant="outline"
            onClick={onClose}
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
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                Generating...
              </>
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
  );
};
