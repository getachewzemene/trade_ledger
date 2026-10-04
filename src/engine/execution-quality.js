/**
 * Execution Quality & Rule Adherence Engine
 * Measures operational fidelity separately from financial P&L.
 * Tracks 4 written rule checkpoints (Entry, Stop Loss, Target, Exit),
 * maps trades into the 4-Quadrant Process vs Outcome Matrix,
 * and compares compliant vs non-compliant cohorts over time.
 * 
 * CORE PRINCIPLE:
 * Following written rules does NOT guarantee profitability.
 * Execution quality measures discipline and process fidelity,
 * separating random market luck from repeatable operational execution.
 */

export const EXECUTION_RULES = Object.freeze({
  ENTRY: 'entry',
  STOP: 'stop',
  TARGET: 'target',
  EXIT: 'exit'
});

export const EXECUTION_RULE_DEFINITIONS = Object.freeze({
  entry: {
    id: 'entry',
    name: 'Written Entry Rule',
    description: 'Waited for qualified playbook trigger, confirmed candle close, and avoided FOMO chasing or front-running.'
  },
  stop: {
    id: 'stop',
    name: 'Written Stop Loss Rule',
    description: 'Predefined structural invalidation stop was placed prior to execution; never widened, cancelled, or removed.'
  },
  target: {
    id: 'target',
    name: 'Written Profit Target Rule',
    description: 'Predefined objective based on key market structure offering valid minimum reward-to-risk; resisted moving out of greed.'
  },
  exit: {
    id: 'exit',
    name: 'Written Exit Rule',
    description: 'Closed strictly per plan (at target, at stop, or scheduled technical invalidation); avoided fear-based premature closure or greed-based over-holding.'
  }
});

export const PROCESS_OUTCOME_QUADRANTS = Object.freeze({
  EARNED_WIN: 'EARNED_WIN',           // Compliant + Win (Good Process, Good Outcome)
  COMPLIANT_LOSS: 'COMPLIANT_LOSS',   // Compliant + Loss (Good Process, Bad Outcome - Routine Business Cost)
  LUCKY_WIN: 'LUCKY_WIN',             // Non-Compliant + Win (Bad Process, Good Outcome - Dangerous Toxic Habit)
  UNFORCED_ERROR: 'UNFORCED_ERROR'    // Non-Compliant + Loss (Bad Process, Bad Outcome - Self-Inflicted Wound)
});

export const EXECUTION_DISCLAIMER = 
  'Discipline is about control over operational actions, not market outcomes. Following written entry, stop, target, and exit rules does NOT guarantee that any single trade or series of trades will be profitable. Market results are probabilistic. High execution quality provides clean, unbiased data to evaluate your edge while preventing catastrophic tail risk and account blowout.';

/**
 * Evaluates execution quality for a single trade based on 4 written rule checkpoints.
 * 
 * @param {Object} trade - Trade record
 * @returns {Object} Structured execution quality evaluation
 */
export function evaluateExecutionQuality(trade = {}) {
  let entryFollowed = true;
  let stopFollowed = true;
  let targetFollowed = true;
  let exitFollowed = true;

  // 1. If explicit rulesFollowed object exists, prioritize it
  if (trade.rulesFollowed && typeof trade.rulesFollowed === 'object') {
    if (trade.rulesFollowed.entry !== undefined) entryFollowed = Boolean(trade.rulesFollowed.entry);
    if (trade.rulesFollowed.stop !== undefined) stopFollowed = Boolean(trade.rulesFollowed.stop);
    if (trade.rulesFollowed.target !== undefined) targetFollowed = Boolean(trade.rulesFollowed.target);
    if (trade.rulesFollowed.exit !== undefined) exitFollowed = Boolean(trade.rulesFollowed.exit);
  } else {
    // 2. Infer from debrief and violations if not explicitly set
    const debrief = trade.debrief || {};
    const violations = Array.isArray(trade.violations) ? trade.violations : [];

    // Entry rule inference
    if (debrief.executionIntegrity && debrief.executionIntegrity !== 'FOLLOWED_PLAN') {
      entryFollowed = false;
    }
    if (violations.some(v => ['CHASED_ENTRY', 'LATE_ENTRY', 'UNQUALIFIED_SETUP'].includes(v))) {
      entryFollowed = false;
    }
    if (trade.setupId === 'DISCRETIONARY' || trade.isPlaybookCompliant === false) {
      entryFollowed = false;
    }

    // Stop rule inference
    if (debrief.tradeManagement === 'MOVED_STOP_WIDER') {
      stopFollowed = false;
    }
    if (violations.some(v => ['STOP_WIDENED', 'NO_STOP'].includes(v))) {
      stopFollowed = false;
    }
    if (trade.stopLoss === undefined || trade.stopLoss === null || Number(trade.stopLoss) <= 0) {
      stopFollowed = false;
    }

    // Target rule inference
    if (violations.some(v => ['TARGET_GREED', 'NO_TARGET'].includes(v))) {
      targetFollowed = false;
    }
    if (trade.takeProfit === undefined || trade.takeProfit === null || Number(trade.takeProfit) <= 0) {
      targetFollowed = false;
    }

    // Exit rule inference
    if (debrief.tradeManagement === 'CLOSED_PREMATURELY') {
      exitFollowed = false;
    }
    if (violations.some(v => ['EARLY_EXIT'].includes(v))) {
      exitFollowed = false;
    }
  }

  const rules = {
    entry: entryFollowed,
    stop: stopFollowed,
    target: targetFollowed,
    exit: exitFollowed
  };

  const passedCount = (entryFollowed ? 1 : 0) + (stopFollowed ? 1 : 0) + (targetFollowed ? 1 : 0) + (exitFollowed ? 1 : 0);
  const score = Math.round((passedCount / 4) * 100);
  const isFullyCompliant = passedCount === 4;

  const breachedRules = [];
  if (!entryFollowed) breachedRules.push('entry');
  if (!stopFollowed) breachedRules.push('stop');
  if (!targetFollowed) breachedRules.push('target');
  if (!exitFollowed) breachedRules.push('exit');

  let grade = 'F';
  let rating = 'SEVERE_BREAKDOWN';
  let color = '#8F251E';

  if (passedCount === 4) {
    grade = 'A';
    rating = 'PERFECT_EXECUTION';
    color = '#1F5C3E';
  } else if (passedCount === 3) {
    grade = 'B';
    rating = 'GOOD_PROCESS';
    color = '#2B6CB0';
  } else if (passedCount === 2) {
    grade = 'C';
    rating = 'MODERATE_SLIPPAGE';
    color = '#B57614';
  } else if (passedCount === 1) {
    grade = 'D';
    rating = 'POOR_DISCIPLINE';
    color = '#C05621';
  }

  return {
    rules,
    passedCount,
    totalRules: 4,
    score,
    grade,
    rating,
    color,
    isFullyCompliant,
    isCompliant: isFullyCompliant,
    breachedRules
  };
}

/**
 * Classifies a trade into the 4-Quadrant Process vs Outcome Matrix.
 * 
 * Quadrants:
 * 1. EARNED_WIN: Good Process, Good Outcome (Compliant Win)
 * 2. COMPLIANT_LOSS: Good Process, Bad Outcome (Compliant Loss - Valid Business Expense)
 * 3. LUCKY_WIN: Bad Process, Good Outcome (Non-Compliant Win - Dangerous Toxic Habit)
 * 4. UNFORCED_ERROR: Bad Process, Bad Outcome (Non-Compliant Loss - Self-Inflicted Wound)
 * 
 * @param {Object} trade - Trade record
 * @returns {Object} Quadrant classification details
 */
export function classifyProcessOutcome(trade = {}) {
  const execution = evaluateExecutionQuality(trade);
  const isCompliant = execution.isFullyCompliant;
  
  const netPnL = Number(trade.netPnL) || 0;
  const rMultiple = Number(trade.rMultiple) || 0;
  const isWin = netPnL > 0 || rMultiple > 0;

  if (isCompliant && isWin) {
    return {
      quadrant: PROCESS_OUTCOME_QUADRANTS.EARNED_WIN,
      title: 'Earned Win',
      subtitle: 'Good Process + Good Outcome',
      badgeClass: 'stamp-clean',
      color: '#1F5C3E',
      processLabel: 'COMPLIANT',
      outcomeLabel: 'WIN',
      isCompliant: true,
      isWin: true,
      execution,
      insight: 'Process and market outcome aligned. High execution quality generated a deserved return.'
    };
  }

  if (isCompliant && !isWin) {
    return {
      quadrant: PROCESS_OUTCOME_QUADRANTS.COMPLIANT_LOSS,
      title: 'Compliant Loss',
      subtitle: 'Good Process + Bad Outcome',
      badgeClass: 'stamp-neutral',
      color: '#2B6CB0',
      processLabel: 'COMPLIANT',
      outcomeLabel: 'LOSS',
      isCompliant: true,
      isWin: false,
      execution,
      insight: 'Rules were followed strictly. In probabilistic trading, stop-outs are routine business expenses, not operational mistakes.'
    };
  }

  if (!isCompliant && isWin) {
    return {
      quadrant: PROCESS_OUTCOME_QUADRANTS.LUCKY_WIN,
      title: 'Lucky Win',
      subtitle: 'Bad Process + Good Outcome',
      badgeClass: 'stamp-warning',
      color: '#B57614',
      processLabel: 'NON-COMPLIANT',
      outcomeLabel: 'WIN',
      isCompliant: false,
      isWin: true,
      execution,
      insight: 'Written rules were broken but market noise bailed you out. This is a dangerous event that falsely reinforces undisciplined habits.'
    };
  }

  // !isCompliant && !isWin
  return {
    quadrant: PROCESS_OUTCOME_QUADRANTS.UNFORCED_ERROR,
    title: 'Unforced Error',
    subtitle: 'Bad Process + Bad Outcome',
    badgeClass: 'stamp-danger',
    color: '#8F251E',
    processLabel: 'NON-COMPLIANT',
    outcomeLabel: 'LOSS',
    isCompliant: false,
    isWin: false,
    execution,
    insight: 'Rules were violated and capital was lost. Self-inflicted wound; review specific breached rules.'
  };
}

/**
 * Calculates aggregate stats for a cohort of trades.
 */
function calculateCohortStats(trades = []) {
  const count = trades.length;
  if (count === 0) {
    return {
      count: 0,
      percentOfTotal: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      netPnL: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      totalR: 0,
      avgR: 0,
      avgWinR: 0,
      avgLossR: 0,
      worstLossR: 0,
      maxDrawdownDollars: 0
    };
  }

  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let netPnL = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalR = 0;
  let winRTotal = 0;
  let lossRTotal = 0;
  let worstLossR = 0;

  trades.forEach(t => {
    const pnl = Number(t.netPnL) || 0;
    const r = Number(t.rMultiple) || 0;
    netPnL += pnl;
    totalR += r;

    if (pnl > 0 || r > 0) {
      wins++;
      grossProfit += Math.max(0, pnl);
      winRTotal += Math.max(0, r);
    } else if (pnl < 0 || r < 0) {
      losses++;
      grossLoss += Math.abs(pnl);
      lossRTotal += Math.abs(r);
      if (Math.abs(r) > worstLossR) {
        worstLossR = Math.abs(r);
      }
    } else {
      breakevens++;
    }
  });

  const winRate = Math.round((wins / count) * 100);
  const profitFactor = grossLoss > 0
    ? Math.round((grossProfit / grossLoss) * 100) / 100
    : (grossProfit > 0 ? 99 : 0);

  const avgR = Math.round((totalR / count) * 100) / 100;
  const avgWinR = wins > 0 ? Math.round((winRTotal / wins) * 100) / 100 : 0;
  const avgLossR = losses > 0 ? Math.round((lossRTotal / losses) * 100) / 100 : 0;

  return {
    count,
    percentOfTotal: 0, // Assigned by caller
    wins,
    losses,
    breakevens,
    winRate,
    netPnL: Math.round(netPnL * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor,
    totalR: Math.round(totalR * 100) / 100,
    avgR,
    avgWinR,
    avgLossR,
    worstLossR: Math.round(worstLossR * 100) / 100
  };
}

/**
 * Compares compliant and non-compliant trades over time.
 * Evaluates execution quality separately from P&L and avoids implying
 * that following rules necessarily produces profits.
 * 
 * @param {Array} trades - List of trade records
 * @returns {Object} Comprehensive cohort comparison and matrix analytics
 */
export function compareExecutionCohorts(trades = []) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      complianceRate: 0,
      compliantCohort: calculateCohortStats([]),
      nonCompliantCohort: calculateCohortStats([]),
      quadrants: {
        earnedWins: { count: 0, percent: 0, totalPnL: 0, totalR: 0 },
        compliantLosses: { count: 0, percent: 0, totalPnL: 0, totalR: 0 },
        luckyWins: { count: 0, percent: 0, totalPnL: 0, totalR: 0 },
        unforcedErrors: { count: 0, percent: 0, totalPnL: 0, totalR: 0 }
      },
      ruleBreakdown: {
        entryComplianceRate: 0,
        stopComplianceRate: 0,
        targetComplianceRate: 0,
        exitComplianceRate: 0
      },
      tailRiskRatio: 1.0,
      disclaimer: EXECUTION_DISCLAIMER,
      insights: ['No trade history available yet to evaluate execution quality.']
    };
  }

  const classifiedTrades = trades.map(t => ({
    trade: t,
    classification: classifyProcessOutcome(t),
    execution: evaluateExecutionQuality(t)
  }));

  const compliantTrades = [];
  const nonCompliantTrades = [];

  let entryPassed = 0;
  let stopPassed = 0;
  let targetPassed = 0;
  let exitPassed = 0;

  const quadrantTally = {
    [PROCESS_OUTCOME_QUADRANTS.EARNED_WIN]: { count: 0, totalPnL: 0, totalR: 0 },
    [PROCESS_OUTCOME_QUADRANTS.COMPLIANT_LOSS]: { count: 0, totalPnL: 0, totalR: 0 },
    [PROCESS_OUTCOME_QUADRANTS.LUCKY_WIN]: { count: 0, totalPnL: 0, totalR: 0 },
    [PROCESS_OUTCOME_QUADRANTS.UNFORCED_ERROR]: { count: 0, totalPnL: 0, totalR: 0 }
  };

  classifiedTrades.forEach(item => {
    const { trade, classification, execution } = item;
    const pnl = Number(trade.netPnL) || 0;
    const r = Number(trade.rMultiple) || 0;

    if (execution.rules.entry) entryPassed++;
    if (execution.rules.stop) stopPassed++;
    if (execution.rules.target) targetPassed++;
    if (execution.rules.exit) exitPassed++;

    if (execution.isFullyCompliant) {
      compliantTrades.push(trade);
    } else {
      nonCompliantTrades.push(trade);
    }

    const q = quadrantTally[classification.quadrant];
    if (q) {
      q.count++;
      q.totalPnL += pnl;
      q.totalR += r;
    }
  });

  const totalTrades = trades.length;
  const compliantStats = calculateCohortStats(compliantTrades);
  const nonCompliantStats = calculateCohortStats(nonCompliantTrades);

  compliantStats.percentOfTotal = Math.round((compliantTrades.length / totalTrades) * 100);
  nonCompliantStats.percentOfTotal = Math.round((nonCompliantTrades.length / totalTrades) * 100);

  const complianceRate = compliantStats.percentOfTotal;

  // Tail Risk Comparison:
  // Non-compliant trades often suffer from runaway losses due to widening/moving stops.
  const tailRiskRatio = compliantStats.worstLossR > 0
    ? Math.round((nonCompliantStats.worstLossR / compliantStats.worstLossR) * 100) / 100
    : (nonCompliantStats.worstLossR > 0 ? nonCompliantStats.worstLossR : 1.0);

  const quadrants = {
    earnedWins: {
      count: quadrantTally[PROCESS_OUTCOME_QUADRANTS.EARNED_WIN].count,
      percent: Math.round((quadrantTally[PROCESS_OUTCOME_QUADRANTS.EARNED_WIN].count / totalTrades) * 100),
      totalPnL: Math.round(quadrantTally[PROCESS_OUTCOME_QUADRANTS.EARNED_WIN].totalPnL * 100) / 100,
      totalR: Math.round(quadrantTally[PROCESS_OUTCOME_QUADRANTS.EARNED_WIN].totalR * 100) / 100
    },
    compliantLosses: {
      count: quadrantTally[PROCESS_OUTCOME_QUADRANTS.COMPLIANT_LOSS].count,
      percent: Math.round((quadrantTally[PROCESS_OUTCOME_QUADRANTS.COMPLIANT_LOSS].count / totalTrades) * 100),
      totalPnL: Math.round(quadrantTally[PROCESS_OUTCOME_QUADRANTS.COMPLIANT_LOSS].totalPnL * 100) / 100,
      totalR: Math.round(quadrantTally[PROCESS_OUTCOME_QUADRANTS.COMPLIANT_LOSS].totalR * 100) / 100
    },
    luckyWins: {
      count: quadrantTally[PROCESS_OUTCOME_QUADRANTS.LUCKY_WIN].count,
      percent: Math.round((quadrantTally[PROCESS_OUTCOME_QUADRANTS.LUCKY_WIN].count / totalTrades) * 100),
      totalPnL: Math.round(quadrantTally[PROCESS_OUTCOME_QUADRANTS.LUCKY_WIN].totalPnL * 100) / 100,
      totalR: Math.round(quadrantTally[PROCESS_OUTCOME_QUADRANTS.LUCKY_WIN].totalR * 100) / 100
    },
    unforcedErrors: {
      count: quadrantTally[PROCESS_OUTCOME_QUADRANTS.UNFORCED_ERROR].count,
      percent: Math.round((quadrantTally[PROCESS_OUTCOME_QUADRANTS.UNFORCED_ERROR].count / totalTrades) * 100),
      totalPnL: Math.round(quadrantTally[PROCESS_OUTCOME_QUADRANTS.UNFORCED_ERROR].totalPnL * 100) / 100,
      totalR: Math.round(quadrantTally[PROCESS_OUTCOME_QUADRANTS.UNFORCED_ERROR].totalR * 100) / 100
    }
  };

  const ruleBreakdown = {
    entryComplianceRate: Math.round((entryPassed / totalTrades) * 100),
    stopComplianceRate: Math.round((stopPassed / totalTrades) * 100),
    targetComplianceRate: Math.round((targetPassed / totalTrades) * 100),
    exitComplianceRate: Math.round((exitPassed / totalTrades) * 100),
    overallComplianceRate: complianceRate
  };

  // Behavioral insights without implying rule adherence guarantees profit
  const insights = [];

  insights.push(
    `Process Adherence: ${complianceRate}% of trades strictly honored written entry, stop, target, and exit rules (${compliantTrades.length}/${totalTrades}).`
  );

  if (quadrants.compliantLosses.count > 0) {
    insights.push(
      `Normal Business Expenses: You executed ${quadrants.compliantLosses.count} compliant losses (${quadrants.compliantLosses.percent}% of trades). These are valid probabilistic outcomes, not errors.`
    );
  }

  if (quadrants.luckyWins.count > 0) {
    insights.push(
      `Toxic Reinforcement Alert: ${quadrants.luckyWins.count} winning trades broke written rules ($${quadrants.luckyWins.totalPnL.toFixed(2)} gain). Do not let random winning noise validate bad process.`
    );
  }

  if (quadrants.unforcedErrors.count > 0) {
    insights.push(
      `Unforced Errors: ${quadrants.unforcedErrors.count} trades were both non-compliant and unprofitable, draining $${Math.abs(quadrants.unforcedErrors.totalPnL).toFixed(2)}.`
    );
  }

  if (nonCompliantStats.worstLossR > compliantStats.worstLossR) {
    insights.push(
      `Tail Risk Shield: Compliant trades capped your worst loss at -${compliantStats.worstLossR.toFixed(1)}R, whereas non-compliant deviations suffered a -${nonCompliantStats.worstLossR.toFixed(1)}R outlier.`
    );
  }

  return {
    totalTrades,
    complianceRate,
    compliantCohort: compliantStats,
    nonCompliantCohort: nonCompliantStats,
    quadrants,
    ruleBreakdown,
    tailRiskRatio,
    disclaimer: EXECUTION_DISCLAIMER,
    insights
  };
}
