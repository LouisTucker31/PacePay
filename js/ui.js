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
  var overlay = document.getElementById('overlay');
  var sheet   = document.getElementById(id);
  if (!overlay || !sheet) return;
  overlay.style.opacity    = '';
  overlay.style.transition = '';
  overlay.classList.add('is-open');
  sheet.style.transform  = '';
  sheet.style.transition = '';
  sheet.classList.add('is-open');
  // Don't lock body scroll — causes iOS page jump
}

function closeSheet(id) {
  var overlay = document.getElementById('overlay');
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

function closeAllSheets() {
  document.querySelectorAll('.sheet').forEach(function(s) {
    s.classList.remove('is-open');
    s.style.transform  = '';
    s.style.transition = '';
  });
  var overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.style.opacity    = '';
    overlay.style.transition = '';
  }
}

// ============================================
// Sheet drag-to-dismiss
// ============================================

function initSheetDrag(sheet) {
  var startY      = 0;
  var currentY    = 0;
  var isDragging  = false;
  var THRESHOLD   = 100; // px to dismiss
  var VELOCITY_TH = 0.3; // px/ms flick
  var lastY       = 0;
  var lastT       = 0;
  var velocity    = 0;

  function getOverlay() { return document.getElementById('overlay'); }

  function onStart(e) {
    if (!sheet.classList.contains('is-open')) return;
    var touch = e.touches[0];
    startY    = touch.clientY;
    currentY  = touch.clientY;
    lastY     = touch.clientY;
    lastT     = Date.now();
    velocity  = 0;
    isDragging = true;
    sheet.dataset.dragging = '1';
    // Kill transition so sheet tracks finger instantly
    sheet.style.transition = 'none';
    getOverlay().style.transition = 'none';
  }

  function onMove(e) {
    if (!isDragging) return;
    var touch = e.touches[0];
    currentY  = touch.clientY;
    var dy    = currentY - startY;

    // Only intercept downward drags — let upward scrolls pass through
    if (dy <= 0) return;

    e.preventDefault();

    var now = Date.now();
    var dt  = now - lastT || 1;
    velocity = (currentY - lastY) / dt;
    lastY    = currentY;
    lastT    = now;

    // Slight rubber-band resistance
    var resistance = 1 - Math.min(dy / (sheet.offsetHeight * 2), 0.4);
    var visual     = dy * resistance;

    sheet.style.transform = 'translateX(-50%) translateY(' + visual + 'px)';

    var opacity = Math.max(0, 1 - (visual / sheet.offsetHeight) * 1.8);
    getOverlay().style.opacity = opacity;
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;

    var dy = currentY - startY;

    // Restore transitions
    sheet.style.transition = '';
    getOverlay().style.transition = '';

    delete sheet.dataset.dragging;

    if (dy > THRESHOLD || velocity > VELOCITY_TH) {
      sheet.style.transform = 'translateX(-50%) translateY(100%)';
      getOverlay().style.opacity = '0';
      setTimeout(function() {
        closeSheet(sheet.id);
      }, 320);
    } else {
      sheet.style.transform = 'translateX(-50%) translateY(0)';
      getOverlay().style.opacity = '';
    }
  }

  // Must be non-passive so preventDefault() works in onMove
  sheet.addEventListener('touchstart',  onStart, { passive: true });
  sheet.addEventListener('touchmove',   onMove,  { passive: false });
  sheet.addEventListener('touchend',    onEnd,   { passive: true });
  sheet.addEventListener('touchcancel', onEnd,   { passive: true });
}

function initAllSheetDrags() {
  document.querySelectorAll('.sheet').forEach(initSheetDrag);
}

// ============================================
// Keyboard-aware sheet positioning
// ============================================

function initSheetKeyboardAdjust() {
  if (!window.visualViewport) return;

  function adjust() {
    var vv             = window.visualViewport;
    var keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
    keyboardHeight     = Math.max(0, keyboardHeight);

    document.querySelectorAll('.sheet.is-open').forEach(function(sheet) {
      if (sheet.dataset.dragging) return;
      if (keyboardHeight > 0) {
        // Lift the sheet just enough so it clears the keyboard
        // translateX(-50%) keeps horizontal centering; translateY moves it up
        sheet.style.transition = 'transform 280ms cubic-bezier(0.22,1,0.36,1)';
        sheet.style.transform  = 'translateX(-50%) translateY(-' + keyboardHeight + 'px)';
      } else {
        sheet.style.transition = 'transform 280ms cubic-bezier(0.22,1,0.36,1)';
        sheet.style.transform  = 'translateX(-50%) translateY(0)';
      }
    });
  }

  window.visualViewport.addEventListener('resize', adjust);
  window.visualViewport.addEventListener('scroll', adjust);
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
  initSheetKeyboardAdjust,
  PACE_TOKENS,
};
