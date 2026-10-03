/**
 * CSV Import, Normalization, and Deduplication Engine
 */

// Universal column synonyms mapped to canonical fields
export const COLUMN_SYNONYMS = {
  symbol: ['symbol', 'ticker', 'instrument', 'asset', 'contract', 'item'],
  direction: ['direction', 'side', 'type', 'action', 'bs', 'b/s'],
  entryDate: ['entrydate', 'opentime', 'open_time', 'entry_time', 'date', 'datetime', 'time'],
  exitDate: ['exitdate', 'closetime', 'close_time', 'exit_time'],
  entryPrice: ['entryprice', 'openprice', 'open_price', 'entry_price', 'price', 'fillprice'],
  exitPrice: ['exitprice', 'closeprice', 'close_price', 'exit_price'],
  quantity: ['quantity', 'qty', 'size', 'lots', 'contracts', 'shares', 'volume', 'amount'],
  stopLoss: ['stoploss', 'sl', 'stop_loss', 'stop', 's/l'],
  takeProfit: ['takeprofit', 'tp', 'take_profit', 'target', 't/p'],
  netPnL: ['netpnl', 'pnl', 'profit', 'net_profit', 'gain_loss', 'realized_pnl', 'realizedpnl'],
  fees: ['fees', 'fee', 'commission', 'comm', 'swap', 'taxes'],
  plannedRisk: ['plannedrisk', 'risk', 'planned_risk', 'initial_risk']
};

/**
 * Robust number parsing handling European decimals (1.250,50), US decimals (1,250.50),
 * negative parentheses (150.00), and currency symbols.
 */
export function normalizeNumber(raw) {
  if (typeof raw === 'number') return raw;
  if (!raw || typeof raw !== 'string') return 0;

  let clean = raw.trim().replace(/[$€£¥\s]/g, '');

  // Accounting negative notation: (123.45) -> -123.45
  if (clean.startsWith('(') && clean.endsWith(')')) {
    clean = '-' + clean.slice(1, -1);
  }

  // Detect and resolve thousands vs decimal separators
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      // European notation: 1.250,50 -> 1250.50
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // US notation: 1,250.50 -> 1250.50
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    // Only comma present, check if it acts as decimal or thousands
    const parts = clean.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal comma (e.g. 150,5 or 150,50)
      clean = clean.replace(',', '.');
    } else {
      // Thousands comma (e.g. 1,000)
      clean = clean.replace(/,/g, '');
    }
  }

  const result = parseFloat(clean);
  return isNaN(result) ? 0 : result;
}

/**
 * Normalizes trading direction strings (BUY, LONG, B, 1 -> LONG; SELL, SHORT, S, -1 -> SHORT)
 */
export function normalizeDirection(raw) {
  if (!raw) return 'LONG';
  const val = String(raw).trim().toUpperCase();
  if (val === 'BUY' || val === 'LONG' || val === 'B' || val === '1' || val === 'BOT') {
    return 'LONG';
  }
  if (val === 'SELL' || val === 'SHORT' || val === 'S' || val === '-1' || val === 'SLD') {
    return 'SHORT';
  }
  return 'LONG';
}

/**
 * Generates a deterministic deduplication hash for a trade row.
 */
export function generateTradeHash(trade) {
  const sym = (trade.symbol || '').toUpperCase().trim();
  const date = (trade.entryDate || '').trim();
  const dir = normalizeDirection(trade.direction);
  const entry = Number(trade.entryPrice || 0).toFixed(4);
  const qty = Number(trade.quantity || 0).toFixed(4);
  return `${sym}_${date}_${dir}_${entry}_${qty}`;
}

/**
 * Parses raw CSV text into an array of lines and cells, respecting double quotes.
 */
export function parseCSVRaw(csvText) {
  const lines = [];
  let currentLine = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // Handle CRLF
      currentLine.push(currentCell.trim());
      if (currentLine.some(cell => cell.length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentLine.length > 0) {
    currentLine.push(currentCell.trim());
    if (currentLine.some(cell => cell.length > 0)) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Maps CSV header names to canonical trade schema keys.
 */
export function detectColumnMapping(headers) {
  const mapping = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  Object.entries(COLUMN_SYNONYMS).forEach(([canonicalKey, synonyms]) => {
    for (let i = 0; i < lowerHeaders.length; i++) {
      const header = lowerHeaders[i];
      if (synonyms.includes(header)) {
        mapping[canonicalKey] = i;
        break;
      }
    }
  });

  return mapping;
}

/**
 * Parses, maps, normalizes, and deduplicates imported trade rows.
 */
export function importTradesFromCSV(csvText, existingTrades = []) {
  const rawRows = parseCSVRaw(csvText);
  if (rawRows.length < 2) {
    return { trades: [], duplicatesSkipped: 0, errors: ['CSV contains insufficient rows.'] };
  }

  const headers = rawRows[0];
  const mapping = detectColumnMapping(headers);

  // Symbol, entryPrice, and netPnL or direction are critical
  if (mapping.symbol === undefined && mapping.entryPrice === undefined) {
    return { trades: [], duplicatesSkipped: 0, errors: ['Could not detect Symbol or Entry Price columns.'] };
  }

  const existingHashes = new Set(existingTrades.map(t => t.id || generateTradeHash(t)));
  const importedTrades = [];
  let duplicatesSkipped = 0;
  const errors = [];

  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
    const row = rawRows[rowIndex];
    if (row.length === 0 || row.every(cell => cell === '')) continue;

    const getValue = (canonicalKey) => {
      const colIdx = mapping[canonicalKey];
      return colIdx !== undefined && colIdx < row.length ? row[colIdx] : '';
    };

    const symbol = getValue('symbol') || 'UNKNOWN';
    const direction = normalizeDirection(getValue('direction'));
    const entryDate = getValue('entryDate') || new Date().toISOString();
    const exitDate = getValue('exitDate') || entryDate;
    const entryPrice = normalizeNumber(getValue('entryPrice'));
    const exitPrice = normalizeNumber(getValue('exitPrice'));
    const quantity = normalizeNumber(getValue('quantity')) || 1;
    const stopLoss = normalizeNumber(getValue('stopLoss'));
    const takeProfit = normalizeNumber(getValue('takeProfit'));
    const fees = normalizeNumber(getValue('fees'));
    let netPnL = normalizeNumber(getValue('netPnL'));

    // Infer netPnL if exitPrice is available but netPnL was missing
    if (netPnL === 0 && exitPrice > 0 && entryPrice > 0) {
      const mult = direction === 'LONG' ? 1 : -1;
      netPnL = ((exitPrice - entryPrice) * mult * quantity) - fees;
    }

    // Determine planned risk
    let plannedRisk = normalizeNumber(getValue('plannedRisk'));
    if (plannedRisk <= 0 && stopLoss > 0 && entryPrice > 0) {
      plannedRisk = Math.abs(entryPrice - stopLoss) * quantity;
    }
    if (plannedRisk <= 0) {
      plannedRisk = 100; // Baseline default if not specified
    }

    const tradeObj = {
      symbol: symbol.toUpperCase(),
      direction,
      entryDate,
      exitDate,
      entryPrice,
      exitPrice,
      quantity,
      stopLoss,
      takeProfit,
      fees,
      netPnL: Math.round(netPnL * 100) / 100,
      plannedRiskDollars: Math.round(plannedRisk * 100) / 100,
      rMultiple: Math.round((netPnL / plannedRisk) * 100) / 100,
      violations: [],
      source: 'CSV_IMPORT'
    };

    const hash = generateTradeHash(tradeObj);
    tradeObj.id = hash;

    if (existingHashes.has(hash)) {
      duplicatesSkipped++;
    } else {
      existingHashes.add(hash);
      importedTrades.push(tradeObj);
    }
  }

  return {
    trades: importedTrades,
    duplicatesSkipped,
    errors
  };
}
