import { useEffect, useRef, useState, useContext } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import Alert from "../components/Alert";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import axios from "axios";

const lockFields = [
  "PLULOCK", "PAYMENTLOCK", "SEEK", "REFUND", "CORRECTION", "VOID", "CANCEL", "SUSPEND", "RECALL", "DEPARTMENT",
  "PO", "REPORTS", "CURRSALES", "CASHIERSALE", "SALSMANSALE", "CUSTOMERSALE", "CREDITCARDSALE", "GIFTSALE", "LOYALTYSALE", "DAYENDSALE",
  "SMANLOCK", "CUSTLOCK", "WSALELOCK", "FLOATCASH", "CUSTPAYLOCK", "BILLSEEKLOCK", "BACKUPLOCK", "BACKUPUSER", "ROUNDUPLOCK",
  "CREDITNOTELOCK", "CUSTOMERNAMELOCK", "PRICELOCK", "GUIDELOCK", "SALESLOCK", "MDCLOCK", "FREELOCK",
  "DISC_REMOVELOCK", "PCARDSLOCK", "DOPENLOCK", "AUTOLOGOFF", "CASHREFUNDLOCK", "BILLCOPYLOCK", "LOYALTYREGLOCK",
];

const integerFields = ["SDISCTIME", "BILLCOPYCOUNT"];
const decimalFields = ["ITDISCPRECNT", "ITDISCAMT", "SDISCPRECNT", "SDISCAMT", "DAILY_DISCLIMIT"];

const toFixed2 = (value) => {
  const num = parseFloat(value);
  return isNaN(num) ? "0.00" : num.toFixed(2);
};

const toInt = (value) => {
  const num = parseInt(value, 10);
  return isNaN(num) ? "0" : String(num);
};

const emptyForm = {
  CASHIER_CODE: "",
  CASHIER_NAME: "",
  PASSWORD: "",
  ...lockFields.reduce((acc, key) => ({ ...acc, [key]: false }), {}),
  ...integerFields.reduce((acc, key) => ({ ...acc, [key]: "0" }), {}),
  ...decimalFields.reduce((acc, key) => ({ ...acc, [key]: "0.00" }), {}),
};

const columnGroups = [
  [
    { key: "PLULOCK", label: "Plu Lock" },
    { key: "PAYMENTLOCK", label: "Payment Lock" },
    { key: "SEEK", label: "Product Seek Lock" },
    { key: "REFUND", label: "Product Refund Lock" },
    { key: "CORRECTION", label: "Correction Lock" },
    { key: "VOID", label: "Void Lock" },
    { key: "CANCEL", label: "Invoice Cancel Lock" },
    { key: "SUSPEND", label: "Invoice Suspend Lock" },
    { key: "RECALL", label: "Invoice Recall Lock" },
    { key: "DEPARTMENT", label: "Department Lock" },
  ],
  [
    { key: "PO", label: "Paid Out Lock" },
    { key: "REPORTS", label: "Report Menu Lock" },
    { key: "CURRSALES", label: "Current Sales Report Lock" },
    { key: "CASHIERSALE", label: "Cashier Sales Report Lock" },
    { key: "SALSMANSALE", label: "Salesman Sales Report Lock" },
    { key: "CUSTOMERSALE", label: "Customer Sales Report Lock" },
    { key: "CREDITCARDSALE", label: "Credit Card Sales Report Lock" },
    { key: "GIFTSALE", label: "GiftVoucher Sales Report Lock" },
    { key: "LOYALTYSALE", label: "Loyalty Sales Report Lock" },
    { key: "DAYENDSALE", label: "Dayend Sales Report Lock" },
  ],
  [
    { key: "CASHREFUNDLOCK", label: "Cash/Credit Refund Lock" },
    { key: "SMANLOCK", label: "Salesman Lock" },
    { key: "CUSTLOCK", label: "Customer Lock" },
    { key: "WSALELOCK", label: "Whole Sales Lock" },
    { key: "FLOATCASH", label: "Float Cash Lock" },
    { key: "CUSTPAYLOCK", label: "Credit Customer Payment Lock" },
    { key: "BILLSEEKLOCK", label: "Invoice Seek Lock" },
    { key: "BACKUPLOCK", label: "Backup Lock" },
    { key: "BACKUPUSER", label: "Backup User" },
    { key: "ROUNDUPLOCK", label: "Roundup Lock" },
  ],
  [
    { key: "CREDITNOTELOCK", label: "Credit Note Lock" },
    { key: "CUSTOMERNAMELOCK", label: "Customer Name Type Lock" },
    { key: "PRICELOCK", label: "Price Edit Lock" },
    { key: "GUIDELOCK", label: "Guide Lock" },
    { key: "SALESLOCK", label: "Current Sales View Lock" },
    { key: "MDCLOCK", label: "Money Declare (MDC) Lock" },
    { key: "FREELOCK", label: "Free Issue Lock" },
    { key: "DISC_REMOVELOCK", label: "Discount Remove Lock" },
    { key: "PCARDSLOCK", label: "Phone Card Lock" },
    { key: "DOPENLOCK", label: "Drawer Open Lock" },
  ],
  [
    { key: "BILLCOPYLOCK", label: "ReCopy Lock" },
    { key: "LOYALTYREGLOCK", label: "Loyalty Registration Lock" },
    { key: "AUTOLOGOFF", label: "Auto Log Off Active" },
  ],
];

const discountFields = [
  { key: "SDISCTIME", label: "Sub Disc.Times" },
  { key: "ITDISCPRECNT", label: "Product Disc.%" },
  { key: "ITDISCAMT", label: "Product Disc.Amt." },
  { key: "SDISCPRECNT", label: "Sub Disc.%" },
  { key: "SDISCAMT", label: "Sub Disc.Amt." },
  { key: "DAILY_DISCLIMIT", label: "Daily Disc. Limit" },
  { key: "BILLCOPYCOUNT", label: "ReCopy Count" },
];

const CashierController = () => {
  const { authToken } = useContext(AuthContext);
  const token = localStorage.getItem("authToken");

  const [cashiers, setCashiers] = useState([]);
  const [cashierSearch, setCashierSearch] = useState("");
  const [filteredCashiers, setFilteredCashiers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [formData, setFormData] = useState(emptyForm);
  const [disable, setDisable] = useState(false);
  const [alert, setAlert] = useState(null);
  const cashierCodeInputRef = useRef(null);

  const fetchCashiers = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}cashiers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setCashiers(response.data.cashiers || []);
      }
    } catch (err) {
      setAlert({ message: err.response?.data?.message || "Failed to load cashiers", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  useEffect(() => {
    if (token) fetchCashiers();
  }, []);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const handleCashierSearch = (e) => {
    const value = e.target.value.toUpperCase();
    setCashierSearch(value);
    if (value.length > 0) {
      const filtered = cashiers.filter(
        (c) =>
          c.CASHIER_NAME.toUpperCase().includes(value) ||
          c.CASHIER_CODE.toUpperCase().includes(value)
      );
      setFilteredCashiers(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredCashiers(cashiers);
      setShowSuggestions(true);
    }
  };

  const handleCashierSelect = (cashier) => {
    const next = {
      CASHIER_CODE: cashier.CASHIER_CODE || "",
      CASHIER_NAME: cashier.CASHIER_NAME || "",
      PASSWORD: cashier.PASSWORD || "",
    };
    lockFields.forEach((key) => {
      next[key] = (cashier[key] || "").toString().trim().toUpperCase() === "T";
    });
    integerFields.forEach((key) => {
      const raw = cashier[key];
      next[key] = raw !== null && raw !== undefined && raw !== "" ? toInt(raw) : "0";
    });
    decimalFields.forEach((key) => {
      const raw = cashier[key];
      next[key] = raw !== null && raw !== undefined && raw !== "" ? toFixed2(raw) : "0.00";
    });
    setFormData(next);
    setCashierSearch(`${cashier.CASHIER_CODE} ${cashier.CASHIER_NAME}`);
    setShowSuggestions(false);
  };

  const handleLockChange = (key) => (e) => {
    setFormData((prev) => ({ ...prev, [key]: e.target.checked }));
  };

  const handleNumericChange = (key) => (e) => {
    if (integerFields.includes(key)) {
      const val = e.target.value.replace(/[^0-9]/g, "");
      setFormData((prev) => ({ ...prev, [key]: val }));
      return;
    }

    let val = e.target.value.replace(/[^0-9.]/g, "");

    const dotCount = val.split(".").length - 1;
    if (dotCount > 1) {
      const firstDot = val.indexOf(".");
      val = val.slice(0, firstDot + 1) + val.slice(firstDot + 1).replace(/\./g, "");
    }

    const dotIndex = val.indexOf(".");
    if (dotIndex !== -1 && val.length - dotIndex - 1 > 2) {
      val = val.slice(0, dotIndex + 3);
    }

    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleNumericBlur = (key) => () => {
    setFormData((prev) => ({
      ...prev,
      [key]: integerFields.includes(key) ? toInt(prev[key]) : toFixed2(prev[key]),
    }));
  };

  const handleClose = () => {
    setFormData(emptyForm);
    setCashierSearch("");
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!formData.CASHIER_CODE) {
      setAlert({ message: "Please select a cashier first", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      return;
    }
    try {
      setDisable(true);
      const payload = { ...formData };
      integerFields.forEach((key) => {
        payload[key] = toInt(payload[key]);
      });
      decimalFields.forEach((key) => {
        payload[key] = toFixed2(payload[key]);
      });
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}cashier-update`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAlert({ message: "Cashier saved successfully", type: "success" });
      setTimeout(() => setAlert(null), 3000);
      handleClose();
      fetchCashiers();
      cashierCodeInputRef.current?.focus();
    } catch (err) {
      setAlert({ message: err.response?.data?.message || "Failed to save cashier", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    } finally {
      setDisable(false);
    }
  };

  const handleDelete = async () => {
    if (!formData.CASHIER_CODE) {
      setAlert({ message: "Please select a cashier first", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      return;
    }
    if (!window.confirm(`Delete cashier ${formData.CASHIER_CODE}? This cannot be undone.`)) {
      return;
    }
    try {
      setDisable(true);
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}cashier-delete`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { code: formData.CASHIER_CODE },
      });
      setAlert({ message: "Cashier deleted successfully", type: "success" });
      setTimeout(() => setAlert(null), 3000);
      handleClose();
      fetchCashiers();
    } catch (err) {
      setAlert({ message: err.response?.data?.message || "Failed to delete cashier", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    } finally {
      setDisable(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-2 ml-2 mr-2 sm:p-4 md:p-6 sm:ml-4 md:ml-5 sm:mr-4">
          <div className="mt-24 mb-2 ml-2 sm:mt-20 md:mt-24 sm:mb-6 md:mb-10 sm:ml-4">
            <Heading text="Cashier Controller" />
          </div>

          <div className="mt-2 ml-2 sm:ml-4 sm:mt-4">
            {alert && (
              <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />
            )}
          </div>

          <div className="max-w-7xl mx-auto mt-6">

            {/* ── Cashier select + name + password ── */}
            <div className="bg-[#d8d8d8] p-3 sm:p-6 rounded-lg shadow-sm mb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">

                {/* Cashier Code combobox */}
                <div className="flex flex-col flex-1 min-w-0 relative">
                  <label className="text-sm font-semibold text-gray-800 mb-2">Cashier Code</label>
                  <input
                    ref={cashierCodeInputRef}
                    type="text"
                    value={cashierSearch}
                    onChange={handleCashierSearch}
                    onFocus={() => {
                      setFilteredCashiers(cashiers);
                      setShowSuggestions(true);
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Search cashier code or name..."
                    autoComplete="off"
                    className="w-full p-2.5 text-base bg-white border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 uppercase"
                  />
                  {showSuggestions && filteredCashiers.length > 0 && (
                    <ul className="absolute z-50 w-full mt-1 top-full overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg max-h-60">
                      {filteredCashiers.map((c) => (
                        <li
                          key={c.CASHIER_CODE}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCashierSelect(c);
                          }}
                          className="p-2.5 text-sm cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0 flex justify-between"
                        >
                          <span>{c.CASHIER_NAME}</span>
                          <span className="text-xs text-gray-400 ml-2">{c.CASHIER_CODE}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Cashier Name */}
                <div className="flex flex-col flex-1 min-w-0">
                  <label className="text-sm font-semibold text-gray-800 mb-2">Cashier Name</label>
                  <input
                    type="text"
                    value={formData.CASHIER_NAME}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, CASHIER_NAME: e.target.value.toUpperCase() }))
                    }
                    disabled={!formData.CASHIER_CODE}
                    className="w-full p-2.5 text-sm bg-white border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-60 uppercase"
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col flex-1 min-w-0">
                  <label className="text-sm font-semibold text-gray-800 mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.PASSWORD}
                    disabled
                    className="w-full p-2.5 text-sm bg-gray-100 border border-gray-200 rounded-md cursor-not-allowed text-gray-500"
                  />
                </div>

              </div>
            </div>

            {formData.CASHIER_CODE && (
              <>
                {/* ── Cashier Functions ── */}
                <div className="bg-[#d8d8d8] p-3 sm:p-6 rounded-lg shadow-sm mb-4">
                  <h2 className="mb-4 text-base font-semibold text-gray-800">Cashier Functions</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                    {columnGroups.map((group, idx) => (
                      <div key={idx} className="flex flex-col gap-2">
                        {group.map(({ key, label }) => (
                          <label key={key} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData[key]}
                              onChange={handleLockChange(key)}
                              className="w-4 h-4 shrink-0"
                            />
                            <span className="text-sm text-gray-700 leading-snug">{label}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Discount Settings ── */}
                <div className="bg-[#d8d8d8] p-3 sm:p-6 rounded-lg shadow-sm mb-4">
                  <h2 className="mb-4 text-base font-semibold text-gray-800">Discount Settings</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {discountFields.map(({ key, label }) => (
                      <div key={key} className="flex flex-col">
                        <label className="text-xs font-semibold text-gray-700 mb-1 leading-snug">{label}</label>
                        <input
                          type="text"
                          inputMode={integerFields.includes(key) ? "numeric" : "decimal"}
                          value={formData[key]}
                          onChange={handleNumericChange(key)}
                          onBlur={handleNumericBlur(key)}
                          className="w-full p-2 text-sm bg-white border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Action Buttons ── */}
                <div className="flex flex-wrap justify-center gap-3 mb-10 px-2">
                  <button
                    onClick={handleSave}
                    disabled={disable}
                    className={`flex-1 min-w-[120px] max-w-[180px] py-2.5 bg-black text-white text-sm font-semibold rounded-md shadow-sm hover:bg-gray-800 ${disable ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Save
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={disable}
                    className={`flex-1 min-w-[120px] max-w-[180px] py-2.5 bg-red-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-red-700 ${disable ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Delete
                  </button>
                  <button
                    onClick={handleClose}
                    disabled={disable}
                    className="flex-1 min-w-[120px] max-w-[180px] py-2.5 bg-gray-500 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-gray-600"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashierController;