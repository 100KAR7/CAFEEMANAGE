/**
 * CafeMaster - Server Entry Point (MongoDB)
 */

const fs = require("node:fs");
const path = require("node:path");

// Load .env file automatically if it exists
const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const { createApp } = require("./src/server/app-mongo");

const PORT = Number(process.env.PORT || 3000);
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cafemaster";

const { server, store } = createApp({
  publicDir: path.resolve(__dirname, "public"),
  dbFile: MONGO_URI
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  CafeMaster (MongoDB) is live!`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Database: ${MONGO_URI}`);
    console.log(`========================================`);
  });
}

module.exports = {
  server,
  store
};
