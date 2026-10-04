export const DEFAULT_PLAN_RULES = [
  { id: 'check-news', label: 'Check the economic calendar and avoid unplanned news exposure.' },
  { id: 'authorized-setup', label: 'Take only a named playbook setup; no impulse entries.' },
  { id: 'defined-risk', label: 'Define entry, stop, target, and position size before execution.' },
  { id: 'honor-stop', label: 'Never widen or remove the original stop.' },
  { id: 'risk-cap', label: 'Keep position risk within the personal risk limit.' },
  { id: 'daily-stop', label: 'Stop at the daily trade or loss limit; respect cooldowns.' },
  { id: 'journal-trade', label: 'Record the setup rationale and complete the trade debrief.' }
];

export const DEFAULT_TRADING_PLAN = {
  name: 'My Trading Plan',
  markets: '',
  tradingWindow: '',
  maxRiskPercent: 1,
  maxDailyTrades: 3,
  maxDailyLossR: 2,
  minimumRewardRisk: 2,
  customRules: []
};

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export function normalizeTradingPlan(plan = {}) {
  const source = plan && typeof plan === 'object' ? plan : {};
  const customRules = Array.isArray(source.customRules) ? source.customRules : [];
  const usedIds = new Set(DEFAULT_PLAN_RULES.map(rule => rule.id));

  return {
    name: String(source.name || DEFAULT_TRADING_PLAN.name).trim().slice(0, 80) || DEFAULT_TRADING_PLAN.name,
    markets: String(source.markets || '').trim().slice(0, 160),
    tradingWindow: String(source.tradingWindow || '').trim().slice(0, 100),
    maxRiskPercent: boundedNumber(source.maxRiskPercent, DEFAULT_TRADING_PLAN.maxRiskPercent, 0.1, 10),
    maxDailyTrades: Math.round(boundedNumber(source.maxDailyTrades, DEFAULT_TRADING_PLAN.maxDailyTrades, 1, 50)),
    maxDailyLossR: boundedNumber(source.maxDailyLossR, DEFAULT_TRADING_PLAN.maxDailyLossR, 0.1, 100),
    minimumRewardRisk: boundedNumber(source.minimumRewardRisk, DEFAULT_TRADING_PLAN.minimumRewardRisk, 0.1, 20),
    customRules: customRules
      .filter(rule => rule && typeof rule.label === 'string' && rule.label.trim())
      .slice(0, 20)
      .map((rule, index) => {
        let id = String(rule.id || `custom-${index + 1}`).trim().slice(0, 80);
        if (!id || usedIds.has(id)) id = `custom-${index + 1}`;
        while (usedIds.has(id)) id = `${id}-custom`;
        usedIds.add(id);
        return { id, label: rule.label.trim().slice(0, 160) };
      })
  };
}

export function evaluatePlanReadiness(plan, checkedRuleIds = []) {
  const normalized = normalizeTradingPlan(plan);
  const rules = [...DEFAULT_PLAN_RULES, ...normalized.customRules];
  const checked = new Set(checkedRuleIds);
  const missingRules = rules.filter(rule => !checked.has(rule.id));

  return {
    ready: missingRules.length === 0,
    completedCount: rules.length - missingRules.length,
    totalCount: rules.length,
    missingRules
  };
}

function dateKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function evaluatePlanTradeLimits({
  plan,
  trades = [],
  candidateRiskPercent,
  candidateDate = new Date().toISOString(),
  candidateRiskR = null
} = {}) {
  const normalized = normalizeTradingPlan(plan);
  const targetDate = dateKey(candidateDate);
  const todaysTrades = trades.filter(trade => dateKey(trade.entryDate) === targetDate);
  const todayLossR = todaysTrades.reduce((total, trade) => {
    const rMultiple = Number(trade.rMultiple) || 0;
    return total + (rMultiple < 0 ? Math.abs(rMultiple) : 0);
  }, 0);
  const breaches = [];

  if (Number(candidateRiskPercent) > normalized.maxRiskPercent) {
    breaches.push({
      code: 'PLAN_RISK_CAP',
      message: `Planned risk exceeds your ${normalized.maxRiskPercent}% per-trade plan limit.`
    });
  }
  if (todaysTrades.length >= normalized.maxDailyTrades) {
    breaches.push({
      code: 'PLAN_DAILY_TRADE_CAP',
      message: `Today's ${todaysTrades.length} trades have reached your ${normalized.maxDailyTrades}-trade limit.`
    });
  }
  if (todayLossR >= normalized.maxDailyLossR) {
    breaches.push({
      code: 'PLAN_DAILY_LOSS_CAP',
      message: `Today's loss is ${todayLossR.toFixed(2)}R, at or above your ${normalized.maxDailyLossR}R stop.`
    });
  }
  if (candidateRiskR !== null && candidateRiskR !== undefined && Number(candidateRiskR) > 0) {
    const projectedLossR = todayLossR + Number(candidateRiskR);
    if (todayLossR < normalized.maxDailyLossR && projectedLossR > (normalized.maxDailyLossR + 0.01)) {
      breaches.push({
        code: 'PLAN_PROJECTED_LOSS_CAP',
        message: `Projected loss of ${projectedLossR.toFixed(2)}R exceeds your ${normalized.maxDailyLossR}R daily loss stop if stopped out.`
      });
    }
  }

  return {
    canTrade: breaches.length === 0,
    todayTradesCount: todaysTrades.length,
    todayLossR: Math.round(todayLossR * 100) / 100,
    breaches
  };
}