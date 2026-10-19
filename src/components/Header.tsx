import React from 'react';
import { Volume2, VolumeX, Gauge, Wifi, Zap, RefreshCw, User, Sun, Moon } from 'lucide-react';
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
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
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
  theme,
  onToggleTheme,
}) => {
  const handleLogin = () => {
    const affiliateId = localStorage.getItem('tickedge_deriv_affiliate_id') || '';
    const appId = '1089';
    let authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&brand=deriv`;
    if (affiliateId.trim()) {
      authUrl += `&affiliate_id=${encodeURIComponent(affiliateId.trim())}`;
    }
    window.location.href = authUrl;
  };

  const handleSignUp = () => {
    const affiliateId = localStorage.getItem('tickedge_deriv_affiliate_id') || '';
    if (affiliateId.trim()) {
      window.location.href = `https://track.deriv.com/_${encodeURIComponent(affiliateId.trim())}/a/`;
    } else {
      window.location.href = 'https://track.deriv.com/';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#090d16]/95 light-mode:bg-white/95 backdrop-blur-md border-b border-slate-800/80 light-mode:border-slate-200 px-4 py-3 transition-colors">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="absolute w-4 h-4 rounded-full bg-rose-500/30 animate-ping"></span>
          </div>
          <div className="flex items-baseline font-bold tracking-tight text-xl">
            <span className="text-white light-mode:text-slate-900">Tick</span>
            <span className="text-[#00e599]">Edge</span>
          </div>

          {/* Connection status badge */}
          <div
            onClick={onOpenApiModal}
            className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-medium cursor-pointer transition-colors ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950/60 light-mode:bg-emerald-50 text-emerald-400 light-mode:text-emerald-700 border border-emerald-500/30'
                : connectionStatus === 'connecting'
                ? 'bg-amber-950/60 light-mode:bg-amber-50 text-amber-400 light-mode:text-amber-700 border border-amber-500/30'
                : 'bg-cyan-950/60 light-mode:bg-cyan-50 text-cyan-400 light-mode:text-cyan-700 border border-cyan-500/30'
            }`}
            title="Click to configure Deriv API / Simulation"
          >
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400 light-mode:text-emerald-600" />
                <span>Live WS</span>
              </>
            ) : connectionStatus === 'connecting' ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400 light-mode:text-amber-600" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 text-cyan-400 light-mode:text-cyan-600" />
                <span>Sim Engine</span>
              </>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Tick Speed Selector */}
          <div className="hidden md:flex items-center bg-[#111827] light-mode:bg-slate-100 border border-slate-800 light-mode:border-slate-200 rounded-lg p-0.5 text-xs font-mono">
            <span className="text-slate-400 light-mode:text-slate-600 px-1.5 flex items-center gap-1 text-[11px]">
              <Gauge className="w-3 h-3" />
            </span>
            <button
              onClick={() => onChangeSpeed(1000)}
              className={`px-2 py-1 rounded transition-colors ${
                tickSpeedMs === 1000 ? 'bg-[#00e599] text-black font-semibold' : 'text-slate-400 light-mode:text-slate-600 hover:text-white light-mode:hover:text-slate-900'
              }`}
            >
              1s
            </button>
            <button
              onClick={() => onChangeSpeed(500)}
              className={`px-2 py-1 rounded transition-colors ${
                tickSpeedMs === 500 ? 'bg-[#00e599] text-black font-semibold' : 'text-slate-400 light-mode:text-slate-600 hover:text-white light-mode:hover:text-slate-900'
              }`}
            >
              0.5s
            </button>
            <button
              onClick={() => onChangeSpeed(200)}
              className={`px-2 py-1 rounded transition-colors ${
                tickSpeedMs === 200 ? 'bg-[#00e599] text-black font-semibold' : 'text-slate-400 light-mode:text-slate-600 hover:text-white light-mode:hover:text-slate-900'
              }`}
            >
              Turbo
            </button>
          </div>

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-[#111827] light-mode:bg-slate-100 text-slate-300 light-mode:text-slate-700 border border-slate-800 light-mode:border-slate-200 hover:border-slate-700 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Sound toggle */}
          <button
            onClick={onToggleSound}
            className={`p-2 rounded-lg border transition-colors ${
              soundEnabled
                ? 'bg-slate-800/80 light-mode:bg-emerald-50 text-emerald-400 light-mode:text-emerald-700 border-emerald-500/40'
                : 'bg-[#111827] light-mode:bg-slate-100 text-slate-400 light-mode:text-slate-600 border-slate-800 light-mode:border-slate-200 hover:text-slate-200'
            }`}
            title={soundEnabled ? 'Mute audio cues' : 'Enable audio cues'}
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* User Account / Virtual Balance & Settings */}
          <button
            onClick={onOpenAuthModal}
            className="hidden sm:flex items-center gap-2 bg-[#111827] light-mode:bg-slate-100 border border-slate-800 light-mode:border-slate-200 hover:border-slate-700 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
            title="Manage Balance & Affiliate ID"
          >
            <User className="w-3.5 h-3.5 text-[#00e599]" />
            <span className="font-mono font-semibold text-slate-100 light-mode:text-slate-900">${userBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </button>

          {/* Log in button -> Direct Deriv OAuth redirect */}
          <button
            onClick={handleLogin}
            className="px-3.5 py-1.5 rounded-lg bg-[#00e599]/10 text-[#00e599] border border-[#00e599]/40 hover:bg-[#00e599]/20 font-medium text-xs sm:text-sm transition-all shadow-sm"
            title="Log in directly with Deriv Official OAuth"
          >
            Log in
          </button>

          {/* Sign up button -> Direct Deriv Affiliate Signup */}
          <button
            onClick={handleSignUp}
            className="px-3.5 py-1.5 rounded-lg bg-[#00e599] light-mode:bg-[#00e599] hover:bg-[#00e599]/90 text-black font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center gap-1"
            title="Sign up with Deriv Affiliate tracking link"
          >
            <span>Sign up</span>
          </button>

          {/* API button */}
          <button
            onClick={onOpenApiModal}
            className="px-3 py-1.5 rounded-lg bg-[#111827] light-mode:bg-slate-100 hover:bg-slate-800 light-mode:hover:bg-slate-200 text-slate-300 light-mode:text-slate-800 border border-slate-700 light-mode:border-slate-200 font-medium text-xs sm:text-sm transition-all"
            title="Deriv API Settings"
          >
            API
          </button>
        </div>
      </div>
    </header>
  );
};
