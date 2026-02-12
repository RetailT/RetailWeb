import { useEffect, useState, useContext } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import DatePicker from "../components/DatePicker";
import MultiSelectDropdown from "../components/MultiSelectDropdown";
import Alert from "../components/Alert";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import CircleBounceLoader from "../components/Loader";
import axios from "axios";
import ScrollableTable from "../components/Table";
import BarChart from "../components/BarChart";
import PieChart from "../components/PieChart";

const SalesReportDashboard = () => {
  const { authToken } = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  const [disable, setDisable] = useState(true);
  const [alert, setAlert] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [tableRecords, setTableRecords] = useState([]);
  const [tableHeadings, setTableHeadings] = useState([]);
  const [monthlyAmountData, setMonthlyAmountData] = useState([]);
  const [monthlyAmountLabels, setMonthlyAmountLabels] = useState([]);
  const token = localStorage.getItem("authToken");

  // 12 colors — orange-based family (warm tones, good contrast)
  const MONTHLY_CHART_COLORS = [
    "#f97316",    // bright orange          → January
    "#ea580c",    // deep orange            → February
    "#fb923c",    // soft orange            → March
    "#fed7aa",    // light peach            → April
    "#c2410c",    // reddish orange         → May
    "#9a3412",    // burnt orange           → June
    "#f59e0b",    // amber / golden orange  → July
    "#d97706",    // dark amber             → August
    "#b45309",    // bronze / dark orange   → September
    "#ea580c",    // repeat deep orange     → October
    "#f87171",    // soft coral red-orange  → November
    "#991b1b",    // dark red-orange        → December
  ];

  const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  let newFromDate = selectedDates.fromDate ? formatDate(selectedDates.fromDate) : null;
  let newToDate = selectedDates.toDate ? formatDate(selectedDates.toDate) : null;

  if (newFromDate && newToDate && newFromDate > newToDate) {
    [newFromDate, newToDate] = [newToDate, newFromDate];
  }

  const monthOptions = [
    { code: "1", name: "January" },
    { code: "2", name: "February" },
    { code: "3", name: "March" },
    { code: "4", name: "April" },
    { code: "5", name: "May" },
    { code: "6", name: "June" },
    { code: "7", name: "July" },
    { code: "8", name: "August" },
    { code: "9", name: "September" },
    { code: "10", name: "October" },
    { code: "11", name: "November" },
    { code: "12", name: "December" },
  ];

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const companies = response.data.userData || [];
      setUserData(companies);

      if (companies.length === 0) {
        setAlert({ message: "No companies found", type: "error" });
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
      setAlert({ message: "Failed to load companies", type: "error" });
    } finally {
      setDisable(false);
    }
  };

  const fetchSalesData = async () => {
    if (!newFromDate || !newToDate) {
      setAlert({ message: "Please select a valid date range", type: "error" });
      return;
    }

    if (selectedCompanies.length === 0) {
      setAlert({ message: "Please select at least one company", type: "error" });
      return;
    }

    setDisable(true);
    setAlert(null);

    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}sales-report-data`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          fromDate: newFromDate,
          toDate: newToDate,
          selectedOptions: selectedCompanies.map(opt => opt.code).join(","),
          months: selectedMonths.length > 0 ? selectedMonths.map(m => m.code).join(",") : undefined,
        },
      });

      const tableData = response.data.tableRecords || [];

      if (tableData.length === 0) {
        setAlert({
          message: "No sales data found for the selected filters",
          type: "warning",
        });
        setTableRecords([]);
        setTableHeadings([]);
        setMonthlyAmountData([]);
        setMonthlyAmountLabels([]);
      } else {
        processMonthlySales(tableData);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setAlert({ message: "Failed to load sales data", type: "error" });
    } finally {
      setDisable(false);
    }
  };

  const processMonthlySales = (rawData) => {
    if (!rawData || rawData.length === 0) {
      setTableRecords([]);
      setTableHeadings([]);
      setMonthlyAmountData([]);
      setMonthlyAmountLabels([]);
      return;
    }

    const grouped = {};
    const monthTotals = {};

    rawData.forEach((record) => {
      const monthName = record.month;
      const year = record.year;
      const total = Number(record.total_sales || 0);

      if (!grouped[monthName]) grouped[monthName] = {};
      grouped[monthName][year] = total.toFixed(2);

      if (!monthTotals[monthName]) {
        monthTotals[monthName] = 0;
      }
      monthTotals[monthName] += total;
    });

    const years = [...new Set(rawData.map(r => r.year))].sort((a, b) => a - b);
    const headers = ["MONTH", ...years];

    const monthOrder = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const rows = monthOrder
      .filter(month => grouped[month])
      .map(month => {
        const row = [month];
        years.forEach(year => {
          row.push(grouped[month][year] || "0.00");
        });
        return row;
      });

    setTableHeadings(headers);
    setTableRecords(rows);

    // Chart data - show all months that have data
    const chartLabels = monthOrder.filter(month => monthTotals[month] !== undefined);
    const chartData = chartLabels.map(month => monthTotals[month].toFixed(2));

    setMonthlyAmountLabels(chartLabels);
    setMonthlyAmountData(chartData);
  };

  useEffect(() => {
    setSubmitted(false);
    setShowReport(false);
    setTableRecords([]);
    setTableHeadings([]);
    setMonthlyAmountData([]);
    setMonthlyAmountLabels([]);
    setAlert(null);
  }, [selectedDates, selectedCompanies, selectedMonths]);

  useEffect(() => {
    if (token) {
      fetchCompanies();
    }
  }, [token]);

  const handleSubmit = () => {
    if (!newFromDate || !newToDate) {
      setAlert({ message: "Please select a date range", type: "error" });
      return;
    }

    if (selectedCompanies.length === 0) {
      setAlert({ message: "Please select at least one company", type: "error" });
      return;
    }

    setSubmitted(true);
    setShowReport(true);
    fetchSalesData();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const isSubmitDisabled =
    disable ||
    !newFromDate ||
    !newToDate ||
    selectedCompanies.length === 0;

  return (
    <div>
      {disable && <CircleBounceLoader />}

      <Navbar />

      <div className="container p-6 mx-auto md:p-16">
        <div className="mt-20 md:mt-14">
          <Heading text="Sales Report Dashboard" />
        </div>

        <div className="mt-4">
          {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}

          <div className="p-4 mt-4 bg-gray-200 rounded-lg shadow-md" style={{ backgroundColor: "#d8d8d8" }}>
            <div className="mt-10">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end flex-wrap">
                  <DatePicker label="Select Date Range:" onDateChange={setSelectedDates} />

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Select Company:
                    </label>
                    <MultiSelectDropdown
                      options={
                        userData
                          ? userData.map(c => ({
                              code: c.COMPANY_CODE.trim(),
                              name: c.COMPANY_NAME.trim(),
                            }))
                          : []
                      }
                      onDropdownChange={setSelectedCompanies}
                      selected={selectedCompanies}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Select Months (Optional):
                    </label>
                    <MultiSelectDropdown
                      options={monthOptions}
                      onDropdownChange={setSelectedMonths}
                      selected={selectedMonths}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    className={`px-6 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition ${
                      isSubmitDisabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Submit
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={disable}
                    className={`px-6 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition ${
                      disable ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          {showReport && (
            <div className="p-6 mt-6 bg-white rounded-md shadow-md text-center">
              <h2 className="text-2xl font-bold">Sales Report</h2>
              <p className="mt-2 font-medium">
                Date: {newFromDate || "—"} – {newToDate || "—"}
              </p>
            </div>
          )}

          {showReport && tableRecords.length > 0 && (
            <>
              <style jsx>{`
                .sales-report-table-container th {
                  font-weight: 700 !important;
                  color: #111827;
                  background-color: #f3f4f6;
                }
                .sales-report-table-container tbody td:first-child {
                  font-weight: 700 !important;
                  color: #111827;
                }
                .sales-report-table-container tbody tr {
                  cursor: default !important;
                }
                .sales-report-table-container tbody tr:hover {
                  background-color: transparent !important; 
                }
              `}</style>

              <div className="mt-10 sales-report-table-container">
                <div className="bg-white p-4 border border-gray-300 rounded-md shadow-md overflow-x-auto">
                  <ScrollableTable
                    headers={tableHeadings}
                    data={tableRecords}
                    rightAlignedColumns={tableHeadings.map((_, i) => i).slice(1)}
                    onRowClick={() => {}}
                  />
                </div>
              </div>

              {/* Charts - Pie + Bar */}
              <div className="mt-12 space-y-12">
                {/* Pie Chart */}
                {monthlyAmountData.length > 0 && (
                  <div className="bg-white p-6 border border-gray-300 rounded-md shadow-md">
                    <h3 className="text-xl font-bold text-center mb-6">
                      Monthly Sales Distribution
                    </h3>
                    <div className="max-w-[500px] mx-auto">
                      <PieChart
                        data={monthlyAmountData}
                        labels={monthlyAmountLabels}
                        colors={MONTHLY_CHART_COLORS.slice(0, monthlyAmountLabels.length)}
                        title=""
                      />
                    </div>
                  </div>
                )}

                {/* Bar Chart */}
                {monthlyAmountData.length > 0 && (
                  <div className="bg-white p-6 border border-gray-300 rounded-md shadow-md">
                    <h3 className="text-xl font-bold text-center mb-6">
                      Monthly Sales Amount
                    </h3>
                    <BarChart
                      data={monthlyAmountData}
                      labels={monthlyAmountLabels}
                      colors={MONTHLY_CHART_COLORS.slice(0, monthlyAmountLabels.length)}
                      title="Amount"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {showReport && tableRecords.length === 0 && !disable && (
            <div className="mt-10 text-center text-gray-600">
              <p className="text-lg">
                No data available for the selected period / companies / months
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesReportDashboard;