// ============================================
// report.js — Yearly / Monthly Print Report
// ============================================

async function loadReportPage() {
  // Populate year dropdown
  const bookings = await BartanDB.getAll(BartanDB.STORES.BOOKINGS);
  const years = [...new Set(bookings.map(b => new Date(b.bookingDate).getFullYear()))];
  if (!years.includes(new Date().getFullYear())) years.push(new Date().getFullYear());
  years.sort((a, b) => b - a);

  const yearSelect = document.getElementById('report-year');
  yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');

  await loadReport();
}

async function loadReport() {
  const year  = parseInt(document.getElementById('report-year').value);
  const month = document.getElementById('report-month').value;

  const [bookings, payments] = await Promise.all([
    BartanDB.getAll(BartanDB.STORES.BOOKINGS),
    BartanDB.getAll(BartanDB.STORES.PAYMENTS),
  ]);

  // Filter by year and optionally month
  const filtered = bookings.filter(b => {
    const d = new Date(b.bookingDate);
    if (d.getFullYear() !== year) return false;
    if (month !== '' && d.getMonth() !== parseInt(month)) return false;
    return true;
  });

  // Stats
  const totalBookings  = filtered.length;
  const totalAmount    = filtered.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalPending   = filtered.reduce((s, b) => s + (b.pendingAmount || 0), 0);
  const totalCollected = totalAmount - totalPending;
  const returned       = filtered.filter(b => b.status === 'returned').length;
  const active         = filtered.filter(b => b.status === 'active').length;

  // Penalty stats
  const penaltyBookings = filtered.filter(b => (b.penalty || 0) > 0);
  const totalPenalty    = penaltyBookings.reduce((s, b) => s + (b.penalty || 0), 0);
  const totalOverduePenalty = penaltyBookings.reduce((s, b) => s + (b.overduePenalty || 0), 0);
  const totalItemPenalty = totalPenalty - totalOverduePenalty;


  // Month-wise breakdown (only for full year view)
  let monthTable = '';
  if (month === '') {
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const monthData = MONTHS.map((mName, idx) => {
      const mb = filtered.filter(b => new Date(b.bookingDate).getMonth() === idx);
      return {
        name: mName,
        count: mb.length,
        amount: mb.reduce((s, b) => s + (b.totalAmount || 0), 0),
        collected: mb.reduce((s, b) => s + ((b.totalAmount || 0) - (b.pendingAmount || 0)), 0),
      };
    }).filter(m => m.count > 0);

    if (monthData.length > 0) {
      monthTable = `
        <div class="card" style="margin-top:14px;">
          <div class="card-title">Month-wise Breakdown</div>
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

  // Booking detail table
  const bookingRows = await Promise.all(filtered.map(async b => {
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
        Bartan Kiraya Report — ${periodLabel}
      </div>
      <div style="font-size:0.82rem;color:#666;">
        Print Date: ${new Date().toLocaleDateString('en-IN')}
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="card">
      <div class="card-title">📊 ${periodLabel} — Summary</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">

        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Total Bookings</div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--primary);">${totalBookings}</div>
        </div>

        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Total Amount</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--primary);">₹${totalAmount.toLocaleString('en-IN')}</div>
        </div>

        <div style="background:#E8F5E9;border-radius:10px;padding:12px;border:1px solid #C8E6C9;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Collected</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--success);">₹${totalCollected.toLocaleString('en-IN')}</div>
        </div>

        <div style="background:#FFEBEE;border-radius:10px;padding:12px;border:1px solid #FFCDD2;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Pending</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--danger);">₹${totalPending.toLocaleString('en-IN')}</div>
        </div>

        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Returned</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--success);">${returned}</div>
        </div>

        <div style="background:#FFF3E0;border-radius:10px;padding:12px;border:1px solid #FFE0B2;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Active</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--warning);">${active}</div>
        </div>

        <div style="background:#FFEBEE;border-radius:10px;padding:12px;border:1px solid #FFCDD2;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Total Penalty</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--danger);">₹${totalPenalty.toLocaleString('en-IN')}</div>
        </div>

        <div style="background:#F3E5F5;border-radius:10px;padding:12px;border:1px solid #E1BEE7;">
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Overdue Penalty</div>
          <div style="font-size:1.3rem;font-weight:800;color:#4A148C;">₹${totalOverduePenalty.toLocaleString('en-IN')}</div>
        </div>

      </div>
    </div>

    ${monthTable}

    <!-- Penalty Report Table -->
    ${penaltyBookings.length > 0 ? `
    <div class="card" style="margin-top:14px;border:1.5px solid var(--danger);">
      <div class="card-title" style="color:var(--danger);">&#9888;&#65039; Penalty Report (Charged Details)</div>
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
            ${penaltyBookings.map(b => {
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

    <!-- Booking Details Table -->
    ${filtered.length > 0 ? `
    <div class="card" style="margin-top:14px;">
      <div class="card-title">Booking Details</div>
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
          <tbody>${bookingRows.join('')}</tbody>
        </table>
      </div>
    </div>` : `
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <p>Is period mein koi booking nahi mili</p>
    </div>`}

    <!-- Print Footer -->
    <div style="margin-top:20px;text-align:center;font-size:0.8rem;color:var(--text-hint);">
      <div>H. Praaptakarta: ________________________</div>
      <div style="margin-top:8px;">Shri Shivshakti Ghanavar Teli Samaj Dharmshala</div>
    </div>
  `;
}