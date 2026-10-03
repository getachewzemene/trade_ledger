function normalizeAssetClass(assetClass) {
  if (!assetClass) return 'EQUITY';
  const value = String(assetClass).trim().toUpperCase();
  const allowed = ['EQUITY', 'FOREX', 'FUTURES', 'CRYPTO', 'COMMODITY'];
  return allowed.includes(value) ? value : value;
}

function normalizeDirection(direction) {
  const value = String(direction || '').trim().toUpperCase();
  const map = {
    BUY: 'LONG',
    BOT: 'LONG',
    LONG: 'LONG',
    SELL: 'SHORT',
    SHORT: 'SHORT',
    SLD: 'SHORT'
  };

  return map[value] || 'LONG';
}

export function normalizeTradePayload(trade = {}) {
  const normalized = { ...trade };

  if (typeof normalized.symbol === 'string') {
    normalized.symbol = normalized.symbol.trim().toUpperCase();
  }

  normalized.assetClass = normalizeAssetClass(normalized.assetClass || inferAssetClass(normalized.symbol));
  normalized.direction = normalizeDirection(normalized.direction);

  const numericFields = ['entryPrice', 'exitPrice', 'stopLoss', 'takeProfit', 'maePrice', 'mfePrice', 'quantity', 'plannedRiskDollars', 'fees', 'netPnL', 'rMultiple'];
  numericFields.forEach((field) => {
    if (normalized[field] === undefined || normalized[field] === null || normalized[field] === '') return;
    const parsed = Number(normalized[field]);
    normalized[field] = Number.isFinite(parsed) ? parsed : normalized[field];
  });

  if (!normalized.entryDate) {
    normalized.entryDate = new Date().toISOString();
  }

  if (normalized.exitPrice !== undefined && !normalized.exitDate) {
    normalized.exitDate = new Date().toISOString();
  }

  if (normalized.quantity !== undefined && normalized.quantity !== null && Number(normalized.quantity) > 0 && normalized.entryPrice !== undefined && normalized.stopLoss !== undefined && normalized.plannedRiskDollars === undefined) {
    const riskPerUnit = Math.abs(Number(normalized.entryPrice) - Number(normalized.stopLoss));
    normalized.plannedRiskDollars = Number((riskPerUnit * Number(normalized.quantity)).toFixed(2));
  }

  if (normalized.netPnL === undefined || normalized.netPnL === null) {
    if (Number.isFinite(Number(normalized.entryPrice)) && Number.isFinite(Number(normalized.exitPrice)) && Number.isFinite(Number(normalized.quantity))) {
      const directionMultiplier = normalized.direction === 'SHORT' ? -1 : 1;
      normalized.netPnL = ((Number(normalized.exitPrice) - Number(normalized.entryPrice)) * directionMultiplier * Number(normalized.quantity)) - (Number(normalized.fees) || 0);
    } else {
      normalized.netPnL = 0;
    }
  }

  if ((normalized.rMultiple === undefined || normalized.rMultiple === null) && Number(normalized.plannedRiskDollars) !== 0) {
    normalized.rMultiple = Number(((Number(normalized.netPnL) || 0) / (Number(normalized.plannedRiskDollars) || 1)).toFixed(2));
  }

  if (normalized.source === undefined) {
    normalized.source = 'MANUAL';
  }

  return normalized;
}

export function validateTradePayload(trade = {}) {
  const normalized = normalizeTradePayload(trade);
  const errors = [];

  if (!normalized.symbol || !/^[A-Z0-9]+$/.test(String(normalized.symbol))) {
    errors.push('Trade symbol is required.');
  }

  if (!['LONG', 'SHORT'].includes(normalized.direction)) {
    errors.push('Direction must be LONG or SHORT.');
  }

  if (!Number.isFinite(Number(normalized.entryPrice)) || Number(normalized.entryPrice) <= 0) {
    errors.push('Entry price must be a positive number.');
  }

  if (!Number.isFinite(Number(normalized.quantity)) || Number(normalized.quantity) <= 0) {
    errors.push('Quantity must be greater than zero.');
  }

  if (!Number.isFinite(Number(normalized.stopLoss)) || Number(normalized.stopLoss) <= 0) {
    errors.push('Stop loss is required for proper risk control.');
  }

  if (normalized.entryDate && Number.isNaN(new Date(normalized.entryDate).getTime())) {
    errors.push('Entry date is invalid.');
  }

  return {
    trade: normalized,
    valid: errors.length === 0,
    errors
  };
}

function inferAssetClass(symbol = '') {
  const id = String(symbol).trim().toUpperCase();
  if (!id) return 'EQUITY';
  if (['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'XAUUSD', 'XAGUSD'].includes(id)) return 'FOREX';
  if (['ES', 'NQ', 'RTY', 'YM', 'CL', 'GC', 'SI', 'NG', 'MES', 'MNQ'].includes(id)) return 'FUTURES';
  if (['BTCUSD', 'ETHUSD', 'SOLUSD', 'ADAUSD', 'XRPUSD'].includes(id)) return 'CRYPTO';
  return 'EQUITY';
}
