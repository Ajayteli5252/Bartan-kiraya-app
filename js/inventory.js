// ============================================
// inventory.js — Bartan Stock & Rate Management v4
// ============================================

async function loadInventoryPage() {
  const inventory = await BartanDB.getAll(BartanDB.STORES.INVENTORY);
  const container = document.getElementById('inventory-list');

  if (inventory.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🪣</div><p>No bartan found</p></div>`;
    return;
  }

  // Update global summary chips
  const totalAll   = inventory.reduce((s, i) => s + (i.totalStock    || 0), 0);
  const rentedAll  = inventory.reduce((s, i) => s + ((i.totalStock || 0) - (i.availableStock || 0)), 0);
  const availAll   = inventory.reduce((s, i) => s + (i.availableStock || 0), 0);
  const missingAll = inventory.reduce((s, i) => s + (i.missingCount  || 0), 0);

  const el = (id) => document.getElementById(id);
  if (el('inv-total-all'))   el('inv-total-all').textContent   = totalAll;
  if (el('inv-rented-all'))  el('inv-rented-all').textContent  = rentedAll;
  if (el('inv-avail-all'))   el('inv-avail-all').textContent   = availAll;
  if (el('inv-missing-all')) el('inv-missing-all').textContent = missingAll;

  container.innerHTML = inventory.map(item => {
    const total   = item.totalStock    || 0;
    const avail   = item.availableStock || 0;
    const rented  = total - avail;
    const missing = item.missingCount  || 0;

    const availColor = avail === 0   ? 'var(--danger)'
                     : avail < 5     ? 'var(--warning)'
                     : 'var(--success)';

    const missingChip = missing > 0
      ? `<span class="inv-stock-chip inv-chip-missing">❌ Missing: ${missing}</span>`
      : '';

    return `
      <div class="inv-item" id="inv-item-${item.id}">
        <div class="inv-item-top">
          <div class="inv-name">${item.name}</div>
          <div class="inv-rate">₹${item.ratePerDay}/day</div>
          <button class="btn btn-outline btn-sm" onclick="openEditInventory(${item.id})">✏️ Edit</button>
        </div>
        <div class="inv-stock-bar">
          <span class="inv-stock-chip inv-chip-total">📦 Total: ${total}</span>
          <span class="inv-stock-chip inv-chip-rented">🔴 Rented: ${rented}</span>
          <span class="inv-stock-chip inv-chip-avail" style="color:${availColor};">✅ Avail: ${avail}</span>
          ${missingChip}
        </div>
      </div>`;
  }).join('');
  
  container.innerHTML += `
    <div style="margin: 24px 16px; padding-bottom: 20px;">
      <button class="btn btn-primary" style="width:100%; border-radius:12px; padding:14px; font-weight:bold; font-size:1.05rem;" onclick="openAddInventoryModal()">➕ Add New Bartan</button>
    </div>
  `;
}

// ============================================
// Open Edit Modal for a Bartan
// ============================================
async function openEditInventory(invId) {
  const item = await BartanDB.get(BartanDB.STORES.INVENTORY, invId);
  if (!item) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'inv-modal';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">✏️ ${item.name}</div>

      <div class="form-group">
        <label class="form-label">Total Stock (How many you own)</label>
        <input type="number" class="form-control" id="inv-total-stock"
          value="${item.totalStock}" min="0" placeholder="e.g. 20" inputmode="numeric" />
      </div>

      <div class="form-group">
        <label class="form-label">Available Stock (Ready to rent)</label>
        <input type="number" class="form-control" id="inv-avail-stock"
          value="${item.availableStock}" min="0" placeholder="e.g. 20" inputmode="numeric" />
      </div>

      <div class="form-group">
        <label class="form-label">Missing Count (Lost / Not returned)</label>
        <input type="number" class="form-control" id="inv-missing-count"
          value="${item.missingCount || 0}" min="0" placeholder="0" inputmode="numeric" />
        <div style="font-size:0.72rem;color:var(--text-hint);margin-top:4px;">
          Track bartan that customers never returned.
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Rate Per Day (₹ per piece per day)</label>
        <input type="number" class="form-control" id="inv-rate"
          value="${item.ratePerDay}" min="0" placeholder="e.g. 10" inputmode="numeric" />
      </div>

      <div class="btn-row">
        <button class="btn btn-outline" onclick="closeInvModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveInventoryItem(${invId})">💾 Save</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => {
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

  const totalStock    = parseInt(document.getElementById('inv-total-stock').value)    || 0;
  const availableStock= parseInt(document.getElementById('inv-avail-stock').value)    || 0;
  const missingCount  = parseInt(document.getElementById('inv-missing-count').value)  || 0;
  const ratePerDay    = parseFloat(document.getElementById('inv-rate').value)         || 0;

  if (availableStock > totalStock) {
    showToast('⚠️ Available stock cannot exceed total stock!');
    return;
  }

  item.totalStock     = totalStock;
  item.availableStock = availableStock;
  item.missingCount   = missingCount;
  item.ratePerDay     = ratePerDay;

  await BartanDB.put(BartanDB.STORES.INVENTORY, item);
  closeInvModal();
  showToast('✅ Bartan updated!');
  await loadInventoryPage();
}

// ============================================
// Add New Bartan Modal
// ============================================
function openAddInventoryModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'inv-add-modal';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">➕ Add New Bartan</div>

      <div class="form-group">
        <label class="form-label">Bartan Name *</label>
        <input type="text" class="form-control" id="add-inv-name" placeholder="e.g. Kadai, Jug, etc." />
      </div>

      <div class="form-group">
        <label class="form-label">Total Stock (How many you own)</label>
        <input type="number" class="form-control" id="add-inv-total" value="0" min="0" inputmode="numeric" />
      </div>

      <div class="form-group">
        <label class="form-label">Rate Per Day (₹ per piece)</label>
        <input type="number" class="form-control" id="add-inv-rate" value="0" min="0" inputmode="numeric" />
      </div>

      <div class="btn-row">
        <button class="btn btn-outline" onclick="closeAddInvModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNewInventoryItem()">💾 Add Bartan</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeAddInvModal();
  });
  document.body.appendChild(overlay);
}

function closeAddInvModal() {
  const modal = document.getElementById('inv-add-modal');
  if (modal) modal.remove();
}

async function saveNewInventoryItem() {
  const name = document.getElementById('add-inv-name').value.trim();
  const total = parseInt(document.getElementById('add-inv-total').value) || 0;
  const rate = parseFloat(document.getElementById('add-inv-rate').value) || 0;

  if (!name) {
    showToast('⚠️ Please enter a bartan name!');
    return;
  }

  // Check if already exists
  const existing = await BartanDB.getAll(BartanDB.STORES.INVENTORY);
  if (existing.find(i => i.name.toLowerCase() === name.toLowerCase())) {
    showToast('⚠️ This bartan name already exists!');
    return;
  }

  await BartanDB.add(BartanDB.STORES.INVENTORY, {
    name: name,
    totalStock: total,
    availableStock: total, // new items start fully available
    ratePerDay: rate,
    missingCount: 0
  });

  closeAddInvModal();
  showToast('✅ New Bartan Added!');
  await loadInventoryPage();
}