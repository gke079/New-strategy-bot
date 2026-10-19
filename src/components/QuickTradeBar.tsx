import React, { useState } from 'react';
import { Zap, Play, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw, Key } from 'lucide-react';
import { Market, Tick, TradeContractType } from '../types';

interface QuickTradeBarProps {
  currentTick: Tick | null;
  market: Market;
  isRealExecution: boolean;
  isLoggedIn: boolean;
  balance: number;
  currency: string;
  onQuickTrade: (type: TradeContractType, predictionDigit?: number, stake?: number) => Promise<void>;
  isPlacingTrade: boolean;
  onOpenDerivModal: () => void;
}

export const QuickTradeBar: React.FC<QuickTradeBarProps> = ({
  currentTick,
  market,
  isRealExecution,
  isLoggedIn,
  balance,
  currency,
  onQuickTrade,
  isPlacingTrade,
  onOpenDerivModal,
}) => {
  const [stake, setStake] = useState<number>(1.0);
  const [lastActionResult, setLastActionResult] = useState<string | null>(null);

  const executeTrade = async (type: TradeContractType, digit?: number) => {
    if (isPlacingTrade) return;
    try {
      setLastActionResult(`Placing ${type}${digit !== undefined ? ' ' + digit : ''}...`);
      await onQuickTrade(type, digit, stake);
      setLastActionResult(`Executed ${type}!`);
      setTimeout(() => setLastActionResult(null), 3000);
    } catch (err: any) {
      setLastActionResult(`Error: ${err.message || 'Failed'}`);
      setTimeout(() => setLastActionResult(null), 4000);
    }
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
      {/* Top Bar: Title & Mode Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00e599]/10 border border-[#00e599]/20 flex items-center justify-center text-[#00e599]">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">One-Click Real Tick Trading</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isRealExecution && isLoggedIn
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-[#00e599]/15 text-[#00e599] border border-[#00e599]/30'
                }`}
              >
                {isRealExecution && isLoggedIn ? '🔴 LIVE DERIV REAL MONEY' : '🟢 VIRTUAL DEMO ON REAL TICKS'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Contract Duration: 1 Tick (~1 sec) on real {market.name} quotes
            </p>
          </div>
        </div>

        {/* Stake and Quick Settings */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#090d16] border border-slate-800 rounded-xl px-2.5 py-1">
            <span className="text-[11px] text-slate-400 font-mono">Stake:</span>
            <span className="text-xs text-[#00e599] font-mono font-bold">$</span>
            <input
              type="number"
              step="0.5"
              min="0.35"
              max="5000"
              value={stake}
              onChange={(e) => setStake(Math.max(0.35, parseFloat(e.target.value) || 0.35))}
              className="w-14 bg-transparent text-white font-mono font-bold text-xs focus:outline-none"
            />
          </div>

          {!isLoggedIn && (
            <button
              onClick={onOpenDerivModal}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              title="Connect Deriv API token to trade with real Deriv balance"
            >
              <Key className="w-3.5 h-3.5 text-[#00e599]" />
              <span>Connect Token</span>
            </button>
          )}
        </div>
      </div>

      {/* Trade Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {/* Over 2 (Win if 3,4,5,6,7,8,9) */}
        <button
          disabled={isPlacingTrade}
          onClick={() => executeTrade('OVER', 2)}
          className="p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300">Over 2</span>
            <span className="text-[10px] font-mono text-emerald-400/80">70% Win</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
            Win if digit 3-9 (~1.35x)
          </div>
        </button>

        {/* Under 7 (Win if 0,1,2,3,4,5,6) */}
        <button
          disabled={isPlacingTrade}
          onClick={() => executeTrade('UNDER', 7)}
          className="p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300">Under 7</span>
            <span className="text-[10px] font-mono text-emerald-400/80">70% Win</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
            Win if digit 0-6 (~1.35x)
          </div>
        </button>

        {/* Even */}
        <button
          disabled={isPlacingTrade}
          onClick={() => executeTrade('EVEN')}
          className="p-2.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300">Even</span>
            <span className="text-[10px] font-mono text-blue-400/80">1.95x</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
            0, 2, 4, 6, 8
          </div>
        </button>

        {/* Odd */}
        <button
          disabled={isPlacingTrade}
          onClick={() => executeTrade('ODD')}
          className="p-2.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300">Odd</span>
            <span className="text-[10px] font-mono text-blue-400/80">1.95x</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
            1, 3, 5, 7, 9
          </div>
        </button>

        {/* Rise (Call) */}
        <button
          disabled={isPlacingTrade}
          onClick={() => executeTrade('RISE')}
          className="p-2.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1">
              <span>Rise ↗</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400/80">1.95x</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
            Next tick price is higher
          </div>
        </button>

        {/* Fall (Put) */}
        <button
          disabled={isPlacingTrade}
          onClick={() => executeTrade('FALL')}
          className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-300 flex items-center gap-1">
              <span>Fall ↘</span>
            </span>
            <span className="text-[10px] font-mono text-rose-400/80">1.95x</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
            Next tick price is lower
          </div>
        </button>

        {/* Differs Current Digit */}
        <button
          disabled={isPlacingTrade}
          onClick={() => executeTrade('DIFFERS', currentTick?.lastDigit ?? 0)}
          className="p-2.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300">
              Differs {currentTick?.lastDigit ?? 0}
            </span>
            <span className="text-[10px] font-mono text-purple-400/80">90% Win</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
            Next digit ≠ {currentTick?.lastDigit ?? 0}
          </div>
        </button>

        {/* Matches Current Digit */}
        <button
          disabled={isPlacingTrade}
          onClick={() => executeTrade('MATCHES', currentTick?.lastDigit ?? 0)}
          className="p-2.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">
              Matches {currentTick?.lastDigit ?? 0}
            </span>
            <span className="text-[10px] font-mono text-amber-400/80">9.00x Jack</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
            Next digit repeats ({currentTick?.lastDigit ?? 0})
          </div>
        </button>
      </div>

      {/* Action feedback message */}
      {lastActionResult && (
        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono flex items-center justify-between text-slate-300 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5">
            {isPlacingTrade ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00e599]" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00e599]" />
            )}
            <span>{lastActionResult}</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Spot: {currentTick?.quoteFormatted} (Digit: {currentTick?.lastDigit})
          </span>
        </div>
      )}
    </div>
  );
};
