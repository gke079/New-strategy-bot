import React, { useEffect, useState, useRef } from 'react';
import {
   BotMetrics,
  Market,
  NormalBotConfig,
  SignalEntryTrigger,
  TradeContractType,
} from '../types';
import {
  BarrierFilter,
  MarketSignalSnapshot,
  MultiMarketSignalScanner,
  SIGNAL_MARKETS,
  SignalCategory,
  formatWindowDuration,
  formatTradingViewCountdown,
} from '../services/signalScannerEngine';
import { ChartsView } from './ChartsView';
import { Square, RotateCcw, ArrowUpRight, TrendingUp, Clock, Play, CheckCircle2, Bot, Activity, Zap } from 'lucide-react';
import { NumericInput } from './NumericInput';


export interface SignalExecutionRequest {
  category: SignalCategory;
  market: Market;
  contractType: TradeContractType;
  prediction: number;
  signalEntryTrigger: SignalEntryTrigger;
  entryTargetDigit?: number;
  evenOddStrategyId?: 'S1' | 'S2' | 'S3';
  entryConfirmedNow: boolean;
  stake: number;
  ticks: number;
  martingale: number;
  takeProfit: number;
  stopLoss: number;
  signalLabel: string;
  signalTone: 'emerald' | 'fuchsia' | 'sky' | 'amber';
  entryConfidencePct: number;
  payoutMultiplier: number;
  distributionSubtext: string;
  patternSummary: string;
}

export interface ActiveSignalSession {
  category: SignalCategory;
  marketId: string;
  marketName: string;
  contractType: TradeContractType;
  prediction: number;
  entryTargetDigit?: number;
  evenOddStrategyId?: 'S1' | 'S2' | 'S3';
  ticks?: number;
  signalLabel: string;
  signalTone: 'emerald' | 'fuchsia' | 'sky' | 'amber';
  entryConfidencePct: number;
  payoutMultiplier: number;
  distributionSubtext: string;
  patternSummary: string;
}

interface SignalsViewProps {
  normalBotConfig: NormalBotConfig;
  onUpdateNormalBotConfig: (patch: Partial<NormalBotConfig>) => void;
  onRunSignalOnNormalBot: (req: SignalExecutionRequest) => void;
  onStopNormalBot: () => void;
  onResetNormalBot: () => void;
  onOpenNormalBotTab: () => void;
  normalBotRunning: boolean;
  normalBotWaitingForEntry?: boolean;
  normalBotEntryStatus?: string;
  normalBotStake: number;
  normalBotMetrics: BotMetrics;
  activeSignal: ActiveSignalSession | null;
  theme?: 'dark' | 'light';
}

const ScanningRing: React.FC<{ secondsLeft: number; totalSeconds?: number; size?: number }> = ({
  secondsLeft,
  totalSeconds = 17,
  size = 38,
}) => {
  const total = Math.max(1, totalSeconds);
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0.04, Math.min(1, secondsLeft / total));
  const strokeDashoffset = circumference * (1 - progress);

  const formattedTime =
    secondsLeft >= 60
      ? `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`
      : `${secondsLeft}s`;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center shrink-0"
    >
      <svg style={{ width: size, height: size }} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          opacity="1"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#0284c7"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <span
        className={`absolute font-mono tabular-nums font-bold text-slate-900 ${
          secondsLeft >= 60 ? 'text-[9px] leading-none' : 'text-[11px] leading-none'
        }`}
      >
        {formattedTime}
      </span>
    </div>
  );
};

const MacdMiniHistogram: React.FC<{
  histograms?: (number | null)[];
}> = ({ histograms = [] }) => {
  const valid = histograms.filter((v): v is number => typeof v === 'number');
  const maxAbs = Math.max(0.00001, ...valid.map((v) => Math.abs(v)));

  return (
    <div className="flex items-center gap-1.5 h-6 px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
      <span className="text-[9px] font-mono font-bold text-slate-500 uppercase shrink-0">
        Hist:
      </span>
      <div className="flex items-center justify-between gap-1 flex-1 h-full pt-0.5">
        {histograms.slice(-8).map((h, i, arr) => {
          if (h === null || h === undefined) {
            return (
              <div
                key={i}
                className="flex-1 h-0.5 bg-slate-300 rounded self-center"
              />
            );
          }
          const prev = i > 0 && arr[i - 1] !== null ? (arr[i - 1] as number) : h;
          const isPos = h >= 0;
          const heightPct = Math.min(
            100,
            Math.max(25, Math.round((Math.abs(h) / maxAbs) * 100))
          );

          let barBg = 'bg-slate-400';
          let title = '';
          if (!isPos) {
            if (h <= prev) {
              barBg = 'bg-red-600'; // Long dark red (No Trade)
              title = `Long Dark Red [No Trade] (${h.toFixed(4)})`;
            } else {
              barBg = 'bg-rose-400'; // Faded red (Good Market)
              title = `Faded Red [Good Market] (${h.toFixed(4)})`;
            }
          } else {
            if (h < prev) {
              barBg = 'bg-amber-400'; // Faded green (No Trade)
              title = `Faded Green [No Trade] (${h.toFixed(4)})`;
            } else {
              barBg = 'bg-emerald-600'; // Short/Long dark green
              title = `Dark Green [Good Market] (${h.toFixed(4)})`;
            }
          }

          return (
            <div
              key={i}
              className="flex-1 h-full flex flex-col justify-center items-center"
              title={title}
            >
              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full max-w-[6px] rounded-xs transition-all ${barBg}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};


export const SignalsView: React.FC<SignalsViewProps> = ({
  normalBotConfig,
  onUpdateNormalBotConfig,
  onRunSignalOnNormalBot,
  onStopNormalBot,
  onResetNormalBot,
  onOpenNormalBotTab,
  normalBotRunning,
  normalBotWaitingForEntry = false,
  normalBotEntryStatus = '',
  normalBotStake,
  normalBotMetrics,
  activeSignal,
  theme = 'dark',
}) => {
  const [category, setCategory] = useState<SignalCategory>('even_odd');
  const [evenOddStrategyFilter, setEvenOddStrategyFilter] = useState<'all' | 'S1' | 'S2' | 'S3'>('all');
  const [overUnderBarrier, setOverUnderBarrier] = useState<BarrierFilter>('all');
  const [chartMarket, setChartMarket] = useState<Market>(SIGNAL_MARKETS[0]);
  const [entryTimingModes, setEntryTimingModes] = useState<Record<string, 'user_click' | 'auto_momentum'>>({});

  const getEntryTimingMode = (marketId: string): 'user_click' | 'auto_momentum' => {
    return entryTimingModes[marketId] ?? 'user_click';
  };

  const setEntryTimingMode = (marketId: string, mode: 'user_click' | 'auto_momentum') => {
    setEntryTimingModes((prev) => ({ ...prev, [marketId]: mode }));
  };

  useEffect(() => {
    if (activeSignal?.marketId) {
      const found = SIGNAL_MARKETS.find((m) => m.id === activeSignal.marketId);
      if (found) setChartMarket(found);
    }
  }, [activeSignal?.marketId]);

  const stake = normalBotConfig.initialStake || 0.35;
  const rawConfiguredTicks =
    !normalBotConfig.durationUnit || normalBotConfig.durationUnit === 't'
      ? Math.round(normalBotConfig.duration || 1)
      : 1;
  const minTicksForTab =
    category === 'only_up_down' || category === 'only_up' ? 2 : category === 'high_low_tick' ? 5 : 1;
  const maxTicksForTab =
    category === 'only_up_down' || category === 'only_up' || category === 'high_low_tick' ? 5 : 10;
  const effectiveDefaultTicks =
    category === 'only_up'
      ? (rawConfiguredTicks >= minTicksForTab && rawConfiguredTicks <= maxTicksForTab ? rawConfiguredTicks : 2)
      : category === 'only_up_down' || category === 'high_low_tick'
      ? (rawConfiguredTicks >= minTicksForTab && rawConfiguredTicks <= maxTicksForTab ? rawConfiguredTicks : 5)
      : (rawConfiguredTicks >= minTicksForTab && rawConfiguredTicks <= maxTicksForTab ? rawConfiguredTicks : 1);
  const ticks = Math.min(maxTicksForTab, Math.max(minTicksForTab, effectiveDefaultTicks));
  const martingale = normalBotConfig.martingale || 1.5;
  const takeProfit = normalBotConfig.takeProfit;
  const stopLoss = normalBotConfig.stopLoss;

  const handleSelectCategory = (newCat: SignalCategory) => {
    setCategory(newCat);
    // User requirement: default ticks be 2 for only_up, 5 for only_up_down and high_low_tick, and 1 for even_odd and over_under
    if (newCat === 'only_up') {
      onUpdateNormalBotConfig({ duration: 2, durationUnit: 't' });
    } else if (newCat === 'only_up_down' || newCat === 'high_low_tick') {
      onUpdateNormalBotConfig({ duration: 5, durationUnit: 't' });
    } else {
      onUpdateNormalBotConfig({ duration: 1, durationUnit: 't' });
    }
  };

  const scannerRef = useRef<MultiMarketSignalScanner | null>(null);
  const [, setTickRevision] = useState<number>(0);

  useEffect(() => {
    const scanner = new MultiMarketSignalScanner();
    scannerRef.current = scanner;
    const unsub = scanner.subscribe(() => {
      setTickRevision((r) => r + 1);
    });
    return () => {
      unsub();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, []);

  const handleStakeChange = (newStake: number) => {
    const wasDoubleStake =
      Math.abs(takeProfit - stake * 2) < 0.02 ||
      takeProfit === 0.1 ||
      takeProfit === 0.7;
    const nextTp = wasDoubleStake ? Number((newStake * 2).toFixed(2)) : takeProfit;
    onUpdateNormalBotConfig({ stake: newStake, initialStake: newStake, takeProfit: nextTp });
  };

  const handleTicksChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const val = Math.min(maxTicksForTab, Math.max(minTicksForTab, parsed));
    onUpdateNormalBotConfig({ duration: val, durationUnit: 't' });
  };

  const handleMartingaleChange = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const val = Math.min(9999, Math.max(1, parsed));
    onUpdateNormalBotConfig({ martingale: val });
  };

  const handleTpChange = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const val = Math.min(9999, Math.max(0.1, Number(parsed.toFixed(2))));
    onUpdateNormalBotConfig({ takeProfit: val });
  };

  const handleSlChange = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const val = Math.min(9999, Math.max(0.5, parsed));
    onUpdateNormalBotConfig({ stopLoss: val });
  };

  const rawSnapshots: MarketSignalSnapshot[] = scannerRef.current
    ? scannerRef.current.getSnapshots(category, overUnderBarrier, ticks, evenOddStrategyFilter)
    : [];

  // Hard category invariant: each signal tab strictly holds ONLY its own contract family
  const snapshots: MarketSignalSnapshot[] = rawSnapshots.filter((snap) => {
    if (snap.category !== category) return false;
    if (category === 'only_up') {
      return snap.contractType === 'ONLY_UP';
    }
    if (category === 'even_odd') {
      return snap.contractType === 'EVEN' || snap.contractType === 'ODD';
    }
    if (category === 'over_under') {
      return snap.contractType === 'OVER' || snap.contractType === 'UNDER';
    }
    if (category === 'only_up_down') {
      return snap.contractType === 'ONLY_UP' || snap.contractType === 'ONLY_DOWN';
    }
    if (category === 'high_low_tick') {
      return snap.contractType === 'HIGH_TICK' || snap.contractType === 'LOW_TICK';
    }
    return snap.contractType === 'MATCHES';
  });

  const isActiveSignalForCurrentTab =
    normalBotRunning && activeSignal !== null && activeSignal.category === category;

  const isFeedLive = scannerRef.current?.getIsConnected() ?? false;
  const isLight = theme === 'light';

  const modeBannerLabel =
    category === 'even_odd'
      ? 'EVEN / ODD'
      : category === 'over_under'
      ? 'OVER / UNDER'
      : category === 'only_up'
      ? 'ONLY UP'
      : category === 'only_up_down'
      ? 'ONLY UP / DOWN'
      : category === 'high_low_tick'
      ? 'HIGH / LOW TICK'
      : 'DIGIT MATCH';

  const subtitleText =
    category === 'only_up'
      ? 'Candlestick & MACD Strategy · Synchronized with Deriv Advanced TradingView 1m candle clock. Good market: Faded Red or Short Dark Green histogram activates the Run button. Entry triggers at final 10 seconds of candle finish.'
      : category === 'even_odd'
      ? '3-Tier Quantitative Even/Odd Strategy: S1 (Green & Red same market, Blue opposite, Green <12%, Blue digit entry) · S2 (All 3 movers same market, dominancy ≥10%, 2 opposite digits entry) · S3 (Green & Blue same, Red opposite, dominancy ≥10%, Red digit then opposite digit entry).'
      : category === 'over_under'
      ? 'Over 4, 5, 6, 7 (53/45/35/30%) & Under 5, 4, 3, 2 (53/45/35/30%) only. Entry waits for ≥3 consecutive opposite digits + 1 winning confirmation digit, then trades continuously.'
      : category === 'only_up_down'
      ? 'All windows operate using 5m timeframe with asynchronous staggered scanning (25s offsets). Strict guards: No trade in first 1 min (0s–60s) for signal confirmation, and no trade in last 20s to protect against candle trend shifts.'
      : category === 'high_low_tick'
      ? 'All windows operate using 5m timeframe with asynchronous staggered scanning (25s offsets). Strict guards: No trade in first 1 min (0s–60s) for signal confirmation, and no trade in last 20s to protect against candle trend shifts.'
      : 'Finds the digit with more occurrence in the last 10 ticks and trades Digit Match continuously on the Normal Bot.';

  const chartAnalysis5m =
    category === 'high_low_tick' && scannerRef.current
      ? scannerRef.current.getMarket5mSummary(chartMarket.id)
      : null;

  const compactInputClass = `w-16 px-1.5 py-1.5 rounded-lg border text-center font-mono tabular-nums text-xs sm:text-sm font-bold focus:outline-none focus:border-[#2563eb] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900'
      : 'bg-[#080d16] border-slate-700 text-white'
  }`;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 1. HEADER & LIVE FEED STATUS */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Signals
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isFeedLive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}
            >
              {isFeedLive ? 'Live feed' : 'Syncing feed'}
            </span>
          </div>

          {(normalBotMetrics.totalTrades > 0 || normalBotMetrics.lastStopReason) && (
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums flex-wrap">
              <span className="text-slate-400">
                Session P/L:{' '}
                <strong
                  className={
                    (normalBotMetrics.sessionProfit ?? normalBotMetrics.totalProfit) >= 0
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  }
                >
                  {(normalBotMetrics.sessionProfit ?? normalBotMetrics.totalProfit) >= 0 ? '+' : '-'}$
                  {Math.abs(normalBotMetrics.sessionProfit ?? normalBotMetrics.totalProfit).toFixed(2)}
                </strong>{' '}
                ({normalBotMetrics.wins}W/{normalBotMetrics.losses}L)
              </span>
              <button
                type="button"
                onClick={onResetNormalBot}
                className="w-fit px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-sans font-semibold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
          {subtitleText}
        </p>
      </div>

      {/* 2. COMPACT PARAMETER STRIP (Stake · Ticks · Martingale · Take profit · Stop loss) */}
      <div
        className="w-fit max-w-full rounded-2xl border border-slate-200 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-colors bg-white shadow-sm text-slate-900"
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
          {/* Stake */}
          <div className="flex flex-col items-start gap-1">
            <label className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
              Stake ($)
            </label>
            <NumericInput
              min={0.35}
              max={9999}
              step={0.05}
              fallbackValue={0.35}
              value={stake}
              onChange={handleStakeChange}
              className={compactInputClass}
            />
          </div>

          {/* Number of Ticks */}
          <div className="flex flex-col items-start gap-1">
            <label className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
              Ticks
            </label>
            <NumericInput
              min={minTicksForTab}
              max={maxTicksForTab}
              step={1}
              fallbackValue={effectiveDefaultTicks}
              value={ticks}
              onChange={(val) => onUpdateNormalBotConfig({ duration: Math.round(val), durationUnit: 't' })}
              title={`Number of ticks (${minTicksForTab}–${maxTicksForTab})`}
              className={compactInputClass}
            />
          </div>

          {/* Martingale */}
          <div className="flex flex-col items-start gap-1">
            <label className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
              Martingale
            </label>
            <NumericInput
              min={1}
              max={9999}
              step={0.1}
              fallbackValue={1.5}
              value={martingale}
              onChange={(val) => onUpdateNormalBotConfig({ martingale: val })}
              className={compactInputClass}
            />
          </div>

          {/* Take Profit */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center justify-between w-full gap-1">
              <label className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                Take profit
              </label>
              <button
                type="button"
                onClick={() => onUpdateNormalBotConfig({ takeProfit: Number((stake * 2).toFixed(2)) })}
                className="text-[9px] font-extrabold text-sky-600 hover:text-sky-700 cursor-pointer underline decoration-sky-500/50 whitespace-nowrap"
                title="Set to 2x Stake (Default risk-management ratio)"
              >
                2x (${(stake * 2).toFixed(2)})
              </button>
            </div>
            <NumericInput
              min={0.1}
              max={9999}
              step={0.1}
              fallbackValue={Number((stake * 2).toFixed(2))}
              value={takeProfit}
              onChange={(val) => onUpdateNormalBotConfig({ takeProfit: val })}
              className={compactInputClass}
            />
          </div>

          {/* Stop Loss */}
          <div className="flex flex-col items-start gap-1">
            <label className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
              Stop loss
            </label>
            <NumericInput
              min={0.5}
              max={9999}
              step={1}
              fallbackValue={20}
              value={stopLoss}
              onChange={(val) => onUpdateNormalBotConfig({ stopLoss: val })}
              className={compactInputClass}
            />
          </div>
        </div>

        <div className="sm:pl-3 sm:border-l sm:border-slate-200 text-[11px] text-slate-500 leading-snug">
          <div>
            Duration <strong className="font-mono tabular-nums text-slate-900">{ticks}t</strong> · Win resets stake to{' '}
            <strong className="font-mono tabular-nums text-slate-900">{stake}</strong>
          </div>
          <div>
            Loss multiplies by <strong className="font-mono tabular-nums text-slate-900">{martingale}x</strong>
          </div>
        </div>
      </div>

      {/* 2B. 5M TIMEFRAME ANALYSIS & STAGGERED SCANNING SUMMARY STRIP */}
      {(category === 'only_up_down' || category === 'high_low_tick') && (
        <div
          className={`w-full rounded-2xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs ${
            isLight
              ? 'bg-cyan-50/80 border-cyan-200 text-cyan-950'
              : 'bg-[#0b1626] border-cyan-900/40 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold flex items-center gap-1.5 text-cyan-400">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>5m Windows · Continuous Execution After Entry:</span>
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              Once entry is confirmed, bot trades continuously back-to-back until Take Profit (${takeProfit.toFixed(2)}) or Stop Loss (${stopLoss.toFixed(2)})
            </span>
          </div>
          <button
            type="button"
            onClick={() => scannerRef.current?.resetMarketWindows(category)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
            title="Reset all volatility index windows to standard 5m timeframe with staggered offsets"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults (5m)</span>
          </button>
        </div>
      )}

      {/* TAKE PROFIT / STOP LOSS COMPLETION NOTICE */}
      {!normalBotRunning &&
        normalBotMetrics.lastStopReason &&
        (normalBotMetrics.lastStopReason.toLowerCase().includes('take profit') ||
          normalBotMetrics.lastStopReason.toLowerCase().includes('stop loss')) && (
          <div
            className={`rounded-2xl border px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold ${
              normalBotMetrics.lastStopReason.toLowerCase().includes('take profit')
                ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                : 'border-rose-400 bg-rose-50 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  normalBotMetrics.lastStopReason.toLowerCase().includes('take profit')
                    ? 'bg-emerald-600'
                    : 'bg-rose-600'
                }`}
              />
              <span>{normalBotMetrics.lastStopReason}</span>
            </div>
            <span className="font-mono font-bold tabular-nums">
              Session P/L:{' '}
              {(normalBotMetrics.sessionProfit ?? normalBotMetrics.totalProfit) >= 0 ? '+' : '-'}$
              {Math.abs(normalBotMetrics.sessionProfit ?? normalBotMetrics.totalProfit).toFixed(2)} (
              {normalBotMetrics.wins}W/{normalBotMetrics.losses}L)
            </span>
          </div>
        )}

      {/* ACTIVE SIGNAL RUNNING / WAITING FOR ENTRY BANNER (Scoped strictly to current signal tab) */}
      {isActiveSignalForCurrentTab && activeSignal && (
        <div
          className={`rounded-2xl border px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 ${
            normalBotWaitingForEntry
              ? 'border-amber-300 bg-amber-50'
              : 'border-blue-300 bg-sky-50'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-slate-900">
            <span className="font-extrabold">
              {normalBotWaitingForEntry ? 'Normal Bot Waiting for Entry:' : 'Normal Bot Trading Continuously:'}{' '}
              {activeSignal.signalLabel} ({activeSignal.ticks ?? ticks}t) on {activeSignal.marketId}
            </span>
            <span className="font-mono tabular-nums text-slate-700">
              {normalBotWaitingForEntry && normalBotEntryStatus
                ? normalBotEntryStatus
                : `Stake: $${normalBotStake.toFixed(2)} · Session P/L: ${
                    (normalBotMetrics.sessionProfit ?? normalBotMetrics.totalProfit) >= 0 ? '+' : '-'
                  }$${Math.abs(normalBotMetrics.sessionProfit ?? normalBotMetrics.totalProfit).toFixed(2)} · TP $${takeProfit.toFixed(2)} / SL $${stopLoss.toFixed(2)} (${normalBotMetrics.wins}W/${
                    normalBotMetrics.losses
                  }L)`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenNormalBotTab}
              className="px-3 py-1.5 rounded-full bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
            >
              <span>Normal Bot</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onStopNormalBot}
              className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-rose-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. SIGNAL CATEGORY TABS (Even / Odd | Over / Under | Digit Match | Only Up / Only Down) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleSelectCategory('even_odd')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              category === 'even_odd'
                ? 'bg-[#2563eb] text-sky-50 border-[#2563eb] shadow-xs'
                : isLight
                ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                : 'bg-[#111827] text-slate-200 border-slate-700 hover:border-slate-500'
            }`}
          >
            Even / Odd
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory('over_under')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              category === 'over_under'
                ? 'bg-[#2563eb] text-sky-50 border-[#2563eb] shadow-xs'
                : isLight
                ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                : 'bg-[#111827] text-slate-200 border-slate-700 hover:border-slate-500'
            }`}
          >
            Over / Under
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory('digit_match')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              category === 'digit_match'
                ? 'bg-[#2563eb] text-sky-50 border-[#2563eb] shadow-xs'
                : isLight
                ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                : 'bg-[#111827] text-slate-200 border-slate-700 hover:border-slate-500'
            }`}
          >
            Digit Match
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory('only_up_down')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              category === 'only_up_down'
                ? 'bg-[#2563eb] text-sky-50 border-[#2563eb] shadow-xs'
                : isLight
                ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                : 'bg-[#111827] text-slate-200 border-slate-700 hover:border-slate-500'
            }`}
          >
            Only Up / Only Down
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory('high_low_tick')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              category === 'high_low_tick'
                ? 'bg-[#2563eb] text-sky-50 border-[#2563eb] shadow-xs'
                : isLight
                ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                : 'bg-[#111827] text-slate-200 border-slate-700 hover:border-slate-500'
            }`}
          >
            High Tick / Low Tick
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory('only_up')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border flex items-center gap-1.5 ${
              category === 'only_up'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-400/30'
                : isLight
                ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                : 'bg-[#111827] text-slate-200 border-slate-700 hover:border-slate-500'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>ONLY UP</span>
          </button>
        </div>

        {category === 'over_under' && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 mr-0.5">Barrier:</span>
            <button
              type="button"
              onClick={() => setOverUnderBarrier('all')}
              className={`px-2.5 h-7 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                overUnderBarrier === 'all'
                  ? 'bg-[#2563eb] text-sky-50 border-[#2563eb]'
                  : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
              }`}
            >
              All (2–7)
            </button>
            {([2, 3, 4, 5, 6, 7] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setOverUnderBarrier(b)}
                className={`w-7 h-7 rounded-lg font-mono tabular-nums text-xs font-bold border cursor-pointer transition-colors ${
                  overUnderBarrier === b
                    ? 'bg-[#2563eb] text-sky-50 border-[#2563eb]'
                    : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        {category === 'even_odd' && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200">
            <span className="text-xs font-bold text-slate-700">Strategy Filter:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 gap-0.5">
              {(
                [
                  { id: 'all', label: 'All (S1, S2, S3)' },
                  { id: 'S1', label: 'S1 · Divergence' },
                  { id: 'S2', label: 'S2 · Dominancy' },
                  { id: 'S3', label: 'S3 · Split Movers' },
                ] as const
              ).map((strat) => (
                <button
                  key={strat.id}
                  type="button"
                  onClick={() => setEvenOddStrategyFilter(strat.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    evenOddStrategyFilter === strat.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {strat.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-mono text-slate-500 ml-auto hidden sm:inline">
              🟢 Most (G) · 🔵 2nd (B) · 🔴 Least (R)
            </span>
          </div>
        )}
      </div>

      {/* 3B. DERIV ADVANCED TRADINGVIEW CHART (1M FOR ONLY UP / 5M FOR HIGH LOW TICK) */}
      {(category === 'high_low_tick' || category === 'only_up') && (
        <ChartsView
          market={chartMarket}
          defaultTimePeriod={category === 'only_up' ? '1m' : '5m'}
          markets={SIGNAL_MARKETS}
          onSelectMarket={setChartMarket}
          analysis5m={category === 'high_low_tick' ? chartAnalysis5m : null}
        />
      )}

      {/* 4. HIGH-DENSITY COMPACT MULTI-MARKET BOT CARDS GRID (MOBILE-OPTIMIZED) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
        {snapshots.map((snap) => {
          const isThisCardRunning =
            isActiveSignalForCurrentTab && activeSignal?.marketId === snap.market.id;

          const showScanningState = snap.isScanning && !isThisCardRunning;

          // If this card is actively running on this tab while the scanner rolls into a 15s scan refresh,
          // preserve the locked activeSignal for THIS category so it never flickers or mixes fields.
          const displaySignalLabel =
            isThisCardRunning && snap.isScanning && activeSignal
              ? activeSignal.signalLabel
              : snap.signalLabel;
          const displaySignalTone =
            isThisCardRunning && snap.isScanning && activeSignal
              ? activeSignal.signalTone
              : snap.signalTone;
          const displayContractType =
            isThisCardRunning && snap.isScanning && activeSignal
              ? activeSignal.contractType
              : snap.contractType;
          const displayPrediction =
            isThisCardRunning && snap.isScanning && activeSignal
              ? activeSignal.prediction
              : snap.prediction;
          const displayConfidencePct =
            isThisCardRunning && snap.isScanning && activeSignal
              ? activeSignal.entryConfidencePct
              : snap.entryConfidencePct;
          const displayPayoutMultiplier =
            isThisCardRunning && snap.isScanning && activeSignal
              ? activeSignal.payoutMultiplier
              : snap.payoutMultiplier;
          const displayDistributionSubtext =
            isThisCardRunning && snap.isScanning && activeSignal
              ? activeSignal.distributionSubtext
              : snap.distributionSubtext;
          const displayPatternSummary =
            isThisCardRunning && normalBotWaitingForEntry && normalBotEntryStatus
              ? normalBotEntryStatus
              : isThisCardRunning && snap.isScanning && activeSignal
              ? activeSignal.patternSummary
              : snap.patternSummary;

          return (
            <div
              key={`${category}-${snap.market.id}`}
              className={`relative rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between gap-2.5 transition-all overflow-hidden bg-white shadow-xs hover:shadow-md ${
                isThisCardRunning
                  ? 'ring-2 ring-emerald-500 border-emerald-500'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              {/* Compact Card Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                      isThisCardRunning
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                        {snap.market.name.replace(' Index', '')}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 font-semibold">
                        {snap.market.id}
                      </span>
                    </div>
                    {/* Timeframe & Trend row */}
                    <div className="flex items-center gap-1 text-[10px] font-mono mt-0.5 text-slate-500">
                      {category === 'only_up_down' || category === 'high_low_tick' ? (
                        <>
                          <span className="text-slate-700 font-semibold">{snap.scanWindowLabel}</span>
                          {snap.marketTrend && (
                            <>
                              <span>·</span>
                              <span
                                className={
                                  snap.marketTrend === 'uptrend'
                                    ? 'text-emerald-600 font-semibold'
                                    : snap.marketTrend === 'downtrend'
                                    ? 'text-rose-600 font-semibold'
                                    : 'text-slate-500'
                                }
                              >
                                {snap.marketTrend === 'uptrend'
                                  ? 'Uptrend ▲'
                                  : snap.marketTrend === 'downtrend'
                                  ? 'Downtrend ▼'
                                  : 'Ranging'}
                              </span>
                            </>
                          )}
                        </>
                      ) : category === 'only_up' ? (
                        <span className="text-slate-700 font-semibold">1m MACD</span>
                      ) : (
                        <span className="text-slate-500">Synthetic</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Header: Quote, Digit Badge & Live Stream Dot */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {category === 'high_low_tick' && (
                    <button
                      type="button"
                      onClick={() => setChartMarket(snap.market)}
                      title={`Inspect ${snap.market.name} on Advanced TradingView`}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                        chartMarket.id === snap.market.id
                          ? 'bg-sky-50 text-sky-700 border-sky-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <TrendingUp className="w-2.5 h-2.5" />
                      <span>Chart</span>
                    </button>
                  )}

                  {/* Last Price & Digit Badge */}
                  <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-[11px] font-mono tabular-nums">
                    <span className="text-slate-700 hidden sm:inline">{snap.lastQuote}</span>
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        snap.lastDigit % 2 === 0
                          ? 'bg-slate-200 text-slate-800 border border-slate-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                      title={`Last digit: ${snap.lastDigit}`}
                    >
                      {snap.lastDigit}
                    </span>
                  </div>

                  {/* Live Stream indicator */}
                  <span
                    title={snap.isLiveWs ? `Live Deriv feed (${snap.lastQuote})` : `Active stream`}
                    className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
                  />
                </div>
              </div>

              {/* Card Body */}
              {showScanningState ? (
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <ScanningRing
                      secondsLeft={snap.scanSecondsLeft}
                      totalSeconds={snap.scanTotalSeconds}
                      size={36}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold tracking-wide text-slate-900 uppercase truncate">
                        {snap.isClosingGuard
                          ? 'NO TRADE · CLOSING 20S GUARD'
                          : category === 'only_up'
                          ? snap.macdHistogramState === 'faded_green'
                            ? 'NO TRADE · FADED GREEN'
                            : snap.macdHistogramState === 'long_dark_red'
                            ? 'NO TRADE · LONG DARK RED'
                            : 'ANALYSING 1M MACD'
                          : category === 'only_up_down'
                          ? `SCANNING ${snap.scanWindowLabel.toUpperCase()} MOMENTUM`
                          : category === 'high_low_tick'
                          ? `ANALYSING ${snap.scanWindowLabel.toUpperCase()} RSI`
                          : 'SCANNING PATTERNS'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums truncate">
                        {snap.scanStatusNote}
                      </span>
                    </div>
                  </div>

                  {category === 'even_odd' && snap.greenBarDigit !== undefined && (
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-50 p-1 rounded border border-slate-200 justify-between">
                      <span className="text-slate-500 text-[9px]">Movers:</span>
                      <span className="text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                        🟢 D{snap.greenBarDigit}: {snap.greenBarPct?.toFixed(1)}%
                      </span>
                      <span className="text-blue-700 bg-blue-50 px-1 rounded border border-blue-200">
                        🔵 D{snap.blueBarDigit}: {snap.blueBarPct?.toFixed(1)}%
                      </span>
                      <span className="text-rose-700 bg-rose-50 px-1 rounded border border-rose-200">
                        🔴 D{snap.redBarDigit}: {snap.redBarPct?.toFixed(1)}%
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-center cursor-not-allowed border truncate transition-colors ${
                      snap.macdHistogramState === 'faded_green'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : snap.macdHistogramState === 'long_dark_red'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {snap.isClosingGuard
                      ? `No trade · Closing 20s (${snap.scanSecondsLeft}s left)`
                      : category === 'only_up'
                      ? snap.macdHistogramState === 'faded_green'
                        ? `No trade · Faded Green (${snap.scanSecondsLeft}s left)`
                        : snap.macdHistogramState === 'long_dark_red'
                        ? `No trade · Long Dark Red (${snap.scanSecondsLeft}s left)`
                        : `Run (awaiting Faded Red or Short Dark Green MACD...)`
                      : category === 'only_up_down'
                      ? snap.marketTrend === 'ranging'
                        ? `Run (awaiting ${snap.scanWindowLabel} trend...)`
                        : `Run (trend confirmed · awaiting momentum...)`
                      : category === 'high_low_tick'
                      ? `Run (awaiting ${snap.scanWindowLabel} wicks...)`
                      : 'Run (scanning for market...)'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                  {/* Signal Badge & Confidence */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-extrabold tracking-wide uppercase shrink-0 shadow-2xs ${
                        displaySignalTone === 'emerald'
                          ? 'bg-[#10b981] text-emerald-50'
                          : displaySignalTone === 'fuchsia'
                          ? 'bg-[#c026d3] text-fuchsia-50'
                          : displaySignalTone === 'amber'
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-[#0284c7] text-sky-50'
                      }`}
                    >
                      {displaySignalLabel}
                    </span>

                    <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
                      <span className="font-extrabold text-slate-900">
                        {displayConfidencePct}%
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-800 font-extrabold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {displayPayoutMultiplier.toFixed(2)}x
                      </span>
                    </div>
                  </div>

                  {/* Telemetry / Summary */}
                  <div className="text-[11px] font-mono tabular-nums leading-tight truncate text-slate-500">
                    {displayPatternSummary || displayDistributionSubtext}
                  </div>

                  {/* Even/Odd Quantitative Strategy Panel */}
                  {category === 'even_odd' && (
                    <div className="p-2 rounded-lg bg-blue-50/50 border border-blue-100 flex flex-col gap-1.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-blue-600 text-white border border-blue-700">
                            {snap.evenOddStrategyId || 'Strategy'} Qualified
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            No Competing Opp % ✓
                          </span>
                        </div>
                        {snap.evenDigitsGe10Count !== undefined && snap.oddDigitsGe10Count !== undefined && (
                          <span className="text-[10px] font-mono font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            ≥10%: Even {snap.evenDigitsGe10Count}/5 · Odd {snap.oddDigitsGe10Count}/5
                          </span>
                        )}
                      </div>

                      {snap.greenBarDigit !== undefined && snap.blueBarDigit !== undefined && snap.redBarDigit !== undefined && (
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center">
                          <div className="p-1 rounded bg-emerald-50 border border-emerald-200 flex flex-col">
                            <span className="text-[9px] font-bold text-emerald-800">🟢 Most (G)</span>
                            <span className="font-black text-emerald-900">
                              D{snap.greenBarDigit} ({snap.greenBarPct?.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="p-1 rounded bg-blue-50 border border-blue-200 flex flex-col">
                            <span className="text-[9px] font-bold text-blue-800">🔵 2nd (B)</span>
                            <span className="font-black text-blue-900">
                              D{snap.blueBarDigit} ({snap.blueBarPct?.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="p-1 rounded bg-rose-50 border border-rose-200 flex flex-col">
                            <span className="text-[9px] font-bold text-rose-800">🔴 Least (R)</span>
                            <span className="font-black text-rose-900">
                              D{snap.redBarDigit} ({snap.redBarPct?.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      )}

                      {snap.evenOddEntryRuleText && (
                        <div className="text-[10px] font-medium text-blue-950 bg-white p-1.5 rounded border border-blue-200 flex items-center justify-between gap-1">
                          <span className="truncate">🎯 {snap.evenOddEntryRuleText}</span>
                          {snap.evenOddEntryDigit !== undefined && (
                            <span className="font-mono font-black text-blue-700 shrink-0 bg-blue-100 px-1 rounded">
                              Target: D{snap.evenOddEntryDigit}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5m Candle User Decision Bar (if high_low_tick or only_up_down) */}
                  {(category === 'high_low_tick' || category === 'only_up_down') && (
                    <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-1 text-[11px]">
                      <span className="text-slate-500 font-medium text-[10px]">Start:</span>
                      <div className="inline-flex rounded-md bg-white p-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setEntryTimingMode(snap.market.id, 'user_click')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            getEntryTimingMode(snap.market.id) === 'user_click'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          On My Click
                        </button>
                        <button
                          type="button"
                          onClick={() => setEntryTimingMode(snap.market.id, 'auto_momentum')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            getEntryTimingMode(snap.market.id) === 'auto_momentum'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          3-Tick Auto
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ONLY UP MACD Candlestick Strategy Panel */}
                  {category === 'only_up' && (
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1 ${
                              snap.macdHistogramState === 'short_dark_green'
                                ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                                : snap.macdHistogramState === 'faded_red'
                                ? 'bg-rose-100 border-rose-400 text-rose-800'
                                : snap.macdHistogramState === 'long_dark_red'
                                ? 'bg-red-100 border-red-400 text-red-800'
                                : snap.macdHistogramState === 'faded_green'
                                ? 'bg-amber-100 border-amber-400 text-amber-800'
                                : 'bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                snap.isMacdGoodMarket
                                  ? 'bg-emerald-500 animate-ping'
                                  : snap.macdHistogramState === 'long_dark_red'
                                  ? 'bg-red-500'
                                  : snap.macdHistogramState === 'faded_green'
                                  ? 'bg-amber-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                            <span>{snap.macdStateLabel || 'MACD Histogram'}</span>
                          </span>
                          <span className={`text-[10px] font-mono font-bold ${snap.isMacdGoodMarket ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {snap.isMacdGoodMarket ? 'Good Market ✔' : 'No Trade ✕'}
                          </span>
                        </div>

                        <div
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border flex items-center gap-1 ${
                            snap.is10sEntryActive
                              ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse font-black'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          <span>
                            {snap.is10sEntryActive
                              ? `⚡ 10s Active (${formatTradingViewCountdown(snap.candleSecondsLeft ?? 10)})`
                              : `TV: ${formatTradingViewCountdown(snap.candleSecondsLeft ?? 60)} left`}
                          </span>
                        </div>
                      </div>

                      {/* Mini MACD Histogram Bars Visualizer */}
                      <MacdMiniHistogram histograms={snap.recentMacdHistograms} />
                    </div>
                  )}

                  {/* Action Button */}
                  {isThisCardRunning ? (
                    <button
                      type="button"
                      onClick={onStopNormalBot}
                      className={`w-full py-1.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors shadow-xs ${
                        normalBotWaitingForEntry
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-rose-600 hover:bg-rose-500 text-rose-50'
                      }`}
                    >
                      <span className="truncate">
                        {normalBotWaitingForEntry
                          ? normalBotEntryStatus || 'Waiting for 10s candle finish...'
                          : `Trading continuous ($${normalBotStake.toFixed(2)} · TP $${takeProfit})`}
                      </span>
                      <span className="underline shrink-0">Stop</span>
                    </button>
                  ) : category === 'only_up' ? (
                    snap.isMacdGoodMarket ? (
                      <button
                        type="button"
                        onClick={() => {
                          setChartMarket(snap.market);
                          onRunSignalOnNormalBot({
                            category,
                            market: snap.market,
                            contractType: 'ONLY_UP',
                            prediction: 0,
                            signalEntryTrigger: 'only_up_macd_candle_10s',
                            entryConfirmedNow: Boolean(snap.is10sEntryActive),
                            stake,
                            ticks,
                            martingale,
                            takeProfit,
                            stopLoss,
                            signalLabel: snap.signalLabel,
                            signalTone: 'emerald',
                            entryConfidencePct: snap.entryConfidencePct,
                            payoutMultiplier: snap.payoutMultiplier,
                            distributionSubtext: snap.distributionSubtext,
                            patternSummary: snap.patternSummary,
                          });
                        }}
                        className="w-full py-1.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between cursor-pointer transition-all shadow-sm active:scale-[0.99] bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
                      >
                        <span className="flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                          <span>RUN ONLY UP BOT</span>
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-blue-100 font-mono">
                          {snap.is10sEntryActive
                            ? `⚡ 10s Window Active (${formatTradingViewCountdown(snap.candleSecondsLeft ?? 10)}) · Fires Now`
                            : `Armed · Enters ≤10s Finish (${formatTradingViewCountdown(snap.candleSecondsLeft ?? 60)})`}
                        </span>
                      </button>
                    ) : snap.macdHistogramState === 'long_dark_red' ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-1.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between cursor-not-allowed border bg-rose-50 text-rose-700 border-rose-200"
                      >
                        <span className="flex items-center gap-1.5">
                          <Square className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          <span>NO TRADE · Long Dark Red</span>
                        </span>
                        <span className="text-[10px] font-mono text-rose-500">
                          Falling momentum · Ineligible
                        </span>
                      </button>
                    ) : snap.macdHistogramState === 'faded_green' ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-1.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between cursor-not-allowed border bg-amber-50 text-amber-700 border-amber-200"
                      >
                        <span className="flex items-center gap-1.5">
                          <Square className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          <span>NO TRADE · Faded Green</span>
                        </span>
                        <span className="text-[10px] font-mono text-amber-600">
                          Declining momentum · Ineligible
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full py-1.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between cursor-not-allowed border bg-blue-50 text-blue-700 border-blue-200"
                      >
                        <span>Awaiting Faded Red or Short Dark Green MACD</span>
                        <span className="text-[10px] font-mono text-blue-600">{formatTradingViewCountdown(snap.candleSecondsLeft ?? 60)} left</span>
                      </button>
                    )
                  ) : (() => {
                    const is5mStrategy = category === 'high_low_tick' || category === 'only_up_down';
                    const timingMode = getEntryTimingMode(snap.market.id);
                    const isUserImmediate = is5mStrategy ? timingMode === 'user_click' : snap.signalEntryTrigger === 'immediate';
                    const effectiveTrigger: SignalEntryTrigger = isUserImmediate ? 'immediate' : snap.signalEntryTrigger;

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setChartMarket(snap.market);
                          onRunSignalOnNormalBot({
                            category,
                            market: snap.market,
                            contractType: snap.contractType,
                            prediction: snap.prediction,
                            signalEntryTrigger: effectiveTrigger,
                            entryConfirmedNow: isUserImmediate || snap.entryConfirmedNow,
                            stake,
                            ticks,
                            martingale,
                            takeProfit,
                            stopLoss,
                            signalLabel: snap.signalLabel,
                            signalTone: snap.signalTone,
                            entryConfidencePct: snap.entryConfidencePct,
                            payoutMultiplier: snap.payoutMultiplier,
                            distributionSubtext: snap.distributionSubtext,
                            patternSummary: snap.patternSummary,
                            entryTargetDigit: snap.evenOddEntryDigit,
                            evenOddStrategyId: snap.evenOddStrategyId,
                          });
                        }}
                        className="w-full py-1.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between cursor-pointer transition-all shadow-sm active:scale-[0.99] bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
                      >
                        <span className="flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                          <span>
                            {isUserImmediate
                              ? 'Start Trade Now'
                              : category === 'even_odd' && snap.evenOddStrategyId
                              ? `RUN ${snap.contractType} (${snap.evenOddStrategyId})`
                              : 'Run this bot'}
                          </span>
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-blue-100 font-mono">
                          {isUserImmediate
                            ? 'Immediate Execution'
                            : snap.entryConfirmedNow
                            ? '⚡ Fires Now'
                            : category === 'even_odd' && snap.evenOddEntryRuleText
                            ? snap.evenOddEntryRuleText
                            : 'Waits for Confirmation'}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              )}

              {/* Compact Recent Ticks / Directions Strip */}
              <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-slate-100">
                {category === 'only_up_down' || category === 'high_low_tick' || category === 'only_up'
                  ? (snap.recentDirections ?? []).slice(-10).map((dir, idx) => {
                      const symbol = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '·';
                      const tileColorClass =
                        dir === 'up'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : dir === 'down'
                          ? 'bg-rose-50 border-rose-300 text-rose-700'
                          : 'bg-slate-100 border-slate-200 text-slate-500';
                      return (
                        <span
                          key={`${category}-${snap.market.id}-dir-${idx}`}
                          title={
                            dir === 'up'
                              ? 'Rise tick (▲)'
                              : dir === 'down'
                              ? 'Fall tick (▼)'
                              : 'Flat tick'
                          }
                          className={`w-5 h-5 rounded border font-mono tabular-nums text-[9px] font-bold flex items-center justify-center shrink-0 ${tileColorClass}`}
                        >
                          {symbol}
                        </span>
                      );
                    })
                  : snap.recentDigits.slice(-10).map((d, idx) => {
                      const isPositiveTile =
                        category === 'even_odd'
                          ? displayContractType === 'EVEN'
                            ? d % 2 === 0
                            : d % 2 !== 0
                          : category === 'over_under'
                          ? displayContractType === 'OVER'
                            ? d > displayPrediction
                            : d < displayPrediction
                          : d === (showScanningState ? snap.hotDigit : displayPrediction);

                      return (
                        <span
                          key={`${category}-${snap.market.id}-d-${idx}`}
                          className={`w-5 h-5 rounded border font-mono tabular-nums text-[9px] font-bold flex items-center justify-center shrink-0 ${
                            isPositiveTile
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {d}
                        </span>
                      );
                    })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
