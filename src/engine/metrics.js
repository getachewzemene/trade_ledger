/**
 * Trading Performance Metrics & Drawdown Engine
 */

/**
 * Calculates R-Multiple for a single trade.
 */
export function calculateRMultiple(netPnL, plannedRiskDollars) {
  if (!plannedRiskDollars || plannedRiskDollars <= 0) return 0;
  return Math.round((netPnL / plannedRiskDollars) * 100) / 100;
}

/**
 * Calculates comprehensive portfolio and trading metrics across a list of trades.
 */
export function calculatePerformanceMetrics(trades, initialCapital = 10000) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      winRate: 0,
      lossRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPnL: 0,
      profitFactor: 0,
      averageWinDollars: 0,
      averageLossDollars: 0,
      averageR: 0,
      expectancyR: 0,
      expectancyDollars: 0,
      maxDrawdownDollars: 0,
      maxDrawdownPercent: 0,
      currentEquity: initialCapital,
      peakEquity: initialCapital
    };
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let netPnL = 0;
  let winCount = 0;
  let lossCount = 0;
  let beCount = 0;
  let totalR = 0;
  let winR = 0;
  let lossR = 0;

  trades.forEach(trade => {
    const pnl = trade.netPnL || 0;
    const r = trade.rMultiple !== undefined ? trade.rMultiple : calculateRMultiple(pnl, trade.plannedRiskDollars);

    netPnL += pnl;
    totalR += r;

    if (pnl > 0.001) {
      winCount++;
      grossProfit += pnl;
      winR += r;
    } else if (pnl < -0.001) {
      lossCount++;
      grossLoss += Math.abs(pnl);
      lossR += Math.abs(r);
    } else {
      beCount++;
    }
  });

  const totalTrades = trades.length;
  const winRate = (winCount / totalTrades) * 100;
  const lossRate = (lossCount / totalTrades) * 100;

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const averageWinDollars = winCount > 0 ? grossProfit / winCount : 0;
  const averageLossDollars = lossCount > 0 ? grossLoss / lossCount : 0;
  const averageWinR = winCount > 0 ? winR / winCount : 0;
  const averageLossR = lossCount > 0 ? lossR / lossCount : 0;
  const averageR = totalTrades > 0 ? totalR / totalTrades : 0;

  // Expectancy formulas: (Win% * AvgWin) - (Loss% * AvgLoss)
  const expectancyDollars = ((winRate / 100) * averageWinDollars) - ((lossRate / 100) * averageLossDollars);
  const expectancyR = ((winRate / 100) * averageWinR) - ((lossRate / 100) * averageLossR);

  // Drawdown curve tracking
  const { maxDrawdownDollars, maxDrawdownPercent, currentEquity, peakEquity } = calculateDrawdown(trades, initialCapital);

  return {
    totalTrades,
    winningTrades: winCount,
    losingTrades: lossCount,
    breakevenTrades: beCount,
    winRate: Math.round(winRate * 10) / 10,
    lossRate: Math.round(lossRate * 10) / 10,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    netPnL: Math.round(netPnL * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    averageWinDollars: Math.round(averageWinDollars * 100) / 100,
    averageLossDollars: Math.round(averageLossDollars * 100) / 100,
    averageR: Math.round(averageR * 100) / 100,
    expectancyR: Math.round(expectancyR * 100) / 100,
    expectancyDollars: Math.round(expectancyDollars * 100) / 100,
    maxDrawdownDollars: Math.round(maxDrawdownDollars * 100) / 100,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 10) / 10,
    currentEquity: Math.round(currentEquity * 100) / 100,
    peakEquity: Math.round(peakEquity * 100) / 100
  };
}

/**
 * Calculates time-series equity and peak-to-trough drawdown.
 */
export function calculateDrawdown(trades, initialCapital = 10000) {
  let runningEquity = initialCapital;
  let peak = initialCapital;
  let maxDdDollars = 0;
  let maxDdPercent = 0;

  const sortedTrades = [...trades].sort((a, b) => new Date(a.exitDate || a.entryDate) - new Date(b.exitDate || b.entryDate));

  const equityCurve = sortedTrades.map((trade, idx) => {
    runningEquity += (trade.netPnL || 0);
    if (runningEquity > peak) {
      peak = runningEquity;
    }
    const ddDollars = peak - runningEquity;
    const ddPercent = peak > 0 ? (ddDollars / peak) * 100 : 0;

    if (ddDollars > maxDdDollars) maxDdDollars = ddDollars;
    if (ddPercent > maxDdPercent) maxDdPercent = ddPercent;

    return {
      index: idx + 1,
      date: trade.exitDate || trade.entryDate,
      symbol: trade.symbol,
      pnl: trade.netPnL || 0,
      rMultiple: trade.rMultiple || 0,
      equity: runningEquity,
      peak,
      drawdownDollars: ddDollars,
      drawdownPercent: ddPercent
    };
  });

  return {
    maxDrawdownDollars: maxDdDollars,
    maxDrawdownPercent: maxDdPercent,
    currentEquity: runningEquity,
    peakEquity: peak,
    equityCurve
  };
}

/**
 * Groups trades by various dimensions: day of week, asset class, setup, or emotional tag.
 */
export function groupTradesBy(trades, key) {
  const groups = {};

  trades.forEach(trade => {
    let groupVal = 'Unspecified';

    if (key === 'dayOfWeek') {
      const d = new Date(trade.entryDate);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      groupVal = isNaN(d.getTime()) ? 'Unknown' : days[d.getDay()];
    } else if (key === 'assetClass') {
      groupVal = trade.assetClass || 'EQUITY';
    } else if (key === 'setupId') {
      groupVal = trade.setupId || 'Discretionary';
    } else if (key === 'emotionalState') {
      groupVal = trade.emotionalState || 'NEUTRAL';
    } else if (key === 'direction') {
      groupVal = trade.direction || 'LONG';
    }

    if (!groups[groupVal]) {
      groups[groupVal] = { name: groupVal, count: 0, netPnL: 0, wins: 0, losses: 0, totalR: 0 };
    }

    groups[groupVal].count++;
    groups[groupVal].netPnL += (trade.netPnL || 0);
    groups[groupVal].totalR += (trade.rMultiple || 0);
    if ((trade.netPnL || 0) > 0) groups[groupVal].wins++;
    else if ((trade.netPnL || 0) < 0) groups[groupVal].losses++;
  });

  return Object.values(groups).map(g => ({
    ...g,
    netPnL: Math.round(g.netPnL * 100) / 100,
    totalR: Math.round(g.totalR * 100) / 100,
    winRate: g.count > 0 ? Math.round((g.wins / g.count) * 100) : 0
  }));
}
