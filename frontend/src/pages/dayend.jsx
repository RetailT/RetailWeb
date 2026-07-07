import { useState, useEffect, useContext } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import Alert from "../components/Alert";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import axios from "axios";

const Dayend = () => {
  const { authToken } = useContext(AuthContext);
  const token = localStorage.getItem("authToken");

  const [disable, setDisable] = useState(false);
  const [alert, setAlert] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("ALL");
  const [salesRecords, setSalesRecords] = useState([]);
  const [totalNetSales, setTotalNetSales] = useState("0.00");
  const [loadingTable, setLoadingTable] = useState(false);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.userData) {
        setCompanies(res.data.userData.map((c) => ({
          code: c.COMPANY_CODE.trim(),
          name: c.COMPANY_NAME.trim(),
        })));
      }
    } catch (err) {
      console.error("Failed to fetch companies:", err);
    }
  };

  const fetchSalesData = async (companyCode = "ALL") => {
    try {
      setLoadingTable(true);
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}dayend-sales`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { company: companyCode },
      });
      if (res.data.success) {
        setSalesRecords(res.data.records || []);
        setTotalNetSales(res.data.totalNetSales || "0.00");
      }
    } catch (err) {
      setAlert({ message: err.response?.data?.message || "Failed to load sales data", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchSalesData("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authToken) return <Navigate to="/login" replace />;

  const handleCompanyChange = (e) => {
    const val = e.target.value;
    setSelectedCompany(val);
    fetchSalesData(val);
  };

  const handleRefresh = () => {
    fetchSalesData(selectedCompany);
  };

  const handleDayend = async () => {
    if (!confirmed) {
      setAlert({ message: "Please confirm before running Dayend.", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      return;
    }
    try {
      setDisable(true);
      setAlert({ message: "Dayend running, please wait...", type: "info" });
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}run-dayend`,
        { company: selectedCompany },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 }
      );
      if (res.data.success) {
        setAlert({ message: res.data.message || "Dayend completed successfully!", type: "success" });
        setConfirmed(false);
        fetchSalesData(selectedCompany);
        setTimeout(() => setAlert(null), 5000);
      }
    } catch (err) {
      setAlert({ message: err.response?.data?.message || "Dayend failed. Please try again.", type: "error" });
      setTimeout(() => setAlert(null), 5000);
    } finally {
      setDisable(false);
    }
  };

  const selectedCompanyName = selectedCompany === "ALL"
    ? "All Companies"
    : (companies.find((c) => c.code === selectedCompany)?.name || selectedCompany);


  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div>
      <Navbar />
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex-1 p-2 sm:p-4 md:p-6 ml-0 mr-0 sm:ml-4 md:ml-5 sm:mr-4">
          <div className="mt-20 mb-4 ml-2 sm:mt-20 md:mt-24 sm:ml-4">
            <Heading text="Dayend" />
          </div>

          <div className="mt-2 ml-2 mr-2 sm:ml-4 sm:mr-4 sm:mt-4">
            {alert && (
              <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />
            )}
          </div>

          <div className="max-w-7xl mx-auto mt-2 sm:mt-4 px-2 sm:px-0">
            <div className="flex flex-col lg:flex-row gap-4 items-start">

              {/* ── LEFT: PROCESS CARD ── */}
              <div className="flex flex-col gap-4 w-full lg:w-80 flex-shrink-0">
                <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                  <div className="bg-gray-100 border-b border-gray-300 py-2.5 px-4 text-center font-semibold text-base text-gray-800">
                    Day End
                  </div>

                  <div className="p-4 pt-3">
                    <div className="relative bg-[#1A1A1A] rounded-md p-3.5 mb-4 overflow-hidden">
                      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-[#FF6B00]/10" />
                      <p className="text-xs font-semibold text-[#FF6B00] mb-1 uppercase tracking-wider flex items-center gap-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        </svg>
                        Before you continue
                      </p>
                      <p className="text-sm text-gray-300 leading-relaxed relative mb-2">
                        Dayend processes all pending sales, updates stock and clears daily records.
                        Make sure every POS terminal is closed first.
                      </p>
                      <div className="flex items-center gap-1.5 text-sm relative pt-2 border-t border-white/10">
                        <span className="text-gray-400">Scope:</span>
                        <span className="font-semibold text-white truncate">{selectedCompanyName}</span>
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 mb-4 cursor-pointer select-none group">
                      <div className="relative flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                          disabled={disable}
                          className="peer sr-only"
                        />
                        <div className="w-[19px] h-[19px] rounded border-2 border-gray-300 peer-checked:bg-[#FF6B00] peer-checked:border-[#FF6B00] transition-colors flex items-center justify-center">
                          {confirmed && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-700 leading-relaxed">
                        I confirm all POS terminals are closed and want to run Dayend.
                      </span>
                    </label>

                    <button
                      onClick={handleDayend}
                      disabled={disable || !confirmed}
                      className={`w-full py-3 bg-black text-white text-base font-semibold rounded-md shadow hover:bg-gray-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                        disable || !confirmed ? "opacity-40 cursor-not-allowed hover:bg-black" : ""
                      }`}
                    >
                      {disable ? (
                        <>
                          <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <circle cx="12" cy="12" r="10" opacity="0.25" />
                            <path d="M12 2a10 10 0 0110 10" />
                          </svg>
                          Running Dayend...
                        </>
                      ) : (
                        "Dayend"
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── RIGHT: SUMMARY + LEDGER ── */}
              <div className="flex-1 w-full min-w-0 flex flex-col gap-4">

                {/* receipt-style total card */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-dashed border-gray-300 bg-gray-50">
                    <span className="text-base font-medium text-gray-700 flex-shrink-0">Company</span>
                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                      <select
                        value={selectedCompany}
                        onChange={handleCompanyChange}
                        className="p-2 text-base bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 focus:border-[#FF6B00] w-full sm:w-24"
                      >
                        <option value="ALL">ALL</option>
                        {companies.map((c) => (
                          <option key={c.code} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                      <select
                        value={selectedCompany}
                        onChange={handleCompanyChange}
                        className="p-2 text-base bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 focus:border-[#FF6B00] w-full sm:flex-1"
                      >
                        <option value="ALL">ALL COMPANY</option>
                        {companies.map((c) => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch">
                    <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Total Net Sales
                      </span>
                      <div className="text-5xl sm:text-6xl font-bold text-[#FF6B00] leading-tight mt-1 font-['Barlow_Condensed']">
                        {parseFloat(totalNetSales).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="hidden sm:block w-px bg-gray-200 my-4" />
                    <div className="flex sm:flex-col items-center sm:items-stretch justify-center p-4 sm:p-5 sm:w-40 border-t sm:border-t-0 border-gray-100 bg-gray-50 sm:bg-transparent">
                      <button
                        onClick={handleRefresh}
                        disabled={loadingTable}
                        title="Refresh"
                        className="w-full px-3.5 py-2.5 bg-gray-200 text-gray-700 rounded-md shadow hover:bg-gray-300 active:scale-[0.95] transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        <svg
                          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          className={loadingTable ? "animate-spin" : ""}
                        >
                          <path d="M23 4v6h-6M1 20v-6h6" />
                          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                        </svg>
                        <span className="text-sm font-medium">Refresh</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* ledger table */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-100">
                    <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Pending Sales Ledger</span>
                  </div>
                  <div className="overflow-x-auto" style={{ minHeight: "220px" }}>
                    {loadingTable ? (
                      <div className="flex items-center justify-center h-32 text-gray-400 text-base">
                        <span className="animate-pulse">Loading...</span>
                      </div>
                    ) : (
                      <table className="w-full text-base min-w-[560px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-sm uppercase tracking-wide">Date</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-sm uppercase tracking-wide">Company Code</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-sm uppercase tracking-wide">Company Name</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-sm uppercase tracking-wide">Unit No</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-sm uppercase tracking-wide">Net Sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesRecords.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-10 text-gray-400 text-base">
                                No pending sales data
                              </td>
                            </tr>
                          ) : (
                            salesRecords.map((row, idx) => (
                              <tr key={idx} className="border-b border-gray-100 hover:bg-orange-50/40 transition-colors">
                                <td className="px-4 py-2 text-gray-700">{row.DATE}</td>
                                <td className="px-4 py-2 text-gray-700">{row.COMPANY_CODE}</td>
                                <td className="px-4 py-2 text-gray-700">{row.COMPANY_NAME}</td>
                                <td className="px-4 py-2 text-gray-700">{row.UNIT_NO}</td>
                                <td className="px-4 py-2 text-right text-gray-700 font-medium">
                                  {parseFloat(row.NET_SALES).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dayend;