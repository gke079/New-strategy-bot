import { Market, Tick, TradeContractType } from '../types';

export type TickListener = (tick: Tick, allTicks: Tick[]) => void;
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export type DataSource = 'deriv_live' | 'simulated';

export interface DerivAccountInfo {
  loginid: string;
  balance: number;
  currency: string;
  is_virtual: boolean;
  email?: string;
  scopes?: string[];
}

export interface ContractBuyParams {
  symbol: string;
  contractType: TradeContractType;
  stake: number;
  predictionDigit?: number;
  duration?: number;
  durationUnit?: 't' | 's';
  currency?: string;
}

export interface ContractSettlement {
  contractId: number;
  status: 'won' | 'lost';
  profit: number;
  exitPrice: number;
  exitDigit: number;
  payout: number;
  raw: any;
}

export class TickStreamEngine {
  private currentMarket: Market;
  private ticks: Tick[] = [];
  private ticksWindow: number = 1000;
  private listeners: Set<TickListener> = new Set();
  private statusListeners: Set<(status: ConnectionStatus, isLiveDeriv: boolean, info?: string) => void> = new Set();
  private accountListeners: Set<(account: DerivAccountInfo) => void> = new Set();
  private balanceListeners: Set<(balance: number, currency: string) => void> = new Set();
  private tradeSettledListeners: Set<(settlement: ContractSettlement) => void> = new Set();

  private currentPrice: number = 0;
  private ws: WebSocket | null = null;
  // Deriv official public App ID 1089 (accepts any token and works across all endpoints)
  private appId: string = '1089';
  private apiToken: string = '';
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private isLiveDeriv: boolean = false;
  private connectionAttempt: number = 0;
  private maxAutoReconnectAttempts: number = 6;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private simIntervalId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private activePendingContracts: Map<number, (settlement: ContractSettlement) => void> = new Map();
  private lastPingSentAt: number = 0;
  private latencyMs: number = 0;

  constructor(initialMarket: Market, initialWindow: number = 1000) {
    this.currentMarket = initialMarket;
    this.ticksWindow = initialWindow;
    this.currentPrice = initialMarket.basePrice;

    // Load any saved credentials and migrate legacy or invalid App IDs
    try {
      const savedToken = localStorage.getItem('tickedge_deriv_token');
      if (savedToken) this.apiToken = savedToken.trim();

      const savedAppId = localStorage.getItem('tickedge_deriv_app_id');
      // If legacy 61554 was saved (which triggers 520 errors on Cloudflare), migrate to standard 1089
      if (!savedAppId || savedAppId === '61554' || savedAppId.trim() === '') {
        this.appId = '1089';
        localStorage.setItem('tickedge_deriv_app_id', '1089');
      } else {
        this.appId = savedAppId.trim();
      }
    } catch {}

    // Seed initial synthetic ticks so UI mounts instantly with chart history
    this.seedTicks(Math.min(100, initialWindow));

    // Start streaming from Deriv WebSocket
    this.connectDeriv(this.appId, this.apiToken);
  }

  public setMarket(market: Market) {
    if (this.currentMarket.id === market.id) return;

    this.currentMarket = market;
    this.currentPrice = market.basePrice;
    this.ticks = [];
    this.seedTicks(Math.min(60, this.ticksWindow));
    this.notifyAll();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        // Forget previous tick stream
        this.ws.send(JSON.stringify({ forget_all: 'ticks' }));

        // Request real tick history for new market
        this.ws.send(
          JSON.stringify({
            ticks_history: market.id,
            count: Math.min(this.ticksWindow, 1000),
            end: 'latest',
            style: 'ticks',
          })
        );

        // Subscribe to real live ticks for new market
        this.ws.send(
          JSON.stringify({
            ticks: market.id,
            subscribe: 1,
          })
        );
      } catch (err) {
        console.warn('Failed to switch market in Deriv WS:', err);
      }
    }
  }

  public setTicksWindow(windowSize: number) {
    this.ticksWindow = Math.max(10, Math.min(5000, windowSize));
    if (this.ticks.length > this.ticksWindow) {
      this.ticks = this.ticks.slice(-this.ticksWindow);
      this.notifyAll();
    }
  }

  public setSpeed(_speedMs: number) {
    // Kept for backward compatibility
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
    if (this.isConnected) return 'connected';
    if (this.isConnecting) return 'connecting';
    return 'disconnected';
  }

  public getIsLiveDeriv(): boolean {
    return this.isLiveDeriv;
  }

  public getAppId(): string {
    return this.appId;
  }

  public getLatency(): number {
    return this.latencyMs;
  }

  public subscribe(listener: TickListener): () => void {
    this.listeners.add(listener);
    if (this.ticks.length > 0) {
      listener(this.ticks[this.ticks.length - 1], this.ticks);
    }
    return () => this.listeners.delete(listener);
  }

  public onStatusChange(listener: (status: ConnectionStatus, isLiveDeriv: boolean, info?: string) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus(), this.isLiveDeriv);
    return () => this.statusListeners.delete(listener);
  }

  public onAccountAuthorize(listener: (account: DerivAccountInfo) => void): () => void {
    this.accountListeners.add(listener);
    return () => this.accountListeners.delete(listener);
  }

  public onBalanceUpdate(listener: (balance: number, currency: string) => void): () => void {
    this.balanceListeners.add(listener);
    return () => this.balanceListeners.delete(listener);
  }

  public onTradeSettled(listener: (settlement: ContractSettlement) => void): () => void {
    this.tradeSettledListeners.add(listener);
    return () => this.tradeSettledListeners.delete(listener);
  }

  public reconnect() {
    this.connectionAttempt = 0;
    this.connectDeriv(this.appId, this.apiToken);
  }

  /**
   * Connects to Deriv Official WebSocket.
   * Rotates between direct Deriv clusters (red, ws, blue) and the local /deriv-ws proxy relay.
   */
  public connectDeriv(appId: string = '1089', token: string = '') {
    const cleanAppId = appId.trim() || '1089';
    this.appId = cleanAppId;
    if (token !== undefined) {
      this.apiToken = token.trim();
    }

    try {
      localStorage.setItem('tickedge_deriv_app_id', this.appId);
      if (this.apiToken) {
        localStorage.setItem('tickedge_deriv_token', this.apiToken);
      }
    } catch {}

    this.cleanupWebSocket();
    this.isConnecting = true;
    this.notifyStatus('connecting', false, `Connecting to Deriv (App ID: ${this.appId})...`);

    // Determine protocol and host for local proxy relay
    let localRelayUrl = '';
    if (typeof window !== 'undefined' && window.location) {
      const isHttps = window.location.protocol === 'https:';
      localRelayUrl = `${isHttps ? 'wss:' : 'ws:'}//${window.location.host}/deriv-ws?app_id=${encodeURIComponent(this.appId)}`;
    }

    // Direct browser WebSocket endpoints to Deriv official servers and local relay
    const endpoints: string[] = [
      `wss://red.derivws.com/websockets/v3?app_id=${encodeURIComponent(this.appId)}`,
      `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(this.appId)}`,
    ];

    if (localRelayUrl) {
      endpoints.push(localRelayUrl);
    }

    endpoints.push(`wss://blue.derivws.com/websockets/v3?app_id=${encodeURIComponent(this.appId)}`);

    const currentUrl = endpoints[this.connectionAttempt % endpoints.length];
    const isRelay = currentUrl.includes('/deriv-ws');

    try {
      this.ws = new WebSocket(currentUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.connectionAttempt = 0; // reset on successful connection

        const endpointLabel = isRelay ? 'Deriv Cloud Relay' : 'Deriv Real-time Node';
        this.notifyStatus('connected', this.isLiveDeriv, `Connected to ${endpointLabel} (App ID ${this.appId})`);

        // Start ping interval every 25 seconds
        this.pingIntervalId = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.lastPingSentAt = Date.now();
            this.ws.send(JSON.stringify({ ping: 1 }));
          }
        }, 25000);

        // If API token is provided, authorize first before streaming ticks
        if (this.apiToken && this.apiToken.length > 0) {
          this.notifyStatus('connecting', false, 'Authorizing Deriv API Token...');
          this.ws?.send(JSON.stringify({ authorize: this.apiToken }));
        } else {
          // Public live stream for ticks without token
          this.subscribeToTicks();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleDerivMessage(data);
        } catch (err) {
          console.warn('Failed to parse Deriv WS message:', err);
        }
      };

      this.ws.onerror = (_err) => {
        console.warn(`Deriv endpoint error on ${currentUrl}`);
        this.isConnected = false;
        this.isLiveDeriv = false;
        this.notifyStatus('disconnected', false, 'Connection error. Switching to backup endpoint...');
        this.startSimFallback();
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.isLiveDeriv = false;
        this.startSimFallback();

        // If user provided an invalid token, don't keep slamming reconnects
        if (this.connectionAttempt >= this.maxAutoReconnectAttempts) {
          this.notifyStatus(
            'disconnected',
            false,
            `Connection paused after ${this.maxAutoReconnectAttempts} attempts (Code ${event.code}). Click Reconnect to try again.`
          );
          return;
        }

        // Exponential backoff: 3s, 5s, 8s, 12s, 15s
        const delays = [3000, 5000, 8000, 12000, 15000];
        const delay = delays[Math.min(this.connectionAttempt, delays.length - 1)];

        this.notifyStatus('disconnected', false, `Reconnecting in ${(delay / 1000).toFixed(0)}s (attempt ${this.connectionAttempt + 1})...`);

        if (!this.reconnectTimeoutId) {
          this.reconnectTimeoutId = setTimeout(() => {
            this.reconnectTimeoutId = null;
            this.connectionAttempt++;
            this.connectDeriv(this.appId, this.apiToken);
          }, delay);
        }
      };
    } catch (err: any) {
      console.warn('Deriv WebSocket initialization error:', err);
      this.connectionAttempt++;
      this.isConnecting = false;
      this.isConnected = false;
      this.startSimFallback();
    }
  }

  private subscribeToTicks() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      // Request real tick history
      this.ws.send(
        JSON.stringify({
          ticks_history: this.currentMarket.id,
          count: Math.min(this.ticksWindow, 1000),
          end: 'latest',
          style: 'ticks',
        })
      );

      // Subscribe to real live ticks
      this.ws.send(
        JSON.stringify({
          ticks: this.currentMarket.id,
          subscribe: 1,
        })
      );
    } catch (err) {
      console.warn('Error subscribing to ticks:', err);
    }
  }

  private handleDerivMessage(data: any) {
    if (!data) return;

    // Handle Proxy status notifications
    if (data.type === 'deriv_proxy_open') {
      this.isConnected = true;
      this.notifyStatus('connected', this.isLiveDeriv, `Connected via Deriv Cloud Relay (App ID ${this.appId})`);
      if (this.apiToken && this.apiToken.length > 0) {
        this.ws?.send(JSON.stringify({ authorize: this.apiToken }));
      } else {
        this.subscribeToTicks();
      }
      return;
    }

    if (data.type === 'deriv_proxy_closed') {
      this.notifyStatus('disconnected', false, data.message || 'Deriv remote endpoint reconnecting...');
      return;
    }

    // Handle Ping Response & Latency calculation
    if (data.msg_type === 'ping') {
      if (this.lastPingSentAt > 0) {
        this.latencyMs = Date.now() - this.lastPingSentAt;
      }
      return;
    }

    // Handle Deriv Error
    if (data.error) {
      console.warn('Deriv API response error:', data.error);
      const code = data.error.code || 'Error';
      const msg = data.error.message || 'Deriv error';

      // Token authorization failure
      if (code === 'InvalidToken' || code === 'AuthorizationRequired' || code === 'TokenExpired') {
        this.notifyStatus(
          'disconnected',
          false,
          `API Token Rejected: ${msg}. Please ensure your token has 'Read' and 'Trade' permissions at app.deriv.com/account/api-token`
        );
        // Do not enter infinite reconnect loop for bad token
        if (this.reconnectTimeoutId) {
          clearTimeout(this.reconnectTimeoutId);
          this.reconnectTimeoutId = null;
        }
        return;
      }

      // Symbol restricted in region or landing company
      if (code === 'OfferingsInvalidSymbol' || code === 'InvalidSymbol') {
        this.notifyStatus(
          this.isConnected ? 'connected' : 'disconnected',
          this.isLiveDeriv,
          `Notice: ${this.currentMarket.name} is restricted in this region or account landing company.`
        );
        this.startSimFallback();
        return;
      }

      this.notifyStatus(this.isConnected ? 'connected' : 'disconnected', this.isLiveDeriv, `${code}: ${msg}`);
      return;
    }

    // Handle Authorization Success
    if (data.msg_type === 'authorize' && data.authorize) {
      const auth = data.authorize;
      const accountInfo: DerivAccountInfo = {
        loginid: auth.loginid,
        balance: Number(auth.balance || 0),
        currency: auth.currency || 'USD',
        is_virtual: Boolean(auth.is_virtual),
        email: auth.email,
        scopes: auth.scopes || [],
      };
      this.accountListeners.forEach((l) => l(accountInfo));

      // Subscribe to real-time balance updates
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      }

      // Now subscribe to real ticks
      this.subscribeToTicks();

      this.notifyStatus(
        'connected',
        true,
        `Authorized as ${auth.loginid} (${auth.is_virtual ? 'Demo' : 'Real'}) - Balance: $${Number(auth.balance || 0).toFixed(2)} ${auth.currency || 'USD'}`
      );
      return;
    }

    // Handle Balance Subscription Update
    if (data.msg_type === 'balance' && data.balance) {
      const bal = Number(data.balance.balance);
      const curr = data.balance.currency || 'USD';
      this.balanceListeners.forEach((l) => l(bal, curr));
    }

    // Handle Real Tick History
    if (data.msg_type === 'history' && data.history) {
      const prices: number[] = data.history.prices || [];
      const times: number[] = data.history.times || [];
      if (prices.length > 0) {
        this.isLiveDeriv = true;
        this.stopSimFallback();

        const decimals = this.currentMarket.decimals;
        const parsedTicks: Tick[] = [];

        for (let i = 0; i < prices.length; i++) {
          const price = prices[i];
          const prevPrice = i > 0 ? prices[i - 1] : price;
          const diff = price - prevPrice;
          const formatted = price.toFixed(decimals);
          const lastChar = formatted.charAt(formatted.length - 1);
          const lastDigit = parseInt(lastChar, 10);
          const direction: 'up' | 'down' | 'flat' =
            Math.abs(diff) < this.currentMarket.pipSize * 0.1 ? 'flat' : diff > 0 ? 'up' : 'down';

          parsedTicks.push({
            epoch: (times[i] || Math.floor(Date.now() / 1000)) * 1000,
            quote: price,
            quoteFormatted: formatted,
            lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
            direction,
            change: diff,
          });
        }

        this.ticks = parsedTicks.slice(-this.ticksWindow);
        const last = this.ticks[this.ticks.length - 1];
        if (last) {
          this.currentPrice = last.quote;
        }
        this.notifyAll();
        this.notifyStatus('connected', true, 'Real Deriv Live Ticks Streaming');
      }
    }

    // Handle Real Live Tick Stream
    if (data.msg_type === 'tick' && data.tick) {
      const tickData = data.tick;
      if (tickData.symbol === this.currentMarket.id) {
        this.isLiveDeriv = true;
        this.stopSimFallback();

        const quote = Number(tickData.quote);
        const decimals = this.currentMarket.decimals;
        const formatted = quote.toFixed(decimals);
        const lastChar = formatted.charAt(formatted.length - 1);
        const lastDigit = parseInt(lastChar, 10);
        const prevPrice = this.currentPrice > 0 ? this.currentPrice : quote;
        const diff = quote - prevPrice;
        const direction: 'up' | 'down' | 'flat' =
          Math.abs(diff) < this.currentMarket.pipSize * 0.1 ? 'flat' : diff > 0 ? 'up' : 'down';

        this.currentPrice = quote;

        const newTick: Tick = {
          epoch: (tickData.epoch || Math.floor(Date.now() / 1000)) * 1000,
          quote,
          quoteFormatted: formatted,
          lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
          direction,
          change: diff,
        };

        this.addTick(newTick);
        this.notifyStatus('connected', true, 'Real Deriv Live Ticks Streaming');
      }
    }

    // Handle Buy Contract Response
    if (data.msg_type === 'buy') {
      if (data.buy && data.buy.contract_id) {
        const contractId = data.buy.contract_id;
        // Subscribe to open contract updates for settlement
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              proposal_open_contract: 1,
              contract_id: contractId,
              subscribe: 1,
            })
          );
        }
      }
    }

    // Handle Contract Settlement via Proposal Open Contract
    if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
      const poc = data.proposal_open_contract;
      if (poc.is_sold === 1) {
        const contractId = poc.contract_id;
        const status: 'won' | 'lost' = poc.status === 'won' ? 'won' : 'lost';
        const profit = Number(poc.profit || 0);
        const exitPrice = Number(poc.exit_tick || poc.current_spot || 0);
        const formatted = exitPrice.toFixed(this.currentMarket.decimals);
        const exitDigit = parseInt(formatted.charAt(formatted.length - 1), 10) || 0;
        const payout = Number(poc.payout || 0);

        const settlement: ContractSettlement = {
          contractId,
          status,
          profit,
          exitPrice,
          exitDigit,
          payout,
          raw: poc,
        };

        const resolver = this.activePendingContracts.get(contractId);
        if (resolver) {
          resolver(settlement);
          this.activePendingContracts.delete(contractId);
        }

        this.tradeSettledListeners.forEach((l) => l(settlement));
      }
    }
  }

  /**
   * Buy a real contract directly on Deriv exchange using the authorized WebSocket connection.
   */
  public buyContract(params: ContractBuyParams): Promise<ContractSettlement> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('Deriv WebSocket is not connected.'));
      }
      if (!this.apiToken) {
        return reject(new Error('Deriv API token is required for live trading.'));
      }

      let contract_type: string = 'DIGITOVER';
      let barrier: string | undefined = params.predictionDigit !== undefined ? String(params.predictionDigit) : undefined;

      switch (params.contractType) {
        case 'OVER':
          contract_type = 'DIGITOVER';
          barrier = String(params.predictionDigit ?? 2);
          break;
        case 'UNDER':
          contract_type = 'DIGITUNDER';
          barrier = String(params.predictionDigit ?? 5);
          break;
        case 'DIFFERS':
          contract_type = 'DIGITDIFF';
          barrier = String(params.predictionDigit ?? 5);
          break;
        case 'MATCHES':
          contract_type = 'DIGITMATCH';
          barrier = String(params.predictionDigit ?? 5);
          break;
        case 'EVEN':
          contract_type = 'DIGITEVEN';
          barrier = undefined;
          break;
        case 'ODD':
          contract_type = 'DIGITODD';
          barrier = undefined;
          break;
        case 'RISE':
          contract_type = 'CALL';
          barrier = undefined;
          break;
        case 'FALL':
          contract_type = 'PUT';
          barrier = undefined;
          break;
        case 'HIGHER':
          contract_type = 'HIGHER';
          barrier = '+0.1';
          break;
        case 'LOWER':
          contract_type = 'LOWER';
          barrier = '-0.1';
          break;
        default:
          contract_type = 'DIGITOVER';
          barrier = '2';
      }

      const reqId = Date.now();
      const buyPayload: any = {
        buy: 1,
        price: params.stake,
        parameters: {
          amount: params.stake,
          basis: 'stake',
          contract_type,
          currency: params.currency || 'USD',
          duration: params.duration || 1,
          duration_unit: params.durationUnit || 't',
          symbol: params.symbol || this.currentMarket.id,
        },
        req_id: reqId,
      };

      if (barrier !== undefined) {
        buyPayload.parameters.barrier = barrier;
      }

      const messageHandler = (event: MessageEvent) => {
        try {
          const resp = JSON.parse(event.data);
          if (resp.req_id === reqId || (resp.msg_type === 'buy' && !resp.req_id)) {
            this.ws?.removeEventListener('message', messageHandler);

            if (resp.error) {
              return reject(new Error(resp.error.message || 'Deriv buy contract rejected'));
            }

            if (resp.buy && resp.buy.contract_id) {
              const contractId = resp.buy.contract_id;
              this.activePendingContracts.set(contractId, resolve);
            }
          }
        } catch {}
      };

      this.ws.addEventListener('message', messageHandler);

      try {
        this.ws.send(JSON.stringify(buyPayload));
      } catch (err: any) {
        this.ws.removeEventListener('message', messageHandler);
        reject(err);
      }
    });
  }

  private notifyStatus(status: ConnectionStatus, isLiveDeriv: boolean, info?: string) {
    this.statusListeners.forEach((l) => l(status, isLiveDeriv, info));
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

  // Realistic simulation fallback when network is connecting or disconnected
  private startSimFallback() {
    if (this.simIntervalId || this.isLiveDeriv) return;

    this.simIntervalId = setInterval(() => {
      if (this.isLiveDeriv) {
        this.stopSimFallback();
        return;
      }
      const newTick = this.generateNextSimTick();
      this.addTick(newTick);
    }, 1000);
  }

  private stopSimFallback() {
    if (this.simIntervalId) {
      clearInterval(this.simIntervalId);
      this.simIntervalId = null;
    }
  }

  private generateNextSimTick(): Tick {
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
      const t = this.generateNextSimTick();
      this.ticks.push(t);
    }
  }

  private cleanupWebSocket() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
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
    this.stopSimFallback();
    this.cleanupWebSocket();
    this.listeners.clear();
    this.statusListeners.clear();
    this.accountListeners.clear();
    this.balanceListeners.clear();
    this.tradeSettledListeners.clear();
  }
}
