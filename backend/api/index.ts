import express, { Request, Response } from "express";
import cors from "cors";
import serverless from "serverless-http";
const { authenticateToken } = require('../middleware/authMiddleware'); 

const app = express();

// Import your controllers and middleware here
const authController = require("../controllers/authController");

app.use(
  cors({
    origin: ["https://retailtarget.lk", "https://retail-web-xo4u.vercel.app", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json());

// Define routes
app.get("/", (req: Request, res: Response) => {
  res.send("Hello from Nodejs and Express!");
});

app.get('/companies', authenticateToken, authController.dashboardOptions);
app.get('/vendors', authenticateToken, authController.vendorOptions);
app.get('/report-data', authenticateToken, authController.reportData);
app.get('/current-report-data', authenticateToken, authController.currentReportData);
app.get('/dashboard-data', authenticateToken, authController.loadingDashboard);
app.get('/department-data', authenticateToken, authController.departmentDashboard);
app.get('/color-size-sales-department-data', authenticateToken, authController.colorSizeSalesDepartment);
app.get('/color-size-sales-category-data', authenticateToken, authController.colorSizeSalesCategory);
app.get('/color-size-sales-subcategory-data', authenticateToken, authController.colorSizeSalesSubCategory);
app.get('/color-size-sales-vendor-data', authenticateToken, authController.colorSizeSalesVendor);
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
app.get('/product-view', authenticateToken, authController.productView);
app.get('/product-view-sales', authenticateToken, authController.productViewSales);
app.get('/product-names', authenticateToken, authController.productName);

app.post("/login", authController.login);
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

// if (process.env.NODE_ENV !== "production") {
//   app.listen(5000, () => {
//     console.log(`Server is running on http://localhost:5000`);
//   });
// }

// const handler = serverless(app);
// export default handler;

// Export as serverless function
module.exports = app;
module.exports.handler = serverless(app);



