import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/useAuth';
import { generateLoadoutWorkout, UserEquipmentConfig } from '@/lib/loadoutGenerator';
import { Prestige, PRESTIGE_ORDER } from '@/lib/xpSystem';

export interface TierPreset {
  id: string;
  tier: string;
  equipment_mode: string;
  name: string;
  description: string | null;
  loadout: Record<string, unknown>;
  created_at: string;
}

export interface TierPresetWithLoadout extends TierPreset {
  generatedLoadout: ReturnType<typeof generateLoadoutWorkout>;
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
 * The same catalog built on the device, for guests (tier_presets needs an account) and for
 * projects that haven't added curated rows to tier_presets. Names come from the generator.
 */
function buildGeneratedPresets(equipmentMode: 'shadow' | 'bag', userTier: Prestige): TierPreset[] {
  return PRESTIGE_ORDER.filter((tier) => tier !== userTier).map((tier) => {
    const equipConfig = equipmentMode === 'bag' ? BAG_EQUIPMENT : SHADOW_EQUIPMENT;
    return {
      id: `generated-preset-${tier}-${equipmentMode}`,
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

  const generatedPresets = useMemo(() => buildGeneratedPresets(equipmentMode, userTier), [equipmentMode, userTier]);
  const presets = isGuest || dbPresets?.length === 0 ? generatedPresets : dbPresets;

  // Generate loadouts
  const enrichedPresets: TierPresetWithLoadout[] = (presets || []).map((preset) => {
    const equipConfig = preset.equipment_mode === 'bag' ? BAG_EQUIPMENT : SHADOW_EQUIPMENT;
    const experienceLevel = (preset.loadout?.experienceLevel as string | undefined) || preset.tier;
    const generatedLoadout = generateLoadoutWorkout(experienceLevel, equipConfig);
    
    // Override generated name with the curated DB name
    generatedLoadout.name = preset.name;

    return {
      ...preset,
      generatedLoadout,
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
