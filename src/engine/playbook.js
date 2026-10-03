/**
 * Ledger & Wick — Interactive Trading Playbook & Counterfactual Equity Engine
 * 
 * Provides:
 * 1. Pre-Flight Confluence Criteria evaluation for A+ Setups
 * 2. Counterfactual "Discipline vs. Impulse" Equity Curve splitting
 * 3. Playbook Purity Scoring and Discipline Edge Dollar quantification
 * 4. Session Killzone Edge & Time-of-Day Heatmap analytics
 */

export const DEFAULT_PLAYBOOK_SETUPS = {
  BREAKOUT_RETEST: {
    id: 'BREAKOUT_RETEST',
    name: 'Breakout & Structural Retest',
    timeframes: ['1H', '15M', '5M'],
    minRewardRisk: 2.0,
    criteria: [
      { id: 'HTF_TREND', label: 'Higher Timeframe Trend Alignment (Daily/4H direction matches trade)' },
      { id: 'LEVEL_ESTABLISHED', label: 'Key S/R or Consolidation Boundary clearly defined' },
      { id: 'CLEAN_BREAKOUT', label: 'Clear momentum candle body closes beyond structural level' },
      { id: 'RETEST_REJECTION', label: 'Retest candle confirms rejection (Pin bar, engulfing, wick rejection)' },
      { id: 'MIN_RR_2', label: 'Minimum 1:2.0 Reward-to-Risk potential to next trouble area' }
    ],
    description: 'Trading the retest of a broken structural resistance or support level with clear rejection confirmation.'
  },
  LIQUIDITY_SWEEP: {
    id: 'LIQUIDITY_SWEEP',
    name: 'Liquidity Sweep & Wick Reversal',
    timeframes: ['15M', '5M', '1M'],
    minRewardRisk: 2.5,
    criteria: [
      { id: 'EQUAL_HIGHS_LOWS', label: 'Obvious pool of liquidity (equal highs/lows or Asian/PDH/PDL)' },
      { id: 'AGGRESSIVE_SWEEP', label: 'Fast spike piercing beyond level to trigger stops' },
      { id: 'RAPID_DISPLACEMENT', label: 'Rapid price displacement and close back inside original range' },
      { id: 'STRUCTURE_SHIFT', label: 'Micro market structure shift (BOS on execution timeframe)' },
      { id: 'MIN_RR_25', label: 'Minimum 1:2.5 Reward-to-Risk potential' }
    ],
    description: 'Fading a false breakout that swept liquidity above/below key extremes followed by rapid displacement.'
  },
  TREND_PULLBACK: {
    id: 'TREND_PULLBACK',
    name: 'Trend Continuation Pullback',
    timeframes: ['4H', '1H', '15M'],
    minRewardRisk: 2.0,
    criteria: [
      { id: 'ESTABLISHED_TREND', label: 'Clear sequence of higher highs/lows or lower highs/lows' },
      { id: 'VALUE_RETRACEMENT', label: 'Pullback into key value area (50-61.8% Fib, EMA, or prior structure)' },
      { id: 'TRIGGER_CANDLE', label: 'Bullish/bearish reversal candle close confirming resumption' },
      { id: 'INVALIDATION_DEFINED', label: 'Stop placed logically beyond recent swing pivot' }
    ],
    description: 'Joining an established market trend on a discount or premium retracement.'
  },
  GOLD_OTE_15M: {
    id: 'GOLD_OTE_15M',
    name: 'Gold OTE Continuation (D/4H to 15M)',
    timeframes: ['1D', '4H', '15M'],
    minRewardRisk: 2.0,
    criteria: [
      { id: 'GOLD15_DAILY_BIAS', label: 'Daily structure supports the trade direction; mark prior day high and low' },
      { id: 'GOLD15_4H_BOS', label: '4H impulse closes beyond a meaningful swing and confirms direction' },
      { id: 'GOLD15_FIB_ANCHORS', label: 'Fib is anchored to the confirmed 4H impulse, not adjusted after the fact' },
      { id: 'GOLD15_OTE_ZONE', label: 'Price retraces into the predefined 62%-79% OTE area' },
      { id: 'GOLD15_PROFILE_CONTEXT', label: 'Zone aligns with a preselected structural or valid completed-profile reference' },
      { id: 'GOLD15_TRIGGER', label: '15M rejection/reclaim or predefined minor structure break closes in trade direction' },
      { id: 'GOLD15_RISK', label: 'Stop is beyond structural invalidation and target offers at least 2R after costs' }
    ],
    description: 'Gold trend-continuation template: Daily context, confirmed 4H impulse and OTE pullback, then a closed 15M trigger. Demo-test profile source, session, costs, and slippage for your instrument.'
  },
  GOLD_TREND_5M: {
    id: 'GOLD_TREND_5M',
    name: 'Gold OTE Intraday (D/1H to 5M)',
    timeframes: ['1D', '1H', '5M'],
    minRewardRisk: 2.0,
    criteria: [
      { id: 'GOLD5_DAILY_CONTEXT', label: 'Daily structure, prior day levels, and scheduled event risk are marked' },
      { id: 'GOLD5_1H_IMPULSE', label: '1H impulse closes beyond a meaningful swing in the planned direction' },
      { id: 'GOLD5_FIB_ANCHORS', label: 'Fib anchors are fixed to the confirmed 1H impulse before entry' },
      { id: 'GOLD5_OTE_ZONE', label: 'Price returns to the premarked 62%-79% retracement zone' },
      { id: 'GOLD5_PROFILE_CONTEXT', label: 'Retracement overlaps a preselected structure or correctly sourced profile level' },
      { id: 'GOLD5_TRIGGER', label: '5M sweep/reclaim and minor structure break close in trade direction' },
      { id: 'GOLD5_RISK', label: 'Stop invalidates the setup; instrument sizing is known and target offers at least 2R net' }
    ],
    description: 'Faster gold continuation template: Daily context, 1H impulse and OTE zone, with a 5M sweep/reclaim plus structure trigger. Higher noise makes strict filters and demo testing essential.'
  },
  DISCRETIONARY: {
    id: 'DISCRETIONARY',
    name: 'Discretionary / Off-Playbook Impulse',
    timeframes: ['Any'],
    minRewardRisk: 1.0,
    criteria: [],
    description: 'Unplanned, intuitive, or reactive trades lacking defined playbook criteria.'
  }
};

/**
 * Evaluates trade confluence against a selected playbook setup.
 * 
 * @param {string} setupId - Playbook setup identifier
 * @param {Array<string>} checkedCriteriaIds - List of checked criterion IDs
 * @param {Object} [customSetups=DEFAULT_PLAYBOOK_SETUPS] - Active playbook setups dictionary
 * @returns {Object} Confluence evaluation results
 */
export function evaluateTradeConfluence(setupId, checkedCriteriaIds = [], customSetups = DEFAULT_PLAYBOOK_SETUPS) {
  const setup = customSetups[setupId] || customSetups.DISCRETIONARY || DEFAULT_PLAYBOOK_SETUPS.DISCRETIONARY;

  if (setupId === 'DISCRETIONARY' || !setup.criteria || setup.criteria.length === 0) {
    return {
      setupId: 'DISCRETIONARY',
      setupName: setup.name,
      confluenceCount: 0,
      totalRequired: 0,
      confluenceScorePercent: 0,
      missingCriteria: [],
      classification: 'OFF_PLAYBOOK',
      isPlaybookCompliant: false,
      inferredViolations: ['UNQUALIFIED_SETUP'],
      guidance: 'Discretionary trade. Lacks structured pre-flight confluence.'
    };
  }

  const totalRequired = setup.criteria.length;
  const checkedSet = new Set(checkedCriteriaIds);
  const checkedList = setup.criteria.filter(c => checkedSet.has(c.id));
  const missingList = setup.criteria.filter(c => !checkedSet.has(c.id));

  const confluenceCount = checkedList.length;
  const confluenceScorePercent = Math.round((confluenceCount / totalRequired) * 100);

  let classification = 'PARTIAL_CONFLUENCE';
  let isPlaybookCompliant = false;
  const inferredViolations = [];

  if (confluenceScorePercent === 100) {
    classification = 'A_PLUS_SETUP';
    isPlaybookCompliant = true;
  } else if (confluenceScorePercent >= 75) {
    classification = 'PLAYBOOK_VALID';
    isPlaybookCompliant = true;
  } else {
    classification = 'OFF_PLAYBOOK';
    isPlaybookCompliant = false;
    inferredViolations.push('UNQUALIFIED_SETUP');
  }

  let guidance = 'All pre-flight confluence criteria verified. High quality execution candidate.';
  if (missingList.length > 0) {
    const missingNames = missingList.map(m => m.label.split('(')[0].trim()).join(', ');
    guidance = `Missing ${missingList.length} criteria: ${missingNames}. Taking this trade introduces execution noise.`;
  }

  return {
    setupId,
    setupName: setup.name,
    confluenceCount,
    totalRequired,
    confluenceScorePercent,
    checkedCriteria: checkedList,
    missingCriteria: missingList,
    classification,
    isPlaybookCompliant,
    inferredViolations,
    guidance
  };
}

/**
 * Calculates counterfactual equity curves and separates Disciplined vs Impulsive performance.
 * 
 * @param {Array} trades - List of executed trades sorted chronologically
 * @param {number} [startingBalance=10000] - Baseline capital
 * @returns {Object} Counterfactual metrics, curves, and discipline delta
 */
export function calculateCounterfactualEquitySplit(trades = [], startingBalance = 10000) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      playbookTradesCount: 0,
      impulseTradesCount: 0,
      playbookPurityPercent: 100,
      playbookMetrics: { netPnL: 0, winRate: 0, profitFactor: 0, totalR: 0 },
      impulseMetrics: { netPnL: 0, winRate: 0, profitFactor: 0, totalR: 0 },
      totalRealizedPnL: 0,
      disciplineEdgeDollars: 0,
      disciplineEdgeR: 0,
      equitySeries: [],
      insightMessage: 'No trades logged yet to calculate counterfactual edge.'
    };
  }

  const sortedTrades = [...trades].sort((a, b) => new Date(a.entryDate || 0) - new Date(b.entryDate || 0));

  const playbookTrades = [];
  const impulseTrades = [];

  // Categorize trades
  sortedTrades.forEach(t => {
    // If trade has confluence score, use it; otherwise check setupId and violations
    const isCompliant = (t.confluence && t.confluence.isPlaybookCompliant)
      || (t.isPlaybookCompliant === true)
      || (t.setupId && t.setupId !== 'DISCRETIONARY' && !t.violations?.includes('UNQUALIFIED_SETUP'));

    if (isCompliant) {
      playbookTrades.push(t);
    } else {
      impulseTrades.push(t);
    }
  });

  const calcGroupStats = (group) => {
    const count = group.length;
    if (count === 0) {
      return { count: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0, grossProfit: 0, grossLoss: 0, profitFactor: 0, totalR: 0, avgR: 0 };
    }
    let wins = 0;
    let losses = 0;
    let netPnL = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalR = 0;

    group.forEach(t => {
      const pnl = Number(t.netPnL) || 0;
      const r = Number(t.rMultiple) || 0;
      netPnL += pnl;
      totalR += r;
      if (pnl > 0) {
        wins++;
        grossProfit += pnl;
      } else if (pnl < 0) {
        losses++;
        grossLoss += Math.abs(pnl);
      }
    });

    const winRate = Math.round((wins / count) * 100);
    const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : (grossProfit > 0 ? 99 : 0);
    const avgR = Math.round((totalR / count) * 100) / 100;

    return {
      count,
      wins,
      losses,
      winRate,
      netPnL: Math.round(netPnL * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      profitFactor,
      totalR: Math.round(totalR * 100) / 100,
      avgR
    };
  };

  const playbookStats = calcGroupStats(playbookTrades);
  const impulseStats = calcGroupStats(impulseTrades);
  const totalStats = calcGroupStats(sortedTrades);

  // Generate parallel equity curve time-series
  // Curve 1: Realized Total Equity (what actually happened)
  // Curve 2: Playbook Only Equity (if trader had ONLY executed 100% compliant setups)
  // Curve 3: Impulse Equity (cumulative PnL of off-playbook trades)
  let realizedEquity = startingBalance;
  let playbookEquity = startingBalance;
  let impulseCumulative = 0;

  const equitySeries = [{
    tradeIndex: 0,
    date: sortedTrades[0]?.entryDate || new Date().toISOString(),
    realizedEquity,
    playbookEquity,
    impulseCumulative
  }];

  sortedTrades.forEach((t, idx) => {
    const pnl = Number(t.netPnL) || 0;
    realizedEquity += pnl;

    const isCompliant = (t.confluence && t.confluence.isPlaybookCompliant)
      || (t.isPlaybookCompliant === true)
      || (t.setupId && t.setupId !== 'DISCRETIONARY' && !t.violations?.includes('UNQUALIFIED_SETUP'));

    if (isCompliant) {
      playbookEquity += pnl;
    } else {
      impulseCumulative += pnl;
    }

    equitySeries.push({
      tradeIndex: idx + 1,
      id: t.id,
      symbol: t.symbol,
      date: t.entryDate,
      isCompliant,
      pnl,
      realizedEquity: Math.round(realizedEquity * 100) / 100,
      playbookEquity: Math.round(playbookEquity * 100) / 100,
      impulseCumulative: Math.round(impulseCumulative * 100) / 100
    });
  });

  const playbookPurityPercent = Math.round((playbookTrades.length / sortedTrades.length) * 100);
  // Discipline Edge Delta: How much better would the account be without impulse trades
  const disciplineEdgeDollars = Math.round((playbookStats.netPnL - totalStats.netPnL) * 100) / 100;
  const disciplineEdgeR = Math.round((playbookStats.totalR - totalStats.totalR) * 100) / 100;

  let insightMessage = '';
  if (impulseStats.netPnL < 0 && playbookStats.netPnL > 0) {
    insightMessage = `Mathematical Proof: Your Playbook is profitable (+${playbookStats.totalR}R / +$${playbookStats.netPnL}), but off-playbook impulse trades caused -$${Math.abs(impulseStats.netPnL)} in leaks. Eliminate discretionary entries to unlock immediate profitability.`;
  } else if (disciplineEdgeDollars > 0) {
    insightMessage = `Discipline Edge: Filtering out off-playbook trades would boost your net profits by +$${disciplineEdgeDollars} (+${disciplineEdgeR}R).`;
  } else {
    insightMessage = `Strong execution: Playbook purity is high (${playbookPurityPercent}%). Continue adhering to defined confluence.`;
  }

  return {
    totalTrades: sortedTrades.length,
    playbookTradesCount: playbookTrades.length,
    impulseTradesCount: impulseTrades.length,
    playbookPurityPercent,
    playbookStats,
    impulseStats,
    totalStats,
    disciplineEdgeDollars,
    disciplineEdgeR,
    equitySeries,
    insightMessage
  };
}

/**
 * Classifies a trade timestamp into market session killzones.
 * 
 * @param {string|Date} timestamp - ISO timestamp string or Date object
 * @returns {Object} Killzone session information
 */
export function classifyTradeKillzone(timestamp) {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) {
    return { id: 'UNKNOWN', name: 'Unknown Session', isHighEdge: false };
  }

  // Use UTC hours for standardized timezone calculation
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const timeVal = hour + (minute / 60);

  // 1. London Open: 07:00 - 10:00 UTC (02:00 - 05:00 EST)
  if (timeVal >= 7.0 && timeVal < 10.0) {
    return { id: 'LONDON_OPEN', name: 'London Open (02:00 - 05:00 EST)', isHighEdge: true, tag: 'HIGH_VOLUME' };
  }
  // 2. NY Open Killzone: 13:30 - 16:00 UTC (09:30 - 12:00 EST)
  if (timeVal >= 13.5 && timeVal < 16.0) {
    return { id: 'NY_OPEN', name: 'New York Morning Open (09:30 - 12:00 EST)', isHighEdge: true, tag: 'PRIME_EDGE' };
  }
  // 3. Lunch Chop Doldrums: 16:00 - 18:00 UTC (12:00 - 14:00 EST)
  if (timeVal >= 16.0 && timeVal < 18.0) {
    return { id: 'LUNCH_CHOP', name: 'Mid-Day Lunch Chop (12:00 - 14:00 EST)', isHighEdge: false, tag: 'DANGER_CHOP' };
  }
  // 4. NY Afternoon Close: 18:00 - 20:30 UTC (14:00 - 16:30 EST)
  if (timeVal >= 18.0 && timeVal < 20.5) {
    return { id: 'NY_AFTERNOON', name: 'New York Afternoon Session (14:00 - 16:30 EST)', isHighEdge: true, tag: 'TREND_EXPANSION' };
  }
  // 5. Asian Session: 00:00 - 06:00 UTC (19:00 - 01:00 EST)
  if (timeVal >= 0 && timeVal < 6.0) {
    return { id: 'ASIAN_RANGE', name: 'Asian Consolidation Range (19:00 - 01:00 EST)', isHighEdge: false, tag: 'CONSOLIDATION' };
  }

  return { id: 'OFF_HOURS', name: 'Off-Hours / Inter-Session Lull', isHighEdge: false, tag: 'LOW_LIQUIDITY' };
}

/**
 * Calculates performance grouped by market session killzones.
 * 
 * @param {Array} trades - List of executed trades
 * @returns {Array<Object>} Killzone performance metrics
 */
export function calculateSessionKillzoneMetrics(trades = []) {
  const sessionMap = {
    NY_OPEN: { id: 'NY_OPEN', name: 'New York Morning Open', window: '09:30 - 12:00 EST', tag: 'PRIME_EDGE', trades: [] },
    LONDON_OPEN: { id: 'LONDON_OPEN', name: 'London Open', window: '02:00 - 05:00 EST', tag: 'HIGH_VOLUME', trades: [] },
    LUNCH_CHOP: { id: 'LUNCH_CHOP', name: 'Mid-Day Lunch Chop', window: '12:00 - 14:00 EST', tag: 'DANGER_CHOP', trades: [] },
    NY_AFTERNOON: { id: 'NY_AFTERNOON', name: 'New York Afternoon', window: '14:00 - 16:30 EST', tag: 'EXPANSION', trades: [] },
    ASIAN_RANGE: { id: 'ASIAN_RANGE', name: 'Asian Range', window: '19:00 - 01:00 EST', tag: 'RANGE', trades: [] },
    OFF_HOURS: { id: 'OFF_HOURS', name: 'Off-Hours / Lull', window: 'Various', tag: 'LOW_VOLUME', trades: [] }
  };

  trades.forEach(t => {
    const kz = classifyTradeKillzone(t.entryDate || t.exitDate || new Date());
    const targetSession = sessionMap[kz.id] || sessionMap.OFF_HOURS;
    targetSession.trades.push(t);
  });

  return Object.values(sessionMap).map(s => {
    const count = s.trades.length;
    let wins = 0;
    let netPnL = 0;
    let totalR = 0;

    s.trades.forEach(t => {
      const pnl = Number(t.netPnL) || 0;
      const r = Number(t.rMultiple) || 0;
      netPnL += pnl;
      totalR += r;
      if (pnl > 0) wins++;
    });

    const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;
    const avgR = count > 0 ? Math.round((totalR / count) * 100) / 100 : 0;

    return {
      id: s.id,
      name: s.name,
      window: s.window,
      tag: s.tag,
      tradeCount: count,
      winRate,
      netPnL: Math.round(netPnL * 100) / 100,
      totalR: Math.round(totalR * 100) / 100,
      avgR
    };
  });
}
