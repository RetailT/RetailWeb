import React from 'react';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./pages/login";
import Register from "./pages/register";
import ResetPassword from "./pages/resetPassword";
import SalesDashboard from "./pages/salesDashboard";
import DepartmentDashboard from "./pages/departmentDashboard";
import CategoryDashboard from "./pages/categoryDashboard";
import SubCategoryDashboard from "./pages/subCategoryDashboard";
import VendorDashboard from "./pages/vendorDashboard";
import StockUpdate from "./pages/stockUpdate";
import Invoice from "./pages/invoice";
import SyncDatabase from "./pages/syncDatabase";
import ColorSizeSalesDepartment from "./pages/colorSizeSalesDepartment"
import ColorSizeSalesCategory from "./pages/colorSizeSalesCategoryDashboard"
import ColorSizeSalesSubCategory from "./pages/colorSizeSalesSubCategoryDashboard"
import ColorSizeSalesVendor from "./pages/colorSizeSalesVendorDashboard"
import ColorSizeSalesProduct from "./pages/colorSizeSalesProduct"
import ColorSizeStockProduct from "./pages/colorSizeStockProduct"
import ColorSizeStockDepartment from "./pages/colorSizeStockDepartment"
import ColorSizeStockCategory from "./pages/colorSizeStockCategory"
import ColorSizeStockSubCategory from "./pages/colorSizeStockSubCategory"
import ColorSizeStockVendor from "./pages/colorSizeStockVendor"
import StockWiseProduct from "./pages/stockWiseReportProduct"
import StockWiseDepartment from "./pages/stockWiseReportDepartment"
import StockWiseCategory from "./pages/stockWiseReportCategory"
import StockWiseSubCategory from "./pages/stockWiseReportSubCategory"
import HourlyReportDashboard from './pages/hourlyReport'; 
import StockWiseVendor from "./pages/stockWiseReportVendor"
import SalseComparison from "./pages/salesComparison"
import Report from "./pages/report";
import Scan from "./pages/scan";
import Reset from "./pages/reset";
import Profile from "./pages/profile";
import ProductView from "./pages/productView";
import Home from "./pages/home";
import ProtectedRoute from "./ProtectedRoute";
import { AuthProvider } from './AuthContext';

function App() {
  
  return (
   
<AuthProvider>
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profile" element={<ProtectedRoute> <Profile /> </ProtectedRoute>}/>
        <Route path="/reset" element={<ProtectedRoute> <Reset /> </ProtectedRoute>}/>
        <Route path="/scan" element={<ProtectedRoute> <Scan /> </ProtectedRoute>}/>
        <Route path="/company-dashboard" element={<ProtectedRoute> <SalesDashboard /> </ProtectedRoute>}/>
        <Route path="/department-dashboard" element={<ProtectedRoute> <DepartmentDashboard /> </ProtectedRoute>}/>
        <Route path="/category-dashboard" element={<ProtectedRoute> <CategoryDashboard /> </ProtectedRoute>}/>
        <Route path="/sub-category-dashboard" element={<ProtectedRoute> <SubCategoryDashboard /> </ProtectedRoute>}/>
        <Route path="/stock-update" element={<ProtectedRoute> <StockUpdate /> </ProtectedRoute>}/>
        <Route path="/invoice" element={<ProtectedRoute> <Invoice /> </ProtectedRoute>}/>
        <Route path="/report" element={<ProtectedRoute> <Report /> </ProtectedRoute>}/>
        <Route path="/vendor-dashboard" element={<ProtectedRoute> <VendorDashboard /> </ProtectedRoute>}/>
        <Route path="/hourly-report-dashboard" element={<ProtectedRoute> <HourlyReportDashboard /> </ProtectedRoute>}/>
        <Route path="/sales-comparison" element={<ProtectedRoute> <SalseComparison /> </ProtectedRoute>}/>
        <Route path="/sync-databases" element={<ProtectedRoute> <SyncDatabase /> </ProtectedRoute>}/> 
        <Route path="/product-view" element={<ProtectedRoute> <ProductView /> </ProtectedRoute>}/> 
        <Route path="/color-size-sales-department" element={<ProtectedRoute> <ColorSizeSalesDepartment /> </ProtectedRoute>}/>   
        <Route path="/color-size-sales-category" element={<ProtectedRoute> <ColorSizeSalesCategory /> </ProtectedRoute>}/>  
        <Route path="/color-size-sales-subcategory" element={<ProtectedRoute> <ColorSizeSalesSubCategory /> </ProtectedRoute>}/>
        <Route path="/color-size-sales-vendor" element={<ProtectedRoute> <ColorSizeSalesVendor /> </ProtectedRoute>}/>  
        <Route path="/color-size-sales-product" element={<ProtectedRoute> <ColorSizeSalesProduct /> </ProtectedRoute>}/>   
        <Route path="/color-size-stock-product" element={<ProtectedRoute> <ColorSizeStockProduct /> </ProtectedRoute>}/> 
        <Route path="/color-size-stock-department" element={<ProtectedRoute> <ColorSizeStockDepartment /> </ProtectedRoute>}/>
        <Route path="/color-size-stock-category" element={<ProtectedRoute> <ColorSizeStockCategory /> </ProtectedRoute>}/>
        <Route path="/color-size-stock-subcategory" element={<ProtectedRoute> <ColorSizeStockSubCategory /> </ProtectedRoute>}/>
        <Route path="/color-size-stock-vendor" element={<ProtectedRoute> <ColorSizeStockVendor /> </ProtectedRoute>}/>
        <Route path="/stock-wise-product" element={<ProtectedRoute> <StockWiseProduct /> </ProtectedRoute>}/>
        <Route path="/stock-wise-department" element={<ProtectedRoute> <StockWiseDepartment /> </ProtectedRoute>}/>
        <Route path="/stock-wise-category" element={<ProtectedRoute> <StockWiseCategory /> </ProtectedRoute>}/>
        <Route path="/stock-wise-sub-category" element={<ProtectedRoute> <StockWiseSubCategory /> </ProtectedRoute>}/>
        <Route path="/stock-wise-vendor" element={<ProtectedRoute> <StockWiseVendor /> </ProtectedRoute>}/>
      </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;


// npm install --legacy-peer-deps
