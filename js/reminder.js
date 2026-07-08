// ============================================
// reminder.js — WhatsApp Messages & Due Date Alerts v4
// ============================================

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
  fire:    '\uD83D\uDD25',   // 🔥
  line:    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501'
};

// ============================================
// Helper — Get business name from settings
// ============================================
function getBizName() {
  return (window.appSettings && window.appSettings.businessName)
    ? window.appSettings.businessName
    : 'UtsavRentals';
}

function getWaFooter() {
  return (window.appSettings && window.appSettings.waFooter)
    ? window.appSettings.waFooter
    : 'Thank you for choosing us! ' + E.pray;
}

// ============================================
// SMART DISPATCHER — Booking WhatsApp button
// ============================================
function sendCurrentBookingWhatsApp() {
  var booking = window.currentBooking;
  if (!booking) { showToast('\u26A0\uFE0F Booking data not found!'); return; }

  if (booking.status === 'returned') {
    sendReturnConfirmWhatsApp(booking);
  } else {
    sendBookingConfirmWhatsApp(booking);
  }
}

// ============================================
// 1. BOOKING CONFIRM — Active booking
// ============================================
function sendBookingConfirmWhatsApp(booking) {
  var mobile = booking.mobile;
  if (!mobile) { showToast('\u26A0\uFE0F No mobile number in this booking!'); return; }

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
      bartanList += '  \u2022 ' + item.name + ': ' + item.nag + ' pcs \u00D7 \u20B9' + item.ratePerDay + '/day = \u20B9' + item.rakam + '\n';
    }
  });

  var advance    = (booking.totalAmount || 0) - (booking.pendingAmount || 0);
  var pendingAmt = booking.pendingAmount || 0;

  var message =
    E.pray + ' *Hello ' + booking.customerName + ' ji!*\n' +
    '_' + getBizName() + '_\n' +
    E.line + '\n\n' +
    E.check + ' *Your Booking is CONFIRMED!*\n\n' +
    E.receipt + ' *Receipt No:* ' + booking.receiptNo + '\n' +
    E.cal    + ' *Booking Date:* ' + bookingDateFmt  + '\n' +
    E.back   + ' *Return Date:* '  + returnDateFmt   + '\n' +
    E.clock3 + ' *Total Days:* '   + booking.totalDays + ' days\n\n' +
    E.line + '\n' +
    E.bucket + ' *Bartan Details:*\n' +
    bartanList +
    E.line + '\n' +
    E.money  + ' *Total Amount:* \u20B9' + (booking.totalAmount || 0).toLocaleString('en-IN') + '\n' +
    E.check  + ' *Advance Paid:* \u20B9' + advance.toLocaleString('en-IN') + '\n' +
    E.warn   + ' *Balance Due:*  \u20B9' + pendingAmt.toLocaleString('en-IN') + '\n' +
    E.line + '\n\n' +
    E.pin + ' Please return all bartan by *' + returnDateFmt + '*\n' +
    '\u26a0\uFE0F Late return may attract additional penalty charges.\n\n' +
    getWaFooter() + '\n' +
    '_' + getBizName() + '_';

  openWhatsApp(mobile, message);
}

// ============================================
// 2. DUE DATE REMINDER — Overdue / Due today / General
// ============================================
function sendWhatsAppReminder(mobile, customerName, returnDate) {
  if (!mobile) { showToast('\u26A0\uFE0F No mobile number!'); return; }

  // --- Safely parse returnDate ---
  var hasValidDate  = returnDate && returnDate.trim() !== '';
  var retDateObj    = hasValidDate ? new Date(returnDate) : null;
  var isValidDate   = retDateObj && !isNaN(retDateObj.getTime());

  var returnFormatted = '';
  if (isValidDate) {
    try {
      returnFormatted = retDateObj.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric'
      });
    } catch(e) { returnFormatted = returnDate; }
  }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate overdue days only if we have a valid date
  var overdueDays   = 0;
  var isOverdueFlag = false;
  var isDueTodayFlag= false;

  if (isValidDate) {
    var ret = new Date(retDateObj);
    ret.setHours(0, 0, 0, 0);
    var diffMs   = today - ret;
    overdueDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    isOverdueFlag  = overdueDays > 0;
    isDueTodayFlag = overdueDays === 0;
  }

  var bizName = getBizName();
  var footer  = getWaFooter();
  var message;

  if (!isValidDate) {
    // --- CASE 1: No date — General reminder from customer page ---
    message =
      E.bell + ' *UtsavRentals Reminder*\n' +
      E.line + '\n\n' +
      E.pray + ' Hello *' + customerName + ' ji!*\n\n' +
      'This is a reminder from *' + bizName + '*\n\n' +
      E.bucket + ' If you have bartan rented from us, kindly ensure timely return.\n\n' +
      E.warn   + ' Late returns will attract *penalty charges.*\n\n' +
      E.phone  + ' Please contact us if you have any queries.\n' +
      E.line + '\n' +
      footer + '\n' +
      '_' + bizName + '_';

  } else if (isOverdueFlag) {
    // --- CASE 2: Overdue ---
    var penaltyNote = '';
    if (window.appSettings && window.appSettings.penaltyPct) {
      penaltyNote = E.fire + ' Penalty charges are being applied for *' + overdueDays + ' late day(s).*\n';
    }
    message =
      E.warn + ' *OVERDUE ALERT*\n' +
      E.line + '\n\n' +
      E.pray + ' Hello *' + customerName + ' ji!*\n\n' +
      'Your bartan return was due on:\n' +
      E.cal + ' *' + returnFormatted + '*\n\n' +
      E.fire + ' You are now *' + overdueDays + ' day(s) late.*\n' +
      penaltyNote + '\n' +
      'Please return the bartan *IMMEDIATELY* to avoid further charges.\n\n' +
      E.phone + ' Contact us to settle the dues.\n' +
      E.line + '\n' +
      footer + '\n' +
      '_' + bizName + '_';

  } else {
    // --- CASE 3: Due today ---
    message =
      E.bell + ' *Bartan Return Reminder*\n' +
      E.line + '\n\n' +
      E.pray + ' Hello *' + customerName + ' ji!*\n\n' +
      'Your bartan return date is *today:*\n' +
      E.cal + ' *' + returnFormatted + '*\n\n' +
      E.check + ' Please return the bartan on time.\n' +
      E.warn  + ' Late returns will attract *penalty charges.*\n\n' +
      E.line + '\n' +
      footer + '\n' +
      '_' + bizName + '_';
  }

  openWhatsApp(mobile, message);
}

// ============================================
// 3. RETURN CONFIRM — After bartan returned
// ============================================
function sendReturnConfirmWhatsApp(booking) {
  var mobile = booking.mobile;
  if (!mobile) { showToast('\u26A0\uFE0F No mobile number!'); return; }

  var returnTime     = booking.returnedAt ? new Date(booking.returnedAt) : new Date();
  var returnedAtFmt  = returnTime.toLocaleString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  var bookingDateFmt = new Date(booking.bookingDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  var bartanList = '';
  (booking.items || []).forEach(function(item) {
    if (item.nag > 0) {
      bartanList += '  \u2022 ' + item.name + ': ' + item.nag + ' pcs\n';
    }
  });

  var totalPaid  = (booking.totalAmount || 0) - (booking.pendingAmount || 0);
  var pendingAmt = booking.pendingAmount || 0;

  // Penalty details
  var penaltyStr = '';
  if ((booking.penalty || 0) > 0) {
    penaltyStr = E.warn + ' *Penalty Charges:*\n';
    if (booking.penaltyDetails && booking.penaltyDetails.length > 0) {
      booking.penaltyDetails.forEach(function(p) {
        var type = p.type === 'damaged' ? 'Damaged' : 'Missing';
        penaltyStr += '  \u2022 ' + p.itemName + ' (' + type + '): \u20B9' + (p.amount || 0).toLocaleString('en-IN') + '\n';
      });
    }
    if ((booking.overduePenalty || 0) > 0) {
      penaltyStr += '  \u2022 Late Return Penalty (' + (booking.overdueDays || 0) + ' days): \u20B9' + booking.overduePenalty.toLocaleString('en-IN') + '\n';
    }
    penaltyStr += '  *Total Penalty: \u20B9' + (booking.penalty || 0).toLocaleString('en-IN') + '*\n' + E.line + '\n';
  }

  var paymentStatus = pendingAmt > 0
    ? E.warn + ' *Balance Due: \u20B9' + pendingAmt.toLocaleString('en-IN') + '*\nKindly clear dues at earliest.\n\n'
    : E.check + ' *All payments cleared!* ' + E.party + '\n\n';

  var message =
    E.pray + ' *Hello ' + booking.customerName + ' ji!*\n' +
    '_' + getBizName() + '_\n' +
    E.line + '\n\n' +
    E.check + ' *Your Bartan has been Returned Successfully!*\n\n' +
    E.receipt + ' *Receipt No:* '   + booking.receiptNo   + '\n' +
    E.cal    + ' *Booked On:* '     + bookingDateFmt      + '\n' +
    E.clock  + ' *Returned On:* '   + returnedAtFmt       + '\n' +
    '         Total Days Used: *'   + booking.totalDays + ' days*\n\n' +
    E.line + '\n' +
    E.bucket + ' *Items Returned:*\n' +
    bartanList +
    E.line + '\n' +
    penaltyStr +
    E.money  + ' *Total Bill:* \u20B9' + (booking.totalAmount || 0).toLocaleString('en-IN') + '\n' +
    E.check  + ' *Paid:* \u20B9' + totalPaid.toLocaleString('en-IN') + '\n' +
    paymentStatus +
    getWaFooter() + '\n' +
    '_' + getBizName() + '_';

  openWhatsApp(mobile, message);
}

// ============================================
// Helper — Open WhatsApp
// ============================================
function openWhatsApp(mobile, message) {
  var encoded = encodeURIComponent(message);
  var url     = 'https://wa.me/91' + mobile + '?text=' + encoded;
  window.open(url, '_blank');
}

// ============================================
// 4. DUE DATE AUTO CHECK — On App Open
// ============================================
async function checkDueDateAlerts(forceShow) {
  var bookings       = await BartanDB.getAll(BartanDB.STORES.BOOKINGS);
  var activeBookings = bookings.filter(function(b) { return b.status === 'active'; });
  var todayStr       = new Date().toISOString().split('T')[0];

  var dueToday = activeBookings.filter(function(b) {
    var retStr = (b.returnDate || '').split('T')[0];
    return retStr === todayStr && b.mobile;
  });

  var overdue = activeBookings.filter(function(b) {
    var retStr = (b.returnDate || '').split('T')[0];
    return retStr < todayStr && b.mobile;
  });

  if (dueToday.length === 0 && overdue.length === 0) {
    if (forceShow) showToast('\u2705 No overdue bookings!');
    return;
  }
  showDueAlertBanner(dueToday, overdue);
}

function showDueAlertBanner(dueToday, overdue) {
  var old = document.getElementById('due-alert-banner');
  if (old) old.remove();

  var banner = document.createElement('div');
  banner.id        = 'due-alert-banner';
  banner.className = 'due-alert-overlay';

  var content = '';

  if (overdue.length > 0) {
    content += '<div class="due-alert-section overdue-section">' +
      '<div class="due-alert-icon">' + E.warn + '</div>' +
      '<div class="due-alert-title">' + overdue.length + ' Booking(s) Are OVERDUE!</div>' +
      '<div class="due-alert-list">';
    overdue.forEach(function(b) {
      var todayStr = new Date().toISOString().split('T')[0];
      var retStr   = (b.returnDate || '').split('T')[0];
      var days     = Math.max(0, Math.floor((new Date(todayStr) - new Date(retStr)) / (1000*60*60*24)));
      var safeName = (b.customerName || '').replace(/'/g, "\\'");
      content += '<div class="due-alert-item">' +
        '<span class="due-name">' + b.customerName + ' <small style="color:var(--danger);">(' + days + 'd late)</small></span>' +
        '<button class="btn-wa-small" onclick="sendWhatsAppReminder(\'' + b.mobile + '\',\'' + safeName + '\',\'' + b.returnDate + '\')">' +
        E.phone + ' Remind</button>' +
        '</div>';
    });
    content += '</div></div>';
  }

  if (dueToday.length > 0) {
    content += '<div class="due-alert-section due-section">' +
      '<div class="due-alert-icon">' + E.cal + '</div>' +
      '<div class="due-alert-title">' + dueToday.length + ' Booking(s) Due Today!</div>' +
      '<div class="due-alert-list">';
    dueToday.forEach(function(b) {
      var safeName = (b.customerName || '').replace(/'/g, "\\'");
      content += '<div class="due-alert-item">' +
        '<span class="due-name">' + b.customerName + '</span>' +
        '<button class="btn-wa-small" onclick="sendWhatsAppReminder(\'' + b.mobile + '\',\'' + safeName + '\',\'' + b.returnDate + '\')">' +
        E.phone + ' Remind</button>' +
        '</div>';
    });
    content += '</div></div>';
  }

  banner.innerHTML =
    '<div class="due-alert-sheet">' +
      '<div class="due-alert-header">' +
        '<span>' + E.bell + ' Today\'s Alerts</span>' +
        '<button class="due-alert-close" onclick="document.getElementById(\'due-alert-banner\').remove()">\u2715</button>' +
      '</div>' +
      content +
      '<button class="btn btn-outline due-alert-dismiss" onclick="document.getElementById(\'due-alert-banner\').remove()">' +
        'OK, Got it' +
      '</button>' +
    '</div>';

  document.body.appendChild(banner);
}