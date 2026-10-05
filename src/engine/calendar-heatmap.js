/**
 * Interactive Calendar & Session Heatmap Engine
 * Ledger & Wick — Archival Trading Journal
 *
 * Implements:
 * 1. Monthly Calendar Grid Builder with daily aggregation of trades, plans, and missed setups.
 * 2. Weekly Grid & Performance Matrix.
 * 3. Session Heatmap Engine mapping trades to market session blocks:
 *    - London (07:00 – 13:00 UTC)
 *    - New York AM (13:00 – 16:30 UTC)
 *    - New York PM (16:30 – 21:00 UTC)
 *    - Asian (00:00 – 07:00 UTC)
 *    - Overnight (21:00 – 24:00 UTC)
 * 4. P&L, trade frequency, win rate, and process compliance badges per session & day.
 * 5. Daily Drill-Down Audit Aggregator for deep day-level inspection.
 * 6. Strict isolation of educational sample trades from verified performance.
 */

import { isSampleTrade, filterPerformanceTrades } from './trade-provenance.js';
import { calculateWilsonConfidenceInterval } from './trader-review.js';

export const SESSION_BLOCKS = Object.freeze({
  LONDON: Object.freeze({
    id: 'LONDON',
    label: 'London Morning',
    shortLabel: 'London',
    icon: '🏛️',
    startUtcHour: 7.0,
    endUtcHour: 13.0,
    timeRange: '07:00 – 13:00 UTC',
    color: '#4A6984'
  }),
  NEW_YORK_AM: Object.freeze({
    id: 'NEW_YORK_AM',
    label: 'New York AM (Open)',
    shortLabel: 'NY AM',
    icon: '🗽',
    startUtcHour: 13.0,
    endUtcHour: 16.5,
    timeRange: '13:00 – 16:30 UTC',
    color: '#8A5A2B'
  }),
  NEW_YORK_PM: Object.freeze({
    id: 'NEW_YORK_PM',
    label: 'New York PM (Close)',
    shortLabel: 'NY PM',
    icon: '🌆',
    startUtcHour: 16.5,
    endUtcHour: 21.0,
    timeRange: '16:30 – 21:00 UTC',
    color: '#68452B'
  }),
  ASIAN: Object.freeze({
    id: 'ASIAN',
    label: 'Asian / Tokyo',
    shortLabel: 'Asian',
    icon: '⛩️',
    startUtcHour: 0.0,
    endUtcHour: 7.0,
    timeRange: '00:00 – 07:00 UTC',
    color: '#3A6073'
  }),
  OVERNIGHT: Object.freeze({
    id: 'OVERNIGHT',
    label: 'Overnight / Evening',
    shortLabel: 'Overnight',
    icon: '🌙',
    startUtcHour: 21.0,
    endUtcHour: 24.0,
    timeRange: '21:00 – 24:00 UTC',
    color: '#4A4A4A'
  })
});

export const SESSION_ORDER = Object.freeze(['ASIAN', 'LONDON', 'NEW_YORK_AM', 'NEW_YORK_PM', 'OVERNIGHT']);

export const DAYS_OF_WEEK = Object.freeze([
  { index: 1, key: 'MONDAY', label: 'Monday', short: 'Mon' },
  { index: 2, key: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { index: 3, key: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { index: 4, key: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { index: 5, key: 'FRIDAY', label: 'Friday', short: 'Fri' },
  { index: 6, key: 'SATURDAY', label: 'Saturday', short: 'Sat' },
  { index: 7, key: 'SUNDAY', label: 'Sunday', short: 'Sun' }
]);

export const CALENDAR_DISCLAIMER = Object.freeze({
  text: 'Calendar and session heatmap statistics reflect retrospective audit of historical trades. Past session edge or compliance does not guarantee future profitability.',
  isPrediction: false
});

/**
 * Classifies a trade or date/timestamp into a standard market session block.
 * Recognizes explicit session labels or automatically parses UTC hours and minutes.
 *
 * @param {Object|string|Date} tradeOrTime - Trade object, ISO string, or Date
 * @returns {Object} Session block definition
 */
export function classifySessionBlock(tradeOrTime) {
  if (!tradeOrTime) {
    return SESSION_BLOCKS.LONDON;
  }

  // 1. Check if trade has an explicit session property
  if (typeof tradeOrTime === 'object' && tradeOrTime.session) {
    const raw = String(tradeOrTime.session).toUpperCase().trim();
    if (raw.includes('NY AM') || raw.includes('NEW YORK AM') || raw.includes('US AM') || raw.includes('OPEN')) {
      return SESSION_BLOCKS.NEW_YORK_AM;
    }
    if (raw.includes('NY PM') || raw.includes('NEW YORK PM') || raw.includes('US PM') || raw.includes('AFTERNOON') || raw.includes('CLOSE')) {
      return SESSION_BLOCKS.NEW_YORK_PM;
    }
    if (raw.includes('LONDON') || raw.includes('EUROPE') || raw.includes('EU')) {
      return SESSION_BLOCKS.LONDON;
    }
    if (raw.includes('ASIA') || raw.includes('TOKYO') || raw.includes('SYDNEY')) {
      return SESSION_BLOCKS.ASIAN;
    }
    if (raw.includes('OVERNIGHT') || raw.includes('EVENING') || raw.includes('NIGHT')) {
      return SESSION_BLOCKS.OVERNIGHT;
    }
  }

  // 2. Parse timestamp from trade or string
  let dateObj = null;
  if (tradeOrTime instanceof Date) {
    dateObj = tradeOrTime;
  } else if (typeof tradeOrTime === 'string') {
    dateObj = new Date(tradeOrTime);
  } else if (typeof tradeOrTime === 'object') {
    const timeStr = tradeOrTime.entryDate || tradeOrTime.date || tradeOrTime.exitDate || tradeOrTime.plannedAt || tradeOrTime.loggedAt;
    if (timeStr) {
      dateObj = new Date(timeStr);
    }
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return SESSION_BLOCKS.LONDON; // Default fallback
  }

  const hours = dateObj.getUTCHours();
  const minutes = dateObj.getUTCMinutes();
  const decHour = hours + (minutes / 60);

  if (decHour >= 0 && decHour < 7.0) {
    return SESSION_BLOCKS.ASIAN;
  }
  if (decHour >= 7.0 && decHour < 13.0) {
    return SESSION_BLOCKS.LONDON;
  }
  if (decHour >= 13.0 && decHour < 16.5) {
    return SESSION_BLOCKS.NEW_YORK_AM;
  }
  if (decHour >= 16.5 && decHour < 21.0) {
    return SESSION_BLOCKS.NEW_YORK_PM;
  }
  return SESSION_BLOCKS.OVERNIGHT;
}

/**
 * Extracts normalized YYYY-MM-DD date string in UTC from any date representation.
 */
export function formatDateKey(dateInput) {
  if (!dateInput) return null;
  let d = null;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    // If it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    d = new Date(dateInput);
  } else if (typeof dateInput === 'object') {
    const val = dateInput.entryDate || dateInput.date || dateInput.plannedAt || dateInput.loggedAt;
    if (!val) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return val;
    }
    d = new Date(val);
  }

  if (!d || isNaN(d.getTime())) return null;

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Checks if a trade followed all written rules without violations.
 */
export function isTradeCompliant(trade) {
  if (!trade) return false;
  if (trade.isFullyCompliant === true) return true;
  if (Array.isArray(trade.violations) && trade.violations.length > 0) return false;
  if (trade.rulesFollowed) {
    if (trade.rulesFollowed.entry === false) return false;
    if (trade.rulesFollowed.stop === false) return false;
    if (trade.rulesFollowed.target === false) return false;
    if (trade.rulesFollowed.exit === false) return false;
  }
  return true;
}

/**
 * Aggregates daily trading, pre-planning, and missed setup activity.
 *
 * @param {Array} trades - Executed trades
 * @param {Array} plans - Pre-entry plans
 * @param {Array} missed - Missed setups
 * @param {Object} options - Options (excludeSample: boolean)
 * @returns {Map<string, Object>} Map of dateKey -> daily metrics
 */
export function aggregateDailyActivity(trades = [], plans = [], missed = [], options = {}) {
  const excludeSample = options.excludeSample !== false;
  const dailyMap = new Map();

  // Helper to get or init day record
  function getOrCreateDay(dateKey) {
    if (!dailyMap.has(dateKey)) {
      const parts = dateKey.split('-').map(Number);
      const dayDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      const rawDay = dayDate.getUTCDay(); // 0 is Sunday, 1 is Monday
      const dayOfWeek = rawDay === 0 ? 7 : rawDay;

      dailyMap.set(dateKey, {
        dateKey,
        year: parts[0],
        month: parts[1],
        dayNumber: parts[2],
        dayOfWeek,
        dayName: DAYS_OF_WEEK.find(d => d.index === dayOfWeek)?.label || '',
        dayShort: DAYS_OF_WEEK.find(d => d.index === dayOfWeek)?.short || '',
        trades: [],
        totalTrades: 0,
        wins: 0,
        losses: 0,
        scratches: 0,
        winRate: 0,
        winRateCI: null,
        netPnL: 0,
        grossProfit: 0,
        grossLoss: 0,
        profitFactor: 0,
        totalR: 0,
        compliantTrades: 0,
        violationCount: 0,
        complianceRate: 0,
        complianceCI: null,
        hasVisualEvidence: false,
        screenshotCount: 0,
        plans: [],
        plansCount: 0,
        missed: [],
        missedCount: 0,
        disciplineWins: 0,
        status: 'NO_TRADES', // PROFITABLE, LOSS, BREAKEVEN, NO_TRADES
        sessions: {
          ASIAN: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 },
          LONDON: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 },
          NEW_YORK_AM: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 },
          NEW_YORK_PM: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 },
          OVERNIGHT: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 }
        }
      });
    }
    return dailyMap.get(dateKey);
  }

  // 1. Process Trades
  const safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  safeTrades.forEach(trade => {
    if (excludeSample && isSampleTrade(trade)) {
      return;
    }
    const dateKey = formatDateKey(trade.entryDate || trade.date || trade.exitDate);
    if (!dateKey) return;

    const day = getOrCreateDay(dateKey);
    day.trades.push(trade);
    day.totalTrades++;

    const pnl = Number(trade.netPnL || 0);
    day.netPnL = Math.round((day.netPnL + pnl) * 100) / 100;

    if (pnl > 0) {
      day.wins++;
      day.grossProfit = Math.round((day.grossProfit + pnl) * 100) / 100;
    } else if (pnl < 0) {
      day.losses++;
      day.grossLoss = Math.round((day.grossLoss + Math.abs(pnl)) * 100) / 100;
    } else {
      day.scratches++;
    }

    const r = Number(trade.rMultiple || 0);
    day.totalR = Math.round((day.totalR + r) * 100) / 100;

    const compliant = isTradeCompliant(trade);
    if (compliant) {
      day.compliantTrades++;
    }
    const violations = Array.isArray(trade.violations) ? trade.violations.length : 0;
    day.violationCount += violations;

    if (trade.hasVisualEvidence || trade.screenshotUrl || trade.preEntryScreenshotUrl || trade.outcomeScreenshotUrl) {
      day.hasVisualEvidence = true;
      if (trade.preEntryScreenshotUrl) day.screenshotCount++;
      if (trade.outcomeScreenshotUrl) day.screenshotCount++;
      if (!trade.preEntryScreenshotUrl && !trade.outcomeScreenshotUrl && trade.screenshotUrl) day.screenshotCount++;
    }

    // Session tracking
    const sess = classifySessionBlock(trade);
    const sBucket = day.sessions[sess.id] || day.sessions.LONDON;
    sBucket.count++;
    sBucket.netPnL = Math.round((sBucket.netPnL + pnl) * 100) / 100;
    if (pnl > 0) sBucket.wins++;
    if (pnl < 0) sBucket.losses++;
    if (compliant) sBucket.compliant++;
  });

  // 2. Process Pre-Entry Plans
  const safePlans = Array.isArray(plans) ? plans.filter(Boolean) : [];
  safePlans.forEach(plan => {
    const dateKey = formatDateKey(plan.plannedAt || plan.date);
    if (!dateKey) return;
    const day = getOrCreateDay(dateKey);
    day.plans.push(plan);
    day.plansCount++;
    if (plan.screenshotUrl) {
      day.hasVisualEvidence = true;
      day.screenshotCount++;
    }
  });

  // 3. Process Missed Setups
  const safeMissed = Array.isArray(missed) ? missed.filter(Boolean) : [];
  safeMissed.forEach(m => {
    const dateKey = formatDateKey(m.loggedAt || m.date);
    if (!dateKey) return;
    const day = getOrCreateDay(dateKey);
    day.missed.push(m);
    day.missedCount++;
    if (m.isDisciplineWin) {
      day.disciplineWins++;
    }
    if (m.screenshotUrl) {
      day.hasVisualEvidence = true;
      day.screenshotCount++;
    }
  });

  // 4. Finalize Day Statistics & Confidence Intervals
  dailyMap.forEach(day => {
    if (day.totalTrades > 0) {
      day.winRate = Math.round((day.wins / day.totalTrades) * 1000) / 10;
      day.winRateCI = calculateWilsonConfidenceInterval(day.wins, day.totalTrades);
      day.complianceRate = Math.round((day.compliantTrades / day.totalTrades) * 1000) / 10;
      day.complianceCI = calculateWilsonConfidenceInterval(day.compliantTrades, day.totalTrades);

      if (day.grossLoss > 0) {
        day.profitFactor = Math.round((day.grossProfit / day.grossLoss) * 100) / 100;
      } else if (day.grossProfit > 0) {
        day.profitFactor = 99.99; // Cap for clean display
      } else {
        day.profitFactor = 0;
      }

      if (day.netPnL > 0) {
        day.status = 'PROFITABLE';
      } else if (day.netPnL < 0) {
        day.status = 'LOSS';
      } else {
        day.status = 'BREAKEVEN';
      }
    } else {
      day.status = 'NO_TRADES';
    }
  });

  return dailyMap;
}

/**
 * Builds a complete monthly calendar model with 7-column weeks starting on Monday.
 * Includes padding for previous month days and next month days.
 *
 * @param {number} year - Full year (e.g. 2026)
 * @param {number} monthIndex - Month (0 for Jan, 8 for Sep, etc.)
 * @param {Array} trades - Executed trades
 * @param {Array} plans - Pre-entry plans
 * @param {Array} missed - Missed setups
 * @param {Object} options - Custom options (excludeSample: boolean)
 */
export function buildMonthlyCalendar(year, monthIndex, trades = [], plans = [], missed = [], options = {}) {
  const currentYear = Number(year) || new Date().getUTCFullYear();
  const currentMonth = Number(monthIndex) >= 0 && Number(monthIndex) <= 11 ? Number(monthIndex) : new Date().getUTCMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[currentMonth];

  // Aggregated daily records
  const dailyMap = aggregateDailyActivity(trades, plans, missed, options);

  // Month boundary calculations in UTC
  const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
  const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
  const daysInCurrentMonth = lastDayOfMonth.getUTCDate();

  // First day weekday (1 = Monday, 7 = Sunday)
  const firstDayRaw = firstDayOfMonth.getUTCDay();
  const startDayOfWeek = firstDayRaw === 0 ? 7 : firstDayRaw;

  // Previous month boundary
  const prevMonthLastDay = new Date(Date.UTC(currentYear, currentMonth, 0));
  const daysInPrevMonth = prevMonthLastDay.getUTCDate();

  const weeks = [];
  let currentWeek = [];

  // 1. Prepend padding days from previous month
  const prevPaddingCount = startDayOfWeek - 1;
  for (let i = prevPaddingCount; i > 0; i--) {
    const dayNum = daysInPrevMonth - i + 1;
    const prevDate = new Date(Date.UTC(currentYear, currentMonth - 1, dayNum));
    const dateKey = formatDateKey(prevDate);
    const dayOfWeek = prevPaddingCount - i + 1;

    currentWeek.push({
      dateKey,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isPreviousMonth: true,
      isNextMonth: false,
      isToday: isSameCalendarDay(prevDate, new Date()),
      isWeekend: dayOfWeek >= 6,
      dayOfWeek,
      activity: dailyMap.get(dateKey) || null
    });
  }

  // 2. Add current month days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const thisDate = new Date(Date.UTC(currentYear, currentMonth, d));
    const dateKey = formatDateKey(thisDate);
    const rawDay = thisDate.getUTCDay();
    const dayOfWeek = rawDay === 0 ? 7 : rawDay;

    currentWeek.push({
      dateKey,
      dayNumber: d,
      isCurrentMonth: true,
      isPreviousMonth: false,
      isNextMonth: false,
      isToday: isSameCalendarDay(thisDate, new Date()),
      isWeekend: dayOfWeek >= 6,
      dayOfWeek,
      activity: dailyMap.get(dateKey) || null
    });

    if (currentWeek.length === 7) {
      weeks.push({
        weekNumber: weeks.length + 1,
        startDate: currentWeek[0].dateKey,
        endDate: currentWeek[6].dateKey,
        days: currentWeek
      });
      currentWeek = [];
    }
  }

  // 3. Append padding days for next month to complete final week
  if (currentWeek.length > 0) {
    const nextPaddingCount = 7 - currentWeek.length;
    for (let j = 1; j <= nextPaddingCount; j++) {
      const nextDate = new Date(Date.UTC(currentYear, currentMonth + 1, j));
      const dateKey = formatDateKey(nextDate);
      const rawDay = nextDate.getUTCDay();
      const dayOfWeek = rawDay === 0 ? 7 : rawDay;

      currentWeek.push({
        dateKey,
        dayNumber: j,
        isCurrentMonth: false,
        isPreviousMonth: false,
        isNextMonth: true,
        isToday: isSameCalendarDay(nextDate, new Date()),
        isWeekend: dayOfWeek >= 6,
        dayOfWeek,
        activity: dailyMap.get(dateKey) || null
      });
    }
    weeks.push({
      weekNumber: weeks.length + 1,
      startDate: currentWeek[0].dateKey,
      endDate: currentWeek[6].dateKey,
      days: currentWeek
    });
  }

  // 4. Compute Month Summary
  let totalTrades = 0;
  let tradingDaysCount = 0;
  let profitableDaysCount = 0;
  let losingDaysCount = 0;
  let breakEvenDaysCount = 0;
  let monthNetPnL = 0;
  let monthGrossProfit = 0;
  let monthGrossLoss = 0;
  let monthWins = 0;
  let monthLosses = 0;
  let monthTotalR = 0;
  let monthCompliantTrades = 0;
  let monthViolations = 0;
  let monthTradesWithVisuals = 0;
  let totalPlans = 0;
  let totalMissed = 0;
  let totalDisciplineWins = 0;

  const monthSessionTotals = {
    ASIAN: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 },
    LONDON: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 },
    NEW_YORK_AM: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 },
    NEW_YORK_PM: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 },
    OVERNIGHT: { count: 0, netPnL: 0, wins: 0, losses: 0, compliant: 0 }
  };

  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dDate = new Date(Date.UTC(currentYear, currentMonth, d));
    const k = formatDateKey(dDate);
    const act = dailyMap.get(k);

    if (act) {
      if (act.totalTrades > 0) {
        tradingDaysCount++;
        totalTrades += act.totalTrades;
        monthNetPnL = Math.round((monthNetPnL + act.netPnL) * 100) / 100;
        monthGrossProfit = Math.round((monthGrossProfit + act.grossProfit) * 100) / 100;
        monthGrossLoss = Math.round((monthGrossLoss + act.grossLoss) * 100) / 100;
        monthWins += act.wins;
        monthLosses += act.losses;
        monthTotalR = Math.round((monthTotalR + act.totalR) * 100) / 100;
        monthCompliantTrades += act.compliantTrades;
        monthViolations += act.violationCount;

        if (act.status === 'PROFITABLE') profitableDaysCount++;
        else if (act.status === 'LOSS') losingDaysCount++;
        else if (act.status === 'BREAKEVEN') breakEvenDaysCount++;

        if (act.hasVisualEvidence) monthTradesWithVisuals++;

        // Session roll-up
        Object.keys(monthSessionTotals).forEach(sId => {
          if (act.sessions[sId]) {
            monthSessionTotals[sId].count += act.sessions[sId].count;
            monthSessionTotals[sId].netPnL = Math.round((monthSessionTotals[sId].netPnL + act.sessions[sId].netPnL) * 100) / 100;
            monthSessionTotals[sId].wins += act.sessions[sId].wins;
            monthSessionTotals[sId].losses += act.sessions[sId].losses;
            monthSessionTotals[sId].compliant += act.sessions[sId].compliant;
          }
        });
      }

      totalPlans += act.plansCount;
      totalMissed += act.missedCount;
      totalDisciplineWins += act.disciplineWins;
    }
  }

  const monthWinRate = totalTrades > 0 ? Math.round((monthWins / totalTrades) * 1000) / 10 : 0;
  const monthWinRateCI = calculateWilsonConfidenceInterval(monthWins, totalTrades);
  const monthComplianceRate = totalTrades > 0 ? Math.round((monthCompliantTrades / totalTrades) * 1000) / 10 : 0;
  const monthComplianceCI = calculateWilsonConfidenceInterval(monthCompliantTrades, totalTrades);
  const dayWinRate = tradingDaysCount > 0 ? Math.round((profitableDaysCount / tradingDaysCount) * 1000) / 10 : 0;
  const monthVisualCoverageRate = totalTrades > 0 ? Math.round((monthTradesWithVisuals / totalTrades) * 1000) / 10 : 0;
  const monthProfitFactor = monthGrossLoss > 0
    ? Math.round((monthGrossProfit / monthGrossLoss) * 100) / 100
    : (monthGrossProfit > 0 ? 99.99 : 0);

  return {
    year: currentYear,
    monthIndex: currentMonth,
    monthName,
    monthKey: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
    weeks,
    daysInMonth: daysInCurrentMonth,
    summary: {
      totalTrades,
      tradingDaysCount,
      profitableDaysCount,
      losingDaysCount,
      breakEvenDaysCount,
      dayWinRate,
      monthNetPnL,
      monthGrossProfit,
      monthGrossLoss,
      monthProfitFactor,
      monthWinRate,
      monthWinRateCI,
      monthTotalR,
      monthCompliantTrades,
      monthViolations,
      monthComplianceRate,
      monthComplianceCI,
      monthTradesWithVisuals,
      monthVisualCoverageRate,
      totalPlans,
      totalMissed,
      totalDisciplineWins,
      sessionTotals: monthSessionTotals
    },
    disclaimer: CALENDAR_DISCLAIMER.text,
    isPrediction: false
  };
}

/**
 * Builds a weekly matrix summarizing performance by calendar weeks.
 */
export function buildWeeklyMatrix(year, monthIndex, trades = [], plans = [], missed = [], options = {}) {
  const monthData = buildMonthlyCalendar(year, monthIndex, trades, plans, missed, options);

  const weeklyRows = monthData.weeks.map(week => {
    let weekTrades = 0;
    let weekNetPnL = 0;
    let weekWins = 0;
    let weekLosses = 0;
    let weekCompliant = 0;
    let weekTotalR = 0;
    let weekViolations = 0;
    let weekPlans = 0;
    let weekMissed = 0;

    week.days.forEach(d => {
      if (d.activity) {
        weekTrades += d.activity.totalTrades;
        weekNetPnL = Math.round((weekNetPnL + d.activity.netPnL) * 100) / 100;
        weekWins += d.activity.wins;
        weekLosses += d.activity.losses;
        weekCompliant += d.activity.compliantTrades;
        weekTotalR = Math.round((weekTotalR + d.activity.totalR) * 100) / 100;
        weekViolations += d.activity.violationCount;
        weekPlans += d.activity.plansCount;
        weekMissed += d.activity.missedCount;
      }
    });

    const winRate = weekTrades > 0 ? Math.round((weekWins / weekTrades) * 1000) / 10 : 0;
    const complianceRate = weekTrades > 0 ? Math.round((weekCompliant / weekTrades) * 1000) / 10 : 0;
    const status = weekTrades === 0 ? 'NO_TRADES' : (weekNetPnL > 0 ? 'PROFITABLE' : (weekNetPnL < 0 ? 'LOSS' : 'BREAKEVEN'));

    return {
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      days: week.days,
      weekTrades,
      weekNetPnL,
      weekWins,
      weekLosses,
      weekWinRate: winRate,
      weekComplianceRate: complianceRate,
      weekComplianceCI: calculateWilsonConfidenceInterval(weekCompliant, weekTrades),
      weekTotalR,
      weekViolations,
      weekPlans,
      weekMissed,
      status
    };
  });

  return {
    year: monthData.year,
    monthName: monthData.monthName,
    weeks: weeklyRows,
    summary: monthData.summary
  };
}

/**
 * Generates an empirical Session Heatmap across all sessions and days of week.
 *
 * @param {Array} trades - Historical trades
 * @param {Object} options - Custom options (excludeSample: boolean)
 */
export function generateSessionHeatmap(trades = [], options = {}) {
  const excludeSample = options.excludeSample !== false;
  let safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];

  if (excludeSample) {
    safeTrades = safeTrades.filter(t => !isSampleTrade(t));
  }

  // 1. Initialize Matrix: Sessions x Days of Week
  const matrix = {};
  SESSION_ORDER.forEach(sessId => {
    matrix[sessId] = {};
    DAYS_OF_WEEK.forEach(day => {
      matrix[sessId][day.key] = {
        sessionId: sessId,
        dayKey: day.key,
        dayLabel: day.label,
        dayShort: day.short,
        tradeCount: 0,
        netPnL: 0,
        wins: 0,
        losses: 0,
        scratches: 0,
        totalR: 0,
        compliantTrades: 0,
        violations: 0,
        winRate: 0,
        complianceRate: 0,
        avgPnL: 0,
        intensity: 0 // Will be normalized (-1.0 to +1.0)
      };
    });
  });

  // 2. Initialize Session Totals
  const sessionSummaries = {};
  SESSION_ORDER.forEach(sessId => {
    const meta = SESSION_BLOCKS[sessId];
    sessionSummaries[sessId] = {
      id: sessId,
      label: meta.label,
      shortLabel: meta.shortLabel,
      icon: meta.icon,
      timeRange: meta.timeRange,
      color: meta.color,
      totalTrades: 0,
      netPnL: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      wins: 0,
      losses: 0,
      scratches: 0,
      totalR: 0,
      compliantTrades: 0,
      violations: 0,
      winRate: 0,
      winRateCI: null,
      complianceRate: 0,
      complianceCI: null,
      avgPnLPerTrade: 0,
      avgRPerTrade: 0
    };
  });

  const totalAllTrades = safeTrades.length;
  let maxAbsPnL = 1;

  // 3. Accumulate data
  safeTrades.forEach(trade => {
    const sess = classifySessionBlock(trade);
    const dateKey = formatDateKey(trade.entryDate || trade.date || trade.exitDate);
    if (!dateKey) return;

    const parts = dateKey.split('-').map(Number);
    const dObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const rawDay = dObj.getUTCDay();
    const dayIdx = rawDay === 0 ? 7 : rawDay;
    const dayMeta = DAYS_OF_WEEK.find(d => d.index === dayIdx);
    if (!dayMeta) return;

    const pnl = Number(trade.netPnL || 0);
    const r = Number(trade.rMultiple || 0);
    const compliant = isTradeCompliant(trade);
    const viol = Array.isArray(trade.violations) ? trade.violations.length : 0;

    // Cell Accumulator
    const cell = matrix[sess.id][dayMeta.key];
    cell.tradeCount++;
    cell.netPnL = Math.round((cell.netPnL + pnl) * 100) / 100;
    cell.totalR = Math.round((cell.totalR + r) * 100) / 100;
    if (pnl > 0) cell.wins++;
    else if (pnl < 0) cell.losses++;
    else cell.scratches++;
    if (compliant) cell.compliantTrades++;
    cell.violations += viol;

    if (Math.abs(cell.netPnL) > maxAbsPnL) {
      maxAbsPnL = Math.abs(cell.netPnL);
    }

    // Session Summary Accumulator
    const summ = sessionSummaries[sess.id];
    summ.totalTrades++;
    summ.netPnL = Math.round((summ.netPnL + pnl) * 100) / 100;
    if (pnl > 0) {
      summ.wins++;
      summ.grossProfit = Math.round((summ.grossProfit + pnl) * 100) / 100;
    } else if (pnl < 0) {
      summ.losses++;
      summ.grossLoss = Math.round((summ.grossLoss + Math.abs(pnl)) * 100) / 100;
    } else {
      summ.scratches++;
    }
    summ.totalR = Math.round((summ.totalR + r) * 100) / 100;
    if (compliant) summ.compliantTrades++;
    summ.violations += viol;
  });

  // 4. Compute Ratios & Intensities
  SESSION_ORDER.forEach(sessId => {
    DAYS_OF_WEEK.forEach(day => {
      const cell = matrix[sessId][day.key];
      if (cell.tradeCount > 0) {
        cell.winRate = Math.round((cell.wins / cell.tradeCount) * 1000) / 10;
        cell.complianceRate = Math.round((cell.compliantTrades / cell.tradeCount) * 1000) / 10;
        cell.avgPnL = Math.round((cell.netPnL / cell.tradeCount) * 100) / 100;
        // Normalized intensity between -1.0 and +1.0
        cell.intensity = Math.round((cell.netPnL / maxAbsPnL) * 100) / 100;
      }
    });

    const summ = sessionSummaries[sessId];
    if (summ.totalTrades > 0) {
      summ.winRate = Math.round((summ.wins / summ.totalTrades) * 1000) / 10;
      summ.winRateCI = calculateWilsonConfidenceInterval(summ.wins, summ.totalTrades);
      summ.complianceRate = Math.round((summ.compliantTrades / summ.totalTrades) * 1000) / 10;
      summ.complianceCI = calculateWilsonConfidenceInterval(summ.compliantTrades, summ.totalTrades);
      summ.avgPnLPerTrade = Math.round((summ.netPnL / summ.totalTrades) * 100) / 100;
      summ.avgRPerTrade = Math.round((summ.totalR / summ.totalTrades) * 100) / 100;
      summ.profitFactor = summ.grossLoss > 0
        ? Math.round((summ.grossProfit / summ.grossLoss) * 100) / 100
        : (summ.grossProfit > 0 ? 99.99 : 0);
      summ.tradeSharePercent = totalAllTrades > 0
        ? Math.round((summ.totalTrades / totalAllTrades) * 1000) / 10
        : 0;
    }
  });

  // 5. Generate Empirical Observations
  const observations = [];
  const activeSessions = Object.values(sessionSummaries).filter(s => s.totalTrades > 0);

  if (activeSessions.length > 0) {
    // Most active session
    const mostActive = [...activeSessions].sort((a, b) => b.totalTrades - a.totalTrades)[0];
    observations.push({
      id: 'session-activity-distribution',
      headline: `${mostActive.label} Most Active Block`,
      text: `In your historical ledger, ${mostActive.label} accounted for your highest trade activity with ${mostActive.totalTrades} of ${totalAllTrades} trades (${mostActive.tradeSharePercent}% of volume).`,
      sampleSize: totalAllTrades,
      isPrediction: false
    });

    // Highest compliance session
    const compliantRanked = [...activeSessions].filter(s => s.totalTrades >= 3).sort((a, b) => b.complianceRate - a.complianceRate);
    if (compliantRanked.length > 0) {
      const topCompliant = compliantRanked[0];
      observations.push({
        id: 'session-compliance-peak',
        headline: `${topCompliant.label} Peak Process Adherence`,
        text: `Your highest written rule compliance occurred during ${topCompliant.label} at ${topCompliant.complianceRate}% [95% CI: ${topCompliant.complianceCI.formatted}] across ${topCompliant.totalTrades} trades.`,
        sampleSize: topCompliant.totalTrades,
        isPrediction: false
      });
    }

    // Most profitable vs least profitable
    const pnlRanked = [...activeSessions].sort((a, b) => b.netPnL - a.netPnL);
    const topPnL = pnlRanked[0];
    const bottomPnL = pnlRanked[pnlRanked.length - 1];

    if (topPnL.netPnL > 0) {
      observations.push({
        id: 'session-pnl-leader',
        headline: `${topPnL.label} Generated Largest Cumulative P&L`,
        text: `Historical net return in ${topPnL.label} totaled +$${topPnL.netPnL.toFixed(2)} (+${topPnL.totalR.toFixed(2)}R) with a win rate of ${topPnL.winRate}% [95% CI: ${topPnL.winRateCI.formatted}] across ${topPnL.totalTrades} trades.`,
        sampleSize: topPnL.totalTrades,
        isPrediction: false
      });
    }

    if (bottomPnL.netPnL < 0 && bottomPnL.id !== topPnL.id) {
      observations.push({
        id: 'session-pnl-drag',
        headline: `${bottomPnL.label} Historical Friction`,
        text: `${bottomPnL.label} realized cumulative drawdown of -$${Math.abs(bottomPnL.netPnL).toFixed(2)} across ${bottomPnL.totalTrades} trades, with a rule compliance rate of ${bottomPnL.complianceRate}% [95% CI: ${bottomPnL.complianceCI.formatted}].`,
        sampleSize: bottomPnL.totalTrades,
        isPrediction: false
      });
    }
  }

  return {
    totalTradesAnalyzed: totalAllTrades,
    matrix,
    sessions: sessionSummaries,
    observations,
    disclaimer: CALENDAR_DISCLAIMER.text,
    isPrediction: false
  };
}

/**
 * Builds a comprehensive day-level audit bundle for modal inspection.
 *
 * @param {string} dateKey - 'YYYY-MM-DD'
 * @param {Array} trades - All trades
 * @param {Array} plans - Pre-entry plans
 * @param {Array} missed - Missed setups
 * @param {Object} options - Custom options
 */
export function buildDayAudit(dateKey, trades = [], plans = [], missed = [], options = {}) {
  const normKey = formatDateKey(dateKey);
  const dailyMap = aggregateDailyActivity(trades, plans, missed, options);
  const dayActivity = dailyMap.get(normKey);

  if (!dayActivity) {
    const parts = (normKey || '2026-01-01').split('-').map(Number);
    const dObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const rawDay = dObj.getUTCDay();
    const dayOfWeek = rawDay === 0 ? 7 : rawDay;

    return {
      dateKey: normKey,
      dayNumber: parts[2],
      dayName: DAYS_OF_WEEK.find(d => d.index === dayOfWeek)?.label || '',
      hasActivity: false,
      trades: [],
      plans: [],
      missed: [],
      summary: {
        totalTrades: 0,
        netPnL: 0,
        totalR: 0,
        winRate: 0,
        complianceRate: 0,
        violations: 0,
        status: 'NO_TRADES'
      }
    };
  }

  return {
    dateKey: normKey,
    dayNumber: dayActivity.dayNumber,
    dayName: dayActivity.dayName,
    hasActivity: dayActivity.totalTrades > 0 || dayActivity.plansCount > 0 || dayActivity.missedCount > 0,
    trades: dayActivity.trades,
    plans: dayActivity.plans,
    missed: dayActivity.missed,
    sessions: dayActivity.sessions,
    summary: {
      totalTrades: dayActivity.totalTrades,
      wins: dayActivity.wins,
      losses: dayActivity.losses,
      scratches: dayActivity.scratches,
      netPnL: dayActivity.netPnL,
      grossProfit: dayActivity.grossProfit,
      grossLoss: dayActivity.grossLoss,
      profitFactor: dayActivity.profitFactor,
      totalR: dayActivity.totalR,
      winRate: dayActivity.winRate,
      winRateCI: dayActivity.winRateCI,
      compliantTrades: dayActivity.compliantTrades,
      violations: dayActivity.violationCount,
      complianceRate: dayActivity.complianceRate,
      complianceCI: dayActivity.complianceCI,
      plansCount: dayActivity.plansCount,
      missedCount: dayActivity.missedCount,
      disciplineWins: dayActivity.disciplineWins,
      hasVisualEvidence: dayActivity.hasVisualEvidence,
      screenshotCount: dayActivity.screenshotCount,
      status: dayActivity.status
    }
  };
}

/**
 * Checks if two date objects fall on the same UTC calendar day.
 */
function isSameCalendarDay(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.getUTCFullYear() === d2.getUTCFullYear() &&
         d1.getUTCMonth() === d2.getUTCMonth() &&
         d1.getUTCDate() === d2.getUTCDate();
}
