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
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-clip bg-background">
      <div className="mx-auto flex min-h-full max-w-[46rem] flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-background px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button type="button" aria-label="Close" onClick={onClose} className="plate plate-graphite h-11 w-12 shrink-0">
            <X className="size-5" />
          </button>
          <h2 className="fx min-w-0 truncate py-1 text-5xl">Add Exercise</h2>
        </header>

        {/* Search */}
        <div className="px-4">
          <div className="relative">
            <Search className="absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-6"
            />
          </div>
        </div>

        {/* Custom entry */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-2">
          <Input
            placeholder="Custom exercise name..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); }}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={!customText.trim()}
            className={cn('plate fx h-11 shrink-0 gap-1 px-4 text-xl disabled:opacity-40', customText.trim() ? 'plate-lime' : 'plate-graphite')}
          >
            <Plus className="size-4" />
            Add
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 pb-3">
          {allCategories.map((cat) => (
            <button
              type="button"
              key={cat}
              aria-pressed={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              className={cn('plate fx h-11 px-3 text-xl', activeCategory === cat ? 'plate-white' : 'plate-graphite')}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Exercise List */}
        <div className="flex-1 border-t border-surface-3">
          {filteredExercises.map((exercise) => {
            const isSelected = selected.includes(exercise.name);
            return (
              <div
                key={`${exercise.category}-${exercise.name}`}
                className={cn('flex items-center gap-1 border-b border-surface-2 pr-4', isSelected && 'bg-surface-2')}
              >
                {/* Tap name area = quick add */}
                <button
                  type="button"
                  className="min-h-11 min-w-0 flex-1 py-1.5 pl-4 text-left transition-colors hover:text-volt"
                  onClick={() => {
                    onConfirm([exercise.name]);
                    setSearch('');
                    setActiveCategory('All');
                    setSelected([]);
                    onClose();
                  }}
                >
                  <span className={cn('fx block text-3xl', isSelected && 'text-volt')}>
                    {exercise.name}
                  </span>
                  {activeCategory === 'All' && (
                    <span className="lab mt-1 block">
                      {exercise.category}
                    </span>
                  )}
                </button>

                {/* Delete button for custom exercises */}
                {exercise.customId && (
                  <button
                    type="button"
                    aria-label={`Delete ${exercise.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeExercise.mutate(exercise.customId!);
                    }}
                    className="flex h-11 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}

                {/* Tap + icon = toggle multi-select */}
                <button
                  type="button"
                  aria-label={`${isSelected ? 'Take out of' : 'Put in'} the set: ${exercise.name}`}
                  aria-pressed={isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExercise(exercise.name);
                  }}
                  className={cn('plate h-11 w-12 shrink-0', isSelected ? 'plate-lime' : 'plate-graphite')}
                >
                  {isSelected ? <Check className="size-5" /> : <Plus className="size-5" />}
                </button>
              </div>
            );
          })}
          {filteredExercises.length === 0 && (
            <p className="prose-w px-4 py-8 text-base text-muted-foreground">
              No exercises found — try a custom entry above
            </p>
          )}
        </div>

        {/* Confirm Button for multi-select sets */}
        {selected.length > 0 && (
          <div className="sticky bottom-0 bg-background px-5 pb-3 pt-2 safe-bottom">
            <button
              type="button"
              onClick={handleConfirm}
              className="plate plate-lime fx min-h-14 w-full !whitespace-normal px-4 py-2 text-2xl leading-none"
            >
              Add {selected.length === 1 ? selected[0] : `${selected.length} exercises as set`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
