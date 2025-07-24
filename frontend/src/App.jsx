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
import SyncDatabase from "./pages/syncDatabase";
import ColorSizeSalesDepartment from "./pages/colorSizeSalesDepartment"
import ColorSizeSalesCategory from "./pages/colorSizeSalesCategoryDashboard"
import ColorSizeSalesSubCategory from "./pages/colorSizeSalesSubCategoryDashboard"
import ColorSizeSalesVendor from "./pages/colorSizeSalesVendorDashboard"
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
        <Route path="/report" element={<ProtectedRoute> <Report /> </ProtectedRoute>}/>
        <Route path="/vendor-dashboard" element={<ProtectedRoute> <VendorDashboard /> </ProtectedRoute>}/>
        <Route path="/sync-databases" element={<ProtectedRoute> <SyncDatabase /> </ProtectedRoute>}/> 
        <Route path="/product-view" element={<ProtectedRoute> <ProductView /> </ProtectedRoute>}/> 
        <Route path="/color-size-sales-department" element={<ProtectedRoute> <ColorSizeSalesDepartment /> </ProtectedRoute>}/>   
        <Route path="/color-size-sales-category" element={<ProtectedRoute> <ColorSizeSalesCategory /> </ProtectedRoute>}/>  
        <Route path="/color-size-sales-subcategory" element={<ProtectedRoute> <ColorSizeSalesSubCategory /> </ProtectedRoute>}/>
        <Route path="/color-size-sales-vendor" element={<ProtectedRoute> <ColorSizeSalesVendor /> </ProtectedRoute>}/>    
      </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;


// npm install --legacy-peer-deps
