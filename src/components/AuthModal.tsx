import React, { useState, useEffect } from 'react';
import { X, User, Key, RotateCcw, ShieldCheck, CheckCircle2, ExternalLink, Lock, DollarSign } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'profile' | 'deriv_auth' | 'affiliate'>('deriv_auth');
  const [username, setUsername] = useState(userAccount.username);
  const [apiToken, setApiToken] = useState('');
  const [affiliateId, setAffiliateId] = useState(() => {
    return localStorage.getItem('tickedge_deriv_affiliate_id') || '';
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(userAccount.isLoggedIn);

  useEffect(() => {
    localStorage.setItem('tickedge_deriv_affiliate_id', affiliateId);
  }, [affiliateId]);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    onUpdateAccount({ username });
    setSuccessMsg('Account details saved successfully!');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleReset = (amount: number) => {
    onResetBalance(amount);
    setSuccessMsg(`Virtual balance reset to $${amount.toLocaleString()}`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleDerivOAuthRedirect = () => {
    const appId = '1089';
    let authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&brand=deriv`;
    if (affiliateId.trim()) {
      authUrl += `&affiliate_id=${encodeURIComponent(affiliateId.trim())}`;
    }
    window.location.href = authUrl;
  };

  const handleManualTokenAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!apiToken || apiToken.trim().length < 6) {
      setAuthError('Please enter a valid Deriv API token.');
      return;
    }

    setIsAuthorized(true);
    onUpdateAccount({ isLoggedIn: true, email: 'deriv_trader@oauth.deriv.com' });
    if (onAuthorizeDerivToken) {
      onAuthorizeDerivToken(apiToken.trim());
    }

    setSuccessMsg('Successfully authorized with Deriv API account!');
    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    onUpdateAccount({ isLoggedIn: false });
    setApiToken('');
    setSuccessMsg('Logged out of Deriv account.');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00e599]/10 border border-[#00e599]/20 flex items-center justify-center text-[#00e599]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Deriv Account & Affiliate</h3>
              <p className="text-xs text-slate-400">Official Login & Commission Tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="flex border-b border-slate-800 px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('deriv_auth')}
            className={`py-2.5 border-b-2 mr-3 transition-colors flex items-center gap-1.5 ${
              activeTab === 'deriv_auth'
                ? 'border-[#00e599] text-[#00e599]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Deriv Login</span>
          </button>
          <button
            onClick={() => setActiveTab('affiliate')}
            className={`py-2.5 border-b-2 mr-3 transition-colors flex items-center gap-1.5 ${
              activeTab === 'affiliate'
                ? 'border-[#00e599] text-[#00e599]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Affiliate Commission</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-[#00e599] text-[#00e599]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Balance</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {authError && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span>{authError}</span>
            </div>
          )}

          {activeTab === 'deriv_auth' ? (
            <div className="space-y-4">
              {/* Authorization Status Card */}
              <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Deriv Connection</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                      userAccount.isLoggedIn
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {userAccount.isLoggedIn ? 'Authorized' : 'Not Connected'}
                  </span>
                </div>

                {userAccount.isLoggedIn ? (
                  <div className="space-y-2 pt-1 border-t border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Account ID / Handle:</span>
                      <strong className="text-white font-mono">{userAccount.username}</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Balance:</span>
                      <strong className="text-[#00e599] font-mono">${userAccount.balance.toFixed(2)} USD</strong>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full mt-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Disconnect Deriv Account
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1 border-t border-slate-800">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Click below to log in securely through Deriv's official OAuth login page. Your affiliate ID is automatically included for commission tracking.
                    </p>

                    <button
                      onClick={handleDerivOAuthRedirect}
                      className="w-full py-2.5 bg-[#00e599] hover:bg-[#00e599]/90 text-black font-bold text-xs rounded-xl transition-colors shadow flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Log in with Deriv (Official OAuth)</span>
                    </button>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-slate-800"></div>
                      <span className="flex-shrink mx-2 text-[11px] text-slate-500 uppercase">Or use API token</span>
                      <div className="flex-grow border-t border-slate-800"></div>
                    </div>

                    <form onSubmit={handleManualTokenAuth} className="space-y-2.5">
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input
                          type="password"
                          value={apiToken}
                          onChange={(e) => setApiToken(e.target.value)}
                          placeholder="Paste Deriv API token here"
                          className="w-full pl-9 pr-3.5 py-2 bg-[#111827] border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-[#00e599]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors border border-slate-700 flex items-center justify-center gap-1.5"
                      >
                        <Key className="w-3.5 h-3.5 text-[#00e599]" />
                        <span>Authorize with Token</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'affiliate' ? (
            <div className="space-y-4">
              <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#00e599]" />
                  <span>Deriv Affiliate & IB Commission Setup</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  To earn commissions when traders log in or sign up through your tool, enter your official <strong className="text-white">Deriv Affiliate ID</strong> or <strong className="text-white">IB Partner ID</strong> below.
                </p>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-slate-300">Your Deriv Affiliate ID</label>
                  <input
                    type="text"
                    value={affiliateId}
                    onChange={(e) => setAffiliateId(e.target.value)}
                    placeholder="e.g. 123456 or your affiliate tracking ID"
                    className="w-full px-3.5 py-2 bg-[#111827] border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-[#00e599]"
                  />
                  <p className="text-[11px] text-slate-400">
                    This ID is automatically appended to the official Deriv login redirect URL (`&affiliate_id=...`).
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-[#090d16] border border-slate-800 rounded-xl text-xs space-y-2 text-slate-300">
                <h5 className="font-bold text-white text-xs">How Deriv Affiliate Commissions Work:</h5>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Sign up for a free partner account on <strong className="text-white">Deriv Affiliate / IB</strong> program.</li>
                  <li>Get your unique Affiliate ID and paste it here.</li>
                  <li>Whenever any user clicks <strong className="text-white">Log in with Deriv</strong> in your tool, Deriv tracks them under your affiliate account.</li>
                  <li>You earn lifetime revenue share or turnover commissions directly in your Deriv partner account.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Account Card */}
              <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Account Type</span>
                  <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => onUpdateAccount({ isDemo: true })}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        userAccount.isDemo
                          ? 'bg-emerald-500 text-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Demo ($)
                    </button>
                    <button
                      onClick={() => onUpdateAccount({ isDemo: false })}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
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
                  <span className="text-xs text-slate-400">Current Balance:</span>
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
                      className="py-2 px-3 rounded-xl bg-[#090d16] border border-slate-800 hover:border-[#00e599]/60 text-xs font-mono font-semibold text-slate-200 transition-all hover:bg-slate-800"
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
                  className="w-full px-3.5 py-2 bg-[#090d16] border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-[#00e599]"
                />
              </div>

              <button
                onClick={handleSaveProfile}
                className="w-full py-2 bg-[#00e599] hover:bg-[#00e599]/90 text-black font-bold text-xs rounded-xl transition-colors shadow"
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
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
