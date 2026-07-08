// ============================================
// sarai.js — Sarai (Hall) Booking Module v1
// ============================================

let allSaraiBookings = [];

async function loadSaraiData() {
  const bookings = await BartanDB.getAll(BartanDB.STORES.SARAI_BOOKINGS);
  allSaraiBookings = bookings.sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));
  renderSaraiList(allSaraiBookings);
  updateSaraiDashboard();
}

function renderSaraiList(bookings) {
  const list = document.getElementById('sarai-bookings-list');
  if (!list) return;

  if (bookings.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏰</div>
        <p>No Sarai Bookings found</p>
      </div>`;
    return;
  }

  let html = '';
  for (const b of bookings) {
    let badge = '';
    const today = new Date();
    today.setHours(0,0,0,0);
    const toDate = new Date(b.toDate);
    const fromDate = new Date(b.fromDate);
    
    if (b.status === 'completed') {
      badge = '<span class="badge badge-returned">Completed ✅</span>';
    } else if (b.status === 'cancelled') {
      badge = '<span class="badge badge-overdue" style="background:#e0e0e0;color:#666;">Cancelled</span>';
    } else {
      if (toDate < today) {
        badge = '<span class="badge badge-overdue">⚠️ Overdue</span>';
      } else if (fromDate <= today && toDate >= today) {
        badge = '<span class="badge badge-active">Active Now</span>';
      } else {
        badge = '<span class="badge" style="background:var(--primary);color:#fff;">Upcoming</span>';
      }
    }

    const pendingBadge = (b.pendingAmount || 0) > 0
      ? `<span class="b-pending">Due: ${formatCurrency(b.pendingAmount)}</span>`
      : `<span style="font-size:0.75rem;color:var(--success);font-weight:600;">✅ Paid</span>`;

    html += `
      <div class="booking-item" onclick="openSaraiDetail(${b.id})">
        <div class="b-top">
          <span class="b-name">${b.customerName || 'Unknown'}</span>
          ${badge}
        </div>
        <div class="b-info" style="font-size:0.85rem;color:var(--text-hint);margin-bottom:4px;">
          📅 ${formatDate(b.fromDate)} → ${formatDate(b.toDate)} &nbsp;|&nbsp; ${b.totalDays} days
        </div>
        <div class="b-bottom">
          <span class="b-amount">${formatCurrency(b.totalAmount || 0)}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            ${pendingBadge}
          </div>
        </div>
      </div>`;
  }
  list.innerHTML = html;
}

function updateSaraiDashboard() {
  const dashSarai = document.getElementById('dashboard-sarai-status');
  if (!dashSarai) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const activeToday = allSaraiBookings.find(b => 
    b.status === 'active' && 
    new Date(b.fromDate) <= today && 
    new Date(b.toDate) >= today
  );
  
  if (activeToday) {
    dashSarai.innerHTML = `
      <div style="background:var(--danger);color:#fff;padding:12px;border-radius:6px;font-weight:600;display:flex;justify-content:space-between;align-items:center;">
        <span>🔴 Booked Today! (${activeToday.customerName})</span>
        <button class="btn btn-outline btn-sm" style="background:#fff;color:var(--danger);border:none;padding:4px 8px;" onclick="openSaraiDetail(${activeToday.id})">View</button>
      </div>
    `;
  } else {
    const upcoming = allSaraiBookings.filter(b => b.status === 'active' && new Date(b.fromDate) > today)
                                     .sort((a,b) => new Date(a.fromDate) - new Date(b.fromDate))[0];
                                     
    if (upcoming) {
      dashSarai.innerHTML = `
        <div style="background:var(--success);color:#fff;padding:12px;border-radius:6px;font-weight:600;display:flex;justify-content:space-between;align-items:center;">
          <span>🟢 Available Today</span>
          <span style="font-size:0.8rem;opacity:0.9;">Next: ${formatDate(upcoming.fromDate)}</span>
        </div>
      `;
    } else {
      dashSarai.innerHTML = `
        <div style="background:var(--success);color:#fff;padding:12px;border-radius:6px;font-weight:600;display:flex;justify-content:space-between;align-items:center;">
          <span>🟢 Available Today</span>
          <span style="font-size:0.8rem;opacity:0.9;">No upcoming</span>
        </div>
      `;
    }
  }
}

async function startNewSaraiBooking() {
  document.getElementById('sarai-mobile').value = '';
  document.getElementById('sarai-name').value = '';
  document.getElementById('sarai-father').value = '';
  document.getElementById('sarai-address').value = '';
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('sarai-from-dt').value = today;
  document.getElementById('sarai-to-dt').value = today;
  document.getElementById('sarai-rate').value = '1100'; // default daily rate
  document.getElementById('sarai-advance').value = '0';
  document.getElementById('sarai-notes').value = '';
  
  // Load customers for datalist
  const customers = await BartanDB.getAll(BartanDB.STORES.CUSTOMERS);
  const dataList = document.getElementById('sarai-customer-list');
  dataList.innerHTML = '';
  customers.forEach(c => {
    const option = document.createElement('option');
    option.value = c.mobile;
    option.textContent = `${c.name} (${c.fatherName || '-'})`;
    dataList.appendChild(option);
  });
  
  calculateSaraiTotal();
  navigateTo('new-sarai-booking');
}

async function saraiMobileChanged(mobile) {
  if (mobile.length === 10) {
    const cust = await BartanDB.getByIndex(BartanDB.STORES.CUSTOMERS, 'mobile', mobile);
    if (cust && cust.length > 0) {
      document.getElementById('sarai-name').value = cust[0].name;
      document.getElementById('sarai-father').value = cust[0].fatherName || '';
      document.getElementById('sarai-address').value = cust[0].address || '';
    }
  }
}

function calculateSaraiTotal() {
  const fromDt = new Date(document.getElementById('sarai-from-dt').value);
  const toDt = new Date(document.getElementById('sarai-to-dt').value);
  const rate = parseFloat(document.getElementById('sarai-rate').value) || 0;
  
  if (isNaN(fromDt) || isNaN(toDt) || toDt < fromDt) {
    document.getElementById('sarai-total-calc').innerText = '₹0';
    return;
  }
  
  // +1 because same day = 1 day rent
  const diffTime = Math.abs(toDt - fromDt);
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const total = days * rate;
  
  document.getElementById('sarai-total-calc').innerHTML = `<b>${days} Days</b> x ₹${rate} = <b>₹${total}</b>`;
}

async function saveSaraiBooking() {
  const mobile   = document.getElementById('sarai-mobile').value.trim();
  const name     = document.getElementById('sarai-name').value.trim();
  const father   = document.getElementById('sarai-father').value.trim();
  const address  = document.getElementById('sarai-address').value.trim();
  const fromDate = document.getElementById('sarai-from-dt').value;
  const toDate   = document.getElementById('sarai-to-dt').value;
  const rate     = parseFloat(document.getElementById('sarai-rate').value) || 0;
  const advance  = parseFloat(document.getElementById('sarai-advance').value) || 0;
  const notes    = document.getElementById('sarai-notes').value.trim();

  if (!mobile || !name || !fromDate || !toDate) {
    showToast('⚠️ Please fill all required fields');
    return;
  }

  const fromDt = new Date(fromDate);
  const toDt = new Date(toDate);
  
  if (toDt < fromDt) {
    showToast('⚠️ To Date cannot be before From Date!');
    return;
  }
  
  fromDt.setHours(0,0,0,0);
  toDt.setHours(0,0,0,0);

  // Check Overlap
  const isOverlap = allSaraiBookings.some(b => {
    if (b.status !== 'active') return false;
    const bFrom = new Date(b.fromDate); bFrom.setHours(0,0,0,0);
    const bTo = new Date(b.toDate); bTo.setHours(0,0,0,0);
    // Overlap condition:
    return (fromDt <= bTo && toDt >= bFrom);
  });
  
  if (isOverlap) {
    showToast('⚠️ OVERLAP! Sarai is already booked on these dates!');
    return;
  }

  const days = Math.ceil((toDt - fromDt) / (1000 * 60 * 60 * 24)) + 1;
  const totalAmount = days * rate;
  const pendingAmount = totalAmount - advance;

  // Save Customer
  let customerId = null;
  let ex = await BartanDB.getByIndex(BartanDB.STORES.CUSTOMERS, 'mobile', mobile);
  if (ex && ex.length > 0) {
    customerId = ex[0].id;
    ex[0].name = name;
    ex[0].fatherName = father;
    ex[0].address = address;
    await BartanDB.put(BartanDB.STORES.CUSTOMERS, ex[0]);
  } else {
    customerId = await BartanDB.add(BartanDB.STORES.CUSTOMERS, {
      mobile, name, fatherName: father, address, createdAt: new Date()
    });
  }

  // Create Booking
  const receiptNo = "SR-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random()*9000)+1000);
  
  const booking = {
    receiptNo,
    customerId,
    customerName: name,
    mobile,
    fatherName: father,
    fromDate,
    toDate,
    totalDays: days,
    ratePerDay: rate,
    totalAmount,
    pendingAmount,
    advancePaid: advance,
    status: 'active',
    bookingDate: new Date().toISOString(),
    notes
  };

  const bId = await BartanDB.add(BartanDB.STORES.SARAI_BOOKINGS, booking);
  
  // Save Payment if advance given
  if (advance > 0) {
    await BartanDB.add(BartanDB.STORES.PAYMENTS, {
      bookingId: `sarai_${bId}`,
      amount: advance,
      mode: 'cash',
      paymentDate: new Date().toISOString()
    });
  }

  showToast('✅ Sarai Booked Successfully!');
  await loadSaraiData();
  openSaraiDetail(bId);
}

async function openSaraiDetail(id) {
  const booking = await BartanDB.get(BartanDB.STORES.SARAI_BOOKINGS, id);
  if (!booking) return;

  const customer = await BartanDB.get(BartanDB.STORES.CUSTOMERS, booking.customerId);
  const paidAmount = booking.totalAmount - booking.pendingAmount;

  // Load Payments
  const allPayments = await BartanDB.getByIndex(BartanDB.STORES.PAYMENTS, 'bookingId', `sarai_${id}`);
  let paymentRows = (allPayments || []).map(p => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:0.85rem;">${formatDateTime(p.paymentDate)} &nbsp;|&nbsp; Cash</span>
      <span style="font-weight:700;color:var(--success);">+${formatCurrency(p.amount)}</span>
    </div>`).join('');

  let statusBadge = '';
  if (booking.status === 'completed') {
    statusBadge = '<span class="badge badge-returned">Completed ✅</span>';
  } else if (booking.status === 'cancelled') {
    statusBadge = '<span class="badge badge-overdue" style="background:#e0e0e0;color:#666;">Cancelled</span>';
  } else {
    statusBadge = '<span class="badge badge-active">Active</span>';
  }

  document.getElementById('sarai-detail-content').innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;">${booking.customerName}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);">Mobile: ${booking.mobile}</div>
        </div>
        ${statusBadge}
      </div>
      <div class="divider"></div>
      <div style="font-size:0.85rem;color:var(--text-secondary);">
        Receipt: <b>${booking.receiptNo}</b><br/>
        From: <b style="color:var(--primary);">${formatDate(booking.fromDate)}</b><br/>
        To: <b style="color:var(--primary);">${formatDate(booking.toDate)}</b><br/>
        Rate: <b>₹${booking.ratePerDay} / day</b> &nbsp;|&nbsp; Days: <b>${booking.totalDays}</b>
      </div>
    </div>

    <div class="card">
      <div class="card-title">💰 Payment Details</div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="font-size:0.85rem;color:var(--text-secondary);">Total Rent</span>
        <span style="font-weight:700;">${formatCurrency(booking.totalAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="font-size:0.85rem;color:var(--text-secondary);">Paid Amount</span>
        <span style="font-weight:700;color:var(--success);">${formatCurrency(paidAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);margin-top:4px;">
        <span style="font-size:0.9rem;font-weight:700;">Pending Balance</span>
        <span style="font-weight:800;color:${booking.status === 'cancelled' ? 'var(--text-hint)' : (booking.pendingAmount > 0 ? 'var(--danger)' : 'var(--success)')};">
          ${booking.status === 'cancelled' ? 'Cancelled' : (booking.pendingAmount > 0 ? formatCurrency(booking.pendingAmount) : '✅ Fully Paid')}
        </span>
      </div>
      ${paymentRows ? `<div class="divider"></div><div class="card-title">Payment History</div>${paymentRows}` : ''}
    </div>
    
    ${booking.notes ? `<div class="card"><div class="card-title">Notes</div><p style="font-size:0.88rem;">${booking.notes}</p></div>` : ''}

    <div class="btn-row" style="margin-top:10px;">
      ${booking.pendingAmount > 0 ? `<button class="btn btn-success" onclick="openSaraiPaymentModal(${id})">💰 Add Payment</button>` : ''}
      ${booking.status === 'active' ? `<button class="btn btn-primary" onclick="markSaraiCompleted(${id})">&#9989; Mark Completed</button>` : ''}
    </div>
    <div class="btn-row" style="margin-top:10px;">
      <button class="btn btn-whatsapp" onclick="shareBookingWhatsApp(${id}, 'sarai')">💬 Share (Text)</button>
      <button class="btn btn-outline" style="color:var(--primary);border-color:var(--primary);" onclick="shareSaraiReceipt(${id})">📄 Share (PDF)</button>
    </div>
    <div class="btn-row" style="margin-top:10px;">
      <button class="btn btn-outline" onclick="navigateTo('sarai')">← Back to List</button>
      ${booking.status === 'active' ? `<button class="btn btn-danger" onclick="cancelSaraiBooking(${id})">Cancel</button>` : ''}
    </div>
    <div style="height:16px;"></div>
  `;

  navigateTo('sarai-detail');
}

async function markSaraiCompleted(id) {
  if (!confirm("Are you sure you want to mark this booking as COMPLETED?")) return;
  const booking = await BartanDB.get(BartanDB.STORES.SARAI_BOOKINGS, id);
  booking.status = 'completed';
  await BartanDB.put(BartanDB.STORES.SARAI_BOOKINGS, booking);
  showToast('✅ Sarai Booking Completed!');
  await loadSaraiData();
  openSaraiDetail(id);
}

async function cancelSaraiBooking(id) {
  if (!confirm("Cancel this booking? This cannot be undone.")) return;
  const booking = await BartanDB.get(BartanDB.STORES.SARAI_BOOKINGS, id);
  booking.status = 'cancelled';
  booking.totalAmount = 0; // Clear amount for cancelled bookings
  booking.pendingAmount = 0; // Clear pending amount if cancelled
  await BartanDB.put(BartanDB.STORES.SARAI_BOOKINGS, booking);
  showToast('✅ Sarai Booking Cancelled');
  await loadSaraiData();
  openSaraiDetail(id);
}

// Very simple payment modal for Sarai
function openSaraiPaymentModal(id) {
  const amount = prompt("Enter payment amount:");
  if (amount && !isNaN(amount)) {
    addSaraiPayment(id, parseFloat(amount));
  }
}

async function addSaraiPayment(id, amount) {
  if (amount <= 0) return;
  const booking = await BartanDB.get(BartanDB.STORES.SARAI_BOOKINGS, id);
  
  if (amount > booking.pendingAmount) {
    showToast('⚠️ Cannot pay more than pending amount!');
    return;
  }
  
  booking.pendingAmount -= amount;
  await BartanDB.put(BartanDB.STORES.SARAI_BOOKINGS, booking);
  
  await BartanDB.add(BartanDB.STORES.PAYMENTS, {
    bookingId: `sarai_${id}`,
    amount: amount,
    mode: 'cash',
    paymentDate: new Date().toISOString()
  });
  
  showToast('✅ Payment added successfully!');
  await loadSaraiData();
  openSaraiDetail(id);
}

async function shareSaraiReceipt(id) {
  const booking = await BartanDB.get(BartanDB.STORES.SARAI_BOOKINGS, id);
  if (!booking) return;

  const mobile = booking.mobile;
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
      format: 'a5'
    });

    const bizName = appSettings.businessName || "Shiv Shakti Bartan Kiraya";
    const ownerName = appSettings.ownerName || "";
    const phone = appSettings.phone || "";

    // Header Background
    doc.setFillColor(230, 81, 0); // Primary Theme Color (#E65100)
    doc.rect(0, 0, 148, 28, 'F');
    
    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(bizName, 74, 10, { align: "center" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let ownerInfo = [];
    if (ownerName) ownerInfo.push(`Prop: ${ownerName}`);
    if (phone) ownerInfo.push(`Mob: ${phone}`);
    if (ownerInfo.length > 0) {
      doc.text(ownerInfo.join("  |  "), 74, 16, { align: "center" });
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("SARAI BOOKING RECEIPT", 74, 23, { align: "center" });
    
    // Reset Text Color
    doc.setTextColor(0, 0, 0);
    
    // Outer Border
    doc.setDrawColor(200, 200, 200);
    doc.rect(5, 32, 138, 160);
    
    // Section: Booking Details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Booking Details", 10, 40);
    doc.setDrawColor(230, 230, 230);
    doc.line(10, 43, 138, 43);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Receipt No:`, 10, 50);
    doc.setFont("helvetica", "bold");
    doc.text(`${booking.receiptNo}`, 35, 50);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Customer Name:`, 10, 57);
    doc.setFont("helvetica", "bold");
    doc.text(`${booking.customerName}`, 40, 57);
    doc.setFont("helvetica", "normal");
    
    if(booking.mobile) {
      doc.text(`Mobile:`, 10, 64);
      doc.setFont("helvetica", "bold");
      doc.text(`${booking.mobile}`, 25, 64);
      doc.setFont("helvetica", "normal");
    }
    
    doc.line(10, 70, 138, 70);
    
    doc.text(`Booking Date:`, 10, 78);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatDate(booking.fromDate)}`, 35, 78);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Return Date:`, 75, 78);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatDate(booking.toDate)}`, 98, 78);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Total Days:`, 10, 85);
    doc.setFont("helvetica", "bold");
    doc.text(`${booking.totalDays}`, 32, 85);

    doc.setFont("helvetica", "normal");
    doc.text(`Rate per Day:`, 75, 85);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs ${booking.ratePerDay}`, 100, 85);

    // Section: Payment Summary
    doc.setFillColor(245, 245, 245);
    doc.rect(10, 95, 128, 40, 'F');
    
    doc.setFontSize(12);
    doc.text("Payment Summary", 15, 103);
    doc.line(15, 106, 133, 106);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Amount:`, 15, 114);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs ${booking.totalAmount}`, 133, 114, { align: "right" });
    
    const paid = booking.totalAmount - booking.pendingAmount;
    doc.setFont("helvetica", "normal");
    doc.text(`Amount Paid:`, 15, 121);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(46, 125, 50); // Green
    doc.text(`Rs ${paid}`, 133, 121, { align: "right" });
    
    doc.setTextColor(0, 0, 0); // Reset
    doc.setFont("helvetica", "bold");
    doc.text(`Balance Due:`, 15, 128);
    
    if (booking.pendingAmount > 0) {
      doc.setTextColor(198, 40, 40); // Red
    } else {
      doc.setTextColor(46, 125, 50); // Green
    }
    doc.text(`Rs ${booking.pendingAmount}`, 133, 128, { align: "right" });
    
    doc.setTextColor(0, 0, 0); // Reset

    // Footer Message
    doc.setFontSize(12);
    doc.setFont("helvetica", "italic");
    doc.text("Dhanyawad! Booking karne ke liye.", 74, 160, { align: "center" });
    
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sarai_Receipt_${booking.receiptNo}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('📥 PDF Downloaded. Please attach it manually in WhatsApp.');
    
    if (mobile) {
      let phone = mobile.replace(/\D/g, '');
      if (phone.length === 10) phone = '91' + phone;
      setTimeout(() => {
        window.open(`https://wa.me/${phone}?text=Dhanyawad ${booking.customerName}! Booking karne ke liye. Please check the downloaded PDF receipt for your Sarai booking.`, '_blank');
      }, 1000);
    }
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to generate PDF');
  }
}
