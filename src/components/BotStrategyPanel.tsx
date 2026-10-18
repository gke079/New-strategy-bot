import React, { useState } from 'react';
import { Play, Square, ChevronDown, Check, RotateCcw, Zap, BookmarkCheck } from 'lucide-react';
import { BotMetrics, BotStrategyConfig, EntryConditionType, TradeContractType, Trade } from '../types';

interface BotStrategyPanelProps {
  config: BotStrategyConfig;
  onUpdateConfig: (newConfig: Partial<BotStrategyConfig>) => void;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  metrics: BotMetrics;
  trades: Trade[];
  onResetStats: () => void;
  onResetAfterTrade?: () => void;
  balance: number;
  storageKey?: string;
  tag?: string;
}

export const BotStrategyPanel: React.FC<BotStrategyPanelProps> = ({
  config,
  onUpdateConfig,
  isRunning,
  onStart,
  onStop,
  metrics,
  trades,
  onResetStats,
  onResetAfterTrade,
  balance,
  storageKey,
  tag,
}) => {
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

  const handleResetAfterTradeClick = () => {
    if (onResetAfterTrade) {
      onResetAfterTrade();
    }
    onUpdateConfig({ stake: config.initialStake });
    setResetTradeFeedback(true);
    setTimeout(() => setResetTradeFeedback(false), 2000);
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 w-full shadow-lg">
      {/* Title with Robot Icon matching screenshot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Digits bot strategy</span>
            {tag && (
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-[#00e599] border border-slate-700 font-semibold">
                {tag}
              </span>
            )}
          </h2>
        </div>

        {/* Start / Stop & Reset after trade */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetAfterTradeClick}
            className="px-3 py-1.5 rounded-xl bg-[#090d16] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title="Reset stake and loss steps back to base stake"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-[#00e599] ${resetTradeFeedback ? 'animate-spin' : ''}`} />
            <span>{resetTradeFeedback ? 'Reset!' : 'Reset after trade'}</span>
          </button>

          <button
            onClick={isRunning ? onStop : onStart}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md ${
              isRunning
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                : 'bg-[#00e599] hover:bg-[#00e599]/90 text-black font-semibold'
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

      {/* Field: Name matching screenshot */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-300">Name</label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => onUpdateConfig({ name: e.target.value })}
          placeholder="e.g. Over 2 after 3 lows"
          className="w-full px-3.5 py-2.5 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all font-medium"
        />
      </div>

      {/* Field: Entry condition matching screenshot */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-300">Entry condition</label>
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
            className="w-full appearance-none px-3.5 py-2.5 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all pr-10 font-medium cursor-pointer"
          >
            {entryConditions.map((cond) => (
              <option key={cond.value} value={cond.value} className="bg-[#111827] text-white">
                {cond.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Dynamic Contextual Helper Banner */}
        {config.entryCondition === 'n_rising_then_falling' && (
          <div className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span>📈</span>
            <span>
              Waits for <strong>at least {Math.max(2, config.n)} consecutive rising ticks</strong> followed by <strong>1 falling tick</strong> to execute.
            </span>
          </div>
        )}

        {config.entryCondition === 'n_falling_then_rising' && (
          <div className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span>📉</span>
            <span>
              Waits for <strong>at least {Math.max(2, config.n)} consecutive falling ticks</strong> followed by <strong>1 rising tick</strong> to execute.
            </span>
          </div>
        )}
      </div>

      {/* Row: N, X (digit), P % matching screenshot */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">
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
            className="w-full px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">X (digit)</label>
          <input
            type="number"
            min="0"
            max="9"
            value={config.xDigit}
            onChange={(e) => onUpdateConfig({ xDigit: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">P %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={config.pPercent}
            onChange={(e) => onUpdateConfig({ pPercent: parseFloat(e.target.value) || 0 })}
            className="w-full px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
          />
        </div>
      </div>

      {/* Row: Trade & Prediction digit matching screenshot */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Trade</label>
          <div className="relative">
            <select
              value={config.tradeType}
              onChange={(e) => onUpdateConfig({ tradeType: e.target.value as TradeContractType })}
              className="w-full appearance-none px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all pr-10 font-medium cursor-pointer"
            >
              {tradeCategories.map((group) => (
                <optgroup key={group.category} label={group.category} className="bg-[#090d16] text-[#00e599] font-semibold">
                  {group.options.map((t) => (
                    <option key={t.value} value={t.value} className="bg-[#111827] text-white font-normal">
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">
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
              className="w-full px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
            />
          ) : (
            <div className="w-full px-3.5 py-2 bg-[#172233]/60 border border-slate-800 rounded-xl text-slate-400 text-sm font-mono flex items-center justify-between select-none">
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
              <span className="text-[10px] text-slate-500 font-bold uppercase">Spot</span>
            </div>
          )}
        </div>
      </div>

      {/* Row: Duration & Stake matching screenshot */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Duration</label>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              max="10"
              value={config.duration}
              onChange={(e) => onUpdateConfig({ duration: parseInt(e.target.value, 10) || 1 })}
              className="flex-1 px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
            />
            <div className="relative w-16">
              <select
                value={config.durationUnit}
                onChange={(e) => onUpdateConfig({ durationUnit: e.target.value as 't' | 's' })}
                className="w-full appearance-none px-2.5 py-2 bg-[#172233] border border-slate-700/80 rounded-xl text-white text-sm font-mono text-center font-medium focus:outline-none focus:ring-1 focus:ring-[#00e599] cursor-pointer"
              >
                <option value="t">t</option>
                <option value="s">s</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Stake</label>
          <input
            type="number"
            min="0.35"
            step="0.5"
            value={config.stake}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0.5;
              onUpdateConfig({ stake: val, initialStake: val });
            }}
            className="w-full px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
          />
        </div>
      </div>

      {/* Row: Martingale × & Max steps matching screenshot */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Martingale ×</label>
          <input
            type="number"
            min="1"
            step="0.1"
            value={config.martingale}
            onChange={(e) => onUpdateConfig({ martingale: parseFloat(e.target.value) || 1 })}
            className="w-full px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Max steps</label>
          <input
            type="number"
            min="1"
            max="15"
            value={config.maxSteps}
            onChange={(e) => onUpdateConfig({ maxSteps: parseInt(e.target.value, 10) || 1 })}
            className="w-full px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
          />
        </div>
      </div>

      {/* Row: Take profit & Stop loss matching screenshot */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Take profit</label>
          <input
            type="number"
            min="1"
            step="5"
            value={config.takeProfit}
            onChange={(e) => onUpdateConfig({ takeProfit: parseFloat(e.target.value) || 10 })}
            className="w-full px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Stop loss</label>
          <input
            type="number"
            min="1"
            step="5"
            value={config.stopLoss}
            onChange={(e) => onUpdateConfig({ stopLoss: parseFloat(e.target.value) || 20 })}
            className="w-full px-3.5 py-2 bg-[#172233] hover:bg-[#1a273b] focus:bg-[#1a273b] border border-slate-700/80 rounded-xl text-white text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 transition-all"
          />
        </div>
      </div>

      {/* Primary Action Buttons: Save Strategy & Reset after trade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          onClick={handleSaveStrategy}
          className="w-full py-3 rounded-xl bg-[#172233] hover:bg-[#1e2c42] border border-slate-700/80 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          {savedFeedback ? (
            <>
              <BookmarkCheck className="w-4 h-4 text-[#00e599]" />
              <span className="text-[#00e599]">Strategy Saved!</span>
            </>
          ) : (
            <span>Save strategy</span>
          )}
        </button>

        <button
          onClick={handleResetAfterTradeClick}
          className="w-full py-3 rounded-xl bg-[#172233] hover:bg-[#1e2c42] border border-slate-700/80 text-slate-200 hover:text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm group"
          title="Reset stake and loss steps back to base stake"
        >
          <RotateCcw className={`w-4 h-4 text-[#00e599] transition-transform ${resetTradeFeedback ? 'animate-spin' : 'group-hover:-rotate-90'}`} />
          <span>{resetTradeFeedback ? 'Stake & Steps Reset!' : 'Reset after trade'}</span>
        </button>
      </div>

      {/* Real-time bot metrics & live executions */}
      <div className="bg-[#090d16] border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2.5 mt-1">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-[#00e599] animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span>Status: {isRunning ? 'Active & Scanning Ticks' : 'Idle'}</span>
          </div>
          <span className="font-mono text-slate-400">
            Balance: ${balance.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg bg-[#111827]">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Net P/L</div>
            <div
              className={`font-mono font-bold ${
                metrics.totalProfit > 0
                  ? 'text-emerald-400'
                  : metrics.totalProfit < 0
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {metrics.totalProfit > 0 ? '+' : ''}${metrics.totalProfit.toFixed(2)}
            </div>
          </div>

          <div className="p-2 rounded-lg bg-[#111827]">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Win Rate</div>
            <div className="font-mono font-bold text-[#00e599]">
              {metrics.winRate}%
            </div>
          </div>

          <div className="p-2 rounded-lg bg-[#111827]">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">W / L</div>
            <div className="font-mono font-semibold text-slate-200">
              <span className="text-emerald-400">{metrics.wins}</span>
              <span className="text-slate-500">/</span>
              <span className="text-rose-400">{metrics.losses}</span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-[#111827]">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Trades</div>
            <div className="font-mono font-bold text-white">
              {metrics.totalTrades}
            </div>
          </div>
        </div>

        {/* Recent Executions */}
        {trades.length > 0 && (
          <div className="border-t border-slate-800/80 pt-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-slate-400">
              <span>Recent Trade Executions</span>
              <button
                onClick={handleResetAfterTradeClick}
                className="text-[#00e599] hover:underline flex items-center gap-1 font-mono normal-case"
                title="Reset stake and step counter"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset after trade</span>
              </button>
            </div>
            {trades.slice(0, 3).map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#111827] text-xs font-mono border border-slate-800/60"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      trade.status === 'won' ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  <span className="font-bold text-white">{trade.prediction}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">
                    Digit: <strong className="text-white">{trade.exitDigit}</strong>
                  </span>
                  <span
                    className={`font-bold ${
                      trade.status === 'won' ? 'text-emerald-400' : 'text-rose-400'
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
