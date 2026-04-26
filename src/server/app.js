const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const { createStore, createHttpError } = require("./database");

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
  return request.socket.encrypted ? "https" : "http";
}

function createApp(options = {}) {
  const publicDir = options.publicDir || path.resolve(process.cwd(), "public");
  const dbFile = options.dbFile || path.resolve(process.cwd(), "data", "cafemaster.sqlite");
  const store = createStore(dbFile);

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    const cookies = parseCookies(request.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE];
    const session = sessionToken ? store.getEmployeeSession(sessionToken) : null;

    setSecurityHeaders(response);
    setCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
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

async function handleApiRequest({ request, response, pathname, store, session, sessionToken }) {
  const menuMatch = pathname.match(/^\/api\/menu\/(\d+)$/);
  const restockMatch = pathname.match(/^\/api\/menu\/(\d+)\/restock$/);
  const tableMatch = pathname.match(/^\/api\/tables\/(\d+)$/);
  const orderStatusMatch = pathname.match(/^\/api\/orders\/(\d+)\/status$/);

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { ok: true, dbFile: store.dbFilePath });
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

    const employee = store.authenticateEmployee(email, password);
    const createdSession = store.createEmployeeSession(employee.id);
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
      store.deleteEmployeeSession(sessionToken);
    }
    clearSessionCookie(request, response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (!session) {
    throw createHttpError(401, "Employee login required.");
  }

  if (request.method === "GET" && pathname === "/api/bootstrap") {
    sendJson(response, 200, {
      ...store.getBootstrap(),
      currentEmployee: session.employee
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/dashboard") {
    sendJson(response, 200, store.getDashboard());
    return;
  }

  if (request.method === "GET" && pathname === "/api/menu") {
    sendJson(response, 200, { items: store.listMenuItems() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/menu") {
    const payload = await parseJsonBody(request);
    sendJson(response, 201, { item: store.createMenuItem(payload) });
    return;
  }

  if (request.method === "PUT" && menuMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, { item: store.updateMenuItem(Number(menuMatch[1]), payload) });
    return;
  }

  if (request.method === "POST" && restockMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, {
      item: store.restockItem(Number(restockMatch[1]), payload.quantity, payload.reason)
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/tables") {
    sendJson(response, 200, { tables: store.listTables() });
    return;
  }

  if (request.method === "PUT" && tableMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, { table: store.updateTableState(Number(tableMatch[1]), payload) });
    return;
  }

  if (request.method === "GET" && pathname === "/api/orders") {
    sendJson(response, 200, { orders: store.listOrders() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/orders") {
    const payload = await parseJsonBody(request);
    sendJson(response, 201, { order: store.createOrder(payload) });
    return;
  }

  if (request.method === "PATCH" && orderStatusMatch) {
    const payload = await parseJsonBody(request);
    sendJson(response, 200, {
      order: store.updateOrderStatus(Number(orderStatusMatch[1]), payload)
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/customers") {
    sendJson(response, 200, { customers: store.listCustomers() });
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
  if (message.includes("UNIQUE constraint failed: menu_items.name")) {
    return createHttpError(409, "A menu item with that name already exists.");
  }
  if (message.includes("UNIQUE constraint failed: tables.name")) {
    return createHttpError(409, "A table with that name already exists.");
  }
  if (message.includes("UNIQUE constraint failed: customers.phone")) {
    return createHttpError(409, "This customer phone number already belongs to another guest.");
  }
  if (message.includes("UNIQUE constraint failed: employees.email")) {
    return createHttpError(409, "That employee email is already in use.");
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return createHttpError(409, "This change conflicts with related records in the database.");
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
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
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
  SESSION_COOKIE
};
