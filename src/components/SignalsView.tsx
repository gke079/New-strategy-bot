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
} from '../services/signalScannerEngine';
import { ChartsView } from './ChartsView';
import { Square, RotateCcw, ArrowUpRight, TrendingUp } from 'lucide-react';

import robotVol10Img from '../assets/images/robot_vol_10_1793085808144.jpg';
import robotVol25Img from '../assets/images/robot_vol_25_1793085810352.jpg';
import robotVol50Img from '../assets/images/robot_vol_50_1793085811825.jpg';
import robotVol75Img from '../assets/images/robot_vol_75_1793085812944.jpg';
import robotVol100Img from '../assets/images/robot_vol_100_1793085815060.jpg';
import robotVol10_1sImg from '../assets/images/robot_vol_10_1s_1793085814444.jpg';
import robotVol25_1sImg from '../assets/images/robot_vol_25_1s_1793085816360.jpg';
import robotVol50_1sImg from '../assets/images/robot_vol_50_1s_1793085818156.jpg';
import robotVol75_1sImg from '../assets/images/robot_vol_75_1s_1793085819432.jpg';
import robotVol100_1sImg from '../assets/images/robot_vol_100_1s_1793085820025.jpg';
import robotStep100Img from '../assets/images/robot_step_100_1793085821652.jpg';
import robotJump50Img from '../assets/images/robot_jump_50_1793085821737.jpg';

export interface SignalExecutionRequest {
  category: SignalCategory;
  market: Market;
  contractType: TradeContractType;
  prediction: number;
  signalEntryTrigger: SignalEntryTrigger;
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

interface RobotBannerVisual {
  imageSrc: string;
  alt: string;
  fallbackGradientClass: string;
  eyeColor: string;
  togglePanelClass: string;
}

const MARKET_ROBOT_VISUALS: Record<string, RobotBannerVisual> = {
  R_10: {
    imageSrc: robotVol10Img,
    alt: 'Volatility 10 porcelain sentinel robot',
    fallbackGradientClass: 'bg-gradient-to-br from-slate-500 via-teal-800/40 to-stone-300',
    eyeColor: '#10b981',
    togglePanelClass: 'bg-emerald-400/25 border-emerald-100/60',
  },
  R_25: {
    imageSrc: robotVol25Img,
    alt: 'Volatility 25 titanium sapphire-optic android',
    fallbackGradientClass: 'bg-gradient-to-br from-slate-700 via-slate-500 to-slate-300',
    eyeColor: '#3b82f6',
    togglePanelClass: 'bg-sky-400/25 border-sky-100/60',
  },
  R_50: {
    imageSrc: robotVol50Img,
    alt: 'Volatility 50 bronze and obsidian clockwork automaton',
    fallbackGradientClass: 'bg-gradient-to-br from-stone-600 via-amber-900/40 to-stone-300',
    eyeColor: '#f59e0b',
    togglePanelClass: 'bg-amber-400/25 border-amber-100/60',
  },
  R_75: {
    imageSrc: robotVol75Img,
    alt: 'Volatility 75 carbon-weave crimson-visor mech',
    fallbackGradientClass: 'bg-gradient-to-br from-zinc-700 via-slate-600 to-zinc-400',
    eyeColor: '#ef4444',
    togglePanelClass: 'bg-slate-300/25 border-slate-100/60',
  },
  R_100: {
    imageSrc: robotVol100Img,
    alt: 'Volatility 100 ceramic and copper cyclops droid',
    fallbackGradientClass: 'bg-gradient-to-br from-stone-500 via-orange-900/35 to-amber-100',
    eyeColor: '#f43f5e',
    togglePanelClass: 'bg-orange-300/25 border-orange-100/60',
  },
  '1HZ10V': {
    imageSrc: robotVol10_1sImg,
    alt: 'Volatility 10 (1s) aerodynamic scout robot',
    fallbackGradientClass: 'bg-gradient-to-br from-teal-700/60 via-slate-400 to-slate-200',
    eyeColor: '#34d399',
    togglePanelClass: 'bg-teal-300/25 border-teal-100/60',
  },
  '1HZ25V': {
    imageSrc: robotVol25_1sImg,
    alt: 'Volatility 25 (1s) brushed aluminum twin-lens lab robot',
    fallbackGradientClass: 'bg-gradient-to-br from-sky-800/50 via-slate-400 to-sky-100',
    eyeColor: '#0284c7',
    togglePanelClass: 'bg-sky-300/25 border-sky-100/60',
  },
  '1HZ50V': {
    imageSrc: robotVol50_1sImg,
    alt: 'Volatility 50 (1s) cobalt-blue geometric mecha',
    fallbackGradientClass: 'bg-gradient-to-br from-blue-800/60 via-slate-500 to-slate-300',
    eyeColor: '#38bdf8',
    togglePanelClass: 'bg-blue-400/25 border-blue-100/60',
  },
  '1HZ75V': {
    imageSrc: robotVol75_1sImg,
    alt: 'Volatility 75 (1s) tactical olive-titanium ranger robot',
    fallbackGradientClass: 'bg-gradient-to-br from-stone-600 via-emerald-950/35 to-stone-300',
    eyeColor: '#eab308',
    togglePanelClass: 'bg-lime-300/25 border-lime-100/60',
  },
  '1HZ100V': {
    imageSrc: robotVol100_1sImg,
    alt: 'Volatility 100 (1s) chrome and tungsten interceptor robot',
    fallbackGradientClass: 'bg-gradient-to-br from-zinc-700 via-zinc-500 to-slate-300',
    eyeColor: '#f97316',
    togglePanelClass: 'bg-orange-400/25 border-orange-100/60',
  },
  stp_index_100: {
    imageSrc: robotStep100Img,
    alt: 'Step Index architectural stepped platinum robot',
    fallbackGradientClass: 'bg-gradient-to-br from-slate-400 via-slate-300 to-zinc-100',
    eyeColor: '#06b6d4',
    togglePanelClass: 'bg-cyan-400/25 border-cyan-100/60',
  },
  JD50: {
    imageSrc: robotJump50Img,
    alt: 'Jump 50 kinetic exo-frame robot',
    fallbackGradientClass: 'bg-gradient-to-br from-zinc-400 via-stone-300 to-zinc-100',
    eyeColor: '#fb923c',
    togglePanelClass: 'bg-amber-300/25 border-amber-100/60',
  },
};

const CyberScannerBanner: React.FC<{
  marketId: string;
  marketName: string;
  modeLabel: string;
  lastDigit: number;
  candle2mDirection?: 'bullish' | 'bearish' | 'neutral';
  highLowTickReadout?: {
    contractType: 'HIGH_TICK' | 'LOW_TICK';
    targetTick: number;
    rsi5m?: number;
  };
}> = ({ marketId, marketName, modeLabel, lastDigit, candle2mDirection, highLowTickReadout }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const visual = MARKET_ROBOT_VISUALS[marketId] ?? MARKET_ROBOT_VISUALS.R_10;

  return (
    <div
      className={`relative h-40 sm:h-44 w-full overflow-hidden select-none ${visual.fallbackGradientClass}`}
    >
      {!imgFailed ? (
        <img
          src={visual.imageSrc}
          alt={visual.alt || `${marketName} signal robot`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-[50%_18%] pointer-events-none transition-transform duration-300"
        />
      ) : (
        <svg
          viewBox="0 0 260 150"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          preserveAspectRatio="xMidYMax meet"
          aria-hidden="true"
        >
          <path
            d="M68 150 C78 128, 102 122, 130 122 C158 122, 182 128, 192 150 Z"
            fill="#1e293b"
          />
          <path d="M112 104 L115 136 L145 136 L148 104 Z" fill="#0f172a" />
          <rect x="92" y="54" width="8" height="24" rx="4" fill="#1e293b" />
          <circle cx="95" cy="66" r="2.5" fill={visual.eyeColor} />
          <rect x="160" y="54" width="8" height="24" rx="4" fill="#1e293b" />
          <circle cx="165" cy="66" r="2.5" fill={visual.eyeColor} />
          <path
            d="M98 54 C98 24, 162 24, 162 54 C162 79, 150 104, 130 112 C110 104, 98 79, 98 54 Z"
            fill="#e2e8f0"
          />
          <path d="M108 66 Q116 63 123 67 Q116 71 108 66 Z" fill="#0f172a" />
          <circle cx="116" cy="66.8" r="2.5" fill={visual.eyeColor} />
          <path d="M137 67 Q144 63 152 66 Q144 71 137 67 Z" fill="#0f172a" />
          <circle cx="144" cy="66.8" r="2.5" fill={visual.eyeColor} />
          <path d="M121 95 Q130 98 139 95" stroke="#475569" strokeWidth="1.4" fill="none" />
        </svg>
      )}

      {/* Subtle bottom vignette so overlaid frosted controls remain crisp across all robot portraits */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/25 to-transparent pointer-events-none" />

      {/* Left Glassmorphic Toggle Module */}
      <div
        className={`absolute left-3.5 bottom-3.5 w-12 h-12 sm:w-13 sm:h-13 rounded-2xl backdrop-blur-xs border flex flex-col items-center justify-center gap-1.5 shadow-xs ${visual.togglePanelClass}`}
      >
        <div className="w-7 h-3 rounded-full bg-emerald-500/90 border border-emerald-950/35 flex items-center justify-start px-0.5">
          <span className="w-2 h-2 rounded-full bg-emerald-50" />
        </div>
        <div className="w-7 h-3 rounded-full bg-sky-500/90 border border-sky-950/35 flex items-center justify-end px-0.5">
          <span className="w-2 h-2 rounded-full bg-sky-50" />
        </div>
      </div>

      {/* Mode Frosted Tag */}
      <div className="absolute left-17 sm:left-18 bottom-3 px-2.5 py-0.5 rounded-md bg-white/80 backdrop-blur-xs border border-white/90 shadow-2xs">
        <span className="text-[10px] sm:text-[11px] font-extrabold tracking-wide text-slate-900 uppercase whitespace-nowrap">
          {modeLabel}
        </span>
      </div>

      {/* Right Translucent Live Readout Box: 2m Candle Direction, High/Low Tick 5m RSI, or Last Digit */}
      {candle2mDirection ? (
        <div
          className={`absolute right-3.5 bottom-2.5 w-13 h-15 sm:w-14 sm:h-16 rounded-xl backdrop-blur-xs border flex flex-col items-center justify-center shadow-xs ${
            candle2mDirection === 'bullish'
              ? 'bg-emerald-100/90 border-emerald-400 text-emerald-700'
              : candle2mDirection === 'bearish'
              ? 'bg-red-100/90 border-red-400 text-red-600'
              : 'bg-slate-100/85 border-slate-300/90 text-slate-700'
          }`}
        >
          <span className="text-[10px] font-mono font-bold leading-none">2m</span>
          <span className="font-mono text-2xl sm:text-3xl font-extrabold leading-tight select-none">
            {candle2mDirection === 'bullish' ? '▲' : candle2mDirection === 'bearish' ? '▼' : '—'}
          </span>
        </div>
      ) : highLowTickReadout ? (
        <div
          className={`absolute right-3.5 bottom-2.5 w-14 h-15 sm:w-15 sm:h-16 rounded-xl backdrop-blur-xs border flex flex-col items-center justify-center shadow-xs px-1 ${
            highLowTickReadout.contractType === 'HIGH_TICK'
              ? 'bg-emerald-100/90 border-emerald-400 text-emerald-700'
              : 'bg-rose-100/90 border-rose-400 text-rose-700'
          }`}
        >
          <span className="text-[9px] font-mono font-extrabold leading-none uppercase">
            5m RSI
          </span>
          <span className="font-mono tabular-nums text-base sm:text-lg font-extrabold leading-tight select-none">
            {highLowTickReadout.rsi5m !== undefined ? highLowTickReadout.rsi5m.toFixed(0) : '50'}
          </span>
          <span className="text-[9px] font-mono font-extrabold leading-none">
            {highLowTickReadout.contractType === 'HIGH_TICK' ? 'H' : 'L'}#{highLowTickReadout.targetTick}
          </span>
        </div>
      ) : (
        <div className="absolute right-3.5 bottom-2.5 w-13 h-15 sm:w-14 sm:h-16 rounded-xl bg-rose-100/75 backdrop-blur-xs border border-rose-300/80 flex items-center justify-center shadow-xs">
          <span className="font-mono tabular-nums text-3xl sm:text-4xl font-extrabold text-[#9f2b36] select-none">
            {lastDigit}
          </span>
        </div>
      )}
    </div>
  );
};

const ScanningRing: React.FC<{ secondsLeft: number; totalSeconds?: number }> = ({
  secondsLeft,
  totalSeconds = 17,
}) => {
  const total = Math.max(1, totalSeconds);
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0.08, Math.min(1, secondsLeft / total));
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="#bfdbfe"
          strokeWidth="4.5"
          opacity="0.55"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute font-mono tabular-nums text-base font-extrabold text-cyan-500">
        {secondsLeft}
      </span>
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
  const [overUnderBarrier, setOverUnderBarrier] = useState<BarrierFilter>('all');
  const [chartMarket, setChartMarket] = useState<Market>(SIGNAL_MARKETS[0]);

  useEffect(() => {
    if (activeSignal?.marketId) {
      const found = SIGNAL_MARKETS.find((m) => m.id === activeSignal.marketId);
      if (found) setChartMarket(found);
    }
  }, [activeSignal?.marketId]);

  const stake = normalBotConfig.initialStake;
  const rawConfiguredTicks =
    !normalBotConfig.durationUnit || normalBotConfig.durationUnit === 't'
      ? Math.round(normalBotConfig.duration || 1)
      : 1;
  const minTicksForTab =
    category === 'only_up_down' ? 2 : category === 'high_low_tick' ? 5 : 1;
  const maxTicksForTab =
    category === 'only_up_down' || category === 'high_low_tick' ? 5 : 10;
  const effectiveDefaultTicks =
    category === 'high_low_tick' ? 5 : rawConfiguredTicks;
  const ticks = Math.min(maxTicksForTab, Math.max(minTicksForTab, effectiveDefaultTicks));
  const martingale = normalBotConfig.martingale;
  const takeProfit = normalBotConfig.takeProfit;
  const stopLoss = normalBotConfig.stopLoss;

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

  const handleStakeChange = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const val = Math.min(9999, Math.max(0.35, parsed));
    onUpdateNormalBotConfig({ stake: val, initialStake: val });
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
    ? scannerRef.current.getSnapshots(category, overUnderBarrier, ticks)
    : [];

  // Hard category invariant: each signal tab strictly holds ONLY its own contract family
  const snapshots: MarketSignalSnapshot[] = rawSnapshots.filter((snap) => {
    if (snap.category !== category) return false;
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
      : category === 'only_up_down'
      ? 'ONLY UP / DOWN'
      : category === 'high_low_tick'
      ? 'HIGH / LOW TICK'
      : 'DIGIT MATCH';

  const subtitleText =
    category === 'even_odd'
      ? 'Triggers at ≥52% with rising momentum (50/50 equal = no trade, scan again). Initial entry waits for ≥2 opposite digits + 1 confirmation digit, then trades continuously.'
      : category === 'over_under'
      ? 'Over 4, 5, 6, 7 (53/45/35/30%) & Under 5, 4, 3, 2 (53/45/35/30%) only. Entry waits for ≥3 consecutive opposite digits + 1 winning confirmation digit, then trades continuously.'
      : category === 'only_up_down'
      ? 'First identifies the overall market trend (Uptrend / Downtrend) to decide direction, then checks the 2-minute candlestick for strong aligned momentum to activate Run (entry: ≥2 Fall → 1 Rise for Only Up; ≥2 Rise → 1 Fall for Only Down).'
      : category === 'high_low_tick'
      ? '5-minute Candlestick + RSI(14) on Advanced TradingView: candle must have wicks on both sides to activate Run. High Tick: RSI < 50 + initial entry of 3 consecutive rising ticks (▲▲▲), then trades continuously. Low Tick: RSI > 50 + initial entry of 3 consecutive falling ticks (▼▼▼), then trades continuously. No trade when ≤10s remain in the 5m candle.'
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

          {normalBotMetrics.totalTrades > 0 && (
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
              <span className="text-slate-400">
                Normal Bot P/L:{' '}
                <strong
                  className={
                    normalBotMetrics.totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }
                >
                  {normalBotMetrics.totalProfit >= 0 ? '+' : ''}$
                  {normalBotMetrics.totalProfit.toFixed(2)}
                </strong>{' '}
                ({normalBotMetrics.wins}W/{normalBotMetrics.losses}L)
              </span>
              <button
                type="button"
                onClick={onResetNormalBot}
                className="w-fit px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-sans font-semibold text-xs flex items-center gap-1 cursor-pointer"
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
        className={`w-fit max-w-full rounded-2xl border px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-colors ${
          isLight
            ? 'bg-slate-50/95 border-slate-200 shadow-2xs'
            : 'bg-[#111827] border-slate-800 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
          {/* Stake */}
          <div className="flex flex-col items-start gap-1">
            <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
              Stake ($)
            </label>
            <input
              type="number"
              min={0.35}
              max={9999}
              step={0.5}
              value={stake}
              onChange={(e) => handleStakeChange(e.target.value)}
              className={compactInputClass}
            />
          </div>

          {/* Number of Ticks */}
          <div className="flex flex-col items-start gap-1">
            <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
              Ticks
            </label>
            <input
              type="number"
              min={minTicksForTab}
              max={maxTicksForTab}
              step={1}
              value={ticks}
              onChange={(e) => handleTicksChange(e.target.value)}
              title={`Number of ticks (${minTicksForTab}–${maxTicksForTab})`}
              className={compactInputClass}
            />
          </div>

          {/* Martingale */}
          <div className="flex flex-col items-start gap-1">
            <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
              Martingale
            </label>
            <input
              type="number"
              min={1}
              max={9999}
              step={0.1}
              value={martingale}
              onChange={(e) => handleMartingaleChange(e.target.value)}
              className={compactInputClass}
            />
          </div>

          {/* Take Profit */}
          <div className="flex flex-col items-start gap-1">
            <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
              Take profit
            </label>
            <input
              type="number"
              min={0.1}
              max={9999}
              step={0.1}
              value={takeProfit}
              onChange={(e) => handleTpChange(e.target.value)}
              className={compactInputClass}
            />
          </div>

          {/* Stop Loss */}
          <div className="flex flex-col items-start gap-1">
            <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
              Stop loss
            </label>
            <input
              type="number"
              min={1}
              max={9999}
              step={5}
              value={stopLoss}
              onChange={(e) => handleSlChange(e.target.value)}
              className={compactInputClass}
            />
          </div>
        </div>

        <div className="sm:pl-3 sm:border-l sm:border-slate-700/50 text-[11px] text-slate-400 leading-snug">
          <div>
            Duration <strong className="font-mono tabular-nums text-white">{ticks}t</strong> · Win resets stake to{' '}
            <strong className="font-mono tabular-nums text-white">{stake}</strong>
          </div>
          <div>
            Loss multiplies by <strong className="font-mono tabular-nums text-white">{martingale}x</strong>
          </div>
        </div>
      </div>

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
              {normalBotWaitingForEntry ? 'Normal Bot Waiting for Entry:' : 'Normal Bot Trading Live:'}{' '}
              {activeSignal.signalLabel} ({activeSignal.ticks ?? ticks}t) on {activeSignal.marketId}
            </span>
            <span className="font-mono tabular-nums text-slate-700">
              {normalBotWaitingForEntry && normalBotEntryStatus
                ? normalBotEntryStatus
                : `Stake: $${normalBotStake.toFixed(2)} · Ticks: ${
                    activeSignal.ticks ?? ticks
                  } · P/L: ${
                    normalBotMetrics.totalProfit >= 0 ? '+' : ''
                  }$${normalBotMetrics.totalProfit.toFixed(2)} (${normalBotMetrics.wins}W/${
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
            onClick={() => setCategory('even_odd')}
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
            onClick={() => setCategory('over_under')}
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
            onClick={() => setCategory('digit_match')}
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
            onClick={() => setCategory('only_up_down')}
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
            onClick={() => setCategory('high_low_tick')}
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
      </div>

      {/* 3B. DERIV ADVANCED TRADINGVIEW (5M CANDLESTICKS + RSI) FOR HIGH TICK / LOW TICK */}
      {category === 'high_low_tick' && (
        <ChartsView
          market={chartMarket}
          defaultTimePeriod="5m"
          markets={SIGNAL_MARKETS}
          onSelectMarket={setChartMarket}
          analysis5m={chartAnalysis5m}
        />
      )}

      {/* 4. 2-COLUMN MULTI-MARKET SIGNAL CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          const cardBannerModeLabel = showScanningState
            ? modeBannerLabel
            : category === 'even_odd' ||
              category === 'only_up_down' ||
              category === 'high_low_tick'
            ? displaySignalLabel
            : category === 'over_under'
            ? `${displayContractType} #${displayPrediction}`
            : `MATCH #${displayPrediction}`;

          return (
            <div
              key={`${category}-${snap.market.id}`}
              className={`rounded-2xl border overflow-hidden flex flex-col transition-all ${
                isThisCardRunning
                  ? 'ring-2 ring-[#2563eb] border-[#2563eb]'
                  : isLight
                  ? 'bg-white border-slate-200 shadow-xs'
                  : 'bg-[#111827] border-slate-800 shadow-sm'
              }`}
            >
              <CyberScannerBanner
                marketId={snap.market.id}
                marketName={snap.market.name}
                modeLabel={cardBannerModeLabel}
                lastDigit={snap.lastDigit}
                candle2mDirection={
                  category === 'only_up_down' ? snap.candle2mDirection : undefined
                }
                highLowTickReadout={
                  category === 'high_low_tick' &&
                  (displayContractType === 'HIGH_TICK' || displayContractType === 'LOW_TICK')
                    ? {
                        contractType: displayContractType,
                        targetTick: Math.min(5, Math.max(1, Number(displayPrediction) || 5)),
                        rsi5m: snap.rsi5m,
                      }
                    : undefined
                }
              />

              <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                      {snap.market.name.replace(' Index', '')}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono mt-0.5">
                      <span className="text-slate-400">{snap.market.id}</span>
                      {(category === 'only_up_down' || category === 'high_low_tick') &&
                        snap.marketTrend && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span
                              className={
                                snap.marketTrend === 'uptrend'
                                  ? 'text-emerald-400 font-semibold'
                                  : snap.marketTrend === 'downtrend'
                                  ? 'text-fuchsia-400 font-semibold'
                                  : 'text-slate-400'
                              }
                            >
                              {snap.marketTrendSummary ||
                                (snap.marketTrend === 'uptrend'
                                  ? 'Uptrend ▲'
                                  : snap.marketTrend === 'downtrend'
                                  ? 'Downtrend ▼'
                                  : 'Ranging')}
                            </span>
                          </>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {category === 'high_low_tick' && (
                      <button
                        type="button"
                        onClick={() => setChartMarket(snap.market)}
                        title={`Inspect ${snap.market.name} on 5m Advanced TradingView`}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                          chartMarket.id === snap.market.id
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <TrendingUp className="w-3 h-3" />
                        <span>5m Chart</span>
                      </button>
                    )}

                    <span
                      title={
                        snap.isLiveWs
                          ? `Live Deriv feed (${snap.lastQuote})`
                          : `Active stream (${snap.lastQuote})`
                      }
                      className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </span>
                  </div>
                </div>

                {showScanningState ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3.5 py-1">
                      <ScanningRing
                        secondsLeft={snap.scanSecondsLeft}
                        totalSeconds={
                          category === 'only_up_down'
                            ? 120
                            : category === 'high_low_tick'
                            ? 300
                            : 17
                        }
                      />
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-xs sm:text-sm font-extrabold tracking-wide text-white uppercase">
                          {category === 'only_up_down'
                            ? 'SCANNING TREND & 2M CANDLE'
                            : category === 'high_low_tick'
                            ? (snap.candle5mSecondsLeft ?? 300) <= 10
                              ? 'NO TRADE · ≤10S REMAINING'
                              : 'ANALYSING 5M CANDLE & RSI'
                            : 'SCANNING'}
                        </span>
                        <span
                          className={`w-5 h-1 rounded-full ${
                            category === 'high_low_tick' && (snap.candle5mSecondsLeft ?? 300) <= 10
                              ? 'bg-rose-500'
                              : 'bg-cyan-500'
                          }`}
                        />
                        <span className="text-xs text-slate-400 font-mono tabular-nums truncate">
                          {snap.scanStatusNote}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled
                      className={`w-full py-2.5 px-4 rounded-full text-xs sm:text-sm font-semibold text-left cursor-not-allowed border transition-colors ${
                        isLight
                          ? 'bg-slate-100 text-slate-400 border-slate-200'
                          : 'bg-slate-800/35 text-slate-500 border-slate-700/60'
                      }`}
                    >
                      {category === 'only_up_down'
                        ? snap.marketTrend === 'ranging'
                          ? 'Run (awaiting clear market trend...)'
                          : 'Run (trend confirmed · awaiting 2m momentum...)'
                        : category === 'high_low_tick'
                        ? (snap.candle5mSecondsLeft ?? 300) <= 10
                          ? `No trade (${snap.candle5mSecondsLeft}s left ≤ 10s in 5m candle)`
                          : 'Run (awaiting 5m wicks on both sides...)'
                        : 'Run (scanning for market...)'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start gap-3">
                      <span
                        className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-wide uppercase shrink-0 shadow-2xs ${
                          displaySignalTone === 'emerald'
                            ? 'bg-[#10b981] text-emerald-50'
                            : displaySignalTone === 'fuchsia'
                            ? 'bg-[#c026d3] text-fuchsia-50'
                            : displaySignalTone === 'amber'
                            ? 'bg-[#d97706] text-amber-50'
                            : 'bg-[#0284c7] text-sky-50'
                        }`}
                      >
                        {displaySignalLabel}
                      </span>

                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-extrabold text-white font-mono tabular-nums">
                          {category === 'only_up_down'
                            ? `Trend + Strong 2m · ${displayConfidencePct}% · ${displayPayoutMultiplier.toFixed(2)}x`
                            : category === 'high_low_tick'
                            ? `5m Wicks + RSI · ${displayConfidencePct}% · ${displayPayoutMultiplier.toFixed(2)}x`
                            : `Market found · ${displayConfidencePct}% · ${displayPayoutMultiplier.toFixed(2)}x`}
                        </span>
                        <span className="text-xs font-semibold text-slate-400 font-mono tabular-nums truncate">
                          {displayDistributionSubtext}
                        </span>
                      </div>
                    </div>

                    {/* Unboxed Entry Confirmation / Pattern Telemetry */}
                    <div className="flex flex-col gap-0.5 text-[11px] font-mono tabular-nums leading-snug">
                      {displayPatternSummary && (
                        <span
                          className={`truncate ${
                            snap.entryConfirmedNow && !normalBotWaitingForEntry
                              ? 'text-emerald-400 font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {displayPatternSummary}
                        </span>
                      )}
                      {category === 'over_under' && snap.topBarriersSummary && (
                        <span className="truncate text-slate-500">
                          Qualifying · {snap.topBarriersSummary}
                        </span>
                      )}
                      {category === 'high_low_tick' && snap.highLowBreakdownSummary && (
                        <span className="truncate text-slate-500">
                          {snap.highLowBreakdownSummary}
                        </span>
                      )}
                    </div>

                    {isThisCardRunning ? (
                      <button
                        type="button"
                        onClick={onStopNormalBot}
                        className={`w-full py-2.5 px-4 rounded-full text-xs sm:text-sm font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors shadow-xs ${
                          normalBotWaitingForEntry
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-rose-600 hover:bg-rose-500 text-rose-50'
                        }`}
                      >
                        <span className="truncate">
                          {normalBotWaitingForEntry
                            ? normalBotEntryStatus || 'Waiting for entry...'
                            : `Trading continuous ($${normalBotStake.toFixed(2)} · TP $${takeProfit})`}
                        </span>
                        <span className="underline shrink-0">Stop</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setChartMarket(snap.market);
                          onRunSignalOnNormalBot({
                            category,
                            market: snap.market,
                            contractType: snap.contractType,
                            prediction: snap.prediction,
                            signalEntryTrigger: snap.signalEntryTrigger,
                            entryConfirmedNow: snap.entryConfirmedNow,
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
                          });
                        }}
                        className="w-full py-2.5 px-4 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.99] text-sky-50 text-xs sm:text-sm font-bold flex items-center justify-between cursor-pointer transition-all shadow-xs"
                      >
                        <span>Run this signal</span>
                        <span className="text-[11px] font-medium opacity-90">
                          {snap.signalEntryTrigger === 'immediate'
                            ? `Match #${snap.prediction} · Continuous`
                            : snap.contractType === 'HIGH_TICK'
                            ? 'Entry: 3 Rising (▲▲▲) → Continuous'
                            : snap.contractType === 'LOW_TICK'
                            ? 'Entry: 3 Falling (▼▼▼) → Continuous'
                            : snap.contractType === 'ONLY_UP'
                            ? 'Entry: ≥2 Fall → 1 Rise'
                            : snap.contractType === 'ONLY_DOWN'
                            ? 'Entry: ≥2 Rise → 1 Fall'
                            : 'Waits for entry'}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
                  {category === 'only_up_down' || category === 'high_low_tick'
                    ? (snap.recentDirections ?? []).map((dir, idx) => {
                        const symbol = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '·';
                        const tileColorClass =
                          dir === 'up'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                            : dir === 'down'
                            ? 'bg-red-50 border-red-400 text-red-600'
                            : 'bg-slate-100 border-slate-300 text-slate-500';
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
                            className={`w-6 h-6 rounded-md border font-mono tabular-nums text-[10px] font-bold flex items-center justify-center shrink-0 ${tileColorClass}`}
                          >
                            {symbol}
                          </span>
                        );
                      })
                    : snap.recentDigits.map((d, idx) => {
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
                            className={`w-6 h-6 rounded-md border font-mono tabular-nums text-[11px] font-bold flex items-center justify-center shrink-0 ${
                              isPositiveTile
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-pink-50 border-pink-300 text-pink-700'
                            }`}
                          >
                            {d}
                          </span>
                        );
                      })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
