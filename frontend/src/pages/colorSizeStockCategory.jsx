import React, { useEffect, useState, useContext } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import DatePicker from "../components/DatePicker";
import MultiSelectDropdown from "../components/MultiSelectDropdown";
import Alert from "../components/Alert";
import Table from "../components/EditableTable";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import CircleBounceLoader from "../components/Loader";
import axios from "axios";
import NestedDynamicTable from "../components/DynamicTable";
import { debounce } from "lodash";

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong while rendering the table. Please try refreshing or selecting fewer options.</div>;
    }
    return this.props.children;
  }
}

const ProductDashboard = () => {
  const { authToken } = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  const [productNames, setProductNames] = useState([]);
  const [categoryNames, setCategoryNames] = useState([]);
  const [tableRecords, setTableRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [tableHeadings, setTableHeadings] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [categorySearchInput, setCategorySearchInput] = useState("");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [selectedDate, setSelectedDate] = useState({});
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [disable, setDisable] = useState(true);
  const [alert, setAlert] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isChecked, setIsChecked] = useState(true);
  const [isValuationChecked, setIsValuationChecked] = useState(false);
  const [firstOption, setFirstOption] = useState(null);
  const [rowTableHeaders, setRowTableHeaders] = useState([]);
  const [rowTableData, setRowTableData] = useState([]);
  const [rowName, setRowName] = useState("");
  const [code, setCode] = useState("");
  const [isRowSelect, setIsRowSelect] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [rowCurrentPage, setRowCurrentPage] = useState(1);
  const rowPageSize = 50;

  const token = localStorage.getItem("authToken");
  const now = new Date();
  let rowDataStatus = false;

  const formatDate = (date) => {
    const localDate = new Date(date);
    localDate.setHours(0, 0, 0, 0);
    const year = localDate.getFullYear();
    const month = (localDate.getMonth() + 1).toString().padStart(2, "0");
    const day = localDate.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const date = selectedDate.date ? formatDate(selectedDate.date) : formatDate(now);
  const displayDate = `Date: ${formatDate(date)}`;

  // ---------------------- FETCH DASHBOARD DATA ----------------------
  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUserData(response.data.userData);

      if (response.data.userData && response.data.userData.length > 0) {
        const allOptions = response.data.userData.map((data) => ({
          code: data.COMPANY_CODE.trim(),
          name: data.COMPANY_NAME.trim(),
        }));
        setFirstOption(allOptions);
        setSelectedOptions(allOptions);
      } else {
        setDisable(false);
        setAlert({ message: response.data.message || "Error Occurred", type: "error" });
        setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setDisable(false);
      setAlert({ message: err.response?.data?.message || "Error Occurred", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  // ---------------------- FETCH TABLE DATA ----------------------
  const fetchData = async () => {
    setRowTableData([]);
    setRowTableHeaders([]);
    setSearchInput("");
    setCategorySearchInput("");
    if (!firstOption) return;
    setDisable(true);

    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}color-size-stock-category-dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            currentDate: formatDate(now),
            date: date,
            rowSelect: isRowSelect,
            categoryCode: code,
            state: isValuationChecked,
            selectedOptions: selectedOptions.map((option) => option.code).join(","),
          },
        }
      );

      console.log("response", response.data);

      if (response.data.message !== "Processed parameters for company codes") {
        setFilteredRecords([]);
        setTableHeadings([]);
        setAlert({ message: response.data.message, type: "error" });
        setTimeout(() => setAlert(null), 3000);
        return;
      }

      const rowDataStatus = response.data.rowDataStatus;

      if (rowDataStatus === true || String(rowDataStatus).toLowerCase() === "true") {
        const rowData = response.data.rowRecords;
        setRowTableData([]);
        setRowTableHeaders([]);
        setRowCurrentPage(1); // Reset row table pagination

        if (!Array.isArray(rowData) || rowData.length === 0) {
          setAlert({ message: "No data available to display", type: "error" });
          setTimeout(() => setAlert(null), 3000);
          return;
        }

        const updatedTableData = rowData
          .map((item) => {
            if (!item || !item.COMPANY_CODE) {
              console.warn("Invalid rowData item:", item);
              return null;
            }
            const matchingOption = firstOption.find(
              (option) => option.code === item.COMPANY_CODE
            );
            const companyName = matchingOption ? matchingOption.name : "UNKNOWN";
            return { ...item, COMPANY_NAME: companyName };
          })
          .filter((item) => item !== null)
          .sort((a, b) => a.COMPANY_CODE.localeCompare(b.COMPANY_CODE));

        const baseRowHeaders = [
          "COMPANY_CODE",
          "COMPANY_NAME",
          "SERIALNO",
          "COSTPRICE",
          "SCALEPRICE",
          "QUANTITY",
        ];

        const baseRowHeaderMapping = {
          COMPANY_CODE: "Company Code",
          COMPANY_NAME: "Company Name",
          SERIALNO: "Serial Number",
          COSTPRICE: "Cost Price",
          SCALEPRICE: "Unit Price",
          QUANTITY: "Quantity",
        };

        const customRowHeaders = isValuationChecked
          ? [...baseRowHeaders, "COST_VALUE", "SALES_VALUE"]
          : baseRowHeaders;

        const customRowHeaderMapping = isValuationChecked
          ? {
              ...baseRowHeaderMapping,
              COST_VALUE: "Cost Value",
              SALES_VALUE: "Sales Value",
            }
          : baseRowHeaderMapping;

        const customHeaders = customRowHeaders.map(
          (key) => customRowHeaderMapping[key] || key
        );

        setRowTableHeaders(customHeaders);
        const formattedTableData = updatedTableData.map((item) =>
          customRowHeaders.map((key) => item[key])
        );
        setRowTableData(formattedTableData);
      } else {
        setRowTableData([]);
        setRowTableHeaders([]);
        setRowCurrentPage(1); // Reset row table pagination

        const tableData = response.data.tableRecords;

        const companyMap = new Map(firstOption.map(opt => [opt.code, opt.name]));
        const productMap = new Map();
        const companySet = new Set();

        tableData.forEach((item) => {
          const companyName = companyMap.get(item.COMPANY_CODE) || "UNKNOWN";
          companySet.add(companyName);

          const key = `${item.PRODUCT_NAME}_${item.CATEGORY_NAME}`;

          if (!productMap.has(key)) {
            productMap.set(key, {
              PRODUCT_NAME: item.PRODUCT_NAME,
              PRODUCT_CODE: item.PRODUCT_CODE,
              CATEGORY_NAME: item.CATEGORY_NAME,
              CATEGORY_CODE: item.CATEGORY_CODE,
              companies: new Map(),
            });
          }

          const current = productMap.get(key);
          const companyData = {
            COSTPRICE: item.COSTPRICE,
            UNITPRICE: item.SCALEPRICE,
            QUANTITY: item.QUANTITY,
          };

          if (isValuationChecked) {
            companyData.COSTVALUE = item.COST_VALUE;
            companyData.SALESVALUE = item.SALES_VALUE;
          }

          current.companies.set(companyName, companyData);
        });

        const filteredNames = Array.from(companySet).sort((a, b) => a.localeCompare(b));

        const mainHeadings = [
          { label: "PRODUCT", subHeadings: ["CODE", "NAME"] },
          { label: "CATEGORY", subHeadings: ["CODE", "NAME"] },
          ...filteredNames.map((name) => ({
            label: name.replace(/\s+/g, "_"),
            subHeadings: isValuationChecked
              ? ["COSTPRICE", "UNITPRICE", "QUANTITY", "COSTVALUE", "SALESVALUE"]
              : ["COSTPRICE", "UNITPRICE", "QUANTITY"],
          })),
        ];

        setTableHeadings(mainHeadings);

        const products = Array.from(productMap.values()).map((entry) => {
          const row = {
            PRODUCT_NAME: entry.PRODUCT_NAME,
            PRODUCT_CODE: entry.PRODUCT_CODE,
            CATEGORY_NAME: entry.CATEGORY_NAME,
            CATEGORY_CODE: entry.CATEGORY_CODE,
          };

          filteredNames.forEach((name) => {
            const formattedName = name.replace(/\s+/g, "_");
            const companyData = entry.companies.get(name) || {};

            row[`${formattedName}_COSTPRICE`] = companyData.COSTPRICE || "";
            row[`${formattedName}_UNITPRICE`] = companyData.UNITPRICE || "";
            row[`${formattedName}_QUANTITY`] = companyData.QUANTITY || "";

            if (isValuationChecked) {
              row[`${formattedName}_COSTVALUE`] = companyData.COSTVALUE || "";
              row[`${formattedName}_SALESVALUE`] = companyData.SALESVALUE || "";
            }
          });

          return row;
        });

        setTableRecords(products);
        setFilteredRecords(products);
        setProductNames([...new Set(products.map((item) => item.PRODUCT_NAME))]);
        setCategoryNames([...new Set(products.map((item) => item.CATEGORY_NAME))]);
        setCurrentPage(1);
      }
    } catch (err) {
      console.log("err", err);
      setFilteredRecords([]);
      setTableHeadings([]);
      setRowTableData([]);
      setRowTableHeaders([]);
      setRowCurrentPage(1);
      setAlert({
        message: err.response?.data?.message || "Error Occurred",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    } finally {
      setDisable(false);
    }
  };

  // ---------------------- USE EFFECT ----------------------
  useEffect(() => {
    if (!token) return;
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (firstOption && !isRowSelect) {
      fetchData();
    }
    if (isRowSelect) {
      fetchData();
    }
    if (isChecked) {
      const intervalId = setInterval(() => window.location.reload(), 180000);
      return () => clearInterval(intervalId);
    }
    if (isValuationChecked !== undefined) handleSubmit();
  }, [firstOption, isChecked, isValuationChecked]);

  if (!authToken) return <Navigate to="/login" replace />;

  // ---------------------- FILTER HANDLERS ----------------------
  const handleFilter = debounce((productValue, categoryValue) => {
    const filtered = tableRecords.filter((item) => {
      const matchProduct =
        !productValue || item.PRODUCT_NAME.toLowerCase().includes(productValue.toLowerCase());
      const matchCategory =
        !categoryValue || item.CATEGORY_NAME.toLowerCase().includes(categoryValue.toLowerCase());
      return matchProduct && matchCategory;
    });

    setFilteredRecords(filtered);
    setCurrentPage(1);
  }, 300);

  const handleInputChange = (e, isProduct = true) => {
    const value = e.target.value;
    if (isProduct) {
      setSearchInput(value);
      setShowProductSuggestions(value !== "");
      handleFilter(value, categorySearchInput);
    } else {
      setCategorySearchInput(value);
      setShowCategorySuggestions(value !== "");
      handleFilter(searchInput, value);
    }
  };

  const handleSelectName = (name, isProduct = true) => {
    if (isProduct) {
      setSearchInput(name);
      setShowProductSuggestions(false);
      handleFilter(name, categorySearchInput);
    } else {
      setCategorySearchInput(name);
      setShowCategorySuggestions(false);
      handleFilter(searchInput, name);
    }
  };

  const fetchRowData = async (row) => {
    setIsRowSelect(true);
    setRowName(row.CATEGORY_NAME);
    setCode(row.CATEGORY_CODE);
    setRowCurrentPage(1); // Reset row table pagination on new row selection
    await fetchData();
  };

  const handleDateChange = (date) => setSelectedDate(date);
  const handleDropdownChange = (options) => setSelectedOptions(options);
  const handleCheckboxChange = () => setIsChecked((prev) => !prev);
  const handleValuationCheckboxChange = () => setIsValuationChecked((prev) => !prev);

  const handleSubmit = async () => {
    if (!date) {
      setAlert({ message: "Please select the date", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    } else if (selectedOptions.length === 0) {
      setAlert({ message: "Please select a company", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    } else {
      setSubmitted(true);
      setIsRowSelect(false);
      setRowName("");
      setCode("");
      setRowCurrentPage(1); // Reset row table pagination on submit
      fetchData();
    }
  };

  const handleRefresh = async () => window.location.reload();

  const companyOptions = userData
    ? userData.map((item) => ({ code: item.COMPANY_CODE.trim(), name: item.COMPANY_NAME.trim() }))
    : [];

  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredRecords.length / pageSize);

  const paginatedRowRecords = rowTableData.slice((rowCurrentPage - 1) * rowPageSize, rowCurrentPage * rowPageSize);
  const rowTotalPages = Math.ceil(rowTableData.length / rowPageSize);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleRowPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= rowTotalPages) {
      setRowCurrentPage(newPage);
    }
  };

  // ---------------------- JSX ----------------------
  return (
    <div>
      {disable && <CircleBounceLoader />}
      <Navbar />
      <div className="container mx-auto p-6 md:p-16">
        <div className="mt-20 md:mt-14">
          <Heading text="Category Stock Dashboard" />
        </div>
        <div className="mt-4">
          {alert && (
            <Alert
              message={alert.message}
              type={alert.type}
              onClose={() => setAlert(null)}
            />
          )}
          <div
            className="bg-gray-200 p-4 rounded-lg shadow-md mt-4"
            style={{ backgroundColor: "#d8d8d8" }}
          >
            {isChecked ? (
              <div className="mt-8">
                <div className="text-center text-xl sm:text-2xl font-bold mb-4">
                  Current Category Stock
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={handleCheckboxChange}
                      id="checkbox"
                      className="h-3 w-3 text-blue-600 focus:ring-blue-500 mt-4 md:mt-0"
                    />
                    <label
                      htmlFor="checkbox"
                      className="ml-2 text-md font-semibold mt-4 md:mt-0"
                    >
                      Current Stock
                    </label>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={disable}
                    className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 mt-4 md:mt-0 ${
                      disable ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <DatePicker
                      label="Select Date:"
                      onDateChange={handleDateChange}
                      range="true"
                    />
                    <label className="block text-sm font-medium text-gray-700 mb-[-10px] md:mb-0 ml-0 md:ml-10">
                      Select Company:
                    </label>
                    <div className="w-full sm:w-auto flex flex-col justify-center items-center mt-0 md:mt-5 ml-0 md:ml-[-120px]">
                      <MultiSelectDropdown
                        options={companyOptions}
                        onDropdownChange={handleDropdownChange}
                        selected={selectedOptions}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-center sm:justify-end gap-4 mt-3 md:mt-6">
                    <button
                      onClick={handleSubmit}
                      disabled={disable}
                      className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 ${
                        disable ? "opacity-50 cursor-not-allowed" : ""
                      } w-full sm:w-auto`}
                    >
                      Submit
                    </button>
                    <button
                      onClick={handleRefresh}
                      disabled={disable}
                      className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 ${
                        disable ? "opacity-50 cursor-not-allowed" : ""
                      } w-full sm:w-auto mt-2 sm:mt-0`}
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isChecked && (
            <div
              className="bg-white p-4 sm:p-5 rounded-md shadow-md mt-3 mb-5"
              style={{ backgroundColor: "#d8d8d8" }}
            >
              <div className="flex justify-center text-xl sm:text-2xl font-bold text-black">
                Category Stock Summary
              </div>
              <div className="flex justify-center font-bold mt-4">
                <p>{displayDate}</p>
              </div>
            </div>
          )}

          {(submitted || isChecked) && (
            <div className="flex flex-col w-full space-y-5 mt-10">
              <div className="overflow-x-auto bg-white p-4 rounded-md border border-gray-300 min-w-[300px]">
                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-10">
                  <div className="relative w-full sm:w-1/2">
                    <input
                      type="text"
                      placeholder="Search Product"
                      value={searchInput}
                      onChange={(e) => handleInputChange(e, true)}
                      className="border px-3 py-2 w-full rounded-md"
                    />
                    {showProductSuggestions && (
                      <ul className="absolute bg-white border w-full max-h-40 overflow-y-auto z-10">
                        {productNames
                          .filter((name) => name.toLowerCase().includes(searchInput.toLowerCase()))
                          .map((name, idx) => (
                            <li
                              key={idx}
                              className="px-3 py-2 hover:bg-gray-200 cursor-pointer"
                              onClick={() => handleSelectName(name, true)}
                            >
                              {name}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  <div className="relative w-full sm:w-1/2">
                    <input
                      type="text"
                      placeholder="Search Category"
                      value={categorySearchInput}
                      onChange={(e) => handleInputChange(e, false)}
                      className="border px-3 py-2 w-full rounded-md"
                    />
                    {showCategorySuggestions && (
                      <ul className="absolute bg-white border w-full max-h-40 overflow-y-auto z-10">
                        {categoryNames
                          .filter((name) => name.toLowerCase().includes(categorySearchInput.toLowerCase()))
                          .map((name, idx) => (
                            <li
                              key={idx}
                              className="px-3 py-2 hover:bg-gray-200 cursor-pointer"
                              onClick={() => handleSelectName(name, false)}
                            >
                              {name}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex items-center mt-5 mb-10">
                  <input
                    type="checkbox"
                    checked={isValuationChecked}
                    onChange={handleValuationCheckboxChange}
                    className="h-3 w-3 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-md">With Stock Valuation</label>
                </div>

                <ErrorBoundary>
                  <NestedDynamicTable
                    data={paginatedRecords}
                    mainHeadings={tableHeadings}
                    title="Product Stock Data"
                    onRowSelect={(row) => fetchRowData(row)}
                  />
                </ErrorBoundary>

                <div className="flex justify-between mt-4">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>

                {Array.isArray(rowTableData) && rowTableData.length > 0 && isRowSelect && (
                  <div>
                    <p className="text-center text-[#bc4a17] text-lg sm:text-xl font-bold mt-10">
                      {rowName ? `${rowName}` : ""}
                    </p>
                  <div className="mt-5 overflow-x-auto">
                    
                    <div className="w-max mx-auto">
                      <Table
                        headers={rowTableHeaders}
                        data={paginatedRowRecords}
                        formatColumns={[3, 4, 6, 7]}
                        formatColumnsQuantity={[5]}
                        editableColumns={[]}
                        rightAlignedColumns={[3, 4, 5, 6, 7]}
                        bin={true}
                      />
                    </div>
                    <div className="flex justify-between mt-4">
                      <button
                        onClick={() => handleRowPageChange(rowCurrentPage - 1)}
                        disabled={rowCurrentPage === 1}
                        className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span>Page {rowCurrentPage} of {rowTotalPages}</span>
                      <button
                        onClick={() => handleRowPageChange(rowCurrentPage + 1)}
                        disabled={rowCurrentPage === rowTotalPages}
                        className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDashboard;
