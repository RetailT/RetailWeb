import React, { useEffect, useState, useContext, useRef } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import DatePicker from "../components/DatePicker";
import MultiSelectDropdown from "../components/MultiSelectDropdown";
import Alert from "../components/Alert";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import CircleBounceLoader from "../components/Loader";
import axios from "axios";
import ScrollableTable from "../components/Table";

const HourlyReportDashboard = () => {
  const { authToken } = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  const [amountBarChartRecords, setAmountBarChartRecords] = useState([]);
  const [quantityBarChartRecords, setQuantityBarChartRecords] = useState([]);
  const [amountBarChartLabels, setAmountBarChartLabels] = useState([]);
  const [quantityBarChartLabels, setQuantityBarChartLabels] = useState([]);
  const [disable, setDisable] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState({});
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [firstOption, setFirstOption] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isChecked, setIsChecked] = useState(true);
  const now = new Date();
  const [alert, setAlert] = useState(null);
  const [tableRecords, setTableRecords] = useState(null);
  const [tableHeadings, setTableHeadings] = useState(null);

  const token = localStorage.getItem("authToken");

  const formatDate = (date) => {
    const localDate = new Date(date);
    localDate.setHours(0, 0, 0, 0);
    const year = localDate.getFullYear();
    const month = (localDate.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-based
    const day = localDate.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formattedDate = formatDate(now);

  let newFromDate;
  let newToDate;
  const displayFromDate = selectedDates.fromDate
    ? formatDate(selectedDates.fromDate)
    : null;
  const displayToDate = selectedDates.toDate
    ? formatDate(selectedDates.toDate)
    : null;

  if (displayFromDate && displayToDate && displayFromDate > displayToDate) {
    newFromDate = displayToDate;
    newToDate = displayFromDate;
  } else {
    newFromDate = displayFromDate;
    newToDate = displayToDate;
  }

  const displayDate =
    submitted && selectedDates.fromDate && selectedDates.toDate
      ? `Date: ${newFromDate} - ${newToDate}`
      : submitted && selectedDates.fromDate
      ? `Date: ${formatDate(selectedDates.fromDate)}`
      : submitted && selectedDates.toDate
      ? `Date: ${formatDate(selectedDates.toDate)}`
      : `Date: ${formattedDate}`;

      const fetchDashboardData = async () => {
        try {
          const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}companies`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          setUserData(response.data.userData);

          if (response.data.userData && response.data.userData.length > 0) {
            // Map through all userData and get all options
            const allOptions = response.data.userData.map((data) => ({
              code: data.COMPANY_CODE.trim(),
              name: data.COMPANY_NAME.trim(),
            }));

            // Set the first option to include all options
            setFirstOption(allOptions);
            setSelectedOptions(allOptions); // Set the selected options to all options as well
          }
          else{
            setDisable(false);
            setAlert({ message: response.data.message || "Error Occured", type: "error" });
          setTimeout(() => setAlert(null), 3000);
          }
        } catch (err) {
          setError("Failed to fetch dashboard data");
          setDisable(false);
            setAlert({ message: err.response?.data?.message || "Error Occured", type: "error" });
          setTimeout(() => setAlert(null), 3000);
          console.error("Error fetching dashboard data:", err);
        }
      };
      
        const fetchData = async () => {
          if (firstOption) {
            setDisable(true);
            const token = localStorage.getItem("authToken");
            try {
              const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}hourly-report-data`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                params: {
                  currentDate: formattedDate,
                  fromDate: newFromDate,
                  toDate: newToDate,
                  selectedOptions: selectedOptions.map((option) => option.code).join(","),
                },
              });

              if (response.data.message === 'Processed parameters for company codes') {
                const tableData = response.data.tableRecords;
                
                // Set table headings as simple array of strings
                const headings = ["Date", "Time Slot", "Company Code", "Company Name", "Total Sales"];
                
                // Transform data to array of arrays format
                const transformedData = Array.isArray(tableData) ? tableData.map(record => {
                const date = record.DATE ? new Date(record.DATE).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
                const type = record.TYPE ? record.TYPE : '';
                const timeOnly = type.includes('/') ? type.split('/')[1].trim() : type;
                const code = record.COMPANY_CODE ? record.COMPANY_CODE.trim() : '';
                const name = record.COMPANY_NAME || '';
                const sales = Number(record.TOTAL_SALES).toFixed(2) || '0.00';
                return [date, timeOnly, code, name, sales];
                }) : [];

                // Only set state if we have valid data
                if (transformedData.length > 0) {
                  setTableHeadings(headings);
                  setTableRecords(transformedData);
                } else {
                  setAlert({ message: "No data found for the selected criteria", type: "error" });
                  setTimeout(() => setAlert(null), 3000);
                }
                
                setDisable(false);
              } else {
                setDisable(false);
                setAlert({ message: response.data.message || "Error Occurred", type: "error" });
                setTimeout(() => setAlert(null), 3000);
              }
            } catch (err) {
              setDisable(false);
              setAlert({ message: err.response?.data?.message || "Error Occurred", type: "error" });
              setTimeout(() => setAlert(null), 3000);
              console.error("Error sending parameters:", err);
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
      // Log the message every 3 seconds when the checkbox is checked
      const intervalId = setInterval(() => {
        window.location.reload();
      }, 180000);

      // Cleanup the interval when the checkbox is unchecked or the component unmounts
      return () => clearInterval(intervalId);
    } else {
      console.log("Checkbox is unchecked.");
    }
  }, [firstOption, isChecked]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const handleDateChange = (dates) => {
    setSelectedDates(dates);
  };

  const handleDropdownChange = (options) => {
    setSelectedOptions(options);
  };

  const handleCheckboxChange = () => {
    setIsChecked((prevState) => !prevState); // Toggle the checkbox state
  };

  const handleSubmit = async () => {
    if (newToDate === null && newFromDate === null) {
      setAlert({
        message: "Please select the from date and to date",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    } else if (newFromDate === null) {
      setAlert({ message: "Please select the from date", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    } else if (newToDate === null) {
      setAlert({ message: "Please select the to date", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    }
    else if (selectedOptions.length === 0) {
      setAlert({ message: "Please select a company", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    }

    if (newFromDate !== null && newToDate !== null && selectedOptions.length > 0) {
      setSubmitted(true);
      fetchData();
    }
  };

  const handleRefresh = async () => {
    window.location.reload();
  };

  const companyOptions = userData
    ? userData.map((item) => ({
        code: item.COMPANY_CODE.trim(),
        name: item.COMPANY_NAME.trim(),
      }))
    : [];

  return (
    <div>
      {disable && (
          <CircleBounceLoader />
        )}
        
      <Navbar />

      {/* Main Layout */}
      <div className="container p-6 mx-auto md:p-16">
        <div className="mt-20 md:mt-14">
            <Heading text="Hourly Sales Dashboard" />
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
            className="p-4 mt-4 bg-gray-200 rounded-lg shadow-md"
            style={{ backgroundColor: "#d8d8d8" }}
          >
              {isChecked ? (
              <div className="mt-8">
                {/* First Row - Centered Title */}
                <div className="mb-4 text-xl font-bold text-center sm:text-2xl">
                  Current Hourly Sales
                </div>

                {/* Second Row - Checkbox on Left, Button on Right */}
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={handleCheckboxChange}
                      id="checkbox"
                      className="w-3 h-3 mt-4 text-blue-600 focus:ring-blue-500 md:mt-0"
                    />
                    <label
                      htmlFor="checkbox"
                      className="mt-4 ml-2 font-semibold text-md md:mt-0"
                    >
                      Current Sales
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
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-col w-full gap-4 sm:flex-row sm:w-auto">
                      <DatePicker
                        label="Select Date Range:"
                        onDateChange={handleDateChange}
                      />
                      <label className="block text-sm font-medium text-gray-700 mb-[-10px] md:mb-0 ml-0 md:ml-10">
                        Select Company:
                      </label>
  
                      <div className="w-full sm:w-auto flex flex-col justify-center items-center mt-0 md:mt-5 ml-0 md:ml-[-120px]">
                        <MultiSelectDropdown
                          // label="Select Company:"
                          options={companyOptions}
                          onDropdownChange={handleDropdownChange}
                          selected={selectedOptions}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-4 mt-3 sm:flex-row sm:justify-end md:mt-6">
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
      className="p-4 mt-3 mb-5 bg-white rounded-md shadow-md sm:p-5"
      style={{ backgroundColor: "#d8d8d8" }}
      >
      <div className="flex justify-center text-xl font-bold text-black sm:text-2xl">
        Hourly Sales Summary
      </div>

      <div className="flex justify-center mt-4 font-bold">
        <p>{displayDate}</p>
      </div>
    </div>
  )}

    {(submitted || isChecked) && tableRecords?.length > 0 && tableHeadings?.length > 0 && (
      <div className="flex flex-col w-full mt-10 space-y-5">
        <div className="overflow-x-auto">
          <div className="bg-white p-4 border border-gray-300 rounded-md shadow-md min-w-[300px]">
            <ScrollableTable
              headers={tableHeadings}
              data={tableRecords}
              onRowClick={(headers, row) => {
                console.log("Row clicked:", headers, row);
              }}
              rightAlignedColumns={[4]} // Total Sales column (index 4) right aligned
            />
          </div>
        </div>
      </div>
    )}

    {(submitted || isChecked) && (!tableRecords || tableRecords.length === 0) && !disable && (
      <div className="flex flex-col w-full mt-10 space-y-5">
        <div className="overflow-x-auto">
          <div className="bg-white p-4 border border-gray-300 rounded-md shadow-md min-w-[300px]">
            <p className="py-8 text-center text-gray-500">No data available</p>
          </div>
        </div>
      </div>
    )}
          </div>
        </div>
    </div>
  );
};

export default HourlyReportDashboard;
