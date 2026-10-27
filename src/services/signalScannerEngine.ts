import { Market, SignalEntryTrigger, TradeContractType } from '../types';
import { SYNTHETIC_MARKETS } from './markets';

export type SignalCategory =
  | 'even_odd'
  | 'over_under'
  | 'digit_match'
  | 'only_up_down'
  | 'high_low_tick';
export type BarrierFilter = 'all' | 2 | 3 | 4 | 5 | 6 | 7;

export interface DigitBarrierStat {
  digit: number;
  overPct: number;
  underPct: number;
}

export interface Candle2m {
  epoch: number; // 120-second candle open timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Candle5m {
  epoch: number; // 300-second candle open timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Market5mAnalysisSummary {
  market: Market;
  rsi5m: number;
  open: number;
  high: number;
  low: number;
  close: number;
  upperWick: number;
  lowerWick: number;
  hasBothWicks: boolean;
  secondsLeft: number;
  noTradeWindow: boolean;
  candleDirection: 'bullish' | 'bearish' | 'neutral';
}

export interface MarketSignalSnapshot {
  category: SignalCategory;
  market: Market;
  isLiveWs: boolean;
  lastDigit: number;
  lastQuote: string;
  recentDigits: number[];
  recentDirections?: ('up' | 'down' | 'flat')[];
  candle2mDirection?: 'bullish' | 'bearish' | 'neutral';
  candle5mDirection?: 'bullish' | 'bearish' | 'neutral';
  rsi5m?: number;
  candle5mHasBothWicks?: boolean;
  candle5mSecondsLeft?: number;
  marketTrend?: 'uptrend' | 'downtrend' | 'ranging';
  marketTrendSummary?: string;
  recentWindowWinners?: number[];
  highLowBreakdownSummary?: string;
  windowTickCount: number;
  isScanning: boolean;
  scanSecondsLeft: number;
  scanStatusNote: string;
  // Computed stats
  evenPct: number;
  oddPct: number;
  overPct: number;
  underPct: number;
  hotDigit: number;
  hotDigitPct: number;
  coldDigit: number;
  coldDigitPct: number;
  // Allowed barrier breakdown
  barrierStats: DigitBarrierStat[];
  // Recommended Signal for the given category
  signalLabel: string;
  signalTone: 'emerald' | 'fuchsia' | 'sky' | 'amber';
  contractType: TradeContractType;
  prediction: number;
  signalEntryTrigger: SignalEntryTrigger;
  entryConfirmedNow: boolean;
  entryConfidencePct: number;
  payoutMultiplier: number;
  edgeDeltaPct: number;
  distributionSubtext: string;
  patternSummary: string;
  topBarriersSummary: string;
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

/**
 * Allowed Over barriers ONLY: 4, 5, 6, 7
 * Required minimum Over %:
 * - OVER 4: 53%
 * - OVER 5: 45%
 * - OVER 6: 35%
 * - OVER 7: 30%
 */
export const OVER_BARRIER_THRESHOLDS: Record<number, number> = {
  4: 53,
  5: 45,
  6: 35,
  7: 30,
};

/**
 * Allowed Under barriers ONLY: 5, 4, 3, 2
 * Required minimum Under %:
 * - UNDER 5: 53%
 * - UNDER 4: 45%
 * - UNDER 3: 35%
 * - UNDER 2: 30%
 */
export const UNDER_BARRIER_THRESHOLDS: Record<number, number> = {
  5: 53,
  4: 45,
  3: 35,
  2: 30,
};

interface LockedParityPick {
  cycleId: number;
  contractType: 'EVEN' | 'ODD';
  lockedPct: number;
  lockedMomentum: number;
}

interface LockedOverUnderPick {
  cycleId: number;
  barrierFilterKey: string;
  contractType: 'OVER' | 'UNDER';
  barrier: number;
}

interface LockedMatchPick {
  cycleId: number;
  digit: number;
}

interface LockedOnlyUpDownPick {
  candleEpoch: number;
  contractType: 'ONLY_UP' | 'ONLY_DOWN';
  peakMomentumPct: number;
}

interface LockedHighLowTickPick {
  candleEpoch: number;
  contractType: 'HIGH_TICK' | 'LOW_TICK';
  targetTick: number;
}

interface InternalMarketState {
  market: Market;
  digits: number[];
  prices: number[];
  candles2m: Candle2m[];
  candles5m: Candle5m[];
  lastPrice: number;
  lastQuote: string;
  isLiveWs: boolean;
  lastWsEpoch: number;
  parityPhaseOffsetSec: number;
  overUnderPhaseOffsetSec: number;
  matchPhaseOffsetSec: number;
  highLowTickPhaseOffsetSec: number;
  lockedParity?: LockedParityPick;
  lockedOverUnder?: LockedOverUnderPick;
  lockedMatch?: LockedMatchPick;
  lockedOnlyUpDown?: LockedOnlyUpDownPick;
  lockedHighLowTick?: LockedHighLowTickPick;
}

interface BarrierCandidateEvaluation {
  contractType: 'OVER' | 'UNDER';
  barrier: number;
  winPct: number;
  requiredPct: number;
  meetsThreshold: boolean;
  baselinePct: number;
  edgeDeltaPct: number;
  payoutMultiplier: number;
  evPct: number;
  markovWinPct: number;
  confidencePct: number;
  patternName: string;
  compositeScore: number;
}

const SCAN_WINDOW_SEC = 15;
const SIGNAL_HOLD_SEC = 45;
const FULL_CYCLE_SEC = SCAN_WINDOW_SEC + SIGNAL_HOLD_SEC;

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
  private startedAtSec = Math.floor(Date.now() / 1000);

  constructor() {
    const nowSec = Math.floor(Date.now() / 1000);
    const currentBucketEpoch = Math.floor(nowSec / 120) * 120;
    const current5mBucketEpoch = Math.floor(nowSec / 300) * 300;

    SIGNAL_MARKETS.forEach((market, idx) => {
      // Seed 20 prior 2-minute candlesticks + active 2-minute candlestick and trailing 101 ticks
      const seededCandles: Candle2m[] = [];
      const seededCandles5m: Candle5m[] = [];
      const allSeededQuotes: number[] = [];
      const allSeededDigits: number[] = [];
      let price5m = market.basePrice;

      // Seed 30 5-minute candlesticks (for Wilder's RSI-14 + live 5m upper/lower wicks)
      for (let c5 = 29; c5 >= 0; c5--) {
        const bucket5m = current5mBucketEpoch - c5 * 300;
        const steps5m =
          c5 === 0 ? Math.max(18, Math.min(90, nowSec - current5mBucketEpoch)) : 60;
        const waveBias = Math.sin(idx * 1.15 + c5 * 0.32) * 0.08;
        const open5m = Number(price5m.toFixed(market.decimals));
        let high5m = open5m;
        let low5m = open5m;
        let close5m = open5m;

        for (let s = 0; s < steps5m; s++) {
          const swingPhase = s < steps5m * 0.35 ? -0.14 : s < steps5m * 0.7 ? 0.14 : waveBias;
          const delta = (Math.random() - 0.5 + swingPhase) * market.volatility * price5m;
          price5m = Math.max(1, price5m + delta);
          const numericQuote = Number(price5m.toFixed(market.decimals));
          high5m = Math.max(high5m, numericQuote);
          low5m = Math.min(low5m, numericQuote);
          close5m = numericQuote;
        }

        seededCandles5m.push({
          epoch: bucket5m,
          open: open5m,
          high: high5m,
          low: low5m,
          close: close5m,
        });
      }

      let price = seededCandles5m[seededCandles5m.length - 1]?.open ?? market.basePrice;

      for (let cIdx = 20; cIdx >= 0; cIdx--) {
        const bucketEpoch = currentBucketEpoch - cIdx * 120;
        const stepsInCandle = cIdx === 0 ? Math.max(12, Math.min(60, nowSec - currentBucketEpoch)) : 45;
        const driftBias = Math.sin(idx * 1.35 + cIdx * 0.16) * 0.11;
        const candleOpen = Number(price.toFixed(market.decimals));
        let candleHigh = candleOpen;
        let candleLow = candleOpen;
        let candleClose = candleOpen;

        for (let s = 0; s < stepsInCandle; s++) {
          const delta = (Math.random() - 0.5 + driftBias) * market.volatility * price;
          price = Math.max(1, price + delta);
          const formatted = price.toFixed(market.decimals);
          const numericQuote = Number(formatted);
          const d = parseInt(formatted.charAt(formatted.length - 1), 10) || 0;
          candleHigh = Math.max(candleHigh, numericQuote);
          candleLow = Math.min(candleLow, numericQuote);
          candleClose = numericQuote;
          allSeededQuotes.push(numericQuote);
          allSeededDigits.push(d);
        }

        seededCandles.push({
          epoch: bucketEpoch,
          open: candleOpen,
          high: candleHigh,
          low: candleLow,
          close: candleClose,
        });
      }

      const seededDigits = allSeededDigits.slice(-100);
      const seededPrices = allSeededQuotes.slice(-101);
      const finalQuote = seededPrices[seededPrices.length - 1] ?? market.basePrice;

      // Sync active 5m candle close/high/low with finalQuote
      const last5m = seededCandles5m[seededCandles5m.length - 1];
      if (last5m) {
        last5m.high = Math.max(last5m.high, finalQuote);
        last5m.low = Math.min(last5m.low, finalQuote);
        last5m.close = finalQuote;
      }

      const parityPhaseOffsetSec = (idx * 9) % FULL_CYCLE_SEC;
      const overUnderPhaseOffsetSec = (idx * 13 + 7) % FULL_CYCLE_SEC;
      const matchPhaseOffsetSec = (idx * 11 + 19) % FULL_CYCLE_SEC;
      const highLowTickPhaseOffsetSec = (idx * 7 + 23) % FULL_CYCLE_SEC;

      this.states.set(market.id, {
        market,
        digits: seededDigits,
        prices: seededPrices,
        candles2m: seededCandles,
        candles5m: seededCandles5m,
        lastPrice: finalQuote,
        lastQuote: finalQuote.toFixed(market.decimals),
        isLiveWs: false,
        lastWsEpoch: 0,
        parityPhaseOffsetSec,
        overUnderPhaseOffsetSec,
        matchPhaseOffsetSec,
        highLowTickPhaseOffsetSec,
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

  private upsertCandleFromTick(st: InternalMarketState, quoteNum: number, epochSec: number) {
    // 1. Update 2-minute candle (120s)
    const bucketEpoch2m = Math.floor(epochSec / 120) * 120;
    const candles2m = st.candles2m;
    const last2m = candles2m[candles2m.length - 1];
    if (last2m && last2m.epoch === bucketEpoch2m) {
      last2m.high = Math.max(last2m.high, quoteNum);
      last2m.low = Math.min(last2m.low, quoteNum);
      last2m.close = quoteNum;
    } else if (!last2m || bucketEpoch2m > last2m.epoch) {
      const openPrice = last2m ? last2m.close : quoteNum;
      st.candles2m = [
        ...candles2m.slice(-24),
        {
          epoch: bucketEpoch2m,
          open: openPrice,
          high: Math.max(openPrice, quoteNum),
          low: Math.min(openPrice, quoteNum),
          close: quoteNum,
        },
      ];
    }

    // 2. Update 5-minute candle (300s)
    const bucketEpoch5m = Math.floor(epochSec / 300) * 300;
    const candles5m = st.candles5m;
    const last5m = candles5m[candles5m.length - 1];
    if (last5m && last5m.epoch === bucketEpoch5m) {
      last5m.high = Math.max(last5m.high, quoteNum);
      last5m.low = Math.min(last5m.low, quoteNum);
      last5m.close = quoteNum;
    } else if (!last5m || bucketEpoch5m > last5m.epoch) {
      const openPrice = last5m ? last5m.close : quoteNum;
      st.candles5m = [
        ...candles5m.slice(-34),
        {
          epoch: bucketEpoch5m,
          open: openPrice,
          high: Math.max(openPrice, quoteNum),
          low: Math.min(openPrice, quoteNum),
          close: quoteNum,
        },
      ];
    }
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
        SIGNAL_MARKETS.forEach((m) => {
          try {
            // 1. Subscribe to live ticks (100-tick history + real-time tick stream)
            ws.send(
              JSON.stringify({
                ticks_history: m.id,
                adjust_start_time: 1,
                count: 100,
                end: 'latest',
                start: 1,
                style: 'ticks',
                subscribe: 1,
              })
            );
            // 2. Subscribe to live 2-minute OHLC candlesticks (granularity: 120s, 25 candles = 50m trend + momentum)
            ws.send(
              JSON.stringify({
                ticks_history: m.id,
                adjust_start_time: 1,
                count: 25,
                end: 'latest',
                start: 1,
                style: 'candles',
                granularity: 120,
                subscribe: 1,
              })
            );
            // 3. Subscribe to live 5-minute OHLC candlesticks (granularity: 300s, 35 candles for 5m RSI(14) + Wicks)
            ws.send(
              JSON.stringify({
                ticks_history: m.id,
                adjust_start_time: 1,
                count: 35,
                end: 'latest',
                start: 1,
                style: 'candles',
                granularity: 300,
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
              st.digits = extracted.slice(-100);
              st.prices = prices.map((p) => Number(p)).slice(-101);
              st.lastPrice = lastP;
              st.lastQuote = lastInfo.formatted;
              st.isLiveWs = true;
              st.lastWsEpoch = Date.now();
              this.notify();
            }
          } else if (data.msg_type === 'candles' && data.echo_req?.ticks_history) {
            const sym = String(data.echo_req.ticks_history);
            const granularity = Number(data.echo_req.granularity) || 120;
            const st = this.states.get(sym);
            const rawCandles: Array<{
              epoch: number;
              open: string | number;
              high: string | number;
              low: string | number;
              close: string | number;
            }> = data.candles || [];
            if (st && rawCandles.length > 0) {
              if (granularity === 300) {
                st.candles5m = rawCandles
                  .map((c) => ({
                    epoch: Math.floor(Number(c.epoch) / 300) * 300,
                    open: Number(c.open),
                    high: Number(c.high),
                    low: Number(c.low),
                    close: Number(c.close),
                  }))
                  .slice(-35);
              } else {
                st.candles2m = rawCandles
                  .map((c) => ({
                    epoch: Math.floor(Number(c.epoch) / 120) * 120,
                    open: Number(c.open),
                    high: Number(c.high),
                    low: Number(c.low),
                    close: Number(c.close),
                  }))
                  .slice(-25);
              }
              st.isLiveWs = true;
              st.lastWsEpoch = Date.now();
              this.notify();
            }
          } else if (data.msg_type === 'ohlc' && data.ohlc) {
            const sym = String(data.ohlc.symbol);
            const granularity = Number(data.ohlc.granularity) || 120;
            const st = this.states.get(sym);
            if (st) {
              if (granularity === 300) {
                const openEpoch =
                  Math.floor(Number(data.ohlc.open_time || data.ohlc.epoch) / 300) * 300;
                const nextCandle: Candle5m = {
                  epoch: openEpoch,
                  open: Number(data.ohlc.open),
                  high: Number(data.ohlc.high),
                  low: Number(data.ohlc.low),
                  close: Number(data.ohlc.close),
                };
                const last = st.candles5m[st.candles5m.length - 1];
                if (last && last.epoch === openEpoch) {
                  st.candles5m[st.candles5m.length - 1] = nextCandle;
                } else if (!last || openEpoch > last.epoch) {
                  st.candles5m = [...st.candles5m.slice(-34), nextCandle];
                }
              } else {
                const openEpoch =
                  Math.floor(Number(data.ohlc.open_time || data.ohlc.epoch) / 120) * 120;
                const nextCandle: Candle2m = {
                  epoch: openEpoch,
                  open: Number(data.ohlc.open),
                  high: Number(data.ohlc.high),
                  low: Number(data.ohlc.low),
                  close: Number(data.ohlc.close),
                };
                const last = st.candles2m[st.candles2m.length - 1];
                if (last && last.epoch === openEpoch) {
                  st.candles2m[st.candles2m.length - 1] = nextCandle;
                } else if (!last || openEpoch > last.epoch) {
                  st.candles2m = [...st.candles2m.slice(-24), nextCandle];
                }
              }
              st.isLiveWs = true;
              st.lastWsEpoch = Date.now();
              this.notify();
            }
          } else if (data.msg_type === 'tick' && data.tick) {
            const sym = String(data.tick.symbol);
            const st = this.states.get(sym);
            if (st && data.tick.quote !== undefined) {
              const quoteNum = Number(data.tick.quote);
              const epochSec = Number(data.tick.epoch) || Math.floor(Date.now() / 1000);
              const pipSize =
                typeof data.tick.pip_size === 'number' ? data.tick.pip_size : st.market.decimals;
              const { formatted, digit } = this.extractLastDigit(quoteNum, pipSize);
              st.digits = [...st.digits.slice(-99), digit];
              st.prices = [...st.prices.slice(-100), quoteNum];
              this.upsertCandleFromTick(st, quoteNum, epochSec);
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
      const nowSec = Math.floor(now / 1000);
      this.states.forEach((st) => {
        if (!st.isLiveWs || now - st.lastWsEpoch > 3500) {
          const delta = (Math.random() - 0.5) * st.market.volatility * st.lastPrice;
          const nextPrice = Math.max(1, st.lastPrice + delta);
          const { formatted, digit } = this.extractLastDigit(nextPrice, st.market.decimals);
          const numericQuote = Number(formatted);
          st.lastPrice = nextPrice;
          st.lastQuote = formatted;
          st.digits = [...st.digits.slice(-99), digit];
          st.prices = [...st.prices.slice(-100), numericQuote];
          this.upsertCandleFromTick(st, numericQuote, nowSec);
        }
      });
      this.notify();
    }, 1000);
  }

  /**
   * Evaluates allowed Over/Under barrier candidates:
   * - OVER 4 (>=53%), OVER 5 (>=45%), OVER 6 (>=35%), OVER 7 (>=30%)
   * - UNDER 5 (>=53%), UNDER 4 (>=45%), UNDER 3 (>=35%), UNDER 2 (>=30%)
   * Combines threshold qualification, Markov transition probability, Expected Value, and live digit patterns.
   */
  private evaluateBarrierCandidate(
    digits: number[],
    contractType: 'OVER' | 'UNDER',
    barrier: number,
    requiredPct: number
  ): BarrierCandidateEvaluation {
    // 100-tick window gives exact 1% resolution so 53%, 45%, 35%, 30% thresholds evaluate precisely
    const evalWindow = digits.slice(-100);
    const shortWindow = digits.slice(-25);
    const nEval = Math.max(1, evalWindow.length);
    const nShort = Math.max(1, shortWindow.length);

    const isWin = (d: number) => (contractType === 'OVER' ? d > barrier : d < barrier);

    const winningDigitsCount = contractType === 'OVER' ? Math.max(1, 9 - barrier) : Math.max(1, barrier);
    const baselineProb = winningDigitsCount / 10;
    const payoutMultiplier = Number((9.5 / winningDigitsCount).toFixed(2));

    let evalWins = 0;
    for (const d of evalWindow) {
      if (isWin(d)) evalWins++;
    }
    let shortWins = 0;
    for (const d of shortWindow) {
      if (isWin(d)) shortWins++;
    }

    const winProb = evalWins / nEval;
    const winPct = Math.round(winProb * 100);
    const shortProb = shortWins / nShort;
    const meetsThreshold = winPct >= requiredPct;

    const edgeDelta = winProb - baselineProb;
    const ev = winProb * payoutMultiplier - 1;

    // First-order Markov transition P(win_{t+1} | d_t == lastDigit)
    const lastDigit = digits[digits.length - 1] ?? 0;
    let markovSamples = 0;
    let markovWins = 0;
    for (let i = 0; i < digits.length - 1; i++) {
      if (digits[i] === lastDigit) {
        markovSamples++;
        if (isWin(digits[i + 1])) markovWins++;
      }
    }
    const markovProb =
      markovSamples >= 2 ? (markovWins + winProb * 2) / (markovSamples + 2) : winProb;

    // Trailing Streak & Identifiable Digit Patterns
    let lossStreak = 0;
    for (let i = digits.length - 1; i >= 0; i--) {
      if (!isWin(digits[i])) lossStreak++;
      else break;
    }

    let winStreak = 0;
    for (let i = digits.length - 1; i >= 0; i--) {
      if (isWin(digits[i])) winStreak++;
      else break;
    }

    const d1 = digits[digits.length - 1] ?? 0;
    const d2 = digits[digits.length - 2] ?? d1;
    const d3 = digits[digits.length - 3] ?? d2;
    const d4 = digits[digits.length - 4] ?? d3;

    const isAscendingStep = d3 < d2 && d2 < d1;
    const isDescendingStep = d3 > d2 && d2 > d1;
    const isPingPongFlip =
      digits.length >= 4 && isWin(d4) && !isWin(d3) && isWin(d2) && !isWin(d1);
    const isTwinLosingRepeat = digits.length >= 2 && d1 === d2 && !isWin(d1);

    let patternScore = 0;
    let patternName = '';

    if (lossStreak >= 2) {
      patternScore += 1.35 + Math.min(0.8, lossStreak * 0.2);
      patternName =
        contractType === 'OVER'
          ? `${lossStreak}x ≤${barrier} Streak Bounce`
          : `${lossStreak}x ≥${barrier} Exhaustion`;
    } else if (isPingPongFlip) {
      patternScore += 1.15;
      patternName = `Alternating Flip @ #${barrier}`;
    } else if (isTwinLosingRepeat) {
      patternScore += 1.05;
      patternName = `Twin #${d1} Reversal`;
    } else if (contractType === 'OVER' && isAscendingStep && d1 >= barrier - 1) {
      patternScore += 1.0;
      patternName = `Ascending Ladder ${d3}→${d2}→${d1}`;
    } else if (contractType === 'UNDER' && isDescendingStep && d1 <= barrier + 1) {
      patternScore += 1.0;
      patternName = `Descending Step ${d3}→${d2}→${d1}`;
    } else if (shortProb > winProb) {
      patternScore += 0.85;
      patternName =
        contractType === 'OVER'
          ? `Rising Over #${barrier} Momentum`
          : `Rising Under #${barrier} Momentum`;
    } else if (winStreak >= 2) {
      patternScore += 0.7;
      patternName =
        contractType === 'OVER'
          ? `Upper Zone Flow (${winStreak}x)`
          : `Lower Zone Flow (${winStreak}x)`;
    } else {
      patternName = `${contractType === 'OVER' ? 'Over' : 'Under'} #${barrier} Threshold Met`;
    }

    const thresholdSurplus = (winPct - requiredPct) / 10;
    const momentumLift = shortProb - winProb;
    const compositeScore =
      (meetsThreshold ? 10 : 0) +
      thresholdSurplus * 2.4 +
      ev * 2.2 +
      (markovProb - baselineProb) * 2.5 +
      momentumLift * 1.8 +
      patternScore;

    const confidencePct = Math.min(95, Math.max(winPct, Math.round((0.65 * winProb + 0.35 * markovProb) * 100)));

    return {
      contractType,
      barrier,
      winPct,
      requiredPct,
      meetsThreshold,
      baselinePct: Math.round(baselineProb * 100),
      edgeDeltaPct: Math.round(edgeDelta * 100),
      payoutMultiplier,
      evPct: Math.round(ev * 100),
      markovWinPct: Math.round(markovProb * 100),
      confidencePct,
      patternName,
      compositeScore,
    };
  }

  /**
   * Evaluates live Even/Odd confirmation status on the trailing digits:
   * - For EVEN: >= 2 consecutive Odd digits followed by 1 Even digit confirmation
   * - For ODD:  >= 2 consecutive Even digits followed by 1 Odd digit confirmation
   */
  private evaluateParityConfirmation(
    digits: number[],
    target: 'EVEN' | 'ODD'
  ): { confirmedNow: boolean; statusText: string } {
    if (digits.length < 3) {
      return {
        confirmedNow: false,
        statusText:
          target === 'EVEN'
            ? 'Entry: ≥2 Odd → 1 Even confirm'
            : 'Entry: ≥2 Even → 1 Odd confirm',
      };
    }

    const lastIdx = digits.length - 1;
    const latest = digits[lastIdx];

    if (target === 'EVEN') {
      // Confirmed right now if latest digit is Even AND >=2 immediately preceding digits are Odd
      if (latest % 2 === 0) {
        let prevOddStreak = 0;
        for (let i = lastIdx - 1; i >= 0; i--) {
          if (digits[i] % 2 !== 0) prevOddStreak++;
          else break;
        }
        if (prevOddStreak >= 2) {
          return {
            confirmedNow: true,
            statusText: `Confirmed (${prevOddStreak}x Odd → Even #${latest})`,
          };
        }
      } else {
        // Latest digit is Odd: check if 2+ consecutive Odd digits have already formed!
        let currentOddStreak = 0;
        for (let i = lastIdx; i >= 0; i--) {
          if (digits[i] % 2 !== 0) currentOddStreak++;
          else break;
        }
        if (currentOddStreak >= 2) {
          return {
            confirmedNow: false,
            statusText: `${currentOddStreak}x Odd ready · Next Even confirms entry`,
          };
        }
      }
      return {
        confirmedNow: false,
        statusText: 'Entry: Wait ≥2 Odd → 1 Even confirm',
      };
    } else {
      // Target ODD (vice versa): >= 2 consecutive Even digits followed by 1 Odd digit confirmation
      if (latest % 2 !== 0) {
        let prevEvenStreak = 0;
        for (let i = lastIdx - 1; i >= 0; i--) {
          if (digits[i] % 2 === 0) prevEvenStreak++;
          else break;
        }
        if (prevEvenStreak >= 2) {
          return {
            confirmedNow: true,
            statusText: `Confirmed (${prevEvenStreak}x Even → Odd #${latest})`,
          };
        }
      } else {
        let currentEvenStreak = 0;
        for (let i = lastIdx; i >= 0; i--) {
          if (digits[i] % 2 === 0) currentEvenStreak++;
          else break;
        }
        if (currentEvenStreak >= 2) {
          return {
            confirmedNow: false,
            statusText: `${currentEvenStreak}x Even ready · Next Odd confirms entry`,
          };
        }
      }
      return {
        confirmedNow: false,
        statusText: 'Entry: Wait ≥2 Even → 1 Odd confirm',
      };
    }
  }

  /**
   * Evaluates live Over/Under entry confirmation on trailing digits:
   * - For UNDER B: >= 3 consecutive opposite digits (>= B) followed by 1 winning digit (< B)
   * - For OVER B:  >= 3 consecutive opposite digits (<= B) followed by 1 winning digit (> B)
   */
  private evaluateOverUnderConfirmation(
    digits: number[],
    target: 'OVER' | 'UNDER',
    barrier: number
  ): { confirmedNow: boolean; statusText: string } {
    if (digits.length < 4) {
      return {
        confirmedNow: false,
        statusText:
          target === 'UNDER'
            ? `Entry: Wait ≥3 (≥${barrier}) → 1 (<${barrier}) confirm · Continuous`
            : `Entry: Wait ≥3 (≤${barrier}) → 1 (>${barrier}) confirm · Continuous`,
      };
    }

    const lastIdx = digits.length - 1;
    const latest = digits[lastIdx];

    if (target === 'UNDER') {
      // Winning side: < barrier | Opposite side: >= barrier
      if (latest < barrier) {
        let prevOppStreak = 0;
        for (let i = lastIdx - 1; i >= 0; i--) {
          if (digits[i] >= barrier) prevOppStreak++;
          else break;
        }
        if (prevOppStreak >= 3) {
          return {
            confirmedNow: true,
            statusText: `Confirmed (${prevOppStreak}x ≥${barrier} → <${barrier} #${latest}) · Continuous`,
          };
        }
      } else {
        let currentOppStreak = 0;
        for (let i = lastIdx; i >= 0; i--) {
          if (digits[i] >= barrier) currentOppStreak++;
          else break;
        }
        if (currentOppStreak >= 3) {
          return {
            confirmedNow: false,
            statusText: `${currentOppStreak}x ≥${barrier} ready · Next <${barrier} confirms entry`,
          };
        }
      }
      return {
        confirmedNow: false,
        statusText: `Entry: Wait ≥3 (≥${barrier}) → 1 (<${barrier}) confirm · Continuous`,
      };
    } else {
      // OVER (vice versa) -> Winning side: > barrier | Opposite side: <= barrier
      if (latest > barrier) {
        let prevOppStreak = 0;
        for (let i = lastIdx - 1; i >= 0; i--) {
          if (digits[i] <= barrier) prevOppStreak++;
          else break;
        }
        if (prevOppStreak >= 3) {
          return {
            confirmedNow: true,
            statusText: `Confirmed (${prevOppStreak}x ≤${barrier} → >${barrier} #${latest}) · Continuous`,
          };
        }
      } else {
        let currentOppStreak = 0;
        for (let i = lastIdx; i >= 0; i--) {
          if (digits[i] <= barrier) currentOppStreak++;
          else break;
        }
        if (currentOppStreak >= 3) {
          return {
            confirmedNow: false,
            statusText: `${currentOppStreak}x ≤${barrier} ready · Next >${barrier} confirms entry`,
          };
        }
      }
      return {
        confirmedNow: false,
        statusText: `Entry: Wait ≥3 (≤${barrier}) → 1 (>${barrier}) confirm · Continuous`,
      };
    }
  }

  private getCycleTiming(nowSec: number, phaseOffsetSec: number) {
    const elapsedWithOffset = nowSec + phaseOffsetSec;
    const cycleId = Math.floor(elapsedWithOffset / FULL_CYCLE_SEC);
    const cyclePos = elapsedWithOffset % FULL_CYCLE_SEC;
    const inScanPhase = cyclePos < SCAN_WINDOW_SEC;
    const timerCountdown = inScanPhase
      ? SCAN_WINDOW_SEC - cyclePos
      : (SCAN_WINDOW_SEC - ((cyclePos - SCAN_WINDOW_SEC) % SCAN_WINDOW_SEC)) || SCAN_WINDOW_SEC;

    return {
      cycleId,
      inScanPhase,
      scanSecondsLeft: Math.max(1, timerCountdown),
    };
  }

  /**
   * Strictly isolated Even / Odd signal snapshot builder.
   * Never computes or exposes Over/Under or Digit Match contracts.
   */
  private buildEvenOddSnapshot(st: InternalMarketState, nowSec: number): MarketSignalSnapshot {
    const parityDigits = st.digits.slice(-100);
    const parityTotal = Math.max(1, parityDigits.length);
    let evenCount = 0;
    for (const d of parityDigits) {
      if (d % 2 === 0) evenCount++;
    }
    const evenPct = Math.round((evenCount / parityTotal) * 100);
    const oddPct = 100 - evenPct;

    const recentParity = parityDigits.slice(-30);
    const olderParity = parityDigits.slice(0, Math.max(1, parityDigits.length - 30));
    const recentEvenPct =
      (recentParity.filter((d) => d % 2 === 0).length / Math.max(1, recentParity.length)) * 100;
    const olderEvenPct =
      (olderParity.filter((d) => d % 2 === 0).length / Math.max(1, olderParity.length)) * 100;
    const evenMomentumDelta = Math.round(recentEvenPct - olderEvenPct);
    const oddMomentumDelta = -evenMomentumDelta;

    const { cycleId, inScanPhase, scanSecondsLeft } = this.getCycleTiming(
      nowSec,
      st.parityPhaseOffsetSec
    );

    const leadingParity: 'EVEN' | 'ODD' = evenPct >= oddPct ? 'EVEN' : 'ODD';
    let signalLabel: 'EVEN' | 'ODD' = leadingParity;
    let signalTone: MarketSignalSnapshot['signalTone'] =
      leadingParity === 'EVEN' ? 'emerald' : 'fuchsia';
    let contractType: 'EVEN' | 'ODD' = leadingParity;
    let signalEntryTrigger: SignalEntryTrigger =
      leadingParity === 'EVEN' ? 'even_after_2_odd_confirm' : 'odd_after_2_even_confirm';
    let entryConfirmedNow = false;
    let entryConfidencePct = Math.max(evenPct, oddPct);
    let edgeDeltaPct = Math.max(0, entryConfidencePct - 50);
    let distributionSubtext = `${evenPct}% even · ${oddPct}% odd`;
    let patternSummary = '';
    let hasStrongEdge = false;
    let isScanning = inScanPhase;
    let scanStatusNote = `${parityDigits.length} ticks · scanning Even / Odd`;

    if (inScanPhase) {
      isScanning = true;
      scanStatusNote =
        evenPct === oddPct
          ? '50% / 50% Equal · Scanning market'
          : `Even ${evenPct}% · Odd ${oddPct}% · Scanning`;
    } else if (evenPct === oddPct) {
      st.lockedParity = undefined;
      isScanning = true;
      scanStatusNote = '50% / 50% Equal · No trade, scan again';
    } else {
      let pickedSide: 'EVEN' | 'ODD' | null = null;
      let pickedPct = 52;
      let pickedMom = 1;

      if (evenPct >= 52 && evenMomentumDelta > 0) {
        pickedSide = 'EVEN';
        pickedPct = evenPct;
        pickedMom = evenMomentumDelta;
      } else if (oddPct >= 52 && oddMomentumDelta > 0) {
        pickedSide = 'ODD';
        pickedPct = oddPct;
        pickedMom = oddMomentumDelta;
      } else if (st.lockedParity && st.lockedParity.cycleId === cycleId) {
        const currentSidePct = st.lockedParity.contractType === 'EVEN' ? evenPct : oddPct;
        if (currentSidePct >= 51) {
          pickedSide = st.lockedParity.contractType;
          pickedPct = Math.max(52, currentSidePct);
          pickedMom = Math.max(1, st.lockedParity.lockedMomentum);
        }
      }

      if (pickedSide) {
        st.lockedParity = {
          cycleId,
          contractType: pickedSide,
          lockedPct: pickedPct,
          lockedMomentum: pickedMom,
        };
        const confirmCheck = this.evaluateParityConfirmation(st.digits, pickedSide);
        signalLabel = pickedSide;
        signalTone = pickedSide === 'EVEN' ? 'emerald' : 'fuchsia';
        contractType = pickedSide;
        signalEntryTrigger =
          pickedSide === 'EVEN' ? 'even_after_2_odd_confirm' : 'odd_after_2_even_confirm';
        entryConfirmedNow = confirmCheck.confirmedNow;
        entryConfidencePct = pickedSide === 'EVEN' ? Math.max(52, evenPct) : Math.max(52, oddPct);
        edgeDeltaPct = entryConfidencePct - 50;
        hasStrongEdge = true;
        isScanning = false;
        distributionSubtext =
          pickedSide === 'EVEN'
            ? `${evenPct}% even · ${oddPct}% odd · Momentum ▲ +${Math.max(1, evenMomentumDelta)}%`
            : `${oddPct}% odd · ${evenPct}% even · Momentum ▲ +${Math.max(1, oddMomentumDelta)}%`;
        patternSummary = `${confirmCheck.statusText} · Continuous`;
      } else {
        isScanning = true;
        const leadSide = evenPct > oddPct ? `Even ${evenPct}%` : `Odd ${oddPct}%`;
        const leadMom = evenPct > oddPct ? evenMomentumDelta : oddMomentumDelta;
        scanStatusNote =
          Math.max(evenPct, oddPct) < 52
            ? `${leadSide} (<52%) · No trade, scan again`
            : `${leadSide} (mom ${leadMom >= 0 ? '+' : ''}${leadMom}%) · Awaiting rising momentum`;
      }
    }

    return {
      category: 'even_odd',
      market: st.market,
      isLiveWs: st.isLiveWs,
      lastDigit: st.digits[st.digits.length - 1] ?? 0,
      lastQuote: st.lastQuote,
      recentDigits: st.digits.slice(-12),
      windowTickCount: parityDigits.length,
      isScanning,
      scanSecondsLeft,
      scanStatusNote,
      evenPct,
      oddPct,
      overPct: 0,
      underPct: 0,
      hotDigit: 0,
      hotDigitPct: 0,
      coldDigit: 0,
      coldDigitPct: 0,
      barrierStats: [],
      signalLabel,
      signalTone,
      contractType,
      prediction: 0,
      signalEntryTrigger,
      entryConfirmedNow,
      entryConfidencePct,
      payoutMultiplier: 1.95,
      edgeDeltaPct,
      distributionSubtext,
      patternSummary,
      topBarriersSummary: '',
      hasStrongEdge,
    };
  }

  /**
   * Strictly isolated Over / Under signal snapshot builder.
   * Never computes or exposes Even/Odd or Digit Match contracts.
   */
  private buildOverUnderSnapshot(
    st: InternalMarketState,
    nowSec: number,
    overUnderBarrier: BarrierFilter
  ): MarketSignalSnapshot {
    const ouWindowDigits = st.digits.slice(-100);
    const ouTotal = Math.max(1, ouWindowDigits.length);

    const barrierStats: DigitBarrierStat[] = [];
    for (let b = 2; b <= 7; b++) {
      let oCount = 0;
      let uCount = 0;
      for (const d of ouWindowDigits) {
        if (d > b) oCount++;
        if (d < b) uCount++;
      }
      barrierStats.push({
        digit: b,
        overPct: Math.round((oCount / ouTotal) * 100),
        underPct: Math.round((uCount / ouTotal) * 100),
      });
    }

    const allAllowedCandidates: BarrierCandidateEvaluation[] = [];
    for (const b of [4, 5, 6, 7]) {
      allAllowedCandidates.push(
        this.evaluateBarrierCandidate(st.digits, 'OVER', b, OVER_BARRIER_THRESHOLDS[b])
      );
    }
    for (const b of [5, 4, 3, 2]) {
      allAllowedCandidates.push(
        this.evaluateBarrierCandidate(st.digits, 'UNDER', b, UNDER_BARRIER_THRESHOLDS[b])
      );
    }

    const filterKey = String(overUnderBarrier);
    const scopedCandidates =
      overUnderBarrier === 'all'
        ? allAllowedCandidates
        : allAllowedCandidates.filter((c) => c.barrier === overUnderBarrier);

    const qualifying = scopedCandidates
      .filter((c) => c.meetsThreshold)
      .sort((a, b) => b.compositeScore - a.compositeScore);

    const closest = [...scopedCandidates].sort(
      (a, b) => b.winPct - b.requiredPct - (a.winPct - a.requiredPct)
    )[0];

    const fallbackBarrier = overUnderBarrier === 'all' ? 4 : overUnderBarrier;
    const fallbackType: 'OVER' | 'UNDER' = fallbackBarrier >= 4 ? 'OVER' : 'UNDER';

    const { cycleId, inScanPhase, scanSecondsLeft } = this.getCycleTiming(
      nowSec,
      st.overUnderPhaseOffsetSec
    );

    let contractType: 'OVER' | 'UNDER' = closest?.contractType ?? fallbackType;
    let prediction: number = closest?.barrier ?? fallbackBarrier;
    let signalLabel = `${contractType} ${prediction}`;
    let signalTone: MarketSignalSnapshot['signalTone'] =
      contractType === 'OVER' ? 'emerald' : 'fuchsia';
    let signalEntryTrigger: SignalEntryTrigger =
      contractType === 'UNDER' ? 'under_after_3_opp_confirm' : 'over_after_3_opp_confirm';
    let entryConfirmedNow = false;
    let entryConfidencePct = closest?.winPct ?? 50;
    let payoutMultiplier = closest?.payoutMultiplier ?? 1.9;
    let edgeDeltaPct = closest?.edgeDeltaPct ?? 0;
    let distributionSubtext = closest
      ? `${closest.winPct}% ${closest.contractType.toLowerCase()} ${closest.barrier} (req ≥${closest.requiredPct}%)`
      : 'Scanning Over 4–7 & Under 5–2';
    let patternSummary = '';
    let topBarriersSummary = '';
    let hasStrongEdge = false;
    let isScanning = inScanPhase;
    let scanStatusNote = `${ouWindowDigits.length} ticks · scanning Over 4–7 & Under 5–2`;

    const defaultStat = barrierStats.find((s) => s.digit === prediction);
    let activeOverPct = defaultStat?.overPct ?? 50;
    let activeUnderPct = defaultStat?.underPct ?? 50;

    if (inScanPhase) {
      isScanning = true;
      scanStatusNote = `${ouWindowDigits.length} ticks · scanning Over 4–7 & Under 5–2`;
    } else {
      let chosen: BarrierCandidateEvaluation | undefined = qualifying[0];

      const existingLock = st.lockedOverUnder;
      if (
        existingLock &&
        existingLock.cycleId === cycleId &&
        existingLock.barrierFilterKey === filterKey
      ) {
        const lockedCand = scopedCandidates.find(
          (c) =>
            c.contractType === existingLock.contractType && c.barrier === existingLock.barrier
        );
        if (lockedCand && lockedCand.winPct >= lockedCand.requiredPct - 5) {
          chosen = lockedCand;
        }
      }

      if (!chosen) {
        isScanning = true;
        scanStatusNote = closest
          ? `Best ${closest.contractType === 'OVER' ? 'O' : 'U'}${closest.barrier}: ${closest.winPct}% (req ≥${closest.requiredPct}%) · Scan again`
          : 'Scanning Over 4–7 & Under 5–2';
      } else {
        st.lockedOverUnder = {
          cycleId,
          barrierFilterKey: filterKey,
          contractType: chosen.contractType,
          barrier: chosen.barrier,
        };

        const ouConfirm = this.evaluateOverUnderConfirmation(
          st.digits,
          chosen.contractType,
          chosen.barrier
        );

        isScanning = false;
        contractType = chosen.contractType;
        prediction = chosen.barrier;
        signalEntryTrigger =
          chosen.contractType === 'UNDER'
            ? 'under_after_3_opp_confirm'
            : 'over_after_3_opp_confirm';
        entryConfirmedNow = ouConfirm.confirmedNow;
        signalLabel = `${chosen.contractType} ${chosen.barrier}`;
        signalTone = chosen.contractType === 'OVER' ? 'emerald' : 'fuchsia';
        entryConfidencePct = chosen.winPct;
        payoutMultiplier = chosen.payoutMultiplier;
        edgeDeltaPct = chosen.edgeDeltaPct;
        hasStrongEdge = true;

        const bStat = barrierStats.find((s) => s.digit === chosen.barrier);
        activeOverPct = bStat?.overPct ?? chosen.winPct;
        activeUnderPct = bStat?.underPct ?? 100 - chosen.winPct;

        distributionSubtext = `${chosen.winPct}% ${chosen.contractType.toLowerCase()} ${chosen.barrier} (req ≥${chosen.requiredPct}%) · ${chosen.patternName}`;
        patternSummary = ouConfirm.statusText;

        topBarriersSummary = (qualifying.length > 0 ? qualifying : [chosen])
          .slice(0, 3)
          .map((c) => `${c.contractType === 'OVER' ? 'O' : 'U'}${c.barrier} ${c.winPct}%`)
          .join(' · ');
      }
    }

    return {
      category: 'over_under',
      market: st.market,
      isLiveWs: st.isLiveWs,
      lastDigit: st.digits[st.digits.length - 1] ?? 0,
      lastQuote: st.lastQuote,
      recentDigits: st.digits.slice(-12),
      windowTickCount: ouWindowDigits.length,
      isScanning,
      scanSecondsLeft,
      scanStatusNote,
      evenPct: 0,
      oddPct: 0,
      overPct: activeOverPct,
      underPct: activeUnderPct,
      hotDigit: 0,
      hotDigitPct: 0,
      coldDigit: 0,
      coldDigitPct: 0,
      barrierStats,
      signalLabel,
      signalTone,
      contractType,
      prediction,
      signalEntryTrigger,
      entryConfirmedNow,
      entryConfidencePct,
      payoutMultiplier,
      edgeDeltaPct,
      distributionSubtext,
      patternSummary,
      topBarriersSummary,
      hasStrongEdge,
    };
  }

  /**
   * Strictly isolated Digit Match signal snapshot builder.
   * Never computes or exposes Even/Odd or Over/Under contracts.
   */
  private buildDigitMatchSnapshot(st: InternalMarketState, nowSec: number): MarketSignalSnapshot {
    const last10Digits = st.digits.slice(-10);
    const last10Total = Math.max(1, last10Digits.length);
    const matchCounts = new Array<number>(10).fill(0);
    const lastSeenPos = new Array<number>(10).fill(-1);
    last10Digits.forEach((d, idx) => {
      matchCounts[d] = (matchCounts[d] || 0) + 1;
      lastSeenPos[d] = idx;
    });

    let maxMatchCount = 0;
    let hotDigit = 0;
    let coldDigit = 0;
    for (let d = 0; d <= 9; d++) {
      if (matchCounts[d] > maxMatchCount) {
        maxMatchCount = matchCounts[d];
      }
      if (
        matchCounts[d] > matchCounts[hotDigit] ||
        (matchCounts[d] === matchCounts[hotDigit] && lastSeenPos[d] > lastSeenPos[hotDigit])
      ) {
        hotDigit = d;
      }
      if (matchCounts[d] < matchCounts[coldDigit]) {
        coldDigit = d;
      }
    }

    const { cycleId, inScanPhase, scanSecondsLeft } = this.getCycleTiming(
      nowSec,
      st.matchPhaseOffsetSec
    );

    let pickedDigit = hotDigit;
    if (
      st.lockedMatch &&
      st.lockedMatch.cycleId === cycleId &&
      matchCounts[st.lockedMatch.digit] === maxMatchCount &&
      maxMatchCount >= 2
    ) {
      pickedDigit = st.lockedMatch.digit;
    }

    const pickedCount = matchCounts[pickedDigit];
    const pickedPct = Math.round((pickedCount / last10Total) * 100);
    const coldDigitPct = Math.round((matchCounts[coldDigit] / last10Total) * 100);

    let isScanning = inScanPhase;
    let scanStatusNote = 'Last 10 ticks · Scanning digit occurrences';
    let entryConfirmedNow = false;
    let hasStrongEdge = false;
    let distributionSubtext = `Digit #${pickedDigit}: ${pickedCount}/${last10Digits.length} ticks (${pickedPct}%) in last 10 ticks`;
    let patternSummary = '';

    if (inScanPhase) {
      isScanning = true;
      scanStatusNote =
        pickedCount >= 2
          ? `Last 10 ticks · Top #${pickedDigit} (${pickedCount}/10) · Scanning`
          : 'Last 10 ticks · Scanning digit occurrences';
    } else if (last10Digits.length < 10 || pickedCount < 2) {
      st.lockedMatch = undefined;
      isScanning = true;
      scanStatusNote = '1x each in last 10 ticks · No dominant digit, scan again';
    } else {
      st.lockedMatch = {
        cycleId,
        digit: pickedDigit,
      };
      isScanning = false;
      entryConfirmedNow = true;
      hasStrongEdge = true;
      patternSummary = `Highest occurrence in last 10 ticks (#${pickedDigit} ×${pickedCount}) · Continuous`;
    }

    return {
      category: 'digit_match',
      market: st.market,
      isLiveWs: st.isLiveWs,
      lastDigit: st.digits[st.digits.length - 1] ?? 0,
      lastQuote: st.lastQuote,
      recentDigits: last10Digits,
      windowTickCount: last10Digits.length,
      isScanning,
      scanSecondsLeft,
      scanStatusNote,
      evenPct: 0,
      oddPct: 0,
      overPct: 0,
      underPct: 0,
      hotDigit: pickedDigit,
      hotDigitPct: pickedPct,
      coldDigit,
      coldDigitPct,
      barrierStats: [],
      signalLabel: `MATCH ${pickedDigit}`,
      signalTone: 'sky',
      contractType: 'MATCHES',
      prediction: pickedDigit,
      signalEntryTrigger: 'immediate',
      entryConfirmedNow,
      entryConfidencePct: pickedPct,
      payoutMultiplier: 9.0,
      edgeDeltaPct: pickedPct - 10,
      distributionSubtext,
      patternSummary,
      topBarriersSummary: '',
      hasStrongEdge,
    };
  }

  private extractStepDirections(prices: number[]): ('up' | 'down' | 'flat')[] {
    const dirs: ('up' | 'down' | 'flat')[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) dirs.push('up');
      else if (prices[i] < prices[i - 1]) dirs.push('down');
      else dirs.push('flat');
    }
    return dirs;
  }

  /**
   * Evaluates live Only Up / Only Down entry confirmation on trailing Rise/Fall ticks:
   * - For ONLY_UP:   2 or more consecutive Fall ticks followed by 1 Rise tick (≥2 Fall → 1 Rise)
   * - For ONLY_DOWN: 2 or more consecutive Rise ticks followed by 1 Fall tick (≥2 Rise → 1 Fall)
   */
  private evaluateOnlyUpDownConfirmation(
    dirs: ('up' | 'down' | 'flat')[],
    target: 'ONLY_UP' | 'ONLY_DOWN'
  ): { confirmedNow: boolean; statusText: string } {
    if (dirs.length < 3) {
      return {
        confirmedNow: false,
        statusText:
          target === 'ONLY_UP'
            ? 'Entry: ≥2 Fall ticks → 1 Rise tick'
            : 'Entry: ≥2 Rise ticks → 1 Fall tick',
      };
    }

    const lastIdx = dirs.length - 1;
    const latest = dirs[lastIdx];

    if (target === 'ONLY_UP') {
      if (latest === 'up') {
        let prevFallStreak = 0;
        for (let i = lastIdx - 1; i >= 0; i--) {
          if (dirs[i] === 'down') prevFallStreak++;
          else break;
        }
        if (prevFallStreak >= 2) {
          return {
            confirmedNow: true,
            statusText: `Confirmed (${prevFallStreak}x Fall ▼ → 1 Rise ▲)`,
          };
        }
      } else if (latest === 'down') {
        let currentFallStreak = 0;
        for (let i = lastIdx; i >= 0; i--) {
          if (dirs[i] === 'down') currentFallStreak++;
          else break;
        }
        if (currentFallStreak >= 2) {
          return {
            confirmedNow: false,
            statusText: `${currentFallStreak}x Fall ▼ ready · Next Rise ▲ confirms entry`,
          };
        }
      }
      return {
        confirmedNow: false,
        statusText: 'Entry: ≥2 Fall ticks → 1 Rise tick',
      };
    } else {
      if (latest === 'down') {
        let prevRiseStreak = 0;
        for (let i = lastIdx - 1; i >= 0; i--) {
          if (dirs[i] === 'up') prevRiseStreak++;
          else break;
        }
        if (prevRiseStreak >= 2) {
          return {
            confirmedNow: true,
            statusText: `Confirmed (${prevRiseStreak}x Rise ▲ → 1 Fall ▼)`,
          };
        }
      } else if (latest === 'up') {
        let currentRiseStreak = 0;
        for (let i = lastIdx; i >= 0; i--) {
          if (dirs[i] === 'up') currentRiseStreak++;
          else break;
        }
        if (currentRiseStreak >= 2) {
          return {
            confirmedNow: false,
            statusText: `${currentRiseStreak}x Rise ▲ ready · Next Fall ▼ confirms entry`,
          };
        }
      }
      return {
        confirmedNow: false,
        statusText: 'Entry: ≥2 Rise ticks → 1 Fall tick',
      };
    }
  }

  /**
   * Analyses a 2-minute OHLC candlestick relative to recent 2-minute candle bodies:
   * - Strong Bullish Momentum: Bullish 2m candle (close > open) with decisive body ratio (>=52% of wick range),
   *   closing near its upper range (>=60%), and meaningful displacement vs recent 2m bodies (>=0.55x avgBody).
   * - Strong Bearish Momentum (vice versa): Bearish 2m candle (close < open) with >=52% body ratio,
   *   closing near its lower range (<=40%), and >=0.55x avgBody displacement.
   */
  private score2mCandle(
    candle: Candle2m,
    avgBody: number,
    pipUnit: number
  ): {
    direction: 'bullish' | 'bearish' | 'neutral';
    bodyPct: number;
    closePos: number;
    impulseRatio: number;
    isStrongBullish: boolean;
    isStrongBearish: boolean;
    momentumPct: number;
  } {
    const delta = candle.close - candle.open;
    const absBody = Math.abs(delta);
    const range = Math.max(pipUnit, candle.high - candle.low);
    const bodyPct = Math.min(100, Math.round((absBody / range) * 100));
    const closePos = (candle.close - candle.low) / range;
    const impulseRatio = absBody / Math.max(pipUnit, avgBody);

    const direction: 'bullish' | 'bearish' | 'neutral' =
      delta > pipUnit * 0.1 ? 'bullish' : delta < -pipUnit * 0.1 ? 'bearish' : 'neutral';

    const isStrongBullish =
      direction === 'bullish' && bodyPct >= 52 && closePos >= 0.6 && impulseRatio >= 0.55;
    const isStrongBearish =
      direction === 'bearish' && bodyPct >= 52 && closePos <= 0.4 && impulseRatio >= 0.55;

    const momentumPct = Math.min(
      96,
      Math.max(55, Math.round(bodyPct * 0.62 + Math.min(1.7, impulseRatio) * 22))
    );

    return {
      direction,
      bodyPct,
      closePos,
      impulseRatio,
      isStrongBullish,
      isStrongBearish,
      momentumPct,
    };
  }

  private computeEMA(values: number[], period: number): number[] {
    if (values.length === 0) return [];
    const k = 2 / (period + 1);
    const ema: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
      ema.push(values[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
  }

  /**
   * Stage 1 — Market Trend Analysis (Evaluated FIRST to determine trade direction):
   * Examines multi-candle market structure (EMA 5 vs EMA 13 alignment & slope, swing High/Low
   * progression HH/HL vs LH/LL, ATR-normalized net displacement, and 100-tick micro-trend slope)
   * to establish whether the market is in a clear Uptrend, Downtrend, or Ranging/Sideways state.
   */
  private evaluateMarketTrend(
    candles: Candle2m[],
    prices: number[],
    pipUnit: number
  ): {
    direction: 'uptrend' | 'downtrend' | 'ranging';
    strengthPct: number;
    structureTag: string;
    summaryText: string;
  } {
    const windowCandles = candles.slice(-16);
    if (windowCandles.length < 6) {
      return {
        direction: 'ranging',
        strengthPct: 45,
        structureTag: 'Syncing trend',
        summaryText: 'Syncing multi-candle market trend...',
      };
    }

    const closes = windowCandles.map((c) => c.close);
    const emaFastSeries = this.computeEMA(closes, 5);
    const emaSlowSeries = this.computeEMA(closes, 13);

    const emaFast = emaFastSeries[emaFastSeries.length - 1];
    const emaFastPrev = emaFastSeries[Math.max(0, emaFastSeries.length - 3)];
    const emaSlow = emaSlowSeries[emaSlowSeries.length - 1];
    const emaSlowPrev = emaSlowSeries[Math.max(0, emaSlowSeries.length - 3)];
    const latestClose = closes[closes.length - 1];

    const avgRange = Math.max(
      pipUnit,
      windowCandles.reduce((sum, c) => sum + Math.max(pipUnit, c.high - c.low), 0) /
        windowCandles.length
    );

    // Swing structure across recent closed candles (excluding still-forming tip if enough candles exist)
    const closedStructure =
      windowCandles.length >= 8 ? windowCandles.slice(-11, -1) : windowCandles.slice(0, -1);
    const halfIdx = Math.max(2, Math.floor(closedStructure.length / 2));
    const firstHalf = closedStructure.slice(0, halfIdx);
    const secondHalf = closedStructure.slice(halfIdx);

    const firstHigh = Math.max(...firstHalf.map((c) => c.high));
    const firstLow = Math.min(...firstHalf.map((c) => c.low));
    const secondHigh = Math.max(...secondHalf.map((c) => c.high));
    const secondLow = Math.min(...secondHalf.map((c) => c.low));

    const hasHigherHigh = secondHigh > firstHigh + pipUnit * 0.2;
    const hasHigherLow = secondLow > firstLow + pipUnit * 0.2;
    const hasLowerHigh = secondHigh < firstHigh - pipUnit * 0.2;
    const hasLowerLow = secondLow < firstLow - pipUnit * 0.2;

    const isHHHL = hasHigherHigh && hasHigherLow;
    const isLHLL = hasLowerHigh && hasLowerLow;

    // Net displacement & directional efficiency across trend window
    const startRef = windowCandles[0].open;
    const netDelta = latestClose - startRef;
    const netAtrMove = netDelta / avgRange;

    let pathLength = 0;
    for (let i = 1; i < closes.length; i++) {
      pathLength += Math.abs(closes[i] - closes[i - 1]);
    }
    const efficiencyRatio =
      pathLength > pipUnit ? Math.min(1, Math.abs(closes[closes.length - 1] - closes[0]) / pathLength) : 0;

    // 100-tick price EMA20 vs EMA60 confirmation
    let tickBullish = false;
    let tickBearish = false;
    if (prices.length >= 25) {
      const tickFast = this.computeEMA(prices, 20);
      const tickSlow = this.computeEMA(prices, 60);
      const tf = tickFast[tickFast.length - 1];
      const ts = tickSlow[tickSlow.length - 1];
      tickBullish = tf > ts;
      tickBearish = tf < ts;
    }

    let bullScore = 0;
    let bearScore = 0;

    // 1. EMA 5 vs EMA 13 alignment & slope
    if (emaFast > emaSlow) {
      bullScore += 2.0;
      if (emaFast > emaFastPrev && emaSlow >= emaSlowPrev - pipUnit * 0.1) bullScore += 1.0;
    } else if (emaFast < emaSlow) {
      bearScore += 2.0;
      if (emaFast < emaFastPrev && emaSlow <= emaSlowPrev + pipUnit * 0.1) bearScore += 1.0;
    }

    // 2. Price position vs slow EMA
    if (latestClose > emaSlow + avgRange * 0.1) bullScore += 1.25;
    else if (latestClose < emaSlow - avgRange * 0.1) bearScore += 1.25;

    // 3. Swing High / Swing Low market structure (HH/HL vs LH/LL)
    if (isHHHL) {
      bullScore += 2.5;
    } else if (hasHigherHigh || hasHigherLow) {
      if (netAtrMove > 0.35) bullScore += 1.25;
    }

    if (isLHLL) {
      bearScore += 2.5;
    } else if (hasLowerHigh || hasLowerLow) {
      if (netAtrMove < -0.35) bearScore += 1.25;
    }

    // 4. ATR-normalized directional displacement & efficiency
    if (netAtrMove >= 0.75) {
      bullScore += 1.75 + Math.min(1.0, (netAtrMove - 0.75) * 0.45);
    } else if (netAtrMove <= -0.75) {
      bearScore += 1.75 + Math.min(1.0, (Math.abs(netAtrMove) - 0.75) * 0.45);
    }

    if (efficiencyRatio >= 0.32) {
      if (netDelta > 0) bullScore += 0.75;
      else if (netDelta < 0) bearScore += 0.75;
    }

    // 5. Tick-stream trend alignment
    if (tickBullish) bullScore += 0.75;
    if (tickBearish) bearScore += 0.75;

    const scoreGap = Math.abs(bullScore - bearScore);

    if (bullScore >= 5.0 && bullScore - bearScore >= 2.25 && emaFast >= emaSlow && netAtrMove > 0.3) {
      const strengthPct = Math.min(
        95,
        Math.max(58, Math.round(52 + bullScore * 4.2 + efficiencyRatio * 12))
      );
      const structureTag = isHHHL ? 'HH/HL · EMA↑' : 'EMA 5>13';
      return {
        direction: 'uptrend',
        strengthPct,
        structureTag,
        summaryText: `Uptrend ▲ (${structureTag})`,
      };
    }

    if (bearScore >= 5.0 && bearScore - bullScore >= 2.25 && emaFast <= emaSlow && netAtrMove < -0.3) {
      const strengthPct = Math.min(
        95,
        Math.max(58, Math.round(52 + bearScore * 4.2 + efficiencyRatio * 12))
      );
      const structureTag = isLHLL ? 'LH/LL · EMA↓' : 'EMA 5<13';
      return {
        direction: 'downtrend',
        strengthPct,
        structureTag,
        summaryText: `Downtrend ▼ (${structureTag})`,
      };
    }

    const rangingStrength = Math.min(54, Math.max(35, Math.round(38 + scoreGap * 5)));
    return {
      direction: 'ranging',
      strengthPct: rangingStrength,
      structureTag: 'Ranging',
      summaryText: 'Ranging / Sideways',
    };
  }

  /**
   * Strictly isolated Only Up / Only Down signal snapshot builder.
   * Two-stage directional & momentum pipeline before activating the Run button:
   * 1. Market Trend First: Analyses multi-candle market structure (EMA 5/13, HH/HL vs LH/LL, ATR slope)
   *    to make an informed decision on market direction (Uptrend -> ONLY UP, Downtrend -> ONLY DOWN).
   *    Ranging/sideways markets stay in scanning mode.
   * 2. 2-Minute Candle Momentum Second: Once trend direction is confirmed, checks the 2-minute candlestick
   *    for strong aligned momentum (strong bullish 2m candle in Uptrend, or strong bearish 2m candle in Downtrend)
   *    before activating the Run button.
   * 3. Entry Trigger:
   *    - ONLY UP:   >= 2 Fall ticks -> 1 Rise tick
   *    - ONLY DOWN: >= 2 Rise ticks -> 1 Fall tick
   */
  private buildOnlyUpDownSnapshot(
    st: InternalMarketState,
    nowSec: number,
    ticks: number = 2
  ): MarketSignalSnapshot {
    const dirs = this.extractStepDirections(st.prices).slice(-100);
    const pipUnit = Math.pow(10, -st.market.decimals);

    const candles = st.candles2m;
    const currentBucketEpoch = Math.floor(nowSec / 120) * 120;
    const activeCandle: Candle2m = candles[candles.length - 1] ?? {
      epoch: currentBucketEpoch,
      open: st.lastPrice,
      high: st.lastPrice,
      low: st.lastPrice,
      close: st.lastPrice,
    };
    const prevCandle: Candle2m | undefined =
      candles.length >= 2 ? candles[candles.length - 2] : undefined;

    const priorClosed = candles.slice(-12, -1);
    const avgBody =
      priorClosed.length > 0
        ? priorClosed.reduce((acc, c) => acc + Math.max(pipUnit, Math.abs(c.close - c.open)), 0) /
          priorClosed.length
        : Math.max(pipUnit, st.market.volatility * st.lastPrice * 3);

    // STAGE 1: Evaluate overall Market Trend FIRST to decide direction
    const trendEval = this.evaluateMarketTrend(candles, st.prices, pipUnit);

    // STAGE 2: Evaluate 2-minute candlestick momentum SECOND, strictly aligned with Stage 1 trend
    const curEval = this.score2mCandle(activeCandle, avgBody, pipUnit);
    const secIntoCandle = Math.max(0, Math.min(119, nowSec - activeCandle.epoch));
    const candleSecondsLeft = Math.max(1, 120 - secIntoCandle);

    // Brief 3-second initial scan when scanner first mounts before unlocking discovered signals
    const inInitialWarmup = nowSec - this.startedAtSec < 3 && !st.isLiveWs;

    let discoveredSide: 'ONLY_UP' | 'ONLY_DOWN' | null = null;
    let displayBodyPct = curEval.bodyPct;
    let displayImpulse = curEval.impulseRatio;
    let displayMomentumPct = curEval.momentumPct;

    if (!inInitialWarmup) {
      if (trendEval.direction === 'uptrend') {
        // Direction decided by Market Trend: ONLY UP only. Now verify 2m bullish candle momentum:
        if (curEval.isStrongBullish) {
          discoveredSide = 'ONLY_UP';
        } else if (
          st.lockedOnlyUpDown &&
          st.lockedOnlyUpDown.candleEpoch === activeCandle.epoch &&
          st.lockedOnlyUpDown.contractType === 'ONLY_UP' &&
          curEval.direction === 'bullish' &&
          curEval.bodyPct >= 34 &&
          curEval.impulseRatio >= 0.35
        ) {
          // Keep Run button active during a 2-tick entry pullback inside the same bullish 2m candle
          discoveredSide = 'ONLY_UP';
          displayMomentumPct = Math.max(
            curEval.momentumPct,
            st.lockedOnlyUpDown.peakMomentumPct - 4
          );
        } else if (secIntoCandle < 18 && prevCandle) {
          const prevEval = this.score2mCandle(prevCandle, avgBody, pipUnit);
          if (prevEval.isStrongBullish && curEval.direction !== 'bearish') {
            discoveredSide = 'ONLY_UP';
            displayBodyPct = prevEval.bodyPct;
            displayImpulse = prevEval.impulseRatio;
            displayMomentumPct = prevEval.momentumPct;
          }
        }
      } else if (trendEval.direction === 'downtrend') {
        // Direction decided by Market Trend: ONLY DOWN only. Now verify 2m bearish candle momentum:
        if (curEval.isStrongBearish) {
          discoveredSide = 'ONLY_DOWN';
        } else if (
          st.lockedOnlyUpDown &&
          st.lockedOnlyUpDown.candleEpoch === activeCandle.epoch &&
          st.lockedOnlyUpDown.contractType === 'ONLY_DOWN' &&
          curEval.direction === 'bearish' &&
          curEval.bodyPct >= 34 &&
          curEval.impulseRatio >= 0.35
        ) {
          // Keep Run button active during a 2-tick entry bounce inside the same bearish 2m candle
          discoveredSide = 'ONLY_DOWN';
          displayMomentumPct = Math.max(
            curEval.momentumPct,
            st.lockedOnlyUpDown.peakMomentumPct - 4
          );
        } else if (secIntoCandle < 18 && prevCandle) {
          const prevEval = this.score2mCandle(prevCandle, avgBody, pipUnit);
          if (prevEval.isStrongBearish && curEval.direction !== 'bullish') {
            discoveredSide = 'ONLY_DOWN';
            displayBodyPct = prevEval.bodyPct;
            displayImpulse = prevEval.impulseRatio;
            displayMomentumPct = prevEval.momentumPct;
          }
        }
      } else {
        // Market trend is ranging / undecided — clear any stale lock and do not trade
        st.lockedOnlyUpDown = undefined;
      }
    }

    if (!discoveredSide) {
      st.lockedOnlyUpDown = undefined;
    }

    const defaultSide: 'ONLY_UP' | 'ONLY_DOWN' =
      trendEval.direction === 'downtrend'
        ? 'ONLY_DOWN'
        : trendEval.direction === 'uptrend'
        ? 'ONLY_UP'
        : curEval.direction === 'bearish'
        ? 'ONLY_DOWN'
        : 'ONLY_UP';

    const combinedConfidencePct = Math.min(
      96,
      Math.max(58, Math.round(trendEval.strengthPct * 0.45 + displayMomentumPct * 0.55))
    );

    let signalLabel: 'ONLY UP' | 'ONLY DOWN' =
      defaultSide === 'ONLY_UP' ? 'ONLY UP' : 'ONLY DOWN';
    let signalTone: MarketSignalSnapshot['signalTone'] =
      defaultSide === 'ONLY_UP' ? 'emerald' : 'fuchsia';
    let contractType: 'ONLY_UP' | 'ONLY_DOWN' = defaultSide;
    let signalEntryTrigger: SignalEntryTrigger =
      defaultSide === 'ONLY_UP' ? 'only_up_after_down_confirm' : 'only_down_after_up_confirm';
    let entryConfirmedNow = false;
    let entryConfidencePct = combinedConfidencePct;
    let edgeDeltaPct = Math.max(0, combinedConfidencePct - 50);
    let distributionSubtext = '';
    let patternSummary = '';
    let hasStrongEdge = false;
    let isScanning = true;
    let scanStatusNote = 'Checking market trend & 2m candle momentum...';

    if (discoveredSide) {
      const prevPeak =
        st.lockedOnlyUpDown && st.lockedOnlyUpDown.candleEpoch === activeCandle.epoch
          ? st.lockedOnlyUpDown.peakMomentumPct
          : 0;
      st.lockedOnlyUpDown = {
        candleEpoch: activeCandle.epoch,
        contractType: discoveredSide,
        peakMomentumPct: Math.max(prevPeak, displayMomentumPct),
      };

      const confirmCheck = this.evaluateOnlyUpDownConfirmation(dirs, discoveredSide);
      signalLabel = discoveredSide === 'ONLY_UP' ? 'ONLY UP' : 'ONLY DOWN';
      signalTone = discoveredSide === 'ONLY_UP' ? 'emerald' : 'fuchsia';
      contractType = discoveredSide;
      signalEntryTrigger =
        discoveredSide === 'ONLY_UP'
          ? 'only_up_after_down_confirm'
          : 'only_down_after_up_confirm';
      entryConfirmedNow = confirmCheck.confirmedNow;
      entryConfidencePct = combinedConfidencePct;
      edgeDeltaPct = Math.max(5, combinedConfidencePct - 50);
      hasStrongEdge = true;
      isScanning = false;

      const impulseLabel = `${displayImpulse.toFixed(1)}x`;
      distributionSubtext =
        discoveredSide === 'ONLY_UP'
          ? `Uptrend ▲ (${trendEval.structureTag}) · 2m Bullish ${displayBodyPct}% body (${impulseLabel})`
          : `Downtrend ▼ (${trendEval.structureTag}) · 2m Bearish ${displayBodyPct}% body (${impulseLabel})`;
      patternSummary = `${confirmCheck.statusText} · Continuous`;
    } else {
      isScanning = true;
      if (trendEval.direction === 'ranging') {
        scanStatusNote = 'Trend ranging / sideways · Awaiting clear market trend';
      } else if (trendEval.direction === 'uptrend') {
        if (curEval.direction === 'bearish') {
          scanStatusNote = `Uptrend ▲ (${trendEval.structureTag}) · 2m pullback ▼, awaiting bullish momentum`;
        } else if (curEval.direction === 'neutral' || curEval.impulseRatio < 0.25) {
          scanStatusNote = `Uptrend ▲ (${trendEval.structureTag}) · 2m flat, awaiting strong bullish candle`;
        } else if (curEval.bodyPct < 52) {
          scanStatusNote = `Uptrend ▲ (${trendEval.structureTag}) · 2m Bullish (${curEval.bodyPct}% body), awaiting momentum`;
        } else {
          scanStatusNote = `Uptrend ▲ (${trendEval.structureTag}) · 2m Bullish (${curEval.impulseRatio.toFixed(1)}x), building momentum`;
        }
      } else {
        if (curEval.direction === 'bullish') {
          scanStatusNote = `Downtrend ▼ (${trendEval.structureTag}) · 2m bounce ▲, awaiting bearish momentum`;
        } else if (curEval.direction === 'neutral' || curEval.impulseRatio < 0.25) {
          scanStatusNote = `Downtrend ▼ (${trendEval.structureTag}) · 2m flat, awaiting strong bearish candle`;
        } else if (curEval.bodyPct < 52) {
          scanStatusNote = `Downtrend ▼ (${trendEval.structureTag}) · 2m Bearish (${curEval.bodyPct}% body), awaiting momentum`;
        } else {
          scanStatusNote = `Downtrend ▼ (${trendEval.structureTag}) · 2m Bearish (${curEval.impulseRatio.toFixed(1)}x), building momentum`;
        }
      }
    }

    const effectiveCandleDir: 'bullish' | 'bearish' | 'neutral' =
      discoveredSide === 'ONLY_UP'
        ? 'bullish'
        : discoveredSide === 'ONLY_DOWN'
        ? 'bearish'
        : curEval.direction;

    const clampedTicks = Math.min(5, Math.max(2, Math.round(ticks || 2)));
    const onlyUpDownPayoutMap: Record<number, number> = {
      2: 3.85,
      3: 7.8,
      4: 15.6,
      5: 31.2,
    };

    return {
      category: 'only_up_down',
      market: st.market,
      isLiveWs: st.isLiveWs,
      lastDigit: st.digits[st.digits.length - 1] ?? 0,
      lastQuote: st.lastQuote,
      recentDigits: st.digits.slice(-12),
      recentDirections: dirs.slice(-12),
      candle2mDirection: effectiveCandleDir,
      marketTrend: trendEval.direction,
      marketTrendSummary: trendEval.summaryText,
      windowTickCount: candles.length,
      isScanning,
      scanSecondsLeft: candleSecondsLeft,
      scanStatusNote,
      evenPct: 0,
      oddPct: 0,
      overPct: 0,
      underPct: 0,
      hotDigit: 0,
      hotDigitPct: 0,
      coldDigit: 0,
      coldDigitPct: 0,
      barrierStats: [],
      signalLabel,
      signalTone,
      contractType,
      prediction: 0,
      signalEntryTrigger,
      entryConfirmedNow,
      entryConfidencePct,
      payoutMultiplier: onlyUpDownPayoutMap[clampedTicks] ?? 3.85,
      edgeDeltaPct,
      distributionSubtext,
      patternSummary,
      topBarriersSummary: '',
      hasStrongEdge,
    };
  }

  /**
   * Standard TradingView / Wilder's 14-period RSI computed over 5-minute candle closes.
   */
  private computeWilderRsi14(closes: number[], period: number = 14): number {
    if (closes.length < 2) return 50;
    const effectivePeriod = Math.min(period, closes.length - 1);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= effectivePeriod; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / effectivePeriod;
    let avgLoss = losses / effectivePeriod;

    for (let i = effectivePeriod + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (effectivePeriod - 1) + gain) / effectivePeriod;
      avgLoss = (avgLoss * (effectivePeriod - 1) + loss) / effectivePeriod;
    }

    if (avgLoss <= 1e-12) {
      return avgGain <= 1e-12 ? 50 : 99.9;
    }
    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    return Number(Math.min(99.9, Math.max(0.1, rsi)).toFixed(1));
  }

  /**
   * Evaluates 3 consecutive rising ticks (High Tick entry) or 3 consecutive falling ticks (Low Tick entry).
   */
  private evaluateThreeTickMomentumEntry(
    dirs: ('up' | 'down' | 'flat')[],
    side: 'HIGH_TICK' | 'LOW_TICK'
  ): { confirmedNow: boolean; streakCount: number; statusText: string } {
    const targetDir = side === 'HIGH_TICK' ? 'up' : 'down';
    const arrow = side === 'HIGH_TICK' ? 'Rise ▲' : 'Fall ▼';
    let streak = 0;
    for (let i = dirs.length - 1; i >= 0; i--) {
      if (dirs[i] === targetDir) streak++;
      else break;
    }

    if (streak >= 3) {
      return {
        confirmedNow: true,
        streakCount: streak,
        statusText: `Entry confirmed (${streak}x consecutive ${arrow})`,
      };
    }

    return {
      confirmedNow: false,
      streakCount: streak,
      statusText: `Entry: ${streak}/3 consecutive ${arrow}`,
    };
  }

  public getMarket5mSummary(marketId: string): Market5mAnalysisSummary | null {
    const st = this.states.get(marketId);
    if (!st) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const bucketEpoch5m = Math.floor(nowSec / 300) * 300;
    const secondsLeft = Math.max(1, 300 - (nowSec - bucketEpoch5m));
    const pipUnit = Math.pow(10, -st.market.decimals);

    const activeCandle: Candle5m =
      st.candles5m[st.candles5m.length - 1] ?? {
        epoch: bucketEpoch5m,
        open: st.lastPrice,
        high: st.lastPrice,
        low: st.lastPrice,
        close: st.lastPrice,
      };

    const closes = st.candles5m.map((c) => c.close);
    const rsi5m = this.computeWilderRsi14(closes, 14);
    const bodyTop = Math.max(activeCandle.open, activeCandle.close);
    const bodyBottom = Math.min(activeCandle.open, activeCandle.close);
    const upperWick = Number(Math.max(0, activeCandle.high - bodyTop).toFixed(st.market.decimals));
    const lowerWick = Number(Math.max(0, bodyBottom - activeCandle.low).toFixed(st.market.decimals));
    const hasBothWicks = upperWick >= pipUnit * 0.5 && lowerWick >= pipUnit * 0.5;
    const candleDirection: 'bullish' | 'bearish' | 'neutral' =
      activeCandle.close > activeCandle.open
        ? 'bullish'
        : activeCandle.close < activeCandle.open
        ? 'bearish'
        : 'neutral';

    return {
      market: st.market,
      rsi5m,
      open: activeCandle.open,
      high: activeCandle.high,
      low: activeCandle.low,
      close: activeCandle.close,
      upperWick,
      lowerWick,
      hasBothWicks,
      secondsLeft,
      noTradeWindow: secondsLeft <= 10,
      candleDirection,
    };
  }

  /**
   * Strictly isolated High Tick / Low Tick (TICKHIGH / TICKLOW · 5 Ticks) signal snapshot builder.
   * Strategy (5-Minute Candlestick + RSI(14) + Both-Sides Wicks + 10s Candle Close Guard):
   * 1. Timeframe & Indicator: Analyses live 5-minute (300s) OHLC candlesticks and 14-period RSI.
   * 2. Both-Sides Wicks Requirement: Active 5-minute candlestick MUST have both an upper wick and a lower wick.
   * 3. 10-Second Close Guard: No trade if the 5-minute candlestick has <= 10 seconds remaining.
   * 4. Direction & Entry:
   *    - High Tick Strategy: 5m RSI < 50 -> Activates Run button. Entry is 3 consecutive rising ticks (▲ ▲ ▲).
   *    - Low Tick Strategy:  5m RSI > 50 -> Activates Run button. Entry is 3 consecutive falling ticks (▼ ▼ ▼).
   */
  private buildHighLowTickSnapshot(
    st: InternalMarketState,
    nowSec: number
  ): MarketSignalSnapshot {
    const prices = st.prices;
    const dirs = this.extractStepDirections(prices).slice(-100);
    const pipUnit = Math.pow(10, -st.market.decimals);

    const bucketEpoch5m = Math.floor(nowSec / 300) * 300;
    const candle5mSecondsLeft = Math.max(1, 300 - (nowSec - bucketEpoch5m));
    const noTradeRemainingWindow = candle5mSecondsLeft <= 10;

    const candles5m = st.candles5m;
    const activeCandle: Candle5m =
      candles5m[candles5m.length - 1] ?? {
        epoch: bucketEpoch5m,
        open: st.lastPrice,
        high: st.lastPrice,
        low: st.lastPrice,
        close: st.lastPrice,
      };

    const closes5m = candles5m.map((c) => c.close);
    const rsi5m = this.computeWilderRsi14(closes5m, 14);

    const bodyTop = Math.max(activeCandle.open, activeCandle.close);
    const bodyBottom = Math.min(activeCandle.open, activeCandle.close);
    const upperWick = Math.max(0, activeCandle.high - bodyTop);
    const lowerWick = Math.max(0, bodyBottom - activeCandle.low);
    const hasUpperWick = upperWick >= pipUnit * 0.5;
    const hasLowerWick = lowerWick >= pipUnit * 0.5;
    const hasBothWicks = hasUpperWick && hasLowerWick;

    const candle5mDirection: 'bullish' | 'bearish' | 'neutral' =
      activeCandle.close > activeCandle.open
        ? 'bullish'
        : activeCandle.close < activeCandle.open
        ? 'bearish'
        : 'neutral';

    // Measure 5-tick High/Low position distribution (#1..#5) across recent windows
    // (including conditional windows after 3 rising / 3 falling ticks when available)
    const highPositions: number[] = [];
    const lowPositions: number[] = [];
    const condHighPositions: number[] = [];
    const condLowPositions: number[] = [];

    for (let i = 0; i <= prices.length - 6; i++) {
      const w = [
        prices[i + 1],
        prices[i + 2],
        prices[i + 3],
        prices[i + 4],
        prices[i + 5],
      ];
      const maxVal = Math.max(...w);
      const minVal = Math.min(...w);

      let maxCount = 0;
      let maxIdx = 0;
      let minCount = 0;
      let minIdx = 0;

      for (let k = 0; k < 5; k++) {
        if (w[k] === maxVal) {
          maxCount++;
          maxIdx = k + 1;
        }
        if (w[k] === minVal) {
          minCount++;
          minIdx = k + 1;
        }
      }

      const hWin = maxCount === 1 ? maxIdx : 0;
      const lWin = minCount === 1 ? minIdx : 0;
      highPositions.push(hWin);
      lowPositions.push(lWin);

      if (i >= 3) {
        const is3Rise =
          prices[i] > prices[i - 1] &&
          prices[i - 1] > prices[i - 2] &&
          prices[i - 2] > prices[i - 3];
        const is3Fall =
          prices[i] < prices[i - 1] &&
          prices[i - 1] < prices[i - 2] &&
          prices[i - 2] < prices[i - 3];
        if (is3Rise && hWin > 0) condHighPositions.push(hWin);
        if (is3Fall && lWin > 0) condLowPositions.push(lWin);
      }
    }

    const totalWindows = Math.max(1, highPositions.length);
    const highPct = [0, 20, 20, 20, 20, 20];
    const lowPct = [0, 20, 20, 20, 20, 20];

    let bestHighTick = 5;
    let bestHighScore = -1;
    let bestLowTick = 5;
    let bestLowScore = -1;

    for (let k = 1; k <= 5; k++) {
      highPct[k] = Math.round((highPositions.filter((p) => p === k).length / totalWindows) * 100);
      lowPct[k] = Math.round((lowPositions.filter((p) => p === k).length / totalWindows) * 100);

      const condHighRate =
        condHighPositions.length >= 4
          ? Math.round((condHighPositions.filter((p) => p === k).length / condHighPositions.length) * 100)
          : highPct[k];
      const condLowRate =
        condLowPositions.length >= 4
          ? Math.round((condLowPositions.filter((p) => p === k).length / condLowPositions.length) * 100)
          : lowPct[k];

      const hScore = highPct[k] * 0.6 + condHighRate * 0.4 + (k >= 3 ? 0.5 : 0);
      if (hScore > bestHighScore) {
        bestHighScore = hScore;
        bestHighTick = k;
      }

      const lScore = lowPct[k] * 0.6 + condLowRate * 0.4 + (k >= 3 ? 0.5 : 0);
      if (lScore > bestLowScore) {
        bestLowScore = lScore;
        bestLowTick = k;
      }
    }

    // Determine strategy side from 5m RSI (< 50 => HIGH_TICK, > 50 => LOW_TICK)
    const rsiFavorsHigh = rsi5m < 50;
    const rsiFavorsLow = rsi5m > 50;
    const desiredSide: 'HIGH_TICK' | 'LOW_TICK' = rsiFavorsHigh ? 'HIGH_TICK' : 'LOW_TICK';
    let targetTick = desiredSide === 'HIGH_TICK' ? bestHighTick : bestLowTick;

    // Keep targetTick stable within the same 5-minute candle once locked on the same RSI side
    if (
      st.lockedHighLowTick &&
      st.lockedHighLowTick.candleEpoch === activeCandle.epoch &&
      st.lockedHighLowTick.contractType === desiredSide
    ) {
      targetTick = st.lockedHighLowTick.targetTick;
    }

    const canActivateRun =
      hasBothWicks && !noTradeRemainingWindow && (rsiFavorsHigh || rsiFavorsLow);

    if (canActivateRun) {
      st.lockedHighLowTick = {
        candleEpoch: activeCandle.epoch,
        contractType: desiredSide,
        targetTick,
      };
    } else if (noTradeRemainingWindow) {
      st.lockedHighLowTick = undefined;
    }

    const contractType: 'HIGH_TICK' | 'LOW_TICK' = desiredSide;
    const signalLabel =
      contractType === 'HIGH_TICK' ? `HIGH TICK #${targetTick}` : `LOW TICK #${targetTick}`;
    const signalTone: MarketSignalSnapshot['signalTone'] =
      contractType === 'HIGH_TICK' ? 'emerald' : 'fuchsia';
    const signalEntryTrigger: SignalEntryTrigger =
      contractType === 'HIGH_TICK'
        ? 'high_tick_3_rising_confirm'
        : 'low_tick_3_falling_confirm';

    const confirm = this.evaluateThreeTickMomentumEntry(dirs, contractType);
    const breakdownSide = contractType === 'HIGH_TICK' ? highPct : lowPct;
    const selectedHitPct = breakdownSide[targetTick] ?? 24;
    const rsiDistanceBoost = Math.min(18, Math.round(Math.abs(50 - rsi5m) * 0.6));
    const entryConfidencePct = Math.min(92, Math.max(selectedHitPct, 52 + rsiDistanceBoost));
    const payoutMultiplier = 4.2;

    const minsLeft = Math.floor(candle5mSecondsLeft / 60);
    const secsLeft = candle5mSecondsLeft % 60;
    const timerFormatted = `${minsLeft}:${secsLeft.toString().padStart(2, '0')}`;

    const highLowBreakdownSummary = `5m Left ${timerFormatted} · 5t ${
      contractType === 'HIGH_TICK' ? 'Highs' : 'Lows'
    }: #1 ${breakdownSide[1]}% · #2 ${breakdownSide[2]}% · #3 ${breakdownSide[3]}% · #4 ${
      breakdownSide[4]
    }% · #5 ${breakdownSide[5]}%`;

    const marketTrendSummary = `5m RSI ${rsi5m.toFixed(1)} (${
      rsiFavorsHigh ? '<50 High' : rsiFavorsLow ? '>50 Low' : '=50 Neutral'
    }) · ${hasBothWicks ? 'Both Wicks ✔' : 'Wait Wicks'}`;

    let isScanning = true;
    let entryConfirmedNow = false;
    let hasStrongEdge = false;
    let distributionSubtext = '';
    let patternSummary = '';
    let scanStatusNote = '';

    if (noTradeRemainingWindow) {
      isScanning = true;
      scanStatusNote = `No trade · 5m candle closing (${candle5mSecondsLeft}s left ≤ 10s)`;
    } else if (!hasBothWicks) {
      isScanning = true;
      const missingDesc =
        !hasUpperWick && !hasLowerWick
          ? 'awaiting upper & lower wicks'
          : !hasUpperWick
          ? 'awaiting upper wick'
          : 'awaiting lower wick';
      scanStatusNote = `5m RSI ${rsi5m.toFixed(1)} · 5m candle ${missingDesc} (${timerFormatted} left)`;
    } else if (!rsiFavorsHigh && !rsiFavorsLow) {
      isScanning = true;
      scanStatusNote = `5m RSI exactly 50.0 · Awaiting RSI < 50 (High) or > 50 (Low)`;
    } else {
      isScanning = false;
      hasStrongEdge = true;
      entryConfirmedNow = confirm.confirmedNow;
      distributionSubtext =
        contractType === 'HIGH_TICK'
          ? `5m RSI ${rsi5m.toFixed(1)} (<50) · Both Wicks ✔ · ${timerFormatted} left`
          : `5m RSI ${rsi5m.toFixed(1)} (>50) · Both Wicks ✔ · ${timerFormatted} left`;
      patternSummary = `${confirm.statusText} · Continuous (Stop ≤10s candle end)`;
    }

    const rawWindowWinners =
      contractType === 'HIGH_TICK' ? highPositions.slice(-12) : lowPositions.slice(-12);
    const recentWindowWinners = rawWindowWinners.filter((v) => v >= 1 && v <= 5);

    return {
      category: 'high_low_tick',
      market: st.market,
      isLiveWs: st.isLiveWs,
      lastDigit: st.digits[st.digits.length - 1] ?? 0,
      lastQuote: st.lastQuote,
      recentDigits: st.digits.slice(-12),
      recentDirections: dirs.slice(-12),
      candle5mDirection,
      rsi5m,
      candle5mHasBothWicks: hasBothWicks,
      candle5mSecondsLeft,
      marketTrend: rsiFavorsHigh ? 'uptrend' : rsiFavorsLow ? 'downtrend' : 'ranging',
      marketTrendSummary,
      recentWindowWinners,
      highLowBreakdownSummary,
      windowTickCount: candles5m.length,
      isScanning,
      scanSecondsLeft: candle5mSecondsLeft,
      scanStatusNote,
      evenPct: 0,
      oddPct: 0,
      overPct: 0,
      underPct: 0,
      hotDigit: targetTick,
      hotDigitPct: entryConfidencePct,
      coldDigit: 0,
      coldDigitPct: 0,
      barrierStats: [],
      signalLabel,
      signalTone,
      contractType,
      prediction: targetTick,
      signalEntryTrigger,
      entryConfirmedNow,
      entryConfidencePct,
      payoutMultiplier,
      edgeDeltaPct: Math.max(4, selectedHitPct - 20),
      distributionSubtext,
      patternSummary,
      topBarriersSummary: '',
      hasStrongEdge,
    };
  }

  public getSnapshots(
    category: SignalCategory,
    overUnderBarrier: BarrierFilter = 'all',
    ticks: number = 1
  ): MarketSignalSnapshot[] {
    const nowSec = Math.floor(Date.now() / 1000);

    return SIGNAL_MARKETS.map((market) => {
      const st = this.states.get(market.id)!;
      if (category === 'even_odd') {
        return this.buildEvenOddSnapshot(st, nowSec);
      }
      if (category === 'over_under') {
        return this.buildOverUnderSnapshot(st, nowSec, overUnderBarrier);
      }
      if (category === 'only_up_down') {
        return this.buildOnlyUpDownSnapshot(st, nowSec, ticks);
      }
      if (category === 'high_low_tick') {
        return this.buildHighLowTickSnapshot(st, nowSec);
      }
      return this.buildDigitMatchSnapshot(st, nowSec);
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
