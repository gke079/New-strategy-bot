import { Market, Tick, OHLCCandle } from '../types';

export type TickListener = (tick: Tick, allTicks: Tick[]) => void;
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface DerivAccountInfo {
  loginid: string;
  balance: number;
  currency: string;
  email: string;
  isVirtual: boolean;
}

export const DERIV_PUBLIC_ENDPOINT = 'wss://api.derivws.com/trading/v1/options/ws/public';

export const DERIV_SERVERS = [
  {
    id: 'options_public',
    name: 'Deriv Options API Public (Direct wss://api.derivws.com)',
    url: 'wss://api.derivws.com/trading/v1/options/ws/public',
  },
  { id: 'prod', name: 'Deriv Primary Gateway (ws.derivws.com)', url: 'wss://ws.derivws.com/websockets/v3' },
  { id: 'blue', name: 'Deriv Blue Gateway (blue.derivws.com)', url: 'wss://blue.derivws.com/websockets/v3' },
  { id: 'green', name: 'Deriv Green Gateway (green.derivws.com)', url: 'wss://green.derivws.com/websockets/v3' },
  { id: 'red', name: 'Deriv Red Gateway (red.derivws.com)', url: 'wss://red.derivws.com/websockets/v3' },
  { id: 'binary', name: 'Deriv / Binary (ws.binaryws.com)', url: 'wss://ws.binaryws.com/websockets/v3' },
];

export class TickStreamEngine {
  private currentMarket: Market;
  private ticks: Tick[] = [];
  private ticksWindow: number = 1000;
  private candles: OHLCCandle[] = [];
  private candlesGranularity: number = 60;
  private listeners: Set<TickListener> = new Set();
  private candlesListeners: Set<(candles: OHLCCandle[]) => void> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private accountListeners: Set<(account: DerivAccountInfo | null) => void> = new Set();
  private authErrorListeners: Set<(error: string | null) => void> = new Set();
  private liveFeedListeners: Set<(isLive: boolean) => void> = new Set();
  private isLiveFeed: boolean = false;
  private currentPrice: number = 0;
  private currentPipSize: number = 2;
  private status: ConnectionStatus = 'connecting';
  private accountInfo: DerivAccountInfo | null = null;
  private authError: string | null = null;

  private ws: WebSocket | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private appId: string = '1089';
  private apiToken: string = '';
  private reconnectAttempts: number = 0;
  private isDestroyed: boolean = false;
  private lastRealTickEpoch: number = 0;
  private tickSpeedMs: number = 1000;

  private endpoints: string[] = [
    'wss://api.derivws.com/trading/v1/options/ws/public',
    'wss://ws.derivws.com/websockets/v3',
    'wss://blue.derivws.com/websockets/v3',
    'wss://green.derivws.com/websockets/v3',
    'wss://red.derivws.com/websockets/v3',
    'wss://ws.binaryws.com/websockets/v3',
  ];
  private currentEndpointIndex: number = 0;

  constructor(initialMarket: Market, initialWindow: number = 1000) {
    this.currentMarket = initialMarket;
    this.ticksWindow = initialWindow;
    this.currentPipSize = initialMarket.decimals;
    this.currentPrice = 0;
    this.ticks = [];

    // Check localStorage for saved Deriv credentials
    try {
      const savedAppId = localStorage.getItem('tickedge_deriv_app_id');
      if (savedAppId) this.appId = savedAppId;
      const savedToken = localStorage.getItem('tickedge_deriv_token');
      if (savedToken) this.apiToken = savedToken;
      let savedEndpoint = localStorage.getItem('tickedge_deriv_endpoint');
      if (!savedEndpoint || savedEndpoint.includes('websockets/v3')) {
        savedEndpoint = DERIV_PUBLIC_ENDPOINT;
        localStorage.setItem('tickedge_deriv_endpoint', DERIV_PUBLIC_ENDPOINT);
      }
      this.endpoints = [savedEndpoint, ...this.endpoints.filter((e) => e !== savedEndpoint)];
    } catch {}

    // Connect immediately to Deriv Live WebSocket for real prices
    this.initWebSocket();
  }

  public setMarket(market: Market) {
    if (this.currentMarket.id === market.id) return;
    this.currentMarket = market;
    this.currentPipSize = market.decimals;
    this.lastRealTickEpoch = 0;
    this.isLiveFeed = false;
    this.notifyLiveFeed();

    // Clear previous market ticks: ONLY real Deriv ticks will be populated
    this.ticks = [];
    this.currentPrice = 0;
    this.notifyAll();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
        this.ws.send(JSON.stringify({ forget_all: 'candles' }));
      } catch {}
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
            style: 'ticks',
            count: Math.min(this.ticksWindow, 1000),
          })
        );
      } catch {}
    }
  }

  public setSpeed(speedMs: number) {
    this.tickSpeedMs = Math.max(200, Math.min(5000, speedMs));
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

  public onAccountChange(listener: (account: DerivAccountInfo | null) => void): () => void {
    this.accountListeners.add(listener);
    listener(this.accountInfo);
    return () => this.accountListeners.delete(listener);
  }

  public onAuthError(listener: (error: string | null) => void): () => void {
    this.authErrorListeners.add(listener);
    listener(this.authError);
    return () => this.authErrorListeners.delete(listener);
  }

  public isLive(): boolean {
    return this.isLiveFeed;
  }

  public onLiveFeedChange(listener: (isLive: boolean) => void): () => void {
    this.liveFeedListeners.add(listener);
    listener(this.isLiveFeed);
    return () => this.liveFeedListeners.delete(listener);
  }

  private notifyLiveFeed() {
    this.liveFeedListeners.forEach((listener) => listener(this.isLiveFeed));
  }

  public getCandles(): OHLCCandle[] {
    return [...this.candles];
  }

  public subscribeCandles(listener: (candles: OHLCCandle[]) => void): () => void {
    this.candlesListeners.add(listener);
    if (this.candles.length > 0) {
      listener(this.candles);
    }
    return () => this.candlesListeners.delete(listener);
  }

  public requestOHLC(granularity: number = 60, count: number = 50) {
    this.candlesGranularity = granularity;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ forget_all: 'candles' }));
        this.ws.send(
          JSON.stringify({
            ticks_history: this.currentMarket.id,
            end: 'latest',
            count,
            style: 'candles',
            granularity,
            subscribe: 1,
          })
        );
      } catch (err) {
        console.warn('Failed to send OHLC request:', err);
      }
    }
  }

  private notifyCandles() {
    this.candlesListeners.forEach((listener) => {
      try {
        listener(this.candles);
      } catch {}
    });
  }

  public calibratePrice(newPrice: number) {
    if (isNaN(newPrice) || newPrice <= 0) return;
    this.currentPrice = newPrice;
  }

  public resetPriceCalibration() {
    this.currentPrice = 0;
  }

  public getAppId(): string {
    return this.appId;
  }

  public getApiToken(): string {
    return this.apiToken;
  }

  public getAccountInfo(): DerivAccountInfo | null {
    return this.accountInfo;
  }

  public getAuthError(): string | null {
    return this.authError;
  }

  public getActiveEndpointUrl(): string {
    return this.endpoints[this.currentEndpointIndex % this.endpoints.length];
  }

  public getEndpoints(): string[] {
    return [...this.endpoints];
  }

  public connectDeriv(appId: string = '1089', token: string = '', endpointUrl?: string) {
    this.appId = appId.trim() || '1089';
    this.apiToken = token.trim() || '';
    if (endpointUrl && endpointUrl.trim()) {
      const cleanUrl = endpointUrl.trim();
      this.endpoints = [cleanUrl, ...this.endpoints.filter((e) => e !== cleanUrl)];
      this.currentEndpointIndex = 0;
      try {
        localStorage.setItem('tickedge_deriv_endpoint', cleanUrl);
      } catch {}
    }

    try {
      localStorage.setItem('tickedge_deriv_app_id', this.appId);
      if (this.apiToken) {
        localStorage.setItem('tickedge_deriv_token', this.apiToken);
      } else {
        localStorage.removeItem('tickedge_deriv_token');
      }
    } catch {}

    this.reconnectAttempts = 0;
    this.authError = null;
    this.authErrorListeners.forEach((l) => l(null));
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
    const wsUrl = `${baseEndpoint}?app_id=${encodeURIComponent(this.appId)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isDestroyed) {
          this.cleanupSocket();
          return;
        }

        this.setStatus('connected');
        this.reconnectAttempts = 0;

        // Start ping heartbeat every 20 seconds to prevent session timeout
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
        console.warn(`Deriv WS connection issue on ${baseEndpoint}:`, err);
      };

      this.ws.onclose = (event) => {
        if (this.isDestroyed) return;
        console.warn(`Deriv WS closed (code: ${event.code}, reason: ${event.reason || 'none'}).`);
        this.setStatus('disconnected');
        this.isLiveFeed = false;
        this.notifyLiveFeed();
        this.reconnectAttempts++;
        // Rotate to next endpoint after 2 connection attempts
        if (this.reconnectAttempts >= 2) {
          this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
        }
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('Failed to initialize Deriv WebSocket:', err);
      this.setStatus('disconnected');
      this.isLiveFeed = false;
      this.notifyLiveFeed();
      this.scheduleReconnect();
    }
  }

  private subscribeTicksAndHistory() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      // 1. Forget previous subscriptions to avoid duplicate feeds
      this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
      this.ws.send(JSON.stringify({ forget_all: 'candles' }));
    } catch {}

    try {
      // 2. Request historical ticks AND subscribe to live ticks directly
      this.ws.send(
        JSON.stringify({
          ticks_history: this.currentMarket.id,
          end: 'latest',
          count: Math.min(this.ticksWindow, 1000),
          style: 'ticks',
          subscribe: 1,
        })
      );
    } catch (err) {
      console.warn('Failed to send ticks_history subscription:', err);
    }

    try {
      // 3. Request historical OHLC candles AND subscribe to live OHLC stream directly
      this.ws.send(
        JSON.stringify({
          ticks_history: this.currentMarket.id,
          end: 'latest',
          count: 50,
          style: 'candles',
          granularity: this.candlesGranularity,
          subscribe: 1,
        })
      );
    } catch (err) {
      console.warn('Failed to send OHLC candles subscription:', err);
    }
  }

  private handleMessage(rawData: string) {
    try {
      const data = JSON.parse(rawData);

      // Handle Ping heartbeat
      if (data.msg_type === 'ping' || data.ping === 'pong') {
        return;
      }

      // Handle errors from Deriv API
      if (data.error) {
        if (data.error.code === 'AlreadySubscribed') {
          return;
        }
        console.warn('Deriv API response error:', data.error.message, 'code:', data.error.code);
        if (data.echo_req?.authorize) {
          this.authError = data.error.message || 'Authorization failed. Please check your Deriv API token.';
          this.accountInfo = null;
          this.authErrorListeners.forEach((l) => l(this.authError));
          this.accountListeners.forEach((l) => l(null));
        }
        return;
      }

      // Handle Authorize
      if (data.msg_type === 'authorize' && data.authorize) {
        const auth = data.authorize;
        this.accountInfo = {
          loginid: auth.loginid || 'DerivTrader',
          balance: Number(auth.balance ?? 0),
          currency: auth.currency || 'USD',
          email: auth.email || '',
          isVirtual: Boolean(auth.is_virtual),
        };
        this.authError = null;
        this.authErrorListeners.forEach((l) => l(null));
        this.accountListeners.forEach((l) => l(this.accountInfo));
        console.log(`[Deriv WS] Authorized successfully: ${this.accountInfo.loginid} (Balance: ${this.accountInfo.balance} ${this.accountInfo.currency})`);
      }

      // Handle Historical Ticks
      if (data.msg_type === 'history' || data.history) {
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

          // Populate ticks with Deriv true history
          this.ticks = newTicks.slice(-this.ticksWindow);
          this.currentPrice = this.ticks[this.ticks.length - 1].quote;
          this.lastRealTickEpoch = Date.now();
          if (!this.isLiveFeed) {
            this.isLiveFeed = true;
            this.notifyLiveFeed();
          }
          this.setStatus('connected');
          this.notifyAll();
        }
      }

      // Handle Historical OHLC Candles
      else if (data.msg_type === 'candles' || data.candles) {
        const rawCandles = data.candles || [];
        if (Array.isArray(rawCandles) && rawCandles.length > 0) {
          this.candles = rawCandles.map((c: any) => ({
            epoch: (Number(c.epoch) || Math.floor(Date.now() / 1000)) * 1000,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            granularity: Number(data.echo_req?.granularity) || this.candlesGranularity,
          }));
          this.notifyCandles();
        }
      }

      // Handle Real-time Live OHLC Candle updates
      else if (data.msg_type === 'ohlc' || data.ohlc) {
        const ohlc = data.ohlc;
        if (ohlc) {
          const epoch = (Number(ohlc.open_time || ohlc.epoch) || Math.floor(Date.now() / 1000)) * 1000;
          const open = Number(ohlc.open);
          const high = Number(ohlc.high);
          const low = Number(ohlc.low);
          const close = Number(ohlc.close);
          const lastCandle = this.candles[this.candles.length - 1];
          if (lastCandle && lastCandle.epoch === epoch) {
            lastCandle.high = Math.max(lastCandle.high, high);
            lastCandle.low = Math.min(lastCandle.low, low);
            lastCandle.close = close;
          } else {
            this.candles.push({
              epoch,
              open,
              high,
              low,
              close,
              granularity: Number(ohlc.granularity) || this.candlesGranularity,
            });
            if (this.candles.length > 100) {
              this.candles.shift();
            }
          }
          this.notifyCandles();
        }
      }

      // Handle Real-time Live Tick
      else if (data.msg_type === 'tick' || data.tick) {
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

        // Real live tick received from Deriv
        this.lastRealTickEpoch = Date.now();
        if (!this.isLiveFeed) {
          this.isLiveFeed = true;
          this.notifyLiveFeed();
        }
        this.setStatus('connected');
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

  public destroy() {
    this.isDestroyed = true;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.cleanupSocket();
    this.listeners.clear();
    this.statusListeners.clear();
    this.accountListeners.clear();
    this.authErrorListeners.clear();
    this.liveFeedListeners.clear();
    this.candlesListeners.clear();
  }
}
