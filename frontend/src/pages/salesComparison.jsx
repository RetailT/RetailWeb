import { useState, useEffect, useContext } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../components/NavBar";
import { AuthContext } from "../AuthContext";
import Heading from "../components/Heading";
import ClusteredBarChart from "../components/ClusteredBarChart";
import Table from "../components/Table";
import Loader from "../components/Loader";
import Alert from "../components/Alert";
import axios, { all } from "axios";
import { jwtDecode } from "jwt-decode";

function SalesComparison() {
  const { authToken } = useContext(AuthContext);
  const [data, setData] = useState([]);

  const [alert, setAlert] = useState(null);
  const [disable, setDisable] = useState(false);

  const [selectedMonths, setSelectedMonths] = useState("");
  const [monthsError, setMonthsError] = useState("");
  const [tableData, setTableData] = useState([]);
  const [tableHeaders, setTableHeaders] = useState([]);

  const token = localStorage.getItem("authToken");

  const decodedToken = jwtDecode(token);
  const username = decodedToken.username;

  useEffect(() => {
    if (!token) {
      console.error("No token found in localStorage");
      return;
    }
  }, []);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const requestData = async () => {
    try {
      setDisable(true);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}sales-comparison-data`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            months: selectedMonths,
            username: username,
          },
        }
      );

      if (response.data.message === "Data found successfully") {
        const data = response.data.records;
        if (Object.keys(data).length === 0) {
          setAlert({
            message: "No data found for the selected months",
            type: "error",
          });
          // Dismiss alert after 3 seconds
          setTimeout(() => {
            setAlert(null);
            window.location.reload(); // Full page reload
          }, 3000);
          return;
        }

const monthOrder = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const cleanedData = data.map(({ REPUSER, COMPANY_CODE, ...rest }) => rest);

// Step 2️⃣ - Sort data by YEAR and MONTH before grouping
const sortedData = cleanedData.sort((a, b) => {
  if (a.YEAR !== b.YEAR) return a.YEAR - b.YEAR;
  return monthOrder.indexOf(a.MONTH) - monthOrder.indexOf(b.MONTH);
});

// Step 3️⃣ - Group sorted data
const groupedData = sortedData.reduce((acc, item) => {
  const key = `${item.YEAR}-${item.MONTH}`;
  if (!acc[key]) acc[key] = [];
  acc[key].push(item);
  return acc;
}, {});

        setData(groupedData);

// 1️⃣ Extract all unique months
const months = [...new Set(data.map(item => item.MONTH))];


months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

// 2️⃣ Pivot transformation with two-decimal formatting
const pivotData = [];

data.forEach(item => {
  const key = `${item.COMPANY_CODE.trim()}-${item.YEAR}`;
  let existing = pivotData.find(row => row._key === key);

  if (!existing) {
    existing = {
      _key: key,
      COMPANY_CODE: item.COMPANY_CODE.trim(),
      COMPANY_NAME: item.COMPANY_NAME,
      YEAR: item.YEAR,
    };
    months.forEach(m => (existing[m] = 0));
    pivotData.push(existing);
  }

  // Ensure numeric + two decimals
  existing[item.MONTH] = parseFloat(item.NETSALES || 0).toFixed(2);
});

// 3️⃣ Define readable headers
const headers = ["Company Code", "Company Name", "Year", ...months];

// 4️⃣ Convert pivot data into array-of-arrays for table
const tableData = pivotData.map(obj => [
  obj.COMPANY_CODE,
  obj.COMPANY_NAME,
  obj.YEAR,
  ...months.map(m => obj[m]),
]);

setTableData(tableData);
        setTableHeaders(headers);


      } else {
        setAlert({
          message: "No data found for the selected months",
          type: "error",
        });

        // Dismiss alert after 3 seconds
        setTimeout(() => {
          setAlert(null);
          window.location.reload(); // Full page reload
        }, 3000);
        setDisable(false);
        return;
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

  const handleMonthsChange = (event) => {
    const month = event.target.value;
    setSelectedMonths(month);
  };

  const handleMonthsSubmit = async (e) => {
    e.preventDefault();
    let valid = true;
    if (!selectedMonths) {
      setMonthsError("Number of months is required.");
      valid = false;
    } else {
      setMonthsError("");
    }
    if (valid) {
      await requestData();
    }
  };

  return (
    <div>
      {disable && <Loader />}
      <Navbar />
      <div className="flex flex-col min-h-screen">
        <div
          className={
            "transition-all duration-300 flex-1 p-2 sm:p-4 md:p-6 lg:ml-8 lg:mr-8 ml-2 sm:ml-4 mr-2 sm:mr-4 mt-28 sm:mt-24 md:mt-28 max-w-full"
          }
        >
          <div className="w-full max-w-full ml-0 md:ml-2 mb-4 md:mb-0">
            <Heading text="Sales Comparison" />
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

          <div className="bg-[#d8d8d8] p-2 sm:p-4 rounded-md ml-0 md:ml-4 shadow-md mb-2 sm:mb-4 mt-10 w-full max-w-full">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-2 sm:gap-4 mb-2 sm:mb-4">
              {/* Months Dropdown */}
              <div className="flex flex-col gap-1 w-full lg:w-1/3 mb-2 sm:mb-0">
                <label className="text-sm font-medium text-gray-700">
                  Select Number of Months
                </label>
                <select
                  value={selectedMonths}
                  onChange={handleMonthsChange}
                  className="border border-gray-300 p-1 sm:p-2 rounded-md shadow-sm bg-white w-full text-sm"
                >
                  <option value="" disabled>
                    Select Months
                  </option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
                {monthsError && (
                  <p className="text-red-500 text-sm mt-1 mb-2">
                    {monthsError}
                  </p>
                )}
              </div>

              {/* Submit Button aligned with bottom of selects */}
              <div className="w-full lg:w-auto flex justify-center lg:justify-end">
                <button
                  onClick={handleMonthsSubmit}
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

          <div className="mt-10 ml-0 md:ml-8 p-4 border border-gray-300 rounded-md sm:p-5">
            {Object.keys(data).length > 0 ? (
              <div>
                <ClusteredBarChart groupedData={data} />

                <div className="flex flex-col w-full mt-10 space-y-5">
                  <div className="bg-white p-4 border border-gray-300 rounded-md min-w-[300px]">
                    <Table
                      headers={tableHeaders}
                      data={tableData}
                      onRowClick={(rowData) => {
                        console.log("Row clicked:", rowData);
                      }}
                      rightAlignedColumns={[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-center text-gray-500">No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalesComparison;
