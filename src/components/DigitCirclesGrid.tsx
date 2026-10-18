import React from 'react';
import { DigitStat } from '../types';

interface DigitCirclesGridProps {
  stats: DigitStat[];
  activeDigit?: number | null;
  onSelectDigit?: (digit: number) => void;
}

export const DigitCirclesGrid: React.FC<DigitCirclesGridProps> = ({
  stats,
  activeDigit,
  onSelectDigit,
}) => {
  // Ensure we have 10 elements in order 0-9
  const digitMap = new Map<number, DigitStat>();
  stats.forEach((s) => digitMap.set(s.digit, s));

  const digitsRow1 = [0, 1, 2, 3, 4];
  const digitsRow2 = [5, 6, 7, 8, 9];

  const getRankClasses = (stat?: DigitStat, isSelected?: boolean) => {
    if (!stat) return 'bg-[#111827] border-slate-800 text-slate-400';

    const base = 'transition-all duration-300 transform active:scale-95 cursor-pointer shadow-md';

    switch (stat.rank) {
      case 'most':
        return `${base} bg-[#2563eb] text-white border-2 border-blue-400/80 shadow-blue-500/20 shadow-lg`;
      case 'second-most':
        return `${base} bg-[#10b981] text-white border-2 border-emerald-400/80 shadow-emerald-500/20 shadow-lg`;
      case 'second-least':
        return `${base} bg-[#f59e0b] text-white border-2 border-amber-400/80 shadow-amber-500/20 shadow-lg`;
      case 'least':
        return `${base} bg-[#ef4444] text-white border-2 border-rose-400/80 shadow-rose-500/20 shadow-lg`;
      default:
        return `${base} bg-[#111827] hover:bg-[#162032] border border-slate-700/70 text-slate-200`;
    }
  };

  const renderCircle = (d: number) => {
    const stat = digitMap.get(d) || {
      digit: d,
      count: 0,
      percentage: 0,
      rank: 'neutral',
      lastSeenTicksAgo: 0,
    };

    const isSelected = activeDigit === d;
    const isSpecialRank = stat.rank !== 'neutral';

    return (
      <button
        key={d}
        onClick={() => onSelectDigit && onSelectDigit(d)}
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center p-1 relative ${getRankClasses(
          stat,
          isSelected
        )} ${isSelected ? 'ring-4 ring-[#00e599]/60' : ''}`}
        title={`Digit ${d}: ${stat.count} ticks (${stat.percentage.toFixed(1)}%) • Rank: ${stat.rank}`}
      >
        <span className="text-xl sm:text-2xl font-black font-mono leading-none">{d}</span>
        <span
          className={`text-[10px] sm:text-[11px] font-mono font-medium leading-none mt-1 ${
            isSpecialRank ? 'text-white/95 font-semibold' : 'text-slate-400'
          }`}
        >
          {stat.percentage.toFixed(1)}%
        </span>
      </button>
    );
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 py-2">
      {/* 10 Digit Circles in 2 rows of 5 */}
      <div className="w-full flex flex-col gap-3 max-w-md">
        <div className="flex items-center justify-between gap-2">
          {digitsRow1.map(renderCircle)}
        </div>
        <div className="flex items-center justify-between gap-2">
          {digitsRow2.map(renderCircle)}
        </div>
      </div>

      {/* Legend Pills below circles matching screenshot */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-300 mt-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]"></span>
          <span>Most</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
          <span>2nd most</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span>
          <span>2nd least</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
          <span>Least</span>
        </div>
      </div>
    </div>
  );
};
