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
  const [nameNew, setNameNew] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("");
  const [customerID, setCustomerID] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameErrorNew, setNameErrorNew] = useState("");
  const [disable, setDisable] = useState(false);
  const [disableNew, setDisableNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState([]);
  const [selectedStock, setSelectedStock] = useState([]);
  const [removeAdmin, setRemoveAdmin] = useState([]);
  const [removeDashboard, setRemoveDashboard] = useState([]);
  const [removeStock, setRemoveStock] = useState([]);
  const [alert, setAlert] = useState(null);
  const [data, setData] = useState([]);

  const token = localStorage.getItem("authToken");
  const navigate = useNavigate();
  let username;

 
  const [Admin, setAdmin] = useState([]);
  const [Dashboard, setDashboard] = useState([]);
  const [Transaction, setTransaction] = useState([]);



  const adminPermissionOptions = [
    { value: "a_permission", label: "Permission Setting" },
    { value: "a_sync", label: "Databases Synchronization" },
  ];

  const dashboardPermissionOptions = [
    { value: "d_company", label: "Company Wise Dashboard" },
    { value: "d_department", label: "Department Wise Dashboard" },
    { value: "d_category", label: "Category Wise Dashboard" },
    { value: "d_scategory", label: "Sub Category Wise Dashboard" },
    { value: "d_vendor", label: "Vendor Wise Dashboard" },
    { value: "d_invoice", label: "Invoice Wise Reports" },
  ];

  const stockUpdatePermissionOptions = [
    { value: "t_scan", label: "Scan" },
    { value: "t_stock", label: "Stock" },
    { value: "t_grn", label: "GRN" },
    { value: "t_prn", label: "PRN" },
    { value: "t_tog", label: "TOG" },
    { value: "t_stock_update", label: "Stock Update" },
  ];

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  if (token) {
    const decodedToken = jwtDecode(token);
    username = decodedToken.username;
  }

  // Handlers for each dropdown
  const handleAdminSelect = (value) => {
    setSelectedAdmin((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const handleDashboardSelect = (value) => {
    setSelectedDashboard((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const handleStockSelect = (value) => {
    setSelectedStock((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const handleRemoveAdmin = (value) => {
    setRemoveAdmin((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };
  const handleRemoveDashboard = (value) => {
    setRemoveDashboard((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const handleRemoveStock = (value) => {
    setRemoveStock((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

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
        admin: selectedAdmin,
        dashboard: selectedDashboard,
        stock: selectedStock,
        removeAdmin: removeAdmin,
        removeStock: removeStock,
        removeDashboard: removeDashboard,
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

  // Dropdown UI Component
  const MultiSelectDropdown = ({
    options,
    selectedValues,
    handleSelect,
    label,
  }) => (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <Listbox value={selectedValues} onChange={() => {}}>
        <div className="relative">
          <Listbox.Button className="w-full border border-gray-300 p-2 rounded-md bg-white text-left flex justify-between items-center">
            <span>
              {selectedValues.length > 0
                ? `${selectedValues.length} selected`
                : "Select permissions"}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg border border-gray-200 focus:outline-none text-sm">
              {options.map((option) => (
                <Listbox.Option key={option.value} as={Fragment}>
                  {({ active }) => (
                    <li
                      onClick={() => handleSelect(option.value)}
                      className={`cursor-pointer select-none relative flex items-center gap-2 px-4 py-2 ${
                        active ? "bg-gray-100" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(option.value)}
                        readOnly
                      />
                      <span>{option.label}</span>
                      {selectedValues.includes(option.value) && (
                        <Check className="h-4 w-4 text-green-500 ml-auto" />
                      )}
                    </li>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );

  function userPermisionDetails(data) {
    const customLabels = {
      a_permission: "Permission Setting",
      a_sync: "Databases Synchronization",
      d_category: "Category Wise Dashboard",
      d_company: "Company Wise Dashboard",
      d_department: "Department Wise Dashboard",
      d_invoice: "Invoice Wise Report",
      d_scategory: "Subcategory Wise Dashboard",
      d_vendor: "Vendor Wise Dashboard",
      t_scan: "Scan",
      t_stock: "Stock Update",
    };

    for (const [key, value] of Object.entries(data)) {
      if (value.toUpperCase() === "T") {
        // Use custom labels for categorization
        const label = customLabels[key] || key;

        if (key.startsWith("a_")) {
          Admin.push(label);
        } else if (key.startsWith("d_")) {
          Dashboard.push(label);
        } else if (key.startsWith("t_")) {
          Transaction.push(label);
        }
      }
    }

  }

  const handleButtonClick = (e) => {
    e.preventDefault();
    setNameErrorNew("");
    let isValid = true;
    setDisableNew(true);
    setLoading(true);

    if (!nameNew) {
      setNameErrorNew("Username is required.");
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
          nameNew, // pass the parameter here instead of in the body
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
            setData(user);
            userPermisionDetails(user);
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

  const sidePanel = () => {
    return (
      <div className="mt-10">
        <div>
          <label
            htmlFor="nameNew"
            className="block text-sm font-medium text-gray-700"
          >
            Username
          </label>
          <input
            type="text"
            id="nameNew"
            value={nameNew}
            onChange={(e) => setNameNew(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700"
            placeholder="Enter Username"
          />
          {nameErrorNew && (
            <p className="text-red-500 text-sm mt-1">{nameErrorNew}</p>
          )}
        </div>

        <button
          onClick={handleButtonClick}
          disabled={disableNew}
          className={`bg-black text-white px-4 py-2 rounded-md shadow-md hover:bg-gray-800 mt-6 mx-auto block ${
            disableNew ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Find User
        </button>

        {loading && (
          <div className="mt-10 flex justify-center items-center">
            <FadeLoader
              cssOverride={null}
              height={50}
              loading
              margin={30}
              radius={30}
              speedMultiplier={1}
              width={8}
              color="#ce521a"
            />
          </div>
        )}

        {!loading && data.length !== 0 && (
  <div className="mb-5 mt-5">
    <div className="space-y-2">
    <div className="border-t pt-2">
  <p className="font-medium text-[#bc4a17] mb-3">
    Dashboard Permission Available
  </p>

      
  {Dashboard.length > 0 ? (
    Dashboard.map((item, index) => (
      <p key={index} className="text-gray-700">
        <strong>{item}</strong>
      </p>
    ))
  ) : (
    <p>No dashboard permissions available</p>
  )}
</div>

      <div className="border-t pt-2">
        <p className="font-medium text-[#bc4a17] mb-3">
          Transaction Permission Available
        </p>
        {Transaction.length > 0 ? (
          Transaction.map((item, index) => (
            <p key={index} className="text-gray-700">
              <strong>{item}</strong>
            </p>
          ))
        ) : (
          <p>No transaction permissions available</p>
        )}
      </div>
      <div className="border-t pt-2">
        <p className="font-medium text-[#bc4a17] mb-3">
          Administration Permission Available
        </p>
        {Admin.length > 0 ? (
          Admin.map((item, index) => (
            <p key={index} className="text-gray-700">
              <strong>{item}</strong>
            </p>
          ))
        ) : (
          <p>No admin permissions available</p>
        )}
      </div>
    </div>
  </div>
)}

      </div>
    );
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
    <PanelMenu items={sidePanel()} />
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Grid Layout for Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
        {/* Username */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-md text-gray-700"
            placeholder="Enter Username"
          />
          {nameError && <p className="text-red-500 text-sm mt-1">{nameError}</p>}
        </div>

        {/* IP Address */}
        <div>
          <label htmlFor="ip" className="block text-sm font-medium text-gray-700">
            IP Address
          </label>
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
        <div>
          <label htmlFor="port" className="block text-sm font-medium text-gray-700">
            Port
          </label>
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
          <label htmlFor="customerID" className="block text-sm font-medium text-gray-700">
            Customer ID
          </label>
          <input
            type="number"
            id="customerID"
            value={customerID}
            onChange={(e) => setCustomerID(e.target.value)}
            className="mt-1 block w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-md text-gray-700"
            placeholder="Enter Customer ID"
          />
        </div>

        {/* Admin Permissions */}
        <MultiSelectDropdown
          options={adminPermissionOptions}
          selectedValues={selectedAdmin}
          handleSelect={handleAdminSelect}
          label="Set Admin"
        />

        {/* Dashboard Permissions */}
        <MultiSelectDropdown
          options={dashboardPermissionOptions}
          selectedValues={selectedDashboard}
          handleSelect={handleDashboardSelect}
          label="Set Dashboard"
        />

        {/* Stock Update Permissions */}
        <MultiSelectDropdown
          options={stockUpdatePermissionOptions}
          selectedValues={selectedStock}
          handleSelect={handleStockSelect}
          label="Set Stock Update"
        />

        {/* Placeholder for spacing */}
        <div></div>

        {/* Remove Admin Permissions */}
        <MultiSelectDropdown
          options={adminPermissionOptions}
          selectedValues={removeAdmin}
          handleSelect={handleRemoveAdmin}
          label="Remove Admin"
        />

        {/* Remove Dashboard Permissions */}
        <MultiSelectDropdown
          options={dashboardPermissionOptions}
          selectedValues={removeDashboard}
          handleSelect={handleRemoveDashboard}
          label="Remove Dashboard"
        />

        {/* Remove Stock Update Permissions */}
        <MultiSelectDropdown
          options={stockUpdatePermissionOptions}
          selectedValues={removeStock}
          handleSelect={handleRemoveStock}
          label="Remove Stock Update"
        />
      </div>

      {/* Reset Button */}
      <div className="flex justify-center">
        <button
          type="submit"
          disabled={disable}
          className={`w-1/3 px-4 py-3 bg-black text-white font-semibold rounded-md hover:bg-gray-800 ${
            disable ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Reset
        </button>
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
