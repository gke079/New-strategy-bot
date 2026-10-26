import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Activity, Search } from 'lucide-react';
import { Market } from '../types';
import { SYNTHETIC_MARKETS } from '../services/markets';

interface MarketSelectorProps {
  selectedMarket: Market;
  onSelectMarket: (market: Market) => void;
  theme?: 'dark' | 'light';
}

export const MarketSelector: React.FC<MarketSelectorProps> = ({
  selectedMarket,
  onSelectMarket,
  theme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isLight = theme === 'light';

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
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all shadow-md group focus:outline-none focus:ring-2 cursor-pointer border ${
          isLight
            ? 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-900 focus:ring-neutral-400'
            : 'bg-black hover:bg-neutral-900 border-neutral-800 text-white focus:ring-neutral-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isLight
                ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
                : 'bg-neutral-900 border-neutral-800 text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div
              className={`font-bold text-sm sm:text-base flex items-center gap-2 font-mono ${
                isLight ? 'text-neutral-900' : 'text-white'
              }`}
            >
              {selectedMarket.symbol}
              <span
                className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-normal border ${
                  isLight
                    ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
                    : 'bg-neutral-900 text-neutral-300 border-neutral-800'
                }`}
              >
                {selectedMarket.decimals} dec
              </span>
            </div>
            <div
              className={`text-xs flex items-center gap-1.5 ${
                isLight ? 'text-neutral-500' : 'text-neutral-400'
              }`}
            >
              <span className="capitalize">{selectedMarket.category.replace('-', ' ')}</span>
              <span>•</span>
              <span className="font-mono text-[11px] opacity-80">{selectedMarket.id}</span>
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          } ${isLight ? 'text-neutral-500 group-hover:text-neutral-900' : 'text-neutral-400 group-hover:text-white'}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[460px] border ${
            isLight
              ? 'bg-white border-neutral-300 text-neutral-900'
              : 'bg-black border-neutral-800 text-white'
          }`}
        >
          {/* Search Bar Header */}
          <div
            className={`p-3 border-b ${
              isLight ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-800 bg-neutral-950'
            }`}
          >
            <div className="relative">
              <Search
                className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search indices (e.g. V100, V75, Step, Jump)..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs focus:outline-none focus:ring-1 border ${
                  isLight
                    ? 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:ring-neutral-900'
                    : 'bg-neutral-900 border-neutral-800 text-white placeholder-neutral-500 focus:ring-white'
                }`}
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
                      ? isLight
                        ? 'bg-black text-white font-bold shadow-sm'
                        : 'bg-white text-black font-bold shadow-sm'
                      : isLight
                      ? 'bg-neutral-100 text-neutral-600 hover:text-black border border-neutral-200'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Markets List grouped and arranged */}
          <div
            className={`overflow-y-auto divide-y p-1.5 flex-1 ${
              isLight ? 'divide-neutral-100' : 'divide-neutral-850'
            }`}
          >
            {filteredMarkets.length === 0 ? (
              <div
                className={`py-8 text-center text-xs font-mono ${
                  isLight ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? isLight
                          ? 'bg-neutral-100 text-neutral-950 font-bold border border-neutral-300'
                          : 'bg-neutral-900 text-white font-bold border border-neutral-750'
                        : isLight
                        ? 'hover:bg-neutral-50 text-neutral-700'
                        : 'hover:bg-neutral-900/70 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected
                            ? isLight
                              ? 'bg-neutral-900'
                              : 'bg-white'
                            : isLight
                            ? 'bg-neutral-300'
                            : 'bg-neutral-600'
                        }`}
                      />
                      <div>
                        <div className="text-sm font-bold flex items-center gap-2 font-mono">
                          <span>{market.symbol}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded border font-sans font-medium capitalize ${getCategoryBadge(
                              market.category
                            )}`}
                          >
                            {market.category.replace('-', ' ')}
                          </span>
                        </div>
                        <div
                          className={`text-xs font-mono ${
                            isLight ? 'text-neutral-500' : 'text-neutral-400'
                          }`}
                        >
                          Pip: {market.pipSize} • {market.decimals} decimals
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check
                        className={`w-4 h-4 ${isLight ? 'text-neutral-900' : 'text-white'}`}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Dropdown Footer */}
          <div
            className={`px-3 py-2 border-t text-center text-[11px] font-mono ${
              isLight
                ? 'border-neutral-200 bg-neutral-50 text-neutral-500'
                : 'border-neutral-800 bg-neutral-950 text-neutral-400'
            }`}
          >
            Showing {filteredMarkets.length} synthetic volatility indices
          </div>
        </div>
      )}
    </div>
  );
};
