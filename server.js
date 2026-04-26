const path = require("node:path");
const { createApp } = require("./src/server/app");

const PORT = Number(process.env.PORT || 3000);

const { server } = createApp({
  publicDir: path.resolve(__dirname, "public"),
  dbFile: path.resolve(__dirname, "data", "cafemaster.sqlite")
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`CafeMaster is running on http://localhost:${PORT}`);
  });
}

module.exports = {
  server
};
