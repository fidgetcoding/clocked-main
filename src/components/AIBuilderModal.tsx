import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, Wand2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TrendingWorkout } from '@/data/trendingWorkouts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

// Check if SpeechRecognition is available
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const AIBuilderModal = ({ onClose, onGenerate, baseWorkout }: AIBuilderModalProps) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

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
    // Stop listening if active
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
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

          {/* Prompt Input with Voice Button */}
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                value={prompt + (interimTranscript ? (prompt ? ' ' : '') + interimTranscript : '')}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={baseWorkout 
                  ? "E.g. Make it shorter, add more rest, focus on defense..."
                  : "E.g. 5 round heavy bag boxing workout with HIIT intervals"
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
