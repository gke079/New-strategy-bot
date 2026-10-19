import React, { useState } from 'react';
import { Tick } from '../types';

interface LastDigitsRibbonProps {
  ticks: Tick[];
}

export const LastDigitsRibbon: React.FC<LastDigitsRibbonProps> = ({ ticks }) => {
  const [maxDigits, setMaxDigits] = useState<8 | 10>(10);

  const displayedTicks = ticks.slice(-maxDigits);

  const getDigitColor = (digit: number) => {
    if (digit % 2 === 0) {
      return 'bg-cyan-950/70 light-mode:bg-white text-cyan-300 light-mode:text-cyan-800 border-cyan-500/40 light-mode:border-slate-300 shadow-sm';
    }
    return 'bg-rose-950/70 light-mode:bg-white text-rose-300 light-mode:text-rose-800 border-rose-500/40 light-mode:border-slate-300 shadow-sm';
  };

  return (
    <div className="bg-[#111827] light-mode:bg-white border border-slate-800 light-mode:border-slate-200 rounded-2xl p-4 flex flex-col gap-3 w-full shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold text-slate-200 light-mode:text-slate-900">
            Last {maxDigits} digits
          </span>
          <span className="text-[11px] font-mono text-slate-400 light-mode:text-slate-500">
            ({displayedTicks.length}/{maxDigits})
          </span>
        </div>

        {/* Quick toggle between 8 and 10 digits */}
        <div className="flex items-center bg-[#090d16] light-mode:bg-slate-100 border border-slate-800 light-mode:border-slate-200 rounded-lg p-0.5 text-xs font-mono">
          <button
            onClick={() => setMaxDigits(8)}
            className={`px-2 py-0.5 rounded transition-colors ${
              maxDigits === 8
                ? 'bg-[#00e599] text-black font-bold'
                : 'text-slate-400 light-mode:text-slate-600 hover:text-white light-mode:hover:text-slate-900'
            }`}
          >
            8 ticks
          </button>
          <button
            onClick={() => setMaxDigits(10)}
            className={`px-2 py-0.5 rounded transition-colors ${
              maxDigits === 10
                ? 'bg-[#00e599] text-black font-bold'
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
        <div className="grid grid-cols-5 sm:flex sm:items-center sm:justify-between gap-2 py-1">
          {displayedTicks.map((tick, index) => {
            const isLatest = index === displayedTicks.length - 1;
            const digit = tick.lastDigit;

            return (
              <div
                key={`${tick.epoch}-${index}`}
                className={`relative flex flex-col items-center justify-center h-12 sm:h-13 sm:flex-1 rounded-xl font-mono font-bold border transition-all ${
                  isLatest
                    ? 'bg-[#00e599] text-black border-[#00e599] shadow-lg shadow-[#00e599]/30 ring-2 ring-[#00e599]/50 scale-105 z-10'
                    : getDigitColor(digit)
                }`}
                title={`Digit: ${digit} • Price: ${tick.quoteFormatted} • Direction: ${tick.direction}`}
              >
                {/* Digit Value */}
                <span className="text-lg sm:text-xl font-black leading-none">{digit}</span>

                {/* Micro indicator: Even/Odd tag */}
                <span
                  className={`text-[9px] uppercase tracking-wider font-semibold mt-0.5 ${
                    isLatest ? 'text-black/80' : 'text-slate-400 light-mode:text-slate-600'
                  }`}
                >
                  {digit % 2 === 0 ? 'Evn' : 'Odd'}
                </span>

                {/* Latest pulse badge */}
                {isLatest && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
