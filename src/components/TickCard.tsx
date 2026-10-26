import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  SlidersHorizontal,
  Wifi,
  Check,
  X,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Market, Tick } from '../types';

interface TickCardProps {
  currentTick: Tick | null;
  market: Market;
  isLiveFeed?: boolean;
  onCalibratePrice?: (price: number) => void;
  onResetPriceCalibration?: () => void;
  onOpenApiModal?: () => void;
}

export const TickCard: React.FC<TickCardProps> = ({
  currentTick,
  market,
  isLiveFeed = false,
  onCalibratePrice,
  onResetPriceCalibration,
  onOpenApiModal,
}) => {
  const [isCalibrateOpen, setIsCalibrateOpen] = useState<boolean>(false);
  const [inputPrice, setInputPrice] = useState<string>('');
  const [calibrationSaved, setCalibrationSaved] = useState<boolean>(false);

  // Sync input price when modal opens or market changes
  useEffect(() => {
    if (currentTick) {
      setInputPrice(currentTick.quoteFormatted);
    } else {
      setInputPrice(market.basePrice.toFixed(market.decimals));
    }
  }, [market, isCalibrateOpen]);

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

  const handleApplyCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(inputPrice);
    if (!isNaN(parsed) && parsed > 0 && onCalibratePrice) {
      onCalibratePrice(parsed);
      setCalibrationSaved(true);
      setTimeout(() => {
        setCalibrationSaved(false);
        setIsCalibrateOpen(false);
      }, 700);
    }
  };

  const handleReset = () => {
    if (onResetPriceCalibration) {
      onResetPriceCalibration();
      setInputPrice(market.basePrice.toFixed(market.decimals));
      setCalibrationSaved(true);
      setTimeout(() => {
        setCalibrationSaved(false);
        setIsCalibrateOpen(false);
      }, 700);
    }
  };

  return (
    <>
      <div className="w-full bg-[#111827] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 transition-all shadow-lg relative overflow-hidden">
        {/* Background ambient glow based on direction */}
        <div
          className={`absolute -right-12 -top-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-20 transition-colors duration-500 ${
            isUp ? 'bg-emerald-500' : isDown ? 'bg-rose-500' : 'bg-cyan-500'
          }`}
        />

        {/* Top Meta Bar: Live Deriv Status vs Calibrated Feed */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            {isLiveFeed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Deriv Live Spot Feed
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Simulated / Standalone
                </span>
                <button
                  type="button"
                  onClick={() => setIsCalibrateOpen(true)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                  title="Calibrate spot price to match your Deriv screen"
                >
                  <SlidersHorizontal className="w-2.5 h-2.5 text-indigo-400" />
                  <span>Sync Spot Price</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenApiModal && (
              <button
                type="button"
                onClick={onOpenApiModal}
                className="text-[10px] text-slate-400 hover:text-[#00e599] transition-colors flex items-center gap-1 font-mono cursor-pointer"
                title="Configure Deriv App ID and WebSocket endpoints"
              >
                <Wifi className="w-3 h-3 text-[#00e599]" />
                <span className="hidden sm:inline">Deriv API</span>
              </button>
            )}
          </div>
        </div>

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
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {market.symbol} Live Price
                </span>
                {!isLiveFeed && (
                  <button
                    type="button"
                    onClick={() => setIsCalibrateOpen(true)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-mono cursor-pointer"
                    title="Click to calibrate this price to your Deriv terminal"
                  >
                    (edit)
                  </button>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {mainPart}
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-black text-[#a855f7] underline decoration-[#a855f7]/40 decoration-2 underline-offset-4 animate-in zoom-in-75 duration-100">
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

            <div className="flex flex-col items-center justify-center px-3.5 py-1.5 rounded-xl bg-[#090d16] border border-purple-500/40 ring-2 ring-[#a855f7]/40 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">
                Last Digit
              </span>
              <span className="text-2xl font-black text-[#a855f7] font-mono leading-none mt-0.5">
                {currentTick.lastDigit}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Spot Price Calibration Modal */}
      {isCalibrateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Sync Spot Price with Deriv</h3>
                  <p className="text-xs text-slate-400">{market.name} ({market.symbol})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCalibrateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleApplyCalibration} className="p-5 flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-[#090d16] border border-slate-800/80 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Why calibrate the spot price?</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Deriv synthetic indices oscillate 24/7 and have drifted over time. If you are running in simulated/calibrated mode (e.g. before your custom App ID is connected), you can enter the <strong>exact live spot quote</strong> currently on your Deriv screen.
                </p>
                <p className="text-slate-400 text-[11px]">
                  TickEdge will calibrate the live ticker, digits frequency, and future ticks to continue smoothly from your exact spot price!
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Enter Current Deriv Spot Price ({market.decimals} decimals)
                </label>
                <input
                  type="number"
                  step="any"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  placeholder={`e.g. ${market.basePrice}`}
                  className="px-3 py-2 bg-[#090d16] border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  autoFocus
                />
                <span className="text-[10px] text-slate-500">
                  Default Baseline: {market.basePrice.toFixed(market.decimals)} • Pip: {market.pipSize}
                </span>
              </div>

              {calibrationSaved && (
                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Spot price calibrated! Ticker and digits updated.</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
                  <span>Reset Baseline</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCalibrateOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Spot Price</span>
                  </button>
                </div>
              </div>

              {/* Helper link to Deriv API registration */}
              {onOpenApiModal && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCalibrateOpen(false);
                      onOpenApiModal();
                    }}
                    className="text-[11px] text-[#00e599] hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Connect your free Deriv App ID for 100% direct streaming</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
};
