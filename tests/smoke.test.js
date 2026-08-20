const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const { createApp } = require("../src/server/app");

async function main() {
  const dbFile = path.resolve(__dirname, "../data/cafemaster-smoke.sqlite");
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }

  const { server, store } = createApp({
    publicDir: path.resolve(__dirname, "../public"),
    dbFile
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const unauthorizedBootstrap = await fetch(`${base}/api/bootstrap`);
    assert.equal(unauthorizedBootstrap.status, 401);

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

    const notificationsPayload = await fetch(`${base}/api/notifications`, {
      headers: { Cookie: sessionCookie }
    }).then((response) => response.json());
    assert.ok(Array.isArray(notificationsPayload.notifications));
    if (notificationsPayload.notifications.length) {
      const readResponse = await fetch(`${base}/api/notifications/${notificationsPayload.notifications[0].id}/read`, {
        method: "POST",
        headers: { Cookie: sessionCookie, "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      assert.equal(readResponse.status, 200);
    }

    const logoutResponse = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: sessionCookie, "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(logoutResponse.status, 200);

    const afterLogout = await fetch(`${base}/api/bootstrap`, {
      headers: { Cookie: sessionCookie }
    });
    assert.equal(afterLogout.status, 401);

    console.log("Smoke test passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.db.close();
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
