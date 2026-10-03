/**
 * Automated Test Suite Runner for Ledger & Wick Trading Journal
 * Includes tests for:
 * 1. Position Sizing Engine
 * 2. Performance Metrics & Drawdown
 * 3. CSV Parsing & Number Normalization
 * 4. Behavioral Leak Detection
 * 5. MAE/MFE Excursion Analytics
 * 6. Personal Trading Contract Circuit Breakers
 * 7. 60-Second Guided Debrief & Discipline Grading
 * 8. Active Tilt Interceptor & Cooldown Lockout
 * 9. Monte Carlo Losing Streak Variance Simulator
 */

import { calculateEquityCryptoSize, calculateForexSize, calculateFuturesSize } from '../src/engine/sizing.js';
import { calculateRMultiple, calculatePerformanceMetrics, calculateDrawdown, groupTradesBy } from '../src/engine/metrics.js';
import { normalizeNumber, normalizeDirection, importTradesFromCSV } from '../src/engine/csv-parser.js';
import { analyzeTradeViolations, calculateLeakDiagnostics } from '../src/engine/leak-detector.js';
import { calculateExcursionR, analyzeExcursionPatterns } from '../src/engine/excursion.js';
import { evaluateCircuitBreaker, DEFAULT_TRADING_CONTRACT } from '../src/engine/contract.js';
import { gradeTradeDebrief, evaluateTiltState } from '../src/engine/debrief-tilt.js';
import { simulateLosingStreakProbabilities } from '../src/engine/simulation.js';
import { 
  DEFAULT_PLAYBOOK_SETUPS, 
  evaluateTradeConfluence, 
  calculateCounterfactualEquitySplit, 
  classifyTradeKillzone, 
  calculateSessionKillzoneMetrics 
} from '../src/engine/playbook.js';
import { 
  PROP_FIRM_PRESETS, 
  calculateDynamicDrawdownBuffer, 
  calculateRunwaySafeRisk, 
  calculateConsistencyMetrics, 
  auditPayoutEligibility 
} from '../src/engine/prop-firm.js';
import { normalizeTradePayload, validateTradePayload } from '../src/engine/validation.js';
import { buildTradeSummaryReport, buildTradeCsvExport } from '../src/engine/reporting.js';
import { createSessionState, saveSessionState, loadSessionState, clearSessionState, isSessionActive, getProfileStorageKey, saveProfileData, loadProfileData, clearProfileData } from '../src/engine/session.js';
import { DEFAULT_PLAN_RULES, DEFAULT_TRADING_PLAN, normalizeTradingPlan, evaluatePlanReadiness, evaluatePlanTradeLimits } from '../src/engine/trading-plan.js';
import { renderCandlestickPatternChart, renderLessonTopicChart } from '../src/engine/lesson-charts.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  totalTests++;
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message} (Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)})`);
  }
}

console.log('================================================================');
console.log('  RUNNING COMPLETE LEDGER & WICK AUTOMATED TEST SUITE');
console.log('================================================================\n');

// 1. POSITION SIZING TESTS
console.log('--- Suite 1: Position Sizing Engine ---');
{
  const eq = calculateEquityCryptoSize(120, 118, 100);
  assertEquals(eq.quantity, 50, 'Equity sizing: 50 shares for $2 stop with $100 risk');
  assertEquals(eq.positionValue, 6000, 'Equity position value = 50 * $120 = $6,000');

  const fx = calculateForexSize('EURUSD', 1.08500, 1.08300, 100);
  assertEquals(fx.pips, 20, 'Forex EURUSD: 20 pips distance');
  assertEquals(fx.lots, 0.5, 'Forex EURUSD: 0.50 lots for 20 pips with $100 risk');

  const fxJpy = calculateForexSize('USDJPY', 150.00, 149.50, 100);
  assertEquals(fxJpy.pips, 50, 'Forex USDJPY: 50 pips distance (0.01 pip size)');

  const futES = calculateFuturesSize('ES', 5000.00, 4995.00, 500);
  assertEquals(futES.ticks, 20, 'Futures ES: 20 ticks stop distance');
  assertEquals(futES.contracts, 2, 'Futures ES: 2 contracts for 20 ticks with $500 risk');

  const futNQ = calculateFuturesSize('NQ', 18000.00, 17980.00, 250);
  assertEquals(futNQ.contracts, 0, 'Futures NQ: 0 contracts when risk budget ($250) < contract risk ($400)');
}

// 2. METRICS & DRAWDOWN TESTS
console.log('\n--- Suite 2: Performance Metrics & Drawdown ---');
{
  assertEquals(calculateRMultiple(250, 100), 2.5, 'R-Multiple calculation: $250 on $100 risk is +2.5R');
  assertEquals(calculateRMultiple(-150, 100), -1.5, 'R-Multiple calculation: -$150 on $100 risk is -1.5R');
  assertEquals(calculateRMultiple(100, 0), 0, 'R-Multiple handles 0 risk denominator gracefully');

  const testTrades = [
    { netPnL: 200, plannedRiskDollars: 100, rMultiple: 2.0, entryDate: '2026-09-01', assetClass: 'FOREX', setupId: 'BREAKOUT' },
    { netPnL: -100, plannedRiskDollars: 100, rMultiple: -1.0, entryDate: '2026-09-02', assetClass: 'EQUITY', setupId: 'BREAKOUT' },
    { netPnL: 300, plannedRiskDollars: 100, rMultiple: 3.0, entryDate: '2026-09-03', assetClass: 'FOREX', setupId: 'RETEST' },
    { netPnL: -200, plannedRiskDollars: 100, rMultiple: -2.0, entryDate: '2026-09-04', assetClass: 'FUTURES', setupId: 'PULLBACK' }
  ];

  const metrics = calculatePerformanceMetrics(testTrades, 10000);
  assertEquals(metrics.totalTrades, 4, 'Total trades = 4');
  assertEquals(metrics.winningTrades, 2, 'Winning trades = 2');
  assertEquals(metrics.losingTrades, 2, 'Losing trades = 2');
  assertEquals(metrics.winRate, 50, 'Win rate = 50%');
  assertEquals(metrics.netPnL, 200, 'Net PnL = +$200');
  assertEquals(metrics.grossProfit, 500, 'Gross profit = $500');
  assertEquals(metrics.grossLoss, 300, 'Gross loss = $300');
  assertEquals(metrics.profitFactor, 1.67, 'Profit factor = 1.67');
  assertEquals(metrics.averageR, 0.5, 'Average R = +0.50R');

  const dd = calculateDrawdown(testTrades, 10000);
  assertEquals(dd.maxDrawdownDollars, 200, 'Max Drawdown dollars = $200');
  assertEquals(Math.round(dd.maxDrawdownPercent * 10) / 10, 1.9, 'Max Drawdown percent = 1.9%');
  assertEquals(dd.peakEquity, 10400, 'Peak Equity = $10,400');
  assertEquals(dd.currentEquity, 10200, 'Current Equity = $10,200');
}

// 3. CSV PARSER & NUMBER NORMALIZATION TESTS
console.log('\n--- Suite 3: CSV Parser & Number Normalization ---');
{
  assertEquals(normalizeNumber('1,250.50'), 1250.5, 'US number format with comma thousands');
  assertEquals(normalizeNumber('1.250,50'), 1250.5, 'European number format with period thousands and comma decimal');
  assertEquals(normalizeNumber('(150.00)'), -150.0, 'Parentheses accounting negative notation');
  assertEquals(normalizeNumber('-$250.75'), -250.75, 'Currency sign and minus prefix');
  assertEquals(normalizeNumber('€ 1.450,00'), 1450.0, 'Euro sign and space removal');

  assertEquals(normalizeDirection('BUY'), 'LONG', 'Direction BUY -> LONG');
  assertEquals(normalizeDirection('BOT'), 'LONG', 'Direction BOT -> LONG');
  assertEquals(normalizeDirection('SELL'), 'SHORT', 'Direction SELL -> SHORT');
  assertEquals(normalizeDirection('SLD'), 'SHORT', 'Direction SLD -> SHORT');

  const testCSV = `Symbol,Side,EntryDate,Price,Qty,StopLoss,NetPnL
AAPL,BUY,2026-09-01T10:00:00Z,150.00,10,148.00,20.00
AAPL,BUY,2026-09-01T10:00:00Z,150.00,10,148.00,20.00
MSFT,SELL,2026-09-01T11:00:00Z,300.00,5,305.00,-25.00`;

  const parsed = importTradesFromCSV(testCSV, []);
  assertEquals(parsed.trades.length, 2, 'CSV import parses valid rows');
  assertEquals(parsed.duplicatesSkipped, 1, 'CSV import correctly identifies and skips duplicate row');
}

// 4. BEHAVIORAL LEAK DETECTOR TESTS
console.log('\n--- Suite 4: Behavioral Leak Detector ---');
{
  const testTrades = [
    { id: 'T1', symbol: 'NVDA', direction: 'LONG', entryDate: '2026-09-10T14:00:00Z', exitDate: '2026-09-10T14:30:00Z', entryPrice: 120, stopLoss: 119, plannedRiskDollars: 100, netPnL: -100, violations: [] },
    { id: 'T2', symbol: 'NVDA', direction: 'SHORT', entryDate: '2026-09-10T14:38:00Z', exitDate: '2026-09-10T15:00:00Z', entryPrice: 118, stopLoss: 119, plannedRiskDollars: 300, netPnL: -300, violations: [] },
    { id: 'T3', symbol: 'EURUSD', direction: 'LONG', entryDate: '2026-09-11T09:00:00Z', exitDate: '2026-09-11T10:00:00Z', entryPrice: 1.0850, stopLoss: 1.0830, plannedRiskDollars: 100, netPnL: -250, violations: [] },
    { id: 'T4', symbol: 'BTCUSD', direction: 'LONG', entryDate: '2026-09-12T12:00:00Z', exitDate: '2026-09-12T14:00:00Z', entryPrice: 60000, stopLoss: 0, plannedRiskDollars: 100, netPnL: -150, violations: [] },
    { id: 'T5', symbol: 'ES', direction: 'LONG', entryDate: '2026-09-13T10:00:00Z', entryPrice: 5000, stopLoss: 4990, plannedRiskDollars: 100, netPnL: 100, preSessionCompleted: false, violations: [] }
  ];

  const analyzed = analyzeTradeViolations(testTrades, 10000, 2.0);

  assert(analyzed[1].violations.includes('REVENGE_TRADE'), 'Flagged Trade 2 as REVENGE_TRADE');
  assert(analyzed[1].violations.includes('OVERSIZED_POSITION'), 'Flagged Trade 2 as OVERSIZED_POSITION');
  assert(analyzed[2].violations.includes('STOP_WIDENED'), 'Flagged Trade 3 as STOP_WIDENED (loss > 1.25R)');
  assert(analyzed[3].violations.includes('NO_STOP_LOSS'), 'Flagged Trade 4 as NO_STOP_LOSS');
  assert(analyzed[4].violations.includes('UNPREPARED_SESSION'), 'Flagged Trade 5 as UNPREPARED_SESSION');
}

// 5. MAE & MFE EXCURSION TESTS
console.log('\n--- Suite 5: MAE & MFE Excursion Engine ---');
{
  const longTrade = { direction: 'LONG', entryPrice: 100, stopLoss: 98, maePrice: 99, mfePrice: 106, rMultiple: 2.0 };
  const longExc = calculateExcursionR(longTrade);
  assertEquals(longExc.maeR, -0.5, 'Long MAE calculation: -0.50R adverse dip');
  assertEquals(longExc.mfeR, 3.0, 'Long MFE calculation: +3.00R favorable peak');

  const shortTrade = { direction: 'SHORT', entryPrice: 100, stopLoss: 102, maePrice: 101, mfePrice: 94, rMultiple: 2.5 };
  const shortExc = calculateExcursionR(shortTrade);
  assertEquals(shortExc.maeR, -0.5, 'Short MAE calculation: -0.50R adverse heat');
  assertEquals(shortExc.mfeR, 3.0, 'Short MFE calculation: +3.00R favorable peak');

  const excursionTrades = [
    { ...longTrade, rMultiple: 1.5 },
    { ...shortTrade, rMultiple: 2.5 }
  ];
  const patterns = analyzeExcursionPatterns(excursionTrades);
  assertEquals(patterns.avgWinMfeR, 3.0, 'Average Winner peak MFE = +3.00R');
  assertEquals(patterns.avgRealizedWinR, 2.0, 'Average Winner realized exit = +2.00R');
  assertEquals(patterns.avgProfitLeftOnTableR, 1.0, 'Average profit left on table = 1.00R');
  assertEquals(patterns.targetCaptureEfficiencyPercent, 67, 'Target capture efficiency = 67%');
}

// 6. TRADING CONTRACT & CIRCUIT BREAKER TESTS
console.log('\n--- Suite 6: Trading Contract & Circuit Breaker ---');
{
  const contract = { maxDailyTrades: 2, maxDailyLossR: 1.5, cooldownMinutes: 30, enforcePreSession: true };
  const preSessionLogs = [{ date: '2026-10-02T08:00:00Z', completed: true }];

  const test1 = evaluateCircuitBreaker({ trades: [], contract, candidateTradeDate: '2026-10-02T10:00:00Z', preSessionLogs });
  assertEquals(test1.isTripped, false, 'Circuit Breaker: Fresh day with prep is allowed to trade');

  const todayTrades = [
    { entryDate: '2026-10-02T09:00:00Z', exitDate: '2026-10-02T09:30:00Z', netPnL: 50, rMultiple: 0.5 },
    { entryDate: '2026-10-02T10:00:00Z', exitDate: '2026-10-02T10:30:00Z', netPnL: 50, rMultiple: 0.5 }
  ];
  const test2 = evaluateCircuitBreaker({ trades: todayTrades, contract, candidateTradeDate: '2026-10-02T11:00:00Z', preSessionLogs });
  assertEquals(test2.isTripped, true, 'Circuit Breaker trips when Max Daily Trades reached (2/2)');

  const lossTrades = [{ entryDate: '2026-10-02T09:00:00Z', exitDate: '2026-10-02T09:30:00Z', netPnL: -180, rMultiple: -1.8 }];
  const test3 = evaluateCircuitBreaker({ trades: lossTrades, contract, candidateTradeDate: '2026-10-02T10:15:00Z', preSessionLogs });
  assertEquals(test3.isTripped, true, 'Circuit Breaker trips when daily loss limit exceeded (-1.8R vs -1.5R)');

  const recentLoss = [{ entryDate: '2026-10-02T09:00:00Z', exitDate: '2026-10-02T09:50:00Z', netPnL: -50, rMultiple: -0.5 }];
  const test4 = evaluateCircuitBreaker({ trades: recentLoss, contract, candidateTradeDate: '2026-10-02T10:00:00Z', preSessionLogs });
  assertEquals(test4.isTripped, true, 'Circuit Breaker trips during active cooldown period (10m < 30m)');
}

// 7. 60-SECOND GUIDED DEBRIEF TESTS
console.log('\n--- Suite 7: 60-Second Guided Debrief & Discipline Grading ---');
{
  const debriefA = {
    executionIntegrity: 'FOLLOWED_PLAN',
    tradeManagement: 'LEFT_UNTOUCHED',
    emotionalTemperature: 'CALM_DETACHED'
  };
  const gradeA = gradeTradeDebrief(debriefA);
  assertEquals(gradeA.grade, 'A', 'Perfect execution debrief yields Grade A');
  assertEquals(gradeA.score, 100, 'Score is 100%');
  assertEquals(gradeA.inferredViolations.length, 0, 'Zero inferred violations');

  const debriefF = {
    executionIntegrity: 'CHASED_EARLY',
    tradeManagement: 'MOVED_STOP_WIDER',
    emotionalTemperature: 'ANGER_REVENGE'
  };
  const gradeF = gradeTradeDebrief(debriefF);
  assertEquals(gradeF.grade, 'F', 'Chased early + stop widened + revenge yields Grade F');
  assert(gradeF.score < 50, 'Score < 50%');
  assert(gradeF.inferredViolations.includes('STOP_WIDENED'), 'Debrief automatically infers STOP_WIDENED');
  assert(gradeF.inferredViolations.includes('CHASED_ENTRY'), 'Debrief automatically infers CHASED_ENTRY');
  assert(gradeF.inferredViolations.includes('REVENGE_TRADE'), 'Debrief automatically infers REVENGE_TRADE');

  const debriefC = {
    executionIntegrity: 'HESITATED_LATE',
    tradeManagement: 'CLOSED_PREMATURELY',
    emotionalTemperature: 'MODERATE_TENSION'
  };
  const gradeC = gradeTradeDebrief(debriefC);
  assertEquals(gradeC.grade, 'C', 'Hesitated + closed prematurely yields Grade C');
}

// 8. ACTIVE TILT INTERCEPTOR TESTS
console.log('\n--- Suite 8: Active Tilt Interceptor ---');
{
  const calmTrades = [{ netPnL: 100, exitDate: new Date().toISOString() }];
  const tiltCalm = evaluateTiltState(calmTrades, 30);
  assertEquals(tiltCalm.tiltLevel, 'CALM', 'No recent loss = CALM tilt state');
  assertEquals(tiltCalm.isCooldownRequired, false, 'No cooldown required');

  const oneLoss = [{ netPnL: -100, exitDate: new Date().toISOString() }];
  const tiltElevated = evaluateTiltState(oneLoss, 30);
  assertEquals(tiltElevated.tiltLevel, 'ELEVATED', '1 recent loss = ELEVATED tilt state');
  assertEquals(tiltElevated.isCooldownRequired, true, 'Cooldown required after 1 loss');
  assertEquals(tiltElevated.recommendedMinutes, 15, '15 minute cooldown recommended');

  const twoLosses = [
    { netPnL: -150, exitDate: new Date().toISOString() },
    { netPnL: -100, exitDate: new Date(Date.now() - 50000).toISOString() }
  ];
  const tiltHigh = evaluateTiltState(twoLosses, 30);
  assertEquals(tiltHigh.tiltLevel, 'HIGH', '2 consecutive losses = HIGH tilt state');
  assertEquals(tiltHigh.recommendedMinutes, 30, '30 minute cooldown recommended');

  const threeLosses = [
    { netPnL: -200, exitDate: new Date().toISOString() },
    { netPnL: -150, exitDate: new Date(Date.now() - 50000).toISOString() },
    { netPnL: -100, exitDate: new Date(Date.now() - 100000).toISOString() }
  ];
  const tiltCritical = evaluateTiltState(threeLosses, 30);
  assertEquals(tiltCritical.tiltLevel, 'CRITICAL', '3 consecutive losses = CRITICAL lockout');
  assertEquals(tiltCritical.recommendedMinutes, 60, '60 minute lockout recommended');
}

// 9. MONTE CARLO VARIANCE SIMULATOR TESTS
console.log('\n--- Suite 9: Monte Carlo Losing Streak Variance Simulator ---');
{
  const sim = simulateLosingStreakProbabilities({ winRatePercent: 50, tradesCount: 100, iterations: 500 });
  assert(sim.probabilities.streak3 > 50, 'At 50% win rate, 3-loss streak probability is > 50% in 100 trades');
  assert(sim.probabilities.streak4 > 40, 'At 50% win rate, 4-loss streak probability is > 40% in 100 trades');
  assert(sim.avgMaxStreak >= 4, 'Average max expected loss streak >= 4');
  assert(sim.advice.length > 20, 'Generates psychological reassurance advice text');
}


// 10. PROP FIRM GUARDIAN & DYNAMIC BUFFER TESTS
console.log('\n--- Suite 10: Prop Firm Guardian & Dynamic Drawdown Buffer ---');
{
  // Test 1: Topstep 50k Trailing High-Water Mark Drawdown
  const topstepTrades = [
    { entryDate: '2026-10-01T09:30:00Z', netPnL: 1400, mfeDollars: 1600, plannedRiskDollars: 500 },
    { entryDate: '2026-10-01T11:00:00Z', netPnL: -600, mfeDollars: 0, plannedRiskDollars: 500 }
  ];
  const buffer1 = calculateDynamicDrawdownBuffer(topstepTrades, PROP_FIRM_PRESETS.TOPSTEP_50K);
  assertEquals(buffer1.currentBalance, 50800, 'Current Balance = $50,000 + $1,400 - $600 = $50,800');
  assertEquals(buffer1.effectivePeak, 51600, 'Peak Equity trails to $51,600 from unrealized MFE peak');
  assertEquals(buffer1.totalLiquidationFloor, 49600, 'Liquidation Floor = $51,600 - $2,000 trailing drawdown = $49,600');
  assertEquals(buffer1.remainingTotalBufferDollars, 1200, 'Remaining Total Buffer = $50,800 - $49,600 = $1,200');
  assertEquals(buffer1.remainingTotalBufferR, 2.4, 'Remaining buffer in R units = 2.4R ($500 risk unit)');

  // Test 2: Topstep Trailing Lock at Starting Balance + $100
  const monsterWinTrades = [
    { entryDate: '2026-10-01T09:30:00Z', netPnL: 3500, plannedRiskDollars: 500 }
  ];
  const bufferLock = calculateDynamicDrawdownBuffer(monsterWinTrades, PROP_FIRM_PRESETS.TOPSTEP_50K);
  assertEquals(bufferLock.effectivePeak, 53500, 'Peak balance = $53,500');
  assertEquals(bufferLock.totalLiquidationFloor, 50100, 'Floor locks at $50,100 ($50,000 + $100) instead of continuing up to $51,500');

  // Test 3: Static Balance Drawdown (FTMO 100K)
  const ftmoTrades = [
    { entryDate: '2026-10-01T10:00:00Z', netPnL: 4000, plannedRiskDollars: 1000 }
  ];
  const ftmoBuffer = calculateDynamicDrawdownBuffer(ftmoTrades, PROP_FIRM_PRESETS.FTMO_100K);
  assertEquals(ftmoBuffer.totalLiquidationFloor, 90000, 'FTMO Static floor remains fixed at $90,000 regardless of peak gains');

  // Test 4: Daily Loss Buffer Calculation
  const dailyTrades = [
    { entryDate: '2026-10-02T10:00:00Z', netPnL: -350, plannedRiskDollars: 250 }
  ];
  const dailyBuffer = calculateDynamicDrawdownBuffer(dailyTrades, PROP_FIRM_PRESETS.TOPSTEP_50K, null, '2026-10-02');
  assertEquals(dailyBuffer.remainingDailyBufferDollars, 650, 'Daily buffer = $1,000 limit - $350 today loss = $650');
  assertEquals(dailyBuffer.isDailyBreached, false, 'Daily loss limit not breached');

  // Test 5: Reverse Runway Sizing with Slippage Haircut
  const runway = calculateRunwaySafeRisk(650, 2, 25);
  assertEquals(runway.maxSafeRiskDollars, 325, 'Raw risk per trade across 2 planned trades = $325');
  assertEquals(runway.safeRiskWithMarginDollars, 243.75, 'Safe risk with 25% slippage haircut = $243.75');
  assertEquals(runway.status, 'SAFE_TO_TRADE', 'Runway status is SAFE_TO_TRADE');

  // Test 6: Consistency Rule Calculation (30% Rule vs 50% Rule)
  const multidayTrades = [
    { entryDate: '2026-09-10T10:00:00Z', netPnL: 600 },
    { entryDate: '2026-09-11T10:00:00Z', netPnL: 1100 },
    { entryDate: '2026-09-12T10:00:00Z', netPnL: 800 }
  ];
  // Total profit = $2,500. Best day = $1,100 (44.0%)
  const apexCons = calculateConsistencyMetrics(multidayTrades, 30);
  assertEquals(apexCons.concentrationRatioPercent, 44, 'Best day profit concentration = 44.0%');
  assertEquals(apexCons.isCompliant, false, 'Disqualified / Non-compliant under 30% consistency rule');

  const topstepCons = calculateConsistencyMetrics(multidayTrades, 50);
  assertEquals(topstepCons.isCompliant, true, 'Compliant under 50% consistency rule (44% < 50%)');

  // Test 7: Payout & Evaluation Readiness Audit
  const audit = auditPayoutEligibility(topstepTrades, PROP_FIRM_PRESETS.TOPSTEP_50K);
  assertEquals(audit.profileId, 'TOPSTEP_50K', 'Audit generated for Topstep 50K');
  assert(audit.criteria.length >= 5, 'Evaluated all core criteria');
  const ddCriterion = audit.criteria.find(c => c.id === 'MAX_DRAWDOWN_INTACT');
  assertEquals(ddCriterion.passed, true, 'Max Drawdown intact criterion passed');
}


// 11. PLAYBOOK & COUNTERFACTUAL EQUITY ENGINE TESTS
console.log('\n--- Suite 11: Interactive Playbook & Counterfactual Equity Engine ---');
{
  // Test 1: Full Confluence Evaluation (A+ Setup)
  const fullCriteria = ['HTF_TREND', 'LEVEL_ESTABLISHED', 'CLEAN_BREAKOUT', 'RETEST_REJECTION', 'MIN_RR_2'];
  const confA = evaluateTradeConfluence('BREAKOUT_RETEST', fullCriteria);
  assertEquals(confA.confluenceScorePercent, 100, 'All 5 criteria checked = 100% confluence score');
  assertEquals(confA.classification, 'A_PLUS_SETUP', 'Classified as A_PLUS_SETUP');
  assertEquals(confA.isPlaybookCompliant, true, 'Marked as playbook compliant');
  assertEquals(confA.missingCriteria.length, 0, 'Zero missing criteria');

  const gold15 = DEFAULT_PLAYBOOK_SETUPS.GOLD_OTE_15M;
  const gold5 = DEFAULT_PLAYBOOK_SETUPS.GOLD_TREND_5M;
  assertEquals(gold15.timeframes, ['1D', '4H', '15M'], 'Gold Setup A uses Daily/4H context and 15M entry');
  assertEquals(gold5.timeframes, ['1D', '1H', '5M'], 'Gold Setup B uses Daily/1H context and 5M entry');
  assertEquals(evaluateTradeConfluence(gold15.id, gold15.criteria.map(rule => rule.id)).confluenceScorePercent, 100, 'Gold Setup A evaluates all mechanical rules');
  assertEquals(evaluateTradeConfluence(gold5.id, gold5.criteria.map(rule => rule.id)).confluenceScorePercent, 100, 'Gold Setup B evaluates all mechanical rules');

  // Test 2: Partial Confluence Evaluation (<75% = Impulse)
  const partialCriteria = ['HTF_TREND', 'LEVEL_ESTABLISHED'];
  const confImpulse = evaluateTradeConfluence('BREAKOUT_RETEST', partialCriteria);
  assertEquals(confImpulse.confluenceScorePercent, 40, '2 of 5 criteria = 40% confluence score');
  assertEquals(confImpulse.classification, 'OFF_PLAYBOOK', 'Classified as OFF_PLAYBOOK');
  assertEquals(confImpulse.isPlaybookCompliant, false, 'Marked as non-compliant');
  assert(confImpulse.inferredViolations.includes('UNQUALIFIED_SETUP'), 'Infers UNQUALIFIED_SETUP violation');

  // Test 3: Discretionary Trade Evaluation
  const confDisc = evaluateTradeConfluence('DISCRETIONARY', []);
  assertEquals(confDisc.classification, 'OFF_PLAYBOOK', 'Discretionary classified as OFF_PLAYBOOK');
  assertEquals(confDisc.isPlaybookCompliant, false, 'Discretionary is non-compliant');

  // Test 4: Counterfactual Equity Curve Split
  const testTrades = [
    { id: 'T1', setupId: 'BREAKOUT_RETEST', netPnL: 300, rMultiple: 1.5, entryDate: '2026-09-01T14:00:00Z', isPlaybookCompliant: true },
    { id: 'T2', setupId: 'BREAKOUT_RETEST', netPnL: -100, rMultiple: -1.0, entryDate: '2026-09-02T14:15:00Z', isPlaybookCompliant: true },
    { id: 'T3', setupId: 'LIQUIDITY_SWEEP', netPnL: 400, rMultiple: 2.0, entryDate: '2026-09-03T14:30:00Z', isPlaybookCompliant: true },
    { id: 'T4', setupId: 'DISCRETIONARY', netPnL: -250, rMultiple: -1.5, entryDate: '2026-09-04T17:00:00Z', isPlaybookCompliant: false },
    { id: 'T5', setupId: 'DISCRETIONARY', netPnL: -350, rMultiple: -2.0, entryDate: '2026-09-05T17:30:00Z', isPlaybookCompliant: false }
  ];

  const split = calculateCounterfactualEquitySplit(testTrades, 10000);
  assertEquals(split.playbookTradesCount, 3, 'Playbook trades count = 3');
  assertEquals(split.impulseTradesCount, 2, 'Impulse trades count = 2');
  assertEquals(split.playbookPurityPercent, 60, 'Playbook Purity = 3/5 = 60%');
  assertEquals(split.playbookStats.netPnL, 600, 'Playbook Net PnL = $300 - $100 + $400 = +$600');
  assertEquals(split.impulseStats.netPnL, -600, 'Impulse Net PnL = -$250 - $350 = -$600');
  assertEquals(split.totalStats.netPnL, 0, 'Total Realized Net PnL = $0');
  assertEquals(split.disciplineEdgeDollars, 600, 'Discipline Edge Delta = +$600 (amount saved by skipping impulse trades)');
  assert(split.insightMessage.includes('Mathematical Proof'), 'Generates behavioral economics insight');

  // Test 5: Session Killzone Classification
  const kzNY = classifyTradeKillzone('2026-10-02T14:15:00Z');
  assertEquals(kzNY.id, 'NY_OPEN', '14:15 UTC classified as NY_OPEN');

  const kzLondon = classifyTradeKillzone('2026-10-02T08:30:00Z');
  assertEquals(kzLondon.id, 'LONDON_OPEN', '08:30 UTC classified as LONDON_OPEN');

  const kzChop = classifyTradeKillzone('2026-10-02T17:00:00Z');
  assertEquals(kzChop.id, 'LUNCH_CHOP', '17:00 UTC classified as LUNCH_CHOP');

  const kzAsia = classifyTradeKillzone('2026-10-02T03:00:00Z');
  assertEquals(kzAsia.id, 'ASIAN_RANGE', '03:00 UTC classified as ASIAN_RANGE');

  // Test 6: Killzone Grouped Metrics
  const kzMetrics = calculateSessionKillzoneMetrics(testTrades);
  const nySession = kzMetrics.find(m => m.id === 'NY_OPEN');
  assertEquals(nySession.tradeCount, 3, 'NY Open has 3 trades');
  assertEquals(nySession.winRate, 67, 'NY Open win rate = 67% (2 wins / 3 trades)');
  assertEquals(nySession.netPnL, 600, 'NY Open Net PnL = +$600');

  const lunchSession = kzMetrics.find(m => m.id === 'LUNCH_CHOP');
  assertEquals(lunchSession.tradeCount, 2, 'Lunch Chop has 2 trades');
  assertEquals(lunchSession.winRate, 0, 'Lunch Chop win rate = 0%');
  assertEquals(lunchSession.netPnL, -600, 'Lunch Chop Net PnL = -$600');
}

console.log('\n--- Suite 12: Trade Validation & Reporting ---');
{
  const validTrade = normalizeTradePayload({
    symbol: 'nvda',
    direction: 'buy',
    entryPrice: 120,
    exitPrice: 122,
    quantity: 10,
    stopLoss: 118,
    assetClass: 'equity'
  });

  assertEquals(validTrade.symbol, 'NVDA', 'Trade normalization uppercases symbol and adjusts direction');
  assertEquals(validTrade.direction, 'LONG', 'Trade normalization converts BUY to LONG');
  assertEquals(validTrade.assetClass, 'EQUITY', 'Trade normalization normalizes asset class');
  assertEquals(validTrade.plannedRiskDollars, 20, 'Risk is auto-derived when stop loss is provided');

  const invalidTrade = validateTradePayload({ symbol: '', direction: 'BUY', entryPrice: 'abc', quantity: 0 });
  assertEquals(invalidTrade.valid, false, 'Invalid trades are rejected when required values are malformed');
  assert(invalidTrade.errors.length >= 2, 'Validation reports multiple reasons for bad trade data');

  const report = buildTradeSummaryReport([
    { netPnL: 250, plannedRiskDollars: 100, rMultiple: 2.5, violations: [] },
    { netPnL: -120, plannedRiskDollars: 100, rMultiple: -1.2, violations: ['STOP_WIDENED'] },
    { netPnL: 0, plannedRiskDollars: 100, rMultiple: 0, violations: [] }
  ]);

  assertEquals(report.totalTrades, 3, 'Summary counts all analyzed trades');
  assertEquals(report.winRate, 33, 'Summary win rate calculates correctly');
  assertEquals(report.violationCount, 1, 'Summary captures violation count');
  assert(report.csv.includes('symbol,netPnL'), 'CSV export includes expected header');
}

console.log('\n--- Suite 12: Session State & Login Persistence ---');
{
  const store = {};
  const originalSession = createSessionState({ username: 'alextrader', displayName: 'Alex Trader', role: 'trader' });
  saveSessionState(store, originalSession);

  const loaded = loadSessionState(store);
  assertEquals(loaded.username, 'alextrader', 'Session state loads persisted username');
  assertEquals(loaded.displayName, 'Alex Trader', 'Session state loads display name');
  assertEquals(isSessionActive(loaded), true, 'Session remains active when state is valid');

  clearSessionState(store);
  assertEquals(loadSessionState(store), null, 'Session state clears cleanly');
}

console.log('\n--- Suite 13: Per-User Journal Profile Persistence ---');
{
  const store = {};
  const profileKey = getProfileStorageKey('alextrader');
  const profileData = {
    trades: [{ id: 'T-100', symbol: 'NVDA', netPnL: 150 }],
    tradingContract: { maxDailyTrades: 3 },
    preSessionLogs: [{ note: 'Prepared' }],
    tradingPlan: { name: 'Alex Plan', customRules: [{ id: 'custom-1', label: 'Avoid lunch chop' }] },
    planChecklist: { date: '2026-10-02', checkedIds: ['check-news', 'custom-1'] }
  };

  saveProfileData(store, 'alextrader', profileData);
  assertEquals(store[profileKey].includes('NVDA'), true, 'Profile data saves under the user key');

  const loaded = loadProfileData(store, 'alextrader');
  assertEquals(loaded.trades.length, 1, 'Profile loads user-specific trades');
  assertEquals(loaded.tradingContract.maxDailyTrades, 3, 'Profile loads user-specific contract settings');
  assertEquals(loaded.tradingPlan.customRules[0].label, 'Avoid lunch chop', "Profile loads the user's custom trading plan");
  assertEquals(loaded.planChecklist.checkedIds.includes('custom-1'), true, "Profile restores the user's daily plan checklist");

  const different = loadProfileData(store, 'othertrader');
  assertEquals(different, null, 'Different user profile remains isolated');

  clearProfileData(store, 'alextrader');
  assertEquals(loadProfileData(store, 'alextrader'), null, 'Profile data clears cleanly');
}

console.log('\n================================================================');
console.log('\n--- Suite 14: Personal Trading Plan ---');
{
  const plan = normalizeTradingPlan({
    ...DEFAULT_TRADING_PLAN,
    maxRiskPercent: 1,
    maxDailyTrades: 2,
    maxDailyLossR: 1.5,
    customRules: [{ id: 'news-window', label: 'Avoid the news window' }]
  });
  const checkedRuleIds = [...DEFAULT_PLAN_RULES.map(rule => rule.id), 'news-window'];

  assertEquals(plan.customRules.length, 1, 'Plan retains a personal custom rule');
  assertEquals(evaluatePlanReadiness(plan, []).ready, false, 'Plan is not ready until every checklist rule is checked');
  assertEquals(evaluatePlanReadiness(plan, checkedRuleIds).ready, true, 'Plan becomes ready when all built-in and custom rules are checked');
  assertEquals(evaluatePlanTradeLimits({ plan, candidateRiskPercent: 1, candidateDate: '2026-10-02T12:00:00Z' }).canTrade, true, 'Plan allows risk at or below the personal cap');
  assertEquals(evaluatePlanTradeLimits({ plan, candidateRiskPercent: 1.1, candidateDate: '2026-10-02T12:00:00Z' }).breaches[0].code, 'PLAN_RISK_CAP', 'Plan blocks risk above the personal cap');

  const trades = [
    { entryDate: '2026-10-02T09:00:00Z', rMultiple: -1 },
    { entryDate: '2026-10-02T10:00:00Z', rMultiple: -0.5 }
  ];
  const dailyLimits = evaluatePlanTradeLimits({ plan, trades, candidateRiskPercent: 1, candidateDate: '2026-10-02T12:00:00Z' });
  assertEquals(dailyLimits.canTrade, false, 'Plan blocks further trades at the daily trade cap and loss stop');
  assertEquals(dailyLimits.breaches.map(breach => breach.code), ['PLAN_DAILY_TRADE_CAP', 'PLAN_DAILY_LOSS_CAP'], 'Plan identifies the exact daily limits reached');
}

console.log('\n================================================================');
console.log('\n--- Suite 15: Lesson Charting Examples ---');
{
  for (let lessonNumber = 1; lessonNumber <= 10; lessonNumber++) {
    const chart = renderLessonTopicChart(`lesson-${lessonNumber}`, 'Example topic', 0);
    assert(chart.includes('<svg') && chart.includes('role="img"'), `Lesson ${lessonNumber} topic chart renders with accessible SVG`);
  }
  const ipdaChart = renderLessonTopicChart('lesson-ipda', 'Worked hypothetical gold example', 3);
  assert(ipdaChart.includes('sweep 2342') && ipdaChart.includes('EQ 2320'), 'IPDA chart shows the hypothetical range and liquidity sweep');
  assert(renderLessonTopicChart('lesson-7', 'Worked Fibonacci example', 0).includes('2324.72'), 'Fibonacci chart shows calculated retracement price');
  assert(renderLessonTopicChart('lesson-6', 'Worked profile example', 0).includes('VAH 2336'), 'Volume-profile chart shows hypothetical VAH price');

  const candlePatterns = [
    'Hammer', 'Hanging man', 'Inverted hammer', 'Shooting star', 'Bullish pin bar', 'Bearish pin bar',
    'Doji', 'Long-legged doji', 'Dragonfly doji', 'Gravestone doji', 'Spinning top', 'Marubozu',
    'Bullish engulfing', 'Bearish engulfing', 'Bullish harami', 'Bearish harami', 'Harami cross',
    'Piercing line', 'Dark cloud cover', 'Tweezer bottom', 'Tweezer top', 'Inside bar', 'Outside bar',
    'Morning star', 'Evening star', 'Three white soldiers', 'Three black crows',
    'Rising three methods', 'Falling three methods', 'Kicker'
  ];
  assert(candlePatterns.every(pattern => renderCandlestickPatternChart(pattern).includes('<svg')), 'Every listed candle pattern has an OHLC chart example');
}

console.log('\n================================================================');
console.log(`  FINAL RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
