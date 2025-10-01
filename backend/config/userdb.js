const mssql = require("mssql");
require("dotenv").config();

// Cache object for multiple server pools (keyed by ip+port)
let cachedPools = {};

const connectToUserDatabase = async (ip, port) => {
  const cacheKey = `${ip}:${port}`;

  // If we already have a live pool for this ip:port, reuse it
  if (cachedPools[cacheKey]) {
    try {
      await cachedPools[cacheKey].request().query("SELECT 1"); // ping
      return cachedPools[cacheKey];
    } catch (err) {
      console.warn(`⚠️ Stale pool for ${cacheKey}. Reconnecting...`);
      delete cachedPools[cacheKey];
    }
  }

  const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: ip.trim(),
    database: process.env.DB_DATABASE2,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    port: parseInt(port.trim(), 10) || 1433, // default to 1433 if missing
    connectionTimeout: 5000,
    requestTimeout: 5000,
  };

  try {
    const pool = await mssql.connect(dbConfig);
    console.log(`✅ Connected to MSSQL at ${cacheKey}`);
    cachedPools[cacheKey] = pool;
    return pool;
  } catch (err) {
    console.error(`❌ Failed to connect to MSSQL at ${cacheKey}:`, err);
    throw err;
  }
};

module.exports = { connectToUserDatabase, mssql };
