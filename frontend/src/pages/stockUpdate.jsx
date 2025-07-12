import { useState, useEffect, useContext } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../components/NavBar";
import { AuthContext } from "../AuthContext";
import Heading from "../components/Heading";
import Table from "../components/EditableTable";
import Alert from "../components/Alert";
import axios, { all } from "axios";
import { jwtDecode } from "jwt-decode";

function App() {
  const { authToken } = useContext(AuthContext);
  const [data, setData] = useState([]);

  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [disable, setDisable] = useState(false);
  const [headers, setHeaders] = useState([]);
  const [repUserFilter, setRepUserFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  
  const [invoice, setInvoice] = useState([]);
  const [uniqueRepUsers, setUniqueRepUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [selectedCompanyName, setSelectedCompanyName] = useState(null);
  const [initialData, setInitialData] = useState(false);
  const [typeError, setTypeError] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [remarks, setRemarks] = useState("");
  const token = localStorage.getItem("authToken");
  const editableColumns = [{ index: 17, type: "number", step: "any" }];
  const decodedToken = jwtDecode(token);
  const username = decodedToken.username;
  const type =
    selectedType === "STOCK"
      ? "Stock"
      : selectedType === "GRN"
      ? "GRN"
      : selectedType === "PRN"
      ? "PRN"
      : selectedType === "TOG"
      ? "TOG"
      : "Scan Data";
  const grn = decodedToken.t_grn;
  const prn = decodedToken.t_prn;
  const tog = decodedToken.t_tog;
  const stock_scan = decodedToken.t_stock;

  let typeOptions = [];

  if (grn === "T") {
    typeOptions.push("GRN");
  }
  if (prn === "T") {
    typeOptions.push("PRN");
  }
  if (tog === "T") {
    typeOptions.push("TOG");
  }
  if (stock_scan === "T") {
    typeOptions.push("STOCK");
  }

  useEffect(() => {
    if (headers.length > 0 && data.length > 0) {
      const repUserIndex = headers.indexOf("REPUSER");
      if (repUserIndex !== -1) {
        const repUsers = [
          ...new Set(
            data
              .map((item) => item.rowData[repUserIndex]?.trim())
              .filter(Boolean)
          ),
        ];
        setUniqueRepUsers(repUsers);
      }
    }
  }, [headers, data]);

  useEffect(() => {
    if (!token) {
      console.error("No token found in localStorage");
      setError("No token found");
      return;
    } else {
      fetchCompanies();
    }
  }, []);

  const handleTypeChange = (event) => {
    setSelectedType(event.target.value);
  };

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const handleTableDataSubmit = async () => {
    try {
      setDisable(true);

      if (
        selectedType !== "STOCK" &&
        selectedType !== "TOG" &&
        (!invoiceFilter || invoiceFilter.trim() === "")
      ) {
         setAlert({
          message: "Please select an invoice number",
          type: "error",
        });

        setTimeout(() => {
          setAlert(null);
        }, 3000);
        setDisable(false);
        
        return;
      } 

      let response;

      if (selectedType === "STOCK") {
        response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}final-stock-update`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              username: username,
              company: selectedCompany,
            },
          }
        );
      } else {
        response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}final-grnprn-update`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              username: username,
              company: selectedCompany,
              type: selectedType,
              invoice: invoiceFilter,
              remarks: remarks,
            },
          }
        );
      }

      if (response.data.message === "Data moved successfully") {
      //  setDisable(true);
      setAlert({
          message: "Uploaded Successfully",
          type: "success",
        });
        // Dismiss alert after 3 seconds
        setTimeout(() => setAlert(null), 3000);
        
       setInvoiceFilter("");
        requestData();

      } else {
        // setInitialData(false);
        // setDisable(false);
        setAlert({
          message: response.data.message || "Cannot move data",
          type: "error",
        });
        // Dismiss alert after 3 seconds
        setTimeout(() => setAlert(null), 3000);
        
      }
      setDisable(false);
    } catch (err) {
      
      // Handle any errors that occur
      setAlert({
        message: err.response?.data?.message || "Data deletion failed",
        type: "error",
      });

      // Dismiss alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
    }
    setDisable(false);
  };

  const requestData = async () => {
    try {
      setDisable(true);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}stock-update`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            code: selectedCompany,
            selectedType: selectedType,
          },
        }
      );

      const stockData = response.data.stockData;

      if (stockData.length > 0) {
        // Extract keys from the first object, excluding "IDX"
        const keys = Object.keys(stockData[0]).filter(
          (key) => key !== "IDX" && key !== "TYPE"
        );

        // Custom heading mapping
        const customHeadingMap = {
          COMPANY_CODE: "Company Code",
          COUNT_STATUS: "Count Status",
          PRODUCT_CODE: "Product Code",
          VENDOR_CODE: "Vendor Code",
          VENDOR_NAME: "Vendor Name",
          INVOICE_NO: "Invoice Number",
          PRODUCT_NAMELONG: "Product Name",
          COSTPRICE: "Cost Price",
          UNITPRICE: "Unit Price",
          CUR_STOCK: "Current Stock",
          PHY_STOCK: "Physical Stock",
          COMPANY_TO_CODE: "Company To Code",
          SERIALNO: "Serial No",
          COLORCODE: "Color Code",
          SIZECODE: "Size Code",
        };

        const customHeaders = keys.map((key) => customHeadingMap[key] || key);

        setHeaders(customHeaders);

        // Map the data, include "IDX" as hidden in each row
        const orderedData1 = stockData.map((row) => ({
          idx: row.IDX, // Store IDX for later reference
          rowData: keys.map((key) => row[key]), // Data excluding IDX
        }));

        setData(orderedData1);
        setInitialData(true);

        const invoiceIndex = customHeaders.indexOf("Invoice Number");
        if (invoiceIndex !== -1) {
          const invoiceList = [
            ...new Set(
              orderedData1
                .map((item) => item.rowData[invoiceIndex]?.trim())
                .filter(Boolean)
            ),
          ];
          setInvoice(invoiceList);
        }
      }

      if (stockData.length === 0) {
        
        setAlert({
          message: "No data available",
          type: "error",
        });

        // Dismiss alert after 3 seconds
        setTimeout(() => {
          setAlert(null);
        }, 3000);
      }

      setDisable(false);
    } catch (err) {
      
      setAlert({
        message: err.response?.data?.message || "Stock data finding failed",
        type: "error",
      });

      // Dismiss alert after 3 seconds
      setTimeout(() => {
        setAlert(null);
        window.location.reload(); // Full page reload
      }, 3000);
      setDisable(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}companies`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.userData && response.data.userData.length > 0) {
        // Map through all userData and get all options
        const companies = response.data.userData.map((data) => ({
          code: data.COMPANY_CODE.trim(),
          name: data.COMPANY_NAME.trim(),
        }));
        setCompanies(companies);
      }
    } catch (err) {
      setError("Failed to fetch dashboard data");

      console.error("Error fetching dashboard data:", err);
    }
  };

  const filteredTableData = data.filter((item) => {
    const repUser = item.rowData[headers.indexOf("REPUSER")]?.trim();
    return repUserFilter === "" || repUser === repUserFilter;
  });

  const handleDeleteRow = async (rowIndex) => {
    setDisable(true);
    const deletedRow = data[rowIndex];
    const idxValue = deletedRow.idx; // Access the IDX value of the row being deleted

    try {
      let response;
      if (selectedType === "STOCK") {
        response = await axios.delete(
          `${process.env.REACT_APP_BACKEND_URL}stock-update-delete`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              idx: idxValue,
              username: username,
              selectedType: selectedType,
            },
          }
        );
      } else {
        response = await axios.delete(
          `${process.env.REACT_APP_BACKEND_URL}grnprn-delete`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              idx: idxValue,
              username: username,
              selectedType: selectedType,
            },
          }
        );
      }

      if (response.data.message === "Data deleted successfully") {
        
        setAlert({
          message: response.data.message || "Item deleted successfully",
          type: "success",
        });
        setTimeout(() => {
          setAlert(null);
          requestData(); // Now it runs after the alert is dismissed
        }, 3000);
      }
      setDisable(false);
      // requestData();
    } catch (err) {
      // Handle any errors that occur
      setAlert({
        message: err.response?.data?.message || "Stock data deletion failed",
        type: "error",
      });

      // Dismiss alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
      setDisable(false);
    }
  };

  const handleCompanyChange = (event) => {
    const selectedCode = event.target.value;
    const selectedCompanyObj = companies.find(
      (company) => company.code === selectedCode
    );

    // Store the company code in setSelectedCompany
    setSelectedCompany(selectedCode);

    // Store the company name in setSelectedCompanyName
    if (selectedCompanyObj) {
      setSelectedCompanyName(selectedCompanyObj.name);
    }
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();

    let valid = true;
    if (!selectedCompany) {
      setCompanyError("Company is required.");
      valid = false;
    }
    if (selectedCompany) {
      setCompanyError("");
    }
    if (!selectedType) {
      setTypeError("Type is required.");
      valid = false;
    }
    if (selectedType) {
      setTypeError("");
    }
    if (selectedCompany && selectedType) {
      setCompanyError("");
      setTypeError("");
      valid = true;
      requestData();
    }
  };

  return (
  <div>
  <Navbar />
  <div className="flex flex-col min-h-screen">
    <div
      className={`transition-all duration-300 flex-1 p-2 sm:p-4 md:p-6 ${
        initialData ? "lg:ml-6 lg:mr-6" : "lg:ml-8 lg:mr-8"
      } ml-2 sm:ml-4 mr-2 sm:mr-4 mt-28 sm:mt-24 md:mt-28 max-w-full`}
    >
      <div className="w-full max-w-full ml-0 md:ml-2 mb-4 md:mb-0">
        <Heading text={`${type} Upload`} />
      </div>

      {alert && (
        <div className="mt-2 sm:mt-4 md:mt-5">
          <Alert
            message={alert.message}
            type={alert.type}
            onClose={() => setAlert(null)}
          />
        </div>
      )}

      {/* Company Selector Section */}
      {!initialData && (
        <div className="bg-[#d8d8d8] p-2 sm:p-4 rounded-md ml-0 md:ml-4 shadow-md mb-2 sm:mb-4 mt-10 w-full max-w-full">
          <div className="flex flex-col lg:flex-row lg:items-end justify-center gap-2 sm:gap-4 mb-2 sm:mb-4">
            {/* Company Dropdown */}
            <div className="flex flex-col gap-1 w-full lg:w-1/3 mb-2 sm:mb-0">
              <label className="text-sm font-medium text-gray-700">
                Select a Company
              </label>
              <select
                value={selectedCompany}
                onChange={handleCompanyChange}
                className="border border-gray-300 p-1 sm:p-2 rounded-md shadow-sm bg-white w-full text-sm"
              >
                <option value="" disabled>
                  Select a Company
                </option>
                {companies.map((company) => (
                  <option key={company.code} value={company.code}>
                    {company.code} {company.name}
                  </option>
                ))}
              </select>
              {companyError && (
                <p className="text-red-500 text-sm mt-1 mb-2">{companyError}</p>
              )}
            </div>

            {/* Type Dropdown */}
            <div className="flex flex-col gap-1 w-full lg:w-1/3 mb-2 sm:mb-0">
              <label className="text-sm font-medium text-gray-700">
                Select a Type
              </label>
              <select
                value={selectedType}
                onChange={handleTypeChange}
                className="border border-gray-300 p-1 sm:p-2 rounded-md shadow-sm bg-white w-full text-sm"
              >
                <option value="" disabled>
                  Select a Type
                </option>
                {typeOptions.map((name, index) => (
                  <option key={index} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {typeError && (
                <p className="text-red-500 text-sm mt-1 mb-2">{typeError}</p>
              )}
            </div>

            {/* Submit Button aligned with bottom of selects */}
            <div className="w-full lg:w-auto flex justify-center lg:justify-end">
              <button
                onClick={handleCompanySubmit}
                disabled={disable}
                className={`bg-black hover:bg-gray-800 text-white font-semibold py-1 sm:py-2 px-2 sm:px-4 rounded-md shadow-md transition-all w-full lg:w-auto text-sm ${
                  disable ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      {initialData && (
        <div>
          <div className="bg-[#d8d8d8] p-2 sm:p-4 rounded-md shadow-md mb-2 sm:mb-4 mt-2 sm:mt-4 md:mt-10 w-full max-w-full lg:max-w-[95%] mx-auto">
            <div className="w-full flex justify-center">
              <div className="w-full max-w-full">
                {/* Remarks Row (Always on Top Full Width) */}
                {(selectedType === "GRN" ||
                  selectedType === "PRN" ||
                  selectedType === "TOG") && (
                  <div className="flex flex-col mt-1 sm:mt-2 w-full">
                    <label className="text-sm font-medium text-gray-700 mb-1">
                      Remarks
                    </label>
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="border border-gray-300 p-1 sm:p-2 rounded-md shadow-sm bg-white w-full text-sm"
                      placeholder="Enter Remarks"
                    />
                  </div>
                )}

                {/* Second Row: User, Invoice, Submit (Stacked on small, horizontal on large) */}
                <div
                  className={`flex flex-col lg:flex-row lg:items-end gap-2 sm:gap-4 mt-2 sm:mt-4 ${
                    selectedType === "STOCK" || selectedType === "TOG"
                      ? "lg:justify-center"
                      : ""
                  }`}
                >
                  {/* Rep User Dropdown */}
                  <div
                    className={`flex flex-col w-full lg:w-1/3 ${
                      selectedType === "STOCK" || selectedType === "TOG"
                        ? "lg:mb-2 lg:max-w-xs"
                        : ""
                    }`}
                  >
                    <label className="text-sm font-medium text-gray-700 mb-1">
                      User
                    </label>
                    <select
                      value={repUserFilter}
                      onChange={(e) => setRepUserFilter(e.target.value)}
                      className="border border-gray-300 p-1 sm:p-2 rounded-md shadow-sm bg-white w-full text-sm"
                    >
                      <option value="">User</option>
                      {uniqueRepUsers.map((user) => (
                        <option key={user} value={user}>
                          {user}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Invoice Dropdown */}
                  {(selectedType === "GRN" || selectedType === "PRN") && (
                    <div className="flex flex-col w-full lg:w-1/3">
                      <label className="text-sm font-medium text-gray-700 mb-1">
                        Invoice No
                      </label>
                      <select
                        value={invoiceFilter}
                        onChange={(e) => setInvoiceFilter(e.target.value)}
                        className="border border-gray-300 p-1 sm:p-2 rounded-md shadow-sm bg-white w-full text-sm"
                      >
                        <option value="">Invoice No</option>
                        {invoice.map((user) => (
                          <option key={user} value={user}>
                            {user}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div
                    className={`flex w-full lg:w-1/3 ${
                      selectedType === "STOCK" || selectedType === "TOG"
                        ? "lg:mb-2 lg:max-w-xs"
                        : ""
                    }`}
                  >
                    <button
                      onClick={handleTableDataSubmit}
                      disabled={disable}
                      className={`mt-2 sm:mt-4 bg-black hover:bg-gray-800 text-white font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded-md shadow-md w-full text-sm ${
                        disable ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex flex-col w-full max-w-full">
            <div className="text-xl sm:text-2xl font-bold mt-2 sm:mt-4 mb-2 sm:mb-4 text-center w-full">
              {selectedType}
            </div>
            <div className="overflow-x-auto w-full max-w-full lg:max-w-[90%] mx-auto">
              <div className="w-full max-w-full">
                <Table
                  headers={headers}
                  data={filteredTableData.map((item) => item.rowData)}
                  editableColumns={editableColumns}
                  onDeleteRow={handleDeleteRow}
                  formatColumns={
                    selectedType === "GRN" || selectedType === "PRN"
                      ? [6, 7]
                      : [4, 5]
                  }
                  formatColumnsQuantity={
                    selectedType === "GRN" || selectedType === "PRN"
                      ? [8, 9]
                      : [6, 7]
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
</div>
  );
}

export default App;
