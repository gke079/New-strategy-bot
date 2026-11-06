import { BotMetrics, EntryBotConfig, Tick, Trade, TradeContractType } from '../types';
import { ActiveContract } from './normalBotEngine';
import { soundManager } from './soundEffects';
import confetti from 'canvas-confetti';

export interface EntryBotStateSnapshot {
  waitingForSearch: boolean;
  inRecovery: boolean;
  statusText: string;
}

export class EntryBotExecutor {
  private config: EntryBotConfig;
  private currentStake: number;
  private currentStep: number = 0;
  private consecutiveLosses: number = 0;
  private consecutiveWins: number = 0;
  private inRecovery: boolean = false;
  private waitingForSearch: boolean = true;
  private trades: Trade[] = [];
  private activeContract: ActiveContract | null = null;
  private metrics: BotMetrics = {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    sessionProfit: 0,
    currentStreak: { type: null, count: 0 },
    maxDrawdown: 0,
    peakBalance: 10000,
  };
  private sessionProfit: number = 0;
  private lastStopReason: string = '';
  private balance: number = 10000;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  private onTradeListeners: Set<(trade: Trade, metrics: BotMetrics, balance: number) => void> = new Set();
  private onStatusChangeListeners: Set<(isRunning: boolean, reason?: string) => void> = new Set();
  private onPauseChangeListeners: Set<(isPaused: boolean) => void> = new Set();
  private onContractProgressListeners: Set<(activeContract: ActiveContract | null) => void> = new Set();
  private onStateChangeListeners: Set<(state: EntryBotStateSnapshot) => void> = new Set();

  constructor(config: EntryBotConfig, initialBalance: number = 10000) {
    this.config = { ...config };
    this.currentStake = Math.max(0.35, Number(config.initialStake) || 0.35);
    const safeBalance = initialBalance > 0 ? initialBalance : 10000;
    this.balance = safeBalance;
    this.metrics.peakBalance = safeBalance;
  }

  public updateConfig(newConfig: Partial<EntryBotConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (!this.isRunning) {
      if (newConfig.initialStake !== undefined) {
        this.currentStake = Math.max(0.35, Number(newConfig.initialStake) || 0.35);
      }
      this.currentStep = 0;
      this.inRecovery = false;
    } else if (this.waitingForSearch && !this.activeContract) {
      this.notifyState(
        `Scanning live ticks for Search Number #${this.config.searchNumber} → ${this.config.contractType1} ${this.config.prediction1}`
      );
    }
  }

  public setBalance(newBalance: number) {
    if (newBalance <= 0 && this.isRunning) return;
    const safeBalance = newBalance > 0 ? newBalance : this.balance > 0 ? this.balance : 10000;
    this.balance = safeBalance;
    this.metrics.peakBalance = Math.max(this.metrics.peakBalance, safeBalance);
  }

  public getBalance(): number {
    return this.balance;
  }

  public getMetrics(): BotMetrics {
    return {
      ...this.metrics,
      sessionProfit: this.sessionProfit,
      lastStopReason: this.lastStopReason || undefined,
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

  public getActiveContract(): ActiveContract | null {
    return this.activeContract;
  }

  public getCurrentStake(): number {
    return this.currentStake;
  }

  public getCurrentStep(): number {
    return this.currentStep;
  }

  public getInRecovery(): boolean {
    return this.inRecovery;
  }

  public getWaitingForSearch(): boolean {
    return this.isRunning && this.waitingForSearch;
  }

  public start() {
    if (this.balance <= 0) {
      this.balance = 10000;
      this.metrics.peakBalance = Math.max(this.metrics.peakBalance, 10000);
    }
    this.isRunning = true;
    this.isPaused = false;
    this.activeContract = null;
    this.inRecovery = false;
    this.waitingForSearch = true;
    this.sessionProfit = 0;
    this.lastStopReason = '';
    this.metrics.sessionProfit = 0;
    this.metrics.lastStopReason = undefined;
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
    this.currentStep = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.notifyStatus(true);
    this.notifyPause(false);
    this.notifyContractProgress(null);
    this.notifyState(
      `Scanning live ticks for Search Number #${this.config.searchNumber} → ${this.config.contractType1} ${this.config.prediction1}`
    );
  }

  public pause() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.notifyPause(true);
  }

  public resume() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.notifyPause(false);
  }

  public stop(reason?: string) {
    this.isRunning = false;
    this.isPaused = false;
    this.activeContract = null;
    this.inRecovery = false;
    this.waitingForSearch = false;
    this.lastStopReason = reason || '';
    this.metrics.lastStopReason = this.lastStopReason || undefined;
    this.notifyStatus(false, reason);
    this.notifyPause(false);
    this.notifyContractProgress(null);
    this.notifyState('');
  }

  public resetStats() {
    this.trades = [];
    this.activeContract = null;
    this.inRecovery = false;
    this.waitingForSearch = this.isRunning;
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
      currentStreak: { type: null, count: 0 },
      maxDrawdown: 0,
      peakBalance: this.balance,
    };
    this.notifyContractProgress(null);
    if (this.isRunning) {
      this.notifyState(
        `Scanning live ticks for Search Number #${this.config.searchNumber} → ${this.config.contractType1} ${this.config.prediction1}`
      );
    } else {
      this.notifyState('');
    }
  }

  public resetTradeStake() {
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
    this.currentStep = 0;
    this.inRecovery = false;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
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

  public onContractProgress(listener: (activeContract: ActiveContract | null) => void): () => void {
    this.onContractProgressListeners.add(listener);
    return () => this.onContractProgressListeners.delete(listener);
  }

  public onStateChange(listener: (state: EntryBotStateSnapshot) => void): () => void {
    this.onStateChangeListeners.add(listener);
    return () => this.onStateChangeListeners.delete(listener);
  }

  private notifyStatus(running: boolean, reason?: string) {
    this.onStatusChangeListeners.forEach((l) => l(running, reason));
  }

  private notifyPause(paused: boolean) {
    this.onPauseChangeListeners.forEach((l) => l(paused));
  }

  private notifyContractProgress(contract: ActiveContract | null) {
    this.onContractProgressListeners.forEach((l) => l(contract));
  }

  private notifyState(statusText: string) {
    const snapshot: EntryBotStateSnapshot = {
      waitingForSearch: this.waitingForSearch,
      inRecovery: this.inRecovery,
      statusText,
    };
    this.onStateChangeListeners.forEach((l) => l(snapshot));
  }

  private checkTpSlAndStop(): boolean {
    const tp = Number(this.config.takeProfit);
    const sl = Math.abs(Number(this.config.stopLoss));
    if (tp > 0 && this.sessionProfit >= tp - 1e-6) {
      this.stop(`Take Profit reached (+$${this.sessionProfit.toFixed(2)})`);
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch {}
      return true;
    }
    if (sl > 0 && this.sessionProfit <= -(sl - 1e-6)) {
      this.stop(`Stop Loss reached (-$${Math.abs(this.sessionProfit).toFixed(2)})`);
      return true;
    }
    return false;
  }

  private getPayoutMultiplier(type: TradeContractType, prediction: number): number {
    const digitNum = Math.min(9, Math.max(0, Math.round(prediction)));
    switch (type) {
      case 'OVER': {
        const winningCount = Math.max(1, 9 - digitNum);
        return Number((9.5 / winningCount).toFixed(3));
      }
      case 'UNDER': {
        const winningCount = Math.max(1, digitNum);
        return Number((9.5 / winningCount).toFixed(3));
      }
      case 'DIFFERS':
        return 1.095;
      case 'MATCHES':
        return 9.0;
      default:
        return 1.95;
    }
  }

  public evaluateTick(tick: Tick, allTicks: Tick[], currentMarketId: string) {
    if (!this.isRunning || this.isPaused) return;

    if (this.checkTpSlAndStop()) return;

    // 1. Advance active contract if one is open
    if (this.activeContract) {
      const contract = this.activeContract;
      const unit = contract.durationUnit || 't';

      if (unit === 't') {
        if (contract.hasSkipTick && contract.stepState === 'entry') {
          contract.skippedTick = tick;
          contract.stepState = 'skipped';
          contract.ticksRemaining = Math.max(1, (contract.ticksRemaining ?? contract.duration) - 1);
          this.notifyContractProgress({ ...contract });
          return;
        }

        contract.ticksRemaining = (contract.ticksRemaining ?? contract.duration) - 1;
        contract.stepState = 'resolving';
        this.notifyContractProgress({ ...contract });

        if (contract.ticksRemaining <= 0) {
          this.resolveContract(tick, allTicks, currentMarketId);
        }
        return;
      } else {
        const nowMs = Date.now();
        const endTime =
          contract.endTime ||
          contract.startTime + contract.duration * (unit === 'm' ? 60000 : 1000);
        const msRemaining = Math.max(0, endTime - nowMs);
        contract.secondsRemaining = Math.ceil(msRemaining / 1000);
        this.notifyContractProgress({ ...contract });

        if (nowMs >= endTime) {
          this.resolveContract(tick, allTicks, currentMarketId);
        }
        return;
      }
    }

    // 2. If in Recovery (Prediction 1 failed), recover immediately with Prediction 2
    if (this.inRecovery) {
      this.waitingForSearch = false;
      this.notifyState(
        `Recovery Active (Prediction 2): ${this.config.contractType2} ${this.config.prediction2}`
      );
      this.openNewContract(tick);
      return;
    }

    // 3. Check Search Number trigger before starting Prediction 1 trade
    if (this.waitingForSearch) {
      if (tick.lastDigit !== this.config.searchNumber) {
        this.notifyState(
          `Waiting for Search Number #${this.config.searchNumber} (Current digit: ${tick.lastDigit})`
        );
        return;
      }
      // Search Number touched! Start trade immediately with Prediction 1
      this.waitingForSearch = false;
      this.notifyState(
        `Search Number #${this.config.searchNumber} touched! Executing Prediction 1 (${this.config.contractType1} ${this.config.prediction1})`
      );
    }

    this.openNewContract(tick);
  }

  private openNewContract(entryTick: Tick) {
    if (!this.isRunning || this.isPaused) return;
    if (this.checkTpSlAndStop()) return;

    if (this.balance <= 0 && this.metrics.totalTrades === 0) {
      this.balance = 10000;
      this.metrics.peakBalance = Math.max(this.metrics.peakBalance, 10000);
    }

    const desiredStake = Math.max(0.35, Number(this.currentStake || this.config.initialStake || 0.35));
    if (this.balance < 0.35) {
      this.stop('Insufficient balance to place stake');
      return;
    }
    const stakeToUse = Number(Math.min(this.balance, desiredStake).toFixed(2));

    const activeType: TradeContractType = this.inRecovery
      ? this.config.contractType2
      : this.config.contractType1;
    const activePrediction: number = this.inRecovery
      ? this.config.prediction2
      : this.config.prediction1;

    const isFast = this.config.botSpeed === 'fast';
    const unit = this.config.durationUnit || 't';
    const configuredTicks = Math.max(1, Math.round(this.config.duration || 1));
    const hasSkipTick = !isFast && unit === 't' && configuredTicks === 1;
    const duration = hasSkipTick ? 2 : configuredTicks;

    const nowMs = Date.now();
    const durationSeconds = unit === 'm' ? duration * 60 : unit === 's' ? duration : 0;
    const endTime = durationSeconds > 0 ? nowMs + durationSeconds * 1000 : undefined;

    this.activeContract = {
      id: 'ENT-' + Date.now().toString(36),
      entryTick,
      entryPrice: entryTick.quote,
      entryDigit: entryTick.lastDigit,
      prediction: activePrediction,
      contractType: activeType,
      stake: stakeToUse,
      duration,
      durationUnit: unit,
      ticksRemaining: unit === 't' ? duration : undefined,
      secondsRemaining: durationSeconds > 0 ? durationSeconds : undefined,
      startTime: nowMs,
      endTime,
      speedMode: isFast ? 'fast' : 'normal',
      stepState: 'entry',
      lastObservedQuote: entryTick.quote,
      hasSkipTick,
    };

    this.notifyContractProgress({ ...this.activeContract });
  }

  private resolveContract(exitTick: Tick, allTicks: Tick[], marketId: string) {
    if (!this.activeContract) return;
    const contract = this.activeContract;
    this.activeContract = null;
    this.notifyContractProgress(null);

    const predDigit =
      typeof contract.prediction === 'number'
        ? contract.prediction
        : parseInt(String(contract.prediction), 10) || 0;
    const exitDigit = exitTick.lastDigit;
    const wasRecovery = this.inRecovery;

    let won = false;
    switch (contract.contractType) {
      case 'OVER':
        won = exitDigit > predDigit;
        break;
      case 'UNDER':
        won = exitDigit < predDigit;
        break;
      case 'DIFFERS':
        won = exitDigit !== predDigit;
        break;
      case 'MATCHES':
        won = exitDigit === predDigit;
        break;
      default:
        won = exitDigit > predDigit;
    }

    const payoutMultiplier = this.getPayoutMultiplier(contract.contractType, predDigit);
    const profit = won ? contract.stake * (payoutMultiplier - 1) : -contract.stake;
    this.balance = Number((this.balance + profit).toFixed(2));
    this.sessionProfit = Number((this.sessionProfit + profit).toFixed(2));

    const typeLabel =
      contract.contractType.charAt(0) + contract.contractType.slice(1).toLowerCase();
    const predictionText = `${wasRecovery ? 'P2' : 'P1'}: ${typeLabel} ${predDigit}`;

    if (won) {
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
      this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
      this.currentStep = 0;
      this.inRecovery = false;
      this.waitingForSearch = this.config.entryTriggerMode !== 'once_continuous';
      soundManager.playWin();
    } else {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
      this.currentStep++;
      // Prediction 1 failed -> switch to Prediction 2 for recovery
      this.inRecovery = true;
      this.waitingForSearch = false;

      const maxSteps = Math.max(1, this.config.martingaleLevel || 1);
      if (this.currentStep < maxSteps) {
        this.currentStake = Number((contract.stake * this.config.martingale).toFixed(2));
      } else {
        this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
        this.currentStep = 0;
        this.inRecovery = false;
        this.waitingForSearch = this.config.entryTriggerMode !== 'once_continuous';
      }
      soundManager.playLoss();
    }

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
      currentStreak: {
        type: won ? 'win' : 'loss',
        count: won ? this.consecutiveWins : this.consecutiveLosses,
      },
      maxDrawdown,
      peakBalance: peak,
    };

    const tradeRecord: Trade = {
      id: 'TRD-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      timestamp: exitTick.epoch,
      marketId: this.config.marketId || marketId,
      strategyName: wasRecovery ? 'Entry Bot (P2 Recovery)' : 'Entry Bot (P1 Primary)',
      contractType: contract.contractType,
      prediction: predictionText,
      stake: contract.stake,
      entryPrice: contract.entryTick.quote,
      exitPrice: exitTick.quote,
      exitDigit,
      profit: Number(profit.toFixed(2)),
      status: won ? 'won' : 'lost',
      balanceAfter: this.balance,
      botSource: 'entry',
    };

    this.trades.unshift(tradeRecord);
    if (this.trades.length > 200) {
      this.trades.pop();
    }

    this.onTradeListeners.forEach((l) => l(tradeRecord, this.getMetrics(), this.balance));

    if (this.checkTpSlAndStop()) {
      return;
    }

    if (!this.isRunning || this.isPaused) return;

    if (this.inRecovery) {
      this.notifyState(
        `Recovering with Prediction 2: ${this.config.contractType2} ${this.config.prediction2} ($${this.currentStake.toFixed(2)})`
      );
      if (this.config.botSpeed === 'fast') {
        this.openNewContract(exitTick);
      }
    } else if (this.waitingForSearch) {
      this.notifyState(
        `Cycle complete · Waiting for Search Number #${this.config.searchNumber} to trigger Prediction 1`
      );
    } else if (this.config.botSpeed === 'fast') {
      this.openNewContract(exitTick);
    }
  }
}
