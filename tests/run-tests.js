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

import { calculateEquityCryptoSize, calculateForexSize, calculateFuturesSize, getInstrumentSpec, calculateInstrumentAwarePositionSize, evaluateInstrumentRiskGuardrails, FUTURES_SPECS, FOREX_SPECS, CRYPTO_SPECS } from '../src/engine/sizing.js';
import { calculateRMultiple, calculatePerformanceMetrics, calculateDrawdown, groupTradesBy } from '../src/engine/metrics.js';
import { normalizeNumber, normalizeDirection, importTradesFromCSV } from '../src/engine/csv-parser.js';
import { analyzeTradeViolations, calculateLeakDiagnostics } from '../src/engine/leak-detector.js';
import { calculateExcursionR, analyzeExcursionPatterns } from '../src/engine/excursion.js';
import { evaluateCircuitBreaker, DEFAULT_TRADING_CONTRACT } from '../src/engine/contract.js';
import { evaluateExecutionQuality, compareExecutionCohorts, classifyProcessOutcome, EXECUTION_RULES, PROCESS_OUTCOME_QUADRANTS, EXECUTION_DISCLAIMER } from '../src/engine/execution-quality.js';
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
import { TRADE_SOURCES, TRADE_CATEGORIES, filterPerformanceTrades, filterTradesByCategory, isDemoTrade, isSimulatedTrade, isSampleTrade, isImportedTrade, isPersonalTrade, getTradeCategory, getTradeSourceLabel, getTradeSourceBadgeClass, getModeBannerText, normalizeTradeSource, tagLegacySampleTrades, tagTradesWithSource } from '../src/engine/trade-provenance.js';
import {
  MARKET_REGIMES,
  SESSIONS,
  RESEARCH_PRESETS,
  generateHistoricalDataset,
  calculateIndicators,
  evaluateBarEntryCondition,
  runStrategyBacktest,
  calculateLabCohortMetrics,
  calculateUncertaintyMetrics,
  calculateRegimeBreakdown,
  calculateFrictionAudit,
  evaluateEdgeDurability,
  runFrictionStressTest
} from '../src/engine/research-lab.js';
import {
  calculateWilsonConfidenceInterval,
  calculateContinuousConfidenceInterval,
  analyzeTargetAdherenceObservation,
  analyzeSessionCostDriftObservation,
  analyzeStopAdherenceObservation,
  analyzePostLossSequenceObservation,
  analyzeExcursionObservation,
  generateTraderHistoryObservations,
  extractTradeCost,
  getSampleSizeCaveat,
  REVIEW_DISCLAIMER
} from '../src/engine/trader-review.js';
import {
  DELIBERATE_PAUSE_PRINCIPLES,
  STAND_DOWN_STATUSES,
  MISSED_SETUP_REASONS,
  VIOLATION_ROOT_CAUSES,
  validatePreEntryPlan,
  createPreEntryPlan,
  linkPlanToExecutedTrade,
  createMissedSetup,
  analyzeMissedSetups,
  documentRuleViolationRecord,
  evaluateSessionLimitsAndPause
} from '../src/engine/deliberate-pause.js';
import {
  ALLOWED_IMAGE_TYPES,
  SCREENSHOT_TAGS,
  validateImageAttachment,
  createVisualEvidenceRecord,
  linkScreenshotsToTrade,
  calculateVisualEvidenceMetrics,
  compareVisualAccountabilityCohorts,
  generateVisualJournalObservations
} from '../src/engine/visual-journal.js';
import {
  SESSION_BLOCKS,
  SESSION_ORDER,
  DAYS_OF_WEEK,
  CALENDAR_DISCLAIMER,
  classifySessionBlock,
  formatDateKey,
  isTradeCompliant,
  aggregateDailyActivity,
  buildMonthlyCalendar,
  buildWeeklyMatrix,
  generateSessionHeatmap,
  buildDayAudit
} from '../src/engine/calendar-heatmap.js';
import {
  SUPPORTED_BROKERS,
  normalizeContractSymbol,
  detectBrokerFormat,
  extractExecutionFills,
  parseSingleRoundtripSummary,
  pairExecutionsIntoTrades,
  parseBrokerOrderText
} from '../src/engine/broker-parser.js';

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
console.log('\n--- Suite 16: Trade Provenance & Sample Isolation ---');
{
  const sample = { id: 'S-1', symbol: 'GC', entryDate: '2026-10-01T10:00:00Z', entryPrice: 2300, quantity: 1, netPnL: 500, source: 'MANUAL' };
  const taggedSample = tagTradesWithSource([sample], TRADE_SOURCES.SAMPLE)[0];
  const demo = tagTradesWithSource([{ id: 'D-1', symbol: 'GC' }], TRADE_SOURCES.DEMO_PRACTICE)[0];
  const personal = { id: 'P-1', symbol: 'GC', source: 'MANUAL', netPnL: -25 };
  const imported = { id: 'I-1', symbol: 'ES', source: 'CSV_IMPORT', netPnL: 10 };

  assertEquals(taggedSample.source, 'SAMPLE', 'Bundled examples receive explicit sample provenance');
  assertEquals(isSampleTrade(taggedSample), true, 'Sample records are classified as examples');
  assertEquals(isDemoTrade(demo), true, 'Demo practice records are classified as simulated');
  assertEquals(isSimulatedTrade(demo), true, 'Demo practice records are classified as simulated via isSimulatedTrade');
  assertEquals(demo.executionMode, 'DEMO', 'Demo source receives a demo execution mode');
  assertEquals(normalizeTradeSource('unknown-old-value'), 'LEGACY_UNKNOWN', 'Unknown legacy sources remain visibly identifiable');
  assertEquals(tagLegacySampleTrades([{ ...sample }], [sample])[0].source, 'SAMPLE', 'Legacy persisted copies of bundled examples are recognized');
  assertEquals(filterPerformanceTrades([taggedSample, demo, personal, imported]).map(trade => trade.id), ['P-1', 'I-1'], 'Performance data excludes sample and demo while retaining personal/imported trades');

  // Four-way source categorization tests
  assertEquals(getTradeCategory(personal), TRADE_CATEGORIES.PERSONAL, 'Personal record category is PERSONAL');
  assertEquals(getTradeCategory(imported), TRADE_CATEGORIES.IMPORTED, 'Imported record category is IMPORTED');
  assertEquals(getTradeCategory(demo), TRADE_CATEGORIES.SIMULATED, 'Demo record category is SIMULATED');
  assertEquals(getTradeCategory(taggedSample), TRADE_CATEGORIES.SAMPLE, 'Sample record category is SAMPLE');

  assertEquals(isPersonalTrade(personal), true, 'Personal manual trade identified as personal');
  assertEquals(isPersonalTrade(taggedSample), false, 'Sample trade is not personal');
  assertEquals(isImportedTrade(imported), true, 'CSV import trade identified as imported');
  assertEquals(isImportedTrade(personal), false, 'Personal trade is not imported');

  // Category filtering
  const mixedTrades = [taggedSample, demo, personal, imported];
  assertEquals(filterTradesByCategory(mixedTrades, 'PERSONAL').map(t => t.id), ['P-1'], 'Category filter isolates personal trades');
  assertEquals(filterTradesByCategory(mixedTrades, 'IMPORTED').map(t => t.id), ['I-1'], 'Category filter isolates imported trades');
  assertEquals(filterTradesByCategory(mixedTrades, 'SIMULATED').map(t => t.id), ['D-1'], 'Category filter isolates simulated trades');
  assertEquals(filterTradesByCategory(mixedTrades, 'SAMPLE').map(t => t.id), ['S-1'], 'Category filter isolates sample trades');
  assertEquals(filterTradesByCategory(mixedTrades, 'ALL').length, 4, 'Category filter ALL includes all records');

  // Default exclusion of sample trades from performance reports
  const defaultReport = buildTradeSummaryReport([taggedSample, personal, imported]);
  assertEquals(defaultReport.totalTrades, 2, 'Performance report excludes sample trade S-1 by default');
  assertEquals(defaultReport.netPnL, -15, 'Performance report net PnL excludes sample gains by default (-$25 + $10 = -$15)');
  assert(!defaultReport.csv.includes('S-1'), 'CSV export excludes sample records by default');

  const explicitSampleReport = buildTradeSummaryReport([taggedSample, personal, imported], { excludeSample: false });
  assertEquals(explicitSampleReport.totalTrades, 3, 'Report includes sample only when explicitly requested');
  assertEquals(explicitSampleReport.netPnL, 485, 'Explicit sample report includes sample PnL');

  // Mode banners and badge classes
  assert(getModeBannerText('SAMPLE').includes('SAMPLE EXAMPLES') && getModeBannerText('SAMPLE').includes('STRICTLY EXCLUDED'), 'Sample mode banner warns about educational data exclusion');
  assert(getModeBannerText('PERSONAL').includes('PERSONAL JOURNAL'), 'Personal mode banner clarifies scope');
  assert(getTradeSourceBadgeClass(taggedSample).includes('source-sample'), 'Badge class for sample record contains source-sample');
  assert(getTradeSourceBadgeClass(demo).includes('source-simulated'), 'Badge class for demo record contains source-simulated');
  assert(getTradeSourceBadgeClass(imported).includes('source-imported'), 'Badge class for imported record contains source-imported');
  assert(getTradeSourceBadgeClass(personal).includes('source-personal'), 'Badge class for personal record contains source-personal');
}

// --- Suite 17: Strategy Research Lab & Edge Durability Audit ---
console.log('\n--- Suite 17: Strategy Research Lab & Edge Durability Audit ---');
{
  // 1. Dataset Generation & Indicator Computation
  const dataset = generateHistoricalDataset({
    symbol: 'EURUSD',
    totalBars: 300,
    trainSplit: 0.60,
    startPrice: 1.0800,
    seed: 42
  });

  assertEquals(dataset.bars.length, 300, 'Generates requested number of bars');
  const inSampleBars = dataset.bars.filter(b => b.partition === 'IN_SAMPLE');
  const oosBars = dataset.bars.filter(b => b.partition === 'OUT_OF_SAMPLE');
  assertEquals(inSampleBars.length, 180, 'In-sample partition contains 60% of bars (180)');
  assertEquals(oosBars.length, 120, 'Out-of-sample partition contains 40% of bars (120)');

  // Regimes and technical indicators
  const regimesFound = new Set(dataset.bars.map(b => b.regime));
  assert(regimesFound.has(MARKET_REGIMES.BULL_TREND), 'Dataset includes BULL_TREND regime');
  assert(regimesFound.has(MARKET_REGIMES.BEAR_TREND), 'Dataset includes BEAR_TREND regime');
  assert(regimesFound.has(MARKET_REGIMES.CHOP_RANGE), 'Dataset includes CHOP_RANGE regime');
  assert(regimesFound.has(MARKET_REGIMES.HIGH_VOLATILITY), 'Dataset includes HIGH_VOLATILITY regime');

  const sampleBar = dataset.bars[50];
  assert(typeof sampleBar.ema20 === 'number' && sampleBar.ema20 > 0, 'Computes EMA20');
  assert(typeof sampleBar.ema50 === 'number' && sampleBar.ema50 > 0, 'Computes EMA50');
  assert(typeof sampleBar.atr14 === 'number' && sampleBar.atr14 > 0, 'Computes ATR14');
  assert(typeof sampleBar.rsi14 === 'number' && sampleBar.rsi14 >= 0 && sampleBar.rsi14 <= 100, 'Computes RSI14');
  assert(typeof sampleBar.donchianHigh20 === 'number', 'Computes Donchian 20-bar High');
  assert(typeof sampleBar.donchianLow20 === 'number', 'Computes Donchian 20-bar Low');

  // 2. Realistic Fill Execution & Friction Modeling
  const backtest = runStrategyBacktest(dataset.bars, RESEARCH_PRESETS.TREND_PULLBACK_CONFLUENCE);
  assert(Array.isArray(backtest.trades), 'Backtest generates array of executed trades');
  assert(backtest.total.totalTrades > 0, 'Strategy triggered trades across the historical dataset');

  // Verify friction deductions
  const sampleTrade = backtest.trades[0];
  assert(sampleTrade.commissionPaid > 0, 'Trade incurs commission costs');
  assert(sampleTrade.spreadPaid > 0, 'Trade incurs bid-ask spread crossing cost');
  assert(sampleTrade.entrySlippage >= 0 && sampleTrade.exitSlippage >= 0, 'Trade models realistic entry and exit slippage');
  assert(sampleTrade.netPnL !== sampleTrade.grossPnL, 'Net PnL reflects execution friction drag');

  // Verify Stop Loss gap slippage model
  const stopLossFills = backtest.trades.filter(t => t.exitReason === 'STOP_LOSS');
  if (stopLossFills.length > 0) {
    const gapStopTrade = stopLossFills[0];
    assert(gapStopTrade.exitPrice !== gapStopTrade.stopLoss || gapStopTrade.exitSlippage > 0, 'Stop loss fills model gap/slippage rather than idealized zero-drag fills');
  }

  // 3. In-Sample vs. Out-of-Sample Separation & Overfit Decay
  assert(typeof backtest.inSample.winRate === 'number', 'In-sample win rate calculated');
  assert(typeof backtest.outOfSample.winRate === 'number', 'Out-of-sample win rate calculated');
  assert(typeof backtest.decay.winRateDelta === 'number', 'Calculates win rate decay delta');
  assert(typeof backtest.decay.averageRDecayPercent === 'number', 'Calculates expectancy decay %');
  assert(['LOW', 'MODERATE', 'HIGH'].includes(backtest.decay.overfitHazard), 'Classifies overfit hazard');

  // 4. Overfit Curve-Fit Demo Detection
  const overfitBacktest = runStrategyBacktest(dataset.bars, RESEARCH_PRESETS.FRAGILE_OVERFIT_DEMO);
  assert(
    overfitBacktest.decay.overfitHazard === 'HIGH' || 
    overfitBacktest.durability.verdict === 'FRAGILE_OVERFIT' || 
    overfitBacktest.durability.verdict === 'NO_EDGE' ||
    overfitBacktest.durability.score < 50,
    'Overfit demo setup correctly identified as fragile / non-durable edge'
  );

  // 5. Statistical Uncertainty & Monte Carlo Path Resampling
  const uncertainty = backtest.uncertainty;
  assert(typeof uncertainty.winRateWilsonCI.lower === 'number' && typeof uncertainty.winRateWilsonCI.upper === 'number', 'Wilson 95% confidence interval computed for win rate');
  assert(uncertainty.winRateWilsonCI.lower <= uncertainty.winRateWilsonCI.upper, 'Wilson CI lower bound <= upper bound');
  assert(typeof uncertainty.expectancy95CI.lower === 'number' && typeof uncertainty.expectancy95CI.upper === 'number', '95% Standard Error interval computed for expectancy R');
  assert(uncertainty.theoreticalMaxLossStreak >= 1, 'Calculates theoretical max losing streak expectation');
  assert(uncertainty.monteCarloResampling.iterations === 500, 'Runs 500-iteration Monte Carlo path resampling');
  assert(typeof uncertainty.monteCarloResampling.p5OutcomeDollars === 'number', 'Computes P5 worst-case drawdown outcome');
  assert(typeof uncertainty.monteCarloResampling.p50OutcomeDollars === 'number', 'Computes P50 median outcome');
  assert(typeof uncertainty.monteCarloResampling.ruinRiskPercent === 'number', 'Computes risk of severe drawdown / ruin');

  // 6. Market Regime Performance Breakdown
  const regimes = backtest.regimeBreakdown;
  assert(regimes[MARKET_REGIMES.BULL_TREND] !== undefined, 'Breakdown tracks BULL_TREND');
  assert(regimes[MARKET_REGIMES.BEAR_TREND] !== undefined, 'Breakdown tracks BEAR_TREND');
  assert(regimes[MARKET_REGIMES.CHOP_RANGE] !== undefined, 'Breakdown tracks CHOP_RANGE');
  assert(regimes[MARKET_REGIMES.HIGH_VOLATILITY] !== undefined, 'Breakdown tracks HIGH_VOLATILITY');

  // 7. Friction Drag Audit
  const friction = backtest.frictionAudit;
  assert(friction.totalCommissionsPaid > 0, 'Audit tallies total commissions');
  assert(friction.totalSpreadCostDollars > 0, 'Audit tallies total spread costs');
  assert(friction.totalSlippageCostDollars > 0, 'Audit tallies total slippage and gap costs');
  assertEquals(
    friction.netProfitDollars, 
    Math.round((friction.grossProfitDollars - friction.totalFrictionDollars) * 100) / 100, 
    'Net profit equals gross profit minus total execution friction'
  );

  // 8. 2x Friction Liquidity Stress Test
  const stress = runFrictionStressTest(dataset.bars, RESEARCH_PRESETS.TREND_PULLBACK_CONFLUENCE);
  assert(typeof stress.normalNetPnL === 'number', 'Stress test captures baseline net PnL');
  assert(typeof stress.stressedNetPnL === 'number', 'Stress test captures 2x friction net PnL');
  assert(stress.stressedNetPnL <= stress.normalNetPnL, 'Doubled spread and slippage degrades net PnL');
  assert(typeof stress.survivesStress === 'boolean', 'Stress test reports survival flag');
}

// 18. INSTRUMENT-AWARE SIZING & RISK GUARDRAILS
console.log('\n--- Suite 18: Instrument-Aware Sizing & Hard Risk Guardrails ---');
{
  // 1. Instrument Specifications
  const esSpec = getInstrumentSpec('ES', 'FUTURES');
  assert(esSpec.supported === true, 'ES futures spec recognized');
  assertEquals(esSpec.tickOrPipSize, 0.25, 'ES tick size = 0.25');
  assertEquals(esSpec.tickOrPipValue, 12.50, 'ES tick value = $12.50');
  assertEquals(esSpec.pointMultiplier, 50, 'ES point multiplier = 50');

  const mesSpec = getInstrumentSpec('MES', 'FUTURES');
  assertEquals(mesSpec.tickOrPipValue, 1.25, 'MES tick value = $1.25');
  assertEquals(mesSpec.pointMultiplier, 5, 'MES point multiplier = 5');

  const eurusdSpec = getInstrumentSpec('EURUSD', 'FOREX');
  assert(eurusdSpec.supported === true, 'EURUSD forex spec recognized');
  assertEquals(eurusdSpec.tickOrPipSize, 0.0001, 'EURUSD pip size = 0.0001');
  assertEquals(eurusdSpec.tickOrPipValue, 10.0, 'EURUSD pip value = $10.00 per standard lot');

  const btcSpec = getInstrumentSpec('BTCUSD', 'CRYPTO');
  assert(btcSpec.supported === true, 'BTCUSD crypto spec recognized');
  assertEquals(btcSpec.sizeStep, 0.001, 'BTCUSD size step = 0.001');

  const eqSpec = getInstrumentSpec('AAPL', 'EQUITY');
  assert(eqSpec.supported === true, 'Equity spec recognized');
  assertEquals(eqSpec.sizeStep, 1, 'Equity size step = 1 share');

  // 2. Cost-Aware Sizing vs Naive Sizing
  // Scenario: $500 risk budget, 5.00 point stop on ES (20 ticks = $250 nominal risk per contract).
  // Naive sizing says $500 / $250 = 2 contracts.
  // But 2 contracts with round-turn commissions ($4.50 ea), spread (1 tick = $12.50 ea), and slippage ($12.50 ea)
  // adds $29.50/contract * 2 = $59 friction. Total committed risk = $500 + $59 = $559 (exceeds $500 budget!).
  const naiveSizing = calculateInstrumentAwarePositionSize({
    assetClass: 'FUTURES',
    symbol: 'ES',
    entryPrice: 5000,
    stopLoss: 4995,
    accountBalance: 50000,
    riskPercentage: 1.0, // $500 budget
    accountForCosts: false
  });
  assertEquals(naiveSizing.units, 2, 'Naive sizing yields 2 contracts ignoring costs');
  assert(naiveSizing.nominalRisk <= 500, 'Naive nominal risk equals budget');

  const costAwareSizing = calculateInstrumentAwarePositionSize({
    assetClass: 'FUTURES',
    symbol: 'ES',
    entryPrice: 5000,
    stopLoss: 4995,
    accountBalance: 50000,
    riskPercentage: 1.0, // $500 budget
    accountForCosts: true
  });
  assertEquals(costAwareSizing.units, 1, 'Cost-aware sizing downsizes to 1 contract to prevent cost breach');
  assert(costAwareSizing.totalCommittedRisk <= 500, 'Cost-aware total committed risk strictly within $500 budget');
  assert(costAwareSizing.totalFriction > 0, 'Cost-aware sizing tracks positive friction drag');
  assertEquals(
    costAwareSizing.totalCommittedRisk,
    Math.round((costAwareSizing.nominalRisk + costAwareSizing.totalFriction) * 100) / 100,
    'Total committed risk equals nominal risk plus estimated friction'
  );

  // 3. Custom Cost Overrides
  const customCostSizing = calculateInstrumentAwarePositionSize({
    assetClass: 'FUTURES',
    symbol: 'ES',
    entryPrice: 5000,
    stopLoss: 4995,
    accountBalance: 50000,
    riskPercentage: 1.0,
    accountForCosts: true,
    customCommission: 2.00, // discount broker
    customSpread: 0.25,     // 1 tick spread
    customSlippage: 0       // zero slippage fill
  });
  assertEquals(customCostSizing.totalCommission, 2.00, 'Custom commission override applied correctly');

  // 4. Hard Guardrails - Invalid Price Structure
  const badGeometry = evaluateInstrumentRiskGuardrails({
    candidateTrade: {
      symbol: 'ES',
      assetClass: 'FUTURES',
      direction: 'LONG',
      entryPrice: 5000,
      stopLoss: 5010 // Stop above entry for LONG!
    }
  });
  assert(badGeometry.canTrade === false, 'Blocks trade when long stop is placed above entry price');
  assert(badGeometry.verdict === 'BLOCK', 'Verdict is BLOCK on invalid price geometry');
  assert(badGeometry.breaches.some(b => b.code === 'GEOMETRY_INVALID_STOP'), 'Breach code GEOMETRY_INVALID_STOP flagged');

  // 5. Hard Guardrail - Daily Trade Cap
  const sampleTodayTrades = [
    { entryDate: '2026-10-04T09:00:00Z', rMultiple: 1.0, netPnL: 500 },
    { entryDate: '2026-10-04T11:00:00Z', rMultiple: -1.0, netPnL: -500 },
    { entryDate: '2026-10-04T13:00:00Z', rMultiple: 1.5, netPnL: 750 }
  ];
  const tradeCapGuard = evaluateInstrumentRiskGuardrails({
    plan: { maxDailyTrades: 3, maxDailyLossR: 3.0 },
    contract: { maxDailyTrades: 3, maxDailyLossR: 3.0, cooldownMinutes: 0 },
    trades: sampleTodayTrades,
    candidateTrade: {
      symbol: 'ES',
      assetClass: 'FUTURES',
      direction: 'LONG',
      entryPrice: 5000,
      stopLoss: 4995
    },
    candidateDate: '2026-10-04T14:00:00Z'
  });
  assert(tradeCapGuard.canTrade === false, 'Hard guardrail blocks further entry at 3/3 daily trade limit');
  assert(tradeCapGuard.breaches.some(b => b.code === 'PLAN_DAILY_TRADE_CAP'), 'Breach code PLAN_DAILY_TRADE_CAP flagged');

  // 6. Hard Guardrail - Daily Realized Loss Cap
  const sampleLossTrades = [
    { entryDate: '2026-10-04T09:00:00Z', rMultiple: -1.0, netPnL: -500 },
    { entryDate: '2026-10-04T11:00:00Z', rMultiple: -1.0, netPnL: -500 }
  ];
  const lossCapGuard = evaluateInstrumentRiskGuardrails({
    plan: { maxDailyTrades: 5, maxDailyLossR: 2.0 },
    contract: { maxDailyTrades: 5, maxDailyLossR: 2.0, cooldownMinutes: 0 },
    trades: sampleLossTrades,
    candidateTrade: {
      symbol: 'MES',
      assetClass: 'FUTURES',
      direction: 'LONG',
      entryPrice: 5000,
      stopLoss: 4995
    },
    candidateDate: '2026-10-04T12:00:00Z'
  });
  assert(lossCapGuard.canTrade === false, 'Hard guardrail blocks trading when daily loss stop (2.0R) is hit');
  assert(lossCapGuard.breaches.some(b => b.code === 'PLAN_DAILY_LOSS_CAP'), 'Breach code PLAN_DAILY_LOSS_CAP flagged');

  // 7. Hard Guardrail - Projected Daily Loss Cap (Preventing Potential Breach)
  // Current loss is 1.5R (under 2.0R limit). But a candidate trade risking 1.0R would bring projected loss to 2.5R!
  const candidateProjectedGuard = evaluateInstrumentRiskGuardrails({
    plan: { maxDailyTrades: 5, maxDailyLossR: 2.0, maxRiskPercent: 1.0 },
    contract: { maxDailyTrades: 5, maxDailyLossR: 2.0, cooldownMinutes: 0 },
    trades: [
      { entryDate: '2026-10-04T09:00:00Z', rMultiple: -1.5, netPnL: -750 }
    ],
    candidateTrade: {
      symbol: 'ES',
      assetClass: 'FUTURES',
      direction: 'LONG',
      entryPrice: 5000,
      stopLoss: 4995,
      quantity: 2 // 2 contracts = ~2.0R candidate risk
    },
    accountBalance: 50000,
    candidateDate: '2026-10-04T12:00:00Z'
  });
  assert(candidateProjectedGuard.canTrade === false, 'Hard guardrail blocks candidate trade whose projected loss breaches daily stop');
  assert(candidateProjectedGuard.breaches.some(b => b.code === 'PLAN_PROJECTED_LOSS_CAP'), 'Breach code PLAN_PROJECTED_LOSS_CAP flagged');

  // 8. Clear Explanation when the App says "PASS"
  const passingGuard = evaluateInstrumentRiskGuardrails({
    plan: { maxDailyTrades: 3, maxDailyLossR: 2.0, maxRiskPercent: 1.0, minimumRewardRisk: 2.0 },
    contract: { maxDailyTrades: 3, maxDailyLossR: 2.0, cooldownMinutes: 0, enforcePreSession: false },
    trades: [
      { entryDate: '2026-10-04T09:00:00Z', rMultiple: 1.5, netPnL: 750 }
    ],
    candidateTrade: {
      symbol: 'MES',
      assetClass: 'FUTURES',
      direction: 'LONG',
      entryPrice: 5000,
      stopLoss: 4995,
      takeProfit: 5015 // 3.0 RR
    },
    accountBalance: 50000,
    candidateDate: '2026-10-04T11:00:00Z'
  });
  assert(passingGuard.canTrade === true, 'All guardrails approve clean compliant trade');
  assertEquals(passingGuard.verdict, 'PASS', 'Verdict is PASS');
  assert(typeof passingGuard.explanation === 'string' && passingGuard.explanation.length > 50, 'Explanation is generated as a detailed string');
  assert(passingGuard.explanation.includes('PASS: RISK CHECKS VERIFIED ✓'), 'Explanation includes PASS header');
  assert(passingGuard.explanation.includes('Micro E-mini S&P 500'), 'Explanation mentions instrument name');
  assert(passingGuard.explanation.includes('Execution Friction:'), 'Explanation details friction breakdown');
  assert(passingGuard.explanation.includes('Total Committed Risk:'), 'Explanation details total committed risk');
  assert(passingGuard.explanation.includes('Daily Trade Guardrail:'), 'Explanation details daily trade limit status');
  assert(passingGuard.explanation.includes('Daily Loss Guardrail:'), 'Explanation details remaining loss buffer');

  // 9. Clear Explanation when the App says "BLOCK"
  assert(lossCapGuard.explanation.includes('HARD GUARDRAIL BLOCKED ⚠'), 'Blocked explanation includes alert headline');
  assert(lossCapGuard.explanation.includes('Remediation:'), 'Blocked explanation provides actionable remediation');
}

// 19. EXECUTION QUALITY & PROCESS VS OUTCOME COHORTS
console.log('\n--- Suite 19: Execution Quality & Process vs Outcome Cohorts ---');
{
  // 1. Four Written Rule Checkpoints Evaluation
  const fullyCompliantTrade = {
    symbol: 'ES',
    direction: 'LONG',
    rulesFollowed: { entry: true, stop: true, target: true, exit: true },
    netPnL: 500,
    rMultiple: 2.0
  };
  const execFull = evaluateExecutionQuality(fullyCompliantTrade);
  assertEquals(execFull.passedCount, 4, 'All 4 written rules followed');
  assertEquals(execFull.score, 100, 'Execution quality score = 100%');
  assertEquals(execFull.isFullyCompliant, true, 'Trade marked fully compliant');
  assertEquals(execFull.grade, 'A', 'Execution grade is A');
  assertEquals(execFull.breachedRules.length, 0, 'Zero breached rules');

  // 2. Partial Rule Compliance & Specific Breaches
  const stopBreachedTrade = {
    symbol: 'NQ',
    direction: 'SHORT',
    rulesFollowed: { entry: true, stop: false, target: true, exit: true },
    netPnL: -1500,
    rMultiple: -3.0
  };
  const execStopBreach = evaluateExecutionQuality(stopBreachedTrade);
  assertEquals(execStopBreach.passedCount, 3, '3/4 written rules followed');
  assertEquals(execStopBreach.score, 75, 'Execution quality score = 75%');
  assertEquals(execStopBreach.isFullyCompliant, false, 'Trade marked non-compliant');
  assert(execStopBreach.breachedRules.includes('stop'), 'Stop rule recorded as breached');

  // 3. Inference from Debrief and Violations when Rules Not Explicit
  const inferredTrade = {
    symbol: 'EURUSD',
    direction: 'LONG',
    debrief: {
      executionIntegrity: 'CHASED_EARLY',
      tradeManagement: 'CLOSED_PREMATURELY'
    },
    violations: ['CHASED_ENTRY', 'EARLY_EXIT'],
    stopLoss: 1.0800,
    takeProfit: 1.0900
  };
  const execInferred = evaluateExecutionQuality(inferredTrade);
  assertEquals(execInferred.rules.entry, false, 'Entry rule inferred as false from CHASED_ENTRY');
  assertEquals(execInferred.rules.exit, false, 'Exit rule inferred as false from EARLY_EXIT');
  assertEquals(execInferred.rules.stop, true, 'Stop rule inferred as true (stop defined & not widened)');
  assertEquals(execInferred.rules.target, true, 'Target rule inferred as true (target defined)');
  assertEquals(execInferred.passedCount, 2, '2/4 rules followed on inferred trade');

  // 4. Process vs Outcome Matrix (4 Quadrants)
  // Q1: Earned Win (Good Process + Win)
  const earnedWinTrade = {
    rulesFollowed: { entry: true, stop: true, target: true, exit: true },
    netPnL: 600,
    rMultiple: 2.0
  };
  const q1 = classifyProcessOutcome(earnedWinTrade);
  assertEquals(q1.quadrant, PROCESS_OUTCOME_QUADRANTS.EARNED_WIN, 'Q1: Earned Win classified correctly');
  assert(q1.isCompliant === true && q1.isWin === true, 'Earned win has compliant process and win outcome');

  // Q2: Compliant Loss (Good Process + Loss -> Valid probabilistic business expense)
  const compliantLossTrade = {
    rulesFollowed: { entry: true, stop: true, target: true, exit: true },
    netPnL: -300,
    rMultiple: -1.0
  };
  const q2 = classifyProcessOutcome(compliantLossTrade);
  assertEquals(q2.quadrant, PROCESS_OUTCOME_QUADRANTS.COMPLIANT_LOSS, 'Q2: Compliant Loss classified correctly');
  assert(q2.isCompliant === true && q2.isWin === false, 'Compliant loss has compliant process and loss outcome');
  assert(q2.insight.includes('routine business expenses, not operational mistakes'), 'Explains compliant loss as routine business cost, not an error');

  // Q3: Lucky Win (Bad Process + Win -> Hazardous toxic habit)
  const luckyWinTrade = {
    rulesFollowed: { entry: false, stop: false, target: false, exit: false },
    netPnL: 800,
    rMultiple: 2.5
  };
  const q3 = classifyProcessOutcome(luckyWinTrade);
  assertEquals(q3.quadrant, PROCESS_OUTCOME_QUADRANTS.LUCKY_WIN, 'Q3: Lucky Win classified correctly');
  assert(q3.isCompliant === false && q3.isWin === true, 'Lucky win has non-compliant process and win outcome');
  assert(q3.insight.includes('falsely reinforces undisciplined habits'), 'Warns against toxic habit reinforcement from lucky win');

  // Q4: Unforced Error (Bad Process + Loss -> Self-inflicted wound)
  const unforcedErrorTrade = {
    rulesFollowed: { entry: false, stop: false, target: true, exit: false },
    netPnL: -1200,
    rMultiple: -4.0
  };
  const q4 = classifyProcessOutcome(unforcedErrorTrade);
  assertEquals(q4.quadrant, PROCESS_OUTCOME_QUADRANTS.UNFORCED_ERROR, 'Q4: Unforced Error classified correctly');
  assert(q4.isCompliant === false && q4.isWin === false, 'Unforced error has non-compliant process and loss outcome');

  // 5. Cohort Comparison Over Time
  const testCohortTrades = [
    // 3 Compliant trades: 2 wins, 1 loss (Capped at -1.0R)
    { id: 'T-1', rulesFollowed: { entry: true, stop: true, target: true, exit: true }, netPnL: 400, rMultiple: 2.0 },
    { id: 'T-2', rulesFollowed: { entry: true, stop: true, target: true, exit: true }, netPnL: 300, rMultiple: 1.5 },
    { id: 'T-3', rulesFollowed: { entry: true, stop: true, target: true, exit: true }, netPnL: -200, rMultiple: -1.0 },
    // 2 Non-compliant trades: 1 lucky win (+1.0R), 1 blowout loss (-3.5R due to moving stop)
    { id: 'T-4', rulesFollowed: { entry: false, stop: true, target: true, exit: true }, netPnL: 200, rMultiple: 1.0 },
    { id: 'T-5', rulesFollowed: { entry: true, stop: false, target: true, exit: false }, netPnL: -700, rMultiple: -3.5 }
  ];

  const cohortComparison = compareExecutionCohorts(testCohortTrades);
  assertEquals(cohortComparison.totalTrades, 5, 'Total trades = 5');
  assertEquals(cohortComparison.complianceRate, 60, 'Compliance rate = 3/5 = 60%');
  assertEquals(cohortComparison.compliantCohort.count, 3, 'Compliant cohort count = 3');
  assertEquals(cohortComparison.nonCompliantCohort.count, 2, 'Non-compliant cohort count = 2');
  assertEquals(cohortComparison.compliantCohort.winRate, 67, 'Compliant cohort win rate = 67% (2/3)');
  assertEquals(cohortComparison.nonCompliantCohort.winRate, 50, 'Non-compliant cohort win rate = 50% (1/2)');
  assertEquals(cohortComparison.compliantCohort.worstLossR, 1.0, 'Compliant worst loss is capped at -1.0R');
  assertEquals(cohortComparison.nonCompliantCohort.worstLossR, 3.5, 'Non-compliant worst loss blew out to -3.5R');
  assert(cohortComparison.tailRiskRatio >= 3.0, 'Tail risk ratio reflects unmanaged loss in non-compliant trades');

  // 6. Phase Adherence Rates Breakdown
  assertEquals(cohortComparison.ruleBreakdown.entryComplianceRate, 80, 'Entry rule compliance = 4/5 = 80%');
  assertEquals(cohortComparison.ruleBreakdown.stopComplianceRate, 80, 'Stop rule compliance = 4/5 = 80%');
  assertEquals(cohortComparison.ruleBreakdown.targetComplianceRate, 100, 'Target rule compliance = 5/5 = 100%');
  assertEquals(cohortComparison.ruleBreakdown.exitComplianceRate, 80, 'Exit rule compliance = 4/5 = 80%');

  // 7. Non-Guarantee of Profits Disclaimer
  assert(typeof cohortComparison.disclaimer === 'string', 'Disclaimer is present');
  assert(cohortComparison.disclaimer.includes('Following written entry, stop, target, and exit rules does NOT guarantee'), 'Disclaimer states following rules does NOT guarantee profit');
  assert(cohortComparison.disclaimer.includes('Market results are probabilistic'), 'Disclaimer explains probabilistic nature of market results');
  assert(cohortComparison.disclaimer.includes('Discipline is about control over operational actions, not market outcomes'), 'Disclaimer emphasizes control over actions vs outcomes');
}

console.log('\n--- Suite 20: Trader History Review & Empirical Observations with Quantified Uncertainty ---');
{
  // 1. Wilson score confidence interval mathematical bounds
  const wilsonZero = calculateWilsonConfidenceInterval(0, 0);
  assertEquals(wilsonZero.percentage, 0, 'Zero sample size returns 0%');
  assertEquals(wilsonZero.formatted, '0.0% – 0.0%', 'Zero sample formatted cleanly');

  const wilsonPremature = calculateWilsonConfidenceInterval(13, 18);
  assertEquals(wilsonPremature.count, 13, 'Event count k = 13');
  assertEquals(wilsonPremature.total, 18, 'Sample size n = 18');
  assertEquals(wilsonPremature.percentage, 72.2, 'Proportion 13/18 = 72.2%');
  assertEquals(wilsonPremature.lowerPercent, 49.1, 'Wilson 95% CI lower bound = 49.1%');
  assertEquals(wilsonPremature.upperPercent, 87.5, 'Wilson 95% CI upper bound = 87.5%');
  assertEquals(wilsonPremature.formatted, '49.1% – 87.5%', 'Wilson interval string format correct');
  assert(wilsonPremature.lowerPercent <= wilsonPremature.upperPercent, 'Wilson interval lower <= upper');

  const wilsonBoundaryZero = calculateWilsonConfidenceInterval(0, 20);
  assertEquals(wilsonBoundaryZero.percentage, 0, '0 of 20 is 0%');
  assert(wilsonBoundaryZero.upperPercent > 0, 'Wilson upper bound on 0/20 does not artificially collapse to 0');

  const wilsonBoundaryFull = calculateWilsonConfidenceInterval(20, 20);
  assertEquals(wilsonBoundaryFull.percentage, 100, '20 of 20 is 100%');
  assert(wilsonBoundaryFull.lowerPercent < 100, 'Wilson lower bound on 20/20 reflects sample uncertainty');

  // 2. Continuous confidence interval (Sample Mean & Standard Error)
  const emptyContinuous = calculateContinuousConfidenceInterval([]);
  assertEquals(emptyContinuous.count, 0, 'Empty array count = 0');
  assertEquals(emptyContinuous.mean, 0, 'Empty array mean = 0');

  const singleContinuous = calculateContinuousConfidenceInterval([25.0]);
  assertEquals(singleContinuous.count, 1, 'Single element count = 1');
  assertEquals(singleContinuous.mean, 25.0, 'Single element mean = 25.0');
  assertEquals(singleContinuous.standardError, 0, 'Single element standard error = 0');

  const sampleCosts = [12, 15, 14, 18, 20];
  const costCI = calculateContinuousConfidenceInterval(sampleCosts);
  assertEquals(costCI.count, 5, 'Sample cost count = 5');
  assertEquals(costCI.mean, 15.8, 'Sample mean cost = 15.80');
  assertEquals(costCI.standardError, 1.43, 'Sample cost SE = 1.43');
  assertEquals(costCI.ciLower, 13.0, 'Sample cost 95% CI lower = 13.00');
  assertEquals(costCI.ciUpper, 18.6, 'Sample cost 95% CI upper = 18.60');
  assert(costCI.formatted.includes('15.80 ± 1.43'), 'Continuous CI string formatted with mean and SE');

  // 3. Trade cost extraction
  const explicitCostTrade = { commissions: 4.50, spreadCost: 12.50, slippageCost: 5.00 };
  assertEquals(extractTradeCost(explicitCostTrade), 22.0, 'Extracts explicit friction components');

  const specDerivedTrade = { symbol: 'ES', assetClass: 'FUTURES', quantity: 2 };
  const derivedCost = extractTradeCost(specDerivedTrade);
  assert(derivedCost > 0, 'Derives transaction friction from instrument specification');

  // 4. Session transaction cost drift observation
  // 45 morning trades ($6.20 average) vs 20 afternoon trades ($14.80 average)
  const sessionTrades = [];
  for (let i = 0; i < 45; i++) {
    sessionTrades.push({
      id: `MORNING-${i}`,
      session: 'MORNING',
      entryDate: `2026-08-${String(i % 25 + 1).padStart(2, '0')}T09:30:00Z`,
      commissions: 2.20,
      spreadCost: 2.00,
      slippageCost: 2.00, // Total = 6.20
      source: 'PERSONAL'
    });
  }
  for (let i = 0; i < 20; i++) {
    sessionTrades.push({
      id: `AFTERNOON-${i}`,
      session: 'AFTERNOON',
      entryDate: `2026-09-${String(i % 25 + 1).padStart(2, '0')}T14:30:00Z`,
      commissions: 4.80,
      spreadCost: 5.00,
      slippageCost: 5.00, // Total = 14.80
      source: 'PERSONAL'
    });
  }

  const costObservation = analyzeSessionCostDriftObservation(sessionTrades, 20);
  assert(costObservation !== null, 'Cost drift observation generated');
  assertEquals(costObservation.sampleSize, 20, 'Recent session sample size is 20');
  assertEquals(costObservation.priorSampleSize, 45, 'Prior session comparison sample size is 45');
  assertEquals(costObservation.metrics.recentMeanCost, 14.8, 'Recent mean cost is $14.80');
  assertEquals(costObservation.metrics.priorMeanCost, 6.2, 'Prior mean cost is $6.20');
  assert(costObservation.observation.includes('Your last 20 trades in the AFTERNOON session had higher average costs'), 'Observation phrases elevated session costs retrospectively');
  assert(costObservation.observation.includes('n = 20'), 'Observation specifies sample size n = 20');
  assert(costObservation.observation.includes('n = 45'), 'Observation specifies baseline sample size n = 45');
  assertEquals(costObservation.isPrediction, false, 'Observation is flagged as NOT a prediction');

  // 5. Target adherence & premature exit observation
  // 18 trades with planned target: 13 premature exits, 5 reached target
  const targetTrades = [];
  for (let i = 0; i < 13; i++) {
    targetTrades.push({
      id: `TARGET-EARLY-${i}`,
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 110, // Planned +2.0R
      exitPrice: 104,  // Realized +0.8R
      rMultiple: 0.8,
      violations: ['EARLY_EXIT'],
      rulesFollowed: { entry: true, stop: true, target: true, exit: false },
      netPnL: 80,
      source: 'PERSONAL'
    });
  }
  for (let i = 0; i < 5; i++) {
    targetTrades.push({
      id: `TARGET-REACHED-${i}`,
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 110,
      exitPrice: 110,
      rMultiple: 2.0,
      violations: [],
      rulesFollowed: { entry: true, stop: true, target: true, exit: true },
      netPnL: 200,
      source: 'PERSONAL'
    });
  }

  const targetObservation = analyzeTargetAdherenceObservation(targetTrades);
  assert(targetObservation !== null, 'Target adherence observation generated');
  assertEquals(targetObservation.sampleSize, 18, 'Sample size n = 18');
  assertEquals(targetObservation.eventCount, 13, 'Premature exit count k = 13');
  assertEquals(targetObservation.percentage, 72.2, 'Premature exit rate = 72.2%');
  assertEquals(targetObservation.uncertainty.formatted, '49.1% – 87.5%', 'Wilson 95% CI reported');
  assert(targetObservation.observation.includes('you often exited before your planned target'), 'Phrases observation as frequently exited before planned target');
  assert(targetObservation.observation.includes('n = 18'), 'Specifies target sample size');
  assert(targetObservation.observation.includes('49.1% – 87.5%'), 'Includes quantified uncertainty bounds');
  assertEquals(targetObservation.isPrediction, false, 'Target adherence observation is NOT a prediction');

  // 6. Stop loss invalidation & widening observation
  // 25 losing trades: 6 with stop widened, 19 with stop respected
  const lossTrades = [];
  for (let i = 0; i < 6; i++) {
    lossTrades.push({
      id: `LOSS-WIDENED-${i}`,
      netPnL: -250,
      plannedRiskDollars: 100,
      rMultiple: -2.5,
      violations: ['STOP_WIDENED'],
      rulesFollowed: { entry: true, stop: false, target: true, exit: true },
      source: 'PERSONAL'
    });
  }
  for (let i = 0; i < 19; i++) {
    lossTrades.push({
      id: `LOSS-NORMAL-${i}`,
      netPnL: -100,
      plannedRiskDollars: 100,
      rMultiple: -1.0,
      violations: [],
      rulesFollowed: { entry: true, stop: true, target: true, exit: true },
      source: 'PERSONAL'
    });
  }

  const stopObservation = analyzeStopAdherenceObservation(lossTrades);
  assert(stopObservation !== null, 'Stop loss observation generated');
  assertEquals(stopObservation.sampleSize, 25, 'Total losing trades n = 25');
  assertEquals(stopObservation.eventCount, 6, 'Widened stop count k = 6');
  assertEquals(stopObservation.percentage, 24.0, 'Widened stop rate = 24.0%');
  assert(stopObservation.observation.includes('Across your 25 recorded losing trades (n = 25)'), 'Mentions sample size in stop observation text');
  assert(stopObservation.observation.includes('stop loss was widened beyond planned initial risk in 6 trades (24.0%'), 'Details empirical widened stop count');
  assertEquals(stopObservation.isPrediction, false, 'Stop loss observation is NOT a prediction');

  // 7. Post-loss sequence observation
  const sequenceTrades = [
    { entryDate: '2026-09-01T10:00:00Z', netPnL: -100, source: 'PERSONAL' },
    { entryDate: '2026-09-01T11:00:00Z', netPnL: 100, isFullyCompliant: true, source: 'PERSONAL' },
    { entryDate: '2026-09-02T10:00:00Z', netPnL: -100, source: 'PERSONAL' },
    { entryDate: '2026-09-02T10:30:00Z', netPnL: -200, isFullyCompliant: false, violations: ['REVENGE_TRADE'], source: 'PERSONAL' },
    { entryDate: '2026-09-03T10:00:00Z', netPnL: 200, isFullyCompliant: true, source: 'PERSONAL' },
    { entryDate: '2026-09-03T14:00:00Z', netPnL: 150, isFullyCompliant: true, source: 'PERSONAL' }
  ];
  const postLossObs = analyzePostLossSequenceObservation(sequenceTrades);
  assert(postLossObs !== null, 'Post loss sequence observation generated');
  assertEquals(postLossObs.sampleSize, 3, 'Three trades executed immediately after a loss');
  assertEquals(postLossObs.comparisonSampleSize, 2, 'Two trades executed immediately after a win');
  assertEquals(postLossObs.isPrediction, false, 'Post-loss observation is NOT a prediction');

  // 8. Sample size caveats
  assertEquals(getSampleSizeCaveat(0), 'No historical data recorded.', 'Caveat for n = 0');
  assert(getSampleSizeCaveat(8).includes('Preliminary observation (8 trades)'), 'Caveat for n < 10 notes high variance');
  assert(getSampleSizeCaveat(18).includes('Limited sample size (18 trades, n < 30)'), 'Caveat for n < 30 notes wide confidence intervals');
  assert(getSampleSizeCaveat(45).includes('Robust sample size (45 trades, n ≥ 30)'), 'Caveat for n >= 30 notes statistical stability');

  // 9. Master history review generator & sample data exclusion
  const mixedTrades = [
    ...targetTrades,
    { id: 'SAMPLE-1', source: 'SAMPLE', executionMode: 'SAMPLE', takeProfit: 120, entryPrice: 100, exitPrice: 102 }
  ];

  const reviewReportDefault = generateTraderHistoryObservations(mixedTrades, { excludeSample: true });
  assertEquals(reviewReportDefault.scope, 'PERSONAL_AND_IMPORTED', 'Default review scope isolates trader personal/imported data');
  assertEquals(reviewReportDefault.totalTradesAnalyzed, 18, 'Sample trade excluded from trader history analysis');
  assert(reviewReportDefault.observations.length >= 1, 'Generates empirical observations');
  assertEquals(reviewReportDefault.isPrediction, false, 'Report flagged as non-predictive');

  // Verify every observation meets the requirements:
  reviewReportDefault.observations.forEach(obs => {
    assert(Number.isInteger(obs.sampleSize), `Observation ${obs.id} has integer sample size`);
    assert(obs.sampleSize > 0, `Observation ${obs.id} sample size > 0`);
    assert(obs.uncertainty !== undefined, `Observation ${obs.id} has quantified uncertainty`);
    assertEquals(obs.isPrediction, false, `Observation ${obs.id} has isPrediction === false`);
    assert(typeof obs.sampleSizeCaveat === 'string', `Observation ${obs.id} has sample size caveat`);
  });

  // 10. Reporting integration
  const fullSummaryReport = buildTradeSummaryReport(targetTrades);
  assert(Array.isArray(fullSummaryReport.observations), 'Summary report includes observations array');
  assert(fullSummaryReport.reviewReport !== undefined, 'Summary report includes reviewReport object');
  assertEquals(fullSummaryReport.observations[0].sampleSize, 18, 'Report observation reflects sample size');

  // 11. Epistemological disclaimer
  assert(REVIEW_DISCLAIMER.text.includes('All review statements are strictly descriptive observations'), 'Disclaimer states observations are descriptive');
  assert(REVIEW_DISCLAIMER.text.includes('not constitute forward predictions'), 'Disclaimer confirms no forward predictions');
  assertEquals(REVIEW_DISCLAIMER.isPrediction, false, 'Disclaimer declares isPrediction: false');
}

console.log('\n--- Suite 21: Deliberate Review-and-Pause & Pre-Entry Commitment Engine ---');
{
  // 1. Philosophy & Anti-Pressure Principles
  assert(DELIBERATE_PAUSE_PRINCIPLES.aim.includes('Reduce impulsive decisions'), 'Deliberate pause aims to reduce impulsive decisions');
  assert(DELIBERATE_PAUSE_PRINCIPLES.aim.includes('zero gamification or pressure to trade more'), 'Deliberate pause rejects gamification and pressure to trade');
  assert(DELIBERATE_PAUSE_PRINCIPLES.goldenRules.length >= 4, 'Includes core golden rules of restraint');

  // 2. Pre-Entry Plan Validation
  const emptyValidation = validatePreEntryPlan({});
  assertEquals(emptyValidation.valid, false, 'Empty plan fails validation');
  assert(emptyValidation.errors.length >= 3, 'Reports missing symbol, entry price, and stop loss');

  // Long stop loss must be BELOW entry
  const invalidLongPlan = validatePreEntryPlan({
    symbol: 'ES',
    direction: 'LONG',
    plannedEntryPrice: 5000,
    plannedStopLoss: 5010
  });
  assertEquals(invalidLongPlan.valid, false, 'Long stop loss above entry price fails validation');
  assert(invalidLongPlan.errors[0].includes('Long stop loss must be placed BELOW'), 'Explains long stop loss geometry');

  // Short stop loss must be ABOVE entry
  const invalidShortPlan = validatePreEntryPlan({
    symbol: 'NQ',
    direction: 'SHORT',
    plannedEntryPrice: 18000,
    plannedStopLoss: 17900
  });
  assertEquals(invalidShortPlan.valid, false, 'Short stop loss below entry price fails validation');
  assert(invalidShortPlan.errors[0].includes('Short stop loss must be placed ABOVE'), 'Explains short stop loss geometry');

  // Valid long plan
  const validLongPlan = createPreEntryPlan({
    symbol: 'ES',
    direction: 'LONG',
    setupId: 'BREAK_AND_RETEST',
    plannedEntryPrice: 5000,
    plannedStopLoss: 4980,
    plannedTakeProfit: 5060,
    plannedRiskDollars: 250,
    thesis: 'Retest of previous session high with volume support',
    confluenceFactors: ['HTF_LEVEL', 'SESSION_VWAP'],
    mentalCheck: { isCalm: true, waitedForSetup: true, acceptsRisk: true }
  });
  assertEquals(validLongPlan.valid, true, 'Valid long plan passes creation');
  assert(validLongPlan.plan.id.startsWith('PLAN-'), 'Plan receives unique PLAN- ID');
  assertEquals(validLongPlan.plan.stopDistance, 20, 'Stop distance is 20 points');
  assertEquals(validLongPlan.plan.plannedRR, 3.0, 'Planned R:R is 3.00 (60/20)');
  assertEquals(validLongPlan.plan.status, 'PENDING', 'Initial plan status is PENDING');
  assertEquals(validLongPlan.plan.mentalCheck.isCalm, true, 'Pre-entry mental check recorded');

  // 3. Linking Plan to Executed Trade with Slippage
  const rawExecutedTrade = {
    id: 'TRADE-101',
    symbol: 'ES',
    direction: 'LONG',
    entryPrice: 5001.50,
    exitPrice: 5060.00,
    netPnL: 585,
    rMultiple: 2.92
  };
  const linkedTrade = linkPlanToExecutedTrade(validLongPlan.plan, rawExecutedTrade);
  assertEquals(linkedTrade.planId, validLongPlan.plan.id, 'Executed trade linked to plan ID');
  assertEquals(linkedTrade.wasPrePlanned, true, 'Trade tagged as wasPrePlanned');
  assertEquals(linkedTrade.entrySlippage, 1.5, 'Tracks execution slippage between actual and planned entry (5001.5 - 5000)');
  assertEquals(linkedTrade.plannedRR, 3.0, 'Preserves planned R:R in trade record');

  // 4. Missed Setups & Discipline Wins Analysis
  const intentionalPass = createMissedSetup({
    symbol: 'NQ',
    setupId: 'ORB',
    direction: 'LONG',
    reasonCode: 'INTENTIONAL_LIMIT_STAND_DOWN',
    reflection: 'Daily trade limit reached. Respected stand-down rule.'
  });
  assertEquals(intentionalPass.isDisciplineWin, true, 'Intentional stand-down is classified as a Discipline Win');
  assert(intentionalPass.id.startsWith('MISSED-'), 'Missed setup receives MISSED- ID');

  const runawayPass = createMissedSetup({
    symbol: 'CL',
    setupId: 'BREAKOUT',
    direction: 'LONG',
    reasonCode: 'CHASED_RUNAWAY_DID_NOT_CHASE',
    reflection: 'Price gapped up before trigger. Did not chase.'
  });
  assertEquals(runawayPass.isDisciplineWin, true, 'Resisting chasing runaway price is classified as a Discipline Win');

  const fearHesitation = createMissedSetup({
    symbol: 'GC',
    setupId: 'PULLBACK',
    direction: 'SHORT',
    reasonCode: 'HESITATED_FEAR',
    reflection: 'Valid signal but hesitated due to recent loss anxiety.'
  });
  assertEquals(fearHesitation.isDisciplineWin, false, 'Fear hesitation is not a discipline win');

  const missedAnalysis = analyzeMissedSetups([intentionalPass, runawayPass, fearHesitation]);
  assertEquals(missedAnalysis.totalMissedCount, 3, 'Total missed setups logged = 3');
  assertEquals(missedAnalysis.disciplineWinsCount, 2, 'Discipline wins = 2');
  assertEquals(missedAnalysis.hesitationsCount, 1, 'Hesitations count = 1');
  assertEquals(missedAnalysis.disciplineWinPercent, 66.7, 'Discipline win rate = 66.7% (2/3)');
  assert(missedAnalysis.uncertainty.formatted !== undefined, 'Wilson 95% CI computed for missed setup restraint rate');
  assert(missedAnalysis.summaryObservation.includes('Passing a setup costs $0'), 'Observation emphasizes that passing costs $0 and preserves mental capital');

  // 5. Post-Trade Violation Analysis & Pause Duration
  const standardViolation = documentRuleViolationRecord(
    { id: 'T-VIOL-1', symbol: 'ES' },
    { breachedRule: 'LATE_ENTRY', rootCause: 'FOMO', notes: 'Jumped in after 3 green bars' }
  );
  assertEquals(standardViolation.rootCause, 'FOMO', 'Documents FOMO root cause');
  assertEquals(standardViolation.recommendedPauseMinutes, 20, 'Standard violation recommends 20-minute pause');
  assert(standardViolation.remediationAction.includes('20-minute deliberate pause'), 'Remediation mandates stepping away to break emotional loop');

  const severeRevengeViolation = documentRuleViolationRecord(
    { id: 'T-VIOL-2', symbol: 'NQ' },
    { breachedRule: 'REVENGE', rootCause: 'REVENGE', notes: 'Re-entered immediately after stop out' }
  );
  assertEquals(severeRevengeViolation.recommendedPauseMinutes, 45, 'Revenge violation requires extended 45-minute deliberate pause');

  // 6. Master Session Limits and Deliberate Pause Evaluation
  const fixedNow = '2026-10-05T14:00:00.000Z';

  // 6a. Clean Session (under limits)
  const cleanEval = evaluateSessionLimitsAndPause({
    trades: [
      { id: 'T1', entryDate: '2026-10-05T10:00:00.000Z', exitDate: '2026-10-05T10:30:00.000Z', netPnL: 150, rMultiple: 1.5, source: 'PERSONAL' }
    ],
    tradingPlan: { maxDailyTrades: 3, maxDailyLossR: 2.0 },
    contract: { cooldownMinutes: 30 },
    currentTime: fixedNow,
    minPacingMinutes: 15
  });
  assertEquals(cleanEval.standDownStatus, STAND_DOWN_STATUSES.OPEN, 'Clean session status is OPEN');
  assertEquals(cleanEval.isTradingAllowed, true, 'Trading is allowed when under limits');
  assertEquals(cleanEval.isDeliberatePauseActive, false, 'No deliberate pause active during open session');
  assertEquals(cleanEval.todayTradesCount, 1, 'Today trade count is 1');

  // 6b. Daily Trade Limit Reached -> Stand-Down
  const tradeCapEval = evaluateSessionLimitsAndPause({
    trades: [
      { id: 'T1', entryDate: '2026-10-05T09:30:00.000Z', exitDate: '2026-10-05T10:00:00.000Z', netPnL: 100, rMultiple: 1.0, source: 'PERSONAL' },
      { id: 'T2', entryDate: '2026-10-05T10:30:00.000Z', exitDate: '2026-10-05T11:00:00.000Z', netPnL: -100, rMultiple: -1.0, source: 'PERSONAL' },
      { id: 'T3', entryDate: '2026-10-05T12:00:00.000Z', exitDate: '2026-10-05T12:30:00.000Z', netPnL: 50, rMultiple: 0.5, source: 'PERSONAL' }
    ],
    tradingPlan: { maxDailyTrades: 3, maxDailyLossR: 2.0 },
    currentTime: fixedNow
  });
  assertEquals(tradeCapEval.standDownStatus, STAND_DOWN_STATUSES.LIMIT_REACHED_STAND_DOWN, 'Trade cap triggers LIMIT_REACHED_STAND_DOWN');
  assertEquals(tradeCapEval.isTradingAllowed, false, 'Trading disabled when daily trade cap reached');
  assertEquals(tradeCapEval.isDeliberatePauseActive, true, 'Stand-down pause is active');
  assert(tradeCapEval.headline.includes('DAILY TRADE CAP REACHED'), 'Headline alerts daily trade cap reached');
  assert(tradeCapEval.standDownActionSteps.length >= 2, 'Provides clear actionable stand-down steps');

  // 6c. Daily Loss Ceiling Reached -> Stand-Down
  const lossCapEval = evaluateSessionLimitsAndPause({
    trades: [
      { id: 'TL1', entryDate: '2026-10-05T09:30:00.000Z', exitDate: '2026-10-05T10:00:00.000Z', netPnL: -100, rMultiple: -1.0, source: 'PERSONAL' },
      { id: 'TL2', entryDate: '2026-10-05T11:00:00.000Z', exitDate: '2026-10-05T11:30:00.000Z', netPnL: -120, rMultiple: -1.2, source: 'PERSONAL' }
    ],
    tradingPlan: { maxDailyTrades: 5, maxDailyLossR: 2.0 },
    currentTime: fixedNow
  });
  assertEquals(lossCapEval.standDownStatus, STAND_DOWN_STATUSES.LIMIT_REACHED_STAND_DOWN, 'Loss limit triggers LIMIT_REACHED_STAND_DOWN');
  assertEquals(lossCapEval.isTradingAllowed, false, 'Trading disabled when daily loss limit hit');
  assertEquals(lossCapEval.todayLossR, 2.2, 'Accumulated daily loss is 2.20R');
  assert(lossCapEval.headline.includes('DAILY LOSS CEILING REACHED'), 'Headline alerts daily loss ceiling reached');

  // 6d. Circuit Breaker on 3 Consecutive Losses
  const circuitBreakerEval = evaluateSessionLimitsAndPause({
    trades: [
      { id: 'TC1', entryDate: '2026-10-05T09:30:00.000Z', exitDate: '2026-10-05T10:00:00.000Z', netPnL: -50, rMultiple: -0.5, source: 'PERSONAL' },
      { id: 'TC2', entryDate: '2026-10-05T10:30:00.000Z', exitDate: '2026-10-05T11:00:00.000Z', netPnL: -50, rMultiple: -0.5, source: 'PERSONAL' },
      { id: 'TC3', entryDate: '2026-10-05T11:30:00.000Z', exitDate: '2026-10-05T12:00:00.000Z', netPnL: -50, rMultiple: -0.5, source: 'PERSONAL' }
    ],
    tradingPlan: { maxDailyTrades: 5, maxDailyLossR: 3.0 },
    currentTime: fixedNow
  });
  assertEquals(circuitBreakerEval.standDownStatus, STAND_DOWN_STATUSES.CIRCUIT_BREAKER_LOCKED, '3 consecutive losses triggers CIRCUIT_BREAKER_LOCKED');
  assertEquals(circuitBreakerEval.isTradingAllowed, false, 'Trading locked out by circuit breaker');
  assert(circuitBreakerEval.headline.includes('CIRCUIT BREAKER LOCKOUT'), 'Circuit breaker lockout headline displayed');

  // 6e. Mandatory Post-Loss Cooldown
  // Loss closed 10 minutes ago, cooldown is 30 minutes
  const cooldownEval = evaluateSessionLimitsAndPause({
    trades: [
      { id: 'TCL', entryDate: '2026-10-05T13:40:00.000Z', exitDate: '2026-10-05T13:50:00.000Z', netPnL: -100, rMultiple: -1.0, source: 'PERSONAL' }
    ],
    tradingPlan: { maxDailyTrades: 5, maxDailyLossR: 3.0 },
    contract: { cooldownMinutes: 30 },
    currentTime: fixedNow
  });
  assertEquals(cooldownEval.standDownStatus, STAND_DOWN_STATUSES.COOLDOWN_ACTIVE, 'Recent loss triggers COOLDOWN_ACTIVE');
  assertEquals(cooldownEval.isTradingAllowed, false, 'Trading paused during mandatory cooldown');
  assert(cooldownEval.remainingCooldownSeconds > 0, 'Remaining cooldown seconds calculated');
  assert(cooldownEval.headline.includes('MANDATORY COOLDOWN ACTIVE'), 'Cooldown headline displayed');

  // 6f. Inter-Trade Pacing Pause (preventing rapid-fire entries)
  // Win closed 5 minutes ago, pacing interval is 15 minutes
  const pacingEval = evaluateSessionLimitsAndPause({
    trades: [
      { id: 'TP', entryDate: '2026-10-05T13:50:00.000Z', exitDate: '2026-10-05T13:55:00.000Z', netPnL: 100, rMultiple: 1.0, source: 'PERSONAL' }
    ],
    tradingPlan: { maxDailyTrades: 5, maxDailyLossR: 3.0 },
    currentTime: fixedNow,
    minPacingMinutes: 15
  });
  assertEquals(pacingEval.standDownStatus, STAND_DOWN_STATUSES.PACING_PAUSE, 'Recent close triggers PACING_PAUSE');
  assertEquals(pacingEval.isTradingAllowed, false, 'Trading paused during cognitive reset pacing window');
  assertEquals(pacingEval.pacingMinutesRemaining, 10, 'Calculates 10 minutes remaining in pacing window');

  // 6g. Sample Trades Exclusion in Session Limits
  const sampleSessionEval = evaluateSessionLimitsAndPause({
    trades: [
      { id: 'SAMPLE-1', entryDate: '2026-10-05T09:30:00.000Z', exitDate: '2026-10-05T10:00:00.000Z', netPnL: -500, rMultiple: -5.0, source: 'SAMPLE' },
      { id: 'SAMPLE-2', entryDate: '2026-10-05T10:30:00.000Z', exitDate: '2026-10-05T11:00:00.000Z', netPnL: -500, rMultiple: -5.0, source: 'SAMPLE' },
      { id: 'SAMPLE-3', entryDate: '2026-10-05T11:30:00.000Z', exitDate: '2026-10-05T12:00:00.000Z', netPnL: -500, rMultiple: -5.0, source: 'SAMPLE' }
    ],
    tradingPlan: { maxDailyTrades: 3, maxDailyLossR: 2.0 },
    currentTime: fixedNow
  });
  assertEquals(sampleSessionEval.todayTradesCount, 0, 'Sample trades are excluded from trader daily session calculations');
  assertEquals(sampleSessionEval.standDownStatus, STAND_DOWN_STATUSES.OPEN, 'Sample trades do not consume trader daily limits');

  // 7. Anti-Pressure and Reflection Prompts
  assert(cleanEval.reflectionPrompts.length >= 3, 'Reflection prompts provided to cultivate deliberate pause');
  assert(cleanEval.antiPressurePhilosophy.includes('zero gamification'), 'Anti-pressure philosophy explicit in session status');
}

console.log('\n--- Suite 22: Visual Trade Journal, Screenshot Ingestion & Dual Lightbox Engine ---');
{
  // 1. Allowed Image Types & Tag Definitions
  assert(ALLOWED_IMAGE_TYPES.includes('image/png'), 'PNG image type is allowed');
  assert(ALLOWED_IMAGE_TYPES.includes('image/jpeg'), 'JPEG image type is allowed');
  assert(ALLOWED_IMAGE_TYPES.includes('image/webp'), 'WEBP image type is allowed');
  assert(SCREENSHOT_TAGS.PRE_ENTRY !== undefined, 'PRE_ENTRY screenshot tag defined');
  assert(SCREENSHOT_TAGS.OUTCOME !== undefined, 'OUTCOME screenshot tag defined');
  assert(SCREENSHOT_TAGS.MISSED !== undefined, 'MISSED screenshot tag defined');

  // 2. Image Attachment Validation
  const emptyImg = validateImageAttachment({});
  assertEquals(emptyImg.valid, false, 'Empty attachment fails validation');
  assert(emptyImg.errors[0].includes('MIME type is required'), 'MIME type required error reported');

  const unsupportedImg = validateImageAttachment({ mimeType: 'application/pdf', sizeBytes: 5000 });
  assertEquals(unsupportedImg.valid, false, 'PDF is rejected as screenshot');
  assert(unsupportedImg.errors[0].includes('Unsupported image type'), 'Explains allowed formats');

  const oversizeImg = validateImageAttachment({ mimeType: 'image/png', sizeBytes: 15 * 1024 * 1024 });
  assertEquals(oversizeImg.valid, false, 'Oversized image (>10MB) is rejected');
  assert(oversizeImg.errors[0].includes('exceeds maximum allowed limit'), 'Reports 10MB limit error');

  const validImg = validateImageAttachment({ mimeType: 'image/png', sizeBytes: 1024 * 1024, tag: 'PRE_ENTRY' });
  assertEquals(validImg.valid, true, 'Valid 1MB PNG image passes validation');

  // 3. Creating Visual Evidence Record
  const createdRecordResult = createVisualEvidenceRecord({
    mimeType: 'image/png',
    sizeBytes: 45000,
    tag: 'PRE_ENTRY',
    url: '/data/screenshots/shot_test_1.png',
    caption: '15m Bearish Order Block and Liquidity Sweep',
    entityType: 'TRADE',
    entityId: 'TR-1001'
  });
  assertEquals(createdRecordResult.valid, true, 'Visual evidence record created successfully');
  assert(createdRecordResult.record.id.startsWith('IMG-'), 'Visual record receives IMG- ID');
  assertEquals(createdRecordResult.record.tag, 'PRE_ENTRY', 'Assigned PRE_ENTRY tag');
  assertEquals(createdRecordResult.record.tagLabel, 'Pre-Entry Setup (Before)', 'Assigned human-readable tag label');
  assertEquals(createdRecordResult.record.url, '/data/screenshots/shot_test_1.png', 'Stored accessible URL');

  // 4. Linking Screenshots to Trade
  const baseTrade = {
    id: 'TR-1002',
    symbol: 'ES',
    direction: 'LONG',
    entryPrice: 5000,
    stopLoss: 4980
  };
  const preEntryShot = { tag: 'PRE_ENTRY', url: '/data/screenshots/shot_before.png' };
  const outcomeShot = { tag: 'OUTCOME', url: '/data/screenshots/shot_after.png' };

  const linkedTradeSingle = linkScreenshotsToTrade(baseTrade, [preEntryShot]);
  assertEquals(linkedTradeSingle.hasPreEntryScreenshot, true, 'Flags hasPreEntryScreenshot: true');
  assertEquals(linkedTradeSingle.hasOutcomeScreenshot, false, 'Flags hasOutcomeScreenshot: false');
  assertEquals(linkedTradeSingle.hasVisualEvidence, true, 'Flags hasVisualEvidence: true');
  assertEquals(linkedTradeSingle.preEntryScreenshotUrl, '/data/screenshots/shot_before.png', 'Sets preEntryScreenshotUrl');

  const linkedTradeDual = linkScreenshotsToTrade(baseTrade, [preEntryShot, outcomeShot]);
  assertEquals(linkedTradeDual.hasPreEntryScreenshot, true, 'Dual hasPreEntryScreenshot: true');
  assertEquals(linkedTradeDual.hasOutcomeScreenshot, true, 'Dual hasOutcomeScreenshot: true');
  assertEquals(linkedTradeDual.hasVisualEvidence, true, 'Dual hasVisualEvidence: true');

  // 5. Visual Evidence Metrics Calculation
  const testTrades = [
    { id: 'T1', source: 'PERSONAL', hasVisualEvidence: true, hasPreEntryScreenshot: true, hasOutcomeScreenshot: true, isFullyCompliant: true, rMultiple: 2.0, netPnL: 200 },
    { id: 'T2', source: 'PERSONAL', hasVisualEvidence: true, hasPreEntryScreenshot: true, hasOutcomeScreenshot: false, isFullyCompliant: true, rMultiple: -1.0, netPnL: -100 },
    { id: 'T3', source: 'PERSONAL', hasVisualEvidence: false, isFullyCompliant: false, rMultiple: -2.0, netPnL: -200 },
    { id: 'T4', source: 'PERSONAL', hasVisualEvidence: false, isFullyCompliant: false, rMultiple: 1.0, netPnL: 100 },
    { id: 'T5', source: 'PERSONAL', hasVisualEvidence: true, hasPreEntryScreenshot: true, hasOutcomeScreenshot: true, isFullyCompliant: true, rMultiple: 3.0, netPnL: 300 },
    { id: 'T-SAMPLE', source: 'SAMPLE', hasVisualEvidence: true, hasPreEntryScreenshot: true, hasOutcomeScreenshot: true } // should be ignored
  ];

  const metrics = calculateVisualEvidenceMetrics(testTrades, [{ screenshotUrl: '/test.png' }], [{ screenshotUrl: '/missed.png' }]);
  assertEquals(metrics.totalTrades, 5, 'Excludes sample trades from total trade count (5 personal trades)');
  assertEquals(metrics.tradesWithVisuals, 3, '3 trades with visual chart attachments');
  assertEquals(metrics.visualCoveragePercent, 60.0, '60.0% visual coverage (3/5)');
  assertEquals(metrics.tradesWithBeforeAndAfter, 2, '2 trades with dual Before & After split');
  assertEquals(metrics.beforeAndAfterPercent, 40.0, '40.0% dual chart coverage (2/5)');
  assert(metrics.visualCoverageCI.formatted !== undefined, 'Calculates Wilson 95% CI on visual coverage');
  assertEquals(metrics.plansWithVisuals, 1, 'Counts 1 plan with visuals');
  assertEquals(metrics.missedWithVisuals, 1, 'Counts 1 missed setup with visuals');

  // 6. Visual Accountability Cohort Comparison
  const cohorts = compareVisualAccountabilityCohorts(testTrades);
  assertEquals(cohorts.totalTrades, 5, 'Evaluates 5 personal trades');
  assertEquals(cohorts.documentedCohort.count, 3, 'Documented cohort has 3 trades');
  assertEquals(cohorts.undocumentedCohort.count, 2, 'Undocumented cohort has 2 trades');
  assertEquals(cohorts.documentedCohort.complianceRate, 100.0, 'Documented trades had 100% process compliance (3/3)');
  assertEquals(cohorts.undocumentedCohort.complianceRate, 0.0, 'Undocumented trades had 0% process compliance (0/2)');
  assertEquals(cohorts.complianceDelta, 100.0, 'Compliance delta = +100%');
  assertEquals(cohorts.isPrediction, false, 'Accountability comparison flagged as NOT a prediction');
  assert(cohorts.disclaimer.includes('does not guarantee future trading profits'), 'Includes clear epistemological disclaimer');

  // 7. Visual Journal Observations Generation
  const observations = generateVisualJournalObservations(testTrades);
  assert(observations.length >= 2, 'Generates empirical visual observations');
  const coverageObs = observations.find(o => o.id === 'visual-coverage-rate');
  assert(coverageObs !== undefined, 'Surfaces visual coverage observation');
  assertEquals(coverageObs.sampleSize, 5, 'Sample size n = 5');
  assertEquals(coverageObs.eventCount, 3, 'Event count k = 3');
  assertEquals(coverageObs.percentage, 60.0, 'Percentage = 60.0%');
  assertEquals(coverageObs.isPrediction, false, 'Observation marked isPrediction: false');

  const beforeAfterObs = observations.find(o => o.id === 'before-after-coverage');
  assert(beforeAfterObs !== undefined, 'Surfaces dual Before/After coverage observation');
  assertEquals(beforeAfterObs.eventCount, 2, 'Dual chart count = 2');
}

console.log('\n--- Suite 23: Interactive Calendar & Session Heatmap Engine ---');
{
  // 1. Session Block Constants & Definitions
  assertEquals(SESSION_ORDER.length, 5, 'Defines 5 core session blocks');
  assertEquals(SESSION_BLOCKS.LONDON.id, 'LONDON', 'London session defined');
  assertEquals(SESSION_BLOCKS.NEW_YORK_AM.id, 'NEW_YORK_AM', 'New York AM session defined');
  assertEquals(SESSION_BLOCKS.NEW_YORK_PM.id, 'NEW_YORK_PM', 'New York PM session defined');
  assertEquals(SESSION_BLOCKS.ASIAN.id, 'ASIAN', 'Asian session defined');
  assertEquals(SESSION_BLOCKS.OVERNIGHT.id, 'OVERNIGHT', 'Overnight session defined');
  assertEquals(DAYS_OF_WEEK.length, 7, '7 days of the week defined starting Monday');
  assertEquals(DAYS_OF_WEEK[0].key, 'MONDAY', 'Week starts on Monday');

  // 2. Session Classification Engine
  // Explicit session string
  assertEquals(classifySessionBlock({ session: 'LONDON' }).id, 'LONDON', 'Classifies explicit London session');
  assertEquals(classifySessionBlock({ session: 'New York AM' }).id, 'NEW_YORK_AM', 'Classifies explicit New York AM session');
  assertEquals(classifySessionBlock({ session: 'NY PM' }).id, 'NEW_YORK_PM', 'Classifies explicit NY PM session');
  assertEquals(classifySessionBlock({ session: 'ASIAN' }).id, 'ASIAN', 'Classifies explicit Asian session');
  assertEquals(classifySessionBlock({ session: 'OVERNIGHT' }).id, 'OVERNIGHT', 'Classifies explicit Overnight session');

  // Automatic timestamp classification
  assertEquals(classifySessionBlock({ entryDate: '2026-09-21T03:30:00Z' }).id, 'ASIAN', '03:30 UTC classified as ASIAN');
  assertEquals(classifySessionBlock({ entryDate: '2026-09-21T09:15:00Z' }).id, 'LONDON', '09:15 UTC classified as LONDON');
  assertEquals(classifySessionBlock({ entryDate: '2026-09-21T14:30:00Z' }).id, 'NEW_YORK_AM', '14:30 UTC classified as NEW_YORK_AM');
  assertEquals(classifySessionBlock({ entryDate: '2026-09-21T18:00:00Z' }).id, 'NEW_YORK_PM', '18:00 UTC classified as NEW_YORK_PM');
  assertEquals(classifySessionBlock({ entryDate: '2026-09-21T22:30:00Z' }).id, 'OVERNIGHT', '22:30 UTC classified as OVERNIGHT');

  // 3. Date Key Normalization
  assertEquals(formatDateKey('2026-09-21T09:15:00Z'), '2026-09-21', 'Normalizes ISO timestamp to YYYY-MM-DD');
  assertEquals(formatDateKey('2026-09-21'), '2026-09-21', 'Preserves clean YYYY-MM-DD');
  assertEquals(formatDateKey(new Date(Date.UTC(2026, 8, 22, 14, 0))), '2026-09-22', 'Converts Date object to YYYY-MM-DD');

  // 4. Daily Activity Aggregator with Sample Isolation
  const sampleTrades = [
    { id: 'T-SMP1', source: 'SAMPLE', entryDate: '2026-09-21T09:00:00Z', netPnL: 500, rMultiple: 2.0, isFullyCompliant: true }
  ];
  const personalTrades = [
    // 2026-09-21: London win, NY AM loss
    { id: 'T1', source: 'PERSONAL', entryDate: '2026-09-21T09:15:00Z', netPnL: 250, rMultiple: 2.5, isFullyCompliant: true, hasVisualEvidence: true, preEntryScreenshotUrl: '/before.png' },
    { id: 'T2', source: 'PERSONAL', entryDate: '2026-09-21T14:45:00Z', netPnL: -100, rMultiple: -1.0, isFullyCompliant: false, violations: ['LATE_CHASE'] },
    // 2026-09-22: London win
    { id: 'T3', source: 'PERSONAL', entryDate: '2026-09-22T08:30:00Z', netPnL: 300, rMultiple: 3.0, isFullyCompliant: true, hasVisualEvidence: true, outcomeScreenshotUrl: '/after.png' },
    // 2026-09-23: NY PM loss
    { id: 'T4', source: 'PERSONAL', entryDate: '2026-09-23T19:00:00Z', netPnL: -150, rMultiple: -1.5, isFullyCompliant: true }
  ];
  const testPlans = [
    { id: 'P1', plannedAt: '2026-09-21T08:45:00Z', symbol: 'EURUSD', screenshotUrl: '/plan_chart.png' }
  ];
  const testMissed = [
    { id: 'M1', loggedAt: '2026-09-21T11:00:00Z', symbol: 'GBPUSD', isDisciplineWin: true }
  ];

  const allTrades = [...sampleTrades, ...personalTrades];
  const dailyMap = aggregateDailyActivity(allTrades, testPlans, testMissed, { excludeSample: true });

  const day21 = dailyMap.get('2026-09-21');
  assert(day21 !== undefined, '2026-09-21 aggregated in daily map');
  assertEquals(day21.totalTrades, 2, 'Sample trade excluded: 2 personal trades on 2026-09-21');
  assertEquals(day21.netPnL, 150, 'Net PnL = +150 (250 - 100)');
  assertEquals(day21.wins, 1, '1 win');
  assertEquals(day21.losses, 1, '1 loss');
  assertEquals(day21.winRate, 50.0, 'Win rate = 50.0%');
  assertEquals(day21.compliantTrades, 1, '1 compliant trade');
  assertEquals(day21.complianceRate, 50.0, 'Compliance rate = 50.0%');
  assertEquals(day21.hasVisualEvidence, true, 'Visual evidence detected on day');
  assertEquals(day21.plansCount, 1, '1 pre-entry plan logged on day');
  assertEquals(day21.missedCount, 1, '1 missed setup logged on day');
  assertEquals(day21.disciplineWins, 1, '1 discipline win recorded on day');
  assertEquals(day21.status, 'PROFITABLE', 'Day status is PROFITABLE');
  assertEquals(day21.sessions.LONDON.count, 1, 'London session has 1 trade');
  assertEquals(day21.sessions.LONDON.netPnL, 250, 'London session net PnL = +250');
  assertEquals(day21.sessions.NEW_YORK_AM.count, 1, 'New York AM session has 1 trade');
  assertEquals(day21.sessions.NEW_YORK_AM.netPnL, -100, 'New York AM session net PnL = -100');

  // 5. Monthly Calendar Builder (September 2026)
  // September 2026 starts on Tuesday (Sept 1) and has 30 days
  const sepCal = buildMonthlyCalendar(2026, 8, allTrades, testPlans, testMissed, { excludeSample: true });
  assertEquals(sepCal.year, 2026, 'Calendar year is 2026');
  assertEquals(sepCal.monthIndex, 8, 'Calendar month index is 8');
  assertEquals(sepCal.monthName, 'September', 'Month name is September');
  assertEquals(sepCal.daysInMonth, 30, 'September has 30 days');
  assert(sepCal.weeks.length >= 5, 'September 2026 has at least 5 weekly rows');

  // Week 1 has padding from August (Monday Aug 31)
  const firstWeek = sepCal.weeks[0];
  assertEquals(firstWeek.days.length, 7, 'Each calendar week has 7 days');
  assertEquals(firstWeek.days[0].isCurrentMonth, false, 'First day is previous month padding (Aug 31)');
  assertEquals(firstWeek.days[1].isCurrentMonth, true, 'Second day is Sept 1');
  assertEquals(firstWeek.days[1].dayNumber, 1, 'Day number is 1');

  // Monthly summary stats
  assertEquals(sepCal.summary.totalTrades, 4, 'Month summary: 4 personal trades');
  assertEquals(sepCal.summary.tradingDaysCount, 3, 'Trading occurred on 3 separate days');
  assertEquals(sepCal.summary.profitableDaysCount, 2, '2 profitable days (Sept 21, 22)');
  assertEquals(sepCal.summary.losingDaysCount, 1, '1 losing day (Sept 23)');
  assertEquals(sepCal.summary.dayWinRate, 66.7, 'Day win rate = 66.7% (2/3)');
  assertEquals(sepCal.summary.monthNetPnL, 300, 'Month net PnL = +$300 (150 + 300 - 150)');
  assertEquals(sepCal.summary.monthTotalR, 3.0, 'Month total R = +3.0R');
  assertEquals(sepCal.summary.monthWinRate, 50.0, 'Month trade win rate = 50.0% (2/4)');
  assert(sepCal.summary.monthWinRateCI.formatted !== undefined, 'Calculates Wilson 95% CI on month win rate');
  assertEquals(sepCal.summary.monthCompliantTrades, 3, '3 compliant trades out of 4');
  assertEquals(sepCal.summary.monthComplianceRate, 75.0, 'Month rule compliance rate = 75.0%');
  assert(sepCal.summary.monthComplianceCI.formatted !== undefined, 'Calculates Wilson 95% CI on compliance rate');
  assertEquals(sepCal.summary.totalPlans, 1, '1 pre-entry plan in month');
  assertEquals(sepCal.summary.totalMissed, 1, '1 missed setup in month');
  assertEquals(sepCal.isPrediction, false, 'Calendar model explicitly marked isPrediction: false');

  // 6. Weekly Matrix View
  const weeklyMatrix = buildWeeklyMatrix(2026, 8, allTrades, testPlans, testMissed, { excludeSample: true });
  assertEquals(weeklyMatrix.year, 2026, 'Weekly matrix year is 2026');
  assert(weeklyMatrix.weeks.length >= 5, 'Weekly matrix contains week rows');
  // Find week containing Sept 21-23
  const activeWeek = weeklyMatrix.weeks.find(w => w.weekTrades > 0);
  assert(activeWeek !== undefined, 'Found week with trade activity');
  assertEquals(activeWeek.weekTrades, 4, 'Active week has 4 trades');
  assertEquals(activeWeek.weekNetPnL, 300, 'Active week net PnL = +300');
  assertEquals(activeWeek.status, 'PROFITABLE', 'Active week status is PROFITABLE');
  assertEquals(activeWeek.weekComplianceRate, 75.0, 'Active week compliance rate = 75.0%');

  // 7. Session Heatmap Cross-Matrix & Observations
  const sessionHeatmap = generateSessionHeatmap(allTrades, { excludeSample: true });
  assertEquals(sessionHeatmap.totalTradesAnalyzed, 4, 'Session heatmap analyzed 4 personal trades');
  assert(sessionHeatmap.matrix.LONDON !== undefined, 'Matrix has London row');
  assert(sessionHeatmap.matrix.NEW_YORK_AM !== undefined, 'Matrix has NY AM row');
  assert(sessionHeatmap.matrix.NEW_YORK_PM !== undefined, 'Matrix has NY PM row');

  // Check London session stats
  const londonSummary = sessionHeatmap.sessions.LONDON;
  assertEquals(londonSummary.totalTrades, 2, 'London session had 2 trades');
  assertEquals(londonSummary.wins, 2, 'London session had 2 wins');
  assertEquals(londonSummary.winRate, 100.0, 'London session win rate = 100%');
  assertEquals(londonSummary.netPnL, 550, 'London session net PnL = +550 (250 + 300)');
  assertEquals(londonSummary.compliantTrades, 2, 'London compliance = 2/2');
  assertEquals(londonSummary.complianceRate, 100.0, 'London compliance rate = 100%');

  // Check NY PM session stats
  const nyPmSummary = sessionHeatmap.sessions.NEW_YORK_PM;
  assertEquals(nyPmSummary.totalTrades, 1, 'NY PM had 1 trade');
  assertEquals(nyPmSummary.losses, 1, 'NY PM had 1 loss');
  assertEquals(nyPmSummary.netPnL, -150, 'NY PM net PnL = -150');

  // Heatmap empirical observations
  assert(sessionHeatmap.observations.length >= 2, 'Session heatmap produced empirical observations');
  assert(sessionHeatmap.observations.every(o => o.isPrediction === false), 'All session observations marked isPrediction: false');
  const pnlLeaderObs = sessionHeatmap.observations.find(o => o.id === 'session-pnl-leader');
  assert(pnlLeaderObs !== undefined, 'Identified session P&L leader');
  assert(pnlLeaderObs.text.includes('London Morning'), 'London identified as largest cumulative P&L');

  // 8. Day-Level Audit Bundle
  const dayAudit = buildDayAudit('2026-09-21', allTrades, testPlans, testMissed, { excludeSample: true });
  assertEquals(dayAudit.dateKey, '2026-09-21', 'Day audit date is 2026-09-21');
  assertEquals(dayAudit.hasActivity, true, 'Day audit flags activity');
  assertEquals(dayAudit.trades.length, 2, 'Day audit contains 2 trade records');
  assertEquals(dayAudit.plans.length, 1, 'Day audit contains 1 plan');
  assertEquals(dayAudit.missed.length, 1, 'Day audit contains 1 missed setup');
  assertEquals(dayAudit.summary.netPnL, 150, 'Day audit summary PnL = +150');
  assertEquals(dayAudit.summary.status, 'PROFITABLE', 'Day audit status is PROFITABLE');
  assertEquals(dayAudit.summary.hasVisualEvidence, true, 'Day audit flags visual evidence present');
  assertEquals(dayAudit.summary.plansCount, 1, 'Day audit pre-entry plan count = 1');
  assertEquals(dayAudit.summary.missedCount, 1, 'Day audit missed setups count = 1');

  // Day audit for an inactive day
  const emptyDayAudit = buildDayAudit('2026-09-01', allTrades, testPlans, testMissed, { excludeSample: true });
  assertEquals(emptyDayAudit.dateKey, '2026-09-01', 'Empty day audit date is 2026-09-01');
  assertEquals(emptyDayAudit.hasActivity, false, 'Empty day audit flags no activity');
  assertEquals(emptyDayAudit.trades.length, 0, 'Empty day has 0 trades');
}

console.log('\n--- Suite 24: Rapid Broker Order Text Parser & Quick Ingest Engine ---');
{
  // 1. Broker Detection
  assertEquals(detectBrokerFormat('Filled Buy 1 NQU6 @ 19850.50').id, 'TRADOVATE_NINJA', 'Detects Tradovate/NinjaTrader format');
  assertEquals(detectBrokerFormat('BOT 100 AAPL @ 182.50 on NASDAQ').id, 'INTERACTIVE_BROKERS', 'Detects Interactive Brokers format');
  assertEquals(detectBrokerFormat('2026.09.22 14:15:00 buy 0.50 EURUSD 1.08500').id, 'METATRADER', 'Detects MetaTrader format');
  assertEquals(detectBrokerFormat('Filled BUY +50 NVDA @ 122.50').id, 'THINKORSWIM', 'Detects Thinkorswim format');
  assertEquals(detectBrokerFormat('Buy Market 1 BTCUSD Executed at 63250').id, 'TRADINGVIEW', 'Detects TradingView format');

  // 2. Symbol Normalization
  assertEquals(normalizeContractSymbol('NQU6'), 'NQ', 'Strips futures month code NQU6 -> NQ');
  assertEquals(normalizeContractSymbol('ES 09-26'), 'ES', 'Normalizes ES contract');
  assertEquals(normalizeContractSymbol('MESU26'), 'MES', 'Normalizes Micro ES MESU26 -> MES');
  assertEquals(normalizeContractSymbol('CLV6'), 'CL', 'Normalizes Crude Oil CLV6 -> CL');
  assertEquals(normalizeContractSymbol('EUR/USD'), 'EURUSD', 'Normalizes Forex pair EUR/USD -> EURUSD');
  assertEquals(normalizeContractSymbol('EURUSDpro'), 'EURUSD', 'Strips broker account suffix EURUSDpro -> EURUSD');
  assertEquals(normalizeContractSymbol('BTC/USD'), 'BTCUSD', 'Normalizes Crypto pair BTC/USD -> BTCUSD');
  assertEquals(normalizeContractSymbol('NVDA'), 'NVDA', 'Preserves Equity symbol NVDA');

  // 3. Tradovate / NinjaTrader Fills Parsing & Pairing (Long Futures)
  const tradovateText = `
    Filled Buy 1 NQU6 @ 19850.50 09/22/2026 09:35:12 Fee: 1.35
    Filled Sell 1 NQU6 @ 19910.00 09/22/2026 10:02:15 Fee: 1.35
  `;
  const tvResult = parseBrokerOrderText(tradovateText);
  assertEquals(tvResult.success, true, 'Tradovate text parsed successfully');
  assertEquals(tvResult.detectedBroker.id, 'TRADOVATE_NINJA', 'Identified as Tradovate/NinjaTrader');
  assertEquals(tvResult.fillCount, 2, '2 execution fills extracted');
  assertEquals(tvResult.trades.length, 1, '1 paired roundtrip trade constructed');

  const tvTrade = tvResult.trades[0];
  assertEquals(tvTrade.symbol, 'NQ', 'Root symbol is NQ');
  assertEquals(tvTrade.direction, 'LONG', 'Direction is LONG');
  assertEquals(tvTrade.entryPrice, 19850.5, 'Entry price is 19850.50');
  assertEquals(tvTrade.exitPrice, 19910.0, 'Exit price is 19910.00');
  assertEquals(tvTrade.quantity, 1, 'Quantity is 1 contract');
  assertEquals(tvTrade.fees, 2.7, 'Total fees = 2.70 (1.35 * 2)');
  // 59.5 points * $20/pt = $1190.00 gross - $2.70 fees = $1187.30 net
  assertEquals(tvTrade.netPnL, 1187.3, 'Net P&L is +$1187.30 (59.5 pts * $20 - $2.70)');
  assertEquals(tvTrade.session, 'LONDON', 'Inferred session is LONDON (09:35 UTC)');
  assertEquals(tvTrade.source, 'BROKER_IMPORT', 'Provenance tagged as BROKER_IMPORT');

  // 4. Interactive Brokers Equity Fills (Short Stock)
  const ibkrText = `
    2026-09-22 14:35:00 SLD 100 NVDA @ 125.00 Comm: 1.00
    2026-09-22 15:20:00 BOT 100 NVDA @ 122.50 Comm: 1.00
  `;
  const ibResult = parseBrokerOrderText(ibkrText);
  assertEquals(ibResult.success, true, 'IBKR text parsed successfully');
  assertEquals(ibResult.detectedBroker.id, 'INTERACTIVE_BROKERS', 'Identified as Interactive Brokers');
  assertEquals(ibResult.trades.length, 1, '1 trade created');

  const ibTrade = ibResult.trades[0];
  assertEquals(ibTrade.symbol, 'NVDA', 'Symbol is NVDA');
  assertEquals(ibTrade.direction, 'SHORT', 'Opened with SLD -> Direction is SHORT');
  assertEquals(ibTrade.entryPrice, 125.0, 'Entry price is 125.00');
  assertEquals(ibTrade.exitPrice, 122.5, 'Exit price is 122.50');
  assertEquals(ibTrade.fees, 2.0, 'Total commission = $2.00');
  // (125 - 122.5) * 100 - 2 = +$248.00 net
  assertEquals(ibTrade.netPnL, 248.0, 'Net P&L is +$248.00');
  assertEquals(ibTrade.session, 'NEW_YORK_AM', 'Inferred session is NEW_YORK_AM (14:35 UTC)');

  // 5. MetaTrader 4 / 5 Deal History Row with explicit profit & SL
  const mtText = `
    2026.09.22 14:15:00 buy 0.50 EURUSD 1.08500 1.08300 1.08950 2026.09.22 16:30:00 1.08920 -3.50 0.00 210.00
  `;
  const mtResult = parseBrokerOrderText(mtText);
  assertEquals(mtResult.success, true, 'MetaTrader row parsed successfully');
  assertEquals(mtResult.detectedBroker.id, 'METATRADER', 'Identified as MetaTrader');
  assertEquals(mtResult.trades.length, 1, 'Constructed trade from history row');

  const mtTrade = mtResult.trades[0];
  assertEquals(mtTrade.symbol, 'EURUSD', 'Symbol is EURUSD');
  assertEquals(mtTrade.direction, 'LONG', 'Direction is LONG');
  assertEquals(mtTrade.entryPrice, 1.085, 'Entry price is 1.08500');
  assertEquals(mtTrade.exitPrice, 1.0892, 'Exit price is 1.08920');
  assertEquals(mtTrade.stopLoss, 1.083, 'Extracted stop loss 1.08300');
  assertEquals(mtTrade.takeProfit, 1.0895, 'Extracted take profit 1.08950');
  assertEquals(mtTrade.fees, 3.5, 'Extracted commission $3.50');
  assertEquals(mtTrade.netPnL, 210.0, 'Extracted exact broker net P&L $210.00');
  assertEquals(mtTrade.plannedRiskDollars, 100, 'Calculated planned risk from SL (20 pips * 0.5 lot = $100)');
  assertEquals(mtTrade.rMultiple, 2.1, 'Realized R is +2.10R (210 / 100)');

  // 6. Thinkorswim Fills
  const tosText = `
    10:15:22 Filled BUY +50 TSLA @ 245.00
    11:00:15 Filled SELL -50 TSLA @ 248.50
  `;
  const tosResult = parseBrokerOrderText(tosText);
  assertEquals(tosResult.success, true, 'Thinkorswim fills parsed successfully');
  assertEquals(tosResult.trades.length, 1, '1 trade constructed');
  const tosTrade = tosResult.trades[0];
  assertEquals(tosTrade.symbol, 'TSLA', 'Symbol is TSLA');
  assertEquals(tosTrade.direction, 'LONG', 'Direction is LONG');
  assertEquals(tosTrade.netPnL, 175.0, 'Net P&L = +$175.00 ((248.5 - 245) * 50)');

  // 7. Single-line roundtrip summary
  const summaryText = 'Long 1 NQ Entry: 19850.50 Exit: 19910.00 PnL: +1187.30 Fees: 2.70 Date: 2026-09-22';
  const summaryResult = parseBrokerOrderText(summaryText);
  assertEquals(summaryResult.success, true, 'Roundtrip summary text parsed');
  assertEquals(summaryResult.trades.length, 1, '1 trade created');
  assertEquals(summaryResult.trades[0].symbol, 'NQ', 'Symbol is NQ');
  assertEquals(summaryResult.trades[0].direction, 'LONG', 'Direction is LONG');
  assertEquals(summaryResult.trades[0].netPnL, 1187.3, 'Net P&L is 1187.30');

  // 8. Unpaired Fills / Warning handling
  const incompleteText = 'Filled Buy 1 NQU6 @ 19850.50 09/22/2026 09:35:12 Fee: 1.35';
  const incompleteResult = parseBrokerOrderText(incompleteText);
  assertEquals(incompleteResult.success, false, 'Unpaired fill marked success: false (cannot form closed trade)');
  assertEquals(incompleteResult.fillCount, 1, '1 fill extracted');
  assertEquals(incompleteResult.unpairedFills.length, 1, '1 unpaired fill reported');
  assert(incompleteResult.warnings[0].includes('could not be paired'), 'Includes warning explaining open position');

  // 9. Empty text handling
  const emptyResult = parseBrokerOrderText('');
  assertEquals(emptyResult.success, false, 'Empty text fails gracefully');
  assertEquals(emptyResult.trades.length, 0, '0 trades created');
}

console.log('\n================================================================');
console.log(`  FINAL RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
