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
  const [quantity, setQuantity] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [total, setTotal] = useState("");
  const [salesData, setSalesData] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [names, setNames] = useState([]);
  const [colorWiseTableData, setColorWiseTableData] = useState([]);
  const [colorWiseHeaders, setColorWiseHeaders] = useState([]);
  const [invoiceTableData, setInvoiceTableData] = useState([]);
  const [invoiceTableHeaders, setInvoiceTableHeaders] = useState([]);
  const [customUnitPrice, setCustomUnitPrice] = useState("");
  const [unitPriceError, setUnitPriceError] = useState("");
  
  const quantityRef = useRef(null);
  const discountRef = useRef(null);
  const tableRef = useRef(null);
  const codeRef = useRef(null);
  const streamRef = useRef(null);
  const productNameRef = useRef(null);
  const unitRef = useRef(null); 
  const isSubmittingRef = useRef(false);
  
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

// Invoice page load, after initialData true focus Product Name input
useEffect(() => {
  if (initialData && codeRef.current) {
    codeRef.current.focus();
    codeRef.current.select(); // text select immediate typing possible
  }
}, [initialData]);

useEffect(() => {
  if (customUnitPrice !== "") {
    const unitPriceNum = parseFloat(customUnitPrice);
    if (!isNaN(unitPriceNum) && unitPriceNum === 0) {
      setDiscount("0");
    }
  }
}, [customUnitPrice]); // Runs whenever customUnitPrice changes


useEffect(() => {
  const qty = parseFloat(quantity) || 0;
  if (qty === 0) {
    setDiscount("0");
  }
}, [quantity]);


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

  // Handle Enter key press for company dropdown
  const handleCompanyKeyPress = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      // Move focus to customer dropdown
      const customerSelect = document.getElementById('customer-select');
      if (customerSelect) {
        customerSelect.focus();
      }
    }
  };

  const handleEnterSubmit = (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSubmit(event);
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
        setQuantityError(""); // Add this line
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
      setScannedCode(result.text); // Update scannedCode stateqq
      
    // Product search
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

const handleRowChange = (rowIndex, colIndex, value) => {
  // If colIndex 7 quantity column
  if (colIndex === 7) {
    const updatedData = [...invoiceTableData];
    updatedData[rowIndex].QUANTITY = value;
    
    // Re-calculate totals
    const item = updatedData[rowIndex];
    const qty = parseFloat(value) || 0;
    const price = parseFloat(item.UNITPRICE);
    const discountAmount = parseFloat(item.DISCOUNT_AMOUNT) || 0;
    
    item.TOTAL = (qty * price - discountAmount).toFixed(2);
    
    setInvoiceTableData(updatedData);
  }
};

  // Add this function to component
  const formatDiscountDisplay = (discountValue) => {
  if (discountValue === null || discountValue === undefined || discountValue === "") {
    return "0"; // default
  }

  const discountStr = String(discountValue).trim();

  // If user typed % → keep as is
  if (discountStr.includes("%")) {
    return discountStr;
  }

  // Parse number
  const numValue = parseFloat(discountStr);
  if (isNaN(numValue)) return discountStr; // fallback for invalid input

  // Less than 100 → format to 2 decimals
  if (numValue < 100) {
    return numValue % 1 === 0 ? `${numValue}` : `${numValue.toFixed(2)}`;
  }

  // 100 or more → display as is
  return numValue % 1 === 0 ? `${numValue}` : `${numValue.toFixed(2)}`;
};


const calculateTotal = () => {
  const qty = parseFloat(quantity) || 0;
  
  // Get unit price - prioritize customUnitPrice, then salesData.SCALEPRICE, default to 0
  let price = 0;
  if (customUnitPrice !== "" && !isNaN(parseFloat(customUnitPrice))) {
    price = parseFloat(customUnitPrice);
  } else if (salesData.SCALEPRICE && !isNaN(parseFloat(salesData.SCALEPRICE))) {
    price = parseFloat(salesData.SCALEPRICE);
  }
  
  const subtotal = price * qty;

  if (!discount || discount === "0") return subtotal;

  let discountValue = discount.toString().trim();
  let discountAmount = 0;

  if (discountValue.includes("%")) {
    let percent = parseFloat(discountValue.replace("%", ""));
    if (!isNaN(percent)) {
      discountAmount = subtotal * (percent / 100);
    }
  } else {
    let amount = parseFloat(discountValue);
    if (!isNaN(amount)) {
      discountAmount = amount;
    }
  }

  const total = subtotal - discountAmount;
  return total < 0 ? 0 : total; // Ensure total doesn't go negative
};

// Add a new function to validate discount
const validateDiscount = () => {
  if (!discount || discount === "0") return { valid: true, message: "" };
  
  const qty = parseFloat(quantity) || 0;
  
  // Get unit price
  let price = 0;
  if (customUnitPrice !== "" && !isNaN(parseFloat(customUnitPrice))) {
    price = parseFloat(customUnitPrice);
  } else if (salesData.SCALEPRICE && !isNaN(parseFloat(salesData.SCALEPRICE))) {
    price = parseFloat(salesData.SCALEPRICE);
  }
  
  const subtotal = price * qty;
  
  let discountValue = discount.toString().trim();
  
  if (discountValue.includes("%")) {
    let percent = parseFloat(discountValue.replace("%", ""));
    if (!isNaN(percent)) {
      // For percentage, just check if it's reasonable (0-100%)
      if (percent < 0 || percent > 100) {
        return { valid: false, message: "Discount percentage must be between 0% and 100%" };
      }
    }
  } else {
    let amount = parseFloat(discountValue);
    if (!isNaN(amount)) {
      // For fixed amount, check if it's greater than subtotal
      if (amount > subtotal) {
        return { valid: false, message: `Discount amount (${amount}) cannot exceed subtotal (${subtotal.toFixed(2)})` };
      }
      if (amount < 0) {
        return { valid: false, message: "Discount amount cannot be negative" };
      }
    }
  }
  
  return { valid: true, message: "" };
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

// Update handleProductSubmit function
const handleProductSubmit = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // ✅ Check ref instead of state (more reliable)
  if (isSubmittingRef.current) {
    console.log("Already submitting, blocked duplicate request");
    return;
  }

  // ✅ Check state as backup
  if (disable) {
    console.log("Disabled state - blocked duplicate request");
    return;
  }

  setQuantityError("");
  
  // Validate product is selected
  if (!salesData.PRODUCT_CODE || salesData.PRODUCT_CODE === '' || salesData.PRODUCT_CODE === undefined) {
    setAlert({ message: "No product selected", type: "error" });
    setTimeout(() => setAlert(null), 3000);
    return;
  }
  
  // ✅ Set both ref and state
  isSubmittingRef.current = true;
  setDisable(true);

  const requestedQuantity = parseFloat(quantity) || 0;
  
  // Validate unit price
  const unitPriceValue = customUnitPrice !== "" && !isNaN(parseFloat(customUnitPrice))
    ? parseFloat(customUnitPrice).toFixed(2)
    : salesData.SCALEPRICE
      ? parseFloat(salesData.SCALEPRICE).toFixed(2)
      : "0.00";
  
  // Validate discount
  const discountValidation = validateDiscount();
  if (!discountValidation.valid) {
    setAlert({ 
      message: discountValidation.message, 
      type: "error" 
    });
    setTimeout(() => setAlert(null), 3000);
    isSubmittingRef.current = false; // ✅ Reset ref
    setDisable(false);
    return;
  }
  
  // Validate quantity
  if (!quantity) {
    setQuantityError("Quantity is required.");
    isSubmittingRef.current = false; // ✅ Reset ref
    setDisable(false);
    return;
  }

  setQuantityError("");

  try {
    const qty = parseFloat(quantity) || 0;
    
    // Parse discount
    let discountValue = 0;
    if (discount && discount !== "0") {
      const discountStr = discount.toString().trim();
      if (discountStr.includes("%")) {
        discountValue = parseFloat(discountStr.replace("%", "")) || 0;
      } else {
        discountValue = parseFloat(discountStr) || 0;
      }
    }

    // Calculate total with custom unit price
    let totalValue = calculateTotal();
    
    // Submit to backend
    const response = await axios.post(
      `${process.env.REACT_APP_BACKEND_URL}insert-invoice-temp`,
      {
        company: selectedCompany,
        companyName: selectedCompanyName,
        productCode: salesData.PRODUCT_CODE,
        productName: salesData.PRODUCT_NAME || salesData.PRODUCT_NAMELONG,
        costPrice: salesData.COSTPRICE,
        unitPrice: unitPriceValue,
        stock: amount,
        quantity: parseFloat(qty) || 0,
        discount: discountValue,
        discountAmount: discountAmount,
        total: totalValue,
        customer: selectedCustomer,
        customerName: selectedCustomerName 
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
      setQuantity("");
      setDiscount("0");
      setCustomUnitPrice("");
      setSalesData([]);
      setAmount("");
      setColorWiseTableData([]);
      setCode("");
      setInputValue("");
      setScannedCode("");
      
      // Fetch updated table data
      await fetchInvoiceTableData();
      
      // Focus product code input after adding item
      setTimeout(() => {
        if (codeRef.current) {
          codeRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          codeRef.current.focus();
          codeRef.current.select();
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
  } finally {
    // ✅ Always reset both ref and state
    isSubmittingRef.current = false;
    setDisable(false);
  }
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
      setQuantity("");
      setDiscount("");
      setColorWiseTableData([]);
      setCode("");
      setInputValue("");
      setScannedCode("");
      
      setTimeout(() => setAlert(null), 3000);

      setTimeout(() => {
        if (codeRef.current) {
          codeRef.current.focus();
          codeRef.current.select(); // optional: select all text
        }
      }, 300);
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

const handleDeleteRow = async (index) => {
  if (!invoiceTableData[index] || !invoiceTableData[index].IDX) {
    console.error("No IDX found for row:", index);
    setAlert({
      message: "Cannot delete item - no ID found",
      type: "error"
    });
    setTimeout(() => setAlert(null), 3000);
    return;
  }

  const itemId = invoiceTableData[index].IDX;
  
  try {
    setDisable(true);
    
    const response = await axios.delete(
      `${process.env.REACT_APP_BACKEND_URL}delete-invoice-temp-item`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          id: itemId
        }
      }
    );

    if (response.data.success) {
      // Remove from local state
      const updated = [...invoiceTableData];
      updated.splice(index, 1);
      setInvoiceTableData(updated);
      
      setAlert({
        message: "Item deleted successfully",
        type: "success"
      });
      setTimeout(() => setAlert(null), 3000);
    }
    
    setDisable(false);
  } catch (err) {
    console.error("Error deleting item:", err);
    setAlert({
      message: err.response?.data?.message || "Failed to delete item",
      type: "error"
    });
    setTimeout(() => setAlert(null), 3000);
    setDisable(false);
  }
};

// handleProductNameChange function
const handleProductNameChange = (e) => {
  const value = e.target.value;
  setInputValue(value);
  setScannedCode(""); // Clear scanned code when typing
  setCodeError(""); // Clear error when typing

  if (value.length > 0) {
    // Filter products that START with the entered text
    const filtered = names.filter((name) =>
      name.toLowerCase().startsWith(value.toLowerCase())
    );
    setFilteredSuggestions(filtered);
    setShowSuggestions(true);
  } else {
    setFilteredSuggestions([]);
    setShowSuggestions(false);
  }
};

// Update the handleProductSelect function
const handleProductSelect = async (productName) => {
  setInputValue(productName);
  setShowSuggestions(false);
  setQuantity('');
  setDiscount('0');
  setCustomUnitPrice(""); // This clears it for next item
  
  try {
    setDisable(true);
    
    // Just search by name - no code lookup
    await requestData("", productName);
    
    // Focus on quantity input after data loads
    setTimeout(() => {
      if (unitRef.current) {
        unitRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        unitRef.current.focus();
        unitRef.current.select();
      }
    }, 300);
    
  } catch (err) {
    console.error("Error fetching product:", err);
    setAlert({
      message: err.response?.data?.message || "Failed to fetch product",
      type: "error"
    });
    setTimeout(() => setAlert(null), 3000);
  } finally {
    setDisable(false);
  }
};

// Update the handleSearchClick function:
const handleSearchClick = async () => {
  setCodeError("");
  
  // Clear quantity and set discount to '0' before searching
  setQuantity('');
  setDiscount('0');
  setCustomUnitPrice(''); // ✅ custom unit price reset 
  
  // If there's a code, use it
  if (code) {
    await requestData(code, inputValue);
    
    // After data loads, focus on quantity input
    setTimeout(() => {
      if (unitRef.current) {
        unitRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        unitRef.current.focus();
        unitRef.current.select();
      }
    }, 300);
  } 
  // If no code but has product name, use name
  else if (inputValue) {
    // First try to get product code from name
    try {
      setDisable(true);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}get-product-code-from-name`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            name: inputValue,
            company: selectedCompany
          }
        }
      );
      
      if (response.data.success && response.data.productCode) {
        setCode(response.data.productCode);
        setScannedCode(response.data.productCode);
        await requestData(response.data.productCode, inputValue);
      } else {
        await requestData("", inputValue);
      }
      
      // After data loads, focus on quantity input
      setTimeout(() => {
        if (unitRef.current) {
          unitRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          unitRef.current.focus();
          unitRef.current.select();
        }
      }, 300);
      
    } catch (err) {
      await requestData("", inputValue);
      
      // Still focus on quantity even if error
      setTimeout(() => {
        if (unitRef.current) {
          unitRef.current.focus();
          unitRef.current.select();
        }
      }, 300);
    } finally {
      setDisable(false);
    }
  }
  // Otherwise show error
  else {
    setCodeError("Code or product name is required.");
    return;
  }
};

  // Enter key press handler for code input
  const handleCodeKeyPress = async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault(); // Prevent form submission
    
    if (code) {
      // Clear quantity and discount
      setQuantity('');
      setDiscount('0');
      setCustomUnitPrice(''); // ✅ custom unit price reset 
      
      // Call search and then focus on quantity
      await handleSearchClick();
      
      // After search completes, focus on quantity
      setTimeout(() => {
        if (unitRef.current) {
          unitRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          unitRef.current.focus();
          unitRef.current.select();
        }
      }, 300);
    } else if (!code && !inputValue) {
      //setCodeError("Code or product name is required.");
      e.preventDefault();
      if (productNameRef.current) {
        productNameRef.current.focus();
        productNameRef.current.select();
      }
    }
  }
};

  // Enter key press handler function for product name input
const handleKeyPress = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault(); // Prevent form submission
    
    if (!code && !inputValue) {
      setCodeError("Code or product name is required.");
      // Don't move focus, show error and stay on product name
      if (productNameRef.current) {
        productNameRef.current.focus();
      }
    } else if (code || inputValue) {
      handleSearchClick(); // Call your search function
    }
  }
};

// Enter key press handler for quantity input
const handleQuantityKeyPress = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();

    const qty = parseFloat(quantity) || 0;

    if (qty <= 0) {
      setQuantityError("Quantity must be greater than 0");
      quantityRef.current?.focus();
      return;
    }

    // Clear error if valid
    setQuantityError("");

    if (!salesData.PRODUCT_CODE) {
      setAlert({
        message: "No product selected",
        type: "error"
      });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    // Get current unit price
    const currentUnitPrice = customUnitPrice !== "" && !isNaN(parseFloat(customUnitPrice))
      ? parseFloat(customUnitPrice)
      : salesData.SCALEPRICE
        ? parseFloat(salesData.SCALEPRICE)
        : 0;

    // If unit price is 0 → direct submit
    if (currentUnitPrice === 0) {
      handleProductSubmit(e);
      return;
    }

    // Otherwise → go to discount field
    if (discountRef.current) {
      discountRef.current.focus();
      discountRef.current.select();
    }
  }
};

// Enter key press handler for discount input (FIXED - Prevent double submission)
const handleDiscountKeyPress = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation(); // ✅ Stop event bubbling

    // Check if already submitting
    if (disable) return; // ✅ Prevent double submission

    // Validate unit price
    const unitPriceValue = customUnitPrice !== "" && !isNaN(parseFloat(customUnitPrice))
      ? parseFloat(customUnitPrice)
      : salesData.SCALEPRICE ? parseFloat(salesData.SCALEPRICE) : 0;

    if (unitPriceValue <= 0 && parseFloat(quantity) > 0) {
      setAlert({
        message: "Unit price cannot be zero when quantity is entered",
        type: "error"
      });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    // Validate discount
    const discountValidation = validateDiscount();
    if (!discountValidation.valid) {
      setAlert({
        message: discountValidation.message,
        type: "error"
      });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    // All good → submit
    if (quantity && parseFloat(quantity) > 0 && salesData.PRODUCT_CODE) {
      handleProductSubmit(e);
    }
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
              <div className="bg-[#d8d8d8] p-2 sm:p-4 rounded-md ml-0 md:ml-4 shadow-md mb-2 sm:mb-4 mt-10 w-full max-w-full"
              onKeyDown={handleEnterSubmit} // Add 'Enter' key handler
              >
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

                            {/* Product name input with suggestions */}
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full lg:w-[600px] relative">
                              {/* Product Code Input */}
                              <input
                                type="text"
                                id="code"
                                ref={codeRef}
                                value={code}
                                onChange={(e) => {
                                  setCode(e.target.value);
                                  setScannedCode(e.target.value);
                                  setQuantity('');   // clear quantity
                                  setDiscount('0');   // clear discount (set to default '0' instead of empty)
                                }}
                                onKeyDown={handleCodeKeyPress} // Add 'Enter' key handler
                                className="w-full px-2 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-3 lg:w-1/2 focus:outline-none"
                                placeholder="Enter Code"
                              />
                              
                              {/* Product Name Input with Autocomplete */}
                              <div className="relative w-full lg:w-1/2">
                                <input
                                  type="text"
                                  ref={productNameRef}
                                  value={inputValue}
                                  onChange={handleProductNameChange}
                                  onKeyDown={handleKeyPress} // Add 'Enter' key handler
                                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                  onFocus={() => inputValue && filteredSuggestions.length > 0 && setShowSuggestions(true)}
                                  placeholder="Enter Product Name"
                                  className="w-full px-2 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-3 lg:w-6/7 focus:outline-none"
                                />
                                
                                {/* Suggestions Dropdown */}
                                {showSuggestions && filteredSuggestions.length > 0 && (
                                  <ul className="absolute z-50 w-full mt-1 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg max-h-60 top-full">
                                    {filteredSuggestions.map((name, index) => (
                                      <li
                                        key={index}
                                        onMouseDown={(e) => {
                                          e.preventDefault(); // Prevent input blur
                                          handleProductSelect(name);
                                        }}
                                        className="p-2 text-sm transition-colors border-b cursor-pointer hover:bg-gray-100 last:border-b-0"
                                      >
                                        {name}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleSearchClick}
                              disabled={disable}
                              className={`bg-[#f17e21] hover:bg-[#efa05f] text-white px-3 sm:px-4 py-2 rounded-lg w-full sm:w-auto text-sm mt-2 sm:mt-0 transition-colors
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
                      
                        {/* // Update the Product Details Card JSX (replace the existing card): */}
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
                              <hr className="my-3 border-t border-gray-300 sm:my-4" />

                              <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                                Customer Information
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Customer Code:</strong> {selectedCustomer}
                              </p>
                              <p className="text-sm text-gray-700">
                                <strong>Customer Name:</strong> {selectedCustomerName}
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

                            {/* Unit Price Input Field */}

                            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:space-x-0.5">
                              <p className="text-sm text-gray-700 whitespace-nowrap">
                                <strong>Unit Price: </strong>
                              </p>
                              <div className="w-full"> {/* Wrapper for error message positioning */}
                                <input
                                  type="text"
                                  id="unitPrice"
                                  ref={unitRef}
                                  value={customUnitPrice}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    if (val === "") {
                                      setCustomUnitPrice("");
                                      setUnitPriceError(""); // Clear error when empty
                                      return;
                                    }
                                    val = val.replace(/[^0-9.]/g, "");
                                    const parts = val.split('.');
                                    if (parts.length > 2) {
                                      val = parts[0] + '.' + parts.slice(1).join('');
                                    }
                                    if (val.includes('.')) {
                                      const [integer, decimal] = val.split('.');
                                      if (decimal && decimal.length > 2) {
                                        val = integer + '.' + decimal.substring(0, 2);
                                      }
                                    }
                                    setCustomUnitPrice(val);
                                    setUnitPriceError(""); // Clear error while typing
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      quantityRef.current?.focus();
                                      quantityRef.current?.select();
                                    }
                                  }}
                                  onBlur={() => {
                                    if (customUnitPrice && !isNaN(parseFloat(customUnitPrice))) {
                                      const formatted = parseFloat(customUnitPrice).toFixed(2);
                                      setCustomUnitPrice(formatted);
                                      
                                      // // Validate after formatting
                                      // if (parseFloat(formatted) === 0) {
                                      //   setDiscount("0"); // Auto clear discount
                                      //   setUnitPriceError("Unit price must be greater than 0");
                                      // } else {
                                      //   setUnitPriceError(""); // Clear error if valid
                                      // }
                                    } else if (customUnitPrice === "") {
                                      setUnitPriceError("");
                                    }
                                  }}
                                  className={`w-full px-2 py-2 mt-1 text-sm text-gray-700 bg-gray-100 border rounded-md sm:px-3 focus:outline-none focus:ring-0 ${
                                    unitPriceError ? "border-red-500" : "border-gray-300"
                                  }`}
                                  placeholder={salesData.SCALEPRICE ? parseFloat(salesData.SCALEPRICE).toFixed(2) : "0.00"}
                                  inputMode="decimal"
                                />
                                
                                {/* Error Message Below Input */}
                                {unitPriceError && (
                                  <p className="mt-1 text-sm text-red-500">
                                    {unitPriceError}
                                  </p>
                                )}
                              </div>
                            </div>
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
                                onSubmit={handleProductSubmit}
                                className="flex flex-col space-y-2 sm:space-y-4"
                              >
                              
                                {/* {state && ( */}
                                  <div className="flex flex-col space-y-1 sm:space-y-2">
                                    <div className="flex flex-col w-full gap-1">
                                      <div className="flex items-center gap-6">
                                        <p className="text-sm text-gray-700 whitespace-nowrap">
                                          <strong>Quantity: </strong>
                                        </p>
                                        <div className="relative flex-1">
                                          <input
                                            type="number"
                                            id="quantity"
                                            ref={quantityRef}
                                            value={quantity}
                                            onChange={(e) => {
                                              setQuantity(e.target.value);
                                              setQuantityError(""); // Clear error while typing
                                            }}
                                            onKeyDown={handleQuantityKeyPress}
                                            onWheel={(e) => {
                                              e.preventDefault();
                                              e.target.blur();
                                            }}
                                            className={`w-full px-2 py-2 text-sm text-gray-700 bg-gray-100 border rounded-md sm:px-3 focus:outline-none focus:ring-0 ${
                                              quantityError ? "border-red-500" : "border-gray-300"
                                            }`}
                                            placeholder="Enter quantity"
                                            step="0.01"
                                            min="0"
                                            style={{ WebkitAppearance: 'none', margin: 0 }}
                                          />
                                        </div>
                                      </div>
                                      {/* Error message directly below the input field */}
                                      {quantityError && (
                                        <p className="mt-1 text-sm text-red-500 ml-28"> {/* ml-28 to align with input */}
                                          {quantityError}
                                        </p>
                                      )}
                                    </div>
                                    {/* Set Discount */}
                                    <div className="flex flex-col items-center sm:flex-row sm:space-x-6">
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
                                        onKeyDown={handleDiscountKeyPress} // Add 'Enter' key handler
                                        className="w-full px-2 py-2 mt-1 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-3 focus:outline-none"
                                        placeholder="Enter discount 5% or 100)"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        disabled={parseFloat(customUnitPrice || salesData.SCALEPRICE || 0) <= 0} // Disable if unit price is 0
                                      />
                                    </div>

                                    {/* Show discount validation error if any */}
                                    {(discount && discount !== "0") && (() => {
                                      const validation = validateDiscount();
                                      if (!validation.valid) {
                                        return (
                                          <p className="mt-1 text-sm text-red-500">
                                            {validation.message}
                                          </p>
                                        );
                                      }
                                      return null;
                                    })()}
                                    
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
                                          {calculateTotal().toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  
                                  <div className="flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation(); // ✅ Add this
                                      handleProductSubmit(e);
                                    }}                                   
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

                          {alert && (
                            <Alert
                              message={alert.message}
                              type={alert.type}
                              onClose={() => setAlert(null)}
                            />
                          )}

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
                                parseFloat(item.QUANTITY || 0).toFixed(2),                            
                                // Format discount display - add % if it's a percentage value
                                formatDiscountDisplay(item.DISCOUNT),
                                parseFloat(item.DISCOUNT_AMOUNT || 0).toFixed(2),
                                parseFloat(item.TOTAL || 0).toFixed(2)
                              ])}
                              editableColumns={[]}
                              formatColumns={[4, 5, 9, 10]} // Columns to format as numbers
                              rightAlignedColumns={[4, 5, 6, 7, 8, 9, 10]} // Columns to right-align
                              onRowChange={handleRowChange} // ✅ Add this prop
                              onDeleteRow={handleDeleteRow}
                              //bin={true}
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
