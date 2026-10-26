import { BotMetrics, BotStrategyConfig, DigitStat, RatioStats, Tick, Trade } from '../types';
import { soundManager } from './soundEffects';
import confetti from 'canvas-confetti';

export class BotExecutor {
  private config: BotStrategyConfig;
  private currentStake: number;
  private currentStep: number = 0;
  private consecutiveLosses: number = 0;
  private consecutiveWins: number = 0;
  private trades: Trade[] = [];
  private metrics: BotMetrics = {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    currentStreak: { type: null, count: 0 },
    maxDrawdown: 0,
    peakBalance: 10000,
  };
  private balance: number = 10000;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private analysisTriggered: boolean = false;
  public readonly botSource: 'digits' | 'charts';
  private onTradeListeners: Set<(trade: Trade, metrics: BotMetrics, balance: number) => void> = new Set();
  private onStatusChangeListeners: Set<(isRunning: boolean, reason?: string) => void> = new Set();
  private onPauseChangeListeners: Set<(isPaused: boolean) => void> = new Set();
  private pendingContract: {
    entryTick: Tick;
    stake: number;
    ticksRemaining: number;
    predictionText: string;
    payoutMultiplier: number;
    tradeType: BotStrategyConfig['tradeType'];
    predictionDigit: number;
  } | null = null;

  constructor(config: BotStrategyConfig, initialBalance: number = 10000, botSource: 'digits' | 'charts' = 'digits') {
    this.config = { ...config };
    this.currentStake = config.initialStake;
    this.balance = initialBalance;
    this.metrics.peakBalance = initialBalance;
    this.botSource = botSource;
  }

  public updateConfig(newConfig: Partial<BotStrategyConfig>) {
    const analysisParamChanged =
      (newConfig.entryCondition !== undefined && newConfig.entryCondition !== this.config.entryCondition) ||
      (newConfig.n !== undefined && newConfig.n !== this.config.n) ||
      (newConfig.xDigit !== undefined && newConfig.xDigit !== this.config.xDigit) ||
      (newConfig.pPercent !== undefined && newConfig.pPercent !== this.config.pPercent);

    if (analysisParamChanged || newConfig.executionMode === 'reanalyse') {
      this.analysisTriggered = false;
    }

    this.config = { ...this.config, ...newConfig };
    if (!this.isRunning) {
      this.currentStake = this.config.initialStake;
      this.currentStep = 0;
    }
  }

  public setBalance(newBalance: number) {
    this.balance = newBalance;
    this.metrics.peakBalance = Math.max(this.metrics.peakBalance, newBalance);
  }

  public getBalance(): number {
    return this.balance;
  }

  public getMetrics(): BotMetrics {
    return { ...this.metrics };
  }

  public getTrades(): Trade[] {
    return [...this.trades];
  }

  public getStatus(): boolean {
    return this.isRunning;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public start() {
    this.isRunning = true;
    this.isPaused = false;
    this.analysisTriggered = false;
    this.pendingContract = null;
    this.currentStake = this.config.initialStake;
    this.currentStep = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.notifyStatus(true);
    this.notifyPause(false);
  }

  public stop(reason?: string) {
    this.isRunning = false;
    this.isPaused = false;
    this.analysisTriggered = false;
    this.pendingContract = null;
    this.notifyStatus(false, reason);
    this.notifyPause(false);
  }

  public pause() {
    if (!this.isRunning) return;
    this.isPaused = true;
    this.notifyPause(true);
  }

  public resume() {
    if (!this.isRunning) return;
    this.isPaused = false;
    this.notifyPause(false);
  }

  public resetStats() {
    this.trades = [];
    this.pendingContract = null;
    this.analysisTriggered = false;
    this.currentStake = this.config.initialStake;
    this.currentStep = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.metrics = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalProfit: 0,
      currentStreak: { type: null, count: 0 },
      maxDrawdown: 0,
      peakBalance: this.balance,
    };
  }

  public resetTradeStake() {
    this.currentStake = this.config.initialStake;
    this.currentStep = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
  }

  public getCurrentStake(): number {
    return this.currentStake;
  }

  public getCurrentStep(): number {
    return this.currentStep;
  }

  public onTrade(listener: (trade: Trade, metrics: BotMetrics, balance: number) => void): () => void {
    this.onTradeListeners.add(listener);
    return () => this.onTradeListeners.delete(listener);
  }

  public onStatusChange(listener: (isRunning: boolean, reason?: string) => void): () => void {
    this.onStatusChangeListeners.add(listener);
    return () => this.onStatusChangeListeners.delete(listener);
  }

  public onPauseChange(listener: (isPaused: boolean) => void): () => void {
    this.onPauseChangeListeners.add(listener);
    return () => this.onPauseChangeListeners.delete(listener);
  }

  private notifyStatus(running: boolean, reason?: string) {
    this.onStatusChangeListeners.forEach((l) => l(running, reason));
  }

  private notifyPause(paused: boolean) {
    this.onPauseChangeListeners.forEach((l) => l(paused));
  }

  // Calculate payout multiplier based on trade contract type and prediction digit
  private getPayoutMultiplier(type: BotStrategyConfig['tradeType'], digit: number): number {
    switch (type) {
      case 'OVER': {
        const winningCount = Math.max(1, 9 - digit);
        return Number((9.5 / winningCount).toFixed(3));
      }
      case 'UNDER': {
        const winningCount = Math.max(1, digit);
        return Number((9.5 / winningCount).toFixed(3));
      }
      case 'DIFFERS':
        return 1.095;
      case 'MATCHES':
        return 9.0;
      case 'EVEN':
      case 'ODD':
      case 'RISE':
      case 'FALL':
      case 'HIGHER':
      case 'LOWER':
      case 'ASIAN_UP':
      case 'ASIAN_DOWN':
        return 1.95;
      case 'ONLY_UP':
      case 'ONLY_DOWN':
        return 3.85;
      case 'RESET_CALL':
      case 'RESET_PUT':
        return 1.85;
      case 'HIGH_TICK':
      case 'LOW_TICK':
        return 4.20;
      case 'STAY_BETWEEN':
        return 1.92;
      case 'GOES_OUTSIDE':
        return 2.15;
      case 'TOUCH':
        return 2.25;
      case 'NO_TOUCH':
        return 1.75;
      default:
        return 1.95;
    }
  }

  // Check if strategy entry condition is satisfied by recent ticks
  private checkEntryCondition(
    recentTicks: Tick[],
    digitStats: DigitStat[],
    ratioStats: RatioStats
  ): boolean {
    const n = Math.max(1, this.config.n);
    const x = this.config.xDigit;
    const p = this.config.pPercent;

    if (recentTicks.length < n) return false;
    const lastNDigits = recentTicks.slice(-n).map((t) => t.lastDigit);

    switch (this.config.entryCondition) {
      case 'under_x': {
        // "Last N digits all under X" (e.g. last 3 digits all under 3)
        const allUnder = lastNDigits.every((d) => d < x);
        if (!allUnder) return false;
        // If P % is set, check if the frequency of digits under X is <= P %
        if (p > 0) {
          const underCount = digitStats.filter((s) => s.digit < x).reduce((acc, curr) => acc + curr.percentage, 0);
          if (underCount > p) return false;
        }
        return true;
      }

      case 'over_x': {
        // "Last N digits all over X"
        const allOver = lastNDigits.every((d) => d > x);
        if (!allOver) return false;
        if (p > 0) {
          const overCount = digitStats.filter((s) => s.digit > x).reduce((acc, curr) => acc + curr.percentage, 0);
          if (overCount > p) return false;
        }
        return true;
      }

      case 'all_even': {
        return lastNDigits.every((d) => d % 2 === 0);
      }

      case 'all_odd': {
        return lastNDigits.every((d) => d % 2 !== 0);
      }

      case 'n_rising_then_falling': {
        // At least N rising ticks followed by 1 falling tick (N >= 2)
        const minN = Math.max(2, this.config.n);
        if (recentTicks.length < minN + 1) return false;

        const lastIdx = recentTicks.length - 1;
        const lastTick = recentTicks[lastIdx];
        const isLastFalling = lastTick.direction === 'down' || lastTick.change < 0;
        if (!isLastFalling) return false;

        // Count consecutive rising ticks immediately prior to the falling tick
        let risingCount = 0;
        for (let i = lastIdx - 1; i >= 0; i--) {
          const t = recentTicks[i];
          const isRising = t.direction === 'up' || t.change > 0;
          if (isRising) {
            risingCount++;
          } else {
            break;
          }
        }

        return risingCount >= minN;
      }

      case 'n_falling_then_rising': {
        // At least N falling ticks followed by 1 rising tick (N >= 2)
        const minN = Math.max(2, this.config.n);
        if (recentTicks.length < minN + 1) return false;

        const lastIdx = recentTicks.length - 1;
        const lastTick = recentTicks[lastIdx];
        const isLastRising = lastTick.direction === 'up' || lastTick.change > 0;
        if (!isLastRising) return false;

        let fallingCount = 0;
        for (let i = lastIdx - 1; i >= 0; i--) {
          const t = recentTicks[i];
          const isFalling = t.direction === 'down' || t.change < 0;
          if (isFalling) {
            fallingCount++;
          } else {
            break;
          }
        }

        return fallingCount >= minN;
      }

      case 'least_percent': {
        const least = digitStats.find((s) => s.rank === 'least');
        return least ? least.percentage <= p : false;
      }

      case 'most_percent': {
        const most = digitStats.find((s) => s.rank === 'most');
        return most ? most.percentage >= p : false;
      }

      case 'repeat_streak': {
        const first = lastNDigits[0];
        return lastNDigits.every((d) => d === first);
      }

      case 'differs_least':
      default:
        return true;
    }
  }

  // Evaluates every incoming tick against strategy conditions
  public evaluateTick(
    tick: Tick,
    allTicks: Tick[],
    digitStats: DigitStat[],
    ratioStats: RatioStats,
    marketId: string
  ) {
    if (!this.isRunning || this.isPaused) return;

    // Check Take Profit or Stop Loss
    if (this.metrics.totalProfit >= this.config.takeProfit) {
      this.stop(`Take Profit reached (+${this.metrics.totalProfit.toFixed(2)}$)`);
      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch {}
      return;
    }

    if (this.metrics.totalProfit <= -Math.abs(this.config.stopLoss)) {
      this.stop(`Stop Loss reached (${this.metrics.totalProfit.toFixed(2)}$)`);
      return;
    }

    // 1. If a contract is pending in Normal Mode:
    if (this.pendingContract) {
      if (this.pendingContract.ticksRemaining === 2) {
        // Normal mode: skip 1 tick!
        this.pendingContract.ticksRemaining = 1;
        return;
      }
      // This tick is the exit tick!
      const contract = this.pendingContract;
      this.pendingContract = null;
      this.executeStrategyOutcome(
        tick,
        allTicks,
        contract.entryTick,
        contract.stake,
        contract.tradeType,
        contract.predictionDigit,
        contract.predictionText,
        contract.payoutMultiplier,
        marketId
      );
      return;
    }

    // 2. Evaluate Entry Condition using ticks before the current tick
    // - 'reanalyse' (default): checks entry condition before every single trade
    // - 'continuous': checks entry condition once, then trades continuously without re-analysing
    const priorTicks = allTicks.slice(0, -1);
    const isContinuous = this.config.executionMode === 'continuous';
    if (!isContinuous || !this.analysisTriggered) {
      if (!this.checkEntryCondition(priorTicks, digitStats, ratioStats)) {
        return;
      }
      if (isContinuous) {
        this.analysisTriggered = true;
      }
    }

    // Determine signal details
    const tradeType = this.config.tradeType;
    const predictionDigit = this.config.predictionDigit;
    const payoutMultiplier = this.getPayoutMultiplier(tradeType, predictionDigit);

    // Prediction label formatting
    const digitTradeTypes = ['OVER', 'UNDER', 'DIFFERS', 'MATCHES'];
    let predictionText: string;
    if (digitTradeTypes.includes(tradeType)) {
      predictionText = `${tradeType} ${predictionDigit}`;
    } else {
      predictionText = tradeType.replace('_', ' ');
    }

    // Check balance
    const stakeToUse = Math.min(this.balance, Math.max(0.35, this.currentStake));
    if (this.balance < stakeToUse) {
      this.stop('Insufficient balance to place stake');
      return;
    }

    const isNormalSpeed = (this.config.botSpeed || 'normal') === 'normal';
    if (isNormalSpeed) {
      // Normal mode: Record entry tick, skip 1 tick, then exit on the next tick
      this.pendingContract = {
        entryTick: tick,
        stake: stakeToUse,
        ticksRemaining: 2,
        predictionText,
        payoutMultiplier,
        tradeType,
        predictionDigit,
      };
      return;
    }

    // Fast mode: Trades every tick!
    const prevTick = priorTicks.length > 0 ? priorTicks[priorTicks.length - 1] : tick;
    this.executeStrategyOutcome(
      tick,
      allTicks,
      prevTick,
      stakeToUse,
      tradeType,
      predictionDigit,
      predictionText,
      payoutMultiplier,
      marketId
    );
  }

  // Executes the strategy outcome on exit tick
  private executeStrategyOutcome(
    tick: Tick,
    allTicks: Tick[],
    entryTick: Tick,
    stakeToUse: number,
    tradeType: BotStrategyConfig['tradeType'],
    predictionDigit: number,
    predictionText: string,
    payoutMultiplier: number,
    marketId: string
  ) {
    const digit = tick.lastDigit;
    const prevQuote = entryTick ? entryTick.quote : tick.quote;
    let won = false;

    switch (tradeType) {
      case 'OVER':
        won = digit > predictionDigit;
        break;
      case 'UNDER':
        won = digit < predictionDigit;
        break;
      case 'DIFFERS':
        won = digit !== predictionDigit;
        break;
      case 'MATCHES':
        won = digit === predictionDigit;
        break;
      case 'EVEN':
        won = digit % 2 === 0;
        break;
      case 'ODD':
        won = digit % 2 !== 0;
        break;
      case 'RISE':
      case 'HIGHER':
        won = tick.quote > prevQuote || tick.direction === 'up';
        break;
      case 'FALL':
      case 'LOWER':
        won = tick.quote < prevQuote || tick.direction === 'down';
        break;
      case 'ONLY_UP':
        won = tick.direction === 'up' || tick.change > 0;
        break;
      case 'ONLY_DOWN':
        won = tick.direction === 'down' || tick.change < 0;
        break;
      case 'RESET_CALL':
        won = tick.quote >= prevQuote;
        break;
      case 'RESET_PUT':
        won = tick.quote <= prevQuote;
        break;
      case 'HIGH_TICK': {
        const lastQuotes = allTicks.slice(-6).map((t) => t.quote);
        won = tick.quote >= Math.max(...lastQuotes);
        break;
      }
      case 'LOW_TICK': {
        const lastQuotes = allTicks.slice(-6).map((t) => t.quote);
        won = tick.quote <= Math.min(...lastQuotes);
        break;
      }
      case 'STAY_BETWEEN': {
        const diff = Math.abs(tick.change);
        const threshold = Math.abs(prevQuote) * 0.00035;
        won = diff <= threshold;
        break;
      }
      case 'GOES_OUTSIDE': {
        const diff = Math.abs(tick.change);
        const threshold = Math.abs(prevQuote) * 0.00035;
        won = diff > threshold;
        break;
      }
      case 'TOUCH':
        won = Math.abs(tick.change) > 0;
        break;
      case 'NO_TOUCH':
        won = tick.direction === 'flat' || Math.abs(tick.change) === 0;
        break;
      case 'ASIAN_UP': {
        const avg = allTicks.slice(-5).reduce((acc, c) => acc + c.quote, 0) / Math.min(5, allTicks.length || 1);
        won = tick.quote > avg;
        break;
      }
      case 'ASIAN_DOWN': {
        const avg = allTicks.slice(-5).reduce((acc, c) => acc + c.quote, 0) / Math.min(5, allTicks.length || 1);
        won = tick.quote < avg;
        break;
      }
      default:
        won = digit > predictionDigit;
    }

    const profit = won ? stakeToUse * (payoutMultiplier - 1) : -stakeToUse;
    this.balance = Number((this.balance + profit).toFixed(2));

    if (won) {
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
      this.currentStake = this.config.initialStake;
      this.currentStep = 0;
      soundManager.playWin();
    } else {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
      this.currentStep++;

      // Martingale logic with max steps
      if (this.currentStep < this.config.maxSteps) {
        this.currentStake = Number((stakeToUse * this.config.martingale).toFixed(2));
      } else {
        // Reset stake after max steps reached to protect capital
        this.currentStake = this.config.initialStake;
        this.currentStep = 0;
      }
      soundManager.playLoss();
    }

    // Update metrics
    const totalTrades = this.metrics.totalTrades + 1;
    const wins = this.metrics.wins + (won ? 1 : 0);
    const losses = this.metrics.losses + (won ? 0 : 1);
    const totalProfit = Number((this.metrics.totalProfit + profit).toFixed(2));
    const winRate = Number(((wins / totalTrades) * 100).toFixed(1));

    const peak = Math.max(this.metrics.peakBalance, this.balance);
    const currentDrawdown = peak > 0 ? Number((((peak - this.balance) / peak) * 100).toFixed(2)) : 0;
    const maxDrawdown = Math.max(this.metrics.maxDrawdown, currentDrawdown);

    this.metrics = {
      totalTrades,
      wins,
      losses,
      winRate,
      totalProfit,
      currentStreak: {
        type: won ? 'win' : 'loss',
        count: won ? this.consecutiveWins : this.consecutiveLosses,
      },
      maxDrawdown,
      peakBalance: peak,
    };

    const tradeRecord: Trade = {
      id: 'TRD-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      timestamp: tick.epoch,
      marketId: this.config.marketId || marketId,
      strategyName: this.config.name,
      contractType: tradeType,
      prediction: predictionText,
      stake: stakeToUse,
      entryPrice: tick.quote,
      exitPrice: tick.quote,
      exitDigit: digit,
      profit: Number(profit.toFixed(2)),
      status: won ? 'won' : 'lost',
      balanceAfter: this.balance,
      botSource: this.botSource,
    };

    this.trades.unshift(tradeRecord);
    if (this.trades.length > 200) {
      this.trades.pop();
    }

    this.onTradeListeners.forEach((l) => l(tradeRecord, this.metrics, this.balance));
  }
}
