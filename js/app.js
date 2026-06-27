import {
  calculate,
  CATEGORY_META,
  createExpenseItem,
  createLineItem,
  createMiscItem,
  defaultState,
  formatMoney,
  hasBudgetData,
  normalizeExpenseItems,
  normalizeMiscItems,
  sumByPaidBy,
} from './budget.js?v=refiki-general-cleanup';
import {
  AUTH_KEY,
  captureAuthFromUrl,
  fetchServerConfig,
  loadFromLocal,
  loadFromServer,
  parseImportedBudget,
  saveToLocal,
  saveToServer,
  testLocalStorage,
} from './storage.js?v=refiki-general-cleanup';

/** @type {import('./budget.js').BudgetState} */
let state = defaultState();
let useServer = false;
let lastServerUpdatedAt = 0;
let saveInFlight = false;
let localStorageAvailable = testLocalStorage();
let needsServerUpload = false;
const POLL_MS = 12_000;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function mergeLoadedState(saved) {
  const base = defaultState();
  return {
    ...base,
    ...saved,
    partnerAName: saved.partnerAName ?? base.partnerAName,
    partnerBName: saved.partnerBName ?? base.partnerBName,
    partnerAIncome: Array.isArray(saved.partnerAIncome) ? saved.partnerAIncome : base.partnerAIncome,
    partnerBIncome: Array.isArray(saved.partnerBIncome) ? saved.partnerBIncome : base.partnerBIncome,
    needs: normalizeExpenseItems(Array.isArray(saved.needs) ? saved.needs : base.needs),
    wants: normalizeExpenseItems(Array.isArray(saved.wants) ? saved.wants : base.wants),
    savings: normalizeExpenseItems(Array.isArray(saved.savings) ? saved.savings : base.savings),
    misc: normalizeMiscItems(Array.isArray(saved.misc) ? saved.misc : base.misc),
    period: saved.period ?? base.period,
  };
}

function isEditing() {
  const el = document.activeElement;
  return el && (el.matches('input, select, textarea') || el.isContentEditable);
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
    if (useServer) {
      const result = await saveToServer(state, lastServerUpdatedAt);
      if (result.conflict) {
        applyRemoteState(result.budget, result.updatedAt);
        showSaveStatus('synced');
        return false;
      }
      lastServerUpdatedAt = result.updatedAt;
      if (localStorageAvailable) saveToLocal(state);
      showSaveStatus('saved');
      return true;
    }
    if (!localStorageAvailable) {
      showSaveStatus('unavailable');
      return false;
    }
    saveToLocal(state);
    showSaveStatus('saved');
    return true;
  } catch (err) {
    if (err.message === 'unauthorized') showSaveStatus('auth');
    else showSaveStatus('error');
    return false;
  } finally {
    saveInFlight = false;
  }
}

function applyRemoteState(budget, updatedAt) {
  if (!budget) return;
  state = mergeLoadedState(budget);
  lastServerUpdatedAt = updatedAt;
  $('#period').value = state.period;
  mountAll();
}

async function pollServer() {
  if (!useServer || isEditing()) return;
  try {
    const remote = await loadFromServer(mergeLoadedState);
    if (remote.updatedAt > lastServerUpdatedAt) {
      if (remote.state) {
        applyRemoteState(remote.state, remote.updatedAt);
        showSaveStatus('synced');
      }
    }
  } catch {
    /* ignore transient network errors */
  }
}

let saveStatusTimer;
function showSaveStatus(kind) {
  const el = $('#saveStatus');
  if (!el) return;
  const messages = {
    loading: 'Loading…',
    saved: useServer ? 'Saved to server' : 'Saved',
    synced: 'Updated from household budget',
    error: 'Could not save — use Ctrl+S to export a backup',
    unavailable: 'Offline — start the server or use Ctrl+S to export',
    auth: 'Access denied — open with ?key=your-secret',
  };
  el.textContent = messages[kind] ?? '';
  el.dataset.state = kind;
  clearTimeout(saveStatusTimer);
  if (kind === 'saved') {
    saveStatusTimer = setTimeout(() => {
      el.textContent = '';
      delete el.dataset.state;
    }, 2000);
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

/** Save to server/local; debounce only chart/total updates. */
function onDataChange() {
  scheduleSave();
  scheduleUpdateComputed();
}

function bindLineList(container, items) {
  const list = $('[data-items]', container);
  const tpl = $('#lineItemTemplate');

  function renderItems() {
    list.innerHTML = '';
    items.forEach((item) => {
      const node = tpl.content.cloneNode(true);
      const li = node.querySelector('.line-item');
      const label = $('.line-item__label', li);
      const amount = $('.line-item__amount', li);
      label.value = item.label;
      amount.value = item.amount === 0 ? '' : item.amount;
      label.addEventListener('input', () => {
        item.label = label.value;
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

function bindExpenseLineList(container, items) {
  const list = $('[data-items]', container);
  const tpl = $('#expenseLineItemTemplate');

  function renderItems() {
    list.innerHTML = '';
    items.forEach((item) => {
      const node = tpl.content.cloneNode(true);
      const li = node.querySelector('.line-item');
      const label = $('.line-item__label', li);
      const paidBy = $('.line-item__paid-by', li);
      const amount = $('.line-item__amount', li);
      label.value = item.label;
      fillPaidBySelect(paidBy, item.paidBy || 'combined');
      amount.value = item.amount === 0 ? '' : item.amount;
      label.addEventListener('input', () => {
        item.label = label.value;
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

    const api = bindExpenseLineList(block, state[cat]);
    $('.btn--add', block).addEventListener('click', () => api.addItem());
    grid.appendChild(node);
  });
}

function mountMisc() {
  const list = $('#miscList');
  list.innerHTML = '';
  const tpl = $('#lineItemTemplate');

  state.misc.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'misc-row';
    row.dataset.miscId = item.id;

    const node = tpl.content.cloneNode(true);
    const li = node.querySelector('.line-item');
    li.classList.add('line-item--misc');
    const label = $('.line-item__label', li);
    const amount = $('.line-item__amount', li);
    label.value = item.label;
    label.placeholder = 'e.g. Annual insurance, vet fund';
    amount.value = item.amount === 0 ? '' : item.amount;

    label.addEventListener('input', () => {
      item.label = label.value;
      onDataChange();
    });
    amount.addEventListener('input', () => {
      item.amount = parseFloat(amount.value) || 0;
      onDataChange();
    });
    $('.line-item__remove', li).addEventListener('click', () => {
      state.misc = state.misc.filter((m) => m.id !== item.id);
      saveState();
      mountMisc();
      updateComputed();
    });

    const categoryWrap = document.createElement('div');
    categoryWrap.className = 'misc-category';
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
      onDataChange();
    });
    categoryWrap.appendChild(category);

    row.appendChild(node);
    row.appendChild(categoryWrap);
    list.appendChild(row);
  });
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

function updateComputed() {
  const calc = calculate(state);
  updatePartnerTotals(calc);
  renderSummary(calc);
  renderRuleBars(calc);
  renderDonut(calc);
  updateExpenseCategories(calc);
}

function mountAll() {
  mountPartners();
  mountExpenses();
  mountMisc();
  updateComputed();
}

$('#period').addEventListener('change', (e) => {
  state.period = e.target.value;
  onDataChange();
});

$('#addMiscBtn').addEventListener('click', () => {
  state.misc.push(createMiscItem('', 0, 'needs'));
  saveState();
  mountMisc();
  updateComputed();
});

$('#resetBtn').addEventListener('click', async () => {
  if (confirm('Reset all budget data? This cannot be undone.')) {
    state = defaultState();
    lastServerUpdatedAt = 0;
    $('#period').value = state.period;
    mountAll();
    await saveState();
  }
});

document.addEventListener('keydown', (e) => {
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
  lastServerUpdatedAt = 0;
  needsServerUpload = true;
  $('#period').value = state.period;
  mountAll();
  updateComputed();
  await saveState();
  if (localStorageAvailable) saveToLocal(state);
}

async function init() {
  captureAuthFromUrl();
  showSaveStatus('loading');
  needsServerUpload = false;

  const local = localStorageAvailable ? loadFromLocal(mergeLoadedState) : null;
  const localHasData = hasBudgetData(local);

  try {
    const config = await fetchServerConfig();
    if (config.requiresAuth && !sessionStorage.getItem(AUTH_KEY)) {
      showSaveStatus('auth');
    }

    const remote = await loadFromServer(mergeLoadedState);
    useServer = true;

    const serverHasData = hasBudgetData(remote.state);

    if (serverHasData) {
      state = remote.state;
      lastServerUpdatedAt = remote.updatedAt;
    } else if (localHasData) {
      state = local;
      lastServerUpdatedAt = remote.updatedAt || 0;
      needsServerUpload = true;
    } else if (remote.state) {
      state = remote.state;
      lastServerUpdatedAt = remote.updatedAt;
    } else {
      state = defaultState();
      lastServerUpdatedAt = 0;
    }
  } catch {
    useServer = false;
    state = localHasData ? local : defaultState();
    showSaveStatus('unavailable');
  }

  mountAll();
  $('#period').value = state.period;
  updateComputed();

  const modeEl = $('#saveMode');
  if (useServer) {
    if (modeEl) modeEl.textContent = 'Shared household budget on server';
    if (needsServerUpload) await saveState();
    setInterval(pollServer, POLL_MS);
  } else if (localStorageAvailable && (localHasData || hasBudgetData(state))) {
    saveState();
  }

  window.addEventListener('pagehide', () => {
    if (hasBudgetData(state)) saveState();
  });
}

$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (e) => {
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
