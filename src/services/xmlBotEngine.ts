import {
  BotMetrics,
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
}

export class XmlBotExecutor {
  private config: XmlBotConfig;
  private currentStake: number;
  private currentStep: number = 0;
  private consecutiveLosses: number = 0;
  private consecutiveWins: number = 0;
  private cooldownRemaining: number = 0;
  private useAlternateNext: boolean = false;
  private activeContract: ActiveXmlContract | null = null;
  private stage: XmlBotStage = 'idle';
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private balance: number = 10000;
  private trades: Trade[] = [];
  private journal: XmlJournalEntry[] = [];
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

  private onTradeListeners = new Set<(trade: Trade, metrics: BotMetrics, balance: number) => void>();
  private onStatusListeners = new Set<(running: boolean, paused: boolean, stage: XmlBotStage) => void>();
  private onJournalListeners = new Set<(entries: XmlJournalEntry[]) => void>();

  constructor(config: XmlBotConfig, initialBalance: number = 10000) {
    this.config = { ...config };
    this.currentStake = config.initialStake;
    this.balance = initialBalance;
    this.metrics.peakBalance = initialBalance;
  }

  public updateConfig(newConfig: Partial<XmlBotConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (!this.isRunning && newConfig.initialStake !== undefined) {
      this.currentStake = newConfig.initialStake;
      this.currentStep = 0;
    }
  }

  public getConfig(): XmlBotConfig {
    return { ...this.config };
  }

  public setBalance(balance: number) {
    this.balance = balance;
    this.metrics.peakBalance = Math.max(this.metrics.peakBalance, balance);
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
    return { ...this.metrics };
  }

  public getJournal(): XmlJournalEntry[] {
    return [...this.journal];
  }

  public start() {
    this.isRunning = true;
    this.isPaused = false;
    this.activeContract = null;
    this.currentStake = this.config.initialStake;
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
    this.stage = 'idle';
    this.log('idle', 'warn', `Bot stopped: ${reason}`);
    this.notifyState();
  }

  public resetStats() {
    this.trades = [];
    this.journal = [];
    this.activeContract = null;
    this.currentStake = this.config.initialStake;
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

    // 1. Check active contract (Stage 3: During Purchase)
    if (this.activeContract) {
      this.stage = 'during_purchase';
      const contract = this.activeContract;

      // Optional Early Sell at Profit during multi-tick / timed contracts
      if (this.config.enableSellAtProfit && contract.ticksRemaining > 1) {
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
            this.finalizeTrade(true, contract.stake, contract.entryTick, tick, activeMarketId, estProfit);
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

    // 2. Cooldown check
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= 1;
      return;
    }

    // 3. Stage 2: Before Purchase condition evaluation
    this.stage = 'before_purchase';
    this.notifyState();

    const matched = this.evaluateBeforePurchaseCondition(tick, allTicks);
    if (!matched) return;

    // 4. Purchase Contract
    const stakeToUse = Math.min(this.balance, Math.max(0.35, Number(this.currentStake.toFixed(2))));
    if (this.balance < stakeToUse) {
      this.stop('Insufficient balance to place stake');
      return;
    }

    const activeContractType =
      this.config.alternateContractOnLoss && this.useAlternateNext
        ? this.config.alternateContractType
        : this.config.contractType;

    const unit = this.config.durationUnit || 't';
    const rawDur = Math.max(1, Math.round(this.config.duration || 1));
    const nowMs = Date.now();
    const endTime =
      unit === 'm' ? nowMs + rawDur * 60000 : unit === 's' ? nowMs + rawDur * 1000 : undefined;

    this.activeContract = {
      id: 'XML-' + nowMs.toString(36),
      entryTick: tick,
      contractType: activeContractType,
      prediction: this.config.prediction,
      stake: stakeToUse,
      duration: rawDur,
      durationUnit: unit,
      ticksRemaining: rawDur,
      startTime: nowMs,
      endTime,
    };

    this.stage = 'during_purchase';
    this.log(
      'before_purchase',
      'buy',
      `Purchased ${activeContractType}${
        ['OVER', 'UNDER', 'DIFFERS', 'MATCHES'].includes(activeContractType)
          ? ` ${this.config.prediction}`
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

  private getPayoutMultiplier(type: TradeContractType, prediction: number): number {
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
      case 'ONLY_DOWN':
        return 3.85;
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

    const won = this.checkWinCondition(
      contract.contractType,
      contract.prediction,
      contract.entryTick,
      exitTick
    );
    this.finalizeTrade(won, contract.stake, contract.entryTick, exitTick, activeMarketId);
  }

  private finalizeTrade(
    won: boolean,
    stakeUsed: number,
    entryTick: Tick,
    exitTick: Tick,
    activeMarketId: string,
    overrideProfit?: number
  ) {
    this.stage = 'after_purchase';
    const contractType =
      this.config.alternateContractOnLoss && this.useAlternateNext
        ? this.config.alternateContractType
        : this.config.contractType;

    const mult = this.getPayoutMultiplier(contractType, this.config.prediction);
    const profit =
      overrideProfit !== undefined ? overrideProfit : won ? stakeUsed * (mult - 1) : -stakeUsed;
    this.balance = Number((this.balance + profit).toFixed(2));

    if (won) {
      this.consecutiveWins += 1;
      this.consecutiveLosses = 0;
      this.useAlternateNext = false;

      if (this.config.lossAction === 'compound_win') {
        this.currentStep += 1;
        if (this.currentStep < this.config.maxMartingaleSteps) {
          this.currentStake = Number((stakeUsed * this.config.martingaleMultiplier).toFixed(2));
        } else {
          this.currentStake = this.config.initialStake;
          this.currentStep = 0;
        }
      } else {
        this.currentStake = this.config.initialStake;
        this.currentStep = 0;
      }
      soundManager.playWin();
      this.log(
        'after_purchase',
        'win',
        `Contract WON +$${profit.toFixed(2)} (Exit ${exitTick.quoteFormatted} · Digit ${exitTick.lastDigit}) · Next stake $${this.currentStake.toFixed(2)}`
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
        this.currentStake = this.config.initialStake;
        this.currentStep = 0;
      } else if (this.config.lossAction === 'martingale') {
        this.currentStake = Number((stakeUsed * this.config.martingaleMultiplier).toFixed(2));
      } else if (this.config.lossAction === 'dalembert') {
        this.currentStake = Number((stakeUsed + this.config.dalembertUnit).toFixed(2));
      } else {
        this.currentStake = this.config.initialStake;
      }
      soundManager.playLoss();
      this.log(
        'after_purchase',
        'loss',
        `Contract LOST -$${Math.abs(profit).toFixed(2)} (Exit ${exitTick.quoteFormatted} · Digit ${exitTick.lastDigit}) · Next stake $${this.currentStake.toFixed(2)}`
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
      currentStreak: {
        type: won ? 'win' : 'loss',
        count: won ? this.consecutiveWins : this.consecutiveLosses,
      },
      maxDrawdown: Math.max(this.metrics.maxDrawdown, dd),
      peakBalance: peak,
    };

    const digitTypes = ['OVER', 'UNDER', 'DIFFERS', 'MATCHES'];
    const predictionLabel = digitTypes.includes(contractType)
      ? `${contractType} ${this.config.prediction}`
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
    this.onTradeListeners.forEach((cb) => cb(tradeRecord, this.metrics, this.balance));

    // Check Take Profit / Stop Loss / Trade Again
    if (this.metrics.totalProfit >= this.config.takeProfit) {
      try {
        confetti({ particleCount: 100, spread: 75, origin: { y: 0.6 } });
      } catch {}
      this.stop(`Take Profit reached (+$${this.metrics.totalProfit.toFixed(2)})`);
      return;
    }

    if (this.metrics.totalProfit <= -Math.abs(this.config.stopLoss)) {
      this.stop(`Stop Loss reached ($${this.metrics.totalProfit.toFixed(2)})`);
      return;
    }

    if (!this.config.tradeAgain) {
      this.stop('Single cycle completed (trade_again disabled)');
      return;
    }

    this.cooldownRemaining = Math.max(0, this.config.cooldownTicks || 0);
    this.stage = 'before_purchase';
    this.notifyState();
  }
}
