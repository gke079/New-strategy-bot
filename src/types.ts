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

export type StrategyExecutionMode = 'reanalyse' | 'continuous';

export interface BotStrategyConfig {
  id: string;
  name: string;
  marketId?: string;
  entryCondition: EntryConditionType;
  n: number;
  xDigit: number;
  pPercent: number;
  tradeType: TradeContractType;
  predictionDigit: number;
  duration: number;
  durationUnit: 't' | 's' | 'm';
  stake: number;
  initialStake: number;
  martingale: number;
  maxSteps: number;
  takeProfit: number;
  stopLoss: number;
  active: boolean;
  botSpeed?: 'normal' | 'fast'; // 'fast' = trades every tick; 'normal' = skips 1 tick between entry and exit
  executionMode?: StrategyExecutionMode; // 'reanalyse' = analyse again after a single trade; 'continuous' = trade continuous after analysis
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
  status: 'won' | 'lost';
  balanceAfter: number;
  botSource?: 'digits' | 'charts' | 'normal' | 'xml' | 'signal';
}

export type XmlConditionOperator =
  | 'always'
  | 'last_digit_eq'
  | 'last_digit_neq'
  | 'last_digit_gt'
  | 'last_digit_lt'
  | 'last_digit_even'
  | 'last_digit_odd'
  | 'streak_over_n'
  | 'streak_under_n'
  | 'streak_even_n'
  | 'streak_odd_n'
  | 'rising_ticks_n'
  | 'falling_ticks_n';

export type XmlLossAction = 'martingale' | 'dalembert' | 'compound_win' | 'fixed';

export type XmlBotStage =
  | 'idle'
  | 'initialization'
  | 'before_purchase'
  | 'during_purchase'
  | 'after_purchase';

export interface XmlCustomVariable {
  id: string;
  name: string;
  initialValue: number;
}

export interface XmlJournalEntry {
  id: string;
  timestamp: number;
  stage: XmlBotStage;
  level: 'info' | 'buy' | 'win' | 'loss' | 'warn';
  message: string;
}

export interface XmlBotConfig {
  id: string;
  name: string;
  marketId: string;
  contractCategory: 'digits' | 'callput';
  contractType: TradeContractType;
  prediction: number;
  duration: number;
  durationUnit: 't' | 's' | 'm';
  initialStake: number;
  // Stage 2: Purchase Conditions (before_purchase)
  purchaseCondition: XmlConditionOperator;
  conditionValue: number;
  conditionStreakCount: number;
  alternateContractOnLoss: boolean;
  alternateContractType: TradeContractType;
  // Stage 3: Sell Conditions (during_purchase)
  enableSellAtProfit: boolean;
  sellProfitThreshold: number;
  // Stage 4: Restart Conditions (after_purchase)
  lossAction: XmlLossAction;
  martingaleMultiplier: number;
  dalembertUnit: number;
  maxMartingaleSteps: number;
  resetOnMaxSteps: boolean;
  takeProfit: number;
  stopLoss: number;
  tradeAgain: boolean;
  cooldownTicks: number;
  botSpeed?: 'normal' | 'fast';
  customVariables: XmlCustomVariable[];
  rawImportedXml?: string;
}

export type SignalEntryTrigger =
  | 'immediate'
  | 'even_after_2_odd_confirm'
  | 'odd_after_2_even_confirm';

export interface NormalBotConfig {
  id: string;
  name: string;
  marketId: string;
  contractType: TradeContractType;
  prediction: number | string;
  stake: number;
  initialStake: number;
  duration: number;
  durationUnit: 't' | 's' | 'm';
  takeProfit: number;
  stopLoss: number;
  martingale: number; // multiplier e.g. 2.0
  martingaleLevel: number; // max consecutive loss steps before resetting
  active: boolean;
  botSpeed?: 'normal' | 'fast'; // 'fast' = trades every tick; 'normal' = skips 1 tick between entry and exit
  signalEntryTrigger?: SignalEntryTrigger;
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
}
