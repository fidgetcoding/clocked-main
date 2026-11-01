export const MAX_BODY_LENGTH = 16 * 1024;
export const MAX_PROMPT_LENGTH = 2000;
export const MAX_EQUIPMENT_KEYS = 20;
export const MAX_LABEL_LENGTH = 40;

export interface GenerateRequest {
  prompt: string;
  userTier: string;
  equipment: Record<string, boolean>;
  experienceLevel: string;
  historyInsights?: {
    averageDifficulty: string | null;
    recentTrend: string | null;
    preferredDuration: number;
    suggestedDifficultyAdjust: number;
    totalWorkouts: number;
  };
}

export type ValidationResult =
  | { ok: true; value: GenerateRequest }
  | { ok: false; error: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLabel = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_LABEL_LENGTH;

const labelOrNull = (value: unknown): string | null => (isLabel(value) ? value : null);

const finiteOrZero = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

// Every field here ends up in the AI prompt, so all of them are bounded, not just `prompt`.
// Returns a fresh object holding only known fields.
export function validateGenerateRequest(body: unknown): ValidationResult {
  if (!isPlainObject(body)) return { ok: false, error: 'Request body must be a JSON object' };

  const { prompt, userTier, experienceLevel, equipment, historyInsights } = body;

  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return { ok: false, error: 'prompt must be a non-empty string' };
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: `prompt must be ${MAX_PROMPT_LENGTH} characters or less` };
  }
  if (userTier !== undefined && !isLabel(userTier)) {
    return { ok: false, error: 'userTier is invalid' };
  }
  if (experienceLevel !== undefined && !isLabel(experienceLevel)) {
    return { ok: false, error: 'experienceLevel is invalid' };
  }
  if (equipment !== undefined && !isPlainObject(equipment)) {
    return { ok: false, error: 'equipment must be an object' };
  }

  const equipmentEntries = Object.entries(equipment ?? {});
  if (equipmentEntries.length > MAX_EQUIPMENT_KEYS) {
    return { ok: false, error: `equipment can have at most ${MAX_EQUIPMENT_KEYS} keys` };
  }
  if (equipmentEntries.some(([key]) => key.length > MAX_LABEL_LENGTH)) {
    return { ok: false, error: 'equipment key is too long' };
  }

  return {
    ok: true,
    value: {
      prompt,
      userTier: typeof userTier === 'string' ? userTier : 'beginner',
      experienceLevel: typeof experienceLevel === 'string' ? experienceLevel : 'beginner',
      equipment: Object.fromEntries(equipmentEntries.map(([key, has]) => [key, Boolean(has)])),
      historyInsights: isPlainObject(historyInsights)
        ? {
            averageDifficulty: labelOrNull(historyInsights.averageDifficulty),
            recentTrend: labelOrNull(historyInsights.recentTrend),
            preferredDuration: finiteOrZero(historyInsights.preferredDuration),
            suggestedDifficultyAdjust: finiteOrZero(historyInsights.suggestedDifficultyAdjust),
            totalWorkouts: finiteOrZero(historyInsights.totalWorkouts),
          }
        : undefined,
    },
  };
}
