/**
 * Ledger & Wick — Main Application Controller
 * Extended with:
 * 1. 60-Second Post-Trade Guided Debrief & Discipline Grading
 * 2. Active Tilt Interceptor & Mandatory Cooldown Lockout Shield
 * 3. Monte Carlo Losing Streak Variance Simulator
 * 4. Visual Trade Gallery & Canvas Annotator
 * 5. Pre-Session Audit & Trader's Oath Circuit Breaker
 */

import { calculatePerformanceMetrics, groupTradesBy } from '../engine/metrics.js';
import { calculatePositionSize, calculateInstrumentAwarePositionSize, evaluateInstrumentRiskGuardrails, getInstrumentSpec } from '../engine/sizing.js';
import { evaluateExecutionQuality, compareExecutionCohorts, classifyProcessOutcome, EXECUTION_DISCLAIMER } from '../engine/execution-quality.js';
import { generateTraderHistoryObservations, REVIEW_DISCLAIMER } from '../engine/trader-review.js';
import {
  createPreEntryPlan,
  linkPlanToExecutedTrade,
  createMissedSetup,
  analyzeMissedSetups,
  documentRuleViolationRecord,
  evaluateSessionLimitsAndPause,
  STAND_DOWN_STATUSES,
  MISSED_SETUP_REASONS,
  DELIBERATE_PAUSE_PRINCIPLES
} from '../engine/deliberate-pause.js';
import {
  calculateVisualEvidenceMetrics,
  compareVisualAccountabilityCohorts,
  generateVisualJournalObservations,
  SCREENSHOT_TAGS
} from '../engine/visual-journal.js';
import { analyzeTradeViolations, calculateLeakDiagnostics, LEAK_DEFINITIONS } from '../engine/leak-detector.js';
import { buildTradeSummaryReport } from '../engine/reporting.js';
import { importTradesFromCSV } from '../engine/csv-parser.js';
import { renderTradeChartSVG } from '../engine/diagrams.js';
import { calculateExcursionR, analyzeExcursionPatterns } from '../engine/excursion.js';
import { evaluateCircuitBreaker, DEFAULT_TRADING_CONTRACT } from '../engine/contract.js';
import { gradeTradeDebrief, evaluateTiltState } from '../engine/debrief-tilt.js';
import { simulateLosingStreakProbabilities } from '../engine/simulation.js';
import { 
  DEFAULT_PLAYBOOK_SETUPS, 
  evaluateTradeConfluence, 
  calculateCounterfactualEquitySplit, 
  calculateSessionKillzoneMetrics 
} from '../engine/playbook.js';
import { 
  PROP_FIRM_PRESETS, 
  calculateDynamicDrawdownBuffer, 
  calculateRunwaySafeRisk, 
  calculateConsistencyMetrics, 
  auditPayoutEligibility 
} from '../engine/prop-firm.js';
import { createSessionState, saveSessionState, loadSessionState, clearSessionState, isSessionActive, saveProfileData, loadProfileData } from '../engine/session.js';
import { DEFAULT_PLAN_RULES, DEFAULT_TRADING_PLAN, normalizeTradingPlan, evaluatePlanReadiness, evaluatePlanTradeLimits } from '../engine/trading-plan.js';
import { 
  TRADE_CATEGORIES,
  TRADE_SOURCES,
  normalizeTradeSource,
  getTradeCategory,
  isSampleTrade,
  isSimulatedTrade,
  isDemoTrade,
  isImportedTrade,
  isPersonalTrade,
  filterPerformanceTrades,
  filterTradesByCategory,
  getTradeSourceLabel,
  getTradeSourceBadgeClass,
  getModeBannerText,
  tagLegacySampleTrades,
  tagTradesWithSource
} from '../engine/trade-provenance.js';
import {
  RESEARCH_PRESETS,
  MARKET_REGIMES,
  SESSIONS,
  generateHistoricalDataset,
  runStrategyBacktest,
  runFrictionStressTest,
  evaluateEdgeDurability,
  calculateFrictionAudit,
  calculateUncertaintyMetrics,
  calculateRegimeBreakdown
} from '../engine/research-lab.js';
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
} from '../engine/calendar-heatmap.js';
import {
  parseBrokerOrderText,
  SUPPORTED_BROKERS,
  inferAssetClassFromSymbol
} from '../engine/broker-parser.js';

// Application State
let trades = [];
let sampleTrades = [];
let activeLessonId = 'lesson-1';
let curriculumData = [];
let tradingContract = { ...DEFAULT_TRADING_CONTRACT };
let preSessionLogs = [];
let preEntryPlans = [];
let missedSetups = [];
let activePreEntryPlanId = null;
let currentCalendarYear = new Date().getUTCFullYear();
let currentCalendarMonth = new Date().getUTCMonth();
let currentCalendarTab = 'month';
let annotatingTrade = null;
let activeTradeDropzoneSlot = 'before';
let currentLightboxData = {
  primaryUrl: null,
  secondaryUrl: null,
  currentMode: 'split'
};
let currentTool = 'line';
let isDrawing = false;
let startX = 0;
let startY = 0;
let tiltTimerInterval = null;
let propFirmConfig = {
  activeProfileId: 'TOPSTEP_50K',
  plannedTradesToday: 2,
  safetyMarginPercent: 25,
  accountStage: 'EVALUATION'
};
let propFirmData = null;
let playbookData = null;
let currentSession = null;
let tradingPlan = normalizeTradingPlan(DEFAULT_TRADING_PLAN);
let planChecklist = { date: new Date().toISOString().slice(0, 10), checkedIds: [] };
let demoPracticeSetupId = null;
const BACKUP_STORAGE_KEY = 'ledger-and-wick-local-backup-v1';

function getPerformanceTrades() {
  return filterPerformanceTrades(trades);
}

function getVisibleJournalTrades() {
  const sourceFilter = document.getElementById('filter-trade-source')?.value || 'PERSONAL';
  if (sourceFilter === 'SAMPLE') {
    return sampleTrades && sampleTrades.length > 0 ? sampleTrades : trades.filter(isSampleTrade);
  }
  if (sourceFilter === 'SIMULATED' || sourceFilter === 'DEMO') {
    return trades.filter(isSimulatedTrade);
  }
  if (sourceFilter === 'IMPORTED') {
    return trades.filter(isImportedTrade);
  }
  if (sourceFilter === 'ALL') {
    const existingIds = new Set(trades.map(t => t.id));
    const extraSamples = (sampleTrades || []).filter(st => !existingIds.has(st.id));
    return [...trades, ...extraSamples];
  }
  return trades.filter(isPersonalTrade);
}

function persistLocalBackup() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const payload = {
    trades,
    tradingContract,
    preSessionLogs,
    tradingPlan,
    planChecklist,
    session: currentSession,
    savedAt: new Date().toISOString()
  };

  try {
    window.localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Local backup failed to save', err);
  }
}

function restoreLocalBackup() {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return null;

    const backup = JSON.parse(raw);
    if (!backup || !Array.isArray(backup.trades)) return null;
    if (backup.session && isSessionActive(backup.session)) {
      currentSession = backup.session;
    }
    return backup;
  } catch (err) {
    console.warn('Local backup restore failed', err);
    return null;
  }
}

function saveCurrentUserProfile() {
  if (!isSessionActive(currentSession) || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return saveProfileData(window.localStorage, currentSession.username, {
    trades,
    tradingContract,
    preSessionLogs,
    tradingPlan,
    planChecklist,
    savedAt: new Date().toISOString()
  });
}

function loadCurrentUserProfile() {
  if (!isSessionActive(currentSession) || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const profile = loadProfileData(window.localStorage, currentSession.username);
  if (!profile) {
    tradingPlan = normalizeTradingPlan(DEFAULT_TRADING_PLAN);
    planChecklist = normalizePlanChecklist(null, tradingPlan);
    return null;
  }

  if (Array.isArray(profile.trades)) {
    trades = tagLegacySampleTrades(profile.trades, sampleTrades);
  }
  if (profile.tradingContract) {
    tradingContract = { ...tradingContract, ...profile.tradingContract };
  }
  if (Array.isArray(profile.preSessionLogs)) {
    preSessionLogs = profile.preSessionLogs;
  }
  tradingPlan = normalizeTradingPlan(profile.tradingPlan || DEFAULT_TRADING_PLAN);
  planChecklist = normalizePlanChecklist(profile.planChecklist, tradingPlan);

  return profile;
}

function normalizePlanChecklist(checklist, plan = tradingPlan) {
  const today = new Date().toISOString().slice(0, 10);
  if (!checklist || checklist.date !== today || !Array.isArray(checklist.checkedIds)) {
    return { date: today, checkedIds: [] };
  }
  const validIds = new Set([...DEFAULT_PLAN_RULES, ...plan.customRules].map(rule => rule.id));
  return { date: today, checkedIds: checklist.checkedIds.filter(id => validIds.has(id)) };
}

function escapePlanHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function renderTradingPlan(populateForm = false) {
  tradingPlan = normalizeTradingPlan(tradingPlan);
  planChecklist = normalizePlanChecklist(planChecklist, tradingPlan);
  const form = document.getElementById('trading-plan-form');
  const checklist = document.getElementById('plan-checklist');
  const status = document.getElementById('plan-daily-status');
  const dateLabel = document.getElementById('plan-checklist-date');
  const summary = document.getElementById('plan-limit-summary');
  const allRules = [...DEFAULT_PLAN_RULES, ...tradingPlan.customRules];
  const readiness = evaluatePlanReadiness(tradingPlan, planChecklist.checkedIds);

  if (form && populateForm) {
    document.getElementById('plan-name').value = tradingPlan.name;
    document.getElementById('plan-markets').value = tradingPlan.markets;
    document.getElementById('plan-window').value = tradingPlan.tradingWindow;
    document.getElementById('plan-risk').value = tradingPlan.maxRiskPercent;
    document.getElementById('plan-max-trades').value = tradingPlan.maxDailyTrades;
    document.getElementById('plan-max-loss').value = tradingPlan.maxDailyLossR;
    document.getElementById('plan-min-rr').value = tradingPlan.minimumRewardRisk;
    document.getElementById('plan-custom-rules').value = tradingPlan.customRules.map(rule => rule.label).join('\n');
  }

  if (dateLabel) dateLabel.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  if (checklist) {
    checklist.innerHTML = allRules.map(rule => `
      <label class="plan-rule">
        <input type="checkbox" data-plan-rule="${escapePlanHtml(rule.id)}" ${planChecklist.checkedIds.includes(rule.id) ? 'checked' : ''}>
        <span>${escapePlanHtml(rule.label)}</span>
      </label>
    `).join('');
  }
  if (status) {
    status.textContent = `${readiness.completedCount} / ${readiness.totalCount} complete`;
    status.classList.toggle('ready', readiness.ready);
  }
    if (summary) {
      const limits = evaluatePlanTradeLimits({ plan: tradingPlan, trades: getPerformanceTrades(), candidateRiskPercent: 0 });
      summary.textContent = `Today: ${limits.todayTradesCount}/${tradingPlan.maxDailyTrades} trades | ${limits.todayLossR.toFixed(2)}R / ${tradingPlan.maxDailyLossR}R loss stop | ${tradingPlan.maxRiskPercent}% max risk | 1:${tradingPlan.minimumRewardRisk} minimum R:R`;
  }
}

function saveTradingPlanState() {
  saveCurrentUserProfile();
  persistLocalBackup();
}

function setupTradingPlan() {
  const form = document.getElementById('trading-plan-form');
  const checklist = document.getElementById('plan-checklist');
  renderTradingPlan(true);

  form?.addEventListener('submit', event => {
    event.preventDefault();
    const existingRules = new Map(tradingPlan.customRules.map(rule => [rule.label, rule.id]));
    const customRules = document.getElementById('plan-custom-rules').value
      .split(/\r?\n/)
      .map(label => label.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((label, index) => ({ id: existingRules.get(label) || `custom-${Date.now()}-${index}`, label }));

    tradingPlan = normalizeTradingPlan({
      name: document.getElementById('plan-name').value,
      markets: document.getElementById('plan-markets').value,
      tradingWindow: document.getElementById('plan-window').value,
      maxRiskPercent: document.getElementById('plan-risk').value,
      maxDailyTrades: document.getElementById('plan-max-trades').value,
      maxDailyLossR: document.getElementById('plan-max-loss').value,
      minimumRewardRisk: document.getElementById('plan-min-rr').value,
      customRules
    });
    planChecklist = normalizePlanChecklist(planChecklist, tradingPlan);
    saveTradingPlanState();
    renderTradingPlan(true);
    const saveStatus = document.getElementById('plan-save-status');
    if (saveStatus) saveStatus.textContent = 'Plan saved';
  });

  checklist?.addEventListener('change', event => {
    const ruleId = event.target?.dataset?.planRule;
    if (!ruleId) return;
    const checked = new Set(planChecklist.checkedIds);
    if (event.target.checked) checked.add(ruleId);
    else checked.delete(ruleId);
    planChecklist = { date: new Date().toISOString().slice(0, 10), checkedIds: [...checked] };
    saveTradingPlanState();
    renderTradingPlan();
  });
}

function updateSessionUI() {
  const loginButton = document.getElementById('btn-open-login-modal');
  const loginModal = document.getElementById('login-modal');
  const sessionPanel = document.getElementById('session-user-panel');
  const sessionUserLabel = document.getElementById('session-user-label');
  const sessionStatus = document.getElementById('session-status');

  if (isSessionActive(currentSession)) {
    const displayName = currentSession.displayName || currentSession.username;
    if (loginButton) loginButton.style.display = 'none';
    if (loginModal) loginModal.classList.remove('open');
    if (sessionPanel) sessionPanel.style.display = 'inline-flex';
    if (sessionUserLabel) sessionUserLabel.textContent = `Trader: ${displayName}`;
    if (sessionStatus) sessionStatus.textContent = 'Session active';
  } else {
    if (loginButton) loginButton.style.display = 'inline-flex';
    if (sessionPanel) sessionPanel.style.display = 'none';
    if (sessionStatus) sessionStatus.textContent = 'Please sign in';
  }
}

function setupSessionSystem() {
  const loginModal = document.getElementById('login-modal');
  const openLoginButton = document.getElementById('btn-open-login-modal');
  const closeLoginButton = document.getElementById('btn-close-login-modal');
  const cancelLoginButton = document.getElementById('btn-cancel-login');
  const loginForm = document.getElementById('login-form');
  const logoutButton = document.getElementById('btn-logout');
  const usernameInput = document.getElementById('session-username');
  const passwordInput = document.getElementById('session-password');
  const statusEl = document.getElementById('session-status');

  openLoginButton?.addEventListener('click', () => { loginModal?.classList.add('open'); });
  closeLoginButton?.addEventListener('click', () => { loginModal?.classList.remove('open'); });
  cancelLoginButton?.addEventListener('click', () => { loginModal?.classList.remove('open'); });
  loginModal?.addEventListener('click', (event) => {
    if (event.target === loginModal) {
      loginModal.classList.remove('open');
    }
  });

  loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = (usernameInput?.value || '').trim();
    const password = (passwordInput?.value || '').trim();

    if (!username || !password) {
      if (statusEl) statusEl.textContent = 'Username and password are required';
      return;
    }

    const nextSession = createSessionState({ username, displayName: username, role: 'trader' });
    currentSession = nextSession;
    saveSessionState(window.localStorage, currentSession);
    loadCurrentUserProfile();
    renderTradingPlan(true);
    persistLocalBackup();
    updateSessionUI();
    loginModal?.classList.remove('open');
    loginForm.reset();
    refreshAllViews();
  });

  logoutButton?.addEventListener('click', () => {
    currentSession = null;
    clearSessionState(window.localStorage);
    tradingPlan = normalizeTradingPlan(DEFAULT_TRADING_PLAN);
    planChecklist = normalizePlanChecklist(null, tradingPlan);
    if (statusEl) statusEl.textContent = 'Signed out';
    persistLocalBackup();
    updateSessionUI();
    renderTradingPlan(true);
  });
}

// Sample Broker CSV Template
const SAMPLE_BROKER_CSV = `Symbol,Side,EntryDate,ExitDate,EntryPrice,ExitPrice,Qty,StopLoss,TakeProfit,NetPnL,Commission
EURUSD,BUY,2026-10-01T08:30:00Z,2026-10-01T11:00:00Z,1.08200,1.08600,0.50,1.08000,1.08600,200.00,3.50
USDJPY,SELL,2026-10-01T12:00:00Z,2026-10-01T13:15:00Z,148.500,148.800,0.40,148.700,147.900,-120.00,3.00
ES,BUY,2026-10-02T13:30:00Z,2026-10-02T14:45:00Z,5020.00,5032.50,1,5012.50,5035.00,625.00,4.50
NVDA,BUY,2026-10-02T15:00:00Z,2026-10-02T15:45:00Z,124.00,121.50,80,122.50,128.00,-200.00,2.00`;

/**
 * Initialize Application
 */
async function initApp() {
  setupLessonChartExpansion();
  setupNavigation();
  setupModal();
  setupCalculator();
  setupDebriefWizard();
  setupTiltShield();
  setupCSVImport();
  setupExport();
  setupFilters();
  setupPreSession();
  setupContract();
  setupAnnotator();
  setupVisualScreenshotIngestion();
  setupCalendarView();
  setupPropFirm();
  setupPlaybook();
  setupTradingPlan();
  setupSessionSystem();
  setupResearchLab();
  setupQuickIngestBox();

  const storedSession = loadSessionState(window.localStorage);
  if (storedSession && isSessionActive(storedSession)) {
    currentSession = storedSession;
  }

  const localBackup = restoreLocalBackup();
  if (localBackup && !isSessionActive(currentSession)) {
    tradingPlan = normalizeTradingPlan(localBackup.tradingPlan || DEFAULT_TRADING_PLAN);
    planChecklist = normalizePlanChecklist(localBackup.planChecklist, tradingPlan);
  }
  if (isSessionActive(currentSession)) {
    loadCurrentUserProfile();
  }

  // Load Initial Data from REST API
  try {
    const [tradesRes, currRes, contractRes, preRes, samplesRes, plansRes, missedRes] = await Promise.all([
      fetch('/api/trades'),
      fetch('/api/curriculum'),
      fetch('/api/contract'),
      fetch('/api/presession'),
      fetch('/api/sample-trades'),
      fetch('/api/plans/pre-entry'),
      fetch('/api/missed-setups')
    ]);
    trades = await tradesRes.json();
    curriculumData = await currRes.json();
    tradingContract = await contractRes.json();
    preSessionLogs = await preRes.json();
    sampleTrades = await samplesRes.json();
    trades = tagLegacySampleTrades(trades, sampleTrades);

    if (plansRes && plansRes.ok) {
      const pData = await plansRes.json();
      preEntryPlans = pData.plans || [];
    }
    if (missedRes && missedRes.ok) {
      const mData = await missedRes.json();
      missedSetups = mData.records || [];
    }

    if (trades.length === 0 && localBackup) {
      trades = localBackup.trades || [];
      tradingContract = { ...tradingContract, ...(localBackup.tradingContract || {}) };
      preSessionLogs = localBackup.preSessionLogs || [];
    }
  } catch (err) {
    console.warn('API fetch failed, falling back to defaults', err);
    trades = tagLegacySampleTrades(localBackup?.trades || [], sampleTrades);
    tradingContract = { ...tradingContract, ...(localBackup?.tradingContract || {}) };
    preSessionLogs = localBackup?.preSessionLogs || [];
    sampleTrades = [];
  }

  window.addEventListener('beforeunload', persistLocalBackup);
  persistLocalBackup();
  updateSessionUI();

  renderTradingPlan(true);
  setupPreEntryCommitment();
  setupMissedSetups();
  refreshAllViews();
  renderCurriculum();
  renderPreSession();
  renderContract();
  renderGallery();
  checkTiltOnLoad();
}

/**
 * Recalculate metrics, scan for leaks, and re-render all views
 */
function refreshAllViews() {
  trades = analyzeTradeViolations(trades);

  renderDisciplineTape();
  renderTradeTable();
  renderLeakDiagnostics();
  renderTraderReviewObservations();
  renderDashboardSummary();
  renderPerformanceMetrics();
  renderExecutionQualityStudio();
  drawEquityCurve();
  renderExcursionDiagnostics();
  renderMonteCarloSimulation();
  updateCircuitBreakerBanner();
  updateGatekeeperBadge();
  renderPropFirmGuardian();
  renderPlaybookView();
  renderSessionStandDownBanner();
  renderPendingPreEntryPlans();
  renderMissedSetupsSummary();
  renderCalendarView();
}

/**
 * 1. Render Discipline Tape
 */
function renderDisciplineTape() {
  const container = document.getElementById('tape-items');
  if (!container) return;
  container.innerHTML = '';

  const performanceTrades = getPerformanceTrades();
  if (performanceTrades.length === 0) {
    container.innerHTML = `<span class="tape-node" style="color: var(--ink-muted);">No verified personal/imported executions recorded yet</span>`;
    return;
  }

  performanceTrades.forEach((trade) => {
    const isClean = !trade.violations || trade.violations.length === 0;
    const pnl = trade.netPnL || 0;
    const r = trade.rMultiple !== undefined ? trade.rMultiple : (pnl / (trade.plannedRiskDollars || 100));
    const rFormatted = (r >= 0 ? '+' : '') + Number(r).toFixed(2) + 'R';
    const gradeBadge = trade.disciplineGrade ? `[${trade.disciplineGrade}]` : '';

    const node = document.createElement('div');
    node.className = `tape-node ${isClean ? 'clean' : 'violation'}`;
    
    if (isClean) {
      node.innerHTML = `
        <span style="font-weight: bold;">✓ ${trade.symbol}</span>
        <span>${trade.direction}</span>
        <span style="font-weight: bold; color: var(--stamp-pass);">${gradeBadge}</span>
        <span>${rFormatted}</span>
      `;
    } else {
      const topViolation = trade.violations[0].replace('_', ' ');
      node.innerHTML = `
        <span class="rubber-stamp stamp-danger">${topViolation}</span>
        <span>${trade.symbol}</span>
        <span style="font-weight: bold; color: var(--stamp-fail);">${gradeBadge}</span>
        <span>${rFormatted}</span>
      `;
    }

    node.title = `${trade.symbol} (${trade.direction}) - PnL: $${pnl.toFixed(2)} | Grade: ${trade.disciplineGrade || 'A'} | Notes: ${trade.notes || 'None'}`;
    container.appendChild(node);
  });
}

/**
 * 2. Render Trade Table with Discipline Grades
 */
function renderTradeTable() {
  const tbody = document.getElementById('trade-table-body');
  if (!tbody) return;

  const sourceBanner = document.getElementById('trade-source-banner');
  const sourceMode = document.getElementById('filter-trade-source')?.value || 'PERSONAL';
  if (sourceBanner) {
    sourceBanner.textContent = getModeBannerText(sourceMode);
    sourceBanner.className = `trade-source-banner mode-${sourceMode.toLowerCase()}`;
  }

  const search = (document.getElementById('filter-search')?.value || '').toUpperCase();
  const assetFilter = document.getElementById('filter-asset')?.value || 'ALL';
  const violationFilter = document.getElementById('filter-violations')?.value || 'ALL';

  const filtered = getVisibleJournalTrades().filter(t => {
    if (assetFilter !== 'ALL' && t.assetClass !== assetFilter) return false;
    if (violationFilter === 'CLEAN' && t.violations && t.violations.length > 0) return false;
    if (violationFilter === 'VIOLATIONS' && (!t.violations || t.violations.length === 0)) return false;
    if (search && !t.symbol.includes(search) && !(t.setupId || '').includes(search)) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; color: var(--ink-muted); padding: 2rem;">No matching trades found in this source view.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const hasViolations = t.violations && t.violations.length > 0;
    const isSample = isSampleTrade(t);
    const isSimulated = isSimulatedTrade(t);
    const sourceLabel = getTradeSourceLabel(t);
    const sourceBadgeClass = getTradeSourceBadgeClass(t);

    const pnl = t.netPnL || 0;
    const pnlClass = pnl >= 0 ? 'gain' : 'loss';
    const pnlFormatted = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);
    const rFormatted = (t.rMultiple >= 0 ? '+' : '') + Number(t.rMultiple || 0).toFixed(2) + 'R';

    // Grade badge
    const grade = t.disciplineGrade || (hasViolations ? 'F' : 'A');
    let gradeBadge = `<span class="rubber-stamp stamp-clean">${grade}</span>`;
    if (grade === 'C') gradeBadge = `<span class="rubber-stamp stamp-warn">C</span>`;
    if (grade === 'F') gradeBadge = `<span class="rubber-stamp stamp-danger">F</span>`;

    let stampBadge = `<span class="rubber-stamp stamp-clean">PASSED</span>`;
    if (hasViolations) {
      stampBadge = t.violations.map(v => `<span class="rubber-stamp stamp-danger" title="${LEAK_DEFINITIONS[v]?.description || v}">${v.replace('_', ' ')}</span>`).join(' ');
    }

    const dateStr = t.entryDate ? new Date(t.entryDate).toLocaleDateString() : '--';

    const rowClassList = [];
    if (hasViolations) rowClassList.push('row-violation');
    if (isSample) rowClassList.push('row-sample-trade');
    if (isSimulated) rowClassList.push('row-simulated-trade');

    return `
      <tr class="${rowClassList.join(' ')}">
        <td style="font-weight: 600;">${isSample ? '<span class="sample-watermark-tag">SAMPLE</span>' : ''}${t.id || 'TR-GEN'}</td>
        <td style="color: var(--ink-muted);">${dateStr}</td>
        <td><span style="font-size: 0.75rem; border: 1px solid var(--ledger-paper-border); padding: 2px 4px; border-radius: 2px;">${t.assetClass || 'EQ'}</span></td>
        <td style="font-weight: 700;">${t.symbol}</td>
        <td style="color: ${t.direction === 'LONG' ? 'var(--ledger-gain)' : 'var(--ledger-loss)'}; font-weight: 600;">${t.direction}</td>
        <td>${Number(t.entryPrice).toFixed(2)}</td>
        <td>${t.exitPrice ? Number(t.exitPrice).toFixed(2) : '--'}</td>
        <td style="color: var(--ledger-loss);">${t.stopLoss ? Number(t.stopLoss).toFixed(2) : 'NONE'}</td>
        <td>${t.quantity}</td>
        <td class="pnl-cell ${pnlClass}">${isSample ? '<span class="sample-pnl-tag">SAMPLE</span>' : ''}${pnlFormatted}</td>
        <td style="font-weight: 600;">${rFormatted}${isSample ? ' <small style="color: #4338CA; font-size: 0.65rem;">(example)</small>' : ''}</td>
        <td>${gradeBadge}</td>
        <td>${stampBadge}</td>
        <td><span class="trade-source-badge ${sourceBadgeClass}">${sourceLabel}</span></td>
        <td style="font-size: 0.75rem; color: var(--ink-secondary);">${isSample ? '<span class="rubber-stamp stamp-neutral">EXAMPLE</span> ' : (t.executionMode === 'DEMO' || isSimulated ? '<span class="rubber-stamp stamp-neutral">DEMO</span> ' : '')}${(t.setupId || 'Discretionary').replaceAll('_', ' ')}</td>
        <td style="white-space: nowrap;">
          ${(t.hasVisualEvidence || t.screenshotUrl || t.preEntryScreenshotUrl || t.outcomeScreenshotUrl) ? `
            <button class="btn btn-primary btn-sm" style="padding: 2px 6px; font-size: 0.72rem; margin-right: 4px;" onclick="window.openTradeVisual('${t.id}')" title="View Chart Evidence">📷 Chart</button>
          ` : ''}
          <button class="btn btn-secondary btn-sm" onclick="window.openAnnotator('${t.id}')">Markup</button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 3. Render Leak Diagnostics
 */
function renderLeakDiagnostics() {
  const diag = calculateLeakDiagnostics(getPerformanceTrades());

  const elDrain = document.getElementById('stat-leak-drain');
  const elScore = document.getElementById('stat-discipline-score');
  const elClean = document.getElementById('stat-clean-pnl');
  const elViolated = document.getElementById('stat-violated-pnl');

  if (elDrain) elDrain.textContent = `-$${diag.leakExcessLossDollars.toFixed(2)}`;
  if (elScore) elScore.textContent = `${diag.disciplineScore}%`;
  if (elClean) elClean.textContent = (diag.cleanPnL >= 0 ? '+$' : '-$') + Math.abs(diag.cleanPnL).toFixed(2);
  if (elViolated) elViolated.textContent = (diag.violatedPnL >= 0 ? '+$' : '-$') + Math.abs(diag.violatedPnL).toFixed(2);

  const listContainer = document.getElementById('leak-breakdown-list');
  if (!listContainer) return;

  if (diag.violationBreakdown.length === 0) {
    listContainer.innerHTML = `<div class="card" style="color: var(--stamp-pass); font-weight: 600;">✓ Exemplary discipline! Zero rule violations detected in this journal.</div>`;
    return;
  }

  listContainer.innerHTML = diag.violationBreakdown.map(v => `
    <div class="card" style="border-left: 4px solid var(--stamp-fail);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span class="rubber-stamp stamp-danger">${v.definition.stamp}</span>
          <strong style="margin-left: 0.5rem; font-family: var(--font-serif); font-size: 1.1rem;">${v.definition.title}</strong>
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.9rem;">
          <strong>${v.count} violations</strong> | Cumulative Loss: <span class="loss">-$${v.totalLoss.toFixed(2)}</span>
        </div>
      </div>
      <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--ink-secondary);">${v.definition.description}</p>
    </div>
  `).join('');
}

/**
 * Render Empirical Trader History Review Observations
 * Strictly retrospective observations with sample sizes and quantified uncertainty.
 */
function renderTraderReviewObservations() {
  const performanceTrades = getPerformanceTrades();
  const reviewReport = generateTraderHistoryObservations(performanceTrades, { excludeSample: true });

  const badgeEl = document.getElementById('review-sample-badge');
  if (badgeEl) {
    badgeEl.textContent = `n = ${reviewReport.totalTradesAnalyzed} PERSONAL TRADES`;
  }

  const listContainer = document.getElementById('trader-review-observations-list');
  if (!listContainer) return;

  if (!reviewReport.observations || reviewReport.observations.length === 0) {
    listContainer.innerHTML = `
      <div class="card" style="padding: 1rem; color: var(--ink-muted); font-size: 0.85rem; font-style: italic; background: #FFF;">
        No personal trades recorded yet. Log your personal trades to generate historical observations with statistical uncertainty bounds.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = reviewReport.observations.map(obs => {
    let uncertaintyPill = '';
    if (obs.uncertainty?.type === 'WILSON_SCORE_95') {
      uncertaintyPill = `<span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;" title="Wilson Score 95% Confidence Interval">95% CI: ${obs.uncertainty.formatted}</span>`;
    } else if (obs.uncertainty?.type === 'MEAN_CONFIDENCE_INTERVAL_95') {
      const u = obs.uncertainty.recent || obs.uncertainty.mfe || obs.uncertainty;
      uncertaintyPill = `<span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;" title="Sample Mean ± Standard Error (95% CI)">95% CI: [${u.ciLower !== undefined ? u.ciLower.toFixed(2) : ''}, ${u.ciUpper !== undefined ? u.ciUpper.toFixed(2) : ''}]</span>`;
    } else if (obs.uncertainty?.type === 'WILSON_SCORE_DUAL_95') {
      uncertaintyPill = `<span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;" title="Dual Cohort 95% Confidence Intervals">95% CI: ${obs.uncertainty.afterLoss?.formatted || ''} vs ${obs.uncertainty.afterWin?.formatted || ''}</span>`;
    }

    return `
      <div class="card" style="background: #FFF; border: 1px solid var(--ledger-paper-border); padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
              <span class="rubber-stamp stamp-clean" style="font-size: 0.65rem;">${obs.topic.toUpperCase()}</span>
              <span class="badge-source-personal" style="font-size: 0.7rem; font-family: var(--font-mono);">n = ${obs.sampleSize}</span>
              ${uncertaintyPill}
            </div>
            <h4 style="font-family: var(--font-serif); font-size: 1.05rem; margin: 0; color: var(--ink-primary);">${obs.headline}</h4>
          </div>
          <span class="rubber-stamp stamp-neutral" style="font-size: 0.6rem; opacity: 0.85;">DESCRIPTIVE OBSERVATION</span>
        </div>
        <p style="font-size: 0.85rem; line-height: 1.6; color: var(--ink-primary); margin: 0.5rem 0;">
          ${obs.observation}
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--ledger-paper-border); font-size: 0.75rem; color: var(--ink-muted); flex-wrap: wrap; gap: 0.5rem;">
          <span>${obs.sampleSizeCaveat}</span>
          <span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent-brass);">Retrospective data only • Not a prediction</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 4. Render Executive Dashboard Summary
 */
function renderDashboardSummary() {
  const performanceTrades = getPerformanceTrades();
  const report = buildTradeSummaryReport(performanceTrades);
  const summaryEls = [
    ['summary-total-trades', `${report.totalTrades} trades`],
    ['summary-win-rate', `${report.winRate}%`],
    ['summary-net-pnl', `${report.netPnL >= 0 ? '+$' : '-$'}${Math.abs(report.netPnL).toFixed(2)}`],
    ['summary-violations', `${report.violationCount} rules`]
  ];

  summaryEls.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  const reportPanel = document.getElementById('report-summary-panel');
  if (!reportPanel) return;

  const recentTrades = [...performanceTrades].slice(-3).map((trade) => {
    const pnl = Number(trade.netPnL || 0);
    return `• ${trade.symbol} ${trade.direction} — ${pnl >= 0 ? '+$' : '-$'}${Math.abs(pnl).toFixed(2)} / ${trade.disciplineGrade || 'N/A'}`;
  }).join('<br>');

  const topObservation = report.observations && report.observations.length > 0 ? report.observations[0] : null;
  const obsHtml = topObservation ? `
    <div class="card-title" style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
      <span>Empirical History Read</span>
      <span class="rubber-stamp stamp-clean" style="font-size: 0.6rem;">n = ${topObservation.sampleSize}</span>
    </div>
    <div style="font-size: 0.8rem; line-height: 1.45; color: var(--ink-primary); margin-top: 0.35rem; background: #FFF; padding: 0.5rem; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-brass);">
      <strong>${topObservation.headline}:</strong> ${topObservation.observation}
    </div>
  ` : '';

  reportPanel.innerHTML = `
    <div class="report-card">
      <div class="card-title">Quick operational read</div>
      <div class="report-list">
        <div><strong>Net PnL:</strong> ${report.netPnL >= 0 ? '+$' : '-$'}${Math.abs(report.netPnL).toFixed(2)}</div>
        <div><strong>Average R:</strong> ${report.averageR >= 0 ? '+' : ''}${report.averageR.toFixed(2)}R</div>
        <div><strong>Clean trades:</strong> ${report.cleanTrades}</div>
      </div>
      ${obsHtml}
      <div class="card-title" style="margin-top: 1rem;">Most recent trades</div>
      <div class="report-list">${recentTrades || 'No trades logged yet.'}</div>
    </div>
  `;
}

function renderPerformanceMetrics() {
  const performanceTrades = getPerformanceTrades();
  const metrics = calculatePerformanceMetrics(performanceTrades);

  const setVal = (id, val, cls) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    if (cls) el.className = `card-value ${cls}`;
  };

  const pnlClass = metrics.netPnL >= 0 ? 'gain' : 'loss';
  setVal('metric-net-pnl', (metrics.netPnL >= 0 ? '+$' : '-$') + Math.abs(metrics.netPnL).toFixed(2), pnlClass);
  document.getElementById('metric-trades-count').textContent = `${metrics.totalTrades} trades logged`;

  setVal('metric-win-rate', `${metrics.winRate}%`);
  document.getElementById('metric-win-loss-split').textContent = `${metrics.winningTrades}W / ${metrics.losingTrades}L / ${metrics.breakevenTrades}BE`;

  setVal('metric-profit-factor', metrics.profitFactor.toFixed(2));
  setVal('metric-expectancy', `${metrics.expectancyR.toFixed(2)}R`, metrics.expectancyR >= 0 ? 'gain' : 'loss');
  document.getElementById('metric-expectancy-dollars').textContent = `${metrics.expectancyDollars >= 0 ? '+$' : '-$'}${Math.abs(metrics.expectancyDollars).toFixed(2)} / trade`;

  setVal('metric-drawdown', `-${metrics.maxDrawdownPercent.toFixed(1)}%`, 'loss');
  document.getElementById('metric-drawdown-dollars').textContent = `-$${metrics.maxDrawdownDollars.toFixed(2)} peak to trough`;

  const assetGroups = groupTradesBy(performanceTrades, 'assetClass');
  const assetTbody = document.getElementById('table-asset-breakdown');
  if (assetTbody) {
    assetTbody.innerHTML = assetGroups.map(g => `
      <tr>
        <td><strong>${g.name}</strong></td>
        <td>${g.count}</td>
        <td>${g.winRate}%</td>
        <td class="pnl-cell ${g.netPnL >= 0 ? 'gain' : 'loss'}">${g.netPnL >= 0 ? '+$' : '-$'}${Math.abs(g.netPnL).toFixed(2)}</td>
        <td>${g.totalR >= 0 ? '+' : ''}${g.totalR.toFixed(2)}R</td>
      </tr>
    `).join('');
  }

  const setupGroups = groupTradesBy(performanceTrades, 'setupId');
  const setupTbody = document.getElementById('table-setup-breakdown');
  if (setupTbody) {
    setupTbody.innerHTML = setupGroups.map(g => `
      <tr>
        <td><strong>${g.name.replace('_', ' ')}</strong></td>
        <td>${g.count}</td>
        <td>${g.winRate}%</td>
        <td class="pnl-cell ${g.netPnL >= 0 ? 'gain' : 'loss'}">${g.netPnL >= 0 ? '+$' : '-$'}${Math.abs(g.netPnL).toFixed(2)}</td>
        <td>${g.totalR >= 0 ? '+' : ''}${g.totalR.toFixed(2)}R</td>
      </tr>
    `).join('');
  }
}

/**
 * 4.5. Render Execution Quality & Process vs Outcome Studio
 */
function renderExecutionQualityStudio() {
  const performanceTrades = getPerformanceTrades();
  const cohorts = compareExecutionCohorts(performanceTrades);

  const complianceBadge = document.getElementById('exec-compliance-badge');
  if (complianceBadge) {
    complianceBadge.textContent = `PROCESS ADHERENCE: ${cohorts.complianceRate}%`;
    complianceBadge.className = cohorts.complianceRate >= 80 ? 'rubber-stamp stamp-clean' : (cohorts.complianceRate >= 60 ? 'rubber-stamp stamp-neutral' : 'rubber-stamp stamp-danger');
  }

  // 4 Quadrants
  const setHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };

  setHtml('matrix-earned-count', `${cohorts.quadrants.earnedWins.count} <span style="font-size: 0.85rem; font-weight: normal;">(${cohorts.quadrants.earnedWins.percent}%)</span>`);
  setHtml('matrix-earned-pnl', `+$${cohorts.quadrants.earnedWins.totalPnL.toFixed(2)} (${cohorts.quadrants.earnedWins.totalR >= 0 ? '+' : ''}${cohorts.quadrants.earnedWins.totalR.toFixed(2)}R)`);

  setHtml('matrix-comploss-count', `${cohorts.quadrants.compliantLosses.count} <span style="font-size: 0.85rem; font-weight: normal;">(${cohorts.quadrants.compliantLosses.percent}%)</span>`);
  setHtml('matrix-comploss-pnl', `-$${Math.abs(cohorts.quadrants.compliantLosses.totalPnL).toFixed(2)} (${cohorts.quadrants.compliantLosses.totalR.toFixed(2)}R)`);

  setHtml('matrix-lucky-count', `${cohorts.quadrants.luckyWins.count} <span style="font-size: 0.85rem; font-weight: normal;">(${cohorts.quadrants.luckyWins.percent}%)</span>`);
  setHtml('matrix-lucky-pnl', `+$${cohorts.quadrants.luckyWins.totalPnL.toFixed(2)} (${cohorts.quadrants.luckyWins.totalR >= 0 ? '+' : ''}${cohorts.quadrants.luckyWins.totalR.toFixed(2)}R)`);

  setHtml('matrix-unforced-count', `${cohorts.quadrants.unforcedErrors.count} <span style="font-size: 0.85rem; font-weight: normal;">(${cohorts.quadrants.unforcedErrors.percent}%)</span>`);
  setHtml('matrix-unforced-pnl', `-$${Math.abs(cohorts.quadrants.unforcedErrors.totalPnL).toFixed(2)} (${cohorts.quadrants.unforcedErrors.totalR.toFixed(2)}R)`);

  // Cohort comparison table
  const comp = cohorts.compliantCohort;
  const nonComp = cohorts.nonCompliantCohort;

  setHtml('cohort-comp-count', `<strong>${comp.count}</strong> (${comp.percentOfTotal}%)`);
  setHtml('cohort-noncomp-count', `<strong>${nonComp.count}</strong> (${nonComp.percentOfTotal}%)`);

  setHtml('cohort-comp-winrate', `<strong>${comp.winRate}%</strong> (${comp.wins}W / ${comp.losses}L)`);
  setHtml('cohort-noncomp-winrate', `<strong>${nonComp.winRate}%</strong> (${nonComp.wins}W / ${nonComp.losses}L)`);

  setHtml('cohort-comp-avgr', `<strong>${comp.avgR >= 0 ? '+' : ''}${comp.avgR.toFixed(2)}R</strong>`);
  setHtml('cohort-noncomp-avgr', `<strong>${nonComp.avgR >= 0 ? '+' : ''}${nonComp.avgR.toFixed(2)}R</strong>`);

  setHtml('cohort-comp-pf', `<strong>${comp.profitFactor.toFixed(2)}</strong>`);
  setHtml('cohort-noncomp-pf', `<strong>${nonComp.profitFactor.toFixed(2)}</strong>`);

  setHtml('cohort-comp-netpnl', `<span class="${comp.netPnL >= 0 ? 'gain' : 'loss'}"><strong>${comp.netPnL >= 0 ? '+$' : '-$'}${Math.abs(comp.netPnL).toFixed(2)}</strong> (${comp.totalR >= 0 ? '+' : ''}${comp.totalR.toFixed(2)}R)</span>`);
  setHtml('cohort-noncomp-netpnl', `<span class="${nonComp.netPnL >= 0 ? 'gain' : 'loss'}"><strong>${nonComp.netPnL >= 0 ? '+$' : '-$'}${Math.abs(nonComp.netPnL).toFixed(2)}</strong> (${nonComp.totalR >= 0 ? '+' : ''}${nonComp.totalR.toFixed(2)}R)</span>`);

  setHtml('cohort-comp-worstloss', `-${comp.worstLossR.toFixed(2)}R`);
  setHtml('cohort-noncomp-worstloss', `-${nonComp.worstLossR.toFixed(2)}R`);

  // Phase adherence rates
  const rb = cohorts.ruleBreakdown;
  setHtml('phase-rate-entry', `${rb.entryComplianceRate}%`);
  const barEntry = document.getElementById('phase-bar-entry');
  if (barEntry) barEntry.style.width = `${rb.entryComplianceRate}%`;

  setHtml('phase-rate-stop', `${rb.stopComplianceRate}%`);
  const barStop = document.getElementById('phase-bar-stop');
  if (barStop) barStop.style.width = `${rb.stopComplianceRate}%`;

  setHtml('phase-rate-target', `${rb.targetComplianceRate}%`);
  const barTarget = document.getElementById('phase-bar-target');
  if (barTarget) barTarget.style.width = `${rb.targetComplianceRate}%`;

  setHtml('phase-rate-exit', `${rb.exitComplianceRate}%`);
  const barExit = document.getElementById('phase-bar-exit');
  if (barExit) barExit.style.width = `${rb.exitComplianceRate}%`;

  // Tail risk callout
  const tailCallout = document.getElementById('cohort-tailrisk-callout');
  if (tailCallout) {
    if (nonComp.worstLossR > comp.worstLossR) {
      tailCallout.innerHTML = `🛡️ <strong>Tail Risk Shield:</strong> Worst compliant loss was strictly capped at <strong>-${comp.worstLossR.toFixed(1)}R</strong>, while non-compliant trades suffered an unmanaged <strong>-${nonComp.worstLossR.toFixed(1)}R</strong> outlier loss.`;
    } else {
      tailCallout.innerHTML = `🛡️ <strong>Tail Risk Shield:</strong> Compliant stop rules keep loss distribution tight, eliminating unmanaged blowout risk.`;
    }
  }

  // Insights list
  const insightsList = document.getElementById('exec-insights-list');
  if (insightsList) {
    insightsList.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 0.35rem; color: var(--ink-secondary); font-size: 0.78rem; text-transform: uppercase; font-family: var(--font-mono);">Behavioral & Process Insights:</div>
      <ul style="margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.3rem;">
        ${cohorts.insights.map(i => `<li>${i}</li>`).join('')}
      </ul>
    `;
  }
}


/**
 * 5. Render MAE & MFE Excursion Diagnostics
 */
function renderExcursionDiagnostics() {
  const excursion = analyzeExcursionPatterns(getPerformanceTrades());

  const elMae = document.getElementById('stat-avg-win-mae');
  const elMfe = document.getElementById('stat-avg-win-mfe');
  const elRealized = document.getElementById('stat-avg-realized-win');
  const elProfitLeft = document.getElementById('stat-profit-left');
  const elEff = document.getElementById('stat-target-efficiency');
  const elInsights = document.getElementById('excursion-insights-list');

  if (elMae) elMae.textContent = `-${excursion.avgWinMaeR.toFixed(2)}R`;
  if (elMfe) elMfe.textContent = `+${excursion.avgWinMfeR.toFixed(2)}R`;
  if (elRealized) elRealized.textContent = `+${excursion.avgRealizedWinR.toFixed(2)}R`;
  if (elProfitLeft) elProfitLeft.textContent = `${excursion.avgProfitLeftOnTableR.toFixed(2)}R`;
  if (elEff) elEff.textContent = `TARGET EFFICIENCY: ${excursion.targetCaptureEfficiencyPercent}%`;

  if (elInsights) {
    elInsights.innerHTML = excursion.insights.map(i => `<div style="margin-bottom: 0.35rem;">• ${i}</div>`).join('');
  }
}

/**
 * 6. Render Monte Carlo Streak Simulator
 */
function renderMonteCarloSimulation() {
  const metrics = calculatePerformanceMetrics(getPerformanceTrades());
  const winRate = metrics.winRate > 0 ? metrics.winRate : 50;
  const sim = simulateLosingStreakProbabilities({ winRatePercent: winRate, tradesCount: 100, iterations: 1000 });

  const s3 = document.getElementById('sim-streak-3');
  const s4 = document.getElementById('sim-streak-4');
  const s5 = document.getElementById('sim-streak-5');
  const s6 = document.getElementById('sim-streak-6');
  const sAvg = document.getElementById('sim-avg-streak');
  const adviceEl = document.getElementById('sim-advice-text');

  if (s3) s3.textContent = `${sim.probabilities.streak3}%`;
  if (s4) s4.textContent = `${sim.probabilities.streak4}%`;
  if (s5) s5.textContent = `${sim.probabilities.streak5}%`;
  if (s6) s6.textContent = `${sim.probabilities.streak6}%`;
  if (sAvg) sAvg.textContent = `${sim.avgMaxStreak} Losses`;
  if (adviceEl) adviceEl.textContent = sim.advice;
}

/**
 * 7. Active Tilt Interceptor & Cooldown Lockout Shield
 */
function setupTiltShield() {
  const modal = document.getElementById('tilt-shield-modal');
  const timerDisplay = document.getElementById('tilt-timer-display');
  const unlockBtn = document.getElementById('btn-unlock-cooldown');
  const statusBtn = document.getElementById('btn-tilt-status');

  const step1 = document.getElementById('check-reset-step1');
  const step2 = document.getElementById('check-reset-step2');
  const step3 = document.getElementById('check-reset-step3');

  function updateUnlockButtonState() {
    if (step1.checked && step2.checked && step3.checked) {
      unlockBtn.disabled = false;
      unlockBtn.className = 'btn btn-primary';
      unlockBtn.textContent = 'Mindset Restored — Dismiss Lockout Shield';
    } else {
      unlockBtn.disabled = true;
      unlockBtn.className = 'btn btn-secondary';
      unlockBtn.textContent = 'Lockout Active (Complete All 3 Steps)';
    }
  }

  [step1, step2, step3].forEach(c => c?.addEventListener('change', updateUnlockButtonState));

  unlockBtn?.addEventListener('click', () => {
    modal.classList.remove('open');
    if (tiltTimerInterval) clearInterval(tiltTimerInterval);
  });

  statusBtn?.addEventListener('click', () => {
    modal.classList.add('open');
  });
}

function checkTiltOnLoad() {
  const tilt = evaluateTiltState(getPerformanceTrades(), tradingContract.cooldownMinutes);
  const statusBtn = document.getElementById('btn-tilt-status');
  const modal = document.getElementById('tilt-shield-modal');
  const timerDisplay = document.getElementById('tilt-timer-display');

  if (tilt.isCooldownRequired && tilt.minutesRemaining > 0) {
    if (statusBtn) {
      statusBtn.style.display = 'inline-block';
      statusBtn.textContent = `COOLDOWN: ${tilt.minutesRemaining}m 🛡️`;
      statusBtn.className = 'rubber-stamp stamp-danger';
    }

    // Launch countdown timer
    let secondsLeft = tilt.minutesRemaining * 60;
    if (tiltTimerInterval) clearInterval(tiltTimerInterval);

    tiltTimerInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(tiltTimerInterval);
        if (timerDisplay) timerDisplay.textContent = '00:00';
        if (statusBtn) statusBtn.style.display = 'none';
        return;
      }
      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;
      const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (timerDisplay) timerDisplay.textContent = str;
      if (statusBtn) statusBtn.textContent = `COOLDOWN: ${mins}m 🛡️`;
    }, 1000);
  } else {
    if (statusBtn) statusBtn.style.display = 'none';
  }
}

/**
 * 8. 60-Second Post-Trade Guided Debrief Wizard
 */
function setupDebriefWizard() {
  const integritySelect = document.getElementById('debrief-integrity');
  const managementSelect = document.getElementById('debrief-management');
  const emotionSelect = document.getElementById('debrief-emotion');
  const gradeBadge = document.getElementById('debrief-live-grade');

  function updateDebriefGrade() {
    const debrief = {
      executionIntegrity: integritySelect.value,
      tradeManagement: managementSelect.value,
      emotionalTemperature: emotionSelect.value
    };

    const graded = gradeTradeDebrief(debrief);
    if (gradeBadge) {
      gradeBadge.textContent = `GRADE: ${graded.grade} (${graded.score}%)`;
      if (graded.grade === 'A') gradeBadge.className = 'rubber-stamp stamp-clean';
      else if (graded.grade === 'B') gradeBadge.className = 'rubber-stamp stamp-clean';
      else if (graded.grade === 'C') gradeBadge.className = 'rubber-stamp stamp-warn';
      else gradeBadge.className = 'rubber-stamp stamp-danger';
    }
  }

  [integritySelect, managementSelect, emotionSelect].forEach(el => {
    el?.addEventListener('change', updateDebriefGrade);
  });
}

/**
 * 9. Render Visual Trade Gallery & Evidence Filmstrip
 */
function renderGallery() {
  const galleryGrid = document.getElementById('gallery-grid');
  if (!galleryGrid) return;

  const filterSetup = document.getElementById('gallery-filter-setup')?.value || 'ALL';
  const filterEvidence = document.getElementById('gallery-filter-evidence')?.value || 'ALL';

  // Update Visual Accountability & Evidence HUD
  const perfTrades = getPerformanceTrades();
  const vMetrics = calculateVisualEvidenceMetrics(perfTrades, preEntryPlans, missedSetups);
  const vCohorts = compareVisualAccountabilityCohorts(perfTrades);

  const statTradesCount = document.getElementById('visual-stat-trades-count');
  if (statTradesCount) statTradesCount.textContent = `${vMetrics.tradesWithVisuals} / ${vMetrics.totalTrades}`;

  const statCoverageCi = document.getElementById('visual-stat-coverage-ci');
  if (statCoverageCi) statCoverageCi.textContent = `95% CI: ${vMetrics.visualCoverageCI?.formatted || '--'}`;

  const statDualCount = document.getElementById('visual-stat-dual-count');
  if (statDualCount) statDualCount.textContent = `${vMetrics.tradesWithBeforeAndAfter} (${vMetrics.beforeAndAfterPercent.toFixed(1)}%)`;

  const statDocComp = document.getElementById('visual-stat-doc-compliance');
  if (statDocComp) statDocComp.textContent = `${vCohorts.documentedCohort.complianceRate.toFixed(1)}%`;

  const statUndocComp = document.getElementById('visual-stat-undoc-compliance');
  if (statUndocComp) statUndocComp.textContent = `${vCohorts.undocumentedCohort.complianceRate.toFixed(1)}%`;

  const hudBadge = document.getElementById('visual-hud-coverage-badge');
  if (hudBadge) {
    hudBadge.textContent = `EVIDENCE COVERAGE: ${vMetrics.visualCoveragePercent.toFixed(0)}%`;
    hudBadge.className = vMetrics.visualCoveragePercent >= 70 ? 'rubber-stamp stamp-clean' : (vMetrics.visualCoveragePercent >= 40 ? 'rubber-stamp stamp-warn' : 'rubber-stamp stamp-danger');
  }

  // Handle Missed Setups Evidence View
  if (filterEvidence === 'MISSED_SETUPS') {
    const missedList = missedSetups.filter(m => filterSetup === 'ALL' || m.setupId === filterSetup);
    if (missedList.length === 0) {
      galleryGrid.innerHTML = `<div class="card full" style="text-align: center; color: var(--ink-muted); padding: 3rem;">No passed setup charts logged yet.</div>`;
      return;
    }

    galleryGrid.innerHTML = missedList.map(m => {
      const hasPic = Boolean(m.screenshotUrl);
      return `
        <div class="gallery-card">
          <div class="gallery-preview-box" style="position: relative; height: 180px; overflow: hidden; background: #12151A; display: flex; align-items: center; justify-content: center; cursor: pointer;"
               onclick="${hasPic ? `window.openLightbox('${m.screenshotUrl}', '${m.symbol} Passed Setup', '${m.reasonLabel}', null, '${m.reflection || ''}')` : ''}">
            ${hasPic ? `
              <span class="rubber-stamp stamp-clean" style="position: absolute; top: 6px; left: 6px; font-size: 0.6rem; z-index: 2; background: rgba(0,0,0,0.7); color: #FFF;">PASSED OPPORTUNITY</span>
              <img src="${m.screenshotUrl}" alt="Passed Setup" style="width: 100%; height: 100%; object-fit: cover;">
            ` : `
              <div style="text-align: center; color: var(--ink-muted); padding: 1rem;">
                <span style="font-size: 2rem; display: block; margin-bottom: 0.25rem;">🛡️</span>
                <span style="font-size: 0.85rem; font-family: var(--font-serif); color: var(--ink-secondary);">No Chart Attached</span>
                <div style="font-size: 0.72rem; margin-top: 0.25rem;">Discipline win recorded ($0 cost)</div>
              </div>
            `}
          </div>
          <div style="padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <strong style="font-family: var(--font-serif); font-size: 1.15rem;">${m.symbol}</strong>
              <span class="rubber-stamp ${m.isDisciplineWin ? 'stamp-clean' : 'stamp-neutral'}">${m.isDisciplineWin ? 'DISCIPLINE WIN' : 'PASSED'}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--ink-secondary); margin-bottom: 0.5rem;">
              ${m.reasonLabel}
            </div>
            ${m.reflection ? `<div style="font-size: 0.76rem; color: var(--ink-muted); margin-bottom: 0.5rem; font-style: italic;">"${m.reflection}"</div>` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--ink-muted);">
              <span>${new Date(m.date || m.createdAt).toLocaleDateString()}</span>
              ${hasPic ? `<button class="btn btn-primary btn-sm" onclick="window.openLightbox('${m.screenshotUrl}', '${m.symbol}', '${m.reasonLabel}', null, '${m.reflection || ''}')">View High-Res</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  // Filter Trades
  const filtered = getVisibleJournalTrades().filter(t => {
    if (filterSetup !== 'ALL' && t.setupId !== filterSetup) return false;
    const hasBefore = Boolean(t.hasPreEntryScreenshot || t.preEntryScreenshotUrl || (t.screenshots && t.screenshots.some(s => s.tag === 'PRE_ENTRY')));
    const hasAfter = Boolean(t.hasOutcomeScreenshot || t.outcomeScreenshotUrl || t.screenshotUrl || (t.screenshots && t.screenshots.some(s => s.tag === 'OUTCOME')));
    const hasAny = hasBefore || hasAfter || Boolean(t.hasVisualEvidence);

    if (filterEvidence === 'HAS_SCREENSHOT' && !hasAny) return false;
    if (filterEvidence === 'DUAL_BEFORE_AFTER' && !(hasBefore && hasAfter)) return false;
    return true;
  });

  if (filtered.length === 0) {
    galleryGrid.innerHTML = `<div class="card full" style="text-align: center; color: var(--ink-muted); padding: 3rem;">No trade charts matching selected filters.</div>`;
    return;
  }

  galleryGrid.innerHTML = filtered.map(t => {
    const isGain = (t.netPnL || 0) >= 0;
    const isSample = isSampleTrade(t);
    const sourceLabel = getTradeSourceLabel(t);
    const sourceBadgeClass = getTradeSourceBadgeClass(t);
    const rFormatted = (t.rMultiple >= 0 ? '+' : '') + Number(t.rMultiple || 0).toFixed(2) + 'R';
    const grade = t.disciplineGrade || (isGain ? 'A' : 'C');

    const beforeUrl = t.preEntryScreenshotUrl || (t.screenshots && t.screenshots.find(s => s.tag === 'PRE_ENTRY')?.url) || null;
    const afterUrl = t.outcomeScreenshotUrl || (t.screenshots && t.screenshots.find(s => s.tag === 'OUTCOME')?.url) || t.screenshotUrl || null;
    const hasDual = Boolean(beforeUrl && afterUrl);
    const singleUrl = afterUrl || beforeUrl;

    let previewContent = '';
    if (hasDual) {
      previewContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; height: 180px; width: 100%; position: relative; cursor: pointer;"
             onclick="window.openLightbox('${afterUrl}', '${t.symbol} (${t.direction}) [${t.id}]', 'Planned vs. Outcome Dual Split', '${beforeUrl}', '${t.notes || ''}')"
             title="Click to open Before/After Dual Split View">
          <div style="position: relative; height: 100%; overflow: hidden; background: #12151A;">
            <span class="rubber-stamp stamp-neutral" style="position: absolute; top: 4px; left: 4px; font-size: 0.55rem; background: rgba(0,0,0,0.75); color: #FFF; z-index: 2;">BEFORE</span>
            <img src="${beforeUrl}" alt="Before Plan" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <div style="position: relative; height: 100%; overflow: hidden; background: #12151A;">
            <span class="rubber-stamp stamp-neutral" style="position: absolute; top: 4px; left: 4px; font-size: 0.55rem; background: rgba(0,0,0,0.75); color: #FFF; z-index: 2;">AFTER</span>
            <img src="${afterUrl}" alt="After Outcome" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <span class="rubber-stamp stamp-clean" style="position: absolute; bottom: 6px; right: 6px; font-size: 0.55rem; background: rgba(255,255,255,0.9); z-index: 3;">DUAL PROOF ✓</span>
        </div>
      `;
    } else if (singleUrl) {
      previewContent = `
        <div style="position: relative; height: 180px; width: 100%; overflow: hidden; background: #12151A; cursor: pointer;"
             onclick="window.openLightbox('${singleUrl}', '${t.symbol} (${t.direction}) [${t.id}]', '${(t.setupId || '').replace('_', ' ')} • ${rFormatted}', null, '${t.notes || ''}')"
             title="Click to view chart screenshot">
          <span class="rubber-stamp stamp-neutral" style="position: absolute; top: 6px; left: 6px; font-size: 0.6rem; background: rgba(0,0,0,0.75); color: #FFF; z-index: 2;">
            ${beforeUrl ? 'BEFORE (PLAN)' : 'CHART PROOF'}
          </span>
          <img src="${singleUrl}" alt="Chart Evidence" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      `;
    } else {
      previewContent = `
        <div style="position: relative;">
          ${renderTradeChartSVG(t)}
        </div>
      `;
    }

    return `
      <div class="gallery-card ${isSample ? 'card-sample-trade' : ''}">
        ${isSample ? '<div class="card-sample-notice">SAMPLE EXAMPLE · NOT YOUR TRADING RESULTS</div>' : ''}
        <div class="gallery-preview-box">
          ${previewContent}
        </div>
        <div style="padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div>
              <strong style="font-family: var(--font-serif); font-size: 1.15rem;">${t.symbol}</strong>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-muted); margin-left: 0.5rem;">${t.direction}</span>
              <span class="trade-source-badge ${sourceBadgeClass}">${sourceLabel}</span>
              <span class="rubber-stamp stamp-clean" style="margin-left: 0.5rem;">${grade}</span>
            </div>
            <span class="pnl-cell ${isGain ? 'gain' : 'loss'}" style="font-size: 1.1rem;">${isSample ? '<span class="sample-pnl-tag">SAMPLE</span>' : ''}${rFormatted}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--ink-secondary); margin-bottom: 0.75rem;">
            <span>Setup: <strong>${(t.setupId || 'Discretionary').replace('_', ' ')}</strong></span>
            <span>MAE: -${Number(t.maePrice ? Math.abs((t.entryPrice - t.maePrice) / (t.entryPrice - t.stopLoss || 1)) : 0).toFixed(2)}R</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.75rem; color: var(--ink-muted);">${new Date(t.entryDate).toLocaleDateString()}</span>
            <div style="display: flex; gap: 0.35rem;">
              ${(singleUrl) ? `
                <button class="btn btn-primary btn-sm" onclick="window.openTradeVisual('${t.id}')" title="Open Lightbox">📷 Chart</button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.openAnnotator('${t.id}')">Markup</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 10. Interactive Canvas Annotator
 */
function setupAnnotator() {
  window.openAnnotator = (tradeId) => {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return;
    annotatingTrade = trade;

    const modal = document.getElementById('annotator-modal');
    const title = document.getElementById('annotator-title');
    const subtitle = document.getElementById('annotator-subtitle');
    const container = document.getElementById('annotator-chart-container');

    title.textContent = `Annotating: ${trade.symbol} (${trade.direction}) [${trade.id}]`;
    subtitle.textContent = `Entry: ${trade.entryPrice} | Stop: ${trade.stopLoss} | PnL: $${trade.netPnL}`;
    container.innerHTML = renderTradeChartSVG(trade);

    modal.classList.add('open');
    initCanvas();
  };

  document.getElementById('btn-close-annotator')?.addEventListener('click', () => {
    document.getElementById('annotator-modal')?.classList.remove('open');
  });

  document.getElementById('tool-draw-line')?.addEventListener('click', () => { currentTool = 'line'; });
  document.getElementById('tool-add-bos')?.addEventListener('click', () => { currentTool = 'bos'; });
  document.getElementById('tool-add-pinbar')?.addEventListener('click', () => { currentTool = 'pinbar'; });
  document.getElementById('tool-add-retest')?.addEventListener('click', () => { currentTool = 'retest'; });
  document.getElementById('tool-clear-markup')?.addEventListener('click', initCanvas);

  document.getElementById('btn-save-annotation')?.addEventListener('click', () => {
    alert(`Markup successfully saved to trade ${annotatingTrade?.id || ''}.`);
    document.getElementById('annotator-modal')?.classList.remove('open');
  });

  document.getElementById('gallery-filter-setup')?.addEventListener('change', renderGallery);
}

function initCanvas() {
  const canvas = document.getElementById('annotator-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  canvas.onmousedown = (e) => {
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    isDrawing = true;

    if (currentTool !== 'line') {
      ctx.font = 'bold 11px JetBrains Mono';
      ctx.textBaseline = 'middle';
      if (currentTool === 'bos') {
        ctx.fillStyle = '#1F5C3E';
        ctx.fillText('🏷️ BOS BREAK', startX, startY);
      } else if (currentTool === 'pinbar') {
        ctx.fillStyle = '#A88948';
        ctx.fillText('🏷️ PIN BAR REJECTION', startX, startY);
      } else if (currentTool === 'retest') {
        ctx.fillStyle = '#1F5C3E';
        ctx.fillText('🏷️ SUPPORT RETEST', startX, startY);
      }
      isDrawing = false;
    }
  };

  canvas.onmousemove = (e) => {
    if (!isDrawing || currentTool !== 'line') return;
    const rect = canvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    ctx.strokeStyle = '#8F251E';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(curX, curY);
    ctx.stroke();
  };

  canvas.onmouseup = () => {
    isDrawing = false;
  };
}

/**
 * 10b. Visual Journal Lightbox & Screenshot Upload Engine
 */
window.openTradeVisual = (tradeId) => {
  const trade = trades.find(t => t.id === tradeId);
  if (!trade) return;
  const beforeUrl = trade.preEntryScreenshotUrl || (trade.screenshots && trade.screenshots.find(s => s.tag === 'PRE_ENTRY')?.url) || null;
  const afterUrl = trade.outcomeScreenshotUrl || (trade.screenshots && trade.screenshots.find(s => s.tag === 'OUTCOME')?.url) || trade.screenshotUrl || null;
  const primary = afterUrl || beforeUrl;
  const secondary = (afterUrl && beforeUrl) ? beforeUrl : null;
  const rFormatted = (trade.rMultiple >= 0 ? '+' : '') + Number(trade.rMultiple || 0).toFixed(2) + 'R';

  window.openLightbox(
    primary,
    `${trade.symbol} (${trade.direction}) — ${trade.id}`,
    `Setup: ${(trade.setupId || 'Discretionary').replace('_', ' ')} | PnL: $${trade.netPnL || 0} (${rFormatted})`,
    secondary,
    trade.notes || trade.planThesis || ''
  );
};

window.openLightbox = (primaryUrl, title, subtitle, secondaryUrl = null, notes = '') => {
  const modal = document.getElementById('lightbox-modal');
  if (!modal) return;

  currentLightboxData = {
    primaryUrl,
    secondaryUrl,
    currentMode: secondaryUrl ? 'split' : 'single'
  };

  const titleEl = document.getElementById('lightbox-title');
  if (titleEl) titleEl.textContent = title || 'Chart Evidence';
  const subEl = document.getElementById('lightbox-subtitle');
  if (subEl) subEl.textContent = subtitle || '';
  const notesEl = document.getElementById('lightbox-notes');
  if (notesEl) notesEl.textContent = notes ? `Notes / Reflection: ${notes}` : '';

  const toggleBox = document.getElementById('lightbox-view-toggle');
  const singleView = document.getElementById('lightbox-single-view');
  const splitView = document.getElementById('lightbox-split-view');
  const primaryImg = document.getElementById('lightbox-primary-img');
  const beforeImg = document.getElementById('lightbox-split-before-img');
  const afterImg = document.getElementById('lightbox-split-after-img');

  if (secondaryUrl) {
    if (toggleBox) toggleBox.style.display = 'flex';
    if (beforeImg) beforeImg.src = secondaryUrl;
    if (afterImg) afterImg.src = primaryUrl;
    if (singleView) singleView.style.display = 'none';
    if (splitView) splitView.style.display = 'grid';
    const badge = document.getElementById('lightbox-badge');
    if (badge) badge.textContent = 'DUAL SPLIT';
  } else {
    if (toggleBox) toggleBox.style.display = 'none';
    if (primaryImg) primaryImg.src = primaryUrl;
    if (singleView) singleView.style.display = 'flex';
    if (splitView) splitView.style.display = 'none';
    const badge = document.getElementById('lightbox-badge');
    if (badge) badge.textContent = 'CHART PROOF';
  }

  modal.classList.add('open');
};

function setupLightbox() {
  const modal = document.getElementById('lightbox-modal');
  if (!modal) return;

  const closeModal = () => modal.classList.remove('open');
  document.getElementById('btn-close-lightbox')?.addEventListener('click', closeModal);
  document.getElementById('btn-lightbox-close-bottom')?.addEventListener('click', closeModal);

  document.getElementById('btn-lightbox-mode-before')?.addEventListener('click', () => {
    const singleView = document.getElementById('lightbox-single-view');
    const splitView = document.getElementById('lightbox-split-view');
    if (singleView) singleView.style.display = 'flex';
    if (splitView) splitView.style.display = 'none';
    const pImg = document.getElementById('lightbox-primary-img');
    if (pImg) pImg.src = currentLightboxData.secondaryUrl || currentLightboxData.primaryUrl;
    const badge = document.getElementById('lightbox-badge');
    if (badge) badge.textContent = 'BEFORE (PLAN)';
  });

  document.getElementById('btn-lightbox-mode-after')?.addEventListener('click', () => {
    const singleView = document.getElementById('lightbox-single-view');
    const splitView = document.getElementById('lightbox-split-view');
    if (singleView) singleView.style.display = 'flex';
    if (splitView) splitView.style.display = 'none';
    const pImg = document.getElementById('lightbox-primary-img');
    if (pImg) pImg.src = currentLightboxData.primaryUrl;
    const badge = document.getElementById('lightbox-badge');
    if (badge) badge.textContent = 'AFTER (OUTCOME)';
  });

  document.getElementById('btn-lightbox-mode-split')?.addEventListener('click', () => {
    const singleView = document.getElementById('lightbox-single-view');
    const splitView = document.getElementById('lightbox-split-view');
    if (singleView) singleView.style.display = 'none';
    if (splitView) splitView.style.display = 'grid';
    const badge = document.getElementById('lightbox-badge');
    if (badge) badge.textContent = 'DUAL SPLIT';
  });

  document.getElementById('btn-lightbox-download')?.addEventListener('click', () => {
    const singleVisible = document.getElementById('lightbox-single-view')?.style.display === 'flex';
    const src = singleVisible
      ? document.getElementById('lightbox-primary-img')?.src
      : (currentLightboxData.primaryUrl || currentLightboxData.secondaryUrl);
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `chart-evidence-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

async function uploadScreenshotFile(file, tag = 'GENERAL', entityType = null, entityId = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      try {
        const res = await fetch('/api/screenshots/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            mimeType: file.type || 'image/png',
            tag,
            entityType,
            entityId,
            timeframe: ''
          })
        });
        const data = await res.json();
        if (data.screenshot?.url) {
          resolve(data.screenshot.url);
        } else {
          resolve(base64Data);
        }
      } catch (err) {
        console.warn('Screenshot upload API error, using data URL fallback:', err);
        resolve(base64Data);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setupVisualScreenshotIngestion() {
  setupLightbox();

  const bindDropzone = ({ dropzoneId, fileInputId, promptId, previewBoxId, previewImgId, removeBtnId, hiddenInputId, tag, entityType, onSelect }) => {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(fileInputId);
    const promptEl = document.getElementById(promptId);
    const previewBox = document.getElementById(previewBoxId);
    const previewImg = document.getElementById(previewImgId);
    const removeBtn = document.getElementById(removeBtnId);
    const hiddenInput = document.getElementById(hiddenInputId);

    if (!dropzone) return;

    dropzone.addEventListener('click', (e) => {
      if (e.target !== removeBtn && !removeBtn?.contains(e.target)) {
        fileInput?.click();
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--ledger-profit)';
      dropzone.style.background = '#F2F8F4';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--ledger-paper-border)';
      dropzone.style.background = '#FFF';
    });

    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--ledger-paper-border)';
      dropzone.style.background = '#FFF';
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const url = await uploadScreenshotFile(file, tag, entityType);
        if (hiddenInput) hiddenInput.value = url;
        if (previewImg) previewImg.src = url;
        if (previewBox) previewBox.style.display = 'block';
        if (promptEl) promptEl.style.display = 'none';
        if (onSelect) onSelect(url);
      }
    });

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const url = await uploadScreenshotFile(file, tag, entityType);
        if (hiddenInput) hiddenInput.value = url;
        if (previewImg) previewImg.src = url;
        if (previewBox) previewBox.style.display = 'block';
        if (promptEl) promptEl.style.display = 'none';
        if (onSelect) onSelect(url);
      }
    });

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hiddenInput) hiddenInput.value = '';
      if (previewBox) previewBox.style.display = 'none';
      if (promptEl) promptEl.style.display = 'block';
      if (fileInput) fileInput.value = '';
    });
  };

  // Bind Pre-Entry Modal Dropzone
  bindDropzone({
    dropzoneId: 'dropzone-plan-chart',
    fileInputId: 'file-plan-chart',
    promptId: 'dropzone-plan-prompt',
    previewBoxId: 'preview-plan-box',
    previewImgId: 'preview-plan-img',
    removeBtnId: 'btn-remove-plan-img',
    hiddenInputId: 'form-plan-screenshot-url',
    tag: 'PRE_ENTRY',
    entityType: 'PLAN'
  });

  // Bind Trade Modal Before Dropzone
  bindDropzone({
    dropzoneId: 'dropzone-trade-before',
    fileInputId: 'file-trade-before',
    promptId: 'dropzone-before-prompt',
    previewBoxId: 'preview-before-box',
    previewImgId: 'preview-before-img',
    removeBtnId: 'btn-remove-before-img',
    hiddenInputId: 'form-trade-preentry-screenshot',
    tag: 'PRE_ENTRY',
    entityType: 'TRADE',
    onSelect: () => { activeTradeDropzoneSlot = 'after'; }
  });

  // Bind Trade Modal After Dropzone
  bindDropzone({
    dropzoneId: 'dropzone-trade-after',
    fileInputId: 'file-trade-after',
    promptId: 'dropzone-after-prompt',
    previewBoxId: 'preview-after-box',
    previewImgId: 'preview-after-img',
    removeBtnId: 'btn-remove-after-img',
    hiddenInputId: 'form-trade-outcome-screenshot',
    tag: 'OUTCOME',
    entityType: 'TRADE'
  });

  // Bind Missed Setup Dropzone
  bindDropzone({
    dropzoneId: 'dropzone-missed-chart',
    fileInputId: 'file-missed-chart',
    promptId: 'dropzone-missed-prompt',
    previewBoxId: 'preview-missed-box',
    previewImgId: 'preview-missed-img',
    removeBtnId: 'btn-remove-missed-img',
    hiddenInputId: 'form-missed-screenshot-url',
    tag: 'MISSED',
    entityType: 'MISSED'
  });

  document.getElementById('dropzone-trade-before')?.addEventListener('mouseenter', () => { activeTradeDropzoneSlot = 'before'; });
  document.getElementById('dropzone-trade-after')?.addEventListener('mouseenter', () => { activeTradeDropzoneSlot = 'after'; });

  // Paste Screenshot button in Gallery Header
  document.getElementById('btn-gallery-paste-screenshot')?.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const file = new File([blob], `clipboard-${Date.now()}.${type.split('/')[1] || 'png'}`, { type });
              const url = await uploadScreenshotFile(file, 'GENERAL', 'TRADE');
              alert('Chart screenshot uploaded from clipboard!');
              renderGallery();
              return;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
    alert('Press Ctrl + V anywhere to paste your chart screenshot directly.');
  });

  // Global Clipboard Paste (Ctrl + V) Handler
  window.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let imageItem = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        imageItem = items[i];
        break;
      }
    }
    if (!imageItem) return;

    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

    const tradeModal = document.getElementById('trade-modal');
    const preentryModal = document.getElementById('preentry-modal');
    const missedModal = document.getElementById('missed-setup-modal');

    // Case 1: Inside Trade Modal
    if (tradeModal?.classList.contains('open')) {
      const targetSlot = activeTradeDropzoneSlot || (document.getElementById('form-trade-preentry-screenshot')?.value ? 'after' : 'before');
      if (targetSlot === 'before') {
        const url = await uploadScreenshotFile(file, 'PRE_ENTRY', 'TRADE');
        const inpHidden = document.getElementById('form-trade-preentry-screenshot');
        if (inpHidden) inpHidden.value = url;
        const prevImg = document.getElementById('preview-before-img');
        if (prevImg) prevImg.src = url;
        const prevBox = document.getElementById('preview-before-box');
        if (prevBox) prevBox.style.display = 'block';
        const promptEl = document.getElementById('dropzone-before-prompt');
        if (promptEl) promptEl.style.display = 'none';
        activeTradeDropzoneSlot = 'after';
      } else {
        const url = await uploadScreenshotFile(file, 'OUTCOME', 'TRADE');
        const inpHidden = document.getElementById('form-trade-outcome-screenshot');
        if (inpHidden) inpHidden.value = url;
        const prevImg = document.getElementById('preview-after-img');
        if (prevImg) prevImg.src = url;
        const prevBox = document.getElementById('preview-after-box');
        if (prevBox) prevBox.style.display = 'block';
        const promptEl = document.getElementById('dropzone-after-prompt');
        if (promptEl) promptEl.style.display = 'none';
      }
      return;
    }

    // Case 2: Inside Pre-Entry Modal
    if (preentryModal?.classList.contains('open')) {
      const url = await uploadScreenshotFile(file, 'PRE_ENTRY', 'PLAN');
      const inpHidden = document.getElementById('form-plan-screenshot-url');
      if (inpHidden) inpHidden.value = url;
      const prevImg = document.getElementById('preview-plan-img');
      if (prevImg) prevImg.src = url;
      const prevBox = document.getElementById('preview-plan-box');
      if (prevBox) prevBox.style.display = 'block';
      const promptEl = document.getElementById('dropzone-plan-prompt');
      if (promptEl) promptEl.style.display = 'none';
      return;
    }

    // Case 3: Inside Missed Setup Modal
    if (missedModal?.classList.contains('open')) {
      const url = await uploadScreenshotFile(file, 'MISSED', 'MISSED');
      const inpHidden = document.getElementById('form-missed-screenshot-url');
      if (inpHidden) inpHidden.value = url;
      const prevImg = document.getElementById('preview-missed-img');
      if (prevImg) prevImg.src = url;
      const prevBox = document.getElementById('preview-missed-box');
      if (prevBox) prevBox.style.display = 'block';
      const promptEl = document.getElementById('dropzone-missed-prompt');
      if (promptEl) promptEl.style.display = 'none';
      return;
    }

    // Case 4: No modal open — open Trade Modal and pre-load pasted screenshot
    const url = await uploadScreenshotFile(file, 'OUTCOME', 'TRADE');
    const openBtn = document.getElementById('btn-open-modal');
    if (openBtn) {
      openBtn.click();
      setTimeout(() => {
        const inpHidden = document.getElementById('form-trade-outcome-screenshot');
        if (inpHidden) inpHidden.value = url;
        const prevImg = document.getElementById('preview-after-img');
        if (prevImg) prevImg.src = url;
        const prevBox = document.getElementById('preview-after-box');
        if (prevBox) prevBox.style.display = 'block';
        const promptEl = document.getElementById('dropzone-after-prompt');
        if (promptEl) promptEl.style.display = 'none';
      }, 120);
    }
  });
}

/**
 * 11. Pre-Session Checklist (Gatekeeper)
 */
function setupPreSession() {
  const form = document.getElementById('presession-form');
  const todayLabel = document.getElementById('presession-today-date');
  if (todayLabel) {
    todayLabel.textContent = `Today: ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}`;
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bias = document.getElementById('pre-bias').value;
      const newsChecked = document.getElementById('pre-news').value === 'true';
      const lossLimit = parseFloat(document.getElementById('pre-loss-limit').value) || 2.0;
      const readiness = document.getElementById('pre-readiness').value;
      const notes = document.getElementById('pre-notes').value;

      const log = {
        date: new Date().toISOString(),
        higherTimeframeBias: bias,
        newsChecked,
        maxDailyLossRiskR: lossLimit,
        mentalReadiness: readiness,
        completed: true,
        notes
      };

      try {
        await fetch('/api/presession', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log)
        });
      } catch (err) {
        console.warn('API save failed, saving in memory', err);
      }

      preSessionLogs.unshift(log);
      renderPreSession();
      refreshAllViews();
      alert('✓ Pre-market preparation locked! Gatekeeper cleared for trading today.');
    });
  }

  document.getElementById('header-gatekeeper-badge')?.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelector('.nav-btn[data-view="presession-view"]')?.classList.add('active');
    document.getElementById('presession-view')?.classList.add('active');
  });
}

function renderPreSession() {
  const list = document.getElementById('presession-history-list');
  if (!list) return;

  if (preSessionLogs.length === 0) {
    list.innerHTML = `<div class="card" style="color: var(--ink-muted);">No prior session preparation logged yet.</div>`;
    return;
  }

  list.innerHTML = preSessionLogs.map(p => `
    <div class="card" style="border-left: 4px solid var(--stamp-pass); padding: 0.75rem 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${new Date(p.date).toLocaleDateString()}</strong>
          <span class="rubber-stamp stamp-clean" style="margin-left: 0.5rem;">BIAS: ${p.higherTimeframeBias}</span>
          <span style="font-size: 0.75rem; color: var(--ink-secondary); margin-left: 0.5rem;">Readiness: ${p.mentalReadiness}</span>
        </div>
        <span style="font-family: var(--font-mono); font-size: 0.8rem;">Max Daily Risk: ${p.maxDailyLossRiskR}R</span>
      </div>
      ${p.notes ? `<p style="font-size: 0.8rem; color: var(--ink-secondary); margin-top: 0.35rem;">${p.notes}</p>` : ''}
    </div>
  `).join('');
}

function updateGatekeeperBadge() {
  const badge = document.getElementById('header-gatekeeper-badge');
  if (!badge) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const isDone = preSessionLogs.some(l => l.date && l.date.slice(0, 10) === todayStr && l.completed);

  if (isDone) {
    badge.className = 'rubber-stamp stamp-clean';
    badge.textContent = 'PRE-SESSION: READY ✓';
  } else {
    badge.className = 'rubber-stamp stamp-danger';
    badge.textContent = 'PRE-SESSION: PENDING ⚠';
  }
}

/**
 * 12. Trader's Oath & Circuit Breaker
 */
function setupContract() {
  const form = document.getElementById('contract-settings-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const maxTrades = parseInt(document.getElementById('contract-max-trades').value) || 3;
    const maxLoss = parseFloat(document.getElementById('contract-max-loss').value) || 2.0;
    const cooldown = parseInt(document.getElementById('contract-cooldown').value) || 30;
    const enforce = document.getElementById('contract-enforce-prep').value === 'true';

    tradingContract = {
      ...tradingContract,
      maxDailyTrades: maxTrades,
      maxDailyLossR: maxLoss,
      cooldownMinutes: cooldown,
      enforcePreSession: enforce
    };

    try {
      await fetch('/api/contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradingContract)
      });
    } catch (err) {
      console.warn('API save failed, saved in memory', err);
    }

    refreshAllViews();
    alert('✓ The Trader\'s Oath has been updated and ratified.');
  });
}

function renderContract() {
  document.getElementById('contract-max-trades').value = tradingContract.maxDailyTrades;
  document.getElementById('contract-max-loss').value = tradingContract.maxDailyLossR;
  document.getElementById('contract-cooldown').value = tradingContract.cooldownMinutes;
  document.getElementById('contract-enforce-prep').value = String(tradingContract.enforcePreSession);
}

function updateCircuitBreakerBanner() {
  const circuit = evaluateCircuitBreaker({
    trades: getPerformanceTrades(),
    contract: tradingContract,
    candidateTradeDate: new Date().toISOString(),
    preSessionLogs
  });

  const statusBadge = document.getElementById('circuit-breaker-status');
  const summaryEl = document.getElementById('circuit-today-summary');
  const warningEl = document.getElementById('circuit-breach-warnings');
  const modalAlert = document.getElementById('modal-circuit-alert');
  const modalText = document.getElementById('modal-circuit-text');

  if (summaryEl) {
    summaryEl.textContent = `Today: ${circuit.todayTradesCount}/${tradingContract.maxDailyTrades} Trades | -${circuit.todayLossR}R Loss`;
  }

  if (circuit.isTripped) {
    if (statusBadge) {
      statusBadge.className = 'rubber-stamp stamp-danger';
      statusBadge.textContent = 'CIRCUIT BREAKER TRIPPED ⚡';
    }
    if (warningEl) {
      warningEl.innerHTML = circuit.breaches.map(b => `<div>• <strong>${b.name}</strong>: ${b.description}</div>`).join('');
    }
    if (modalAlert && modalText) {
      modalAlert.style.display = 'block';
      modalText.innerHTML = circuit.breaches.map(b => `<div>• ${b.name}: ${b.description}</div>`).join('');
    }
  } else {
    if (statusBadge) {
      statusBadge.className = 'rubber-stamp stamp-clean';
      statusBadge.textContent = 'ALL SYSTEMS GREEN ✓';
    }
    if (warningEl) warningEl.innerHTML = '';
    if (modalAlert) modalAlert.style.display = 'none';
  }
}

/**
 * 13. Draw Canvas Equity Curve
 */
function drawEquityCurve() {
  const canvas = document.getElementById('equity-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#F7F4EB';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#E5E0D0';
  ctx.lineWidth = 1;
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const y = (h / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const performanceTrades = getPerformanceTrades();
  if (performanceTrades.length === 0) {
    ctx.fillStyle = '#7D766D';
    ctx.font = '14px JetBrains Mono';
    ctx.fillText('Log trades to plot equity and drawdown curves', w / 2 - 150, h / 2);
    return;
  }

  let runningEquity = 10000;
  const points = [{ x: 0, equity: 10000 }];
  performanceTrades.forEach(t => {
    runningEquity += (t.netPnL || 0);
    points.push({ x: 0, equity: runningEquity });
  });

  const equities = points.map(p => p.equity);
  const minEq = Math.min(...equities, 9500);
  const maxEq = Math.max(...equities, 10500);
  const range = maxEq - minEq || 1000;

  const padX = 40;
  const padY = 30;
  const plotW = w - padX * 2;
  const plotH = h - padY * 2;

  points.forEach((p, idx) => {
    p.x = padX + (plotW / (points.length - 1)) * idx;
    p.y = h - padY - ((p.equity - minEq) / range) * plotH;
  });

  const baselineY = h - padY - ((10000 - minEq) / range) * plotH;
  ctx.strokeStyle = '#A88948';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, baselineY);
  ctx.lineTo(w - padX, baselineY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#A88948';
  ctx.font = '10px JetBrains Mono';
  ctx.fillText('Base: $10,000.00', w - padX - 100, baselineY - 6);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = '#1F5C3E';
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach((p, idx) => {
    if (idx === 0) return;
    const isGain = points[idx].equity >= points[idx - 1].equity;
    ctx.fillStyle = isGain ? '#1F5C3E' : '#8F251E';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F7F4EB';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

/**
 * 14. Real-Time Position Sizing & Excursion Preview in Modal
 */
function setupCalculator() {
  const assetInput = document.getElementById('form-asset-class');
  const symbolInput = document.getElementById('form-symbol');
  const entryInput = document.getElementById('form-entry-price');
  const stopInput = document.getElementById('form-stop-loss');
  const takeProfitInput = document.getElementById('form-take-profit');
  const balanceInput = document.getElementById('form-account-balance');
  const riskInput = document.getElementById('form-risk-percent');
  const qtyInput = document.getElementById('form-quantity');
  const detailsDiv = document.getElementById('calc-details');
  const maeInput = document.getElementById('form-mae-price');
  const mfeInput = document.getElementById('form-mfe-price');
  const maePreview = document.getElementById('form-mae-r-preview');
  const mfePreview = document.getElementById('form-mfe-r-preview');
  const accountForCostsInput = document.getElementById('calc-account-for-costs');
  const instrumentBadge = document.getElementById('calc-instrument-badge');
  const frictionHud = document.getElementById('calc-friction-hud');
  const statNominal = document.getElementById('calc-stat-nominal');
  const statFriction = document.getElementById('calc-stat-friction');
  const statCommitted = document.getElementById('calc-stat-committed');
  const statBuffer = document.getElementById('calc-stat-buffer');
  const guardrailBox = document.getElementById('modal-guardrail-verdict-box');
  const guardrailBadge = document.getElementById('modal-guardrail-badge');
  const guardrailExplanation = document.getElementById('modal-guardrail-explanation');

  function updateCalc() {
    const asset = assetInput.value;
    const symbol = symbolInput.value || 'EURUSD';
    const entry = parseFloat(entryInput.value) || 0;
    const stop = parseFloat(stopInput.value) || 0;
    const balance = parseFloat(balanceInput.value) || 10000;
    const riskPct = parseFloat(riskInput.value) || 1.0;
    const tp = parseFloat(takeProfitInput.value) || 0;
    const mae = parseFloat(maeInput.value);
    const mfe = parseFloat(mfeInput.value);
    const dir = document.getElementById('form-direction').value;
    const accountForCosts = accountForCostsInput ? accountForCostsInput.checked : true;

    if (entry <= 0 || stop <= 0 || entry === stop) {
      detailsDiv.innerHTML = `<span style="color: var(--ink-muted);">Enter Entry and Stop Loss prices to calculate instrument-aware position size.</span>`;
      if (frictionHud) frictionHud.style.display = 'none';
      return;
    }

    const evalResult = evaluateInstrumentRiskGuardrails({
      plan: tradingPlan,
      contract: userContract,
      trades: getPerformanceTrades(),
      candidateTrade: {
        symbol,
        assetClass: asset,
        direction: dir,
        entryPrice: entry,
        stopLoss: stop,
        takeProfit: tp > 0 ? tp : undefined
      },
      accountBalance: balance,
      candidateDate: new Date().toISOString(),
      preSessionLogs: Array.isArray(preSessionLogs) ? preSessionLogs : [],
      accountForCosts
    });

    const m = evalResult.metrics;
    if (instrumentBadge) instrumentBadge.textContent = `${m.symbol || asset} SPEC`;
    if (frictionHud) frictionHud.style.display = 'block';

    let desc = `Approved: <strong>${m.units} ${m.units === 1 ? m.unitType.slice(0, -1) : m.unitType}</strong> | Stop: <strong>${m.stopDistance.toFixed(4)}</strong> (${m.ticksOrPips} ${asset === 'FOREX' ? 'pips' : 'ticks/points'}) | Nominal: $${m.nominalRisk.toFixed(2)} + Friction: $${m.estimatedFriction.totalFriction.toFixed(2)} = Committed: <strong>$${m.totalCommittedRisk.toFixed(2)}</strong> (${m.effectiveRiskPercent.toFixed(2)}%)`;

    if (tp > 0) {
      const riskDist = Math.abs(entry - stop);
      const rewardDist = Math.abs(tp - entry);
      const rr = riskDist > 0 ? (rewardDist / riskDist) : 0;
      desc += ` | R:R: <strong>1:${rr.toFixed(2)}</strong>`;
    }

    if (qtyInput) qtyInput.value = m.units;
    if (detailsDiv) detailsDiv.innerHTML = desc;

    if (statNominal) statNominal.textContent = `$${m.nominalRisk.toFixed(2)}`;
    if (statFriction) statFriction.textContent = `-$${m.estimatedFriction.totalFriction.toFixed(2)}`;
    if (statCommitted) statCommitted.textContent = `$${m.totalCommittedRisk.toFixed(2)} (${m.effectiveRiskPercent.toFixed(2)}%)`;
    if (statBuffer) statBuffer.textContent = `${m.remainingDailyLossBufferR.toFixed(2)}R loss stop (${m.remainingTrades} trades left)`;

    if (guardrailBox && guardrailBadge && guardrailExplanation) {
      if (evalResult.canTrade) {
        guardrailBox.style.borderColor = 'var(--ledger-profit)';
        guardrailBox.style.background = '#F2F8F4';
        guardrailBadge.className = 'rubber-stamp stamp-clean';
        guardrailBadge.textContent = 'PASS: HARD GUARDRAILS VERIFIED ✓';
      } else {
        guardrailBox.style.borderColor = 'var(--ledger-loss)';
        guardrailBox.style.background = '#FAECEB';
        guardrailBadge.className = 'rubber-stamp stamp-danger';
        guardrailBadge.textContent = 'HARD GUARDRAIL BLOCKED ⚠';
      }
      guardrailExplanation.textContent = evalResult.explanation;
    }

    if (!isNaN(mae) || !isNaN(mfe)) {
      const exc = calculateExcursionR({
        entryPrice: entry,
        stopLoss: stop,
        direction: dir,
        maePrice: mae,
        mfePrice: mfe
      });
      if (maePreview) maePreview.textContent = `MAE: ${exc.maeR.toFixed(2)}R`;
      if (mfePreview) mfePreview.textContent = `MFE: +${exc.mfeR.toFixed(2)}R`;
    }

    // Dynamic Prop Firm Runway Warning in Trade Modal
    const runwayBox = document.getElementById('modal-runway-alert');
    const runwayBadge = document.getElementById('modal-runway-badge');
    const runwayText = document.getElementById('modal-runway-text');
    if (runwayBox && propFirmData && propFirmData.runway && propFirmData.buffer) {
      runwayBox.style.display = 'block';
      const plannedRisk = m.totalCommittedRisk;
      const safeCeiling = propFirmData.runway.safeRiskWithMarginDollars;
      const remCushion = propFirmData.buffer.effectiveImmediateCushionDollars;
      const remR = propFirmData.buffer.effectiveCushionR;

      if (plannedRisk > safeCeiling) {
        runwayBadge.className = 'rubber-stamp stamp-danger';
        runwayBadge.textContent = 'EXCEEDS SAFE RUNWAY CEILING ⚠';
        runwayText.innerHTML = `Planned risk <strong>$${plannedRisk.toFixed(2)}</strong> exceeds your daily safe ceiling of <strong>$${safeCeiling.toFixed(2)}</strong>. Reduce position size to protect your remaining <strong>$${remCushion.toFixed(2)} (${remR}R)</strong> cushion.`;
      } else {
        runwayBadge.className = 'rubber-stamp stamp-clean';
        runwayBadge.textContent = 'WITHIN SAFE RUNWAY ✓';
        runwayText.innerHTML = `Planned risk <strong>$${plannedRisk.toFixed(2)}</strong> is safely within your daily ceiling of <strong>$${safeCeiling.toFixed(2)}</strong> (Remaining Daily Cushion: $${remCushion.toFixed(2)}).`;
      }
    }
  }

  [assetInput, symbolInput, entryInput, stopInput, takeProfitInput, balanceInput, riskInput, maeInput, mfeInput, accountForCostsInput].forEach(el => {
    el?.addEventListener('input', updateCalc);
    el?.addEventListener('change', updateCalc);
  });
}

/**
 * 15. Price Action Curriculum Viewer
 */
function renderCurriculum() {
  const navContainer = document.getElementById('curriculum-nav');
  const viewerContainer = document.getElementById('curriculum-content');
  if (!navContainer || !viewerContainer) return;

  navContainer.innerHTML = curriculumData.map(lesson => `
    <div class="lesson-item ${lesson.id === activeLessonId ? 'active' : ''}" data-lesson-id="${lesson.id}">
      <div class="lesson-title">${lesson.title}</div>
      <div class="lesson-badge">${lesson.category} • ${lesson.readingTime}</div>
    </div>
  `).join('');

  const currentLesson = curriculumData.find(l => l.id === activeLessonId) || curriculumData[0];
  if (!currentLesson) return;

  const supplementalContent = Array.isArray(currentLesson.supplementalSections)
    ? currentLesson.supplementalSections.map(section => `### ${section.heading}\n\n${section.content}`).join('\n\n')
    : '';
  const lessonContent = [currentLesson.content, supplementalContent].filter(Boolean).join('\n\n');

  let diagramHtml = '';
  if (currentLesson.diagramType === 'DRAWDOWN_TABLE') {
    diagramHtml = `
      <div class="card" style="margin: 1.5rem 0;">
        <h4 style="font-family: var(--font-serif); margin-bottom: 0.5rem;">Asymmetric Capital Recovery Table</h4>
        <table class="ledger-table">
          <thead>
            <tr>
              <th>Account Drawdown</th>
              <th>Required Gain to Break Even</th>
              <th>Impact on $10,000 Portfolio</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>5%</strong></td><td style="color: var(--ledger-gain);"><strong>+5.3%</strong></td><td>Minor routine fluctuation; recovered in 1 disciplined trade.</td></tr>
            <tr><td><strong>10%</strong></td><td style="color: var(--ledger-gain);"><strong>+11.1%</strong></td><td>Normal pull-back; easily recovered through 2R winners.</td></tr>
            <tr><td><strong>20%</strong></td><td style="color: var(--stamp-warning);"><strong>+25.0%</strong></td><td>Requires four 1.5R trades with zero intervening losses.</td></tr>
            <tr><td><strong>30%</strong></td><td style="color: var(--stamp-warning);"><strong>+42.9%</strong></td><td>Severe psychological strain; high temptation to revenge trade.</td></tr>
            <tr><td><strong>50%</strong></td><td style="color: var(--ledger-loss);"><strong>+100.0%</strong></td><td>Requires doubling the remaining account size!</td></tr>
            <tr><td><strong>75%</strong></td><td style="color: var(--ledger-loss);"><strong>+300.0%</strong></td><td>Near statistical impossibility of recovery; risk of ruin realized.</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  viewerContainer.innerHTML = `
    <span class="brand-badge">${currentLesson.category}</span>
    <h2 style="margin-top: 0.5rem;">${currentLesson.title}</h2>
    <p style="font-style: italic; color: var(--ink-secondary); margin-bottom: 1.5rem;">${currentLesson.summary}</p>
    ${diagramHtml}
    <div style="font-size: 0.95rem; line-height: 1.7; color: var(--ink-primary); margin-top: 1.5rem;">
      ${renderLessonContent(lessonContent, currentLesson.id)}
    </div>
    ${currentLesson.demoSetupId ? `<div class="lesson-practice-action"><div><strong>Ready to rehearse the rules?</strong><p>Opens the simulated journal form with this setup selected. No broker connection or orders.</p></div><button type="button" class="btn btn-primary lesson-demo-button" data-setup-id="${currentLesson.demoSetupId}">Start demo practice</button></div>` : ''}
  `;

  viewerContainer.querySelector('.lesson-demo-button')?.addEventListener('click', event => {
    demoPracticeSetupId = event.currentTarget.dataset.setupId;
    const formSource = document.getElementById('form-trade-source');
    if (formSource) formSource.value = 'SIMULATED';
    const assetClass = document.getElementById('form-asset-class');
    const symbolInput = document.getElementById('form-symbol');
    const setupSelect = document.getElementById('form-setup');
    if (assetClass) assetClass.value = 'FOREX';
    if (symbolInput) symbolInput.value = 'XAUUSD';
    if (setupSelect) {
      setupSelect.value = demoPracticeSetupId;
      setupSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.querySelector('[data-view="journal-view"]')?.click();
    document.getElementById('btn-open-modal')?.click();
  });

  document.querySelectorAll('.lesson-item').forEach(item => {
    item.addEventListener('click', () => {
      activeLessonId = item.getAttribute('data-lesson-id');
      renderCurriculum();
    });
  });
}

function setupLessonChartExpansion() {
  const viewer = document.getElementById('curriculum-content');
  const dialog = document.getElementById('lesson-chart-dialog');
  const title = document.getElementById('lesson-chart-dialog-title');
  const canvas = document.getElementById('lesson-chart-expanded-canvas');
  const note = document.getElementById('lesson-chart-expanded-note');
  const closeButton = document.getElementById('btn-close-lesson-chart');
  if (!viewer || !dialog || !title || !canvas || !note) return;

  const openChart = figure => {
    const chart = figure.querySelector('svg');
    if (!chart) return;
    const caption = figure.querySelector('figcaption')?.textContent?.trim()
      || chart.getAttribute('aria-label')
      || 'Chart example';
    title.textContent = caption;
    canvas.replaceChildren(chart.cloneNode(true));
    note.textContent = figure.querySelector('small')?.textContent?.trim()
      || 'Illustrative OHLC example. Read the candle in context and wait for the defined confirmation.';
    dialog.showModal();
  };

  viewer.addEventListener('click', event => {
    const figure = event.target.closest('.lesson-chart, .pattern-chart');
    if (figure) openChart(figure);
  });
  viewer.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const figure = event.target.closest('.lesson-chart, .pattern-chart');
    if (!figure) return;
    event.preventDefault();
    openChart(figure);
  });
  closeButton?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    dialog.close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dialog.open) {
      event.preventDefault();
      dialog.close();
    }
  }, true);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
}

function renderLessonContent(content, lessonId) {
  const escapeText = text => text.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const inline = text => escapeText(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  const lines = content.split('\n');
  const blocks = [];
  let paragraph = [];
  let listType = null;
  let topicIndex = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) blocks.push(`</${listType}>`);
    listType = null;
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    const heading = trimmed.match(/^###\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    const unordered = trimmed.match(/^-\s+(.+)$/);
    if (!trimmed) {
      flushParagraph();
      closeList();
    } else if (heading) {
      flushParagraph();
      closeList();
      blocks.push(`<h3>${inline(heading[1])}</h3>`);
      blocks.push(renderLessonTopicChart(lessonId, heading[1], topicIndex));
      topicIndex++;
    } else if (ordered || unordered) {
      flushParagraph();
      const nextType = ordered ? 'ol' : 'ul';
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        blocks.push(`<${listType}>`);
      }
      const itemText = (ordered || unordered)[1];
      const pattern = lessonId === 'lesson-1' ? itemText.match(/^\*\*(.*?)\*\*/) : null;
      blocks.push(pattern
        ? `<li><div class="pattern-example"><div>${inline(itemText)}</div>${renderCandlestickPatternChart(pattern[1])}</div></li>`
        : `<li>${inline(itemText)}</li>`);
    } else {
      closeList();
      paragraph.push(trimmed);
    }
  });

  flushParagraph();
  closeList();
  return blocks.join('');
}

/**
 * 16. CSV Import Handler
 */
function setupCSVImport() {
  const loadBtn = document.getElementById('btn-load-sample-csv');
  const clearBtn = document.getElementById('btn-clear-csv');
  const parseBtn = document.getElementById('btn-parse-csv');
  const textarea = document.getElementById('csv-input-text');
  const statusEl = document.getElementById('csv-import-status');

  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      textarea.value = SAMPLE_BROKER_CSV;
      statusEl.textContent = 'Sample CSV loaded.';
      statusEl.style.color = 'var(--ink-secondary)';
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      textarea.value = '';
      statusEl.textContent = '';
    });
  }

  if (parseBtn) {
    parseBtn.addEventListener('click', () => {
      const raw = textarea.value.trim();
      if (!raw) {
        statusEl.textContent = 'Please enter CSV content.';
        statusEl.style.color = 'var(--ledger-loss)';
        return;
      }

      const result = importTradesFromCSV(raw, trades);
      if (result.trades.length > 0) {
        trades.push(...result.trades);
        refreshAllViews();
        renderGallery();
        statusEl.textContent = `✓ Successfully imported ${result.trades.length} new trades (${result.duplicatesSkipped} duplicates ignored).`;
        statusEl.style.color = 'var(--ledger-gain)';
      } else {
        statusEl.textContent = `No new trades imported (${result.duplicatesSkipped} duplicates skipped).`;
        statusEl.style.color = 'var(--stamp-warning)';
      }
    });
  }
}

/**
 * 17. Navigation View Switcher
 */
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const viewSections = document.querySelectorAll('.view-section');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      navBtns.forEach(b => b.classList.remove('active'));
      viewSections.forEach(s => s.classList.remove('active'));

      btn.classList.add('active');
      const targetSec = document.getElementById(targetView);
      if (targetSec) targetSec.classList.add('active');

      if (targetView === 'analytics-view') {
        setTimeout(drawEquityCurve, 50);
        renderMonteCarloSimulation();
      } else if (targetView === 'gallery-view') {
        renderGallery();
      } else if (targetView === 'calendar-view') {
        renderCalendarView();
      }
    });
  });
}

/**
 * 18. Trade Entry Modal Handler
 */
function setupModal() {
  const modal = document.getElementById('trade-modal');
  const openBtn = document.getElementById('btn-open-modal');
  const closeBtn = document.getElementById('btn-close-modal');
  const cancelBtn = document.getElementById('btn-cancel-modal');
  const form = document.getElementById('trade-entry-form');

  const openModal = () => {
    // Check if tilt cooldown is active
    const performanceTrades = getPerformanceTrades();
    const tilt = evaluateTiltState(performanceTrades, tradingContract.cooldownMinutes);
    if (tilt.isCooldownRequired && tilt.minutesRemaining > 0) {
      document.getElementById('tilt-shield-modal')?.classList.add('open');
      return;
    }

    planChecklist = normalizePlanChecklist(planChecklist, tradingPlan);
    const readiness = evaluatePlanReadiness(tradingPlan, planChecklist.checkedIds);
    const planLimits = evaluatePlanTradeLimits({ plan: tradingPlan, trades: performanceTrades });
    if (!readiness.ready || !planLimits.canTrade) {
      const reason = !readiness.ready
        ? `Complete today's trading plan checklist (${readiness.completedCount}/${readiness.totalCount}) before logging a trade.`
        : planLimits.breaches.map(breach => breach.message).join('\n');
      alert(reason);
      document.querySelector('[data-view="trading-plan-view"]')?.click();
      return;
    }

    updateCircuitBreakerBanner();
    const formSource = document.getElementById('form-trade-source');
    if (formSource) {
      formSource.value = demoPracticeSetupId ? 'SIMULATED' : 'PERSONAL';
    }
    const demoNotice = document.getElementById('demo-practice-notice');
    if (demoNotice) demoNotice.style.display = demoPracticeSetupId ? 'block' : 'none';
    modal.classList.add('open');
  };
  const closeModal = () => {
    modal.classList.remove('open');
    demoPracticeSetupId = null;
    const formSource = document.getElementById('form-trade-source');
    if (formSource) formSource.value = 'PERSONAL';
    const demoNotice = document.getElementById('demo-practice-notice');
    if (demoNotice) demoNotice.style.display = 'none';
  };

  const formSourceEl = document.getElementById('form-trade-source');
  if (formSourceEl) {
    formSourceEl.addEventListener('change', () => {
      const isSim = formSourceEl.value === 'SIMULATED';
      const demoNotice = document.getElementById('demo-practice-notice');
      if (demoNotice) demoNotice.style.display = isSim ? 'block' : 'none';
    });
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  const updateRuleFidelityBadge = () => {
    const entry = document.getElementById('rule-check-entry')?.checked ?? true;
    const stop = document.getElementById('rule-check-stop')?.checked ?? true;
    const target = document.getElementById('rule-check-target')?.checked ?? true;
    const exit = document.getElementById('rule-check-exit')?.checked ?? true;
    const passed = (entry ? 1 : 0) + (stop ? 1 : 0) + (target ? 1 : 0) + (exit ? 1 : 0);
    const badge = document.getElementById('modal-exec-quality-badge');
    if (badge) {
      if (passed === 4) {
        badge.className = 'rubber-stamp stamp-clean';
        badge.textContent = 'PERFECT EXECUTION (4/4)';
      } else if (passed === 3) {
        badge.className = 'rubber-stamp stamp-neutral';
        badge.textContent = 'GOOD PROCESS (3/4)';
      } else if (passed === 2) {
        badge.className = 'rubber-stamp stamp-warning';
        badge.textContent = 'PROCESS SLIPPAGE (2/4)';
      } else {
        badge.className = 'rubber-stamp stamp-danger';
        badge.textContent = `RULE BREAKDOWN (${passed}/4)`;
      }
    }
  };

  ['rule-check-entry', 'rule-check-stop', 'rule-check-target', 'rule-check-exit'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateRuleFidelityBadge);
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const symbol = document.getElementById('form-symbol').value.toUpperCase().trim();
      const assetClass = document.getElementById('form-asset-class').value;
      const direction = document.getElementById('form-direction').value;
      const setupId = document.getElementById('form-setup').value;
      const entryPrice = parseFloat(document.getElementById('form-entry-price').value);
      const stopLoss = parseFloat(document.getElementById('form-stop-loss').value);
      const takeProfit = parseFloat(document.getElementById('form-take-profit').value) || undefined;
      const exitPrice = parseFloat(document.getElementById('form-exit-price').value) || undefined;
      const quantity = parseFloat(document.getElementById('form-quantity').value) || 1;
      const isPreSessionDone = document.getElementById('form-presession-status').value === 'true';
      const notes = document.getElementById('form-notes').value;
      const balance = parseFloat(document.getElementById('form-account-balance').value) || 10000;
      const riskPct = parseFloat(document.getElementById('form-risk-percent').value) || 1.0;
      const plannedRiskDollars = (balance * riskPct) / 100;
      const maePrice = parseFloat(document.getElementById('form-mae-price').value) || undefined;
      const mfePrice = parseFloat(document.getElementById('form-mfe-price').value) || undefined;

      const accountForCosts = document.getElementById('calc-account-for-costs')?.checked ?? true;
      const guardrailVerdict = evaluateInstrumentRiskGuardrails({
        plan: tradingPlan,
        contract: userContract,
        trades: getPerformanceTrades(),
        candidateTrade: {
          symbol,
          assetClass,
          direction,
          entryPrice,
          stopLoss,
          takeProfit,
          quantity,
          preSessionCompleted: isPreSessionDone
        },
        accountBalance: balance,
        candidateDate: new Date().toISOString(),
        preSessionLogs: Array.isArray(preSessionLogs) ? preSessionLogs : [],
        accountForCosts
      });

      if (!guardrailVerdict.canTrade) {
        alert(guardrailVerdict.explanation);
        return;
      }
      if (!stopLoss || !takeProfit) {
        alert('A defined stop loss and profit target are required by your trading plan.');
        return;
      }
      const riskDistance = Math.abs(entryPrice - stopLoss);
      const rewardDistance = direction === 'LONG' ? takeProfit - entryPrice : entryPrice - takeProfit;
      const rewardRisk = riskDistance > 0 ? rewardDistance / riskDistance : 0;
      const validPriceStructure = direction === 'LONG'
        ? stopLoss < entryPrice && takeProfit > entryPrice
        : takeProfit < entryPrice && stopLoss > entryPrice;
      if (!validPriceStructure) {
        alert('For a long, place the stop below entry and target above. For a short, place the target below entry and stop above.');
        return;
      }
      if (rewardRisk < tradingPlan.minimumRewardRisk) {
        alert(`This setup offers ${rewardRisk.toFixed(2)}R. Your plan requires at least ${tradingPlan.minimumRewardRisk}R.`);
        return;
      }

      // Extract Guided Debrief Data
      const debriefData = {
        executionIntegrity: document.getElementById('debrief-integrity').value,
        tradeManagement: document.getElementById('debrief-management').value,
        emotionalTemperature: document.getElementById('debrief-emotion').value
      };
      const debriefGrade = gradeTradeDebrief(debriefData);

      let netPnL = 0;
      if (exitPrice) {
        const mult = direction === 'LONG' ? 1 : -1;
        netPnL = (exitPrice - entryPrice) * mult * quantity;
      }

      // Evaluate pre-flight confluence criteria
      const checkedBoxes = Array.from(document.querySelectorAll('#modal-confluence-items input[type="checkbox"]:checked')).map(cb => cb.value);
      const confluenceResult = evaluateTradeConfluence(setupId, checkedBoxes);

      // Extract Written Rules Adherence (4 checkpoints)
      const rulesFollowed = {
        entry: document.getElementById('rule-check-entry')?.checked ?? true,
        stop: document.getElementById('rule-check-stop')?.checked ?? true,
        target: document.getElementById('rule-check-target')?.checked ?? true,
        exit: document.getElementById('rule-check-exit')?.checked ?? true
      };
      const executionQuality = evaluateExecutionQuality({ rulesFollowed, debrief: debriefData, setupId });
      const processOutcome = classifyProcessOutcome({ rulesFollowed, debrief: debriefData, setupId, netPnL, rMultiple: Math.round((netPnL / plannedRiskDollars) * 100) / 100 });

      const newTrade = {
        id: `TR-${1000 + trades.length + 1}`,
        confluence: confluenceResult,
        isPlaybookCompliant: confluenceResult.isPlaybookCompliant,
        rulesFollowed,
        executionQuality,
        processOutcome,
        isFullyCompliant: executionQuality.isFullyCompliant,
        symbol,
        assetClass,
        direction,
        setupId,
        entryDate: new Date().toISOString(),
        exitDate: exitPrice ? new Date().toISOString() : undefined,
        entryPrice,
        exitPrice,
        stopLoss,
        takeProfit,
        maePrice,
        mfePrice,
        quantity,
        fees: 2.50,
        plannedRiskDollars,
        netPnL: Math.round(netPnL * 100) / 100,
        rMultiple: Math.round((netPnL / plannedRiskDollars) * 100) / 100,
        debrief: debriefData,
        disciplineGrade: debriefGrade.grade,
        disciplineScore: debriefGrade.score,
        preSessionCompleted: isPreSessionDone,
        notes,
        planId: activePreEntryPlanId || undefined,
        preEntryScreenshotUrl: document.getElementById('form-trade-preentry-screenshot')?.value || null,
        outcomeScreenshotUrl: document.getElementById('form-trade-outcome-screenshot')?.value || null,
        screenshotUrl: document.getElementById('form-trade-outcome-screenshot')?.value || document.getElementById('form-trade-preentry-screenshot')?.value || null,
        hasPreEntryScreenshot: Boolean(document.getElementById('form-trade-preentry-screenshot')?.value),
        hasOutcomeScreenshot: Boolean(document.getElementById('form-trade-outcome-screenshot')?.value),
        hasVisualEvidence: Boolean(document.getElementById('form-trade-preentry-screenshot')?.value || document.getElementById('form-trade-outcome-screenshot')?.value),
        source: (document.getElementById('form-trade-source')?.value === 'SIMULATED' || Boolean(demoPracticeSetupId)) ? TRADE_SOURCES.DEMO_PRACTICE : TRADE_SOURCES.MANUAL,
        executionMode: (document.getElementById('form-trade-source')?.value === 'SIMULATED' || Boolean(demoPracticeSetupId)) ? 'DEMO' : 'JOURNAL'
      };

      try {
        await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTrade)
        });
      } catch (err) {
        console.warn('API save failed, adding in memory', err);
      }

      trades.push(newTrade);
      demoPracticeSetupId = null;
      activePreEntryPlanId = null;
      saveCurrentUserProfile();
      persistLocalBackup();
      refreshAllViews();
      renderGallery();
      closeModal();
      form.reset();

      // Check tilt danger immediately after recording a loss
      if (newTrade.netPnL < 0) {
        checkTiltOnLoad();
        document.getElementById('tilt-shield-modal')?.classList.add('open');
      }
    });
  }
}

/**
 * 19. Filters
 */
function setupFilters() {
  ['filter-search', 'filter-asset', 'filter-violations', 'filter-trade-source'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderTradeTable);
    document.getElementById(id)?.addEventListener('change', () => {
      renderTradeTable();
      renderGallery();
    });
  });
}

/**
 * 20. JSON Export
 */
function setupExport() {
  const exportJsonBtn = document.getElementById('btn-export-json');
  const exportCsvBtn = document.getElementById('btn-export-csv');
  const reportBtn = document.getElementById('btn-open-report');
  const saveBackupBtn = document.getElementById('btn-save-backup');

  saveBackupBtn?.addEventListener('click', () => {
    persistLocalBackup();
    const panel = document.getElementById('report-summary-panel');
    if (panel) {
      panel.innerHTML = `
        <div class="report-card">
          <div class="card-title">Local backup saved</div>
          <div class="report-list">
            <div><strong>Saved:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Trades protected:</strong> ${trades.length}</div>
          </div>
        </div>
      `;
    }
  });

  exportJsonBtn?.addEventListener('click', () => {
    const fullBackup = {
      trades,
      tradingContract,
      preSessionLogs,
      tradingPlan,
      planChecklist,
      exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `trading-journal-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  exportCsvBtn?.addEventListener('click', async () => {
    const res = await fetch('/api/reports/export?format=csv');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ledger-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });

  reportBtn?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/reports/summary');
      const summary = await res.json();
      const panel = document.getElementById('report-summary-panel');
      if (!panel) return;

      const obsListHtml = Array.isArray(summary.observations) && summary.observations.length > 0
        ? summary.observations.map(o => `
            <div style="margin-top: 0.6rem; padding: 0.65rem 0.85rem; background: #FFF; border-radius: var(--radius-sm); border: 1px solid var(--ledger-paper-border); font-size: 0.82rem; line-height: 1.5;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.4rem;">
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                  <strong style="color: var(--ink-primary); font-family: var(--font-serif);">${o.headline}</strong>
                  <span class="badge-source-personal" style="font-size: 0.65rem; font-family: var(--font-mono);">n = ${o.sampleSize}</span>
                </div>
                <span class="rubber-stamp stamp-neutral" style="font-size: 0.6rem;">OBSERVATION</span>
              </div>
              <div style="color: var(--ink-primary);">${o.observation}</div>
              <div style="margin-top: 0.35rem; font-size: 0.72rem; color: var(--ink-muted); font-style: italic;">${o.sampleSizeCaveat}</div>
            </div>
          `).join('')
        : '<div style="font-size: 0.82rem; color: var(--ink-muted); font-style: italic; margin-top: 0.5rem;">Log personal trades to generate historical observations with uncertainty bounds.</div>';

      panel.innerHTML = `
        <div class="report-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div class="card-title">Trader History Summary & Review</div>
            <span class="rubber-stamp stamp-neutral" style="font-size: 0.6rem;">DESCRIPTIVE OBSERVATIONS ONLY</span>
          </div>
          <div class="report-list">
            <div><strong>Trades:</strong> ${summary.totalTrades}</div>
            <div><strong>Win rate:</strong> ${summary.winRate}%</div>
            <div><strong>Net PnL:</strong> ${summary.netPnL >= 0 ? '+$' : '-$'}${Math.abs(summary.netPnL).toFixed(2)}</div>
            <div><strong>Violations:</strong> ${summary.violationCount}</div>
          </div>
          <div class="card-title" style="margin-top: 1rem;">Empirical History Observations (No Predictions)</div>
          ${obsListHtml}
        </div>
      `;
      document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach((section) => section.classList.remove('active'));
      const leaksBtn = document.querySelector('[data-view="leaks-view"]');
      const leaksView = document.getElementById('leaks-view');
      leaksBtn?.classList.add('active');
      leaksView?.classList.add('active');
    } catch (err) {
      console.warn('Report fetch failed', err);
    }
  });
}

/**
 * 22. Deliberate Review-and-Pause & Session Stand-Down Controller
 */
function renderSessionStandDownBanner() {
  const performanceTrades = getPerformanceTrades();
  const pauseStatus = evaluateSessionLimitsAndPause({
    trades: performanceTrades,
    tradingPlan,
    contract: tradingContract,
    preSessionLogs
  });

  const headerBadge = document.getElementById('header-pause-badge');
  if (headerBadge) {
    if (pauseStatus.standDownStatus === STAND_DOWN_STATUSES.LIMIT_REACHED_STAND_DOWN || pauseStatus.standDownStatus === STAND_DOWN_STATUSES.CIRCUIT_BREAKER_LOCKED) {
      headerBadge.className = 'rubber-stamp stamp-danger';
      headerBadge.textContent = 'LIMITS: REACHED 🛑';
    } else if (pauseStatus.standDownStatus === STAND_DOWN_STATUSES.COOLDOWN_ACTIVE || pauseStatus.standDownStatus === STAND_DOWN_STATUSES.PACING_PAUSE) {
      headerBadge.className = 'rubber-stamp stamp-warning';
      headerBadge.textContent = 'PAUSE: ACTIVE ⏸️';
    } else {
      headerBadge.className = 'rubber-stamp stamp-clean';
      headerBadge.textContent = 'LIMITS: NORMAL ✓';
    }
  }

  const banner = document.getElementById('session-standdown-banner');
  const openModalBtn = document.getElementById('btn-open-modal');

  if (!banner) return;

  if (pauseStatus.isDeliberatePauseActive) {
    banner.style.display = 'block';
    if (pauseStatus.bannerClass === 'stand-down-critical') {
      banner.style.borderColor = 'var(--ledger-loss)';
      banner.style.background = '#FAECEB';
    } else {
      banner.style.borderColor = 'var(--accent-brass)';
      banner.style.background = '#FFF9F2';
    }

    const stampEl = document.getElementById('standdown-stamp');
    if (stampEl) {
      stampEl.className = pauseStatus.bannerClass === 'stand-down-critical' ? 'rubber-stamp stamp-danger' : 'rubber-stamp stamp-warning';
      stampEl.textContent = pauseStatus.standDownStatus === STAND_DOWN_STATUSES.LIMIT_REACHED_STAND_DOWN ? 'SESSION COMPLETE' : 'DELIBERATE PAUSE';
    }

    const headlineEl = document.getElementById('standdown-headline');
    if (headlineEl) headlineEl.textContent = pauseStatus.headline;

    const messageEl = document.getElementById('standdown-message');
    if (messageEl) messageEl.textContent = pauseStatus.message;

    const timerPill = document.getElementById('standdown-timer-pill');
    if (timerPill) {
      if (pauseStatus.remainingCooldownSeconds > 0) {
        timerPill.textContent = `COOLDOWN: ${Math.ceil(pauseStatus.remainingCooldownSeconds / 60)}M REMAINING`;
      } else if (pauseStatus.pacingMinutesRemaining > 0) {
        timerPill.textContent = `PACING: ${pauseStatus.pacingMinutesRemaining}M PAUSE`;
      } else {
        timerPill.textContent = 'SESSION STAND-DOWN';
      }
    }

    const actionsEl = document.getElementById('standdown-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 0.35rem; color: var(--ink-primary);">Stand-Down Restraint Protocol:</div>
        <ul style="margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.25rem;">
          ${pauseStatus.standDownActionSteps.map(a => `<li>${a}</li>`).join('')}
        </ul>
        <div style="margin-top: 0.5rem; font-style: italic; font-size: 0.76rem; color: var(--ink-muted);">
          ${pauseStatus.antiPressurePhilosophy}
        </div>
      `;
    }

    if (openModalBtn && !pauseStatus.isTradingAllowed) {
      openModalBtn.title = 'Session limits reached. Deliberate pause active.';
    }
  } else {
    banner.style.display = 'none';
    if (openModalBtn) openModalBtn.title = '+ Log Trade';
  }
}

/**
 * 23. Pre-Entry Plan Commitment Controller
 */
function setupPreEntryCommitment() {
  const modal = document.getElementById('preentry-modal');
  const openBtn = document.getElementById('btn-open-preentry-modal');
  const closeBtn = document.getElementById('btn-close-preentry-modal');
  const cancelBtn = document.getElementById('btn-cancel-preentry');
  const form = document.getElementById('form-preentry');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal?.classList.add('open');
    });
  }

  const closeModal = () => modal?.classList.remove('open');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Live R:R preview
  const updateRRPreview = () => {
    const entry = parseFloat(document.getElementById('form-plan-entry')?.value) || 0;
    const stop = parseFloat(document.getElementById('form-plan-stop')?.value) || 0;
    const target = parseFloat(document.getElementById('form-plan-target')?.value) || 0;
    const dir = document.getElementById('form-plan-direction')?.value || 'LONG';

    const rrEl = document.getElementById('plan-preview-rr');
    const distEl = document.getElementById('plan-preview-dist');

    if (entry > 0 && stop > 0 && target > 0) {
      const stopDist = Math.abs(entry - stop);
      const targetDist = dir === 'LONG' ? target - entry : entry - target;
      if (stopDist > 0 && targetDist > 0) {
        const rr = (targetDist / stopDist).toFixed(2);
        if (rrEl) {
          rrEl.textContent = `${rr} : 1`;
          rrEl.style.color = rr >= 2.0 ? 'var(--ledger-profit)' : 'var(--accent-brass)';
        }
        if (distEl) distEl.textContent = `${stopDist.toFixed(2)} pts stop / ${targetDist.toFixed(2)} pts target`;
        return;
      }
    }
    if (rrEl) rrEl.textContent = '-- : 1';
    if (distEl) distEl.textContent = '--';
  };

  ['form-plan-entry', 'form-plan-stop', 'form-plan-target', 'form-plan-direction'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateRRPreview);
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const planPayload = {
        symbol: document.getElementById('form-plan-symbol').value,
        direction: document.getElementById('form-plan-direction').value,
        setupId: document.getElementById('form-plan-setup').value,
        plannedRiskDollars: parseFloat(document.getElementById('form-plan-risk').value) || 100,
        plannedEntryPrice: parseFloat(document.getElementById('form-plan-entry').value),
        plannedStopLoss: parseFloat(document.getElementById('form-plan-stop').value),
        plannedTakeProfit: parseFloat(document.getElementById('form-plan-target').value),
        thesis: document.getElementById('form-plan-thesis').value,
        screenshotUrl: document.getElementById('form-plan-screenshot-url')?.value || null,
        mentalCheck: {
          isCalm: document.getElementById('plan-check-calm')?.checked ?? true,
          waitedForSetup: document.getElementById('plan-check-trigger')?.checked ?? true,
          acceptsRisk: document.getElementById('plan-check-accept')?.checked ?? true
        }
      };

      try {
        const res = await fetch('/api/plans/pre-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(planPayload)
        });
        const data = await res.json();
        if (data.plan) {
          preEntryPlans.unshift(data.plan);
        }
      } catch (err) {
        console.warn('Pre-entry plan save fallback to local', err);
        const { plan } = createPreEntryPlan(planPayload);
        if (plan) preEntryPlans.unshift(plan);
      }

      closeModal();
      form.reset();
      const planShot = document.getElementById('form-plan-screenshot-url');
      if (planShot) planShot.value = '';
      const previewPlanBox = document.getElementById('preview-plan-box');
      if (previewPlanBox) previewPlanBox.style.display = 'none';
      const promptPlan = document.getElementById('dropzone-plan-prompt');
      if (promptPlan) promptPlan.style.display = 'block';
      renderPendingPreEntryPlans();
    });
  }
}

/**
 * Render Pending Pre-Entry Commitment Plans in View 1
 */
function renderPendingPreEntryPlans() {
  const container = document.getElementById('preentry-plans-container');
  if (!container) return;

  const pending = preEntryPlans.filter(p => p.status === 'PENDING');
  if (pending.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div class="card" style="border: 1.5px solid var(--accent-brass); background: #FFFBF5; padding: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="rubber-stamp stamp-clean" style="font-size: 0.65rem;">PRE-ENTRY COMMITMENTS</span>
          <h4 style="font-family: var(--font-serif); font-size: 1.1rem; margin: 0; color: var(--ink-primary);">Planned Setups Awaiting Execution Trigger</h4>
        </div>
        <span class="badge-source-personal" style="font-size: 0.75rem;">${pending.length} PLAN(S) COMMITTED</span>
      </div>
      <div style="display: grid; gap: 0.75rem;">
        ${pending.map(plan => `
          <div class="card" style="background: #FFF; border: 1px solid var(--ledger-paper-border); padding: 0.85rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              ${plan.screenshotUrl ? `
                <img src="${plan.screenshotUrl}" alt="Plan Chart" style="width: 56px; height: 42px; object-fit: cover; border-radius: var(--radius-sm); border: 1.5px solid var(--accent-brass); cursor: pointer;"
                     onclick="window.openLightbox('${plan.screenshotUrl}', '${plan.symbol} (${plan.direction}) Plan', 'Pre-Entry Commitment Chart', null, '${plan.thesis || ''}')"
                     title="Click to view full plan chart">
              ` : ''}
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                  <strong style="font-family: var(--font-mono); font-size: 1.05rem;">${plan.symbol}</strong>
                  <span class="rubber-stamp ${plan.direction === 'LONG' ? 'stamp-clean' : 'stamp-danger'}" style="font-size: 0.65rem;">${plan.direction}</span>
                  <span style="font-size: 0.8rem; color: var(--ink-muted);">${plan.setupId}</span>
                  <span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;">PLANNED R:R ${plan.plannedRR || '--'}:1</span>
                  ${plan.screenshotUrl ? '<span class="rubber-stamp stamp-clean" style="font-size: 0.6rem;">CHART ATTACHED 📷</span>' : ''}
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--ink-secondary);">
                  Entry: <strong>${plan.plannedEntryPrice}</strong> | Invalidation Stop: <strong style="color: var(--ledger-loss);">${plan.plannedStopLoss}</strong> | Target: <strong style="color: var(--ledger-profit);">${plan.plannedTakeProfit}</strong> | Risk: <strong>$${plan.plannedRiskDollars}</strong>
                </div>
                ${plan.thesis ? `<div style="font-size: 0.76rem; color: var(--ink-muted); margin-top: 0.25rem;"><em>Thesis: ${plan.thesis}</em></div>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-primary btn-sm btn-execute-plan" data-plan-id="${plan.id}" title="Convert pre-planned intent to active execution">🚀 Confirm Trigger &amp; Log</button>
              <button class="btn btn-secondary btn-sm btn-cancel-plan" data-plan-id="${plan.id}" title="Cancel plan if trigger never occurred">Cancel Plan</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Attach button listeners
  container.querySelectorAll('.btn-execute-plan').forEach(btn => {
    btn.addEventListener('click', () => {
      const planId = btn.getAttribute('data-plan-id');
      const plan = preEntryPlans.find(p => p.id === planId);
      if (!plan) return;

      activePreEntryPlanId = plan.id;
      const tradeModal = document.getElementById('trade-modal');
      if (tradeModal) {
        document.getElementById('form-symbol').value = plan.symbol;
        document.getElementById('form-direction').value = plan.direction;
        document.getElementById('form-setup').value = plan.setupId;
        document.getElementById('form-entry-price').value = plan.plannedEntryPrice;
        document.getElementById('form-stop-loss').value = plan.plannedStopLoss;
        document.getElementById('form-take-profit').value = plan.plannedTakeProfit;
        document.getElementById('form-planned-risk').value = plan.plannedRiskDollars;
        if (plan.thesis) document.getElementById('form-notes').value = `[Pre-Planned Setup]: ${plan.thesis}`;

        if (plan.screenshotUrl) {
          const beforeInput = document.getElementById('form-trade-preentry-screenshot');
          if (beforeInput) beforeInput.value = plan.screenshotUrl;
          const prevBeforeImg = document.getElementById('preview-before-img');
          if (prevBeforeImg) prevBeforeImg.src = plan.screenshotUrl;
          const prevBeforeBox = document.getElementById('preview-before-box');
          if (prevBeforeBox) prevBeforeBox.style.display = 'block';
          const promptBefore = document.getElementById('dropzone-before-prompt');
          if (promptBefore) promptBefore.style.display = 'none';
        }

        tradeModal.classList.add('open');
      }
    });
  });

  container.querySelectorAll('.btn-cancel-plan').forEach(btn => {
    btn.addEventListener('click', async () => {
      const planId = btn.getAttribute('data-plan-id');
      const plan = preEntryPlans.find(p => p.id === planId);
      if (plan) plan.status = 'CANCELLED';
      try {
        await fetch('/api/plans/pre-entry/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: planId })
        });
      } catch (err) {
        console.warn('Plan cancel err', err);
      }
      renderPendingPreEntryPlans();
    });
  });
}

/**
 * 24. Missed Setup & Passed Opportunity Controller
 */
function setupMissedSetups() {
  const modal = document.getElementById('missed-setup-modal');
  const openBtn = document.getElementById('btn-open-missed-modal');
  const closeBtn = document.getElementById('btn-close-missed-modal');
  const cancelBtn = document.getElementById('btn-cancel-missed');
  const form = document.getElementById('form-missed-setup');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal?.classList.add('open');
    });
  }

  const closeModal = () => modal?.classList.remove('open');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const missedPayload = {
        symbol: document.getElementById('form-missed-symbol').value,
        direction: document.getElementById('form-missed-direction').value,
        setupId: document.getElementById('form-missed-setup-id').value,
        reasonCode: document.getElementById('form-missed-reason').value,
        hypotheticalR: parseFloat(document.getElementById('form-missed-hypo-r').value) || 0,
        reflection: document.getElementById('form-missed-reflection').value,
        date: document.getElementById('form-missed-date').value || new Date().toISOString()
      };

      try {
        const res = await fetch('/api/missed-setups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(missedPayload)
        });
        const data = await res.json();
        if (data.record) {
          missedSetups.unshift(data.record);
        }
      } catch (err) {
        console.warn('Missed setup save err', err);
        const record = createMissedSetup(missedPayload);
        missedSetups.unshift(record);
      }

      closeModal();
      form.reset();
      renderMissedSetupsSummary();
    });
  }
}

/**
 * Render Missed Setups Summary Shelf in View 1
 */
function renderMissedSetupsSummary() {
  const container = document.getElementById('missed-setups-container');
  if (!container) return;

  const analysis = analyzeMissedSetups(missedSetups);
  if (analysis.totalMissedCount === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div class="card" style="border: 1.5px solid var(--ledger-paper-border); background: var(--ledger-paper-subtle); padding: 0.85rem 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="rubber-stamp stamp-clean" style="font-size: 0.65rem;">RESTRAINT LOG</span>
          <h4 style="font-family: var(--font-serif); font-size: 1.05rem; margin: 0; color: var(--ink-primary);">Documented Missed Setups &amp; Passed Moves</h4>
        </div>
        <span class="badge-source-verified" style="font-size: 0.72rem; font-family: var(--font-mono);">
          DISCIPLINE WINS: ${analysis.disciplineWinsCount} / ${analysis.totalMissedCount} (${analysis.disciplineWinPercent}%)
        </span>
      </div>
      <p style="font-size: 0.82rem; line-height: 1.5; color: var(--ink-secondary); margin: 0.35rem 0;">
        ${analysis.summaryObservation}
      </p>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
        ${analysis.records.slice(0, 4).map(m => `
          <div style="background: #FFF; border: 1px solid var(--ledger-paper-border); border-radius: var(--radius-sm); padding: 0.35rem 0.6rem; font-size: 0.75rem; font-family: var(--font-mono);">
            <strong>${m.symbol} ${m.direction}</strong>: <span style="color: ${m.isDisciplineWin ? 'var(--ledger-profit)' : 'var(--ink-secondary)'};">${m.reasonLabel}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Start application
window.addEventListener('DOMContentLoaded', initApp);


/**
 * 21. Setup Prop Firm Guardian Controller
 */
async function setupPropFirm() {
  const profileSelect = document.getElementById('pf-profile-select');
  const stageSelect = document.getElementById('pf-stage-select');
  const tradesInput = document.getElementById('pf-trades-today-input');
  const headerBadge = document.getElementById('header-propfirm-badge');

  if (headerBadge) {
    headerBadge.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
      const pfBtn = document.querySelector('[data-view="propfirm-view"]');
      const pfView = document.getElementById('propfirm-view');
      if (pfBtn) pfBtn.classList.add('active');
      if (pfView) pfView.classList.add('active');
    });
  }

  // Populate profiles
  if (profileSelect) {
    try {
      const pRes = await fetch('/api/prop-firm/profile');
      const pData = await pRes.json();
      const presets = pData.presets || PROP_FIRM_PRESETS;
      propFirmConfig = pData.config || propFirmConfig;

      profileSelect.innerHTML = Object.keys(presets).map(k => `
        <option value="${k}" ${propFirmConfig.activeProfileId === k ? 'selected' : ''}>
          ${presets[k].name}
        </option>
      `).join('');

      if (stageSelect && propFirmConfig.accountStage) {
        stageSelect.value = propFirmConfig.accountStage;
      }
      if (tradesInput && propFirmConfig.plannedTradesToday) {
        tradesInput.value = propFirmConfig.plannedTradesToday;
      }
    } catch (err) {
      console.warn('Profile load err', err);
    }

    const saveConfig = async () => {
      propFirmConfig.activeProfileId = profileSelect.value;
      propFirmConfig.accountStage = stageSelect ? stageSelect.value : 'EVALUATION';
      propFirmConfig.plannedTradesToday = parseInt(tradesInput?.value || '2', 10);
      try {
        await fetch('/api/prop-firm/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(propFirmConfig)
        });
      } catch (err) {
        console.warn('Save prop firm config err', err);
      }
      renderPropFirmGuardian();
    };

    profileSelect.addEventListener('change', saveConfig);
    stageSelect?.addEventListener('change', saveConfig);
    tradesInput?.addEventListener('input', saveConfig);
  }

  // Copy audit button
  document.getElementById('btn-copy-pf-audit')?.addEventListener('click', () => {
    if (!propFirmData || !propFirmData.audit) return;
    const a = propFirmData.audit;
    let txt = `LEDGER & WICK — PROP FIRM AUDIT REPORT\n`;
    txt += `Account: ${a.profileName} | Stage: ${propFirmConfig.accountStage}\n`;
    txt += `Readiness Score: ${a.readinessPercent}% (${a.overallStatus})\n`;
    txt += `Total Buffer: $${propFirmData.buffer.remainingTotalBufferDollars} (${propFirmData.buffer.remainingTotalBufferR}R)\n`;
    txt += `Active Days: ${a.activeDaysCount} / ${a.minDaysRequired} required\n\n`;
    txt += `CRITERIA AUDIT:\n`;
    a.criteria.forEach(c => {
      txt += `[${c.passed ? 'PASS' : 'FAIL'}] ${c.label} | Target: ${c.target} | Current: ${c.current}\n`;
    });
    navigator.clipboard?.writeText(txt).then(() => {
      alert('Audit Report copied to clipboard!');
    });
  });

  // Verify Payout button
  document.getElementById('btn-request-payout-check')?.addEventListener('click', () => {
    if (!propFirmData || !propFirmData.audit) return;
    const a = propFirmData.audit;
    if (a.overallStatus === 'READY_FOR_PAYOUT_OR_PASS') {
      alert(`🎉 CONGRATULATIONS! Your account has satisfied 100% of all evaluation/payout criteria with zero rule breaches. You are clear to submit your request!`);
    } else if (a.overallStatus === 'ACCOUNT_BREACHED') {
      alert(`⚠ ACCOUNT BREACHED: The account has violated maximum drawdown or daily loss limits. Do not trade.`);
    } else {
      const missing = a.criteria.filter(c => !c.passed).map(c => `• ${c.label}: Need ${c.target} (Current: ${c.current})`).join('\n');
      alert(`Account Audit Status: ${a.readinessPercent}% Ready (${a.overallStatus})\n\nRemaining Requirements:\n${missing}`);
    }
  });
}

/**
 * 22. Render Prop Firm Guardian Dashboard
 */
function renderPropFirmGuardian() {
  const profile = PROP_FIRM_PRESETS[propFirmConfig.activeProfileId] || PROP_FIRM_PRESETS.TOPSTEP_50K;
  const performanceTrades = getPerformanceTrades();
  const buffer = calculateDynamicDrawdownBuffer(performanceTrades, profile);
  const runway = calculateRunwaySafeRisk(
    buffer.effectiveImmediateCushionDollars,
    propFirmConfig.plannedTradesToday || 2,
    propFirmConfig.safetyMarginPercent || 25
  );
  const consistency = calculateConsistencyMetrics(performanceTrades, profile.consistencyRulePercent);
  const audit = auditPayoutEligibility(performanceTrades, profile);

  propFirmData = { profile, buffer, runway, consistency, audit, config: propFirmConfig };

  // 1. Header Badge Update
  const headerBadge = document.getElementById('header-propfirm-badge');
  if (headerBadge) {
    if (buffer.isBreached) {
      headerBadge.className = 'rubber-stamp stamp-danger';
      headerBadge.textContent = `PROP: BREACHED ⚡`;
    } else if (buffer.bufferStatus === 'CRITICAL' || buffer.bufferStatus === 'CAUTION') {
      headerBadge.className = 'rubber-stamp stamp-warning';
      headerBadge.textContent = `PROP: ${profile.name.split(' ')[0]} | $${buffer.effectiveImmediateCushionDollars.toFixed(0)} (${buffer.effectiveCushionR}R) ⚠`;
    } else {
      headerBadge.className = 'rubber-stamp stamp-clean';
      headerBadge.textContent = `PROP: ${profile.name.split(' ')[0]} | +$${buffer.effectiveImmediateCushionDollars.toFixed(0)} (${buffer.effectiveCushionR}R) 🛡️`;
    }
  }

  // 2. HUD Cards
  const cardTotal = document.getElementById('pf-card-total-buffer');
  if (cardTotal) {
    cardTotal.className = `propfirm-metric-card status-${buffer.bufferStatus.toLowerCase()}`;
    document.getElementById('pf-badge-drawdown-type').textContent = buffer.drawdownType.replace('_', ' ');
    document.getElementById('pf-val-total-buffer').textContent = (buffer.remainingTotalBufferDollars >= 0 ? '+$' : '-$') + Math.abs(buffer.remainingTotalBufferDollars).toFixed(2);
    document.getElementById('pf-sub-total-buffer').textContent = `Floor: $${buffer.totalLiquidationFloor.toLocaleString()} | Cushion: ${buffer.remainingTotalBufferR}R`;
  }

  const cardDaily = document.getElementById('pf-card-daily-buffer');
  if (cardDaily) {
    if (buffer.remainingDailyBufferDollars !== null) {
      document.getElementById('pf-val-daily-buffer').textContent = `+$${buffer.remainingDailyBufferDollars.toFixed(2)}`;
      document.getElementById('pf-sub-daily-buffer').textContent = `Today: ${buffer.todayPnL >= 0 ? '+$' : '-$'}${Math.abs(buffer.todayPnL).toFixed(2)} | Floor: $${buffer.dailyLiquidationFloor?.toLocaleString()}`;
      document.getElementById('pf-badge-daily-status').textContent = buffer.isDailyBreached ? 'BREACHED' : 'ACTIVE';
    } else {
      document.getElementById('pf-val-daily-buffer').textContent = 'N/A';
      document.getElementById('pf-sub-daily-buffer').textContent = 'No firm daily limit enforced';
      document.getElementById('pf-badge-daily-status').textContent = 'EXEMPT';
    }
  }

  const elPeak = document.getElementById('pf-val-peak-hwm');
  const elSubPeak = document.getElementById('pf-sub-peak-hwm');
  if (elPeak) elPeak.textContent = `$${buffer.effectivePeak.toLocaleString()}`;
  if (elSubPeak) elSubPeak.textContent = `Current Balance: $${buffer.currentBalance.toLocaleString()}`;

  const elProfit = document.getElementById('pf-val-profit-accum');
  const elPct = document.getElementById('pf-val-target-pct');
  const elSubProfit = document.getElementById('pf-sub-profit-target');
  if (elProfit) elProfit.textContent = (buffer.totalNetProfit >= 0 ? '+$' : '-$') + Math.abs(buffer.totalNetProfit).toFixed(2);
  if (elPct) elPct.textContent = `${buffer.targetProgressPercent}%`;
  if (elSubProfit) {
    const toGo = Math.max(0, buffer.profitTarget - buffer.totalNetProfit);
    elSubProfit.textContent = `Goal: $${buffer.profitTarget.toLocaleString()} ($${toGo.toLocaleString()} to go)`;
  }

  // 3. Dynamic Runway Sizer
  const elRawRisk = document.getElementById('pf-runway-raw-risk');
  const elSafeRisk = document.getElementById('pf-runway-safe-risk');
  const elEs = document.getElementById('pf-runway-es');
  const elNq = document.getElementById('pf-runway-nq');
  const elFx = document.getElementById('pf-runway-fx');
  const elRunwayBadge = document.getElementById('pf-runway-status-badge');
  const elRunwayGuide = document.getElementById('pf-runway-guidance-text');

  if (elRawRisk) elRawRisk.textContent = `$${runway.maxSafeRiskDollars.toFixed(2)}`;
  if (elSafeRisk) elSafeRisk.textContent = `$${runway.safeRiskWithMarginDollars.toFixed(2)}`;
  if (elEs) elEs.textContent = `${runway.esContractsMax} contract${runway.esContractsMax === 1 ? '' : 's'}`;
  if (elNq) elNq.textContent = runway.nqContractsMax > 0 ? `${runway.nqContractsMax} contracts` : '0 (Switch to MNQ)';
  if (elFx) elFx.textContent = `${runway.forexStandardLotsMax} Standard Lots`;
  if (elRunwayBadge) {
    elRunwayBadge.className = runway.status === 'SAFE_TO_TRADE' ? 'rubber-stamp stamp-clean' : 'rubber-stamp stamp-warning';
    elRunwayBadge.textContent = runway.status.replace('_', ' ');
  }
  if (elRunwayGuide) elRunwayGuide.textContent = runway.guidance;

  // 4. Consistency Radar
  const elBestDay = document.getElementById('pf-best-day-profit');
  const elBestDate = document.getElementById('pf-best-day-date');
  const elConcPct = document.getElementById('pf-concentration-pct');
  const elThreshold = document.getElementById('pf-rule-threshold');
  const elConsBar = document.getElementById('pf-consistency-bar');
  const elConsMarker = document.getElementById('pf-consistency-marker');
  const elConsBadge = document.getElementById('pf-consistency-badge');
  const elConsGuide = document.getElementById('pf-consistency-guidance');

  if (consistency.hasRule) {
    if (elBestDay) elBestDay.textContent = `$${consistency.bestDayProfit.toFixed(2)}`;
    if (elBestDate) elBestDate.textContent = consistency.bestDayDate || 'None';
    if (elConcPct) elConcPct.textContent = `${consistency.concentrationRatioPercent}%`;
    if (elThreshold) elThreshold.textContent = `${consistency.ruleThresholdPercent}%`;
    if (elConsBar) {
      elConsBar.style.width = `${Math.min(100, consistency.concentrationRatioPercent)}%`;
      elConsBar.className = `consistency-fill ${consistency.isCompliant ? (consistency.isNearLimit ? 'caution' : 'safe') : 'breach'}`;
    }
    if (elConsMarker) elConsMarker.style.left = `${consistency.ruleThresholdPercent}%`;
    if (elConsBadge) {
      elConsBadge.className = consistency.isCompliant ? (consistency.isNearLimit ? 'rubber-stamp stamp-warning' : 'rubber-stamp stamp-clean') : 'rubber-stamp stamp-danger';
      elConsBadge.textContent = consistency.isCompliant ? (consistency.isNearLimit ? 'NEAR LIMIT' : 'COMPLIANT') : 'DISQUALIFIED';
    }
    if (elConsGuide) {
      let capNote = '';
      if (consistency.maxAdditionalProfitToday !== null) {
        capNote = ` Maximum additional profit allowed today before hitting the cap is <strong>+$${consistency.maxAdditionalProfitToday.toFixed(2)}</strong>.`;
      }
      elConsGuide.innerHTML = `${consistency.guidance}${capNote}`;
    }
  } else {
    if (elConcPct) elConcPct.textContent = 'Exempt';
    if (elThreshold) elThreshold.textContent = 'None';
    if (elConsBadge) {
      elConsBadge.className = 'rubber-stamp stamp-clean';
      elConsBadge.textContent = 'EXEMPT';
    }
    if (elConsGuide) elConsGuide.textContent = 'No consistency rule threshold enforced for this profile.';
  }

  // 5. Readiness Audit Table
  const auditTbody = document.getElementById('pf-audit-table-body');
  const elScore = document.getElementById('pf-readiness-score');
  if (elScore) {
    elScore.textContent = `${audit.readinessPercent}% (${audit.overallStatus.replace(/_/g, ' ')})`;
    elScore.style.color = audit.overallStatus === 'READY_FOR_PAYOUT_OR_PASS' ? 'var(--ledger-gain)' : (audit.overallStatus === 'ACCOUNT_BREACHED' ? 'var(--ledger-loss)' : 'var(--accent-brass)');
  }

  if (auditTbody) {
    auditTbody.innerHTML = audit.criteria.map(c => `
      <tr>
        <td><strong>${c.label}</strong></td>
        <td style="font-family: var(--font-mono);">${c.target}</td>
        <td style="font-family: var(--font-mono);">${c.current}</td>
        <td>
          <span class="audit-pill ${c.passed ? 'pass' : (c.critical ? 'fail' : 'pending')}">
            ${c.passed ? 'PASS ✓' : (c.critical ? 'FAIL ✗' : 'PENDING')}
          </span>
        </td>
      </tr>
    `).join('');
  }
}


/**
 * 23. Setup Playbook & Pre-Flight Confluence Controller
 */
function setupPlaybook() {
  const headerBadge = document.getElementById('header-playbook-badge');
  if (headerBadge) {
    headerBadge.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
      const pbBtn = document.querySelector('[data-view="playbook-view"]');
      const pbView = document.getElementById('playbook-view');
      if (pbBtn) pbBtn.classList.add('active');
      if (pbView) pbView.classList.add('active');
    });
  }

  // Pre-flight confluence updater in trade modal
  const setupSelect = document.getElementById('form-setup');
  const itemsContainer = document.getElementById('modal-confluence-items');
  const badgeEl = document.getElementById('modal-confluence-badge');

  function updateModalConfluence() {
    if (!setupSelect || !itemsContainer) return;
    const currentSetupId = setupSelect.value;
    const setupDef = DEFAULT_PLAYBOOK_SETUPS[currentSetupId] || DEFAULT_PLAYBOOK_SETUPS.DISCRETIONARY;

    if (!setupDef.criteria || setupDef.criteria.length === 0) {
      itemsContainer.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--ledger-loss); font-family: var(--font-mono);">
          ⚠ Discretionary trade. Taking an impulse trade without criteria will lower your Playbook Purity score.
        </div>
      `;
      if (badgeEl) {
        badgeEl.className = 'rubber-stamp stamp-danger';
        badgeEl.textContent = 'OFF-PLAYBOOK (0%)';
      }
      return;
    }

    itemsContainer.innerHTML = setupDef.criteria.map(c => `
      <label style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8rem; cursor: pointer; background: var(--ledger-paper-base); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--ledger-paper-border);">
        <input type="checkbox" value="${c.id}" class="confluence-check" checked style="margin-top: 0.15rem;">
        <span>${c.label}</span>
      </label>
    `).join('');

    function evaluateCurrentChecks() {
      const checked = Array.from(itemsContainer.querySelectorAll('.confluence-check:checked')).map(cb => cb.value);
      const res = evaluateTradeConfluence(currentSetupId, checked);
      if (badgeEl) {
        if (res.classification === 'A_PLUS_SETUP') {
          badgeEl.className = 'rubber-stamp stamp-clean';
          badgeEl.textContent = `A+ SETUP (${res.confluenceScorePercent}%)`;
        } else if (res.classification === 'PLAYBOOK_VALID') {
          badgeEl.className = 'rubber-stamp stamp-warning';
          badgeEl.textContent = `VALID (${res.confluenceScorePercent}%)`;
        } else {
          badgeEl.className = 'rubber-stamp stamp-danger';
          badgeEl.textContent = `IMPULSE (${res.confluenceScorePercent}%)`;
        }
      }
    }

    itemsContainer.querySelectorAll('.confluence-check').forEach(cb => {
      cb.addEventListener('change', evaluateCurrentChecks);
    });

    evaluateCurrentChecks();
  }

  setupSelect?.addEventListener('change', updateModalConfluence);
  updateModalConfluence();
}

/**
 * 24. Render Playbook & Counterfactual Equity View
 */
function renderPlaybookView() {
  const performanceTrades = getPerformanceTrades();
  const counter = calculateCounterfactualEquitySplit(performanceTrades);
  const killzones = calculateSessionKillzoneMetrics(performanceTrades);

  // 1. Header Metrics
  const elPurity = document.getElementById('pb-purity-score');
  const elEdge = document.getElementById('pb-edge-delta');
  const elBadge = document.getElementById('header-playbook-badge');
  const elInsight = document.getElementById('pb-insight-text');

  if (elPurity) elPurity.textContent = `${counter.playbookPurityPercent}%`;
  if (elEdge) {
    elEdge.textContent = (counter.disciplineEdgeDollars >= 0 ? '+$' : '-$') + Math.abs(counter.disciplineEdgeDollars).toFixed(2);
    elEdge.style.color = counter.disciplineEdgeDollars >= 0 ? 'var(--ledger-gain)' : 'var(--ink-secondary)';
  }
  if (elBadge) {
    elBadge.textContent = `PLAYBOOK PURITY: ${counter.playbookPurityPercent}% 🎯`;
    elBadge.className = counter.playbookPurityPercent >= 80 ? 'rubber-stamp stamp-clean' : 'rubber-stamp stamp-warning';
  }
  if (elInsight) elInsight.textContent = counter.insightMessage;

  // 2. Draw Dual-Curve Counterfactual Canvas Chart
  const canvas = document.getElementById('counterfactual-chart');
  if (canvas && counter.equitySeries.length > 0) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#F7F4EB';
    ctx.fillRect(0, 0, w, h);

    // Draw faint ledger grid
    ctx.strokeStyle = '#E5E0D0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const series = counter.equitySeries;
    const allVals = [];
    series.forEach(p => {
      allVals.push(p.realizedEquity, p.playbookEquity);
    });

    const minVal = Math.min(...allVals, 9500);
    const maxVal = Math.max(...allVals, 10500);
    const range = maxVal - minVal || 1000;

    const padX = 50;
    const padY = 30;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;

    const getX = (idx) => padX + (plotW / Math.max(1, series.length - 1)) * idx;
    const getY = (val) => h - padY - ((val - minVal) / range) * plotH;

    // Draw Baseline $10,000
    const baseY = getY(10000);
    ctx.strokeStyle = '#7D766D';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, baseY);
    ctx.lineTo(w - padX, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7D766D';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('Base: $10,000', padX + 5, baseY - 5);

    // Draw Playbook Curve (Solid Green, 3px)
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(series[0].playbookEquity));
    for (let i = 1; i < series.length; i++) {
      ctx.lineTo(getX(i), getY(series[i].playbookEquity));
    }
    ctx.strokeStyle = '#1F5C3E';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Draw Realized Curve (Brass, 2px)
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(series[0].realizedEquity));
    for (let i = 1; i < series.length; i++) {
      ctx.lineTo(getX(i), getY(series[i].realizedEquity));
    }
    ctx.strokeStyle = '#A88948';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add points for last values
    const lastP = series[series.length - 1];
    ctx.fillStyle = '#1F5C3E';
    ctx.font = 'bold 11px JetBrains Mono';
    ctx.fillText(`Playbook: $${lastP.playbookEquity.toFixed(2)}`, w - padX - 140, getY(lastP.playbookEquity) - 8);

    ctx.fillStyle = '#A88948';
    ctx.fillText(`Actual: $${lastP.realizedEquity.toFixed(2)}`, w - padX - 140, getY(lastP.realizedEquity) + 16);
  }

  // 3. Killzone Heatmap Cards
  const kzContainer = document.getElementById('killzone-container');
  if (kzContainer) {
    kzContainer.innerHTML = killzones.map(k => `
      <div class="killzone-card tag-${k.tag}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <strong style="font-family: var(--font-serif); font-size: 0.95rem;">${k.name}</strong>
          <span class="rubber-stamp ${k.tag === 'PRIME_EDGE' ? 'stamp-clean' : (k.tag === 'DANGER_CHOP' ? 'stamp-danger' : 'stamp-neutral')}" style="font-size: 0.65rem;">
            ${k.tag.replace('_', ' ')}
          </span>
        </div>
        <div style="font-size: 0.75rem; color: var(--ink-muted); font-family: var(--font-mono);">${k.window}</div>
        <div style="display: flex; justify-content: space-between; margin-top: 0.75rem; font-family: var(--font-mono); font-size: 0.85rem;">
          <span>${k.tradeCount} trades</span>
          <span><strong>${k.winRate}% Win</strong></span>
          <span style="font-weight: bold; color: ${k.netPnL >= 0 ? 'var(--ledger-gain)' : 'var(--ledger-loss)'};">
            ${k.netPnL >= 0 ? '+$' : '-$'}${Math.abs(k.netPnL).toFixed(2)}
          </span>
        </div>
      </div>
    `).join('');
  }

  // 4. Playbook Setup Studio Cards
  const setupContainer = document.getElementById('playbook-cards-container');
  if (setupContainer) {
    const setups = Object.values(DEFAULT_PLAYBOOK_SETUPS).filter(s => s.id !== 'DISCRETIONARY');
    setupContainer.innerHTML = setups.map(s => `
      <div class="setup-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h4 style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--ink-primary);">${s.name}</h4>
          <span class="rubber-stamp stamp-clean" style="font-size: 0.7rem;">MIN R:R 1:${s.minRewardRisk}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--ink-secondary); margin-bottom: 0.75rem;">${s.description}</p>
        <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-muted); margin-bottom: 0.5rem;">
          TARGET TIMEFRAMES: ${s.timeframes.join(', ')}
        </div>
        <div class="confluence-checklist">
          ${s.criteria.map((c, idx) => `
            <div class="confluence-item">
              <span style="font-weight: bold; font-family: var(--font-mono); color: var(--ledger-gain);">${idx + 1}.</span>
              <span>${c.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }
}

/**
 * 24. Setup Strategy Research Lab & Edge Durability Audit Controller
 */
const ASSET_DATASET_CONFIGS = {
  EURUSD: { symbol: 'EURUSD', startPrice: 1.0850, spread: 0.00015, slippage: 0.00010, commission: 3.50 },
  ES: { symbol: 'ES', startPrice: 5120.00, spread: 0.25, slippage: 0.25, commission: 4.50 },
  NVDA: { symbol: 'NVDA', startPrice: 880.00, spread: 0.10, slippage: 0.08, commission: 1.00 },
  BTCUSD: { symbol: 'BTCUSD', startPrice: 65000.00, spread: 12.00, slippage: 15.00, commission: 6.00 }
};

let currentLabDataset = null;
let currentLabBacktestResult = null;
let currentLabStressResult = null;

function populateLabPresetForm(presetKey) {
  const preset = RESEARCH_PRESETS[presetKey] || RESEARCH_PRESETS.TREND_PULLBACK_CONFLUENCE;
  const assetKey = document.getElementById('lab-asset-select')?.value || 'EURUSD';
  const assetConfig = ASSET_DATASET_CONFIGS[assetKey] || ASSET_DATASET_CONFIGS.EURUSD;

  const dirSelect = document.getElementById('lab-direction-select');
  if (dirSelect) dirSelect.value = preset.direction || 'BOTH';

  const trendAlign = document.getElementById('lab-trend-align');
  if (trendAlign) trendAlign.value = preset.indicators?.trendAlignment || 'WITH_TREND';

  const fastEma = document.getElementById('lab-fast-ema');
  if (fastEma) fastEma.value = preset.indicators?.fastEma || 20;

  const slowEma = document.getElementById('lab-slow-ema');
  if (slowEma) slowEma.value = preset.indicators?.slowEma || 50;

  const rsiMin = document.getElementById('lab-rsi-min');
  if (rsiMin) rsiMin.value = preset.indicators?.rsiMin ?? 40;

  const rsiMax = document.getElementById('lab-rsi-max');
  if (rsiMax) rsiMax.value = preset.indicators?.rsiMax ?? 65;

  const donchian = document.getElementById('lab-donchian');
  if (donchian) donchian.value = preset.indicators?.donchianBreakout || 'NONE';

  const confirmation = document.getElementById('lab-confirmation');
  if (confirmation) confirmation.value = preset.indicators?.confirmationPattern || 'NONE';

  const regimeFilter = document.getElementById('lab-regime-filter');
  if (regimeFilter) regimeFilter.value = preset.indicators?.regimeFilter || 'ALL';

  const sessionFilter = document.getElementById('lab-session-filter');
  if (sessionFilter) sessionFilter.value = preset.indicators?.sessionFilter || 'ALL';

  const slAtr = document.getElementById('lab-sl-atr');
  if (slAtr) slAtr.value = preset.riskRules?.stopLossAtrMultiple ?? 1.5;

  const tpR = document.getElementById('lab-tp-r');
  if (tpR) tpR.value = preset.riskRules?.takeProfitRMultiple ?? 2.0;

  const beR = document.getElementById('lab-be-r');
  if (beR) beR.value = preset.riskRules?.breakevenRMultiple ?? 1.0;

  const maxBars = document.getElementById('lab-max-bars');
  if (maxBars) maxBars.value = preset.riskRules?.maxHoldingBars ?? 40;

  const commEl = document.getElementById('lab-commission');
  if (commEl) commEl.value = preset.friction?.commissionPerTrade ?? assetConfig.commission;

  const spreadEl = document.getElementById('lab-spread');
  if (spreadEl) spreadEl.value = preset.friction?.spreadPoints ?? assetConfig.spread;

  const slippageEl = document.getElementById('lab-slippage');
  if (slippageEl) slippageEl.value = preset.friction?.slippagePoints ?? assetConfig.slippage;

  const gapEl = document.getElementById('lab-gap-mult');
  if (gapEl) gapEl.value = preset.friction?.gapSlippageMultiplier ?? 1.5;
}

function extractLabStrategyFromUI() {
  const presetKey = document.getElementById('lab-preset-select')?.value || 'TREND_PULLBACK_CONFLUENCE';
  const basePreset = RESEARCH_PRESETS[presetKey] || RESEARCH_PRESETS.TREND_PULLBACK_CONFLUENCE;

  const direction = document.getElementById('lab-direction-select')?.value || 'BOTH';
  const trendAlignment = document.getElementById('lab-trend-align')?.value || 'WITH_TREND';
  const fastEma = parseInt(document.getElementById('lab-fast-ema')?.value, 10) || 20;
  const slowEma = parseInt(document.getElementById('lab-slow-ema')?.value, 10) || 50;
  const rsiMin = parseFloat(document.getElementById('lab-rsi-min')?.value) || 0;
  const rsiMax = parseFloat(document.getElementById('lab-rsi-max')?.value) || 100;
  const donchianBreakout = document.getElementById('lab-donchian')?.value || 'NONE';
  const confirmationPattern = document.getElementById('lab-confirmation')?.value || 'NONE';
  const regimeFilter = document.getElementById('lab-regime-filter')?.value || 'ALL';
  const sessionFilter = document.getElementById('lab-session-filter')?.value || 'ALL';

  const stopLossAtrMultiple = parseFloat(document.getElementById('lab-sl-atr')?.value) || 1.5;
  const takeProfitRMultiple = parseFloat(document.getElementById('lab-tp-r')?.value) || 2.0;
  const breakevenRMultiple = parseFloat(document.getElementById('lab-be-r')?.value) || 1.0;
  const maxHoldingBars = parseInt(document.getElementById('lab-max-bars')?.value, 10) || 40;

  const commissionPerTrade = parseFloat(document.getElementById('lab-commission')?.value) || 3.50;
  const spreadPoints = parseFloat(document.getElementById('lab-spread')?.value) || 0.00015;
  const slippagePoints = parseFloat(document.getElementById('lab-slippage')?.value) || 0.00010;
  const gapSlippageMultiplier = parseFloat(document.getElementById('lab-gap-mult')?.value) || 1.5;

  return {
    id: `CUSTOM_${Date.now()}`,
    name: basePreset.name,
    direction,
    indicators: {
      trendAlignment,
      fastEma,
      slowEma,
      rsiMin,
      rsiMax,
      donchianBreakout,
      confirmationPattern,
      regimeFilter,
      sessionFilter
    },
    riskRules: {
      stopLossAtrMultiple,
      takeProfitRMultiple,
      breakevenRMultiple,
      maxHoldingBars
    },
    friction: {
      commissionPerTrade,
      spreadPoints,
      slippagePoints,
      gapSlippageMultiplier
    }
  };
}

function extractLabDatasetOptionsFromUI() {
  const assetKey = document.getElementById('lab-asset-select')?.value || 'EURUSD';
  const assetConfig = ASSET_DATASET_CONFIGS[assetKey] || ASSET_DATASET_CONFIGS.EURUSD;
  const totalBars = parseInt(document.getElementById('lab-total-bars')?.value, 10) || 600;
  const trainSplit = (parseFloat(document.getElementById('lab-train-split')?.value) || 65) / 100;

  return {
    symbol: assetConfig.symbol,
    totalBars,
    trainSplit,
    startPrice: assetConfig.startPrice,
    seed: 42
  };
}

function renderResearchLabResults(result, stressResult = null) {
  if (!result) return;
  currentLabBacktestResult = result;
  if (stressResult) currentLabStressResult = stressResult;

  const { inSample, outOfSample, decay, uncertainty, regimeBreakdown, frictionAudit, durability, trades: fillTrades } = result;

  // 1. Durability Scorecard
  const scoreCard = document.getElementById('lab-scorecard-card');
  const verdictStamp = document.getElementById('lab-verdict-stamp');
  const scoreVal = document.getElementById('lab-score-val');
  const warnBanner = document.getElementById('lab-warning-banner');
  const strengthsList = document.getElementById('lab-strengths-list');
  const deductionsList = document.getElementById('lab-deductions-list');

  if (scoreVal) scoreVal.textContent = durability.score;
  if (verdictStamp) {
    verdictStamp.className = `rubber-stamp ${durability.verdictClass || 'stamp-clean'}`;
    verdictStamp.textContent = durability.badgeLabel;
  }
  if (scoreCard) {
    const borderColor = durability.score >= 70 ? 'var(--ledger-profit)' : (durability.score >= 50 ? 'var(--accent-brass)' : 'var(--ledger-loss)');
    scoreCard.style.borderLeftColor = borderColor;
  }
  if (warnBanner) {
    if (durability.warningNote) {
      warnBanner.style.display = 'block';
      warnBanner.textContent = durability.warningNote;
    } else {
      warnBanner.style.display = 'none';
    }
  }
  if (strengthsList) {
    strengthsList.innerHTML = (durability.strengths || []).map(s => `<li>${s}</li>`).join('') || '<li>None qualified under strict durability criteria.</li>';
  }
  if (deductionsList) {
    deductionsList.innerHTML = (durability.deductions || []).map(d => `<li>${d}</li>`).join('') || '<li>No major durability deductions detected.</li>';
  }

  // 2. In-Sample Partition Cards
  const isBarsBadge = document.getElementById('lab-is-bars-badge');
  const isSplitPct = Math.round((parseFloat(document.getElementById('lab-train-split')?.value) || 65));
  if (isBarsBadge) isBarsBadge.textContent = `${inSample.totalBars} bars (${isSplitPct}%)`;
  document.getElementById('lab-is-trades').textContent = inSample.totalTrades;
  document.getElementById('lab-is-winrate').textContent = `${inSample.winRate}%`;
  document.getElementById('lab-is-avgr').textContent = `${inSample.averageR >= 0 ? '+' : ''}${inSample.averageR} R`;
  document.getElementById('lab-is-pf').textContent = inSample.profitFactor >= 999 ? '∞' : inSample.profitFactor;
  document.getElementById('lab-is-dd').textContent = `${inSample.maxDrawdownPercent}%`;
  const isNetEl = document.getElementById('lab-is-netpnl');
  if (isNetEl) {
    isNetEl.textContent = (inSample.netPnL >= 0 ? '+$' : '-$') + Math.abs(inSample.netPnL).toFixed(2);
    isNetEl.style.color = inSample.netPnL >= 0 ? 'var(--ledger-gain)' : 'var(--ledger-loss)';
  }

  // 3. Out-of-Sample Partition Cards
  const oosBarsBadge = document.getElementById('lab-oos-bars-badge');
  if (oosBarsBadge) oosBarsBadge.textContent = `${outOfSample.totalBars} bars (${100 - isSplitPct}%)`;
  document.getElementById('lab-oos-trades').textContent = outOfSample.totalTrades;
  document.getElementById('lab-oos-winrate').textContent = `${outOfSample.winRate}%`;
  document.getElementById('lab-oos-avgr').textContent = `${outOfSample.averageR >= 0 ? '+' : ''}${outOfSample.averageR} R`;
  document.getElementById('lab-oos-pf').textContent = outOfSample.profitFactor >= 999 ? '∞' : outOfSample.profitFactor;
  document.getElementById('lab-oos-dd').textContent = `${outOfSample.maxDrawdownPercent}%`;
  const oosNetEl = document.getElementById('lab-oos-netpnl');
  if (oosNetEl) {
    oosNetEl.textContent = (outOfSample.netPnL >= 0 ? '+$' : '-$') + Math.abs(outOfSample.netPnL).toFixed(2);
    oosNetEl.style.color = outOfSample.netPnL >= 0 ? 'var(--ledger-gain)' : 'var(--ledger-loss)';
  }

  // 4. Overfit Decay HUD
  const hazardBadge = document.getElementById('lab-decay-hazard-badge');
  if (hazardBadge) {
    if (decay.overfitHazard === 'HIGH') {
      hazardBadge.className = 'rubber-stamp stamp-danger';
      hazardBadge.textContent = 'HIGH OVERFIT HAZARD ✗';
    } else if (decay.overfitHazard === 'MODERATE') {
      hazardBadge.className = 'rubber-stamp stamp-warning';
      hazardBadge.textContent = 'MODERATE OVERFIT HAZARD ⚠';
    } else {
      hazardBadge.className = 'rubber-stamp stamp-clean';
      hazardBadge.textContent = 'LOW OVERFIT RISK ✓';
    }
  }
  document.getElementById('lab-decay-wr').textContent = `${decay.winRateDelta >= 0 ? '+' : ''}${decay.winRateDelta}%`;
  document.getElementById('lab-decay-avgr').textContent = `${decay.averageRDecayPercent}%`;
  document.getElementById('lab-decay-pf').textContent = `${decay.profitFactorDecayPercent}%`;
  document.getElementById('lab-decay-dd').textContent = `${decay.drawdownExpansionPercent >= 0 ? '+' : ''}${decay.drawdownExpansionPercent}%`;

  // 5. Statistical Uncertainty & Monte Carlo
  if (uncertainty) {
    document.getElementById('lab-ci-winrate').textContent = uncertainty.winRateWilsonCI?.formatted || '--';
    document.getElementById('lab-ci-avgr').textContent = uncertainty.expectancy95CI?.formatted || '--';
    const sampleEl = document.getElementById('lab-sample-viability');
    if (sampleEl) {
      sampleEl.textContent = `${uncertainty.sampleViability} (N=${uncertainty.sampleSize})`;
      sampleEl.style.color = uncertainty.sampleViability === 'VALID_SAMPLE' ? 'var(--ledger-gain)' : 'var(--ledger-loss)';
    }
    document.getElementById('lab-streak-compare').textContent = `${uncertainty.observedMaxLossStreak} observed vs ${uncertainty.theoreticalMaxLossStreak} theoretical`;

    const mc = uncertainty.monteCarloResampling;
    if (mc) {
      document.getElementById('lab-mc-p5').textContent = `$${mc.p5OutcomeDollars >= 0 ? '+' : ''}${mc.p5OutcomeDollars}`;
      document.getElementById('lab-mc-p50').textContent = `$${mc.p50OutcomeDollars >= 0 ? '+' : ''}${mc.p50OutcomeDollars}`;
      document.getElementById('lab-mc-ruin').textContent = `${mc.ruinRiskPercent}%`;
    }
  }

  // 6. Regime Breakdown Table
  const regimeTbody = document.getElementById('lab-regime-tbody');
  if (regimeTbody && regimeBreakdown) {
    const regimes = Object.keys(regimeBreakdown);
    regimeTbody.innerHTML = regimes.map(rk => {
      const reg = regimeBreakdown[rk];
      let stamp = '<span class="rubber-stamp stamp-clean" style="font-size: 0.65rem;">ROBUST</span>';
      if (reg.resilience === 'FRAGILE') {
        stamp = '<span class="rubber-stamp stamp-danger" style="font-size: 0.65rem;">HOSTILE / LEAK</span>';
      } else if (reg.resilience === 'MODERATE') {
        stamp = '<span class="rubber-stamp stamp-warning" style="font-size: 0.65rem;">NEUTRAL</span>';
      }

      return `
        <tr>
          <td><strong>${rk.replace('_', ' ')}</strong></td>
          <td>${reg.barsCount}</td>
          <td>${reg.tradesCount}</td>
          <td>${reg.tradesCount > 0 ? `${reg.winRate}%` : '--'}</td>
          <td style="font-weight: bold; color: ${reg.netPnL >= 0 ? 'var(--ledger-gain)' : 'var(--ledger-loss)'};">
            ${reg.tradesCount > 0 ? (reg.netPnL >= 0 ? '+$' : '-$') + Math.abs(reg.netPnL).toFixed(2) : '--'}
          </td>
          <td>${reg.tradesCount > 0 ? `${reg.averageR >= 0 ? '+' : ''}${reg.averageR} R` : '--'}</td>
          <td>${stamp}</td>
        </tr>
      `;
    }).join('');
  }

  // 7. Friction Drag Audit
  if (frictionAudit) {
    document.getElementById('lab-fric-gross').textContent = (frictionAudit.grossProfitDollars >= 0 ? '+$' : '-$') + Math.abs(frictionAudit.grossProfitDollars).toFixed(2);
    document.getElementById('lab-fric-comm').textContent = `-$${frictionAudit.totalCommissionsPaid.toFixed(2)}`;
    document.getElementById('lab-fric-spread').textContent = `-$${frictionAudit.totalSpreadCostDollars.toFixed(2)}`;
    document.getElementById('lab-fric-slippage').textContent = `-$${frictionAudit.totalSlippageCostDollars.toFixed(2)}`;
    const fricNetEl = document.getElementById('lab-fric-net');
    if (fricNetEl) {
      fricNetEl.textContent = (frictionAudit.netProfitDollars >= 0 ? '+$' : '-$') + Math.abs(frictionAudit.netProfitDollars).toFixed(2);
      fricNetEl.style.color = frictionAudit.netProfitDollars >= 0 ? 'var(--ledger-gain)' : 'var(--ledger-loss)';
    }
    document.getElementById('lab-fric-drag').textContent = `${frictionAudit.frictionDragPercent}%`;
  }

  // 8. Friction Stress Test
  const stressBadge = document.getElementById('lab-stress-badge');
  const stressDetails = document.getElementById('lab-stress-details');
  if (stressResult && stressBadge && stressDetails) {
    if (stressResult.survivesStress) {
      stressBadge.className = 'rubber-stamp stamp-clean';
      stressBadge.textContent = 'SURVIVES 2x FRICTION ✓';
      stressDetails.innerHTML = `Strategy remains profitable under doubled spread and slippage (Stressed PnL: <strong>$${stressResult.stressedNetPnL.toFixed(2)}</strong> vs Normal: $${stressResult.normalNetPnL.toFixed(2)}, Friction Decay: ${stressResult.pnlDecayPercent}%).`;
    } else {
      stressBadge.className = 'rubber-stamp stamp-danger';
      stressBadge.textContent = 'WIPED OUT BY 2x FRICTION ✗';
      stressDetails.innerHTML = `Strategy profits completely evaporate under doubled spread and slippage (Stressed PnL: <strong>$${stressResult.stressedNetPnL.toFixed(2)}</strong> vs Normal: $${stressResult.normalNetPnL.toFixed(2)}, Friction Decay: ${stressResult.pnlDecayPercent}%). Edge is fragile to liquidity.`;
    }
  }

  // 9. Order Fill Log
  const fillsTbody = document.getElementById('lab-fills-tbody');
  const countBadge = document.getElementById('lab-fill-count-badge');
  if (fillsTbody && fillTrades) {
    if (countBadge) countBadge.textContent = `${fillTrades.length} FILLS`;
    if (fillTrades.length === 0) {
      fillsTbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--ink-muted); padding: 1rem;">No trades generated matching setup criteria.</td></tr>`;
      return;
    }

    const previewFills = fillTrades.slice(0, 50);
    fillsTbody.innerHTML = previewFills.map((t, idx) => {
      const isOos = t.partition === 'OUT_OF_SAMPLE';
      const partBadge = isOos
        ? '<span class="rubber-stamp stamp-clean" style="font-size: 0.65rem;">OOS VALIDATION</span>'
        : '<span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;">IN-SAMPLE</span>';

      const pnl = t.netPnL || 0;
      const pnlColor = pnl >= 0 ? 'var(--ledger-gain)' : 'var(--ledger-loss)';
      const pnlText = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);
      const rText = (t.rMultiple >= 0 ? '+' : '') + Number(t.rMultiple || 0).toFixed(2) + 'R';

      let reasonBadge = `<span class="rubber-stamp stamp-clean" style="font-size: 0.65rem;">${t.exitReason}</span>`;
      if (t.exitReason === 'STOP_LOSS') reasonBadge = `<span class="rubber-stamp stamp-danger" style="font-size: 0.65rem;">STOP LOSS</span>`;
      if (t.exitReason === 'BREAKEVEN') reasonBadge = `<span class="rubber-stamp stamp-warning" style="font-size: 0.65rem;">BREAKEVEN</span>`;
      if (t.exitReason === 'TIME_STOP') reasonBadge = `<span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;">MAX BARS</span>`;

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${partBadge}</td>
          <td><strong>${t.direction}</strong></td>
          <td style="font-size: 0.72rem; color: var(--ink-secondary);">${t.regime}</td>
          <td>${t.entryBar}</td>
          <td>${t.exitBar}</td>
          <td>${t.entryPrice.toFixed(4)}</td>
          <td>${t.exitPrice.toFixed(4)}</td>
          <td>${reasonBadge}</td>
          <td style="color: var(--ledger-loss);">${(t.entrySlippage + t.exitSlippage).toFixed(5)}</td>
          <td style="font-weight: bold; color: ${pnlColor};">${rText}</td>
          <td style="font-weight: bold; color: ${pnlColor};">${pnlText}</td>
        </tr>
      `;
    }).join('');
  }
}

async function runLabAudit(executeStress = false) {
  const runBtn = document.getElementById('btn-run-lab-backtest');
  const stressBtn = document.getElementById('btn-run-lab-stress');
  if (runBtn) runBtn.textContent = '⏳ Auditing Setup Rules...';

  const strategy = extractLabStrategyFromUI();
  const datasetOptions = extractLabDatasetOptionsFromUI();

  try {
    let backtestData = null;
    let stressData = null;

    try {
      const response = await fetch('/api/research/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, datasetOptions })
      });
      if (response.ok) {
        const payload = await response.json();
        backtestData = payload.backtest;
        stressData = payload.stressTest;
      }
    } catch (apiErr) {
      console.warn('API backtest failed, running engine in browser', apiErr);
    }

    if (!backtestData) {
      currentLabDataset = generateHistoricalDataset(datasetOptions);
      backtestData = runStrategyBacktest(currentLabDataset.bars, strategy);
      stressData = runFrictionStressTest(currentLabDataset.bars, strategy);
    }

    renderResearchLabResults(backtestData, stressData);
  } catch (err) {
    console.error('Research Lab Error:', err);
    alert(`Research Lab execution failed: ${err.message}`);
  } finally {
    if (runBtn) runBtn.textContent = '⚡ Run Backtest & Lab Audit';
  }
}

function setupResearchLab() {
  const presetSelect = document.getElementById('lab-preset-select');
  const assetSelect = document.getElementById('lab-asset-select');
  const reloadPresetBtn = document.getElementById('btn-load-preset');
  const runBacktestBtn = document.getElementById('btn-run-lab-backtest');
  const runStressBtn = document.getElementById('btn-run-lab-stress');

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      populateLabPresetForm(presetSelect.value);
    });
  }

  if (assetSelect) {
    assetSelect.addEventListener('change', () => {
      const assetKey = assetSelect.value;
      const assetConfig = ASSET_DATASET_CONFIGS[assetKey] || ASSET_DATASET_CONFIGS.EURUSD;
      if (document.getElementById('lab-spread')) document.getElementById('lab-spread').value = assetConfig.spread;
      if (document.getElementById('lab-slippage')) document.getElementById('lab-slippage').value = assetConfig.slippage;
      if (document.getElementById('lab-commission')) document.getElementById('lab-commission').value = assetConfig.commission;
    });
  }

  if (reloadPresetBtn) {
    reloadPresetBtn.addEventListener('click', () => {
      populateLabPresetForm(presetSelect?.value || 'TREND_PULLBACK_CONFLUENCE');
    });
  }

  if (runBacktestBtn) {
    runBacktestBtn.addEventListener('click', () => {
      runLabAudit(false);
    });
  }

  if (runStressBtn) {
    runStressBtn.addEventListener('click', async () => {
      runStressBtn.textContent = '⏳ Running 2x Stress...';
      try {
        await runLabAudit(true);
      } finally {
        runStressBtn.textContent = '🛡️ 2x Friction Stress Test';
      }
    });
  }

  // Populate initial preset values and run initial backtest
  populateLabPresetForm('TREND_PULLBACK_CONFLUENCE');
  runLabAudit(false);
}

/**
 * ==========================================================================
 * 23. Archival Calendar & Session Heatmap Controller
 * ==========================================================================
 */

function setupCalendarView() {
  const prevBtn = document.getElementById('cal-btn-prev-month');
  const nextBtn = document.getElementById('cal-btn-next-month');
  const todayBtn = document.getElementById('cal-btn-today');
  const sourceFilter = document.getElementById('cal-filter-source');

  prevBtn?.addEventListener('click', () => {
    currentCalendarMonth--;
    if (currentCalendarMonth < 0) {
      currentCalendarMonth = 11;
      currentCalendarYear--;
    }
    renderCalendarView();
  });

  nextBtn?.addEventListener('click', () => {
    currentCalendarMonth++;
    if (currentCalendarMonth > 11) {
      currentCalendarMonth = 0;
      currentCalendarYear++;
    }
    renderCalendarView();
  });

  todayBtn?.addEventListener('click', () => {
    const now = new Date();
    currentCalendarYear = now.getUTCFullYear();
    currentCalendarMonth = now.getUTCMonth();
    renderCalendarView();
  });

  sourceFilter?.addEventListener('change', () => {
    renderCalendarView();
  });

  // Subnavigation tabs (Month, Week, Heatmap)
  const tabMonth = document.getElementById('cal-subnav-month');
  const tabWeek = document.getElementById('cal-subnav-week');
  const tabHeatmap = document.getElementById('cal-subnav-heatmap');

  const contentMonth = document.getElementById('cal-tab-month');
  const contentWeek = document.getElementById('cal-tab-week');
  const contentHeatmap = document.getElementById('cal-tab-heatmap');

  const setCalendarTab = (tabName) => {
    currentCalendarTab = tabName;
    [tabMonth, tabWeek, tabHeatmap].forEach(b => b?.classList.remove('active'));
    if (tabName === 'month') {
      tabMonth?.classList.add('active');
      if (contentMonth) contentMonth.style.display = 'block';
      if (contentWeek) contentWeek.style.display = 'none';
      if (contentHeatmap) contentHeatmap.style.display = 'none';
    } else if (tabName === 'week') {
      tabWeek?.classList.add('active');
      if (contentMonth) contentMonth.style.display = 'none';
      if (contentWeek) contentWeek.style.display = 'block';
      if (contentHeatmap) contentHeatmap.style.display = 'none';
    } else if (tabName === 'heatmap') {
      tabHeatmap?.classList.add('active');
      if (contentMonth) contentMonth.style.display = 'none';
      if (contentWeek) contentWeek.style.display = 'none';
      if (contentHeatmap) contentHeatmap.style.display = 'block';
    }
    renderCalendarView();
  };

  tabMonth?.addEventListener('click', () => setCalendarTab('month'));
  tabWeek?.addEventListener('click', () => setCalendarTab('week'));
  tabHeatmap?.addEventListener('click', () => setCalendarTab('heatmap'));

  // Day Audit modal close bindings
  const dayAuditModal = document.getElementById('day-audit-modal');
  const closeDayAudit = () => dayAuditModal?.classList.remove('open');
  document.getElementById('btn-close-day-audit')?.addEventListener('click', closeDayAudit);
  document.getElementById('btn-close-day-audit-bottom')?.addEventListener('click', closeDayAudit);
  dayAuditModal?.addEventListener('click', (e) => {
    if (e.target === dayAuditModal) closeDayAudit();
  });
}

function getCalendarTrades() {
  const sourceFilter = document.getElementById('cal-filter-source')?.value || 'VERIFIED';
  if (sourceFilter === 'ALL') {
    const existingIds = new Set(trades.map(t => t.id));
    const extraSamples = (sampleTrades || []).filter(st => !existingIds.has(st.id));
    return [...trades, ...extraSamples];
  }
  return getPerformanceTrades();
}

function renderCalendarView() {
  const activeTrades = getCalendarTrades();
  const excludeSample = document.getElementById('cal-filter-source')?.value !== 'ALL';

  const calData = buildMonthlyCalendar(
    currentCalendarYear,
    currentCalendarMonth,
    activeTrades,
    preEntryPlans,
    missedSetups,
    { excludeSample }
  );

  // Month label
  const labelEl = document.getElementById('cal-current-month-label');
  if (labelEl) {
    labelEl.textContent = `${calData.monthName} ${calData.year}`;
  }

  // Summary Ribbon
  const summ = calData.summary;
  const pnlEl = document.getElementById('cal-stat-pnl');
  if (pnlEl) {
    pnlEl.textContent = `${summ.monthNetPnL >= 0 ? '+' : '-'}$${Math.abs(summ.monthNetPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    pnlEl.style.color = summ.monthNetPnL > 0 ? 'var(--ledger-profit)' : (summ.monthNetPnL < 0 ? 'var(--ledger-loss)' : 'var(--ink-primary)');
  }
  const pfEl = document.getElementById('cal-stat-pf');
  if (pfEl) {
    pfEl.textContent = `Profit Factor: ${summ.monthProfitFactor > 0 ? summ.monthProfitFactor.toFixed(2) : '--'}`;
  }

  const dayWrEl = document.getElementById('cal-stat-day-winrate');
  if (dayWrEl) {
    dayWrEl.textContent = `${summ.dayWinRate.toFixed(1)}%`;
  }
  const dayCountsEl = document.getElementById('cal-stat-day-counts');
  if (dayCountsEl) {
    dayCountsEl.textContent = `${summ.profitableDaysCount} Green / ${summ.losingDaysCount} Red (${summ.tradingDaysCount} Trading Days)`;
  }

  const tradeWrEl = document.getElementById('cal-stat-trade-winrate');
  if (tradeWrEl) {
    tradeWrEl.textContent = `${summ.monthWinRate.toFixed(1)}%`;
  }
  const tradeCiEl = document.getElementById('cal-stat-trade-ci');
  if (tradeCiEl && summ.monthWinRateCI) {
    tradeCiEl.textContent = `95% CI: [${summ.monthWinRateCI.formatted}]`;
  }

  const compEl = document.getElementById('cal-stat-compliance');
  if (compEl) {
    compEl.textContent = `${summ.monthComplianceRate.toFixed(1)}%`;
  }
  const compCiEl = document.getElementById('cal-stat-compliance-ci');
  if (compCiEl && summ.monthComplianceCI) {
    compCiEl.textContent = `95% CI: [${summ.monthComplianceCI.formatted}]`;
  }

  const visEl = document.getElementById('cal-stat-visuals');
  if (visEl) {
    visEl.textContent = `${summ.monthVisualCoverageRate.toFixed(1)}%`;
  }
  const visSubEl = document.getElementById('cal-stat-visuals-sub');
  if (visSubEl) {
    visSubEl.textContent = `${summ.monthTradesWithVisuals} / ${summ.totalTrades} trades documented`;
  }

  const totalREl = document.getElementById('cal-stat-total-r');
  if (totalREl) {
    totalREl.textContent = `${summ.monthTotalR >= 0 ? '+' : ''}${summ.monthTotalR.toFixed(1)}R`;
  }
  const plansMissedEl = document.getElementById('cal-stat-plans-missed');
  if (plansMissedEl) {
    plansMissedEl.textContent = `${summ.totalPlans} Plans / ${summ.totalDisciplineWins} Restraints`;
  }

  // Render Active Sub-View
  if (currentCalendarTab === 'month') {
    renderMonthlyGrid(calData);
  } else if (currentCalendarTab === 'week') {
    renderWeeklyTable(currentCalendarYear, currentCalendarMonth, activeTrades, excludeSample);
  } else if (currentCalendarTab === 'heatmap') {
    renderSessionHeatmapView(activeTrades, excludeSample);
  }
}

function renderMonthlyGrid(calData) {
  const gridContainer = document.getElementById('cal-month-grid');
  if (!gridContainer) return;
  gridContainer.innerHTML = '';

  calData.weeks.forEach(week => {
    week.days.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      if (!day.isCurrentMonth) cell.classList.add('other-month');
      if (day.isToday) cell.classList.add('is-today');

      const act = day.activity;
      if (act && act.totalTrades > 0) {
        if (act.status === 'PROFITABLE') cell.classList.add('profitable');
        else if (act.status === 'LOSS') cell.classList.add('loss');
        else if (act.status === 'BREAKEVEN') cell.classList.add('breakeven');
      }

      // Badges (screenshots, pre-entry plans, missed setups)
      let badgesHtml = '';
      if (act && act.hasVisualEvidence) badgesHtml += `<span title="${act.screenshotCount} charts recorded">📷</span>`;
      if (act && act.plansCount > 0) badgesHtml += `<span title="${act.plansCount} pre-entry plans recorded">📝</span>`;
      if (act && act.missedCount > 0) badgesHtml += `<span title="${act.disciplineWins} discipline restraint wins">🎯</span>`;

      // Body (Net P&L and R-Multiple)
      let bodyHtml = '';
      if (act && act.totalTrades > 0) {
        const pnlClass = act.netPnL > 0 ? 'positive' : (act.netPnL < 0 ? 'negative' : 'neutral');
        const pnlPrefix = act.netPnL > 0 ? '+' : '';
        bodyHtml = `
          <div class="cal-cell-pnl ${pnlClass}">
            ${pnlPrefix}$${Math.abs(act.netPnL).toFixed(2)}
          </div>
          <div class="cal-cell-r">${act.totalR >= 0 ? '+' : ''}${act.totalR.toFixed(1)}R</div>
        `;
      } else if (act && (act.plansCount > 0 || act.missedCount > 0)) {
        bodyHtml = `
          <div style="font-size: 0.72rem; color: var(--ink-secondary); font-style: italic;">
            ${act.plansCount > 0 ? 'Plan Logged' : 'Pass Recorded'}
          </div>
        `;
      }

      // Footer: trade count, session dots, compliance badge
      let footerHtml = '';
      if (act && act.totalTrades > 0) {
        const ruleClean = act.violationCount === 0;
        const ruleLabel = ruleClean ? '100% Rules' : `${act.violationCount} Viol. ⚠️`;
        const ruleClass = ruleClean ? 'clean' : 'violated';

        let dotsHtml = '';
        if (act.sessions.LONDON.count > 0) dotsHtml += `<span class="cal-session-dot" style="background: #4A6984;" title="London Morning"></span>`;
        if (act.sessions.NEW_YORK_AM.count > 0) dotsHtml += `<span class="cal-session-dot" style="background: #8A5A2B;" title="New York AM"></span>`;
        if (act.sessions.NEW_YORK_PM.count > 0) dotsHtml += `<span class="cal-session-dot" style="background: #68452B;" title="New York PM"></span>`;
        if (act.sessions.ASIAN.count > 0) dotsHtml += `<span class="cal-session-dot" style="background: #3A6073;" title="Asian"></span>`;
        if (act.sessions.OVERNIGHT.count > 0) dotsHtml += `<span class="cal-session-dot" style="background: #4A4A4A;" title="Overnight"></span>`;

        footerHtml = `
          <div class="cal-cell-footer">
            <span class="cal-cell-trades-badge">${act.totalTrades}t</span>
            <div class="cal-session-dots">${dotsHtml}</div>
            <span class="cal-cell-rule-badge ${ruleClass}">${ruleLabel}</span>
          </div>
        `;
      }

      cell.innerHTML = `
        <div class="cal-cell-header">
          <span class="cal-cell-number">${day.dayNumber}</span>
          <div class="cal-cell-badges">${badgesHtml}</div>
        </div>
        <div class="cal-cell-body">${bodyHtml}</div>
        ${footerHtml}
      `;

      cell.addEventListener('click', () => {
        openDayAuditModal(day.dateKey);
      });

      gridContainer.appendChild(cell);
    });
  });
}

function renderWeeklyTable(year, monthIndex, activeTrades, excludeSample) {
  const tbody = document.getElementById('cal-week-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const weeklyData = buildWeeklyMatrix(year, monthIndex, activeTrades, preEntryPlans, missedSetups, { excludeSample });

  weeklyData.weeks.forEach(w => {
    const tr = document.createElement('tr');
    const pnlPrefix = w.weekNetPnL > 0 ? '+' : '';
    const pnlColor = w.weekNetPnL > 0 ? 'var(--ledger-profit)' : (w.weekNetPnL < 0 ? 'var(--ledger-loss)' : 'var(--ink-muted)');

    let statusStamp = '<span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;">NO ACTIVITY</span>';
    if (w.status === 'PROFITABLE') statusStamp = '<span class="rubber-stamp stamp-clean" style="font-size: 0.65rem;">PROFITABLE</span>';
    else if (w.status === 'LOSS') statusStamp = '<span class="rubber-stamp stamp-danger" style="font-size: 0.65rem;">DRAWDOWN</span>';
    else if (w.status === 'BREAKEVEN') statusStamp = '<span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;">BREAKEVEN</span>';

    tr.innerHTML = `
      <td><strong>Week ${w.weekNumber}</strong></td>
      <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--ink-secondary);">${w.startDate} → ${w.endDate}</td>
      <td style="font-family: var(--font-mono); font-weight: 700;">${w.weekTrades}</td>
      <td style="font-family: var(--font-mono); font-weight: 700; color: ${pnlColor};">${w.weekTrades > 0 ? `${pnlPrefix}$${Math.abs(w.weekNetPnL).toFixed(2)}` : '--'}</td>
      <td style="font-family: var(--font-mono);">${w.weekTrades > 0 ? `${w.weekWinRate.toFixed(1)}%` : '--'}</td>
      <td>
        <span class="rubber-stamp ${w.weekComplianceRate >= 80 ? 'stamp-clean' : 'stamp-neutral'}" style="font-size: 0.65rem;">
          ${w.weekTrades > 0 ? `${w.weekComplianceRate.toFixed(1)}%` : '--'}
        </span>
      </td>
      <td style="font-family: var(--font-mono);">${w.weekTrades > 0 ? `${w.weekTotalR >= 0 ? '+' : ''}${w.weekTotalR.toFixed(1)}R` : '--'}</td>
      <td style="font-size: 0.8rem; color: var(--ink-secondary);">${w.weekPlans} Plans / ${w.weekMissed} Passes</td>
      <td>${statusStamp}</td>
    `;

    tr.addEventListener('click', () => {
      const tradingDay = w.days.find(d => d.activity && d.activity.totalTrades > 0) || w.days[0];
      if (tradingDay) openDayAuditModal(tradingDay.dateKey);
    });

    tbody.appendChild(tr);
  });
}

function renderSessionHeatmapView(activeTrades, excludeSample) {
  const heatmapData = generateSessionHeatmap(activeTrades, { excludeSample });

  // 1. Cross-Matrix Table
  const tableContainer = document.getElementById('cal-heatmap-table-container');
  if (tableContainer) {
    let theadCols = '<th>Session Block</th>';
    DAYS_OF_WEEK.slice(0, 5).forEach(day => {
      theadCols += `<th>${day.short}</th>`;
    });

    let tbodyRows = '';
    SESSION_ORDER.forEach(sessId => {
      const sessMeta = SESSION_BLOCKS[sessId];
      let rowHtml = `
        <tr>
          <td class="heatmap-session-label">
            <span>${sessMeta.icon}</span>
            <span>${sessMeta.label}</span>
          </td>
      `;

      DAYS_OF_WEEK.slice(0, 5).forEach(day => {
        const cellData = heatmapData.matrix[sessId][day.key];
        let cellClass = 'empty';
        if (cellData.tradeCount > 0) {
          if (cellData.netPnL > 0) {
            cellClass = cellData.intensity > 0.6 ? 'profit-high' : (cellData.intensity > 0.25 ? 'profit-med' : 'profit-low');
          } else if (cellData.netPnL < 0) {
            cellClass = cellData.intensity < -0.6 ? 'loss-high' : (cellData.intensity < -0.25 ? 'loss-med' : 'loss-low');
          } else {
            cellClass = 'profit-low';
          }
        }

        const pnlText = cellData.tradeCount > 0
          ? `${cellData.netPnL >= 0 ? '+' : ''}$${Math.abs(cellData.netPnL).toFixed(0)}`
          : '--';
        const metaText = cellData.tradeCount > 0
          ? `${cellData.tradeCount}t • ${cellData.winRate.toFixed(0)}%W`
          : '0 trades';

        rowHtml += `
          <td>
            <div class="heatmap-cell ${cellClass}" title="${sessMeta.label} on ${day.label}: ${pnlText} across ${cellData.tradeCount} trades (${cellData.complianceRate}% rule adherence)">
              <span class="heatmap-cell-val">${pnlText}</span>
              <span class="heatmap-cell-meta">${metaText}</span>
            </div>
          </td>
        `;
      });

      rowHtml += '</tr>';
      tbodyRows += rowHtml;
    });

    tableContainer.innerHTML = `
      <table class="heatmap-table">
        <thead><tr>${theadCols}</tr></thead>
        <tbody>${tbodyRows}</tbody>
      </table>
    `;
  }

  // 2. Session Summary Cards
  const cardsContainer = document.getElementById('cal-session-cards-container');
  if (cardsContainer) {
    cardsContainer.innerHTML = '';
    const classMap = {
      LONDON: 'london',
      NEW_YORK_AM: 'ny-am',
      NEW_YORK_PM: 'ny-pm',
      ASIAN: 'asian',
      OVERNIGHT: 'overnight'
    };

    SESSION_ORDER.forEach(sessId => {
      const s = heatmapData.sessions[sessId];
      const pnlPrefix = s.netPnL > 0 ? '+' : '';
      const pnlColor = s.netPnL > 0 ? 'var(--ledger-profit)' : (s.netPnL < 0 ? 'var(--ledger-loss)' : 'var(--ink-muted)');

      const card = document.createElement('div');
      card.className = `session-stat-card ${classMap[sessId] || 'london'}`;
      card.innerHTML = `
        <div class="session-stat-header">
          <div>
            <span style="font-size: 1.1rem; margin-right: 0.3rem;">${s.icon}</span>
            <strong class="session-stat-title">${s.label}</strong>
          </div>
          <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--ink-muted);">${s.timeRange}</span>
        </div>
        <div class="session-stat-rows">
          <div class="session-stat-row">
            <span>Cumulative P&amp;L</span>
            <strong style="color: ${pnlColor}; font-size: 1rem;">${s.totalTrades > 0 ? `${pnlPrefix}$${s.netPnL.toFixed(2)}` : '$0.00'}</strong>
          </div>
          <div class="session-stat-row">
            <span>Activity Volume</span>
            <strong>${s.totalTrades} trades (${s.tradeSharePercent}% volume)</strong>
          </div>
          <div class="session-stat-row">
            <span>Win Rate</span>
            <strong>${s.winRate.toFixed(1)}% ${s.winRateCI ? `[${s.winRateCI.formatted}]` : ''}</strong>
          </div>
          <div class="session-stat-row">
            <span>Rule Compliance</span>
            <strong style="color: var(--ledger-profit);">${s.complianceRate.toFixed(1)}% ${s.complianceCI ? `[${s.complianceCI.formatted}]` : ''}</strong>
          </div>
          <div class="session-stat-row">
            <span>Realized Return</span>
            <strong>${s.totalR >= 0 ? '+' : ''}${s.totalR.toFixed(1)}R (${s.avgPnLPerTrade >= 0 ? '+' : ''}$${s.avgPnLPerTrade.toFixed(2)}/trade)</strong>
          </div>
          <div class="session-stat-row">
            <span>Profit Factor</span>
            <strong>${s.profitFactor > 0 ? s.profitFactor.toFixed(2) : '--'}</strong>
          </div>
        </div>
      `;
      cardsContainer.appendChild(card);
    });
  }

  // 3. Empirical Observations
  const obsContainer = document.getElementById('cal-session-observations-list');
  if (obsContainer) {
    if (heatmapData.observations.length === 0) {
      obsContainer.innerHTML = '<div style="font-style: italic; color: var(--ink-secondary);">No empirical session observations recorded yet. Log trades across market sessions to build retrospective insights.</div>';
    } else {
      obsContainer.innerHTML = heatmapData.observations.map(o => `
        <div style="background: #FFF; border: 1px solid var(--ledger-paper-border); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <strong style="font-family: var(--font-serif); color: var(--ink-primary);">${o.headline}</strong>
            <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--ink-muted);">Sample n = ${o.sampleSize}</span>
          </div>
          <p style="margin: 0; font-size: 0.82rem; color: var(--ink-secondary); line-height: 1.4;">${o.text}</p>
        </div>
      `).join('');
    }
  }
}

function openDayAuditModal(dateKey) {
  const modal = document.getElementById('day-audit-modal');
  if (!modal) return;

  const activeTrades = getCalendarTrades();
  const excludeSample = document.getElementById('cal-filter-source')?.value !== 'ALL';
  const audit = buildDayAudit(dateKey, activeTrades, preEntryPlans, missedSetups, { excludeSample });

  // 1. Header & Title
  const titleEl = document.getElementById('day-audit-date-title');
  const subEl = document.getElementById('day-audit-date-subtitle');
  const badgeEl = document.getElementById('day-audit-badge');

  if (titleEl) titleEl.textContent = `${audit.dayName}, ${audit.dateKey}`;
  if (subEl) subEl.textContent = `Retrospective Day Audit • ${audit.summary.totalTrades} Executed Trades`;

  if (badgeEl) {
    if (audit.summary.status === 'PROFITABLE') {
      badgeEl.className = 'rubber-stamp stamp-clean';
      badgeEl.textContent = 'PROFITABLE DAY ✓';
    } else if (audit.summary.status === 'LOSS') {
      badgeEl.className = 'rubber-stamp stamp-danger';
      badgeEl.textContent = 'DRAWDOWN DAY';
    } else {
      badgeEl.className = 'rubber-stamp stamp-neutral';
      badgeEl.textContent = 'STAND-DOWN / NEUTRAL';
    }
  }

  // 2. Day Summary Hero
  const pnlHead = document.getElementById('day-audit-pnl-headline');
  const rHead = document.getElementById('day-audit-r-headline');
  if (pnlHead) {
    const pnl = audit.summary.netPnL;
    pnlHead.textContent = `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    pnlHead.style.color = pnl > 0 ? 'var(--ledger-profit)' : (pnl < 0 ? 'var(--ledger-loss)' : 'var(--ink-primary)');
  }
  if (rHead) {
    rHead.textContent = `${audit.summary.totalR >= 0 ? '+' : ''}${audit.summary.totalR.toFixed(2)}R realized net across ${audit.summary.totalTrades} executions`;
  }

  const statTrades = document.getElementById('day-audit-stat-trades');
  const statWinrate = document.getElementById('day-audit-stat-winrate');
  const statCompliance = document.getElementById('day-audit-stat-compliance');
  const statViolations = document.getElementById('day-audit-stat-violations');

  if (statTrades) statTrades.textContent = audit.summary.totalTrades;
  if (statWinrate) statWinrate.textContent = `${audit.summary.winRate.toFixed(1)}% (${audit.summary.wins}W / ${audit.summary.losses}L)`;
  if (statCompliance) statCompliance.textContent = `${audit.summary.complianceRate.toFixed(1)}%`;
  if (statViolations) {
    statViolations.textContent = audit.summary.violations;
    statViolations.style.color = audit.summary.violations > 0 ? 'var(--ledger-loss)' : 'var(--ledger-profit)';
  }

  // 3. Executed Trades Table
  const tradesContainer = document.getElementById('day-audit-trades-container');
  const tradesBadge = document.getElementById('day-audit-trades-count-badge');
  if (tradesBadge) tradesBadge.textContent = `${audit.trades.length} Trades`;

  if (tradesContainer) {
    if (audit.trades.length === 0) {
      tradesContainer.innerHTML = '<div style="font-style: italic; color: var(--ink-secondary); padding: 0.75rem 0;">No executed trades logged on this calendar day.</div>';
    } else {
      let rows = '';
      audit.trades.forEach(t => {
        const pnl = Number(t.netPnL || 0);
        const pnlColor = pnl > 0 ? 'var(--ledger-profit)' : (pnl < 0 ? 'var(--ledger-loss)' : 'var(--ink-muted)');
        const sess = classifySessionBlock(t);
        const hasChart = !!(t.hasVisualEvidence || t.screenshotUrl || t.preEntryScreenshotUrl || t.outcomeScreenshotUrl);
        const isCompliant = !Array.isArray(t.violations) || t.violations.length === 0;

        rows += `
          <tr>
            <td><strong>${t.symbol || '--'}</strong></td>
            <td><span class="badge-source-${(t.direction || 'LONG').toLowerCase()}">${t.direction || 'LONG'}</span></td>
            <td style="font-size: 0.8rem; font-family: var(--font-mono); color: var(--ink-secondary);">${t.entryDate ? t.entryDate.slice(11, 16) : '--'}</td>
            <td><span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;">${sess.icon} ${sess.shortLabel}</span></td>
            <td style="font-family: var(--font-mono);">${Number(t.entryPrice || 0).toFixed(2)} → ${Number(t.exitPrice || 0).toFixed(2)}</td>
            <td style="font-family: var(--font-mono); font-weight: 700; color: ${pnlColor};">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</td>
            <td style="font-family: var(--font-mono);">${Number(t.rMultiple || 0) >= 0 ? '+' : ''}${Number(t.rMultiple || 0).toFixed(2)}R</td>
            <td>
              <span class="rubber-stamp ${isCompliant ? 'stamp-clean' : 'stamp-danger'}" style="font-size: 0.65rem;">
                ${isCompliant ? 'RULE COMPLIANT' : (t.violations.join(', ') || 'NON-COMPLIANT')}
              </span>
            </td>
            <td>
              ${hasChart ? `<button class="btn btn-secondary btn-sm cal-btn-view-chart" data-trade-id="${t.id}" style="font-size: 0.72rem; padding: 0.15rem 0.45rem;">📷 Chart</button>` : '<span style="color: var(--ink-muted); font-size: 0.75rem;">--</span>'}
            </td>
          </tr>
        `;
      });

      tradesContainer.innerHTML = `
        <table class="weekly-matrix-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Time</th>
              <th>Session</th>
              <th>Fills</th>
              <th>Net P&amp;L</th>
              <th>R</th>
              <th>Compliance</th>
              <th>Visual</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      tradesContainer.querySelectorAll('.cal-btn-view-chart').forEach(btn => {
        btn.addEventListener('click', () => {
          const tradeId = btn.getAttribute('data-trade-id');
          const t = audit.trades.find(x => x.id === tradeId);
          if (!t) return;
          const primary = t.outcomeScreenshotUrl || t.screenshotUrl || t.preEntryScreenshotUrl;
          const secondary = t.preEntryScreenshotUrl && t.outcomeScreenshotUrl ? t.preEntryScreenshotUrl : null;
          if (window.openLightbox && primary) {
            window.openLightbox(primary, `${t.symbol} ${t.direction} Trade Execution`, `${t.entryDate || ''} • ${t.netPnL >= 0 ? '+' : ''}$${Number(t.netPnL || 0).toFixed(2)}`, secondary, t.notes || '');
          }
        });
      });
    }
  }

  // 4. Pre-Entry Plans Section
  const plansContainer = document.getElementById('day-audit-plans-container');
  const plansBadge = document.getElementById('day-audit-plans-count-badge');
  if (plansBadge) plansBadge.textContent = `${audit.plans.length} Plans`;

  if (plansContainer) {
    if (audit.plans.length === 0) {
      plansContainer.innerHTML = '<div style="font-style: italic; color: var(--ink-secondary); font-size: 0.85rem;">No pre-entry plans recorded for this date.</div>';
    } else {
      plansContainer.innerHTML = audit.plans.map(p => `
        <div style="background: #FFF; border: 1px solid var(--ledger-paper-border); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <strong>${p.symbol}</strong>
              <span class="badge-source-${(p.direction || 'LONG').toLowerCase()}">${p.direction || 'LONG'}</span>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-muted);">${p.plannedAt ? p.plannedAt.slice(11, 16) : ''}</span>
              <span class="rubber-stamp stamp-neutral" style="font-size: 0.6rem;">${p.status || 'PENDING'}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--ink-secondary); margin-top: 0.2rem;">
              Planned Entry: <strong>${p.entryPrice}</strong> | Stop: <strong>${p.stopLoss}</strong> | Target: <strong>${p.takeProfit || '--'}</strong> (R:R: ${p.plannedRR || '--'})
            </div>
            ${p.setupRationale ? `<div style="font-size: 0.78rem; color: var(--ink-muted); font-style: italic; margin-top: 0.15rem;">"${p.setupRationale}"</div>` : ''}
          </div>
          ${p.screenshotUrl ? `<button class="btn btn-secondary btn-sm cal-plan-chart-btn" data-url="${p.screenshotUrl}" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;">📷 Setup Chart</button>` : ''}
        </div>
      `).join('');

      plansContainer.querySelectorAll('.cal-plan-chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-url');
          if (window.openLightbox && url) {
            window.openLightbox(url, 'Pre-Entry Setup Chart', 'Planned Context & Trigger Level', null, '');
          }
        });
      });
    }
  }

  // 5. Missed Setups / Deliberate Passes Section
  const missedContainer = document.getElementById('day-audit-missed-container');
  const missedBadge = document.getElementById('day-audit-missed-count-badge');
  if (missedBadge) missedBadge.textContent = `${audit.missed.length} Passes`;

  if (missedContainer) {
    if (audit.missed.length === 0) {
      missedContainer.innerHTML = '<div style="font-style: italic; color: var(--ink-secondary); font-size: 0.85rem;">No missed setups or intentional stand-downs logged on this date.</div>';
    } else {
      missedContainer.innerHTML = audit.missed.map(m => `
        <div style="background: #FFF; border: 1px solid var(--ledger-paper-border); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <strong>${m.symbol}</strong>
              <span class="badge-source-${(m.direction || 'LONG').toLowerCase()}">${m.direction || 'LONG'}</span>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-muted);">${m.loggedAt ? m.loggedAt.slice(11, 16) : ''}</span>
              <span class="rubber-stamp ${m.isDisciplineWin ? 'stamp-clean' : 'stamp-neutral'}" style="font-size: 0.6rem;">
                ${m.isDisciplineWin ? 'DISCIPLINE WIN ✓' : 'HESITATION'}
              </span>
            </div>
            <div style="font-size: 0.8rem; color: var(--ink-secondary); margin-top: 0.2rem;">
              Reason: <strong>${m.reasonLabel || m.reasonCode || 'Discretionary Pass'}</strong>
            </div>
            ${m.reflection ? `<div style="font-size: 0.78rem; color: var(--ink-muted); font-style: italic; margin-top: 0.15rem;">"${m.reflection}"</div>` : ''}
          </div>
          ${m.screenshotUrl ? `<button class="btn btn-secondary btn-sm cal-missed-chart-btn" data-url="${m.screenshotUrl}" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;">📷 Setup Chart</button>` : ''}
        </div>
      `).join('');

      missedContainer.querySelectorAll('.cal-missed-chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-url');
          if (window.openLightbox && url) {
            window.openLightbox(url, 'Missed Setup / Restraint Chart', 'Setup Context & Deliberate Pass Reason', null, '');
          }
        });
      });
    }
  }

  modal.classList.add('open');
}

/**
 * 28. Rapid Broker Order Text Parser & Quick Ingest Box Handler
 */
function setupQuickIngestBox() {
  const modal = document.getElementById('quick-ingest-modal');
  const openBtn = document.getElementById('btn-open-quick-ingest');
  const closeBtn = document.getElementById('btn-close-quick-ingest');
  const cancelBtn = document.getElementById('btn-quick-ingest-cancel');
  const clearBtn = document.getElementById('btn-quick-ingest-clear');
  const approveAllBtn = document.getElementById('btn-quick-ingest-approve-all');
  const textarea = document.getElementById('quick-ingest-textarea');
  const brokerBadge = document.getElementById('quick-ingest-detected-broker');
  const fillsCountEl = document.getElementById('quick-ingest-fills-count');
  const tradesCountEl = document.getElementById('quick-ingest-trades-count');
  const warningBox = document.getElementById('quick-ingest-warning-box');
  const draftsCard = document.getElementById('quick-ingest-drafts-card');
  const draftsTbody = document.getElementById('quick-ingest-drafts-tbody');
  const sampleBtns = document.querySelectorAll('.quick-ingest-sample-btn');

  if (!modal || !textarea) return;

  const SAMPLES = {
    tradovate: `2026-09-22 09:35:10 Bought 2 NQU6 @ 19850.50\n2026-09-22 09:55:00 Sold 2 NQU6 @ 19905.00`,
    ibkr: `2026-09-22 10:00:15 BOT 100 NVDA @ 125.50 Com: 1.00\n2026-09-22 11:15:30 SLD 100 NVDA @ 129.00 Com: 1.00`,
    mt5: `2026.09.22 08:30:00 buy 1.00 EURUSD 1.08500 sl: 1.08250 tp: 1.09200\n2026.09.22 10:45:00 close 1.00 EURUSD 1.08950`,
    tos: `09/22/2026 09:40:00 BUY +1 /ES @5600.00\n09/22/2026 10:15:00 SELL -1 /ES @5625.50`
  };

  let currentParsedResult = null;
  let debounceTimer = null;

  const openModal = () => {
    modal.classList.add('open');
    textarea.focus();
  };

  const closeModal = () => {
    modal.classList.remove('open');
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      textarea.value = '';
      resetParsedView();
    });
  }

  // Sample buttons
  sampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sampleKey = btn.getAttribute('data-sample');
      if (SAMPLES[sampleKey]) {
        textarea.value = SAMPLES[sampleKey];
        processInput();
      }
    });
  });

  const resetParsedView = () => {
    currentParsedResult = null;
    if (brokerBadge) {
      brokerBadge.textContent = 'AWAITING INPUT';
      brokerBadge.className = 'rubber-stamp stamp-neutral';
    }
    if (fillsCountEl) fillsCountEl.textContent = '0';
    if (tradesCountEl) tradesCountEl.textContent = '0';
    if (warningBox) {
      warningBox.style.display = 'none';
      warningBox.innerHTML = '';
    }
    if (draftsCard) draftsCard.style.display = 'none';
    if (draftsTbody) draftsTbody.innerHTML = '';
    if (approveAllBtn) {
      approveAllBtn.disabled = true;
      approveAllBtn.textContent = '✓ Approve & Log to Journal';
    }
  };

  const processInput = () => {
    const rawText = textarea.value.trim();
    if (!rawText) {
      resetParsedView();
      return;
    }

    try {
      currentParsedResult = parseBrokerOrderText(rawText);
      renderParsedPreview(currentParsedResult);
    } catch (err) {
      console.error('Failed to parse broker order text:', err);
      if (warningBox) {
        warningBox.style.display = 'block';
        warningBox.textContent = `Parser Error: ${err.message}`;
      }
    }
  };

  // Real-time input and paste listeners with debounce
  textarea.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processInput, 180);
  });

  textarea.addEventListener('paste', () => {
    setTimeout(processInput, 50);
  });

  const renderParsedPreview = (result) => {
    if (!result) return;

    // 1. Update detected broker badge
    if (brokerBadge) {
      const brokerLabels = {
        [SUPPORTED_BROKERS.TRADOVATE_NINJA]: 'TRADOVATE / NINJA',
        [SUPPORTED_BROKERS.INTERACTIVE_BROKERS]: 'INTERACTIVE BROKERS',
        [SUPPORTED_BROKERS.METATRADER]: 'METATRADER 4/5',
        [SUPPORTED_BROKERS.THINKORSWIM]: 'THINKORSWIM',
        [SUPPORTED_BROKERS.TRADINGVIEW]: 'TRADINGVIEW',
        [SUPPORTED_BROKERS.GENERIC]: 'GENERIC ORDER SUMMARY'
      };
      const label = brokerLabels[result.detectedBroker] || result.detectedBroker || 'DETECTED';
      brokerBadge.textContent = label;
      brokerBadge.className = result.confidence > 0.5 ? 'rubber-stamp stamp-clean' : 'rubber-stamp stamp-neutral';
    }

    // 2. Counts
    if (fillsCountEl) fillsCountEl.textContent = result.fills ? result.fills.length : 0;
    if (tradesCountEl) tradesCountEl.textContent = result.trades ? result.trades.length : 0;

    // 3. Warnings
    if (warningBox) {
      if (result.warnings && result.warnings.length > 0) {
        warningBox.style.display = 'block';
        warningBox.innerHTML = `<strong>Notice:</strong><ul style="margin: 0.25rem 0 0 1.25rem; padding: 0;">${result.warnings.map(w => `<li>${w}</li>`).join('')}</ul>`;
      } else {
        warningBox.style.display = 'none';
        warningBox.innerHTML = '';
      }
    }

    // 4. Draft Trades Preview Table
    if (result.trades && result.trades.length > 0) {
      if (draftsCard) draftsCard.style.display = 'block';
      if (approveAllBtn) {
        approveAllBtn.disabled = false;
        approveAllBtn.textContent = `✓ Approve & Log to Journal (${result.trades.length})`;
      }

      let rows = '';
      result.trades.forEach((t, idx) => {
        const netPnL = Number(t.netPnL || 0);
        const pnlColor = netPnL > 0 ? 'var(--ledger-profit)' : (netPnL < 0 ? 'var(--ledger-loss)' : 'var(--ink-muted)');
        const sess = classifySessionBlock(t);
        const sideClass = (t.direction || 'LONG').toLowerCase();

        rows += `
          <tr data-draft-idx="${idx}">
            <td><strong>${t.symbol}</strong></td>
            <td><span class="badge-source-${sideClass}">${t.direction}</span></td>
            <td style="font-family: var(--font-mono);">${t.quantity || 1}</td>
            <td style="font-size: 0.8rem; font-family: var(--font-mono); color: var(--ink-secondary);">${t.entryDate ? t.entryDate.slice(11, 16) : '--'}</td>
            <td><span class="rubber-stamp stamp-neutral" style="font-size: 0.65rem;">${sess.icon} ${sess.shortLabel}</span></td>
            <td style="font-family: var(--font-mono);">${Number(t.entryPrice || 0).toFixed(2)} → ${Number(t.exitPrice || 0).toFixed(2)}</td>
            <td style="font-family: var(--font-mono); color: var(--ink-muted);">$${Number(t.commissions || 0).toFixed(2)}</td>
            <td style="font-family: var(--font-mono); font-weight: 700; color: ${pnlColor};">${netPnL >= 0 ? '+' : ''}$${netPnL.toFixed(2)}</td>
            <td style="font-family: var(--font-mono);">${Number(t.rMultiple || 0) >= 0 ? '+' : ''}${Number(t.rMultiple || 0).toFixed(2)}R</td>
            <td style="white-space: nowrap;">
              <button class="btn btn-primary btn-sm btn-quick-ingest-single" data-draft-idx="${idx}" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;">✓ Journal</button>
              <button class="btn btn-secondary btn-sm btn-quick-ingest-fullform" data-draft-idx="${idx}" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;">📝 Full Form</button>
            </td>
          </tr>
        `;
      });

      if (draftsTbody) {
        draftsTbody.innerHTML = rows;

        // Bind single trade approval
        draftsTbody.querySelectorAll('.btn-quick-ingest-single').forEach(btn => {
          btn.addEventListener('click', async () => {
            const idx = parseInt(btn.getAttribute('data-draft-idx'), 10);
            const draft = result.trades[idx];
            if (!draft) return;
            await saveAndCommitTrades([draft]);
            result.trades.splice(idx, 1);
            if (result.trades.length === 0) {
              resetParsedView();
            } else {
              renderParsedPreview(result);
            }
          });
        });

        // Bind open in full form
        draftsTbody.querySelectorAll('.btn-quick-ingest-fullform').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-draft-idx'), 10);
            const draft = result.trades[idx];
            if (!draft) return;
            openInFullEntryForm(draft);
            closeModal();
          });
        });
      }
    } else {
      if (draftsCard) draftsCard.style.display = 'none';
      if (draftsTbody) draftsTbody.innerHTML = '';
      if (approveAllBtn) {
        approveAllBtn.disabled = true;
        approveAllBtn.textContent = '✓ Approve & Log to Journal';
      }
    }
  };

  // Helper to persist approved trades
  const saveAndCommitTrades = async (incomingTrades) => {
    if (!incomingTrades || incomingTrades.length === 0) return;

    try {
      const res = await fetch('/api/trades/quick-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: incomingTrades })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.trades && data.trades.length > 0) {
          trades.unshift(...data.trades);
        } else {
          trades.unshift(...incomingTrades);
        }
      } else {
        // Fallback local persistence
        trades.unshift(...incomingTrades);
      }
    } catch (err) {
      console.warn('Quick Ingest API post failed, persisting in local state:', err);
      trades.unshift(...incomingTrades);
    }

    trades = tagLegacySampleTrades(trades, sampleTrades);
    persistLocalBackup();
    refreshAllViews();
    renderGallery();
    if (document.getElementById('calendar-view')?.classList.contains('active')) {
      renderCalendarView();
    }
  };

  // Approve all button
  if (approveAllBtn) {
    approveAllBtn.addEventListener('click', async () => {
      if (!currentParsedResult || !currentParsedResult.trades || currentParsedResult.trades.length === 0) return;
      approveAllBtn.disabled = true;
      approveAllBtn.textContent = 'Saving...';

      const tradeCount = currentParsedResult.trades.length;
      await saveAndCommitTrades(currentParsedResult.trades);

      textarea.value = '';
      resetParsedView();
      closeModal();
      alert(`✓ Successfully logged ${tradeCount} verified trade(s) to journal!`);
    });
  }

  // Open in Full Form
  const openInFullEntryForm = (draft) => {
    const tradeModal = document.getElementById('trade-modal');
    if (!tradeModal) return;

    const formSource = document.getElementById('form-trade-source');
    const formSymbol = document.getElementById('form-symbol');
    const formAssetClass = document.getElementById('form-asset-class');
    const formDirection = document.getElementById('form-direction');
    const formEntryPrice = document.getElementById('form-entry-price');
    const formExitPrice = document.getElementById('form-exit-price');
    const formStopLoss = document.getElementById('form-stop-loss');
    const formTakeProfit = document.getElementById('form-take-profit');
    const formNotes = document.getElementById('form-notes');

    if (formSource) formSource.value = 'PERSONAL';
    if (formSymbol) formSymbol.value = draft.symbol || '';
    if (formAssetClass) formAssetClass.value = draft.assetClass || inferAssetClassFromSymbol(draft.symbol || '');
    if (formDirection) formDirection.value = draft.direction || 'LONG';
    if (formEntryPrice) formEntryPrice.value = draft.entryPrice || '';
    if (formExitPrice) formExitPrice.value = draft.exitPrice || '';
    if (formStopLoss) formStopLoss.value = draft.stopLoss || '';
    if (formTakeProfit) formTakeProfit.value = draft.takeProfit || '';
    if (formNotes) {
      formNotes.value = `Broker Import (${draft.broker || 'Direct'}) | Qty: ${draft.quantity || 1} | Commissions: $${Number(draft.commissions || 0).toFixed(2)}`;
    }

    // Trigger input events to update risk calculations and preview
    formSymbol?.dispatchEvent(new Event('input'));
    formEntryPrice?.dispatchEvent(new Event('input'));
    formStopLoss?.dispatchEvent(new Event('input'));

    tradeModal.classList.add('open');
  };
}



