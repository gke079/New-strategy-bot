import React from 'react';
import { Volume2, VolumeX, Gauge, Wifi, Zap, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '../services/tickEngine';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  soundEnabled: boolean;
  onToggleSound: () => void;
  tickSpeedMs: number;
  onChangeSpeed: (speedMs: number) => void;
  onOpenApiModal: () => void;
  onOpenAuthModal: () => void;
  userBalance: number;
  isDemo: boolean;
  onResetBuffer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  soundEnabled,
  onToggleSound,
  tickSpeedMs,
  onChangeSpeed,
  onOpenApiModal,
  onOpenAuthModal,
  userBalance,
  isDemo,
  onResetBuffer,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#090d16]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="absolute w-4 h-4 rounded-full bg-rose-500/30 animate-ping"></span>
          </div>
          <div className="flex items-baseline font-bold tracking-tight text-xl">
            <span className="text-white">Tick</span>
            <span className="text-[#00e599]">Edge</span>
          </div>

          {/* Connection status badge */}
          <div
            onClick={onOpenApiModal}
            className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-medium cursor-pointer transition-colors ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                : connectionStatus === 'connecting'
                ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                : 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/30'
            }`}
            title="Click to configure Deriv API / Simulation"
          >
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>Live WS</span>
              </>
            ) : connectionStatus === 'connecting' ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>Sim Engine</span>
              </>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Tick Speed Selector */}
          <div className="hidden md:flex items-center bg-[#111827] border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <span className="text-slate-400 px-1.5 flex items-center gap-1 text-[11px]">
              <Gauge className="w-3 h-3" />
            </span>
            <button
              onClick={() => onChangeSpeed(1000)}
              className={`px-2 py-1 rounded transition-colors ${
                tickSpeedMs === 1000 ? 'bg-[#00e599] text-black font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              1s
            </button>
            <button
              onClick={() => onChangeSpeed(500)}
              className={`px-2 py-1 rounded transition-colors ${
                tickSpeedMs === 500 ? 'bg-[#00e599] text-black font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              0.5s
            </button>
            <button
              onClick={() => onChangeSpeed(200)}
              className={`px-2 py-1 rounded transition-colors ${
                tickSpeedMs === 200 ? 'bg-[#00e599] text-black font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Turbo
            </button>
          </div>

          {/* Sound toggle */}
          <button
            onClick={onToggleSound}
            className={`p-2 rounded-lg border transition-colors ${
              soundEnabled
                ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/40'
                : 'bg-[#111827] text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title={soundEnabled ? 'Mute audio cues' : 'Enable audio cues'}
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* User Account / Virtual Balance */}
          <button
            onClick={onOpenAuthModal}
            className="hidden sm:flex items-center gap-2 bg-[#111827] border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
          >
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {isDemo ? 'Demo' : 'Real'}
            </span>
            <span className="font-mono font-semibold text-slate-100">${userBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </button>

          {/* Log in button (matches screenshot teal border/accent) */}
          <button
            onClick={onOpenAuthModal}
            className="px-3.5 py-1.5 rounded-lg bg-[#00e599]/10 text-[#00e599] border border-[#00e599]/40 hover:bg-[#00e599]/20 font-medium text-xs sm:text-sm transition-all"
          >
            Log in
          </button>

          {/* Sign up button */}
          <button
            onClick={onOpenAuthModal}
            className="hidden sm:block px-3.5 py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium text-xs sm:text-sm transition-all"
          >
            Sign up
          </button>

          {/* API button (matches screenshot) */}
          <button
            onClick={onOpenApiModal}
            className="px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-700 font-medium text-xs sm:text-sm transition-all flex items-center gap-1.5"
            title="Deriv API Settings"
          >
            API
          </button>
        </div>
      </div>
    </header>
  );
};
