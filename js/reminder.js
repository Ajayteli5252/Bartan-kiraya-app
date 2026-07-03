// ============================================
// reminder.js — WhatsApp Messages & Due Date Alerts
// ============================================

// Emoji constants (Unicode escapes — encoding issues se safe)
var E = {
  pray:    '\uD83D\uDE4F',   // 🙏
  check:   '\u2705',         // ✅
  receipt: '\uD83D\uDCCB',   // 📋
  cal:     '\uD83D\uDCC5',   // 📅
  back:    '\uD83D\uDD19',   // 🔙
  clock3:  '\u23F3',         // ⏳
  bucket:  '\uD83E\uDEA3',   // 🪣
  money:   '\uD83D\uDCB0',   // 💰
  warn:    '\u26A0\uFE0F',   // ⚠️
  pin:     '\uD83D\uDCCC',   // 📌
  phone:   '\uD83D\uDCF2',   // 📲
  clock:   '\uD83D\uDD50',   // 🕐
  party:   '\uD83C\uDF89',   // 🎉
  bell:    '\uD83D\uDD14',   // 🔔
  line:    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501'
};

// ============================================
// SMART DISPATCHER — Booking detail ka WhatsApp button
// Booking status dekh ke sahi message bhejta hai
// ============================================
function sendCurrentBookingWhatsApp() {
  var booking = window.currentBooking;
  if (!booking) { showToast('\u26A0\uFE0F Booking data nahi mila!'); return; }

  if (booking.status === 'returned') {
    sendReturnConfirmWhatsApp(booking);
  } else {
    sendBookingConfirmWhatsApp(booking);
  }
}

// ============================================
// 1. BOOKING CONFIRM — Active booking detail page
// ============================================
function sendBookingConfirmWhatsApp(booking) {
  var mobile = booking.mobile;
  if (!mobile) return;

  var bookingDateFmt = new Date(booking.bookingDate).toLocaleString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  var returnDateFmt = new Date(booking.returnDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // Bartan list
  var bartanList = '';
  (booking.items || []).forEach(function(item) {
    if (item.nag > 0) {
      bartanList += '  \u2022 ' + item.name + ': ' + item.nag + ' nag \u00D7 \u20B9' + item.ratePerDay + '/din = \u20B9' + item.rakam + '\n';
    }
  });

  var advance = (booking.totalAmount || 0) - (booking.pendingAmount || 0);
  var pendingAmt = booking.pendingAmount || 0;

  var message =
    E.pray + ' *Namaskar ' + booking.customerName + ' ji!*\n' +
    'Shivshakti Bartan Kiraya\n' +
    E.line + '\n\n' +
    E.check + ' *Aapki Booking Confirm Ho Gayi!*\n\n' +
    E.receipt + ' *Receipt No:* ' + booking.receiptNo + '\n' +
    E.cal + ' *Booking Date:* ' + bookingDateFmt + '\n' +
    E.back + ' *Wapsi Date:* ' + returnDateFmt + '\n' +
    E.clock3 + ' *Total Din:* ' + booking.totalDays + ' din\n\n' +
    E.line + '\n' +
    E.bucket + ' *Bartan Details:*\n' +
    bartanList +
    E.line + '\n' +
    E.money + ' *Total Rakam:* \u20B9' + booking.totalAmount + '\n' +
    E.check + ' *Advance Diya:* \u20B9' + advance + '\n' +
    E.warn + ' *Baaki (Pending):* \u20B9' + pendingAmt + '\n' +
    E.line + '\n\n' +
    E.pin + ' Kripya *' + returnDateFmt + '* tak bartan wapas kar dein.\n\n' +
    'Dhanyawad ' + E.pray;

  var encoded = encodeURIComponent(message);
  var url = 'https://wa.me/91' + mobile + '?text=' + encoded;
  window.open(url, '_blank');
}

// ============================================
// 2. DUE DATE REMINDER — Return date pe ya due alert se
// ============================================
function sendWhatsAppReminder(mobile, customerName, returnDate) {
  if (!mobile) { showToast('\u26A0\uFE0F Mobile number nahi hai!'); return; }

  var returnFormatted = new Date(returnDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  var message =
    E.pray + ' *Namaskar ' + customerName + ' ji!*\n' +
    'Shivshakti Bartan Kiraya\n' +
    E.line + '\n\n' +
    E.warn + ' *Bartan Wapsi Reminder*\n\n' +
    'Aapka bartan kiraya wapas karne ki tarikh *' + returnFormatted + '* hai.\n\n' +
    'Kripya samay par bartan wapas kar dein.\n\n' +
    E.line + '\n' +
    'Dhanyawad ' + E.pray + '\n' +
    '_Shivshakti Bartan Kiraya_';

  var encoded = encodeURIComponent(message);
  var url = 'https://wa.me/91' + mobile + '?text=' + encoded;
  window.open(url, '_blank');
}

// ============================================
// 3. RETURN CONFIRM — Bartan wapas hone par
// ============================================
function sendReturnConfirmWhatsApp(booking) {
  var mobile = booking.mobile;
  if (!mobile) return;

  var returnTime = booking.returnedAt ? new Date(booking.returnedAt) : new Date();
  var returnedAtFmt = returnTime.toLocaleString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  var bookingDateFmt = new Date(booking.bookingDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // Bartan list
  var bartanList = '';
  (booking.items || []).forEach(function(item) {
    if (item.nag > 0) {
      bartanList += '  \u2022 ' + item.name + ': ' + item.nag + ' nag\n';
    }
  });

  var totalPaid = (booking.totalAmount || 0) - (booking.pendingAmount || 0);
  var pendingAmt = booking.pendingAmount || 0;

  // Penalty details formatting for WhatsApp
  var penaltyStr = '';
  if ((booking.penalty || 0) > 0) {
    penaltyStr = E.warn + ' *Penalty Details:*\n';
    if (booking.penaltyDetails && booking.penaltyDetails.length > 0) {
      booking.penaltyDetails.forEach(function(p) {
        penaltyStr += '  \u2022 ' + p.itemName + ' (' + (p.type === 'damaged' ? 'Damage' : 'Missing') + '): \u20B9' + p.amount + '\n';
      });
    }
    if ((booking.overduePenalty || 0) > 0) {
      penaltyStr += '  \u2022 Overdue Penalty (' + (booking.overdueDays || 0) + ' din late): \u20B9' + booking.overduePenalty + '\n';
    }
    penaltyStr += '  *Total Penalty:* \u20B9' + booking.penalty + '\n' + E.line + '\n';
  }

  var message =
    E.pray + ' *Namaskar ' + booking.customerName + ' ji!*\n' +
    'Shivshakti Bartan Kiraya\n' +
    E.line + '\n\n' +
    E.check + ' *Aapka Saman Wapas Ho Gaya!*\n\n' +
    E.receipt + ' *Receipt No:* ' + booking.receiptNo + '\n' +
    E.cal + ' *Booking Thi:* ' + bookingDateFmt + '\n' +
    E.clock + ' *Wapsi Time:* ' + returnedAtFmt + '\n\n' +
    E.line + '\n' +
    E.bucket + ' *Wapas Aaye Bartan:*\n' +
    bartanList +
    E.line + '\n' +
    penaltyStr +
    E.money + ' *Total Rakam:* \u20B9' + booking.totalAmount + '\n' +
    E.check + ' *Paid:* \u20B9' + totalPaid + '\n' +
    (pendingAmt > 0
      ? E.warn + ' *Baaki Payment:* \u20B9' + pendingAmt + ' abhi bhi baki hai.\nKripya jaldi nipatata kar dein.\n\n'
      : E.check + ' *Payment:* Poora payment clear ho gaya! ' + E.party + '\n\n') +
    'Aapka bahut bahut dhanyawad! ' + E.pray + '\n' +
    '_Shivshakti Bartan Kiraya_';

  var encoded = encodeURIComponent(message);
  var url = 'https://wa.me/91' + mobile + '?text=' + encoded;
  window.open(url, '_blank');
}

// ============================================
// 4. DUE DATE AUTO CHECK — App open hone par
// ============================================
async function checkDueDateAlerts() {
  var bookings = await BartanDB.getAll(BartanDB.STORES.BOOKINGS);
  var activeBookings = bookings.filter(function(b) { return b.status === 'active'; });
  var todayStr = new Date().toISOString().split('T')[0];

  var dueToday = activeBookings.filter(function(b) {
    var retStr = (b.returnDate || '').split('T')[0];
    return retStr === todayStr && b.mobile;
  });

  var overdue = activeBookings.filter(function(b) {
    var retStr = (b.returnDate || '').split('T')[0];
    return retStr < todayStr && b.mobile;
  });

  if (dueToday.length === 0 && overdue.length === 0) return;
  showDueAlertBanner(dueToday, overdue);
}

function showDueAlertBanner(dueToday, overdue) {
  var old = document.getElementById('due-alert-banner');
  if (old) old.remove();

  var banner = document.createElement('div');
  banner.id = 'due-alert-banner';
  banner.className = 'due-alert-overlay';

  var content = '';

  if (overdue.length > 0) {
    content += '<div class="due-alert-section overdue-section">' +
      '<div class="due-alert-icon">' + E.warn + '</div>' +
      '<div class="due-alert-title">' + overdue.length + ' Booking(s) Overdue Hain!</div>' +
      '<div class="due-alert-list">';
    overdue.forEach(function(b) {
      var safeName = (b.customerName || '').replace(/'/g, "\\'");
      content += '<div class="due-alert-item">' +
        '<span class="due-name">' + b.customerName + '</span>' +
        '<button class="btn-wa-small" onclick="sendWhatsAppReminder(\'' + b.mobile + '\',\'' + safeName + '\',\'' + b.returnDate + '\')">' +
        E.phone + ' Reminder Bhejo</button>' +
        '</div>';
    });
    content += '</div></div>';
  }

  if (dueToday.length > 0) {
    content += '<div class="due-alert-section due-section">' +
      '<div class="due-alert-icon">' + E.cal + '</div>' +
      '<div class="due-alert-title">' + dueToday.length + ' Booking(s) Aaj Return Honi Hain!</div>' +
      '<div class="due-alert-list">';
    dueToday.forEach(function(b) {
      var safeName = (b.customerName || '').replace(/'/g, "\\'");
      content += '<div class="due-alert-item">' +
        '<span class="due-name">' + b.customerName + '</span>' +
        '<button class="btn-wa-small" onclick="sendWhatsAppReminder(\'' + b.mobile + '\',\'' + safeName + '\',\'' + b.returnDate + '\')">' +
        E.phone + ' Remind Bhejo</button>' +
        '</div>';
    });
    content += '</div></div>';
  }

  banner.innerHTML =
    '<div class="due-alert-sheet">' +
      '<div class="due-alert-header">' +
        '<span>' + E.bell + ' Aaj ke Alerts</span>' +
        '<button class="due-alert-close" onclick="document.getElementById(\'due-alert-banner\').remove()">\u2715</button>' +
      '</div>' +
      content +
      '<button class="btn btn-outline due-alert-dismiss" onclick="document.getElementById(\'due-alert-banner\').remove()">' +
        'Theek Hai, Samajh Gaya' +
      '</button>' +
    '</div>';

  document.body.appendChild(banner);
}