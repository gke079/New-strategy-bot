import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Market, Tick, BotStrategyConfig, BotMetrics, Trade, UserAccount, TradeContractType } from './types';
import { DEFAULT_MARKET } from './services/markets';
import { TickStreamEngine, ConnectionStatus } from './services/tickEngine';
import { calculateDigitStats, calculateRatioStats } from './services/statsEngine';
import { BotExecutor } from './services/botEngine';
import { soundManager } from './services/soundEffects';

import { Header } from './components/Header';
import { MarketSelector } from './components/MarketSelector';
import { TickCard } from './components/TickCard';
import { TicksWindowControl } from './components/TicksWindowControl';
import { DigitCirclesGrid } from './components/DigitCirclesGrid';
import { RatioCards } from './components/RatioCards';
import { LastDigitsRibbon } from './components/LastDigitsRibbon';
import { QuickTradeBar } from './components/QuickTradeBar';
import { BotStrategyPanel } from './components/BotStrategyPanel';
import { ChartsView } from './components/ChartsView';
import { TradesHistoryView } from './components/TradesHistoryView';
import { BottomNavigation, ActiveTab } from './components/BottomNavigation';
import { DerivApiModal } from './components/DerivApiModal';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [selectedMarket, setSelectedMarket] = useState<Market>(DEFAULT_MARKET);
  const [ticksWindow, setTicksWindow] = useState<number>(1000);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [connectionInfo, setConnectionInfo] = useState<string>('Connecting to Deriv WebSocket...');
  const [isLiveDeriv, setIsLiveDeriv] = useState<boolean>(false);
  const [tickSpeedMs, setTickSpeedMs] = useState<number>(1000);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isPlacingManualTrade, setIsPlacingManualTrade] = useState<boolean>(false);
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

  // User Account & Virtual Demo Balance
  const [userAccount, setUserAccount] = useState<UserAccount>(() => {
    const savedToken = localStorage.getItem('tickedge_deriv_token') || '';
    const savedAcct = localStorage.getItem('tickedge_deriv_acct') || 'TraderEdge';
    return {
      isLoggedIn: Boolean(savedToken),
      username: savedAcct,
      email: 'trader@tickedge.io',
      balance: 10000.0,
      currency: 'USD',
      isDemo: true,
      token: savedToken,
      isRealExecutionEnabled: false,
    };
  });

  // ==========================================
  // 1. DIGITS TAB BOT (INDEPENDENT)
  // ==========================================
  const [digitsBotConfig, setDigitsBotConfig] = useState<BotStrategyConfig>(() => {
    try {
      const saved = localStorage.getItem('tickedge_digits_bot_strategy');
      if (saved) return JSON.parse(saved);
      const legacy = localStorage.getItem('tickedge_saved_strategy');
      if (legacy) return JSON.parse(legacy);
    } catch {}
    return {
      id: 'digits-bot',
      name: 'Over 2 after 3 lows',
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
    };
  });

  const [chartsBotRunning, setChartsBotRunning] = useState<boolean>(false);
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

  // Unified trades history
  const [trades, setTrades] = useState<Trade[]>([]);

  // References to keep singleton instances
  const engineRef = useRef<TickStreamEngine | null>(null);
  const digitsBotExecutorRef = useRef<BotExecutor | null>(null);
  const chartsBotExecutorRef = useRef<BotExecutor | null>(null);

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

    // Listen to Digits bot trades
    const unsubDigitsTrade = digitsBot.onTrade((trade, metrics, balance) => {
      setTrades((prev) => [trade, ...prev.slice(0, 199)]);
      setDigitsBotMetrics(metrics);
      setUserAccount((prev) => ({ ...prev, balance }));
      chartsBotExecutorRef.current?.setBalance(balance);
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
    });

    const unsubChartsStatus = chartsBot.onStatusChange((running) => {
      setChartsBotRunning(running);
    });

    // Listen to connection status and live Deriv indicator
    const unsubStatus = engine.onStatusChange((status, isLive, info) => {
      setConnectionStatus(status);
      setIsLiveDeriv(isLive);
      if (info) setConnectionInfo(info);
    });

    // Listen to Deriv Account authorization
    const unsubAccount = engine.onAccountAuthorize((account) => {
      setUserAccount((prev) => ({
        ...prev,
        isLoggedIn: true,
        username: account.loginid,
        loginid: account.loginid,
        balance: account.balance,
        currency: account.currency,
        isDemo: account.is_virtual,
        tokenScopes: account.scopes,
      }));
      digitsBotExecutorRef.current?.setBalance(account.balance);
      chartsBotExecutorRef.current?.setBalance(account.balance);
    });

    // Listen to real-time balance stream from Deriv
    const unsubBalance = engine.onBalanceUpdate((balance, currency) => {
      setUserAccount((prev) => ({ ...prev, balance, currency }));
      digitsBotExecutorRef.current?.setBalance(balance);
      chartsBotExecutorRef.current?.setBalance(balance);
    });

    // Listen to real contract settlement updates
    const unsubTradeSettled = engine.onTradeSettled((settlement) => {
      setTrades((prev) => {
        const idx = prev.findIndex((t) => t.derivContractId === settlement.contractId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            status: settlement.status,
            profit: settlement.profit,
            exitPrice: settlement.exitPrice,
            exitDigit: settlement.exitDigit,
          };
          return updated;
        }
        return prev;
      });
    });

    // Subscribe to tick stream
    const unsubTicks = engine.subscribe((newTick, allTicks) => {
      setCurrentTick(newTick);
      setTicks([...allTicks]);

      // Sound
      soundManager.playTick(newTick.direction);

      const dStats = calculateDigitStats(allTicks);
      const rStats = calculateRatioStats(allTicks);

      // Independent evaluation: Digits Bot
      if (digitsBotExecutorRef.current && digitsBotExecutorRef.current.getStatus()) {
        digitsBotExecutorRef.current.evaluateTick(newTick, allTicks, dStats, rStats, selectedMarket.id);
      }

      // Independent evaluation: Charts Bot
      if (chartsBotExecutorRef.current && chartsBotExecutorRef.current.getStatus()) {
        chartsBotExecutorRef.current.evaluateTick(newTick, allTicks, dStats, rStats, selectedMarket.id);
      }
    });

    // Check for Deriv OAuth redirect return params
    const params = new URLSearchParams(window.location.search);
    const token1 = params.get('token1');
    const acct1 = params.get('acct1');
    const cur1 = params.get('cur1');
    if (token1) {
      localStorage.setItem('tickedge_deriv_token', token1);
      if (acct1) localStorage.setItem('tickedge_deriv_acct', acct1);
      setUserAccount((prev) => ({
        ...prev,
        isLoggedIn: true,
        username: acct1 || 'DerivTrader',
        currency: cur1 || 'USD',
        token: token1,
      }));
      let activeAppId = localStorage.getItem('tickedge_deriv_app_id') || '1089';
      if (activeAppId === '61554') activeAppId = '1089';
      engine.connectDeriv(activeAppId, token1);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      unsubTicks();
      unsubStatus();
      unsubAccount();
      unsubBalance();
      unsubTradeSettled();
      unsubDigitsTrade();
      unsubDigitsStatus();
      unsubChartsTrade();
      unsubChartsStatus();
      engine.destroy();
    };
  }, []);

  // Sync real execution toggle with bot executors
  useEffect(() => {
    const isReal = Boolean(userAccount.isRealExecutionEnabled && userAccount.isLoggedIn);
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.setRealExecution(isReal, engineRef.current);
    }
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.setRealExecution(isReal, engineRef.current);
    }
  }, [userAccount.isRealExecutionEnabled, userAccount.isLoggedIn]);

  // Sync market changes
  const handleSelectMarket = (market: Market) => {
    setSelectedMarket(market);
    if (engineRef.current) {
      engineRef.current.setMarket(market);
    }
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
  // ONE-CLICK QUICK TRADE HANDLER
  // ==========================================
  const handleQuickTrade = async (
    contractType: TradeContractType,
    predictionDigit?: number,
    customStake?: number
  ) => {
    if (!engineRef.current || !currentTick) return;
    setIsPlacingManualTrade(true);
    const stake = customStake ?? 1.0;

    try {
      if (userAccount.isRealExecutionEnabled && userAccount.isLoggedIn) {
        // Execute real live contract on Deriv exchange
        const settlement = await engineRef.current.buyContract({
          symbol: selectedMarket.id,
          contractType,
          predictionDigit: predictionDigit ?? 2,
          stake,
          duration: 1,
          durationUnit: 't',
          currency: userAccount.currency,
        });

        const tradeRecord: Trade = {
          id: `DERIV-${settlement.contractId}`,
          timestamp: Date.now(),
          marketId: selectedMarket.id,
          strategyName: 'Manual One-Click (Deriv Real)',
          contractType,
          prediction: `${contractType} ${predictionDigit !== undefined ? predictionDigit : ''}`.trim(),
          stake,
          entryPrice: currentTick.quote,
          exitPrice: settlement.exitPrice,
          exitDigit: settlement.exitDigit,
          profit: settlement.profit,
          status: settlement.status,
          balanceAfter: Number((userAccount.balance + settlement.profit).toFixed(2)),
          botSource: 'manual',
          derivContractId: settlement.contractId,
          isRealTrade: true,
        };

        setTrades((prev) => [tradeRecord, ...prev.slice(0, 199)]);
        setUserAccount((prev) => ({
          ...prev,
          balance: Number((prev.balance + settlement.profit).toFixed(2)),
        }));

        if (settlement.status === 'won') {
          soundManager.playWin();
        } else {
          soundManager.playLoss();
        }
      } else {
        // Simulated execution against genuine live tick
        const digit = currentTick.lastDigit;
        const pred = predictionDigit ?? 2;
        let won = false;
        let mult = 1.95;

        if (contractType === 'OVER') {
          won = digit > pred;
          mult = Number((9.5 / Math.max(1, 9 - pred)).toFixed(2));
        } else if (contractType === 'UNDER') {
          won = digit < pred;
          mult = Number((9.5 / Math.max(1, pred)).toFixed(2));
        } else if (contractType === 'EVEN') {
          won = digit % 2 === 0;
          mult = 1.95;
        } else if (contractType === 'ODD') {
          won = digit % 2 !== 0;
          mult = 1.95;
        } else if (contractType === 'DIFFERS') {
          won = digit !== pred;
          mult = 1.09;
        } else if (contractType === 'MATCHES') {
          won = digit === pred;
          mult = 9.0;
        } else if (contractType === 'RISE') {
          won = currentTick.direction === 'up';
          mult = 1.95;
        } else if (contractType === 'FALL') {
          won = currentTick.direction === 'down';
          mult = 1.95;
        }

        const profit = won ? Number((stake * (mult - 1)).toFixed(2)) : -stake;
        const newBal = Number((userAccount.balance + profit).toFixed(2));

        setUserAccount((prev) => ({ ...prev, balance: newBal }));
        digitsBotExecutorRef.current?.setBalance(newBal);
        chartsBotExecutorRef.current?.setBalance(newBal);

        const tradeRecord: Trade = {
          id: 'MANUAL-' + Date.now().toString(36),
          timestamp: Date.now(),
          marketId: selectedMarket.id,
          strategyName: 'Manual One-Click (Virtual Demo)',
          contractType,
          prediction: `${contractType} ${predictionDigit !== undefined ? predictionDigit : ''}`.trim(),
          stake,
          entryPrice: currentTick.quote,
          exitPrice: currentTick.quote,
          exitDigit: digit,
          profit,
          status: won ? 'won' : 'lost',
          balanceAfter: newBal,
          botSource: 'manual',
          isRealTrade: false,
        };

        setTrades((prev) => [tradeRecord, ...prev.slice(0, 199)]);
        if (won) soundManager.playWin();
        else soundManager.playLoss();
      }
    } catch (err: any) {
      alert(`Trade error: ${err.message || 'Trade execution failed'}`);
    } finally {
      setIsPlacingManualTrade(false);
    }
  };

  // ==========================================
  // DIGITS BOT HANDLERS
  // ==========================================
  const handleUpdateDigitsBotConfig = (newConfig: Partial<BotStrategyConfig>) => {
    const updated = { ...digitsBotConfig, ...newConfig };
    setDigitsBotConfig(updated);
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.updateConfig(updated);
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
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.updateConfig(updated);
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

  // Reset user balance (updates both executors)
  const handleResetUserBalance = (amount: number) => {
    setUserAccount((prev) => ({ ...prev, balance: amount }));
    if (digitsBotExecutorRef.current) {
      digitsBotExecutorRef.current.setBalance(amount);
    }
    if (chartsBotExecutorRef.current) {
      chartsBotExecutorRef.current.setBalance(amount);
    }
  };

  const handleAuthorizeDerivToken = (token: string) => {
    setUserAccount((prev) => ({
      ...prev,
      isLoggedIn: true,
      token,
      email: 'deriv_user@auth.deriv.com',
    }));
    if (engineRef.current) {
      let activeAppId = localStorage.getItem('tickedge_deriv_app_id') || '1089';
      if (activeAppId === '61554') activeAppId = '1089';
      engineRef.current.connectDeriv(activeAppId, token);
    }
  };

  // Compute stats on-the-fly from the ticks buffer
  const digitStats = useMemo(() => calculateDigitStats(ticks), [ticks]);
  const ratioStats = useMemo(() => calculateRatioStats(ticks), [ticks]);

  return (
    <div className="min-h-screen bg-[#080d16] text-slate-100 flex flex-col pb-20 selection:bg-[#00e599]/30">
      {/* Top Header */}
      <Header
        connectionStatus={connectionStatus}
        isLiveDeriv={isLiveDeriv}
        isRealExecutionEnabled={userAccount.isRealExecutionEnabled}
        accountLoginId={userAccount.username}
        marketSymbol={selectedMarket.symbol}
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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6 flex flex-col gap-4">
        {/* DIGITS TAB */}
        {activeTab === 'digits' && (
          <>
            {/* Market Selector matching screenshot dropdown */}
            <MarketSelector
              selectedMarket={selectedMarket}
              onSelectMarket={handleSelectMarket}
            />

            {/* Current Tick / Price banner */}
            <TickCard currentTick={currentTick} market={selectedMarket} />

            {/* Ticks window row with editable input & count badge matching screenshot */}
            <TicksWindowControl
              ticksWindow={ticksWindow}
              currentCount={ticks.length}
              onChangeWindow={handleChangeWindow}
              onResetBuffer={handleResetBuffer}
            />

            {/* The 10 Digit Circles (0-9) & Legend Pills matching screenshot */}
            <DigitCirclesGrid
              stats={digitStats}
              activeDigit={currentTick?.lastDigit}
              onSelectDigit={(d) => {
                handleUpdateDigitsBotConfig({ predictionDigit: d, xDigit: d });
              }}
            />

            {/* Two Ratio Cards (Even/Odd and Over 4/Under 5) matching screenshot */}
            <RatioCards ratioStats={ratioStats} />

            {/* Last 30 digits Ribbon matching screenshot */}
            <LastDigitsRibbon ticks={ticks} />

            {/* One-Click Real Tick Trading Widget */}
            <QuickTradeBar
              currentTick={currentTick}
              market={selectedMarket}
              isRealExecution={Boolean(userAccount.isRealExecutionEnabled)}
              isLoggedIn={userAccount.isLoggedIn}
              balance={userAccount.balance}
              currency={userAccount.currency}
              onQuickTrade={handleQuickTrade}
              isPlacingTrade={isPlacingManualTrade}
              onOpenDerivModal={() => setIsApiModalOpen(true)}
            />

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
              storageKey="tickedge_digits_bot_strategy"
              tag="Digits Bot"
            />
          </>
        )}

        {/* CHARTS TAB */}
        {activeTab === 'charts' && (
          <>
            <MarketSelector
              selectedMarket={selectedMarket}
              onSelectMarket={handleSelectMarket}
            />
            <TickCard currentTick={currentTick} market={selectedMarket} />
            <ChartsView ticks={ticks} market={selectedMarket} />

            {/* Charts Bot Strategy panel (INDEPENDENT) */}
            <BotStrategyPanel
              config={chartsBotConfig}
              onUpdateConfig={handleUpdateChartsBotConfig}
              isRunning={chartsBotRunning}
              onStart={handleStartChartsBot}
              onStop={handleStopChartsBot}
              metrics={chartsBotMetrics}
              trades={trades.filter((t) => t.botSource === 'charts')}
              onResetStats={handleResetChartsBotStats}
              onResetAfterTrade={handleResetChartsBotAfterTrade}
              balance={userAccount.balance}
              storageKey="tickedge_charts_bot_strategy"
              tag="Charts Bot"
            />
          </>
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

      {/* Bottom Navigation with independent bot indicators */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        digitsBotRunning={digitsBotRunning}
        chartsBotRunning={chartsBotRunning}
      />

      {/* Modals */}
      <DerivApiModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        connectionStatus={connectionStatus}
        connectionInfo={connectionInfo}
        isLiveDeriv={isLiveDeriv}
        userAccount={userAccount}
        onUpdateAccount={(acc) => setUserAccount((prev) => ({ ...prev, ...acc }))}
        onConnectWebSocket={(appId, token) => {
          if (engineRef.current) {
            engineRef.current.connectDeriv(appId, token);
          }
        }}
        onReconnect={() => {
          if (engineRef.current) {
            engineRef.current.reconnect();
          }
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
