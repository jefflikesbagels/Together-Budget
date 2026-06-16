/** @typedef {'needs' | 'wants' | 'savings'} ExpenseCategory */
/** @typedef {'partnerA' | 'partnerB'} PartnerId */
/** @typedef {'his' | 'hers' | 'combined'} ExpensePaidBy */

/**
 * @typedef {Object} LineItem
 * @property {string} id
 * @property {string} label
 * @property {number} amount
 */

/**
 * @typedef {LineItem & { paidBy: ExpensePaidBy }} ExpenseLineItem
 */

/**
 * @typedef {Object} BudgetState
 * @property {string} partnerAName
 * @property {string} partnerBName
 * @property {LineItem[]} partnerAIncome
 * @property {LineItem[]} partnerBIncome
 * @property {LineItem[]} needs
 * @property {LineItem[]} wants
 * @property {LineItem[]} savings
 * @property {LineItem[]} misc
 * @property {'monthly' | 'biweekly' | 'weekly'} period
 */

export const RULE = {
  needs: 0.5,
  wants: 0.3,
  savings: 0.2,
};

export const CATEGORY_META = {
  needs: { title: 'Needs (50%)', hint: 'Rent, utilities, groceries, insurance, minimum debt' },
  wants: { title: 'Wants (30%)', hint: 'Dining out, subscriptions, hobbies, travel' },
  savings: { title: 'Savings (20%)', hint: 'Emergency fund, retirement, extra debt payoff' },
};

const PERIOD_MULTIPLIER = {
  monthly: 1,
  biweekly: 26 / 12,
  weekly: 52 / 12,
};

export function uid() {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createLineItem(label = '', amount = 0) {
  return { id: uid(), label, amount };
}

/** @param {ExpensePaidBy} [paidBy] */
export function createExpenseItem(label = '', amount = 0, paidBy = 'combined') {
  return { id: uid(), label, amount, paidBy };
}

/** @param {LineItem[]} items */
export function normalizeExpenseItems(items) {
  return items.map((i) => ({
    ...i,
    paidBy:
      i.paidBy === 'his' || i.paidBy === 'hers' || i.paidBy === 'combined' ? i.paidBy : 'combined',
  }));
}

/** @param {ExpenseLineItem[]} items */
export function sumByPaidBy(items) {
  return items.reduce(
    (acc, i) => {
      const key = i.paidBy || 'combined';
      acc[key] += Number(i.amount) || 0;
      return acc;
    },
    { his: 0, hers: 0, combined: 0 }
  );
}

export function defaultState() {
  return {
    partnerAName: 'His',
    partnerBName: 'Hers',
    partnerAIncome: [
      createLineItem('Salary', 0),
      createLineItem('Side income', 0),
    ],
    partnerBIncome: [
      createLineItem('Salary', 0),
      createLineItem('Side income', 0),
    ],
    needs: [
      createExpenseItem('Rent / mortgage', 0, 'combined'),
      createExpenseItem('Utilities', 0, 'combined'),
      createExpenseItem('Groceries', 0, 'combined'),
      createExpenseItem('Insurance', 0, 'combined'),
    ],
    wants: [
      createExpenseItem('Dining & entertainment', 0, 'combined'),
      createExpenseItem('Subscriptions', 0, 'combined'),
    ],
    savings: [
      createExpenseItem('Emergency fund', 0, 'combined'),
      createExpenseItem('Retirement', 0, 'combined'),
    ],
    misc: [createLineItem('Car maintenance fund', 0)],
    period: 'monthly',
  };
}

/** Normalize any period input to monthly equivalent for 50/30/20. */
export function toMonthly(amount, period) {
  const mult = PERIOD_MULTIPLIER[period] ?? 1;
  return amount * mult;
}

export function sumItems(items) {
  return items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
}

/** True if any line item has a non-zero amount. */
export function hasBudgetData(budget) {
  if (!budget) return false;
  const lists = [
    budget.partnerAIncome,
    budget.partnerBIncome,
    budget.needs,
    budget.wants,
    budget.savings,
    budget.misc,
  ];
  return lists.some(
    (items) => Array.isArray(items) && items.some((i) => Number(i.amount) > 0)
  );
}

/**
 * @param {BudgetState} state
 */
export function calculate(state) {
  const incomeA = sumItems(state.partnerAIncome);
  const incomeB = sumItems(state.partnerBIncome);
  const combinedIncome = incomeA + incomeB;

  const needs = sumItems(state.needs);
  const wants = sumItems(state.wants);
  const savings = sumItems(state.savings);
  const miscNeeds = sumItems(state.misc);

  const totalNeeds = needs + miscNeeds;
  const totalAllocated = totalNeeds + wants + savings;
  const disposable = combinedIncome - totalAllocated;

  const targets = {
    needs: combinedIncome * RULE.needs,
    wants: combinedIncome * RULE.wants,
    savings: combinedIncome * RULE.savings,
  };

  const actuals = { needs: totalNeeds, wants, savings };
  const pctOfIncome = (n) => (combinedIncome > 0 ? (n / combinedIncome) * 100 : 0);

  const ruleStatus = {
    needs: compareToTarget(actuals.needs, targets.needs),
    wants: compareToTarget(actuals.wants, targets.wants),
    savings: compareToTarget(actuals.savings, targets.savings),
  };

  const donutSegments =
    combinedIncome > 0
      ? [
          { key: 'needs', value: totalNeeds, color: 'var(--c-needs)' },
          { key: 'wants', value: wants, color: 'var(--c-wants)' },
          { key: 'savings', value: savings, color: 'var(--c-savings)' },
          { key: 'free', value: Math.max(0, disposable), color: 'var(--c-free)' },
        ].filter((s) => s.value > 0)
      : [];

  return {
    incomeA,
    incomeB,
    combinedIncome,
    totalNeeds,
    wants,
    savings,
    miscNeeds,
    totalAllocated,
    disposable,
    targets,
    actuals,
    pctOfIncome: {
      needs: pctOfIncome(totalNeeds),
      wants: pctOfIncome(wants),
      savings: pctOfIncome(savings),
    },
    ruleStatus,
    donutSegments,
  };
}

function compareToTarget(actual, target) {
  if (target <= 0) return { status: 'neutral', delta: 0, pct: 0 };
  const delta = actual - target;
  const pct = (actual / target) * 100;
  let status = 'on-track';
  if (pct > 105) status = 'over';
  else if (pct < 95) status = 'under';
  return { status, delta, pct };
}

export function formatMoney(n, compact = false) {
  const abs = Math.abs(n);
  const opts = {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  };
  if (compact && abs >= 10000) {
    return new Intl.NumberFormat('en-US', { ...opts, notation: 'compact' }).format(n);
  }
  return new Intl.NumberFormat('en-US', opts).format(n);
}
