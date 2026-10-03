export function buildTradeSummaryReport(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const totalTrades = safeTrades.length;
  const winningTrades = safeTrades.filter((trade) => Number(trade.netPnL || 0) > 0).length;
  const violationCount = safeTrades.filter((trade) => Array.isArray(trade.violations) && trade.violations.length > 0).length;
  const netPnL = safeTrades.reduce((total, trade) => total + Number(trade.netPnL || 0), 0);
  const averageR = totalTrades === 0 ? 0 : safeTrades.reduce((total, trade) => total + Number(trade.rMultiple || 0), 0) / totalTrades;
  const winRate = totalTrades === 0 ? 0 : Math.round((winningTrades / totalTrades) * 100);

  return {
    totalTrades,
    winningTrades,
    winRate,
    netPnL: Number(netPnL.toFixed(2)),
    averageR: Number(averageR.toFixed(2)),
    violationCount,
    cleanTrades: totalTrades - violationCount,
    csv: buildTradeCsvExport(safeTrades)
  };
}

export function buildTradeCsvExport(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const header = 'symbol,netPnL,direction,assetClass,plannedRiskDollars,rMultiple,violations,id';

  const rows = safeTrades.map((trade) => {
    const violations = Array.isArray(trade.violations) ? trade.violations.join('|') : '';
    return [
      trade.symbol || '',
      Number(trade.netPnL || 0).toFixed(2),
      trade.direction || '',
      trade.assetClass || '',
      Number(trade.plannedRiskDollars || 0).toFixed(2),
      Number(trade.rMultiple || 0).toFixed(2),
      violations,
      trade.id || ''
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
  });

  return [header, ...rows].join('\n');
}
