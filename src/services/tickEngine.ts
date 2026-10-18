import { Market, Tick } from '../types';

export type TickListener = (tick: Tick, allTicks: Tick[]) => void;
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'simulated';

export class TickStreamEngine {
  private currentMarket: Market;
  private ticks: Tick[] = [];
  private ticksWindow: number = 1000;
  private listeners: Set<TickListener> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  private isSimulation: boolean = true;
  private simIntervalId: ReturnType<typeof setInterval> | null = null;
  private simSpeedMs: number = 1000;
  private currentPrice: number = 0;

  // Deriv WebSocket
  private ws: WebSocket | null = null;
  private wsPingInterval: ReturnType<typeof setInterval> | null = null;
  private appId: string = '1089';
  private apiToken: string = '';
  private status: ConnectionStatus = 'simulated';

  constructor(initialMarket: Market, initialWindow: number = 1000) {
    this.currentMarket = initialMarket;
    this.ticksWindow = initialWindow;
    this.currentPrice = initialMarket.basePrice;
  }

  public setMarket(market: Market) {
    this.currentMarket = market;
    this.currentPrice = market.basePrice;
    this.ticks = [];
    if (!this.isSimulation && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.subscribeDerivMarket();
    } else if (this.isSimulation) {
      // Re-seed a few ticks for immediate visual feedback
      this.seedInitialTicks(120);
    }
  }

  public setTicksWindow(windowSize: number) {
    this.ticksWindow = Math.max(10, Math.min(5000, windowSize));
    if (this.ticks.length > this.ticksWindow) {
      this.ticks = this.ticks.slice(-this.ticksWindow);
      this.notifyAll();
    }
  }

  public setSpeed(speedMs: number) {
    this.simSpeedMs = speedMs;
    if (this.isSimulation) {
      this.startSimulation();
    }
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
    return this.status;
  }

  public subscribe(listener: TickListener): () => void {
    this.listeners.add(listener);
    // Trigger immediately with current state
    if (this.ticks.length > 0) {
      listener(this.ticks[this.ticks.length - 1], this.ticks);
    }
    return () => this.listeners.delete(listener);
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setConnectionStatus(s: ConnectionStatus) {
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
  }

  // Generate a realistic tick
  public generateNextSimulatedTick(): Tick {
    const vol = this.currentMarket.volatility;
    // Standard normal distribution approximation
    const u1 = Math.random() || 0.0001;
    const u2 = Math.random() || 0.0001;
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    // Occasional micro-jump
    const jump = Math.random() < 0.03 ? (Math.random() - 0.5) * vol * 4 : 0;
    const delta = this.currentPrice * (vol * z + jump);

    const prevPrice = this.currentPrice;
    this.currentPrice = Math.max(0.0001, prevPrice + delta);

    const diff = this.currentPrice - prevPrice;
    const direction = Math.abs(diff) < this.currentMarket.pipSize * 0.1 ? 'flat' : diff > 0 ? 'up' : 'down';

    const formatted = this.currentPrice.toFixed(this.currentMarket.decimals);
    // Last digit is the last character of the formatted string
    const lastChar = formatted.charAt(formatted.length - 1);
    const lastDigit = parseInt(lastChar, 10);

    const tick: Tick = {
      epoch: Date.now(),
      quote: this.currentPrice,
      quoteFormatted: formatted,
      lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
      direction,
      change: diff,
    };

    this.addTick(tick);
    return tick;
  }

  public seedInitialTicks(count: number = 300) {
    this.ticks = [];
    const target = Math.min(count, this.ticksWindow);
    for (let i = 0; i < target; i++) {
      this.generateNextSimulatedTick();
    }
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

  public startSimulation() {
    this.stopSimulation();
    this.isSimulation = true;
    this.setConnectionStatus('simulated');
    this.simIntervalId = setInterval(() => {
      this.generateNextSimulatedTick();
    }, this.simSpeedMs);
  }

  public stopSimulation() {
    if (this.simIntervalId) {
      clearInterval(this.simIntervalId);
      this.simIntervalId = null;
    }
  }

  // Connect to Deriv Live WebSocket
  public connectDeriv(appId: string = '1089', token: string = '') {
    this.stopSimulation();
    this.appId = appId || '1089';
    this.apiToken = token;
    this.isSimulation = false;
    this.setConnectionStatus('connecting');

    try {
      if (this.ws) {
        this.ws.close();
      }

      const endpoint = `wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`;
      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        this.setConnectionStatus('connected');
        this.startWsPing();
        this.subscribeDerivMarket();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'tick' && data.tick) {
            const rawQuote = data.tick.quote;
            const prevPrice = this.currentPrice || rawQuote;
            this.currentPrice = rawQuote;
            const diff = this.currentPrice - prevPrice;
            const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
            const formatted = this.currentPrice.toFixed(this.currentMarket.decimals);
            const lastChar = formatted.charAt(formatted.length - 1);
            const lastDigit = parseInt(lastChar, 10);

            const tick: Tick = {
              epoch: data.tick.epoch * 1000 || Date.now(),
              quote: this.currentPrice,
              quoteFormatted: formatted,
              lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
              direction,
              change: diff,
            };

            this.addTick(tick);
          }
        } catch {
          // Ignore malformed message
        }
      };

      this.ws.onerror = () => {
        // Fallback to simulation if WebSocket fails
        this.setConnectionStatus('disconnected');
        setTimeout(() => {
          if (!this.isSimulation) {
            this.startSimulation();
          }
        }, 1500);
      };

      this.ws.onclose = () => {
        this.setConnectionStatus('disconnected');
        this.stopWsPing();
      };
    } catch {
      this.startSimulation();
    }
  }

  private subscribeDerivMarket() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Forget previous ticks stream and subscribe new
    this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
    this.ws.send(
      JSON.stringify({
        ticks: this.currentMarket.id,
        subscribe: 1,
      })
    );
  }

  private startWsPing() {
    this.stopWsPing();
    this.wsPingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }));
      }
    }, 25000);
  }

  private stopWsPing() {
    if (this.wsPingInterval) {
      clearInterval(this.wsPingInterval);
      this.wsPingInterval = null;
    }
  }

  public destroy() {
    this.stopSimulation();
    this.stopWsPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.statusListeners.clear();
  }
}
