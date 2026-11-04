import React, { useState } from 'react';
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  ChevronDown,
  Check,
  BookmarkCheck,
  Sparkles,
  Zap,
  Clock,
} from 'lucide-react';
import { BotMetrics, NormalBotConfig, Trade, TradeContractType } from '../types';
import { SYNTHETIC_MARKETS } from '../services/markets';
import { ActiveContract } from '../services/normalBotEngine';
import { NumericInput } from './NumericInput';

interface NormalBotPanelProps {
  config: NormalBotConfig;
  onUpdateConfig: (newConfig: Partial<NormalBotConfig>) => void;
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  metrics: BotMetrics;
  trades: Trade[];
  onResetStats: () => void;
  onResetStake: () => void;
  currentStake: number;
  currentStep: number;
  activeContract: ActiveContract | null;
  balance: number;
  tag?: string;
  storageKey?: string;
  theme?: 'dark' | 'light';
}

export const NormalBotPanel: React.FC<NormalBotPanelProps> = ({
  config,
  onUpdateConfig,
  isRunning,
  isPaused,
  onStart,
  onStop,
  onPause,
  onResume,
  metrics,
  trades,
  onResetStats,
  onResetStake,
  currentStake,
  currentStep,
  activeContract,
  balance,
  tag = 'Normal Bot',
  storageKey = 'tickedge_normal_bot_config',
  theme,
}) => {
  const isLight = theme === 'light';
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [resetTradeFeedback, setResetTradeFeedback] = useState(false);

  const digitTypes = ['OVER', 'UNDER', 'DIFFERS', 'MATCHES'];
  const isDigitContract = digitTypes.includes(config.contractType);
  const isEvenOddContract = config.contractType === 'EVEN' || config.contractType === 'ODD';
  const isOnlyUpDownContract =
    config.contractType === 'ONLY_UP' || config.contractType === 'ONLY_DOWN';
  const isHighLowTickContract =
    config.contractType === 'HIGH_TICK' || config.contractType === 'LOW_TICK';
  const isRiseFallContract = config.contractType === 'RISE' || config.contractType === 'FALL' || config.contractType === 'HIGHER' || config.contractType === 'LOWER';

  const tradeCategories: {
    category: string;
    options: { value: TradeContractType; label: string }[];
  }[] = [
    {
      category: 'Digits Contracts',
      options: [
        { value: 'OVER', label: 'Over' },
        { value: 'UNDER', label: 'Under' },
        { value: 'DIFFERS', label: 'Differs' },
        { value: 'MATCHES', label: 'Matches' },
        { value: 'EVEN', label: 'Even' },
        { value: 'ODD', label: 'Odd' },
      ],
    },
    {
      category: 'Price Movement',
      options: [
        { value: 'ONLY_UP', label: 'Only Ups' },
        { value: 'ONLY_DOWN', label: 'Only Downs' },
        { value: 'RISE', label: 'Rise (Call)' },
        { value: 'FALL', label: 'Fall (Put)' },
        { value: 'HIGHER', label: 'Higher' },
        { value: 'LOWER', label: 'Lower' },
      ],
    },
    {
      category: 'High / Low Ticks',
      options: [
        { value: 'HIGH_TICK', label: 'High Tick' },
        { value: 'LOW_TICK', label: 'Low Tick' },
      ],
    },
  ];

  const handleContractChange = (newContract: TradeContractType) => {
    let defaultPrediction = config.prediction;
    let nextDuration = config.duration;
    let nextDurationUnit = config.durationUnit;
    if (digitTypes.includes(newContract)) {
      if (typeof config.prediction !== 'number' || isNaN(Number(config.prediction))) {
        defaultPrediction = newContract === 'OVER' ? 2 : newContract === 'UNDER' ? 7 : 5;
      }
      nextDuration = 1;
      nextDurationUnit = 't';
    } else if (newContract === 'EVEN' || newContract === 'ODD') {
      defaultPrediction = newContract;
      nextDuration = 1;
      nextDurationUnit = 't';
    } else if (newContract === 'ONLY_UP' || newContract === 'ONLY_DOWN') {
      defaultPrediction = newContract;
      nextDuration = 5;
      nextDurationUnit = 't';
    } else if (newContract === 'HIGH_TICK' || newContract === 'LOW_TICK') {
      const numPred = Number(config.prediction);
      defaultPrediction = numPred >= 1 && numPred <= 5 ? Math.round(numPred) : 5;
      nextDuration = 5;
      nextDurationUnit = 't';
    } else if (newContract === 'RISE' || newContract === 'FALL') {
      defaultPrediction = newContract;
    }
    onUpdateConfig({
      contractType: newContract,
      prediction: defaultPrediction,
      duration: nextDuration,
      durationUnit: nextDurationUnit,
      signalEntryTrigger: 'immediate',
    });
  };

  const handleSaveConfig = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch {}
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleResetHistoryClick = () => {
    onResetStats(); // Resets only current trade history and metrics, preserves all bot settings
    setResetTradeFeedback(true);
    setTimeout(() => setResetTradeFeedback(false), 2000);
  };

  return (
    <div className="bg-white border border-neutral-300 text-neutral-900 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 w-full shadow-lg">
      {/* Top Header Bar (White box header) */}
      <div
        className="border border-neutral-200 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm bg-neutral-50 text-neutral-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2
            className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 text-neutral-950"
          >
            <span>Normal bot strategy</span>
            {tag && (
              <span
                className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-semibold border bg-neutral-200 text-neutral-800 border-neutral-300"
              >
                {tag}
              </span>
            )}
            {/* Status indicator pill */}
            {isRunning && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  isPaused
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPaused ? 'bg-amber-500' : 'bg-emerald-600 animate-pulse'
                  }`}
                />
                {isPaused ? 'PAUSED' : 'RUNNING'}
              </span>
            )}
          </h2>
        </div>

        {/* Action Controls: Reset History, Pause/Resume, Run/Stop Bot */}
        <div className="flex items-center gap-2">
          {/* Reset Trade History Button */}
          <button
            onClick={handleResetHistoryClick}
            className="px-3 py-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Reset trade history and performance metrics (bot settings are preserved)"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 text-sky-600 ${
                resetTradeFeedback ? 'animate-spin' : ''
              }`}
            />
            <span>{resetTradeFeedback ? 'History Reset!' : 'Reset History'}</span>
          </button>

          {/* Speed Mode Toggle Button (Between Reset and Run) */}
          <button
            type="button"
            onClick={() => {
              const nextSpeed = config.botSpeed === 'fast' ? 'normal' : 'fast';
              onUpdateConfig({ botSpeed: nextSpeed });
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border active:scale-95 ${
              config.botSpeed === 'fast'
                ? 'bg-amber-400 hover:bg-amber-300 text-black border-amber-500 shadow-amber-500/20'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
            }`}
            title={
              config.botSpeed === 'fast'
                ? 'Fast Mode: Trades after every tick'
                : 'Normal Mode: Entry digit -> Skip 1 tick -> Exit tick'
            }
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

          {/* Pause / Resume Button (Visible when running) */}
          {isRunning && (
            <button
              onClick={isPaused ? onResume : onPause}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border active:scale-95 ${
                isPaused
                  ? 'bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00]'
                  : 'bg-[#000000] hover:bg-neutral-900 text-white border border-neutral-800'
              }`}
              title={isPaused ? 'Resume trading' : 'Pause trading temporarily'}
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

          {/* Start / Stop Button: Pure Green Run & Pure Red Stop */}
          <button
            onClick={isRunning ? onStop : onStart}
            className={`px-4 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md cursor-pointer border active:scale-95 ${
              isRunning
                ? 'bg-[#FF0000] hover:bg-[#e60000] text-white border border-[#cc0000]'
                : 'bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00]'
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
                <span>
                  {isHighLowTickContract || isOnlyUpDownContract
                    ? 'Start Trade Now'
                    : 'Run Bot'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Contract / Live Status Bar (Compact) */}
      {isRunning && (
        <div className="px-3.5 py-2 rounded-xl bg-neutral-100 border border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-ping'
              }`}
            />
            {isPaused ? (
              <span className="text-amber-800 font-medium">
                Bot is currently paused. Click "Resume" to continue placing trades.
              </span>
            ) : activeContract ? (
              <span className="text-emerald-700 font-bold">
                {activeContract.contractType === 'ONLY_UP' ||
                activeContract.contractType === 'ONLY_DOWN' ? (
                  <>
                    <span className="text-emerald-800">
                      {activeContract.contractType === 'ONLY_UP' ? 'Only Up ▲' : 'Only Down ▼'} (Entry: {activeContract.entryPrice})
                    </span>
                    <span className="mx-1">➔</span>
                    <span className="text-neutral-600">
                      {activeContract.ticksRemaining ?? 1} tick(s) remaining
                    </span>
                  </>
                ) : activeContract.contractType === 'HIGH_TICK' ||
                  activeContract.contractType === 'LOW_TICK' ? (
                  <>
                    <span className="text-emerald-800">
                      {activeContract.contractType === 'HIGH_TICK'
                        ? `High Tick #${activeContract.prediction}`
                        : `Low Tick #${activeContract.prediction}`}{' '}
                      (Entry: {activeContract.entryPrice})
                    </span>
                    <span className="mx-1">➔</span>
                    <span className="text-neutral-600">
                      {activeContract.ticksRemaining ?? 1} / 5 tick(s) remaining
                    </span>
                  </>
                ) : activeContract.hasSkipTick && activeContract.stepState === 'skipped' ? (
                  <>
                    <span className="text-neutral-600">Entry: {activeContract.entryDigit}</span>
                    <span className="mx-1">➔</span>
                    <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-mono">
                      ⏭ Skipped 1 Tick ({activeContract.skippedTick?.lastDigit ?? '•'})
                    </span>
                    <span className="mx-1">➔</span>
                    <span className="text-emerald-700">Waiting for Exit Digit...</span>
                  </>
                ) : activeContract.hasSkipTick ? (
                  <>
                    <span className="text-emerald-800">
                      Entry Digit: {activeContract.entryDigit} (Quote: {activeContract.entryPrice})
                    </span>
                    <span className="mx-1">➔</span>
                    <span className="text-neutral-500">Next tick will be skipped...</span>
                  </>
                ) : activeContract.durationUnit === 't' && (activeContract.duration ?? 1) > 1 ? (
                  <>
                    <span className="text-emerald-800">
                      Entry Digit: {activeContract.entryDigit} (Quote: {activeContract.entryPrice})
                    </span>
                    <span className="mx-1">➔</span>
                    <span className="text-neutral-600">
                      {activeContract.ticksRemaining ?? activeContract.duration} tick(s) remaining
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-amber-600 font-bold">⚡ Fast:</span> Trade on every tick (Entry: {activeContract.entryDigit} / {activeContract.entryPrice}) ➔ Resolving next tick
                  </>
                )}
              </span>
            ) : (
              <span className="text-neutral-700">
                Evaluating next contract ({config.contractType} on {SYNTHETIC_MARKETS.find((m) => m.id === config.marketId)?.symbol || config.marketId})...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-600">
            <span>Stake: <strong className="text-neutral-900">${currentStake.toFixed(2)}</strong></span>
            <span>•</span>
            <span>Step: <strong className="text-amber-700">{currentStep} / {config.martingaleLevel}</strong></span>
          </div>
        </div>
      )}

      {/* 5-Minute Candle Strategy Banner for High/Low Tick and Only Up/Down */}
      {(isHighLowTickContract || isOnlyUpDownContract) && (
        <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-300 flex flex-col gap-2 text-xs text-neutral-800 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>5-Minute Candle & RSI Strategy</span>
            </div>
            <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
              Immediate Entry · Closing 20s Guard
            </span>
          </div>

          <div className="text-[11px] text-neutral-600 leading-relaxed">
            Candle rules: Trades start immediately when <strong>RSI and candle conditions are met</strong> (no 1-minute wait). Closing 20s guard (04:40–05:00) protects against trend changes before the new candle.
          </div>

          {/* Entry Timing Choice */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-emerald-200 text-xs">
            <span className="font-semibold text-neutral-700">Entry Execution:</span>
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-neutral-300 text-[11px]">
              <button
                type="button"
                onClick={() => onUpdateConfig({ signalEntryTrigger: 'immediate' })}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  !config.signalEntryTrigger || config.signalEntryTrigger === 'immediate'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                On My Click (User Decision)
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({
                    signalEntryTrigger:
                      config.contractType === 'HIGH_TICK'
                        ? 'high_tick_3_rising_confirm'
                        : config.contractType === 'LOW_TICK'
                        ? 'low_tick_3_falling_confirm'
                        : config.contractType === 'ONLY_UP'
                        ? 'only_up_after_down_confirm'
                        : 'only_down_after_up_confirm',
                  })
                }
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  config.signalEntryTrigger && config.signalEntryTrigger !== 'immediate'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Auto Momentum Wait
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Market & Contract matching BotStrategyPanel 2-col layout */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Field 1: Market */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Market</label>
          <div className="relative">
            <select
              value={config.marketId}
              onChange={(e) => onUpdateConfig({ marketId: e.target.value })}
              className="w-full appearance-none px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-10 font-medium cursor-pointer"
            >
              <optgroup label="Plain Volatility Indices" className="bg-neutral-100 text-neutral-800 font-semibold">
                {SYNTHETIC_MARKETS.filter((m) => m.category === 'volatility').map((m) => (
                  <option key={m.id} value={m.id} className="bg-white text-neutral-900 font-normal">
                    {m.symbol} — {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Volatility (1s) Indices" className="bg-neutral-100 text-neutral-800 font-semibold">
                {SYNTHETIC_MARKETS.filter((m) => m.category === 'volatility-1s').map((m) => (
                  <option key={m.id} value={m.id} className="bg-white text-neutral-900 font-normal">
                    {m.symbol} — {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Jump Indices (J10 – J100)" className="bg-neutral-100 text-neutral-800 font-semibold">
                {SYNTHETIC_MARKETS.filter((m) => m.category === 'jump').map((m) => (
                  <option key={m.id} value={m.id} className="bg-white text-neutral-900 font-normal">
                    {m.symbol} — {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Step Indices (STEP 100 – STEP 500)" className="bg-neutral-100 text-neutral-800 font-semibold">
                {SYNTHETIC_MARKETS.filter((m) => m.category === 'step').map((m) => (
                  <option key={m.id} value={m.id} className="bg-white text-neutral-900 font-normal">
                    {m.symbol} — {m.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Field 2: Contract */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Contract</label>
          <div className="relative">
            <select
              value={config.contractType}
              onChange={(e) => handleContractChange(e.target.value as TradeContractType)}
              className="w-full appearance-none px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-10 font-medium cursor-pointer"
            >
              {tradeCategories.map((group) => (
                <optgroup key={group.category} label={group.category} className="bg-neutral-100 text-neutral-800 font-semibold">
                  {group.options.map((t) => (
                    <option key={t.value} value={t.value} className="bg-white text-neutral-900 font-normal">
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Row 2: Prediction & Duration */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Field 3: Prediction */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">
            {isDigitContract
              ? 'Prediction digit'
              : isHighLowTickContract
              ? 'Predicted tick (1–5)'
              : 'Prediction'}
          </label>
          {isDigitContract ? (
            <input
              type="number"
              min="0"
              max="9"
              value={config.prediction}
              onChange={(e) => onUpdateConfig({ prediction: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
            />
          ) : isHighLowTickContract ? (
            <div className="relative">
              <select
                value={Math.min(5, Math.max(1, Number(config.prediction) || 5))}
                onChange={(e) =>
                  onUpdateConfig({
                    prediction: Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 5)),
                    duration: 5,
                    durationUnit: 't',
                  })
                }
                className="w-full appearance-none px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-10 cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((tNum) => (
                  <option key={tNum} value={tNum} className="bg-white text-neutral-900">
                    Tick #{tNum}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : isEvenOddContract ? (
            <div className="relative">
              <select
                value={String(config.prediction)}
                onChange={(e) => onUpdateConfig({ prediction: e.target.value, contractType: e.target.value as TradeContractType })}
                className="w-full appearance-none px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-10 cursor-pointer"
              >
                <option value="EVEN" className="bg-white text-neutral-900">EVEN</option>
                <option value="ODD" className="bg-white text-neutral-900">ODD</option>
              </select>
              <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : isOnlyUpDownContract ? (
            <div className="relative">
              <select
                value={config.contractType}
                onChange={(e) =>
                  onUpdateConfig({
                    prediction: e.target.value,
                    contractType: e.target.value as TradeContractType,
                    signalEntryTrigger: 'immediate',
                  })
                }
                className="w-full appearance-none px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-10 cursor-pointer"
              >
                <option value="ONLY_UP" className="bg-white text-neutral-900">
                  ONLY UP
                </option>
                <option value="ONLY_DOWN" className="bg-white text-neutral-900">
                  ONLY DOWN
                </option>
              </select>
              <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : isRiseFallContract ? (
            <div className="relative">
              <select
                value={String(config.prediction)}
                onChange={(e) => onUpdateConfig({ prediction: e.target.value, contractType: e.target.value as TradeContractType })}
                className="w-full appearance-none px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-10 cursor-pointer"
              >
                <option value="RISE" className="bg-white text-neutral-900">RISE</option>
                <option value="FALL" className="bg-white text-neutral-900">FALL</option>
              </select>
              <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <input
              type="text"
              value={String(config.prediction)}
              onChange={(e) => onUpdateConfig({ prediction: e.target.value })}
              className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
            />
          )}
        </div>

        {/* Field 4: Duration with interactive visible unit selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Duration</label>
          <div className="flex gap-1.5">
            <NumericInput
              min={
                isHighLowTickContract
                  ? 5
                  : (config.durationUnit || 't') === 't'
                  ? isOnlyUpDownContract
                    ? 2
                    : 1
                  : 1
              }
              max={
                isHighLowTickContract
                  ? 5
                  : config.durationUnit === 'm'
                  ? 120
                  : config.durationUnit === 's'
                  ? 3600
                  : isOnlyUpDownContract
                  ? 5
                  : 10
              }
              value={isHighLowTickContract ? 5 : config.duration}
              fallbackValue={isHighLowTickContract || isOnlyUpDownContract ? 5 : 1}
              disabled={isHighLowTickContract}
              onChange={(val) => {
                if (isHighLowTickContract) return;
                onUpdateConfig({ duration: Math.round(val) });
              }}
              className="flex-1 px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all disabled:opacity-75"
            />
            <div className="relative w-28">
              <select
                value={isHighLowTickContract ? 't' : config.durationUnit || 't'}
                disabled={isHighLowTickContract}
                onChange={(e) => onUpdateConfig({ durationUnit: e.target.value as 't' | 's' | 'm' })}
                className="w-full appearance-none px-3 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-7 cursor-pointer disabled:opacity-75"
              >
                <option value="t" className="bg-white text-neutral-900">Ticks (t)</option>
                <option value="s" className="bg-white text-neutral-900">Sec (s)</option>
                <option value="m" className="bg-white text-neutral-900">Min (m)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Stake & Martingale × */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Field 5: Stake */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Stake</label>
          <NumericInput
            min={0.35}
            step={0.05}
            fallbackValue={0.35}
            value={config.stake}
            onChange={(newStake) => {
              // By default let take profit be double the stake for risk management purpose
              const wasDoubleStake =
                Math.abs(config.takeProfit - config.stake * 2) < 0.02 ||
                config.takeProfit === 0.1 ||
                config.takeProfit === 0.7;
              const nextTp = wasDoubleStake ? Number((newStake * 2).toFixed(2)) : config.takeProfit;
              onUpdateConfig({ stake: newStake, initialStake: newStake, takeProfit: nextTp });
            }}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>

        {/* Field 6: Martingale */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Martingale ×</label>
          <NumericInput
            min={1}
            step={0.1}
            fallbackValue={1.5}
            value={config.martingale}
            onChange={(newMg) => onUpdateConfig({ martingale: newMg })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>
      </div>

      {/* Row 4: Martingale level & Take profit */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Field 7: Martingale level (Max steps) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Martingale level</label>
          <NumericInput
            min={1}
            max={15}
            step={1}
            fallbackValue={4}
            value={config.martingaleLevel}
            onChange={(lvl) => onUpdateConfig({ martingaleLevel: Math.round(lvl) })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>

        {/* Field 8: Take profit */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-700">Take profit</label>
            <button
              type="button"
              onClick={() => onUpdateConfig({ takeProfit: Number((config.stake * 2).toFixed(2)) })}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 transition-colors"
              title="Set Take Profit to 2x stake (Default risk-management ratio)"
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
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>
      </div>

      {/* Row 5: Stop loss & Compact Save Strategy button */}
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Field 9: Stop loss */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-700">Stop loss</label>
            <NumericInput
              min={0.5}
              step={1}
              fallbackValue={20}
              value={config.stopLoss}
              onChange={(sl) => onUpdateConfig({ stopLoss: sl })}
              className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
            />
          </div>
        </div>

        {/* Compact Save Strategy & Reset History Buttons fitted to font size */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSaveConfig}
            className={`w-fit inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] leading-tight transition-all shadow-xs cursor-pointer active:scale-95 border whitespace-nowrap ${
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
            onClick={handleResetHistoryClick}
            className="w-fit inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-700 font-semibold text-[11px] leading-tight transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
            title="Reset trade history and performance metrics (bot settings are preserved)"
          >
            <RotateCcw className={`w-3 h-3 text-sky-600 shrink-0 transition-transform ${resetTradeFeedback ? 'animate-spin' : ''}`} />
            <span>{resetTradeFeedback ? 'History Reset!' : 'Reset History'}</span>
          </button>
        </div>
      </div>

      {/* Live Compact Metrics Bar (Footer in White Bot Box) */}
      <div
        className="grid grid-cols-4 gap-2 pt-2 border border-neutral-200 rounded-xl p-3 bg-neutral-50 text-neutral-900 shadow-sm"
      >
        <div
          className="border border-neutral-200 rounded-xl p-2.5 flex flex-col bg-white"
        >
          <span
            className="text-[10px] uppercase font-semibold text-neutral-500"
          >
            Total Profit
          </span>
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

        <div
          className="border border-neutral-200 rounded-xl p-2.5 flex flex-col bg-white"
        >
          <span
            className="text-[10px] uppercase font-semibold text-neutral-500"
          >
            Win Rate
          </span>
          <span className="text-sm font-bold font-mono text-emerald-600 mt-0.5">
            {metrics.winRate}%
          </span>
        </div>

        <div
          className="border border-neutral-200 rounded-xl p-2.5 flex flex-col bg-white"
        >
          <span
            className="text-[10px] uppercase font-semibold text-neutral-500"
          >
            Trades
          </span>
          <span
            className="text-sm font-bold font-mono mt-0.5 text-neutral-950"
          >
            {metrics.totalTrades} ({metrics.wins}W/{metrics.losses}L)
          </span>
        </div>

        <div
          className="border border-neutral-200 rounded-xl p-2.5 flex flex-col bg-white"
        >
          <span
            className="text-[10px] uppercase font-semibold text-neutral-500"
          >
            Stake & Step
          </span>
          <span className="text-sm font-bold font-mono text-amber-700 mt-0.5">
            ${currentStake.toFixed(2)} ({currentStep}/{config.martingaleLevel})
          </span>
        </div>
      </div>
    </div>
  );
};
