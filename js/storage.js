import { defaultState } from './budget.js';

const STORAGE_KEY = 'together-budget-v1';
export const AUTH_KEY = 'together-budget-auth';

/** @returns {HeadersInit} */
export function apiHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = sessionStorage.getItem(AUTH_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function captureAuthFromUrl() {
  const key = new URLSearchParams(window.location.search).get('key');
  if (key) {
    sessionStorage.setItem(AUTH_KEY, key);
    const url = new URL(window.location.href);
    url.searchParams.delete('key');
    window.history.replaceState({}, '', url.pathname + url.hash);
  }
}

export async function fetchServerConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) return { requiresAuth: false };
  return res.json();
}

/**
 * @param {(saved: object) => object} mergeLoadedState
 */
export async function loadFromServer(mergeLoadedState) {
  const res = await fetch('/api/budget', { headers: apiHeaders() });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error('load failed');

  const data = await res.json();
  if (data.budget) {
    return { state: mergeLoadedState(data.budget), updatedAt: data.updatedAt || 0 };
  }
  return { state: null, updatedAt: data.updatedAt || 0 };
}

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

/**
 * @param {object} state
 * @param {number} updatedAt
 */
export async function saveToServer(state, updatedAt) {
  const res = await fetch('/api/budget', {
    method: 'PUT',
    headers: apiHeaders(),
    body: JSON.stringify({ budget: state, updatedAt }),
  });

  if (res.status === 401) throw new Error('unauthorized');
  if (res.status === 409) {
    const data = await res.json();
    return { conflict: true, budget: data.budget, updatedAt: data.updatedAt };
  }
  if (!res.ok) throw new Error('save failed');

  const data = await res.json();
  return { conflict: false, updatedAt: data.updatedAt };
}

/** Accept Ctrl+S export or server file shape. */
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
