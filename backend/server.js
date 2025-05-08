const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { authenticateToken } = require('./middleware/authenticateToken');
const { connectToDatabase } = require('./config/db');  // Import the connection function

const authController = require('./controllers/authController');

// Set up Express app
const app = express();
// const port = 8010;
const port = 5000;

const corsOptions = {
  origin: ['http://www.retailtarget.lk', 'http://retailtarget.lk', 'http://localhost:3000'], // Add both variants of the domain
  credentials: true,
  optionSuccessStatus: 200,
  methods: "GET,PUT,POST,DELETE"
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 
app.use(bodyParser.json());

// Connect to the database before starting the server
connectToDatabase().then(() => {
  // Routes
  app.get("/", (req, res) => {res.send("Hello from Node.js");});
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

  app.post('/login', authController.login);
  app.post('/register', authController.register);
  app.post('/reset-password', authController.resetPassword);
  app.post('/reset-password', authController.resetPassword);
  app.post('/forgot-password', authController.forgotPassword);
  app.post('/close-connection', authController.closeConnection);
  app.post('/update-temp-sales-table', authController.updateTempSalesTable);
  app.post('/update-temp-grn-table', authController.updateTempGrnTable);
  app.post('/update-temp-tog-table', authController.updateTempTogTable);

  app.delete('/stock-update-delete', authenticateToken, authController.stockUpdateDelete);
  app.delete('/grnprn-delete', authenticateToken, authController.grnprnDelete);

  app.put('/reset-database-connection', authenticateToken, authController.resetDatabaseConnection);

  // Start server
  app.listen(port,"0.0.0.0", () => {
    console.log(`Server running`);
  });
});
