import { useState, useEffect, useContext, useRef } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import toast, { Toaster } from "react-hot-toast";
import { Navigate } from "react-router-dom";
import Navbar from "../components/NavBar";
import { AuthContext } from "../AuthContext";
import Table from "../components/EditableTable";
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
  const [tableData, setTableData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [priceTableData, setPriceTableData] = useState([]);
  const [priceHeaders, setPriceHeaders] = useState([]);
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
    console.log("Selected name:", name);
    requestData(code, name);
  };

  const requestData = async (data, inputValue) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}product-view`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            data: data,
            inputValue: inputValue,
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
          "MIN_PRICE"
        ];
        const customPriceHeadingMap = {
          COMPANY_CODE: "Company Code",
          COMPANY_NAME: "Company Name",
          PRODUCT_CODE: "Product Code",
          COST_PRICE: "Cost Price",
          UNIT_PRICE: "Unit Price",
          WPRICE: "Wholesale Price",
          MIN_PRICE: "Minimum Price"
        };

        const customHeaders = customOrder.map(
          (key) => customHeadingMap[key] || key
        );
        setHeaders(customHeaders);

        const customPriceHeaders = customPriceOrder.map(
          (key) => customPriceHeadingMap[key] || key
        );
        setPriceHeaders(customPriceHeaders);

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
            if ((key === "COST_PRICE" || key==="UNIT_PRICE" || key==="WPRICE" || key ==="MIN_PRICE") && typeof value === "number") {
              return value.toFixed(2); // format to 3 decimal places
            }
           
            return value;
          })
        );

        setPriceTableData(finalPriceArray);

        setAlert({
          message: "Product Found Successfully",
          type: "success",
        });
        setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setAlert({
        message: err.response?.data?.message || "Item finding failed",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
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
      requestData(result.text);
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
      requestData(code, inputValue);
    }
  };

  return (
    <div>
      <Navbar />
      {/* Main Layout */}
      <div className="flex">
        <div
          className={`transition-all duration-300 flex-1 p-10`}
          style={{
            marginLeft: "4rem", // Space for sidebar
            marginTop: "96px", // Space for Navbar
          }}
        >
          <div className="ml-[-50px]">
            <Heading text="Product View" />
          </div>

          <div className="mt-10 ml-[-60px] sm:ml-[-50px]">
            {alert && (
              <Alert
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert(null)}
              />
            )}

            <div className="flex">
              {/* Main Content */}
              <div className="flex flex-col flex-grow justify-center items-center w-full ">
                <div className="flex items-center  mb-3">
                  <form
                    onSubmit={handleSubmit}
                    className="flex flex-col md:flex-row md:items-center md:space-x-2 space-y-3 md:space-y-0 w-full"
                  >
                    {/* Autocomplete Input */}
                    <div className="relative w-full md:w-auto">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={handleChange}
                        onBlur={() =>
                          setTimeout(() => setShowSuggestions(false), 150)
                        }
                        onFocus={() => inputValue && setShowSuggestions(true)}
                        placeholder="Enter Product Name"
                        className="px-3 py-2 w-full md:w-64 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none"
                      />
                      {showSuggestions && filteredSuggestions.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-md">
                          {filteredSuggestions.map((name, index) => (
                            <li
                              key={index}
                              onClick={() => handleSelect(name)}
                              className="p-2 hover:bg-gray-100 cursor-pointer"
                            >
                              {name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Code Input */}
                    <input
                      type="text"
                      id="code"
                      ref={codeRef}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="px-3 py-2 w-full md:w-64 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none"
                      placeholder="Enter Product Code"
                    />

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded-lg w-full md:w-auto"
                    >
                      Search
                    </button>
                  </form>
                </div>
                {codeError && (
                  <p className="text-red-500 text-sm mt-1 mb-10">{codeError}</p>
                )}
                <Toaster position="top-right" reverseOrder={false} />
                {cameraError && <div className="error">{cameraError}</div>}

                {hasCameraPermission ? (
                  <div className="text-center">
                    <div
                      className="scan border border-gray-400 rounded-lg bg-gray-200 flex justify-center items-center mt-10"
                      style={{
                        width: "240px",
                        height: "240px",
                        maxWidth: "100vw",
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
                        <CameraOff size={60} className="text-gray-600" /> // Icon stays centered inside fixed box
                      )}
                    </div>
                    <button
                      className="bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded mt-16"
                      onClick={() => setScannerEnabled(!scannerEnabled)}
                    >
                      {scannerEnabled ? "Disable Scanner" : "Enable Scanner"}
                    </button>
                  </div>
                ) : (
                  <div className="error">
                    Camera access is not granted. Please check permissions.
                  </div>
                )}

                {isData && (
                  <div className="p-4 bg-white rounded-xl shadow-md mt-6">
                    <div className="p-4 bg-white rounded-xl shadow-md mt-6">
                      <p className="text-center text-[#bc4a17] text-xl font-bold mb-6">
                        Product Details
                      </p>

                      {/* Product */}
                      <div className="mb-6">
                        <p className="text-[#bc4a17] font-semibold text-lg mb-2">
                          Product
                        </p>
                        <div className="grid sm:grid-cols-2 gap-y-2  text-gray-800">
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
                        <p className="text-[#bc4a17] font-semibold text-lg mb-2">
                          Department
                        </p>
                        <div className="grid sm:grid-cols-2  text-gray-800">
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
                        <p className="text-[#bc4a17] font-semibold text-lg mb-2">
                          Category
                        </p>
                        <div className="grid sm:grid-cols-2  text-gray-800">
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
                        <p className="text-[#bc4a17] font-semibold text-lg mb-2">
                          Sub Category
                        </p>
                        <div className="grid sm:grid-cols-2  text-gray-800">
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
                        <p className="text-[#bc4a17] font-semibold text-lg mb-2">
                          Vendor
                        </p>
                        <div className="grid sm:grid-cols-2  text-gray-800">
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
                      <p className="text-center text-[#bc4a17] text-xl font-bold mb-6">
                        Price Details
                      </p>

                      {/* Price */}
                      <div>
                        <p className="text-[#bc4a17] font-semibold text-lg mb-2">
                          Price
                        </p>
                        <div className="grid sm:grid-cols-2  text-gray-800">
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                            <span className="font-medium">Cost Price:</span>
                            <span>{productData.COSTPRICE.toFixed(2)}</span>
                            <span className="font-medium">Unit Price:</span>
                            <span>{productData.SCALEPRICE.toFixed(2)}</span>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                            <span className="font-medium">Minimum Price:</span>
                            <span>{productData.MINPRICE.toFixed(2)}</span>
                            <span className="font-medium">
                              Wholesale Price:
                            </span>
                            <span>{productData.WPRICE.toFixed(2)}</span>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 mt-2">
                            <span className="font-medium">Average Price:</span>
                            <span>{productData.AVGCOST.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4  text-gray-700 mt-8">
                        <p>
                          <strong>Price 1:</strong>{" "}
                          {productData.PRICE1.toFixed(2)}
                        </p>
                        <p>
                          <strong>Price 2:</strong>{" "}
                          {productData.PRICE2.toFixed(2)}
                        </p>
                        <p>
                          <strong>Price 3:</strong>{" "}
                          {productData.PRICE3.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isData && (
                  <div>
                    <div className="p-4 bg-white rounded-xl shadow-md mt-6">
                      <p className="text-center text-[#bc4a17] text-xl font-bold mb-6">
                        Company Wise Price Details
                      </p>
                      <Table
                        headers={priceHeaders}
                        data={priceTableData}
                        editableColumns={[]}
                        bin={true}
                      />
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
