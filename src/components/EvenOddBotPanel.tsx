import React, { useState } from 'react';
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  ChevronDown,
  Check,
  BookmarkCheck,
  Zap,
  Clock,
  ArrowLeftRight,
  Layers,
} from 'lucide-react';
import {
  BotMetrics,
  DigitStat,
  EvenOddBotConfig,
  EvenOddStrategyId,
  RatioStats,
  Trade,
} from '../types';
import { SYNTHETIC_MARKETS } from '../services/markets';
import { ActiveContract } from '../services/normalBotEngine';
import { NumericInput } from './NumericInput';
import { DigitCirclesGrid } from './DigitCirclesGrid';

interface EvenOddBotPanelProps {
  config: EvenOddBotConfig;
  onUpdateConfig: (newConfig: Partial<EvenOddBotConfig>) => void;
  digitStats: DigitStat[];
  ratioStats: RatioStats;
  currentDigit?: number;
  isRunning: boolean;
  isPaused: boolean;
  waitingForCondition: boolean;
  stageLabel: string;
  statusText: string;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  metrics: BotMetrics;
  trades: Trade[];
  onResetStats: () => void;
  currentStake: number;
  currentStep: number;
  activeContract: ActiveContract | null;
  storageKey?: string;
  theme?: 'dark' | 'light';
}

export const EvenOddBotPanel: React.FC<EvenOddBotPanelProps> = ({
  config,
  onUpdateConfig,
  digitStats,
  ratioStats,
  currentDigit,
  isRunning,
  isPaused,
  waitingForCondition,
  stageLabel,
  statusText,
  onStart,
  onStop,
  onPause,
  onResume,
  metrics,
  onResetStats,
  currentStake,
  currentStep,
  activeContract,
  storageKey = 'tickedge_evenodd_bot_config',
  theme,
}) => {
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [resetTradeFeedback, setResetTradeFeedback] = useState(false);

  const mostStat =
    digitStats.find((s) => s.rank === 'most') ||
    [...digitStats].sort((a, b) => b.count - a.count)[0];
  const leastStat =
    digitStats.find((s) => s.rank === 'least') ||
    [...digitStats].sort((a, b) => a.count - b.count)[0];

  const isEvenMarket = config.marketSide === 'EVEN';
  const oppWord = isEvenMarket ? 'Odd' : 'Even';
  const sideWord = isEvenMarket ? 'Even' : 'Odd';

  const handleSaveConfig = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch {}
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleResetHistoryClick = () => {
    onResetStats();
    setResetTradeFeedback(true);
    setTimeout(() => setResetTradeFeedback(false), 2000);
  };

  const handleSelectStrategy = (strategy: EvenOddStrategyId) => {
    onUpdateConfig({ strategy });
  };

  return (
    <div className="bg-white border border-neutral-300 text-neutral-900 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 w-full shadow-lg">
      {/* Top Header Bar */}
      <div className="border border-neutral-200 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm bg-neutral-50 text-neutral-900">
        <div className="flex items-center gap-2 flex-wrap">
          <ArrowLeftRight className="w-5 h-5 text-emerald-600 shrink-0" />
          <h2 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 text-neutral-950 flex-wrap">
            <span>EvenOdd bot strategy</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-semibold border bg-neutral-200 text-neutral-800 border-neutral-300 whitespace-nowrap shrink-0">
              {config.strategy} · {config.marketSide}
            </span>
            {isRunning && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  isPaused
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : waitingForCondition
                    ? 'bg-sky-100 text-sky-900 border border-sky-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPaused
                      ? 'bg-amber-500'
                      : waitingForCondition
                      ? 'bg-sky-600 animate-ping'
                      : 'bg-emerald-600 animate-pulse'
                  }`}
                />
                {isPaused ? 'PAUSED' : waitingForCondition ? stageLabel.toUpperCase() : 'TRADING'}
              </span>
            )}
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleResetHistoryClick}
            className="px-3 py-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 text-sky-600 ${resetTradeFeedback ? 'animate-spin' : ''}`}
            />
            <span>{resetTradeFeedback ? 'History Reset!' : 'Reset History'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ botSpeed: config.botSpeed === 'fast' ? 'normal' : 'fast' })
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border active:scale-95 whitespace-nowrap shrink-0 ${
              config.botSpeed === 'fast'
                ? 'bg-amber-400 hover:bg-amber-300 text-black border-amber-500'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
            }`}
          >
            {config.botSpeed === 'fast' ? (
              <>
                <Zap className="w-3.5 h-3.5 fill-current text-black" />
                <span>Fast Mode</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-neutral-700" />
                <span>Normal Mode</span>
              </>
            )}
          </button>

          {isRunning && (
            <button
              type="button"
              onClick={isPaused ? onResume : onPause}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border active:scale-95 whitespace-nowrap shrink-0 ${
                isPaused
                  ? 'bg-[#00FF00] hover:bg-[#00e600] text-black border-[#00cc00]'
                  : 'bg-[#000000] hover:bg-neutral-900 text-white border-neutral-800'
              }`}
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={isRunning ? onStop : onStart}
            className={`px-4 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md cursor-pointer border active:scale-95 whitespace-nowrap shrink-0 ${
              isRunning
                ? 'bg-[#FF0000] hover:bg-[#e60000] text-white border-[#cc0000]'
                : 'bg-[#00FF00] hover:bg-[#00e600] text-black border-[#00cc00]'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Bot</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Bot</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Condition / Contract Progress Bar */}
      {isRunning && (
        <div className="px-3.5 py-2.5 rounded-xl bg-neutral-100 border border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-mono">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isPaused
                  ? 'bg-amber-500'
                  : waitingForCondition
                  ? 'bg-sky-500 animate-ping'
                  : 'bg-emerald-500 animate-ping'
              }`}
            />
            {isPaused ? (
              <span className="text-amber-800 font-semibold">
                Bot paused. Click Resume to continue evaluating {config.strategy}.
              </span>
            ) : activeContract ? (
              <span className="text-emerald-800 font-bold">
                {activeContract.contractType} Trade Active (Entry Digit: {activeContract.entryDigit}) ➔{' '}
                {activeContract.hasSkipTick && activeContract.stepState === 'skipped'
                  ? `Skipped (${activeContract.skippedTick?.lastDigit ?? '•'}) · Resolving exit`
                  : `${activeContract.ticksRemaining ?? activeContract.secondsRemaining ?? 1} remaining`}
              </span>
            ) : (
              <span className="text-neutral-800 font-semibold">{statusText}</span>
            )}
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-600 tabular-nums">
            <span>
              Stake: <strong className="text-neutral-900">${currentStake.toFixed(2)}</strong>
            </span>
            <span>•</span>
            <span>
              Step: <strong className="text-amber-700">{currentStep}/{config.martingaleLevel}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Strategy Box (Select S1 or S2) */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-neutral-50 border border-neutral-300 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-neutral-700" />
            <span className="text-xs font-extrabold text-neutral-950 uppercase tracking-wide">
              Strategy Box — Select Entry Strategy
            </span>
          </div>

          {/* Live Market Distribution Readout */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono tabular-nums">
            <span className="px-2 py-0.5 rounded bg-white border border-neutral-300 text-neutral-800">
              Even: <strong className="text-emerald-700">{ratioStats.evenPercentage.toFixed(1)}%</strong> / Odd:{' '}
              <strong className="text-indigo-700">{ratioStats.oddPercentage.toFixed(1)}%</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold">
              Highest %: #{mostStat?.digit ?? 0} ({(mostStat?.percentage ?? 0).toFixed(1)}%)
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-300 text-rose-900 font-bold">
              Least %: #{leastStat?.digit ?? 9} ({(leastStat?.percentage ?? 0).toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Compact Straight-Line Digits Analysis (0-9 + Live Ticker) */}
        <DigitCirclesGrid
          stats={digitStats}
          activeDigit={currentDigit}
          layout="compact"
          theme={theme}
        />

        {/* Strategy Dropdown + Interactive Strategy Cards */}
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Strategy Dropdown Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-neutral-600">Selected Strategy</label>
              <div className="relative">
                <select
                  value={config.strategy}
                  onChange={(e) => handleSelectStrategy(e.target.value as EvenOddStrategyId)}
                  className="w-full appearance-none px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-950 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-neutral-400 pr-8 cursor-pointer"
                >
                  <option value="S1">
                    Strategy S1 — 2 Consecutive {oppWord}s ➔ Highest % Digit (#{mostStat?.digit ?? 0})
                  </option>
                  <option value="S2">
                    Strategy S2 — Least Digit (#{leastStat?.digit ?? 9}) ➔ Followed by 1 {oppWord} Digit
                  </option>
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Execution Cadence */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-neutral-600">Trigger Cadence</label>
              <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-neutral-300">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ executionMode: 'continuous' })}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    config.executionMode === 'continuous'
                      ? 'bg-[#00FFFF] text-slate-950 font-black'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  Start & Run Continuous
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ executionMode: 'per_trade' })}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    config.executionMode === 'per_trade'
                      ? 'bg-[#00FFFF] text-slate-950 font-black'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  Wait Condition Each Cycle
                </button>
              </div>
            </div>
          </div>

          {/* Side-by-side interactive S1 & S2 Rule Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleSelectStrategy('S1')}
              className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                config.strategy === 'S1'
                  ? 'bg-white border-emerald-500 ring-2 ring-emerald-400/50 shadow-xs'
                  : 'bg-white/70 hover:bg-white border-neutral-300 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-neutral-950">Strategy S1</span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    config.strategy === 'S1'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {config.strategy === 'S1' ? 'ACTIVE' : 'SELECT'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-700 leading-relaxed">
                For <strong>{sideWord} Market</strong>: waits for{' '}
                <strong>2 {oppWord} digits consecutively</strong>, then waits for the{' '}
                <strong>Highest % digit (#{mostStat?.digit ?? 0})</strong> to appear — trades{' '}
                <strong>{sideWord}</strong> immediately.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleSelectStrategy('S2')}
              className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                config.strategy === 'S2'
                  ? 'bg-white border-emerald-500 ring-2 ring-emerald-400/50 shadow-xs'
                  : 'bg-white/70 hover:bg-white border-neutral-300 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-neutral-950">Strategy S2</span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    config.strategy === 'S2'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {config.strategy === 'S2' ? 'ACTIVE' : 'SELECT'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-700 leading-relaxed">
                For <strong>{sideWord} Market</strong>: waits for the{' '}
                <strong>Least appearing digit (#{leastStat?.digit ?? 9})</strong> followed immediately by{' '}
                <strong>1 {oppWord} digit</strong> — trades <strong>{sideWord}</strong> immediately.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: Market & Market Side (Even / Odd) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Market</label>
          <div className="relative">
            <select
              value={config.marketId}
              onChange={(e) => onUpdateConfig({ marketId: e.target.value })}
              className="w-full appearance-none px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-10 font-medium cursor-pointer"
            >
              <optgroup label="Plain Volatility Indices">
                {SYNTHETIC_MARKETS.filter((m) => m.category === 'volatility').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.symbol} — {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Volatility (1s) Indices">
                {SYNTHETIC_MARKETS.filter((m) => m.category === 'volatility-1s').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.symbol} — {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Jump Indices (J10 – J100)">
                {SYNTHETIC_MARKETS.filter((m) => m.category === 'jump').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.symbol} — {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Step Indices (STEP 100 – STEP 500)">
                {SYNTHETIC_MARKETS.filter((m) => m.category === 'step').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.symbol} — {m.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Market Direction (Even / Odd)</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdateConfig({ marketSide: 'EVEN' })}
              className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer whitespace-nowrap ${
                config.marketSide === 'EVEN'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-300'
              }`}
            >
              Even Market ({ratioStats.evenPercentage.toFixed(1)}%)
            </button>
            <button
              type="button"
              onClick={() => onUpdateConfig({ marketSide: 'ODD' })}
              className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer whitespace-nowrap ${
                config.marketSide === 'ODD'
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-300'
              }`}
            >
              Odd Market ({ratioStats.oddPercentage.toFixed(1)}%)
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Duration & Stake */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Duration</label>
          <div className="flex gap-1.5">
            <NumericInput
              min={1}
              max={config.durationUnit === 'm' ? 120 : config.durationUnit === 's' ? 3600 : 10}
              value={config.duration}
              fallbackValue={1}
              onChange={(val) => onUpdateConfig({ duration: Math.round(val) })}
              className="flex-1 px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all tabular-nums"
            />
            <div className="relative w-28">
              <select
                value={config.durationUnit || 't'}
                onChange={(e) => onUpdateConfig({ durationUnit: e.target.value as 't' | 's' | 'm' })}
                className="w-full appearance-none px-3 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-7 cursor-pointer"
              >
                <option value="t">Ticks (t)</option>
                <option value="s">Sec (s)</option>
                <option value="m">Min (m)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Stake</label>
          <NumericInput
            min={0.35}
            step={0.05}
            fallbackValue={0.35}
            value={config.stake}
            onChange={(newStake) => {
              const wasDouble = Math.abs(config.takeProfit - config.stake * 2) < 0.02;
              const nextTp = wasDouble ? Number((newStake * 2).toFixed(2)) : config.takeProfit;
              onUpdateConfig({ stake: newStake, initialStake: newStake, takeProfit: nextTp });
            }}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all tabular-nums"
          />
        </div>
      </div>

      {/* Row 3: Martingale ×, Martingale Level, Take Profit, Stop Loss */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Martingale ×</label>
          <NumericInput
            min={1}
            step={0.1}
            fallbackValue={2.1}
            value={config.martingale}
            onChange={(newMg) => onUpdateConfig({ martingale: newMg })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Martingale level</label>
          <NumericInput
            min={1}
            max={15}
            step={1}
            fallbackValue={5}
            value={config.martingaleLevel}
            onChange={(lvl) => onUpdateConfig({ martingaleLevel: Math.round(lvl) })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-700">Take profit</label>
            <button
              type="button"
              onClick={() => onUpdateConfig({ takeProfit: Number((config.stake * 2).toFixed(2)) })}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 transition-colors whitespace-nowrap"
            >
              2x
            </button>
          </div>
          <NumericInput
            min={0.1}
            step={0.1}
            fallbackValue={Number((config.stake * 2).toFixed(2))}
            value={config.takeProfit}
            onChange={(tp) => onUpdateConfig({ takeProfit: tp })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Stop loss</label>
          <NumericInput
            min={0.5}
            step={1}
            fallbackValue={20}
            value={config.stopLoss}
            onChange={(sl) => onUpdateConfig({ stopLoss: sl })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all tabular-nums"
          />
        </div>
      </div>

      {/* Save Strategy & Reset History Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSaveConfig}
          className={`w-fit inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-[11px] leading-tight transition-all shadow-xs cursor-pointer active:scale-95 border whitespace-nowrap ${
            savedFeedback
              ? 'bg-emerald-600 hover:bg-emerald-500 text-sky-50 border-emerald-500'
              : 'bg-blue-600 hover:bg-blue-500 text-sky-50 border-blue-500'
          }`}
        >
          {savedFeedback ? (
            <>
              <Check className="w-3 h-3 text-sky-50 shrink-0" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <BookmarkCheck className="w-3 h-3 text-sky-100 shrink-0" />
              <span>Save Strategy</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleResetHistoryClick}
          className="w-fit inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-700 font-semibold text-[11px] leading-tight transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
        >
          <RotateCcw
            className={`w-3 h-3 text-sky-600 shrink-0 transition-transform ${
              resetTradeFeedback ? 'animate-spin' : ''
            }`}
          />
          <span>{resetTradeFeedback ? 'History Reset!' : 'Reset History'}</span>
        </button>
      </div>

      {/* Take Profit / Stop Loss Reached Banner */}
      {!isRunning &&
        metrics.lastStopReason &&
        (metrics.lastStopReason.toLowerCase().includes('take profit') ||
          metrics.lastStopReason.toLowerCase().includes('stop loss')) && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs font-semibold ${
              metrics.lastStopReason.toLowerCase().includes('take profit')
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  metrics.lastStopReason.toLowerCase().includes('take profit')
                    ? 'bg-emerald-600'
                    : 'bg-rose-600'
                }`}
              />
              <span>{metrics.lastStopReason}</span>
            </div>
            <span className="font-mono font-bold tabular-nums">
              Session P/L:{' '}
              {(metrics.sessionProfit ?? metrics.totalProfit) >= 0 ? '+' : '-'}$
              {Math.abs(metrics.sessionProfit ?? metrics.totalProfit).toFixed(2)}
            </span>
          </div>
        )}

      {/* Live Compact Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border border-neutral-200 rounded-xl p-3 bg-neutral-50 text-neutral-900 shadow-sm tabular-nums">
        <div className="border border-neutral-200 rounded-xl p-2.5 flex flex-col bg-white">
          <span className="text-[10px] uppercase font-semibold text-neutral-500">Session P/L</span>
          <span
            className={`text-sm font-bold font-mono mt-0.5 ${
              (metrics.sessionProfit ?? metrics.totalProfit) >= 0
                ? 'text-emerald-600'
                : 'text-rose-600'
            }`}
          >
            {(metrics.sessionProfit ?? metrics.totalProfit) >= 0
              ? `+$${(metrics.sessionProfit ?? metrics.totalProfit).toFixed(2)}`
              : `-$${Math.abs(metrics.sessionProfit ?? metrics.totalProfit).toFixed(2)}`}
          </span>
        </div>

        <div className="border border-neutral-200 rounded-xl p-2.5 flex flex-col bg-white">
          <span className="text-[10px] uppercase font-semibold text-neutral-500">Total Profit</span>
          <span
            className={`text-sm font-bold font-mono mt-0.5 ${
              metrics.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {metrics.totalProfit >= 0
              ? `+$${metrics.totalProfit.toFixed(2)}`
              : `-$${Math.abs(metrics.totalProfit).toFixed(2)}`}
          </span>
        </div>

        <div className="border border-neutral-200 rounded-xl p-2.5 flex flex-col bg-white">
          <span className="text-[10px] uppercase font-semibold text-neutral-500">Win Rate</span>
          <span className="text-sm font-bold font-mono text-emerald-600 mt-0.5">
            {metrics.winRate}%
          </span>
        </div>

        <div className="border border-neutral-200 rounded-xl p-2.5 flex flex-col bg-white">
          <span className="text-[10px] uppercase font-semibold text-neutral-500">Trades</span>
          <span className="text-sm font-bold font-mono mt-0.5 text-neutral-950">
            {metrics.totalTrades} ({metrics.wins}W/{metrics.losses}L)
          </span>
        </div>

        <div className="border border-neutral-200 rounded-xl p-2.5 flex flex-col bg-white col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-semibold text-neutral-500">Stake & Step</span>
          <span className="text-sm font-bold font-mono text-amber-700 mt-0.5">
            ${currentStake.toFixed(2)} ({currentStep}/{config.martingaleLevel})
          </span>
        </div>
      </div>
    </div>
  );
};
