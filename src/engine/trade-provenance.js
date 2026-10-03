export const TRADE_SOURCES = Object.freeze({
  MANUAL: 'MANUAL',
  DEMO_PRACTICE: 'DEMO_PRACTICE',
  CSV_IMPORT: 'CSV_IMPORT',
  BROKER_IMPORT: 'BROKER_IMPORT',
  SAMPLE: 'SAMPLE',
  LEGACY: 'LEGACY_UNKNOWN'
});

export function normalizeTradeSource(source) {
  const normalized = String(source || '').trim().toUpperCase();
  return Object.values(TRADE_SOURCES).includes(normalized) ? normalized : TRADE_SOURCES.LEGACY;
}

export function tagTradesWithSource(trades = [], source) {
  const normalizedSource = normalizeTradeSource(source);
  return (Array.isArray(trades) ? trades : []).map(trade => ({
    ...trade,
    source: normalizedSource,
    executionMode: normalizedSource === TRADE_SOURCES.DEMO_PRACTICE ? 'DEMO' : (trade.executionMode || 'JOURNAL')
  }));
}

export function isSampleTrade(trade) {
  return normalizeTradeSource(trade?.source) === TRADE_SOURCES.SAMPLE;
}

export function isDemoTrade(trade) {
  return normalizeTradeSource(trade?.source) === TRADE_SOURCES.DEMO_PRACTICE
    || String(trade?.executionMode || '').toUpperCase() === 'DEMO';
}

export function isPerformanceTrade(trade) {
  return !isSampleTrade(trade) && !isDemoTrade(trade);
}

export function filterPerformanceTrades(trades = []) {
  return (Array.isArray(trades) ? trades : []).filter(isPerformanceTrade);
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
      && (source === TRADE_SOURCES.LEGACY || source === TRADE_SOURCES.MANUAL);
    if (!isLegacySampleCopy) return trade;
    return { ...trade, source: TRADE_SOURCES.SAMPLE, executionMode: 'SAMPLE' };
  });
}