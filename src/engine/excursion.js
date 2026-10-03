/**
 * MAE (Maximum Adverse Excursion) & MFE (Maximum Favorable Excursion) Engine
 * Analyzes execution efficiency, stop placement tightness, and profit left on the table.
 */

/**
 * Calculates MAE and MFE in R-multiples for a given trade.
 */
export function calculateExcursionR(trade) {
  const entry = Number(trade.entryPrice) || 0;
  const stop = Number(trade.stopLoss) || 0;
  const maePrice = Number(trade.maePrice);
  const mfePrice = Number(trade.mfePrice);
  const direction = (trade.direction || 'LONG').toUpperCase();

  const stopDistance = Math.abs(entry - stop);
  if (stopDistance === 0 || entry === 0) {
    return { maeR: 0, mfeR: 0 };
  }

  let maeR = 0;
  let mfeR = 0;

  if (direction === 'LONG') {
    // For Long: MAE is how low price dipped below entry (adverse = lower)
    if (!isNaN(maePrice) && maePrice > 0) {
      const adverseDistance = Math.max(0, entry - maePrice);
      maeR = -(adverseDistance / stopDistance);
    }
    // For Long: MFE is how high price reached above entry (favorable = higher)
    if (!isNaN(mfePrice) && mfePrice > 0) {
      const favorableDistance = Math.max(0, mfePrice - entry);
      mfeR = favorableDistance / stopDistance;
    }
  } else {
    // For Short: MAE is how high price spiked above entry (adverse = higher)
    if (!isNaN(maePrice) && maePrice > 0) {
      const adverseDistance = Math.max(0, maePrice - entry);
      maeR = -(adverseDistance / stopDistance);
    }
    // For Short: MFE is how low price dropped below entry (favorable = lower)
    if (!isNaN(mfePrice) && mfePrice > 0) {
      const favorableDistance = Math.max(0, entry - mfePrice);
      mfeR = favorableDistance / stopDistance;
    }
  }

  return {
    maeR: Math.round(maeR * 100) / 100,
    mfeR: Math.round(mfeR * 100) / 100
  };
}

/**
 * Analyzes trade excursion patterns to produce actionable optimization diagnostics.
 */
export function analyzeExcursionPatterns(trades) {
  if (!trades || trades.length === 0) {
    return {
      tradesWithExcursion: 0,
      avgWinMaeR: 0,
      avgWinMfeR: 0,
      avgRealizedWinR: 0,
      avgProfitLeftOnTableR: 0,
      stopTighteningOpportunityPercent: 0,
      targetCaptureEfficiencyPercent: 0,
      insights: ['Log MAE (worst price) and MFE (best price) to unlock execution efficiency metrics.']
    };
  }

  let winCountWithExcursion = 0;
  let totalWinMaeR = 0;
  let totalWinMfeR = 0;
  let totalRealizedWinR = 0;
  let totalLossMaeR = 0;
  let lossCount = 0;

  trades.forEach(trade => {
    const { maeR, mfeR } = calculateExcursionR(trade);
    const realizedR = Number(trade.rMultiple) || 0;
    const hasData = trade.maePrice > 0 || trade.mfePrice > 0;

    if (hasData) {
      if (realizedR > 0) {
        winCountWithExcursion++;
        totalWinMaeR += Math.abs(maeR);
        totalWinMfeR += mfeR;
        totalRealizedWinR += realizedR;
      } else if (realizedR < 0) {
        lossCount++;
        totalLossMaeR += Math.abs(maeR);
      }
    }
  });

  const avgWinMaeR = winCountWithExcursion > 0 ? totalWinMaeR / winCountWithExcursion : 0;
  const avgWinMfeR = winCountWithExcursion > 0 ? totalWinMfeR / winCountWithExcursion : 0;
  const avgRealizedWinR = winCountWithExcursion > 0 ? totalRealizedWinR / winCountWithExcursion : 0;
  const avgProfitLeftOnTableR = Math.max(0, avgWinMfeR - avgRealizedWinR);

  // Target Capture Efficiency: realized R / peak potential MFE R
  const targetCaptureEfficiencyPercent = avgWinMfeR > 0
    ? Math.min(100, Math.round((avgRealizedWinR / avgWinMfeR) * 100))
    : 0;

  // Stop Tightening Opportunity: if winners rarely exceed -0.4R heat, stop could be tighter
  const stopTighteningOpportunityPercent = avgWinMaeR > 0 && avgWinMaeR < 0.7
    ? Math.round((1 - avgWinMaeR) * 50)
    : 0;

  const insights = [];
  if (winCountWithExcursion >= 2) {
    if (avgProfitLeftOnTableR > 0.8) {
      insights.push(
        `Leaving Profit on Table: Your winning trades peak at an average of +${avgWinMfeR.toFixed(2)}R, but you exit at +${avgRealizedWinR.toFixed(2)}R (leaving ~${avgProfitLeftOnTableR.toFixed(2)}R uncaptured). Consider implementing a trailing stop or scaling out in tranches.`
      );
    } else {
      insights.push(
        `High Target Efficiency: You are capturing ${targetCaptureEfficiencyPercent}% of peak favorable excursion on winning trades.`
      );
    }

    if (avgWinMaeR < 0.5) {
      insights.push(
        `Stop Loss Optimization: Winning setups rarely dipped past -${avgWinMaeR.toFixed(2)}R adverse excursion before moving to target. Your stops have room to be refined tighter.`
      );
    } else {
      insights.push(
        `Healthy Drawdown Tolerance: Winning trades experience an average heat of -${avgWinMaeR.toFixed(2)}R before expanding.`
      );
    }
  } else {
    insights.push('Log MAE and MFE on more trades to reveal statistical stop and target optimization curves.');
  }

  return {
    tradesWithExcursion: winCountWithExcursion + lossCount,
    avgWinMaeR: Math.round(avgWinMaeR * 100) / 100,
    avgWinMfeR: Math.round(avgWinMfeR * 100) / 100,
    avgRealizedWinR: Math.round(avgRealizedWinR * 100) / 100,
    avgProfitLeftOnTableR: Math.round(avgProfitLeftOnTableR * 100) / 100,
    stopTighteningOpportunityPercent,
    targetCaptureEfficiencyPercent,
    insights
  };
}
