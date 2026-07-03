// ============================================
// db.js — IndexedDB Database for Bartan Kiraya App
// ============================================

const DB_NAME = "BartanKirayaDB";
const DB_VERSION = 1;

// All table (store) names
const STORES = {
  CUSTOMERS: "customers",
  BOOKINGS: "bookings",
  INVENTORY: "inventory",
  PAYMENTS: "payments",
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

      // --- CUSTOMERS Table ---
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const customerStore = db.createObjectStore(STORES.CUSTOMERS, {
          keyPath: "id",
          autoIncrement: true,
        });
        customerStore.createIndex("mobile", "mobile", { unique: true });
        customerStore.createIndex("name", "name", { unique: false });
      }

      // --- BOOKINGS Table ---
      if (!db.objectStoreNames.contains(STORES.BOOKINGS)) {
        const bookingStore = db.createObjectStore(STORES.BOOKINGS, {
          keyPath: "id",
          autoIncrement: true,
        });
        bookingStore.createIndex("customerId", "customerId", { unique: false });
        bookingStore.createIndex("bookingDate", "bookingDate", { unique: false });
        bookingStore.createIndex("returnDate", "returnDate", { unique: false });
        bookingStore.createIndex("status", "status", { unique: false });
        bookingStore.createIndex("receiptNo", "receiptNo", { unique: true });
      }

      // --- INVENTORY Table ---
      if (!db.objectStoreNames.contains(STORES.INVENTORY)) {
        const inventoryStore = db.createObjectStore(STORES.INVENTORY, {
          keyPath: "id",
          autoIncrement: true,
        });
        inventoryStore.createIndex("name", "name", { unique: true });
      }

      // --- PAYMENTS Table ---
      if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
        const paymentStore = db.createObjectStore(STORES.PAYMENTS, {
          keyPath: "id",
          autoIncrement: true,
        });
        paymentStore.createIndex("bookingId", "bookingId", { unique: false });
        paymentStore.createIndex("paymentDate", "paymentDate", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log("✅ Database initialized successfully");
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
    const store = getStore(storeName, "readwrite");
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, "readwrite");
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(storeName, id) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, "readwrite");
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

function dbGetByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Receipt Number Generator
// e.g. BK-2026-0001
// ============================================
async function generateReceiptNo() {
  const bookings = await dbGetAll(STORES.BOOKINGS);
  const year = new Date().getFullYear();
  const count = bookings.filter(b => b.receiptNo?.startsWith(`BK-${year}`)).length + 1;
  return `BK-${year}-${String(count).padStart(4, "0")}`;
}

// ============================================
// Seed Default Inventory (22 Bartan from slip)
// ============================================
async function seedInventory() {
  const existing = await dbGetAll(STORES.INVENTORY);
  if (existing.length > 0) return;

  const defaultBartan = [
    { name: "Drum (ड्रम)",              totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Bhatta (भट्टा)",           totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Bhaguna (भगुना)",          totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Dhakkan (ढक्कन)",          totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Kadai Parcha (कड़ाई परछा)",totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Parat (परात)",             totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Tray (ट्रे)",              totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Kunda Patal (कुण्डा पतल)", totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Jalebi Tavi (जलेबी तवी)", totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Balti (बाल्टी)",           totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Dhama (धामा)",             totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Amandasta (अमानदस्ता)",    totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "War Bewda (वर बेवड़ा)",    totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Chammach (चम्मच)",         totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Steel Koti (स्टील कोटी)", totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Mawa Jali (मावा जाली)",    totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Jag (जग)",                 totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Dera (डेरा)",              totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Khurpa (खुरपा)",           totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Chai Chhanni (चाय छन्नी)", totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Anya Samaan (अन्य सामान)", totalStock: 0, availableStock: 0, ratePerDay: 0 },
    { name: "Sarai Kiraya (सराय किराया)",totalStock: 0, availableStock: 0, ratePerDay: 0 },
  ];

  for (const bartan of defaultBartan) {
    await dbAdd(STORES.INVENTORY, bartan);
  }
  console.log("✅ Default 22 bartan inventory seeded");
}

// ============================================
// Export — accessible globally as window.BartanDB
// ============================================
window.BartanDB = {
  init: initDB,
  STORES,
  add: dbAdd,
  put: dbPut,
  get: dbGet,
  getAll: dbGetAll,
  delete: dbDelete,
  getByIndex: dbGetByIndex,
  generateReceiptNo,
};