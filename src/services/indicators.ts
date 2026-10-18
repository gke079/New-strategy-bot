export interface ActiveIndicator {
  id: string;
  type:
    | 'sma'
    | 'ema'
    | 'bollinger'
    | 'rsi'
    | 'macd'
    | 'stochastic'
    | 'supertrend'
    | 'atr'
    | 'volume'
    | 'donchian'
    | 'vwap';
  name: string;
  category: 'trend' | 'oscillator' | 'volatility' | 'volume';
  visible: boolean;
  color: string;
  params: Record<string, number>;
}

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
  volume: number;
  lastDigit: number;
}

// Indicator computation helpers
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prevEma: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (prevEma === null) {
      const slice = data.slice(0, period);
      prevEma = slice.reduce((a, b) => a + b, 0) / period;
      result.push(prevEma);
    } else {
      prevEma = data[i] * k + prevEma * (1 - k);
      result.push(prevEma);
    }
  }
  return result;
}

export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDevMult: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calculateSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    const mid = middle[i];
    if (mid === null || i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const variance = slice.reduce((acc, val) => acc + Math.pow(val - mid, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(mid + stdDev * stdDevMult);
      lower.push(mid - stdDev * stdDevMult);
    }
  }

  return { upper, middle, lower };
}

export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  if (closes.length < period + 1) return Array(closes.length).fill(null);

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const rsi: (number | null)[] = [null]; // 1st element has no diff
  for (let i = 0; i < changes.length; i++) {
    if (i < period - 1) {
      rsi.push(null);
    } else {
      const slice = changes.slice(i - period + 1, i + 1);
      let gains = 0;
      let losses = 0;
      slice.forEach((ch) => {
        if (ch > 0) gains += ch;
        else losses += Math.abs(ch);
      });
      const avgGain = gains / period;
      const avgLoss = losses / period || 0.0001;
      const rs = avgGain / avgLoss;
      const val = 100 - 100 / (1 + rs);
      rsi.push(Math.min(100, Math.max(0, val)));
    }
  }
  return rsi;
}

export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
} {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine.push((fastEMA[i] as number) - (slowEMA[i] as number));
    } else {
      macdLine.push(null);
    }
  }

  // Filter valid numbers to compute signal line
  const validMacd = macdLine.map((v) => v ?? 0);
  const signal = calculateEMA(validMacd, signalPeriod);

  const histogram: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null && signal[i] !== null) {
      histogram.push((macdLine[i] as number) - (signal[i] as number));
    } else {
      histogram.push(null);
    }
  }

  return { macdLine, signalLine: signal, histogram };
}

export function calculateStochastic(
  candles: CandleData[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { kLine: (number | null)[]; dLine: (number | null)[] } {
  const kLine: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      kLine.push(null);
    } else {
      const slice = candles.slice(i - kPeriod + 1, i + 1);
      const high = Math.max(...slice.map((c) => c.high));
      const low = Math.min(...slice.map((c) => c.low));
      const close = candles[i].close;
      const k = high !== low ? ((close - low) / (high - low)) * 100 : 50;
      kLine.push(k);
    }
  }

  const validK = kLine.map((v) => v ?? 50);
  const dLine = calculateSMA(validK, dPeriod);

  return { kLine, dLine };
}

export function calculateSupertrend(
  candles: CandleData[],
  period: number = 10,
  multiplier: number = 3
): { trendLine: (number | null)[]; direction: ('up' | 'down')[] } {
  const trendLine: (number | null)[] = [];
  const direction: ('up' | 'down')[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      trendLine.push(null);
      direction.push('up');
    } else {
      const slice = candles.slice(i - period, i + 1);
      const hl2 = (candles[i].high + candles[i].low) / 2;
      // Approximate ATR
      const trs = slice.map((c) => c.high - c.low);
      const atr = trs.reduce((a, b) => a + b, 0) / trs.length;

      const upperBand = hl2 + multiplier * atr;
      const lowerBand = hl2 - multiplier * atr;

      if (candles[i].close > upperBand) {
        trendLine.push(lowerBand);
        direction.push('up');
      } else {
        trendLine.push(upperBand);
        direction.push('down');
      }
    }
  }
  return { trendLine, direction };
}

export const AVAILABLE_INDICATORS: Omit<ActiveIndicator, 'id' | 'visible'>[] = [
  {
    type: 'rsi',
    name: 'Relative Strength Index (RSI)',
    category: 'oscillator',
    color: '#00e599',
    params: { period: 14, overbought: 70, oversold: 30 },
  },
  {
    type: 'macd',
    name: 'MACD (Moving Average Convergence Divergence)',
    category: 'oscillator',
    color: '#38bdf8',
    params: { fast: 12, slow: 26, signal: 9 },
  },
  {
    type: 'bollinger',
    name: 'Bollinger Bands (BB)',
    category: 'volatility',
    color: '#38bdf8',
    params: { period: 20, stdDev: 2 },
  },
  {
    type: 'sma',
    name: 'Moving Average (SMA)',
    category: 'trend',
    color: '#f59e0b',
    params: { period: 10 },
  },
  {
    type: 'ema',
    name: 'Exponential Moving Average (EMA)',
    category: 'trend',
    color: '#ec4899',
    params: { period: 20 },
  },
  {
    type: 'stochastic',
    name: 'Stochastic Oscillator',
    category: 'oscillator',
    color: '#a855f7',
    params: { kPeriod: 14, dPeriod: 3 },
  },
  {
    type: 'supertrend',
    name: 'Supertrend',
    category: 'trend',
    color: '#10b981',
    params: { period: 10, multiplier: 3 },
  },
  {
    type: 'donchian',
    name: 'Donchian Channels',
    category: 'volatility',
    color: '#6366f1',
    params: { period: 20 },
  },
  {
    type: 'volume',
    name: 'Volume Profile',
    category: 'volume',
    color: '#00e599',
    params: {},
  },
  {
    type: 'vwap',
    name: 'Volume Weighted Average Price (VWAP)',
    category: 'trend',
    color: '#eab308',
    params: {},
  },
];
