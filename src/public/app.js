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
import { calculatePositionSize } from '../engine/sizing.js';
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
import { renderCandlestickPatternChart, renderLessonTopicChart } from '../engine/lesson-charts.js';
import { filterPerformanceTrades, isDemoTrade, isSampleTrade, normalizeTradeSource, tagLegacySampleTrades } from '../engine/trade-provenance.js';

// Application State
let trades = [];
let sampleTrades = [];
let activeLessonId = 'lesson-1';
let curriculumData = [];
let tradingContract = { ...DEFAULT_TRADING_CONTRACT };
let preSessionLogs = [];
let annotatingTrade = null;
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
  if (sourceFilter === 'SAMPLE') return sampleTrades;
  if (sourceFilter === 'DEMO') return trades.filter(isDemoTrade);
  return trades.filter(trade => !isDemoTrade(trade) && !isSampleTrade(trade));
}

function getTradeSourceLabel(trade) {
  const source = normalizeTradeSource(trade.source);
  const labels = {
    MANUAL: 'PERSONAL',
    CSV_IMPORT: 'CSV IMPORT',
    BROKER_IMPORT: 'BROKER IMPORT',
    DEMO_PRACTICE: 'DEMO',
    SAMPLE: 'SAMPLE',
    LEGACY_UNKNOWN: 'LEGACY'
  };
  return labels[source] || source;
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
  setupPropFirm();
  setupPlaybook();
  setupTradingPlan();
  setupSessionSystem();

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
    const [tradesRes, currRes, contractRes, preRes, samplesRes] = await Promise.all([
      fetch('/api/trades'),
      fetch('/api/curriculum'),
      fetch('/api/contract'),
      fetch('/api/presession'),
      fetch('/api/sample-trades')
    ]);
    trades = await tradesRes.json();
    curriculumData = await currRes.json();
    tradingContract = await contractRes.json();
    preSessionLogs = await preRes.json();
    sampleTrades = await samplesRes.json();
    trades = tagLegacySampleTrades(trades, sampleTrades);

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
  renderDashboardSummary();
  renderPerformanceMetrics();
  drawEquityCurve();
  renderExcursionDiagnostics();
  renderMonteCarloSimulation();
  updateCircuitBreakerBanner();
  updateGatekeeperBadge();
  renderPropFirmGuardian();
  renderPlaybookView();
}

/**
 * 1. Render Discipline Tape
 */
function renderDisciplineTape() {
  const container = document.getElementById('tape-items');
  if (!container) return;
  container.innerHTML = '';

  if (trades.length === 0) {
    container.innerHTML = `<span class="tape-node" style="color: var(--ink-muted);">No executions recorded yet</span>`;
    return;
  }

  trades.forEach((trade) => {
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
    const messages = {
      PERSONAL: 'PERSONAL JOURNAL · Dashboard performance excludes demo practice and sample examples.',
      DEMO: 'DEMO PRACTICE · Simulated journal records only. They are excluded from personal performance summaries.',
      SAMPLE: 'SAMPLE EXAMPLES · Read-only educational data. These records are never included in user performance or risk calculations.'
    };
    sourceBanner.textContent = messages[sourceMode] || messages.PERSONAL;
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
    const sourceLabel = getTradeSourceLabel(t);

    return `
      <tr class="${hasViolations ? 'row-violation' : ''}">
        <td style="font-weight: 600;">${t.id || 'TR-GEN'}</td>
        <td style="color: var(--ink-muted);">${dateStr}</td>
        <td><span style="font-size: 0.75rem; border: 1px solid var(--ledger-paper-border); padding: 2px 4px; border-radius: 2px;">${t.assetClass || 'EQ'}</span></td>
        <td style="font-weight: 700;">${t.symbol}</td>
        <td style="color: ${t.direction === 'LONG' ? 'var(--ledger-gain)' : 'var(--ledger-loss)'}; font-weight: 600;">${t.direction}</td>
        <td>${Number(t.entryPrice).toFixed(2)}</td>
        <td>${t.exitPrice ? Number(t.exitPrice).toFixed(2) : '--'}</td>
        <td style="color: var(--ledger-loss);">${t.stopLoss ? Number(t.stopLoss).toFixed(2) : 'NONE'}</td>
        <td>${t.quantity}</td>
        <td class="pnl-cell ${pnlClass}">${pnlFormatted}</td>
        <td style="font-weight: 600;">${rFormatted}</td>
        <td>${gradeBadge}</td>
        <td>${stampBadge}</td>
        <td><span class="trade-source-badge source-${normalizeTradeSource(t.source).toLowerCase()}">${sourceLabel}</span></td>
        <td style="font-size: 0.75rem; color: var(--ink-secondary);">${t.executionMode === 'DEMO' ? '<span class="rubber-stamp stamp-neutral">DEMO</span> ' : ''}${(t.setupId || 'Discretionary').replaceAll('_', ' ')}</td>
        <td>
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

  reportPanel.innerHTML = `
    <div class="report-card">
      <div class="card-title">Quick operational read</div>
      <div class="report-list">
        <div><strong>Net PnL:</strong> ${report.netPnL >= 0 ? '+$' : '-$'}${Math.abs(report.netPnL).toFixed(2)}</div>
        <div><strong>Average R:</strong> ${report.averageR >= 0 ? '+' : ''}${report.averageR.toFixed(2)}R</div>
        <div><strong>Clean trades:</strong> ${report.cleanTrades}</div>
      </div>
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
 * 9. Render Visual Trade Gallery
 */
function renderGallery() {
  const galleryGrid = document.getElementById('gallery-grid');
  if (!galleryGrid) return;

  const filterSetup = document.getElementById('gallery-filter-setup')?.value || 'ALL';
  const filtered = getVisibleJournalTrades().filter(t => filterSetup === 'ALL' || t.setupId === filterSetup);

  if (filtered.length === 0) {
    galleryGrid.innerHTML = `<div class="card full" style="text-align: center; color: var(--ink-muted); padding: 3rem;">No trade charts matching selected setup.</div>`;
    return;
  }

  galleryGrid.innerHTML = filtered.map(t => {
    const isGain = (t.netPnL || 0) >= 0;
    const rFormatted = (t.rMultiple >= 0 ? '+' : '') + Number(t.rMultiple || 0).toFixed(2) + 'R';
    const chartSvg = renderTradeChartSVG(t);
    const grade = t.disciplineGrade || (isGain ? 'A' : 'C');

    return `
      <div class="gallery-card">
        <div class="gallery-preview-box">
          ${chartSvg}
        </div>
        <div style="padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div>
              <strong style="font-family: var(--font-serif); font-size: 1.15rem;">${t.symbol}</strong>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-muted); margin-left: 0.5rem;">${t.direction}</span>
              <span class="trade-source-badge source-${normalizeTradeSource(t.source).toLowerCase()}">${getTradeSourceLabel(t)}</span>
              <span class="rubber-stamp stamp-clean" style="margin-left: 0.5rem;">${grade}</span>
            </div>
            <span class="pnl-cell ${isGain ? 'gain' : 'loss'}" style="font-size: 1.1rem;">${rFormatted}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--ink-secondary); margin-bottom: 0.75rem;">
            <span>Setup: <strong>${(t.setupId || 'Discretionary').replace('_', ' ')}</strong></span>
            <span>MAE: -${Number(t.maePrice ? Math.abs((t.entryPrice - t.maePrice) / (t.entryPrice - t.stopLoss || 1)) : 0).toFixed(2)}R</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; color: var(--ink-muted);">${new Date(t.entryDate).toLocaleDateString()}</span>
            <button class="btn btn-secondary btn-sm" onclick="window.openAnnotator('${t.id}')">Markup Chart</button>
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

    if (entry <= 0 || stop <= 0 || entry === stop) {
      detailsDiv.innerHTML = `<span style="color: var(--ink-muted);">Enter Entry and Stop Loss prices to calculate position size.</span>`;
      return;
    }

    const sizeResult = calculatePositionSize({
      assetClass: asset,
      symbol,
      entryPrice: entry,
      stopLoss: stop,
      accountBalance: balance,
      riskPercentage: riskPct
    });

    let qty = 1;
    let desc = '';

    if (asset === 'EQUITY' || asset === 'CRYPTO') {
      qty = sizeResult.quantity;
      desc = `Risk: <strong>$${sizeResult.riskBudget.toFixed(2)}</strong> (${riskPct}%) | Distance: <strong>$${sizeResult.distance.toFixed(2)}</strong> | Position Size: <strong>${qty} units</strong> ($${sizeResult.positionValue.toFixed(2)})`;
    } else if (asset === 'FOREX') {
      qty = sizeResult.lots;
      desc = `Risk: <strong>$${sizeResult.riskBudget.toFixed(2)}</strong> | Stop Distance: <strong>${sizeResult.pips} pips</strong> | Recommended Lot Size: <strong>${qty} lots</strong>`;
    } else if (asset === 'FUTURES') {
      qty = sizeResult.contracts;
      desc = `Contract: <strong>${sizeResult.spec.name}</strong> | Stop: <strong>${sizeResult.ticks} ticks</strong> ($${sizeResult.riskPerContract.toFixed(2)}/contract) | Recommended: <strong>${qty} contracts</strong>`;
    }

    if (tp > 0) {
      const riskDist = Math.abs(entry - stop);
      const rewardDist = Math.abs(tp - entry);
      const rr = rewardDist / riskDist;
      desc += ` | Reward-to-Risk: <strong>1:${rr.toFixed(2)}</strong>`;
    }

    qtyInput.value = qty;
    detailsDiv.innerHTML = desc;

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
      const plannedRisk = sizeResult.riskBudget;
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

  [assetInput, symbolInput, entryInput, stopInput, takeProfitInput, balanceInput, riskInput, maeInput, mfeInput].forEach(el => {
    el?.addEventListener('input', updateCalc);
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
    const demoNotice = document.getElementById('demo-practice-notice');
    if (demoNotice) demoNotice.style.display = demoPracticeSetupId ? 'block' : 'none';
    modal.classList.add('open');
  };
  const closeModal = () => {
    modal.classList.remove('open');
    demoPracticeSetupId = null;
    const demoNotice = document.getElementById('demo-practice-notice');
    if (demoNotice) demoNotice.style.display = 'none';
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

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

      const planLimits = evaluatePlanTradeLimits({ plan: tradingPlan, trades: getPerformanceTrades(), candidateRiskPercent: riskPct });
      if (!planLimits.canTrade) {
        alert(planLimits.breaches.map(breach => breach.message).join('\n'));
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

      const newTrade = {
        id: `TR-${1000 + trades.length + 1}`,
        confluence: confluenceResult,
        isPlaybookCompliant: confluenceResult.isPlaybookCompliant,
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
        violations: [...debriefGrade.inferredViolations, ...confluenceResult.inferredViolations],
        source: demoPracticeSetupId ? 'DEMO_PRACTICE' : 'MANUAL',
        executionMode: demoPracticeSetupId ? 'DEMO' : 'JOURNAL'
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
      panel.innerHTML = `
        <div class="report-card">
          <div class="card-title">Daily summary</div>
          <div class="report-list">
            <div><strong>Trades:</strong> ${summary.totalTrades}</div>
            <div><strong>Win rate:</strong> ${summary.winRate}%</div>
            <div><strong>Net PnL:</strong> ${summary.netPnL >= 0 ? '+$' : '-$'}${Math.abs(summary.netPnL).toFixed(2)}</div>
            <div><strong>Violations:</strong> ${summary.violationCount}</div>
          </div>
        </div>
      `;
      document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach((section) => section.classList.remove('active'));
      const analyticsBtn = document.querySelector('[data-view="analytics-view"]');
      const analyticsView = document.getElementById('analytics-view');
      analyticsBtn?.classList.add('active');
      analyticsView?.classList.add('active');
    } catch (err) {
      console.warn('Report fetch failed', err);
    }
  });
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
