import { Market, TradeContractType } from '../types';
import { SYNTHETIC_MARKETS } from './markets';

export type SignalCategory = 'even_odd' | 'over_under' | 'digit_match';

export interface MarketSignalSnapshot {
  market: Market;
  isLiveWs: boolean;
  lastDigit: number;
  lastQuote: string;
  recentDigits: number[];
  windowTickCount: number;
  isScanning: boolean;
  scanSecondsLeft: number;
  // Computed stats
  evenPct: number;
  oddPct: number;
  overPct: number;
  underPct: number;
  hotDigit: number;
  hotDigitPct: number;
  coldDigit: number;
  coldDigitPct: number;
  // Recommended Signal for the given category
  signalLabel: string;
  signalTone: 'emerald' | 'fuchsia' | 'sky' | 'amber';
  contractType: TradeContractType;
  prediction: number;
  entryConfidencePct: number;
  distributionSubtext: string;
  hasStrongEdge: boolean;
}

const SIGNAL_MARKET_IDS = [
  'R_10',
  'R_25',
  'R_50',
  'R_75',
  'R_100',
  '1HZ10V',
  '1HZ25V',
  '1HZ50V',
  '1HZ75V',
  '1HZ100V',
  'stp_index_100',
  'JD50',
];

export const SIGNAL_MARKETS: Market[] = SIGNAL_MARKET_IDS.map((id) =>
  SYNTHETIC_MARKETS.find((m) => m.id === id)
).filter((m): m is Market => Boolean(m));

interface InternalMarketState {
  market: Market;
  digits: number[];
  lastPrice: number;
  lastQuote: string;
  isLiveWs: boolean;
  lastWsEpoch: number;
  phaseOffsetSec: number;
}

const SCAN_WINDOW_SEC = 17;
const SIGNAL_HOLD_SEC = 25;
const FULL_CYCLE_SEC = SCAN_WINDOW_SEC + SIGNAL_HOLD_SEC; // 42s cycle

export class MultiMarketSignalScanner {
  private states = new Map<string, InternalMarketState>();
  private ws: WebSocket | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;
  private isConnected = false;
  private listeners = new Set<() => void>();

  private endpoints = [
    'wss://ws.derivws.com/websockets/v3',
    'wss://blue.derivws.com/websockets/v3',
    'wss://green.derivws.com/websockets/v3',
  ];
  private endpointIdx = 0;

  constructor() {
    SIGNAL_MARKETS.forEach((market, idx) => {
      // Seed 16 realistic initial digits so cards are immediately populated
      const seededDigits: number[] = [];
      let price = market.basePrice;
      for (let i = 0; i < 16; i++) {
        const delta = (Math.random() - 0.5) * market.volatility * price;
        price = Math.max(1, price + delta);
        const formatted = price.toFixed(market.decimals);
        const d = parseInt(formatted.charAt(formatted.length - 1), 10) || 0;
        seededDigits.push(d);
      }

      // Stagger scan phases so ~1/3 of markets are actively scanning while ~2/3 display live signals
      const phaseOffsetSec = (idx * 11) % FULL_CYCLE_SEC;

      this.states.set(market.id, {
        market,
        digits: seededDigits,
        lastPrice: price,
        lastQuote: price.toFixed(market.decimals),
        isLiveWs: false,
        lastWsEpoch: 0,
        phaseOffsetSec,
      });
    });

    this.connectWebSocket();
    this.startHeartbeat();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  private extractLastDigit(quote: number, decimals: number): { formatted: string; digit: number } {
    const formatted = Number(quote).toFixed(decimals);
    const digit = parseInt(formatted.charAt(formatted.length - 1), 10);
    return { formatted, digit: Number.isNaN(digit) ? 0 : digit };
  }

  private connectWebSocket() {
    if (this.isDestroyed) return;
    let appId = '1089';
    try {
      appId = localStorage.getItem('tickedge_deriv_app_id') || '1089';
    } catch {}

    const url = `${this.endpoints[this.endpointIdx % this.endpoints.length]}?app_id=${appId}`;
    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.isDestroyed) {
          ws.close();
          return;
        }
        this.isConnected = true;
        // Request recent tick history + live stream for each signal market
        SIGNAL_MARKETS.forEach((m) => {
          try {
            ws.send(
              JSON.stringify({
                ticks_history: m.id,
                adjust_start_time: 1,
                count: 25,
                end: 'latest',
                start: 1,
                style: 'ticks',
                subscribe: 1,
              })
            );
          } catch {}
        });
        this.notify();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'history' && data.echo_req?.ticks_history) {
            const sym = String(data.echo_req.ticks_history);
            const st = this.states.get(sym);
            const prices: number[] = data.history?.prices || [];
            if (st && prices.length > 0) {
              const extracted = prices.map(
                (p) => this.extractLastDigit(Number(p), st.market.decimals).digit
              );
              const lastP = Number(prices[prices.length - 1]);
              const lastInfo = this.extractLastDigit(lastP, st.market.decimals);
              st.digits = extracted.slice(-30);
              st.lastPrice = lastP;
              st.lastQuote = lastInfo.formatted;
              st.isLiveWs = true;
              st.lastWsEpoch = Date.now();
              this.notify();
            }
          } else if (data.msg_type === 'tick' && data.tick) {
            const sym = String(data.tick.symbol);
            const st = this.states.get(sym);
            if (st && data.tick.quote !== undefined) {
              const quoteNum = Number(data.tick.quote);
              const pipSize =
                typeof data.tick.pip_size === 'number' ? data.tick.pip_size : st.market.decimals;
              const { formatted, digit } = this.extractLastDigit(quoteNum, pipSize);
              st.digits = [...st.digits.slice(-29), digit];
              st.lastPrice = quoteNum;
              st.lastQuote = formatted;
              st.isLiveWs = true;
              st.lastWsEpoch = Date.now();
              this.notify();
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        this.isConnected = false;
        if (!this.isDestroyed) {
          this.endpointIdx += 1;
          this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 3500);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
    } catch {
      if (!this.isDestroyed) {
        this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 4000);
      }
    }
  }

  private startHeartbeat() {
    this.tickTimer = setInterval(() => {
      if (this.isDestroyed) return;
      const now = Date.now();
      // Fallback synthetic tick progression ONLY for any market that hasn't received a WS tick in >3.5s
      this.states.forEach((st) => {
        if (!st.isLiveWs || now - st.lastWsEpoch > 3500) {
          const delta = (Math.random() - 0.5) * st.market.volatility * st.lastPrice;
          const nextPrice = Math.max(1, st.lastPrice + delta);
          const { formatted, digit } = this.extractLastDigit(nextPrice, st.market.decimals);
          st.lastPrice = nextPrice;
          st.lastQuote = formatted;
          st.digits = [...st.digits.slice(-29), digit];
        }
      });
      this.notify();
    }, 1000);
  }

  public getSnapshots(category: SignalCategory, overUnderBarrier: number = 4): MarketSignalSnapshot[] {
    const nowSec = Math.floor(Date.now() / 1000);

    return SIGNAL_MARKETS.map((market) => {
      const st = this.states.get(market.id)!;
      const windowDigits = st.digits.slice(-20);
      const total = Math.max(1, windowDigits.length);

      let evenCount = 0;
      let overCount = 0;
      let underCount = 0;
      const counts = new Array<number>(10).fill(0);

      for (const d of windowDigits) {
        if (d % 2 === 0) evenCount++;
        if (d > overUnderBarrier) overCount++;
        if (d < overUnderBarrier) underCount++;
        counts[d] = (counts[d] || 0) + 1;
      }

      const evenPct = Math.round((evenCount / total) * 100);
      const oddPct = 100 - evenPct;
      const overPct = Math.round((overCount / total) * 100);
      const underPct = Math.round((underCount / total) * 100);

      let hotDigit = 0;
      let coldDigit = 0;
      for (let d = 1; d <= 9; d++) {
        if (counts[d] > counts[hotDigit]) hotDigit = d;
        if (counts[d] < counts[coldDigit]) coldDigit = d;
      }
      const hotDigitPct = Math.round((counts[hotDigit] / total) * 100);
      const coldDigitPct = Math.round((counts[coldDigit] / total) * 100);

      // Compute scanning cycle timer
      const cyclePos = (nowSec + st.phaseOffsetSec) % FULL_CYCLE_SEC;
      const rawScanning = cyclePos < SCAN_WINDOW_SEC;
      const scanSecondsLeft = rawScanning ? SCAN_WINDOW_SEC - cyclePos : 0;

      let signalLabel = 'EVEN';
      let signalTone: MarketSignalSnapshot['signalTone'] = 'emerald';
      let contractType: TradeContractType = 'EVEN';
      let prediction = 0;
      let entryConfidencePct = 55;
      let distributionSubtext = `${evenPct}% even · ${oddPct}% odd`;
      let hasStrongEdge = false;

      if (category === 'even_odd') {
        if (evenPct >= oddPct) {
          signalLabel = 'EVEN';
          signalTone = 'emerald';
          contractType = 'EVEN';
          entryConfidencePct = Math.max(55, evenPct);
        } else {
          signalLabel = 'ODD';
          signalTone = 'fuchsia';
          contractType = 'ODD';
          entryConfidencePct = Math.max(55, oddPct);
        }
        hasStrongEdge = Math.max(evenPct, oddPct) >= 55;
        distributionSubtext = `${evenPct}% even · ${oddPct}% odd`;
      } else if (category === 'over_under') {
        if (overPct >= underPct) {
          signalLabel = `OVER ${overUnderBarrier}`;
          signalTone = 'emerald';
          contractType = 'OVER';
          prediction = overUnderBarrier;
          entryConfidencePct = Math.max(55, overPct);
        } else {
          signalLabel = `UNDER ${overUnderBarrier}`;
          signalTone = 'fuchsia';
          contractType = 'UNDER';
          prediction = overUnderBarrier;
          entryConfidencePct = Math.max(55, underPct);
        }
        hasStrongEdge = Math.max(overPct, underPct) >= 50;
        distributionSubtext = `${overPct}% over ${overUnderBarrier} · ${underPct}% under ${overUnderBarrier}`;
      } else {
        // Digit Match
        signalLabel = `MATCH ${hotDigit}`;
        signalTone = 'sky';
        contractType = 'MATCHES';
        prediction = hotDigit;
        entryConfidencePct = Math.max(15, hotDigitPct);
        hasStrongEdge = hotDigitPct >= 15;
        distributionSubtext = `Digit ${hotDigit}: ${hotDigitPct}% · Least #${coldDigit}: ${coldDigitPct}%`;
      }

      const isScanning = rawScanning && ! (hasStrongEdge && cyclePos > 10);

      return {
        market,
        isLiveWs: st.isLiveWs,
        lastDigit: st.digits[st.digits.length - 1] ?? 0,
        lastQuote: st.lastQuote,
        recentDigits: st.digits.slice(-12),
        windowTickCount: Math.min(st.digits.length, 12),
        isScanning,
        scanSecondsLeft: Math.max(1, scanSecondsLeft),
        evenPct,
        oddPct,
        overPct,
        underPct,
        hotDigit,
        hotDigitPct,
        coldDigit,
        coldDigitPct,
        signalLabel,
        signalTone,
        contractType,
        prediction,
        entryConfidencePct,
        distributionSubtext,
        hasStrongEdge,
      };
    });
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }
}
