import { isSampleTrade, getTradeCategory } from './trade-provenance.js';
import { generateTraderHistoryObservations } from './trader-review.js';

export function buildTradeSummaryReport(trades = [], options = {}) {
  const excludeSample = options.excludeSample !== false;
  let safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  if (excludeSample) {
    safeTrades = safeTrades.filter(trade => !isSampleTrade(trade));
  }
  const totalTrades = safeTrades.length;
  const winningTrades = safeTrades.filter((trade) => Number(trade.netPnL || 0) > 0).length;
  const violationCount = safeTrades.filter((trade) => Array.isArray(trade.violations) && trade.violations.length > 0).length;
  const netPnL = safeTrades.reduce((total, trade) => total + Number(trade.netPnL || 0), 0);
  const averageR = totalTrades === 0 ? 0 : safeTrades.reduce((total, trade) => total + Number(trade.rMultiple || 0), 0) / totalTrades;
  const winRate = totalTrades === 0 ? 0 : Math.round((winningTrades / totalTrades) * 100);

  const reviewReport = generateTraderHistoryObservations(safeTrades, options);

  return {
    totalTrades,
    winningTrades,
    winRate,
    netPnL: Number(netPnL.toFixed(2)),
    averageR: Number(averageR.toFixed(2)),
    violationCount,
    cleanTrades: totalTrades - violationCount,
    reviewReport,
    observations: reviewReport.observations,
    csv: buildTradeCsvExport(safeTrades, options)
  };
}

export function buildTradeCsvExport(trades = [], options = {}) {
  const excludeSample = options.excludeSample !== false;
  let safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  if (excludeSample) {
    safeTrades = safeTrades.filter(trade => !isSampleTrade(trade));
  }
  const header = 'symbol,netPnL,direction,assetClass,plannedRiskDollars,rMultiple,violations,id,source,executionMode,category';

  const rows = safeTrades.map((trade) => {
    const violations = Array.isArray(trade.violations) ? trade.violations.join('|') : '';
    const category = getTradeCategory(trade);
    return [
      trade.symbol || '',
      Number(trade.netPnL || 0).toFixed(2),
      trade.direction || '',
      trade.assetClass || '',
      Number(trade.plannedRiskDollars || 0).toFixed(2),
      Number(trade.rMultiple || 0).toFixed(2),
      violations,
      trade.id || '',
      trade.source || '',
      trade.executionMode || '',
      category
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
  });

  return [header, ...rows].join('\n');
}
