const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const {
  DEFAULT_TABLES,
  DEFAULT_MENU_ITEMS,
  DEFAULT_CUSTOMERS,
  DEFAULT_EMPLOYEES,
  DEFAULT_SUPPLIERS,
  SAMPLE_ORDERS
} = require("./data");

const VALID_TABLE_STATUSES = new Set(["free", "occupied", "reserved", "cleaning"]);
const VALID_ORDER_STATUSES = new Set(["placed", "preparing", "served", "completed", "cancelled"]);
const VALID_PAYMENT_STATUSES = new Set(["pending", "paid", "refunded"]);
const ORDER_STATUS_TRANSITIONS = {
  placed: new Set(["preparing", "served", "completed", "cancelled"]),
  preparing: new Set(["served", "completed", "cancelled"]),
  served: new Set(["completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set()
};
const SESSION_TTL_HOURS = 12;
const DEFAULT_EMPLOYEE = {
  fullName: "CafeMaster Admin",
  email: "admin@cafemaster.local",
  password: "Cafe@12345",
  role: "manager",
  hourlyRate: 25.00
};

function nowIso() {
  return new Date().toISOString();
}

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = String(storedHash || "").split(":");
  if (!salt || !expectedHex) {
    return false;
  }
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateMenuItem(item) {
  if (!item.name) {
    throw createHttpError(400, "Menu item name is required.");
  }
  if (!item.category) {
    throw createHttpError(400, "Menu category is required.");
  }
  if (!Number.isFinite(item.price) || item.price <= 0) {
    throw createHttpError(400, "Price must be greater than zero.");
  }
  if (!Number.isFinite(item.cost) || item.cost < 0) {
    throw createHttpError(400, "Cost cannot be negative.");
  }
  if (!Number.isFinite(item.stock) || item.stock < 0) {
    throw createHttpError(400, "Stock cannot be negative.");
  }
  if (!Number.isFinite(item.minStock) || item.minStock < 0) {
    throw createHttpError(400, "Minimum stock cannot be negative.");
  }
  if (!Number.isFinite(item.prepTime) || item.prepTime <= 0) {
    throw createHttpError(400, "Prep time must be greater than zero.");
  }
}

function isLowStockMenuItem(item) {
  return Boolean(item?.available) && Number(item?.stock) <= Number(item?.minStock);
}

function getTableColumns(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
}

function addColumnIfMissing(db, tableName, columnName, definition) {
  const columns = getTableColumns(db, tableName);
  if (!columns.has(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function applySchemaMigrations(db) {
  addColumnIfMissing(db, "menu_items", "min_stock", "INTEGER NOT NULL DEFAULT 5");
  addColumnIfMissing(db, "menu_items", "allergens", "TEXT DEFAULT ''");
  addColumnIfMissing(db, "menu_items", "image_url", "TEXT DEFAULT ''");

  addColumnIfMissing(db, "customers", "email", "TEXT");
  addColumnIfMissing(db, "customers", "total_spent", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "customers", "created_at", "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'");
  addColumnIfMissing(db, "customers", "updated_at", "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'");

  addColumnIfMissing(db, "employees", "hourly_rate", "REAL DEFAULT 0");

  addColumnIfMissing(db, "orders", "employee_id", "INTEGER");

  addColumnIfMissing(db, "order_items", "special_instructions", "TEXT DEFAULT ''");

  addColumnIfMissing(db, "inventory_movements", "employee_id", "INTEGER");
  addColumnIfMissing(db, "inventory_movements", "reference_id", "INTEGER");
}

function createStore(dbFilePath) {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
  const db = new DatabaseSync(dbFilePath);
  const schema = fs.readFileSync(path.resolve(__dirname, "../../database/schema.sql"), "utf8");
  db.exec(schema);
  applySchemaMigrations(db);
  seedDatabase(db);

  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);

  const normalizeMenuRow = (row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: row.price,
    cost: row.cost,
    stock: row.stock,
    minStock: row.min_stock,
    available: Boolean(row.available),
    prepTime: row.prep_time,
    allergens: row.allergens,
    imageUrl: row.image_url,
    updatedAt: row.updated_at
  });

  const normalizeTableRow = (row) => ({
    id: row.id,
    name: row.name,
    seats: row.seats,
    zone: row.zone,
    status: row.status,
    activeOrderId: row.active_order_id,
    updatedAt: row.updated_at
  });

  const normalizeCustomerRow = (row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    visits: row.visits,
    loyaltyPoints: row.loyalty_points,
    lastVisit: row.last_visit
  });

  const normalizeEmployeeRow = (row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  function listMenuItems() {
    return all(
      `SELECT id, name, category, description, price, cost, stock, min_stock, available, prep_time, allergens, image_url, updated_at
       FROM menu_items
       ORDER BY category, name`
    ).map(normalizeMenuRow);
  }

  function getMenuItem(id) {
    const row = get(
      `SELECT id, name, category, description, price, cost, stock, min_stock, available, prep_time, allergens, image_url, updated_at
       FROM menu_items
       WHERE id = ?`,
      Number(id)
    );
    return row ? normalizeMenuRow(row) : null;
  }

  function listTables() {
    return all(
      `SELECT id, name, seats, zone, status, active_order_id, updated_at
       FROM tables
       ORDER BY id`
    ).map(normalizeTableRow);
  }

  function getTable(id) {
    const row = get(
      `SELECT id, name, seats, zone, status, active_order_id, updated_at
       FROM tables
       WHERE id = ?`,
      Number(id)
    );
    return row ? normalizeTableRow(row) : null;
  }

  function listCustomers() {
    return all(
      `SELECT id, name, phone, visits, loyalty_points, last_visit
       FROM customers
       ORDER BY visits DESC, last_visit DESC`
    ).map(normalizeCustomerRow);
  }

  function getEmployeeByEmail(email) {
    const row = get(
      `SELECT id, full_name, email, role, password_hash, is_active, last_login_at, created_at, updated_at
       FROM employees
       WHERE email = ?`,
      normalizeEmail(email)
    );
    return row
      ? {
          ...normalizeEmployeeRow(row),
          passwordHash: row.password_hash
        }
      : null;
  }

  function getEmployeeById(id) {
    const row = get(
      `SELECT id, full_name, email, role, is_active, last_login_at, created_at, updated_at
       FROM employees
       WHERE id = ?`,
      Number(id)
    );
    return row ? normalizeEmployeeRow(row) : null;
  }

  function cleanupExpiredSessions() {
    run(`DELETE FROM employee_sessions WHERE expires_at <= ?`, nowIso());
  }

  function authenticateEmployee(email, password) {
    const employee = getEmployeeByEmail(email);
    if (!employee || !employee.isActive) {
      throw createHttpError(401, "Invalid email or password.");
    }
    if (!verifyPassword(password, employee.passwordHash)) {
      throw createHttpError(401, "Invalid email or password.");
    }

    const timestamp = nowIso();
    run(
      `UPDATE employees
       SET last_login_at = ?, updated_at = ?
       WHERE id = ?`,
      timestamp,
      timestamp,
      employee.id
    );

    return getEmployeeById(employee.id);
  }

  function createEmployeeSession(employeeId) {
    cleanupExpiredSessions();
    const token = createSessionToken();
    const timestamp = nowIso();
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
    run(
      `INSERT INTO employee_sessions (employee_id, token_hash, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
      Number(employeeId),
      hashSessionToken(token),
      timestamp,
      expiresAt,
      timestamp
    );

    return {
      token,
      expiresAt
    };
  }

  function getEmployeeSession(token) {
    if (!token) {
      return null;
    }
    cleanupExpiredSessions();

    const row = get(
      `SELECT
         s.id,
         s.employee_id,
         s.created_at,
         s.expires_at,
         s.last_seen_at,
         e.full_name,
         e.email,
         e.role,
         e.is_active,
         e.last_login_at,
         e.created_at AS employee_created_at,
         e.updated_at AS employee_updated_at
       FROM employee_sessions s
       INNER JOIN employees e ON e.id = s.employee_id
       WHERE s.token_hash = ?`,
      hashSessionToken(token)
    );

    if (!row || !row.is_active) {
      return null;
    }

    const now = Date.now();
    if (Date.parse(row.expires_at) <= now) {
      run(`DELETE FROM employee_sessions WHERE id = ?`, row.id);
      return null;
    }

    run(`UPDATE employee_sessions SET last_seen_at = ? WHERE id = ?`, nowIso(), row.id);

    return {
      id: row.id,
      employeeId: row.employee_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastSeenAt: row.last_seen_at,
      employee: {
        id: row.employee_id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        isActive: Boolean(row.is_active),
        lastLoginAt: row.last_login_at,
        createdAt: row.employee_created_at,
        updatedAt: row.employee_updated_at
      }
    };
  }

  function deleteEmployeeSession(token) {
    if (!token) {
      return;
    }
    run(`DELETE FROM employee_sessions WHERE token_hash = ?`, hashSessionToken(token));
  }

  function mapOrderItems() {
    const grouped = new Map();
    for (const row of all(
      `SELECT id, order_id, menu_item_id, item_name, qty, unit_price, line_total, special_instructions
       FROM order_items
       ORDER BY id`
    )) {
      const entry = grouped.get(row.order_id) || [];
      entry.push({
        id: row.id,
        menuItemId: row.menu_item_id,
        name: row.item_name,
        qty: row.qty,
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
        specialInstructions: row.special_instructions
      });
      grouped.set(row.order_id, entry);
    }
    return grouped;
  }

  function orderSelectSql() {
    return `SELECT
      o.id,
      o.order_number,
      o.table_id,
      t.name AS table_name,
      o.customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      o.employee_id,
      e.full_name AS employee_name,
      o.order_type,
      o.status,
      o.payment_status,
      o.payment_method,
      o.notes,
      o.subtotal,
      o.tax,
      o.discount,
      o.total,
      o.created_at,
      o.updated_at
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN employees e ON e.id = o.employee_id`;
  }

  function normalizeOrderRow(row, items = []) {
    return {
      id: row.id,
      orderNumber: row.order_number,
      tableId: row.table_id,
      tableName: row.table_name,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      orderType: row.order_type,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      notes: row.notes,
      subtotal: row.subtotal,
      tax: row.tax,
      discount: row.discount,
      total: row.total,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items
    };
  }

  function listOrders() {
    const itemMap = mapOrderItems();
    return all(`${orderSelectSql()} ORDER BY o.id DESC`).map((row) =>
      normalizeOrderRow(row, itemMap.get(row.id) || [])
    );
  }

  function getOrder(id) {
    const row = get(`${orderSelectSql()} WHERE o.id = ?`, Number(id));
    if (!row) {
      return null;
    }
    const items = all(
      `SELECT id, order_id, menu_item_id, item_name, qty, unit_price, line_total, special_instructions
       FROM order_items
       WHERE order_id = ?
       ORDER BY id`,
      Number(id)
    ).map((item) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      name: item.item_name,
      qty: item.qty,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      specialInstructions: item.special_instructions
    }));
    return normalizeOrderRow(row, items);
  }

  function getDashboard() {
    const menuItems = listMenuItems();
    const tables = listTables();
    const orders = listOrders();
    const customers = listCustomers();
    const today = new Date().toISOString().slice(0, 10);
    const todaysOrders = orders.filter((order) => order.createdAt.slice(0, 10) === today);
    const revenueToday = todaysOrders.reduce((sum, order) => sum + order.total, 0);
    const lowStockItems = menuItems.filter(isLowStockMenuItem);
    const popularItems = new Map();
    const paymentBreakdown = new Map();
    const categoryMix = new Map();

    for (const order of orders) {
      paymentBreakdown.set(
        order.paymentMethod || "Unpaid",
        roundMoney((paymentBreakdown.get(order.paymentMethod || "Unpaid") || 0) + order.total)
      );
      for (const item of order.items) {
        const current = popularItems.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
        current.quantity += item.qty;
        current.revenue = roundMoney(current.revenue + item.lineTotal);
        popularItems.set(item.name, current);

        const menuItem = menuItems.find((entry) => entry.id === item.menuItemId);
        const category = menuItem ? menuItem.category : "Other";
        const bucket = categoryMix.get(category) || { category, revenue: 0, orders: 0 };
        bucket.revenue = roundMoney(bucket.revenue + item.lineTotal);
        bucket.orders += item.qty;
        categoryMix.set(category, bucket);
      }
    }

    return {
      stats: {
        revenueToday: roundMoney(revenueToday),
        ordersToday: todaysOrders.length,
        averageTicket: roundMoney(todaysOrders.length ? revenueToday / todaysOrders.length : 0),
        occupiedTables: tables.filter((table) => table.status === "occupied").length,
        totalTables: tables.length,
        lowStockCount: lowStockItems.length,
        activeOrders: orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length
      },
      lowStockItems: lowStockItems.sort((a, b) => a.stock - b.stock).slice(0, 6),
      recentOrders: orders.slice(0, 6),
      popularItems: Array.from(popularItems.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      paymentBreakdown: Array.from(paymentBreakdown.entries()).map(([label, total]) => ({ label, total })),
      tableSnapshot: tables,
      customerSpotlight: customers.slice(0, 5),
      categoryMix: Array.from(categoryMix.values()).sort((a, b) => b.revenue - a.revenue)
    };
  }

  function getBootstrap() {
    return {
      brand: { name: "CafeMaster", tagline: "Phase One Operations Hub" },
      menuItems: listMenuItems(),
      tables: listTables(),
      customers: listCustomers(),
      orders: listOrders(),
      dashboard: getDashboard(),
      generatedAt: nowIso()
    };
  }

  function upsertCustomer(customer = {}, total = 0) {
    const name = String(customer.name || "").trim();
    const phone = String(customer.phone || "").trim();
    if (!name && !phone) {
      return null;
    }
    const timestamp = nowIso();
    const points = Math.max(5, Math.floor(total / 20));
    if (phone) {
      const existing = get(
        `SELECT id, name, visits, loyalty_points
         FROM customers
         WHERE phone = ?`,
        phone
      );
      if (existing) {
        run(
          `UPDATE customers
           SET name = ?, visits = ?, loyalty_points = ?, total_spent = total_spent + ?, last_visit = ?, updated_at = ?
           WHERE id = ?`,
          name || existing.name,
          existing.visits + 1,
          existing.loyalty_points + points,
          total,
          timestamp,
          timestamp,
          existing.id
        );
        return existing.id;
      }
    }
    run(
      `INSERT INTO customers (name, phone, visits, loyalty_points, total_spent, last_visit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      name || "Walk-in Guest",
      phone || null,
      1,
      points,
      total,
      timestamp,
      timestamp,
      timestamp
    );
    return get("SELECT last_insert_rowid() AS id").id;
  }

  function generateOrderNumber() {
    const nextId = Number(get("SELECT COALESCE(MAX(id), 0) AS value FROM orders").value) + 1;
    return `CM-${String(1000 + nextId).padStart(4, "0")}`;
  }

  function createMenuItem(payload) {
    const record = {
      name: String(payload.name || "").trim(),
      category: String(payload.category || "Coffee").trim(),
      description: String(payload.description || "").trim(),
      price: Number(payload.price || 0),
      cost: Number(payload.cost || 0),
      stock: Number(payload.stock || 0),
      minStock: Number(payload.minStock || 5),
      available: payload.available === undefined ? true : Boolean(payload.available),
      prepTime: Number(payload.prepTime || 5),
      allergens: String(payload.allergens || "").trim(),
      imageUrl: String(payload.imageUrl || "").trim()
    };
    validateMenuItem(record);
    run(
      `INSERT INTO menu_items
       (name, category, description, price, cost, stock, min_stock, available, prep_time, allergens, image_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.name,
      record.category,
      record.description,
      record.price,
      record.cost,
      record.stock,
      record.minStock,
      record.available ? 1 : 0,
      record.prepTime,
      record.allergens,
      record.imageUrl,
      nowIso()
    );
    return getMenuItem(get("SELECT last_insert_rowid() AS id").id);
  }

  function updateMenuItem(id, payload) {
    const existing = getMenuItem(id);
    if (!existing) {
      throw createHttpError(404, "Menu item not found.");
    }
    const record = {
      name: String(payload.name ?? existing.name).trim(),
      category: String(payload.category ?? existing.category).trim(),
      description: String(payload.description ?? existing.description).trim(),
      price: Number(payload.price ?? existing.price),
      cost: Number(payload.cost ?? existing.cost),
      stock: Number(payload.stock ?? existing.stock),
      minStock: Number(payload.minStock ?? existing.minStock),
      available: payload.available === undefined ? existing.available : Boolean(payload.available),
      prepTime: Number(payload.prepTime ?? existing.prepTime),
      allergens: String(payload.allergens ?? existing.allergens).trim(),
      imageUrl: String(payload.imageUrl ?? existing.imageUrl).trim()
    };
    validateMenuItem(record);
    run(
      `UPDATE menu_items
       SET name = ?, category = ?, description = ?, price = ?, cost = ?, stock = ?, min_stock = ?, available = ?, prep_time = ?, allergens = ?, image_url = ?, updated_at = ?
       WHERE id = ?`,
      record.name,
      record.category,
      record.description,
      record.price,
      record.cost,
      record.stock,
      record.minStock,
      record.available ? 1 : 0,
      record.prepTime,
      record.allergens,
      record.imageUrl,
      nowIso(),
      Number(id)
    );
    return getMenuItem(id);
  }

  function restockItem(id, quantity, reason = "Manual restock", employeeId = null) {
    const item = getMenuItem(id);
    const amount = Number(quantity);
    if (!item) {
      throw createHttpError(404, "Menu item not found.");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw createHttpError(400, "Restock quantity must be greater than zero.");
    }
    const timestamp = nowIso();
    run(`UPDATE menu_items SET stock = stock + ?, updated_at = ? WHERE id = ?`, amount, timestamp, Number(id));
    run(
      `INSERT INTO inventory_movements (menu_item_id, employee_id, change_qty, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      Number(id),
      employeeId ? Number(employeeId) : null,
      amount,
      reason,
      timestamp
    );
    return getMenuItem(id);
  }

  function updateTableState(id, payload) {
    const table = getTable(id);
    if (!table) {
      throw createHttpError(404, "Table not found.");
    }
    const nextStatus = String(payload.status ?? table.status).trim().toLowerCase();
    if (!VALID_TABLE_STATUSES.has(nextStatus)) {
      throw createHttpError(400, "Invalid table status.");
    }
    const record = {
      name: String(payload.name ?? table.name).trim(),
      seats: Number(payload.seats ?? table.seats),
      zone: String(payload.zone ?? table.zone).trim(),
      status: nextStatus,
      activeOrderId: nextStatus === "occupied" ? payload.activeOrderId ?? table.activeOrderId : null
    };
    if (!record.name || record.seats <= 0) {
      throw createHttpError(400, "Table name and seats are required.");
    }
    if (table.activeOrderId && table.status === "occupied" && nextStatus !== "occupied") {
      throw createHttpError(409, "This table has an active order. Update the order status instead.");
    }
    run(
      `UPDATE tables
       SET name = ?, seats = ?, zone = ?, status = ?, active_order_id = ?, updated_at = ?
       WHERE id = ?`,
      record.name,
      record.seats,
      record.zone,
      record.status,
      record.activeOrderId,
      nowIso(),
      Number(id)
    );
    return getTable(id);
  }

  function createOrder(payload, employeeId = null) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) {
      throw createHttpError(400, "Add at least one item to create an order.");
    }
    const orderType = String(payload.orderType || "dine-in").trim().toLowerCase();
    const tableId = payload.tableId ? Number(payload.tableId) : null;
    const status = String(payload.status || "placed").trim().toLowerCase();
    const paymentStatus = String(payload.paymentStatus || "paid").trim().toLowerCase();
    const paymentMethod = String(payload.paymentMethod || "UPI").trim();
    const notes = String(payload.notes || "").trim();
    const discount = Math.max(0, Number(payload.discount || 0));

    if (!VALID_ORDER_STATUSES.has(status)) {
      throw createHttpError(400, "Invalid order status.");
    }
    if (!VALID_PAYMENT_STATUSES.has(paymentStatus)) {
      throw createHttpError(400, "Invalid payment status.");
    }
    if (orderType === "dine-in" && !tableId) {
      throw createHttpError(400, "A table is required for dine-in orders.");
    }

    const resolvedItems = items.map((entry) => {
      const menuItem = getMenuItem(entry.menuItemId);
      const qty = Number(entry.qty || 0);
      if (!menuItem) {
        throw createHttpError(400, "One or more selected menu items were not found.");
      }
      if (!menuItem.available) {
        throw createHttpError(400, `${menuItem.name} is currently unavailable.`);
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        throw createHttpError(400, `Quantity for ${menuItem.name} must be greater than zero.`);
      }
      if (menuItem.stock < qty) {
        throw createHttpError(400, `Only ${menuItem.stock} units of ${menuItem.name} are left in stock.`);
      }
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        qty,
        unitPrice: menuItem.price,
        lineTotal: roundMoney(menuItem.price * qty)
      };
    });

    if (tableId) {
      const table = getTable(tableId);
      if (!table) {
        throw createHttpError(400, "Selected table does not exist.");
      }
      if (table.status !== "free") {
        throw createHttpError(400, `${table.name} is not available for a new dine-in order.`);
      }
    }

    const subtotal = roundMoney(resolvedItems.reduce((sum, item) => sum + item.lineTotal, 0));
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = roundMoney(payload.tax === undefined ? taxableAmount * 0.05 : Number(payload.tax));
    const total = roundMoney(taxableAmount + tax);
    const timestamp = nowIso();
    const orderNumber = generateOrderNumber();

    db.exec("BEGIN");
    try {
      const customerId = upsertCustomer(payload.customer, total);
      run(
        `INSERT INTO orders
         (order_number, table_id, customer_id, employee_id, order_type, status, payment_status, payment_method, notes, subtotal, tax, discount, total, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        orderNumber,
        tableId,
        customerId,
        employeeId ? Number(employeeId) : null,
        orderType,
        status,
        paymentStatus,
        paymentMethod,
        notes,
        subtotal,
        tax,
        discount,
        total,
        timestamp,
        timestamp
      );
      const orderId = get("SELECT last_insert_rowid() AS id").id;

      for (const item of resolvedItems) {
        run(
          `INSERT INTO order_items (order_id, menu_item_id, item_name, qty, unit_price, line_total, special_instructions)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          orderId,
          item.menuItemId,
          item.name,
          item.qty,
          item.unitPrice,
          item.lineTotal,
          "" // special_instructions
        );
        run(`UPDATE menu_items SET stock = stock - ?, updated_at = ? WHERE id = ?`, item.qty, timestamp, item.menuItemId);
        run(
          `INSERT INTO inventory_movements (menu_item_id, employee_id, change_qty, reason, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          item.menuItemId,
          employeeId ? Number(employeeId) : null,
          -item.qty,
          `Sale ${orderNumber}`,
          timestamp
        );
      }

      if (tableId) {
        const table = getTable(tableId);
        run(
          `UPDATE tables
           SET status = ?, active_order_id = ?, updated_at = ?
           WHERE id = ?`,
          status === "completed" ? "free" : "occupied",
          status === "completed" ? null : orderId,
          timestamp,
          tableId
        );
      }

      db.exec("COMMIT");
      return getOrder(orderId);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function updateOrderStatus(id, payload, employeeId = null) {
    const order = getOrder(id);
    if (!order) {
      throw createHttpError(404, "Order not found.");
    }
    const status = String(payload.status ?? order.status).trim().toLowerCase();
    const paymentStatus = String(payload.paymentStatus ?? order.paymentStatus).trim().toLowerCase();
    const paymentMethod = String(payload.paymentMethod ?? order.paymentMethod ?? "").trim();
    if (!VALID_ORDER_STATUSES.has(status)) {
      throw createHttpError(400, "Invalid order status.");
    }
    if (!VALID_PAYMENT_STATUSES.has(paymentStatus)) {
      throw createHttpError(400, "Invalid payment status.");
    }
    if (status !== order.status && !ORDER_STATUS_TRANSITIONS[order.status]?.has(status)) {
      throw createHttpError(409, `Orders cannot move from ${order.status} to ${status}.`);
    }

    const timestamp = nowIso();
    db.exec("BEGIN");
    try {
      run(
        `UPDATE orders
         SET status = ?, payment_status = ?, payment_method = ?, updated_at = ?
         WHERE id = ?`,
        status,
        paymentStatus,
        paymentMethod,
        timestamp,
        Number(id)
      );

      if (order.tableId) {
        run(
          `UPDATE tables
           SET status = ?, active_order_id = ?, updated_at = ?
           WHERE id = ?`,
          ["completed", "cancelled"].includes(status) ? "free" : "occupied",
          ["completed", "cancelled"].includes(status) ? null : order.id,
          timestamp,
          order.tableId
        );
      }

      if (order.status !== "cancelled" && status === "cancelled") {
        for (const item of order.items) {
          run(`UPDATE menu_items SET stock = stock + ?, updated_at = ? WHERE id = ?`, item.qty, timestamp, item.menuItemId);
          run(
            `INSERT INTO inventory_movements (menu_item_id, employee_id, change_qty, reason, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            item.menuItemId,
            employeeId ? Number(employeeId) : null,
            item.qty,
            `Order ${order.orderNumber} cancelled`,
            timestamp
          );
        }
      }

      db.exec("COMMIT");
      return getOrder(id);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  // Industry-level features

  // Employee Management
  function listEmployees() {
    return all(
      `SELECT id, full_name, email, role, hourly_rate, is_active, last_login_at, created_at, updated_at
       FROM employees
       ORDER BY full_name`
    ).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      hourlyRate: row.hourly_rate,
      isActive: Boolean(row.is_active),
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  function createEmployee(payload) {
    const record = {
      fullName: String(payload.fullName || "").trim(),
      email: normalizeEmail(payload.email),
      role: String(payload.role || "staff").trim(),
      hourlyRate: Number(payload.hourlyRate || 0),
      password: String(payload.password || "")
    };

    if (!record.fullName || !record.email) {
      throw createHttpError(400, "Full name and email are required.");
    }
    if (!record.password) {
      throw createHttpError(400, "Password is required.");
    }

    run(
      `INSERT INTO employees (full_name, email, role, password_hash, hourly_rate, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      record.fullName,
      record.email,
      record.role,
      hashPassword(record.password),
      record.hourlyRate,
      1,
      nowIso(),
      nowIso()
    );

    return getEmployeeById(get("SELECT last_insert_rowid() AS id").id);
  }

  function updateEmployee(id, payload) {
    const existing = getEmployeeById(id);
    if (!existing) {
      throw createHttpError(404, "Employee not found.");
    }

    const record = {
      fullName: String(payload.fullName ?? existing.fullName).trim(),
      email: payload.email !== undefined ? normalizeEmail(payload.email) : existing.email,
      role: String(payload.role ?? existing.role).trim(),
      hourlyRate: Number(payload.hourlyRate ?? existing.hourlyRate),
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive
    };

    if (!record.fullName || !record.email) {
      throw createHttpError(400, "Full name and email are required.");
    }

    run(
      `UPDATE employees
       SET full_name = ?, email = ?, role = ?, hourly_rate = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      record.fullName,
      record.email,
      record.role,
      record.hourlyRate,
      record.isActive ? 1 : 0,
      nowIso(),
      Number(id)
    );

    return getEmployeeById(id);
  }

  function createEmployeeShift(payload) {
    const record = {
      employeeId: Number(payload.employeeId),
      startTime: String(payload.startTime || "").trim(),
      endTime: String(payload.endTime || "").trim(),
      role: String(payload.role || "").trim(),
      notes: String(payload.notes || "").trim()
    };

    if (!record.employeeId || !record.startTime || !record.endTime) {
      throw createHttpError(400, "Employee ID, start time, and end time are required.");
    }

    const employee = getEmployeeById(record.employeeId);
    if (!employee) {
      throw createHttpError(404, "Employee not found.");
    }

    run(
      `INSERT INTO employee_shifts (employee_id, start_time, end_time, role, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      record.employeeId,
      record.startTime,
      record.endTime,
      record.role,
      record.notes,
      nowIso()
    );

    return get("SELECT last_insert_rowid() AS id").id;
  }

  function listEmployeeShifts(employeeId = null, dateFrom = null, dateTo = null) {
    let sql = `SELECT s.id, s.employee_id, s.start_time, s.end_time, s.role, s.notes, s.created_at,
                      e.full_name, e.email
               FROM employee_shifts s
               INNER JOIN employees e ON e.id = s.employee_id`;
    const params = [];
    const filters = [];

    if (employeeId) {
      filters.push(`s.employee_id = ?`);
      params.push(Number(employeeId));
    }

    if (dateFrom) {
      filters.push(`s.start_time >= ?`);
      params.push(dateFrom);
    }

    if (dateTo) {
      filters.push(`s.start_time <= ?`);
      params.push(dateTo);
    }

    if (filters.length) {
      sql += ` WHERE ${filters.join(" AND ")}`;
    }

    sql += ` ORDER BY s.start_time DESC`;

    return all(sql, ...params).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.full_name,
      employeeEmail: row.email,
      startTime: row.start_time,
      endTime: row.end_time,
      role: row.role,
      notes: row.notes,
      createdAt: row.created_at
    }));
  }

  // Reservations
  function createReservation(payload) {
    const record = {
      customerName: String(payload.customerName || "").trim(),
      customerPhone: String(payload.customerPhone || "").trim(),
      customerEmail: String(payload.customerEmail || "").trim(),
      tableId: Number(payload.tableId),
      partySize: Number(payload.partySize || 1),
      reservationTime: String(payload.reservationTime || "").trim(),
      durationMinutes: Number(payload.durationMinutes || 120),
      status: String(payload.status || "confirmed").trim(),
      notes: String(payload.notes || "").trim()
    };

    if (!record.customerName || !record.tableId || !record.reservationTime) {
      throw createHttpError(400, "Customer name, table ID, and reservation time are required.");
    }

    const table = getTable(record.tableId);
    if (!table) {
      throw createHttpError(404, "Table not found.");
    }

    if (record.partySize > table.seats) {
      throw createHttpError(400, `Party size (${record.partySize}) exceeds table capacity (${table.seats}).`);
    }

    run(
      `INSERT INTO reservations (customer_name, customer_phone, customer_email, table_id, party_size, reservation_time, duration_minutes, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.customerName,
      record.customerPhone,
      record.customerEmail,
      record.tableId,
      record.partySize,
      record.reservationTime,
      record.durationMinutes,
      record.status,
      record.notes,
      nowIso(),
      nowIso()
    );

    return get("SELECT last_insert_rowid() AS id").id;
  }

  function listReservations(dateFrom = null, dateTo = null, status = null) {
    let sql = `SELECT r.id, r.customer_name, r.customer_phone, r.customer_email, r.table_id, r.party_size,
                      r.reservation_time, r.duration_minutes, r.status, r.notes, r.created_at, r.updated_at,
                      t.name AS table_name, t.seats, t.zone
               FROM reservations r
               INNER JOIN tables t ON t.id = r.table_id`;
    const params = [];

    if (dateFrom) {
      sql += ` WHERE r.reservation_time >= ?`;
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += dateFrom ? ` AND` : ` WHERE`;
      sql += ` r.reservation_time <= ?`;
      params.push(dateTo);
    }

    if (status) {
      sql += (dateFrom || dateTo) ? ` AND` : ` WHERE`;
      sql += ` r.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY r.reservation_time ASC`;

    return all(sql, ...params).map((row) => ({
      id: row.id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      tableId: row.table_id,
      tableName: row.table_name,
      tableSeats: row.seats,
      tableZone: row.zone,
      partySize: row.party_size,
      reservationTime: row.reservation_time,
      durationMinutes: row.duration_minutes,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  function updateReservation(id, payload) {
    const existing = get(`SELECT id FROM reservations WHERE id = ?`, Number(id));
    if (!existing) {
      throw createHttpError(404, "Reservation not found.");
    }

    const record = {
      status: String(payload.status || "confirmed").trim(),
      notes: String(payload.notes || "").trim()
    };

    run(
      `UPDATE reservations
       SET status = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      record.status,
      record.notes,
      nowIso(),
      Number(id)
    );

    return listReservations().find(r => r.id === Number(id));
  }

  // Suppliers and Purchase Orders
  function createSupplier(payload) {
    const record = {
      name: String(payload.name || "").trim(),
      contactName: String(payload.contactName || "").trim(),
      phone: String(payload.phone || "").trim(),
      email: String(payload.email || "").trim(),
      address: String(payload.address || "").trim(),
      paymentTerms: String(payload.paymentTerms || "Net 30").trim(),
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true
    };

    if (!record.name) {
      throw createHttpError(400, "Supplier name is required.");
    }

    run(
      `INSERT INTO suppliers (name, contact_name, phone, email, address, payment_terms, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.name,
      record.contactName,
      record.phone,
      record.email,
      record.address,
      record.paymentTerms,
      record.isActive ? 1 : 0,
      nowIso(),
      nowIso()
    );

    return get("SELECT last_insert_rowid() AS id").id;
  }

  function listSuppliers() {
    return all(
      `SELECT id, name, contact_name, phone, email, address, payment_terms, is_active, created_at, updated_at
       FROM suppliers
       ORDER BY name`
    ).map((row) => ({
      id: row.id,
      name: row.name,
      contactName: row.contact_name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      paymentTerms: row.payment_terms,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  function createPurchaseOrder(payload) {
    const record = {
      supplierId: Number(payload.supplierId),
      employeeId: Number(payload.employeeId),
      status: String(payload.status || "draft").trim(),
      expectedDelivery: String(payload.expectedDelivery || "").trim(),
      notes: String(payload.notes || "").trim()
    };

    if (!record.supplierId || !record.employeeId) {
      throw createHttpError(400, "Supplier ID and employee ID are required.");
    }

    const supplier = get(`SELECT id FROM suppliers WHERE id = ?`, record.supplierId);
    if (!supplier) {
      throw createHttpError(404, "Supplier not found.");
    }

    const employee = getEmployeeById(record.employeeId);
    if (!employee) {
      throw createHttpError(404, "Employee not found.");
    }

    run(
      `INSERT INTO purchase_orders (supplier_id, employee_id, order_number, status, expected_delivery, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      record.supplierId,
      record.employeeId,
      generatePurchaseOrderNumber(),
      record.status,
      record.expectedDelivery,
      record.notes,
      nowIso(),
      nowIso()
    );

    return get("SELECT last_insert_rowid() AS id").id;
  }

  function generatePurchaseOrderNumber() {
    const nextId = Number(get("SELECT COALESCE(MAX(id), 0) AS value FROM purchase_orders").value) + 1;
    return `PO-${String(1000 + nextId).padStart(4, "0")}`;
  }

  function addPurchaseOrderItem(payload) {
    const record = {
      purchaseOrderId: Number(payload.purchaseOrderId),
      menuItemId: Number(payload.menuItemId),
      quantity: Number(payload.quantity || 1),
      unitCost: Number(payload.unitCost || 0)
    };

    if (!record.purchaseOrderId || !record.menuItemId || record.quantity <= 0) {
      throw createHttpError(400, "Purchase order ID, menu item ID, and positive quantity are required.");
    }

    const po = get(`SELECT id FROM purchase_orders WHERE id = ?`, record.purchaseOrderId);
    if (!po) {
      throw createHttpError(404, "Purchase order not found.");
    }

    const menuItem = getMenuItem(record.menuItemId);
    if (!menuItem) {
      throw createHttpError(404, "Menu item not found.");
    }

    run(
      `INSERT INTO purchase_order_items (purchase_order_id, menu_item_id, quantity, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?)`,
      record.purchaseOrderId,
      record.menuItemId,
      record.quantity,
      record.unitCost,
      roundMoney(record.quantity * record.unitCost)
    );

    updatePurchaseOrderTotal(record.purchaseOrderId);
    return get("SELECT last_insert_rowid() AS id").id;
  }

  function updatePurchaseOrderTotal(poId) {
    const total = get(
      `SELECT COALESCE(SUM(line_total), 0) AS total
       FROM purchase_order_items
       WHERE purchase_order_id = ?`,
      poId
    ).total;

    run(
      `UPDATE purchase_orders
       SET total_amount = ?, updated_at = ?
       WHERE id = ?`,
      total,
      nowIso(),
      poId
    );
  }

  function listPurchaseOrders(status = null) {
    let sql = `SELECT po.id, po.supplier_id, po.employee_id, po.order_number, po.status, po.total_amount,
                      po.expected_delivery, po.notes, po.created_at, po.updated_at,
                      s.name AS supplier_name, e.full_name AS employee_name
               FROM purchase_orders po
               INNER JOIN suppliers s ON s.id = po.supplier_id
               INNER JOIN employees e ON e.id = po.employee_id`;
    const params = [];

    if (status) {
      sql += ` WHERE po.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY po.created_at DESC`;

    return all(sql, ...params).map((row) => ({
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      orderNumber: row.order_number,
      status: row.status,
      totalAmount: row.total_amount,
      expectedDelivery: row.expected_delivery,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  // Audit Logging
  function logAuditAction(employeeId, action, entityType, entityId = null, oldValues = null, newValues = null, ipAddress = null, userAgent = null) {
    run(
      `INSERT INTO audit_log (employee_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      employeeId ? Number(employeeId) : null,
      action,
      entityType,
      entityId ? Number(entityId) : null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
      nowIso()
    );
  }

  function listAuditLogs(entityType = null, entityId = null, limit = 100) {
    let sql = `SELECT a.id, a.employee_id, a.action, a.entity_type, a.entity_id, a.old_values, a.new_values,
                      a.ip_address, a.user_agent, a.created_at,
                      e.full_name AS employee_name
               FROM audit_log a
               LEFT JOIN employees e ON e.id = a.employee_id`;
    const params = [];

    if (entityType) {
      sql += ` WHERE a.entity_type = ?`;
      params.push(entityType);
    }

    if (entityId) {
      sql += entityType ? ` AND` : ` WHERE`;
      sql += ` a.entity_id = ?`;
      params.push(Number(entityId));
    }

    sql += ` ORDER BY a.created_at DESC LIMIT ?`;
    params.push(Number(limit));

    return all(sql, ...params).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      oldValues: row.old_values ? JSON.parse(row.old_values) : null,
      newValues: row.new_values ? JSON.parse(row.new_values) : null,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    }));
  }

  // Notifications
  function createNotification(type, title, message, priority = "normal", relatedEntityType = null, relatedEntityId = null) {
    run(
      `INSERT INTO notifications (type, title, message, priority, related_entity_type, related_entity_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      type,
      title,
      message,
      priority,
      relatedEntityType,
      relatedEntityId ? Number(relatedEntityId) : null,
      nowIso()
    );

    return get("SELECT last_insert_rowid() AS id").id;
  }

  function listNotifications(unreadOnly = false) {
    let sql = `SELECT id, type, title, message, priority, is_read, related_entity_type, related_entity_id, created_at
               FROM notifications`;
    const params = [];

    if (unreadOnly) {
      sql += ` WHERE is_read = 0`;
    }

    sql += ` ORDER BY created_at DESC`;

    return all(sql, ...params).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      priority: row.priority,
      isRead: Boolean(row.is_read),
      relatedEntityType: row.related_entity_type,
      relatedEntityId: row.related_entity_id,
      createdAt: row.created_at
    }));
  }

  function markNotificationRead(id) {
    run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, Number(id));
  }

  // Advanced Reporting
  function generateSalesReport(dateFrom, dateTo, reportType = "daily") {
    const orders = all(
      `SELECT o.id, o.total, o.created_at, o.customer_id, c.name AS customer_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.created_at >= ? AND o.created_at <= ? AND o.status = 'completed'`,
      dateFrom,
      dateTo
    );

    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;
    const totalCustomers = new Set(orders.map(o => o.customer_id).filter(id => id)).size;

    const itemSales = all(
      `SELECT oi.item_name, SUM(oi.qty) AS quantity, SUM(oi.line_total) AS revenue
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= ? AND o.created_at <= ? AND o.status = 'completed'
       GROUP BY oi.item_name
       ORDER BY revenue DESC`,
      dateFrom,
      dateTo
    );

    run(
      `INSERT INTO sales_reports (report_type, date_from, date_to, total_sales, total_orders, total_customers, top_items, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      reportType,
      dateFrom,
      dateTo,
      totalSales,
      totalOrders,
      totalCustomers,
      JSON.stringify(itemSales.slice(0, 10)),
      nowIso()
    );

    return {
      reportType,
      dateFrom,
      dateTo,
      totalSales: roundMoney(totalSales),
      totalOrders,
      totalCustomers,
      topItems: itemSales.slice(0, 10),
      averageOrderValue: totalOrders > 0 ? roundMoney(totalSales / totalOrders) : 0
    };
  }

  function getLowStockAlerts() {
    return all(
      `SELECT id, name, stock, min_stock
       FROM menu_items
       WHERE stock <= min_stock AND available = 1
       ORDER BY stock ASC`
    ).map((row) => ({
      id: row.id,
      name: row.name,
      currentStock: row.stock,
      minStock: row.min_stock
    }));
  }

  return {
    db,
    dbFilePath,
    getBootstrap,
    getDashboard,
    authenticateEmployee,
    createEmployeeSession,
    getEmployeeSession,
    deleteEmployeeSession,
    listMenuItems,
    getMenuItem,
    createMenuItem,
    updateMenuItem,
    restockItem,
    listTables,
    getTable,
    updateTableState,
    listCustomers,
    listOrders,
    getOrder,
    createOrder,
    updateOrderStatus,
    // Industry-level features
    listEmployees,
    createEmployee,
    updateEmployee,
    createEmployeeShift,
    listEmployeeShifts,
    createReservation,
    listReservations,
    updateReservation,
    createSupplier,
    listSuppliers,
    createPurchaseOrder,
    addPurchaseOrderItem,
    listPurchaseOrders,
    logAuditAction,
    listAuditLogs,
    createNotification,
    listNotifications,
    markNotificationRead,
    generateSalesReport,
    getLowStockAlerts
  };
}

function seedDatabase(db) {
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const now = nowIso();

  if (!get("SELECT COUNT(*) AS count FROM tables").count) {
    for (const table of DEFAULT_TABLES) {
      run(
        `INSERT INTO tables (name, seats, zone, status, active_order_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        table.name,
        table.seats,
        table.zone,
        table.status,
        null,
        now
      );
    }
  }

  if (!get("SELECT COUNT(*) AS count FROM menu_items").count) {
    for (const item of DEFAULT_MENU_ITEMS) {
      run(
        `INSERT INTO menu_items
         (name, category, description, price, cost, stock, min_stock, available, prep_time, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.name,
        item.category,
        item.description,
        item.price,
        item.cost,
        item.stock,
        5, // min_stock default
        item.available,
        item.prepTime,
        now
      );
    }
  }

  if (!get("SELECT COUNT(*) AS count FROM customers").count) {
    for (const customer of DEFAULT_CUSTOMERS) {
      run(
        `INSERT INTO customers (name, phone, visits, loyalty_points, total_spent, last_visit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        customer.name,
        customer.phone,
        customer.visits,
        customer.loyaltyPoints,
        customer.totalSpent || 0,
        now,
        now,
        now
      );
    }
  }

  if (!get("SELECT COUNT(*) AS count FROM employees").count) {
    // Seed default manager
    run(
      `INSERT INTO employees
       (full_name, email, role, password_hash, hourly_rate, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      DEFAULT_EMPLOYEE.fullName,
      normalizeEmail(DEFAULT_EMPLOYEE.email),
      DEFAULT_EMPLOYEE.role,
      hashPassword(DEFAULT_EMPLOYEE.password),
      DEFAULT_EMPLOYEE.hourlyRate || 20.00,
      1,
      now,
      now
    );

    // Seed additional employees
    for (const employee of DEFAULT_EMPLOYEES) {
      run(
        `INSERT INTO employees
         (full_name, email, role, password_hash, hourly_rate, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        employee.fullName,
        normalizeEmail(employee.email),
        employee.role,
        hashPassword(employee.password),
        employee.hourlyRate,
        1,
        now,
        now
      );
    }
  }

  if (!get("SELECT COUNT(*) AS count FROM suppliers").count) {
    for (const supplier of DEFAULT_SUPPLIERS) {
      run(
        `INSERT INTO suppliers (name, contact_name, phone, email, address, payment_terms, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        supplier.name,
        supplier.contactName,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.paymentTerms,
        1,
        now,
        now
      );
    }
  }

  run(`DELETE FROM employee_sessions WHERE expires_at <= ?`, now);

  if (get("SELECT COUNT(*) AS count FROM orders").count) {
    return;
  }

  let orderNumber = 1000;
  for (const sample of SAMPLE_ORDERS) {
    orderNumber += 1;
    const timestamp = new Date(Date.now() - orderNumber * 3_600_000).toISOString();
    let subtotal = 0;
    let customerId = null;
    const table = sample.tableName
      ? get(`SELECT id, name FROM tables WHERE name = ?`, sample.tableName)
      : null;

    if (sample.customerPhone) {
      const customer = get(
        `SELECT id, visits, loyalty_points
         FROM customers
         WHERE phone = ?`,
        sample.customerPhone
      );
      if (customer) {
        customerId = customer.id;
        run(
          `UPDATE customers
           SET visits = ?, loyalty_points = ?, total_spent = total_spent + ?, last_visit = ?, updated_at = ?
           WHERE id = ?`,
          customer.visits + 1,
          customer.loyalty_points + 10,
          100, // approximate order total for seeding
          timestamp,
          timestamp,
          customer.id
        );
      }
    }

    if (!customerId && sample.customerName) {
      run(
        `INSERT INTO customers (name, phone, visits, loyalty_points, total_spent, last_visit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        sample.customerName,
        sample.customerPhone || null,
        1,
        10,
        100, // approximate order total for seeding
        timestamp,
        timestamp,
        timestamp
      );
      customerId = get("SELECT last_insert_rowid() AS id").id;
    }

    for (const item of sample.items) {
      const menu = get(`SELECT id, name, price FROM menu_items WHERE name = ?`, item.menuName);
      if (menu) {
        subtotal += menu.price * item.qty;
      }
    }

    const discount = Number(sample.discount || 0);
    const tax = roundMoney(Math.max(0, subtotal - discount) * 0.05);
    const total = roundMoney(subtotal - discount + tax);

    run(
      `INSERT INTO orders
       (order_number, table_id, customer_id, employee_id, order_type, status, payment_status, payment_method, notes, subtotal, tax, discount, total, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      `CM-${String(orderNumber).padStart(4, "0")}`,
      table ? table.id : null,
      customerId,
      null, // employee_id
      sample.orderType,
      sample.status,
      sample.paymentStatus,
      sample.paymentMethod,
      sample.notes,
      subtotal,
      tax,
      discount,
      total,
      timestamp,
      timestamp
    );

    const orderId = get("SELECT last_insert_rowid() AS id").id;

    for (const item of sample.items) {
      const menu = get(`SELECT id, name, price FROM menu_items WHERE name = ?`, item.menuName);
      if (!menu) {
        continue;
      }
      run(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, qty, unit_price, line_total, special_instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        orderId,
        menu.id,
        menu.name,
        item.qty,
        menu.price,
        roundMoney(menu.price * item.qty),
        "" // special_instructions
      );
      run(`UPDATE menu_items SET stock = stock - ?, updated_at = ? WHERE id = ?`, item.qty, timestamp, menu.id);
      run(
        `INSERT INTO inventory_movements (menu_item_id, change_qty, reason, created_at)
         VALUES (?, ?, ?, ?)`,
        menu.id,
        -item.qty,
        `Seed sale CM-${String(orderNumber).padStart(4, "0")}`,
        timestamp
      );
    }

    if (table) {
      run(
        `UPDATE tables SET status = ?, active_order_id = ?, updated_at = ? WHERE id = ?`,
        sample.status === "completed" ? "free" : "occupied",
        sample.status === "completed" ? null : orderId,
        timestamp,
        table.id
      );
    }
  }
}

module.exports = {
  createStore,
  createHttpError
};
