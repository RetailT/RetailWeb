import { useState, useEffect, useRef, useContext } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../components/NavBar";
import { AuthContext } from "../AuthContext";
import Heading from "../components/Heading";
import Table from "../components/EditableTable";
import Alert from "../components/Alert";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { toast, Toaster } from "react-hot-toast";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { CameraOff, ChevronDown } from "lucide-react";

// ---------- Payment helpers (outside component) ----------
// Work in cents to avoid floating point errors (0.1 + 0.2 !== 0.3)
const toCents = (v) => Math.round((parseFloat(v) || 0) * 100);
const fromCents = (c) => (c / 100).toFixed(2);

// Allow only digits + one dot + max 2 decimals
const sanitizeAmount = (val) => {
  let v = (val || "").replace(/[^0-9.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  if (v.includes(".")) {
    const [i, d] = v.split(".");
    v = i + "." + (d || "").substring(0, 2);
  }
  return v;
};

// AMILA = legacy Sinhala font (the product Sinhala names in the DB are typed with it).
// Put the font file at  public/fonts/AMILA.ttf  (a PC that has AMILA installed uses its own copy).
const amilaFaceCss = () =>
  `@font-face{font-family:"AMILA";src:local("AMILA"),url("${window.location.origin}/fonts/AMILA.ttf") format("truetype");font-display:swap;}`;
const SINHALA_FONT = '"AMILA", sans-serif';

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
  const token = localStorage.getItem("authToken");
  const editableColumns = [{ index: 17, type: "number", step: "any" }];
  const decodedToken = jwtDecode(token);
  const username = decodedToken.username;

  const [currentData, setCurrentData] = useState("No result");
  const [cameraError, setCameraError] = useState(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [codeError, setCodeError] = useState("");
  const [state, setState] = useState(false);
  const [companyError, setCompanyError] = useState("");
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
  // Refund tick: when ticked, the item is saved as a MINUS line (qty, discount amount, total all negative)
  const [isRefund, setIsRefund] = useState(false);
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
  const [unitType, setUnitType] = useState("");
  const [previewInvoiceNo, setPreviewInvoiceNo] = useState("");
  const [previewCompany, setPreviewCompany] = useState(
    localStorage.getItem("lastPreviewCompany") || ""
  );
  const [savedInvoiceNumbers, setSavedInvoiceNumbers] = useState([]);
  const [selectedPreviewInvoice, setSelectedPreviewInvoice] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // ---------- Promotion (quantity-tier discount) state ----------
  // Tiers of the selected product from POSBACK_SYSTEM.tb_PROMOTION, e.g.
  // [{ qty: 1, disc: 5, isPercent: true }, { qty: 2, disc: 6, isPercent: true }]
  const [promoTiers, setPromoTiers] = useState([]);

  // ---------- Payment state ----------
  const [cashAmount, setCashAmount] = useState("0.00");
  const [creditAmount, setCreditAmount] = useState("0.00");
  const [paymentError, setPaymentError] = useState("");
  // "CASH" | "CREDIT" | "BOTH"
  const [paymentMethod, setPaymentMethod] = useState("CREDIT");

  // A refund line = REFUND flag 'T' or a minus quantity
  const isRefundLine = (item) =>
    String(item.REFUND || "").toUpperCase() === "T" ||
    (parseFloat(item.QUANTITY) || 0) < 0;

  // Sales total = only the normal (non-refund) lines
  const salesTotal = (invoiceTableData || []).reduce(
    (sum, item) => (isRefundLine(item) ? sum : sum + (parseFloat(item.TOTAL) || 0)),
    0
  );

  // Refund total = refund lines only (a minus value). Shown for information,
  // it is NOT part of the payment (Cash + Credit = sales total).
  const refundTotal = (invoiceTableData || []).reduce(
    (sum, item) => (isRefundLine(item) ? sum + (parseFloat(item.TOTAL) || 0) : sum),
    0
  );

  // The payment card works only with the sales total
  const payableTotal = salesTotal;

  // Only refund lines in the invoice (no sales item) -> such an invoice cannot be saved
  const isRefundOnly =
    (invoiceTableData || []).length > 0 &&
    !(invoiceTableData || []).some((item) => !isRefundLine(item));

  // Customer dropdown list: show ALL customers when nothing is typed or a customer
  // is already selected, otherwise filter by what the user typed.
  const customerTerm = selectedCustomer ? "" : customerSearch.trim().toLowerCase();
  const displayedCustomers = customerTerm
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(customerTerm) ||
          c.code.toLowerCase().includes(customerTerm)
      )
    : customers;

  // ---------- Price / discount helpers (defined BEFORE the effects that use them) ----------
  // Unit price actually used: edited price if the user typed one, otherwise the system price
  const getEffectiveUnitPrice = () => {
    if (customUnitPrice !== "" && !isNaN(parseFloat(customUnitPrice))) {
      return parseFloat(customUnitPrice);
    }
    const p = parseFloat(salesData.SCALEPRICE);
    return isNaN(p) ? 0 : p;
  };

  // true only when the user typed a unit price that is DIFFERENT from the system price
  const isPriceEdited = () => {
    if (customUnitPrice === "" || isNaN(parseFloat(customUnitPrice))) return false;
    const original = parseFloat(salesData.SCALEPRICE) || 0;
    return Math.abs(parseFloat(customUnitPrice) - original) > 0.0001;
  };

  // Discount:
  //   "10%"  -> isPercent = true,  percent = 10, amount = subtotal * 10%
  //   "100"  -> isPercent = false, percent = 0,  amount = 100
  const calcDiscount = () => {
    const price = getEffectiveUnitPrice();
    const qty = parseFloat(quantity) || 0;
    const subtotal = price * qty;
    const raw = (discount ?? "").toString().trim();
    const none = { isPercent: false, percent: 0, amount: 0, subtotal };

    if (!raw || raw === "0") return none;

    if (raw.includes("%")) {
      const p = parseFloat(raw.replace("%", ""));
      if (isNaN(p)) return none;
      return {
        isPercent: true,
        percent: p,
        amount: Math.round(subtotal * (p / 100) * 100) / 100,
        subtotal,
      };
    }

    const a = parseFloat(raw);
    if (isNaN(a)) return none;
    return { isPercent: false, percent: 0, amount: a, subtotal };
  };

  // Default cash/credit amounts for a payment method
  // (uses payableTotal, so a negative invoice total gives 0.00 / 0.00)
  const applyPaymentDefaults = (method) => {
    const totalStr = fromCents(toCents(payableTotal));
    if (method === "CASH") {
      setCashAmount(totalStr);
      setCreditAmount("0.00");
    } else if (method === "CREDIT") {
      setCashAmount("0.00");
      setCreditAmount(totalStr);
    } else {
      // BOTH: user splits it, start with everything on cash
      setCashAmount(totalStr);
      setCreditAmount("0.00");
    }
    setPaymentError("");
  };

  // Product select / search / scan, payment section reset
  const resetPayment = () => {
    setPaymentMethod("CREDIT");
    applyPaymentDefaults("CREDIT");
  };

  // Refs
  const quantityRef = useRef(null);
  const discountRef = useRef(null);
  const tableRef = useRef(null);
  const codeRef = useRef(null);
  const streamRef = useRef(null);
  const productNameRef = useRef(null);
  const unitRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const saveButtonRef = useRef(null);
  const cashRef = useRef(null);
  const creditRef = useRef(null);
  // true = the cashier typed the discount himself -> the promotion must NOT override it
  const discountManualRef = useRef(false);

  // Effects
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
  }, [scannerEnabled, selectedCompany, colorWiseTableData]);

  // Discount amount: recalculated whenever discount / qty / price (system OR edited) changes
  useEffect(() => {
    setDiscountAmount(calcDiscount().amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discount, quantity, customUnitPrice, salesData.SCALEPRICE]);

  useEffect(() => {
    if (initialData && selectedCompany && selectedCustomer) {
      fetchInvoiceTableData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    discount,
    quantity,
    salesData.SCALEPRICE,
    initialData,
    selectedCompany,
    selectedCustomer,
  ]);

  useEffect(() => {
    if (initialData && codeRef.current) {
      codeRef.current.focus();
      codeRef.current.select();
    }
  }, [initialData]);

  useEffect(() => {
    if (customUnitPrice !== "") {
      const unitPriceNum = parseFloat(customUnitPrice);
      if (!isNaN(unitPriceNum) && unitPriceNum === 0) {
        setDiscount("0");
      }
    }
  }, [customUnitPrice]);

  useEffect(() => {
    const qty = parseFloat(quantity) || 0;
    if (qty === 0) {
      setDiscount("0");
    }
  }, [quantity]);

  // ---------- Quantity-based promotion ----------
  // Picks the highest tier the quantity reaches:
  //   tiers: 1+ -> 5%, 2+ -> 6%  =>  qty 1 = 5%, qty 2 or more = 6%
  // If the cashier typed a discount himself, this does nothing.
  useEffect(() => {
    if (discountManualRef.current) return;
    if (promoTiers.length === 0) return;

    const qty = parseFloat(quantity) || 0;
    const price = getEffectiveUnitPrice();

    if (qty <= 0 || price <= 0) {
      setDiscount("0");
      return;
    }

    let best = null;
    promoTiers.forEach((t) => {
      if (qty >= t.qty) best = t; // tiers are sorted by qty (ascending)
    });

    if (!best) {
      setDiscount("0");
    } else if (best.isPercent) {
      setDiscount(`${best.disc}%`);
    } else {
      const amt = best.perUnit ? best.disc * qty : best.disc;
      setDiscount(String(Math.round(amt * 100) / 100));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity, promoTiers, customUnitPrice, salesData.SCALEPRICE]);

  useEffect(() => {
    if (previewCompany) {
      fetchSavedInvoiceNumbers(previewCompany);
    }
  }, []);

  // ---------- Payment: whenever the payable total changes, reset to defaults ----------
  // (payable total is never below 0, so the payment card never shows a minus value)
  useEffect(() => {
    applyPaymentDefaults(paymentMethod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toCents(payableTotal)]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  // ---------- Payment handlers ----------
  const handleMethodChange = (e) => {
    const method = e.target.value;
    setPaymentMethod(method);
    applyPaymentDefaults(method);
    setTimeout(() => {
      if (method === "CREDIT") {
        creditRef.current?.focus();
        creditRef.current?.select();
      } else {
        cashRef.current?.focus();
        cashRef.current?.select();
      }
    }, 50);
  };

  const handleCashChange = (e) => {
    const val = sanitizeAmount(e.target.value);
    setCashAmount(val);
    if (paymentMethod === "BOTH") {
      // Auto-fill the remaining part into credit
      const remaining = Math.max(toCents(payableTotal) - toCents(val), 0);
      setCreditAmount(fromCents(remaining));
    }
    setPaymentError("");
  };

  const handleCreditChange = (e) => {
    const val = sanitizeAmount(e.target.value);
    setCreditAmount(val);
    if (paymentMethod === "BOTH") {
      // Auto-fill the remaining part into cash
      const remaining = Math.max(toCents(payableTotal) - toCents(val), 0);
      setCashAmount(fromCents(remaining));
    }
    setPaymentError("");
  };

  const formatOnBlur = (value, setter) => {
    if (value === "" || isNaN(parseFloat(value))) {
      setter("0.00");
    } else {
      setter(parseFloat(value).toFixed(2));
    }
  };

  const validatePayment = () => {
    // Refund-only invoice is not allowed
    if (isRefundOnly) {
      return {
        valid: false,
        message:
          "Refund-only invoice cannot be saved. Add at least one sales item.",
      };
    }

    const totalC = toCents(payableTotal);
    const cashC = toCents(cashAmount);
    const creditC = toCents(creditAmount);

    if (cashC < 0 || creditC < 0) {
      return { valid: false, message: "Payment amounts cannot be negative" };
    }
    if (cashC + creditC !== totalC) {
      return {
        valid: false,
        message: `Cash (${fromCents(cashC)}) + Credit (${fromCents(
          creditC
        )}) = ${fromCents(cashC + creditC)} does not match the invoice total (${fromCents(
          totalC
        )})`,
      };
    }
    return { valid: true, message: "" };
  };

  const paymentCheck = validatePayment();

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
        const keys = Object.keys(stockData[0]).filter(
          (key) => key !== "IDX" && key !== "TYPE"
        );

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

        const orderedData1 = stockData.map((row) => ({
          idx: row.IDX,
          rowData: keys.map((key) => row[key]),
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

      setTimeout(() => {
        setAlert(null);
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
        const companies = response.data.userData
          .map((data) => ({
            code: data.COMPANY_CODE ? data.COMPANY_CODE.trim() : "",
            name: data.COMPANY_NAME ? data.COMPANY_NAME.trim() : "",
          }))
          .filter((c) => c.code && c.name);
        setCompanies(companies);
      } else {
        setDisable(false);
        setAlert({
          message: response.data.message || "Error Occured",
          type: "error",
        });
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
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );

      if (response.data.success && Array.isArray(response.data.userData)) {
        const customers = response.data.userData
          .map((data) => ({
            code: data.CUSTOMER?.trim() || "",
            name: data.CUSTOMER_NAME?.trim() || "",
          }))
          .filter((c) => c.code && c.name);

        setCustomers(customers);

        if (customers.length === 0) {
          setAlert({
            message: "No customers found in database",
            type: "warning",
          });
          setTimeout(() => setAlert(null), 4000);
        }
      } else {
        setCustomers([]);
        setAlert({
          message: response.data.message || "No customer data received",
          type: "warning",
        });
      }
    } catch (err) {
      console.error("Customers fetch failed:", err);
      setCustomers([]);

      if (err.response?.status === 500) {
        setAlert({
          message:
            "Customer data temporarily unavailable. Please proceed with manual entry.",
          type: "warning",
        });
      } else {
        setAlert({
          message: err.response?.data?.message || "Failed to load customers",
          type: "error",
        });
      }
      setTimeout(() => setAlert(null), 4000);
    }
  };

  // Load the quantity-tier promotion of a product (POSBACK_SYSTEM.tb_PROMOTION)
  const fetchPromotion = async (productCode, companyCode) => {
    const pc = String(productCode || "").trim();
    if (!pc) {
      setPromoTiers([]);
      return;
    }
    // The backend can fail now and then (it opens / closes the DB connection per
    // request, and several requests run at the same time right after a scan).
    // So try up to 3 times before giving up, otherwise the discount is lost.
    const MAX_TRIES = 3;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}product-promotion`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { productCode: pc, company: companyCode || "" },
          }
        );
        setPromoTiers(res.data.success ? res.data.tiers || [] : []);
        return;
      } catch (err) {
        console.error(
          `Promotion fetch failed (try ${attempt}/${MAX_TRIES}):`,
          err.response?.data?.error || err.response?.data?.message || err.message
        );
        if (attempt < MAX_TRIES) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }
    setPromoTiers([]);
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

  const handleCustomerSearch = (e) => {
    setCustomerSearch(e.target.value);
    setSelectedCustomer("");
    setSelectedCustomerName(null);
    setShowCustomerSuggestions(true);
  };

  const handleCustomerInputKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowCustomerSuggestions(true);
    } else if (e.key === "Escape") {
      setShowCustomerSuggestions(false);
    } else if (e.key === "Enter") {
      // Dropdown open and nothing selected yet -> pick the first match
      if (!selectedCustomer && showCustomerSuggestions && displayedCustomers.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        handleCustomerSelect(displayedCustomers[0]);
      }
    }
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer.code);
    setSelectedCustomerName(customer.name);
    setCustomerSearch(`${customer.code} ${customer.name}`);
    setShowCustomerSuggestions(false);
    setCustomerError("");
  };

  const handleEnterSubmit = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let valid = true;

    if (!selectedCompany) {
      setCompanyError("Company is required.");
      valid = false;
    } else {
      setCompanyError("");
    }

    if (!selectedCustomer) {
      setCustomerError("Customer is required.");
      valid = false;
    } else {
      setCustomerError("");
    }

    if (!valid) return;

    try {
      setDisable(true);
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
      setDisable(false);
    }
  };

  let costPrice = (parseFloat(salesData.COSTPRICE) || 0).toFixed(2);
  let avgCost = (parseFloat(salesData.AVGCOST) || 0).toFixed(2);
  let salesPrice = (parseFloat(salesData.SCALEPRICE) || 0).toFixed(2);

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
        setUnitType(response.data.salesData[0].UNIT || "");
        setQuantityError("");
        setIsRefund(false);
        resetPayment();
        // New product -> discount comes from its promotion again (not manual)
        discountManualRef.current = false;
        setDiscount("0");
        fetchPromotion(response.data.salesData[0].PRODUCT_CODE, selectedCompany);
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
        const colorWiseHeadings = ["SERIALNO", "COLORCODE", "SIZECODE", "STOCK"];

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
            quantityRef.current.focus();
            quantityRef.current.select();
          }
        }, 100);
      }

      if (
        (response.data.colorwiseActive === true ||
          String(response.data.colorwiseActive).toLowerCase() === "true") &&
        response.data.colorWiseData.length === 0
      ) {
        setState(false);
      } else {
        setState(true);
      }

      setAmount(response.data.amount);

      setCode("");
      setInputValue("");
    } catch (err) {
      setSalesData([]);
      setPromoTiers([]);
      setUnitType("");
      setState(false);
      setAmount("");
      setAlert({
        message: err.response?.data?.message || "Item finding failed",
        type: "error",
      });

      setTimeout(() => setAlert(null), 3000);
    }

    setDisable(false);
  };

  const handleScan = (err, result) => {
    if (err) {
      if (
        err.message?.includes("No MultiFormat Readers") ||
        err.name === "NotFoundException"
      ) {
        return;
      }

      console.warn("Scanner Error:", err);
      toast.error("Scanner encountered an issue.");
      return;
    }

    if (result) {
      const beep = new Audio("https://www.myinstants.com/media/sounds/beep.mp3");
      beep.play().catch((error) => console.error("Beep sound error:", error));

      setCurrentData(result.text);
      setCode("");
      toast.success(`Product scanned: ${result.text}`);
      setScannedCode(result.text);

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
      } else {
        setDisable(false);
      }
    } catch (err) {
      setAlert({
        message: err.response?.data?.message || "Product name finding failed",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  // Table columns: 0 Company Code, 1 Company Name, 2 Product Code, 3 Product Name,
  // 4 Product Name (Sinhala), 5 Cost Price, 6 Unit Price, 7 Stock, 8 Quantity,
  // 9 Discount, 10 Discount Amount, 11 Total
  const handleRowChange = (rowIndex, colIndex, value) => {
    if (colIndex === 8) {
      const updatedData = [...invoiceTableData];
      updatedData[rowIndex].QUANTITY = value;

      const item = updatedData[rowIndex];
      const qty = parseFloat(value) || 0;
      const price = parseFloat(item.UNITPRICE);
      const discountAmount = parseFloat(item.DISCOUNT_AMOUNT) || 0;

      item.TOTAL = (qty * price - discountAmount).toFixed(2);

      setInvoiceTableData(updatedData);
    }
  };

  // DISCOUNT column in the DB:
  //   > 0  -> it is a PERCENTAGE (show "10%")
  //   = 0  -> amount-type discount (or no discount), the real value is in DISCOUNT_AMOUNT
  const formatDiscountDisplay = (discountValue) => {
    if (
      discountValue === null ||
      discountValue === undefined ||
      discountValue === ""
    ) {
      return "0";
    }

    const numValue = parseFloat(String(discountValue).replace("%", ""));
    if (isNaN(numValue) || numValue <= 0) return "0";

    const shown = numValue % 1 === 0 ? `${numValue}` : `${numValue.toFixed(2)}`;
    return `${shown}%`;
  };

  const calculateTotal = () => {
    const d = calcDiscount();
    const total = d.subtotal - d.amount;
    return total < 0 ? 0 : total;
  };

  const validateDiscount = () => {
    const raw = (discount ?? "").toString().trim();
    if (!raw || raw === "0") return { valid: true, message: "" };

    const d = calcDiscount();

    if (d.isPercent) {
      if (d.percent < 0 || d.percent > 100) {
        return {
          valid: false,
          message: "Discount percentage must be between 0% and 100%",
        };
      }
    } else {
      if (d.amount > d.subtotal) {
        return {
          valid: false,
          message: `Discount amount (${d.amount}) cannot exceed subtotal (${d.subtotal.toFixed(
            2
          )})`,
        };
      }
      if (d.amount < 0) {
        return { valid: false, message: "Discount amount cannot be negative" };
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
            customer: selectedCustomer,
          },
        }
      );

      if (response.data.success) {
        setInvoiceTableData(response.data.invoiceData);

        const headerLabels = [
          "Company Code",
          "Company Name",
          "Product Code",
          "Product Name",
          "Product Name (Sinhala)",
          "Cost Price",
          "Unit Price",
          "Stock",
          "Quantity",
          "Discount",
          "Discount Amount",
          "Total",
        ];
        setInvoiceTableHeaders(headerLabels);
      }
      setDisable(false);
    } catch (err) {
      setAlert({
        message: err.response?.data?.message || "Failed to load invoice data",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
      setDisable(false);
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSubmittingRef.current) {
      return;
    }

    if (disable) {
      return;
    }

    setQuantityError("");

    if (
      !salesData.PRODUCT_CODE ||
      salesData.PRODUCT_CODE === "" ||
      salesData.PRODUCT_CODE === undefined
    ) {
      setAlert({ message: "No product selected", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    isSubmittingRef.current = true;
    setDisable(true);

    const unitPriceValue = getEffectiveUnitPrice().toFixed(2);

    const discountValidation = validateDiscount();
    if (!discountValidation.valid) {
      setAlert({
        message: discountValidation.message,
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
      isSubmittingRef.current = false;
      setDisable(false);
      return;
    }

    if (!quantity) {
      setQuantityError("Quantity is required.");
      isSubmittingRef.current = false;
      setDisable(false);
      return;
    }

    setQuantityError("");

    try {
      const qty = parseFloat(quantity) || 0;

      // Discount rules:
      //  - percentage ("10%") -> DISCOUNT = 10,  DISCOUNT_AMOUNT = calculated amount
      //  - direct amount ("100") -> DISCOUNT = 0, DISCOUNT_AMOUNT = 100
      const d = calcDiscount();
      const discountColumnValue = d.isPercent ? d.percent : 0;

      // Refund item -> quantity, discount amount and total are saved as MINUS values
      const sign = isRefund ? -1 : 1;
      const discountAmountValue = sign * d.amount;
      const totalValue = sign * calculateTotal();

      // NOTE: the Sinhala product name is NOT sent from here.
      // The backend (insertInvoiceTemp) reads it from tb_PRODUCT by product code.
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}insert-invoice-temp`,
        {
          company: selectedCompany,
          companyName: selectedCompanyName,
          productCode: salesData.PRODUCT_CODE,
          productName: salesData.PRODUCT_NAME || salesData.PRODUCT_NAMELONG,
          costPrice: salesData.COSTPRICE,
          avgCost: salesData.AVGCOST, // backend re-reads it from tb_PRODUCT anyway
          unitPrice: unitPriceValue,
          // "T" only when the user changed the unit price to something different
          editPrice: isPriceEdited() ? "T" : "F",
          stock: amount,
          quantity: sign * (parseFloat(qty) || 0),
          refund: isRefund ? "T" : "F",
          discount: discountColumnValue,
          discountAmount: discountAmountValue,
          total: totalValue,
          customer: selectedCustomer,
          customerName: selectedCustomerName,
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

        setQuantity("");
        setDiscount("0");
        setCustomUnitPrice("");
        setSalesData([]);
        setAmount("");
        setColorWiseTableData([]);
        setCode("");
        setInputValue("");
        setScannedCode("");
        setUnitType("");
        setIsRefund(false);
        setPromoTiers([]);
        discountManualRef.current = false;

        await fetchInvoiceTableData();

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

      const backendMessage = err.response?.data?.message;
      if (
        backendMessage &&
        backendMessage.includes("NOS items must have whole number quantities only")
      ) {
        setQuantityError("Please enter a whole number (decimals not allowed)");
        quantityRef.current?.focus();
        quantityRef.current?.select();
        return;
      }

      setAlert({
        message: backendMessage || "Failed to add item",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    } finally {
      isSubmittingRef.current = false;
      setDisable(false);
    }
  };

  const handleSaveInvoice = async () => {
    if (disable || isSubmittingRef.current) {
      return;
    }
    if (!selectedCompany || !selectedCustomer) {
      setAlert({
        message: "Company and Customer are required",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    if (!invoiceTableData || invoiceTableData.length === 0) {
      setAlert({
        message: "No items to save",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
      return;
    }

    // ---------- Payment validation: Cash + Credit must equal the total ----------
    const paymentValidation = validatePayment();
    if (!paymentValidation.valid) {
      setPaymentError(paymentValidation.message);
      setAlert({
        message: paymentValidation.message,
        type: "error",
      });
      setTimeout(() => setAlert(null), 4000);
      const target = paymentMethod === "CREDIT" ? creditRef : cashRef;
      target.current?.focus();
      target.current?.select();
      return; // STOP - invoice is not saved / printed
    }
    setPaymentError("");

    try {
      isSubmittingRef.current = true;
      setDisable(true);

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}save-invoice`,
        {
          company: selectedCompany,
          customer: selectedCustomer,
          cashAmount: parseFloat(cashAmount) || 0,
          creditAmount: parseFloat(creditAmount) || 0,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.message === "Invoice saved successfully") {
        setAlert({
          message: `Invoice saved successfully! ${response.data.itemsSaved} items saved.`,
          type: "success",
        });

        const docNo =
          response.data.documentNumber ||
          response.data.invoiceNo ||
          response.data.docNo ||
          "";
        const compCode =
          response.data.companyCode ||
          response.data.company ||
          selectedCompany ||
          "";

        if (docNo) {
          const previewUrl = `/invoice-preview?docNo=${encodeURIComponent(
            docNo
          )}&company=${encodeURIComponent(compCode)}`;
          window.open(previewUrl, "_blank", "noopener,noreferrer");
        } else {
          console.error("Backend did not return any document/invoice number");
          setAlert({
            message:
              "Invoice saved, but preview could not be opened (missing invoice number)",
            type: "warning",
          });
        }

        // Clear ALL form data
        setInitialData(false);
        setSelectedCompany("");
        setSelectedCompanyName(null);
        setSelectedCustomer("");
        setSelectedCustomerName(null);
        setCustomerSearch("");
        setInvoiceTableData([]);
        setSavedInvoiceNumbers([]);
        setSelectedPreviewInvoice("");

        setSalesData([]);
        setAmount("");
        setQuantity("");
        setDiscount("0");
        setDiscountAmount(0);
        setIsRefund(false);
        setPromoTiers([]);
        discountManualRef.current = false;
        setColorWiseTableData([]);
        setCode("");
        setInputValue("");
        setScannedCode("");
        setUnitType("");
        setCustomUnitPrice("");
        setQuantityError("");
        setCodeError("");

        // Clear payment
        setPaymentMethod("CREDIT");
        setCashAmount("0.00");
        setCreditAmount("0.00");
        setPaymentError("");

        setTimeout(() => setAlert(null), 5000);

        setTimeout(() => {
          const customerSelect = document.getElementById("customer-select");
          if (customerSelect) {
            customerSelect.focus();
          }
        }, 300);
      }
    } catch (err) {
      console.error("Error saving invoice:", err);
      const msg = err.response?.data?.message || "Failed to save invoice";
      // Backend payment mismatch → show it next to the payment fields too
      if (err.response?.status === 400 && /cash|credit|payment/i.test(msg)) {
        setPaymentError(msg);
      }
      setAlert({
        message: msg,
        type: "error",
      });
      setTimeout(() => setAlert(null), 4000);
    } finally {
      isSubmittingRef.current = false;
      setDisable(false);
    }
  };

  const handleDeleteRow = async (index) => {
    if (!invoiceTableData[index] || !invoiceTableData[index].IDX) {
      console.error("No IDX found for row:", index);
      setAlert({
        message: "Cannot delete item - no ID found",
        type: "error",
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
            id: itemId,
          },
        }
      );

      if (response.data.success) {
        const updated = [...invoiceTableData];
        updated.splice(index, 1);
        setInvoiceTableData(updated);

        setAlert({
          message: "Item deleted successfully",
          type: "success",
        });
        setTimeout(() => setAlert(null), 3000);
      }

      setDisable(false);
    } catch (err) {
      console.error("Error deleting item:", err);
      setAlert({
        message: err.response?.data?.message || "Failed to delete item",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
      setDisable(false);
    }
  };

  const handleProductNameChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setScannedCode("");
    setCodeError("");

    if (value.length > 0) {
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

  const handleProductSelect = async (productName) => {
    setInputValue(productName);
    setShowSuggestions(false);
    setQuantity("");
    setDiscount("0");
    setCustomUnitPrice("");

    try {
      setDisable(true);

      await requestData("", productName);

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
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    } finally {
      setDisable(false);
    }
  };

  const handleSearchClick = async () => {
    setCodeError("");

    setQuantity("");
    setDiscount("0");
    setCustomUnitPrice("");
    setUnitType("");

    if (code) {
      await requestData(code, inputValue);

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
    } else if (inputValue) {
      try {
        setDisable(true);
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}get-product-code-from-name`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              name: inputValue,
              company: selectedCompany,
            },
          }
        );

        if (response.data.success && response.data.productCode) {
          setCode(response.data.productCode);
          setScannedCode(response.data.productCode);
          await requestData(response.data.productCode, inputValue);
        } else {
          await requestData("", inputValue);
        }

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

        setTimeout(() => {
          if (unitRef.current) {
            unitRef.current.focus();
            unitRef.current.select();
          }
        }, 300);
      } finally {
        setDisable(false);
      }
    } else {
      setCodeError("Code or product name is required.");
      return;
    }
  };

  const handleCodeKeyPress = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (code) {
        setQuantity("");
        setDiscount("0");
        setCustomUnitPrice("");

        await handleSearchClick();

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
        e.preventDefault();
        if (productNameRef.current) {
          productNameRef.current.focus();
          productNameRef.current.select();
        }
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (!code && !inputValue) {
        setCodeError("Code or product name is required.");
        if (productNameRef.current) {
          productNameRef.current.focus();
        }
      } else if (code || inputValue) {
        handleSearchClick();
      }
    }
  };

  const handleQuantityKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      const qty = parseFloat(quantity) || 0;
      const qtyStr = quantity.toString().trim();

      setQuantityError("");

      const hasDecimal = qtyStr.includes(".");

      if (unitType && unitType.trim().toUpperCase() === "NOS") {
        if (hasDecimal) {
          setQuantityError("NOS products cannot have decimal quantities");

          const wholeNumber = Math.floor(qty);
          setQuantity(wholeNumber.toString());

          if (quantityRef.current) {
            quantityRef.current.focus();
            quantityRef.current.select();
          }
          return;
        }

        if (!Number.isInteger(qty)) {
          setQuantityError("NOS products must have whole number quantities");
          quantityRef.current?.focus();
          quantityRef.current?.select();
          return;
        }
      }

      if (qty <= 0) {
        setQuantityError("Quantity must be greater than 0");
        quantityRef.current?.focus();
        quantityRef.current?.select();
        return;
      }

      setQuantityError("");

      if (!salesData.PRODUCT_CODE) {
        setAlert({ message: "No product selected", type: "error" });
        setTimeout(() => setAlert(null), 3000);
        return;
      }

      const currentUnitPrice = getEffectiveUnitPrice();

      if (currentUnitPrice === 0) {
        handleProductSubmit(e);
        return;
      }

      if (discountRef.current) {
        discountRef.current.focus();
        discountRef.current.select();
      }
    }
  };

  const handleDiscountKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();

      if (disable) return;

      const unitPriceValue = getEffectiveUnitPrice();

      if (unitPriceValue <= 0 && parseFloat(quantity) > 0) {
        setAlert({
          message: "Unit price cannot be zero when quantity is entered",
          type: "error",
        });
        setTimeout(() => setAlert(null), 3000);
        return;
      }

      const discountValidation = validateDiscount();
      if (!discountValidation.valid) {
        setAlert({
          message: discountValidation.message,
          type: "error",
        });
        setTimeout(() => setAlert(null), 3000);
        return;
      }

      if (quantity && parseFloat(quantity) > 0 && salesData.PRODUCT_CODE) {
        handleProductSubmit(e);
      }
    }
  };

  const fetchSavedInvoiceNumbers = async (companyCode = "") => {
    if (!companyCode.trim()) {
      setSavedInvoiceNumbers([]);
      setSelectedPreviewInvoice("");
      return;
    }

    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}saved-invoice-numbers`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { company: companyCode },
        }
      );

      if (response.data.success) {
        const invoices = response.data.invoices || [];
        const sorted = invoices.sort((a, b) => b.localeCompare(a));

        setSavedInvoiceNumbers(sorted);

        if (sorted.length > 0) {
          setSelectedPreviewInvoice(sorted[0]);
        } else {
          setSelectedPreviewInvoice("");
        }
      } else {
        setSavedInvoiceNumbers([]);
        setSelectedPreviewInvoice("");
      }
    } catch (err) {
      console.error("Failed to fetch invoice numbers:", err);
      setSavedInvoiceNumbers([]);
      setSelectedPreviewInvoice("");

      if (err.response?.status >= 500) {
        setAlert({
          message: "Server error loading saved invoices",
          type: "error",
        });
        setTimeout(() => setAlert(null), 4000);
      }
    }
  };

  const hasInvoiceItems = invoiceTableData && invoiceTableData.length > 0;

  return (
    <div>
      {/* AMILA font + Sinhala column (5th column) of the invoice items table */}
      <style>{`${amilaFaceCss()}
        #invoice-items-wrap td:nth-child(5) { font-family: "AMILA", sans-serif; font-size: 1.15em; }`}</style>
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
            <>
              <div
                className="bg-[#d8d8d8] p-4 sm:p-6 rounded-md ml-0 md:ml-4 shadow-md mb-4 mt-10 w-full max-w-full"
                onKeyDown={handleEnterSubmit}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
                  {/* Company */}
                  <div className="flex flex-col flex-1 min-w-[240px]">
                    <label className="text-sm font-medium text-gray-700 mb-1.5">
                      Select a Company
                    </label>
                    <select
                      value={selectedCompany}
                      onChange={handleCompanyChange}
                      className="w-full p-2.5 text-sm bg-white border border-gray-300 rounded-md focus:outline-none"
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
                      <p className="mt-1.5 text-sm text-red-600">{companyError}</p>
                    )}
                  </div>

                  {/* Customer Search with Autocomplete */}
                  <div className="flex flex-col flex-1 min-w-[240px]">
                    <label className="text-sm font-medium text-gray-700 mb-1.5">
                      Select a Customer
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="customer-select"
                        value={customerSearch}
                        onChange={handleCustomerSearch}
                        onFocus={() => setShowCustomerSuggestions(true)}
                        onClick={() => setShowCustomerSuggestions(true)}
                        onKeyDown={handleCustomerInputKeyDown}
                        onBlur={() =>
                          setTimeout(() => setShowCustomerSuggestions(false), 200)
                        }
                        placeholder="Select or search customer..."
                        className="w-full p-2.5 pr-9 text-sm bg-white border border-gray-300 rounded-md focus:outline-none"
                        autoComplete="off"
                      />

                      {/* Dropdown arrow */}
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowCustomerSuggestions((prev) => !prev);
                          document.getElementById("customer-select")?.focus();
                        }}
                        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500 hover:text-gray-700"
                        aria-label="Toggle customer list"
                      >
                        <ChevronDown size={18} />
                      </button>

                      {showCustomerSuggestions && displayedCustomers.length > 0 && (
                        <ul className="absolute z-50 w-full mt-1 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg max-h-52 top-full">
                          {displayedCustomers.map((customer) => (
                            <li
                              key={customer.code}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleCustomerSelect(customer);
                              }}
                              className={`p-2.5 text-sm cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0 flex justify-between items-center ${
                                selectedCustomer === customer.code
                                  ? "bg-gray-100 font-medium"
                                  : ""
                              }`}
                            >
                              <span>{customer.name}</span>
                              <span className="ml-2 text-xs text-gray-400">
                                {customer.code}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {showCustomerSuggestions &&
                        customers.length === 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2.5 text-sm text-gray-500 top-full">
                            No customers loaded
                          </div>
                        )}

                      {showCustomerSuggestions &&
                        customers.length > 0 &&
                        displayedCustomers.length === 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2.5 text-sm text-gray-500 top-full">
                            No customers found
                          </div>
                        )}
                    </div>
                    {customerError && (
                      <p className="mt-1.5 text-sm text-red-600">{customerError}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-end lg:self-end">
                    <button
                      onClick={handleSubmit}
                      disabled={disable}
                      className={`bg-black hover:bg-gray-800 text-white font-medium py-2.5 px-8 rounded-md shadow transition min-w-[140px] ${
                        disable ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>

              {/* View Saved Invoice */}
              <div className="bg-[#d8d8d8] p-4 sm:p-6 rounded-md ml-0 md:ml-4 shadow-md mb-6 w-full max-w-full">
                <div className="flex flex-col gap-4">
                  <div className="text-left">
                    <h3 className="text-base font-semibold text-gray-800">
                      View Previously Saved Invoice
                    </h3>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                        Select a Company
                      </label>
                      <select
                        value={previewCompany}
                        onChange={(e) => {
                          const newCompany = e.target.value;
                          setPreviewCompany(newCompany);
                          fetchSavedInvoiceNumbers(newCompany);
                        }}
                        className="w-full p-2.5 text-sm bg-white border border-gray-300 rounded-md focus:outline-none"
                      >
                        <option value="">Select a Company</option>
                        {companies.map((company) => (
                          <option key={company.code} value={company.code}>
                            {company.code} - {company.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                        Invoice Number
                      </label>
                      <select
                        value={selectedPreviewInvoice}
                        onChange={(e) => setSelectedPreviewInvoice(e.target.value)}
                        className="w-full p-2.5 text-sm bg-white border border-gray-300 rounded-md focus:outline-none"
                        disabled={savedInvoiceNumbers.length === 0}
                      >
                        {savedInvoiceNumbers.length === 0 ? (
                          <option value="" disabled>
                            No saved invoices found
                          </option>
                        ) : (
                          <>
                            <option value="" disabled>
                              Select Invoice Number
                            </option>
                            {savedInvoiceNumbers.map((invNo) => (
                              <option key={invNo} value={invNo}>
                                {invNo}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        if (!selectedPreviewInvoice) {
                          setAlert({
                            message: "Please select an invoice number",
                            type: "error",
                          });
                          setTimeout(() => setAlert(null), 3000);
                          return;
                        }
                        const companyCode = previewCompany || selectedCompany || "";
                        const previewUrl = `/invoice-preview?docNo=${encodeURIComponent(
                          selectedPreviewInvoice
                        )}&company=${encodeURIComponent(companyCode)}`;
                        window.open(previewUrl, "_blank", "noopener,noreferrer");

                        setSelectedPreviewInvoice("");
                        setPreviewCompany("");
                      }}
                      disabled={disable || !selectedPreviewInvoice}
                      className={`bg-black hover:bg-gray-800 text-white font-medium py-2.5 px-8 rounded-md shadow transition min-w-[140px] ${
                        disable || !selectedPreviewInvoice
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Invoice entry section */}
          {initialData && (
            <div>
              <div className="w-full max-w-full mt-4 sm:mt-6 md:mt-10">
                <div className="flex flex-col">
                  <div className="flex flex-col items-center justify-center flex-grow w-full max-w-full">
                    <div className="flex items-center justify-center w-full mb-2 sm:mb-3">
                      <form
                        onSubmit={handleSubmit}
                        className="flex flex-col items-center w-full space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 lg:w-auto"
                      >
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
                              setQuantity("");
                              setDiscount("0");
                            }}
                            onKeyDown={handleCodeKeyPress}
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
                              onKeyDown={handleKeyPress}
                              onBlur={() =>
                                setTimeout(() => setShowSuggestions(false), 200)
                              }
                              onFocus={() =>
                                inputValue &&
                                filteredSuggestions.length > 0 &&
                                setShowSuggestions(true)
                              }
                              placeholder="Enter Product Name"
                              className="w-full px-2 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:px-3 lg:w-6/7 focus:outline-none"
                            />

                            {showSuggestions && filteredSuggestions.length > 0 && (
                              <ul className="absolute z-50 w-full mt-1 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg max-h-60 top-full">
                                {filteredSuggestions.map((name, index) => (
                                  <li
                                    key={index}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
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

                    {/* Product Details Card */}
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
                        </div>

                        <div className="pt-1 border-t sm:pt-2">
                          <p className="font-medium text-[#bc4a17] mb-1 sm:mb-2 text-sm sm:text-base">
                            Product Information
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Product Code:</strong> {salesData.PRODUCT_CODE}
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Product Name:</strong>{" "}
                            {salesData.PRODUCT_NAMELONG}
                          </p>
                          {/* Shown only if the /scan API returns PRODUCT_NAME_SINHALA */}
                          {salesData.PRODUCT_NAME_SINHALA &&
                            String(salesData.PRODUCT_NAME_SINHALA).trim() && (
                              <p className="text-sm text-gray-700">
                                <strong>Sinhala Name:</strong>{" "}
                                <span style={{ fontFamily: SINHALA_FONT }}>
                                  {String(salesData.PRODUCT_NAME_SINHALA).trim()}
                                </span>
                              </p>
                            )}
                          <p className="text-sm text-gray-700">
                            <strong>Cost Price:</strong> {costPrice}
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Avg Cost:</strong> {avgCost}
                          </p>

                          {/* Unit Price Input Field */}
                          <div className="flex flex-col w-full gap-1">
                            <div className="flex items-center gap-6">
                              <p className="text-sm text-gray-700 whitespace-nowrap min-w-[80px]">
                                <strong>Unit Price: </strong>
                              </p>
                              <div className="w-full">
                                <input
                                  type="text"
                                  id="unitPrice"
                                  ref={unitRef}
                                  value={customUnitPrice}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    if (val === "") {
                                      setCustomUnitPrice("");
                                      setUnitPriceError("");
                                      return;
                                    }
                                    val = val.replace(/[^0-9.]/g, "");
                                    const parts = val.split(".");
                                    if (parts.length > 2) {
                                      val = parts[0] + "." + parts.slice(1).join("");
                                    }
                                    if (val.includes(".")) {
                                      const [integer, decimal] = val.split(".");
                                      if (decimal && decimal.length > 2) {
                                        val = integer + "." + decimal.substring(0, 2);
                                      }
                                    }
                                    setCustomUnitPrice(val);
                                    setUnitPriceError("");
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      quantityRef.current?.focus();
                                      quantityRef.current?.select();
                                    }
                                  }}
                                  onBlur={() => {
                                    if (
                                      customUnitPrice &&
                                      !isNaN(parseFloat(customUnitPrice))
                                    ) {
                                      const formatted =
                                        parseFloat(customUnitPrice).toFixed(2);
                                      setCustomUnitPrice(formatted);
                                    } else if (customUnitPrice === "") {
                                      setUnitPriceError("");
                                    }
                                  }}
                                  className={`w-full px-2 py-2 mt-1 text-sm text-gray-700 bg-gray-100 border rounded-md sm:px-3 focus:outline-none focus:ring-0 ${
                                    unitPriceError
                                      ? "border-red-500"
                                      : "border-gray-300"
                                  }`}
                                  placeholder={
                                    salesData.SCALEPRICE
                                      ? parseFloat(salesData.SCALEPRICE).toFixed(2)
                                      : "0.00"
                                  }
                                  inputMode="decimal"
                                />

                                {unitPriceError && (
                                  <p className="mt-1 text-sm text-red-500">
                                    {unitPriceError}
                                  </p>
                                )}
                              </div>
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
                            <div className="flex flex-col space-y-1 sm:space-y-2">
                              <div className="flex flex-col w-full gap-1">
                                <div className="flex items-center gap-6">
                                  <p className="text-sm text-gray-700 whitespace-nowrap min-w-[80px]">
                                    <strong>Quantity: </strong>
                                  </p>
                                  <div className="flex-1">
                                    <input
                                      type="number"
                                      id="quantity"
                                      ref={quantityRef}
                                      value={quantity}
                                      onChange={(e) => {
                                        // Quantity changed -> the promotion tier for the NEW qty
                                        // must apply again (even if the cashier edited the discount before)
                                        discountManualRef.current = false;
                                        let value = e.target.value;
                                        if (
                                          unitType &&
                                          unitType.trim().toUpperCase() === "NOS"
                                        ) {
                                          if (value.includes(".")) {
                                            value = value.split(".")[0];
                                          }
                                          value = value.replace(/[^0-9]/g, "");
                                        }
                                        setQuantity(value);
                                        if (quantityError) {
                                          setQuantityError("");
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (
                                          unitType &&
                                          unitType.trim().toUpperCase() === "NOS" &&
                                          (e.key === "." || e.key === ",")
                                        ) {
                                          e.preventDefault();
                                        }
                                        if (e.key === "Enter") {
                                          handleQuantityKeyPress(e);
                                        }
                                      }}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className={`w-full px-2 py-2 text-sm text-gray-700 bg-gray-100 border rounded-md sm:px-3 focus:outline-none focus:ring-0 ${
                                        quantityError
                                          ? "border-red-500"
                                          : "border-gray-300"
                                      }`}
                                      placeholder="Enter quantity"
                                      step={
                                        unitType &&
                                        unitType.trim().toUpperCase() === "NOS"
                                          ? "1"
                                          : "0.01"
                                      }
                                      min="0"
                                      inputMode={
                                        unitType &&
                                        unitType.trim().toUpperCase() === "NOS"
                                          ? "numeric"
                                          : "decimal"
                                      }
                                      style={{ WebkitAppearance: "none", margin: 0 }}
                                    />
                                  </div>
                                </div>
                                {quantityError && (
                                  <p className="mt-1 text-sm text-red-500 ml-24">
                                    {quantityError}
                                  </p>
                                )}
                              </div>

                              {/* Refund tick */}
                              <label
                                htmlFor="refundTick"
                                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none"
                              >
                                <input
                                  type="checkbox"
                                  id="refundTick"
                                  checked={isRefund}
                                  onChange={(e) => setIsRefund(e.target.checked)}
                                  disabled={!salesData.PRODUCT_CODE}
                                  className="w-4 h-4 accent-red-600 cursor-pointer"
                                />
                                <strong className={isRefund ? "text-red-600" : ""}>
                                  Refund this item
                                </strong>
                              </label>

                              {/* Discount */}
                              <div className="flex flex-col w-full gap-1">
                                <div className="flex items-center gap-6">
                                  <p className="text-sm text-gray-700 whitespace-nowrap min-w-[80px]">
                                    <strong>Discount: </strong>
                                  </p>
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      id="discount"
                                      ref={discountRef}
                                      value={discount}
                                      onChange={(e) => {
                                        // The cashier typed it -> promotion must not override
                                        discountManualRef.current = true;
                                        let val = e.target.value;
                                        val = val.replace(/[^0-9.%]/g, "");
                                        if ((val.match(/%/g) || []).length > 1) {
                                          val = val.replace(/%/g, "") + "%";
                                        }
                                        if (val.includes("%") && !val.endsWith("%")) {
                                          const parts = val.split("%");
                                          val = parts[0] + "%";
                                        }
                                        setDiscount(val);
                                      }}
                                      onKeyDown={handleDiscountKeyPress}
                                      className={`w-full px-2 py-2 text-sm text-gray-700 bg-gray-100 border rounded-md sm:px-3 focus:outline-none focus:ring-0 ${
                                        discount &&
                                        discount !== "0" &&
                                        !validateDiscount().valid
                                          ? "border-red-500"
                                          : "border-gray-300"
                                      }`}
                                      placeholder="5% or 100"
                                      disabled={getEffectiveUnitPrice() <= 0}
                                    />
                                  </div>
                                </div>

                                {discount &&
                                  discount !== "0" &&
                                  (() => {
                                    const validation = validateDiscount();
                                    if (!validation.valid) {
                                      return (
                                        <p className="mt-1 text-sm text-red-500 ml-[90px]">
                                          {validation.message}
                                        </p>
                                      );
                                    }
                                    return null;
                                  })()}
                              </div>

                              {/* Discount Amount */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-700">
                                  <strong>Discount Amount:</strong>
                                </span>
                                <span
                                  className={`text-sm ${
                                    isRefund && discountAmount > 0
                                      ? "text-red-600"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {isRefund && discountAmount > 0 ? "-" : ""}
                                  {discountAmount.toFixed(2)}
                                </span>
                              </div>

                              {/* Total */}
                              <div className="pt-2 mt-2 border-t">
                                <div className="flex items-center gap-2 pt-2 mt-2 text-base">
                                  <span className="font-medium text-[#bc4a17]">
                                    Total:
                                  </span>
                                  <span
                                    className={isRefund ? "text-red-600" : "text-black"}
                                  >
                                    {isRefund && calculateTotal() > 0 ? "-" : ""}
                                    {calculateTotal().toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
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

                    {/* ---------- PAYMENT SECTION ---------- */}
                    <div className="flex justify-end w-full mt-6 mb-9">
                      <div className="w-full p-4 bg-white border border-gray-300 rounded-lg shadow-md sm:p-5 md:w-[420px]">
                        <div className="text-base sm:text-lg font-bold text-[#f17e21] mb-3">
                          Payment
                        </div>

                        {/* Sales total (refund lines are NOT included) */}
                        <div className="flex items-center justify-between pb-3 mb-3 border-b">
                          <span className="text-sm font-semibold text-gray-700">
                            Invoice Total
                          </span>
                          <span className="text-lg font-bold text-black">
                            {salesTotal.toFixed(2)}
                          </span>
                        </div>

                        {/* Refund total: information only, not part of the payment */}
                        {refundTotal < 0 && (
                          <div className="flex items-center justify-between pb-3 mb-3 border-b">
                            <span className="text-sm font-semibold text-red-600">
                              Refund (not included)
                            </span>
                            <span className="text-base font-bold text-red-600">
                              {refundTotal.toFixed(2)}
                            </span>
                          </div>
                        )}

                        {/* Payment method dropdown */}
                        <div className="flex items-center gap-4 mb-3">
                          <label
                            htmlFor="paymentMethod"
                            className="text-sm font-medium text-gray-700 min-w-[70px]"
                          >
                            Method
                          </label>
                          <select
                            id="paymentMethod"
                            value={paymentMethod}
                            onChange={handleMethodChange}
                            className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none"
                          >
                            <option value="CASH">Cash</option>
                            <option value="CREDIT">Credit</option>
                            <option value="BOTH">Cash + Credit</option>
                          </select>
                        </div>

                        {/* Cash */}
                        <div className="flex items-center gap-4 mb-3">
                          <label
                            htmlFor="cashAmount"
                            className="text-sm font-medium text-gray-700 min-w-[70px]"
                          >
                            Cash
                          </label>
                          <input
                            type="text"
                            id="cashAmount"
                            ref={cashRef}
                            value={cashAmount}
                            onChange={handleCashChange}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => formatOnBlur(cashAmount, setCashAmount)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveInvoice();
                              }
                            }}
                            disabled={paymentMethod === "CREDIT"}
                            inputMode="decimal"
                            placeholder="0.00"
                            className={`w-full px-3 py-2 text-sm text-right text-gray-700 border rounded-md focus:outline-none ${
                              paymentMethod === "CREDIT"
                                ? "bg-gray-200 opacity-60 cursor-not-allowed"
                                : "bg-gray-100"
                            } ${!paymentCheck.valid ? "border-red-500" : "border-gray-300"}`}
                          />
                        </div>

                        {/* Credit */}
                        <div className="flex items-center gap-4 mb-3">
                          <label
                            htmlFor="creditAmount"
                            className="text-sm font-medium text-gray-700 min-w-[70px]"
                          >
                            Credit
                          </label>
                          <input
                            type="text"
                            id="creditAmount"
                            ref={creditRef}
                            value={creditAmount}
                            onChange={handleCreditChange}
                            onFocus={(e) => e.target.select()}
                            onBlur={() =>
                              formatOnBlur(creditAmount, setCreditAmount)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveInvoice();
                              }
                            }}
                            disabled={paymentMethod === "CASH"}
                            inputMode="decimal"
                            placeholder="0.00"
                            className={`w-full px-3 py-2 text-sm text-right text-gray-700 border rounded-md focus:outline-none ${
                              paymentMethod === "CASH"
                                ? "bg-gray-200 opacity-60 cursor-not-allowed"
                                : "bg-gray-100"
                            } ${!paymentCheck.valid ? "border-red-500" : "border-gray-300"}`}
                          />
                        </div>

                        {/* Sum */}
                        <div className="flex items-center justify-between pt-3 border-t">
                          <span className="text-sm font-semibold text-gray-700">
                            Cash + Credit
                          </span>
                          <span
                            className={`text-base font-bold ${
                              paymentCheck.valid ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {fromCents(toCents(cashAmount) + toCents(creditAmount))}
                          </span>
                        </div>

                        {(paymentError || !paymentCheck.valid) && (
                          <p className="mt-2 text-sm text-red-600">
                            {paymentError || paymentCheck.message}
                          </p>
                        )}

                        <button
                          ref={saveButtonRef}
                          onClick={handleSaveInvoice}
                          disabled={disable || !hasInvoiceItems || isRefundOnly}
                          className={`mt-4 w-full bg-[#000000] hover:bg-gray-800 text-white py-2 px-4 rounded-md shadow-md transition-all text-sm ${
                            disable || !hasInvoiceItems || isRefundOnly
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          Save & Preview Invoice
                        </button>
                      </div>
                    </div>

                    {/* Invoice items table + Payment */}
                    {hasInvoiceItems ? (
                      <div className="w-full max-w-full mt-6 overflow-x-auto">
                        <div className="w-full mt-4 mb-4">
                          <div className="text-xl font-bold mb-3 text-[#000000] text-center">
                            INVOICE ITEMS
                          </div>
                        </div>

                        <div id="invoice-items-wrap" className="overflow-hidden bg-white border border-gray-300 rounded-lg shadow-md">
                          <Table
                            headers={[
                              "Company Code",
                              "Company Name",
                              "Product Code",
                              "Product Name",
                              "Product Name (Sinhala)",
                              "Cost Price",
                              "Unit Price",
                              "Stock",
                              "Quantity",
                              "Discount",
                              "Discount Amount",
                              "Total",
                            ]}
                            data={(invoiceTableData || []).map((item) => [
                              item.COMPANY_CODE || "",
                              item.COMPANY_NAME || "",
                              item.PRODUCT_CODE || "",
                              (item.PRODUCT_NAME || "") +
                                (parseFloat(item.QUANTITY || 0) < 0 ? " (REFUND)" : ""),
                              String(item.PRODUCT_NAME_SINHALA || "").trim(),
                              parseFloat(item.COSTPRICE || 0).toFixed(2),
                              parseFloat(item.UNITPRICE || 0).toFixed(2),
                              parseFloat(item.STOCK || 0).toFixed(3),
                              parseFloat(item.QUANTITY || 0).toFixed(2),
                              formatDiscountDisplay(item.DISCOUNT),
                              parseFloat(item.DISCOUNT_AMOUNT || 0).toFixed(2),
                              parseFloat(item.TOTAL || 0).toFixed(2),
                            ])}
                            editableColumns={[]}
                            formatColumns={[5, 6, 10, 11]}
                            rightAlignedColumns={[5, 6, 7, 8, 9, 10, 11]}
                            onRowChange={handleRowChange}
                            onDeleteRow={handleDeleteRow}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full max-w-full mt-6"></div>
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