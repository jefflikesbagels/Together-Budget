/** @typedef {'needs' | 'wants' | 'savings'} ExpenseCategory */
/** @typedef {'partnerA' | 'partnerB'} PartnerId */
/** @typedef {'his' | 'hers' | 'combined'} ExpensePaidBy */

/**
 * @typedef {Object} LineItem
 * @property {string} id
 * @property {string} label
 * @property {number} amount
 * @property {string} [iconKey]
 * @property {boolean} [iconCustom]
 */

/**
 * @typedef {LineItem & { paidBy: ExpensePaidBy }} ExpenseLineItem
 */

/**
 * @typedef {LineItem & { category: ExpenseCategory, saved?: number, target?: number }} MiscLineItem
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
 * @property {MiscLineItem[]} misc
 * @property {'monthly' | 'biweekly' | 'weekly'} period
 */

export const RULE = {
  needs: 0.5,
  wants: 0.3,
  savings: 0.2,
};

export const CATEGORY_META = {
  needs: { title: 'Needs (50%)', hint: 'Rent, electric, water, internet, groceries, insurance, minimum debt' },
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

/** @param {ExpenseCategory} [category] */
export function createMiscItem(label = '', amount = 0, category = 'needs', target = 0, saved = 0, iconKey = '') {
  return { id: uid(), label, amount, category, target, saved, iconKey, iconCustom: false };
}

/** @param {ExpensePaidBy} [paidBy] */
export function createExpenseItem(label = '', amount = 0, paidBy = 'combined', iconKey = '') {
  return { id: uid(), label, amount, paidBy, iconKey, iconCustom: false };
}

/** @param {LineItem[]} items */
export function normalizeExpenseItems(items) {
  return items.map((i) => ({
    ...i,
    paidBy:
      i.paidBy === 'his' || i.paidBy === 'hers' || i.paidBy === 'combined' ? i.paidBy : 'combined',
  }));
}

/** @param {LineItem[]} items */
export function normalizeMiscItems(items) {
  return items.map((i) => ({
    ...i,
    amount: Number(i.amount) || 0,
    saved: Number(i.saved ?? i.amount) || 0,
    target: Number(i.target) || 0,
    category:
      i.category === 'needs' || i.category === 'wants' || i.category === 'savings'
        ? i.category
        : 'needs',
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
      createExpenseItem('Electric', 0, 'combined'),
      createExpenseItem('Water', 0, 'combined'),
      createExpenseItem('Internet', 0, 'combined'),
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
    misc: [
      createMiscItem('Vacation', 200, 'wants', 3000, 1200),
      createMiscItem('New Car', 350, 'savings', 10000, 4500),
      createMiscItem('House Fund', 750, 'savings', 50000, 15000),
    ],
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

/** @param {MiscLineItem[]} items */
export function sumMiscByCategory(items) {
  return items.reduce(
    (acc, item) => {
      const category = RULE[item.category] == null ? 'needs' : item.category;
      acc[category] += Number(item.amount) || 0;
      return acc;
    },
    { needs: 0, wants: 0, savings: 0 }
  );
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
  const miscByCategory = sumMiscByCategory(state.misc);

  const actuals = {
    needs: needs + miscByCategory.needs,
    wants: wants + miscByCategory.wants,
    savings: savings + miscByCategory.savings,
  };

  const totalNeeds = actuals.needs;
  const totalAllocated = actuals.needs + actuals.wants + actuals.savings;
  const disposable = combinedIncome - totalAllocated;

  const targets = {
    needs: combinedIncome * RULE.needs,
    wants: combinedIncome * RULE.wants,
    savings: combinedIncome * RULE.savings,
  };

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
          { key: 'wants', value: actuals.wants, color: 'var(--c-wants)' },
          { key: 'savings', value: actuals.savings, color: 'var(--c-savings)' },
          { key: 'free', value: Math.max(0, disposable), color: 'var(--c-free)' },
        ].filter((s) => s.value > 0)
      : [];

  return {
    incomeA,
    incomeB,
    combinedIncome,
    totalNeeds,
    wants: actuals.wants,
    savings: actuals.savings,
    miscNeeds: miscByCategory.needs,
    miscByCategory,
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
