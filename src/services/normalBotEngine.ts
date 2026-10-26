import { BotMetrics, NormalBotConfig, Tick, Trade, TradeContractType } from '../types';
import { soundManager } from './soundEffects';
import confetti from 'canvas-confetti';

export interface ActiveContract {
  id: string;
  entryTick: Tick;
  entryPrice: number;
  entryDigit: number;
  prediction: number | string;
  contractType: TradeContractType;
  stake: number;
  duration: number;
  durationUnit: 't' | 's' | 'm';
  ticksRemaining?: number;
  secondsRemaining?: number;
  startTime: number;
  endTime?: number;
  speedMode?: 'normal' | 'fast';
  skippedTick?: Tick;
  stepState?: 'entry' | 'skipped' | 'resolving';
}

export class NormalBotExecutor {
  private config: NormalBotConfig;
  private currentStake: number;
  private currentStep: number = 0; // Current martingale step (0 to martingaleLevel)
  private consecutiveLosses: number = 0;
  private consecutiveWins: number = 0;
  private trades: Trade[] = [];
  private activeContract: ActiveContract | null = null;
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
  private onTradeListeners: Set<(trade: Trade, metrics: BotMetrics, balance: number) => void> = new Set();
  private onStatusChangeListeners: Set<(isRunning: boolean, reason?: string) => void> = new Set();
  private onPauseChangeListeners: Set<(isPaused: boolean) => void> = new Set();
  private onContractProgressListeners: Set<(activeContract: ActiveContract | null) => void> = new Set();

  private botSource: Trade['botSource'] = 'normal';

  constructor(
    config: NormalBotConfig,
    initialBalance: number = 10000,
    botSource: Trade['botSource'] = 'normal'
  ) {
    this.config = { ...config };
    this.currentStake = config.initialStake;
    this.balance = initialBalance;
    this.metrics.peakBalance = initialBalance;
    this.botSource = botSource;
  }

  public updateConfig(newConfig: Partial<NormalBotConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (!this.isRunning) {
      if (newConfig.initialStake !== undefined) {
        this.currentStake = newConfig.initialStake;
      }
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

  public getActiveContract(): ActiveContract | null {
    return this.activeContract;
  }

  public getCurrentStake(): number {
    return this.currentStake;
  }

  public getCurrentStep(): number {
    return this.currentStep;
  }

  public start() {
    this.isRunning = true;
    this.isPaused = false;
    this.activeContract = null;
    this.currentStake = this.config.initialStake;
    this.currentStep = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.notifyStatus(true);
    this.notifyPause(false);
    this.notifyContractProgress(null);
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

  public togglePause(): boolean {
    if (!this.isRunning) return false;
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
    return this.isPaused;
  }

  public stop(reason?: string) {
    this.isRunning = false;
    this.isPaused = false;
    this.activeContract = null;
    this.notifyStatus(false, reason);
    this.notifyPause(false);
    this.notifyContractProgress(null);
  }

  public resetStats() {
    this.trades = [];
    this.activeContract = null;
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
    this.notifyContractProgress(null);
  }

  public resetTradeStake() {
    this.currentStake = this.config.initialStake;
    this.currentStep = 0;
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

  public onContractProgress(listener: (activeContract: ActiveContract | null) => void): () => void {
    this.onContractProgressListeners.add(listener);
    return () => this.onContractProgressListeners.delete(listener);
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

  private notifyContractProgress(contract: ActiveContract | null) {
    this.onContractProgressListeners.forEach((l) => l(contract));
  }

  // Payout multiplier based on contract type & prediction
  private getPayoutMultiplier(type: TradeContractType, prediction: number | string): number {
    const digitNum = typeof prediction === 'number' ? prediction : parseInt(String(prediction), 10) || 5;
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
      case 'EVEN':
      case 'ODD':
      case 'RISE':
      case 'FALL':
      case 'HIGHER':
      case 'LOWER':
        return 1.95;
      case 'ONLY_UP':
      case 'ONLY_DOWN':
        return 3.85;
      default:
        return 1.95;
    }
  }

  /**
   * Checks whether an optional Signal entry confirmation sequence is satisfied on allTicks:
   * - 'even_after_2_odd_confirm': >= 2 consecutive Odd digits immediately followed by 1 Even digit confirmation
   * - 'odd_after_2_even_confirm': >= 2 consecutive Even digits immediately followed by 1 Odd digit confirmation
   */
  public isEntryTriggerMet(allTicks: Tick[]): boolean {
    const trigger = this.config.signalEntryTrigger;
    if (!trigger || trigger === 'immediate') return true;
    if (allTicks.length < 3) return false;

    const lastIdx = allTicks.length - 1;
    const confirmDigit = allTicks[lastIdx].lastDigit;

    if (trigger === 'even_after_2_odd_confirm') {
      if (confirmDigit % 2 !== 0) return false; // Latest tick must be Even confirmation
      let oddStreak = 0;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (allTicks[i].lastDigit % 2 !== 0) oddStreak++;
        else break;
      }
      return oddStreak >= 2;
    }

    if (trigger === 'odd_after_2_even_confirm') {
      if (confirmDigit % 2 === 0) return false; // Latest tick must be Odd confirmation
      let evenStreak = 0;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (allTicks[i].lastDigit % 2 === 0) evenStreak++;
        else break;
      }
      return evenStreak >= 2;
    }

    return true;
  }

  // Evaluates every incoming tick
  public evaluateTick(tick: Tick, allTicks: Tick[], currentMarketId: string) {
    if (!this.isRunning || this.isPaused) return;

    // Check Take Profit or Stop Loss
    if (this.metrics.totalProfit >= this.config.takeProfit) {
      this.stop(`Take Profit reached (+${this.metrics.totalProfit.toFixed(2)}$)`);
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch {}
      return;
    }

    if (this.metrics.totalProfit <= -Math.abs(this.config.stopLoss)) {
      this.stop(`Stop Loss reached (${this.metrics.totalProfit.toFixed(2)}$)`);
      return;
    }

    // 1. If an active contract is running, advance it
    if (this.activeContract) {
      const contract = this.activeContract;
      const unit = contract.durationUnit || 't';

      if (unit === 't') {
        const isNormalSpeed = (contract.speedMode || this.config.botSpeed || 'normal') === 'normal';

        // In Normal Mode: Entry was registered on previous tick.
        // If ticksRemaining is 2, THIS tick is the SKIPPED tick!
        if (isNormalSpeed && (contract.ticksRemaining ?? contract.duration) === 2) {
          contract.skippedTick = tick;
          contract.stepState = 'skipped';
          contract.ticksRemaining = 1;
          this.notifyContractProgress({ ...contract });
          return; // Skip this tick! The next tick will be the exit tick.
        }

        // Advance to exit
        contract.ticksRemaining = (contract.ticksRemaining ?? contract.duration) - 1;
        contract.stepState = 'resolving';
        this.notifyContractProgress({ ...contract });

        // If contract has reached 0 remaining ticks, resolve it
        if (contract.ticksRemaining <= 0) {
          this.resolveContract(tick, allTicks, currentMarketId);
        }
        return;
      } else {
        // Time-based: seconds or minutes
        const nowMs = Date.now();
        const endTime = contract.endTime || (contract.startTime + contract.duration * (unit === 'm' ? 60000 : 1000));
        const msRemaining = Math.max(0, endTime - nowMs);
        contract.secondsRemaining = Math.ceil(msRemaining / 1000);
        this.notifyContractProgress({ ...contract });

        if (nowMs >= endTime) {
          this.resolveContract(tick, allTicks, currentMarketId);
        }
        return;
      }
    }

    // 2. No active contract => place a new contract once entry trigger (if any) is met
    if (!this.isEntryTriggerMet(allTicks)) {
      return;
    }
    this.openNewContract(tick);
  }

  // Opens a new contract
  private openNewContract(entryTick: Tick) {
    if (!this.isRunning || this.isPaused) return;

    if (this.metrics.totalProfit >= this.config.takeProfit) {
      this.stop(`Take Profit reached (+${this.metrics.totalProfit.toFixed(2)}$)`);
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch {}
      return;
    }
    if (this.metrics.totalProfit <= -Math.abs(this.config.stopLoss)) {
      this.stop(`Stop Loss reached (${this.metrics.totalProfit.toFixed(2)}$)`);
      return;
    }

    const stakeToUse = Math.min(this.balance, Math.max(0.35, this.currentStake));
    if (this.balance < stakeToUse) {
      this.stop('Insufficient balance to place stake');
      return;
    }

    const isFast = this.config.botSpeed === 'fast';
    const unit = this.config.durationUnit || 't';
    // Fast mode: 1 tick duration (trade every tick).
    // Normal mode: 2 ticks duration (1 tick skip, then 1 tick exit).
    const duration = isFast
      ? Math.max(1, Math.round(this.config.duration || 1))
      : (unit === 't' && (!this.config.duration || this.config.duration === 1) ? 2 : Math.max(1, Math.round(this.config.duration || 1)));

    const nowMs = Date.now();
    const durationSeconds = unit === 'm' ? duration * 60 : unit === 's' ? duration : 0;
    const endTime = durationSeconds > 0 ? nowMs + durationSeconds * 1000 : undefined;

    this.activeContract = {
      id: 'CTR-' + Date.now().toString(36),
      entryTick,
      entryPrice: entryTick.quote,
      entryDigit: entryTick.lastDigit,
      prediction: this.config.prediction,
      contractType: this.config.contractType,
      stake: stakeToUse,
      duration,
      durationUnit: unit,
      ticksRemaining: unit === 't' ? duration : undefined,
      secondsRemaining: durationSeconds > 0 ? durationSeconds : undefined,
      startTime: nowMs,
      endTime,
      speedMode: isFast ? 'fast' : 'normal',
      stepState: 'entry',
    };
    this.notifyContractProgress({ ...this.activeContract });
  }

  // Resolves multi-tick contract upon reaching final tick
  private resolveContract(exitTick: Tick, _allTicks: Tick[], marketId: string) {
    if (!this.activeContract) return;
    const contract = this.activeContract;
    this.activeContract = null;
    this.notifyContractProgress(null);

    const won = this.checkWinCondition(
      contract.contractType,
      contract.prediction,
      contract.entryTick,
      exitTick
    );
    this.finalizeTrade(won, contract.stake, contract.entryTick, exitTick, marketId);

    // In Fast mode, immediately open the next contract using exitTick as entry if trigger is met
    if (
      this.isRunning &&
      !this.isPaused &&
      this.config.botSpeed === 'fast' &&
      this.isEntryTriggerMet(_allTicks)
    ) {
      this.openNewContract(exitTick);
    }
  }

  private checkWinCondition(
    contractType: TradeContractType,
    prediction: number | string,
    entryTick: Tick,
    exitTick: Tick
  ): boolean {
    const digit = exitTick.lastDigit;
    const predDigit = typeof prediction === 'number' ? prediction : parseInt(String(prediction), 10) || 0;

    switch (contractType) {
      case 'OVER':
        return digit > predDigit;
      case 'UNDER':
        return digit < predDigit;
      case 'DIFFERS':
        return digit !== predDigit;
      case 'MATCHES':
        return digit === predDigit;
      case 'EVEN':
        return digit % 2 === 0;
      case 'ODD':
        return digit % 2 !== 0;
      case 'RISE':
      case 'HIGHER':
        return exitTick.quote > entryTick.quote;
      case 'FALL':
      case 'LOWER':
        return exitTick.quote < entryTick.quote;
      case 'ONLY_UP':
        return exitTick.quote > entryTick.quote;
      case 'ONLY_DOWN':
        return exitTick.quote < entryTick.quote;
      default:
        return digit > predDigit;
    }
  }

  private finalizeTrade(
    won: boolean,
    stakeUsed: number,
    entryTick: Tick,
    exitTick: Tick,
    marketId: string
  ) {
    const { contractType, prediction } = this.config;
    const payoutMultiplier = this.getPayoutMultiplier(contractType, prediction);
    const profit = won ? stakeUsed * (payoutMultiplier - 1) : -stakeUsed;
    this.balance = Number((this.balance + profit).toFixed(2));

    let predictionText: string;
    const digitTypes = ['OVER', 'UNDER', 'DIFFERS', 'MATCHES'];
    if (digitTypes.includes(contractType)) {
      predictionText = `${contractType} ${prediction}`;
    } else {
      predictionText = `${contractType} (${prediction})`;
    }

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

      // Martingale logic with martingale level
      const maxSteps = Math.max(1, this.config.martingaleLevel || 1);
      if (this.currentStep < maxSteps) {
        this.currentStake = Number((stakeUsed * this.config.martingale).toFixed(2));
      } else {
        // Reached max martingale level, reset stake to protect balance
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
      timestamp: exitTick.epoch,
      marketId: this.config.marketId || marketId,
      strategyName: this.config.name || 'Normal Bot',
      contractType,
      prediction: predictionText,
      stake: stakeUsed,
      entryPrice: entryTick.quote,
      exitPrice: exitTick.quote,
      exitDigit: exitTick.lastDigit,
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
