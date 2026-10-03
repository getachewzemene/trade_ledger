/**
 * Personal Trading Contract ("The Trader's Oath") & Circuit Breaker Engine
 * Enforces hard psychological and capital preservation boundaries.
 */

export const DEFAULT_TRADING_CONTRACT = {
  maxDailyTrades: 3,
  maxDailyLossR: 2.0,            // Stop trading for the day if down 2.0R
  cooldownMinutes: 30,           // Mandatory pause after any losing trade
  enforcePreSession: true,       // Requires pre-session checklist before trading
  maxRiskPerTradePercent: 1.5,   // Hard risk ceiling
  ruleAgreementTimestamp: '2026-09-01T08:00:00Z'
};

/**
 * Checks if a candidate trade or the current trading session breaches the Trader's Oath.
 */
export function evaluateCircuitBreaker({
  trades = [],
  contract = DEFAULT_TRADING_CONTRACT,
  candidateTradeDate = new Date().toISOString(),
  preSessionLogs = []
}) {
  const targetDateStr = new Date(candidateTradeDate).toISOString().slice(0, 10);
  
  // 1. Filter trades executed on the same calendar day
  const todayTrades = trades.filter(t => {
    const tDateStr = new Date(t.entryDate).toISOString().slice(0, 10);
    return tDateStr === targetDateStr;
  });

  const breaches = [];

  // 2. Check Pre-Session Checklist Requirement
  if (contract.enforcePreSession) {
    const hasPreSession = preSessionLogs.some(log => {
      return log.date && log.date.slice(0, 10) === targetDateStr && log.completed;
    });
    if (!hasPreSession) {
      breaches.push({
        code: 'UNPREPARED_SESSION',
        name: 'Pre-Session Checklist Missing',
        description: 'No morning preparation audit found for this trading day. The contract requires bias and news check prior to execution.',
        severity: 'WARNING'
      });
    }
  }

  // 3. Check Max Daily Trades Limit
  if (todayTrades.length >= contract.maxDailyTrades) {
    breaches.push({
      code: 'MAX_DAILY_TRADES_EXCEEDED',
      name: 'Daily Trade Cap Reached',
      description: `You have already executed ${todayTrades.length} trades today (Contract limit: ${contract.maxDailyTrades}). Further trades represent overtrading.`,
      severity: 'CRITICAL'
    });
  }

  // 4. Check Daily Loss Limit (in R)
  let todayLossR = 0;
  todayTrades.forEach(t => {
    const r = Number(t.rMultiple) || 0;
    if (r < 0) {
      todayLossR += Math.abs(r);
    }
  });

  if (todayLossR >= contract.maxDailyLossR) {
    breaches.push({
      code: 'MAX_DAILY_LOSS_EXCEEDED',
      name: 'Daily Loss Limit Reached',
      description: `Today's accumulated loss is -${todayLossR.toFixed(2)}R, exceeding your hard daily limit of -${contract.maxDailyLossR.toFixed(1)}R. Step away to protect capital.`,
      severity: 'CRITICAL'
    });
  }

  // 5. Check Cooldown Window After Loss
  if (todayTrades.length > 0 && contract.cooldownMinutes > 0) {
    const sortedToday = [...todayTrades].sort((a, b) => new Date(b.exitDate || b.entryDate) - new Date(a.exitDate || a.entryDate));
    const lastTrade = sortedToday[0];
    const lastPnL = Number(lastTrade.netPnL) || 0;

    if (lastPnL < 0) {
      const lastExitTime = new Date(lastTrade.exitDate || lastTrade.entryDate).getTime();
      const candidateTime = new Date(candidateTradeDate).getTime();
      const minutesSinceLoss = (candidateTime - lastExitTime) / (1000 * 60);

      if (minutesSinceLoss >= 0 && minutesSinceLoss < contract.cooldownMinutes) {
        const remainingCooldown = Math.ceil(contract.cooldownMinutes - minutesSinceLoss);
        breaches.push({
          code: 'COOLDOWN_ACTIVE',
          name: 'Mandatory Cooldown Active',
          description: `Contract requires a ${contract.cooldownMinutes}-minute pause after a loss. ${remainingCooldown} minute(s) remaining in cooldown window.`,
          severity: 'HIGH'
        });
      }
    }
  }

  const isTripped = breaches.some(b => b.severity === 'CRITICAL' || b.severity === 'HIGH');

  return {
    isTripped,
    canTrade: !isTripped,
    todayTradesCount: todayTrades.length,
    todayLossR: Math.round(todayLossR * 100) / 100,
    breaches
  };
}
