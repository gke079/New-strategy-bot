import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Activity, Search } from 'lucide-react';
import { Market } from '../types';
import { SYNTHETIC_MARKETS } from '../services/markets';

interface MarketSelectorProps {
  selectedMarket: Market;
  onSelectMarket: (market: Market) => void;
}

export const MarketSelector: React.FC<MarketSelectorProps> = ({
  selectedMarket,
  onSelectMarket,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categoryTabs = [
    { id: 'all', label: 'All Indices' },
    { id: 'volatility', label: '⚡ Plain Volatilities' },
    { id: 'volatility-1s', label: '⏱️ Volatility (1s)' },
    { id: 'step', label: '🪜 Step Indices (100-500)' },
    { id: 'jump', label: '🦘 Jump Indices (10-100)' },
  ];

  const filteredMarkets = useMemo(() => {
    return SYNTHETIC_MARKETS.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [searchQuery, selectedCategory]);

  const getCategoryBadge = (cat: Market['category']) => {
    switch (cat) {
      case 'volatility':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'volatility-1s':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'step':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'jump':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'boom-crash':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#111827] hover:bg-[#162032] border border-slate-800 rounded-xl text-left text-slate-100 transition-all group focus:outline-none focus:ring-2 focus:ring-[#00e599]/30"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00e599]/10 border border-[#00e599]/20 flex items-center justify-center text-[#00e599]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-100 text-sm sm:text-base flex items-center gap-2">
              {selectedMarket.name}
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {selectedMarket.decimals} dec
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>{selectedMarket.symbol}</span>
              <span>•</span>
              <span className="capitalize">{selectedMarket.category.replace('-', ' ')}</span>
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#00e599]' : 'group-hover:text-slate-200'
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[460px]">
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-800 bg-[#0c1322]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search indices (e.g. 75, Step, Jump, 1s)..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#172233] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#00e599]"
                autoFocus
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-0.5 scrollbar-none text-[11px]">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-2.5 py-1 rounded-lg whitespace-nowrap font-medium transition-all ${
                    selectedCategory === tab.id
                      ? 'bg-[#00e599] text-black font-bold'
                      : 'bg-[#111827] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Markets List grouped and arranged */}
          <div className="overflow-y-auto divide-y divide-slate-800/40 p-1.5 flex-1">
            {filteredMarkets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-mono">
                No matching indices found.
              </div>
            ) : (
              filteredMarkets.map((market) => {
                const isSelected = market.id === selectedMarket.id;
                return (
                  <button
                    key={market.id}
                    onClick={() => {
                      onSelectMarket(market);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                      isSelected
                        ? 'bg-[#00e599]/10 text-[#00e599]'
                        : 'hover:bg-slate-800/60 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-[#00e599]' : 'bg-slate-600'
                        }`}
                      />
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <span>{market.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${getCategoryBadge(
                              market.category
                            )}`}
                          >
                            {market.symbol}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          Pip: {market.pipSize} • {market.decimals} decimals
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#00e599]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
