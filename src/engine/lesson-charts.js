const PATTERN_CANDLES = {
  hammer: [[76, 83, 65, 68], [68, 73, 48, 54], [54, 58, 16, 51], [52, 79, 49, 76]],
  'hanging man': [[28, 43, 22, 39], [39, 58, 34, 53], [53, 58, 17, 50], [49, 53, 29, 33]],
  'inverted hammer': [[77, 82, 63, 67], [67, 72, 46, 51], [50, 85, 46, 54], [53, 80, 49, 77]],
  'shooting star': [[25, 43, 20, 39], [39, 56, 34, 52], [52, 88, 47, 56], [55, 59, 28, 32]],
  'bullish pin bar': [[73, 80, 60, 63], [63, 68, 42, 48], [48, 54, 12, 47], [46, 78, 44, 75]],
  'bearish pin bar': [[29, 43, 22, 40], [40, 57, 34, 52], [51, 89, 46, 53], [54, 58, 24, 28]],
  doji: [[42, 69, 25, 45], [45, 76, 39, 46], [46, 72, 29, 44]],
  'long-legged doji': [[42, 86, 14, 49], [49, 82, 18, 51], [51, 87, 12, 50]],
  'dragonfly doji': [[46, 50, 14, 48]],
  'gravestone doji': [[49, 86, 46, 50]],
  'spinning top': [[44, 71, 28, 49], [49, 74, 31, 52], [52, 70, 30, 47]],
  marubozu: [[26, 35, 18, 31], [31, 83, 28, 79]],
  'bullish engulfing': [[66, 70, 45, 50], [50, 54, 31, 38], [36, 75, 32, 71]],
  'bearish engulfing': [[34, 55, 30, 50], [50, 68, 46, 63], [66, 70, 29, 34]],
  'bullish harami': [[70, 75, 37, 42], [45, 57, 41, 53]],
  'bearish harami': [[31, 64, 27, 59], [55, 60, 43, 47]],
  'harami cross': [[70, 74, 35, 40], [51, 62, 43, 52]],
  'piercing line': [[68, 73, 38, 42], [35, 65, 32, 62]],
  'dark cloud cover': [[32, 66, 27, 62], [65, 70, 35, 39]],
  'tweezer bottom': [[65, 70, 25, 33], [34, 58, 25, 53]],
  'tweezer top': [[35, 72, 30, 67], [66, 71, 30, 38]],
  'inside bar': [[44, 80, 38, 73], [70, 75, 49, 54]],
  'outside bar': [[53, 70, 40, 46], [47, 84, 30, 76]],
  'morning star': [[75, 78, 38, 42], [43, 50, 34, 41], [39, 72, 36, 68]],
  'evening star': [[33, 68, 29, 64], [64, 73, 57, 66], [68, 71, 34, 38]],
  'three white soldiers': [[40, 55, 35, 53], [51, 68, 47, 66], [64, 83, 60, 80]],
  'three black crows': [[80, 84, 62, 64], [66, 69, 48, 51], [53, 56, 33, 36]],
  'rising three methods': [[35, 76, 30, 72], [72, 77, 60, 66], [66, 71, 58, 63], [63, 69, 55, 61], [60, 88, 57, 85]],
  'falling three methods': [[75, 80, 38, 42], [42, 50, 34, 46], [46, 54, 39, 49], [49, 58, 43, 52], [53, 56, 19, 22]],
  kicker: [[71, 75, 42, 46], [30, 34, 18, 22], [22, 61, 19, 58]]
};

const esc = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function svgFrame(title, contents, viewBox = '0 0 720 190') {
  const height = Number(viewBox.split(' ')[3]);
  return `<svg class="lesson-chart-svg" viewBox="${viewBox}" width="100%" height="${height}" role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#F7F4EB"/>
    <path d="M0 38H720 M0 76H720 M0 114H720 M0 152H720 M80 0V${height} M160 0V${height} M240 0V${height} M320 0V${height} M400 0V${height} M480 0V${height} M560 0V${height} M640 0V${height}" stroke="#E5E0D0" stroke-width="1"/>
    <text x="16" y="22" fill="#4A453F" font-family="monospace" font-size="12" font-weight="700">${esc(title)}</text>
    ${contents}
  </svg>`;
}

function drawCandles(candles, { x = 56, y = 42, width = 600, height = 110, candleWidth = 18 } = {}) {
  const values = candles.flat();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const yFor = price => y + height - ((price - min) / range) * height;
  const spacing = width / (candles.length + 1);

  return candles.map(([open, high, low, close], index) => {
    const center = x + spacing * (index + 1);
    const color = close >= open ? '#1F5C3E' : '#8F251E';
    const top = Math.min(yFor(open), yFor(close));
    const bodyHeight = Math.max(2, Math.abs(yFor(open) - yFor(close)));
    return `<line x1="${center}" y1="${yFor(high)}" x2="${center}" y2="${yFor(low)}" stroke="${color}" stroke-width="2"/><rect x="${center - candleWidth / 2}" y="${top}" width="${candleWidth}" height="${bodyHeight}" fill="${color}"/>`;
  }).join('');
}

export function renderCandlestickPatternChart(patternName) {
  const cleanName = String(patternName).replace(/:\s*$/, '').trim();
  const normalized = cleanName.toLowerCase();
  const key = Object.keys(PATTERN_CANDLES).find(name => normalized.includes(name));
  if (!key) return '';
  const candles = PATTERN_CANDLES[key];
  const contents = `${drawCandles(candles, { x: 14, y: 32, width: 250, height: 66, candleWidth: 15 })}
    <text x="14" y="109" fill="#7D766D" font-family="monospace" font-size="9">Illustrative OHLC · wait for close + context</text>`;
  return `<figure class="pattern-chart" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Expand chart: ${esc(cleanName)} example"><figcaption>${esc(cleanName)} · candle example</figcaption>${svgFrame(`${cleanName} example`, contents, '0 0 280 118')}</figure>`;
}

function renderStructureTopic(heading, index) {
  const choch = /character|choch|reversal|exhaustion/i.test(heading);
  const bearish = index % 2 === 1;
  const path = choch
    ? 'M80 148 L175 112 L245 134 L335 82 L405 105 L490 55 L570 130 L640 95'
    : bearish
      ? 'M80 55 L175 91 L245 68 L335 119 L405 94 L490 150 L570 125 L640 166'
      : 'M80 160 L175 112 L245 139 L335 86 L405 113 L490 58 L570 88 L640 42';
  const marks = choch
    ? '<line x1="405" y1="112" x2="655" y2="112" stroke="#8F251E" stroke-dasharray="5 4"/><text x="520" y="106" fill="#8F251E" font-size="11">HL break / CHoCH close</text><circle cx="570" cy="130" r="5" fill="#8F251E"/>'
    : '<text x="150" y="102" fill="#1F5C3E" font-size="11">HH</text><text x="245" y="157" fill="#1F5C3E" font-size="11">HL</text><line x1="175" y1="78" x2="305" y2="78" stroke="#A88948" stroke-dasharray="4 4"/><text x="265" y="70" fill="#A88948" font-size="10">close beyond swing = BOS</text>';
  return svgFrame(`Structure example: ${heading}`, `<path d="${path}" fill="none" stroke="#1A1816" stroke-width="3" stroke-linejoin="round"/>${marks}<text x="82" y="180" fill="#7D766D" font-size="10">Swing points are confirmed after price moves away</text>`);
}

function renderRetestTopic(heading, index) {
  const short = index % 2 === 1 || /support break|failed|resistance/i.test(heading);
  const levelY = 104;
  const path = short
    ? 'M70 55 L160 100 L235 60 L315 102 L390 145 L470 104 L555 144 L650 166'
    : 'M70 145 L160 104 L235 150 L315 102 L390 58 L470 104 L555 61 L650 38';
  return svgFrame(`Level interaction: ${heading}`, `<rect x="50" y="${levelY - 9}" width="625" height="18" fill="#EFECE1" stroke="#A88948" stroke-dasharray="4 3"/><text x="58" y="${levelY - 14}" fill="#A88948" font-size="10">pre-marked zone</text><path d="${path}" fill="none" stroke="#1A1816" stroke-width="3" stroke-linejoin="round"/><circle cx="470" cy="${levelY}" r="6" fill="${short ? '#8F251E' : '#1F5C3E'}"/><text x="470" y="${levelY + 32}" text-anchor="middle" fill="#1F5C3E" font-size="10">close / retest trigger</text><text x="615" y="${short ? 175 : 28}" fill="#7D766D" font-size="10">${short ? 'lower target' : 'higher target'}</text>`);
}

function renderRiskTopic(heading, index) {
  const depth = [28, 48, 72, 112, 142][index % 5];
  const recovery = 166 - depth;
  return svgFrame(`Risk and recovery example: ${heading}`, `<line x1="52" y1="74" x2="670" y2="74" stroke="#7D766D" stroke-dasharray="4 4"/><text x="54" y="65" fill="#7D766D" font-size="10">starting equity</text><path d="M70 74 L175 74 L275 ${74 + depth} L365 ${74 + depth} L470 ${74 + depth - 42} L560 ${74 + depth - 62} L650 ${recovery}" fill="none" stroke="#8F251E" stroke-width="3"/><circle cx="275" cy="${74 + depth}" r="5" fill="#8F251E"/><text x="275" y="${Math.min(168, 90 + depth)}" text-anchor="middle" fill="#8F251E" font-size="10">drawdown</text><text x="555" y="46" fill="#1F5C3E" font-size="10">recovery takes more % than loss</text>`);
}

function renderTopDownTopic(heading) {
  const rows = [
    ['DAILY', 72, 'Bias · major swings · prior day range'],
    ['4H / 1H', 112, 'Impulse · levels · planned zone'],
    ['15M / 5M', 152, 'Closed trigger · entry · invalidation']
  ];
  const contents = rows.map(([label, y, note], index) => `<rect x="24" y="${y - 16}" width="92" height="26" fill="${index === 0 ? '#EFECE1' : '#E4EFE8'}" stroke="${index === 0 ? '#A88948' : '#1F5C3E'}"/><text x="70" y="${y + 1}" text-anchor="middle" fill="#1A1816" font-size="11" font-weight="bold">${label}</text><text x="140" y="${y + 1}" fill="#4A453F" font-size="11">${note}</text>${index < 2 ? `<path d="M70 ${y + 12} V${y + 27} M65 ${y + 22} L70 ${y + 27} L75 ${y + 22}" fill="none" stroke="#A88948" stroke-width="2"/>` : ''}`).join('');
  return svgFrame(`Top-down chart workflow: ${heading}`, contents);
}

function renderVolumeProfileTopic(heading, index) {
  const widths = [70, 115, 165, 220, 185, 130, 92, 58];
  const bars = widths.map((width, i) => {
    const y = 50 + i * 15;
    const isPoc = i === 3;
    const inValue = i >= 2 && i <= 5;
    return `<rect x="${470 - width}" y="${y}" width="${width}" height="9" fill="${isPoc ? '#A88948' : inValue ? '#1F5C3E' : '#7D766D'}" opacity="${isPoc ? 1 : 0.75}"/>`;
  }).join('');
  const tag = /node|lVN|thin/i.test(heading) ? 'LVN: thinner trade, faster traversal possible' : /poc/i.test(heading) ? 'POC: most volume in this selected profile' : 'VAH / VAL: selected value-area boundaries';
  const priceLevels = [
    { y: 80, text: 'VAH 2336' },
    { y: 95, text: 'POC 2330' },
    { y: 125, text: 'VAL 2324' }
  ].map(level => `<line x1="220" y1="${level.y}" x2="690" y2="${level.y}" stroke="#A88948" stroke-dasharray="4 3"/><text x="480" y="${level.y - 3}" fill="#A88948" font-size="10">${level.text}</text>`).join('');
  return svgFrame(`Hypothetical GC session profile: ${heading}`, `<text x="24" y="40" fill="#4A453F" font-size="10">Illustrative USD/oz levels · relative profile volume</text><line x1="470" y1="42" x2="470" y2="174" stroke="#D8D3C3"/>${bars}${priceLevels}<path d="M110 158 L180 134 L230 143 L280 112 L335 122 L390 86 L440 95" fill="none" stroke="#1A1816" stroke-width="2.5"/><text x="24" y="181" fill="#4A453F" font-size="10">${tag} · hypothetical only, not live market data</text>`);
}

const BULLISH_FIB_CANDLES = [
  [2303, 2308, 2300, 2306], [2306, 2312, 2304, 2310], [2310, 2318, 2308, 2316],
  [2316, 2320, 2312, 2318], [2318, 2325, 2317, 2323], [2323, 2330, 2321, 2328],
  [2328, 2335, 2327, 2333], [2333, 2340, 2332, 2338], [2338, 2340, 2330, 2332],
  [2332, 2334, 2320, 2324], [2324, 2326, 2307.5, 2310], [2310, 2317, 2309, 2315],
  [2315, 2320, 2313, 2319]
];

const BEARISH_FIB_CANDLES = [
  [2338, 2340, 2332, 2334], [2334, 2336, 2328, 2330], [2330, 2332, 2323, 2325],
  [2325, 2328, 2319, 2321], [2321, 2323, 2314, 2316], [2316, 2318, 2308, 2310],
  [2310, 2312, 2302, 2304], [2304, 2306, 2300, 2302], [2302, 2314, 2301, 2311],
  [2311, 2324, 2309, 2321], [2321, 2331, 2318, 2329], [2329, 2330, 2319, 2322],
  [2322, 2324, 2311, 2314]
];

function fibPriceY(price) {
  const chartTop = 54;
  const chartBottom = 190;
  return chartBottom - ((price - 2298) / 44) * (chartBottom - chartTop);
}

function drawPriceCandles(candles) {
  const startX = 78;
  const spacing = 31;
  return candles.map(([open, high, low, close], index) => {
    const x = startX + index * spacing;
    const color = close >= open ? '#1F5C3E' : '#8F251E';
    const openY = fibPriceY(open);
    const closeY = fibPriceY(close);
    const bodyY = Math.min(openY, closeY);
    const bodyHeight = Math.max(2, Math.abs(openY - closeY));
    return `<line x1="${x}" y1="${fibPriceY(high)}" x2="${x}" y2="${fibPriceY(low)}" stroke="${color}" stroke-width="2"/><rect x="${x - 6}" y="${bodyY}" width="12" height="${bodyHeight}" fill="${color}"/>`;
  }).join('');
}

function fibLevelMarks(direction = 'bullish') {
  const levels = direction === 'bullish'
    ? [['0%', 2340], ['38.2%', 2324.72], ['50%', 2320], ['61.8%', 2315.28], ['70.5%', 2311.8], ['78.6%', 2308.56], ['100%', 2300]]
    : [['0%', 2300], ['38.2%', 2315.28], ['50%', 2320], ['61.8%', 2324.72], ['70.5%', 2328.2], ['78.6%', 2331.44], ['100%', 2340]];
  return levels.map(([label, price]) => {
    const y = fibPriceY(price);
    const isOte = ['61.8%', '70.5%', '78.6%'].includes(label);
    return `${isOte ? `<rect x="55" y="${y - 6}" width="462" height="12" fill="#E4EFE8" opacity="0.65"/>` : ''}<line x1="55" y1="${y}" x2="518" y2="${y}" stroke="${isOte ? '#1F5C3E' : '#7D766D'}" stroke-width="${isOte ? 1.3 : 1}" stroke-dasharray="${isOte ? '0' : '4 4'}"/><text x="527" y="${y + 3}" fill="${isOte ? '#1F5C3E' : '#7D766D'}" font-family="monospace" font-size="9">${label}  ${Number(price).toFixed(2)}</text>`;
  }).join('');
}

function renderFibPriceChart(heading, variant = 'levels', direction = 'bullish') {
  const candles = direction === 'bearish' ? BEARISH_FIB_CANDLES : BULLISH_FIB_CANDLES;
  const startPrice = direction === 'bearish' ? 2340 : 2300;
  const endPrice = direction === 'bearish' ? 2300 : 2340;
  const startX = direction === 'bearish' ? 78 : 78;
  const endX = startX + 7 * 31;
  const startY = fibPriceY(startPrice);
  const endY = fibPriceY(endPrice);
  let overlays = '';

  if (variant === 'anchors') {
    overlays = `<circle cx="${startX}" cy="${startY}" r="5" fill="#A88948"/><text x="55" y="${startY + 18}" fill="#A88948" font-size="9">fixed swing anchor ${startPrice}</text><circle cx="${endX}" cy="${endY}" r="5" fill="#A88948"/><text x="${endX - 8}" y="${endY - 9}" fill="#A88948" font-size="9">impulse close beyond swing ${endPrice}</text>`;
  } else if (variant === 'confluence') {
    const pocY = fibPriceY(2312);
    overlays = `<line x1="55" y1="${pocY}" x2="518" y2="${pocY}" stroke="#397189" stroke-width="2" stroke-dasharray="5 3"/><text x="278" y="${pocY - 5}" fill="#397189" font-size="9">separate hypothetical POC 2312.00</text><circle cx="418" cy="${pocY}" r="5" fill="#A88948"/>`;
  } else if (variant === 'execution') {
    const entry = direction === 'bearish' ? 2322 : 2314;
    const stop = direction === 'bearish' ? 2332 : 2307;
    const target = direction === 'bearish' ? 2302 : 2328;
    overlays = [
      [target, '#1F5C3E', `TARGET ${target.toFixed(2)}`],
      [entry, '#397189', `ENTRY ${entry.toFixed(2)}`],
      [stop, '#8F251E', `STOP ${stop.toFixed(2)}`]
    ].map(([price, color, label]) => `<line x1="55" y1="${fibPriceY(price)}" x2="518" y2="${fibPriceY(price)}" stroke="${color}" stroke-width="2"/><text x="526" y="${fibPriceY(price) - 4}" fill="${color}" font-size="9">${label}</text>`).join('');
  }

  const oteStart = direction === 'bearish' ? 2324.72 : 2315.28;
  const oteEnd = direction === 'bearish' ? 2331.44 : 2308.56;
  const fibLines = variant === 'execution'
    ? `<rect x="55" y="${Math.min(fibPriceY(oteStart), fibPriceY(oteEnd))}" width="463" height="${Math.abs(fibPriceY(oteStart) - fibPriceY(oteEnd))}" fill="#E4EFE8" opacity="0.65"/><text x="526" y="${(fibPriceY(oteStart) + fibPriceY(oteEnd)) / 2 + 3}" fill="#1F5C3E" font-size="9">OTE ZONE</text>`
    : fibLevelMarks(direction);
  const anchorLine = `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="#A88948" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  const note = direction === 'bearish'
    ? 'Hypothetical bearish impulse: 2340 high to 2300 low'
    : 'Hypothetical bullish impulse: 2300 low to 2340 high';
  const executionFootnote = direction === 'bearish'
    ? `OTE ${Math.min(oteStart, oteEnd).toFixed(2)}-${Math.max(oteStart, oteEnd).toFixed(2)} · entry 2322 · stop 2332 · target 2302 = 2R gross before costs.`
    : `OTE ${Math.min(oteStart, oteEnd).toFixed(2)}-${Math.max(oteStart, oteEnd).toFixed(2)} · entry 2314 · stop 2307 · target 2328 = 2R gross before costs.`;
  const contents = `<text x="48" y="43" fill="#4A453F" font-size="9">${note} · 40.00 range · price bars are illustrative</text>${fibLines}${drawPriceCandles(candles)}${variant === 'anchors' ? anchorLine : ''}${overlays}<text x="48" y="219" fill="#7D766D" font-size="9">${variant === 'execution' ? executionFootnote : 'Green band = 61.8%-78.6% retracement area; levels do not predict reversal.'}</text>`;
  return svgFrame(`Price-based Fibonacci example: ${heading}`, contents, '0 0 720 240');
}

function renderFibPracticeChart(heading) {
  const confirmed = [[34, 48, 29, 43], [43, 62, 39, 59], [59, 67, 50, 54], [53, 70, 51, 67], [67, 84, 64, 81]];
  const noTrigger = [[72, 78, 56, 61], [61, 65, 45, 51], [51, 62, 46, 58], [58, 63, 49, 54], [54, 59, 40, 45]];
  const content = `<rect x="28" y="48" width="315" height="132" fill="#F2EFE5" stroke="#D8D3C3"/><rect x="377" y="48" width="315" height="132" fill="#F2EFE5" stroke="#D8D3C3"/><text x="42" y="65" fill="#1F5C3E" font-size="10" font-weight="bold">A · PREDEFINED TRIGGER PRINTED</text><text x="391" y="65" fill="#8F251E" font-size="10" font-weight="bold">B · ZONE TOUCHED, NO TRIGGER</text><rect x="45" y="112" width="280" height="17" fill="#E4EFE8" opacity="0.75"/><rect x="394" y="112" width="280" height="17" fill="#E4EFE8" opacity="0.75"/>${drawCandles(confirmed, { x: 46, y: 76, width: 280, height: 92, candleWidth: 15 })}${drawCandles(noTrigger, { x: 395, y: 76, width: 280, height: 92, candleWidth: 15 })}<line x1="43" y1="185" x2="678" y2="185" stroke="#7D766D"/><text x="44" y="201" fill="#4A453F" font-size="9">Record both outcomes; the second example is a planned pass, not a missed trade.</text>`;
  return svgFrame(`Fibonacci replay drill: ${heading}`, content, '0 0 720 215');
}

function renderFibonacciTopic(heading) {
  const label = heading.toLowerCase();
  if (/bearish mirror/.test(label)) return renderFibPriceChart(heading, 'levels', 'bearish');
  if (/anchor/.test(label)) return renderFibPriceChart(heading, 'anchors');
  if (/confluence/.test(label)) return renderFibPriceChart(heading, 'confluence');
  if (/stops and targets|ote entry/.test(label)) return renderFibPriceChart(heading, 'execution');
  if (/practice task/.test(label)) return renderFibPracticeChart(heading);
  return renderFibPriceChart(heading, 'levels');
}

function renderIpdaTopic(heading, index) {
  const showShortTrigger = index % 2 === 1 || /trigger|example|sweep/i.test(heading);
  const path = 'M70 145 L150 112 L230 128 L315 82 L405 103 L465 34 L500 70 L535 97 L575 125 L650 157';
  const triggerLabel = showShortTrigger ? 'close back + structure break' : 'define the range before a trigger';
  return svgFrame(`IPDA-style range hypothesis: ${heading}`, `<rect x="54" y="58" width="620" height="106" fill="#F2EFE5" opacity="0.75"/><line x1="54" y1="58" x2="674" y2="58" stroke="#8F251E" stroke-dasharray="5 4"/><text x="58" y="52" fill="#8F251E" font-size="10">range high / external liquidity 2340</text><line x1="54" y1="111" x2="674" y2="111" stroke="#A88948" stroke-dasharray="4 4"/><text x="58" y="106" fill="#A88948" font-size="10">EQ 2320 · premium above / discount below</text><line x1="54" y1="164" x2="674" y2="164" stroke="#1F5C3E" stroke-dasharray="5 4"/><text x="58" y="181" fill="#1F5C3E" font-size="10">range low 2300 · levels are hypothetical</text><path d="${path}" fill="none" stroke="#1A1816" stroke-width="3" stroke-linejoin="round"/><circle cx="465" cy="34" r="5" fill="#8F251E"/><text x="430" y="30" fill="#8F251E" font-size="10">sweep 2342</text><rect x="520" y="80" width="55" height="18" fill="#E4EFE8" stroke="#1F5C3E"/><text x="525" y="92" fill="#1F5C3E" font-size="9">FVG idea</text><text x="555" y="144" fill="#4A453F" font-size="10">${triggerLabel}</text><text x="580" y="160" fill="#7D766D" font-size="10">target only if planned</text>`);
}

function renderGoldSetupTopic(lessonId, heading, index) {
  const isFast = lessonId === 'lesson-9';
  const entryFrame = isFast ? '5M' : '15M';
  const impulseFrame = isFast ? '1H' : '4H';
  const trendY = index % 2 ? 'M145 67 L250 91 L360 56 L465 93 L575 50 L650 74' : 'M145 120 L250 94 L360 126 L465 78 L575 110 L650 47';
  const entryCandles = [[60, 72, 48, 52], [52, 61, 34, 39], [39, 55, 35, 52], [51, 78, 48, 75]];
  const lower = drawCandles(entryCandles, { x: 415, y: 123, width: 220, height: 45, candleWidth: 12 });
  return svgFrame(`${isFast ? 'Daily / 1H / 5M' : 'Daily / 4H / 15M'} setup chart: ${heading}`, `<rect x="20" y="38" width="680" height="38" fill="#EFECE1"/><text x="34" y="60" fill="#1A1816" font-size="11" font-weight="bold">DAILY BIAS</text><path d="${trendY}" fill="none" stroke="#1F5C3E" stroke-width="2.5"/><rect x="20" y="82" width="680" height="42" fill="#F2EFE5"/><text x="34" y="106" fill="#1A1816" font-size="11" font-weight="bold">${impulseFrame} IMPULSE + OTE</text><line x1="190" y1="94" x2="680" y2="94" stroke="#1F5C3E" stroke-dasharray="4 3"/><text x="460" y="91" fill="#1F5C3E" font-size="9">62-79% retracement zone</text><rect x="20" y="130" width="680" height="48" fill="#E4EFE8"/><text x="34" y="151" fill="#1A1816" font-size="11" font-weight="bold">${entryFrame} TRIGGER</text>${lower}<line x1="410" y1="159" x2="684" y2="159" stroke="#A88948" stroke-dasharray="3 3"/><text x="410" y="177" fill="#A88948" font-size="9">close + structure confirmation, then define stop / target</text>`);
}

function renderPracticeTopic(heading, index) {
  const points = ['M70 130', 'M160 100', 'M250 145', 'M340 81', 'M430 116', 'M520 67', 'M640 92'];
  const coords = points.map(point => point.replace('M', '').trim()).join(' ');
  const bars = Array.from({ length: 7 }, (_, i) => {
    const x = 118 + i * 78;
    const value = [32, 20, 43, 15, 30, 13, 26][(i + index) % 7];
    return `<rect x="${x}" y="${164 - value}" width="34" height="${value}" fill="${i % 3 === 1 ? '#8F251E' : '#1F5C3E'}" opacity="0.78"/>`;
  }).join('');
  return svgFrame(`Demo journal review: ${heading}`, `<path d="${coords}" fill="none" stroke="#A88948" stroke-width="2.5"/><line x1="50" y1="164" x2="680" y2="164" stroke="#7D766D"/><text x="55" y="49" fill="#4A453F" font-size="10">Example R outcomes · review execution and costs, not just wins</text>${bars}<text x="55" y="181" fill="#7D766D" font-size="9">SIMULATED EXAMPLE · not a performance forecast</text>`);
}

function renderCandleTopic(heading, index) {
  const candles = index === 0
    ? [[74, 91, 50, 56], [56, 68, 35, 42], [42, 48, 12, 44], [45, 83, 43, 79]]
    : [[30, 45, 20, 38], [38, 60, 34, 55], [54, 88, 49, 56], [55, 59, 26, 31]];
  const label = index === 0 ? 'HIGH / OPEN / CLOSE / LOW' : 'LEVEL + CLOSED-CANDLE CONFIRMATION';
  return svgFrame(`${heading}: ${label}`, `${drawCandles(candles, { x: 110, y: 54, width: 450, height: 96, candleWidth: 24 })}<line x1="70" y1="151" x2="650" y2="151" stroke="#A88948" stroke-dasharray="5 4"/><text x="72" y="169" fill="#A88948" font-size="10">pre-marked decision zone</text><text x="460" y="46" fill="#1F5C3E" font-size="10">wait for bar close</text>`);
}

export function renderLessonTopicChart(lessonId, heading, index = 0) {
  let svg;
  switch (lessonId) {
    case 'lesson-1': svg = renderCandleTopic(heading, index); break;
    case 'lesson-2': svg = renderStructureTopic(heading, index); break;
    case 'lesson-3': svg = renderRetestTopic(heading, index); break;
    case 'lesson-4': svg = renderRiskTopic(heading, index); break;
    case 'lesson-5': svg = renderTopDownTopic(heading); break;
    case 'lesson-6': svg = renderVolumeProfileTopic(heading, index); break;
    case 'lesson-7': svg = renderFibonacciTopic(heading, index); break;
    case 'lesson-8':
    case 'lesson-9': svg = renderGoldSetupTopic(lessonId, heading, index); break;
    case 'lesson-10': svg = renderPracticeTopic(heading, index); break;
    case 'lesson-ipda': svg = renderIpdaTopic(heading, index); break;
    default: svg = renderStructureTopic(heading, index);
  }
  return `<figure class="lesson-chart" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Expand chart: ${esc(heading)}"><figcaption>Charting example · ${esc(heading)}</figcaption><div class="lesson-chart-scroll">${svg}</div><small>Schematic illustration for study; not live price data or a trade signal.</small></figure>`;
}