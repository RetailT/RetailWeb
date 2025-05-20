import React, { useState, useContext, Fragment } from "react";
import Navbar from "../components/NavBar";
import Sidebar from "../components/SideBar";
import Heading from "../components/Heading";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import Alert from "../components/Alert";
import PanelMenu from "../components/PanelMenu";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { Listbox, Transition } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import { FadeLoader } from "react-spinners";

const Reset = () => {
  const { authToken } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("");
  const [customerID, setCustomerID] = useState("");
  const [nameError, setNameError] = useState("");
  const [disable, setDisable] = useState(false);
  const [disableNew, setDisableNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [permissionSetting, setPermissionSetting] = useState(false);
  const [databaseSync, setDatabaseSync] = useState(false);
  const [company, setCompany] = useState(false);
  const [category, setCategory] = useState(false);
  const [department, setDepartment] = useState(false);
  const [subCategory, setSubCategory] = useState(false);
  const [vendor, setVendor] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const [scan, setScan] = useState(false);
  const [stock, setStock] = useState(false);
  const [stockUpdate, setStockUpdate] = useState(false);
  const [grn, setGRN] = useState(false);
  const [prn, setPRN] = useState(false);
  const [tog, setTOG] = useState(false);

  const token = localStorage.getItem("authToken");
  const navigate = useNavigate();
  let username;


  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  if (token) {
    const decodedToken = jwtDecode(token);
    username = decodedToken.username;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setNameError("");
    let isValid = true;
    setDisable(true);

    if (!name) {
      setNameError("Username is required.");
      isValid = false;
      setDisable(false);
    }

    if (isValid) {
      const data = {
        name,
        ip,
        port,
        username,
        customerID,
        admin: [{ a_permission: permissionSetting, a_sync: databaseSync }],
        dashboard: [{d_company: company, d_category:category, d_department:department, d_scategory:subCategory, d_vendor:vendor, d_invoice:invoice}],
        stock: [{t_scan:scan, t_stock:stock, t_stock_update:stockUpdate, t_grn:grn, t_prn:prn, t_tog:tog}]
      };

      const config1 = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        params: {
          debug: true,
        },
      };
      
      axios
        .put(`${process.env.REACT_APP_BACKEND_URL}reset-database-connection`, data, config1)
        .then((response) => {
          
          setDisable(false);
          if (
            response.data.message === "Database connection updated successfully"
          ) {
            setAlert({
              message: "Database connection successful!",
              type: "success",
            });

            setTimeout(() => {
              setAlert(null);
              navigate("/login");
            }, 1000);
          } else {
            setAlert({ message: response.data.message, type: "error" });
            setTimeout(() => setAlert(null), 3000);
          }
        })
        .catch((error) => {
          
          setDisable(false);
          const errorMessage =
            error.response?.data?.message ||
            "Connection failed. Please try again.";
          setAlert({ message: errorMessage, type: "error" });
          setTimeout(() => setAlert(null), 3000);
        });
    }
  };


  const handleButtonClick = (e) => {
    e.preventDefault();
    setNameError("");
    let isValid = true;
    setDisableNew(true);
    setLoading(true);

    if (!name) {
      setNameError("Username is required.");
      isValid = false;
      setDisableNew(false);
      setLoading(false);
    }

    if (isValid) {
      const config1 = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        params: {
          name, // pass the parameter here instead of in the body
          debug: true,
        },
      };

      axios
        .get(`${process.env.REACT_APP_BACKEND_URL}find-user-connection`, config1)
        .then((response) => {
          setDisableNew(false);
          setLoading(false);
          if (
            response.data.message ===
            "User permission data retrieved successfully"
          ) {
            setAlert({
              message: "User permission data retrieved successfully!",
              type: "success",
            });
          
            setTimeout(() => {
              setAlert(null);
            }, 1000);
          
            const user = response.data.userData[0];
            
            setPermissionSetting(user.a_permission === 'T');
            setDatabaseSync(user.a_sync === 'T');
            setCompany(user.d_company === 'T');
            setCategory(user.d_category === 'T');
            setDepartment(user.d_department === 'T');
            setSubCategory(user.d_scategory === 'T');
            setVendor(user.d_vendor === 'T');
            setInvoice(user.d_invoice === 'T');
            setScan(user.t_scan === 'T');
            setStock(user.t_stock === 'T');
            setStockUpdate(user.t_stock_update === 'T');
            setGRN(user.t_grn === 'T');
            setPRN(user.t_prn === 'T');
            setTOG(user.t_tog === 'T');

            // setData(user);
            // userPermisionDetails(user);
          } else {
            setAlert({ message: response.data.message, type: "error" });
            setTimeout(() => setAlert(null), 3000);
          }
          
        })
        .catch((error) => {
          setDisableNew(false);
          setLoading(false);
          const errorMessage =
            error.response?.data?.message ||
            "Connection failed. Please try again.";
          setAlert({ message: errorMessage, type: "error" });
          setTimeout(() => setAlert(null), 3000);
        });
    }
  };

  return (
    <div>
      <Navbar />
      <div className="flex">
        <div className="flex-1 p-10 ml-12">
          <div className="mt-20 mb-10 ml-[-50px]">
            <Heading text="Permission Setting" />
          </div>

          <div className="ml-[-50px]">
            {alert && (
              <Alert
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert(null)}
              />
            )}
          </div>

          <div className="flex justify-center mt-10 ml-[-50px] md:ml-0">
  <div className="w-full max-w-7xl px-4 md:px-8">
    {/* <PanelMenu items={sidePanel()} /> */}
    <form className="space-y-6" onSubmit={handleSubmit}>
     
     <div className="bg-white p-6 rounded-md shadow-md flex flex-col lg:flex-row lg:justify-between items-center gap-4">
  {/* Username Field */}
  <div className="flex flex-col w-full lg:w-auto">
    <label htmlFor="name" className="text-sm font-medium text-gray-700">
      Username
    </label>
    <input
      type="text"
      id="name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      className="mt-1 w-full lg:w-64 px-4 py-3 bg-gray-100 border border-gray-300 rounded-md text-gray-700"
      placeholder="Enter Username"
    />
    {nameError && <p className="text-red-500 text-sm mt-1">{nameError}</p>}
  </div>

  {/* Buttons Container */}
  <div className="flex flex-col md:flex-row gap-4 w-full justify-center items-center">
  {/* Find User Button */}
  <button
    onClick={handleButtonClick}
    disabled={disableNew}
    className={`px-4 py-3 w-full md:w-1/3 bg-black text-white font-semibold rounded-md shadow-md hover:bg-gray-800 ${
      disableNew ? "opacity-50 cursor-not-allowed" : ""
    }`}
  >
    Find User
  </button>

  {/* Reset Button */}
  <button
    type="submit"
    disabled={disable}
    className={`px-4 py-3 w-full md:w-1/3 bg-black text-white font-semibold rounded-md hover:bg-gray-800 ${
      disable ? "opacity-50 cursor-not-allowed" : ""
    }`}
  >
    Reset
  </button>
</div>

</div>

<div className="flex flex-col md:flex-row flex-wrap gap-4">
  {/* Card 1 */}
  <div className="bg-white p-6 rounded-md shadow-md w-full md:w-[calc(25%-1rem)]">
    <h2 className="text-lg font-semibold text-gray-800 mb-4">Connection</h2>

    {/* IP Address */}
    <div className="mb-4">
      <label htmlFor="ip" className="block text-sm font-medium text-gray-700">IP Address</label>
      <input
        type="text"
        id="ip"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
        className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-md text-gray-700"
        placeholder="Enter IP Address"
      />
    </div>

    {/* Port */}
    <div className="mb-4">
      <label htmlFor="port" className="block text-sm font-medium text-gray-700">Port</label>
      <input
        type="text"
        id="port"
        value={port}
        onChange={(e) => setPort(e.target.value)}
        className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-md text-gray-700"
        placeholder="Enter Port"
      />
    </div>

    {/* Customer ID */}
    <div>
      <label htmlFor="customerID" className="block text-sm font-medium text-gray-700">Customer ID</label>
      <input
        type="number"
        id="customerID"
        value={customerID}
        onChange={(e) => setCustomerID(e.target.value)}
        className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-md text-gray-700"
        placeholder="Enter Customer ID"
      />
    </div>
  </div>

  {/* Card 2 */}
  <div className="bg-white p-6 rounded-md shadow-md w-full md:w-[calc(25%-1rem)]">
    <h2 className="text-lg font-semibold text-gray-800 mb-4">Dashboard</h2>
    <div className="flex flex-col gap-4">
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={company}
          onChange={(e) => setCompany(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Company</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={department}
          onChange={(e) => setDepartment(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Department</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={category}
          onChange={(e) => setCategory(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Category</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={subCategory}
          onChange={(e) => setSubCategory(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Sub Category</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={vendor}
          onChange={(e) => setVendor(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Vendor</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={invoice}
          onChange={(e) => setInvoice(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Invoice</span>
      </label>
    </div>
  </div>

  {/* Card 3 */}
  <div className="bg-white p-6 rounded-md shadow-md w-full md:w-[calc(25%-1rem)]">
    <h2 className="text-lg font-semibold text-gray-800 mb-4">Transaction</h2>
    <div className="flex flex-col gap-4">
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={scan}
          onChange={(e) => setScan(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Scan</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={stock}
          onChange={(e) => setStock(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Stock</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={grn}
          onChange={(e) => setGRN(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">GRN</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={prn}
          onChange={(e) => setPRN(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">PRN</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={tog}
          onChange={(e) => setTOG(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">TOG</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={stockUpdate}
          onChange={(e) => setStockUpdate(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Stock Update</span>
      </label>
    </div>
  </div>

  {/* Card 4 */}
  <div className="bg-white p-6 rounded-md shadow-md w-full md:w-[calc(25%-1rem)]">
    <h2 className="text-lg font-semibold text-gray-800 mb-4">Administration</h2>
    <div className="flex flex-col gap-4">
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={permissionSetting}
          onChange={(e) => setPermissionSetting(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Permission Setting</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={databaseSync}
          onChange={(e) => setDatabaseSync(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-gray-700">Database Sync</span>
      </label>
    </div>
  </div>
</div>


    
    </form>
  </div>
</div>


        </div>
      </div>
    </div>
  );
};

export default Reset;
