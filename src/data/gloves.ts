/**
 * Glove Registry — 52 cosmetic gloves unlocked by prestige tier + level.
 */

export interface Glove {
  id: string;
  name: string;
  prestige: string; // 'any' | 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro'
  level: number;
  description: string;
  tierThemeColor: string;
}

export const GLOVES: Record<string, Glove> = {
  // === DEFAULT ===
  default: { id: 'default', name: 'Standard Red', prestige: 'any', level: 0, description: 'Standard red boxing gloves', tierThemeColor: '#CC0000' },

  // === TIER 1: ROOKIE ===
  worn_leather: { id: 'worn_leather', name: 'Worn Leather', prestige: 'rookie', level: 10, description: "Scuffed brown leather — you've started", tierThemeColor: '#8B6914' },
  reinforced_leather: { id: 'reinforced_leather', name: 'Reinforced Leather', prestige: 'rookie', level: 20, description: 'Double-stitched leather, darker tone', tierThemeColor: '#8B6914' },
  hardened_leather: { id: 'hardened_leather', name: 'Hardened Leather', prestige: 'rookie', level: 30, description: 'Dark leather with visible wear marks', tierThemeColor: '#8B6914' },
  steel_studded: { id: 'steel_studded', name: 'Steel-Studded', prestige: 'rookie', level: 40, description: 'Leather with steel rivet accents', tierThemeColor: '#8B6914' },
  bronze_trim: { id: 'bronze_trim', name: 'Bronze Trim', prestige: 'rookie', level: 50, description: 'Bronze metallic trim along knuckles', tierThemeColor: '#8B6914' },
  silver_stitching: { id: 'silver_stitching', name: 'Silver Stitching', prestige: 'rookie', level: 60, description: 'Silver thread stitching, premium look', tierThemeColor: '#8B6914' },
  gold_thread: { id: 'gold_thread', name: 'Gold Thread', prestige: 'rookie', level: 70, description: 'Gold stitching throughout', tierThemeColor: '#8B6914' },
  gold_trim: { id: 'gold_trim', name: 'Gold Trim', prestige: 'rookie', level: 80, description: 'Gold metallic trim and accents', tierThemeColor: '#8B6914' },
  gold_plated: { id: 'gold_plated', name: 'Gold Plated', prestige: 'rookie', level: 90, description: 'Mostly gold surface, leather base', tierThemeColor: '#8B6914' },
  golden: { id: 'golden', name: 'Golden Gloves', prestige: 'rookie', level: 100, description: 'Full solid gold metallic gloves — PRESTIGE REWARD', tierThemeColor: '#FFD700' },

  // === TIER 2: BEGINNER ===
  white_gold: { id: 'white_gold', name: 'White Gold', prestige: 'beginner', level: 10, description: 'Gold base shifting to lighter tone', tierThemeColor: '#C0C0C0' },
  brushed_steel: { id: 'brushed_steel', name: 'Brushed Steel', prestige: 'beginner', level: 20, description: 'Matte steel finish', tierThemeColor: '#C0C0C0' },
  chrome: { id: 'chrome', name: 'Chrome', prestige: 'beginner', level: 30, description: 'Mirror-like chrome surface', tierThemeColor: '#C0C0C0' },
  titanium: { id: 'titanium', name: 'Titanium', prestige: 'beginner', level: 40, description: 'Gunmetal titanium finish', tierThemeColor: '#C0C0C0' },
  titanium_elite: { id: 'titanium_elite', name: 'Titanium Elite', prestige: 'beginner', level: 50, description: 'Polished titanium with edge details', tierThemeColor: '#C0C0C0' },
  sterling_silver: { id: 'sterling_silver', name: 'Sterling Silver', prestige: 'beginner', level: 60, description: 'Classic silver with subtle shine', tierThemeColor: '#C0C0C0' },
  silver_elite: { id: 'silver_elite', name: 'Silver Elite', prestige: 'beginner', level: 70, description: 'Bright silver with knuckle detailing', tierThemeColor: '#C0C0C0' },
  palladium: { id: 'palladium', name: 'Palladium', prestige: 'beginner', level: 80, description: 'Rare white metal, understated luxury', tierThemeColor: '#C0C0C0' },
  platinum_trim: { id: 'platinum_trim', name: 'Platinum Trim', prestige: 'beginner', level: 90, description: 'Platinum accents over silver base', tierThemeColor: '#C0C0C0' },
  platinum: { id: 'platinum', name: 'Platinum Gloves', prestige: 'beginner', level: 100, description: 'Full platinum metallic gloves — PRESTIGE REWARD', tierThemeColor: '#E5E4E2' },

  // === TIER 3: INTERMEDIATE ===
  jade: { id: 'jade', name: 'Jade', prestige: 'intermediate', level: 10, description: 'Soft green jade mineral texture', tierThemeColor: '#2E8B57' },
  malachite: { id: 'malachite', name: 'Malachite', prestige: 'intermediate', level: 20, description: 'Dark green with banded pattern', tierThemeColor: '#2E8B57' },
  peridot: { id: 'peridot', name: 'Peridot', prestige: 'intermediate', level: 30, description: 'Light yellow-green gemstone surface', tierThemeColor: '#2E8B57' },
  tourmaline: { id: 'tourmaline', name: 'Tourmaline', prestige: 'intermediate', level: 40, description: 'Deep green crystalline finish', tierThemeColor: '#2E8B57' },
  green_sapphire: { id: 'green_sapphire', name: 'Green Sapphire', prestige: 'intermediate', level: 50, description: 'Rich green with sapphire clarity', tierThemeColor: '#2E8B57' },
  aventurine: { id: 'aventurine', name: 'Aventurine', prestige: 'intermediate', level: 60, description: 'Sparkling green with mineral flecks', tierThemeColor: '#2E8B57' },
  chrome_diopside: { id: 'chrome_diopside', name: 'Chrome Diopside', prestige: 'intermediate', level: 70, description: 'Vivid forest green, high luster', tierThemeColor: '#2E8B57' },
  tsavorite: { id: 'tsavorite', name: 'Tsavorite', prestige: 'intermediate', level: 80, description: 'Brilliant green, nearly emerald', tierThemeColor: '#2E8B57' },
  emerald_trim: { id: 'emerald_trim', name: 'Emerald Trim', prestige: 'intermediate', level: 90, description: 'Emerald accents over green base', tierThemeColor: '#2E8B57' },
  emerald: { id: 'emerald', name: 'Emerald Gloves', prestige: 'intermediate', level: 100, description: 'Full deep emerald crystalline gloves — PRESTIGE REWARD', tierThemeColor: '#50C878' },

  // === TIER 4: ADVANCED ===
  garnet: { id: 'garnet', name: 'Garnet', prestige: 'advanced', level: 10, description: 'Deep red-brown garnet surface', tierThemeColor: '#CC0000' },
  carnelian: { id: 'carnelian', name: 'Carnelian', prestige: 'advanced', level: 20, description: 'Warm orange-red stone finish', tierThemeColor: '#CC0000' },
  red_jasper: { id: 'red_jasper', name: 'Red Jasper', prestige: 'advanced', level: 30, description: 'Rich red with natural veining', tierThemeColor: '#CC0000' },
  fire_opal: { id: 'fire_opal', name: 'Fire Opal', prestige: 'advanced', level: 40, description: 'Fiery orange-red with internal glow', tierThemeColor: '#CC0000' },
  spinel: { id: 'spinel', name: 'Spinel', prestige: 'advanced', level: 50, description: 'True red gemstone, high clarity', tierThemeColor: '#CC0000' },
  rhodolite: { id: 'rhodolite', name: 'Rhodolite', prestige: 'advanced', level: 60, description: 'Rose-red with purple undertones', tierThemeColor: '#CC0000' },
  bloodstone: { id: 'bloodstone', name: 'Bloodstone', prestige: 'advanced', level: 70, description: 'Deep crimson with dark accents', tierThemeColor: '#CC0000' },
  rubellite: { id: 'rubellite', name: 'Rubellite', prestige: 'advanced', level: 80, description: 'Pink-red tourmaline, near-ruby quality', tierThemeColor: '#CC0000' },
  ruby_trim: { id: 'ruby_trim', name: 'Ruby Trim', prestige: 'advanced', level: 90, description: 'Ruby accents over red base', tierThemeColor: '#CC0000' },
  ruby: { id: 'ruby', name: 'Ruby Gloves', prestige: 'advanced', level: 100, description: 'Full red ruby gemstone gloves — PRESTIGE REWARD', tierThemeColor: '#E0115F' },

  // === TIER 5: PRO ===
  quartz: { id: 'quartz', name: 'Quartz', prestige: 'pro', level: 10, description: 'Clear quartz crystal surface', tierThemeColor: '#E8E8E8' },
  white_topaz: { id: 'white_topaz', name: 'White Topaz', prestige: 'pro', level: 20, description: 'Bright white gemstone finish', tierThemeColor: '#E8E8E8' },
  moonstone: { id: 'moonstone', name: 'Moonstone', prestige: 'pro', level: 30, description: 'Pearlescent white with blue shimmer', tierThemeColor: '#E8E8E8' },
  zircon: { id: 'zircon', name: 'Zircon', prestige: 'pro', level: 40, description: 'Brilliant white, high refraction', tierThemeColor: '#E8E8E8' },
  white_sapphire: { id: 'white_sapphire', name: 'White Sapphire', prestige: 'pro', level: 50, description: 'Pure white sapphire clarity', tierThemeColor: '#E8E8E8' },
  crystal: { id: 'crystal', name: 'Crystal', prestige: 'pro', level: 60, description: 'Prismatic crystal surface', tierThemeColor: '#E8E8E8' },
  ice_diamond: { id: 'ice_diamond', name: 'Ice Diamond', prestige: 'pro', level: 70, description: 'Cool blue-white diamond tone', tierThemeColor: '#E8E8E8' },
  diamond_dust: { id: 'diamond_dust', name: 'Diamond Dust', prestige: 'pro', level: 80, description: 'Sparkling diamond particle surface', tierThemeColor: '#E8E8E8' },
  diamond_trim: { id: 'diamond_trim', name: 'Diamond Trim', prestige: 'pro', level: 90, description: 'Diamond accents over crystal base', tierThemeColor: '#E8E8E8' },
  diamond: { id: 'diamond', name: 'Diamond Gloves', prestige: 'pro', level: 100, description: 'Full diamond-encrusted sparkling gloves — PRESTIGE REWARD', tierThemeColor: '#B9F2FF' },

  // === ULTIMATE: BMF ===
  bmf: { id: 'bmf', name: 'BMF Gloves', prestige: 'pro', level: 500, description: 'The rarest item in Get Clocked. Absolute mastery.', tierThemeColor: '#FFD700' },
};

export const PRESTIGE_ORDER = ['rookie', 'beginner', 'intermediate', 'advanced', 'pro'] as const;

export const TIER_SECTIONS = [
  { key: 'rookie', label: 'ROOKIE', subtitle: 'Raw Leather → Gold' },
  { key: 'beginner', label: 'BEGINNER', subtitle: 'Gold → Platinum' },
  { key: 'intermediate', label: 'INTERMEDIATE', subtitle: 'Platinum → Emerald' },
  { key: 'advanced', label: 'ADVANCED', subtitle: 'Emerald → Ruby' },
  { key: 'pro', label: 'PRO', subtitle: 'Ruby → Diamond' },
  { key: 'bmf', label: 'BMF', subtitle: 'Ultimate' },
] as const;

/**
 * Compute full list of unlocked glove IDs based on prestige + level + streak.
 */
export function checkGloveUnlocks(prestige: string, level: number, streakDays: number): string[] {
  const currentIndex = (PRESTIGE_ORDER as readonly string[]).indexOf(prestige.toLowerCase());
  const unlocked: string[] = ['default'];

  for (const [id, glove] of Object.entries(GLOVES)) {
    if (id === 'default' || id === 'bmf') continue;
    const glovePrestigeIndex = (PRESTIGE_ORDER as readonly string[]).indexOf(glove.prestige);
    if (glovePrestigeIndex < 0) continue;

    if (glovePrestigeIndex < currentIndex) {
      unlocked.push(id);
    } else if (glovePrestigeIndex === currentIndex && level >= glove.level) {
      unlocked.push(id);
    }
  }

  // BMF: Pro Level 500 + 365-day streak
  if (prestige === 'pro' && level >= 500 && streakDays >= 365) {
    unlocked.push('bmf');
  }

  return unlocked;
}

/** Get gloves for a specific tier section */
export function getGlovesForTier(tierKey: string): Glove[] {
  if (tierKey === 'bmf') {
    return [GLOVES.bmf];
  }
  return Object.values(GLOVES).filter(
    g => g.prestige === tierKey && g.id !== 'default'
  ).sort((a, b) => a.level - b.level);
}
