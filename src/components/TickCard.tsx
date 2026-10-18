import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, Zap } from 'lucide-react';
import { Market, Tick } from '../types';

interface TickCardProps {
  currentTick: Tick | null;
  market: Market;
}

export const TickCard: React.FC<TickCardProps> = ({ currentTick, market }) => {
  if (!currentTick) {
    return (
      <div className="w-full bg-[#111827] border border-slate-800 rounded-2xl p-5 flex items-center justify-between min-h-[90px]">
        <div className="w-12 h-2 rounded bg-slate-700/60 animate-pulse"></div>
        <div className="w-12 h-2 rounded bg-[#00e599]/60 animate-pulse"></div>
      </div>
    );
  }

  const isUp = currentTick.direction === 'up';
  const isDown = currentTick.direction === 'down';

  // Split formatted quote to isolate the last digit for special styling
  const formatted = currentTick.quoteFormatted;
  const mainPart = formatted.slice(0, -1);
  const lastChar = formatted.slice(-1);

  return (
    <div className="w-full bg-[#111827] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 transition-all shadow-lg relative overflow-hidden">
      {/* Background ambient glow based on direction */}
      <div
        className={`absolute -right-12 -top-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-20 transition-colors duration-500 ${
          isUp ? 'bg-emerald-500' : isDown ? 'bg-rose-500' : 'bg-cyan-500'
        }`}
      />

      <div className="flex items-center justify-between gap-4">
        {/* Left: Direction indicator & change */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all duration-300 ${
              isUp
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : isDown
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {isUp ? (
              <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
            ) : isDown ? (
              <ArrowDownRight className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <Minus className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Live Tick Price
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-white">
                {mainPart}
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-black text-[#00e599] underline decoration-[#00e599]/40 decoration-2 underline-offset-4 animate-in zoom-in-75 duration-100">
                {lastChar}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Last digit prominent badge & direction pill */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Change</div>
            <div
              className={`font-mono text-xs font-semibold ${
                currentTick.change > 0
                  ? 'text-emerald-400'
                  : currentTick.change < 0
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {currentTick.change > 0 ? '+' : ''}
              {currentTick.change.toFixed(market.decimals)}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-3.5 py-1.5 rounded-xl bg-[#090d16] border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Last Digit
            </span>
            <span className="text-2xl font-black text-[#00e599] font-mono leading-none mt-0.5">
              {currentTick.lastDigit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
