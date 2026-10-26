import { Market, SignalEntryTrigger, TradeContractType } from '../types';
import { SYNTHETIC_MARKETS } from './markets';

export type SignalCategory = 'even_odd' | 'over_under' | 'digit_match';
export type BarrierFilter = 'all' | 3 | 4 | 5 | 6 | 7;

export interface DigitBarrierStat {
  digit: number;
  overPct: number;
  underPct: number;
}

export interface MarketSignalSnapshot {
  market: Market;
  isLiveWs: boolean;
  lastDigit: number;
  lastQuote: string;
  recentDigits: number[];
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
 * Allowed Over barriers: 3, 4, 5, 6, 7
 * Required minimum Over %:
 * - OVER 3: 65%
 * - OVER 4: 60%
 * - OVER 5: 55%
 * - OVER 6: 45%
 * - OVER 7: 35%
 */
export const OVER_BARRIER_THRESHOLDS: Record<number, number> = {
  3: 65,
  4: 60,
  5: 55,
  6: 45,
  7: 35,
};

/**
 * Allowed Under barriers: 6, 5, 4, 3 (minimum Under 6, maximum Under 3)
 * Required minimum Under %:
 * - UNDER 6: 65%
 * - UNDER 5: 60%
 * - UNDER 4: 55%
 * - UNDER 3: 45%
 */
export const UNDER_BARRIER_THRESHOLDS: Record<number, number> = {
  6: 65,
  5: 60,
  4: 55,
  3: 45,
};

interface LockedOverUnderPick {
  cycleId: number;
  barrierFilterKey: string;
  contractType: 'OVER' | 'UNDER';
  barrier: number;
}

interface InternalMarketState {
  market: Market;
  digits: number[];
  lastPrice: number;
  lastQuote: string;
  isLiveWs: boolean;
  lastWsEpoch: number;
  phaseOffsetSec: number;
  lockedOverUnder?: LockedOverUnderPick;
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

const SCAN_WINDOW_SEC = 17;
const SIGNAL_HOLD_SEC = 25;
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

  constructor() {
    SIGNAL_MARKETS.forEach((market, idx) => {
      // Seed 100 realistic initial ticks so 100-tick Even/Odd (1% exact step) & 40-tick Over/Under windows work immediately
      const seededDigits: number[] = [];
      let price = market.basePrice;
      for (let i = 0; i < 100; i++) {
        const delta = (Math.random() - 0.5) * market.volatility * price;
        price = Math.max(1, price + delta);
        const formatted = price.toFixed(market.decimals);
        const d = parseInt(formatted.charAt(formatted.length - 1), 10) || 0;
        seededDigits.push(d);
      }

      const phaseOffsetSec = (idx * 9) % FULL_CYCLE_SEC;

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
        SIGNAL_MARKETS.forEach((m) => {
          try {
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
              st.digits = [...st.digits.slice(-99), digit];
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
      this.states.forEach((st) => {
        if (!st.isLiveWs || now - st.lastWsEpoch > 3500) {
          const delta = (Math.random() - 0.5) * st.market.volatility * st.lastPrice;
          const nextPrice = Math.max(1, st.lastPrice + delta);
          const { formatted, digit } = this.extractLastDigit(nextPrice, st.market.decimals);
          st.lastPrice = nextPrice;
          st.lastQuote = formatted;
          st.digits = [...st.digits.slice(-99), digit];
        }
      });
      this.notify();
    }, 1000);
  }

  /**
   * Evaluates allowed Over/Under barrier candidates:
   * - OVER 3 (>=65%), OVER 4 (>=60%), OVER 5 (>=55%), OVER 6 (>=45%), OVER 7 (>=35%)
   * - UNDER 6 (>=65%), UNDER 5 (>=60%), UNDER 4 (>=55%), UNDER 3 (>=45%)
   * Combines threshold qualification, Markov transition probability, Expected Value, and live digit patterns.
   */
  private evaluateBarrierCandidate(
    digits: number[],
    contractType: 'OVER' | 'UNDER',
    barrier: number,
    requiredPct: number
  ): BarrierCandidateEvaluation {
    // 40-tick window gives exact 2.5% steps (65%, 60%, 55%, 45%, 35% are all exact integer counts)
    const evalWindow = digits.slice(-40);
    const shortWindow = digits.slice(-15);
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

  public getSnapshots(
    category: SignalCategory,
    overUnderBarrier: BarrierFilter = 'all'
  ): MarketSignalSnapshot[] {
    const nowSec = Math.floor(Date.now() / 1000);

    return SIGNAL_MARKETS.map((market) => {
      const st = this.states.get(market.id)!;

      // 100-tick window for Even/Odd (exact 1% resolution so 50%/50% and >=53% work cleanly)
      const parityDigits = st.digits.slice(-100);
      const parityTotal = Math.max(1, parityDigits.length);
      let evenCount = 0;
      for (const d of parityDigits) {
        if (d % 2 === 0) evenCount++;
      }
      const evenPct = Math.round((evenCount / parityTotal) * 100);
      const oddPct = 100 - evenPct;

      // Momentum calculation for Even/Odd: compare recent 30 ticks vs older 70 ticks
      const recentParity = parityDigits.slice(-30);
      const olderParity = parityDigits.slice(0, Math.max(1, parityDigits.length - 30));
      const recentEvenPct =
        (recentParity.filter((d) => d % 2 === 0).length / Math.max(1, recentParity.length)) * 100;
      const olderEvenPct =
        (olderParity.filter((d) => d % 2 === 0).length / Math.max(1, olderParity.length)) * 100;
      const evenMomentumDelta = Math.round(recentEvenPct - olderEvenPct);
      const oddMomentumDelta = -evenMomentumDelta;

      // 40-tick window for Over/Under barrier percentages (exact 2.5% step for 65%, 60%, 55%, 45%, 35%)
      const ouWindowDigits = st.digits.slice(-40);
      const ouTotal = Math.max(1, ouWindowDigits.length);

      const barrierStats: DigitBarrierStat[] = [];
      for (let b = 3; b <= 7; b++) {
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

      // Hot / Cold digit stats on recent 40 ticks
      const counts = new Array<number>(10).fill(0);
      for (const d of ouWindowDigits) {
        counts[d] = (counts[d] || 0) + 1;
      }
      let hotDigit = 0;
      let coldDigit = 0;
      for (let d = 1; d <= 9; d++) {
        if (counts[d] > counts[hotDigit]) hotDigit = d;
        if (counts[d] < counts[coldDigit]) coldDigit = d;
      }
      const hotDigitPct = Math.round((counts[hotDigit] / ouTotal) * 100);
      const coldDigitPct = Math.round((counts[coldDigit] / ouTotal) * 100);

      // Scanning cycle clock
      const elapsedWithOffset = nowSec + st.phaseOffsetSec;
      const cycleId = Math.floor(elapsedWithOffset / FULL_CYCLE_SEC);
      const cyclePos = elapsedWithOffset % FULL_CYCLE_SEC;
      const timerCountdown = (SCAN_WINDOW_SEC - (cyclePos % SCAN_WINDOW_SEC)) || SCAN_WINDOW_SEC;

      let signalLabel = 'EVEN';
      let signalTone: MarketSignalSnapshot['signalTone'] = 'emerald';
      let contractType: TradeContractType = 'EVEN';
      let prediction = 0;
      let signalEntryTrigger: SignalEntryTrigger = 'immediate';
      let entryConfirmedNow = true;
      let entryConfidencePct = 55;
      let payoutMultiplier = 1.95;
      let edgeDeltaPct = 0;
      let distributionSubtext = `${evenPct}% even · ${oddPct}% odd`;
      let patternSummary = '';
      let topBarriersSummary = '';
      let hasStrongEdge = false;
      let isScanning = false;
      let scanStatusNote = `${parityDigits.length} ticks · scanning`;
      let activeOverPct = barrierStats.find((b) => b.digit === 4)?.overPct ?? 50;
      let activeUnderPct = barrierStats.find((b) => b.digit === 5)?.underPct ?? 50;

      if (category === 'even_odd') {
        // Rule 1: If percentage is equal (50% / 50%) -> NO TRADE, SCAN AGAIN
        if (evenPct === oddPct) {
          isScanning = true;
          scanStatusNote = '50% / 50% Equal · No trade, scan again';
        } else if (evenPct >= 53 && evenMomentumDelta > 0) {
          // Rule 2: Even >= 53% AND momentum is increasing -> Effective EVEN Signal
          // Entry: 2 or more consecutive Odd digits followed by an Even digit confirmation
          const confirmCheck = this.evaluateParityConfirmation(st.digits, 'EVEN');
          signalLabel = 'EVEN';
          signalTone = 'emerald';
          contractType = 'EVEN';
          signalEntryTrigger = 'even_after_2_odd_confirm';
          entryConfirmedNow = confirmCheck.confirmedNow;
          entryConfidencePct = evenPct;
          payoutMultiplier = 1.95;
          edgeDeltaPct = evenPct - 50;
          hasStrongEdge = true;
          isScanning = false;
          distributionSubtext = `${evenPct}% even · ${oddPct}% odd · Momentum ▲ +${evenMomentumDelta}%`;
          patternSummary = confirmCheck.statusText;
        } else if (oddPct >= 53 && oddMomentumDelta > 0) {
          // Rule 3: Odd >= 53% AND momentum is increasing -> Effective ODD Signal
          // Entry: 2 or more consecutive Even digits followed by an Odd digit confirmation
          const confirmCheck = this.evaluateParityConfirmation(st.digits, 'ODD');
          signalLabel = 'ODD';
          signalTone = 'fuchsia';
          contractType = 'ODD';
          signalEntryTrigger = 'odd_after_2_even_confirm';
          entryConfirmedNow = confirmCheck.confirmedNow;
          entryConfidencePct = oddPct;
          payoutMultiplier = 1.95;
          edgeDeltaPct = oddPct - 50;
          hasStrongEdge = true;
          isScanning = false;
          distributionSubtext = `${oddPct}% odd · ${evenPct}% even · Momentum ▲ +${oddMomentumDelta}%`;
          patternSummary = confirmCheck.statusText;
        } else {
          // Below 53% or momentum is flat/decreasing -> No trade, scan again
          isScanning = true;
          const leadSide = evenPct > oddPct ? `Even ${evenPct}%` : `Odd ${oddPct}%`;
          const leadMom = evenPct > oddPct ? evenMomentumDelta : oddMomentumDelta;
          scanStatusNote =
            Math.max(evenPct, oddPct) < 53
              ? `${leadSide} (<53%) · Scan again`
              : `${leadSide} (mom ${leadMom >= 0 ? '+' : ''}${leadMom}%) · Awaiting rising momentum`;
        }
      } else if (category === 'over_under') {
        // Strictly evaluate allowed Over barriers (3..7) and allowed Under barriers (6..3)
        const allAllowedCandidates: BarrierCandidateEvaluation[] = [];

        for (const b of [3, 4, 5, 6, 7]) {
          allAllowedCandidates.push(
            this.evaluateBarrierCandidate(st.digits, 'OVER', b, OVER_BARRIER_THRESHOLDS[b])
          );
        }
        for (const b of [6, 5, 4, 3]) {
          allAllowedCandidates.push(
            this.evaluateBarrierCandidate(st.digits, 'UNDER', b, UNDER_BARRIER_THRESHOLDS[b])
          );
        }

        const filterKey = String(overUnderBarrier);
        const scopedCandidates =
          overUnderBarrier === 'all'
            ? allAllowedCandidates
            : allAllowedCandidates.filter((c) => c.barrier === overUnderBarrier);

        // Only barriers meeting their exact required percentage threshold qualify
        const qualifying = scopedCandidates
          .filter((c) => c.meetsThreshold)
          .sort((a, b) => b.compositeScore - a.compositeScore);

        if (qualifying.length === 0) {
          // No barrier reached its required target % -> Scan again
          isScanning = true;
          const closest = [...scopedCandidates].sort(
            (a, b) => b.winPct - b.requiredPct - (a.winPct - a.requiredPct)
          )[0];
          scanStatusNote = closest
            ? `Best ${closest.contractType === 'OVER' ? 'O' : 'U'}${closest.barrier}: ${closest.winPct}% (req ≥${closest.requiredPct}%) · Scan again`
            : 'Scanning barriers 3–7';
        } else {
          let chosen = qualifying[0];

          // Keep chosen qualifying barrier steady during the cycle as long as it still meets its threshold
          const existingLock = st.lockedOverUnder;
          if (
            existingLock &&
            existingLock.cycleId === cycleId &&
            existingLock.barrierFilterKey === filterKey
          ) {
            const stillQualifying = qualifying.find(
              (c) =>
                c.contractType === existingLock.contractType &&
                c.barrier === existingLock.barrier
            );
            if (stillQualifying) {
              chosen = stillQualifying;
            } else {
              st.lockedOverUnder = {
                cycleId,
                barrierFilterKey: filterKey,
                contractType: chosen.contractType,
                barrier: chosen.barrier,
              };
            }
          } else {
            st.lockedOverUnder = {
              cycleId,
              barrierFilterKey: filterKey,
              contractType: chosen.contractType,
              barrier: chosen.barrier,
            };
          }

          isScanning = false;
          contractType = chosen.contractType;
          prediction = chosen.barrier;
          signalEntryTrigger = 'immediate';
          entryConfirmedNow = true;
          signalLabel = `${chosen.contractType} ${chosen.barrier}`;
          signalTone = chosen.contractType === 'OVER' ? 'emerald' : 'fuchsia';
          entryConfidencePct = chosen.winPct;
          payoutMultiplier = chosen.payoutMultiplier;
          edgeDeltaPct = chosen.edgeDeltaPct;
          hasStrongEdge = true;

          const bStat = barrierStats.find((s) => s.digit === chosen.barrier);
          activeOverPct = bStat?.overPct ?? chosen.winPct;
          activeUnderPct = bStat?.underPct ?? 100 - chosen.winPct;

          distributionSubtext = `${chosen.winPct}% ${chosen.contractType.toLowerCase()} ${chosen.barrier} (req ≥${chosen.requiredPct}%)`;
          patternSummary = `${chosen.patternName} · Markov ${chosen.markovWinPct}%`;

          topBarriersSummary = qualifying
            .slice(0, 3)
            .map(
              (c) =>
                `${c.contractType === 'OVER' ? 'O' : 'U'}${c.barrier} ${c.winPct}%`
            )
            .join(' · ');
        }
      } else {
        // Digit Match
        const rawScanning = cyclePos < SCAN_WINDOW_SEC;
        signalLabel = `MATCH ${hotDigit}`;
        signalTone = 'sky';
        contractType = 'MATCHES';
        prediction = hotDigit;
        signalEntryTrigger = 'immediate';
        entryConfirmedNow = true;
        payoutMultiplier = 9.0;
        entryConfidencePct = Math.max(15, hotDigitPct);
        edgeDeltaPct = hotDigitPct - 10;
        hasStrongEdge = hotDigitPct >= 18;
        isScanning = rawScanning && !hasStrongEdge;
        scanStatusNote = `Top #${hotDigit}: ${hotDigitPct}% · Scanning digits`;
        distributionSubtext = `Digit #${hotDigit}: ${hotDigitPct}% · Cold #${coldDigit}: ${coldDigitPct}%`;
        patternSummary =
          hotDigitPct >= 20
            ? `Hot Cluster #${hotDigit} (+${hotDigitPct - 10}% vs 10% base)`
            : `Leading Frequency #${hotDigit}`;
      }

      return {
        market,
        isLiveWs: st.isLiveWs,
        lastDigit: st.digits[st.digits.length - 1] ?? 0,
        lastQuote: st.lastQuote,
        recentDigits: st.digits.slice(-12),
        windowTickCount: category === 'even_odd' ? parityDigits.length : ouWindowDigits.length,
        isScanning,
        scanSecondsLeft: Math.max(1, timerCountdown),
        scanStatusNote,
        evenPct,
        oddPct,
        overPct: activeOverPct,
        underPct: activeUnderPct,
        hotDigit,
        hotDigitPct,
        coldDigit,
        coldDigitPct,
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
