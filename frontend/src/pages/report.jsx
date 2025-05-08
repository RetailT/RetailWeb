import React, { useEffect, useState, useContext } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import Alert from "../components/Alert";
import MultiSelectDropdown from "../components/MultiSelectDropdown";
import DatePicker from "../components/DatePicker";
import ScrollableTable from "../components/Table";
import axios from "axios";
import { FadeLoader } from "react-spinners";

const Report = () => {
  const { authToken } = useContext(AuthContext);
  const [alert, setAlert] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [reportData, setReportData] = useState([]);
  const [reportHeaders, setReportHeaders] = useState([]);
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
    { key: "PRODUCT_NAME", label: "Product Name" },
    { key: "QTY", label: "Quantity" },
    { key: "COSTPRICE", label: "Cost Price" },
    { key: "UNITPRICE", label: "Unit Price" },
    { key: "DISCOUNT", label: "Discount" },
    { key: "AMOUNT", label: "Amount" },
  ];

  const rightAlignedColumns = [6];
  const rightAlignedColumnsInvoice = [2, 3, 4, 5, 6];

  const token = localStorage.getItem("authToken");

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}companies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUserData(response.data.userData);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchDashboardData();
      setCurrentSale(true);
    };

    fetchData();
  }, []);

  // Separate effect to watch for `userData` changes and send company codes
  useEffect(() => {
    if (userData && userData.length > 0) {
      const companyCodes = userData.map((item) => item.COMPANY_CODE.trim());
      currentSalesReport(companyCodes);
    }
  }, [userData]);

  const currentSalesReport = async (companyCodes, invoiceNo) => {
    setLoading(true);
    const token = localStorage.getItem("authToken");
    const currentDate = new Date().toISOString().split("T")[0];

    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}current-report-data`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          companyCodes: companyCodes, // this will send as ?companyCodes[]=...&companyCodes[]=...
          currentDate: currentDate,
          invoiceNo,
          invoiceNo,
        },
      });
      console.log("Company codes sent successfully");

      if (response.data.message === "Invoice data found") {
        const data = response.data.reportData;

        if (data.length === 0) {
          setAlert({
            message: "No records available",
            type: "error",
          });
          setTimeout(() => setAlert(null), 3000);
        }
        const headers = customLabels.map(({ label }) => label);

        const formattedData = data.map((item) =>
          customLabels.map(({ key }) => {
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
        setLoading(false);
      }
      if (response.data.invoiceData.length !== 0) {
        const invoiceData = response.data.invoiceData;

        const invoiceHeaders = invoiceHeadings.map(({ label }) => label);

        const formattedInvoiceData = invoiceData.map((item) =>
          invoiceHeadings.map(({ key }) => {
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
      }

      setLoading(false);
    } catch (error) {
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

  const fetchData = async (invoiceNo) => {
    setLoading(true);
    const token = localStorage.getItem("authToken");
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}report-data`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          fromDate: selectedDates.fromDate,
          toDate: selectedDates.toDate,
          invoiceNo: invoiceNo,
          selectedOptions: selectedOptions.map((option) => option.code),
        },
      });

      if (response.data.message === "Invoice data found") {
        const data = response.data.reportData;

        if (data.length === 0) {
          setAlert({
            message: "No records available",
            type: "error",
          });
          setTimeout(() => setAlert(null), 3000);
        }

        const headers = customLabels.map(({ label }) => label);

        const formattedData = data.map((item) =>
          customLabels.map(({ key }) => {
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
        setLoading(false);
      }
      else{
        
          setAlert({
            message: "No records available",
            type: "error",
          });
          setTimeout(() => setAlert(null), 3000);
        
      }
      if (response.data.invoiceData.length !== 0) {
        const invoiceData = response.data.invoiceData;

        const invoiceHeaders = invoiceHeadings.map(({ label }) => label);

        const formattedInvoiceData = invoiceData.map((item) =>
          invoiceHeadings.map(({ key }) => {
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
      }

      setLoading(false);
    } catch (err) {
      setAlert({
        message: "Error sending data",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
      setLoading(false);
    }
  };

  const handleRowClick = (headers, rowData) => {
    setInvoiceData([]);
    const invoiceIndex = headers.indexOf("Invoice Number");
    if (invoiceIndex !== -1) {
      fetchData(rowData[invoiceIndex]);
    }
    if (currentSale) {
      if (userData && userData.length > 0) {
        const companyCodes = userData.map((item) => item.COMPANY_CODE.trim());
        currentSalesReport(companyCodes, rowData[invoiceIndex]);
      }
    }
  };

  const rowClick = () => {
    console.log("Row Clicked");
  };

  const handleOldData = async () => {
    setReportData([]);
    setInvoiceData([]);
    setCurrentSale(false);
    
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
      fetchData();
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
      <Navbar />
      <div className="flex">
        <div className="flex-1 p-10 ml-16 mt-10 mr-10 ">
          <div className="mt-8 ml-[-50px]">
            <Heading text="Invoice Wise Report" />
          </div>
          <div className="mt-5 ml-[-50px]">
            {alert && (
              <Alert
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert(null)}
              />
            )}

            {currentSale && (
              <div
                className="bg-white p-5 mt-10 rounded-md shadow-md"
                style={{ backgroundColor: "#d8d8d8" }}
              >
                <div className="flex justify-center">
                  <button
                    onClick={handleOldData}
                    disabled={loading}
                    className={`bg-black text-white px-4 py-2 rounded-md shadow-md hover:bg-gray-800 ${
                      loading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Old Data
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className={`bg-black text-white px-4 py-2 rounded-md shadow-md hover:bg-gray-800 ml-5 ${
                      loading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            )}

            {!currentSale && (
              <div
                className="bg-white p-5 mt-10 rounded-md shadow-md"
                style={{ backgroundColor: "#d8d8d8" }}
              >
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
                      disabled={loading}
                      className={`bg-black text-white px-4 py-2 rounded-md shadow-md hover:bg-gray-800 ${
                        loading ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Submit
                    </button>
                    <button
                      onClick={handleRefresh}
                      disabled={loading}
                      className={`bg-black text-white px-4 py-2 rounded-md shadow-md hover:bg-gray-800 ml-5 ${
                        loading ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="mt-10 flex justify-center items-center">
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
            )}

            {reportData.length > 0 && (
              <div className="mt-10">
                <ScrollableTable
                  headers={reportHeaders}
                  data={reportData}
                  onRowClick={handleRowClick}
                  rightAlignedColumns={rightAlignedColumns}
                />
              </div>
            )}

            {invoiceData.length > 0 && (
              <div className="mt-14">
                <ScrollableTable
                  headers={invoiceHeaders}
                  data={invoiceData}
                  onRowClick={rowClick}
                  rightAlignedColumns={rightAlignedColumnsInvoice}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;
