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
  Crosshair,
  ShieldAlert,
} from 'lucide-react';
import { BotMetrics, DigitStat, EntryBotConfig, Trade } from '../types';
import { SYNTHETIC_MARKETS } from '../services/markets';
import { ActiveContract } from '../services/normalBotEngine';
import { NumericInput } from './NumericInput';
import { DigitCirclesGrid } from './DigitCirclesGrid';

interface EntryBotPanelProps {
  config: EntryBotConfig;
  onUpdateConfig: (newConfig: Partial<EntryBotConfig>) => void;
  digitStats: DigitStat[];
  isRunning: boolean;
  isPaused: boolean;
  inRecovery: boolean;
  waitingForSearch: boolean;
  statusText: string;
  currentDigit?: number;
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

const DIGIT_CONTRACT_OPTIONS: {
  value: EntryBotConfig['contractType1'];
  label: string;
}[] = [
  { value: 'OVER', label: 'Over' },
  { value: 'UNDER', label: 'Under' },
  { value: 'DIFFERS', label: 'Differs' },
  { value: 'MATCHES', label: 'Matches' },
];

export const EntryBotPanel: React.FC<EntryBotPanelProps> = ({
  config,
  onUpdateConfig,
  digitStats,
  isRunning,
  isPaused,
  inRecovery,
  waitingForSearch,
  statusText,
  currentDigit,
  onStart,
  onStop,
  onPause,
  onResume,
  metrics,
  onResetStats,
  currentStake,
  currentStep,
  activeContract,
  storageKey = 'tickedge_entry_bot_config',
  theme,
}) => {
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [resetTradeFeedback, setResetTradeFeedback] = useState(false);

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

  const clampDigit = (val: number) => Math.min(9, Math.max(0, Math.round(val)));

  return (
    <div className="bg-white border border-neutral-300 text-neutral-900 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 w-full shadow-lg">
      {/* Top Header Bar */}
      <div className="border border-neutral-200 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm bg-neutral-50 text-neutral-900">
        <div className="flex items-center gap-2 flex-wrap">
          <Crosshair className="w-5 h-5 text-blue-600 shrink-0" />
          <h2 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 text-neutral-950 flex-wrap">
            <span>Entry bot strategy</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-semibold border bg-neutral-200 text-neutral-800 border-neutral-300 whitespace-nowrap shrink-0">
              Entry Bot
            </span>
            {isRunning && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  isPaused
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : inRecovery
                    ? 'bg-rose-100 text-rose-900 border border-rose-300'
                    : waitingForSearch
                    ? 'bg-sky-100 text-sky-900 border border-sky-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPaused
                      ? 'bg-amber-500'
                      : inRecovery
                      ? 'bg-rose-600 animate-pulse'
                      : waitingForSearch
                      ? 'bg-sky-600 animate-ping'
                      : 'bg-emerald-600 animate-pulse'
                  }`}
                />
                {isPaused
                  ? 'PAUSED'
                  : inRecovery
                  ? 'RECOVERY (P2)'
                  : waitingForSearch
                  ? `SEARCHING #${config.searchNumber}`
                  : 'TRADING (P1)'}
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
            title="Reset Entry Bot trade history and metrics"
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

      {/* Live Execution Status Banner */}
      {isRunning && (
        <div className="px-3.5 py-2.5 rounded-xl bg-neutral-100 border border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-mono">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isPaused
                  ? 'bg-amber-500'
                  : inRecovery
                  ? 'bg-rose-500 animate-ping'
                  : waitingForSearch
                  ? 'bg-sky-500 animate-ping'
                  : 'bg-emerald-500 animate-ping'
              }`}
            />
            {isPaused ? (
              <span className="text-amber-800 font-semibold">
                Bot paused. Click Resume to continue scanning/trading.
              </span>
            ) : activeContract ? (
              <span className="text-emerald-800 font-bold">
                {inRecovery ? 'Recovery P2' : 'Primary P1'}: {activeContract.contractType}{' '}
                {activeContract.prediction} (Entry Digit: {activeContract.entryDigit}) ➔{' '}
                {activeContract.hasSkipTick && activeContract.stepState === 'skipped'
                  ? `Skipped (${activeContract.skippedTick?.lastDigit ?? '•'}) · Resolving exit`
                  : `${activeContract.ticksRemaining ?? activeContract.secondsRemaining ?? 1} remaining`}
              </span>
            ) : (
              <span className="text-neutral-800 font-semibold">
                {statusText ||
                  `Scanning for Search Number #${config.searchNumber} on ${
                    SYNTHETIC_MARKETS.find((m) => m.id === config.marketId)?.symbol ||
                    config.marketId
                  }`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-600 tabular-nums">
            <span>
              Active: <strong className="text-neutral-950">{inRecovery ? 'Prediction 2' : 'Prediction 1'}</strong>
            </span>
            <span>•</span>
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

      {/* Search Number Box (Manual Entry Trigger) */}
      <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-950 uppercase tracking-wide">
                Search Number (Entry Digit Trigger)
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-sky-600 text-white tabular-nums">
                Touch #{config.searchNumber} ➔ Start Immediately
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 mt-0.5">
              Input the target digit manually after analyzing the market. The trade starts immediately when live price touches this digit.
            </p>
          </div>

          {/* Trigger Cycle Mode */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-neutral-300 text-[11px]">
            <button
              type="button"
              onClick={() => onUpdateConfig({ entryTriggerMode: 'every_cycle' })}
              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer whitespace-nowrap ${
                config.entryTriggerMode !== 'once_continuous'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
              title="Wait for Search Number before every new Prediction 1 trade"
            >
              Wait Search Each Trade
            </button>
            <button
              type="button"
              onClick={() => onUpdateConfig({ entryTriggerMode: 'once_continuous' })}
              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer whitespace-nowrap ${
                config.entryTriggerMode === 'once_continuous'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
              title="Wait for Search Number once, then trade continuously"
            >
              Touch Once · Continuous
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <label className="text-xs font-bold text-neutral-800 whitespace-nowrap">
              Search No:
            </label>
            <div className="w-28 sm:w-32 shrink-0">
              <NumericInput
                min={0}
                max={9}
                step={1}
                fallbackValue={0}
                value={config.searchNumber}
                onChange={(val) => onUpdateConfig({ searchNumber: clampDigit(val) })}
                className="w-full px-3.5 py-2 bg-white border border-sky-300 rounded-xl text-neutral-950 text-base font-mono font-black focus:outline-none focus:ring-2 focus:ring-sky-500 tabular-nums"
              />
            </div>
          </div>
          <span className="text-[11px] text-neutral-600">
            Click any digit circle below or enter 0–9 manually to set your Search Number.
          </span>
        </div>

        {/* Compact Straight-Line Digits Analysis (0-9 + Live Ticker) */}
        <DigitCirclesGrid
          stats={digitStats}
          activeDigit={currentDigit}
          targetDigit={config.searchNumber}
          layout="compact"
          theme={theme}
          onSelectDigit={(d) => onUpdateConfig({ searchNumber: d })}
        />
      </div>

      {/* Prediction 1 (Primary) & Prediction 2 (Recovery on Failure) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Prediction 1 */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all ${
            isRunning && !inRecovery
              ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-300'
              : 'bg-neutral-50 border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-neutral-950 uppercase tracking-wide">
              Prediction 1 (Primary)
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
              1st Attempt
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-neutral-600">Contract</label>
              <div className="relative">
                <select
                  value={config.contractType1}
                  onChange={(e) => {
                    const nextType = e.target.value as EntryBotConfig['contractType1'];
                    const syncSecond = config.contractType2 === config.contractType1;
                    onUpdateConfig({
                      contractType1: nextType,
                      ...(syncSecond ? { contractType2: nextType } : {}),
                    });
                  }}
                  className="w-full appearance-none px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-neutral-400 pr-7 cursor-pointer"
                >
                  {DIGIT_CONTRACT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-neutral-600">Prediction 1</label>
              <NumericInput
                min={0}
                max={9}
                step={1}
                fallbackValue={2}
                value={config.prediction1}
                onChange={(val) => onUpdateConfig({ prediction1: clampDigit(val) })}
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-950 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-neutral-400 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Prediction 2 (Recovery) */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all ${
            isRunning && inRecovery
              ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-300'
              : 'bg-neutral-50 border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-neutral-950 uppercase tracking-wide flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Prediction 2 (Recovery)</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
              If P1 Fails
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-neutral-600">Recovery Contract</label>
              <div className="relative">
                <select
                  value={config.contractType2}
                  onChange={(e) =>
                    onUpdateConfig({
                      contractType2: e.target.value as EntryBotConfig['contractType2'],
                    })
                  }
                  className="w-full appearance-none px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-neutral-400 pr-7 cursor-pointer"
                >
                  {DIGIT_CONTRACT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-neutral-600">Prediction 2</label>
              <NumericInput
                min={0}
                max={9}
                step={1}
                fallbackValue={1}
                value={config.prediction2}
                onChange={(val) => onUpdateConfig({ prediction2: clampDigit(val) })}
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-950 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-neutral-400 tabular-nums"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Market & Duration */}
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
      </div>

      {/* Stake & Martingale × */}
      <div className="grid grid-cols-2 gap-2.5">
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

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Martingale ×</label>
          <NumericInput
            min={1}
            step={0.1}
            fallbackValue={1.8}
            value={config.martingale}
            onChange={(newMg) => onUpdateConfig({ martingale: newMg })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all tabular-nums"
          />
        </div>
      </div>

      {/* Martingale Level, Take Profit, Stop Loss */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
              2x (${(config.stake * 2).toFixed(2)})
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
          <span className="text-[10px] uppercase font-semibold text-neutral-500">Stake & Mode</span>
          <span className="text-sm font-bold font-mono text-amber-700 mt-0.5">
            ${currentStake.toFixed(2)} ({inRecovery ? 'P2' : 'P1'} · {currentStep}/{config.martingaleLevel})
          </span>
        </div>
      </div>
    </div>
  );
};
