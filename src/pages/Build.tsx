import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';

const Build = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="flex items-center gap-4 px-4 py-4 safe-top border-b border-surface-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Workout Builder</h1>
        </header>

        <div className="px-4 py-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-surface-1 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🔨</span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              Build Your Workout
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Create custom boxing workouts with warmup, grind phases, and cooldown sections.
            </p>
            
            <div className="space-y-3">
              <Button className="w-full btn-primary-glow">
                <Plus className="w-5 h-5 mr-2" />
                New Workout
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full h-12 bg-surface-1 border-surface-3 text-foreground hover:bg-surface-2"
              >
                <span className="mr-2">✨</span>
                AI Generate Workout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Build;
