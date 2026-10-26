import React, { useState } from 'react';
import { BotMetrics, BotStrategyConfig, NormalBotConfig } from '../types';
import { 
  Play, 
  Square, 
  Pause, 
  RotateCcw,
  ChevronUp, 
  ChevronDown, 
  Zap, 
  Cpu, 
  Settings2, 
  TrendingUp, 
  TrendingDown,
  Layers,
  Sparkles,
  Clock,
} from 'lucide-react';

export interface FloatingBotControllerProps {
  selectedBot: 'normal' | 'strategy';
  onSelectBot: (bot: 'normal' | 'strategy') => void;
  // Normal Bot
  normalBotRunning: boolean;
  normalBotPaused: boolean;
  normalBotStake: number;
  normalBotStep: number;
  normalBotMetrics: BotMetrics;
  normalBotConfig: NormalBotConfig;
  onStartNormalBot: () => void;
  onStopNormalBot: () => void;
  onPauseNormalBot: () => void;
  onResumeNormalBot: () => void;
  onResetNormalBot?: () => void;
  onToggleNormalBotSpeed?: () => void;
  // Strategy Bot
  strategyBotRunning: boolean;
  strategyBotPaused: boolean;
  strategyBotMetrics: BotMetrics;
  strategyBotConfig: BotStrategyConfig;
  onStartStrategyBot: () => void;
  onStopStrategyBot: () => void;
  onPauseStrategyBot: () => void;
  onResumeStrategyBot: () => void;
  onResetStrategyBot?: () => void;
  onToggleStrategyBotSpeed?: () => void;
  // Unified Reset
  onReset?: () => void;
  // Navigation
  onNavigateToBotSettings: (bot: 'normal' | 'strategy') => void;
  currentMarketName?: string;
  theme?: 'dark' | 'light';
}

export const FloatingBotController: React.FC<FloatingBotControllerProps> = ({
  selectedBot,
  onSelectBot,
  normalBotRunning,
  normalBotPaused,
  normalBotStake,
  normalBotStep,
  normalBotMetrics,
  normalBotConfig,
  onStartNormalBot,
  onStopNormalBot,
  onPauseNormalBot,
  onResumeNormalBot,
  strategyBotRunning,
  strategyBotPaused,
  strategyBotMetrics,
  strategyBotConfig,
  onStartStrategyBot,
  onStopStrategyBot,
  onPauseStrategyBot,
  onResumeStrategyBot,
  onResetNormalBot,
  onResetStrategyBot,
  onToggleNormalBotSpeed,
  onToggleStrategyBotSpeed,
  onReset,
  onNavigateToBotSettings,
  currentMarketName,
  theme,
}) => {
  const isLight = theme === 'light';
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const isNormal = selectedBot === 'normal';
  const isRunning = isNormal ? normalBotRunning : strategyBotRunning;
  const isPaused = isNormal ? normalBotPaused : strategyBotPaused;
  const metrics = isNormal ? normalBotMetrics : strategyBotMetrics;
  const stake = isNormal ? normalBotStake : strategyBotConfig.stake;
  const profit = metrics.totalProfit;
  const isProfitable = profit >= 0;

  const currentSpeed = isNormal
    ? (normalBotConfig.botSpeed || 'normal')
    : (strategyBotConfig.botSpeed || 'normal');
  const isFast = currentSpeed === 'fast';

  const handleToggleSpeed = () => {
    if (isNormal && onToggleNormalBotSpeed) {
      onToggleNormalBotSpeed();
    } else if (!isNormal && onToggleStrategyBotSpeed) {
      onToggleStrategyBotSpeed();
    }
  };

  const handleStart = () => {
    if (isNormal) {
      onStartNormalBot();
    } else {
      onStartStrategyBot();
    }
  };

  const handleStop = () => {
    if (isNormal) {
      onStopNormalBot();
    } else {
      onStopStrategyBot();
    }
  };

  const handleReset = () => {
    if (isNormal) {
      if (onResetNormalBot) onResetNormalBot();
      else if (onReset) onReset();
    } else {
      if (onResetStrategyBot) onResetStrategyBot();
      else if (onReset) onReset();
    }
  };

  const handleTogglePause = () => {
    if (isNormal) {
      if (normalBotPaused) {
        onResumeNormalBot();
      } else {
        onPauseNormalBot();
      }
    } else {
      if (strategyBotPaused) {
        onResumeStrategyBot();
      } else {
        onPauseStrategyBot();
      }
    }
  };

  return (
    <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-30 pointer-events-none px-3 sm:px-4">
      <div className="max-w-xl mx-auto pointer-events-auto">
        <div
          className="bg-white border border-neutral-300 text-neutral-900 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300"
        >
          {/* Header Row: Bot Selector & Collapse Button (White box header) */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b bg-neutral-50 border-neutral-200 transition-colors"
          >
            {/* Bot Segmented Selector */}
            <div
              className="flex items-center p-0.5 rounded-xl border bg-neutral-100 border-neutral-300"
            >
              <button
                type="button"
                onClick={() => onSelectBot('normal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isNormal
                    ? 'bg-[#00FFFF] text-slate-950 font-black shadow-sm shadow-[#00FFFF]/35 ring-1 ring-[#00FFFF] border border-[#00FFFF]'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Normal Bot</span>
                {normalBotRunning && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      normalBotPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-ping'
                    }`}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectBot('strategy')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !isNormal
                    ? 'bg-[#00FFFF] text-slate-950 font-black shadow-sm shadow-[#00FFFF]/35 ring-1 ring-[#00FFFF] border border-[#00FFFF]'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Strategy Bot</span>
                {strategyBotRunning && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      strategyBotPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-ping'
                    }`}
                  />
                )}
              </button>
            </div>

            {/* Status Pill & Collapse Toggle */}
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isRunning
                    ? isPaused
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRunning
                      ? isPaused
                        ? 'bg-amber-500'
                        : 'bg-emerald-600 animate-pulse'
                      : 'bg-neutral-400'
                  }`}
                />
                {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Idle'}
              </span>

              {/* Settings shortcut button */}
              <button
                type="button"
                onClick={() => onNavigateToBotSettings(selectedBot)}
                title="Configure Bot Settings"
                className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black border border-neutral-300 transition-all cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>

              {/* Minimize / Expand Button */}
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black border border-neutral-300 transition-all cursor-pointer"
                title={isCollapsed ? 'Expand Floating Bot Controller' : 'Collapse Floating Bot Controller'}
              >
                {isCollapsed ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Collapsed Bar: Quick Controls */}
          {isCollapsed ? (
            <div className="flex items-center justify-between px-3 py-2 text-xs bg-white">
              <div className="flex items-center gap-2 text-neutral-700">
                <span className="font-bold text-neutral-950">
                  {isNormal ? normalBotConfig.contractType : strategyBotConfig.tradeType}
                </span>
                <span className="text-neutral-300">•</span>
                <span className="font-mono text-neutral-600">
                  Pred:{' '}
                  <b className="text-neutral-950">
                    {isNormal ? normalBotConfig.prediction : strategyBotConfig.predictionDigit}
                  </b>
                </span>
                <span className="text-neutral-300">•</span>
                <span className="font-mono text-neutral-950 font-bold">${stake.toFixed(2)}</span>
                <span className="text-neutral-300">•</span>
                <span
                  className={`font-mono font-bold flex items-center ${
                    isProfitable ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {isProfitable ? '+' : ''}${profit.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Reset Button (placed just before Run) */}
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset bot metrics & stake"
                  className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  <RotateCcw className="w-3 h-3 text-neutral-700" />
                  <span>Reset</span>
                </button>

                {/* Speed Mode Toggle (Between Reset and Run) */}
                <button
                  type="button"
                  onClick={handleToggleSpeed}
                  title={isFast ? 'Fast Mode: Trades every tick' : 'Normal Mode: Skips 1 tick between entry & exit'}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-all active:scale-95 border ${
                    isFast
                      ? 'bg-amber-400 hover:bg-amber-300 text-black border-amber-500 shadow-amber-500/20'
                      : 'bg-white hover:bg-neutral-100 text-neutral-800 border-neutral-300'
                  }`}
                >
                  {isFast ? (
                    <>
                      <Zap className="w-3 h-3 fill-current text-black" />
                      <span>Fast</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 text-neutral-700" />
                      <span>Normal</span>
                    </>
                  )}
                </button>

                {/* Run / Stop Button */}
                {!isRunning ? (
                  <button
                    type="button"
                    onClick={handleStart}
                    className="flex items-center gap-1 px-3 py-1 bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00] rounded-lg text-xs font-black shadow-sm cursor-pointer transition-all active:scale-95"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center gap-1 px-3 py-1 bg-[#FF0000] hover:bg-[#e60000] text-white border border-[#cc0000] rounded-lg text-xs font-black shadow-sm cursor-pointer transition-all active:scale-95"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                )}

                {/* Pause / Resume Button */}
                <button
                  type="button"
                  onClick={handleTogglePause}
                  disabled={!isRunning}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer active:scale-95 ${
                    !isRunning
                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed'
                      : isPaused
                      ? 'bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00] shadow-sm'
                      : 'bg-[#000000] hover:bg-neutral-900 text-white border border-neutral-800 shadow-sm'
                  }`}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3 fill-current" />
                      <span>Pause</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Expanded View: Rich HUD & Floating Controls */
            <div className="p-3 sm:p-4 space-y-3 bg-white">
              {/* Quick Info Deck */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {/* Contract & Prediction */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Contract / Digit</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-bold text-neutral-950 text-xs">
                      {isNormal ? normalBotConfig.contractType : strategyBotConfig.tradeType}
                    </span>
                    <span className="px-1.5 py-0.2 bg-neutral-900 text-white rounded font-mono font-bold text-xs">
                      {isNormal ? normalBotConfig.prediction : strategyBotConfig.predictionDigit}
                    </span>
                  </div>
                </div>

                {/* Stake / Martingale */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                    {isNormal && normalBotStep > 0 ? `Stake (Step ${normalBotStep})` : 'Current Stake'}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 font-mono">
                    <span className="font-bold text-emerald-600 text-sm">${stake.toFixed(2)}</span>
                    <span className="text-[10px] text-neutral-500">
                      {isNormal ? `${normalBotConfig.duration}${normalBotConfig.durationUnit}` : `${strategyBotConfig.duration}${strategyBotConfig.durationUnit}`}
                    </span>
                  </div>
                </div>

                {/* Wins / Losses */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Wins / Losses</span>
                  <div className="flex items-center gap-2 mt-0.5 font-mono text-xs">
                    <span className="text-emerald-600 font-bold">{metrics.wins}W</span>
                    <span className="text-neutral-400">/</span>
                    <span className="text-rose-600 font-bold">{metrics.losses}L</span>
                    <span className="text-[10px] text-neutral-500">({metrics.winRate.toFixed(0)}%)</span>
                  </div>
                </div>

                {/* Session P/L */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Session P/L</span>
                  <div className="flex items-center gap-1 mt-0.5 font-mono">
                    {isProfitable ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span
                      className={`font-bold text-sm ${
                        isProfitable ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isProfitable ? '+' : ''}${profit.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bot Context Line */}
              <div className="flex items-center justify-between text-[11px] text-neutral-600 px-1 font-mono">
                <span className="flex items-center gap-1.5 text-neutral-700">
                  <Layers className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Market:</span>
                  <b className="text-neutral-950">{currentMarketName || (isNormal ? normalBotConfig.marketId : 'Deriv Volatility')}</b>
                </span>

                <button
                  type="button"
                  onClick={() => onNavigateToBotSettings(selectedBot)}
                  className="flex items-center gap-1 text-neutral-800 hover:text-black underline decoration-neutral-400 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-neutral-600" />
                  <span>Tune {isNormal ? 'Normal' : 'Strategy'} Bot</span>
                </button>
              </div>

              {/* Control Action Buttons Row: Reset, Speed Toggle, Run/Stop, Pause/Resume */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {/* 0. RESET BUTTON (placed just before Speed & Run) */}
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset bot metrics & martingale step"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.98]"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Reset</span>
                </button>

                {/* 1. SPEED TOGGLE BUTTON (Between Reset and Run) */}
                <button
                  type="button"
                  onClick={handleToggleSpeed}
                  title={isFast ? 'Fast Mode: Trades every tick' : 'Normal Mode: Skips 1 tick between entry & exit'}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.98] border ${
                    isFast
                      ? 'bg-amber-400 hover:bg-amber-300 text-black border-amber-500 shadow-amber-500/20'
                      : 'bg-white hover:bg-neutral-100 text-neutral-900 border-neutral-300'
                  }`}
                >
                  {isFast ? (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-current text-black" />
                      <span>Fast</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Normal</span>
                    </>
                  )}
                </button>

                {/* 2. RUN / STOP BUTTON */}
                {!isRunning ? (
                  <button
                    type="button"
                    onClick={handleStart}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00] rounded-xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#FF0000] hover:bg-[#e60000] text-white border border-[#cc0000] rounded-xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                )}

                {/* 2. PAUSE / RESUME BUTTON */}
                <button
                  type="button"
                  onClick={handleTogglePause}
                  disabled={!isRunning}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-xl font-black text-xs sm:text-sm transition-all active:scale-[0.98] ${
                    !isRunning
                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed opacity-60'
                      : isPaused
                      ? 'bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00] shadow-md cursor-pointer'
                      : 'bg-[#000000] hover:bg-neutral-900 text-white border border-neutral-800 shadow-md cursor-pointer'
                  }`}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
