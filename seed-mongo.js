/**
 * seed-mongo.js
 * Database seeder for MongoDB
 * Usage:
 *   npm run seed          (seeds missing collections)
 *   npm run seed -- --reset (wipes collections and inserts fresh starter data)
 */

const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");

// Load .env file automatically
const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const { createStore } = require("./src/server/database-mongo");

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cafemaster";
const isReset = process.argv.includes("--reset") || process.argv.includes("-r");

async function runSeed() {
  console.log(`=======================================================`);
  console.log(`  CafeMaster Database Seeder`);
  console.log(`  Target URI: ${MONGO_URI.replace(/:([^:@]{1,})@/, ":***@")}`);
  console.log(`  Mode: ${isReset ? "Reset & Fresh Seed" : "Safe Seed (Keep Existing)"}`);
  console.log(`=======================================================\n`);

  if (isReset) {
    console.log("[0/3] Resetting existing collections in MongoDB...");
    const client = new MongoClient(MONGO_URI);
    try {
      await client.connect();
      const db = client.db();
      const collections = await db.listCollections().toArray();
      for (const coll of collections) {
        if (!coll.name.startsWith("system.")) {
          await db.collection(coll.name).drop().catch(() => {});
        }
      }
    } finally {
      await client.close().catch(() => {});
    }
  }

  const store = createStore(MONGO_URI);

  try {
    console.log("[1/3] Connecting to MongoDB and initializing collections...");
    await store.init();

    const db = store.db;

    console.log("[2/3] Checking seeded data in MongoDB...");
    const counts = {
      settings: await db.collection("settings").countDocuments(),
      tables: await db.collection("tables").countDocuments(),
      menu_items: await db.collection("menu_items").countDocuments(),
      employees: await db.collection("employees").countDocuments(),
      customers: await db.collection("customers").countDocuments(),
      suppliers: await db.collection("suppliers").countDocuments(),
      orders: await db.collection("orders").countDocuments(),
      reservations: await db.collection("reservations").countDocuments(),
      shifts: await db.collection("employee_shifts").countDocuments(),
      purchase_orders: await db.collection("purchase_orders").countDocuments()
    };

    console.log("\n--- Record Counts in Your MongoDB Database ---");
    for (const [coll, count] of Object.entries(counts)) {
      console.log(`  - ${coll.padEnd(18)}: ${count} documents`);
    }

    console.log("\n[3/3] Success! All original data is now saved into your MongoDB database.");
    console.log("You can start your app anytime with: npm start\n");
  } catch (err) {
    console.error("\n[ERROR] Could not seed database:");
    console.error(err.message);
    if (err.message.includes("bad auth") || err.message.includes("Authentication failed")) {
      console.error("\nHint: Check the password in your .env file.");
    } else if (err.message.includes("ECONNREFUSED") || err.message.includes("ETIMEDOUT")) {
      console.error("\nHint: Check MongoDB Atlas IP Whitelist (Network Access -> Allow 0.0.0.0/0).");
    }
    process.exit(1);
  } finally {
    await store.close().catch(() => {});
  }
}

runSeed();
