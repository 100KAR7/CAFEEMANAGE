/**
 * API route for Vercel serverless deployment with MongoDB
 */

const path = require("node:path");
const { createHandler } = require("../src/server/app-mongo");

// Get MongoDB connection string from environment
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cafemaster";

// Cache the handler once initialized
let handlerInstance = null;
let handlerPromise = null;

// Export for Vercel serverless
module.exports = async (req, res) => {
  // Initialize handler on first request
  if (!handlerInstance) {
    if (!handlerPromise) {
      handlerPromise = createHandler({
        publicDir: path.resolve(__dirname, "..", "public"),
        dbFile: MONGO_URI
      });
    }
    handlerInstance = await handlerPromise;
  }
  return handlerInstance(req, res);
};
