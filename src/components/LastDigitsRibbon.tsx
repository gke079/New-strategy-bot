import React, { useState } from 'react';
import { Tick } from '../types';

interface LastDigitsRibbonProps {
  ticks: Tick[];
}

export const LastDigitsRibbon: React.FC<LastDigitsRibbonProps> = ({ ticks }) => {
  const [maxDigits, setMaxDigits] = useState<10 | 20>(20);

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

        {/* Quick toggle between 10 and 20 digits with clean light container */}
        <div className="flex items-center bg-sky-50 border border-sky-200 rounded-lg p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setMaxDigits(10)}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              maxDigits === 10
                ? 'bg-[#00FFFF] text-sky-950 font-black shadow-xs'
                : 'text-sky-700 hover:bg-sky-100'
            }`}
          >
            10 ticks
          </button>
          <button
            type="button"
            onClick={() => setMaxDigits(20)}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              maxDigits === 20
                ? 'bg-[#00FFFF] text-sky-950 font-black shadow-xs'
                : 'text-sky-700 hover:bg-sky-100'
            }`}
          >
            20 ticks
          </button>
        </div>
      </div>

      {displayedTicks.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400 font-mono">
          Waiting for incoming ticks...
        </div>
      ) : (
        <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 w-full place-items-center py-1">
          {displayedTicks.map((tick, index) => {
            const isLatest = index === displayedTicks.length - 1;
            const digit = tick.lastDigit;
            const isEven = digit % 2 === 0;

            // Clear, vibrant solid colors that don't fade in dark or light mode
            const baseCircleClass = isEven
              ? 'bg-[#0284c7] text-neutral-50 border-2 border-[#38bdf8] shadow-[0_2px_8px_rgba(2,132,199,0.4)]'
              : 'bg-[#e11d48] text-neutral-50 border-2 border-[#fb7185] shadow-[0_2px_8px_rgba(225,29,72,0.4)]';

            // Latest tick gets purple ring with scale accent
            const latestClass = isLatest
              ? 'ring-3 ring-[#a855f7] ring-offset-1 ring-offset-[#111827] light-mode:ring-offset-white scale-110 z-10 shadow-[0_0_16px_rgba(168,85,247,0.9)]'
              : 'hover:scale-105';

            return (
              <div
                key={`${tick.epoch}-${index}`}
                className={`relative w-7 h-7 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full aspect-square shrink-0 flex flex-col items-center justify-center font-mono font-bold transition-all ${baseCircleClass} ${latestClass}`}
                title={`Digit: ${digit} • Price: ${tick.quoteFormatted} • Direction: ${tick.direction}${isLatest ? ' (Latest Live Tick)' : ''}`}
              >
                {/* Digit Value */}
                <span className="text-xs sm:text-base font-black leading-none drop-shadow-sm">
                  {digit}
                </span>

                {/* Even / Odd micro label */}
                <span className="text-[6px] sm:text-[8px] uppercase font-bold tracking-tight text-neutral-50/95 leading-none mt-0.5">
                  {isEven ? 'Even' : 'Odd'}
                </span>

                {/* Latest pulse badge */}
                {isLatest && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#c084fc] ring-2 ring-[#a855f7] animate-ping" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

