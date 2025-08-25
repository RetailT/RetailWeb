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
    setTimeout(() => {
              setAlert(null);
              navigate("/login");
            }, 1000);
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
  <div className="flex flex-col min-h-screen">
    <div className="flex-1 p-2 sm:p-4 md:p-10 ml-2 sm:ml-4 md:ml-5 mr-2 sm:mr-4">
      <div className="mt-24 md:mt-17 md:mt-24 mb-2 sm:mb-4 md:mb-10 ml-2 md:ml-0">
        <Heading text="Sync Databases" />
      </div>

      {/* Alert Component: Display if alert state is set */}
      <div className="ml-2 sm:ml-4">
        {alert && (
          <Alert
            message={alert.message}
            type={alert.type}
            onClose={() => setAlert(null)} // Close alert when clicked
          />
        )}
      </div>

      <div className="p-2 sm:p-4 md:p-10 mt-10 md:mt-0">
        <button
          onClick={handleDataSubmit}
          disabled={isDisable}
          className={`bg-black hover:bg-gray-800 text-white font-semibold py-1 sm:py-2 px-2 sm:px-5 rounded-md shadow-md transition-all w-full sm:w-auto ${
            isDisable ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Sync OGF Database
        </button>
      </div>
    </div>
  </div>
</div>
  );
};

export default Reset;

