import React, { useState } from 'react';
import {
  BotMetrics,
  BotStrategyConfig,
  BotSubTab,
  EntryBotConfig,
  EvenOddBotConfig,
  NormalBotConfig,
} from '../types';
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Zap,
  Cpu,
  Crosshair,
  ArrowLeftRight,
  Settings2,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  Clock,
  Bot,
  Minimize2,
} from 'lucide-react';

export interface FloatingBotControllerProps {
  selectedBot: BotSubTab;
  onSelectBot: (bot: BotSubTab) => void;
  // Normal Bot
  normalBotRunning: boolean;
  normalBotPaused: boolean;
  normalBotWaitingForEntry?: boolean;
  normalBotEntryStatus?: string;
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
  // Entry Bot
  entryBotRunning: boolean;
  entryBotPaused: boolean;
  entryBotWaiting?: boolean;
  entryBotStatus?: string;
  entryBotStake: number;
  entryBotStep: number;
  entryBotMetrics: BotMetrics;
  entryBotConfig: EntryBotConfig;
  onStartEntryBot: () => void;
  onStopEntryBot: () => void;
  onPauseEntryBot: () => void;
  onResumeEntryBot: () => void;
  onResetEntryBot?: () => void;
  onToggleEntryBotSpeed?: () => void;
  // EvenOdd Bot
  evenOddBotRunning: boolean;
  evenOddBotPaused: boolean;
  evenOddBotWaiting?: boolean;
  evenOddBotStatus?: string;
  evenOddBotStake: number;
  evenOddBotStep: number;
  evenOddBotMetrics: BotMetrics;
  evenOddBotConfig: EvenOddBotConfig;
  onStartEvenOddBot: () => void;
  onStopEvenOddBot: () => void;
  onPauseEvenOddBot: () => void;
  onResumeEvenOddBot: () => void;
  onResetEvenOddBot?: () => void;
  onToggleEvenOddBotSpeed?: () => void;
  // Unified Reset
  onReset?: () => void;
  // Navigation
  onNavigateToBotSettings: (bot: BotSubTab) => void;
  currentMarketName?: string;
  theme?: 'dark' | 'light';
}

export const FloatingBotController: React.FC<FloatingBotControllerProps> = ({
  selectedBot,
  onSelectBot,
  normalBotRunning,
  normalBotPaused,
  normalBotWaitingForEntry = false,
  normalBotEntryStatus = '',
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
  entryBotRunning,
  entryBotPaused,
  entryBotWaiting = false,
  entryBotStatus = '',
  entryBotStake,
  entryBotStep,
  entryBotMetrics,
  entryBotConfig,
  onStartEntryBot,
  onStopEntryBot,
  onPauseEntryBot,
  onResumeEntryBot,
  onResetEntryBot,
  onToggleEntryBotSpeed,
  evenOddBotRunning,
  evenOddBotPaused,
  evenOddBotWaiting = false,
  evenOddBotStatus = '',
  evenOddBotStake,
  evenOddBotStep,
  evenOddBotMetrics,
  evenOddBotConfig,
  onStartEvenOddBot,
  onStopEvenOddBot,
  onPauseEvenOddBot,
  onResumeEvenOddBot,
  onResetEvenOddBot,
  onToggleEvenOddBotSpeed,
  onReset,
  onNavigateToBotSettings,
  currentMarketName,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isDockedOrb, setIsDockedOrb] = useState<boolean>(false);

  const isRunning =
    selectedBot === 'normal'
      ? normalBotRunning
      : selectedBot === 'strategy'
      ? strategyBotRunning
      : selectedBot === 'entry'
      ? entryBotRunning
      : evenOddBotRunning;

  const isPaused =
    selectedBot === 'normal'
      ? normalBotPaused
      : selectedBot === 'strategy'
      ? strategyBotPaused
      : selectedBot === 'entry'
      ? entryBotPaused
      : evenOddBotPaused;

  const isWaiting =
    selectedBot === 'normal'
      ? normalBotWaitingForEntry
      : selectedBot === 'entry'
      ? entryBotWaiting
      : selectedBot === 'evenodd'
      ? evenOddBotWaiting
      : false;

  const waitingTooltip =
    selectedBot === 'normal'
      ? normalBotEntryStatus
      : selectedBot === 'entry'
      ? entryBotStatus
      : selectedBot === 'evenodd'
      ? evenOddBotStatus
      : undefined;

  const metrics =
    selectedBot === 'normal'
      ? normalBotMetrics
      : selectedBot === 'strategy'
      ? strategyBotMetrics
      : selectedBot === 'entry'
      ? entryBotMetrics
      : evenOddBotMetrics;

  const stake =
    selectedBot === 'normal'
      ? normalBotStake
      : selectedBot === 'strategy'
      ? strategyBotConfig.stake
      : selectedBot === 'entry'
      ? entryBotStake
      : evenOddBotStake;

  const step =
    selectedBot === 'normal'
      ? normalBotStep
      : selectedBot === 'entry'
      ? entryBotStep
      : selectedBot === 'evenodd'
      ? evenOddBotStep
      : 0;

  const profit = metrics.sessionProfit ?? metrics.totalProfit;
  const isProfitable = profit >= 0;
  const stopReason = metrics.lastStopReason || '';
  const isTpStop = !isRunning && stopReason.toLowerCase().includes('take profit');
  const isSlStop = !isRunning && stopReason.toLowerCase().includes('stop loss');

  const tpTarget =
    selectedBot === 'normal'
      ? normalBotConfig.takeProfit
      : selectedBot === 'strategy'
      ? strategyBotConfig.takeProfit
      : selectedBot === 'entry'
      ? entryBotConfig.takeProfit
      : evenOddBotConfig.takeProfit;

  const slTarget =
    selectedBot === 'normal'
      ? normalBotConfig.stopLoss
      : selectedBot === 'strategy'
      ? strategyBotConfig.stopLoss
      : selectedBot === 'entry'
      ? entryBotConfig.stopLoss
      : evenOddBotConfig.stopLoss;

  const currentSpeed =
    selectedBot === 'normal'
      ? normalBotConfig.botSpeed || 'normal'
      : selectedBot === 'strategy'
      ? strategyBotConfig.botSpeed || 'normal'
      : selectedBot === 'entry'
      ? entryBotConfig.botSpeed || 'normal'
      : evenOddBotConfig.botSpeed || 'normal';
  const isFast = currentSpeed === 'fast';

  const botTitle =
    selectedBot === 'normal'
      ? 'Normal Bot'
      : selectedBot === 'strategy'
      ? 'Strategy Bot'
      : selectedBot === 'entry'
      ? 'Entry Bot'
      : 'EvenOdd Bot';

  const contractSummary =
    selectedBot === 'normal'
      ? normalBotConfig.contractType
      : selectedBot === 'strategy'
      ? strategyBotConfig.tradeType
      : selectedBot === 'entry'
      ? `${entryBotConfig.contractType1}/${entryBotConfig.contractType2}`
      : `${evenOddBotConfig.strategy} · ${evenOddBotConfig.marketSide}`;

  const predictionSummary =
    selectedBot === 'normal'
      ? String(normalBotConfig.prediction)
      : selectedBot === 'strategy'
      ? String(strategyBotConfig.predictionDigit)
      : selectedBot === 'entry'
      ? `#${entryBotConfig.searchNumber}→${entryBotConfig.prediction1}/${entryBotConfig.prediction2}`
      : evenOddBotConfig.marketSide;

  const durationSummary =
    selectedBot === 'normal'
      ? `${normalBotConfig.duration}${normalBotConfig.durationUnit}`
      : selectedBot === 'strategy'
      ? `${strategyBotConfig.duration}${strategyBotConfig.durationUnit}`
      : selectedBot === 'entry'
      ? `${entryBotConfig.duration}${entryBotConfig.durationUnit}`
      : `${evenOddBotConfig.duration}${evenOddBotConfig.durationUnit}`;

  const handleToggleSpeed = () => {
    if (selectedBot === 'normal') onToggleNormalBotSpeed?.();
    else if (selectedBot === 'strategy') onToggleStrategyBotSpeed?.();
    else if (selectedBot === 'entry') onToggleEntryBotSpeed?.();
    else onToggleEvenOddBotSpeed?.();
  };

  const handleStart = () => {
    if (selectedBot === 'normal') onStartNormalBot();
    else if (selectedBot === 'strategy') onStartStrategyBot();
    else if (selectedBot === 'entry') onStartEntryBot();
    else onStartEvenOddBot();
  };

  const handleStop = () => {
    if (selectedBot === 'normal') onStopNormalBot();
    else if (selectedBot === 'strategy') onStopStrategyBot();
    else if (selectedBot === 'entry') onStopEntryBot();
    else onStopEvenOddBot();
  };

  const handleReset = () => {
    if (selectedBot === 'normal') {
      if (onResetNormalBot) onResetNormalBot();
      else onReset?.();
    } else if (selectedBot === 'strategy') {
      if (onResetStrategyBot) onResetStrategyBot();
      else onReset?.();
    } else if (selectedBot === 'entry') {
      if (onResetEntryBot) onResetEntryBot();
      else onReset?.();
    } else {
      if (onResetEvenOddBot) onResetEvenOddBot();
      else onReset?.();
    }
  };

  const handleTogglePause = () => {
    if (selectedBot === 'normal') {
      if (normalBotPaused) onResumeNormalBot();
      else onPauseNormalBot();
    } else if (selectedBot === 'strategy') {
      if (strategyBotPaused) onResumeStrategyBot();
      else onPauseStrategyBot();
    } else if (selectedBot === 'entry') {
      if (entryBotPaused) onResumeEntryBot();
      else onPauseEntryBot();
    } else {
      if (evenOddBotPaused) onResumeEvenOddBot();
      else onPauseEvenOddBot();
    }
  };

  if (isDockedOrb) {
    return (
      <div className="fixed bottom-20 right-4 z-40 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsDockedOrb(false)}
          title="Open Floating Robot Controller"
          className="flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 rounded-full bg-white hover:bg-sky-50 border-2 border-[#00FFFF] shadow-2xl text-neutral-900 cursor-pointer transition-all active:scale-95"
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#00FFFF] text-slate-950 shadow-xs">
            <Bot className="w-4 h-4 stroke-[2.5]" />
            {isRunning && (
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                  isPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-ping'
                }`}
              />
            )}
          </span>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[11px] font-extrabold text-neutral-950">{botTitle}</span>
            <span
              className={`font-mono tabular-nums text-[11px] font-bold ${
                isProfitable ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {isRunning ? (isPaused ? 'Paused · ' : 'Live · ') : ''}
              {isProfitable ? '+' : ''}${profit.toFixed(2)}
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-40 pointer-events-none px-3 sm:px-4">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="bg-white border border-neutral-300 text-neutral-900 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300">
          {/* Header Row: Robot Icon, Bot Selector & Collapse Controls */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-neutral-50 border-neutral-200 transition-colors gap-2">
            <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setIsDockedOrb(true)}
                title="Dock to Floating Robot Icon"
                className="w-7 h-7 rounded-lg bg-[#00FFFF] text-slate-950 flex items-center justify-center shrink-0 shadow-2xs cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Bot className="w-4 h-4 stroke-[2.25]" />
              </button>

              {/* Bot Segmented Selector (4 Bots) */}
              <div className="flex items-center p-0.5 rounded-xl border bg-neutral-100 border-neutral-300 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => onSelectBot('normal')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedBot === 'normal'
                      ? 'bg-[#00FFFF] text-slate-950 font-black shadow-sm ring-1 ring-[#00FFFF]'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Normal</span>
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
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedBot === 'strategy'
                      ? 'bg-[#00FFFF] text-slate-950 font-black shadow-sm ring-1 ring-[#00FFFF]'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Strategy</span>
                  {strategyBotRunning && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        strategyBotPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-ping'
                      }`}
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSelectBot('entry')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedBot === 'entry'
                      ? 'bg-[#00FFFF] text-slate-950 font-black shadow-sm ring-1 ring-[#00FFFF]'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Entry</span>
                  {entryBotRunning && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        entryBotPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-ping'
                      }`}
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSelectBot('evenodd')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedBot === 'evenodd'
                      ? 'bg-[#00FFFF] text-slate-950 font-black shadow-sm ring-1 ring-[#00FFFF]'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>EvenOdd</span>
                  {evenOddBotRunning && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        evenOddBotPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-ping'
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>

            {/* Status & Collapse / Dock Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                  isRunning
                    ? isPaused || isWaiting
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                }`}
                title={isWaiting ? waitingTooltip : undefined}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRunning
                      ? isPaused || isWaiting
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-emerald-600 animate-pulse'
                      : 'bg-neutral-400'
                  }`}
                />
                {isRunning ? (isPaused ? 'Paused' : isWaiting ? 'Waiting' : 'Running') : 'Idle'}
              </span>

              <button
                type="button"
                onClick={() => onNavigateToBotSettings(selectedBot)}
                title="Configure Bot Settings"
                className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black border border-neutral-300 transition-all cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black border border-neutral-300 transition-all cursor-pointer"
                title={isCollapsed ? 'Expand Floating Robot' : 'Compact Bar'}
              >
                {isCollapsed ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsDockedOrb(true)}
                className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-all cursor-pointer"
                title="Minimize to Floating Robot Icon"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Collapsed Bar */}
          {isCollapsed ? (
            <div className="flex items-center justify-between px-3 py-2 text-xs bg-white gap-2">
              <div className="flex items-center gap-2 text-neutral-700 min-w-0 truncate tabular-nums">
                <span className="font-bold text-neutral-950">{contractSummary}</span>
                <span className="text-neutral-300">•</span>
                <span className="font-mono text-neutral-600">
                  <b className="text-neutral-950">{predictionSummary}</b>
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

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset bot metrics & stake"
                  className="flex items-center gap-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3 text-sky-600" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleSpeed}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-all active:scale-95 border whitespace-nowrap ${
                    isFast
                      ? 'bg-amber-400 hover:bg-amber-300 text-black border-amber-500'
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

                {!isRunning ? (
                  <button
                    type="button"
                    onClick={handleStart}
                    className="flex items-center gap-1 px-3 py-1 bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00] rounded-lg text-xs font-black shadow-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center gap-1 px-3 py-1 bg-[#FF0000] hover:bg-[#e60000] text-rose-50 border border-[#cc0000] rounded-lg text-xs font-black shadow-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTogglePause}
                  disabled={!isRunning}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
                    !isRunning
                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed'
                      : isPaused
                      ? 'bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00] shadow-sm'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 shadow-sm'
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
            <div className="p-3 sm:p-4 space-y-3 bg-white">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                    Contract / Setup
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <span className="font-bold text-neutral-950 text-xs">{contractSummary}</span>
                    <span className="px-1.5 py-0.5 bg-blue-600 text-sky-50 rounded font-mono font-bold text-[11px]">
                      {predictionSummary}
                    </span>
                  </div>
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                    {step > 0 ? `Stake (Step ${step})` : 'Current Stake'}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 font-mono">
                    <span className="font-bold text-emerald-600 text-sm">${stake.toFixed(2)}</span>
                    <span className="text-[10px] text-neutral-500">{durationSummary}</span>
                  </div>
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 flex flex-col justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                    Wins / Losses
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 font-mono text-xs">
                    <span className="text-emerald-600 font-bold">{metrics.wins}W</span>
                    <span className="text-neutral-400">/</span>
                    <span className="text-rose-600 font-bold">{metrics.losses}L</span>
                    <span className="text-[10px] text-neutral-500">
                      ({metrics.winRate.toFixed(0)}%)
                    </span>
                  </div>
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                      Session P/L
                    </span>
                    <span className="text-[9px] font-mono text-neutral-400">
                      TP ${tpTarget.toFixed(1)} / SL ${slTarget.toFixed(1)}
                    </span>
                  </div>
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
                      {isProfitable ? '+' : '-'}${Math.abs(profit).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {(isTpStop || isSlStop) && (
                <div
                  className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-between gap-2 ${
                    isTpStop
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <span>{stopReason}</span>
                  <span className="font-mono font-bold tabular-nums">
                    {isProfitable ? '+' : '-'}${Math.abs(profit).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-neutral-600 px-1 font-mono">
                <span className="flex items-center gap-1.5 text-neutral-700">
                  <Layers className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Market:</span>
                  <b className="text-neutral-950">{currentMarketName || 'Deriv Volatility'}</b>
                </span>

                <button
                  type="button"
                  onClick={() => onNavigateToBotSettings(selectedBot)}
                  className="flex items-center gap-1 text-neutral-800 hover:text-black underline decoration-neutral-400 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-neutral-600" />
                  <span>Tune {botTitle}</span>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleSpeed}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.98] border whitespace-nowrap ${
                    isFast
                      ? 'bg-amber-400 hover:bg-amber-300 text-black border-amber-500'
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

                {!isRunning ? (
                  <button
                    type="button"
                    onClick={handleStart}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00] rounded-xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#FF0000] hover:bg-[#e60000] text-rose-50 border border-[#cc0000] rounded-xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTogglePause}
                  disabled={!isRunning}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-xl font-black text-xs sm:text-sm transition-all active:scale-[0.98] whitespace-nowrap ${
                    !isRunning
                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed opacity-60'
                      : isPaused
                      ? 'bg-[#00FF00] hover:bg-[#00e600] text-black border border-[#00cc00] shadow-md cursor-pointer'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 shadow-md cursor-pointer'
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

