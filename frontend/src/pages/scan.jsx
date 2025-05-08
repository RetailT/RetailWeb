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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [loading, setLoading] = useState(true);
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
  const [remarks, setRemarks] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [companyToError, setCompanyToError] = useState("");
  const [vendorError, setVendorError] = useState("");
  const [newTableData, setTableData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [typeError, setTypeError] = useState("");
  const [countError, setCountError] = useState("");
  const [invoiceNoError, setInvoiceNoError] = useState("");
  const [code, setCode] = useState("");
  const [initialData, setInitialData] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [alert, setAlert] = useState(null);
  const [quantityError, setQuantityError] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [salesData, setSalesData] = useState([]);
  const [disable, setDisable] = useState(false);

  const quantityRef = useRef(null);
  const codeRef = useRef(null);

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
 
  
  if(grn==='T'){
    typeOptions.push('GRN');
  }
  if(prn==='T'){
    typeOptions.push('PRN');
  }
  if(tog==='T'){
    typeOptions.push('TOG');
  }
  if(stock_scan==='T'){
    typeOptions.push('STOCK');
  }

  let costPrice = (salesData.COSTPRICE || 0).toFixed(2);
  let salesPrice = (salesData.SCALEPRICE || 0).toFixed(2);

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}companies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.data.userData && response.data.userData.length > 0) {
        // Map through all userData and get all options
        const companies = response.data.userData.map((data) => ({
          code: data.COMPANY_CODE.trim(),
          name: data.COMPANY_NAME.trim(),
        }));
        setCompanies(companies);
      }
    } catch (err) {
      setError("Failed to fetch dashboard data");

      console.error("Error fetching dashboard data:", err);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}vendors`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.data.vendorData && response.data.vendorData.length > 0) {
        // Map through all userData and get all options
        const vendors = response.data.vendorData.map((data) => ({
          code: data.VENDORCODE.trim(),
          name: data.VENDORNAME.trim(),
        }));
        setVendors(vendors);
      }
    } catch (err) {
      setError("Failed to fetch dashboard data");

      console.error("Error fetching dashboard data:", err);
    }
  };

  const getCameraStream = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "environment" },
      });
      setHasCameraPermission(true);
    } catch (error) {
      console.error("Camera Error:", error);
      setCameraError("Camera access denied or not available.");
      setHasCameraPermission(false);
    }
  };

  useEffect(() => {
    if (!token) {
      console.error("No token found in localStorage");
      setError("No token found");
      setLoading(true);
      return;
    }
    fetchCompanies();
    fetchVendors();
  }, []);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const requestData = async (data) => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}scan`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          data: data,
          company: selectedCompany,
        },
      });

      setSalesData(response.data.salesData[0]);
      setAmount(response.data.amount);
      
      setLoading(false);
      setTimeout(() => {
        if (quantityRef.current) {
          quantityRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          quantityRef.current.focus(); // Focus after scrolling
        }
      }, 100);
    } catch (err) {
      setSalesData([]);
      setAmount("");
      setAlert({
        message: err.response?.data?.message || "Item finding failed",
        type: "error",
      });

      // Dismiss alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const handleScan = (err, result) => {
    if (err) {
      if (err.name === "NotFoundException") {
        return; // Ignore NotFoundException to prevent screen blocking
      }
      console.warn("Scan Error:", err);
      toast.error("Scanner encountered an issue.");
    }

    if (result) {
      // Play beep sound on a successful scan
      const beep = new Audio(
        "https://www.myinstants.com/media/sounds/beep.mp3"
      );
      beep.play().catch((error) => console.error("Beep sound error:", error));

      setCurrentData(result.text);
      setCode("");
      
      toast.success(`Product scanned: ${result.text}`);

      requestData(result.text);
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

    if (!code) {
      setCodeError("Code is required.");
      valid = false;
    }
    if (valid) {
      setCurrentData("");
      requestData(code);
    }
  };

  const tableData = async () => {
    try {
      
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}grnprn-table-data`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          name: username,
          code: selectedCompany,
        },
      });
      
      const grnData = response.data.grnData;
      const prnData = response.data.prnData;
      const togData = response.data.togData;
      
      if (selectedType === 'GRN' && grnData.length > 0 ) {
        // Extract keys from the first object, excluding "IDX"
        const keys = Object.keys(grnData[0]).filter((key) => key !== "IDX" && key !== "TYPE");
        
        // Custom heading mapping
        const customHeadingMap = {
          INVOICE_NO: "Invoice No",
          COMPANY_CODE: "Company Code",
          VENDOR_CODE: "Vendor Code",
          VENDOR_NAME: "Vendor Name",
          PRODUCT_CODE: "Product Code",
          PRODUCT_NAMELONG: "Product Name",
          COSTPRICE: "Cost Price",
          UNITPRICE: "Unit Price",
          CUR_STOCK: "Current Stock",
          PHY_STOCK: "Physical Stock",
        };

        const customHeaders = keys.map((key) => customHeadingMap[key] || key);

        setHeaders(customHeaders);

        // Map the data, include "IDX" as hidden in each row
        const gData = grnData.map((row) => ({
          idx: row.IDX, // Store IDX for later reference
          rowData: keys.map((key) => row[key]), // Data excluding IDX
        }));
        setEnteredProduct('submitted')
        setTableData(gData);
        setInitialData(true);
      }
      else if (selectedType === 'PRN' && prnData.length > 0 ) {
        // Extract keys from the first object, excluding "IDX"
        const keys = Object.keys(prnData[0]).filter((key) => key !== "IDX" && key !== "TYPE");
        
        // Custom heading mapping
        const customHeadingMap = {
          INVOICE_NO: "Invoice No",
          COMPANY_CODE: "Company Code",
          VENDOR_CODE: "Vendor Code",
          VENDOR_NAME: "Vendor Name",
          PRODUCT_CODE: "Product Code",
          PRODUCT_NAMELONG: "Product Name",
          COSTPRICE: "Cost Price",
          UNITPRICE: "Unit Price",
          CUR_STOCK: "Current Stock",
          PHY_STOCK: "Physical Stock",
        };

        const customHeaders = keys.map((key) => customHeadingMap[key] || key);

        setHeaders(customHeaders);

        // Map the data, include "IDX" as hidden in each row
        const pData = prnData.map((row) => ({
          idx: row.IDX, // Store IDX for later reference
          rowData: keys.map((key) => row[key]), // Data excluding IDX
        }));
        setEnteredProduct('submitted')
        setTableData(pData);
        setInitialData(true);
      }
      else if (selectedType === 'TOG' && togData.length > 0 ) {
        // Extract keys from the first object, excluding "IDX"
        const keys = Object.keys(togData[0]).filter((key) => key !== "IDX" && key !== "TYPE");
        
        // Custom heading mapping
        const customHeadingMap = {
          COMPANY_CODE: "Company Code",
          COMPANY_TO_CODE: "Company To Code",
          PRODUCT_CODE: "Product Code",
          PRODUCT_NAMELONG: "Product Name",
          COSTPRICE: "Cost Price",
          UNITPRICE: "Unit Price",
          CUR_STOCK: "Current Stock",
          PHY_STOCK: "Physical Stock",
        };

        const customHeaders = keys.map((key) => customHeadingMap[key] || key);

        setHeaders(customHeaders);

        // Map the data, include "IDX" as hidden in each row
        const tData = togData.map((row) => ({
          idx: row.IDX, // Store IDX for later reference
          rowData: keys.map((key) => row[key]), // Data excluding IDX
        }));
        setEnteredProduct('submitted')
        setTableData(tData);
        setInitialData(true);
      }
      else{
        if(selectedType !== 'STOCK'){
          setAlert({
            message: "No data found",
            type: "error",
          });
        }
        
      }
      setLoading(false);

    } catch (err) {
      setLoading(false);
      if(selectedType !== 'STOCK'){
      setAlert({
        message: err.response?.data?.message || "Stock data finding failed",
        type: "error",
      });
    }
      // Dismiss alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
    }
  };

    const handleDeleteRow = async (rowIndex) => {
      
      const deletedRow = newTableData[rowIndex];
      const idxValue = deletedRow.idx; // Access the IDX value of the row being deleted

      try {
        const response = await axios.delete(
          `${process.env.REACT_APP_BACKEND_URL}grnprn-delete`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              idx: idxValue,
              type: selectedType
            },
          }
        );
        
        if (response.data.message === "Data deleted successfully") {
          tableData();
          setAlert({
            message: response.data.message || "Item deleted successfully",
            type: "success",
          });
          // Dismiss alert after 3 seconds
          setTimeout(() => setAlert(null), 3000);
        }
      } catch (err) {
        // Handle any errors that occur
        setAlert({
          message: err.response?.data?.message || "Item deletion failed",
          type: "error",
        });
  
        // Dismiss alert after 3 seconds
        setTimeout(() => setAlert(null), 3000);
      }
    };
  
    const handleTableDataSubmit = async () => {
      
      try {
        setDisable(true);
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}final-grnprn-update`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            username: username,
            company: selectedCompany,
            type: selectedType,
            remarks: remarks
          },
        });
  
        if (response.data.message === "Data moved and deleted successfully") {
          
          setDisable(false);
          setAlert({
            message: response.data.message || "Data moved successfully",
            type: "success",
          });
          setTimeout(() => {
            setAlert(null); // Clear the alert
            setTimeout(() => {
              setShowTable(false); // Hide the table after 3 seconds
              window.location.reload(); // Refresh the page
            }, 200); // Add a small delay before reloading
          }, 3000);
        
        }
        else {
          // setInitialData(false);
          // setDisable(false);
          setAlert({
            message: response.data.message || "Cannot move data",
            type: "success",
          });
          // Dismiss alert after 3 seconds
          setTimeout(() => setAlert(null), 3000);
        }
        setDisable(false);
      } catch (err) {
        setDisable(false);
        // Handle any errors that occur
        setAlert({
          message: err.response?.data?.message || "Data deletion failed",
          type: "error",
        });
  
        // Dismiss alert after 3 seconds
        setTimeout(() => setAlert(null), 3000);
      }
    };

  const handleDataSubmit = async (e) => {
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
    if (
      (selectedType === "GRN" || selectedType === "PRN") &&
      !selectedVendor
    ) {
      setVendorError("Vendor is required.");
      valid = false;
    } else {
      setVendorError("");
    }

    if (
      (selectedType === "GRN" || selectedType === "PRN") &&
      !invoiceNo
    ) {
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
    if (selectedCompany && (selectedType === "GRN" || selectedType === "PRN") && selectedVendor && invoiceNo) {
      valid = true;
    }
    if (selectedCompany && selectedType === "TOG" && selectedToCompany) {
      if (selectedCompany === selectedToCompany) {
        setCompanyToError("Company and Company To cannot be the same.");
        valid = false;
      }
      else{
        valid = true;
      }   
    }

   // Final check before proceeding
    if (valid) {
      setInitialData(true);
      setHasCameraPermission(true);
      getCameraStream();
    }
  };

  const handleProductSubmit = async (e) => {
    
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
              quantity: quantity
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
        }
        else if (selectedType === "GRN" || selectedType === "PRN") {
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
        }
        else if (selectedType === "TOG") {
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
              quantity: quantity
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
  };

  return (
    <div>
      <Navbar />
      {/* Main Layout */}
      <div className="flex">
       
        <div
          className={`transition-all duration-300 flex-1 p-10`}
          style={{
            marginLeft: isSidebarOpen ? "15rem" : "4rem", // Space for sidebar
            marginTop: "96px", // Space for Navbar
          }}
        >
          <div className="ml-[-60px] sm:ml-[-50px]">
            <Heading text="Scan" />
          </div>

          {!initialData && (
            <div
              className="bg-white p-5 rounded-md shadow-md mb-5 mt-10 ml-[-60px] sm:ml-[-50px]"
              style={{ backgroundColor: "#d8d8d8" }}
            >
              {/* Flex container for responsive layout */}
              <div className="flex flex-col sm:flex-col lg:flex-row justify-center gap-4">
                {/* Company Dropdown */}
                <div className="relative flex flex-col gap-2 w-full lg:w-60">
                  <label className="block text-sm font-medium text-gray-700">
                    Select a Company
                  </label>
                  <select
                    value={selectedCompany}
                    onChange={handleCompanyChange}
                    className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-left overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ minHeight: "40px" }}
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
                    <p className="text-red-500 text-sm mt-1 mb-4">
                      {companyError}
                    </p>
                  )}
                </div>

                

                {/* Type Dropdown */}
                <div className="relative flex flex-col gap-2 w-full lg:w-60">
                  <label className="block text-sm font-medium text-gray-700">
                    Select a Type
                  </label>
                  <select
                    value={selectedType}
                    onChange={handleTypeChange}
                    className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-left overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ minHeight: "40px" }}
                  >
                    <option value="" disabled>
                      Select a Type
                    </option>
                    {typeOptions.map((name, index) => (
                      <option key={index} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {typeError && (
                    <p className="text-red-500 text-sm mt-1 mb-4">
                      {typeError}
                    </p>
                  )}
                </div>

                {(selectedType === "GRN" || selectedType === "PRN" ) && (
                  
                <div className="relative flex flex-col gap-2 w-full lg:w-60">
                  {/* Vendor Dropdown */}
                <label className="block text-sm font-medium text-gray-700">
                  Select Vendor
                </label>
                <select
                  value={selectedVendor}
                  onChange={handleVendorChange}
                  className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-left overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ minHeight: "40px" }}
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
                  <p className="text-red-500 text-sm mt-1 mb-4">
                    {vendorError}
                  </p>
                )}

              <label className="block text-sm font-medium text-gray-700">
                Invoice No
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white"
                placeholder="Enter Invoice No"
              />
                {invoiceNoError && (
                  <p className="text-red-500 text-sm mt-1 mb-4">
                    {invoiceNoError}
                  </p>
                )}
              </div>
                )}

                {(selectedType === "TOG") && (
                  <div className="relative flex flex-col gap-2 w-full lg:w-60">
                  <label className="block text-sm font-medium text-gray-700">
                    Company To
                  </label>
                  <select
                    value={selectedToCompany}
                    onChange={handleToCompanyChange}
                    className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-left overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ minHeight: "40px" }}
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
                    <p className="text-red-500 text-sm mt-1 mb-4">
                      {companyToError}
                    </p>
                  )}
                </div>
                  )}

                {selectedType === "STOCK" && (
                  <div className="relative flex flex-col gap-2 w-full lg:w-60">
                    {/* Count Dropdown */}
                    <label className="block text-sm font-medium text-gray-700">
                      Select a Count
                    </label>
                    <select
                      value={selectedCount}
                      onChange={handleCountChange}
                      className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-left overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ minHeight: "40px" }}
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
                      <p className="text-red-500 text-sm mt-1 mb-4">
                        {countError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button - Responsive Positioning */}
              <div className="flex justify-center lg:justify-end mt-2">
                <button
                  onClick={handleDataSubmit}
                  className="bg-black hover:bg-gray-800 text-white font-semibold py-2 px-5 rounded-md shadow-md transition-all"
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {initialData && (
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
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="text"
                        id="code"
                        ref={codeRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="px-3 py-2 w-64 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none"
                        placeholder="Enter Code"
                      />
                      <button
                        type="submit"
                        className="bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded-lg"
                      >
                        Search
                      </button>
                    </form>
                  </div>
                  {codeError && (
                    <p className="text-red-500 text-sm mt-1 mb-4">
                      {codeError}
                    </p>
                  )}
                  <Toaster position="top-right" reverseOrder={false} />
                  {cameraError && <div className="error">{cameraError}</div>}

                  {hasCameraPermission ? (
                    <div className="text-center">
                      <div
                        className="scan border border-gray-400 rounded-lg bg-gray-200 flex justify-center items-center"
                        style={{
                          width: "320px", // Default size
                          height: "320px",
                          maxWidth: "100vw",
                        }}
                      >
                        {scannerEnabled ? (
                          <BarcodeScannerComponent
                            width={320}
                            height={320}
                            className="w-full h-full object-cover"
                            onUpdate={handleScan}
                            delay={1000}
                            onError={(error) => {
                              console.error("Scanner Error:", error);
                              toast.error("Scanner error: Please try again.");
                            }}
                          />
                        ) : (
                          <CameraOff size={80} className="text-gray-600" /> // Icon stays centered inside fixed box
                        )}
                      </div>
                      <button
                        className="bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded mt-6"
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

                  <div className="bg-white p-5 rounded-md shadow-md mb-5 mt-10">
                    <div className="text-lg font-semibold mb-4 text-[#f17e21]">
                      Product Details
                    </div>

                    <div className="space-y-2">
                      <div className="border-t pt-2">
                        <p className="font-medium text-[#bc4a17] mb-3">
                          Scanned Data
                        </p>
                        <p className="text-gray-700">
                          <strong>Readed Code:</strong>{" "}
                          {code ? code : currentData}
                        </p>
                      </div>

                      <div className="border-t pt-2">
                        <p className="font-medium text-[#bc4a17] mb-3">
                          Company Information
                        </p>
                        <p className="text-gray-700">
                          <strong>Company Code:</strong> {selectedCompany}
                        </p>
                        <p className="text-gray-700">
                          <strong>Company Name:</strong> {selectedCompanyName}
                        </p>
                        {selectedType === "TOG" && (
                          <div>
                            <p className="text-gray-700">
                          <strong>To Company Code:</strong> {selectedToCompany}
                        </p>
                        <p className="text-gray-700">
                        <strong>To Company Name:</strong> {selectedToCompanyName}
                      </p>
                          </div>
                        )}

                        {selectedType === "STOCK" && (
                          <p className="text-gray-700">
                          <strong>Count Status:</strong> {selectedCount}
                        </p>
                        )}
                        
                        <p className="text-gray-700">
                          <strong>Type:</strong> {selectedType}
                        </p>
                      </div>

                      {(selectedType === "GRN" || selectedType === "PRN") && (
                        <div className="border-t pt-2">
                        <p className="font-medium text-[#bc4a17] mb-3">
                          Vendor Information
                        </p>
                        <p className="text-gray-700">
                          <strong>Vendor Code:</strong> {selectedVendor}
                        </p>
                        <p className="text-gray-700">
                          <strong>Vendor Name:</strong> {selectedVendorName}
                        </p>
                        <p className="text-gray-700">
                          <strong>Invoice No:</strong> {invoiceNo}
                        </p>
                        
                      </div>
                      )}


                      <div className="border-t pt-2">
                        <p className="font-medium text-[#bc4a17] mb-3">
                          Product Information
                        </p>
                        <p className="text-gray-700">
                          <strong>Product Code:</strong>{" "}
                          {salesData.PRODUCT_CODE}
                        </p>
                        <p className="text-gray-700">
                          <strong>Product Name:</strong>{" "}
                          {salesData.PRODUCT_NAMELONG}
                        </p>
                        <p className="text-gray-700">
                          <strong>Cost Price:</strong> {costPrice}
                        </p>
                        <p className="text-gray-700">
                          <strong>Unit Price: </strong> {salesPrice}
                        </p>
                      </div>

                      <div className="border-t pt-2">
                        <p className="font-medium text-[#bc4a17] mb-3">
                          Amount
                        </p>
                        <p className="text-gray-700">
                          <strong>Stock: </strong> {amount}
                        </p>
                        <form
                          onSubmit={handleSubmit}
                          className="flex flex-col space-y-4"
                        >
                          <div className="flex flex-col space-y-2">
                            <div className="flex space-x-2">
                              <p className="text-gray-700">
                                <strong>Quantity: </strong>
                              </p>
                              <input
                                type="number"
                                id="quantity"
                                ref={quantityRef}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none"
                                placeholder="Enter quantity"
                                step="1" // This ensures only integers are allowed
                                min="0" // Optional: restrict to positive numbers only
                              />
                            </div>

                            {/* Display error message under the input field */}
                            {quantityError && (
                              <p className="text-red-500 text-sm mt-1">
                                {quantityError}
                              </p>
                            )}
                          </div>

                          <div className="flex justify-center items-center">
                            <button
                              onClick={handleProductSubmit}
                              disabled={loading}
                              className={`bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded-lg mt-5 w-1/2 ${
                                loading ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            >
                              Enter
                            </button>
                          </div>
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
              {((selectedType === "GRN" || selectedType === "PRN" || selectedType === "TOG") && newTableData && showTable && enteredProduct==='submitted') && (
                <div>
                  <div className="text-2xl font-bold mt-5">
                      {selectedType}
                    </div>
                  <div className="flex flex-col items-start p-3 gap-2">
                  <div>
                  <label className="block text-sm mt-5 font-medium text-gray-700">
                Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="min-w-[800px] max-w-xl border border-gray-300 p-2 rounded-md shadow-sm bg-white"
                placeholder="Enter Remarks"
              />
                  </div>
                  
                    <button
                      onClick={handleTableDataSubmit}
                      disabled={disable}
                      className={`bg-[#f17e21] hover:bg-[#efa05f] mt-3 text-white px-4 py-2 rounded-lg w-1/4 text-center ${
                        disable ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Save
                    </button>
                   
                  </div>
                  <div className="flex justify-start overflow-x-auto">
                                    <Table
                                      headers={headers}
                                      data={newTableData.map((item) => item.rowData)}
                                      editableColumns={editableColumns}
                                      // onRowChange={handleRowChange}
                                      onDeleteRow={handleDeleteRow}
                                      formatColumns={[6,7,8,9]}
                                    />
                                  </div>
                </div>
                 
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
