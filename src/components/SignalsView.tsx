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
  SignalCategory,
} from '../services/signalScannerEngine';
import { Square, RotateCcw, ArrowUpRight } from 'lucide-react';

export interface SignalExecutionRequest {
  market: Market;
  contractType: TradeContractType;
  prediction: number;
  signalEntryTrigger: SignalEntryTrigger;
  stake: number;
  martingale: number;
  takeProfit: number;
  stopLoss: number;
  signalLabel: string;
}

interface SignalsViewProps {
  normalBotConfig: NormalBotConfig;
  onUpdateNormalBotConfig: (patch: Partial<NormalBotConfig>) => void;
  onRunSignalOnNormalBot: (req: SignalExecutionRequest) => void;
  onStopNormalBot: () => void;
  onResetNormalBot: () => void;
  onOpenNormalBotTab: () => void;
  normalBotRunning: boolean;
  normalBotStake: number;
  normalBotMetrics: BotMetrics;
  activeSignalMarketId: string | null;
  activeSignalLabel: string | null;
  theme?: 'dark' | 'light';
}

const CyberScannerBanner: React.FC<{
  modeLabel: string;
  lastDigit: number;
}> = ({ modeLabel, lastDigit }) => {
  return (
    <div
      className="relative h-32 sm:h-36 w-full overflow-hidden select-none"
      style={{
        background: 'linear-gradient(108deg, #5d8177 0%, #8fa59f 48%, #d5cdca 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(circle at 50% 25%, rgba(255,255,255,0.45) 0%, transparent 62%)',
        }}
      />

      {/* Center Cybernetic Visor Bust SVG */}
      <svg
        viewBox="0 0 260 150"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="headShell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eef4f2" />
            <stop offset="55%" stopColor="#b5c6c1" />
            <stop offset="100%" stopColor="#6c857e" />
          </linearGradient>
          <linearGradient id="neckTech" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#264b41" />
            <stop offset="100%" stopColor="#122822" />
          </linearGradient>
        </defs>

        <path
          d="M68 150 C78 128, 102 122, 130 122 C158 122, 182 128, 192 150 Z"
          fill="url(#neckTech)"
        />
        <path d="M112 104 L115 136 L145 136 L148 104 Z" fill="url(#neckTech)" />
        <path
          d="M121 110 L121 138 M130 112 L130 142 M139 110 L139 138 M96 142 L116 130 M164 142 L144 130"
          stroke="#34d399"
          strokeWidth="1.6"
          strokeOpacity="0.65"
          fill="none"
        />

        <rect x="92" y="54" width="8" height="24" rx="4" fill="#1f3a33" />
        <circle cx="95" cy="66" r="2.5" fill="#34d399" />
        <rect x="160" y="54" width="8" height="24" rx="4" fill="#1f3a33" />
        <circle cx="165" cy="66" r="2.5" fill="#34d399" />

        <path
          d="M98 54 C98 24, 162 24, 162 54 C162 79, 150 104, 130 112 C110 104, 98 79, 98 54 Z"
          fill="url(#headShell)"
        />
        <path
          d="M130 28 L130 56 M106 42 Q118 52 124 62 M154 42 Q142 52 136 62"
          stroke="#6b857e"
          strokeWidth="0.9"
          strokeOpacity="0.55"
          fill="none"
        />

        <path d="M108 66 Q116 63 123 67 Q116 71 108 66 Z" fill="#2c1215" />
        <circle cx="116" cy="66.8" r="2.3" fill="#ef4444" />
        <path d="M137 67 Q144 63 152 66 Q144 71 137 67 Z" fill="#2c1215" />
        <circle cx="144" cy="66.8" r="2.3" fill="#ef4444" />

        <path d="M130 68 L127 84 L133 84 Z" fill="#8aa09a" opacity="0.55" />
        <path d="M121 95 Q130 98 139 95" stroke="#5b736d" strokeWidth="1.4" fill="none" />
      </svg>

      {/* Left Glassmorphic Toggle Module */}
      <div className="absolute left-3.5 bottom-4 w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-emerald-300/25 backdrop-blur-xs border border-emerald-100/50 flex flex-col items-center justify-center gap-1.5 shadow-xs">
        <div className="w-7 h-3 rounded-full bg-emerald-500/85 border border-emerald-950/40 flex items-center justify-start px-0.5">
          <span className="w-2 h-2 rounded-full bg-emerald-50" />
        </div>
        <div className="w-7 h-3 rounded-full bg-sky-500/85 border border-sky-950/40 flex items-center justify-end px-0.5">
          <span className="w-2 h-2 rounded-full bg-sky-50" />
        </div>
      </div>

      {/* Mode Frosted Tag */}
      <div className="absolute left-16 sm:left-19 bottom-3 px-2.5 py-0.5 rounded-md bg-white/45 backdrop-blur-xs border border-white/60 shadow-2xs">
        <span className="text-[10px] sm:text-[11px] font-extrabold tracking-wide text-slate-800 uppercase whitespace-nowrap">
          {modeLabel}
        </span>
      </div>

      {/* Right Translucent Live Last-Digit Readout Box */}
      <div className="absolute right-4 bottom-2.5 w-13 h-15 sm:w-14 sm:h-16 rounded-xl bg-rose-400/25 backdrop-blur-xs border border-rose-300/55 flex items-center justify-center shadow-xs">
        <span className="font-mono tabular-nums text-3xl sm:text-4xl font-extrabold text-[#9f2b36] select-none">
          {lastDigit}
        </span>
      </div>
    </div>
  );
};

const ScanningRing: React.FC<{ secondsLeft: number }> = ({ secondsLeft }) => {
  const total = 17;
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
  normalBotStake,
  normalBotMetrics,
  activeSignalMarketId,
  activeSignalLabel,
  theme = 'dark',
}) => {
  const [category, setCategory] = useState<SignalCategory>('even_odd');
  const [overUnderBarrier, setOverUnderBarrier] = useState<BarrierFilter>('all');

  const stake = normalBotConfig.initialStake;
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

  const handleMartingaleChange = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const val = Math.min(9999, Math.max(1, parsed));
    onUpdateNormalBotConfig({ martingale: val });
  };

  const handleTpChange = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const val = Math.min(9999, Math.max(0.5, parsed));
    onUpdateNormalBotConfig({ takeProfit: val });
  };

  const handleSlChange = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    const val = Math.min(9999, Math.max(0.5, parsed));
    onUpdateNormalBotConfig({ stopLoss: val });
  };

  const snapshots: MarketSignalSnapshot[] = scannerRef.current
    ? scannerRef.current.getSnapshots(category, overUnderBarrier)
    : [];
  const isFeedLive = scannerRef.current?.getIsConnected() ?? false;
  const isLight = theme === 'light';

  const modeBannerLabel =
    category === 'even_odd'
      ? 'EVEN / ODD'
      : category === 'over_under'
      ? 'OVER / UNDER'
      : 'DIGIT MATCH';

  const subtitleText =
    category === 'even_odd'
      ? 'Signals trigger at ≥53% with rising momentum (50/50 equal = no trade, scan again). Entry: ≥2 consecutive opposite digits followed by 1 confirmation digit.'
      : category === 'over_under'
      ? 'Over 3–7 & Under 6–3 rules: Over 3 ≥65% · Over 4 ≥60% · Over 5 ≥55% · Over 6 ≥45% · Over 7 ≥35% | Under 6 ≥65% · Under 5 ≥60% · Under 4 ≥55% · Under 3 ≥45%.'
      : 'Hot digit frequency and cluster read across synthetic indices. Click Run this signal to start trading on the Normal Bot.';

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

      {/* 2. COMPACT 4-CHARACTER PARAMETER STRIP (Stake · Martingale · Take profit · Stop loss) */}
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
              min={0.5}
              max={9999}
              step={1}
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
            Win resets stake to <strong className="font-mono tabular-nums text-white">{stake}</strong>
          </div>
          <div>
            Loss multiplies by <strong className="font-mono tabular-nums text-white">{martingale}x</strong>
          </div>
        </div>
      </div>

      {/* ACTIVE NORMAL BOT RUNNING BANNER */}
      {normalBotRunning && (
        <div className="rounded-2xl border border-blue-300 bg-sky-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-sky-950">
            <span className="font-extrabold">
              Normal Bot Trading Live:{' '}
              {activeSignalLabel || `${normalBotConfig.contractType} (${normalBotConfig.prediction})`}{' '}
              on {activeSignalMarketId || normalBotConfig.marketId}
            </span>
            <span className="font-mono tabular-nums text-sky-800">
              Stake: ${normalBotStake.toFixed(2)} · P/L:{' '}
              {normalBotMetrics.totalProfit >= 0 ? '+' : ''}$
              {normalBotMetrics.totalProfit.toFixed(2)} ({normalBotMetrics.wins}W/
              {normalBotMetrics.losses}L)
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
              <span>Stop trade</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. SIGNAL CATEGORY TABS (Even / Odd | Over / Under | Digit Match) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCategory('even_odd')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap border ${
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
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap border ${
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
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap border ${
              category === 'digit_match'
                ? 'bg-[#2563eb] text-sky-50 border-[#2563eb] shadow-xs'
                : isLight
                ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                : 'bg-[#111827] text-slate-200 border-slate-700 hover:border-slate-500'
            }`}
          >
            Digit Match
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
              All (3–7)
            </button>
            {([3, 4, 5, 6, 7] as const).map((b) => (
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

      {/* 4. 2-COLUMN MULTI-MARKET SIGNAL CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {snapshots.map((snap) => {
          const isThisCardRunning =
            normalBotRunning &&
            (activeSignalMarketId
              ? activeSignalMarketId === snap.market.id
              : normalBotConfig.marketId === snap.market.id);

          return (
            <div
              key={snap.market.id}
              className={`rounded-2xl border overflow-hidden flex flex-col transition-all ${
                isThisCardRunning
                  ? 'ring-2 ring-[#2563eb] border-[#2563eb]'
                  : isLight
                  ? 'bg-white border-slate-200 shadow-xs'
                  : 'bg-[#111827] border-slate-800 shadow-sm'
              }`}
            >
              <CyberScannerBanner
                modeLabel={
                  category === 'over_under' && !snap.isScanning
                    ? `${snap.contractType} #${snap.prediction}`
                    : modeBannerLabel
                }
                lastDigit={snap.lastDigit}
              />

              <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                      {snap.market.name.replace(' Index', '')}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">{snap.market.id}</span>
                  </div>

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

                {snap.isScanning && !isThisCardRunning ? (
                  <div className="flex items-center gap-3.5 py-1.5">
                    <ScanningRing secondsLeft={snap.scanSecondsLeft} />
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-xs sm:text-sm font-extrabold tracking-wide text-white uppercase">
                        SCANNING
                      </span>
                      <span className="w-5 h-1 rounded-full bg-cyan-500" />
                      <span className="text-xs text-slate-400 font-mono tabular-nums truncate">
                        {snap.scanStatusNote}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start gap-3">
                      <span
                        className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-wide uppercase shrink-0 shadow-2xs ${
                          snap.signalTone === 'emerald'
                            ? 'bg-[#10b981] text-emerald-50'
                            : snap.signalTone === 'fuchsia'
                            ? 'bg-[#c026d3] text-fuchsia-50'
                            : 'bg-[#0284c7] text-sky-50'
                        }`}
                      >
                        {snap.signalLabel}
                      </span>

                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-extrabold text-white font-mono tabular-nums">
                          Entry · {snap.entryConfidencePct}% · {snap.payoutMultiplier.toFixed(2)}x
                        </span>
                        <span className="text-xs font-semibold text-slate-400 font-mono tabular-nums truncate">
                          {snap.distributionSubtext}
                        </span>
                      </div>
                    </div>

                    {/* Unboxed Entry Confirmation / Pattern Telemetry */}
                    <div className="flex flex-col gap-0.5 text-[11px] font-mono tabular-nums leading-snug">
                      {snap.patternSummary && (
                        <span
                          className={`truncate ${
                            category === 'even_odd' && snap.entryConfirmedNow
                              ? 'text-emerald-400 font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {category === 'even_odd' ? snap.patternSummary : `Pattern · ${snap.patternSummary}`}
                        </span>
                      )}
                      {category === 'over_under' && snap.topBarriersSummary && (
                        <span className="truncate text-slate-500">
                          Qualifying · {snap.topBarriersSummary}
                        </span>
                      )}
                    </div>

                    {isThisCardRunning ? (
                      <button
                        type="button"
                        onClick={onStopNormalBot}
                        className="w-full py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-500 text-rose-50 text-xs sm:text-sm font-bold flex items-center justify-between cursor-pointer transition-colors shadow-xs"
                      >
                        <span>
                          Trading on Normal Bot (${normalBotStake.toFixed(2)})
                        </span>
                        <span className="underline">Stop</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onRunSignalOnNormalBot({
                            market: snap.market,
                            contractType: snap.contractType,
                            prediction: snap.prediction,
                            signalEntryTrigger: snap.signalEntryTrigger,
                            stake,
                            martingale,
                            takeProfit,
                            stopLoss,
                            signalLabel: snap.signalLabel,
                          })
                        }
                        className="w-full py-2.5 px-4 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.99] text-sky-50 text-xs sm:text-sm font-bold text-left cursor-pointer transition-all shadow-xs"
                      >
                        Run this signal
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
                  {snap.recentDigits.map((d, idx) => {
                    const isPositiveTile =
                      category === 'even_odd'
                        ? snap.contractType === 'EVEN'
                          ? d % 2 === 0
                          : d % 2 !== 0
                        : category === 'over_under'
                        ? snap.contractType === 'OVER'
                          ? d > snap.prediction
                          : d < snap.prediction
                        : d === snap.hotDigit;

                    return (
                      <span
                        key={`${snap.market.id}-d-${idx}`}
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
