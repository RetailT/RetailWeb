// routes/debug.js
const express = require('express');
const router = express.Router();
// const { connectToDatabase } = require('../config/db');
// const { connectToUserDatabase } = require('../config/userdb');
// const mssql = require('mssql');

// Clear main DB cache
router.get('/clear-main-cache', async (req, res) => {
  try {
    const { cachedPool } = require('../config/db');
    if (cachedPool) {
      await cachedPool.close();
      console.log('Main DB cache cleared');
    }
    res.json({ message: 'Main cache cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear user DB cache
router.get('/clear-user-cache', async (req, res) => {
  try {
    const { cachedPools } = require('../config/userdb');
    for (const key in cachedPools) {
      await cachedPools[key].close();
      delete cachedPools[key];
    }
    console.log('User DB cache cleared');
    res.json({ message: 'User cache cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear ALL
router.get('/clear-all-cache', async (req, res) => {
  try {
    // Clear main
    const db = require('../config/db');
    if (db.cachedPool) {
      await db.cachedPool.close();
      db.cachedPool = null;
    }

    // Clear user pools
    const userdb = require('../config/userdb');
    for (const key in userdb.cachedPools) {
      await userdb.cachedPools[key].close();
      delete userdb.cachedPools[key];
    }

    console.log('ALL DB CACHES CLEARED');
    res.json({ message: 'All caches cleared!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;