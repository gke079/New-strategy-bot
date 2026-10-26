import React, { useState } from 'react';
import { Tick } from '../types';

interface LastDigitsRibbonProps {
  ticks: Tick[];
}

export const LastDigitsRibbon: React.FC<LastDigitsRibbonProps> = ({ ticks }) => {
  const [maxDigits, setMaxDigits] = useState<8 | 10>(10);

  const displayedTicks = ticks.slice(-maxDigits);

  return (
    <div className="bg-[#111827] light-mode:bg-white border border-slate-800 light-mode:border-slate-200 rounded-2xl p-4 flex flex-col gap-3 w-full shadow-sm transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold text-slate-200 light-mode:text-slate-900">
            Last {maxDigits} digits
          </span>
          <span className="text-[11px] font-mono text-slate-400 light-mode:text-slate-500">
            ({displayedTicks.length}/{maxDigits})
          </span>
        </div>

        {/* Quick toggle between 8 and 10 digits with aqua active tab button */}
        <div className="flex items-center bg-[#090d16] light-mode:bg-slate-100 border border-slate-800 light-mode:border-slate-300 rounded-lg p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setMaxDigits(8)}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              maxDigits === 8
                ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,255,0.6)]'
                : 'text-slate-400 light-mode:text-slate-600 hover:text-white light-mode:hover:text-slate-900'
            }`}
          >
            8 ticks
          </button>
          <button
            type="button"
            onClick={() => setMaxDigits(10)}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              maxDigits === 10
                ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,255,0.6)]'
                : 'text-slate-400 light-mode:text-slate-600 hover:text-white light-mode:hover:text-slate-900'
            }`}
          >
            10 ticks
          </button>
        </div>
      </div>

      {displayedTicks.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400 font-mono">
          Waiting for incoming ticks...
        </div>
      ) : (
        <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 w-full overflow-x-auto py-2 px-1">
          {displayedTicks.map((tick, index) => {
            const isLatest = index === displayedTicks.length - 1;
            const digit = tick.lastDigit;
            const isEven = digit % 2 === 0;

            // Clear, vibrant solid colors that don't fade in dark or light mode
            const baseCircleClass = isEven
              ? 'bg-[#0284c7] text-white border-2 border-[#38bdf8] shadow-[0_2px_8px_rgba(2,132,199,0.4)]'
              : 'bg-[#e11d48] text-white border-2 border-[#fb7185] shadow-[0_2px_8px_rgba(225,29,72,0.4)]';

            // Latest tick gets purple ring with scale accent
            const latestClass = isLatest
              ? 'ring-4 ring-[#a855f7] ring-offset-2 ring-offset-[#111827] light-mode:ring-offset-white scale-110 z-10 shadow-[0_0_16px_rgba(168,85,247,0.9)]'
              : 'hover:scale-105';

            return (
              <div
                key={`${tick.epoch}-${index}`}
                className={`relative w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full aspect-square shrink-0 flex flex-col items-center justify-center font-mono font-bold transition-all ${baseCircleClass} ${latestClass}`}
                title={`Digit: ${digit} • Price: ${tick.quoteFormatted} • Direction: ${tick.direction}${isLatest ? ' (Latest Live Tick)' : ''}`}
              >
                {/* Digit Value */}
                <span className="text-sm sm:text-base md:text-lg font-black leading-none drop-shadow-sm">
                  {digit}
                </span>

                {/* Even / Odd micro label */}
                <span className="text-[7px] sm:text-[8px] uppercase font-bold tracking-tight text-white/95 leading-none mt-0.5">
                  {isEven ? 'Even' : 'Odd'}
                </span>

                {/* Latest pulse badge */}
                {isLatest && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#c084fc] ring-2 ring-[#a855f7] animate-ping" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

