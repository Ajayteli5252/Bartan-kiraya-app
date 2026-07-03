// ============================================
// app.js — Main App Logic & Navigation
// ============================================

// ============================================
// Page Config
// ============================================
const PAGE_CONFIG = {
  'dashboard':        { title: '🏠 Dashboard',        nav: 'nav-dashboard',  fab: true  },
  'bookings':         { title: '📋 Bookings',          nav: 'nav-bookings',   fab: true  },
  'new-booking':      { title: '➕ Naya Booking',      nav: null,             fab: false },
  'booking-detail':   { title: '📄 Booking Detail',   nav: null,             fab: false },
  'inventory':        { title: '🪣 Bartan Stock',      nav: 'nav-inventory',  fab: false },
  'customers':        { title: '👥 Customers',         nav: 'nav-customers',  fab: false },
  'customer-detail':  { title: '👤 Customer Detail',  nav: null,             fab: false },
  'report':           { title: '📊 Report',            nav: 'nav-report',     fab: false },
};

let currentPage = 'dashboard';

// ============================================
// Navigate Between Pages
// ============================================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  const config = PAGE_CONFIG[page];
  if (config) {
    document.getElementById('pageTitle').textContent = config.title;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (config.nav) {
      const navEl = document.getElementById(config.nav);
      if (navEl) navEl.classList.add('active');
    }

    document.getElementById('fabBtn').style.display = config.fab ? 'flex' : 'none';
  }

  currentPage = page;
  onPageLoad(page);
}

// ============================================
// On Page Load — Fetch & Render Data
// ============================================
async function onPageLoad(page) {
  switch (page) {
    case 'dashboard':    await loadDashboard();       break;
    case 'bookings':     await loadBookingsList();    break;
    case 'new-booking':  await loadNewBookingForm();  break;
    case 'inventory':    await loadInventoryPage();   break;
    case 'customers':    await loadCustomersPage();   break;
    case 'report':       await loadReportPage();      break;
  }
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  const [bookings, payments, customers] = await Promise.all([
    BartanDB.getAll(BartanDB.STORES.BOOKINGS),
    BartanDB.getAll(BartanDB.STORES.PAYMENTS),
    BartanDB.getAll(BartanDB.STORES.CUSTOMERS),
  ]);

  const activeBookings = bookings.filter(b => b.status === 'active');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalPending = bookings.reduce((sum, b) => sum + (b.pendingAmount || 0), 0);

  const monthIncome = payments
    .filter(p => new Date(p.paymentDate) >= monthStart)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  document.getElementById('stat-active').textContent = activeBookings.length;
  document.getElementById('stat-pending').textContent = formatCurrency(totalPending);
  document.getElementById('stat-month').textContent = formatCurrency(monthIncome);
  document.getElementById('stat-customers').textContent = customers.length;

  // Overdue count badge on header
  const overdueCount = activeBookings.filter(b => isOverdue(b)).length;
  const headerBtn = document.getElementById('headerActionBtn');
  if (overdueCount > 0) {
    headerBtn.innerHTML = `⚠️<span class="header-badge">${overdueCount}</span>`;
    headerBtn.title = `${overdueCount} overdue booking(s)`;
  } else {
    headerBtn.innerHTML = '＋';
    headerBtn.title = 'Naya Booking';
  }

  // Active bookings list (max 5)
  const container = document.getElementById('dashboard-bookings');
  if (activeBookings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>Koi active booking nahi hai</p>
        <button class="btn btn-primary btn-sm" onclick="navigateTo('new-booking')">+ Naya Booking</button>
      </div>`;
  } else {
    const recent = [...activeBookings].sort((a,b) => b.id - a.id).slice(0, 5);
    container.innerHTML = await buildBookingCards(recent);
  }

  // Due today + overdue
  const todayStr = toDateStr(now);
  const dueToday = activeBookings.filter(b => {
    const retStr = b.returnDate?.split('T')[0] || b.returnDate;
    return retStr === todayStr;
  });
  const overdueBookings = activeBookings.filter(b => isOverdue(b));

  const dueContainer = document.getElementById('dashboard-due');
  if (dueToday.length === 0 && overdueBookings.length === 0) {
    dueContainer.innerHTML = `<p style="font-size:0.85rem; color:var(--text-hint); padding:8px 0;">Aaj koi return due nahi hai ✅</p>`;
  } else {
    const combined = [...new Map([...overdueBookings, ...dueToday].map(b => [b.id, b])).values()];
    dueContainer.innerHTML = await buildBookingCards(combined);
  }
}

// ============================================
// BOOKINGS LIST
// ============================================
let allBookingsCache = [];
let currentFilter = 'all';

async function loadBookingsList() {
  allBookingsCache = await BartanDB.getAll(BartanDB.STORES.BOOKINGS);
  allBookingsCache.reverse();
  renderBookingsList(allBookingsCache);
}

function renderBookingsList(bookings) {
  const container = document.getElementById('bookings-list');
  if (bookings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Koi booking nahi mili</p>
        <button class="btn btn-primary btn-sm" onclick="navigateTo('new-booking')">+ Naya Booking</button>
      </div>`;
    return;
  }
  buildBookingCards(bookings).then(html => container.innerHTML = html);
}

async function buildBookingCards(bookings) {
  let html = '';
  for (const b of bookings) {
    const customer = b.customerId ? await BartanDB.get(BartanDB.STORES.CUSTOMERS, b.customerId) : null;
    const name = customer?.name || b.customerName || 'Unknown';
    const overdue = isOverdue(b);
    const overdueDays = getOverdueDays(b);

    let badge = '';
    if (overdue) {
      badge = `<span class="badge badge-overdue">⚠️ ${overdueDays} din late</span>`;
    } else if (b.status === 'active') {
      badge = '<span class="badge badge-active">Active</span>';
    } else {
      badge = '<span class="badge badge-returned">Returned ✅</span>';
    }

    const pendingBadge = b.pendingAmount > 0
      ? `<span class="b-pending">Baaki: ${formatCurrency(b.pendingAmount)}</span>`
      : `<span style="font-size:0.75rem;color:var(--success);font-weight:600;">✅ Paid</span>`;

    const itemSummary = formatItemsSummary(b.items || []);

    html += `
      <div class="booking-item ${overdue ? 'overdue-item' : ''}" onclick="openBookingDetail(${b.id})">
        <div class="b-top">
          <span class="b-name">${name}</span>
          ${badge}
        </div>
        ${itemSummary ? `<div class="b-info" style="font-size:0.75rem;color:var(--text-hint);margin-bottom:4px;">🪣 ${itemSummary}</div>` : ''}
        <div class="b-info">
          📅 ${formatDate(b.bookingDate)} → ${formatDate(b.returnDate)} &nbsp;|&nbsp; ${b.totalDays || 0} din
        </div>
        <div class="b-bottom">
          <span class="b-amount">${formatCurrency(b.totalAmount || 0)}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            ${pendingBadge}
            <span class="b-receipt">${b.receiptNo || ''}</span>
          </div>
        </div>
      </div>`;
  }
  return html;
}

function searchBookings(query) {
  const q = query.toLowerCase();
  const filtered = allBookingsCache.filter(b =>
    (b.customerName || '').toLowerCase().includes(q) ||
    (b.receiptNo || '').toLowerCase().includes(q) ||
    (b.mobile || '').includes(q)
  );
  renderBookingsList(filtered);
}

function filterBookings(type, btn) {
  currentFilter = type;

  // Update button styles
  document.querySelectorAll('#page-bookings .filter-btn').forEach(b => {
    b.className = 'btn btn-outline btn-sm filter-btn';
  });
  if (btn) btn.className = 'btn btn-primary btn-sm filter-btn';

  let filtered = allBookingsCache;
  if (type === 'active')   filtered = allBookingsCache.filter(b => b.status === 'active' && !isOverdue(b));
  if (type === 'overdue')  filtered = allBookingsCache.filter(b => isOverdue(b));
  if (type === 'returned') filtered = allBookingsCache.filter(b => b.status === 'returned');
  if (type === 'pending')  filtered = allBookingsCache.filter(b => b.pendingAmount > 0);
  renderBookingsList(filtered);
}

// ============================================
// BOOKING DETAIL
// ============================================
async function openBookingDetail(bookingId) {
  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  if (!booking) { showToast('⚠️ Booking nahi mili!'); return; }

  // Global mein store karo taaki WhatsApp button use kar sake
  window.currentBooking = booking;

  const customer = booking.customerId
    ? await BartanDB.get(BartanDB.STORES.CUSTOMERS, booking.customerId)
    : null;
  const payments = await BartanDB.getByIndex(BartanDB.STORES.PAYMENTS, 'bookingId', bookingId);

  const overdue = isOverdue(booking);
  const overdueDays = getOverdueDays(booking);

  let statusBadge = '';
  if (overdue) {
    statusBadge = `<span class="badge badge-overdue">⚠️ ${overdueDays} din late</span>`;
  } else if (booking.status === 'active') {
    statusBadge = '<span class="badge badge-active">Active</span>';
  } else {
    statusBadge = '<span class="badge badge-returned">Returned ✅</span>';
  }

  // Build bartan rows
  let bartanRows = '';
  for (const item of (booking.items || [])) {
    if (item.nag > 0) {
      bartanRows += `
        <tr>
          <td>${item.name}</td>
          <td>${item.nag}</td>
          <td>₹${item.ratePerDay}/din</td>
          <td>${booking.totalDays} din</td>
          <td class="row-total">₹${item.rakam}</td>
        </tr>`;
    }
  }

  // Payment history
  let paymentRows = payments.map(p => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:0.85rem;">${formatDateTime(p.paymentDate)} &nbsp;|&nbsp; ${p.mode === 'upi' ? '📱 UPI' : '💵 Cash'}</span>
      <span style="font-weight:700;color:var(--success);">+${formatCurrency(p.amount)}</span>
    </div>`).join('');

  const mobile = customer?.mobile || booking.mobile || '';
  const paidAmount = (booking.totalAmount || 0) - (booking.pendingAmount || 0);

  document.getElementById('booking-detail-content').innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;">${customer?.name || booking.customerName}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);">Pita: ${customer?.fatherName || booking.fatherName || '-'}</div>
          ${mobile ? `<div style="font-size:0.82rem;color:var(--text-secondary);">📞 ${mobile}</div>` : ''}
        </div>
        ${statusBadge}
      </div>
      <div class="divider"></div>
      <div style="font-size:0.82rem;color:var(--text-secondary);">
        Receipt: <b>${booking.receiptNo}</b> &nbsp;|&nbsp;
        Booking: <b>${formatDateTime(booking.bookingDate)}</b><br/>
        Wapsi: <b>${formatDate(booking.returnDate)}</b> &nbsp;|&nbsp;
        Kul Din: <b>${booking.totalDays} din</b>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Bartan List</div>
      <div style="overflow-x:auto;">
        <table class="bartan-table">
          <thead>
            <tr><th>Bartan</th><th>Nag</th><th>Dar</th><th>Din</th><th>Rakam</th></tr>
          </thead>
          <tbody>${bartanRows || '<tr><td colspan="5" style="text-align:center;color:var(--text-hint);">Koi bartan nahi</td></tr>'}</tbody>
        </table>
      </div>
      <div class="total-row">
        <span class="total-label">Total Rakam</span>
        <span class="total-value">${formatCurrency(booking.totalAmount)}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Payment Details</div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="font-size:0.85rem;color:var(--text-secondary);">Total Amount</span>
        <span style="font-weight:700;">${formatCurrency(booking.totalAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="font-size:0.85rem;color:var(--text-secondary);">Paid</span>
        <span style="font-weight:700;color:var(--success);">${formatCurrency(paidAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);margin-top:4px;">
        <span style="font-size:0.9rem;font-weight:700;">Baaki (Pending)</span>
        <span style="font-weight:800;color:${booking.pendingAmount > 0 ? 'var(--danger)' : 'var(--success)'};">
          ${booking.pendingAmount > 0 ? formatCurrency(booking.pendingAmount) : '✅ Paid'}
        </span>
      </div>
      ${paymentRows ? `<div class="divider"></div><div class="card-title">Payment History</div>${paymentRows}` : ''}
    </div>

    ${booking.notes ? `<div class="card"><div class="card-title">Notes</div><p style="font-size:0.88rem;">${booking.notes}</p></div>` : ''}

    ${booking.status === 'returned' && (booking.penalty || 0) > 0 ? `
    <div class="card penalty-detail-card">
      <div class="card-title" style="color:var(--danger);">&#9888;&#65039; Penalty Details</div>
      ${(booking.penaltyDetails || []).map(p => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
          <div>
            <span style="font-size:0.85rem;font-weight:600;">${p.itemName}</span>
            <span class="penalty-type-badge penalty-${p.type}">${p.type === 'damaged' ? 'Damaged' : 'Missing'}</span>
          </div>
          <span style="font-weight:700;color:var(--danger);">&#8377;${(p.amount||0).toLocaleString('en-IN')}</span>
        </div>`).join('')}
      ${(booking.overduePenalty || 0) > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
          <div>
            <span style="font-size:0.85rem;font-weight:600;">Overdue Penalty</span>
            <span class="penalty-type-badge penalty-overdue">${booking.overdueDays || 0} din late</span>
          </div>
          <span style="font-weight:700;color:var(--danger);">&#8377;${(booking.overduePenalty||0).toLocaleString('en-IN')}</span>
        </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:4px;">
        <span style="font-weight:700;">Total Penalty</span>
        <span style="font-size:1.1rem;font-weight:800;color:var(--danger);">&#8377;${(booking.penalty||0).toLocaleString('en-IN')}</span>
      </div>
    </div>` : ''}

    <div class="btn-row">
      ${mobile ? `<button class="btn btn-whatsapp" onclick="sendCurrentBookingWhatsApp()">📲 WhatsApp</button>` : ''}
      ${booking.pendingAmount > 0 ? `<button class="btn btn-success" onclick="openPaymentModal(${bookingId})">💰 Payment Add</button>` : ''}
    </div>
    <div class="btn-row" style="margin-top:10px;">
      ${booking.status === 'active' ? `<button class="btn btn-primary" onclick="openReturnModal(${bookingId})">&#9989; Mark Returned</button>` : ''}
      <button class="btn btn-outline" onclick="navigateTo('bookings')" style="margin-top:0;">← Back</button>
    </div>
    <div class="btn-row" style="margin-top:10px;">
      <button class="btn btn-danger btn-sm" onclick="confirmDeleteBooking(${bookingId})" style="width:auto;">🗑️ Delete Booking</button>
    </div>
    <div style="height:16px;"></div>
  `;

  navigateTo('booking-detail');
}

// ============================================
// RETURN MODAL — Item checklist + Penalty system
// ============================================
async function openReturnModal(bookingId) {
  const existing = document.getElementById('return-modal');
  if (existing) existing.remove();

  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  if (!booking) return;

  const overdue = isOverdue(booking);
  const overdueDays = getOverdueDays(booking);
  const items = (booking.items || []).filter(i => i.nag > 0);

  // Item rows build karo
  let itemRows = '';
  items.forEach((item, idx) => {
    const itemValue = item.rakam || (item.nag * item.ratePerDay * booking.totalDays);
    itemRows += `
      <div class="ret-item-row" id="ret-row-${idx}">
        <div class="ret-item-info">
          <div class="ret-item-name">${item.name}</div>
          <div class="ret-item-qty">${item.nag} nag &nbsp;|&nbsp; ₹${item.ratePerDay}/din &nbsp;|&nbsp; Total: ₹${itemValue}</div>
        </div>
        <div class="ret-item-controls">
          <select class="ret-status-select" id="ret-status-${idx}" onchange="togglePenaltyInput(${idx})">
            <option value="ok">✅ Sab Theek</option>
            <option value="damaged">🔨 Damaged</option>
            <option value="missing">❌ Missing</option>
          </select>
          <div class="ret-penalty-box" id="ret-penalty-box-${idx}" style="display:none;">
            <label style="font-size:0.75rem;color:var(--danger);font-weight:600;">Penalty (₹)</label>
            <input type="number" class="form-control ret-penalty-input" id="ret-penalty-${idx}"
              placeholder="0" min="0" oninput="updateReturnTotal()" />
          </div>
        </div>
      </div>`;
  });

  // Overdue section
  let overdueSection = '';
  if (overdue) {
    // Calculate suggested overdue penalty
    const dailyTotal = items.reduce((s, i) => s + (i.nag * i.ratePerDay), 0);
    const suggested = dailyTotal * overdueDays;
    overdueSection = `
      <div class="ret-overdue-section">
        <div class="ret-overdue-header">
          <span>⚠️ Overdue Alert</span>
          <span class="overdue-days-badge">${overdueDays} din late</span>
        </div>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:10px;">
          Wapsi date thi <b>${formatDate(booking.returnDate)}</b> — customer ne late return kiya hai.
        </div>
        <div class="ret-overdue-suggest">
          Suggested Penalty (${overdueDays} din × ₹${dailyTotal}/din) = <b>₹${suggested}</b>
        </div>
        <div class="form-group" style="margin-top:10px;margin-bottom:0;">
          <label class="form-label" style="color:var(--danger);">Overdue Penalty Amount (₹) — Admin Decide Kare</label>
          <input type="number" class="form-control" id="ret-overdue-penalty"
            value="${suggested}" min="0" oninput="updateReturnTotal()" />
        </div>
      </div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'return-modal';
  overlay.innerHTML = `
    <div class="modal-sheet return-modal-sheet">
      <div class="modal-handle"></div>
      <div class="return-modal-header">
        <div class="return-modal-title">✅ Bartan Return Karein</div>
        <div class="return-modal-sub">${booking.customerName} &nbsp;|&nbsp; ${booking.receiptNo}</div>
      </div>

      <div class="ret-section-label">🪣 Item Checklist — Sab check karo</div>
      <div id="ret-items-list">${itemRows}</div>

      ${overdueSection}

      <div class="ret-total-bar">
        <span>Kul Penalty</span>
        <span class="ret-total-val" id="ret-grand-penalty">₹0</span>
      </div>

      <div style="font-size:0.78rem;color:var(--text-hint);padding:0 4px 12px;">
        💡 Penalty automatically customer ke pending bill mein add ho jaayegi.
      </div>

      <div class="btn-row">
        <button class="btn btn-outline" onclick="closeReturnModal()">Cancel</button>
        <button class="btn btn-primary" onclick="confirmReturnWithPenalty(${bookingId})">✅ Confirm Return</button>
      </div>
      <div style="height:8px;"></div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeReturnModal(); });
  document.body.appendChild(overlay);
  updateReturnTotal();
}

function closeReturnModal() {
  const m = document.getElementById('return-modal');
  if (m) m.remove();
}

function togglePenaltyInput(idx) {
  const status = document.getElementById('ret-status-' + idx)?.value;
  const box = document.getElementById('ret-penalty-box-' + idx);
  if (box) box.style.display = (status !== 'ok') ? 'block' : 'none';
  if (status === 'ok') {
    const inp = document.getElementById('ret-penalty-' + idx);
    if (inp) inp.value = '';
  }
  updateReturnTotal();
}

function updateReturnTotal() {
  let total = 0;
  // Item penalties
  document.querySelectorAll('.ret-penalty-input').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  // Overdue penalty
  const op = document.getElementById('ret-overdue-penalty');
  if (op) total += parseFloat(op.value) || 0;

  const el = document.getElementById('ret-grand-penalty');
  if (el) el.textContent = '\u20B9' + total.toLocaleString('en-IN');
}

async function confirmReturnWithPenalty(bookingId) {
  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  const items = (booking.items || []).filter(i => i.nag > 0);

  // Collect item penalties
  const penaltyDetails = [];
  items.forEach((item, idx) => {
    const status = document.getElementById('ret-status-' + idx)?.value || 'ok';
    const penalty = parseFloat(document.getElementById('ret-penalty-' + idx)?.value) || 0;
    if (status !== 'ok') {
      penaltyDetails.push({ itemName: item.name, type: status, amount: penalty });
    }
  });

  const overduePenalty = parseFloat(document.getElementById('ret-overdue-penalty')?.value) || 0;
  const overdueDays = getOverdueDays(booking);
  const totalPenalty = penaltyDetails.reduce((s, p) => s + p.amount, 0) + overduePenalty;

  // Mark as returned
  booking.status = 'returned';
  booking.returnedAt = new Date().toISOString();
  booking.penalty = totalPenalty;
  booking.penaltyDetails = penaltyDetails;
  booking.overduePenalty = overduePenalty;
  booking.overdueDays = overdueDays;

  // Add penalty to pending amount
  if (totalPenalty > 0) {
    booking.pendingAmount = (booking.pendingAmount || 0) + totalPenalty;
    booking.totalAmount = (booking.totalAmount || 0) + totalPenalty;
  }

  // Restore inventory
  for (const item of (booking.items || [])) {
    if (item.nag > 0 && item.inventoryId) {
      const inv = await BartanDB.get(BartanDB.STORES.INVENTORY, item.inventoryId);
      if (inv) {
        inv.availableStock = (inv.availableStock || 0) + item.nag;
        await BartanDB.put(BartanDB.STORES.INVENTORY, inv);
      }
    }
  }

  await BartanDB.put(BartanDB.STORES.BOOKINGS, booking);
  closeReturnModal();

  const penaltyMsg = totalPenalty > 0
    ? ` Penalty: \u20B9${totalPenalty} add ki gayi!`
    : '';
  showToast('\u2705 Bartan returned!' + penaltyMsg);
  openBookingDetail(bookingId);
}

// Confirm delete booking
function confirmDeleteBooking(bookingId) {
  showConfirmModal(
    '🗑️ Delete Booking',
    'Kya aap sure hain? Yeh booking permanently delete ho jaayegi!',
    async () => {
      await deleteBooking(bookingId);
      navigateTo('bookings');
    },
    true
  );
}

// ============================================
// PAYMENT MODAL (Proper — no ugly prompt())
// ============================================
function openPaymentModal(bookingId) {
  // Remove existing modal if any
  const existing = document.getElementById('payment-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'payment-modal';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">💰 Payment Record Karein</div>

      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <input type="number" class="form-control" id="pay-amount"
          placeholder="Kitna payment aaya?" min="1" inputmode="numeric" />
      </div>

      <div class="form-group">
        <label class="form-label">Payment Mode</label>
        <div style="display:flex;gap:10px;">
          <label class="pay-mode-label active" id="mode-cash-label">
            <input type="radio" name="pay-mode-modal" value="cash" id="mode-cash" checked onchange="updateModeLabel()" />
            💵 Cash
          </label>
          <label class="pay-mode-label" id="mode-upi-label">
            <input type="radio" name="pay-mode-modal" value="upi" id="mode-upi" onchange="updateModeLabel()" />
            📱 UPI
          </label>
        </div>
      </div>

      <div class="btn-row">
        <button class="btn btn-outline" onclick="closePaymentModal()">Cancel</button>
        <button class="btn btn-success" onclick="savePayment(${bookingId})">💾 Save Payment</button>
      </div>
    </div>`;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePaymentModal();
  });

  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('pay-amount')?.focus(), 300);
}

function updateModeLabel() {
  const cashLabel = document.getElementById('mode-cash-label');
  const upiLabel = document.getElementById('mode-upi-label');
  if (document.getElementById('mode-cash')?.checked) {
    cashLabel.classList.add('active');
    upiLabel.classList.remove('active');
  } else {
    upiLabel.classList.add('active');
    cashLabel.classList.remove('active');
  }
}

function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.remove();
}

async function savePayment(bookingId) {
  const amountInput = document.getElementById('pay-amount');
  const amount = parseFloat(amountInput?.value) || 0;
  const mode = document.querySelector('input[name="pay-mode-modal"]:checked')?.value || 'cash';

  if (amount <= 0) {
    showToast('⚠️ Sahi amount dalein!');
    return;
  }

  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  const paid = Math.min(amount, booking.pendingAmount);

  await BartanDB.add(BartanDB.STORES.PAYMENTS, {
    bookingId,
    amount: paid,
    mode,
    paymentDate: new Date().toISOString(),
  });

  booking.pendingAmount = Math.max(0, booking.pendingAmount - paid);
  await BartanDB.put(BartanDB.STORES.BOOKINGS, booking);

  closePaymentModal();
  showToast(`✅ ${formatCurrency(paid)} payment record ho gaya!`);
  openBookingDetail(bookingId);
}

// ============================================
// CONFIRM MODAL (Generic)
// ============================================
function showConfirmModal(title, message, onConfirm, isDanger = false) {
  const existing = document.getElementById('confirm-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'confirm-modal';
  overlay.innerHTML = `
    <div class="modal-sheet" style="max-height:60vh;">
      <div class="modal-handle"></div>
      <div class="modal-title">${title}</div>
      <p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:20px;">${message}</p>
      <div class="btn-row">
        <button class="btn btn-outline" onclick="closeConfirmModal()">Cancel</button>
        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok-btn">Haan, Sure!</button>
      </div>
    </div>`;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeConfirmModal();
  });

  document.body.appendChild(overlay);

  document.getElementById('confirm-ok-btn').addEventListener('click', () => {
    closeConfirmModal();
    onConfirm();
  });
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.remove();
}

// ============================================
// NEW BOOKING FORM
// ============================================
async function loadNewBookingForm() {
  const now = new Date();
  document.getElementById('nb-booking-dt').value = toLocalDateTimeStr(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('nb-return-dt').value = toDateStr(tomorrow);

  ['nb-mobile','nb-name','nb-father','nb-advance','nb-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('nb-pay-mode').value = 'cash';

  await loadBartanTable();
  updateDays();
  updateTotal();
}

async function loadBartanTable() {
  const inventory = await BartanDB.getAll(BartanDB.STORES.INVENTORY);
  const tbody = document.getElementById('nb-bartan-rows');
  tbody.innerHTML = inventory.map(item => {
    const stockAvail = item.availableStock || 0;
    const stockColor = stockAvail === 0 ? 'var(--danger)' : stockAvail < 5 ? 'var(--warning)' : 'var(--text-hint)';
    return `
    <tr id="row-${item.id}">
      <td style="font-size:0.8rem;font-weight:600;">${item.name}
        <div style="font-size:0.68rem;color:${stockColor};">Avail: ${stockAvail}</div>
      </td>
      <td>
        <input type="number" min="0" max="${stockAvail}"
          id="nag-${item.id}" placeholder="0"
          oninput="updateRowTotal(${item.id}, ${item.ratePerDay})"
          style="width:52px;" inputmode="numeric" />
      </td>
      <td style="font-size:0.8rem;">₹${item.ratePerDay}/din</td>
      <td class="row-total" id="rakam-${item.id}">₹0</td>
    </tr>`;
  }).join('');
}

function updateDays() {
  const bookingDt = document.getElementById('nb-booking-dt').value;
  const returnDt  = document.getElementById('nb-return-dt').value;
  if (!bookingDt || !returnDt) return;

  const diff = Math.ceil(
    (new Date(returnDt) - new Date(bookingDt)) / (1000 * 60 * 60 * 24)
  );
  const days = Math.max(1, diff);
  document.getElementById('nb-days').textContent = `${days} din`;
  updateTotal();
}

function updateRowTotal(invId, ratePerDay) {
  const nagInput = document.getElementById(`nag-${invId}`);
  const nag = parseInt(nagInput.value) || 0;
  const days = getTotalDays();
  const rakam = nag * ratePerDay * days;
  document.getElementById(`rakam-${invId}`).textContent = `₹${rakam}`;
  updateTotal();
}

function getTotalDays() {
  const bookingDt = document.getElementById('nb-booking-dt').value;
  const returnDt  = document.getElementById('nb-return-dt').value;
  if (!bookingDt || !returnDt) return 1;
  const diff = Math.ceil((new Date(returnDt) - new Date(bookingDt)) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function updateTotal() {
  const rows = document.querySelectorAll('[id^="rakam-"]');
  let total = 0;
  rows.forEach(r => {
    total += parseInt(r.textContent.replace('₹','')) || 0;
  });
  document.getElementById('nb-total').textContent = `₹${total}`;
  updatePending();
}

function updatePending() {
  const total   = parseInt(document.getElementById('nb-total').textContent.replace('₹','')) || 0;
  const advance = parseInt(document.getElementById('nb-advance').value) || 0;
  const pending = Math.max(0, total - advance);
  document.getElementById('nb-pending').textContent = `₹${pending}`;
}

async function autofillCustomer(mobile) {
  if (mobile.length !== 10) return;
  try {
    const results = await BartanDB.getByIndex(BartanDB.STORES.CUSTOMERS, 'mobile', mobile);
    if (results.length > 0) {
      const c = results[0];
      document.getElementById('nb-name').value   = c.name || '';
      document.getElementById('nb-father').value = c.fatherName || '';
      showToast('✅ Customer mil gaya — details fill ho gayi!');
    }
  } catch(e) {}
}

async function saveBooking() {
  const mobile  = document.getElementById('nb-mobile').value.trim();
  const name    = document.getElementById('nb-name').value.trim();
  const father  = document.getElementById('nb-father').value.trim();
  const bookDt  = document.getElementById('nb-booking-dt').value;
  const retDt   = document.getElementById('nb-return-dt').value;
  const advance = parseInt(document.getElementById('nb-advance').value) || 0;
  const payMode = document.getElementById('nb-pay-mode').value;
  const notes   = document.getElementById('nb-notes').value.trim();

  if (!name || !bookDt || !retDt) {
    showToast('⚠️ Naam aur dates zaroori hain!'); return;
  }

  if (mobile && mobile.length !== 10) {
    showToast('⚠️ Mobile number 10 digit ka hona chahiye!'); return;
  }

  const days = getTotalDays();
  const inventory = await BartanDB.getAll(BartanDB.STORES.INVENTORY);

  const items = [];
  let totalAmount = 0;
  for (const inv of inventory) {
    const nag = parseInt(document.getElementById(`nag-${inv.id}`)?.value) || 0;
    if (nag > 0) {
      if (nag > (inv.availableStock || 0)) {
        showToast(`⚠️ ${inv.name} ka stock kam hai! (Available: ${inv.availableStock})`);
        return;
      }
      const rakam = nag * inv.ratePerDay * days;
      items.push({ inventoryId: inv.id, name: inv.name, nag, ratePerDay: inv.ratePerDay, rakam });
      totalAmount += rakam;

      inv.availableStock = Math.max(0, (inv.availableStock || 0) - nag);
      await BartanDB.put(BartanDB.STORES.INVENTORY, inv);
    }
  }

  if (items.length === 0) {
    showToast('⚠️ Kam se kam ek bartan select karein!'); return;
  }

  // Save or update customer
  let customerId = null;
  try {
    if (mobile) {
      const existing = await BartanDB.getByIndex(BartanDB.STORES.CUSTOMERS, 'mobile', mobile);
      if (existing.length > 0) {
        customerId = existing[0].id;
        // Update name if changed
        const cust = existing[0];
        if (cust.name !== name || cust.fatherName !== father) {
          cust.name = name;
          cust.fatherName = father;
          await BartanDB.put(BartanDB.STORES.CUSTOMERS, cust);
        }
      } else {
        customerId = await BartanDB.add(BartanDB.STORES.CUSTOMERS, { name, fatherName: father, mobile });
      }
    }
  } catch(e) {}

  const receiptNo = await BartanDB.generateReceiptNo();
  const pendingAmount = Math.max(0, totalAmount - advance);

  const bookingId = await BartanDB.add(BartanDB.STORES.BOOKINGS, {
    customerId,
    customerName: name,
    fatherName: father,
    mobile,
    bookingDate: bookDt,
    returnDate: retDt,
    totalDays: days,
    items,
    totalAmount,
    pendingAmount,
    receiptNo,
    status: 'active',
    notes,
    createdAt: new Date().toISOString(),
  });

  if (advance > 0) {
    await BartanDB.add(BartanDB.STORES.PAYMENTS, {
      bookingId,
      amount: advance,
      mode: payMode,
      paymentDate: new Date().toISOString(),
    });
  }

  showToast(`✅ Booking save ho gayi! Receipt: ${receiptNo}`);
  setTimeout(() => openBookingDetail(bookingId), 800);
}

// ============================================
// CUSTOMERS PAGE
// ============================================
let allCustomersCache = [];

async function loadCustomersPage() {
  allCustomersCache = await BartanDB.getAll(BartanDB.STORES.CUSTOMERS);
  allCustomersCache.reverse();
  renderCustomersList(allCustomersCache);
}

function renderCustomersList(customers) {
  const container = document.getElementById('customers-list');
  if (customers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <p>Koi customer nahi mila</p>
      </div>`;
    return;
  }
  container.innerHTML = customers.map(c => `
    <div class="booking-item" onclick="openCustomerDetail(${c.id})">
      <div class="b-top">
        <span class="b-name">${c.name}</span>
        <span class="b-receipt">${c.mobile || ''}</span>
      </div>
      <div class="b-info">Pita: ${c.fatherName || '-'}</div>
    </div>`).join('');
}

function searchCustomers(query) {
  const q = query.toLowerCase();
  const filtered = allCustomersCache.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.mobile || '').includes(q) ||
    (c.fatherName || '').toLowerCase().includes(q)
  );
  renderCustomersList(filtered);
}

// Open customer detail (show their booking history)
async function openCustomerDetail(customerId) {
  const customer = await BartanDB.get(BartanDB.STORES.CUSTOMERS, customerId);
  if (!customer) return;

  const allBookings = await BartanDB.getByIndex(BartanDB.STORES.BOOKINGS, 'customerId', customerId);
  allBookings.reverse();

  const totalAmount = allBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalPending = allBookings.reduce((s, b) => s + (b.pendingAmount || 0), 0);
  const activeCount = allBookings.filter(b => b.status === 'active').length;

  let bookingHTML = '';
  if (allBookings.length === 0) {
    bookingHTML = `<div class="empty-state" style="padding:20px;"><div class="empty-icon">📋</div><p>Koi booking nahi mili</p></div>`;
  } else {
    bookingHTML = await buildBookingCards(allBookings);
  }

  document.getElementById('customer-detail-content').innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
        <div style="width:52px;height:52px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#fff;font-weight:800;flex-shrink:0;">
          ${customer.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-size:1.1rem;font-weight:800;">${customer.name}</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">Pita: ${customer.fatherName || '-'}</div>
          ${customer.mobile ? `<div style="font-size:0.82rem;color:var(--text-secondary);">📞 ${customer.mobile}</div>` : ''}
        </div>
      </div>
      <div class="divider"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;">
        <div style="text-align:center;">
          <div style="font-size:1.3rem;font-weight:800;color:var(--primary);">${allBookings.length}</div>
          <div style="font-size:0.7rem;color:var(--text-secondary);">Total</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.3rem;font-weight:800;color:var(--warning);">${activeCount}</div>
          <div style="font-size:0.7rem;color:var(--text-secondary);">Active</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1rem;font-weight:800;color:${totalPending > 0 ? 'var(--danger)' : 'var(--success)'};">
            ${totalPending > 0 ? formatCurrency(totalPending) : '✅'}
          </div>
          <div style="font-size:0.7rem;color:var(--text-secondary);">Baaki</div>
        </div>
      </div>
    </div>

    <div class="section-header">
      <span class="section-title">Booking History</span>
    </div>
    ${bookingHTML}

    <div class="btn-row" style="margin-top:10px;margin-bottom:16px;">
      ${customer.mobile ? `<button class="btn btn-whatsapp" onclick="sendWhatsAppReminder('${customer.mobile}', '${customer.name.replace(/'/g,"\\'")}', '')">📲 WhatsApp</button>` : ''}
      <button class="btn btn-outline" onclick="navigateTo('customers')">← Back</button>
    </div>
    <div style="height:16px;"></div>
  `;

  navigateTo('customer-detail');
}

// ============================================
// TOAST
// ============================================
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function formatCurrency(amount) {
  return '₹' + (amount || 0).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function toLocalDateTimeStr(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

// ============================================
// APP STARTUP
// ============================================
async function startApp() {
  try {
    await BartanDB.init();
    navigateTo('dashboard');

    // Date change listeners
    document.getElementById('nb-booking-dt').addEventListener('change', updateDays);
    document.getElementById('nb-return-dt').addEventListener('change', updateDays);

    // Header action button
    document.getElementById('headerActionBtn').addEventListener('click', () => {
      navigateTo('new-booking');
    });

    // Due date auto alert — app open hone par check karo
    setTimeout(checkDueDateAlerts, 1500);

    console.log('✅ Bartan Kiraya App started!');
  } catch (err) {
    console.error('❌ App start failed:', err);
    showToast('❌ App start mein problem aayi!');
  }
}

document.addEventListener('DOMContentLoaded', startApp);