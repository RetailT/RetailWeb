import { useState, useEffect, useContext } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../components/NavBar";
import { AuthContext } from "../AuthContext";
import Heading from "../components/Heading";
import Table from "../components/EditableTable";
import Alert from "../components/Alert";
import { FadeLoader } from "react-spinners";
import axios, { all } from "axios";
import { jwtDecode } from "jwt-decode";

function App() {
  const { authToken } = useContext(AuthContext);
  const [data, setData] = useState([]);

  // const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState([]);
  const [repUserFilter, setRepUserFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [invoice, setInvoice] = useState([]);
  const [uniqueRepUsers, setUniqueRepUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [selectedCompanyName, setSelectedCompanyName] = useState(null);
  const [initialData, setInitialData] = useState(false);
  const [disable, setDisable] = useState(false);
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

  if (loading) {
    return (
      <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-100 z-50">
        <FadeLoader
          cssOverride={null}
          height={50}
          loading
          margin={30}
          radius={30}
          speedMultiplier={1}
          width={8}
          color="#ce521a"
        />
      </div>
    );
  }

  const handleTypeChange = (event) => {
    setSelectedType(event.target.value);
  };

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const handleTableDataSubmit = async () => {
    try {
      setDisable(true);

      if (selectedType !== "STOCK" && selectedType !== "TOG" && !invoiceFilter) {
        setInvoiceError("Please select an invoice no");
        setDisable(false);
        return;
      } else {
        setInvoiceError("");
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
        setDisable(false);
        setAlert({
          message: response.data.message || "Data moved successfully",
          type: "success",
        });

        setTimeout(() => {
          setAlert(null);

          // Add a delay before reload
          setTimeout(() => {
            requestData();
          }, 100);
        }, 3000);
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
      setDisable(false);
      // Handle any errors that occur
      setAlert({
        message: err.response?.data?.message || "Data deletion failed",
        type: "error",
      });

      // Dismiss alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const requestData = async () => {
    try {
      setLoading(true);
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
        setLoading(false);
        setAlert({
          message: "No data available",
          type: "error",
        });

        // Dismiss alert after 3 seconds
        setTimeout(() => {
          setAlert(null);
        }, 3000);
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
      setAlert({
        message: err.response?.data?.message || "Stock data finding failed",
        type: "error",
      });

      // Dismiss alert after 3 seconds
      setTimeout(() => {
        setAlert(null);
        window.location.reload(); // Full page reload
      }, 3000);
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
      }
      else{
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
      // requestData();
    } catch (err) {
      // Handle any errors that occur
      setAlert({
        message: err.response?.data?.message || "Stock data deletion failed",
        type: "error",
      });

      // Dismiss alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
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
      {/* Main Layout */}
      <div className="flex">
        {/* Page Content */}
        <div className="flex-1 p-10 ml-16 mt-24">
          <div className="ml-[-50px] ">
            <Heading text={`${type} Upload`} />
          </div>
          <div className="mt-2 ">
            <div className=" mt-2 ml-[-60px] sm:ml-[-50px]">
              {alert && (
                <Alert
                  message={alert.message}
                  type={alert.type}
                  onClose={() => setAlert(null)}
                />
              )}
            </div>

            {!initialData && (
              <div
                className="bg-white p-5 rounded-md shadow-md mb-10 mt-10 ml-[-60px] sm:ml-[-50px]"
                style={{ backgroundColor: "#d8d8d8" }}
              >
                {/* Flex container for responsive layout */}
                <div className="flex flex-col sm:flex-col lg:flex-row justify-center gap-4">
                  {/* Company Dropdown */}
                  <div className="relative flex flex-col gap-2 w-full lg:w-60">
                    <label className="block text-sm font-medium text-gray-700">
                      Select a Company
                    </label>
                    <select
                      value={selectedCompany}
                      onChange={handleCompanyChange}
                      className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-left overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ minHeight: "40px" }}
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
                      <p className="text-red-500 text-sm mt-1 mb-4">
                        {companyError}
                      </p>
                    )}
                  </div>

                  <div className="relative flex flex-col gap-2 w-full lg:w-60">
                    <label className="block text-sm font-medium text-gray-700">
                      Select a Type
                    </label>
                    <select
                      value={selectedType}
                      onChange={handleTypeChange}
                      className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-left overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ minHeight: "40px" }}
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
                      <p className="text-red-500 text-sm mt-1 mb-4">
                        {typeError}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-center lg:justify-end h-10 mt-7">
                    <button
                      onClick={handleCompanySubmit}
                      className="bg-black hover:bg-gray-800 text-white font-semibold py-2 px-5 rounded-md shadow-md transition-all"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {initialData && (
              <div className="ml-[-38px] ">
                {/* stock data */}
                <div>
                  <div>
                    <div className="flex flex-col md:flex-row md:items-start md:space-x-4 space-y-4 md:space-y-0 mt-10 w-full">
                      {/* Rep User Dropdown */}
                      <div className="w-full md:w-1/4">
                        <select
                          value={repUserFilter}
                          onChange={(e) => setRepUserFilter(e.target.value)}
                          className="border p-2 rounded w-full"
                        >
                          <option value="">User</option>
                          {uniqueRepUsers.map((user) => (
                            <option key={user} value={user}>
                              {user}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Invoice Dropdown + Error */}
                      {(selectedType === "GRN" || selectedType === "PRN") && (
                        <div className="w-full md:w-1/4">
                          <div className="relative">
                            <select
                              value={invoiceFilter}
                              onChange={(e) => setInvoiceFilter(e.target.value)}
                              className="border p-2 rounded w-full"
                            >
                              <option value="">Invoice No</option>
                              {invoice.map((user) => (
                                <option key={user} value={user}>
                                  {user}
                                </option>
                              ))}
                            </select>
                            {invoiceError && (
                              <p className="text-red-500 text-sm mt-1">
                                {invoiceError}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {(selectedType === "GRN" ||
                    selectedType === "PRN" ||
                    selectedType === "TOG") && (
                    <div className="flex flex-col items-start gap-2">
                      <div>
                        <label className="block text-sm mt-5 font-medium text-gray-700">
                          Remarks
                        </label>
                        <input
                          type="text"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          className="min-w-[800px] max-w-xl border border-gray-300 p-2 rounded-md shadow-sm bg-white"
                          placeholder="Enter Remarks"
                        />
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleTableDataSubmit}
                    disabled={disable}
                    className={`bg-[#f17e21] hover:bg-[#efa05f] mt-3 text-white px-4 py-2 rounded-lg w-1/4 text-center ${
                      disable ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Save
                  </button>
                  <div className="flex justify-start overflow-x-auto ml-[-19px] ">
                    <Table
                      headers={headers}
                      data={filteredTableData.map((item) => item.rowData)}
                      editableColumns={editableColumns}
                      // onRowChange={handleRowChange}
                      onDeleteRow={handleDeleteRow}
                      formatColumns={
                        selectedType === "GRN" || selectedType === "PRN"
                          ? [6, 7]
                          : selectedType === "STOCK"
                          ? [4, 5]
                          : [4, 5]
                      }
                      formatColumnsQuantity={
                        selectedType === "GRN" || selectedType === "PRN"
                          ? [8, 9]
                          : selectedType === "STOCK"
                          ? [6, 7]
                          : [6, 7]
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
