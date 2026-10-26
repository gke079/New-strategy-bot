import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Market,
  Tick,
  BotStrategyConfig,
  BotMetrics,
  Trade,
  UserAccount,
  NormalBotConfig,
  XmlBotConfig,
  XmlBotStage,
  XmlJournalEntry,
} from './types';
import { DEFAULT_MARKET, SYNTHETIC_MARKETS } from './services/markets';
import { TickStreamEngine, ConnectionStatus, DerivAccountInfo } from './services/tickEngine';
import { calculateDigitStats, calculateRatioStats } from './services/statsEngine';
import { BotExecutor } from './services/botEngine';
import { NormalBotExecutor, ActiveContract } from './services/normalBotEngine';
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
import { BotBuilderView } from './components/BotBuilderView';
import { SignalsView, SignalExecutionRequest } from './components/SignalsView';
import { ChartsView } from './components/ChartsView';
import { TradesHistoryView } from './components/TradesHistoryView';
import { BottomNavigation, ActiveTab } from './components/BottomNavigation';
import { DerivApiModal } from './components/DerivApiModal';
import { AuthModal } from './components/AuthModal';
import { FloatingBotController } from './components/FloatingBotController';
import { Zap, Cpu, ShieldCheck } from 'lucide-react';

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
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Deriv Account Details & Auth Error
  const [derivAccountInfo, setDerivAccountInfo] = useState<DerivAccountInfo | null>(null);
  const [derivAuthError, setDerivAuthError] = useState<string | null>(null);

  // User Account & Virtual Demo Balance
  const [userAccount, setUserAccount] = useState<UserAccount>({
    isLoggedIn: false,
    username: 'TraderEdge',
    email: 'trader@tickedge.io',
    balance: 10000.0,
    currency: 'USD',
    isDemo: true,
  });

  // ==========================================
  // 1. DIGITS TAB BOT (INDEPENDENT)
  // ==========================================
  const [digitsBotConfig, setDigitsBotConfig] = useState<BotStrategyConfig>(() => {
    try {
      const saved = localStorage.getItem('tickedge_digits_bot_strategy');
      if (saved) return JSON.parse(saved);
      // Legacy fallback
      const legacy = localStorage.getItem('tickedge_saved_strategy');
      if (legacy) return JSON.parse(legacy);
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
      stake: 1.0,
      initialStake: 1.0,
      martingale: 2.0,
      maxSteps: 4,
      takeProfit: 10.0,
      stopLoss: 20.0,
      active: false,
      executionMode: 'reanalyse',
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
      const saved = localStorage.getItem('tickedge_charts_bot_strategy');
      if (saved) return JSON.parse(saved);
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
      stake: 1.0,
      initialStake: 1.0,
      martingale: 2.0,
      maxSteps: 4,
      takeProfit: 15.0,
      stopLoss: 25.0,
      active: false,
      executionMode: 'reanalyse',
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
  const [botsTabSubView, setBotsTabSubView] = useState<'normal' | 'strategy'>('normal');
  const [floatingBotSelection, setFloatingBotSelection] = useState<'normal' | 'strategy'>('normal');
  const [normalBotConfig, setNormalBotConfig] = useState<NormalBotConfig>(() => {
    try {
      const saved = localStorage.getItem('tickedge_normal_bot_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      id: 'normal-bot',
      name: 'Normal Bot',
      marketId: DEFAULT_MARKET.id,
      contractType: 'OVER',
      prediction: 2,
      stake: 1.0,
      initialStake: 1.0,
      duration: 1,
      durationUnit: 't',
      takeProfit: 10.0,
      stopLoss: 20.0,
      martingale: 2.0,
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

  // ==========================================
  // 4. DERIV XML BOT BUILDER (BLOCKLY & STRUCTURED)
  // ==========================================
  const [xmlBotConfig, setXmlBotConfig] = useState<XmlBotConfig>(() => {
    try {
      const saved = localStorage.getItem('tickedge_xml_bot_config');
      if (saved) return JSON.parse(saved);
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

  // Active Signal metadata running on Normal Bot
  const [activeSignalMarketId, setActiveSignalMarketId] = useState<string | null>(null);
  const [activeSignalLabel, setActiveSignalLabel] = useState<string | null>(null);

  // Unified trades history
  const [trades, setTrades] = useState<Trade[]>([]);

  // References to keep singleton instances
  const engineRef = useRef<TickStreamEngine | null>(null);
  const selectedMarketRef = useRef<Market>(selectedMarket);
  const digitsBotExecutorRef = useRef<BotExecutor | null>(null);
  const chartsBotExecutorRef = useRef<BotExecutor | null>(null);
  const normalBotExecutorRef = useRef<NormalBotExecutor | null>(null);
  const xmlBotExecutorRef = useRef<XmlBotExecutor | null>(null);

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

    // Independent Deriv XML Bot Executor
    const xmlBot = new XmlBotExecutor(xmlBotConfig, userAccount.balance);
    xmlBotExecutorRef.current = xmlBot;

    // Listen to Digits bot trades
    const unsubDigitsTrade = digitsBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setDigitsBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      chartsBotExecutorRef.current?.setBalance(balance);
      normalBotExecutorRef.current?.setBalance(balance);
      xmlBotExecutorRef.current?.setBalance(balance);
    });

    const unsubDigitsStatus = digitsBot.onStatusChange((running) => {
      setDigitsBotRunning(running);
    });

    // Listen to Charts bot trades
    const unsubChartsTrade = chartsBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setChartsBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      digitsBotExecutorRef.current?.setBalance(balance);
      normalBotExecutorRef.current?.setBalance(balance);
      xmlBotExecutorRef.current?.setBalance(balance);
    });

    const unsubChartsStatus = chartsBot.onStatusChange((running) => {
      setChartsBotRunning(running);
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
      digitsBotExecutorRef.current?.setBalance(balance);
      chartsBotExecutorRef.current?.setBalance(balance);
      xmlBotExecutorRef.current?.setBalance(balance);
      setNormalBotStake(normalBot.getCurrentStake());
      setNormalBotStep(normalBot.getCurrentStep());
    });

    const unsubNormalStatus = normalBot.onStatusChange((running) => {
      setNormalBotRunning(running);
      if (!running) {
        setNormalBotPaused(false);
        setActiveSignalMarketId(null);
      }
    });

    const unsubNormalPause = normalBot.onPauseChange((paused) => {
      setNormalBotPaused(paused);
    });

    const unsubNormalProgress = normalBot.onContractProgress((activeContract) => {
      setNormalBotActiveContract(activeContract);
    });

    // Listen to XML Bot trades, status & journal
    const unsubXmlTrade = xmlBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setXmlBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      digitsBotExecutorRef.current?.setBalance(balance);
      chartsBotExecutorRef.current?.setBalance(balance);
      normalBotExecutorRef.current?.setBalance(balance);
      setXmlBotStake(xmlBot.getCurrentStake());
      setXmlBotStep(xmlBot.getCurrentStep());
    });

    const unsubXmlStatus = xmlBot.onStatusChange((running, paused, stage) => {
      setXmlBotRunning(running);
      setXmlBotPaused(paused);
      setXmlBotStage(stage);
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
        digitsBotExecutorRef.current?.setBalance(acc.balance);
        chartsBotExecutorRef.current?.setBalance(acc.balance);
        normalBotExecutorRef.current?.setBalance(acc.balance);
        xmlBotExecutorRef.current?.setBalance(acc.balance);
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
      setUserAccount((prev) => ({
        ...prev,
        isLoggedIn: true,
        username: acct1 || 'DerivTrader',
        currency: cur1 || 'USD',
        isDemo: Boolean(acct1 && acct1.startsWith('VR')),
      }));
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

  // Sync market changes
  const handleSelectMarket = (market: Market) => {
    selectedMarketRef.current = market;
    setSelectedMarket(market);
    if (engineRef.current) {
      engineRef.current.setMarket(market);
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
    const updated = { ...digitsBotConfig, ...newConfig };
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
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.start();
    }
  };

  const handleStopDigitsBot = () => {
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.stop('Manual Stop');
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
    const updated = { ...chartsBotConfig, ...newConfig };
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
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.start();
    }
  };

  const handleStopChartsBot = () => {
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.stop('Manual Stop');
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
    localStorage.setItem('tickedge_normal_bot_config', JSON.stringify(updated));
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.updateConfig(updated);
    }
    if (newConfig.marketId && newConfig.marketId !== selectedMarket.id) {
      const targetMarket = SYNTHETIC_MARKETS.find((m) => m.id === newConfig.marketId);
      if (targetMarket) {
        handleSelectMarket(targetMarket);
      }
    }
  };

  const handleStartNormalBot = () => {
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.start();
    }
  };

  const handleStopNormalBot = () => {
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.stop('Manual Stop');
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

    // 2. Sync Normal Bot configuration with the Signal parameters
    const resolvedPrediction =
      req.contractType === 'EVEN' || req.contractType === 'ODD'
        ? req.contractType
        : req.prediction;

    const updatedNormal: NormalBotConfig = {
      ...normalBotConfig,
      name: `Signal · ${req.signalLabel}`,
      marketId: req.market.id,
      contractType: req.contractType,
      prediction: resolvedPrediction,
      signalEntryTrigger: req.signalEntryTrigger,
      stake: req.stake,
      initialStake: req.stake,
      duration: 1,
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
    setActiveSignalMarketId(req.market.id);
    setActiveSignalLabel(req.signalLabel);
    setBotsTabSubView('normal');
    setFloatingBotSelection('normal');

    // 3. Start Normal Bot and immediately open the first contract
    normalBotExecutorRef.current.start();
    const currentMarketTicks = engineRef.current?.getTicks() || [];
    if (currentMarketTicks.length > 0) {
      const latest = currentMarketTicks[currentMarketTicks.length - 1];
      normalBotExecutorRef.current.evaluateTick(latest, currentMarketTicks, req.market.id);
    }
  };

  // Reset user balance (updates all executors)
  const handleResetUserBalance = (amount: number) => {
    setUserAccount((prev) => ({ ...prev, balance: amount }));
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.setBalance(amount);
    }
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.setBalance(amount);
    }
    if (normalBotExecutorRef.current) {
      normalBotExecutorRef.current.setBalance(amount);
    }
    if (xmlBotExecutorRef.current) {
      xmlBotExecutorRef.current.setBalance(amount);
    }
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

  // Compute stats on-the-fly from the ticks buffer based on past ticks (excluding the current tick)
  const pastTicks = useMemo(() => (ticks.length > 1 ? ticks.slice(0, -1) : ticks), [ticks]);
  const digitStats = useMemo(() => calculateDigitStats(pastTicks), [pastTicks]);
  const ratioStats = useMemo(() => calculateRatioStats(pastTicks), [pastTicks]);

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
                  <h4 className="font-bold text-white text-sm">Official Deriv OAuth Authorization</h4>
                  <span className="text-[10px] bg-[#ff444f]/20 text-[#ff444f] border border-[#ff444f]/40 font-bold px-1.5 py-0.5 rounded uppercase">
                    OAuth 2.0
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Connect your Deriv account for live tick feeds, real & demo automated bot trading, and balance sync.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm text-white bg-gradient-to-r from-[#ff444f] via-[#e53945] to-[#cc2936] hover:from-[#ff555f] hover:to-[#ea3943] shadow-[0_0_20px_rgba(255,68,79,0.45)] hover:shadow-[0_0_30px_rgba(255,68,79,0.7)] transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 active:scale-95 border border-[#ff444f]/50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Login with Deriv</span>
            </button>
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
                handleUpdateNormalBotConfig({ prediction: d });
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
            normalBotStake={normalBotStake}
            normalBotMetrics={normalBotMetrics}
            activeSignalMarketId={activeSignalMarketId}
            activeSignalLabel={activeSignalLabel}
            theme={theme}
          />
        )}

        {/* BOTS TAB */}
        {activeTab === 'bots' && (
          <>
            {/* Circle Digit Analysis in a straight horizontal line */}
            <DigitCirclesGrid
              stats={digitStats}
              activeDigit={currentTick?.lastDigit}
              layout="horizontal"
              theme={theme}
              onSelectDigit={(d) => {
                handleUpdateNormalBotConfig({ prediction: d });
                handleUpdateChartsBotConfig({ predictionDigit: d, xDigit: d });
              }}
            />

            {/* Sub-navigation to switch between the Normal Bot and Strategy Bot (White box) */}
            <div
              className="flex items-center justify-between p-1.5 rounded-2xl border bg-white border-neutral-300 shadow-sm transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBotsTabSubView('normal')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                  onClick={() => setBotsTabSubView('strategy')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
              </div>

              <div className="hidden sm:flex items-center gap-2 pr-3 font-mono text-xs">
                <span className="text-neutral-500">
                  Active Mode:
                </span>
                <span
                  className="font-bold text-neutral-950"
                >
                  {botsTabSubView === 'normal' ? 'Normal Direct Execution' : 'Advanced Strategy'}
                </span>
              </div>
            </div>

            {/* 1. NORMAL BOT (With: market, contract, prediction, stake, duration, take profit, stop loss, martingale, martingale level) */}
            {botsTabSubView === 'normal' && (
              <NormalBotPanel
                config={normalBotConfig}
                onUpdateConfig={handleUpdateNormalBotConfig}
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
        signalBotRunning={normalBotRunning && activeSignalMarketId !== null}
        chartsBotRunning={chartsBotRunning || normalBotRunning}
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
        onUpdateAccount={(acc) => setUserAccount((prev) => ({ ...prev, ...acc }))}
        onResetBalance={handleResetUserBalance}
        onAuthorizeDerivToken={handleAuthorizeDerivToken}
      />
    </div>
  );
}
