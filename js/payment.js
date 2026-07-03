// ============================================
// payment.js — Payment logic (handled in app.js)
// Additional payment utilities can be added here
// ============================================

// Get total paid amount for a booking
async function getTotalPaid(bookingId) {
  const payments = await BartanDB.getByIndex(BartanDB.STORES.PAYMENTS, 'bookingId', bookingId);
  return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
}