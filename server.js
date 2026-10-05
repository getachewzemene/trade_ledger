/**
 * Standalone Zero-Dependency Server for Ledger & Wick Trading Journal
 * Extended with Simulation, Tilt State, Debrief, and Prop Firm Guardian API endpoints.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { importTradesFromCSV } from './src/engine/csv-parser.js';
import { calculatePerformanceMetrics } from './src/engine/metrics.js';
import { analyzeTradeViolations, calculateLeakDiagnostics } from './src/engine/leak-detector.js';
import { analyzeExcursionPatterns } from './src/engine/excursion.js';
import { evaluateCircuitBreaker, DEFAULT_TRADING_CONTRACT } from './src/engine/contract.js';
import { gradeTradeDebrief, evaluateTiltState } from './src/engine/debrief-tilt.js';
import { simulateLosingStreakProbabilities } from './src/engine/simulation.js';
import { 
  DEFAULT_PLAYBOOK_SETUPS, 
  evaluateTradeConfluence, 
  calculateCounterfactualEquitySplit, 
  calculateSessionKillzoneMetrics 
} from './src/engine/playbook.js';
import { 
  PROP_FIRM_PRESETS, 
  calculateDynamicDrawdownBuffer, 
  calculateRunwaySafeRisk, 
  calculateConsistencyMetrics, 
  auditPayoutEligibility 
} from './src/engine/prop-firm.js';
import { validateTradePayload, normalizeTradePayload } from './src/engine/validation.js';
import { buildTradeSummaryReport, buildTradeCsvExport } from './src/engine/reporting.js';
import { filterPerformanceTrades, tagLegacySampleTrades, tagTradesWithSource, TRADE_SOURCES } from './src/engine/trade-provenance.js';
import {
  RESEARCH_PRESETS,
  MARKET_REGIMES,
  generateHistoricalDataset,
  runStrategyBacktest,
  runFrictionStressTest,
  evaluateEdgeDurability,
  calculateFrictionAudit,
  calculateUncertaintyMetrics,
  calculateRegimeBreakdown
} from './src/engine/research-lab.js';
import { evaluateExecutionQuality, compareExecutionCohorts, classifyProcessOutcome } from './src/engine/execution-quality.js';
import { generateTraderHistoryObservations } from './src/engine/trader-review.js';
import { DEFAULT_TRADING_PLAN } from './src/engine/trading-plan.js';
import {
  createPreEntryPlan,
  linkPlanToExecutedTrade,
  createMissedSetup,
  analyzeMissedSetups,
  documentRuleViolationRecord,
  evaluateSessionLimitsAndPause,
  DELIBERATE_PAUSE_PRINCIPLES
} from './src/engine/deliberate-pause.js';
import {
  ALLOWED_IMAGE_TYPES,
  SCREENSHOT_TAGS,
  validateImageAttachment,
  createVisualEvidenceRecord,
  linkScreenshotsToTrade,
  calculateVisualEvidenceMetrics,
  compareVisualAccountabilityCohorts,
  generateVisualJournalObservations
} from './src/engine/visual-journal.js';
import {
  SESSION_BLOCKS,
  SESSION_ORDER,
  DAYS_OF_WEEK,
  classifySessionBlock,
  formatDateKey,
  buildMonthlyCalendar,
  buildWeeklyMatrix,
  generateSessionHeatmap,
  buildDayAudit
} from './src/engine/calendar-heatmap.js';
import {
  parseBrokerOrderText,
  SUPPORTED_BROKERS
} from './src/engine/broker-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'src', 'public');
const ENGINE_DIR = path.join(__dirname, 'src', 'engine');
const DATA_DIR = path.join(__dirname, 'src', 'data');

const writeJsonFile = (fileName, data) => {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.warn(`Could not write ${fileName}: ${err.message}`);
    return false;
  }
};

const readJsonFile = (fileName, fallback = []) => {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const contents = fs.readFileSync(filePath, 'utf8');
    return contents ? JSON.parse(contents) : fallback;
  } catch {
    return fallback;
  }
};

const persistTrades = () => writeJsonFile('trades.json', activeTrades);

// Keep educational examples separate from the user's persisted journal.
const sampleTrades = tagTradesWithSource(readJsonFile('sample-trades.json', []), TRADE_SOURCES.SAMPLE);
let activeTrades = tagLegacySampleTrades(readJsonFile('trades.json', []), sampleTrades);
const getPerformanceTrades = () => filterPerformanceTrades(activeTrades);

// Load curriculum
let curriculumData = [];
try {
  const currData = fs.readFileSync(path.join(DATA_DIR, 'curriculum.json'), 'utf8');
  curriculumData = JSON.parse(currData);
} catch (err) {
  console.error('Error loading curriculum:', err.message);
}

// Load contract
let tradingContract = { ...DEFAULT_TRADING_CONTRACT };
try {
  const contractData = readJsonFile('contract.json', DEFAULT_TRADING_CONTRACT);
  tradingContract = { ...DEFAULT_TRADING_CONTRACT, ...contractData };
} catch (err) {
  console.warn('Using default trading contract.');
}

// Load pre-session logs
let preSessionLogs = [];
try {
  preSessionLogs = readJsonFile('presession.json', []);
} catch (err) {
  console.warn('No existing presession logs found.');
}

// Load prop firm configuration
let playbookConfig = {
  activeSetups: ["BREAKOUT_RETEST", "LIQUIDITY_SWEEP", "TREND_PULLBACK", "DISCRETIONARY"],
  purityGoalPercent: 90
};
try {
  const pbData = fs.readFileSync(path.join(DATA_DIR, 'playbook.json'), 'utf8');
  playbookConfig = JSON.parse(pbData);
} catch (err) {
  console.warn('Using default playbook config.');
}

let propFirmConfig = {
  activeProfileId: 'TOPSTEP_50K',
  plannedTradesToday: 2,
  safetyMarginPercent: 25,
  accountStage: 'EVALUATION'
};
try {
  const pfData = fs.readFileSync(path.join(DATA_DIR, 'prop-firm.json'), 'utf8');
  propFirmConfig = JSON.parse(pfData);
} catch (err) {
  console.warn('Using default prop firm config.');
}

// Load deliberate review-and-pause & pre-entry states
let preEntryPlans = readJsonFile('planned-trades.json', []);
let missedSetups = readJsonFile('missed-setups.json', []);
let documentedViolations = readJsonFile('documented-violations.json', []);
let tradingPlan = { ...DEFAULT_TRADING_PLAN, ...readJsonFile('plan.json', DEFAULT_TRADING_PLAN) };

const persistPreEntryPlans = () => writeJsonFile('planned-trades.json', preEntryPlans);
const persistMissedSetups = () => writeJsonFile('missed-setups.json', missedSetups);
const persistDocumentedViolations = () => writeJsonFile('documented-violations.json', documentedViolations);

// Load visual trade journal screenshots
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');
try {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
} catch (err) {
  console.warn('Could not initialize screenshots dir:', err.message);
}
let screenshotsMetadata = readJsonFile('screenshots.json', []);
const persistScreenshots = () => writeJsonFile('screenshots.json', screenshotsMetadata);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Endpoints ---

  // Health check
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), tradesCount: activeTrades.length }));
    return;
  }

  // GET /api/trades
  if (pathname === '/api/sample-trades' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(analyzeTradeViolations(sampleTrades)));
    return;
  }

  if (pathname === '/api/trades' && req.method === 'GET') {
    const analyzed = analyzeTradeViolations(activeTrades);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(analyzed));
    return;
  }

  // POST /api/trades
  if (pathname === '/api/trades' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { valid, errors, trade } = validateTradePayload(payload);

        if (!valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid trade payload', details: errors }));
          return;
        }

        const requestedSource = String(trade.source || '').toUpperCase();
        let targetSource = TRADE_SOURCES.MANUAL;
        let targetMode = 'JOURNAL';
        if (requestedSource === TRADE_SOURCES.DEMO_PRACTICE || requestedSource === TRADE_SOURCES.SIMULATED) {
          targetSource = TRADE_SOURCES.DEMO_PRACTICE;
          targetMode = 'DEMO';
        } else if (requestedSource === TRADE_SOURCES.CSV_IMPORT || requestedSource === TRADE_SOURCES.BROKER_IMPORT || requestedSource === TRADE_SOURCES.IMPORTED) {
          targetSource = TRADE_SOURCES.CSV_IMPORT;
          targetMode = 'JOURNAL';
        } else if (requestedSource === TRADE_SOURCES.SAMPLE) {
          targetSource = TRADE_SOURCES.SAMPLE;
          targetMode = 'SAMPLE';
        }
        const safeTrade = {
          ...trade,
          source: targetSource,
          executionMode: targetMode
        };

        // Attach confluence evaluation if setup provided
        if (safeTrade.setupId) {
          const confResult = evaluateTradeConfluence(safeTrade.setupId, safeTrade.criteria || []);
          safeTrade.confluence = confResult;
          safeTrade.isPlaybookCompliant = confResult.isPlaybookCompliant;
          if (confResult.inferredViolations && confResult.inferredViolations.length > 0) {
            safeTrade.violations = safeTrade.violations || [];
            confResult.inferredViolations.forEach(v => {
              if (!safeTrade.violations.includes(v)) safeTrade.violations.push(v);
            });
          }
        }

        // Attach debrief grade if present
        if (safeTrade.debrief) {
          const debriefGrade = gradeTradeDebrief(safeTrade.debrief);
          safeTrade.disciplineGrade = debriefGrade.grade;
          safeTrade.disciplineScore = debriefGrade.score;
          if (debriefGrade.inferredViolations.length > 0) {
            safeTrade.violations = safeTrade.violations || [];
            debriefGrade.inferredViolations.forEach(v => {
              if (!safeTrade.violations.includes(v)) safeTrade.violations.push(v);
            });
          }
        }

        // Evaluate circuit breaker
        const circuit = evaluateCircuitBreaker({
          trades: getPerformanceTrades(),
          contract: tradingContract,
          candidateTradeDate: safeTrade.entryDate || new Date().toISOString(),
          preSessionLogs
        });

        if (circuit.isTripped && !safeTrade.violations?.includes('CONTRACT_BREACH')) {
          safeTrade.violations = safeTrade.violations || [];
          safeTrade.violations.push('CONTRACT_BREACH');
        }
        
        if (payload.planId) {
          const plan = preEntryPlans.find(p => p.id === payload.planId);
          if (plan) {
            plan.status = 'EXECUTED';
            safeTrade = linkPlanToExecutedTrade(plan, safeTrade);
            persistPreEntryPlans();
          }
        }

        if (payload.preEntryScreenshotUrl) safeTrade.preEntryScreenshotUrl = payload.preEntryScreenshotUrl;
        if (payload.outcomeScreenshotUrl) safeTrade.outcomeScreenshotUrl = payload.outcomeScreenshotUrl;
        if (payload.screenshotUrl) safeTrade.screenshotUrl = payload.screenshotUrl;
        if (Array.isArray(payload.screenshots)) safeTrade.screenshots = payload.screenshots;
        safeTrade.hasPreEntryScreenshot = Boolean(safeTrade.preEntryScreenshotUrl);
        safeTrade.hasOutcomeScreenshot = Boolean(safeTrade.outcomeScreenshotUrl);
        safeTrade.hasVisualEvidence = Boolean(safeTrade.hasPreEntryScreenshot || safeTrade.hasOutcomeScreenshot || safeTrade.screenshotUrl || (safeTrade.screenshots && safeTrade.screenshots.length > 0));

        safeTrade.executionQuality = evaluateExecutionQuality(safeTrade);
        safeTrade.processOutcome = classifyProcessOutcome(safeTrade);

        safeTrade.id = safeTrade.id || `TR-${1000 + activeTrades.length + 1}`;
        activeTrades.push(safeTrade);
        persistTrades();

        const pauseStatus = evaluateSessionLimitsAndPause({
          trades: getPerformanceTrades(),
          tradingPlan,
          contract: tradingContract,
          preSessionLogs
        });

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Trade recorded successfully', trade: safeTrade, circuit, pauseStatus }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // GET /api/analytics
  if (pathname === '/api/analytics' && req.method === 'GET') {
    const analyzed = analyzeTradeViolations(getPerformanceTrades());
    const metrics = calculatePerformanceMetrics(analyzed);
    const diagnostics = calculateLeakDiagnostics(analyzed);
    const excursion = analyzeExcursionPatterns(analyzed);
    const tilt = evaluateTiltState(analyzed, tradingContract.cooldownMinutes);
    const executionQuality = compareExecutionCohorts(analyzed);
    const reviewReport = generateTraderHistoryObservations(analyzed);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ metrics, diagnostics, excursion, tilt, executionQuality, reviewReport }));
    return;
  }

  // GET /api/reviews/observations
  if (pathname === '/api/reviews/observations' && req.method === 'GET') {
    const includeSample = parsedUrl.searchParams.get('includeSample') === 'true';
    const windowSize = parseInt(parsedUrl.searchParams.get('windowSize') || '20', 10);
    const trades = includeSample ? activeTrades : getPerformanceTrades();
    const analyzed = analyzeTradeViolations(trades);
    const observations = generateTraderHistoryObservations(analyzed, { excludeSample: !includeSample, windowSize });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(observations));
    return;
  }

  // GET /api/execution-quality
  if (pathname === '/api/execution-quality' && req.method === 'GET') {
    const analyzed = analyzeTradeViolations(getPerformanceTrades());
    const quality = compareExecutionCohorts(analyzed);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(quality));
    return;
  }

  // GET /api/pause/status
  if (pathname === '/api/pause/status' && req.method === 'GET') {
    const status = evaluateSessionLimitsAndPause({
      trades: getPerformanceTrades(),
      tradingPlan,
      contract: tradingContract,
      preSessionLogs
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }

  // GET & POST /api/plans/pre-entry
  if (pathname === '/api/plans/pre-entry') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ plans: preEntryPlans }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const result = createPreEntryPlan(payload);
          if (!result.valid) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid pre-entry plan', details: result.errors }));
            return;
          }
          preEntryPlans.unshift(result.plan);
          persistPreEntryPlans();
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Pre-entry plan recorded', plan: result.plan }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // POST /api/plans/pre-entry/cancel
  if (pathname === '/api/plans/pre-entry/cancel' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body);
        const plan = preEntryPlans.find(p => p.id === id);
        if (plan) {
          plan.status = 'CANCELLED';
          persistPreEntryPlans();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Plan cancelled', id }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET & POST /api/missed-setups
  if (pathname === '/api/missed-setups') {
    if (req.method === 'GET') {
      const analysis = analyzeMissedSetups(missedSetups);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(analysis));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const record = createMissedSetup(payload);
          missedSetups.unshift(record);
          persistMissedSetups();
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Missed setup documented', record, analysis: analyzeMissedSetups(missedSetups) }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // POST /api/violations/document
  if (pathname === '/api/violations/document' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const targetTrade = activeTrades.find(t => t.id === payload.tradeId) || { id: payload.tradeId, symbol: payload.symbol };
        const record = documentRuleViolationRecord(targetTrade, payload);
        documentedViolations.unshift(record);
        persistDocumentedViolations();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Violation documented', record }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /api/screenshots
  if (pathname === '/api/screenshots' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ screenshots: screenshotsMetadata }));
    return;
  }

  // POST /api/screenshots/upload
  if (pathname === '/api/screenshots/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload exceeds 15 MB limit' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        let base64Data = String(payload.base64Data || '');
        let mimeType = String(payload.mimeType || 'image/png');
        
        if (base64Data.startsWith('data:')) {
          const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          }
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const validation = validateImageAttachment({
          mimeType,
          sizeBytes: buffer.length,
          tag: payload.tag
        });

        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid image attachment', details: validation.errors }));
          return;
        }

        const extMap = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/webp': 'webp',
          'image/svg+xml': 'svg',
          'image/gif': 'gif'
        };
        const ext = extMap[mimeType] || 'png';
        const fileName = `shot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const filePath = path.join(SCREENSHOTS_DIR, fileName);

        fs.writeFileSync(filePath, buffer);
        const imageUrl = `/data/screenshots/${fileName}`;

        const { record } = createVisualEvidenceRecord({
          entityType: payload.entityType || 'TRADE',
          entityId: payload.entityId || null,
          tag: payload.tag || 'PRE_ENTRY',
          url: imageUrl,
          caption: payload.caption || '',
          mimeType,
          sizeBytes: buffer.length,
          timeframe: payload.timeframe || ''
        });

        screenshotsMetadata.unshift(record);
        persistScreenshots();

        // Automatically link to entity if provided
        if (payload.entityId) {
          const entityType = String(payload.entityType || 'TRADE').toUpperCase();
          if (entityType === 'TRADE') {
            const trade = activeTrades.find(t => t.id === payload.entityId);
            if (trade) {
              trade.screenshots = trade.screenshots || [];
              trade.screenshots.push(record);
              if (record.tag === 'PRE_ENTRY') {
                trade.preEntryScreenshotUrl = record.url;
                trade.hasPreEntryScreenshot = true;
              } else if (record.tag === 'OUTCOME') {
                trade.outcomeScreenshotUrl = record.url;
                trade.hasOutcomeScreenshot = true;
              }
              trade.hasVisualEvidence = true;
              persistTrades();
            }
          } else if (entityType === 'PLAN') {
            const plan = preEntryPlans.find(p => p.id === payload.entityId);
            if (plan) {
              plan.screenshots = plan.screenshots || [];
              plan.screenshots.push(record);
              plan.screenshotUrl = record.url;
              persistPreEntryPlans();
            }
          } else if (entityType === 'MISSED') {
            const missed = missedSetups.find(m => m.id === payload.entityId);
            if (missed) {
              missed.screenshots = missed.screenshots || [];
              missed.screenshots.push(record);
              missed.screenshotUrl = record.url;
              persistMissedSetups();
            }
          }
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Screenshot uploaded successfully', screenshot: record }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /api/visual-journal/metrics
  if (pathname === '/api/visual-journal/metrics' && req.method === 'GET') {
    const perfTrades = getPerformanceTrades();
    const metrics = calculateVisualEvidenceMetrics(perfTrades, preEntryPlans, missedSetups);
    const cohorts = compareVisualAccountabilityCohorts(perfTrades);
    const observations = generateVisualJournalObservations(perfTrades);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ metrics, cohorts, observations, screenshots: screenshotsMetadata }));
    return;
  }

  // GET /api/calendar/month
  if (pathname === '/api/calendar/month' && req.method === 'GET') {
    const year = Number(parsedUrl.searchParams.get('year')) || new Date().getUTCFullYear();
    const month = parsedUrl.searchParams.has('month') ? Number(parsedUrl.searchParams.get('month')) : new Date().getUTCMonth();
    const excludeSample = parsedUrl.searchParams.get('includeSample') !== 'true';

    const calData = buildMonthlyCalendar(year, month, activeTrades, preEntryPlans, missedSetups, { excludeSample });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(calData));
    return;
  }

  // GET /api/calendar/heatmap
  if (pathname === '/api/calendar/heatmap' && req.method === 'GET') {
    const excludeSample = parsedUrl.searchParams.get('includeSample') !== 'true';
    const heatmap = generateSessionHeatmap(activeTrades, { excludeSample });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(heatmap));
    return;
  }

  // GET /api/calendar/day
  if (pathname === '/api/calendar/day' && req.method === 'GET') {
    const date = parsedUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const excludeSample = parsedUrl.searchParams.get('includeSample') !== 'true';
    const audit = buildDayAudit(date, activeTrades, preEntryPlans, missedSetups, { excludeSample });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(audit));
    return;
  }

  // POST /api/trades/parse-order-text
  if (pathname === '/api/trades/parse-order-text' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const parsed = parseBrokerOrderText(payload.rawText || '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(parsed));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/trades/quick-ingest
  if (pathname === '/api/trades/quick-ingest' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const rawTrades = Array.isArray(payload.trades) ? payload.trades : (payload.rawText ? parseBrokerOrderText(payload.rawText).trades : []);
        if (rawTrades.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No valid trades found to ingest.' }));
          return;
        }

        const saved = [];
        const errors = [];
        for (const raw of rawTrades) {
          const { valid, errors: errs, trade } = validateTradePayload(raw);
          if (valid) {
            trade.source = TRADE_SOURCES.BROKER_IMPORT;
            trade.id = trade.id || `TR-INGEST-${Date.now()}-${Math.floor(Math.random()*1000)}`;
            activeTrades.unshift(trade);
            saved.push(trade);
          } else {
            errors.push({ trade: raw, errors: errs });
          }
        }

        if (saved.length > 0) {
          persistTrades();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: saved.length > 0, savedCount: saved.length, savedTrades: saved, errors }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /api/simulation
  if (pathname === '/api/simulation' && req.method === 'GET') {
    const analyzed = analyzeTradeViolations(getPerformanceTrades());
    const metrics = calculatePerformanceMetrics(analyzed);
    const winRate = metrics.winRate > 0 ? metrics.winRate : 50;
    const sim = simulateLosingStreakProbabilities({ winRatePercent: winRate, tradesCount: 100, iterations: 1000 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sim));
    return;
  }

  // GET /api/tilt
  if (pathname === '/api/tilt' && req.method === 'GET') {
    const analyzed = analyzeTradeViolations(getPerformanceTrades());
    const tilt = evaluateTiltState(analyzed, tradingContract.cooldownMinutes);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tilt));
    return;
  }

  // GET & POST /api/prop-firm/profile
  if (pathname === '/api/prop-firm/profile') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        config: propFirmConfig,
        presets: PROP_FIRM_PRESETS
      }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const updated = JSON.parse(body);
          propFirmConfig = { ...propFirmConfig, ...updated };
          try {
            fs.writeFileSync(path.join(DATA_DIR, 'prop-firm.json'), JSON.stringify(propFirmConfig, null, 2));
          } catch (writeErr) {
            console.warn('Could not write prop-firm.json:', writeErr.message);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Prop firm config updated', config: propFirmConfig }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // GET /api/prop-firm/metrics
  if (pathname === '/api/prop-firm/metrics' && req.method === 'GET') {
    const profile = PROP_FIRM_PRESETS[propFirmConfig.activeProfileId] || PROP_FIRM_PRESETS.TOPSTEP_50K;
    const buffer = calculateDynamicDrawdownBuffer(getPerformanceTrades(), profile);
    const runway = calculateRunwaySafeRisk(
      buffer.effectiveImmediateCushionDollars,
      propFirmConfig.plannedTradesToday || 2,
      propFirmConfig.safetyMarginPercent || 25
    );
    const consistency = calculateConsistencyMetrics(getPerformanceTrades(), profile.consistencyRulePercent);
    const audit = auditPayoutEligibility(getPerformanceTrades(), profile);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      config: propFirmConfig,
      profile,
      buffer,
      runway,
      consistency,
      audit
    }));
    return;
  }

  // GET & POST /api/playbook
  if (pathname === '/api/playbook') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        setups: DEFAULT_PLAYBOOK_SETUPS,
        config: playbookConfig
      }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const updated = JSON.parse(body);
          playbookConfig = { ...playbookConfig, ...updated };
          try {
            fs.writeFileSync(path.join(DATA_DIR, 'playbook.json'), JSON.stringify(playbookConfig, null, 2));
          } catch (writeErr) {
            console.warn('Could not write playbook.json:', writeErr.message);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Playbook updated successfully', config: playbookConfig }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // GET /api/playbook/counterfactual
  if (pathname === '/api/playbook/counterfactual' && req.method === 'GET') {
    const analyzed = analyzeTradeViolations(getPerformanceTrades());
    const counterfactual = calculateCounterfactualEquitySplit(analyzed);
    const killzones = calculateSessionKillzoneMetrics(analyzed);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      counterfactual,
      killzones,
      config: playbookConfig
    }));
    return;
  }

  // GET & POST /api/contract
  if (pathname === '/api/contract') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tradingContract));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const updated = JSON.parse(body);
          tradingContract = { ...tradingContract, ...updated };
          writeJsonFile('contract.json', tradingContract);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Contract updated successfully', contract: tradingContract }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // GET & POST /api/presession
  if (pathname === '/api/presession') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(preSessionLogs));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const log = JSON.parse(body);
          log.id = log.id || `PRE-${new Date().toISOString().slice(0, 10)}`;
          log.date = log.date || new Date().toISOString();
          log.completed = true;
          preSessionLogs.unshift(log);
          writeJsonFile('presession.json', preSessionLogs);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Pre-session checklist saved', log }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // GET /api/reports/summary
  if (pathname === '/api/reports/summary' && req.method === 'GET') {
    const includeSample = parsedUrl.searchParams.get('includeSample') === 'true';
    const report = buildTradeSummaryReport(activeTrades, { excludeSample: !includeSample });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report));
    return;
  }

  // GET /api/reports/export
  if (pathname === '/api/reports/export' && req.method === 'GET') {
    const format = parsedUrl.searchParams.get('format') || 'json';
    const includeSample = parsedUrl.searchParams.get('includeSample') === 'true';
    if (format === 'csv') {
      const csv = buildTradeCsvExport(activeTrades, { excludeSample: !includeSample });
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ledger_report_${new Date().toISOString().slice(0, 10)}.csv"`
      });
      res.end(csv);
      return;
    }

    const report = buildTradeSummaryReport(activeTrades, { excludeSample: !includeSample });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report));
    return;
  }

  // GET /api/curriculum
  if (pathname === '/api/curriculum' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(curriculumData));
    return;
  }

  // POST /api/csv-import
  if (pathname === '/api/csv-import' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { csvText } = JSON.parse(body);
        const result = importTradesFromCSV(csvText, activeTrades);
        const validatedTrades = result.trades.map((trade) => {
          const { valid, trade: normalizedTrade } = validateTradePayload(trade);
          return valid ? normalizedTrade : null;
        }).filter(Boolean);

        if (validatedTrades.length > 0) {
          activeTrades.push(...validatedTrades.map(trade => ({ ...trade, source: TRADE_SOURCES.CSV_IMPORT, executionMode: 'JOURNAL' })));
          persistTrades();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...result, imported: validatedTrades.length, skipped: result.trades.length - validatedTrades.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /api/research/presets
  if (pathname === '/api/research/presets' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(RESEARCH_PRESETS));
    return;
  }

  // GET /api/research/datasets
  if (pathname === '/api/research/datasets' && req.method === 'GET') {
    const datasets = [
      { id: 'EURUSD', name: 'EUR/USD (Forex 15M)', symbol: 'EURUSD', startPrice: 1.0850, defaultSpread: 0.00015, defaultSlippage: 0.00010, defaultComm: 3.50 },
      { id: 'ES', name: 'E-mini S&P 500 (Futures 5M)', symbol: 'ES', startPrice: 5120.00, defaultSpread: 0.25, defaultSlippage: 0.25, defaultComm: 4.50 },
      { id: 'NVDA', name: 'NVDA (Equities 5M)', symbol: 'NVDA', startPrice: 880.00, defaultSpread: 0.10, defaultSlippage: 0.08, defaultComm: 1.00 },
      { id: 'BTCUSD', name: 'BTC/USD (Crypto 15M)', symbol: 'BTCUSD', startPrice: 65000.00, defaultSpread: 12.00, defaultSlippage: 15.00, defaultComm: 6.00 }
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(datasets));
    return;
  }

  // POST /api/research/backtest
  if (pathname === '/api/research/backtest' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const strategy = payload.strategy || RESEARCH_PRESETS.TREND_PULLBACK_CONFLUENCE;
        const datasetOptions = payload.datasetOptions || { symbol: 'EURUSD', totalBars: 600, trainSplit: 0.65, startPrice: 1.0850, seed: 42 };

        const dataset = generateHistoricalDataset(datasetOptions);
        const backtestResult = runStrategyBacktest(dataset.bars, strategy);
        const stressResult = runFrictionStressTest(dataset.bars, strategy);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          dataset: {
            symbol: dataset.symbol,
            totalBars: dataset.bars.length,
            trainSplit: dataset.trainSplit,
            inSampleBars: dataset.bars.filter(b => b.partition === 'IN_SAMPLE').length,
            outOfSampleBars: dataset.bars.filter(b => b.partition === 'OUT_OF_SAMPLE').length,
            regimes: Array.from(new Set(dataset.bars.map(b => b.regime)))
          },
          backtest: backtestResult,
          stressTest: stressResult
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- Static File Serving ---

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (pathname.startsWith('/engine/')) {
    filePath = path.join(ENGINE_DIR, pathname.replace('/engine/', ''));
  } else if (pathname.startsWith('/data/')) {
    filePath = path.join(DATA_DIR, pathname.replace('/data/', ''));
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Ledger & Wick] Server running on http://127.0.0.1:${PORT}`);
});
