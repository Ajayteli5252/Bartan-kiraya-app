// ============================================
// app.js — Main App Logic & Navigation v4
// ============================================

// ============================================
// Page Config
// ============================================
const PAGE_CONFIG = {
  'dashboard':       { title: '🏠 Dashboard',       nav: 'nav-dashboard',  fab: true  },
  'bookings':        { title: '📋 All Bookings',     nav: 'nav-bookings',   fab: true  },
  'new-booking':     { title: '➕ New Booking',      nav: null,             fab: false },
  'booking-detail':  { title: '📄 Booking Detail',  nav: null,             fab: false },
  'inventory':       { title: '🪣 Bartan Stock',     nav: 'nav-inventory',  fab: false },
  'customers':       { title: '👥 Customers',        nav: 'nav-customers',  fab: false },
  'customer-detail': { title: '👤 Customer Detail', nav: null,             fab: false },
  'report':          { title: '📊 Reports',          nav: 'nav-report',     fab: false },
  'settings':        { title: '⚙️ Settings',         nav: null,             fab: false },
  'sarai':           { title: '🏰 Sarai Bookings',   nav: 'nav-sarai',      fab: false },
  'new-sarai-booking': { title: '➕ Book Sarai',     nav: null,             fab: false },
  'sarai-detail':    { title: '📄 Sarai Detail',    nav: null,             fab: false },
};

let currentPage  = 'dashboard';
let appSettings  = {};

// ============================================
// Navigate Between Pages
// ============================================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  const config = PAGE_CONFIG[page];
  if (config) {
    document.querySelector('.header-text > div:first-child').textContent =
      appSettings.businessName || 'Shiv Shakti Bartan Kiraya';

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
// On Page Load
// ============================================
async function onPageLoad(page) {
  switch (page) {
    case 'dashboard':    await loadDashboard(); await loadSaraiData(); break;
    case 'bookings':     await loadBookingsList();    break;
    case 'new-booking':  await loadNewBookingForm();  break;
    case 'inventory':    await loadInventoryPage();   break;
    case 'customers':    await loadCustomersPage();   break;
    case 'report':       await loadReportPage();      break;
    case 'settings':     await loadSettingsPage();    break;
    case 'sarai':        await loadSaraiData();       break;
  }
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  const [bookings, payments, customers, inventory] = await Promise.all([
    BartanDB.getAll(BartanDB.STORES.BOOKINGS),
    BartanDB.getAll(BartanDB.STORES.PAYMENTS),
    BartanDB.getAll(BartanDB.STORES.CUSTOMERS),
    BartanDB.getAll(BartanDB.STORES.INVENTORY),
  ]);

  const activeBookings = bookings.filter(b => b.status === 'active');
  const now            = new Date();
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalPending   = bookings.reduce((sum, b) => sum + (b.pendingAmount || 0), 0);
  const monthIncome    = payments
    .filter(p => new Date(p.paymentDate) >= monthStart)
    .reduce((sum, p)  => sum + (p.amount || 0), 0);

  // Inventory totals
  const totalPieces  = inventory.reduce((s, i) => s + (i.totalStock || 0), 0);
  const rentedOut    = inventory.reduce((s, i) => s + ((i.totalStock || 0) - (i.availableStock || 0)), 0);

  document.getElementById('stat-active').textContent    = activeBookings.length;
  document.getElementById('stat-pending').textContent   = formatCurrency(totalPending);
  document.getElementById('stat-month').textContent     = formatCurrency(monthIncome);
  document.getElementById('stat-customers').textContent = customers.length;
  document.getElementById('stat-total-bartan').textContent = totalPieces;
  document.getElementById('stat-rented-out').textContent   = rentedOut;

  // Overdue badge on header
  const overdueCount = activeBookings.filter(b => isOverdue(b)).length;
  const headerBtn    = document.getElementById('headerActionBtn');
  if (headerBtn) {
    if (overdueCount > 0) {
      headerBtn.innerHTML = `⚠️<span class="header-badge">${overdueCount}</span>`;
      headerBtn.title     = `${overdueCount} overdue booking(s)`;
      headerBtn.onclick   = () => checkDueDateAlerts(true);
    } else {
      headerBtn.innerHTML = '✅';
      headerBtn.title     = 'No overdue bookings';
      headerBtn.onclick   = null;
    }
  }

  // ----- Inventory summary table -----
  renderDashboardInventory(inventory);

  // ----- Active bookings (max 5) -----
  const container = document.getElementById('dashboard-bookings');
  if (activeBookings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>No active bookings yet</p>
        <button class="btn btn-primary btn-sm" onclick="navigateTo('new-booking')">+ New Booking</button>
      </div>`;
  } else {
    const recent = [...activeBookings].sort((a,b) => b.id - a.id).slice(0, 5);
    container.innerHTML = await buildBookingCards(recent);
  }

  // ----- Due / Overdue -----
  const todayStr      = toDateStr(now);
  const dueToday      = activeBookings.filter(b => {
    const retStr = b.returnDate?.split('T')[0] || b.returnDate;
    return retStr === todayStr;
  });
  const overdueBookings = activeBookings.filter(b => isOverdue(b));

  const dueContainer = document.getElementById('dashboard-due');
  if (dueToday.length === 0 && overdueBookings.length === 0) {
    dueContainer.innerHTML = `<p style="font-size:0.85rem;color:var(--text-hint);padding:8px 0;">✅ No returns due today</p>`;
  } else {
    const combined = [...new Map([...overdueBookings, ...dueToday].map(b => [b.id, b])).values()];
    dueContainer.innerHTML = await buildBookingCards(combined);
  }
}

function renderDashboardInventory(inventory) {
  const container = document.getElementById('dashboard-inventory-summary');
  const activeItems = inventory.filter(i => i.totalStock > 0);
  if (activeItems.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:16px;color:var(--text-hint);font-size:0.85rem;">
        No bartan added yet. <button class="btn btn-outline btn-sm" style="margin-top:6px;display:inline-block;" onclick="navigateTo('inventory')">Set Up Inventory →</button>
      </div>`;
    return;
  }

  let rows = '';
  for (const item of activeItems) {
    const total   = item.totalStock    || 0;
    const avail   = item.availableStock || 0;
    const rented  = total - avail;
    const missing = item.missingCount  || 0;

    const availColor   = avail === 0   ? 'var(--danger)'  : avail < 3  ? 'var(--warning)' : 'var(--success)';
    const missingColor = missing > 0   ? 'var(--danger)'  : 'var(--text-hint)';

    rows += `
      <tr onclick="navigateTo('inventory')" style="cursor:pointer;">
        <td class="inv-name-cell">${item.name}</td>
        <td>${total}</td>
        <td style="color:var(--warning);font-weight:700;">${rented}</td>
        <td style="color:${availColor};font-weight:700;">${avail}</td>
        <td style="color:${missingColor};font-weight:700;">${missing > 0 ? missing : '-'}</td>
      </tr>`;
  }

  container.innerHTML = `
    <div class="card" style="padding:10px;overflow-x:auto;">
      <table class="inv-dash-table">
        <thead>
          <tr>
            <th>Bartan</th>
            <th style="text-align:center;">Total</th>
            <th style="text-align:center;">Rented</th>
            <th style="text-align:center;">Available</th>
            <th style="text-align:center;">Missing</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ============================================
// BOOKINGS LIST
// ============================================
let allBookingsCache = [];
let currentFilter    = 'all';

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
        <p>No bookings found</p>
        <button class="btn btn-primary btn-sm" onclick="navigateTo('new-booking')">+ New Booking</button>
      </div>`;
    return;
  }
  buildBookingCards(bookings).then(html => container.innerHTML = html);
}

async function buildBookingCards(bookings) {
  let html = '';
  for (const b of bookings) {
    const customer    = b.customerId ? await BartanDB.get(BartanDB.STORES.CUSTOMERS, b.customerId) : null;
    const name        = customer?.name || b.customerName || 'Unknown';
    const overdue     = isOverdue(b);
    const overdueDays = getOverdueDays(b);

    let badge = '';
    if (overdue) {
      badge = `<span class="badge badge-overdue">⚠️ ${overdueDays}d Late</span>`;
    } else if (b.status === 'active') {
      badge = '<span class="badge badge-active">Active</span>';
    } else {
      badge = '<span class="badge badge-returned">Returned ✅</span>';
    }

    const pendingBadge = b.pendingAmount > 0
      ? `<span class="b-pending">Due: ${formatCurrency(b.pendingAmount)}</span>`
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
          📅 ${formatDate(b.bookingDate)} → ${formatDate(b.returnDate)} &nbsp;|&nbsp; ${b.totalDays || 0} days
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
    (b.receiptNo    || '').toLowerCase().includes(q) ||
    (b.mobile       || '').includes(q)
  );
  renderBookingsList(filtered);
}

function filterBookings(type, btn) {
  currentFilter = type;
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
  if (!booking) { showToast('⚠️ Booking not found!'); return; }

  window.currentBooking = booking;

  const customer = booking.customerId
    ? await BartanDB.get(BartanDB.STORES.CUSTOMERS, booking.customerId)
    : null;
  const payments = await BartanDB.getByIndex(BartanDB.STORES.PAYMENTS, 'bookingId', bookingId);

  const overdue     = isOverdue(booking);
  const overdueDays = getOverdueDays(booking);

  let statusBadge = '';
  if (overdue) {
    statusBadge = `<span class="badge badge-overdue">⚠️ ${overdueDays} days late</span>`;
  } else if (booking.status === 'active') {
    statusBadge = '<span class="badge badge-active">Active</span>';
  } else {
    statusBadge = '<span class="badge badge-returned">Returned ✅</span>';
  }

  // Bartan rows
  let bartanRows = '';
  for (const item of (booking.items || [])) {
    if (item.nag > 0) {
      if (booking.status === 'active') {
        bartanRows += `
          <tr>
            <td>${item.name}</td>
            <td>
              <div style="display:flex;align-items:center;gap:2px;">
                <button class="btn btn-outline" style="padding:2px 6px;line-height:1;" onclick="updateBookingItem(${booking.id}, ${item.inventoryId}, 'qty', ${item.nag - 1})">-</button>
                <input type="number" min="0" value="${item.nag}" style="width:36px;text-align:center;padding:4px;" inputmode="numeric" 
                       onchange="updateBookingItem(${booking.id}, ${item.inventoryId}, 'qty', this.value)" />
                <button class="btn btn-outline" style="padding:2px 6px;line-height:1;" onclick="updateBookingItem(${booking.id}, ${item.inventoryId}, 'qty', ${item.nag + 1})">+</button>
              </div>
            </td>
            <td>
              <div style="display:flex;align-items:center;">
                ₹<input type="number" min="0" value="${item.ratePerDay}" style="width:52px;margin-left:2px;font-size:0.8rem;padding:6px 4px;" inputmode="numeric" 
                       onchange="updateBookingItem(${booking.id}, ${item.inventoryId}, 'rate', this.value)" />
              </div>
            </td>
            <td>${booking.totalDays} days</td>
            <td class="row-total">₹${item.rakam}</td>
          </tr>`;
      } else {
        bartanRows += `
          <tr>
            <td>${item.name}</td>
            <td>${item.nag}</td>
            <td>₹${item.ratePerDay}/day</td>
            <td>${booking.totalDays} days</td>
            <td class="row-total">₹${item.rakam}</td>
          </tr>`;
      }
    }
  }

  // Payment history
  let paymentRows = payments.map(p => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:0.85rem;">${formatDateTime(p.paymentDate)} &nbsp;|&nbsp; ${p.mode === 'upi' ? '📱 UPI' : '💵 Cash'}</span>
      <span style="font-weight:700;color:var(--success);">+${formatCurrency(p.amount)}</span>
    </div>`).join('');

  const mobile     = customer?.mobile || booking.mobile || '';
  const paidAmount = (booking.totalAmount || 0) - (booking.pendingAmount || 0);
  
  let subTotal = 0;
  for (const item of (booking.items || [])) {
    if (item.nag > 0) subTotal += (item.rakam || 0);
  }
  const discount = booking.discount || 0;

  document.getElementById('booking-detail-content').innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;">${customer?.name || booking.customerName}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);">Father: ${customer?.fatherName || booking.fatherName || '-'}</div>
          ${mobile ? `<div style="font-size:0.82rem;color:var(--text-secondary);">📞 ${mobile}</div>` : ''}
        </div>
        ${statusBadge}
      </div>
      <div class="divider"></div>
      <div style="font-size:0.82rem;color:var(--text-secondary);">
        Receipt: <b>${booking.receiptNo}</b> &nbsp;|&nbsp;
        Booked: <b>${formatDateTime(booking.bookingDate)}</b><br/>
        Return Date: <b>${formatDate(booking.returnDate)}</b> &nbsp;|&nbsp;
        Total: <b>${booking.totalDays} days</b>
      </div>
    </div>

    <div class="card">
      <div class="card-title">🪣 Bartan List</div>
      <div style="overflow-x:auto;">
        <table class="bartan-table">
          <thead>
            <tr><th>Bartan</th><th>Qty</th><th>Rate</th><th>Days</th><th>Amount</th></tr>
          </thead>
          <tbody>${bartanRows || '<tr><td colspan="5" style="text-align:center;color:var(--text-hint);">No items</td></tr>'}</tbody>
        </table>
      </div>
      <div class="total-row" style="background:#fff;border-bottom:none;">
        <span class="total-label">Sub Total</span>
        <span class="total-value">${formatCurrency(subTotal)}</span>
      </div>
      <div class="total-row" style="background:#fff;border-bottom:none;padding-top:0;">
        <span class="total-label" style="color:var(--danger);">Discount</span>
        <span class="total-value" style="color:var(--danger);">
          ${booking.status === 'active' ? `- ₹<input type="number" min="0" value="${discount}" style="width:60px;padding:4px;text-align:right;" onchange="updateBookingDiscount(${booking.id}, this.value)" />` : `- ${formatCurrency(discount)}`}
        </span>
      </div>
      <div class="total-row">
        <span class="total-label">Final Amount</span>
        <span class="total-value">${formatCurrency(booking.totalAmount)}</span>
      </div>
      ${booking.status === 'active' ? `<div style="padding:10px;"><button class="btn btn-outline btn-sm" style="width:100%;" onclick="openAddBookingItemModal(${booking.id})">➕ Add New Bartan to this Booking</button></div>` : ''}
    </div>

    <div class="card">
      <div class="card-title">💰 Payment Details</div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="font-size:0.85rem;color:var(--text-secondary);">Total Amount</span>
        <span style="font-weight:700;">${formatCurrency(booking.totalAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="font-size:0.85rem;color:var(--text-secondary);">Paid</span>
        <span style="font-weight:700;color:var(--success);">${formatCurrency(paidAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);margin-top:4px;">
        <span style="font-size:0.9rem;font-weight:700;">Pending Balance</span>
        <span style="font-weight:800;color:${booking.pendingAmount > 0 ? 'var(--danger)' : 'var(--success)'};">
          ${booking.pendingAmount > 0 ? formatCurrency(booking.pendingAmount) : '✅ Fully Paid'}
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
            <span class="penalty-type-badge penalty-overdue">${booking.overdueDays || 0} days late</span>
          </div>
          <span style="font-weight:700;color:var(--danger);">&#8377;${(booking.overduePenalty||0).toLocaleString('en-IN')}</span>
        </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:4px;">
        <span style="font-weight:700;">Total Penalty</span>
        <span style="font-size:1.1rem;font-weight:800;color:var(--danger);">&#8377;${(booking.penalty||0).toLocaleString('en-IN')}</span>
      </div>
    </div>` : ''}

    <!-- Action Buttons -->
    <div class="btn-row">
      <button class="btn btn-print" onclick="printBookingBill(${bookingId})">🖨️ Print Bill</button>
    </div>
    <div class="btn-row" style="margin-top:10px;">
      ${booking.pendingAmount > 0 ? `<button class="btn btn-success" onclick="openPaymentModal(${bookingId})">💰 Add Payment</button>` : ''}
    </div>
    <div class="btn-row" style="margin-top:10px;">
      ${booking.status === 'active' ? `<button class="btn btn-accent" onclick="openExtendModal(${bookingId})">⏳ Extend</button>` : ''}
      ${booking.status === 'active' ? `<button class="btn btn-primary" onclick="openReturnModal(${bookingId})">&#9989; Return</button>` : ''}
    </div>
    <div class="btn-row" style="margin-top:10px;">
      <button class="btn btn-outline" onclick="navigateTo('bookings')">← Back</button>
      <button class="btn btn-danger btn-sm" onclick="confirmDeleteBooking(${bookingId})" style="width:auto;flex:0;">🗑️ Delete</button>
    </div>
    <div style="height:16px;"></div>
  `;

  navigateTo('booking-detail');
}

async function updateBookingItem(bookingId, invId, field, newVal) {
  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  const inv     = await BartanDB.get(BartanDB.STORES.INVENTORY, Number(invId));
  
  if (!booking || !inv) return;
  
  const itemIndex = booking.items.findIndex(i => String(i.inventoryId) === String(invId));
  if (itemIndex === -1) return;
  
  const item = booking.items[itemIndex];
  const oldRakam = item.rakam;
  let val = parseFloat(newVal) || 0;
  
  if (field === 'qty') {
    val = parseInt(val) || 0;
    const diff = val - item.nag;
    if (diff > 0 && (inv.availableStock || 0) < diff) {
      showToast(`⚠️ Only ${inv.availableStock} available in stock!`);
      openBookingDetail(bookingId);
      return;
    }
    inv.availableStock = (inv.availableStock || 0) - diff;
    await BartanDB.put(BartanDB.STORES.INVENTORY, inv);
    item.nag = val;
  } else if (field === 'rate') {
    item.ratePerDay = val;
  }
  
  item.rakam = item.nag * item.ratePerDay * booking.totalDays;
  
  const diffRakam = item.rakam - oldRakam;
  // Recalculate pending amount safely by checking what was actually paid
  const paidAmount = (booking.totalAmount || 0) - (booking.pendingAmount || 0);
  booking.totalAmount   = (booking.totalAmount || 0) + diffRakam;
  booking.pendingAmount = booking.totalAmount - paidAmount;
  
  await BartanDB.put(BartanDB.STORES.BOOKINGS, booking);
  showToast('✅ Bill updated!');
  openBookingDetail(bookingId);
}

async function updateBookingDiscount(bookingId, newVal) {
  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  if (!booking) return;
  
  let val = parseFloat(newVal) || 0;
  if (val < 0) val = 0;
  
  let subTotal = 0;
  for (const item of booking.items || []) {
    subTotal += (item.rakam || 0);
  }
  
  if (val > subTotal) {
    showToast('⚠️ Discount cannot be greater than subtotal!');
    val = subTotal;
  }
  
  booking.discount = val;
  const newTotal = subTotal - val;
  
  const paidAmount = (booking.totalAmount || 0) - (booking.pendingAmount || 0);
  booking.totalAmount = newTotal;
  booking.pendingAmount = newTotal - paidAmount;
  
  await BartanDB.put(BartanDB.STORES.BOOKINGS, booking);
  showToast('✅ Discount applied!');
  openBookingDetail(bookingId);
}

// ============================================
// EXTEND / REBOOK MODAL
// ============================================
function openExtendModal(bookingId) {
  const existing = document.getElementById('extend-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'extend-modal';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">⏳ Extend / Rebook</div>
      
      <div class="form-group">
        <label class="form-label">New Return Date</label>
        <input type="date" class="form-control" id="ext-return-dt" />
      </div>

      <div class="btn-row">
        <button class="btn btn-outline" onclick="closeExtendModal()">Cancel</button>
        <button class="btn btn-primary" onclick="confirmExtend(${bookingId})">💾 Save</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeExtendModal(); });
  document.body.appendChild(overlay);
}

function closeExtendModal() {
  const m = document.getElementById('extend-modal');
  if (m) m.remove();
}

async function confirmExtend(bookingId) {
  const newDate = document.getElementById('ext-return-dt').value;
  if (!newDate) {
    showToast('⚠️ Please select a new return date!');
    return;
  }
  
  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  const bookingDt = new Date(booking.bookingDate);
  const returnDt = new Date(newDate);
  
  if (returnDt <= bookingDt) {
    showToast('⚠️ Return date must be after booking date!');
    return;
  }
  
  const diff = Math.ceil((returnDt - bookingDt) / (1000 * 60 * 60 * 24));
  const newTotalDays = Math.max(1, diff);
  
  let newSubTotal = 0;
  for (const item of booking.items || []) {
    item.rakam = item.nag * item.ratePerDay * newTotalDays;
    newSubTotal += item.rakam;
  }
  
  const discount = booking.discount || 0;
  let newTotalAmount = newSubTotal - discount;
  if (newTotalAmount < 0) newTotalAmount = 0;
  
  const diffAmount = newTotalAmount - (booking.totalAmount || 0);
  
  booking.returnDate = newDate;
  booking.totalDays = newTotalDays;
  booking.totalAmount = newTotalAmount;
  
  const paidAmount = (booking.totalAmount - diffAmount) - (booking.pendingAmount || 0);
  booking.pendingAmount = booking.totalAmount - paidAmount;
  
  await BartanDB.put(BartanDB.STORES.BOOKINGS, booking);
  
  closeExtendModal();
  showToast('✅ Booking extended successfully!');
  openBookingDetail(bookingId);
}

// ============================================
// ADD NEW ITEM TO EXISTING BOOKING
// ============================================
async function openAddBookingItemModal(bookingId) {
  const inventory = await BartanDB.getAll(BartanDB.STORES.INVENTORY);
  let optionsHtml = '<option value="">Select Item...</option>';
  for (const inv of inventory) {
    if (inv.availableStock > 0) {
      optionsHtml += `<option value="${inv.id}" data-rate="${inv.ratePerDay}" data-name="${inv.name}">
        ${inv.name} (Avail: ${inv.availableStock})
      </option>`;
    }
  }

  const existing = document.getElementById('add-item-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'add-item-modal';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">➕ Add New Bartan</div>
      
      <div class="form-group">
        <label class="form-label">Select Bartan</label>
        <select class="form-control" id="add-item-select" onchange="document.getElementById('add-item-rate').value = this.options[this.selectedIndex].dataset.rate || ''">
          ${optionsHtml}
        </select>
      </div>
      <div style="display:flex;gap:10px;">
        <div class="form-group" style="flex:1;">
          <label class="form-label">Qty (Nag)</label>
          <input type="number" class="form-control" id="add-item-qty" min="1" value="1" />
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Rate/Day</label>
          <input type="number" class="form-control" id="add-item-rate" min="0" />
        </div>
      </div>

      <div class="btn-row">
        <button class="btn btn-outline" onclick="closeAddBookingItemModal()">Cancel</button>
        <button class="btn btn-primary" onclick="confirmAddBookingItem(${bookingId})">💾 Add Item</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeAddBookingItemModal(); });
  document.body.appendChild(overlay);
}

function closeAddBookingItemModal() {
  const m = document.getElementById('add-item-modal');
  if (m) m.remove();
}

async function confirmAddBookingItem(bookingId) {
  const select = document.getElementById('add-item-select');
  const invId = select.value;
  if (!invId) { showToast('⚠️ Please select an item!'); return; }
  
  const name = select.options[select.selectedIndex].dataset.name;
  const qty = parseInt(document.getElementById('add-item-qty').value) || 0;
  const rate = parseFloat(document.getElementById('add-item-rate').value) || 0;
  
  if (qty <= 0) { showToast('⚠️ Qty must be at least 1'); return; }
  
  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  const inv = await BartanDB.get(BartanDB.STORES.INVENTORY, Number(invId));
  
  if (inv.availableStock < qty) {
    showToast(`⚠️ Only ${inv.availableStock} available!`);
    return;
  }
  
  const existingItem = booking.items.find(i => String(i.inventoryId) === String(invId));
  if (existingItem) {
    showToast('⚠️ This item is already in the bill. Please edit its quantity directly in the list.');
    return;
  }
  
  inv.availableStock -= qty;
  await BartanDB.put(BartanDB.STORES.INVENTORY, inv);
  
  const rakam = qty * rate * booking.totalDays;
  booking.items.push({
    inventoryId: Number(invId),
    name: name,
    nag: qty,
    ratePerDay: rate,
    rakam: rakam
  });
  
  booking.totalAmount = (booking.totalAmount || 0) + rakam;
  booking.pendingAmount = (booking.pendingAmount || 0) + rakam;
  
  await BartanDB.put(BartanDB.STORES.BOOKINGS, booking);
  
  closeAddBookingItemModal();
  showToast('✅ Item added successfully!');
  openBookingDetail(bookingId);
}

// ============================================
// PRINT BILL
// ============================================
async function printBookingBill(bookingId) {
  const booking  = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  const customer = booking.customerId
    ? await BartanDB.get(BartanDB.STORES.CUSTOMERS, booking.customerId) : null;

  const bizName = appSettings.businessName || 'Shiv Shakti Bartan Kiraya';
  const bizAddr = appSettings.address      || '';
  const mobile  = customer?.mobile || booking.mobile || '';
  const paid    = (booking.totalAmount || 0) - (booking.pendingAmount || 0);

  let itemRows = '';
  for (const item of (booking.items || [])) {
    if (item.nag > 0) {
      itemRows += `
        <tr>
          <td style="padding:5px 4px;border-bottom:1px solid #eee;">${item.name}</td>
          <td style="padding:5px 4px;border-bottom:1px solid #eee;text-align:center;">${item.nag}</td>
          <td style="padding:5px 4px;border-bottom:1px solid #eee;text-align:right;">₹${item.ratePerDay}/day</td>
          <td style="padding:5px 4px;border-bottom:1px solid #eee;text-align:center;">${booking.totalDays}d</td>
          <td style="padding:5px 4px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">₹${item.rakam}</td>
        </tr>`;
    }
  }

  const penaltyRow = (booking.penalty || 0) > 0
    ? `<div class="print-bill-row" style="color:#C62828;"><span>⚠️ Penalty Added</span><span>₹${booking.penalty.toLocaleString('en-IN')}</span></div>`
    : '';

  const billHTML = `
    <div class="print-bill-sheet" id="print-bill-div">
      <div class="print-bill-header">
        <div class="print-bill-title">🪣 ${bizName}</div>
        ${appSettings.ownerName || appSettings.phone ? `<div class="print-bill-sub">Prop: ${appSettings.ownerName || '-'} | Mob: ${appSettings.phone || '-'}</div>` : ''}
        ${bizAddr ? `<div class="print-bill-sub">${bizAddr}</div>` : ''}
        <div class="print-bill-sub" style="margin-top:4px;">RENTAL BILL / RECEIPT</div>
      </div>

      <div class="print-bill-row"><span>Receipt No:</span><span><b>${booking.receiptNo}</b></span></div>
      <div class="print-bill-row"><span>Customer:</span><span><b>${customer?.name || booking.customerName}</b></span></div>
      ${mobile ? `<div class="print-bill-row"><span>Mobile:</span><span>${mobile}</span></div>` : ''}
      <div class="print-bill-row"><span>Booked On:</span><span>${formatDate(booking.bookingDate)}</span></div>
      <div class="print-bill-row"><span>Return Date:</span><span>${formatDate(booking.returnDate)}</span></div>
      <div class="print-bill-row"><span>Total Days:</span><span>${booking.totalDays} days</span></div>

      <div style="margin:10px 0 6px;font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;">Bartan Details</div>
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:5px 4px;text-align:left;">Bartan</th>
            <th style="padding:5px 4px;text-align:center;">Qty</th>
            <th style="padding:5px 4px;text-align:right;">Rate</th>
            <th style="padding:5px 4px;text-align:center;">Days</th>
            <th style="padding:5px 4px;text-align:right;">Amt</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="margin-top:10px;">
        <div class="print-bill-row"><span>Subtotal</span><span>₹${(booking.totalAmount - (booking.penalty||0)).toLocaleString('en-IN')}</span></div>
        ${penaltyRow}
        <div class="print-bill-total"><span>TOTAL</span><span>₹${(booking.totalAmount||0).toLocaleString('en-IN')}</span></div>
        <div class="print-bill-row"><span>Amount Paid</span><span style="color:#2E7D32;font-weight:700;">₹${paid.toLocaleString('en-IN')}</span></div>
        <div class="print-bill-row" style="color:${(booking.pendingAmount||0) > 0 ? '#C62828' : '#2E7D32'};font-weight:700;">
          <span>Balance Due</span>
          <span>${(booking.pendingAmount||0) > 0 ? '₹' + booking.pendingAmount.toLocaleString('en-IN') : '✅ PAID'}</span>
        </div>
      </div>

      <div class="print-bill-footer">
        ${appSettings.waFooter || 'Dhanyawad! Booking karne ke liye.'}<br/>
        ${bizName}
      </div>
    </div>
    <div class="btn-row no-print" style="margin:8px 0;">
      <button class="btn btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
      ${mobile ? `<button class="btn btn-whatsapp" onclick="shareBillPDF(${bookingId}, '${mobile}')">📲 Share Bill (PDF)</button>` : `<button class="btn btn-whatsapp" onclick="shareBillPDF(${bookingId}, '')">📲 Share Bill (PDF)</button>`}
    </div>
    <div class="btn-row no-print" style="margin-top:8px;">
      <button class="btn btn-outline" onclick="closePrintModal()">Close</button>
    </div>`;

  // Show in modal
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'print-modal';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">🖨️ Bill Preview</div>
      ${billHTML}
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closePrintModal(); });
  document.body.appendChild(overlay);
}

async function shareBillPDF(bookingId, mobile) {
  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  if (!booking) return;

  const customer = booking.customerId ? await BartanDB.get(BartanDB.STORES.CUSTOMERS, booking.customerId) : null;
  const custName = customer?.name || booking.customerName || 'Customer';

  showToast('⏳ Generating PDF Receipt...');

  try {
    if (typeof window.jspdf === 'undefined') {
      showToast('⚠️ jsPDF not loaded.');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const bizName = appSettings.businessName || "Shiv Shakti Bartan Kiraya";
    const ownerName = appSettings.ownerName || "";
    const phone = appSettings.phone || "";

    // Header Background
    doc.setFillColor(230, 81, 0); // Primary Theme Color (#E65100)
    doc.rect(0, 0, 210, 32, 'F');
    
    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(bizName, 105, 12, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    let ownerInfo = [];
    if (ownerName) ownerInfo.push(`Prop: ${ownerName}`);
    if (phone) ownerInfo.push(`Mob: ${phone}`);
    if (ownerInfo.length > 0) {
      doc.text(ownerInfo.join("  |  "), 105, 19, { align: "center" });
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("BARTAN BOOKING RECEIPT", 105, 27, { align: "center" });
    
    // Reset Text Color
    doc.setTextColor(0, 0, 0);
    
    // Outer Border
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, 36, 190, 250);
    
    // Section: Booking Details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Booking Details", 15, 45);
    doc.setDrawColor(230, 230, 230);
    doc.line(15, 48, 195, 48);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Receipt No:`, 15, 56);
    doc.setFont("helvetica", "bold");
    doc.text(`${booking.receiptNo}`, 45, 56);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Customer Name:`, 15, 64);
    doc.setFont("helvetica", "bold");
    doc.text(`${custName}`, 48, 64);
    doc.setFont("helvetica", "normal");
    
    if (mobile) {
      doc.text(`Mobile:`, 15, 72);
      doc.setFont("helvetica", "bold");
      doc.text(`${mobile}`, 32, 72);
      doc.setFont("helvetica", "normal");
    }
    
    doc.text(`Booking Date:`, 110, 56);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatDate(booking.bookingDate)}`, 140, 56);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Return Date:`, 110, 64);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatDate(booking.returnDate)}`, 135, 64);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Total Days:`, 110, 72);
    doc.setFont("helvetica", "bold");
    doc.text(`${booking.totalDays}`, 133, 72);

    doc.line(15, 80, 195, 80);
    
    // Items Table Header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(15, 85, 180, 10, 'F');
    doc.text("Bartan Item", 18, 92);
    doc.text("Qty", 90, 92);
    doc.text("Rate/Day", 115, 92);
    doc.text("Days", 145, 92);
    doc.text("Amount", 185, 92, { align: "right" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    let yPos = 102;
    for (const item of (booking.items || [])) {
      if (item.nag > 0) {
        doc.text(item.name, 18, yPos);
        doc.text(String(item.nag), 90, yPos);
        doc.text(`Rs ${item.ratePerDay}`, 115, yPos);
        doc.text(String(booking.totalDays), 145, yPos);
        doc.text(`Rs ${item.rakam}`, 185, yPos, { align: "right" });
        yPos += 8;
      }
    }
    
    doc.line(15, yPos + 2, 195, yPos + 2);
    yPos += 12;

    // Payment Box
    doc.setFillColor(245, 245, 245);
    doc.rect(15, yPos, 180, 45, 'F');
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Summary", 20, yPos + 8);
    doc.line(20, yPos + 12, 190, yPos + 12);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    let currentY = yPos + 20;
    
    const subtotal = booking.totalAmount - (booking.penalty || 0);
    doc.text(`Subtotal:`, 20, currentY);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs ${subtotal}`, 190, currentY, { align: "right" });
    doc.setFont("helvetica", "normal");
    
    if ((booking.penalty || 0) > 0) {
      currentY += 8;
      doc.text(`Penalty Added:`, 20, currentY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(198, 40, 40);
      doc.text(`Rs ${booking.penalty}`, 190, currentY, { align: "right" });
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
    }

    currentY += 8;
    doc.text(`Total Amount:`, 20, currentY);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs ${booking.totalAmount}`, 190, currentY, { align: "right" });
    doc.setFont("helvetica", "normal");

    const paidAmount = (booking.totalAmount || 0) - (booking.pendingAmount || 0);
    currentY += 8;
    doc.text(`Amount Paid:`, 20, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(46, 125, 50); // Green
    doc.text(`Rs ${paidAmount}`, 190, currentY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    
    currentY += 8;
    doc.text(`Balance Due:`, 20, currentY);
    if (booking.pendingAmount > 0) {
      doc.setTextColor(198, 40, 40); // Red
    } else {
      doc.setTextColor(46, 125, 50); // Green
    }
    doc.text(`Rs ${booking.pendingAmount}`, 190, currentY, { align: "right" });
    doc.setTextColor(0, 0, 0);

    // Footer Message
    doc.setFontSize(12);
    doc.setFont("helvetica", "italic");
    doc.text("Dhanyawad! Booking karne ke liye.", 105, 275, { align: "center" });
    
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], `Bartan_Receipt_${booking.receiptNo}.pdf`, { type: 'application/pdf' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'Bartan Booking Receipt',
          text: 'Please find attached your Bartan Booking Receipt.',
          files: [file]
        });
        showToast('✅ PDF Shared Successfully!');
      } catch (err) {
        console.error('Share cancelled or failed', err);
      }
    } else {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bartan_Receipt_${booking.receiptNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      showToast('⬇️ PDF Downloaded. Please attach it manually in WhatsApp.');
      
      if (mobile) {
        setTimeout(() => {
          window.open(`https://wa.me/91${mobile}?text=Dhanyawad ${custName}! Booking karne ke liye. Please check the downloaded PDF receipt for your Bartan booking.`, '_blank');
        }, 1000);
      }
    }
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to generate PDF');
  }
}

function closePrintModal() {
  const m = document.getElementById('print-modal');
  if (m) m.remove();
}

// ============================================
// RETURN MODAL — Item checklist + Penalty
// ============================================
async function openReturnModal(bookingId) {
  const existing = document.getElementById('return-modal');
  if (existing) existing.remove();

  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  if (!booking) return;

  const overdue     = isOverdue(booking);
  const overdueDays = getOverdueDays(booking);
  // Only show items that are not fully returned
  const pendingItems = (booking.items || []).filter(i => i.nag - (i.returnedQty || 0) > 0);
  if (pendingItems.length === 0) {
    showToast('✅ All items already returned!');
    return;
  }

  // Default penalty values from settings
  const defaultDamagePenalty  = parseInt(appSettings.damagePenalty)  || 0;
  const defaultMissingPenalty = parseInt(appSettings.missingPenalty) || 0;

  let itemRows = '';
  pendingItems.forEach((item, idx) => {
    const totalBooked = item.nag;
    const returned = item.returnedQty || 0;
    const pending = totalBooked - returned;
    
    itemRows += `
      <div class="ret-item-row" id="ret-row-${idx}">
        <div class="ret-item-info">
          <div class="ret-item-name" style="font-weight:bold;">${item.name}</div>
          <div class="ret-item-qty" style="color:var(--text-secondary);font-size:0.8rem;">
            Booked: ${totalBooked} | Returned: <span style="color:var(--success);font-weight:600;">${returned}</span> | Pending: <span style="color:var(--danger);font-weight:600;">${pending}</span>
          </div>
        </div>
        
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:100px;">
            <label style="font-size:0.75rem;font-weight:600;color:var(--text-main);">Returning Now</label>
            <input type="number" class="form-control" id="ret-qty-${idx}" 
              value="${pending}" min="0" max="${pending}" oninput="validateReturnQty(${idx}, ${pending})" style="padding:4px 8px;font-weight:bold;" />
          </div>
          <div style="flex:1;min-width:120px;">
            <label style="font-size:0.75rem;font-weight:600;color:var(--text-main);">Status</label>
            <select class="ret-status-select" id="ret-status-${idx}" onchange="togglePenaltyInput(${idx}, ${defaultDamagePenalty}, ${defaultMissingPenalty})" style="padding:4px 8px;margin-top:0;">
              <option value="ok">✅ All Good</option>
              <option value="damaged">🔨 Damaged</option>
              <option value="missing">❌ Missing</option>
            </select>
          </div>
        </div>
        
        <div class="ret-penalty-box" id="ret-penalty-box-${idx}" style="display:none;margin-top:8px;">
          <label style="font-size:0.75rem;color:var(--danger);font-weight:600;">Penalty Amount (₹) for these items</label>
          <input type="number" class="form-control ret-penalty-input" id="ret-penalty-${idx}"
            placeholder="0" min="0" oninput="updateReturnTotal()" />
        </div>
      </div>`;
  });

  // Overdue section
  let overdueSection = '';
  if (overdue) {
    const dailyTotal = pendingItems.reduce((s, i) => {
      const pending = i.nag - (i.returnedQty || 0);
      return s + (pending * i.ratePerDay);
    }, 0);
    const penPct     = parseInt(appSettings.penaltyPct) || 100;
    const suggested  = Math.round(dailyTotal * overdueDays * penPct / 100);
    overdueSection = `
      <div class="ret-overdue-section">
        <div class="ret-overdue-header">
          <span>⚠️ Overdue Alert</span>
          <span class="overdue-days-badge">${overdueDays} days late</span>
        </div>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:10px;">
          Return date was <b>${formatDate(booking.returnDate)}</b> — customer returned late.
        </div>
        <div class="ret-overdue-suggest">
          Suggested Penalty (${overdueDays} days × ₹${dailyTotal}/day × ${penPct}%) = <b>₹${suggested}</b>
        </div>
        <div class="form-group" style="margin-top:10px;margin-bottom:0;">
          <label class="form-label" style="color:var(--danger);">Overdue Penalty (₹) — Admin can change</label>
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
        <div class="return-modal-title">✅ Mark Bartan Returned</div>
        <div class="return-modal-sub">${booking.customerName} &nbsp;|&nbsp; ${booking.receiptNo}</div>
      </div>

      <div class="ret-section-label">🪣 Item Checklist — Check each bartan</div>
      <div id="ret-items-list">${itemRows}</div>

      ${overdueSection}

      <div class="ret-total-bar">
        <span>Total Penalty</span>
        <span class="ret-total-val" id="ret-grand-penalty">₹0</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text-hint);padding:0 4px 12px;">
        💡 Penalty will be added to the customer's pending bill automatically.
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

function togglePenaltyInput(idx, defaultDamage = 0, defaultMissing = 0) {
  const status = document.getElementById('ret-status-' + idx)?.value;
  const box    = document.getElementById('ret-penalty-box-' + idx);
  if (box) box.style.display = (status !== 'ok') ? 'block' : 'none';
  const inp = document.getElementById('ret-penalty-' + idx);
  if (inp) {
    if (status === 'damaged') inp.value = defaultDamage  || '';
    else if (status === 'missing') inp.value = defaultMissing || '';
    else inp.value = '';
  }
  updateReturnTotal();
}

function validateReturnQty(idx, max) {
  const inp = document.getElementById('ret-qty-' + idx);
  if (inp) {
    let val = parseInt(inp.value);
    if (isNaN(val) || val < 0) inp.value = 0;
    if (val > max) inp.value = max;
  }
}

function updateReturnTotal() {
  let total = 0;
  document.querySelectorAll('.ret-penalty-input').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  const op = document.getElementById('ret-overdue-penalty');
  if (op) total += parseFloat(op.value) || 0;

  const el = document.getElementById('ret-grand-penalty');
  if (el) el.textContent = '\u20B9' + total.toLocaleString('en-IN');
}

async function confirmReturnWithPenalty(bookingId) {
  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  const pendingItems = (booking.items || []).filter(i => i.nag - (i.returnedQty || 0) > 0);

  const newPenaltyDetails = [];
  let isFullyReturned = true; // Assume true, verify later
  let hasValidReturn = false; 
  
  // Using traditional for loop to allow async inventory updates
  for (let idx = 0; idx < pendingItems.length; idx++) {
    const item = pendingItems[idx];
    const qtyInput = document.getElementById('ret-qty-' + idx);
    let returningNow = 0;
    if (qtyInput) {
       returningNow = parseInt(qtyInput.value) || 0;
       const maxPending = item.nag - (item.returnedQty || 0);
       if (returningNow > maxPending) returningNow = maxPending;
    }
    
    if (returningNow > 0) {
      hasValidReturn = true;
      item.returnedQty = (item.returnedQty || 0) + returningNow;
      
      const status  = document.getElementById('ret-status-' + idx)?.value || 'ok';
      const penalty = parseFloat(document.getElementById('ret-penalty-' + idx)?.value) || 0;
      
      if (status !== 'ok') {
        newPenaltyDetails.push({ itemName: `${item.name} (${returningNow}pcs)`, type: status, amount: penalty });
        // Update inventory missing count
        if (status === 'missing' && item.inventoryId) {
          const inv = await BartanDB.get(BartanDB.STORES.INVENTORY, item.inventoryId);
          if (inv) {
            inv.missingCount = (inv.missingCount || 0) + returningNow;
            await BartanDB.put(BartanDB.STORES.INVENTORY, inv);
          }
        }
      }
      
      // Restore inventory available stock ONLY if not missing
      if (status !== 'missing' && item.inventoryId) {
        const inv = await BartanDB.get(BartanDB.STORES.INVENTORY, item.inventoryId);
        if (inv) {
          inv.availableStock = (inv.availableStock || 0) + returningNow;
          await BartanDB.put(BartanDB.STORES.INVENTORY, inv);
        }
      }
    }
  }

  // Check if ALL items in booking are now fully returned
  for (const item of (booking.items || [])) {
    if (item.nag > 0 && item.nag - (item.returnedQty || 0) > 0) {
      isFullyReturned = false;
      break;
    }
  }

  const overduePenalty = parseFloat(document.getElementById('ret-overdue-penalty')?.value) || 0;
  const overdueDays    = getOverdueDays(booking); // calculate once
  const currentPenalty = newPenaltyDetails.reduce((s, p) => s + p.amount, 0) + overduePenalty;

  // Append new penalties to existing ones
  booking.penalty = (booking.penalty || 0) + currentPenalty;
  booking.penaltyDetails = (booking.penaltyDetails || []).concat(newPenaltyDetails);
  booking.overduePenalty = (booking.overduePenalty || 0) + overduePenalty;
  // keep highest overdueDays recorded
  booking.overdueDays = Math.max((booking.overdueDays || 0), overdueDays);

  if (currentPenalty > 0) {
    booking.pendingAmount = (booking.pendingAmount || 0) + currentPenalty;
    booking.totalAmount   = (booking.totalAmount   || 0) + currentPenalty;
  }

  if (isFullyReturned) {
    booking.status       = 'returned';
    booking.returnedAt   = new Date().toISOString();
  }

  await BartanDB.put(BartanDB.STORES.BOOKINGS, booking);
  closeReturnModal();

  const penMsg = currentPenalty > 0 ? ` Penalty: \u20B9${currentPenalty} added!` : '';
  if (isFullyReturned) {
    showToast('\u2705 All Bartan completely returned!' + penMsg);
  } else {
    showToast(hasValidReturn ? `\u2705 Partial return processed!${penMsg}` : `No items returned.`);
  }
  
  openBookingDetail(bookingId);
}

// ============================================
// DELETE BOOKING
// ============================================
function confirmDeleteBooking(bookingId) {
  showConfirmModal(
    '🗑️ Delete Booking',
    'Are you sure? This booking will be permanently deleted!',
    async () => {
      await deleteBooking(bookingId);
      navigateTo('bookings');
    },
    true
  );
}

// ============================================
// PAYMENT MODAL
// ============================================
async function openPaymentModal(bookingId) {
  const existing = document.getElementById('payment-modal');
  if (existing) existing.remove();

  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  if (!booking) return;

  const total = booking.totalAmount || 0;
  const pending = booking.pendingAmount || 0;
  const paid = total - pending;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'payment-modal';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">💰 Record Payment</div>
      
      <div style="background:var(--bg-card); padding:10px; border-radius:8px; margin-bottom:15px; font-size:0.85rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:var(--text-secondary);">Total Bill:</span>
          <span style="font-weight:bold;">₹${total}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:var(--success);">Amount Paid:</span>
          <span style="font-weight:bold; color:var(--success);">₹${paid}</span>
        </div>
        <div style="display:flex; justify-content:space-between; border-top:1px dashed var(--border); padding-top:4px; margin-top:4px;">
          <span style="color:var(--danger); font-weight:bold;">Pending:</span>
          <span style="font-weight:bold; color:var(--danger);">₹${pending}</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" style="font-weight:600;">Amount Receiving Now (₹)</label>
        <input type="number" class="form-control" id="pay-amount"
          value="${pending}" min="1" max="${pending}" inputmode="numeric" style="font-size:1.1rem; font-weight:bold; padding:8px;" />
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

  overlay.addEventListener('click', e => { if (e.target === overlay) closePaymentModal(); });
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('pay-amount')?.focus(), 300);
}

function updateModeLabel() {
  const cashLabel = document.getElementById('mode-cash-label');
  const upiLabel  = document.getElementById('mode-upi-label');
  if (document.getElementById('mode-cash')?.checked) {
    cashLabel.classList.add('active');
    upiLabel.classList.remove('active');
  } else {
    upiLabel.classList.add('active');
    cashLabel.classList.remove('active');
  }
}

function closePaymentModal() {
  const m = document.getElementById('payment-modal');
  if (m) m.remove();
}

async function savePayment(bookingId) {
  const amountInput = document.getElementById('pay-amount');
  const amount      = parseFloat(amountInput?.value) || 0;
  const mode        = document.querySelector('input[name="pay-mode-modal"]:checked')?.value || 'cash';

  if (amount <= 0) { showToast('⚠️ Enter a valid amount!'); return; }

  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  const paid    = Math.min(amount, booking.pendingAmount);

  await BartanDB.add(BartanDB.STORES.PAYMENTS, {
    bookingId,
    amount:      paid,
    mode,
    paymentDate: new Date().toISOString(),
  });

  booking.pendingAmount = Math.max(0, booking.pendingAmount - paid);
  await BartanDB.put(BartanDB.STORES.BOOKINGS, booking);

  closePaymentModal();
  showToast(`✅ ${formatCurrency(paid)} payment recorded!`);
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
        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok-btn">Yes, Confirm!</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirmModal(); });
  document.body.appendChild(overlay);
  document.getElementById('confirm-ok-btn').addEventListener('click', () => {
    closeConfirmModal();
    onConfirm();
  });
}

function closeConfirmModal() {
  const m = document.getElementById('confirm-modal');
  if (m) m.remove();
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
  const tbody     = document.getElementById('nb-bartan-rows');
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
          oninput="updateRowTotal(${item.id})"
          style="width:52px;" inputmode="numeric" />
      </td>
      <td>
        <div style="display:flex;align-items:center;">
          ₹<input type="number" min="0" id="rate-${item.id}" value="${item.ratePerDay}" oninput="updateRowTotal(${item.id})" style="width:52px;margin-left:2px;font-size:0.8rem;padding:6px 4px;" inputmode="numeric" />
        </div>
      </td>
      <td class="row-total" id="rakam-${item.id}">₹0</td>
    </tr>`;
  }).join('');
}

function updateDays() {
  const bookingDt = document.getElementById('nb-booking-dt').value;
  const returnDt  = document.getElementById('nb-return-dt').value;
  if (!bookingDt || !returnDt) return;

  const diff = Math.ceil((new Date(returnDt) - new Date(bookingDt)) / (1000 * 60 * 60 * 24));
  const days = Math.max(1, diff);
  document.getElementById('nb-days').textContent = `${days} days`;
  
  const rows = document.querySelectorAll('[id^="nag-"]');
  rows.forEach(input => {
    const invId = input.id.split('-')[1];
    updateRowTotal(invId);
  });
}

function updateRowTotal(invId) {
  const nagInput  = document.getElementById(`nag-${invId}`);
  const rateInput = document.getElementById(`rate-${invId}`);
  const nag       = parseInt(nagInput.value) || 0;
  const rate      = parseFloat(rateInput?.value) || 0;
  const days      = getTotalDays();
  const rakam     = nag * rate * days;
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
  let total  = 0;
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
      document.getElementById('nb-name').value   = c.name       || '';
      document.getElementById('nb-father').value = c.fatherName || '';
      showToast('✅ Customer found — details filled!');
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
    showToast('⚠️ Name and dates are required!'); return;
  }
  if (mobile && mobile.length !== 10) {
    showToast('⚠️ Mobile number must be 10 digits!'); return;
  }

  const days      = getTotalDays();
  const inventory = await BartanDB.getAll(BartanDB.STORES.INVENTORY);

  const items = [];
  let totalAmount = 0;
  for (const inv of inventory) {
    const nag = parseInt(document.getElementById(`nag-${inv.id}`)?.value) || 0;
    if (nag > 0) {
      if (nag > (inv.availableStock || 0)) {
        showToast(`⚠️ ${inv.name} — only ${inv.availableStock} available!`);
        return;
      }
      const customRate = parseFloat(document.getElementById(`rate-${inv.id}`)?.value) || 0;
      const rakam = nag * customRate * days;
      items.push({ inventoryId: inv.id, name: inv.name, nag, ratePerDay: customRate, rakam });
      totalAmount += rakam;

      inv.availableStock = Math.max(0, (inv.availableStock || 0) - nag);
      await BartanDB.put(BartanDB.STORES.INVENTORY, inv);
    }
  }

  if (items.length === 0) {
    showToast('⚠️ Select at least one bartan!'); return;
  }

  let customerId = null;
  try {
    if (mobile) {
      const existing = await BartanDB.getByIndex(BartanDB.STORES.CUSTOMERS, 'mobile', mobile);
      if (existing.length > 0) {
        customerId = existing[0].id;
        const cust = existing[0];
        if (cust.name !== name || cust.fatherName !== father) {
          cust.name       = name;
          cust.fatherName = father;
          await BartanDB.put(BartanDB.STORES.CUSTOMERS, cust);
        }
      } else {
        customerId = await BartanDB.add(BartanDB.STORES.CUSTOMERS, { name, fatherName: father, mobile });
      }
    }
  } catch(e) {}

  const receiptNo    = await BartanDB.generateReceiptNo();
  const pendingAmount = Math.max(0, totalAmount - advance);

  const bookingId = await BartanDB.add(BartanDB.STORES.BOOKINGS, {
    customerId,
    customerName: name,
    fatherName:   father,
    mobile,
    bookingDate:  bookDt,
    returnDate:   retDt,
    totalDays:    days,
    items,
    totalAmount,
    pendingAmount,
    receiptNo,
    status:       'active',
    notes,
    createdAt:    new Date().toISOString(),
  });

  if (advance > 0) {
    await BartanDB.add(BartanDB.STORES.PAYMENTS, {
      bookingId,
      amount:      advance,
      mode:        payMode,
      paymentDate: new Date().toISOString(),
    });
  }

  showToast(`✅ Booking saved! Receipt: ${receiptNo}`);
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
        <p>No customers found</p>
      </div>`;
    return;
  }
  container.innerHTML = customers.map(c => `
    <div class="booking-item" onclick="openCustomerDetail(${c.id})">
      <div class="b-top">
        <span class="b-name">${c.name}</span>
        <span class="b-receipt">${c.mobile || ''}</span>
      </div>
      <div class="b-info">Father: ${c.fatherName || '-'}</div>
    </div>`).join('');
}

function searchCustomers(query) {
  const q        = query.toLowerCase();
  const filtered = allCustomersCache.filter(c =>
    (c.name       || '').toLowerCase().includes(q) ||
    (c.mobile     || '').includes(q) ||
    (c.fatherName || '').toLowerCase().includes(q)
  );
  renderCustomersList(filtered);
}

async function openCustomerDetail(customerId) {
  const customer = await BartanDB.get(BartanDB.STORES.CUSTOMERS, customerId);
  if (!customer) return;

  const allBookings  = await BartanDB.getByIndex(BartanDB.STORES.BOOKINGS, 'customerId', customerId);
  allBookings.reverse();

  const totalAmount  = allBookings.reduce((s, b) => s + (b.totalAmount  || 0), 0);
  const totalPending = allBookings.reduce((s, b) => s + (b.pendingAmount || 0), 0);
  const activeCount  = allBookings.filter(b => b.status === 'active').length;

  let bookingHTML = '';
  if (allBookings.length === 0) {
    bookingHTML = `<div class="empty-state" style="padding:20px;"><div class="empty-icon">📋</div><p>No bookings found</p></div>`;
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
          <div style="font-size:0.82rem;color:var(--text-secondary);">Father: ${customer.fatherName || '-'}</div>
          ${customer.mobile ? `<div style="font-size:0.82rem;color:var(--text-secondary);">📞 ${customer.mobile}</div>` : ''}
        </div>
      </div>
      <div class="divider"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;">
        <div style="text-align:center;">
          <div style="font-size:1.3rem;font-weight:800;color:var(--primary);">${allBookings.length}</div>
          <div style="font-size:0.7rem;color:var(--text-secondary);">Bookings</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.3rem;font-weight:800;color:var(--warning);">${activeCount}</div>
          <div style="font-size:0.7rem;color:var(--text-secondary);">Active</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1rem;font-weight:800;color:${totalPending > 0 ? 'var(--danger)' : 'var(--success)'};">
            ${totalPending > 0 ? formatCurrency(totalPending) : '✅'}
          </div>
          <div style="font-size:0.7rem;color:var(--text-secondary);">Balance</div>
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
// SETTINGS PAGE
// ============================================
async function loadSettingsPage() {
  const s = await BartanDB.getAllSettings();
  document.getElementById('set-business-name').value  = s.businessName  || '';
  document.getElementById('set-owner-name').value     = s.ownerName     || '';
  document.getElementById('set-phone').value          = s.phone         || '';
  document.getElementById('set-address').value        = s.address       || '';
  document.getElementById('set-penalty-pct').value    = s.penaltyPct    || '100';
  document.getElementById('set-damage-penalty').value = s.damagePenalty || '';
  document.getElementById('set-missing-penalty').value= s.missingPenalty|| '';
  document.getElementById('set-wa-footer').value      = s.waFooter      || '';
}

async function saveSettings() {
  const fields = {
    businessName:   document.getElementById('set-business-name').value.trim(),
    ownerName:      document.getElementById('set-owner-name').value.trim(),
    phone:          document.getElementById('set-phone').value.trim(),
    address:        document.getElementById('set-address').value.trim(),
    penaltyPct:     document.getElementById('set-penalty-pct').value,
    damagePenalty:  document.getElementById('set-damage-penalty').value,
    missingPenalty: document.getElementById('set-missing-penalty').value,
    waFooter:       document.getElementById('set-wa-footer').value.trim(),
  };

  for (const [key, value] of Object.entries(fields)) {
    await BartanDB.setSetting(key, value);
  }

  appSettings = fields;

  // Update header business name live
  const nameEl = document.getElementById('appBusinessName');
  if (nameEl) nameEl.textContent = fields.businessName || 'Shiv Shakti Bartan Kiraya';

  showToast('✅ Settings saved!');
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
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const local  = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function isOverdue(booking) {
  if (booking.status !== 'active') return false;
  const returnDate = new Date(booking.returnDate);
  const today      = new Date();
  today.setHours(0, 0, 0, 0);
  returnDate.setHours(0, 0, 0, 0);
  return returnDate < today;
}

function getOverdueDays(booking) {
  if (!isOverdue(booking)) return 0;
  const returnDate = new Date(booking.returnDate);
  const today      = new Date();
  today.setHours(0, 0, 0, 0);
  returnDate.setHours(0, 0, 0, 0);
  return Math.floor((today - returnDate) / (1000 * 60 * 60 * 24));
}

function formatItemsSummary(items) {
  return items
    .filter(i => i.nag > 0)
    .map(i => `${i.name}: ${i.nag}`)
    .join(', ');
}

// ============================================
// LANGUAGE MODAL & TRANSLATION
// ============================================
function openLanguageModal() {
  const existing = document.getElementById('lang-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'lang-modal';
  
  // List of supported Indian languages
  const langs = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिंदी' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', native: 'മലയാളം' }
  ];
  
  let buttonsHtml = '';
  langs.forEach(l => {
    buttonsHtml += `
      <button class="btn btn-outline" style="width:100%; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;" onclick="changeLanguage('${l.code}')">
        <span style="font-size:1.1rem; font-weight:bold;">${l.native}</span>
        <span style="font-size:0.85rem; color:var(--text-secondary);">${l.name}</span>
      </button>
    `;
  });

  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">🌐 Select Language</div>
      <div style="max-height: 60vh; overflow-y: auto; padding-right: 4px;">
        ${buttonsHtml}
      </div>
      <div class="btn-row" style="margin-top: 10px;">
        <button class="btn btn-outline" onclick="closeLanguageModal()">Cancel</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeLanguageModal(); });
  document.body.appendChild(overlay);
}

function closeLanguageModal() {
  const m = document.getElementById('lang-modal');
  if (m) m.remove();
}

function changeLanguage(langCode) {
  const select = document.querySelector('select.goog-te-combo');
  if (select) {
    select.value = langCode;
    select.dispatchEvent(new Event('change'));
    showToast('🌐 Language Updated!');
  } else {
    showToast('⏳ Loading languages, please wait...');
    setTimeout(() => changeLanguage(langCode), 1000);
    return;
  }
  closeLanguageModal();
}

// ============================================
// APP STARTUP
// ============================================
async function startApp() {
  try {
    await BartanDB.init();

    // Load settings globally
    appSettings = await BartanDB.getAllSettings();

    // Update header business name
    const nameEl = document.getElementById('appBusinessName');
    if (nameEl && appSettings.businessName) {
      nameEl.textContent = appSettings.businessName;
    }

    navigateTo('dashboard');

    // Date change listeners
    document.getElementById('nb-booking-dt').addEventListener('change', updateDays);
    document.getElementById('nb-return-dt').addEventListener('change', updateDays);

    // Due date check on open
    setTimeout(() => checkDueDateAlerts(false), 1500);

    // Splash screen logic
    const hideSplash = () => {
      const splash = document.getElementById('splash-screen');
      if (splash) {
        splash.classList.add('splash-hidden');
        setTimeout(() => splash.remove(), 600);
      }
    };

    if (document.readyState === 'complete') {
      setTimeout(hideSplash, 600);
    } else {
      window.addEventListener('load', () => setTimeout(hideSplash, 600));
      // Fallback just in case load event takes too long or fails
      setTimeout(hideSplash, 3000); 
    }

    console.log('✅ Bartan Kiraya App v4 started!');
  } catch (err) {
    console.error('❌ App start failed:', err);
    showToast('❌ App failed to start!');
    
    // Hide splash screen even on error so user can see what's wrong
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.classList.add('splash-hidden');
      setTimeout(() => splash.remove(), 600);
    }
  }
}

document.addEventListener('DOMContentLoaded', startApp);