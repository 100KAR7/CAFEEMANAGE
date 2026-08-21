const assert = require("node:assert/strict");
const path = require("node:path");
const { MongoClient } = require("mongodb");

const { createApp } = require("../src/server/app-mongo");

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cafemaster-test";

async function main() {
  console.log(`Starting CafeMaster smoke test against MongoDB: ${MONGO_URI}`);

  // Test MongoDB connectivity before launching tests
  let client;
  try {
    client = new MongoClient(MONGO_URI, {
      connectTimeoutMS: 3000,
      serverSelectionTimeoutMS: 3000
    });
    await client.connect();
    // Drop test database for clean run
    await client.db().dropDatabase();
    await client.close();
  } catch (err) {
    console.error(`\n[NOTICE] Could not connect to MongoDB at ${MONGO_URI}.`);
    console.error(`Reason: ${err.message}`);
    console.error(`Please ensure MongoDB is running (locally or on Atlas) and MONGODB_URI is configured to run end-to-end smoke tests.\n`);
    process.exit(0);
  }

  const { server, store } = createApp({
    publicDir: path.resolve(__dirname, "../public"),
    dbFile: MONGO_URI
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    console.log("1. Testing unauthorized access...");
    const unauthorizedBootstrap = await fetch(`${base}/api/bootstrap`);
    assert.equal(unauthorizedBootstrap.status, 401);

    console.log("2. Testing admin employee authentication...");
    const loginResponse = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@cafemaster.local",
        password: "Cafe@12345"
      })
    });

    assert.equal(loginResponse.status, 200);
    const sessionCookieHeader = loginResponse.headers.get("set-cookie");
    assert.ok(sessionCookieHeader);
    const sessionCookie = sessionCookieHeader.split(";")[0];

    console.log("3. Testing bootstrap payload...");
    const bootstrap = await fetch(`${base}/api/bootstrap`, {
      headers: { Cookie: sessionCookie }
    }).then((response) => response.json());

    assert.ok(Array.isArray(bootstrap.menuItems));
    assert.ok(bootstrap.menuItems.length > 0);
    assert.ok(Array.isArray(bootstrap.tables));
    assert.equal(bootstrap.currentEmployee.email, "admin@cafemaster.local");
    assert.ok(bootstrap.currentEmployee.id);
    assert.ok(Array.isArray(bootstrap.reservations));
    assert.ok(Array.isArray(bootstrap.employees));
    assert.ok(Array.isArray(bootstrap.suppliers));
    assert.ok(Array.isArray(bootstrap.purchaseOrders));
    assert.ok(bootstrap.settings);

    console.log("4. Testing settings update...");
    const settingsResponse = await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        ...bootstrap.settings,
        tagline: "Phase Two Operations OS",
        taxRate: 0.07
      })
    });
    assert.equal(settingsResponse.status, 200);
    const settingsPayload = await settingsResponse.json();
    assert.equal(settingsPayload.settings.taxRate, 0.07);

    console.log("5. Testing customer creation...");
    const customerResponse = await fetch(`${base}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Smoke Phase Two Guest",
        phone: "9888800001",
        email: "phase2.guest@example.test"
      })
    });
    assert.equal(customerResponse.status, 201);
    const customerPayload = await customerResponse.json();
    assert.equal(customerPayload.customer.email, "phase2.guest@example.test");

    console.log("6. Testing employee creation...");
    const employeeResponse = await fetch(`${base}/api/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        fullName: "Smoke Phase Two Staff",
        email: "phase2.staff@example.test",
        role: "staff",
        hourlyRate: 14,
        password: "Phase2@123"
      })
    });
    assert.equal(employeeResponse.status, 201);
    const employeePayload = await employeeResponse.json();
    assert.equal(employeePayload.employee.role, "staff");

    console.log("7. Testing employee shift scheduling...");
    const shiftResponse = await fetch(`${base}/api/employee-shifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        employeeId: employeePayload.employee.id,
        startTime: "2026-08-21T09:00",
        endTime: "2026-08-21T17:00",
        role: "service"
      })
    });
    assert.equal(shiftResponse.status, 201);

    console.log("8. Testing table reservations...");
    const reservationTable = bootstrap.tables.find((entry) => entry.status === "free");
    assert.ok(reservationTable);
    const reservationResponse = await fetch(`${base}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        customerName: "Smoke Reservation Guest",
        customerPhone: "9888800002",
        tableId: reservationTable.id,
        partySize: Math.min(2, reservationTable.seats),
        reservationTime: "2026-08-21T19:30",
        notes: "Smoke reservation"
      })
    });
    assert.equal(reservationResponse.status, 201);
    const reservationPayload = await reservationResponse.json();
    const seatedReservationResponse = await fetch(`${base}/api/reservations/${reservationPayload.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ status: "completed" })
    });
    assert.equal(seatedReservationResponse.status, 200);

    console.log("9. Testing purchasing flow...");
    const purchaseOrderResponse = await fetch(`${base}/api/purchase-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        supplierId: bootstrap.suppliers[0].id,
        employeeId: bootstrap.currentEmployee.id,
        status: "draft",
        expectedDelivery: "2026-08-24",
        notes: "Smoke purchase order"
      })
    });
    assert.equal(purchaseOrderResponse.status, 201);
    const purchaseOrderPayload = await purchaseOrderResponse.json();

    console.log("10. Testing menu creation, restock, and inventory alerts...");
    const createMenuItemResponse = await fetch(`${base}/api/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Smoke Test Brownie Bites",
        category: "Dessert",
        description: "Small batch brownie bites for test coverage.",
        price: 110,
        cost: 44,
        stock: 2,
        minStock: 4,
        prepTime: 4,
        available: true
      })
    });

    assert.equal(createMenuItemResponse.status, 201);
    const createdMenuItemPayload = await createMenuItemResponse.json();
    assert.equal(createdMenuItemPayload.item.minStock, 4);

    const purchaseOrderItemResponse = await fetch(`${base}/api/purchase-orders/${purchaseOrderPayload.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        menuItemId: createdMenuItemPayload.item.id,
        quantity: 8,
        unitCost: 44
      })
    });
    assert.equal(purchaseOrderItemResponse.status, 201);

    const lowStockAfterCreate = await fetch(`${base}/api/reports/low-stock`, {
      headers: { Cookie: sessionCookie }
    }).then((response) => response.json());
    assert.ok(lowStockAfterCreate.alerts.some((alert) => alert.id === createdMenuItemPayload.item.id));

    const restockResponse = await fetch(`${base}/api/menu/${createdMenuItemPayload.item.id}/restock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        quantity: 3,
        reason: "Smoke test restock"
      })
    });

    assert.equal(restockResponse.status, 200);
    const restockedMenuItemPayload = await restockResponse.json();
    assert.equal(restockedMenuItemPayload.item.stock, 5);

    const lowStockAfterRestock = await fetch(`${base}/api/reports/low-stock`, {
      headers: { Cookie: sessionCookie }
    }).then((response) => response.json());
    assert.ok(!lowStockAfterRestock.alerts.some((alert) => alert.id === createdMenuItemPayload.item.id));

    console.log("11. Testing order creation & checkout lifecycle...");
    const menuItem = bootstrap.menuItems.find((item) => item.available && item.stock > 0);
    const latestTables = await fetch(`${base}/api/tables`, {
      headers: { Cookie: sessionCookie }
    }).then((response) => response.json());
    const table = latestTables.tables.find((entry) => entry.status === "free");
    assert.ok(menuItem);
    assert.ok(table);

    const createResponse = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        orderType: "dine-in",
        tableId: table.id,
        paymentMethod: "UPI",
        customer: { name: "Smoke Test Guest", phone: "9999999999" },
        items: [{ menuItemId: menuItem.id, qty: 1 }]
      })
    });

    assert.equal(createResponse.status, 201);
    const createdPayload = await createResponse.json();
    assert.equal(createdPayload.order.tableId, table.id);
    assert.equal(createdPayload.order.items.length, 1);
    assert.equal(createdPayload.order.employeeId, bootstrap.currentEmployee.id);
    assert.equal(createdPayload.order.employeeName, bootstrap.currentEmployee.fullName);

    const completeResponse = await fetch(`${base}/api/orders/${createdPayload.order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ status: "completed" })
    });

    assert.equal(completeResponse.status, 200);
    const completedPayload = await completeResponse.json();
    assert.equal(completedPayload.order.status, "completed");

    const invalidTransitionResponse = await fetch(`${base}/api/orders/${createdPayload.order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ status: "cancelled" })
    });
    assert.equal(invalidTransitionResponse.status, 409);

    const tablesPayload = await fetch(`${base}/api/tables`, {
      headers: { Cookie: sessionCookie }
    }).then((response) => response.json());
    const updatedTable = tablesPayload.tables.find((entry) => entry.id === table.id);
    assert.equal(updatedTable.status, "free");

    console.log("12. Testing sales reporting...");
    const salesReportResponse = await fetch(`${base}/api/reports/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        dateFrom: "1970-01-01T00:00:00.000Z",
        dateTo: "2999-12-31T23:59:59.999Z",
        reportType: "smoke"
      })
    });
    assert.equal(salesReportResponse.status, 200);
    const salesReportPayload = await salesReportResponse.json();
    assert.ok(salesReportPayload.report.totalOrders >= 1);

    console.log("\nAll CafeMaster MongoDB smoke tests passed successfully!\n");
  } finally {
    await store.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error("\n[SMOKE TEST ERROR]:", error);
  process.exit(1);
});
