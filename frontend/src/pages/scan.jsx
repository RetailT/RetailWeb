import { useState, useEffect, useContext, useRef } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import toast, { Toaster } from "react-hot-toast";
import { Navigate } from "react-router-dom";
import Navbar from "../components/NavBar";
import { AuthContext } from "../AuthContext";
import Heading from "../components/Heading";
import Alert from "../components/Alert";
import { CameraOff } from "lucide-react";
import axios, { all } from "axios";
import Table from "../components/EditableTable";
import { jwtDecode } from "jwt-decode";

function App() {
  const { authToken } = useContext(AuthContext);
  const [currentData, setCurrentData] = useState("No result");
  const [cameraError, setCameraError] = useState(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState(null);
  const [selectedToCompanyName, setSelectedToCompanyName] = useState(null);
  const [selectedVendorName, setSelectedVendorName] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedCount, setSelectedCount] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [enteredProduct, setEnteredProduct] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedToCompany, setSelectedToCompany] = useState("");
  const [error, setError] = useState(null);
  const [codeError, setCodeError] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [state, setState] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [companyToError, setCompanyToError] = useState("");
  const [vendorError, setVendorError] = useState("");
  const [newTableData, setTableData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [typeError, setTypeError] = useState("");
  const [countError, setCountError] = useState("");
  const [invoiceNoError, setInvoiceNoError] = useState("");
  const [code, setCode] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const [initialData, setInitialData] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [alert, setAlert] = useState(null);
  const [quantityError, setQuantityError] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [salesData, setSalesData] = useState([]);
  const [disable, setDisable] = useState(false);
  const [repUserFilter, setRepUserFilter] = useState(""); // empty means no filter
  const [inputValue, setInputValue] = useState("");
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [names, setNames] = useState([]);
  const [colorWiseTableData, setColorWiseTableData] = useState([]);
  const [colorWiseHeaders, setColorWiseHeaders] = useState([]);

  const [uniqueRepUsers, setUniqueRepUsers] = useState([]);
  const quantityRef = useRef(null);
  const tableRef = useRef(null);
  const codeRef = useRef(null);
  const streamRef = useRef(null);

  const token = localStorage.getItem("authToken");
  const decodedToken = jwtDecode(token);
  const username = decodedToken.username;
  const grn = decodedToken.t_grn;
  const prn = decodedToken.t_prn;
  const tog = decodedToken.t_tog;
  const stock_scan = decodedToken.t_stock;
  const stock_update = decodedToken.t_stock_update;

  const countOptions = ["COUNT 01", "COUNT 02", "COUNT 03"];
  let typeOptions = [];
  const editableColumns = [{ index: 12, type: "number", step: "any" }];

  if (grn === "T") {
    typeOptions.push("GRN");
  }
  if (prn === "T") {
    typeOptions.push("PRN");
  }
  if (tog === "T") {
    typeOptions.push("TOG");
  }
  if (stock_scan === "T") {
    typeOptions.push("STOCK");
  }

  let costPrice = (salesData.COSTPRICE || 0).toFixed(2);
  let salesPrice = (salesData.SCALEPRICE || 0).toFixed(2);

  const fetchCompanies = async () => {
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
        // Map through all userData and get all options
        const companies = response.data.userData.map((data) => ({
          code: data.COMPANY_CODE.trim(),
          name: data.COMPANY_NAME.trim(),
        }));
        setCompanies(companies);
      }
      else{
        setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setError("Failed to fetch dashboard data");

      console.error("Error fetching dashboard data:", err);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}vendors`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.vendorData && response.data.vendorData.length > 0) {
        // Map through all userData and get all options
        const vendors = response.data.vendorData.map((data) => ({
          code: data.VENDORCODE.trim(),
          name: data.VENDORNAME.trim(),
        }));
        setVendors(vendors);
      }
      else{
        setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setError("Failed to fetch dashboard data");

      console.error("Error fetching dashboard data:", err);
    }
  };

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
      setError("No token found");
      setDisable(true);
      return;
    }
    fetchCompanies();
    fetchVendors();
    requestProductNames();
    if (scannerEnabled) {
      getCameraStream();
    } else {
      stopCameraStream();
    }

    if (selectedType && selectedCompany) {
      tableData();
    }
  }, [scannerEnabled, selectedType, selectedCompany, colorWiseTableData]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const requestData = async (data, name) => {
    setDisable(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}scan`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            data: data,
            company: selectedCompany,
            name: name,
          },
        }
      );

      if (response.data.salesData.length > 0) {
        setSalesData(response.data.salesData[0]);
      }
      if (response.data.colorWiseData.length > 0) {
        const colorWiseData = response.data.colorWiseData;

        const colorWiseTableDataFormatted = colorWiseData.map((item) => [
          item.SERIALNO,
          item.COLORCODE,
          item.SIZECODE,
          item.STOCK,
        ]);

        setColorWiseTableData(colorWiseTableDataFormatted);
        const colorWiseHeadings = [
          "SERIALNO",
          "COLORCODE",
          "SIZECODE",
          "STOCK",
        ];

        const colorWiseHeadingMap = {
          SERIALNO: "Serial No",
          COLORCODE: "Color Code",
          SIZECODE: "Size Code",
          STOCK: "Quantity",
        };

        const colorHeaders = colorWiseHeadings.map(
          (key) => colorWiseHeadingMap[key] || key
        );
        setColorWiseHeaders(colorHeaders);

        setTimeout(() => {
          if (colorWiseTableData.length > 0 && tableRef.current) {
            tableRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          } else if (quantityRef.current) {
            quantityRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            quantityRef.current.focus(); // Focus after scrolling
            quantityRef.current.select();
          }
        }, 100);
      }

      if(response.data.colorwiseActive && response.data.colorWiseData.length === 0){
        setState(false);
      }
      else{
       setState(true); 
      }
      

      setAmount(response.data.amount);

      setCode("");
      setInputValue("");
    } catch (err) {
      setSalesData([]);
      setState(false);
      setAmount("");
      setAlert({
        message: err.response?.data?.message || "Item finding failed",
        type: "error",
      });

      // Dismiss alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
    }
    
    setDisable(false);
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

      setCurrentData(result.text);
      setCode("");
      toast.success(`Product scanned: ${result.text}`);
      setScannedCode(result.text); // Update scannedCode state
      requestData(result.text, "");
    }
  };

  const handleCompanyChange = (event) => {
    const selectedCode = event.target.value;
    const selectedCompanyObj = companies.find(
      (company) => company.code === selectedCode
    );

    // Store the company code in setSelectedCompany
    setSelectedCompany(selectedCode);

    // Store the company name in setSelectedCompanyName
    if (selectedCompanyObj) {
      setSelectedCompanyName(selectedCompanyObj.name);
    }
  };

  const handleToCompanyChange = (event) => {
    const selectedCode = event.target.value;
    const selectedCompanyObj = companies.find(
      (company) => company.code === selectedCode
    );

    // Store the company code in setSelectedToCompany
    setSelectedToCompany(selectedCode);

    // Store the company name in setSelectedToCompanyName
    if (selectedCompanyObj) {
      setSelectedToCompanyName(selectedCompanyObj.name);
    }
  };

  const handleCountChange = (event) => {
    setSelectedCount(event.target.value);
  };

  const handleVendorChange = (event) => {
    const selectedVendorCode = event.target.value;
    const selectedVendorObj = vendors.find(
      (vendor) => vendor.code === selectedVendorCode
    );

    // Store the company code in setSelectedCompany
    setSelectedVendor(selectedVendorCode);

    // Store the company name in setSelectedCompanyName
    if (selectedVendorObj) {
      setSelectedVendorName(selectedVendorObj.name);
    }
  };

  const handleTypeChange = (event) => {
    setSelectedType(event.target.value);
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

  const tableData = async () => {
    try {
      if (selectedCompany === selectedToCompany) {
        setCompanyToError("Company and Company To cannot be the same.");
      }
      setDisable(true);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}grnprn-table-data`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            name: username,
            code: selectedCompany,
            selectedType: selectedType,
            // vendor: selectedVendor,
            // invoice_no: invoiceNo,
            // company_to: selectedToCompany
          },
        }
      );

      const message = response.data.message;

      if (message === "Data Found Successfully") {
        const tableData = response.data.tableData;

        if (selectedType === "GRN" && tableData.length > 0) {
          // Extract keys from the first object, excluding "IDX"
          const keys = Object.keys(tableData[0]).filter((key) => key !== "IDX");

          // Custom heading mapping
          const customHeadingMap = {
            INVOICE_NO: "Invoice No",
            COMPANY_CODE: "Company Code",
            VENDOR_CODE: "Vendor Code",
            VENDOR_NAME: "Vendor Name",
            REPUSER: "REPUSER",
          };

          const customHeaders = keys.map((key) => customHeadingMap[key] || key);

          setHeaders(customHeaders);

          // Map the data, include "IDX" as hidden in each row
          const gData = tableData.map((row) => ({
            idx: row.IDX, // Store IDX for later reference
            rowData: keys.map((key) => row[key]), // Data excluding IDX
          }));
          setEnteredProduct("submitted");
          setTableData(gData);
          // setInitialData(true);
        } else if (selectedType === "PRN" && tableData.length > 0) {
          // Extract keys from the first object, excluding "IDX"
          const keys = Object.keys(tableData[0]).filter((key) => key !== "IDX");

          // Custom heading mapping
          const customHeadingMap = {
            INVOICE_NO: "Invoice No",
            COMPANY_CODE: "Company Code",
            VENDOR_CODE: "Vendor Code",
            VENDOR_NAME: "Vendor Name",
            REPUSER: "REPUSER",
          };

          const customHeaders = keys.map((key) => customHeadingMap[key] || key);

          setHeaders(customHeaders);

          // Map the data, include "IDX" as hidden in each row
          const pData = tableData.map((row) => ({
            idx: row.IDX, // Store IDX for later reference
            rowData: keys.map((key) => row[key]), // Data excluding IDX
          }));
          setEnteredProduct("submitted");
          setTableData(pData);
          // console.log('pData',pData);
          // setInitialData(true);
        } else if (selectedType === "TOG" && tableData.length > 0) {
          // Extract keys from the first object, excluding "IDX"
          const keys = Object.keys(tableData[0]).filter((key) => key !== "IDX");

          // Custom heading mapping
          const customHeadingMap = {
            COMPANY_CODE: "Company Code",
            COMPANY_TO_CODE: "Company To Code",
            REPUSER: "REPUSER",
          };

          const customHeaders = keys.map((key) => customHeadingMap[key] || key);

          setHeaders(customHeaders);

          // Map the data, include "IDX" as hidden in each row
          const tData = tableData.map((row) => ({
            idx: row.IDX, // Store IDX for later reference
            rowData: keys.map((key) => row[key]), // Data excluding IDX
          }));
          setEnteredProduct("submitted");
          setTableData(tData);
          // setInitialData(true);
        } else {
          if (selectedType !== "STOCK") {
            setAlert({
              message: "No data found",
              type: "error",
            });
          }
        }

        const repUsers = [
          ...new Set(
            (tableData || tableData || tableData).map((item) =>
              item.REPUSER?.trim()
            )
          ),
        ];
        setUniqueRepUsers(repUsers);
      }
      else{
        setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      }

      setDisable(false);
    } catch (err) {
      setDisable(false);
      if (selectedType !== "STOCK") {
        setAlert({
          message: err.response?.data?.message || "Stock data finding failed",
          type: "error",
        });

        setTimeout(() => {
          setAlert(null);
        }, 3000);

        setTableData([]);
      }
    }
  };

  const handleDataSubmit = async (e) => {
    setDisable(true);
    e.preventDefault();
    let valid = true; // Initialize at the top

    // Company validation
    if (!selectedCompany) {
      setCompanyError("Company is required.");
      valid = false;
    } else {
      setCompanyError("");
    }

    // Type validation
    if (!selectedType) {
      setTypeError("Type is required.");
      valid = false;
    } else {
      setTypeError("");
    }

    // Count validation for STOCK type
    if (selectedType === "STOCK" && !selectedCount) {
      setCountError("Count is required.");
      valid = false;
    } else {
      setCountError("");
    }

    // Vendor validation for GRN or PRN
    if ((selectedType === "GRN" || selectedType === "PRN") && !selectedVendor) {
      setVendorError("Vendor is required.");
      valid = false;
    } else {
      setVendorError("");
    }

    if ((selectedType === "GRN" || selectedType === "PRN") && !invoiceNo) {
      setInvoiceNoError("Invoice no is required.");
      valid = false;
    } else {
      setInvoiceNoError("");
    }

    if (!selectedToCompany) {
      setCompanyToError("Company To required.");
      valid = false;
    }
    if (selectedCompany && selectedType === "STOCK" && selectedCount) {
      valid = true;
    }
    if (
      selectedCompany &&
      (selectedType === "GRN" || selectedType === "PRN") &&
      selectedVendor &&
      invoiceNo
    ) {
      valid = true;
    }
    if (selectedCompany && selectedType === "TOG" && selectedToCompany) {
      if (selectedCompany === selectedToCompany) {
        setCompanyToError("Company and Company To cannot be the same.");
        valid = false;
      } else {
        valid = true;
      }
    }

    // Final check before proceeding
    if (valid) {
      setInitialData(true);
      setHasCameraPermission(true);
      // setInitialData(true);
    }
    setDisable(false);
  };

  const handleProductSubmit = async (e) => {
    setDisable(true);
    e.preventDefault();
    if (!quantity) {
      setQuantityError("Quantity is required.");
      valid = false;
    } else {
      setQuantityError("");

      try {
        if (selectedType === "STOCK") {
          const response = await axios.post(
            `${process.env.REACT_APP_BACKEND_URL}update-temp-sales-table`,
            {
              company: selectedCompany,
              count: selectedCount,
              type: "STK",
              productCode: salesData.PRODUCT_CODE,
              productName: salesData.PRODUCT_NAMELONG,
              costPrice: salesData.COSTPRICE,
              scalePrice: salesData.SCALEPRICE,
              stock: amount,
              quantity: quantity,
              colorWiseTableData: colorWiseTableData,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (response.data.message === "Table Updated successfully") {
            setQuantity(1);
            setSalesData([]);
            setAmount("");
            setAlert({
              message: "Table Updated successfully",
              type: "success",
            });

            setTimeout(() => setAlert(null), 3000);

            setTimeout(() => {
              if (codeRef.current) {
                codeRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                codeRef.current.focus(); // Focus after scrolling
              }
            }, 100);
          }
          else{
            setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
          }
        } else if (selectedType === "GRN" || selectedType === "PRN") {
          const response = await axios.post(
            `${process.env.REACT_APP_BACKEND_URL}update-temp-grn-table`,
            {
              company: selectedCompany,
              type: selectedType,
              productCode: salesData.PRODUCT_CODE,
              productName: salesData.PRODUCT_NAMELONG,
              costPrice: salesData.COSTPRICE,
              scalePrice: salesData.SCALEPRICE,
              stock: amount,
              quantity: quantity,
              vendor_code: selectedVendor,
              vendor_name: selectedVendorName,
              invoice_no: invoiceNo,
              colorWiseTableData: colorWiseTableData,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (response.data.message === "Table Updated successfully") {
            setAlert({
              message: "Table Updated successfully",
              type: "success",
            });

            setTimeout(() => setAlert(null), 3000);

            setTimeout(() => {
              if (codeRef.current) {
                codeRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                codeRef.current.focus(); // Focus after scrolling
              }
            }, 100);
          }
          else{
            setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
          }
        } else if (selectedType === "TOG") {
          const response = await axios.post(
            `${process.env.REACT_APP_BACKEND_URL}update-temp-tog-table`,
            {
              company: selectedCompany,
              companyCodeTo: selectedToCompany,
              type: "TOG",
              productCode: salesData.PRODUCT_CODE,
              productName: salesData.PRODUCT_NAMELONG,
              costPrice: salesData.COSTPRICE,
              scalePrice: salesData.SCALEPRICE,
              stock: amount,
              quantity: quantity,
              colorWiseTableData: colorWiseTableData,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (response.data.message === "Table Updated successfully") {
            setAlert({
              message: "Table Updated successfully",
              type: "success",
            });

            setTimeout(() => setAlert(null), 3000);

            setTimeout(() => {
              if (codeRef.current) {
                codeRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                codeRef.current.focus(); // Focus after scrolling
              }
            }, 100);
          } else {
            setAlert({
              message: "Table Updated Failed",
              type: "error",
            });

            setTimeout(() => setAlert(null), 3000);
          }
        }

        tableData();
      } catch (err) {
        setAlert({
          message: err.response?.data?.message || "Table updating failed",
          type: "error",
        });

        // Dismiss alert after 3 seconds
        setTimeout(() => setAlert(null), 3000);
      }
    }
    setDisable(false);
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
  };

  const filteredTableData = newTableData.filter((item) => {
    const repUser = item.rowData[headers.indexOf("REPUSER")]?.trim();
    return repUserFilter === "" || repUser === repUserFilter;
  });

  const handleRowChange = (rowIndex, cellIndex, newValue) => {
    if (parseFloat(newValue) < 0) return; // do nothing if negative

    const updatedData = [...colorWiseTableData];
    updatedData[rowIndex][cellIndex] = newValue;
    setColorWiseTableData(updatedData);
  };

  const handleRowClick = (rowData) => {
    if (selectedType !== "TOG") {
      const vendorCode = String(rowData[1]).trim(); // Trim VENDOR_CODE to match dropdown values
      const vendor = vendors.find((v) => v.code === vendorCode); // Find matching vendor
      setSelectedVendor(vendorCode); // Set trimmed vendor code
      setInvoiceNo(Number(rowData[3])); // Set invoice number
      setSelectedVendorName(vendor ? vendor.name : rowData[2].trim()); // Set vendor name, fallback to rowData
    } else {
      const code = String(rowData[1]).trim(); // COMPANY_TO_CODE
      const companyName = companies.find(
        (company) => company.code.trim() === code
      )?.name;
      setSelectedToCompanyName(companyName);
      setSelectedToCompany(code);
    }
  };

  return (
    <div>
      <Navbar />
      {/* Main Layout */}
      <div className="flex flex-col md:flex-row min-h-screen">
        <div className="transition-all duration-300 flex-1 p-2 sm:p-4 md:p-6 md:ml-10 md:mr-10 ml-4 mr-4 mt-24 sm:mt-20 md:mt-24">
          <div className="w-full max-w-full ml-2 sm:ml-4 md:ml-0">
            <Heading text="Scan" />
          </div>

          <div className="mt-4 sm:mt-6 md:mt-10 w-full ml-2 sm:ml-4 md:ml-0">
            {alert && (
              <Alert
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert(null)}
              />
            )}
          </div>

          {!initialData && (
            <div className="bg-[#d8d8d8] p-2 sm:p-4 rounded-md shadow-md mb-4 sm:mb-6 mt-10 w-full max-w-full">
              {/* Row 1: Company, Type, Conditional field */}
              <div className="flex flex-col lg:flex-row gap-2 sm:gap-4 mb-2 sm:mb-4">
                {/* Company */}
                <div className="flex flex-col w-full lg:w-1/3 mb-2 sm:mb-0">
                  <label className="text-sm font-medium text-gray-700">
                    Select a Company
                  </label>
                  <select
                    value={selectedCompany}
                    onChange={handleCompanyChange}
                    className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full text-sm"
                  >
                    <option value="" disabled>
                      Select a Company
                    </option>
                    {companies.map((company) => (
                      <option key={company.code} value={company.code}>
                        {company.code} {company.name}
                      </option>
                    ))}
                  </select>
                  {companyError && (
                    <p className="text-red-500 text-sm">{companyError}</p>
                  )}
                </div>

                {/* Type */}
                <div className="flex flex-col w-full lg:w-1/3 mb-2 sm:mb-0">
                  <label className="text-sm font-medium text-gray-700">
                    Select a Type
                  </label>
                  <select
                    value={selectedType}
                    onChange={handleTypeChange}
                    className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full text-sm"
                  >
                    <option value="" disabled>
                      Select a Type
                    </option>
                    {typeOptions.map((type, index) => (
                      <option key={index} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {typeError && (
                    <p className="text-red-500 text-sm">{typeError}</p>
                  )}
                </div>

                {/* Conditional field */}
                {(selectedType === "GRN" || selectedType === "PRN") && (
                  <div className="flex flex-col w-full lg:w-1/3 mb-2 sm:mb-0">
                    <label className="text-sm font-medium text-gray-700">
                      Select Vendor
                    </label>
                    <select
                      value={selectedVendor}
                      onChange={handleVendorChange}
                      className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full text-sm"
                    >
                      <option value="" disabled>
                        Select Vendor
                      </option>
                      {vendors.map((vendor) => (
                        <option key={vendor.code} value={vendor.code}>
                          {vendor.code} {vendor.name}
                        </option>
                      ))}
                    </select>
                    {vendorError && (
                      <p className="text-red-500 text-sm">{vendorError}</p>
                    )}
                  </div>
                )}

                {selectedType === "TOG" && (
                  <div className="flex flex-col w-full lg:w-1/3 mb-2 sm:mb-0">
                    <label className="text-sm font-medium text-gray-700">
                      Company To
                    </label>
                    <select
                      value={selectedToCompany}
                      onChange={handleToCompanyChange}
                      className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full text-sm"
                    >
                      <option value="" disabled>
                        Company To
                      </option>
                      {companies.map((company) => (
                        <option key={company.code} value={company.code}>
                          {company.code} {company.name}
                        </option>
                      ))}
                    </select>
                    {companyToError && (
                      <p className="text-red-500 text-sm">{companyToError}</p>
                    )}
                  </div>
                )}

                {selectedType === "STOCK" && (
                  <div className="flex flex-col w-full lg:w-1/3 mb-2 sm:mb-0">
                    <label className="text-sm font-medium text-gray-700">
                      Select a Count
                    </label>
                    <select
                      value={selectedCount}
                      onChange={handleCountChange}
                      className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full text-sm"
                    >
                      <option value="" disabled>
                        Select a Count
                      </option>
                      {countOptions.map((name, index) => (
                        <option key={index} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {countError && (
                      <p className="text-red-500 text-sm">{countError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Row 2: Invoice No + Submit button right aligned */}
              <div className="flex flex-col lg:flex-row items-start lg:items-end gap-2 sm:gap-4">
                {(selectedType === "GRN" || selectedType === "PRN") && (
                  <div className="flex flex-col w-full lg:w-1/3 mb-2 sm:mb-0">
                    <label className="text-sm font-medium text-gray-700">
                      Invoice No
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={invoiceNo}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (value >= 0 || isNaN(value)) {
                          setInvoiceNo(e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "-" || e.key === "e") {
                          e.preventDefault();
                        }
                      }}
                      className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full text-sm"
                      placeholder="Enter Invoice No"
                    />
                    {invoiceNoError && (
                      <p className="text-red-500 text-sm">{invoiceNoError}</p>
                    )}
                  </div>
                )}

                {/* Spacer to push button right on large screens */}
                <div className="flex-grow" />

                {/* Submit button aligned right always */}
                <div className="w-full lg:w-auto flex justify-center lg:justify-end">
                  <button
                    onClick={handleDataSubmit}
                    className={`bg-black hover:bg-gray-800 w-full lg:w-auto text-white font-semibold py-2 px-4 rounded-md shadow-md text-sm
                  ${disable ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {initialData && (
            <div className="mt-4 sm:mt-6 md:mt-10 w-full max-w-full">
              <div className="flex flex-col">
                {/* Main Content */}
                <div className="flex flex-col flex-grow justify-center items-center w-full max-w-full">
                  <div className="flex items-center mb-2 sm:mb-3 w-full justify-center">
                    <form
                      onSubmit={handleSubmit}
                      className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full lg:w-auto"
                    >
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full lg:w-[600px]">
                        <input
                          type="text"
                          id="code"
                          ref={codeRef}
                          value={code}
                          onChange={(e) => {
                            setCode(e.target.value);
                            setScannedCode(e.target.value);
                          }}
                          className="px-2 sm:px-3 py-2 w-full lg:w-1/2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none text-sm"
                          placeholder="Enter Code"
                        />
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => {
                            handleChange(e);
                            setScannedCode("");
                          }}
                          onBlur={() =>
                            setTimeout(() => setShowSuggestions(false), 150)
                          }
                          onFocus={() => inputValue && setShowSuggestions(true)}
                          placeholder="Enter Product Name"
                          className="px-2 sm:px-3 py-2 w-full lg:w-1/2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none text-sm"
                        />
                        {showSuggestions && filteredSuggestions.length > 0 && (
                          <ul className="absolute z-10 w-full lg:w-[calc(50%-0.5rem)] bg-white border border-gray-300 rounded-md mt-1 shadow-md max-h-40 sm:max-h-60 overflow-y-auto">
                            {filteredSuggestions.map((name, index) => (
                              <li
                                key={index}
                                onClick={() => handleSelect(name)}
                                className="p-1 sm:p-2 hover:bg-gray-100 cursor-pointer text-sm"
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button
                        type="submit"
                        className={`bg-[#f17e21] hover:bg-[#efa05f] text-white px-3 sm:px-4 py-2 rounded-lg w-full sm:w-auto text-sm mt-2 sm:mt-0
                      ${disable ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        Search
                      </button>
                    </form>
                  </div>
                  {codeError && (
                    <p className="text-red-500 text-sm mt-1 mb-4 sm:mb-6">
                      {codeError}
                    </p>
                  )}
                  <Toaster position="top-right" reverseOrder={false} />
                  {cameraError && (
                    <div className="text-red-500 text-sm">{cameraError}</div>
                  )}

                  {hasCameraPermission ? (
                    <div className="text-center mt-4 sm:mt-6">
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
                          <CameraOff
                            size={40}
                            className="text-gray-600 w-10 h-10 sm:w-15 sm:h-15"
                          />
                        )}
                      </div>
                      <button
                        className={`bg-[#f17e21] hover:bg-[#efa05f] text-white px-3 sm:px-4 py-2 rounded mt-4 sm:mt-6 text-sm
                      ${disable ? "opacity-50 cursor-not-allowed" : ""}`}
                        onClick={() => setScannerEnabled(!scannerEnabled)}
                      >
                        {scannerEnabled ? "Disable Scanner" : "Enable Scanner"}
                      </button>
                    </div>
                  ) : (
                    <div className="text-red-500 text-sm mt-4 sm:mt-6">
                      Camera access is not granted. Please check permissions.
                    </div>
                  )}

                 
                    <div className="bg-white p-2 sm:p-4 rounded-md shadow-md mb-2 sm:mb-4 mt-4 sm:mt-6 sm:w-full md:w-2/5 max-w-full">
                    <div className="text-sm sm:text-lg font-semibold mb-2 sm:mb-4 text-[#f17e21]">
                      Product Details
                    </div>

                    <div className="space-y-1 sm:space-y-2">
                      <div className="border-t pt-1 sm:pt-2">
                        <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                          Scanned Data
                        </p>
                        <p className="text-gray-700 text-sm">
                          {scannedCode ? (
                            <span>
                              <strong>Scanned Code:</strong> {scannedCode}
                            </span>
                          ) : (
                            <span>
                              <strong>Searched Name:</strong>{" "}
                              {salesData.PRODUCT_NAMELONG}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="border-t pt-1 sm:pt-2">
                        <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                          Company Information
                        </p>
                        <p className="text-gray-700 text-sm">
                          <strong>Company Code:</strong> {selectedCompany}
                        </p>
                        <p className="text-gray-700 text-sm">
                          <strong>Company Name:</strong> {selectedCompanyName}
                        </p>
                        {selectedType === "TOG" && (
                          <div>
                            <p className="text-gray-700 text-sm">
                              <strong>To Company Code:</strong>{" "}
                              {selectedToCompany}
                            </p>
                            <p className="text-gray-700 text-sm">
                              <strong>To Company Name:</strong>{" "}
                              {selectedToCompanyName}
                            </p>
                          </div>
                        )}

                        {selectedType === "STOCK" && (
                          <p className="text-gray-700 text-sm">
                            <strong>Count Status:</strong> {selectedCount}
                          </p>
                        )}

                        <p className="text-gray-700 text-sm">
                          <strong>Type:</strong> {selectedType}
                        </p>
                      </div>

                      {(selectedType === "GRN" || selectedType === "PRN") && (
                        <div className="border-t pt-1 sm:pt-2">
                          <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                            Vendor Information
                          </p>
                          <p className="text-gray-700 text-sm">
                            <strong>Vendor Code:</strong> {selectedVendor}
                          </p>
                          <p className="text-gray-700 text-sm">
                            <strong>Vendor Name:</strong> {selectedVendorName}
                          </p>
                          <p className="text-gray-700 text-sm">
                            <strong>Invoice No:</strong> {invoiceNo}
                          </p>
                        </div>
                      )}

                      <div className="border-t pt-1 sm:pt-2">
                        <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                          Product Information
                        </p>
                        <p className="text-gray-700 text-sm">
                          <strong>Product Code:</strong>{" "}
                          {salesData.PRODUCT_CODE}
                        </p>
                        <p className="text-gray-700 text-sm">
                          <strong>Product Name:</strong>{" "}
                          {salesData.PRODUCT_NAMELONG}
                        </p>
                        <p className="text-gray-700 text-sm">
                          <strong>Cost Price:</strong> {costPrice}
                        </p>
                        <p className="text-gray-700 text-sm">
                          <strong>Unit Price: </strong> {salesPrice}
                        </p>
                      </div>

                      <div className="border-t pt-1 sm:pt-2">
                        <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                          Amount
                        </p>
                        <p className="text-gray-700 text-sm">
                          <strong>Stock: </strong>
                          {isNaN(Number(amount))
                            ? "0.000"
                            : Number(amount).toFixed(3)}
                        </p>

                        <form
                          onSubmit={handleSubmit}
                          className="flex flex-col space-y-2 sm:space-y-4"
                        >
                          {state && (
                            <div className="flex flex-col space-y-1 sm:space-y-2">
                            <div className="flex flex-col sm:flex-row sm:space-x-2">
                              <p className="text-gray-700 text-sm">
                                <strong>Quantity: </strong>
                              </p>
                              {colorWiseTableData.length > 0 ? (
                                <div className="overflow-x-auto w-full mt-2 sm:mt-4">
                                  <div
                                    className="w-full max-w-full"
                                    ref={tableRef}
                                  >
                                    <Table
                                      headers={colorWiseHeaders}
                                      data={colorWiseTableData}
                                      editableColumns={[
                                        {
                                          index: 3,
                                          type: "number",
                                          step: "any",
                                        },
                                      ]}
                                      onRowChange={handleRowChange}
                                      bin={true}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  id="quantity"
                                  ref={quantityRef}
                                  value={quantity}
                                  onChange={(e) => setQuantity(e.target.value)}
                                  className="mt-1 px-2 sm:px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none w-full text-sm"
                                  placeholder="Enter quantity"
                                  step="1"
                                  min="0"
                                />
                              )}
                            </div>

                            {/* Display error message under the input field */}
                            {quantityError && (
                              <p className="text-red-500 text-sm mt-1">
                                {quantityError}
                              </p>
                            )}

                            
                          <div className="flex justify-center items-center">
                            <button
                              onClick={handleProductSubmit}
                              disabled={disable}
                              className={`bg-[#f17e21] hover:bg-[#efa05f] text-white px-3 sm:px-4 py-2 rounded-lg mt-2 sm:mt-4 w-full sm:w-1/2 ${
                                disable ? "opacity-50 cursor-not-allowed" : ""
                              } text-sm`}
                            >
                              Enter
                            </button>
                          </div>
                          </div>

                          
                          )}
                          

                        </form>
                      </div>
                    </div>
                  </div>
                  
                  
                  {alert && (
                    <Alert
                      message={alert.message}
                      type={alert.type}
                      onClose={() => setAlert(null)}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {(selectedType === "GRN" ||
            selectedType === "PRN" ||
            selectedType === "TOG") &&
            newTableData.length !== 0 && (
              <div className="flex flex-col w-full max-w-full mt-4 sm:mt-6">
                {/* Label: always centered */}
                <div className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4 text-center w-full">
                  {selectedType}
                </div>

                {/* Scrollable Table Container */}
                <div className="overflow-x-auto w-full">
                  <div className="w-full max-w-full">
                    <Table
                      headers={headers}
                      data={filteredTableData.map((item) => item.rowData)}
                      editableColumns={editableColumns}
                      formatColumns={
                        selectedType === "TOG" ? [4, 5, 6, 7] : [6, 7, 8, 9]
                      }
                      formatColumnsQuantity={
                        selectedType === "TOG" ? [6, 7] : [8, 9]
                      }
                      bin="f"
                      onRowClick={(rowData, rowIndex) =>
                        handleRowClick(rowData, rowIndex)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
export default App;
