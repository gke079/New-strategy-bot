import { Volume2, VolumeX, Gauge, Wifi, Zap, RefreshCw, User, Sun, Moon, ShieldCheck } from 'lucide-react';
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
  isLoggedIn?: boolean;
  username?: string;
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
  isLoggedIn,
  username,
}) => {
  const handleLogin = () => {
    const affiliateId = localStorage.getItem('tickedge_deriv_affiliate_id') || '';
    const appId = localStorage.getItem('tickedge_deriv_app_id') || '1089';
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
    <header
      className={`sticky top-0 z-30 transition-colors backdrop-blur-md border-b px-4 py-3 ${
        theme === 'light'
          ? 'bg-white/95 text-neutral-900 border-neutral-200 shadow-sm'
          : 'bg-black/95 text-white border-neutral-850 shadow-md'
      }`}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                theme === 'light' ? 'bg-neutral-900' : 'bg-white'
              }`}
            />
            <span
              className={`absolute w-4 h-4 rounded-full animate-ping ${
                theme === 'light' ? 'bg-neutral-900/25' : 'bg-white/35'
              }`}
            />
          </div>
          <div className="flex items-baseline font-black tracking-tight text-xl select-none">
            <span className="text-[#FF0000] font-black drop-shadow-sm">
              Hope
            </span>
            <span className="text-[#0066FF] font-black ml-0.5 drop-shadow-sm">
              Lens
            </span>
          </div>

          {/* Connection status badge */}
          <div
            onClick={onOpenApiModal}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium cursor-pointer transition-colors border ${
              theme === 'light'
                ? connectionStatus === 'connected'
                  ? 'bg-neutral-100 text-emerald-700 border-emerald-300'
                  : connectionStatus === 'connecting'
                  ? 'bg-neutral-100 text-amber-700 border-amber-300'
                  : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                : connectionStatus === 'connected'
                ? 'bg-neutral-900 text-emerald-400 border-emerald-500/40'
                : connectionStatus === 'connecting'
                ? 'bg-neutral-900 text-amber-400 border-amber-500/40'
                : 'bg-neutral-900 text-neutral-300 border-neutral-800'
            }`}
            title="Click to configure Deriv API Connection"
          >
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>Deriv Live WS</span>
              </>
            ) : connectionStatus === 'connecting' ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                <span>Connecting Deriv WS...</span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3 text-rose-400" />
                <span>Deriv WS Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Tick Speed Selector */}
          <div
            className={`hidden md:flex items-center border rounded-lg p-0.5 text-xs font-mono ${
              theme === 'light'
                ? 'bg-neutral-100 border-neutral-300 text-neutral-700'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
            }`}
          >
            <span
              className={`px-1.5 flex items-center gap-1 text-[11px] ${
                theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
              }`}
            >
              <Gauge className="w-3 h-3" />
            </span>
            <button
              onClick={() => onChangeSpeed(1000)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                tickSpeedMs === 1000
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_8px_rgba(0,255,255,0.6)]'
                  : theme === 'light'
                  ? 'text-neutral-600 hover:text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              1s
            </button>
            <button
              onClick={() => onChangeSpeed(500)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                tickSpeedMs === 500
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_8px_rgba(0,255,255,0.6)]'
                  : theme === 'light'
                  ? 'text-neutral-600 hover:text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              0.5s
            </button>
            <button
              onClick={() => onChangeSpeed(200)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                tickSpeedMs === 200
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_8px_rgba(0,255,255,0.6)]'
                  : theme === 'light'
                  ? 'text-neutral-600 hover:text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Turbo
            </button>
          </div>

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg border transition-colors ${
              theme === 'light'
                ? 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200'
                : 'bg-neutral-900 text-white border-neutral-800 hover:bg-neutral-800'
            }`}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-800" />
            )}
          </button>

          {/* Sound toggle */}
          <button
            onClick={onToggleSound}
            className={`p-2 rounded-lg border transition-colors ${
              theme === 'light'
                ? soundEnabled
                  ? 'bg-neutral-200 text-emerald-700 border-neutral-300'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                : soundEnabled
                ? 'bg-neutral-850 text-emerald-400 border-neutral-750'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
            }`}
            title={soundEnabled ? 'Mute audio cues' : 'Enable audio cues'}
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* User Account / Virtual Balance & Settings */}
          <button
            onClick={onOpenAuthModal}
            className={`hidden sm:flex items-center gap-2 border px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              theme === 'light'
                ? 'bg-neutral-100 border-neutral-300 hover:bg-neutral-200 text-neutral-900'
                : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white'
            }`}
            title="Manage Balance & Affiliate ID"
          >
            <User
              className={`w-3.5 h-3.5 ${
                theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'
              }`}
            />
            <span
              className={`font-mono font-semibold ${
                theme === 'light' ? 'text-neutral-900' : 'text-white'
              }`}
            >
              $
              {userBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </button>

          {/* Prominent Login with Deriv button or Authorized badge */}
          {isLoggedIn ? (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-mono text-xs font-bold hover:bg-emerald-500/25 transition-all cursor-pointer shadow-sm"
              title="Deriv Account Connected - Click to view account"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{username || 'Connected'}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="px-3.5 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 shadow-[0_0_15px_rgba(255,68,79,0.4)] hover:shadow-[0_0_25px_rgba(255,68,79,0.65)] flex items-center gap-1.5 bg-gradient-to-r from-[#ff444f] via-[#e53945] to-[#cc2936] hover:from-[#ff555f] hover:to-[#ea3943] text-white active:scale-95 cursor-pointer border border-[#ff444f]/50"
              title="Log in directly with Deriv Official OAuth"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Login with Deriv</span>
            </button>
          )}

          {/* Sign up button -> Pure White */}
          <button
            onClick={handleSignUp}
            className="px-3.5 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center gap-1 bg-white hover:bg-neutral-100 text-black border border-neutral-300 active:scale-95"
            title="Sign up with Deriv Affiliate tracking link"
          >
            <span>Sign up</span>
          </button>

          {/* API button */}
          <button
            onClick={onOpenApiModal}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all border ${
              theme === 'light'
                ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
            }`}
            title="Deriv API Settings"
          >
            API
          </button>
        </div>
      </div>
    </header>
  );
};
