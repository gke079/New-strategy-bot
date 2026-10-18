import React from 'react';
import { RatioStats } from '../types';

interface RatioCardsProps {
  ratioStats: RatioStats;
  onTradeEvenOdd?: (type: 'EVEN' | 'ODD') => void;
  onTradeOverUnder?: (type: 'OVER' | 'UNDER') => void;
}

export const RatioCards: React.FC<RatioCardsProps> = ({
  ratioStats,
  onTradeEvenOdd,
  onTradeOverUnder,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {/* Card 1: Even vs Odd */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between text-sm sm:text-base font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-200">Even</span>
            <span className="text-cyan-400 font-mono">{ratioStats.evenPercentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-200">Odd</span>
            <span className="text-rose-400 font-mono">{ratioStats.oddPercentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Visual Dual Progress Bar matching screenshot */}
        <div className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${ratioStats.evenPercentage}%` }}
          />
          <div
            className="h-full bg-rose-500 transition-all duration-300"
            style={{ width: `${ratioStats.oddPercentage}%` }}
          />
        </div>

        {/* Bottom micro metadata: count & streak */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
          <span>{ratioStats.evenCount} even / {ratioStats.oddCount} odd</span>
          {ratioStats.currentEvenOddStreakType && (
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Streak: {ratioStats.currentEvenOddStreakCount} {ratioStats.currentEvenOddStreakType.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Over 4 vs Under 5 */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between text-sm sm:text-base font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-200">Over 4</span>
            <span className="text-amber-400 font-mono">{ratioStats.over4Percentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-200">Under 5</span>
            <span className="text-emerald-400 font-mono">{ratioStats.under5Percentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Visual Dual Progress Bar */}
        <div className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${ratioStats.over4Percentage}%` }}
          />
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${ratioStats.under5Percentage}%` }}
          />
        </div>

        {/* Bottom micro metadata: count & streak */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
          <span>{ratioStats.over4Count} over / {ratioStats.under5Count} under</span>
          {ratioStats.currentOverUnderStreakType && (
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Streak: {ratioStats.currentOverUnderStreakCount} {ratioStats.currentOverUnderStreakType.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
