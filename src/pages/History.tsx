import { History as HistoryIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

const History = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="px-4 pt-8 pb-6 text-center safe-top">
          <div className="flex items-center justify-center gap-3">
            <HistoryIcon className="w-6 h-6 text-volt" />
            <h1 className="text-2xl font-black text-foreground tracking-wider">
              WORKOUT HISTORY
            </h1>
          </div>
        </header>

        {/* Empty State */}
        <div className="px-4">
          <div className="rounded-2xl border-2 border-dashed border-surface-3 p-8 text-center">
            <p className="text-muted-foreground uppercase tracking-wider">
              No History Yet
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default History;
