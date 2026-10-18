import React from 'react';
import { Hash, LineChart, History } from 'lucide-react';

export type ActiveTab = 'digits' | 'charts' | 'history';

interface BottomNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  botRunning?: boolean;
  digitsBotRunning?: boolean;
  chartsBotRunning?: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  botRunning,
  digitsBotRunning,
  chartsBotRunning,
}) => {
  const isDigitsRunning = digitsBotRunning ?? botRunning ?? false;
  const isChartsRunning = chartsBotRunning ?? false;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#090d16]/95 backdrop-blur-md border-t border-slate-800/80 py-2.5 px-4">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {/* Digits Tab matching screenshot */}
        <button
          onClick={() => onTabChange('digits')}
          className={`flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-all relative ${
            activeTab === 'digits'
              ? 'text-[#00e599] font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <Hash className="w-5 h-5 stroke-[2.5]" />
            {isDigitsRunning && (
              <>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00e599] animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00e599]" />
              </>
            )}
          </div>
          <span className="text-xs tracking-tight">Digits</span>
          {activeTab === 'digits' && (
            <span className="w-5 h-0.5 rounded-full bg-[#00e599] -mb-1" />
          )}
        </button>

        {/* Charts Tab matching screenshot */}
        <button
          onClick={() => onTabChange('charts')}
          className={`flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-all relative ${
            activeTab === 'charts'
              ? 'text-[#00e599] font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <LineChart className="w-5 h-5" />
            {isChartsRunning && (
              <>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#38bdf8] animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
              </>
            )}
          </div>
          <span className="text-xs tracking-tight">Charts</span>
          {activeTab === 'charts' && (
            <span className="w-5 h-0.5 rounded-full bg-[#00e599] -mb-1" />
          )}
        </button>

        {/* Trade History Tab */}
        <button
          onClick={() => onTabChange('history')}
          className={`flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-all ${
            activeTab === 'history'
              ? 'text-[#00e599] font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-xs tracking-tight">History</span>
          {activeTab === 'history' && (
            <span className="w-5 h-0.5 rounded-full bg-[#00e599] -mb-1" />
          )}
        </button>
      </div>
    </div>
  );
};
