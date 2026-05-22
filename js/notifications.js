// ============================================
// PACEPAY — Notifications
// ============================================
// Schedules two daily local notifications via setTimeout:
//   07:00 — daily budget amount
//   19:00 — reminder to log spending
//
// Requires notification permission. On iOS, only works
// when installed as a PWA (Add to Home Screen).
// ============================================

var _notifTimers = [];

function clearScheduledNotifications() {
  _notifTimers.forEach(function(t) { clearTimeout(t); });
  _notifTimers = [];
}

function msUntil(hour, minute) {
  var now    = new Date();
  var target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) {
    // Already passed today — schedule for tomorrow
    target.setDate(target.getDate() + 1);
  }
  return target - now;
}

function showNotification(title, body) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    // Fallback: direct Notification if SW not controlling yet
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
      });
    }
    return;
  }
  navigator.serviceWorker.ready.then(function(reg) {
    reg.showNotification(title, {
      body:    body,
      icon:    './icons/icon-192.png',
      badge:   './icons/icon-192.png',
      tag:     title, // deduplicates if fired twice
      renotify: false,
    });
  });
}

function scheduleDailyNotifications() {
  clearScheduledNotifications();

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  var PP    = window.PacePay;
  var UI    = window.PacePayUI;
  var state = PP ? PP.getState() : null;

  // 07:00 — daily budget
  var morningDelay = msUntil(7, 0);
  _notifTimers.push(setTimeout(function() {
    // Re-read state at fire time so the amount is current
    var s     = PP ? PP.getState() : null;
    var daily = PP ? PP.dailyAmount() : 0;
    var amt   = UI ? UI.formatCurrency(daily) : ('£' + daily.toFixed(2));
    showNotification('Good morning 👋', 'Your pace today is ' + amt + '. Have a good day!');
    // Re-schedule for tomorrow
    scheduleDailyNotifications();
  }, morningDelay));

  // 19:00 — log reminder
  var eveningDelay = msUntil(19, 0);
  _notifTimers.push(setTimeout(function() {
    showNotification('Don\'t forget 📝', 'Have you logged today\'s spending in PacePay?');
    // Re-schedule handled by morning timer's reschedule call
  }, eveningDelay));
}

function requestNotificationPermission(callback) {
  if (!('Notification' in window)) {
    if (callback) callback(false);
    return;
  }
  if (Notification.permission === 'granted') {
    scheduleDailyNotifications();
    if (callback) callback(true);
    return;
  }
  if (Notification.permission === 'denied') {
    if (callback) callback(false);
    return;
  }
  Notification.requestPermission().then(function(permission) {
    var granted = permission === 'granted';
    if (granted) scheduleDailyNotifications();
    if (callback) callback(granted);
  });
}

window.PacePayNotifications = {
  requestPermission:    requestNotificationPermission,
  scheduleDaily:        scheduleDailyNotifications,
  clearAll:             clearScheduledNotifications,
};
