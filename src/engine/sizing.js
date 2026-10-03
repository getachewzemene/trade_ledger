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
export function calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget) {
  const distance = Math.abs(entryPrice - stopLoss);
  if (distance === 0 || riskBudget <= 0) {
    return { quantity: 0, distance: 0, positionValue: 0, riskBudget };
  }
  const units = Math.floor(riskBudget / distance);
  return {
    quantity: units,
    distance,
    positionValue: units * entryPrice,
    riskBudget
  };
}

/**
 * Calculates position size for Forex.
 * Standard lot = 100,000 units. Pip is 0.0001 (or 0.01 for JPY pairs).
 * pipValuePerLot defaults to $10 for USD quote pairs (e.g., EUR/USD, GBP/USD).
 */
export function calculateForexSize(symbol, entryPrice, stopLoss, riskBudget, customPipValuePerLot = null) {
  const isJpy = symbol.toUpperCase().includes('JPY');
  const pipSize = isJpy ? 0.01 : 0.0001;
  const distance = Math.abs(entryPrice - stopLoss);
  const pips = distance / pipSize;
  
  if (pips === 0 || riskBudget <= 0) {
    return { lots: 0, pips: 0, pipValuePerLot: 10, riskBudget };
  }

  let pipValuePerLot = customPipValuePerLot;
  if (!pipValuePerLot) {
    if (symbol.toUpperCase().endsWith('USD')) {
      pipValuePerLot = 10.0; // Standard $10/pip on 1.0 lot
    } else if (isJpy) {
      // Approximate for USD/JPY: 1000 JPY / entryPrice
      pipValuePerLot = (1000 / entryPrice);
    } else {
      pipValuePerLot = 10.0;
    }
  }

  const rawLots = riskBudget / (pips * pipValuePerLot);
  // Round to 2 decimal places (micro-lot precision: 0.01)
  const lots = Math.max(0.01, Math.round(rawLots * 100) / 100);

  return {
    lots,
    pips: Math.round(pips * 10) / 10,
    pipValuePerLot,
    riskBudget
  };
}

/**
 * Calculates position size for Futures.
 */
export function calculateFuturesSize(symbolRoot, entryPrice, stopLoss, riskBudget) {
  const root = symbolRoot.toUpperCase().replace(/[^A-Z]/g, '');
  const spec = FUTURES_SPECS[root] || { name: 'Generic Futures', tickSize: 0.25, tickValue: 12.50 };
  
  const distance = Math.abs(entryPrice - stopLoss);
  const ticks = distance / spec.tickSize;
  
  if (ticks === 0 || riskBudget <= 0) {
    return { contracts: 0, ticks: 0, riskPerContract: 0, spec, riskBudget };
  }

  const riskPerContract = ticks * spec.tickValue;
  const contracts = Math.floor(riskBudget / riskPerContract);

  return {
    contracts: Math.max(0, contracts),
    ticks: Math.round(ticks),
    riskPerContract,
    spec,
    riskBudget
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
  riskPercentage
}) {
  const riskBudget = calculateRiskBudget(accountBalance, riskPercentage);

  switch (assetClass.toUpperCase()) {
    case 'EQUITY':
    case 'CRYPTO':
      return {
        assetClass,
        ...calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget)
      };
    case 'FOREX':
      return {
        assetClass,
        ...calculateForexSize(symbol, entryPrice, stopLoss, riskBudget)
      };
    case 'FUTURES':
      return {
        assetClass,
        ...calculateFuturesSize(symbol, entryPrice, stopLoss, riskBudget)
      };
    default:
      return {
        assetClass,
        ...calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget)
      };
  }
}
