/**
 * Rapid Broker Order Text Parser & Quick Ingest Engine
 * Ledger & Wick — Archival Trading Journal
 *
 * Parses raw copied executions, fills, and deal history from major trading platforms:
 * 1. Tradovate & NinjaTrader (Orders / Fills log)
 * 2. Interactive Brokers (TWS / Client Portal / Activity statement rows)
 * 3. MetaTrader 4 & 5 (Account History rows, deal logs)
 * 4. Thinkorswim (Schwab / TD Ameritrade filled orders)
 * 5. TradingView (Paper & Broker execution logs)
 * 6. Generic tabular / whitespace / roundtrip order summaries
 *
 * Automatically:
 * - Pairs opening & closing fills (BUY/SELL -> LONG; SELL/BUY -> SHORT)
 * - Computes gross P&L, fees, and net P&L with instrument-aware tick values
 * - Classifies market trading session block (London, NY AM, NY PM, Asian)
 * - Tags provenance as verified imported data (TRADE_SOURCES.BROKER_IMPORT)
 */

import { normalizeNumber, normalizeDirection, generateTradeHash } from './csv-parser.js';
import { getInstrumentSpec, FUTURES_SPECS, FOREX_SPECS, CRYPTO_SPECS } from './sizing.js';
import { classifySessionBlock } from './calendar-heatmap.js';
import { TRADE_SOURCES } from './trade-provenance.js';

export const SUPPORTED_BROKERS = Object.freeze({
  TRADOVATE_NINJA: Object.freeze({
    id: 'TRADOVATE_NINJA',
    label: 'Tradovate / NinjaTrader',
    icon: '⚡'
  }),
  INTERACTIVE_BROKERS: Object.freeze({
    id: 'INTERACTIVE_BROKERS',
    label: 'Interactive Brokers (IBKR)',
    icon: '🏛️'
  }),
  METATRADER: Object.freeze({
    id: 'METATRADER',
    label: 'MetaTrader 4 / 5',
    icon: '📊'
  }),
  THINKORSWIM: Object.freeze({
    id: 'THINKORSWIM',
    label: 'Thinkorswim / Schwab',
    icon: '🟢'
  }),
  TRADINGVIEW: Object.freeze({
    id: 'TRADINGVIEW',
    label: 'TradingView Executions',
    icon: '📈'
  }),
  GENERIC: Object.freeze({
    id: 'GENERIC',
    label: 'Generic Execution Log',
    icon: '📋'
  })
});

/**
 * Infers the market asset class from the ticker symbol.
 */
export function inferAssetClassFromSymbol(symbol) {
  const clean = String(symbol || '').toUpperCase().trim();
  if (FUTURES_SPECS[clean]) return 'FUTURES';
  if (FOREX_SPECS[clean] || (clean.length === 6 && /^(EUR|GBP|AUD|NZD|USD|CAD|CHF|JPY){2}$/.test(clean))) return 'FOREX';
  if (CRYPTO_SPECS[clean] || clean.startsWith('BTC') || clean.startsWith('ETH') || clean.startsWith('SOL')) return 'CRYPTO';
  return 'EQUITY';
}

/**
 * Strips contract expiration suffixes (e.g. NQU6, ESU26, ES 09-26 -> NQ, ES)
 * while preserving the full root symbol.
 */
export function normalizeContractSymbol(rawSymbol) {
  if (!rawSymbol) return 'UNKNOWN';
  let clean = String(rawSymbol).trim().toUpperCase();

  // Remove spaces and common punctuation: /ES -> ES, EUR/USD -> EURUSD, ES 09-26 -> ES0926
  clean = clean.replace(/[\s/_.-]/g, '');

  // Check known futures roots
  const futuresRoots = Object.keys(FUTURES_SPECS);
  for (const root of futuresRoots) {
    if (clean === root) return root;
    // Matches NQU6, NQU26, NQ0926, NQZ6, ES0926, etc.
    const regex = new RegExp(`^${root}[FGHJKMNQUVXZ]\\d{1,2}$|^${root}\\d{2,4}$`, 'i');
    if (regex.test(clean)) {
      return root;
    }
  }

  // Remove broker suffixes like .pro, .raw, .p (e.g. EURUSDpro -> EURUSD)
  clean = clean.replace(/(PRO|RAW|ECN|STD|MICRO)$/i, '');

  return clean;
}

/**
 * Detects probable broker source based on text heuristics and syntax keywords.
 */
export function detectBrokerFormat(rawText) {
  if (!rawText || typeof rawText !== 'string') return SUPPORTED_BROKERS.GENERIC;
  const upper = rawText.toUpperCase();

  // Check Thinkorswim signed qty (+50 / -50) first
  if (upper.includes('THINKORSWIM') || /\bFILLED\s+(?:BUY|SELL)\s+[+-]\d+/i.test(rawText) || /\b(?:BOT|SLD)\s+[+-]\d+/i.test(rawText)) {
    return SUPPORTED_BROKERS.THINKORSWIM;
  }
  if (upper.includes('TRADOVATE') || upper.includes('NINJATRADER') || /FILLED\s+(BUY|SELL)/i.test(rawText) || /FILL:\s+(BUY|SELL)/i.test(rawText)) {
    return SUPPORTED_BROKERS.TRADOVATE_NINJA;
  }
  if (/\b(BOT|SLD)\b/.test(upper) || upper.includes('IDEALPRO') || upper.includes('GLOBEX') || upper.includes('ARCA') || upper.includes('IBKR')) {
    return SUPPORTED_BROKERS.INTERACTIVE_BROKERS;
  }
  if (/\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}/.test(rawText) || upper.includes('SWAP') || /#\d{7,10}/.test(rawText) || upper.includes('PROFIT:')) {
    return SUPPORTED_BROKERS.METATRADER;
  }
  if (upper.includes('TRADINGVIEW') || /BUY\s+MARKET/i.test(rawText) || /SELL\s+MARKET/i.test(rawText) || /EXECUTED\s+AT/i.test(rawText)) {
    return SUPPORTED_BROKERS.TRADINGVIEW;
  }

  return SUPPORTED_BROKERS.GENERIC;
}

/**
 * Normalizes an extracted date and time into an ISO UTC string.
 */
export function normalizeExecutionTimestamp(rawDate, rawTime = '') {
  const now = new Date();
  const defaultDateStr = now.toISOString().slice(0, 10);

  if (!rawDate && !rawTime) {
    return now.toISOString();
  }

  let fullStr = `${rawDate || ''} ${rawTime || ''}`.trim();

  // If only time was provided (HH:MM:SS or HH:MM)
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(fullStr)) {
    fullStr = `${defaultDateStr} ${fullStr}`;
  }

  // Handle MetaTrader dot format: 2026.09.22 -> 2026-09-22
  fullStr = fullStr.replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3');

  // Handle US slash format: MM/DD/YYYY -> YYYY-MM-DD
  fullStr = fullStr.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/, (m, month, day, yr) => {
    return `${yr}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  });

  const parsed = new Date(fullStr.includes('T') ? fullStr : fullStr.replace(' ', 'T') + (fullStr.endsWith('Z') ? '' : 'Z'));
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const fallback = new Date(fullStr);
  return !isNaN(fallback.getTime()) ? fallback.toISOString() : now.toISOString();
}

/**
 * Extracts date and time anywhere in a line of text.
 */
function extractLineTimestamp(line) {
  const dateMatch = line.match(/\b(\d{4}[-./]\d{2}[-./]\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b/);
  const timeMatch = line.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
  return normalizeExecutionTimestamp(dateMatch ? dateMatch[1] : '', timeMatch ? timeMatch[1] : '');
}

/**
 * Parses individual fill executions from raw lines of text.
 */
export function extractExecutionFills(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const fills = [];

  for (const line of lines) {
    // Skip obvious table headers
    if (/^(DATE|TIME|SYMBOL|TICKER|ACTION|SIDE|PRICE|QTY|QUANTITY|ORDER|ID)\b/i.test(line) && line.split(/\s+|\t/).length > 3) {
      continue;
    }

    const timestamp = extractLineTimestamp(line);
    let parsed = null;

    // 1. Tradovate / NinjaTrader Fills
    // e.g. "Filled Buy 1 NQU6 @ 19850.50 09/22/2026 09:35:12 Fee: 1.35"
    // e.g. "Fill: Buy 2 ES @ 5025.25 at 2026-09-22 14:30:00"
    const tvRegex = /(?:Fill(?:ed)?[:\s]+)?(BUY|SELL|BOT|SLD)\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/.-]+)(?:\s+@|\s+at|\s+price[:\s]+)?\s+([0-9,.]+)/i;
    const tvMatch = line.match(tvRegex);

    if (tvMatch) {
      const rawSide = tvMatch[1];
      const qty = normalizeNumber(tvMatch[2]);
      const rawSym = tvMatch[3];
      const price = normalizeNumber(tvMatch[4]);

      const feeMatch = line.match(/(?:fee|comm|commission)[:\s]+[$€£]?([0-9,.]+)/i);
      const fee = feeMatch ? normalizeNumber(feeMatch[1]) : 0;

      const slMatch = line.match(/(?:sl|stop)[:\s]+([0-9,.]+)/i);
      const tpMatch = line.match(/(?:tp|target)[:\s]+([0-9,.]+)/i);

      if (price > 0 && qty > 0) {
        parsed = {
          rawLine: line,
          side: normalizeDirection(rawSide) === 'LONG' ? 'BUY' : 'SELL',
          quantity: qty,
          rawSymbol: rawSym,
          symbol: normalizeContractSymbol(rawSym),
          price,
          timestamp,
          commission: fee,
          stopLoss: slMatch ? normalizeNumber(slMatch[1]) : null,
          takeProfit: tpMatch ? normalizeNumber(tpMatch[1]) : null
        };
      }
    }

    // 2. Interactive Brokers (TWS / Log Fills)
    // e.g. "2026-09-22 14:35:00 SLD 100 NVDA @ 125.00 Comm: 1.00"
    if (!parsed) {
      const ibkrRegex = /(BOT|SLD|BUY|SELL)\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/.-]+)\s+@\s+([0-9,.]+)/i;
      const ibMatch = line.match(ibkrRegex);

      if (ibMatch) {
        const rawSide = ibMatch[1];
        const qty = normalizeNumber(ibMatch[2]);
        const rawSym = ibMatch[3];
        const price = normalizeNumber(ibMatch[4]);

        const commMatch = line.match(/(?:comm|commission|fee)[:\s]+[$€£]?([0-9,.]+)/i);
        const comm = commMatch ? normalizeNumber(commMatch[1]) : 0;

        if (price > 0 && qty > 0) {
          parsed = {
            rawLine: line,
            side: normalizeDirection(rawSide) === 'LONG' ? 'BUY' : 'SELL',
            quantity: qty,
            rawSymbol: rawSym,
            symbol: normalizeContractSymbol(rawSym),
            price,
            timestamp,
            commission: comm
          };
        }
      }
    }

    // 3. MetaTrader 4 / MetaTrader 5 Deal History Log
    // e.g. "2026.09.22 14:15:00 buy 0.50 EURUSD 1.08500 sl: 1.0830 tp: 1.0895"
    if (!parsed) {
      const mtRegex = /(buy|sell|close)\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/._-]+)\s+([0-9,.]+)/i;
      const mtMatch = line.match(mtRegex);

      if (mtMatch) {
        const action = mtMatch[1].toLowerCase();
        const qty = normalizeNumber(mtMatch[2]);
        const rawSym = mtMatch[3];
        const price = normalizeNumber(mtMatch[4]);

        const slMatch = line.match(/(?:sl|stop)[:\s]+([0-9,.]+)/i);
        const tpMatch = line.match(/(?:tp|target)[:\s]+([0-9,.]+)/i);
        const profitMatch = line.match(/(?:profit)[:\s]+([-0-9,.]+)/i);
        const commMatch = line.match(/(?:commission|fee)[:\s]+([-0-9,.]+)/i);

        if (price > 0 && qty > 0) {
          parsed = {
            rawLine: line,
            side: action === 'buy' ? 'BUY' : (action === 'sell' ? 'SELL' : 'CLOSE'),
            quantity: qty,
            rawSymbol: rawSym,
            symbol: normalizeContractSymbol(rawSym),
            price,
            timestamp,
            commission: commMatch ? Math.abs(normalizeNumber(commMatch[1])) : 0,
            stopLoss: slMatch ? normalizeNumber(slMatch[1]) : null,
            takeProfit: tpMatch ? normalizeNumber(tpMatch[1]) : null,
            explicitProfit: profitMatch ? normalizeNumber(profitMatch[1]) : null
          };
        }
      }
    }

    // 4. Thinkorswim (Filled BUY +50 NVDA @ 122.50)
    if (!parsed) {
      const tosRegex = /(?:Filled\s+)?(BUY|SELL|BOT|SLD)\s+([+-]?\d+(?:\.\d+)?)\s+([A-Z0-9/.-]+)\s+@?\s*([0-9,.]+)/i;
      const tosMatch = line.match(tosRegex);

      if (tosMatch) {
        const rawSide = tosMatch[1];
        const qty = Math.abs(normalizeNumber(tosMatch[2]));
        const rawSym = tosMatch[3];
        const price = normalizeNumber(tosMatch[4]);

        if (price > 0 && qty > 0) {
          parsed = {
            rawLine: line,
            side: normalizeDirection(rawSide) === 'LONG' ? 'BUY' : 'SELL',
            quantity: qty,
            rawSymbol: rawSym,
            symbol: normalizeContractSymbol(rawSym),
            price,
            timestamp,
            commission: 0
          };
        }
      }
    }

    // 5. Generic Tabular / Whitespace-separated fills (Symbol, Side, Price, Qty, Date, Time)
    if (!parsed) {
      const parts = line.split(/[\t,|;]+|\s{2,}/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        let symCandidate = null;
        let sideCandidate = null;
        let priceCandidate = null;
        let qtyCandidate = null;

        for (const p of parts) {
          const u = p.toUpperCase();
          if (u === 'BUY' || u === 'BOT' || u === 'LONG') sideCandidate = 'BUY';
          else if (u === 'SELL' || u === 'SLD' || u === 'SHORT') sideCandidate = 'SELL';
          else if (/^[A-Z0-9/.-]{1,10}$/.test(p) && isNaN(Number(p)) && !symCandidate && !/^\d{4}[-./]\d{2}/.test(p)) symCandidate = p;
          else if (!isNaN(Number(p)) && Number(p) > 0) {
            if (!priceCandidate && (p.includes('.') || Number(p) > 50)) {
              priceCandidate = Number(p);
            } else if (!qtyCandidate) {
              qtyCandidate = Number(p);
            }
          }
        }

        if (symCandidate && sideCandidate && priceCandidate) {
          parsed = {
            rawLine: line,
            side: sideCandidate,
            quantity: qtyCandidate || 1,
            rawSymbol: symCandidate,
            symbol: normalizeContractSymbol(symCandidate),
            price: priceCandidate,
            timestamp,
            commission: 0
          };
        }
      }
    }

    if (parsed) {
      fills.push(parsed);
    }
  }

  return fills;
}

/**
 * Checks if the text contains a complete roundtrip summary on a single line or block.
 * e.g. "Long 1 NQ Entry: 19850.50 Exit: 19910.00 PnL: +$1,190.00 Fees: $4.10 Date: 2026-09-22"
 */
export function parseSingleRoundtripSummary(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // Single MT4 history row check:
  // e.g. 2026.09.22 14:15:00 buy 0.50 EURUSD 1.08500 1.08300 1.08950 2026.09.22 16:30:00 1.08920 -3.50 0.00 210.00
  const mtHistoryRegex = /(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}(?::\d{2})?)\s+(buy|sell)\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/._-]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}(?::\d{2})?)\s+([0-9,.]+)\s+([-0-9,.]+)\s+([-0-9,.]+)\s+([-0-9,.]+)/i;
  const mtMatch = rawText.match(mtHistoryRegex);
  if (mtMatch) {
    const entryDate = normalizeExecutionTimestamp(mtMatch[1]);
    const direction = normalizeDirection(mtMatch[2]);
    const quantity = normalizeNumber(mtMatch[3]);
    const rawSym = mtMatch[4];
    const entryPrice = normalizeNumber(mtMatch[5]);
    const stopLoss = normalizeNumber(mtMatch[6]);
    const takeProfit = normalizeNumber(mtMatch[7]);
    const exitDate = normalizeExecutionTimestamp(mtMatch[8]);
    const exitPrice = normalizeNumber(mtMatch[9]);
    const fees = Math.abs(normalizeNumber(mtMatch[10]));
    const netPnL = normalizeNumber(mtMatch[12]);

    const symbol = normalizeContractSymbol(rawSym);
    const assetClass = inferAssetClassFromSymbol(symbol);
    const spec = getInstrumentSpec(symbol, assetClass, entryPrice);

    let plannedRisk = 100;
    if (stopLoss > 0 && entryPrice > 0) {
      plannedRisk = Math.round(Math.abs(entryPrice - stopLoss) * quantity * (spec.pointMultiplier || 1) * 100) / 100;
    }

    return constructTradeRecord({
      symbol,
      direction,
      entryDate,
      exitDate,
      entryPrice,
      exitPrice,
      quantity,
      stopLoss,
      takeProfit,
      fees,
      netPnL,
      plannedRisk
    });
  }

  // Generic key-value summary: Entry:, Exit:, Symbol:, Direction:
  const hasEntry = /(?:entry|open|buy|in)[:\s]+([0-9,.]+)/i.test(rawText);
  const hasExit = /(?:exit|close|out)[:\s]+([0-9,.]+)/i.test(rawText);

  if (hasEntry && hasExit) {
    const symMatch = rawText.match(/(?:symbol|ticker|contract|instrument)[:\s]+([A-Z0-9/.-]+)/i) || rawText.match(/\b([A-Z]{2,6}(?:USD|JPY|GBP|EUR)?)\b/);
    const dirMatch = rawText.match(/\b(LONG|SHORT|BUY|SELL)\b/i);
    const entryMatch = rawText.match(/(?:entry|open|bought|sold|at)[:\s]+([0-9,.]+)/i);
    const exitMatch = rawText.match(/(?:exit|close|closed|out)[:\s]+([0-9,.]+)/i);
    const qtyMatch = rawText.match(/(?:qty|quantity|size|shares|lots)[:\s]+([0-9,.]+)/i);
    const pnlMatch = rawText.match(/(?:pnl|profit|net)[:\s]+[$€£]?([-+0-9,.]+)/i);
    const feeMatch = rawText.match(/(?:fees?|comm|commission)[:\s]+[$€£]?([0-9,.]+)/i);
    const slMatch = rawText.match(/(?:sl|stop)[:\s]+([0-9,.]+)/i);
    const tpMatch = rawText.match(/(?:tp|target)[:\s]+([0-9,.]+)/i);
    const dateMatch = rawText.match(/(\d{4}[-./]\d{2}[-./]\d{2}(?:\s+\d{2}:\d{2})?)/);

    const symbol = normalizeContractSymbol(symMatch ? symMatch[1] : 'UNKNOWN');
    const direction = normalizeDirection(dirMatch ? dirMatch[1] : 'LONG');
    const entryPrice = entryMatch ? normalizeNumber(entryMatch[1]) : 0;
    const exitPrice = exitMatch ? normalizeNumber(exitMatch[1]) : 0;
    const quantity = qtyMatch ? normalizeNumber(qtyMatch[1]) : 1;
    const fees = feeMatch ? normalizeNumber(feeMatch[1]) : 0;
    const explicitPnL = pnlMatch ? normalizeNumber(pnlMatch[1]) : null;
    const stopLoss = slMatch ? normalizeNumber(slMatch[1]) : 0;
    const takeProfit = tpMatch ? normalizeNumber(tpMatch[1]) : 0;
    const dateVal = dateMatch ? normalizeExecutionTimestamp(dateMatch[1]) : new Date().toISOString();

    if (entryPrice > 0 && exitPrice > 0) {
      const assetClass = inferAssetClassFromSymbol(symbol);
      const spec = getInstrumentSpec(symbol, assetClass, entryPrice);
      let netPnL = explicitPnL;
      if (netPnL === null) {
        const mult = direction === 'LONG' ? 1 : -1;
        netPnL = ((exitPrice - entryPrice) * mult * quantity * (spec.pointMultiplier || 1)) - fees;
      }

      let plannedRisk = 100;
      if (stopLoss > 0) {
        plannedRisk = Math.abs(entryPrice - stopLoss) * quantity * (spec.pointMultiplier || 1);
      }

      return constructTradeRecord({
        symbol,
        direction,
        entryDate: dateVal,
        exitDate: dateVal,
        entryPrice,
        exitPrice,
        quantity,
        stopLoss,
        takeProfit,
        fees,
        netPnL: Math.round(netPnL * 100) / 100,
        plannedRisk: Math.round(plannedRisk * 100) / 100
      });
    }
  }

  return null;
}

/**
 * Pairs extracted fills into completed roundtrip trade records.
 */
export function pairExecutionsIntoTrades(fills = []) {
  if (!Array.isArray(fills) || fills.length === 0) return { trades: [], unpairedFills: [] };

  // Sort chronologically
  const sortedFills = [...fills].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const trades = [];
  const unpaired = [];

  // Group by symbol
  const bySymbol = {};
  sortedFills.forEach(fill => {
    if (!bySymbol[fill.symbol]) bySymbol[fill.symbol] = [];
    bySymbol[fill.symbol].push(fill);
  });

  Object.entries(bySymbol).forEach(([symbol, symbolFills]) => {
    let openFill = null;

    for (const fill of symbolFills) {
      if (!openFill) {
        // Open a new position
        openFill = fill;
      } else {
        // Check if current fill is opposite side (closing)
        const isClosing = (openFill.side === 'BUY' && (fill.side === 'SELL' || fill.side === 'CLOSE'))
          || (openFill.side === 'SELL' && (fill.side === 'BUY' || fill.side === 'CLOSE'));

        if (isClosing) {
          // Construct roundtrip trade
          const direction = openFill.side === 'BUY' ? 'LONG' : 'SHORT';
          const entryPrice = openFill.price;
          const exitPrice = fill.price;
          const entryDate = openFill.timestamp;
          const exitDate = fill.timestamp;
          const quantity = Math.min(openFill.quantity, fill.quantity);
          const fees = Math.round(((openFill.commission || 0) + (fill.commission || 0)) * 100) / 100;

          // Instrument specs & PnL calculation
          const assetClass = inferAssetClassFromSymbol(symbol);
          const spec = getInstrumentSpec(symbol, assetClass, entryPrice);
          const mult = direction === 'LONG' ? 1 : -1;
          const pointMult = spec.pointMultiplier || 1;

          let netPnL = fill.explicitProfit !== null && fill.explicitProfit !== undefined
            ? fill.explicitProfit
            : ((exitPrice - entryPrice) * mult * quantity * pointMult) - fees;

          netPnL = Math.round(netPnL * 100) / 100;

          // Stop loss and planned risk
          const stopLoss = openFill.stopLoss || fill.stopLoss || 0;
          const takeProfit = openFill.takeProfit || fill.takeProfit || 0;
          let plannedRisk = 100;
          if (stopLoss > 0) {
            plannedRisk = Math.abs(entryPrice - stopLoss) * quantity * pointMult;
          }
          plannedRisk = Math.round(plannedRisk * 100) / 100;

          const trade = constructTradeRecord({
            symbol,
            direction,
            entryDate,
            exitDate,
            entryPrice,
            exitPrice,
            quantity,
            stopLoss,
            takeProfit,
            fees,
            netPnL,
            plannedRisk
          });

          trades.push(trade);
          openFill = null; // Position closed
        } else {
          // Same side execution (scaling in or unclosed fill)
          unpaired.push(openFill);
          openFill = fill;
        }
      }
    }

    if (openFill) {
      unpaired.push(openFill);
    }
  });

  return { trades, unpairedFills: unpaired };
}

/**
 * Builds a standardized trade record conforming to Ledger & Wick core schema.
 */
function constructTradeRecord({
  symbol,
  direction,
  entryDate,
  exitDate,
  entryPrice,
  exitPrice,
  quantity,
  stopLoss = 0,
  takeProfit = 0,
  fees = 0,
  netPnL = 0,
  plannedRisk = 100
}) {
  const assetClass = inferAssetClassFromSymbol(symbol);
  const spec = getInstrumentSpec(symbol, assetClass, entryPrice);
  const sessionBlock = classifySessionBlock(entryDate);
  const rMultiple = plannedRisk > 0 ? Math.round((netPnL / plannedRisk) * 100) / 100 : 0;

  const baseTrade = {
    symbol: symbol.toUpperCase(),
    assetClass: spec.assetClass || assetClass || 'EQUITY',
    direction,
    entryDate,
    exitDate: exitDate || entryDate,
    entryPrice: Number(entryPrice),
    exitPrice: Number(exitPrice),
    quantity: Number(quantity) || 1,
    stopLoss: Number(stopLoss) || 0,
    takeProfit: Number(takeProfit) || 0,
    fees: Number(fees) || 0,
    netPnL: Number(netPnL),
    plannedRiskDollars: Number(plannedRisk) || 100,
    rMultiple,
    session: sessionBlock.id,
    sessionLabel: sessionBlock.label,
    setupId: 'DISCRETIONARY',
    notes: `Imported via Quick Ingest Box (${sessionBlock.label})`,
    violations: [],
    rulesFollowed: {
      entry: true,
      stop: true,
      target: true,
      exit: true
    },
    isFullyCompliant: true,
    source: TRADE_SOURCES.BROKER_IMPORT
  };

  baseTrade.id = generateTradeHash(baseTrade);
  return baseTrade;
}

/**
 * Master parse function: accepts raw copied text, detects broker format,
 * parses fills or roundtrips, pairs executions, and generates draft trades.
 *
 * @param {string} rawText - Unstructured broker order/fill text
 * @param {Object} options - Configuration options
 * @returns {Object} Parse result summary with draft trades
 */
export function parseBrokerOrderText(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return {
      success: false,
      detectedBroker: SUPPORTED_BROKERS.GENERIC,
      fillCount: 0,
      trades: [],
      unpairedFills: [],
      warnings: ['No order text provided.'],
      confidence: 0.0
    };
  }

  const detectedBroker = detectBrokerFormat(rawText);
  const warnings = [];

  // 1. Try single-line or key-value roundtrip summary first
  const singleRoundtrip = parseSingleRoundtripSummary(rawText);
  if (singleRoundtrip) {
    return {
      success: true,
      detectedBroker,
      fillCount: 2,
      trades: [singleRoundtrip],
      unpairedFills: [],
      warnings: [],
      confidence: 0.95
    };
  }

  // 2. Extract discrete execution fills
  const fills = extractExecutionFills(rawText);

  if (fills.length === 0) {
    return {
      success: false,
      detectedBroker,
      fillCount: 0,
      trades: [],
      unpairedFills: [],
      warnings: ['Could not detect any valid execution fills. Ensure text contains symbol, side, price, and quantity.'],
      confidence: 0.0
    };
  }

  // 3. Pair fills into completed roundtrip trades
  const { trades, unpairedFills } = pairExecutionsIntoTrades(fills);

  if (unpairedFills.length > 0) {
    warnings.push(`${unpairedFills.length} execution fill(s) could not be paired into a closed roundtrip trade (e.g. open positions or unmatched sides).`);
  }

  const confidence = trades.length > 0
    ? (unpairedFills.length === 0 ? 0.95 : 0.80)
    : 0.30;

  return {
    success: trades.length > 0,
    detectedBroker,
    fillCount: fills.length,
    trades,
    unpairedFills,
    warnings,
    confidence
  };
}
