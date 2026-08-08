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
  Tooltip,
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

  // ---- Real Top 10 Products data (fetched from backend) ----
  const [topProducts, setTopProducts] = useState([]);
  const [loadingTopProducts, setLoadingTopProducts] = useState(true);
  const [topProductsError, setTopProductsError] = useState(null);
  const [topProductsMonths, setTopProductsMonths] = useState(3); // dropdown: 1/3/6/12

  // ---- Page-level loading: true until ALL dashboard data has finished loading ----
  const [pageLoading, setPageLoading] = useState(true);

  // ---- Branch-wise Today's vs Yesterday's Sales (real data, fetched from backend) ----
  const [branchTodayYesterdaySales, setBranchTodayYesterdaySales] = useState([]);
  const [loadingBranchTodayYesterday, setLoadingBranchTodayYesterday] = useState(true);
  const [branchTodayYesterdayError, setBranchTodayYesterdayError] = useState(null);

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

  // Branch-wise Today's vs Yesterday's Sales (with branch names) - real backend call
  const fetchBranchTodayYesterdaySales = async () => {
    try {
      setLoadingBranchTodayYesterday(true);
      setBranchTodayYesterdayError(null);
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}branch-today-yesterday-sales`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.data.success) {
        setBranchTodayYesterdaySales(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch branch-wise today/yesterday sales:", err);
      setBranchTodayYesterdayError("Couldn't load branch-wise sales. Please refresh.");
    } finally {
      setLoadingBranchTodayYesterday(false);
    }
  };

  // months parameter overrides the ?months= query parameter in the backend
  const fetchTopProducts = async (months = topProductsMonths) => {
    try {
      setLoadingTopProducts(true);
      setTopProductsError(null);
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}top-sales-products?months=${months}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.data.success) {
        setTopProducts(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch top products:", err);
      setTopProductsError("Couldn't load top products. Please refresh.");
    } finally {
      setLoadingTopProducts(false);
    }
  };

  useEffect(() => {
    if (!authToken) return;

    // IMPORTANT: run sequentially, not with Promise.all. Firing several
    // requests at once against the remote SQL Server (each opening/closing
    // its own pool connection) was overloading the connection and causing
    // unrelated endpoints (e.g. branch-performance) to fail with 500 errors.
    // Awaiting each one before starting the next keeps only one connection
    // open at a time - slightly slower overall, but reliable.
    const loadDashboardData = async () => {
      await fetchSalesSummary();
      await fetchSalesTrend();
      await fetchBranchPerformance();
      await fetchBranchTodayYesterdaySales();
      await fetchTopProducts();
      setPageLoading(false);
    };

    loadDashboardData();
  }, [authToken]);

  // changing the months value from the user dropdown triggers a re-fetch of the data
  useEffect(() => {
    if (!authToken) return;
    fetchTopProducts(topProductsMonths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topProductsMonths]);

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

  // A full-screen loader is displayed while all the data on the page is loading
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 pt-16 sm:pt-20">
          <div className="w-12 h-12 border-4 border-orange-500 rounded-full border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

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

          {/* Branch-wise Today's vs Yesterday's Sales - colorful grid cards */}
          <Panel
            title="Branch-wise Sales"
            subtitle="Today's & Yesterday's Sales by Branch"
            icon={<BarChart3 className="w-5 h-5 text-orange-500" />}
          >
            {branchTodayYesterdayError && (
              <div className="flex items-center gap-3 px-4 py-3 mb-4 text-sm font-medium text-red-700 border border-red-200 rounded-xl bg-red-50">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {branchTodayYesterdayError}
              </div>
            )}

            {loadingBranchTodayYesterday ? (
              <p className="py-8 text-sm text-center text-gray-400">Loading...</p>
            ) : branchTodayYesterdaySales.length === 0 ? (
              <p className="py-8 text-sm text-center text-gray-400">No sales data for today or yesterday.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {branchTodayYesterdaySales.map((b, i) => (
                  <BranchSalesCard
                    key={b.branchCode}
                    branchName={b.branchName}
                    todaySales={b.todaySales}
                    yesterdaySales={b.yesterdaySales}
                    colorIndex={i}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            )}
          </Panel>

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
          <Panel
            title="Top 10 Products"
            icon={<BarChart3 className="w-5 h-5 text-orange-500" />}
            headerRight={
              <select
                value={topProductsMonths}
                onChange={(e) => setTopProductsMonths(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg outline-none cursor-pointer hover:border-orange-300"
              >
                <option value={1}>Last 1 Month</option>
                <option value={2}>Last 2 Months</option>
                <option value={3}>Last 3 Months</option>
                <option value={4}>Last 4 Months</option>
                <option value={5}>Last 5 Months</option>
                <option value={6}>Last 6 Months</option>
                <option value={7}>Last 7 Months</option>
                <option value={8}>Last 8 Months</option>
                <option value={9}>Last 9 Months</option>
                <option value={10}>Last 10 Months</option>
                <option value={11}>Last 11 Months</option>
                <option value={12}>Last 12 Months</option>
              </select>
            }
          >
            {topProductsError && (
              <div className="flex items-center gap-3 px-4 py-3 mb-4 text-sm font-medium text-red-700 border border-red-200 rounded-xl bg-red-50">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {topProductsError}
              </div>
            )}

            {loadingTopProducts ? (
              <p className="py-8 text-sm text-center text-gray-400">Loading...</p>
            ) : topProducts.length === 0 ? (
              <p className="py-8 text-sm text-center text-gray-400">No sales data for this period.</p>
            ) : (
              <>
                <div className="w-full mb-6 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                      <XAxis
                        dataKey="productCode"
                        tick={<AngledProductCodeTick />}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        height={50}
                      />
                      <Tooltip
                        cursor={{ fill: "#f3f4f6" }}
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const p = payload[0].payload;
                          return (
                            <div className="px-3 py-2 text-xs bg-white border border-gray-100 shadow-lg rounded-xl">
                              <p className="font-semibold text-gray-800">{p.productName}</p>
                              <p className="text-gray-400">{p.productCode}</p>
                              <p className="mt-1 font-bold text-violet-600">{p.salesQty} sold</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="salesQty" name="Qty Sold" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={38} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <TableWrapper
                  headers={["Product Code", "Product Name", "Qty Sold", "Sales Value"]}
                  rows={topProducts.map((p) => [
                    p.productCode,
                    p.productName,
                    p.salesQty,
                    formatCurrency(p.netSalesValue),
                  ])}
                />
              </>
            )}
          </Panel>

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
            {Math.abs(percentage).toFixed(2)}%
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

// BranchSalesCard: colorful card showing one branch's Today vs Yesterday sales,
// with a small % change badge and a mini progress bar comparing the two.
// colorIndex cycles through a fixed gradient palette so each branch gets a
// distinct, consistent color.
const BRANCH_CARD_COLORS = [
  { grad: "from-orange-400 to-orange-600", bg: "bg-orange-50", text: "text-orange-600", bar: "bg-orange-500", yesterdayBar: "bg-orange-300" },
  { grad: "from-emerald-400 to-emerald-600", bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500", yesterdayBar: "bg-emerald-300" },
  { grad: "from-blue-400 to-blue-600", bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500", yesterdayBar: "bg-blue-300" },
  { grad: "from-violet-400 to-violet-600", bg: "bg-violet-50", text: "text-violet-600", bar: "bg-violet-500", yesterdayBar: "bg-violet-300" },
  { grad: "from-pink-400 to-pink-600", bg: "bg-pink-50", text: "text-pink-600", bar: "bg-pink-500", yesterdayBar: "bg-pink-300" },
  { grad: "from-teal-400 to-teal-600", bg: "bg-teal-50", text: "text-teal-600", bar: "bg-teal-500", yesterdayBar: "bg-teal-300" },
  { grad: "from-amber-400 to-amber-600", bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500", yesterdayBar: "bg-amber-300" },
  { grad: "from-rose-400 to-rose-600", bg: "bg-rose-50", text: "text-rose-600", bar: "bg-rose-500", yesterdayBar: "bg-rose-300" },
];

const BranchSalesCard = ({ branchName, todaySales, yesterdaySales, colorIndex, formatCurrency }) => {
  const palette = BRANCH_CARD_COLORS[colorIndex % BRANCH_CARD_COLORS.length];

  const diff = todaySales - yesterdaySales;
  const pct = yesterdaySales === 0 ? 0 : Number(((diff / yesterdaySales) * 100).toFixed(1));
  const isUp = diff > 0;
  const isFlat = diff === 0;

  // Width of today's bar relative to the larger of the two values, for a quick visual comparison
  const maxVal = Math.max(todaySales, yesterdaySales, 1);
  const todayBarWidth = Math.max((todaySales / maxVal) * 100, 4);
  const yesterdayBarWidth = Math.max((yesterdaySales / maxVal) * 100, 4);

  return (
    <div className={`p-5 rounded-2xl border border-gray-100 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-gradient-to-br ${palette.bg} to-white`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-white bg-gradient-to-br ${palette.grad} shadow-sm`}>
            <Building2 className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-gray-800 sm:text-lg">{branchName}</h3>
        </div>

        {!isFlat && (
          <span
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full ${
              isUp ? "text-emerald-700 bg-emerald-100" : "text-red-700 bg-red-100"
            }`}
          >
            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(pct)}%
          </span>
        )}
        {isFlat && (
          <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-gray-500 bg-gray-100 rounded-full">
            <Minus className="w-3.5 h-3.5" />
            0%
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-400">Today</span>
            <span className={`text-base font-extrabold ${palette.text}`}>{formatCurrency(todaySales)}</span>
          </div>
          <div className="w-full h-2 overflow-hidden bg-gray-100 rounded-full">
            <div
              className={`h-full rounded-full ${palette.bar} transition-all duration-500`}
              style={{ width: `${todayBarWidth}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-400">Yesterday</span>
            <span className="text-base font-bold text-gray-500">{formatCurrency(yesterdaySales)}</span>
          </div>
          <div className="w-full h-2 overflow-hidden bg-gray-100 rounded-full">
            <div
              className={`h-full rounded-full ${palette.yesterdayBar} transition-all duration-500`}
              style={{ width: `${yesterdayBarWidth}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// AngledProductCodeTick: renders each X-axis label (product code) rotated -45deg
// so long codes don't overlap on narrow/mobile screens.
const AngledProductCodeTick = ({ x, y, payload }) => (
  <g transform={`translate(${x},${y})`}>
    <text
      x={0}
      y={0}
      dy={8}
      textAnchor="end"
      transform="rotate(-45)"
      fontSize={9}
      fill="#94a3b8"
    >
      {payload.value}
    </text>
  </g>
);

const Panel = ({ title, subtitle, icon, headerRight, children }) => (
  <div className="p-5 transition-all duration-200 bg-white border border-gray-100 shadow-lg rounded-2xl sm:p-7 hover:shadow-xl">
    <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-bold text-gray-900 sm:text-lg">{title}</h2>
        </div>
        {subtitle && <p className="mt-1 ml-7 text-sm text-gray-400">{subtitle}</p>}
      </div>
      {headerRight}
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