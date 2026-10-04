/**
 * Trader History Review Engine
 * Generates empirical, personalized observations strictly derived from the trader's
 * own historical trade ledger, complete with sample sizes (n) and quantified uncertainty
 * (Wilson score 95% confidence intervals and standard errors).
 *
 * Epistemological principle: Phrased strictly as retrospective observations,
 * never as forward predictions or prescriptive generic trading tips.
 */

import { filterPerformanceTrades, isSampleTrade } from './trade-provenance.js';
import { getInstrumentSpec } from './sizing.js';
import { calculateExcursionR } from './excursion.js';

export const REVIEW_DISCLAIMER = Object.freeze({
  text: 'All review statements are strictly descriptive observations of your historical execution record. They do not constitute forward predictions, performance guarantees, or generic trading advice. Confidence intervals quantify observational uncertainty due to sample size limits.',
  isPrediction: false
});

/**
 * Calculates Wilson score 95% confidence interval for a binomial proportion.
 * @param {number} count - Number of occurrences (k)
 * @param {number} total - Sample size (n)
 * @param {number} confidence - Confidence level (default 0.95 -> z = 1.96)
 */
export function calculateWilsonConfidenceInterval(count, total, confidence = 0.95) {
  const k = Math.max(0, Number(count) || 0);
  const n = Math.max(0, Number(total) || 0);

  if (n === 0) {
    return {
      count: 0,
      total: 0,
      proportion: 0,
      percentage: 0,
      lowerProportion: 0,
      upperProportion: 0,
      lowerPercent: 0,
      upperPercent: 0,
      formatted: '0.0% – 0.0%',
      marginOfErrorPercent: 0
    };
  }

  const p = Math.min(1, Math.max(0, k / n));
  // z-value for confidence (1.95996 for 95%)
  const z = confidence === 0.99 ? 2.576 : confidence === 0.90 ? 1.645 : 1.96;
  const z2 = z * z;

  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const factor = (z / denominator) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  const lower = Math.max(0, center - factor);
  const upper = Math.min(1, center + factor);

  const lowerPct = Math.round(lower * 1000) / 10;
  const upperPct = Math.round(upper * 1000) / 10;
  const marginPct = Math.round(((upperPct - lowerPct) / 2) * 10) / 10;

  return {
    count: k,
    total: n,
    proportion: Math.round(p * 10000) / 10000,
    percentage: Math.round(p * 1000) / 10,
    lowerProportion: Math.round(lower * 10000) / 10000,
    upperProportion: Math.round(upper * 10000) / 10000,
    lowerPercent: lowerPct,
    upperPercent: upperPct,
    formatted: `${lowerPct.toFixed(1)}% – ${upperPct.toFixed(1)}%`,
    marginOfErrorPercent: marginPct
  };
}

/**
 * Calculates sample mean, standard error, and 95% confidence interval for continuous metrics.
 * @param {number[]} values - Array of numeric values
 * @param {number} confidence - Confidence level (default 0.95 -> z = 1.96)
 */
export function calculateContinuousConfidenceInterval(values = [], confidence = 0.95) {
  const safeVals = (Array.isArray(values) ? values : []).map(v => Number(v)).filter(v => Number.isFinite(v));
  const n = safeVals.length;

  if (n === 0) {
    return {
      count: 0,
      mean: 0,
      stdDev: 0,
      standardError: 0,
      marginOfError: 0,
      ciLower: 0,
      ciUpper: 0,
      formatted: '0.00 ± 0.00 (95% CI: [0.00, 0.00])'
    };
  }

  const sum = safeVals.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  if (n === 1) {
    return {
      count: 1,
      mean: Math.round(mean * 100) / 100,
      stdDev: 0,
      standardError: 0,
      marginOfError: 0,
      ciLower: Math.round(mean * 100) / 100,
      ciUpper: Math.round(mean * 100) / 100,
      formatted: `${mean.toFixed(2)} (n = 1, single sample)`
    };
  }

  const variance = safeVals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const standardError = stdDev / Math.sqrt(n);

  const z = confidence === 0.99 ? 2.576 : confidence === 0.90 ? 1.645 : 1.96;
  const marginOfError = z * standardError;
  const ciLower = mean - marginOfError;
  const ciUpper = mean + marginOfError;

  return {
    count: n,
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    standardError: Math.round(standardError * 100) / 100,
    marginOfError: Math.round(marginOfError * 100) / 100,
    ciLower: Math.round(ciLower * 100) / 100,
    ciUpper: Math.round(ciUpper * 100) / 100,
    formatted: `${mean.toFixed(2)} ± ${standardError.toFixed(2)} (95% CI: [${ciLower.toFixed(2)}, ${ciUpper.toFixed(2)}])`
  };
}

/**
 * Extracts or estimates transaction friction (commissions, spread, slippage) for a trade.
 */
export function extractTradeCost(trade) {
  if (Number.isFinite(Number(trade.commissions)) || Number.isFinite(Number(trade.costs))) {
    const comm = Number(trade.commissions) || Number(trade.costs) || 0;
    const spread = Number(trade.spreadCost) || 0;
    const slip = Number(trade.slippageCost) || 0;
    return Math.max(0, comm + spread + slip);
  }

  const spec = getInstrumentSpec(trade.symbol, trade.assetClass, trade.entryPrice);
  const qty = Number(trade.quantity) || 1;
  return Math.max(0, (spec.totalFrictionPerUnit || (spec.defaultCommission + (spec.defaultSpreadCost || 0) + (spec.defaultSlippageCost || 0))) * qty);
}

/**
 * Formats a sample size caveat based on n.
 */
export function getSampleSizeCaveat(n) {
  if (n === 0) return 'No historical data recorded.';
  if (n < 10) return `Preliminary observation (${n} trades). Observational variance is elevated; insufficient sample size for statistical stability.`;
  if (n < 30) return `Limited sample size (${n} trades, n < 30). Confidence intervals are wide, reflecting observational uncertainty.`;
  return `Robust sample size (${n} trades, n ≥ 30). Meets empirical statistical baseline.`;
}

/**
 * 1. Target Adherence & Premature Exit Observation
 * Observes frequency of exits before planned targets.
 */
export function analyzeTargetAdherenceObservation(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  
  // Trades where a target was planned
  const targetTrades = safeTrades.filter(t => {
    const hasTargetPrice = Number(t.takeProfit) > 0 || Number(t.targetPrice) > 0;
    const hasTargetRule = t.rulesFollowed && typeof t.rulesFollowed.target === 'boolean';
    return hasTargetPrice || hasTargetRule;
  });

  const n = targetTrades.length;
  if (n === 0) return null;

  let prematureCount = 0;
  const realizedRList = [];
  const plannedRList = [];

  targetTrades.forEach(t => {
    const dir = String(t.direction || 'LONG').toUpperCase();
    const entry = Number(t.entryPrice) || 0;
    const stop = Number(t.stopLoss) || 0;
    const target = Number(t.takeProfit) || Number(t.targetPrice) || 0;
    const exit = Number(t.exitPrice) || 0;
    const stopDist = Math.abs(entry - stop);

    let exitedEarly = false;

    // Check violations or debrief flags
    if (Array.isArray(t.violations) && t.violations.includes('EARLY_EXIT')) {
      exitedEarly = true;
    } else if (t.debrief?.tradeManagement === 'CLOSED_PREMATURELY') {
      exitedEarly = true;
    } else if (t.rulesFollowed?.exit === false && Number(t.netPnL || 0) > 0) {
      exitedEarly = true;
    } else if (exit > 0 && target > 0 && entry > 0) {
      if (dir === 'LONG' && exit < target && exit > entry) exitedEarly = true;
      if (dir === 'SHORT' && exit > target && exit < entry) exitedEarly = true;
    }

    if (exitedEarly) {
      prematureCount++;
      const realizedR = Number(t.rMultiple) || (stopDist > 0 ? (dir === 'LONG' ? (exit - entry) / stopDist : (entry - exit) / stopDist) : 0);
      realizedRList.push(realizedR);
      const plannedR = stopDist > 0 && target > 0 ? Math.abs(target - entry) / stopDist : 2.0;
      plannedRList.push(plannedR);
    }
  });

  const wilson = calculateWilsonConfidenceInterval(prematureCount, n);
  const avgRealizedR = realizedRList.length > 0 ? realizedRList.reduce((a, b) => a + b, 0) / realizedRList.length : 0;
  const avgPlannedR = plannedRList.length > 0 ? plannedRList.reduce((a, b) => a + b, 0) / plannedRList.length : 0;

  const headline = prematureCount / n >= 0.4
    ? 'Frequent Exit Prior to Planned Target'
    : 'Disciplined Target Patience';

  let observationText = '';
  if (prematureCount / n >= 0.4) {
    observationText = `In your logged history, you often exited before your planned target. Across ${n} trades with a planned target (n = ${n}), exit occurred prior to target in ${prematureCount} trades (${wilson.percentage.toFixed(1)}% [95% CI: ${wilson.formatted}]). In these premature exits, realized return averaged +${avgRealizedR.toFixed(2)}R compared to your planned target objective of +${avgPlannedR.toFixed(2)}R.`;
  } else {
    observationText = `In your logged history, across ${n} trades with a planned target (n = ${n}), exit occurred before target in ${prematureCount} trades (${wilson.percentage.toFixed(1)}% [95% CI: ${wilson.formatted}]), while ${n - prematureCount} trades (${(100 - wilson.percentage).toFixed(1)}%) reached or exceeded your target plan.`;
  }

  return {
    id: 'target-adherence',
    topic: 'Target Execution',
    headline,
    observation: observationText,
    sampleSize: n,
    eventCount: prematureCount,
    percentage: wilson.percentage,
    uncertainty: {
      type: 'WILSON_SCORE_95',
      ...wilson
    },
    metrics: {
      prematureExits: prematureCount,
      totalWithTarget: n,
      avgRealizedR: Math.round(avgRealizedR * 100) / 100,
      avgPlannedR: Math.round(avgPlannedR * 100) / 100
    },
    sampleSizeCaveat: getSampleSizeCaveat(n),
    isPrediction: false
  };
}

/**
 * 2. Session Transaction Cost & Execution Friction Drift Observation
 * Compares recent window (e.g. last 20 trades or recent session) against prior trades.
 */
export function analyzeSessionCostDriftObservation(trades = [], windowSize = 20) {
  const safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  if (safeTrades.length === 0) return null;

  // Sort chronologically
  const sorted = [...safeTrades].sort((a, b) => new Date(a.entryDate || 0) - new Date(b.entryDate || 0));
  const total = sorted.length;

  // Extract costs
  const costs = sorted.map(t => ({
    cost: extractTradeCost(t),
    session: t.session || inferTradeSession(t),
    entryDate: t.entryDate
  }));

  const actualWindow = Math.min(windowSize, total);
  const recentTrades = costs.slice(-actualWindow);
  const priorTrades = total > actualWindow ? costs.slice(0, total - actualWindow) : [];

  const recentVals = recentTrades.map(t => t.cost);
  const priorVals = priorTrades.map(t => t.cost);

  const recentStats = calculateContinuousConfidenceInterval(recentVals);
  const priorStats = calculateContinuousConfidenceInterval(priorVals);

  // Identify primary session of recent trades
  const sessionCounts = {};
  recentTrades.forEach(t => {
    sessionCounts[t.session] = (sessionCounts[t.session] || 0) + 1;
  });
  let primarySession = 'active';
  let maxCount = 0;
  for (const [sess, count] of Object.entries(sessionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primarySession = sess;
    }
  }

  let headline = 'Stable Transaction Friction';
  let observationText = '';
  const isCostHigher = priorStats.count > 0 && recentStats.mean > priorStats.mean * 1.15;

  if (isCostHigher) {
    headline = 'Elevated Transaction Friction in Recent Session';
    observationText = `Your last ${recentStats.count} trades in the ${primarySession} session had higher average costs ($${recentStats.mean.toFixed(2)} ± $${recentStats.standardError.toFixed(2)}, 95% CI: [$${recentStats.ciLower.toFixed(2)}, $${recentStats.ciUpper.toFixed(2)}], n = ${recentStats.count}) compared to your earlier trades ($${priorStats.mean.toFixed(2)} ± $${priorStats.standardError.toFixed(2)}, 95% CI: [$${priorStats.ciLower.toFixed(2)}, $${priorStats.ciUpper.toFixed(2)}], n = ${priorStats.count}).`;
  } else if (priorStats.count > 0) {
    observationText = `Across your last ${recentStats.count} trades in the ${primarySession} session, average transaction costs were $${recentStats.mean.toFixed(2)} ± $${recentStats.standardError.toFixed(2)} (95% CI: [$${recentStats.ciLower.toFixed(2)}, $${recentStats.ciUpper.toFixed(2)}], n = ${recentStats.count}), compared to $${priorStats.mean.toFixed(2)} ± $${priorStats.standardError.toFixed(2)} in earlier trades (n = ${priorStats.count}).`;
  } else {
    observationText = `Across your ${recentStats.count} logged trades (n = ${recentStats.count}), average transaction costs were $${recentStats.mean.toFixed(2)} ± $${recentStats.standardError.toFixed(2)} (95% CI: [$${recentStats.ciLower.toFixed(2)}, $${recentStats.ciUpper.toFixed(2)}]).`;
  }

  return {
    id: 'session-cost-drift',
    topic: 'Transaction Costs',
    headline,
    observation: observationText,
    sampleSize: recentStats.count,
    priorSampleSize: priorStats.count,
    uncertainty: {
      type: 'MEAN_CONFIDENCE_INTERVAL_95',
      recent: recentStats,
      prior: priorStats
    },
    metrics: {
      recentMeanCost: recentStats.mean,
      priorMeanCost: priorStats.mean,
      costDelta: Math.round((recentStats.mean - priorStats.mean) * 100) / 100,
      sessionName: primarySession
    },
    sampleSizeCaveat: getSampleSizeCaveat(recentStats.count),
    isPrediction: false
  };
}

/**
 * 3. Stop Loss Invalidation & Widening Observation
 */
export function analyzeStopAdherenceObservation(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const losingTrades = safeTrades.filter(t => Number(t.netPnL || 0) < 0);
  const n = losingTrades.length;

  if (n === 0) return null;

  let widenedCount = 0;
  const widenedLossesR = [];
  const normalLossesR = [];

  losingTrades.forEach(t => {
    const pnl = Number(t.netPnL || 0);
    const risk = Number(t.plannedRiskDollars || 0);
    const isWidened = (Array.isArray(t.violations) && t.violations.includes('STOP_WIDENED'))
      || t.debrief?.tradeManagement === 'MOVED_STOP_WIDER'
      || t.rulesFollowed?.stop === false
      || (risk > 0 && Math.abs(pnl) > risk * 1.25);

    const r = Math.abs(Number(t.rMultiple) || (risk > 0 ? pnl / risk : 1.0));

    if (isWidened) {
      widenedCount++;
      widenedLossesR.push(r);
    } else {
      normalLossesR.push(r);
    }
  });

  const wilson = calculateWilsonConfidenceInterval(widenedCount, n);
  const avgWidenedR = widenedLossesR.length > 0 ? widenedLossesR.reduce((a, b) => a + b, 0) / widenedLossesR.length : 0;
  const avgNormalR = normalLossesR.length > 0 ? normalLossesR.reduce((a, b) => a + b, 0) / normalLossesR.length : 1.0;

  const headline = widenedCount > 0 ? 'Stop Loss Invalidation Drift' : 'Flawless Stop Invalidation';
  let observationText = '';

  if (widenedCount > 0) {
    observationText = `Across your ${n} recorded losing trades (n = ${n}), stop loss was widened beyond planned initial risk in ${widenedCount} trades (${wilson.percentage.toFixed(1)}% [95% CI: ${wilson.formatted}]). In widened stop trades, average realized loss expanded to -${avgWidenedR.toFixed(2)}R compared to -${avgNormalR.toFixed(2)}R on planned exits.`;
  } else {
    observationText = `Across all ${n} recorded losing trades (n = ${n}), stop loss rules were respected with zero widened stops (0.0% [95% CI: ${wilson.formatted}]), capping maximum loss strictly to initial planned risk.`;
  }

  return {
    id: 'stop-adherence',
    topic: 'Stop Loss Execution',
    headline,
    observation: observationText,
    sampleSize: n,
    eventCount: widenedCount,
    percentage: wilson.percentage,
    uncertainty: {
      type: 'WILSON_SCORE_95',
      ...wilson
    },
    metrics: {
      widenedCount,
      totalLosses: n,
      avgWidenedLossR: Math.round(avgWidenedR * 100) / 100,
      avgNormalLossR: Math.round(avgNormalR * 100) / 100
    },
    sampleSizeCaveat: getSampleSizeCaveat(n),
    isPrediction: false
  };
}

/**
 * 4. Post-Loss Discipline Sequence Observation
 */
export function analyzePostLossSequenceObservation(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  if (safeTrades.length < 4) return null;

  const sorted = [...safeTrades].sort((a, b) => new Date(a.entryDate || 0) - new Date(b.entryDate || 0));

  let afterLossTotal = 0;
  let afterLossCompliant = 0;
  let afterWinTotal = 0;
  let afterWinCompliant = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const prevWasLoss = Number(prev.netPnL || 0) < 0;
    const prevWasWin = Number(prev.netPnL || 0) > 0;

    const isCompliant = curr.isFullyCompliant === true
      || (curr.rulesFollowed && curr.rulesFollowed.entry && curr.rulesFollowed.stop && curr.rulesFollowed.target && curr.rulesFollowed.exit)
      || (!Array.isArray(curr.violations) || curr.violations.length === 0);

    if (prevWasLoss) {
      afterLossTotal++;
      if (isCompliant) afterLossCompliant++;
    } else if (prevWasWin) {
      afterWinTotal++;
      if (isCompliant) afterWinCompliant++;
    }
  }

  if (afterLossTotal === 0) return null;

  const lossWilson = calculateWilsonConfidenceInterval(afterLossCompliant, afterLossTotal);
  const winWilson = calculateWilsonConfidenceInterval(afterWinCompliant, afterWinTotal);

  const headline = lossWilson.percentage < winWilson.percentage * 0.8
    ? 'Post-Loss Execution Quality Decay'
    : 'Disciplined Post-Loss Consistency';

  const observationText = `In trades executed immediately following a loss (n = ${afterLossTotal}), written rule compliance was ${lossWilson.percentage.toFixed(1)}% [95% CI: ${lossWilson.formatted}] (${afterLossCompliant}/${afterLossTotal} trades), compared to ${winWilson.percentage.toFixed(1)}% [95% CI: ${winWilson.formatted}] in trades following a win (n = ${afterWinTotal}).`;

  return {
    id: 'post-loss-sequence',
    topic: 'Sequence & State',
    headline,
    observation: observationText,
    sampleSize: afterLossTotal,
    comparisonSampleSize: afterWinTotal,
    uncertainty: {
      type: 'WILSON_SCORE_DUAL_95',
      afterLoss: lossWilson,
      afterWin: winWilson
    },
    metrics: {
      afterLossCompliancePercent: lossWilson.percentage,
      afterWinCompliancePercent: winWilson.percentage,
      complianceDeltaPercent: Math.round((lossWilson.percentage - winWilson.percentage) * 10) / 10
    },
    sampleSizeCaveat: getSampleSizeCaveat(afterLossTotal),
    isPrediction: false
  };
}

/**
 * 5. Excursion Efficiency & Peak Upside Realization Observation
 */
export function analyzeExcursionObservation(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const winsWithExcursion = safeTrades.filter(t => {
    const hasData = (Number(t.maePrice) > 0 || Number(t.mfePrice) > 0);
    return hasData && Number(t.netPnL || 0) > 0;
  });

  const n = winsWithExcursion.length;
  if (n < 2) return null;

  const mfeList = [];
  const realizedList = [];

  winsWithExcursion.forEach(t => {
    const { mfeR } = calculateExcursionR(t);
    const realizedR = Math.max(0, Number(t.rMultiple) || 0);
    mfeList.push(mfeR);
    realizedList.push(realizedR);
  });

  const mfeStats = calculateContinuousConfidenceInterval(mfeList);
  const realizedStats = calculateContinuousConfidenceInterval(realizedList);
  const captureRatioPct = mfeStats.mean > 0 ? Math.round((realizedStats.mean / mfeStats.mean) * 1000) / 10 : 0;

  const headline = captureRatioPct < 60
    ? 'Significant Unrealized Upside Left On Table'
    : 'Efficient Upside Target Realization';

  const observationText = `In your ${n} winning trades with recorded excursion data (n = ${n}), price reached an average favorable peak of +${mfeStats.mean.toFixed(2)}R ± ${mfeStats.standardError.toFixed(2)}R (95% CI: [+${mfeStats.ciLower.toFixed(2)}R, +${mfeStats.ciUpper.toFixed(2)}R]), while your realized exits captured +${realizedStats.mean.toFixed(2)}R ± ${realizedStats.standardError.toFixed(2)}R (95% CI: [+${realizedStats.ciLower.toFixed(2)}R, +${realizedStats.ciUpper.toFixed(2)}R]), realizing ${captureRatioPct}% of peak expansion.`;

  return {
    id: 'excursion-efficiency',
    topic: 'Excursion & Expansion',
    headline,
    observation: observationText,
    sampleSize: n,
    uncertainty: {
      type: 'MEAN_CONFIDENCE_INTERVAL_95',
      mfe: mfeStats,
      realized: realizedStats
    },
    metrics: {
      avgPeakMfeR: mfeStats.mean,
      avgRealizedR: realizedStats.mean,
      captureRatioPercent: captureRatioPct
    },
    sampleSizeCaveat: getSampleSizeCaveat(n),
    isPrediction: false
  };
}

/**
 * Helper to infer session name from trade timestamp if not explicitly present.
 */
function inferTradeSession(trade) {
  if (trade.session) return String(trade.session).toUpperCase();
  const dateStr = trade.entryDate || trade.date;
  if (!dateStr) return 'REGULAR';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'REGULAR';
  const hour = d.getUTCHours();
  if (hour >= 7 && hour < 13) return 'LONDON / MORNING';
  if (hour >= 13 && hour < 20) return 'NEW YORK / AFTERNOON';
  if (hour >= 20 || hour < 2) return 'ASIAN / EVENING';
  return 'OVERNIGHT';
}

/**
 * Master generator of empirical trader history review observations.
 * Analyzes the trader's personal history, isolating sample data by default.
 */
export function generateTraderHistoryObservations(trades = [], options = {}) {
  const excludeSample = options.excludeSample !== false;
  let safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];

  if (excludeSample) {
    safeTrades = safeTrades.filter(t => !isSampleTrade(t));
  }

  // Also apply performance filter by default
  const performanceTrades = filterPerformanceTrades(safeTrades, options);
  const targetTrades = performanceTrades.length > 0 ? performanceTrades : safeTrades;

  const totalTrades = targetTrades.length;
  const observations = [];

  // Generate distinct empirical modules
  const targetAdherence = analyzeTargetAdherenceObservation(targetTrades);
  if (targetAdherence) observations.push(targetAdherence);

  const sessionCostDrift = analyzeSessionCostDriftObservation(targetTrades, options.windowSize || 20);
  if (sessionCostDrift) observations.push(sessionCostDrift);

  const stopAdherence = analyzeStopAdherenceObservation(targetTrades);
  if (stopAdherence) observations.push(stopAdherence);

  const postLossSeq = analyzePostLossSequenceObservation(targetTrades);
  if (postLossSeq) observations.push(postLossSeq);

  const excursionObs = analyzeExcursionObservation(targetTrades);
  if (excursionObs) observations.push(excursionObs);

  return {
    totalTradesAnalyzed: totalTrades,
    scope: options.includeSample ? 'ALL_RECORDS' : 'PERSONAL_AND_IMPORTED',
    observationCount: observations.length,
    observations,
    disclaimer: REVIEW_DISCLAIMER.text,
    isPrediction: false,
    generatedAt: new Date().toISOString()
  };
}
