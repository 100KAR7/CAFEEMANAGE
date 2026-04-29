PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  seats INTEGER NOT NULL,
  zone TEXT NOT NULL DEFAULT 'Main Hall',
  status TEXT NOT NULL DEFAULT 'free',
  active_order_id INTEGER,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  available INTEGER NOT NULL DEFAULT 1,
  prep_time INTEGER NOT NULL DEFAULT 10,
  allergens TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  visits INTEGER NOT NULL DEFAULT 0,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  total_spent REAL NOT NULL DEFAULT 0,
  last_visit TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff',
  password_hash TEXT NOT NULL,
  hourly_rate REAL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  role TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  table_id INTEGER,
  customer_id INTEGER,
  employee_id INTEGER,
  order_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  payment_method TEXT,
  notes TEXT DEFAULT '',
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  discount REAL NOT NULL,
  total REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (table_id) REFERENCES tables(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  menu_item_id INTEGER,
  item_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL,
  special_instructions TEXT DEFAULT '',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  employee_id INTEGER,
  change_qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  table_id INTEGER NOT NULL,
  party_size INTEGER NOT NULL,
  reservation_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 120,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (table_id) REFERENCES tables(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount REAL NOT NULL DEFAULT 0,
  expected_delivery TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL,
  menu_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  line_total REAL NOT NULL,
  received_qty INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  is_read INTEGER NOT NULL DEFAULT 0,
  related_entity_type TEXT,
  related_entity_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  total_sales REAL NOT NULL,
  total_orders INTEGER NOT NULL,
  total_customers INTEGER NOT NULL,
  top_items TEXT,
  created_at TEXT NOT NULL
);
