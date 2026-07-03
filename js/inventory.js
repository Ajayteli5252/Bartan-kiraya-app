// ============================================
// inventory.js — Bartan Stock & Rate Management
// ============================================

async function loadInventoryPage() {
  const inventory = await BartanDB.getAll(BartanDB.STORES.INVENTORY);
  const container = document.getElementById('inventory-list');

  if (inventory.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🪣</div><p>Koi bartan nahi mila</p></div>`;
    return;
  }

  container.innerHTML = inventory.map(item => {
    const stockColor = item.availableStock === 0
      ? 'var(--danger)'
      : item.availableStock < 5
        ? 'var(--warning)'
        : 'var(--success)';

    return `
      <div class="inv-item" id="inv-item-${item.id}">
        <div style="flex:1;">
          <div class="inv-name">${item.name}</div>
          <div class="inv-stock">
            Stock: <span style="color:${stockColor};font-weight:700;">${item.availableStock}</span>
            / ${item.totalStock} total
          </div>
        </div>
        <div class="inv-rate">₹${item.ratePerDay}/din</div>
        <button class="btn btn-outline btn-sm" onclick="openEditInventory(${item.id})">✏️ Edit</button>
      </div>`;
  }).join('');
}

// ============================================
// Open Edit Modal for a Bartan
// ============================================
async function openEditInventory(invId) {
  const item = await BartanDB.get(BartanDB.STORES.INVENTORY, invId);
  if (!item) return;

  // Create modal dynamically
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'inv-modal';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">✏️ ${item.name}</div>

      <div class="form-group">
        <label class="form-label">Total Stock (Kitne hain aapke paas)</label>
        <input type="number" class="form-control" id="inv-total-stock"
          value="${item.totalStock}" min="0" placeholder="e.g. 20" />
      </div>

      <div class="form-group">
        <label class="form-label">Available Stock (Abhi available)</label>
        <input type="number" class="form-control" id="inv-avail-stock"
          value="${item.availableStock}" min="0" placeholder="e.g. 20" />
      </div>

      <div class="form-group">
        <label class="form-label">Rate Per Day (₹ per din per piece)</label>
        <input type="number" class="form-control" id="inv-rate"
          value="${item.ratePerDay}" min="0" placeholder="e.g. 10" />
      </div>

      <div class="btn-row">
        <button class="btn btn-outline" onclick="closeInvModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveInventoryItem(${invId})">💾 Save</button>
      </div>
    </div>`;

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeInvModal();
  });

  document.body.appendChild(overlay);
}

function closeInvModal() {
  const modal = document.getElementById('inv-modal');
  if (modal) modal.remove();
}

async function saveInventoryItem(invId) {
  const item = await BartanDB.get(BartanDB.STORES.INVENTORY, invId);

  const totalStock = parseInt(document.getElementById('inv-total-stock').value) || 0;
  const availableStock = parseInt(document.getElementById('inv-avail-stock').value) || 0;
  const ratePerDay = parseFloat(document.getElementById('inv-rate').value) || 0;

  if (availableStock > totalStock) {
    showToast('⚠️ Available stock, total stock se zyada nahi ho sakta!');
    return;
  }

  item.totalStock = totalStock;
  item.availableStock = availableStock;
  item.ratePerDay = ratePerDay;

  await BartanDB.put(BartanDB.STORES.INVENTORY, item);
  closeInvModal();
  showToast('✅ Bartan update ho gaya!');
  await loadInventoryPage();
}