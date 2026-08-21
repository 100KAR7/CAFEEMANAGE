const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const { createStore, createHttpError, verifyPassword } = require("./database-mongo");

const initializedStores = new Map();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const SESSION_COOKIE = "cafemaster_session";

function requestProtocol(request) {
  const forwarded = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  if (forwarded) {
    return forwarded;
  }
  return request.socket?.encrypted ? "https" : "http";
}

async function ensureStoreInit(store, dbFile) {
  if (!initializedStores.get(dbFile)) {
    await store.init();
    initializedStores.set(dbFile, true);
  }
}

function createApp(options = {}) {
  const publicDir = options.publicDir || path.resolve(process.cwd(), "public");
  const dbFile = options.dbFile || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cafemaster";
  const store = createStore(dbFile);

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    const cookies = parseCookies(request.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE];

    setSecurityHeaders(response);
    setCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      await ensureStoreInit(store, dbFile);

      let session = null;
      if (sessionToken) {
        session = await store.getEmployeeSession(sessionToken);
      }

      if (pathname.startsWith("/api/")) {
        await handleApiRequest({
          request,
          response,
          pathname,
          store,
          session,
          sessionToken
        });
        return;
      }

      await serveStaticFile({ request, response, pathname, publicDir });
    } catch (error) {
      const normalizedError = normalizeAppError(error);
      sendJson(response, normalizedError.statusCode || 500, {
        error: normalizedError.statusCode ? normalizedError.message : "Something went wrong on the server."
      });
    }
  });

  return { server, store };
}

async function createHandler(options = {}) {
  const publicDir = options.publicDir || path.resolve(process.cwd(), "public");
  const dbFile = options.dbFile || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cafemaster";
  const store = createStore(dbFile);

  return async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    const cookies = parseCookies(request.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE];

    setSecurityHeaders(response);
    setCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      await ensureStoreInit(store, dbFile);

      let session = null;
      if (sessionToken) {
        session = await store.getEmployeeSession(sessionToken);
      }

      if (pathname.startsWith("/api/")) {
        await handleApiRequest({
          request,
          response,
          pathname,
          store,
          session,
          sessionToken
        });
        return;
      }

      await serveStaticFile({ request, response, pathname, publicDir });
    } catch (error) {
      const normalizedError = normalizeAppError(error);
      sendJson(response, normalizedError.statusCode || 500, {
        error: normalizedError.statusCode ? normalizedError.message : "Something went wrong on the server."
      });
    }
  };
}

async function handleApiRequest({ request, response, pathname, store, session, sessionToken }) {
  const menuMatch = pathname.match(/^\/api\/menu\/([a-zA-Z0-9_-]+)$/);
  const restockMatch = pathname.match(/^\/api\/menu\/([a-zA-Z0-9_-]+)\/restock$/);
  const tableMatch = pathname.match(/^\/api\/tables\/([a-zA-Z0-9_-]+)$/);
  const orderStatusMatch = pathname.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)\/status$/);
  const customerMatch = pathname.match(/^\/api\/customers\/([a-zA-Z0-9_-]+)$/);
  const employeeMatch = pathname.match(/^\/api\/employees\/([a-zA-Z0-9_-]+)$/);
  const reservationMatch = pathname.match(/^\/api\/reservations\/([a-zA-Z0-9_-]+)$/);
  const purchaseOrderMatch = pathname.match(/^\/api\/purchase-orders\/([a-zA-Z0-9_-]+)\/items$/);
  const notificationMatch = pathname.match(/^\/api\/notifications\/([a-zA-Z0-9_-]+)\/read$/);

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { ok: true, db: "mongodb", dbFile: store.dbFilePath });
    return;
  }

  if (request.method === "GET" && pathname === "/api/auth/session") {
    if (!session) {
      throw createHttpError(401, "Employee login required.");
    }
    sendJson(response, 200, { authenticated: true, employee: session.employee, expiresAt: session.expiresAt });
    return;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const payload = await parseJsonBody(request);
    const email = String(payload.email || "").trim();
    const password = String(payload.password || "");
    if (!email || !password) {
      throw createHttpError(400, "Email and password are required.");
    }

    const employee = await store.authenticateEmployee(email, password);
    const createdSession = await store.createEmployeeSession(employee.id);
    setSessionCookie(request, response, createdSession.token, createdSession.expiresAt);
    sendJson(response, 200, {
      authenticated: true,
      employee,
      expiresAt: createdSession.expiresAt
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    if (sessionToken) {
      await store.deleteEmployeeSession(sessionToken);
    }
    clearSessionCookie(request, response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && pathname === "/api/auth/manager-verify") {
    if (!session || session.employee.role !== "manager") {
      throw createHttpError(403, "Manager access required.");
    }
    const payload = await parseJsonBody(request);
    const employee = await store.getEmployeeByEmail(session.employee.email);
    if (!employee || !verifyPassword(payload.password, employee.passwordHash)) {
      throw createHttpError(401, "Invalid manager password.");
    }
    sendJson(response, 200, { verified: true });
    return;
  }

  // All endpoints below require authentication
  if (!session) {
    throw createHttpError(401, "Employee login required.");
  }

  if (request.method === "GET" && pathname === "/api/bootstrap") {
    const bootstrap = await store.getBootstrap();
    sendJson(response, 200, {
      ...bootstrap,
      currentEmployee: session.employee
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/dashboard") {
    sendJson(response, 200, await store.getDashboard());
    return;
  }

  if (request.method === "GET" && pathname === "/api/settings") {
    sendJson(response, 200, { settings: await store.getSettings() });
    return;
  }

  if (request.method === "PUT" && pathname === "/api/settings") {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, { settings: await store.updateSettings(payload, session.employee.id) });
    return;
  }

  // Menu endpoints
  if (request.method === "GET" && pathname === "/api/menu") {
    sendJson(response, 200, { items: await store.listMenuItems() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/menu") {
    const payload = await parseJsonBody(request);
    sendJson(response, 201, { item: await store.createMenuItem(payload) });
    return;
  }

  if (request.method === "PUT" && menuMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, { item: await store.updateMenuItem(menuMatch[1], payload) });
    return;
  }

  if (request.method === "POST" && restockMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, {
      item: await store.restockItem(
        restockMatch[1],
        payload.quantity,
        payload.reason,
        session.employee.id
      )
    });
    return;
  }

  // Table endpoints
  if (request.method === "GET" && pathname === "/api/tables") {
    sendJson(response, 200, { tables: await store.listTables() });
    return;
  }

  if (request.method === "PUT" && tableMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, { table: await store.updateTableState(tableMatch[1], payload) });
    return;
  }

  // Order endpoints
  if (request.method === "GET" && pathname === "/api/orders") {
    sendJson(response, 200, { orders: await store.listOrders() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/orders") {
    const payload = await parseJsonBody(request);
    sendJson(response, 201, { order: await store.createOrder(payload, session.employee.id) });
    return;
  }

  if (request.method === "PATCH" && orderStatusMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, {
      order: await store.updateOrderStatus(orderStatusMatch[1], payload, session.employee.id)
    });
    return;
  }

  // Customer endpoints
  if (request.method === "GET" && pathname === "/api/customers") {
    sendJson(response, 200, { customers: await store.listCustomers() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/customers") {
    const payload = await parseJsonBody(request);
    sendJson(response, 201, { customer: await store.createCustomer(payload, session.employee.id) });
    return;
  }

  if (request.method === "PUT" && customerMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, { customer: await store.updateCustomer(customerMatch[1], payload, session.employee.id) });
    return;
  }

  // Employee management endpoints
  if (request.method === "GET" && pathname === "/api/employees") {
    sendJson(response, 200, { employees: await store.listEmployees() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/employees") {
    const payload = await parseJsonBody(request);
    sendJson(response, 201, { employee: await store.createEmployee(payload) });
    return;
  }

  if (request.method === "PUT" && employeeMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, { employee: await store.updateEmployee(employeeMatch[1], payload) });
    return;
  }

  // Employee shifts
  if (request.method === "POST" && pathname === "/api/employee-shifts") {
    const payload = await parseJsonBody(request);
    const shiftId = await store.createEmployeeShift(payload);
    sendJson(response, 201, { id: shiftId });
    return;
  }

  if (request.method === "GET" && pathname === "/api/employee-shifts") {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const employeeId = url.searchParams.get("employeeId");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    sendJson(response, 200, {
      shifts: await store.listEmployeeShifts(
        employeeId || null,
        dateFrom,
        dateTo
      )
    });
    return;
  }

  // Reservation endpoints
  if (request.method === "GET" && pathname === "/api/reservations") {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const status = url.searchParams.get("status");
    sendJson(response, 200, { reservations: await store.listReservations(dateFrom, dateTo, status) });
    return;
  }

  if (request.method === "POST" && pathname === "/api/reservations") {
    const payload = await parseJsonBody(request);
    const reservationId = await store.createReservation(payload);
    sendJson(response, 201, { id: reservationId });
    return;
  }

  if (request.method === "PUT" && reservationMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, {
      reservation: await store.updateReservation(reservationMatch[1], payload)
    });
    return;
  }

  // Supplier endpoints
  if (request.method === "GET" && pathname === "/api/suppliers") {
    sendJson(response, 200, { suppliers: await store.listSuppliers() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/suppliers") {
    const payload = await parseJsonBody(request);
    const supplierId = await store.createSupplier(payload);
    sendJson(response, 201, { id: supplierId });
    return;
  }

  // Purchase order endpoints
  if (request.method === "GET" && pathname === "/api/purchase-orders") {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const status = url.searchParams.get("status");
    sendJson(response, 200, { purchaseOrders: await store.listPurchaseOrders(status) });
    return;
  }

  if (request.method === "POST" && pathname === "/api/purchase-orders") {
    const payload = await parseJsonBody(request);
    const poId = await store.createPurchaseOrder(payload);
    sendJson(response, 201, { id: poId });
    return;
  }

  if (request.method === "POST" && purchaseOrderMatch) {
    const payload = await parseJsonBody(request);
    const purchaseOrderId = purchaseOrderMatch[1];
    if (payload.purchaseOrderId && String(payload.purchaseOrderId) !== String(purchaseOrderId)) {
      throw createHttpError(400, "Purchase order ID in the URL must match the request body.");
    }
    const itemId = await store.addPurchaseOrderItem({
      ...payload,
      purchaseOrderId
    });
    sendJson(response, 201, { id: itemId });
    return;
  }

  // Audit log endpoints
  if (request.method === "GET" && pathname === "/api/audit-logs") {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    const limit = url.searchParams.get("limit") || 100;
    sendJson(response, 200, {
      auditLogs: await store.listAuditLogs(entityType, entityId || null, Number(limit))
    });
    return;
  }

  // Notification endpoints
  if (request.method === "GET" && pathname === "/api/notifications") {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";
    sendJson(response, 200, { notifications: await store.listNotifications(unreadOnly) });
    return;
  }

  if (request.method === "POST" && notificationMatch) {
    await store.markNotificationRead(notificationMatch[1]);
    sendJson(response, 200, { ok: true });
    return;
  }

  // Reporting endpoints
  if (request.method === "POST" && pathname === "/api/reports/sales") {
    const payload = await parseJsonBody(request);
    const report = await store.generateSalesReport(payload.dateFrom, payload.dateTo, payload.reportType);
    sendJson(response, 200, { report });
    return;
  }

  if (request.method === "GET" && pathname === "/api/reports/low-stock") {
    sendJson(response, 200, { alerts: await store.getLowStockAlerts() });
    return;
  }

  throw createHttpError(404, "Route not found.");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function normalizeAppError(error) {
  if (error?.statusCode) {
    return error;
  }

  const message = String(error?.message || "");
  const code = error?.code;

  if (code === 11000 || message.includes("E11000 duplicate key error")) {
    if (message.includes("menu_items") || message.includes("name_1")) {
      return createHttpError(409, "A menu item with that name already exists.");
    }
    if (message.includes("tables")) {
      return createHttpError(409, "A table with that name already exists.");
    }
    if (message.includes("customers") || message.includes("phone_1")) {
      return createHttpError(409, "This customer phone number already belongs to another guest.");
    }
    if (message.includes("employees") || message.includes("email_1")) {
      return createHttpError(409, "That employee email is already in use.");
    }
    return createHttpError(409, "A record with this identifier already exists.");
  }

  return error;
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin && host) {
    const expectedOrigin = `${requestProtocol(request)}://${host}`;
    if (origin === expectedOrigin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Vary", "Origin");
    }
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(createHttpError(413, "Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(createHttpError(400, "Invalid JSON body."));
      }
    });

    request.on("error", () => {
      reject(createHttpError(400, "Could not read request body."));
    });
  });
}

function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separator = part.indexOf("=");
      if (separator === -1) {
        return acc;
      }
      const key = decodeURIComponent(part.slice(0, separator).trim());
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function setSessionCookie(request, response, token, expiresAt) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
    `Max-Age=${Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))}`
  ];

  if (requestProtocol(request) === "https" || process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  response.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(request, response) {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0"
  ];

  if (requestProtocol(request) === "https" || process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  response.setHeader("Set-Cookie", parts.join("; "));
}

async function serveStaticFile({ request, response, pathname, publicDir }) {
  if (!["GET", "HEAD"].includes(request.method)) {
    throw createHttpError(405, "Method not allowed.");
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.resolve(publicDir, `.${safePath}`);

  if (!filePath.startsWith(publicDir)) {
    throw createHttpError(403, "Forbidden.");
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    throw createHttpError(404, "File not found.");
  }

  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": path.extname(filePath) === ".svg" ? "public, max-age=3600" : "no-cache"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  fs.createReadStream(filePath).pipe(response);
}

module.exports = {
  createApp,
  createHandler,
  SESSION_COOKIE
};
