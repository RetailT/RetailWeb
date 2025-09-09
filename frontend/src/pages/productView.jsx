import { useState, useEffect, useContext, useRef } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import toast, { Toaster } from "react-hot-toast";
import { Navigate } from "react-router-dom";
import Navbar from "../components/NavBar";
import { AuthContext } from "../AuthContext";
import Table from "../components/EditableTable";
import DatePicker from "../components/DatePicker";
import Heading from "../components/Heading";
import Alert from "../components/Alert";
import { CameraOff } from "lucide-react";
import axios from "axios";

function App() {
  const { authToken } = useContext(AuthContext);
  const [cameraError, setCameraError] = useState(null);
  const [codeError, setCodeError] = useState("");
  const [code, setCode] = useState("");
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [alert, setAlert] = useState(null);
  const [productData, setProductData] = useState({});
  const [disable, setDisable] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [priceTableData, setPriceTableData] = useState([]);
  const [stockTableData, setStockTableData] = useState([]);
  const [colorWiseTableData, setColorWiseTableData] = useState([]);
  const [priceHeaders, setPriceHeaders] = useState([]);
  const [colorWiseHeaders, setColorWiseHeaders] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [salesHeaders, setSalesHeaders] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [stockHeaders, setStockHeaders] = useState([]);
  const [repUserFilter, setRepUserFilter] = useState("");
  const [isData, setIsData] = useState(false);
  const codeRef = useRef(null);
  const streamRef = useRef(null);
  const token = localStorage.getItem("authToken");

  const [inputValue, setInputValue] = useState("");
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [names, setNames] = useState([]);

  const getCameraStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: "environment" },
        },
      });
      streamRef.current = stream;
      setHasCameraPermission(true);
      console.log("Camera stream obtained", stream);
      // You can attach stream to a video element if needed
    } catch (error) {
      console.error("Camera Error:", error);
      setCameraError("Camera access denied or not available.");
      setHasCameraPermission(false);
    }
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      console.log("Camera stream stopped");
    }
  };

  useEffect(() => {
    if (!token) {
      console.error("No token found in localStorage");
      return;
    }
    if (scannerEnabled) {
      getCameraStream();
    } else {
      stopCameraStream();
    }
    requestProductNames();
  }, [scannerEnabled]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const requestProductNames = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}product-names`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.message === "Product names found") {
        const productNames = response.data.names.map(
          (item) => item.PRODUCT_NAMELONG
        );
        setNames(productNames);
      }
      else{
        setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setAlert({
        message: err.response?.data?.message || "Product name finding failed",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.length > 0) {
      const filtered = names.filter((name) =>
        name.toLowerCase().startsWith(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (name) => {
    setInputValue(name);
    setShowSuggestions(false);
    requestData("", code, name);
  };

  const handleDateChange = (dates) => {
    setSelectedDates(dates);
  };

  const requestData = async (mode, data, inputValue) => {
    
    setSalesData([]);
    setSalesHeaders([]);
    try {
      setDisable(true);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}product-view`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            data: data,
            inputValue: inputValue,
            mode: mode,
          },
        }
      );
      if (response.data.message === "Item Found Successfully") {
        setCode("");
        setInputValue("");
        setProductData(response.data.result);
        setIsData(true);
        const stockData = response.data.stockData;
        const companies = response.data.companies;
        const prices = response.data.prices;
        const companyStockData = response.data.companyStockData;
        const colorWiseData = response.data.colorWiseData;

        // Step 1: Merge each stock item with its company name
        const mergedData = stockData.map((stockItem) => {
          const matchingCompany = companies.find(
            (company) =>
              company.COMPANY_CODE.trim() === stockItem.COMPANY_CODE.trim()
          );

          return {
            ...stockItem,
            COMPANY_NAME: matchingCompany?.COMPANY_NAME || "Unknown",
          };
        });

        const priceMergedData = prices.map((stockItem) => {
          const matchingCompany = companies.find(
            (company) =>
              company.COMPANY_CODE.trim() === stockItem.COMPANY_CODE.trim()
          );

          return {
            ...stockItem,
            COMPANY_NAME: matchingCompany?.COMPANY_NAME || "Unknown",
          };
        });

        const stockMergedData = companyStockData.map((stockItem) => {
          const matchingCompany = companies.find(
            (company) =>
              company.COMPANY_CODE.trim() === stockItem.COMPANY_CODE.trim()
          );

          return {
            ...stockItem,
            COMPANY_NAME: matchingCompany?.COMPANY_NAME || "Unknown",
          };
        });

        const stockTableDataArray = stockMergedData.map((item) => [
          item.COMPANY_CODE.trim(),
          item.COMPANY_NAME,
          item.STOCK,
        ]);

        setStockTableData(stockTableDataArray);

        const customOrder = [
          "COMPANY_CODE",
          "COMPANY_NAME",
          "PRODUCT_CODE",
          "QTY",
        ];
        const customHeadingMap = {
          COMPANY_CODE: "Company Code",
          COMPANY_NAME: "Company Name",
          PRODUCT_CODE: "Product Code",
          QTY: "Quantity",
        };

        const customPriceOrder = [
          "COMPANY_CODE",
          "COMPANY_NAME",
          "PRODUCT_CODE",
          "COST_PRICE",
          "UNIT_PRICE",
          "WPRICE",
          "MIN_PRICE",
        ];
        const customPriceHeadingMap = {
          COMPANY_CODE: "Company Code",
          COMPANY_NAME: "Company Name",
          PRODUCT_CODE: "Product Code",
          COST_PRICE: "Cost Price",
          UNIT_PRICE: "Unit Price",
          WPRICE: "Wholesale Price",
          MIN_PRICE: "Minimum Price",
        };

        const customStockOrder = ["COMPANY_CODE", "COMPANY_NAME", "STOCK"];

        const customStockHeadingMap = {
          COMPANY_CODE: "Company Code",
          COMPANY_NAME: "Company Name",
          STOCK: "Stock",
        };

        const colorWiseHeadings = [
          "SERIALNO",
          "STOCK",
          "COLORCODE",
          "SIZECODE",
        ];

        const colorWiseHeadingMap = {
          SERIALNO: "Serial No",
          STOCK: "Stock",
          COLORCODE: "Color Code",
          SIZECODE: "Size Code",
        };

        const customHeaders = customOrder.map(
          (key) => customHeadingMap[key] || key
        );
        setHeaders(customHeaders);

        const customPriceHeaders = customPriceOrder.map(
          (key) => customPriceHeadingMap[key] || key
        );
        setPriceHeaders(customPriceHeaders);

        const customStockHeaders = customStockOrder.map(
          (key) => customStockHeadingMap[key] || key
        );
        setStockHeaders(customStockHeaders);

        const colorHeaders = colorWiseHeadings.map(
          (key) => colorWiseHeadingMap[key] || key
        );
        setColorWiseHeaders(colorHeaders);

        const finalArray = mergedData.map((item) =>
          customOrder.map((key) => {
            const value = item[key];
            if (key === "QTY" && typeof value === "number") {
              return value.toFixed(3); // format to 3 decimal places
            }
            return value;
          })
        );

        setTableData(finalArray);

        const finalPriceArray = priceMergedData.map((item) =>
          customPriceOrder.map((key) => {
            const value = item[key];
            if (
              (key === "COST_PRICE" ||
                key === "UNIT_PRICE" ||
                key === "WPRICE" ||
                key === "MIN_PRICE") &&
              typeof value === "number"
            ) {
              return value.toFixed(2); // format to 3 decimal places
            }

            return value;
          })
        );

        setPriceTableData(finalPriceArray);

        const colorWiseTableDataFormatted = colorWiseData.map((item) => [
          item.SERIALNO,
          item.STOCK,
          item.COLORCODE,
          item.SIZECODE,
        ]);

        setColorWiseTableData(colorWiseTableDataFormatted);

        setAlert({
          message: "Product Found Successfully",
          type: "success",
        });
        setTimeout(() => setAlert(null), 3000);
        setDisable(false);
      }
      else{
        setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setIsData(false);

      setAlert({
        message: err.response?.data?.message || "Item finding failed",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
      setDisable(false);
    }
  };

  const requestSalesData = async (code) => {
    try {
      setDisable(true);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}product-view-sales`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            code: code,
            fromDate: selectedDates.fromDate,
            toDate: selectedDates.toDate,
          },
        }
      );
      if (response.data.message === "Item Found Successfully") {
        const salesData = response.data.salesData;

        if(!Array.isArray(salesData) || salesData.length === 0){
          setSalesData([]);
          setSalesHeaders([]);
          setAlert({
            message: "No Sales Found for the selected date range",
            type: "error",  
          });
          setTimeout(() => setAlert(null), 3000);
          setDisable(false);
          return;
        }
        
        const headings = [
          "SALESDATE",
          "COMPANY_CODE",
          // "PRODUCT_CODE",
          "COST_PRICE",
          "UNIT_PRICE",
          "QTY",
          "DISCOUNT",
          "AMOUNT",
          
        ];

        const headingMap = {
          SALESDATE: "Sales Date",
          COMPANY_CODE: "Company Code",
          // PRODUCT_CODE: "Product Code",
          COST_PRICE: "Cost Price",
          UNIT_PRICE: "Unit Price",
          QTY: "Quantity",
          DISCOUNT: "Discount",
          AMOUNT: "Amount",
        };

        const headers = headings.map((key) => headingMap[key] || key);
        setSalesHeaders(headers);

        const tableDataFormatted = salesData.map((item) => [
          item.SALESDATE.split("T")[0],
          item.COMPANY_CODE,
          // item.PRODUCT_CODE,
          item.COST_PRICE,
          item.UNIT_PRICE,
          item.QTY,
          item.DISCOUNT,
          item.AMOUNT,
        ]);

        setSalesData(tableDataFormatted);

        setAlert({
          message: "Sales Found Successfully",
          type: "success",
        });
        setTimeout(() => setAlert(null), 3000);
        setDisable(false);
      }
      else{
        setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setIsData(false);

      setAlert({
        message: err.response?.data?.message || "Sales Finding Failed",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
      setDisable(false);
    }
  };

  const handleScan = (err, result) => {
    if (err) {
      // Only show actual issues, ignore scanning misses
      if (
        err.message?.includes("No MultiFormat Readers") ||
        err.name === "NotFoundException"
      ) {
        return; // Expected: no readable code in the current frame
      }

      console.warn("Scanner Error:", err);
      toast.error("Scanner encountered an issue.");
      return;
    }

    if (result) {
      const beep = new Audio(
        "https://www.myinstants.com/media/sounds/beep.mp3"
      );
      beep.play().catch((error) => console.error("Beep sound error:", error));

      setCode("");
      toast.success(`Product scanned: ${result.text}`);
      requestData("scan", result.text);
    }
  };

  let valid = true;
  const handleSubmit = async (e) => {
    e.preventDefault();
    setCodeError("");

    if (!code && !inputValue) {
      setCodeError("Code or name is required.");
      valid = false;
    }
    if (valid) {
      requestData("", code, inputValue);
    }
  };

  const handleSalesSubmit = async (e) => {
    e.preventDefault();
    
    if (
      !selectedDates ||
      selectedDates.fromDate === "" ||
      selectedDates.toDate === ""
    ) {
      setAlert({
        message: "Please select dates",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
      setDisable(false);
      valid = false;
    }
    if (valid && productData.PRODUCT_CODE !== "") {
      requestSalesData(productData.PRODUCT_CODE);
    }
  };

  return (
    <div>
      <Navbar />
      {/* Main Layout */}
      <div className="flex flex-col md:flex-row min-h-screen">
        <div className="transition-all duration-300 flex-1 p-4 sm:p-6 md:p-10 mt-20 sm:mt-16 md:mt-20">
          <div className="ml-2 md:ml-5 mt-1 ">
            <Heading text="Product View" />
          </div>

          <div className="mt-6 sm:mt-10 ml-1 md:ml-5">
            {alert && (
              <Alert
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert(null)}
              />
            )}

            <div className="flex flex-col w-full">
              {/* Main Content */}
              <div className="flex flex-col flex-grow justify-center items-center w-full">
                <div className="flex flex-col items-center justify-center mb-3 w-full max-w-4xl mx-auto">
                  <form
                    onSubmit={handleSubmit}
                    className="flex flex-col sm:flex-row sm:items-center justify-center sm:space-x-2 space-y-3 sm:space-y-0 w-full sm:w-auto"
                  >
                    {/* Code Input */}
                    <input
                      type="text"
                      id="code"
                      ref={codeRef}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="px-3 py-2 w-full sm:w-64 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none text-sm"
                      placeholder="Enter Product Code"
                    />

                    {/* Autocomplete Input */}
                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={handleChange}
                        onBlur={() =>
                          setTimeout(() => setShowSuggestions(false), 150)
                        }
                        onFocus={() => inputValue && setShowSuggestions(true)}
                        placeholder="Enter Product Name"
                        className="px-3 py-2 w-full bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none text-sm"
                      />
                      {showSuggestions && filteredSuggestions.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-md max-h-60 overflow-y-auto">
                          {filteredSuggestions.map((name, index) => (
                            <li
                              key={index}
                              onClick={() => handleSelect(name)}
                              className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                            >
                              {name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className={`bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded-lg w-full sm:w-auto text-sm mt-3 sm:mt-0
                        ${disable ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      Search
                    </button>
                  </form>
                </div>
                {codeError && (
                  <p className="text-red-500 text-sm mt-1 mb-6">{codeError}</p>
                )}
                <Toaster position="top-right" reverseOrder={false} />
                {cameraError && (
                  <div className="text-red-500 text-sm">{cameraError}</div>
                )}

                {hasCameraPermission ? (
                  <div className="text-center mt-6">
                    <div
                      className="scan border border-gray-400 rounded-lg bg-gray-200 flex justify-center items-center"
                      style={{
                        width: "min(240px, 90vw)",
                        height: "min(240px, 90vw)",
                      }}
                    >
                      {scannerEnabled ? (
                        <BarcodeScannerComponent
                          width={240}
                          height={240}
                          className="w-full h-full object-cover"
                          onUpdate={handleScan}
                          delay={1000}
                          onError={(error) => {
                            console.error("Scanner Error:", error);
                            toast.error("Scanner error: Please try again.");
                          }}
                        />
                      ) : (
                        <CameraOff size={60} className="text-gray-600" />
                      )}
                    </div>
                    <button
                      className={`bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded mt-6 text-sm
                        ${disable ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => setScannerEnabled(!scannerEnabled)}
                    >
                      {scannerEnabled ? "Disable Scanner" : "Enable Scanner"}
                    </button>
                  </div>
                ) : (
                  <div className="text-red-500 text-sm mt-6">
                    Camera access is not granted. Please check permissions.
                  </div>
                )}

                {isData && (
                  <div className="mt-6 w-full max-w-4xl mx-auto">
                    <div className="p-4 bg-white rounded-xl shadow-md">
                      <p className="text-center text-[#bc4a17] text-lg sm:text-xl font-bold mb-6">
                        Product Details
                      </p>

                      {/* Product */}
                      <div className="mb-6">
                        <p className="text-[#bc4a17] font-semibold text-base sm:text-lg mb-2">
                          Product
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-gray-800 text-sm sm:text-base">
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                            <span className="font-medium">Code:</span>
                            <span>{productData.PRODUCT_CODE}</span>
                            <span className="font-medium">Barcode:</span>
                            <span>{productData.BARCODE}</span>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                            <span className="font-medium">Name:</span>
                            <span>{productData.PRODUCT_NAMELONG}</span>
                            <span className="font-medium">Barcode 2:</span>
                            <span>{productData.BARCODE2}</span>
                          </div>
                        </div>
                      </div>

                      {/* Department */}
                      <div className="mb-6">
                        <p className="text-[#bc4a17] font-semibold text-base sm:text-lg mb-2">
                          Department
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 text-gray-800 text-sm sm:text-base">
                          <div className="grid grid-cols-[auto_1fr] gap-x-4">
                            <span className="font-medium">Code:</span>
                            <span>{productData.DEPTCODE}</span>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4">
                            <span className="font-medium">Name:</span>
                            <span>{productData.DEPTNAME}</span>
                          </div>
                        </div>
                      </div>

                      {/* Category */}
                      <div className="mb-6">
                        <p className="text-[#bc4a17] font-semibold text-base sm:text-lg mb-2">
                          Category
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 text-gray-800 text-sm sm:text-base">
                          <div className="grid grid-cols-[auto_1fr] gap-x-4">
                            <span className="font-medium">Code:</span>
                            <span>{productData.CATCODE}</span>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4">
                            <span className="font-medium">Name:</span>
                            <span>{productData.CATNAME}</span>
                          </div>
                        </div>
                      </div>

                      {/* Sub Category */}
                      <div className="mb-6">
                        <p className="text-[#bc4a17] font-semibold text-base sm:text-lg mb-2">
                          Sub Category
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 text-gray-800 text-sm sm:text-base">
                          <div className="grid grid-cols-[auto_1fr] gap-x-4">
                            <span className="font-medium">Code:</span>
                            <span>{productData.SCATCODE}</span>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4">
                            <span className="font-medium">Name:</span>
                            <span>{productData.SCATNAME}</span>
                          </div>
                        </div>
                      </div>

                      {/* Vendor */}
                      <div className="mb-6">
                        <p className="text-[#bc4a17] font-semibold text-base sm:text-lg mb-2">
                          Vendor
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 text-gray-800 text-sm sm:text-base">
                          <div className="grid grid-cols-[auto_1fr] gap-x-4">
                            <span className="font-medium">Code:</span>
                            <span>{productData.VENDORCODE}</span>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4">
                            <span className="font-medium">Name:</span>
                            <span>{productData.VENDORNAME}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                   <div className="p-4 bg-white rounded-xl shadow-md mt-6">
  <p className="text-center text-[#bc4a17] text-lg sm:text-xl font-bold mb-6">
    Price Details
  </p>

  {/* Price */}
  <div>
    <p className="text-[#bc4a17] font-semibold text-base sm:text-lg mb-2">
      Price
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 text-gray-800 text-sm sm:text-base">
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-2">
        <span className="font-medium">Cost Price:</span>
        <span className="text-right mr-10 md:mr-40">{productData.COSTPRICE.toFixed(2)}</span>

        <span className="font-medium">Unit Price:</span>
        <span className="text-right mr-10 md:mr-40">{productData.SCALEPRICE.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-2">
        <span className="font-medium">Minimum Price:</span>
        <span className="text-right mr-10 md:mr-40">{productData.MINPRICE.toFixed(2)}</span>

        <span className="font-medium">Wholesale Price:</span>
        <span className="text-right mr-10 md:mr-40">{productData.WPRICE.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-2 mt-2">
        <span className="font-medium">Average Cost:</span>
        <span className="text-right mr-10 md:mr-40">{productData.AVGCOST.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 text-gray-700 mt-8 text-sm sm:text-base">
    <p className="flex justify-between gap-2">
      <strong>Price 1:</strong>
      <span className="text-right mr-10 md:mr-40">{productData.PRICE1.toFixed(2)}</span>
    </p>
    <p className="flex justify-between gap-2">
      <strong>Price 2:</strong>
      <span className="text-right mr-10 md:mr-40">{productData.PRICE2.toFixed(2)}</span>
    </p>
    <p className="flex justify-between gap-2">
      <strong>Price 3:</strong>
      <span className="text-right mr-10 md:mr-40">{productData.PRICE3.toFixed(2)}</span>
    </p>
  </div>
</div>

                  </div>
                )}
                {isData && (
                  <div className="mt-6 w-full max-w-4xl mx-auto">
                    {Array.isArray(priceTableData) &&
                      priceTableData.length > 0 && (
                        <div className="p-4 bg-white rounded-xl shadow-md w-full">
                          <p className="text-center text-[#bc4a17] text-lg sm:text-xl font-bold mb-6">
                            Company Wise Price Details
                          </p>

                          <div className="overflow-x-auto">
                            <Table
                              headers={priceHeaders}
                              data={priceTableData}
                              editableColumns={[]}
                              bin={true}
                              rightAlignedColumns={[3,4,5,6]}
                            />
                          </div>
                        </div>
                      )}

                    {Array.isArray(stockTableData) &&
                      priceTableData.length > 0 && (
                        <div className="p-4 bg-white rounded-xl shadow-md mt-6 w-full">
                          <p className="text-center text-[#bc4a17] text-lg sm:text-xl font-bold mb-6">
                            Company Wise Stock Details
                          </p>

                          <div className="overflow-x-auto">
                            <Table
                              headers={stockHeaders}
                              data={stockTableData}
                              formatColumnsQuantity={[2]}
                              editableColumns={[]}
                              bin={true}
                              rightAlignedColumns={[2]}
                            />
                          </div>
                        </div>
                      )}

                    {Array.isArray(colorWiseTableData) &&
                      colorWiseTableData.length > 0 && (
                        <div className="p-4 bg-white rounded-xl shadow-md mt-6 w-full">
                          <p className="text-center text-[#bc4a17] text-lg sm:text-xl font-bold mb-6">
                            Color Wise Stock Details
                          </p>

                          <div className="overflow-x-auto">
                            <Table
                              headers={colorWiseHeaders}
                              data={colorWiseTableData}
                              formatColumnsQuantity={[1]}
                              editableColumns={[]}
                              rightAlignedColumns={[1]}
                              bin={true}
                            />
                          </div>
                        </div>
                      )}

                    <div className="p-4 bg-white rounded-xl shadow-md mt-6 w-full">
                      <p className="text-center text-[#bc4a17] text-lg sm:text-xl font-bold mb-6">
                        Sales Details
                      </p>

                      <div className="mt-5">
                        {alert && (
                          <Alert
                            message={alert.message}
                            type={alert.type}
                            onClose={() => setAlert(null)}
                          />
                        )}
                      </div>

                      <div
                        className="mt-10 bg-gray-200 p-4 rounded-lg shadow-md mb-10"
                        style={{ backgroundColor: "#d8d8d8" }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            <DatePicker
                              label="Select Date Range:"
                              onDateChange={handleDateChange}
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row justify-center sm:justify-end gap-4 mt-3 md:mt-6">
                            <button
                              onClick={handleSalesSubmit}
                              disabled={disable}
                              className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 ${
                                disable ? "opacity-50 cursor-not-allowed" : ""
                              } w-full sm:w-auto`}
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      </div>

                      {Array.isArray(salesData) && salesData.length > 0 && (
                        <div className="overflow-x-auto">
                          <Table
                            headers={salesHeaders}
                            data={salesData}
                            formatColumns = {[2,3,5,6]}
                            formatColumnsQuantity={[4]}
                            editableColumns={[]}
                            bin={true}
                            rightAlignedColumns={[2,3,4,5,6]}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
