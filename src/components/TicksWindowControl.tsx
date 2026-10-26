import React from 'react';
import { RotateCcw } from 'lucide-react';

interface TicksWindowControlProps {
  ticksWindow: number;
  currentCount?: number;
  onChangeWindow: (newWindow: number) => void;
  onResetBuffer: () => void;
}

export const TicksWindowControl: React.FC<TicksWindowControlProps> = ({
  ticksWindow,
  onChangeWindow,
  onResetBuffer,
}) => {
  const presets = [30, 60, 120, 180, 300, 600, 1000];

  return (
    <div className="flex items-center justify-between gap-3 py-1 bg-[#111827]/70 border border-slate-800/80 rounded-2xl px-3 py-2 shadow-sm">
      {/* Selectable window presets: 30, 60, 120, 180, 300, 600, 1000 */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {presets.map((preset) => {
          const isSelected = ticksWindow === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChangeWindow(preset)}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-xl transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-[#00FFFF] text-slate-950 border-[#00FFFF] shadow-[0_0_14px_rgba(0,255,255,0.7)] ring-1 ring-[#00FFFF] scale-105'
                  : 'bg-[#1b253b] hover:bg-[#23304b] text-slate-300 border-slate-700/80 hover:text-white hover:border-slate-600'
              }`}
              title={`Set ticks window to ${preset}`}
            >
              {preset}
            </button>
          );
        })}
      </div>

      {/* Reset / clear buffer button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onResetBuffer}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-[#1b253b] hover:bg-[#23304b] border border-slate-700/80 transition-colors cursor-pointer"
          title="Reset and clear tick history buffer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
