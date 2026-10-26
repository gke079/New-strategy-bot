import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Key,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Lock,
  DollarSign,
  ArrowRight,
  Sparkles,
  Zap,
  Globe,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { UserAccount } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAccount: UserAccount;
  onUpdateAccount: (account: Partial<UserAccount>) => void;
  onResetBalance: (amount: number) => void;
  onAuthorizeDerivToken?: (token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  userAccount,
  onUpdateAccount,
  onResetBalance,
  onAuthorizeDerivToken,
}) => {
  const [activeTab, setActiveTab] = useState<'deriv_auth' | 'affiliate' | 'profile'>('deriv_auth');
  const [username, setUsername] = useState(userAccount.username);
  const [apiToken, setApiToken] = useState(() => {
    try {
      return localStorage.getItem('tickedge_deriv_token') || '';
    } catch {
      return '';
    }
  });
  const [appId, setAppId] = useState<string>(() => {
    try {
      return localStorage.getItem('tickedge_deriv_app_id') || '1089';
    } catch {
      return '1089';
    }
  });
  const [affiliateId, setAffiliateId] = useState(() => {
    try {
      return localStorage.getItem('tickedge_deriv_affiliate_id') || '';
    } catch {
      return '';
    }
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [authError, setAuthError] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        const savedAppId = localStorage.getItem('tickedge_deriv_app_id');
        if (savedAppId) setAppId(savedAppId);
        const savedToken = localStorage.getItem('tickedge_deriv_token');
        if (savedToken) setApiToken(savedToken);
        const savedAff = localStorage.getItem('tickedge_deriv_affiliate_id');
        if (savedAff) setAffiliateId(savedAff);
      } catch {}
      setAuthError('');
      setIsRedirecting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('tickedge_deriv_affiliate_id', affiliateId);
    } catch {}
  }, [affiliateId]);

  useEffect(() => {
    try {
      localStorage.setItem('tickedge_deriv_app_id', appId.trim() || '1089');
    } catch {}
  }, [appId]);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    onUpdateAccount({ username });
    setSuccessMsg('Account preferences saved!');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleReset = (amount: number) => {
    onResetBalance(amount);
    setSuccessMsg(`Virtual demo balance reset to $${amount.toLocaleString()}`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  /**
   * Initiates the official Deriv OAuth 2.0 flow.
   * Redirects the user to the official Deriv OAuth endpoint with the configured App ID and affiliate ID.
   * Deriv prompts the user to log in and redirects back with:
   * ?acct1=CRxxxx&token1=xxxx&cur1=USD&acct2=VRTCxxxx&token2=xxxx
   */
  const handleDerivOAuthRedirect = () => {
    const cleanAppId = appId.trim() || '1089';
    setIsRedirecting(true);
    setSuccessMsg('Redirecting to official Deriv OAuth login...');

    let authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(cleanAppId)}&l=EN&brand=deriv`;
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
    }, 400);
  };

  const handleManualTokenAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!apiToken || apiToken.trim().length < 6) {
      setAuthError('Please enter a valid Deriv API token (at least 6 characters).');
      return;
    }

    try {
      localStorage.setItem('tickedge_deriv_token', apiToken.trim());
    } catch {}

    onUpdateAccount({
      isLoggedIn: true,
      email: 'deriv_user@auth.deriv.com',
    });

    if (onAuthorizeDerivToken) {
      onAuthorizeDerivToken(apiToken.trim());
    }

    setSuccessMsg('Successfully applied Deriv API token! Authorizing live account...');
    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
  };

  const handleLogout = () => {
    onUpdateAccount({ isLoggedIn: false });
    setApiToken('');
    try {
      localStorage.removeItem('tickedge_deriv_token');
    } catch {}
    if (onAuthorizeDerivToken) {
      onAuthorizeDerivToken('');
    }
    setSuccessMsg('Logged out of Deriv account. Virtual simulation active.');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ff444f]/15 border border-[#ff444f]/30 flex items-center justify-center text-[#ff444f]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Deriv Account & Authentication</h3>
              <p className="text-xs text-slate-400">Official OAuth Login & Token Authorization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="flex border-b border-slate-800 px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('deriv_auth')}
            className={`py-2.5 border-b-2 mr-3 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'deriv_auth'
                ? 'border-[#00FFFF] text-[#00FFFF] font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Deriv OAuth Login</span>
          </button>
          <button
            onClick={() => setActiveTab('affiliate')}
            className={`py-2.5 border-b-2 mr-3 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'affiliate'
                ? 'border-[#00FFFF] text-[#00FFFF] font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Affiliate Partner</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#00FFFF] text-[#00FFFF] font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Demo Balance</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {authError && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {activeTab === 'deriv_auth' ? (
            <div className="space-y-4">
              {/* If Logged In: Account Overview Card */}
              {userAccount.isLoggedIn ? (
                <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Connection Status</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        userAccount.isDemo
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {userAccount.isDemo ? 'Virtual Demo Account' : 'Live Real Account'}
                    </span>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Deriv Login ID:</span>
                      <strong className="text-white font-mono text-sm bg-slate-800/80 px-2 py-0.5 rounded">
                        {userAccount.username}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Account Balance:</span>
                      <strong className="text-[#00e599] font-mono text-base font-bold">
                        ${userAccount.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        {userAccount.currency || 'USD'}
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={handleDerivOAuthRedirect}
                      disabled={isRedirecting}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-[#ff444f]" />
                      <span>Switch Account / Re-login with Deriv</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect Deriv Account</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Hero Login with Deriv Container */
                <div className="space-y-4">
                  {/* PROMINENT LOGIN WITH DERIV CALLOUT */}
                  <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-b from-[#ff444f]/15 via-[#111827] to-[#090d16] border border-[#ff444f]/40 shadow-xl flex flex-col gap-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#ff444f]/20 border border-[#ff444f]/40 text-[#ff444f] text-[10px] font-bold uppercase tracking-wider">
                          Official OAuth 2.0
                        </span>
                        {affiliateId && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Partner Linked
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">App ID: {appId || '1089'}</span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-white font-bold text-sm leading-snug">
                        Authorize with your Deriv Account
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Log in via official Deriv OAuth to grant instant token authorization for live tick streaming, real or demo execution, and account balance sync.
                      </p>
                    </div>

                    {/* PROMINENT 'LOGIN WITH DERIV' BUTTON */}
                    <button
                      type="button"
                      onClick={handleDerivOAuthRedirect}
                      disabled={isRedirecting}
                      className="group relative w-full py-3 px-4 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-[#ff444f] via-[#e53945] to-[#cc2936] hover:from-[#ff555f] hover:to-[#ea3943] shadow-[0_0_25px_rgba(255,68,79,0.45)] hover:shadow-[0_0_35px_rgba(255,68,79,0.7)] transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                          <ExternalLink className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-base tracking-tight font-black">
                          {isRedirecting ? 'Redirecting to Deriv...' : 'Login with Deriv'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded-lg text-xs font-semibold text-white/95 group-hover:translate-x-0.5 transition-transform">
                        <span>OAuth</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>

                    {/* OAuth Steps Summary */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[9px]">
                          1
                        </span>
                        <span>Click to redirect</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[9px]">
                          2
                        </span>
                        <span>Authorize securely</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[9px]">
                          3
                        </span>
                        <span>Return with token</span>
                      </div>
                    </div>
                  </div>

                  {/* App ID Config Accordion / Settings */}
                  <div className="bg-[#090d16] border border-slate-800/90 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-[#00e599]" />
                        <span>Deriv App ID</span>
                      </label>
                      <span className="text-[10px] text-slate-500">Official Default: 1089</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        placeholder="1089"
                        className="flex-1 px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-[#ff444f] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setAppId('1089')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors"
                      >
                        Reset 1089
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      If you registered a custom App ID with Deriv API, enter it here before clicking 'Login with Deriv'.
                    </p>
                  </div>

                  {/* Alternative: Manual Token Input Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowManualToken((prev) => !prev)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center justify-between w-full py-1.5 px-1 border-b border-slate-800/60"
                    >
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-slate-500" />
                        <span>Already have a Deriv API Token? (Manual Entry)</span>
                      </span>
                      <span className="text-slate-500">{showManualToken ? '▲ Hide' : '▼ Enter Token'}</span>
                    </button>

                    {showManualToken && (
                      <form onSubmit={handleManualTokenAuth} className="mt-2.5 space-y-2 p-3 bg-[#090d16] border border-slate-800 rounded-xl animate-in fade-in">
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                          <input
                            type="password"
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            placeholder="Paste Deriv API Token (Read + Trade scope)"
                            className="w-full pl-8 pr-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-white text-xs font-mono focus:ring-1 focus:ring-[#00e599] focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-1.5 bg-[#00e599] hover:bg-[#00e599]/90 text-black font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Authorize Token</span>
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'affiliate' ? (
            <div className="space-y-4">
              <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#00e599]" />
                  <span>Deriv Affiliate & IB Commission Tracking</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Earn lifetime commissions when traders log in through your app. Enter your official <strong className="text-white">Deriv Affiliate ID</strong> or <strong className="text-white">IB Partner ID</strong> below.
                </p>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-slate-300">Your Deriv Affiliate ID</label>
                  <input
                    type="text"
                    value={affiliateId}
                    onChange={(e) => setAffiliateId(e.target.value)}
                    placeholder="e.g. 123456 or your affiliate tracking code"
                    className="w-full px-3.5 py-2 bg-[#111827] border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-[#00e599] focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    This ID is automatically appended to the Deriv OAuth redirect URL (<code className="text-[#00e599]">&affiliate_id=...</code>).
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-[#090d16] border border-slate-800 rounded-xl text-xs space-y-2 text-slate-300">
                <h5 className="font-bold text-white text-xs">How Deriv Affiliate Commissions Work:</h5>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Get your unique Partner/Affiliate ID from Deriv Partners.</li>
                  <li>Paste it above and it will be embedded into the <strong className="text-white">Login with Deriv</strong> flow.</li>
                  <li>Whenever any user authorizes via OAuth, Deriv tags them to your affiliate account.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Account Card */}
              <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Account Mode</span>
                  <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => onUpdateAccount({ isDemo: true })}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                        userAccount.isDemo
                          ? 'bg-emerald-500 text-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Demo ($)
                    </button>
                    <button
                      onClick={() => onUpdateAccount({ isDemo: false })}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                        !userAccount.isDemo
                          ? 'bg-rose-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Real Live
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-slate-400">Active Balance:</span>
                  <span className="text-2xl font-mono font-bold text-white">
                    ${userAccount.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Reset Demo Balance Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-[#00e599]" />
                  <span>Reset Virtual Demo Balance</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1000, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleReset(amt)}
                      className="py-2 px-3 rounded-xl bg-[#090d16] border border-slate-800 hover:border-[#00e599]/60 text-xs font-mono font-semibold text-slate-200 transition-all hover:bg-slate-800 cursor-pointer"
                    >
                      ${amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Trader Handle</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. EdgeMaster75"
                  className="w-full px-3.5 py-2 bg-[#090d16] border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-[#00e599] focus:outline-none"
                />
              </div>

              <button
                onClick={handleSaveProfile}
                className="w-full py-2 bg-[#00e599] hover:bg-[#00e599]/90 text-black font-bold text-xs rounded-xl transition-colors shadow cursor-pointer"
              >
                Save Preferences
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#090d16] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
