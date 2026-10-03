/**
 * Prop Firm Guardian & Dynamic Drawdown Buffer Engine
 * 
 * Provides automated risk calculations, trailing high-water mark tracking,
 * daily loss runway sizers, consistency rule auditing, and payout readiness
 * verification for top prop firm evaluation and funded accounts.
 */

export const PROP_FIRM_PRESETS = {
  TOPSTEP_50K: {
    id: 'TOPSTEP_50K',
    name: 'Topstep 50K (Futures)',
    accountType: 'FUTURES',
    startingBalance: 50000,
    profitTarget: 3000,
    maxTotalDrawdown: 2000,
    drawdownType: 'TRAILING_INTRADAY', // Trails unrealized/realized peak, locks at starting balance
    lockAtStartingBalance: true,
    maxDailyLoss: 1000,
    minTradingDays: 2,
    consistencyRulePercent: 50, // 50% consistency rule in Express/Funded
    payoutMinBuffer: 2100, // Cushion above 50k required before first withdrawal
    description: '$50,000 account, $3,000 target, $2,000 trailing drawdown (locks at $50,100), $1,000 daily loss.'
  },
  TOPSTEP_100K: {
    id: 'TOPSTEP_100K',
    name: 'Topstep 100K (Futures)',
    accountType: 'FUTURES',
    startingBalance: 100000,
    profitTarget: 6000,
    maxTotalDrawdown: 3000,
    drawdownType: 'TRAILING_INTRADAY',
    lockAtStartingBalance: true,
    maxDailyLoss: 2000,
    minTradingDays: 2,
    consistencyRulePercent: 50,
    payoutMinBuffer: 3100,
    description: '$100,000 account, $6,000 target, $3,000 trailing drawdown, $2,000 daily loss.'
  },
  APEX_50K: {
    id: 'APEX_50K',
    name: 'Apex Trader Funding 50K (Futures)',
    accountType: 'FUTURES',
    startingBalance: 50000,
    profitTarget: 3000,
    maxTotalDrawdown: 2500,
    drawdownType: 'TRAILING_INTRADAY', // Trails intraday unrealized high-water mark
    lockAtStartingBalance: false, // Continues trailing up
    maxDailyLoss: null, // No hard daily stop by firm, but recommended
    minTradingDays: 7,
    consistencyRulePercent: 30, // 30% consistency rule for payout
    payoutMinBuffer: 2600, // Safety threshold for payout
    description: '$50,000 account, $3,000 target, $2,500 live trailing drawdown, 30% consistency for payout.'
  },
  FTMO_100K: {
    id: 'FTMO_100K',
    name: 'FTMO 100K Normal (Forex/CFD)',
    accountType: 'FOREX',
    startingBalance: 100000,
    profitTarget: 10000, // Phase 1 (Phase 2 is 5,000)
    maxTotalDrawdown: 10000, // 10% static from starting balance
    drawdownType: 'STATIC_BALANCE',
    lockAtStartingBalance: false,
    maxDailyLoss: 5000, // 5% max daily loss from midnight balance
    minTradingDays: 4,
    consistencyRulePercent: null, // No explicit % consistency in normal phase
    payoutMinBuffer: 0,
    description: '$100,000 account, $10,000 target, $10,000 static max loss, $5,000 daily loss from midnight.'
  },
  FTMO_50K: {
    id: 'FTMO_50K',
    name: 'FTMO 50K Normal (Forex/CFD)',
    accountType: 'FOREX',
    startingBalance: 50000,
    profitTarget: 5000,
    maxTotalDrawdown: 5000,
    drawdownType: 'STATIC_BALANCE',
    lockAtStartingBalance: false,
    maxDailyLoss: 2500,
    minTradingDays: 4,
    consistencyRulePercent: null,
    payoutMinBuffer: 0,
    description: '$50,000 account, $5,000 target, $5,000 static max loss, $2,500 daily loss.'
  },
  FUNDEDNEXT_100K: {
    id: 'FUNDEDNEXT_100K',
    name: 'FundedNext 100K Stellar (Forex/CFD)',
    accountType: 'FOREX',
    startingBalance: 100000,
    profitTarget: 8000,
    maxTotalDrawdown: 10000,
    drawdownType: 'STATIC_BALANCE',
    lockAtStartingBalance: false,
    maxDailyLoss: 5000,
    minTradingDays: 5,
    consistencyRulePercent: 40,
    payoutMinBuffer: 1000,
    description: '$100,000 account, $8,000 target, $10,000 max loss, $5,000 daily loss, 40% consistency.'
  }
};

/**
 * Calculates dynamic drawdown buffer, liquidation floor, and distance to breach.
 * 
 * @param {Array} trades - List of executed trades sorted chronologically
 * @param {Object} profile - Prop firm profile object
 * @param {number} [manualEquity=null] - Optional live current balance override
 * @param {string} [candidateDate=null] - Reference ISO date string (defaults to now)
 * @returns {Object} Comprehensive drawdown buffer metrics
 */
export function calculateDynamicDrawdownBuffer(trades = [], profile = PROP_FIRM_PRESETS.TOPSTEP_50K, manualEquity = null, candidateDate = null) {
  const startingBalance = profile.startingBalance || 50000;
  const maxTotalDrawdown = profile.maxTotalDrawdown || 2000;
  const maxDailyLoss = profile.maxDailyLoss || 1000;
  const drawdownType = profile.drawdownType || 'TRAILING_INTRADAY';
  const lockAtStarting = profile.lockAtStartingBalance || false;

  let currentBalance = startingBalance;
  let peakBalance = startingBalance;
  let peakUnrealized = startingBalance;
  let lowestIntradayPoint = startingBalance;
  
  // Track daily balances for daily loss calculations
  const dailyPnLMap = {};
  const targetDateStr = (candidateDate ? new Date(candidateDate) : new Date()).toISOString().slice(0, 10);

  // Group trades chronologically and calculate cumulative equity curves
  const sortedTrades = [...trades].sort((a, b) => new Date(a.entryDate || 0) - new Date(b.entryDate || 0));

  sortedTrades.forEach(t => {
    const netPnL = Number(t.netPnL) || 0;
    const dateStr = (t.entryDate || t.exitDate || '').slice(0, 10) || targetDateStr;

    if (!dailyPnLMap[dateStr]) {
      dailyPnLMap[dateStr] = 0;
    }
    dailyPnLMap[dateStr] += netPnL;

    currentBalance += netPnL;
    if (currentBalance > peakBalance) {
      peakBalance = currentBalance;
    }

    // If trade has MFE (Maximum Favorable Excursion) in dollars, track unrealized peak
    const mfeDollars = Number(t.mfeDollars) || (t.mfeR && t.plannedRiskDollars ? t.mfeR * t.plannedRiskDollars : (netPnL > 0 ? netPnL : 0));
    const tradePeak = currentBalance - netPnL + mfeDollars;
    if (tradePeak > peakUnrealized) {
      peakUnrealized = tradePeak;
    }

    if (currentBalance < lowestIntradayPoint) {
      lowestIntradayPoint = currentBalance;
    }
  });

  if (manualEquity !== null && !isNaN(manualEquity)) {
    currentBalance = Number(manualEquity);
    if (currentBalance > peakBalance) peakBalance = currentBalance;
    if (currentBalance > peakUnrealized) peakUnrealized = currentBalance;
  }

  // Determine effective peak for trailing drawdown
  const effectivePeak = drawdownType === 'TRAILING_INTRADAY' ? peakUnrealized : peakBalance;

  // Calculate Hard Total Liquidation Floor
  let totalLiquidationFloor;
  if (drawdownType === 'STATIC_BALANCE') {
    totalLiquidationFloor = startingBalance - maxTotalDrawdown;
  } else {
    // Trailing Drawdown
    totalLiquidationFloor = effectivePeak - maxTotalDrawdown;
    if (lockAtStarting && totalLiquidationFloor > startingBalance) {
      totalLiquidationFloor = startingBalance + 100; // Locked at starting balance + buffer
    }
  }

  const remainingTotalBufferDollars = Math.round((currentBalance - totalLiquidationFloor) * 100) / 100;
  
  // Calculate Daily Loss Liquidation Floor for today
  const todayPnL = Math.round((dailyPnLMap[targetDateStr] || 0) * 100) / 100;
  let remainingDailyBufferDollars = null;
  let dailyLiquidationFloor = null;

  if (maxDailyLoss) {
    // Starting balance today = current balance - today's PnL
    const dayStartBalance = currentBalance - todayPnL;
    dailyLiquidationFloor = dayStartBalance - maxDailyLoss;
    remainingDailyBufferDollars = Math.round((maxDailyLoss + todayPnL) * 100) / 100;
    if (remainingDailyBufferDollars < 0) remainingDailyBufferDollars = 0;
  }

  // Active Cushion: The most restrictive of total buffer vs daily buffer
  const effectiveImmediateCushionDollars = remainingDailyBufferDollars !== null
    ? Math.min(remainingTotalBufferDollars, remainingDailyBufferDollars)
    : remainingTotalBufferDollars;

  // Assume standard 1R risk baseline = 1% of starting balance or $100
  const baselineRiskR = profile.startingBalance ? profile.startingBalance * 0.01 : 100;
  const remainingTotalBufferR = Math.round((remainingTotalBufferDollars / baselineRiskR) * 10) / 10;
  const remainingDailyBufferR = remainingDailyBufferDollars !== null
    ? Math.round((remainingDailyBufferDollars / baselineRiskR) * 10) / 10
    : null;
  const effectiveCushionR = Math.round((effectiveImmediateCushionDollars / baselineRiskR) * 10) / 10;

  // Breach Evaluation
  const isTotalBreached = remainingTotalBufferDollars <= 0;
  const isDailyBreached = remainingDailyBufferDollars !== null && remainingDailyBufferDollars <= 0;
  const isBreached = isTotalBreached || isDailyBreached;

  let bufferStatus = 'HEALTHY';
  if (isBreached) {
    bufferStatus = 'BREACHED';
  } else if (effectiveImmediateCushionDollars < baselineRiskR * 1.5) {
    bufferStatus = 'CRITICAL';
  } else if (effectiveImmediateCushionDollars < baselineRiskR * 3.0) {
    bufferStatus = 'CAUTION';
  }

  // Target Progress
  const totalNetProfit = Math.round((currentBalance - startingBalance) * 100) / 100;
  const profitTarget = profile.profitTarget || 3000;
  const targetProgressPercent = Math.min(100, Math.max(0, Math.round((totalNetProfit / profitTarget) * 1000) / 10));

  return {
    startingBalance,
    currentBalance: Math.round(currentBalance * 100) / 100,
    peakBalance: Math.round(peakBalance * 100) / 100,
    peakUnrealized: Math.round(peakUnrealized * 100) / 100,
    effectivePeak: Math.round(effectivePeak * 100) / 100,
    totalLiquidationFloor: Math.round(totalLiquidationFloor * 100) / 100,
    dailyLiquidationFloor: dailyLiquidationFloor !== null ? Math.round(dailyLiquidationFloor * 100) / 100 : null,
    remainingTotalBufferDollars,
    remainingTotalBufferR,
    todayPnL,
    remainingDailyBufferDollars,
    remainingDailyBufferR,
    effectiveImmediateCushionDollars,
    effectiveCushionR,
    bufferStatus,
    isBreached,
    isTotalBreached,
    isDailyBreached,
    totalNetProfit,
    profitTarget,
    targetProgressPercent,
    drawdownType,
    baselineRiskR
  };
}

/**
 * Calculates reverse safe risk sizing (Runway Sizer).
 * Computes exact maximum dollars, contracts, and lots permitted right now
 * without breaching the daily or total drawdown limit, factoring in slippage margin.
 * 
 * @param {number} remainingBufferDollars - Available buffer dollars
 * @param {number} [plannedTradesCount=2] - Number of trades planned for remainder of session
 * @param {number} [safetyMarginPercent=25] - Slippage & commission buffer (25% safety haircut)
 * @returns {Object} Safe maximum risk recommendations
 */
export function calculateRunwaySafeRisk(remainingBufferDollars, plannedTradesCount = 2, safetyMarginPercent = 25) {
  if (remainingBufferDollars <= 0) {
    return {
      maxSafeRiskDollars: 0,
      safeRiskWithMarginDollars: 0,
      permittedTradesCount: 0,
      esContractsMax: 0,
      nqContractsMax: 0,
      forexStandardLotsMax: 0,
      status: 'LOCKOUT_REQUIRED',
      guidance: 'Drawdown buffer depleted. Stop trading immediately.'
    };
  }

  const trades = Math.max(1, plannedTradesCount);
  const haircutFactor = Math.max(0.1, 1 - (safetyMarginPercent / 100)); // Default 0.75
  
  // Raw max risk per trade if trades were split evenly
  const rawRiskPerTrade = remainingBufferDollars / trades;
  // Safe risk per trade with slippage & commission cushion
  const safeRiskWithMarginDollars = Math.round(rawRiskPerTrade * haircutFactor * 100) / 100;

  // Estimate contract/lot limits based on standard market tick values:
  // ES: 20 ticks stop ($12.50/pt * 5 pts = $250 risk per 1 contract)
  // NQ: 80 ticks stop ($5/pt * 20 pts = $400 risk per 1 contract)
  // Forex: 20 pips stop on EURUSD ($200 per 1 standard lot)
  const esContractsMax = Math.floor(safeRiskWithMarginDollars / 250);
  const nqContractsMax = Math.floor(safeRiskWithMarginDollars / 400);
  const forexStandardLotsMax = Math.round((safeRiskWithMarginDollars / 200) * 100) / 100;

  return {
    remainingBufferDollars,
    plannedTradesCount: trades,
    safetyMarginPercent,
    maxSafeRiskDollars: Math.round(rawRiskPerTrade * 100) / 100,
    safeRiskWithMarginDollars,
    esContractsMax,
    nqContractsMax,
    forexStandardLotsMax,
    status: safeRiskWithMarginDollars >= 50 ? 'SAFE_TO_TRADE' : 'REDUCED_SIZE_REQUIRED',
    guidance: safeRiskWithMarginDollars >= 50
      ? `Allocate up to $${safeRiskWithMarginDollars} per trade across your next ${trades} trades.`
      : `Buffer thin. Reduce to micro contracts (MES/MNQ) or wait for next session.`
  };
}

/**
 * Calculates consistency rule metrics and profit concentration.
 * Prevents account disqualification from outsized "lucky" single days.
 * 
 * @param {Array} trades - List of executed trades
 * @param {number} [ruleThresholdPercent=30] - Max allowed percentage on single best day (e.g. 30%, 40%, 50%)
 * @returns {Object} Consistency metrics and warnings
 */
export function calculateConsistencyMetrics(trades = [], ruleThresholdPercent = 30) {
  if (!ruleThresholdPercent || ruleThresholdPercent <= 0) {
    return {
      hasRule: false,
      consistencyScorePercent: 100,
      isCompliant: true,
      bestDayProfit: 0,
      bestDayDate: null,
      totalProfits: 0,
      concentrationRatioPercent: 0,
      guidance: 'No consistency rule enforced for this profile.'
    };
  }

  // Aggregate daily PnL
  const dailyPnL = {};
  trades.forEach(t => {
    const pnl = Number(t.netPnL) || 0;
    const dateStr = (t.entryDate || t.exitDate || '').slice(0, 10);
    if (!dateStr) return;
    if (!dailyPnL[dateStr]) dailyPnL[dateStr] = 0;
    dailyPnL[dateStr] += pnl;
  });

  const dayDates = Object.keys(dailyPnL);
  let bestDayProfit = 0;
  let bestDayDate = null;
  let totalProfits = 0;

  dayDates.forEach(d => {
    const dayP = dailyPnL[d];
    if (dayP > 0) {
      totalProfits += dayP;
      if (dayP > bestDayProfit) {
        bestDayProfit = dayP;
        bestDayDate = d;
      }
    }
  });

  totalProfits = Math.round(totalProfits * 100) / 100;
  bestDayProfit = Math.round(bestDayProfit * 100) / 100;

  // Concentration ratio = bestDayProfit / totalProfits
  const concentrationRatioPercent = totalProfits > 0
    ? Math.round((bestDayProfit / totalProfits) * 1000) / 10
    : 0;

  const isCompliant = concentrationRatioPercent <= ruleThresholdPercent;
  const isNearLimit = concentrationRatioPercent >= (ruleThresholdPercent - 5) && isCompliant;

  // Calculate maximum additional profit allowed today before hitting the threshold
  // (bestDayProfit + extra) / (totalProfits + extra) <= ruleThreshold
  // bestDayProfit + extra <= R * totalProfits + R * extra
  // extra * (1 - R) <= R * totalProfits - bestDayProfit
  let maxAdditionalProfitToday = null;
  const R = ruleThresholdPercent / 100;
  if (R < 1.0) {
    // If today is currently the best day:
    const remainingHeadroom = Math.round(((R * totalProfits - bestDayProfit) / (1 - R)) * 100) / 100;
    maxAdditionalProfitToday = remainingHeadroom > 0 ? remainingHeadroom : 0;
  }

  let guidance = 'Profit distribution is well balanced across trading days.';
  if (!isCompliant) {
    guidance = `Single-day profit concentration (${concentrationRatioPercent}%) exceeds the ${ruleThresholdPercent}% rule. You must accumulate profits across additional active trading days to dilute the ratio before requesting payout.`;
  } else if (isNearLimit) {
    guidance = `Caution: Single-day profit concentration (${concentrationRatioPercent}%) is nearing the ${ruleThresholdPercent}% cap. Consider locking in profits today to protect compliance.`;
  }

  return {
    hasRule: true,
    ruleThresholdPercent,
    concentrationRatioPercent,
    isCompliant,
    isNearLimit,
    bestDayProfit,
    bestDayDate,
    totalProfits,
    activeProfitableDaysCount: dayDates.filter(d => dailyPnL[d] > 0).length,
    totalActiveDaysCount: dayDates.length,
    maxAdditionalProfitToday,
    guidance
  };
}

/**
 * Audits full evaluation and payout readiness checklist.
 * 
 * @param {Array} trades - List of executed trades
 * @param {Object} profile - Prop firm profile
 * @returns {Object} Comprehensive evaluation audit & checklist
 */
export function auditPayoutEligibility(trades = [], profile = PROP_FIRM_PRESETS.TOPSTEP_50K) {
  const bufferMetrics = calculateDynamicDrawdownBuffer(trades, profile);
  const consistency = calculateConsistencyMetrics(trades, profile.consistencyRulePercent);

  // Calculate distinct trading days
  const activeDaysSet = new Set();
  trades.forEach(t => {
    const d = (t.entryDate || t.exitDate || '').slice(0, 10);
    if (d) activeDaysSet.add(d);
  });
  const activeDaysCount = activeDaysSet.size;
  const minDaysRequired = profile.minTradingDays || 1;

  // Criteria items
  const criteria = [
    {
      id: 'TARGET_MET',
      label: 'Profit Target Reached',
      target: `+$${profile.profitTarget.toLocaleString()}`,
      current: `+$${bufferMetrics.totalNetProfit.toLocaleString()}`,
      passed: bufferMetrics.totalNetProfit >= profile.profitTarget,
      critical: true
    },
    {
      id: 'MAX_DRAWDOWN_INTACT',
      label: 'Max Total Drawdown Preserved',
      target: `Liquidation Floor: $${bufferMetrics.totalLiquidationFloor.toLocaleString()}`,
      current: `Buffer: +$${bufferMetrics.remainingTotalBufferDollars.toLocaleString()} (${bufferMetrics.remainingTotalBufferR}R)`,
      passed: !bufferMetrics.isTotalBreached && bufferMetrics.remainingTotalBufferDollars > 0,
      critical: true
    },
    {
      id: 'DAILY_LOSS_INTACT',
      label: 'Daily Loss Limit Respected',
      target: profile.maxDailyLoss ? `Max Daily: -$${profile.maxDailyLoss.toLocaleString()}` : 'No Firm Limit',
      current: bufferMetrics.remainingDailyBufferDollars !== null ? `Daily Buffer: +$${bufferMetrics.remainingDailyBufferDollars.toLocaleString()}` : 'N/A',
      passed: !bufferMetrics.isDailyBreached,
      critical: true
    },
    {
      id: 'MIN_DAYS_MET',
      label: 'Minimum Active Trading Days',
      target: `${minDaysRequired} days`,
      current: `${activeDaysCount} days`,
      passed: activeDaysCount >= minDaysRequired,
      critical: false
    },
    {
      id: 'CONSISTENCY_COMPLIANT',
      label: `Consistency Rule (Max ${profile.consistencyRulePercent || 'N/A'}% Best Day)`,
      target: profile.consistencyRulePercent ? `≤ ${profile.consistencyRulePercent}%` : 'N/A',
      current: profile.consistencyRulePercent ? `${consistency.concentrationRatioPercent}% (Best: $${consistency.bestDayProfit})` : 'Exempt',
      passed: consistency.isCompliant,
      critical: Boolean(profile.consistencyRulePercent)
    }
  ];

  // Optional Funded Payout Buffer Cushion check
  if (profile.payoutMinBuffer > 0) {
    const profitAboveStarting = bufferMetrics.currentBalance - profile.startingBalance;
    criteria.push({
      id: 'PAYOUT_CUSHION',
      label: 'Minimum Payout Buffer Cushion',
      target: `+$${profile.payoutMinBuffer.toLocaleString()} above starting`,
      current: `+$${profitAboveStarting.toLocaleString()}`,
      passed: profitAboveStarting >= profile.payoutMinBuffer,
      critical: true
    });
  }

  const passedCount = criteria.filter(c => c.passed).length;
  const criticalFails = criteria.filter(c => c.critical && !c.passed);
  const readinessPercent = Math.round((passedCount / criteria.length) * 100);

  let overallStatus = 'IN_PROGRESS';
  if (bufferMetrics.isBreached) {
    overallStatus = 'ACCOUNT_BREACHED';
  } else if (criticalFails.length === 0 && passedCount === criteria.length) {
    overallStatus = 'READY_FOR_PAYOUT_OR_PASS';
  } else if (bufferMetrics.targetProgressPercent >= 90) {
    overallStatus = 'FINAL_MILE';
  }

  return {
    profileId: profile.id,
    profileName: profile.name,
    overallStatus,
    readinessPercent,
    passedCount,
    totalCriteria: criteria.length,
    activeDaysCount,
    minDaysRequired,
    criteria,
    bufferMetrics,
    consistency
  };
}
