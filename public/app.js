const appRoot = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
const toastRoot = document.getElementById("toast-root");

const icons = {
  dashboard:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  pos:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  tables:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h18M7 7v10M17 7v10M3 17h18"/></svg>',
  menu:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3h8l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3z"/><path d="M8 3v4h8"/></svg>',
  inventory:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><path d="M1 8h22"/><path d="M10 12h4"/></svg>',
  orders:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  refresh:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  plus:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  print:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
  close:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
};

const state = {
  screen: "dashboard",
  data: null,
  cart: [],
  modal: null,
  auth: {
    ready: false,
    user: null,
    error: "",
    expiresAt: null
  },
  live: {
    timerId: null,
    lastSyncedAt: null
  },
  pos: {
    category: "All",
    search: "",
    orderType: "dine-in",
    tableId: "",
    customerName: "",
    customerPhone: "",
    notes: "",
    discount: "0",
    paymentMethod: "UPI"
  },
  filters: {
    menuCategory: "All",
    menuSearch: "",
    orderStatus: "All",
    orderSearch: "",
    inventorySearch: ""
  }
};

const screenMeta = {
  dashboard: {
    title: "Operations Dashboard",
    subtitle: "Sales pulse, low stock visibility, and floor activity in one place."
  },
  pos: {
    title: "Point Of Sale",
    subtitle: "Take an order, assign a table, and print the receipt from the same screen."
  },
  tables: {
    title: "Table Control",
    subtitle: "Reserve tables, clear service, and manage the floor with one click."
  },
  menu: {
    title: "Menu Builder",
    subtitle: "Create, edit, and enable menu items without losing data."
  },
  inventory: {
    title: "Inventory Watch",
    subtitle: "Restock low items and keep phase-one stock clean and visible."
  },
  orders: {
    title: "Order History",
    subtitle: "Review every saved order and move it through service states."
  }
};

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: icons.dashboard },
  { id: "pos", label: "POS", icon: icons.pos },
  { id: "tables", label: "Tables", icon: icons.tables },
  { id: "menu", label: "Menu", icon: icons.menu },
  { id: "inventory", label: "Inventory", icon: icons.inventory },
  { id: "orders", label: "Orders", icon: icons.orders }
];

function currentCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function shortDate(value) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function timeOnly(value) {
  if (!value) {
    return "Not synced yet";
  }
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function isLowStock(item) {
  return Number(item?.stock ?? 0) <= Number(item?.minStock ?? 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<strong>${type === "error" ? "Problem" : type === "info" ? "Notice" : "Success"}</strong><div>${escapeHtml(message)}</div>`;
  toastRoot.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function launchHelpMessage() {
  return "Open CafeMaster through the Node server. Run npm start, then visit http://localhost:3000.";
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
  } catch {
    throw new Error(launchHelpMessage());
  }

  const contentType = String(response.headers.get("content-type") || "");
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};

  if (response.status === 401 && path !== "/api/auth/session" && path !== "/api/auth/login") {
    const hadAuthenticatedUser = Boolean(state.auth.user);
    stopLiveSync();
    state.auth.ready = true;
    state.auth.user = null;
    state.auth.expiresAt = null;
    state.auth.error = hadAuthenticatedUser
      ? "Login succeeded, but the session was not kept by the browser. Open the app from http://localhost:3000 and try again."
      : "Your session expired. Please log in again.";
    state.data = null;
    render();
  }
  if (!response.ok) {
    if (!contentType.includes("application/json") && path.startsWith("/api/")) {
      throw new Error(launchHelpMessage());
    }
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

async function loadBootstrap(showRefreshToast = false) {
  const data = await request("/api/bootstrap");
  state.data = data;
  state.auth.user = data.currentEmployee || state.auth.user;
  state.live.lastSyncedAt = new Date().toISOString();
  if (showRefreshToast) {
    showToast("Cafe data refreshed.", "info");
  }
  render();
}

async function restoreSession() {
  let response;
  try {
    response = await fetch("/api/auth/session", {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
  } catch {
    throw new Error(launchHelpMessage());
  }

  if (response.status === 401) {
    state.auth.ready = true;
    state.auth.user = null;
    state.auth.expiresAt = null;
    render();
    return false;
  }

  const contentType = String(response.headers.get("content-type") || "");
  if (!contentType.includes("application/json")) {
    throw new Error(launchHelpMessage());
  }

  const payload = await response.json().catch(() => {
    throw new Error(launchHelpMessage());
  });

  if (!response.ok) {
    throw new Error(payload.error || launchHelpMessage());
  }

  state.auth.ready = true;
  state.auth.user = payload.employee;
  state.auth.expiresAt = payload.expiresAt;
  state.auth.error = "";
  return true;
}

function startLiveSync() {
  stopLiveSync();
  state.live.timerId = window.setInterval(async () => {
    const activeTag = document.activeElement?.tagName;
    const isEditing =
      state.modal ||
      activeTag === "INPUT" ||
      activeTag === "TEXTAREA" ||
      activeTag === "SELECT";
    if (!state.auth.user || document.hidden || isEditing) {
      return;
    }
    try {
      await loadBootstrap(false);
    } catch (error) {
      console.error(error);
    }
  }, 20000);
}

function stopLiveSync() {
  if (state.live.timerId) {
    window.clearInterval(state.live.timerId);
    state.live.timerId = null;
  }
}

function getFreeTables() {
  return (state.data?.tables || []).filter((table) => table.status === "free");
}

function categories() {
  const categorySet = new Set((state.data?.menuItems || []).map((item) => item.category));
  return ["All", ...categorySet];
}

function filteredPosItems() {
  const category = state.pos.category;
  return (state.data?.menuItems || []).filter(
    (item) => item.available && (category === "All" || item.category === category)
  );
}

function filteredMenuItems() {
  const category = state.filters.menuCategory;
  return (state.data?.menuItems || []).filter((item) => category === "All" || item.category === category);
}

function getCartTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discount = Math.max(0, Number(state.pos.discount || 0));
  const tax = Math.max(0, subtotal - discount) * 0.05;
  return {
    subtotal,
    discount,
    tax,
    total: subtotal - discount + tax
  };
}

function upsertCartItem(menuItem) {
  if (menuItem.stock <= 0) {
    showToast(`${menuItem.name} is sold out right now.`, "error");
    return;
  }
  const existing = state.cart.find((item) => item.id === menuItem.id);
  if (existing) {
    if (existing.qty >= menuItem.stock) {
      showToast(`Only ${menuItem.stock} units of ${menuItem.name} are available.`, "error");
      return;
    }
    existing.qty += 1;
  } else {
    state.cart.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      qty: 1,
      max: menuItem.stock
    });
  }
  render();
}

function adjustCartItem(id, delta) {
  const item = state.cart.find((entry) => entry.id === Number(id));
  if (!item) {
    return;
  }
  item.qty += delta;
  if (item.qty > item.max) {
    item.qty = item.max;
    showToast(`Stock limit reached for ${item.name}.`, "error");
  }
  if (item.qty <= 0) {
    state.cart = state.cart.filter((entry) => entry.id !== Number(id));
  }
  render();
}

function clearCart() {
  state.cart = [];
  render();
}

function syncCartTotals() {
  const totals = getCartTotals();
  const values = {
    subtotal: currentCurrency(totals.subtotal),
    discount: currentCurrency(totals.discount),
    tax: currentCurrency(totals.tax),
    total: currentCurrency(totals.total)
  };

  Object.entries(values).forEach(([key, value]) => {
    const element = document.querySelector(`[data-cart-total="${key}"]`);
    if (element) {
      element.textContent = value;
    }
  });
}

function openModal(modal) {
  state.modal = modal;
  renderModal();
}

function closeModal() {
  state.modal = null;
  renderModal();
}

function statusChip(value) {
  return `<span class="status-chip ${escapeHtml(String(value || "").toLowerCase())}">${escapeHtml(value)}</span>`;
}

function renderLoading(message = "Loading CafeMaster...") {
  appRoot.innerHTML = `
    <div class="loading-shell">
      <img src="/assets/cafemaster-logo.svg" alt="CafeMaster logo" class="loading-logo" />
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderLogin() {
  appRoot.innerHTML = `
    <section class="auth-shell">
      <div class="auth-grid">
        <article class="auth-panel">
          <div class="auth-brand">
            <img src="/assets/cafemaster-logo.svg" alt="CafeMaster logo" class="auth-logo" />
            <div>
              <span class="app-kicker">Employee access</span>
              <h1>CafeMaster Operations Suite</h1>
            </div>
          </div>
          <p class="auth-copy">
            Sign in to reach the POS, live table control, inventory tracking, and order history.
            Sessions are protected and the production API is now employee-gated.
          </p>
          <div class="auth-feature-list">
            <div class="auth-feature">
              <strong>Secure employee access</strong>
              <span>Cookie-based sessions with protected API routes.</span>
            </div>
            <div class="auth-feature">
              <strong>Live sync</strong>
              <span>Operational data refreshes in the background while staff work.</span>
            </div>
            <div class="auth-feature">
              <strong>Persistent records</strong>
              <span>Orders, stock, menus, and table updates are stored in SQLite.</span>
            </div>
          </div>
        </article>
        <article class="auth-card">
          <span class="app-kicker">Staff login</span>
          <h2>Welcome back</h2>
          <p class="subtle">Use the seeded manager account first, then change it for deployment.</p>
          ${state.auth.error ? `<div class="form-alert">${escapeHtml(state.auth.error)}</div>` : ""}
          <form class="auth-form" data-form="login">
            <div class="field">
              <label>Email address</label>
              <input type="email" name="email" placeholder="admin@cafemaster.local" required />
            </div>
            <div class="field">
              <label>Password</label>
              <input type="password" name="password" placeholder="Enter password" required />
            </div>
            <button class="btn btn-primary" type="submit">Sign In</button>
          </form>
          <div class="auth-hint">
            Default sign-in:
            <strong>admin@cafemaster.local</strong>
            <span>Password: <strong>Cafe@12345</strong></span>
          </div>
        </article>
      </div>
    </section>
  `;
  modalRoot.innerHTML = "";
}

function render() {
  if (!state.auth.ready) {
    renderLoading("Checking employee session...");
    return;
  }

  if (!state.auth.user) {
    renderLogin();
    return;
  }

  if (!state.data) {
    renderLoading("Loading CafeMaster Phase One...");
    return;
  }

  const meta = screenMeta[state.screen];
  const lowStockCount = state.data.dashboard.stats.lowStockCount;
  const activeOrders = state.data.dashboard.stats.activeOrders;

  appRoot.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand-card">
          <div class="brand-row">
            <img class="brand-logo" src="/assets/cafemaster-logo.svg" alt="CafeMaster logo" />
            <div>
              <h1>${escapeHtml(state.data.brand.name)}</h1>
              <p>${escapeHtml(state.data.brand.tagline)}</p>
            </div>
          </div>
          <div class="phase-badge">Phase One • SQLite Enabled • Ready For Operations</div>
        </div>
        <nav class="nav-list">
          ${navigation
            .map((item) => {
              const badge =
                item.id === "orders"
                  ? `<span class="tiny-chip">${activeOrders} live</span>`
                  : item.id === "inventory"
                    ? `<span class="tiny-chip">${lowStockCount} low</span>`
                    : "";
              return `
                <button class="nav-button ${state.screen === item.id ? "active" : ""}" data-action="navigate" data-screen="${item.id}">
                  <span class="nav-label">
                    <span class="nav-icon">${item.icon}</span>
                    <span>${item.label}</span>
                  </span>
                  ${badge}
                </button>
              `;
            })
            .join("")}
        </nav>
        <div class="sidebar-foot">
          <strong>Phase one wins</strong><br />
          Orders, stock, menu changes, tables, and customer visits now stay stored in SQLite instead
          of disappearing on refresh.
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="screen-title">
            <span class="app-kicker">Production workspace</span>
            <h2>${escapeHtml(meta.title)}</h2>
            <p>${escapeHtml(meta.subtitle)}</p>
          </div>
          <div class="toolbar">
            <span class="pill">Synced ${timeOnly(state.live.lastSyncedAt)}</span>
            <span class="pill">${escapeHtml(state.auth.user.fullName)} • ${escapeHtml(state.auth.user.role)}</span>
            <span class="pill">${state.data.orders.length} orders recorded</span>
            <button class="btn btn-secondary btn-sm" data-action="refresh-data">${icons.refresh} Refresh</button>
            <button class="btn btn-secondary btn-sm" data-action="logout">Log Out</button>
          </div>
        </header>
        <section class="content">${renderScreen()}</section>
      </main>
    </div>
  `;

  renderModal();
  applyScreenFilters();
}

function renderScreen() {
  switch (state.screen) {
    case "dashboard":
      return renderDashboard();
    case "pos":
      return renderPos();
    case "tables":
      return renderTables();
    case "menu":
      return renderMenu();
    case "inventory":
      return renderInventory();
    case "orders":
      return renderOrders();
    default:
      return "";
  }
}

function renderDashboard() {
  const { dashboard, menuItems } = state.data;
  const stats = dashboard.stats;
  return `
    <section class="card hero">
      <div class="hero-copy">
        <div class="pill">Operations summary</div>
        <h1>Everything your phase-one cafe needs in one warm control room.</h1>
        <p>
          The app now keeps your menu, inventory, order history, table statuses, and customer visits
          stored in SQLite. That means fewer manual fixes and a cleaner path into phase two.
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary" data-action="jump" data-screen="pos">${icons.plus} Start New Order</button>
          <button class="btn btn-secondary" data-action="jump" data-screen="inventory">Review Low Stock</button>
          <button class="btn btn-secondary" data-action="jump" data-screen="menu">Manage Menu</button>
        </div>
      </div>
      <div class="hero-panel">
        <div class="mini-grid">
          <div class="mini-card">
            <div class="muted-label">Today revenue</div>
            <div class="value">${currentCurrency(stats.revenueToday)}</div>
          </div>
          <div class="mini-card">
            <div class="muted-label">Average bill</div>
            <div class="value">${currentCurrency(stats.averageTicket)}</div>
          </div>
          <div class="mini-card">
            <div class="muted-label">Occupied tables</div>
            <div class="value">${stats.occupiedTables}/${stats.totalTables}</div>
          </div>
        </div>
      </div>
    </section>
    <section class="stat-grid">
      <article class="stat-card"><div class="muted-label">Orders today</div><div class="value">${stats.ordersToday}</div></article>
      <article class="stat-card"><div class="muted-label">Active orders</div><div class="value">${stats.activeOrders}</div></article>
      <article class="stat-card"><div class="muted-label">Low-stock items</div><div class="value">${stats.lowStockCount}</div></article>
      <article class="stat-card"><div class="muted-label">Menu items live</div><div class="value">${menuItems.filter((item) => item.available).length}</div></article>
    </section>
    <section class="dashboard-grid">
      <article class="card card-pad">
        <div class="section-header">
          <div>
            <h3>Recent orders</h3>
            <p>Most recent transactions from the database.</p>
          </div>
          <button class="btn btn-secondary btn-sm" data-action="jump" data-screen="orders">Open history</button>
        </div>
        <div class="order-list">
          ${dashboard.recentOrders
            .map(
              (order) => `
                <div class="order-card">
                  <div class="row">
                    <strong>${escapeHtml(order.orderNumber)}</strong>
                    ${statusChip(order.status)}
                  </div>
                  <p>${escapeHtml(order.tableName || order.orderType)} • ${escapeHtml(order.customerName || "Walk-in Guest")}</p>
                  <div class="row">
                    <span class="muted-label">${shortDate(order.createdAt)}</span>
                    <strong>${currentCurrency(order.total)}</strong>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
      <div class="stack">
        <article class="card card-pad">
          <div class="section-header">
            <div>
              <h3>Low stock alerts</h3>
              <p>Quick items that need attention before service slows down.</p>
            </div>
            <button class="btn btn-secondary btn-sm" data-action="jump" data-screen="inventory">Open inventory</button>
          </div>
          <div class="list">
            ${dashboard.lowStockItems
              .map(
                (item) => `
                  <div class="low-stock-item">
                    <div class="row">
                      <strong>${escapeHtml(item.name)}</strong>
                      <span class="status-chip pending">${item.stock} left</span>
                    </div>
                    <p>${escapeHtml(item.category)} • ${currentCurrency(item.cost)} unit cost</p>
                  </div>
                `
              )
              .join("") || '<div class="empty-state">No low-stock alerts right now.</div>'}
          </div>
        </article>
        <article class="card card-pad">
          <div class="section-header">
            <div>
              <h3>Popular items</h3>
              <p>What guests are ordering most often.</p>
            </div>
          </div>
          <div class="list">
            ${dashboard.popularItems
              .map(
                (item) => `
                  <div class="list-item">
                    <div class="row">
                      <strong>${escapeHtml(item.name)}</strong>
                      <span class="tiny-chip">${item.quantity} sold</span>
                    </div>
                    <p>${currentCurrency(item.revenue)} revenue generated</p>
                  </div>
                `
              )
              .join("") || '<div class="empty-state">Orders will unlock popularity insights.</div>'}
          </div>
        </article>
      </div>
    </section>
    <section class="two-up">
      <article class="card card-pad">
        <div class="section-header">
          <div>
            <h3>Table snapshot</h3>
            <p>How the floor looks right now.</p>
          </div>
        </div>
        <div class="list">
          ${dashboard.tableSnapshot
            .slice(0, 6)
            .map(
              (table) => `
                <div class="list-item">
                  <div class="row">
                    <strong>${escapeHtml(table.name)}</strong>
                    <span class="status-dot ${escapeHtml(table.status)}">${escapeHtml(table.status)}</span>
                  </div>
                  <p>${table.seats} seats • ${escapeHtml(table.zone)}</p>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
      <article class="card card-pad">
        <div class="section-header">
          <div>
            <h3>Customer spotlight</h3>
            <p>Loyal guests captured from real checkout data.</p>
          </div>
        </div>
        <div class="list">
          ${dashboard.customerSpotlight
            .map(
              (customer) => `
                <div class="list-item">
                  <div class="row">
                    <strong>${escapeHtml(customer.name)}</strong>
                    <span class="tiny-chip">${customer.loyaltyPoints} pts</span>
                  </div>
                  <p>${escapeHtml(customer.phone || "No phone saved")} • ${customer.visits} visits</p>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function renderPos() {
  const totals = getCartTotals();
  const availableTables = getFreeTables();
  return `
    <section class="screen-grid">
      <article class="card card-pad">
        <div class="section-header">
          <div>
            <h3>Menu selection</h3>
            <p>Search by item or jump between categories while you build the order.</p>
          </div>
          <input class="search-bar" type="search" placeholder="Search drinks, food, desserts..." value="${escapeHtml(state.pos.search)}" data-filter="pos-search" />
        </div>
        <div class="chip-row">
          ${categories()
            .map(
              (category) => `
                <button class="chip ${state.pos.category === category ? "active" : ""}" data-action="pos-category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
              `
            )
            .join("")}
        </div>
        <div class="menu-grid" style="margin-top:1rem">
          ${filteredPosItems()
            .map((item) => {
              const soldOut = item.stock <= 0;
              return `
                <article class="menu-card" data-pos-card data-search="${escapeHtml(`${item.name} ${item.category} ${item.description}`.toLowerCase())}">
                  <div class="row">
                    <span class="tiny-chip">${escapeHtml(item.category)}</span>
                    <span class="tiny-chip">${soldOut ? "Sold out" : `${item.stock} in stock`}</span>
                  </div>
                  <strong>${escapeHtml(item.name)}</strong>
                  <p>${escapeHtml(item.description)}</p>
                  <div class="menu-meta">
                    <span class="price-line">${currentCurrency(item.price)}</span>
                    <span class="muted-label">${item.prepTime} min</span>
                  </div>
                  <button class="btn btn-primary btn-sm" data-action="cart-add" data-id="${item.id}" ${soldOut ? "disabled" : ""}>
                    ${soldOut ? "Sold out" : `${icons.plus} Add`}
                  </button>
                </article>
              `;
            })
            .join("")}
        </div>
      </article>
      <aside class="cart-panel card card-pad">
        <div class="section-header">
          <div>
            <h3>Checkout desk</h3>
            <p>Guest details and payment stay attached to the saved order.</p>
          </div>
          <button class="btn btn-secondary btn-sm" data-action="clear-cart">Clear</button>
        </div>
        <form data-form="checkout" class="stack">
          <div class="field-grid">
            <div class="field">
              <label>Order type</label>
              <select data-pos-field="orderType">
                <option value="dine-in" ${state.pos.orderType === "dine-in" ? "selected" : ""}>Dine-in</option>
                <option value="takeaway" ${state.pos.orderType === "takeaway" ? "selected" : ""}>Takeaway</option>
                <option value="delivery" ${state.pos.orderType === "delivery" ? "selected" : ""}>Delivery</option>
              </select>
            </div>
            <div class="field">
              <label>Table</label>
              <select data-pos-field="tableId" ${state.pos.orderType === "dine-in" ? "" : "disabled"}>
                <option value="">${state.pos.orderType === "dine-in" ? "Choose table" : "Not required"}</option>
                ${availableTables
                  .map(
                    (table) => `
                      <option value="${table.id}" ${String(state.pos.tableId) === String(table.id) ? "selected" : ""}>
                        ${escapeHtml(table.name)} • ${table.seats} seats • ${escapeHtml(table.zone)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </div>
          </div>
          <div class="field-grid">
            <div class="field">
              <label>Customer name</label>
              <input type="text" value="${escapeHtml(state.pos.customerName)}" data-pos-field="customerName" placeholder="Optional guest name" />
            </div>
            <div class="field">
              <label>Phone number</label>
              <input type="tel" value="${escapeHtml(state.pos.customerPhone)}" data-pos-field="customerPhone" placeholder="Optional phone number" />
            </div>
          </div>
          <div class="field-grid">
            <div class="field">
              <label>Discount</label>
              <input type="number" min="0" value="${escapeHtml(state.pos.discount)}" data-pos-field="discount" />
            </div>
            <div class="field">
              <label>Payment method</label>
              <select data-pos-field="paymentMethod">
                ${["UPI", "Cash", "Card"].map((method) => `<option value="${method}" ${state.pos.paymentMethod === method ? "selected" : ""}>${method}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field">
            <label>Order notes</label>
            <textarea data-pos-field="notes" placeholder="Packaging, allergies, less sugar, birthday table...">${escapeHtml(state.pos.notes)}</textarea>
          </div>
          <div class="stack">
            ${
              state.cart.length
                ? state.cart
                    .map(
                      (item) => `
                        <div class="cart-line">
                          <div class="row">
                            <strong>${escapeHtml(item.name)}</strong>
                            <strong>${currentCurrency(item.qty * item.price)}</strong>
                          </div>
                          <div class="row">
                            <span class="muted-label">${currentCurrency(item.price)} each</span>
                            <div class="toolbar">
                              <button type="button" class="btn btn-secondary btn-sm" data-action="cart-qty" data-id="${item.id}" data-delta="-1">-</button>
                              <span class="pill">${item.qty}</span>
                              <button type="button" class="btn btn-secondary btn-sm" data-action="cart-qty" data-id="${item.id}" data-delta="1">+</button>
                              <button type="button" class="btn btn-danger btn-sm" data-action="cart-remove" data-id="${item.id}">Remove</button>
                            </div>
                          </div>
                        </div>
                      `
                    )
                    .join("")
                : '<div class="empty-state">Your cart is empty. Add items from the menu grid.</div>'
            }
          </div>
          <div class="cart-total">
            <div class="summary-row"><span class="muted-label">Subtotal</span><strong data-cart-total="subtotal">${currentCurrency(totals.subtotal)}</strong></div>
            <div class="summary-row"><span class="muted-label">Discount</span><strong data-cart-total="discount">${currentCurrency(totals.discount)}</strong></div>
            <div class="summary-row"><span class="muted-label">Tax</span><strong data-cart-total="tax">${currentCurrency(totals.tax)}</strong></div>
            <div class="summary-row" style="margin-top:0.55rem"><span>Total</span><strong data-cart-total="total">${currentCurrency(totals.total)}</strong></div>
          </div>
          <button class="btn btn-primary" type="submit">${icons.plus} Save Order To SQLite</button>
        </form>
      </aside>
    </section>
  `;
}

function renderTables() {
  return `
    <section class="card card-pad">
      <div class="section-header">
        <div>
          <h3>Floor map</h3>
          <p>Reserve, clean, or free tables without losing the connection to active orders.</p>
        </div>
      </div>
      <div class="table-grid">
        ${state.data.tables
          .map(
            (table) => `
              <article class="table-card">
                <div class="row">
                  <strong>${escapeHtml(table.name)}</strong>
                  <span class="status-dot ${escapeHtml(table.status)}">${escapeHtml(table.status)}</span>
                </div>
                <p>${table.seats} seats • ${escapeHtml(table.zone)}</p>
                ${table.activeOrderId ? `<p>Active order #${table.activeOrderId} is controlling this table.</p>` : ""}
                <div class="toolbar">
                  <button class="btn btn-secondary btn-sm" data-action="table-status" data-id="${table.id}" data-status="free" ${table.activeOrderId ? "disabled" : ""}>Free</button>
                  <button class="btn btn-secondary btn-sm" data-action="table-status" data-id="${table.id}" data-status="reserved" ${table.activeOrderId ? "disabled" : ""}>Reserve</button>
                  <button class="btn btn-secondary btn-sm" data-action="table-status" data-id="${table.id}" data-status="cleaning" ${table.activeOrderId ? "disabled" : ""}>Cleaning</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderMenu() {
  return `
    <section class="card card-pad">
      <div class="section-header">
        <div>
          <h3>Live menu catalogue</h3>
          <p>Add items, adjust prices, and switch availability without touching the database manually.</p>
        </div>
        <div class="toolbar">
          <input class="search-bar" type="search" placeholder="Search menu..." value="${escapeHtml(state.filters.menuSearch)}" data-filter="menu-search" />
          <button class="btn btn-primary btn-sm" data-action="open-menu-modal">${icons.plus} Add item</button>
        </div>
      </div>
      <div class="chip-row">
        ${categories()
          .map(
            (category) => `
              <button class="chip ${state.filters.menuCategory === category ? "active" : ""}" data-action="menu-category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
            `
          )
          .join("")}
      </div>
      <div class="list-table" style="margin-top:1rem">
        <div class="table-head">
          <span>Item</span>
          <span>Category</span>
          <span>Price</span>
          <span>Stock</span>
          <span>Actions</span>
        </div>
        ${filteredMenuItems()
          .map(
            (item) => `
              <div class="table-row" data-menu-row data-search="${escapeHtml(`${item.name} ${item.category} ${item.description}`.toLowerCase())}">
                <div>
                  <strong>${escapeHtml(item.name)}</strong>
                  <p>${escapeHtml(item.description)}</p>
                </div>
                <span>${escapeHtml(item.category)}</span>
                <span>${currentCurrency(item.price)}</span>
                <span>${item.stock} in stock • Min ${item.minStock} • ${item.available ? "Live" : "Hidden"}</span>
                <div class="toolbar">
                  <button class="btn btn-secondary btn-sm" data-action="edit-menu-item" data-id="${item.id}">Edit</button>
                  <button class="btn btn-secondary btn-sm" data-action="toggle-menu-item" data-id="${item.id}" data-available="${item.available ? "0" : "1"}">${item.available ? "Hide" : "Show"}</button>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderInventory() {
  const stockValue = state.data.menuItems.reduce((sum, item) => sum + item.stock * item.cost, 0);
  return `
    <section class="stat-grid">
      <article class="stat-card"><div class="muted-label">Inventory value</div><div class="value">${currentCurrency(stockValue)}</div></article>
      <article class="stat-card"><div class="muted-label">Low stock count</div><div class="value">${state.data.dashboard.stats.lowStockCount}</div></article>
      <article class="stat-card"><div class="muted-label">Items tracked</div><div class="value">${state.data.menuItems.length}</div></article>
      <article class="stat-card"><div class="muted-label">Unavailable items</div><div class="value">${state.data.menuItems.filter((item) => !item.available).length}</div></article>
    </section>
    <section class="card card-pad">
      <div class="section-header">
        <div>
          <h3>Stock levels</h3>
          <p>Restock low items and keep service smooth during rush hours.</p>
        </div>
        <input class="search-bar" type="search" placeholder="Search inventory..." value="${escapeHtml(state.filters.inventorySearch)}" data-filter="inventory-search" />
      </div>
      <div class="list">
        ${state.data.menuItems
          .map(
            (item) => `
              <div class="list-item" data-inventory-row data-search="${escapeHtml(`${item.name} ${item.category}`.toLowerCase())}">
                <div class="row">
                  <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <p>${escapeHtml(item.category)} • Cost ${currentCurrency(item.cost)} • Reorder at ${item.minStock}</p>
                  </div>
                  <span class="status-chip ${isLowStock(item) ? "pending" : "completed"}">
                    ${isLowStock(item) ? `Low: ${item.stock} units` : `${item.stock} units`}
                  </span>
                </div>
                <div class="toolbar">
                  <button class="btn btn-secondary btn-sm" data-action="open-restock-modal" data-id="${item.id}">Restock</button>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderOrders() {
  return `
    <section class="card card-pad">
      <div class="section-header">
        <div>
          <h3>Saved orders</h3>
          <p>Move orders through service, completion, or cancellation from here.</p>
        </div>
        <div class="toolbar">
          <input class="search-bar" type="search" placeholder="Search order number, guest, table..." value="${escapeHtml(state.filters.orderSearch)}" data-filter="orders-search" />
          <select class="search-bar" data-filter="orders-status" style="max-width:180px">
            ${["All", "placed", "preparing", "served", "completed", "cancelled"].map((status) => `<option value="${status}" ${state.filters.orderStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="list">
        ${state.data.orders
          .map(
            (order) => `
              <article class="order-card" data-order-row data-status="${escapeHtml(order.status)}" data-search="${escapeHtml(`${order.orderNumber} ${order.customerName || ""} ${order.tableName || ""} ${order.orderType}`.toLowerCase())}">
                <div class="row">
                  <strong>${escapeHtml(order.orderNumber)}</strong>
                  <div class="toolbar">
                    ${statusChip(order.status)}
                    ${statusChip(order.paymentStatus)}
                  </div>
                </div>
                <p>${escapeHtml(order.customerName || "Walk-in Guest")} • ${escapeHtml(order.tableName || order.orderType)} • ${shortDate(order.createdAt)}</p>
                <p>${escapeHtml(order.employeeName || "Staff member not recorded")} • ${escapeHtml(order.paymentMethod || order.paymentStatus)}</p>
                <p>${escapeHtml(order.items.map((item) => `${item.qty}x ${item.name}`).join(", "))}</p>
                <div class="row">
                  <strong>${currentCurrency(order.total)}</strong>
                  <div class="toolbar">
                    ${renderOrderActions(order)}
                    <button class="btn btn-secondary btn-sm" data-action="view-receipt" data-id="${order.id}">${icons.print} Receipt</button>
                  </div>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderOrderActions(order) {
  const actions = [];
  if (order.status === "placed") {
    actions.push(["preparing", "Start prep"]);
  }
  if (order.status === "preparing") {
    actions.push(["served", "Mark served"]);
  }
  if (!["completed", "cancelled"].includes(order.status)) {
    actions.push(["completed", "Complete"]);
    actions.push(["cancelled", "Cancel"]);
  }
  return actions
    .map(
      ([status, label]) =>
        `<button class="btn btn-secondary btn-sm" data-action="update-order-status" data-id="${order.id}" data-status="${status}">${escapeHtml(label)}</button>`
    )
    .join("");
}

function renderModal() {
  if (!state.modal) {
    modalRoot.innerHTML = "";
    return;
  }

  if (state.modal.type === "menu-form") {
    const item = state.modal.item;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal" data-modal-body>
          <div class="section-header">
            <div>
              <h3>${item ? "Edit menu item" : "Add menu item"}</h3>
              <p>Changes are saved directly into SQLite.</p>
            </div>
            <button class="btn btn-secondary btn-sm" data-action="close-modal">${icons.close}</button>
          </div>
          <form data-form="menu-item" class="stack">
            <input type="hidden" name="id" value="${item ? item.id : ""}" />
            <div class="field-grid">
              <div class="field"><label>Name</label><input name="name" required value="${escapeHtml(item?.name || "")}" /></div>
              <div class="field"><label>Category</label><input name="category" required value="${escapeHtml(item?.category || "")}" /></div>
            </div>
            <div class="field"><label>Description</label><textarea name="description">${escapeHtml(item?.description || "")}</textarea></div>
            <div class="field-grid">
              <div class="field"><label>Price</label><input name="price" type="number" min="1" required value="${escapeHtml(item?.price || 0)}" /></div>
              <div class="field"><label>Cost</label><input name="cost" type="number" min="0" required value="${escapeHtml(item?.cost || 0)}" /></div>
            </div>
            <div class="field-grid">
              <div class="field"><label>Stock</label><input name="stock" type="number" min="0" required value="${escapeHtml(item?.stock || 0)}" /></div>
              <div class="field"><label>Prep time (min)</label><input name="prepTime" type="number" min="1" required value="${escapeHtml(item?.prepTime || 5)}" /></div>
            </div>
            <div class="field">
              <label>Minimum stock threshold</label>
              <input name="minStock" type="number" min="0" required value="${escapeHtml(item?.minStock ?? 5)}" />
            </div>
            <label class="pill"><input type="checkbox" name="available" ${item?.available ?? true ? "checked" : ""} /> Available for sale</label>
            <button class="btn btn-primary" type="submit">${icons.plus} Save item</button>
          </form>
        </div>
      </div>
    `;
    return;
  }

  if (state.modal.type === "restock") {
    const item = state.modal.item;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal" data-modal-body>
          <div class="section-header">
            <div>
              <h3>Restock ${escapeHtml(item.name)}</h3>
              <p>Current stock: ${item.stock} units.</p>
            </div>
            <button class="btn btn-secondary btn-sm" data-action="close-modal">${icons.close}</button>
          </div>
          <form data-form="restock" class="stack">
            <input type="hidden" name="id" value="${item.id}" />
            <div class="field">
              <label>Quantity to add</label>
              <input name="quantity" type="number" min="1" value="10" required />
            </div>
            <div class="field">
              <label>Reason</label>
              <input name="reason" value="Supplier restock" required />
            </div>
            <button class="btn btn-primary" type="submit">${icons.plus} Confirm restock</button>
          </form>
        </div>
      </div>
    `;
    return;
  }

  if (state.modal.type === "receipt") {
    const order = state.modal.order;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal" data-modal-body>
          <div class="section-header">
            <div>
              <h3>Receipt preview</h3>
              <p>${escapeHtml(order.orderNumber)} • ${shortDate(order.createdAt)}</p>
            </div>
            <div class="toolbar">
              <button class="btn btn-secondary btn-sm" data-action="print-receipt">${icons.print} Print</button>
              <button class="btn btn-secondary btn-sm" data-action="close-modal">${icons.close}</button>
            </div>
          </div>
          <div class="receipt" id="receipt-content">
            <h4>CafeMaster</h4>
            <p>Phase One Operations Hub</p>
            <p>${escapeHtml(order.customerName || "Walk-in Guest")} • ${escapeHtml(order.tableName || order.orderType)}</p>
            <div style="margin:1rem 0">
              ${order.items
                .map(
                  (item) => `
                    <div class="receipt-line">
                      <span>${item.qty}x ${escapeHtml(item.name)}</span>
                      <strong>${currentCurrency(item.lineTotal)}</strong>
                    </div>
                  `
                )
                .join("")}
            </div>
            <div class="receipt-line"><span>Subtotal</span><strong>${currentCurrency(order.subtotal)}</strong></div>
            <div class="receipt-line"><span>Discount</span><strong>${currentCurrency(order.discount)}</strong></div>
            <div class="receipt-line"><span>Tax</span><strong>${currentCurrency(order.tax)}</strong></div>
            <div class="receipt-line"><span>Total</span><strong>${currentCurrency(order.total)}</strong></div>
            <div class="receipt-line"><span>Payment</span><strong>${escapeHtml(order.paymentMethod || order.paymentStatus)}</strong></div>
          </div>
        </div>
      </div>
    `;
  }
}

function applyScreenFilters() {
  applyPosFilters();
  applyMenuFilters();
  applyOrderFilters();
  applyInventoryFilters();
}

function applyPosFilters() {
  const query = state.pos.search.trim().toLowerCase();
  document.querySelectorAll("[data-pos-card]").forEach((card) => {
    card.classList.toggle("hidden", !card.dataset.search.includes(query));
  });
}

function applyMenuFilters() {
  const query = state.filters.menuSearch.trim().toLowerCase();
  document.querySelectorAll("[data-menu-row]").forEach((row) => {
    row.classList.toggle("hidden", !row.dataset.search.includes(query));
  });
}

function applyOrderFilters() {
  const query = state.filters.orderSearch.trim().toLowerCase();
  const wantedStatus = state.filters.orderStatus;
  document.querySelectorAll("[data-order-row]").forEach((row) => {
    const matchesSearch = row.dataset.search.includes(query);
    const matchesStatus = wantedStatus === "All" || row.dataset.status === wantedStatus;
    row.classList.toggle("hidden", !(matchesSearch && matchesStatus));
  });
}

function applyInventoryFilters() {
  const query = state.filters.inventorySearch.trim().toLowerCase();
  document.querySelectorAll("[data-inventory-row]").forEach((row) => {
    row.classList.toggle("hidden", !row.dataset.search.includes(query));
  });
}

async function loginEmployee(email, password) {
  const payload = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  state.auth.ready = true;
  state.auth.user = payload.employee;
  state.auth.expiresAt = payload.expiresAt;
  state.auth.error = "";
  await loadBootstrap();
  startLiveSync();
  showToast(`Signed in as ${payload.employee.fullName}.`);
}

async function logoutEmployee(message = "Signed out.") {
  try {
    await request("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  } catch (error) {
    console.error(error);
  }
  stopLiveSync();
  state.auth.ready = true;
  state.auth.user = null;
  state.auth.expiresAt = null;
  state.auth.error = "";
  state.data = null;
  state.cart = [];
  state.modal = null;
  render();
  showToast(message, "info");
}

async function submitCheckout() {
  if (!state.cart.length) {
    showToast("Add at least one item before saving the order.", "error");
    return;
  }
  if (state.pos.orderType === "dine-in" && !state.pos.tableId) {
    showToast("Choose a table for dine-in orders.", "error");
    return;
  }
  const payload = {
    orderType: state.pos.orderType,
    tableId: state.pos.orderType === "dine-in" ? Number(state.pos.tableId) : null,
    discount: Number(state.pos.discount || 0),
    paymentMethod: state.pos.paymentMethod,
    paymentStatus: state.pos.paymentMethod ? "paid" : "pending",
    notes: state.pos.notes,
    customer: {
      name: state.pos.customerName,
      phone: state.pos.customerPhone
    },
    items: state.cart.map((item) => ({
      menuItemId: item.id,
      qty: item.qty
    }))
  };

  const { order } = await request("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  showToast(`Order ${order.orderNumber} saved successfully.`);
  state.cart = [];
  state.pos = {
    ...state.pos,
    tableId: "",
    customerName: "",
    customerPhone: "",
    notes: "",
    discount: "0"
  };
  await loadBootstrap();
  openModal({ type: "receipt", order });
}

async function toggleMenuItem(id, available) {
  const item = state.data.menuItems.find((entry) => entry.id === Number(id));
  if (!item) {
    return;
  }
  await request(`/api/menu/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      ...item,
      available: Boolean(Number(available))
    })
  });
  showToast(`${item.name} ${Number(available) ? "is now live." : "was hidden from POS."}`);
  await loadBootstrap();
}

function printReceipt() {
  const receiptHtml = document.getElementById("receipt-content")?.innerHTML;
  if (!receiptHtml) {
    return;
  }
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) {
    showToast("Popup blocked. Please allow popups to print the receipt.", "error");
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>CafeMaster Receipt</title>
        <style>
          body { font-family: "Courier New", monospace; padding: 20px; color: #24150f; }
          .receipt-line { display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px dashed rgba(68,45,31,0.2); }
        </style>
      </head>
      <body>${receiptHtml}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

document.addEventListener("click", async (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) {
    return;
  }
  const action = trigger.dataset.action;

  if (action === "close-modal") {
    closeModal();
    return;
  }
  if (event.target.matches(".modal-backdrop")) {
    closeModal();
    return;
  }

  try {
    if (action === "navigate" || action === "jump") {
      state.screen = trigger.dataset.screen;
      render();
      return;
    }
    if (action === "refresh-data") {
      await loadBootstrap(true);
      return;
    }
    if (action === "logout") {
      await logoutEmployee();
      return;
    }
    if (action === "pos-category") {
      state.pos.category = trigger.dataset.category;
      render();
      return;
    }
    if (action === "menu-category") {
      state.filters.menuCategory = trigger.dataset.category;
      render();
      return;
    }
    if (action === "cart-add") {
      const item = state.data.menuItems.find((entry) => entry.id === Number(trigger.dataset.id));
      if (item) {
        upsertCartItem(item);
      }
      return;
    }
    if (action === "cart-qty") {
      adjustCartItem(trigger.dataset.id, Number(trigger.dataset.delta));
      return;
    }
    if (action === "cart-remove") {
      state.cart = state.cart.filter((item) => item.id !== Number(trigger.dataset.id));
      render();
      return;
    }
    if (action === "clear-cart") {
      clearCart();
      return;
    }
    if (action === "table-status") {
      await request(`/api/tables/${trigger.dataset.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: trigger.dataset.status })
      });
      showToast("Table status updated.");
      await loadBootstrap();
      return;
    }
    if (action === "open-menu-modal") {
      openModal({ type: "menu-form", item: null });
      return;
    }
    if (action === "edit-menu-item") {
      const item = state.data.menuItems.find((entry) => entry.id === Number(trigger.dataset.id));
      openModal({ type: "menu-form", item });
      return;
    }
    if (action === "toggle-menu-item") {
      await toggleMenuItem(trigger.dataset.id, trigger.dataset.available);
      return;
    }
    if (action === "open-restock-modal") {
      const item = state.data.menuItems.find((entry) => entry.id === Number(trigger.dataset.id));
      openModal({ type: "restock", item });
      return;
    }
    if (action === "update-order-status") {
      const { order } = await request(`/api/orders/${trigger.dataset.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: trigger.dataset.status })
      });
      showToast(`${order.orderNumber} moved to ${order.status}.`);
      await loadBootstrap();
      return;
    }
    if (action === "view-receipt") {
      const order = state.data.orders.find((entry) => entry.id === Number(trigger.dataset.id));
      openModal({ type: "receipt", order });
      return;
    }
    if (action === "print-receipt") {
      printReceipt();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-pos-field]")) {
    state.pos[event.target.dataset.posField] = event.target.value;
  }
  if (event.target.matches("[data-pos-field='discount']")) {
    syncCartTotals();
  }
  if (event.target.matches('[data-filter="pos-search"]')) {
    state.pos.search = event.target.value;
    applyPosFilters();
  }
  if (event.target.matches('[data-filter="menu-search"]')) {
    state.filters.menuSearch = event.target.value;
    applyMenuFilters();
  }
  if (event.target.matches('[data-filter="orders-search"]')) {
    state.filters.orderSearch = event.target.value;
    applyOrderFilters();
  }
  if (event.target.matches('[data-filter="inventory-search"]')) {
    state.filters.inventorySearch = event.target.value;
    applyInventoryFilters();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-pos-field]")) {
    state.pos[event.target.dataset.posField] = event.target.value;
  }
  if (event.target.matches("[data-pos-field='orderType']")) {
    state.pos.orderType = event.target.value;
    if (state.pos.orderType !== "dine-in") {
      state.pos.tableId = "";
    }
    render();
  }
  if (event.target.matches('[data-filter="orders-status"]')) {
    state.filters.orderStatus = event.target.value;
    applyOrderFilters();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.matches("[data-form]")) {
    return;
  }
  event.preventDefault();

  try {
    if (form.dataset.form === "login") {
      const formData = new FormData(form);
      try {
        await loginEmployee(formData.get("email"), formData.get("password"));
      } catch (error) {
        state.auth.error = error.message;
        render();
      }
      return;
    }
    if (form.dataset.form === "checkout") {
      await submitCheckout();
      return;
    }
    if (form.dataset.form === "menu-item") {
      const formData = new FormData(form);
      const payload = {
        name: formData.get("name"),
        category: formData.get("category"),
        description: formData.get("description"),
        price: Number(formData.get("price")),
        cost: Number(formData.get("cost")),
        stock: Number(formData.get("stock")),
        minStock: Number(formData.get("minStock")),
        prepTime: Number(formData.get("prepTime")),
        available: formData.get("available") === "on"
      };
      const id = formData.get("id");
      if (id) {
        await request(`/api/menu/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        showToast("Menu item updated.");
      } else {
        await request("/api/menu", { method: "POST", body: JSON.stringify(payload) });
        showToast("Menu item created.");
      }
      closeModal();
      await loadBootstrap();
      return;
    }
    if (form.dataset.form === "restock") {
      const formData = new FormData(form);
      await request(`/api/menu/${formData.get("id")}/restock`, {
        method: "POST",
        body: JSON.stringify({
          quantity: Number(formData.get("quantity")),
          reason: formData.get("reason")
        })
      });
      closeModal();
      showToast("Inventory updated.");
      await loadBootstrap();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
});

window.addEventListener("focus", async () => {
  if (!state.auth.user) {
    return;
  }
  try {
    await loadBootstrap(false);
  } catch (error) {
    console.error(error);
  }
});

document.addEventListener("visibilitychange", async () => {
  if (!state.auth.user || document.hidden) {
    return;
  }
  try {
    await loadBootstrap(false);
  } catch (error) {
    console.error(error);
  }
});

async function boot() {
  const hasSession = await restoreSession();
  if (!hasSession) {
    return;
  }
  await loadBootstrap(false);
  startLiveSync();
}

boot().catch((error) => {
  state.auth.ready = true;
  state.auth.user = null;
  state.auth.expiresAt = null;
  state.auth.error = error.message || launchHelpMessage();
  render();
});
