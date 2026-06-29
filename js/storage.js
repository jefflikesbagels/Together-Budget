import { defaultState } from './budget.js?v=expense-icon-picker-v2';

const STORAGE_KEY = 'together-budget-v1';

export function loadFromLocal(mergeLoadedState) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return mergeLoadedState(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return defaultState();
}

export function saveToLocal(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearLocalBudget() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Accept Ctrl+S export or legacy wrapped budget shape. */
export function parseImportedBudget(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (data.budget && typeof data.budget === 'object') return data.budget;
  if (data.partnerAIncome || data.needs) return data;
  throw new Error('Unrecognized budget file');
}

export function testLocalStorage() {
  try {
    const probe = `${STORAGE_KEY}-probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
