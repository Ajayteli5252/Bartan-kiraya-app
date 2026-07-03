// ============================================
// booking.js — Booking Helper Functions
// ============================================

// Calculate total amount for a booking
function calculateBookingTotal(items, totalDays) {
  return items.reduce((sum, item) => {
    return sum + (item.nag * item.ratePerDay * totalDays);
  }, 0);
}

// Calculate number of days between two dates
function calculateDays(bookingDate, returnDate) {
  const diff = Math.ceil(
    (new Date(returnDate) - new Date(bookingDate)) / (1000 * 60 * 60 * 24)
  );
  return Math.max(1, diff);
}

// Check if a booking is overdue (return date passed but still active)
function isOverdue(booking) {
  if (booking.status !== 'active') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const returnDate = new Date(booking.returnDate);
  returnDate.setHours(0, 0, 0, 0);
  return returnDate < today;
}

// Get overdue days count
function getOverdueDays(booking) {
  if (!isOverdue(booking)) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const returnDate = new Date(booking.returnDate);
  returnDate.setHours(0, 0, 0, 0);
  return Math.ceil((today - returnDate) / (1000 * 60 * 60 * 24));
}

// Format booking items summary (e.g. "Drum x2, Balti x5")
function formatItemsSummary(items) {
  return items
    .filter(i => i.nag > 0)
    .map(i => `${i.name.split('(')[0].trim()} x${i.nag}`)
    .join(', ');
}

// Get all overdue active bookings
async function getOverdueBookings() {
  const bookings = await BartanDB.getAll(BartanDB.STORES.BOOKINGS);
  return bookings.filter(b => isOverdue(b));
}

// Get bookings due today
async function getBookingsDueToday() {
  const bookings = await BartanDB.getAll(BartanDB.STORES.BOOKINGS);
  const todayStr = new Date().toISOString().split('T')[0];
  return bookings.filter(b => b.status === 'active' && b.returnDate === todayStr);
}

// Get bookings due in next N days
async function getUpcomingDueBookings(days = 3) {
  const bookings = await BartanDB.getAll(BartanDB.STORES.BOOKINGS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = new Date(today);
  future.setDate(future.getDate() + days);

  return bookings.filter(b => {
    if (b.status !== 'active') return false;
    const ret = new Date(b.returnDate);
    ret.setHours(0, 0, 0, 0);
    return ret >= today && ret <= future;
  });
}

// Delete a booking (and restore inventory stock)
async function deleteBooking(bookingId) {
  const booking = await BartanDB.get(BartanDB.STORES.BOOKINGS, bookingId);
  if (!booking) return;

  // Restore stock only if still active
  if (booking.status === 'active') {
    for (const item of (booking.items || [])) {
      if (item.nag > 0 && item.inventoryId) {
        const inv = await BartanDB.get(BartanDB.STORES.INVENTORY, item.inventoryId);
        if (inv) {
          inv.availableStock = (inv.availableStock || 0) + item.nag;
          await BartanDB.put(BartanDB.STORES.INVENTORY, inv);
        }
      }
    }
  }

  // Delete related payments
  const payments = await BartanDB.getByIndex(BartanDB.STORES.PAYMENTS, 'bookingId', bookingId);
  for (const p of payments) {
    await BartanDB.delete(BartanDB.STORES.PAYMENTS, p.id);
  }

  await BartanDB.delete(BartanDB.STORES.BOOKINGS, bookingId);
  showToast('🗑️ Booking deleted successfully!');
}