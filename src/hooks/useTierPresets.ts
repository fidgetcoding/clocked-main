import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { generateLoadoutWorkout, UserEquipmentConfig } from '@/lib/loadoutGenerator';
import { Prestige, PRESTIGE_ORDER } from '@/lib/xpSystem';

export interface TierPreset {
  id: string;
  tier: string;
  equipment_mode: string;
  name: string;
  description: string | null;
  loadout: Record<string, any>;
  created_at: string;
}

export interface TierPresetWithLoadout extends TierPreset {
  generatedLoadout: ReturnType<typeof generateLoadoutWorkout>;
  userCount: number;
}

const SHADOW_EQUIPMENT: UserEquipmentConfig = {
  gloves: false, wraps: false, jumpRope: false,
  heavyBag: false, doubleEndBag: false, speedBag: false, treadmill: false,
};

const BAG_EQUIPMENT: UserEquipmentConfig = {
  gloves: true, wraps: true, jumpRope: true,
  heavyBag: true, doubleEndBag: false, speedBag: false, treadmill: false,
};

/**
 * Determine the user's equipment mode based on their profile equipment.
 * If they have gloves + wraps + any bag → 'bag', otherwise 'shadow'.
 */
function getUserEquipmentMode(equipment: Record<string, boolean | string> | null): 'shadow' | 'bag' {
  if (!equipment) return 'shadow';
  const hasGloves = !!equipment.gloves;
  const hasWraps = !!equipment.wraps;
  const hasBag = !!equipment.heavyBag || !!equipment.doubleEndBag;
  return (hasGloves && hasWraps && hasBag) ? 'bag' : 'shadow';
}

/**
 * Sort presets by difficulty: highest tier first (Pro → Advanced → … → Rookie).
 */
function sortByDifficultyDesc(presets: TierPresetWithLoadout[]): TierPresetWithLoadout[] {
  return [...presets].sort((a, b) => {
    const aIdx = PRESTIGE_ORDER.indexOf(a.tier as Prestige);
    const bIdx = PRESTIGE_ORDER.indexOf(b.tier as Prestige);
    return bIdx - aIdx; // highest first
  });
}

/**
 * tier_presets is only readable with an account, so guests get the same catalog built
 * on the device. Names come from the generator and there are no user counts to show.
 */
function buildGuestPresets(equipmentMode: 'shadow' | 'bag', userTier: Prestige): TierPreset[] {
  return PRESTIGE_ORDER.filter((tier) => tier !== userTier).map((tier) => {
    const equipConfig = equipmentMode === 'bag' ? BAG_EQUIPMENT : SHADOW_EQUIPMENT;
    return {
      id: `guest-preset-${tier}-${equipmentMode}`,
      tier,
      equipment_mode: equipmentMode,
      name: generateLoadoutWorkout(tier, equipConfig).name,
      description: null,
      loadout: {},
      created_at: new Date(0).toISOString(),
    };
  });
}

export function useTierPresets() {
  const { user, isGuest } = useAuth();
  const { profile } = useProfile();
  const userTier = (profile?.prestige || 'rookie') as Prestige;
  const equipmentMode = getUserEquipmentMode(profile?.equipment || null);

  // Fetch presets for the user's equipment mode, excluding their tier
  const { data: dbPresets, isLoading: presetsLoading } = useQuery({
    queryKey: ['tier-presets', equipmentMode, userTier],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tier_presets')
        .select('*')
        .eq('equipment_mode', equipmentMode)
        .neq('tier', userTier);
      
      if (error) throw error;
      return (data || []) as TierPreset[];
    },
    enabled: !!profile && !!user,
  });

  const guestPresets = useMemo(() => buildGuestPresets(equipmentMode, userTier), [equipmentMode, userTier]);
  const presets = isGuest ? guestPresets : dbPresets;

  // Fetch tier user counts
  const { data: tierCounts } = useQuery({
    queryKey: ['tier-user-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tier_user_counts');
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((row: { tier: string; user_count: number }) => {
        map[row.tier] = row.user_count;
      });
      return map;
    },
    enabled: !!profile && !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Generate loadouts and merge with user counts
  const enrichedPresets: TierPresetWithLoadout[] = (presets || []).map((preset) => {
    const equipConfig = preset.equipment_mode === 'bag' ? BAG_EQUIPMENT : SHADOW_EQUIPMENT;
    const experienceLevel = (preset.loadout as any)?.experienceLevel || preset.tier;
    const generatedLoadout = generateLoadoutWorkout(experienceLevel, equipConfig);
    
    // Override generated name with the curated DB name
    generatedLoadout.name = preset.name;

    return {
      ...preset,
      generatedLoadout,
      userCount: tierCounts?.[preset.tier] || 0,
    };
  });

  const sortedPresets = sortByDifficultyDesc(enrichedPresets);

  return {
    presets: sortedPresets,
    isLoading: presetsLoading,
    userTier,
    equipmentMode,
  };
}
