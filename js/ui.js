// ============================================
// PACEPAY — UI / Render
// ============================================


// ============================================
// Colour / pace state
// ============================================

const PACE_TOKENS = {
  green: {
    bg:     'var(--colour-green-bg)',
    accent: 'var(--colour-green-accent)',
    text:   'var(--colour-green-text)',
    label:  'Comfortably on pace',
  },
  amber: {
    bg:     'var(--colour-amber-bg)',
    accent: 'var(--colour-amber-accent)',
    text:   'var(--colour-amber-text)',
    label:  'Spending a little fast',
  },
  red: {
    bg:     'var(--colour-red-bg)',
    accent: 'var(--colour-red-accent)',
    text:   'var(--colour-red-text)',
    label:  'Tight — slow down a little',
  },
};

/**
 * Update CSS variables on :root to reflect pace state
 */
function applyPaceColour(pace) {
  const t = PACE_TOKENS[pace];
  const root = document.documentElement;
  root.style.setProperty('--pace-bg',     t.bg);
  root.style.setProperty('--pace-accent', t.accent);
  root.style.setProperty('--pace-text',   t.text);
}

// ============================================
// Formatting helpers
// ============================================

/**
 * Format a number as £xx.xx
 */
function formatCurrency(amount) {
  return '£' + Math.abs(amount).toFixed(2);
}

/**
 * Format a date string as 'Mon DD' (e.g. 'Jun 14')
 */
function formatDateShort(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ============================================
// Number animation
// ============================================

var _currentDisplayedAmount = null;
var _animationFrame = null;

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function animateAmount(fromVal, toVal, onComplete) {
  const el = document.getElementById('hero-amount');
  if (!el) return;

  if (_animationFrame) cancelAnimationFrame(_animationFrame);

  const duration = 600;
  const start    = performance.now();

  function tick(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = easeOutQuart(progress);
    const current  = fromVal + (toVal - fromVal) * eased;

    el.textContent = formatCurrency(current);

    if (progress < 1) {
      _animationFrame = requestAnimationFrame(tick);
    } else {
      el.textContent = formatCurrency(toVal);
      _currentDisplayedAmount = toVal;
      if (onComplete) onComplete();
    }
  }

  _animationFrame = requestAnimationFrame(tick);
}

function pulseHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  hero.classList.remove('hero--pulse');
  void hero.offsetWidth; // reflow to restart
  hero.classList.add('hero--pulse');
}

// ============================================
// Home screen render
// ============================================

/**
 * Full home screen refresh — call after any state change
 */
function renderHome(animate) {
  if (!window.PacePay.isOnboarded()) {
    showOnboarding();
    return;
  }

  hideOnboarding();

  const daily    = window.PacePay.dailyAmount();
  const pace     = window.PacePay.paceState();
  const tokens   = PACE_TOKENS[pace];
  const daysLeft = window.PacePay.daysRemaining();

  applyPaceColour(pace);

  // Animate number if we have a previous value to count from, otherwise set instantly
  const amountEl = document.getElementById('hero-amount');
  if (amountEl) {
    if (animate && _currentDisplayedAmount !== null) {
      pulseHero();
      animateAmount(_currentDisplayedAmount, daily);
    } else {
      amountEl.textContent = formatCurrency(daily);
      _currentDisplayedAmount = daily;
    }
  }

  const statusEl = document.getElementById('status-pill');
  if (statusEl) statusEl.textContent = tokens.label;

  const daysEl = document.getElementById('days-label');
  if (daysEl) {
    daysEl.textContent = daysLeft === 1
      ? 'Last day of this period'
      : `${daysLeft} days remaining`;
  }

  const progressEl = document.getElementById('progress-fill');
  if (progressEl) {
    const total = window.PacePay.totalDays();
    const pct   = total > 0 ? ((total - daysLeft) / total) * 100 : 0;
    progressEl.style.width = `${Math.min(100, pct)}%`;
  }
}

// ============================================
// Onboarding visibility
// ============================================

function showOnboarding() {
  applyPaceColour('green');
  document.getElementById('onboarding-section')?.classList.remove('hidden');
  document.getElementById('main-section')?.classList.add('hidden');
  const track = document.getElementById('onboarding-track');
  if (track && !track.dataset.current) track.dataset.current = '1';
}

function hideOnboarding() {
  document.getElementById('onboarding-section')?.classList.add('hidden');
  document.getElementById('main-section')?.classList.remove('hidden');
}

// ============================================
// Sheet (bottom drawer) helpers
// ============================================

function openSheet(id) {
  document.getElementById('overlay')?.classList.add('is-open');
  document.getElementById(id)?.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeSheet(id) {
  document.getElementById('overlay')?.classList.remove('is-open');
  document.getElementById(id)?.classList.remove('is-open');
  document.body.style.overflow = '';
}

function closeAllSheets() {
  document.querySelectorAll('.sheet.is-open').forEach(s => s.classList.remove('is-open'));
  document.getElementById('overlay')?.classList.remove('is-open');
  document.body.style.overflow = '';
}

// ============================================
// Sheet drag-to-dismiss
// ============================================

function initSheetDrag(sheet) {
  var startY      = 0;
  var currentY    = 0;
  var dragging    = false;
  var THRESHOLD   = 80;  // px dragged down to dismiss
  var VELOCITY_TH = 0.4; // px/ms flick speed to dismiss
  var lastY       = 0;
  var lastT       = 0;
  var velocity    = 0;

  function onStart(e) {
    if (!sheet.classList.contains('is-open')) return;
    startY   = e.touches ? e.touches[0].clientY : e.clientY;
    lastY    = startY;
    lastT    = Date.now();
    dragging = true;
    velocity = 0;
    sheet.style.transition = 'none';
  }

  function onMove(e) {
    if (!dragging) return;
    currentY = e.touches ? e.touches[0].clientY : e.clientY;
    var dy = currentY - startY;
    if (dy < 0) dy = 0; // don't allow dragging up

    var now = Date.now();
    var dt  = now - lastT;
    if (dt > 0) velocity = (currentY - lastY) / dt;
    lastY = currentY;
    lastT = now;

    sheet.style.transform = 'translateX(-50%) translateY(' + dy + 'px)';

    // Fade overlay proportionally
    var sheetH  = sheet.offsetHeight;
    var opacity = Math.max(0, 1 - (dy / sheetH) * 1.5);
    var overlay = document.getElementById('overlay');
    if (overlay) overlay.style.opacity = opacity;

    e.preventDefault();
  }

  function onEnd() {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';

    var dy = currentY - startY;
    if (dy > THRESHOLD || velocity > VELOCITY_TH) {
      // Dismiss
      var id = sheet.id;
      sheet.style.transform = '';
      var overlay = document.getElementById('overlay');
      if (overlay) overlay.style.opacity = '';
      closeSheet(id);
    } else {
      // Snap back
      sheet.style.transform = 'translateX(-50%) translateY(0)';
      var overlay = document.getElementById('overlay');
      if (overlay) overlay.style.opacity = '';
    }
  }

  sheet.addEventListener('touchstart',  onStart, { passive: true });
  sheet.addEventListener('touchmove',   onMove,  { passive: false });
  sheet.addEventListener('touchend',    onEnd);
  sheet.addEventListener('touchcancel', onEnd);
}

function initAllSheetDrags() {
  document.querySelectorAll('.sheet').forEach(initSheetDrag);
}

// ============================================
// Exports
// ============================================

window.PacePayUI = {
  renderHome,
  applyPaceColour,
  formatCurrency,
  formatDateShort,
  openSheet,
  closeSheet,
  closeAllSheets,
  initAllSheetDrags,
  PACE_TOKENS,
};
