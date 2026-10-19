import React, { useState } from 'react';
import { X, Check, Wifi, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '../services/tickEngine';

interface DerivApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionStatus: ConnectionStatus;
  onConnectWebSocket: (appId: string, token: string) => void;
}

export const DerivApiModal: React.FC<DerivApiModalProps> = ({
  isOpen,
  onClose,
  connectionStatus,
  onConnectWebSocket,
}) => {
  const [appId, setAppId] = useState('1089');
  const [apiToken, setApiToken] = useState('');
  const [activeTab, setActiveTab] = useState<'connection' | 'guide'>('connection');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00e599]/10 border border-[#00e599]/20 flex items-center justify-center text-[#00e599]">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Deriv Live API Stream</h3>
              <p className="text-xs text-slate-400">Direct real-time tick streaming from Deriv WebSocket</p>
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
            Connection Setup
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-[#00e599] text-[#00e599]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Digit Strategies Guide
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {activeTab === 'connection' ? (
            <>
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      connectionStatus === 'connected'
                        ? 'bg-emerald-400'
                        : connectionStatus === 'connecting'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-rose-400'
                    }`}
                  />
                  <span>
                    Status:{' '}
                    <strong className="uppercase">
                      {connectionStatus === 'connected'
                        ? 'Live Deriv WebSocket Connected'
                        : connectionStatus === 'connecting'
                        ? 'Connecting to Deriv WS...'
                        : 'Disconnected / Reconnecting...'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Deriv Credentials */}
              <div className="space-y-3 bg-[#090d16] border border-slate-800/80 rounded-xl p-3.5">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-slate-300">Deriv App ID</label>
                    <span className="text-[11px] text-slate-400">Default: 1089 (Public)</span>
                  </div>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1089"
                    className="px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-[#00e599]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-slate-300">API Token (Optional)</label>
                    <span className="text-[11px] text-slate-400">For real/demo trading</span>
                  </div>
                  <input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="Enter Deriv read/trade token"
                    className="px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-[#00e599]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onConnectWebSocket(appId, apiToken)}
                    className="w-full py-2 bg-[#00e599] hover:bg-[#00e599]/90 text-black font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reconnect / Apply Live Feed</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-[#090d16] border border-slate-800">
                <h4 className="font-bold text-[#00e599] text-sm mb-1">
                  How TickEdge Digit Analysis Works
                </h4>
                <p className="text-slate-400 text-xs">
                  Synthetic indices (like Volatility 75) update prices tick-by-tick. The last digit
                  of each price quote is uniformly distributed from 0 to 9 over infinite samples.
                  In shorter windows (e.g. 100 to 1,000 ticks), noticeable frequency clustering occurs.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
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
        <div className="px-5 py-3 border-t border-slate-800 bg-[#090d16] flex justify-end">
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
