import { useEffect, useState, useContext } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import DatePicker from "../components/DatePicker";
import MultiSelectDropdown from "../components/MultiSelectDropdown";
import Alert from "../components/Alert";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import CircleBounceLoader from "../components/Loader";
import axios from "axios";
import NestedDynamicTable from "../components/DynamicTable";

const ProductDashboard = () => {
  const { authToken } = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  const [productName, setProductName] = useState("");
  const [disable, setDisable] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState({});
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [firstOption, setFirstOption] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isChecked, setIsChecked] = useState(true);
  const [isValuationChecked, setIsValuationChecked] = useState(false);
  const [productNames, setProductNames] = useState([]);
  const [alert, setAlert] = useState(null);
  const [tableRecords, setTableRecords] = useState([]);
  const [tableHeadings, setTableHeadings] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [searchInput, setSearchInput] = useState("");

  const token = localStorage.getItem("authToken");
  const now = new Date();

  const formatDate = (date) => {
    const localDate = new Date(date);
    localDate.setHours(0, 0, 0, 0);
    const year = localDate.getFullYear();
    const month = (localDate.getMonth() + 1).toString().padStart(2, "0");
    const day = localDate.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const date = selectedDate.date
    ? formatDate(selectedDate.date)
    : formatDate(now);

  const displayDate = `Date: ${formatDate(date)}`;

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}companies`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
        setAlert({
          message: response.data.message || "Error Occured",
          type: "error",
        });
        setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setError("Failed to fetch dashboard data");
      setDisable(false);
      setAlert({
        message: err.response?.data?.message || "Error Occured",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const fetchData = async () => {
    setProductName("");
    if (firstOption) {
      setDisable(true);
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}stock-wise-product`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              currentDate: formatDate(now),
              date: date,
              state: isValuationChecked,
              selectedOptions: selectedOptions
                .map((option) => option.code)
                .join(","),
            },
          }
        );

        if (
          response.data.message === "Processed parameters for company codes"
        ) {
          const tableData = response.data.tableRecords;
          const updatedTableData = tableData.map((item) => {
            const matchingOption = firstOption.find(
              (option) => option.code === item.COMPANY_CODE
            );
            const companyName = matchingOption
              ? matchingOption.name
              : "UNKNOWN";

            const baseData = {
              PRODUCT_NAME: item.PRODUCT_NAME,
              PRODUCT_CODE: item.PRODUCT_CODE,
              COMPANY_NAME: companyName,
              [`${companyName}_COSTPRICE`]: item.COSTPRICE,
              [`${companyName}_UNITPRICE`]: item.SCALEPRICE,
              [`${companyName}_QUANTITY`]: item.QUANTITY,
            };

            if (isValuationChecked) {
              return {
                ...baseData,
                [`${companyName}_COSTVALUE`]: item.COST_VALUE,
                [`${companyName}_SALESVALUE`]: item.SALES_VALUE,
              };
            } else {
              return baseData;
            }
          });

          const namesArray = firstOption.map((option) => option.name);
          const filteredNames = namesArray.filter((name) =>
            updatedTableData.some((record) => record.COMPANY_NAME === name)
          );
          const mainHeadings = [
            { label: "PRODUCT", subHeadings: ["CODE", "NAME"] },
            ...filteredNames.map((name) => ({
              label: name.replace(/\s+/g, "_"),
              subHeadings: isValuationChecked
                ? [
                    "COSTPRICE",
                    "UNITPRICE",
                    "QUANTITY",
                    "COSTVALUE",
                    "SALESVALUE",
                  ]
                : ["COSTPRICE", "UNITPRICE", "QUANTITY"],
            })),
          ];

          setTableHeadings(mainHeadings);

          const transformedData = updatedTableData.map((row) => {
            const newRow = {};
            for (let key in row) {
              const normalizedKey = key.replace(/\s+/g, "_");
              newRow[normalizedKey] = row[key];
            }
            filteredNames.forEach((name) => {
              const formattedName = name.replace(/\s+/g, "_");
              if (!newRow.hasOwnProperty(`${formattedName}_AMOUNT`)) {
                newRow[`${formattedName}_AMOUNT`] = "";
              }
              if (!newRow.hasOwnProperty(`${formattedName}_QUANTITY`)) {
                newRow[`${formattedName}_QUANTITY`] = "";
              }
              if (!newRow.hasOwnProperty(`${formattedName}_COSTPRICE`)) {
                newRow[`${formattedName}_COSTPRICE`] = "";
              }
              if (!newRow.hasOwnProperty(`${formattedName}_UNITPRICE`)) {
                newRow[`${formattedName}_UNITPRICE`] = "";
              }
              if (isValuationChecked) {
                if (!newRow.hasOwnProperty(`${formattedName}_COSTVALUE`)) {
                  newRow[`${formattedName}_COSTVALUE`] = "";
                }
                if (!newRow.hasOwnProperty(`${formattedName}_SALESVALUE`)) {
                  newRow[`${formattedName}_SALESVALUE`] = "";
                }
              }
            });
            return newRow;
          });

          function aggregateData(data) {
            const aggregatedData = {};
            data.forEach((record) => {
              const { PRODUCT_NAME, PRODUCT_CODE, ...rest } = record;
              if (!aggregatedData[PRODUCT_NAME]) {
                aggregatedData[PRODUCT_NAME] = { PRODUCT_NAME, PRODUCT_CODE };
              }
              Object.keys(rest).forEach((key) => {
                const value = rest[key];
                if (!aggregatedData[PRODUCT_NAME][key] && value !== "") {
                  aggregatedData[PRODUCT_NAME][key] = parseFloat(value);
                } else if (value !== "") {
                  aggregatedData[PRODUCT_NAME][key] += parseFloat(value);
                }
              });
            });
            return Object.values(aggregatedData);
          }

          const aggregatedResults = aggregateData(transformedData);
          setTableRecords(aggregatedResults);
          setFilteredRecords(aggregatedResults);
          setProductNames(aggregatedResults.map((item) => item.PRODUCT_NAME));
          setDisable(false);
        } else {
          setFilteredRecords([]);
          setTableHeadings([]);
          setDisable(false);
          setAlert({ message: response.data.message, type: "error" });
          setTimeout(() => setAlert(null), 3000);
        }
      } catch (err) {
        console.error("Error sending parameters:", err);
        setDisable(false);
        setAlert({
          message: err.response?.data?.message || "Error Occured",
          type: "error",
        });
        setTimeout(() => setAlert(null), 3000);
      }
    }
  };

  useEffect(() => {
    if (!token) {
      console.error("No token found in localStorage");
      setError("No token found");
      return;
    }
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchData();
    if (isChecked) {
      const intervalId = setInterval(() => {
        window.location.reload();
      }, 180000);
      return () => clearInterval(intervalId);
    }
    if (isValuationChecked !== undefined) {
      handleSubmit();
    }
  }, [firstOption, isChecked, isValuationChecked]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const handleDateChange = (date) => setSelectedDate(date);
  const handleDropdownChange = (options) => setSelectedOptions(options);
  const handleCheckboxChange = () => setIsChecked((prev) => !prev);
  const handleValuationCheckboxChange = () =>
    setIsValuationChecked((prev) => !prev);

  const handleSubmit = async () => {
    console.log(date);
    if (!date) {
      setAlert({ message: "Please select the date", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    } 
    else if (selectedOptions.length === 0) {
      setAlert({ message: "Please select a company", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    }
    else {
      setSubmitted(true);
      fetchData();
    }
  };

  const handleRefresh = async () => window.location.reload();

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    setShowSuggestions(value !== ""); // show only if typing
    if (value === "") {
      setFilteredRecords(tableRecords);
    }
  };

  const handleSelectName = (name) => {
    setSearchInput(name);
    const filtered = tableRecords.filter((item) => item.PRODUCT_NAME === name);
    setFilteredRecords(filtered);
    setShowSuggestions(false); // ✅ close dropdown
  };

  const companyOptions = userData
    ? userData.map((item) => ({
        code: item.COMPANY_CODE.trim(),
        name: item.COMPANY_NAME.trim(),
      }))
    : [];

  return (
    <div>
      {disable && <CircleBounceLoader />}
      <Navbar />
      <div className="container mx-auto p-6 md:p-16">
        <div className="mt-20 md:mt-14">
          <Heading text="Product Stock Dashboard" />
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
                  Current Product Stock
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
                Product Stock Summary
              </div>
              <div className="flex justify-center font-bold mt-4">
                <p>{displayDate}</p>
              </div>
            </div>
          )}

          {(submitted || isChecked) && (
            <div className="flex flex-col w-full mt-10 space-y-5">
          <div className="bg-white p-4 border border-gray-300 rounded-md min-w-[300px]">
                  {/* ✅ Search Input with Suggestions */}
                  <div className="relative mb-4 w-full max-w-sm mb-10">
                    <input
                      type="text"
                      placeholder="Search Product"
                      value={searchInput}
                      onChange={handleInputChange}
                      className="border border-gray-300 px-3 py-2 w-full rounded-md"
                    />
                    {showSuggestions && (
                      <ul className="absolute bg-white border-gray-300 border w-full max-h-40 overflow-y-auto z-10">
                        {productNames
                          .filter((name) =>
                            name
                              .toLowerCase()
                              .includes(searchInput.toLowerCase())
                          )
                          .map((name, index) => (
                            <li
                              key={index}
                              className="px-3 py-2 hover:bg-gray-200 cursor-pointer"
                              onClick={() => handleSelectName(name)}
                            >
                              {name}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center mb-10">
                    <input
                      type="checkbox"
                      checked={isValuationChecked}
                      onChange={handleValuationCheckboxChange}
                      id="checkbox"
                      className="h-3 w-3 px-3 text-blue-600 focus:ring-blue-500 mt-4 md:mt-10"
                    />
                    <label
                      htmlFor="checkbox"
                      className="ml-2 text-md mt-4 md:mt-10"
                    >
                      With Stock Valuation
                    </label>
                  </div>

                  {/* ✅ Table Component */}
                  <NestedDynamicTable
                    data={filteredRecords}
                    mainHeadings={tableHeadings}
                    title="Product Stock Data"
                  />

                </div>
              </div>
            
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDashboard;
