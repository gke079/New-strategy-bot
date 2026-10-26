import React, { useState, useRef } from 'react';
import { Market, Tick } from '../types';
import {
  TrendingUp,
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react';

interface ChartsViewProps {
  ticks: Tick[];
  market: Market;
}

export const ChartsView: React.FC<ChartsViewProps> = ({ ticks, market }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Latest tick for live HUD
  const latestTick = ticks[ticks.length - 1];

  // Map market ID to Deriv TradingView symbol
  const getDerivSymbol = (id: string) => {
    return id;
  };

  const currentSymbol = getDerivSymbol(market.id);
  const derivTradingViewUrl = `https://charts.deriv.com/deriv?instrument=${currentSymbol}&timePeriod=1m`;

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

  return (
    <div
      ref={containerRef}
      className={`bg-[#111827] border border-slate-800 rounded-2xl flex flex-col w-full shadow-2xl overflow-hidden transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen p-3 bg-[#080d16]' : 'p-3 sm:p-4'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00e599]/10 border border-[#00e599]/25 flex items-center justify-center text-[#00e599]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Deriv Advanced TradingView
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00e599]/15 text-[#00e599] font-bold border border-[#00e599]/30">
                {market.symbol}
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="font-mono text-slate-300 font-semibold">{market.symbol}</span>
              <span>•</span>
              <span className="text-[#00e599] font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Full Technical Indicators Suite
              </span>
            </div>
          </div>
        </div>

        {/* Live Quote Ticker & Controls */}
        <div className="flex items-center gap-2">
          {latestTick && (
            <div className="flex items-center gap-2 bg-[#090d16] border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-[#00e599] animate-pulse" />
              <span className="text-white font-bold">{latestTick.quoteFormatted}</span>
              <span className="px-1.5 py-0.2 rounded bg-[#00e599] text-black font-black text-xs">
                {latestTick.lastDigit}
              </span>
            </div>
          )}

          {/* Refresh Frame */}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-[#090d16] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Reload Deriv TradingView"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00e599]' : ''}`} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl bg-[#090d16] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Chart'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Open in external window */}
          <a
            href={derivTradingViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-[#090d16] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Open in new window"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Minimize / Expand Toggle */}
          {!isFullscreen && (
            <button
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="p-2 rounded-xl bg-[#090d16] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1"
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

      {!isCollapsed ? (
        <>
          {/* Helpful Instructions Banner */}
          <div className="bg-[#090d16] border border-slate-800/80 rounded-xl px-3.5 py-2 mb-2 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#00e599] flex-shrink-0" />
              <span>
                Use the <strong>"fx Indicators"</strong> button inside the top chart toolbar to add RSI, MACD, Bollinger Bands, Moving Averages, and drawing tools.
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Active Instrument: {market.id}</span>
            </div>
          </div>

          {/* Main Deriv Advanced TradingView Iframe Container */}
          <div className="relative w-full flex-1 rounded-xl overflow-hidden border border-slate-800/90 bg-[#090d16] min-h-[500px] sm:min-h-[580px]">
            {/* Skeleton Loader during iframe loading */}
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#090d16]/95 backdrop-blur-sm">
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-t-[#00e599] animate-spin" />
                  <TrendingUp className="w-5 h-5 text-[#00e599] absolute" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">Loading Deriv Advanced TradingView...</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    Connecting to {market.symbol} ({market.id})
                  </div>
                </div>
              </div>
            )}

            {/* Official Deriv TradingView Chart Embed */}
            <iframe
              key={`${currentSymbol}-${iframeKey}`}
              src={derivTradingViewUrl}
              title="Deriv Advanced TradingView"
              className="w-full h-full min-h-[500px] sm:min-h-[580px] border-0"
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
            <span>TradingView chart minimized for {market.symbol}.</span>
          </div>
          <span className="text-[#00e599] font-medium flex items-center gap-1">
            Click to expand chart <ChevronDown className="w-3.5 h-3.5" />
          </span>
        </div>
      )}
    </div>
  );
};
