import { BotMetrics, DigitStat, EvenOddBotConfig, Tick, Trade } from '../types';
import { ActiveContract } from './normalBotEngine';
import { soundManager } from './soundEffects';
import confetti from 'canvas-confetti';

export interface EvenOddBotStateSnapshot {
  waitingForCondition: boolean;
  stageLabel: string;
  statusText: string;
}

export class EvenOddBotExecutor {
  private config: EvenOddBotConfig;
  private currentStake: number;
  private currentStep: number = 0;
  private consecutiveLosses: number = 0;
  private consecutiveWins: number = 0;
  private trades: Trade[] = [];
  private activeContract: ActiveContract | null = null;

  // Condition state machine for S1 and S2
  private conditionConfirmed: boolean = false;
  private s1OppositeStreak: number = 0;
  private s1ArmedForMost: boolean = false;
  private s2PrevWasLeast: boolean = false;

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
  private onStateChangeListeners: Set<(state: EvenOddBotStateSnapshot) => void> = new Set();

  constructor(config: EvenOddBotConfig, initialBalance: number = 10000) {
    this.config = { ...config };
    this.currentStake = Math.max(0.35, Number(config.initialStake) || 0.35);
    const safeBalance = initialBalance > 0 ? initialBalance : 10000;
    this.balance = safeBalance;
    this.metrics.peakBalance = safeBalance;
  }

  public updateConfig(newConfig: Partial<EvenOddBotConfig>) {
    // Risk management: stop bot if market changes before entry is found
    if (
      this.isRunning &&
      newConfig.marketId &&
      newConfig.marketId !== this.config.marketId &&
      !this.conditionConfirmed
    ) {
      this.stop('Risk Management: Market changed before entry was found');
      return;
    }

    const strategyChanged =
      (newConfig.strategy && newConfig.strategy !== this.config.strategy) ||
      (newConfig.marketSide && newConfig.marketSide !== this.config.marketSide) ||
      (newConfig.marketId && newConfig.marketId !== this.config.marketId);

    this.config = { ...this.config, ...newConfig };

    if (!this.isRunning) {
      if (newConfig.initialStake !== undefined) {
        this.currentStake = Math.max(0.35, Number(newConfig.initialStake) || 0.35);
      }
      this.currentStep = 0;
    } else if (strategyChanged && !this.activeContract) {
      this.resetConditionTracker();
      this.notifyState(true, 'Scanning', this.getInitialWaitMessage());
    }
  }

  private resetConditionTracker() {
    this.conditionConfirmed = false;
    this.s1OppositeStreak = 0;
    this.s1ArmedForMost = false;
    this.s2PrevWasLeast = false;
  }

  private getInitialWaitMessage(): string {
    const isEvenMarket = this.config.marketSide === 'EVEN';
    if (this.config.strategy === 'S1') {
      return isEvenMarket
        ? 'S1 (Even): Waiting for 2 consecutive Odd digits → then Highest % digit'
        : 'S1 (Odd): Waiting for 2 consecutive Even digits → then Highest % digit';
    }
    return isEvenMarket
      ? 'S2 (Even): Waiting for Least appearing digit → followed by 1 Odd digit'
      : 'S2 (Odd): Waiting for Least appearing digit → followed by 1 Even digit';
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

  public getWaitingForCondition(): boolean {
    return this.isRunning && !this.conditionConfirmed;
  }

  public start() {
    if (this.balance <= 0) {
      this.balance = 10000;
      this.metrics.peakBalance = Math.max(this.metrics.peakBalance, 10000);
    }
    this.isRunning = true;
    this.isPaused = false;
    this.activeContract = null;
    this.resetConditionTracker();
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
    this.notifyState(true, 'Stage 1', this.getInitialWaitMessage());
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
    this.resetConditionTracker();
    this.lastStopReason = reason || '';
    this.metrics.lastStopReason = this.lastStopReason || undefined;
    this.notifyStatus(false, reason);
    this.notifyPause(false);
    this.notifyContractProgress(null);
    this.notifyState(false, 'Idle', '');
  }

  public resetStats() {
    this.trades = [];
    this.activeContract = null;
    this.resetConditionTracker();
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
      this.notifyState(true, 'Stage 1', this.getInitialWaitMessage());
    } else {
      this.notifyState(false, 'Idle', '');
    }
  }

  public resetTradeStake() {
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
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

  public onPauseChange(listener: (isPaused: boolean) => void): () => void {
    this.onPauseChangeListeners.add(listener);
    return () => this.onPauseChangeListeners.delete(listener);
  }

  public onContractProgress(listener: (activeContract: ActiveContract | null) => void): () => void {
    this.onContractProgressListeners.add(listener);
    return () => this.onContractProgressListeners.delete(listener);
  }

  public onStateChange(listener: (state: EvenOddBotStateSnapshot) => void): () => void {
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

  private notifyState(waitingForCondition: boolean, stageLabel: string, statusText: string) {
    this.onStateChangeListeners.forEach((l) =>
      l({ waitingForCondition, stageLabel, statusText })
    );
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

  private resolveExtremaDigits(digitStats: DigitStat[]): { mostDigit: number; leastDigit: number } {
    if (!digitStats || digitStats.length === 0) {
      return { mostDigit: 0, leastDigit: 9 };
    }
    const mostByRank = digitStats.find((s) => s.rank === 'most');
    const leastByRank = digitStats.find((s) => s.rank === 'least');
    if (mostByRank && leastByRank) {
      return { mostDigit: mostByRank.digit, leastDigit: leastByRank.digit };
    }
    const sorted = [...digitStats].sort((a, b) => b.count - a.count);
    return {
      mostDigit: sorted[0]?.digit ?? 0,
      leastDigit: sorted[sorted.length - 1]?.digit ?? 9,
    };
  }

  public evaluateTick(
    tick: Tick,
    allTicks: Tick[],
    digitStats: DigitStat[],
    currentMarketId: string
  ) {
    if (!this.isRunning || this.isPaused) return;

    if (this.checkTpSlAndStop()) return;

    // 1. Advance open contract if active
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

    // 2. Evaluate Strategy Condition (S1 or S2) when not yet confirmed
    if (!this.conditionConfirmed) {
      // Risk management: stop bot if market changed before entry was found
      if (currentMarketId && currentMarketId !== this.config.marketId) {
        this.stop('Risk Management: Market changed before entry was found');
        return;
      }

      // Guard: No competing digit in terms of percentages on the opposite market
      const favSide = this.config.marketSide;
      const favDigits = favSide === 'EVEN' ? [0, 2, 4, 6, 8] : [1, 3, 5, 7, 9];
      const oppDigits = favSide === 'EVEN' ? [1, 3, 5, 7, 9] : [0, 2, 4, 6, 8];
      const favStats = (digitStats || []).filter((s) => favDigits.includes(s.digit));
      const oppStats = (digitStats || []).filter((s) => oppDigits.includes(s.digit));
      const maxFavPct = Math.max(...favStats.map((s) => s.percentage), 0);
      const maxOppPct = Math.max(...oppStats.map((s) => s.percentage), 0);

      const hasCompetingOpposite =
        maxOppPct >= maxFavPct ||
        oppStats.some((o) => o.percentage >= 10 && favStats.some((f) => f.percentage === o.percentage));

      if (hasCompetingOpposite) {
        this.notifyState(
          true,
          'Filtered',
          `Paused: Competing digit on opposite ${favSide === 'EVEN' ? 'Odd' : 'Even'} market (${maxOppPct.toFixed(1)}% vs ${maxFavPct.toFixed(1)}%) · Risk Guard Active`
        );
        return;
      }

      const { mostDigit, leastDigit } = this.resolveExtremaDigits(digitStats);
      const isEvenMarket = this.config.marketSide === 'EVEN';
      const isDigitEven = tick.lastDigit % 2 === 0;
      const isOppositeParity = isEvenMarket ? !isDigitEven : isDigitEven;
      const oppLabel = isEvenMarket ? 'Odd' : 'Even';

      if (this.config.strategy === 'S1') {
        // S1:
        // Even market: wait for 2 consecutive Odd digits -> then wait for Highest % digit -> trade EVEN immediately
        // Odd market: wait for 2 consecutive Even digits -> then wait for Highest % digit -> trade ODD immediately
        if (!this.s1ArmedForMost) {
          if (isOppositeParity) {
            this.s1OppositeStreak++;
          } else {
            this.s1OppositeStreak = 0;
          }

          if (this.s1OppositeStreak >= 2) {
            this.s1ArmedForMost = true;
            this.notifyState(
              true,
              'S1 Armed',
              `S1 Stage 2: 2 consecutive ${oppLabel} digits confirmed! Waiting for Highest % digit (#${mostDigit}) to start ${this.config.marketSide} trades...`
            );
          } else {
            this.notifyState(
              true,
              'S1 Stage 1',
              `S1 Stage 1: ${this.s1OppositeStreak}/2 consecutive ${oppLabel} digits (then Highest % digit #${mostDigit})`
            );
          }
          return;
        } else {
          // Stage 2: Armed after >=2 opposite-parity digits — waiting for Highest % digit to appear
          if (tick.lastDigit === mostDigit) {
            this.conditionConfirmed = true;
            this.s1ArmedForMost = false;
            this.s1OppositeStreak = 0;
            this.notifyState(
              false,
              'Trading',
              `S1 Triggered on Highest % digit #${mostDigit}! Executing ${this.config.marketSide} trades`
            );
            this.openNewContract(tick);
            return;
          } else {
            this.notifyState(
              true,
              'S1 Armed',
              `S1 Armed: Waiting for Highest % digit #${mostDigit} (Current tick digit: ${tick.lastDigit})`
            );
            return;
          }
        }
      } else {
        // S2:
        // Even market: Least appearing digit appears, followed immediately on next tick by 1 Odd digit -> trade EVEN immediately
        // Odd market: Least appearing digit appears, followed immediately on next tick by 1 Even digit -> trade ODD immediately
        if (this.s2PrevWasLeast) {
          if (isOppositeParity) {
            this.conditionConfirmed = true;
            this.s2PrevWasLeast = false;
            this.notifyState(
              false,
              'Trading',
              `S2 Triggered (Least digit #${leastDigit} → ${oppLabel} digit ${tick.lastDigit})! Trading ${this.config.marketSide} immediately`
            );
            this.openNewContract(tick);
            return;
          } else {
            // Next tick was not opposite parity; keep armed only if this tick itself is again the least digit
            this.s2PrevWasLeast = tick.lastDigit === leastDigit;
            this.notifyState(
              true,
              this.s2PrevWasLeast ? 'S2 Armed' : 'S2 Stage 1',
              this.s2PrevWasLeast
                ? `S2 Stage 2: Least digit #${leastDigit} appeared again · Next tick must be ${oppLabel} to trade ${this.config.marketSide}`
                : `S2 Reset (digit ${tick.lastDigit} was not ${oppLabel}) · Waiting for Least digit #${leastDigit} → 1 ${oppLabel}`
            );
            return;
          }
        } else {
          if (tick.lastDigit === leastDigit) {
            this.s2PrevWasLeast = true;
            this.notifyState(
              true,
              'S2 Armed',
              `S2 Stage 2: Least appearing digit #${leastDigit} spotted! Waiting for next tick to be 1 ${oppLabel} digit...`
            );
          } else {
            this.notifyState(
              true,
              'S2 Stage 1',
              `S2 Stage 1: Waiting for Least appearing digit #${leastDigit} → followed by 1 ${oppLabel} digit`
            );
          }
          return;
        }
      }
    }

    // 3. Condition already confirmed: place next contract
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

    const isFast = this.config.botSpeed === 'fast';
    const unit = this.config.durationUnit || 't';
    const configuredTicks = Math.max(1, Math.round(this.config.duration || 1));
    const hasSkipTick = !isFast && unit === 't' && configuredTicks === 1;
    const duration = hasSkipTick ? 2 : configuredTicks;

    const nowMs = Date.now();
    const durationSeconds = unit === 'm' ? duration * 60 : unit === 's' ? duration : 0;
    const endTime = durationSeconds > 0 ? nowMs + durationSeconds * 1000 : undefined;

    this.activeContract = {
      id: 'EO-' + Date.now().toString(36),
      entryTick,
      entryPrice: entryTick.quote,
      entryDigit: entryTick.lastDigit,
      prediction: this.config.marketSide,
      contractType: this.config.marketSide,
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

    const exitDigit = exitTick.lastDigit;
    const won =
      contract.contractType === 'EVEN' ? exitDigit % 2 === 0 : exitDigit % 2 !== 0;
    const payoutMultiplier = 1.95;
    const profit = won ? contract.stake * (payoutMultiplier - 1) : -contract.stake;
    this.balance = Number((this.balance + profit).toFixed(2));
    this.sessionProfit = Number((this.sessionProfit + profit).toFixed(2));

    if (won) {
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
      this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
      this.currentStep = 0;
      if (this.config.executionMode === 'per_trade') {
        this.resetConditionTracker();
      }
      soundManager.playWin();
    } else {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
      this.currentStep++;

      const maxSteps = Math.max(1, this.config.martingaleLevel || 1);
      if (this.currentStep < maxSteps) {
        this.currentStake = Number((contract.stake * this.config.martingale).toFixed(2));
      } else {
        this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
        this.currentStep = 0;
        if (this.config.executionMode === 'per_trade') {
          this.resetConditionTracker();
        }
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
      strategyName: `EvenOdd Bot (${this.config.strategy} · ${this.config.marketSide})`,
      contractType: contract.contractType,
      prediction: `${this.config.strategy} ${contract.contractType}`,
      stake: contract.stake,
      entryPrice: contract.entryTick.quote,
      exitPrice: exitTick.quote,
      exitDigit,
      profit: Number(profit.toFixed(2)),
      status: won ? 'won' : 'lost',
      balanceAfter: this.balance,
      botSource: 'evenodd',
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

    if (!this.conditionConfirmed) {
      this.notifyState(true, 'Stage 1', this.getInitialWaitMessage());
    } else if (this.config.botSpeed === 'fast') {
      this.openNewContract(exitTick);
    }
  }
}
