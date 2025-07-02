import React, { useState, useContext } from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import Alert from '../components/Alert';
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const Reset = () => {
  const { authToken } = useContext(AuthContext);
  const [isDisable, setIsDisable] = useState(false)
  const [alert, setAlert] = useState(null); // State to hold the alert message and type
  
  const token = localStorage.getItem("authToken");
  const navigate = useNavigate();
  let username;
 
  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  if (token) {
    // Split the token into its parts
    const decodedToken = jwtDecode(token);
    username = decodedToken.username;
  } else {
      console.error("No token found in localStorage");
  }

  const handleDataSubmit = async (e) => {
  setIsDisable(true);
  const token = localStorage.getItem("authToken");

  try {
    const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}sync-databases`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data?.message === "Database sync completed successfully.") {
      setAlert({
        message: "Database sync completed successfully",
        type: "success",
      });
    } else {
      setAlert({
        message: "Error syncing databases",
        type: "error",
      });
    }
  } catch (err) {
    const apiError = err.response?.data;

    if (typeof apiError?.error === "string" && apiError.error.includes("payments is not iterable")) {
      setAlert({
        message: "No payment details available for now",
        type: "error",
      });
    } else if (Array.isArray(apiError?.errors) && apiError.errors.includes("Cannot fetch user items details")) {
      setAlert({
        message: "No items available for now",
        type: "error",
      });
    } else {
      setAlert({
        message: apiError?.message || "Error syncing databases",
        type: "error",
      });
    }
  } finally {
    setTimeout(() => setAlert(null), 3000);
    setIsDisable(false);
  }
};

 
  
  return (
    <div>
      <Navbar />
      <div className="flex">
        {/* <Sidebar onToggle={handleSidebarToggle} /> */}
        <div className="flex-1 p-10 ">
          <div className="mt-24 mb-10 ml-5">
            <Heading text="Sync Databases" />
          </div>

      {/* Alert Component: Display if alert state is set */}
      <div className="ml-[-50px]">
      {alert && (
        <Alert
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert(null)} // Close alert when clicked
        />
      )}
      </div>
     
     
<div className="p-10">
    <button  onClick={handleDataSubmit}
    disabled={isDisable}
                  className={`bg-black hover:bg-gray-800 text-white font-semibold py-2 px-5 rounded-md shadow-md transition-all ${
                    isDisable ? "opacity-50 cursor-not-allowed" : ""
                  }`}>
        Sync OGF Database
    </button>
    </div>




          
        </div>
      </div>
    </div>
  );
};

export default Reset;

