import type { Database } from '@/integrations/supabase/types';
import { toJson } from '@/lib/json';
import { parsePunchLog, type PunchLog } from '@/lib/punch/sessionLog';
import type { RoundFeedback } from '@/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useHistoryStore } from '@/stores/historyStore';

export interface WorkoutHistoryEntry {
  id: string;
  user_id: string;
  workout_id: string | null;
  workout_name: string;
  completed_at: string;
  duration: number;
  xp_earned: number;
  difficulty: string | null;
  notes: string | null;
  is_manual_entry: boolean;
  round_feedback: RoundFeedback[];
  /** Sessions with the camera on. Older rows and every other session have none. */
  punch_log?: PunchLog | null;
  created_at: string;
}

type HistoryRow = Database['public']['Tables']['workout_history']['Row'];

// Everything but punch_log, which can run to megabytes across a history. It's fetched when a session is opened.
const LIST_COLUMNS = 'id, user_id, workout_id, workout_name, completed_at, duration, xp_earned, difficulty, notes, is_manual_entry, round_feedback, created_at';

/** Saved round ratings, leaving out any entry that isn't one. */
export function normalizeRoundFeedback(value: unknown): RoundFeedback[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): RoundFeedback[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { roundNumber, rating, notes } = entry as Record<string, unknown>;
    if (typeof roundNumber !== 'number' || !Number.isFinite(roundNumber)) return [];
    if (typeof rating !== 'number' || !Number.isFinite(rating)) return [];
    return [{ roundNumber, rating: Math.min(5, Math.max(1, Math.round(rating))), ...(typeof notes === 'string' ? { notes } : {}) }];
  });
}

const toHistoryEntry = (row: Omit<HistoryRow, 'punch_log' | 'profile_credited_at'>): WorkoutHistoryEntry => ({
  ...row,
  round_feedback: normalizeRoundFeedback(row.round_feedback),
});

/** One opened session's log. A guest's is already on the entry, kept in this browser. */
export function useWorkoutPunchLog(entry: WorkoutHistoryEntry) {
  const { isGuest } = useAuth();
  const { data = null } = useQuery({
    queryKey: ['workout-punch-log', entry.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('workout_history').select('punch_log').eq('id', entry.id).single();
      if (error) throw error;
      return parsePunchLog(data.punch_log);
    },
    enabled: !isGuest,
  });
  return isGuest ? entry.punch_log ?? null : data;
}

export function useWorkoutHistory() {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const guestHistory = useHistoryStore((state) => state.guestHistory);

  const { data: dbHistory = [], isLoading, error } = useQuery({
    queryKey: ['workout-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('workout_history')
        .select(LIST_COLUMNS)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });
      
      if (error) throw error;
      return data.map(toHistoryEntry);
    },
    enabled: !!user?.id,
  });

  const history = isGuest ? guestHistory : dbHistory;

  const addHistoryEntry = useMutation({
    /** Pass an id to make the insert safe to repeat: the row it already made comes back instead of a second one. */
    mutationFn: async (entry: Omit<WorkoutHistoryEntry, 'id' | 'user_id' | 'created_at'> & { id?: string }) => {
      if (isGuest) return useHistoryStore.getState().addGuestEntry(entry);
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('workout_history')
        .insert({ ...entry, round_feedback: toJson(entry.round_feedback), punch_log: toJson(entry.punch_log), user_id: user.id })
        .select(LIST_COLUMNS)
        .single();
      
      if (error?.code === '23505' && entry.id) {
        const { data: saved, error: readError } = await supabase.from('workout_history').select(LIST_COLUMNS).eq('id', entry.id).single();
        if (readError) throw readError;
        return toHistoryEntry(saved);
      }
      if (error) throw error;
      return toHistoryEntry(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history', user?.id] });
    },
  });

  const updateHistoryEntry = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkoutHistoryEntry> & { id: string }) => {
      if (isGuest) return useHistoryStore.getState().updateGuestEntry(id, updates);
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('workout_history')
        .update({ ...updates, round_feedback: updates.round_feedback && toJson(updates.round_feedback), punch_log: toJson(updates.punch_log) })
        .eq('id', id)
        .eq('user_id', user.id)
        .select(LIST_COLUMNS)
        .single();
      
      if (error) throw error;
      return toHistoryEntry(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history', user?.id] });
    },
  });

  const deleteHistoryEntry = useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) return useHistoryStore.getState().deleteGuestEntry(id);
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('workout_history')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history', user?.id] });
    },
  });

  return {
    history,
    isLoading,
    error,
    addHistoryEntry,
    updateHistoryEntry,
    deleteHistoryEntry,
  };
}
