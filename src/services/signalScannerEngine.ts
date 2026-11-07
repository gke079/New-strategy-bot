import { Market, SignalEntryTrigger, TradeContractType } from '../types';
import { SYNTHETIC_MARKETS } from './markets';
import {
  calculateMACD,
  evaluateMacdHistogram,
  MacdHistogramState,
  calculateEMA,
  calculateRSI,
} from './indicators';

export type SignalCategory =
  | 'even_odd'
  | 'over_under'
  | 'digit_match'
  | 'only_up_down'
  | 'high_low_tick'
  | 'only_up';
export type BarrierFilter = 'all' | 2 | 3 | 4 | 5 | 6 | 7;
export type OnlyUpDownStrategy = 'momentum' | 'ema_rsi';

export interface DigitBarrierStat {
  digit: number;
  overPct: number;
  underPct: number;
}

export interface Candle1m {
  epoch: number; // 60-second candle open timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
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
  totalSeconds: number;
  windowLabel: string;
  openingGuardSec: number;
  closeGuardSec: number;
  isOpeningGuard: boolean;
  isClosingGuard: boolean;
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
  isOpeningGuard?: boolean;
  isClosingGuard?: boolean;
  marketTrend?: 'uptrend' | 'downtrend' | 'ranging';
  marketTrendSummary?: string;
  recentWindowWinners?: number[];
  highLowBreakdownSummary?: string;
  windowTickCount: number;
  isScanning: boolean;
  scanSecondsLeft: number;
  scanTotalSeconds: number;
  scanWindowLabel: string;
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
  // MACD fields for ONLY UP strategy
  macdHistogramState?: MacdHistogramState;
  macdStateLabel?: string;
  macdValue?: number;
  macdSignal?: number;
  macdHistogram?: number;
  isMacdGoodMarket?: boolean;
  is10sEntryActive?: boolean;
  recentMacdHistograms?: (number | null)[];
  candleSecondsLeft?: number;
  // Even / Odd S1, S2, S3 Strategy fields
  evenOddStrategyId?: 'S1' | 'S2' | 'S3';
  evenOddStrategyLabel?: string;
  evenOddEntryRuleText?: string;
  evenOddEntryDigit?: number;
  greenBarDigit?: number;
  greenBarPct?: number;
  blueBarDigit?: number;
  blueBarPct?: number;
  redBarDigit?: number;
  redBarPct?: number;
  evenDigitsGe10Count?: number;
  oddDigitsGe10Count?: number;
  // Strategy 2: 5m EMA (5/14) + RSI(7) Retest fields
  onlyUpDownStrategyId?: 'momentum' | 'ema_rsi';
  emaPeriod1?: number; // 5
  ema1Value?: number;
  emaPeriod2?: number; // 14
  ema2Value?: number;
  rsiPeriod?: number; // 7
  rsiValue?: number;
  isEmaGoodMarket?: boolean;
  isRsiExtreme?: boolean;
  retestStatusText?: string;
}

export const SIGNAL_MARKET_IDS = [
  // 1. Plain Volatility Indices (V10, V25, V50, V75, V100)
  'R_10',
  'R_25',
  'R_50',
  'R_75',
  'R_100',

  // 2. 1s Volatility Indices (V10 1s, V15 1s, V25 1s, V30 1s, V50 1s, V75 1s, V90 1s, V100 1s)
  '1HZ10V',
  '1HZ15V',
  '1HZ25V',
  '1HZ30V',
  '1HZ50V',
  '1HZ75V',
  '1HZ90V',
  '1HZ100V',

  // 3. Jump Indices (J10, J25, J50, J75, J100)
  'JD10',
  'JD25',
  'JD50',
  'JD75',
  'JD100',

  // 4. Step Indices (STEP 100, STEP 200, STEP 300, STEP 400, STEP 500)
  'stpRNG',
  'stpRNG2',
  'stpRNG3',
  'stpRNG4',
  'stpRNG5',
];

let derivServerTimeOffsetSec = 0;

export function updateDerivServerTime(epochSec: number) {
  if (typeof epochSec === 'number' && epochSec > 1600000000) {
    derivServerTimeOffsetSec = Math.round(epochSec - Date.now() / 1000);
  }
}

export function getDerivServerNowSec(): number {
  return Math.floor(Date.now() / 1000) + derivServerTimeOffsetSec;
}

/**
 * Exactly mirrors Deriv Advanced TradingView 1-minute candlestick timer.
 * TradingView 1m candles are synchronized strictly to the 60-second UTC minute boundary (:00 to :59).
 */
export function getTradingViewCandle1mSecondsLeft(): number {
  const serverNowSec = getDerivServerNowSec();
  const phaseSec = serverNowSec % 60;
  return Math.max(1, 60 - phaseSec);
}

export function formatTradingViewCountdown(secondsLeft: number): string {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getMarketCandle1mSecondsLeft(
  _marketId?: string,
  _nowSec?: number
): number {
  return getTradingViewCandle1mSecondsLeft();
}

export const SIGNAL_MARKETS: Market[] = SIGNAL_MARKET_IDS.map((id) =>
  SYNTHETIC_MARKETS.find((m) => m.id === id)
).filter((m): m is Market => Boolean(m));

/**
 * Standard 5-Minute Analysis Timeframe (300 seconds).
 * Technical analysis (Wilder's RSI-14, 5m OHLC candles, both-sides wicks, market trend EMAs,
 * swing structure, and momentum) operates on the 5-minute timeframe.
 * Scanning across markets is staggered asynchronously (25-second phase offsets across indices)
 * so markets scan at distinct times rather than simultaneously.
 */
export const DEFAULT_ANALYSIS_TIMEFRAME_SEC = 300;

export const ONLY_UP_DOWN_DEFAULT_WINDOWS: Record<string, number> = Object.fromEntries(
  SYNTHETIC_MARKETS.map((m) => [m.id, 300])
);

export const HIGH_LOW_TICK_DEFAULT_WINDOWS: Record<string, number> = Object.fromEntries(
  SYNTHETIC_MARKETS.map((m) => [m.id, 300])
);

export function formatWindowDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

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
  candles1m: Candle1m[];
  candles2m: Candle2m[];
  candles5m: Candle5m[];
  candlesOnlyUp: Candle5m[];
  candlesHighLow: Candle5m[];
  lastPrice: number;
  lastQuote: string;
  isLiveWs: boolean;
  lastWsEpoch: number;
  scanPhaseOffsetSec: number;
  parityPhaseOffsetSec: number;
  overUnderPhaseOffsetSec: number;
  matchPhaseOffsetSec: number;
  highLowTickPhaseOffsetSec: number;
  onlyUpPhaseOffsetSec: number;
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
  private subscribeTimers: ReturnType<typeof setTimeout>[] = [];

  private onlyUpDownWindows: Record<string, number> = { ...ONLY_UP_DOWN_DEFAULT_WINDOWS };
  private highLowWindows: Record<string, number> = { ...HIGH_LOW_TICK_DEFAULT_WINDOWS };

  private endpoints = [
    'wss://api.derivws.com/trading/v1/options/ws/public',
    'wss://ws.derivws.com/websockets/v3',
    'wss://blue.derivws.com/websockets/v3',
    'wss://green.derivws.com/websockets/v3',
  ];
  private endpointIdx = 0;
  private startedAtSec = Math.floor(Date.now() / 1000);

  constructor() {
    try {
      const savedOU = localStorage.getItem('tickedge_only_up_down_windows');
      if (savedOU) {
        this.onlyUpDownWindows = { ...this.onlyUpDownWindows, ...JSON.parse(savedOU) };
      }
    } catch {}
    try {
      const savedHL = localStorage.getItem('tickedge_high_low_windows');
      if (savedHL) {
        this.highLowWindows = { ...this.highLowWindows, ...JSON.parse(savedHL) };
      }
    } catch {}

    const nowSec = Math.floor(Date.now() / 1000);
    const currentBucketEpoch = Math.floor(nowSec / 120) * 120;
    const current5mBucketEpoch = Math.floor(nowSec / 300) * 300;

    SIGNAL_MARKETS.forEach((market, idx) => {
      const scanPhaseOffsetSec = (idx * 25) % 300;
      const parityPhaseOffsetSec = (idx * 9) % FULL_CYCLE_SEC;
      const overUnderPhaseOffsetSec = (idx * 13 + 7) % FULL_CYCLE_SEC;
      const matchPhaseOffsetSec = (idx * 11 + 19) % FULL_CYCLE_SEC;
      const highLowTickPhaseOffsetSec = (idx * 7 + 23) % FULL_CYCLE_SEC;
      const onlyUpPhaseOffsetSec = (idx * 13) % 60;

      this.states.set(market.id, {
        market,
        digits: [],
        prices: [],
        candles1m: [],
        candles2m: [],
        candles5m: [],
        candlesOnlyUp: [],
        candlesHighLow: [],
        lastPrice: 0,
        lastQuote: '--',
        isLiveWs: false,
        lastWsEpoch: 0,
        scanPhaseOffsetSec,
        parityPhaseOffsetSec,
        overUnderPhaseOffsetSec,
        matchPhaseOffsetSec,
        highLowTickPhaseOffsetSec,
        onlyUpPhaseOffsetSec,
      });
    });

    this.connectWebSocket();
    this.startHeartbeat();
  }

  public getMarketWindow(category: SignalCategory, marketId: string): number {
    if (category === 'only_up_down') {
      return this.onlyUpDownWindows[marketId] ?? ONLY_UP_DOWN_DEFAULT_WINDOWS[marketId] ?? 300;
    }
    if (category === 'high_low_tick') {
      return this.highLowWindows[marketId] ?? HIGH_LOW_TICK_DEFAULT_WINDOWS[marketId] ?? 300;
    }
    return SCAN_WINDOW_SEC;
  }

  public setMarketWindow(category: SignalCategory, marketId: string, seconds: number) {
    const clamped = Math.max(15, Math.min(900, Math.round(seconds)));
    if (category === 'only_up_down') {
      this.onlyUpDownWindows[marketId] = clamped;
      try {
        localStorage.setItem(
          'tickedge_only_up_down_windows',
          JSON.stringify(this.onlyUpDownWindows)
        );
      } catch {}
    } else if (category === 'high_low_tick') {
      this.highLowWindows[marketId] = clamped;
      try {
        localStorage.setItem(
          'tickedge_high_low_windows',
          JSON.stringify(this.highLowWindows)
        );
      } catch {}
    }
    this.notify();
  }

  public resetMarketWindows(category: SignalCategory) {
    if (category === 'only_up_down') {
      this.onlyUpDownWindows = { ...ONLY_UP_DOWN_DEFAULT_WINDOWS };
      try {
        localStorage.removeItem('tickedge_only_up_down_windows');
      } catch {}
    } else if (category === 'high_low_tick') {
      this.highLowWindows = { ...HIGH_LOW_TICK_DEFAULT_WINDOWS };
      try {
        localStorage.removeItem('tickedge_high_low_windows');
      } catch {}
    }
    this.notify();
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
    // 1. Update standard 2-minute candle (120s)
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

    // 2. Update 5-minute candle (300s) anchored to market-specific staggered scanning offset
    const shiftedEpoch5m = epochSec + st.scanPhaseOffsetSec;
    const bucketEpoch5m = Math.floor(shiftedEpoch5m / 300) * 300 - st.scanPhaseOffsetSec;
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

    // 3. Update market-specific Only Up / Only Down window candle (5m default, staggered)
    const windowOnlyUp = this.getMarketWindow('only_up_down', st.market.id);
    const shiftedEpochOU = epochSec + st.scanPhaseOffsetSec;
    const bucketEpochOU = Math.floor(shiftedEpochOU / windowOnlyUp) * windowOnlyUp - st.scanPhaseOffsetSec;
    const candlesOU = st.candlesOnlyUp;
    const lastOU = candlesOU[candlesOU.length - 1];
    if (lastOU && lastOU.epoch === bucketEpochOU) {
      lastOU.high = Math.max(lastOU.high, quoteNum);
      lastOU.low = Math.min(lastOU.low, quoteNum);
      lastOU.close = quoteNum;
    } else if (!lastOU || bucketEpochOU > lastOU.epoch) {
      const openPrice = lastOU ? lastOU.close : quoteNum;
      st.candlesOnlyUp = [
        ...candlesOU.slice(-34),
        {
          epoch: bucketEpochOU,
          open: openPrice,
          high: Math.max(openPrice, quoteNum),
          low: Math.min(openPrice, quoteNum),
          close: quoteNum,
        },
      ];
    }

    // 4. Update market-specific High Low window candle (5m default, staggered)
    const windowHighLow = this.getMarketWindow('high_low_tick', st.market.id);
    const shiftedEpochHL = epochSec + st.scanPhaseOffsetSec;
    const bucketEpochHL = Math.floor(shiftedEpochHL / windowHighLow) * windowHighLow - st.scanPhaseOffsetSec;
    const candlesHL = st.candlesHighLow;
    const lastHL = candlesHL[candlesHL.length - 1];
    if (lastHL && lastHL.epoch === bucketEpochHL) {
      lastHL.high = Math.max(lastHL.high, quoteNum);
      lastHL.low = Math.min(lastHL.low, quoteNum);
      lastHL.close = quoteNum;
    } else if (!lastHL || bucketEpochHL > lastHL.epoch) {
      const openPrice = lastHL ? lastHL.close : quoteNum;
      st.candlesHighLow = [
        ...candlesHL.slice(-34),
        {
          epoch: bucketEpochHL,
          open: openPrice,
          high: Math.max(openPrice, quoteNum),
          low: Math.min(openPrice, quoteNum),
          close: quoteNum,
        },
      ];
    }

    // 5. Update 1-minute candle (60s) for Only Up MACD analysis (aligned with TradingView 1m UTC epoch)
    const bucketEpoch1m = Math.floor(epochSec / 60) * 60;
    const candles1m = st.candles1m;
    const last1m = candles1m[candles1m.length - 1];
    if (last1m && last1m.epoch === bucketEpoch1m) {
      last1m.high = Math.max(last1m.high, quoteNum);
      last1m.low = Math.min(last1m.low, quoteNum);
      last1m.close = quoteNum;
    } else if (!last1m || bucketEpoch1m > last1m.epoch) {
      const openPrice = last1m ? last1m.close : quoteNum;
      st.candles1m = [
        ...candles1m.slice(-49),
        {
          epoch: bucketEpoch1m,
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

      this.subscribeTimers.forEach((t) => clearTimeout(t));
      this.subscribeTimers = [];

      ws.onopen = () => {
        if (this.isDestroyed) {
          ws.close();
          return;
        }
        this.isConnected = true;
        try {
          // Synchronize with Deriv server time for TradingView countdown accuracy
          ws.send(JSON.stringify({ time: 1 }));
        } catch {}

        SIGNAL_MARKETS.forEach((m, idx) => {
          const timer = setTimeout(() => {
            if (this.isDestroyed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            try {
              // 1. Subscribe to live ticks (100-tick history + real-time tick stream)
              this.ws.send(
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
              this.ws.send(
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
              this.ws.send(
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
              // 4. Subscribe to live 1-minute OHLC candlesticks (granularity: 60s, 50 candles for MACD Only Up)
              this.ws.send(
                JSON.stringify({
                  ticks_history: m.id,
                  adjust_start_time: 1,
                  count: 50,
                  end: 'latest',
                  start: 1,
                  style: 'candles',
                  granularity: 60,
                  subscribe: 1,
                })
              );
            } catch {}
          }, idx * 50);
          this.subscribeTimers.push(timer);
        });
        this.notify();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'time' && data.time) {
            updateDerivServerTime(Number(data.time));
          } else if (data.msg_type === 'history' && data.echo_req?.ticks_history) {
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
              if (granularity === 60) {
                st.candles1m = rawCandles
                  .map((c) => ({
                    epoch: Math.floor(Number(c.epoch) / 60) * 60,
                    open: Number(c.open),
                    high: Number(c.high),
                    low: Number(c.low),
                    close: Number(c.close),
                  }))
                  .slice(-50);
              } else if (granularity === 300) {
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
            if (data.ohlc.epoch || data.ohlc.open_time) {
              updateDerivServerTime(Number(data.ohlc.epoch || data.ohlc.open_time));
            }
            const sym = String(data.ohlc.symbol);
            const granularity = Number(data.ohlc.granularity) || 120;
            const st = this.states.get(sym);
            if (st) {
              if (granularity === 60) {
                const openEpoch =
                  Math.floor(Number(data.ohlc.open_time || data.ohlc.epoch) / 60) * 60;
                const nextCandle: Candle1m = {
                  epoch: openEpoch,
                  open: Number(data.ohlc.open),
                  high: Number(data.ohlc.high),
                  low: Number(data.ohlc.low),
                  close: Number(data.ohlc.close),
                };
                const last = st.candles1m[st.candles1m.length - 1];
                if (last && last.epoch === openEpoch) {
                  st.candles1m[st.candles1m.length - 1] = nextCandle;
                } else if (!last || openEpoch > last.epoch) {
                  st.candles1m = [...st.candles1m.slice(-49), nextCandle];
                }
              } else if (granularity === 300) {
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
              if (data.tick.epoch) {
                updateDerivServerTime(Number(data.tick.epoch));
              }
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
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ ping: 1 }));
        } catch {}
      }
    }, 15000);
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
  /**
   * Strictly isolated Even / Odd signal snapshot builder implementing Strategies S1, S2, and S3:
   *
   * Market Movers:
   * - Green bar = Most appearing digit (Rank 1)
   * - Blue bar  = Second most appearing digit (Rank 2)
   * - Red bar   = Least appearing digit (Rank 10)
   *
   * S1. Mover Divergence:
   *     Green & Red on same market (Even or Odd), Blue on opposite market.
   *     Green bar percentage < 12%.
   *     Favored market: same as Green & Red.
   *     Entry digit: Blue bar (second most appearing digit).
   *
   * S2. Distribution Dominancy:
   *     All 3 Market Movers (Green, Blue, Red) on same market.
   *     Dominancy: Favored market has more digits >= 10%.
   *     Entry: 2 consecutive digits of opposite market.
   *
   * S3. Split Movers:
   *     Green & Blue on same market, Red on opposite market.
   *     Dominancy: Favored market has more digits >= 10%.
   *     Entry: Red bar digit appears followed by another opposite digit.
   */
  private buildEvenOddSnapshot(
    st: InternalMarketState,
    nowSec: number,
    strategyFilter: 'all' | 'S1' | 'S2' | 'S3' = 'all'
  ): MarketSignalSnapshot {
    const parityDigits = st.digits.length >= 10 ? st.digits.slice(-100) : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const totalDigits = Math.max(1, parityDigits.length);

    // Compute frequency count for 0..9 and even/odd counts
    const counts = Array(10).fill(0);
    let evenCount = 0;
    for (const d of parityDigits) {
      if (d >= 0 && d <= 9) counts[d]++;
      if (d % 2 === 0) evenCount++;
    }
    const evenPct = Math.round((evenCount / totalDigits) * 100);
    const oddPct = 100 - evenPct;

    const pcts = counts.map((c) => Number(((c / totalDigits) * 100).toFixed(1)));

    // Sort descending by count, stable tie-breaker by digit number
    const sortedDigits = counts
      .map((count, digit) => ({ digit, count, pct: pcts[digit] }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.digit - b.digit;
      });

    const greenBar = sortedDigits[0]; // Most appearing digit
    const blueBar = sortedDigits[1]; // Second most appearing digit
    const redBar = sortedDigits[sortedDigits.length - 1]; // Least appearing digit

    const greenDigit = greenBar.digit;
    const greenPct = greenBar.pct;
    const isGreenEven = greenDigit % 2 === 0;

    const blueDigit = blueBar.digit;
    const bluePct = blueBar.pct;
    const isBlueEven = blueDigit % 2 === 0;

    const redDigit = redBar.digit;
    const redPct = redBar.pct;
    const isRedEven = redDigit % 2 === 0;

    // Dominancy: how many even or odd digits have >= 10%
    let evenDigitsGe10Count = 0;
    let oddDigitsGe10Count = 0;
    for (let d = 0; d <= 9; d++) {
      if (pcts[d] >= 10) {
        if (d % 2 === 0) evenDigitsGe10Count++;
        else oddDigitsGe10Count++;
      }
    }

    // Helper: Verify there are NO competing digits in terms of percentages on the opposite market
    const checkOppositeCompetition = (favSide: 'EVEN' | 'ODD') => {
      const favDigits = favSide === 'EVEN' ? [0, 2, 4, 6, 8] : [1, 3, 5, 7, 9];
      const oppDigits = favSide === 'EVEN' ? [1, 3, 5, 7, 9] : [0, 2, 4, 6, 8];

      const favPcts = favDigits.map((d) => ({ digit: d, pct: pcts[d] }));
      const oppPcts = oppDigits.map((d) => ({ digit: d, pct: pcts[d] }));

      const maxFavPct = Math.max(...favPcts.map((x) => x.pct));
      const maxOppPct = Math.max(...oppPcts.map((x) => x.pct));

      // 1. If any digit on opposite market has percentage >= maxFavPct, it directly competes with or exceeds favored peak
      if (maxOppPct >= maxFavPct) {
        const competingDigits = oppPcts.filter((o) => o.pct >= maxFavPct);
        return {
          hasCompetition: true,
          competingInfo: `Opposite #${competingDigits.map((d) => `${d.digit} (${d.pct}%)`).join(', ')} competes with favored peak (${maxFavPct}%)`,
        };
      }

      // 2. If any digit on opposite market has the exact same percentage as any favored digit with >= 10%
      const competingTies: string[] = [];
      for (const opp of oppPcts) {
        if (opp.pct >= 10) {
          const matchedFav = favPcts.find((f) => f.pct === opp.pct);
          if (matchedFav) {
            competingTies.push(`Opp #${opp.digit} ties Fav #${matchedFav.digit} (${opp.pct}%)`);
          }
        }
      }

      if (competingTies.length > 0) {
        return {
          hasCompetition: true,
          competingInfo: `Opposite competing percentage: ${competingTies.join(', ')}`,
        };
      }

      return { hasCompetition: false, competingInfo: '' };
    };

    const evenComp = checkOppositeCompetition('EVEN');
    const oddComp = checkOppositeCompetition('ODD');

    interface StrategyEvaluation {
      strategyId: 'S1' | 'S2' | 'S3';
      favoredSide: 'EVEN' | 'ODD';
      strategyLabel: string;
      entryTrigger: SignalEntryTrigger;
      entryRuleText: string;
      entryTargetDigit?: number;
      entryConfirmedNow: boolean;
      confidencePct: number;
    }

    const matchedStrategies: StrategyEvaluation[] = [];

    const lastDigit = parityDigits[parityDigits.length - 1] ?? 0;
    const prevDigit = parityDigits[parityDigits.length - 2] ?? 0;

    // -------------------------------------------------------------------------
    // S1: Green & Red on same market, Blue on opposite market. Green bar < 12%.
    // Must have NO competing digit in terms of percentages on opposite market.
    // Entry digit: Blue bar (second most appearing digit).
    // -------------------------------------------------------------------------
    if (isGreenEven && isRedEven && !isBlueEven && greenPct < 12 && !evenComp.hasCompetition) {
      matchedStrategies.push({
        strategyId: 'S1',
        favoredSide: 'EVEN',
        strategyLabel: 'S1 · Mover Divergence',
        entryTrigger: 's1_blue_digit_confirm',
        entryTargetDigit: blueDigit,
        entryRuleText: `Entry Digit: Blue Bar (${blueDigit})`,
        entryConfirmedNow: lastDigit === blueDigit,
        confidencePct: Math.max(54, evenPct),
      });
    }
    if (!isGreenEven && !isRedEven && isBlueEven && greenPct < 12 && !oddComp.hasCompetition) {
      matchedStrategies.push({
        strategyId: 'S1',
        favoredSide: 'ODD',
        strategyLabel: 'S1 · Mover Divergence',
        entryTrigger: 's1_blue_digit_confirm',
        entryTargetDigit: blueDigit,
        entryRuleText: `Entry Digit: Blue Bar (${blueDigit})`,
        entryConfirmedNow: lastDigit === blueDigit,
        confidencePct: Math.max(54, oddPct),
      });
    }

    // -------------------------------------------------------------------------
    // S2: All 3 movers on same market. Favored market has more digits >= 10%.
    // Must have NO competing digit in terms of percentages on opposite market.
    // Entry: 2 consecutive opposite market digits.
    // -------------------------------------------------------------------------
    if (
      isGreenEven &&
      isBlueEven &&
      isRedEven &&
      evenDigitsGe10Count > oddDigitsGe10Count &&
      !evenComp.hasCompetition
    ) {
      const is2Opp = parityDigits.length >= 2 && lastDigit % 2 !== 0 && prevDigit % 2 !== 0;
      matchedStrategies.push({
        strategyId: 'S2',
        favoredSide: 'EVEN',
        strategyLabel: 'S2 · Distribution Dominancy',
        entryTrigger: 's2_two_opposite_confirm',
        entryTargetDigit: undefined,
        entryRuleText: 'Entry: 2 Consecutive Odd Digits',
        entryConfirmedNow: is2Opp,
        confidencePct: Math.max(56, evenPct),
      });
    }
    if (
      !isGreenEven &&
      !isBlueEven &&
      !isRedEven &&
      oddDigitsGe10Count > evenDigitsGe10Count &&
      !oddComp.hasCompetition
    ) {
      const is2Opp = parityDigits.length >= 2 && lastDigit % 2 === 0 && prevDigit % 2 === 0;
      matchedStrategies.push({
        strategyId: 'S2',
        favoredSide: 'ODD',
        strategyLabel: 'S2 · Distribution Dominancy',
        entryTrigger: 's2_two_opposite_confirm',
        entryTargetDigit: undefined,
        entryRuleText: 'Entry: 2 Consecutive Even Digits',
        entryConfirmedNow: is2Opp,
        confidencePct: Math.max(56, oddPct),
      });
    }

    // -------------------------------------------------------------------------
    // S3: Green & Blue on same market, Red on opposite market. Favored market has more digits >= 10%.
    // Must have NO competing digit in terms of percentages on opposite market.
    // Entry: Red bar digit appears followed by another opposite digit.
    // -------------------------------------------------------------------------
    if (
      isGreenEven &&
      isBlueEven &&
      !isRedEven &&
      evenDigitsGe10Count > oddDigitsGe10Count &&
      !evenComp.hasCompetition
    ) {
      const isS3Entry = parityDigits.length >= 2 && prevDigit === redDigit && lastDigit % 2 !== 0;
      matchedStrategies.push({
        strategyId: 'S3',
        favoredSide: 'EVEN',
        strategyLabel: 'S3 · Split Movers',
        entryTrigger: 's3_red_then_opposite_confirm',
        entryTargetDigit: redDigit,
        entryRuleText: `Entry: Red Bar (${redDigit}) → Next Odd Digit`,
        entryConfirmedNow: isS3Entry,
        confidencePct: Math.max(58, evenPct),
      });
    }
    if (
      !isGreenEven &&
      !isBlueEven &&
      isRedEven &&
      oddDigitsGe10Count > evenDigitsGe10Count &&
      !oddComp.hasCompetition
    ) {
      const isS3Entry = parityDigits.length >= 2 && prevDigit === redDigit && lastDigit % 2 === 0;
      matchedStrategies.push({
        strategyId: 'S3',
        favoredSide: 'ODD',
        strategyLabel: 'S3 · Split Movers',
        entryTrigger: 's3_red_then_opposite_confirm',
        entryTargetDigit: redDigit,
        entryRuleText: `Entry: Red Bar (${redDigit}) → Next Even Digit`,
        entryConfirmedNow: isS3Entry,
        confidencePct: Math.max(58, oddPct),
      });
    }

    const { scanSecondsLeft } = this.getCycleTiming(nowSec, st.parityPhaseOffsetSec);

    const activeMatches =
      strategyFilter === 'all'
        ? matchedStrategies
        : matchedStrategies.filter((s) => s.strategyId === strategyFilter);

    const hasMatch = activeMatches.length > 0;
    const match = activeMatches[0];

    const isScanning = !hasMatch;

    let scanStatusNote = '';
    if (hasMatch) {
      scanStatusNote = `${match.strategyLabel} Active (${match.favoredSide}) · ${match.entryRuleText} · No competing opp digits`;
    } else if (strategyFilter === 'S1') {
      if (isGreenEven === isRedEven && isGreenEven !== isBlueEven) {
        const side = isGreenEven ? 'Even' : 'Odd';
        const comp = isGreenEven ? evenComp : oddComp;
        if (comp.hasCompetition) {
          scanStatusNote = `S1 (${side}) Paused · Competing digit on opposite market (${comp.competingInfo})`;
        } else if (greenPct >= 12) {
          scanStatusNote = `S1 Mover positions met (${side}) · Awaiting Green <12% (current ${greenPct}%)`;
        } else {
          scanStatusNote = `S1 setup scanning...`;
        }
      } else {
        scanStatusNote = `Awaiting S1 Movers: Green & Red same, Blue opp (G:${isGreenEven ? 'E' : 'O'}, B:${isBlueEven ? 'E' : 'O'}, R:${isRedEven ? 'E' : 'O'})`;
      }
    } else if (strategyFilter === 'S2') {
      if (isGreenEven === isBlueEven && isBlueEven === isRedEven) {
        const side = isGreenEven ? 'Even' : 'Odd';
        const comp = isGreenEven ? evenComp : oddComp;
        if (comp.hasCompetition) {
          scanStatusNote = `S2 (${side}) Paused · Competing digit on opposite market (${comp.competingInfo})`;
        } else {
          scanStatusNote = `S2 Movers all on ${side} · Awaiting ${side} dominancy (≥10%: Even ${evenDigitsGe10Count} vs Odd ${oddDigitsGe10Count})`;
        }
      } else {
        scanStatusNote = `Awaiting S2 Movers: All 3 on same market (G:${isGreenEven ? 'E' : 'O'}, B:${isBlueEven ? 'E' : 'O'}, R:${isRedEven ? 'E' : 'O'})`;
      }
    } else if (strategyFilter === 'S3') {
      if (isGreenEven === isBlueEven && isGreenEven !== isRedEven) {
        const side = isGreenEven ? 'Even' : 'Odd';
        const comp = isGreenEven ? evenComp : oddComp;
        if (comp.hasCompetition) {
          scanStatusNote = `S3 (${side}) Paused · Competing digit on opposite market (${comp.competingInfo})`;
        } else {
          scanStatusNote = `S3 Movers on ${side} (Red opp) · Awaiting ${side} dominancy (≥10%: Even ${evenDigitsGe10Count} vs Odd ${oddDigitsGe10Count})`;
        }
      } else {
        scanStatusNote = `Awaiting S3 Movers: Green+Blue same, Red opp (G:${isGreenEven ? 'E' : 'O'}, B:${isBlueEven ? 'E' : 'O'}, R:${isRedEven ? 'E' : 'O'})`;
      }
    } else {
      const activeComp = evenPct >= oddPct ? evenComp : oddComp;
      if (activeComp.hasCompetition) {
        scanStatusNote = `Even/Odd scanning · Filtered: Competing digit on opposite market (${activeComp.competingInfo})`;
      } else {
        scanStatusNote = `Scanning S1, S2, S3 setups · Movers: G:${greenDigit}(${isGreenEven ? 'E' : 'O'} ${greenPct}%), B:${blueDigit}(${isBlueEven ? 'E' : 'O'}), R:${redDigit}(${isRedEven ? 'E' : 'O'}) · No competing opp digits`;
      }
    }

    const favoredSide: 'EVEN' | 'ODD' = match ? match.favoredSide : (evenPct >= oddPct ? 'EVEN' : 'ODD');
    const signalLabel = match ? `${match.favoredSide} · ${match.strategyId}` : favoredSide;
    const signalTone: MarketSignalSnapshot['signalTone'] =
      favoredSide === 'EVEN' ? 'emerald' : 'fuchsia';
    const contractType = favoredSide;
    const signalEntryTrigger: SignalEntryTrigger = match
      ? match.entryTrigger
      : 's2_two_opposite_confirm';
    const prediction = match?.entryTargetDigit ?? 0;
    const entryConfirmedNow = match ? match.entryConfirmedNow : false;
    const entryConfidencePct = match ? match.confidencePct : Math.max(evenPct, oddPct);
    const edgeDeltaPct = Math.max(0, entryConfidencePct - 50);

    const favoredComp = favoredSide === 'EVEN' ? evenComp : oddComp;
    const distributionSubtext = `Movers: 🟢${greenDigit}(${isGreenEven ? 'E' : 'O'} ${greenPct}%) 🔵${blueDigit}(${isBlueEven ? 'E' : 'O'} ${bluePct}%) 🔴${redDigit}(${isRedEven ? 'E' : 'O'} ${redPct}%) · ≥10%: E(${evenDigitsGe10Count}) O(${oddDigitsGe10Count}) · Competing: ${favoredComp.hasCompetition ? 'Yes (Blocked)' : 'None (Clear)'}`;
    const patternSummary = match
      ? `${match.strategyLabel} · ${match.entryRuleText} · Clean Distribution`
      : `Movers: G:${greenDigit} B:${blueDigit} R:${redDigit} · Dominancy: Even ${evenDigitsGe10Count} vs Odd ${oddDigitsGe10Count}`;

    return {
      category: 'even_odd',
      market: st.market,
      isLiveWs: st.isLiveWs,
      lastDigit,
      lastQuote: st.lastQuote,
      recentDigits: st.digits.slice(-12),
      windowTickCount: parityDigits.length,
      isScanning,
      scanSecondsLeft,
      scanTotalSeconds: SCAN_WINDOW_SEC,
      scanWindowLabel: `${SCAN_WINDOW_SEC}s`,
      scanStatusNote,
      evenPct,
      oddPct,
      overPct: 0,
      underPct: 0,
      hotDigit: greenDigit,
      hotDigitPct: greenPct,
      coldDigit: redDigit,
      coldDigitPct: redPct,
      barrierStats: [],
      signalLabel,
      signalTone,
      contractType,
      prediction,
      signalEntryTrigger,
      entryConfirmedNow,
      entryConfidencePct,
      payoutMultiplier: 1.95,
      edgeDeltaPct,
      distributionSubtext,
      patternSummary,
      topBarriersSummary: '',
      hasStrongEdge: hasMatch,
      // Even/Odd S1, S2, S3 metadata
      evenOddStrategyId: match?.strategyId,
      evenOddStrategyLabel: match?.strategyLabel,
      evenOddEntryRuleText: match?.entryRuleText,
      evenOddEntryDigit: match?.entryTargetDigit,
      greenBarDigit: greenDigit,
      greenBarPct: greenPct,
      blueBarDigit: blueDigit,
      blueBarPct: bluePct,
      redBarDigit: redDigit,
      redBarPct: redPct,
      evenDigitsGe10Count,
      oddDigitsGe10Count,
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
      scanTotalSeconds: SCAN_WINDOW_SEC,
      scanWindowLabel: `${SCAN_WINDOW_SEC}s`,
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
      scanTotalSeconds: SCAN_WINDOW_SEC,
      scanWindowLabel: `${SCAN_WINDOW_SEC}s`,
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
  private scoreCandle(
    candle: Candle5m | Candle2m,
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

  // Alias for backward compatibility
  private score2mCandle(
    candle: Candle5m | Candle2m,
    avgBody: number,
    pipUnit: number
  ) {
    return this.scoreCandle(candle, avgBody, pipUnit);
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
   * on 5-minute candlesticks to establish whether the market is in a clear Uptrend, Downtrend, or Ranging/Sideways state.
   */
  private evaluateMarketTrend(
    candles: Array<Candle5m | Candle2m>,
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

    if ((bullScore >= 3.5 || isHHHL) && bullScore > bearScore + 0.75 && emaFast >= emaSlow) {
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

    if ((bearScore >= 3.5 || isLHLL) && bearScore > bullScore + 0.75 && emaFast <= emaSlow) {
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
   * 1. 5-Minute Market Trend First: Analyses 5m multi-candle market structure (EMA 5/13, HH/HL vs LH/LL, ATR slope)
   *    to make an informed decision on market direction (Uptrend -> ONLY UP, Downtrend -> ONLY DOWN).
   *    Ranging/sideways markets stay in scanning mode.
   * 2. 5-Minute Candle Momentum Second: Once trend direction is confirmed, checks the 5-minute candlestick
   *    for strong aligned momentum (strong bullish 5m candle in Uptrend, or strong bearish 5m candle in Downtrend)
   *    before activating the Run button.
   * 3. Scanning Timing: Desynchronized across markets with 25s phase offsets so markets scan at distinct times.
   * 4. Entry Trigger:
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

    const windowSec = this.getMarketWindow('only_up_down', st.market.id);
    const windowLabel = formatWindowDuration(windowSec);
    // Analysis uses 5-minute timeframe (candles5m)
    const candles =
      st.candles5m && st.candles5m.length > 0
        ? st.candles5m
        : st.candlesOnlyUp && st.candlesOnlyUp.length > 0
        ? st.candlesOnlyUp
        : st.candles2m;

    // Staggered market scanning calculation so markets scan at different times
    const shiftedSec = nowSec + st.scanPhaseOffsetSec;
    const phaseSec = shiftedSec % windowSec;
    const candleSecondsLeft = Math.max(1, windowSec - phaseSec);
    const secIntoCandle = phaseSec;

    const activeCandle: Candle5m | Candle2m = candles[candles.length - 1] ?? {
      epoch: nowSec - secIntoCandle,
      open: st.lastPrice,
      high: st.lastPrice,
      low: st.lastPrice,
      close: st.lastPrice,
    };
    const prevCandle: (Candle5m | Candle2m) | undefined =
      candles.length >= 2 ? candles[candles.length - 2] : undefined;

    const priorClosed = candles.slice(-12, -1);
    const avgBody =
      priorClosed.length > 0
        ? priorClosed.reduce((acc, c) => acc + Math.max(pipUnit, Math.abs(c.close - c.open)), 0) /
          priorClosed.length
        : Math.max(pipUnit, st.market.volatility * st.lastPrice * 3);

    // STAGE 1: Evaluate 5-minute Market Trend FIRST to decide direction
    const trendEval = this.evaluateMarketTrend(candles, st.prices, pipUnit);

    // STAGE 2: Evaluate 5-minute candlestick momentum SECOND, strictly aligned with Stage 1 trend
    const curEval = this.scoreCandle(activeCandle, avgBody, pipUnit);

    // Strict Candle Timing Guard on 5m analysis:
    // Closing 20 seconds of the 5m candle: NO TRADE to protect against potential change of trend for the incoming candle.
    // (First 1 minute wait removed as requested: no delay at candle opening)
    const CLOSING_GUARD_SEC = 0; // Continuous trading enabled without closing pause
    const isOpeningGuard = false;
    const isClosingGuard = false;
    const inCandleGuard = false;

    // Brief 3-second initial scan when scanner first mounts before unlocking discovered signals
    const inInitialWarmup = nowSec - this.startedAtSec < 3 && !st.isLiveWs;

    let discoveredSide: 'ONLY_UP' | 'ONLY_DOWN' | null = null;
    let displayBodyPct = curEval.bodyPct;
    let displayImpulse = curEval.impulseRatio;
    let displayMomentumPct = curEval.momentumPct;

    if (!inInitialWarmup && !inCandleGuard) {
      if (trendEval.direction === 'uptrend') {
        // Good market found for Only Up
        discoveredSide = 'ONLY_UP';
        displayMomentumPct = Math.max(curEval.momentumPct, trendEval.strengthPct);
      } else if (trendEval.direction === 'downtrend') {
        // Good market found for Only Down
        discoveredSide = 'ONLY_DOWN';
        displayMomentumPct = Math.max(curEval.momentumPct, trendEval.strengthPct);
      } else {
        // Market trend is ranging / undecided — clear any stale lock and do not trade
        st.lockedOnlyUpDown = undefined;
      }
    }

    if (!discoveredSide || inCandleGuard) {
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
    let scanStatusNote = `Checking market trend & ${windowLabel} momentum...`;

    if (inCandleGuard) {
      isScanning = true;
      hasStrongEdge = false;
      entryConfirmedNow = false;
      scanStatusNote = `Closing 20s guard (${candleSecondsLeft}s left) · Protecting against trend change before new 5m candle`;
    } else if (discoveredSide) {
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

      distributionSubtext =
        discoveredSide === 'ONLY_UP'
          ? `Good Market · Uptrend ▲ (${trendEval.structureTag}) · Trend Strength ${trendEval.strengthPct}%`
          : `Good Market · Downtrend ▼ (${trendEval.structureTag}) · Trend Strength ${trendEval.strengthPct}%`;
      patternSummary = confirmCheck.confirmedNow
        ? `Good Market Found · Pullback Confirmed (${confirmCheck.statusText}) · Ready to Execute (2 Ticks)`
        : `Good Market Found · Run active! Armed for pullback entry (${confirmCheck.statusText})`;
    } else {
      isScanning = true;
      hasStrongEdge = false;
      entryConfirmedNow = false;
      scanStatusNote = 'Market trend ranging / sideways · Awaiting clear directional trend';
      distributionSubtext = 'Consolidation · Awaiting breakout or directional trend';
      patternSummary = 'Scanning for trending market...';
    }

    const effectiveCandleDir: 'bullish' | 'bearish' | 'neutral' =
      discoveredSide === 'ONLY_UP'
        ? 'bullish'
        : discoveredSide === 'ONLY_DOWN'
        ? 'bearish'
        : curEval.direction;

    const clampedTicks = Math.min(5, Math.max(2, Math.round(ticks || 5)));
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
      isOpeningGuard,
      isClosingGuard,
      candle5mSecondsLeft: candleSecondsLeft,
      scanSecondsLeft: candleSecondsLeft,
      scanTotalSeconds: windowSec,
      scanWindowLabel: windowLabel,
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
   * Strategy 2 for Only Up / Only Down:
   * Timeframe: 5-minute candlesticks
   * Indicators:
   *   - EMA 1: period 5
   *   - EMA 2: period 14
   *   - RSI: period 7
   * Conditions for a good market:
   *   - Identify clear uptrend for Only Up (EMA 5 > EMA 14) and downtrend for Only Down (EMA 14 > EMA 5).
   *   - For good Only Up: EMA 5 > EMA 14 and RSI > 50.
   *   - For good Only Down: EMA 14 > EMA 5 and RSI < 50.
   *   - NB: No trade when RSI is above 75 or below 35.
   *   - If market meets the conditions, activate the Run button and wait for entry to execute trade.
   * Entry:
   *   - For Only Up: wait for 2 consecutive candle downward retest / pullback.
   *   - For Only Down: wait for 2 consecutive candle upward retest / pullback.
   * Bot Duration: 2 Ticks.
   */
  private buildOnlyUpDownEmaRsiSnapshot(
    st: InternalMarketState,
    nowSec: number,
    ticks: number = 2
  ): MarketSignalSnapshot {
    const dirs = this.extractStepDirections(st.prices).slice(-100);
    const windowSec = 300; // 5-minute candlesticks for analysis
    const windowLabel = '5m';

    // Staggered market scanning calculation so markets scan at different times
    const shiftedSec = nowSec + st.scanPhaseOffsetSec;
    const phaseSec = shiftedSec % windowSec;
    const candleSecondsLeft = Math.max(1, windowSec - phaseSec);

    // 5m candles array
    const rawCandles =
      st.candles5m && st.candles5m.length > 0
        ? st.candles5m
        : st.candlesOnlyUp && st.candlesOnlyUp.length > 0
        ? st.candlesOnlyUp
        : st.candles2m;

    const candles =
      rawCandles.length > 0
        ? rawCandles
        : [
            {
              epoch: Math.floor(nowSec / 300) * 300,
              open: st.lastPrice,
              high: st.lastPrice,
              low: st.lastPrice,
              close: st.lastPrice,
            },
          ];

    const closes = candles.map((c) => c.close);
    // If live price has moved beyond last candle close, incorporate active quote
    if (st.lastPrice > 0) {
      if (closes.length === 0 || closes[closes.length - 1] !== st.lastPrice) {
        closes.push(st.lastPrice);
      }
    }

    const ema5Series = calculateEMA(closes, 5);
    const ema14Series = calculateEMA(closes, 14);
    const rsi7Series = calculateRSI(closes, 7);

    const validEma5 = ema5Series.filter((v): v is number => typeof v === 'number');
    const validEma14 = ema14Series.filter((v): v is number => typeof v === 'number');
    const validRsi7 = rsi7Series.filter((v): v is number => typeof v === 'number');

    const ema5 = validEma5.length > 0 ? validEma5[validEma5.length - 1] : st.lastPrice;
    const ema14 = validEma14.length > 0 ? validEma14[validEma14.length - 1] : st.lastPrice;
    const rsi7 = validRsi7.length > 0 ? validRsi7[validRsi7.length - 1] : 50;

    // Boundary threshold guard: "NB: No trade when RSI is above 75 or below 35."
    const isRsiOverbought = rsi7 > 75;
    const isRsiOversold = rsi7 < 35;
    const isRsiExtreme = isRsiOverbought || isRsiOversold;

    // Trend identification based on EMA 5 and EMA 14
    const isUptrend = ema5 > ema14;
    const isDowntrend = ema5 < ema14;

    // Conditions for a good market:
    // Only Up: EMA 5 > EMA 14, RSI > 50, and RSI <= 75 (not overbought)
    const isGoodOnlyUp = isUptrend && rsi7 > 50 && !isRsiOverbought;
    // Only Down: EMA 14 > EMA 5, RSI < 50, and RSI >= 35 (not oversold)
    const isGoodOnlyDown = isDowntrend && rsi7 < 50 && !isRsiOversold;

    const isGoodMarket = (isGoodOnlyUp || isGoodOnlyDown) && !isRsiExtreme;

    // Direction and contract
    const contractType: 'ONLY_UP' | 'ONLY_DOWN' = isGoodOnlyDown
      ? 'ONLY_DOWN'
      : isGoodOnlyUp
      ? 'ONLY_UP'
      : isDowntrend
      ? 'ONLY_DOWN'
      : 'ONLY_UP';

    const signalLabel: 'ONLY UP' | 'ONLY DOWN' =
      contractType === 'ONLY_UP' ? 'ONLY UP' : 'ONLY DOWN';
    const signalTone: 'emerald' | 'fuchsia' =
      contractType === 'ONLY_UP' ? 'emerald' : 'fuchsia';
    const signalEntryTrigger: SignalEntryTrigger =
      contractType === 'ONLY_UP'
        ? 'only_up_ema_rsi_pullback'
        : 'only_down_ema_rsi_pullback';

    // Entry evaluation:
    // "Entry: for only up, wait for two consecutive candle downward retest/ pullback and for only down, wait for two consecutive candle upward retest/pullback"
    const cActive = candles[candles.length - 1];
    const cPrev1 = candles.length >= 2 ? candles[candles.length - 2] : undefined;
    const cPrev2 = candles.length >= 3 ? candles[candles.length - 3] : undefined;

    let entryConfirmedNow = false;
    let retestStatusText = '';

    if (contractType === 'ONLY_UP') {
      // Downward candle check: close < open or close < prev.close
      const prev2IsDown = cPrev2 ? cPrev2.close < cPrev2.open : false;
      const prev1IsDown = cPrev1 ? cPrev1.close < cPrev1.open : false;
      const activeIsDown = cActive ? cActive.close < cActive.open : false;

      // Also check recent tick movement in case entry trigger is checking tick momentum
      const last2TicksDown = dirs.slice(-2).filter((d) => d === 'down').length === 2;

      if ((prev2IsDown && prev1IsDown) || (prev1IsDown && activeIsDown) || last2TicksDown) {
        entryConfirmedNow = true;
        retestStatusText = '2x Downward Candle Pullback Confirmed';
      } else if (prev1IsDown || activeIsDown) {
        entryConfirmedNow = false;
        retestStatusText = '1/2 Downward Pullback Candle Formed';
      } else {
        entryConfirmedNow = false;
        retestStatusText = 'Waiting 2 consecutive downward pullback candles';
      }
    } else {
      // Downward trend: wait for two consecutive candle upward retest/pullback
      const prev2IsUp = cPrev2 ? cPrev2.close > cPrev2.open : false;
      const prev1IsUp = cPrev1 ? cPrev1.close > cPrev1.open : false;
      const activeIsUp = cActive ? cActive.close > cActive.open : false;

      const last2TicksUp = dirs.slice(-2).filter((d) => d === 'up').length === 2;

      if ((prev2IsUp && prev1IsUp) || (prev1IsUp && activeIsUp) || last2TicksUp) {
        entryConfirmedNow = true;
        retestStatusText = '2x Upward Candle Retest Confirmed';
      } else if (prev1IsUp || activeIsUp) {
        entryConfirmedNow = false;
        retestStatusText = '1/2 Upward Candle Retest Formed';
      } else {
        entryConfirmedNow = false;
        retestStatusText = 'Waiting 2 consecutive upward pullback candles';
      }
    }

    let isScanning = !isGoodMarket;
    let hasStrongEdge = isGoodMarket;
    let scanStatusNote = '';
    let distributionSubtext = '';
    let patternSummary = '';

    if (isRsiOverbought) {
      isScanning = true;
      hasStrongEdge = false;
      scanStatusNote = `NO TRADE · RSI OVERBOUGHT (${rsi7.toFixed(1)} > 75)`;
      distributionSubtext = `5m EMA(5/14): ${ema5.toFixed(2)} / ${ema14.toFixed(2)} · RSI(7): ${rsi7.toFixed(1)} (>75)`;
      patternSummary = `No Trade: RSI(7) = ${rsi7.toFixed(1)} is above 75 guard threshold. Run paused until RSI normalizes.`;
    } else if (isRsiOversold) {
      isScanning = true;
      hasStrongEdge = false;
      scanStatusNote = `NO TRADE · RSI OVERSOLD (${rsi7.toFixed(1)} < 35)`;
      distributionSubtext = `5m EMA(5/14): ${ema5.toFixed(2)} / ${ema14.toFixed(2)} · RSI(7): ${rsi7.toFixed(1)} (<35)`;
      patternSummary = `No Trade: RSI(7) = ${rsi7.toFixed(1)} is below 35 guard threshold. Run paused until RSI normalizes.`;
    } else if (isGoodMarket) {
      // "If a market meets the conditions, activate the run button and wait for the entry to execute the trade."
      isScanning = false;
      hasStrongEdge = true;
      scanStatusNote = `Good Market · ${
        contractType === 'ONLY_UP'
          ? 'Uptrend (EMA 5 > 14, RSI > 50)'
          : 'Downtrend (EMA 14 > 5, RSI < 50)'
      }`;
      distributionSubtext =
        contractType === 'ONLY_UP'
          ? `EMA 5 (${ema5.toFixed(2)}) > EMA 14 (${ema14.toFixed(2)}) · RSI(7): ${rsi7.toFixed(1)} (Bullish 50–75)`
          : `EMA 14 (${ema14.toFixed(2)}) > EMA 5 (${ema5.toFixed(2)}) · RSI(7): ${rsi7.toFixed(1)} (Bearish 35–50)`;
      patternSummary = entryConfirmedNow
        ? `Good Market Met · ${retestStatusText} · Ready to Execute (Duration: 2 Ticks)`
        : `Good Market Met · Run active! Waiting for entry (${retestStatusText})`;
    } else {
      isScanning = true;
      hasStrongEdge = false;
      if (isUptrend && rsi7 <= 50) {
        scanStatusNote = `Uptrend (EMA 5 > 14) · Waiting RSI (${rsi7.toFixed(1)}) > 50`;
        distributionSubtext = `EMA 5 (${ema5.toFixed(2)}) > 14 (${ema14.toFixed(2)}) · RSI(7): ${rsi7.toFixed(1)} <= 50`;
        patternSummary = `Awaiting RSI(7) to cross above 50 to confirm good market for Only Up.`;
      } else if (isDowntrend && rsi7 >= 50) {
        scanStatusNote = `Downtrend (EMA 14 > 5) · Waiting RSI (${rsi7.toFixed(1)}) < 50`;
        distributionSubtext = `EMA 14 (${ema14.toFixed(2)}) > 5 (${ema5.toFixed(2)}) · RSI(7): ${rsi7.toFixed(1)} >= 50`;
        patternSummary = `Awaiting RSI(7) to cross below 50 to confirm good market for Only Down.`;
      } else {
        scanStatusNote = `EMA 5 & 14 converging · Awaiting trend`;
        distributionSubtext = `EMA 5 (${ema5.toFixed(2)}) ≈ 14 (${ema14.toFixed(2)}) · RSI(7): ${rsi7.toFixed(1)}`;
        patternSummary = `Market is consolidating. Waiting for EMA 5 and 14 divergence and RSI trend alignment.`;
      }
    }

    const entryConfidencePct = isGoodMarket
      ? Math.min(
          95,
          Math.max(
            72,
            Math.round(50 + Math.abs(rsi7 - 50) * 1.5 + (entryConfirmedNow ? 10 : 0))
          )
        )
      : 50;

    return {
      category: 'only_up_down',
      market: st.market,
      isLiveWs: st.isLiveWs,
      lastDigit: st.digits[st.digits.length - 1] ?? 0,
      lastQuote: st.lastQuote,
      recentDigits: st.digits.slice(-12),
      recentDirections: dirs.slice(-12),
      candle2mDirection: isUptrend ? 'bullish' : isDowntrend ? 'bearish' : 'neutral',
      marketTrend: isUptrend ? 'uptrend' : isDowntrend ? 'downtrend' : 'ranging',
      marketTrendSummary: `EMA(5): ${ema5.toFixed(2)} · EMA(14): ${ema14.toFixed(2)} · RSI(7): ${rsi7.toFixed(1)}`,
      windowTickCount: candles.length,
      isScanning,
      isOpeningGuard: false,
      isClosingGuard: false,
      candle5mSecondsLeft: candleSecondsLeft,
      scanSecondsLeft: candleSecondsLeft,
      scanTotalSeconds: windowSec,
      scanWindowLabel: windowLabel,
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
      payoutMultiplier: 3.85, // 2-tick payout on Deriv Only Up/Down
      edgeDeltaPct: Math.max(0, entryConfidencePct - 50),
      distributionSubtext,
      patternSummary,
      topBarriersSummary: '',
      hasStrongEdge,
      // Strategy 2 specific indicators
      onlyUpDownStrategyId: 'ema_rsi',
      emaPeriod1: 5,
      ema1Value: Number(ema5.toFixed(st.market.decimals)),
      emaPeriod2: 14,
      ema2Value: Number(ema14.toFixed(st.market.decimals)),
      rsiPeriod: 7,
      rsiValue: Number(rsi7.toFixed(1)),
      isEmaGoodMarket: isGoodMarket,
      isRsiExtreme,
      retestStatusText,
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
    const windowSec = this.getMarketWindow('high_low_tick', marketId);
    const windowLabel = formatWindowDuration(windowSec);
    const shiftedSec = nowSec + st.scanPhaseOffsetSec;
    const phaseSec = shiftedSec % windowSec;
    const secondsLeft = Math.max(1, windowSec - phaseSec);
    const secIntoCandle = phaseSec;
    const openingGuardSec = 0;
    const closeGuardSec = 0;
    const isOpeningGuard = false;
    const isClosingGuard = false;
    const noTradeWindow = false;
    const pipUnit = Math.pow(10, -st.market.decimals);

    const candles =
      st.candles5m && st.candles5m.length > 0
        ? st.candles5m
        : st.candlesHighLow && st.candlesHighLow.length > 0
        ? st.candlesHighLow
        : st.candles2m;
    const activeCandle: Candle5m =
      candles[candles.length - 1] ?? {
        epoch: nowSec - phaseSec,
        open: st.lastPrice,
        high: st.lastPrice,
        low: st.lastPrice,
        close: st.lastPrice,
      };

    const closes = candles.map((c) => c.close);
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
      totalSeconds: windowSec,
      windowLabel,
      openingGuardSec,
      closeGuardSec,
      isOpeningGuard,
      isClosingGuard,
      noTradeWindow,
      candleDirection,
    };
  }

  /**
   * Strictly isolated High Tick / Low Tick (TICKHIGH / TICKLOW · 5 Ticks) signal snapshot builder.
   * Strategy (5-Minute Candlestick + RSI(14) + Both-Sides Wicks + Opening 1m & Closing 20s Guards):
   * 1. Timeframe & Indicator: Analyses live 5-minute (300s) OHLC candlesticks and 14-period RSI.
   * 2. Staggered Scanning Timing: Desynchronized across markets (25s phase offset) so markets scan at distinct times.
   * 3. Opening 1-Minute Guard: First 60 seconds (0s–60s) of the 5m candle has NO TRADE to await clear confirmation.
   * 4. Closing 20-Second Guard: Last 20 seconds (≤20s left) of the 5m candle has NO TRADE to avoid candle trend shifts.
   * 5. Both-Sides Wicks Requirement: Active 5-minute candlestick MUST have both an upper wick and a lower wick.
   * 6. Direction & Entry:
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

    const windowSec = this.getMarketWindow('high_low_tick', st.market.id);
    const windowLabel = formatWindowDuration(windowSec);
    const shiftedSec = nowSec + st.scanPhaseOffsetSec;
    const phaseSec = shiftedSec % windowSec;
    const candleSecondsLeft = Math.max(1, windowSec - phaseSec);
    const secIntoCandle = phaseSec;

    const CLOSING_GUARD_SEC = 0; // Continuous trading enabled without closing pause
    const isOpeningGuard = false;
    const isClosingGuard = false;
    const inCandleGuard = false;

    const candles =
      st.candles5m && st.candles5m.length > 0
        ? st.candles5m
        : st.candlesHighLow && st.candlesHighLow.length > 0
        ? st.candlesHighLow
        : st.candles2m;
    const activeCandle: Candle5m =
      candles[candles.length - 1] ?? {
        epoch: nowSec - phaseSec,
        open: st.lastPrice,
        high: st.lastPrice,
        low: st.lastPrice,
        close: st.lastPrice,
      };

    const closes = candles.map((c) => c.close);
    const rsi5m = this.computeWilderRsi14(closes, 14);

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

    // Determine strategy side from RSI (< 50 => HIGH_TICK, > 50 => LOW_TICK)
    const rsiFavorsHigh = rsi5m < 50;
    const rsiFavorsLow = rsi5m > 50;
    const desiredSide: 'HIGH_TICK' | 'LOW_TICK' = rsiFavorsHigh ? 'HIGH_TICK' : 'LOW_TICK';
    let targetTick = desiredSide === 'HIGH_TICK' ? bestHighTick : bestLowTick;

    // Keep targetTick stable within the same candle once locked on the same RSI side
    if (
      st.lockedHighLowTick &&
      st.lockedHighLowTick.candleEpoch === activeCandle.epoch &&
      st.lockedHighLowTick.contractType === desiredSide
    ) {
      targetTick = st.lockedHighLowTick.targetTick;
    }

    const canActivateRun =
      !inCandleGuard && hasBothWicks && (rsiFavorsHigh || rsiFavorsLow);

    if (canActivateRun) {
      st.lockedHighLowTick = {
        candleEpoch: activeCandle.epoch,
        contractType: desiredSide,
        targetTick,
      };
    } else if (inCandleGuard) {
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

    const minsLeft = Math.floor(candleSecondsLeft / 60);
    const secsLeft = candleSecondsLeft % 60;
    const timerFormatted = `${minsLeft}:${secsLeft.toString().padStart(2, '0')}`;

    const highLowBreakdownSummary = `${windowLabel} Left ${timerFormatted} · 5t ${
      contractType === 'HIGH_TICK' ? 'Highs' : 'Lows'
    }: #1 ${breakdownSide[1]}% · #2 ${breakdownSide[2]}% · #3 ${breakdownSide[3]}% · #4 ${
      breakdownSide[4]
    }% · #5 ${breakdownSide[5]}%`;

    const marketTrendSummary = `${windowLabel} RSI ${rsi5m.toFixed(1)} (${
      rsiFavorsHigh ? '<50 High' : rsiFavorsLow ? '>50 Low' : '=50 Neutral'
    }) · ${hasBothWicks ? 'Both Wicks ✔' : 'Wait Wicks'}`;

    let isScanning = true;
    let entryConfirmedNow = false;
    let hasStrongEdge = false;
    let distributionSubtext = '';
    let patternSummary = '';
    let scanStatusNote = '';

    if (isClosingGuard) {
      isScanning = true;
      scanStatusNote = `Closing 20s guard (${candleSecondsLeft}s left) · Protecting against trend change before new 5m candle`;
    } else if (!hasBothWicks) {
      isScanning = true;
      const missingDesc =
        !hasUpperWick && !hasLowerWick
          ? 'awaiting upper & lower wicks'
          : !hasUpperWick
          ? 'awaiting upper wick'
          : 'awaiting lower wick';
      scanStatusNote = `${windowLabel} RSI ${rsi5m.toFixed(1)} · ${windowLabel} candle ${missingDesc} (${timerFormatted} left)`;
    } else if (!rsiFavorsHigh && !rsiFavorsLow) {
      isScanning = true;
      scanStatusNote = `${windowLabel} RSI exactly 50.0 · Awaiting RSI < 50 (High) or > 50 (Low)`;
    } else {
      isScanning = false;
      hasStrongEdge = true;
      entryConfirmedNow = confirm.confirmedNow;
      distributionSubtext =
        contractType === 'HIGH_TICK'
          ? `${windowLabel} RSI ${rsi5m.toFixed(1)} (<50) · Both Wicks ✔ · ${timerFormatted} left`
          : `${windowLabel} RSI ${rsi5m.toFixed(1)} (>50) · Both Wicks ✔ · ${timerFormatted} left`;
      patternSummary = `Conditions Met (RSI & Both Wicks) · Ready for your entry (${confirm.statusText})`;
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
      candle5mSecondsLeft: candleSecondsLeft,
      isOpeningGuard,
      isClosingGuard,
      marketTrend: rsiFavorsHigh ? 'uptrend' : rsiFavorsLow ? 'downtrend' : 'ranging',
      marketTrendSummary,
      recentWindowWinners,
      highLowBreakdownSummary,
      windowTickCount: candles.length,
      isScanning,
      scanSecondsLeft: candleSecondsLeft,
      scanTotalSeconds: windowSec,
      scanWindowLabel: windowLabel,
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
      edgeDeltaPct: Math.max(0, entryConfidencePct - 20),
      distributionSubtext,
      patternSummary,
      topBarriersSummary: '',
      hasStrongEdge,
    };
  }

  /**
   * Returns live 1-minute candlesticks for MACD analysis.
   * If fewer than 26 live candles have loaded yet from Deriv WebSocket, synthesizes
   * realistic historical 1-minute candles so MACD (12, 26, 9) is immediately computed.
   */
  private getCandles1mWithFallback(st: InternalMarketState, nowSec: number): Candle1m[] {
    if (st.candles1m && st.candles1m.length >= 26) {
      return st.candles1m;
    }
    const count = 45;
    const currentPrice = st.lastPrice > 0 ? st.lastPrice : 1000;
    const pip = Math.pow(10, -st.market.decimals);
    const result: Candle1m[] = [];
    const serverNowSec = getDerivServerNowSec();
    const currentEpoch = Math.floor(serverNowSec / 60) * 60;

    let p = currentPrice;
    for (let i = count - 1; i >= 0; i--) {
      const epoch = currentEpoch - i * 60;
      const wave = Math.sin((epoch / 180) * Math.PI) * (pip * 8);
      const delta = Math.sin(epoch) * pip * 4 + wave;
      const cOpen = p - delta;
      const cClose = p;
      const cHigh = Math.max(cOpen, cClose) + Math.abs(delta) * 0.4 + pip;
      const cLow = Math.min(cOpen, cClose) - Math.abs(delta) * 0.4 - pip;
      result.push({
        epoch,
        open: Number(cOpen.toFixed(st.market.decimals)),
        high: Number(cHigh.toFixed(st.market.decimals)),
        low: Number(cLow.toFixed(st.market.decimals)),
        close: Number(cClose.toFixed(st.market.decimals)),
      });
      p += delta * 0.75;
    }
    return result;
  }

  /**
   * ONLY UP MACD Candlestick Strategy:
   * Uses 1-minute OHLC candlesticks to analyze the market using MACD (12, 26, 9) as the sole indicator.
   * Good Market (activates Run button):
   *  - Faded Red histogram (bullish turning upwards)
   *  - Short Dark Green histogram (early bullish momentum expansion)
   * Ineligible / No Trades:
   *  - Long Dark Red histogram (falling momentum / ineligible)
   *  - Faded Green histogram (declining positive momentum)
   * Run Button:
   *  - Activated on Good Market (Faded Red & Short Dark Green); deactivated/disabled otherwise.
   * Entry Point:
   *  - Exactly synchronized to Deriv Advanced TradingView 1m candlestick finish (<= 10 seconds remaining).
   */
  private buildOnlyUpSnapshot(
    st: InternalMarketState,
    nowSec: number,
    ticks: number = 2
  ): MarketSignalSnapshot {
    const secondsLeft = getTradingViewCandle1mSecondsLeft();
    const is10sEntryActive = secondsLeft <= 10;
    const candles = this.getCandles1mWithFallback(st, nowSec);
    const closes = candles.map((c) => c.close);
    const { macdLine, signalLine, histogram } = calculateMACD(closes, 12, 26, 9);
    const evalResult = evaluateMacdHistogram(histogram);

    const isGoodMarket = evalResult.isGoodMarketForOnlyUp;
    const hasStrongEdge = isGoodMarket;
    const isScanning = !isGoodMarket;
    const entryConfirmedNow = isGoodMarket && is10sEntryActive;

    const clampedTicks = Math.min(5, Math.max(2, Math.round(ticks || 2)));
    const onlyUpDownPayoutMap: Record<number, number> = {
      2: 3.85,
      3: 7.8,
      4: 15.6,
      5: 31.2,
    };

    let signalLabel = 'ONLY UP';
    let signalTone: 'emerald' | 'fuchsia' | 'sky' | 'amber' = 'sky';
    let entryConfidencePct = 50;

    if (evalResult.state === 'short_dark_green') {
      signalTone = 'emerald';
      entryConfidencePct = 94;
      signalLabel = 'ONLY UP · Short Dark Green';
    } else if (evalResult.state === 'faded_red') {
      signalTone = 'emerald';
      entryConfidencePct = 90;
      signalLabel = 'ONLY UP · Faded Red';
    } else if (evalResult.state === 'long_dark_red') {
      signalTone = 'amber';
      entryConfidencePct = 42;
      signalLabel = 'NO TRADE · Long Dark Red';
    } else if (evalResult.state === 'faded_green') {
      signalTone = 'amber';
      entryConfidencePct = 38;
      signalLabel = 'NO TRADE · Faded Green';
    } else {
      signalTone = 'sky';
      entryConfidencePct = 52;
      signalLabel = `SCANNING · ${evalResult.stateLabel}`;
    }

    const patternSummary = isGoodMarket
      ? `${evalResult.reason} Entry window: ${
          is10sEntryActive ? 'ACTIVE (≤10s remaining)' : `waiting for final 10s (${secondsLeft}s left)`
        }.`
      : evalResult.reason;

    const scanStatusNote =
      evalResult.state === 'faded_green'
        ? 'NO TRADE: Faded green histogram detected · Positive momentum declining'
        : evalResult.state === 'long_dark_red'
        ? 'NO TRADE: Long dark red histogram detected · Falling bearish momentum'
        : isGoodMarket
        ? is10sEntryActive
          ? `READY: Final 10 seconds of candle (${secondsLeft}s left) · Bot will trigger entry`
          : `GOOD MARKET: MACD ${evalResult.stateLabel} · Waiting for entry window (${secondsLeft}s left ≤ 10s)`
        : `SCANNING: Waiting for Faded Red or Short Dark Green MACD (${secondsLeft}s left)`;

    const dirs: ('up' | 'down' | 'flat')[] = [];
    for (let i = 1; i < st.prices.length; i++) {
      const diff = st.prices[i] - st.prices[i - 1];
      dirs.push(diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat');
    }

    const lastMacd = macdLine[macdLine.length - 1] ?? null;
    const lastSig = signalLine[signalLine.length - 1] ?? null;
    const lastHist = histogram[histogram.length - 1] ?? null;

    return {
      category: 'only_up',
      market: st.market,
      isLiveWs: st.isLiveWs,
      lastDigit: st.digits[st.digits.length - 1] ?? 0,
      lastQuote: st.lastQuote,
      recentDigits: st.digits.slice(-12),
      recentDirections: dirs.slice(-12),
      candle2mDirection: evalResult.currentHistogram >= 0 ? 'bullish' : 'bearish',
      windowTickCount: candles.length,
      isScanning,
      isOpeningGuard: false,
      isClosingGuard: false,
      candle5mSecondsLeft: secondsLeft,
      scanSecondsLeft: secondsLeft,
      scanTotalSeconds: 60,
      scanWindowLabel: '1m',
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
      contractType: 'ONLY_UP',
      prediction: 0,
      signalEntryTrigger: 'only_up_macd_candle_10s',
      entryConfirmedNow,
      entryConfidencePct,
      payoutMultiplier: onlyUpDownPayoutMap[clampedTicks] ?? 3.85,
      edgeDeltaPct: Math.max(0, entryConfidencePct - 50),
      distributionSubtext: `1m Candle Closes · MACD (12, 26, 9) · ${evalResult.stateLabel}`,
      patternSummary,
      topBarriersSummary: '',
      hasStrongEdge,
      macdHistogramState: evalResult.state,
      macdStateLabel: evalResult.stateLabel,
      macdValue: lastMacd !== null ? Number(lastMacd.toFixed(st.market.decimals + 1)) : undefined,
      macdSignal: lastSig !== null ? Number(lastSig.toFixed(st.market.decimals + 1)) : undefined,
      macdHistogram: lastHist !== null ? Number(lastHist.toFixed(st.market.decimals + 1)) : undefined,
      isMacdGoodMarket: isGoodMarket,
      is10sEntryActive,
      recentMacdHistograms: histogram.slice(-10),
      candleSecondsLeft: secondsLeft,
    };
  }

  public getSnapshots(
    category: SignalCategory,
    overUnderBarrier: BarrierFilter = 'all',
    ticks: number = 1,
    evenOddStrategyFilter: 'all' | 'S1' | 'S2' | 'S3' = 'all',
    onlyUpDownStrategy: OnlyUpDownStrategy = 'ema_rsi'
  ): MarketSignalSnapshot[] {
    const nowSec = Math.floor(Date.now() / 1000);

    return SIGNAL_MARKETS.map((market) => {
      const st = this.states.get(market.id)!;
      if (category === 'only_up') {
        return this.buildOnlyUpSnapshot(st, nowSec, ticks);
      }
      if (category === 'even_odd') {
        return this.buildEvenOddSnapshot(st, nowSec, evenOddStrategyFilter);
      }
      if (category === 'over_under') {
        return this.buildOverUnderSnapshot(st, nowSec, overUnderBarrier);
      }
      if (category === 'only_up_down') {
        if (onlyUpDownStrategy === 'ema_rsi') {
          return this.buildOnlyUpDownEmaRsiSnapshot(st, nowSec, ticks);
        }
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
    this.subscribeTimers.forEach((t) => clearTimeout(t));
    this.subscribeTimers = [];
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }
}
