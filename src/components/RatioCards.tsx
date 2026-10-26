import React, { useState, useMemo } from 'react';
import { RatioStats, Tick } from '../types';
import { calculateBarrierStats } from '../services/statsEngine';

interface RatioCardsProps {
  ratioStats: RatioStats;
  ticks?: Tick[];
  onTradeEvenOdd?: (type: 'EVEN' | 'ODD') => void;
  onTradeOverUnder?: (type: 'OVER' | 'UNDER') => void;
}

export const RatioCards: React.FC<RatioCardsProps> = ({
  ratioStats,
  ticks = [],
}) => {
  const [barrierDigit, setBarrierDigit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tickedge_over_under_barrier');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 9) {
          return parsed;
        }
      }
    } catch {}
    return 4;
  });

  const handleSelectBarrier = (digit: number) => {
    setBarrierDigit(digit);
    try {
      localStorage.setItem('tickedge_over_under_barrier', String(digit));
    } catch {}
  };

  const barrierStats = useMemo(
    () => calculateBarrierStats(ticks, barrierDigit),
    [ticks, barrierDigit]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {/* Card 1: Even vs Odd */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between text-sm sm:text-base font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-200">Even</span>
            <span className="text-cyan-400 font-mono tabular-nums">{ratioStats.evenPercentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-200">Odd</span>
            <span className="text-rose-400 font-mono tabular-nums">{ratioStats.oddPercentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Visual Dual Progress Bar */}
        <div className="w-full h-2.5 bg-slate-200/30 rounded-full overflow-hidden flex">
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
            <span
              className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                ratioStats.currentEvenOddStreakType === 'even'
                  ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              Streak: {ratioStats.currentEvenOddStreakCount} {ratioStats.currentEvenOddStreakType.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Over vs Under with Selectable Barrier Digits (0 - 9) between Over and Under */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-2.5 shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between gap-2">
          {/* Over side */}
          <div className="flex flex-col items-start shrink-0">
            <span className="text-xs sm:text-sm font-semibold text-slate-200 whitespace-nowrap">
              Over {barrierDigit}
            </span>
            <span className="text-amber-400 font-mono font-bold text-sm sm:text-base tabular-nums">
              {barrierStats.overPercentage.toFixed(1)}%
            </span>
          </div>

          {/* Barrier Digits (0 - 9) between Over side and Under side */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-mono font-semibold text-slate-400 leading-none">
              Barrier Digit
            </span>
            <div className="grid grid-cols-5 gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                const isSelected = barrierDigit === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleSelectBarrier(d)}
                    className={`w-5 h-5 rounded text-[10px] font-mono leading-none flex items-center justify-center transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-[#00FFFF] text-sky-950 border-[#00c8c8] font-black shadow-xs scale-105'
                        : 'bg-sky-50 hover:bg-cyan-100 text-sky-800 border-sky-200 font-bold'
                    }`}
                    title={`Select barrier digit ${d} (Over ${d} vs Under ${d})`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Under side */}
          <div className="flex flex-col items-end shrink-0">
            <span className="text-xs sm:text-sm font-semibold text-slate-200 whitespace-nowrap">
              Under {barrierDigit}
            </span>
            <span className="text-emerald-400 font-mono font-bold text-sm sm:text-base tabular-nums">
              {barrierStats.underPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Visual Progress Bar (Over / Equal / Under) */}
        <div className="w-full h-2.5 bg-slate-200/30 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${barrierStats.overPercentage}%` }}
            title={`Over ${barrierDigit}: ${barrierStats.overPercentage.toFixed(1)}%`}
          />
          {barrierStats.equalPercentage > 0 && (
            <div
              className="h-full bg-sky-300/60 transition-all duration-300"
              style={{ width: `${barrierStats.equalPercentage}%` }}
              title={`Equals ${barrierDigit}: ${barrierStats.equalPercentage.toFixed(1)}%`}
            />
          )}
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${barrierStats.underPercentage}%` }}
            title={`Under ${barrierDigit}: ${barrierStats.underPercentage.toFixed(1)}%`}
          />
        </div>

        {/* Bottom micro metadata: count & streak */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 pt-0.5">
          <span className="truncate tabular-nums">
            {barrierStats.overCount} over · {barrierStats.equalCount} eq ({barrierStats.equalPercentage.toFixed(1)}%) · {barrierStats.underCount} under
          </span>
          {barrierStats.streakType && (
            <span
              className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-md border shrink-0 ${
                barrierStats.streakType === 'over'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : barrierStats.streakType === 'under'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}
            >
              Streak: {barrierStats.streakCount}{' '}
              {barrierStats.streakType === 'equal'
                ? `EQ ${barrierDigit}`
                : `${barrierStats.streakType.toUpperCase()} ${barrierDigit}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
