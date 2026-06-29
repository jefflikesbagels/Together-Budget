import {
  calculate,
  CATEGORY_META,
  createExpenseItem,
  createLineItem,
  createMiscItem,
  defaultState,
  formatMoney,
  normalizeExpenseItems,
  normalizeMiscItems,
  sumByPaidBy,
} from './budget.js?v=goal-icon-picker-v1';
import {
  clearLocalBudget,
  loadFromLocal,
  parseImportedBudget,
  saveToLocal,
  testLocalStorage,
} from './storage.js?v=goal-icon-picker-v1';

/** @type {import('./budget.js').BudgetState} */
let state = defaultState();
let saveInFlight = false;
let localStorageAvailable = testLocalStorage();

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const CATEGORY_KEYS = ['needs', 'wants', 'savings'];
const RAIN_SPRITES = [
  ['0%', '0%'],
  ['50%', '0%'],
  ['100%', '0%'],
  ['0%', '100%'],
  ['50%', '100%'],
  ['100%', '100%'],
];
const ICON_SET_ONE = [
  ['home', 'Home'],
  ['electric', 'Electric'],
  ['water', 'Water'],
  ['internet', 'Internet'],
  ['shopping-basket', 'Shopping basket'],
  ['car', 'Car'],
  ['groceries', 'Groceries'],
  ['insurance-shield', 'Insurance'],
  ['medical-shield', 'Medical'],
  ['first-aid-kit', 'First aid'],
  ['piggy-bank', 'Piggy bank'],
  ['dining', 'Dining'],
  ['star', 'Star'],
  ['ticket', 'Ticket'],
  ['gaming', 'Gaming'],
  ['fitness', 'Fitness'],
  ['books', 'Books'],
  ['palm-tree', 'Palm tree'],
  ['luggage', 'Luggage'],
  ['airplane', 'Airplane'],
  ['gift', 'Gift'],
  ['heart', 'Heart'],
  ['pet-paw', 'Pet'],
  ['leaf', 'Leaf'],
  ['credit-card', 'Credit card'],
  ['bank', 'Bank'],
  ['bar-chart', 'Chart'],
  ['education', 'Education'],
  ['shield-check', 'Shield check'],
];

const ICON_SET_TWO = [
  ['salary', 'Salary'],
  ['phone', 'Phone'],
  ['side-income', 'Side income'],
  ['commission', 'Commission'],
  ['invoicing', 'Invoicing'],
  ['client-work', 'Client work'],
  ['passive-income', 'Passive income'],
  ['contract-work', 'Contract work'],
  ['baby-needs', 'Baby needs'],
  ['health', 'Health'],
  ['life-security', 'Life security'],
  ['prescriptions', 'Prescriptions'],
  ['tuition', 'Tuition'],
  ['home-maintenance', 'Home maintenance'],
  ['pet-health', 'Pet health'],
  ['subscriptions-refresh', 'Subscriptions'],
  ['live-events', 'Live events'],
  ['creative-hobbies', 'Creative hobbies'],
  ['photography', 'Photography'],
  ['outdoor-activities', 'Outdoor'],
  ['experiences', 'Experiences'],
  ['wellness', 'Wellness'],
  ['treats', 'Treats'],
  ['fun-money', 'Fun money'],
  ['financial-goals', 'Financial goals'],
  ['savings-goals', 'Savings goals'],
  ['future-planning', 'Future planning'],
  ['wealth-building', 'Wealth building'],
  ['long-term-plan', 'Long-term plan'],
  ['risk-protection', 'Risk protection'],
  ['milestones', 'Milestones'],
  ['achievements', 'Achievements'],
  ['cashback', 'Cashback'],
  ['local-deals', 'Local deals'],
  ['transportation', 'Transportation'],
  ['gift-cards', 'Gift cards'],
  ['digital-wallet', 'Digital wallet'],
  ['cloud-storage', 'Cloud storage'],
  ['renters-insurance', 'Renters insurance'],
  ['estate-planning', 'Estate planning'],
];

const GOAL_ICON_SET = [
  ['savings', 'Savings'],
  ['travel', 'Travel'],
  ['car', 'Car'],
  ['house', 'House'],
  ['pc', 'Computer'],
];

const EXPENSE_ICON_OPTIONS = [
  ...ICON_SET_ONE.map(([name, label]) => ({ key: `set/${name}`, label, src: iconSet(name) })),
  ...ICON_SET_TWO.map(([name, label]) => ({ key: `set2/${name}`, label, src: iconSet2(name) })),
];
const EXPENSE_ICON_BY_KEY = new Map(EXPENSE_ICON_OPTIONS.map((option) => [option.key, option]));
const GOAL_ICON_OPTIONS = GOAL_ICON_SET.map(([name, label]) => ({
  key: `goal/${name}`,
  label,
  src: goalIconSet(name),
}));
const GOAL_ICON_BY_KEY = new Map(GOAL_ICON_OPTIONS.map((option) => [option.key, option]));
const CATEGORY_ICON_KEYS = {
  needs: 'set/home',
  wants: 'set2/experiences',
  savings: 'set2/savings-goals',
};
const GOAL_TONE_CLASSES = ['goal-tone-yellow', 'goal-tone-pink', 'goal-tone-cyan'];

const VIEW_TITLES = {
  overview: 'Overview',
  income: 'Income',
  expenses: 'Expenses',
  goals: 'Goals',
};
const HEADER_ART = {
  overview: {
    label: 'Budget Overview',
    titleSrc: 'assets/branding/budget-overview-title.png?v=budget-overview-title-v1',
    symbolSrc: '',
  },
  income: {
    label: 'Budget Income',
    titleSrc: 'assets/branding/budget-income-title-v2.png?v=tab-title-v2',
    symbolSrc: 'assets/illustrations/tab-symbol-income-v2.png?v=tab-symbol-v3',
  },
  expenses: {
    label: 'Budget Expenses',
    titleSrc: 'assets/branding/budget-expenses-title-v2.png?v=tab-title-v2',
    symbolSrc: 'assets/illustrations/tab-symbol-expenses-v2.png?v=tab-symbol-v3',
  },
  goals: {
    label: 'Budget Goals',
    titleSrc: 'assets/branding/budget-goals-title-v2.png?v=tab-title-v2',
    symbolSrc: 'assets/illustrations/tab-symbol-goals-v2.png?v=tab-symbol-v2',
  },
};

function goalToneClass(index) {
  return GOAL_TONE_CLASSES[index % GOAL_TONE_CLASSES.length];
}

function splitAmountInCents(amount, parts) {
  const cents = Math.round((Number(amount) || 0) * 100);
  const base = Math.trunc(cents / parts);
  const remainder = cents - base * parts;
  return Array.from({ length: parts }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

function normalizeNeedsItems(items) {
  const normalized = normalizeExpenseItems(items);
  const labels = new Set(normalized.map((item) => item.label.trim().toLowerCase()));
  const alreadySplit = ['electric', 'water', 'internet'].every((label) => labels.has(label));

  return normalized.flatMap((item) => {
    if (item.label.trim().toLowerCase() !== 'utilities') return item;
    if (alreadySplit) return [];

    const [electric, water, internet] = splitAmountInCents(item.amount, 3);
    const paidBy = item.paidBy || 'combined';
    return [
      createExpenseItem('Electric', electric, paidBy),
      createExpenseItem('Water', water, paidBy),
      createExpenseItem('Internet', internet, paidBy),
    ];
  });
}

function updateHeaderArt(view) {
  const art = HEADER_ART[view] || HEADER_ART.overview;
  const title = $('.header__title');
  const titleArt = $('#headerTitleArt');
  const symbol = $('#headerSectionSymbol');

  title?.setAttribute('aria-label', art.label);
  if (titleArt) titleArt.src = art.titleSrc;

  if (!symbol) return;
  if (art.symbolSrc) {
    symbol.src = art.symbolSrc;
    symbol.hidden = false;
  } else {
    symbol.removeAttribute('src');
    symbol.hidden = true;
  }
}

function setActiveView(view) {
  const nextView = VIEW_TITLES[view] ? view : 'overview';
  updateHeaderArt(nextView);
  $$('[data-view-target]').forEach((button) => {
    const isActive = button.dataset.viewTarget === nextView;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  $$('[data-view]').forEach((panel) => {
    const isActive = panel.dataset.view === nextView;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mergeLoadedState(saved) {
  const base = defaultState();
  return {
    ...base,
    ...saved,
    partnerAName: saved.partnerAName ?? base.partnerAName,
    partnerBName: saved.partnerBName ?? base.partnerBName,
    partnerAIncome: Array.isArray(saved.partnerAIncome) ? saved.partnerAIncome : base.partnerAIncome,
    partnerBIncome: Array.isArray(saved.partnerBIncome) ? saved.partnerBIncome : base.partnerBIncome,
    needs: normalizeNeedsItems(Array.isArray(saved.needs) ? saved.needs : base.needs),
    wants: normalizeExpenseItems(Array.isArray(saved.wants) ? saved.wants : base.wants),
    savings: normalizeExpenseItems(Array.isArray(saved.savings) ? saved.savings : base.savings),
    misc: normalizeMiscItems(Array.isArray(saved.misc) ? saved.misc : base.misc),
    period: saved.period ?? base.period,
  };
}

function paidByLabels() {
  return {
    his: state.partnerAName || 'His',
    hers: state.partnerBName || 'Hers',
    combined: 'Combined',
  };
}

function fillPaidBySelect(select, selected) {
  const labels = paidByLabels();
  select.innerHTML = '';
  ['his', 'hers', 'combined'].forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = labels[value];
    if (value === selected) opt.selected = true;
    select.appendChild(opt);
  });
}

function updatePaidByLabels() {
  const labels = paidByLabels();
  $$('.line-item__paid-by', $('#expensesGrid')).forEach((select) => {
    $$('option', select).forEach((opt) => {
      opt.textContent = labels[opt.value] ?? opt.value;
    });
  });
}

async function saveState() {
  if (saveInFlight) return false;
  saveInFlight = true;
  try {
    if (!localStorageAvailable) {
      showSaveStatus('unavailable');
      return false;
    }
    saveToLocal(state);
    showSaveStatus('saved');
    return true;
  } catch (err) {
    showSaveStatus('error');
    return false;
  } finally {
    saveInFlight = false;
  }
}

let saveStatusTimer;
function showSaveStatus(kind) {
  const el = $('#saveStatus');
  if (!el) return;
  const messages = {
    loading: 'Loading…',
    saved: 'Saved locally',
    error: 'Could not save — use Ctrl+S to export a backup',
    unavailable: 'Local browser storage is unavailable',
    cleared: 'Local data cleared',
  };
  el.textContent = messages[kind] ?? '';
  el.dataset.state = kind;
  clearTimeout(saveStatusTimer);
  if (kind === 'saved' || kind === 'cleared') {
    saveStatusTimer = setTimeout(() => {
      el.textContent = '';
      delete el.dataset.state;
    }, 2000);
  }
}

function flushLocalSave() {
  if (!localStorageAvailable) return false;
  try {
    saveToLocal(state);
    return true;
  } catch {
    showSaveStatus('error');
    return false;
  }
}

function debounce(fn, ms = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const scheduleSave = debounce(() => saveState(), 350);
const scheduleUpdateComputed = debounce(updateComputed, 80);

function mountBudgetRain() {
  const layer = $('#budgetRain');
  if (!layer) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = window.matchMedia('(max-width: 720px)').matches;
  const count = reduceMotion ? 18 : compact ? 30 : 56;
  const fragment = document.createDocumentFragment();

  layer.replaceChildren();

  for (let index = 0; index < count; index += 1) {
    const icon = document.createElement('span');
    const [spriteX, spriteY] = RAIN_SPRITES[index % RAIN_SPRITES.length];
    const left = (index / count) * 100 + (Math.random() * 3.8 - 1.9);
    const size = compact ? 28 + Math.random() * 24 : 30 + Math.random() * 34;
    const duration = 13 + Math.random() * 16;
    const delay = reduceMotion ? 0 : -Math.random() * duration;
    const drift = Math.random() * 38 - 19;
    const rotate = Math.random() * 46 - 23;
    const spin = Math.random() > 0.5 ? 18 + Math.random() * 36 : -18 - Math.random() * 36;
    const opacity = 0.38 + Math.random() * 0.38;
    const rest = `${Math.random() * 100}vh`;

    icon.className = 'budget-rain__icon';
    icon.style.setProperty('--sprite-x', spriteX);
    icon.style.setProperty('--sprite-y', spriteY);
    icon.style.setProperty('--rain-left', `${Math.max(-3, Math.min(103, left))}%`);
    icon.style.setProperty('--rain-size', `${size}px`);
    icon.style.setProperty('--rain-duration', `${duration}s`);
    icon.style.setProperty('--rain-delay', `${delay}s`);
    icon.style.setProperty('--rain-drift', `${drift}px`);
    icon.style.setProperty('--rain-rotate', `${rotate}deg`);
    icon.style.setProperty('--rain-spin', `${spin}deg`);
    icon.style.setProperty('--rain-opacity', opacity.toFixed(2));
    icon.style.setProperty('--rain-rest', rest);
    fragment.appendChild(icon);
  }

  layer.appendChild(fragment);
}

/** Save locally; debounce only chart/total updates. */
function onDataChange() {
  scheduleSave();
  scheduleUpdateComputed();
}

function incomeIconType(label) {
  const text = label.trim().toLowerCase();
  if (text.includes('side') || text.includes('freelance') || text.includes('hustle') || text.includes('gig')) {
    return 'side-income';
  }
  return 'salary';
}

function incomeIconSrc(type) {
  const safeType = type === 'side-income' ? 'side-income' : 'salary';
  return `assets/icons/icon-set-2/${safeType}.png`;
}

function bindLineList(container, items) {
  const list = $('[data-items]', container);
  const tpl = $('#lineItemTemplate');

  function renderItems() {
    list.innerHTML = '';
    items.forEach((item) => {
      const node = tpl.content.cloneNode(true);
      const li = node.querySelector('.line-item');
      const icon = $('.line-item__income-icon', li);
      const label = $('.line-item__label', li);
      const amount = $('.line-item__amount', li);
      label.value = item.label;
      amount.value = item.amount === 0 ? '' : item.amount;
      const updateIcon = () => {
        const type = incomeIconType(label.value);
        icon.src = incomeIconSrc(type);
      };
      updateIcon();
      label.addEventListener('input', () => {
        item.label = label.value;
        updateIcon();
        onDataChange();
      });
      amount.addEventListener('input', () => {
        item.amount = parseFloat(amount.value) || 0;
        onDataChange();
      });
      $('.line-item__remove', li).addEventListener('click', () => {
        const idx = items.indexOf(item);
        if (idx >= 0) items.splice(idx, 1);
        saveState();
        renderItems();
        updateComputed();
      });
      list.appendChild(node);
    });
  }

  renderItems();
  return {
    addItem: () => {
      items.push(createLineItem('', 0));
      saveState();
      renderItems();
      updateComputed();
    },
  };
}

function mountPartners() {
  const grid = $('#partnersGrid');
  grid.innerHTML = '';
  const tpl = $('#partnerTemplate');
  const partners = [
    { id: 'partnerA', key: 'partnerAIncome', nameKey: 'partnerAName', accent: 'his' },
    { id: 'partnerB', key: 'partnerBIncome', nameKey: 'partnerBName', accent: 'hers' },
  ];

  partners.forEach((p) => {
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector('.partner-card');
    card.dataset.partnerId = p.id;
    card.classList.add(`partner-card--${p.accent}`);
    const nameInput = $('.partner-card__name', card);
    nameInput.value = state[p.nameKey];
    nameInput.addEventListener('input', () => {
      state[p.nameKey] = nameInput.value;
      onDataChange();
    });

    const api = bindLineList(card, state[p.key]);
    $('.btn--add', card).addEventListener('click', () => api.addItem());
    grid.appendChild(node);
  });
}

function iconOptionForKey(key) {
  return EXPENSE_ICON_BY_KEY.get(key) || EXPENSE_ICON_BY_KEY.get('set2/financial-goals');
}

function expenseIconKeyFor(label, category, index) {
  const text = label.trim().toLowerCase();
  if (!text) return category === 'savings' ? 'set2/savings-goals' : category === 'wants' ? 'set2/fun-money' : 'set2/financial-goals';
  if (text.includes('phone') || text.includes('cell')) return 'set2/phone';
  if (text.includes('kid') || text.includes('child') || text.includes('baby')) return 'set2/baby-needs';
  if (text.includes('pc') || text.includes('computer') || text.includes('cloud') || text.includes('storage') || text.includes('software')) return 'set2/cloud-storage';
  if (text.includes('maintenance') || text.includes('repair')) return 'set2/home-maintenance';
  if (text.includes('pet')) return 'set2/pet-health';
  if (text.includes('prescription') || text.includes('rx') || text.includes('medicine')) return 'set2/prescriptions';
  if (text.includes('tuition') || text.includes('school')) return 'set2/tuition';
  if (text.includes('renters')) return 'set2/renters-insurance';
  if (text.includes('estate')) return 'set2/estate-planning';
  if (text.includes('risk')) return 'set2/risk-protection';
  if (text.includes('cashback')) return 'set2/cashback';
  if (text.includes('deal')) return 'set2/local-deals';
  if (text.includes('wallet')) return 'set2/digital-wallet';
  if (text.includes('rent') || text.includes('mortgage') || text.includes('home') || text.includes('house')) return 'set/home';
  if (text.includes('water') || text.includes('sewer')) return 'set/water';
  if (text.includes('internet') || text.includes('wifi') || text.includes('wi-fi') || text.includes('broadband')) return 'set/internet';
  if (text.includes('util') || text.includes('electric') || text.includes('power') || text.includes('gas')) return 'set/electric';
  if (text.includes('grocery') || text.includes('groceries') || text.includes('food') || text.includes('market')) return 'set/groceries';
  if (text.includes('life security')) return 'set2/life-security';
  if (text.includes('medical') || text.includes('health') || text.includes('doctor')) return 'set2/health';
  if (text.includes('insur')) return 'set/insurance-shield';
  if (text.includes('transport') || text.includes('bike') || text.includes('bus')) return 'set2/transportation';
  if (text.includes('car') || text.includes('auto')) return 'set/car';
  if (text.includes('dining') || text.includes('restaurant') || text.includes('out')) return 'set/dining';
  if (text.includes('subscription') || text.includes('stream') || text.includes('member')) return 'set2/subscriptions-refresh';
  if (text.includes('entertain') || text.includes('movie') || text.includes('ticket') || text.includes('experience')) return 'set2/experiences';
  if (text.includes('live event') || text.includes('concert')) return 'set2/live-events';
  if (text.includes('creative')) return 'set2/creative-hobbies';
  if (text.includes('photo')) return 'set2/photography';
  if (text.includes('outdoor')) return 'set2/outdoor-activities';
  if (text.includes('wellness')) return 'set2/wellness';
  if (text.includes('treat')) return 'set2/treats';
  if (text.includes('fun money')) return 'set2/fun-money';
  if (text.includes('hobby') || text.includes('game')) return 'set/gaming';
  if (text.includes('shopping')) return 'set/shopping-basket';
  if (text.includes('fitness') || text.includes('gym')) return 'set/fitness';
  if (text.includes('book')) return 'set/books';
  if (text.includes('education')) return 'set/education';
  if (text.includes('retire')) return 'set/palm-tree';
  if (text.includes('vacation') || text.includes('travel') || text.includes('trip') || text.includes('flight')) return 'set/airplane';
  if (text.includes('emergency')) return 'set/first-aid-kit';
  if (text.includes('gift card')) return 'set2/gift-cards';
  if (text.includes('gift')) return 'set/gift';
  if (text.includes('wealth')) return 'set2/wealth-building';
  if (text.includes('long term')) return 'set2/long-term-plan';
  if (text.includes('future')) return 'set2/future-planning';
  if (text.includes('financial goal')) return 'set2/financial-goals';
  if (text.includes('savings goal')) return 'set2/savings-goals';
  if (text.includes('save') || text.includes('fund')) return 'set/piggy-bank';
  if (category === 'wants') return index === 0 ? 'set/dining' : 'set2/fun-money';
  if (category === 'savings') return index === 0 ? 'set/first-aid-kit' : 'set2/savings-goals';
  return ['set/home', 'set/electric', 'set/groceries', 'set/insurance-shield'][index % 4];
}

function expenseIconKeyForItem(item, category, index) {
  return item.iconCustom && item.iconKey && EXPENSE_ICON_BY_KEY.has(item.iconKey)
    ? item.iconKey
    : expenseIconKeyFor(item.label || '', category, index);
}

function expenseIconSrcFor(item, category, index) {
  return iconOptionForKey(expenseIconKeyForItem(item, category, index)).src;
}

function setExpenseIcon(icon, key) {
  const option = iconOptionForKey(key);
  icon.dataset.icon = option.key;
  icon.src = option.src;
  icon.title = option.label;
}

function closeExpenseIconMenus(exceptMenu = null) {
  $$('[data-expense-icon-menu]').forEach((menu) => {
    if (menu !== exceptMenu) menu.hidden = true;
  });
}

function renderExpenseIconMenu(menu, item, category, index, icon) {
  menu.innerHTML = '';
  const activeKey = expenseIconKeyForItem(item, category, index);

  EXPENSE_ICON_OPTIONS.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'expense-icon-menu__option';
    button.classList.toggle('is-selected', option.key === activeKey);
    button.setAttribute('aria-label', option.label);
    button.title = option.label;
    button.dataset.iconKey = option.key;

    const image = document.createElement('img');
    image.src = option.src;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    button.appendChild(image);

    button.addEventListener('click', () => {
      item.iconKey = option.key;
      item.iconCustom = true;
      setExpenseIcon(icon, option.key);
      menu.hidden = true;
      onDataChange();
    });

    menu.appendChild(button);
  });
}

function bindExpenseLineList(container, items, category) {
  const list = $('[data-items]', container);
  const tpl = $('#expenseLineItemTemplate');

  function renderItems() {
    list.innerHTML = '';
    items.forEach((item, index) => {
      const node = tpl.content.cloneNode(true);
      const li = node.querySelector('.line-item');
      const icon = $('[data-expense-icon]', li);
      const iconButton = $('.line-item__expense-icon-button', li);
      const iconMenu = $('[data-expense-icon-menu]', li);
      const label = $('.line-item__label', li);
      const paidBy = $('.line-item__paid-by', li);
      const amount = $('.line-item__amount', li);
      label.value = item.label;
      setExpenseIcon(icon, expenseIconKeyForItem(item, category, index));
      iconButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const shouldOpen = iconMenu.hidden;
        closeExpenseIconMenus(iconMenu);
        iconMenu.hidden = !shouldOpen;
        if (shouldOpen) renderExpenseIconMenu(iconMenu, item, category, index, icon);
      });
      fillPaidBySelect(paidBy, item.paidBy || 'combined');
      amount.value = item.amount === 0 ? '' : item.amount;
      label.addEventListener('input', () => {
        item.label = label.value;
        if (!item.iconCustom) setExpenseIcon(icon, expenseIconKeyForItem(item, category, index));
        onDataChange();
      });
      paidBy.addEventListener('change', () => {
        item.paidBy = paidBy.value;
        onDataChange();
      });
      amount.addEventListener('input', () => {
        item.amount = parseFloat(amount.value) || 0;
        onDataChange();
      });
      $('.line-item__remove', li).addEventListener('click', () => {
        const idx = items.indexOf(item);
        if (idx >= 0) items.splice(idx, 1);
        saveState();
        renderItems();
        updateComputed();
      });
      list.appendChild(node);
    });
  }

  renderItems();
  return {
    addItem: () => {
      items.push(createExpenseItem('', 0, 'combined'));
      saveState();
      renderItems();
      updateComputed();
    },
  };
}

function mountExpenses() {
  const grid = $('#expensesGrid');
  grid.innerHTML = '';
  const tpl = $('#categoryTemplate');
  const cats = ['needs', 'wants', 'savings'];

  cats.forEach((cat) => {
    const node = tpl.content.cloneNode(true);
    const block = node.querySelector('.expense-category');
    block.dataset.category = cat;
    $('.expense-category__title', block).textContent = CATEGORY_META[cat].title;
    const categoryIcon = document.createElement('img');
    categoryIcon.src = iconOptionForKey(CATEGORY_ICON_KEYS[cat]).src;
    categoryIcon.alt = '';
    categoryIcon.setAttribute('aria-hidden', 'true');
    $('[data-category-icon]', block).replaceChildren(categoryIcon);

    const api = bindExpenseLineList(block, state[cat], cat);
    $('.btn--add', block).addEventListener('click', () => api.addItem());
    grid.appendChild(node);
  });
}

function getGoalSaved(item) {
  return Number(item.saved ?? item.amount) || 0;
}

function getGoalTarget(item) {
  return Number(item.target) || 0;
}

function getGoalPercent(item) {
  const target = getGoalTarget(item);
  if (target <= 0) return 0;
  return Math.min((getGoalSaved(item) / target) * 100, 100);
}

function goalIconOptionForKey(key) {
  return GOAL_ICON_BY_KEY.get(key) || GOAL_ICON_BY_KEY.get('goal/savings');
}

function goalIconKeyFor(item) {
  const label = (item.label || '').toLowerCase();
  if (label.includes('pc') || label.includes('computer') || label.includes('setup') || label.includes('cloud')) return 'goal/pc';
  if (label.includes('vacation') || label.includes('trip') || label.includes('travel')) return 'goal/travel';
  if (label.includes('car') || label.includes('auto')) return 'goal/car';
  if (label.includes('house') || label.includes('home')) return 'goal/house';
  if (label.includes('fund') || label.includes('save') || label.includes('retire') || item.category === 'savings') return 'goal/savings';
  if (item.category === 'needs') return 'goal/house';
  if (item.category === 'wants') return 'goal/travel';
  return 'goal/savings';
}

function goalIconKeyForItem(item) {
  return item.iconCustom && item.iconKey && GOAL_ICON_BY_KEY.has(item.iconKey)
    ? item.iconKey
    : goalIconKeyFor(item);
}

function goalIconSrcFor(item) {
  return goalIconOptionForKey(goalIconKeyForItem(item)).src;
}

function setGoalIconImage(image, item) {
  const option = goalIconOptionForKey(goalIconKeyForItem(item));
  image.dataset.icon = option.key;
  image.src = option.src;
  image.title = option.label;
}

function setGoalIcon(icon, item) {
  icon.replaceChildren();
  const image = document.createElement('img');
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  setGoalIconImage(image, item);
  icon.appendChild(image);
}

function closeGoalIconMenus(exceptMenu = null) {
  $$('[data-goal-icon-menu]').forEach((menu) => {
    if (menu !== exceptMenu) menu.hidden = true;
  });
}

function renderGoalIconMenu(menu, item, icon) {
  menu.innerHTML = '';
  const activeKey = goalIconKeyForItem(item);

  GOAL_ICON_OPTIONS.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'goal-icon-menu__option';
    button.classList.toggle('is-selected', option.key === activeKey);
    button.setAttribute('aria-label', option.label);
    button.title = option.label;
    button.dataset.iconKey = option.key;

    const image = document.createElement('img');
    image.src = option.src;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    button.appendChild(image);

    button.addEventListener('click', () => {
      item.iconKey = option.key;
      item.iconCustom = true;
      setGoalIconImage(icon, item);
      menu.hidden = true;
      onDataChange();
    });

    menu.appendChild(button);
  });
}

function mountMisc() {
  const list = $('#miscList');
  list.innerHTML = '';

  if (state.misc.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'goals-empty';
    empty.textContent = 'No goals yet.';
    list.appendChild(empty);
    return;
  }

  state.misc.forEach((item, index) => {
    const row = document.createElement('article');
    row.className = `misc-row goal-row goal-row--${item.category || 'needs'} goal-row--${goalToneClass(index)}`;
    row.dataset.miscId = item.id;

    const iconWrap = document.createElement('div');
    iconWrap.className = 'goal-row__icon-wrap';

    const iconButton = document.createElement('button');
    iconButton.type = 'button';
    iconButton.className = 'goal-row__icon-button';
    iconButton.setAttribute('aria-label', 'Choose goal icon');
    iconButton.title = 'Choose icon';

    const icon = document.createElement('img');
    icon.className = 'goal-row__icon';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    setGoalIconImage(icon, item);

    const iconMenu = document.createElement('div');
    iconMenu.className = 'goal-icon-menu';
    iconMenu.dataset.goalIconMenu = '';
    iconMenu.hidden = true;

    iconButton.appendChild(icon);
    iconWrap.append(iconButton, iconMenu);
    iconButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const shouldOpen = iconMenu.hidden;
      closeExpenseIconMenus();
      closeGoalIconMenus(iconMenu);
      iconMenu.hidden = !shouldOpen;
      if (shouldOpen) renderGoalIconMenu(iconMenu, item, icon);
    });

    const body = document.createElement('div');
    body.className = 'goal-row__body';

    const top = document.createElement('div');
    top.className = 'goal-row__top';

    const label = document.createElement('input');
    label.type = 'text';
    label.className = 'goal-row__label';
    label.placeholder = 'e.g. Vacation, new car, house fund';
    label.setAttribute('aria-label', 'Goal name');
    label.value = item.label;

    const pct = document.createElement('span');
    pct.className = 'goal-row__pct';
    pct.textContent = `${Math.round(getGoalPercent(item))}%`;

    top.append(label, pct);

    const amounts = document.createElement('div');
    amounts.className = 'goal-row__amounts';

    const savedWrap = createMoneyInput('Saved', getGoalSaved(item));
    const targetWrap = createMoneyInput('Target', getGoalTarget(item));
    amounts.append(savedWrap.wrap, targetWrap.wrap);

    const progress = document.createElement('div');
    progress.className = 'goal-row__progress';
    const fill = document.createElement('div');
    fill.className = 'goal-row__fill';
    fill.style.width = `${getGoalPercent(item)}%`;
    progress.appendChild(fill);

    body.append(top, amounts, progress);

    const controls = document.createElement('div');
    controls.className = 'goal-row__controls';

    const monthlyWrap = createMoneyInput('Monthly', Number(item.amount) || 0);

    label.addEventListener('input', () => {
      item.label = label.value;
      if (!item.iconCustom) setGoalIconImage(icon, item);
      onDataChange();
    });
    savedWrap.input.addEventListener('input', () => {
      item.saved = parseFloat(savedWrap.input.value) || 0;
      pct.textContent = `${Math.round(getGoalPercent(item))}%`;
      fill.style.width = `${getGoalPercent(item)}%`;
      onDataChange();
    });
    targetWrap.input.addEventListener('input', () => {
      item.target = parseFloat(targetWrap.input.value) || 0;
      pct.textContent = `${Math.round(getGoalPercent(item))}%`;
      fill.style.width = `${getGoalPercent(item)}%`;
      onDataChange();
    });
    monthlyWrap.input.addEventListener('input', () => {
      item.amount = parseFloat(monthlyWrap.input.value) || 0;
      onDataChange();
    });

    const category = document.createElement('select');
    category.className = 'misc-category__select';
    category.setAttribute('aria-label', 'Budget category');
    [
      ['needs', 'Needs'],
      ['wants', 'Wants'],
      ['savings', 'Savings'],
    ].forEach(([value, labelText]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = labelText;
      if (value === item.category) option.selected = true;
      category.appendChild(option);
    });
    category.addEventListener('change', () => {
      item.category = category.value;
      row.className = `misc-row goal-row goal-row--${item.category} goal-row--${goalToneClass(index)}`;
      if (!item.iconCustom) setGoalIconImage(icon, item);
      onDataChange();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'goal-row__remove';
    remove.setAttribute('aria-label', 'Remove goal');
    remove.title = 'Remove goal';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      state.misc = state.misc.filter((m) => m.id !== item.id);
      saveState();
      mountMisc();
      updateComputed();
    });

    controls.append(monthlyWrap.wrap, category, remove);
    row.append(iconWrap, body, controls);
    list.appendChild(row);
  });
}

function createMoneyInput(labelText, value) {
  const wrap = document.createElement('label');
  wrap.className = 'goal-money';

  const label = document.createElement('span');
  label.textContent = labelText;

  const field = document.createElement('span');
  field.className = 'goal-money__field';

  const currency = document.createElement('span');
  currency.className = 'goal-money__currency';
  currency.textContent = '$';

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '0.01';
  input.placeholder = '0';
  input.value = value === 0 ? '' : value;
  input.setAttribute('aria-label', labelText);

  field.append(currency, input);
  wrap.append(label, field);
  return { wrap, input };
}

function updatePartnerTotals(calc) {
  $$('[data-partner-id]', $('#partnersGrid')).forEach((card) => {
    const total = card.dataset.partnerId === 'partnerA' ? calc.incomeA : calc.incomeB;
    $('[data-total]', card).textContent = formatMoney(total);
  });
}

function formatPaidBySplit(items) {
  const split = sumByPaidBy(items);
  const labels = paidByLabels();
  const parts = ['his', 'hers', 'combined']
    .filter((k) => split[k] > 0)
    .map((k) => `${labels[k]} ${formatMoney(split[k])}`);
  return parts.length ? parts.join(' · ') : '';
}

function iconSet(name) {
  return `assets/icons/icon-set/${name}.png`;
}

function iconSet2(name) {
  return `assets/icons/icon-set-2/${name}.png`;
}

function goalIconSet(name) {
  return `assets/icons/goal-set/goal-${name}.png`;
}

function overviewIconFor(label, category) {
  const text = label.trim().toLowerCase();
  if (!text) return '';
  if (text.includes('phone') || text.includes('cell')) return iconSet2('phone');
  if (text.includes('kid') || text.includes('child') || text.includes('baby')) return iconSet2('baby-needs');
  if (text.includes('pc') || text.includes('computer') || text.includes('cloud') || text.includes('storage') || text.includes('software')) return iconSet2('cloud-storage');
  if (text.includes('maintenance') || text.includes('repair')) return iconSet2('home-maintenance');
  if (text.includes('pet')) return iconSet2('pet-health');
  if (text.includes('prescription') || text.includes('rx') || text.includes('medicine')) return iconSet2('prescriptions');
  if (text.includes('tuition')) return iconSet2('tuition');
  if (text.includes('renters')) return iconSet2('renters-insurance');
  if (text.includes('estate')) return iconSet2('estate-planning');
  if (text.includes('risk')) return iconSet2('risk-protection');
  if (text.includes('milestone')) return iconSet2('milestones');
  if (text.includes('achievement')) return iconSet2('achievements');
  if (text.includes('cashback')) return iconSet2('cashback');
  if (text.includes('deal')) return iconSet2('local-deals');
  if (text.includes('wallet')) return iconSet2('digital-wallet');
  if (text.includes('side income')) return iconSet2('side-income');
  if (text.includes('commission')) return iconSet2('commission');
  if (text.includes('invoice')) return iconSet2('invoicing');
  if (text.includes('client')) return iconSet2('client-work');
  if (text.includes('passive')) return iconSet2('passive-income');
  if (text.includes('contract')) return iconSet2('contract-work');
  if (text.includes('rent') || text.includes('mortgage') || text.includes('house') || text.includes('home')) return iconSet('home');
  if (text.includes('electric') || text.includes('power') || text.includes('gas') || text.includes('utility')) return iconSet('electric');
  if (text.includes('water') || text.includes('sewer')) return iconSet('water');
  if (text.includes('internet') || text.includes('wifi') || text.includes('wi-fi') || text.includes('broadband')) return iconSet('internet');
  if (text.includes('grocery') || text.includes('groceries') || text.includes('market') || text.includes('food')) return iconSet('groceries');
  if (text.includes('life security')) return iconSet2('life-security');
  if (text.includes('insur')) return iconSet('insurance-shield');
  if (text.includes('medical') || text.includes('health') || text.includes('doctor')) return iconSet2('health');
  if (text.includes('emergency')) return iconSet('first-aid-kit');
  if (text.includes('transport') || text.includes('bike')) return iconSet2('transportation');
  if (text.includes('car') || text.includes('auto')) return iconSet('car');
  if (text.includes('dining') || text.includes('restaurant') || text.includes('out')) return iconSet('dining');
  if (text.includes('subscription') || text.includes('stream') || text.includes('member')) return iconSet2('subscriptions-refresh');
  if (text.includes('entertain') || text.includes('movie') || text.includes('ticket') || text.includes('experience')) return iconSet2('experiences');
  if (text.includes('creative')) return iconSet2('creative-hobbies');
  if (text.includes('photo')) return iconSet2('photography');
  if (text.includes('outdoor')) return iconSet2('outdoor-activities');
  if (text.includes('wellness')) return iconSet2('wellness');
  if (text.includes('treat')) return iconSet2('treats');
  if (text.includes('fun money')) return iconSet2('fun-money');
  if (text.includes('hobby') || text.includes('game')) return iconSet('gaming');
  if (text.includes('shopping')) return iconSet('shopping-basket');
  if (text.includes('fitness') || text.includes('gym')) return iconSet('fitness');
  if (text.includes('book')) return iconSet('books');
  if (text.includes('education') || text.includes('school')) return iconSet('education');
  if (text.includes('retire')) return iconSet('palm-tree');
  if (text.includes('vacation') || text.includes('travel') || text.includes('trip') || text.includes('flight')) return iconSet('airplane');
  if (text.includes('gift card')) return iconSet2('gift-cards');
  if (text.includes('gift')) return iconSet('gift');
  if (text.includes('bank')) return iconSet('bank');
  if (text.includes('card') || text.includes('debt')) return iconSet('credit-card');
  if (text.includes('wealth')) return iconSet2('wealth-building');
  if (text.includes('long term')) return iconSet2('long-term-plan');
  if (text.includes('future')) return iconSet2('future-planning');
  if (text.includes('financial goal')) return iconSet2('financial-goals');
  if (text.includes('savings goal')) return iconSet2('savings-goals');
  if (text.includes('save') || text.includes('fund')) return iconSet('piggy-bank');
  if (category === 'needs') return iconSet('shield-check');
  if (category === 'wants') return iconSet('heart');
  if (category === 'savings') return iconSet('bank');
  return iconSet('star');
}

function updateExpenseCategories(calc) {
  $$('[data-category]', $('#expensesGrid')).forEach((block) => {
    const cat = block.dataset.category;
    const target = calc.targets[cat];
    const actual = calc.actuals[cat];
    const status = calc.ruleStatus[cat];
    const items = state[cat];

    $('[data-target]', block).textContent = `Target ${formatMoney(target)}`;
    const actualEl = $('[data-actual]', block);
    actualEl.textContent = `Spent ${formatMoney(actual)}`;
    actualEl.className = `expense-category__actual status--${status.status}`;

    const splitEl = $('[data-split]', block);
    const splitText = formatPaidBySplit(items);
    if (splitText) {
      splitEl.textContent = splitText;
      splitEl.hidden = false;
    } else {
      splitEl.hidden = true;
    }

    const fill = $('[data-fill]', block);
    const maxBar = Math.max(target, actual, 1);
    fill.style.width = `${(actual / maxBar) * 100}%`;
    fill.className = `progress-bar__fill progress-bar__fill--${cat} status--${status.status}`;

    const targetLine = $('[data-target-line]', block);
    targetLine.style.left = `${(target / maxBar) * 100}%`;
  });
  updatePaidByLabels();
}

function createOverviewRow(label, amount, meta = '', icon = '') {
  const row = document.createElement('div');
  row.className = 'overview-row';

  if (icon) {
    const iconEl = document.createElement('img');
    iconEl.className = 'overview-row__icon';
    iconEl.src = icon;
    iconEl.alt = '';
    iconEl.setAttribute('aria-hidden', 'true');
    row.appendChild(iconEl);
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'overview-row__icon overview-row__icon--empty';
    spacer.setAttribute('aria-hidden', 'true');
    row.appendChild(spacer);
  }

  const labelEl = document.createElement('span');
  labelEl.className = 'overview-row__label';
  labelEl.textContent = label || 'Untitled';

  const amountEl = document.createElement('span');
  amountEl.className = 'overview-row__amount';
  amountEl.textContent = formatMoney(amount || 0);

  row.append(labelEl, amountEl);

  if (meta) {
    const metaEl = document.createElement('span');
    metaEl.className = 'overview-row__meta';
    metaEl.textContent = meta;
    row.appendChild(metaEl);
  }

  return row;
}

function renderOverviewExpenses(calc) {
  const grid = $('#overviewExpenseGrid');
  if (!grid) return;
  grid.innerHTML = '';

  CATEGORY_KEYS.forEach((cat) => {
    const card = document.createElement('article');
    card.className = `overview-card overview-card--${cat}`;

    const head = document.createElement('header');
    head.className = 'overview-card__head';

    const title = document.createElement('h3');
    title.textContent = CATEGORY_META[cat].title;

    const total = document.createElement('span');
    total.textContent = formatMoney(calc.actuals[cat]);

    head.append(title, total);
    card.appendChild(head);

    const target = document.createElement('p');
    target.className = 'overview-card__target';
    target.textContent = `Target ${formatMoney(calc.targets[cat])}`;
    card.appendChild(target);

    const list = document.createElement('div');
    list.className = 'overview-card__list';

    const expenseRows = state[cat].map((item, index) => ({
      label: item.label,
      amount: item.amount,
      meta: paidByLabels()[item.paidBy || 'combined'],
      icon: expenseIconSrcFor(item, cat, index),
    }));
    const goalRows = state.misc
      .filter((item) => item.category === cat)
      .map((item, index) => ({
        label: item.label,
        amount: item.amount,
        meta: 'Goal contribution',
        icon: expenseIconSrcFor(item, cat, expenseRows.length + index),
      }));
    const rows = [...expenseRows, ...goalRows].filter((item) => item.label || Number(item.amount) > 0);

    if (rows.length === 0) {
      list.appendChild(createOverviewRow('No items yet', 0));
    } else {
      rows.forEach((item) => {
        list.appendChild(createOverviewRow(item.label, Number(item.amount) || 0, item.meta, item.icon));
      });
    }

    card.appendChild(list);
    grid.appendChild(card);
  });
}

function renderOverviewGoals() {
  const list = $('#overviewGoalsList');
  if (!list) return;
  list.innerHTML = '';

  const goals = state.misc.filter((item) => item.label || Number(item.amount) > 0);
  if (goals.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'overview-goal-empty';
    empty.textContent = 'No goals yet.';
    list.appendChild(empty);
    return;
  }

  goals.forEach((item, index) => {
    const target = getGoalTarget(item);
    const saved = getGoalSaved(item);
    const pct = Math.round(getGoalPercent(item));

    const row = document.createElement('article');
    row.className = `overview-goal overview-goal--${item.category || 'needs'} overview-goal--${goalToneClass(index)}`;

    const icon = document.createElement('span');
    icon.className = 'overview-goal__icon';
    icon.setAttribute('aria-hidden', 'true');
    setGoalIcon(icon, item);

    const body = document.createElement('div');
    body.className = 'overview-goal__body';

    const head = document.createElement('div');
    head.className = 'overview-goal__head';

    const title = document.createElement('h3');
    title.textContent = item.label || 'Untitled goal';

    const pctEl = document.createElement('span');
    pctEl.textContent = `${pct}%`;

    head.append(title, pctEl);

    const amount = document.createElement('p');
    amount.className = 'overview-goal__amount';
    amount.textContent = target > 0 ? `${formatMoney(saved)} / ${formatMoney(target)}` : `${formatMoney(saved)} saved`;

    const progress = document.createElement('div');
    progress.className = 'overview-goal__progress';
    const fill = document.createElement('div');
    fill.className = 'overview-goal__fill';
    fill.style.width = `${getGoalPercent(item)}%`;
    progress.appendChild(fill);

    body.append(head, amount, progress);
    row.append(icon, body);
    list.appendChild(row);
  });
}

function renderRuleBars(calc) {
  const container = $('#ruleBars');
  const cats = [
    { key: 'needs', label: 'Needs', targetPct: 50, color: 'needs' },
    { key: 'wants', label: 'Wants', targetPct: 30, color: 'wants' },
    { key: 'savings', label: 'Savings', targetPct: 20, color: 'savings' },
  ];

  container.innerHTML = cats
    .map((c) => {
      const actualPct = calc.pctOfIncome[c.key];
      const status = calc.ruleStatus[c.key];
      const delta = calc.actuals[c.key] - calc.targets[c.key];
      const deltaText =
        Math.abs(delta) < 1
          ? 'On target'
          : delta > 0
            ? `${formatMoney(delta)} over`
            : `${formatMoney(-delta)} under`;

      return `
        <div class="rule-row status--${status.status}">
          <div class="rule-row__head">
            <span class="rule-row__label">${c.label}</span>
            <span class="rule-row__pcts">
              <strong>${actualPct.toFixed(1)}%</strong>
              <span class="rule-row__target"> / ${c.targetPct}% goal</span>
            </span>
          </div>
          <div class="rule-row__track">
            <div class="rule-row__goal" style="width: ${c.targetPct}%"></div>
            <div class="rule-row__actual rule-row__actual--${c.color}" style="width: ${Math.min(actualPct, 100)}%"></div>
          </div>
          <p class="rule-row__delta">${deltaText}</p>
        </div>
      `;
    })
    .join('');
}

function renderDonut(calc) {
  const donut = $('#donutChart');
  const legend = $('#donutLegend');

  if (calc.donutSegments.length === 0) {
    donut.style.background = 'conic-gradient(var(--surface-3) 0deg 360deg)';
    legend.innerHTML = '';
    return;
  }

  const total = calc.donutSegments.reduce((s, seg) => s + seg.value, 0);
  let angle = 0;
  const stops = calc.donutSegments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const start = angle;
    angle += sweep;
    return `${seg.color} ${start}deg ${angle}deg`;
  });

  donut.style.background = `conic-gradient(${stops.join(', ')})`;

  const labels = {
    needs: 'Needs',
    wants: 'Wants',
    savings: 'Savings',
    free: 'Unallocated',
  };

  legend.innerHTML = calc.donutSegments
    .map(
      (seg) => `
      <li>
        <span class="swatch" style="background: ${seg.color}"></span>
        <span>${labels[seg.key]}</span>
        <strong>${formatMoney(seg.value)}</strong>
        <span class="muted">${((seg.value / total) * 100).toFixed(0)}%</span>
      </li>
    `
    )
    .join('');
}

function renderSummary(calc) {
  $('#combinedIncome').textContent = formatMoney(calc.combinedIncome);
  $('#totalAllocated').textContent = formatMoney(calc.totalAllocated);

  const disposableEl = $('#disposableIncome');
  disposableEl.textContent = formatMoney(calc.disposable);
  disposableEl.classList.toggle('negative', calc.disposable < 0);

  const hint = $('#disposableHint');
  if (calc.combinedIncome === 0) {
    hint.textContent = 'Enter income above to calculate';
  } else if (calc.disposable < 0) {
    hint.textContent = 'Over budget — reduce expenses or increase income';
  } else if (calc.disposable > 0) {
    hint.textContent = 'Available for extra goals, buffer, or fun money';
  } else {
    hint.textContent = 'Every dollar is assigned — nice work';
  }
}

function renderExpensesSummary(calc) {
  $('#expensesTotalBudget').textContent = formatMoney(calc.combinedIncome);
  $('#expensesTotalSpent').textContent = formatMoney(calc.totalAllocated);

  const chart = $('#expensesCategoryChart');
  const categories = [
    { key: 'needs', label: 'Needs', value: calc.actuals.needs, color: 'var(--c-needs)' },
    { key: 'wants', label: 'Wants', value: calc.actuals.wants, color: 'var(--c-wants)' },
    { key: 'savings', label: 'Savings', value: calc.actuals.savings, color: 'var(--c-savings)' },
  ];
  const visibleCategories = categories.filter((category) => category.value > 0);

  if (visibleCategories.length === 0) {
    chart.style.setProperty('--expense-chart-segments', 'var(--surface-3) 0deg 360deg');
    chart.setAttribute('aria-label', 'No expense categories entered yet');
    return;
  }

  const total = visibleCategories.reduce((sum, category) => sum + category.value, 0);
  let angle = 0;
  const stops = visibleCategories.map((category) => {
    const sweep = (category.value / total) * 360;
    const start = angle;
    angle += sweep;
    return `${category.color} ${start}deg ${angle}deg`;
  });
  const label = visibleCategories
    .map((category) => {
      const pct = Math.round((category.value / total) * 100);
      return `${category.label} ${pct}% (${formatMoney(category.value)})`;
    })
    .join(', ');

  chart.style.setProperty('--expense-chart-segments', stops.join(', '));
  chart.setAttribute('aria-label', `Expense category breakdown: ${label}`);
}

function updateComputed() {
  const calc = calculate(state);
  updatePartnerTotals(calc);
  renderSummary(calc);
  renderExpensesSummary(calc);
  renderRuleBars(calc);
  renderDonut(calc);
  updateExpenseCategories(calc);
  renderOverviewExpenses(calc);
  renderOverviewGoals();
}

function mountAll() {
  mountPartners();
  mountExpenses();
  mountMisc();
  updateComputed();
}

function syncPeriodSelect() {
  const periodSelect = $('#period');
  if (periodSelect) periodSelect.value = state.period;
}

$('#period')?.addEventListener('change', (e) => {
  state.period = e.target.value;
  onDataChange();
});

$$('[data-view-target]').forEach((button) => {
  button.addEventListener('click', () => setActiveView(button.dataset.viewTarget));
});

$('#openGoalsFromOverview')?.addEventListener('click', () => setActiveView('goals'));

$('#addMiscBtn').addEventListener('click', () => {
  state.misc.push(createMiscItem('', 0, 'savings', 0, 0));
  saveState();
  mountMisc();
  updateComputed();
});

document.addEventListener('click', () => {
  closeExpenseIconMenus();
  closeGoalIconMenus();
});

$('#resetBtn')?.addEventListener('click', async () => {
  if (confirm('Reset all budget data? This cannot be undone.')) {
    state = defaultState();
    syncPeriodSelect();
    mountAll();
    if (localStorageAvailable) {
      clearLocalBudget();
      showSaveStatus('cleared');
    } else {
      showSaveStatus('unavailable');
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeExpenseIconMenus();
    closeGoalIconMenus();
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `together-budget-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
});

async function importBudgetFile(file) {
  const text = await file.text();
  const budget = parseImportedBudget(text);
  state = mergeLoadedState(budget);
  syncPeriodSelect();
  mountAll();
  updateComputed();
  await saveState();
}

async function init() {
  showSaveStatus('loading');
  state = localStorageAvailable ? loadFromLocal(mergeLoadedState) : defaultState();
  mountBudgetRain();

  if (!localStorageAvailable) {
    showSaveStatus('unavailable');
  }

  mountAll();
  syncPeriodSelect();
  updateComputed();

  const modeEl = $('#saveMode');
  if (modeEl) {
    modeEl.textContent = localStorageAvailable
      ? 'Saved locally in this browser'
      : 'Local browser storage unavailable';
  }

  window.addEventListener('pagehide', () => {
    flushLocalSave();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLocalSave();
  });

  if (localStorageAvailable) await saveState();
}

$('#importBtn')?.addEventListener('click', () => $('#importFile')?.click());
$('#importFile')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    await importBudgetFile(file);
    showSaveStatus('saved');
  } catch {
    alert('Could not read that file. Use a Together Budget export (.json).');
  }
});

init();
