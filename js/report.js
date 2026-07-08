// ============================================
// report.js — Yearly / Monthly Print Report
// ============================================

async function loadReportPage() {
  // Populate year dropdown based on both Bartan and Sarai bookings
  const bookings = await BartanDB.getAll(BartanDB.STORES.BOOKINGS);
  const saraiBookings = await BartanDB.getAll(BartanDB.STORES.SARAI_BOOKINGS);
  
  const years = new Set();
  bookings.forEach(b => years.add(new Date(b.bookingDate).getFullYear()));
  saraiBookings.forEach(b => years.add(new Date(b.bookingDate).getFullYear()));
  years.add(new Date().getFullYear());
  
  const yearsArr = [...years].sort((a, b) => b - a);

  const yearSelect = document.getElementById('report-year');
  yearSelect.innerHTML = yearsArr.map(y => `<option value="${y}">${y}</option>`).join('');

  await loadReport();
}

async function loadReport() {
  const year  = parseInt(document.getElementById('report-year').value);
  const month = document.getElementById('report-month').value;

  const [bookings, payments, saraiBookingsAll] = await Promise.all([
    BartanDB.getAll(BartanDB.STORES.BOOKINGS),
    BartanDB.getAll(BartanDB.STORES.PAYMENTS),
    BartanDB.getAll(BartanDB.STORES.SARAI_BOOKINGS)
  ]);

  // Filter by year and optionally month
  const filteredBartan = bookings.filter(b => {
    const d = new Date(b.bookingDate);
    if (d.getFullYear() !== year) return false;
    if (month !== '' && d.getMonth() !== parseInt(month)) return false;
    return true;
  });

  const filteredSarai = saraiBookingsAll.filter(b => {
    if (b.status === 'cancelled') return false;
    const d = new Date(b.bookingDate);
    if (d.getFullYear() !== year) return false;
    if (month !== '' && d.getMonth() !== parseInt(month)) return false;
    return true;
  });

  // --- BARTAN STATS ---
  const bTotalBookings  = filteredBartan.length;
  const bTotalAmount    = filteredBartan.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const bTotalPending   = filteredBartan.reduce((s, b) => s + (b.pendingAmount || 0), 0);
  const bTotalCollected = bTotalAmount - bTotalPending;
  const bReturned       = filteredBartan.filter(b => b.status === 'returned').length;
  const bActive         = filteredBartan.filter(b => b.status === 'active').length;

  const bPenaltyBookings = filteredBartan.filter(b => (b.penalty || 0) > 0);
  const bTotalPenalty    = bPenaltyBookings.reduce((s, b) => s + (b.penalty || 0), 0);
  const bTotalOverduePenalty = bPenaltyBookings.reduce((s, b) => s + (b.overduePenalty || 0), 0);

  // --- SARAI STATS ---
  const sTotalBookings  = filteredSarai.length;
  const sTotalAmount    = filteredSarai.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const sTotalPending   = filteredSarai.reduce((s, b) => s + (b.pendingAmount || 0), 0);
  const sTotalCollected = sTotalAmount - sTotalPending;

  // --- GRAND TOTAL STATS ---
  const gTotalBookings  = bTotalBookings + sTotalBookings;
  const gTotalAmount    = bTotalAmount + sTotalAmount;
  const gTotalCollected = bTotalCollected + sTotalCollected;
  const gTotalPending   = bTotalPending + sTotalPending;

  // Month-wise breakdown (only for full year view)
  let monthTable = '';
  if (month === '') {
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const monthData = MONTHS.map((mName, idx) => {
      const mb = filteredBartan.filter(b => new Date(b.bookingDate).getMonth() === idx);
      const ms = filteredSarai.filter(b => new Date(b.bookingDate).getMonth() === idx);
      
      const bAmt = mb.reduce((s, b) => s + (b.totalAmount || 0), 0);
      const bCol = mb.reduce((s, b) => s + ((b.totalAmount || 0) - (b.pendingAmount || 0)), 0);
      
      const sAmt = ms.reduce((s, b) => s + (b.totalAmount || 0), 0);
      const sCol = ms.reduce((s, b) => s + ((b.totalAmount || 0) - (b.pendingAmount || 0)), 0);
      
      return {
        name: mName,
        count: mb.length + ms.length,
        amount: bAmt + sAmt,
        collected: bCol + sCol,
      };
    }).filter(m => m.count > 0);

    if (monthData.length > 0) {
      monthTable = `
        <div class="card" style="margin-top:14px;">
          <div class="card-title">Month-wise Breakdown (Grand Total)</div>
          <table class="bartan-table" style="width:100%;">
            <thead>
              <tr>
                <th>Month</th>
                <th style="text-align:right;">Bookings</th>
                <th style="text-align:right;">Total ₹</th>
                <th style="text-align:right;">Collected ₹</th>
              </tr>
            </thead>
            <tbody>
              ${monthData.map(m => `
                <tr>
                  <td style="font-weight:600;">${m.name}</td>
                  <td style="text-align:right;">${m.count}</td>
                  <td style="text-align:right;">₹${m.amount.toLocaleString('en-IN')}</td>
                  <td style="text-align:right;color:var(--success);font-weight:700;">
                    ₹${m.collected.toLocaleString('en-IN')}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
  }

  // Booking detail table (Bartan)
  const bartanBookingRows = await Promise.all(filteredBartan.map(async b => {
    const c = b.customerId ? await BartanDB.get(BartanDB.STORES.CUSTOMERS, b.customerId) : null;
    return `
      <tr>
        <td>${b.receiptNo || '-'}</td>
        <td style="font-weight:600;">${c?.name || b.customerName || '-'}</td>
        <td>${c?.mobile || b.mobile || '-'}</td>
        <td>${new Date(b.bookingDate).toLocaleDateString('en-IN')}</td>
        <td>${new Date(b.returnDate).toLocaleDateString('en-IN')}</td>
        <td style="text-align:right;">₹${(b.totalAmount||0).toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:${b.pendingAmount > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:700;">
          ${b.pendingAmount > 0 ? '₹'+b.pendingAmount.toLocaleString('en-IN') : '✅ Paid'}
        </td>
        <td>
          <span class="badge ${b.status === 'active' ? 'badge-active' : 'badge-returned'}">
            ${b.status === 'active' ? 'Active' : 'Returned'}
          </span>
        </td>
      </tr>`;
  }));

  // Sarai Booking Rows
  const saraiBookingRows = await Promise.all(filteredSarai.map(async b => {
    const c = b.customerId ? await BartanDB.get(BartanDB.STORES.CUSTOMERS, b.customerId) : null;
    return `
      <tr>
        <td style="font-weight:600;">${c?.name || b.customerName || '-'}</td>
        <td>${c?.mobile || b.mobile || '-'}</td>
        <td>${new Date(b.fromDate).toLocaleDateString('en-IN')}</td>
        <td>${new Date(b.toDate).toLocaleDateString('en-IN')}</td>
        <td style="text-align:right;">₹${(b.totalAmount||0).toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:${b.pendingAmount > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:700;">
          ${b.pendingAmount > 0 ? '₹'+b.pendingAmount.toLocaleString('en-IN') : '✅ Paid'}
        </td>
        <td>
          <span class="badge ${b.status === 'active' ? 'badge-active' : (b.status === 'completed' ? 'badge-returned' : 'badge-danger')}">
            ${b.status.toUpperCase()}
          </span>
        </td>
      </tr>`;
  }));

  const periodLabel = month !== ''
    ? `${['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(month)]} ${year}`
    : `Poora Saal ${year}`;

  document.getElementById('report-output').innerHTML = `

    <!-- Print Header -->
    <div style="text-align:center;margin-bottom:16px;" class="print-only" style="display:none;">
      <div style="font-size:1.1rem;font-weight:800;">|| Shri Ganeshaya Namah ||</div>
      <div style="font-size:1.3rem;font-weight:800;margin:4px 0;">
        Shri Shivshakti Ghanavar Teli Samaj Dharmshala
      </div>
      <div style="font-size:0.9rem;">Gaon- Baroda, Tehsil-Nimbaheda, Jila- Chittorgarh (Raj.)</div>
      <div style="font-size:1rem;font-weight:700;margin-top:8px;">
        Kiraya Report (Bartan + Sarai) — ${periodLabel}
      </div>
      <div style="font-size:0.82rem;color:#666;">
        Print Date: ${new Date().toLocaleDateString('en-IN')}
      </div>
    </div>

    <!-- GRAND TOTAL Cards -->
    <div class="card" style="border: 2px solid var(--primary);">
      <div class="card-title" style="color:var(--primary); font-size:1.1rem;">🏆 GRAND TOTAL (${periodLabel})</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Total Bookings (Bartan+Sarai)</div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--primary);">${gTotalBookings}</div>
        </div>
        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Overall Revenue</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--primary);">₹${gTotalAmount.toLocaleString('en-IN')}</div>
        </div>
        <div style="background:#E8F5E9;border-radius:10px;padding:12px;border:1px solid #C8E6C9;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Total Collected</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--success);">₹${gTotalCollected.toLocaleString('en-IN')}</div>
        </div>
        <div style="background:#FFEBEE;border-radius:10px;padding:12px;border:1px solid #FFCDD2;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Total Pending</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--danger);">₹${gTotalPending.toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>

    <!-- BARTAN Summary -->
    <div class="card">
      <div class="card-title">🪣 Bartan Summary</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Bartan Bookings</div>
          <div style="font-size:1.3rem;font-weight:800;">${bTotalBookings}</div>
        </div>
        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Bartan Amount</div>
          <div style="font-size:1.3rem;font-weight:800;">₹${bTotalAmount.toLocaleString('en-IN')}</div>
        </div>
        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Returned / Active</div>
          <div style="font-size:1.2rem;font-weight:800;"><span style="color:var(--success);">${bReturned}</span> / <span style="color:var(--warning);">${bActive}</span></div>
        </div>
        <div style="background:#FFEBEE;border-radius:10px;padding:12px;border:1px solid #FFCDD2;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Penalty Collected</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--danger);">₹${bTotalPenalty.toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>
    
    <!-- SARAI Summary -->
    <div class="card">
      <div class="card-title">🏨 Sarai Summary</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Sarai Bookings</div>
          <div style="font-size:1.3rem;font-weight:800;">${sTotalBookings}</div>
        </div>
        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Sarai Amount</div>
          <div style="font-size:1.3rem;font-weight:800;">₹${sTotalAmount.toLocaleString('en-IN')}</div>
        </div>
        <div style="background:#E8F5E9;border-radius:10px;padding:12px;border:1px solid #C8E6C9;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Collected</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--success);">₹${sTotalCollected.toLocaleString('en-IN')}</div>
        </div>
        <div style="background:#FFEBEE;border-radius:10px;padding:12px;border:1px solid #FFCDD2;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Pending</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--danger);">₹${sTotalPending.toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>

    ${monthTable}

    <!-- Penalty Report Table -->
    ${bPenaltyBookings.length > 0 ? `
    <div class="card" style="margin-top:14px;border:1.5px solid var(--danger);">
      <div class="card-title" style="color:var(--danger);">⚠️ Bartan Penalty Details</div>
      <div style="overflow-x:auto;">
        <table class="bartan-table" style="width:100%;">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Naam</th>
              <th>Wapsi Date</th>
              <th>Damage/Missing details</th>
              <th style="text-align:right;">Overdue Penalty</th>
              <th style="text-align:right;">Total Penalty</th>
            </tr>
          </thead>
          <tbody>
            ${bPenaltyBookings.map(b => {
              const itemPenFmt = (b.penaltyDetails || []).map(p => `${p.itemName} (${p.type === 'damaged' ? 'Damage' : 'Missing'}): ₹${p.amount}`).join(', ') || 'N/A';
              return `
                <tr>
                  <td>${b.receiptNo || '-'}</td>
                  <td style="font-weight:600;">${b.customerName || '-'}</td>
                  <td>${b.returnedAt ? new Date(b.returnedAt).toLocaleDateString('en-IN') : '-'}</td>
                  <td style="font-size:0.78rem;color:var(--text-secondary);max-width:200px;white-space:normal;">${itemPenFmt}</td>
                  <td style="text-align:right;color:var(--danger);font-weight:600;">₹${(b.overduePenalty || 0).toLocaleString('en-IN')}</td>
                  <td style="text-align:right;color:var(--danger);font-weight:700;">₹${(b.penalty || 0).toLocaleString('en-IN')}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- Sarai Booking Details Table -->
    ${filteredSarai.length > 0 ? `
    <div class="card" style="margin-top:14px;">
      <div class="card-title">🏨 Sarai Bookings List</div>
      <div style="overflow-x:auto;">
        <table class="bartan-table" style="width:100%;min-width:600px;">
          <thead>
            <tr>
              <th>Naam</th>
              <th>Mobile</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th style="text-align:right;">Amount</th>
              <th style="text-align:right;">Pending</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${saraiBookingRows.join('')}</tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- Bartan Booking Details Table -->
    ${filteredBartan.length > 0 ? `
    <div class="card" style="margin-top:14px;">
      <div class="card-title">🪣 Bartan Bookings List</div>
      <div style="overflow-x:auto;">
        <table class="bartan-table" style="width:100%;min-width:600px;">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Naam</th>
              <th>Mobile</th>
              <th>Booking Date</th>
              <th>Wapsi Date</th>
              <th style="text-align:right;">Amount</th>
              <th style="text-align:right;">Pending</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${bartanBookingRows.join('')}</tbody>
        </table>
      </div>
    </div>` : ''}

    ${(filteredBartan.length === 0 && filteredSarai.length === 0) ? `
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <p>Is period mein koi booking nahi mili</p>
    </div>` : ''}

    <!-- Print Footer -->
    <div style="margin-top:20px;text-align:center;font-size:0.8rem;color:var(--text-hint);">
      <div>H. Praaptakarta: ________________________</div>
      <div style="margin-top:8px;">Shri Shivshakti Ghanavar Teli Samaj Dharmshala</div>
    </div>
  `;
}