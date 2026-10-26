import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Wifi,
  RefreshCw,
  Key,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  Info,
  Lock,
  Server,
  ArrowRight,
  Copy,
} from 'lucide-react';
import { ConnectionStatus, DerivAccountInfo, DERIV_SERVERS } from '../services/tickEngine';

interface DerivApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionStatus: ConnectionStatus;
  onConnectWebSocket: (appId: string, token: string, endpointUrl?: string) => void;
  accountInfo?: DerivAccountInfo | null;
  authError?: string | null;
  onOpenAuthModal?: () => void;
}

export const DerivApiModal: React.FC<DerivApiModalProps> = ({
  isOpen,
  onClose,
  connectionStatus,
  onConnectWebSocket,
  accountInfo,
  authError,
  onOpenAuthModal,
}) => {
  const [appId, setAppId] = useState<string>(() => {
    try {
      return localStorage.getItem('tickedge_deriv_app_id') || '1089';
    } catch {
      return '1089';
    }
  });

  const [apiToken, setApiToken] = useState<string>(() => {
    try {
      return localStorage.getItem('tickedge_deriv_token') || '';
    } catch {
      return '';
    }
  });

  const [serverUrl, setServerUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('tickedge_deriv_endpoint') || 'wss://ws.derivws.com/websockets/v3';
    } catch {
      return 'wss://ws.derivws.com/websockets/v3';
    }
  });

  const [activeTab, setActiveTab] = useState<'connection' | 'guide'>('connection');
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        const savedAppId = localStorage.getItem('tickedge_deriv_app_id');
        if (savedAppId) setAppId(savedAppId);
        const savedToken = localStorage.getItem('tickedge_deriv_token');
        if (savedToken) setApiToken(savedToken);
        const savedEndpoint = localStorage.getItem('tickedge_deriv_endpoint');
        if (savedEndpoint) setServerUrl(savedEndpoint);
      } catch {}
      setFeedbackMessage(null);
      setIsApplying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanAppId = appId.trim() || '1089';
    const cleanToken = apiToken.trim();
    const cleanServer = serverUrl.trim() || 'wss://ws.derivws.com/websockets/v3';

    try {
      localStorage.setItem('tickedge_deriv_app_id', cleanAppId);
      localStorage.setItem('tickedge_deriv_endpoint', cleanServer);
      if (cleanToken) {
        localStorage.setItem('tickedge_deriv_token', cleanToken);
      } else {
        localStorage.removeItem('tickedge_deriv_token');
      }
    } catch {}

    setIsApplying(true);
    setFeedbackMessage(`Connecting to ${cleanServer.split('/')[2]} with App ID: ${cleanAppId}...`);

    onConnectWebSocket(cleanAppId, cleanToken, cleanServer);

    setTimeout(() => {
      setIsApplying(false);
      setFeedbackMessage(`Feed updated! Connected with App ID: ${cleanAppId}`);
      setTimeout(() => {
        setFeedbackMessage(null);
      }, 3500);
    }, 1000);
  };

  const handleClearToken = () => {
    setApiToken('');
    try {
      localStorage.removeItem('tickedge_deriv_token');
    } catch {}
    const cleanAppId = appId.trim() || '1089';
    setIsApplying(true);
    setFeedbackMessage('Reverting to virtual simulation mode...');
    onConnectWebSocket(cleanAppId, '', serverUrl);
    setTimeout(() => {
      setIsApplying(false);
      setFeedbackMessage('Cleared token. Simulation mode active.');
    }, 800);
  };

  const handleDirectOAuth = () => {
    const cleanAppId = appId.trim() || '1089';
    const affiliateId = localStorage.getItem('tickedge_deriv_affiliate_id') || '';
    let authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(cleanAppId)}&l=EN&brand=deriv`;
    if (affiliateId.trim()) {
      authUrl += `&affiliate_id=${encodeURIComponent(affiliateId.trim())}`;
    }
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = authUrl;
        return;
      }
    } catch {}
    window.location.href = authUrl;
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
              <h3 className="font-bold text-white text-base">Deriv Live WebSocket Connection</h3>
              <p className="text-xs text-slate-400">Official Deriv v3 Streaming Endpoint & Credentials</p>
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
            onClick={() => setActiveTab('connection')}
            className={`py-2.5 border-b-2 mr-4 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'connection'
                ? 'border-[#00FFFF] text-[#00FFFF] font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Connection & Trading</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-[#00FFFF] text-[#00FFFF] font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Digits Strategy Guide</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {activeTab === 'connection' ? (
            <>
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-mono transition-all ${
                  isApplying
                    ? 'bg-sky-950/40 border-sky-500/40 text-sky-300'
                    : connectionStatus === 'connected'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isApplying
                        ? 'bg-sky-400 animate-ping'
                        : connectionStatus === 'connected'
                        ? 'bg-emerald-400'
                        : connectionStatus === 'connecting'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-rose-400'
                    }`}
                  />
                  <span>
                    Status:{' '}
                    <strong className="uppercase">
                      {isApplying
                        ? 'Connecting to Deriv WS...'
                        : connectionStatus === 'connected'
                        ? 'Live Deriv WebSocket Active'
                        : connectionStatus === 'connecting'
                        ? 'Connecting to Deriv WS...'
                        : 'Disconnected / Reconnecting...'}
                    </strong>
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                  {serverUrl.replace('wss://', '').replace('/websockets/v3', '')}
                </span>
              </div>

              {/* Feedback Alert if applied */}
              {feedbackMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{feedbackMessage}</span>
                </div>
              )}

              {/* Auth Error Banner if invalid token */}
              {authError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Deriv Authorization Failed</p>
                    <p className="text-[11px] text-rose-200/80">{authError}</p>
                    <p className="text-[11px] text-slate-400">
                      Check that your token was copied correctly and has <strong>Read</strong> and <strong>Trade</strong> scopes.
                    </p>
                  </div>
                </div>
              )}

              {/* PROMINENT LOGIN WITH DERIV HERO IN API MODAL */}
              {!accountInfo && (
                <div className="rounded-xl p-3.5 bg-gradient-to-r from-[#ff444f]/20 via-[#111827] to-[#090d16] border border-[#ff444f]/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5">
                      <span className="text-white font-bold text-xs">Want Live Account Trading?</span>
                      <span className="text-[9px] bg-[#ff444f] text-white px-1.5 py-0.2 rounded font-bold uppercase">
                        OAuth 2.0
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Login securely with Deriv to authorize token and sync balances.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDirectOAuth}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-[#ff444f] to-[#cc2936] hover:from-[#ff555f] hover:to-[#ea3943] shadow-[0_0_15px_rgba(255,68,79,0.4)] transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Login with Deriv</span>
                  </button>
                </div>
              )}

              {/* Authorized Live Account Card */}
              {accountInfo && (
                <div className="p-3.5 rounded-xl bg-[#090d16] border border-emerald-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                      Authorized Deriv Account
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        accountInfo.isVirtual
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {accountInfo.isVirtual ? 'Virtual Demo' : 'Live Real Account'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Login ID</span>
                      <span className="text-white font-bold text-sm">{accountInfo.loginid}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Account Balance</span>
                      <span className="text-[#00e599] font-bold text-sm">
                        ${accountInfo.balance.toFixed(2)} {accountInfo.currency}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#00e599]" />
                      Live bot execution enabled
                    </span>
                    <button
                      onClick={handleClearToken}
                      className="text-rose-400 hover:text-rose-300 transition-colors underline cursor-pointer"
                    >
                      Disconnect Token
                    </button>
                  </div>
                </div>
              )}

              {/* Form Controls */}
              <form onSubmit={handleApply} className="space-y-3 bg-[#090d16] border border-slate-800/80 rounded-xl p-4">
                {/* WebSocket Server Selection */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-[#00e599]" />
                      <span>Deriv WebSocket Server</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Switch if connection drops</span>
                  </div>
                  <select
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className="px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-[#00e599] focus:outline-none"
                  >
                    {DERIV_SERVERS.map((srv) => (
                      <option key={srv.url} value={srv.url}>
                        {srv.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Deriv App Registration & Redirect URL Helper */}
                <div className="p-3 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5 text-[11px]">
                      <Info className="w-3.5 h-3.5 text-[#00e599]" />
                      <span>Redirect URL for Registering App ID</span>
                    </span>
                    <a
                      href="https://developers.deriv.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00e599] hover:underline flex items-center gap-0.5 text-[10px]"
                    >
                      <span>developers.deriv.com</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    When registering your app on the Deriv Developer Portal to obtain an App ID, enter this exact Redirect URL:
                  </p>
                  <div className="flex items-center gap-1.5 bg-[#090d16] p-1.5 rounded border border-slate-800">
                    <code className="text-[#00e599] font-mono text-[10px] truncate flex-1 select-all">
                      {typeof window !== 'undefined' ? window.location.origin : ''}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        const url = typeof window !== 'undefined' ? window.location.origin : '';
                        navigator.clipboard.writeText(url);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-[#00e599]" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-2.5 h-2.5 text-slate-300" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* App ID Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-slate-300">Your Deriv App ID</label>
                    <span className="text-[11px] text-slate-400">Default: 1089</span>
                  </div>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g. 1089 or your registered App ID"
                    className="px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-[#00e599] focus:outline-none"
                  />
                  {/* Quick App ID Presets */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-500">Presets:</span>
                    {['1089', '36544', '16929', '61504'].map((pid) => (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => setAppId(pid)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                          appId === pid
                            ? 'bg-[#00e599] text-black font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {pid}
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Token Input */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-slate-300 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#00e599]" />
                      <span>Deriv API Token (For Live Trading)</span>
                    </label>
                    <span className="text-[11px] text-slate-400">Read & Trade scope</span>
                  </div>
                  <input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="Paste Deriv API token for real/demo execution"
                    className="px-3 py-2 bg-[#111827] border border-slate-800 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-[#00e599] focus:outline-none"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                    <span>Leave blank for risk-free virtual simulation.</span>
                    <a
                      href="https://app.deriv.com/account/api-token"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00e599] hover:underline flex items-center gap-0.5"
                    >
                      <span>Get token</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                {/* Submit / Reconnect Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isApplying}
                    className={`w-full py-2.5 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow cursor-pointer active:scale-[0.99] ${
                      isApplying
                        ? 'bg-[#00e599]/60 text-black cursor-wait'
                        : 'bg-[#00e599] hover:bg-[#00e599]/90 text-black'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
                    <span>
                      {isApplying ? 'Applying & Reconnecting...' : 'Reconnect / Apply Live Feed'}
                    </span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-[#090d16] border border-slate-800">
                <h4 className="font-bold text-[#00e599] text-sm mb-1">
                  How TickEdge Digit Analysis Works
                </h4>
                <p className="text-slate-400 text-xs">
                  Synthetic indices (like Volatility 75) update prices tick-by-tick. The last digit
                  of each price quote is uniformly distributed from 0 to 9 over infinite samples.
                  In shorter windows (e.g. 100 to 1,000 ticks), noticeable frequency clustering occurs.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wide">
                  Top Digits Strategies
                </h4>
                <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                  <li>
                    <strong className="text-white">Differs Strategy:</strong> Bet that the next tick
                    will NOT equal the least frequent digit. Theoretical win rate is ~90%.
                  </li>
                  <li>
                    <strong className="text-white">Even / Odd Reversal:</strong> Wait for a run of 3
                    or 4 consecutive Evens/Odds and bet on reversion to mean.
                  </li>
                  <li>
                    <strong className="text-white">Over 4 / Under 5:</strong> Group digits into 0-4
                    (Under) and 5-9 (Over) to catch cluster momentum.
                  </li>
                  <li>
                    <strong className="text-white">Matches Most:</strong> High-risk, 900% return
                    contract betting that the most active digit repeats.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#090d16] flex justify-between items-center">
          <span className="text-[11px] text-slate-400">
            {accountInfo ? `Logged in: ${accountInfo.loginid}` : 'Mode: Simulation / Live Feed'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
