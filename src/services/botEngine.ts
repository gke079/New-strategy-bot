import {
  BotMetrics,
  BotStrategyConfig,
  DigitStat,
  isContinuousDirectionalContract,
  RatioStats,
  Tick,
  Trade,
} from '../types';
import { soundManager } from './soundEffects';
import confetti from 'canvas-confetti';

interface PendingStrategyContract {
  entryTick: Tick;
  stake: number;
  duration: number;
  durationUnit: 't' | 's' | 'm';
  ticksRemaining: number;
  startTime: number;
  endTime?: number;
  hasSkipTick: boolean;
  skippedOnce: boolean;
  lastObservedQuote: number;
  allStrictUp: boolean;
  allStrictDown: boolean;
  observedQuotes: number[];
  predictionText: string;
  payoutMultiplier: number;
  tradeType: BotStrategyConfig['tradeType'];
  predictionDigit: number;
}

export class BotExecutor {
  private config: BotStrategyConfig;
  private currentStake: number;
  private currentStep: number = 0;
  private consecutiveLosses: number = 0;
  private consecutiveWins: number = 0;
  private sessionProfit: number = 0;
  private lastStopReason: string = '';
  private trades: Trade[] = [];
  private metrics: BotMetrics = {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    sessionProfit: 0,
    lastStopReason: '',
    currentStreak: { type: null, count: 0 },
    maxDrawdown: 0,
    peakBalance: 10000,
  };
  private balance: number = 10000;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private analysisTriggered: boolean = false;
  public readonly botSource: 'digits' | 'charts';
  private onTradeListeners: Set<(trade: Trade, metrics: BotMetrics, balance: number) => void> =
    new Set();
  private onStatusChangeListeners: Set<(isRunning: boolean, reason?: string) => void> = new Set();
  private onPauseChangeListeners: Set<(isPaused: boolean) => void> = new Set();
  private pendingContract: PendingStrategyContract | null = null;

  constructor(
    config: BotStrategyConfig,
    initialBalance: number = 10000,
    botSource: 'digits' | 'charts' = 'digits'
  ) {
    this.config = { ...config };
    this.currentStake = Math.max(0.35, Number(config.initialStake) || 0.35);
    const safeBalance = initialBalance > 0 ? initialBalance : 10000;
    this.balance = safeBalance;
    this.metrics.peakBalance = safeBalance;
    this.botSource = botSource;
  }

  public updateConfig(newConfig: Partial<BotStrategyConfig>) {
    // Risk management: stop bot if market changes before entry is found
    if (
      this.isRunning &&
      newConfig.marketId &&
      newConfig.marketId !== this.config.marketId &&
      !this.analysisTriggered
    ) {
      this.stop('Risk Management: Market changed before entry was found');
      return;
    }

    const analysisParamChanged =
      (newConfig.entryCondition !== undefined &&
        newConfig.entryCondition !== this.config.entryCondition) ||
      (newConfig.n !== undefined && newConfig.n !== this.config.n) ||
      (newConfig.xDigit !== undefined && newConfig.xDigit !== this.config.xDigit) ||
      (newConfig.pPercent !== undefined && newConfig.pPercent !== this.config.pPercent);

    const nextTradeType = newConfig.tradeType ?? this.config.tradeType;
    if (
      analysisParamChanged ||
      (newConfig.executionMode === 'reanalyse' && !isContinuousDirectionalContract(nextTradeType))
    ) {
      this.analysisTriggered = false;
    }

    this.config = {
      ...this.config,
      ...newConfig,
      ...(isContinuousDirectionalContract(nextTradeType) ? { executionMode: 'continuous' } : {}),
    };
    if (!this.isRunning) {
      this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
      this.currentStep = 0;
    }
  }

  public setBalance(newBalance: number) {
    if (newBalance <= 0 && !this.isRunning && this.metrics.totalTrades === 0) {
      return;
    }
    this.balance = newBalance;
    this.metrics.peakBalance = Math.max(this.metrics.peakBalance, newBalance);
  }

  public getBalance(): number {
    return this.balance;
  }

  public getMetrics(): BotMetrics {
    return {
      ...this.metrics,
      sessionProfit: this.sessionProfit,
      lastStopReason: this.lastStopReason,
    };
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

  public isWaitingForCondition(): boolean {
    return this.isRunning && !this.analysisTriggered;
  }

  public start() {
    if (this.balance <= 0 && this.metrics.totalTrades === 0) {
      this.balance = 10000;
      this.metrics.peakBalance = 10000;
    }
    this.isRunning = true;
    this.isPaused = false;
    this.analysisTriggered = false;
    this.pendingContract = null;
    this.sessionProfit = 0;
    this.lastStopReason = '';
    this.metrics = {
      ...this.metrics,
      sessionProfit: 0,
      lastStopReason: '',
    };
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
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
    this.lastStopReason = reason || '';
    this.metrics = {
      ...this.metrics,
      sessionProfit: this.sessionProfit,
      lastStopReason: this.lastStopReason,
    };
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
    this.sessionProfit = 0;
    this.lastStopReason = '';
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
    this.currentStep = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.metrics = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalProfit: 0,
      sessionProfit: 0,
      lastStopReason: '',
      currentStreak: { type: null, count: 0 },
      maxDrawdown: 0,
      peakBalance: this.balance,
    };
  }

  public resetTradeStake() {
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
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

  public onTrade(
    listener: (trade: Trade, metrics: BotMetrics, balance: number) => void
  ): () => void {
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

  private checkTpSlAndStop(): boolean {
    const tp = Number(this.config.takeProfit);
    const sl = Math.abs(Number(this.config.stopLoss));

    if (Number.isFinite(tp) && tp > 0 && this.sessionProfit >= tp - 1e-6) {
      this.stop(`Take Profit reached (+$${this.sessionProfit.toFixed(2)})`);
      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch {}
      return true;
    }

    if (Number.isFinite(sl) && sl > 0 && this.sessionProfit <= -(sl - 1e-6)) {
      this.stop(`Stop Loss reached (-$${Math.abs(this.sessionProfit).toFixed(2)})`);
      return true;
    }

    return false;
  }

  private getPayoutMultiplier(
    type: BotStrategyConfig['tradeType'],
    digit: number,
    durationTicks: number = 2
  ): number {
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
      case 'ONLY_DOWN': {
        const clamped = Math.min(5, Math.max(2, Math.round(durationTicks || 2)));
        const map: Record<number, number> = { 2: 3.85, 3: 7.8, 4: 15.6, 5: 31.2 };
        return map[clamped] ?? 3.85;
      }
      case 'RESET_CALL':
      case 'RESET_PUT':
        return 1.85;
      case 'HIGH_TICK':
      case 'LOW_TICK':
        return 4.2;
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

  private checkEntryCondition(
    recentTicks: Tick[],
    digitStats: DigitStat[],
    _ratioStats: RatioStats
  ): boolean {
    const n = Math.max(1, this.config.n);
    const x = this.config.xDigit;
    const p = this.config.pPercent;

    if (recentTicks.length < n) return false;
    const lastNDigits = recentTicks.slice(-n).map((t) => t.lastDigit);

    switch (this.config.entryCondition) {
      case 'under_x': {
        const allUnder = lastNDigits.every((d) => d < x);
        if (!allUnder) return false;
        if (p > 0) {
          const underCount = digitStats
            .filter((s) => s.digit < x)
            .reduce((acc, curr) => acc + curr.percentage, 0);
          if (underCount > p) return false;
        }
        return true;
      }

      case 'over_x': {
        const allOver = lastNDigits.every((d) => d > x);
        if (!allOver) return false;
        if (p > 0) {
          const overCount = digitStats
            .filter((s) => s.digit > x)
            .reduce((acc, curr) => acc + curr.percentage, 0);
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
        const minN = Math.max(2, this.config.n);
        if (recentTicks.length < minN + 1) return false;

        const lastIdx = recentTicks.length - 1;
        const lastTick = recentTicks[lastIdx];
        const isLastFalling = lastTick.direction === 'down' || lastTick.change < 0;
        if (!isLastFalling) return false;

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

  private formatPredictionText(tradeType: BotStrategyConfig['tradeType'], predictionDigit: number) {
    if (tradeType === 'UNDER') return `Under ${predictionDigit}`;
    if (tradeType === 'OVER') return `Over ${predictionDigit}`;
    if (tradeType === 'DIFFERS') return `Differs ${predictionDigit}`;
    if (tradeType === 'MATCHES') return `Matches ${predictionDigit}`;
    if (tradeType === 'HIGH_TICK') {
      return `High Tick #${Math.min(5, Math.max(1, Math.round(predictionDigit || 5)))}`;
    }
    if (tradeType === 'LOW_TICK') {
      return `Low Tick #${Math.min(5, Math.max(1, Math.round(predictionDigit || 5)))}`;
    }
    return tradeType.replace('_', ' ');
  }

  private openStrategyContract(entryTick: Tick): boolean {
    if (!this.isRunning || this.isPaused) return false;
    if (this.checkTpSlAndStop()) return false;

    const desiredStake = Math.max(
      0.35,
      Number((this.currentStake || this.config.initialStake || 0.35).toFixed(2))
    );
    if (this.balance < 0.35) {
      this.stop('Insufficient balance to place minimum stake ($0.35)');
      return false;
    }
    const stakeToUse = Number(Math.min(this.balance, desiredStake).toFixed(2));

    const tradeType = this.config.tradeType;
    const isOnlyUpDown = tradeType === 'ONLY_UP' || tradeType === 'ONLY_DOWN';
    const isHighLowTick = tradeType === 'HIGH_TICK' || tradeType === 'LOW_TICK';
    const isDirectional = isContinuousDirectionalContract(tradeType);
    const isFast = this.config.botSpeed === 'fast';
    const unit = isHighLowTick ? 't' : this.config.durationUnit || 't';
    const configuredDur = Math.max(1, Math.round(this.config.duration || 1));

    const duration = isOnlyUpDown
      ? Math.min(5, Math.max(2, configuredDur))
      : isHighLowTick
      ? 5
      : configuredDur;

    const predictionDigit = isHighLowTick
      ? Math.min(5, Math.max(1, Math.round(this.config.predictionDigit || 5)))
      : this.config.predictionDigit;

    const payoutMultiplier = this.getPayoutMultiplier(tradeType, predictionDigit, duration);
    const predictionText = this.formatPredictionText(tradeType, predictionDigit);
    const hasSkipTick = !isDirectional && !isFast && unit === 't' && duration === 1;
    const nowMs = Date.now();
    const durationSeconds = unit === 'm' ? duration * 60 : unit === 's' ? duration : 0;
    const endTime = durationSeconds > 0 ? nowMs + durationSeconds * 1000 : undefined;

    this.pendingContract = {
      entryTick,
      stake: stakeToUse,
      duration,
      durationUnit: unit,
      ticksRemaining: duration,
      startTime: nowMs,
      endTime,
      hasSkipTick,
      skippedOnce: false,
      lastObservedQuote: entryTick.quote,
      allStrictUp: true,
      allStrictDown: true,
      observedQuotes: [],
      predictionText,
      payoutMultiplier,
      tradeType,
      predictionDigit,
    };
    return true;
  }

  public evaluateTick(
    tick: Tick,
    allTicks: Tick[],
    digitStats: DigitStat[],
    ratioStats: RatioStats,
    marketId: string
  ) {
    if (!this.isRunning || this.isPaused) return;

    // Risk management: stop bot if market changed before entry was found
    if (marketId && marketId !== this.config.marketId && !this.analysisTriggered) {
      this.stop('Risk Management: Market changed before entry was found');
      return;
    }

    if (this.checkTpSlAndStop()) {
      return;
    }

    // 1. Advance active pending contract
    if (this.pendingContract) {
      const contract = this.pendingContract;
      const isOnlyUpDown = contract.tradeType === 'ONLY_UP' || contract.tradeType === 'ONLY_DOWN';
      const isHighLowTick =
        contract.tradeType === 'HIGH_TICK' || contract.tradeType === 'LOW_TICK';

      if (contract.durationUnit === 't') {
        if (contract.hasSkipTick && !contract.skippedOnce) {
          contract.skippedOnce = true;
          return;
        }

        if (isOnlyUpDown) {
          const prevQuote = contract.lastObservedQuote;
          if (tick.quote <= prevQuote) contract.allStrictUp = false;
          if (tick.quote >= prevQuote) contract.allStrictDown = false;
          contract.lastObservedQuote = tick.quote;
        } else if (isHighLowTick) {
          contract.observedQuotes.push(tick.quote);
          contract.lastObservedQuote = tick.quote;
        }

        contract.ticksRemaining -= 1;
        if (contract.ticksRemaining > 0) {
          return;
        }

        this.pendingContract = null;
        this.executeStrategyOutcome(tick, allTicks, contract, marketId);
        return;
      } else {
        const prevQuote = contract.lastObservedQuote;
        if (tick.quote <= prevQuote) contract.allStrictUp = false;
        if (tick.quote >= prevQuote) contract.allStrictDown = false;
        contract.lastObservedQuote = tick.quote;

        const nowMs = Date.now();
        const endTime =
          contract.endTime ||
          contract.startTime +
            contract.duration * (contract.durationUnit === 'm' ? 60000 : 1000);
        if (nowMs < endTime) {
          return;
        }

        this.pendingContract = null;
        this.executeStrategyOutcome(tick, allTicks, contract, marketId);
        return;
      }
    }

    // 2. Evaluate Entry Condition:
    // High/Low, Rise/Fall, and Only Up/Only Down ALWAYS run continuously once an entry is found.
    const isDirectionalContinuous = isContinuousDirectionalContract(this.config.tradeType);
    const isContinuous = isDirectionalContinuous || this.config.executionMode === 'continuous';

    if (!isContinuous || !this.analysisTriggered) {
      if (!this.checkEntryCondition(allTicks, digitStats, ratioStats)) {
        return;
      }
      if (isContinuous) {
        this.analysisTriggered = true;
      }
    }

    // Fast 1-tick digit mode resolves immediately if prior tick exists; multi-tick & directional contracts open at current tick and resolve across live incoming ticks
    const isFastImmediateDigit =
      this.config.botSpeed === 'fast' &&
      !isDirectionalContinuous &&
      (this.config.durationUnit || 't') === 't' &&
      Math.max(1, Math.round(this.config.duration || 1)) === 1;

    if (isFastImmediateDigit) {
      if (!this.openStrategyContract(allTicks.length > 1 ? allTicks[allTicks.length - 2] : tick)) {
        return;
      }
      const contract = this.pendingContract!;
      this.pendingContract = null;
      this.executeStrategyOutcome(tick, allTicks, contract, marketId);
      return;
    }

    this.openStrategyContract(tick);
  }

  private executeStrategyOutcome(
    tick: Tick,
    allTicks: Tick[],
    contract: PendingStrategyContract,
    marketId: string
  ) {
    const {
      entryTick,
      stake: stakeToUse,
      tradeType,
      predictionDigit,
      predictionText,
      payoutMultiplier,
    } = contract;
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
        won = tick.quote > prevQuote;
        break;
      case 'FALL':
      case 'LOWER':
        won = tick.quote < prevQuote;
        break;
      case 'ONLY_UP':
        won = contract.allStrictUp;
        break;
      case 'ONLY_DOWN':
        won = contract.allStrictDown;
        break;
      case 'RESET_CALL':
        won = tick.quote >= prevQuote;
        break;
      case 'RESET_PUT':
        won = tick.quote <= prevQuote;
        break;
      case 'HIGH_TICK': {
        const targetTick = Math.min(5, Math.max(1, Math.round(predictionDigit || 5)));
        const windowQuotes =
          contract.observedQuotes.length >= 5
            ? contract.observedQuotes.slice(0, 5)
            : allTicks.slice(-5).map((t) => t.quote);
        const chosenQuote = windowQuotes[targetTick - 1];
        won =
          chosenQuote !== undefined &&
          windowQuotes.length >= 5 &&
          windowQuotes.every((q, idx) => idx === targetTick - 1 || chosenQuote > q);
        break;
      }
      case 'LOW_TICK': {
        const targetTick = Math.min(5, Math.max(1, Math.round(predictionDigit || 5)));
        const windowQuotes =
          contract.observedQuotes.length >= 5
            ? contract.observedQuotes.slice(0, 5)
            : allTicks.slice(-5).map((t) => t.quote);
        const chosenQuote = windowQuotes[targetTick - 1];
        won =
          chosenQuote !== undefined &&
          windowQuotes.length >= 5 &&
          windowQuotes.every((q, idx) => idx === targetTick - 1 || chosenQuote < q);
        break;
      }
      case 'STAY_BETWEEN': {
        const diff = Math.abs(tick.quote - prevQuote);
        const threshold = Math.abs(prevQuote) * 0.00035;
        won = diff <= threshold;
        break;
      }
      case 'GOES_OUTSIDE': {
        const diff = Math.abs(tick.quote - prevQuote);
        const threshold = Math.abs(prevQuote) * 0.00035;
        won = diff > threshold;
        break;
      }
      case 'TOUCH':
        won = Math.abs(tick.quote - prevQuote) > 0;
        break;
      case 'NO_TOUCH':
        won = Math.abs(tick.quote - prevQuote) === 0;
        break;
      case 'ASIAN_UP': {
        const avg =
          allTicks.slice(-5).reduce((acc, c) => acc + c.quote, 0) /
          Math.min(5, allTicks.length || 1);
        won = tick.quote > avg;
        break;
      }
      case 'ASIAN_DOWN': {
        const avg =
          allTicks.slice(-5).reduce((acc, c) => acc + c.quote, 0) /
          Math.min(5, allTicks.length || 1);
        won = tick.quote < avg;
        break;
      }
      default:
        won = digit > predictionDigit;
    }

    const rawProfit = won ? stakeToUse * (payoutMultiplier - 1) : -stakeToUse;
    const profit = Number(rawProfit.toFixed(2));
    this.balance = Number((this.balance + profit).toFixed(2));
    const initialStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);

    if (won) {
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
      this.currentStake = initialStake;
      this.currentStep = 0;
      soundManager.playWin();
    } else {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
      this.currentStep++;

      const maxSteps = Math.max(1, Number(this.config.maxSteps) || 1);
      const mg = Math.max(1, Number(this.config.martingale) || 1.5);
      if (this.currentStep < maxSteps) {
        this.currentStake = Number((stakeToUse * mg).toFixed(2));
      } else {
        this.currentStake = initialStake;
        this.currentStep = 0;
      }
      soundManager.playLoss();
    }

    this.sessionProfit = Number((this.sessionProfit + profit).toFixed(2));
    const totalTrades = this.metrics.totalTrades + 1;
    const wins = this.metrics.wins + (won ? 1 : 0);
    const losses = this.metrics.losses + (won ? 0 : 1);
    const totalProfit = Number((this.metrics.totalProfit + profit).toFixed(2));
    const winRate = Number(((wins / totalTrades) * 100).toFixed(1));

    const peak = Math.max(this.metrics.peakBalance, this.balance);
    const currentDrawdown =
      peak > 0 ? Number((((peak - this.balance) / peak) * 100).toFixed(2)) : 0;
    const maxDrawdown = Math.max(this.metrics.maxDrawdown, currentDrawdown);

    this.metrics = {
      totalTrades,
      wins,
      losses,
      winRate,
      totalProfit,
      sessionProfit: this.sessionProfit,
      lastStopReason: this.lastStopReason,
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
      entryPrice: entryTick.quote,
      exitPrice: tick.quote,
      exitDigit: digit,
      profit,
      status: won ? 'won' : 'lost',
      balanceAfter: this.balance,
      botSource: this.botSource,
    };

    this.trades.unshift(tradeRecord);
    if (this.trades.length > 200) {
      this.trades.pop();
    }

    this.onTradeListeners.forEach((l) => l(tradeRecord, this.getMetrics(), this.balance));

    // Immediately enforce Session Take Profit & Stop Loss upon trade resolution
    if (this.checkTpSlAndStop()) {
      return;
    }

    // For High/Low, Rise/Fall, Only Up/Only Down (or continuous mode in Fast speed), chain the next contract immediately
    if (
      this.isRunning &&
      !this.isPaused &&
      (isContinuousDirectionalContract(this.config.tradeType) ||
        (this.config.executionMode === 'continuous' && this.config.botSpeed === 'fast'))
    ) {
      if (isContinuousDirectionalContract(this.config.tradeType)) {
        this.openStrategyContract(tick);
      }
    }
  }
}
