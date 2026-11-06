import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Market,
  Tick,
  BotStrategyConfig,
  BotMetrics,
  BotSubTab,
  Trade,
  UserAccount,
  NormalBotConfig,
  EntryBotConfig,
  EvenOddBotConfig,
  XmlBotConfig,
  XmlBotStage,
  XmlJournalEntry,
  isContinuousDirectionalContract,
} from './types';
import { DEFAULT_MARKET, SYNTHETIC_MARKETS, normalizeMarketId } from './services/markets';
import { TickStreamEngine, ConnectionStatus, DerivAccountInfo } from './services/tickEngine';
import { calculateDigitStats, calculateRatioStats } from './services/statsEngine';
import { BotExecutor } from './services/botEngine';
import { NormalBotExecutor, ActiveContract } from './services/normalBotEngine';
import { EntryBotExecutor } from './services/entryBotEngine';
import { EvenOddBotExecutor } from './services/evenOddBotEngine';
import { XmlBotExecutor } from './services/xmlBotEngine';
import { DEFAULT_XML_BOT_CONFIG } from './services/derivXmlBridge';
import { soundManager } from './services/soundEffects';

import { Header } from './components/Header';
import { MarketSelector } from './components/MarketSelector';
import { TickCard } from './components/TickCard';
import { TicksWindowControl } from './components/TicksWindowControl';
import { DigitCirclesGrid } from './components/DigitCirclesGrid';
import { RatioCards } from './components/RatioCards';
import { LastDigitsRibbon } from './components/LastDigitsRibbon';
import { BotStrategyPanel } from './components/BotStrategyPanel';
import { NormalBotPanel } from './components/NormalBotPanel';
import { EntryBotPanel } from './components/EntryBotPanel';
import { EvenOddBotPanel } from './components/EvenOddBotPanel';
import { BotBuilderView } from './components/BotBuilderView';
import {
  SignalsView,
  SignalExecutionRequest,
  ActiveSignalSession,
} from './components/SignalsView';
import { ChartsView } from './components/ChartsView';
import { TradesHistoryView } from './components/TradesHistoryView';
import { BottomNavigation, ActiveTab } from './components/BottomNavigation';
import { DerivApiModal } from './components/DerivApiModal';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';
import { FloatingBotController } from './components/FloatingBotController';
import { Zap, Cpu, Crosshair, ArrowLeftRight, ShieldCheck } from 'lucide-react';

export default function App() {
  const [selectedMarket, setSelectedMarket] = useState<Market>(DEFAULT_MARKET);
  const [ticksWindow, setTicksWindow] = useState<number>(1000);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isLiveFeed, setIsLiveFeed] = useState<boolean>(false);
  const [tickSpeedMs, setTickSpeedMs] = useState<number>(1000);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('tickedge_theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    localStorage.setItem('tickedge_theme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Tabs & Modals
  const [activeTab, setActiveTab] = useState<ActiveTab>('digits');
  const [currentView, setCurrentView] = useState<'dashboard' | 'login'>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('view') === 'login' || urlParams.get('login') === '1') {
        return 'login';
      }
    } catch {}
    return 'dashboard';
  });
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Deriv Account Details & Auth Error
  const [derivAccountInfo, setDerivAccountInfo] = useState<DerivAccountInfo | null>(null);
  const [derivAuthError, setDerivAuthError] = useState<string | null>(null);

  // User Account (Synchronized live from Deriv)
  const [userAccount, setUserAccount] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem('tickedge_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isLoggedIn) {
          const safeBalance = parsed.balance && parsed.balance > 0 ? parsed.balance : 10000.0;
          return { ...parsed, balance: safeBalance };
        }
      }
    } catch {}
    return {
      isLoggedIn: false,
      username: '',
      email: '',
      balance: 10000.0,
      currency: 'USD',
      isDemo: true,
    };
  });

  // ==========================================
  // 1. DIGITS TAB BOT (INDEPENDENT)
  // ==========================================
  const [digitsBotConfig, setDigitsBotConfig] = useState<BotStrategyConfig>(() => {
    try {
      const v3Migrated = localStorage.getItem('tickedge_tp_double_stake_v3');
      const saved = localStorage.getItem('tickedge_digits_bot_strategy');
      if (saved) {
        const parsed = JSON.parse(saved);
        const resolvedExecMode = isContinuousDirectionalContract(parsed.tradeType)
          ? ('continuous' as const)
          : parsed.executionMode || ('continuous' as const);
        if (!v3Migrated) {
          const s = parsed.stake === 1.0 ? 0.35 : parsed.stake || 0.35;
          const next = {
            ...parsed,
            stake: s,
            initialStake: s,
            martingale: parsed.martingale === 2.0 ? 1.5 : parsed.martingale || 1.5,
            duration: 1,
            durationUnit: 't' as const,
            takeProfit: parsed.takeProfit === 0.1 || !parsed.takeProfit ? Number((s * 2).toFixed(2)) : parsed.takeProfit,
            executionMode: resolvedExecMode,
          };
          localStorage.setItem('tickedge_digits_bot_strategy', JSON.stringify(next));
          return { ...next, marketId: normalizeMarketId(next.marketId) };
        }
        return {
          ...parsed,
          marketId: normalizeMarketId(parsed.marketId),
          executionMode: resolvedExecMode,
        };
      }
      // Legacy fallback
      const legacy = localStorage.getItem('tickedge_saved_strategy');
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        return {
          ...parsedLegacy,
          stake: 0.35,
          initialStake: 0.35,
          martingale: 1.5,
          duration: 1,
          durationUnit: 't' as const,
          takeProfit: 0.7,
          executionMode: 'continuous' as const,
        };
      }
    } catch {}
    return {
      id: 'digits-bot',
      name: 'Over 2 after 3 lows',
      marketId: DEFAULT_MARKET.id,
      entryCondition: 'under_x',
      n: 3,
      xDigit: 3,
      pPercent: 8,
      tradeType: 'OVER',
      predictionDigit: 2,
      duration: 1,
      durationUnit: 't',
      stake: 0.35,
      initialStake: 0.35,
      martingale: 1.5,
      maxSteps: 4,
      takeProfit: 0.7,
      stopLoss: 20.0,
      active: false,
      executionMode: 'continuous',
    };
  });

  const [digitsBotRunning, setDigitsBotRunning] = useState<boolean>(false);
  const [digitsBotMetrics, setDigitsBotMetrics] = useState<BotMetrics>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    currentStreak: { type: null, count: 0 },
    maxDrawdown: 0,
    peakBalance: 10000,
  });

  // ==========================================
  // 2. CHARTS TAB BOT (INDEPENDENT)
  // ==========================================
  const [chartsBotConfig, setChartsBotConfig] = useState<BotStrategyConfig>(() => {
    try {
      const v3Migrated = localStorage.getItem('tickedge_tp_double_stake_v3');
      const saved = localStorage.getItem('tickedge_charts_bot_strategy');
      if (saved) {
        const parsed = JSON.parse(saved);
        const resolvedExecMode = isContinuousDirectionalContract(parsed.tradeType)
          ? ('continuous' as const)
          : parsed.executionMode || ('continuous' as const);
        if (!v3Migrated) {
          const s = parsed.stake === 1.0 ? 0.35 : parsed.stake || 0.35;
          const next = {
            ...parsed,
            stake: s,
            initialStake: s,
            martingale: parsed.martingale === 2.0 ? 1.5 : parsed.martingale || 1.5,
            duration: 1,
            durationUnit: 't' as const,
            takeProfit: parsed.takeProfit === 0.1 || !parsed.takeProfit ? Number((s * 2).toFixed(2)) : parsed.takeProfit,
            executionMode: resolvedExecMode,
          };
          localStorage.setItem('tickedge_charts_bot_strategy', JSON.stringify(next));
          return { ...next, marketId: normalizeMarketId(next.marketId) };
        }
        return {
          ...parsed,
          marketId: normalizeMarketId(parsed.marketId),
          executionMode: resolvedExecMode,
        };
      }
    } catch {}
    return {
      id: 'charts-bot',
      name: '3 Rising ticks then Fall Trend Bot',
      marketId: DEFAULT_MARKET.id,
      entryCondition: 'n_rising_then_falling',
      n: 3,
      xDigit: 3,
      pPercent: 0,
      tradeType: 'FALL',
      predictionDigit: 5,
      duration: 1,
      durationUnit: 't',
      stake: 0.35,
      initialStake: 0.35,
      martingale: 1.5,
      maxSteps: 4,
      takeProfit: 0.7,
      stopLoss: 25.0,
      active: false,
      executionMode: 'continuous',
    };
  });

  const [chartsBotRunning, setChartsBotRunning] = useState<boolean>(false);
  const [chartsBotPaused, setChartsBotPaused] = useState<boolean>(false);
  const [chartsBotMetrics, setChartsBotMetrics] = useState<BotMetrics>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    currentStreak: { type: null, count: 0 },
    maxDrawdown: 0,
    peakBalance: 10000,
  });

  // ==========================================
  // 3. NORMAL BOT (DIRECT CONTINUOUS EXECUTION)
  // ==========================================
  const [botsTabSubView, setBotsTabSubView] = useState<BotSubTab>('normal');
  const [floatingBotSelection, setFloatingBotSelection] = useState<BotSubTab>('normal');
  const [normalBotConfig, setNormalBotConfig] = useState<NormalBotConfig>(() => {
    try {
      const v3Migrated = localStorage.getItem('tickedge_tp_double_stake_v3');
      const saved = localStorage.getItem('tickedge_normal_bot_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        let next = parsed;
        if (parsed.contractType === 'ENDS_BETWEEN' || parsed.contractType === 'ENDS_OUTSIDE') {
          next = {
            ...next,
            contractType: 'HIGH_TICK',
            prediction: 5,
            duration: 5,
            durationUnit: 't',
            signalEntryTrigger: 'immediate',
          };
        }
        if (!v3Migrated) {
          const isHighLow = next.contractType === 'HIGH_TICK' || next.contractType === 'LOW_TICK';
          const isOnlyUpDown = next.contractType === 'ONLY_UP' || next.contractType === 'ONLY_DOWN';
          const isDigitOrEvenOdd = ['OVER', 'UNDER', 'EVEN', 'ODD', 'DIFFERS', 'MATCHES'].includes(next.contractType);
          const s = next.stake === 1.0 ? 0.35 : next.stake || 0.35;
          next = {
            ...next,
            stake: s,
            initialStake: s,
            martingale: next.martingale === 2.0 ? 1.5 : next.martingale || 1.5,
            duration: isHighLow || isOnlyUpDown ? 5 : isDigitOrEvenOdd ? 1 : (next.duration || 1),
            durationUnit: 't' as const,
            takeProfit: next.takeProfit === 0.1 || !next.takeProfit ? Number((s * 2).toFixed(2)) : next.takeProfit,
          };
          localStorage.setItem('tickedge_tp_double_stake_v3', '1');
          localStorage.setItem('tickedge_normal_bot_config', JSON.stringify(next));
        }
        return { ...next, marketId: normalizeMarketId(next.marketId) };
      }
      localStorage.setItem('tickedge_tp_double_stake_v3', '1');
    } catch {}
    return {
      id: 'normal-bot',
      name: 'Normal Bot',
      marketId: DEFAULT_MARKET.id,
      contractType: 'OVER',
      prediction: 2,
      stake: 0.35,
      initialStake: 0.35,
      duration: 1,
      durationUnit: 't',
      takeProfit: 0.7,
      stopLoss: 20.0,
      martingale: 1.5,
      martingaleLevel: 4,
      active: false,
    };
  });

  const [normalBotRunning, setNormalBotRunning] = useState<boolean>(false);
  const [normalBotPaused, setNormalBotPaused] = useState<boolean>(false);
  const [normalBotMetrics, setNormalBotMetrics] = useState<BotMetrics>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    currentStreak: { type: null, count: 0 },
    maxDrawdown: 0,
    peakBalance: 10000,
  });
  const [normalBotStake, setNormalBotStake] = useState<number>(normalBotConfig.stake);
  const [normalBotStep, setNormalBotStep] = useState<number>(0);
  const [normalBotActiveContract, setNormalBotActiveContract] = useState<ActiveContract | null>(null);
  const [normalBotWaitingForEntry, setNormalBotWaitingForEntry] = useState<boolean>(false);
  const [normalBotEntryStatus, setNormalBotEntryStatus] = useState<string>('');

  // ==========================================
  // 3B. ENTRY BOT (SEARCH NUMBER + P1 PRIMARY / P2 RECOVERY)
  // ==========================================
  const [entryBotConfig, setEntryBotConfig] = useState<EntryBotConfig>(() => {
    try {
      const saved = localStorage.getItem('tickedge_entry_bot_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          marketId: normalizeMarketId(parsed.marketId),
        };
      }
    } catch {}
    return {
      id: 'entry-bot',
      name: 'Entry Bot',
      marketId: DEFAULT_MARKET.id,
      contractType1: 'OVER',
      prediction1: 2,
      contractType2: 'OVER',
      prediction2: 1,
      searchNumber: 0,
      entryTriggerMode: 'every_cycle',
      stake: 0.35,
      initialStake: 0.35,
      duration: 1,
      durationUnit: 't',
      takeProfit: 0.7,
      stopLoss: 20.0,
      martingale: 1.8,
      martingaleLevel: 5,
      botSpeed: 'normal',
      active: false,
    };
  });
  const [entryBotRunning, setEntryBotRunning] = useState<boolean>(false);
  const [entryBotPaused, setEntryBotPaused] = useState<boolean>(false);
  const [entryBotInRecovery, setEntryBotInRecovery] = useState<boolean>(false);
  const [entryBotWaiting, setEntryBotWaiting] = useState<boolean>(false);
  const [entryBotStatusText, setEntryBotStatusText] = useState<string>('');
  const [entryBotStake, setEntryBotStake] = useState<number>(entryBotConfig.stake);
  const [entryBotStep, setEntryBotStep] = useState<number>(0);
  const [entryBotActiveContract, setEntryBotActiveContract] = useState<ActiveContract | null>(null);
  const [entryBotMetrics, setEntryBotMetrics] = useState<BotMetrics>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    currentStreak: { type: null, count: 0 },
    maxDrawdown: 0,
    peakBalance: 10000,
  });

  // ==========================================
  // 3C. EVENODD BOT (S1 & S2 STRATEGIES)
  // ==========================================
  const [evenOddBotConfig, setEvenOddBotConfig] = useState<EvenOddBotConfig>(() => {
    try {
      const saved = localStorage.getItem('tickedge_evenodd_bot_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          marketId: normalizeMarketId(parsed.marketId),
        };
      }
    } catch {}
    return {
      id: 'evenodd-bot',
      name: 'EvenOdd Bot',
      marketId: DEFAULT_MARKET.id,
      marketSide: 'EVEN',
      strategy: 'S1',
      executionMode: 'continuous',
      stake: 0.35,
      initialStake: 0.35,
      duration: 1,
      durationUnit: 't',
      takeProfit: 0.7,
      stopLoss: 20.0,
      martingale: 2.1,
      martingaleLevel: 5,
      botSpeed: 'normal',
      active: false,
    };
  });
  const [evenOddBotRunning, setEvenOddBotRunning] = useState<boolean>(false);
  const [evenOddBotPaused, setEvenOddBotPaused] = useState<boolean>(false);
  const [evenOddBotWaiting, setEvenOddBotWaiting] = useState<boolean>(false);
  const [evenOddBotStageLabel, setEvenOddBotStageLabel] = useState<string>('Idle');
  const [evenOddBotStatusText, setEvenOddBotStatusText] = useState<string>('');
  const [evenOddBotStake, setEvenOddBotStake] = useState<number>(evenOddBotConfig.stake);
  const [evenOddBotStep, setEvenOddBotStep] = useState<number>(0);
  const [evenOddBotActiveContract, setEvenOddBotActiveContract] = useState<ActiveContract | null>(null);
  const [evenOddBotMetrics, setEvenOddBotMetrics] = useState<BotMetrics>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    currentStreak: { type: null, count: 0 },
    maxDrawdown: 0,
    peakBalance: 10000,
  });

  // ==========================================
  // 4. DERIV XML BOT BUILDER (BLOCKLY & STRUCTURED)
  // ==========================================
  const [xmlBotConfig, setXmlBotConfig] = useState<XmlBotConfig>(() => {
    try {
      const saved = localStorage.getItem('tickedge_xml_bot_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, marketId: normalizeMarketId(parsed.marketId) };
      }
    } catch {}
    return DEFAULT_XML_BOT_CONFIG;
  });
  const [xmlBotRunning, setXmlBotRunning] = useState<boolean>(false);
  const [xmlBotPaused, setXmlBotPaused] = useState<boolean>(false);
  const [xmlBotStage, setXmlBotStage] = useState<XmlBotStage>('idle');
  const [xmlBotStake, setXmlBotStake] = useState<number>(xmlBotConfig.initialStake);
  const [xmlBotStep, setXmlBotStep] = useState<number>(0);
  const [xmlBotJournal, setXmlBotJournal] = useState<XmlJournalEntry[]>([]);
  const [xmlBotMetrics, setXmlBotMetrics] = useState<BotMetrics>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    currentStreak: { type: null, count: 0 },
    maxDrawdown: 0,
    peakBalance: 10000,
  });

  // Active Signal session running on Normal Bot (strictly scoped by category)
  const [activeSignal, setActiveSignal] = useState<ActiveSignalSession | null>(null);

  // Unified trades history
  const [trades, setTrades] = useState<Trade[]>([]);

  // References to keep singleton instances
  const engineRef = useRef<TickStreamEngine | null>(null);
  const selectedMarketRef = useRef<Market>(selectedMarket);
  const digitsBotExecutorRef = useRef<BotExecutor | null>(null);
  const chartsBotExecutorRef = useRef<BotExecutor | null>(null);
  const normalBotExecutorRef = useRef<NormalBotExecutor | null>(null);
  const entryBotExecutorRef = useRef<EntryBotExecutor | null>(null);
  const evenOddBotExecutorRef = useRef<EvenOddBotExecutor | null>(null);
  const xmlBotExecutorRef = useRef<XmlBotExecutor | null>(null);

  const syncAllExecutorsBalance = (balance: number) => {
    digitsBotExecutorRef.current?.setBalance(balance);
    chartsBotExecutorRef.current?.setBalance(balance);
    normalBotExecutorRef.current?.setBalance(balance);
    entryBotExecutorRef.current?.setBalance(balance);
    evenOddBotExecutorRef.current?.setBalance(balance);
    xmlBotExecutorRef.current?.setBalance(balance);
  };

  // Initialize Tick Engine & Independent Bot Executors once
  useEffect(() => {
    const engine = new TickStreamEngine(selectedMarket, ticksWindow);
    engineRef.current = engine;

    // Independent Digits Bot Executor
    const digitsBot = new BotExecutor(digitsBotConfig, userAccount.balance, 'digits');
    digitsBotExecutorRef.current = digitsBot;

    // Independent Charts Bot Executor
    const chartsBot = new BotExecutor(chartsBotConfig, userAccount.balance, 'charts');
    chartsBotExecutorRef.current = chartsBot;

    // Independent Normal Bot Executor (Direct Execution)
    const normalBot = new NormalBotExecutor(normalBotConfig, userAccount.balance);
    normalBotExecutorRef.current = normalBot;

    // Independent Entry Bot Executor
    const entryBot = new EntryBotExecutor(entryBotConfig, userAccount.balance);
    entryBotExecutorRef.current = entryBot;

    // Independent EvenOdd Bot Executor
    const evenOddBot = new EvenOddBotExecutor(evenOddBotConfig, userAccount.balance);
    evenOddBotExecutorRef.current = evenOddBot;

    // Independent Deriv XML Bot Executor
    const xmlBot = new XmlBotExecutor(xmlBotConfig, userAccount.balance);
    xmlBotExecutorRef.current = xmlBot;

    // Listen to Digits bot trades
    const unsubDigitsTrade = digitsBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setDigitsBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      syncAllExecutorsBalance(balance);
    });

    const unsubDigitsStatus = digitsBot.onStatusChange((running) => {
      setDigitsBotRunning(running);
      setDigitsBotMetrics(digitsBot.getMetrics());
    });

    // Listen to Charts bot trades
    const unsubChartsTrade = chartsBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setChartsBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      syncAllExecutorsBalance(balance);
    });

    const unsubChartsStatus = chartsBot.onStatusChange((running) => {
      setChartsBotRunning(running);
      setChartsBotMetrics(chartsBot.getMetrics());
      if (!running) setChartsBotPaused(false);
    });

    const unsubChartsPause = chartsBot.onPauseChange((paused) => {
      setChartsBotPaused(paused);
    });

    // Listen to Normal bot trades, status, pause & contract progress
    const unsubNormalTrade = normalBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setNormalBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      syncAllExecutorsBalance(balance);
      setNormalBotStake(normalBot.getCurrentStake());
      setNormalBotStep(normalBot.getCurrentStep());
    });

    const unsubNormalStatus = normalBot.onStatusChange((running) => {
      setNormalBotRunning(running);
      setNormalBotMetrics(normalBot.getMetrics());
      setNormalBotStake(normalBot.getCurrentStake());
      setNormalBotStep(normalBot.getCurrentStep());
      if (!running) {
        setNormalBotPaused(false);
        setActiveSignal(null);
      }
    });

    const unsubNormalPause = normalBot.onPauseChange((paused) => {
      setNormalBotPaused(paused);
    });

    const unsubNormalProgress = normalBot.onContractProgress((activeContract) => {
      setNormalBotActiveContract(activeContract);
    });

    const unsubNormalEntryWait = normalBot.onEntryWaitChange((waiting, statusText) => {
      setNormalBotWaitingForEntry(waiting);
      setNormalBotEntryStatus(statusText);
    });

    // Listen to Entry Bot trades, status, pause, progress & state
    const unsubEntryTrade = entryBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setEntryBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      syncAllExecutorsBalance(balance);
      setEntryBotStake(entryBot.getCurrentStake());
      setEntryBotStep(entryBot.getCurrentStep());
      setEntryBotInRecovery(entryBot.getInRecovery());
    });

    const unsubEntryStatus = entryBot.onStatusChange((running) => {
      setEntryBotRunning(running);
      setEntryBotMetrics(entryBot.getMetrics());
      setEntryBotStake(entryBot.getCurrentStake());
      setEntryBotStep(entryBot.getCurrentStep());
      if (!running) {
        setEntryBotPaused(false);
        setEntryBotInRecovery(false);
        setEntryBotWaiting(false);
      }
    });

    const unsubEntryPause = entryBot.onPauseChange((paused) => {
      setEntryBotPaused(paused);
    });

    const unsubEntryProgress = entryBot.onContractProgress((activeContract) => {
      setEntryBotActiveContract(activeContract);
    });

    const unsubEntryState = entryBot.onStateChange((state) => {
      setEntryBotWaiting(state.waitingForSearch);
      setEntryBotInRecovery(state.inRecovery);
      setEntryBotStatusText(state.statusText);
    });

    // Listen to EvenOdd Bot trades, status, pause, progress & state
    const unsubEvenOddTrade = evenOddBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setEvenOddBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      syncAllExecutorsBalance(balance);
      setEvenOddBotStake(evenOddBot.getCurrentStake());
      setEvenOddBotStep(evenOddBot.getCurrentStep());
    });

    const unsubEvenOddStatus = evenOddBot.onStatusChange((running) => {
      setEvenOddBotRunning(running);
      setEvenOddBotMetrics(evenOddBot.getMetrics());
      setEvenOddBotStake(evenOddBot.getCurrentStake());
      setEvenOddBotStep(evenOddBot.getCurrentStep());
      if (!running) {
        setEvenOddBotPaused(false);
        setEvenOddBotWaiting(false);
      }
    });

    const unsubEvenOddPause = evenOddBot.onPauseChange((paused) => {
      setEvenOddBotPaused(paused);
    });

    const unsubEvenOddProgress = evenOddBot.onContractProgress((activeContract) => {
      setEvenOddBotActiveContract(activeContract);
    });

    const unsubEvenOddState = evenOddBot.onStateChange((state) => {
      setEvenOddBotWaiting(state.waitingForCondition);
      setEvenOddBotStageLabel(state.stageLabel);
      setEvenOddBotStatusText(state.statusText);
    });

    // Listen to XML Bot trades, status & journal
    const unsubXmlTrade = xmlBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setXmlBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      syncAllExecutorsBalance(balance);
      setXmlBotStake(xmlBot.getCurrentStake());
      setXmlBotStep(xmlBot.getCurrentStep());
    });

    const unsubXmlStatus = xmlBot.onStatusChange((running, paused, stage) => {
      setXmlBotRunning(running);
      setXmlBotPaused(paused);
      setXmlBotStage(stage);
      setXmlBotMetrics(xmlBot.getMetrics());
      setXmlBotStake(xmlBot.getCurrentStake());
      setXmlBotStep(xmlBot.getCurrentStep());
    });

    const unsubXmlJournal = xmlBot.onJournal((entries) => {
      setXmlBotJournal(entries);
    });

    // Listen to connection status
    const unsubStatus = engine.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    // Listen to Deriv Account Info
    const unsubAccount = engine.onAccountChange((acc) => {
      setDerivAccountInfo(acc);
      if (acc) {
        setUserAccount((prev) => ({
          ...prev,
          isLoggedIn: true,
          username: acc.loginid,
          balance: acc.balance,
          currency: acc.currency,
          isDemo: acc.isVirtual,
        }));
        syncAllExecutorsBalance(acc.balance);
      }
    });

    // Listen to Deriv Auth Error
    const unsubAuthError = engine.onAuthError((err) => {
      setDerivAuthError(err);
    });

    // Listen to Live Deriv Feed status (real ticks vs calibrated)
    const unsubLiveFeed = engine.onLiveFeedChange((isLive) => {
      setIsLiveFeed(isLive);
    });

    // Subscribe to tick stream
    const unsubTicks = engine.subscribe((newTick, allTicks) => {
      setCurrentTick(newTick);
      setTicks([...allTicks]);

      // Sound
      soundManager.playTick(newTick.direction);

      // Digit Frequency Analysis based on past ticks (excluding the current forming tick)
      const pastTicksBuffer = allTicks.length > 1 ? allTicks.slice(0, -1) : allTicks;
      const dStats = calculateDigitStats(pastTicksBuffer);
      const rStats = calculateRatioStats(pastTicksBuffer);

      const activeMarketId = selectedMarketRef.current.id;

      // Independent evaluation: Digits Bot
      if (digitsBotExecutorRef.current && digitsBotExecutorRef.current.getStatus()) {
        digitsBotExecutorRef.current.evaluateTick(newTick, allTicks, dStats, rStats, activeMarketId);
      }

      // Independent evaluation: Charts Bot
      if (chartsBotExecutorRef.current && chartsBotExecutorRef.current.getStatus()) {
        chartsBotExecutorRef.current.evaluateTick(newTick, allTicks, dStats, rStats, activeMarketId);
      }

      // Independent evaluation: Normal Bot (Continuous Execution)
      if (normalBotExecutorRef.current && normalBotExecutorRef.current.getStatus()) {
        normalBotExecutorRef.current.evaluateTick(newTick, allTicks, activeMarketId);
        setNormalBotStake(normalBotExecutorRef.current.getCurrentStake());
        setNormalBotStep(normalBotExecutorRef.current.getCurrentStep());
      }

      // Independent evaluation: Entry Bot
      if (entryBotExecutorRef.current && entryBotExecutorRef.current.getStatus()) {
        entryBotExecutorRef.current.evaluateTick(newTick, allTicks, activeMarketId);
        setEntryBotStake(entryBotExecutorRef.current.getCurrentStake());
        setEntryBotStep(entryBotExecutorRef.current.getCurrentStep());
        setEntryBotInRecovery(entryBotExecutorRef.current.getInRecovery());
      }

      // Independent evaluation: EvenOdd Bot
      if (evenOddBotExecutorRef.current && evenOddBotExecutorRef.current.getStatus()) {
        evenOddBotExecutorRef.current.evaluateTick(newTick, allTicks, dStats, activeMarketId);
        setEvenOddBotStake(evenOddBotExecutorRef.current.getCurrentStake());
        setEvenOddBotStep(evenOddBotExecutorRef.current.getCurrentStep());
      }

      // Independent evaluation: Deriv XML Bot Builder
      if (xmlBotExecutorRef.current && xmlBotExecutorRef.current.getStatus()) {
        xmlBotExecutorRef.current.evaluateTick(newTick, allTicks, activeMarketId);
      }
    });

    // Check for Deriv OAuth redirect return params
    const params = new URLSearchParams(window.location.search);
    const token1 = params.get('token1');
    const acct1 = params.get('acct1');
    const cur1 = params.get('cur1');
    if (token1) {
      const savedAppId = localStorage.getItem('tickedge_deriv_app_id') || '1089';
      try {
        localStorage.setItem('tickedge_deriv_token', token1);
      } catch {}
      const authUser: UserAccount = {
        isLoggedIn: true,
        username: acct1 || 'DerivTrader',
        email: `${acct1 || 'deriv'}@deriv.com`,
        balance: 10000.0,
        currency: cur1 || 'USD',
        isDemo: Boolean(acct1 && acct1.startsWith('VR')),
      };
      setUserAccount(authUser);
      setCurrentView('dashboard');
      try {
        localStorage.setItem('tickedge_auth_session', JSON.stringify(authUser));
      } catch {}
      engine.connectDeriv(savedAppId, token1);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      unsubTicks();
      unsubStatus();
      unsubLiveFeed();
      unsubAccount();
      unsubAuthError();
      unsubDigitsTrade();
      unsubDigitsStatus();
      unsubChartsTrade();
      unsubChartsStatus();
      unsubChartsPause();
      unsubNormalTrade();
      unsubNormalStatus();
      unsubNormalPause();
      unsubNormalProgress();
      unsubNormalEntryWait();
      unsubEntryTrade();
      unsubEntryStatus();
      unsubEntryPause();
      unsubEntryProgress();
      unsubEntryState();
      unsubEvenOddTrade();
      unsubEvenOddStatus();
      unsubEvenOddPause();
      unsubEvenOddProgress();
      unsubEvenOddState();
      unsubXmlTrade();
      unsubXmlStatus();
      unsubXmlJournal();
      engine.destroy();
    };
  }, []);

  // Spot price calibration handlers
  const handleCalibratePrice = (newPrice: number) => {
    if (engineRef.current) {
      engineRef.current.calibratePrice(newPrice);
    }
  };

  const handleResetPriceCalibration = () => {
    if (engineRef.current) {
      engineRef.current.resetPriceCalibration();
    }
  };

  // Sync market changes automatically across live stream and bots
  const handleSelectMarket = (market: Market) => {
    const isMarketChanged = market.id !== selectedMarketRef.current.id;
    selectedMarketRef.current = market;
    setSelectedMarket(market);
    if (engineRef.current) {
      engineRef.current.setMarket(market);
    }

    if (isMarketChanged) {
      // Risk Management: In case market changes before an entry is found, stop the bot
      if (normalBotRunning && normalBotExecutorRef.current?.isWaitingForInitialEntry()) {
        handleStopNormalBot('Risk Management: Market changed before initial entry was found');
      }
      if (evenOddBotRunning && evenOddBotExecutorRef.current?.getWaitingForCondition()) {
        handleStopEvenOddBot('Risk Management: Market changed before entry condition was found');
      }
      if (entryBotRunning && entryBotExecutorRef.current?.getWaitingForCondition()) {
        handleStopEntryBot('Risk Management: Market changed before entry pattern was found');
      }
      if (digitsBotRunning && digitsBotExecutorRef.current?.isWaitingForCondition()) {
        handleStopDigitsBot('Risk Management: Market changed before entry condition was found');
      }
      if (chartsBotRunning && chartsBotExecutorRef.current?.isWaitingForCondition()) {
        handleStopChartsBot('Risk Management: Market changed before entry condition was found');
      }
      if (activeSignal && activeSignal.marketId !== market.id && normalBotExecutorRef.current?.isWaitingForInitialEntry()) {
        setActiveSignal(null);
      }
    }

    setDigitsBotConfig((prev) => {
      const next = { ...prev, marketId: market.id };
      digitsBotExecutorRef.current?.updateConfig(next);
      return next;
    });
    setChartsBotConfig((prev) => {
      const next = { ...prev, marketId: market.id };
      chartsBotExecutorRef.current?.updateConfig(next);
      return next;
    });
    setNormalBotConfig((prev) => {
      const next = { ...prev, marketId: market.id };
      normalBotExecutorRef.current?.updateConfig(next);
      return next;
    });
    setEntryBotConfig((prev) => {
      const next = { ...prev, marketId: market.id };
      entryBotExecutorRef.current?.updateConfig(next);
      return next;
    });
    setEvenOddBotConfig((prev) => {
      const next = { ...prev, marketId: market.id };
      evenOddBotExecutorRef.current?.updateConfig(next);
      return next;
    });
    setXmlBotConfig((prev) => {
      const next = { ...prev, marketId: market.id };
      xmlBotExecutorRef.current?.updateConfig(next);
      return next;
    });
  };

  // Sync window changes
  const handleChangeWindow = (newWindow: number) => {
    setTicksWindow(newWindow);
    if (engineRef.current) {
      engineRef.current.setTicksWindow(newWindow);
    }
  };

  // Sync speed changes
  const handleChangeSpeed = (speedMs: number) => {
    setTickSpeedMs(speedMs);
    if (engineRef.current) {
      engineRef.current.setSpeed(speedMs);
    }
  };

  // Toggle sound
  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    soundManager.enabled = nextState;
  };

  // Reset tick buffer
  const handleResetBuffer = () => {
    if (engineRef.current) {
      engineRef.current.clearBuffer();
    }
  };

  // ==========================================
  // DIGITS BOT HANDLERS
  // ==========================================
  const handleUpdateDigitsBotConfig = (newConfig: Partial<BotStrategyConfig>) => {
    const merged = { ...digitsBotConfig, ...newConfig };
    const updated: BotStrategyConfig = {
      ...merged,
      executionMode: isContinuousDirectionalContract(merged.tradeType)
        ? 'continuous'
        : merged.executionMode || 'continuous',
    };
    setDigitsBotConfig(updated);
    try {
      localStorage.setItem('tickedge_digits_bot_strategy', JSON.stringify(updated));
    } catch {}
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.updateConfig(updated);
    }
    if (newConfig.marketId && newConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === newConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
  };

  const handleStartDigitsBot = () => {
    if (digitsBotConfig.marketId && digitsBotConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === digitsBotConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.updateConfig(digitsBotConfig);
      digitsBotExecutorRef.current.start();
    }
  };

  const handleStopDigitsBot = (reason?: string) => {
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.stop(reason || 'Manual Stop');
    }
  };

  const handleResetDigitsBotStats = () => {
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.resetStats();
      setDigitsBotMetrics(digitsBotExecutorRef.current.getMetrics());
      setTrades((prev) => prev.filter((t) => t.botSource !== 'digits'));
    }
  };

  const handleResetDigitsBotAfterTrade = () => {
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.resetTradeStake();
    }
  };

  // ==========================================
  // CHARTS BOT HANDLERS
  // ==========================================
  const handleUpdateChartsBotConfig = (newConfig: Partial<BotStrategyConfig>) => {
    const merged = { ...chartsBotConfig, ...newConfig };
    const updated: BotStrategyConfig = {
      ...merged,
      executionMode: isContinuousDirectionalContract(merged.tradeType)
        ? 'continuous'
        : merged.executionMode || 'continuous',
    };
    setChartsBotConfig(updated);
    try {
      localStorage.setItem('tickedge_charts_bot_strategy', JSON.stringify(updated));
    } catch {}
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.updateConfig(updated);
    }
    if (newConfig.marketId && newConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === newConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
  };

  const handleStartChartsBot = () => {
    if (chartsBotConfig.marketId && chartsBotConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === chartsBotConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
    setFloatingBotSelection('strategy');
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.updateConfig(chartsBotConfig);
      chartsBotExecutorRef.current.start();
    }
  };

  const handleStopChartsBot = (reason?: string) => {
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.stop(reason || 'Manual Stop');
    }
  };

  const handlePauseChartsBot = () => {
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.pause();
    }
  };

  const handleResumeChartsBot = () => {
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.resume();
    }
  };

  const handleResetChartsBotStats = () => {
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.resetStats();
      setChartsBotMetrics(chartsBotExecutorRef.current.getMetrics());
      setTrades((prev) => prev.filter((t) => t.botSource !== 'charts'));
    }
  };

  const handleResetChartsBotAfterTrade = () => {
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.resetTradeStake();
    }
  };

  // ==========================================
  // NORMAL BOT HANDLERS
  // ==========================================
  const handleUpdateNormalBotConfig = (newConfig: Partial<NormalBotConfig>) => {
    const updated = { ...normalBotConfig, ...newConfig };
    setNormalBotConfig(updated);
    try {
      localStorage.setItem('tickedge_normal_bot_config', JSON.stringify(updated));
    } catch {}
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.updateConfig(updated);
    }
    if (newConfig.marketId && newConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === newConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
  };

  const handleStartNormalBot = () => {
    if (normalBotExecutorRef.current) {
      if (normalBotConfig.marketId && normalBotConfig.marketId !== selectedMarketRef.current.id) {
        const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === normalBotConfig.marketId);
        if (targetMarket) {
          handleSelectMarket(targetMarket);
        }
      }
      setActiveSignal(null);
      setFloatingBotSelection('normal');
      normalBotExecutorRef.current.updateConfig(normalBotConfig);
      normalBotExecutorRef.current.start();
    }
  };

  const handleStopNormalBot = (reason?: string) => {
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.stop(reason || 'Manual Stop');
    }
  };

  const handlePauseNormalBot = () => {
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.pause();
    }
  };

  const handleResumeNormalBot = () => {
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.resume();
    }
  };

  const handleResetNormalBotStats = () => {
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.resetStats();
      setNormalBotMetrics(normalBotExecutorRef.current.getMetrics());
      setTrades((prev) => prev.filter((t) => t.botSource !== 'normal'));
    }
  };

  const handleResetNormalBotStake = () => {
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.resetTradeStake();
      setNormalBotStake(normalBotExecutorRef.current.getCurrentStake());
      setNormalBotStep(normalBotExecutorRef.current.getCurrentStep());
    }
  };

  const handleResetNormalBot = () => {
    handleResetNormalBotStats();
    handleResetNormalBotStake();
  };

  const handleToggleNormalBotSpeed = () => {
    const nextSpeed = normalBotConfig.botSpeed === 'fast' ? 'normal' : 'fast';
    handleUpdateNormalBotConfig({ botSpeed: nextSpeed });
  };

  const handleToggleStrategyBotSpeed = () => {
    const nextSpeed = chartsBotConfig.botSpeed === 'fast' ? 'normal' : 'fast';
    handleUpdateChartsBotConfig({ botSpeed: nextSpeed });
  };

  const handleResetStrategyBot = () => {
    handleResetChartsBotStats();
    handleResetChartsBotAfterTrade();
  };

  // ==========================================
  // ENTRY BOT HANDLERS
  // ==========================================
  const handleUpdateEntryBotConfig = (newConfig: Partial<EntryBotConfig>) => {
    const updated = { ...entryBotConfig, ...newConfig };
    setEntryBotConfig(updated);
    try {
      localStorage.setItem('tickedge_entry_bot_config', JSON.stringify(updated));
    } catch {}
    entryBotExecutorRef.current?.updateConfig(updated);
    if (!entryBotRunning && newConfig.initialStake !== undefined) {
      setEntryBotStake(newConfig.initialStake);
    }
    if (newConfig.marketId && newConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === newConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
  };

  const handleStartEntryBot = () => {
    if (entryBotConfig.marketId && entryBotConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === entryBotConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
    setFloatingBotSelection('entry');
    entryBotExecutorRef.current?.updateConfig(entryBotConfig);
    entryBotExecutorRef.current?.start();
  };

  const handleStopEntryBot = (reason?: string) => {
    entryBotExecutorRef.current?.stop(reason || 'Manual Stop');
  };

  const handlePauseEntryBot = () => {
    entryBotExecutorRef.current?.pause();
  };

  const handleResumeEntryBot = () => {
    entryBotExecutorRef.current?.resume();
  };

  const handleResetEntryBotStats = () => {
    if (entryBotExecutorRef.current) {
      entryBotExecutorRef.current.resetStats();
      entryBotExecutorRef.current.resetTradeStake();
      setEntryBotMetrics(entryBotExecutorRef.current.getMetrics());
      setEntryBotStake(entryBotExecutorRef.current.getCurrentStake());
      setEntryBotStep(0);
      setEntryBotInRecovery(false);
      setTrades((prev) => prev.filter((t) => t.botSource !== 'entry'));
    }
  };

  const handleToggleEntryBotSpeed = () => {
    const nextSpeed = entryBotConfig.botSpeed === 'fast' ? 'normal' : 'fast';
    handleUpdateEntryBotConfig({ botSpeed: nextSpeed });
  };

  // ==========================================
  // EVENODD BOT HANDLERS
  // ==========================================
  const handleUpdateEvenOddBotConfig = (newConfig: Partial<EvenOddBotConfig>) => {
    const updated = { ...evenOddBotConfig, ...newConfig };
    setEvenOddBotConfig(updated);
    try {
      localStorage.setItem('tickedge_evenodd_bot_config', JSON.stringify(updated));
    } catch {}
    evenOddBotExecutorRef.current?.updateConfig(updated);
    if (!evenOddBotRunning && newConfig.initialStake !== undefined) {
      setEvenOddBotStake(newConfig.initialStake);
    }
    if (newConfig.marketId && newConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === newConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
  };

  const handleStartEvenOddBot = () => {
    if (evenOddBotConfig.marketId && evenOddBotConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === evenOddBotConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
    setFloatingBotSelection('evenodd');
    evenOddBotExecutorRef.current?.updateConfig(evenOddBotConfig);
    evenOddBotExecutorRef.current?.start();
  };

  const handleStopEvenOddBot = (reason?: string) => {
    evenOddBotExecutorRef.current?.stop(reason || 'Manual Stop');
  };

  const handlePauseEvenOddBot = () => {
    evenOddBotExecutorRef.current?.pause();
  };

  const handleResumeEvenOddBot = () => {
    evenOddBotExecutorRef.current?.resume();
  };

  const handleResetEvenOddBotStats = () => {
    if (evenOddBotExecutorRef.current) {
      evenOddBotExecutorRef.current.resetStats();
      evenOddBotExecutorRef.current.resetTradeStake();
      setEvenOddBotMetrics(evenOddBotExecutorRef.current.getMetrics());
      setEvenOddBotStake(evenOddBotExecutorRef.current.getCurrentStake());
      setEvenOddBotStep(0);
      setTrades((prev) => prev.filter((t) => t.botSource !== 'evenodd'));
    }
  };

  const handleToggleEvenOddBotSpeed = () => {
    const nextSpeed = evenOddBotConfig.botSpeed === 'fast' ? 'normal' : 'fast';
    handleUpdateEvenOddBotConfig({ botSpeed: nextSpeed });
  };

  // ==========================================
  // DERIV XML BOT BUILDER HANDLERS
  // ==========================================
  const handleUpdateXmlBotConfig = (nextConfig: XmlBotConfig) => {
    setXmlBotConfig(nextConfig);
    try {
      localStorage.setItem('tickedge_xml_bot_config', JSON.stringify(nextConfig));
    } catch {}
    xmlBotExecutorRef.current?.updateConfig(nextConfig);
    if (!xmlBotRunning) {
      setXmlBotStake(nextConfig.initialStake);
    }
    if (nextConfig.marketId && nextConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === nextConfig.marketId);
      if (targetMarket) {
        selectedMarketRef.current = targetMarket;
        setSelectedMarket(targetMarket);
        engineRef.current?.setMarket(targetMarket);
      }
    }
  };

  const handleStartXmlBot = () => {
    if (xmlBotConfig.marketId && xmlBotConfig.marketId !== selectedMarketRef.current.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === xmlBotConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
    xmlBotExecutorRef.current?.start();
  };

  const handleStopXmlBot = () => {
    xmlBotExecutorRef.current?.stop('Manual Stop');
  };

  const handlePauseXmlBot = () => {
    xmlBotExecutorRef.current?.pause();
  };

  const handleResumeXmlBot = () => {
    xmlBotExecutorRef.current?.resume();
  };

  const handleResetXmlBot = () => {
    if (xmlBotExecutorRef.current) {
      xmlBotExecutorRef.current.resetStats();
      setXmlBotMetrics(xmlBotExecutorRef.current.getMetrics());
      setXmlBotStake(xmlBotExecutorRef.current.getCurrentStake());
      setXmlBotStep(0);
      setTrades((prev) => prev.filter((t) => t.botSource !== 'xml'));
    }
  };

  // ==========================================
  // LIVE SIGNALS -> DIRECT NORMAL BOT LAUNCHER
  // ==========================================
  const handleRunSignalOnNormalBot = (req: SignalExecutionRequest) => {
    if (!normalBotExecutorRef.current) return;

    if (normalBotExecutorRef.current.getStatus()) {
      normalBotExecutorRef.current.stop('Switched Signal');
    }

    // 1. Switch market feed to signal's market
    selectedMarketRef.current = req.market;
    setSelectedMarket(req.market);
    engineRef.current?.setMarket(req.market);

    const isOnlyUpStrategy = req.category === 'only_up';
    const isOnlyUpDown =
      req.contractType === 'ONLY_UP' || req.contractType === 'ONLY_DOWN';
    const isHighLowTick =
      req.contractType === 'HIGH_TICK' || req.contractType === 'LOW_TICK';
    const resolvedPrediction =
      req.contractType === 'EVEN' || req.contractType === 'ODD' || isOnlyUpDown
        ? req.contractType
        : isHighLowTick
        ? Math.min(5, Math.max(1, Math.round(req.prediction || 5)))
        : req.prediction;
    const resolvedTicks = isOnlyUpStrategy
      ? Math.min(5, Math.max(2, Math.round(req.ticks || 2)))
      : isOnlyUpDown
      ? Math.min(5, Math.max(2, Math.round(req.ticks || 5)))
      : isHighLowTick
      ? 5
      : Math.min(10, Math.max(1, Math.round(req.ticks || 1)));

    const updatedNormal: NormalBotConfig = {
      ...normalBotConfig,
      name: `Signal · ${req.signalLabel}`,
      marketId: req.market.id,
      contractType: req.contractType,
      prediction: resolvedPrediction,
      signalEntryTrigger: req.signalEntryTrigger,
      entryTargetDigit: req.entryTargetDigit,
      stake: req.stake,
      initialStake: req.stake,
      duration: resolvedTicks,
      durationUnit: 't',
      martingale: req.martingale,
      takeProfit: req.takeProfit,
      stopLoss: req.stopLoss,
      active: true,
    };

    setNormalBotConfig(updatedNormal);
    try {
      localStorage.setItem('tickedge_normal_bot_config', JSON.stringify(updatedNormal));
    } catch {}
    normalBotExecutorRef.current.updateConfig(updatedNormal);
    setNormalBotStake(req.stake);
    setNormalBotStep(0);
    setActiveSignal({
      category: req.category,
      marketId: req.market.id,
      marketName: req.market.name,
      contractType: req.contractType,
      prediction: req.prediction,
      entryTargetDigit: req.entryTargetDigit,
      evenOddStrategyId: req.evenOddStrategyId,
      ticks: resolvedTicks,
      signalLabel: req.signalLabel,
      signalTone: req.signalTone,
      entryConfidencePct: req.entryConfidencePct,
      payoutMultiplier: req.payoutMultiplier,
      distributionSubtext: req.distributionSubtext,
      patternSummary: req.patternSummary,
    });
    setBotsTabSubView('normal');
    setFloatingBotSelection('normal');

    // 3. Start Normal Bot armed; it waits on incoming live ticks for the entry confirmation pattern, then trades continuously
    normalBotExecutorRef.current.start();
  };

  // Reset user balance (updates all executors)
  const handleResetUserBalance = (amount: number) => {
    setUserAccount((prev) => ({ ...prev, balance: amount }));
    syncAllExecutorsBalance(amount);
  };

  const handleAuthorizeDerivToken = (token: string) => {
    setUserAccount((prev) => ({
      ...prev,
      isLoggedIn: true,
      email: 'deriv_user@auth.deriv.com',
    }));
    if (engineRef.current) {
      const currentAppId = engineRef.current.getAppId() || localStorage.getItem('tickedge_deriv_app_id') || '1089';
      engineRef.current.connectDeriv(currentAppId, token);
    }
  };

  const handleLogout = () => {
    const loggedOutAccount: UserAccount = {
      isLoggedIn: false,
      username: '',
      email: '',
      balance: 10000.0,
      currency: 'USD',
      isDemo: true,
    };
    setUserAccount(loggedOutAccount);
    setCurrentView('login');
    try {
      localStorage.removeItem('tickedge_auth_session');
      localStorage.removeItem('tickedge_deriv_token');
    } catch {}
    if (engineRef.current) {
      const currentAppId = engineRef.current.getAppId() || '1089';
      engineRef.current.connectDeriv(currentAppId, '');
    }
  };

  const handleLoginSuccess = (accountData: {
    username: string;
    email: string;
    isDemo: boolean;
    balance: number;
    token?: string;
  }) => {
    const safeBalance = accountData.balance > 0 ? accountData.balance : 10000.0;
    const updatedAccount: UserAccount = {
      isLoggedIn: true,
      username: accountData.username,
      email: accountData.email,
      isDemo: accountData.isDemo,
      balance: safeBalance,
      currency: 'USD',
    };
    setUserAccount(updatedAccount);
    try {
      localStorage.setItem('tickedge_auth_session', JSON.stringify(updatedAccount));
    } catch {}
    handleResetUserBalance(safeBalance);
    if (accountData.token) {
      handleAuthorizeDerivToken(accountData.token);
    }
    setCurrentView('dashboard');
  };

  // Compute stats on-the-fly from the ticks buffer based on past ticks (excluding the current tick)
  const pastTicks = useMemo(() => (ticks.length > 1 ? ticks.slice(0, -1) : ticks), [ticks]);
  const digitStats = useMemo(() => calculateDigitStats(pastTicks), [pastTicks]);
  const ratioStats = useMemo(() => calculateRatioStats(pastTicks), [pastTicks]);

  // CRITICAL REQUIREMENT: Tool Login page is the first page a trader sees. One MUST sign in to access the terminal.
  if (!userAccount.isLoggedIn || currentView === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        userAccount={userAccount}
        connectionStatus={connectionStatus}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onAuthorizeDerivToken={handleAuthorizeDerivToken}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080d16] text-slate-100 flex flex-col pb-20 selection:bg-[#00e599]/30">
      {/* Top Header */}
      <Header
        connectionStatus={connectionStatus}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        tickSpeedMs={tickSpeedMs}
        onChangeSpeed={handleChangeSpeed}
        onOpenApiModal={() => setIsApiModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenLoginPage={() => setCurrentView('login')}
        onLogout={handleLogout}
        userBalance={userAccount.balance}
        isDemo={userAccount.isDemo}
        onResetBuffer={handleResetBuffer}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isLoggedIn={userAccount.isLoggedIn}
        username={userAccount.username}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 ${
          activeTab === 'builder' ? 'max-w-6xl' : 'max-w-4xl'
        } w-full mx-auto px-4 py-4 sm:py-6 flex flex-col gap-4 pb-48 sm:pb-52`}
      >
        {/* Prominent Deriv OAuth Login Banner if not logged in */}
        {!userAccount.isLoggedIn && (
          <div className="bg-gradient-to-r from-[#ff444f]/15 via-[#111827] to-[#090d16] border border-[#ff444f]/35 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3.5 shadow-xl animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff444f]/20 border border-[#ff444f]/40 flex items-center justify-center text-[#ff444f] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">Tool Login & Deriv Authorization</h4>
                  <span className="text-[10px] bg-[#ff444f]/20 text-[#ff444f] border border-[#ff444f]/40 font-bold px-1.5 py-0.5 rounded uppercase">
                    OAuth 2.0 & Token
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Connect your Deriv account or trader profile to enable live tick streaming, bot execution, and real/demo balance synchronization.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setCurrentView('login')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm text-white bg-gradient-to-r from-[#ff444f] via-[#e53945] to-[#cc2936] hover:from-[#ff555f] hover:to-[#ea3943] shadow-[0_0_20px_rgba(255,68,79,0.45)] hover:shadow-[0_0_30px_rgba(255,68,79,0.7)] transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 active:scale-95 border border-[#ff444f]/50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Open Tool Login Page</span>
              </button>
            </div>
          </div>
        )}

        {/* ANALYSIS (DIGITS) TAB */}
        {activeTab === 'digits' && (
          <>
            {/* Market Selector matching screenshot dropdown */}
            <MarketSelector
              selectedMarket={selectedMarket}
              onSelectMarket={handleSelectMarket}
              theme={theme}
            />

            {/* Current Tick / Price banner */}
            <TickCard
              currentTick={currentTick}
              market={selectedMarket}
              isLiveFeed={isLiveFeed}
              onCalibratePrice={handleCalibratePrice}
              onResetPriceCalibration={handleResetPriceCalibration}
              onOpenApiModal={() => setIsApiModalOpen(true)}
            />

            {/* Compact Ticks window control */}
            <TicksWindowControl
              ticksWindow={ticksWindow}
              currentCount={pastTicks.length}
              onChangeWindow={handleChangeWindow}
            />

            {/* The 10 Digit Circles (0-9) & Legend Pills matching screenshot */}
            <DigitCirclesGrid
              stats={digitStats}
              activeDigit={currentTick?.lastDigit}
              theme={theme}
              onSelectDigit={(d) => {
                handleUpdateDigitsBotConfig({ predictionDigit: d, xDigit: d });
                if (
                  !normalBotRunning &&
                  ['OVER', 'UNDER', 'DIFFERS', 'MATCHES'].includes(normalBotConfig.contractType)
                ) {
                  handleUpdateNormalBotConfig({ prediction: d });
                }
                handleUpdateChartsBotConfig({ predictionDigit: d, xDigit: d });
              }}
            />

            {/* Two Ratio Cards (Even/Odd and Dynamic Over/Under Barrier Selector) */}
            <RatioCards ratioStats={ratioStats} ticks={pastTicks} />

            {/* Last 20 digits Ribbon */}
            <LastDigitsRibbon ticks={ticks} />

            {/* Deriv Advanced TradingView Chart transferred above the bot */}
            <ChartsView ticks={ticks} market={selectedMarket} />

            {/* Digits Bot Strategy panel (INDEPENDENT) */}
            <BotStrategyPanel
              config={digitsBotConfig}
              onUpdateConfig={handleUpdateDigitsBotConfig}
              isRunning={digitsBotRunning}
              onStart={handleStartDigitsBot}
              onStop={handleStopDigitsBot}
              metrics={digitsBotMetrics}
              trades={trades.filter((t) => t.botSource === 'digits')}
              onResetStats={handleResetDigitsBotStats}
              onResetAfterTrade={handleResetDigitsBotAfterTrade}
              balance={userAccount.balance}
              selectedMarketId={selectedMarket.id}
              storageKey="tickedge_digits_bot_strategy"
              tag="Digits Bot"
              theme={theme}
            />
          </>
        )}

        {/* SIGNALS TAB */}
        {activeTab === 'signals' && (
          <SignalsView
            normalBotConfig={normalBotConfig}
            onUpdateNormalBotConfig={handleUpdateNormalBotConfig}
            onRunSignalOnNormalBot={handleRunSignalOnNormalBot}
            onStopNormalBot={handleStopNormalBot}
            onResetNormalBot={handleResetNormalBot}
            onOpenNormalBotTab={() => {
              setBotsTabSubView('normal');
              setActiveTab('bots');
            }}
            normalBotRunning={normalBotRunning}
            normalBotWaitingForEntry={normalBotWaitingForEntry}
            normalBotEntryStatus={normalBotEntryStatus}
            normalBotStake={normalBotStake}
            normalBotMetrics={normalBotMetrics}
            activeSignal={activeSignal}
            theme={theme}
          />
        )}

        {/* BOTS TAB */}
        {activeTab === 'bots' && (
          <>
            {/* Sub-navigation to switch between Normal Bot, Strategy Bot, Entry Bot, and EvenOdd Bot */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-2xl border bg-white border-neutral-300 shadow-sm transition-colors">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setBotsTabSubView('normal');
                    setFloatingBotSelection('normal');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    botsTabSubView === 'normal'
                      ? 'bg-[#00FFFF] text-slate-950 font-black shadow-md shadow-[#00FFFF]/35 ring-1 ring-[#00FFFF] border border-[#00FFFF]'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
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
                  onClick={() => {
                    setBotsTabSubView('strategy');
                    setFloatingBotSelection('strategy');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    botsTabSubView === 'strategy'
                      ? 'bg-[#00FFFF] text-slate-950 font-black shadow-md shadow-[#00FFFF]/35 ring-1 ring-[#00FFFF] border border-[#00FFFF]'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Strategy Bot</span>
                  {chartsBotRunning && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBotsTabSubView('entry');
                    setFloatingBotSelection('entry');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    botsTabSubView === 'entry'
                      ? 'bg-[#00FFFF] text-slate-950 font-black shadow-md shadow-[#00FFFF]/35 ring-1 ring-[#00FFFF] border border-[#00FFFF]'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Entry Bot</span>
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
                  onClick={() => {
                    setBotsTabSubView('evenodd');
                    setFloatingBotSelection('evenodd');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    botsTabSubView === 'evenodd'
                      ? 'bg-[#00FFFF] text-slate-950 font-black shadow-md shadow-[#00FFFF]/35 ring-1 ring-[#00FFFF] border border-[#00FFFF]'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>EvenOdd Bot</span>
                  {evenOddBotRunning && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        evenOddBotPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-ping'
                      }`}
                    />
                  )}
                </button>
              </div>

              <div className="hidden lg:flex items-center gap-2 pr-3 font-mono text-xs whitespace-nowrap">
                <span className="text-neutral-500">Active Mode:</span>
                <span className="font-bold text-neutral-950">
                  {botsTabSubView === 'normal'
                    ? 'Normal Direct Execution'
                    : botsTabSubView === 'strategy'
                    ? 'Advanced Strategy'
                    : botsTabSubView === 'entry'
                    ? 'Search Touch + P1/P2 Recovery'
                    : `EvenOdd (${evenOddBotConfig.strategy})`}
                </span>
              </div>
            </div>

            {/* 1. NORMAL BOT */}
            {botsTabSubView === 'normal' && (
              <NormalBotPanel
                config={normalBotConfig}
                onUpdateConfig={handleUpdateNormalBotConfig}
                digitStats={digitStats}
                currentDigit={currentTick?.lastDigit}
                isRunning={normalBotRunning}
                isPaused={normalBotPaused}
                onStart={handleStartNormalBot}
                onStop={handleStopNormalBot}
                onPause={handlePauseNormalBot}
                onResume={handleResumeNormalBot}
                metrics={normalBotMetrics}
                trades={trades.filter((t) => t.botSource === 'normal')}
                onResetStats={handleResetNormalBotStats}
                onResetStake={handleResetNormalBotStake}
                currentStake={normalBotStake}
                currentStep={normalBotStep}
                activeContract={normalBotActiveContract}
                balance={userAccount.balance}
                tag="Normal Bot"
                theme={theme}
              />
            )}

            {/* 2. ADVANCED STRATEGY BOT */}
            {botsTabSubView === 'strategy' && (
              <BotStrategyPanel
                config={chartsBotConfig}
                onUpdateConfig={handleUpdateChartsBotConfig}
                digitStats={digitStats}
                currentDigit={currentTick?.lastDigit}
                isRunning={chartsBotRunning}
                isPaused={chartsBotPaused}
                onStart={handleStartChartsBot}
                onStop={handleStopChartsBot}
                onPause={handlePauseChartsBot}
                onResume={handleResumeChartsBot}
                metrics={chartsBotMetrics}
                trades={trades.filter((t) => t.botSource === 'charts')}
                onResetStats={handleResetChartsBotStats}
                onResetAfterTrade={handleResetChartsBotAfterTrade}
                balance={userAccount.balance}
                selectedMarketId={selectedMarket.id}
                storageKey="tickedge_charts_bot_strategy"
                tag="Strategy Bot"
                theme={theme}
              />
            )}

            {/* 3. ENTRY BOT */}
            {botsTabSubView === 'entry' && (
              <EntryBotPanel
                config={entryBotConfig}
                onUpdateConfig={handleUpdateEntryBotConfig}
                digitStats={digitStats}
                isRunning={entryBotRunning}
                isPaused={entryBotPaused}
                inRecovery={entryBotInRecovery}
                waitingForSearch={entryBotWaiting}
                statusText={entryBotStatusText}
                currentDigit={currentTick?.lastDigit}
                onStart={handleStartEntryBot}
                onStop={handleStopEntryBot}
                onPause={handlePauseEntryBot}
                onResume={handleResumeEntryBot}
                metrics={entryBotMetrics}
                trades={trades.filter((t) => t.botSource === 'entry')}
                onResetStats={handleResetEntryBotStats}
                currentStake={entryBotStake}
                currentStep={entryBotStep}
                activeContract={entryBotActiveContract}
                theme={theme}
              />
            )}

            {/* 4. EVENODD BOT */}
            {botsTabSubView === 'evenodd' && (
              <EvenOddBotPanel
                config={evenOddBotConfig}
                onUpdateConfig={handleUpdateEvenOddBotConfig}
                digitStats={digitStats}
                ratioStats={ratioStats}
                currentDigit={currentTick?.lastDigit}
                isRunning={evenOddBotRunning}
                isPaused={evenOddBotPaused}
                waitingForCondition={evenOddBotWaiting}
                stageLabel={evenOddBotStageLabel}
                statusText={evenOddBotStatusText}
                onStart={handleStartEvenOddBot}
                onStop={handleStopEvenOddBot}
                onPause={handlePauseEvenOddBot}
                onResume={handleResumeEvenOddBot}
                metrics={evenOddBotMetrics}
                trades={trades.filter((t) => t.botSource === 'evenodd')}
                onResetStats={handleResetEvenOddBotStats}
                currentStake={evenOddBotStake}
                currentStep={evenOddBotStep}
                activeContract={evenOddBotActiveContract}
                theme={theme}
              />
            )}
          </>
        )}

        {/* BOT BUILDER (DERIV DBOT XML / BLOCKLY + STRUCTURED) TAB */}
        {activeTab === 'builder' && (
          <BotBuilderView
            config={xmlBotConfig}
            onUpdateConfig={handleUpdateXmlBotConfig}
            isRunning={xmlBotRunning}
            isPaused={xmlBotPaused}
            activeStage={xmlBotStage}
            currentStake={xmlBotStake}
            currentStep={xmlBotStep}
            metrics={xmlBotMetrics}
            trades={trades.filter((t) => t.botSource === 'xml')}
            journal={xmlBotJournal}
            currentTick={currentTick}
            balance={userAccount.balance}
            onStart={handleStartXmlBot}
            onStop={handleStopXmlBot}
            onPause={handlePauseXmlBot}
            onResume={handleResumeXmlBot}
            onReset={handleResetXmlBot}
            theme={theme}
          />
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <TradesHistoryView
            trades={trades}
            metrics={digitsBotMetrics}
            onClearHistory={() => setTrades([])}
          />
        )}
      </main>
 
      {/* Floating Bot Controller across ALL Tabs */}
      <FloatingBotController
        selectedBot={floatingBotSelection}
        onSelectBot={(bot) => {
          setFloatingBotSelection(bot);
          setBotsTabSubView(bot);
        }}
        normalBotRunning={normalBotRunning}
        normalBotPaused={normalBotPaused}
        normalBotWaitingForEntry={normalBotWaitingForEntry}
        normalBotEntryStatus={normalBotEntryStatus}
        normalBotStake={normalBotStake}
        normalBotStep={normalBotStep}
        normalBotMetrics={normalBotMetrics}
        normalBotConfig={normalBotConfig}
        onStartNormalBot={handleStartNormalBot}
        onStopNormalBot={handleStopNormalBot}
        onPauseNormalBot={handlePauseNormalBot}
        onResumeNormalBot={handleResumeNormalBot}
        onResetNormalBot={handleResetNormalBot}
        onToggleNormalBotSpeed={handleToggleNormalBotSpeed}
        strategyBotRunning={chartsBotRunning}
        strategyBotPaused={chartsBotPaused}
        strategyBotMetrics={chartsBotMetrics}
        strategyBotConfig={chartsBotConfig}
        onStartStrategyBot={handleStartChartsBot}
        onStopStrategyBot={handleStopChartsBot}
        onPauseStrategyBot={handlePauseChartsBot}
        onResumeStrategyBot={handleResumeChartsBot}
        onResetStrategyBot={handleResetStrategyBot}
        onToggleStrategyBotSpeed={handleToggleStrategyBotSpeed}
        entryBotRunning={entryBotRunning}
        entryBotPaused={entryBotPaused}
        entryBotWaiting={entryBotWaiting}
        entryBotStatus={entryBotStatusText}
        entryBotStake={entryBotStake}
        entryBotStep={entryBotStep}
        entryBotMetrics={entryBotMetrics}
        entryBotConfig={entryBotConfig}
        onStartEntryBot={handleStartEntryBot}
        onStopEntryBot={handleStopEntryBot}
        onPauseEntryBot={handlePauseEntryBot}
        onResumeEntryBot={handleResumeEntryBot}
        onResetEntryBot={handleResetEntryBotStats}
        onToggleEntryBotSpeed={handleToggleEntryBotSpeed}
        evenOddBotRunning={evenOddBotRunning}
        evenOddBotPaused={evenOddBotPaused}
        evenOddBotWaiting={evenOddBotWaiting}
        evenOddBotStatus={evenOddBotStatusText}
        evenOddBotStake={evenOddBotStake}
        evenOddBotStep={evenOddBotStep}
        evenOddBotMetrics={evenOddBotMetrics}
        evenOddBotConfig={evenOddBotConfig}
        onStartEvenOddBot={handleStartEvenOddBot}
        onStopEvenOddBot={handleStopEvenOddBot}
        onPauseEvenOddBot={handlePauseEvenOddBot}
        onResumeEvenOddBot={handleResumeEvenOddBot}
        onResetEvenOddBot={handleResetEvenOddBotStats}
        onToggleEvenOddBotSpeed={handleToggleEvenOddBotSpeed}
        onNavigateToBotSettings={(bot) => {
          setBotsTabSubView(bot);
          setActiveTab('bots');
        }}
        currentMarketName={selectedMarket.symbol || selectedMarket.name}
        theme={theme}
      />

      {/* Bottom Navigation with independent bot indicators */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        digitsBotRunning={digitsBotRunning}
        signalBotRunning={normalBotRunning && activeSignal !== null}
        chartsBotRunning={
          chartsBotRunning || normalBotRunning || entryBotRunning || evenOddBotRunning
        }
        xmlBotRunning={xmlBotRunning}
        theme={theme}
      />

      {/* Modals */}
      <DerivApiModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        connectionStatus={connectionStatus}
        accountInfo={derivAccountInfo}
        authError={derivAuthError}
        onConnectWebSocket={(appId, token, endpointUrl) => {
          if (engineRef.current) {
            engineRef.current.connectDeriv(appId, token, endpointUrl);
          }
        }}
        onOpenAuthModal={() => {
          setIsApiModalOpen(false);
          setIsAuthModalOpen(true);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        userAccount={userAccount}
        onUpdateAccount={(acc) => {
          setUserAccount((prev) => {
            const next = { ...prev, ...acc };
            if (acc.balance !== undefined) {
              syncAllExecutorsBalance(acc.balance);
            }
            return next;
          });
        }}
        onResetBalance={handleResetUserBalance}
        onAuthorizeDerivToken={handleAuthorizeDerivToken}
        onOpenLoginPage={() => {
          setIsAuthModalOpen(false);
          setCurrentView('login');
        }}
        onLogout={handleLogout}
      />
    </div>
  );
}
