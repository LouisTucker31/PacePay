// ============================================
// PACEPAY — State & Storage
// ============================================

const STORAGE_KEY = 'pacepay_v1';

// --- Default state shape ---
const DEFAULT_STATE = {
  budget:          null,   // number: total budget for the period
  startDate:       null,   // string: ISO date 'YYYY-MM-DD'
  endDate:         null,   // string: ISO date 'YYYY-MM-DD'
  warnThreshold:   15,     // £/day: below this = amber
  dangerThreshold: 10,     // £/day: below this = red
  spends:          [],     // array of { id, date, amount }
};

// --- In-memory state (loaded from storage on init) ---
let state = { ...DEFAULT_STATE };

// ============================================
// Storage helpers
// ============================================

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('PacePay: could not save state', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('PacePay: could not load state', e);
    state = { ...DEFAULT_STATE };
  }
}

// ============================================
// Date helpers
// ============================================

/**
 * Returns today's date as 'YYYY-MM-DD'
 */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Days between two ISO date strings (inclusive of end, exclusive of start)
 * Returns 0 if endDate is today or in the past.
 */
function daysBetween(startISO, endISO) {
  const start = new Date(startISO);
  const end   = new Date(endISO);
  const ms    = end - start;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Days remaining from today to endDate (inclusive of end day)
 */
function daysRemaining() {
  if (!state.endDate) return 0;
  return daysBetween(todayISO(), state.endDate);
}

/**
 * Total days in the period
 */
function totalDays() {
  if (!state.startDate || !state.endDate) return 0;
  return daysBetween(state.startDate, state.endDate);
}

// ============================================
// Calculation
// ============================================

/**
 * Total amount spent across all entries
 */
function totalSpent() {
  return state.spends.reduce((sum, s) => sum + s.amount, 0);
}

/**
 * Remaining budget
 */
function remainingBudget() {
  if (state.budget === null) return 0;
  return state.budget - totalSpent();
}

/**
 * Core calculation: remaining budget ÷ remaining days
 * Returns 0 if no days remaining.
 */
function dailyAmount() {
  const days = daysRemaining();
  if (days <= 0) return 0;
  return remainingBudget() / days;
}

/**
 * Average daily spend over the period so far
 */
function avgDailySpend() {
  if (!state.startDate) return 0;
  const elapsed = Math.max(1, daysBetween(state.startDate, todayISO()));
  return totalSpent() / elapsed;
}

/**
 * Pace state: 'green' | 'amber' | 'red'
 */
function paceState() {
  const daily = dailyAmount();
  if (daily >= state.warnThreshold)    return 'green';
  if (daily >= state.dangerThreshold)  return 'amber';
  return 'red';
}

/**
 * Whether the app has been set up (budget + dates entered)
 */
function isOnboarded() {
  return state.budget !== null && state.startDate !== null && state.endDate !== null;
}

/**
 * Whether today is on or after the end date (payday reset needed)
 */
function isPeriodComplete() {
  if (!state.endDate) return false;
  return todayISO() >= state.endDate;
}

// ============================================
// Actions
// ============================================

function addSpend(amount, date = todayISO()) {
  const entry = {
    id:     Date.now().toString(),
    date,
    amount: parseFloat(amount),
  };
  state.spends.push(entry);
  saveState();
  return entry;
}

function addFunds(amount) {
  if (state.budget === null) return;
  state.budget += parseFloat(amount);
  saveState();
}

function deleteSpend(id) {
  state.spends = state.spends.filter(s => s.id !== id);
  saveState();
}

function updateSettings(updates) {
  state = { ...state, ...updates };
  saveState();
}

function resetPeriod(newBudget, newStartDate, newEndDate, rollOver = false) {
  const carryAmount = rollOver ? remainingBudget() : 0;
  state = {
    ...state,
    budget:    (newBudget ?? state.budget) + carryAmount,
    startDate: newStartDate ?? todayISO(),
    endDate:   newEndDate   ?? null,
    spends:    [],
  };
  saveState();
}

// ============================================
// Exports (available globally)
// ============================================

window.PacePay = {
  // State
  getState:         () => ({ ...state }),
  // Calculations
  dailyAmount,
  remainingBudget,
  totalSpent,
  daysRemaining,
  totalDays,
  avgDailySpend,
  paceState,
  isOnboarded,
  isPeriodComplete,
  // Actions
  loadState,
  addSpend,
  addFunds,
  deleteSpend,
  updateSettings,
  resetPeriod,
  // Helpers
  todayISO,
};
