import { EXERCISE_CATEGORIES } from '@/data/exerciseCategories';
import { useState, useMemo } from 'react';
import { X, Search, Plus, Check, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCustomExercises } from '@/hooks/useCustomExercises';

type Category = 'All' | 'My Exercises' | keyof typeof EXERCISE_CATEGORIES;

interface ExercisePickerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (exercises: string[]) => void;
}

export const ExercisePickerModal = ({ open, onClose, onConfirm }: ExercisePickerModalProps) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [selected, setSelected] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const { exercises: customExercises, addExercise, removeExercise } = useCustomExercises();

  const allCategories: Category[] = useMemo(() => {
    const base: Category[] = ['All'];
    if (customExercises.length > 0) base.push('My Exercises');
    base.push('Warmup / Cooldown', 'Core', 'Lower Body', 'Upper Body', 'Full Body', 'Cardio');
    return base;
  }, [customExercises.length]);

  const filteredExercises = useMemo(() => {
    const query = search.toLowerCase().trim();
    let exercises: { name: string; category: string; customId?: string }[] = [];

    if (activeCategory === 'All') {
      // Add custom exercises first
      for (const ce of customExercises) {
        exercises.push({ name: ce.name, category: 'My Exercises', customId: ce.id });
      }
      for (const [cat, items] of Object.entries(EXERCISE_CATEGORIES)) {
        for (const name of items) {
          exercises.push({ name, category: cat });
        }
      }
    } else if (activeCategory === 'My Exercises') {
      exercises = customExercises.map(ce => ({ name: ce.name, category: 'My Exercises', customId: ce.id }));
    } else {
      const items = EXERCISE_CATEGORIES[activeCategory as keyof typeof EXERCISE_CATEGORIES] || [];
      exercises = items.map(name => ({ name, category: activeCategory }));
    }

    if (query) {
      exercises = exercises.filter(e => e.name.toLowerCase().includes(query));
    }

    return exercises;
  }, [search, activeCategory, customExercises]);

  const toggleExercise = (name: string) => {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleConfirm = () => {
    if (selected.length > 0) {
      onConfirm(selected);
      setSelected([]);
      setSearch('');
      setActiveCategory('All');
      onClose();
    }
  };

  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (trimmed) {
      onConfirm([trimmed]);
      setCustomText('');
      setSelected([]);
      setSearch('');
      setActiveCategory('All');
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-surface-3">
        <button onClick={onClose} className="text-muted-foreground">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold text-foreground">Add Exercise</h2>
        <div className="w-6" />
      </header>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface-1 border-surface-3 text-foreground"
          />
        </div>
      </div>

      {/* Custom entry */}
      <div className="px-4 pb-3">
        <div className="flex gap-2">
          <Input
            placeholder="Custom exercise name..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); }}
            className="flex-1 bg-surface-1 border-surface-3 text-foreground text-sm"
          />
          <button
            onClick={handleAddCustom}
            disabled={!customText.trim()}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors',
              customText.trim()
                ? 'bg-volt text-background'
                : 'bg-surface-2 text-muted-foreground opacity-50'
            )}
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              activeCategory === cat
                ? 'bg-volt text-background'
                : 'bg-surface-1 text-muted-foreground border border-surface-3'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Exercise List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
        {filteredExercises.map((exercise) => {
          const isSelected = selected.includes(exercise.name);
          return (
            <div
              key={`${exercise.category}-${exercise.name}`}
              className={cn(
                'w-full flex items-center rounded-lg p-3 border transition-colors',
                isSelected
                  ? 'bg-volt/10 border-volt'
                  : 'bg-surface-1 border-surface-3'
              )}
            >
              {/* Tap name area = quick add */}
              <button
                className="flex-1 text-left"
                onClick={() => {
                  onConfirm([exercise.name]);
                  setSearch('');
                  setActiveCategory('All');
                  setSelected([]);
                  onClose();
                }}
              >
                <span className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-volt' : 'text-foreground'
                )}>
                  {exercise.name}
                </span>
                {activeCategory === 'All' && (
                  <span className="text-[10px] text-muted-foreground ml-2 uppercase">
                    {exercise.category}
                  </span>
                )}
              </button>

              {/* Delete button for custom exercises */}
              {exercise.customId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeExercise.mutate(exercise.customId!);
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ml-1 bg-surface-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Tap + icon = toggle multi-select */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExercise(exercise.name);
                }}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ml-2 transition-colors',
                  isSelected
                    ? 'bg-volt text-background'
                    : 'bg-surface-2 text-volt/60 hover:bg-surface-3'
                )}
              >
                {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          );
        })}
        {filteredExercises.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No exercises found — try a custom entry above
          </p>
        )}
      </div>

      {/* Confirm Button for multi-select sets */}
      {selected.length > 0 && (
        <div className="px-4 py-4 border-t border-surface-3 safe-bottom">
          <button
            onClick={handleConfirm}
            className="w-full py-3 rounded-xl bg-volt text-background font-bold text-sm"
          >
            Add {selected.length === 1 ? selected[0] : `${selected.length} exercises as set`}
          </button>
        </div>
      )}
    </div>
  );
};
