import React, { useState } from 'react';
import { X, Search, Plus, Check, Trash2, Eye, EyeOff, SlidersHorizontal, Activity } from 'lucide-react';
import { ActiveIndicator, AVAILABLE_INDICATORS } from '../services/indicators';

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (type: ActiveIndicator['type']) => void;
  onRemoveIndicator: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onUpdateParams: (id: string, params: Record<string, number>) => void;
}

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({
  isOpen,
  onClose,
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onToggleVisibility,
  onUpdateParams,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'trend', label: 'Trend' },
    { id: 'oscillator', label: 'Oscillators' },
    { id: 'volatility', label: 'Volatility' },
    { id: 'volume', label: 'Volume' },
  ];

  const filtered = AVAILABLE_INDICATORS.filter((ind) => {
    const matchesQuery = ind.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || ind.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00e599]/10 border border-[#00e599]/20 flex items-center justify-center text-[#00e599]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Indicators & Strategies</h3>
              <p className="text-xs text-slate-400">Add technical indicators to your TradingView chart</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Pills */}
        <div className="p-4 border-b border-slate-800 bg-[#0c1322] flex flex-col gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search indicators (e.g. RSI, MACD, Bollinger, EMA, Supertrend)..."
              className="w-full pl-9 pr-3 py-2 bg-[#172233] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#00e599]"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[#00e599] text-black font-bold'
                    : 'bg-[#111827] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body: Split into Active Indicators & Available Indicators */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Active Indicators Section */}
          {activeIndicators.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Active On Chart ({activeIndicators.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeIndicators.map((ind) => {
                  const isEditing = editingIndicatorId === ind.id;
                  return (
                    <div
                      key={ind.id}
                      className="bg-[#090d16] border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: ind.color }}
                          />
                          <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                            {ind.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onToggleVisibility(ind.id)}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                            title={ind.visible ? 'Hide indicator' : 'Show indicator'}
                          >
                            {ind.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                          </button>
                          <button
                            onClick={() => setEditingIndicatorId(isEditing ? null : ind.id)}
                            className={`p-1 transition-colors ${
                              isEditing ? 'text-[#00e599]' : 'text-slate-400 hover:text-white'
                            }`}
                            title="Configure parameters"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onRemoveIndicator(ind.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Remove indicator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Parameters inline editor if active */}
                      {isEditing && (
                        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(ind.params).map(([paramKey, val]) => (
                            <div key={paramKey} className="flex flex-col gap-0.5">
                              <label className="text-[10px] text-slate-400 uppercase">{paramKey}</label>
                              <input
                                type="number"
                                value={val}
                                onChange={(e) => {
                                  const num = parseFloat(e.target.value) || 1;
                                  onUpdateParams(ind.id, { ...ind.params, [paramKey]: num });
                                }}
                                className="px-2 py-1 bg-[#172233] border border-slate-700 rounded text-white text-xs font-mono"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Indicators Library */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Available Indicators
            </div>
            <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-xl overflow-hidden bg-[#090d16]">
              {filtered.map((ind) => {
                const isAlreadyAdded = activeIndicators.some((a) => a.type === ind.type);
                return (
                  <div
                    key={ind.type}
                    className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: ind.color }}
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">{ind.name}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{ind.category}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => onAddIndicator(ind.type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isAlreadyAdded
                          ? 'bg-[#00e599]/15 text-[#00e599] border border-[#00e599]/30'
                          : 'bg-[#172233] hover:bg-[#00e599] hover:text-black text-slate-200 border border-slate-700/80'
                      }`}
                    >
                      {isAlreadyAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#0c1322] flex justify-between items-center text-xs">
          <span className="text-slate-400">
            {activeIndicators.length} active indicator{activeIndicators.length === 1 ? '' : 's'} on chart
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#00e599] hover:bg-[#00e599]/90 text-black font-bold transition-colors"
          >
            Apply to Chart
          </button>
        </div>
      </div>
    </div>
  );
};
