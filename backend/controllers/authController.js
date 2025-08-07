const { connectToDatabase } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const mssql = require("mssql");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { sendPasswordResetEmail } = require("../utils/nodemailer");
const { promisify } = require("util");
const verifyToken = promisify(jwt.verify);
const axios = require("axios");

const posback = process.env.DB_DATABASE3;
const rtweb = process.env.DB_DATABASE2;
const posmain = process.env.DB_DATABASE1;

const dbConfig1 = {
  user: process.env.DB_USER, // Database username
  password: process.env.DB_PASSWORD, // Database password
  server: process.env.DB_SERVER, // Database server address
  database: process.env.DB_DATABASE1, // Database name
  options: {
    encrypt: false, // Disable encryption
    trustServerCertificate: true, // Trust server certificate (useful for local databases)
  },
  port: 1443, // Default MSSQL port (1433)
};

const dbConnection = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE1,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      port: 1443, // verify this port is correct for your DB server
    };

//report data, current report, company dashboard,
// department dashboard, category dashboard,
// sub category dashboard, vendor dashboard
function formatDate(dateString) {
  // Convert the input string to a Date object
  const dateObject = new Date(dateString);

  // Extract day, month, and year
  const day = String(dateObject.getDate()).padStart(2, "0"); // Ensures two digits
  const month = String(dateObject.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed, so add 1
  const year = dateObject.getFullYear();

  // Return the formatted date as 'DD/MM/YYYY'
  return `${day}/${month}/${year}`;
}

async function syncDBConnection() {
  try {
    // If your pool is already connected, you can do:
    const request = new mssql.Request();
    const query = "SELECT * FROM tb_SYNCDB_USERS"; // Assuming db is set in connection config

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      console.log("No customer data found in tb_SYNCDB_USERS.");
      return [];
    }

    return result.recordset;
  } catch (error) {
    console.error("Error fetching sync DB connection data:", error);
    return [];
  }
}

async function userItemsDetails(ReceiptDate, ReceiptNo) {
  try {
    // Create a new request object from the existing global connection or pool
    const request = new mssql.Request();

    // Query only the SELECT statement (db should be set in config)
    const result = await request.query`
      SELECT Item_Desc, ItemAmt, ItemDiscountAmt 
      FROM tb_OGFITEMSALE 
      WHERE ReceiptDate = ${ReceiptDate} 
        AND ReceiptNo = ${ReceiptNo} 
        AND UPLOAD <> 'T'
    `;

    if (result.recordset.length === 0) {
      console.log("No user items details found for given receipt.");
      return { error: "No user items details found" };
    }

    return result.recordset;
  } catch (error) {
    console.error("Error fetching user items details:", error);
    return { error: `Error fetching user items details: ${error.message}` };
  }
}

async function userPaymentDetails() {
  try {
    const request = new mssql.Request();

    const result = await request.query`
      SELECT 
        ReceiptNo, 
        MAX(ReceiptDate) AS ReceiptDate, 
        MAX(ReceiptTime) AS ReceiptTime, 
        SUM(NoOfItems) AS NoOfItems, 
        MAX(SalesCurrency) AS SalesCurrency, 
        SUM(TotalSalesAmtB4Tax) AS TotalSalesAmtB4Tax, 
        SUM(TotalSalesAmtAfterTax) AS TotalSalesAmtAfterTax, 
        SUM(SalesTaxRate) AS SalesTaxRate, 
        SUM(ServiceChargeAmt) AS ServiceChargeAmt, 
        SUM(PaymentAmt) AS PaymentAmt, 
        MAX(PaymentCurrency) AS PaymentCurrency, 
        (SELECT STUFF(
            (SELECT DISTINCT ',' + t2.PaymentMethod  
             FROM tb_OGFPAYMENT AS t2  
             WHERE t2.ReceiptNo = t1.ReceiptNo  
             FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '')
        ) AS PaymentMethod, 
        MAX(SalesType) AS SalesType
      FROM tb_OGFPAYMENT AS t1 
      WHERE UPLOAD <> 'T'
      GROUP BY ReceiptNo;
    `;

    if (result.recordset.length === 0) {
      console.log("Cannot fetch user payment details");
      return { error: "Cannot fetch user payment details" };
    }

    return result.recordset;
  } catch (error) {
    console.error("Error fetching user payment details:", error);
    return { error: `Error fetching user payment details: ${error.message}` };
  }
}

async function userDetails() {
  try {
    const request = new mssql.Request();

    const result = await request.query`
      SELECT 
        AppCode, PropertyCode, POSInterfaceCode, BatchCode, SalesTaxRate, OAUTH_TOKEN_URL, 
        ClientID, ClientSecret, API_ENDPOINT  
      FROM tb_OGFMAIN;
    `;

    if (result.recordset.length === 0) {
      console.log("Cannot fetch user details");
      return;
    }

    // Trim string fields in the results
    const trimmedUserConnectionDetails = result.recordset.map((user) => {
      const trimmedUser = {};
      for (const key in user) {
        if (typeof user[key] === "string") {
          trimmedUser[key] = user[key].trim();
        } else {
          trimmedUser[key] = user[key];
        }
      }
      return trimmedUser;
    });

    return trimmedUserConnectionDetails;
  } catch (error) {
    console.error("Error fetching user connection details:", error);
  }
}

async function getAccessToken(user) {
  try {
    const data = qs.stringify({
      client_id: user.ClientID,
      client_secret: user.ClientSecret,
      grant_type: "client_credentials",
    });

    const agent = new https.Agent({ family: 4 }); // Force IPv4

    const response = await axios.post(user.OAUTH_TOKEN_URL, data, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      httpsAgent: agent,
      timeout: 10000, // 10 seconds timeout
    });

    return response.data.access_token;
  } catch (error) {
    console.error(
      `Error fetching token from ${user.OAUTH_TOKEN_URL}:`,
      error.response ? error.response.data : error.message
    );
    return null;
  }
}

function trimObjectStrings(obj) {
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(trimObjectStrings);
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : trimObjectStrings(value),
    ])
  );
}

async function updateTables() {
  const transaction = new mssql.Transaction();
  try {
    await transaction.begin();

    const request = new mssql.Request(transaction);

    const updatePayment = await request.query(`
      UPDATE tb_OGFPAYMENT
      SET UPLOAD = 'T'
      WHERE UPLOAD <> 'T' OR UPLOAD IS NULL;
    `);

    const updateItems = await request.query(`
      UPDATE tb_OGFITEMSALE
      SET UPLOAD = 'T'
      WHERE UPLOAD <> 'T' OR UPLOAD IS NULL;
    `);

    await transaction.commit();

    const paymentRows = updatePayment.rowsAffected[0];
    const itemsRows = updateItems.rowsAffected[0];

    if (paymentRows === 0 && itemsRows === 0) {
      return {
        message: "No rows were updated in tb_OGFPAYMENT or tb_OGFITEMSALE",
        paymentRowsAffected: paymentRows,
        itemsRowsAffected: itemsRows,
      };
    }

    return {
      message: "Tables updated successfully",
      paymentRowsAffected: paymentRows,
      itemsRowsAffected: itemsRows,
    };
  } catch (error) {
    await transaction.rollback();
    return {
      message: "Could not update tables",
      error: error.message,
    };
  }
}

async function syncDB() {
  try {
    await mssql.close();
    await mssql.connect(dbConfig1);

    const dbConnectionData = await syncDBConnection();

    if (!dbConnectionData || dbConnectionData.length === 0) {
      return { responses: [], errors: ["No customer data found."] };
    }

    const apiResponses = [];
    const errors = [];

    for (const customer of dbConnectionData) {
      const syncdbIp = customer.IP ? customer.IP.trim() : null;
      const syncdbPort = customer.PORT ? parseInt(customer.PORT.trim()) : null;

      if (!syncdbIp) {
        const errMsg = "IP is null for a customer entry";
        console.log(errMsg);
        errors.push(errMsg);
        continue;
      }
      if (!syncdbPort) {
        const errMsg = `Port is null or invalid for IP: ${syncdbIp}`;
        console.log(errMsg);
        errors.push(errMsg);
        continue;
      }

      try {
        await mssql.close();

        const syncdbConfig = {
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          server: syncdbIp,
          database: process.env.DB_DATABASE2,
          options: {
            encrypt: false,
            trustServerCertificate: true,
          },
          port: syncdbPort,
        };

        await mssql.connect(syncdbConfig);
        console.log(
          `Successfully connected to sync database at ${syncdbIp}:${syncdbPort}`
        );

        const users = await userDetails();
        if (!users || users.length === 0) {
          const msg = `No users found for IP: ${syncdbIp}`;
          console.log(msg);
          errors.push(msg);
          continue;
        }

        const payments = await userPaymentDetails();
        if (payments.error) {
          errors.push(payments.error);
          continue;
        }

        // Create HTTPS agent for API calls
        const agent = new https.Agent({ family: 4 });

        for (const user of users) {
          const {
            SalesTaxRate,
            OAUTH_TOKEN_URL,
            API_ENDPOINT,
            ...filteredUser
          } = user;

          const userResult = {
            AppCode: filteredUser.AppCode,
            PropertyCode: filteredUser.PropertyCode,
            ClientID: filteredUser.ClientID,
            ClientSecret: filteredUser.ClientSecret,
            POSInterfaceCode: filteredUser.POSInterfaceCode,
            BatchCode: filteredUser.BatchCode,
            PosSales: [],
          };

          for (const payment of payments) {
            const { IDX, UPLOAD, Insert_Time, ...filteredPayment } = payment;

            const formattedDate = new Date(payment.ReceiptDate)
              .toLocaleDateString("en-GB")
              .replace(/\//g, "/");

            const formattedTime = new Date(
              payment.ReceiptTime
            ).toLocaleTimeString("en-GB", { hour12: false });

            const newPaymentDetails = {
              PropertyCode: filteredUser.PropertyCode,
              POSInterfaceCode: filteredUser.POSInterfaceCode,
              ...filteredPayment,
              ReceiptDate: formattedDate,
              ReceiptTime: formattedTime,
            };

            const items = await userItemsDetails(
              payment.ReceiptDate,
              payment.ReceiptNo
            );
            if (items.error) {
              errors.push(items.error);
            }

            const paymentWithItems = {
              ...newPaymentDetails,
              Items: items,
            };

            userResult.PosSales.push(trimObjectStrings(paymentWithItems));
          }

          const token = await getAccessToken(user);
          if (!token) {
            const errorMsg = `Skipping API call for user ${user.AppCode} due to token error.`;
            console.error(errorMsg);
            errors.push(errorMsg);
            continue; // skip this user, move on to next
          }

          const requestBody = JSON.stringify(
            trimObjectStrings(userResult),
            null,
            2
          );

          try {
            const response = await axios.post(user.API_ENDPOINT, requestBody, {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              httpsAgent: agent,
              transformRequest: [(data) => data],
              timeout: 10000,
            });

            console.log(
              `API Call Successful for user ${user.AppCode}:`,
              response.data
            );
            apiResponses.push(response.data);
          } catch (error) {
            const errorMessage = `API Call Failed for user ${user.AppCode}: ${
              error.response?.data || error.message
            }`;
            console.error(errorMessage);
            errors.push(errorMessage);
            apiResponses.push({ error: errorMessage });
          }
        }

        await mssql.close(); // close connection after finishing this customer
      } catch (err) {
        const errMsg = `Database Connection Error for IP ${syncdbIp}: ${err.message}`;
        console.error(errMsg);
        errors.push(errMsg);
      }
    }

    return { responses: apiResponses, errors };
  } catch (error) {
    console.error("Unexpected error occurred in syncDB:", error);
    return { responses: [], errors: [error.message] };
  }
}

function currentDateTime() {
  const now = new Date();
  const trDate = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  );
  const trTime = new Date(
    Date.UTC(
      1900,
      0,
      1,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    )
  );

  return { trDate, trTime };
}

//login
exports.login = async (req, res) => {
  let pool;
  try {
    pool = await connectToDatabase();

    const { username, password, ip } = req.body;
    const date = moment().format("YYYY-MM-DD HH:mm:ss");

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    // Get user info
    const userResult = await pool
      .request()
      .input("username", mssql.VarChar, username)
      .query(
        `USE [${posmain}]; 
        SELECT * FROM tb_USERS WHERE username = @username`
      );

    if (userResult.recordset.length === 0) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const user = userResult.recordset[0];
    const { port, ip_address, CUSTOMERID, password: hashedPassword } = user;

    if (
      !port ||
      !ip_address ||
      port.trim() === "" ||
      ip_address.trim() === "" ||
      ip_address.trim() === null ||
      ip_address.trim() === undefined ||
      port.trim() === null ||
      port.trim() === undefined
    ) {
      return res.status(400).json({
        message:
          "Connection hasn't been established yet! Please contact system support team.",
      });
    }

    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // Insert login log
    try {
      await pool
        .request()
        .input("username", mssql.VarChar, username)
        .input("ip", mssql.VarChar, ip)
        .input("datetime", mssql.VarChar, date).query(`
          USE [${posmain}];
          INSERT INTO tb_LOG (username, ip, datetime)
          VALUES (@username, @ip, @datetime)
        `);
    } catch (logErr) {
      console.error("Failed to insert login log:", logErr);
    }

    // Close old connection
    await mssql.close();

    // Connect to dynamic DB
    const dynamicDbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: ip_address.trim(),
      database: process.env.DB_DATABASE2,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      port: parseInt(port.trim()),
      connectionTimeout: 5000, // << timeout in ms
      requestTimeout: 5000,
    };

    const dynamicPool = await mssql.connect(dynamicDbConfig);

    const companyResult = await dynamicPool
      .request()
      .input("CUSTOMER_ID", mssql.Int, CUSTOMERID)
      .query(
        `USE [${rtweb}]; SELECT * FROM tb_COMPANY WHERE CUSTOMERID = @CUSTOMER_ID`
      );

    if (companyResult.recordset.length === 0) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    // Generate token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        a_permission: user.a_permission,
        a_sync: user.a_sync,
        d_company: user.d_company,
        d_department: user.d_department,
        d_category: user.d_category,
        d_scategory: user.d_scategory,
        d_vendor: user.d_vendor,
        d_invoice: user.d_invoice,
        d_productView: user.d_productView,
        t_scan: user.t_scan,
        t_stock: user.t_stock,
        t_grn: user.t_grn,
        t_prn: user.t_prn,
        t_tog: user.t_tog,
        t_stock_update: user.t_stock_update,
        c_st_product_wise: user.c_st_product_wise,
        c_st_department: user.c_st_department,
        c_st_category: user.c_st_category,
        c_st_scategory: user.c_st_scategory,
        c_st_vendor: user.c_st_vendor,
        c_sa_product_wise: user.c_sa_product_wise,
        c_sa_department: user.c_sa_department,
        c_sa_category: user.c_sa_category,
        c_sa_scategory: user.c_sa_scategory,
        c_sa_vendor: user.c_sa_vendor,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Failed to log in" });
    }
  } finally {
    // Ensure connection is closed in case of error
    if (mssql.connected) await mssql.close();
  }
};

//register
exports.register = async (req, res) => {
  let pool;
  try {
    pool = await connectToDatabase();

    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check for existing user
    const checkUserResult = await pool
      .request()
      .input("username", mssql.VarChar, username)
      .input("email", mssql.VarChar, email).query(`
        USE [${posmain}];
        SELECT * FROM tb_USERS WHERE username = @username OR email = @email
      `);

    if (checkUserResult.recordset.length > 0) {
      const existingUser = checkUserResult.recordset[0];
      if (existingUser.username === username) {
        return res.status(400).json({ message: "Username already exists" });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ message: "Email already exists" });
      }
    }

    // Hash password and insert new user
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool
      .request()
      .input("username", mssql.VarChar, username)
      .input("email", mssql.VarChar, email)
      .input("password", mssql.VarChar, hashedPassword).query(`
        USE [${posmain}];
        INSERT INTO tb_USERS (username, email, password, resetToken, resetTokenExpiry, ip_address, port, CUSTOMERID, a_permission,
        a_sync, d_company, d_department, d_category, d_scategory, d_vendor, d_invoice, d_productView, t_scan, t_stock, t_grn, t_prn, t_tog, t_stock_update)
        VALUES (@username, @email, @password, '', '', '', '', NULL, 'F', 'F', 'F', 'F','F', 'F','F', 'F','F', 'F','F', 'F','F', 'F', 'F')
      `);

    return res.status(201).json({ message: "User added successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Failed to register user" });
    }
  } finally {
    if (mssql.connected) await mssql.close();
  }
};

//reset password
exports.resetPassword = async (req, res) => {
  let pool;

  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ message: "Token and new password are required" });
  }

  try {
    pool = await connectToDatabase();

    // Find user by reset token
    const result = await pool.request().input("token", mssql.VarChar, token)
      .query(`
        USE [${posmain}];
        SELECT * FROM tb_USERS WHERE resetToken = @token
      `);

    if (result.recordset.length === 0) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = result.recordset[0];

    if (Date.now() > user.resetTokenExpiry) {
      return res.status(400).json({ message: "Reset token has expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token fields
    await pool
      .request()
      .input("hashedPassword", mssql.VarChar, hashedPassword)
      .input("token", mssql.VarChar, token).query(`
        USE [${posmain}];
        UPDATE tb_USERS
        SET password = @hashedPassword, resetToken = NULL, resetTokenExpiry = NULL
        WHERE resetToken = @token
      `);

    return res
      .status(200)
      .json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Failed to reset password" });
    }
  } finally {
    if (mssql.connected) await mssql.close();
  }
};

//forgot password
exports.forgotPassword = async (req, res) => {
  let pool;
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  try {
    pool = await connectToDatabase();

    // Check if user exists
    const result = await pool
      .request()
      .input("username", mssql.VarChar, username).query(`
        USE [${posmain}];
        SELECT * FROM tb_USERS WHERE username = @username
      `);

    if (result.recordset.length === 0) {
      return res
        .status(400)
        .json({ message: "No user found with this username" });
    }

    const user = result.recordset[0];
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour expiry

    // Update user with reset token and expiry
    await pool
      .request()
      .input("resetToken", mssql.VarChar, resetToken)
      .input("resetTokenExpiry", mssql.BigInt, resetTokenExpiry)
      .input("username", mssql.VarChar, username).query(`
        USE [${posmain}];
        UPDATE tb_USERS
        SET resetToken = @resetToken, resetTokenExpiry = @resetTokenExpiry
        WHERE username = @username
      `);

    // Send email with token
    await sendPasswordResetEmail(user.email, resetToken);

    return res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ message: "Failed to send password reset email" });
    }
  } finally {
    if (mssql.connected) await mssql.close();
  }
};

//log out
exports.closeConnection = async (req, res) => {
  try {
    if (mssql.connected) {
      await mssql.close();
    }

    res.status(200).json({ message: "Connection Closed successfully" });
  } catch (err) {
    console.error("Error during connection closing:", err);
    res.status(500).json({ message: "Failed to close the connection" });
  }
};

//temp sales table
exports.updateTempSalesTable = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    const username = decoded.username;

    const {
      company,
      count,
      type,
      productCode,
      productName,
      costPrice,
      scalePrice,
      stock,
      quantity,
      colorWiseTableData,
    } = req.body;

    const { trDate, trTime } = currentDateTime();
    const pool = await connectToDatabase();
    // Switch DB manually using a USE statement

    await mssql.query(`USE [${rtweb}];`);

    let result;

    if (colorWiseTableData.length > 0) {
      for (let i = 0; i < colorWiseTableData.length; i++) {
        const row = colorWiseTableData[i];

        const [productCodeRaw, colorRaw, sizeRaw, quantityRaw] = row;
        const serialNo = productCodeRaw.trim();
        const color = colorRaw.trim();
        const size = sizeRaw.trim();
        const rowQty = parseFloat(quantityRaw.trim());

        const insertRequest = pool.request();
        insertRequest.input("company", mssql.NChar(10), company);
        insertRequest.input("count", mssql.NChar(10), count);
        insertRequest.input("type", mssql.NChar(10), type);
        insertRequest.input("productCode", mssql.NChar(30), productCode);
        insertRequest.input("productName", mssql.NChar(50), productName);
        insertRequest.input("costPrice", mssql.Money, costPrice);
        insertRequest.input("scalePrice", mssql.Money, scalePrice);
        insertRequest.input("stock", mssql.Float, stock);
        insertRequest.input("quantity", mssql.Float, rowQty);
        insertRequest.input("username", mssql.NChar(50), username);
        insertRequest.input("trDate", mssql.DateTime, trDate);
        insertRequest.input("trTime", mssql.DateTime, trTime);
        insertRequest.input("serialNo", mssql.NVarChar(500), serialNo);
        insertRequest.input("color", mssql.Char(10), color);
        insertRequest.input("size", mssql.Char(10), size);

        result = await insertRequest.query(`
          INSERT INTO tb_STOCKRECONCILATION_DATAENTRYTEMP 
          (COMPANY_CODE, COUNT_STATUS, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, 
           CUR_STOCK, PHY_STOCK, REPUSER, TRDATE, TRTIME, SERIALNO, COLORCODE, SIZECODE)
          VALUES (@company, @count, @type, @productCode, @productName, @costPrice, @scalePrice, 
                  @stock, @quantity, @username , @trDate, @trTime, @serialNo, @color, @size)
        `);
      }
    } else {
      const insertRequest = pool.request();
      insertRequest.input("company", mssql.NChar(10), company);
      insertRequest.input("count", mssql.NChar(10), count);
      insertRequest.input("type", mssql.NChar(10), type);
      insertRequest.input("productCode", mssql.NChar(30), productCode);
      insertRequest.input("productName", mssql.NChar(50), productName);
      insertRequest.input("costPrice", mssql.Money, costPrice);
      insertRequest.input("scalePrice", mssql.Money, scalePrice);
      insertRequest.input("stock", mssql.Float, stock);
      insertRequest.input("quantity", mssql.Float, quantity);
      insertRequest.input("username", mssql.NChar(50), username);
      insertRequest.input("trDate", mssql.DateTime, trDate);
      insertRequest.input("trTime", mssql.DateTime, trTime);

      result = await insertRequest.query(`
        INSERT INTO tb_STOCKRECONCILATION_DATAENTRYTEMP 
        (COMPANY_CODE, COUNT_STATUS, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, 
         CUR_STOCK, PHY_STOCK, REPUSER, TRDATE, TRTIME)
        VALUES (@company, @count, @type, @productCode, @productName, @costPrice, @scalePrice, 
                @stock, @quantity, @username , @trDate, @trTime)
      `);
    }

    if (result?.rowsAffected?.[0] > 0) {
      return res.status(201).json({ message: "Table Updated successfully" });
    } else {
      return res.status(500).json({ message: "Table Update Failed" });
    }
  } catch (error) {
    console.error("Error updating sales temp table:", error);
    res.status(500).json({ message: "Failed to update table" });
  }
};

//temp grn table
exports.updateTempGrnTable = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    const username = decoded.username;

    const {
      company,
      type,
      productCode,
      productName,
      costPrice,
      scalePrice,
      stock,
      quantity,
      vendor_code,
      vendor_name,
      invoice_no,
      colorWiseTableData,
    } = req.body;

    const invoice_number = String(invoice_no);

    const { trDate, trTime } = currentDateTime();

    let result;
    if (colorWiseTableData.length > 0) {
      let insertQuery;
      for (let i = 0; i < colorWiseTableData.length; i++) {
        const row = colorWiseTableData[i];

        // Destructure and clean up values
        const [productCodeRaw, colorRaw, sizeRaw, quantityRaw] = row;
        const serialNo = productCodeRaw.trim();
        const color = colorRaw.trim();
        const size = sizeRaw.trim();
        const quantity = quantityRaw.trim();

        if (type === "GRN") {
          insertQuery = `
        USE [${rtweb}];
        INSERT INTO tb_GRN_TEMP 
        (COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, 
        UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER, TRDATE, TRTIME, SERIALNO, COLORCODE, SIZECODE)
        VALUES (@company, @vendor_code, @vendor_name, @invoice_number, @type, @productCode, @productName, @costPrice, 
        @scalePrice, @stock, @quantity, @username, @trDate, @trTime, @serialNo, @color, @size)
      `;
        } else if (type === "PRN") {
          insertQuery = `
        USE [${rtweb}];
        INSERT INTO tb_PRN_TEMP 
        (COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
         COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER,TRDATE, TRTIME, SERIALNO, COLORCODE, SIZECODE)
        VALUES (@company, @vendor_code, @vendor_name, @invoice_number, @type, @productCode, @productName,
         @costPrice, @scalePrice, @stock, @quantity, @username, @trDate, @trTime, @serialNo, @color, @size)
      `;
        } else {
          return res
            .status(400)
            .json({ message: "Invalid type. Must be GRN or PRN." });
        }

        const insertRequest = new mssql.Request();
        insertRequest.input("company", mssql.NChar(10), company);
        insertRequest.input("vendor_code", mssql.NChar(10), vendor_code);
        insertRequest.input("vendor_name", mssql.NChar(50), vendor_name);
        insertRequest.input("invoice_number", mssql.NChar(10), invoice_number);
        insertRequest.input("type", mssql.NChar(10), type);
        insertRequest.input("productCode", mssql.NChar(30), productCode);
        insertRequest.input("productName", mssql.NChar(50), productName);
        insertRequest.input("costPrice", mssql.Money, costPrice);
        insertRequest.input("scalePrice", mssql.Money, scalePrice);
        insertRequest.input("stock", mssql.Float, stock);
        insertRequest.input("quantity", mssql.Float, quantity);
        insertRequest.input("username", mssql.NVarChar(50), username);
        insertRequest.input("trDate", mssql.DateTime, trDate);
        insertRequest.input("trTime", mssql.DateTime, trTime);
        insertRequest.input("serialNo", mssql.NVarChar(500), serialNo);
        insertRequest.input("color", mssql.Char(10), color);
        insertRequest.input("size", mssql.Char(10), size);

        result = await insertRequest.query(insertQuery);
      }
    } else {
      if (type === "GRN") {
        insertQuery = `
        USE [${rtweb}];
        INSERT INTO tb_GRN_TEMP 
        (COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER, TRDATE, TRTIME)
        VALUES (@company, @vendor_code, @vendor_name, @invoice_number, @type, @productCode, @productName, @costPrice, @scalePrice, @stock, @quantity, @username, @trDate, @trTime)
      `;
      } else if (type === "PRN") {
        insertQuery = `
        USE [${rtweb}];
        INSERT INTO tb_PRN_TEMP 
        (COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER,TRDATE, TRTIME)
        VALUES (@company, @vendor_code, @vendor_name, @invoice_number, @type, @productCode, @productName, @costPrice, @scalePrice, @stock, @quantity, @username, @trDate, @trTime)
      `;
      } else {
        return res
          .status(400)
          .json({ message: "Invalid type. Must be GRN or PRN." });
      }

      const insertRequest = new mssql.Request();
      insertRequest.input("company", mssql.NChar(10), company);
      insertRequest.input("vendor_code", mssql.NChar(10), vendor_code);
      insertRequest.input("vendor_name", mssql.NChar(50), vendor_name);
      insertRequest.input("invoice_number", mssql.NChar(10), invoice_number);
      insertRequest.input("type", mssql.NChar(10), type);
      insertRequest.input("productCode", mssql.NChar(30), productCode);
      insertRequest.input("productName", mssql.NChar(50), productName);
      insertRequest.input("costPrice", mssql.Money, costPrice);
      insertRequest.input("scalePrice", mssql.Money, scalePrice);
      insertRequest.input("stock", mssql.Float, stock);
      insertRequest.input("quantity", mssql.Float, quantity);
      insertRequest.input("username", mssql.NVarChar(50), username);
      insertRequest.input("trDate", mssql.DateTime, trDate);
      insertRequest.input("trTime", mssql.DateTime, trTime);

      result = await insertRequest.query(insertQuery);
    }

    if (result.rowsAffected[0] > 0) {
      return res.status(201).json({ message: "Table Updated successfully" });
    } else {
      return res.status(500).json({ message: "Table Update Failed" });
    }
  } catch (error) {
    console.error("Error processing GRN table insert:", error);
    res.status(500).json({ message: "Failed to update table" });
  }
};

//temp tog table
exports.updateTempTogTable = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    const username = decoded.username;

    const {
      company,
      companyCodeTo,
      type,
      productCode,
      productName,
      costPrice,
      scalePrice,
      stock,
      quantity,
      colorWiseTableData,
    } = req.body;

    const { trDate, trTime } = currentDateTime();

    const pool = await connectToDatabase();
    // ✅ Switch database explicitly
    await mssql.query(`USE [${rtweb}];`);

    let result;

    if (colorWiseTableData.length > 0) {
      for (let i = 0; i < colorWiseTableData.length; i++) {
        const row = colorWiseTableData[i];
        const [productCodeRaw, colorRaw, sizeRaw, quantityRaw] = row;
        const serialNo = productCodeRaw.trim();
        const color = colorRaw.trim();
        const size = sizeRaw.trim();
        const rowQty = parseFloat(quantityRaw.trim());

        const insertRequest = pool.request();
        insertRequest.input("company", mssql.NChar(10), company);
        insertRequest.input("companyCodeTo", mssql.NChar(10), companyCodeTo);
        insertRequest.input("type", mssql.NChar(10), type);
        insertRequest.input("productCode", mssql.NChar(30), productCode);
        insertRequest.input("productName", mssql.NChar(50), productName);
        insertRequest.input("costPrice", mssql.Money, costPrice);
        insertRequest.input("scalePrice", mssql.Money, scalePrice);
        insertRequest.input("stock", mssql.Float, stock);
        insertRequest.input("quantity", mssql.Float, rowQty);
        insertRequest.input("username", mssql.NVarChar(50), username);
        insertRequest.input("trDate", mssql.DateTime, trDate);
        insertRequest.input("trTime", mssql.DateTime, trTime);
        insertRequest.input("serialNo", mssql.NVarChar(500), serialNo);
        insertRequest.input("color", mssql.Char(10), color);
        insertRequest.input("size", mssql.Char(10), size);

        result = await insertRequest.query(`
          INSERT INTO tb_TOG_TEMP 
          (COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, 
           CUR_STOCK, PHY_STOCK, REPUSER, TRDATE, TRTIME, SERIALNO, COLORCODE, SIZECODE)
          VALUES (@company, @companyCodeTo, @type, @productCode, @productName, @costPrice, @scalePrice, 
                  @stock, @quantity, @username, @trDate, @trTime, @serialNo, @color, @size)
        `);
      }
    } else {
      const insertRequest = pool.request();
      insertRequest.input("company", mssql.NChar(10), company);
      insertRequest.input("companyCodeTo", mssql.NChar(10), companyCodeTo);
      insertRequest.input("type", mssql.NChar(10), type);
      insertRequest.input("productCode", mssql.NChar(30), productCode);
      insertRequest.input("productName", mssql.NChar(50), productName);
      insertRequest.input("costPrice", mssql.Money, costPrice);
      insertRequest.input("scalePrice", mssql.Money, scalePrice);
      insertRequest.input("stock", mssql.Float, stock);
      insertRequest.input("quantity", mssql.Float, quantity);
      insertRequest.input("username", mssql.NVarChar(50), username);
      insertRequest.input("trDate", mssql.DateTime, trDate);
      insertRequest.input("trTime", mssql.DateTime, trTime);

      result = await insertRequest.query(`
        INSERT INTO tb_TOG_TEMP 
        (COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, 
         CUR_STOCK, PHY_STOCK, REPUSER, TRDATE, TRTIME)
        VALUES (@company, @companyCodeTo, @type, @productCode, @productName, @costPrice, @scalePrice, 
                @stock, @quantity, @username, @trDate, @trTime)
      `);
    }

    if (result?.rowsAffected?.[0] > 0) {
      return res.status(201).json({ message: "Table Updated successfully" });
    } else {
      return res.status(500).json({ message: "Table Update Failed" });
    }
  } catch (error) {
    console.error("Error processing TOG insert:", error);
    res.status(500).json({ message: "Failed to update table" });
  }
};

//stock update delete
exports.stockUpdateDelete = async (req, res) => {
  const idx = parseInt(req.query.idx, 10);
  const username = req.query.username;
  const selectedType = req.query.selectedType;

  if (isNaN(idx) || !username || !selectedType) {
    return res.status(400).json({
      message: "Invalid or missing 'idx' or 'username' or 'type' parameter",
    });
  }

  const transaction = new mssql.Transaction();

  try {
    await transaction.begin();

    const backupRequest = new mssql.Request(transaction);
    await backupRequest
      .input("DELETED_USER", mssql.NVarChar(50), username)
      .input("idx", mssql.Int, idx).query(`
        INSERT INTO tb_STOCKRECONCILATION_DATAENTRYTEMP_BACKUP (
          COMPANY_CODE, COUNT_STATUS, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
          COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, TRDATE, TRTIME, REPUSER, DELETED_USER, SERIALNO,COLORCODE, SIZECODE
        )
        SELECT 
          COMPANY_CODE, COUNT_STATUS, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
          COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, TRDATE, TRTIME, REPUSER, @DELETED_USER, SERIALNO,COLORCODE, SIZECODE
        FROM tb_STOCKRECONCILATION_DATAENTRYTEMP
        WHERE IDX = @idx
      `);

    const deleteRequest = new mssql.Request(transaction);
    const deleteResult = await deleteRequest
      .input("idx", mssql.Int, idx)
      .query(
        `DELETE FROM tb_STOCKRECONCILATION_DATAENTRYTEMP WHERE IDX = @idx`
      );

    if (deleteResult.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Stock data not found" });
    }

    await transaction.commit();
    res.status(200).json({ message: "Data deleted successfully" });
  } catch (error) {
    if (transaction._aborted === false) {
      await transaction.rollback();
    }
    console.error("Error deleting stock data:", error);
    res
      .status(500)
      .json({ message: "Failed to delete stock data", error: error.message });
  }
};

//grnprn delete
exports.grnprnDelete = async (req, res) => {
  try {
    const idx = parseInt(req.query.idx, 10);
    const username = req.query.username;
    const type = req.query.selectedType;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    if (!idx || isNaN(parseInt(idx, 10))) {
      return res
        .status(400)
        .json({ message: "Invalid or missing 'idx' parameter" });
    }

    const tableMap = {
      GRN: "tb_GRN_TEMP",
      PRN: "tb_PRN_TEMP",
      TOG: "tb_TOG_TEMP",
    };

    const backupTableMap = {
      GRN: "tb_GRN_TEMP_BACKUP",
      PRN: "tb_PRN_TEMP_BACKUP",
      TOG: "tb_TOG_TEMP_BACKUP",
    };

    const tableName = tableMap[type];
    const backupTableName = backupTableMap[type];

    if (!tableName || !backupTableName) {
      return res.status(400).json({ message: "Invalid 'type' parameter" });
    }

    const request = new mssql.Request();
    request.input("idx", mssql.Int, parseInt(idx, 10));
    request.input("username", mssql.NVarChar(50), username);

    let deleteBackup;

    if (type !== "TOG") {
      deleteBackup = await request.query(`
    INSERT INTO dbo.${backupTableName} (
      COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE,
      PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK,
      PHY_STOCK, REMARKS, REPUSER, DELETED_USER, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE
    )
    SELECT 
      COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE,
      PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK,
      PHY_STOCK, REMARKS, REPUSER, @username, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE
    FROM dbo.${tableName}
    WHERE IDX = @idx
  `);
    } else {
      deleteBackup = await request.query(`
    INSERT INTO dbo.${backupTableName} (
      COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
      COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER, DELETED_USER, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE
    )
    SELECT 
      COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
      COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER, @username, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE
    FROM dbo.${tableName}
    WHERE IDX = @idx
  `);
    }

    if (deleteBackup.rowsAffected[0] === 0) {
      return res
        .status(400)
        .json({ message: "Couldn't back up records before delete." });
    }

    const deleteResult = await request.query(`
  DELETE FROM dbo.${tableName} WHERE IDX = @idx
`);

    if (deleteResult.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Data not found" });
    }

    return res.status(200).json({ message: "Data deleted successfully" });
  } catch (error) {
    console.error("Error deleting data:", error);
    res.status(500).json({ message: "Failed to delete data" });
  }
};

// stock update final
exports.finalStockUpdate = async (req, res) => {
  const { username, company } = req.query;
  const rtweb = req.rtweb; // ensure this is set based on login context

  if (!username || !company) {
    return res.status(400).json({
      success: false,
      message: "Missing 'username' or 'company' parameter",
    });
  }

  let transaction;

  try {
    const pool = await mssql.connect();

    // Use the correct DB first
    if (rtweb) await pool.request().query(`USE [${rtweb}];`);

    transaction = new mssql.Transaction(pool);
    await transaction.begin();

    const selectResult = await new mssql.Request(transaction).input(
      "COMPANY_CODE",
      mssql.NChar(10),
      company
    ).query(`
        SELECT * FROM tb_STOCKRECONCILATION_DATAENTRYTEMP
        WHERE COMPANY_CODE = @COMPANY_CODE
      `);

    const dataRows = selectResult.recordset;

    if (dataRows.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        message: "No data found for the selected company",
      });
    }

    let insertCount = 0;

    const insertQuery = `
      INSERT INTO tb_STOCKRECONCILATION_DATAENTRY (
        COMPANY_CODE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE,
        CUR_STOCK, PHY_STOCK, TYPE, COUNT_STATUS, REPUSER, TRDATE, TRTIME, SERIALNO, COLORCODE, SIZECODE
      )
      VALUES (
        @COMPANY_CODE, @PRODUCT_CODE, @PRODUCT_NAMELONG, @COSTPRICE, @UNITPRICE,
        @CUR_STOCK, @PHY_STOCK, @TYPE, @COUNT_STATUS, @REPUSER, @trDate, @trTime, @serialNo, @color, @size
      )
    `;

    for (const row of dataRows) {
      await new mssql.Request(transaction)
        .input("COMPANY_CODE", mssql.NChar(10), row.COMPANY_CODE)
        .input("PRODUCT_CODE", mssql.NChar(30), row.PRODUCT_CODE)
        .input("PRODUCT_NAMELONG", mssql.NVarChar(50), row.PRODUCT_NAMELONG)
        .input("COSTPRICE", mssql.Money, row.COSTPRICE)
        .input("UNITPRICE", mssql.Money, row.UNITPRICE)
        .input("CUR_STOCK", mssql.Float, row.CUR_STOCK)
        .input("PHY_STOCK", mssql.Float, row.PHY_STOCK)
        .input("TYPE", mssql.NChar(10), row.TYPE)
        .input("COUNT_STATUS", mssql.NChar(10), row.COUNT_STATUS)
        .input("REPUSER", mssql.NVarChar(50), row.REPUSER)
        .input("trDate", mssql.DateTime, row.TRDATE)
        .input("trTime", mssql.DateTime, row.TRTIME)
        .input("serialNo", mssql.NVarChar(500), row.SERIALNO?.trim() || "")
        .input("color", mssql.Char(10), row.COLORCODE?.trim() || "")
        .input("size", mssql.Char(10), row.SIZECODE?.trim() || "")
        .query(insertQuery);

      insertCount++;
    }

    const deleteBackup = await new mssql.Request(transaction)
      .input("APPROVED_USER", mssql.NVarChar(50), username)
      .input("COMPANY_CODE", mssql.NChar(10), company).query(`
        INSERT INTO tb_STOCKRECONCILATION_DATAENTRYTEMP_BACKUP (
          COMPANY_CODE, COUNT_STATUS, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
          COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, TRDATE, TRTIME, REPUSER, APPROVED_USER, SERIALNO, COLORCODE, SIZECODE
        )
        SELECT 
          COMPANY_CODE, COUNT_STATUS, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
          COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, TRDATE, TRTIME, REPUSER, @APPROVED_USER, SERIALNO, COLORCODE, SIZECODE
        FROM tb_STOCKRECONCILATION_DATAENTRYTEMP
        WHERE COMPANY_CODE = @COMPANY_CODE
      `);

    if (deleteBackup.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Couldn't back up records before delete.",
      });
    }

    const deleteResult = await new mssql.Request(transaction).input(
      "COMPANY_CODE",
      mssql.NChar(10),
      company
    ).query(`
        DELETE FROM tb_STOCKRECONCILATION_DATAENTRYTEMP
        WHERE COMPANY_CODE = @COMPANY_CODE
      `);

    if (deleteResult.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Insert and backup succeeded but nothing was deleted.",
      });
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Data moved successfully",
      inserted: insertCount,
    });
  } catch (error) {
    console.error("❌ Error in finalStockUpdate:", error.message);
    if (transaction && !transaction._aborted) {
      await transaction.rollback();
    }
    return res.status(500).json({
      success: false,
      message: "Unexpected error occurred during the process.",
      error: error.message,
    });
  }
};

// GRN/PRN/TOG update final
exports.finalGrnPrnUpdate = async (req, res) => {
  const { username, company, type, invoice, remarks = "" } = req.query;

  if (!username || !company || !type || (type !== "TOG" && !invoice)) {
    return res.status(400).json({
      success: false,
      message: "Missing required parameters",
    });
  }

  const tempTables = {
    GRN: "tb_GRN_TEMP",
    PRN: "tb_PRN_TEMP",
    TOG: "tb_TOG_TEMP",
  };

  const finalTables = {
    GRN: "tb_GRN",
    PRN: "tb_PRN",
    TOG: "tb_TOG",
  };

  const backupTables = {
    GRN: "tb_GRN_TEMP_BACKUP",
    PRN: "tb_PRN_TEMP_BACKUP",
    TOG: "tb_TOG_TEMP_BACKUP",
  };

  if (!tempTables[type]) {
    return res.status(400).json({ success: false, message: "Invalid type" });
  }

  let transaction;
  try {
    transaction = new mssql.Transaction();
    await transaction.begin();

    const request = new mssql.Request(transaction);

    // Step 2: Retrieve temp data

    let selectResult;
    if (type === "TOG") {
      request.input("COMPANY_CODE", mssql.NChar(10), company.trim());

      selectResult = await request.query(`
      USE [${rtweb}];
      SELECT * FROM ${tempTables[type]} 
      WHERE COMPANY_CODE = @COMPANY_CODE
    `);
    } else {
      request.input("COMPANY_CODE", mssql.NChar(10), company.trim());
      request.input("INVOICE_NO", mssql.NChar(50), invoice.trim());

      selectResult = await request.query(`
      USE [${rtweb}];
      SELECT * FROM ${tempTables[type]} 
      WHERE COMPANY_CODE = @COMPANY_CODE AND INVOICE_NO = @INVOICE_NO
    `);
    }

    const records = selectResult.recordset;
    if (records.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "No data found in temp table" });
    }

    // Step 3: Fetch or insert document row
    const docRequest = new mssql.Request(transaction);
    docRequest.input("COMPANY_CODE", mssql.NChar(10), company.trim());

    let documentResult = await docRequest.query(`
      SELECT * FROM [RT_WEB].dbo.tb_DOCUMENT WHERE COMPANY_CODE = @COMPANY_CODE
    `);

    let grn = "00",
      prn = "00",
      tog = "00";

    if (documentResult.recordset.length === 0) {
      const insertDocReq = new mssql.Request(transaction);
      insertDocReq
        .input("COMPANY_CODE", mssql.NChar(10), company.trim())
        .input("GRN", mssql.NVarChar(2), "00")
        .input("PRN", mssql.NVarChar(2), "00")
        .input("TOG", mssql.NVarChar(2), "00")
        .input("REPUSER", mssql.NVarChar(50), username.trim());

      const insertDoc = await insertDocReq.query(`
        INSERT INTO [RT_WEB].dbo.tb_DOCUMENT (COMPANY_CODE, GRN, PRN, TOG, REPUSER)
        VALUES (@COMPANY_CODE, @GRN, @PRN, @TOG, @REPUSER)
      `);
      if (insertDoc.rowsAffected[0] === 0)
        throw new Error("Document insert failed");
    } else {
      const doc = documentResult.recordset[0];
      grn = doc.GRN || "00";
      prn = doc.PRN || "00";
      tog = doc.TOG || "00";
    }

    // Step 4: Generate new document number
    const newGrn = String(Number(grn) + 1).padStart(2, "0");
    const newPrn = String(Number(prn) + 1).padStart(2, "0");
    const newTog = String(Number(tog) + 1).padStart(2, "0");

    const newDocNums = { GRN: newGrn, PRN: newPrn, TOG: newTog };
    const companyCode = company.trim();
    const docPart = newDocNums[type].toString();
    const totalLength = 10;

    const zeroPaddingLength =
      totalLength - (companyCode.length + docPart.length);
    const zeroPadding = "0".repeat(zeroPaddingLength);

    const documentNo = companyCode + zeroPadding + docPart;

    // Step 5: Update document number
    const updateDocReq = new mssql.Request(transaction);
    updateDocReq.input("COMPANY_CODE", mssql.NChar(10), company.trim());

    if (type === "GRN") updateDocReq.input("GRN", mssql.NVarChar(2), newGrn);
    else if (type === "PRN")
      updateDocReq.input("PRN", mssql.NVarChar(2), newPrn);
    else updateDocReq.input("TOG", mssql.NVarChar(2), newTog);

    const updateQuery = `
      UPDATE [RT_WEB].dbo.tb_DOCUMENT
      SET ${type} = @${type}
      WHERE COMPANY_CODE = @COMPANY_CODE
    `;

    const updateResult = await updateDocReq.query(updateQuery);
    if (updateResult.rowsAffected[0] === 0) {
      throw new Error(`Failed to update ${type} number`);
    }

    const { trDate, trTime } = currentDateTime();

    for (const record of records) {
      // Common parameters
      const baseInputs = {
        DOCUMENT_NO: documentNo,
        COMPANY_CODE: record.COMPANY_CODE.trim(),
        PRODUCT_CODE: record.PRODUCT_CODE.trim(),
        PRODUCT_NAMELONG: record.PRODUCT_NAMELONG.trim(),
        COSTPRICE: record.COSTPRICE,
        UNITPRICE: record.UNITPRICE,
        CUR_STOCK: record.CUR_STOCK,
        PHY_STOCK: record.PHY_STOCK,
        REPUSER: username.trim(),
        REMARKS: remarks,
        APPROVED_USER: username,
        trDate,
        trTime,
        VENDOR_CODE: record.VENDOR_CODE?.trim(),
        VENDOR_NAME: record.VENDOR_NAME?.trim(),
        INVOICE_NO: record.INVOICE_NO?.trim(),
        TYPE: record.TYPE?.trim(),
        COMPANY_TO_CODE: record.COMPANY_TO_CODE?.trim(),
        SERIALNO: record.SERIALNO?.trim() || "",
        COLORCODE: record.COLORCODE?.trim() || "",
        SIZECODE: record.SIZECODE?.trim() || "",
      };

      // Insert main
      const insertReq = new mssql.Request(transaction);
      Object.entries(baseInputs).forEach(([key, value]) => {
        if (value !== undefined) {
          const type =
            key === "COSTPRICE" || key === "UNITPRICE"
              ? mssql.Money
              : key === "CUR_STOCK" || key === "PHY_STOCK"
              ? mssql.Float
              : key === "trDate" || key === "trTime"
              ? mssql.DateTime
              : key === "COMPANY_CODE" ||
                key === "PRODUCT_CODE" ||
                key === "COMPANY_TO_CODE" ||
                key === "VENDOR_CODE" ||
                key === "INVOICE_NO"
              ? mssql.NChar(30)
              : mssql.NVarChar(255); // fallback
          insertReq.input(key, type, value);
        }
      });

      let insertQuery = "",
        backupQuery = "";
      if (type === "GRN" || type === "PRN") {
        insertQuery = `
      INSERT INTO [RT_WEB].dbo.${finalTables[type]} 
      (DOCUMENT_NO, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE,
       PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE,
       CUR_STOCK, PHY_STOCK, REPUSER, REMARKS, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE)
      VALUES
      (@DOCUMENT_NO, @COMPANY_CODE, @VENDOR_CODE, @VENDOR_NAME, @INVOICE_NO, @TYPE,
       @PRODUCT_CODE, @PRODUCT_NAMELONG, @COSTPRICE, @UNITPRICE,
       @CUR_STOCK, @PHY_STOCK, @REPUSER, @REMARKS, @trDate, @trTime, @SERIALNO,@COLORCODE, @SIZECODE)
    `;

        backupQuery = `
      INSERT INTO [RT_WEB].dbo.${backupTables[type]} 
      (COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE,
       PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE,
       CUR_STOCK, PHY_STOCK, REPUSER, REMARKS, APPROVED_USER, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE)
      VALUES
      (@COMPANY_CODE, @VENDOR_CODE, @VENDOR_NAME, @INVOICE_NO, @TYPE,
       @PRODUCT_CODE, @PRODUCT_NAMELONG, @COSTPRICE, @UNITPRICE,
       @CUR_STOCK, @PHY_STOCK, @REPUSER, @REMARKS, @APPROVED_USER, @trDate, @trTime, @SERIALNO,@COLORCODE, @SIZECODE)
    `;
      } else if (type === "TOG") {
        insertQuery = `
      INSERT INTO [RT_WEB].dbo.${finalTables[type]} 
      (DOCUMENT_NO, COMPANY_CODE, COMPANY_TO_CODE, TYPE,
       PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE,
       CUR_STOCK, PHY_STOCK, REMARKS, REPUSER, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE)
      VALUES
      (@DOCUMENT_NO, @COMPANY_CODE, @COMPANY_TO_CODE, @TYPE,
       @PRODUCT_CODE, @PRODUCT_NAMELONG, @COSTPRICE, @UNITPRICE,
       @CUR_STOCK, @PHY_STOCK, @REMARKS, @REPUSER, @trDate, @trTime, @SERIALNO,@COLORCODE, @SIZECODE)
    `;

        backupQuery = `
      INSERT INTO [RT_WEB].dbo.${backupTables[type]} 
      (COMPANY_CODE, COMPANY_TO_CODE, TYPE,
       PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE,
       CUR_STOCK, PHY_STOCK, REMARKS, REPUSER, APPROVED_USER, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE)
      VALUES
      (@COMPANY_CODE, @COMPANY_TO_CODE, @TYPE,
       @PRODUCT_CODE, @PRODUCT_NAMELONG, @COSTPRICE, @UNITPRICE,
       @CUR_STOCK, @PHY_STOCK, @REMARKS, @REPUSER, @APPROVED_USER, @trDate, @trTime, @SERIALNO,@COLORCODE, @SIZECODE)
    `;
      }

      await insertReq.query(insertQuery);

      // Separate request for backup
      const backupReq = new mssql.Request(transaction);
      Object.entries(baseInputs).forEach(([key, value]) => {
        if (value !== undefined) {
          const type =
            key === "COSTPRICE" || key === "UNITPRICE"
              ? mssql.Money
              : key === "CUR_STOCK" || key === "PHY_STOCK"
              ? mssql.Float
              : key === "trDate" || key === "trTime"
              ? mssql.DateTime
              : key === "COMPANY_CODE" ||
                key === "PRODUCT_CODE" ||
                key === "COMPANY_TO_CODE" ||
                key === "VENDOR_CODE" ||
                key === "INVOICE_NO"
              ? mssql.NChar(30)
              : mssql.NVarChar(255); // fallback
          backupReq.input(key, type, value);
        }
      });

      await backupReq.query(backupQuery);
    }

    // Step 7: Delete temp data
    if (type === "TOG") {
      const deleteReq = new mssql.Request(transaction);
      deleteReq.input("COMPANY_CODE", mssql.NChar(10), company.trim());

      await deleteReq.query(`
      DELETE FROM [RT_WEB].dbo.${tempTables[type]} 
      WHERE COMPANY_CODE = @COMPANY_CODE 
    `);
    } else {
      const deleteReq = new mssql.Request(transaction);
      deleteReq.input("COMPANY_CODE", mssql.NChar(10), company.trim());
      deleteReq.input("INVOICE_NO", mssql.NChar(50), invoice.trim());

      await deleteReq.query(`
      DELETE FROM [RT_WEB].dbo.${tempTables[type]} 
      WHERE COMPANY_CODE = @COMPANY_CODE AND INVOICE_NO = @INVOICE_NO
    `);
    }

    // Step 8: Commit transaction
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Data moved successfully",
      documentNo,
    });
  } catch (error) {
    console.error("Error in finalGrnPrnUpdate:", error.message);
    if (transaction && !transaction._aborted) {
      await transaction.rollback();
    }
    return res.status(500).json({
      success: false,
      message: "Unexpected error occurred",
      error: error.message,
    });
  }
};

// Get dashboard data function
exports.dashboardOptions = async (req, res) => {
  try {
    // Ensure database connection is open
    if (!mssql.connected) {
      await mssql.connect({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE2, // or RT_WEB
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      });
    }

    await mssql.query(`USE [${rtweb}];`); // run separately

    const result = await mssql.query(`
  SELECT COMPANY_CODE, COMPANY_NAME FROM tb_COMPANY;
`);

    const records = result.recordset || [];

    if (records.length === 0) {
      return res.status(404).json({ message: "No companies found" });
    }

    const userData = records.map(({ COMPANY_CODE, COMPANY_NAME }) => ({
      COMPANY_CODE: COMPANY_CODE?.trim(),
      COMPANY_NAME: COMPANY_NAME?.trim(),
    }));

    return res.status(200).json({
      message: "Dashboard data retrieved successfully",
      userData,
    });
  } catch (error) {
    console.error("Error retrieving dashboard data:", error);
    return res
      .status(500)
      .json({ message: "Failed to retrieve dashboard data" });
  }
};

// Get vendor data function
exports.vendorOptions = async (req, res) => {
  try {
    // const posback = process.env.DB_DATABASE3 || "POSBACK_SYSTEM"; // Define the DB name
    const pool = await connectToDatabase(); // Assumes this connects initially to any DB

    const result = await pool.request().query(`
      USE [${posback}];
      SELECT VENDORCODE, VENDORNAME FROM tb_VENDOR;
    `);

    const vendors = result.recordset || [];

    if (vendors.length === 0) {
      return res.status(404).json({ message: "No vendors found" });
    }

    const vendorData = vendors.map(({ VENDORCODE, VENDORNAME }) => ({
      VENDORCODE: VENDORCODE?.trim(),
      VENDORNAME: VENDORNAME?.trim(),
    }));

    return res.status(200).json({
      message: "Dashboard data retrieved successfully",
      vendorData,
    });
  } catch (error) {
    console.error("Error retrieving vendor data:", error);
    return res.status(500).json({ message: "Failed to retrieve vendor data" });
  }
};

//report data
exports.reportData = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    const decoded = await verifyToken(token, process.env.JWT_SECRET);
    const username = decoded.username;

    // Normalize selectedOptions from query string
    let selectedOptions =
      req.query.selectedOptions || req.query["selectedOptions[]"];
    if (typeof selectedOptions === "string") {
      selectedOptions = [selectedOptions];
    }

    const { fromDate, toDate, invoiceNo } = req.query;

    if (
      !fromDate ||
      !toDate ||
      !Array.isArray(selectedOptions) ||
      selectedOptions.length === 0
    ) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const formattedFromDate = formatDate(fromDate);
    const formattedToDate = formatDate(toDate);
    const reportType = "INVOICEWISE";

    // Clean previous data
    await mssql.query`
      USE RT_WEB;
      DELETE FROM tb_SALESVIEW WHERE REPUSER = ${username};
    `;

    // Run SP for each company
    for (const companyCode of selectedOptions) {
      await mssql.query`
        EXEC RT_WEB.dbo.Sp_SalesView 
        @COMPANY_CODE = ${companyCode},
        @DATE1 = ${formattedFromDate},
        @DATE2 = ${formattedToDate},
        @REPUSER = ${username},
        @REPORT_TYPE = ${reportType};
      `;
    }

    // Main report query
    const reportQuery = await mssql.query`
      USE RT_WEB;
      SELECT 
        INVOICENO, COMPANY_CODE, UNITNO, REPNO, 'CASH' AS PRODUCT_NAME, 
        ISNULL(SUM(CASE PRODUCT_NAME 
          WHEN 'CASH' THEN AMOUNT 
          WHEN 'BALANCE' THEN -AMOUNT 
          ELSE 0 END), 0) AS AMOUNT, 
        SALESDATE
      FROM tb_SALESVIEW 
      WHERE (ID='PT' OR ID='BL') 
        AND PRODUCT_NAME IN ('CASH', 'BALANCE') 
        AND REPUSER = ${username}
      GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO

      UNION ALL

      SELECT 
        INVOICENO, COMPANY_CODE, UNITNO, REPNO, PRODUCT_NAME, 
        ISNULL(SUM(AMOUNT), 0) AS AMOUNT, SALESDATE
      FROM tb_SALESVIEW 
      WHERE ID='PT' 
        AND PRODUCT_NAME NOT IN ('CASH', 'BALANCE') 
        AND REPUSER = ${username}
      GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO, PRODUCT_NAME;
    `;

    // Invoice detail query if needed
    let invoiceData = [];
    if (invoiceNo) {
      const result = await mssql.query`
        USE RT_WEB;
        SELECT INVOICENO, PRODUCT_NAME, QTY, AMOUNT, COSTPRICE, UNITPRICE, DISCOUNT 
        FROM tb_SALESVIEW 
        WHERE INVOICENO = ${invoiceNo} 
          AND ID IN ('SL', 'SLF', 'RF', 'RFF') 
          AND REPUSER = ${username};
      `;
      invoiceData = result.recordset;
    }

    res.status(200).json({
      message: "Invoice data found",
      success: true,
      reportData: reportQuery.recordset || [],
      invoiceData: invoiceData || [],
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

//current report
exports.currentReportData = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    const decoded = await verifyToken(token, process.env.JWT_SECRET);
    const username = decoded.username;

    // Handle companyCodes parsing (from ?companyCodes=01&companyCodes=02 or ?companyCodes[]=01&companyCodes[]=02)
    let companyCodes = req.query.companyCodes || req.query["companyCodes[]"];
    if (typeof companyCodes === "string") {
      companyCodes = [companyCodes];
    }

    const { currentDate, invoiceNo } = req.query;

    if (
      !Array.isArray(companyCodes) ||
      companyCodes.length === 0 ||
      !currentDate
    ) {
      return res.status(400).json({ message: "Missing or invalid parameters" });
    }

    const date = formatDate(currentDate);
    const reportType = "INVOICEWISE";

    // Step 1: Clean previous report data
    await mssql.query`
      USE RT_WEB;
      DELETE FROM tb_SALESVIEW WHERE REPUSER = ${username};
    `;

    // Step 2: Execute SP for each company
    for (const companyCode of companyCodes) {
      await mssql.query`
        EXEC RT_WEB.dbo.Sp_SalesCurView 
        @COMPANY_CODE = ${companyCode}, 
        @DATE = ${date}, 
        @REPUSER = ${username}, 
        @REPORT_TYPE = ${reportType};
      `;
    }

    // Step 3: Fetch summarized report data
    const reportQuery = await mssql.query`
      USE RT_WEB;
      SELECT 
        INVOICENO, COMPANY_CODE, UNITNO, REPNO, 'CASH' AS PRODUCT_NAME, 
        ISNULL(SUM(CASE PRODUCT_NAME 
          WHEN 'CASH' THEN AMOUNT 
          WHEN 'BALANCE' THEN -AMOUNT 
          ELSE 0 END), 0) AS AMOUNT, 
        SALESDATE
      FROM tb_SALESVIEW 
      WHERE (ID = 'PT' OR ID = 'BL') 
        AND PRODUCT_NAME IN ('CASH', 'BALANCE') 
        AND REPUSER = ${username}
      GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO

      UNION ALL

      SELECT 
        INVOICENO, COMPANY_CODE, UNITNO, REPNO, PRODUCT_NAME, 
        ISNULL(SUM(AMOUNT), 0) AS AMOUNT, SALESDATE
      FROM tb_SALESVIEW 
      WHERE ID = 'PT' 
        AND PRODUCT_NAME NOT IN ('CASH', 'BALANCE') 
        AND REPUSER = ${username}
      GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO, PRODUCT_NAME;
    `;

    // Step 4: Fetch detailed invoice data if requested
    let invoiceData = [];
    if (invoiceNo) {
      const result = await mssql.query`
        USE RT_WEB;
        SELECT INVOICENO, PRODUCT_NAME, QTY, AMOUNT, COSTPRICE, UNITPRICE, DISCOUNT 
        FROM tb_SALESVIEW 
        WHERE INVOICENO = ${invoiceNo} 
          AND ID IN ('SL', 'SLF', 'RF', 'RFF') 
          AND REPUSER = ${username};
      `;
      invoiceData = result.recordset;
    }

    // Step 5: Respond
    res.status(200).json({
      message: "Invoice data found",
      success: true,
      reportData: reportQuery.recordset || [],
      invoiceData,
    });
  } catch (error) {
    console.error("Error retrieving current report data:", error);
    res.status(500).json({ message: "Failed to retrieve current report data" });
  }
};

//company dashboard
exports.loadingDashboard = async (req, res) => {
  try {
    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    const decoded = await verifyToken(token, process.env.JWT_SECRET);
    const username = decoded.username;

    const { currentDate, fromDate, toDate, selectedOptions } = req.query;

    if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid or missing company codes" });
    }

    // Optional: Validate company codes are alphanumeric (prevent SQL injection)
    const isSafe = selectedOptions.every((code) => /^[a-zA-Z0-9]+$/.test(code));
    if (!isSafe) {
      return res
        .status(400)
        .json({ message: "Invalid characters in company codes" });
    }

    const formattedCurrentDate = formatDate(currentDate);
    const formattedFromDate = formatDate(fromDate);
    const formattedToDate = formatDate(toDate);
    const reportType = "SALESSUM1";

    // Clear previous dashboard view data
    await mssql.query`USE RT_WEB; DELETE FROM tb_SALES_DASHBOARD_VIEW WHERE REPUSER = ${username};`;

    // Execute stored procedures per company
    for (const companyCode of selectedOptions) {
      if (fromDate && toDate) {
        await mssql.query`
          EXEC RT_WEB.dbo.Sp_SalesView 
            @COMPANY_CODE = ${companyCode}, 
            @DATE1 = ${formattedFromDate}, 
            @DATE2 = ${formattedToDate}, 
            @REPUSER = '${username}', 
            @REPORT_TYPE = ${reportType};
        `;
      } else {
        await mssql.query`
          EXEC RT_WEB.dbo.Sp_SalesCurView 
            @COMPANY_CODE = ${companyCode}, 
            @DATE = ${formattedCurrentDate}, 
            @REPUSER = ${username}, 
            @REPORT_TYPE = ${reportType};
        `;
      }
    }

    // Properly formatted IN clause (quoted string literals)
    const companyCodesList = selectedOptions
      .map((code) => `'${code}'`)
      .join(", ");

    // One row summary
    const loadingDashboardResult = await new mssql.Request().input(
      "username",
      mssql.VarChar,
      username
    ).query(`
  USE [${rtweb}];
  SELECT 
    SUM(NETSALES) AS NETSALES,
    SUM(CASHSALES) AS CASHSALES,
    SUM(CARDSALES) AS CARDSALES,
    SUM(CREDITSALES) AS CREDITSALES,
    SUM(OTHER_PAYMENT) AS OTHER_PAYMENT,
    SUM(GVOUCHER_SALE) AS GIFT_VOUCHER,
    SUM(PAIDOUT) AS PAIDOUT,
    SUM(CASHINHAND) AS CASHINHAND
  FROM tb_SALES_DASHBOARD_VIEW
  WHERE COMPANY_CODE IN (${companyCodesList});
`);

    // Per company summary
    const record = await new mssql.Request().input(
      "username",
      mssql.VarChar,
      username
    ).query(`
    USE [${rtweb}];
    SELECT 
      COMPANY_CODE,      
      SUM(NETSALES) AS NETSALES, 
      SUM(CASHSALES) AS CASHSALES, 
      SUM(CARDSALES) AS CARDSALES, 
      SUM(CREDITSALES) AS CREDITSALES, 
      SUM(OTHER_PAYMENT) AS OTHER_PAYMENT,
      SUM(GVOUCHER_SALE) AS GIFT_VOUCHER,
      SUM(PAIDOUT) AS PAIDOUT,
      SUM(CASHINHAND) AS CASHINHAND
    FROM tb_SALES_DASHBOARD_VIEW
    WHERE COMPANY_CODE IN (${companyCodesList})
    GROUP BY COMPANY_CODE;
  `);

    // Per unit summary
    const cashierPointRecord = await new mssql.Request().input(
      "username",
      mssql.VarChar,
      username
    ).query(`
    USE [${rtweb}];
    SELECT 
      COMPANY_CODE, 
      UNITNO, 
      SUM(NETSALES) AS NETSALES, 
      SUM(CASHSALES) AS CASHSALES, 
      SUM(CARDSALES) AS CARDSALES, 
      SUM(CREDITSALES) AS CREDITSALES, 
      SUM(OTHER_PAYMENT) AS OTHER_PAYMENT,
      SUM(GVOUCHER_SALE) AS GIFT_VOUCHER,
      SUM(PAIDOUT) AS PAIDOUT,
      SUM(CASHINHAND) AS CASHINHAND
    FROM tb_SALES_DASHBOARD_VIEW
    WHERE COMPANY_CODE IN (${companyCodesList})
    GROUP BY COMPANY_CODE, UNITNO;
  `);

    // Format results
    const formattedResult =
      loadingDashboardResult && Array.isArray(loadingDashboardResult.recordset)
        ? loadingDashboardResult.recordset.map((row) => ({
            NETSALES: parseFloat(row.NETSALES || 0).toFixed(2),
            CASHSALES: parseFloat(row.CASHSALES || 0).toFixed(2),
            CARDSALES: parseFloat(row.CARDSALES || 0).toFixed(2),
            CREDITSALES: parseFloat(row.CREDITSALES || 0).toFixed(2),
            OTHER_PAYMENT: parseFloat(row.OTHER_PAYMENT || 0).toFixed(2),
            GIFT_VOUCHER: parseFloat(row.GIFT_VOUCHER || 0).toFixed(2),
            PAIDOUT: parseFloat(row.PAIDOUT || 0).toFixed(2),
            CASHINHAND: parseFloat(row.CASHINHAND || 0).toFixed(2),
          }))
        : [];

    // Send response
    res.status(200).json({
      message: "Processed parameters for company codes",
      success: true,
      result: formattedResult ?? [],
      record: record?.recordset ?? [],
      cashierPointRecord: cashierPointRecord?.recordset ?? [],
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    res.status(500).json({ message: "Failed to load campany dashboard data" });
  }
};

//department dashboard
exports.departmentDashboard = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      const username = decoded.username;
      let { currentDate, fromDate, toDate, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const formattedCurrentDate = formatDate(currentDate);
      const formattedFromDate = formatDate(fromDate);
      const formattedToDate = formatDate(toDate);
      const reportType = "SALESDET";

      // Helper function: retry mechanism
      const executeWithRetry = async (queryFunc, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            return await queryFunc();
          } catch (err) {
            if (err.originalError?.number === 1205 && i < retries - 1) {
              console.warn(`Deadlock occurred. Retrying attempt ${i + 1}...`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
              throw err;
            }
          }
        }
      };

      // Step 1: Clear previous user records
      try {
        const request = new mssql.Request();
        request.input("username", mssql.VarChar, username);

        await request.query(`
  DELETE FROM tb_SALESVIEW WHERE REPUSER = @username;
`);
      } catch (deleteErr) {
        console.error("Error deleting previous records:", deleteErr);
      }

      // Step 2: Run stored procedures for each company
      for (const companyCode of selectedOptions) {
        try {
          const queryFn =
            fromDate && toDate
              ? () => mssql.query`
                EXEC Sp_SalesView @COMPANY_CODE = ${companyCode}, 
                                  @DATE1 = ${formattedFromDate}, 
                                  @DATE2 = ${formattedToDate}, 
                                  @REPUSER = ${username}, 
                                  @REPORT_TYPE = ${reportType}`
              : () => mssql.query`
                EXEC Sp_SalesCurView @COMPANY_CODE = ${companyCode}, 
                                     @DATE = ${formattedCurrentDate}, 
                                     @REPUSER = ${username}, 
                                     @REPORT_TYPE = ${reportType}`;

          await executeWithRetry(queryFn);
        } catch (spErr) {
          console.error(
            `Error executing stored procedure for ${companyCode}:`,
            spErr
          );
        }
      }

      // Step 3: Fetch department data
      const inClause = selectedOptions.map((code) => `'${code}'`).join(","); // safe, string literals

      try {
        const [tableRecords, amountBarChart, quantityBarChart] =
          await Promise.all([
            mssql.query(`
            USE [${rtweb}];
            SELECT   
              LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(DEPTCODE)) AS DEPARTMENT_CODE,
              DEPTNAME AS DEPARTMENT_NAME,
              SUM(QTY) AS QUANTITY,
              SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause})
            GROUP BY COMPANY_CODE, DEPTCODE, DEPTNAME`),

            mssql.query(`
            USE [${rtweb}];
            SELECT DEPTNAME, SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause})
            GROUP BY DEPTNAME`),

            mssql.query(`
            USE [${rtweb}];
            SELECT DEPTNAME, SUM(QTY) AS QUANTITY
            FROM tb_SALESVIEW
            WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause})
            GROUP BY DEPTNAME`),
          ]);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          tableRecords: tableRecords.recordset || [],
          amountBarChart: amountBarChart.recordset || [],
          quantityBarChart: quantityBarChart.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching department data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch department data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in departmentDashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load department dashboard" });
  }
};

//category dashboard
exports.categoryDashboard = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      const username = decoded.username;
      let { currentDate, fromDate, toDate, selectedOptions } = req.query;

      // Ensure selectedOptions is always an array
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const formattedCurrentDate = formatDate(currentDate);
      const formattedFromDate = formatDate(fromDate);
      const formattedToDate = formatDate(toDate);
      const reportType = "SALESDET";

      // Clear previous report data
      try {
        const query = `
  USE [${rtweb}];
  DELETE FROM tb_SALESVIEW WHERE REPUSER = @username;
`;

        const request = new mssql.Request();
        request.input("username", mssql.VarChar, username);

        await request.query(query);
      } catch (err) {
        console.error("Error clearing tb_SALESVIEW:", err);
      }

      // Run stored procedures for each company code
      for (const companyCode of selectedOptions) {
        try {
          if (fromDate && toDate) {
            await mssql.query`
              EXEC Sp_SalesView 
                @COMPANY_CODE = ${companyCode}, 
                @DATE1 = ${formattedFromDate}, 
                @DATE2 = ${formattedToDate}, 
                @REPUSER = ${username}, 
                @REPORT_TYPE = ${reportType}`;
          } else {
            await mssql.query`
              EXEC Sp_SalesCurView 
                @COMPANY_CODE = ${companyCode}, 
                @DATE = ${formattedCurrentDate}, 
                @REPUSER = ${username}, 
                @REPORT_TYPE = ${reportType}`;
          }
        } catch (err) {
          console.error(`Error running SP for company ${companyCode}:`, err);
        }
      }

      // Safely construct SQL IN clause
      const inClause = selectedOptions.map((code) => `'${code}'`).join(", ");

      // Run summary queries
      const [
        categoryTableRecords,
        categoryAmountBarChart,
        categoryQuantityBarChart,
      ] = await Promise.all([
        mssql.query(`
          USE [${rtweb}];
          SELECT
            LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
            LTRIM(RTRIM(CATCODE)) AS CATEGORY_CODE,
            CATNAME AS CATEGORY_NAME,
            SUM(QTY) AS QUANTITY,
            SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause})
          GROUP BY COMPANY_CODE, CATCODE, CATNAME`),

        mssql.query(`
          USE [${rtweb}];
          SELECT CATNAME, SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause})
          GROUP BY CATNAME`),

        mssql.query(`
          USE [${rtweb}];
          SELECT CATNAME, SUM(QTY) AS QUANTITY
          FROM tb_SALESVIEW
          WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause})
          GROUP BY CATNAME`),
      ]);

      return res.status(200).json({
        message: "Processed parameters for company codes",
        success: true,
        categoryTableRecords: categoryTableRecords.recordset || [],
        categoryAmountBarChart: categoryAmountBarChart.recordset || [],
        categoryQuantityBarChart: categoryQuantityBarChart.recordset || [],
      });
    });
  } catch (error) {
    console.error("Unhandled error in categoryDashboard:", error);
    res.status(500).json({ message: "Failed to load category dashboard" });
  }
};

//sub category dashboard
exports.subCategoryDashboard = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      const username = decoded.username;
      let { currentDate, fromDate, toDate, selectedOptions } = req.query;

      // Ensure selectedOptions is parsed to an array
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const formattedCurrentDate = formatDate(currentDate);
      const formattedFromDate = formatDate(fromDate);
      const formattedToDate = formatDate(toDate);
      const reportType = "SALESDET";

      // Clear previous data
      try {
        const query = `
    USE [${rtweb}];
    DELETE FROM tb_SALESVIEW WHERE REPUSER = @username;
  `;
        const request = new mssql.Request();
        request.input("username", mssql.VarChar, username);
        await request.query(query);
      } catch (error) {
        console.error("Error clearing tb_SALESVIEW:", error);
      }

      // Execute SP for each company code
      for (const companyCode of selectedOptions) {
        try {
          if (fromDate && toDate) {
            await mssql.query`
              EXEC Sp_SalesView 
                @COMPANY_CODE = ${companyCode}, 
                @DATE1 = ${formattedFromDate}, 
                @DATE2 = ${formattedToDate}, 
                @REPUSER = ${username}, 
                @REPORT_TYPE = ${reportType}`;
          } else {
            await mssql.query`
              EXEC Sp_SalesCurView 
                @COMPANY_CODE = ${companyCode}, 
                @DATE = ${formattedCurrentDate}, 
                @REPUSER = ${username}, 
                @REPORT_TYPE = ${reportType}`;
          }
        } catch (error) {
          console.error(`Error running SP for company ${companyCode}:`, error);
        }
      }

      // Safely construct IN clause
      const inClause = selectedOptions.map((code) => `'${code}'`).join(", ");

      // Perform summary queries
      const [
        subCategoryTableRecords,
        subCategoryAmountBarChart,
        subCategoryQuantityBarChart,
      ] = await Promise.all([
        new mssql.Request().input("username", mssql.VarChar, username).query(`
      USE [${rtweb}];
      SELECT
        LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
        LTRIM(RTRIM(SCATCODE)) AS SUBCATEGORY_CODE,
        SCATNAME AS SUBCATEGORY_NAME,
        SUM(QTY) AS QUANTITY,
        SUM(AMOUNT) AS AMOUNT
      FROM tb_SALESVIEW
      WHERE REPUSER = @username AND COMPANY_CODE IN (${inClause})
      GROUP BY COMPANY_CODE, SCATCODE, SCATNAME`),

        new mssql.Request().input("username", mssql.VarChar, username).query(`
      USE [${rtweb}];
      SELECT SCATNAME, SUM(AMOUNT) AS AMOUNT
      FROM tb_SALESVIEW
      WHERE REPUSER = @username AND COMPANY_CODE IN (${inClause})
      GROUP BY SCATNAME`),

        new mssql.Request().input("username", mssql.VarChar, username).query(`
      USE [${rtweb}];
      SELECT SCATNAME, SUM(QTY) AS QUANTITY
      FROM tb_SALESVIEW
      WHERE REPUSER = @username AND COMPANY_CODE IN (${inClause})
      GROUP BY SCATNAME`),
      ]);

      return res.status(200).json({
        message: "Processed parameters for company codes",
        success: true,
        subCategoryTableRecords: subCategoryTableRecords.recordset || [],
        subCategoryAmountBarChart: subCategoryAmountBarChart.recordset || [],
        subCategoryQuantityBarChart:
          subCategoryQuantityBarChart.recordset || [],
      });
    });
  } catch (error) {
    console.error("Unhandled error in subCategoryDashboard:", error);
    res.status(500).json({ message: "Failed to load subcategory dashboard" });
  }
};

//vendor dashboard
exports.vendorDashboard = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      const username = decoded.username;
      let { currentDate, fromDate, toDate, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const formattedCurrentDate = formatDate(currentDate);
      const formattedFromDate = formatDate(fromDate);
      const formattedToDate = formatDate(toDate);
      const reportType = "SALESDET";

      try {
        const query = `
          DELETE FROM [${rtweb}].dbo.tb_SALESVIEW WHERE REPUSER = @username;
        `;
        const request = new mssql.Request();
        request.input("username", mssql.VarChar, username);
        await request.query(query);
      } catch (error) {
        console.error("Error deleting tb_SALESVIEW records:", error);
      }

      for (const companyCode of selectedOptions) {
        try {
          if (fromDate && toDate) {
            await mssql.query`
              EXEC Sp_SalesView 
                @COMPANY_CODE = ${companyCode},
                @DATE1 = ${formattedFromDate},
                @DATE2 = ${formattedToDate},
                @REPUSER = ${username},
                @REPORT_TYPE = ${reportType}`;
          } else {
            await mssql.query`
              EXEC Sp_SalesCurView 
                @COMPANY_CODE = ${companyCode},
                @DATE = ${formattedCurrentDate},
                @REPUSER = ${username},
                @REPORT_TYPE = ${reportType}`;
          }
        } catch (error) {
          console.error(`Error running SP for company ${companyCode}:`, error);
        }
      }

      const dbTable = `[${rtweb}].dbo.tb_SALESVIEW`;

      // Use parameterized IN clause
      const companyParams = selectedOptions
        .map((_, i) => `@code${i}`)
        .join(", ");
      const companyRequest1 = new mssql.Request();
      const companyRequest2 = new mssql.Request();
      const companyRequest3 = new mssql.Request();

      companyRequest1.input("username", mssql.VarChar, username);
      companyRequest2.input("username", mssql.VarChar, username);
      companyRequest3.input("username", mssql.VarChar, username);

      selectedOptions.forEach((code, index) => {
        const paramName = `code${index}`;
        companyRequest1.input(paramName, mssql.VarChar, code);
        companyRequest2.input(paramName, mssql.VarChar, code);
        companyRequest3.input(paramName, mssql.VarChar, code);
      });

      const [vendorTableRecords, vendorAmountBarChart, vendorQuantityBarChart] =
        await Promise.all([
          companyRequest1.query(`
            SELECT
              LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(VENDORCODE)) AS VENDOR_CODE,
              VENDORNAME AS VENDOR_NAME,
              SUM(QTY) AS QUANTITY,
              SUM(AMOUNT) AS AMOUNT
            FROM ${dbTable}
            WHERE REPUSER = @username AND COMPANY_CODE IN (${companyParams})
            GROUP BY COMPANY_CODE, VENDORCODE, VENDORNAME
          `),

          companyRequest2.query(`
            SELECT VENDORNAME, SUM(AMOUNT) AS AMOUNT
            FROM ${dbTable}
            WHERE REPUSER = @username AND COMPANY_CODE IN (${companyParams})
            GROUP BY VENDORNAME
          `),

          companyRequest3.query(`
            SELECT VENDORNAME, SUM(QTY) AS QUANTITY
            FROM ${dbTable}
            WHERE REPUSER = @username AND COMPANY_CODE IN (${companyParams})
            GROUP BY VENDORNAME
          `),
        ]);

      return res.status(200).json({
        message: "Processed parameters for company codes",
        success: true,
        vendorTableRecords: vendorTableRecords.recordset || [],
        vendorAmountBarChart: vendorAmountBarChart.recordset || [],
        vendorQuantityBarChart: vendorQuantityBarChart.recordset || [],
      });
    });
  } catch (error) {
    console.error("Unhandled error in vendorDashboard:", error);
    res.status(500).json({ message: "Failed to load vendor dashboard" });
  }
};

//color size sales product dashboard data
exports.colorSizeSalesProductDashboard = async (req, res) => {
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      const username = decoded.username;
      let { currentDate, fromDate, toDate, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const formattedCurrentDate = formatDate(currentDate);
      const formattedFromDate = formatDate(fromDate);
      const formattedToDate = formatDate(toDate);
      const reportType = "SALESDET";

      // Helper function: retry mechanism
      const executeWithRetry = async (queryFunc, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            return await queryFunc();
          } catch (err) {
            if (err.originalError?.number === 1205 && i < retries - 1) {
              console.warn(`Deadlock occurred. Retrying attempt ${i + 1}...`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
              throw err;
            }
          }
        }
      };

      // Step 1: Clear previous user records
      try {
        const request = new mssql.Request();
        request.input("username", mssql.VarChar, username);

        await request.query(`
  DELETE FROM tb_SALESVIEW WHERE REPUSER = @username;
`);
      } catch (deleteErr) {
        console.error("Error deleting previous records:", deleteErr);
      }

      // Step 2: Run stored procedures for each company
      for (const companyCode of selectedOptions) {
        try {
          const queryFn =
            fromDate && toDate
              ? () => mssql.query`
                EXEC Sp_SalesView @COMPANY_CODE = ${companyCode}, 
                                  @DATE1 = ${formattedFromDate}, 
                                  @DATE2 = ${formattedToDate}, 
                                  @REPUSER = ${username}, 
                                  @REPORT_TYPE = ${reportType}`
              : () => mssql.query`
                EXEC Sp_SalesCurView @COMPANY_CODE = ${companyCode}, 
                                     @DATE = ${formattedCurrentDate}, 
                                     @REPUSER = ${username}, 
                                     @REPORT_TYPE = ${reportType}`;

          await executeWithRetry(queryFn);
        } catch (spErr) {
          console.error(
            `Error executing stored procedure for ${companyCode}:`,
            spErr
          );
        }
      }

      // Step 3: Fetch product data
      const inClause = selectedOptions.map((code) => `'${code}'`).join(","); // safe, string literals

      try {
        const [tableRecords] =
          await Promise.all([
            mssql.query(`
            USE [${rtweb}];
            SELECT   
              LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(PRODUCT_CODE)) AS PRODUCT_CODE,
              PRODUCT_NAME AS PRODUCT_NAME,
              SUM(QTY) AS QUANTITY,
              SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause})
            GROUP BY COMPANY_CODE, PRODUCT_NAME, PRODUCT_CODE`),
          ]);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          tableRecords: tableRecords.recordset || []
        });
      } catch (fetchErr) {
        console.error("Error fetching product data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch product data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in productDashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load product dashboard" });
  }
};

//color size sales product
exports.colorSizeSalesProduct = async (req, res) => {
 
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",");
      }

      const inClause = selectedOptions
        .map((code) => `'${code.trim()}'`)
        .join(",");

      try {
        const [tableRecords] = await Promise.all([
          mssql.query(`
            USE [${rtweb}];
            SELECT   
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
              PRODUCT_CODE,
              PRODUCT_NAME,
              SUM(COSTPRICE) AS COSTPRICE,
              SUM(UNITPRICE) AS UNITPRICE,
              SUM(DISCOUNT) AS DISCOUNT,
              SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause}) AND PRODUCT_CODE = '${code}'
            GROUP BY PRODUCT_CODE,
              PRODUCT_NAME, SERIALNO`),
        ]);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          records: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching product data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch product data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in productDashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load product dashboard" });
  }
};

//color size sales department dashboard
exports.colorSizeSalesDepartment = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",");
      }

      const inClause = selectedOptions
        .map((code) => `'${code.trim()}'`)
        .join(",");

      try {
        const [tableRecords] = await Promise.all([
          mssql.query(`
            USE [${rtweb}];
            SELECT   
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
              PRODUCT_CODE,
              PRODUCT_NAME,
              SUM(COSTPRICE) AS COSTPRICE,
              SUM(UNITPRICE) AS UNITPRICE,
              SUM(DISCOUNT) AS DISCOUNT,
              SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause}) AND DEPTCODE = ${code}
            GROUP BY PRODUCT_CODE,
              PRODUCT_NAME, SERIALNO`),
        ]);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          records: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching department data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch department data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in departmentDashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load department dashboard" });
  }
};

//color size sales category dashboard
exports.colorSizeSalesCategory = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",");
      }

      const inClause = selectedOptions
        .map((code) => `'${code.trim()}'`)
        .join(",");

      try {
        const [tableRecords] = await Promise.all([
          mssql.query(`
            USE [${rtweb}];
            SELECT   
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
              PRODUCT_CODE,
              PRODUCT_NAME,
              SUM(COSTPRICE) AS COSTPRICE,
              SUM(UNITPRICE) AS UNITPRICE,
              SUM(DISCOUNT) AS DISCOUNT,
              SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause}) AND CATCODE = ${code}
            GROUP BY PRODUCT_CODE,
              PRODUCT_NAME, SERIALNO`),
        ]);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          records: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching category data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch category data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in categoryDashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load category dashboard" });
  }
};

//color size sales category dashboard
exports.colorSizeSalesSubCategory = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",");
      }

      const inClause = selectedOptions
        .map((code) => `'${code.trim()}'`)
        .join(",");

      try {
        const [tableRecords] = await Promise.all([
          mssql.query(`
            USE [${rtweb}];
            SELECT   
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
              PRODUCT_CODE,
              PRODUCT_NAME,
              SUM(COSTPRICE) AS COSTPRICE,
              SUM(UNITPRICE) AS UNITPRICE,
              SUM(DISCOUNT) AS DISCOUNT,
              SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause}) AND SCATCODE = ${code}
            GROUP BY PRODUCT_CODE,
              PRODUCT_NAME, SERIALNO`),
        ]);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          records: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching sub category data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch sub category data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in sub category Dashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load sub category dashboard" });
  }
};

//color size sales vendor dashboard
exports.colorSizeSalesVendor = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",");
      }

      const inClause = selectedOptions
        .map((code) => `'${code.trim()}'`)
        .join(",");

      try {
        const [tableRecords] = await Promise.all([
          mssql.query(`
            USE [${rtweb}];
            SELECT   
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
              PRODUCT_CODE,
              PRODUCT_NAME,
              SUM(COSTPRICE) AS COSTPRICE,
              SUM(UNITPRICE) AS UNITPRICE,
              SUM(DISCOUNT) AS DISCOUNT,
              SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause}) AND VENDORCODE = ${code}
            GROUP BY PRODUCT_CODE,
              PRODUCT_NAME, SERIALNO`),
        ]);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          records: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching sub category data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch sub category data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in sub category Dashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load sub category dashboard" });
  }
};

//color size stock product dashboard data
exports.colorSizeStockProductDashboard = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    // -------------------------
    // 2️⃣ Verify Token
    // -------------------------
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      let { currentDate, date, state, selectedOptions } = req.query;

      // Convert selectedOptions to array if it's a string
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      // Format dates
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);

      // Create request instance
      const request = new mssql.Request();

      // -------------------------
      // 3️⃣ Build Query to Create View
      // -------------------------
      let query;

      if (formattedCurrentDate === formattedDate) {
        query = `
          USE ${rtweb};
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE (BIN = ''F'') OR (BIN IS NULL)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      } else {
        query = `
          USE ${rtweb};
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE ((BIN = ''F'') OR (BIN IS NULL))
              AND S.DATE <= ''${formattedDate}''
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      }

      // -------------------------
      // 4️⃣ Execute View Update
      // -------------------------
      let result;
      try {
        result = await request.query(query);
      } catch (error) {
        console.error("Error updating view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      if (!result) {
        return res
          .status(403)
          .json({ message: "Error occurred in view updating" });
      }

      // -------------------------
      // 5️⃣ Fetch Table Records
      // -------------------------
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");

      let tableRecords;
      try {
        if(state){
          tableRecords = await mssql.query(`
                           USE [${rtweb}];
                            SELECT   
                              LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
                              LTRIM(RTRIM(PRODUCT_CODE)) AS PRODUCT_CODE,
                              PRODUCT_NAMELONG AS PRODUCT_NAME,
                              SUM(QTY) AS QUANTITY,
                              SUM(QTY * COSTPRICE) AS COST_VALUE,
                              SUM(QTY * SCALEPRICE) AS SALES_VALUE,
                              COSTPRICE,
                              SCALEPRICE
                            FROM [${rtweb}].dbo.vw_STOCK_BALANCE
                            WHERE COMPANY_CODE IN (${inClause})
                            GROUP BY COMPANY_CODE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE
                          `);
        }
        else{
        tableRecords = await mssql.query(`
                            USE [${rtweb}];
                            SELECT   
                              LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
                              LTRIM(RTRIM(PRODUCT_CODE)) AS PRODUCT_CODE,
                              PRODUCT_NAMELONG AS PRODUCT_NAME,
                              SUM(QTY) AS QUANTITY,
                              COSTPRICE,
                              SCALEPRICE
                            FROM [${rtweb}].dbo.vw_STOCK_BALANCE
                            WHERE COMPANY_CODE IN (${inClause})
                            GROUP BY COMPANY_CODE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE
                          `);
        }
        

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          tableRecords: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching product data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch product data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in productDashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load product dashboard" });
  }
};

// sales scan
exports.scan = async (req, res) => {
  const codeData = req.query.data?.trim();
  const company = req.query.company?.trim();
  const name = req.query.name?.trim();

  if ((!codeData || codeData === "No result") && !name) {
    return res.status(400).json({
      message: "Please provide a valid barcode or product code or name",
    });
  }

  if (!company) {
    return res.status(400).json({ message: "Company code is required" });
  }

  try {
    let productCode = null;
    let stockQty;
    let salesData = [];
    let colorWiseData = [];
    let status = "F";
    let foundCode = null;
    let colorwiseActive = false;

    const colorSizeQuery = `
      SELECT COLORSIZE_ACTIVE FROM [${rtweb}].dbo.tb_COMPANY WHERE MAIN = 'T';
    `;
    const colorSize = await mssql.query(colorSizeQuery);
    if (colorSize.recordset.length > 0) {
      status = colorSize.recordset[0].COLORSIZE_ACTIVE;
    }

    if (status === "T") {
      if (codeData && codeData !== "No result") {
        const barcodeQuery = `
          SELECT PRODUCT_CODE FROM [${posback}].dbo.tb_STOCKRELOAD WHERE SERIALNO = @serial;
        `;
        const request = new mssql.Request();
        request.input("serial", codeData);
        const barcodeResult = await request.query(barcodeQuery);
        if (barcodeResult.recordset.length > 0) {
          productCode = barcodeResult.recordset[0].PRODUCT_CODE;
        }

        // If not found in barcode link, use product table directly
        const productQuery = productCode
          ? `
              SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
              FROM [${posback}].dbo.tb_PRODUCT WHERE PRODUCT_CODE = @code;`
          : `
              SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
              FROM [${posback}].dbo.tb_PRODUCT 
              WHERE PRODUCT_CODE = @code OR BARCODE = @code OR BARCODE2 = @code;`;

        const productRequest = new mssql.Request();
        productRequest.input("code", productCode || codeData);
        QueryData = await productRequest.query(productQuery);
        salesData = QueryData.recordset;

        if (!salesData || salesData.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        foundCode = salesData[0].PRODUCT_CODE;

        const stockQuery = `
        USE [${posback}];
        SELECT ISNULL(SUM(STOCK), 0) AS STOCK 
        FROM tb_STOCK 
        WHERE COMPANY_CODE = '${company}' 
          AND (BIN = 'F' OR BIN IS NULL) 
          AND PRODUCT_CODE = '${foundCode}';
      `;
        const stockResult = await mssql.query(stockQuery);
        stockQty = stockResult.recordset[0]?.STOCK ?? 0;
      }

      if (name && name !== "") {
        const productQuery = `
        USE [${posback}];
        SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
        FROM tb_PRODUCT 
        WHERE PRODUCT_NAMELONG = '${name}';
      `;
        const salesDataResult = await mssql.query(productQuery);
        salesData = salesDataResult.recordset;

        if (!salesData || salesData.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        foundCode = salesData[0].PRODUCT_CODE;

        const stockQuery = `
        USE [${posback}];
        SELECT ISNULL(SUM(STOCK), 0) AS STOCK 
        FROM tb_STOCK 
        WHERE COMPANY_CODE = '${company}' 
          AND (BIN = 'F' OR BIN IS NULL) 
          AND PRODUCT_CODE = '${foundCode}';
      `;
        const stockResult = await mssql.query(stockQuery);
        stockQty = stockResult.recordset[0]?.STOCK ?? 0;

        const codeQuery = `
          USE [${posback}];
          SELECT PRODUCT_CODE FROM tb_STOCKRELOAD WHERE PRODUCT_NAME = '${name}';
        `;
        const PCode = await mssql.query(codeQuery);

        if (PCode.recordset && PCode.recordset.length > 0) {
          productCode = PCode.recordset[0].PRODUCT_CODE;
        }
      }

      if (productCode !== "" || foundCode !== "") {
        const code = productCode ? productCode : foundCode;
        const colorSizeQuery = `
          USE [${posback}];
          SELECT SERIALNO, COLORCODE, SIZECODE, 0 AS STOCK 
          FROM tb_STOCKRELOAD 
          WHERE SERIALNO <> '' AND PRODUCT_CODE = '${code}';
        `;
        const colorSizeData = await mssql.query(colorSizeQuery);
        colorWiseData = colorSizeData.recordset;
        colorwiseActive = true;
      }
    } else {
      if (codeData && codeData !== "No result") {
        // Try finding a product code via barcode link table
        const query = `
        USE [${posback}];
        SELECT PRODUCT_CODE FROM tb_BARCODELINK WHERE BARCODE = '${codeData}';
      `;
        const barcodeResult = await mssql.query(query);

        if (barcodeResult.recordset.length > 0) {
          productCode = barcodeResult.recordset[0].PRODUCT_CODE;
        }

        // If not found in barcode link, use product table directly
        const productQuery = productCode
          ? `
          USE [${posback}];
          SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
          FROM tb_PRODUCT WHERE PRODUCT_CODE = '${productCode}';
        `
          : `
          USE [${posback}];
          SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
          FROM tb_PRODUCT 
          WHERE PRODUCT_CODE = '${codeData}' OR BARCODE = '${codeData}' OR BARCODE2 = '${codeData}';
        `;

        const salesDataResult = await mssql.query(productQuery);
        salesData = salesDataResult.recordset;

        if (!salesData || salesData.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        foundCode = salesData[0].PRODUCT_CODE;

        const stockQuery = `
        USE [${posback}];
        SELECT ISNULL(SUM(STOCK), 0) AS STOCK 
        FROM tb_STOCK 
        WHERE COMPANY_CODE = '${company}' 
          AND (BIN = 'F' OR BIN IS NULL) 
          AND PRODUCT_CODE = '${foundCode}';
      `;
        const stockResult = await mssql.query(stockQuery);
        stockQty = stockResult.recordset[0]?.STOCK ?? 0;
      }

      if (name && name !== "") {
        const productQuery = `
        USE [${posback}];
        SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
        FROM tb_PRODUCT 
        WHERE PRODUCT_NAMELONG = '${name}';
      `;
        const salesDataResult = await mssql.query(productQuery);
        salesData = salesDataResult.recordset;

        if (!salesData || salesData.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        foundCode = salesData[0].PRODUCT_CODE;

        const stockQuery = `
        USE [${posback}];
        SELECT ISNULL(SUM(STOCK), 0) AS STOCK 
        FROM tb_STOCK 
        WHERE COMPANY_CODE = '${company}' 
          AND (BIN = 'F' OR BIN IS NULL) 
          AND PRODUCT_CODE = '${foundCode}';
      `;
        const stockResult = await mssql.query(stockQuery);
        stockQty = stockResult.recordset[0]?.STOCK ?? 0;
      }
    }

    return res.status(200).json({
      message: "Item Found Successfully",
      salesData: salesData,
      amount: stockQty,
      colorWiseData,
      colorwiseActive,
    });
  } catch (error) {
    console.error("Error retrieving barcode data:", error);
    return res.status(500).json({ message: "Failed to scan data" });
  }
};

// product view
exports.productView = async (req, res) => {
  const codeData = req.query.data?.trim();
  const name = req.query.inputValue?.trim();
  const mode = req.query.mode?.trim();

  if ((!codeData || codeData === "No result") && !name) {
    return res.status(400).json({
      message: "Please provide a valid barcode or product code or name",
    });
  }

  // ✅ Helper function to execute SQL queries
  const execQuery = async (query, params = {}) => {
    const request = new mssql.Request();
    Object.entries(params).forEach(([key, value]) => request.input(key, value));
    return request.query(query);
  };

  try {
    let productCode = null;
    let result = null;
    let status = "F";

    // ✅ Check COLORSIZE status
    const colorSize = await execQuery(
      `SELECT COLORSIZE_ACTIVE FROM [${rtweb}].dbo.tb_COMPANY WHERE MAIN = 'T';`
    );
    if (colorSize.recordset.length > 0) {
      status = colorSize.recordset[0].COLORSIZE_ACTIVE;
    }

    // ✅ Step 1: Find product code based on barcode or name
    if (codeData && codeData !== "No result") {
      const tableName = status === "T" ? "tb_STOCKRELOAD" : "tb_BARCODELINK";
      const column = status === "T" ? "SERIALNO" : "BARCODE";

      const barcodeResult = await execQuery(
        `SELECT PRODUCT_CODE FROM [${posback}].dbo.${tableName} WHERE ${column} = @code;`,
        { code: codeData }
      );
      if (barcodeResult.recordset.length > 0) {
        productCode = barcodeResult.recordset[0].PRODUCT_CODE;
      }

      const productQueryText = productCode
        ? `SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
           FROM [${posback}].dbo.tb_PRODUCT WHERE PRODUCT_CODE = @code;`
        : `SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
           FROM [${posback}].dbo.tb_PRODUCT 
           WHERE PRODUCT_CODE = @code OR BARCODE = @code OR BARCODE2 = @code;`;

      const productData = await execQuery(productQueryText, { code: productCode || codeData });
      if (productData.recordset.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }

      productCode = productData.recordset[0].PRODUCT_CODE;
    } else if (name) {
      const productData = await execQuery(
        `SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
         FROM [${posback}].dbo.tb_PRODUCT 
         WHERE PRODUCT_NAMELONG = @name`,
        { name }
      );
      if (productData.recordset.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      productCode = productData.recordset[0].PRODUCT_CODE;
    }

    // ✅ Step 2: Get full product details
    const productDetails = await execQuery(
      `SELECT 
          P.PRODUCT_CODE, P.BARCODE, P.BARCODE2, P.PRODUCT_NAMELONG, 
          P.DEPTCODE, D.DEPTNAME, P.CATCODE, C.CATNAME, 
          P.SCATCODE, S.SCATNAME, P.VENDORCODE, V.VENDORNAME,
          P.COSTPRICE, P.MINPRICE, P.AVGCOST, P.SCALEPRICE, 
          P.WPRICE, P.PRICE1, P.PRICE2, P.PRICE3
       FROM [${posback}].dbo.tb_PRODUCT P
       LEFT JOIN [${posback}].dbo.tb_DEPARTMENT D ON P.DEPTCODE = D.DEPTCODE
       LEFT JOIN [${posback}].dbo.tb_CATEGORY C ON P.CATCODE = C.CATCODE
       LEFT JOIN [${posback}].dbo.tb_SUBCATEGORY S ON P.SCATCODE = S.SCATCODE
       LEFT JOIN [${posback}].dbo.tb_VENDOR V ON P.VENDORCODE = V.VENDORCODE
       WHERE P.PRODUCT_CODE = @code`,
      { code: productCode }
    );
    result = productDetails.recordset[0];

    if (!result) {
      return res.status(404).json({ message: "Product not found" });
    }

    // ✅ Step 3: Recreate stock view
    await execQuery(`
      USE ${rtweb};
      IF OBJECT_ID('dbo.vw_STOCK', 'V') IS NOT NULL
          DROP VIEW dbo.vw_STOCK;
      EXEC('CREATE VIEW dbo.vw_STOCK AS 
        SELECT PRODUCT_CODE, COMPANY_CODE, ISNULL(SUM(STOCK), 0) AS QTY
        FROM ${posback}.dbo.tb_STOCK
        WHERE (BIN = ''F'') OR (BIN IS NULL)
        GROUP BY COMPANY_CODE, PRODUCT_CODE;');
    `);

    const stockQty = await execQuery(
      `SELECT * FROM [${rtweb}].dbo.vw_STOCK WHERE PRODUCT_CODE = @code;`,
      { code: productCode }
    );
    const companyCodes = stockQty.recordset.map((row) => row.COMPANY_CODE);

    // ✅ Step 4: Recreate price view
    await execQuery(`
      USE ${rtweb};
      IF OBJECT_ID('dbo.vw_PRICE_DETAILS', 'V') IS NOT NULL
          DROP VIEW dbo.vw_PRICE_DETAILS;
      EXEC('CREATE VIEW dbo.vw_PRICE_DETAILS AS 
        SELECT PRODUCT_CODE, COMPANY_CODE, COST_PRICE, UNIT_PRICE, WPRICE, MIN_PRICE
        FROM ${posback}.dbo.tb_PRICEDETAILS;');
    `);

    const priceDetails = await execQuery(
      `SELECT * FROM [${rtweb}].dbo.vw_PRICE_DETAILS WHERE PRODUCT_CODE = @code;`,
      { code: productCode }
    );

    // ✅ Step 5: Company-wise stock
    const companyWiseStock = await execQuery(
      `SELECT COMPANY_CODE, SUM(STOCK) AS STOCK
       FROM ${posback}.dbo.tb_STOCK
       WHERE (BIN = 'F' OR BIN IS NULL) AND PRODUCT_CODE = @code
       GROUP BY COMPANY_CODE`,
      { code: productCode }
    );

    let companies = [];
    if (companyCodes.length > 0) {
      const formattedCodes = companyCodes.map((c) => `'${c.trim()}'`).join(", ");
      const companyNames = await execQuery(`
        SELECT COMPANY_CODE, COMPANY_NAME 
        FROM ${posback}.dbo.tb_COMPANY 
        WHERE COMPANY_CODE IN (${formattedCodes})
      `);
      companies = companyNames.recordset;
    }

    // ✅ Step 6: Color-wise stock data (only if COLORSIZE = T)
    let colorWiseData = [];
    if (status === "T") {
      const codeValue = mode === "scan" ? codeData : productCode;

      const colorResult = await execQuery(
        `SELECT COMPANY_CODE, PRODUCT_CODE, SERIALNO, MAX(COLORCODE) AS COLORCODE, MAX(SIZECODE) AS SIZECODE,
                SUM(STOCK) AS STOCK
         FROM [${posback}].dbo.tb_STOCK
         WHERE SERIALNO <> '' AND PRODUCT_CODE = @product_code AND (BIN = 'F' OR BIN IS NULL)
         GROUP BY COMPANY_CODE, PRODUCT_CODE, SERIALNO`,
        { product_code: codeValue }
      );
      colorWiseData = colorResult.recordset;
    }

    return res.status(200).json({
      message: "Item Found Successfully",
      result,
      prices: priceDetails.recordset || [],
      stockData: stockQty.recordset || [],
      companies,
      companyStockData: companyWiseStock.recordset || [],
      colorWiseData: colorWiseData || [],
    });
  } catch (error) {
    console.error("Error retrieving barcode data:", error);
    return res.status(500).json({ message: "Failed to fetch product view data" });
  }
};

// product view page sales
exports.productViewSales = async (req, res) => {
  const code = req.query.code?.trim();
  const fromDate = formatDate(req.query.fromDate?.trim());
  const toDate = formatDate(req.query.toDate?.trim());

  if (!code || fromDate === "" || toDate === "") {
    return res.status(400).json({
      message: "Please provide a from date and to date",
    });
  }

  try {
    const salesQuery = `
          USE [${posback}];
          SELECT SALESDATE, COMPANY_CODE, PRODUCT_CODE, COST_PRICE, UNIT_PRICE, SUM(QTY) AS QTY, 
          SUM(DISCOUNT) AS DISCOUNT, SUM(AMOUNT) AS AMOUNT FROM tb_SALES
          WHERE CONVERT(DATETIME,SALESDATE,103)>= CONVERT(DATETIME,@from,103) AND 
          CONVERT(DATETIME,SALESDATE,103) <= CONVERT(DATETIME,@to,103) AND PRODUCT_CODE = @code
          GROUP BY SALESDATE, COMPANY_CODE, PRODUCT_CODE, COST_PRICE, UNIT_PRICE
         `;

    const salesRequest = new mssql.Request();
    salesRequest.input("from", fromDate);
    salesRequest.input("to", toDate);
    salesRequest.input("code", code);
    const sales = await salesRequest.query(salesQuery);
    const salesData = sales.recordset;

    return res.status(200).json({
      message: "Item Found Successfully",
      salesData: salesData || [],
    });
  } catch (error) {
    console.error("Error retrieving barcode data:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch product view data" });
  }
};

// stock update
exports.stockUpdate = async (req, res) => {
  const { code, selectedType } = req.query;

  if (!code || !selectedType) {
    return res.status(400).json({
      message: "Missing required query parameters: name and/or code",
    });
  }

  const company = String(code).trim();
  const type = String(selectedType).trim();

  try {
    await mssql.query(`USE [${rtweb}];`); // ✅ Explicit DB switch

    let query;
    if (type === "STOCK") {
      query = `
        SELECT IDX, COMPANY_CODE, TYPE, COUNT_STATUS, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE,
          CUR_STOCK, PHY_STOCK, REPUSER, SERIALNO, COLORCODE, SIZECODE
        FROM tb_STOCKRECONCILATION_DATAENTRYTEMP 
        WHERE COMPANY_CODE = @company AND TYPE = 'STK';
      `;
    } else if (type === "GRN") {
      query = `
        SELECT IDX, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE,
          CUR_STOCK, PHY_STOCK, REPUSER, SERIALNO, COLORCODE, SIZECODE
        FROM tb_GRN_TEMP 
        WHERE COMPANY_CODE = @company AND TYPE = 'GRN';
      `;
    } else if (type === "PRN") {
      query = `
        SELECT IDX, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE,
          CUR_STOCK, PHY_STOCK, REPUSER, SERIALNO, COLORCODE, SIZECODE
        FROM tb_PRN_TEMP 
        WHERE COMPANY_CODE = @company AND TYPE = 'PRN';
      `;
    } else if (type === "TOG") {
      query = `
        SELECT IDX, COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, 
          COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER, SERIALNO, COLORCODE, SIZECODE
        FROM tb_TOG_TEMP 
        WHERE COMPANY_CODE = @company AND TYPE = 'TOG';
      `;
    } else {
      return res.status(400).json({ message: "Invalid stock type provided" });
    }
    const pool = await connectToDatabase();
    const request = pool.request();
    request.input("company", mssql.NChar(10), company);

    const stockData = await request.query(query);

    const records = stockData.recordset;

    if (!records || records.length === 0) {
      return res.status(404).json({ message: "Stock data not found" });
    }

    return res.status(200).json({
      message: "Stock data Found Successfully",
      stockData: records,
    });
  } catch (error) {
    console.error("Error retrieving stock data:", error);
    return res.status(500).json({ message: "Failed to retrieve stock data" });
  }
};

// GRN/PRN/TOG table for scan page
exports.grnprnTableData = async (req, res) => {
  const { name, code, selectedType } = req.query;

  if (!name || !code) {
    return res
      .status(400)
      .json({ message: "Missing required query parameters: name and/or code" });
  }

  const username = String(name).trim();
  const company = String(code).trim();

  try {
    const pool = await mssql.connect(); // Use global pool or connect function

    let query = `USE [${rtweb}];\n`;

    if (selectedType === "GRN") {
      query += `
        SELECT IDX, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, REPUSER
        FROM tb_GRN_TEMP 
        WHERE TYPE = 'GRN' AND REPUSER = '${username}' AND COMPANY_CODE = '${company}';
      `;
    } else if (selectedType === "PRN") {
      query += `
        SELECT IDX, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, REPUSER
        FROM tb_PRN_TEMP 
        WHERE TYPE = 'PRN' AND REPUSER = '${username}' AND COMPANY_CODE = '${company}';
      `;
    } else if (selectedType === "TOG") {
      query += `
        SELECT IDX, COMPANY_CODE, COMPANY_TO_CODE, REPUSER
        FROM tb_TOG_TEMP 
        WHERE TYPE = 'TOG' AND REPUSER = '${username}' AND COMPANY_CODE = '${company}';
      `;
    } else {
      return res.status(400).json({ message: "Invalid selectedType" });
    }

    const result = await pool.request().query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "No GRN/PRN/TOG data found" });
    }

    return res.status(200).json({
      message: "Data Found Successfully",
      tableData: result.recordset,
    });
  } catch (error) {
    console.error("Error retrieving GRN/PRN/TOG data:", error);
    return res.status(500).json({ message: "Failed to retrieve data" });
  }
};

//sync db
exports.syncDatabases = async (req, res) => {
  try {
    const responses = await syncDB();

    if (
      Array.isArray(responses.responses) &&
      responses.responses[0]?.returnStatus === "Success"
    ) {
      const updateTableResult = await updateTables();
      return res.status(200).json({
        success: true,
        message: "Database sync completed successfully.",
        syncDetails: responses.responses,
        updateDetails: updateTableResult,
        errors: responses.errors || [],
      });
    } else {
      return res.status(207).json({
        success: false,
        message: "Partial or full sync failure.",
        syncDetails: responses.responses,
        errors: responses.errors,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to start database sync.",
      syncDetails: [],
      errors: [error.message],
    });
  }
};

// product name
exports.productName = async (req, res) => {
  try {
    // Try finding a product code via barcode link table
    const query = `
  USE [${posback}];
  SELECT PRODUCT_NAMELONG FROM tb_PRODUCT;
`;

    const productNames = await new mssql.Request().query(query);

    const productNamesData = productNames.recordset;
    if (!productNamesData || productNamesData.length === 0) {
      return res.status(404).json({ message: "Product names not found" });
    }

    return res.status(200).json({
      message: "Product names found",
      names: productNamesData,
    });
  } catch (error) {
    console.error("Error retrieving barcode data:", error);
    return res
      .status(500)
      .json({ message: "Failed to retrieve product names" });
  }
};

// Get user connection details
exports.findUserConnection = async (req, res) => {
  const name = req.query.name;

  if (!name || typeof name !== 'string') {
    return res
      .status(400)
      .json({ message: 'Invalid or missing username parameter' });
  }

  try {
    // Validate JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: 'No authorization token provided' });
    }
    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    try {
      jwt.verify(token, process.env.JWT_SECRET); // Verify token with secret
    } catch (jwtError) {
      console.error('Invalid token:', jwtError);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Get the connection pool
   const pool = await connectToDatabase();

    // Define posmain (e.g., from query parameter, body, or environment variable)
    const posmain = req.query.posmain || process.env.DB_DATABASE1 || 'your_default_database';
    if (!posmain) {
      return res.status(400).json({ message: 'Database name (posmain) is required' });
    }

    // Sanitize posmain to prevent SQL injection
    if (!/^[a-zA-Z0-9_]+$/.test(posmain)) {
      return res.status(400).json({ message: 'Invalid database name' });
    }

    const query = `
      USE [${posmain}];
      SELECT 
        u.[ip_address], 
        u.[port], 
        u.[CUSTOMERID], 
        u.[a_permission], 
        u.[a_sync], 
        u.[d_company], 
        u.[d_department], 
        u.[d_category], 
        u.[d_scategory], 
        u.[d_vendor], 
        u.[d_invoice],
        u.[d_productView], 
        u.[t_scan], 
        u.[t_stock], 
        u.[t_grn], 
        u.[t_prn], 
        u.[t_tog],
        u.[t_stock_update],
        u.[c_st_product_wise],
        u.[c_st_department],
        u.[c_st_category],
        u.[c_st_scategory],
        u.[c_st_vendor],
        u.[c_sa_product_wise],
        u.[c_sa_department], 
        u.[c_sa_category], 
        u.[c_sa_scategory],
        u.[c_sa_vendor],
        s.[COMPANY_NAME],
        s.[START_DATE],
        s.[END_DATE]
      FROM tb_USERS u
      LEFT JOIN tb_SERVER_DETAILS s
        ON u.CUSTOMERID = s.CUSTOMERID 
      WHERE u.username = @username;
    `;

    const request = pool.request(); // Use pool.request() instead of new mssql.Request()
    request.input('username', mssql.VarChar, name);

    const userPermissionResult = await request.query(query);

    if (userPermissionResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ message: 'User details not found for the given username' });
    }

    res.status(200).json({
      message: 'User permission data retrieved successfully',
      userData: userPermissionResult.recordset,
    });
  } catch (error) {
    console.error('Error retrieving user permission data:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
    });
    res.status(500).json({
      message: 'Failed to retrieve user permission data',
      error: error.message,
    });
  }
};

//reset database connection
exports.resetDatabaseConnection = async (req, res) => {
  const {
    name,
    ip = '',
    port = '',
    username = '',
    companyName = '',
    startDate = '',
    endDate = '',
    customerID = '',
    newCustomerID = '',
    admin = [],
    dashboard = [],
    stock = [],
    colorSize_stock = [],
    colorSize_sales = [],
    removeAdmin = [],
    removeDashboard = [],
    removeStock = [],
  } = req.body;

  const trimmedName = name?.trim();
  const trimmedIP = ip?.trim();
  const trimmedPort = port?.trim();

  let pool;
  let transaction;

  try {
    // Auth validation
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ message: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(403).json({ message: 'Token is missing' });
    }

    jwt.verify(token, process.env.JWT_SECRET);
    console.log('JWT verified');

    // Input validation
    if (!trimmedName || typeof trimmedName !== 'string') {
      return res.status(400).json({ message: 'Invalid or missing name' });
    }
    if (trimmedIP && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmedIP)) {
      return res.status(400).json({ message: 'Invalid IP address format' });
    }
    if (trimmedPort && !/^\d+$/.test(trimmedPort)) {
      return res.status(400).json({ message: 'Invalid port' });
    }
    if (username && typeof username !== 'string') {
      return res.status(400).json({ message: 'Invalid username' });
    }
    if (companyName && typeof companyName !== 'string') {
      return res.status(400).json({ message: 'Invalid company name' });
    }
    if (startDate && isNaN(Date.parse(startDate))) {
      return res.status(400).json({ message: 'Invalid start date' });
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      return res.status(400).json({ message: 'Invalid end date' });
    }
    console.log('Input validation passed');

    // Validate customerID and newCustomerID
    const parsedCustomerID = Number(customerID);
    const parsedNewCustomerID = Number(newCustomerID) === 0? Number(customerID): Number(newCustomerID);
    const isValidCustomerID = Number.isInteger(parsedCustomerID) && parsedCustomerID !== 0;
    const isValidNewCustomerID = Number.isInteger(parsedNewCustomerID) && parsedNewCustomerID !== 0;
    console.log('customerID validation', { parsedCustomerID, parsedNewCustomerID });

    // Connect to the database
    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE1,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      port: 1433, // Adjust to 1443 if required
      connectionTimeout: 30000,
      requestTimeout: 30000,
    };
    console.log('Connecting to database');

    pool = await mssql.connect(config);
    console.log('Database connected');
    transaction = new mssql.Transaction(pool);
    await transaction.begin();
    console.log('Transaction started');

    let userResult;
    let serverResult;

    const checkRequest = new mssql.Request(transaction);
  checkRequest.input('newCustomerID', mssql.Int, parsedNewCustomerID);
  const checkResult = await checkRequest.query(`SELECT * FROM tb_SERVER_DETAILS WHERE CUSTOMERID = @newCustomerID`);

    // Case 1: Invalid customerID 
    if (customerID === 0 || customerID === '' || customerID === null || customerID === undefined) {
      if (!isValidNewCustomerID) {
        return res.status(400).json({ message: 'New CustomerID must be a non-zero integer' });
      }
      
      const serverRequest = new mssql.Request(transaction);
      serverRequest.input('newCustomerID', mssql.Int, parsedNewCustomerID);
      serverRequest.input('companyName', mssql.NVarChar(50), companyName || '');
      serverRequest.input('trimmedIP', mssql.NVarChar(50), trimmedIP || '');
      serverRequest.input('startDate', mssql.Date, startDate ? new Date(startDate) : '');
      serverRequest.input('endDate', mssql.Date, endDate ? new Date(endDate) : '');

      console.log('dates',new Date(checkResult.recordset[0].START_DATE).toISOString().split('T')[0] ,
 new Date(startDate).toISOString().split('T')[0] ,
  new Date(checkResult.recordset[0].END_DATE).toISOString().split('T')[0] ,
   new Date(endDate).toISOString().split('T')[0])

       if (checkResult.recordset.length === 0) {
        serverResult = await serverRequest.query(`
        INSERT INTO tb_SERVER_DETAILS (CUSTOMERID, COMPANY_NAME, SERVERIP, START_DATE, END_DATE)
        VALUES (@newCustomerID, @companyName, @trimmedIP, @startDate, @endDate);
        `);
        console.log('tb_SERVER_DETAILS inserted', serverResult.rowsAffected);
       }

       else if(checkResult.recordset[0].COMPANY_NAME !== companyName ){
        console.log('Company name mismatch in tb_SERVER_DETAILS');
        return res.status(400).json({ message: 'Customer ID already exist for a different company name' });
       }

       
       else if (
  checkResult.recordset[0].SERVERIP !== trimmedIP ||
  new Date(checkResult.recordset[0].START_DATE).toISOString().split('T')[0] !== new Date(startDate).toISOString().split('T')[0] ||
  new Date(checkResult.recordset[0].END_DATE).toISOString().split('T')[0] !== new Date(endDate).toISOString().split('T')[0]
)
{
        serverResult = await serverRequest.query(`
        UPDATE tb_SERVER_DETAILS
          SET 
              SERVERIP = @trimmedIP,
              START_DATE = @startDate,
              END_DATE = @endDate
          WHERE 
              CUSTOMERID = @newCustomerID;
          ;
      `);
       }
       

      console.log('Executing Case 1 - Update tb_USERS and insert tb_SERVER_DETAILS');
      const userRequest = new mssql.Request(transaction);
      userRequest.input('newCustomerID', mssql.Int, parsedNewCustomerID);
      userRequest.input('trimmedIP', mssql.VarChar(20), trimmedIP || null);
      userRequest.input('trimmedPort', mssql.VarChar(10), trimmedPort || null);
      userRequest.input('username', mssql.VarChar(20), username || null);
      userRequest.input('trimmedName', mssql.VarChar(50), trimmedName);

      userResult = await userRequest.query(`
        UPDATE tb_USERS 
        SET CUSTOMERID = @newCustomerID, ip_address = @trimmedIP, port = @trimmedPort, registered_by = @username
        WHERE username = @trimmedName;
      `);
      console.log('tb_USERS updated', userResult.rowsAffected);

      
    }
    // Case 2: Valid customerID and newCustomerID, and they are equal
    else if (isValidCustomerID && isValidNewCustomerID && parsedCustomerID === parsedNewCustomerID) {
      console.log('Executing Case 2 - Update tb_USERS and tb_SERVER_DETAILS (same CUSTOMERID)');
      const userRequest = new mssql.Request(transaction);
      userRequest.input('trimmedIP', mssql.VarChar(20), trimmedIP || null);
      userRequest.input('trimmedPort', mssql.VarChar(10), trimmedPort || null);
      userRequest.input('trimmedName', mssql.VarChar(50), trimmedName);

      userResult = await userRequest.query(`
        UPDATE tb_USERS 
        SET ip_address = @trimmedIP, port = @trimmedPort
        WHERE username = @trimmedName;
      `);
      console.log('tb_USERS updated', userResult.rowsAffected);

      const serverRequest = new mssql.Request(transaction);
      serverRequest.input('companyName', mssql.NVarChar(50), companyName || null);
      serverRequest.input('trimmedIP', mssql.NVarChar(50), trimmedIP || null);
      serverRequest.input('startDate', mssql.Date, startDate ? new Date(startDate) : null);
      serverRequest.input('endDate', mssql.Date, endDate ? new Date(endDate) : null);
      serverRequest.input('customerID', mssql.Int, parsedCustomerID);

      serverResult = await serverRequest.query(`
        UPDATE tb_SERVER_DETAILS 
        SET COMPANY_NAME = @companyName, SERVERIP = @trimmedIP, START_DATE = @startDate, END_DATE = @endDate
        WHERE CUSTOMERID = @customerID;
      `);
      console.log('tb_SERVER_DETAILS updated', serverResult.rowsAffected);
    }
    // Case 3: Valid customerID and newCustomerID, but they are not equal
    else if (isValidCustomerID && isValidNewCustomerID && parsedCustomerID !== parsedNewCustomerID) {
      console.log('Executing Case 3 - Update tb_USERS and tb_SERVER_DETAILS (new CUSTOMERID)');
      const userRequest = new mssql.Request(transaction);
      userRequest.input('trimmedIP', mssql.VarChar(20), trimmedIP || null);
      userRequest.input('trimmedPort', mssql.VarChar(10), trimmedPort || null);
      userRequest.input('newCustomerID', mssql.Int, parsedNewCustomerID);
      userRequest.input('trimmedName', mssql.VarChar(50), trimmedName);

      userResult = await userRequest.query(`
        UPDATE tb_USERS 
        SET ip_address = @trimmedIP, port = @trimmedPort, CUSTOMERID = @newCustomerID
        WHERE username = @trimmedName;
      `);
      console.log('tb_USERS updated', userResult.rowsAffected);

      const serverRequest = new mssql.Request(transaction);
      serverRequest.input('companyName', mssql.NVarChar(50), companyName || null);
      serverRequest.input('trimmedIP', mssql.NVarChar(50), trimmedIP || null);
      serverRequest.input('newCustomerID', mssql.Int, parsedNewCustomerID);
      serverRequest.input('startDate', mssql.Date, startDate ? new Date(startDate) : null);
      serverRequest.input('endDate', mssql.Date, endDate ? new Date(endDate) : null);
      serverRequest.input('customerID', mssql.Int, parsedCustomerID);

      serverResult = await serverRequest.query(`
        UPDATE tb_SERVER_DETAILS 
        SET COMPANY_NAME = @companyName, SERVERIP = @trimmedIP, CUSTOMERID = @newCustomerID, 
            START_DATE = @startDate, END_DATE = @endDate
        WHERE CUSTOMERID = @customerID;
      `);
      console.log('tb_SERVER_DETAILS updated', serverResult.rowsAffected);
    } else {
      throw new Error('Invalid customerID or newCustomerID');
    }

    // Check if updates were successful
    if (userResult.rowsAffected[0] === 0) {
      throw new Error('Could not update the user table');
    }
    if (serverResult.rowsAffected[0] === 0) {
      throw new Error('Could not update or insert into the server details table');
    }
    console.log('Table updates successful');

    // Update permissions
    const updatePermissions = async (permissionArray, permissionType) => {
      if (!Array.isArray(permissionArray) || permissionArray.length === 0) {
        console.log(`Skipping ${permissionType} - empty or invalid array`);
        return;
      }

      // Whitelist of allowed columns (matches tb_USERS schema)
      const allowedColumns = [
        'a_permission',
        'a_sync',
        'd_company',
        'd_category',
        'd_department',
        'd_scategory',
        'd_vendor',
        'd_invoice',
        'd_productView',
        't_scan',
        't_stock',
        't_stock_update',
        't_grn',
        't_prn',
        't_tog',
        'c_st_product_wise',
        'c_st_department',
        'c_st_category',
        'c_st_scategory',
        'c_st_vendor',
        'c_sa_product_wise',
        'c_sa_department',
        'c_sa_category',
        'c_sa_scategory',
        'c_sa_vendor',
      ];

      for (const permissionObject of permissionArray) {
        console.log(`Processing ${permissionType}`, permissionObject);
        for (const column in permissionObject) {
          if (!allowedColumns.includes(column)) {
            console.log(`Skipping invalid column ${column} for ${permissionType}. Verify tb_USERS schema.`);
            continue;
          }

          const columnValue = permissionObject[column] ? 'T' : 'F';
          console.log('Updating permission', { column, columnValue, username: trimmedName });

          const request = new mssql.Request(transaction);
          request.input('value', mssql.Char(1), columnValue);
          request.input('registeredBy', mssql.VarChar(20), username || null);
          request.input('username', mssql.VarChar(50), trimmedName);

          try {
            const result = await request.query(`
              UPDATE tb_USERS 
              SET ${column} = @value, registered_by = @registeredBy
              WHERE username = @username;
            `);
            console.log('Permission updated', { column, rowsAffected: result.rowsAffected });

            if (result.rowsAffected[0] === 0) {
              console.log(`No rows affected for ${column} - user may not exist`);
            }
          } catch (err) {
            console.log(`Failed to update ${column} for ${permissionType}: ${err.message}`);
            throw err;
          }
        }
      }
    };

    // Remove permissions
    const removePermissions = async (permissionArray, permissionType) => {
      if (!Array.isArray(permissionArray) || permissionArray.length === 0) {
        console.log(`Skipping ${permissionType} removal - empty or invalid array`);
        return;
      }

      const allowedColumns = [
        'a_permission',
        'a_sync',
        'd_company',
        'd_category',
        'd_department',
        'd_scategory',
        'd_vendor',
        'd_invoice',
        'd_productView',
        't_scan',
        't_stock',
        't_stock_update',
        't_grn',
        't_prn',
        't_tog',
        'c_st_product_wise',
        'c_st_department',
        'c_st_category',
        'c_st_scategory',
        'c_st_vendor',
        'c_sa_product_wise',
        'c_sa_department',
        'c_sa_category',
        'c_sa_scategory',
        'c_sa_vendor',
      ];

      for (const permissionObject of permissionArray) {
        console.log(`Processing ${permissionType} removal`, permissionObject);
        for (const column in permissionObject) {
          if (!allowedColumns.includes(column)) {
            console.log(`Skipping invalid column ${column} for ${permissionType} removal. Verify tb_USERS schema.`);
            continue;
          }

          if (permissionObject[column]) {
            console.log('Removing permission', { column, username: trimmedName });
            const request = new mssql.Request(transaction);
            request.input('value', mssql.Char(1), 'F');
            request.input('registeredBy', mssql.VarChar(20), username || null);
            request.input('username', mssql.VarChar(50), trimmedName);

            try {
              const result = await request.query(`
                UPDATE tb_USERS 
                SET ${column} = @value, registered_by = @registeredBy
                WHERE username = @username;
              `);
              console.log('Permission removed', { column, rowsAffected: result.rowsAffected });

              if (result.rowsAffected[0] === 0) {
                console.log(`No rows affected for ${column} removal - user may not exist`);
              }
            } catch (err) {
              console.log(`Failed to remove ${column} for ${permissionType}: ${err.message}`);
              throw err;
            }
          }
        }
      }
    };

    console.log('Applying permission updates');
    await updatePermissions(admin, 'admin');
    await updatePermissions(dashboard, 'dashboard');
    await updatePermissions(stock, 'stock');
    await updatePermissions(colorSize_stock, 'colorSize_stock');
    await updatePermissions(colorSize_sales, 'colorSize_sales');

    console.log('Applying permission removals');
    await removePermissions(removeAdmin, 'admin');
    await removePermissions(removeDashboard, 'dashboard');
    await removePermissions(removeStock, 'stock');
    console.log('Permissions processed');

    // Check if nothing was sent
    const isEmptyOrAllFalse = (arr) => {
      return (
        !Array.isArray(arr) ||
        arr.length === 0 ||
        arr.every(
          (obj) =>
            typeof obj === 'object' &&
            Object.values(obj).every((value) => value === false)
        )
      );
    };

    const nothingToUpdate =
      !ip &&
      !port &&
      !customerID &&
      isEmptyOrAllFalse(admin) &&
      isEmptyOrAllFalse(dashboard) &&
      isEmptyOrAllFalse(stock) &&
      isEmptyOrAllFalse(colorSize_stock) &&
      isEmptyOrAllFalse(colorSize_sales) &&
      isEmptyOrAllFalse(removeAdmin) &&
      isEmptyOrAllFalse(removeDashboard) &&
      isEmptyOrAllFalse(removeStock);
    console.log('nothingToUpdate check', nothingToUpdate);

    if (nothingToUpdate) {
      throw new Error('Please provide details to update.');
    }

    await transaction.commit();
    console.log('Transaction committed');
    return res.status(200).json({ message: 'Database connection updated successfully' });
  } catch (err) {
    console.log('Error occurred', err);
    if (transaction) {
      console.log('Rolling back transaction');
      await transaction.rollback();
    }
    console.error('Error:', err);
    return res.status(500).json({ message: `Failed to update the database connection: ${err.message}` });
  } finally {
    if (pool) {
      console.log('Closing database connection');
      await pool.close();
    }
  }
};

//server connection details for admin page
exports.serverConnection = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }

      try {
        await mssql.close()

    await mssql.connect(dbConnection);

        const [tableRecords] = await Promise.all([
          mssql.query(`
            USE [${posmain}];
            SELECT   
            CUSTOMERID, COMPANY_NAME, SERVERIP, START_DATE, END_DATE
            FROM tb_SERVER_DETAILS`),
        ]);

        return res.status(200).json({
          message: "Details fetched successfully",
          success: true,
          records: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch data" });
      }
    
  } catch (error) {
    console.error("Unhandled error in Dashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load dashboard" });
  }
};