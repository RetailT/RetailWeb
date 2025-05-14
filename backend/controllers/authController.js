const mssql = require("mssql");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const axios = require("axios");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const qs = require("qs");
const fs = require("fs");
const path = require("path");
const { parse } = require("json2csv");
require("dotenv").config();
const { sendPasswordResetEmail } = require("../utils/nodemailer");
const https = require("https");
const { INSERT } = require("sequelize/lib/query-types");
const agent = new https.Agent({ family: 4 });

const JWT_SECRET = process.env.JWT_SECRET;
let IP;
let PORT;
let CUSTOMER_ID;

const dbConfig = {
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

// function formatDate(dateString) {
//   // Convert the input string to a Date object
//   const dateObject = new Date(dateString);

//   // Extract day, month, and year
//   const day = String(dateObject.getDate()).padStart(2, "0"); // Ensures two digits
//   const month = String(dateObject.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed, so add 1
//   const year = dateObject.getFullYear();

//   // Return the formatted date as 'DD/MM/YYYY'
//   return `${day}/${month}/${year}`;
// }

// async function syncDBConnection() {
//   try {
//     const request = new mssql.Request(); // Initialize a new request object
//     const dbConnectionResult = await request.query(
//       "USE [RTPOS_MAIN] SELECT * FROM tb_SYNCDB_USERS"
//     );
//     if (dbConnectionResult.recordset.length === 0) {
//       console.log("Cannot fetch user details");
//       return;
//     } else {
//       const dbConnectionData = dbConnectionResult.recordset;
//       return dbConnectionData;
//     }
//   } catch (error) {
//     console.error("Error in syncDB:", error);
//   }
// }

// async function userItemsDetails(ReceiptDate, ReceiptNo) {
//   try {
//     const userItemsDetails = await mssql.query`
//     USE [RT_WEB]
//       SELECT Item_Desc, ItemAmt, ItemDiscountAmt FROM tb_OGFITEMSALE WHERE ReceiptDate = ${ReceiptDate} AND ReceiptNo = ${ReceiptNo} AND UPLOAD <> 'T';
//     `;
//     if (userItemsDetails.recordset.length === 0) {
//       console.log("Cannot fetch user items details");
//       return { error: "Cannot fetch user items details" };
//     } else {
//       const userItems = userItemsDetails.recordset;
//       return userItems;
//     }
//   } catch (error) {
//     console.error("Error in fetching user items details:", error);
//     return { error: `Error in fetching user items details: ${error.message}` };
//   }
// }

// async function userPaymentDetails() {
//   try {
//     const userPaymentDetails = await mssql.query`
//     USE [RT_WEB]
// SELECT 
//     ReceiptNo, 
//     MAX(ReceiptDate) AS ReceiptDate, 
//     MAX(ReceiptTime) AS ReceiptTime, 
//     SUM(NoOfItems) AS NoOfItems, 
//     MAX(SalesCurrency) AS SalesCurrency, 
//     SUM(TotalSalesAmtB4Tax) AS TotalSalesAmtB4Tax, 
//     SUM(TotalSalesAmtAfterTax) AS TotalSalesAmtAfterTax, 
//     SUM(SalesTaxRate) AS SalesTaxRate, 
//     SUM(ServiceChargeAmt) AS ServiceChargeAmt, 
//     SUM(PaymentAmt) AS PaymentAmt, 
//     MAX(PaymentCurrency) AS PaymentCurrency, 
//     (SELECT STUFF(
//         (SELECT DISTINCT ',' + t2.PaymentMethod  
//          FROM tb_OGFPAYMENT AS t2  
//          WHERE t2.ReceiptNo = t1.ReceiptNo  
//          FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '')
//     ) AS PaymentMethod, 
//     MAX(SalesType) AS SalesType
// FROM tb_OGFPAYMENT AS t1 
// WHERE UPLOAD <> 'T'
// GROUP BY ReceiptNo;
//     `;
//     if (userPaymentDetails.recordset.length === 0) {
//       console.log("Cannot fetch user payment details");
//       return { error: "Cannot fetch user payment details" };
//     } else {
//       const userConnectionDetails = userPaymentDetails.recordset;
//       return userConnectionDetails;
//     }
//   } catch (error) {
//     console.error("Error in fetching user payment details:", error);
//     return {
//       error: `Error in fetching user payment details: ${error.message}`,
//     };
//   }
// }

// async function userDetails() {
//   try {
//     const userDetails = await mssql.query`
//     USE [RT_WEB]
//       SELECT AppCode, PropertyCode, POSInterfaceCode, BatchCode, SalesTaxRate, OAUTH_TOKEN_URL, 
//       ClientID, ClientSecret, API_ENDPOINT  FROM tb_OGFMAIN;
//     `;
//     if (userDetails.recordset.length === 0) {
//       console.log("Cannot fetch user details");
//       return;
//     } else {
//       const userConnectionDetails = userDetails.recordset;
//       const trimmedUserConnectionDetails = userConnectionDetails.map((user) => {
//         let trimmedUser = {};

//         for (const key in user) {
//           if (typeof user[key] === "string") {
//             trimmedUser[key] = user[key].trim(); // Trim only if the value is a string
//           } else {
//             trimmedUser[key] = user[key]; // Keep non-string values unchanged
//           }
//         }

//         return trimmedUser;
//       });

//       return trimmedUserConnectionDetails;
//     }
//   } catch (error) {
//     console.error("Error in fetching user connection details:", error);
//   }
// }

// // Function to get OAuth2 token for a customer
// async function getAccessToken(user) {
//   try {
//     const data = qs.stringify({
//       client_id: user.ClientID,
//       client_secret: user.ClientSecret,
//       grant_type: "client_credentials",
//     });

//     const agent = new https.Agent({
//       family: 4, // force IPv4
//     });

//     const response = await axios.post(user.OAUTH_TOKEN_URL, data, {
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//       httpsAgent: agent,
//       timeout: 10000, // optional: set a timeout in ms (10s)
//     });

//     return response.data.access_token;
//   } catch (error) {
//     console.error(
//       `Error fetching token for ${user.OAUTH_TOKEN_URL}:`,
//       error.response ? error.response.data : error.message
//     );
//     return null;
//   }
// }

// // Function to trim all string fields in an object recursively
// function trimObjectStrings(obj) {
//   if (typeof obj !== "object" || obj === null) return obj;

//   if (Array.isArray(obj)) {
//     return obj.map((item) => trimObjectStrings(item));
//   }

//   return Object.fromEntries(
//     Object.entries(obj).map(([key, value]) => [
//       key,
//       typeof value === "string" ? value.trim() : trimObjectStrings(value),
//     ])
//   );
// }

// async function updateTables() {
//   try {
//     const updatePayment = await mssql.query`
//       USE [RT_WEB]
//       UPDATE tb_OGFPAYMENT
//       SET UPLOAD = 'T'
//       WHERE UPLOAD <> 'T' OR UPLOAD IS NULL;`;

//     const updateItems = await mssql.query`
//       USE [RT_WEB]
//       UPDATE tb_OGFITEMSALE
//       SET UPLOAD = 'T'
//       WHERE UPLOAD <> 'T' OR UPLOAD IS NULL;`;

//     const paymentRows = updatePayment.rowsAffected[0];
//     const itemsRows = updateItems.rowsAffected[0];

//     if (paymentRows === 0 && itemsRows === 0) {
//       return {
//         message: "No rows were updated in tb_OGFPAYMENT or tb_OGFITEMSALE",
//         paymentRowsAffected: paymentRows,
//         itemsRowsAffected: itemsRows,
//       };
//     }

//     return {
//       message: "Tables updated successfully",
//       paymentRowsAffected: paymentRows,
//       itemsRowsAffected: itemsRows,
//     };
//   } catch (error) {
//     return {
//       message: "Could not update tables",
//       error: error.message,
//     };
//   }
// }


// async function syncDB() {
//   try {
//     await mssql.close();
//     await mssql.connect(dbConfig);

//     let syncdbIp = null;
//     let syncdbPort = null;
//     const dbConnectionData = await syncDBConnection();

//     if (!dbConnectionData || dbConnectionData.length === 0) {
//       console.log("No customer data found.");
//       return [];
//     }

//     const apiResponses = [];
//     const errors = [];

//     for (const customer of dbConnectionData) {
//       syncdbIp = customer.IP ? customer.IP.trim() : null;
//       syncdbPort = customer.PORT ? parseInt(customer.PORT.trim()) : null;

//       if (!syncdbIp) {
//         console.log("IP is null");
//         errors.push("IP is null");
//       }
//       if (!syncdbPort) {
//         console.log("Port is null");
//         errors.push("Port is null");
//       }

//       try {
//         await mssql.close();
//         const syncdbConfig = {
//           user: process.env.DB_USER,
//           password: process.env.DB_PASSWORD,
//           server: syncdbIp,
//           database: process.env.DB_DATABASE2,
//           options: {
//             encrypt: false,
//             trustServerCertificate: true,
//           },
//           port: syncdbPort,
//         };

//         await mssql.connect(syncdbConfig);
//         console.log("Successfully connected to the sync database");

//         const users = await userDetails();
//         const payments = await userPaymentDetails();

//         if (payments.error) {
//           errors.push(payments.error);
//           // logErrorsToCSV(payments.error);
//         }

//         const result = [];

//         for (const user of users) {
//           const {
//             SalesTaxRate,
//             OAUTH_TOKEN_URL,
//             API_ENDPOINT,
//             ...filteredUser
//           } = user;

//           const userResult = {
//             AppCode: filteredUser.AppCode,
//             PropertyCode: filteredUser.PropertyCode,
//             ClientID: filteredUser.ClientID,
//             ClientSecret: filteredUser.ClientSecret,
//             POSInterfaceCode: filteredUser.POSInterfaceCode,
//             BatchCode: filteredUser.BatchCode,
//             PosSales: [],
//           };

//           for (const payment of payments) {
//             const { IDX, UPLOAD, Insert_Time, ...filteredPayment } = payment;

//             const formattedDate = new Date(payment.ReceiptDate)
//               .toLocaleDateString("en-GB")
//               .replace(/\//g, "/");

//             const formattedTime = new Date(
//               payment.ReceiptTime
//             ).toLocaleTimeString("en-GB", { hour12: false });

//             const newPaymentDetails = {
//               PropertyCode: filteredUser.PropertyCode,
//               POSInterfaceCode: filteredUser.POSInterfaceCode,
//               ...filteredPayment,
//               ReceiptDate: formattedDate,
//               ReceiptTime: formattedTime,
//             };

//             const items = await userItemsDetails(
//               payment.ReceiptDate,
//               payment.ReceiptNo
//             );
//             if (items.error) {
//               errors.push(items.error);
//               // logErrorsToCSV(items.error);
//             }

//             const paymentWithItems = {
//               ...newPaymentDetails,
//               Items: items,
//             };

//             userResult.PosSales.push(trimObjectStrings(paymentWithItems));
//           }

//           result.push(trimObjectStrings(userResult));

//           const token = await getAccessToken(user);
//           if (!token) {
//             const errorMsg = `Skipping API call due to token error.`;
//             console.error(errorMsg);
//             // logErrorsToCSV(errorMsg);
//             return [];
//           }

//           for (const userResult of result) {
//             const requestBody = JSON.stringify(userResult, null, 2);
//             console.log("Sending JSON Payload:", requestBody);

//             try {
//               const response = await axios.post(
//                 user.API_ENDPOINT,
//                 requestBody,
//                 {
//                   headers: {
//                     Authorization: `Bearer ${token}`,
//                     "Content-Type": "application/json",
//                     Accept: "application/json",
//                   },
//                   httpsAgent: agent,
//                   transformRequest: [(data) => data],
//                   timeout: 10000,
//                 }
//               );

//               console.log(`API Call Successful:`, response.data);
//               apiResponses.push(response.data);
//               // logSuccessToCSV(
//               //   `API Call Successful: ${JSON.stringify(response.data)}`
//               // );
//             } catch (error) {
//               const errorMessage = `API Call Failed: ${
//                 error.response?.data || error.message
//               }`;
//               console.error(errorMessage);

//               // // Log errors correctly
//               // logErrorsToCSV(errorMessage);

//               apiResponses.push({ error: errorMessage });
//             }
//           }
//         }
//       } catch (err) {
//         console.error("Database Connection Error:", err);
//         // logErrorsToCSV(`Database Connection Error: ${err.message}`);
//         errors.push(err.message);
//       }
//     }

//     if (errors.length > 0) {
//       return { errors };
//     }

//     return { responses: apiResponses };
//   } catch (error) {
//     console.log("Error occurred:", error);
//     // logErrorsToCSV(error.message);

//     throw error;
//   }
// }

exports.login = async (req, res) => {
  try {
    // Close any existing connection before starting a new one
    await mssql.close();
    await mssql.connect(dbConfig);

    // Get username, password, and IP from request
    const { username, password, ip } = req.body;
    const date = require("moment")().format("YYYY-MM-DD HH:mm:ss"); // Format timestamp

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    // Check if user exists
    const userCheckRequest = new mssql.Request();
    userCheckRequest.input("username", mssql.VarChar, username);

    const loginResult = await userCheckRequest.query(
      "USE [RTPOS_MAIN] SELECT * FROM tb_USERS WHERE username = @username"
    );

    if (loginResult.recordset.length === 0) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const user = loginResult.recordset[0];
    PORT = user.port;
    IP = user.ip_address;
    CUSTOMER_ID = user.CUSTOMERID;
    console.log("customer id", CUSTOMER_ID);

    if (!PORT || !IP) {
      return res.status(400).json({
        message:
          "Connection hasn't been established yet! Please contact the system support team.",
      });
    }

    //Verify Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await mssql.close();
      return res.status(400).json({ message: "Invalid password" });
    }

    //Insert user log (if it fails, continue login process)
    try {
      const insertQuery = `
        USE [RTPOS_MAIN]
        INSERT INTO tb_LOG (username, ip, datetime)
        VALUES (@username, @ip, @datetime)
      `;

      const insertRequest = new mssql.Request();
      insertRequest.input("username", mssql.VarChar, username);
      insertRequest.input("ip", mssql.VarChar, ip);
      insertRequest.input("datetime", mssql.VarChar, date);

      await insertRequest.query(insertQuery);
      console.log("User log successfully added");
    } catch (err) {
      console.error("Error during user log adding:", err);
      // Log error but don't stop login process
    }

    //Prepare for dynamic database connection
    PORT = PORT.trim();
    IP = IP.trim();
    PORT = parseInt(PORT);

    // Close previous connection before connecting to dynamic database
    await mssql.close();

    const dynamicDbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: IP,
      database: process.env.DB_DATABASE2,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      port: PORT,
    };
    //Connect to dynamic database
    await mssql.connect(dynamicDbConfig);
    console.log("Successfully connected to the dynamic database");

    const customerCheckRequest = new mssql.Request();
    customerCheckRequest.input("CUSTOMER_ID", mssql.Int, CUSTOMER_ID);

    const customerResult = await customerCheckRequest.query(
      "USE [RT_WEB] SELECT * FROM tb_COMPANY WHERE CUSTOMERID = @CUSTOMER_ID"
    );

    if (customerResult.recordset.length === 0) {
      console.log("customer ID doesnt matches");
      return res.status(400).json({ message: "Invalid customer ID" });
    }
    console.log("customer ID matches");

    //Generate JWT Token
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
        t_scan: user.t_scan,
        t_stock: user.t_stock,
        t_grn: user.t_grn,
        t_prn: user.t_prn,
        t_tog: user.t_tog,
        t_stock_update: user.t_stock_update,
      },
      process.env.JWT_SECRET, // Use environment variable
      { expiresIn: "1h" }
    );

    //Close database connection & send response
    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);

    if (!res.headersSent) {
      return res.status(500).json({ message: "Failed to log in" });
    }
  }
};

// // Register function
// exports.register = async (req, res) => {
//   await mssql.close();
//   await mssql.connect(dbConfig);

//   const { username, email, password } = req.body;
//   console.log("request body", req.body);
//   try {
//     const userCheckQuery = `
//     USE [RTPOS_MAIN]
//       SELECT * FROM tb_USERS WHERE username = @username OR email = @email
//     `;
//     const userCheckRequest = new mssql.Request();
//     userCheckRequest.input("username", mssql.VarChar, username);
//     userCheckRequest.input("Email", mssql.VarChar, email);

//     const userResult = await userCheckRequest.query(userCheckQuery);
//     if (userResult.recordset.length > 0) {
//       const existingUser = userResult.recordset[0];
//       if (existingUser.username === username) {
//         return res.status(400).json({ message: "Username already exists" });
//       }
//       if (existingUser.email === email) {
//         return res.status(400).json({ message: "Email already exists" });
//       }
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const insertQuery = `
//     USE [RTPOS_MAIN]
//       INSERT INTO tb_USERS (username, email, password)
//       VALUES (@username, @Email, @Password)
//     `;
//     const insertRequest = new mssql.Request();
//     insertRequest.input("username", mssql.VarChar, username);
//     insertRequest.input("Email", mssql.VarChar, email);
//     insertRequest.input("Password", mssql.VarChar, hashedPassword);

//     await insertRequest.query(insertQuery);

//     res.status(201).json({ message: "User added successfully" });
//   } catch (err) {
//     console.error("Error during registration:", err);
//     res
//       .status(500)
//       .json({ message: "Failed to register. Try different username" });
//   }
// };

// // Forgot password function
// exports.forgotPassword = async (req, res) => {
//   const { username } = req.body;
//   if (!username)
//     return res.status(400).json({ message: "Username is required" });

//   try {
//     await mssql.close();
//     await mssql.connect(dbConfig);
//     const passwordResult =
//       await mssql.query`USE [RTPOS_MAIN] SELECT * FROM tb_USERS WHERE username = ${username}`;
//     if (passwordResult.recordset.length === 0)
//       return res
//         .status(400)
//         .json({ message: "No user found with this username" });

//     const user = passwordResult.recordset[0];
//     const resetToken = crypto.randomBytes(32).toString("hex");
//     const resetTokenExpiry = Date.now() + 3600000;

//     await mssql.query`
//     USE [RTPOS_MAIN]
//       UPDATE tb_USERS SET resetToken = ${resetToken}, resetTokenExpiry = ${resetTokenExpiry} WHERE username = ${username}
//     `;

//     await sendPasswordResetEmail(user.email, resetToken);
//     res.status(200).json({ message: "Password reset email sent" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Failed to send password reset email" });
//   }
// };

// // Reset password function
// exports.resetPassword = async (req, res) => {
//   const { token, newPassword } = req.body;

//   if (!token || !newPassword) {
//     return res
//       .status(400)
//       .json({ message: "Token and new password are required" });
//   }

//   try {
//     const resetPasswordResult = await mssql.query`
//     USE [RTPOS_MAIN]
//       SELECT * FROM tb_USERS WHERE resetToken = ${token}
//     `;

//     if (resetPasswordResult.recordset.length === 0) {
//       return res.status(400).json({ message: "Invalid or expired token" });
//     }

//     const user = resetPasswordResult.recordset[0];

//     if (Date.now() > user.resetTokenExpiry) {
//       return res.status(400).json({ message: "Reset token has expired" });
//     }

//     const hashedPassword = await bcrypt.hash(newPassword, 10);

//     await mssql.query`
//     USE [RTPOS_MAIN]
//       UPDATE tb_USERS
//       SET password = ${hashedPassword}, resetToken = NULL, resetTokenExpiry = NULL
//       WHERE resetToken = ${token}
//     `;
//     res.status(200).json({ message: "Password has been reset successfully" });
//   } catch (error) {
//     console.error("Error resetting password:", error);
//     res.status(500).json({ message: "Failed to reset password" });
//   }
// };

// // Get dashboard data function
// exports.dashboardOptions = async (req, res) => {
//   try {
//     const dashboardOptionsResult = await mssql.query`
//     USE [RT_WEB]
//       SELECT COMPANY_CODE, COMPANY_NAME FROM tb_COMPANY;
//     `;

//     if (dashboardOptionsResult.recordset.length === 0) {
//       console.log("no companies found");
//       return res.status(404).json({ message: "User not found" });
//     }
//     // Trim any trailing spaces from COMPANY_CODE
//     const userData = dashboardOptionsResult.recordset.map((row) => ({
//       COMPANY_CODE: row.COMPANY_CODE.trim(), // Remove the trailing spaces
//       COMPANY_NAME: row.COMPANY_NAME.trim(),
//     }));

//     res.status(200).json({
//       message: "Dashboard data retrieved successfully",
//       userData,
//     });
//   } catch (error) {
//     console.error("Error retrieving dashboard data:", error);
//     res.status(500).json({ message: "Failed to retrieve dashboard data" });
//   }
// };

// //company dashboard
// exports.loadingDashboard = async (req, res) => {
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       const username = decoded.username; // Assuming 'username' is part of the token payload

//       const { currentDate, fromDate, toDate, selectedOptions } = req.query;
//       console.log("selectedOptions", selectedOptions);
//       let loadingDashboardResult;
//       let record;
//       let cashierPointRecord;
//       let spResult;
//       let reportType = "SALESSUM1";

//       try {
//         const deleteResult = await mssql.query`USE [RT_WEB]
//          DELETE FROM tb_SALES_DASHBOARD_VIEW WHERE REPUSER = ${username}`;
//         console.log("delete query executed");
//       } catch (error) {
//         console.error("Error executing the delete query:", error);
//       }

//       const formattedCurrentDate = formatDate(currentDate);
//       const formattedFromDate = formatDate(fromDate);
//       const formattedToDate = formatDate(toDate);

//       if (!toDate && !fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string
//             spResult =
//               await mssql.query`EXEC Sp_SalesCurView @COMPANY_CODE = ${companyCodeString},
//                @DATE = ${formattedCurrentDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       } else if (toDate && fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string

//             spResult =
//               await mssql.query`EXEC Sp_SalesView @COMPANY_CODE = ${companyCodeString}, @DATE1 = ${formattedFromDate}, 
//               @DATE2 = ${formattedToDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       }

//       //one row
//       loadingDashboardResult = await mssql.query`
// USE [RT_WEB]
//           SELECT 
//           SUM(NETSALES) AS NETSALES,
//           SUM(CASHSALES) AS CASHSALES,
//           SUM(CARDSALES) AS CARDSALES,
//           SUM(CREDITSALES) AS CREDITSALES,
//           SUM(OTHER_PAYMENT) AS OTHER_PAYMENT,
//           SUM(GVOUCHER_SALE) AS GIFT_VOUCHER,
//           SUM(PAIDOUT) AS PAIDOUT,
//           SUM(CASHINHAND) AS CASHINHAND
//           FROM 
//           tb_SALES_DASHBOARD_VIEW
//           WHERE 
//           REPUSER = ${username}
//           AND COMPANY_CODE IN (${selectedOptions})`;

//       //return rows of data
//       record = await mssql.query`
// USE [RT_WEB]
//       SELECT 
//       COMPANY_CODE,      
//       SUM(NETSALES) AS NETSALES, 
//       SUM(CASHSALES) AS CASHSALES, 
//       SUM(CARDSALES) AS CARDSALES, 
//       SUM(CREDITSALES) AS CREDITSALES, 
//       SUM(OTHER_PAYMENT) AS OTHER_PAYMENT,
//       SUM(GVOUCHER_SALE) AS GIFT_VOUCHER,
//           SUM(PAIDOUT) AS PAIDOUT,
//           SUM(CASHINHAND) AS CASHINHAND
//   FROM 
//       tb_SALES_DASHBOARD_VIEW
//   WHERE 
//       REPUSER = ${username}
//       AND COMPANY_CODE IN (${selectedOptions})
//   GROUP BY 
//       COMPANY_CODE`;

//       cashierPointRecord = await mssql.query`
//       USE [RT_WEB]
//           SELECT 
//             COMPANY_CODE, 
//             UNITNO, 
//             SUM(NETSALES) AS NETSALES, 
//             SUM(CASHSALES) AS CASHSALES, 
//             SUM(CARDSALES) AS CARDSALES, 
//             SUM(CREDITSALES) AS CREDITSALES, 
//             SUM(OTHER_PAYMENT) AS OTHER_PAYMENT,
//             SUM(GVOUCHER_SALE) AS GIFT_VOUCHER,
//           SUM(PAIDOUT) AS PAIDOUT,
//           SUM(CASHINHAND) AS CASHINHAND
//           FROM tb_SALES_DASHBOARD_VIEW
//           WHERE REPUSER = ${username}
//           AND COMPANY_CODE IN (${selectedOptions})
//           GROUP BY COMPANY_CODE, UNITNO`;
//       // Format the result to ensure two decimal places
//       const formattedResult = loadingDashboardResult.recordset.map((row) => ({
//         ...row,
//         NETSALES: parseFloat(row.NETSALES).toFixed(2),
//         CASHSALES: parseFloat(row.CASHSALES).toFixed(2),
//         CARDSALES: parseFloat(row.CARDSALES).toFixed(2),
//         CREDITSALES: parseFloat(row.CREDITSALES).toFixed(2),
//         OTHER_PAYMENT: parseFloat(row.OTHER_PAYMENT).toFixed(2),
//         GIFT_VOUCHER: parseFloat(row.GIFT_VOUCHER).toFixed(2),
//         PAIDOUT: parseFloat(row.PAIDOUT).toFixed(2),
//         CASHINHAND: parseFloat(row.CASHINHAND).toFixed(2),
//       }));

//       console.log("result", formattedResult);
//       console.log("record", record.recordset);
//       console.log("cashierPointRecord", cashierPointRecord.recordset);
//       // Respond with the result
//       res.status(200).json({
//         message: "Processed parameters for company codes",
//         success: true,
//         result: formattedResult, // Assuming you want to return the result from the query
//         record: record ? record.recordset : [], // Include additional records if available
//         cashierPointRecord: cashierPointRecord
//           ? cashierPointRecord.recordset
//           : [], // Include additional records if available
//       });
//     });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to process parameters" });
//   }
// };

// //department dashboard
// exports.departmentDashboard = async (req, res) => {
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       const username = decoded.username; // Assuming 'username' is part of the token payload

//       const { currentDate, fromDate, toDate, selectedOptions } = req.query;

//       let tableRecords;
//       let amountBarChart;
//       let quantityBarChart;
//       // let amountChart;
//       // let quantityChart;
//       let spResult;
//       let reportType = "SALESDET";

//       const formattedCurrentDate = formatDate(currentDate);
//       const formattedFromDate = formatDate(fromDate);
//       const formattedToDate = formatDate(toDate);

//       try {
//         const deleteResult = await mssql.query`USE [RT_WEB] 
//         DELETE FROM tb_SALESVIEW WHERE REPUSER = ${username}`;
//         console.log("delete query executed");
//       } catch (error) {
//         console.error("Error executing the delete query", error);
//       }

//       if (!toDate && !fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string
//             spResult =
//               await mssql.query`EXEC Sp_SalesCurView @COMPANY_CODE = ${companyCodeString}, @DATE = ${formattedCurrentDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       } else if (toDate && fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string

//             spResult =
//               await mssql.query`EXEC Sp_SalesView @COMPANY_CODE = ${companyCodeString}, @DATE1 = ${formattedFromDate}, @DATE2 = ${formattedToDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       }

//       tableRecords = await mssql.query`
//           USE [RT_WEB]
//                 SELECT   
//          LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
//          LTRIM(RTRIM(DEPTCODE)) AS DEPARTMENT_CODE,
//          DEPTNAME AS DEPARTMENT_NAME,
//                 SUM(QTY) AS QUANTITY,
//                 SUM(AMOUNT) AS AMOUNT
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY COMPANY_CODE,DEPTCODE,DEPTNAME`;

//       amountBarChart = await mssql.query`
//           USE [RT_WEB]
//             SELECT   
//           DEPTNAME,
//                 SUM(AMOUNT) AS AMOUNT
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY DEPTNAME`;

//       quantityBarChart = await mssql.query`
//           USE [RT_WEB]
//             SELECT   
//           DEPTNAME,
//                 SUM(QTY) AS QUANTITY             
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY DEPTNAME`;
//       //       amountChart = await mssql.query`
//       //                 USE [RT_WEB];
//       // SELECT
//       // 		DEPTNAME,
//       //           SUM(Amount) AS AMOUNT
//       //           FROM
//       //           tb_SALESVIEW
//       //           WHERE
//       //           REPUSER = ${username}
//       //           AND COMPANY_CODE IN (${selectedOptions})
//       //           GROUP BY DEPTNAME`;

//       //       quantityChart = await mssql.query`
//       //                 USE [RT_WEB];
//       // SELECT
//       // 		DEPTNAME,
//       //           SUM(QTY) AS QTY
//       //           FROM
//       //           tb_SALESVIEW
//       //           WHERE
//       //           REPUSER = ${username}
//       //           AND COMPANY_CODE IN (${selectedOptions})
//       //           GROUP BY DEPTNAME`;

//       console.log("result1", tableRecords.recordset);
//       console.log("result3", amountBarChart.recordset);
//       console.log("result4", quantityBarChart.recordset);

//       res.status(200).json({
//         message: "Processed parameters for company codes",
//         success: true,
//         tableRecords: tableRecords ? tableRecords.recordset : [],
//         amountBarChart: amountBarChart ? amountBarChart.recordset : [],
//         quantityBarChart: quantityBarChart ? quantityBarChart.recordset : [],
//         // amountChart: amountChart ? amountChart.recordset : [],
//         // quantityChart: quantityChart ? quantityChart.recordset : [],
//       });
//     });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to process parameters" });
//   }
// };

// //category dashboard
// exports.categoryDashboard = async (req, res) => {
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       const username = decoded.username; // Assuming 'username' is part of the token payload

//       const { currentDate, fromDate, toDate, selectedOptions } = req.query;

//       let categoryTableRecords;
//       let categoryAmountBarChart;
//       let categoryQuantityBarChart;
//       let spResult;
//       let reportType = "SALESDET";

//       const formattedCurrentDate = formatDate(currentDate);
//       const formattedFromDate = formatDate(fromDate);
//       const formattedToDate = formatDate(toDate);

//       try {
//         const deleteResult = await mssql.query`USE [RT_WEB] 
//         DELETE FROM tb_SALESVIEW WHERE REPUSER = ${username}`;
//         console.log("delete query executed");
//       } catch (error) {
//         console.error("Error executing the delete query", error);
//       }

//       if (!toDate && !fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string
//             spResult =
//               await mssql.query`EXEC Sp_SalesCurView @COMPANY_CODE = ${companyCodeString}, @DATE = ${formattedCurrentDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       } else if (toDate && fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string

//             spResult =
//               await mssql.query`EXEC Sp_SalesView @COMPANY_CODE = ${companyCodeString}, @DATE1 = ${formattedFromDate}, @DATE2 = ${formattedToDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       }

//       categoryTableRecords = await mssql.query`
//           USE [RT_WEB]
//                 SELECT   
//          LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
//          LTRIM(RTRIM(CATCODE)) AS CATEGORY_CODE,
//          CATNAME AS CATEGORY_NAME,
//                 SUM(QTY) AS QUANTITY,
//                 SUM(AMOUNT) AS AMOUNT
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY COMPANY_CODE,CATCODE,CATNAME`;

//       categoryAmountBarChart = await mssql.query`
//           USE [RT_WEB]
//             SELECT   
//           CATNAME,
//                 SUM(AMOUNT) AS AMOUNT
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY CATNAME`;

//       categoryQuantityBarChart = await mssql.query`
//                 USE [RT_WEB]
//                   SELECT   
//                 CATNAME,
//                       SUM(QTY) AS QUANTITY
//                       FROM 
//                       tb_SALESVIEW
//                       WHERE 
//                       REPUSER = ${username}
//                       AND COMPANY_CODE IN (${selectedOptions})
//                       GROUP BY CATNAME`;

//       console.log("result1", categoryTableRecords.recordset);
//       // console.log("result2", categoryBarChart.recordset);

//       res.status(200).json({
//         message: "Processed parameters for company codes",
//         success: true,
//         categoryTableRecords: categoryTableRecords
//           ? categoryTableRecords.recordset
//           : [],
//         categoryAmountBarChart: categoryAmountBarChart
//           ? categoryAmountBarChart.recordset
//           : [],
//         categoryQuantityBarChart: categoryQuantityBarChart
//           ? categoryQuantityBarChart.recordset
//           : [],
//       });
//     });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to process parameters" });
//   }
// };

// //sub category dashboard
// exports.subCategoryDashboard = async (req, res) => {
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       const username = decoded.username; // Assuming 'username' is part of the token payload

//       const { currentDate, fromDate, toDate, selectedOptions } = req.query;

//       let subCategoryTableRecords;
//       let subCategoryAmountBarChart;
//       let subCategoryQuantityBarChart;
//       let spResult;
//       let reportType = "SALESDET";

//       const formattedCurrentDate = formatDate(currentDate);
//       const formattedFromDate = formatDate(fromDate);
//       const formattedToDate = formatDate(toDate);

//       try {
//         const deleteResult = await mssql.query`USE [RT_WEB] 
//         DELETE FROM tb_SALESVIEW WHERE REPUSER = ${username}`;
//         console.log("delete query executed");
//       } catch (error) {
//         console.error("Error executing the delete query", error);
//       }

//       if (!toDate && !fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string
//             spResult =
//               await mssql.query`EXEC Sp_SalesCurView @COMPANY_CODE = ${companyCodeString}, @DATE = ${formattedCurrentDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       } else if (toDate && fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string

//             spResult =
//               await mssql.query`EXEC Sp_SalesView @COMPANY_CODE = ${companyCodeString}, @DATE1 = ${formattedFromDate}, @DATE2 = ${formattedToDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       }

//       subCategoryTableRecords = await mssql.query`
//           USE [RT_WEB]
//                 SELECT   
//          LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
//          LTRIM(RTRIM(SCATCODE)) AS SUBCATEGORY_CODE,
//          SCATNAME AS SUBCATEGORY_NAME,
//                 SUM(QTY) AS QUANTITY,
//                 SUM(AMOUNT) AS AMOUNT
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY COMPANY_CODE,SCATCODE,SCATNAME`;

//       subCategoryAmountBarChart = await mssql.query`
//           USE [RT_WEB]
//             SELECT   
//           SCATNAME,
//                 SUM(AMOUNT) AS AMOUNT
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY SCATNAME`;

//       subCategoryQuantityBarChart = await mssql.query`
//                 USE [RT_WEB]
//                   SELECT   
//                 SCATNAME,
//                       SUM(QTY) AS QUANTITY
//                       FROM 
//                       tb_SALESVIEW
//                       WHERE 
//                       REPUSER = ${username}
//                       AND COMPANY_CODE IN (${selectedOptions})
//                       GROUP BY SCATNAME`;

//       console.log("result1", subCategoryTableRecords.recordset);
//       console.log("result2", subCategoryAmountBarChart.recordset);

//       res.status(200).json({
//         message: "Processed parameters for company codes",
//         success: true,
//         subCategoryTableRecords: subCategoryTableRecords
//           ? subCategoryTableRecords.recordset
//           : [],
//         subCategoryAmountBarChart: subCategoryAmountBarChart
//           ? subCategoryAmountBarChart.recordset
//           : [],
//         subCategoryQuantityBarChart: subCategoryQuantityBarChart
//           ? subCategoryQuantityBarChart.recordset
//           : [],
//       });
//     });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to process parameters" });
//   }
// };

// //vendor dashboard
// exports.vendorDashboard = async (req, res) => {
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       const username = decoded.username; // Assuming 'username' is part of the token payload

//       const { currentDate, fromDate, toDate, selectedOptions } = req.query;

//       let vendorTableRecords;
//       let vendorAmountBarChart;
//       let vendorQuantityBarChart;
//       let spResult;
//       let reportType = "SALESDET";

//       const formattedCurrentDate = formatDate(currentDate);
//       const formattedFromDate = formatDate(fromDate);
//       const formattedToDate = formatDate(toDate);

//       try {
//         const deleteResult = await mssql.query`USE [RT_WEB] 
//         DELETE FROM tb_SALESVIEW WHERE REPUSER = ${username}`;
//         console.log("delete query executed");
//       } catch (error) {
//         console.error("Error executing the delete query", error);
//       }

//       if (!toDate && !fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string
//             spResult =
//               await mssql.query`EXEC Sp_SalesCurView @COMPANY_CODE = ${companyCodeString}, @DATE = ${formattedCurrentDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       } else if (toDate && fromDate) {
//         try {
//           for (let i = 0; i < selectedOptions.length; i++) {
//             const companyCodeString = String(selectedOptions[i]); // Convert to string

//             spResult =
//               await mssql.query`EXEC Sp_SalesView @COMPANY_CODE = ${companyCodeString}, @DATE1 = ${formattedFromDate}, @DATE2 = ${formattedToDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//           }
//         } catch (error) {
//           console.error("Error executing stored procedure:", error);
//         }
//       }

//       vendorTableRecords = await mssql.query`
//           USE [RT_WEB]
//                 SELECT   
//          LTRIM(RTRIM(COMPANY_CODE)) AS COMPANY_CODE,
//          LTRIM(RTRIM(VENDORCODE)) AS VENDOR_CODE,
//          VENDORNAME AS VENDOR_NAME,
//                 SUM(QTY) AS QUANTITY,
//                 SUM(AMOUNT) AS AMOUNT
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY COMPANY_CODE,VENDORCODE,VENDORNAME`;

//       vendorAmountBarChart = await mssql.query`
//           USE [RT_WEB]
//             SELECT   
//           VENDORNAME,
//                 SUM(AMOUNT) AS AMOUNT
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY VENDORNAME`;

//       vendorQuantityBarChart = await mssql.query`
//           USE [RT_WEB]
//             SELECT   
//           VENDORNAME,
//                 SUM(QTY) AS QUANTITY
//                 FROM 
//                 tb_SALESVIEW
//                 WHERE 
//                 REPUSER = ${username}
//                 AND COMPANY_CODE IN (${selectedOptions})
//                 GROUP BY VENDORNAME`;

//       res.status(200).json({
//         message: "Processed parameters for company codes",
//         success: true,
//         vendorTableRecords: vendorTableRecords
//           ? vendorTableRecords.recordset
//           : [],
//         vendorAmountBarChart: vendorAmountBarChart
//           ? vendorAmountBarChart.recordset
//           : [],
//         vendorQuantityBarChart: vendorQuantityBarChart
//           ? vendorQuantityBarChart.recordset
//           : [],
//       });
//     });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to process parameters" });
//   }
// };

// //report
// exports.reportData = async (req, res) => {
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       const username = decoded.username; // Assuming 'username' is part of the token payload

//       const { fromDate, toDate, invoiceNo, selectedOptions } = req.query;

//       let reportData;
//       let spResult;
//       let invoiceData;
//       let reportType = "INVOICEWISE";

//       try {
//         await mssql.query`USE [RT_WEB]
//          DELETE FROM tb_SALESVIEW WHERE REPUSER = ${username}`;
//         console.log("delete query executed");
//       } catch (error) {
//         console.error("Error executing the delete query:", error);
//       }

//       const formattedFromDate = formatDate(fromDate);
//       const formattedToDate = formatDate(toDate);

//       try {
//         for (let i = 0; i < selectedOptions.length; i++) {
//           const companyCodeString = String(selectedOptions[i]); // Convert to string

//           spResult =
//             await mssql.query`EXEC Sp_SalesView @COMPANY_CODE = ${companyCodeString}, @DATE1 = ${formattedFromDate}, 
//           @DATE2 = ${formattedToDate}, @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//         }
//       } catch (error) {
//         console.error("Error executing the SP:", error);
//       }

//       reportData = await mssql.query`
//           USE [RT_WEB]
//           SELECT 
//           INVOICENO, COMPANY_CODE, UNITNO, REPNO, 'CASH' AS PRODUCT_NAME, 
//           IsNull(Sum(CASE PRODUCT_NAME WHEN 'CASH' THEN AMOUNT WHEN 'BALANCE' THEN -AMOUNT ELSE 0 END),0) AS AMOUNT, 
//           SALESDATE 
//           FROM tb_SALESVIEW 
//           WHERE (ID='PT' Or ID='BL') AND (PRODUCT_NAME ='CASH' OR PRODUCT_NAME ='BALANCE') AND REPUSER = ${username}
//           GROUP BY 
//           COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO
//           UNION ALL
//           SELECT 
//           INVOICENO, COMPANY_CODE, UNITNO, REPNO, PRODUCT_NAME, ISNULL(SUM(AMOUNT),0) AS AMOUNT, SALESDATE FROM tb_SALESVIEW 
//           WHERE ID='PT' AND (PRODUCT_NAME <>'CASH' AND PRODUCT_NAME <>'BALANCE') AND REPUSER = ${username}
//           GROUP BY 
//           COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO, PRODUCT_NAME `;

//       if (invoiceNo) {
//         invoiceData = await mssql.query`
//           USE [RT_WEB]
//           SELECT INVOICENO, PRODUCT_NAME, QTY, AMOUNT, COSTPRICE, UNITPRICE, DISCOUNT 
//           FROM tb_SALESVIEW 
//           WHERE 
//           INVOICENO = ${invoiceNo} AND (ID = 'SL' OR ID = 'SLF' OR ID = 'RF' OR ID = 'RFF') AND REPUSER = ${username}`;
//       }

//       // Respond with the result
//       res.status(200).json({
//         message: "Invoice data found",
//         success: true,
//         reportData: reportData ? reportData.recordset : [],
//         invoiceData: invoiceData ? invoiceData.recordset : [],
//       });
//     });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to process parameters" });
//   }
// };

// //current report
// exports.currentReportData = async (req, res) => {
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       const username = decoded.username; // Assuming 'username' is part of the token payload

//       const { companyCodes, currentDate, invoiceNo } = req.query;

//       let reportData;
//       let spResult;
//       let invoiceData;
//       let reportType = "INVOICEWISE";

//       try {
//         await mssql.query`USE [RT_WEB]
//          DELETE FROM tb_SALESVIEW WHERE REPUSER = ${username}`;
//         console.log("delete query executed");
//       } catch (error) {
//         console.error("Error executing the delete query:", error);
//       }

//       const date = formatDate(currentDate);

//       try {
//         for (let i = 0; i < companyCodes.length; i++) {
//           const companyCodeString = String(companyCodes[i]); // Convert to string

//           spResult =
//             await mssql.query`EXEC Sp_SalesCurView @COMPANY_CODE = ${companyCodeString}, @DATE = ${date}, 
//          @REPUSER = ${username}, @REPORT_TYPE = ${reportType}`;
//         }
//       } catch (error) {
//         console.error("Error executing the SP:", error);
//       }

//       reportData = await mssql.query`
//           USE [RT_WEB]
//           SELECT 
//           INVOICENO, COMPANY_CODE, UNITNO, REPNO, 'CASH' AS PRODUCT_NAME, 
//           IsNull(Sum(CASE PRODUCT_NAME WHEN 'CASH' THEN AMOUNT WHEN 'BALANCE' THEN -AMOUNT ELSE 0 END),0) AS AMOUNT, 
//           SALESDATE 
//           FROM tb_SALESVIEW 
//           WHERE (ID='PT' Or ID='BL') AND (PRODUCT_NAME ='CASH' OR PRODUCT_NAME ='BALANCE') AND REPUSER = ${username}
//           GROUP BY 
//           COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO
//           UNION ALL
//           SELECT 
//           INVOICENO, COMPANY_CODE, UNITNO, REPNO, PRODUCT_NAME, ISNULL(SUM(AMOUNT),0) AS AMOUNT, SALESDATE FROM tb_SALESVIEW 
//           WHERE ID='PT' AND (PRODUCT_NAME <>'CASH' AND PRODUCT_NAME <>'BALANCE') AND REPUSER = ${username}
//           GROUP BY 
//           COMPANY_CODE, SALESDATE, UNITNO, REPNO, INVOICENO, PRODUCT_NAME `;

//       if (invoiceNo) {
//         invoiceData = await mssql.query`
//           USE [RT_WEB]
//           SELECT INVOICENO, PRODUCT_NAME, QTY, AMOUNT, COSTPRICE, UNITPRICE, DISCOUNT 
//           FROM tb_SALESVIEW 
//           WHERE 
//           INVOICENO = ${invoiceNo} AND (ID = 'SL' OR ID = 'SLF' OR ID = 'RF' OR ID = 'RFF') AND REPUSER = ${username}`;
//       }
//       console.log(reportData.recordset);
//       // Respond with the result
//       res.status(200).json({
//         message: "Invoice data found",
//         success: true,
//         reportData: reportData ? reportData.recordset : [],
//         invoiceData: invoiceData ? invoiceData.recordset : [],
//       });
//     });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to process parameters" });
//   }
// };

// // Reset database connection
// exports.resetDatabaseConnection = async (req, res) => {
//   const {
//     name,
//     ip,
//     port,
//     username,
//     customerID,
//     admin,
//     dashboard,
//     stock,
//     removeAdmin,
//     removeStock,
//     removeDashboard,
//   } = req.body;
//   console.log('hello',req.body);
//   const newPort = port.trim();
//   const newName = name.trim();
//   const newIP = ip.trim();

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

//     try {
//       await jwt.verify(token, process.env.JWT_SECRET);
//     } catch (err) {
//       return res.status(403).json({ message: "Invalid or expired token" });
//     }

//     // if (ip === "" && port === "" && admin === "" && dashboard === "" && stock === "") {
//     //   return res.status(400).json({ message: "Please enter data to update" });
//     // }

//     await mssql.close();
//     const dynamicDbConfigRP = {
//       user: process.env.DB_USER,
//       password: process.env.DB_PASSWORD,
//       server: process.env.DB_SERVER,
//       database: process.env.DB_DATABASE1,
//       options: {
//         encrypt: false,
//         trustServerCertificate: true,
//       },
//       port: 1443,
//     };

//     await mssql.connect(dynamicDbConfigRP);

//     let databaseConnectionResult;
//     if (ip === "") {
//       databaseConnectionResult = await mssql.query`
//         USE [RTPOS_MAIN]
//         UPDATE tb_USERS SET port = ${newPort}, registered_by = ${username} WHERE username = ${newName};
//       `;
//     } else if (port === "") {
//       databaseConnectionResult = await mssql.query`
//         USE [RTPOS_MAIN]
//         UPDATE tb_USERS SET ip_address = ${newIP}, registered_by = ${username} WHERE username = ${newName};
//       `;
//     } else if (port !== "" && ip !== "") {
//       databaseConnectionResult = await mssql.query`
//         USE [RTPOS_MAIN]
//         UPDATE tb_USERS SET ip_address = ${newIP}, port = ${newPort}, registered_by = ${username} WHERE username = ${newName};
//       `;
//     }

//     if (customerID !== "") {
//       const request = new mssql.Request();
//       request.input("customerID", mssql.Int, customerID); // Assuming customerID is an integer
//       request.input("newName", mssql.NVarChar, newName); // Assuming username is a string

//       const customerConnectionResult = await request.query(`
//         USE [RTPOS_MAIN];
//         UPDATE tb_USERS 
//         SET CUSTOMERID = @customerID 
//         WHERE username = @newName;
//       `);

//       if (customerConnectionResult.rowsAffected[0] === 0) {
//         return res
//           .status(404)
//           .json({ message: "Customer ID was not updated." });
//       }
//     }

//     const updatePermissions = async (columns, value) => {
//       for (const column of columns) {
//         if (!/^[a-zA-Z0-9_]+$/.test(column)) {
//           return res
//             .status(400)
//             .json({ message: `Invalid column name detected: ${column}` });
//         }

//         const query = `
//           USE [RTPOS_MAIN];
//           UPDATE tb_USERS SET ${column} = @value, registered_by = @registeredBy WHERE username = @newName;
//         `;

//         const request = new mssql.Request();
//         request.input("value", value);
//         request.input("registeredBy", username);
//         request.input("newName", newName);

//         const result = await request.query(query);

//         if (result.rowsAffected[0] === 0) {
//           return res
//             .status(404)
//             .json({ message: "Please check the provided data." });
//         }
//       }
//     };

//     if (
//       (admin.length === 0 || dashboard.length === 0,
//       stock.length === 0 ||
//         removeAdmin.length === 0 ||
//         removeDashboard.length === 0 ||
//         removeStock.length === 0)
//     ) {
//       if (admin.length !== 0) await updatePermissions(admin, "T");
//       if (dashboard.length !== 0) await updatePermissions(dashboard, "T");
//       if (stock.length !== 0) await updatePermissions(stock, "T");
//       if (removeAdmin.length !== 0) await updatePermissions(removeAdmin, "F");
//       if (removeStock.length !== 0) await updatePermissions(removeStock, "F");
//       if (removeDashboard.length !== 0)
//         await updatePermissions(removeDashboard, "F");

//       if (databaseConnectionResult.rowsAffected[0] === 0) {
//         return res
//           .status(404)
//           .json({ message: "Please check the provided data." });
//       }
//     }

//     if (
//       ip === "" &&
//       port === "" &&
//       admin.length === 0 &&
//       dashboard.length === 0 &&
//       stock.length === 0 &&
//       removeAdmin.length === 0 &&
//       removeDashboard.length === 0 &&
//       removeStock.length === 0 &&
//       customerID === ""
//     ) {
//       return res
//         .status(404)
//         .json({ message: "Please provide details to update." });
//     }

//     return res
//       .status(200)
//       .json({ message: "Database connection updated successfully" });
//   } catch (err) {
//     console.error("Error:", err);
//     return res
//       .status(500)
//       .json({ message: "Failed to establish the connection." });
//   }
// };

// //log out
// exports.closeConnection = async (req, res) => {
//   try {
//     await mssql.close();

//     res.status(201).json({ message: "Connection Closed successfully" });
//   } catch (err) {
//     console.error("Error during connection closing:", err);
//     res.status(500).json({ message: "Failed to close the connection" });
//   }
// };

// // Get dashboard data function
// exports.vendorOptions = async (req, res) => {
//   try {
//     const vendorOptionsResult = await mssql.query`
//     USE [POSBACK_SYSTEM]
//       SELECT VENDORCODE, VENDORNAME FROM tb_VENDOR;
//     `;

//     if (vendorOptionsResult.recordset.length === 0) {
//       console.log("no vendor found");
//       return res.status(404).json({ message: "Vendor not found" });
//     }
//     // Trim any trailing spaces from COMPANY_CODE
//     const vendorData = vendorOptionsResult.recordset.map((row) => ({
//       VENDORCODE: row.VENDORCODE.trim(), // Remove the trailing spaces
//       VENDORNAME: row.VENDORNAME.trim(),
//     }));

//     res.status(200).json({
//       message: "Dashboard data retrieved successfully",
//       vendorData,
//     });
//   } catch (error) {
//     console.error("Error retrieving dashboard data:", error);
//     res.status(500).json({ message: "Failed to retrieve dashboard data" });
//   }
// };

// //sales scan
// exports.scan = async (req, res) => {
//   const codeData = req.query.data;
//   const company = req.query.company;
//   let salesData;
//   let quantity;
//   try {
//     if (codeData !== "No result" && codeData !== "" && codeData !== null) {
//       const product = await mssql.query`
//     USE [POSBACK_SYSTEM] SELECT PRODUCT_CODE FROM tb_BARCODELINK 
//       WHERE BARCODE = ${codeData};
//     `;

//       if (product.recordset.length === 0) {
//         salesData = await mssql.query`
//       USE [POSBACK_SYSTEM] SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE FROM tb_PRODUCT 
//         WHERE PRODUCT_CODE = ${codeData}  OR BARCODE = ${codeData} OR BARCODE2 = ${codeData} ;
//       `;
//       } else {
//         const productCode = product.recordset[0]?.PRODUCT_CODE;
//         salesData = await mssql.query`
//       USE [POSBACK_SYSTEM] SELECT PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, SCALEPRICE FROM tb_PRODUCT 
//         WHERE PRODUCT_CODE = ${productCode};
//       `;
//       }

//       const code = salesData.recordset[0]?.PRODUCT_CODE;
//       quantity = await mssql.query`
//     SELECT ISNULL(SUM(STOCK),0) AS STOCK FROM tb_STOCK WHERE COMPANY_CODE = ${company} 
//     AND (BIN = 'F' OR BIN IS NULL)
//      AND PRODUCT_CODE = ${code}
//     `;
//     } else {
//       console.log("no code provided");
//       return res
//         .status(404)
//         .json({ message: "Please provide code or scanned barcode" });
//     }

//     if (salesData.recordset.length === 0) {
//       console.log("no product found");
//       return res.status(404).json({ message: "Product not found" });
//     }

//     res.status(200).json({
//       message: "Item Found Successfully",
//       salesData: salesData.recordset,
//       amount: quantity.recordset[0]?.STOCK,
//     });
//   } catch (error) {
//     console.error("Error retrieving barcode data:", error);
//     res.status(500).json({ message: "Failed to retrieve barcode data" });
//   }
// };

// //temp sales table
// exports.updateTempSalesTable = async (req, res) => {
//   let username;
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       username = decoded.username; // Assuming 'username' is part of the token payload
//     });

//     const {
//       company,
//       count,
//       type,
//       productCode,
//       productName,
//       costPrice,
//       scalePrice,
//       stock,
//       quantity,
//     } = req.body;

//     const insertQuery = `
//     USE [RT_WEB]
//       INSERT INTO tb_STOCKRECONCILATION_DATAENTRYTEMP 
//       (COMPANY_CODE, COUNT_STATUS, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER)
//       VALUES (@company, @count, @type, @productCode, @productName, @costPrice, @scalePrice, @stock, @quantity, @username)
//     `;
//     const insertRequest = new mssql.Request();
//     insertRequest.input("company", mssql.NChar(10), company);
//     insertRequest.input("count", mssql.NChar(10), count);
//     insertRequest.input("type", mssql.NChar(10), type);
//     insertRequest.input("productCode", mssql.NChar(30), productCode);
//     insertRequest.input("productName", mssql.NChar(50), productName);
//     insertRequest.input("costPrice", mssql.Money, costPrice);
//     insertRequest.input("scalePrice", mssql.Money, scalePrice);
//     insertRequest.input("stock", mssql.Float, stock);
//     insertRequest.input("quantity", mssql.Float, quantity);
//     insertRequest.input("username", mssql.NChar(10), username);

//     // Execute Query
//     await insertRequest.query(insertQuery);
//     res.status(201).json({ message: "Table Updated successfully" });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to update table" });
//   }
// };

// //temp grn table
// exports.updateTempGrnTable = async (req, res) => {
//   let username;
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       username = decoded.username; // Assuming 'username' is part of the token payload
//     });
//     console.log(req.body);
//     const {
//       company,
//       type,
//       productCode,
//       productName,
//       costPrice,
//       scalePrice,
//       stock,
//       quantity,
//       vendor_code,
//       vendor_name,
//       invoice_no,
//     } = req.body;

//     let insertQuery;

//     if (type === "GRN") {
//       insertQuery = `
//       USE [RT_WEB]
//         INSERT INTO tb_GRN_TEMP 
//         (COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER)
//         VALUES (@company, @vendor_code, @vendor_name, @invoice_no, @type, @productCode, @productName, @costPrice, @scalePrice, @stock, @quantity, @username)
//       `;
//     }
//     if (type === "PRN") {
//       insertQuery = `
//       USE [RT_WEB]
//         INSERT INTO tb_PRN_TEMP 
//         (COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER)
//         VALUES (@company, @vendor_code, @vendor_name, @invoice_no, @type, @productCode, @productName, @costPrice, @scalePrice, @stock, @quantity, @username)
//       `;
//     }

//     const insertRequest = new mssql.Request();
//     insertRequest.input("company", mssql.NChar(10), company);
//     insertRequest.input("vendor_code", mssql.NChar(10), vendor_code);
//     insertRequest.input("vendor_name", mssql.NChar(50), vendor_name);
//     insertRequest.input("invoice_no", mssql.NChar(10), invoice_no);
//     insertRequest.input("type", mssql.NChar(10), type);
//     insertRequest.input("productCode", mssql.NChar(30), productCode);
//     insertRequest.input("productName", mssql.NChar(50), productName);
//     insertRequest.input("costPrice", mssql.Money, costPrice);
//     insertRequest.input("scalePrice", mssql.Money, scalePrice);
//     insertRequest.input("stock", mssql.Float, stock);
//     insertRequest.input("quantity", mssql.Float, quantity);
//     insertRequest.input("username", mssql.NChar(10), username);

//     // Execute Query
//     await insertRequest.query(insertQuery);
//     res.status(201).json({ message: "Table Updated successfully" });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to update table" });
//   }
// };

// //stock update
// exports.stockUpdate = async (req, res) => {
//   // Ensure req and res are passed properly
//   const { name, code } = req.query;
//   const username = String(name);
//   const company = String(code);

//   try {
//     // Query the database
//     const stockData = await mssql.query(`
//       USE [RT_WEB]
//       SELECT IDX,COMPANY_CODE, TYPE, COUNT_STATUS, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK
//        FROM tb_STOCKRECONCILATION_DATAENTRYTEMP WHERE REPUSER = '${username}' AND COMPANY_CODE = '${company}' AND TYPE = 'STK'
//     `);

//     // Check if data is found
//     if (
//       stockData.recordset.length === 0 
//       // &&
//       // grnData.recordset.length === 0 &&
//       // prnData.recordset.length === 0 &&
//       // togData.recordset.length === 0
//     ) {
//       console.log("No data found");
//       return res.status(404).json({ message: "Stock data not found" });
//     }

//     // Send the response
//     res.status(200).json({
//       message: "Stock data Found Successfully",
//       stockData: stockData.recordset,
//     });
//   } catch (error) {
//     console.error("Error retrieving stock data:", error);
//     res.status(500).json({ message: "Failed to retrieve data" });
//   }
// };

// // grn/prn/tog table in scan page
// exports.grnprnTableData = async (req, res) => {
//   // Ensure req and res are passed properly
//   const { name, code } = req.query;
//   const username = String(name);
//   const company = String(code);

//   try {
//     // Query the database
//     const grnData = await mssql.query(`
//       USE [RT_WEB]
//       SELECT IDX, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK
//        FROM tb_GRN_TEMP WHERE REPUSER = '${username}' AND COMPANY_CODE = '${company}' AND TYPE = 'GRN'
//     `);

//     const prnData = await mssql.query(`
//      USE [RT_WEB]
//       SELECT IDX, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK
//        FROM tb_PRN_TEMP WHERE REPUSER = '${username}' AND COMPANY_CODE = '${company}' AND TYPE = 'PRN'
//     `);

//     const togData = await mssql.query(`
//       USE [RT_WEB]
//        SELECT IDX, COMPANY_CODE, COMPANY_TO_CODE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK
//         FROM tb_TOG_TEMP WHERE REPUSER = '${username}' AND COMPANY_CODE = '${company}' AND TYPE = 'TOG'
//      `);

//     // Check if data is found
//     if (grnData.recordset.length === 0 && prnData.recordset.length === 0 && togData.recordset.length === 0) {
//       console.log("No data found");
//       return res.status(404).json({ message: "Stock data not found" });
//     }

//     // Send the response
//     res.status(200).json({
//       message: "Data Found Successfully",
//       grnData: grnData.recordset,
//       prnData: prnData.recordset,
//       togData: togData.recordset
//     });
//   } catch (error) {
//     console.error("Error retrieving stock data:", error);
//     res.status(500).json({ message: "Failed to retrieve data" });
//   }
// };

// //stock update delete
// exports.stockUpdateDelete = async (req, res) => {
//   try {
//     const idx = req.query.idx;

//     if (!idx) {
//       return res.status(400).json({ message: "Missing 'idx' parameter" });
//     }

//     // Execute the query with a parameter
//     const result = await mssql.query(`
//       USE [RT_WEB]
//       DELETE FROM tb_STOCKRECONCILATION_DATAENTRYTEMP WHERE IDX = ${idx}
//     `);

//     // Check if any rows were affected (i.e., data was deleted)
//     if (result.rowsAffected[0] === 0) {
//       console.log("No stock data found to delete");
//       return res.status(404).json({ message: "Stock data not found" });
//     }

//     res.status(200).json({
//       message: "Stock data deleted successfully",
//     });
//   } catch (error) {
//     console.error("Error deleting stock data:", error);
//     res.status(500).json({ message: "Failed to delete stock data" });
//   }
// };

// // GRN/PRN/TOG delete
// exports.grnprnDelete = async (req, res) => {
//   try {
//     console.log(req.query);
//     const { idx, type } = req.query;

//     if (!idx) {
//       return res.status(400).json({ message: "Missing 'idx' parameter" });
//     }

//     let result;

//     if (type === "GRN") {
//       result = await mssql.query(`
//         DELETE FROM RT_WEB.dbo.tb_GRN_TEMP WHERE IDX = ${idx}
//       `);
//     }

//     if (type === "PRN") {
//       result = await mssql.query(`
//         DELETE FROM RT_WEB.dbo.tb_PRN_TEMP WHERE IDX = ${idx}
//       `);
//     }
//     if (type === "TOG") {
//       result = await mssql.query(`
//         DELETE FROM RT_WEB.dbo.tb_TOG_TEMP WHERE IDX = ${idx}
//       `);
//     }

//     // Check if any rows were affected (i.e., data was deleted)
//     if (result.rowsAffected[0] === 0) {
//       return res.status(404).json({ message: "Data not found" });
//     }

//     res.status(200).json({
//       message: "Data deleted successfully",
//     });
//   } catch (error) {
//     console.error("Error deleting data:", error);
//     res.status(500).json({ message: "Failed to delete data" });
//   }
// };

// // stock update final
// exports.finalStockUpdate = async (req, res) => {
//   const { username, company } = req.query;
//   console.log(req.query);

//   if (!username) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Missing 'username' parameter" });
//   }
//   if (!company) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Missing 'company' parameter" });
//   }

//   let transaction;

//   try {
//     transaction = new mssql.Transaction();
//     await transaction.begin();

//     // Step 1: Retrieve data
//     const selectResult = await new mssql.Request(transaction).query(`
//       SELECT * FROM [RT_WEB].dbo.tb_STOCKRECONCILATION_DATAENTRYTEMP 
//       WHERE REPUSER = '${username}' AND COMPANY_CODE = '${company}'
//     `);

//     if (selectResult.recordset.length === 0) {
//       await transaction.rollback();
//       return res.status(404).json({ success: false, message: "No data found" });
//     }

//     // Step 2: Insert data into the new table
//     const insertQuery = `
//       INSERT INTO [RT_WEB].dbo.tb_STOCKRECONCILATION_DATAENTRY (
//         COMPANY_CODE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE,
//         CUR_STOCK, PHY_STOCK, TYPE, COUNT_STATUS, REPUSER
//       )
//       VALUES (
//         @COMPANY_CODE, @PRODUCT_CODE, @PRODUCT_NAMELONG, @COSTPRICE, @UNITPRICE,
//         @CUR_STOCK, @PHY_STOCK, @TYPE, @COUNT_STATUS, @REPUSER
//       )
//     `;

//     let insertCount = 0;

//     for (const row of selectResult.recordset) {
//       const insertResult = await new mssql.Request(transaction)
//         .input("COMPANY_CODE", mssql.NChar(10), row.COMPANY_CODE)
//         .input("PRODUCT_CODE", mssql.NChar(30), row.PRODUCT_CODE)
//         .input("PRODUCT_NAMELONG", mssql.NVarChar(50), row.PRODUCT_NAMELONG)
//         .input("COSTPRICE", mssql.Money, row.COSTPRICE)
//         .input("UNITPRICE", mssql.Money, row.UNITPRICE)
//         .input("CUR_STOCK", mssql.Float, row.CUR_STOCK)
//         .input("PHY_STOCK", mssql.Float, row.PHY_STOCK)
//         .input("TYPE", mssql.NChar(10), row.TYPE)
//         .input("COUNT_STATUS", mssql.NChar(10), row.COUNT_STATUS)
//         .input("REPUSER", mssql.NVarChar(10), row.REPUSER)
//         .query(insertQuery);

//       if (insertResult.rowsAffected && insertResult.rowsAffected[0] > 0) {
//         insertCount += insertResult.rowsAffected[0];
//       }
//     }
//     console.log("Final insertCount:", insertCount); // Check after loop
//     console.log("Records fetched:", selectResult.recordset.length, "records.");
//     console.log("First record:", selectResult.recordset[0]); // Show first row

//     // Step 3: Delete original data
//     const deleteResult = await new mssql.Request(transaction)
//       .input("REPUSER", mssql.NVarChar(10), username)
//       .input("COMPANY_CODE", mssql.NChar(10), company).query(`
//         DELETE FROM [RT_WEB].dbo.tb_STOCKRECONCILATION_DATAENTRYTEMP
//         WHERE REPUSER = @REPUSER AND COMPANY_CODE = @COMPANY_CODE
//       `);

//     if (deleteResult.rowsAffected[0] === 0) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "No records found to delete in the temporary table.",
//       });
//     }
//     console.log("insertCount", insertCount);
//     if (insertCount === 0) {
//       // Check if no records were inserted
//       console.log("data not moved");
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "No records moved.",
//       });
//     }

//     // Step 4: Commit the transaction
//     await transaction.commit();
//     console.log("Transaction committed successfully.", insertCount);
//     res
//       .status(200)
//       .json({ success: true, message: "Data moved and deleted successfully" });
//   } catch (generalError) {
//     console.error("Unexpected error during the process:", generalError.message);
//     if (transaction && !transaction._aborted) {
//       await transaction.rollback();
//     }
//     res.status(500).json({
//       success: false,
//       message: "Unexpected error occurred during the process.",
//       error: generalError.message,
//     });
//   }
// };

// // GRN/PRN/TOG update final
// exports.finalGrnPrnUpdate = async (req, res) => {
//   const { username, company, type, remarks } = req.query;

//   // Step 1: Validate required parameters
//   if (!username || !company || !type) {
//     return res.status(400).json({
//       success: false,
//       message: "Missing required parameters (username, company, or type)",
//     });
//   }

//   let transaction;
//   try {
//     // Start a new transaction
//     transaction = new mssql.Transaction();
//     await transaction.begin();

//     // Step 2: Retrieve data from the temp table based on type (GRN/PRN)
//     let selectResult;
//     let request1 = new mssql.Request(transaction);  // Separate request object for the first query
//     if (type === "GRN") {
//       selectResult = await request1.query`
//         SELECT * FROM [RT_WEB].dbo.tb_GRN_TEMP 
//         WHERE REPUSER = ${username} AND COMPANY_CODE = ${company}
//       `;
//     } else if (type === "PRN") {
//       selectResult = await request1.query`
//         SELECT * FROM [RT_WEB].dbo.tb_PRN_TEMP 
//         WHERE REPUSER = ${username} AND COMPANY_CODE = ${company}
//       `;
//     }else if (type === "TOG") {
//       selectResult = await request1.query`
//         SELECT * FROM [RT_WEB].dbo.tb_TOG_TEMP 
//         WHERE REPUSER = ${username} AND COMPANY_CODE = ${company}
//       `;
//     }  else {
//       await transaction.rollback();
//       return res.status(400).json({ success: false, message: "Invalid type" });
//     }

//     if (selectResult.recordset.length === 0) {
//       await transaction.rollback();
//       return res.status(404).json({ success: false, message: "No data found in temp table" });
//     }

//     // Step 3: Fetch or Insert Document data
//     let documentResult;
//     let request2 = new mssql.Request(transaction);  // Separate request object for the second query
//     documentResult = await request2.query`
//       SELECT * FROM [RT_WEB].dbo.tb_DOCUMENT 
//       WHERE COMPANY_CODE = ${company}
//     `;

//     let grn = "00";
//     let prn = "00";
//     let tog = "00";

//     if (documentResult.recordset.length === 0) {
//       const insertDoc = await request2.query`
//         INSERT INTO [RT_WEB].dbo.tb_DOCUMENT (COMPANY_CODE, GRN, PRN, TOG, REPUSER)
//         VALUES (${company}, '00', '00', '00', ${username})
//       `;
//       if (insertDoc.rowsAffected[0] === 0) {
//         throw new Error("Document insert failed");
//       }
//     } else {
//       grn = documentResult.recordset[0].GRN || "00";
//       prn = documentResult.recordset[0].PRN || "00";
//       tog = documentResult.recordset[0].TOG || "00";
//     }

//     // Step 4: Generate New Document Number
//     let newGrn = String(Number(grn) + 1).padStart(2, '0');
//     let newPrn = String(Number(prn) + 1).padStart(2, '0');
//     let newTog = String(Number(tog) + 1).padStart(2, '0');
//     let documentNo = 
//   type === "GRN" ? (company + newGrn) :
//   type === "PRN" ? (company + newPrn) :
//   type === "TOG" ? (company + newTog) :
//   "";

//     // Step 5: Update Document Table with new numbers
//     let request3 = new mssql.Request(transaction);  // Separate request object for the third query
//     if (type === "GRN") {
//       const updateResult = await request3.query`
//         UPDATE [RT_WEB].dbo.tb_DOCUMENT 
//         SET GRN = ${newGrn}
//         WHERE COMPANY_CODE = ${company}
//       `;
//       if (updateResult.rowsAffected[0] === 0) {
//         throw new Error("Failed to update GRN number");
//       }
//     } else if (type === "PRN") {
//       const updateResult = await request3.query`
//         UPDATE [RT_WEB].dbo.tb_DOCUMENT 
//         SET PRN = ${newPrn}
//         WHERE COMPANY_CODE = ${company}
//       `;
//       if (updateResult.rowsAffected[0] === 0) {
//         throw new Error("Failed to update PRN number");
//       }
//     }
//     else if (type === "TOG") {
//       const updateResult = await request3.query`
//         UPDATE [RT_WEB].dbo.tb_DOCUMENT 
//         SET TOG = ${newTog}
//         WHERE COMPANY_CODE = ${company}
//       `;
//       if (updateResult.rowsAffected[0] === 0) {
//         throw new Error("Failed to update PRN number");
//       }
//     }

//     // Step 6: Insert records into permanent table
//     for (const record of selectResult.recordset) {
//       let insertRequest = new mssql.Request(transaction);  // Separate request object for each insert query
//       if (type === "GRN") {
//         await insertRequest.query`
//           INSERT INTO [RT_WEB].dbo.tb_GRN 
//             (DOCUMENT_NO, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, 
//              PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, 
//              CUR_STOCK, PHY_STOCK, REPUSER, REMARKS)
//           VALUES (
//             ${documentNo},
//             ${record.COMPANY_CODE.trim()},
//             ${record.VENDOR_CODE.trim()},
//             ${record.VENDOR_NAME.trim()},
//             ${record.INVOICE_NO.trim()},
//             ${record.TYPE.trim()},
//             ${record.PRODUCT_CODE.trim()},
//             ${record.PRODUCT_NAMELONG.trim()},
//             ${record.COSTPRICE},
//             ${record.UNITPRICE},
//             ${record.CUR_STOCK},
//             ${record.PHY_STOCK},
//             ${username},
//             ${remarks}
//           )
//         `;
//       } else if (type === "PRN") {
//         await insertRequest.query`
//           INSERT INTO [RT_WEB].dbo.tb_PRN 
//             (DOCUMENT_NO, COMPANY_CODE, VENDOR_CODE, VENDOR_NAME, INVOICE_NO, TYPE, 
//              PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, 
//              CUR_STOCK, PHY_STOCK, REPUSER, REMARKS)
//           VALUES (
//             ${documentNo},
//             ${record.COMPANY_CODE.trim()},
//             ${record.VENDOR_CODE.trim()},
//             ${record.VENDOR_NAME.trim()},
//             ${record.INVOICE_NO.trim()},
//             ${record.TYPE.trim()},
//             ${record.PRODUCT_CODE.trim()},
//             ${record.PRODUCT_NAMELONG.trim()},
//             ${record.COSTPRICE},
//             ${record.UNITPRICE},
//             ${record.CUR_STOCK},
//             ${record.PHY_STOCK},
//             ${username},
//             ${remarks}
//           )
//         `;
//       }
//       else if (type === "TOG") {
//         await insertRequest.query`
//           INSERT INTO [RT_WEB].dbo.tb_TOG 
//             (DOCUMENT_NO, COMPANY_CODE, COMPANY_TO_CODE, TYPE, 
//              PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, 
//              CUR_STOCK, PHY_STOCK, REMARKS, REPUSER)
//           VALUES (
//             ${documentNo},
//             ${record.COMPANY_CODE.trim()},
//             ${record.COMPANY_TO_CODE.trim()},
//             ${record.TYPE.trim()},
//             ${record.PRODUCT_CODE.trim()},
//             ${record.PRODUCT_NAMELONG.trim()},
//             ${record.COSTPRICE},
//             ${record.UNITPRICE},
//             ${record.CUR_STOCK},
//             ${record.PHY_STOCK},
//             ${remarks},
//             ${username}
//           )
//         `;
//       }
//     }

//     // Step 7: Delete temp data
//     let request4 = new mssql.Request(transaction);  // Separate request object for the deletion queries
//     if (type === "GRN") {
//       await request4.query`
//         DELETE FROM [RT_WEB].dbo.tb_GRN_TEMP 
//         WHERE REPUSER = ${username} AND COMPANY_CODE = ${company}
//       `;
//     } else if (type === "PRN") {
//       await request4.query`
//         DELETE FROM [RT_WEB].dbo.tb_PRN_TEMP 
//         WHERE REPUSER = ${username} AND COMPANY_CODE = ${company}
//       `;
//     }
//     else if (type === "TOG") {
//       await request4.query`
//         DELETE FROM [RT_WEB].dbo.tb_TOG_TEMP 
//         WHERE REPUSER = ${username} AND COMPANY_CODE = ${company}
//       `;
//     }

//     // Step 8: Commit transaction
//     await transaction.commit();

//     // Step 9: Send response
//     res.status(200).json({
//       success: true,
//       message: "Data moved successfully"
//     });

//   } catch (error) {
//     console.error("Error in finalGrnPrnUpdate:", error.message);
//     if (transaction && !transaction._aborted) {
//       await transaction.rollback();
//     }
//     res.status(500).json({
//       success: false,
//       message: "Unexpected error occurred",
//       error: error.message,
//     });
//   }
// };

// //temp tog table
// exports.updateTempTogTable = async (req, res) => {
//   console.log(req.body);
//   let username;
//   try {
//     // Get the authorization header from the request
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
//     jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//       if (err) {
//         return res.status(403).json({ message: "Invalid or expired token" });
//       }
//       username = decoded.username; // Assuming 'username' is part of the token payload
//     });
    
//     const {company,companyCodeTo,type,productCode,productName,costPrice,scalePrice,stock,quantity} = req.body;

//       const insertQuery = `
//       USE [RT_WEB]
//         INSERT INTO tb_TOG_TEMP 
//         (COMPANY_CODE, COMPANY_TO_CODE, TYPE, PRODUCT_CODE, PRODUCT_NAMELONG, COSTPRICE, UNITPRICE, CUR_STOCK, PHY_STOCK, REPUSER)
//         VALUES (@company, @companyCodeTo, @type, @productCode, @productName, @costPrice, @scalePrice, @stock, @quantity, @username)
//       `;


//     const insertRequest = new mssql.Request();
//     insertRequest.input("company", mssql.NChar(10), company);
//     insertRequest.input("companyCodeTo", mssql.NChar(10), companyCodeTo);
//     insertRequest.input("type", mssql.NChar(10), type);
//     insertRequest.input("productCode", mssql.NChar(30), productCode);
//     insertRequest.input("productName", mssql.NChar(50), productName);
//     insertRequest.input("costPrice", mssql.Money, costPrice);
//     insertRequest.input("scalePrice", mssql.Money, scalePrice);
//     insertRequest.input("stock", mssql.Float, stock);
//     insertRequest.input("quantity", mssql.Float, quantity);
//     insertRequest.input("username", mssql.NChar(10), username);

//     // Execute Query
//     await insertRequest.query(insertQuery);
//     res.status(201).json({ message: "Table Updated successfully" });
//   } catch (error) {
//     console.error("Error processing parameters:", error);
//     res.status(500).json({ message: "Failed to update table" });
//   }
// };

// // Get user connection details
// exports.findUserConnection = async (req, res) => {
//   const name = req.query.nameNew;

//   try {
//     await mssql.close();
//     const dbConnection = {
//       user: process.env.DB_USER,
//       password: process.env.DB_PASSWORD,
//       server: process.env.DB_SERVER,
//       database: process.env.DB_DATABASE1,
//       options: {
//         encrypt: false,
//         trustServerCertificate: true,
//       },
//       port: 1443,
//     };

//     await mssql.connect(dbConnection);

//     const userPermissionResult = await mssql.query`
//     USE [RTPOS_MAIN]
//       USE [RTPOS_MAIN]
//       SELECT [a_permission], [a_sync], [d_company], [d_department], [d_category], [d_scategory], 
//       [d_vendor], [d_invoice], [t_scan], [t_stock], [t_grn], [t_prn], [t_sales],[t_stock_update]
//       FROM tb_USERS
//       WHERE username = ${name};
//     `;

//     if (userPermissionResult.recordset.length === 0) {
//       console.log("no results found");
//       return res.status(404).json({ message: "User details not found" });
//     }
//     const userData = userPermissionResult.recordset;

//     res.status(200).json({
//       message: "User permission data retrieved successfully",
//       userData: userData ? userData : [],
//     });
//   } catch (error) {
//     console.error("Error retrieving user permission data:", error);
//     res.status(500).json({ message: "Failed to retrieve dashboard data" });
//   }
// };
