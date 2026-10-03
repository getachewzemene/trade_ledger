/**
 * SVG Diagram Generation Engine for Price Action Lessons & Trade Charts
 * Styled with Paper Ledger aesthetic: parchment surfaces, ink lines, and wax stamps.
 */

export function renderCandlestickDiagram() {
  return `
  <svg viewBox="0 0 760 320" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EB; font-family:'JetBrains Mono',monospace;">
    <defs>
      <pattern id="ledgerGrid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E0D0" stroke-width="0.8"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="#F7F4EB"/>
    <rect width="100%" height="100%" fill="url(#ledgerGrid)"/>

    <!-- Section 1: Standard Candlestick Anatomy -->
    <g transform="translate(40, 20)">
      <text x="70" y="25" fill="#1A1816" font-size="14" font-weight="bold" text-anchor="middle">Candle Anatomy</text>
      
      <!-- Upper Wick -->
      <line x1="70" y1="45" x2="70" y2="85" stroke="#1F5C3E" stroke-width="2.5"/>
      <!-- Body -->
      <rect x="45" y="85" width="50" height="110" fill="#1F5C3E" rx="2"/>
      <!-- Lower Wick -->
      <line x1="70" y1="195" x2="70" y2="245" stroke="#1F5C3E" stroke-width="2.5"/>
      
      <!-- Annotation pointers -->
      <text x="135" y="50" fill="#4A453F" font-size="11">High (Extreme)</text>
      <line x1="75" y1="47" x2="130" y2="47" stroke="#7D766D" stroke-dasharray="2,2"/>

      <text x="135" y="90" fill="#1F5C3E" font-size="11" font-weight="bold">Close (Bullish)</text>
      <line x1="100" y1="88" x2="130" y2="88" stroke="#7D766D" stroke-dasharray="2,2"/>

      <text x="135" y="195" fill="#4A453F" font-size="11">Open</text>
      <line x1="100" y1="195" x2="130" y2="195" stroke="#7D766D" stroke-dasharray="2,2"/>

      <text x="135" y="245" fill="#4A453F" font-size="11">Low (Rejection)</text>
      <line x1="75" y1="245" x2="130" y2="245" stroke="#7D766D" stroke-dasharray="2,2"/>
    </g>

    <!-- Divider Line -->
    <line x1="280" y1="20" x2="280" y2="290" stroke="#D8D3C3" stroke-width="1.5"/>

    <!-- Section 2: Pin Bar Rejection -->
    <g transform="translate(310, 20)">
      <text x="80" y="25" fill="#1A1816" font-size="14" font-weight="bold" text-anchor="middle">Pin Bar Rejection</text>
      
      <!-- Support baseline -->
      <line x1="0" y1="170" x2="180" y2="170" stroke="#A88948" stroke-width="1.5" stroke-dasharray="4,4"/>
      <text x="5" y="162" fill="#A88948" font-size="10">Key Support Zone</text>

      <!-- Pin Bar: Small body, long tail dipping below support -->
      <line x1="80" y1="65" x2="80" y2="85" stroke="#1F5C3E" stroke-width="2"/>
      <rect x="65" y="85" width="30" height="25" fill="#1F5C3E" rx="2"/>
      <line x1="80" y1="110" x2="80" y2="250" stroke="#1F5C3E" stroke-width="3"/>
      
      <!-- Label rejection wick -->
      <path d="M 95 180 Q 130 180 130 200" fill="none" stroke="#8F251E" stroke-width="1.5"/>
      <text x="110" y="215" fill="#8F251E" font-size="10" font-weight="bold">Wick Rejection</text>
      <text x="110" y="228" fill="#4A453F" font-size="9">> 66% of range</text>
    </g>

    <!-- Divider Line -->
    <line x1="510" y1="20" x2="510" y2="290" stroke="#D8D3C3" stroke-width="1.5"/>

    <!-- Section 3: Bullish Engulfing -->
    <g transform="translate(540, 20)">
      <text x="90" y="25" fill="#1A1816" font-size="14" font-weight="bold" text-anchor="middle">Bullish Engulfing</text>
      
      <!-- Preceding Bearish Candle -->
      <line x1="45" y1="110" x2="45" y2="180" stroke="#8F251E" stroke-width="2"/>
      <rect x="35" y="125" width="20" height="40" fill="#8F251E" rx="2"/>

      <!-- Engulfing Bullish Candle -->
      <line x1="95" y1="80" x2="95" y2="210" stroke="#1F5C3E" stroke-width="2.5"/>
      <rect x="80" y="95" width="30" height="100" fill="#1F5C3E" rx="2"/>

      <text x="90" y="250" fill="#1F5C3E" font-size="11" font-weight="bold" text-anchor="middle">Buyers Overwhelm</text>
      <text x="90" y="265" fill="#4A453F" font-size="9" text-anchor="middle">Full body absorption</text>
    </g>
  </svg>`;
}

export function renderMarketStructureDiagram() {
  return `
  <svg viewBox="0 0 760 320" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EB; font-family:'JetBrains Mono',monospace;">
    <defs>
      <pattern id="ledgerGrid2" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E0D0" stroke-width="0.8"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="#F7F4EB"/>
    <rect width="100%" height="100%" fill="url(#ledgerGrid2)"/>

    <text x="380" y="28" fill="#1A1816" font-size="15" font-weight="bold" text-anchor="middle">Market Structure Mapping: Trend & Change of Character</text>

    <!-- Uptrend Path: Low -> HH1 -> HL1 -> HH2 -> HL2 -> HH3 -->
    <path d="M 40 260 L 140 160 L 210 210 L 330 90 L 400 150 L 510 50 L 570 230 L 630 140 L 710 260" 
          fill="none" stroke="#1A1816" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Swing Point Badges -->
    <circle cx="40" cy="260" r="5" fill="#4A453F"/>
    <text x="40" y="282" fill="#4A453F" font-size="11" text-anchor="middle">Low</text>

    <circle cx="140" cy="160" r="5" fill="#1F5C3E"/>
    <text x="140" y="145" fill="#1F5C3E" font-size="11" font-weight="bold" text-anchor="middle">HH 1</text>

    <circle cx="210" cy="210" r="5" fill="#1F5C3E"/>
    <text x="210" y="232" fill="#1F5C3E" font-size="11" font-weight="bold" text-anchor="middle">HL 1</text>

    <circle cx="330" cy="90" r="5" fill="#1F5C3E"/>
    <text x="330" y="75" fill="#1F5C3E" font-size="11" font-weight="bold" text-anchor="middle">HH 2</text>

    <!-- Break of Structure (BOS) Lines -->
    <line x1="140" y1="160" x2="270" y2="160" stroke="#1F5C3E" stroke-dasharray="3,3" stroke-width="1.5"/>
    <rect x="235" y="145" width="48" height="18" fill="#E4EFE8" stroke="#1F5C3E" rx="3"/>
    <text x="259" y="158" fill="#1F5C3E" font-size="9" font-weight="bold" text-anchor="middle">BOS</text>

    <circle cx="400" cy="150" r="5" fill="#1F5C3E"/>
    <text x="400" y="172" fill="#1F5C3E" font-size="11" font-weight="bold" text-anchor="middle">HL 2</text>

    <circle cx="510" cy="50" r="6" fill="#A88948"/>
    <text x="510" y="38" fill="#A88948" font-size="12" font-weight="bold" text-anchor="middle">HH 3 (Peak)</text>

    <!-- CHOCH Line -->
    <line x1="400" y1="150" x2="600" y2="150" stroke="#8F251E" stroke-width="2" stroke-dasharray="4,4"/>
    <rect x="535" y="135" width="60" height="20" fill="#FAECEB" stroke="#8F251E" rx="3"/>
    <text x="565" y="149" fill="#8F251E" font-size="10" font-weight="bold" text-anchor="middle">CHOCH</text>

    <circle cx="570" cy="230" r="6" fill="#8F251E"/>
    <text x="570" y="252" fill="#8F251E" font-size="11" font-weight="bold" text-anchor="middle">LL 1</text>

    <circle cx="630" cy="140" r="5" fill="#8F251E"/>
    <text x="630" y="125" fill="#8F251E" font-size="11" text-anchor="middle">LH 1</text>

    <circle cx="710" cy="260" r="5" fill="#8F251E"/>
    <text x="710" y="282" fill="#8F251E" font-size="11" text-anchor="middle">LL 2</text>
  </svg>`;
}

export function renderRetestDiagram() {
  return `
  <svg viewBox="0 0 760 320" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EB; font-family:'JetBrains Mono',monospace;">
    <defs>
      <pattern id="ledgerGrid3" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E0D0" stroke-width="0.8"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="#F7F4EB"/>
    <rect width="100%" height="100%" fill="url(#ledgerGrid3)"/>

    <text x="380" y="28" fill="#1A1816" font-size="15" font-weight="bold" text-anchor="middle">Support / Resistance Polarity & Breakout Retest Mechanics</text>

    <rect x="40" y="140" width="680" height="30" fill="#EFECE1" stroke="#A88948" stroke-width="1.5" stroke-dasharray="4,2"/>
    <text x="50" y="160" fill="#A88948" font-size="11" font-weight="bold">POLARITY ZONE: Resistance turned into Support</text>

    <path d="M 60 250 L 130 140 L 200 230 L 280 140 L 330 210 L 420 70 L 510 140 L 680 50" 
          fill="none" stroke="#1A1816" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

    <circle cx="130" cy="140" r="5" fill="#8F251E"/>
    <rect x="95" y="112" width="70" height="18" fill="#FAECEB" stroke="#8F251E" rx="3"/>
    <text x="130" y="125" fill="#8F251E" font-size="9" font-weight="bold" text-anchor="middle">Touch 1 (Sell)</text>

    <circle cx="280" cy="140" r="5" fill="#8F251E"/>
    <rect x="245" y="112" width="70" height="18" fill="#FAECEB" stroke="#8F251E" rx="3"/>
    <text x="280" y="125" fill="#8F251E" font-size="9" font-weight="bold" text-anchor="middle">Touch 2 (Sell)</text>

    <rect x="405" y="85" width="22" height="75" fill="#1F5C3E" rx="2"/>
    <line x1="416" y1="70" x2="416" y2="170" stroke="#1F5C3E" stroke-width="2"/>
    <text x="416" y="55" fill="#1F5C3E" font-size="10" font-weight="bold" text-anchor="middle">Expansion Break</text>

    <circle cx="510" cy="140" r="6" fill="#1F5C3E"/>
    <g transform="translate(470, 185)">
      <rect width="80" height="24" fill="#E4EFE8" stroke="#1F5C3E" stroke-width="1.5" rx="3"/>
      <text x="40" y="16" fill="#1F5C3E" font-size="10" font-weight="bold" text-anchor="middle">ENTRY RETEST</text>
    </g>

    <path d="M 640 68 L 680 50 L 672 82" fill="none" stroke="#1F5C3E" stroke-width="3" stroke-linecap="round"/>
    <text x="630" y="38" fill="#1F5C3E" font-size="11" font-weight="bold">Trend Continuation</text>
  </svg>`;
}

/**
 * Generates an archival candlestick chart visual plate for any logged trade.
 */
export function renderTradeChartSVG(trade) {
  const isGain = (trade.netPnL || 0) >= 0;
  const themeColor = isGain ? '#1F5C3E' : '#8F251E';
  const rFormatted = (trade.rMultiple >= 0 ? '+' : '') + Number(trade.rMultiple || 0).toFixed(2) + 'R';

  return `
  <svg viewBox="0 0 600 320" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background:#F7F4EB; font-family:'JetBrains Mono',monospace;">
    <defs>
      <pattern id="chartGrid_${trade.id || 'default'}" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E0D0" stroke-width="0.8"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="#F7F4EB"/>
    <rect width="100%" height="100%" fill="url(#chartGrid_${trade.id || 'default'})"/>

    <!-- Header bar -->
    <rect x="0" y="0" width="100%" height="32" fill="#EFECE1" stroke="#D8D3C3" stroke-width="1"/>
    <text x="15" y="21" fill="#1A1816" font-size="12" font-weight="bold">${trade.symbol} • ${trade.direction} • ${rFormatted}</text>
    <text x="585" y="21" fill="#7D766D" font-size="11" text-anchor="end">${trade.setupId || 'Discretionary'}</text>

    <!-- Synthetic Candlesticks Series -->
    <!-- Candle 1 -->
    <line x1="50" y1="180" x2="50" y2="230" stroke="#8F251E" stroke-width="1.5"/>
    <rect x="42" y="190" width="16" height="30" fill="#8F251E" rx="1"/>

    <!-- Candle 2 -->
    <line x1="90" y1="170" x2="90" y2="225" stroke="#8F251E" stroke-width="1.5"/>
    <rect x="82" y="175" width="16" height="35" fill="#8F251E" rx="1"/>

    <!-- Candle 3 (Support Bounce / Pin Bar) -->
    <line x1="130" y1="180" x2="130" y2="255" stroke="#1F5C3E" stroke-width="2"/>
    <rect x="122" y="180" width="16" height="20" fill="#1F5C3E" rx="1"/>

    <!-- Candle 4 (Entry Confirmation) -->
    <line x1="170" y1="140" x2="170" y2="200" stroke="#1F5C3E" stroke-width="2"/>
    <rect x="162" y="150" width="16" height="40" fill="#1F5C3E" rx="1"/>

    <!-- Candle 5 -->
    <line x1="210" y1="130" x2="210" y2="175" stroke="#1F5C3E" stroke-width="2"/>
    <rect x="202" y="135" width="16" height="30" fill="#1F5C3E" rx="1"/>

    <!-- Candle 6 (Retest) -->
    <line x1="250" y1="145" x2="250" y2="190" stroke="#8F251E" stroke-width="1.5"/>
    <rect x="242" y="150" width="16" height="25" fill="#8F251E" rx="1"/>

    <!-- Candle 7 (Expansion) -->
    <line x1="290" y1="90" x2="290" y2="165" stroke="#1F5C3E" stroke-width="2.5"/>
    <rect x="282" y="100" width="16" height="55" fill="#1F5C3E" rx="1"/>

    <!-- Candle 8 -->
    <line x1="330" y1="75" x2="330" y2="120" stroke="#1F5C3E" stroke-width="2"/>
    <rect x="322" y="80" width="16" height="30" fill="#1F5C3E" rx="1"/>

    <!-- Candle 9 (Target / Exit) -->
    <line x1="370" y1="${isGain ? '60' : '220'}" x2="370" y2="${isGain ? '110' : '260'}" stroke="${themeColor}" stroke-width="2"/>
    <rect x="362" y="${isGain ? '65' : '225'}" width="16" height="35" fill="${themeColor}" rx="1"/>

    <!-- Key Execution Overlays -->
    <!-- Entry Line -->
    <line x1="160" y1="170" x2="570" y2="170" stroke="#1A1816" stroke-width="1.5" stroke-dasharray="3,3"/>
    <rect x="470" y="158" width="90" height="18" fill="#EFECE1" stroke="#1A1816" rx="2"/>
    <text x="515" y="171" fill="#1A1816" font-size="9" font-weight="bold" text-anchor="middle">ENTRY: ${Number(trade.entryPrice || 0).toFixed(2)}</text>

    <!-- Stop Loss Line -->
    <line x1="120" y1="240" x2="570" y2="240" stroke="#8F251E" stroke-width="1.5" stroke-dasharray="4,4"/>
    <rect x="470" y="228" width="90" height="18" fill="#FAECEB" stroke="#8F251E" rx="2"/>
    <text x="515" y="241" fill="#8F251E" font-size="9" font-weight="bold" text-anchor="middle">STOP: ${trade.stopLoss ? Number(trade.stopLoss).toFixed(2) : 'NONE'}</text>

    <!-- Take Profit Line (if target set) -->
    ${trade.takeProfit ? `
    <line x1="200" y1="80" x2="570" y2="80" stroke="#1F5C3E" stroke-width="1.5" stroke-dasharray="4,4"/>
    <rect x="470" y="68" width="90" height="18" fill="#E4EFE8" stroke="#1F5C3E" rx="2"/>
    <text x="515" y="81" fill="#1F5C3E" font-size="9" font-weight="bold" text-anchor="middle">TARGET: ${Number(trade.takeProfit).toFixed(2)}</text>
    ` : ''}

    <!-- Result Rubber Stamp in bottom right -->
    <g transform="translate(430, 265)">
      <rect width="140" height="30" fill="${isGain ? '#E4EFE8' : '#FAECEB'}" stroke="${themeColor}" stroke-width="2" rx="4"/>
      <text x="70" y="20" fill="${themeColor}" font-size="12" font-weight="bold" text-anchor="middle">${isGain ? 'PASSED: ' + rFormatted : 'AUDIT: ' + rFormatted}</text>
    </g>
  </svg>`;
}
