import React, { useEffect, useState, useContext, useRef } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import DatePicker from "../components/DatePicker";
import MultiSelectDropdown from "../components/MultiSelectDropdown";
import Alert from "../components/Alert";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import qs from "qs";
import axios from "axios";
import PieChart from "../components/PieChart";
import BarChart from "../components/BarChart";
import ScrollableTable from "../components/Table";

const Dashboard = () => {
  const { authToken } = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState({});
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [firstOption, setFirstOption] = useState(null);
  const [cashierData, setCashierData] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [selectedRowLabels, setSelectedRowLabels] = useState(null);
  const [cashierTableData, setCashierTableData] = useState(null);
  const [cashierTableLabels, setCashierTableLabels] = useState(null);
  const [isChecked, setIsChecked] = useState(true);
  const now = new Date();
  const [alert, setAlert] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const intervalRef = useRef(null);
  const [labels, setLabels] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [tableLabels, setTableLabels] = useState(null);

  const colors = ["#000000", "#ce521a", "#78716e", "#db9674"];
  const table1 = [1,2,3,4,5,6,7,8]
  const table2 = [2,3,4,5,6,7,8,9]

  const rearrangedLabels = [
    { key: "COMPANY_CODE", label: "Company Code" },
    // { key: "SALESDATE", label: "Sales Date" },
    { key: "NETSALES", label: "Net Sales" },
    { key: "CASHSALES", label: "Cash Sales" },
    { key: "CARDSALES", label: "Card Sales" },
    { key: "CREDITSALES", label: "Credit Sales" },
    { key: "OTHER_PAYMENT", label: "Other Payment" },
    { key: "PAIDOUT", label: "Paid Out" },
    { key: "CASHINHAND", label: "Cash In Hand" },
  ];

  const token = localStorage.getItem("authToken");

  const formatDate = (date) => {
    const localDate = new Date(date);
    localDate.setHours(0, 0, 0, 0);
    const year = localDate.getFullYear();
    const month = (localDate.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-based
    const day = localDate.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatData = (data) => {
    // Step 1: Check if any value is NaN (string or actual NaN)
    const hasNaN = data.some(row =>
      Array.isArray(row) &&
      row.some(value => value === "NaN" || Number.isNaN(value))
    );
  
    return data.map((row) =>
      row.map((value, index) => {
        // Step 2: Replace NaN if needed
        if (hasNaN && (value === "NaN" || Number.isNaN(value))) {
          return "--";
        }
  
        // Step 3: Format numbers from index > 0
        if (index > 0 && typeof value === "number") {
          return value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
  
        return value;
      })
    );
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
    } catch (err) {
      setError("Failed to fetch dashboard data");

      console.error("Error fetching dashboard data:", err);
    }
  };

  const fetchData = async () => {
    if (firstOption) {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      try {
        
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}dashboard-data`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            currentDate: formattedDate,
            fromDate: newFromDate,
            toDate: newToDate,
            selectedOptions: selectedOptions.map((option) => option.code),
          },
          paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
        });
        setLoading(false);
        if (response.data.cashierPointRecord.length === 0 && response.data.record.length === 0 && response.data.result.length === 0) {
          setAlert({
            message: "No data available",
            type: "error",
          });
          setTimeout(() => setAlert(null), 3000);

        }

        const rearrangedLabels = [
          "Company Code",
          // "Sales Date",
          "Net Sales",
          "Cash Sales",
          "Card Sales",
          "Credit Sales",
          "Other Payment",
          "Gift Voucher Out",
          "Paid Out",
          "Cash In Hand",
        ];

        const salesData = [];
        const labels = [];
        const result = response.data.result[0];
        const record = response.data.record;
        const cashierPointRecord = response.data.cashierPointRecord;
        
        for (const key in result) {
          const value = result[key];
          if (value === "NaN" || Number.isNaN(value)) {
            result[key] = "--";
          }
        }
        
        
        if (!result) {
          setData([]);
          setSalesData([]);
          setLabels([]);
          setTableData([]);
          setTableLabels([]);
          return;
        }

        rearrangedLabels.forEach((label) => {
          switch (label) {
            case "Company Code":
              salesData.push(result.COMPANY_CODE);
              labels.push("Company Code");
              break;
            case "Net Sales":
              salesData.push(parseFloat(result.NETSALES));
              labels.push("Net Sales");
              break;
            case "Cash Sales":
              salesData.push(parseFloat(result.CASHSALES));
              labels.push("Cash Sales");
              break;
            case "Card Sales":
              salesData.push(parseFloat(result.CARDSALES));
              labels.push("Card Sales");
              break;
            case "Credit Sales":
              salesData.push(parseFloat(result.CREDITSALES));
              labels.push("Credit Sales");
              break;
            case "Other Payment":
              salesData.push(parseFloat(result.OTHER_PAYMENT));
              labels.push("Other Payment");
              break;
            case "Gift Voucher Out":
              salesData.push(parseFloat(result.GIFTVOUCHER));
              labels.push("Gift Voucher Out");
              break;
            case "Paid Out":
              salesData.push(parseFloat(result.PAIDOUT));
              labels.push("Paid Out");
              break;
            case "Cash In Hand":
              salesData.push(parseFloat(result.CASHINHAND));
              labels.push("Cash In Hand");
              break;
            default:
              break;
          }
        });

        setData(result);
     
        setCashierData(cashierPointRecord);
        setSalesData(salesData.slice(2)); // Exclude company code, sales date, and net sales for charts
        setLabels(labels.slice(2)); // Exclude company code, sales date, and net sales for charts
        
        setTableData(
          record && record.length > 0
            ? record.map((rec) =>
                rearrangedLabels.map((label) => {
                  let key;
                  if (label === "Company Code") {
                    key = "COMPANY_CODE";
                  } else if (label === "Other Payment") {
                    key = "OTHER_PAYMENT";
                  }
                 else if (label === "Gift Voucher Out") {
                  key = "GIFT_VOUCHER";
                }else if (label === "Cash In Hand") {
                  key = "CASHINHAND";
                } else {
                    key = label.replace(" ", "").toUpperCase(); //the error comes because of this
                  }

                  return rec[key] ?? "--"; // Handle missing data gracefully
                })
              )
            : [salesData]
        ); // Ensure tableData is always an array of arrays
        setTableLabels(rearrangedLabels.map((label) => label)); // Include company code and sales date for table
        setLoading(false);
        
      } catch (err) {
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
    setCashierTableData([]);
    setCashierTableLabels([]);

    if (selectedRowData) {
      setSelectedRowData(null);
    }
    if (selectedRowLabels) {
      setSelectedRowLabels(null);
    }

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

    if (newFromDate !== null && newToDate !== null) {
      setSubmitted(true);
      fetchData();
    }
  };

  const handleRefresh = async () => {
    window.location.reload();
  };

  const handleRowClick = (headers, rowData) => {
    setSelectedRowData(rowData);
    setSelectedRowLabels(headers);

    const desiredOrder = [
      "COMPANY_CODE",
      // 'SALESDATE',
      "UNITNO",
      "NETSALES",
      "CASHSALES",
      "CARDSALES",
      "CREDITSALES",
      "OTHER_PAYMENT",
      "GIFT_VOUCHER",
      "PAIDOUT",
      "CASHINHAND"
    ];

    const cashierDataLabelsMapping = {
      CARDSALES: "Card Sales",
      CASHSALES: "Cash Sales",
      COMPANY_CODE: "Company Code",
      CREDITSALES: "Credit Sales",
      NETSALES: "Net Sales",
      OTHER_PAYMENT: "Other Payments",
      GIFT_VOUCHER: "Gift Voucher Out",
      // SALESDATE: 'Sale Date',
      UNITNO: "Unit Number",
      PAIDOUT: "Paid Out",
      CASHINHAND: "Cash In Hand"
    };

    const filteredData = cashierData.filter(
      (record) => record.COMPANY_CODE.trim() === rowData[0].trim()
    );

    const rearrangedData = filteredData.map((record) => {
      return desiredOrder.map((field) => {
        return record[field];
      });
    });

    if (rearrangedData.length > 0) {
      // Create custom labels based on the desiredOrder mapping
      const customLabels = desiredOrder.map(
        (field) => cashierDataLabelsMapping[field]
      );

      setCashierTableData(rearrangedData);
      setCashierTableLabels(customLabels);
    } else {
      console.log("Rearranged data is empty!");
    }
  };

  const renderPieChart = (salesData, labels, colors) => {
    if (selectedRowData && selectedRowLabels) {
      const formattedData = selectedRowData
        .slice(2, 6)
        .map((item) => Number(item.toString().replace(/,/g, "")));

      return (
        <div className="chartjs-legend w-full sm:w-full md:w-3/4 lg:w-full">
          <PieChart
            data={formattedData}
            labels={selectedRowLabels.slice(2, 6)}
            colors={colors}
            position="bottom"
          />
        </div>
      );
    } else if (salesData && salesData.length > 0) {
      return (
        <div className="chartjs-legend w-full sm:w-full md:w-3/4 lg:w-full">
          <PieChart
            data={salesData.slice(0, -3)}
            labels={labels.slice(0, -3)}
            colors={colors}
            position="bottom"
          />
        </div>
      );
    } else {
      return <p>No data available</p>;
    }
  };

  const renderBarChart = (salesData, labels, colors, title) => {
    if (selectedRowData && selectedRowLabels) {
      const formattedData = selectedRowData
        .slice(2, 6)
        .map((item) => Number(item.toString().replace(/,/g, "")));
      return (
        <div className="w-full sm:w-full md:w-3/4 lg:w-full">
          <BarChart
            data={formattedData}
            labels={selectedRowLabels.slice(2, 6)}
            colors={colors}
            title={title}
          />
        </div>
      );
    } else if (salesData && salesData.length > 0) {
      return (
        <div className="w-full sm:w-full md:w-3/4 lg:w-full">
          <BarChart
            data={salesData.slice(0, -3)}
            labels={labels.slice(0, -3)}
            colors={colors}
            title={title}
          />
        </div>
      );
    } else {
      return <p className="text-center">No data available</p>;
    }
  };

  const renderKeyValuePairs = (labels, data) => {
    const formatValue = (value) => {
      if (value === undefined || value === null) return "--";
      return value.toLocaleString();
    };

    if (selectedRowData !== null && selectedRowLabels !== null) {
      let values;
      let mappedData;
      if (selectedRowData.length === 9) {
        values = selectedRowData.slice(1, 7);
        mappedData = selectedRowLabels.slice(1, 7).map((label, index) => ({
          label,
          value: values[index],
        }));
      }
      if (selectedRowData.length === 10) {
        values = selectedRowData.slice(2, 8);
        mappedData = selectedRowLabels.slice(2, 8).map((label, index) => ({
          label,
          value: values[index],
        }));
      }

      return (
        <>
          {mappedData.map(({ label, value }, index) => (
            <div key={index} className="mb-3">
              <div
                className="flex justify-between p-4 sm:p-5 rounded-lg shadow-md text-white text-base sm:text-lg"
                style={{ backgroundColor: "#6a6867" }}
              >
                <span className="font-bold text-lg sm:text-xl">{label}:</span>
                <span className="font-bold text-lg sm:text-xl">{formatValue(value)}</span>
              </div>
            </div>
          ))}
        </>
      );
    }

    if (submitted) {
      return labels
        .filter(({ key }) => !["PAIDOUT", "CASHINHAND"].includes(key))
        .map(({ key, label }, index) => {
          const value = data[key];
          const isNetSales = key === "NETSALES";

          return (
            <div key={index} className="mb-3">
              <div
                className="flex justify-between p-4 sm:p-5 rounded-lg shadow-md text-white text-base sm:text-lg"
                style={{ backgroundColor: "#6a6867" }}
              >
                <span className="font-bold text-lg sm:text-xl">{label}:</span>
                <span className="font-bold text-lg sm:text-xl">
                  {isNetSales ? formatValue(value) : formatValue(value)}
                </span>
              </div>
            </div>
          );
        });
    }

    return labels.map(({ key, label }, index) => {
      if (["PAIDOUT", "CASHINHAND"].includes(key)) return null;
      const value = data[key];
      const isNetSales = key === "NETSALES";

      return (
        <div key={index} className="mb-3">
          <div
            className="flex justify-between p-4 sm:p-5 rounded-lg shadow-md text-white text-base sm:text-lg"
            style={{ backgroundColor: "#6a6867" }}
          >
            <span className="font-bold text-lg sm:text-xl">{label}:</span>
            <span className="font-bold text-lg sm:text-xl">
              {isNetSales ? formatValue(value) : formatValue(value)}
            </span>
          </div>
        </div>
      );
    });
  };

  const renderTable = (headers, data, onRowClick) => {
    if (headers && data && data.length > 0) {
      const firstTableData = formatData(data);

      const firstTable = (
        <div>
          <ScrollableTable
            headers={headers}
            data={firstTableData}
            onRowClick={onRowClick}
            rightAlignedColumns={table1}
          />
        </div>
      );

      let secondTable = null;
      if (cashierTableData && cashierTableLabels) {
        const secondTableData = formatData(cashierTableData);
        secondTable = (
          <div>
            <ScrollableTable
              headers={cashierTableLabels}
              data={secondTableData}
              onRowClick={onRowClick}
              rightAlignedColumns={table2}
            />
          </div>
        );
      }

      return (
        <>
          {firstTable}
          {selectedRowData && selectedRowLabels ? secondTable : null}
        </>
      );
    }

    return <p className="text-center">No data available</p>;
  };

  const companyOptions = userData? userData.map((item) => ({
        code: item.COMPANY_CODE.trim(),
        name: item.COMPANY_NAME.trim(),
  })): [];

  return (
    <div>
      <Navbar />

        <div className="container mx-auto p-6 md:p-16">
        <div className="mt-20 md:mt-14">
            <Heading text="Company Sales Dashboard" />
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
                {/* First Row - Centered Title */}
                <div className="text-center text-xl sm:text-2xl font-bold mb-4">
                  Current Company Sales
                </div>

                {/* Second Row - Checkbox on Left, Button on Right */}
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
                      Current Sales
                    </label>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 mt-4 md:mt-0 ${
                      loading ? "opacity-50 cursor-not-allowed" : ""
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
                                                 <div className="flex flex-col sm:flex-row justify-center sm:justify-end gap-4 mt-3 md:mt-6">
                                                   <button
                                                     onClick={handleSubmit}
                                                     disabled={loading}
                                                     className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 ${
                                                       loading ? "opacity-50 cursor-not-allowed" : ""
                                                     } w-full sm:w-auto`}
                                                   >
                                                     Submit
                                                   </button>
                                                   <button
                                                     onClick={handleRefresh}
                                                     disabled={loading}
                                                     className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 ${
                                                       loading ? "opacity-50 cursor-not-allowed" : ""
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
                Company Sales Summary
              </div>

              <div className="flex justify-center font-bold mt-4">
                <p>{displayDate}</p>
              </div>
            </div>
            )}
<div className="flex flex-col w-full max-w-full mx-auto mt-5">
  <div className="flex flex-col lg:flex-row w-full">
    <div className="flex flex-col w-full lg:w-1/3 p-4 sm:p-5 border border-gray-300 rounded-md shadow-md mb-4 lg:mb-0 lg:mr-5">
      {renderKeyValuePairs(rearrangedLabels.slice(1), data)}
    </div>

    <div className="flex flex-col w-full lg:w-2/3 space-y-4">
      <div className="flex flex-col sm:flex-row w-full space-y-4 sm:space-y-0 sm:space-x-3 p-4 sm:p-5 border border-gray-300 rounded-md shadow-md">
        <div className="w-full md:w-1/2 p-4 min-h-[400px]">
          {renderPieChart(salesData, labels, colors)}
        </div>
        <div className="w-full md:w-1/2 p-4 min-h-[400px]">
          {renderBarChart(salesData, labels, colors, "Sales Distribution")}
        </div>
      </div>

      <div className="flex-1 border border-gray-300 p-4 sm:p-5 rounded-md shadow-md">
        {renderTable(tableLabels, tableData, handleRowClick)}
      </div>
    </div>
  </div>
</div>
          </div>
        </div>
      
    </div>
  );
};

export default Dashboard;
