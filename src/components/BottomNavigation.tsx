import React from 'react';
import { ChartNoAxesCombined, Radio, Bot, Blocks, History } from 'lucide-react';

export type ActiveTab = 'digits' | 'signals' | 'bots' | 'builder' | 'history';

export interface BottomNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  botRunning?: boolean;
  digitsBotRunning?: boolean;
  signalBotRunning?: boolean;
  chartsBotRunning?: boolean;
  xmlBotRunning?: boolean;
  theme?: 'dark' | 'light';
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  botRunning,
  digitsBotRunning,
  signalBotRunning,
  chartsBotRunning,
  xmlBotRunning,
  theme,
}) => {
  const isDigitsRunning = digitsBotRunning ?? botRunning ?? false;
  const isSignalRunning = signalBotRunning ?? false;
  const isChartsRunning = chartsBotRunning ?? false;
  const isXmlRunning = xmlBotRunning ?? false;
  const isLight = theme === 'light';

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md border-t py-2 px-2 sm:px-4 shadow-xl transition-colors ${
        isLight
          ? 'bg-white/95 border-neutral-200 text-neutral-900'
          : 'bg-black/95 border-neutral-850 text-white'
      }`}
    >
      <div className="max-w-xl mx-auto flex items-center justify-around gap-1">
        {/* Analysis Tab */}
        <button
          onClick={() => onTabChange('digits')}
          className={`flex flex-col items-center gap-1 px-2.5 sm:px-4 py-1.5 rounded-xl transition-all relative whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'digits'
              ? 'text-slate-950 font-black bg-[#00FFFF] border border-[#00FFFF] shadow-[0_0_15px_rgba(0,255,255,0.5)] ring-2 ring-[#00FFFF]'
              : isLight
              ? 'text-neutral-500 hover:text-neutral-900 font-medium'
              : 'text-neutral-400 hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <ChartNoAxesCombined className="w-5 h-5 stroke-[2.25]" />
            {isDigitsRunning && (
              <>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </>
            )}
          </div>
          <span className="text-[11px] sm:text-xs tracking-tight">Analysis</span>
          {activeTab === 'digits' && (
            <span className="w-5 h-0.5 rounded-full -mb-0.5 bg-slate-950" />
          )}
        </button>

        {/* Signals Tab */}
        <button
          onClick={() => onTabChange('signals')}
          className={`flex flex-col items-center gap-1 px-2.5 sm:px-4 py-1.5 rounded-xl transition-all relative whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'signals'
              ? 'text-slate-950 font-black bg-[#00FFFF] border border-[#00FFFF] shadow-[0_0_15px_rgba(0,255,255,0.5)] ring-2 ring-[#00FFFF]'
              : isLight
              ? 'text-neutral-500 hover:text-neutral-900 font-medium'
              : 'text-neutral-400 hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <Radio className="w-5 h-5" />
            {isSignalRunning && (
              <>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </>
            )}
          </div>
          <span className="text-[11px] sm:text-xs tracking-tight">Signals</span>
          {activeTab === 'signals' && (
            <span className="w-5 h-0.5 rounded-full -mb-0.5 bg-slate-950" />
          )}
        </button>

        {/* Bots Tab */}
        <button
          onClick={() => onTabChange('bots')}
          className={`flex flex-col items-center gap-1 px-2.5 sm:px-4 py-1.5 rounded-xl transition-all relative whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'bots'
              ? 'text-slate-950 font-black bg-[#00FFFF] border border-[#00FFFF] shadow-[0_0_15px_rgba(0,255,255,0.5)] ring-2 ring-[#00FFFF]'
              : isLight
              ? 'text-neutral-500 hover:text-neutral-900 font-medium'
              : 'text-neutral-400 hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            {isChartsRunning && (
              <>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </>
            )}
          </div>
          <span className="text-[11px] sm:text-xs tracking-tight">Bots</span>
          {activeTab === 'bots' && (
            <span className="w-5 h-0.5 rounded-full -mb-0.5 bg-slate-950" />
          )}
        </button>

        {/* Bot Builder Tab */}
        <button
          onClick={() => onTabChange('builder')}
          className={`flex flex-col items-center gap-1 px-2.5 sm:px-4 py-1.5 rounded-xl transition-all relative whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'builder'
              ? 'text-slate-950 font-black bg-[#00FFFF] border border-[#00FFFF] shadow-[0_0_15px_rgba(0,255,255,0.5)] ring-2 ring-[#00FFFF]'
              : isLight
              ? 'text-neutral-500 hover:text-neutral-900 font-medium'
              : 'text-neutral-400 hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <Blocks className="w-5 h-5" />
            {isXmlRunning && (
              <>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </>
            )}
          </div>
          <span className="text-[11px] sm:text-xs tracking-tight">Bot Builder</span>
          {activeTab === 'builder' && (
            <span className="w-5 h-0.5 rounded-full -mb-0.5 bg-slate-950" />
          )}
        </button>

        {/* Trade History Tab */}
        <button
          onClick={() => onTabChange('history')}
          className={`flex flex-col items-center gap-1 px-2.5 sm:px-4 py-1.5 rounded-xl transition-all relative whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'history'
              ? 'text-slate-950 font-black bg-[#00FFFF] border border-[#00FFFF] shadow-[0_0_15px_rgba(0,255,255,0.5)] ring-2 ring-[#00FFFF]'
              : isLight
              ? 'text-neutral-500 hover:text-neutral-900 font-medium'
              : 'text-neutral-400 hover:text-white font-medium'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[11px] sm:text-xs tracking-tight">History</span>
          {activeTab === 'history' && (
            <span className="w-5 h-0.5 rounded-full -mb-0.5 bg-slate-950" />
          )}
        </button>
      </div>
    </div>
  );
};
