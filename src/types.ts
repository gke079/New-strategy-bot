export type DigitRank = 'most' | 'second-most' | 'second-least' | 'least' | 'neutral';

export interface Market {
  id: string;
  symbol: string;
  name: string;
  category: 'volatility' | 'volatility-1s' | 'step' | 'jump' | 'boom-crash';
  decimals: number;
  basePrice: number;
  volatility: number;
  pipSize: number;
}

export interface Tick {
  epoch: number;
  quote: number;
  quoteFormatted: string;
  lastDigit: number;
  direction: 'up' | 'down' | 'flat';
  change: number;
}

export interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
  rank: DigitRank;
  lastSeenTicksAgo: number;
}

export interface RatioStats {
  evenCount: number;
  oddCount: number;
  evenPercentage: number;
  oddPercentage: number;
  evenStreak: number;
  oddStreak: number;
  currentEvenOddStreakType: 'even' | 'odd' | null;
  currentEvenOddStreakCount: number;

  under5Count: number; // 0, 1, 2, 3, 4
  over4Count: number;  // 5, 6, 7, 8, 9
  under5Percentage: number;
  over4Percentage: number;
  under5Streak: number;
  over4Streak: number;
  currentOverUnderStreakType: 'under' | 'over' | null;
  currentOverUnderStreakCount: number;
}

export type EntryConditionType =
  | 'under_x'
  | 'over_x'
  | 'all_even'
  | 'all_odd'
  | 'n_rising_then_falling'
  | 'n_falling_then_rising'
  | 'least_percent'
  | 'most_percent'
  | 'repeat_streak'
  | 'differs_least';

export type TradeContractType =
  // Digits
  | 'OVER'
  | 'UNDER'
  | 'DIFFERS'
  | 'MATCHES'
  | 'EVEN'
  | 'ODD'
  // Rise / Fall
  | 'RISE'
  | 'FALL'
  // Only Up / Only Down
  | 'ONLY_UP'
  | 'ONLY_DOWN'
  // Resets
  | 'RESET_CALL'
  | 'RESET_PUT'
  // High / Low & Barriers
  | 'HIGHER'
  | 'LOWER'
  | 'HIGH_TICK'
  | 'LOW_TICK'
  // In / Out & Touch
  | 'STAY_BETWEEN'
  | 'GOES_OUTSIDE'
  | 'TOUCH'
  | 'NO_TOUCH'
  // Asians
  | 'ASIAN_UP'
  | 'ASIAN_DOWN';

export interface BotStrategyConfig {
  id: string;
  name: string;
  entryCondition: EntryConditionType;
  n: number;
  xDigit: number;
  pPercent: number;
  tradeType: TradeContractType;
  predictionDigit: number;
  duration: number;
  durationUnit: 't' | 's';
  stake: number;
  initialStake: number;
  martingale: number;
  maxSteps: number;
  takeProfit: number;
  stopLoss: number;
  active: boolean;
}

export interface Trade {
  id: string;
  timestamp: number;
  marketId: string;
  strategyName: string;
  contractType: TradeContractType;
  prediction: string;
  stake: number;
  entryPrice: number;
  exitPrice: number;
  exitDigit: number;
  profit: number;
  status: 'won' | 'lost' | 'open';
  balanceAfter: number;
  botSource?: 'digits' | 'charts' | 'manual';
  derivContractId?: number;
  isRealTrade?: boolean;
}

export interface BotMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  currentStreak: { type: 'win' | 'loss' | null; count: number };
  maxDrawdown: number;
  peakBalance: number;
}

export interface UserAccount {
  isLoggedIn: boolean;
  username: string;
  email: string;
  balance: number;
  currency: string;
  isDemo: boolean;
  loginid?: string;
  token?: string;
  appId?: string;
  isRealExecutionEnabled?: boolean;
  tokenScopes?: string[];
}
