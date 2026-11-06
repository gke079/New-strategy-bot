import { Market } from '../types';

export const SYNTHETIC_MARKETS: Market[] = [
  // ==========================================
  // 1. PLAIN VOLATILITY INDICES (V10, V25, V50, V75, V100)
  // ==========================================
  {
    id: 'R_10',
    symbol: 'V10',
    name: 'Volatility 10 Index',
    category: 'volatility',
    decimals: 3,
    basePrice: 6540.119,
    volatility: 0.00015,
    pipSize: 0.001,
  },
  {
    id: 'R_25',
    symbol: 'V25',
    name: 'Volatility 25 Index',
    category: 'volatility',
    decimals: 3,
    basePrice: 1840.428,
    volatility: 0.00025,
    pipSize: 0.001,
  },
  {
    id: 'R_50',
    symbol: 'V50',
    name: 'Volatility 50 Index',
    category: 'volatility',
    decimals: 4,
    basePrice: 285.9184,
    volatility: 0.00035,
    pipSize: 0.0001,
  },
  {
    id: 'R_75',
    symbol: 'V75',
    name: 'Volatility 75 Index',
    category: 'volatility',
    decimals: 4,
    basePrice: 582490.3125,
    volatility: 0.00045,
    pipSize: 0.0001,
  },
  {
    id: 'R_100',
    symbol: 'V100',
    name: 'Volatility 100 Index',
    category: 'volatility',
    decimals: 2,
    basePrice: 3840.85,
    volatility: 0.0007,
    pipSize: 0.01,
  },

  // ==========================================
  // 2. 1s VOLATILITY INDICES (V10 1s, V15 1s, V25 1s, V30 1s, V50 1s, V75 1s, V90 1s, V100 1s)
  // ==========================================
  {
    id: '1HZ10V',
    symbol: 'V10 (1s)',
    name: 'Volatility 10 (1s) Index',
    category: 'volatility-1s',
    decimals: 2,
    basePrice: 7120.35,
    volatility: 0.0002,
    pipSize: 0.01,
  },
  {
    id: '1HZ15V',
    symbol: 'V15 (1s)',
    name: 'Volatility 15 (1s) Index',
    category: 'volatility-1s',
    decimals: 3,
    basePrice: 15320.45,
    volatility: 0.00025,
    pipSize: 0.001,
  },
  {
    id: '1HZ25V',
    symbol: 'V25 (1s)',
    name: 'Volatility 25 (1s) Index',
    category: 'volatility-1s',
    decimals: 2,
    basePrice: 2450.82,
    volatility: 0.0003,
    pipSize: 0.01,
  },
  {
    id: '1HZ30V',
    symbol: 'V30 (1s)',
    name: 'Volatility 30 (1s) Index',
    category: 'volatility-1s',
    decimals: 3,
    basePrice: 6100.125,
    volatility: 0.00035,
    pipSize: 0.001,
  },
  {
    id: '1HZ50V',
    symbol: 'V50 (1s)',
    name: 'Volatility 50 (1s) Index',
    category: 'volatility-1s',
    decimals: 2,
    basePrice: 420.19,
    volatility: 0.0004,
    pipSize: 0.01,
  },
  {
    id: '1HZ75V',
    symbol: 'V75 (1s)',
    name: 'Volatility 75 (1s) Index',
    category: 'volatility-1s',
    decimals: 2,
    basePrice: 194380.52,
    volatility: 0.0005,
    pipSize: 0.01,
  },
  {
    id: '1HZ90V',
    symbol: 'V90 (1s)',
    name: 'Volatility 90 (1s) Index',
    category: 'volatility-1s',
    decimals: 3,
    basePrice: 91420.65,
    volatility: 0.0006,
    pipSize: 0.001,
  },
  {
    id: '1HZ100V',
    symbol: 'V100 (1s)',
    name: 'Volatility 100 (1s) Index',
    category: 'volatility-1s',
    decimals: 2,
    basePrice: 1200.0,
    volatility: 0.0008,
    pipSize: 0.01,
  },

  // ==========================================
  // 3. JUMP INDICES (J10, J25, J50, J75, J100)
  // ==========================================
  {
    id: 'JD10',
    symbol: 'J10',
    name: 'Jump 10 Index',
    category: 'jump',
    decimals: 2,
    basePrice: 4210.55,
    volatility: 0.0004,
    pipSize: 0.01,
  },
  {
    id: 'JD25',
    symbol: 'J25',
    name: 'Jump 25 Index',
    category: 'jump',
    decimals: 2,
    basePrice: 6380.25,
    volatility: 0.0005,
    pipSize: 0.01,
  },
  {
    id: 'JD50',
    symbol: 'J50',
    name: 'Jump 50 Index',
    category: 'jump',
    decimals: 2,
    basePrice: 8750.85,
    volatility: 0.00065,
    pipSize: 0.01,
  },
  {
    id: 'JD75',
    symbol: 'J75',
    name: 'Jump 75 Index',
    category: 'jump',
    decimals: 2,
    basePrice: 11240.45,
    volatility: 0.0008,
    pipSize: 0.01,
  },
  {
    id: 'JD100',
    symbol: 'J100',
    name: 'Jump 100 Index',
    category: 'jump',
    decimals: 2,
    basePrice: 14890.15,
    volatility: 0.001,
    pipSize: 0.01,
  },

  // ==========================================
  // 4. STEP INDICES (STEP 100, STEP 200, STEP 300, STEP 400, STEP 500)
  // ==========================================
  {
    id: 'stpRNG',
    symbol: 'STEP 100',
    name: 'Step Index 100',
    category: 'step',
    decimals: 1,
    basePrice: 8520.4,
    volatility: 0.0003,
    pipSize: 0.1,
  },
  {
    id: 'stpRNG2',
    symbol: 'STEP 200',
    name: 'Step Index 200',
    category: 'step',
    decimals: 1,
    basePrice: 11420.8,
    volatility: 0.00045,
    pipSize: 0.1,
  },
  {
    id: 'stpRNG3',
    symbol: 'STEP 300',
    name: 'Step Index 300',
    category: 'step',
    decimals: 1,
    basePrice: 14510.6,
    volatility: 0.0005,
    pipSize: 0.1,
  },
  {
    id: 'stpRNG4',
    symbol: 'STEP 400',
    name: 'Step Index 400',
    category: 'step',
    decimals: 1,
    basePrice: 16980.2,
    volatility: 0.00055,
    pipSize: 0.1,
  },
  {
    id: 'stpRNG5',
    symbol: 'STEP 500',
    name: 'Step Index 500',
    category: 'step',
    decimals: 1,
    basePrice: 19850.5,
    volatility: 0.0006,
    pipSize: 0.1,
  },
];

const LEGACY_STEP_SYMBOL_MAP: Record<string, string> = {
  stp_index_100: 'stpRNG',
  stp_index_200: 'stpRNG2',
  stp_index_300: 'stpRNG3',
  stp_index_400: 'stpRNG4',
  stp_index_500: 'stpRNG5',
};

export function normalizeMarketId(marketId?: string): string {
  if (!marketId) return 'R_75';
  if (LEGACY_STEP_SYMBOL_MAP[marketId]) return LEGACY_STEP_SYMBOL_MAP[marketId];
  return SYNTHETIC_MARKETS.some((m) => m.id === marketId) ? marketId : 'R_75';
}

export const DEFAULT_MARKET =
  SYNTHETIC_MARKETS.find((m) => m.id === 'R_75') || SYNTHETIC_MARKETS[0];
