import { Button } from '@/components/ui/button';

export type Difficulty = 'too_easy' | 'just_right' | 'too_hard';

const OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'too_easy', label: 'Too Easy' },
  { value: 'just_right', label: 'Just Right' },
  { value: 'too_hard', label: 'Too Hard' },
];

export function DifficultyPicker({ value, onChange }: { value: Difficulty | null; onChange: (value: Difficulty) => void }) {
  return (
    <div>
      <p className="lab mb-2">Difficulty</p>
      <div className="flex gap-3" role="group" aria-label="Difficulty">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            aria-pressed={value === option.value}
            variant={value === option.value ? 'default' : 'secondary'}
            onClick={() => onChange(option.value)}
            className="min-w-0 flex-1 px-1 text-lg"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
