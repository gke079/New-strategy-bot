import React from 'react';
import { DigitStat } from '../types';

export interface DigitCirclesGridProps {
  stats: DigitStat[];
  activeDigit?: number | null;
  onSelectDigit?: (digit: number) => void;
  layout?: 'grid' | 'horizontal';
  showLegend?: boolean;
  theme?: 'dark' | 'light';
}

export const DigitCirclesGrid: React.FC<DigitCirclesGridProps> = ({
  stats,
  activeDigit,
  onSelectDigit,
  layout = 'grid',
  showLegend = true,
  theme,
}) => {
  const isLight = theme === 'light';

  // Ensure we have 10 elements in order 0-9
  const digitMap = new Map<number, DigitStat>();
  stats.forEach((s) => digitMap.set(s.digit, s));

  const allDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const digitsRow1 = [0, 1, 2, 3, 4];
  const digitsRow2 = [5, 6, 7, 8, 9];

  const getRankClasses = (stat?: DigitStat, isSelected?: boolean) => {
    const base = 'transition-all duration-300 transform active:scale-95 cursor-pointer';

    if (!stat) {
      if (isSelected) {
        return `${base} bg-white text-slate-950 border-2 border-purple-400 ring-4 ring-[#a855f7] ring-offset-2 ring-offset-[#090d16] shadow-[0_0_22px_rgba(168,85,247,0.9)] scale-110 z-20`;
      }
      return `${base} bg-white text-slate-950 border-2 border-black ring-1 ring-black/40 shadow-md`;
    }

    let bgAndText = '';
    switch (stat.rank) {
      case 'most':
        bgAndText = 'bg-[#2563eb] text-white';
        break;
      case 'second-most':
        bgAndText = 'bg-[#10b981] text-white';
        break;
      case 'second-least':
        bgAndText = 'bg-[#f59e0b] text-white';
        break;
      case 'least':
        bgAndText = 'bg-[#ef4444] text-white';
        break;
      default:
        bgAndText = isLight
          ? 'bg-white hover:bg-slate-50 text-slate-900'
          : 'bg-white hover:bg-slate-100 text-slate-950';
    }

    if (isSelected) {
      // Prominent PURPLE ring for the last digit ticker on digit frequency
      return `${base} ${bgAndText} border-2 border-purple-400 ring-4 ring-[#a855f7] ring-offset-2 ring-offset-[#090d16] shadow-[0_0_24px_rgba(168,85,247,0.95)] scale-110 z-20`;
    }

    return `${base} ${bgAndText} border-2 border-black ring-1 ring-black/40 shadow-md`;
  };

  const renderCircle = (d: number, isHorizontal: boolean = false) => {
    const stat = digitMap.get(d) || {
      digit: d,
      count: 0,
      percentage: 0,
      rank: 'neutral',
      lastSeenTicksAgo: 0,
    };

    const isSelected = activeDigit === d;
    const isSpecialRank = stat.rank !== 'neutral';
    const isNeutralWhite = !isSpecialRank;

    // In dark mode: if neutral, text is dark on white circle; if special rank, text is white
    const digitTextColor = isNeutralWhite
      ? isLight ? 'text-slate-900' : 'text-slate-950 font-black'
      : 'text-white font-black';

    const percentTextColor = isNeutralWhite
      ? isLight ? 'text-slate-600' : 'text-slate-700 font-bold'
      : 'text-white/95 font-semibold';

    if (isHorizontal) {
      return (
        <button
          key={d}
          type="button"
          onClick={() => onSelectDigit && onSelectDigit(d)}
          className={`flex-1 min-w-[32px] sm:min-w-[42px] max-w-[64px] aspect-square rounded-full flex flex-col items-center justify-center p-0.5 sm:p-1 relative select-none ${getRankClasses(
            stat,
            isSelected
          )}`}
          title={`Digit ${d}: ${stat.count} ticks (${stat.percentage.toFixed(1)}%) • Rank: ${stat.rank}${isSelected ? ' (Last Digit)' : ''}`}
        >
          <span className={`text-sm sm:text-base md:text-lg font-mono leading-none ${digitTextColor}`}>
            {d}
          </span>
          <span
            className={`text-[8px] sm:text-[9px] md:text-[10px] font-mono leading-none mt-0.5 sm:mt-1 ${percentTextColor}`}
          >
            {stat.percentage.toFixed(1)}%
          </span>
        </button>
      );
    }

    // Default Grid (2 rows of 5)
    return (
      <button
        key={d}
        type="button"
        onClick={() => onSelectDigit && onSelectDigit(d)}
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center p-1 relative ${getRankClasses(
          stat,
          isSelected
        )}`}
        title={`Digit ${d}: ${stat.count} ticks (${stat.percentage.toFixed(1)}%) • Rank: ${stat.rank}${isSelected ? ' (Last Digit)' : ''}`}
      >
        <span className={`text-xl sm:text-2xl font-mono leading-none ${digitTextColor}`}>{d}</span>
        <span
          className={`text-[10px] sm:text-[11px] font-mono leading-none mt-1 ${percentTextColor}`}
        >
          {stat.percentage.toFixed(1)}%
        </span>
      </button>
    );
  };

  const renderLegend = () => (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-300">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-slate-700">
        <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] border border-black ring-1 ring-black"></span>
        <span>Most</span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-slate-700">
        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-black ring-1 ring-black"></span>
        <span>2nd most</span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-slate-700">
        <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-black ring-1 ring-black"></span>
        <span>2nd least</span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-slate-700">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-black ring-1 ring-black"></span>
        <span>Least</span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-slate-700">
        <span className="w-2.5 h-2.5 rounded-full bg-white border border-black ring-1 ring-black"></span>
        <span>Neutral</span>
      </div>
    </div>
  );

  // 1. HORIZONTAL LAYOUT (Straight Horizontal Line)
  if (layout === 'horizontal') {
    return (
      <div className="w-full bg-[#111827] border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col gap-3">
        {/* Header Bar */}
        <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
              <span>Digit Frequency Analysis</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-[#00e599] font-semibold border border-slate-700/80">
              0 - 9
            </span>
          </div>
        </div>

        {/* Straight Horizontal Line of All 10 Circles */}
        <div className="w-full overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
            {allDigits.map((d) => renderCircle(d, true))}
          </div>
        </div>

        {/* Compact Legend */}
        {showLegend && renderLegend()}
      </div>
    );
  }

  // 2. DEFAULT GRID LAYOUT (2 rows of 5)
  return (
    <div className="w-full flex flex-col items-center gap-4 py-2">
      {/* 10 Digit Circles in 2 rows of 5 */}
      <div className="w-full flex flex-col gap-3 max-w-md">
        <div className="flex items-center justify-between gap-2">
          {digitsRow1.map((d) => renderCircle(d, false))}
        </div>
        <div className="flex items-center justify-between gap-2">
          {digitsRow2.map((d) => renderCircle(d, false))}
        </div>
      </div>

      {/* Legend Pills below circles */}
      {showLegend && renderLegend()}
    </div>
  );
};
