// =====================================================
// Combo Parser - Converts natural language to punch notation
// =====================================================

// Punch name to number mapping
export const PUNCH_MAP: Record<string, string> = {
  // Jab (1)
  'jab': '1',
  'j': '1',
  '1': '1',
  
  // Cross (2)
  'cross': '2',
  'straight': '2',
  'right': '2',
  '2': '2',
  
  // Lead Hook (3)
  'hook': '3',
  'lead hook': '3',
  'left hook': '3',
  'lhook': '3',
  '3': '3',
  
  // Rear Hook (4)
  'rear hook': '4',
  'right hook': '4',
  'rhook': '4',
  '4': '4',
  
  // Lead Uppercut (5)
  'uppercut': '5',
  'lead uppercut': '5',
  'left uppercut': '5',
  'upper': '5',
  '5': '5',
  
  // Rear Uppercut (6)
  'rear uppercut': '6',
  'right uppercut': '6',
  '6': '6',
  
  // Lead Body Hook (7)
  'body hook': '7',
  'lead body': '7',
  'body': '7',
  '7': '7',
  
  // Rear Body Hook (8)
  'rear body': '8',
  'right body': '8',
  '8': '8',
};

// Defense move mapping
export const DEFENSE_MAP: Record<string, string> = {
  // Slips
  'slip': 'SLIP L',
  'slip l': 'SLIP L',
  'slip left': 'SLIP L',
  'slipl': 'SLIP L',
  'slip r': 'SLIP R',
  'slip right': 'SLIP R',
  'slipr': 'SLIP R',
  
  // Rolls
  'roll': 'ROLL L',
  'roll l': 'ROLL L',
  'roll left': 'ROLL L',
  'rolll': 'ROLL L',
  'roll r': 'ROLL R',
  'roll right': 'ROLL R',
  'rollr': 'ROLL R',
  
  // Duck
  'duck': 'DUCK',
  
  // Pull
  'pull': 'PULL',
  'pullback': 'PULL',
  'pull back': 'PULL',
  
  // Block
  'block': 'BLOCK',
  'guard': 'BLOCK',
  
  // Parry
  'parry': 'PARRY',
};

// Movement mapping
export const MOVEMENT_MAP: Record<string, string> = {
  'step in': 'STEP IN',
  'stepin': 'STEP IN',
  'in': 'STEP IN',
  'step out': 'STEP OUT',
  'stepout': 'STEP OUT',
  'out': 'STEP OUT',
  'circle l': 'CIRCLE L',
  'circle left': 'CIRCLE L',
  'circlel': 'CIRCLE L',
  'circle r': 'CIRCLE R',
  'circle right': 'CIRCLE R',
  'circler': 'CIRCLE R',
  'circle': 'CIRCLE L',
  'pivot': 'PIVOT',
};

// All moves combined for quick lookup
const ALL_MOVES: Record<string, string> = {
  ...PUNCH_MAP,
  ...DEFENSE_MAP,
  ...MOVEMENT_MAP,
};

/**
 * Parse a combo string into an array of normalized moves
 * 
 * Examples:
 * - "1-2-slip-3" → ["1", "2", "SLIP L", "3"]
 * - "jab cross hook" → ["1", "2", "3"]
 * - "double jab cross" → ["1", "1", "2"]
 * - "jab, cross, slip, hook" → ["1", "2", "SLIP L", "3"]
 */
export function parseComboString(input: string): string[] {
  if (!input || input.trim() === '') return [];
  
  const normalized = input.toLowerCase().trim();
  const result: string[] = [];
  
  // Split on dashes, commas, and spaces
  // But preserve multi-word moves like "slip left", "step in", etc.
  const tokens = tokenizeCombo(normalized);
  
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i].trim();
    if (!token) {
      i++;
      continue;
    }
    
    // Check for "double" or "triple" modifier
    if (token === 'double' && i + 1 < tokens.length) {
      const nextMove = resolveMoveToken(tokens[i + 1], tokens[i + 2]);
      if (nextMove.move) {
        result.push(nextMove.move, nextMove.move);
        i += 1 + nextMove.consumed;
        continue;
      }
    }
    
    if (token === 'triple' && i + 1 < tokens.length) {
      const nextMove = resolveMoveToken(tokens[i + 1], tokens[i + 2]);
      if (nextMove.move) {
        result.push(nextMove.move, nextMove.move, nextMove.move);
        i += 1 + nextMove.consumed;
        continue;
      }
    }
    
    // Try to match multi-word moves first
    const resolved = resolveMoveToken(token, tokens[i + 1]);
    if (resolved.move) {
      result.push(resolved.move);
      i += resolved.consumed;
    } else {
      // Unknown token, skip
      i++;
    }
  }
  
  return result;
}

/**
 * Tokenize a combo string, splitting on delimiters but preserving structure
 */
function tokenizeCombo(input: string): string[] {
  // Replace common delimiters with spaces, then split
  return input
    .replace(/[-,]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

/**
 * Resolve a token (or token pair) to a move
 * Returns the move and how many tokens were consumed
 */
function resolveMoveToken(
  token: string, 
  nextToken?: string
): { move: string | null; consumed: number } {
  // Try exact match first
  if (ALL_MOVES[token]) {
    return { move: ALL_MOVES[token], consumed: 1 };
  }
  
  // Try two-word combo (e.g., "slip left", "step in")
  if (nextToken) {
    const twoWord = `${token} ${nextToken}`;
    if (ALL_MOVES[twoWord]) {
      return { move: ALL_MOVES[twoWord], consumed: 2 };
    }
  }
  
  // Try partial matches for defense/movement with direction suffix
  // e.g., "slipl" → "SLIP L"
  for (const [key, value] of Object.entries(ALL_MOVES)) {
    if (key.replace(/\s/g, '') === token) {
      return { move: value, consumed: 1 };
    }
  }
  
  return { move: null, consumed: 1 };
}

/**
 * Check if a string contains any combo notation
 */
export function containsComboNotation(input: string): boolean {
  const normalized = input.toLowerCase();
  
  // Check for numbered punches
  if (/\b[1-8]\b/.test(normalized)) return true;
  
  // Check for punch names
  const punchKeywords = ['jab', 'cross', 'hook', 'uppercut', 'body'];
  if (punchKeywords.some(k => normalized.includes(k))) return true;
  
  // Check for defense moves
  const defenseKeywords = ['slip', 'roll', 'duck', 'pull', 'block', 'parry'];
  if (defenseKeywords.some(k => normalized.includes(k))) return true;
  
  // Check for dash-notation (1-2-3 style)
  if (/\d+-\d+/.test(normalized)) return true;
  
  return false;
}

/**
 * Extract all combo-like patterns from a prompt
 * Returns array of combo strings found
 */
export function extractCombosFromPrompt(prompt: string): string[] {
  const combos: string[] = [];
  const normalized = prompt.toLowerCase();
  
  // Pattern 1: Dash notation (1-2-slip-3)
  const dashPattern = /\b(\d(?:[-\s]*(?:\d|slip|roll|duck|hook|cross|jab|upper|body|step|circle|in|out|l|r|left|right))+)\b/gi;
  const dashMatches = normalized.match(dashPattern);
  if (dashMatches) {
    combos.push(...dashMatches);
  }
  
  // Pattern 2: "combo" or "combo:" followed by content
  const comboLabelPattern = /combo:?\s*([^,.\n]+)/gi;
  let match;
  while ((match = comboLabelPattern.exec(normalized)) !== null) {
    combos.push(match[1].trim());
  }
  
  // Pattern 3: Quoted combo strings
  const quotedPattern = /["']([^"']+)["']/g;
  while ((match = quotedPattern.exec(prompt)) !== null) {
    const content = match[1];
    if (containsComboNotation(content)) {
      combos.push(content);
    }
  }
  
  return combos;
}

/**
 * Validate if a combo array contains valid moves
 */
export function isValidCombo(combo: string[]): boolean {
  if (!combo || combo.length === 0) return false;
  
  const validMoves = new Set([
    '1', '2', '3', '4', '5', '6', '7', '8',
    'SLIP L', 'SLIP R', 'ROLL L', 'ROLL R', 'DUCK', 'PULL', 'BLOCK', 'PARRY',
    'STEP IN', 'STEP OUT', 'CIRCLE L', 'CIRCLE R', 'PIVOT',
  ]);
  
  return combo.every(move => validMoves.has(move));
}

/**
 * Pretty-print a combo for display
 */
export function formatComboDisplay(combo: string[]): string {
  return combo.join(' - ');
}
