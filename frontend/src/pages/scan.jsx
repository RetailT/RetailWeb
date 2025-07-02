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
      setLoading(true);
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

    if (selectedType) {
      tableData();
    }
  }, [scannerEnabled, selectedType]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const requestData = async (data, name) => {
    setLoading(true);
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
      setSalesData(response.data.salesData[0]);
      setAmount(response.data.amount);
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

      setLoading(false);
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
      setCode("");
      setInputValue("");
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
      setLoading(true);
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

      if (response.data.message !== "Data Found Successfully") {
        setAlert({
          message: response.data.message || "Data not available",
          type: "error",
        });
        setTimeout(() => setAlert(null), 3000);
      }
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

      setLoading(false);
    } catch (err) {
      setLoading(false);
      if (selectedType !== "STOCK") {
        console.log("yes");
        setAlert({
          message: err.response?.data?.message || "Stock data finding failed",
          type: "error",
        });
        setTimeout(() => setAlert(null), 3000);
      }
    }
  };

  // const handleDeleteRow = async (rowIndex) => {
  //   const deletedRow = newTableData[rowIndex];
  //   const idxValue = deletedRow.idx; // Access the IDX value of the row being deleted

  //   try {
  //     const response = await axios.delete(
  //       `${process.env.REACT_APP_BACKEND_URL}grnprn-delete`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //         params: {
  //           idx: idxValue,
  //           type: selectedType,
  //         },
  //       }
  //     );

  //     if (response.data.message === "Data deleted successfully") {
  //       tableData();
  //       setAlert({
  //         message: response.data.message || "Item deleted successfully",
  //         type: "success",
  //       });
  //       // Dismiss alert after 3 seconds
  //       setTimeout(() => setAlert(null), 3000);
  //     }
  //   } catch (err) {
  //     // Handle any errors that occur
  //     setAlert({
  //       message: err.response?.data?.message || "Item deletion failed",
  //       type: "error",
  //     });

  //     // Dismiss alert after 3 seconds
  //     setTimeout(() => setAlert(null), 3000);
  //   }
  // };

  // const handleTableDataSubmit = async () => {
  //   try {
  //     setDisable(true);
  //     const response = await axios.get(
  //       `${process.env.REACT_APP_BACKEND_URL}final-grnprn-update`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //         params: {
  //           username: username,
  //           company: selectedCompany,
  //           type: selectedType,
  //           // remarks: remarks,
  //         },
  //       }
  //     );

  //     if (response.data.message === "Data moved and deleted successfully") {
  //       setDisable(false);
  //       setAlert({
  //         message: response.data.message || "Data moved successfully",
  //         type: "success",
  //       });
  //       setTimeout(() => {
  //         setAlert(null); // Clear the alert
  //         setTimeout(() => {
  //           setShowTable(false); // Hide the table after 3 seconds
  //           window.location.reload(); // Refresh the page
  //         }, 200); // Add a small delay before reloading
  //       }, 3000);
  //     } else {
  //       // setInitialData(false);
  //       // setDisable(false);
  //       setAlert({
  //         message: response.data.message || "Cannot move data",
  //         type: "success",
  //       });
  //       // Dismiss alert after 3 seconds
  //       setTimeout(() => setAlert(null), 3000);
  //     }
  //     setDisable(false);
  //   } catch (err) {
  //     setDisable(false);
  //     // Handle any errors that occur
  //     setAlert({
  //       message: err.response?.data?.message || "Data deletion failed",
  //       type: "error",
  //     });

  //     // Dismiss alert after 3 seconds
  //     setTimeout(() => setAlert(null), 3000);
  //   }
  // };

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
      <div className="flex">
        <div className="transition-all duration-300 flex-1 p-4 sm:p-6 md:ml-10 md:mr-10 ml-4 mr-10 ml-8 mt-[96px] max-w-full">
          <div className="w-full max-w-full">
            <Heading text="Scan" />
          </div>

          <div className="mt-5 w-full">
            {alert && (
              <Alert
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert(null)}
              />
            )}
          </div>

          {!initialData && (
            <div className="bg-[#d8d8d8] p-4 sm:p-5 rounded-md shadow-md mb-10 mt-10 w-full max-w-full">
              {/* Row 1: Company, Type, Conditional field */}
              <div className="flex flex-col lg:flex-row gap-4 mb-4">
                {/* Company */}
                <div className="flex flex-col w-full lg:w-1/3">
                  <label className="text-sm font-medium text-gray-700">
                    Select a Company
                  </label>
                  <select
                    value={selectedCompany}
                    onChange={handleCompanyChange}
                    className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full"
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
                <div className="flex flex-col w-full lg:w-1/3">
                  <label className="text-sm font-medium text-gray-700">
                    Select a Type
                  </label>
                  <select
                    value={selectedType}
                    onChange={handleTypeChange}
                    className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full"
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
                  <div className="flex flex-col w-full lg:w-1/3">
                    <label className="text-sm font-medium text-gray-700">
                      Select Vendor
                    </label>
                    <select
                      value={selectedVendor}
                      onChange={handleVendorChange}
                      className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full"
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
                  <div className="flex flex-col w-full lg:w-1/3">
                    <label className="text-sm font-medium text-gray-700">
                      Company To
                    </label>
                    <select
                      value={selectedToCompany}
                      onChange={handleToCompanyChange}
                      className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full"
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
                  <div className="flex flex-col w-full lg:w-1/3">
                    <label className="text-sm font-medium text-gray-700">
                      Select a Count
                    </label>
                    <select
                      value={selectedCount}
                      onChange={handleCountChange}
                      className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full"
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
              <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">
                {(selectedType === "GRN" || selectedType === "PRN") && (
                  <div className="flex flex-col w-full lg:w-1/3">
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
                      className="border border-gray-300 p-2 rounded-md shadow-sm bg-white w-full"
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
                    className="bg-black hover:bg-gray-800 w-full lg:w-auto text-white font-semibold py-2 px-5 rounded-md shadow-md"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {initialData && (
            <div className="mt-10 w-full max-w-full">
              <div className="flex flex-col">
                {/* Main Content */}
                <div className="flex flex-col flex-grow justify-center items-center w-full max-w-full">
                  <div className="flex items-center mb-3 w-full justify-center">
                    <form
                      onSubmit={handleSubmit}
                      className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full lg:w-auto"
                    >
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full lg:w-[600px]">
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
                          className="px-3 py-2 w-full lg:w-1/2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none"
                        />
                        {showSuggestions && filteredSuggestions.length > 0 && (
                          <ul className="absolute z-10 w-full lg:w-[calc(50%-0.5rem)] bg-white border border-gray-300 rounded-md mt-1 shadow-md">
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
                        <input
                          type="text"
                          id="code"
                          ref={codeRef}
                          value={code}
                          onChange={(e) => {
                            setCode(e.target.value);
                            setScannedCode(e.target.value);
                          }}
                          className="px-3 py-2 w-full lg:w-1/2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none"
                          placeholder="Enter Code"
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded-lg w-full sm:w-auto"
                      >
                        Search
                      </button>
                    </form>
                  </div>
                  {codeError && (
                    <p className="text-red-500 text-sm mt-1 mb-10">
                      {codeError}
                    </p>
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
                          maxWidth: "100%",
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

                  <div className="bg-white p-5 rounded-md shadow-md mb-5 mt-10 sm:w-full md:w-2/5 max-w-full">
                    <div className="text-lg font-semibold mb-4 text-[#f17e21]">
                      Product Details
                    </div>

                    <div className="space-y-2">
                      <div className="border-t pt-2">
                        <p className="font-medium text-[#bc4a17] mb-3">
                          Scanned Data
                        </p>
                        <p className="text-gray-700">
                          <strong>Scanned Code:</strong> {scannedCode}
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
                              <strong>To Company Code:</strong>{" "}
                              {selectedToCompany}
                            </p>
                            <p className="text-gray-700">
                              <strong>To Company Name:</strong>{" "}
                              {selectedToCompanyName}
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
                          <strong>Stock: </strong>{" "}
                          {isNaN(Number(amount))
                            ? "0.000"
                            : Number(amount).toFixed(3)}
                        </p>

                        <form
                          onSubmit={handleSubmit}
                          className="flex flex-col space-y-4"
                        >
                          <div className="flex flex-col space-y-2">
                            <div className="flex flex-col sm:flex-row sm:space-x-2">
                              <p className="text-gray-700">
                                <strong>Quantity: </strong>
                              </p>
                              {colorWiseTableData.length > 0 ? (
                                <div className="overflow-x-auto w-full mt-6">
                                  <div className="w-full max-w-full">
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
                                  className="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 focus:outline-none w-full"
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
                          </div>

                          <div className="flex justify-center items-center">
                            <button
                              onClick={handleProductSubmit}
                              disabled={loading}
                              className={`bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded-lg mt-5 w-full sm:w-1/2 ${
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
            </div>
          )}

          {(selectedType === "GRN" ||
            selectedType === "PRN" ||
            selectedType === "TOG") &&
            newTableData.length !== 0 && (
              <div className="flex flex-col w-full max-w-full">
                {/* Label: always centered */}
                <div className="text-2xl font-bold mt-5 mb-5 text-center w-full">
                  {selectedType}
                </div>

                {/* Scrollable Table Container */}
                <div className="overflow-x-auto w-full mt-4">
                  <div className="w-full max-w-full" ref={tableRef}>
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
