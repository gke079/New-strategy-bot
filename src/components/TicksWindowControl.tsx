import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface TicksWindowControlProps {
  ticksWindow: number;
  currentCount: number;
  onChangeWindow: (newWindow: number) => void;
  onResetBuffer: () => void;
}

export const TicksWindowControl: React.FC<TicksWindowControlProps> = ({
  ticksWindow,
  currentCount,
  onChangeWindow,
  onResetBuffer,
}) => {
  const [inputValue, setInputValue] = useState<string>(ticksWindow.toString());

  useEffect(() => {
    setInputValue(ticksWindow.toString());
  }, [ticksWindow]);

  const handleBlurOrEnter = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 5000) {
      onChangeWindow(parsed);
    } else {
      setInputValue(ticksWindow.toString());
    }
  };

  const presets = [50, 100, 500, 1000];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-3">
        <label htmlFor="ticks-window-input" className="text-sm font-medium text-slate-300">
          Ticks window
        </label>
        <div className="relative">
          <input
            id="ticks-window-input"
            type="number"
            min={10}
            max={5000}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlurOrEnter}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleBlurOrEnter();
              }
            }}
            className="w-28 px-3.5 py-2 bg-[#1b253b] hover:bg-[#202d47] focus:bg-[#202d47] border border-slate-700/80 rounded-xl text-white font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#00e599]/40 text-sm transition-all"
          />
        </div>

        {/* Quick presets */}
        <div className="hidden sm:flex items-center gap-1">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => onChangeWindow(preset)}
              className={`px-2 py-1 text-xs font-mono rounded-lg transition-colors ${
                ticksWindow === preset
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2">
        {/* Reset / clear button */}
        <button
          onClick={onResetBuffer}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Clear tick history buffer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Counter badge matching screenshot (e.g. 0/1000 or 1000/1000) */}
        <div className="px-3 py-1 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono font-medium text-slate-300">
          <span className="text-white font-semibold">{currentCount}</span>
          <span className="text-slate-500">/{ticksWindow}</span>
        </div>
      </div>
    </div>
  );
};
