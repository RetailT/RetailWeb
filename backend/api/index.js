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
app.get("/api", (req, res) => {
  res.send("Hello from Node.js");
});

// Auth routes
app.post('/api/login', authController.login);
// app.post('/api/register', authController.register);
// app.post('/api/reset-password', authController.resetPassword);
// app.post('/api/forgot-password', authController.forgotPassword);
// app.post('/api/close-connection', authController.closeConnection);
// app.post('/api/update-temp-sales-table', authController.updateTempSalesTable);
// app.post('/api/update-temp-grn-table', authController.updateTempGrnTable);
// app.post('/api/update-temp-tog-table', authController.updateTempTogTable);

// app.delete('/api/stock-update-delete', authenticateToken, authController.stockUpdateDelete);
// app.delete('/api/grnprn-delete', authenticateToken, authController.grnprnDelete);

// app.put('/api/reset-database-connection', authenticateToken, authController.resetDatabaseConnection);

// // GET routes with authentication
// app.get('/api/companies', authenticateToken, authController.dashboardOptions);
// app.get('/api/vendors', authenticateToken, authController.vendorOptions);
// app.get('/api/report-data', authenticateToken, authController.reportData);
// app.get('/api/current-report-data', authenticateToken, authController.currentReportData);
// app.get('/api/dashboard-data', authenticateToken, authController.loadingDashboard);
// app.get('/api/department-data', authenticateToken, authController.departmentDashboard);
// app.get('/api/category-data', authenticateToken, authController.categoryDashboard);
// app.get('/api/sub-category-data', authenticateToken, authController.subCategoryDashboard);
// app.get('/api/vendor-data', authenticateToken, authController.vendorDashboard);
// app.get('/api/scan', authenticateToken, authController.scan);
// app.get('/api/stock-update', authenticateToken, authController.stockUpdate);
// app.get('/api/grnprn-table-data', authenticateToken, authController.grnprnTableData);
// app.get('/api/final-stock-update', authenticateToken, authController.finalStockUpdate);
// app.get('/api/final-grnprn-update', authenticateToken, authController.finalGrnPrnUpdate);
// app.get('/api/sync-databases', authenticateToken, authController.syncDatabases);
// app.get('/api/find-user-connection', authenticateToken, authController.findUserConnection);

// Connect to the database once
connectToDatabase()
  .then(() => console.log("Database connected"))
  .catch((err) => console.error("Database connection failed", err));

//   if (require.main === module) {
//   const PORT = process.env.PORT || 5000;
//   app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
//   });
// }


// Export handler for Vercel
const serverless = require("serverless-http");
module.exports = serverless(app);