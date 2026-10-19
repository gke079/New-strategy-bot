import React, { useState, useEffect } from 'react';
import {
  X,
  Wifi,
  RefreshCw,
  Key,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Zap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Activity,
} from 'lucide-react';
import { ConnectionStatus } from '../services/tickEngine';
import { UserAccount } from '../types';

interface DerivApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionStatus: ConnectionStatus;
  connectionInfo?: string;
  isLiveDeriv?: boolean;
  userAccount?: UserAccount;
  onUpdateAccount?: (account: Partial<UserAccount>) => void;
  onConnectWebSocket: (appId: string, token: string) => void;
  onReconnect?: () => void;
}

export const DerivApiModal: React.FC<DerivApiModalProps> = ({
  isOpen,
  onClose,
  connectionStatus,
  connectionInfo = '',
  isLiveDeriv = false,
  userAccount,
  onUpdateAccount,
  onConnectWebSocket,
  onReconnect,
}) => {
  const [appId, setAppId] = useState(() => {
    const saved = localStorage.getItem('tickedge_deriv_app_id');
    if (!saved || saved === '61554' || saved.trim() === '') return '1089';
    return saved.trim();
  });

  const [apiToken, setApiToken] = useState(() => {
    return localStorage.getItem('tickedge_deriv_token') || '';
  });

  const [showToken, setShowToken] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'connection' | 'guide'>('connection');
  const [notice, setNotice] = useState<string>('');
  const [customAppIdInput, setCustomAppIdInput] = useState<string>('');

  useEffect(() => {
    if (userAccount?.token && !apiToken) {
      setApiToken(userAccount.token);
    }
  }, [userAccount?.token]);

  if (!isOpen) return null;

  const handleApplyToken = () => {
    const cleanAppId = appId.trim() || '1089';
    const cleanToken = apiToken.trim();

    try {
      localStorage.setItem('tickedge_deriv_app_id', cleanAppId);
      localStorage.setItem('tickedge_deriv_token', cleanToken);
    } catch {}

    onConnectWebSocket(cleanAppId, cleanToken);
    setNotice(cleanToken ? 'Submitting token authorization to Deriv...' : 'Connecting to live Deriv tick stream...');
    setTimeout(() => setNotice(''), 4000);
  };

  const handleSelectAppId = (newAppId: string) => {
    const cleanId = newAppId.trim() || '1089';
    setAppId(cleanId);
    try {
      localStorage.setItem('tickedge_deriv_app_id', cleanId);
    } catch {}
    onConnectWebSocket(cleanId, apiToken.trim());
    setNotice(`Switched to App ID ${cleanId}. Reconnecting...`);
    setTimeout(() => setNotice(''), 3000);
  };

  const handleLoginWithEmailPassword = () => {
    const cleanAppId = appId.trim() || '1089';
    try {
      localStorage.setItem('tickedge_deriv_app_id', cleanAppId);
    } catch {}

    const affiliateId = localStorage.getItem('tickedge_deriv_affiliate_id') || '';
    let authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(cleanAppId)}&l=en`;
    if (affiliateId.trim()) {
      authUrl += `&affiliate_id=${encodeURIComponent(affiliateId.trim())}`;
    }
    // Redirect to Deriv OAuth single sign-on
    window.location.href = authUrl;
  };

  const handleToggleRealExecution = (enable: boolean) => {
    if (onUpdateAccount) {
      onUpdateAccount({ isRealExecutionEnabled: enable });
      if (enable && (!apiToken || !userAccount?.isLoggedIn)) {
        setNotice('Notice: Please enter and authorize your Deriv API token (with Trade scope) for live order placement.');
      } else {
        setNotice(enable ? 'Deriv Real Trade Execution ENABLED.' : 'Switched to Virtual Simulation mode.');
      }
      setTimeout(() => setNotice(''), 3500);
    }
  };

  const handleClearToken = () => {
    setApiToken('');
    try {
      localStorage.removeItem('tickedge_deriv_token');
    } catch {}
    onConnectWebSocket(appId, '');
    if (onUpdateAccount) {
      onUpdateAccount({
        isLoggedIn: false,
        token: '',
        isRealExecutionEnabled: false,
      });
    }
    setNotice('Token removed. Switched to public read-only tick stream.');
    setTimeout(() => setNotice(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00e599]/10 border border-[#00e599]/20 flex items-center justify-center text-[#00e599]">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Deriv Real Tick &amp; Account Connection</h3>
              <p className="text-xs text-slate-400">Live WebSockets, API Token &amp; OAuth Authentication</p>
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
            onClick={() => setActiveTab('connection')}
            className={`py-2.5 border-b-2 mr-4 transition-colors ${
              activeTab === 'connection'
                ? 'border-[#00e599] text-[#00e599]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Connection &amp; Login Options
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-[#00e599] text-[#00e599]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Token Setup Guide &amp; App IDs
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {notice && (
            <div className="p-2.5 rounded-xl bg-[#00e599]/10 border border-[#00e599]/30 text-[#00e599] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {activeTab === 'connection' ? (
            <>
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col gap-2 text-xs font-mono ${
                  connectionStatus === 'connected' && isLiveDeriv
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : connectionStatus === 'connected'
                    ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        connectionStatus === 'connected' && isLiveDeriv
                          ? 'bg-emerald-400 animate-pulse'
                          : connectionStatus === 'connected'
                          ? 'bg-cyan-400'
                          : connectionStatus === 'connecting'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-rose-400'
                      }`}
                    />
                    <div>
                      <div className="font-bold uppercase tracking-wide">
                        {connectionStatus === 'connected' && isLiveDeriv
                          ? `🟢 REAL DERIV TICK STREAM ACTIVE (APP ID: ${appId})`
                          : connectionStatus === 'connected'
                          ? `CONNECTED TO DERIV NODE (APP ID: ${appId})`
                          : connectionStatus === 'connecting'
                          ? `CONNECTING TO DERIV (APP ID ${appId})...`
                          : 'DISCONNECTED / CHECKING ENDPOINTS'}
                      </div>
                      <div className="text-[11px] text-slate-300 font-sans mt-0.5">
                        {connectionInfo ||
                          (isLiveDeriv
                            ? 'Streaming genuine live tick quotes & last digits directly from Deriv'
                            : 'Connecting via direct cluster and cloud relay')}
                      </div>
                    </div>
                  </div>

                  {connectionStatus === 'disconnected' && onReconnect && (
                    <button
                      onClick={onReconnect}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors flex-shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reconnect</span>
                    </button>
                  )}
                </div>
              </div>

              {/* OPTION 1: CONNECT WITH DERIV API TOKEN (RECOMMENDED) */}
              <div className="bg-[#090d16] border border-[#00e599]/30 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-white flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-[#00e599]" />
                    <span>Option 1: Personal API Token (Recommended)</span>
                  </label>
                  <a
                    href="https://app.deriv.com/account/api-token"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#00e599] hover:underline flex items-center gap-1"
                  >
                    <span>Create Token</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Generate an API token on Deriv with <strong className="text-white">Read</strong> and{' '}
                  <strong className="text-white">Trade</strong> permissions to stream live account balance and execute real trades.
                </p>

                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="Paste Deriv API Token (e.g. a1-b2c3d4e5f6...)"
                    className="w-full px-3 py-2 pr-10 bg-[#111827] border border-slate-800 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-[#00e599]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleApplyToken}
                    className="flex-1 py-2 bg-[#00e599] hover:bg-[#00e599]/90 text-black font-bold text-xs rounded-xl transition-all shadow flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Authorize &amp; Connect Token</span>
                  </button>
                  {apiToken && (
                    <button
                      onClick={handleClearToken}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition-colors"
                      title="Clear stored token"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* OPTION 2: LOG IN WITH EMAIL AND PASSWORD (DERIV OFFICIAL OAUTH) */}
              <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <span>Option 2: Log in with Email &amp; Password</span>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-bold uppercase">
                    Deriv OAuth SSO
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sign in through Deriv's official Single Sign-On page with your <strong className="text-white">Email and Password</strong>. Deriv never shares your password directly with third-party apps for your security.
                </p>

                <button
                  onClick={handleLoginWithEmailPassword}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                  <span>Open Deriv SSO (Email &amp; Password Login)</span>
                </button>
              </div>

              {/* Deriv App ID Selector */}
              <div className="bg-[#090d16] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#00e599]" />
                    <span>Deriv App ID</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Active: <strong className="font-mono text-white">{appId}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => handleSelectAppId('1089')}
                    className={`py-2 px-2 rounded-lg border text-center transition-colors ${
                      appId === '1089'
                        ? 'bg-[#00e599]/20 border-[#00e599] text-[#00e599] font-bold shadow-sm'
                        : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[11px] font-bold">1089 (Standard)</div>
                    <div className="text-[9px] text-slate-400">Public API / Testing</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAppId('36544')}
                    className={`py-2 px-2 rounded-lg border text-center transition-colors ${
                      appId === '36544'
                        ? 'bg-[#00e599]/20 border-[#00e599] text-[#00e599] font-bold shadow-sm'
                        : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[11px] font-bold">36544</div>
                    <div className="text-[9px] text-slate-400">Deriv DBot Official</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAppId('16929')}
                    className={`py-2 px-2 rounded-lg border text-center transition-colors ${
                      appId === '16929'
                        ? 'bg-[#00e599]/20 border-[#00e599] text-[#00e599] font-bold shadow-sm'
                        : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[11px] font-bold">16929</div>
                    <div className="text-[9px] text-slate-400">Deriv Web App</div>
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customAppIdInput}
                    onChange={(e) => setCustomAppIdInput(e.target.value)}
                    placeholder="Custom App ID (from api.deriv.com)"
                    className="flex-1 px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-[#00e599]"
                  />
                  <button
                    onClick={() => {
                      if (customAppIdInput.trim()) {
                        handleSelectAppId(customAppIdInput.trim());
                        setCustomAppIdInput('');
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Set ID
                  </button>
                </div>
              </div>

              {/* Execution Mode Switch */}
              <div className="bg-[#090d16] border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${userAccount?.isRealExecutionEnabled ? 'text-rose-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-white uppercase tracking-wide">
                      Trade Execution Mode
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => handleToggleRealExecution(false)}
                      className={`px-2.5 py-1 rounded font-semibold transition-all ${
                        !userAccount?.isRealExecutionEnabled
                          ? 'bg-[#00e599] text-black shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Demo Sim (Real Ticks)
                    </button>
                    <button
                      onClick={() => handleToggleRealExecution(true)}
                      className={`px-2.5 py-1 rounded font-semibold transition-all ${
                        userAccount?.isRealExecutionEnabled
                          ? 'bg-rose-500 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Deriv Live (Real Money)
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {userAccount?.isRealExecutionEnabled
                    ? '⚠️ REAL EXECUTION ACTIVE: Trades will be submitted directly to Deriv exchange using your authorized account.'
                    : '💡 DEMO SIM: Strategies analyze 100% REAL live Deriv tick quotes with virtual demo capital.'}
                </p>
              </div>

              {/* Authorized Account Details Card if logged in */}
              {userAccount?.isLoggedIn && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5 text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Account Connected</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        userAccount.isDemo
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {userAccount.isDemo ? 'Demo Account' : 'Real Live Account'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">LOGIN ID</div>
                      <div className="font-bold text-white text-xs">{userAccount.username}</div>
                    </div>
                    <div className="bg-[#111827] p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">LIVE BALANCE</div>
                      <div className="font-bold text-[#00e599] text-xs">
                        ${userAccount.balance.toFixed(2)} {userAccount.currency || 'USD'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
                <h4 className="font-bold text-[#00e599] text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>How to Connect Your Deriv Account</span>
                </h4>
                <ul className="list-disc list-inside space-y-2 text-slate-300 text-xs">
                  <li>
                    <strong className="text-white">Why Email &amp; Password uses OAuth:</strong> Deriv does not permit third-party applications to collect raw user passwords directly. When you choose Email &amp; Password, Deriv redirects you to their verified login page on <code className="text-[#00e599]">oauth.deriv.com</code>, and returns you safely authenticated.
                  </li>
                  <li>
                    <strong className="text-white">Personal Access Token (Quickest):</strong> Go to{' '}
                    <a
                      href="https://app.deriv.com/account/api-token"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00e599] underline"
                    >
                      app.deriv.com/account/api-token
                    </a>
                    , tick the <span className="text-white font-semibold">Read</span> and{' '}
                    <span className="text-white font-semibold">Trade</span> boxes, generate a token, and paste it into Option 1.
                  </li>
                  <li>
                    <strong className="text-white">App ID 1089 vs 36544:</strong> <code className="text-[#00e599]">1089</code> is Deriv's universal public testing App ID that works with any account token. <code className="text-[#00e599]">36544</code> is the official Deriv DBot App ID. You can switch between them anytime.
                  </li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Trading Risk Notice</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Always test trading strategies thoroughly using Demo Simulation before enabling Real Execution. Real execution will submit live contracts to the Deriv exchange with financial consequences.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#090d16] flex justify-between items-center">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
            <Activity className="w-3 h-3 text-[#00e599]" />
            <span>Deriv Official API v3</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
