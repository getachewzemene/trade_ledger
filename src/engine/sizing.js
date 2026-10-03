/**
 * Position Sizing Engine for Multi-Asset Trading
 */

// Futures contract specifications
export const FUTURES_SPECS = {
  ES: { name: 'E-mini S&P 500', tickSize: 0.25, tickValue: 12.50 },
  MES: { name: 'Micro E-mini S&P 500', tickSize: 0.25, tickValue: 1.25 },
  NQ: { name: 'E-mini Nasdaq 100', tickSize: 0.25, tickValue: 5.00 },
  MNQ: { name: 'Micro E-mini Nasdaq 100', tickSize: 0.25, tickValue: 0.50 },
  YM: { name: 'E-mini Dow', tickSize: 1.00, tickValue: 5.00 },
  MYM: { name: 'Micro E-mini Dow', tickSize: 1.00, tickValue: 0.50 },
  CL: { name: 'Crude Oil', tickSize: 0.01, tickValue: 10.00 },
  MCL: { name: 'Micro WTI Crude Oil', tickSize: 0.01, tickValue: 1.00 },
  GC: { name: 'Gold', tickSize: 0.10, tickValue: 10.00 },
  MGC: { name: 'Micro Gold', tickSize: 0.10, tickValue: 1.00 }
};

/**
 * Calculates risk budget in dollars based on account balance and risk percentage.
 */
export function calculateRiskBudget(accountBalance, riskPercentage) {
  if (accountBalance <= 0 || riskPercentage <= 0) return 0;
  return accountBalance * (riskPercentage / 100);
}

/**
 * Calculates position size for Equities & Crypto.
 */
export function calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget, quantityStep = 1) {
  const distance = Math.abs(entryPrice - stopLoss);
  if (distance === 0 || riskBudget <= 0 || quantityStep <= 0) {
    return { quantity: 0, distance: 0, positionValue: 0, riskBudget };
  }
  const rawUnits = riskBudget / distance;
  const units = Math.floor((rawUnits + Number.EPSILON) / quantityStep) * quantityStep;
  return {
    quantity: units,
    distance,
    positionValue: units * entryPrice,
    estimatedRisk: units * distance,
    riskBudget
  };
}

/**
 * Calculates position size for Forex.
 * Standard lot = 100,000 units. Pip is 0.0001 (or 0.01 for JPY pairs).
 * pipValuePerLot defaults to $10 for USD quote pairs (e.g., EUR/USD, GBP/USD).
 */
export function calculateForexSize(symbol, entryPrice, stopLoss, riskBudget, customPipValuePerLot = null, lotStep = 0.01) {
  const normalizedSymbol = String(symbol || '').toUpperCase().replace(/[^A-Z]/g, '');
  const isJpyQuote = normalizedSymbol.endsWith('JPY');
  const pipSize = isJpyQuote ? 0.01 : 0.0001;
  const distance = Math.abs(entryPrice - stopLoss);
  const pips = distance / pipSize;

  if (pips === 0 || riskBudget <= 0 || lotStep <= 0) {
    return { lots: 0, pips: 0, pipValuePerLot: 0, riskBudget, estimatedRisk: 0, supported: false, reason: 'Enter a valid stop distance, risk budget, and lot step.' };
  }

  let pipValuePerLot = customPipValuePerLot;
  if (!pipValuePerLot) {
    if (normalizedSymbol.endsWith('USD')) {
      pipValuePerLot = 10.0;
    } else if (normalizedSymbol.startsWith('USD') && isJpyQuote) {
      pipValuePerLot = 1000 / entryPrice;
    } else {
      return {
        lots: 0,
        pips: Math.round(pips * 10) / 10,
        pipValuePerLot: 0,
        riskBudget,
        estimatedRisk: 0,
        supported: false,
        reason: 'Enter the broker-provided USD pip value per standard lot for this cross pair.'
      };
    }
  }

  if (!Number.isFinite(Number(pipValuePerLot)) || Number(pipValuePerLot) <= 0) {
    return { lots: 0, pips: Math.round(pips * 10) / 10, pipValuePerLot: 0, riskBudget, estimatedRisk: 0, supported: false, reason: 'Pip value must be a positive number.' };
  }

  const roundedPips = Math.round(pips * 1000) / 1000;
  const rawLots = riskBudget / (roundedPips * pipValuePerLot);
  const lots = Number((Math.floor((rawLots + 1e-6) / lotStep) * lotStep).toFixed(4));

  return {
    lots,
    pips: Math.round(pips * 10) / 10,
    pipValuePerLot: Number(pipValuePerLot),
    estimatedRisk: lots * pips * Number(pipValuePerLot),
    riskBudget,
    supported: true,
    reason: lots === 0 ? 'The risk budget is below the minimum supported lot increment; reduce stop distance or skip.' : null
  };
}

/**
 * Calculates position size for Futures.
 */
export function calculateFuturesSize(symbolRoot, entryPrice, stopLoss, riskBudget) {
  const root = symbolRoot.toUpperCase().replace(/[^A-Z]/g, '');
  const spec = FUTURES_SPECS[root];
  if (!spec) {
    return { contracts: 0, ticks: 0, riskPerContract: 0, spec: null, riskBudget, supported: false, reason: `No verified contract specification for ${root || 'this symbol'}. Add the exchange tick size and tick value before sizing.` };
  }
  
  const distance = Math.abs(entryPrice - stopLoss);
  const ticks = distance / spec.tickSize;
  
  if (ticks === 0 || riskBudget <= 0) {
    return { contracts: 0, ticks: 0, riskPerContract: 0, spec, riskBudget, supported: false, reason: 'Enter a valid stop distance and risk budget.' };
  }

  const riskPerContract = ticks * spec.tickValue;
  const contracts = Math.floor(riskBudget / riskPerContract);

  return {
    contracts: Math.max(0, contracts),
    ticks: Math.round(ticks),
    riskPerContract,
    estimatedRisk: Math.max(0, contracts) * riskPerContract,
    spec,
    riskBudget,
    supported: contracts > 0,
    reason: contracts === 0 ? 'One contract exceeds the risk budget; skip or use a verified micro contract.' : null
  };
}

export function calculateLinearInstrumentSize(entryPrice, stopLoss, riskBudget, valuePerPriceUnit, sizeStep = 0.01) {
  const distance = Math.abs(entryPrice - stopLoss);
  const pointValue = Number(valuePerPriceUnit);
  if (distance <= 0 || riskBudget <= 0 || !Number.isFinite(pointValue) || pointValue <= 0 || sizeStep <= 0) {
    return { quantity: 0, distance, riskBudget, valuePerPriceUnit: Number.isFinite(pointValue) ? pointValue : 0, estimatedRisk: 0, supported: false, reason: 'Enter a positive broker-specific value per price unit and a valid stop/risk budget.' };
  }
  const rawQuantity = riskBudget / (distance * pointValue);
  const quantity = Math.floor((rawQuantity + Number.EPSILON) / sizeStep) * sizeStep;
  return {
    quantity,
    distance,
    valuePerPriceUnit: pointValue,
    estimatedRisk: quantity * distance * pointValue,
    riskBudget,
    supported: quantity > 0,
    reason: quantity > 0 ? null : 'The risk budget is below the minimum size increment; reduce stop distance or skip.'
  };
}

/**
 * Universal position sizing router.
 */
export function calculatePositionSize({
  assetClass,
  symbol,
  entryPrice,
  stopLoss,
  accountBalance,
  riskPercentage,
  customPipValuePerLot = null,
  valuePerPriceUnit = null,
  sizeStep = null
}) {
  const riskBudget = calculateRiskBudget(accountBalance, riskPercentage);

  switch (assetClass.toUpperCase()) {
    case 'EQUITY':
      return {
        assetClass,
        ...calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget)
      };
    case 'CRYPTO':
      return {
        assetClass,
        ...calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget, sizeStep || 0.000001)
      };
    case 'FOREX':
      return {
        assetClass,
        ...calculateForexSize(symbol, entryPrice, stopLoss, riskBudget, customPipValuePerLot, sizeStep || 0.01)
      };
    case 'FUTURES':
      return {
        assetClass,
        ...calculateFuturesSize(symbol, entryPrice, stopLoss, riskBudget)
      };
    case 'COMMODITY':
      return {
        assetClass,
        ...calculateLinearInstrumentSize(entryPrice, stopLoss, riskBudget, valuePerPriceUnit, sizeStep || 0.01)
      };
    default:
      return {
        assetClass,
        ...calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget)
      };
  }
}
