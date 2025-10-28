const { connectToDatabase } = require("../config/db");
const { connectToUserDatabase } = require("../config/userdb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const mssql = require("mssql");
const crypto = require("crypto");
const https = require("https");
const qs = require("qs");
// const nodemailer = require("nodemailer");
const { sendPasswordResetEmail } = require("../utils/nodemailer");
const { promisify } = require("util");
const verifyToken = promisify(jwt.verify);
const axios = require("axios");

const posback = process.env.DB_DATABASE3;
const rtweb = process.env.DB_DATABASE2;
const posmain = process.env.DB_DATABASE1;
// const port_number = 1443

// const dbConfig1 = {
//   user: process.env.DB_USER, // Database username
//   password: process.env.DB_PASSWORD, // Database password
//   server: process.env.DB_SERVER, // Database server address
//   database: process.env.DB_DATABASE1, // Database name
//   options: {
//     encrypt: false, // Disable encryption
//     trustServerCertificate: true, // Trust server certificate (useful for local databases)
//   },
//   port: port_number,
// };

// const dbConnection = (user_ip, user_port) => ({
//   user: process.env.DB_USER,
//       password: process.env.DB_PASSWORD,
//       server: user_ip.trim(),
//       database: process.env.DB_DATABASE2,     
//       port: parseInt(user_port.trim()),
//       options: {
//         encrypt: false,
//         trustServerCertificate: true,
//       },
//       connectionTimeout: 5000, // << timeout in ms
//       requestTimeout: 5000,
// });


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
    // await mssql.connect(dbConnection);
    await connectToDatabase()

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

        // const syncdbConfig = {
        //   user: process.env.DB_USER,
        //   password: process.env.DB_PASSWORD,
        //   server: syncdbIp,
        //   database: process.env.DB_DATABASE2,
        //   options: {
        //     encrypt: false,
        //     trustServerCertificate: true,
        //   },
        //   port: syncdbPort,
        // };

        const user_ip = (customer.IP).trim();      
        await connectToUserDatabase(user_ip, customer.PORT.trim());
        
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
      } catch (err) {
        const errMsg = `Database Connection Error for IP ${syncdbIp}: ${err.message}`;
        console.error(errMsg);
        errors.push(errMsg);
      }
      //       finally {
      //   await mssql.close();  // Close once after all work is done
      // }
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

//login
exports.login = async (req, res) => {
  if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
  let pool;
  
  try {
    pool = await connectToDatabase();
    if (!pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }

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

    const company_name = await pool
      .request()
      .input("ID", mssql.Numeric, CUSTOMERID)
      .query(
        `USE [${posmain}]; 
        SELECT COMPANY_NAME FROM tb_SERVER_DETAILS WHERE CUSTOMERID = @ID`
      );

    if (company_name.recordset.length === 0) {
      return res.status(400).json({ message: "No company name found" });
    }

    const company = company_name.recordset[0];

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
    // const dynamicDbConfig = {
    //   user: process.env.DB_USER,
    //   password: process.env.DB_PASSWORD,
    //   server: ip_address.trim(),
    //   database: process.env.DB_DATABASE2,
    //   options: {
    //     encrypt: false,
    //     trustServerCertificate: true,
    //   },
    //   port: parseInt(port.trim()),
    //   connectionTimeout: 5000, // << timeout in ms
    //   requestTimeout: 5000,
    // };

    const user_ip = String(ip_address).trim();
      const dynamicPool = await connectToUserDatabase(user_ip, port.trim());
      if (!dynamicPool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }
    

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
        port: port,
        ip: ip_address,
        userId: user.id,
        username: user.username,
        companyName: company.COMPANY_NAME,
        email: user.email,
        a_permission: user.a_permission,
        a_sync: user.a_sync,
        d_company: user.d_company,
        d_department: user.d_department,
        d_category: user.d_category,
        d_scategory: user.d_scategory,
        d_vendor: user.d_vendor,
        d_hourlyReport: user.d_hourly_report,
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
        s_product: user.s_product,
        s_department: user.s_department,
        s_category: user.s_category,
        s_scategory: user.s_scategory,
        s_vendor: user.s_vendor,
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

// // db connection for menu
// exports.menuDBConnection = async (req, res) => {
//  mssql.close();

//  try{
// await mssql.connect({
//       user: process.env.DB_USER,
//       password: process.env.DB_PASSWORD,
//       server: req.user.ip.trim(),
//       port: parseInt(req.user.port.trim()),
//       database: process.env.DB_DATABASE2, 
//       options: {
//         encrypt: false,
//         trustServerCertificate: true,
//       },
//     });

//     res.status(200).json({ message: "Menu DB Connection Successful" });
//  }
//  catch(err){
//   console.error('Error in menuDBConnection:', err);
//   res.status(500).json({ message: "Menu DB Connection Failed" });
  
//  }
  
// };

// register
exports.register = async (req, res) => {
  if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
  let pool;
 
  try {
    pool = await connectToDatabase();
    if (!pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }

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
  if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
  let pool;
  

  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ message: "Token and new password are required" });
  }

  try {
    pool = await connectToDatabase();
    if (!pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }

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
 if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
  let pool;
 
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  try {
    pool = await connectToDatabase();
    if (!pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
  

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

    const user_ip = String(decoded.ip).trim(); 
    if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
      const pool = await connectToUserDatabase(user_ip, decoded.port.trim());

      if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
      // if (!pool.connected) {
      //   return res.status(500).json({ message: "Database connection failed" });
      // }
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
    const user_ip = String(decoded.ip).trim(); 
    if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
      const pool = await connectToUserDatabase(user_ip, decoded.port.trim());
if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
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

        const insertRequest = pool.request();
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

      const insertRequest = pool.request();
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

     const user_ip = String(decoded.ip).trim(); 
     if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
      const pool = await connectToUserDatabase(user_ip, decoded.port.trim());
      // if (!pool.connected) {
      //   return res.status(500).json({ message: "Database connection failed" });
      // }
if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
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

  // Input validation
  if (isNaN(idx) || !username || !selectedType) {
    return res.status(400).json({
      message: "Invalid or missing 'idx', 'username', or 'type' parameter",
    });
  }

  try {
    // Close existing connection if open
    if (mssql.connected) {
      await mssql.close();
      console.log("✅ Previous MSSQL connection closed");
    }

    // Connect using user-specific IP and port
    const pool = await connectToUserDatabase(
      String(req.user.ip).trim(),
      req.user.port.trim()
    );

    // Check if pool is connected
    if (!pool?.connected) {
      return res.status(500).json({ message: "❌ Database connection failed" });
    }

    // Start a new transaction
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    // Backup record before delete
    const backupRequest = new mssql.Request(transaction);
    await backupRequest
      .input("DELETED_USER", mssql.NVarChar(50), username)
      .input("idx", mssql.Int, idx)
      .query(`
        USE ${rtweb};
        INSERT INTO tb_STOCKRECONCILATION_DATAENTRYTEMP_BACKUP (
          COMPANY_CODE, COUNT_STATUS, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
          COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, TRDATE, TRTIME,
          REPUSER, DELETED_USER, SERIALNO, COLORCODE, SIZECODE
        )
        SELECT 
          COMPANY_CODE, COUNT_STATUS, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
          COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, TRDATE, TRTIME,
          REPUSER, @DELETED_USER, SERIALNO, COLORCODE, SIZECODE
        FROM tb_STOCKRECONCILATION_DATAENTRYTEMP
        WHERE IDX = @idx
      `);

    // Delete record after backup
    const deleteRequest = new mssql.Request(transaction);
    const deleteResult = await deleteRequest
      .input("idx", mssql.Int, idx)
      .query(`
         USE ${rtweb};
        DELETE FROM tb_STOCKRECONCILATION_DATAENTRYTEMP WHERE IDX = @idx
      `);

    if (deleteResult.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Stock data not found" });
    }

    await transaction.commit();
    console.log(`✅ Stock data with IDX ${idx} deleted by ${username}`);
    return res.status(200).json({ message: "Data deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting stock data:", error);
    try {
      if (mssql.connected) await mssql.rollback();
    } catch {}
    return res.status(500).json({
      message: "Failed to delete stock data",
      error: error.message,
    });
  } finally {
    // Ensure connection cleanup
    if (mssql.connected) {
      await mssql.close();
      console.log("🔒 MSSQL connection closed in finally block");
    }
  }
};

//grnprn delete
exports.grnprnDelete = async (req, res) => {
  try {
    const idx = parseInt(req.query.idx, 10);
    const username = req.query.username;
    const type = req.query.selectedType;

    // Authorization check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(403).json({ message: "No authorization token provided" });
    }

    if (!idx || isNaN(idx)) {
      return res.status(400).json({ message: "Invalid or missing 'idx' parameter" });
    }

    // Map types to tables
    const tableMap = { GRN: "tb_GRN_TEMP", PRN: "tb_PRN_TEMP", TOG: "tb_TOG_TEMP" };
    const backupTableMap = { GRN: "tb_GRN_TEMP_BACKUP", PRN: "tb_PRN_TEMP_BACKUP", TOG: "tb_TOG_TEMP_BACKUP" };

    const tableName = tableMap[type];
    const backupTableName = backupTableMap[type];

    if (!tableName || !backupTableName) {
      return res.status(400).json({ message: "Invalid 'type' parameter" });
    }

    // Close existing connection if open
    if (mssql.connected) {
      await mssql.close();
      console.log("✅ Previous MSSQL connection closed");
    }

    // Connect to user database
    const pool = await connectToUserDatabase(String(req.user.ip).trim(), req.user.port.trim());
    if (!pool?.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }

    // Start transaction
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    const request = new mssql.Request(transaction);
    request.input("idx", mssql.Int, idx);
    request.input("username", mssql.NVarChar(50), username);

    // Backup query
    let backupQuery;
    if (type !== "TOG") {
      backupQuery = `
         USE ${rtweb};
        INSERT INTO dbo.${backupTableName} (
          COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE,
          PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK,
          PHY_STOCK, REMARKS, REPUSER, DELETED_USER, TRDATE, TRTIME, SERIALNO, COLORCODE, SIZECODE
        )
        SELECT 
          COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE,
          PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK,
          PHY_STOCK, REMARKS, REPUSER, @username, TRDATE, TRTIME, SERIALNO, COLORCODE, SIZECODE
        FROM dbo.${tableName}
        WHERE IDX = @idx;
      `;
    } else {
      backupQuery = `
       USE ${rtweb};
        INSERT INTO dbo.${backupTableName} (
          COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
          COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER, DELETED_USER, TRDATE, TRTIME, SERIALNO, COLORCODE, SIZECODE
        )
        SELECT 
          COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG,
          COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER, @username, TRDATE, TRTIME, SERIALNO, COLORCODE, SIZECODE
        FROM dbo.${tableName}
        WHERE IDX = @idx;
      `;
    }

    const deleteBackup = await request.query(backupQuery);
    if (deleteBackup.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Couldn't back up records before delete." });
    }

    // Delete query
    const deleteResult = await request.query(`
      USE ${rtweb};
      DELETE FROM dbo.${tableName} WHERE IDX = @idx;
    `);

    if (deleteResult.rowsAffected[0] === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Data not found" });
    }

    await transaction.commit();
    return res.status(200).json({ message: "Data deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting GRN/PRN/TOG data:", error);
    try { if (mssql.connected) await mssql.rollback(); } catch {}
    return res.status(500).json({ message: "Failed to delete data", error: error.message });
  } finally {
    if (mssql.connected) {
      await mssql.close();
      console.log("🔒 MSSQL connection closed in finally block");
    }
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
    if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }

    const pool = await connectToUserDatabase(String(req.user.ip).trim(), req.user.port.trim());
    

    if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
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

  const tempTables = { GRN: "tb_GRN_TEMP", PRN: "tb_PRN_TEMP", TOG: "tb_TOG_TEMP" };
  const finalTables = { GRN: "tb_GRN", PRN: "tb_PRN", TOG: "tb_TOG" };
  const backupTables = { GRN: "tb_GRN_TEMP_BACKUP", PRN: "tb_PRN_TEMP_BACKUP", TOG: "tb_TOG_TEMP_BACKUP" };

  if (!tempTables[type]) return res.status(400).json({ success: false, message: "Invalid type" });

  let transaction;
  try {
    if (mssql.connected) await mssql.close();

    const pool = await connectToUserDatabase(String(req.user.ip).trim(), req.user.port.trim());
    if (!pool?.connected) return res.status(500).json({ message: "Database connection failed" });

    transaction = new mssql.Transaction(pool);
    await transaction.begin();

    const request = new mssql.Request(transaction);
    request.input("COMPANY_CODE", mssql.NChar(10), company.trim());
    if (type !== "TOG") request.input("INVOICE_NO", mssql.NChar(50), invoice.trim());

    // Step 1: Retrieve temp data
    const selectResult = await request.query(`
       USE ${rtweb};
      SELECT * FROM ${tempTables[type]} 
      ${type === "TOG" ? "WHERE COMPANY_CODE = @COMPANY_CODE" : "WHERE COMPANY_CODE = @COMPANY_CODE AND INVOICE_NO = @INVOICE_NO"}
    `);

    const records = selectResult.recordset;
    if (records.length === 0) { 
      await transaction.rollback(); 
      return res.status(404).json({ success: false, message: "No data found in temp table" }); 
    }

    // Step 2: Update document number
    const docRequest = new mssql.Request(transaction);
    docRequest.input("COMPANY_CODE", mssql.NChar(10), company.trim());
    let docResult = await docRequest.query(`SELECT * FROM ${rtweb}.dbo.tb_DOCUMENT WHERE COMPANY_CODE = @COMPANY_CODE`);
    let grn = "00", prn = "00", tog = "00";

    if (docResult.recordset.length === 0) {
      await docRequest.input("GRN", mssql.NVarChar(2), "00")
        .input("PRN", mssql.NVarChar(2), "00")
        .input("TOG", mssql.NVarChar(2), "00")
        .input("REPUSER", mssql.NVarChar(50), username.trim())
        .query(`INSERT INTO ${rtweb}.dbo.tb_DOCUMENT (COMPANY_CODE, GRN, PRN, TOG, REPUSER) VALUES (@COMPANY_CODE,@GRN,@PRN,@TOG,@REPUSER)`);
    } else {
      const doc = docResult.recordset[0];
      grn = doc.GRN || "00"; prn = doc.PRN || "00"; tog = doc.TOG || "00";
    }

    const newDocNums = { GRN: String(Number(grn) + 1).padStart(2, "0"), PRN: String(Number(prn) + 1).padStart(2, "0"), TOG: String(Number(tog) + 1).padStart(2, "0") };
    const documentNo = company.trim() + "0".repeat(10 - company.trim().length - newDocNums[type].length) + newDocNums[type];

    const updateDocReq = new mssql.Request(transaction);
    updateDocReq.input("COMPANY_CODE", mssql.NChar(10), company.trim());
    updateDocReq.input(type, mssql.NVarChar(2), newDocNums[type]);
    await updateDocReq.query(`UPDATE ${rtweb}.dbo.tb_DOCUMENT SET ${type} = @${type} WHERE COMPANY_CODE = @COMPANY_CODE`);

    const { trDate, trTime } = currentDateTime();

    // Step 3: Insert into final and backup tables
    for (const record of records) {
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
        trDate, trTime,
        VENDOR_CODE: record.VENDOR_CODE?.trim(),
        VENDOR_NAME: record.VENDOR_NAME?.trim(),
        INVOICE_NO: record.INVOICE_NO?.trim(),
        TYPE: record.TYPE?.trim(),
        COMPANY_TO_CODE: record.COMPANY_TO_CODE?.trim(),
        SERIALNO: record.SERIALNO?.trim() || "",
        COLORCODE: record.COLORCODE?.trim() || "",
        SIZECODE: record.SIZECODE?.trim() || "",
      };

      // Insert final table
      const insertReq = new mssql.Request(transaction);
      Object.entries(baseInputs).forEach(([key, value]) => {
        if (value !== undefined) {
          let type;
          if (key === "COSTPRICE" || key === "UNITPRICE") type = mssql.Money;
          else if (key === "CUR_STOCK" || key === "PHY_STOCK") type = mssql.Float;
          else if (key === "trDate" || key === "trTime") type = mssql.DateTime;
          else if (
            key === "COMPANY_CODE" ||
            key === "PRODUCT_CODE" ||
            key === "COMPANY_TO_CODE" ||
            key === "VENDOR_CODE" ||
            key === "INVOICE_NO"
          ) type = mssql.NChar(30);
          else type = mssql.NVarChar(255);

          insertReq.input(key, type, value);
        }
      });

      const insertQuery = type === "TOG" ?
        `INSERT INTO ${rtweb}.dbo.${finalTables[type]} 
        (DOCUMENT_NO, COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REMARKS, REPUSER, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE)
         VALUES (@DOCUMENT_NO,@COMPANY_CODE,@COMPANY_TO_CODE,@TYPE,@PRODUCT_CODE,@PRODUCT_NAMELONG,@COSTPRICE,@UNITPRICE,@CUR_STOCK,@PHY_STOCK,@REMARKS,@REPUSER,@trDate,@trTime,@SERIALNO,@COLORCODE,@SIZECODE)` 
        : 
        `INSERT INTO ${rtweb}.dbo.${finalTables[type]} 
        (DOCUMENT_NO, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER, REMARKS, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE)
         VALUES (@DOCUMENT_NO,@COMPANY_CODE,@VENDOR_CODE,@VENDOR_NAME,@INVOICE_NO,@TYPE,@PRODUCT_CODE,@PRODUCT_NAMELONG,@COSTPRICE,@UNITPRICE,@CUR_STOCK,@PHY_STOCK,@REPUSER,@REMARKS,@trDate,@trTime,@SERIALNO,@COLORCODE,@SIZECODE)`;

      await insertReq.query(insertQuery);

      // Insert backup table
      const backupReq = new mssql.Request(transaction);
      Object.entries(baseInputs).forEach(([key, value]) => {
        if (value !== undefined) {
          let type;
          if (key === "COSTPRICE" || key === "UNITPRICE") type = mssql.Money;
          else if (key === "CUR_STOCK" || key === "PHY_STOCK") type = mssql.Float;
          else if (key === "trDate" || key === "trTime") type = mssql.DateTime;
          else if (
            key === "COMPANY_CODE" ||
            key === "PRODUCT_CODE" ||
            key === "COMPANY_TO_CODE" ||
            key === "VENDOR_CODE" ||
            key === "INVOICE_NO"
          ) type = mssql.NChar(30);
          else type = mssql.NVarChar(255);

          backupReq.input(key, type, value);
        }
      });

      const backupQuery = type === "TOG" ?
        `INSERT INTO ${rtweb}.dbo.${backupTables[type]} 
        (COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REMARKS, REPUSER, APPROVED_USER, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE)
         VALUES (@COMPANY_CODE,@COMPANY_TO_CODE,@TYPE,@PRODUCT_CODE,@PRODUCT_NAMELONG,@COSTPRICE,@UNITPRICE,@CUR_STOCK,@PHY_STOCK,@REMARKS,@REPUSER,@APPROVED_USER,@trDate,@trTime,@SERIALNO,@COLORCODE,@SIZECODE)` 
        : 
        `INSERT INTO ${rtweb}.dbo.${backupTables[type]} 
        (COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER, REMARKS, APPROVED_USER, TRDATE, TRTIME, SERIALNO,COLORCODE, SIZECODE)
         VALUES (@COMPANY_CODE,@VENDOR_CODE,@VENDOR_NAME,@INVOICE_NO,@TYPE,@PRODUCT_CODE,@PRODUCT_NAMELONG,@COSTPRICE,@UNITPRICE,@CUR_STOCK,@PHY_STOCK,@REPUSER,@REMARKS,@APPROVED_USER,@trDate,@trTime,@SERIALNO,@COLORCODE,@SIZECODE)`;

      await backupReq.query(backupQuery);
    }

    // Step 4: Delete temp data
    const deleteReq = new mssql.Request(transaction);
    deleteReq.input("COMPANY_CODE", mssql.NChar(10), company.trim());
    if (type !== "TOG") deleteReq.input("INVOICE_NO", mssql.NChar(50), invoice.trim());
    await deleteReq.query(`
      USE ${rtweb};
      DELETE FROM ${tempTables[type]} WHERE COMPANY_CODE = @COMPANY_CODE ${type !== "TOG" ? "AND INVOICE_NO = @INVOICE_NO" : ""}
    `);

    await transaction.commit();
    return res.status(200).json({ success: true, message: "Data moved successfully", documentNo });
  } catch (error) {
    console.error("Error in finalGrnPrnUpdate:", error.message);
    if (transaction && !transaction._aborted) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Unexpected error occurred", error: error.message });
  } finally {
    if (mssql.connected) await mssql.close();
  }
};

// Get dashboard data function
exports.dashboardOptions = async (req, res) => {
  try {
    const user_ip = String(req.user.ip).trim();
    if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
    const pool = await connectToUserDatabase(user_ip, req.user.port.trim());

    if (!pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
    // Switch database context
    await pool.request().query(`USE [${rtweb}];`);

    const result = await pool.request().query(`
      SELECT COMPANY_CODE, COMPANY_NAME 
      FROM tb_COMPANY;
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
  
const user_ip = String(req.user.ip).trim();
if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  } 
      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
      // await pool.connect();
      
    if (!pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
      // if (!pool.connected) {
      //   return res.status(500).json({ message: "Database connection failed" });
      // }
      
    
    // const pool = await mssql.connect({
    //   user: process.env.DB_USER,
    //   password: process.env.DB_PASSWORD,
    //   server: req.user.ip.trim(),
    //   port: parseInt(req.user.port.trim()),
    //   database: process.env.DB_DATABASE2, 
    //   options: {
    //     encrypt: false,
    //     trustServerCertificate: true,
    //   },
    // });
  
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
    // --- Auth ---
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    const decoded = await verifyToken(token, process.env.JWT_SECRET);
    const username = decoded.username;

    // --- Normalize selectedOptions ---
    let selectedOptions = req.query.companyCodes || req.query["companyCodes[]"];
    if (typeof selectedOptions === "string") selectedOptions = [selectedOptions];

    const { state, rowClicked, fromDate, toDate, currentDate, invoiceNo } = req.query;

    // --- Connect to user DB ---
    const user_ip = String(req.user.ip).trim();
    if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
    const pool = await connectToUserDatabase(user_ip, req.user.port.trim());

    if (!pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
    let reportQuery;

    // --- Main report ---
    if (rowClicked === false || String(rowClicked).toLowerCase() === "false") {
      if ((state === false || String(state).toLowerCase() === "false") && fromDate && toDate && selectedOptions?.length > 0) {

        const formattedFromDate = formatDate(fromDate);
        const formattedToDate = formatDate(toDate);
        const reportType = "INVOICEWISE";

        // Clean previous data
        await pool.request().query(`
          USE ${rtweb};
          DELETE FROM tb_SALESVIEW WHERE REPUSER = '${username}';
        `);

        // Run SP for each company
        for (const companyCode of selectedOptions) {
          await pool.request().query(`
            EXEC ${rtweb}.dbo.Sp_SalesView 
              @COMPANY_CODE='${companyCode}', 
              @DATE1='${formattedFromDate}', 
              @DATE2='${formattedToDate}', 
              @REPUSER='${username}', 
              @REPORT_TYPE='${reportType}';
          `);
        }

        // Main report query
        reportQuery = await pool.request().query(`
          USE ${rtweb};
          SELECT INVOICENO, COMPANY_CODE, UNITNO, REPNO, 'CASH' AS PRODUCT_NAME, 
                 ISNULL(SUM(CASE PRODUCT_NAME 
                   WHEN 'CASH' THEN AMOUNT 
                   WHEN 'BALANCE' THEN -AMOUNT 
                   ELSE 0 END), 0) AS AMOUNT, SALESDATE
          FROM tb_SALESVIEW 
          WHERE (ID='PT' OR ID='BL') AND PRODUCT_NAME IN ('CASH', 'BALANCE') AND REPUSER='${username}'
          GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO
          
          UNION ALL
          
          SELECT INVOICENO, COMPANY_CODE, UNITNO, REPNO, PRODUCT_NAME, 
                 ISNULL(SUM(AMOUNT),0) AS AMOUNT, SALESDATE
          FROM tb_SALESVIEW 
          WHERE ID='PT' AND PRODUCT_NAME NOT IN ('CASH','BALANCE') AND REPUSER='${username}'
          GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO, PRODUCT_NAME;
        `);

      } else if ((state === true || String(state).toLowerCase() === "true") && currentDate && selectedOptions?.length > 0) {
        const date = formatDate(currentDate);
        const reportType = "INVOICEWISE";

        await pool.request().query(`
          USE ${rtweb};
          DELETE FROM tb_SALESVIEW WHERE REPUSER='${username}';
        `);

        for (const companyCode of selectedOptions) {
          await pool.request().query(`
            EXEC ${rtweb}.dbo.Sp_SalesCurView 
              @COMPANY_CODE='${companyCode}', 
              @DATE='${date}', 
              @REPUSER='${username}', 
              @REPORT_TYPE='${reportType}';
          `);
        }

        reportQuery = await pool.request().query(`
          USE ${rtweb};
          SELECT INVOICENO, COMPANY_CODE, UNITNO, REPNO, 'CASH' AS PRODUCT_NAME, 
                 ISNULL(SUM(CASE PRODUCT_NAME 
                   WHEN 'CASH' THEN AMOUNT 
                   WHEN 'BALANCE' THEN -AMOUNT 
                   ELSE 0 END), 0) AS AMOUNT, SALESDATE
          FROM tb_SALESVIEW 
          WHERE (ID='PT' OR ID='BL') AND PRODUCT_NAME IN ('CASH', 'BALANCE') AND REPUSER='${username}'
          GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO
          
          UNION ALL
          
          SELECT INVOICENO, COMPANY_CODE, UNITNO, REPNO, PRODUCT_NAME, 
                 ISNULL(SUM(AMOUNT),0) AS AMOUNT, SALESDATE
          FROM tb_SALESVIEW 
          WHERE ID='PT' AND PRODUCT_NAME NOT IN ('CASH','BALANCE') AND REPUSER='${username}'
          GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO, PRODUCT_NAME;
        `);
      }
    }

    // --- Invoice data when row clicked ---
    let invoiceData = [];
    let invoiceDataState = false;

    if (rowClicked === true || String(rowClicked).toLowerCase() === "true") {
      const result = await pool.request().query(`
        USE ${rtweb};
        SELECT INVOICENO, PRODUCT_CODE, PRODUCT_NAME, QTY, AMOUNT, COSTPRICE, UNITPRICE, DISCOUNT
        FROM tb_SALESVIEW 
        WHERE INVOICENO='${invoiceNo}' AND ID IN ('SL','SLF','RF','RFF') AND REPUSER='${username}';
      `);

      invoiceData = result.recordset;
      invoiceDataState = true;
    }

    // --- Response ---
    res.status(200).json({
      message: "Data found",
      success: true,
      invoiceDataState,
      reportData: reportQuery ? reportQuery.recordset : [],
      invoiceData,
    });

  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

// //current report
// exports.currentReportData = async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader) {
//       return res
//         .status(403)
//         .json({ message: "No authorization token provided" });
//     }

//     const token = authHeader.split(" ")[1];
//     if (!token) {
//       return res.status(403).json({ message: "Token is missing" });
//     }

//     const decoded = await verifyToken(token, process.env.JWT_SECRET);
//     const username = decoded.username;

//     // Handle companyCodes parsing (from ?companyCodes=01&companyCodes=02 or ?companyCodes[]=01&companyCodes[]=02)
//     let companyCodes = req.query.companyCodes || req.query["companyCodes[]"];
//     if (typeof companyCodes === "string") {
//       companyCodes = [companyCodes];
//     }

//     const { currentDate, invoiceNo } = req.query;

//     if (
//       !Array.isArray(companyCodes) ||
//       companyCodes.length === 0 ||
//       !currentDate
//     ) {
//       return res.status(400).json({ message: "Missing or invalid parameters" });
//     }

//     const date = formatDate(currentDate);
//     const reportType = "INVOICEWISE";

//     // Step 1: Clean previous report data
//     await mssql.query`
//       USE RT_WEB;
//       DELETE FROM tb_SALESVIEW WHERE REPUSER = ${username};
//     `;

//     // Step 2: Execute SP for each company
//     for (const companyCode of companyCodes) {
//       await mssql.query`
//         EXEC RT_WEB.dbo.Sp_SalesCurView 
//         @COMPANY_CODE = ${companyCode}, 
//         @DATE = ${date}, 
//         @REPUSER = ${username}, 
//         @REPORT_TYPE = ${reportType};
//       `;
//     }

//     // Step 3: Fetch summarized report data
//     const reportQuery = await mssql.query`
//       USE RT_WEB;
//       SELECT 
//         INVOICENO, COMPANY_CODE, UNITNO, REPNO, 'CASH' AS PRODUCT_NAME, 
//         ISNULL(SUM(CASE PRODUCT_NAME 
//           WHEN 'CASH' THEN AMOUNT 
//           WHEN 'BALANCE' THEN -AMOUNT 
//           ELSE 0 END), 0) AS AMOUNT, 
//         SALESDATE
//       FROM tb_SALESVIEW 
//       WHERE (ID = 'PT' OR ID = 'BL') 
//         AND PRODUCT_NAME IN ('CASH', 'BALANCE') 
//         AND REPUSER = ${username}
//       GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO

//       UNION ALL

//       SELECT 
//         INVOICENO, COMPANY_CODE, UNITNO, REPNO, PRODUCT_NAME, 
//         ISNULL(SUM(AMOUNT), 0) AS AMOUNT, SALESDATE
//       FROM tb_SALESVIEW 
//       WHERE ID = 'PT' 
//         AND PRODUCT_NAME NOT IN ('CASH', 'BALANCE') 
//         AND REPUSER = ${username}
//       GROUP BY COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO, PRODUCT_NAME;
//     `;

//     // Step 4: Fetch detailed invoice data if requested
//     let invoiceData = [];
//     if (invoiceNo) {
//       const result = await mssql.query`
//         USE RT_WEB;
//         SELECT INVOICENO, PRODUCT_CODE, PRODUCT_NAME, QTY, AMOUNT, COSTPRICE, UNITPRICE, DISCOUNT 
//         FROM tb_SALESVIEW 
//         WHERE INVOICENO = ${invoiceNo} 
//           AND ID IN ('SL', 'SLF', 'RF', 'RFF') 
//           AND REPUSER = ${username};
//       `;
//       invoiceData = result.recordset;
//     }

//     console.log("Invoice Data:", invoiceData);
//     // Step 5: Respond
//     res.status(200).json({
//       message: "Invoice data found",
//       success: true,
//       reportData: reportQuery.recordset || [],
//       invoiceData,
//     });
//   } catch (error) {
//     console.error("Error retrieving current report data:", error);
//     res.status(500).json({ message: "Failed to retrieve current report data" });
//   }
// };

//company dashboard
exports.loadingDashboard = async (req, res) => {
try {
    // 🔹 1. Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(403).json({ message: "Token is missing" });

    const decoded = await verifyToken(token, process.env.JWT_SECRET);
    const username = decoded.username;

    // 🔹 2. Get query params
    const { currentDate, fromDate, toDate, options } = req.query;
    let selectedOptions = options || req.query["options[]"] || [];

    if (typeof selectedOptions === "string") {
      selectedOptions = [selectedOptions];
    }
    if (!Array.isArray(selectedOptions) || selectedOptions[0] === "") {
      selectedOptions = [];
    }

    if (selectedOptions.length === 0)
      return res
        .status(400)
        .json({ message: "Invalid or missing company codes" });

    // 🔹 3. Validate company codes
    const isSafe = selectedOptions.every((code) =>
      /^[a-zA-Z0-9]+$/.test(code)
    );
    if (!isSafe)
      return res
        .status(400)
        .json({ message: "Invalid characters in company codes" });

    // 🔹 4. Handle SQL connection
    const user_ip = String(req.user.ip).trim();

    if (mssql.connected) {
      await mssql.close();
      console.log("✅ Previous database connection closed");
    }

    const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
    if (!pool || !pool.connected)
      return res.status(500).json({ message: "Database connection failed" });

    console.log("✅ Connected to user database");

    // 🔹 5. Format dates
    const formattedCurrentDate = formatDate(currentDate);
    const formattedFromDate = formatDate(fromDate);
    const formattedToDate = formatDate(toDate);
    const reportType = "SALESSUM1";

    // 🔹 6. Clear previous dashboard data
    await pool
      .request()
      .input("username", mssql.NVarChar, username)
      .query(`
        USE ${rtweb};
        DELETE FROM tb_SALES_DASHBOARD_VIEW WHERE REPUSER = @username;
        DELETE FROM tb_SALESVIEW WHERE REPUSER = @username;
      `);
    console.log("✅ Cleared previous dashboard data");

    // 🔹 7. Execute stored procedures for each company
    for (const companyCode of selectedOptions) {
      try {
        const request = pool.request();
        request
          .input("COMPANY_CODE", mssql.NVarChar(10), companyCode)
          .input("REPUSER", mssql.NVarChar(100), username)
          .input("REPORT_TYPE", mssql.NVarChar(50), reportType);

        if (fromDate && toDate) {
          request
            .input("DATE1", mssql.Char(10), formattedFromDate)
            .input("DATE2", mssql.Char(10), formattedToDate);

          await request.query(`
            EXEC ${rtweb}.dbo.Sp_SalesView 
              @COMPANY_CODE = @COMPANY_CODE,
              @DATE1 = @DATE1,
              @DATE2 = @DATE2,
              @REPUSER = @REPUSER,
              @REPORT_TYPE = @REPORT_TYPE;
          `);
        } else {
          request.input("DATE", mssql.Char(10), formattedCurrentDate);

          await request.query(`
            EXEC ${rtweb}.dbo.Sp_SalesCurView 
              @COMPANY_CODE = @COMPANY_CODE,
              @DATE = @DATE,
              @REPUSER = @REPUSER,
              @REPORT_TYPE = @REPORT_TYPE;
          `);
        }

        console.log(`✅ Stored procedure executed for company: ${companyCode}`);
      } catch (innerErr) {
        console.error(
          `⚠️ Error executing procedure for company ${companyCode}:`,
          innerErr.message
        );
        // Continue next company instead of failing entire request
      }
    }

    console.log("✅ All stored procedures executed");

    // 🔹 8. Query dashboard data
    const companyCodesList = selectedOptions.map((c) => `'${c}'`).join(", ");

    const loadingDashboardResult = await pool
      .request()
      .input("username", mssql.VarChar, username)
      .query(`
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
        WHERE COMPANY_CODE IN (${companyCodesList}) AND REPUSER = @username;
      `);

    const record = await pool
      .request()
      .input("username", mssql.VarChar, username)
      .query(`
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
        WHERE COMPANY_CODE IN (${companyCodesList}) AND REPUSER = @username
        GROUP BY COMPANY_CODE;
      `);

    const cashierPointRecord = await pool
      .request()
      .input("username", mssql.VarChar, username)
      .query(`
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
        WHERE COMPANY_CODE IN (${companyCodesList}) AND REPUSER = @username
        GROUP BY COMPANY_CODE, UNITNO;
      `);

    console.log("✅ Dashboard queries executed");

    // 🔹 9. Format result
    const formattedResult =
      Array.isArray(loadingDashboardResult.recordset) &&
      loadingDashboardResult.recordset.length > 0
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

    // 🔹 10. Send response (return ensures single send)
    return res.status(200).json({
      message: "Processed parameters for company codes",
      success: true,
      result: formattedResult,
      record: record?.recordset ?? [],
      cashierPointRecord: cashierPointRecord?.recordset ?? [],
    });
  } catch (error) {
    console.error("❌ Error loading dashboard:", error);
    return res.status(500).json({
      message: "Failed to load company dashboard data",
      error: error.message,
    });
  }

};

//department dashboard
exports.departmentDashboard = async (req, res) => {
  try {
    // 🔹 1. Token validation
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    // ✅ Use promise-based verify to avoid nested callbacks
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const username = decoded.username;

    // 🔹 2. Parse query parameters
    let { currentDate, fromDate, toDate, selectedOptions } = req.query;

    if (typeof selectedOptions === "string") {
      selectedOptions = selectedOptions.split(",").map((code) => code.trim());
    }

    if (
      !Array.isArray(selectedOptions) ||
      selectedOptions.length === 0 ||
      selectedOptions[0] === ""
    ) {
      return res.status(400).json({ message: "No company codes provided" });
    }

    // 🔹 3. Establish connection
    if (mssql.connected) {
      await mssql.close();
      console.log("✅ Closed previous connection");
    }

    const user_ip = String(req.user.ip).trim();
    const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
    if (!pool || !pool.connected)
      return res.status(500).json({ message: "Database connection failed" });

    console.log("✅ Connected to user database");

    const formattedCurrentDate = formatDate(currentDate);
    const formattedFromDate = formatDate(fromDate);
    const formattedToDate = formatDate(toDate);
    const reportType = "SALESDET";

    // 🔹 4. Helper: retry on deadlock
    const executeWithRetry = async (queryFn, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await queryFn();
        } catch (err) {
          if (err.originalError?.number === 1205 && i < retries - 1) {
            console.warn(`⚠️ Deadlock. Retrying attempt ${i + 1}...`);
            await new Promise((r) => setTimeout(r, 1000));
          } else {
            throw err;
          }
        }
      }
    };

    // 🔹 5. Clear previous records
    try {
      await pool
        .request()
        .input("username", mssql.VarChar, username)
        .query(`USE ${rtweb}; DELETE FROM tb_SALESVIEW WHERE REPUSER = @username;`);
      console.log("✅ Cleared previous records");
    } catch (deleteErr) {
      console.error("⚠️ Error deleting previous records:", deleteErr);
    }

    // 🔹 6. Run stored procedures for each company
    for (const companyCode of selectedOptions) {
      try {
        const queryFn =
          fromDate && toDate
            ? async () => {
                await pool
                  .request()
                  .input("COMPANY_CODE", mssql.VarChar, companyCode)
                  .input("DATE1", mssql.Char(10), formattedFromDate)
                  .input("DATE2", mssql.Char(10), formattedToDate)
                  .input("REPUSER", mssql.VarChar, username)
                  .input("REPORT_TYPE", mssql.VarChar, reportType)
                  .query(`EXEC ${rtweb}.dbo.Sp_SalesView 
                          @COMPANY_CODE, @DATE1, @DATE2, @REPUSER, @REPORT_TYPE;`);
              }
            : async () => {
                await pool
                  .request()
                  .input("COMPANY_CODE", mssql.VarChar, companyCode)
                  .input("DATE", mssql.Char(10), formattedCurrentDate)
                  .input("REPUSER", mssql.VarChar, username)
                  .input("REPORT_TYPE", mssql.VarChar, reportType)
                  .query(`EXEC ${rtweb}.dbo.Sp_SalesCurView 
                          @COMPANY_CODE, @DATE, @REPUSER, @REPORT_TYPE;`);
              };

        await executeWithRetry(queryFn);
        console.log(`✅ Stored procedure executed for company: ${companyCode}`);
      } catch (spErr) {
        console.error(`⚠️ Error executing SP for ${companyCode}:`, spErr.message);
      }
    }

    // 🔹 7. Fetch department data
    const companyCodesList = selectedOptions.map((c) => `'${c}'`).join(",");

    const [tableRecords, amountBarChart, quantityBarChart] = await Promise.all([
      pool
        .request()
        .input("username", mssql.VarChar, username)
        .query(`
          USE [${rtweb}];
          SELECT   
            LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
            LTRIM(RTRIM(DEPTCODE)) AS DEPARTMENT_CODE,
            DEPTNAME AS DEPARTMENT_NAME,
            SUM(QTY) AS QUANTITY,
            SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = @username AND COMPANY_CODE IN (${companyCodesList})
          GROUP BY COMPANY_CODE, DEPTCODE, DEPTNAME;
        `),

      pool
        .request()
        .input("username", mssql.VarChar, username)
        .query(`
          USE [${rtweb}];
          SELECT DEPTNAME, SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = @username AND COMPANY_CODE IN (${companyCodesList})
          GROUP BY DEPTNAME;
        `),

      pool
        .request()
        .input("username", mssql.VarChar, username)
        .query(`
          USE [${rtweb}];
          SELECT DEPTNAME, SUM(QTY) AS QUANTITY
          FROM tb_SALESVIEW
          WHERE REPUSER = @username AND COMPANY_CODE IN (${companyCodesList})
          GROUP BY DEPTNAME;
        `),
    ]);

    console.log("✅ Department data fetched successfully");

    // 🔹 8. Return response
    return res.status(200).json({
      message: "Processed parameters for company codes",
      success: true,
      tableRecords: tableRecords.recordset || [],
      amountBarChart: amountBarChart.recordset || [],
      quantityBarChart: quantityBarChart.recordset || [],
    });
  } catch (error) {
    console.error("❌ Unhandled error in departmentDashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load department dashboard", error: error.message });
  }
};

//category dashboard
exports.categoryDashboard = async (req, res) => {
  try {
    // 🔹 1. Auth validation
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(403).json({ message: "Token is missing" });

    // ✅ Use async verify instead of callback
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const username = decoded.username;

    // 🔹 2. Parse query params
    let { currentDate, fromDate, toDate, selectedOptions } = req.query;

    if (typeof selectedOptions === "string") {
      selectedOptions = selectedOptions.split(",").map((code) => code.trim());
    }

    if (
      !Array.isArray(selectedOptions) ||
      selectedOptions.length === 0 ||
      selectedOptions[0] === ""
    ) {
      return res.status(400).json({ message: "No company codes provided" });
    }

    // 🔹 3. Reconnect to the user DB safely
    if (mssql.connected) {
      await mssql.close();
      console.log("✅ Closed previous MSSQL connection");
    }

    const user_ip = String(req.user.ip).trim();
    const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
    if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
    console.log("✅ Connected to user database");

    const formattedCurrentDate = formatDate(currentDate);
    const formattedFromDate = formatDate(fromDate);
    const formattedToDate = formatDate(toDate);
    const reportType = "SALESDET";

    // 🔹 4. Clear previous report data for this user
    try {
      await pool
        .request()
        .input("username", mssql.VarChar, username)
        .query(`USE [${rtweb}]; DELETE FROM tb_SALESVIEW WHERE REPUSER = @username;`);
      console.log("✅ Cleared previous report data");
    } catch (err) {
      console.error("⚠️ Error clearing tb_SALESVIEW:", err);
    }

    // 🔹 5. Run stored procedures for each company code
    for (const companyCode of selectedOptions) {
      try {
        const request = pool.request()
          .input("COMPANY_CODE", mssql.VarChar, companyCode)
          .input("REPUSER", mssql.VarChar, username)
          .input("REPORT_TYPE", mssql.VarChar, reportType);

        if (fromDate && toDate) {
          request
            .input("DATE1", mssql.Char(10), formattedFromDate)
            .input("DATE2", mssql.Char(10), formattedToDate);
          await request.query(`
            EXEC ${rtweb}.dbo.Sp_SalesView 
              @COMPANY_CODE, @DATE1, @DATE2, @REPUSER, @REPORT_TYPE;
          `);
        } else {
          request.input("DATE", mssql.Char(10), formattedCurrentDate);
          await request.query(`
            EXEC ${rtweb}.dbo.Sp_SalesCurView 
              @COMPANY_CODE, @DATE, @REPUSER, @REPORT_TYPE;
          `);
        }
        console.log(`✅ Stored procedure executed for company: ${companyCode}`);
      } catch (err) {
        console.error(`⚠️ Error executing SP for ${companyCode}:`, err.message);
      }
    }

    // 🔹 6. Prepare IN clause (safe — we validated earlier)
    const companyCodesList = selectedOptions.map((c) => `'${c}'`).join(",");

    // 🔹 7. Run summary queries
    const [categoryTableRecords, categoryAmountBarChart, categoryQuantityBarChart] =
      await Promise.all([
        pool.request()
          .input("username", mssql.VarChar, username)
          .query(`
            USE [${rtweb}];
            SELECT
              LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(CATCODE)) AS CATEGORY_CODE,
              CATNAME AS CATEGORY_NAME,
              SUM(QTY) AS QUANTITY,
              SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = @username AND COMPANY_CODE IN (${companyCodesList})
            GROUP BY COMPANY_CODE, CATCODE, CATNAME;
          `),

        pool.request()
          .input("username", mssql.VarChar, username)
          .query(`
            USE [${rtweb}];
            SELECT CATNAME, SUM(AMOUNT) AS AMOUNT
            FROM tb_SALESVIEW
            WHERE REPUSER = @username AND COMPANY_CODE IN (${companyCodesList})
            GROUP BY CATNAME;
          `),

        pool.request()
          .input("username", mssql.VarChar, username)
          .query(`
            USE [${rtweb}];
            SELECT CATNAME, SUM(QTY) AS QUANTITY
            FROM tb_SALESVIEW
            WHERE REPUSER = @username AND COMPANY_CODE IN (${companyCodesList})
            GROUP BY CATNAME;
          `),
      ]);

    console.log("✅ Category data fetched successfully");

    // 🔹 8. Send response
    return res.status(200).json({
      message: "Processed parameters for company codes",
      success: true,
      categoryTableRecords: categoryTableRecords.recordset || [],
      categoryAmountBarChart: categoryAmountBarChart.recordset || [],
      categoryQuantityBarChart: categoryQuantityBarChart.recordset || [],
    });
  } catch (error) {
    console.error("❌ Unhandled error in categoryDashboard:", error);
    return res
      .status(500)
      .json({
        message: "Failed to load category dashboard",
        error: error.message,
      });
  }
};

//sub category dashboard
exports.subCategoryDashboard = async (req, res) => {
 if (mssql.connected) {
      await mssql.close();
      console.log("✅ Closed previous MSSQL connection");
    }
  let pool;

  try {
    // === 1. Verify Authorization ===
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res
        .status(403)
        .json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    // === 2. Decode JWT ===
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const username = decoded.username;

    // === 3. Extract Query Params ===
    let { currentDate, fromDate, toDate, selectedOptions } = req.query;

    if (typeof selectedOptions === "string") {
      selectedOptions = selectedOptions.split(",").map((c) => c.trim());
    }

    if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
      return res.status(400).json({ message: "No company codes provided" });
    }

    // === 4. Connect to Database (as Pool) ===
    const user_ip = String(req.user.ip).trim();
    const user_port = req.user.port.trim();
    pool = await connectToUserDatabase(user_ip, user_port);

    if (!pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }

    const request = pool.request();

    const formattedCurrentDate = formatDate(currentDate);
    const formattedFromDate = formatDate(fromDate);
    const formattedToDate = formatDate(toDate);
    const reportType = "SALESDET";

    // === 5. Clear existing data ===
    await request.input("username", mssql.VarChar, username).query(`
      USE [${rtweb}];
      DELETE FROM tb_SALESVIEW WHERE REPUSER = @username;
    `);
    console.log("✅ Cleared tb_SALESVIEW");

    // === 6. Execute Stored Procedures ===
    for (const companyCode of selectedOptions) {
      const spRequest = pool.request();
      spRequest.input("COMPANY_CODE", mssql.VarChar, companyCode);
      spRequest.input("REPUSER", mssql.VarChar, username);
      spRequest.input("REPORT_TYPE", mssql.VarChar, reportType);

      if (fromDate && toDate) {
        spRequest.input("DATE1", mssql.VarChar, formattedFromDate);
        spRequest.input("DATE2", mssql.VarChar, formattedToDate);
        await spRequest.execute("Sp_SalesView");
      } else {
        spRequest.input("DATE", mssql.VarChar, formattedCurrentDate);
        await spRequest.execute("Sp_SalesCurView");
      }
      console.log(`✅ Stored procedure executed for company: ${companyCode}`);
    }

    // === 7. Build IN clause ===
    const inClause = selectedOptions.map((c) => `'${c}'`).join(", ");

    // === 8. Run Summary Queries ===
    const [subCategoryTableRecords, subCategoryAmountBarChart, subCategoryQuantityBarChart] =
      await Promise.all([
        pool.request().input("username", mssql.VarChar, username).query(`
          USE [${rtweb}];
          SELECT
            LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
            LTRIM(RTRIM(SCATCODE)) AS SUBCATEGORY_CODE,
            SCATNAME AS SUBCATEGORY_NAME,
            SUM(QTY) AS QUANTITY,
            SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = @username AND COMPANY_CODE IN (${inClause})
          GROUP BY COMPANY_CODE, SCATCODE, SCATNAME;
        `),

        pool.request().input("username", mssql.VarChar, username).query(`
          USE [${rtweb}];
          SELECT SCATNAME, SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = @username AND COMPANY_CODE IN (${inClause})
          GROUP BY SCATNAME;
        `),

        pool.request().input("username", mssql.VarChar, username).query(`
          USE [${rtweb}];
          SELECT SCATNAME, SUM(QTY) AS QUANTITY
          FROM tb_SALESVIEW
          WHERE REPUSER = @username AND COMPANY_CODE IN (${inClause})
          GROUP BY SCATNAME;
        `),
      ]);

    console.log("✅ Dashboard queries executed successfully");

    // === 9. Send Response ===
    return res.status(200).json({
      success: true,
      message: "Processed parameters for company codes",
      subCategoryTableRecords: subCategoryTableRecords.recordset,
      subCategoryAmountBarChart: subCategoryAmountBarChart.recordset,
      subCategoryQuantityBarChart: subCategoryQuantityBarChart.recordset,
    });
  } catch (error) {
    console.error("❌ Error in subCategoryDashboard:", error);
    return res.status(500).json({
      message: "Failed to load subcategory dashboard",
      error: error.message,
    });
  } finally {
    // === 10. Close the pool safely ===
    if (pool && pool.connected) {
      await pool.close();
      console.log("🔒 Database pool connection closed");
    }
  }
};

//vendor dashboard
exports.vendorDashboard = async (req, res) => {
  if (mssql.connected) {
      await mssql.close();
      console.log("✅ Closed previous MSSQL connection");
    }
  let pool;

  try {
    // 1. Verify Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const username = decoded.username;

    // 2. Extract Query Params
    let { currentDate, fromDate, toDate, selectedOptions } = req.query;
    if (typeof selectedOptions === "string") {
      selectedOptions = selectedOptions.split(",").map((c) => c.trim());
    }
    if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
      return res.status(400).json({ message: "No company codes provided" });
    }

    // 3. Connect to Database Pool
    const user_ip = String(req.user.ip).trim();
    const user_port = req.user.port.trim();
    pool = await connectToUserDatabase(user_ip, user_port);
    if (!pool.connected)
      return res.status(500).json({ message: "Database connection failed" });

    const formattedCurrentDate = formatDate(currentDate);
    const formattedFromDate = formatDate(fromDate);
    const formattedToDate = formatDate(toDate);
    const reportType = "SALESDET";

    // 4. Clear previous data
    await pool.request().input("username", mssql.VarChar, username).query(`
      DELETE FROM [${rtweb}].dbo.tb_SALESVIEW WHERE REPUSER = @username;
    `);
    console.log("✅ Cleared tb_SALESVIEW");

    // 5. Execute Stored Procedures for each company
    for (const companyCode of selectedOptions) {
      const spRequest = pool.request();
      spRequest.input("COMPANY_CODE", mssql.VarChar, companyCode);
      spRequest.input("REPUSER", mssql.VarChar, username);
      spRequest.input("REPORT_TYPE", mssql.VarChar, reportType);

      if (fromDate && toDate) {
        spRequest.input("DATE1", mssql.VarChar, formattedFromDate);
        spRequest.input("DATE2", mssql.VarChar, formattedToDate);
        await spRequest.execute("Sp_SalesView");
      } else {
        spRequest.input("DATE", mssql.VarChar, formattedCurrentDate);
        await spRequest.execute("Sp_SalesCurView");
      }
      console.log(`✅ Stored procedure executed for company: ${companyCode}`);
    }

    // 6. Build safe IN clause (alphanumeric validated)
    const inClause = selectedOptions.map((c) => `'${c}'`).join(",");

    // 7. Run summary queries
    const dbTable = `[${rtweb}].dbo.tb_SALESVIEW`;

    const [vendorTableRecords, vendorAmountBarChart, vendorQuantityBarChart] =
      await Promise.all([
        pool.request().input("username", mssql.VarChar, username).query(`
          SELECT
            LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
            LTRIM(RTRIM(VENDORCODE)) AS VENDOR_CODE,
            VENDORNAME AS VENDOR_NAME,
            SUM(QTY) AS QUANTITY,
            SUM(AMOUNT) AS AMOUNT
          FROM ${dbTable}
          WHERE REPUSER = @username AND COMPANY_CODE IN (${inClause})
          GROUP BY COMPANY_CODE, VENDORCODE, VENDORNAME;
        `),

        pool.request().input("username", mssql.VarChar, username).query(`
          SELECT VENDORNAME, SUM(AMOUNT) AS AMOUNT
          FROM ${dbTable}
          WHERE REPUSER = @username AND COMPANY_CODE IN (${inClause})
          GROUP BY VENDORNAME;
        `),

        pool.request().input("username", mssql.VarChar, username).query(`
          SELECT VENDORNAME, SUM(QTY) AS QUANTITY
          FROM ${dbTable}
          WHERE REPUSER = @username AND COMPANY_CODE IN (${inClause})
          GROUP BY VENDORNAME;
        `),
      ]);

    // 8. Send Response
    return res.status(200).json({
      success: true,
      message: "Processed parameters for company codes",
      vendorTableRecords: vendorTableRecords.recordset,
      vendorAmountBarChart: vendorAmountBarChart.recordset,
      vendorQuantityBarChart: vendorQuantityBarChart.recordset,
    });
  } catch (error) {
    console.error("❌ Error in vendorDashboard:", error);
    return res.status(500).json({
      message: "Failed to load vendor dashboard",
      error: error.message,
    });
  } finally {
    // 9. Close the pool safely
    if (pool && pool.connected) {
      await pool.close();
      console.log("🔒 Database pool connection closed");
    }
  }
};

//hourly report dashboard
exports.hourlyReportDashboard = async (req, res) => {
  try {
    // 🔹 1. Token validation
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const username = decoded.username;

    // 🔹 2. Parse query parameters
    let { currentDate, fromDate, toDate, selectedOptions } = req.query;

    if (typeof selectedOptions === "string") {
      selectedOptions = selectedOptions.split(",").map((code) => code.trim());
    }

    if (
      !Array.isArray(selectedOptions) ||
      selectedOptions.length === 0 ||
      selectedOptions[0] === ""
    ) {
      return res.status(400).json({ message: "No company codes provided" });
    }

    // 🔹 3. Establish connection
    if (mssql.connected) {
      await mssql.close();
      console.log("✅ Closed previous connection");
    }

    const user_ip = String(req.user.ip).trim();
    const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
    if (!pool || !pool.connected)
      return res.status(500).json({ message: "Database connection failed" });

    console.log("✅ Connected to user database");

    const formattedCurrentDate = formatDate(currentDate);
    const formattedFromDate = formatDate(fromDate);
    const formattedToDate = formatDate(toDate);

    // 🔹 4. Helper: Retry on deadlock
    const executeWithRetry = async (queryFn, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await queryFn();
        } catch (err) {
          if (err.originalError?.number === 1205 && i < retries - 1) {
            console.warn(`⚠️ Deadlock. Retrying attempt ${i + 1}...`);
            await new Promise((r) => setTimeout(r, 1000));
          } else {
            throw err;
          }
        }
      }
    };

    // 🔹 5. Clear previous records
    try {
      await executeWithRetry(() =>
        pool
          .request()
          .input("username", mssql.NVarChar(50), username)
          .query(`USE ${rtweb}; DELETE FROM tb_HOURLYVIEW WHERE REPUSER = @username;`)
      );
      console.log("✅ Cleared previous records");
    } catch (deleteErr) {
      console.error("⚠️ Error deleting previous records:", deleteErr.message);
    }

    // 🔹 6. Run stored procedures for each company
    const errors = [];
    for (const companyCode of selectedOptions) {
      try {
        const spRequest = pool
          .request()
          .input("COMPANY_CODE", mssql.Char(10), companyCode)
          .input("REPUSER", mssql.NVarChar(50), username);

        if (formattedFromDate !== "NaN/NaN/NaN" && formattedToDate !== "NaN/NaN/NaN") {
          spRequest
            .input("DATE1", mssql.Char(10), formattedFromDate)
            .input("DATE2", mssql.Char(10), formattedToDate);
          await executeWithRetry(() => spRequest.execute(`${rtweb}.dbo.Sp_HourlySalesView`));
        } else {
          spRequest.input("DATE1", mssql.NVarChar(10), formattedCurrentDate);
          await executeWithRetry(() => spRequest.execute(`${rtweb}.dbo.Sp_HourlySalesCurView`));
        }

      } catch (spErr) {
        console.error(`⚠️ Error executing SP for ${companyCode}:`, spErr.message);
        errors.push(`Failed to execute SP for company ${companyCode}: ${spErr.message}`);
      }
    }

    if (errors.length > 0) {
      return res.status(500).json({ message: "Some stored procedures failed", errors });
    }

    // 🔹 7. Create view with parameterized company codes
const companyList = selectedOptions.map(c => `'${c}'`).join(", ");

const drop_query = `
  IF OBJECT_ID('dbo.vw_HOURLY_SALES_VIEW', 'V') IS NOT NULL
      DROP VIEW dbo.vw_HOURLY_SALES_VIEW;
`;

const create_query = `
CREATE VIEW dbo.vw_HOURLY_SALES_VIEW AS
SELECT TYPE, DATE, COMPANY_CODE, COMPANY_NAME, REPUSER, SUM(NetSale) AS TOTAL_SALES FROM tb_HOURLYVIEW
WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${companyList})
GROUP BY TYPE, DATE, COMPANY_CODE, COMPANY_NAME, REPUSER;
`;


try {

  await pool.request().query(drop_query);
  await pool.request().query(create_query);
  console.log(`✅ View created successfully in ${rtweb}`);
} catch (viewErr) {
  console.error("⚠️ Error creating view:", viewErr.message);
  return res.status(500).json({ message: "Failed to create view", error: viewErr.message });
}



    // 🔹 8. Fetch data from view
    const table_query = `
      USE [${rtweb}];
      SELECT 
          TYPE, DATE, COMPANY_CODE, COMPANY_NAME, TOTAL_SALES, REPUSER
      FROM dbo.vw_HOURLY_SALES_VIEW WHERE REPUSER = '${username}'
      ORDER BY DATE, TYPE;
    `;

    const tableRecords = await executeWithRetry(() => pool.request().query(table_query));
   

    return res.status(200).json({
      message: "Processed parameters for company codes",
      success: true,
      tableRecords: tableRecords.recordset || [],
    });
  } catch (error) {
    console.error("❌ Unhandled error in departmentDashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load department dashboard", error: error.message });
  }
};

//color size sales product dashboard data
exports.colorSizeSalesProductDashboard = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(403).json({ message: "Token is missing" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      const username = decoded.username;
      let { currentDate, fromDate, toDate, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0 || selectedOptions[0] === "") {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const user_ip = String(req.user.ip).trim();

      if (mssql.connected) {
        await mssql.close();
        console.log("✅ Closed previous MSSQL connection");
      }

      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());

      if (!pool?.connected)
        return res.status(500).json({ message: "Database connection failed" });

      const formattedCurrentDate = formatDate(currentDate);
      const formattedFromDate = formatDate(fromDate);
      const formattedToDate = formatDate(toDate);
      const reportType = "SALESDET";

      // Helper: retry mechanism for deadlocks
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
        const request = pool.request();
        request.input("username", mssql.VarChar, username);
        await request.query(`DELETE FROM tb_SALESVIEW WHERE REPUSER = @username;`);
      } catch (deleteErr) {
        console.error("Error deleting previous records:", deleteErr);
      }

      // Step 2: Execute SP for each company
      for (const companyCode of selectedOptions) {
        try {
          await executeWithRetry(async () => {
            const spRequest = pool.request();
            spRequest.input("COMPANY_CODE", mssql.VarChar, companyCode);
            spRequest.input("REPUSER", mssql.VarChar, username);
            spRequest.input("REPORT_TYPE", mssql.VarChar, reportType);

            if (fromDate && toDate) {
              spRequest.input("DATE1", mssql.VarChar, formattedFromDate);
              spRequest.input("DATE2", mssql.VarChar, formattedToDate);
              await spRequest.execute("Sp_SalesView");
            } else {
              spRequest.input("DATE", mssql.VarChar, formattedCurrentDate);
              await spRequest.execute("Sp_SalesCurView");
            }
          });
        } catch (spErr) {
          console.error(`Error executing stored procedure for ${companyCode}:`, spErr);
        }
      }

      // Step 3: Fetch product data
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");

      try {
        const fetchRequest = pool.request();
        const result = await fetchRequest.query(`
          USE ${rtweb};
          SELECT   
            LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
            LTRIM(RTRIM(PRODUCT_CODE)) AS PRODUCT_CODE,
            PRODUCT_NAME AS PRODUCT_NAME,
            SUM(QTY) AS QUANTITY,
            SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = '${username}' AND COMPANY_CODE IN (${inClause})
          GROUP BY COMPANY_CODE, PRODUCT_NAME, PRODUCT_CODE
        `);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          tableRecords: result.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching product data:", fetchErr);
        return res.status(500).json({ message: "Failed to fetch product data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in productDashboard:", error);
    return res.status(500).json({ message: "Failed to load product dashboard" });
  }
};

//color size sales product
exports.colorSizeSalesProduct = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(403).json({ message: "Token is missing" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((v) => v.trim());
      }

      if (!selectedOptions || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const inClause = selectedOptions.map((c) => `'${c}'`).join(",");

      // ---- CONNECT TO USER DATABASE ----
      const user_ip = String(req.user.ip).trim();
      if (mssql.connected) {
        await mssql.close();
        console.log("✅ Closed previous MSSQL connection");
      }

      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
      if (!pool?.connected)
        return res.status(500).json({ message: "Database connection failed" });

      // ---- FETCH DATA ----
      try {
        const request = pool.request();
        request.input("username", mssql.VarChar, username);
        request.input("code", mssql.VarChar, code);

        const query = `
          USE ${rtweb};
          SELECT   
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
            PRODUCT_CODE,
            PRODUCT_NAME,
            SUM(COSTPRICE) AS COSTPRICE,
            SUM(UNITPRICE) AS UNITPRICE,
            SUM(DISCOUNT) AS DISCOUNT,
            SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = @username 
            AND COMPANY_CODE IN (${inClause})
            AND PRODUCT_CODE = @code
          GROUP BY PRODUCT_CODE, PRODUCT_NAME, SERIALNO
        `;

        const result = await request.query(query);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          records: result.recordset || [],
        });
      } catch (fetchErr) {
        console.error("Error fetching product data:", fetchErr);
        return res.status(500).json({
          message: "Failed to fetch product data",
          error: fetchErr.message,
        });
      }
    });
  } catch (error) {
    console.error("Unhandled error in colorSizeSalesProduct:", error);
    return res
      .status(500)
      .json({ message: "Failed to load product dashboard" });
  }
};

//color size sales department dashboard
exports.colorSizeSalesDepartment = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(403).json({ message: "Token is missing" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((v) => v.trim());
      }

      if (!selectedOptions || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const inClause = selectedOptions.map((c) => `'${c}'`).join(",");

      const user_ip = String(req.user.ip).trim();

      if (mssql.connected) {
        await mssql.close();
        console.log("✅ Closed previous MSSQL connection");
      }

      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
      if (!pool?.connected)
        return res.status(500).json({ message: "Database connection failed" });

      try {
        const request = pool.request();
        request.input("username", mssql.VarChar, username);
        request.input("code", mssql.VarChar, code);

        const query = `
          USE ${rtweb};
          SELECT   
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
            PRODUCT_CODE,
            PRODUCT_NAME,
            SUM(COSTPRICE) AS COSTPRICE,
            SUM(UNITPRICE) AS UNITPRICE,
            SUM(DISCOUNT) AS DISCOUNT,
            SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = @username 
            AND COMPANY_CODE IN (${inClause})
            AND DEPTCODE = @code
          GROUP BY PRODUCT_CODE, PRODUCT_NAME, SERIALNO;
        `;

        const result = await request.query(query);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          records: result.recordset || [],
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching department data:", fetchErr);
        return res.status(500).json({
          message: "Failed to fetch department data",
          error: fetchErr.message,
        });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in colorSizeSalesDepartment:", error);
    return res
      .status(500)
      .json({ message: "Failed to load department dashboard" });
  }
};

//color size sales category dashboard
exports.colorSizeSalesCategory = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(403).json({ message: "Token is missing" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((v) => v.trim());
      }

      if (!selectedOptions || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const inClause = selectedOptions.map((c) => `'${c}'`).join(",");

      const user_ip = String(req.user.ip).trim();

      // Close any existing connections before opening a new one
      if (mssql.connected) {
        await mssql.close();
        console.log("✅ Closed previous MSSQL connection");
      }

      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
      if (!pool?.connected)
        return res.status(500).json({ message: "Database connection failed" });

      try {
        const request = pool.request();
        request.input("username", mssql.VarChar, username);
        request.input("code", mssql.VarChar, code);

        const query = `
          USE ${rtweb};
          SELECT   
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
            PRODUCT_CODE,
            PRODUCT_NAME,
            SUM(COSTPRICE) AS COSTPRICE,
            SUM(UNITPRICE) AS UNITPRICE,
            SUM(DISCOUNT) AS DISCOUNT,
            SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = @username 
            AND COMPANY_CODE IN (${inClause})
            AND CATCODE = @code
          GROUP BY PRODUCT_CODE, PRODUCT_NAME, SERIALNO;
        `;

        const result = await request.query(query);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          records: result.recordset || [],
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching category data:", fetchErr);
        return res.status(500).json({
          message: "Failed to fetch category data",
          error: fetchErr.message,
        });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in colorSizeSalesCategory:", error);
    return res
      .status(500)
      .json({ message: "Failed to load category dashboard" });
  }
};

//color size sales category dashboard
exports.colorSizeSalesSubCategory = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(403).json({ message: "Token is missing" });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((v) => v.trim());
      }

      if (!selectedOptions || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      const inClause = selectedOptions.map((c) => `'${c}'`).join(",");

      const user_ip = String(req.user.ip).trim();

      // 🔒 Ensure old connections are closed before reconnecting
      if (mssql.connected) {
        await mssql.close();
        console.log("✅ Closed previous MSSQL connection");
      }

      console.log('Connecting to user database at IP:', user_ip, 'Port:', req.user.port.trim());
      // 🔌 Connect dynamically to user's database
      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
      if (!pool?.connected)
        return res.status(500).json({ message: "Database connection failed" });

      try {
        const request = pool.request();
        request.input("username", mssql.VarChar, username);
        request.input("code", mssql.VarChar, code);

        const query = `
          USE ${rtweb};
          SELECT   
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
            PRODUCT_CODE,
            PRODUCT_NAME,
            SUM(COSTPRICE) AS COSTPRICE,
            SUM(UNITPRICE) AS UNITPRICE,
            SUM(DISCOUNT) AS DISCOUNT,
            SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = @username 
            AND COMPANY_CODE IN (${inClause})
            AND SCATCODE = @code
          GROUP BY PRODUCT_CODE, PRODUCT_NAME, SERIALNO;
        `;

        const result = await request.query(query);

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          records: result.recordset || [],
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching sub-category data:", fetchErr);
        return res.status(500).json({
          message: "Failed to fetch sub-category data",
          error: fetchErr.message,
        });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in colorSizeSalesSubCategory:", error);
    return res
      .status(500)
      .json({ message: "Failed to load sub-category dashboard" });
  }
};

//color size sales vendor dashboard
exports.colorSizeSalesVendor = async (req, res) => {
  try {
    // Step 1: Validate token
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    // Step 2: Verify token
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      const username = decoded.username;
      let { code, selectedOptions } = req.query;

      // Step 3: Normalize selectedOptions input
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",");
      }

      const inClause = selectedOptions
        .map((c) => `'${c.trim()}'`)
        .join(",");

      try {
        // Step 4: Connect using connection pool
        const user_ip = String(req.user.ip).trim();
        const user_port = String(req.user.port).trim();

        if (mssql.connected) {
      await mssql.close();
      console.log("✅ Closed previous MSSQL connection");
    }
        const pool = await connectToUserDatabase(user_ip, user_port);
        if (!pool.connected)
          return res.status(500).json({ message: "Database connection failed" });

        // Step 5: Execute query with USE [rtweb]
        const result = await pool.request().query(`
          USE ${rtweb};
          SELECT 
            LTRIM(RTRIM(SERIALNO)) AS SERIALNO,
            PRODUCT_CODE,
            PRODUCT_NAME,
            SUM(COSTPRICE) AS COSTPRICE,
            SUM(UNITPRICE) AS UNITPRICE,
            SUM(DISCOUNT) AS DISCOUNT,
            SUM(AMOUNT) AS AMOUNT
          FROM tb_SALESVIEW
          WHERE REPUSER = '${username}'
            AND COMPANY_CODE IN (${inClause})
            AND VENDORCODE = '${code}'
          GROUP BY PRODUCT_CODE, PRODUCT_NAME, SERIALNO;
        `);

        // Step 6: Return results
        return res.status(200).json({
          success: true,
          message: "Processed parameters for company codes",
          records: result.recordset || [],
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching vendor sales data:", fetchErr);
        return res
          .status(500)
          .json({ message: "Failed to fetch vendor sales data" });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in vendor dashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load vendor sales dashboard" });
  }
};

//color size stock product dashboard data
exports.colorSizeStockProductDashboard = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(403).json({ message: "Token is missing" });

    // -------------------------
    // 2️⃣ Verify Token
    // -------------------------
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });

      let {
        currentDate,
        date,
        rowSelect,
        productCode,
        state,
        selectedOptions,
      } = req.query;

      // Convert selectedOptions to array if it's a string
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (
        !Array.isArray(selectedOptions) ||
        selectedOptions.length === 0 ||
        selectedOptions[0] === ""
      ) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      // -------------------------
      // 3️⃣ Establish Connection (pooled)
      // -------------------------
      const user_ip = String(req.user.ip).trim();
      const user_port = String(req.user.port).trim();

      if (mssql.connected) {
      await mssql.close();
      console.log("✅ Closed previous MSSQL connection");
    }

      const pool = await connectToUserDatabase(user_ip, user_port);
      if (!pool.connected)
        return res.status(500).json({ message: "Database connection failed" });

      // Format dates
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);

      // -------------------------
      // 4️⃣ Build Query to Create/Update View
      // -------------------------
      let query;

      if (formattedCurrentDate === formattedDate) {
        query = `
          USE [${rtweb}];
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                LTRIM(RTRIM(S.SERIALNO)) AS SERIALNO,
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
                LTRIM(RTRIM(S.SERIALNO)),
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      } else {
        query = `
          USE [${rtweb}];
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                LTRIM(RTRIM(S.SERIALNO)) AS SERIALNO,
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE ((BIN = ''F'') OR (BIN IS NULL))
              AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                LTRIM(RTRIM(S.SERIALNO)),
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      }

      // -------------------------
      // 5️⃣ Execute View Update
      // -------------------------
      try {
        await pool.request().query(query);
      } catch (error) {
        console.error("❌ Error updating stock view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      // -------------------------
      // 6️⃣ Fetch Table Records
      // -------------------------
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");
      let tableRecords;
      let rowRecords = [];
      let rowDataStatus = false;

      try {
        const useDb = `USE [${rtweb}];`;

        if (state === true || String(state).toLowerCase() === "true") {
          // State = true (with cost/sales values)
          if (rowSelect === true || String(rowSelect).toLowerCase() === "true") {
            const rowQuery = `
              ${useDb}
              SELECT   
                LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(PRODUCT_CODE)) AS PRODUCT_CODE,
                SERIALNO,
                SUM(QTY) AS QUANTITY,
                SUM(QTY * COSTPRICE) AS COST_VALUE,
                SUM(QTY * SCALEPRICE) AS SALES_VALUE,
                COSTPRICE,
                SCALEPRICE
              FROM dbo.vw_STOCK_BALANCE
              WHERE COMPANY_CODE IN (${inClause}) AND PRODUCT_CODE = '${productCode}'
              GROUP BY COMPANY_CODE, PRODUCT_CODE, COSTPRICE, SCALEPRICE, SERIALNO;
            `;
            const result = await pool.request().query(rowQuery);
            rowRecords = result.recordset || [];
            rowDataStatus = true;
          }

          const tableQuery = `
            ${useDb}
            SELECT   
              LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(PRODUCT_CODE)) AS PRODUCT_CODE,
              PRODUCT_NAMELONG AS PRODUCT_NAME,
              SERIALNO,
              SUM(QTY) AS QUANTITY,
              SUM(QTY * COSTPRICE) AS COST_VALUE,
              SUM(QTY * SCALEPRICE) AS SALES_VALUE,
              COSTPRICE,
              SCALEPRICE
            FROM dbo.vw_STOCK_BALANCE
            WHERE COMPANY_CODE IN (${inClause})
            GROUP BY COMPANY_CODE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE, SERIALNO;
          `;
          const result = await pool.request().query(tableQuery);
          tableRecords = result.recordset || [];
        } else {
          // State = false (without cost/sales values)
          if (rowSelect === true || String(rowSelect).toLowerCase() === "true") {
            const rowQuery = `
              ${useDb}
              SELECT   
                LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(PRODUCT_CODE)) AS PRODUCT_CODE,
                SERIALNO,
                SUM(QTY) AS QUANTITY,
                COSTPRICE,
                SCALEPRICE
              FROM dbo.vw_STOCK_BALANCE
              WHERE COMPANY_CODE IN (${inClause}) AND PRODUCT_CODE = '${productCode}'
              GROUP BY COMPANY_CODE, PRODUCT_CODE, COSTPRICE, SCALEPRICE, SERIALNO;
            `;
            const result = await pool.request().query(rowQuery);
            rowRecords = result.recordset || [];
            rowDataStatus = true;
          }

          const tableQuery = `
            ${useDb}
            SELECT   
              LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(PRODUCT_CODE)) AS PRODUCT_CODE,
              PRODUCT_NAMELONG AS PRODUCT_NAME,
              SERIALNO,
              SUM(QTY) AS QUANTITY,
              COSTPRICE,
              SCALEPRICE
            FROM dbo.vw_STOCK_BALANCE
            WHERE COMPANY_CODE IN (${inClause})
            GROUP BY COMPANY_CODE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE, SERIALNO;
          `;
          const result = await pool.request().query(tableQuery);
          tableRecords = result.recordset || [];
        }

        // -------------------------
        // ✅ Success Response
        // -------------------------
        return res.status(200).json({
          success: true,
          message: "Processed parameters for company codes",
          tableRecords,
          rowRecords,
          rowDataStatus,
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching product data:", fetchErr);
        return res.status(500).json({ message: "Failed to fetch product data" });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in productDashboard:", error);
    return res.status(500).json({ message: "Failed to load product dashboard" });
  }
};

//color size stock department dashboard data
exports.colorSizeStockDepartmentDashboard = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ message: "No authorization token provided" });
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

      let {
        currentDate,
        date,
        rowSelect,
        departmentCode,
        state,
        selectedOptions,
      } = req.query;

      // Convert selectedOptions to array if it's a string
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (
        !Array.isArray(selectedOptions) ||
        selectedOptions.length === 0 ||
        selectedOptions[0] === ""
      ) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      // -------------------------
      // 3️⃣ Establish MSSQL Connection
      // -------------------------
      const user_ip = String(req.user.ip).trim();
      const user_port = req.user.port.trim();

      // Always close any previous connection
      if (mssql.connected) {
        await mssql.close();
        console.log("✅ Closed previous MSSQL connection");
      }

      const pool = await connectToUserDatabase(user_ip, user_port);

      if (!pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      // -------------------------
      // 4️⃣ Prepare Query Context
      // -------------------------
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);
      // -------------------------
      // 5️⃣ Create/Update View
      // -------------------------
      let viewQuery;
      if (formattedCurrentDate === formattedDate) {
        viewQuery = `
          USE [${rtweb}];
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                LTRIM(RTRIM(S.SERIALNO)) AS SERIALNO,
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE (BIN = ''F'') OR (BIN IS NULL)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                LTRIM(RTRIM(S.SERIALNO)),
                P.DEPTCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');`;
      } else {
        viewQuery = `
          USE [${rtweb}];
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                LTRIM(RTRIM(S.SERIALNO)) AS SERIALNO,
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE ((BIN = ''F'') OR (BIN IS NULL))
              AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                LTRIM(RTRIM(S.SERIALNO)),
                P.DEPTCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      }

      try {
        await pool.request().query(viewQuery);
        console.log("✅ Stock balance view updated successfully");
      } catch (error) {
        console.error("❌ Error updating view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      // -------------------------
      // 6️⃣ Fetch Table & Row Records
      // -------------------------
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");
      let tableRecords = [];
      let rowRecords = [];
      let rowDataStatus = false;

      try {
        if (state === true || String(state).toLowerCase() === "true") {
          // Include cost/sales value
          if (rowSelect === true || String(rowSelect).toLowerCase() === "true") {
            rowRecords = await pool.request().query(`
              USE [${rtweb}];
              SELECT   
                  LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                  LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                  LTRIM(RTRIM(s.DEPTCODE)) AS DEPARTMENT_CODE,
                  d.DEPTNAME AS DEPARTMENT_NAME,
                  LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                  s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                  SUM(s.QTY) AS QUANTITY,
                  SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
                  SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
                  s.COSTPRICE,
                  s.SCALEPRICE
              FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
              LEFT JOIN [${posback}].dbo.tb_DEPARTMENT d
                  ON LTRIM(RTRIM(s.DEPTCODE)) = LTRIM(RTRIM(d.DEPTCODE))
              WHERE s.COMPANY_CODE IN (${inClause}) 
                AND s.DEPTCODE = '${departmentCode}'
              GROUP BY 
                  s.COMPANY_CODE, s.PRODUCT_CODE, s.DEPTCODE, 
                  LTRIM(RTRIM(s.SERIALNO)), d.DEPTNAME, 
                  s.PRODUCT_NAMELONG, s.COSTPRICE, s.SCALEPRICE;
            `);
            rowDataStatus = true;
          }

          tableRecords = await pool.request().query(`
            USE [${rtweb}];
            SELECT   
                LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                LTRIM(RTRIM(s.DEPTCODE)) AS DEPARTMENT_CODE,
                d.DEPTNAME AS DEPARTMENT_NAME,
                s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                SUM(s.QTY) AS QUANTITY,
                SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
                SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
                s.COSTPRICE,
                s.SCALEPRICE
            FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
            LEFT JOIN [${posback}].dbo.tb_DEPARTMENT d
                ON LTRIM(RTRIM(s.DEPTCODE)) = LTRIM(RTRIM(d.DEPTCODE))
            WHERE s.COMPANY_CODE IN (${inClause})
            GROUP BY 
                s.COMPANY_CODE, s.PRODUCT_CODE, s.DEPTCODE, 
                LTRIM(RTRIM(s.SERIALNO)), d.DEPTNAME, 
                s.PRODUCT_NAMELONG, s.COSTPRICE, s.SCALEPRICE;
          `);
        } else {
          // Without cost/sales value
          if (rowSelect === true || String(rowSelect).toLowerCase() === "true") {
            rowRecords = await pool.request().query(`
              USE [${rtweb}];
              SELECT   
                  LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                  LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                  LTRIM(RTRIM(s.DEPTCODE)) AS DEPARTMENT_CODE,
                  d.DEPTNAME AS DEPARTMENT_NAME,
                  s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                  LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                  SUM(s.QTY) AS QUANTITY,
                  s.COSTPRICE,
                  s.SCALEPRICE
              FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
              LEFT JOIN [${posback}].dbo.tb_DEPARTMENT d
                  ON LTRIM(RTRIM(s.DEPTCODE)) = LTRIM(RTRIM(d.DEPTCODE))
              WHERE s.COMPANY_CODE IN (${inClause}) 
                AND s.DEPTCODE = '${departmentCode}'
              GROUP BY 
                  s.COMPANY_CODE, s.PRODUCT_CODE, s.DEPTCODE, 
                  LTRIM(RTRIM(s.SERIALNO)), d.DEPTNAME, 
                  s.PRODUCT_NAMELONG, s.COSTPRICE, s.SCALEPRICE;
            `);
            rowDataStatus = true;
          }

          tableRecords = await pool.request().query(`
            USE [${rtweb}];
            SELECT   
                LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                LTRIM(RTRIM(s.DEPTCODE)) AS DEPARTMENT_CODE,
                d.DEPTNAME AS DEPARTMENT_NAME,
                s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                SUM(s.QTY) AS QUANTITY,
                s.COSTPRICE,
                s.SCALEPRICE
            FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
            LEFT JOIN [${posback}].dbo.tb_DEPARTMENT d
                ON LTRIM(RTRIM(s.DEPTCODE)) = LTRIM(RTRIM(d.DEPTCODE))
            WHERE s.COMPANY_CODE IN (${inClause})
            GROUP BY 
                s.COMPANY_CODE, s.PRODUCT_CODE, s.DEPTCODE, 
                LTRIM(RTRIM(s.SERIALNO)), d.DEPTNAME, 
                s.PRODUCT_NAMELONG, s.COSTPRICE, s.SCALEPRICE;
          `);
        }

        return res.status(200).json({
          success: true,
          message: "Processed parameters for company codes",
          tableRecords: tableRecords.recordset || [],
          rowRecords: rowRecords.recordset || [],
          rowDataStatus,
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching product data:", fetchErr);
        return res.status(500).json({ message: "Failed to fetch product data" });
      } finally {
        await pool.close();
        console.log("✅ MSSQL pool closed successfully");
      }
    });
  } catch (error) {
    console.error("🔥 Unhandled error in colorSizeStockDepartmentDashboard:", error);
    return res.status(500).json({ message: "Failed to load product dashboard" });
  }
};

//color size stock category dashboard data
exports.colorSizeStockCategoryDashboard = async (req, res) => {
  try {
    // 1️⃣ Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(403).json({ message: "No authorization token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    // 2️⃣ Verify JWT
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Invalid or expired token" });

      // Extract query params
      let {
        currentDate,
        date,
        rowSelect,
        categoryCode,
        state,
        selectedOptions,
      } = req.query;

      // Normalize boolean flags
      rowSelect = rowSelect === true || String(rowSelect).toLowerCase() === "true";
      state = state === true || String(state).toLowerCase() === "true";

      // Convert and sanitize selectedOptions
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions
          .split(",")
          .map((code) => code.trim())
          .filter((x) => x);
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0)
        return res.status(400).json({ message: "No company codes provided" });

      // 3️⃣ Database connection
      const user_ip = String(req.user.ip).trim();
      if (mssql.connected) {
        await mssql.close();
        console.log("✅ Closed previous MSSQL connection");
      }

      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
      if (!pool || !pool.connected)
        return res.status(500).json({ message: "Database connection failed" });

      const request = pool.request();

      // 4️⃣ Build stock view
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);

      const viewQuery =
        formattedCurrentDate === formattedDate
          ? `
          USE [${rtweb}];
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                LTRIM(RTRIM(S.SERIALNO)) AS SERIALNO,
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.CATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE (BIN = ''F'' OR BIN IS NULL)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                LTRIM(RTRIM(S.SERIALNO)),
                P.DEPTCODE,
                P.CATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');`
          : `
          USE [${rtweb}];
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                LTRIM(RTRIM(S.SERIALNO)) AS SERIALNO,
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.CATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE ((BIN = ''F'') OR (BIN IS NULL))
              AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                LTRIM(RTRIM(S.SERIALNO)),
                P.DEPTCODE,
                P.CATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');`;

      try {
        await request.query(viewQuery);
        console.log("✅ vw_STOCK_BALANCE view refreshed successfully");
      } catch (error) {
        console.error("❌ Error creating stock view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      // 5️⃣ Fetch records
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");
      let tableRecords, rowRecords, rowDataStatus = false;

      try {
        if (state) {
          if (rowSelect) {
            rowRecords = await pool.request().query(`
              USE [${rtweb}];
              SELECT   
                LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                LTRIM(RTRIM(s.CATCODE)) AS CATEGORY_CODE,
                c.CATNAME AS CATEGORY_NAME,
                LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                SUM(s.QTY) AS QUANTITY,
                SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
                SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
                s.COSTPRICE, s.SCALEPRICE
              FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
              LEFT JOIN [${posback}].dbo.tb_CATEGORY c
                ON LTRIM(RTRIM(s.CATCODE)) = LTRIM(RTRIM(c.CATCODE))
              WHERE s.COMPANY_CODE IN (${inClause}) AND s.CATCODE = '${categoryCode}'
              GROUP BY 
                s.COMPANY_CODE, s.PRODUCT_CODE, s.CATCODE, c.CATNAME,
                LTRIM(RTRIM(s.SERIALNO)), s.PRODUCT_NAMELONG,
                s.COSTPRICE, s.SCALEPRICE;
            `);
            rowDataStatus = true;
          }

          tableRecords = await pool.request().query(`
            USE [${rtweb}];
            SELECT   
              LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
              LTRIM(RTRIM(s.CATCODE)) AS CATEGORY_CODE,
              c.CATNAME AS CATEGORY_NAME,
              s.PRODUCT_NAMELONG AS PRODUCT_NAME,
              LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
              SUM(s.QTY) AS QUANTITY,
              SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
              SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
              s.COSTPRICE, s.SCALEPRICE
            FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
            LEFT JOIN [${posback}].dbo.tb_CATEGORY c
              ON LTRIM(RTRIM(s.CATCODE)) = LTRIM(RTRIM(c.CATCODE))
            WHERE s.COMPANY_CODE IN (${inClause})
            GROUP BY 
              s.COMPANY_CODE, s.PRODUCT_CODE, s.CATCODE, c.CATNAME,
              LTRIM(RTRIM(s.SERIALNO)), s.PRODUCT_NAMELONG,
              s.COSTPRICE, s.SCALEPRICE;
          `);
        } else {
          if (rowSelect) {
            rowRecords = await pool.request().query(`
              USE [${rtweb}];
              SELECT   
                LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                LTRIM(RTRIM(s.CATCODE)) AS CATEGORY_CODE,
                c.CATNAME AS CATEGORY_NAME,
                s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                SUM(s.QTY) AS QUANTITY,
                s.COSTPRICE, s.SCALEPRICE
              FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
              LEFT JOIN [${posback}].dbo.tb_CATEGORY c
                ON LTRIM(RTRIM(s.CATCODE)) = LTRIM(RTRIM(c.CATCODE))
              WHERE s.COMPANY_CODE IN (${inClause}) AND s.CATCODE = '${categoryCode}'
              GROUP BY 
                s.COMPANY_CODE, s.PRODUCT_CODE, s.CATCODE, c.CATNAME,
                LTRIM(RTRIM(s.SERIALNO)), s.PRODUCT_NAMELONG,
                s.COSTPRICE, s.SCALEPRICE;
            `);
            rowDataStatus = true;
          }

          tableRecords = await pool.request().query(`
            USE [${rtweb}];
            SELECT   
              LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
              LTRIM(RTRIM(s.CATCODE)) AS CATEGORY_CODE,
              c.CATNAME AS CATEGORY_NAME,
              s.PRODUCT_NAMELONG AS PRODUCT_NAME,
              LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
              SUM(s.QTY) AS QUANTITY,
              s.COSTPRICE, s.SCALEPRICE
            FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
            LEFT JOIN [${posback}].dbo.tb_CATEGORY c
              ON LTRIM(RTRIM(s.CATCODE)) = LTRIM(RTRIM(c.CATCODE))
            WHERE s.COMPANY_CODE IN (${inClause})
            GROUP BY 
              s.COMPANY_CODE, s.PRODUCT_CODE, s.CATCODE, c.CATNAME,
              LTRIM(RTRIM(s.SERIALNO)), s.PRODUCT_NAMELONG,
              s.COSTPRICE, s.SCALEPRICE;
          `);
        }

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          tableRecords: tableRecords.recordset || [],
          rowRecords: rowRecords ? rowRecords.recordset || [] : [],
          rowDataStatus,
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching product data:", fetchErr);
        return res.status(500).json({ message: "Failed to fetch product data" });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in colorSizeStockCategoryDashboard:", error);
    return res.status(500).json({ message: "Failed to load product dashboard" });
  }
};

//color size stock sub category dashboard data
exports.colorSizeStockSubCategoryDashboard = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ message: "No authorization token provided" });
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

      // Extract query params
      let { currentDate, date, rowSelect, subCategoryCode, state, selectedOptions } = req.query;

      // Convert boolean-like strings
      rowSelect = rowSelect === true || String(rowSelect).toLowerCase() === "true";
      state = state === true || String(state).toLowerCase() === "true";

      // Parse selectedOptions
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0 || !selectedOptions[0]) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      // -------------------------
      // 3️⃣ Connect to DB
      // -------------------------
      const user_ip = String(req.user.ip).trim();
      if (mssql.connected) {
        await mssql.close();
        console.log("✅ Closed previous MSSQL connection");
      }

      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
      if (!pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }
      const request = pool.request();

      // -------------------------
      // 4️⃣ Build & Execute View Creation Query
      // -------------------------
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);

      let viewQuery;

      if (formattedCurrentDate === formattedDate) {
        viewQuery = `
          USE [${rtweb}];
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                LTRIM(RTRIM(S.SERIALNO)) AS SERIALNO,
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.CATCODE,
                P.SCATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE (BIN = ''F'') OR (BIN IS NULL)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                LTRIM(RTRIM(S.SERIALNO)),
                P.DEPTCODE,
                P.CATCODE,
                P.SCATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      } else {
        viewQuery = `
          USE [${rtweb}];
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL
              DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                LTRIM(RTRIM(S.SERIALNO)) AS SERIALNO,
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.CATCODE,
                P.SCATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE ((BIN = ''F'') OR (BIN IS NULL))
              AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                LTRIM(RTRIM(S.SERIALNO)),
                P.DEPTCODE,
                P.CATCODE,
                P.SCATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      }

      try {
        await request.query(viewQuery);
      } catch (error) {
        console.error("❌ Error updating stock view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      // -------------------------
      // 5️⃣ Fetch Data
      // -------------------------
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");
      let tableRecords, rowRecords, rowDataStatus = false;

      try {
        if (state) {
          if (rowSelect) {
            rowRecords = await pool.request().query(`
              USE [${rtweb}];
              SELECT   
                  LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                  LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                  LTRIM(RTRIM(s.SCATCODE)) AS SUBCATEGORY_CODE,
                  c.SCATNAME AS SUBCATEGORY_NAME,
                  s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                  LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                  SUM(s.QTY) AS QUANTITY,
                  SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
                  SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
                  s.COSTPRICE,
                  s.SCALEPRICE
              FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
              LEFT JOIN [${posback}].dbo.tb_SUBCATEGORY c
                  ON LTRIM(RTRIM(s.SCATCODE)) = LTRIM(RTRIM(c.SCATCODE))
              WHERE s.COMPANY_CODE IN (${inClause}) 
                AND s.SCATCODE = '${subCategoryCode}'
              GROUP BY 
                  s.COMPANY_CODE, 
                  s.PRODUCT_CODE, 
                  s.SCATCODE, 
                  LTRIM(RTRIM(s.SERIALNO)),
                  c.SCATNAME,
                  s.PRODUCT_NAMELONG, 
                  s.COSTPRICE, 
                  s.SCALEPRICE;
            `);
            rowDataStatus = true;
          }

          tableRecords = await pool.request().query(`
            USE [${rtweb}];
            SELECT   
                LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                LTRIM(RTRIM(s.SCATCODE)) AS SUBCATEGORY_CODE,
                c.SCATNAME AS SUBCATEGORY_NAME,
                s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                SUM(s.QTY) AS QUANTITY,
                SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
                SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
                s.COSTPRICE,
                s.SCALEPRICE
            FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
            LEFT JOIN [${posback}].dbo.tb_SUBCATEGORY c
                ON LTRIM(RTRIM(s.SCATCODE)) = LTRIM(RTRIM(c.SCATCODE))
            WHERE s.COMPANY_CODE IN (${inClause})
            GROUP BY 
                s.COMPANY_CODE, 
                s.PRODUCT_CODE, 
                s.SCATCODE, 
                c.SCATNAME,
                s.PRODUCT_NAMELONG, 
                s.COSTPRICE, 
                s.SCALEPRICE;
          `);
        } else {
          if (rowSelect) {
            rowRecords = await pool.request().query(`
              USE [${rtweb}];
              SELECT   
                  LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                  LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                  LTRIM(RTRIM(s.SCATCODE)) AS SUBCATEGORY_CODE,
                  c.SCATNAME AS SUBCATEGORY_NAME,
                  s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                  LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                  SUM(s.QTY) AS QUANTITY,
                  s.COSTPRICE,
                  s.SCALEPRICE
              FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
              LEFT JOIN [${posback}].dbo.tb_SUBCATEGORY c
                  ON LTRIM(RTRIM(s.SCATCODE)) = LTRIM(RTRIM(c.SCATCODE))
              WHERE s.COMPANY_CODE IN (${inClause}) 
                AND s.SCATCODE = '${subCategoryCode}'
              GROUP BY 
                  s.COMPANY_CODE, 
                  s.PRODUCT_CODE, 
                  s.SCATCODE, 
                  LTRIM(RTRIM(s.SERIALNO)),
                  c.SCATNAME,
                  s.PRODUCT_NAMELONG, 
                  s.COSTPRICE, 
                  s.SCALEPRICE;
            `);
            rowDataStatus = true;
          }

          tableRecords = await pool.request().query(`
            USE [${rtweb}];
            SELECT   
                LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                LTRIM(RTRIM(s.SCATCODE)) AS SUBCATEGORY_CODE,
                c.SCATNAME AS SUBCATEGORY_NAME,
                s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                SUM(s.QTY) AS QUANTITY,
                s.COSTPRICE,
                s.SCALEPRICE
            FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
            LEFT JOIN [${posback}].dbo.tb_SUBCATEGORY c
                ON LTRIM(RTRIM(s.SCATCODE)) = LTRIM(RTRIM(c.SCATCODE))
            WHERE s.COMPANY_CODE IN (${inClause})
            GROUP BY 
                s.COMPANY_CODE, 
                s.PRODUCT_CODE, 
                s.SCATCODE, 
                LTRIM(RTRIM(s.SERIALNO)),
                c.SCATNAME,
                s.PRODUCT_NAMELONG, 
                s.COSTPRICE, 
                s.SCALEPRICE;
          `);
        }

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          tableRecords: tableRecords.recordset || [],
          rowRecords: rowRecords ? rowRecords.recordset || [] : [],
          rowDataStatus,
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching product data:", fetchErr);
        return res.status(500).json({ message: "Failed to fetch product data" });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in subCategoryDashboard:", error);
    return res.status(500).json({ message: "Failed to load sub category dashboard" });
  }
};

//color size stock vendor dashboard data
exports.colorSizeStockVendorDashboard = async (req, res) => {
  try {
    // 1️⃣ Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(403).json({ message: "No authorization token provided" });
    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Token is missing" });

    // 2️⃣ Verify Token
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Invalid or expired token" });

      let { currentDate, date, rowSelect, vendorCode, state, selectedOptions } = req.query;

      rowSelect = rowSelect === true || String(rowSelect).toLowerCase() === "true";
      state = state === true || String(state).toLowerCase() === "true";

      if (typeof selectedOptions === "string") selectedOptions = selectedOptions.split(",").map(c => c.trim());
      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0 || !selectedOptions[0]) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      // 3️⃣ DB Connection
      const user_ip = String(req.user.ip).trim();
      if (mssql.connected) await mssql.close();

      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
      if (!pool.connected) return res.status(500).json({ message: "Database connection failed" });

      const request = pool.request();

      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);

      // 4️⃣ Build View Query
      const viewQuery = `
        USE [${rtweb}];
        IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL DROP VIEW dbo.vw_STOCK_BALANCE;
        EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
          SELECT 
            S.PRODUCT_CODE,
            S.COMPANY_CODE,
            LTRIM(RTRIM(S.SERIALNO)) AS SERIALNO,
            ISNULL(SUM(S.STOCK),0) AS QTY,
            P.PRODUCT_NAMELONG,
            P.VENDORCODE,
            P.COSTPRICE,
            P.SCALEPRICE
          FROM ${posback}.dbo.tb_STOCK S
          INNER JOIN ${posback}.dbo.tb_PRODUCT P ON P.PRODUCT_CODE = S.PRODUCT_CODE
          WHERE ((BIN = ''F'') OR (BIN IS NULL)) 
            ${formattedCurrentDate !== formattedDate ? `AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)` : ""}
          GROUP BY 
            S.PRODUCT_CODE,
            S.COMPANY_CODE,
            LTRIM(RTRIM(S.SERIALNO)),
            P.VENDORCODE,
            P.COSTPRICE,
            P.SCALEPRICE,
            P.PRODUCT_NAMELONG');
      `;

      try { await request.query(viewQuery); } 
      catch (err) { console.error("Error updating view:", err); return res.status(500).json({ message: "Error updating stock view" }); }

      // 5️⃣ Fetch Data
      const inClause = selectedOptions.map(c => `'${c}'`).join(",");
      let tableRecords, rowRecords, rowDataStatus = false;

      try {
        if (state) {
          if (rowSelect) {
            rowRecords = await pool.request().query(`
              USE [${rtweb}];
              SELECT 
                LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                LTRIM(RTRIM(s.VENDORCODE)) AS VENDOR_CODE,
                LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                v.VENDORNAME AS VENDOR_NAME,
                s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                SUM(s.QTY) AS QUANTITY,
                SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
                SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
                s.COSTPRICE,
                s.SCALEPRICE
              FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
              LEFT JOIN [${posback}].dbo.tb_VENDOR v
                ON LTRIM(RTRIM(s.VENDORCODE)) = LTRIM(RTRIM(v.VENDORCODE))
              WHERE s.COMPANY_CODE IN (${inClause}) AND s.VENDORCODE = '${vendorCode}'
              GROUP BY 
                s.COMPANY_CODE, s.PRODUCT_CODE, s.VENDORCODE, v.VENDORNAME, 
                LTRIM(RTRIM(s.SERIALNO)), s.PRODUCT_NAMELONG, s.COSTPRICE, s.SCALEPRICE;
            `);
            rowDataStatus = true;
          }

          tableRecords = await pool.request().query(`
            USE [${rtweb}];
            SELECT 
              LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
              LTRIM(RTRIM(s.VENDORCODE)) AS VENDOR_CODE,
              v.VENDORNAME AS VENDOR_NAME,
              LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
              s.PRODUCT_NAMELONG AS PRODUCT_NAME,
              SUM(s.QTY) AS QUANTITY,
              SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
              SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
              s.COSTPRICE,
              s.SCALEPRICE
            FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
            LEFT JOIN [${posback}].dbo.tb_VENDOR v
              ON LTRIM(RTRIM(s.VENDORCODE)) = LTRIM(RTRIM(v.VENDORCODE))
            WHERE s.COMPANY_CODE IN (${inClause})
            GROUP BY s.COMPANY_CODE, s.PRODUCT_CODE, s.VENDORCODE, LTRIM(RTRIM(s.SERIALNO)), v.VENDORNAME, s.PRODUCT_NAMELONG, s.COSTPRICE, s.SCALEPRICE;
          `);
        } else {
          if (rowSelect) {
            rowRecords = await pool.request().query(`
              USE [${rtweb}];
              SELECT 
                LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
                LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
                LTRIM(RTRIM(s.VENDORCODE)) AS VENDOR_CODE,
                LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
                v.VENDORNAME AS VENDOR_NAME,
                s.PRODUCT_NAMELONG AS PRODUCT_NAME,
                SUM(s.QTY) AS QUANTITY,
                s.COSTPRICE,
                s.SCALEPRICE
              FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
              LEFT JOIN [${posback}].dbo.tb_VENDOR v
                ON LTRIM(RTRIM(s.VENDORCODE)) = LTRIM(RTRIM(v.VENDORCODE))
              WHERE s.COMPANY_CODE IN (${inClause}) AND s.VENDORCODE = '${vendorCode}'
              GROUP BY s.COMPANY_CODE, s.PRODUCT_CODE, LTRIM(RTRIM(s.SERIALNO)), s.VENDORCODE, v.VENDORNAME, s.PRODUCT_NAMELONG, s.COSTPRICE, s.SCALEPRICE;
            `);
            rowDataStatus = true;
          }

          tableRecords = await pool.request().query(`
            USE [${rtweb}];
            SELECT 
              LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
              LTRIM(RTRIM(s.VENDORCODE)) AS VENDOR_CODE,
              LTRIM(RTRIM(s.SERIALNO)) AS SERIALNO,
              v.VENDORNAME AS VENDOR_NAME,
              s.PRODUCT_NAMELONG AS PRODUCT_NAME,
              SUM(s.QTY) AS QUANTITY,
              s.COSTPRICE,
              s.SCALEPRICE
            FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
            LEFT JOIN [${posback}].dbo.tb_VENDOR v
              ON LTRIM(RTRIM(s.VENDORCODE)) = LTRIM(RTRIM(v.VENDORCODE))
            WHERE s.COMPANY_CODE IN (${inClause})
            GROUP BY s.COMPANY_CODE, s.PRODUCT_CODE, LTRIM(RTRIM(s.SERIALNO)), s.VENDORCODE, v.VENDORNAME, s.PRODUCT_NAMELONG, s.COSTPRICE, s.SCALEPRICE;
          `);
        }

        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          tableRecords: tableRecords.recordset || [],
          rowRecords: rowRecords ? rowRecords.recordset || [] : [],
          rowDataStatus,
        });
      } catch (fetchErr) {
        console.error("Error fetching vendor data:", fetchErr);
        return res.status(500).json({ message: "Failed to fetch vendor data" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in vendorDashboard:", error);
    return res.status(500).json({ message: "Failed to load vendor dashboard" });
  }
};

//stock product dashboard data
exports.stockProductDashboard = async (req, res) => {
  if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
  let pool;
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ message: "No authorization token provided" });
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

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0 || selectedOptions[0] === "") {
        return res.status(400).json({ message: "No company codes provided" });
      }

      // -------------------------
      // 3️⃣ Format Dates
      // -------------------------
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);

      // -------------------------
      // 4️⃣ Connect to User Database (Pool)
      // -------------------------
      const user_ip = String(req.user.ip).trim();
      const user_port = req.user.port.trim();
      pool = await connectToUserDatabase(user_ip, user_port);

      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      // Helper to execute queries safely via pool
      const execQuery = async (query) => {
        const request = pool.request();
        return request.query(query);
      };

      // -------------------------
      // 5️⃣ Build Query to Create View
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
              AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      }

      // -------------------------
      // 6️⃣ Execute View Update
      // -------------------------
      try {
        await execQuery(query);
        console.log("✅ View vw_STOCK_BALANCE updated successfully");
      } catch (error) {
        console.error("❌ Error updating view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      // -------------------------
      // 7️⃣ Fetch Table Records
      // -------------------------
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");

      let fetchQuery;
      if (state === true || String(state).toLowerCase() === "true") {
        fetchQuery = `
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
        `;
      } else {
        fetchQuery = `
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
        `;
      }

      const tableRecords = await execQuery(fetchQuery);

      // -------------------------
      // 8️⃣ Response
      // -------------------------
      return res.status(200).json({
        message: "Processed parameters for company codes",
        success: true,
        tableRecords: tableRecords.recordset || [],
      });
    });
  } catch (error) {
    console.error("❌ Unhandled error in stockProductDashboard:", error);
    return res.status(500).json({ message: "Failed to load product dashboard" });
  } finally {
    if (pool && pool.connected) {
      await pool.close();
      console.log("🔒 Database pool connection closed");
    }
  }
};

//stock department dashboard data
exports.stockDepartmentDashboard = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ message: "No authorization token provided" });
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

      // Ensure selectedOptions is an array
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      // -------------------------
      // 3️⃣ Database Connection
      // -------------------------

      if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
      const user_ip = String(req.user.ip).trim();
      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());

      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      // -------------------------
      // 4️⃣ Prepare Query for View
      // -------------------------
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);
      const request = pool.request();

      const viewQuery =
        formattedCurrentDate === formattedDate
          ? `
          USE ${rtweb};
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE (BIN = ''F'') OR (BIN IS NULL)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.DEPTCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');`
          : `
          USE ${rtweb};
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE ((BIN = ''F'') OR (BIN IS NULL))
              AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.DEPTCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');`;

      try {
        await request.query(viewQuery);
        console.log("✅ Stock view updated successfully");
      } catch (error) {
        console.error("❌ Error updating view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      // -------------------------
      // 5️⃣ Fetch Table Records
      // -------------------------
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");
      const tableRequest = pool.request();

      let query;
      if (state === true || String(state).toLowerCase() === "true") {
        query = `
          USE [${rtweb}];
          SELECT   
              LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
              LTRIM(RTRIM(s.DEPTCODE)) AS DEPARTMENT_CODE,
              d.DEPTNAME AS DEPARTMENT_NAME,
              s.PRODUCT_NAMELONG AS PRODUCT_NAME,
              SUM(s.QTY) AS QUANTITY,
              SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
              SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
              s.COSTPRICE,
              s.SCALEPRICE
          FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
          LEFT JOIN [${posback}].dbo.tb_DEPARTMENT d
              ON LTRIM(RTRIM(s.DEPTCODE)) = LTRIM(RTRIM(d.DEPTCODE))
          WHERE s.COMPANY_CODE IN (${inClause})
          GROUP BY 
              s.COMPANY_CODE, 
              s.PRODUCT_CODE, 
              s.DEPTCODE, 
              d.DEPTNAME,
              s.PRODUCT_NAMELONG, 
              s.COSTPRICE, 
              s.SCALEPRICE;
        `;
      } else {
        query = `
          USE [${rtweb}];
          SELECT   
              LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
              LTRIM(RTRIM(s.DEPTCODE)) AS DEPARTMENT_CODE,
              d.DEPTNAME AS DEPARTMENT_NAME,
              s.PRODUCT_NAMELONG AS PRODUCT_NAME,
              SUM(s.QTY) AS QUANTITY,
              s.COSTPRICE,
              s.SCALEPRICE
          FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
          LEFT JOIN [${posback}].dbo.tb_DEPARTMENT d
              ON LTRIM(RTRIM(s.DEPTCODE)) = LTRIM(RTRIM(d.DEPTCODE))
          WHERE s.COMPANY_CODE IN (${inClause})
          GROUP BY 
              s.COMPANY_CODE, 
              s.PRODUCT_CODE, 
              s.DEPTCODE, 
              d.DEPTNAME,
              s.PRODUCT_NAMELONG, 
              s.COSTPRICE, 
              s.SCALEPRICE;
        `;
      }

      try {
        const tableRecords = await tableRequest.query(query);
        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          tableRecords: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching product data:", fetchErr);
        return res.status(500).json({ message: "Failed to fetch product data" });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in stockDepartmentDashboard:", error);
    return res.status(500).json({ message: "Failed to load stock department dashboard" });
  }
};

//stock category dashboard data
exports.stockCategoryDashboard = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ message: "No authorization token provided" });
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

      // -------------------------
      // 3️⃣ Database Connection
      // -------------------------
      const user_ip = String(req.user.ip).trim();
      if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
      const pool = await connectToUserDatabase(user_ip, req.user.port.trim());

      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      // -------------------------
      // 4️⃣ Format Dates
      // -------------------------
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);
      const request = pool.request();

      // -------------------------
      // 5️⃣ Create or Refresh View
      // -------------------------
      const viewQuery =
        formattedCurrentDate === formattedDate
          ? `
          USE ${rtweb};
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.CATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE (BIN = ''F'') OR (BIN IS NULL)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.DEPTCODE,
                P.CATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');`
          : `
          USE ${rtweb};
          IF OBJECT_ID('dbo.vw_STOCK_BALANCE', 'V') IS NOT NULL DROP VIEW dbo.vw_STOCK_BALANCE;
          EXEC('CREATE VIEW dbo.vw_STOCK_BALANCE AS
            SELECT 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE, 
                ISNULL(SUM(S.STOCK), 0) AS QTY, 
                P.PRODUCT_NAMELONG,
                P.DEPTCODE,
                P.CATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE ((BIN = ''F'') OR (BIN IS NULL))
              AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.DEPTCODE,
                P.CATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');`;

      try {
        await request.query(viewQuery);
        console.log("✅ Stock view updated successfully (Category)");
      } catch (error) {
        console.error("❌ Error updating view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      // -------------------------
      // 6️⃣ Fetch Table Records
      // -------------------------
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");
      const tableRequest = pool.request();

      let query;
      if (state === true || String(state).toLowerCase() === "true") {
        query = `
          USE [${rtweb}];
          SELECT   
              LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
              LTRIM(RTRIM(s.CATCODE)) AS CATEGORY_CODE,
              c.CATNAME AS CATEGORY_NAME,
              s.PRODUCT_NAMELONG AS PRODUCT_NAME,
              SUM(s.QTY) AS QUANTITY,
              SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
              SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,
              s.COSTPRICE,
              s.SCALEPRICE
          FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
          LEFT JOIN [${posback}].dbo.tb_CATEGORY c
              ON LTRIM(RTRIM(s.CATCODE)) = LTRIM(RTRIM(c.CATCODE))
          WHERE s.COMPANY_CODE IN (${inClause})
          GROUP BY 
              s.COMPANY_CODE, 
              s.PRODUCT_CODE, 
              s.CATCODE, 
              c.CATNAME,
              s.PRODUCT_NAMELONG, 
              s.COSTPRICE, 
              s.SCALEPRICE;
        `;
      } else {
        query = `
          USE [${rtweb}];
          SELECT   
              LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
              LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
              LTRIM(RTRIM(s.CATCODE)) AS CATEGORY_CODE,
              c.CATNAME AS CATEGORY_NAME,
              s.PRODUCT_NAMELONG AS PRODUCT_NAME,
              SUM(s.QTY) AS QUANTITY,
              s.COSTPRICE,
              s.SCALEPRICE
          FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
          LEFT JOIN [${posback}].dbo.tb_CATEGORY c
              ON LTRIM(RTRIM(s.CATCODE)) = LTRIM(RTRIM(c.CATCODE))
          WHERE s.COMPANY_CODE IN (${inClause})
          GROUP BY 
              s.COMPANY_CODE, 
              s.PRODUCT_CODE, 
              s.CATCODE, 
              c.CATNAME,
              s.PRODUCT_NAMELONG, 
              s.COSTPRICE, 
              s.SCALEPRICE;
        `;
      }

      try {
        const tableRecords = await tableRequest.query(query);
        return res.status(200).json({
          message: "Processed parameters for company codes",
          success: true,
          tableRecords: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching product data:", fetchErr);
        return res.status(500).json({ message: "Failed to fetch product data" });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in stockCategoryDashboard:", error);
    return res.status(500).json({ message: "Failed to load category dashboard" });
  }
};

//stock sub category dashboard data
exports.stockSubCategoryDashboard = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ message: "No authorization token provided" });
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

      // Parse selected options
      if (typeof selectedOptions === "string") {
        selectedOptions = selectedOptions.split(",").map((code) => code.trim());
      }

      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0 || selectedOptions[0] === "") {
        return res.status(400).json({ message: "No company codes provided" });
      }

      // -------------------------
      // 3️⃣ Connect to User Database
      // -------------------------
      const user_ip = String(req.user.ip).trim();
      const user_port = req.user.port.trim();
if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
      const pool = await connectToUserDatabase(user_ip, user_port);
      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      // -------------------------
      // 4️⃣ Prepare Query Variables
      // -------------------------
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);

      const request = pool.request();

      // -------------------------
      // 5️⃣ Build View Creation Query
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
                P.DEPTCODE,
                P.CATCODE,
                P.SCATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE (BIN = ''F'') OR (BIN IS NULL)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.DEPTCODE,
                P.CATCODE,
                P.SCATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');`;
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
                P.DEPTCODE,
                P.CATCODE,
                P.SCATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE ((BIN = ''F'') OR (BIN IS NULL))
              AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.DEPTCODE,
                P.CATCODE,
                P.SCATCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      }

      // -------------------------
      // 6️⃣ Execute View Creation
      // -------------------------
      try {
        await request.query(query);
      } catch (error) {
        console.error("Error updating stock view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      // -------------------------
      // 7️⃣ Fetch Data
      // -------------------------
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");
      const fetchRequest = pool.request();

      let fetchQuery = `
        USE [${rtweb}];
        SELECT   
            LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
            LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
            LTRIM(RTRIM(s.SCATCODE)) AS SUBCATEGORY_CODE,
            c.SCATNAME AS SUBCATEGORY_NAME,
            s.PRODUCT_NAMELONG AS PRODUCT_NAME,
            SUM(s.QTY) AS QUANTITY,
            ${state === true || String(state).toLowerCase() === "true"
              ? `SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
                 SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,`
              : ``}
            s.COSTPRICE,
            s.SCALEPRICE
        FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
        LEFT JOIN [${posback}].dbo.tb_SUBCATEGORY c
            ON LTRIM(RTRIM(s.SCATCODE)) = LTRIM(RTRIM(c.SCATCODE))
        WHERE s.COMPANY_CODE IN (${inClause})
        GROUP BY 
            s.COMPANY_CODE, 
            s.PRODUCT_CODE, 
            s.SCATCODE, 
            c.SCATNAME,
            s.PRODUCT_NAMELONG, 
            s.COSTPRICE, 
            s.SCALEPRICE;
      `;

      const result = await fetchRequest.query(fetchQuery);

      return res.status(200).json({
        message: "Processed parameters for company codes",
        success: true,
        tableRecords: result.recordset || [],
      });
    });
  } catch (error) {
    console.error("Unhandled error in stockSubCategoryDashboard:", error);
    return res.status(500).json({ message: "Failed to load stock subcategory dashboard" });
  }
};

//stock vendor dashboard data
exports.stockVendorDashboard = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ message: "No authorization token provided" });
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

      if (
        !Array.isArray(selectedOptions) ||
        selectedOptions.length === 0 ||
        selectedOptions[0] === ""
      ) {
        return res.status(400).json({ message: "No company codes provided" });
      }

      // -------------------------
      // 3️⃣ Connect to User Database
      // -------------------------
      const user_ip = String(req.user.ip).trim();
      const user_port = req.user.port.trim();
if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
      const pool = await connectToUserDatabase(user_ip, user_port);
      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      // -------------------------
      // 4️⃣ Format Dates & Setup
      // -------------------------
      const formattedCurrentDate = formatDate(currentDate);
      const formattedDate = formatDate(date);

      const request = pool.request();

      // -------------------------
      // 5️⃣ Build View Creation Query
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
                P.VENDORCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE (BIN = ''F'') OR (BIN IS NULL)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.VENDORCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');`;
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
                P.VENDORCODE,
                P.COSTPRICE, 
                P.SCALEPRICE 
            FROM ${posback}.dbo.tb_STOCK S
            INNER JOIN ${posback}.dbo.tb_PRODUCT P
                ON P.PRODUCT_CODE = S.PRODUCT_CODE
            WHERE ((BIN = ''F'') OR (BIN IS NULL))
              AND CONVERT(date, S.DATE) <= CONVERT(date, ''${formattedDate}'', 103)
            GROUP BY 
                S.PRODUCT_CODE, 
                S.COMPANY_CODE,
                P.VENDORCODE,
                P.COSTPRICE, 
                P.SCALEPRICE,
                P.PRODUCT_NAMELONG');
        `;
      }

      // -------------------------
      // 6️⃣ Execute View Creation
      // -------------------------
      try {
        await request.query(query);
      } catch (error) {
        console.error("Error updating stock view:", error);
        return res.status(500).json({ message: "Error updating stock view" });
      }

      // -------------------------
      // 7️⃣ Fetch Table Records
      // -------------------------
      const inClause = selectedOptions.map((code) => `'${code}'`).join(",");
      const fetchRequest = pool.request();

      let fetchQuery = `
        USE [${rtweb}];
        SELECT   
            LTRIM(RTRIM(s.COMPANY_CODE)) AS COMPANY_CODE,
            LTRIM(RTRIM(s.PRODUCT_CODE)) AS PRODUCT_CODE,
            LTRIM(RTRIM(s.VENDORCODE)) AS VENDOR_CODE,
            v.VENDORNAME AS VENDOR_NAME,
            s.PRODUCT_NAMELONG AS PRODUCT_NAME,
            SUM(s.QTY) AS QUANTITY,
            ${state === true || String(state).toLowerCase() === "true"
              ? `SUM(s.QTY * s.COSTPRICE) AS COST_VALUE,
                 SUM(s.QTY * s.SCALEPRICE) AS SALES_VALUE,`
              : ``}
            s.COSTPRICE,
            s.SCALEPRICE
        FROM [${rtweb}].dbo.vw_STOCK_BALANCE s
        LEFT JOIN [${posback}].dbo.tb_VENDOR v
            ON LTRIM(RTRIM(s.VENDORCODE)) = LTRIM(RTRIM(v.VENDORCODE))
        WHERE s.COMPANY_CODE IN (${inClause})
        GROUP BY 
            s.COMPANY_CODE, 
            s.PRODUCT_CODE, 
            s.VENDORCODE, 
            v.VENDORNAME,
            s.PRODUCT_NAMELONG, 
            s.COSTPRICE, 
            s.SCALEPRICE;
      `;

      const result = await fetchRequest.query(fetchQuery);

      // -------------------------
      // ✅ Response
      // -------------------------
      return res.status(200).json({
        message: "Processed parameters for company codes",
        success: true,
        tableRecords: result.recordset || [],
      });
    });
  } catch (error) {
    console.error("Unhandled error in stockVendorDashboard:", error);
    return res
      .status(500)
      .json({ message: "Failed to load vendor stock dashboard" });
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
    // mssql.close(); // Close existing connections
    // const pool = await mssql.connect(dbConnection(String(req.user.ip).trim(), req.user.port));
    const user_ip = String(req.user.ip).trim(); 
    if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
    const pool = await connectToUserDatabase(user_ip, req.user.port.trim());

    if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }

    let productCode = null;
    let stockQty = 0;
    let salesData = [];
    let colorWiseData = [];
    let status = "F";
    let foundCode = null;
    let colorwiseActive = false;

    // Check if COLORSIZE is active
    const colorSizeQuery = `
      SELECT COLORSIZE_ACTIVE 
      FROM [${rtweb}].dbo.tb_COMPANY 
      WHERE MAIN = 'T';
    `;
    const colorSize = await pool.request().query(colorSizeQuery);
    if (colorSize.recordset.length > 0) {
      status = colorSize.recordset[0].COLORSIZE_ACTIVE;
    }

    if (status === "T") {
      // --- Barcode / Product Code Search ---
      if (codeData && codeData !== "No result") {
        const barcodeQuery = `
          SELECT PRODUCT_CODE 
          FROM [${posback}].dbo.tb_STOCKRELOAD 
          WHERE SERIALNO = @serial;
        `;
        const barcodeResult = await pool.request()
          .input("serial", codeData)
          .query(barcodeQuery);

        if (barcodeResult.recordset.length > 0) {
          productCode = barcodeResult.recordset[0].PRODUCT_CODE;
        }

        const productQuery = productCode
          ? `
              SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
              FROM [${posback}].dbo.tb_PRODUCT 
              WHERE PRODUCT_CODE = @code;
            `
          : `
              SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
              FROM [${posback}].dbo.tb_PRODUCT 
              WHERE PRODUCT_CODE = @code 
                 OR BARCODE = @code 
                 OR BARCODE2 = @code;
            `;

        const QueryData = await pool.request()
          .input("code", productCode || codeData)
          .query(productQuery);

        salesData = QueryData.recordset;

        if (!salesData || salesData.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        foundCode = salesData[0].PRODUCT_CODE;

        const stockQuery = `
          SELECT ISNULL(SUM(STOCK), 0) AS STOCK 
          FROM [${posback}].dbo.tb_STOCK 
          WHERE COMPANY_CODE = @company 
            AND (BIN = 'F' OR BIN IS NULL) 
            AND PRODUCT_CODE = @pcode;
        `;
        const stockResult = await pool.request()
          .input("company", company)
          .input("pcode", foundCode)
          .query(stockQuery);

        stockQty = stockResult.recordset[0]?.STOCK ?? 0;
      }

      // --- Search by Product Name ---
      if (name) {
        const productQuery = `
          SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
          FROM [${posback}].dbo.tb_PRODUCT 
          WHERE PRODUCT_NAMELONG = @name;
        `;
        const salesDataResult = await pool.request()
          .input("name", name)
          .query(productQuery);

        salesData = salesDataResult.recordset;

        if (!salesData || salesData.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        foundCode = salesData[0].PRODUCT_CODE;

        const stockQuery = `
          SELECT ISNULL(SUM(STOCK), 0) AS STOCK 
          FROM [${posback}].dbo.tb_STOCK 
          WHERE COMPANY_CODE = @company 
            AND (BIN = 'F' OR BIN IS NULL) 
            AND PRODUCT_CODE = @pcode;
        `;
        const stockResult = await pool.request()
          .input("company", company)
          .input("pcode", foundCode)
          .query(stockQuery);

        stockQty = stockResult.recordset[0]?.STOCK ?? 0;

        const codeQuery = `
          SELECT PRODUCT_CODE 
          FROM [${posback}].dbo.tb_STOCKRELOAD 
          WHERE PRODUCT_NAME = @name;
        `;
        const PCode = await pool.request()
          .input("name", name)
          .query(codeQuery);

        if (PCode.recordset && PCode.recordset.length > 0) {
          productCode = PCode.recordset[0].PRODUCT_CODE;
        }
      }

      // --- Color/Size Data ---
      if (productCode || foundCode) {
        const code = productCode ? productCode : foundCode;
        const colorSizeQuery = `
          SELECT SERIALNO, COLORCODE, SIZECODE, 0 AS STOCK 
          FROM [${posback}].dbo.tb_STOCKRELOAD 
          WHERE SERIALNO <> '' 
            AND PRODUCT_CODE = @code;
        `;
        const colorSizeData = await pool.request()
          .input("code", code)
          .query(colorSizeQuery);

        colorWiseData = colorSizeData.recordset;
        colorwiseActive = true;
      }
    } else {
      // --- Barcode / Product Code Search (NO COLORSIZE) ---
      if (codeData && codeData !== "No result") {
        const query = `
          SELECT PRODUCT_CODE 
          FROM [${posback}].dbo.tb_BARCODELINK 
          WHERE BARCODE = @barcode;
        `;
        const barcodeResult = await pool.request()
          .input("barcode", codeData)
          .query(query);

        if (barcodeResult.recordset.length > 0) {
          productCode = barcodeResult.recordset[0].PRODUCT_CODE;
        }

        const productQuery = productCode
          ? `
              SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
              FROM [${posback}].dbo.tb_PRODUCT 
              WHERE PRODUCT_CODE = @code;
            `
          : `
              SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
              FROM [${posback}].dbo.tb_PRODUCT 
              WHERE PRODUCT_CODE = @code 
                 OR BARCODE = @code 
                 OR BARCODE2 = @code;
            `;

        const salesDataResult = await pool.request()
          .input("code", productCode || codeData)
          .query(productQuery);

        salesData = salesDataResult.recordset;

        if (!salesData || salesData.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        foundCode = salesData[0].PRODUCT_CODE;

        const stockQuery = `
          SELECT ISNULL(SUM(STOCK), 0) AS STOCK 
          FROM [${posback}].dbo.tb_STOCK 
          WHERE COMPANY_CODE = @company 
            AND (BIN = 'F' OR BIN IS NULL) 
            AND PRODUCT_CODE = @pcode;
        `;
        const stockResult = await pool.request()
          .input("company", company)
          .input("pcode", foundCode)
          .query(stockQuery);

        stockQty = stockResult.recordset[0]?.STOCK ?? 0;
      }

      // --- Search by Product Name ---
      if (name) {
        const productQuery = `
          SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE 
          FROM [${posback}].dbo.tb_PRODUCT 
          WHERE PRODUCT_NAMELONG = @name;
        `;
        const salesDataResult = await pool.request()
          .input("name", name)
          .query(productQuery);

        salesData = salesDataResult.recordset;

        if (!salesData || salesData.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }

        foundCode = salesData[0].PRODUCT_CODE;

        const stockQuery = `
          SELECT ISNULL(SUM(STOCK), 0) AS STOCK 
          FROM [${posback}].dbo.tb_STOCK 
          WHERE COMPANY_CODE = @company 
            AND (BIN = 'F' OR BIN IS NULL) 
            AND PRODUCT_CODE = @pcode;
        `;
        const stockResult = await pool.request()
          .input("company", company)
          .input("pcode", foundCode)
          .query(stockQuery);

        stockQty = stockResult.recordset[0]?.STOCK ?? 0;
      }
    }

    return res.status(200).json({
      message: "Item Found Successfully",
      salesData,
      amount: stockQty,
      colorWiseData,
      colorwiseActive,
    });
  } catch (error) {
    console.error("Error retrieving barcode data in scan:", error);
    return res.status(500).json({ message: "Failed to scan data" });
  }
};

// product view
exports.productView = async (req, res) => {
  let pool;

  if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
  try {
    const codeData = req.query.data?.trim();
    const name = req.query.inputValue?.trim();
    const mode = req.query.mode?.trim();

    if ((!codeData || codeData === "No result") && !name) {
      return res.status(400).json({
        message: "Please provide a valid barcode or product code or name",
      });
    }

    // 1. Connect to Database Pool
    const user_ip = String(req.user.ip).trim();
    const user_port = req.user.port.trim();
    pool = await connectToUserDatabase(user_ip, user_port);
    if (!pool.connected)
      return res.status(500).json({ message: "Database connection failed" });

    // 2. Helper function to run queries using the pool
    const execQuery = async (query, params = {}) => {
      const request = pool.request();
      Object.entries(params).forEach(([key, value]) => request.input(key, value));
      return request.query(query);
    };

    let productCode = null;
    let status = "F";

    // 3. Check COLORSIZE status
    const colorSize = await execQuery(
      `SELECT COLORSIZE_ACTIVE FROM [${rtweb}].dbo.tb_COMPANY WHERE MAIN = 'T';`
    );
    if (colorSize.recordset.length > 0) status = colorSize.recordset[0].COLORSIZE_ACTIVE;

    // 4. Determine product code
    if (codeData && codeData !== "No result") {
      const tableName = status === "T" ? "tb_STOCKRELOAD" : "tb_BARCODELINK";
      const column = status === "T" ? "SERIALNO" : "BARCODE";
      const barcodeResult = await execQuery(
        `SELECT PRODUCT_CODE FROM [${posback}].dbo.${tableName} WHERE ${column} = @code;`,
        { code: codeData }
      );
      if (barcodeResult.recordset.length > 0) productCode = barcodeResult.recordset[0].PRODUCT_CODE;
    }

    if (!productCode && name) {
      const productData = await execQuery(
        `SELECT PRODUCT_CODE FROM [${posback}].dbo.tb_PRODUCT WHERE PRODUCT_NAMELONG = @name`,
        { name }
      );
      if (productData.recordset.length > 0) productCode = productData.recordset[0].PRODUCT_CODE;
    }

    if (!productCode) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 5. Get full product details
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

    if (productDetails.recordset.length === 0)
      return res.status(404).json({ message: "Product not found" });

    const result = productDetails.recordset[0];

    // 6. Fetch stock and price views
    const stockQty = await execQuery(
      `SELECT PRODUCT_CODE, COMPANY_CODE, ISNULL(SUM(STOCK),0) AS QTY
       FROM ${posback}.dbo.tb_STOCK
       WHERE (BIN='F' OR BIN IS NULL) AND PRODUCT_CODE=@code
       GROUP BY COMPANY_CODE, PRODUCT_CODE`,
      { code: productCode }
    );

    const priceDetails = await execQuery(
      `SELECT PRODUCT_CODE, COMPANY_CODE, COST_PRICE, UNIT_PRICE, WPRICE, MIN_PRICE
       FROM ${posback}.dbo.tb_PRICEDETAILS
       WHERE PRODUCT_CODE = @code`,
      { code: productCode }
    );

    const companyWiseStock = await execQuery(
      `SELECT COMPANY_CODE, SUM(STOCK) AS STOCK
       FROM ${posback}.dbo.tb_STOCK
       WHERE (BIN='F' OR BIN IS NULL) AND PRODUCT_CODE = @code
       GROUP BY COMPANY_CODE`,
      { code: productCode }
    );

    // 7. Fetch company names
    const companyCodes = stockQty.recordset.map((r) => r.COMPANY_CODE);
    let companies = [];
    if (companyCodes.length > 0) {
      const formattedCodes = companyCodes.map((c) => `'${c.trim()}'`).join(",");
      const companyNames = await execQuery(
        `SELECT COMPANY_CODE, COMPANY_NAME 
         FROM ${posback}.dbo.tb_COMPANY
         WHERE COMPANY_CODE IN (${formattedCodes})`
      );
      companies = companyNames.recordset;
    }

    // 8. Color-wise stock if applicable
    let colorWiseData = [];
    if (status === "T") {
      const codeValue = mode === "scan" ? codeData : productCode;
      const colorResult = await execQuery(
        `SELECT COMPANY_CODE, PRODUCT_CODE, SERIALNO,
                MAX(COLORCODE) AS COLORCODE, MAX(SIZECODE) AS SIZECODE,
                SUM(STOCK) AS STOCK
         FROM [${posback}].dbo.tb_STOCK
         WHERE SERIALNO<>'' AND PRODUCT_CODE=@product_code AND (BIN='F' OR BIN IS NULL)
         GROUP BY COMPANY_CODE, PRODUCT_CODE, SERIALNO`,
        { product_code: codeValue }
      );
      colorWiseData = colorResult.recordset;
    }

    // 9. Send Response
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
    console.error("❌ Error retrieving product view:", error);
    return res.status(500).json({ message: "Failed to fetch product view data" });
  } finally {
    // 10. Close pool safely
    if (pool && pool.connected) {
      await pool.close();
      console.log("🔒 Database pool connection closed");
    }
  }
};

// product view page sales
exports.productViewSales = async (req, res) => {
  if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
  let pool;
  try {
    const code = req.query.code?.trim();
    const fromDate = formatDate(req.query.fromDate?.trim());
    const toDate = formatDate(req.query.toDate?.trim());

    if (!code || !fromDate || !toDate) {
      return res.status(400).json({
        message: "Please provide a valid product code, from date, and to date",
      });
    }

    // 1. Connect to user-specific database pool
    const user_ip = String(req.user.ip).trim();
    const user_port = req.user.port.trim();
    pool = await connectToUserDatabase(user_ip, user_port);

    if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }

    // 2. Helper function for queries
    const execQuery = async (query, params = {}) => {
      const request = pool.request();
      Object.entries(params).forEach(([key, value]) => request.input(key, value));
      return request.query(query);
    };

    // 3. Run sales query
    const salesQuery = `
      USE [${posback}];
      SELECT SALESDATE, COMPANY_CODE, PRODUCT_CODE, COST_PRICE, UNIT_PRICE, 
             SUM(QTY) AS QTY, SUM(DISCOUNT) AS DISCOUNT, SUM(AMOUNT) AS AMOUNT
      FROM tb_SALES
      WHERE CONVERT(DATETIME, SALESDATE, 103) >= CONVERT(DATETIME, @from, 103)
        AND CONVERT(DATETIME, SALESDATE, 103) <= CONVERT(DATETIME, @to, 103)
        AND PRODUCT_CODE = @code
      GROUP BY SALESDATE, COMPANY_CODE, PRODUCT_CODE, COST_PRICE, UNIT_PRICE
    `;

    const salesResult = await execQuery(salesQuery, {
      from: fromDate,
      to: toDate,
      code,
    });

    // 4. Send response
    return res.status(200).json({
      message: "Item Found Successfully",
      salesData: salesResult.recordset || [],
    });
  } catch (error) {
    console.error("❌ Error in productViewSales:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch product sales data", error: error.message });
  } finally {
    // 5. Close pool safely
    if (pool && pool.connected) {
      await pool.close();
      console.log("🔒 Database pool connection closed");
    }
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

    // const user_ip = String(req.user.ip).trim(); 
    // const pool = await mssql.connect(dbConnection(user_ip, req.user.port));
    const user_ip = String(req.user.ip).trim(); 
    if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
  const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
  if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
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
    // const user_ip = String(req.user.ip).trim(); 
    // const pool = await mssql.connect(dbConnection(user_ip, req.user.port));

    const user_ip = String(req.user.ip).trim(); 
     if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
    const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
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

// product name
exports.productName = async (req, res) => {
  try {
    // Try finding a product code via barcode link table

    // const user_ip = String(req.user.ip).trim(); 
    // const pool = await mssql.connect(dbConnection(user_ip, req.user.port));

    // mssql.close();
    const user_ip = String(req.user.ip).trim(); 
    if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
  const pool = await connectToUserDatabase(user_ip, req.user.port.trim());
if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
    const query = `
  USE [${posback}];
  SELECT PRODUCT_NAMELONG FROM tb_PRODUCT;
`;

    const result = await pool.request().query(query);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ message: "Product names not found" });
    }

    return res.status(200).json({
       message: "Product names found",
      names: result.recordset,
    });
  } catch (error) {
    console.error("Error retrieving product names:", error);
    return res
      .status(500)
      .json({ message: "Failed to retrieve product names" });
  }
};

// Get user connection details
exports.findUserConnection = async (req, res) => {
  const name = req.query.name;

  if (!name || typeof name !== "string") {
    return res
      .status(400)
      .json({ message: "Invalid or missing username parameter" });
  }

  try {
    // Validate JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(403)
        .json({ message: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1]; // Extract token from "Bearer <token>"
    try {
      jwt.verify(token, process.env.JWT_SECRET); // Verify token with secret
    } catch (jwtError) {
      console.error("Invalid token:", jwtError);
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }
    // Get the connection pool
    const pool = await connectToDatabase();

    if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }

    // Define posmain (e.g., from query parameter, body, or environment variable)
    const posmain =
      req.query.posmain || process.env.DB_DATABASE1 || "your_default_database";
    if (!posmain) {
      return res
        .status(400)
        .json({ message: "Database name (posmain) is required" });
    }

    // Sanitize posmain to prevent SQL injection
    if (!/^[a-zA-Z0-9_]+$/.test(posmain)) {
      return res.status(400).json({ message: "Invalid database name" });
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
        u.[d_hourly_report], 
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
        u.[s_product],
        u.[s_department],
        u.[s_category],
        u.[s_scategory],
        u.[s_vendor],
        s.[COMPANY_NAME],
        s.[START_DATE],
        s.[END_DATE]
      FROM tb_USERS u
      LEFT JOIN tb_SERVER_DETAILS s
        ON u.CUSTOMERID = s.CUSTOMERID 
      WHERE u.username = @username;
    `;

    const request = pool.request(); // Use pool.request() instead of new mssql.Request()
    request.input("username", mssql.VarChar, name);

    const userPermissionResult = await request.query(query);

    if (userPermissionResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ message: "User details not found for the given username" });
    }

    res.status(200).json({
      message: "User permission data retrieved successfully",
      userData: userPermissionResult.recordset,
    });
  } catch (error) {
    console.error("Error retrieving user permission data:", {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
    });
    res.status(500).json({
      message: "Failed to retrieve user permission data",
      error: error.message,
    });
  }
};

//reset database connection
exports.resetDatabaseConnection = async (req, res) => {
  const {
    name,
    ip = "",
    port = "",
    username = "",
    companyName = "",
    startDate = "",
    endDate = "",
    customerID = "",
    newCustomerID = "",
    admin = [],
    dashboard = [],
    stock_wise = [],
    stock = [],
    colorSize_stock = [],
    colorSize_sales = [],
    // removeAdmin = [],
    // removeDashboard = [],
    // removeStock = [],
  } = req.body;

  const trimmedName = name?.trim();
  const trimmedIP = ip?.trim();
  const trimmedPort = port?.trim();

  if (mssql.connected) {
    await mssql.close();
    console.log("✅ Database connection closed successfully");
  }

  let pool;
  let transaction;

  try {
    // Auth validation
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

    jwt.verify(token, process.env.JWT_SECRET);
    console.log("JWT verified");

    // Input validation
    if (!trimmedName || typeof trimmedName !== "string") {
      return res.status(400).json({ message: "Invalid or missing name" });
    }
    if (trimmedIP && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmedIP)) {
      return res.status(400).json({ message: "Invalid IP address format" });
    }
    if (trimmedPort && !/^\d+$/.test(trimmedPort)) {
      return res.status(400).json({ message: "Invalid port" });
    }
    if (username && typeof username !== "string") {
      return res.status(400).json({ message: "Invalid username" });
    }
    if (companyName && typeof companyName !== "string") {
      return res.status(400).json({ message: "Invalid company name" });
    }
    if (startDate && isNaN(Date.parse(startDate))) {
      return res.status(400).json({ message: "Invalid start date" });
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      return res.status(400).json({ message: "Invalid end date" });
    }
    console.log("Input validation passed");

    // Validate customerID and newCustomerID
    const parsedCustomerID = Number(customerID);
    const parsedNewCustomerID =
      Number(newCustomerID) === 0 ? Number(customerID) : Number(newCustomerID);
    const isValidCustomerID =
      Number.isInteger(parsedCustomerID) && parsedCustomerID !== 0;
    const isValidNewCustomerID =
      Number.isInteger(parsedNewCustomerID) && parsedNewCustomerID !== 0;
    console.log("customerID validation", {
      parsedCustomerID,
      parsedNewCustomerID,
    });

    // Connect to the database
    // const config = {
    //   user: process.env.DB_USER,
    //   password: process.env.DB_PASSWORD,
    //   server: process.env.DB_SERVER,
    //   database: process.env.DB_DATABASE1,
    //   options: {
    //     encrypt: false,
    //     trustServerCertificate: true,
    //   },
    //   port: 1443, //---------1433 initialy there
    //   connectionTimeout: 30000,
    //   requestTimeout: 30000,
    // };
    console.log("Connecting to database");

    // pool = await mssql.connect(dbConnection);
    pool = await connectToDatabase();

    if (!pool || !pool.connected) {
      return res.status(500).json({ message: "Database connection failed" });
    }
    console.log("Database connected");
    transaction = new mssql.Transaction(pool);
    await transaction.begin();
    console.log("Transaction started");

    let userResult;
    let serverResult;

    const checkRequest = new mssql.Request(transaction);
    checkRequest.input("newCustomerID", mssql.Int, parsedNewCustomerID);
    const checkResult = await checkRequest.query(
      `SELECT * FROM tb_SERVER_DETAILS WHERE CUSTOMERID = @newCustomerID`
    );

    // Case 1: Invalid customerID
    if (
      customerID === 0 ||
      customerID === "" ||
      customerID === null ||
      customerID === undefined
    ) {
      if (!isValidNewCustomerID) {
        return res
          .status(400)
          .json({ message: "New CustomerID must be a non-zero integer" });
      }

      const serverRequest = new mssql.Request(transaction);
      serverRequest.input("newCustomerID", mssql.Int, parsedNewCustomerID);
      serverRequest.input("companyName", mssql.NVarChar(50), companyName || "");
      serverRequest.input("trimmedIP", mssql.NVarChar(50), trimmedIP || "");
      serverRequest.input("startDate", mssql.Date,startDate ? new Date(startDate) : "");
      serverRequest.input("endDate",mssql.Date,endDate ? new Date(endDate) : "");

      if (checkResult.recordset.length === 0) {
        console.log('1')
        serverResult = await serverRequest.query(`
        INSERT INTO tb_SERVER_DETAILS (CUSTOMERID, COMPANY_NAME, SERVERIP, START_DATE, END_DATE)
        VALUES (@newCustomerID, @companyName, @trimmedIP, @startDate, @endDate);
        `);
        console.log("tb_SERVER_DETAILS inserted", serverResult.rowsAffected);
      } else if (checkResult.recordset[0].COMPANY_NAME !== companyName) {
        console.log('2')
        console.log("Company name mismatch in tb_SERVER_DETAILS");
        return res.status(400).json({
          message: "Customer ID already exist for a different company name",
        });
      } else if (
        checkResult.recordset[0].SERVERIP !== trimmedIP ||
        new Date(checkResult.recordset[0].START_DATE)
          .toISOString()
          .split("T")[0] !== new Date(startDate).toISOString().split("T")[0] ||
        new Date(checkResult.recordset[0].END_DATE)
          .toISOString()
          .split("T")[0] !== new Date(endDate).toISOString().split("T")[0]
      ) {
        console.log('3')
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

      console.log(
        "Executing Case 1 - Update tb_USERS and insert tb_SERVER_DETAILS"
      );
      const userRequest = new mssql.Request(transaction);
      userRequest.input("newCustomerID", mssql.Int, parsedNewCustomerID);
      userRequest.input("trimmedIP", mssql.VarChar(20), trimmedIP || null);
      userRequest.input("trimmedPort", mssql.VarChar(10), trimmedPort || null);
      userRequest.input("username", mssql.VarChar(20), username || null);
      userRequest.input("trimmedName", mssql.VarChar(50), trimmedName);

      userResult = await userRequest.query(`
        UPDATE tb_USERS 
        SET CUSTOMERID = @newCustomerID, ip_address = @trimmedIP, port = @trimmedPort, registered_by = @username
        WHERE username = @trimmedName;
      `);
      console.log("tb_USERS updated", userResult.rowsAffected);
    }
    // Case 2: Valid customerID and newCustomerID, and they are equal
    else if (
      isValidCustomerID &&
      isValidNewCustomerID &&
      parsedCustomerID === parsedNewCustomerID
    ) {
      console.log(
        "Executing Case 2 - Update tb_USERS and tb_SERVER_DETAILS (same CUSTOMERID)"
      );
      const userRequest = new mssql.Request(transaction);
      userRequest.input("trimmedIP", mssql.VarChar(20), trimmedIP || null);
      userRequest.input("trimmedPort", mssql.VarChar(10), trimmedPort || null);
      userRequest.input("trimmedName", mssql.VarChar(50), trimmedName);

      userResult = await userRequest.query(`
        UPDATE tb_USERS 
        SET ip_address = @trimmedIP, port = @trimmedPort
        WHERE username = @trimmedName;
      `);
      console.log("tb_USERS updated", userResult.rowsAffected);

      const serverRequest = new mssql.Request(transaction);
      serverRequest.input(
        "companyName",
        mssql.NVarChar(50),
        companyName || null
      );
      serverRequest.input("trimmedIP", mssql.NVarChar(50), trimmedIP || null);
      serverRequest.input(
        "startDate",
        mssql.Date,
        startDate ? new Date(startDate) : null
      );
      serverRequest.input(
        "endDate",
        mssql.Date,
        endDate ? new Date(endDate) : null
      );
      serverRequest.input("customerID", mssql.Int, parsedCustomerID);

      serverResult = await serverRequest.query(`
        UPDATE tb_SERVER_DETAILS 
        SET COMPANY_NAME = @companyName, SERVERIP = @trimmedIP, START_DATE = @startDate, END_DATE = @endDate
        WHERE CUSTOMERID = @customerID;
      `);
      console.log("tb_SERVER_DETAILS updated", serverResult.rowsAffected);
    }
    // Case 3: Valid customerID and newCustomerID, but they are not equal
    else if (
      isValidCustomerID &&
      isValidNewCustomerID &&
      parsedCustomerID !== parsedNewCustomerID
    ) {
      console.log(
        "Executing Case 3 - Update tb_USERS and tb_SERVER_DETAILS (new CUSTOMERID)"
      );
      const userRequest = new mssql.Request(transaction);
      userRequest.input("trimmedIP", mssql.VarChar(20), trimmedIP || null);
      userRequest.input("trimmedPort", mssql.VarChar(10), trimmedPort || null);
      userRequest.input("newCustomerID", mssql.Int, parsedNewCustomerID);
      userRequest.input("trimmedName", mssql.VarChar(50), trimmedName);

      userResult = await userRequest.query(`
        UPDATE tb_USERS 
        SET ip_address = @trimmedIP, port = @trimmedPort, CUSTOMERID = @newCustomerID
        WHERE username = @trimmedName;
      `);
      console.log("tb_USERS updated", userResult.rowsAffected);

      const serverRequest = new mssql.Request(transaction);
      serverRequest.input(
        "companyName",
        mssql.NVarChar(50),
        companyName || null
      );
      serverRequest.input("trimmedIP", mssql.NVarChar(50), trimmedIP || null);
      serverRequest.input("newCustomerID", mssql.Int, parsedNewCustomerID);
      serverRequest.input(
        "startDate",
        mssql.Date,
        startDate ? new Date(startDate) : null
      );
      serverRequest.input(
        "endDate",
        mssql.Date,
        endDate ? new Date(endDate) : null
      );
      serverRequest.input("customerID", mssql.Int, parsedCustomerID);

      serverResult = await serverRequest.query(`
        UPDATE tb_SERVER_DETAILS 
        SET COMPANY_NAME = @companyName, SERVERIP = @trimmedIP, CUSTOMERID = @newCustomerID, 
            START_DATE = @startDate, END_DATE = @endDate
        WHERE CUSTOMERID = @customerID;
      `);
      console.log("tb_SERVER_DETAILS updated", serverResult.rowsAffected);
    } else {
      throw new Error("Invalid customerID or newCustomerID");
    }

    // Check if updates were successful
    console.log('userResult',userResult)
    console.log('serverResult',serverResult)
    if (userResult.rowsAffected[0] === 0) {
  console.log("No user found with username", trimmedName);
  throw new Error(`User '${trimmedName}' not found in tb_USERS`);
}

    if (serverResult!==undefined) {
      if(serverResult.rowsAffected[0] === 0 ){
         throw new Error(
        "Could not update or insert into the server details table"
      );
      }
     
    }
    console.log("Table updates successful");

    // Update permissions
    const updatePermissions = async (permissionArray, permissionType) => {
      if (!Array.isArray(permissionArray) || permissionArray.length === 0) {
        console.log(`Skipping ${permissionType} - empty or invalid array`);
        return;
      }

      // Whitelist of allowed columns (matches tb_USERS schema)
      const allowedColumns = [
        "a_permission",
        "a_sync",
        "d_company",
        "d_category",
        "d_department",
        "d_scategory",
        "d_vendor",
        "d_hourly_report",
        "d_invoice",
        "d_productView",
        "t_scan",
        "t_stock",
        "t_stock_update",
        "t_grn",
        "t_prn",
        "t_tog",
        "c_st_product_wise",
        "c_st_department",
        "c_st_category",
        "c_st_scategory",
        "c_st_vendor",
        "c_sa_product_wise",
        "c_sa_department",
        "c_sa_category",
        "c_sa_scategory",
        "c_sa_vendor",
        "s_product",
        "s_department",
        "s_category",
        "s_scategory",
        "s_vendor",
      ];

      for (const permissionObject of permissionArray) {
        console.log(`Processing ${permissionType}`, permissionObject);
        for (const column in permissionObject) {
          if (!allowedColumns.includes(column)) {
            console.log(
              `Skipping invalid column ${column} for ${permissionType}. Verify tb_USERS schema.`
            );
            continue;
          }

          const columnValue = permissionObject[column] ? "T" : "F";
          console.log("Updating permission", {
            column,
            columnValue,
            username: trimmedName,
          });

          const request = new mssql.Request(transaction);
          request.input("value", mssql.Char(1), columnValue);
          request.input("registeredBy", mssql.VarChar(20), username || null);
          request.input("username", mssql.VarChar(50), trimmedName);

          try {
            const result = await request.query(`
              UPDATE tb_USERS 
              SET ${column} = @value, registered_by = @registeredBy
              WHERE username = @username;
            `);
            console.log("Permission updated", {
              column,
              rowsAffected: result.rowsAffected,
            });

            if (result.rowsAffected[0] === 0) {
              console.log(
                `No rows affected for ${column} - user may not exist`
              );
            }
          } catch (err) {
            console.log(
              `Failed to update ${column} for ${permissionType}: ${err.message}`
            );
            throw err;
          }
        }
      }
    };

    // // Remove permissions
    // const removePermissions = async (permissionArray, permissionType) => {
    //   if (!Array.isArray(permissionArray) || permissionArray.length === 0) {
    //     console.log(
    //       `Skipping ${permissionType} removal - empty or invalid array`
    //     );
    //     return;
    //   }

    //   const allowedColumns = [
    //     "a_permission",
    //     "a_sync",
    //     "d_company",
    //     "d_category",
    //     "d_department",
    //     "d_scategory",
    //     "d_vendor",
    //     "d_invoice",
    //     "d_productView",
    //     "t_scan",
    //     "t_stock",
    //     "t_stock_update",
    //     "t_grn",
    //     "t_prn",
    //     "t_tog",
    //     "c_st_product_wise",
    //     "c_st_department",
    //     "c_st_category",
    //     "c_st_scategory",
    //     "c_st_vendor",
    //     "c_sa_product_wise",
    //     "c_sa_department",
    //     "c_sa_category",
    //     "c_sa_scategory",
    //     "c_sa_vendor",
    //     "s_product",
    //     "s_department",
    //     "s_category",
    //     "s_scategory",
    //     "s_vendor",
    //   ];

    //   for (const permissionObject of permissionArray) {
    //     console.log(`Processing ${permissionType} removal`, permissionObject);
    //     for (const column in permissionObject) {
    //       if (!allowedColumns.includes(column)) {
    //         console.log(
    //           `Skipping invalid column ${column} for ${permissionType} removal. Verify tb_USERS schema.`
    //         );
    //         continue;
    //       }

    //       if (permissionObject[column]) {
    //         console.log("Removing permission", {
    //           column,
    //           username: trimmedName,
    //         });
    //         const request = new mssql.Request(transaction);
    //         request.input("value", mssql.Char(1), "F");
    //         request.input("registeredBy", mssql.VarChar(20), username || null);
    //         request.input("username", mssql.VarChar(50), trimmedName);

    //         try {
    //           const result = await request.query(`
    //             UPDATE tb_USERS
    //             SET ${column} = @value, registered_by = @registeredBy
    //             WHERE username = @username;
    //           `);
    //           console.log("Permission removed", {
    //             column,
    //             rowsAffected: result.rowsAffected,
    //           });

    //           if (result.rowsAffected[0] === 0) {
    //             console.log(
    //               `No rows affected for ${column} removal - user may not exist`
    //             );
    //           }
    //         } catch (err) {
    //           console.log(
    //             `Failed to remove ${column} for ${permissionType}: ${err.message}`
    //           );
    //           throw err;
    //         }
    //       }
    //     }
    //   }
    // };

    console.log("Applying permission updates");
    await updatePermissions(admin, "admin");
    await updatePermissions(dashboard, "dashboard");
    await updatePermissions(stock, "stock");
    await updatePermissions(stock_wise, "stock_wise");
    await updatePermissions(colorSize_stock, "colorSize_stock");
    await updatePermissions(colorSize_sales, "colorSize_sales");

    // console.log("Applying permission removals");
    // await removePermissions(removeAdmin, "admin");
    // await removePermissions(removeDashboard, "dashboard");
    // await removePermissions(removeStock, "stock");
    // console.log("Permissions processed");

    // Check if nothing was sent
    const isEmptyOrAllFalse = (arr) => {
      return (
        !Array.isArray(arr) ||
        arr.length === 0 ||
        arr.every(
          (obj) =>
            typeof obj === "object" &&
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
      isEmptyOrAllFalse(stock_wise) &&
      isEmptyOrAllFalse(stock) &&
      isEmptyOrAllFalse(colorSize_stock) &&
      isEmptyOrAllFalse(colorSize_sales);
    // &&
    // isEmptyOrAllFalse(removeAdmin) &&
    // isEmptyOrAllFalse(removeDashboard) &&
    // isEmptyOrAllFalse(removeStock);
    console.log("nothingToUpdate check", nothingToUpdate);

    if (nothingToUpdate) {
      throw new Error("Please provide details to update.");
    }

    await transaction.commit();
    console.log("Transaction committed");
    return res
      .status(200)
      .json({ message: "Database connection updated successfully" });
  } catch (err) {
    console.log("Error occurred1", err);
    if (transaction) {
      console.log("Rolling back transaction");
      await transaction.rollback();
    }
    console.error("Error:", err);
    return res.status(500).json({
      message: `Failed to update the database connection: ${err.message}`,
    });
  } finally {
    if (pool) {
      console.log("Closing database connection");
      await pool.close();
    }
  }
};

//server connection details for admin page
exports.serverConnection = async (req, res) => {
  try {
    // -------------------------
    // 1️⃣ Authorization Check
    // -------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Token is missing" });
    }

    // -------------------------
    // 2️⃣ Verify JWT
    // -------------------------
    jwt.verify(token, process.env.JWT_SECRET, async (err) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      // -------------------------
      // 3️⃣ Connect to Database (Pooled)
      // -------------------------
      if (mssql.connected) {
        await mssql.close();
        console.log("✅ Closed existing connection");
      }

      const pool = await connectToDatabase();

      if (!pool || !pool.connected) {
        return res.status(500).json({ message: "Database connection failed" });
      }

      // -------------------------
      // 5️⃣ Query Execution
      // -------------------------
      const request = pool.request();

      const query = `
        USE [${posmain}];
        SELECT 
          s.CUSTOMERID,
          s.COMPANY_NAME,
          s.SERVERIP,
          s.START_DATE,
          s.END_DATE,
          (
            SELECT TOP 1 u.PORT
            FROM tb_USERS u
            WHERE u.CUSTOMERID = s.CUSTOMERID
          ) AS PORT
        FROM tb_SERVER_DETAILS s;
      `;

      try {
        const tableRecords = await request.query(query);
        return res.status(200).json({
          message: "Details fetched successfully",
          success: true,
          records: tableRecords.recordset || [],
        });
      } catch (fetchErr) {
        console.error("❌ Error fetching data:", fetchErr);
        return res.status(500).json({ message: "Failed to fetch data" });
      }
    });
  } catch (error) {
    console.error("❌ Unhandled error in serverConnection:", error);
    return res.status(500).json({ message: "Failed to load server connection data" });
  }
};