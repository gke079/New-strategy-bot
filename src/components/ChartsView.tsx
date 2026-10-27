import React, { useState, useRef, useEffect } from 'react';
import { Market, Tick } from '../types';
import { Market5mAnalysisSummary } from '../services/signalScannerEngine';
import {
  TrendingUp,
  Maximize2,
  Minimize2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react';

interface ChartsViewProps {
  ticks?: Tick[];
  market: Market;
  defaultTimePeriod?: '1m' | '2m' | '5m' | '15m';
  defaultCollapsed?: boolean;
  markets?: Market[];
  onSelectMarket?: (market: Market) => void;
  analysis5m?: Market5mAnalysisSummary | null;
}

export const ChartsView: React.FC<ChartsViewProps> = ({
  ticks = [],
  market,
  defaultTimePeriod = '5m',
  defaultCollapsed = false,
  markets,
  onSelectMarket,
  analysis5m,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [timePeriod, setTimePeriod] = useState<'1m' | '2m' | '5m' | '15m'>(defaultTimePeriod);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimePeriod(defaultTimePeriod);
  }, [defaultTimePeriod]);

  useEffect(() => {
    setIsLoading(true);
  }, [market.id, timePeriod]);

  const latestTick = ticks[ticks.length - 1];
  const currentSymbol = market.id;
  const derivTradingViewUrl = `https://charts.deriv.com/deriv?instrument=${currentSymbol}&timePeriod=${timePeriod}&chartType=candles`;

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const formatCountdown = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`bg-[#111827] border border-slate-800 rounded-2xl flex flex-col w-full shadow-2xl overflow-hidden transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen p-3 bg-[#080d16]' : 'p-3 sm:p-4'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-[#00e599]/10 border border-[#00e599]/25 flex items-center justify-center text-[#00e599] shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Deriv Advanced TradingView
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00e599]/15 text-[#00e599] font-bold border border-[#00e599]/30">
                {timePeriod.toUpperCase()} CANDLES
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-slate-300 font-semibold">{market.symbol}</span>
              <span>•</span>
              <span className="text-[#00e599] font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> 5m Candlestick Wicks + RSI(14) Analysis
              </span>
            </div>
          </div>

          {markets && onSelectMarket && (
            <select
              value={market.id}
              onChange={(e) => {
                const found = markets.find((m) => m.id === e.target.value);
                if (found) {
                  onSelectMarket(found);
                  if (isCollapsed) setIsCollapsed(false);
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#090d16] border border-slate-700 text-xs font-semibold text-white cursor-pointer focus:outline-none focus:border-[#00e599]"
            >
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name.replace(' Index', '')} ({m.id})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Timeframe Selector + Live Quote Ticker & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#090d16] border border-slate-800 p-1 rounded-xl">
            {(['1m', '2m', '5m', '15m'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => {
                  setTimePeriod(tf);
                  if (isCollapsed) setIsCollapsed(false);
                }}
                className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold cursor-pointer transition-colors ${
                  timePeriod === tf
                    ? 'bg-[#00e599] text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {latestTick && (
            <div className="flex items-center gap-2 bg-[#090d16] border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-[#00e599] animate-pulse" />
              <span className="text-white font-bold">{latestTick.quoteFormatted}</span>
              <span className="px-1.5 py-0.2 rounded bg-[#00e599] text-black font-black text-xs">
                {latestTick.lastDigit}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-[#090d16] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Reload Deriv TradingView"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00e599]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl bg-[#090d16] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Chart'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {!isFullscreen && (
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="p-2 rounded-xl bg-[#090d16] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              title={isCollapsed ? 'Expand TradingView Chart' : 'Minimize Chart'}
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="w-4 h-4 text-[#00e599]" />
                  <span className="text-xs font-semibold text-[#00e599] hidden sm:inline">Expand</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-400 hidden sm:inline">Minimize</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Live 5m Candlestick Wicks + RSI(14) + 10s Guard HUD when provided */}
      {analysis5m && (
        <div className="bg-[#090d16] border border-slate-800 rounded-xl px-3.5 py-2.5 mb-2 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono tabular-nums">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-sans font-bold text-slate-200">
              {analysis5m.market.name.replace(' Index', '')} (5m):
            </span>
            <span
              className={
                analysis5m.rsi5m < 50
                  ? 'text-emerald-400 font-bold'
                  : analysis5m.rsi5m > 50
                  ? 'text-fuchsia-400 font-bold'
                  : 'text-slate-300 font-bold'
              }
            >
              RSI(14): {analysis5m.rsi5m.toFixed(1)}{' '}
              {analysis5m.rsi5m < 50
                ? '(<50 · High Tick)'
                : analysis5m.rsi5m > 50
                ? '(>50 · Low Tick)'
                : '(=50)'}
            </span>
            <span className="text-slate-600">·</span>
            <span
              className={
                analysis5m.hasBothWicks
                  ? 'text-emerald-400 font-bold'
                  : 'text-amber-400 font-semibold'
              }
            >
              {analysis5m.hasBothWicks
                ? `Both Wicks ✔ (↑${analysis5m.upperWick} / ↓${analysis5m.lowerWick})`
                : `Awaiting Both Wicks (↑${analysis5m.upperWick} / ↓${analysis5m.lowerWick})`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={
                analysis5m.noTradeWindow
                  ? 'text-rose-400 font-extrabold'
                  : 'text-cyan-400 font-bold'
              }
            >
              {analysis5m.noTradeWindow
                ? `NO TRADE · ${analysis5m.secondsLeft}s left (≤10s)`
                : `5m Candle Left: ${formatCountdown(analysis5m.secondsLeft)}`}
            </span>
          </div>
        </div>
      )}

      {!isCollapsed ? (
        <>
          <div className="bg-[#090d16] border border-slate-800/80 rounded-xl px-3.5 py-2 mb-2 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#00e599] flex-shrink-0" />
              <span>
                Chart set to <strong>{timePeriod} Candlesticks</strong>. Click{' '}
                <strong>"fx Indicators" → RSI (Relative Strength Index)</strong> in the chart toolbar to overlay RSI visually alongside live scanner RSI(14).
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-slate-400 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Instrument: {market.id}</span>
            </div>
          </div>

          <div className="relative w-full flex-1 rounded-xl overflow-hidden border border-slate-800/90 bg-[#090d16] min-h-[440px] sm:min-h-[520px]">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#090d16]/95 backdrop-blur-sm">
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-t-[#00e599] animate-spin" />
                  <TrendingUp className="w-5 h-5 text-[#00e599] absolute" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">
                    Loading Deriv Advanced TradingView ({timePeriod} Candlesticks)...
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    Connecting to {market.symbol} ({market.id})
                  </div>
                </div>
              </div>
            )}

            <iframe
              key={`${currentSymbol}-${timePeriod}-${iframeKey}`}
              src={derivTradingViewUrl}
              title="Deriv Advanced TradingView"
              className="w-full h-full min-h-[440px] sm:min-h-[520px] border-0"
              onLoad={() => setIsLoading(false)}
              allow="fullscreen; clipboard-write; encrypted-media"
            />
          </div>
        </>
      ) : (
        <div
          onClick={() => setIsCollapsed(false)}
          className="py-2.5 px-3 bg-[#090d16] hover:bg-slate-900/60 border border-slate-800/60 rounded-xl cursor-pointer flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-[#00e599]" />
            <span>
              Deriv Advanced TradingView ({timePeriod} Candlesticks + RSI) minimized for {market.symbol}.
            </span>
          </div>
          <span className="text-[#00e599] font-medium flex items-center gap-1">
            Click to expand chart <ChevronDown className="w-3.5 h-3.5" />
          </span>
        </div>
      )}
    </div>
  );
};
