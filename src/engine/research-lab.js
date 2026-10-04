/**
 * Ledger & Wick — Strategy Research Lab Engine
 * 
 * Tests precise setup rules against historical multi-regime data with:
 * 1. Realistic execution fills (spread, commissions, market slippage, stop loss gap slippage)
 * 2. In-Sample (Development) vs. Out-of-Sample (Validation) partitioning
 * 3. Statistical uncertainty (95% Wilson CI for win rate, 95% SE for expectancy)
 * 4. Drawdown & losing streak probability modeling (theoretical vs observed, Monte Carlo fan)
 * 5. Market regime & session performance breakdown (Bull, Bear, Chop, High Volatility)
 * 6. Edge Durability Scorecard (sample size, OOS decay, friction tolerance, regime versatility)
 */

export const MARKET_REGIMES = Object.freeze({
  BULL_TREND: 'BULL_TREND',
  BEAR_TREND: 'BEAR_TREND',
  CHOP_RANGE: 'CHOP_RANGE',
  HIGH_VOLATILITY: 'HIGH_VOLATILITY'
});

export const SESSIONS = Object.freeze({
  LONDON_OPEN: 'LONDON_OPEN',
  NY_OPEN: 'NY_OPEN',
  LUNCH_CHOP: 'LUNCH_CHOP',
  ASIAN_RANGE: 'ASIAN_RANGE'
});

function roundDec(val, decimals = 4) {
  const p = Math.pow(10, decimals);
  return Math.round(val * p) / p;
}

/**
 * Computes EMA, RSI, ATR, and Channel Extremes across bars.
 */
export function calculateIndicators(bars = []) {
  if (!bars || bars.length === 0) return bars;

  // 1. Exponential Moving Averages (EMA 20 & EMA 50)
  const calcEma = (period, key) => {
    const k = 2 / (period + 1);
    let ema = bars[0].close;
    bars.forEach((b, idx) => {
      if (idx === 0) {
        ema = b.close;
      } else {
        ema = (b.close * k) + (ema * (1 - k));
      }
      b[key] = roundDec(ema, 5);
    });
  };

  calcEma(20, 'ema20');
  calcEma(50, 'ema50');

  // 2. Average True Range (ATR 14)
  let atr = bars[0].high - bars[0].low;
  bars.forEach((b, idx) => {
    if (idx === 0) {
      b.atr14 = roundDec(atr, 5);
      return;
    }
    const tr = Math.max(
      b.high - b.low,
      Math.abs(b.high - bars[idx - 1].close),
      Math.abs(b.low - bars[idx - 1].close)
    );
    atr = ((atr * 13) + tr) / 14;
    b.atr14 = roundDec(atr, 5);
  });

  // 3. Relative Strength Index (RSI 14)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= Math.min(14, bars.length - 1); i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change >= 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= 14;
  avgLoss /= 14;

  bars.forEach((b, idx) => {
    if (idx < 14) {
      b.rsi14 = 50;
      return;
    }
    const change = b.close - bars[idx - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = ((avgGain * 13) + gain) / 14;
    avgLoss = ((avgLoss * 13) + loss) / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    b.rsi14 = Math.round(rsi * 10) / 10;
  });

  // 4. Donchian Channel High and Low
  bars.forEach((b, idx) => {
    const lookback = Math.max(0, idx - 15);
    const window = bars.slice(lookback, idx);
    if (window.length === 0) {
      b.donchianHigh = b.high;
      b.donchianLow = b.low;
      b.donchianHigh20 = b.high;
      b.donchianLow20 = b.low;
    } else {
      b.donchianHigh = roundDec(Math.max(...window.map(w => w.high)), 5);
      b.donchianLow = roundDec(Math.min(...window.map(w => w.low)), 5);
      b.donchianHigh20 = b.donchianHigh;
      b.donchianLow20 = b.donchianLow;
    }
  });

  return bars;
}

/**
 * Generates synthetic but realistic deterministic historical OHLCV data with distinct regimes.
 */
export function generateHistoricalDataset({
  symbol = 'EURUSD',
  assetClass = 'FOREX',
  startPrice = 1.0800,
  barCount,
  totalBars,
  trainSplit = 0.70,
  baseVolatility = 0.0016
} = {}) {
  const count = totalBars || barCount || 180;
  const splitIndex = Math.floor(count * trainSplit);
  const bars = [];
  let currentClose = startPrice;
  const startTime = new Date('2026-08-01T07:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    let regime = MARKET_REGIMES.CHOP_RANGE;
    let trendSlope = 0;
    let volMultiplier = 1.0;
    const cyclePos = i % 10; // 10-bar swing cycle (6 impulse bars, 4 pullback bars)

    // Regimes progression dynamically scaled across bar count:
    // 0% - 30%: Bull Trend (In-Sample)
    // 30% - 50%: Chop / Range (In-Sample)
    // 50% - 70%: High Volatility (In-Sample)
    // 70% - 85%: Bear Trend (Out-of-Sample)
    // 85% - 100%: Chop / Range (Out-of-Sample)
    const progress = i / count;
    if (progress <= 0.30) {
      regime = MARKET_REGIMES.BULL_TREND;
      trendSlope = cyclePos < 6 ? baseVolatility * 0.65 : -baseVolatility * 0.35;
      volMultiplier = 0.95;
    } else if (progress <= 0.50) {
      regime = MARKET_REGIMES.CHOP_RANGE;
      trendSlope = (i % 6 < 3 ? 1 : -1) * (baseVolatility * 0.45);
      volMultiplier = 0.85;
    } else if (progress <= 0.70) {
      regime = MARKET_REGIMES.HIGH_VOLATILITY;
      trendSlope = (i % 4 < 2 ? 1.2 : -1.1) * (baseVolatility * 0.8);
      volMultiplier = 2.2;
    } else if (progress <= 0.85) {
      regime = MARKET_REGIMES.BEAR_TREND;
      trendSlope = cyclePos < 6 ? -baseVolatility * 0.65 : baseVolatility * 0.35;
      volMultiplier = 1.1;
    } else {
      regime = MARKET_REGIMES.CHOP_RANGE;
      trendSlope = (i % 6 < 3 ? 0.7 : -0.7) * (baseVolatility * 0.35);
      volMultiplier = 0.9;
    }

    const noise = Math.sin(i * 2.3) * (baseVolatility * 0.25);
    const delta = trendSlope + noise;

    const open = currentClose;
    const close = Math.max(0.001, open + delta);

    const upperWick = Math.abs(Math.sin(i * 3.4)) * (baseVolatility * volMultiplier * 0.75);
    const lowerWick = Math.abs(Math.cos(i * 2.9)) * (baseVolatility * volMultiplier * 0.75);
    const high = Math.max(open, close) + upperWick;
    const low = Math.min(open, close) - lowerWick;
    const volume = Math.round(1500 + Math.abs(Math.sin(i * 0.8)) * 4000 * volMultiplier);

    const hour = (7 + (i * 4)) % 24;
    let session = SESSIONS.ASIAN_RANGE;
    if (hour >= 7 && hour < 12) session = SESSIONS.LONDON_OPEN;
    else if (hour >= 12 && hour < 17) session = SESSIONS.NY_OPEN;
    else if (hour >= 17 && hour < 21) session = SESSIONS.LUNCH_CHOP;

    currentClose = close;
    const timestamp = new Date(startTime + (i * 4 * 3600 * 1000)).toISOString();

    bars.push({
      index: i,
      timestamp,
      symbol,
      assetClass,
      open: roundDec(open, 5),
      high: roundDec(high, 5),
      low: roundDec(low, 5),
      close: roundDec(close, 5),
      volume,
      regime,
      session,
      partition: i < splitIndex ? 'IN_SAMPLE' : 'OUT_OF_SAMPLE'
    });
  }

  calculateIndicators(bars);
  bars.bars = bars;
  bars.symbol = symbol;
  bars.totalBars = count;
  bars.trainSplit = trainSplit;
  return bars;
}

export const RESEARCH_PRESETS = Object.freeze({
  TREND_PULLBACK_CONFLUENCE: {
    id: 'TREND_PULLBACK_CONFLUENCE',
    name: 'Trend Pullback & EMA Alignment',
    description: 'Disciplined mechanical pullback setup. In bull trend (EMA20 >= EMA50), buys when RSI pulls back (<62) with a bullish reversal close. In bear trend (EMA20 <= EMA50), sells rallies with a bearish close.',
    direction: 'BOTH',
    entryRules: {
      trendAlignment: 'WITH_TREND',
      maxRsi: 62,
      minRsi: 35,
      requireConfirmationCandle: true,
      allowedRegimes: ['BULL_TREND', 'BEAR_TREND', 'HIGH_VOLATILITY', 'CHOP_RANGE'],
      allowedSessions: ['ALL']
    },
    riskRules: {
      riskPerTradeDollars: 200,
      stopLossAtrMultiple: 1.2,
      takeProfitRMultiple: 1.8,
      breakEvenAtR: 1.0,
      maxHoldingBars: 10
    },
    friction: {
      commissionPerTrade: 3.50,
      spreadPoints: 0.00015,
      slippagePoints: 0.00010,
      gapSlippageMultiplier: 1.5
    },
    partitionRatio: 0.70
  },

  BREAKOUT_EXPANSION: {
    id: 'BREAKOUT_EXPANSION',
    name: 'Donchian Channel Volatility Breakout',
    description: 'Momentum breakout rule. Enters when close penetrates the 15-bar Donchian channel with healthy momentum.',
    direction: 'BOTH',
    entryRules: {
      trendAlignment: 'ANY',
      breakoutDonchian: true,
      minRsi: 45,
      maxRsi: 85,
      requireConfirmationCandle: true,
      allowedRegimes: ['BULL_TREND', 'BEAR_TREND', 'HIGH_VOLATILITY', 'CHOP_RANGE'],
      allowedSessions: ['ALL']
    },
    riskRules: {
      riskPerTradeDollars: 250,
      stopLossAtrMultiple: 1.4,
      takeProfitRMultiple: 2.0,
      breakEvenAtR: 1.0,
      maxHoldingBars: 12
    },
    friction: {
      commissionPerTrade: 4.00,
      spreadPoints: 0.00020,
      slippagePoints: 0.00015,
      gapSlippageMultiplier: 2.0
    },
    partitionRatio: 0.70
  },

  MEAN_REVERSION_RANGE: {
    id: 'MEAN_REVERSION_RANGE',
    name: 'Range Bound Oversold Reversal',
    description: 'Mean reversion strategy designed specifically for consolidation. Buys when RSI < 42 in range or high volatility with rejection confirmation.',
    direction: 'LONG',
    entryRules: {
      trendAlignment: 'ANY',
      maxRsi: 42,
      minRsi: 15,
      requireConfirmationCandle: true,
      allowedRegimes: ['CHOP_RANGE', 'HIGH_VOLATILITY'],
      allowedSessions: ['ALL']
    },
    riskRules: {
      riskPerTradeDollars: 150,
      stopLossAtrMultiple: 1.2,
      takeProfitRMultiple: 1.5,
      breakEvenAtR: 0.8,
      maxHoldingBars: 8
    },
    friction: {
      commissionPerTrade: 3.00,
      spreadPoints: 0.00015,
      slippagePoints: 0.00010,
      gapSlippageMultiplier: 1.5
    },
    partitionRatio: 0.70
  },

  FRAGILE_OVERFIT_DEMO: {
    id: 'FRAGILE_OVERFIT_DEMO',
    name: 'Curve-Fitted Overfit Trap (Educational Benchmark)',
    description: 'An intentionally hyper-optimized rule set with tiny stops and high friction. Shows sparkling in-sample results but completely collapses out-of-sample and under realistic execution friction.',
    direction: 'LONG',
    entryRules: {
      trendAlignment: 'BULLISH',
      minRsi: 48,
      maxRsi: 56,
      requireConfirmationCandle: true,
      allowedRegimes: ['BULL_TREND', 'HIGH_VOLATILITY', 'CHOP_RANGE', 'BEAR_TREND'],
      allowedSessions: ['ALL']
    },
    riskRules: {
      riskPerTradeDollars: 300,
      stopLossAtrMultiple: 0.35,
      takeProfitRMultiple: 3.5,
      breakEvenAtR: 0.4,
      maxHoldingBars: 20
    },
    friction: {
      commissionPerTrade: 5.00,
      spreadPoints: 0.00030,
      slippagePoints: 0.00025,
      gapSlippageMultiplier: 3.0
    },
    partitionRatio: 0.70
  }
});

/**
 * Checks if a historical bar satisfies a strategy's entry rules.
 */
export function evaluateBarEntryCondition(bar, prevBar, rules = {}, requestedDirection = 'BOTH') {
  if (!bar || !prevBar) return { isSignal: false, direction: null };

  const dir = (requestedDirection || rules.direction || 'BOTH').toUpperCase();

  // Regime filter
  if (Array.isArray(rules.allowedRegimes) && !rules.allowedRegimes.includes('ALL')) {
    if (!rules.allowedRegimes.includes(bar.regime)) return { isSignal: false, direction: null };
  }

  // Session filter
  if (Array.isArray(rules.allowedSessions) && !rules.allowedSessions.includes('ALL')) {
    if (!rules.allowedSessions.includes(bar.session)) return { isSignal: false, direction: null };
  }

  // Check LONG
  if (dir === 'LONG' || dir === 'BOTH') {
    let longOk = true;
    if (rules.trendAlignment === 'BULLISH' || (dir === 'BOTH' && rules.trendAlignment === 'WITH_TREND')) {
      if (!(bar.ema20 >= bar.ema50)) longOk = false;
    }
    if (rules.minRsi !== undefined && bar.rsi14 < rules.minRsi) longOk = false;
    if (rules.maxRsi !== undefined && bar.rsi14 > rules.maxRsi) longOk = false;
    if (rules.breakoutDonchian && bar.close < (prevBar.donchianHigh || bar.high)) longOk = false;
    if (rules.requireConfirmationCandle && bar.close <= bar.open) longOk = false;

    if (longOk) return { isSignal: true, direction: 'LONG' };
  }

  // Check SHORT
  if (dir === 'SHORT' || dir === 'BOTH') {
    let shortOk = true;
    if (rules.trendAlignment === 'BEARISH' || (dir === 'BOTH' && rules.trendAlignment === 'WITH_TREND')) {
      if (!(bar.ema20 <= bar.ema50)) shortOk = false;
    }
    const shortMinRsi = rules.maxRsi !== undefined ? (100 - rules.maxRsi) : 38;
    const shortMaxRsi = rules.minRsi !== undefined ? (100 - rules.minRsi) : 65;
    if (bar.rsi14 < shortMinRsi || bar.rsi14 > shortMaxRsi) shortOk = false;
    if (rules.breakoutDonchian && bar.close > (prevBar.donchianLow || bar.low)) shortOk = false;
    if (rules.requireConfirmationCandle && bar.close >= bar.open) shortOk = false;

    if (shortOk) return { isSignal: true, direction: 'SHORT' };
  }

  return { isSignal: false, direction: null };
}

/**
 * Runs a rigorous backtest on historical bars with execution friction and OOS partitioning.
 */
export function runStrategyBacktest(barsInput = [], strategy = RESEARCH_PRESETS.TREND_PULLBACK_CONFLUENCE) {
  const bars = Array.isArray(barsInput) ? barsInput : (barsInput?.bars || []);
  if (!bars || bars.length < 20) {
    return { error: 'Insufficient bar data for research backtest (minimum 20 bars required).' };
  }

  const partitionRatio = Math.max(0.3, Math.min(0.9, strategy.partitionRatio || bars.trainSplit || 0.70));
  const splitIndex = Math.floor(bars.length * partitionRatio);

  const friction = strategy.friction || {
    commissionPerTrade: 3.50,
    spreadPoints: 0.00015,
    slippagePoints: 0.00010,
    gapSlippageMultiplier: 1.5
  };

  const riskRules = strategy.riskRules || {
    riskPerTradeDollars: 200,
    stopLossAtrMultiple: 1.2,
    takeProfitRMultiple: 1.8,
    breakEvenAtR: 1.0,
    maxHoldingBars: 10
  };

  const trades = [];
  let inPosition = false;
  let currentPosition = null;

  for (let i = 15; i < bars.length; i++) {
    const currentBar = bars[i];
    const prevBar = bars[i - 1];

    if (inPosition && currentPosition) {
      currentPosition.holdingBars++;
      const pos = currentPosition;
      let exitReason = null;
      let rawExitPrice = null;
      let isGapLoss = false;
      const isLong = pos.direction === 'LONG';

      // 1. Check Take Profit hit
      if (isLong && currentBar.high >= pos.takeProfit) {
        exitReason = 'TAKE_PROFIT';
        rawExitPrice = pos.takeProfit;
      } else if (!isLong && currentBar.low <= pos.takeProfit) {
        exitReason = 'TAKE_PROFIT';
        rawExitPrice = pos.takeProfit;
      }

      // 2. Check Stop Loss hit
      else if (isLong && currentBar.low <= pos.stopLoss) {
        exitReason = pos.isStopAtBreakEven ? 'BREAK_EVEN' : 'STOP_LOSS';
        if (currentBar.open < pos.stopLoss) {
          isGapLoss = true;
          rawExitPrice = currentBar.open;
        } else {
          rawExitPrice = pos.stopLoss;
        }
      } else if (!isLong && currentBar.high >= pos.stopLoss) {
        exitReason = pos.isStopAtBreakEven ? 'BREAK_EVEN' : 'STOP_LOSS';
        if (currentBar.open > pos.stopLoss) {
          isGapLoss = true;
          rawExitPrice = currentBar.open;
        } else {
          rawExitPrice = pos.stopLoss;
        }
      }

      // 3. Max Holding Time
      else if (pos.holdingBars >= (riskRules.maxHoldingBars || 10)) {
        exitReason = 'TIME_EXPIRED';
        rawExitPrice = currentBar.close;
      }

      // 4. Update Breakeven Stop for SUBSEQUENT bars
      else if (pos.breakEvenAtR && !pos.isStopAtBreakEven && pos.holdingBars >= 1) {
        const favorableMove = isLong
          ? (currentBar.high - pos.fillEntryPrice)
          : (pos.fillEntryPrice - currentBar.low);
        if (favorableMove >= pos.initialRiskDistance * pos.breakEvenAtR) {
          pos.stopLoss = pos.fillEntryPrice;
          pos.isStopAtBreakEven = true;
        }
      }

      if (exitReason) {
        const spreadCost = friction.spreadPoints / 2;
        const exitSlippage = isGapLoss
          ? friction.slippagePoints * friction.gapSlippageMultiplier
          : friction.slippagePoints;

        let fillExitPrice;
        let idealGrossPnL;
        if (isLong) {
          fillExitPrice = rawExitPrice - spreadCost - exitSlippage;
          idealGrossPnL = (rawExitPrice - pos.rawEntryPrice) * pos.units;
        } else {
          fillExitPrice = rawExitPrice + spreadCost + exitSlippage;
          idealGrossPnL = (pos.rawEntryPrice - rawExitPrice) * pos.units;
        }

        const commissions = friction.commissionPerTrade;
        const spreadPaid = roundDec(friction.spreadPoints * pos.units, 2);
        const entrySlippage = friction.slippagePoints;
        const slippageCostDollars = roundDec((entrySlippage + exitSlippage) * pos.units, 2);

        const totalTradeFriction = commissions + spreadPaid + slippageCostDollars;
        const grossPnL = roundDec(idealGrossPnL, 2);
        const netPnL = roundDec(idealGrossPnL - totalTradeFriction, 2);
        const rMultiple = roundDec(netPnL / pos.plannedRiskDollars, 2);

        trades.push({
          id: `BT-${trades.length + 1}`,
          entryIndex: pos.entryIndex,
          exitIndex: i,
          entryDate: pos.entryDate,
          exitDate: currentBar.timestamp,
          symbol: currentBar.symbol,
          direction: pos.direction,
          rawEntryPrice: pos.rawEntryPrice,
          fillEntryPrice: pos.fillEntryPrice,
          rawExitPrice: roundDec(rawExitPrice, 5),
          fillExitPrice: roundDec(fillExitPrice, 5),
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          units: pos.units,
          holdingBars: pos.holdingBars,
          exitReason,
          grossPnL,
          commissions: roundDec(commissions, 2),
          slippageCostDollars,
          commissionPaid: commissions,
          spreadPaid,
          entrySlippage,
          exitSlippage,
          netPnL,
          rMultiple,
          plannedRiskDollars: pos.plannedRiskDollars,
          partition: pos.entryIndex < splitIndex ? 'IN_SAMPLE' : 'OUT_OF_SAMPLE',
          isSamplePartition: pos.entryIndex < splitIndex ? 'IN_SAMPLE' : 'OUT_OF_SAMPLE',
          regime: pos.regime,
          session: pos.session
        });

        inPosition = false;
        currentPosition = null;
      }
      continue;
    }

    // Evaluate Entry Condition on current bar close
    const evalResult = evaluateBarEntryCondition(currentBar, prevBar, strategy.entryRules, strategy.direction);

    if (evalResult.isSignal && i < bars.length - 1) {
      const nextBar = bars[i + 1];
      const atr = currentBar.atr14 || (currentBar.high - currentBar.low);
      const riskDistance = atr * (riskRules.stopLossAtrMultiple || 1.2);
      const isLong = evalResult.direction === 'LONG';

      if (riskDistance > 0) {
        const rawEntryPrice = nextBar.open;
        let fillEntryPrice;
        let stopLoss;
        let takeProfit;

        if (isLong) {
          fillEntryPrice = rawEntryPrice + (friction.spreadPoints / 2) + friction.slippagePoints;
          stopLoss = rawEntryPrice - riskDistance;
          takeProfit = rawEntryPrice + (riskDistance * (riskRules.takeProfitRMultiple || 1.8));
        } else {
          fillEntryPrice = rawEntryPrice - (friction.spreadPoints / 2) - friction.slippagePoints;
          stopLoss = rawEntryPrice + riskDistance;
          takeProfit = rawEntryPrice - (riskDistance * (riskRules.takeProfitRMultiple || 1.8));
        }

        const plannedRiskDollars = riskRules.riskPerTradeDollars || 200;
        const units = Math.max(1, Math.floor(plannedRiskDollars / riskDistance));

        currentPosition = {
          entryIndex: i + 1,
          entryDate: nextBar.timestamp,
          direction: evalResult.direction,
          rawEntryPrice: roundDec(rawEntryPrice, 5),
          fillEntryPrice: roundDec(fillEntryPrice, 5),
          initialRiskDistance: riskDistance,
          stopLoss: roundDec(stopLoss, 5),
          takeProfit: roundDec(takeProfit, 5),
          units,
          plannedRiskDollars,
          holdingBars: 0,
          regime: nextBar.regime,
          session: nextBar.session,
          breakEvenAtR: riskRules.breakEvenAtR,
          isStopAtBreakEven: false
        };
        inPosition = true;
      }
    }
  }

  // Partition trades into In-Sample (Development) and Out-of-Sample (Validation)
  const inSampleTrades = trades.filter(t => t.isSamplePartition === 'IN_SAMPLE');
  const outOfSampleTrades = trades.filter(t => t.isSamplePartition === 'OUT_OF_SAMPLE');

  const inSampleMetrics = calculateLabCohortMetrics(inSampleTrades);
  const outOfSampleMetrics = calculateLabCohortMetrics(outOfSampleTrades);
  const totalMetrics = calculateLabCohortMetrics(trades);

  // Uncertainty Analysis (Confidence intervals and losing streaks)
  const uncertainty = calculateUncertaintyMetrics(trades);

  // Performance by Market Regime
  const regimeBreakdown = calculateRegimeBreakdown(trades);

  // Friction Impact Analysis
  const frictionAudit = calculateFrictionAudit(trades);

  // Edge Durability Scorecard
  const edgeScorecard = evaluateEdgeDurability({
    inSample: inSampleMetrics,
    outOfSample: outOfSampleMetrics,
    total: totalMetrics,
    uncertainty,
    frictionAudit,
    regimeBreakdown
  });

  // Edge Degradation / Overfit Decay Metrics
  const winRateDelta = roundDec((outOfSampleMetrics.winRate || 0) - (inSampleMetrics.winRate || 0), 1);
  const isAvgR = inSampleMetrics.averageR || 0;
  const oosAvgR = outOfSampleMetrics.averageR || 0;
  const averageRDecayPercent = isAvgR > 0 ? roundDec(((isAvgR - oosAvgR) / isAvgR) * 100, 1) : 0;
  const isPF = inSampleMetrics.profitFactor || 0;
  const oosPF = outOfSampleMetrics.profitFactor || 0;
  const profitFactorDecayPercent = isPF > 0 ? roundDec(((isPF - oosPF) / isPF) * 100, 1) : 0;
  const drawdownExpansionPercent = roundDec((outOfSampleMetrics.maxDrawdownPercent || 0) - (inSampleMetrics.maxDrawdownPercent || 0), 1);

  let overfitHazard = 'LOW';
  if (averageRDecayPercent > 60 || winRateDelta < -15 || oosAvgR <= 0) {
    overfitHazard = 'HIGH';
  } else if (averageRDecayPercent > 30 || winRateDelta < -7) {
    overfitHazard = 'MODERATE';
  }

  const decay = {
    winRateDelta,
    averageRDecayPercent,
    profitFactorDecayPercent,
    drawdownExpansionPercent,
    overfitHazard
  };

  return {
    strategy,
    barCount: bars.length,
    splitIndex,
    splitDate: bars[splitIndex]?.timestamp || '',
    inSample: inSampleMetrics,
    outOfSample: outOfSampleMetrics,
    total: totalMetrics,
    decay,
    uncertainty,
    regimeBreakdown,
    frictionAudit,
    edgeScorecard,
    durability: edgeScorecard,
    trades
  };
}

/**
 * Calculates core metrics for a cohort of research backtest trades.
 */
export function calculateLabCohortMetrics(trades = []) {
  if (!trades || trades.length === 0) {
    return {
      tradeCount: 0,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      netPnL: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      averageR: 0,
      expectancyDollars: 0,
      maxDrawdownDollars: 0,
      maxDrawdownPercent: 0,
      maxLosingStreak: 0,
      recoveryFactor: 0
    };
  }

  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netPnL = 0;
  let totalR = 0;

  let currentStreak = 0;
  let maxLosingStreak = 0;

  let runningEquity = 10000;
  let peakEquity = 10000;
  let maxDrawdownDollars = 0;
  let maxDrawdownPercent = 0;

  trades.forEach(t => {
    const pnl = t.netPnL || 0;
    netPnL += pnl;
    totalR += (t.rMultiple || 0);

    runningEquity += pnl;
    if (runningEquity > peakEquity) {
      peakEquity = runningEquity;
    }
    const currentDd = peakEquity - runningEquity;
    if (currentDd > maxDrawdownDollars) {
      maxDrawdownDollars = currentDd;
      maxDrawdownPercent = peakEquity > 0 ? (currentDd / peakEquity) * 100 : 0;
    }

    if (pnl > 0.01) {
      wins++;
      grossProfit += pnl;
      currentStreak = 0;
    } else if (pnl < -0.01) {
      losses++;
      grossLoss += Math.abs(pnl);
      currentStreak++;
      if (currentStreak > maxLosingStreak) maxLosingStreak = currentStreak;
    } else {
      breakevens++;
      currentStreak = 0;
    }
  });

  const tradeCount = trades.length;
  const winRate = tradeCount > 0 ? Math.round((wins / tradeCount) * 1000) / 10 : 0;
  const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : (grossProfit > 0 ? 99 : 0);
  const averageR = tradeCount > 0 ? Math.round((totalR / tradeCount) * 100) / 100 : 0;
  const expectancyDollars = tradeCount > 0 ? Math.round((netPnL / tradeCount) * 100) / 100 : 0;
  const recoveryFactor = maxDrawdownDollars > 0 ? Math.round((netPnL / maxDrawdownDollars) * 100) / 100 : netPnL > 0 ? 10 : 0;

  return {
    tradeCount,
    totalTrades: tradeCount,
    wins,
    losses,
    breakevens,
    winRate,
    netPnL: roundDec(netPnL, 2),
    grossProfit: roundDec(grossProfit, 2),
    grossLoss: roundDec(grossLoss, 2),
    profitFactor,
    averageR,
    expectancyDollars,
    maxDrawdownDollars: roundDec(maxDrawdownDollars, 2),
    maxDrawdownPercent: roundDec(maxDrawdownPercent, 1),
    maxLosingStreak,
    recoveryFactor
  };
}

/**
 * Calculates Wilson 95% confidence intervals, theoretical streaks, and Monte Carlo resampling.
 */
export function calculateUncertaintyMetrics(trades = []) {
  const n = trades.length;
  if (n === 0) {
    const emptyCI = { lower: 0, upper: 0, margin: 0, formatted: '[0% - 0%]' };
    const emptyExp = { lower: 0, upper: 0, mean: 0, formatted: '[0R to 0R]' };
    const emptyMC = { iterations: 500, p5Equity: 10000, p50Equity: 10000, p95Equity: 10000, p5OutcomeDollars: 0, p50OutcomeDollars: 0, p95OutcomeDollars: 0, riskOfRuinPercent: 0, ruinRiskPercent: 0 };
    return {
      sampleSize: 0,
      sampleViability: 'LOW_SAMPLE_HAZARD',
      winRateCi95: emptyCI,
      winRateWilsonCI: emptyCI,
      expectancyRCi95: emptyExp,
      expectancy95CI: emptyExp,
      theoreticalMaxStreak: 0,
      theoreticalMaxLossStreak: 0,
      observedMaxStreak: 0,
      observedMaxLossStreak: 0,
      streakProbabilities: { p3: 0, p4: 0, p5: 0, p6: 0 },
      monteCarlo: emptyMC,
      monteCarloResampling: emptyMC
    };
  }

  const wins = trades.filter(t => (t.netPnL || 0) > 0).length;
  const p = wins / n;
  const z = 1.96; // 95% confidence z-score

  // 1. Wilson Score Interval for Win Rate
  const denominator = 1 + (z * z) / n;
  const centerAdjusted = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  const lowerWinRate = Math.max(0, (centerAdjusted - spread) / denominator) * 100;
  const upperWinRate = Math.min(1, (centerAdjusted + spread) / denominator) * 100;

  // 2. Expectancy R 95% Confidence Interval
  const rMultiples = trades.map(t => t.rMultiple || 0);
  const meanR = rMultiples.reduce((sum, r) => sum + r, 0) / n;
  const varianceR = rMultiples.reduce((sum, r) => sum + Math.pow(r - meanR, 2), 0) / Math.max(1, n - 1);
  const stdErrorR = Math.sqrt(varianceR / n);
  const lowerExpectancyR = roundDec(meanR - (z * stdErrorR), 2);
  const upperExpectancyR = roundDec(meanR + (z * stdErrorR), 2);

  // 3. Observed vs Theoretical Losing Streak
  let curStreak = 0;
  let observedMaxStreak = 0;
  trades.forEach(t => {
    if ((t.netPnL || 0) < 0) {
      curStreak++;
      if (curStreak > observedMaxStreak) observedMaxStreak = curStreak;
    } else {
      curStreak = 0;
    }
  });

  const lossProb = Math.max(0.01, 1 - p);
  const theoreticalMaxStreak = lossProb < 1 && lossProb > 0
    ? Math.round((Math.log(n) / Math.log(1 / lossProb)) * 10) / 10
    : 0;

  // Probability of losing streaks over 100 trades
  const p3 = Math.round((1 - Math.pow(1 - Math.pow(lossProb, 3), 100)) * 100);
  const p4 = Math.round((1 - Math.pow(1 - Math.pow(lossProb, 4), 100)) * 100);
  const p5 = Math.round((1 - Math.pow(1 - Math.pow(lossProb, 5), 100)) * 100);
  const p6 = Math.round((1 - Math.pow(1 - Math.pow(lossProb, 6), 100)) * 100);

  // 4. Monte Carlo Bootstrap Resampling (500 paths)
  const mcIterations = 500;
  const finalEquities = [];
  let ruinCount = 0;

  for (let iter = 0; iter < mcIterations; iter++) {
    let eq = 10000;
    let peak = 10000;
    let ruined = false;

    for (let s = 0; s < n; s++) {
      const randomTrade = trades[Math.floor(Math.random() * n)];
      eq += (randomTrade.netPnL || 0);
      if (eq > peak) peak = eq;
      if (peak - eq >= 2000) ruined = true;
    }

    if (ruined) ruinCount++;
    finalEquities.push(eq);
  }

  finalEquities.sort((a, b) => a - b);
  const p5Index = Math.floor(mcIterations * 0.05);
  const p50Index = Math.floor(mcIterations * 0.50);
  const p95Index = Math.floor(mcIterations * 0.95);

  const winRateWilsonCI = {
    lower: roundDec(lowerWinRate, 1),
    upper: roundDec(upperWinRate, 1),
    margin: roundDec((upperWinRate - lowerWinRate) / 2, 1),
    formatted: `[${roundDec(lowerWinRate, 1)}% - ${roundDec(upperWinRate, 1)}%]`
  };

  const expectancy95CI = {
    lower: lowerExpectancyR,
    upper: upperExpectancyR,
    mean: roundDec(meanR, 2),
    formatted: `[${lowerExpectancyR >= 0 ? '+' : ''}${lowerExpectancyR}R to ${upperExpectancyR >= 0 ? '+' : ''}${upperExpectancyR}R]`
  };

  const monteCarloResampling = {
    iterations: mcIterations,
    p5Equity: roundDec(finalEquities[p5Index] || 10000, 2),
    p50Equity: roundDec(finalEquities[p50Index] || 10000, 2),
    p95Equity: roundDec(finalEquities[p95Index] || 10000, 2),
    p5OutcomeDollars: roundDec((finalEquities[p5Index] || 10000) - 10000, 2),
    p50OutcomeDollars: roundDec((finalEquities[p50Index] || 10000) - 10000, 2),
    p95OutcomeDollars: roundDec((finalEquities[p95Index] || 10000) - 10000, 2),
    ruinRiskPercent: Math.round((ruinCount / mcIterations) * 1000) / 10,
    riskOfRuinPercent: Math.round((ruinCount / mcIterations) * 1000) / 10
  };

  return {
    sampleSize: n,
    sampleViability: n >= 30 ? 'VALID_SAMPLE' : 'LOW_SAMPLE_HAZARD',
    winRateCi95: winRateWilsonCI,
    winRateWilsonCI,
    expectancyRCi95: expectancy95CI,
    expectancy95CI,
    theoreticalMaxStreak,
    theoreticalMaxLossStreak: theoreticalMaxStreak,
    observedMaxStreak,
    observedMaxLossStreak: observedMaxStreak,
    streakProbabilities: {
      p3: Math.max(0, Math.min(100, p3)),
      p4: Math.max(0, Math.min(100, p4)),
      p5: Math.max(0, Math.min(100, p5)),
      p6: Math.max(0, Math.min(100, p6))
    },
    monteCarlo: monteCarloResampling,
    monteCarloResampling
  };
}

/**
 * Breaks down strategy performance across market regimes.
 */
export function calculateRegimeBreakdown(trades = []) {
  const regimes = [
    MARKET_REGIMES.BULL_TREND,
    MARKET_REGIMES.BEAR_TREND,
    MARKET_REGIMES.CHOP_RANGE,
    MARKET_REGIMES.HIGH_VOLATILITY
  ];

  const list = regimes.map(regime => {
    const cohort = trades.filter(t => t.regime === regime);
    const metrics = calculateLabCohortMetrics(cohort);
    let resilience = 'ROBUST';
    if (metrics.tradeCount > 0 && metrics.netPnL < 0) {
      resilience = 'FRAGILE';
    } else if (metrics.tradeCount === 0 || metrics.averageR < 0.2) {
      resilience = 'MODERATE';
    }
    return {
      regime,
      barsCount: 0,
      tradesCount: metrics.tradeCount,
      tradeCount: metrics.tradeCount,
      winRate: metrics.winRate,
      netPnL: metrics.netPnL,
      averageR: metrics.averageR,
      profitFactor: metrics.profitFactor,
      resilience
    };
  });

  list.forEach(item => {
    list[item.regime] = item;
  });

  return list;
}

/**
 * Quantifies the toll of spread, commissions, and realistic slippage.
 */
export function calculateFrictionAudit(trades = []) {
  const grossProfitDollars = roundDec(trades.reduce((sum, t) => sum + (t.grossPnL || 0), 0), 2);
  const totalCommissionsPaid = roundDec(trades.reduce((sum, t) => sum + (t.commissions || t.commissionPaid || 0), 0), 2);
  const totalSpreadCostDollars = roundDec(trades.reduce((sum, t) => sum + (t.spreadPaid || 0), 0), 2);
  const totalSlippageCostDollars = roundDec(trades.reduce((sum, t) => sum + (t.slippageCostDollars || 0), 0), 2);
  const netProfitDollars = roundDec(trades.reduce((sum, t) => sum + (t.netPnL || 0), 0), 2);

  const totalFrictionDollars = roundDec(totalCommissionsPaid + totalSpreadCostDollars + totalSlippageCostDollars, 2);
  const frictionDragPercent = grossProfitDollars > 0
    ? roundDec((totalFrictionDollars / grossProfitDollars) * 100, 1)
    : 0;

  return {
    grossProfitDollars,
    totalGrossPnL: grossProfitDollars,
    totalCommissionsPaid,
    totalCommissions: totalCommissionsPaid,
    totalSpreadCostDollars,
    totalSlippageCostDollars,
    totalSlippageCost: totalSlippageCostDollars,
    totalFrictionDollars,
    totalFriction: totalFrictionDollars,
    netProfitDollars,
    totalNetPnL: netProfitDollars,
    frictionDragPercent
  };
}

/**
 * Evaluates whether backtest performance represents a durable live edge or fragile curve-fit.
 */
export function evaluateEdgeDurability({
  inSample,
  outOfSample,
  total,
  uncertainty,
  frictionAudit,
  regimeBreakdown
}) {
  let score = 0;
  const deductions = [];
  const strengths = [];

  // 1. Sample Size Adequacy (Max 25 pts)
  if (total.tradeCount >= 20) {
    score += 25;
    strengths.push(`Adequate research sample size (${total.tradeCount} trades evaluated).`);
  } else if (total.tradeCount >= 10) {
    score += 15;
    deductions.push(`Marginal sample size (${total.tradeCount} trades). Small sample increases risk of variance illusions.`);
  } else {
    score += 5;
    deductions.push(`Insufficient trade count (${total.tradeCount} trades). Results are statistically unrepresentative.`);
  }

  // 2. Out-of-Sample Performance Retention (Max 25 pts)
  const isExp = inSample.averageR || 0;
  const oosExp = outOfSample.averageR || 0;

  if (outOfSample.tradeCount === 0) {
    deductions.push('No out-of-sample data evaluated. Edge verification incomplete.');
  } else if (oosExp > 0 && isExp > 0) {
    const retentionRatio = oosExp / isExp;
    if (retentionRatio >= 0.70) {
      score += 25;
      strengths.push(`Strong OOS retention: Out-of-sample Expectancy (${oosExp}R) retained ${Math.round(retentionRatio * 100)}% of In-Sample (${isExp}R).`);
    } else if (retentionRatio >= 0.40) {
      score += 15;
      deductions.push(`Moderate OOS decay: Out-of-sample Expectancy dropped to ${Math.round(retentionRatio * 100)}% of In-Sample.`);
    } else {
      score += 4;
      deductions.push(`Severe curve-fitting detected: OOS Expectancy collapsed to ${Math.round(retentionRatio * 100)}% of In-Sample.`);
    }
  } else if (oosExp <= 0 && isExp > 0) {
    score += 0;
    deductions.push(`Negative Out-of-Sample Expectancy (${oosExp}R vs. In-Sample ${isExp}R). Strategy failed validation.`);
  } else {
    score += 0;
    deductions.push('Negative expectancy in both In-Sample and Out-of-Sample periods.');
  }

  // 3. Friction Resilience & Execution Survival (Max 20 pts)
  if (frictionAudit.frictionDragPercent < 25 && total.netPnL > 0) {
    score += 20;
    strengths.push(`High friction resilience: Commissions and slippage consumed only ${frictionAudit.frictionDragPercent}% of gross profits.`);
  } else if (frictionAudit.frictionDragPercent < 45 && total.netPnL > 0) {
    score += 12;
    deductions.push(`Significant friction sensitivity: Friction consumed ${frictionAudit.frictionDragPercent}% of gross profits.`);
  } else {
    score += 2;
    deductions.push(`Vulnerable to execution costs: Friction consumed ${frictionAudit.frictionDragPercent}% of gross profits or net PnL is negative.`);
  }

  // 4. Multi-Regime Versatility (Max 15 pts)
  const profitableRegimes = regimeBreakdown.filter(r => r.netPnL > 0 && r.tradeCount >= 1);
  if (profitableRegimes.length >= 3) {
    score += 15;
    strengths.push(`Broad regime versatility: Strategy produced positive net return in ${profitableRegimes.length} different market conditions.`);
  } else if (profitableRegimes.length >= 2) {
    score += 10;
    strengths.push(`Survives multiple regimes: Profitable in ${profitableRegimes.length} market conditions.`);
  } else {
    score += 3;
    deductions.push('One-regime dependent: Fails to produce positive returns across varying market conditions.');
  }

  // 5. Drawdown & Recovery Resilience (Max 15 pts)
  if (total.recoveryFactor >= 1.5 && total.maxDrawdownPercent < 15) {
    score += 15;
    strengths.push(`Solid recovery factor (${total.recoveryFactor}x) with controlled max drawdown (${total.maxDrawdownPercent}%).`);
  } else if (total.recoveryFactor >= 0.8 && total.maxDrawdownPercent < 25) {
    score += 8;
  } else {
    score += 2;
    deductions.push(`Deep drawdown profile (${total.maxDrawdownPercent}%) relative to net profits.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict = 'DURABLE_EDGE';
  let badgeLabel = 'DURABLE EDGE (RESEARCH READY)';
  let verdictClass = 'stamp-clean';
  let warningNote = null;

  if (score >= 70 && outOfSample.averageR > 0) {
    verdict = 'DURABLE_EDGE';
    badgeLabel = 'DURABLE EDGE (RESEARCH READY) ✓';
    verdictClass = 'stamp-clean';
  } else if (score >= 50) {
    verdict = 'MODERATE_EDGE';
    badgeLabel = 'MODERATE / CONDITIONAL EDGE ⚠';
    verdictClass = 'stamp-warn';
    warningNote = 'This setup demonstrates potential but shows notable sensitivity to market regimes or execution slippage. Exercise caution.';
  } else if (score >= 30) {
    verdict = 'FRAGILE_OVERFIT';
    badgeLabel = 'FRAGILE / HIGH OVERFIT RISK ✗';
    verdictClass = 'stamp-danger';
    warningNote = 'Severe degradation between In-Sample and Out-of-Sample results. This backtest likely reflects curve-fitting rather than an enduring edge.';
  } else {
    verdict = 'NO_EDGE';
    badgeLabel = 'NO DURABLE EDGE / FAILED ✗';
    verdictClass = 'stamp-danger';
    warningNote = 'Strategy fails basic viability benchmarks after commissions, spread, and realistic fill slippage.';
  }

  return {
    score,
    verdict,
    badgeLabel,
    verdictClass,
    warningNote,
    strengths,
    deductions
  };
}

/**
 * Runs a 2x friction stress test to verify if profits evaporate when market liquidity thins.
 */
export function runFrictionStressTest(bars = [], strategy = RESEARCH_PRESETS.TREND_PULLBACK_CONFLUENCE) {
  const stressStrategy = {
    ...strategy,
    friction: {
      ...strategy.friction,
      commissionPerTrade: (strategy.friction?.commissionPerTrade || 3.50) * 1.5,
      spreadPoints: (strategy.friction?.spreadPoints || 0.00015) * 2.0,
      slippagePoints: (strategy.friction?.slippagePoints || 0.00010) * 2.0,
      gapSlippageMultiplier: (strategy.friction?.gapSlippageMultiplier || 1.5) * 1.5
    }
  };

  const normalBacktest = runStrategyBacktest(bars, strategy);
  const stressedBacktest = runStrategyBacktest(bars, stressStrategy);

  const normalPnL = normalBacktest.total?.netPnL || 0;
  const stressedPnL = stressedBacktest.total?.netPnL || 0;
  const pnlDecayDollars = roundDec(normalPnL - stressedPnL, 2);
  const pnlDecayPercent = normalPnL > 0 ? roundDec((pnlDecayDollars / normalPnL) * 100, 1) : 100;
  const survivesStress = stressedPnL > 0;

  return {
    normalNetPnL: normalPnL,
    stressedNetPnL: stressedPnL,
    pnlDecayDollars,
    pnlDecayPercent,
    survivesStress
  };
}
