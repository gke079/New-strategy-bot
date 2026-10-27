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
  lastObservedQuote?: number;
  allStrictUp?: boolean;
  allStrictDown?: boolean;
  observedQuotes?: number[];
  hasSkipTick?: boolean;
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
  private hasInitialEntryConfirmed: boolean = false;
  private postStartTicks: Tick[] = [];
  private onTradeListeners: Set<(trade: Trade, metrics: BotMetrics, balance: number) => void> = new Set();
  private onStatusChangeListeners: Set<(isRunning: boolean, reason?: string) => void> = new Set();
  private onPauseChangeListeners: Set<(isPaused: boolean) => void> = new Set();
  private onContractProgressListeners: Set<(activeContract: ActiveContract | null) => void> = new Set();
  private onEntryWaitListeners: Set<(waiting: boolean, statusText: string) => void> = new Set();

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
    this.postStartTicks = [];
    const effectiveTrigger = this.getEffectiveEntryTrigger();
    this.hasInitialEntryConfirmed = effectiveTrigger === 'immediate';
    this.currentStake = this.config.initialStake;
    this.currentStep = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.notifyStatus(true);
    this.notifyPause(false);
    this.notifyContractProgress(null);
    if (!this.hasInitialEntryConfirmed) {
      this.notifyEntryWait(true, this.describeEntryWaitStatus([]));
    } else {
      this.notifyEntryWait(false, '');
    }
  }

  public isWaitingForInitialEntry(): boolean {
    return this.isRunning && !this.hasInitialEntryConfirmed;
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
    this.hasInitialEntryConfirmed = false;
    this.postStartTicks = [];
    this.activeContract = null;
    this.notifyStatus(false, reason);
    this.notifyPause(false);
    this.notifyContractProgress(null);
    this.notifyEntryWait(false, '');
  }

  public resetStats() {
    this.trades = [];
    this.activeContract = null;
    this.postStartTicks = [];
    this.hasInitialEntryConfirmed = this.getEffectiveEntryTrigger() === 'immediate';
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

  public onEntryWaitChange(
    listener: (waiting: boolean, statusText: string) => void
  ): () => void {
    this.onEntryWaitListeners.add(listener);
    return () => this.onEntryWaitListeners.delete(listener);
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

  private notifyEntryWait(waiting: boolean, statusText: string) {
    this.onEntryWaitListeners.forEach((l) => l(waiting, statusText));
  }

  // Payout multiplier based on contract type, prediction & tick duration
  private getPayoutMultiplier(
    type: TradeContractType,
    prediction: number | string,
    durationTicks: number = 2
  ): number {
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
      case 'ONLY_DOWN': {
        const clamped = Math.min(5, Math.max(2, Math.round(durationTicks || 2)));
        const map: Record<number, number> = { 2: 3.85, 3: 7.8, 4: 15.6, 5: 31.2 };
        return map[clamped] ?? 3.85;
      }
      case 'HIGH_TICK':
      case 'LOW_TICK':
        return 4.2;
      default:
        return 1.95;
    }
  }

  private getEffectiveEntryTrigger() {
    const trigger = this.config.signalEntryTrigger;
    if (!trigger || trigger === 'immediate') return 'immediate' as const;

    if (this.config.contractType === 'EVEN' && trigger === 'even_after_2_odd_confirm') {
      return trigger;
    }
    if (this.config.contractType === 'ODD' && trigger === 'odd_after_2_even_confirm') {
      return trigger;
    }
    if (this.config.contractType === 'OVER' && trigger === 'over_after_3_opp_confirm') {
      return trigger;
    }
    if (this.config.contractType === 'UNDER' && trigger === 'under_after_3_opp_confirm') {
      return trigger;
    }
    if (this.config.contractType === 'ONLY_UP' && trigger === 'only_up_after_down_confirm') {
      return trigger;
    }
    if (this.config.contractType === 'ONLY_DOWN' && trigger === 'only_down_after_up_confirm') {
      return trigger;
    }
    if (this.config.contractType === 'HIGH_TICK' && trigger === 'high_tick_3_rising_confirm') {
      return trigger;
    }
    if (this.config.contractType === 'LOW_TICK' && trigger === 'low_tick_3_falling_confirm') {
      return trigger;
    }
    return 'immediate' as const;
  }

  private get5mCandleSecondsRemaining(epochOrMs?: number): number {
    const raw =
      typeof epochOrMs === 'number' && epochOrMs > 1e8
        ? epochOrMs > 1e11
          ? Math.floor(epochOrMs / 1000)
          : Math.floor(epochOrMs)
        : Math.floor(Date.now() / 1000);
    return Math.max(1, 300 - (raw % 300));
  }

  private getTickStepDirection(ticks: Tick[], idx: number): 'up' | 'down' | 'flat' {
    if (idx > 0) {
      if (ticks[idx].quote > ticks[idx - 1].quote) return 'up';
      if (ticks[idx].quote < ticks[idx - 1].quote) return 'down';
      return 'flat';
    }
    return ticks[idx]?.direction ?? 'flat';
  }

  /**
   * Checks whether an optional Signal entry confirmation sequence is satisfied on allTicks:
   * - 'even_after_2_odd_confirm': >= 2 consecutive Odd digits immediately followed by 1 Even digit confirmation
   * - 'odd_after_2_even_confirm': >= 2 consecutive Even digits immediately followed by 1 Odd digit confirmation
   * - 'under_after_3_opp_confirm': >= 3 consecutive opposite digits (>= barrier) followed by 1 winning digit (< barrier)
   * - 'over_after_3_opp_confirm': >= 3 consecutive opposite digits (<= barrier) followed by 1 winning digit (> barrier)
   */
  public isEntryTriggerMet(allTicks: Tick[]): boolean {
    const trigger = this.getEffectiveEntryTrigger();
    if (trigger === 'immediate') return true;

    const lastIdx = allTicks.length - 1;
    if (lastIdx < 0) return false;
    const confirmDigit = allTicks[lastIdx].lastDigit;

    if (trigger === 'even_after_2_odd_confirm') {
      if (allTicks.length < 3 || confirmDigit % 2 !== 0) return false;
      let oddStreak = 0;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (allTicks[i].lastDigit % 2 !== 0) oddStreak++;
        else break;
      }
      return oddStreak >= 2;
    }

    if (trigger === 'odd_after_2_even_confirm') {
      if (allTicks.length < 3 || confirmDigit % 2 === 0) return false;
      let evenStreak = 0;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (allTicks[i].lastDigit % 2 === 0) evenStreak++;
        else break;
      }
      return evenStreak >= 2;
    }

    if (trigger === 'under_after_3_opp_confirm') {
      if (allTicks.length < 4) return false;
      const barrier =
        typeof this.config.prediction === 'number'
          ? this.config.prediction
          : parseInt(String(this.config.prediction), 10) || 5;
      if (confirmDigit >= barrier) return false; // Latest tick must be on winning side (< barrier)
      let oppStreak = 0;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (allTicks[i].lastDigit >= barrier) oppStreak++;
        else break;
      }
      return oppStreak >= 3;
    }

    if (trigger === 'over_after_3_opp_confirm') {
      if (allTicks.length < 4) return false;
      const barrier =
        typeof this.config.prediction === 'number'
          ? this.config.prediction
          : parseInt(String(this.config.prediction), 10) || 4;
      if (confirmDigit <= barrier) return false; // Latest tick must be on winning side (> barrier)
      let oppStreak = 0;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (allTicks[i].lastDigit <= barrier) oppStreak++;
        else break;
      }
      return oppStreak >= 3;
    }

    if (trigger === 'only_up_after_down_confirm') {
      if (allTicks.length < 3 || this.getTickStepDirection(allTicks, lastIdx) !== 'up') {
        return false;
      }
      let downStreak = 0;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (this.getTickStepDirection(allTicks, i) === 'down') downStreak++;
        else break;
      }
      return downStreak >= 2;
    }

    if (trigger === 'only_down_after_up_confirm') {
      if (allTicks.length < 3 || this.getTickStepDirection(allTicks, lastIdx) !== 'down') {
        return false;
      }
      let upStreak = 0;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (this.getTickStepDirection(allTicks, i) === 'up') upStreak++;
        else break;
      }
      return upStreak >= 2;
    }

    if (trigger === 'high_tick_3_rising_confirm') {
      if (allTicks.length < 3) return false;
      let riseStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(allTicks, i) === 'up') riseStreak++;
        else break;
      }
      return riseStreak >= 3;
    }

    if (trigger === 'low_tick_3_falling_confirm') {
      if (allTicks.length < 3) return false;
      let fallStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(allTicks, i) === 'down') fallStreak++;
        else break;
      }
      return fallStreak >= 3;
    }

    return true;
  }

  public describeEntryWaitStatus(ticks: Tick[]): string {
    const trigger = this.getEffectiveEntryTrigger();
    if (trigger === 'immediate') return '';

    const lastIdx = ticks.length - 1;

    if (trigger === 'even_after_2_odd_confirm') {
      let oddStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (ticks[i].lastDigit % 2 !== 0) oddStreak++;
        else break;
      }
      if (oddStreak >= 2) {
        return `Entry armed (${oddStreak}x Odd) · Next Even starts trades`;
      }
      return `Waiting entry: ${oddStreak}/2 Odd → 1 Even confirm`;
    }

    if (trigger === 'odd_after_2_even_confirm') {
      let evenStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (ticks[i].lastDigit % 2 === 0) evenStreak++;
        else break;
      }
      if (evenStreak >= 2) {
        return `Entry armed (${evenStreak}x Even) · Next Odd starts trades`;
      }
      return `Waiting entry: ${evenStreak}/2 Even → 1 Odd confirm`;
    }

    if (trigger === 'under_after_3_opp_confirm') {
      const barrier =
        typeof this.config.prediction === 'number'
          ? this.config.prediction
          : parseInt(String(this.config.prediction), 10) || 5;
      let oppStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (ticks[i].lastDigit >= barrier) oppStreak++;
        else break;
      }
      if (oppStreak >= 3) {
        return `Entry armed (${oppStreak}x ≥${barrier}) · Next <${barrier} starts trades`;
      }
      return `Waiting entry: ${oppStreak}/3 (≥${barrier}) → 1 (<${barrier}) confirm`;
    }

    if (trigger === 'over_after_3_opp_confirm') {
      const barrier =
        typeof this.config.prediction === 'number'
          ? this.config.prediction
          : parseInt(String(this.config.prediction), 10) || 4;
      let oppStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (ticks[i].lastDigit <= barrier) oppStreak++;
        else break;
      }
      if (oppStreak >= 3) {
        return `Entry armed (${oppStreak}x ≤${barrier}) · Next >${barrier} starts trades`;
      }
      return `Waiting entry: ${oppStreak}/3 (≤${barrier}) → 1 (>${barrier}) confirm`;
    }

    if (trigger === 'only_up_after_down_confirm') {
      let fallStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'down') fallStreak++;
        else break;
      }
      if (fallStreak >= 2) {
        return `Entry armed (${fallStreak}x Fall ▼) · Next Rise ▲ starts trades`;
      }
      return `Waiting entry: ${fallStreak}/2 Fall ▼ → 1 Rise ▲`;
    }

    if (trigger === 'only_down_after_up_confirm') {
      let riseStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'up') riseStreak++;
        else break;
      }
      if (riseStreak >= 2) {
        return `Entry armed (${riseStreak}x Rise ▲) · Next Fall ▼ starts trades`;
      }
      return `Waiting entry: ${riseStreak}/2 Rise ▲ → 1 Fall ▼`;
    }

    if (trigger === 'high_tick_3_rising_confirm') {
      let riseStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'up') riseStreak++;
        else break;
      }
      return `Waiting entry: ${Math.min(3, riseStreak)}/3 consecutive Rise ▲ ticks`;
    }

    if (trigger === 'low_tick_3_falling_confirm') {
      let fallStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'down') fallStreak++;
        else break;
      }
      return `Waiting entry: ${Math.min(3, fallStreak)}/3 consecutive Fall ▼ ticks`;
    }

    return 'Waiting for entry confirmation...';
  }

  // Evaluates every incoming tick
  public evaluateTick(tick: Tick, allTicks: Tick[], currentMarketId: string) {
    if (!this.isRunning || this.isPaused) return;

    this.postStartTicks = [...this.postStartTicks.slice(-49), tick];

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
        const isOnlyUpDown =
          contract.contractType === 'ONLY_UP' || contract.contractType === 'ONLY_DOWN';
        const isHighLowTick =
          contract.contractType === 'HIGH_TICK' || contract.contractType === 'LOW_TICK';

        if (isOnlyUpDown) {
          const prevQuote = contract.lastObservedQuote ?? contract.entryPrice;
          if (tick.quote <= prevQuote) contract.allStrictUp = false;
          if (tick.quote >= prevQuote) contract.allStrictDown = false;
          contract.lastObservedQuote = tick.quote;
          contract.ticksRemaining = (contract.ticksRemaining ?? contract.duration) - 1;
          contract.stepState = 'resolving';
          this.notifyContractProgress({ ...contract });

          if (contract.ticksRemaining <= 0) {
            this.resolveContract(tick, allTicks, currentMarketId);
          }
          return;
        }

        if (isHighLowTick) {
          contract.observedQuotes = [...(contract.observedQuotes ?? []), tick.quote];
          contract.lastObservedQuote = tick.quote;
          contract.ticksRemaining = (contract.ticksRemaining ?? contract.duration) - 1;
          contract.stepState = 'resolving';
          this.notifyContractProgress({ ...contract });

          if (contract.ticksRemaining <= 0) {
            this.resolveContract(tick, allTicks, currentMarketId);
          }
          return;
        }

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
        const prevQuote = contract.lastObservedQuote ?? contract.entryPrice;
        if (tick.quote <= prevQuote) contract.allStrictUp = false;
        if (tick.quote >= prevQuote) contract.allStrictDown = false;
        contract.lastObservedQuote = tick.quote;

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

    const isHighLowTickContract =
      this.config.contractType === 'HIGH_TICK' || this.config.contractType === 'LOW_TICK';

    // Strict 5-minute candle close guard for High Tick / Low Tick:
    // No trade is placed when <= 10 seconds remain in the 5-minute candle.
    if (isHighLowTickContract) {
      const candle5mSecsLeft = this.get5mCandleSecondsRemaining(tick.epoch);
      if (candle5mSecsLeft <= 10) {
        this.notifyEntryWait(
          true,
          `No trade · 5m candle closing (${candle5mSecsLeft}s left ≤ 10s)`
        );
        return;
      }
    }

    // 2. Wait for entry confirmation on live ticks;
    if (!this.hasInitialEntryConfirmed) {
      if (!this.isEntryTriggerMet(this.postStartTicks)) {
        this.notifyEntryWait(true, this.describeEntryWaitStatus(this.postStartTicks));
        return;
      }
      this.hasInitialEntryConfirmed = true;
      this.notifyEntryWait(false, '');
    } else if (isHighLowTickContract) {
      this.notifyEntryWait(false, '');
    }
    this.openNewContract(tick, allTicks);
  }

  // Opens a new contract
  private openNewContract(entryTick: Tick, allTicks: Tick[] = []) {
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

    if (this.config.contractType === 'HIGH_TICK' || this.config.contractType === 'LOW_TICK') {
      const candle5mSecsLeft = this.get5mCandleSecondsRemaining(entryTick.epoch);
      if (candle5mSecsLeft <= 10) {
        this.notifyEntryWait(
          true,
          `No trade · 5m candle closing (${candle5mSecsLeft}s left ≤ 10s)`
        );
        return;
      }
    }

    const stakeToUse = Math.min(this.balance, Math.max(0.35, this.currentStake));
    if (this.balance < stakeToUse) {
      this.stop('Insufficient balance to place stake');
      return;
    }

    const isFast = this.config.botSpeed === 'fast';
    const unit = this.config.durationUnit || 't';
    const isOnlyUpDown =
      this.config.contractType === 'ONLY_UP' || this.config.contractType === 'ONLY_DOWN';
    const isHighLowTick =
      this.config.contractType === 'HIGH_TICK' || this.config.contractType === 'LOW_TICK';
    const configuredTicks = Math.max(1, Math.round(this.config.duration || 1));
    // Only Up / Only Down requires 2-5 consecutive ticks; High Tick / Low Tick is strictly 5 ticks.
    // For 1-tick digit contracts in Normal mode, preserve the 1-tick skip -> 1-tick exit cadence (total 2 ticks).
    const hasSkipTick =
      !isOnlyUpDown && !isHighLowTick && !isFast && unit === 't' && configuredTicks === 1;
    const duration = isOnlyUpDown
      ? Math.min(5, Math.max(2, configuredTicks))
      : isHighLowTick
      ? 5
      : hasSkipTick
      ? 2
      : configuredTicks;

    const nowMs = Date.now();
    const durationSeconds = unit === 'm' ? duration * 60 : unit === 's' ? duration : 0;
    const endTime = durationSeconds > 0 ? nowMs + durationSeconds * 1000 : undefined;

    this.activeContract = {
      id: 'CTR-' + Date.now().toString(36),
      entryTick,
      entryPrice: entryTick.quote,
      entryDigit: entryTick.lastDigit,
      prediction: isHighLowTick
        ? Math.min(5, Math.max(1, Math.round(Number(this.config.prediction) || 5)))
        : this.config.prediction,
      contractType: this.config.contractType,
      stake: stakeToUse,
      duration,
      durationUnit: isHighLowTick ? 't' : unit,
      ticksRemaining: isHighLowTick || unit === 't' ? duration : undefined,
      secondsRemaining: !isHighLowTick && durationSeconds > 0 ? durationSeconds : undefined,
      startTime: nowMs,
      endTime: isHighLowTick ? undefined : endTime,
      speedMode: isFast ? 'fast' : 'normal',
      stepState: 'entry',
      lastObservedQuote: entryTick.quote,
      allStrictUp: true,
      allStrictDown: true,
      observedQuotes: isHighLowTick ? [] : undefined,
      hasSkipTick,
    };
    this.notifyContractProgress({ ...this.activeContract });
  }

  // Resolves multi-tick contract upon reaching final tick
  private resolveContract(exitTick: Tick, allTicks: Tick[], marketId: string) {
    if (!this.activeContract) return;
    const contract = this.activeContract;
    this.activeContract = null;
    this.notifyContractProgress(null);

    let won: boolean;
    if (contract.contractType === 'ONLY_UP') {
      won = Boolean(contract.allStrictUp);
    } else if (contract.contractType === 'ONLY_DOWN') {
      won = Boolean(contract.allStrictDown);
    } else if (
      contract.contractType === 'HIGH_TICK' ||
      contract.contractType === 'LOW_TICK'
    ) {
      const targetTick = Math.min(5, Math.max(1, Math.round(Number(contract.prediction) || 5)));
      const windowQuotes =
        contract.observedQuotes && contract.observedQuotes.length >= 5
          ? contract.observedQuotes.slice(0, 5)
          : allTicks.slice(-5).map((t) => t.quote);
      const chosenQuote = windowQuotes[targetTick - 1];
      if (chosenQuote === undefined || windowQuotes.length < 5) {
        won = false;
      } else if (contract.contractType === 'HIGH_TICK') {
        won = windowQuotes.every((q, idx) => idx === targetTick - 1 || chosenQuote > q);
      } else {
        won = windowQuotes.every((q, idx) => idx === targetTick - 1 || chosenQuote < q);
      }
    } else {
      won = this.checkWinCondition(
        contract.contractType,
        contract.prediction,
        contract.entryTick,
        exitTick
      );
    }

    const resolvedPredictionLabel =
      contract.contractType === 'HIGH_TICK' || contract.contractType === 'LOW_TICK'
        ? Math.min(5, Math.max(1, Math.round(Number(contract.prediction) || 5)))
        : contract.prediction;

    this.finalizeTrade(
      won,
      contract.stake,
      contract.entryTick,
      exitTick,
      marketId,
      contract.contractType,
      resolvedPredictionLabel,
      contract.duration
    );

    if (!this.isRunning || this.isPaused) return;

    // Once initial entry point is confirmed, trades execute continuously (with <=10s 5m candle close guard)
    if (this.config.botSpeed === 'fast') {
      this.openNewContract(exitTick, allTicks);
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
      case 'FALL':
      case 'HIGHER':
      case 'LOWER':
      case 'ONLY_UP':
      case 'ONLY_DOWN':
      case 'HIGH_TICK':
      case 'LOW_TICK':
        return contractType === 'RISE' ||
          contractType === 'HIGHER' ||
          contractType === 'ONLY_UP' ||
          contractType === 'HIGH_TICK'
          ? exitTick.quote > entryTick.quote
          : exitTick.quote < entryTick.quote;
      default:
        return digit > predDigit;
    }
  }

  private finalizeTrade(
    won: boolean,
    stakeUsed: number,
    entryTick: Tick,
    exitTick: Tick,
    marketId: string,
    executedContractType?: TradeContractType,
    executedPrediction?: number | string,
    executedDurationTicks?: number
  ) {
    const contractType = executedContractType ?? this.config.contractType;
    const prediction = executedPrediction ?? this.config.prediction;
    const payoutMultiplier = this.getPayoutMultiplier(
      contractType,
      prediction,
      executedDurationTicks ?? this.config.duration
    );
    const profit = won ? stakeUsed * (payoutMultiplier - 1) : -stakeUsed;
    this.balance = Number((this.balance + profit).toFixed(2));

    let predictionText: string;
    if (contractType === 'UNDER') {
      predictionText = `Under ${prediction}`;
    } else if (contractType === 'OVER') {
      predictionText = `Over ${prediction}`;
    } else if (contractType === 'DIFFERS') {
      predictionText = `Differs ${prediction}`;
    } else if (contractType === 'MATCHES') {
      predictionText = `Matches ${prediction}`;
    } else if (contractType === 'ONLY_UP') {
      predictionText = 'Only Up';
    } else if (contractType === 'ONLY_DOWN') {
      predictionText = 'Only Down';
    } else if (contractType === 'HIGH_TICK') {
      predictionText = `High Tick #${prediction}`;
    } else if (contractType === 'LOW_TICK') {
      predictionText = `Low Tick #${prediction}`;
    } else {
      predictionText = `${contractType}`;
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

    if (this.metrics.totalProfit >= this.config.takeProfit) {
      this.stop(`Take Profit reached (+${this.metrics.totalProfit.toFixed(2)}$)`);
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch {}
      return;
    }
    if (this.metrics.totalProfit <= -Math.abs(this.config.stopLoss)) {
      this.stop(`Stop Loss reached (${this.metrics.totalProfit.toFixed(2)}$)`);
    }
  }
}
