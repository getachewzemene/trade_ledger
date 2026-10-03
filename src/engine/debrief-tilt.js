/**
 * Guided Debrief & Active Tilt Interceptor Engine
 * Converts post-trade reflections into structured behavioral scores and
 * enforces mandatory physical cool-down periods after losses.
 */

export const DEBRIEF_OPTIONS = {
  executionIntegrity: {
    FOLLOWED_PLAN: { text: 'Followed Plan Exactly', score: 100, violation: null },
    CHASED_EARLY: { text: 'Chased / Entered Early (FOMO)', score: 50, violation: 'CHASED_ENTRY' },
    HESITATED_LATE: { text: 'Hesitated / Entered Late', score: 60, violation: 'LATE_ENTRY' },
    IMPULSE_NO_SETUP: { text: 'Impulsive / No Defined Setup', score: 0, violation: 'UNQUALIFIED_SETUP' }
  },
  tradeManagement: {
    LEFT_UNTOUCHED: { text: 'Left Stop & Target Untouched', score: 100, violation: null },
    SCALED_CORRECTLY: { text: 'Managed / Scaled Per Plan', score: 100, violation: null },
    CLOSED_PREMATURELY: { text: 'Closed Winner Prematurely (Fear of Giving Back)', score: 50, violation: 'EARLY_EXIT' },
    MOVED_STOP_WIDER: { text: 'Moved Stop Loss Wider / Removed Stop', score: 0, violation: 'STOP_WIDENED' }
  },
  emotionalTemperature: {
    CALM_DETACHED: { text: 'Calm & Detached (1-2/5 Anxiety)', score: 100 },
    MODERATE_TENSION: { text: 'Moderate Tension (3/5 Anxiety)', score: 75 },
    HIGH_ANXIETY_GLUED: { text: 'High Anxiety / Glued to P&L (4-5/5)', score: 30 },
    ANGER_REVENGE: { text: 'Anger / Urge to Win Money Back', score: 0, violation: 'REVENGE_TRADE' }
  }
};

/**
 * Calculates a structured discipline score and letter grade for a trade.
 */
export function gradeTradeDebrief(debrief) {
  if (!debrief) {
    return {
      score: 100,
      grade: 'A',
      title: 'Plan Honored',
      color: '#1F5C3E',
      inferredViolations: []
    };
  }

  const optIntegrity = DEBRIEF_OPTIONS.executionIntegrity[debrief.executionIntegrity] || DEBRIEF_OPTIONS.executionIntegrity.FOLLOWED_PLAN;
  const optManagement = DEBRIEF_OPTIONS.tradeManagement[debrief.tradeManagement] || DEBRIEF_OPTIONS.tradeManagement.LEFT_UNTOUCHED;
  const optEmotion = DEBRIEF_OPTIONS.emotionalTemperature[debrief.emotionalTemperature] || DEBRIEF_OPTIONS.emotionalTemperature.CALM_DETACHED;

  // Weighted calculation: Execution (45%), Management (40%), Emotion (15%)
  const rawScore = (optIntegrity.score * 0.45) + (optManagement.score * 0.40) + (optEmotion.score * 0.15);
  const score = Math.round(rawScore);

  let grade = 'A';
  let title = 'Exemplary Discipline';
  let color = '#1F5C3E';

  if (score >= 90) {
    grade = 'A';
    title = 'Exemplary Discipline';
    color = '#1F5C3E';
  } else if (score >= 75) {
    grade = 'B';
    title = 'Acceptable Execution';
    color = '#2C5E43';
  } else if (score >= 55) {
    grade = 'C';
    title = 'Discipline Slippage';
    color = '#B57614';
  } else {
    grade = 'F';
    title = 'Severe Rule Breakdown';
    color = '#8F251E';
  }

  const inferredViolations = [];
  if (optIntegrity.violation) inferredViolations.push(optIntegrity.violation);
  if (optManagement.violation) inferredViolations.push(optManagement.violation);
  if (optEmotion.violation) inferredViolations.push(optEmotion.violation);

  return {
    score,
    grade,
    title,
    color,
    inferredViolations
  };
}

/**
 * Evaluates current tilt danger based on recent sequence of losses.
 */
export function evaluateTiltState(trades, cooldownMinutes = 30) {
  if (!trades || trades.length === 0) {
    return {
      tiltLevel: 'CALM',
      consecutiveLosses: 0,
      isCooldownRequired: false,
      recommendedMinutes: 0,
      resetPrompts: []
    };
  }

  const sorted = [...trades].sort((a, b) => new Date(b.exitDate || b.entryDate) - new Date(a.exitDate || a.entryDate));
  
  // Count consecutive losses from latest trade
  let consecutiveLosses = 0;
  for (const t of sorted) {
    if ((t.netPnL || 0) < 0) {
      consecutiveLosses++;
    } else {
      break;
    }
  }

  const latestTrade = sorted[0];
  const lastExitTime = new Date(latestTrade.exitDate || latestTrade.entryDate).getTime();
  const minutesSinceExit = (Date.now() - lastExitTime) / (1000 * 60);

  let tiltLevel = 'CALM';
  let recommendedMinutes = 0;
  let isCooldownRequired = false;
  const resetPrompts = [];

  if (consecutiveLosses === 1) {
    tiltLevel = 'ELEVATED';
    recommendedMinutes = 15;
    if (minutesSinceExit < 15) isCooldownRequired = true;
    resetPrompts.push('Step away from screens for 5 minutes. Drink a glass of water.');
    resetPrompts.push('Acknowledge: 1R loss is the routine cost of acquiring market data.');
    resetPrompts.push('Verify: Did you follow your entry rules, or did you guess?');
  } else if (consecutiveLosses === 2) {
    tiltLevel = 'HIGH';
    recommendedMinutes = 30;
    if (minutesSinceExit < 30) isCooldownRequired = true;
    resetPrompts.push('MANDATORY WALK-AWAY: Two consecutive losses significantly increase revenge probability.');
    resetPrompts.push('Leave the trading desk for at least 20 minutes.');
    resetPrompts.push('Review your trading contract before considering another position.');
  } else if (consecutiveLosses >= 3) {
    tiltLevel = 'CRITICAL';
    recommendedMinutes = 60;
    isCooldownRequired = true;
    resetPrompts.push('CIRCUIT BREAKER LOCKOUT: 3 consecutive losses detected.');
    resetPrompts.push('Shut down trading platform for the remainder of this session.');
    resetPrompts.push('Capital preservation is your sole objective right now.');
  }

  return {
    tiltLevel,
    consecutiveLosses,
    isCooldownRequired,
    recommendedMinutes,
    minutesRemaining: isCooldownRequired ? Math.max(0, Math.ceil(recommendedMinutes - minutesSinceExit)) : 0,
    resetPrompts
  };
}
