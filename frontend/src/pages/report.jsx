import React, { useEffect, useState, useContext } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import Alert from "../components/Alert";
import MultiSelectDropdown from "../components/MultiSelectDropdown";
import CircleBounceLoader from "../components/Loader";
import DatePicker from "../components/DatePicker";
import ScrollableTable from "../components/Table";
import axios from "axios";

const Report = () => {
  const { authToken } = useContext(AuthContext);
  const [alert, setAlert] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isRowClicked, setIsRowClicked] = useState(false);
  const [disable, setDisable] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [reportData, setReportData] = useState([]);
  const [reportHeaders, setReportHeaders] = useState([]);
  const [isChecked, setIsChecked] = useState(true);
  const [invoiceData, setInvoiceData] = useState([]);
  const [invoiceHeaders, setInvoiceHeaders] = useState([]);
  const [currentSale, setCurrentSale] = useState(true);

  const customLabels = [
    { key: "COMPANY_CODE", label: "Company Code" },
    { key: "SALESDATE", label: "Sales Date" },
    { key: "UNITNO", label: "Unit Number" },
    { key: "REPNO", label: "Rep Number" },
    { key: "INVOICENO", label: "Invoice Number" },
    { key: "PRODUCT_NAME", label: "Payment Type" },
    { key: "AMOUNT", label: "Amount" },
  ];

  const invoiceHeadings = [
    { key: "INVOICENO", label: "Invoice Number" },
    { key: "PRODUCT_CODE", label: "Product Code" },
    { key: "PRODUCT_NAME", label: "Product Name" },
    { key: "QTY", label: "Quantity" },
    { key: "COSTPRICE", label: "Cost Price" },
    { key: "UNITPRICE", label: "Unit Price" },
    { key: "DISCOUNT", label: "Discount" },
    { key: "AMOUNT", label: "Amount" },
  ];

  const rightAlignedColumns = [6];
  const rightAlignedColumnsInvoice = [3, 4, 5, 6, 7];

  const token = localStorage.getItem("authToken");

  const fetchDashboardData = async () => {
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
        setUserData(response.data.userData);
      } else {
        setAlert({
          message: "Companies not found",
          type: "error",
        });
        setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      await fetchDashboardData();
      setCurrentSale(true);
    };

    fetchDashboard();

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
  }, [isChecked]);

  // Separate effect to watch for `userData` changes and send company codes
  useEffect(() => {
    if (userData && userData.length > 0) {
      const companyCodes = userData.map((item) => item.COMPANY_CODE.trim());
      salesReport(currentSale, isRowClicked, companyCodes, "");
    }
  }, [userData]);

  const salesReport = async (state, rowClick, companyCodes, invoiceNo) => {
    setDisable(true);
    const token = localStorage.getItem("authToken");
    const currentDate = new Date().toISOString().split("T")[0];

    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}report-data`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            state: state,
            rowClicked: rowClick,
            companyCodes:
              selectedOptions.length > 0
                ? selectedOptions.map((option) => option.code)
                : companyCodes,
            fromDate: selectedDates.fromDate,
            toDate: selectedDates.toDate,
            currentDate,
            invoiceNo,
          },
        }
      );

      if (response.data.message === "Data found") {
        const data = response.data.reportData;
        const invoiceData = response.data.invoiceData;
        const invoiceDataState = response.data.invoiceDataState;

        if (
          invoiceDataState === true &&
          String(invoiceDataState).toLowerCase() === "true" &&
          invoiceData &&
          invoiceData.length !== 0
        ) {
          const invoiceHeaders = invoiceHeadings.map(({ label }) => label);

          const formattedInvoiceData = invoiceData.map((item) =>
            invoiceHeadings.map(({ key }) => {
              if (!item[key]) return ""; // Handle missing keys
              if (
                key === "AMOUNT" ||
                key === "COSTPRICE" ||
                key === "UNITPRICE" ||
                key === "DISCOUNT"
              ) {
                return Number(item[key]).toFixed(2);
              }
              if (key === "QTY") {
                return Number(item[key]).toFixed(3);
              }
              return item[key];
            })
          );

          setInvoiceHeaders(invoiceHeaders);
          setInvoiceData(formattedInvoiceData);
        } else if (
          invoiceDataState === true &&
          String(invoiceDataState).toLowerCase() === "true" &&
          invoiceData &&
          invoiceData.length === 0
        ) {
          setAlert({
            message: "No invoice records available",
            type: "error",
          });
          setTimeout(() => setAlert(null), 3000);
          setInvoiceData([]);
          setInvoiceHeaders([]);
          setDisable(false);
        } else if (data && data.length !== 0) {
          const headers = customLabels.map(({ label }) => label);

          const formattedData = data.map((item) =>
            customLabels.map(({ key }) => {
              if (!item[key]) return ""; // Handle missing keys
              if (key === "SALESDATE") {
                return item[key].split("T")[0];
              }
              if (key === "AMOUNT") {
                return Number(item[key]).toFixed(2);
              }
              return item[key];
            })
          );

          setReportHeaders(headers);
          setReportData(formattedData);
          setDisable(false);
        } else if (data && data.length === 0) {
          setAlert({
            message: "No records available",
            type: "error",
          });
          setTimeout(() => setAlert(null), 3000);
          setReportData([]);
          setReportHeaders([]);
          setInvoiceData([]);
          setInvoiceHeaders([]);
          setDisable(false);
        } else {
          setAlert({
            message: "No records available",
            type: "error",
          });
          setTimeout(() => setAlert(null), 3000);
        }
      } else {
        setAlert({
          message: response.data.message || "Invoice data not found",
          type: "error",
        });
        setTimeout(() => setAlert(null), 3000);
      }
      // if (response.data.invoiceData && response.data.invoiceData.length !== 0) {
      // const invoiceData = response.data.invoiceData;

      // }

      setDisable(false);
    } catch (error) {
      setDisable(false);
      setAlert({
        message: error || "Error occured",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);

      console.error("Error sending company codes:", error);
    }
  };

  // Redirect to login if the user is not authenticated
  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const handleDateChange = (dates) => {
    setSelectedDates(dates);
  };

  const handleRefresh = async () => {
    window.location.reload();
  };

  const handleDropdownChange = (options) => {
    setSelectedOptions(options);
  };

  //   const fetchData = async (invoiceNo) => {
  //     setDisable(true);
  //     const token = localStorage.getItem("authToken");
  //     try {
  //       const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}report-data`, {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //          params: {
  //         fromDate: selectedDates.fromDate,
  //         toDate: selectedDates.toDate,
  //         invoiceNo: invoiceNo,
  //         selectedOptions: selectedOptions.map((option) => option.code),
  //       },
  //       });
  // console.log("Raw response data (fetchData):", response.data); // Added for debugging
  //       if (response.data.message === "Invoice data found") {
  //         const data = response.data.reportData;

  //         if (data.length === 0) {
  //           setAlert({
  //             message: "No records available",
  //             type: "error",
  //           });
  //           setTimeout(() => setAlert(null), 3000);
  //         }

  //         const headers = customLabels.map(({ label }) => label);

  //        const formattedData = data.map((item) =>
  //         customLabels.map(({ key }) => {
  //           if (!item[key]) return ""; // Handle missing keys
  //           if (key === "SALESDATE") {
  //             return item[key].split("T")[0];
  //           }
  //           if (key === "AMOUNT") {
  //             return Number(item[key]).toFixed(2);
  //           }
  //           return item[key];
  //         })
  //       );

  //         setReportHeaders(headers);
  //         setReportData(formattedData);
  //         setDisable(false);
  //       }
  //       else{

  //           setAlert({
  //             message: "No records available",
  //             type: "error",
  //           });
  //           setTimeout(() => setAlert(null), 3000);

  //       }
  //       if (response.data.invoiceData.length !== 0) {
  //         const invoiceData = response.data.invoiceData;

  //       console.log("Raw invoiceData from backend (fetchData):", invoiceData); // Added for debugging

  //       const invoiceHeaders = invoiceHeadings.map(({ label }) => label);

  //       const formattedInvoiceData = invoiceData.map((item) =>
  //         invoiceHeadings.map(({ key }) => {
  //           if (!item[key]) return ""; // Handle missing keys
  //           if (
  //             key === "AMOUNT" ||
  //             key === "COSTPRICE" ||
  //             key === "UNITPRICE" ||
  //             key === "DISCOUNT"
  //           ) {
  //             return Number(item[key]).toFixed(2);
  //           }
  //           if (key === "QTY") {
  //             return Number(item[key]).toFixed(3);
  //           }
  //           return item[key];
  //         })
  //       );

  //       console.log("Formatted invoiceData (fetchData):", formattedInvoiceData); // Added for debugging
  //         setInvoiceHeaders(invoiceHeaders);
  //         setInvoiceData(formattedInvoiceData);
  //       }

  //       setDisable(false);
  //     } catch (err) {
  //       setAlert({
  //         message: "Error sending data",
  //         type: "error",
  //       });
  //       setTimeout(() => setAlert(null), 3000);
  //       setDisable(false);
  //     }
  //   };

  const handleRowClick = (headers, rowData) => {
    setInvoiceData([]);
    setIsRowClicked(true);

    const invoiceIndex = headers.indexOf("Invoice Number");

    salesReport(false, true, selectedOptions, rowData[invoiceIndex]);
    // if (currentSale) {
    //   console.log('1')
    //   if (userData && userData.length > 0) {
    //      console.log('2')
    //     const companyCodes = userData.map((item) => item.COMPANY_CODE.trim());
    //     salesReport(companyCodes, rowData[invoiceIndex]);
    //   }
    // }
    // else if (invoiceIndex !== -1) {
    //    console.log('3')
    //   fetchData(rowData[invoiceIndex]);
    // }
  };

  const rowClick = () => {
    console.log("Row Clicked");
  };

  const handleOldData = async () => {
    setReportData([]);
    setInvoiceData([]);
    setCurrentSale(false);
  };

  const handleCheckboxChange = () => {
    if (!isChecked) {
      handleOldData();
    }
    setIsChecked((prevState) => !prevState); // Toggle the checkbox state
  };

  const handleSubmit = async () => {
    setReportData([]);
    setInvoiceData([]);

    let valid = true;
    if (selectedDates.fromDate > selectedDates.toDate) {
      valid = false;
      setAlert({
        message: "Please check the selected date range",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    }

    if (selectedOptions.length === 0) {
      valid = false;
      setAlert({
        message: "Please select the company",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    }
    if (!selectedDates.fromDate || !selectedDates.toDate) {
      valid = false;
      setAlert({
        message: "Please select the date range",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    }
    if (valid) {
      const newRowClicked = false;
      const newSaleState = !currentSale; // Toggle state

      setIsRowClicked(newRowClicked);
      setCurrentSale(newSaleState);

      salesReport(newSaleState, isRowClicked, selectedOptions, "");
    }
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
        {/* <div className="max-w-8xl mx-auto"> */}
        <div className="mt-14">
          <Heading text="Invoice Wise Report" />
        </div>

        <div className="mt-4">
          {alert && (
            <Alert
              message={alert.message}
              type={alert.type}
              onClose={() => setAlert(null)}
            />
          )}
        </div>

        {currentSale && isChecked && (
          <div
            className="bg-gray-200 p-4 rounded-lg shadow-md mt-8"
            style={{ backgroundColor: "#d8d8d8" }}
          >
            {/* First Row - Centered Title */}
            <div className="text-center text-xl sm:text-2xl font-bold mb-4">
              Invoice Report
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
                  Current Invoice Report
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
        )}

        {!isChecked && (
          <div
            className="bg-white p-4 sm:p-6 mt-6 rounded-lg shadow-md mt-10"
            style={{ backgroundColor: "#d8d8d8" }}
          >
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

        {reportData.length > 0 && (
          <div className="mt-6">
            <ScrollableTable
              headers={reportHeaders}
              data={reportData}
              onRowClick={handleRowClick}
              rightAlignedColumns={rightAlignedColumns}
            />
          </div>
        )}

        {invoiceData.length > 0 && (
          <div className="mt-6">
            <ScrollableTable
              headers={invoiceHeaders}
              data={invoiceData}
              onRowClick={rowClick}
              rightAlignedColumns={rightAlignedColumnsInvoice}
            />
          </div>
        )}
        {/* </div> */}
      </div>
    </div>
  );
};

export default Report;
