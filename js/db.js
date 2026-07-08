// ============================================
// db.js — IndexedDB Database for UtsavRentals v4
// ============================================

const DB_NAME    = "BartanKirayaDB";
const DB_VERSION = 3;          // bumped to 3 → triggers onupgradeneeded for SARAI_BOOKINGS store

const STORES = {
  CUSTOMERS:  "customers",
  BOOKINGS:   "bookings",
  INVENTORY:  "inventory",
  PAYMENTS:   "payments",
  SETTINGS:   "settings",
  SARAI_BOOKINGS: "sarai_bookings",
};

let db = null;

// ============================================
// Initialize Database
// ============================================
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // --- CUSTOMERS ---
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const s = db.createObjectStore(STORES.CUSTOMERS, { keyPath: "id", autoIncrement: true });
        s.createIndex("mobile", "mobile", { unique: true });
        s.createIndex("name",   "name",   { unique: false });
      }

      // --- BOOKINGS ---
      if (!db.objectStoreNames.contains(STORES.BOOKINGS)) {
        const s = db.createObjectStore(STORES.BOOKINGS, { keyPath: "id", autoIncrement: true });
        s.createIndex("customerId",  "customerId",  { unique: false });
        s.createIndex("bookingDate", "bookingDate", { unique: false });
        s.createIndex("returnDate",  "returnDate",  { unique: false });
        s.createIndex("status",      "status",      { unique: false });
        s.createIndex("receiptNo",   "receiptNo",   { unique: true  });
      }

      // --- INVENTORY ---
      if (!db.objectStoreNames.contains(STORES.INVENTORY)) {
        const s = db.createObjectStore(STORES.INVENTORY, { keyPath: "id", autoIncrement: true });
        s.createIndex("name", "name", { unique: true });
      }

      // --- PAYMENTS ---
      if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
        const s = db.createObjectStore(STORES.PAYMENTS, { keyPath: "id", autoIncrement: true });
        s.createIndex("bookingId",   "bookingId",   { unique: false });
        s.createIndex("paymentDate", "paymentDate", { unique: false });
      }

      // --- SETTINGS (new in v2) ---
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
      }

      // --- SARAI BOOKINGS (new in v3) ---
      if (!db.objectStoreNames.contains(STORES.SARAI_BOOKINGS)) {
        const s = db.createObjectStore(STORES.SARAI_BOOKINGS, { keyPath: "id", autoIncrement: true });
        s.createIndex("customerId", "customerId", { unique: false });
        s.createIndex("fromDate",   "fromDate",   { unique: false });
        s.createIndex("toDate",     "toDate",     { unique: false });
        s.createIndex("status",     "status",     { unique: false }); // 'active', 'completed', 'cancelled'
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log("✅ Database initialized (v3)");
      seedInventory();
      resolve(db);
    };

    request.onerror = (event) => {
      console.error("❌ Database error:", event.target.error);
      reject(event.target.error);
    };
  });
}

// ============================================
// Generic DB Helpers
// ============================================
function getStore(storeName, mode = "readonly") {
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

function dbAdd(storeName, data) {
  return new Promise((resolve, reject) => {
    const store   = getStore(storeName, "readwrite");
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const store   = getStore(storeName, "readwrite");
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

function dbGet(storeName, id) {
  return new Promise((resolve, reject) => {
    const store   = getStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const store   = getStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const store   = getStore(storeName, "readwrite");
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror   = () => reject(request.error);
  });
}

function dbGetByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const store   = getStore(storeName);
    const index   = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

// ============================================
// SETTINGS Helpers
// ============================================
async function getSetting(key, defaultValue = null) {
  try {
    const row = await dbGet(STORES.SETTINGS, key);
    return row ? row.value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

async function setSetting(key, value) {
  return dbPut(STORES.SETTINGS, { key, value });
}

async function getAllSettings() {
  try {
    const rows = await dbGetAll(STORES.SETTINGS);
    const obj  = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    return obj;
  } catch (e) {
    return {};
  }
}

// ============================================
// Receipt Number Generator — BK-2026-0001
// ============================================
async function generateReceiptNo() {
  const bookings = await dbGetAll(STORES.BOOKINGS);
  const year     = new Date().getFullYear();
  const count    = bookings.filter(b => b.receiptNo?.startsWith(`BK-${year}`)).length + 1;
  return `BK-${year}-${String(count).padStart(4, "0")}`;
}

// ============================================
// Seed Default Inventory (22 Bartan from slip)
// ============================================
async function seedInventory() {
  const existing = await dbGetAll(STORES.INVENTORY);
  if (existing.length > 0) return;

  const defaultBartan = [
    { name: "Drum",             totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Bhatta",           totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Bhaguna",          totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Dhakkan",          totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Kadai Parcha",     totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Parat",            totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Tray",             totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Kunda Patal",      totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Jalebi Tavi",      totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Balti",            totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Dhama",            totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Amandasta",        totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "War Bewda",        totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Chammach",         totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Steel Koti",       totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Mawa Jali",        totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Jag",              totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Dera",             totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Khurpa",           totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Chai Chhanni",     totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Anya Samaan",      totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
    { name: "Sarai Kiraya",     totalStock: 0, availableStock: 0, ratePerDay: 0, missingCount: 0 },
  ];

  for (const bartan of defaultBartan) {
    await dbAdd(STORES.INVENTORY, bartan);
  }
  console.log("✅ Default 22 bartan inventory seeded");
}

// ============================================
// Export
// ============================================
window.BartanDB = {
  init: initDB,
  STORES,
  add:          dbAdd,
  put:          dbPut,
  get:          dbGet,
  getAll:       dbGetAll,
  delete:       dbDelete,
  getByIndex:   dbGetByIndex,
  getSetting,
  setSetting,
  getAllSettings,
  generateReceiptNo,
};