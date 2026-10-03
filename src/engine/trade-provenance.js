export const TRADE_CATEGORIES = Object.freeze({
  PERSONAL: 'PERSONAL',
  IMPORTED: 'IMPORTED',
  SIMULATED: 'SIMULATED',
  SAMPLE: 'SAMPLE'
});

export const TRADE_SOURCES = Object.freeze({
  MANUAL: 'MANUAL',
  PERSONAL: 'PERSONAL',
  DEMO_PRACTICE: 'DEMO_PRACTICE',
  SIMULATED: 'SIMULATED',
  CSV_IMPORT: 'CSV_IMPORT',
  BROKER_IMPORT: 'BROKER_IMPORT',
  IMPORTED: 'IMPORTED',
  SAMPLE: 'SAMPLE',
  LEGACY: 'LEGACY_UNKNOWN'
});

export function normalizeTradeSource(source) {
  const normalized = String(source || '').trim().toUpperCase();
  if (normalized === 'DEMO') return TRADE_SOURCES.DEMO_PRACTICE;
  if (normalized === 'CSV') return TRADE_SOURCES.CSV_IMPORT;
  if (normalized === 'BROKER') return TRADE_SOURCES.BROKER_IMPORT;
  return Object.values(TRADE_SOURCES).includes(normalized) ? normalized : TRADE_SOURCES.LEGACY;
}

export function isSampleTrade(trade) {
  const norm = normalizeTradeSource(trade?.source);
  return norm === TRADE_SOURCES.SAMPLE || String(trade?.executionMode || '').toUpperCase() === 'SAMPLE';
}

export function isSimulatedTrade(trade) {
  const norm = normalizeTradeSource(trade?.source);
  const mode = String(trade?.executionMode || '').toUpperCase();
  return norm === TRADE_SOURCES.DEMO_PRACTICE
    || norm === TRADE_SOURCES.SIMULATED
    || mode === 'DEMO'
    || mode === 'SIMULATED';
}

// Backward-compatible alias
export const isDemoTrade = isSimulatedTrade;

export function isImportedTrade(trade) {
  const norm = normalizeTradeSource(trade?.source);
  return norm === TRADE_SOURCES.CSV_IMPORT
    || norm === TRADE_SOURCES.BROKER_IMPORT
    || norm === TRADE_SOURCES.IMPORTED;
}

export function isPersonalTrade(trade) {
  return !isSampleTrade(trade) && !isSimulatedTrade(trade) && !isImportedTrade(trade);
}

export function getTradeCategory(trade) {
  if (isSampleTrade(trade)) return TRADE_CATEGORIES.SAMPLE;
  if (isSimulatedTrade(trade)) return TRADE_CATEGORIES.SIMULATED;
  if (isImportedTrade(trade)) return TRADE_CATEGORIES.IMPORTED;
  return TRADE_CATEGORIES.PERSONAL;
}

export function getTradeSourceLabel(trade) {
  const source = normalizeTradeSource(trade?.source);
  const labels = {
    MANUAL: 'PERSONAL',
    PERSONAL: 'PERSONAL',
    CSV_IMPORT: 'IMPORTED (CSV)',
    BROKER_IMPORT: 'IMPORTED (BROKER)',
    IMPORTED: 'IMPORTED',
    DEMO_PRACTICE: 'SIMULATED (DEMO)',
    SIMULATED: 'SIMULATED',
    SAMPLE: 'SAMPLE EXAMPLE',
    LEGACY_UNKNOWN: 'LEGACY'
  };
  return labels[source] || source;
}

export function getTradeSourceBadgeClass(trade) {
  const category = getTradeCategory(trade).toLowerCase();
  const source = normalizeTradeSource(trade?.source).toLowerCase();
  return `source-${category} source-${source}`;
}

export function isPerformanceTrade(trade, options = {}) {
  const includeSample = options.includeSample ?? false;
  const includeSimulated = options.includeSimulated ?? false;
  const includeImported = options.includeImported ?? true;
  const includePersonal = options.includePersonal ?? true;

  if (!includeSample && isSampleTrade(trade)) return false;
  if (!includeSimulated && isSimulatedTrade(trade)) return false;
  if (!includeImported && isImportedTrade(trade)) return false;
  if (!includePersonal && isPersonalTrade(trade)) return false;
  return true;
}

export function filterPerformanceTrades(trades = [], options = {}) {
  return (Array.isArray(trades) ? trades : []).filter(t => isPerformanceTrade(t, options));
}

export function filterTradesByCategory(trades = [], category = 'ALL') {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const normalizedCategory = String(category || 'ALL').trim().toUpperCase();
  if (normalizedCategory === 'ALL') return safeTrades;
  if (normalizedCategory === 'SAMPLE') return safeTrades.filter(isSampleTrade);
  if (normalizedCategory === 'SIMULATED' || normalizedCategory === 'DEMO') return safeTrades.filter(isSimulatedTrade);
  if (normalizedCategory === 'IMPORTED') return safeTrades.filter(isImportedTrade);
  if (normalizedCategory === 'PERSONAL') return safeTrades.filter(isPersonalTrade);
  return safeTrades;
}

export function getModeBannerText(mode = 'PERSONAL') {
  const normalized = String(mode || 'PERSONAL').toUpperCase();
  const banners = {
    PERSONAL: 'PERSONAL JOURNAL · Viewing your personal live journal executions. Demo practice and sample records are excluded from your personal performance.',
    IMPORTED: 'IMPORTED TRADES · Viewing records imported from external files or broker platforms. Real imported executions are counted in verified performance; sample data is excluded.',
    SIMULATED: 'SIMULATED / DEMO PRACTICE · Sandbox simulation records for strategy rehearsal. Strictly isolated and excluded from your personal performance reports.',
    DEMO: 'SIMULATED / DEMO PRACTICE · Sandbox simulation records for strategy rehearsal. Strictly isolated and excluded from your personal performance reports.',
    SAMPLE: 'SAMPLE EXAMPLES · Read-only educational reference trades. STRICTLY EXCLUDED from personal performance, win rates, and risk metrics.',
    ALL: 'ALL TRADES VIEW · Showing personal, imported, simulated, and sample records. Note: Performance reports by default strictly calculate verified personal & imported trades.'
  };
  return banners[normalized] || banners.PERSONAL;
}

export function tagTradesWithSource(trades = [], source, executionMode) {
  const normalizedSource = normalizeTradeSource(source);
  let defaultMode = 'JOURNAL';
  if (normalizedSource === TRADE_SOURCES.SAMPLE) defaultMode = 'SAMPLE';
  else if (normalizedSource === TRADE_SOURCES.DEMO_PRACTICE || normalizedSource === TRADE_SOURCES.SIMULATED) defaultMode = 'DEMO';

  return (Array.isArray(trades) ? trades : []).map(trade => ({
    ...trade,
    source: normalizedSource,
    executionMode: executionMode || (normalizedSource === TRADE_SOURCES.DEMO_PRACTICE || normalizedSource === TRADE_SOURCES.SIMULATED ? 'DEMO' : (trade.executionMode || defaultMode))
  }));
}

function sampleFingerprint(trade) {
  return [
    String(trade.id || ''),
    String(trade.symbol || '').toUpperCase(),
    String(trade.entryDate || ''),
    Number(trade.entryPrice || 0),
    Number(trade.quantity || 0),
    Number(trade.netPnL || 0)
  ].join('|');
}

export function tagLegacySampleTrades(trades = [], sampleTrades = []) {
  const sampleFingerprints = new Set(sampleTrades.map(sampleFingerprint));
  return trades.map(trade => {
    const source = normalizeTradeSource(trade.source);
    const isLegacySampleCopy = sampleFingerprints.has(sampleFingerprint(trade))
      && (source === TRADE_SOURCES.LEGACY || source === TRADE_SOURCES.MANUAL || source === TRADE_SOURCES.PERSONAL);
    if (!isLegacySampleCopy) return trade;
    return { ...trade, source: TRADE_SOURCES.SAMPLE, executionMode: 'SAMPLE' };
  });
}