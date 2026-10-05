/**
 * Structured End-of-Day (EOD) Review & Daily Journal Archive Engine
 * 
 * Philosophy:
 * - Deliberate close-of-day reflection to convert market experience into permanent wisdom.
 * - Measure execution discipline and emotional poise separately from P&L.
 * - Celebrate deliberate stand-downs (passing unqualified setups preserves capital).
 * - Generate exportable archival report cards formatted for classical paper journals.
 * - Keep historical observations empirical, specific, sample-sized, and NOT predictive.
 */

import { formatDateKey, classifySessionBlock, SESSION_BLOCKS } from './calendar-heatmap.js';
import { calculateWilsonConfidenceInterval } from './trader-review.js';
import { isSampleTrade } from './trade-provenance.js';

export const MARKET_REGIMES = Object.freeze({
  TRENDING_BULL: {
    id: 'TRENDING_BULL',
    label: 'Trending Bullish (Clean Higher Highs / Higher Lows)',
    shortLabel: 'TREND BULL',
    tag: 'BULL_TREND',
    color: '#1F5C3E'
  },
  TRENDING_BEAR: {
    id: 'TRENDING_BEAR',
    label: 'Trending Bearish (Clean Lower Highs / Lower Lows)',
    shortLabel: 'TREND BEAR',
    tag: 'BEAR_TREND',
    color: '#8A2016'
  },
  CONSOLIDATION_RANGE: {
    id: 'CONSOLIDATION_RANGE',
    label: 'Consolidation / Balanced Range (Mean-Reverting)',
    shortLabel: 'RANGE',
    tag: 'RANGE',
    color: '#4B5563'
  },
  HIGH_VOLATILITY_CHOP: {
    id: 'HIGH_VOLATILITY_CHOP',
    label: 'High Volatility / Erratic Chop (Whipsaws & Wide Spreads)',
    shortLabel: 'VOLATILE CHOP',
    tag: 'CHOP',
    color: '#B45309'
  },
  LOW_LIQUIDITY_DRIFT: {
    id: 'LOW_LIQUIDITY_DRIFT',
    label: 'Low Liquidity / Summer & Holiday Drift',
    shortLabel: 'LOW LIQUIDITY',
    tag: 'LOW_LIQ',
    color: '#6B7280'
  }
});

export const NEWS_CATALYSTS = Object.freeze({
  FOMC_RATE_DECISION: { id: 'FOMC_RATE_DECISION', label: 'FOMC / Federal Reserve Decision' },
  CPI_INFLATION: { id: 'CPI_INFLATION', label: 'CPI / PPI Inflation Release' },
  NFP_JOBS: { id: 'NFP_JOBS', label: 'NFP / Jobs Report' },
  EARNINGS_ANNOUNCEMENT: { id: 'EARNINGS_ANNOUNCEMENT', label: 'Key Mega-Cap Earnings' },
  CENTRAL_BANK_SPEECH: { id: 'CENTRAL_BANK_SPEECH', label: 'Central Bank Chair / Governor Speech' },
  GEOPOLITICAL_BREAKING: { id: 'GEOPOLITICAL_BREAKING', label: 'Breaking Geopolitical News' },
  NONE_TECHNICAL_ONLY: { id: 'NONE_TECHNICAL_ONLY', label: 'No High-Impact News (Clean Technicals)' }
});

export const EMOTIONAL_STATES = Object.freeze({
  CALM_CENTERED: {
    id: 'CALM_CENTERED',
    label: 'Calm & Centered (Completely Detached Execution)',
    score: 100,
    icon: '🧘'
  },
  ALERT_FLOW: {
    id: 'ALERT_FLOW',
    label: 'Alert & Focused (Disciplined Flow State)',
    score: 90,
    icon: '🎯'
  },
  MILD_ANXIETY_FOMO: {
    id: 'MILD_ANXIETY_FOMO',
    label: 'Mild Anxiety / Resisted Impulsive Urges',
    score: 70,
    icon: '⚡'
  },
  FRUSTRATED_CHOP: {
    id: 'FRUSTRATED_CHOP',
    label: 'Frustrated by Price Action (Felt Urge to Click)',
    score: 45,
    icon: '😤'
  },
  TILT_REVENGE: {
    id: 'TILT_REVENGE',
    label: 'Tilt / Anger / Broke Written Limits',
    score: 0,
    icon: '🔥'
  }
});

export const DISCIPLINE_RUBRIC_ITEMS = Object.freeze({
  followedDailyPlan: {
    id: 'followedDailyPlan',
    label: 'Only traded setups defined in written plan',
    weight: 25,
    penaltyViolation: 'UNQUALIFIED_SETUP'
  },
  respectedStops: {
    id: 'respectedStops',
    label: 'Left stop loss untouched (never widened or removed)',
    weight: 25,
    penaltyViolation: 'STOP_WIDENED'
  },
  respectedDailyLimits: {
    id: 'respectedDailyLimits',
    label: 'Stood down immediately when trade/loss cap hit',
    weight: 20,
    penaltyViolation: 'OVERTRADING'
  },
  resistedImpulseFOMO: {
    id: 'resistedImpulseFOMO',
    label: 'Refrained from chasing runaway candles or boredom trades',
    weight: 15,
    penaltyViolation: 'FOMO_CHASE'
  },
  acceptedRiskFully: {
    id: 'acceptedRiskFully',
    label: 'Accepted full risk prior to entry without outcome anxiety',
    weight: 15,
    penaltyViolation: 'RISK_ANXIETY'
  }
});

export const RULE_ADHERENCE_VERDICTS = Object.freeze({
  CLEAN_DISCIPLINE: {
    id: 'CLEAN_DISCIPLINE',
    label: 'Exemplary Discipline (Plan Honored)',
    stampClass: 'stamp-clean',
    sealText: 'DISCIPLINED EXECUTION ✓',
    description: 'All written rules and risk guardrails were observed with exemplary fidelity.'
  },
  MINOR_FRICTION: {
    id: 'MINOR_FRICTION',
    label: 'Minor Friction (Sub-Optimal, No Catastrophe)',
    stampClass: 'stamp-neutral',
    sealText: 'MINOR FRICTION NOTED ℹ️',
    description: 'Minor hesitation or slight rule friction, but core capital guardrails remained intact.'
  },
  RULE_BREACH: {
    id: 'RULE_BREACH',
    label: 'Rule Breach Audited (Limits or Oath Broken)',
    stampClass: 'stamp-danger',
    sealText: 'RULE BREACH AUDITED ⚠️',
    description: 'One or more written guardrails (stops, caps, impulse control) were breached.'
  },
  DELIBERATE_PASS_DAY: {
    id: 'DELIBERATE_PASS_DAY',
    label: 'Deliberate Pass Day (Patience Celebrated)',
    stampClass: 'stamp-clean',
    sealText: 'PATIENCE HONORED: $0 RISK 🛡️',
    description: 'Market lacked edge or setups did not form. Consciously stood down to preserve capital.'
  }
});

export const EOD_DISCLAIMER = Object.freeze({
  text: 'End-of-day reviews, discipline rubrics, and historical observations are empirical reflections on past process fidelity, not promises or predictions of future market returns.',
  isPrediction: false
});

/**
 * Synthesizes all journal activity for a given calendar date:
 * - Executed trades
 * - Pre-entry plans
 * - Missed setups & deliberate passes
 * - Session distribution
 * - Historical context comparisons
 * 
 * @param {string} dateKey - 'YYYY-MM-DD'
 * @param {Array} trades - All trade objects
 * @param {Array} plans - Pre-entry plan objects
 * @param {Array} missed - Missed setup objects
 * @param {Object} options - Options (excludeSample: boolean)
 */
export function synthesizeDailyTradingSummary(dateKey, trades = [], plans = [], missed = [], options = {}) {
  const normKey = formatDateKey(dateKey);
  const excludeSample = options.excludeSample !== false;

  let safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  if (excludeSample) {
    safeTrades = safeTrades.filter(t => !isSampleTrade(t));
  }

  // Filter items matching the dateKey
  const dayTrades = safeTrades.filter(t => {
    const tKey = formatDateKey(t.entryDate || t.date);
    return tKey === normKey;
  });

  const dayPlans = (Array.isArray(plans) ? plans.filter(Boolean) : []).filter(p => {
    const pKey = formatDateKey(p.plannedAt || p.createdAt || p.date);
    return pKey === normKey;
  });

  const dayMissed = (Array.isArray(missed) ? missed.filter(Boolean) : []).filter(m => {
    const mKey = formatDateKey(m.loggedAt || m.createdAt || m.date);
    return mKey === normKey;
  });

  // Calculate trade performance
  const totalTrades = dayTrades.length;
  let wins = 0;
  let losses = 0;
  let scratches = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalCommissions = 0;
  let netPnL = 0;
  let totalR = 0;
  let compliantTrades = 0;
  const violationRecords = [];

  dayTrades.forEach(t => {
    const pnl = Number(t.netPnL || 0);
    const comm = Number(t.commissions || t.fees || 0);
    const r = Number(t.rMultiple || 0);

    totalCommissions += comm;
    netPnL += pnl;
    totalR += r;

    if (pnl > 0.001) {
      wins++;
      grossProfit += pnl;
    } else if (pnl < -0.001) {
      losses++;
      grossLoss += Math.abs(pnl);
    } else {
      scratches++;
    }

    const hasViolations = Array.isArray(t.violations) && t.violations.length > 0;
    if (!hasViolations) {
      compliantTrades++;
    } else {
      violationRecords.push(...t.violations);
    }
  });

  const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
  const winRateCI = calculateWilsonConfidenceInterval(wins, totalTrades);
  const complianceRate = totalTrades > 0 ? Number(((compliantTrades / totalTrades) * 100).toFixed(1)) : 100;
  const complianceCI = calculateWilsonConfidenceInterval(compliantTrades, totalTrades);
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 999 : 0);
  const averageR = totalTrades > 0 ? Number((totalR / totalTrades).toFixed(2)) : 0;

  // Breakdown by session block
  const sessions = {
    LONDON: { id: 'LONDON', label: 'London Open', trades: 0, netPnL: 0, r: 0 },
    NEW_YORK_AM: { id: 'NEW_YORK_AM', label: 'New York AM', trades: 0, netPnL: 0, r: 0 },
    NEW_YORK_PM: { id: 'NEW_YORK_PM', label: 'New York PM', trades: 0, netPnL: 0, r: 0 },
    ASIAN: { id: 'ASIAN', label: 'Asian Session', trades: 0, netPnL: 0, r: 0 },
    OVERNIGHT: { id: 'OVERNIGHT', label: 'Overnight', trades: 0, netPnL: 0, r: 0 }
  };

  dayTrades.forEach(t => {
    const sess = classifySessionBlock(t);
    if (sessions[sess.id]) {
      sessions[sess.id].trades++;
      sessions[sess.id].netPnL = Number((sessions[sess.id].netPnL + Number(t.netPnL || 0)).toFixed(2));
      sessions[sess.id].r = Number((sessions[sess.id].r + Number(t.rMultiple || 0)).toFixed(2));
    }
  });

  // Pre-planning and missed setup counts
  const disciplineWins = dayMissed.filter(m => m.isDisciplineWin === true).length;

  // Generate historical comparison observations
  const observations = [];
  if (totalTrades > 0) {
    observations.push({
      id: 'daily-volume-obs',
      headline: `Logged ${totalTrades} Executions on ${normKey}`,
      text: `Realized net P&L totaled ${netPnL >= 0 ? '+' : ''}$${netPnL.toFixed(2)} (${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R) with ${winRate}% win rate across ${totalTrades} trades.`,
      sampleSize: totalTrades,
      isPrediction: false
    });

    if (violationRecords.length === 0) {
      observations.push({
        id: 'clean-execution-obs',
        headline: '100% Process Rule Adherence',
        text: `All ${totalTrades} executed trades conformed to written entry, stop, and sizing criteria without rule breaches.`,
        sampleSize: totalTrades,
        isPrediction: false
      });
    } else {
      observations.push({
        id: 'violation-friction-obs',
        headline: `${violationRecords.length} Rule Breaches Recorded`,
        text: `Violations noted: ${Array.from(new Set(violationRecords)).join(', ')}. Review root causes during post-session debrief.`,
        sampleSize: totalTrades,
        isPrediction: false
      });
    }
  } else if (dayMissed.length > 0) {
    observations.push({
      id: 'stand-down-patience-obs',
      headline: 'Capital Preserved Through Restraint',
      text: `Recorded 0 executions and ${dayMissed.length} deliberate stand-downs (${disciplineWins} discipline wins). Inactivity costs $0 in commission or slippage.`,
      sampleSize: dayMissed.length,
      isPrediction: false
    });
  }

  // Active status classification
  let status = 'NO_TRADES';
  if (totalTrades > 0) {
    if (netPnL > 0) status = 'PROFITABLE';
    else if (netPnL < 0) status = 'LOSS';
    else status = 'BREAKEVEN';
  } else if (dayMissed.length > 0) {
    status = 'REST_DISCIPLINE';
  }

  return {
    dateKey: normKey,
    hasActivity: totalTrades > 0 || dayPlans.length > 0 || dayMissed.length > 0,
    status,
    trades: dayTrades,
    plans: dayPlans,
    missed: dayMissed,
    performance: {
      totalTrades,
      wins,
      losses,
      scratches,
      winRate,
      winRateCI,
      netPnL: Number(netPnL.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      grossLoss: Number(grossLoss.toFixed(2)),
      profitFactor,
      totalCommissions: Number(totalCommissions.toFixed(2)),
      totalR: Number(totalR.toFixed(2)),
      averageR,
      compliantTrades,
      violationsCount: violationRecords.length,
      violations: Array.from(new Set(violationRecords)),
      complianceRate,
      complianceCI
    },
    sessions,
    planning: {
      plansCount: dayPlans.length,
      missedCount: dayMissed.length,
      disciplineWins
    },
    observations,
    disclaimer: EOD_DISCLAIMER.text,
    isPrediction: false
  };
}

/**
 * Evaluates, scores, and seals a structured End-of-Day Review.
 * 
 * @param {Object} rawReview - Trader input
 * @param {Object} dailySummary - Output from synthesizeDailyTradingSummary
 * @returns {Object} Complete normalized EOD Review object
 */
export function evaluateEODReview(rawReview = {}, dailySummary = null) {
  const dateKey = formatDateKey(rawReview.dateKey || new Date());
  const summary = dailySummary || synthesizeDailyTradingSummary(dateKey);

  // 1. Market Conditions
  const regimeId = rawReview.marketRegime && MARKET_REGIMES[rawReview.marketRegime]
    ? rawReview.marketRegime
    : 'CONSOLIDATION_RANGE';
  const regime = MARKET_REGIMES[regimeId];

  const rawCatalysts = Array.isArray(rawReview.catalysts) ? rawReview.catalysts : [rawReview.catalysts].filter(Boolean);
  const validCatalysts = rawCatalysts
    .map(c => NEWS_CATALYSTS[c] ? c : null)
    .filter(Boolean);
  if (validCatalysts.length === 0) {
    validCatalysts.push('NONE_TECHNICAL_ONLY');
  }

  const marketContextNotes = String(rawReview.marketContextNotes || '').trim();

  // 2. Emotional Debrief
  const emotionalId = rawReview.emotionalState && EMOTIONAL_STATES[rawReview.emotionalState]
    ? rawReview.emotionalState
    : 'CALM_CENTERED';
  const emotionalState = EMOTIONAL_STATES[emotionalId];

  const energyRating = Math.max(1, Math.min(5, Number(rawReview.energyRating) || 3));

  // 3. Discipline Rubric Evaluation
  const rawRubric = rawReview.rubric || {};
  const rubric = {
    followedDailyPlan: rawRubric.followedDailyPlan !== false,
    respectedStops: rawRubric.respectedStops !== false,
    respectedDailyLimits: rawRubric.respectedDailyLimits !== false,
    resistedImpulseFOMO: rawRubric.resistedImpulseFOMO !== false,
    acceptedRiskFully: rawRubric.acceptedRiskFully !== false
  };

  let processDisciplineScore = 0;
  Object.keys(DISCIPLINE_RUBRIC_ITEMS).forEach(itemKey => {
    const spec = DISCIPLINE_RUBRIC_ITEMS[itemKey];
    if (rubric[itemKey] === true) {
      processDisciplineScore += spec.weight;
    }
  });

  // Check if any ledger violations occurred
  const hasLedgerViolations = summary.performance.violationsCount > 0;
  if (hasLedgerViolations) {
    // Dock 15 points per unique violation up to 30 points
    processDisciplineScore = Math.max(0, processDisciplineScore - Math.min(30, summary.performance.violationsCount * 15));
  }

  // 4. Rule Adherence Verdict
  let verdictKey = 'CLEAN_DISCIPLINE';
  if (summary.performance.totalTrades === 0) {
    verdictKey = 'DELIBERATE_PASS_DAY';
    processDisciplineScore = 100; // Reward patience with top mark
  } else if (processDisciplineScore >= 90 && !hasLedgerViolations) {
    verdictKey = 'CLEAN_DISCIPLINE';
  } else if (processDisciplineScore >= 70 && !hasLedgerViolations) {
    verdictKey = 'MINOR_FRICTION';
  } else {
    verdictKey = 'RULE_BREACH';
  }
  const verdict = RULE_ADHERENCE_VERDICTS[verdictKey];

  // 5. Qualitative Reflections
  const reflections = {
    wellDone: String(rawReview.reflections?.wellDone || rawReview.wellDone || '').trim(),
    biggestFriction: String(rawReview.reflections?.biggestFriction || rawReview.biggestFriction || '').trim(),
    focusTomorrow: String(rawReview.reflections?.focusTomorrow || rawReview.focusTomorrow || '').trim()
  };

  const id = `eod-${dateKey}`;
  const reviewedAt = rawReview.reviewedAt || new Date().toISOString();

  return {
    id,
    dateKey,
    reviewedAt,
    marketRegime: regime.id,
    marketRegimeLabel: regime.label,
    marketRegimeTag: regime.tag,
    catalysts: validCatalysts,
    catalystLabels: validCatalysts.map(c => NEWS_CATALYSTS[c].label),
    marketContextNotes,
    emotionalState: emotionalState.id,
    emotionalStateLabel: emotionalState.label,
    emotionalStateScore: emotionalState.score,
    emotionalStateIcon: emotionalState.icon,
    energyRating,
    rubric,
    processDisciplineScore,
    ruleAdherenceVerdict: verdict.id,
    ruleAdherenceLabel: verdict.label,
    ruleAdherenceSeal: verdict.sealText,
    stampClass: verdict.stampClass,
    reflections,
    summarySnapshot: {
      totalTrades: summary.performance.totalTrades,
      wins: summary.performance.wins,
      losses: summary.performance.losses,
      winRate: summary.performance.winRate,
      netPnL: summary.performance.netPnL,
      totalR: summary.performance.totalR,
      totalCommissions: summary.performance.totalCommissions,
      complianceRate: summary.performance.complianceRate,
      violationsCount: summary.performance.violationsCount,
      violations: summary.performance.violations,
      plansCount: summary.planning.plansCount,
      missedCount: summary.planning.missedCount,
      disciplineWins: summary.planning.disciplineWins
    },
    isPrediction: false
  };
}

/**
 * Generates an exportable, Markdown-formatted Archival Daily Report Card.
 * Ready for clipboard copying, personal journal storage, or printing.
 * 
 * @param {Object} review - Evaluated EOD review
 * @param {Object} summary - Daily summary
 * @param {Object} options - Options
 * @returns {string} Formatted Markdown text
 */
export function generateExportableDailyReport(review, summary = null, options = {}) {
  if (!review) return '';
  const dateKey = review.dateKey;
  const s = summary || synthesizeDailyTradingSummary(dateKey);
  const p = review.summarySnapshot || s.performance;

  const pnlSign = p.netPnL >= 0 ? '+' : '';
  const rSign = p.totalR >= 0 ? '+' : '';
  const starIcons = '★'.repeat(review.energyRating || 3) + '☆'.repeat(5 - (review.energyRating || 3));

  const sessionRows = Object.values(s.sessions || {})
    .filter(sess => sess.trades > 0)
    .map(sess => `| ${sess.label} | ${sess.trades} | ${sess.netPnL >= 0 ? '+' : ''}$${sess.netPnL.toFixed(2)} | ${sess.r >= 0 ? '+' : ''}${sess.r.toFixed(2)}R |`)
    .join('\n');

  const md = `# Ledger & Wick — Archival Daily Journal Entry
**Date:** ${dateKey} | **Reviewed At:** ${review.reviewedAt ? review.reviewedAt.slice(0, 19).replace('T', ' ') : 'N/A'} UTC

---

### [ ${review.ruleAdherenceSeal || 'LEDGER & WICK ARCHIVE'} ]
**Discipline Verdict:** ${review.ruleAdherenceLabel}
**Process Discipline Score:** **${review.processDisciplineScore}%** | **Emotional Energy:** ${starIcons} (${review.energyRating}/5)

---

### 1. Market Environment & Macro Catalysts
- **Regime:** ${review.marketRegimeLabel}
- **Catalysts:** ${review.catalystLabels ? review.catalystLabels.join(', ') : 'None'}
- **Emotional State:** ${review.emotionalStateIcon} ${review.emotionalStateLabel}
${review.marketContextNotes ? `- **Context:** _"${review.marketContextNotes}"_` : ''}

---

### 2. Daily Execution & Friction Synthesis
| Metric | Realized Value |
|:-------|:---------------|
| Total Trades Executed | **${p.totalTrades}** (${p.wins}W / ${p.losses}L / ${p.scratches || 0}S) |
| Win Rate | **${p.winRate}%** |
| Realized Net P&L | **${pnlSign}$${Number(p.netPnL).toFixed(2)}** |
| Total Realized R | **${rSign}${Number(p.totalR).toFixed(2)}R** |
| Friction Paid (Commissions/Fees) | **$${Number(p.totalCommissions || 0).toFixed(2)}** |
| Rule Compliance Rate | **${p.complianceRate}%** (${p.violationsCount} violations) |
| Pre-Entry Plans Logged | **${p.plansCount || 0}** |
| Deliberate Stand-Downs | **${p.missedCount || 0}** (${p.disciplineWins || 0} discipline wins) |

${sessionRows ? `\n#### Session Distribution\n| Session | Trades | Net P&L | Realized R |\n|:---|:---:|:---:|:---:|\n${sessionRows}\n` : ''}

---

### 3. Process Discipline Checklist
- [${review.rubric?.followedDailyPlan ? 'x' : ' '}] **Plan Fidelity:** Only traded setups defined in written plan (+25%)
- [${review.rubric?.respectedStops ? 'x' : ' '}] **Stop Respected:** Left stop loss untouched / never widened (+25%)
- [${review.rubric?.respectedDailyLimits ? 'x' : ' '}] **Limits Respected:** Stood down when trade or loss cap hit (+20%)
- [${review.rubric?.resistedImpulseFOMO ? 'x' : ' '}] **Impulse Restraint:** Refrained from FOMO or chasing (+15%)
- [${review.rubric?.acceptedRiskFully ? 'x' : ' '}] **Risk Acceptance:** Accepted full risk beforehand (+15%)

---

### 4. Qualitative Post-Session Reflections
- **What I Did Well:**
  ${review.reflections?.wellDone ? `> "${review.reflections.wellDone}"` : '_No notes recorded._'}

- **Friction, Impulses & Lessons:**
  ${review.reflections?.biggestFriction ? `> "${review.reflections.biggestFriction}"` : '_No friction recorded._'}

- **Behavioral Focus For Tomorrow:**
  ${review.reflections?.focusTomorrow ? `> "${review.reflections.focusTomorrow}"` : '_Maintain steady execution._'}

---
> *Epistemological Notice: Past process adherence and realized returns are historical records, not predictions of future market distributions.*
`;

  return md;
}

/**
 * Validates incoming EOD review submission payload.
 */
export function validateEODReviewPayload(payload = {}) {
  const errors = [];
  if (!payload.dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.dateKey).trim())) {
    errors.push('A valid dateKey in YYYY-MM-DD format is required.');
  }
  if (payload.marketRegime && !MARKET_REGIMES[payload.marketRegime]) {
    errors.push(`Unknown marketRegime "${payload.marketRegime}".`);
  }
  if (payload.emotionalState && !EMOTIONAL_STATES[payload.emotionalState]) {
    errors.push(`Unknown emotionalState "${payload.emotionalState}".`);
  }
  if (payload.energyRating !== undefined) {
    const er = Number(payload.energyRating);
    if (!Number.isInteger(er) || er < 1 || er > 5) {
      errors.push('energyRating must be an integer between 1 and 5.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
