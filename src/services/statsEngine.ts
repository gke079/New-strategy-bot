import { DigitRank, DigitStat, RatioStats, Tick } from '../types';

export function calculateDigitStats(ticks: Tick[]): DigitStat[] {
  const counts: number[] = Array(10).fill(0);
  const lastSeenMap: number[] = Array(10).fill(-1);

  const total = ticks.length;

  ticks.forEach((tick, idx) => {
    const digit = tick.lastDigit;
    if (digit >= 0 && digit <= 9) {
      counts[digit]++;
      lastSeenMap[digit] = total - 1 - idx;
    }
  });

  // Pair digits with their counts to sort and determine ranks
  const indexed = counts.map((count, digit) => ({
    digit,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
    lastSeenTicksAgo: lastSeenMap[digit] === -1 ? total : lastSeenMap[digit],
  }));

  // Sort descending by count
  // If count is identical, stable sorting preserves order
  const sorted = [...indexed].sort((a, b) => b.count - a.count);

  const ranksMap = new Map<number, DigitRank>();

  if (total > 0) {
    // Highest count
    const most = sorted[0];
    ranksMap.set(most.digit, 'most');

    // Second highest count
    if (sorted.length > 1) {
      ranksMap.set(sorted[1].digit, 'second-most');
    }

    // Lowest count
    const least = sorted[sorted.length - 1];
    // If least is already assigned most or second-most (in case of very few items), respect priority
    if (!ranksMap.has(least.digit)) {
      ranksMap.set(least.digit, 'least');
    }

    // Second lowest count
    if (sorted.length > 2) {
      const secondLeast = sorted[sorted.length - 2];
      if (!ranksMap.has(secondLeast.digit)) {
        ranksMap.set(secondLeast.digit, 'second-least');
      }
    }
  }

  return indexed.map((item) => ({
    ...item,
    rank: ranksMap.get(item.digit) || 'neutral',
  }));
}

export function calculateRatioStats(ticks: Tick[]): RatioStats {
  const total = ticks.length;
  if (total === 0) {
    return {
      evenCount: 0,
      oddCount: 0,
      evenPercentage: 0,
      oddPercentage: 0,
      evenStreak: 0,
      oddStreak: 0,
      currentEvenOddStreakType: null,
      currentEvenOddStreakCount: 0,

      under5Count: 0,
      over4Count: 0,
      under5Percentage: 0,
      over4Percentage: 0,
      under5Streak: 0,
      over4Streak: 0,
      currentOverUnderStreakType: null,
      currentOverUnderStreakCount: 0,
    };
  }

  let evenCount = 0;
  let oddCount = 0;
  let under5Count = 0;
  let over4Count = 0;

  ticks.forEach((tick) => {
    const d = tick.lastDigit;
    if (d % 2 === 0) {
      evenCount++;
    } else {
      oddCount++;
    }

    if (d < 5) {
      under5Count++;
    } else {
      over4Count++;
    }
  });

  // Calculate current streak from the end (most recent tick is last in array)
  let currentEvenOddStreakType: 'even' | 'odd' | null = null;
  let currentEvenOddStreakCount = 0;

  for (let i = ticks.length - 1; i >= 0; i--) {
    const isEven = ticks[i].lastDigit % 2 === 0;
    const type = isEven ? 'even' : 'odd';
    if (currentEvenOddStreakType === null) {
      currentEvenOddStreakType = type;
      currentEvenOddStreakCount = 1;
    } else if (currentEvenOddStreakType === type) {
      currentEvenOddStreakCount++;
    } else {
      break;
    }
  }

  let currentOverUnderStreakType: 'under' | 'over' | null = null;
  let currentOverUnderStreakCount = 0;

  for (let i = ticks.length - 1; i >= 0; i--) {
    const isUnder = ticks[i].lastDigit < 5;
    const type = isUnder ? 'under' : 'over';
    if (currentOverUnderStreakType === null) {
      currentOverUnderStreakType = type;
      currentOverUnderStreakCount = 1;
    } else if (currentOverUnderStreakType === type) {
      currentOverUnderStreakCount++;
    } else {
      break;
    }
  }

  return {
    evenCount,
    oddCount,
    evenPercentage: Number(((evenCount / total) * 100).toFixed(1)),
    oddPercentage: Number(((oddCount / total) * 100).toFixed(1)),
    evenStreak: currentEvenOddStreakType === 'even' ? currentEvenOddStreakCount : 0,
    oddStreak: currentEvenOddStreakType === 'odd' ? currentEvenOddStreakCount : 0,
    currentEvenOddStreakType,
    currentEvenOddStreakCount,

    under5Count,
    over4Count,
    under5Percentage: Number(((under5Count / total) * 100).toFixed(1)),
    over4Percentage: Number(((over4Count / total) * 100).toFixed(1)),
    under5Streak: currentOverUnderStreakType === 'under' ? currentOverUnderStreakCount : 0,
    over4Streak: currentOverUnderStreakType === 'over' ? currentOverUnderStreakCount : 0,
    currentOverUnderStreakType,
    currentOverUnderStreakCount,
  };
}
