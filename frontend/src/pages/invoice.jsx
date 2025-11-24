import { useState, useEffect, useRef, useContext } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../components/NavBar";
import { AuthContext } from "../AuthContext";
import Heading from "../components/Heading";
import Table from "../components/EditableTable";
import Alert from "../components/Alert";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { toast, Toaster } from 'react-hot-toast';
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { CameraOff } from "lucide-react";


function App() {
  const { authToken } = useContext(AuthContext);
  const [data, setData] = useState([]);

  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [disable, setDisable] = useState(false);
  const [headers, setHeaders] = useState([]);
  
  const [invoice, setInvoice] = useState([]);
  const [uniqueRepUsers, setUniqueRepUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState(null);
  const [remarks, setRemarks] = useState("");
  const token = localStorage.getItem("authToken");
  const editableColumns = [{ index: 17, type: "number", step: "any" }];
  const decodedToken = jwtDecode(token);
  const username = decodedToken.username;

  const [currentData, setCurrentData] = useState("No result");
  const [cameraError, setCameraError] = useState(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState(null);
  const [selectedToCompanyName, setSelectedToCompanyName] = useState(null);
  const [selectedVendorName, setSelectedVendorName] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedCount, setSelectedCount] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [enteredProduct, setEnteredProduct] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedToCompany, setSelectedToCompany] = useState("");
  const [codeError, setCodeError] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [state, setState] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [companyToError, setCompanyToError] = useState("");
  const [newTableData, setTableData] = useState([]);
  const [typeError, setTypeError] = useState("");
  const [countError, setCountError] = useState("");
  const [invoiceNoError, setInvoiceNoError] = useState("");
  const [code, setCode] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const [initialData, setInitialData] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [quantityError, setQuantityError] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [salesData, setSalesData] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [names, setNames] = useState([]);
  const [colorWiseTableData, setColorWiseTableData] = useState([]);
  const [colorWiseHeaders, setColorWiseHeaders] = useState([]);
  const [invoiceTableData, setInvoiceTableData] = useState([]);
  const [invoiceTableHeaders, setInvoiceTableHeaders] = useState([]);
  
  const quantityRef = useRef(null);
  const discountRef = useRef(null);
  const tableRef = useRef(null);
  const codeRef = useRef(null);
  const streamRef = useRef(null);
  
  const grn = decodedToken.t_grn;
  const prn = decodedToken.t_prn;
  const tog = decodedToken.t_tog;
  const stock_scan = decodedToken.t_stock;
  const stock_update = decodedToken.t_stock_update;
  

  useEffect(() => {
    if (headers.length > 0 && data.length > 0) {
      const repUserIndex = headers.indexOf("REPUSER");
      if (repUserIndex !== -1) {
        const repUsers = [
          ...new Set(
            data
              .map((item) => item.rowData[repUserIndex]?.trim())
              .filter(Boolean)
          ),
        ];
        setUniqueRepUsers(repUsers);
      }
    }
  }, [headers, data]);

  useEffect(() => {
    if (!token) {
      console.error("No token found in localStorage");
      setError("No token found");
      return;
    } else {
      fetchCompanies();
      fetchCustomers();
    }
  }, []);

  useEffect(() => {
    if (!token) {
      console.error("No token found in localStorage");
      setError("No token found");
      setDisable(true);
      return;
    }
    fetchCompanies();
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

  useEffect(() => {
    if (salesData.SCALEPRICE && quantity) {
      const unitPrice = parseFloat(salesData.SCALEPRICE) || 0;
      const qty = parseFloat(quantity) || 0;
      const disc = parseFloat(discount) || 0;
      
      const subtotal = unitPrice * qty;
      const discountAmount = subtotal * (disc / 100);
      const total = subtotal - discountAmount;
      
      // You can set these to state if needed
      // setSubtotal(subtotal);
      // setTotal(total);
    }
  }, [salesData.SCALEPRICE, quantity, discount]);
  
  
// Updated useEffect to load table data with proper conditions
useEffect(() => {
  const calculateDiscountAmount = () => {
    const unitPrice = parseFloat(salesData.SCALEPRICE) || 0;
    const qty = parseFloat(quantity) || 0;
    const subtotal = unitPrice * qty;
    
    if (!discount) {
      setDiscountAmount(0);
      return;
    }

    let discountValue = discount.toString().trim();
    let calculatedDiscountAmount = 0;

    // Percentage discount (contains %)
    if (discountValue.includes("%")) {
      let percent = parseFloat(discountValue.replace("%", ""));
      if (!isNaN(percent)) {
        calculatedDiscountAmount = subtotal * (percent / 100);
      }
    } 
    // Direct discount (normal amount)
    else {
      let amount = parseFloat(discountValue);
      if (!isNaN(amount)) {
        calculatedDiscountAmount = amount;
      }
    }
    
    setDiscountAmount(calculatedDiscountAmount);
  };
  
  calculateDiscountAmount();
  
  // Only fetch table data if company and customer are selected
  if (initialData && selectedCompany && selectedCustomer) {
    fetchInvoiceTableData();
  }
}, [discount, quantity, salesData.SCALEPRICE, initialData, selectedCompany, selectedCustomer]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }
  
  const fetchStockData = async () => {
    try {
      setDisable(true);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}stock-update-invoice`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            code: selectedCompany,
            name: selectedCompanyName,
          },
        }
      );

      const stockData = response.data.stockData;

      if (stockData.length > 0) {
        // Extract keys from the first object, excluding "IDX"
        const keys = Object.keys(stockData[0]).filter(
          (key) => key !== "IDX" && key !== "TYPE"
        );

        // Custom heading mapping
        const customHeadingMap = {
          COMPANY_CODE: "Company Code",
          COUNT_STATUS: "Count Status",
          PRODUCT_CODE: "Product Code",
          VENDOR_CODE: "Vendor Code",
          VENDOR_NAME: "Vendor Name",
          INVOICE_NO: "Invoice Number",
          PRODUCT_NAMELONG: "Product Name",
          COSTPRICE: "Cost Price",
          UNITPRICE: "Unit Price",
          CUR_STOCK: "Current Stock",
          PHY_STOCK: "Physical Stock",
          COMPANY_TO_CODE: "Company To Code",
          SERIALNO: "Serial No",
          COLORCODE: "Color Code",
          SIZECODE: "Size Code",
        };

        const customHeaders = keys.map((key) => customHeadingMap[key] || key);

        setHeaders(customHeaders);

        // Map the data, include "IDX" as hidden in each row
        const orderedData1 = stockData.map((row) => ({
          idx: row.IDX, // Store IDX for later reference
          rowData: keys.map((key) => row[key]), // Data excluding IDX
        }));

        setData(orderedData1);
        setInitialData(true);

        const invoiceIndex = customHeaders.indexOf("Invoice Number");
        if (invoiceIndex !== -1) {
          const invoiceList = [
            ...new Set(
              orderedData1
                .map((item) => item.rowData[invoiceIndex]?.trim())
                .filter(Boolean)
            ),
          ];
          setInvoice(invoiceList);
        }
      }

      if (stockData.length === 0) {
        
        setAlert({
          message: "No data available",
          type: "error",
        });

        // Dismiss alert after 3 seconds
        setTimeout(() => {
          setAlert(null);
        }, 3000);
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
        // window.location.reload(); // Full page reload
      }, 3000);
      setDisable(false);
    }
  };

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
        const companies = response.data.userData
          .map((data) => ({
            code: data.COMPANY_CODE ? data.COMPANY_CODE.trim() : "",
            name: data.COMPANY_NAME ? data.COMPANY_NAME.trim() : "",
          }))
          .filter((c) => c.code && c.name);
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
  
  const fetchCustomers = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}customers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.userData && response.data.userData.length > 0) {
        const customers = response.data.userData.map((data) => ({
          code: data.CUSTOMER ? data.CUSTOMER.trim() : "",
          name: data.CUSTOMER_NAME ? data.CUSTOMER_NAME.trim() : "",
        })).filter(c => c.code && c.name);
        setCustomers(customers);
      } else {
        setAlert({ message: response.data.message || "No customers found", type: "error" });
        setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setError("Failed to fetch customers");
      console.error("Error fetching customers:", err);
    }
  };


  const handleCompanyChange = (event) => {
  const selectedCode = event.target.value;

  const selectedCompanyObj = companies.find(
    (company) => company.code === selectedCode
  );

  setSelectedCompany(selectedCode);

  if (selectedCompanyObj) {
    setSelectedCompanyName(selectedCompanyObj.name);
  }
};

  
  const handleCustomerChange = (event) => {
    const selectedCustomer = event.target.value;
    const selectedCustomerName = customers.find(
      (customer) => customer.code === selectedCustomer
    );

    // Store the customer code in setSelectedCustomer
    setSelectedCustomer(selectedCustomer);

    // Store the customer name in setSelectedCustomerName
    if (selectedCustomerName) {
      setSelectedCustomerName(selectedCustomerName.name);
    }
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  console.log("Submit clicked", selectedCompany, selectedCustomer);

  let valid = true;

  // Validate company
  if (!selectedCompany) {
    setCompanyError("Company is required.");
    valid = false;
  } else {
    setCompanyError("");
  }

  // Validate customer
  if (!selectedCustomer) {
    setCustomerError("Customer is required.");
    valid = false;
  } else {
    setCustomerError("");
  }

  if (!valid) return; // Stop if either is missing

  // Fetch data if both are selected
  try {
    setDisable(true); // disable button while fetching
    await fetchStockData({
      companyCode: selectedCompany,
      companyName: selectedCompanyName,
      customerCode: selectedCustomer,
      customerName: selectedCustomerName,
    });

    setInitialData(true);
    setHasCameraPermission(true);
  
  } catch (err) {
    console.error("Error fetching data:", err);
    setAlert({ message: "Failed to fetch data", type: "error" });
    setTimeout(() => setAlert(null), 3000);
  } finally {
    setDisable(false); // re-enable button
  }
};

  let costPrice = (salesData.COSTPRICE || 0).toFixed(2);
  let salesPrice = (salesData.SCALEPRICE || 0).toFixed(2);

  // const fetchCompanies = async () => {
  //   try {
  //     const response = await axios.get(
  //       `${process.env.REACT_APP_BACKEND_URL}companies`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );
  //     if (response.data.userData && response.data.userData.length > 0) {
  //       // Map through all userData and get all options
  //       const companies = response.data.userData.map((data) => ({
  //         code: data.COMPANY_CODE.trim(),
  //         name: data.COMPANY_NAME.trim(),
  //       }));
  //       setCompanies(companies);
  //     }
  //     else{
  //       setDisable(false);
  //       setAlert({ message: response.data.message || "Error Occured", type: "error" });
  //     setTimeout(() => setAlert(null), 3000);
  //     }
  //   } catch (err) {
  //     setError("Failed to fetch dashboard data");

  //     console.error("Error fetching dashboard data:", err);
  //   }
  // };

  // const fetchVendors = async () => {
  //   try {
  //     const response = await axios.get(
  //       `${process.env.REACT_APP_BACKEND_URL}vendors`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );
  //     if (response.data.vendorData && response.data.vendorData.length > 0) {
  //       // Map through all userData and get all options
  //       const vendors = response.data.vendorData.map((data) => ({
  //         code: data.VENDORCODE.trim(),
  //         name: data.VENDORNAME.trim(),
  //       }));
  //       setVendors(vendors);
  //     }
  //     else{
  //       setDisable(false);
  //       setAlert({ message: response.data.message || "Error Occured", type: "error" });
  //     setTimeout(() => setAlert(null), 3000);
  //     }
  //   } catch (err) {
  //     setError("Failed to fetch dashboard data");

  //     console.error("Error fetching dashboard data:", err);
  //   }
  // };

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

      if((response.data.colorwiseActive === true || String(response.data.colorwiseActive).toLowerCase() === "true") && response.data.colorWiseData.length === 0){
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
      //   setAlert({ message: response.data.message || "Error Occured", type: "error" });
      // setTimeout(() => setAlert(null), 3000);
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

  const handleRowChange = (rowIndex, cellIndex, newValue) => {
    if (parseFloat(newValue) < 0) return; // do nothing if negative

    const updatedData = [...colorWiseTableData];
    updatedData[rowIndex][cellIndex] = newValue;
    setColorWiseTableData(updatedData);
  };

  const handleSearchClick = () => {
    setCodeError("");
    
    if (!code && !inputValue) {
      setCodeError("Code or name is required.");
      return;
    }
    
    requestData(code, inputValue);
  };

  // Add this function to your component
  const formatDiscountDisplay = (discountValue) => {
  if (!discountValue && discountValue !== 0) return '0';
  
  const discountStr = String(discountValue).trim();
  
  // If it already contains %, return as is
  if (discountStr.includes('%')) {
    return discountStr;
  }
  
  // If it's a number
  const numValue = parseFloat(discountStr);
  if (!isNaN(numValue)) {
    // Only add % for numbers less than 100 (not including 100)
    if (numValue < 100) {
      if (numValue % 1 === 0) {
        return `${numValue}%`;
      } else {
        return `${numValue.toFixed(2)}%`;
      }
    } else {
      // For 100 and above, show as fixed amount without %
      return numValue.toFixed(2);
    }
  }
  
  return discountStr;
};

  const calculateTotal = () => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(salesData.SCALEPRICE) || 0;
  const subtotal = price * qty;

  if (!discount) return subtotal.toFixed(2);

  let discountValue = discount.toString().trim();
  let discountAmount = 0;

  // Percentage discount (contains %)
  if (discountValue.includes("%")) {
    let percent = parseFloat(discountValue.replace("%", ""));
    if (!isNaN(percent)) {
      discountAmount = subtotal * (percent / 100);
    }
  } 
  // Direct discount (normal amount)
  else {
    let amount = parseFloat(discountValue);
    if (!isNaN(amount)) {
      discountAmount = amount;
    }
  }

  const total = subtotal - discountAmount;
  return total.toFixed(2);
};

  const fetchInvoiceTableData = async () => {
  try {
    setDisable(true);
    const response = await axios.get(
      `${process.env.REACT_APP_BACKEND_URL}invoice-temp-data`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          company: selectedCompany,
          customer: selectedCustomer
        }
      }
    );

    if (response.data.success) {
      setInvoiceTableData(response.data.invoiceData);
      
      // FIX: Extract just the label values for headers
      const headers = [
        { key: "COMPANY_CODE", label: "Company Code" },
        { key: "COMPANY_NAME", label: "Company Name" },
        { key: "PRODUCT_CODE", label: "Product Code" },
        { key: "PRODUCT_NAME", label: "Product Name" },
        { key: "COSTPRICE", label: "Cost Price" },
        { key: "UNITPRICE", label: "Unit Price" },
        { key: "STOCK", label: "Stock" },
        { key: "QUANTITY", label: "Quantity" },
        { key: "DISCOUNT", label: "Discount" },
        { key: "DISCOUNT_AMOUNT", label: "Discount Amount" },
        { key: "TOTAL", label: "Total" }
      ];
      
      // Convert to array of strings for Table component
      const headerLabels = headers.map(header => header.label);
      setInvoiceTableHeaders(headerLabels);

    }
    setDisable(false);
  } catch (err) {
    setAlert({
      message: err.response?.data?.message || "Failed to load invoice data",
      type: "error"
    });
    setTimeout(() => setAlert(null), 3000);
    setDisable(false);
  }
};

  const handleProductSubmit = async (e) => {
  let valid = true;
  if (!salesData.PRODUCT_CODE || salesData.PRODUCT_CODE==='' || salesData.PRODUCT_CODE === undefined) {
    setAlert({ message: "No product selected", type: "error" });
    setTimeout(() => setAlert(null), 3000);
    return;
  }
  setDisable(true);
  e.preventDefault();

  // Stock validation - Check if quantity exceeds available stock
  const availableStock = parseFloat(amount) || 0;
  const requestedQuantity = parseFloat(quantity) || 0;
  
  if (requestedQuantity > availableStock) {
    setAlert({ 
      message: `Insufficient stock! Available: ${availableStock.toFixed(3)}`, 
      type: "error" 
    });
    setTimeout(() => setAlert(null), 3000);
    setDisable(false);
    return;
  }
  
  if (requestedQuantity <= 0) {
    setAlert({ 
      message: "Quantity must be greater than 0", 
      type: "error" 
    });
    setTimeout(() => setAlert(null), 3000);
    setDisable(false);
    return;
  }
  
  if (!quantity) {
    setQuantityError("Quantity is required.");
    valid = false;
  } else {
    setQuantityError("");

    try {
      // FIXED: Add customer fields to the request
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}insert-invoice-temp`,
        {
          company: selectedCompany,
          companyName: selectedCompanyName,
          productCode: salesData.PRODUCT_CODE,
          productName: salesData.PRODUCT_NAME || salesData.PRODUCT_NAMELONG, // Fixed field name
          costPrice: salesData.COSTPRICE,
          unitPrice: salesData.SCALEPRICE,
          stock: amount,
          quantity: quantity,
          discount: discount,
          discountAmount: discountAmount,
          total: calculateTotal(),
          customer: selectedCustomer, // ADD THIS
          customerName: selectedCustomerName // ADD THIS
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.data.message === "Invoice item added successfully") {
        setAlert({
          message: "Item added to invoice successfully",
          type: "success",
        });
        setTimeout(() => setAlert(null), 3000);
        
        // Reset fields
        setQuantity(1);
        setDiscount("0");
        setSalesData([]);
        setAmount("");
        setColorWiseTableData([]);
        setCode("");
        setInputValue("");
        setScannedCode("");
        
        // Fetch updated table data
        await fetchInvoiceTableData();
        
        // Scroll to code input
        setTimeout(() => {
          if (codeRef.current) {
            codeRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            codeRef.current.focus();
          }
        }, 100);
      }
    } catch (err) {
      console.error("Backend error details:", err.response?.data);
      setAlert({
        message: err.response?.data?.message || "Failed to add item",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    }
  }
  setDisable(false);
};


// Add this function before the return statement
const handleSaveInvoice = async () => {
  if (!selectedCompany || !selectedCustomer) {
    setAlert({
      message: "Company and Customer are required",
      type: "error"
    });
    setTimeout(() => setAlert(null), 3000);
    return;
  }

  if (!invoiceTableData || invoiceTableData.length === 0) {
    setAlert({
      message: "No items to save",
      type: "error"
    });
    setTimeout(() => setAlert(null), 3000);
    return;
  }

  try {
    setDisable(true);
    
    const response = await axios.post(
      `${process.env.REACT_APP_BACKEND_URL}save-invoice`,
      {
        company: selectedCompany,
        customer: selectedCustomer
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (response.data.message === "Invoice saved successfully") {
      setAlert({
        message: `Invoice saved successfully! ${response.data.itemsSaved} items saved.`,
        type: "success"
      });
      
      // Clear the invoice table data
      setInvoiceTableData([]);
      
      // Reset form
      setSalesData([]);
      setAmount("");
      setQuantity("1");
      setDiscount("0");
      setColorWiseTableData([]);
      setCode("");
      setInputValue("");
      setScannedCode("");
      
      setTimeout(() => setAlert(null), 3000);
    }
    
    setDisable(false);
  } catch (err) {
    console.error("Error saving invoice:", err);
    setAlert({
      message: err.response?.data?.message || "Failed to save invoice",
      type: "error"
    });
    setTimeout(() => setAlert(null), 3000);
    setDisable(false);
  }
};

  
  return (
    <div>
    <Navbar />
        <div className="flex flex-col min-h-screen">
            <div
            className={`transition-all duration-300 flex-1 p-2 sm:p-4 md:p-6 ${
                initialData ? "lg:ml-6 lg:mr-6" : "lg:ml-8 lg:mr-8"
            } ml-2 sm:ml-4 mr-2 sm:mr-4 mt-28 sm:mt-24 md:mt-28 max-w-full`}
            >
            <div className="w-full max-w-full mb-4 ml-0 md:ml-2 md:mb-0">
                <Heading text={`Invoice`} />
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

            {/* Company & Customer Selector Section */}
            {!initialData && (
              <div className="bg-[#d8d8d8] p-2 sm:p-4 rounded-md ml-0 md:ml-4 shadow-md mb-2 sm:mb-4 mt-10 w-full max-w-full">
                <div className="flex flex-col gap-2 mb-2 justify-left lg:flex-row lg:items-end sm:gap-4 sm:mb-4">

                  {/* Company Dropdown */}
                  <div className="flex flex-col w-full gap-1 mb-2 lg:w-1/3 sm:mb-0">
                    <label className="text-sm font-medium text-gray-700">
                      Select a Company
                    </label>
                    <select
                      value={selectedCompany}
                      onChange={handleCompanyChange}
                      className="w-full p-1 text-sm bg-white border border-gray-300 rounded-md shadow-sm sm:p-2"
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
                    {companyError ? (
                      <p className="mt-1 mb-2 text-sm text-red-500">{companyError}</p>
                    ) : (
                      <p className="invisible mt-1 mb-2 text-sm">Placeholder</p>
                    )}
                  </div>

                  {/* Customer Dropdown */}
                  <div className="flex flex-col w-full gap-1 mb-2 lg:w-1/3 sm:mb-0">
                    <label className="text-sm font-medium text-gray-700">
                      Select a Customer
                    </label>
                    <select
                      value={selectedCustomer}
                      onChange={handleCustomerChange}
                      className="w-full p-1 text-sm bg-white border border-gray-300 rounded-md shadow-sm sm:p-2"
                    >
                      <option value="" disabled>
                        Select a Customer
                      </option>
                      {customers.map((customer) => (
                        <option key={customer.code} value={customer.code}>
                          {customer.code} {customer.name}
                        </option>
                      ))}
                    </select>
                    {customerError ? (
                      <p className="mt-1 mb-2 text-sm text-red-500">{customerError}</p>
                    ) : (
                      <p className="invisible mt-1 mb-2 text-sm">Placeholder</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  {/* <div className="flex justify-end w-full lg:w-auto"> */}
                  <div className="flex flex-row justify-end w-full mb-9 lg:w-1/3">
                    <button
                      onClick={handleSubmit}
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
            )}

            {/* Upload Section */}
            {initialData && (
                <div>                
                  <div className="w-full max-w-full mt-4 sm:mt-6 md:mt-10">
                    <div className="flex flex-col">
                      {/* Main Content */}
                      <div className="flex flex-col items-center justify-center flex-grow w-full max-w-full">
                        <div className="flex items-center justify-center w-full mb-2 sm:mb-3">
                          <form
                            onSubmit={handleSubmit}
                            className="flex flex-col items-center w-full space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 lg:w-auto"
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
                                className="w-full px-2 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-3 lg:w-1/2 focus:outline-none"
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
                                className="w-full px-2 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-3 lg:w-1/2 focus:outline-none"
                              />
                              {showSuggestions && filteredSuggestions.length > 0 && (
                                <ul className="absolute z-10 w-full lg:w-[calc(50%-0.5rem)] bg-white border border-gray-300 rounded-md mt-1 shadow-md max-h-40 sm:max-h-60 overflow-y-auto">
                                  {filteredSuggestions.map((name, index) => (
                                    <li
                                      key={index}
                                      onClick={() => handleSelect(name)}
                                      className="p-1 text-sm cursor-pointer sm:p-2 hover:bg-gray-100"
                                    >
                                      {name}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={handleSearchClick}
                              disabled={disable}
                              className={`bg-[#f17e21] hover:bg-[#efa05f] text-white px-3 sm:px-4 py-2 rounded-lg w-full sm:w-auto text-sm mt-2 sm:mt-0
                            ${disable ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              Search
                            </button>
                          </form>
                        </div>
                        {codeError && (
                          <p className="mt-1 mb-4 text-sm text-red-500 sm:mb-6">
                            {codeError}
                          </p>
                        )}
                        <Toaster position="top-right" reverseOrder={false} />
                        {cameraError && (
                          <div className="text-sm text-red-500">{cameraError}</div>
                        )}

                        {hasCameraPermission ? (
                          <div className="mt-4 text-center sm:mt-6">
                            <div
                              className="flex items-center justify-center bg-gray-200 border border-gray-400 rounded-lg scan"
                              style={{
                                width: "min(240px, 90vw)",
                                height: "min(240px, 90vw)",
                              }}
                            >
                              {scannerEnabled ? (
                                <BarcodeScannerComponent
                                  width={240}
                                  height={240}
                                  className="object-cover w-full h-full"
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
                                  className="w-10 h-10 text-gray-600 sm:w-15 sm:h-15"
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
                          <div className="mt-4 text-sm text-red-500 sm:mt-6">
                            Camera access is not granted. Please check permissions.
                          </div>
                        )}
                      
                        <div className="max-w-full p-2 mt-4 mb-2 bg-white border border-gray-300 rounded-md shadow-md sm:p-4 sm:mb-4 sm:mt-6 sm:w-full md:w-2/5">
                          <div className="text-sm sm:text-lg font-semibold mb-2 sm:mb-4 text-[#f17e21]">
                            Product Details
                          </div>

                          <div className="space-y-1 sm:space-y-2">
                            <div className="pt-1 border-t sm:pt-2">
                              <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                                Scanned Data
                              </p>
                              <p className="text-sm text-gray-700">
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

                            <div className="pt-1 border-t sm:pt-2">
                              <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                                Company Information
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Company Code:</strong> {selectedCompany}
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Company Name:</strong> {selectedCompanyName}
                              </p>
                              {selectedType === "TOG" && (
                                <div>
                                  <p className="text-sm text-gray-700">
                                    <strong>To Company Code:</strong>{" "}
                                    {selectedToCompany}
                                  </p>
                                  <p className="text-sm text-gray-700">
                                    <strong>To Company Name:</strong>{" "}
                                    {selectedToCompanyName}
                                  </p>
                                </div>
                              )}

                              {selectedType === "STOCK" && (
                                <p className="text-sm text-gray-700">
                                  <strong>Count Status:</strong> {selectedCount}
                                </p>
                              )}
                            </div>

                            {(selectedType === "GRN" || selectedType === "PRN") && (
                              <div className="pt-1 border-t sm:pt-2">
                                <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                                  Vendor Information
                                </p>
                                <p className="text-sm text-gray-700">
                                  <strong>Vendor Code:</strong> {selectedVendor}
                                </p>
                                <p className="text-sm text-gray-700">
                                  <strong>Vendor Name:</strong> {selectedVendorName}
                                </p>
                                <p className="text-sm text-gray-700">
                                  <strong>Invoice No:</strong> {invoiceNo}
                                </p>
                              </div>
                            )}

                            <div className="pt-1 border-t sm:pt-2">
                              <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                                Product Information
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Product Code:</strong>{" "}
                                {salesData.PRODUCT_CODE}
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Product Name:</strong>{" "}
                                {salesData.PRODUCT_NAMELONG}
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Cost Price:</strong> {costPrice}
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Unit Price: </strong> {salesPrice}
                              </p>
                            </div>

                            <div className="pt-1 border-t sm:pt-2">
                              <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                                Amount
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Stock: </strong>
                                {isNaN(Number(amount))
                                  ? "0.000"
                                  : Number(amount).toFixed(3)}
                              </p>

                              <form
                                onSubmit={handleSubmit}
                                className="flex flex-col space-y-2 sm:space-y-4"
                              >
                              
                                {/* {state && ( */}
                                  <div className="flex flex-col space-y-1 sm:space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:space-x-2">
                                      <p className="text-sm text-gray-700">
                                        <strong>Quantity: </strong>
                                      </p>
                                      <input
                                        type="number"
                                        id="quantity"
                                        ref={quantityRef}
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        className="w-full px-2 py-2 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-3 focus:outline-none"
                                        placeholder="Enter quantity"
                                        step="1"
                                        min="0"
                                      />
                                    </div>

                                    {/* Set Discount */}
                                    <div className="flex flex-col sm:flex-row sm:space-x-2">
                                      <p className="gap-2 text-sm text-gray-700">
                                        <strong>Discount: </strong>
                                      </p>
                                      
                                      <input
                                        type="text"
                                        id="discount"
                                        ref={discountRef}
                                        value={discount}
                                        onChange={(e) => {
                                          let val = e.target.value;
                                          
                                          // Allow digits, decimal point, and % symbol
                                          val = val.replace(/[^0-9.%]/g, "");
                                          
                                          // Only allow ONE % symbol at the end
                                          if ((val.match(/%/g) || []).length > 1) {
                                            val = val.replace(/%/g, "") + "%";
                                          }
                                          
                                          // Ensure % is only at the end
                                          if (val.includes("%") && !val.endsWith("%")) {
                                            const parts = val.split("%");
                                            val = parts[0] + "%";
                                          }
                                          
                                          setDiscount(val);
                                        }}
                                        className="w-full px-2 py-2 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-3 focus:outline-none"
                                        placeholder="Enter discount 5% or 100)"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                      />
                                    </div>
                                    
                                    {/* Discount Amount */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-700">
                                        <strong>Discount Amount:</strong>
                                      </span>
                                      <span className="text-sm text-gray-700">
                                        {discountAmount.toFixed(2)}
                                      </span>
                                    </div>            

                                    {/* Display Calculations */}
                                    <div className="pt-2 mt-2 border-t">
                                      <div className="flex items-center gap-2 pt-2 mt-2 text-base">
                                        <span className="font-medium text-[#bc4a17]">Total:</span>
                                        <span className="text-black">
                                          {calculateTotal()}
                                        </span>
                                      </div>
                                    </div>

                                  {/* Display error message under the input field */}
                                  {quantityError && (
                                    <p className="mt-1 text-sm text-red-500">
                                      {quantityError}
                                    </p>
                                  )}
                                  
                                <div className="flex items-center justify-center">
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
                        
                        {/* Display invoice data table */}
                        {invoiceTableData && invoiceTableData.length > 0 ? (
                        <div className="w-full max-w-full mt-6 overflow-x-auto">
                          <div className="w-full mt-4 mb-9">
                          {/* Title Center */}
                          <div className="text-xl font-bold mb-3 text-[#000000] text-center">
                            INVOICE ITEMS
                          </div>
                            {/* Button Right Align */}
                            <div className="flex justify-end w-full">
                              <button
                                onClick={handleSaveInvoice}
                                disabled={disable || !invoiceTableData || invoiceTableData.length === 0}
                                className={`bg-[#000000] hover:bg-gray-800 text-white py-1 sm:py-2 px-2 sm:px-4 rounded-md shadow-md transition-all lg:w-56 text-sm ${
                                  disable || !invoiceTableData || invoiceTableData.length === 0
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                              >
                                Save
                              </button>
                            </div>
                          </div>

                          <div className="overflow-hidden bg-white border border-gray-300 rounded-lg shadow-md">
                            <Table
                              headers={[
                                "Company Code",
                                "Company Name", 
                                "Product Code",
                                "Product Name",
                                "Cost Price",
                                "Unit Price", 
                                "Stock",
                                "Quantity",
                                "Discount",
                                "Discount Amount",
                                "Total"
                              ]}
                              data={(invoiceTableData || []).map((item) => [
                                item.COMPANY_CODE || '',
                                item.COMPANY_NAME || '',
                                item.PRODUCT_CODE || '',
                                item.PRODUCT_NAME || '',
                                parseFloat(item.COSTPRICE || 0).toFixed(2),
                                parseFloat(item.UNITPRICE || 0).toFixed(2),
                                parseFloat(item.STOCK || 0).toFixed(3),
                                item.QUANTITY || 0,
                                // Format discount display - add % if it's a percentage value
                                formatDiscountDisplay(item.DISCOUNT),
                                parseFloat(item.DISCOUNT_AMOUNT || 0).toFixed(2),
                                parseFloat(item.TOTAL || 0).toFixed(2)
                              ])}
                              editableColumns={[]}
                              formatColumns={[4, 5, 6, 9, 10]} // Columns to format as numbers
                              rightAlignedColumns={[4, 5, 6, 7, 9, 10]} // Columns to right-align
                              onDeleteRow={undefined}
                              bin={true}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="w-full max-w-full mt-6">
                        </div>
                      )}                                                
                      </div>
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
