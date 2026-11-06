import {
  BotMetrics,
  isContinuousDirectionalContract,
  Tick,
  Trade,
  TradeContractType,
  XmlBotConfig,
  XmlBotStage,
  XmlJournalEntry,
} from '../types';
import { soundManager } from './soundEffects';
import confetti from 'canvas-confetti';

interface ActiveXmlContract {
  id: string;
  entryTick: Tick;
  contractType: TradeContractType;
  prediction: number;
  stake: number;
  duration: number;
  durationUnit: 't' | 's' | 'm';
  ticksRemaining: number;
  startTime: number;
  endTime?: number;
  observedQuotes?: number[];
  allStrictUp?: boolean;
  allStrictDown?: boolean;
  lastQuote?: number;
}

export class XmlBotExecutor {
  private config: XmlBotConfig;
  private currentStake: number;
  private currentStep: number = 0;
  private consecutiveLosses: number = 0;
  private consecutiveWins: number = 0;
  private cooldownRemaining: number = 0;
  private useAlternateNext: boolean = false;
  private entryConfirmed: boolean = false;
  private activeContract: ActiveXmlContract | null = null;
  private stage: XmlBotStage = 'idle';
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private balance: number = 10000;
  private sessionProfit: number = 0;
  private lastStopReason: string = '';
  private trades: Trade[] = [];
  private journal: XmlJournalEntry[] = [];
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

  private onTradeListeners = new Set<(trade: Trade, metrics: BotMetrics, balance: number) => void>();
  private onStatusListeners = new Set<(running: boolean, paused: boolean, stage: XmlBotStage) => void>();
  private onJournalListeners = new Set<(entries: XmlJournalEntry[]) => void>();

  constructor(config: XmlBotConfig, initialBalance: number = 10000) {
    this.config = { ...config };
    this.currentStake = Math.max(0.35, Number(config.initialStake) || 0.35);
    const safeBalance = initialBalance > 0 ? initialBalance : 10000;
    this.balance = safeBalance;
    this.metrics.peakBalance = safeBalance;
  }

  public updateConfig(newConfig: Partial<XmlBotConfig>) {
    const conditionChanged =
      (newConfig.contractType !== undefined && newConfig.contractType !== this.config.contractType) ||
      (newConfig.purchaseCondition !== undefined &&
        newConfig.purchaseCondition !== this.config.purchaseCondition) ||
      (newConfig.conditionValue !== undefined &&
        newConfig.conditionValue !== this.config.conditionValue) ||
      (newConfig.conditionStreakCount !== undefined &&
        newConfig.conditionStreakCount !== this.config.conditionStreakCount) ||
      (newConfig.marketId !== undefined && newConfig.marketId !== this.config.marketId);

    this.config = { ...this.config, ...newConfig };
    if (conditionChanged && !this.activeContract) {
      this.entryConfirmed = false;
    }
    if (!this.isRunning && newConfig.initialStake !== undefined) {
      this.currentStake = Math.max(0.35, Number(newConfig.initialStake) || 0.35);
      this.currentStep = 0;
    }
  }

  public getConfig(): XmlBotConfig {
    return { ...this.config };
  }

  public setBalance(balance: number) {
    if (balance <= 0 && this.isRunning) return;
    const safeBalance = balance > 0 ? balance : this.balance > 0 ? this.balance : 10000;
    this.balance = safeBalance;
    this.metrics.peakBalance = Math.max(this.metrics.peakBalance, safeBalance);
  }

  public getStatus(): boolean {
    return this.isRunning;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getStage(): XmlBotStage {
    return this.stage;
  }

  public getCurrentStake(): number {
    return this.currentStake;
  }

  public getCurrentStep(): number {
    return this.currentStep;
  }

  public getMetrics(): BotMetrics {
    return {
      ...this.metrics,
      sessionProfit: this.sessionProfit,
      lastStopReason: this.lastStopReason || undefined,
    };
  }

  public getJournal(): XmlJournalEntry[] {
    return [...this.journal];
  }

  public start() {
    if (this.balance <= 0) {
      this.balance = 10000;
      this.metrics.peakBalance = Math.max(this.metrics.peakBalance, 10000);
    }
    this.isRunning = true;
    this.isPaused = false;
    this.activeContract = null;
    this.entryConfirmed = false;
    this.sessionProfit = 0;
    this.lastStopReason = '';
    this.metrics.sessionProfit = 0;
    this.metrics.lastStopReason = undefined;
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
    this.currentStep = 0;
    this.cooldownRemaining = 0;
    this.useAlternateNext = false;
    this.stage = 'initialization';
    this.log(
      'initialization',
      'info',
      `Initialized "${this.config.name}" on ${this.config.marketId} · Stake $${this.currentStake.toFixed(2)} · TP $${this.config.takeProfit.toFixed(2)} / SL $${this.config.stopLoss.toFixed(2)}`
    );
    this.stage = 'before_purchase';
    this.notifyState();
  }

  public pause() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.log(this.stage, 'warn', 'Bot paused by trader.');
    this.notifyState();
  }

  public resume() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.log(this.stage, 'info', 'Bot resumed live evaluation.');
    this.notifyState();
  }

  public stop(reason: string = 'Stopped manually') {
    this.isRunning = false;
    this.isPaused = false;
    this.activeContract = null;
    this.entryConfirmed = false;
    this.lastStopReason = reason;
    this.metrics.lastStopReason = reason;
    this.stage = 'idle';
    this.log('idle', 'warn', `Bot stopped: ${reason}`);
    this.notifyState();
  }

  public resetStats() {
    this.trades = [];
    this.journal = [];
    this.activeContract = null;
    this.entryConfirmed = false;
    this.sessionProfit = 0;
    this.lastStopReason = '';
    this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
    this.currentStep = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.cooldownRemaining = 0;
    this.useAlternateNext = false;
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
    this.onJournalListeners.forEach((l) => l([]));
    this.notifyState();
  }

  public onTrade(cb: (trade: Trade, metrics: BotMetrics, balance: number) => void): () => void {
    this.onTradeListeners.add(cb);
    return () => this.onTradeListeners.delete(cb);
  }

  public onStatusChange(cb: (running: boolean, paused: boolean, stage: XmlBotStage) => void): () => void {
    this.onStatusListeners.add(cb);
    return () => this.onStatusListeners.delete(cb);
  }

  public onJournal(cb: (entries: XmlJournalEntry[]) => void): () => void {
    this.onJournalListeners.add(cb);
    return () => this.onJournalListeners.delete(cb);
  }

  private notifyState() {
    this.onStatusListeners.forEach((cb) => cb(this.isRunning, this.isPaused, this.stage));
  }

  private checkTpSlAndStop(): boolean {
    const tp = Number(this.config.takeProfit);
    const sl = Math.abs(Number(this.config.stopLoss));
    if (tp > 0 && this.sessionProfit >= tp - 1e-6) {
      try {
        confetti({ particleCount: 100, spread: 75, origin: { y: 0.6 } });
      } catch {}
      this.stop(`Take Profit reached (+$${this.sessionProfit.toFixed(2)})`);
      return true;
    }
    if (sl > 0 && this.sessionProfit <= -(sl - 1e-6)) {
      this.stop(`Stop Loss reached (-$${Math.abs(this.sessionProfit).toFixed(2)})`);
      return true;
    }
    return false;
  }

  private log(stage: XmlBotStage, level: XmlJournalEntry['level'], message: string) {
    const entry: XmlJournalEntry = {
      id: 'JRN-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now(),
      stage,
      level,
      message,
    };
    this.journal.unshift(entry);
    if (this.journal.length > 120) {
      this.journal.pop();
    }
    this.onJournalListeners.forEach((cb) => cb([...this.journal]));
  }

  public evaluateTick(tick: Tick, allTicks: Tick[], activeMarketId: string) {
    if (!this.isRunning || this.isPaused) return;

    if (this.checkTpSlAndStop()) return;

    // 1. Check active contract (Stage 3: During Purchase)
    if (this.activeContract) {
      this.stage = 'during_purchase';
      const contract = this.activeContract;

      const prevQuote = contract.lastQuote ?? contract.entryTick.quote;
      if (tick.quote <= prevQuote) contract.allStrictUp = false;
      if (tick.quote >= prevQuote) contract.allStrictDown = false;
      contract.lastQuote = tick.quote;

      const isHighLowTick =
        contract.contractType === 'HIGH_TICK' || contract.contractType === 'LOW_TICK';
      if (isHighLowTick) {
        if (!contract.observedQuotes) contract.observedQuotes = [];
        contract.observedQuotes.push(tick.quote);
      }

      // Optional Early Sell at Profit during multi-tick / timed contracts (not supported on High/Low Tick or Only Up/Down)
      const isOnlyUpDown =
        contract.contractType === 'ONLY_UP' || contract.contractType === 'ONLY_DOWN';
      if (
        !isHighLowTick &&
        !isOnlyUpDown &&
        this.config.enableSellAtProfit &&
        contract.ticksRemaining > 1
      ) {
        const floatingWin = this.checkWinCondition(
          contract.contractType,
          contract.prediction,
          contract.entryTick,
          tick
        );
        if (floatingWin) {
          const estProfit = contract.stake * 0.45;
          if (estProfit >= this.config.sellProfitThreshold) {
            this.log(
              'during_purchase',
              'win',
              `Sold contract at market early (+$${estProfit.toFixed(2)} >= $${this.config.sellProfitThreshold.toFixed(2)})`
            );
            this.activeContract = null;
            this.finalizeTrade(
              true,
              contract.stake,
              contract.entryTick,
              tick,
              activeMarketId,
              estProfit,
              contract.contractType,
              contract.prediction
            );
            return;
          }
        }
      }

      if (contract.durationUnit === 't') {
        contract.ticksRemaining -= 1;
        if (contract.ticksRemaining <= 0) {
          this.resolveContract(tick, activeMarketId);
        }
      } else {
        const now = Date.now();
        if (contract.endTime && now >= contract.endTime) {
          this.resolveContract(tick, activeMarketId);
        }
      }
      return;
    }

    const isContinuousDirectional = isContinuousDirectionalContract(this.config.contractType);

    // 2. Cooldown check (continuous directional contracts run immediately after entry is found)
    if (!isContinuousDirectional && this.cooldownRemaining > 0) {
      this.cooldownRemaining -= 1;
      return;
    }

    // 3. Stage 2: Before Purchase condition evaluation
    this.stage = 'before_purchase';
    this.notifyState();

    if (!(isContinuousDirectional && this.entryConfirmed)) {
      const matched = this.evaluateBeforePurchaseCondition(tick, allTicks);
      if (!matched) return;
      if (isContinuousDirectional) {
        this.entryConfirmed = true;
        this.log(
          'before_purchase',
          'info',
          `Entry confirmed for ${this.config.contractType} — running continuous execution until TP/SL or Stop.`
        );
      }
    }

    // 4. Purchase Contract
    this.openContract(tick);
  }

  private openContract(tick: Tick) {
    if (!this.isRunning || this.isPaused) return;
    if (this.checkTpSlAndStop()) return;

    if (this.balance <= 0 && this.metrics.totalTrades === 0) {
      this.balance = 10000;
      this.metrics.peakBalance = Math.max(this.metrics.peakBalance, 10000);
    }

    const desiredStake = Math.max(
      0.35,
      Number((this.currentStake || this.config.initialStake || 0.35).toFixed(2))
    );
    if (this.balance < 0.35) {
      this.stop('Insufficient balance to place stake');
      return;
    }
    const stakeToUse = Number(Math.min(this.balance, desiredStake).toFixed(2));

    const activeContractType =
      this.config.alternateContractOnLoss && this.useAlternateNext
        ? this.config.alternateContractType
        : this.config.contractType;

    const isHighLowTick = activeContractType === 'HIGH_TICK' || activeContractType === 'LOW_TICK';
    const isOnlyUpDown = activeContractType === 'ONLY_UP' || activeContractType === 'ONLY_DOWN';
    const unit = isHighLowTick || isOnlyUpDown ? 't' : this.config.durationUnit || 't';
    const rawDur = isHighLowTick
      ? 5
      : isOnlyUpDown
      ? Math.max(2, Math.min(5, Math.round(this.config.duration || 2)))
      : Math.max(1, Math.round(this.config.duration || 1));
    const effectivePred = isHighLowTick
      ? Math.max(1, Math.min(5, Math.round(this.config.prediction || 3)))
      : this.config.prediction;
    const nowMs = Date.now();
    const endTime =
      unit === 'm' ? nowMs + rawDur * 60000 : unit === 's' ? nowMs + rawDur * 1000 : undefined;

    this.activeContract = {
      id: 'XML-' + nowMs.toString(36),
      entryTick: tick,
      contractType: activeContractType,
      prediction: effectivePred,
      stake: stakeToUse,
      duration: rawDur,
      durationUnit: unit,
      ticksRemaining: rawDur,
      startTime: nowMs,
      endTime,
      observedQuotes: isHighLowTick ? [] : undefined,
      allStrictUp: true,
      allStrictDown: true,
      lastQuote: tick.quote,
    };

    this.stage = 'during_purchase';
    this.log(
      'before_purchase',
      'buy',
      `Purchased ${activeContractType}${
        isHighLowTick
          ? ` #${effectivePred}`
          : ['OVER', 'UNDER', 'DIFFERS', 'MATCHES'].includes(activeContractType)
          ? ` ${effectivePred}`
          : ''
      } · Stake $${stakeToUse.toFixed(2)} @ ${tick.quoteFormatted} (Digit ${tick.lastDigit})`
    );
    this.notifyState();
  }

  private evaluateBeforePurchaseCondition(tick: Tick, allTicks: Tick[]): boolean {
    const cond = this.config.purchaseCondition;
    const val = this.config.conditionValue;
    const n = Math.max(1, this.config.conditionStreakCount || 2);

    switch (cond) {
      case 'always':
        return true;
      case 'last_digit_eq':
        return tick.lastDigit === val;
      case 'last_digit_neq':
        return tick.lastDigit !== val;
      case 'last_digit_gt':
        return tick.lastDigit > val;
      case 'last_digit_lt':
        return tick.lastDigit < val;
      case 'last_digit_even':
        return tick.lastDigit % 2 === 0;
      case 'last_digit_odd':
        return tick.lastDigit % 2 !== 0;
      case 'streak_over_n': {
        if (allTicks.length < n) return false;
        return allTicks.slice(-n).every((t) => t.lastDigit > val);
      }
      case 'streak_under_n': {
        if (allTicks.length < n) return false;
        return allTicks.slice(-n).every((t) => t.lastDigit < val);
      }
      case 'streak_even_n': {
        if (allTicks.length < n) return false;
        return allTicks.slice(-n).every((t) => t.lastDigit % 2 === 0);
      }
      case 'streak_odd_n': {
        if (allTicks.length < n) return false;
        return allTicks.slice(-n).every((t) => t.lastDigit % 2 !== 0);
      }
      case 'rising_ticks_n': {
        if (allTicks.length < n + 1) return false;
        const recent = allTicks.slice(-(n + 1));
        for (let i = 1; i < recent.length; i++) {
          if (recent[i].quote <= recent[i - 1].quote) return false;
        }
        return true;
      }
      case 'falling_ticks_n': {
        if (allTicks.length < n + 1) return false;
        const recent = allTicks.slice(-(n + 1));
        for (let i = 1; i < recent.length; i++) {
          if (recent[i].quote >= recent[i - 1].quote) return false;
        }
        return true;
      }
      default:
        return true;
    }
  }

  private getPayoutMultiplier(type: TradeContractType, prediction: number, duration: number = 2): number {
    switch (type) {
      case 'OVER':
        return Number((9.5 / Math.max(1, 9 - prediction)).toFixed(3));
      case 'UNDER':
        return Number((9.5 / Math.max(1, prediction)).toFixed(3));
      case 'DIFFERS':
        return 1.095;
      case 'MATCHES':
        return 9.0;
      case 'ONLY_UP':
      case 'ONLY_DOWN': {
        const clamped = Math.min(5, Math.max(2, Math.round(duration || 2)));
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

  private checkWinCondition(
    contractType: TradeContractType,
    prediction: number,
    entryTick: Tick,
    exitTick: Tick
  ): boolean {
    const digit = exitTick.lastDigit;
    switch (contractType) {
      case 'OVER':
        return digit > prediction;
      case 'UNDER':
        return digit < prediction;
      case 'DIFFERS':
        return digit !== prediction;
      case 'MATCHES':
        return digit === prediction;
      case 'EVEN':
        return digit % 2 === 0;
      case 'ODD':
        return digit % 2 !== 0;
      case 'RISE':
      case 'HIGHER':
      case 'ONLY_UP':
      case 'RESET_CALL':
        return exitTick.quote > entryTick.quote;
      case 'FALL':
      case 'LOWER':
      case 'ONLY_DOWN':
      case 'RESET_PUT':
        return exitTick.quote < entryTick.quote;
      default:
        return digit > prediction;
    }
  }

  private resolveContract(exitTick: Tick, activeMarketId: string) {
    if (!this.activeContract) return;
    const contract = this.activeContract;
    this.activeContract = null;

    let won: boolean;
    if (contract.contractType === 'HIGH_TICK' || contract.contractType === 'LOW_TICK') {
      const quotes = contract.observedQuotes || [];
      const targetTick = Math.max(1, Math.min(5, Math.round(contract.prediction || 1)));
      if (quotes.length < 5) {
        won = false;
      } else {
        const windowQuotes = quotes.slice(0, 5);
        const pickedQuote = windowQuotes[targetTick - 1];
        if (contract.contractType === 'HIGH_TICK') {
          const maxOther = Math.max(...windowQuotes.filter((_, idx) => idx !== targetTick - 1));
          won = pickedQuote > maxOther;
        } else {
          const minOther = Math.min(...windowQuotes.filter((_, idx) => idx !== targetTick - 1));
          won = pickedQuote < minOther;
        }
      }
    } else if (contract.contractType === 'ONLY_UP') {
      won = contract.allStrictUp !== false && exitTick.quote > contract.entryTick.quote;
    } else if (contract.contractType === 'ONLY_DOWN') {
      won = contract.allStrictDown !== false && exitTick.quote < contract.entryTick.quote;
    } else {
      won = this.checkWinCondition(
        contract.contractType,
        contract.prediction,
        contract.entryTick,
        exitTick
      );
    }

    this.finalizeTrade(
      won,
      contract.stake,
      contract.entryTick,
      exitTick,
      activeMarketId,
      undefined,
      contract.contractType,
      contract.prediction,
      contract.duration
    );
  }

  private finalizeTrade(
    won: boolean,
    stakeUsed: number,
    entryTick: Tick,
    exitTick: Tick,
    activeMarketId: string,
    overrideProfit?: number,
    executedContractType?: TradeContractType,
    executedPrediction?: number,
    executedDuration?: number
  ) {
    this.stage = 'after_purchase';
    const contractType =
      executedContractType ??
      (this.config.alternateContractOnLoss && this.useAlternateNext
        ? this.config.alternateContractType
        : this.config.contractType);
    const predDigit = executedPrediction ?? this.config.prediction;

    const mult = this.getPayoutMultiplier(
      contractType,
      predDigit,
      executedDuration ?? this.config.duration
    );
    const profit =
      overrideProfit !== undefined ? overrideProfit : won ? stakeUsed * (mult - 1) : -stakeUsed;
    this.balance = Number((this.balance + profit).toFixed(2));
    this.sessionProfit = Number((this.sessionProfit + profit).toFixed(2));

    if (won) {
      this.consecutiveWins += 1;
      this.consecutiveLosses = 0;
      this.useAlternateNext = false;

      if (this.config.lossAction === 'compound_win') {
        this.currentStep += 1;
        if (this.currentStep < this.config.maxMartingaleSteps) {
          this.currentStake = Number((stakeUsed * this.config.martingaleMultiplier).toFixed(2));
        } else {
          this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
          this.currentStep = 0;
        }
      } else {
        this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
        this.currentStep = 0;
      }
      soundManager.playWin();
      this.log(
        'after_purchase',
        'win',
        `Contract WON +$${profit.toFixed(2)} (Session P/L: ${this.sessionProfit >= 0 ? '+' : ''}$${this.sessionProfit.toFixed(2)}) · Next stake $${this.currentStake.toFixed(2)}`
      );
    } else {
      this.consecutiveLosses += 1;
      this.consecutiveWins = 0;
      if (this.config.alternateContractOnLoss) {
        this.useAlternateNext = !this.useAlternateNext;
      }

      this.currentStep += 1;
      const maxSteps = Math.max(1, this.config.maxMartingaleSteps || 4);
      if (this.currentStep >= maxSteps && this.config.resetOnMaxSteps) {
        this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
        this.currentStep = 0;
      } else if (this.config.lossAction === 'martingale') {
        this.currentStake = Number((stakeUsed * this.config.martingaleMultiplier).toFixed(2));
      } else if (this.config.lossAction === 'dalembert') {
        this.currentStake = Number((stakeUsed + this.config.dalembertUnit).toFixed(2));
      } else {
        this.currentStake = Math.max(0.35, Number(this.config.initialStake) || 0.35);
      }
      soundManager.playLoss();
      this.log(
        'after_purchase',
        'loss',
        `Contract LOST -$${Math.abs(profit).toFixed(2)} (Session P/L: ${this.sessionProfit >= 0 ? '+' : ''}$${this.sessionProfit.toFixed(2)}) · Next stake $${this.currentStake.toFixed(2)}`
      );
    }

    const totalTrades = this.metrics.totalTrades + 1;
    const wins = this.metrics.wins + (won ? 1 : 0);
    const losses = this.metrics.losses + (won ? 0 : 1);
    const totalProfit = Number((this.metrics.totalProfit + profit).toFixed(2));
    const winRate = Number(((wins / totalTrades) * 100).toFixed(1));
    const peak = Math.max(this.metrics.peakBalance, this.balance);
    const dd = peak > 0 ? Number((((peak - this.balance) / peak) * 100).toFixed(2)) : 0;

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
      maxDrawdown: Math.max(this.metrics.maxDrawdown, dd),
      peakBalance: peak,
    };

    const predictionLabel =
      contractType === 'HIGH_TICK'
        ? `High Tick #${predDigit}`
        : contractType === 'LOW_TICK'
        ? `Low Tick #${predDigit}`
        : contractType === 'UNDER'
        ? `Under ${predDigit}`
        : contractType === 'OVER'
        ? `Over ${predDigit}`
        : contractType === 'DIFFERS'
        ? `Differs ${predDigit}`
        : contractType === 'MATCHES'
        ? `Matches ${predDigit}`
        : contractType;

    const tradeRecord: Trade = {
      id: 'XTR-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      timestamp: exitTick.epoch,
      marketId: this.config.marketId || activeMarketId,
      strategyName: this.config.name || 'XML DBot',
      contractType,
      prediction: predictionLabel,
      stake: stakeUsed,
      entryPrice: entryTick.quote,
      exitPrice: exitTick.quote,
      exitDigit: exitTick.lastDigit,
      profit: Number(profit.toFixed(2)),
      status: won ? 'won' : 'lost',
      balanceAfter: this.balance,
      botSource: 'xml',
    };

    this.trades.unshift(tradeRecord);
    if (this.trades.length > 200) this.trades.pop();
    this.onTradeListeners.forEach((cb) => cb(tradeRecord, this.getMetrics(), this.balance));

    // Check Take Profit / Stop Loss immediately against Session P/L
    if (this.checkTpSlAndStop()) {
      return;
    }

    const isContinuousDirectional = isContinuousDirectionalContract(contractType);

    if (!isContinuousDirectional && !this.config.tradeAgain) {
      this.stop('Single cycle completed (trade_again disabled)');
      return;
    }

    if (isContinuousDirectional) {
      this.cooldownRemaining = 0;
      this.openContract(exitTick);
      return;
    }

    this.cooldownRemaining = Math.max(0, this.config.cooldownTicks || 0);
    this.stage = 'before_purchase';
    this.notifyState();
  }
}
