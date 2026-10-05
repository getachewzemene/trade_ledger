/**
 * Deliberate Review-and-Pause & Pre-Entry Commitment Engine
 * 
 * Philosophy:
 * - Anti-impulsivity and friction-by-design to stop overtrading.
 * - Encourage recording the plan before entry (pre-commitment).
 * - Document missed setups without FOMO and rule violations with root cause analysis.
 * - Enforce stopping when personal limits (trade cap, loss cap, cooldown) are reached.
 * - Zero gamification or pressure to trade more.
 */

import { calculateWilsonConfidenceInterval } from './trader-review.js';

export const DELIBERATE_PAUSE_PRINCIPLES = Object.freeze({
  aim: 'Reduce impulsive decisions, eliminate overtrading, and pace execution down; zero gamification or pressure to trade more.',
  goldenRules: [
    'Pre-commit to entry, stop, and target before pulling the trigger.',
    'Passing an unqualified setup costs $0 and preserves mental capital.',
    'When personal limits are reached, the session is complete. Walk away immediately.',
    'Quality of execution over quantity of trades.'
  ]
});

export const STAND_DOWN_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  PACING_PAUSE: 'PACING_PAUSE',
  COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
  LIMIT_REACHED_STAND_DOWN: 'LIMIT_REACHED_STAND_DOWN',
  CIRCUIT_BREAKER_LOCKED: 'CIRCUIT_BREAKER_LOCKED'
});

export const MISSED_SETUP_REASONS = Object.freeze({
  INTENTIONAL_LIMIT_STAND_DOWN: {
    code: 'INTENTIONAL_LIMIT_STAND_DOWN',
    label: 'Intentional Stand-Down (Personal Limits Reached)',
    isDisciplineWin: true,
    description: 'Passed because daily trade or loss cap was already reached. Respected session finish.'
  },
  CHASED_RUNAWAY_DID_NOT_CHASE: {
    code: 'CHASED_RUNAWAY_DID_NOT_CHASE',
    label: 'Resisted Chasing (Price Ran Away Without Entry)',
    isDisciplineWin: true,
    description: 'Price moved without clean trigger; consciously refrained from chasing at poor risk/reward.'
  },
  OFF_PLAN_FILTER: {
    code: 'OFF_PLAN_FILTER',
    label: 'Passed Unqualified Setup (Lacked Confluence)',
    isDisciplineWin: true,
    description: 'Setup lacked required confluence or violated playbook criteria.'
  },
  SPREAD_SLIPPAGE_TOO_HIGH: {
    code: 'SPREAD_SLIPPAGE_TOO_HIGH',
    label: 'Excessive Friction / Volatility Spread',
    isDisciplineWin: true,
    description: 'Execution spread or slippage was too wide to support acceptable R:R.'
  },
  HESITATED_FEAR: {
    code: 'HESITATED_FEAR',
    label: 'Hesitated / Fear of Losing',
    isDisciplineWin: false,
    description: 'Setup fully met written rules and trigger occurred, but hesitated due to outcome anxiety.'
  },
  NOT_AT_DESK: {
    code: 'NOT_AT_DESK',
    label: 'Away from Desk / Off-Hours Move',
    isDisciplineWin: false,
    description: 'Setup formed while away from the trading desk or during non-trading window.'
  }
});

export const VIOLATION_ROOT_CAUSES = Object.freeze({
  FOMO: 'Fear of Missing Out (Chased green candles / entered without trigger)',
  BOREDOM: 'Boredom / Seeking Action (Forced trade during slow consolidation)',
  REVENGE: 'Revenge / Urge to Win Money Back after a loss',
  GREED: 'Greed (Moved profit target further or failed to take planned profit)',
  FEAR_OF_LOSS: 'Fear of Loss (Moved stop wider or closed winner prematurely)',
  IMPATIENCE: 'Impatience (Front-ran signal before candle/bar close)'
});

/**
 * Validates a pre-entry trade plan before market execution.
 */
export function validatePreEntryPlan(plan = {}) {
  const errors = [];
  const symbol = String(plan.symbol || '').trim().toUpperCase();
  const direction = String(plan.direction || 'LONG').toUpperCase();
  const entryPrice = Number(plan.plannedEntryPrice);
  const stopLoss = Number(plan.plannedStopLoss);
  const takeProfit = Number(plan.plannedTakeProfit);
  const plannedRiskDollars = Number(plan.plannedRiskDollars);

  if (!symbol) errors.push('Symbol is required for pre-entry plan.');
  if (!['LONG', 'SHORT'].includes(direction)) errors.push('Direction must be LONG or SHORT.');
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) errors.push('Planned entry price must be greater than zero.');
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) errors.push('Planned stop loss is mandatory before entry.');

  // Validate price geometry
  if (entryPrice > 0 && stopLoss > 0) {
    if (direction === 'LONG' && stopLoss >= entryPrice) {
      errors.push('Long stop loss must be placed BELOW planned entry price.');
    }
    if (direction === 'SHORT' && stopLoss <= entryPrice) {
      errors.push('Short stop loss must be placed ABOVE planned entry price.');
    }
  }

  // Validate target geometry if provided
  if (entryPrice > 0 && takeProfit > 0) {
    if (direction === 'LONG' && takeProfit <= entryPrice) {
      errors.push('Long target price must be placed ABOVE planned entry price.');
    }
    if (direction === 'SHORT' && takeProfit >= entryPrice) {
      errors.push('Short target price must be placed BELOW planned entry price.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates and normalizes a pre-entry commitment record.
 */
export function createPreEntryPlan(rawPlan = {}) {
  const { valid, errors } = validatePreEntryPlan(rawPlan);
  if (!valid) {
    return { valid: false, errors, plan: null };
  }

  const symbol = String(rawPlan.symbol || '').trim().toUpperCase();
  const direction = String(rawPlan.direction || 'LONG').toUpperCase();
  const entryPrice = Number(rawPlan.plannedEntryPrice);
  const stopLoss = Number(rawPlan.plannedStopLoss);
  const takeProfit = Number(rawPlan.plannedTakeProfit) || null;
  const plannedRiskDollars = Number(rawPlan.plannedRiskDollars) || 100;
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const targetDistance = takeProfit ? Math.abs(takeProfit - entryPrice) : null;
  const plannedRR = (stopDistance > 0 && targetDistance) ? Number((targetDistance / stopDistance).toFixed(2)) : null;

  const plan = {
    id: rawPlan.id || `PLAN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    symbol,
    direction,
    setupId: String(rawPlan.setupId || 'DISCRETIONARY').toUpperCase(),
    plannedEntryPrice: entryPrice,
    plannedStopLoss: stopLoss,
    plannedTakeProfit: takeProfit,
    plannedRiskDollars,
    stopDistance: Number(stopDistance.toFixed(4)),
    plannedRR,
    thesis: String(rawPlan.thesis || '').trim(),
    confluenceFactors: Array.isArray(rawPlan.confluenceFactors) ? rawPlan.confluenceFactors : [],
    mentalCheck: {
      isCalm: Boolean(rawPlan.mentalCheck?.isCalm ?? true),
      waitedForSetup: Boolean(rawPlan.mentalCheck?.waitedForSetup ?? true),
      acceptsRisk: Boolean(rawPlan.mentalCheck?.acceptsRisk ?? true)
    },
    preCommitmentConfirmed: Boolean(rawPlan.preCommitmentConfirmed ?? true),
    status: 'PENDING', // PENDING, EXECUTED, CANCELLED
    createdAt: rawPlan.createdAt || new Date().toISOString()
  };

  return { valid: true, errors: [], plan };
}

/**
 * Links an executed trade to its pre-entry commitment plan.
 */
export function linkPlanToExecutedTrade(plan, trade) {
  if (!plan || !trade) return trade;
  const actualEntry = Number(trade.entryPrice) || Number(plan.plannedEntryPrice);
  const plannedEntry = Number(plan.plannedEntryPrice) || actualEntry;
  const entrySlippage = Number((actualEntry - plannedEntry).toFixed(4));

  return {
    ...trade,
    planId: plan.id,
    wasPrePlanned: true,
    plannedRR: plan.plannedRR,
    plannedEntryPrice: plannedEntry,
    entrySlippage,
    planThesis: plan.thesis,
    confluenceFactors: plan.confluenceFactors
  };
}

/**
 * Normalizes and stores a missed setup / passed opportunity record.
 */
export function createMissedSetup(rawMissed = {}) {
  const symbol = String(rawMissed.symbol || '').trim().toUpperCase();
  const reasonCode = String(rawMissed.reasonCode || 'INTENTIONAL_LIMIT_STAND_DOWN').toUpperCase();
  const reasonDef = MISSED_SETUP_REASONS[reasonCode] || MISSED_SETUP_REASONS.INTENTIONAL_LIMIT_STAND_DOWN;

  const record = {
    id: rawMissed.id || `MISSED-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    symbol: symbol || 'GENERAL',
    setupId: String(rawMissed.setupId || 'PLAYBOOK_SETUP').toUpperCase(),
    direction: String(rawMissed.direction || 'LONG').toUpperCase(),
    date: rawMissed.date || new Date().toISOString(),
    reasonCode: reasonDef.code,
    reasonLabel: reasonDef.label,
    isDisciplineWin: reasonDef.isDisciplineWin,
    hypotheticalR: Number(rawMissed.hypotheticalR) || 0,
    reflection: String(rawMissed.reflection || '').trim(),
    createdAt: new Date().toISOString()
  };

  return record;
}

/**
 * Analyzes documented missed setups to encourage restraint and cure FOMO.
 */
export function analyzeMissedSetups(missedSetups = []) {
  const safeList = Array.isArray(missedSetups) ? missedSetups.filter(Boolean) : [];
  const total = safeList.length;

  if (total === 0) {
    return {
      totalMissedCount: 0,
      disciplineWinsCount: 0,
      disciplineWinPercent: 0,
      hesitationsCount: 0,
      uncertainty: { formatted: '0.0% – 0.0%' },
      summaryObservation: 'No missed setups logged. Documenting passed setups removes FOMO and proves passing an unqualified move costs $0.',
      records: []
    };
  }

  const disciplineWins = safeList.filter(m => m.isDisciplineWin).length;
  const hesitations = total - disciplineWins;
  const wilson = calculateWilsonConfidenceInterval(disciplineWins, total);

  const summaryObservation = `You logged ${total} missed or passed setups. ${disciplineWins} (${wilson.percentage.toFixed(1)}% [95% CI: ${wilson.formatted}]) were deliberate restraint choices (resisting FOMO, passing off-plan moves, or respecting daily stand-down limits). Passing a setup costs $0.`;

  return {
    totalMissedCount: total,
    disciplineWinsCount: disciplineWins,
    disciplineWinPercent: wilson.percentage,
    hesitationsCount: hesitations,
    uncertainty: wilson,
    summaryObservation,
    records: safeList
  };
}

/**
 * Documents a post-trade rule violation with root cause analysis.
 */
export function documentRuleViolationRecord(trade = {}, violationData = {}) {
  const breachedRule = String(violationData.breachedRule || 'UNSPECIFIED_RULE').toUpperCase();
  const rootCause = String(violationData.rootCause || 'IMPULSE').toUpperCase();
  const rootCauseDescription = VIOLATION_ROOT_CAUSES[rootCause] || violationData.notes || 'Execution drift.';
  const notes = String(violationData.notes || '').trim();

  // Recommend a minimum deliberate reflection pause in minutes
  let recommendedPauseMinutes = 20;
  if (['REVENGE', 'STOP_WIDENED', 'OVERSIZED_POSITION'].includes(breachedRule) || rootCause === 'REVENGE') {
    recommendedPauseMinutes = 45;
  }

  return {
    id: `VIOLATION-${Date.now()}`,
    tradeId: trade.id || null,
    symbol: trade.symbol || 'UNKNOWN',
    breachedRule,
    rootCause,
    rootCauseDescription,
    notes,
    documentedAt: new Date().toISOString(),
    recommendedPauseMinutes,
    remediationAction: `Mandatory ${recommendedPauseMinutes}-minute deliberate pause. Step away from screens to break the emotional feedback loop.`
  };
}

/**
 * Master Session Evaluator for Deliberate Review-and-Pause & Stand-Down Limits
 * Strictly prevents overtrading and prompts deliberate pauses when limits are reached.
 */
export function evaluateSessionLimitsAndPause({
  trades = [],
  tradingPlan = {},
  contract = {},
  preSessionLogs = [],
  currentTime = new Date().toISOString(),
  minPacingMinutes = 15
} = {}) {
  const now = new Date(currentTime);
  const todayStr = now.toISOString().slice(0, 10);

  // Daily parameters from plan or contract
  const maxTrades = Number(tradingPlan.maxDailyTrades || contract.maxDailyTrades || 3);
  const maxLossR = Number(tradingPlan.maxDailyLossR || contract.maxDailyLossR || 2.0);
  const cooldownDuration = Number(contract.cooldownMinutes || 30);

  // Filter today's trades (ignoring sample data)
  const safeTrades = Array.isArray(trades) ? trades.filter(t => t && String(t.source || '').toUpperCase() !== 'SAMPLE') : [];
  const todayTrades = safeTrades.filter(t => {
    const dStr = String(t.entryDate || t.date || '').slice(0, 10);
    return dStr === todayStr;
  });

  const todayCount = todayTrades.length;
  let todayLossR = 0;
  todayTrades.forEach(t => {
    const r = Number(t.rMultiple) || 0;
    if (r < 0) todayLossR += Math.abs(r);
  });
  todayLossR = Number(todayLossR.toFixed(2));

  // Sort today's trades to check recency
  const sortedToday = [...todayTrades].sort((a, b) => new Date(b.exitDate || b.entryDate || 0) - new Date(a.exitDate || a.entryDate || 0));
  const latestTrade = sortedToday[0] || null;

  let minutesSinceLastTrade = Infinity;
  let isLastTradeLoss = false;
  if (latestTrade) {
    const lastTime = new Date(latestTrade.exitDate || latestTrade.entryDate || 0).getTime();
    if (!isNaN(lastTime)) {
      minutesSinceLastTrade = (now.getTime() - lastTime) / (1000 * 60);
    }
    isLastTradeLoss = (Number(latestTrade.netPnL) || Number(latestTrade.rMultiple) || 0) < 0;
  }

  // Consecutive losses
  let consecutiveLosses = 0;
  for (const t of sortedToday) {
    const pnl = Number(t.netPnL) || Number(t.rMultiple) || 0;
    if (pnl < 0) consecutiveLosses++;
    else break;
  }

  // Determine Stand-Down & Pause Status
  let standDownStatus = STAND_DOWN_STATUSES.OPEN;
  let headline = 'Session Active • Respect Limits';
  let message = `You have taken ${todayCount} of ${maxTrades} permitted trades today. Trade only when your high-conviction playbook setup appears.`;
  let bannerClass = 'stand-down-safe';
  let isTradingAllowed = true;
  let isDeliberatePauseActive = false;
  let remainingCooldownSeconds = 0;
  let pacingMinutesRemaining = 0;
  const standDownActionSteps = [];
  const reflectionPrompts = [];

  // Priority 1: Circuit breaker on 3 consecutive losses
  if (consecutiveLosses >= 3) {
    standDownStatus = STAND_DOWN_STATUSES.CIRCUIT_BREAKER_LOCKED;
    isTradingAllowed = false;
    isDeliberatePauseActive = true;
    headline = 'CIRCUIT BREAKER LOCKOUT: 3 Consecutive Losses';
    message = 'You have incurred 3 consecutive losses today. Cognitive bandwidth is impaired and revenge probability is severe. Terminal is locked.';
    bannerClass = 'stand-down-critical';
    standDownActionSteps.push('Shut down broker charts and execution terminal immediately.');
    standDownActionSteps.push('Acknowledge: 3 losses in a row is normal probabilistic variance if setups were valid, or severe tilt if impulsive.');
    standDownActionSteps.push('Do not attempt to win back capital today. Capital preservation is your sole objective.');
  }
  // Priority 2: Daily loss limit reached
  else if (todayLossR >= maxLossR) {
    standDownStatus = STAND_DOWN_STATUSES.LIMIT_REACHED_STAND_DOWN;
    isTradingAllowed = false;
    isDeliberatePauseActive = true;
    headline = 'DAILY LOSS CEILING REACHED (-' + todayLossR.toFixed(1) + 'R / -' + maxLossR.toFixed(1) + 'R limit)';
    message = `Today's accumulated drawdown is -${todayLossR.toFixed(2)}R, meeting or exceeding your -${maxLossR.toFixed(1)}R maximum daily loss. Your trading day is officially complete.`;
    bannerClass = 'stand-down-critical';
    standDownActionSteps.push('Walk away from the desk. The market cannot take any more money from you today unless you voluntarily give it.');
    standDownActionSteps.push('Complete your trade debriefs while the lessons are fresh.');
    standDownActionSteps.push('Remember: Walking away at your daily loss stop is an exemplary mark of professional discipline.');
  }
  // Priority 3: Daily trade cap reached
  else if (todayCount >= maxTrades) {
    standDownStatus = STAND_DOWN_STATUSES.LIMIT_REACHED_STAND_DOWN;
    isTradingAllowed = false;
    isDeliberatePauseActive = true;
    headline = `DAILY TRADE CAP REACHED (${todayCount}/${maxTrades} Trades Executed)`;
    message = `You have executed all ${maxTrades} permitted trades for today. Further trading introduces overtrading and decision fatigue.`;
    bannerClass = 'stand-down-critical';
    standDownActionSteps.push('Session is concluded. Close order entry tickets.');
    standDownActionSteps.push('Review today\'s executions against your written playbook.');
    standDownActionSteps.push('Rest mental capital for tomorrow\'s session.');
  }
  // Priority 4: Mandatory post-loss cooldown
  else if (isLastTradeLoss && minutesSinceLastTrade < cooldownDuration) {
    standDownStatus = STAND_DOWN_STATUSES.COOLDOWN_ACTIVE;
    isTradingAllowed = false;
    isDeliberatePauseActive = true;
    const remainingMins = Math.ceil(cooldownDuration - minutesSinceLastTrade);
    remainingCooldownSeconds = Math.max(0, Math.ceil((cooldownDuration - minutesSinceLastTrade) * 60));
    headline = `MANDATORY COOLDOWN ACTIVE (${remainingMins}m Remaining)`;
    message = `You recently closed a losing trade. The Trader's Oath enforces a ${cooldownDuration}-minute deliberate pause after any loss to reset emotional baseline and prevent revenge trades.`;
    bannerClass = 'stand-down-warning';
    standDownActionSteps.push(`Step away from screens for at least ${remainingMins} more minutes.`);
    standDownActionSteps.push('Drink water, breathe, and review your invalidation.');
    standDownActionSteps.push('Confirm that your loss was a routine cost of business, not an operational failure.');
  }
  // Priority 5: General post-trade pacing pause (friction against rapid-fire entries)
  else if (todayCount > 0 && minutesSinceLastTrade < minPacingMinutes) {
    standDownStatus = STAND_DOWN_STATUSES.PACING_PAUSE;
    isTradingAllowed = false;
    isDeliberatePauseActive = true;
    const remainingPacing = Math.ceil(minPacingMinutes - minutesSinceLastTrade);
    pacingMinutesRemaining = remainingPacing;
    headline = `DELIBERATE PACING PAUSE (${remainingPacing}m Remaining)`;
    message = `Professional trading requires deliberate pacing. Enforcing a ${minPacingMinutes}-minute cognitive reset between trades prevents impulsive rush.`;
    bannerClass = 'stand-down-warning';
    standDownActionSteps.push('Allow market structure to form naturally. Do not rush.');
    standDownActionSteps.push('Document your debrief notes for the trade just closed.');
  }

  // Reflection prompts for pacing and stand down
  reflectionPrompts.push('1. Is there a defined, confirmed setup on the chart, or am I searching for action?');
  reflectionPrompts.push('2. Have I documented my invalidation stop before committing capital?');
  reflectionPrompts.push('3. If this trade hits its stop loss, will I accept it calmly as a routine business cost?');

  return {
    standDownStatus,
    isTradingAllowed,
    isDeliberatePauseActive,
    headline,
    message,
    bannerClass,
    todayTradesCount: todayCount,
    maxDailyTrades: maxTrades,
    todayLossR,
    maxDailyLossR: maxLossR,
    consecutiveLosses,
    remainingCooldownSeconds,
    pacingMinutesRemaining,
    standDownActionSteps,
    reflectionPrompts,
    antiPressurePhilosophy: DELIBERATE_PAUSE_PRINCIPLES.aim,
    evaluatedAt: now.toISOString()
  };
}
