import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface XPPopProps {
  amount: number;
  id: number;
  isChampionship?: boolean;
}

interface ComboXPPopManagerProps {
  pop: XPPopProps | null;
  className?: string;
}

// RPG-style floating XP number that animates upward and fades out
export function ComboXPPop({ pop, className }: ComboXPPopManagerProps) {
  if (!pop) return null;

  return (
    <div 
      key={pop.id}
      className={cn(
        'absolute pointer-events-none font-black text-sm animate-combo-xp-pop',
        pop.isChampionship ? 'text-championship-gold' : 'text-volt/80',
        className,
      )}
    >
      +{pop.amount.toFixed(1)} XP
      {pop.isChampionship && (
        <span className="text-[10px] ml-1 text-championship-gold/70">2x</span>
      )}
    </div>
  );
}
