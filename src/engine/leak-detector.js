/**
 * Trading Leak Detector & Behavioral Heuristics Engine
 * Extended with Contract Breaches and Pre-Session Preparedness.
 */

export const LEAK_DEFINITIONS = {
  REVENGE_TRADE: {
    code: 'REVENGE_TRADE',
    title: 'Revenge Trade',
    description: 'Entering a new position within 20 minutes of a loss on the same symbol with escalated risk or size.',
    severity: 'CRITICAL',
    stamp: 'REVENGE STAMP'
  },
  STOP_WIDENED: {
    code: 'STOP_WIDENED',
    title: 'Moved Stop Loss Wider',
    description: 'Realized loss exceeded planned initial stop loss risk by more than 20%, indicating stop loss adjustment.',
    severity: 'HIGH',
    stamp: 'DISCIPLINE BREACH'
  },
  OVERSIZED_POSITION: {
    code: 'OVERSIZED_POSITION',
    title: 'Excessive Position Size',
    description: 'Risk budget exceeded the planned threshold (> 2.5% of current equity).',
    severity: 'HIGH',
    stamp: 'OVERSIZED RISK'
  },
  EARLY_EXIT: {
    code: 'EARLY_EXIT',
    title: 'Premature Profit Taking',
    description: 'Taking profits at less than 0.8R despite setup targeting >= 2.0R without market structure invalidation.',
    severity: 'MEDIUM',
    stamp: 'CUT WINNER'
  },
  NO_STOP_LOSS: {
    code: 'NO_STOP_LOSS',
    title: 'Uncapped Downside (No Stop)',
    description: 'Trade executed without a defined technical stop loss order.',
    severity: 'CRITICAL',
    stamp: 'UNPROTECTED'
  },
  UNPREPARED_SESSION: {
    code: 'UNPREPARED_SESSION',
    title: 'Unprepared Session',
    description: 'Trade executed without completing the mandatory daily pre-market preparation routine.',
    severity: 'MEDIUM',
    stamp: 'UNPREPARED'
  },
  CONTRACT_BREACH: {
    code: 'CONTRACT_BREACH',
    title: 'Trading Contract Breach',
    description: 'Trade violated personal trading oath parameters (e.g. daily trade cap, loss ceiling, cooldown).',
    severity: 'CRITICAL',
    stamp: 'CONTRACT BREACH'
  }
};

/**
 * Scans a trade sequence and attaches detected rule violations.
 */
export function analyzeTradeViolations(trades, accountBalance = 10000, maxRiskPercent = 2.0) {
  if (!trades || trades.length === 0) return [];

  // Sort chronologically
  const sorted = [...trades].sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
  const analyzed = [];

  for (let i = 0; i < sorted.length; i++) {
    const trade = { ...sorted[i], violations: [...(sorted[i].violations || [])] };
    const pnl = trade.netPnL || 0;
    const plannedRisk = trade.plannedRiskDollars || 0;
    const maxAllowedRisk = (accountBalance * maxRiskPercent) / 100;

    // 1. Check for NO STOP LOSS
    if (!trade.stopLoss || trade.stopLoss === 0) {
      if (!trade.violations.includes('NO_STOP_LOSS')) {
        trade.violations.push('NO_STOP_LOSS');
      }
    }

    // 2. Check for OVERSIZED POSITION
    if (plannedRisk > maxAllowedRisk * 1.2) {
      if (!trade.violations.includes('OVERSIZED_POSITION')) {
        trade.violations.push('OVERSIZED_POSITION');
      }
    }

    // 3. Check for STOP WIDENED (Loss exceeds 1.25R of initial planned risk)
    if (pnl < 0 && plannedRisk > 0 && Math.abs(pnl) > plannedRisk * 1.25) {
      if (!trade.violations.includes('STOP_WIDENED')) {
        trade.violations.push('STOP_WIDENED');
      }
    }

    // 4. Check for EARLY EXIT (Small win < 0.8R when TP was >= 2R)
    if (pnl > 0 && plannedRisk > 0) {
      const r = pnl / plannedRisk;
      if (r < 0.8 && trade.takeProfit && trade.entryPrice && trade.stopLoss) {
        const plannedDistance = Math.abs(trade.takeProfit - trade.entryPrice);
        const stopDistance = Math.abs(trade.entryPrice - trade.stopLoss);
        if (stopDistance > 0 && (plannedDistance / stopDistance) >= 2.0) {
          if (!trade.violations.includes('EARLY_EXIT')) {
            trade.violations.push('EARLY_EXIT');
          }
        }
      }
    }

    // 5. Check for REVENGE TRADE (Prior trade was a loss on same symbol within 20 mins)
    if (i > 0) {
      const prevTrade = sorted[i - 1];
      const prevPnL = prevTrade.netPnL || 0;
      const prevExitTime = new Date(prevTrade.exitDate || prevTrade.entryDate).getTime();
      const currEntryTime = new Date(trade.entryDate).getTime();
      const minutesApart = (currEntryTime - prevExitTime) / (1000 * 60);

      if (
        prevPnL < 0 &&
        minutesApart >= 0 &&
        minutesApart <= 20 &&
        prevTrade.symbol === trade.symbol
      ) {
        if (!trade.violations.includes('REVENGE_TRADE')) {
          trade.violations.push('REVENGE_TRADE');
        }
      }
    }

    // 6. Check for Pre-Session flag
    if (trade.preSessionCompleted === false) {
      if (!trade.violations.includes('UNPREPARED_SESSION')) {
        trade.violations.push('UNPREPARED_SESSION');
      }
    }

    analyzed.push(trade);
  }

  return analyzed;
}

/**
 * Calculates the overall dollar drain and behavioral score from detected leaks.
 */
export function calculateLeakDiagnostics(analyzedTrades) {
  let cleanTradeCount = 0;
  let violatedTradeCount = 0;
  let cleanPnL = 0;
  let violatedPnL = 0;
  let leakExcessLossDollars = 0;

  const violationStats = {};
  Object.keys(LEAK_DEFINITIONS).forEach(k => {
    violationStats[k] = { count: 0, totalLoss: 0, definition: LEAK_DEFINITIONS[k] };
  });

  analyzedTrades.forEach(trade => {
    const pnl = trade.netPnL || 0;
    const plannedRisk = trade.plannedRiskDollars || 100;
    const hasViolations = trade.violations && trade.violations.length > 0;

    if (!hasViolations) {
      cleanTradeCount++;
      cleanPnL += pnl;
    } else {
      violatedTradeCount++;
      violatedPnL += pnl;

      // Calculate excess loss attributable to discipline failure
      if (pnl < 0 && Math.abs(pnl) > plannedRisk) {
        leakExcessLossDollars += (Math.abs(pnl) - plannedRisk);
      } else if (pnl < 0 && (trade.violations.includes('REVENGE_TRADE') || trade.violations.includes('CONTRACT_BREACH'))) {
        leakExcessLossDollars += Math.abs(pnl);
      }

      trade.violations.forEach(v => {
        if (violationStats[v]) {
          violationStats[v].count++;
          if (pnl < 0) {
            violationStats[v].totalLoss += Math.abs(pnl);
          }
        }
      });
    }
  });

  const totalTrades = analyzedTrades.length;
  const disciplineScore = totalTrades > 0 ? Math.round((cleanTradeCount / totalTrades) * 100) : 100;

  return {
    totalTrades,
    cleanTradeCount,
    violatedTradeCount,
    disciplineScore,
    cleanPnL: Math.round(cleanPnL * 100) / 100,
    violatedPnL: Math.round(violatedPnL * 100) / 100,
    leakExcessLossDollars: Math.round(leakExcessLossDollars * 100) / 100,
    violationBreakdown: Object.values(violationStats).filter(s => s.count > 0)
  };
}
