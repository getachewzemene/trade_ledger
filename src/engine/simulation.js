/**
 * Monte Carlo & Losing Streak Variance Simulator
 * Educates beginners on statistical variance and cures system-hopping.
 */

/**
 * Runs Monte Carlo simulations of trade sequences to calculate streak probabilities.
 */
export function simulateLosingStreakProbabilities({
  winRatePercent = 50,
  tradesCount = 100,
  iterations = 1000
}) {
  const winRate = Math.max(1, Math.min(99, winRatePercent)) / 100;
  
  const streakOccurrences = {
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0
  };

  let totalMaxStreak = 0;

  for (let iter = 0; iter < iterations; iter++) {
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    for (let t = 0; t < tradesCount; t++) {
      const isWin = Math.random() < winRate;
      if (!isWin) {
        currentLossStreak++;
        if (currentLossStreak > maxLossStreak) {
          maxLossStreak = currentLossStreak;
        }
      } else {
        currentLossStreak = 0;
      }
    }

    totalMaxStreak += maxLossStreak;

    if (maxLossStreak >= 3) streakOccurrences[3]++;
    if (maxLossStreak >= 4) streakOccurrences[4]++;
    if (maxLossStreak >= 5) streakOccurrences[5]++;
    if (maxLossStreak >= 6) streakOccurrences[6]++;
    if (maxLossStreak >= 7) streakOccurrences[7]++;
  }

  const p3 = Math.round((streakOccurrences[3] / iterations) * 100);
  const p4 = Math.round((streakOccurrences[4] / iterations) * 100);
  const p5 = Math.round((streakOccurrences[5] / iterations) * 100);
  const p6 = Math.round((streakOccurrences[6] / iterations) * 100);
  const p7 = Math.round((streakOccurrences[7] / iterations) * 100);
  const avgMaxStreak = Math.round((totalMaxStreak / iterations) * 10) / 10;

  let advice = '';
  if (p4 >= 70) {
    advice = `Even with a ${winRatePercent}% win rate, a 4-trade losing streak is almost guaranteed (${p4}% chance over ${tradesCount} trades). If you are currently in a 3 or 4 trade drawdown, do not abandon your playbook—this is normal mathematical distribution.`;
  } else {
    advice = `Over ${tradesCount} trades, your average expected maximum drawdown streak is ~${avgMaxStreak} consecutive losses. Sizing each trade at 1-1.5% ensures this streak causes zero permanent account damage.`;
  }

  return {
    winRatePercent,
    tradesCount,
    iterations,
    avgMaxStreak,
    probabilities: {
      streak3: p3,
      streak4: p4,
      streak5: p5,
      streak6: p6,
      streak7: p7
    },
    advice
  };
}
