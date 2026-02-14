import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
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
 * Sort presets aspirationally: next tier above user first, then ascending, lower tiers last.
 */
function sortAspirational(presets: TierPresetWithLoadout[], userTier: Prestige): TierPresetWithLoadout[] {
  const userIdx = PRESTIGE_ORDER.indexOf(userTier);
  
  return [...presets].sort((a, b) => {
    const aIdx = PRESTIGE_ORDER.indexOf(a.tier as Prestige);
    const bIdx = PRESTIGE_ORDER.indexOf(b.tier as Prestige);
    const aAbove = aIdx > userIdx;
    const bAbove = bIdx > userIdx;
    
    // Above-user tiers come first, sorted ascending
    if (aAbove && !bAbove) return -1;
    if (!aAbove && bAbove) return 1;
    if (aAbove && bAbove) return aIdx - bIdx;
    // Below-user tiers sorted ascending
    return aIdx - bIdx;
  });
}

export function useTierPresets() {
  const { profile } = useProfile();
  const userTier = (profile?.prestige || 'rookie') as Prestige;
  const equipmentMode = getUserEquipmentMode(profile?.equipment || null);

  // Fetch presets for the user's equipment mode, excluding their tier
  const { data: presets, isLoading: presetsLoading } = useQuery({
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
    enabled: !!profile,
  });

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
    enabled: !!profile,
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

  const sortedPresets = sortAspirational(enrichedPresets, userTier);

  return {
    presets: sortedPresets,
    isLoading: presetsLoading,
    userTier,
    equipmentMode,
  };
}
