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
  const [botFilter, setBotFilter] = useState<'all' | 'digits' | 'charts'>('all');

  const filteredTrades = trades.filter((t) => {
    if (botFilter !== 'all' && t.botSource && t.botSource !== botFilter) {
      return false;
    }
    if (filterType === 'all') return true;
    if (filterType === 'won') return t.status === 'won';
    if (filterType === 'lost') return t.status === 'lost';
    return t.contractType === filterType;
  });

  const exportCSV = () => {
    if (trades.length === 0) return;
    const headers = ['ID', 'BotSource', 'Timestamp', 'Market', 'Strategy', 'Contract', 'Prediction', 'ExitDigit', 'Stake', 'Profit', 'Status', 'BalanceAfter'];
    const rows = trades.map((t) => [
      t.id,
      t.botSource || 'unknown',
      new Date(t.timestamp).toISOString(),
      t.marketId,
      `"${t.strategyName}"`,
      t.contractType,
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
            className="px-3 py-1.5 rounded-lg bg-[#090d16] hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onClearHistory}
            disabled={trades.length === 0}
            className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Bot & Contract Filters */}
      <div className="flex flex-col gap-2">
        {/* Bot Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">Bot:</span>
          <div className="flex items-center gap-1.5 bg-[#090d16] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setBotFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                botFilter === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Bots ({trades.length})
            </button>
            <button
              onClick={() => setBotFilter('digits')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                botFilter === 'digits'
                  ? 'bg-[#00e599] text-black font-bold'
                  : 'text-slate-400 hover:text-[#00e599]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#00e599]" />
              <span>Digits Bot ({trades.filter((t) => t.botSource === 'digits').length})</span>
            </button>
            <button
              onClick={() => setBotFilter('charts')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                botFilter === 'charts'
                  ? 'bg-[#38bdf8] text-black font-bold'
                  : 'text-slate-400 hover:text-[#38bdf8]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
              <span>Charts Bot ({trades.filter((t) => t.botSource === 'charts').length})</span>
            </button>
          </div>
        </div>

        {/* Contract & Outcome filter row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
          </span>
          {['all', 'won', 'lost', 'RISE', 'FALL', 'DIFFERS', 'MATCHES', 'EVEN', 'ODD', 'ONLY_UP', 'RESET_CALL', 'STAY_BETWEEN'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-2.5 py-1 rounded-lg uppercase font-semibold text-[11px] whitespace-nowrap transition-colors ${
                filterType === f
                  ? 'bg-[#00e599] text-black font-bold'
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          t.botSource === 'charts'
                            ? 'bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30'
                            : t.botSource === 'manual'
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : 'bg-[#00e599]/15 text-[#00e599] border border-[#00e599]/30'
                        }`}
                      >
                        {t.botSource === 'charts' ? 'Charts Bot' : t.botSource === 'manual' ? 'One-Click' : 'Digits Bot'}
                      </span>
                      {t.isRealTrade && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                          Deriv Real
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-white">{t.contractType}</span>
                    <span className="text-slate-400 ml-1.5 text-[11px] hidden sm:inline">
                      ({t.prediction})
                    </span>
                    {t.derivContractId && (
                      <span className="text-[10px] text-slate-500 block font-mono">
                        #{t.derivContractId}
                      </span>
                    )}
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
