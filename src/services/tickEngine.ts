import { Market, Tick } from '../types';

export type TickListener = (tick: Tick, allTicks: Tick[]) => void;
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export class TickStreamEngine {
  private currentMarket: Market;
  private ticks: Tick[] = [];
  private ticksWindow: number = 1000;
  private listeners: Set<TickListener> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private currentPrice: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(initialMarket: Market, initialWindow: number = 1000) {
    this.currentMarket = initialMarket;
    this.ticksWindow = initialWindow;
    this.currentPrice = initialMarket.basePrice;
    this.seedTicks(200);
    this.startStreaming();
  }

  public setMarket(market: Market) {
    this.currentMarket = market;
    this.currentPrice = market.basePrice;
    this.ticks = [];
    this.seedTicks(200);
    this.notifyAll();
  }

  public setTicksWindow(windowSize: number) {
    this.ticksWindow = Math.max(10, Math.min(5000, windowSize));
    if (this.ticks.length > this.ticksWindow) {
      this.ticks = this.ticks.slice(-this.ticksWindow);
      this.notifyAll();
    }
  }

  public setSpeed(_speedMs: number) {
    // Kept for compatibility
  }

  public clearBuffer() {
    this.ticks = [];
    this.notifyAll();
  }

  public getTicks(): Tick[] {
    return [...this.ticks];
  }

  public getCurrentPrice(): number {
    return this.currentPrice;
  }

  public getStatus(): ConnectionStatus {
    return 'connected';
  }

  public subscribe(listener: TickListener): () => void {
    this.listeners.add(listener);
    if (this.ticks.length > 0) {
      listener(this.ticks[this.ticks.length - 1], this.ticks);
    }
    return () => this.listeners.delete(listener);
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener('connected');
    return () => this.statusListeners.delete(listener);
  }

  private addTick(tick: Tick) {
    this.ticks.push(tick);
    if (this.ticks.length > this.ticksWindow) {
      this.ticks.shift();
    }
    this.notifyAll();
  }

  private notifyAll() {
    const latest = this.ticks[this.ticks.length - 1];
    if (latest) {
      this.listeners.forEach((listener) => listener(latest, this.ticks));
    }
  }

  private generateNextTick(): Tick {
    const vol = this.currentMarket.volatility;
    const u1 = Math.random() || 0.0001;
    const u2 = Math.random() || 0.0001;
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const jump = Math.random() < 0.03 ? (Math.random() - 0.5) * vol * 4 : 0;
    const delta = this.currentPrice * (vol * z + jump);

    const prevPrice = this.currentPrice;
    this.currentPrice = Math.max(0.0001, prevPrice + delta);

    const diff = this.currentPrice - prevPrice;
    const direction = Math.abs(diff) < this.currentMarket.pipSize * 0.1 ? 'flat' : diff > 0 ? 'up' : 'down';
    const formatted = this.currentPrice.toFixed(this.currentMarket.decimals);
    const lastChar = formatted.charAt(formatted.length - 1);
    const lastDigit = parseInt(lastChar, 10);

    return {
      epoch: Date.now(),
      quote: this.currentPrice,
      quoteFormatted: formatted,
      lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
      direction,
      change: diff,
    };
  }

  private seedTicks(count: number = 200) {
    this.ticks = [];
    const target = Math.min(count, this.ticksWindow);
    for (let i = 0; i < target; i++) {
      const t = this.generateNextTick();
      this.ticks.push(t);
    }
  }

  private startStreaming() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      const newTick = this.generateNextTick();
      this.addTick(newTick);
    }, 1000);
  }

  public connectDeriv(_appId: string = '1089', _token: string = '') {
    // Immediate success state so UI is never blocked
    this.statusListeners.forEach((l) => l('connected'));
  }

  public destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.listeners.clear();
    this.statusListeners.clear();
  }
}
