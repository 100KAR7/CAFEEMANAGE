/**
 * MongoDB Database Module for CafeMaster
 * Full operations data store for CafeMaster restaurant OS.
 */

const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("node:crypto");

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
const VALID_ROLES = new Set(["manager", "chef", "waiter", "barista", "staff"]);
const VALID_RESERVATION_STATUSES = new Set(["confirmed", "seated", "completed", "cancelled", "no-show"]);
const VALID_PURCHASE_ORDER_STATUSES = new Set(["draft", "sent", "received", "cancelled"]);
const ORDER_STATUS_TRANSITIONS = {
  placed: new Set(["preparing", "served", "completed", "cancelled"]),
  preparing: new Set(["served", "completed", "cancelled"]),
  served: new Set(["completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set()
};

const DEFAULT_EMPLOYEE = {
  fullName: "CafeMaster Admin",
  email: "admin@cafemaster.local",
  password: "Cafe@12345",
  role: "manager",
  hourlyRate: 25.00
};

const SESSION_TTL_HOURS = 12;

function nowIso() {
  return new Date().toISOString();
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
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
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived, "utf8"), Buffer.from(expectedHex, "utf8"));
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)) {
    return new ObjectId(id);
  }
  return null;
}

function idQuery(id) {
  const objId = toObjectId(id);
  if (objId) {
    return { $or: [{ _id: objId }, { _id: String(id) }, { id: String(id) }] };
  }
  return { $or: [{ _id: String(id) }, { id: String(id) }] };
}

function toId(doc) {
  if (!doc) return null;
  if (Array.isArray(doc)) {
    return doc.map(toId);
  }

  const { _id, ...rest } = doc;
  const result = {
    id: _id ? _id.toString() : rest.id || null,
    ...rest
  };

  // Convert snake_case to camelCase for key fields
  if (result.order_type !== undefined) { result.orderType = result.order_type; delete result.order_type; }
  if (result.table_id !== undefined) { result.tableId = result.table_id; delete result.table_id; }
  if (result.service_charge !== undefined) { result.serviceCharge = result.service_charge; delete result.service_charge; }
  if (result.tax_rate !== undefined) { result.taxRate = result.tax_rate; delete result.tax_rate; }
  if (result.payment_method !== undefined) { result.paymentMethod = result.payment_method; delete result.payment_method; }
  if (result.payment_status !== undefined) { result.paymentStatus = result.payment_status; delete result.payment_status; }
  if (result.employee_id !== undefined) { result.employeeId = result.employee_id; delete result.employee_id; }
  if (result.customer_id !== undefined) { result.customerId = result.customer_id; delete result.customer_id; }
  if (result.created_at !== undefined) { result.createdAt = result.created_at; delete result.created_at; }
  if (result.updated_at !== undefined) { result.updatedAt = result.updated_at; delete result.updated_at; }
  if (result.completed_at !== undefined) { result.completedAt = result.completed_at; delete result.completed_at; }
  if (result.full_name !== undefined) { result.fullName = result.full_name; delete result.full_name; }
  if (result.hourly_rate !== undefined) { result.hourlyRate = result.hourly_rate; delete result.hourly_rate; }
  if (result.is_active !== undefined) { result.isActive = result.is_active; delete result.is_active; }
  if (result.last_login_at !== undefined) { result.lastLoginAt = result.last_login_at; delete result.last_login_at; }
  if (result.total_spent !== undefined) { result.totalSpent = result.total_spent; delete result.total_spent; }
  if (result.loyalty_points !== undefined) { result.loyaltyPoints = result.loyalty_points; delete result.loyalty_points; }
  if (result.last_visit !== undefined) { result.lastVisit = result.last_visit; delete result.last_visit; }
  if (result.min_stock !== undefined) { result.minStock = result.min_stock; delete result.min_stock; }
  if (result.prep_time !== undefined) { result.prepTime = result.prep_time; delete result.prep_time; }
  if (result.contact_name !== undefined) { result.contactName = result.contact_name; delete result.contact_name; }
  if (result.active_order_id !== undefined) { result.activeOrderId = result.active_order_id; delete result.active_order_id; }
  if (result.total_amount !== undefined) { result.totalAmount = result.total_amount; delete result.total_amount; }
  if (result.expected_delivery !== undefined) { result.expectedDelivery = result.expected_delivery; delete result.expected_delivery; }
  if (result.reservation_time !== undefined) { result.reservationTime = result.reservation_time; delete result.reservation_time; }
  if (result.party_size !== undefined) { result.partySize = result.party_size; delete result.party_size; }
  if (result.customer_name !== undefined) { result.customerName = result.customer_name; delete result.customer_name; }
  if (result.customer_phone !== undefined) { result.customerPhone = result.customer_phone; delete result.customer_phone; }
  if (result.is_read !== undefined) { result.isRead = result.is_read; delete result.is_read; }
  if (result.order_number !== undefined) { result.orderNumber = result.order_number; delete result.order_number; }

  return result;
}

const clientPool = new Map();

function createStore(connectionString = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cafemaster") {
  let clientInstance = null;
  let dbInstance = null;

  async function getDb() {
    if (dbInstance) {
      return dbInstance;
    }

    if (clientPool.has(connectionString)) {
      clientInstance = clientPool.get(connectionString);
    } else {
      clientInstance = new MongoClient(connectionString);
      await clientInstance.connect();
      clientPool.set(connectionString, clientInstance);
    }

    dbInstance = clientInstance.db();
    return dbInstance;
  }

  async function createIndexes(db) {
    try {
      await db.collection("employees").createIndex({ email: 1 }, { unique: true });
      await db.collection("employee_sessions").createIndex({ token_hash: 1 }, { unique: true });
      await db.collection("employee_sessions").createIndex({ expires_at: 1 });
      await db.collection("menu_items").createIndex({ name: 1 }, { unique: true });
      await db.collection("tables").createIndex({ name: 1 }, { unique: true });
      await db.collection("customers").createIndex({ phone: 1 }, { unique: true, sparse: true });
      await db.collection("orders").createIndex({ order_number: 1 }, { unique: true });
      await db.collection("orders").createIndex({ created_at: -1 });
      await db.collection("order_items").createIndex({ order_id: 1 });
      await db.collection("reservations").createIndex({ reservation_time: 1 });
      await db.collection("employee_shifts").createIndex({ employee_id: 1, start_time: 1 });
      await db.collection("audit_logs").createIndex({ created_at: -1 });
      await db.collection("notifications").createIndex({ is_read: 1, created_at: -1 });
    } catch (e) {
      // Indexes might already exist
    }
  }

  async function seedDatabase(db) {
    const timestamp = nowIso();

    // 1. Settings
    const existingSettings = await db.collection("settings").findOne({ key: "app_config" });
    if (!existingSettings) {
      await db.collection("settings").insertOne({
        key: "app_config",
        name: "CafeMaster",
        tagline: "Restaurant Operations OS",
        currency: "INR",
        tax_rate: 0.05,
        service_charge: 0.05,
        created_at: timestamp,
        updated_at: timestamp
      });
    }

    // 2. Admin Employee
    const adminCount = await db.collection("employees").countDocuments();
    if (adminCount === 0) {
      await db.collection("employees").insertOne({
        full_name: DEFAULT_EMPLOYEE.fullName,
        email: normalizeEmail(DEFAULT_EMPLOYEE.email),
        password_hash: hashPassword(DEFAULT_EMPLOYEE.password),
        role: DEFAULT_EMPLOYEE.role,
        hourly_rate: DEFAULT_EMPLOYEE.hourlyRate,
        salary: 3000,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp
      });

      if (DEFAULT_EMPLOYEES && DEFAULT_EMPLOYEES.length > 0) {
        for (const emp of DEFAULT_EMPLOYEES) {
          if (emp.email !== DEFAULT_EMPLOYEE.email) {
            await db.collection("employees").insertOne({
              full_name: emp.fullName,
              email: normalizeEmail(emp.email),
              password_hash: hashPassword(emp.password || "Staff@12345"),
              role: emp.role || "staff",
              hourly_rate: emp.hourlyRate || 15.00,
              salary: emp.salary || 2000,
              is_active: true,
              created_at: timestamp,
              updated_at: timestamp
            });
          }
        }
      }
    }

    // 3. Tables
    const tableCount = await db.collection("tables").countDocuments();
    if (tableCount === 0 && DEFAULT_TABLES) {
      await db.collection("tables").insertMany(
        DEFAULT_TABLES.map((table) => ({
          name: table.name,
          seats: table.seats,
          zone: table.zone,
          status: table.status || "free",
          active_order_id: null,
          created_at: timestamp,
          updated_at: timestamp
        }))
      );
    }

    // 4. Menu Items
    const menuCount = await db.collection("menu_items").countDocuments();
    if (menuCount === 0 && DEFAULT_MENU_ITEMS) {
      await db.collection("menu_items").insertMany(
        DEFAULT_MENU_ITEMS.map((item) => ({
          name: item.name,
          category: item.category,
          description: item.description,
          price: item.price,
          cost: item.cost,
          stock: item.stock,
          min_stock: item.minStock || 5,
          prep_time: item.prepTime || 5,
          available: item.available !== undefined ? Boolean(item.available) : true,
          created_at: timestamp,
          updated_at: timestamp
        }))
      );
    }

    // 5. Customers
    const customerCount = await db.collection("customers").countDocuments();
    if (customerCount === 0 && DEFAULT_CUSTOMERS) {
      await db.collection("customers").insertMany(
        DEFAULT_CUSTOMERS.map((c) => ({
          name: c.name,
          phone: c.phone || null,
          email: c.email || null,
          total_spent: c.totalSpent || 0,
          loyalty_points: c.loyaltyPoints || 0,
          visits: c.visits || 1,
          last_visit: timestamp,
          created_at: timestamp,
          updated_at: timestamp
        }))
      );
    }

    // 6. Suppliers
    const supplierCount = await db.collection("suppliers").countDocuments();
    if (supplierCount === 0 && DEFAULT_SUPPLIERS) {
      await db.collection("suppliers").insertMany(
        DEFAULT_SUPPLIERS.map((s) => ({
          name: s.name,
          contact_name: s.contactName || null,
          phone: s.phone || null,
          email: s.email || null,
          category: s.category || "General",
          address: s.address || null,
          payment_terms: s.paymentTerms || "Net 30",
          created_at: timestamp,
          updated_at: timestamp
        }))
      );
    }

    // 7. Sample Orders (if none)
    const orderCount = await db.collection("orders").countDocuments();
    if (orderCount === 0 && SAMPLE_ORDERS) {
      const allMenu = await db.collection("menu_items").find({}).toArray();
      const allTables = await db.collection("tables").find({}).toArray();
      const adminEmp = await db.collection("employees").findOne({ email: normalizeEmail(DEFAULT_EMPLOYEE.email) });
      const menuMap = new Map(allMenu.map((m) => [m.name, m]));

      for (let i = 0; i < SAMPLE_ORDERS.length; i++) {
        const sample = SAMPLE_ORDERS[i];
        const orderNumber = `ORD-${new Date().getFullYear()}-${String(1001 + i).padStart(4, "0")}`;
        const table = allTables.find((t) => t.name === sample.tableName) || null;
        const orderTime = new Date(Date.now() - (i + 1) * 3600000).toISOString();

        let subtotal = 0;
        const lineItems = [];

        for (const it of sample.items || []) {
          const mItem = menuMap.get(it.name);
          if (mItem) {
            const lineTotal = roundMoney(mItem.price * it.qty);
            subtotal += lineTotal;
            lineItems.push({
              menu_item_id: mItem._id.toString(),
              item_name: mItem.name,
              category: mItem.category,
              unit_price: mItem.price,
              unit_cost: mItem.cost,
              qty: it.qty,
              line_total: lineTotal,
              created_at: orderTime
            });
          }
        }

        const tax = roundMoney(subtotal * 0.05);
        const serviceCharge = roundMoney(subtotal * 0.05);
        const total = roundMoney(subtotal + tax + serviceCharge);

        const orderResult = await db.collection("orders").insertOne({
          order_number: orderNumber,
          order_type: sample.orderType || "dine-in",
          table_id: table ? table._id.toString() : null,
          table_name: table ? table.name : null,
          status: sample.status || "completed",
          customer_id: null,
          customer_name: sample.customerName || "Walk-in Guest",
          customer_phone: null,
          subtotal,
          discount: 0,
          service_charge: serviceCharge,
          tax,
          total,
          payment_method: sample.paymentMethod || "UPI",
          payment_status: sample.paymentStatus || "paid",
          notes: sample.notes || null,
          employee_id: adminEmp ? adminEmp._id.toString() : null,
          employee_name: adminEmp ? adminEmp.full_name : "Admin",
          created_at: orderTime,
          updated_at: orderTime
        });

        const orderId = orderResult.insertedId.toString();

        if (lineItems.length > 0) {
          await db.collection("order_items").insertMany(
            lineItems.map((li) => ({ ...li, order_id: orderId }))
          );
        }

        if (table && sample.status === "preparing") {
          await db.collection("tables").updateOne(
            { _id: table._id },
            { $set: { status: "occupied", active_order_id: orderId, updated_at: orderTime } }
          );
        }
      }
    }
  }

  const store = {
    dbFilePath: connectionString,

    getDb,

    init: async function() {
      const db = await getDb();
      await createIndexes(db);
      await seedDatabase(db);
      return store;
    },

    close: async function() {
      if (clientInstance) {
        await clientInstance.close();
        clientPool.delete(connectionString);
        clientInstance = null;
        dbInstance = null;
      }
    },

    // ==================== AUTH & SESSIONS ====================\

    authenticateEmployee: async function(email, password) {
      const db = await getDb();
      const employee = await db.collection("employees").findOne({
        email: normalizeEmail(email),
        is_active: true
      });

      if (!employee || !verifyPassword(password, employee.password_hash)) {
        throw createHttpError(401, "Invalid email or password.");
      }

      await db.collection("employees").updateOne(
        { _id: employee._id },
        { $set: { last_login_at: nowIso() } }
      );

      const safeEmployee = toId(employee);
      delete safeEmployee.passwordHash;
      return safeEmployee;
    },

    createEmployeeSession: async function(employeeId) {
      const db = await getDb();
      const token = createSessionToken();
      const tokenHash = hashSessionToken(token);
      const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600000).toISOString();
      const timestamp = nowIso();

      await db.collection("employee_sessions").insertOne({
        token_hash: tokenHash,
        employee_id: String(employeeId),
        created_at: timestamp,
        expires_at: expiresAt,
        last_seen_at: timestamp
      });

      return { token, expiresAt };
    },

    getEmployeeSession: async function(token) {
      if (!token) return null;
      const db = await getDb();
      const now = Date.now();
      const tokenHash = hashSessionToken(token);

      const session = await db.collection("employee_sessions").findOne({ token_hash: tokenHash });
      if (!session) return null;

      if (Date.parse(session.expires_at) <= now) {
        await db.collection("employee_sessions").deleteOne({ _id: session._id });
        return null;
      }

      await db.collection("employee_sessions").updateOne(
        { _id: session._id },
        { $set: { last_seen_at: nowIso() } }
      );

      const employee = await db.collection("employees").findOne({
        ...idQuery(session.employee_id),
        is_active: true
      });

      if (!employee) return null;

      const safeEmployee = toId(employee);
      delete safeEmployee.passwordHash;

      return {
        token,
        expiresAt: session.expires_at,
        employee: safeEmployee
      };
    },

    deleteEmployeeSession: async function(token) {
      if (!token) return;
      const db = await getDb();
      const tokenHash = hashSessionToken(token);
      await db.collection("employee_sessions").deleteOne({ token_hash: tokenHash });
    },

    getEmployeeByEmail: async function(email) {
      const db = await getDb();
      const employee = await db.collection("employees").findOne({ email: normalizeEmail(email) });
      return employee ? { ...toId(employee), passwordHash: employee.password_hash } : null;
    },

    // ==================== SETTINGS ====================\

    getSettings: async function() {
      const db = await getDb();
      const settings = await db.collection("settings").findOne({ key: "app_config" });
      if (!settings) {
        return {
          name: "CafeMaster",
          tagline: "Restaurant Operations OS",
          currency: "INR",
          taxRate: 0.05,
          serviceCharge: 0.05
        };
      }
      return toId(settings);
    },

    updateSettings: async function(payload, employeeId = null) {
      const db = await getDb();
      const oldSettings = await store.getSettings();

      const updateData = {
        name: String(payload.name || oldSettings.name || "CafeMaster").trim(),
        tagline: String(payload.tagline || oldSettings.tagline || "").trim(),
        currency: String(payload.currency || oldSettings.currency || "INR").trim().toUpperCase(),
        tax_rate: payload.taxRate !== undefined ? Math.max(0, Number(payload.taxRate)) : (oldSettings.taxRate ?? 0.05),
        service_charge: payload.serviceCharge !== undefined ? Math.max(0, Number(payload.serviceCharge)) : (oldSettings.serviceCharge ?? 0.05),
        updated_at: nowIso()
      };

      await db.collection("settings").updateOne(
        { key: "app_config" },
        { $set: updateData },
        { upsert: true }
      );

      const updated = await store.getSettings();
      await logAuditAction(employeeId, "update", "settings", "app_config", oldSettings, updated);
      return updated;
    },

    // ==================== MENU ITEMS ====================\

    listMenuItems: async function() {
      const db = await getDb();
      const items = await db.collection("menu_items").find({}).sort({ category: 1, name: 1 }).toArray();
      return toId(items);
    },

    getMenuItem: async function(id) {
      const db = await getDb();
      const item = await db.collection("menu_items").findOne(idQuery(id));
      return toId(item);
    },

    createMenuItem: async function(payload) {
      const name = String(payload.name || "").trim();
      const category = String(payload.category || "General").trim();
      const price = Number(payload.price || 0);
      const cost = Number(payload.cost || 0);
      const stock = Number(payload.stock || 0);
      const minStock = payload.minStock !== undefined ? Number(payload.minStock) : 5;
      const prepTime = payload.prepTime !== undefined ? Number(payload.prepTime) : 5;
      const available = payload.available !== undefined ? Boolean(payload.available) : true;
      const description = String(payload.description || "").trim();

      if (!name) throw createHttpError(400, "Item name is required.");
      if (price <= 0) throw createHttpError(400, "Price must be greater than 0.");

      const db = await getDb();
      const timestamp = nowIso();
      const doc = {
        name,
        category,
        description,
        price,
        cost,
        stock,
        min_stock: minStock,
        prep_time: prepTime,
        available,
        created_at: timestamp,
        updated_at: timestamp
      };

      const result = await db.collection("menu_items").insertOne(doc);
      const createdItem = toId({ ...doc, _id: result.insertedId });
      await logAuditAction(null, "create", "menu_item", result.insertedId.toString(), null, createdItem);
      return createdItem;
    },

    updateMenuItem: async function(id, payload) {
      const db = await getDb();
      const query = idQuery(id);
      const oldItem = await db.collection("menu_items").findOne(query);
      if (!oldItem) throw createHttpError(404, "Menu item not found.");

      const updateData = { updated_at: nowIso() };
      if (payload.name !== undefined) updateData.name = String(payload.name).trim();
      if (payload.category !== undefined) updateData.category = String(payload.category).trim();
      if (payload.description !== undefined) updateData.description = String(payload.description).trim();
      if (payload.price !== undefined) updateData.price = Number(payload.price);
      if (payload.cost !== undefined) updateData.cost = Number(payload.cost);
      if (payload.stock !== undefined) updateData.stock = Number(payload.stock);
      if (payload.minStock !== undefined) updateData.min_stock = Number(payload.minStock);
      if (payload.prepTime !== undefined) updateData.prep_time = Number(payload.prepTime);
      if (payload.available !== undefined) updateData.available = Boolean(payload.available);

      await db.collection("menu_items").updateOne(query, { $set: updateData });
      const updatedItem = await db.collection("menu_items").findOne(query);
      await logAuditAction(null, "update", "menu_item", String(id), toId(oldItem), toId(updatedItem));
      return toId(updatedItem);
    },

    restockItem: async function(id, quantity, reason = "Supplier restock", employeeId = null) {
      const qty = Number(quantity || 0);
      if (qty <= 0) throw createHttpError(400, "Restock quantity must be greater than 0.");

      const db = await getDb();
      const query = idQuery(id);
      const oldItem = await db.collection("menu_items").findOne(query);
      if (!oldItem) throw createHttpError(404, "Menu item not found.");

      const timestamp = nowIso();
      await db.collection("menu_items").updateOne(query, {
        $inc: { stock: qty },
        $set: { updated_at: timestamp }
      });

      const updatedItem = await db.collection("menu_items").findOne(query);

      await db.collection("inventory_movements").insertOne({
        menu_item_id: oldItem._id.toString(),
        movement_type: "restock",
        employee_id: employeeId ? String(employeeId) : null,
        change_qty: qty,
        reason: String(reason || "Restock").trim(),
        reference_id: null,
        created_at: timestamp
      });

      await logAuditAction(employeeId, "restock", "menu_item", String(id), null, { quantity: qty, reason });
      return toId(updatedItem);
    },

    // ==================== TABLES ====================\

    listTables: async function() {
      const db = await getDb();
      const tables = await db.collection("tables").find({}).sort({ name: 1 }).toArray();
      return toId(tables);
    },

    getTable: async function(id) {
      const db = await getDb();
      const table = await db.collection("tables").findOne(idQuery(id));
      return toId(table);
    },

    updateTableState: async function(id, updates) {
      const db = await getDb();
      if (updates.status && !VALID_TABLE_STATUSES.has(updates.status)) {
        throw createHttpError(400, `Invalid table status. Must be one of: ${Array.from(VALID_TABLE_STATUSES).join(", ")}`);
      }

      const query = idQuery(id);
      const oldTable = await db.collection("tables").findOne(query);
      if (!oldTable) throw createHttpError(404, "Table not found.");

      const updateData = { updated_at: nowIso() };
      if (updates.status) updateData.status = updates.status;
      if (updates.activeOrderId !== undefined) updateData.active_order_id = updates.activeOrderId;

      await db.collection("tables").updateOne(query, { $set: updateData });
      const updatedTable = await db.collection("tables").findOne(query);

      await logAuditAction(null, "update", "table", String(id), toId(oldTable), toId(updatedTable));
      return toId(updatedTable);
    },

    // ==================== CUSTOMERS ====================\

    listCustomers: async function() {
      const db = await getDb();
      const customers = await db.collection("customers").find({}).sort({ visits: -1, last_visit: -1 }).toArray();
      return toId(customers);
    },

    getCustomer: async function(id) {
      const db = await getDb();
      const customer = await db.collection("customers").findOne(idQuery(id));
      return toId(customer);
    },

    createCustomer: async function(payload, employeeId = null) {
      const name = String(payload.name || "").trim();
      const phone = payload.phone ? String(payload.phone).trim() : null;
      const email = payload.email ? String(payload.email).trim().toLowerCase() : null;

      if (!name) throw createHttpError(400, "Customer name is required.");

      const db = await getDb();
      const timestamp = nowIso();

      const doc = {
        name,
        phone,
        email,
        total_spent: 0,
        loyalty_points: 0,
        visits: 1,
        last_visit: timestamp,
        created_at: timestamp,
        updated_at: timestamp
      };

      const result = await db.collection("customers").insertOne(doc);
      const created = toId({ ...doc, _id: result.insertedId });
      await logAuditAction(employeeId, "create", "customer", result.insertedId.toString(), null, created);
      return created;
    },

    updateCustomer: async function(id, payload, employeeId = null) {
      const db = await getDb();
      const query = idQuery(id);
      const oldCustomer = await db.collection("customers").findOne(query);
      if (!oldCustomer) throw createHttpError(404, "Customer not found.");

      const updateData = { updated_at: nowIso() };
      if (payload.name !== undefined) updateData.name = String(payload.name).trim();
      if (payload.phone !== undefined) updateData.phone = payload.phone ? String(payload.phone).trim() : null;
      if (payload.email !== undefined) updateData.email = payload.email ? String(payload.email).trim().toLowerCase() : null;
      if (payload.loyaltyPoints !== undefined) updateData.loyalty_points = Number(payload.loyaltyPoints);

      await db.collection("customers").updateOne(query, { $set: updateData });
      const updated = await db.collection("customers").findOne(query);
      await logAuditAction(employeeId, "update", "customer", String(id), toId(oldCustomer), toId(updated));
      return toId(updated);
    },

    // ==================== ORDERS & TRANSACTIONS ====================\

    listOrders: async function() {
      const db = await getDb();
      const [orders, orderItems] = await Promise.all([
        db.collection("orders").find({}).sort({ created_at: -1 }).toArray(),
        db.collection("order_items").find({}).toArray()
      ]);

      const itemsByOrder = new Map();
      for (const item of orderItems) {
        const orderId = String(item.order_id);
        if (!itemsByOrder.has(orderId)) {
          itemsByOrder.set(orderId, []);
        }
        itemsByOrder.get(orderId).push({
          id: item._id.toString(),
          orderId,
          menuItemId: String(item.menu_item_id),
          name: item.item_name,
          category: item.category,
          price: item.unit_price,
          cost: item.unit_cost,
          qty: item.qty,
          lineTotal: item.line_total
        });
      }

      return orders.map((o) => {
        const norm = toId(o);
        norm.items = itemsByOrder.get(o._id.toString()) || [];
        return norm;
      });
    },

    getOrder: async function(id) {
      const db = await getDb();
      const query = idQuery(id);
      const order = await db.collection("orders").findOne(query);
      if (!order) return null;

      const items = await db.collection("order_items").find({ order_id: order._id.toString() }).toArray();
      const norm = toId(order);
      norm.items = items.map((item) => ({
        id: item._id.toString(),
        orderId: order._id.toString(),
        menuItemId: String(item.menu_item_id),
        name: item.item_name,
        category: item.category,
        price: item.unit_price,
        cost: item.unit_cost,
        qty: item.qty,
        lineTotal: item.line_total
      }));
      return norm;
    },

    createOrder: async function(payload, employeeId = null) {
      const {
        orderType = "dine-in",
        tableId = null,
        discount = 0,
        paymentMethod = "UPI",
        paymentStatus = "paid",
        notes = "",
        customer = null,
        items = []
      } = payload;

      if (!items || items.length === 0) {
        throw createHttpError(400, "An order must contain at least one item.");
      }
      if (orderType === "dine-in" && !tableId) {
        throw createHttpError(400, "A table must be selected for dine-in orders.");
      }

      const db = await getDb();
      const timestamp = nowIso();

      // Fetch Menu Items
      const menuItemIds = items.map((it) => it.menuItemId || it.id);
      const menuItems = await db.collection("menu_items").find({
        $or: menuItemIds.map((id) => idQuery(id))
      }).toArray();

      const menuMap = new Map(menuItems.map((m) => [m._id.toString(), m]));
      for (const m of menuItems) {
        if (m.id) menuMap.set(String(m.id), m);
      }

      // Check stock
      for (const it of items) {
        const id = String(it.menuItemId || it.id);
        const menuItem = menuMap.get(id);
        if (!menuItem) {
          throw createHttpError(404, `Menu item '${id}' not found.`);
        }
        if (!menuItem.available) {
          throw createHttpError(400, `'${menuItem.name}' is currently not available.`);
        }
        if (menuItem.stock < it.qty) {
          throw createHttpError(400, `Insufficient stock for '${menuItem.name}'. Only ${menuItem.stock} available.`);
        }
      }

      // Get Table Info
      let tableDoc = null;
      if (tableId) {
        tableDoc = await db.collection("tables").findOne(idQuery(tableId));
        if (!tableDoc) throw createHttpError(404, "Selected table not found.");
      }

      // Get Settings for Tax & Service Charge
      const settings = await store.getSettings();
      const taxRate = Number(settings.taxRate ?? 0.05);
      const serviceChargeRate = Number(settings.serviceCharge ?? 0.05);

      // Calculate Totals
      let subtotal = 0;
      const orderLines = [];

      for (const it of items) {
        const id = String(it.menuItemId || it.id);
        const menuItem = menuMap.get(id);
        const lineTotal = roundMoney(menuItem.price * it.qty);
        subtotal += lineTotal;
        orderLines.push({
          menu_item_id: menuItem._id.toString(),
          item_name: menuItem.name,
          category: menuItem.category,
          unit_price: menuItem.price,
          unit_cost: menuItem.cost,
          qty: it.qty,
          line_total: lineTotal,
          created_at: timestamp
        });
      }

      const discountAmt = Math.max(0, Number(discount || 0));
      const taxableAmount = Math.max(0, subtotal - discountAmt);
      const serviceCharge = roundMoney(taxableAmount * serviceChargeRate);
      const tax = roundMoney(taxableAmount * taxRate);
      const total = roundMoney(taxableAmount + serviceCharge + tax);

      // Customer handling
      let customerId = null;
      let customerName = customer?.name || "Walk-in Guest";
      let customerPhone = customer?.phone || null;

      if (customerPhone) {
        const existingCust = await db.collection("customers").findOne({ phone: String(customerPhone).trim() });
        if (existingCust) {
          customerId = existingCust._id.toString();
          customerName = existingCust.name;
          await db.collection("customers").updateOne(
            { _id: existingCust._id },
            {
              $inc: {
                total_spent: total,
                loyalty_points: Math.floor(total / 10),
                visits: 1
              },
              $set: { last_visit: timestamp, updated_at: timestamp }
            }
          );
        } else {
          const newCustResult = await db.collection("customers").insertOne({
            name: customerName,
            phone: String(customerPhone).trim(),
            email: customer?.email || null,
            total_spent: total,
            loyalty_points: Math.floor(total / 10),
            visits: 1,
            last_visit: timestamp,
            created_at: timestamp,
            updated_at: timestamp
          });
          customerId = newCustResult.insertedId.toString();
        }
      }

      // Generate Order Number
      const countToday = await db.collection("orders").countDocuments();
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(countToday + 1001).padStart(4, "0")}`;

      // Get Employee info
      let employeeName = "System Staff";
      if (employeeId) {
        const emp = await db.collection("employees").findOne(idQuery(employeeId));
        if (emp) employeeName = emp.full_name;
      }

      // Insert Order
      const orderDoc = {
        order_number: orderNumber,
        order_type: orderType,
        table_id: tableDoc ? tableDoc._id.toString() : null,
        table_name: tableDoc ? tableDoc.name : null,
        status: "placed",
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        subtotal,
        discount: discountAmt,
        service_charge: serviceCharge,
        tax,
        total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: String(notes || "").trim() || null,
        employee_id: employeeId ? String(employeeId) : null,
        employee_name: employeeName,
        created_at: timestamp,
        updated_at: timestamp
      };

      const orderResult = await db.collection("orders").insertOne(orderDoc);
      const orderId = orderResult.insertedId.toString();

      // Insert Order Items
      if (orderLines.length > 0) {
        await db.collection("order_items").insertMany(
          orderLines.map((li) => ({ ...li, order_id: orderId }))
        );
      }

      // Decrement Menu Item Stock & Record Inventory Movement
      for (const it of items) {
        const id = String(it.menuItemId || it.id);
        const menuItem = menuMap.get(id);

        await db.collection("menu_items").updateOne(
          { _id: menuItem._id },
          {
            $inc: { stock: -it.qty },
            $set: { updated_at: timestamp }
          }
        );

        await db.collection("inventory_movements").insertOne({
          menu_item_id: menuItem._id.toString(),
          movement_type: "sale",
          employee_id: employeeId ? String(employeeId) : null,
          change_qty: -it.qty,
          reason: `Order ${orderNumber}`,
          reference_id: orderId,
          created_at: timestamp
        });
      }

      // Update Table Status to occupied
      if (tableDoc) {
        await db.collection("tables").updateOne(
          { _id: tableDoc._id },
          {
            $set: {
              status: "occupied",
              active_order_id: orderId,
              updated_at: timestamp
            }
          }
        );
      }

      await logAuditAction(employeeId, "create", "order", orderId, null, { orderNumber, total, items: items.length });

      return store.getOrder(orderId);
    },

    updateOrderStatus: async function(id, payload, employeeId = null) {
      const status = String(payload.status || "").trim().toLowerCase();
      if (!VALID_ORDER_STATUSES.has(status)) {
        throw createHttpError(400, `Invalid order status. Must be one of: ${Array.from(VALID_ORDER_STATUSES).join(", ")}`);
      }

      const db = await getDb();
      const query = idQuery(id);
      const oldOrder = await db.collection("orders").findOne(query);
      if (!oldOrder) throw createHttpError(404, "Order not found.");

      const allowedNext = ORDER_STATUS_TRANSITIONS[oldOrder.status];
      if (allowedNext && !allowedNext.has(status) && oldOrder.status !== status) {
        throw createHttpError(409, `Cannot transition order status from '${oldOrder.status}' to '${status}'.`);
      }

      const timestamp = nowIso();
      const updateData = {
        status,
        updated_at: timestamp
      };

      if (status === "completed") {
        updateData.completed_at = timestamp;
      }

      await db.collection("orders").updateOne(query, { $set: updateData });

      // Free table if order completed or cancelled
      if (["completed", "cancelled"].includes(status) && oldOrder.table_id) {
        await db.collection("tables").updateOne(
          idQuery(oldOrder.table_id),
          {
            $set: {
              status: "free",
              active_order_id: null,
              updated_at: timestamp
            }
          }
        );
      }

      await logAuditAction(employeeId, "update_status", "order", String(id), { status: oldOrder.status }, { status });
      return store.getOrder(oldOrder._id.toString());
    },

    // ==================== EMPLOYEES ====================\

    listEmployees: async function() {
      const db = await getDb();
      const employees = await db.collection("employees").find({}).sort({ full_name: 1 }).toArray();
      return toId(employees).map((emp) => {
        delete emp.passwordHash;
        delete emp.password_hash;
        return emp;
      });
    },

    getEmployee: async function(id) {
      const db = await getDb();
      const employee = await db.collection("employees").findOne(idQuery(id));
      if (!employee) return null;
      const safe = toId(employee);
      delete safe.passwordHash;
      delete safe.password_hash;
      return safe;
    },

    createEmployee: async function(payload) {
      const fullName = String(payload.fullName || "").trim();
      const email = normalizeEmail(payload.email);
      const role = String(payload.role || "staff").trim().toLowerCase();
      const hourlyRate = Math.max(0, Number(payload.hourlyRate || 0));
      const salary = payload.salary !== undefined ? Math.max(0, Number(payload.salary)) : 0;
      const password = String(payload.password || "");

      if (!fullName) throw createHttpError(400, "Employee full name is required.");
      if (!email) throw createHttpError(400, "Employee email is required.");
      if (!password || password.length < 8) throw createHttpError(400, "Password must be at least 8 characters.");
      if (!VALID_ROLES.has(role)) throw createHttpError(400, `Invalid role. Must be one of: ${Array.from(VALID_ROLES).join(", ")}`);

      const db = await getDb();
      const existing = await db.collection("employees").findOne({ email });
      if (existing) throw createHttpError(409, "That employee email is already in use.");

      const timestamp = nowIso();
      const doc = {
        full_name: fullName,
        email,
        password_hash: hashPassword(password),
        role,
        hourly_rate: hourlyRate,
        salary,
        is_active: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
        created_at: timestamp,
        updated_at: timestamp
      };

      const result = await db.collection("employees").insertOne(doc);
      const newEmployee = await db.collection("employees").findOne({ _id: result.insertedId });
      const safe = toId(newEmployee);
      delete safe.passwordHash;
      await logAuditAction(null, "create", "employee", result.insertedId.toString(), null, safe);
      return safe;
    },

    updateEmployee: async function(id, updates) {
      const db = await getDb();
      const query = idQuery(id);
      const oldEmployee = await db.collection("employees").findOne(query);
      if (!oldEmployee) throw createHttpError(404, "Employee not found.");

      const timestamp = nowIso();
      const updateData = { updated_at: timestamp };

      if (updates.fullName) updateData.full_name = String(updates.fullName).trim();
      if (updates.role) {
        const role = String(updates.role).trim().toLowerCase();
        if (!VALID_ROLES.has(role)) throw createHttpError(400, "Invalid employee role.");
        updateData.role = role;
      }
      if (updates.hourlyRate !== undefined) updateData.hourly_rate = Math.max(0, Number(updates.hourlyRate));
      if (updates.salary !== undefined) updateData.salary = Math.max(0, Number(updates.salary));
      if (updates.isActive !== undefined) updateData.is_active = Boolean(updates.isActive);
      if (updates.password) {
        if (String(updates.password).length < 8) throw createHttpError(400, "Password must be at least 8 characters.");
        updateData.password_hash = hashPassword(updates.password);
      }

      await db.collection("employees").updateOne(query, { $set: updateData });
      const updated = await db.collection("employees").findOne(query);
      const safe = toId(updated);
      delete safe.passwordHash;

      await logAuditAction(null, "update", "employee", String(id), toId(oldEmployee), safe);
      return safe;
    },

    // ==================== EMPLOYEE SHIFTS ====================\

    createEmployeeShift: async function(payload) {
      const employeeId = payload.employeeId ? String(payload.employeeId) : null;
      const startTime = payload.startTime;
      const endTime = payload.endTime;
      const role = String(payload.role || "service").trim();
      const notes = String(payload.notes || "").trim();

      if (!employeeId || !startTime || !endTime) {
        throw createHttpError(400, "Employee ID, start time, and end time are required.");
      }

      const db = await getDb();
      const employee = await db.collection("employees").findOne(idQuery(employeeId));
      if (!employee) throw createHttpError(404, "Employee not found.");

      const timestamp = nowIso();
      const result = await db.collection("employee_shifts").insertOne({
        employee_id: employee._id.toString(),
        start_time: startTime,
        end_time: endTime,
        role,
        notes,
        created_at: timestamp
      });

      const shiftId = result.insertedId.toString();
      await logAuditAction(null, "create", "employee_shift", shiftId, null, {
        id: shiftId,
        employeeId: employee._id.toString(),
        startTime,
        endTime,
        role
      });
      return shiftId;
    },

    listEmployeeShifts: async function(employeeId, dateFrom, dateTo) {
      const db = await getDb();
      const query = {};
      if (employeeId) query.employee_id = String(employeeId);
      if (dateFrom || dateTo) {
        query.start_time = {};
        if (dateFrom) query.start_time.$gte = dateFrom;
        if (dateTo) query.start_time.$lte = dateTo;
      }

      const [shifts, employees] = await Promise.all([
        db.collection("employee_shifts").find(query).sort({ start_time: -1 }).toArray(),
        db.collection("employees").find({}).toArray()
      ]);

      const empMap = new Map(employees.map((e) => [e._id.toString(), e.full_name]));

      return shifts.map((shift) => {
        const norm = toId(shift);
        norm.employeeName = empMap.get(String(shift.employee_id)) || "Unknown Staff";
        return norm;
      });
    },

    // ==================== RESERVATIONS ====================\

    createReservation: async function(payload) {
      const customerName = String(payload.customerName || "").trim();
      const customerPhone = payload.customerPhone ? String(payload.customerPhone).trim() : null;
      const tableId = payload.tableId ? String(payload.tableId) : null;
      const partySize = Math.max(1, Number(payload.partySize || 2));
      const reservationTime = payload.reservationTime;
      const durationMinutes = Number(payload.durationMinutes || 90);
      const notes = String(payload.notes || "").trim();
      const status = payload.status || "confirmed";

      if (!customerName) throw createHttpError(400, "Customer name is required.");
      if (!reservationTime) throw createHttpError(400, "Reservation time is required.");

      const db = await getDb();
      let tableDoc = null;
      if (tableId) {
        tableDoc = await db.collection("tables").findOne(idQuery(tableId));
        if (!tableDoc) throw createHttpError(404, "Table not found.");
      }

      const timestamp = nowIso();
      const result = await db.collection("reservations").insertOne({
        customer_name: customerName,
        customer_phone: customerPhone,
        table_id: tableDoc ? tableDoc._id.toString() : null,
        party_size: partySize,
        reservation_time: reservationTime,
        duration_minutes: durationMinutes,
        status,
        notes,
        created_at: timestamp,
        updated_at: timestamp
      });

      const reservationId = result.insertedId.toString();

      if (tableDoc && (status === "confirmed" || status === "seated")) {
        await db.collection("tables").updateOne(
          { _id: tableDoc._id },
          { $set: { status: "reserved", updated_at: timestamp } }
        );
      }

      await logAuditAction(null, "create", "reservation", reservationId, null, {
        id: reservationId,
        customerName,
        tableId: tableDoc ? tableDoc._id.toString() : null,
        reservationTime
      });
      return reservationId;
    },

    listReservations: async function(dateFrom, dateTo, status) {
      const db = await getDb();
      const query = {};
      if (dateFrom || dateTo) {
        query.reservation_time = {};
        if (dateFrom) query.reservation_time.$gte = dateFrom;
        if (dateTo) query.reservation_time.$lte = dateTo;
      }
      if (status) query.status = status;

      const [reservations, tables] = await Promise.all([
        db.collection("reservations").find(query).sort({ reservation_time: 1 }).toArray(),
        db.collection("tables").find({}).toArray()
      ]);

      const tableMap = new Map(tables.map((t) => [t._id.toString(), t.name]));

      return reservations.map((res) => {
        const norm = toId(res);
        norm.tableName = res.table_id ? tableMap.get(String(res.table_id)) || null : null;
        return norm;
      });
    },

    updateReservation: async function(id, updates) {
      const db = await getDb();
      const query = idQuery(id);
      const oldRes = await db.collection("reservations").findOne(query);
      if (!oldRes) throw createHttpError(404, "Reservation not found.");

      const timestamp = nowIso();
      const updateData = { updated_at: timestamp };

      if (updates.status) {
        const status = String(updates.status).trim().toLowerCase();
        if (!VALID_RESERVATION_STATUSES.has(status)) throw createHttpError(400, "Invalid reservation status.");
        updateData.status = status;
      }
      if (updates.partySize) updateData.party_size = Number(updates.partySize);
      if (updates.reservationTime) updateData.reservation_time = updates.reservationTime;
      if (updates.notes !== undefined) updateData.notes = String(updates.notes).trim();

      await db.collection("reservations").updateOne(query, { $set: updateData });
      const updatedRes = await db.collection("reservations").findOne(query);

      // Handle Table status changes
      if (updates.status && oldRes.table_id) {
        const tableStatus = ["confirmed", "seated"].includes(updates.status) ? "reserved" : "free";
        await db.collection("tables").updateOne(
          idQuery(oldRes.table_id),
          { $set: { status: tableStatus, updated_at: timestamp } }
        );
      }

      await logAuditAction(null, "update", "reservation", String(id), toId(oldRes), toId(updatedRes));
      return toId(updatedRes);
    },

    // ==================== SUPPLIERS ====================\

    listSuppliers: async function() {
      const db = await getDb();
      const suppliers = await db.collection("suppliers").find({}).sort({ name: 1 }).toArray();
      return toId(suppliers);
    },

    createSupplier: async function(payload) {
      const name = String(payload.name || "").trim();
      if (!name) throw createHttpError(400, "Supplier name is required.");

      const db = await getDb();
      const timestamp = nowIso();
      const result = await db.collection("suppliers").insertOne({
        name,
        contact_name: payload.contactName ? String(payload.contactName).trim() : null,
        phone: payload.phone ? String(payload.phone).trim() : null,
        email: payload.email ? String(payload.email).trim().toLowerCase() : null,
        category: payload.category ? String(payload.category).trim() : "General",
        address: payload.address ? String(payload.address).trim() : null,
        payment_terms: payload.paymentTerms ? String(payload.paymentTerms).trim() : "Net 30",
        created_at: timestamp,
        updated_at: timestamp
      });

      const supplierId = result.insertedId.toString();
      await logAuditAction(null, "create", "supplier", supplierId, null, { id: supplierId, name });
      return supplierId;
    },

    // ==================== PURCHASE ORDERS ====================\

    createPurchaseOrder: async function(payload) {
      const supplierId = payload.supplierId ? String(payload.supplierId) : null;
      const employeeId = payload.employeeId ? String(payload.employeeId) : null;
      const status = payload.status || "draft";
      const expectedDelivery = payload.expectedDelivery || null;
      const notes = String(payload.notes || "").trim();

      if (!supplierId) throw createHttpError(400, "Supplier ID is required.");
      if (!VALID_PURCHASE_ORDER_STATUSES.has(status)) throw createHttpError(400, "Invalid purchase order status.");

      const db = await getDb();
      const count = await db.collection("purchase_orders").countDocuments();
      const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1001).padStart(4, "0")}`;
      const timestamp = nowIso();

      const result = await db.collection("purchase_orders").insertOne({
        po_number: poNumber,
        supplier_id: supplierId,
        employee_id: employeeId,
        status,
        total_amount: 0,
        expected_delivery: expectedDelivery,
        notes,
        created_at: timestamp,
        updated_at: timestamp
      });

      const poId = result.insertedId.toString();
      await logAuditAction(employeeId, "create", "purchase_order", poId, null, { poNumber, supplierId });
      return poId;
    },

    addPurchaseOrderItem: async function(payload) {
      const purchaseOrderId = payload.purchaseOrderId ? String(payload.purchaseOrderId) : null;
      const menuItemId = payload.menuItemId ? String(payload.menuItemId) : null;
      const quantity = Number(payload.quantity || 0);
      const unitCost = Number(payload.unitCost || 0);

      if (!purchaseOrderId) throw createHttpError(400, "Purchase order ID is required.");
      if (!menuItemId) throw createHttpError(400, "Menu item ID is required.");
      if (quantity <= 0) throw createHttpError(400, "Quantity must be greater than zero.");
      if (unitCost < 0) throw createHttpError(400, "Unit cost cannot be negative.");

      const db = await getDb();
      const po = await db.collection("purchase_orders").findOne(idQuery(purchaseOrderId));
      if (!po) throw createHttpError(404, "Purchase order not found.");

      const lineTotal = roundMoney(quantity * unitCost);
      const timestamp = nowIso();

      const result = await db.collection("purchase_order_items").insertOne({
        purchase_order_id: po._id.toString(),
        menu_item_id: menuItemId,
        quantity,
        unit_cost: unitCost,
        line_total: lineTotal,
        received_qty: 0,
        created_at: timestamp
      });

      // Recalculate PO total
      const allItems = await db.collection("purchase_order_items").find({ purchase_order_id: po._id.toString() }).toArray();
      const totalAmount = roundMoney(allItems.reduce((sum, it) => sum + Number(it.line_total || 0), 0));

      await db.collection("purchase_orders").updateOne(
        { _id: po._id },
        { $set: { total_amount: totalAmount, updated_at: timestamp } }
      );

      return result.insertedId.toString();
    },

    listPurchaseOrders: async function(status) {
      const db = await getDb();
      const query = {};
      if (status) query.status = status;

      const [pos, suppliers, employees, items, menuItems] = await Promise.all([
        db.collection("purchase_orders").find(query).sort({ created_at: -1 }).toArray(),
        db.collection("suppliers").find({}).toArray(),
        db.collection("employees").find({}).toArray(),
        db.collection("purchase_order_items").find({}).toArray(),
        db.collection("menu_items").find({}).toArray()
      ]);

      const supplierMap = new Map(suppliers.map((s) => [s._id.toString(), s.name]));
      const employeeMap = new Map(employees.map((e) => [e._id.toString(), e.full_name]));
      const menuMap = new Map(menuItems.map((m) => [m._id.toString(), m.name]));

      const itemsByPo = new Map();
      for (const item of items) {
        const poId = String(item.purchase_order_id);
        if (!itemsByPo.has(poId)) itemsByPo.set(poId, []);
        itemsByPo.get(poId).push({
          id: item._id.toString(),
          purchaseOrderId: poId,
          menuItemId: String(item.menu_item_id),
          menuItemName: menuMap.get(String(item.menu_item_id)) || "Unknown",
          quantity: item.quantity,
          unitCost: item.unit_cost,
          lineTotal: item.line_total,
          receivedQty: item.received_qty
        });
      }

      return pos.map((po) => {
        const norm = toId(po);
        norm.supplierName = po.supplier_id ? supplierMap.get(String(po.supplier_id)) || null : null;
        norm.employeeName = po.employee_id ? employeeMap.get(String(po.employee_id)) || null : null;
        norm.items = itemsByPo.get(po._id.toString()) || [];
        return norm;
      });
    },

    // ==================== AUDIT LOGS ====================\

    listAuditLogs: async function(entityType, entityId, limit = 100) {
      const db = await getDb();
      const query = {};
      if (entityType) query.entity_type = entityType;
      if (entityId) query.entity_id = String(entityId);

      const logs = await db.collection("audit_logs").find(query).sort({ created_at: -1 }).limit(Number(limit) || 100).toArray();
      return toId(logs);
    },

    // ==================== NOTIFICATIONS ====================\

    createNotification: async function(payload) {
      const db = await getDb();
      const timestamp = nowIso();
      const doc = {
        type: payload.type || "system",
        title: String(payload.title || "").trim(),
        message: String(payload.message || "").trim(),
        priority: payload.priority || "normal",
        is_read: false,
        related_entity_type: payload.relatedEntityType || null,
        related_entity_id: payload.relatedEntityId ? String(payload.relatedEntityId) : null,
        created_at: timestamp
      };

      const result = await db.collection("notifications").insertOne(doc);
      return toId({ ...doc, _id: result.insertedId });
    },

    listNotifications: async function(unreadOnly = false) {
      const db = await getDb();
      const query = unreadOnly ? { is_read: false } : {};
      const notifications = await db.collection("notifications").find(query).sort({ created_at: -1 }).toArray();
      return toId(notifications);
    },

    markNotificationRead: async function(id) {
      const db = await getDb();
      await db.collection("notifications").updateOne(
        idQuery(id),
        { $set: { is_read: true } }
      );
    },

    // ==================== REPORTS & ALERTS ====================\

    getLowStockAlerts: async function() {
      const db = await getDb();
      const items = await db.collection("menu_items").find({
        $expr: { $lte: ["$stock", "$min_stock"] }
      }).toArray();
      return toId(items);
    },

    generateSalesReport: async function(dateFrom, dateTo, reportType) {
      const db = await getDb();
      const match = {};
      if (dateFrom || dateTo) {
        match.created_at = {};
        if (dateFrom) match.created_at.$gte = dateFrom;
        if (dateTo) match.created_at.$lte = dateTo;
      }

      const orders = await db.collection("orders").find(match).sort({ created_at: -1 }).toArray();
      const totalRevenue = roundMoney(orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0));
      const totalOrders = orders.length;

      const orderIds = orders.map((o) => o._id.toString());
      const orderItems = orderIds.length > 0
        ? await db.collection("order_items").find({ order_id: { $in: orderIds } }).toArray()
        : [];

      const topItemMap = new Map();
      for (const item of orderItems) {
        const name = item.item_name;
        const current = topItemMap.get(name) || { name, quantity: 0, revenue: 0 };
        current.quantity += Number(item.qty || 0);
        current.revenue = roundMoney(current.revenue + Number(item.line_total || 0));
        topItemMap.set(name, current);
      }

      const topItems = Array.from(topItemMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
      const totalCustomers = await db.collection("customers").countDocuments();

      return {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        reportType: reportType || "custom",
        totalSales: totalRevenue,
        totalOrders,
        totalCustomers,
        topItems,
        orders: toId(orders)
      };
    },

    // ==================== DASHBOARD & MASTER BOOTSTRAP ====================\

    getDashboard: async function() {
      const [
        menuItems,
        tables,
        orders,
        customers,
        reservations,
        employees,
        purchaseOrders,
        unreadNotifications
      ] = await Promise.all([
        store.listMenuItems(),
        store.listTables(),
        store.listOrders(),
        store.listCustomers(),
        store.listReservations(),
        store.listEmployees(),
        store.listPurchaseOrders(),
        store.listNotifications(true)
      ]);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const todayOrders = orders.filter((o) => o.createdAt >= todayStart);
      const revenueToday = roundMoney(todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0));
      const activeOrders = orders.filter((o) => ["placed", "preparing", "served"].includes(o.status));
      const occupiedTables = tables.filter((t) => t.status === "occupied").length;
      const lowStockItems = menuItems.filter((i) => isLowStock(i));

      // Calculate total food cost & food cost percent
      let totalFoodCost = 0;
      for (const order of todayOrders) {
        for (const it of order.items || []) {
          totalFoodCost += (Number(it.cost) || 0) * (Number(it.qty) || 1);
        }
      }
      const foodCostPercent = revenueToday > 0 ? Math.round((totalFoodCost / revenueToday) * 100) : 0;

      // Popular items
      const itemSales = new Map();
      for (const order of orders) {
        for (const it of order.items || []) {
          const current = itemSales.get(it.name) || { name: it.name, quantity: 0, revenue: 0 };
          current.quantity += Number(it.qty || 0);
          current.revenue = roundMoney(current.revenue + Number(it.lineTotal || 0));
          itemSales.set(it.name, current);
        }
      }
      const popularItems = Array.from(itemSales.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

      // Payment breakdown
      const paymentBreakdown = { UPI: 0, Cash: 0, Card: 0 };
      for (const o of todayOrders) {
        const method = o.paymentMethod || "UPI";
        paymentBreakdown[method] = roundMoney((paymentBreakdown[method] || 0) + Number(o.total || 0));
      }

      // Kitchen queue
      const kitchenQueue = activeOrders
        .filter((o) => ["placed", "preparing"].includes(o.status))
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          orderType: o.orderType,
          tableName: o.tableName,
          createdAt: o.createdAt,
          items: (o.items || []).map((it) => ({ name: it.name, qty: it.qty }))
        }));

      // Upcoming reservations today
      const upcomingReservations = reservations
        .filter((r) => r.reservationTime >= todayStart && ["confirmed", "seated"].includes(r.status))
        .slice(0, 5);

      // Customer spotlight
      const customerSpotlight = customers.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        visits: c.visits,
        loyaltyPoints: c.loyaltyPoints,
        totalSpent: c.totalSpent
      }));

      return {
        stats: {
          revenueToday,
          ordersToday: todayOrders.length,
          activeOrders: activeOrders.length,
          kitchenQueue: kitchenQueue.length,
          reservationsToday: upcomingReservations.length,
          staffCount: employees.filter((e) => e.isActive).length,
          foodCostPercent,
          averageTicket: todayOrders.length > 0 ? roundMoney(revenueToday / todayOrders.length) : 0,
          totalTables: tables.length,
          occupiedTables,
          lowStockCount: lowStockItems.length,
          unreadAlerts: unreadNotifications.length
        },
        recentOrders: orders.slice(0, 6),
        kitchenQueue,
        lowStockItems: lowStockItems.slice(0, 5),
        popularItems,
        upcomingReservations,
        tableSnapshot: tables,
        customerSpotlight,
        paymentBreakdown
      };
    },

    getBootstrap: async function() {
      const [
        settings,
        menuItems,
        tables,
        customers,
        orders,
        employees,
        shifts,
        reservations,
        suppliers,
        purchaseOrders,
        notifications,
        auditLogs
      ] = await Promise.all([
        store.getSettings(),
        store.listMenuItems(),
        store.listTables(),
        store.listCustomers(),
        store.listOrders(),
        store.listEmployees(),
        store.listEmployeeShifts(),
        store.listReservations(),
        store.listSuppliers(),
        store.listPurchaseOrders(),
        store.listNotifications(),
        store.listAuditLogs(null, null, 80)
      ]);

      const dashboard = await store.getDashboard();

      return {
        brand: { name: settings?.name || "CafeMaster", tagline: settings?.tagline || "Restaurant Operations OS" },
        settings,
        menuItems,
        tables,
        customers,
        orders,
        employees,
        shifts,
        reservations,
        suppliers,
        purchaseOrders,
        notifications,
        auditLogs,
        dashboard,
        generatedAt: nowIso()
      };
    }
  };

  async function logAuditAction(employeeId, action, entityType, entityId, oldValue = null, newValue = null) {
    try {
      const db = await getDb();
      let employeeName = "System";
      if (employeeId) {
        const emp = await db.collection("employees").findOne(idQuery(employeeId));
        if (emp) employeeName = emp.full_name;
      }
      await db.collection("audit_logs").insertOne({
        employee_id: employeeId ? String(employeeId) : null,
        employee_name: employeeName,
        action,
        entity_type: entityType,
        entity_id: String(entityId),
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
        created_at: nowIso()
      });
    } catch (e) {
      // Don't fail the operation if logging fails
    }
  }

  return store;
}

function isLowStock(item) {
  const stock = Number(item.stock ?? 0);
  const minStock = Number(item.minStock ?? item.min_stock ?? 5);
  return stock <= minStock;
}

module.exports = {
  createStore,
  createHttpError,
  verifyPassword
};
