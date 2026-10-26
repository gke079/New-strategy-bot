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
  private currentPipSize: number = 2;
  private status: ConnectionStatus = 'connecting';

  private ws: WebSocket | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private appId: string = '1089';
  private apiToken: string = '';
  private reconnectAttempts: number = 0;
  private isDestroyed: boolean = false;
  private hasReceivedRealTick: boolean = false;

  private endpoints: string[] = [
    'wss://ws.derivws.com/websockets/v3',
    'wss://ws.binaryws.com/websockets/v3',
    'wss://frontend.derivws.com/websockets/v3',
  ];
  private currentEndpointIndex: number = 0;

  constructor(initialMarket: Market, initialWindow: number = 1000) {
    this.currentMarket = initialMarket;
    this.ticksWindow = initialWindow;
    this.currentPrice = initialMarket.basePrice;
    this.currentPipSize = initialMarket.decimals;

    // Check localStorage for saved Deriv credentials
    try {
      const savedAppId = localStorage.getItem('tickedge_deriv_app_id');
      if (savedAppId) this.appId = savedAppId;
      const savedToken = localStorage.getItem('tickedge_deriv_token');
      if (savedToken) this.apiToken = savedToken;
    } catch {}

    // 1. Seed baseline ticks immediately so the UI is fully functional and never blank while WS connects
    this.seedBaselineTicks(100);

    // 2. Connect to Deriv Live WebSocket
    this.initWebSocket();
  }

  public setMarket(market: Market) {
    if (this.currentMarket.id === market.id) return;
    this.currentMarket = market;
    this.currentPipSize = market.decimals;
    this.currentPrice = market.basePrice;
    this.hasReceivedRealTick = false;

    // Seed baseline ticks for new market until live stream arrives
    this.seedBaselineTicks(100);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
      } catch (err) {
        console.warn('Failed to send forget_all:', err);
      }
      this.subscribeTicksAndHistory();
    }
  }

  public setTicksWindow(windowSize: number) {
    this.ticksWindow = Math.max(10, Math.min(5000, windowSize));
    if (this.ticks.length > this.ticksWindow) {
      this.ticks = this.ticks.slice(-this.ticksWindow);
      this.notifyAll();
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            ticks_history: this.currentMarket.id,
            end: 'latest',
            start: 1,
            style: 'ticks',
            count: Math.min(this.ticksWindow, 1000),
          })
        );
      } catch {}
    }
  }

  public setSpeed(_speedMs: number) {
    // Deriv live stream arrives at real tick arrival rate
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

  public connectDeriv(appId: string = '1089', token: string = '', endpointUrl?: string) {
    this.appId = appId || '1089';
    this.apiToken = token || '';
    if (endpointUrl) {
      this.endpoints = [endpointUrl, ...this.endpoints.filter((e) => e !== endpointUrl)];
      this.currentEndpointIndex = 0;
    }

    try {
      if (appId) localStorage.setItem('tickedge_deriv_app_id', appId);
      if (token) localStorage.setItem('tickedge_deriv_token', token);
    } catch {}

    this.reconnectAttempts = 0;
    this.initWebSocket();
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((l) => l(newStatus));
    }
  }

  private initWebSocket() {
    if (this.isDestroyed) return;

    this.cleanupSocket();
    this.setStatus('connecting');

    const baseEndpoint = this.endpoints[this.currentEndpointIndex % this.endpoints.length];
    const wsUrl = `${baseEndpoint}?app_id=${encodeURIComponent(this.appId)}&l=EN&brand=deriv`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isDestroyed) {
          this.cleanupSocket();
          return;
        }

        this.setStatus('connected');
        this.reconnectAttempts = 0;

        // Start ping heartbeat every 20 seconds
        this.startPing();

        // Authorize if token provided
        if (this.apiToken) {
          try {
            this.ws?.send(JSON.stringify({ authorize: this.apiToken }));
          } catch {}
        }

        // Subscribe to real-time ticks & past ticks history
        this.subscribeTicksAndHistory();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (this.isDestroyed) return;
        this.handleMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.warn(`Deriv WS error on ${baseEndpoint}:`, err);
        // Switch to alternate endpoint on error
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
      };

      this.ws.onclose = (event) => {
        if (this.isDestroyed) return;
        console.warn(`Deriv WS closed (code: ${event.code}, reason: ${event.reason || 'none'}). Reconnecting...`);
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('Failed to initialize Deriv WebSocket:', err);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private subscribeTicksAndHistory() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      // 1. Primary Live Tick Stream Subscription (never fails on synthetic indices)
      this.ws.send(
        JSON.stringify({
          ticks: this.currentMarket.id,
          subscribe: 1,
        })
      );

      // 2. Request Historical Ticks to populate buffer
      this.ws.send(
        JSON.stringify({
          ticks_history: this.currentMarket.id,
          end: 'latest',
          start: 1,
          style: 'ticks',
          count: Math.min(this.ticksWindow, 1000),
        })
      );
    } catch (err) {
      console.warn('Failed to send ticks subscription:', err);
    }
  }

  private handleMessage(rawData: string) {
    try {
      const data = JSON.parse(rawData);

      // Handle errors from Deriv API
      if (data.error) {
        console.warn('Deriv API response error:', data.error.message, 'code:', data.error.code);
        // If ticks_history had issue, ensure live stream is requested
        if (data.echo_req?.ticks_history && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ ticks: this.currentMarket.id, subscribe: 1 }));
        }
        return;
      }

      // Handle Historical Ticks
      if (data.msg_type === 'history') {
        const prices: number[] = data.history?.prices || [];
        const times: number[] = data.history?.times || [];
        const pipSize: number =
          data.pip_size !== undefined ? Number(data.pip_size) : this.currentMarket.decimals;
        this.currentPipSize = pipSize;

        if (prices.length > 0) {
          const newTicks: Tick[] = [];
          let prev = prices[0];

          for (let i = 0; i < prices.length; i++) {
            const quote = prices[i];
            const epoch = (times[i] || Math.floor(Date.now() / 1000)) * 1000;
            const quoteFormatted = quote.toFixed(pipSize);
            const lastChar = quoteFormatted.charAt(quoteFormatted.length - 1);
            const lastDigit = parseInt(lastChar, 10);
            const diff = quote - prev;
            const direction =
              Math.abs(diff) < Math.pow(10, -pipSize) * 0.1 ? 'flat' : diff > 0 ? 'up' : 'down';
            prev = quote;

            newTicks.push({
              epoch,
              quote,
              quoteFormatted,
              lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
              direction,
              change: diff,
            });
          }

          // Replace baseline ticks with true Deriv history
          this.ticks = newTicks.slice(-this.ticksWindow);
          this.currentPrice = this.ticks[this.ticks.length - 1].quote;
          this.hasReceivedRealTick = true;
          this.setStatus('connected');
          this.notifyAll();
        }
      }

      // Handle Real-time Live Tick
      else if (data.msg_type === 'tick') {
        const tickData = data.tick;
        if (!tickData) return;

        const quote: number = Number(tickData.quote);
        const epoch: number = (tickData.epoch || Math.floor(Date.now() / 1000)) * 1000;
        const pipSize: number =
          tickData.pip_size !== undefined ? Number(tickData.pip_size) : this.currentPipSize;
        this.currentPipSize = pipSize;

        const quoteFormatted = quote.toFixed(pipSize);
        const lastChar = quoteFormatted.charAt(quoteFormatted.length - 1);
        const lastDigit = parseInt(lastChar, 10);

        const prevPrice = this.currentPrice || quote;
        const diff = quote - prevPrice;
        const direction =
          Math.abs(diff) < Math.pow(10, -pipSize) * 0.1 ? 'flat' : diff > 0 ? 'up' : 'down';

        this.currentPrice = quote;

        const newTick: Tick = {
          epoch,
          quote,
          quoteFormatted,
          lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
          direction,
          change: diff,
        };

        // If this is the first real tick and we only had baseline ticks, transition cleanly
        if (!this.hasReceivedRealTick) {
          this.hasReceivedRealTick = true;
          this.setStatus('connected');
        }

        this.addTick(newTick);
      }
    } catch (err) {
      console.warn('Error processing Deriv WebSocket message:', err);
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

  private startPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ ping: 1 }));
        } catch {}
      }
    }, 20000);
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimeout) return;
    this.reconnectAttempts++;
    const delay = Math.min(1500 * Math.pow(1.3, this.reconnectAttempts - 1), 8000);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.isDestroyed) {
        this.initWebSocket();
      }
    }, delay);
  }

  private cleanupSocket() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  /**
   * Generates baseline initial ticks around the market's official basePrice
   * so that the UI is active, responsive, and shows accurate formatting while
   * the live Deriv WebSocket connection handshakes.
   */
  private seedBaselineTicks(count: number = 100) {
    const ticks: Tick[] = [];
    let price = this.currentMarket.basePrice;
    const decimals = this.currentMarket.decimals;
    const pip = this.currentMarket.pipSize;
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const delta = (Math.random() - 0.495) * pip * 4;
      const prevPrice = price;
      price = Math.max(0.0001, prevPrice + delta);
      const diff = price - prevPrice;
      const direction = Math.abs(diff) < pip * 0.1 ? 'flat' : diff > 0 ? 'up' : 'down';
      const quoteFormatted = price.toFixed(decimals);
      const lastChar = quoteFormatted.charAt(quoteFormatted.length - 1);
      const lastDigit = parseInt(lastChar, 10);

      ticks.push({
        epoch: now - (count - i) * 1000,
        quote: price,
        quoteFormatted,
        lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
        direction,
        change: diff,
      });
    }

    this.ticks = ticks;
    this.currentPrice = price;
    this.notifyAll();
  }

  public destroy() {
    this.isDestroyed = true;
    this.cleanupSocket();
    this.listeners.clear();
    this.statusListeners.clear();
  }
}
