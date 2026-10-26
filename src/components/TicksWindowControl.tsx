import React from 'react';

interface TicksWindowControlProps {
  ticksWindow: number;
  currentCount?: number;
  onChangeWindow: (newWindow: number) => void;
  onResetBuffer?: () => void;
}

export const TicksWindowControl: React.FC<TicksWindowControlProps> = ({
  ticksWindow,
  onChangeWindow,
}) => {
  const presets = [30, 60, 120, 180, 300, 600, 1000];

  return (
    <div className="inline-flex items-center gap-1 self-start bg-white border border-sky-200 rounded-lg px-1.5 py-0.5 shadow-xs">
      <span className="text-[9px] font-semibold text-sky-700 px-1 select-none">
        Ticks:
      </span>
      <div className="flex flex-wrap items-center gap-0.5">
        {presets.map((preset) => {
          const isSelected = ticksWindow === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChangeWindow(preset)}
              className={`px-1.5 py-0.5 text-[10px] leading-tight font-mono font-bold rounded transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-[#00FFFF] text-sky-950 border-[#00FFFF] shadow-xs'
                  : 'bg-sky-50 hover:bg-cyan-100 text-sky-700 border-sky-200 hover:border-cyan-300'
              }`}
              title={`Set ticks window to ${preset}`}
            >
              {preset}
            </button>
          );
        })}
      </div>
    </div>
  );
};
