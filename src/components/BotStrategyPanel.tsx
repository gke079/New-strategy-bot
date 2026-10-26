import React, { useState } from 'react';
import { Play, Square, Pause, ChevronDown, Check, RotateCcw, Zap, BookmarkCheck } from 'lucide-react';
import { BotMetrics, BotStrategyConfig, EntryConditionType, TradeContractType, Trade } from '../types';

interface BotStrategyPanelProps {
  config: BotStrategyConfig;
  onUpdateConfig: (newConfig: Partial<BotStrategyConfig>) => void;
  isRunning: boolean;
  isPaused?: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause?: () => void;
  onResume?: () => void;
  metrics: BotMetrics;
  trades: Trade[];
  onResetStats: () => void;
  onResetAfterTrade?: () => void;
  balance: number;
  storageKey?: string;
  tag?: string;
  theme?: 'dark' | 'light';
}

export const BotStrategyPanel: React.FC<BotStrategyPanelProps> = ({
  config,
  onUpdateConfig,
  isRunning,
  isPaused = false,
  onStart,
  onStop,
  onPause,
  onResume,
  metrics,
  trades,
  onResetStats,
  onResetAfterTrade,
  balance,
  storageKey,
  tag,
  theme,
}) => {
  const isLight = theme === 'light';
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [resetTradeFeedback, setResetTradeFeedback] = useState(false);

  const entryConditions: { value: EntryConditionType; label: string }[] = [
    { value: 'n_rising_then_falling', label: 'At least N rising ticks followed by 1 falling tick' },
    { value: 'n_falling_then_rising', label: 'At least N falling ticks followed by 1 rising tick' },
    { value: 'under_x', label: 'Last N digits all under X' },
    { value: 'over_x', label: 'Last N digits all over X' },
    { value: 'all_even', label: 'Last N digits all Even' },
    { value: 'all_odd', label: 'Last N digits all Odd' },
    { value: 'least_percent', label: 'Least frequent digit under P %' },
    { value: 'most_percent', label: 'Most frequent digit over P %' },
    { value: 'repeat_streak', label: 'Digit repeated N times in a row' },
    { value: 'differs_least', label: 'Differs from Least Frequent' },
  ];

  const tradeCategories: {
    category: string;
    options: { value: TradeContractType; label: string; desc?: string }[];
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
      category: 'Rise / Fall (Up / Down)',
      options: [
        { value: 'RISE', label: 'Rise (Call)' },
        { value: 'FALL', label: 'Fall (Put)' },
      ],
    },
    {
      category: 'Run Contracts',
      options: [
        { value: 'ONLY_UP', label: 'Only Up' },
        { value: 'ONLY_DOWN', label: 'Only Down' },
      ],
    },
    {
      category: 'Reset Contracts',
      options: [
        { value: 'RESET_CALL', label: 'Reset Call' },
        { value: 'RESET_PUT', label: 'Reset Put' },
      ],
    },
    {
      category: 'High / Low & Barriers',
      options: [
        { value: 'HIGHER', label: 'Higher' },
        { value: 'LOWER', label: 'Lower' },
        { value: 'HIGH_TICK', label: 'High Tick' },
        { value: 'LOW_TICK', label: 'Low Tick' },
      ],
    },
    {
      category: 'In / Out & Touch',
      options: [
        { value: 'STAY_BETWEEN', label: 'Stay Between' },
        { value: 'GOES_OUTSIDE', label: 'Goes Outside' },
        { value: 'TOUCH', label: 'Touch' },
        { value: 'NO_TOUCH', label: 'No Touch' },
      ],
    },
    {
      category: 'Asian Contracts',
      options: [
        { value: 'ASIAN_UP', label: 'Asian Rise' },
        { value: 'ASIAN_DOWN', label: 'Asian Fall' },
      ],
    },
  ];

  const handleSaveStrategy = () => {
    try {
      const key = storageKey || 'tickedge_saved_strategy';
      localStorage.setItem(key, JSON.stringify(config));
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
      {/* Header with Robot Icon (White box header) */}
      <div
        className="border border-neutral-200 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm bg-neutral-50 text-neutral-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2
            className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 text-neutral-950"
          >
            <span>Digits bot strategy</span>
            {tag && (
              <span
                className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-semibold border bg-neutral-200 text-neutral-800 border-neutral-300"
              >
                {tag}
              </span>
            )}
          </h2>
        </div>

        {/* Start / Stop & Reset trade history */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetHistoryClick}
            className="px-3 py-1.5 rounded-xl border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Reset trade history and performance metrics (bot settings are preserved)"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 text-neutral-700 ${
                resetTradeFeedback ? 'animate-spin' : ''
              }`}
            />
            <span>{resetTradeFeedback ? 'History Reset!' : 'Reset History'}</span>
          </button>

          {/* Pause / Resume Button: Pure Black Pause & Pure Green Resume */}
          {isRunning && (onPause || onResume) && (
            <button
              onClick={isPaused ? onResume : onPause}
              className={`px-3 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border active:scale-95 ${
                isPaused
                  ? 'bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00]'
                  : 'bg-[#000000] hover:bg-neutral-900 text-white border border-neutral-800'
              }`}
              title={isPaused ? 'Resume Strategy Bot execution' : 'Pause Strategy Bot temporarily'}
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

          {/* Run / Stop Button: Pure Green Run & Pure Red Stop */}
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
                <span>Run Bot</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Field: Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-neutral-700">Name</label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => onUpdateConfig({ name: e.target.value })}
          placeholder="e.g. Over 2 after 3 lows"
          className="w-full px-3.5 py-2.5 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all font-medium"
        />
      </div>

      {/* Field: Entry condition */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-neutral-700">Entry condition</label>
        <div className="relative">
          <select
            value={config.entryCondition}
            onChange={(e) => {
              const cond = e.target.value as EntryConditionType;
              const isRisingOrFalling = cond === 'n_rising_then_falling' || cond === 'n_falling_then_rising';
              onUpdateConfig({
                entryCondition: cond,
                n: isRisingOrFalling ? Math.max(2, config.n) : config.n,
              });
            }}
            className="w-full appearance-none px-3.5 py-2.5 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-10 font-medium cursor-pointer"
          >
            {entryConditions.map((cond) => (
              <option key={cond.value} value={cond.value} className="bg-white text-neutral-900">
                {cond.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Dynamic Contextual Helper Banner */}
        {config.entryCondition === 'n_rising_then_falling' && (
          <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span>📈</span>
            <span>
              Waits for <strong>at least {Math.max(2, config.n)} consecutive rising ticks</strong> followed by <strong>1 falling tick</strong> to execute.
            </span>
          </div>
        )}

        {config.entryCondition === 'n_falling_then_rising' && (
          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span>📉</span>
            <span>
              Waits for <strong>at least {Math.max(2, config.n)} consecutive falling ticks</strong> followed by <strong>1 rising tick</strong> to execute.
            </span>
          </div>
        )}
      </div>

      {/* Row: N, X (digit), P % */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">
            {config.entryCondition === 'n_rising_then_falling'
              ? 'N (rising ≥ 2)'
              : config.entryCondition === 'n_falling_then_rising'
              ? 'N (falling ≥ 2)'
              : 'N'}
          </label>
          <input
            type="number"
            min={config.entryCondition === 'n_rising_then_falling' || config.entryCondition === 'n_falling_then_rising' ? 2 : 1}
            max="30"
            value={config.n}
            onChange={(e) => {
              const minVal = config.entryCondition === 'n_rising_then_falling' || config.entryCondition === 'n_falling_then_rising' ? 2 : 1;
              const val = parseInt(e.target.value, 10);
              onUpdateConfig({ n: isNaN(val) ? minVal : Math.max(minVal, val) });
            }}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">X (digit)</label>
          <input
            type="number"
            min="0"
            max="9"
            value={config.xDigit}
            onChange={(e) => onUpdateConfig({ xDigit: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">P %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={config.pPercent}
            onChange={(e) => onUpdateConfig({ pPercent: parseFloat(e.target.value) || 0 })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>
      </div>

      {/* Row: Trade & Prediction digit */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Trade</label>
          <div className="relative">
            <select
              value={config.tradeType}
              onChange={(e) => onUpdateConfig({ tradeType: e.target.value as TradeContractType })}
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

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">
            {['OVER', 'UNDER', 'DIFFERS', 'MATCHES'].includes(config.tradeType)
              ? 'Prediction digit'
              : 'Prediction / Target'}
          </label>
          {['OVER', 'UNDER', 'DIFFERS', 'MATCHES'].includes(config.tradeType) ? (
            <input
              type="number"
              min="0"
              max="9"
              value={config.predictionDigit}
              onChange={(e) => onUpdateConfig({ predictionDigit: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
            />
          ) : (
            <div className="w-full px-3.5 py-2 bg-neutral-100 border border-neutral-300 rounded-xl text-neutral-700 text-sm font-mono flex items-center justify-between select-none">
              <span className="truncate">
                {['RISE', 'FALL'].includes(config.tradeType)
                  ? 'Price Direction'
                  : ['ONLY_UP', 'ONLY_DOWN'].includes(config.tradeType)
                  ? 'Strict Run'
                  : ['RESET_CALL', 'RESET_PUT'].includes(config.tradeType)
                  ? 'Reset Barrier'
                  : ['STAY_BETWEEN', 'GOES_OUTSIDE'].includes(config.tradeType)
                  ? 'Barrier Range'
                  : ['HIGH_TICK', 'LOW_TICK'].includes(config.tradeType)
                  ? 'Extremum Tick'
                  : 'Automatic'}
              </span>
              <span className="text-[10px] text-neutral-500 font-bold uppercase">Spot</span>
            </div>
          )}
        </div>
      </div>

      {/* Row: Duration & Stake */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Duration</label>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              max={config.durationUnit === 'm' ? 120 : config.durationUnit === 's' ? 3600 : 10}
              value={config.duration}
              onChange={(e) => onUpdateConfig({ duration: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="flex-1 px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
            />
            <div className="relative w-28">
              <select
                value={config.durationUnit || 't'}
                onChange={(e) => onUpdateConfig({ durationUnit: e.target.value as 't' | 's' | 'm' })}
                className="w-full appearance-none px-3 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all pr-7 cursor-pointer"
              >
                <option value="t" className="bg-white text-neutral-900">Ticks (t)</option>
                <option value="s" className="bg-white text-neutral-900">Sec (s)</option>
                <option value="m" className="bg-white text-neutral-900">Min (m)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Stake</label>
          <input
            type="number"
            min="0.35"
            step="0.5"
            value={config.stake}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0.5;
              onUpdateConfig({ stake: val, initialStake: val });
            }}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>
      </div>

      {/* Row: Martingale × & Max steps */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Martingale ×</label>
          <input
            type="number"
            min="1"
            step="0.1"
            value={config.martingale}
            onChange={(e) => onUpdateConfig({ martingale: parseFloat(e.target.value) || 1 })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Max steps</label>
          <input
            type="number"
            min="1"
            max="15"
            value={config.maxSteps}
            onChange={(e) => onUpdateConfig({ maxSteps: parseInt(e.target.value, 10) || 1 })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>
      </div>

      {/* Row: Take profit & Stop loss */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Take profit</label>
          <input
            type="number"
            min="1"
            step="5"
            value={config.takeProfit}
            onChange={(e) => onUpdateConfig({ takeProfit: parseFloat(e.target.value) || 10 })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-700">Stop loss</label>
          <input
            type="number"
            min="1"
            step="5"
            value={config.stopLoss}
            onChange={(e) => onUpdateConfig({ stopLoss: parseFloat(e.target.value) || 20 })}
            className="w-full px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 rounded-xl text-neutral-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-all"
          />
        </div>
      </div>

      {/* Primary Action Buttons: Save Strategy & Reset after trade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
        <button
          onClick={handleSaveStrategy}
          className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
        >
          {savedFeedback ? (
            <>
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Strategy Saved!</span>
            </>
          ) : (
            <span>Save strategy</span>
          )}
        </button>

        <button
          onClick={handleResetHistoryClick}
          className="w-full py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
          title="Reset trade history and performance metrics (bot settings are preserved)"
        >
          <RotateCcw className={`w-3.5 h-3.5 text-neutral-700 transition-transform ${resetTradeFeedback ? 'animate-spin' : ''}`} />
          <span>{resetTradeFeedback ? 'History Reset!' : 'Reset History'}</span>
        </button>
      </div>

      {/* Real-time bot metrics & live executions (Bot Footer in White Box) */}
      <div
        className="border border-neutral-200 rounded-xl p-3 flex flex-col gap-2.5 mt-1 bg-neutral-50 text-neutral-900 shadow-sm"
      >
        <div
          className="flex items-center justify-between text-xs font-semibold text-neutral-700"
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? isPaused
                    ? 'bg-amber-500'
                    : 'bg-emerald-600 animate-pulse'
                  : 'bg-neutral-400'
              }`}
            />
            <span>
              Status: {isRunning ? (isPaused ? 'Paused' : 'Active & Scanning Ticks') : 'Idle'}
            </span>
          </div>
          <span
            className="font-mono text-neutral-950 font-bold"
          >
            Balance: ${balance.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div
            className="p-2 rounded-lg border border-neutral-200 bg-white"
          >
            <div
              className="text-[10px] uppercase font-semibold text-neutral-500"
            >
              Net P/L
            </div>
            <div
              className={`font-mono font-bold ${
                metrics.totalProfit > 0
                  ? 'text-emerald-600'
                  : metrics.totalProfit < 0
                  ? 'text-rose-600'
                  : 'text-neutral-800'
              }`}
            >
              {metrics.totalProfit > 0 ? '+' : ''}${metrics.totalProfit.toFixed(2)}
            </div>
          </div>

          <div
            className="p-2 rounded-lg border border-neutral-200 bg-white"
          >
            <div
              className="text-[10px] uppercase font-semibold text-neutral-500"
            >
              Win Rate
            </div>
            <div className="font-mono font-bold text-emerald-600">{metrics.winRate}%</div>
          </div>

          <div
            className="p-2 rounded-lg border border-neutral-200 bg-white"
          >
            <div
              className="text-[10px] uppercase font-semibold text-neutral-500"
            >
              W / L
            </div>
            <div
              className="font-mono font-semibold text-neutral-800"
            >
              <span className="text-emerald-600">{metrics.wins}</span>
              <span className="text-neutral-400">/</span>
              <span className="text-rose-600">{metrics.losses}</span>
            </div>
          </div>

          <div
            className="p-2 rounded-lg border border-neutral-200 bg-white"
          >
            <div
              className="text-[10px] uppercase font-semibold text-neutral-500"
            >
              Trades
            </div>
            <div
              className="font-mono font-bold text-neutral-950"
            >
              {metrics.totalTrades}
            </div>
          </div>
        </div>

        {/* Recent Executions in Footer */}
        {trades.length > 0 && (
          <div
            className="border-t border-neutral-200 pt-2 space-y-1"
          >
            <div
              className="flex items-center justify-between text-[10px] uppercase font-semibold text-neutral-500"
            >
              <span>Recent Trade Executions</span>
              <button
                onClick={handleResetHistoryClick}
                className="flex items-center gap-1 font-mono normal-case cursor-pointer text-neutral-600 hover:text-black transition-colors"
                title="Reset trade history and performance metrics"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset history</span>
              </button>
            </div>
            {trades.slice(0, 3).map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono border bg-white text-neutral-900 border-neutral-200"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      trade.status === 'won' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-bold text-neutral-950">
                    {trade.prediction}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-600">
                    Digit:{' '}
                    <strong className="text-neutral-950">
                      {trade.exitDigit}
                    </strong>
                  </span>
                  <span
                    className={`font-bold ${
                      trade.status === 'won' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {trade.profit > 0 ? '+' : ''}${trade.profit.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
