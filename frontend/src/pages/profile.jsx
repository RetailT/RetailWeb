import { useEffect, useState, useContext, useRef } from "react";
import Navbar from "../components/NavBar";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Receipt,
  Wallet,
  AlertTriangle,
  BarChart3,
  Lightbulb,
  ChevronDown,
  LogOut,
  Mail,
  Building2,
  PackageX,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  ResponsiveContainer,
} from "recharts";

const Dashboard = () => {
  const { authToken, logout } = useContext(AuthContext);
  const [userDetails, setUserDetails] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  // ---- Real data: Today's & Yesterday's Sales (fetched from backend) ----
  const [salesSummary, setSalesSummary] = useState({
    todaySales: "0.00",
    yesterdaySales: "0.00",
    dayBeforeYesterdaySales: "0.00",
    difference: "0.00",
    salesPercentage: 0,          // Today vs Yesterday (not shown in UI, kept for reference)
    yesterdayDifference: "0.00",
    yesterdaySalesPercentage: 0, // Yesterday vs Day-before-yesterday (shown in UI)
  });
  const [loadingSales, setLoadingSales] = useState(true);
  const [salesError, setSalesError] = useState(null);

  const [branchPerformance, setBranchPerformance] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // ---- Real hourly sales trend data for sparkline charts ----
  const [salesTrend, setSalesTrend] = useState({ today: [], yesterday: [] });
  const [loadingTrend, setLoadingTrend] = useState(true);

  const fetchSalesSummary = async () => {
  try {
    setLoadingSales(true);
    setSalesError(null);
    const res = await axios.get(
      `${process.env.REACT_APP_BACKEND_URL}dashboard-sales-summary`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    if (res.data.success) {
      setSalesSummary(res.data.summary || res.data.data);
    }
  } catch (err) {
    console.error("Failed to fetch sales summary:", err);
    setSalesError("Couldn't load sales data. Please refresh.");
  } finally {
    setLoadingSales(false);
  }
};

const fetchSalesTrend = async () => {
  try {
    setLoadingTrend(true);
    const res = await axios.get(
      `${process.env.REACT_APP_BACKEND_URL}sales-trend`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    if (res.data.success) {
      setSalesTrend(res.data.data || { today: [], yesterday: [] });
    }
  } catch (err) {
    console.error("Failed to fetch sales trend:", err);
  } finally {
    setLoadingTrend(false);
  }
};

const fetchBranchPerformance = async () => {
  try {
    setLoadingBranches(true);
    const res = await axios.get(
      `${process.env.REACT_APP_BACKEND_URL}branch-performance`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    if (res.data.success) {
      setBranchPerformance(res.data.data || []);
    }
  } catch (err) {
    console.error("Failed to fetch branch performance:", err);
  } finally {
    setLoadingBranches(false);
  }
};

useEffect(() => {
  if (!authToken) return;
    const loadDashboardData = async () => {
    await fetchSalesSummary();
    await fetchSalesTrend();
    await fetchBranchPerformance();
  };

  loadDashboardData();
}, [authToken]);

  // ---- Remaining dummy data - replace with real API calls later ----
  const [stats] = useState({
    customers: "1,250",
    avgBillValue: "2,450",
  });

  const [customersTrend] = useState([
    { v: 900 }, { v: 980 }, { v: 1020 }, { v: 1100 }, { v: 1150 }, { v: 1200 }, { v: 1250 },
  ]);
  const [avgBillTrend] = useState([
    { v: 2100 }, { v: 2200 }, { v: 2150 }, { v: 2300 }, { v: 2380 }, { v: 2420 }, { v: 2450 },
  ]);

  const [aiAlerts] = useState([
    { name: "Dead Stock", value: 12, color: "#ef4444" },
    { name: "Slow Moving", value: 25, color: "#f59e0b" },
    { name: "Fast Moving", value: 8, color: "#22c55e" },
  ]);

  const [salesForecast] = useState([
    { label: "Tomorrow", value: 420, color: "#3b82f6" },
    { label: "This Week", value: 2900, color: "#f97316" },
  ]);

  const [lowStockCount] = useState(15);
  const [lowStockTrend] = useState([
    { v: 8 }, { v: 10 }, { v: 9 }, { v: 12 }, { v: 11 }, { v: 14 }, { v: 15 },
  ]);

  const [topProducts] = useState([
    { code: "P001", description: "Coca Cola 1L", qtySold: 450, salesValue: "112,500" },
    { code: "P002", description: "Anchor Milk Powder 400g", qtySold: 320, salesValue: "96,000" },
    { code: "P003", description: "ABC Soap", qtySold: 210, salesValue: "42,000" },
  ]);

  const [aiRecommendations] = useState([
    "Reorder Coca Cola 1L",
    "Clear ABC Soap (No sales 45 days)",
    "Increase stock of Anchor 400g",
  ]);
  // ---- End dummy data ----

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserDetails({
          username: decoded.username || "Unknown",
          email: decoded.email || "Not Provided",
          companyName: decoded.companyName || "RT",
        });
      } catch (error) {
        console.error("Error decoding token:", error.message);
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  // Format a raw number string like "325000.00" into "325,000"
  const formatCurrency = (value) => {
    const num = parseFloat(value || 0);
    return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="pt-16 sm:pt-20">
        {/* Page header with title + profile */}
        <div className="sticky top-16 z-30 flex items-center justify-between px-5 py-5 bg-white border-b shadow-sm sm:top-20 sm:px-10 sm:py-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">RTPOS Dashboard</h1>
            <p className="mt-1 text-xs text-gray-400 sm:text-sm">Overview of your business today</p>
          </div>

          {userDetails && (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-2 py-2 pl-2 pr-4 transition rounded-full border border-gray-200 hover:border-orange-300 hover:bg-orange-50"
              >
                <div className="flex items-center justify-center w-9 h-9 text-sm font-bold text-white rounded-full shadow-inner bg-gradient-to-br from-orange-500 to-orange-600 sm:w-10 sm:h-10">
                  {userDetails.username?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden text-sm font-semibold text-gray-700 sm:block">
                  {userDetails.username}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    showProfileMenu ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 z-40 mt-3 overflow-hidden bg-white border border-gray-100 shadow-2xl w-72 rounded-2xl">
                  <div className="p-6 text-white bg-gradient-to-br from-orange-500 to-orange-600">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 text-xl font-bold rounded-full bg-white/20 backdrop-blur">
                      {userDetails.username?.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-base font-semibold text-center">{userDetails.username}</p>
                    <p className="mt-0.5 text-xs text-center text-orange-50">{userDetails.companyName}</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-orange-500 shrink-0" />
                      <span className="truncate">{userDetails.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Building2 className="w-4 h-4 text-orange-500 shrink-0" />
                      <span>{userDetails.companyName}</span>
                    </div>
                    <button
                      onClick={logout}
                      className="flex items-center justify-center w-full gap-2 py-2.5 mt-2 text-sm font-semibold text-red-500 transition rounded-lg bg-red-50 hover:bg-red-100"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 space-y-8 sm:p-10 sm:space-y-10">
          {/* Error banner - shows only if the sales summary fetch fails */}
          {salesError && (
            <div className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-700 border border-red-200 rounded-xl bg-red-50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {salesError}
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <StatCard
              label="Today's Sales"
              value={loadingSales ? "..." : formatCurrency(salesSummary.todaySales)}
              icon={<Wallet className="w-5 h-5" />}
              accent="from-orange-400 to-orange-600"
              loading={loadingSales}
              sparkColor="#f97316"
              sparkId="todaysSales"
              sparkData={loadingTrend ? null : salesTrend.today}
            />
            <StatCard
              label="Yesterday's Sales"
              value={loadingSales ? "..." : formatCurrency(salesSummary.yesterdaySales)}
              icon={<TrendingUp className="w-5 h-5" />}
              accent="from-emerald-400 to-emerald-600"
              percentage={salesSummary.yesterdaySalesPercentage}
              loading={loadingSales}
              sparkColor="#10b981"
              sparkId="yesterdaysSales"
              sparkData={loadingTrend ? null : salesTrend.yesterday}
            />
            {/* <StatCard
              label="Customers"
              value={stats.customers}
              icon={<Users className="w-5 h-5" />}
              accent="from-blue-400 to-blue-600"
              sparkColor="#3b82f6"
              sparkId="customers"
              sparkData={customersTrend}
            />
            <StatCard
              label="Avg Bill Value"
              value={stats.avgBillValue}
              icon={<Receipt className="w-5 h-5" />}
              accent="from-violet-400 to-violet-600"
              sparkColor="#8b5cf6"
              sparkId="avgBillValue"
              sparkData={avgBillTrend}
            /> */}
          </div>

          {/* Branch Performance: This Month vs Last Month sales */}
          <Panel
            title="Branch Performance"
            subtitle="This Month's Sales by Branch (vs Last Month)"
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          >
            {loadingBranches ? (
              <p className="py-8 text-sm text-center text-gray-400">Loading...</p>
            ) : branchPerformance.length === 0 ? (
              <p className="py-8 text-sm text-center text-gray-400">No sales data for this period.</p>
            ) : (
              <>
                <div className="w-full mb-6 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchPerformance} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="branchName" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Bar dataKey="sales" name="This Month's Sales" fill="#10b981" radius={[6, 6, 0, 0]} barSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <TableWrapper
                  headers={["Branch", "This Month's Sales", "Growth (vs Last Month)", "Rank"]}
                  rows={branchPerformance.map((b) => [
                    b.branchName,
                    formatCurrency(b.sales),
                    <span
                      key="g"
                      className={`inline-flex items-center gap-1 font-semibold ${
                        b.growth > 0
                          ? "text-emerald-600"
                          : b.growth < 0
                          ? "text-red-500"
                          : "text-gray-400"
                      }`}
                    >
                      {b.growth > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : b.growth < 0 ? (
                        <TrendingDown className="w-3.5 h-3.5" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                      {b.growth > 0 ? "+" : ""}{b.growth}%
                    </span>,
                    <span key="r" className="px-2 py-0.5 text-xs font-bold text-orange-600 bg-orange-100 rounded-full">#{b.rank}</span>,
                  ])}
                />
              </>
            )}
          </Panel>

          {/* AI Alerts / Sales Forecast / Low Stock */}
          {/* <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
            <Panel title="AI Alerts" icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}>
              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={aiAlerts}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="62%"
                        outerRadius="92%"
                        paddingAngle={3}
                        stroke="none"
                      >
                        {aiAlerts.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-extrabold text-gray-800">
                      {aiAlerts.reduce((sum, a) => sum + a.value, 0)}
                    </span>
                    <span className="text-[10px] text-gray-400">Total</span>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {aiAlerts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-500">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.name}
                      </span>
                      <span className="font-bold text-gray-800">{a.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Sales Forecast" icon={<BarChart3 className="w-5 h-5 text-blue-500" />}>
              <div className="w-full h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesForecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={44}>
                      {salesForecast.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between pt-3 mt-2 text-xs text-gray-500 border-t border-gray-50">
                <span>Tomorrow: <strong className="text-gray-800">420K</strong></span>
                <span>This Week: <strong className="text-gray-800">2.9M</strong></span>
              </div>
            </Panel>

            <Panel title="Low Stock Alerts" icon={<PackageX className="w-5 h-5 text-red-500" />}>
              <div className="flex items-end justify-between h-36">
                <div>
                  <p className="text-4xl font-extrabold text-red-500">{lowStockCount}</p>
                  <p className="mt-1 text-sm text-gray-400">Items</p>
                </div>
                <div className="w-28 h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={lowStockTrend} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="lowStockGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={2} fill="url(#lowStockGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Panel>
          </div> */}

          {/* Top 10 Products */}
          {/* <Panel title="Top 10 Products" icon={<BarChart3 className="w-5 h-5 text-orange-500" />}>
            <div className="w-full mb-6 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <XAxis
                    dataKey="description"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <Bar dataKey="qtySold" name="Qty Sold" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <TableWrapper
              headers={["Product Code", "Description", "Qty Sold", "Sales Value"]}
              rows={topProducts.map((p) => [p.code, p.description, p.qtySold, p.salesValue])}
            />
          </Panel> */}

          {/* AI Recommendations */}
          {/* <Panel title="AI Recommendations" icon={<Lightbulb className="w-5 h-5 text-yellow-500" />}>
            <ul className="space-y-3">
              {aiRecommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 p-4 text-sm text-gray-700 rounded-lg bg-orange-50"
                >
                  <span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-orange-500 rounded-full shrink-0">
                    {idx + 1}
                  </span>
                  {rec}
                </li>
              ))}
            </ul>
          </Panel> */}
        </div>
      </div>
    </div>
  );
};

// StatCard: sparkData renders the mini area chart, percentage (if provided) renders a % change badge.
const StatCard = ({ label, value, icon, accent, sparkColor, sparkId, sparkData, percentage, loading }) => {
  const hasPercentage = percentage !== undefined;
  const isPositive = hasPercentage && percentage >= 0;

  return (
    <div className="p-5 transition-all duration-200 bg-white border border-gray-100 shadow-lg rounded-2xl sm:p-6 hover:shadow-xl hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-gray-400 sm:text-sm">{label}</p>
        <div className={`flex items-center justify-center w-9 h-9 rounded-xl text-white bg-gradient-to-br ${accent} shadow-md`}>
          {icon}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-xl font-extrabold text-gray-900 sm:text-2xl">{value}</p>

        {hasPercentage && !loading && (
          <span
            className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full ${
              isPositive ? "text-emerald-700 bg-emerald-100" : "text-red-700 bg-red-100"
            }`}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(percentage)}%
          </span>
        )}
      </div>

      {sparkData && sparkData.length > 0 && (
        <div className="w-full h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${sparkId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={sparkColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                strokeWidth={2}
                fill={`url(#spark-${sparkId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const Panel = ({ title, subtitle, icon, children }) => (
  <div className="p-5 transition-all duration-200 bg-white border border-gray-100 shadow-lg rounded-2xl sm:p-7 hover:shadow-xl">
    <div className="pb-4 mb-5 border-b border-gray-100">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-bold text-gray-900 sm:text-lg">{title}</h2>
      </div>
      {subtitle && <p className="mt-1 ml-7 text-sm text-gray-400">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const TableWrapper = ({ headers, rows }) => (
  <div className="overflow-x-auto -mx-5 sm:mx-0">
    <table className="w-full text-sm text-left min-w-[500px]">
      <thead>
        <tr className="border-b border-gray-100">
          {headers.map((h) => (
            <th key={h} className="px-5 py-3 font-semibold text-gray-400 sm:px-0 sm:pr-4 whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="transition border-b border-gray-50 last:border-0 hover:bg-gray-50">
            {row.map((cell, j) => (
              <td key={j} className="px-5 py-4 font-medium text-gray-700 sm:px-0 sm:pr-4 whitespace-nowrap">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default Dashboard;