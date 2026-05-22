// ============================================
// PACEPAY — App Init & Event Handlers
// ============================================

var PP = window.PacePay;
var UI = window.PacePayUI;

// ============================================
// Init
// ============================================

function init() {
  PP.loadState();

  if (PP.isOnboarded() && PP.isPeriodComplete()) {
    showResetScreen();
  } else {
    UI.renderHome();
  }

  bindEvents();
  UI.initAllSheetDrags();
  UI.initSheetKeyboardAdjust();
}

// ============================================
// Event binding
// ============================================

function bindEvents() {

  // --- Add spend button → open spend sheet ---
  document.getElementById('btn-add-spend')?.addEventListener('click', () => {
    UI.openSheet('sheet-spend');
    document.getElementById('spend-input')?.focus();
  });

  // --- Spend sheet: confirm ---
  document.getElementById('btn-spend-confirm')?.addEventListener('click', handleAddSpend);

  // --- Spend input: submit on Enter ---
  document.getElementById('spend-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddSpend();
  });

  // --- Overlay click: close all sheets ---
  document.getElementById('overlay')?.addEventListener('click', UI.closeAllSheets);

  // --- Sheet close buttons ---
  document.querySelectorAll('[data-close-sheet]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.closeSheet;
      UI.closeSheet(target);
    });
  });

  // --- Payday reset flow ---
  bindResetEvents();

  // --- Onboarding flow ---
  initOnboarding();
}

// ============================================
// Payday reset flow
// ============================================

var resetRollOver = false;

function showResetScreen() {
  UI.applyPaceColour('green');
  document.getElementById('onboarding-section')?.classList.add('hidden');
  document.getElementById('main-section')?.classList.add('hidden');
  document.getElementById('new-period-section')?.classList.add('hidden');
  document.getElementById('reset-section')?.classList.remove('hidden');

  const avg       = PP.avgDailySpend();
  const remaining = PP.remainingBudget();

  document.getElementById('reset-avg-spend').textContent   = UI.formatCurrency(avg);
  document.getElementById('reset-remaining-label').textContent =
    remaining >= 0
      ? `${UI.formatCurrency(remaining)} left over`
      : `${UI.formatCurrency(Math.abs(remaining))} over budget`;
}

function showNewPeriodForm(rollOver) {
  resetRollOver = rollOver;

  document.getElementById('reset-section')?.classList.add('hidden');
  document.getElementById('new-period-section')?.classList.remove('hidden');

  const eyebrow = document.getElementById('new-period-eyebrow');
  if (eyebrow) eyebrow.textContent = rollOver ? 'Rolling over' : 'Fresh start';

  // Pre-fill end date to 30 days from today
  const endInput = document.getElementById('np-end-date');
  if (endInput) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    endInput.value = d.toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    endInput.min = tomorrow.toISOString().slice(0, 10);
  }

  // Pre-fill budget with last period's budget
  const budgetInput = document.getElementById('np-budget');
  if (budgetInput) {
    const state = PP.getState();
    if (state.budget !== null) budgetInput.placeholder = state.budget.toFixed(2);
  }

  setTimeout(() => document.getElementById('np-end-date')?.focus(), 100);
}

function bindResetEvents() {
  document.getElementById('btn-reset-fresh')?.addEventListener('click', () => {
    showNewPeriodForm(false);
  });

  document.getElementById('btn-reset-rollover')?.addEventListener('click', () => {
    showNewPeriodForm(true);
  });

  document.getElementById('btn-new-period-back')?.addEventListener('click', () => {
    document.getElementById('new-period-section')?.classList.add('hidden');
    document.getElementById('reset-section')?.classList.remove('hidden');
  });

  document.getElementById('btn-new-period-confirm')?.addEventListener('click', () => {
    const endDate = document.getElementById('np-end-date')?.value;
    if (!endDate) { shake(document.getElementById('np-end-date')); return; }

    const budgetRaw = document.getElementById('np-budget')?.value;
    const newBudget = budgetRaw ? parseFloat(budgetRaw) : null;

    PP.resetPeriod(newBudget, PP.todayISO(), endDate, resetRollOver);
    document.getElementById('new-period-section')?.classList.add('hidden');
    UI.renderHome();
  });
}

// ============================================
// Onboarding flow
// ============================================

function initOnboarding() {
  const track = document.getElementById('onboarding-track');
  if (!track) return;

  // Pre-fill payday to 30 days from today
  const payInput = document.getElementById('ob-payday');
  if (payInput) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    payInput.value = d.toISOString().slice(0, 10);
    // Set min to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    payInput.min = tomorrow.toISOString().slice(0, 10);
  }

  goToStep(1);

  document.getElementById('ob-step1-next')?.addEventListener('click', () => {
    const input = document.getElementById('ob-budget');
    const val   = parseFloat(input?.value);
    if (!val || val <= 0) { shake(input); return; }
    goToStep(2);
  });

  document.getElementById('ob-budget')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('ob-step1-next')?.click();
  });

  document.getElementById('ob-step2-next')?.addEventListener('click', () => {
    const input = document.getElementById('ob-payday');
    if (!input?.value) { shake(input); return; }
    populateSummary();
    goToStep(3);
  });

  document.getElementById('ob-confirm')?.addEventListener('click', () => {
    const budget  = parseFloat(document.getElementById('ob-budget')?.value);
    const endDate = document.getElementById('ob-payday')?.value;
    if (!budget || !endDate) return;

    PP.updateSettings({
      budget,
      startDate: PP.todayISO(),
      endDate,
    });

    UI.renderHome();
  });

  document.querySelectorAll('[data-ob-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(parseInt(btn.dataset.obBack, 10));
    });
  });
}

function goToStep(n) {
  const track = document.getElementById('onboarding-track');
  if (!track) return;

  track.dataset.current = n;

  // Update dots
  document.querySelectorAll('.onboarding__dot').forEach(dot => {
    dot.classList.toggle('is-active', parseInt(dot.dataset.dot, 10) === n);
  });

  // Auto-focus first input of the step
  const step = track.querySelector(`[data-step="${n}"]`);
  const firstInput = step?.querySelector('input');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 300); // after slide completes
  }
}

function populateSummary() {
  const budget  = parseFloat(document.getElementById('ob-budget')?.value) || 0;
  const endDate = document.getElementById('ob-payday')?.value;
  if (!endDate) return;

  const today    = PP.todayISO();
  const msPerDay = 1000 * 60 * 60 * 24;
  const days     = Math.max(1, Math.round((new Date(endDate) - new Date(today)) / msPerDay));
  const daily    = budget / days;

  document.getElementById('ob-daily-preview').textContent = UI.formatCurrency(daily);
  document.getElementById('ob-summary-days').textContent  = `${days} day${days !== 1 ? 's' : ''}`;
  document.getElementById('ob-summary-budget').textContent = UI.formatCurrency(budget);
}

function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('shake');
}

// ============================================
// Handlers
// ============================================

function handleAddSpend() {
  const input = document.getElementById('spend-input');
  if (!input) return;

  const raw    = input.value.replace(/[^0-9.]/g, '');
  const amount = parseFloat(raw);

  if (isNaN(amount) || amount <= 0) {
    // TODO: gentle shake animation on input
    input.focus();
    return;
  }

  PP.addSpend(amount);
  UI.closeSheet('sheet-spend');
  UI.renderHome(true);

  // Reset input
  input.value = '';
}

// ============================================
// Boot
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
