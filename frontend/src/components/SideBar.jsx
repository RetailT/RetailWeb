import React, { useState } from "react";
import { FaBars, FaTimes, FaChevronDown } from "react-icons/fa";
import { MdManageAccounts, MdSpaceDashboard } from "react-icons/md";
import { MdCalculate } from "react-icons/md";
import { BiSolidReport } from "react-icons/bi";
import { NavLink } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const Sidebar = ({ onToggle, isOpen, toggleSidebar }) => {
  // const [isOpen, setIsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false); // Admin dropdown toggle
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);

  // Get the token from localStorage
  const token = localStorage.getItem("authToken");
  let a_permission = "";
  let a_sync = "";
  let d_company = "";
  let d_department = "";
  let d_category = "";
  let d_scategory = "";
  let d_vendor = "";
  let d_invoice = "";
  let d_productView = "";
  let t_scan = "";
  let t_stock_update = "";

  if (token) {
    const decodedToken = jwtDecode(token);
    a_permission = decodedToken.a_permission;
    a_sync = decodedToken.a_sync;
    d_company = decodedToken.d_company;
    d_department = decodedToken.d_department;
    d_category = decodedToken.d_category;
    d_scategory = decodedToken.d_scategory;
    d_vendor = decodedToken.d_vendor;
    d_invoice = decodedToken.d_invoice;
    d_productView = decodedToken.d_productView;
    d_productView = decodedToken.d_productView;
    t_scan = decodedToken.t_scan;
    t_stock_update = decodedToken.t_stock_update;

  } else {
    console.error("No token found in localStorage");
  }

  const toggleAdmin = () => {
    // setIsOpen(true); // Expand sidebar when Admin is clicked
    setAdminOpen(!adminOpen); // Toggle Admin dropdown
  };

  const toggleDashboard = () => {
    // setIsOpen(true); // Expand sidebar when HR is clicked
    setDashboardOpen(!dashboardOpen); // Toggle dashboard dropdown
  };

  const toggleReport = () => {
    // setIsOpen(true); // Expand sidebar when HR is clicked
    setTransactionOpen(!transactionOpen); // Toggle dashboard dropdown
  };

  return (
    <div
      className={`fixed top-10 left-0 h-full bg-gradient-to-t from-[#ce521a] to-[#000000] text-white shadow-md transition-all duration-300 ${
        isOpen ? "w-80" : "w-0 overflow-hidden"
      }`}
      style={{ zIndex: 40 }}
    >
      <div className="flex flex-col w-full h-full">
        <ul className="mt-14 flex-1 overflow-y-auto">
          {/* dashboard */}
          {((d_company && d_company.toLowerCase() === "t") ||
            (d_department && d_department.toLowerCase() === "t") ||
            (d_category && d_category.toLowerCase() === "t") ||
            (d_scategory && d_scategory.toLowerCase() === "t") ||
            (d_vendor && d_vendor.toLowerCase() === "t") ||
            (d_invoice && d_invoice.toLowerCase() === "t")||
            (d_productView && d_productView.toLowerCase() === "t")) && (
            <li
              className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
              onClick={toggleDashboard}
              aria-haspopup="true"
              aria-expanded={dashboardOpen}
            >
              <MdSpaceDashboard size={20} className="mr-2 ml-2 mb-4 mt-3" />
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

          {/* submenu of dashboard */}
          <ul className="ml-8 pl-8">
            {d_company?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/company-dashboard" className="w-full">
                  Summary
                </NavLink>
              </li>
            )}

            {d_department?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/department-dashboard" className="w-full">
                  Departments
                </NavLink>
              </li>
            )}

            {d_category?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/category-dashboard" className="w-full">
                  Category
                </NavLink>
              </li>
            )}

            {d_scategory?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/sub-category-dashboard" className="w-full">
                  Sub Category
                </NavLink>
              </li>
            )}

            {d_vendor?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/vendor-dashboard" className="w-full">
                  Vendor
                </NavLink>
              </li>
            )}

            {d_invoice?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/report" className="w-full">
                  Invoice Wise Report
                </NavLink>
              </li>
            )}
            {d_productView?.toLowerCase() === "t" && dashboardOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/product-view" className="w-full">
                  Product View
                </NavLink>
              </li>
            )}
          </ul>

          {/* stock */}
          {((t_scan && t_scan.toLowerCase() === "t") ||
            (t_stock_update && t_stock_update.toLowerCase() === "t")) && (
            <li
              className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
              onClick={toggleReport}
              aria-haspopup="true"
              aria-expanded={transactionOpen}
            >
              <MdCalculate size={20} className="mr-2 ml-2 mb-4 mt-3" />
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

          {/* submenu of stock */}

          <ul className="ml-8 pl-8">
            {t_scan?.toLowerCase() === "t" && transactionOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/scan" className="w-full">
                  Quick Scan
                </NavLink>
              </li>
            )}

            {t_stock_update?.toLowerCase() === "t" && transactionOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/stock-update" className="w-full">
                  Stock Data
                </NavLink>
              </li>
            )}
          </ul>

          {/* admin */}
          {((a_permission && a_permission.toLowerCase() === "t") ||
            (a_sync && a_sync.toLowerCase() === "t")) && (
            <li
              className="flex items-center p-2 hover:bg-[#000000] cursor-pointer"
              onClick={toggleAdmin}
              aria-haspopup="true"
              aria-expanded={adminOpen}
            >
              <MdManageAccounts size={20} className="mr-2 ml-2 mb-4 mt-3" />
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

          {/* submenu of admin */}

          <ul className="ml-8 pl-8">
            {a_permission?.toLowerCase() === "t" && adminOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/reset" className="w-full">
                  Reset Connection
                </NavLink>
              </li>
            )}

            {a_sync?.toLowerCase() === "t" && adminOpen && isOpen && (
              <li className="flex items-center p-2 mt-4 hover:bg-[#000000]">
                <NavLink to="/sync-databases" className="w-full">
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
