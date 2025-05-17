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
import { FadeLoader } from "react-spinners";

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
console.log("Response from API:", response.data.cashierPointRecord.length);
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

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const handleSidebarToggle = (isOpen) => {
    setIsSidebarOpen(isOpen);
  };

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
        <div className="w-1/2 md:w-3/4 lg:w-100 mx-auto">
          <PieChart
            data={formattedData}
            labels={selectedRowLabels.slice(2, 6)}
            colors={colors}
            position="right"
          />
        </div>
      );
    } else if (salesData && salesData.length > 0) {
      return (
        <div className="w-1/2 md:w-3/4 lg:w-100 mx-auto">
          <PieChart
            data={salesData.slice(0, -3)}
            labels={labels.slice(0, -3)}
            colors={colors}
            position="right"
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
        <BarChart
          data={formattedData}
          labels={selectedRowLabels.slice(2, 6)}
          colors={colors}
          title={title}
        />
      );
    } else if (salesData && salesData.length > 0) {
      return (
        <BarChart
          data={salesData.slice(0, -3)}
          labels={labels.slice(0, -3)}
          colors={colors}
          title={title}
        />
      );
    } else {
      return <p>No data available</p>;
    }
  };

  const renderKeyValuePairs = (labels, data) => {
    // Function to format numbers with thousands separator
    const formatValue = (value) => {
      if (value === undefined || value === null) return "--";
      return value.toLocaleString(); // Format with commas
    };

    // Case 1: If a row is selected and the submit button has NOT been pressed
    if (selectedRowData !== null && selectedRowLabels !== null) {

      // const rowLabels = selectedRowLabels.concat("Gift Voucher Out");
      let values;
      let mappedData
      if (selectedRowData.length === 9) {
        values = selectedRowData.slice(1, 7); // Ignore first two indices (custom logic)
      mappedData = selectedRowLabels.slice(1,7).map((label, index) => ({
        label,
        value: values[index], // Map each label to its corresponding value
      }));
      }
      if (selectedRowData.length === 10) {
        values = selectedRowData.slice(2, 8); // Ignore first two indices (custom logic)
      mappedData = selectedRowLabels.slice(2,8).map((label, index) => ({
        label,
        value: values[index], // Map each label to its corresponding value
      }));
      
      }
      
      return (
        <>
          {mappedData.map(({ label, value }, index) => (
            <div key={index} className="mb-3">
              <div
                className="flex justify-between p-5 rounded-lg shadow-md text-white text-lg"
                style={{ backgroundColor: "#6a6867" }}
              >
                <span className="font-bold text-xl">{label}:</span>
                <span className="font-bold text-xl">{formatValue(value)}</span>
              </div>
            </div>
          ))}
        </>
      );
    }

    // Case 2: If the submit button is pressed, always use `data` and `labels`
    if (submitted) {
      return labels
  .filter(({ key }) => !["PAIDOUT", "CASHINHAND"].includes(key))
  .map(({ key, label }, index) => {
    const value = data[key];
    const isNetSales = key === "NETSALES";

    return (
      <div key={index} className="mb-3">
        <div
          className="flex justify-between p-5 rounded-lg shadow-md text-white text-lg"
          style={{ backgroundColor: "#6a6867" }}
        >
          <span className="font-bold text-xl">{label}:</span>
          <span className="font-bold text-xl">
            {isNetSales ? formatValue(value) : formatValue(value)}
          </span>
        </div>
      </div>
    );
  });

    }

    // Case 3: If no row is selected, use `data` and `labels` as the default
    return labels.map(({ key, label }, index) => {
      if (["PAIDOUT", "CASHINHAND"].includes(key)) return null;
    
      const value = data[key];
      const isNetSales = key === "NETSALES";
    
      return (
        <div key={index} className="mb-3">
          <div
            className="flex justify-between p-5 rounded-lg shadow-md text-white text-lg"
            style={{ backgroundColor: "#6a6867" }}
          >
            <span className="font-bold text-xl">{label}:</span>
            <span className="font-bold text-xl">
              {isNetSales ? formatValue(value) : formatValue(value)}
            </span>
          </div>
        </div>
      );
    });
    
  };


  const renderTable = (headers, data, onRowClick) => {
    if (headers && data && data.length > 0) {
      // Sanitize and format data
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
  
    return <p>No data available</p>;
  };
  
  const displayCompany = () => {
    if (selectedRowData) {
      const selectedOption = selectedOptions.find(
        (option) =>
          String(selectedRowData[0]).trim() === String(option.code).trim()
      );

      return (
        <div>
          {/* Display the name of the matching option */}
          {selectedOption ? (
            <span>{selectedOption.name}</span>
          ) : (
            <span>No matching company found</span>
          )}
        </div>
      );
    } else if (submitted && selectedOptions.length > 0) {
      return (
        <>
          {/* <div>{selectedOptions.map((option) => option.name).join(", ")}</div> */}
          <div>Company Sales Summary</div>
        </>
      );
    } else {
      // return <div>{firstOption.map((option) => option.name).join(", ")}</div>;
      return <div>Sales Summary of all Companies</div>;
    }
  };

  const companyOptions = userData? userData.map((item) => ({
        code: item.COMPANY_CODE.trim(),
        name: item.COMPANY_NAME.trim(),
  })): [];

  return (
    <div>
      <Navbar />

      <div className="flex">
        {/* Sidebar */}

        {/* <div
        className="sidebar bg-gradient-to-t from-[#ce521a] to-[#000000] text-white shadow-md fixed top-24 left-0 z-40"
        style={{
          height: "calc(100vh - 96px)", // Sidebar height fills remaining screen below Navbar
          width: isSidebarOpen ? "15rem" : "4rem", // Adjust width based on state
          transition: "width 0.3s",
        }}
      >
        <Sidebar onToggle={handleSidebarToggle} />
      </div> */}

        {/* Page Content */}
        <div
          className={`transition-all duration-300 flex-1 p-10`}
          style={{
            marginLeft: isSidebarOpen ? "15rem" : "4rem", // Space for sidebar
            marginTop: "96px", // Space for Navbar
          }}
        >
          <div className="mt-5 ml-[-50px]">
            <Heading text="Company Sales Dashboard" />
          </div>
          <div className="mt-10 ml-[-50px]">
            {alert && (
              <Alert
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert(null)}
              />
            )}
            <div
              className="bg-white p-5 rounded-md shadow-md"
              style={{ backgroundColor: "#d8d8d8" }}
            >
              {isChecked ? (
                <div className="flex flex-col md:flex-row items-center w-full gap-4 ">
                  {/* First section: Checkbox */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={handleCheckboxChange}
                      id="checkbox"
                    />
                    <label htmlFor="checkbox" className="ml-3">
                      <strong>Current Company Sales</strong>
                    </label>
                  </div>

                  {/* Second section: Sales Summary */}
                  <div className="flex font-bold mb-3 text-2xl flex-grow justify-center">
                    Company Sales Summary
                  </div>

                  {/* Third section: Submit Button */}
                  <div>
                    <button
                      onClick={handleRefresh}
                      className="bg-black text-white px-4 py-2 rounded-md shadow-md hover:bg-gray-800"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
                  <DatePicker
                    label="Select Date Range:"
                    onDateChange={handleDateChange}
                  />
                  <MultiSelectDropdown
                    label="Select Company:"
                    options={companyOptions}
                    onDropdownChange={handleDropdownChange}
                    selected={selectedOptions}
                  />
                  <div className="space-x-4 ml-12 md:ml-0 md:mt-0 mt-4">
                    <button
                      onClick={handleSubmit}
                      className="bg-black text-white px-4 py-2 rounded-md shadow-md hover:bg-gray-800"
                    >
                      Submit
                    </button>
                    <button
                      onClick={handleRefresh}
                      className="bg-black text-white px-4 py-2 rounded-md shadow-md hover:bg-gray-800"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              className="bg-white p-5 rounded-md shadow-md mt-5 mb-5"
              style={{ backgroundColor: "#d8d8d8" }}
            >
              <div className="flex justify-start font-bold mb-3">
                <p>{displayDate}</p>
              </div>

              {firstOption && (
                <div className="flex justify-center text-2xl font-bold text-black">
                  {displayCompany()}
                </div>
              )}
            </div>

            <div
              className="flex flex-col lg:flex-row bg-white p-5 rounded-md shadow-md w-full"
              style={{ backgroundColor: "#d8d8d8" }}
            >
              <div className="flex flex-col lg:w-1/3 w-full bg-white p-5 rounded-md shadow-md mb-5 lg:mb-0 mr-5">
                {renderKeyValuePairs(rearrangedLabels.slice(1), data)}
              </div>

              <div className="flex flex-col lg:w-3/4 w-full space-y-5 ">
                <div className="flex flex-col lg:flex-row w-full space-y-4 lg:space-y-0 lg:space-x-3 bg-white p-5 rounded-md shadow-md">
                  <div className="w-full sm:w-2/3 lg:w-2/5 p-4 lg:mb-0">
                    {renderPieChart(salesData, labels, colors)}
                  </div>
                  <div className="w-full sm:w-1/3 lg:w-3/5 p-4 lg:mb-0">
                    {renderBarChart(
                      salesData,
                      labels,
                      colors,
                      "Sales Distribution"
                    )}
                  </div>
                </div>

                <div className="flex-1 bg-white p-5 rounded-md shadow-md">
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
