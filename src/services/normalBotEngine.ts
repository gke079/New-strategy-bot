import {
  BotMetrics,
  isContinuousDirectionalContract,
  NormalBotConfig,
  Tick,
  Trade,
  TradeContractType,
} from '../types';
import { soundManager } from './soundEffects';
import confetti from 'canvas-confetti';
import { getMarketCandle1mSecondsLeft, formatTradingViewCountdown } from './signalScannerEngine';

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
  private sessionProfit: number = 0;
  private lastStopReason: string = '';
  private trades: Trade[] = [];
  private activeContract: ActiveContract | null = null;
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
  private hasInitialEntryConfirmed: boolean = false;
  private postStartTicks: Tick[] = [];
  private onTradeListeners: Set<(trade: Trade, metrics: BotMetrics, balance: number) => void> =
    new Set();
  private onStatusChangeListeners: Set<(isRunning: boolean, reason?: string) => void> = new Set();
  private onPauseChangeListeners: Set<(isPaused: boolean) => void> = new Set();
  private onContractProgressListeners: Set<(activeContract: ActiveContract | null) => void> =
    new Set();
  private onEntryWaitListeners: Set<(waiting: boolean, statusText: string) => void> = new Set();

  private botSource: Trade['botSource'] = 'normal';

  constructor(
    config: NormalBotConfig,
    initialBalance: number = 10000,
    botSource: Trade['botSource'] = 'normal'
  ) {
    this.config = { ...config };
    this.currentStake = Math.max(0.35, Number(config.initialStake) || 0.35);
    const safeBalance = initialBalance > 0 ? initialBalance : 10000;
    this.balance = safeBalance;
    this.metrics.peakBalance = safeBalance;
    this.botSource = botSource;
  }

  public updateConfig(newConfig: Partial<NormalBotConfig>) {
    // Risk management: stop bot if market changes before initial entry is found
    if (
      this.isRunning &&
      newConfig.marketId &&
      newConfig.marketId !== this.config.marketId &&
      this.isWaitingForInitialEntry()
    ) {
      this.stop('Risk Management: Market changed before initial entry was found');
      return;
    }

    this.config = { ...this.config, ...newConfig };
    if (!this.isRunning) {
      if (newConfig.initialStake !== undefined) {
        this.currentStake = Math.max(0.35, Number(newConfig.initialStake) || 0.35);
      }
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
    if (this.balance <= 0 && this.metrics.totalTrades === 0) {
      this.balance = 10000;
      this.metrics.peakBalance = 10000;
    }
    this.isRunning = true;
    this.isPaused = false;
    this.activeContract = null;
    this.postStartTicks = [];
    this.sessionProfit = 0;
    this.lastStopReason = '';
    this.metrics = {
      ...this.metrics,
      sessionProfit: 0,
      lastStopReason: '',
    };
    const effectiveTrigger = this.getEffectiveEntryTrigger();
    this.hasInitialEntryConfirmed = effectiveTrigger === 'immediate';
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
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
    this.lastStopReason = reason || '';
    this.metrics = {
      ...this.metrics,
      sessionProfit: this.sessionProfit,
      lastStopReason: this.lastStopReason,
    };
    this.notifyStatus(false, reason);
    this.notifyPause(false);
    this.notifyContractProgress(null);
    this.notifyEntryWait(false, '');
  }

  public resetStats() {
    this.trades = [];
    this.activeContract = null;
    this.postStartTicks = [];
    this.sessionProfit = 0;
    this.lastStopReason = '';
    this.hasInitialEntryConfirmed = this.getEffectiveEntryTrigger() === 'immediate';
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
    this.notifyContractProgress(null);
  }

  public resetTradeStake() {
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
    this.currentStep = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
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

  public onContractProgress(
    listener: (activeContract: ActiveContract | null) => void
  ): () => void {
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

  private checkTpSlAndStop(): boolean {
    const tp = Number(this.config.takeProfit);
    const sl = Math.abs(Number(this.config.stopLoss));

    if (Number.isFinite(tp) && tp > 0 && this.sessionProfit >= tp - 1e-6) {
      this.stop(`Take Profit reached (+$${this.sessionProfit.toFixed(2)})`);
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch {}
      return true;
    }

    if (Number.isFinite(sl) && sl > 0 && this.sessionProfit <= -(sl - 1e-6)) {
      this.stop(`Stop Loss reached (-$${Math.abs(this.sessionProfit).toFixed(2)})`);
      return true;
    }

    return false;
  }

  // Payout multiplier based on contract type, prediction & tick duration
  private getPayoutMultiplier(
    type: TradeContractType,
    prediction: number | string,
    durationTicks: number = 2
  ): number {
    const digitNum =
      typeof prediction === 'number' ? prediction : parseInt(String(prediction), 10) || 5;
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

    if (trigger === 's1_blue_digit_confirm') return trigger;
    if (trigger === 's2_two_opposite_confirm') return trigger;
    if (trigger === 's3_red_then_opposite_confirm') return trigger;

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
    if (
      this.config.contractType === 'ONLY_UP' &&
      (trigger === 'only_up_after_down_confirm' ||
        trigger === 'only_up_ema_rsi_pullback' ||
        trigger === 'only_up_macd_candle_10s')
    ) {
      return trigger;
    }
    if (
      this.config.contractType === 'ONLY_DOWN' &&
      (trigger === 'only_down_after_up_confirm' || trigger === 'only_down_ema_rsi_pullback')
    ) {
      return trigger;
    }
    if (this.config.contractType === 'HIGH_TICK' && trigger === 'high_tick_3_rising_confirm') {
      return trigger;
    }
    if (this.config.contractType === 'LOW_TICK' && trigger === 'low_tick_3_falling_confirm') {
      return trigger;
    }
    if (
      (this.config.contractType === 'RISE' || this.config.contractType === 'HIGHER') &&
      (trigger === 'rise_after_fall_confirm' || trigger === 'high_tick_3_rising_confirm')
    ) {
      return trigger;
    }
    if (
      (this.config.contractType === 'FALL' || this.config.contractType === 'LOWER') &&
      (trigger === 'fall_after_rise_confirm' || trigger === 'low_tick_3_falling_confirm')
    ) {
      return trigger;
    }
    return 'immediate' as const;
  }

  private getTickStepDirection(ticks: Tick[], idx: number): 'up' | 'down' | 'flat' {
    if (idx > 0) {
      if (ticks[idx].quote > ticks[idx - 1].quote) return 'up';
      if (ticks[idx].quote < ticks[idx - 1].quote) return 'down';
      return 'flat';
    }
    return ticks[idx]?.direction ?? 'flat';
  }

  public isEntryTriggerMet(allTicks: Tick[]): boolean {
    const trigger = this.getEffectiveEntryTrigger();
    if (trigger === 'immediate') return true;

    const lastIdx = allTicks.length - 1;
    if (lastIdx < 0) return false;
    const confirmDigit = allTicks[lastIdx].lastDigit;

    if (trigger === 's1_blue_digit_confirm') {
      const targetDigit =
        this.config.entryTargetDigit ??
        (typeof this.config.prediction === 'number' ? this.config.prediction : 0);
      return confirmDigit === targetDigit;
    }

    if (trigger === 's2_two_opposite_confirm') {
      if (allTicks.length < 2) return false;
      const isEven = this.config.contractType === 'EVEN';
      const d1 = allTicks[lastIdx].lastDigit;
      const d2 = allTicks[lastIdx - 1].lastDigit;
      return isEven ? d1 % 2 !== 0 && d2 % 2 !== 0 : d1 % 2 === 0 && d2 % 2 === 0;
    }

    if (trigger === 's3_red_then_opposite_confirm') {
      if (allTicks.length < 2) return false;
      const isEven = this.config.contractType === 'EVEN';
      const redDigit =
        this.config.entryTargetDigit ??
        (typeof this.config.prediction === 'number' ? this.config.prediction : 0);
      const prevDigit = allTicks[lastIdx - 1].lastDigit;
      const currDigit = allTicks[lastIdx].lastDigit;
      return isEven
        ? prevDigit === redDigit && currDigit % 2 !== 0
        : prevDigit === redDigit && currDigit % 2 === 0;
    }

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
      if (confirmDigit >= barrier) return false;
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
      if (confirmDigit <= barrier) return false;
      let oppStreak = 0;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (allTicks[i].lastDigit <= barrier) oppStreak++;
        else break;
      }
      return oppStreak >= 3;
    }

    if (
      trigger === 'only_up_ema_rsi_pullback' ||
      trigger === 'only_up_after_down_confirm' ||
      trigger === 'rise_after_fall_confirm'
    ) {
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

    if (
      trigger === 'only_down_ema_rsi_pullback' ||
      trigger === 'only_down_after_up_confirm' ||
      trigger === 'fall_after_rise_confirm'
    ) {
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

    if (trigger === 'only_up_macd_candle_10s') {
      const secondsLeft = getMarketCandle1mSecondsLeft(this.config.marketId);
      return secondsLeft <= 10;
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

    if (trigger === 's1_blue_digit_confirm') {
      const targetDigit =
        this.config.entryTargetDigit ??
        (typeof this.config.prediction === 'number' ? this.config.prediction : 0);
      const lastDigit = ticks[lastIdx]?.lastDigit;
      if (lastDigit === targetDigit) {
        return `Entry armed! Blue bar digit (${targetDigit}) appeared · Executing now`;
      }
      return `Waiting for Blue bar digit (${targetDigit}) to appear (Last: ${lastDigit ?? '—'})`;
    }

    if (trigger === 's2_two_opposite_confirm') {
      const isEven = this.config.contractType === 'EVEN';
      const oppLabel = isEven ? 'Odd' : 'Even';
      let oppStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        const isOpp = isEven ? ticks[i].lastDigit % 2 !== 0 : ticks[i].lastDigit % 2 === 0;
        if (isOpp) oppStreak++;
        else break;
      }
      if (oppStreak >= 2) {
        return `Entry armed (${oppStreak}x ${oppLabel} digits) · Entering trade now`;
      }
      return `Waiting for 2 consecutive ${oppLabel} digits (${oppStreak}/2)`;
    }

    if (trigger === 's3_red_then_opposite_confirm') {
      const isEven = this.config.contractType === 'EVEN';
      const redDigit =
        this.config.entryTargetDigit ??
        (typeof this.config.prediction === 'number' ? this.config.prediction : 0);
      const oppLabel = isEven ? 'Odd' : 'Even';
      const currDigit = ticks[lastIdx]?.lastDigit;
      const prevDigit = ticks[lastIdx - 1]?.lastDigit;
      if (prevDigit === redDigit && (isEven ? currDigit % 2 !== 0 : currDigit % 2 === 0)) {
        return `Entry armed! Red bar (${redDigit}) → ${currDigit} (${oppLabel}) · Entering trade now`;
      }
      if (currDigit === redDigit) {
        return `Red bar digit (${redDigit}) appeared! Waiting for next ${oppLabel} digit to confirm`;
      }
      return `Waiting for Red bar digit (${redDigit}) followed by an ${oppLabel} digit`;
    }

    if (trigger === 'even_after_2_odd_confirm') {
      let oddStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (ticks[i].lastDigit % 2 !== 0) oddStreak++;
        else break;
      }
      if (oddStreak >= 2) {
        return `Entry armed (${oddStreak}x Odd) · Next Even starts continuous trades`;
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
        return `Entry armed (${evenStreak}x Even) · Next Odd starts continuous trades`;
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
        return `Entry armed (${oppStreak}x ≥${barrier}) · Next <${barrier} starts continuous trades`;
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
        return `Entry armed (${oppStreak}x ≤${barrier}) · Next >${barrier} starts continuous trades`;
      }
      return `Waiting entry: ${oppStreak}/3 (≤${barrier}) → 1 (>${barrier}) confirm`;
    }

    if (trigger === 'only_up_ema_rsi_pullback') {
      let fallStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'down') fallStreak++;
        else break;
      }
      if (fallStreak >= 2) {
        return `Pullback armed (${fallStreak}x Fall ▼) · Next Rise ▲ executes Only Up`;
      }
      return `Waiting entry: ${fallStreak}/2 Downward Pullback → Rise ▲ confirm`;
    }

    if (trigger === 'only_down_ema_rsi_pullback') {
      let riseStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'up') riseStreak++;
        else break;
      }
      if (riseStreak >= 2) {
        return `Pullback armed (${riseStreak}x Rise ▲) · Next Fall ▼ executes Only Down`;
      }
      return `Waiting entry: ${riseStreak}/2 Upward Pullback → Fall ▼ confirm`;
    }

    if (trigger === 'only_up_after_down_confirm' || trigger === 'rise_after_fall_confirm') {
      let fallStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'down') fallStreak++;
        else break;
      }
      if (fallStreak >= 2) {
        return `Entry armed (${fallStreak}x Fall ▼) · Next Rise ▲ starts continuous trades`;
      }
      return `Waiting entry: ${fallStreak}/2 Fall ▼ → 1 Rise ▲ → Continuous`;
    }

    if (trigger === 'only_down_after_up_confirm' || trigger === 'fall_after_rise_confirm') {
      let riseStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'up') riseStreak++;
        else break;
      }
      if (riseStreak >= 2) {
        return `Entry armed (${riseStreak}x Rise ▲) · Next Fall ▼ starts continuous trades`;
      }
      return `Waiting entry: ${riseStreak}/2 Rise ▲ → 1 Fall ▼ → Continuous`;
    }

    if (trigger === 'high_tick_3_rising_confirm') {
      let riseStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'up') riseStreak++;
        else break;
      }
      return `Waiting entry: ${Math.min(3, riseStreak)}/3 consecutive Rise ▲ ticks → Continuous`;
    }

    if (trigger === 'low_tick_3_falling_confirm') {
      let fallStreak = 0;
      for (let i = lastIdx; i >= 0; i--) {
        if (this.getTickStepDirection(ticks, i) === 'down') fallStreak++;
        else break;
      }
      return `Waiting entry: ${Math.min(3, fallStreak)}/3 consecutive Fall ▼ ticks → Continuous`;
    }

    if (trigger === 'only_up_macd_candle_10s') {
      const secondsLeft = getMarketCandle1mSecondsLeft(this.config.marketId);
      const countdown = formatTradingViewCountdown(secondsLeft);
      if (secondsLeft <= 10) {
        return `TradingView candle close: ${countdown} (${secondsLeft}s left) · Triggering Only Up trade now!`;
      }
      return `Waiting entry: TradingView candle close ${countdown} (triggers at ≤00:10)`;
    }

    return 'Waiting for entry confirmation...';
  }

  // Evaluates every incoming tick
  public evaluateTick(tick: Tick, allTicks: Tick[], currentMarketId: string) {
    if (!this.isRunning || this.isPaused) return;

    // Risk management: stop bot if market changed before entry was found
    if (
      currentMarketId &&
      currentMarketId !== this.config.marketId &&
      this.isWaitingForInitialEntry()
    ) {
      this.stop('Risk Management: Market changed before initial entry was found');
      return;
    }

    this.postStartTicks = [...this.postStartTicks.slice(-49), tick];

    // Check Session Take Profit or Stop Loss
    if (this.checkTpSlAndStop()) {
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

    // 2. Wait once for entry confirmation on live ticks; once entry is found, run continuously without interruption
    if (!this.hasInitialEntryConfirmed) {
      if (!this.isEntryTriggerMet(this.postStartTicks)) {
        this.notifyEntryWait(true, this.describeEntryWaitStatus(this.postStartTicks));
        return;
      }
      this.hasInitialEntryConfirmed = true;
      this.notifyEntryWait(false, '');
    }

    this.openNewContract(tick, allTicks);
  }

  // Opens a new contract
  private openNewContract(entryTick: Tick, _allTicks: Tick[] = []) {
    if (!this.isRunning || this.isPaused) return;

    if (this.checkTpSlAndStop()) {
      return;
    }

    const desiredStake = Math.max(
      0.35,
      Number((this.currentStake || this.config.initialStake || 0.35).toFixed(2))
    );
    if (this.balance < 0.35) {
      this.stop('Insufficient balance to place minimum stake ($0.35)');
      return;
    }
    const stakeToUse = Number(Math.min(this.balance, desiredStake).toFixed(2));

    const isFast = this.config.botSpeed === 'fast';
    const unit = this.config.durationUnit || 't';
    const isOnlyUpDown =
      this.config.contractType === 'ONLY_UP' || this.config.contractType === 'ONLY_DOWN';
    const isHighLowTick =
      this.config.contractType === 'HIGH_TICK' || this.config.contractType === 'LOW_TICK';
    const isDirectional = isContinuousDirectionalContract(this.config.contractType);
    const configuredTicks = Math.max(1, Math.round(this.config.duration || 1));

    // Directional contracts (High/Low, Rise/Fall, Only Up/Only Down) resolve on their exact tick duration without skip-tick delay.
    // 1-tick digit contracts in Normal mode preserve the 1-tick skip -> 1-tick exit cadence.
    const hasSkipTick = !isDirectional && !isFast && unit === 't' && configuredTicks === 1;
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

    // For High/Low, Rise/Fall, Only Up/Only Down (and Fast Mode), immediately open the next contract on exitTick so trading runs continuously without gaps
    if (this.config.botSpeed === 'fast' || isContinuousDirectionalContract(contract.contractType)) {
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
    const predDigit =
      typeof prediction === 'number' ? prediction : parseInt(String(prediction), 10) || 0;

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
    const rawProfit = won ? stakeUsed * (payoutMultiplier - 1) : -stakeUsed;
    const profit = Number(rawProfit.toFixed(2));
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

      const maxSteps = Math.max(1, Number(this.config.martingaleLevel) || 1);
      const mg = Math.max(1, Number(this.config.martingale) || 1.5);
      if (this.currentStep < maxSteps) {
        this.currentStake = Number((stakeUsed * mg).toFixed(2));
      } else {
        this.currentStake = initialStake;
        this.currentStep = 0;
      }
      soundManager.playLoss();
    }

    // Update Session P/L & Cumulative Metrics
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
      timestamp: exitTick.epoch,
      marketId: this.config.marketId || marketId,
      strategyName: this.config.name || 'Normal Bot',
      contractType,
      prediction: predictionText,
      stake: stakeUsed,
      entryPrice: entryTick.quote,
      exitPrice: exitTick.quote,
      exitDigit: exitTick.lastDigit,
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

    this.checkTpSlAndStop();
  }
}
