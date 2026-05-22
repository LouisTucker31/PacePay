// ============================================
// PACEPAY — Settings Page Logic
// ============================================

var PP = window.PacePay;
var UI = window.PacePayUI;

let editingField = null;

function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

// ============================================
// Init
// ============================================

function init() {
  PP.loadState();
  UI.applyPaceColour(PP.paceState());
  renderValues();
  bindEvents();
  UI.initAllSheetDrags();
}

// ============================================
// Render current values into settings rows
// ============================================

function renderValues() {
  const state = PP.getState();

  document.getElementById('val-budget').textContent =
    state.budget !== null ? UI.formatCurrency(state.budget) : 'Set budget';

  document.getElementById('val-start-date').textContent =
    UI.formatDateShort(state.startDate);

  document.getElementById('val-end-date').textContent =
    UI.formatDateShort(state.endDate);

  document.getElementById('val-remaining').textContent =
    state.budget !== null ? UI.formatCurrency(PP.remainingBudget()) : '—';

  document.getElementById('val-warn').textContent =
    `£${state.warnThreshold}/day`;

  document.getElementById('val-danger').textContent =
    `£${state.dangerThreshold}/day`;

  renderSpendList();
}

// ============================================
// Spend history list
// ============================================

function renderSpendList() {
  const state     = PP.getState();
  const container = document.getElementById('spend-list-container');
  if (!container) return;

  if (state.spends.length === 0) {
    container.innerHTML = '<p class="text-subtle" style="padding: var(--space-sm)">No spends recorded yet.</p>';
    return;
  }

  // Sort newest first
  const sorted = [...state.spends].sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = `
    <div class="spend-list">
      ${sorted.map(s => `
        <div class="spend-item" data-id="${s.id}">
          <span class="spend-item__date">${UI.formatDateShort(s.date)}</span>
          <span class="spend-item__amount">${UI.formatCurrency(s.amount)}</span>
          <div class="spend-item__actions">
            <button class="spend-item__delete" data-delete="${s.id}" aria-label="Delete spend">✕</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind delete buttons
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      PP.deleteSpend(btn.dataset.delete);
      renderValues();
    });
  });
}

// ============================================
// Edit sheet helpers
// ============================================

const EDIT_CONFIG = {
  budget:     { title: 'Starting budget',   type: 'currency', key: 'budget',          min: 0 },
  remaining:  { title: 'Current remaining', type: 'currency', key: null,               min: 0 }, // special: adjusts spends
  warn:       { title: 'Warning level',     type: 'currency', key: 'warnThreshold',    min: 0 },
  danger:     { title: 'Danger level',      type: 'currency', key: 'dangerThreshold',  min: 0 },
  startDate:  { title: 'Start date',        type: 'date',     key: 'startDate'                 },
  endDate:    { title: 'Payday / end date', type: 'date',     key: 'endDate'                   },
};

function openEditSheet(field) {
  editingField = field;
  const config   = EDIT_CONFIG[field];
  const state    = PP.getState();

  document.getElementById('sheet-edit-title').textContent = config.title;

  const currencyWrap = document.getElementById('edit-currency-wrap');
  const numInput     = document.getElementById('edit-input');
  const dateInput    = document.getElementById('edit-date-input');

  if (config.type === 'date') {
    currencyWrap.classList.add('hidden');
    dateInput.classList.remove('hidden');
    dateInput.value = config.key ? (state[config.key] ?? '') : '';
  } else {
    currencyWrap.classList.remove('hidden');
    dateInput.classList.add('hidden');
    const current = config.key ? state[config.key] : PP.remainingBudget();
    numInput.value = current !== null ? current : '';
    numInput.min   = config.min ?? 0;
    numInput.placeholder = '0.00';
  }

  UI.openSheet('sheet-edit');

  // Focus correct input
  setTimeout(() => {
    (config.type === 'date' ? dateInput : numInput).focus();
  }, 300);
}

function confirmEdit() {
  if (!editingField) return;
  const config   = EDIT_CONFIG[editingField];
  const state    = PP.getState();

  if (config.type === 'date') {
    const val = document.getElementById('edit-date-input').value;
    if (!val) return;
    PP.updateSettings({ [config.key]: val });
  } else {
    const raw = document.getElementById('edit-input').value.replace(/[^0-9.]/g, '');
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) return;

    if (editingField === 'remaining') {
      // Adjust: add a synthetic "correction" spend to reconcile
      // TODO: implement remaining balance override logic
      console.log('TODO: remaining balance override');
    } else {
      PP.updateSettings({ [config.key]: val });
    }
  }

  renderValues();
  UI.closeSheet('sheet-edit');
  editingField = null;
}

// ============================================
// Event binding
// ============================================

function bindEvents() {
  // Back button
  document.getElementById('btn-back')?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Settings rows → open edit sheet
  document.getElementById('row-budget')?.addEventListener('click',     () => openEditSheet('budget'));
  document.getElementById('row-start-date')?.addEventListener('click', () => openEditSheet('startDate'));
  document.getElementById('row-end-date')?.addEventListener('click',   () => openEditSheet('endDate'));
  document.getElementById('row-remaining')?.addEventListener('click',  () => openEditSheet('remaining'));
  document.getElementById('row-warn')?.addEventListener('click',       () => openEditSheet('warn'));
  document.getElementById('row-danger')?.addEventListener('click',     () => openEditSheet('danger'));

  // Confirm edit
  document.getElementById('btn-edit-confirm')?.addEventListener('click', confirmEdit);

  // Backdated spend — open sheet
  document.getElementById('btn-add-backdated')?.addEventListener('click', () => {
    const state = PP.getState();

    const dateInput = document.getElementById('bd-date');
    if (dateInput) {
      const today = PP.todayISO();
      dateInput.value = today;
      dateInput.max   = today;
      dateInput.min   = state.startDate ?? today;
    }

    document.getElementById('bd-amount').value = '';
    UI.openSheet('sheet-backdated');
    setTimeout(() => document.getElementById('bd-amount')?.focus(), 300);
  });

  // Backdated spend — confirm
  document.getElementById('btn-backdated-confirm')?.addEventListener('click', () => {
    const date   = document.getElementById('bd-date')?.value;
    const raw    = document.getElementById('bd-amount')?.value.replace(/[^0-9.]/g, '');
    const amount = parseFloat(raw);

    if (!date)                    { shake(document.getElementById('bd-date'));   return; }
    if (isNaN(amount) || amount <= 0) { shake(document.getElementById('bd-amount')); return; }

    PP.addSpend(amount, date);
    renderValues();
    UI.closeSheet('sheet-backdated');
  });

  // Reset
  document.getElementById('row-reset')?.addEventListener('click', () => {
    if (!confirm('Reset your budget period? This will clear all spends and settings.')) return;
    localStorage.removeItem('pacepay_v1');
    window.location.href = 'index.html';
  });

  // Overlay
  document.getElementById('overlay')?.addEventListener('click', UI.closeAllSheets);

  // Sheet close buttons
  document.querySelectorAll('[data-close-sheet]').forEach(btn => {
    btn.addEventListener('click', () => UI.closeSheet(btn.dataset.closeSheet));
  });
}

// ============================================
// Boot
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
