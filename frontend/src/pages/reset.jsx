import { useCallback, useEffect, useState, useContext } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import Alert from "../components/Alert";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import Table from "../components/EditableTable";

const Reset = () => {
  const { authToken } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("");
  const [customerID, setCustomerID] = useState("");
  const [newCustomerID, setNewCustomerID] = useState("");
  const [nameError, setNameError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [disable, setDisable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [newTableData, setNewTableData] = useState([]);
  const [newTableHeaders, setNewTableHeaders] = useState([]);
  const [permissionSetting, setPermissionSetting] = useState(false);
  const [databaseSync, setDatabaseSync] = useState(false);
  const [company, setCompany] = useState(false);
  const [category, setCategory] = useState(false);
  const [department, setDepartment] = useState(false);
  const [subCategory, setSubCategory] = useState(false);
  const [vendor, setVendor] = useState(false);
  const [hourlyReport, setHourlyReport] = useState(false);
  const [salesComparison, setSalesComparison] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState(false);
  const [transInvoice, setTransInvoice] = useState(false);
  const [productView, setProductView] = useState(false);
  const [scan, setScan] = useState(false);
  const [stock, setStock] = useState(false);
  const [stockUpdate, setStockUpdate] = useState(false);
  const [grn, setGRN] = useState(false);
  const [prn, setPRN] = useState(false);
  const [tog, setTOG] = useState(false);
  const [cStProductWise, setCStProductWise] = useState(false);
  const [cStDepartment, setCStDepartment] = useState(false);
  const [cStCategory, setCStCategory] = useState(false);
  const [cStSCategory, setCStSCategory] = useState(false);
  const [cStVendor, setCStVendor] = useState(false);
  const [cSaProductWise, setCSaProductWise] = useState(false);
  const [cSaDepartment, setCSaDepartment] = useState(false);
  const [cSaCategory, setCSaCategory] = useState(false);
  const [cSaSCategory, setCSaSCategory] = useState(false);
  const [cSaVendor, setCSaVendor] = useState(false);
  const [sProduct, setSProduct] = useState(false);
  const [sDepartment, setSDepartment] = useState(false);
  const [sCategory, setSCategory] = useState(false);
  const [sSCategory, setSSCategory] = useState(false);
  const [sVendor, setSVendor] = useState(false);

  const token = localStorage.getItem("authToken");
  const navigate = useNavigate();
  let username;

const fetchConnectionData = useCallback(() => {
  setNewTableData([]);
  setNewTableHeaders([]);
  setDisable(true);

  const token = localStorage.getItem("authToken");

  axios
    .get(`${process.env.REACT_APP_BACKEND_URL}connection-details`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((response) => {
      if (response.data.message === "Details fetched successfully") {
        const tableData = response.data.records;
        const customDepartmentHeaders = [
          "CUSTOMERID",
          "COMPANY_NAME",
          "SERVERIP",
          "PORT",
          "START_DATE",
          "END_DATE",
        ];

        const customDepartmentHeaderMapping = {
          CUSTOMERID: "Customer ID",
          COMPANY_NAME: "Company Name",
          SERVERIP: "Server IP",
          PORT: "Port",
          START_DATE: "Start Date",
          END_DATE: "End Date",
        };

        setNewTableHeaders(
          customDepartmentHeaders.map(
            (key) => customDepartmentHeaderMapping[key] || key
          )
        );

        setNewTableData(
          tableData.map((item) =>
            customDepartmentHeaders.map((key) => item[key])
          )
        );
      } else {
        setAlert({
          message: response.data.message || "Error Occurred",
          type: "error",
        });
        setTimeout(() => setAlert(null), 3000);
      }
    })
    .catch((err) => {
      console.error("Error sending parameters:", err);
      setAlert({
        message: err.response?.data?.message || "Error Occurred",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    })
    .finally(() => {
      setDisable(false);
    });
}, [setNewTableData, setNewTableHeaders, setDisable, setAlert]); // Include state setters in dependency array

useEffect(() => {
  fetchConnectionData();
}, []);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  if (token) {
    const decodedToken = jwtDecode(token);
    username = decodedToken.username;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setNameError("");
    let isValid = true;
    setDisable(true);

    if (!name) {
      setNameError("Username is required.");
      isValid = false;
      setDisable(false);
    }
    if (!name) {
      setNameError("Username is required.");
      isValid = false;
      setDisable(false);
    }

    if(!ip || !port || !companyName || !startDate || !endDate ) {
      setAlert({ message: "All fields are required.", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      isValid = false;
      setDisable(false);
    }

    if (isValid) {
      const data = {
        name,
        ip,
        port,
        username,
        companyName,
        startDate,
        endDate,
        customerID,
        newCustomerID,
        admin: [{ a_permission: permissionSetting, a_sync: databaseSync }],
        dashboard: [
          {
            d_company: company,
            d_category: category,
            d_department: department,
            d_scategory: subCategory,
            d_vendor: vendor,
            d_hourly_report: hourlyReport,
            d_sales_comparison: salesComparison,
            d_invoice: invoice,
            d_productView: productView,
          },
        ],
        stock_wise: [
          {
            s_product: sProduct,
            s_department: sDepartment,
            s_category: sCategory,
            s_scategory: sSCategory,
            s_vendor: sVendor,
          },
        ],
        stock: [
          {
            t_scan: scan,
            t_stock: stock,
            t_stock_update: stockUpdate,
            t_grn: grn,
            t_prn: prn,
            t_tog: tog,
            t_invoice: transInvoice,
            t_invoicePreview: invoicePreview,
          },
        ],
        colorSize_stock: [
          {
            c_st_product_wise: cStProductWise,
            c_st_department: cStDepartment,
            c_st_category: cStCategory,
            c_st_scategory: cStSCategory,
            c_st_vendor: cStVendor,
          },
        ],
        colorSize_sales: [
          {
            c_sa_product_wise: cSaProductWise,
            c_sa_department: cSaDepartment,
            c_sa_category: cSaCategory,
            c_sa_scategory: cSaSCategory,
            c_sa_vendor: cSaVendor,
          },
        ],
      };

      console.log("Submitting data:", data); // DEBUG: Check what's being sent
      console.log("Invoice Preview value:", invoicePreview); // DEBUG: Check state value

      const config1 = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        params: {
          debug: true,
        },
      };
      
      axios
        .put(
          `${process.env.REACT_APP_BACKEND_URL}reset-database-connection`,
          data,
          config1
        )
        .then((response) => {
          setDisable(false);
          if (
            response.data.message === "Database connection updated successfully"
          ) {
            setAlert({
              message: "Database connection successful!",
              type: "success",
            });

            setTimeout(() => {
              setAlert(null);
              navigate("/login");
            }, 1000);
          } else {
            setAlert({ message: response.data.message, type: "error" });
            setTimeout(() => setAlert(null), 3000);
          }
        })
        .catch((error) => {
          setDisable(false);
          const errorMessage =
            error.response?.data?.message ||
            "Connection failed. Please try again.";
          setAlert({ message: errorMessage, type: "error" });
          setTimeout(() => setAlert(null), 3000);
        });
        
    }
  };

  const handleButtonClick = (e) => {
    e.preventDefault();
    setNameError("");
    let isValid = true;
    setDisable(true);
    setLoading(true);

    if (!name) {
      setNameError("Username is required.");
      isValid = false;
      setDisable(false);
      setLoading(false);
    }

    if (isValid) {
      const config1 = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        params: {
          name, // pass the parameter here instead of in the body
          debug: true,
        },
      };
setNewCustomerID("");
      axios
        .get(
          `${process.env.REACT_APP_BACKEND_URL}find-user-connection`,
          config1
        )
        .then((response) => {
          setDisable(false);
          setLoading(false);
          if (
            response.data.message ===
            "User permission data retrieved successfully"
          ) {
            setAlert({
              message: "User permission data retrieved successfully!",
              type: "success",
            });

            setTimeout(() => {
              setAlert(null);
            }, 1000);

            const user = response.data.userData[0];

            setIp(user.ip_address);
            setPort(user.port);
            setCustomerID(user.CUSTOMERID);
            setPermissionSetting(user.a_permission === "T");
            setDatabaseSync(user.a_sync === "T");
            setCompany(user.d_company === "T");
            setCategory(user.d_category === "T");
            setDepartment(user.d_department === "T");
            setSubCategory(user.d_scategory === "T");
            setVendor(user.d_vendor === "T");
            setHourlyReport(user.d_hourly_report === "T");
            setSalesComparison(user.d_sales_comparison === "T");
            setInvoice(user.d_invoice === "T");
            setProductView(user.d_productView === "T");
            setScan(user.t_scan === "T");
            setTransInvoice(user.t_invoice === "T");
            setInvoicePreview(user.t_invoicePreview === "T");
            setStock(user.t_stock === "T");
            setStockUpdate(user.t_stock_update === "T");
            setGRN(user.t_grn === "T");
            setPRN(user.t_prn === "T");
            setTOG(user.t_tog === "T");
            setCStProductWise(user.c_st_product_wise === "T");
            setCStDepartment(user.c_st_department === "T");
            setCStCategory(user.c_st_category === "T");
            setCStSCategory(user.c_st_scategory === "T");
            setCStVendor(user.c_st_vendor === "T");
            setCSaProductWise(user.c_sa_product_wise === "T");
            setCSaDepartment(user.c_sa_department === "T");
            setCSaCategory(user.c_sa_category === "T");
            setCSaSCategory(user.c_sa_scategory === "T");
            setCSaVendor(user.c_sa_vendor === "T");
            setSProduct(user.s_product === "T");
            setSDepartment(user.s_department === "T");
            setSCategory(user.s_category === "T");
            setSSCategory(user.s_scategory === "T");
            setSVendor(user.s_vendor === "T");
            setCompanyName(user.COMPANY_NAME || "");
            setStartDate(user.START_DATE || "");
            setEndDate(user.END_DATE || "");           

            // setData(user);
            // userPermisionDetails(user);
          } else {
            setIp("");
            setPort("");
            setCustomerID("");
            setPermissionSetting(false);
            setDatabaseSync(false);
            setCompany(false);
            setCategory(false);
            setDepartment(false);
            setSubCategory(false);
            setVendor(false);
            setHourlyReport(false);
            setSalesComparison(false);
            setInvoice(false);
            setTransInvoice(false);
            setInvoicePreview(false);
            setProductView(false);
            setScan(false);
            setStock(false);
            setStockUpdate(false);
            setGRN(false);
            setPRN(false);
            setTOG(false);
            setCStProductWise(false);
            setCStDepartment(false);
            setCStCategory(false);
            setCStSCategory(false);
            setCStVendor(false);
            setCSaProductWise(false);
            setCSaDepartment(false);
            setCSaCategory(false);
            setCSaSCategory(false);
            setCSaVendor(false);
            setSProduct(false);
            setSDepartment(false);
            setSCategory(false);
            setSSCategory(false);
            setSVendor(false);
            setCompanyName("");
            setStartDate("");
            setEndDate("");
            setAlert({ message: response.data.message, type: "error" });
            setTimeout(() => setAlert(null), 3000);
          }
        })
        .catch((error) => {
          setIp("");
            setPort("");
            setCustomerID("");
            setPermissionSetting(false);
            setDatabaseSync(false);
            setCompany(false);
            setCategory(false);
            setDepartment(false);
            setSubCategory(false);
            setVendor(false);
            setHourlyReport(false);
            setSalesComparison(false);
            setInvoice(false);            
            setTransInvoice(false);
            setInvoicePreview(false);
            setProductView(false);
            setScan(false);
            setStock(false);
            setStockUpdate(false);
            setGRN(false);
            setPRN(false);
            setTOG(false);
            setCStProductWise(false);
            setCStDepartment(false);
            setCStCategory(false);
            setCStSCategory(false);
            setCStVendor(false);
            setCSaProductWise(false);
            setCSaDepartment(false);
            setCSaCategory(false);
            setCSaSCategory(false);
            setCSaVendor(false);
            setSProduct(false);
            setSDepartment(false);
            setSCategory(false);
            setSSCategory(false);
            setSVendor(false);
            setCompanyName("");
            setStartDate("");
            setEndDate("");
          setDisable(false);
          setLoading(false);
          const errorMessage =
            error.response?.data?.message ||
            "Connection failed. Please try again.";
          setAlert({ message: errorMessage, type: "error" });
          setTimeout(() => setAlert(null), 3000);
        });
    }
  };

const autoFill = (customerID) => {
  if (customerID !== "") {
    const record = newTableData.find(row => row[0] === Number(customerID));
    if (record) {
      setLoading(true);
      const [id, companyName, serverIP, port, startDate, endDate] = record;
      setCompanyName(companyName || "");
      setIp(serverIP || "");
      setPort(port || "");
      setStartDate(startDate || "");
      setEndDate(endDate || "");
      setLoading(false);
    } 
    else{
      setLoading(true);
      setCompanyName("");
      setIp("");
      setPort("");
      setStartDate("");
      setEndDate("");
      setLoading(false);

    }
  }
  else{
      setLoading(true);
      setCompanyName("");
      setIp("");
      setPort("");
      setStartDate("");
      setEndDate("");
      setLoading(false);

    }
};

  return (
    <div>
      <Navbar />
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-2 ml-2 mr-2 sm:p-4 md:p-6 sm:ml-4 md:ml-5 sm:mr-4">
          <div className="mt-24 mb-2 ml-2 sm:mt-20 md:mt-24 sm:mb-6 md:mb-10 sm:ml-4">
            <Heading text="Permission Setting" />
          </div>

          <div className="mt-2 ml-2 sm:ml-4 sm:mt-4">
            {alert && (
              <Alert
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert(null)}
              />
            )}
          </div>

          <div className="flex justify-center mt-2 ml-2 sm:mt-8 md:mt-10 sm:ml-4 md:ml-0">
            <div className="w-full px-2 max-w-7xl sm:px-4 md:px-8">
              <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
                <div className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-300 rounded-md shadow-md sm:p-6 md:p-6 lg:flex-row lg:justify-between sm:gap-4">
                  {/* Username Field */}
                  <div className="flex flex-col w-full lg:w-auto">
                    <label
                      htmlFor="name"
                      className="text-sm font-medium text-gray-700"
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-2 py-1 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md lg:w-64 sm:px-4 sm:py-2"
                      placeholder="Enter Username"
                    />
                    {nameError && (
                      <p className="mt-1 text-sm text-red-500">{nameError}</p>
                    )}
                  </div>

                  {/* Buttons Container */}
                  <div className="flex flex-col items-center justify-center w-full gap-2 mt-2 md:flex-row sm:gap-4 sm:mt-4">
                    {/* Find User Button */}
                    <button
                      onClick={handleButtonClick}
                      disabled={disable}
                      className={`px-2 sm:px-4 py-1 sm:py-2 w-full md:w-1/3 bg-black text-white font-semibold rounded-md shadow-md hover:bg-gray-800 text-sm ${
                        disable ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Find User
                    </button>

                    {/* Reset Button */}
                    <button
                      type="submit"
                      disabled={disable}
                      className={`px-2 sm:px-4 py-1 sm:py-2 w-full md:w-1/3 bg-black text-white font-semibold rounded-md hover:bg-gray-800 text-sm ${
                        disable ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 p-4 overflow-x-auto bg-white border border-gray-300 rounded-md shadow-md sm:p-6 md:p-6 lg:flex-row lg:justify-between sm:gap-4">
                  {/* Card 1 */}
                  <div className="bg-white p-2 sm:p-4 rounded-md shadow-md w-full md:w-[calc(50%-0.5rem)] min-w-[500px] mb-2 sm:mb-4">
                    <h2 className="mb-2 text-sm font-semibold text-gray-800 sm:text-lg sm:mb-4">
                      Connection
                    </h2>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 sm:gap-4">
                      {/* Company name */}
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Company Name
                        </label>
                        <input
                          type="text"
                          id="name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="block w-full px-2 py-1 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-4 sm:py-2"
                          placeholder="Enter Company Name"
                        />
                      </div>

                      {/* Customer ID */}
                      <div>
                        <label
                          htmlFor="customerID"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Customer ID
                        </label>
                        <input
                          type="number"
                          id="customerID"
                          value={newCustomerID? newCustomerID : customerID}
                          onChange={(e) => {
                            setNewCustomerID(e.target.value);   // update state
                            autoFill(e.target.value);    // call your function
                          }}

                          className="block w-full px-2 py-1 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-4 sm:py-2"
                          placeholder="Enter Customer ID"
                        />
                      </div>

                      {/* IP Address */}
                      <div>
                        <label
                          htmlFor="ip"
                          className="block text-sm font-medium text-gray-700"
                        >
                          IP Address
                        </label>
                        <input
                          type="text"
                          id="ip"
                          value={ip}
                          onChange={(e) => setIp(e.target.value)}
                          className="block w-full px-2 py-1 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-4 sm:py-2"
                          placeholder="Enter IP Address"
                        />
                      </div>

                      {/* Port */}
                      <div>
                        <label
                          htmlFor="port"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Port
                        </label>
                        <input
                          type="number"
                          id="port"
                          value={port}
                          onChange={(e) => setPort(e.target.value)}
                          className="block w-full px-2 py-1 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-4 sm:py-2"
                          placeholder="Enter Port"
                        />
                      </div>

                      {/* Start Date */}
                      <div>
                        <label
                          htmlFor="startDate"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Start Date
                        </label>
                        <input
                          type="date"
                          id="startDate"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="block w-full px-2 py-1 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-4 sm:py-2"
                          placeholder="Select Start Date"
                        />
                      </div>

                      {/* End Date */}
                      <div>
                        <label
                          htmlFor="endDate"
                          className="block text-sm font-medium text-gray-700"
                        >
                          End Date
                        </label>
                        <input
                          type="date"
                          id="endDate"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="block w-full px-2 py-1 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-4 sm:py-2"
                          placeholder="Select End Date"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-white p-2 sm:p-4 rounded-md shadow-md w-full md:w-[calc(25%-0.5rem)] min-w-[250px] mb-2 sm:mb-4">
                    <h2 className="mb-2 text-sm font-semibold text-gray-800 sm:text-lg sm:mb-4">
                      Dashboard
                    </h2>
                    <div className="flex flex-col gap-2 sm:gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={company}
                          onChange={(e) => setCompany(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Company</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={department}
                          onChange={(e) => setDepartment(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Department
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={category}
                          onChange={(e) => setCategory(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Category</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={subCategory}
                          onChange={(e) => setSubCategory(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Sub Category
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={vendor}
                          onChange={(e) => setVendor(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Vendor</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={hourlyReport}
                          onChange={(e) => setHourlyReport(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Hourly Report</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={salesComparison}
                          onChange={(e) => setSalesComparison(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Sales Comparison</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={invoice}
                          onChange={(e) => setInvoice(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Invoice</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={productView}
                          onChange={(e) => setProductView(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Product View
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-white p-2 sm:p-4 rounded-md shadow-md w-full md:w-[calc(25%-0.5rem)] min-w-[250px] mb-2 sm:mb-4">
                    <h2 className="mb-2 text-sm font-semibold text-gray-800 sm:text-lg sm:mb-4">
                      Transaction
                    </h2>
                    <div className="flex flex-col gap-2 sm:gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={scan}
                          onChange={(e) => setScan(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Scan</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={stock}
                          onChange={(e) => setStock(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Stock</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={grn}
                          onChange={(e) => setGRN(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">GRN</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={prn}
                          onChange={(e) => setPRN(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">PRN</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={tog}
                          onChange={(e) => setTOG(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">TOG</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={stockUpdate}
                          onChange={(e) => setStockUpdate(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Stock Update
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={transInvoice}
                          onChange={(e) => setTransInvoice(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Invoice
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={invoicePreview}
                          onChange={(e) => setInvoicePreview(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Invoice Preview
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Card 4 */}
                  <div className="bg-white p-2 sm:p-4 rounded-md shadow-md w-full md:w-[calc(25%-0.5rem)] min-w-[250px] mb-2 sm:mb-4">
                    <h2 className="mb-2 text-sm font-semibold text-gray-800 sm:text-lg sm:mb-4">
                      Stock Wise Report
                    </h2>
                    <div className="flex flex-col gap-2 sm:gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={sProduct}
                          onChange={(e) => setSProduct(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Product</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={sDepartment}
                          onChange={(e) => setSDepartment(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Department</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={sCategory}
                          onChange={(e) => setSCategory(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Category</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={sSCategory}
                          onChange={(e) => setSSCategory(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Sub Category</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={sVendor}
                          onChange={(e) => setSVendor(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Vendor</span>
                      </label>
                    </div>
                  </div>

                  {/* Card 5 */}
                  <div className="bg-white p-2 sm:p-4 rounded-md shadow-md w-full md:w-[calc(25%-0.5rem)] min-w-[250px] mb-2 sm:mb-4">
                    <h2 className="mb-2 text-sm font-semibold text-gray-800 sm:text-lg sm:mb-4">
                      Color Size Stock
                    </h2>
                    <div className="flex flex-col gap-2 sm:gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cStProductWise}
                          onChange={(e) => setCStProductWise(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Product Wise
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cStDepartment}
                          onChange={(e) => setCStDepartment(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Department
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cStCategory}
                          onChange={(e) => setCStCategory(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Category</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cStSCategory}
                          onChange={(e) => setCStSCategory(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Sub Category
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cStVendor}
                          onChange={(e) => setCStVendor(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Vendor</span>
                      </label>
                    </div>
                  </div>

                  {/* Card 6 */}
                  <div className="bg-white p-2 sm:p-4 rounded-md shadow-md w-full md:w-[calc(25%-0.5rem)] min-w-[250px] mb-2 sm:mb-4">
                    <h2 className="mb-2 text-sm font-semibold text-gray-800 sm:text-lg sm:mb-4">
                      Color Size Sales
                    </h2>
                    <div className="flex flex-col gap-2 sm:gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cSaProductWise}
                          onChange={(e) => setCSaProductWise(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Product Wise
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cSaDepartment}
                          onChange={(e) => setCSaDepartment(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Department
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cSaCategory}
                          onChange={(e) => setCSaCategory(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Category</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cSaSCategory}
                          onChange={(e) => setCSaSCategory(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Sub Category
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={cSaVendor}
                          onChange={(e) => setCSaVendor(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">Vendor</span>
                      </label>
                    </div>
                  </div>

                  {/* Card 7 */}
                  <div className="bg-white p-2 sm:p-4 rounded-md shadow-md w-full md:w-[calc(25%-0.5rem)] min-w-[250px] mb-2 sm:mb-4">
                    <h2 className="mb-2 text-sm font-semibold text-gray-800 sm:text-lg sm:mb-4">
                      Administration
                    </h2>
                    <div className="flex flex-col gap-2 sm:gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={permissionSetting}
                          onChange={(e) =>
                            setPermissionSetting(e.target.checked)
                          }
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Permission Setting
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={databaseSync}
                          onChange={(e) => setDatabaseSync(e.target.checked)}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        />
                        <span className="text-sm text-gray-700">
                          Database Sync
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* <div className="w-full px-2 mx-auto mt-10 md:w-2/3 sm:px-4 md:px-8">
  <div className="overflow-x-auto"> */}
  <div className="mt-2 sm:mt-8 md:mt-10">
  <div className="w-full px-4 mx-auto max-w-7xl sm:px-6 md:px-8">
    <div className="mb-5 overflow-hidden bg-white border border-gray-300 rounded-lg shadow-md">
      <Table
        headers={newTableHeaders}
        data={newTableData} 
        formatColumns={[]}
        editableColumns={[]}
        bin={true}
        className="min-w-full"
      />
    </div>
  </div>
</div>
  {/* </div>
</div> */}
        </div>
      </div>
    </div>
  );
};

export default Reset;
