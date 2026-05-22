// ============================================
// PACEPAY — Settings Logic
// ============================================

var PP = window.PacePay;
var UI = window.PacePayUI;

var editingField = null;

function updateNotificationStatus() {
  var el = document.getElementById('val-notifications');
  if (!el) return;
  if (!('Notification' in window)) {
    el.textContent = 'Not supported';
    return;
  }
  el.textContent = Notification.permission === 'granted' ? 'On' : 'Off';
}

function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

// ============================================
// Panel open / close
// ============================================

function openSettingsPanel() {
  PP.loadState();
  renderValues();
  var panel = document.getElementById('settings-panel');
  if (panel) panel.classList.add('is-open');
}

function closeSettingsPanel() {
  var panel = document.getElementById('settings-panel');
  if (!panel) return;
  // Close any open sheets first
  closeSettingsSheet('sheet-edit');
  closeSettingsSheet('sheet-backdated');
  panel.classList.remove('is-open');
  // Re-render home so any changes (e.g. deleted spends) are reflected
  UI.renderHome(false);
}

// ============================================
// Settings-scoped sheet helpers
// (sheets live inside the panel, overlay is settings-overlay)
// ============================================

function openSettingsSheet(id) {
  var overlay = document.getElementById('settings-overlay');
  var sheet   = document.getElementById(id);
  if (!overlay || !sheet) return;
  overlay.style.opacity    = '';
  overlay.style.transition = '';
  overlay.classList.add('is-open');
  sheet.style.transform  = '';
  sheet.style.transition = '';
  sheet.classList.add('is-open');
}

function closeSettingsSheet(id) {
  var overlay = document.getElementById('settings-overlay');
  var sheet   = document.getElementById(id);
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.style.opacity    = '';
    overlay.style.transition = '';
  }
  if (sheet) {
    sheet.classList.remove('is-open');
    sheet.style.transform  = '';
    sheet.style.transition = '';
  }
}

// ============================================
// Render
// ============================================

function renderValues() {
  var state = PP.getState();

  document.getElementById('val-budget').textContent =
    state.budget !== null ? UI.formatCurrency(state.budget) : 'Set budget';

  document.getElementById('val-start-date').textContent =
    UI.formatDateShort(state.startDate);

  document.getElementById('val-end-date').textContent =
    UI.formatDateShort(state.endDate);

  document.getElementById('val-remaining').textContent =
    state.budget !== null ? UI.formatCurrency(PP.remainingBudget()) : '—';

  document.getElementById('val-warn').textContent =
    '£' + state.warnThreshold + '/day';

  document.getElementById('val-danger').textContent =
    '£' + state.dangerThreshold + '/day';

  renderSpendList();
}

function renderSpendList() {
  var state     = PP.getState();
  var container = document.getElementById('spend-list-container');
  if (!container) return;

  if (state.spends.length === 0) {
    container.innerHTML = '<p class="text-subtle" style="padding: var(--space-sm)">No spends recorded yet.</p>';
    return;
  }

  var sorted = state.spends.slice().sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  container.innerHTML = '<div class="spend-list">' +
    sorted.map(function(s) {
      return '<div class="spend-item" data-id="' + s.id + '">' +
        '<span class="spend-item__date">'   + UI.formatDateShort(s.date) + '</span>' +
        '<span class="spend-item__amount">' + UI.formatCurrency(s.amount) + '</span>' +
        '<div class="spend-item__actions">' +
          '<button class="spend-item__delete" data-delete="' + s.id + '" aria-label="Delete spend">✕</button>' +
        '</div></div>';
    }).join('') +
  '</div>';

  container.querySelectorAll('[data-delete]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      PP.deleteSpend(btn.dataset.delete);
      renderValues();
    });
  });
}

// ============================================
// Edit sheet
// ============================================

var EDIT_CONFIG = {
  budget:    { title: 'Starting budget',   type: 'currency', key: 'budget',         min: 0 },
  remaining: { title: 'Current remaining', type: 'currency', key: null,              min: 0 },
  warn:      { title: 'Warning level',     type: 'currency', key: 'warnThreshold',   min: 0 },
  danger:    { title: 'Danger level',      type: 'currency', key: 'dangerThreshold', min: 0 },
  startDate: { title: 'Start date',        type: 'date',     key: 'startDate'               },
  endDate:   { title: 'Payday / end date', type: 'date',     key: 'endDate'                 },
};

function openEditSheet(field) {
  editingField = field;
  var config  = EDIT_CONFIG[field];
  var state   = PP.getState();

  document.getElementById('sheet-edit-title').textContent = config.title;

  var currencyWrap = document.getElementById('edit-currency-wrap');
  var numInput     = document.getElementById('edit-input');
  var dateInput    = document.getElementById('edit-date-input');

  if (config.type === 'date') {
    currencyWrap.classList.add('hidden');
    dateInput.classList.remove('hidden');
    dateInput.value = config.key ? (state[config.key] || '') : '';
  } else {
    currencyWrap.classList.remove('hidden');
    dateInput.classList.add('hidden');
    var current = config.key ? state[config.key] : PP.remainingBudget();
    numInput.value       = current !== null ? current : '';
    numInput.min         = config.min || 0;
    numInput.placeholder = '0.00';
  }

  openSettingsSheet('sheet-edit');
  setTimeout(function() {
    (config.type === 'date' ? dateInput : numInput).focus();
  }, 300);
}

function confirmEdit() {
  if (!editingField) return;
  var config = EDIT_CONFIG[editingField];

  if (config.type === 'date') {
    var val = document.getElementById('edit-date-input').value;
    if (!val) return;
    PP.updateSettings({ [config.key]: val });
  } else {
    var raw = document.getElementById('edit-input').value.replace(/[^0-9.]/g, '');
    var val = parseFloat(raw);
    if (isNaN(val) || val < 0) return;
    if (config.key) PP.updateSettings({ [config.key]: val });
  }

  renderValues();
  closeSettingsSheet('sheet-edit');
  editingField = null;
}

// ============================================
// Swipe right to close panel
// ============================================

function initPanelSwipe() {
  var panel     = document.getElementById('settings-panel');
  if (!panel) return;

  var startX    = 0;
  var startY    = 0;
  var currentX  = 0;
  var tracking  = false;
  var THRESHOLD = 80;
  var EDGE      = 60; // px from left edge to start tracking

  panel.addEventListener('touchstart', function(e) {
    // Only track if a sheet isn't open
    if (document.getElementById('sheet-edit')?.classList.contains('is-open')) return;
    if (document.getElementById('sheet-backdated')?.classList.contains('is-open')) return;
    var touch = e.touches[0];
    if (touch.clientX > EDGE) return; // only from left edge
    startX   = touch.clientX;
    startY   = touch.clientY;
    currentX = touch.clientX;
    tracking = true;
    panel.style.transition = 'none';
  }, { passive: true });

  panel.addEventListener('touchmove', function(e) {
    if (!tracking) return;
    var touch = e.touches[0];
    currentX  = touch.clientX;
    var dx    = currentX - startX;
    var dy    = Math.abs(touch.clientY - startY);

    // Cancel if more vertical than horizontal
    if (dy > Math.abs(dx)) { tracking = false; panel.style.transition = ''; return; }
    if (dx < 0) return; // no leftward drag

    e.preventDefault();
    panel.style.transform = 'translateX(' + dx + 'px)';
  }, { passive: false });

  panel.addEventListener('touchend', function() {
    if (!tracking) return;
    tracking = false;
    panel.style.transition = '';

    var dx = currentX - startX;
    if (dx > THRESHOLD) {
      // Animate out then close
      panel.style.transform = 'translateX(100%)';
      setTimeout(function() {
        panel.style.transform = '';
        closeSettingsPanel();
      }, 320);
    } else {
      panel.style.transform = '';
    }
  }, { passive: true });

  panel.addEventListener('touchcancel', function() {
    tracking = false;
    panel.style.transition = '';
    panel.style.transform  = '';
  }, { passive: true });
}

// ============================================
// Event binding
// ============================================

function bindSettingsEvents() {
  // Back button
  document.getElementById('btn-back')?.addEventListener('click', closeSettingsPanel);

  // Row taps
  document.getElementById('row-budget')?.addEventListener('click',     function() { openEditSheet('budget'); });
  document.getElementById('row-start-date')?.addEventListener('click', function() { openEditSheet('startDate'); });
  document.getElementById('row-end-date')?.addEventListener('click',   function() { openEditSheet('endDate'); });
  document.getElementById('row-remaining')?.addEventListener('click',  function() { openEditSheet('remaining'); });
  document.getElementById('row-warn')?.addEventListener('click',       function() { openEditSheet('warn'); });
  document.getElementById('row-danger')?.addEventListener('click',     function() { openEditSheet('danger'); });

  // Confirm edit
  document.getElementById('btn-edit-confirm')?.addEventListener('click', confirmEdit);

  // Backdated spend — open
  document.getElementById('btn-add-backdated')?.addEventListener('click', function() {
    var state = PP.getState();
    var dateInput = document.getElementById('bd-date');
    if (dateInput) {
      var today = PP.todayISO();
      dateInput.value = today;
      dateInput.max   = today;
      dateInput.min   = state.startDate || today;
    }
    document.getElementById('bd-amount').value = '';
    openSettingsSheet('sheet-backdated');
    setTimeout(function() { document.getElementById('bd-amount')?.focus(); }, 300);
  });

  // Backdated spend — confirm
  document.getElementById('btn-backdated-confirm')?.addEventListener('click', function() {
    var date   = document.getElementById('bd-date')?.value;
    var raw    = document.getElementById('bd-amount')?.value.replace(/[^0-9.]/g, '');
    var amount = parseFloat(raw);
    if (!date)                       { shake(document.getElementById('bd-date'));   return; }
    if (isNaN(amount) || amount <= 0) { shake(document.getElementById('bd-amount')); return; }
    PP.addSpend(amount, date);
    renderValues();
    closeSettingsSheet('sheet-backdated');
  });

  // Notifications row
  updateNotificationStatus();
  document.getElementById('row-notifications')?.addEventListener('click', function() {
    var N = window.PacePayNotifications;
    if (!N) return;
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser.\nInstall PacePay to your home screen to enable them.');
      return;
    }
    if (Notification.permission === 'denied') {
      alert('Notifications are blocked. Please enable them in your device Settings > Safari > PacePay.');
      return;
    }
    N.requestPermission(function(granted) {
      updateNotificationStatus();
    });
  });

  // Add funds — open
  document.getElementById('row-add-funds')?.addEventListener('click', function() {
    document.getElementById('add-funds-input').value = '';
    openSettingsSheet('sheet-add-funds');
    setTimeout(function() { document.getElementById('add-funds-input')?.focus(); }, 300);
  });

  // Add funds — confirm
  document.getElementById('btn-add-funds-confirm')?.addEventListener('click', function() {
    var raw    = document.getElementById('add-funds-input')?.value.replace(/[^0-9.]/g, '');
    var amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) { shake(document.getElementById('add-funds-input')); return; }
    PP.addFunds(amount);
    renderValues();
    closeSettingsSheet('sheet-add-funds');
  });

  // Reset
  document.getElementById('row-reset')?.addEventListener('click', function() {
    if (!confirm('Reset your budget period? This will clear all spends and settings.')) return;
    localStorage.removeItem('pacepay_v1');
    closeSettingsPanel();
    PP.loadState();
    UI.renderHome(false);
  });

  // Settings overlay closes sheets
  document.getElementById('settings-overlay')?.addEventListener('click', function() {
    closeSettingsSheet('sheet-edit');
    closeSettingsSheet('sheet-backdated');
  });

  // data-close-sheet buttons inside the panel
  document.querySelectorAll('#settings-panel [data-close-sheet]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      closeSettingsSheet(btn.dataset.closeSheet);
    });
  });

  // Sheet drag-to-dismiss for settings sheets
  ['sheet-edit', 'sheet-backdated', 'sheet-add-funds'].forEach(function(id) {
    var sheet = document.getElementById(id);
    if (sheet) initSettingsSheetDrag(sheet);
  });

  initPanelSwipe();
}

// Drag-to-dismiss for sheets inside the settings panel
// (mirrors ui.js but uses closeSettingsSheet)
function initSettingsSheetDrag(sheet) {
  var startX    = 0;
  var startY    = 0;
  var startYs   = 0;
  var currentY  = 0;
  var isDragging = false;
  var THRESHOLD  = 100;
  var VELOCITY_TH = 0.3;
  var lastY = 0, lastT = 0, velocity = 0;

  function getOverlay() { return document.getElementById('settings-overlay'); }

  sheet.addEventListener('touchstart', function(e) {
    if (!sheet.classList.contains('is-open')) return;
    var touch = e.touches[0];
    startYs   = touch.clientY;
    currentY  = touch.clientY;
    lastY     = touch.clientY;
    lastT     = Date.now();
    velocity  = 0;
    isDragging = true;
    sheet.style.transition = 'none';
    getOverlay().style.transition = 'none';
  }, { passive: true });

  sheet.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    var touch = e.touches[0];
    currentY  = touch.clientY;
    var dy    = currentY - startYs;
    if (dy <= 0) return;
    e.preventDefault();
    var now = Date.now(), dt = now - lastT || 1;
    velocity = (currentY - lastY) / dt;
    lastY = currentY; lastT = now;
    var resistance = 1 - Math.min(dy / (sheet.offsetHeight * 2), 0.4);
    sheet.style.transform = 'translateX(-50%) translateY(' + dy * resistance + 'px)';
    var overlay = getOverlay();
    if (overlay) overlay.style.opacity = Math.max(0, 1 - (dy * resistance / sheet.offsetHeight) * 1.8);
  }, { passive: false });

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    sheet.style.transition = '';
    getOverlay().style.transition = '';
    var dy = currentY - startYs;
    if (dy > THRESHOLD || velocity > VELOCITY_TH) {
      sheet.style.transform = 'translateX(-50%) translateY(100%)';
      getOverlay().style.opacity = '0';
      setTimeout(function() { closeSettingsSheet(sheet.id); }, 320);
    } else {
      sheet.style.transform = 'translateX(-50%) translateY(0)';
      getOverlay().style.opacity = '';
    }
  }

  sheet.addEventListener('touchend',    onEnd, { passive: true });
  sheet.addEventListener('touchcancel', onEnd, { passive: true });
}

// ============================================
// Boot — runs on index.html after DOM ready
// ============================================

function initSettings() {
  bindSettingsEvents();
  // Wire settings button on the home screen
  document.getElementById('btn-settings')?.addEventListener('click', openSettingsPanel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettings);
} else {
  initSettings();
}
