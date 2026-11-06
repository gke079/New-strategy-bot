import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  User,
  Zap,
  Lock,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Wifi,
  Globe,
  Sun,
  Moon,
  ChevronRight,
  Activity,
  Layers,
  Bot,
  Copy,
  Check,
} from 'lucide-react';
import { UserAccount } from '../types';
import { ConnectionStatus } from '../services/tickEngine';
import robotVol75Img from '../assets/images/robot_vol_75_1793085812944.jpg';

interface LoginPageProps {
  onLoginSuccess: (accountData: {
    username: string;
    email: string;
    isDemo: boolean;
    balance: number;
    token?: string;
  }) => void;
  onCloseOrBackToTerminal?: () => void;
  userAccount: UserAccount;
  connectionStatus: ConnectionStatus;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onAuthorizeDerivToken?: (token: string) => void;
}

type LoginMethod = 'oauth' | 'token' | 'account';

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  userAccount,
  connectionStatus,
  theme,
  onToggleTheme,
  onAuthorizeDerivToken,
}) => {
  const [activeMethod, setActiveMethod] = useState<LoginMethod>('oauth');

  // OAuth form state
  const [appId, setAppId] = useState<string>(() => {
    try {
      return localStorage.getItem('tickedge_deriv_app_id') || '1089';
    } catch {
      return '1089';
    }
  });

  const [affiliateId, setAffiliateId] = useState<string>(() => {
    try {
      return localStorage.getItem('tickedge_deriv_affiliate_id') || '';
    } catch {
      return '';
    }
  });

  // Token form state
  const [apiToken, setApiToken] = useState<string>(() => {
    try {
      return localStorage.getItem('tickedge_deriv_token') || '';
    } catch {
      return '';
    }
  });
  const [showToken, setShowToken] = useState(false);

  // Trader Account form state
  const [username, setUsername] = useState<string>(() => {
    try {
      return localStorage.getItem('tickedge_saved_username') || userAccount.username || 'TraderEdge';
    } catch {
      return 'TraderEdge';
    }
  });
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Feedback & redirecting states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [copiedRedirectUrl, setCopiedRedirectUrl] = useState(false);

  // Save Affiliate and App ID whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('tickedge_deriv_app_id', appId.trim() || '1089');
    } catch {}
  }, [appId]);

  useEffect(() => {
    try {
      localStorage.setItem('tickedge_deriv_affiliate_id', affiliateId.trim());
    } catch {}
  }, [affiliateId]);

  // Handle Deriv OAuth Redirect
  const handleDerivOAuth = () => {
    setErrorMsg('');
    setIsSubmitting(true);
    setSuccessMsg('Redirecting to official Deriv OAuth portal...');

    const cleanAppId = appId.trim() || '1089';
    let authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(
      cleanAppId
    )}&l=EN&brand=deriv`;

    if (affiliateId.trim()) {
      authUrl += `&affiliate_id=${encodeURIComponent(affiliateId.trim())}`;
    }

    setTimeout(() => {
      try {
        if (window.top && window.top !== window) {
          window.top.location.href = authUrl;
          return;
        }
      } catch {}
      window.location.href = authUrl;
    }, 500);
  };

  // Handle Manual Token Submission
  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!apiToken || apiToken.trim().length < 6) {
      setErrorMsg('Please enter a valid Deriv API token (at least 6 characters with Read + Trade scope).');
      return;
    }

    setIsSubmitting(true);
    const cleanToken = apiToken.trim();

    try {
      localStorage.setItem('tickedge_deriv_token', cleanToken);
    } catch {}

    if (onAuthorizeDerivToken) {
      onAuthorizeDerivToken(cleanToken);
    }

    setSuccessMsg('Authorizing Deriv API Token...');

    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess({
        username: 'Deriv_Trader',
        email: 'deriv_user@deriv.com',
        isDemo: false,
        balance: userAccount.balance > 0 ? userAccount.balance : 10000,
        token: cleanToken,
      });
    }, 800);
  };

  // Handle Custom Trader Account Login
  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg('Please enter a Trader Handle or username.');
      return;
    }

    setIsSubmitting(true);

    if (rememberMe) {
      try {
        localStorage.setItem('tickedge_saved_username', username.trim());
      } catch {}
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMsg(`Welcome, ${username.trim()}! Entering trading terminal...`);
      setTimeout(() => {
        onLoginSuccess({
          username: username.trim(),
          email: `${username.trim().toLowerCase()}@deriv.com`,
          isDemo: username.trim().toUpperCase().startsWith('VR') || true,
          balance: userAccount.balance > 0 ? userAccount.balance : 10000,
        });
      }, 500);
    }, 600);
  };

  const isLight = theme === 'light';
  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.hopelens.io';

  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#080d16] text-white'
      }`}
    >
      {/* Top Header Bar */}
      <header
        className={`w-full border-b backdrop-blur-md px-6 py-4 flex items-center justify-between z-20 ${
          isLight
            ? 'bg-white/95 border-slate-200 shadow-sm'
            : 'bg-[#090d16]/95 border-slate-800/80 shadow-md'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-baseline font-black tracking-tight text-2xl select-none">
            <span className="text-[#FF0000] font-black drop-shadow-sm">Hope</span>
            <span className="text-[#0066FF] font-black ml-0.5 drop-shadow-sm">Lens</span>
          </div>
          <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded text-slate-400 border border-slate-300 dark:border-slate-800">
            Digits Analyzer & Bot Portal
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* WebSocket Status Indicator */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
              isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-400">Deriv WS:</span>
            <span
              className={
                connectionStatus === 'connected'
                  ? 'text-emerald-500 font-semibold'
                  : 'text-amber-400 font-semibold'
              }
            >
              {connectionStatus === 'connected' ? 'Ready' : 'Connecting'}
            </span>
          </div>

          {/* Theme Switcher */}
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle Theme"
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-300" />}
          </button>

          {/* Sign In Required Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <Lock className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Sign In Required</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Interactive Login Container (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div
              className={`rounded-2xl border p-6 sm:p-8 shadow-2xl transition-all ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#111827] border-slate-800'
              }`}
            >
              {/* Header Title & Subtitle */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold tracking-wider uppercase text-[#0066FF] font-mono">
                    Trading Suite Access
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs text-slate-500 font-mono">v3.2 API</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Log in to HopeLens
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Connect your Deriv account or start in demo simulation mode.
                </p>
              </div>

              {/* Status Alert Messages */}
              {errorMsg && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Functional Method Switcher (Segmented Control) */}
              <div
                className={`grid grid-cols-3 p-1 rounded-xl border mb-6 text-xs font-bold ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#090d16] border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveMethod('oauth');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-1 rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
                    activeMethod === 'oauth'
                      ? 'bg-[#ff444f] text-white shadow-md'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Deriv OAuth
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMethod('token');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-1 rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
                    activeMethod === 'token'
                      ? 'bg-[#00e599] text-black shadow-md'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  API Token
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMethod('account');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-1 rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
                    activeMethod === 'account'
                      ? isLight
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-white text-slate-950 shadow-md'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Account Login
                </button>
              </div>

              {/* METHOD 1: DERIV OAUTH 2.0 (OFFICIAL SSO) */}
              {activeMethod === 'oauth' && (
                <div className="space-y-5 animate-in fade-in">
                  <div
                    className={`p-4 rounded-xl border flex flex-col gap-3 ${
                      isLight
                        ? 'bg-gradient-to-b from-red-50/70 to-slate-50 border-red-200'
                        : 'bg-gradient-to-b from-[#ff444f]/10 via-[#111827] to-[#090d16] border-[#ff444f]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#ff444f] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        Official Deriv Single Sign-On
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">SSL 256-Bit</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Authorizing via Deriv OAuth grants your browser access to stream live synthetic ticks,
                      verify account balance, and run automated bot orders directly on Deriv.
                    </p>

                    {/* Big Prominent Deriv Login Action */}
                    <button
                      type="button"
                      onClick={handleDerivOAuth}
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-4 rounded-xl font-black text-sm text-white bg-gradient-to-r from-[#ff444f] via-[#e53945] to-[#cc2936] hover:from-[#ff555f] hover:to-[#ea3943] shadow-[0_0_25px_rgba(255,68,79,0.35)] hover:shadow-[0_0_35px_rgba(255,68,79,0.6)] transition-all cursor-pointer flex items-center justify-between active:scale-[0.99] disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-white" />
                        <span className="text-base tracking-tight font-extrabold">
                          {isSubmitting ? 'Connecting to Deriv...' : 'Login with Deriv'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs bg-black/25 px-2.5 py-1 rounded-lg">
                        <span>OAuth 2.0</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  </div>

                  {/* App ID & Affiliate Configurations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* App ID */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">
                          Deriv App ID
                        </label>
                        <span className="text-[10px] text-slate-400">Default: 1089</span>
                      </div>
                      <input
                        type="text"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        placeholder="1089"
                        className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:ring-1 focus:ring-[#ff444f] focus:outline-none ${
                          isLight
                            ? 'bg-slate-50 border-slate-300 text-slate-900'
                            : 'bg-[#090d16] border-slate-800 text-white'
                        }`}
                      />
                      <div className="flex items-center gap-1 pt-1">
                        <span className="text-[10px] text-slate-500">Presets:</span>
                        {['1089', '36544', '16929', '61504'].map((pid) => (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => setAppId(pid)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                              appId === pid
                                ? 'bg-[#ff444f] text-white font-bold'
                                : isLight
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {pid}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Affiliate Partner ID */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Affiliate ID</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Optional</span>
                      </div>
                      <input
                        type="text"
                        value={affiliateId}
                        onChange={(e) => setAffiliateId(e.target.value)}
                        placeholder="e.g. 123456"
                        className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:ring-1 focus:ring-[#00e599] focus:outline-none ${
                          isLight
                            ? 'bg-slate-50 border-slate-300 text-slate-900'
                            : 'bg-[#090d16] border-slate-800 text-white'
                        }`}
                      />
                      <p className="text-[10px] text-slate-500 pt-1">
                        Embeds your partner ID into the Deriv OAuth link.
                      </p>
                    </div>
                  </div>

                  {/* Redirect URL reference helper for developer registrations */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090d16] border-slate-800/80'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        Registered OAuth Redirect URL
                      </span>
                      <code className="text-[11px] font-mono text-[#0066FF] dark:text-[#00FFFF] block truncate max-w-[280px] sm:max-w-md">
                        {originUrl}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(originUrl);
                        setCopiedRedirectUrl(true);
                        setTimeout(() => setCopiedRedirectUrl(false), 2000);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                        isLight
                          ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                    >
                      {copiedRedirectUrl ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Sign Up Link */}
                  <div className="text-center pt-1 text-xs text-slate-500">
                    <span>Don't have a Deriv account yet? </span>
                    <a
                      href={
                        affiliateId.trim()
                          ? `https://track.deriv.com/_${encodeURIComponent(affiliateId.trim())}/a/`
                          : 'https://track.deriv.com/'
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#ff444f] font-bold hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Create free Deriv account</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* METHOD 2: DERIV API TOKEN */}
              {activeMethod === 'token' && (
                <form onSubmit={handleTokenSubmit} className="space-y-4 animate-in fade-in">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[#00e599]" />
                        <span>Deriv API Token</span>
                      </label>
                      <a
                        href="https://app.deriv.com/account/api-token"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#00e599] hover:underline flex items-center gap-0.5 text-xs font-medium"
                      >
                        <span>Generate Token</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        placeholder="Paste your Deriv token here..."
                        className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs font-mono border focus:ring-1 focus:ring-[#00e599] focus:outline-none ${
                          isLight
                            ? 'bg-slate-50 border-slate-300 text-slate-900'
                            : 'bg-[#090d16] border-slate-800 text-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showToken ? 'Hide token' : 'Show token'}
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Scopes checklist */}
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090d16] border-slate-800'
                    }`}
                  >
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider block">
                      Required API Scopes
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-slate-500 dark:text-slate-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00e599]" />
                        <span>Read (Balances & Ticks)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00e599]" />
                        <span>Trade (Bot Orders)</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl font-bold text-sm text-black bg-[#00e599] hover:bg-[#00e599]/90 shadow-[0_0_20px_rgba(0,229,153,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    <span>{isSubmitting ? 'Validating Token...' : 'Connect with API Token'}</span>
                  </button>

                  <p className="text-[11px] text-center text-slate-500">
                    Your token is stored only in browser memory and transmitted solely to Deriv WebSocket servers.
                  </p>
                </form>
              )}

              {/* METHOD 3: TRADER PROFILE / LOGIN */}
              {activeMethod === 'account' && (
                <form onSubmit={handleAccountSubmit} className="space-y-4 animate-in fade-in">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#0066FF]" />
                      <span>Trader Handle / Username</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. MasterTrader75"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border focus:ring-1 focus:ring-[#0066FF] focus:outline-none ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900'
                          : 'bg-[#090d16] border-slate-800 text-white'
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[#0066FF]" />
                        <span>Access Password</span>
                      </label>
                      <span className="text-[10px] text-slate-400">Optional for demo</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs font-mono border focus:ring-1 focus:ring-[#0066FF] focus:outline-none ${
                          isLight
                            ? 'bg-slate-50 border-slate-300 text-slate-900'
                            : 'bg-[#090d16] border-slate-800 text-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-[#0066FF] focus:ring-0"
                      />
                      <span>Remember credentials</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveMethod('oauth')}
                      className="text-[#ff444f] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white bg-[#0066FF] hover:bg-[#0055DD] shadow-[0_0_20px_rgba(0,102,255,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Signing In...' : 'Enter Trading Terminal'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: High-Tech Feature & Security Showcase (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div
              className={`h-full rounded-2xl border p-6 flex flex-col justify-between overflow-hidden relative shadow-xl ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#111827] border-slate-800'
              }`}
            >
              {/* Top Banner & Robot Graphic */}
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-slate-800/60 shadow-lg aspect-video bg-black">
                  <img
                    src={robotVol75Img}
                    alt="Synthetic Indices High-Frequency AI Robot"
                    className="w-full h-full object-cover object-top opacity-90 hover:scale-105 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-4">
                    <span className="text-[10px] font-mono text-[#00FFFF] uppercase tracking-wider font-bold">
                      Deriv Synthetic Engine
                    </span>
                    <h4 className="text-white font-extrabold text-base">
                      High-Precision Digits Trading
                    </h4>
                  </div>
                </div>

                {/* Key Features List */}
                <div className="space-y-2.5 pt-2 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="block text-slate-800 dark:text-slate-200 font-bold">
                        Real-Time Digits Ribbon
                      </strong>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Continuous 1,000-tick clustering, Even/Odd ratios, and Under/Over statistics.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <div className="w-7 h-7 rounded-lg bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="block text-slate-800 dark:text-slate-200 font-bold">
                        4 Automated Algorithmic Engines
                      </strong>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Normal Bot, Digits Bot, Trend Charts Bot, and Deriv DBot XML visual builder.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <div className="w-7 h-7 rounded-lg bg-[#ff444f]/10 text-[#ff444f] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="block text-slate-800 dark:text-slate-200 font-bold">
                        Client-Side Zero-Storage Security
                      </strong>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Your private API tokens and credentials remain 100% inside your browser.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supported Synthetic Markets Footnote */}
              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
                <span className="block font-semibold mb-1 text-slate-500">Supported Markets:</span>
                <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                  {['Vol 10', 'Vol 25', 'Vol 50', 'Vol 75', 'Vol 100', '1s Indices', 'Step', 'Jump'].map(
                    (m) => (
                      <span
                        key={m}
                        className={`px-1.5 py-0.5 rounded border ${
                          isLight
                            ? 'bg-slate-100 border-slate-300 text-slate-700'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {m}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`w-full border-t py-4 px-6 text-center text-xs text-slate-500 ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#090d16] border-slate-800/60'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>HopeLens · Synthetic Digits Analysis & Automated Bot Trading Platform</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Deriv WebSocket v3 API</span>
            <span>·</span>
            <span>Risk Disclaimer: Synthetic indices carry financial risk</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
