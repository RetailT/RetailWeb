const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { authenticateToken } = require('../middleware/authenticateToken');
const { connectToDatabase } = require('../config/db');
const authController = require('../controllers/authController');

const app = express();

// CORS should be applied first
app.use(cors({
  origin: ['https://www.retailtarget.lk', 'https://retailtarget.lk'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(bodyParser.json());

// Test route
app.get("/", (req, res) => {
  res.send("Hello from Node.js");
});

// Auth routes
app.post('/login', authController.login);
app.post('/register', authController.register);
app.post('/reset-password', authController.resetPassword);
app.post('/forgot-password', authController.forgotPassword);
app.post('/close-connection', authController.closeConnection);
app.post('/update-temp-sales-table', authController.updateTempSalesTable);
app.post('/update-temp-grn-table', authController.updateTempGrnTable);
app.post('/update-temp-tog-table', authController.updateTempTogTable);

app.delete('/stock-update-delete', authenticateToken, authController.stockUpdateDelete);
app.delete('/grnprn-delete', authenticateToken, authController.grnprnDelete);

app.put('/reset-database-connection', authenticateToken, authController.resetDatabaseConnection);

// GET routes with authentication
app.get('/companies', authenticateToken, authController.dashboardOptions);
app.get('/vendors', authenticateToken, authController.vendorOptions);
app.get('/report-data', authenticateToken, authController.reportData);
app.get('/current-report-data', authenticateToken, authController.currentReportData);
app.get('/dashboard-data', authenticateToken, authController.loadingDashboard);
app.get('/department-data', authenticateToken, authController.departmentDashboard);
app.get('/category-data', authenticateToken, authController.categoryDashboard);
app.get('/sub-category-data', authenticateToken, authController.subCategoryDashboard);
app.get('/vendor-data', authenticateToken, authController.vendorDashboard);
app.get('/scan', authenticateToken, authController.scan);
app.get('/stock-update', authenticateToken, authController.stockUpdate);
app.get('/grnprn-table-data', authenticateToken, authController.grnprnTableData);
app.get('/final-stock-update', authenticateToken, authController.finalStockUpdate);
app.get('/final-grnprn-update', authenticateToken, authController.finalGrnPrnUpdate);
app.get('/sync-databases', authenticateToken, authController.syncDatabases);
app.get('/find-user-connection', authenticateToken, authController.findUserConnection);

// Connect to the database once
connectToDatabase()
  .then(() => console.log("Database connected"))
  .catch((err) => console.error("Database connection failed", err));

// Export handler for Vercel
const serverless = require("serverless-http");
module.exports = serverless(app);
