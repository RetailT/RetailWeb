// controllers/dashboardController.js
//
// Dashboard sales endpoints:
//   getTodayYesterdaySales, getBranchTodayYesterdaySales, getSalesTrend,
//   getBranchPerformance, getTopSalesProducts
//
// FIX: "Today's Sales" was 0.
//   Today used ONLY the live data (Sp_SalesCurView / tb_ONLINESALESMAIN), while
//   Yesterday used tb_SALES. Once today's sales are already in tb_SALES
//   (after Dayend / upload) the live sources are empty -> 0.
//   Now: per branch, use the live value when it has sales, otherwise use today's
//   net sales from tb_SALES.
//
// Net sales rule (same as the AI report assistant):
//   only ID 'SL' (sales) and 'RF' (returns), net = SL - RF.
//   It lives in ONE constant below (NET_AMOUNT).

// Net amount of one tb_SALES row: SL adds, RF subtracts.
const NET_AMOUNT = `CASE
      WHEN ID = 'SL' THEN AMOUNT
      WHEN ID = 'RF' THEN -ABS(AMOUNT)
      ELSE 0
    END`;

module.exports = ({ connectToUserDatabase, getPosback, getRtweb, mssql }) => {
  const posback = getPosback();
  const rtweb = getRtweb();

  // ============================================================
  // Helper: today's sales per branch
  //   1) live:     Sp_SalesCurView -> tb_SALES_DASHBOARD_VIEW (before Dayend)
  //   2) fallback: tb_SALES (already day-ended), net = SL - RF
  //      (only for branches where the live view returned nothing / 0,
  //       so nothing is ever counted twice)
  // ============================================================
  async function getTodaySalesByBranch(pool, req) {
    const formatDateForSP = (date) => {
      const d = String(date.getDate()).padStart(2, "0");
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    };
    const formatDateISO = (date) => {
      const d = String(date.getDate()).padStart(2, "0");
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const y = date.getFullYear();
      return `${y}-${m}-${d}`;
    };

    const now = new Date();
    const todayDateSP = formatDateForSP(now);
    const todayDateISO = formatDateISO(now);

    // repUser must be unique PER REQUEST, otherwise concurrent requests from the
    // same user DELETE/INSERT/SELECT the same rows in tb_SALES_DASHBOARD_VIEW
    // (this caused a SQL Server deadlock before).
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const repUser = `dash_${req.user.username || "user"}_${uniqueSuffix}`.slice(0, 100);

    const companiesResult = await pool
      .request()
      .query(`USE [${posback}]; SELECT COMPANY_CODE, COMPANY_NAME FROM tb_COMPANY;`);

    const companies = (companiesResult.recordset || [])
      .map((r) => ({
        code: (r.COMPANY_CODE || "").trim(),
        name: (r.COMPANY_NAME || "").trim(),
      }))
      .filter((c) => c.code);

    await pool.request().input("repUser", mssql.NVarChar, repUser).query(`
      USE [${rtweb}];
      DELETE FROM tb_SALES_DASHBOARD_VIEW WHERE REPUSER = @repUser;
    `);

    for (const company of companies) {
      try {
        const spRequest = pool.request();
        spRequest
          .input("COMPANY_CODE", mssql.NVarChar(10), company.code)
          .input("DATE", mssql.Char(10), todayDateSP)
          .input("REPUSER", mssql.NVarChar(100), repUser)
          .input("REPORT_TYPE", mssql.NVarChar(50), "SALESSUM1");

        await spRequest.query(`
          EXEC [${rtweb}].dbo.Sp_SalesCurView
            @COMPANY_CODE = @COMPANY_CODE,
            @DATE = @DATE,
            @REPUSER = @REPUSER,
            @REPORT_TYPE = @REPORT_TYPE;
        `);
      } catch (spErr) {
        console.error(`Sp_SalesCurView failed for company ${company.code}:`, spErr.message);
      }
    }

    const readRequest = pool.request();
    readRequest
      .input("repUser", mssql.NVarChar, repUser)
      .input("todayDate", mssql.VarChar, todayDateISO);

    const todayResult = await readRequest.query(`
      USE [${rtweb}];
      SELECT
        COMPANY_CODE,
        SUM(NETSALES) AS TodaySales
      FROM tb_SALES_DASHBOARD_VIEW
      WHERE REPUSER = @repUser
        AND SALESDATE = @todayDate
      GROUP BY COMPANY_CODE;
    `);

    const liveMap = {};
    (todayResult.recordset || []).forEach((row) => {
      liveMap[(row.COMPANY_CODE || "").trim()] = parseFloat(row.TodaySales || 0);
    });

    await pool.request().input("repUser", mssql.NVarChar, repUser).query(`
      USE [${rtweb}];
      DELETE FROM tb_SALES_DASHBOARD_VIEW WHERE REPUSER = @repUser;
    `);

    // ---- Fallback: today's sales already inside tb_SALES ----
    const salesMap = {};
    try {
      const salesTodayResult = await pool.request().query(`
        USE [${posback}];
        SELECT
          RTRIM(Company_Code) AS Company_Code,
          ISNULL(SUM(${NET_AMOUNT}), 0) AS TodaySales
        FROM tb_SALES
        WHERE ID IN ('SL', 'RF')
          AND SALESDATE >= CAST(GETDATE() AS DATE)
          AND SALESDATE < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
        GROUP BY RTRIM(Company_Code);
      `);
      (salesTodayResult.recordset || []).forEach((row) => {
        salesMap[(row.Company_Code || "").trim()] = parseFloat(row.TodaySales || 0);
      });
    } catch (fallbackErr) {
      console.error("Today's sales fallback (tb_SALES) failed:", fallbackErr.message);
    }

    const todayMap = {};
    const codes = new Set([...Object.keys(liveMap), ...Object.keys(salesMap)]);
    codes.forEach((code) => {
      todayMap[code] = liveMap[code] ? liveMap[code] : salesMap[code] || 0;
    });

    console.log("📊 Today's sales by branch -> live (Sp_SalesCurView):", liveMap, "| tb_SALES:", salesMap);

    return { companies, todayMap };
  }

  // Net sales for ONE past day (daysAgo = 1 -> yesterday, 2 -> day before)
  const netSalesForDay = async (pool, daysAgo) => {
    const result = await pool.request().input("daysAgo", mssql.Int, daysAgo).query(`
      USE [${posback}];
      SELECT ISNULL(SUM(${NET_AMOUNT}), 0) AS NetSales
      FROM tb_SALES
      WHERE ID IN ('SL', 'RF')
        AND SALESDATE >= DATEADD(DAY, -@daysAgo, CAST(GETDATE() AS DATE))
        AND SALESDATE < DATEADD(DAY, -@daysAgo + 1, CAST(GETDATE() AS DATE));
    `);
    return parseFloat(result.recordset[0]?.NetSales || 0);
  };

  // ============================================================
  // GET - Today's, Yesterday's & Day-Before-Yesterday Sales Summary
  // ============================================================
  const getTodayYesterdaySales = async (req, res) => {
    let pool;
    try {
      const user_ip = String(req.user.ip).trim();
      pool = await connectToUserDatabase(user_ip, req.user.port.trim());

      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      // TODAY - live view, falling back to tb_SALES
      const { todayMap } = await getTodaySalesByBranch(pool, req);
      const todaySales = Object.values(todayMap).reduce((sum, v) => sum + v, 0);

      // YESTERDAY & DAY BEFORE - tb_SALES (sequential: shared pool)
      const yesterdaySales = await netSalesForDay(pool, 1);
      const dayBeforeYesterdaySales = await netSalesForDay(pool, 2);

      const difference = todaySales - yesterdaySales;
      const salesPercentage =
        yesterdaySales === 0 ? 0 : Number(((difference / yesterdaySales) * 100).toFixed(2));

      const yesterdayDifference = yesterdaySales - dayBeforeYesterdaySales;
      const yesterdaySalesPercentage =
        dayBeforeYesterdaySales === 0
          ? 0
          : Number(((yesterdayDifference / dayBeforeYesterdaySales) * 100).toFixed(2));

      console.log("✅ Sales Summary:", { todaySales, yesterdaySales, dayBeforeYesterdaySales });

      return res.status(200).json({
        success: true,
        summary: {
          todaySales: todaySales.toFixed(2),
          yesterdaySales: yesterdaySales.toFixed(2),
          dayBeforeYesterdaySales: dayBeforeYesterdaySales.toFixed(2),
          difference: difference.toFixed(2),
          salesPercentage: salesPercentage,
          yesterdayDifference: yesterdayDifference.toFixed(2),
          yesterdaySalesPercentage: yesterdaySalesPercentage,
        },
      });
    } catch (error) {
      console.error("getTodayYesterdaySales error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch sales summary",
        error: error.message,
      });
    }
  };

  // ============================================================
  // GET - Branch-wise Today's vs Yesterday's Sales (with branch names)
  // ============================================================
  const getBranchTodayYesterdaySales = async (req, res) => {
    let pool;
    try {
      const user_ip = String(req.user.ip).trim();
      pool = await connectToUserDatabase(user_ip, req.user.port.trim());

      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      const { companies, todayMap } = await getTodaySalesByBranch(pool, req);

      if (companies.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }

      // YESTERDAY by branch - tb_SALES (net)
      const yesterdayResult = await pool.request().query(`
        USE [${posback}];
        SELECT
          RTRIM(Company_Code) AS Company_Code,
          ISNULL(SUM(${NET_AMOUNT}), 0) AS YesterdaySales
        FROM tb_SALES
        WHERE ID IN ('SL', 'RF')
          AND SALESDATE >= DATEADD(DAY, -1, CAST(GETDATE() AS DATE))
          AND SALESDATE < CAST(GETDATE() AS DATE)
        GROUP BY RTRIM(Company_Code);
      `);
      const yesterdayMap = {};
      (yesterdayResult.recordset || []).forEach((row) => {
        yesterdayMap[(row.Company_Code || "").trim()] = parseFloat(row.YesterdaySales || 0);
      });

      const records = companies.map((company) => {
        const todaySales = todayMap[company.code] || 0;
        const yesterdaySales = yesterdayMap[company.code] || 0;
        const difference = todaySales - yesterdaySales;

        const salesPercentage =
          yesterdaySales === 0 ? 0 : Number(((difference / yesterdaySales) * 100).toFixed(2));

        return {
          branchCode: company.code,
          branchName: company.name || company.code,
          todaySales,
          yesterdaySales,
          difference,
          salesPercentage,
        };
      });

      records.sort((a, b) => b.todaySales - a.todaySales);

      console.log("✅ Branch Data (Today: live view -> tb_SALES fallback, Yesterday: tb_SALES):", records);

      return res.status(200).json({ success: true, data: records });
    } catch (error) {
      console.error("getBranchTodayYesterdaySales error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch branch-wise today/yesterday sales",
        error: error.message,
      });
    }
  };

  // ============================================================
  // GET - Hourly sales trend for Today and Yesterday (sparklines)
  // Today: live table first (tb_ONLINESALESMAIN); if it has no rows for today,
  // fall back to tb_SALES. Yesterday: tb_SALES. All net (SL - RF) from tb_SALES.
  // ============================================================
  const getSalesTrend = async (req, res) => {
    let pool;
    try {
      const user_ip = String(req.user.ip).trim();
      pool = await connectToUserDatabase(user_ip, req.user.port.trim());

      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      const companyCode = req.query.company ? req.query.company.trim() : null;
      const companyFilterSql = companyCode ? "AND Company_Code = @companyCode" : "";

      const newRequest = () => {
        const r = pool.request();
        if (companyCode) r.input("companyCode", mssql.VarChar, companyCode);
        return r;
      };

      // Today - live source
      const todayLiveResult = await newRequest().query(`
        USE [${posback}];
        SELECT
          DATEPART(HOUR, [Date]) AS SaleHour,
          SUM(AMOUNT) AS HourSales
        FROM tb_ONLINESALESMAIN
        WHERE [Date] >= CAST(GETDATE() AS DATE)
          AND [Date] < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
        ${companyFilterSql}
        GROUP BY DATEPART(HOUR, [Date])
        ORDER BY SaleHour ASC;
      `);
      let todayRows = todayLiveResult.recordset || [];

      // Today - fallback: already in tb_SALES
      if (todayRows.length === 0) {
        const todayFallbackResult = await newRequest().query(`
          USE [${posback}];
          SELECT
            DATEPART(HOUR, SALESDATE) AS SaleHour,
            SUM(${NET_AMOUNT}) AS HourSales
          FROM tb_SALES
          WHERE ID IN ('SL', 'RF')
            AND SALESDATE >= CAST(GETDATE() AS DATE)
            AND SALESDATE < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
          ${companyFilterSql}
          GROUP BY DATEPART(HOUR, SALESDATE)
          ORDER BY SaleHour ASC;
        `);
        todayRows = todayFallbackResult.recordset || [];
      }

      // Yesterday - tb_SALES (net)
      const yesterdayResult = await newRequest().query(`
        USE [${posback}];
        SELECT
          DATEPART(HOUR, SALESDATE) AS SaleHour,
          SUM(${NET_AMOUNT}) AS HourSales
        FROM tb_SALES
        WHERE ID IN ('SL', 'RF')
          AND SALESDATE >= DATEADD(DAY, -1, CAST(GETDATE() AS DATE))
          AND SALESDATE < CAST(GETDATE() AS DATE)
        ${companyFilterSql}
        GROUP BY DATEPART(HOUR, SALESDATE)
        ORDER BY SaleHour ASC;
      `);

      // Build 0-23 hour series, filling missing hours with 0
      const buildHourlySeries = (rows) => {
        const map = {};
        (rows || []).forEach((row) => {
          map[row.SaleHour] = parseFloat(row.HourSales || 0);
        });
        const series = [];
        for (let h = 0; h <= 23; h++) {
          series.push({ hour: h, v: map[h] || 0 });
        }
        return series;
      };

      const todayTrend = buildHourlySeries(todayRows);
      const yesterdayTrend = buildHourlySeries(yesterdayResult.recordset);

      // Today's trend stops at the current hour (no sales exist for future hours)
      const currentHour = new Date().getHours();
      const todayTrendTrimmed = todayTrend.filter((p) => p.hour <= currentHour);

      return res.status(200).json({
        success: true,
        data: {
          today: todayTrendTrimmed,
          yesterday: yesterdayTrend,
        },
      });
    } catch (error) {
      console.error("getSalesTrend error:", error);
      return res.status(500).json({ message: "Failed to fetch sales trend", error: error.message });
    }
  };

  // ============================================================
  // GET - Branch Performance: This Month vs Last Month sales, ranked (net)
  // ============================================================
  const getBranchPerformance = async (req, res) => {
    let pool;
    try {
      const user_ip = String(req.user.ip).trim();
      pool = await connectToUserDatabase(user_ip, req.user.port.trim());

      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      // tb_COMPANY holds the branch records for this tenant's database
      const query = `
        USE [${posback}];
        SELECT
          C.COMPANY_CODE,
          C.COMPANY_NAME,
          ISNULL(TM.ThisMonthSales, 0) AS ThisMonthSales,
          ISNULL(LM.LastMonthSales, 0) AS LastMonthSales,
          CASE
            WHEN ISNULL(LM.LastMonthSales, 0) = 0 THEN 0
            ELSE ROUND(
              ((ISNULL(TM.ThisMonthSales, 0) - LM.LastMonthSales) * 100.0) / LM.LastMonthSales,
              2
            )
          END AS GrowthPercentage
        FROM tb_COMPANY C

        LEFT JOIN
        (
          SELECT Company_Code, SUM(${NET_AMOUNT}) AS ThisMonthSales
          FROM tb_SALES
          WHERE ID IN ('SL', 'RF')
            AND SALESDATE >= CAST(CONVERT(VARCHAR(6), GETDATE(), 112) + '01' AS DATETIME)
            AND SALESDATE < DATEADD(MONTH, 1, CAST(CONVERT(VARCHAR(6), GETDATE(), 112) + '01' AS DATETIME))
          GROUP BY Company_Code
        ) TM ON C.COMPANY_CODE = TM.Company_Code

        LEFT JOIN
        (
          SELECT Company_Code, SUM(${NET_AMOUNT}) AS LastMonthSales
          FROM tb_SALES
          WHERE ID IN ('SL', 'RF')
            AND SALESDATE >= DATEADD(MONTH, -1, CAST(CONVERT(VARCHAR(6), GETDATE(), 112) + '01' AS DATETIME))
            AND SALESDATE < CAST(CONVERT(VARCHAR(6), GETDATE(), 112) + '01' AS DATETIME)
          GROUP BY Company_Code
        ) LM ON C.COMPANY_CODE = LM.Company_Code

        ORDER BY ISNULL(TM.ThisMonthSales, 0) DESC;
      `;

      const result = await pool.request().query(query);

      const records = (result.recordset || []).map((row, index) => ({
        branchName: (row.COMPANY_NAME || "").trim(),
        branchCode: (row.COMPANY_CODE || "").trim(),
        sales: parseFloat(row.ThisMonthSales || 0),
        growth: parseFloat(row.GrowthPercentage || 0),
        rank: index + 1,
      }));

      return res.status(200).json({ success: true, data: records });
    } catch (error) {
      console.error("getBranchPerformance error:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch branch performance", error: error.message });
    }
  };

  // ============================================================
  // GET - Top 10 Sales Products (dynamic month range, 1-12 months) - unchanged
  // ============================================================
  const getTopSalesProducts = async (req, res) => {
    let pool;
    try {
      const user_ip = String(req.user.ip).trim();
      pool = await connectToUserDatabase(user_ip, req.user.port.trim());

      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      let months = parseInt(req.query.months, 10);
      if (!months || months <= 0) months = 3;
      if (months > 12) months = 12;

      const today = new Date();
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const startDate = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());

      const request = pool.request();
      request.input("StartDate", mssql.Date, startDate);
      request.input("EndDate", mssql.Date, endDate);
      request.timeout = 60000;

      const query = `
        USE [${posback}];
        SELECT TOP (10)
          RTRIM(S.Product_Code) AS Product_Code,
          ISNULL(P.PRODUCT_NAMELONG, 'Unknown Product') AS PRODUCT_NAMELONG,
          SUM(CASE
                WHEN S.ID = 'SL' THEN S.Unit_Price * S.Qty
                WHEN S.ID = 'RF' THEN -(S.Unit_Price * S.Qty)
                ELSE 0
              END) AS NetSalesValue,
          SUM(CASE WHEN S.ID = 'SL' THEN S.Qty ELSE 0 END) AS SalesQty,
          SUM(CASE WHEN S.ID = 'RF' THEN S.Qty ELSE 0 END) AS RefundQty
        FROM tb_SALES S
        LEFT JOIN tb_PRODUCT P
          ON P.Product_Code = S.Product_Code
        WHERE S.ID IN ('SL', 'RF')
          AND S.SalesDate >= @StartDate
          AND S.SalesDate < @EndDate
        GROUP BY
          RTRIM(S.Product_Code),
          ISNULL(P.PRODUCT_NAMELONG, 'Unknown Product')
        ORDER BY
          SalesQty DESC;
      `;

      const result = await request.query(query);

      const records = (result.recordset || []).map((row) => ({
        productCode: (row.Product_Code || "").trim(),
        productName: (row.PRODUCT_NAMELONG || "Unknown Product").trim(),
        netSalesValue: parseFloat(row.NetSalesValue || 0),
        salesQty: parseInt(row.SalesQty || 0, 10),
        refundQty: parseInt(row.RefundQty || 0, 10),
      }));

      return res.status(200).json({
        success: true,
        monthsUsed: months,
        data: records,
      });
    } catch (error) {
      console.error("getTopSalesProducts error:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch top sales products", error: error.message });
    }
    // NOTE: Do NOT close the pool here - connectToUserDatabase() returns a shared
    // cached pool (keyed by ip:port); closing it breaks other concurrent requests.
  };

  return {
    getTodayYesterdaySales,
    getBranchTodayYesterdaySales,
    getSalesTrend,
    getBranchPerformance,
    getTopSalesProducts,
  };
};