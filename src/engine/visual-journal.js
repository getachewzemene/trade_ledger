/**
 * Visual Trade Journal & Screenshot Evidence Engine
 * 
 * Philosophy:
 * - Real visual proof replaces synthetic assumptions.
 * - Before/After comparison: Pre-Entry Setup vs Execution Outcome.
 * - Visual accountability: Evaluates whether documenting visual chart proof
 *   correlates with higher process compliance and reduced impulse trades.
 * - Quantified uncertainty with Wilson 95% confidence intervals on visual coverage.
 */

import { calculateWilsonConfidenceInterval } from './trader-review.js';

export const ALLOWED_IMAGE_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/gif'
]);

export const SCREENSHOT_TAGS = Object.freeze({
  PRE_ENTRY: {
    code: 'PRE_ENTRY',
    label: 'Pre-Entry Setup (Before)',
    description: 'Chart snapshot taken before entering, showing planned trigger, invalidation, and target.'
  },
  OUTCOME: {
    code: 'OUTCOME',
    label: 'Execution Outcome (After)',
    description: 'Chart snapshot taken at or after exit, documenting actual trade development and price behavior.'
  },
  MISSED: {
    code: 'MISSED',
    label: 'Passed / Missed Setup',
    description: 'Visual evidence of an unqualified setup passed or a move foregone to reinforce discipline.'
  },
  MARKUP: {
    code: 'MARKUP',
    label: 'Annotated Markup',
    description: 'Chart with manual annotations, key levels, market structure breaks, or order flow markers.'
  },
  GENERAL: {
    code: 'GENERAL',
    label: 'General Reference',
    description: 'Higher-timeframe context or reference chart.'
  }
});

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

/**
 * Validates an image attachment for format, size, and metadata.
 */
export function validateImageAttachment(attachment = {}) {
  const errors = [];
  const mimeType = String(attachment.mimeType || '').toLowerCase();
  const sizeBytes = Number(attachment.sizeBytes) || 0;
  const tag = String(attachment.tag || 'GENERAL').toUpperCase();

  if (!mimeType) {
    errors.push('MIME type is required for screenshot upload.');
  } else if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    errors.push(`Unsupported image type '${mimeType}'. Allowed formats: PNG, JPEG, WEBP, SVG, GIF.`);
  }

  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
    errors.push(`Image size (${sizeMb} MB) exceeds maximum allowed limit of 10 MB.`);
  }

  if (attachment.base64Data) {
    if (!attachment.base64Data.startsWith('data:image/') && !/^[A-Za-z0-9+/=]+$/.test(attachment.base64Data.slice(0, 100))) {
      errors.push('Invalid image data format. Expected Base64 or Data URL.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes and builds a visual evidence record.
 */
export function createVisualEvidenceRecord(raw = {}) {
  const validation = validateImageAttachment(raw);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, record: null };
  }

  const id = raw.id || `IMG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const tagCode = String(raw.tag || 'PRE_ENTRY').toUpperCase();
  const tagDef = SCREENSHOT_TAGS[tagCode] || SCREENSHOT_TAGS.GENERAL;

  const record = {
    id,
    entityType: String(raw.entityType || 'TRADE').toUpperCase(), // TRADE, PLAN, MISSED
    entityId: raw.entityId || null,
    tag: tagDef.code,
    tagLabel: tagDef.label,
    url: String(raw.url || '').trim(),
    caption: String(raw.caption || '').trim(),
    mimeType: String(raw.mimeType || 'image/png').toLowerCase(),
    sizeBytes: Number(raw.sizeBytes) || 0,
    width: Number(raw.width) || null,
    height: Number(raw.height) || null,
    timeframe: String(raw.timeframe || '').trim(),
    createdAt: raw.createdAt || new Date().toISOString()
  };

  return { valid: true, errors: [], record };
}

/**
 * Links screenshots to an entity (trade, plan, or missed setup).
 */
export function linkScreenshotsToTrade(trade = {}, screenshots = []) {
  if (!trade) return trade;
  const safeScreenshots = Array.isArray(screenshots) ? screenshots.filter(Boolean) : [];
  
  // Categorize before (pre-entry) and after (outcome)
  const preEntryShot = safeScreenshots.find(s => s.tag === 'PRE_ENTRY') || null;
  const outcomeShot = safeScreenshots.find(s => s.tag === 'OUTCOME') || null;

  return {
    ...trade,
    screenshots: safeScreenshots,
    hasPreEntryScreenshot: Boolean(preEntryShot || trade.preEntryScreenshotUrl),
    hasOutcomeScreenshot: Boolean(outcomeShot || trade.outcomeScreenshotUrl),
    hasVisualEvidence: safeScreenshots.length > 0 || Boolean(trade.screenshotUrl || trade.preEntryScreenshotUrl || trade.outcomeScreenshotUrl),
    preEntryScreenshotUrl: preEntryShot?.url || trade.preEntryScreenshotUrl || null,
    outcomeScreenshotUrl: outcomeShot?.url || trade.outcomeScreenshotUrl || null
  };
}

/**
 * Calculates visual documentation and accountability metrics.
 */
export function calculateVisualEvidenceMetrics(trades = [], preEntryPlans = [], missedSetups = []) {
  const safeTrades = Array.isArray(trades) ? trades.filter(t => t && String(t.source || '').toUpperCase() !== 'SAMPLE') : [];
  const totalTrades = safeTrades.length;

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      tradesWithVisuals: 0,
      visualCoveragePercent: 0,
      tradesWithBeforeAndAfter: 0,
      beforeAndAfterPercent: 0,
      uncertainty: { formatted: '0.0% – 0.0%' },
      missedWithVisuals: 0,
      plansWithVisuals: 0,
      summaryObservation: 'No personal trades recorded to assess visual coverage.'
    };
  }

  let tradesWithVisuals = 0;
  let tradesWithBeforeAndAfter = 0;
  let preEntryOnly = 0;
  let outcomeOnly = 0;

  safeTrades.forEach(t => {
    const hasPre = Boolean(t.hasPreEntryScreenshot || t.preEntryScreenshotUrl || (t.screenshots && t.screenshots.some(s => s.tag === 'PRE_ENTRY')));
    const hasPost = Boolean(t.hasOutcomeScreenshot || t.outcomeScreenshotUrl || (t.screenshots && t.screenshots.some(s => s.tag === 'OUTCOME')));
    const hasAny = hasPre || hasPost || Boolean(t.screenshotUrl || t.hasVisualEvidence || (t.screenshots && t.screenshots.length > 0));

    if (hasAny) tradesWithVisuals++;
    if (hasPre && hasPost) tradesWithBeforeAndAfter++;
    else if (hasPre) preEntryOnly++;
    else if (hasPost) outcomeOnly++;
  });

  const visualCI = calculateWilsonConfidenceInterval(tradesWithVisuals, totalTrades);
  const beforeAndAfterCI = calculateWilsonConfidenceInterval(tradesWithBeforeAndAfter, totalTrades);

  // Check missed setups visual coverage
  const safeMissed = Array.isArray(missedSetups) ? missedSetups : [];
  const missedWithVisuals = safeMissed.filter(m => m.screenshotUrl || (m.screenshots && m.screenshots.length > 0)).length;

  // Check pre-entry plans visual coverage
  const safePlans = Array.isArray(preEntryPlans) ? preEntryPlans : [];
  const plansWithVisuals = safePlans.filter(p => p.screenshotUrl || (p.screenshots && p.screenshots.length > 0)).length;

  return {
    totalTrades,
    tradesWithVisuals,
    visualCoveragePercent: visualCI.percentage,
    visualCoverageCI: visualCI,
    tradesWithBeforeAndAfter,
    beforeAndAfterPercent: beforeAndAfterCI.percentage,
    beforeAndAfterCI,
    preEntryOnly,
    outcomeOnly,
    missedWithVisuals,
    plansWithVisuals,
    summaryObservation: `${tradesWithVisuals} of ${totalTrades} trades (${visualCI.percentage.toFixed(1)}% [95% CI: ${visualCI.formatted}]) have visual chart documentation.`
  };
}

/**
 * Compares execution compliance and outcomes between visually documented trades and undocumented trades.
 */
export function compareVisualAccountabilityCohorts(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades.filter(t => t && String(t.source || '').toUpperCase() !== 'SAMPLE') : [];
  
  const documentedCohort = [];
  const undocumentedCohort = [];

  safeTrades.forEach(t => {
    const hasVisuals = Boolean(
      t.hasVisualEvidence || 
      t.screenshotUrl || 
      t.preEntryScreenshotUrl || 
      t.outcomeScreenshotUrl || 
      (t.screenshots && t.screenshots.length > 0)
    );

    if (hasVisuals) {
      documentedCohort.push(t);
    } else {
      undocumentedCohort.push(t);
    }
  });

  const getCohortStats = (list) => {
    const n = list.length;
    if (n === 0) {
      return { count: 0, winRate: 0, complianceRate: 0, avgR: 0, totalNetPnL: 0 };
    }
    const wins = list.filter(t => (Number(t.netPnL) || Number(t.rMultiple) || 0) > 0).length;
    const compliant = list.filter(t => t.isFullyCompliant !== false && (!t.violations || t.violations.length === 0)).length;
    const sumR = list.reduce((acc, t) => acc + (Number(t.rMultiple) || 0), 0);
    const sumPnL = list.reduce((acc, t) => acc + (Number(t.netPnL) || 0), 0);

    const winWilson = calculateWilsonConfidenceInterval(wins, n);
    const compWilson = calculateWilsonConfidenceInterval(compliant, n);

    return {
      count: n,
      wins,
      winRate: winWilson.percentage,
      winRateCI: winWilson,
      compliantCount: compliant,
      complianceRate: compWilson.percentage,
      complianceRateCI: compWilson,
      avgR: Number((sumR / n).toFixed(2)),
      totalNetPnL: Number(sumPnL.toFixed(2))
    };
  };

  const documentedStats = getCohortStats(documentedCohort);
  const undocumentedStats = getCohortStats(undocumentedCohort);

  return {
    totalTrades: safeTrades.length,
    documentedCohort: documentedStats,
    undocumentedCohort: undocumentedStats,
    complianceDelta: Number((documentedStats.complianceRate - undocumentedStats.complianceRate).toFixed(1)),
    isPrediction: false,
    disclaimer: 'Visual chart documentation reflects trader diligence. Higher process adherence in documented trades is an empirical observation of past behavior and does not guarantee future trading profits.'
  };
}

/**
 * Generates descriptive observations regarding visual chart evidence.
 */
export function generateVisualJournalObservations(trades = []) {
  const metrics = calculateVisualEvidenceMetrics(trades);
  const cohort = compareVisualAccountabilityCohorts(trades);
  const observations = [];

  if (metrics.totalTrades === 0) {
    return observations;
  }

  // Observation 1: Visual Coverage Rate
  observations.push({
    id: 'visual-coverage-rate',
    title: 'Chart Evidence Documentation Rate',
    sampleSize: metrics.totalTrades,
    eventCount: metrics.tradesWithVisuals,
    percentage: metrics.visualCoveragePercent,
    uncertainty: metrics.visualCoverageCI,
    observation: `Across ${metrics.totalTrades} recorded trades (n = ${metrics.totalTrades}), ${metrics.tradesWithVisuals} (${metrics.visualCoveragePercent.toFixed(1)}% [95% CI: ${metrics.visualCoverageCI.formatted}]) have visual chart attachments.`,
    isPrediction: false
  });

  // Observation 2: Before & After Split Coverage
  if (metrics.tradesWithBeforeAndAfter > 0 || metrics.totalTrades >= 5) {
    observations.push({
      id: 'before-after-coverage',
      title: 'Before/After Planned vs Outcome Coverage',
      sampleSize: metrics.totalTrades,
      eventCount: metrics.tradesWithBeforeAndAfter,
      percentage: metrics.beforeAndAfterPercent,
      uncertainty: metrics.beforeAndAfterCI,
      observation: `${metrics.tradesWithBeforeAndAfter} trades (${metrics.beforeAndAfterPercent.toFixed(1)}% [95% CI: ${metrics.beforeAndAfterCI.formatted}]) feature full dual-chart documentation (Pre-Entry Plan + Execution Outcome).`,
      isPrediction: false
    });
  }

  // Observation 3: Visual Accountability vs Rule Compliance
  if (cohort.documentedCohort.count >= 3 && cohort.undocumentedCohort.count >= 3) {
    observations.push({
      id: 'visual-accountability-compliance',
      title: 'Process Compliance by Visual Documentation',
      sampleSize: metrics.totalTrades,
      documentedCount: cohort.documentedCohort.count,
      undocumentedCount: cohort.undocumentedCohort.count,
      documentedCompliance: cohort.documentedCohort.complianceRate,
      undocumentedCompliance: cohort.undocumentedCohort.complianceRate,
      complianceDelta: cohort.complianceDelta,
      observation: `Trades with chart screenshots had a ${cohort.documentedCohort.complianceRate.toFixed(1)}% process compliance rate (n = ${cohort.documentedCohort.count}), compared to ${cohort.undocumentedCohort.complianceRate.toFixed(1)}% for trades without chart attachments (n = ${cohort.undocumentedCohort.count}).`,
      isPrediction: false
    });
  }

  return observations;
}
