import { useState, useEffect, useRef } from "react";
// import axios from "axios";
import {FaChevronDown } from "react-icons/fa";
import { MdManageAccounts, MdSpaceDashboard } from "react-icons/md";
import { MdCalculate } from "react-icons/md";
import { FaCartFlatbed } from "react-icons/fa6";
import { IoMdColorPalette } from "react-icons/io";
import { NavLink } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const Sidebar = ({ onToggle, isOpen, toggleSidebar }) => {
  const [adminOpen, setAdminOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [stockWiseReportOpen, setStockWiseReportOpen] = useState(false);
  const [colorWiseOpen, setColorWiseOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [colorWiseSalesOpen, setColorWiseSalesOpen] = useState(false);
  const [colorWiseStockOpen, setColorWiseStockOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        toggleSidebar();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, toggleSidebar]);

  const token = localStorage.getItem("authToken");
  let a_permission = "";
  let a_sync = "";
  let d_company = "";
  let d_department = "";
  let d_category = "";
  let d_scategory = "";
  let d_vendor = "";
  let d_hourlyReport = "";
  let d_sales_comparison = "";
  let d_invoice = "";
  let d_productView = "";
  let t_scan = "";
  let t_invoice = "";
  let t_stock_update = "";
  let c_st_product_wise = "";
  let c_st_department = "";
  let c_st_category = "";
  let c_st_scategory = "";
  let c_st_vendor = "";
  let c_sa_product_wise = "";
  let c_sa_department = "";
  let c_sa_category = "";
  let c_sa_scategory = "";
  let c_sa_vendor = "";
  let s_product = "";
  let s_department = "";
  let s_category = "";
  let s_scategory = "";
  let s_vendor = "";

  if (token) {
    const decodedToken = jwtDecode(token);
    a_permission = decodedToken.a_permission;
    a_sync = decodedToken.a_sync;
    d_company = decodedToken.d_company;
    d_department = decodedToken.d_department;
    d_category = decodedToken.d_category;
    d_scategory = decodedToken.d_scategory;
    d_vendor = decodedToken.d_vendor;
    d_hourlyReport = decodedToken.d_hourlyReport;
    d_sales_comparison = decodedToken.d_sales_comparison;
    d_invoice = decodedToken.d_invoice;
    d_productView = decodedToken.d_productView;
    t_scan = decodedToken.t_scan;
    t_invoice = decodedToken.t_invoice;
    t_stock_update = decodedToken.t_stock_update;
    c_st_product_wise = decodedToken.c_st_product_wise;
    c_st_department = decodedToken.c_st_department;
    c_st_category = decodedToken.c_st_category;
    c_st_scategory = decodedToken.c_st_scategory;
    c_st_vendor = decodedToken.c_st_vendor;
    c_sa_product_wise = decodedToken.c_sa_product_wise;
    c_sa_department = decodedToken.c_sa_department;
    c_sa_category = decodedToken.c_sa_category;
    c_sa_scategory = decodedToken.c_sa_scategory;
    c_sa_vendor = decodedToken.c_sa_vendor;
    s_product = decodedToken.s_product;
    s_department = decodedToken.s_department;
    s_category = decodedToken.s_category;
    s_scategory = decodedToken.s_scategory;
    s_vendor = decodedToken.s_vendor;
  } else {
    console.error("No token found in localStorage");
  }

  const establishConnection = async () => {
    // Backend connection logic here
  };

  const toggleAdmin = () => {
    setAdminOpen(!adminOpen); 
  };

  const toggleDashboard = () => {
    setDashboardOpen(!dashboardOpen); 
  };

  const toggleStockWiseReport = () => {
    setStockWiseReportOpen(!stockWiseReportOpen); 
  };

  const toggleColorWise = () => {
    setColorWiseOpen(!colorWiseOpen); 
  };

  const toggleColorWiseSales = () => {
    setColorWiseSalesOpen(!colorWiseSalesOpen); 
  };

  const toggleColorWiseStock = () => {
    setColorWiseStockOpen(!colorWiseStockOpen);
  };

  const toggleReport = () => {
    setTransactionOpen(!transactionOpen);
  };

  const handleNavLinkClick = () => {
    establishConnection();
    toggleSidebar();
  };

  return (
    <div
      ref={sidebarRef}
      className={`fixed top-10 left-0 h-full bg-gradient-to-t from-[#ce521a] to-[#000000] text-white shadow-md transition-all duration-300 ${
        isOpen ? "w-80" : "w-0 overflow-hidden"
      }`}
      style={{ zIndex: 40 }}
    >
      <div className="flex flex-col w-full h-full">
        <ul className="flex-1 overflow-y-auto mt-14">
          {/* Dashboard */}
          {((d_company && d_company.toLowerCase() === "t") ||
            (d_department && d_department.toLowerCase() === "t") ||
            (d_category && d_category.toLowerCase() === "t") ||
            (d_scategory && d_scategory.toLowerCase() === "t") ||
            (d_vendor && d_vendor.toLowerCase() === "t") ||
            (d_hourlyReport && d_hourlyReport.toLowerCase() === "t") ||
            (d_sales_comparison && d_sales_comparison.toLowerCase() === "t") ||
            (d_invoice && d_invoice.toLowerCase() === "t") ||
            (d_productView && d_productView.toLowerCase() === "t")) && (
            <li
              className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
              onClick={toggleDashboard}
              aria-haspopup="true"
              aria-expanded={dashboardOpen}
            >
              <MdSpaceDashboard size={20} className="mt-3 mb-4 ml-2 mr-2" />
              <span className={`${isOpen ? "block" : "hidden"} ml-4`}>
                Dashboard
              </span>
              {isOpen && (
                <FaChevronDown
                  size={14}
                  className={`ml-auto transition-transform mr-5 ${
                    dashboardOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          )}

          <ul className="pl-8 ml-8">
            {d_company?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/company-dashboard" onClick={handleNavLinkClick} className="w-full">
                  Summary
                </NavLink>
              </li>
            )}

            {d_department?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/department-dashboard" onClick={handleNavLinkClick} className="w-full">
                  Departments
                </NavLink>
              </li>
            )}

            {d_category?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/category-dashboard" onClick={handleNavLinkClick} className="w-full">
                  Category
                </NavLink>
              </li>
            )}

            {d_scategory?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/sub-category-dashboard" onClick={handleNavLinkClick} className="w-full">
                  Sub Category
                </NavLink>
              </li>
            )}

            {d_vendor?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/vendor-dashboard" onClick={handleNavLinkClick} className="w-full">
                  Vendor
                </NavLink>
              </li>
            )}

            {d_hourlyReport?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/hourly-report-dashboard" onClick={handleNavLinkClick} className="w-full">
                  Hourly Report
                </NavLink>
              </li>
            )}

            {d_sales_comparison?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/sales-comparison" onClick={handleNavLinkClick} className="w-full"> 
                  Sales Comparison
                </NavLink>
              </li>
            )}

            {d_invoice?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/report" onClick={handleNavLinkClick} className="w-full">
                  Invoice Wise Report
                </NavLink>
              </li>
            )}

            {d_productView?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/product-view" onClick={handleNavLinkClick} className="w-full">
                  Product View
                </NavLink>
              </li>
            )}
          </ul>

          {/* Stock Wise Report */}
          {((s_product && s_product.toLowerCase() === "t") ||
            (s_department && s_department.toLowerCase() === "t") ||
            (s_category && s_category.toLowerCase() === "t") ||
            (s_scategory && s_scategory.toLowerCase() === "t") ||
            (s_vendor && s_vendor.toLowerCase() === "t")) && (
            <li
              className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
              onClick={toggleStockWiseReport}
              aria-haspopup="true"
              aria-expanded={stockWiseReportOpen}
            >
              <FaCartFlatbed size={20} className="mt-3 mb-4 ml-2 mr-2" />
              <span className={`${isOpen ? "block" : "hidden"} ml-4`}>
                Stock Wise Report
              </span>
              {isOpen && (
                <FaChevronDown
                  size={14}
                  className={`ml-auto transition-transform mr-5 ${
                    stockWiseReportOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          )}

          <ul className="pl-8 ml-8">
            {s_product?.toLowerCase() === "t" && stockWiseReportOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/stock-wise-product" onClick={handleNavLinkClick} className="w-full">
                  Product Wise
                </NavLink>
              </li>
            )}

            {s_department?.toLowerCase() === "t" && stockWiseReportOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/stock-wise-department" onClick={handleNavLinkClick} className="w-full">
                  Department
                </NavLink>
              </li>
            )}

            {s_category?.toLowerCase() === "t" && stockWiseReportOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/stock-wise-category" onClick={handleNavLinkClick} className="w-full">
                  Category
                </NavLink>
              </li>
            )}

            {s_scategory?.toLowerCase() === "t" && stockWiseReportOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/stock-wise-sub-category" onClick={handleNavLinkClick} className="w-full">
                  Sub Category
                </NavLink>
              </li>
            )}

            {s_vendor?.toLowerCase() === "t" && stockWiseReportOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/stock-wise-vendor" onClick={handleNavLinkClick} className="w-full">
                  Vendor
                </NavLink>
              </li>
            )}
          </ul>

          {/* Color Size */}
          {(c_st_product_wise?.toLowerCase() === "t" ||
            c_st_department?.toLowerCase() === "t" ||
            c_st_category?.toLowerCase() === "t" ||
            c_st_scategory?.toLowerCase() === "t" ||
            c_st_vendor?.toLowerCase() === "t" ||
            c_sa_product_wise?.toLowerCase() === "t" ||
            c_sa_department?.toLowerCase() === "t" ||
            c_sa_category?.toLowerCase() === "t" ||
            c_sa_scategory?.toLowerCase() === "t" ||
            c_sa_vendor?.toLowerCase() === "t") && (
            <>
              <li
                className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
                onClick={toggleColorWise}
                aria-haspopup="true"
                aria-expanded={colorWiseOpen}
              >
                <IoMdColorPalette size={20} className="mt-3 mb-4 ml-2 mr-2" />
                <span className={`${isOpen ? "block" : "hidden"} ml-4`}>
                  Color Size
                </span>
                {isOpen && (
                  <FaChevronDown
                    size={14}
                    className={`ml-auto transition-transform mr-5 ${
                      colorWiseOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>

              {colorWiseOpen && isOpen && (
                <ul className="pl-4 ml-8">
                  {(c_st_product_wise?.toLowerCase() === "t" ||
                    c_st_department?.toLowerCase() === "t" ||
                    c_st_category?.toLowerCase() === "t" ||
                    c_st_scategory?.toLowerCase() === "t" ||
                    c_st_vendor?.toLowerCase() === "t") && (
                    <li
                      className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
                      onClick={toggleColorWiseStock}
                      aria-haspopup="true"
                      aria-expanded={colorWiseStockOpen}
                    >
                      <span className="ml-4">Stock</span>
                      <FaChevronDown
                        size={14}
                        className={`ml-auto transition-transform mr-5 ${
                          colorWiseStockOpen ? "rotate-180" : ""
                        }`}
                      />
                    </li>
                  )}

                  {colorWiseStockOpen && (
                    <ul className="pl-4 ml-4">
                      {c_st_product_wise?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-stock-product" onClick={handleNavLinkClick} className="w-full">
                            Product Wise
                          </NavLink>
                        </li>
                      )}
                      {c_st_department?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-stock-department" onClick={handleNavLinkClick} className="w-full">
                            Departments
                          </NavLink>
                        </li>
                      )}
                      {c_st_category?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-stock-category" onClick={handleNavLinkClick} className="w-full">
                            Category
                          </NavLink>
                        </li>
                      )}
                      {c_st_scategory?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-stock-subcategory" onClick={handleNavLinkClick} className="w-full">
                            Sub Category
                          </NavLink>
                        </li>
                      )}
                      {c_st_vendor?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-stock-vendor" onClick={handleNavLinkClick} className="w-full">
                            Vendor
                          </NavLink>
                        </li>
                      )}
                    </ul>
                  )}

                  {(c_sa_product_wise?.toLowerCase() === "t" ||
                    c_sa_department?.toLowerCase() === "t" ||
                    c_sa_category?.toLowerCase() === "t" ||
                    c_sa_scategory?.toLowerCase() === "t" ||
                    c_sa_vendor?.toLowerCase() === "t") && (
                    <li
                      className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
                      onClick={toggleColorWiseSales}
                      aria-haspopup="true"
                      aria-expanded={colorWiseSalesOpen}
                    >
                      <span className="ml-4">Sales</span>
                      <FaChevronDown
                        size={14}
                        className={`ml-auto transition-transform mr-5 ${
                          colorWiseSalesOpen ? "rotate-180" : ""
                        }`}
                      />
                    </li>
                  )}

                  {colorWiseSalesOpen && (
                    <ul className="pl-4 ml-4">
                      {c_sa_product_wise?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-sales-product" onClick={handleNavLinkClick} className="w-full">
                            Product Wise
                          </NavLink>
                        </li>
                      )}
                      {c_sa_department?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-sales-department" onClick={handleNavLinkClick} className="w-full">
                            Department
                          </NavLink>
                        </li>
                      )}
                      {c_sa_category?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-sales-category" onClick={handleNavLinkClick} className="w-full">
                            Category
                          </NavLink>
                        </li>
                      )}
                      {c_sa_scategory?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-sales-subcategory" onClick={handleNavLinkClick} className="w-full">
                            Sub Category
                          </NavLink>
                        </li>
                      )}
                      {c_sa_vendor?.toLowerCase() === "t" && (
                        <li className="flex items-center p-2 mt-2 hover:bg-[#000000]">
                          <NavLink to="/color-size-sales-vendor" onClick={handleNavLinkClick} className="w-full">
                            Vendor
                          </NavLink>
                        </li>
                      )}
                    </ul>
                  )}
                </ul>
              )}
            </>
          )}

          {/* Transaction */}
          {((t_scan?.toLowerCase() === "t") ||
            (t_stock_update?.toLowerCase() === "t") ||
            (t_invoice?.toLowerCase() === "t")) && (
            <li
              className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
              onClick={toggleReport}
              aria-haspopup="true"
              aria-expanded={transactionOpen}
            >
              <MdCalculate size={20} className="mt-3 mb-4 ml-2 mr-2" />
              <span className={`${isOpen ? "block" : "hidden"} ml-4`}>
                Transaction
              </span>
              {isOpen && (
                <FaChevronDown
                  size={14}
                  className={`ml-auto transition-transform mr-5 ${
                    transactionOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          )}

          {transactionOpen && isOpen && (
            <ul className="pl-8 ml-8">
              {t_scan?.toLowerCase() === "t" && (
                <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                  <NavLink to="/scan" onClick={handleNavLinkClick} className="w-full">
                    Quick Scan
                  </NavLink>
                </li>
              )}

              {t_stock_update?.toLowerCase() === "t" && (
                <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                  <NavLink to="/stock-update" onClick={handleNavLinkClick} className="w-full">
                    Scan Data
                  </NavLink>
                </li>
              )}

              {t_invoice?.toLowerCase() === "t" && (
                <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                  <NavLink to="/invoice" onClick={handleNavLinkClick} className="w-full">
                    Invoice
                  </NavLink>
                </li>
              )}
            </ul>
          )}

          {/* Administration */}
          {((a_permission && a_permission.toLowerCase() === "t") ||
            (a_sync && a_sync.toLowerCase() === "t")) && (
            <li
              className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
              onClick={toggleAdmin}
              aria-haspopup="true"
              aria-expanded={adminOpen}
            >
              <MdManageAccounts size={20} className="mt-3 mb-4 ml-2 mr-2" />
              <span className={`${isOpen ? "block" : "hidden"} ml-4`}>
                Administration
              </span>
              {isOpen && (
                <FaChevronDown
                  size={14}
                  className={`ml-auto transition-transform mr-5 ${
                    adminOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          )}

          <ul className="pl-8 ml-8">
            {a_permission?.toLowerCase() === "t" && adminOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/reset" onClick={handleNavLinkClick} className="w-full">
                  Reset Connection
                </NavLink>
              </li>
            )}

            {a_sync?.toLowerCase() === "t" && adminOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/sync-databases" onClick={handleNavLinkClick} className="w-full">
                  Sync Databases
                </NavLink>
              </li>
            )}
          </ul>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;