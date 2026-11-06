import { Market, Tick, OHLCCandle } from '../types';
import { SYNTHETIC_MARKETS, normalizeMarketId } from './markets';

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
];

export class TickStreamEngine {
  private currentMarket: Market;
  private ticks: Tick[] = [];
  private marketTicks: Map<string, Tick[]> = new Map();
  private marketPipSizes: Map<string, number> = new Map();
  private subscribedMarkets: Set<string> = new Set();
  private preloadTimer: ReturnType<typeof setTimeout> | null = null;
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
  private authWs: WebSocket | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private appId: string = '1089';
  private apiToken: string = '';
  private reconnectAttempts: number = 0;
  private isDestroyed: boolean = false;
  private lastRealTickEpoch: number = 0;
  private tickSpeedMs: number = 1000;

  private endpoints: string[] = [DERIV_PUBLIC_ENDPOINT];
  private currentEndpointIndex: number = 0;

  constructor(initialMarket: Market, initialWindow: number = 1000) {
    this.currentMarket = initialMarket;
    this.ticksWindow = initialWindow;
    this.currentPipSize = initialMarket.decimals;
    this.currentPrice = 0;
    this.ticks = [];

    SYNTHETIC_MARKETS.forEach((m) => {
      this.marketPipSizes.set(m.id, m.decimals);
    });

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
    const normalizedId = normalizeMarketId(market.id);
    const resolvedMarket =
      SYNTHETIC_MARKETS.find((m) => m.id === normalizedId) || market;

    if (this.currentMarket.id === resolvedMarket.id && this.ticks.length > 0) {
      return;
    }

    this.currentMarket = resolvedMarket;
    const pipSize = this.marketPipSizes.get(resolvedMarket.id) ?? resolvedMarket.decimals;
    this.currentPipSize = pipSize;

    // Instant in-memory switch from live multi-market cache (0ms latency)
    const cached = this.marketTicks.get(resolvedMarket.id) || [];
    if (cached.length > 0) {
      this.ticks = cached.slice(-this.ticksWindow);
      this.currentPrice = this.ticks[this.ticks.length - 1].quote;
      this.lastRealTickEpoch = Date.now();
      if (!this.isLiveFeed) {
        this.isLiveFeed = true;
        this.notifyLiveFeed();
      }
      this.notifyAll();
    } else {
      this.ticks = [];
      this.currentPrice = 0;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Top up history if needed without tearing down live multi-market tick streams
      const targetCount = Math.min(this.ticksWindow, 1000);
      const alreadySubscribed = this.subscribedMarkets.has(resolvedMarket.id);
      if (!alreadySubscribed || cached.length < Math.min(targetCount, 400)) {
        try {
          const payload: Record<string, unknown> = {
            ticks_history: resolvedMarket.id,
            end: 'latest',
            count: targetCount,
            style: 'ticks',
          };
          if (!alreadySubscribed) {
            payload.subscribe = 1;
            this.subscribedMarkets.add(resolvedMarket.id);
          }
          this.ws.send(JSON.stringify(payload));
        } catch {}
      }

      // Switch live OHLC candle feed to newly selected market
      try {
        this.ws.send(JSON.stringify({ forget_all: 'candles' }));
        this.ws.send(
          JSON.stringify({
            ticks_history: resolvedMarket.id,
            end: 'latest',
            count: 50,
            style: 'candles',
            granularity: this.candlesGranularity,
            subscribe: 1,
          })
        );
      } catch {}
    }
  }

  public setTicksWindow(windowSize: number) {
    this.ticksWindow = Math.max(10, Math.min(5000, windowSize));
    const cached = this.marketTicks.get(this.currentMarket.id) || [];
    if (cached.length > 0) {
      this.ticks = cached.slice(-this.ticksWindow);
      this.notifyAll();
    } else if (this.ticks.length > this.ticksWindow) {
      this.ticks = this.ticks.slice(-this.ticksWindow);
      this.notifyAll();
    }

    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      cached.length < Math.min(this.ticksWindow, 1000)
    ) {
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
    this.marketTicks.set(this.currentMarket.id, []);
    this.ticks = [];
    this.notifyAll();
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

  public getTicks(): Tick[] {
    return [...this.ticks];
  }

  public getMarketTicks(marketId: string): Tick[] {
    const normalized = normalizeMarketId(marketId);
    return [...(this.marketTicks.get(normalized) || [])];
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
      const cleanUrl = endpointUrl.includes('websockets/v3')
        ? DERIV_PUBLIC_ENDPOINT
        : endpointUrl.trim();
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
        this.subscribedMarkets.clear();

        // Start ping heartbeat every 20 seconds to prevent session timeout
        this.startPing();

        // Authorize via dedicated Deriv v3 auth socket if token provided
        if (this.apiToken) {
          this.initAuthSocket();
        }

        // Subscribe active market immediately, then warm all other synthetic markets in background
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
        this.subscribedMarkets.clear();
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= 2 && this.endpoints.length > 1) {
          this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
        }
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

    const activeId = this.currentMarket.id;
    const count = Math.min(this.ticksWindow, 1000);

    try {
      // 1. Prioritize active market history + live tick subscription first
      this.subscribedMarkets.add(activeId);
      this.ws.send(
        JSON.stringify({
          ticks_history: activeId,
          end: 'latest',
          count,
          style: 'ticks',
          subscribe: 1,
        })
      );
    } catch (err) {
      console.warn('Failed to send primary ticks_history subscription:', err);
    }

    try {
      // 2. Request historical OHLC candles & live OHLC stream for active market
      this.ws.send(
        JSON.stringify({
          ticks_history: activeId,
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

    // 3. Automatically warm & subscribe all remaining synthetic markets so switching is instant (0ms)
    if (this.preloadTimer) clearTimeout(this.preloadTimer);
    this.preloadTimer = setTimeout(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.isDestroyed) return;
      for (const market of SYNTHETIC_MARKETS) {
        if (market.id === activeId || this.subscribedMarkets.has(market.id)) continue;
        try {
          this.subscribedMarkets.add(market.id);
          this.ws.send(
            JSON.stringify({
              ticks_history: market.id,
              end: 'latest',
              count,
              style: 'ticks',
              subscribe: 1,
            })
          );
        } catch {}
      }
    }, 60);
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
      }

      // Handle Live Balance Subscription Updates
      if (data.msg_type === 'balance' && data.balance && this.accountInfo) {
        this.accountInfo = {
          ...this.accountInfo,
          balance: Number(data.balance.balance ?? this.accountInfo.balance),
          currency: data.balance.currency || this.accountInfo.currency,
        };
        this.accountListeners.forEach((l) => l(this.accountInfo));
      }

      // Handle Historical Ticks (for active or background-warmed markets)
      if (data.msg_type === 'history' || data.history) {
        const symbol = String(data.echo_req?.ticks_history || this.currentMarket.id);
        const marketMeta = SYNTHETIC_MARKETS.find((m) => m.id === symbol);
        const prices: number[] = data.history?.prices || [];
        const times: number[] = data.history?.times || [];
        const pipSize: number =
          data.pip_size !== undefined
            ? Number(data.pip_size)
            : marketMeta?.decimals ?? this.currentMarket.decimals;
        this.marketPipSizes.set(symbol, pipSize);

        if (prices.length > 0) {
          const newTicks: Tick[] = [];
          let prev = prices[0];

          for (let i = 0; i < prices.length; i++) {
            const quote = Number(prices[i]);
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

          const maxBuffer = Math.max(this.ticksWindow, 1000);
          const trimmed = newTicks.slice(-maxBuffer);
          this.marketTicks.set(symbol, trimmed);

          if (symbol === this.currentMarket.id) {
            this.currentPipSize = pipSize;
            this.ticks = trimmed.slice(-this.ticksWindow);
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
      }

      // Handle Historical OHLC Candles
      else if (data.msg_type === 'candles' || data.candles) {
        const symbol = String(data.echo_req?.ticks_history || this.currentMarket.id);
        if (symbol !== this.currentMarket.id) return;
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
          if (ohlc.symbol && ohlc.symbol !== this.currentMarket.id) return;
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

      // Handle Real-time Live Tick (across all subscribed markets)
      else if (data.msg_type === 'tick' || data.tick) {
        const tickData = data.tick;
        if (!tickData) return;

        const symbol = String(tickData.symbol || this.currentMarket.id);
        const marketMeta = SYNTHETIC_MARKETS.find((m) => m.id === symbol);
        const quote: number = Number(tickData.quote);
        const epoch: number = (tickData.epoch || Math.floor(Date.now() / 1000)) * 1000;
        const pipSize: number =
          tickData.pip_size !== undefined
            ? Number(tickData.pip_size)
            : this.marketPipSizes.get(symbol) ?? marketMeta?.decimals ?? this.currentPipSize;
        this.marketPipSizes.set(symbol, pipSize);

        const quoteFormatted = quote.toFixed(pipSize);
        const lastChar = quoteFormatted.charAt(quoteFormatted.length - 1);
        const lastDigit = parseInt(lastChar, 10);

        const existingBuffer = this.marketTicks.get(symbol) || [];
        const prevPrice =
          existingBuffer.length > 0 ? existingBuffer[existingBuffer.length - 1].quote : quote;
        const diff = quote - prevPrice;
        const direction =
          Math.abs(diff) < Math.pow(10, -pipSize) * 0.1 ? 'flat' : diff > 0 ? 'up' : 'down';

        const newTick: Tick = {
          epoch,
          quote,
          quoteFormatted,
          lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
          direction,
          change: diff,
        };

        const maxBuffer = Math.max(this.ticksWindow, 1000);
        existingBuffer.push(newTick);
        if (existingBuffer.length > maxBuffer) {
          existingBuffer.shift();
        }
        this.marketTicks.set(symbol, existingBuffer);

        if (symbol === this.currentMarket.id) {
          this.currentPipSize = pipSize;
          this.currentPrice = quote;
          this.lastRealTickEpoch = Date.now();
          if (!this.isLiveFeed) {
            this.isLiveFeed = true;
            this.notifyLiveFeed();
          }
          this.setStatus('connected');
          this.ticks = existingBuffer.slice(-this.ticksWindow);
          this.notifyAll();
        }
      }
    } catch (err) {
      console.warn('Error processing Deriv WebSocket message:', err);
    }
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
      if (this.authWs && this.authWs.readyState === WebSocket.OPEN) {
        try {
          this.authWs.send(JSON.stringify({ ping: 1 }));
        } catch {}
      }
    }, 20000);
  }

  private initAuthSocket() {
    this.cleanupAuthSocket();
    if (!this.apiToken || this.isDestroyed) return;
    try {
      const authUrl = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(this.appId)}`;
      this.authWs = new WebSocket(authUrl);
      this.authWs.onopen = () => {
        if (this.isDestroyed || !this.apiToken) {
          this.cleanupAuthSocket();
          return;
        }
        try {
          this.authWs?.send(JSON.stringify({ authorize: this.apiToken }));
        } catch {}
      };
      this.authWs.onmessage = (ev: MessageEvent) => {
        if (this.isDestroyed) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg.msg_type === 'authorize' && msg.authorize) {
            this.handleMessage(ev.data);
            try {
              this.authWs?.send(JSON.stringify({ balance: 1, subscribe: 1 }));
            } catch {}
          } else if (msg.msg_type === 'balance' || msg.error) {
            this.handleMessage(ev.data);
          }
        } catch {}
      };
      this.authWs.onerror = () => {};
    } catch {}
  }

  private cleanupAuthSocket() {
    if (this.authWs) {
      try {
        this.authWs.onopen = null;
        this.authWs.onmessage = null;
        this.authWs.onerror = null;
        this.authWs.onclose = null;
        this.authWs.close();
      } catch {}
      this.authWs = null;
    }
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
    this.cleanupAuthSocket();
    if (this.preloadTimer) {
      clearTimeout(this.preloadTimer);
      this.preloadTimer = null;
    }
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
