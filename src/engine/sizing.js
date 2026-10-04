/**
 * Position Sizing Engine for Multi-Asset Trading
 * Incorporates instrument specifications, execution friction (commissions, spread, slippage),
 * and hard guardrails with transparent risk explanations.
 */

import { DEFAULT_TRADING_CONTRACT } from './contract.js';
import { normalizeTradingPlan } from './trading-plan.js';

// Futures contract specifications
export const FUTURES_SPECS = {
  ES: { name: 'E-mini S&P 500', tickSize: 0.25, tickValue: 12.50, pointMultiplier: 50, defaultCommission: 4.50, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  MES: { name: 'Micro E-mini S&P 500', tickSize: 0.25, tickValue: 1.25, pointMultiplier: 5, defaultCommission: 1.20, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  NQ: { name: 'E-mini Nasdaq 100', tickSize: 0.25, tickValue: 5.00, pointMultiplier: 20, defaultCommission: 4.50, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  MNQ: { name: 'Micro E-mini Nasdaq 100', tickSize: 0.25, tickValue: 0.50, pointMultiplier: 2, defaultCommission: 1.20, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  YM: { name: 'E-mini Dow', tickSize: 1.00, tickValue: 5.00, pointMultiplier: 5, defaultCommission: 4.50, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  MYM: { name: 'Micro E-mini Dow', tickSize: 1.00, tickValue: 0.50, pointMultiplier: 0.5, defaultCommission: 1.20, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  RTY: { name: 'E-mini Russell 2000', tickSize: 0.10, tickValue: 5.00, pointMultiplier: 50, defaultCommission: 4.50, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  M2K: { name: 'Micro E-mini Russell 2000', tickSize: 0.10, tickValue: 0.50, pointMultiplier: 5, defaultCommission: 1.20, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  CL: { name: 'Crude Oil', tickSize: 0.01, tickValue: 10.00, pointMultiplier: 1000, defaultCommission: 4.50, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  MCL: { name: 'Micro WTI Crude Oil', tickSize: 0.01, tickValue: 1.00, pointMultiplier: 100, defaultCommission: 1.20, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  GC: { name: 'Gold', tickSize: 0.10, tickValue: 10.00, pointMultiplier: 100, defaultCommission: 4.50, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  MGC: { name: 'Micro Gold', tickSize: 0.10, tickValue: 1.00, pointMultiplier: 10, defaultCommission: 1.20, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  ZB: { name: '30-Year U.S. Treasury Bond', tickSize: 0.03125, tickValue: 31.25, pointMultiplier: 1000, defaultCommission: 4.50, defaultSpreadTicks: 1, defaultSlippageTicks: 1 },
  ZN: { name: '10-Year U.S. Treasury Note', tickSize: 0.015625, tickValue: 15.625, pointMultiplier: 1000, defaultCommission: 4.50, defaultSpreadTicks: 1, defaultSlippageTicks: 1 }
};

// Forex specifications (Standard Lot = 100,000 units)
export const FOREX_SPECS = {
  EURUSD: { name: 'EUR/USD', pipSize: 0.0001, pipValuePerLot: 10.0, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.0, defaultSlippagePips: 0.5 },
  GBPUSD: { name: 'GBP/USD', pipSize: 0.0001, pipValuePerLot: 10.0, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.2, defaultSlippagePips: 0.6 },
  AUDUSD: { name: 'AUD/USD', pipSize: 0.0001, pipValuePerLot: 10.0, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.2, defaultSlippagePips: 0.5 },
  NZDUSD: { name: 'NZD/USD', pipSize: 0.0001, pipValuePerLot: 10.0, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.5, defaultSlippagePips: 0.6 },
  USDJPY: { name: 'USD/JPY', pipSize: 0.01, pipValuePerLot: null, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.2, defaultSlippagePips: 0.5 },
  USDCAD: { name: 'USD/CAD', pipSize: 0.0001, pipValuePerLot: null, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.5, defaultSlippagePips: 0.5 },
  USDCHF: { name: 'USD/CHF', pipSize: 0.0001, pipValuePerLot: null, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.5, defaultSlippagePips: 0.5 },
  EURGBP: { name: 'EUR/GBP', pipSize: 0.0001, pipValuePerLot: null, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.5, defaultSlippagePips: 0.5 },
  EURJPY: { name: 'EUR/JPY', pipSize: 0.01, pipValuePerLot: null, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.5, defaultSlippagePips: 0.6 },
  GBPJPY: { name: 'GBP/JPY', pipSize: 0.01, pipValuePerLot: null, lotStep: 0.01, defaultCommissionPerLot: 6.00, defaultSpreadPips: 1.8, defaultSlippagePips: 0.8 }
};

// Cryptocurrency specifications
export const CRYPTO_SPECS = {
  BTCUSD: { name: 'Bitcoin (USD)', pointMultiplier: 1.0, sizeStep: 0.001, defaultCommissionRoundTurn: 5.0, defaultSpreadPoints: 2.0, defaultSlippagePoints: 2.0 },
  BTCUSDT: { name: 'Bitcoin (USDT)', pointMultiplier: 1.0, sizeStep: 0.001, defaultCommissionRoundTurn: 5.0, defaultSpreadPoints: 2.0, defaultSlippagePoints: 2.0 },
  ETHUSD: { name: 'Ethereum (USD)', pointMultiplier: 1.0, sizeStep: 0.01, defaultCommissionRoundTurn: 0.50, defaultSpreadPoints: 0.25, defaultSlippagePoints: 0.25 },
  ETHUSDT: { name: 'Ethereum (USDT)', pointMultiplier: 1.0, sizeStep: 0.01, defaultCommissionRoundTurn: 0.50, defaultSpreadPoints: 0.25, defaultSlippagePoints: 0.25 },
  SOLUSD: { name: 'Solana (USD)', pointMultiplier: 1.0, sizeStep: 0.1, defaultCommissionRoundTurn: 0.10, defaultSpreadPoints: 0.05, defaultSlippagePoints: 0.05 },
  SOLUSDT: { name: 'Solana (USDT)', pointMultiplier: 1.0, sizeStep: 0.1, defaultCommissionRoundTurn: 0.10, defaultSpreadPoints: 0.05, defaultSlippagePoints: 0.05 }
};

// Equity specifications
export const EQUITY_DEFAULTS = {
  pointMultiplier: 1.0,
  sizeStep: 1,
  defaultCommissionPerShare: 0.005,
  defaultSpreadPerShare: 0.02,
  defaultSlippagePerShare: 0.02
};

/**
 * Returns complete instrument specification for sizing and friction estimation.
 */
export function getInstrumentSpec(symbol = '', assetClass = 'EQUITY', entryPrice = 0, customPipValue = null) {
  const normAsset = String(assetClass || 'EQUITY').toUpperCase();
  const cleanSymbol = String(symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (normAsset === 'FUTURES') {
    const spec = FUTURES_SPECS[cleanSymbol];
    if (spec) {
      const tickSize = spec.tickSize;
      const tickValue = spec.tickValue;
      const pointMultiplier = spec.pointMultiplier || (tickValue / tickSize);
      const defaultCommission = spec.defaultCommission !== undefined ? spec.defaultCommission : (spec.name.includes('Micro') ? 1.20 : 4.50);
      const defaultSpreadCost = (spec.defaultSpreadTicks || 1) * tickValue;
      const defaultSlippageCost = (spec.defaultSlippageTicks || 1) * tickValue;
      return {
        symbol: cleanSymbol,
        name: spec.name,
        assetClass: 'FUTURES',
        unitType: 'contracts',
        tickOrPipSize: tickSize,
        tickOrPipValue: tickValue,
        pointMultiplier,
        sizeStep: 1,
        defaultCommission,
        defaultSpreadCost,
        defaultSlippageCost,
        totalFrictionPerUnit: defaultCommission + defaultSpreadCost + defaultSlippageCost,
        supported: true,
        spec
      };
    }
    return {
      symbol: cleanSymbol,
      name: cleanSymbol || 'Unknown Futures',
      assetClass: 'FUTURES',
      unitType: 'contracts',
      tickOrPipSize: 0.25,
      tickOrPipValue: 12.50,
      pointMultiplier: 50,
      sizeStep: 1,
      defaultCommission: 4.50,
      defaultSpreadCost: 12.50,
      defaultSlippageCost: 12.50,
      totalFrictionPerUnit: 29.50,
      supported: false,
      reason: `No verified contract specification for ${cleanSymbol || 'this symbol'}. Add the exchange tick size and tick value before sizing.`
    };
  }

  if (normAsset === 'FOREX') {
    const isJpy = cleanSymbol.endsWith('JPY');
    const pipSize = isJpy ? 0.01 : 0.0001;
    let pipValue = customPipValue ? Number(customPipValue) : null;
    if (!pipValue) {
      if (cleanSymbol.endsWith('USD')) {
        pipValue = 10.0;
      } else if (cleanSymbol.startsWith('USD') && isJpy && entryPrice > 0) {
        pipValue = 1000 / entryPrice;
      } else {
        const known = FOREX_SPECS[cleanSymbol];
        pipValue = known?.pipValuePerLot || 10.0;
      }
    }
    const known = FOREX_SPECS[cleanSymbol];
    const defaultComm = known?.defaultCommissionPerLot || 6.00;
    const spreadPips = known?.defaultSpreadPips || (isJpy ? 1.5 : 1.0);
    const slippagePips = known?.defaultSlippagePips || 0.5;
    const defaultSpreadCost = spreadPips * pipValue;
    const defaultSlippageCost = slippagePips * pipValue;
    return {
      symbol: cleanSymbol,
      name: known?.name || cleanSymbol || 'Forex Pair',
      assetClass: 'FOREX',
      unitType: 'lots',
      tickOrPipSize: pipSize,
      tickOrPipValue: pipValue,
      pointMultiplier: 100000,
      sizeStep: 0.01,
      defaultCommission: defaultComm,
      defaultSpreadCost,
      defaultSlippageCost,
      totalFrictionPerUnit: defaultComm + defaultSpreadCost + defaultSlippageCost,
      supported: true
    };
  }

  if (normAsset === 'CRYPTO') {
    const known = CRYPTO_SPECS[cleanSymbol];
    const pointMultiplier = known?.pointMultiplier || 1.0;
    const sizeStep = known?.sizeStep || 0.001;
    const defaultComm = known?.defaultCommissionRoundTurn || 2.0;
    const defaultSpreadCost = (known?.defaultSpreadPoints || 1.0) * pointMultiplier;
    const defaultSlippageCost = (known?.defaultSlippagePoints || 1.0) * pointMultiplier;
    return {
      symbol: cleanSymbol,
      name: known?.name || cleanSymbol || 'Crypto Asset',
      assetClass: 'CRYPTO',
      unitType: 'units',
      tickOrPipSize: 0.01,
      tickOrPipValue: 0.01,
      pointMultiplier,
      sizeStep,
      defaultCommission: defaultComm,
      defaultSpreadCost,
      defaultSlippageCost,
      totalFrictionPerUnit: defaultComm + defaultSpreadCost + defaultSlippageCost,
      supported: true
    };
  }

  // Default: EQUITY / STOCKS
  return {
    symbol: cleanSymbol,
    name: cleanSymbol || 'Equity Share',
    assetClass: 'EQUITY',
    unitType: 'shares',
    tickOrPipSize: 0.01,
    tickOrPipValue: 0.01,
    pointMultiplier: EQUITY_DEFAULTS.pointMultiplier,
    sizeStep: EQUITY_DEFAULTS.sizeStep,
    defaultCommission: EQUITY_DEFAULTS.defaultCommissionPerShare,
    defaultSpreadCost: EQUITY_DEFAULTS.defaultSpreadPerShare,
    defaultSlippageCost: EQUITY_DEFAULTS.defaultSlippagePerShare,
    totalFrictionPerUnit: EQUITY_DEFAULTS.defaultCommissionPerShare + EQUITY_DEFAULTS.defaultSpreadPerShare + EQUITY_DEFAULTS.defaultSlippagePerShare,
    supported: true
  };
}

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
 * Advanced Instrument-Aware Position Sizer with Friction Deduction.
 * Deducts round-trip commission, spread-crossing, and slippage buffer
 * so that total committed risk never breaches the allocated risk budget.
 */
export function calculateInstrumentAwarePositionSize({
  assetClass = 'EQUITY',
  symbol = '',
  entryPrice = 0,
  stopLoss = 0,
  accountBalance = 10000,
  riskPercentage = 1.0,
  accountForCosts = true,
  customCommission = null,
  customSpread = null,
  customSlippage = null,
  customPipValuePerLot = null,
  sizeStep = null
} = {}) {
  const riskBudget = calculateRiskBudget(accountBalance, riskPercentage);
  const distance = Math.abs(entryPrice - stopLoss);
  const spec = getInstrumentSpec(symbol, assetClass, entryPrice, customPipValuePerLot);

  if (distance === 0 || riskBudget <= 0) {
    return {
      quantity: 0,
      units: 0,
      unitType: spec.unitType,
      distance: 0,
      ticksOrPips: 0,
      nominalRiskPerUnit: 0,
      frictionPerUnit: 0,
      unitCommittedRisk: 0,
      nominalRisk: 0,
      totalCommission: 0,
      totalSpreadCost: 0,
      totalSlippageCost: 0,
      totalFriction: 0,
      totalCommittedRisk: 0,
      effectiveRiskPercent: 0,
      riskBudget,
      spec,
      supported: false,
      reason: 'Enter valid non-zero entry and stop loss prices, and a positive risk budget.'
    };
  }

  if (!spec.supported) {
    return {
      quantity: 0,
      units: 0,
      unitType: spec.unitType,
      distance,
      ticksOrPips: 0,
      nominalRiskPerUnit: 0,
      frictionPerUnit: 0,
      unitCommittedRisk: 0,
      nominalRisk: 0,
      totalCommission: 0,
      totalSpreadCost: 0,
      totalSlippageCost: 0,
      totalFriction: 0,
      totalCommittedRisk: 0,
      effectiveRiskPercent: 0,
      riskBudget,
      spec,
      supported: false,
      reason: spec.reason
    };
  }

  // Nominal risk per unit
  let ticksOrPips = 0;
  let nominalRiskPerUnit = 0;

  if (spec.assetClass === 'FUTURES') {
    ticksOrPips = Math.round((distance / spec.tickOrPipSize) * 100) / 100;
    nominalRiskPerUnit = ticksOrPips * spec.tickOrPipValue;
  } else if (spec.assetClass === 'FOREX') {
    ticksOrPips = Math.round((distance / spec.tickOrPipSize) * 10) / 10;
    nominalRiskPerUnit = ticksOrPips * spec.tickOrPipValue;
  } else {
    ticksOrPips = Math.round((distance / spec.tickOrPipSize) * 100) / 100;
    nominalRiskPerUnit = distance * spec.pointMultiplier;
  }

  // Friction costs per unit
  const commPerUnit = customCommission !== null && customCommission !== undefined
    ? Math.max(0, Number(customCommission))
    : spec.defaultCommission;

  const spreadCostPerUnit = customSpread !== null && customSpread !== undefined
    ? Math.max(0, Number(customSpread) * (spec.assetClass === 'FOREX' ? spec.tickOrPipValue : spec.pointMultiplier))
    : spec.defaultSpreadCost;

  const slippageCostPerUnit = customSlippage !== null && customSlippage !== undefined
    ? Math.max(0, Number(customSlippage) * (spec.assetClass === 'FOREX' ? spec.tickOrPipValue : spec.pointMultiplier))
    : spec.defaultSlippageCost;

  const frictionPerUnit = commPerUnit + spreadCostPerUnit + slippageCostPerUnit;
  const unitCommittedRisk = accountForCosts
    ? (nominalRiskPerUnit + frictionPerUnit)
    : nominalRiskPerUnit;

  if (unitCommittedRisk <= 0) {
    return {
      quantity: 0,
      units: 0,
      unitType: spec.unitType,
      distance,
      ticksOrPips,
      nominalRiskPerUnit: 0,
      frictionPerUnit: 0,
      unitCommittedRisk: 0,
      nominalRisk: 0,
      totalCommission: 0,
      totalSpreadCost: 0,
      totalSlippageCost: 0,
      totalFriction: 0,
      totalCommittedRisk: 0,
      effectiveRiskPercent: 0,
      riskBudget,
      spec,
      supported: false,
      reason: 'Calculated risk per unit is zero or negative.'
    };
  }

  // Quantization
  const rawUnits = riskBudget / unitCommittedRisk;
  const step = sizeStep || spec.sizeStep || 1;
  let units = 0;

  if (spec.assetClass === 'FUTURES') {
    units = Math.floor(rawUnits);
  } else if (spec.assetClass === 'EQUITY' && step === 1) {
    units = Math.floor(rawUnits);
  } else {
    const decimals = step < 0.001 ? 6 : (step < 0.01 ? 4 : 2);
    units = Number((Math.floor((rawUnits + 1e-7) / step) * step).toFixed(decimals));
  }
  units = Math.max(0, units);

  // Totals for approved position
  const nominalRisk = Math.round(units * nominalRiskPerUnit * 100) / 100;
  const totalCommission = Math.round(units * commPerUnit * 100) / 100;
  const totalSpreadCost = Math.round(units * spreadCostPerUnit * 100) / 100;
  const totalSlippageCost = Math.round(units * slippageCostPerUnit * 100) / 100;
  const totalFriction = Math.round((totalCommission + totalSpreadCost + totalSlippageCost) * 100) / 100;
  const totalCommittedRisk = Math.round((nominalRisk + totalFriction) * 100) / 100;
  const effectiveRiskPercent = accountBalance > 0
    ? Math.round((totalCommittedRisk / accountBalance) * 10000) / 100
    : 0;

  const frictionPercentOfBudget = riskBudget > 0
    ? Math.round((totalFriction / riskBudget) * 10000) / 100
    : 0;

  return {
    quantity: units,
    units,
    unitType: spec.unitType,
    distance,
    ticksOrPips,
    nominalRiskPerUnit: Math.round(nominalRiskPerUnit * 100) / 100,
    frictionPerUnit: Math.round(frictionPerUnit * 100) / 100,
    unitCommittedRisk: Math.round(unitCommittedRisk * 100) / 100,
    nominalRisk,
    totalCommission,
    totalSpreadCost,
    totalSlippageCost,
    totalFriction,
    totalCommittedRisk,
    effectiveRiskPercent,
    frictionPercentOfBudget,
    riskBudget,
    positionValue: Math.round(units * entryPrice * (spec.assetClass === 'FUTURES' ? spec.pointMultiplier : 1) * 100) / 100,
    spec,
    accountForCosts,
    supported: units > 0,
    reason: units === 0
      ? `One minimum ${spec.unitType.slice(0, -1) || 'unit'} requires $${unitCommittedRisk.toFixed(2)} committed risk, exceeding your $${riskBudget.toFixed(2)} risk budget. Reduce stop distance or switch to a micro instrument.`
      : null
  };
}

/**
 * Hard Risk Guardrails Evaluator with Transparent Explanation.
 * Validates instrument specs, risk budgets, daily loss/trade caps, and projected loss stop.
 */
export function evaluateInstrumentRiskGuardrails({
  plan = {},
  contract = DEFAULT_TRADING_CONTRACT,
  trades = [],
  candidateTrade = {},
  accountBalance = 10000,
  candidateDate = new Date().toISOString(),
  preSessionLogs = [],
  accountForCosts = true
} = {}) {
  const normalizedPlan = normalizeTradingPlan(plan);
  const activeContract = { ...DEFAULT_TRADING_CONTRACT, ...contract };
  const targetDateStr = new Date(candidateDate).toISOString().slice(0, 10);

  const entryPrice = Number(candidateTrade.entryPrice) || 0;
  const stopLoss = Number(candidateTrade.stopLoss) || 0;
  const takeProfit = Number(candidateTrade.takeProfit) || null;
  const direction = String(candidateTrade.direction || 'LONG').toUpperCase();
  const symbol = String(candidateTrade.symbol || '').toUpperCase().trim();
  const assetClass = String(candidateTrade.assetClass || 'EQUITY').toUpperCase();

  const maxRiskPercent = Math.min(
    normalizedPlan.maxRiskPercent || 1.0,
    activeContract.maxRiskPerTradePercent || 1.5
  );
  const maxDailyTrades = Math.min(
    normalizedPlan.maxDailyTrades || 3,
    activeContract.maxDailyTrades || 3
  );
  const maxDailyLossR = Math.min(
    normalizedPlan.maxDailyLossR || 2.0,
    activeContract.maxDailyLossR || 2.0
  );

  const breaches = [];

  // G1: Invalid prices
  if (entryPrice <= 0 || stopLoss <= 0) {
    breaches.push({
      code: 'SETUP_INVALID_PRICES',
      name: 'Invalid Price Setup',
      severity: 'CRITICAL',
      message: 'Entry price and stop loss must be positive numbers.'
    });
  } else if (entryPrice === stopLoss) {
    breaches.push({
      code: 'SETUP_ZERO_STOP',
      name: 'Zero Stop Distance',
      severity: 'CRITICAL',
      message: 'Stop loss cannot equal entry price (zero stop distance).'
    });
  }

  // G2: Direction and price geometry
  if (entryPrice > 0 && stopLoss > 0 && entryPrice !== stopLoss) {
    if (direction === 'LONG') {
      if (stopLoss >= entryPrice) {
        breaches.push({
          code: 'GEOMETRY_INVALID_STOP',
          name: 'Invalid Long Stop Geometry',
          severity: 'CRITICAL',
          message: 'For a LONG trade, stop loss must be placed strictly below entry price.'
        });
      }
      if (takeProfit && takeProfit <= entryPrice) {
        breaches.push({
          code: 'GEOMETRY_INVALID_TARGET',
          name: 'Invalid Long Target Geometry',
          severity: 'CRITICAL',
          message: 'For a LONG trade, take profit target must be placed strictly above entry price.'
        });
      }
    } else if (direction === 'SHORT') {
      if (stopLoss <= entryPrice) {
        breaches.push({
          code: 'GEOMETRY_INVALID_STOP',
          name: 'Invalid Short Stop Geometry',
          severity: 'CRITICAL',
          message: 'For a SHORT trade, stop loss must be placed strictly above entry price.'
        });
      }
      if (takeProfit && takeProfit >= entryPrice) {
        breaches.push({
          code: 'GEOMETRY_INVALID_TARGET',
          name: 'Invalid Short Target Geometry',
          severity: 'CRITICAL',
          message: 'For a SHORT trade, take profit target must be placed strictly below entry price.'
        });
      }
    }

    if (takeProfit) {
      const riskDist = Math.abs(entryPrice - stopLoss);
      const rewardDist = Math.abs(takeProfit - entryPrice);
      const rr = riskDist > 0 ? (rewardDist / riskDist) : 0;
      const minRR = normalizedPlan.minimumRewardRisk || 0;
      if (minRR > 0 && rr < (minRR - 0.01)) {
        breaches.push({
          code: 'MINIMUM_RR_UNMET',
          name: 'Minimum Reward-to-Risk Unmet',
          severity: 'HIGH',
          message: `Setup offers 1:${rr.toFixed(2)} R:R, which is below your plan minimum of 1:${minRR.toFixed(1)}.`
        });
      }
    }
  }

  // G3: Position sizing & cost calculation
  const sizing = calculateInstrumentAwarePositionSize({
    assetClass,
    symbol,
    entryPrice,
    stopLoss,
    accountBalance,
    riskPercentage: maxRiskPercent,
    accountForCosts,
    customCommission: candidateTrade.customCommission,
    customSpread: candidateTrade.customSpread,
    customSlippage: candidateTrade.customSlippage,
    customPipValuePerLot: candidateTrade.customPipValuePerLot,
    sizeStep: candidateTrade.sizeStep
  });

  const userQuantity = candidateTrade.quantity !== undefined && candidateTrade.quantity !== null && Number(candidateTrade.quantity) > 0
    ? Number(candidateTrade.quantity)
    : sizing.quantity;

  if (sizing.quantity === 0 && (!candidateTrade.quantity || candidateTrade.quantity <= 0)) {
    breaches.push({
      code: 'SIZING_INSUFFICIENT_BUDGET',
      name: 'Insufficient Risk Budget',
      severity: 'CRITICAL',
      message: sizing.reason || 'Risk budget cannot accommodate minimum unit size with this stop distance and estimated costs.'
    });
  }

  // Evaluate risk against cap
  const nominalRiskDollars = userQuantity * sizing.nominalRiskPerUnit;
  const frictionDollars = userQuantity * sizing.frictionPerUnit;
  const committedRiskDollars = accountForCosts ? (nominalRiskDollars + frictionDollars) : nominalRiskDollars;
  const committedRiskPercent = accountBalance > 0 ? (committedRiskDollars / accountBalance) * 100 : 0;

  if (committedRiskPercent > (maxRiskPercent + 0.05)) {
    breaches.push({
      code: 'PLAN_RISK_CAP',
      name: 'Risk Cap Exceeded',
      severity: 'CRITICAL',
      message: `Committed risk of ${committedRiskPercent.toFixed(2)}% ($${committedRiskDollars.toFixed(2)}) exceeds your ${maxRiskPercent.toFixed(1)}% ($${sizing.riskBudget.toFixed(2)}) risk ceiling.`
    });
  }

  // G4: Daily Trade Limit
  const todayTrades = trades.filter(t => {
    const tDate = new Date(t.entryDate || t.date).toISOString().slice(0, 10);
    return tDate === targetDateStr;
  });

  if (todayTrades.length >= maxDailyTrades) {
    breaches.push({
      code: 'PLAN_DAILY_TRADE_CAP',
      name: 'Daily Trade Cap Reached',
      severity: 'CRITICAL',
      message: `Today's ${todayTrades.length} trades have reached your hard daily limit of ${maxDailyTrades} trades. Stop trading to prevent overtrading.`
    });
  }

  // G5: Daily Realized Loss Limit
  const todayLossR = todayTrades.reduce((acc, t) => {
    const r = Number(t.rMultiple) || 0;
    return acc + (r < 0 ? Math.abs(r) : 0);
  }, 0);

  if (todayLossR >= maxDailyLossR) {
    breaches.push({
      code: 'PLAN_DAILY_LOSS_CAP',
      name: 'Daily Loss Limit Reached',
      severity: 'CRITICAL',
      message: `Today's loss is -${todayLossR.toFixed(2)}R, at or above your hard daily stop of -${maxDailyLossR.toFixed(1)}R. Step away to protect capital.`
    });
  }

  // G6: Projected Daily Loss Limit
  const baselineTradeBudget = accountBalance * (maxRiskPercent / 100);
  const candidateRiskR = baselineTradeBudget > 0
    ? (committedRiskDollars / baselineTradeBudget)
    : 1.0;
  const projectedLossR = todayLossR + candidateRiskR;

  if (todayLossR < maxDailyLossR && projectedLossR > (maxDailyLossR + 0.05)) {
    breaches.push({
      code: 'PLAN_PROJECTED_LOSS_CAP',
      name: 'Projected Loss Cap Breach',
      severity: 'CRITICAL',
      message: `Projected daily loss if stopped out would be -${projectedLossR.toFixed(2)}R (-${todayLossR.toFixed(2)}R realized + -${candidateRiskR.toFixed(2)}R candidate risk), breaching your hard daily stop of -${maxDailyLossR.toFixed(1)}R.`
    });
  }

  // G7: Mandatory Cooldown
  if (todayTrades.length > 0 && activeContract.cooldownMinutes > 0) {
    const sortedToday = [...todayTrades].sort((a, b) => new Date(b.exitDate || b.entryDate) - new Date(a.exitDate || a.entryDate));
    const lastTrade = sortedToday[0];
    const lastPnL = Number(lastTrade.netPnL) || 0;
    if (lastPnL < 0) {
      const lastExitTime = new Date(lastTrade.exitDate || lastTrade.entryDate).getTime();
      const candidateTime = new Date(candidateDate).getTime();
      const minutesSinceLoss = (candidateTime - lastExitTime) / (1000 * 60);
      if (minutesSinceLoss >= 0 && minutesSinceLoss < activeContract.cooldownMinutes) {
        const remainingCooldown = Math.ceil(activeContract.cooldownMinutes - minutesSinceLoss);
        breaches.push({
          code: 'COOLDOWN_ACTIVE',
          name: 'Mandatory Cooldown Active',
          severity: 'HIGH',
          message: `Contract requires a ${activeContract.cooldownMinutes}-minute pause after a loss. ${remainingCooldown} minute(s) remaining in cooldown window.`
        });
      }
    }
  }

  // G8: Pre-Session Checklist (Warning / Critical)
  if (activeContract.enforcePreSession) {
    const hasPreSession = preSessionLogs.some(log => log.date && log.date.slice(0, 10) === targetDateStr && log.completed);
    if (!hasPreSession && candidateTrade.preSessionCompleted !== true) {
      breaches.push({
        code: 'UNPREPARED_SESSION',
        name: 'Pre-Session Checklist Missing',
        severity: 'WARNING',
        message: 'No morning preparation audit found for this trading day. Complete your pre-session checklist before execution.'
      });
    }
  }

  // Determine canTrade
  const hardBreaches = breaches.filter(b => b.severity === 'CRITICAL' || b.severity === 'HIGH');
  const canTrade = hardBreaches.length === 0;
  const verdict = canTrade ? 'PASS' : 'BLOCK';

  // Construct metrics
  const remainingTrades = Math.max(0, maxDailyTrades - todayTrades.length);
  const remainingDailyLossBufferR = Math.max(0, Math.round((maxDailyLossR - todayLossR) * 100) / 100);

  const metrics = {
    symbol: sizing.spec.symbol,
    assetClass: sizing.spec.assetClass,
    units: userQuantity,
    unitType: sizing.spec.unitType,
    stopDistance: sizing.distance,
    ticksOrPips: sizing.ticksOrPips,
    nominalRisk: Math.round(nominalRiskDollars * 100) / 100,
    estimatedFriction: {
      commission: Math.round(userQuantity * (sizing.spec.defaultCommission || 0) * 100) / 100,
      spreadCost: Math.round(userQuantity * sizing.spec.defaultSpreadCost * 100) / 100,
      slippageCost: Math.round(userQuantity * sizing.spec.defaultSlippageCost * 100) / 100,
      totalFriction: Math.round(frictionDollars * 100) / 100
    },
    totalCommittedRisk: Math.round(committedRiskDollars * 100) / 100,
    effectiveRiskPercent: Math.round(committedRiskPercent * 100) / 100,
    riskBudget: sizing.riskBudget,
    remainingRiskBudget: Math.max(0, Math.round((sizing.riskBudget - committedRiskDollars) * 100) / 100),
    todayTradesCount: todayTrades.length,
    maxDailyTrades,
    remainingTrades,
    todayLossR: Math.round(todayLossR * 100) / 100,
    candidateRiskR: Math.round(candidateRiskR * 100) / 100,
    projectedDailyLossR: Math.round(projectedLossR * 100) / 100,
    maxDailyLossR,
    remainingDailyLossBufferR
  };

  // Generate Clear Explanation
  let explanation = '';
  if (canTrade) {
    const unitLabel = userQuantity === 1 ? metrics.unitType.slice(0, -1) : metrics.unitType;
    explanation = [
      `PASS: RISK CHECKS VERIFIED ✓`,
      `• Instrument: ${sizing.spec.name} (${sizing.spec.symbol}) | Class: ${sizing.spec.assetClass} | Tick/Pip: ${sizing.spec.tickOrPipSize} ($${sizing.spec.tickOrPipValue.toFixed(2)})`,
      `• Approved Size: ${userQuantity} ${unitLabel} | Stop Distance: ${metrics.stopDistance.toFixed(4)} (${metrics.ticksOrPips} ${sizing.spec.assetClass === 'FOREX' ? 'pips' : 'ticks/points'})`,
      `• Execution Friction: Nominal Risk $${metrics.nominalRisk.toFixed(2)} + Estimated Friction $${metrics.estimatedFriction.totalFriction.toFixed(2)} (Comm: $${metrics.estimatedFriction.commission.toFixed(2)}, Spread: $${metrics.estimatedFriction.spreadCost.toFixed(2)}, Slippage: $${metrics.estimatedFriction.slippageCost.toFixed(2)})`,
      `• Total Committed Risk: $${metrics.totalCommittedRisk.toFixed(2)} (${metrics.effectiveRiskPercent.toFixed(2)}% of balance), safely within your ${maxRiskPercent.toFixed(1)}% ($${sizing.riskBudget.toFixed(2)}) ceiling`,
      `• Daily Trade Guardrail: ${metrics.todayTradesCount}/${metrics.maxDailyTrades} trades taken today (${metrics.remainingTrades} trades remaining)`,
      `• Daily Loss Guardrail: -${metrics.todayLossR.toFixed(2)}R realized + -${metrics.candidateRiskR.toFixed(2)}R candidate = -${metrics.projectedDailyLossR.toFixed(2)}R projected loss, preserving ${metrics.remainingDailyLossBufferR.toFixed(2)}R cushion before your -${metrics.maxDailyLossR.toFixed(1)}R stop`,
      `• Behavioral Status: Cooldown clear; discipline boundaries satisfied`
    ].join('\n');
  } else {
    explanation = [
      `HARD GUARDRAIL BLOCKED ⚠`,
      `Execution halted by risk management rules:`,
      ...hardBreaches.map(b => `• [${b.name}]: ${b.message}`),
      `Remediation: Adjust position size, widen capital buffer, or respect daily stop / cooldown lockout before re-evaluating.`
    ].join('\n');
  }

  return {
    canTrade,
    verdict,
    reason: canTrade ? 'All instrument-aware risk checks and hard guardrails passed.' : hardBreaches[0]?.message,
    explanation,
    metrics,
    breaches
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
  sizeStep = null,
  accountForCosts = false,
  customCommission = null,
  customSpread = null,
  customSlippage = null
}) {
  const riskBudget = calculateRiskBudget(accountBalance, riskPercentage);
  const aware = calculateInstrumentAwarePositionSize({
    assetClass,
    symbol,
    entryPrice,
    stopLoss,
    accountBalance,
    riskPercentage,
    accountForCosts,
    customCommission,
    customSpread,
    customSlippage,
    customPipValuePerLot,
    sizeStep
  });

  switch (assetClass.toUpperCase()) {
    case 'EQUITY': {
      const legacy = calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget);
      return { ...legacy, ...aware, assetClass };
    }
    case 'CRYPTO': {
      const legacy = calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget, sizeStep || 0.000001);
      return { ...legacy, ...aware, assetClass };
    }
    case 'FOREX': {
      const legacy = calculateForexSize(symbol, entryPrice, stopLoss, riskBudget, customPipValuePerLot, sizeStep || 0.01);
      return { ...legacy, ...aware, assetClass };
    }
    case 'FUTURES': {
      const legacy = calculateFuturesSize(symbol, entryPrice, stopLoss, riskBudget);
      return { ...legacy, ...aware, assetClass };
    }
    case 'COMMODITY': {
      const legacy = calculateLinearInstrumentSize(entryPrice, stopLoss, riskBudget, valuePerPriceUnit, sizeStep || 0.01);
      return { ...legacy, ...aware, assetClass };
    }
    default: {
      const legacy = calculateEquityCryptoSize(entryPrice, stopLoss, riskBudget);
      return { ...legacy, ...aware, assetClass };
    }
  }
}
