import React, { useState } from 'react';
import { Trade, BotMetrics } from '../types';
import { History, Download, Trash2, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';

interface TradesHistoryViewProps {
  trades: Trade[];
  metrics: BotMetrics;
  onClearHistory: () => void;
}

export const TradesHistoryView: React.FC<TradesHistoryViewProps> = ({
  trades,
  metrics,
  onClearHistory,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [botFilter, setBotFilter] = useState<'all' | 'digits' | 'charts' | 'normal' | 'xml'>('all');

  const filteredTrades = trades.filter((t) => {
    if (botFilter !== 'all' && t.botSource && t.botSource !== botFilter) {
      return false;
    }
    if (filterType === 'all') return true;
    if (filterType === 'won') return t.status === 'won';
    if (filterType === 'lost') return t.status === 'lost';
    return t.contractType === filterType;
  });

  const formatContractLabel = (trade: Trade): string => {
    const rawPred = String(trade.prediction ?? '').trim();
    const digitMatch = rawPred.match(/\d+/);
    const digit = digitMatch ? digitMatch[0] : '';

    switch (trade.contractType) {
      case 'UNDER':
        return digit !== '' ? `Under ${digit}` : 'Under';
      case 'OVER':
        return digit !== '' ? `Over ${digit}` : 'Over';
      case 'MATCHES':
        return digit !== '' ? `Matches ${digit}` : 'Matches';
      case 'DIFFERS':
        return digit !== '' ? `Differs ${digit}` : 'Differs';
      case 'EVEN':
        return 'Even';
      case 'ODD':
        return 'Odd';
      case 'RISE':
        return 'Rise';
      case 'FALL':
        return 'Fall';
      case 'HIGH_TICK':
        return digit !== '' ? `High Tick #${digit}` : 'High Tick';
      case 'LOW_TICK':
        return digit !== '' ? `Low Tick #${digit}` : 'Low Tick';
      default:
        return trade.contractType
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
    }
  };

  const exportCSV = () => {
    if (trades.length === 0) return;
    const headers = ['ID', 'BotSource', 'Timestamp', 'Market', 'Strategy', 'Contract', 'Prediction', 'ExitDigit', 'Stake', 'Profit', 'Status', 'BalanceAfter'];
    const rows = trades.map((t) => [
      t.id,
      t.botSource || 'unknown',
      new Date(t.timestamp).toISOString(),
      t.marketId,
      `"${t.strategyName}"`,
      `"${formatContractLabel(t)}"`,
      `"${t.prediction}"`,
      t.exitDigit,
      t.stake,
      t.profit,
      t.status,
      t.balanceAfter,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tickedge_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 w-full shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#00e599]" />
          <div>
            <h3 className="text-base font-bold text-white">Trade History & Audit Log</h3>
            <p className="text-xs text-slate-400">Complete execution record of all digit contract trades</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={trades.length === 0}
            className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onClearHistory}
            disabled={trades.length === 0}
            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Bot & Contract Filters */}
      <div className="flex flex-col gap-2">
        {/* Bot Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-semibold">Bot:</span>
          <div className="flex items-center gap-1.5 bg-[#090d16] p-1 rounded-xl border border-slate-800 flex-wrap">
            <button
              onClick={() => setBotFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                botFilter === 'all'
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,255,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Bots ({trades.length})
            </button>
            <button
              onClick={() => setBotFilter('normal')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                botFilter === 'normal'
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,255,0.4)]'
                  : 'text-slate-400 hover:text-[#00FFFF]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${botFilter === 'normal' ? 'bg-slate-950' : 'bg-[#00FFFF]'}`} />
              <span>Normal Bot ({trades.filter((t) => t.botSource === 'normal').length})</span>
            </button>
            <button
              onClick={() => setBotFilter('digits')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                botFilter === 'digits'
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,255,0.4)]'
                  : 'text-slate-400 hover:text-[#00FFFF]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${botFilter === 'digits' ? 'bg-slate-950' : 'bg-[#00FFFF]'}`} />
              <span>Digits Bot ({trades.filter((t) => t.botSource === 'digits').length})</span>
            </button>
            <button
              onClick={() => setBotFilter('charts')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                botFilter === 'charts'
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,255,0.4)]'
                  : 'text-slate-400 hover:text-[#00FFFF]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${botFilter === 'charts' ? 'bg-slate-950' : 'bg-[#00FFFF]'}`} />
              <span>Strategy Bot ({trades.filter((t) => t.botSource === 'charts').length})</span>
            </button>
            <button
              onClick={() => setBotFilter('xml')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                botFilter === 'xml'
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,255,0.4)]'
                  : 'text-slate-400 hover:text-[#00FFFF]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${botFilter === 'xml' ? 'bg-slate-950' : 'bg-[#00FFFF]'}`} />
              <span>XML Bot ({trades.filter((t) => t.botSource === 'xml').length})</span>
            </button>
          </div>
        </div>

        {/* Contract & Outcome filter row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
          </span>
          {['all', 'won', 'lost', 'OVER', 'UNDER', 'EVEN', 'ODD', 'MATCHES', 'DIFFERS', 'RISE', 'FALL', 'ONLY_UP', 'ONLY_DOWN', 'HIGH_TICK', 'LOW_TICK'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-2.5 py-1 rounded-lg uppercase font-semibold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                filterType === f
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,255,0.5)]'
                  : 'bg-[#090d16] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Trades List */}
      {filteredTrades.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs font-mono">
          No executed trades found under this filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Bot</th>
                <th className="py-2.5 px-3">Contract</th>
                <th className="py-2.5 px-3">Exit Digit</th>
                <th className="py-2.5 px-3">Stake</th>
                <th className="py-2.5 px-3 text-right">Profit / Loss</th>
                <th className="py-2.5 px-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTrades.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        t.botSource === 'signal'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : t.botSource === 'xml'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : t.botSource === 'normal'
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : t.botSource === 'charts'
                          ? 'bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30'
                          : 'bg-[#00e599]/15 text-[#00e599] border border-[#00e599]/30'
                      }`}
                    >
                      {t.botSource === 'signal'
                        ? 'Signals'
                        : t.botSource === 'xml'
                        ? 'XML Bot'
                        : t.botSource === 'normal'
                        ? 'Normal Bot'
                        : t.botSource === 'charts'
                        ? 'Strategy Bot'
                        : 'Digits Bot'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-white whitespace-nowrap tabular-nums">
                      {formatContractLabel(t)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[#00e599] font-bold">
                      {t.exitDigit}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">${t.stake.toFixed(2)}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold ${
                      t.status === 'won' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {t.profit > 0 ? '+' : ''}${t.profit.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300 font-semibold">
                    ${t.balanceAfter.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
