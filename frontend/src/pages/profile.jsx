import React, { useEffect, useState, useContext } from "react";
import Navbar from "../components/NavBar";
import Sidebar from "../components/SideBar";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import Alert from "../components/Alert";
import { jwtDecode } from "jwt-decode";

const Profile = () => {
  const { authToken } = useContext(AuthContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    // Retrieve token and decode it
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);

        // Set user details
        setDetails({
          username: decodedToken.username || "Unknown",
          email: decodedToken.email || "Not Provided",
        });
      } catch (error) {
        console.error("Error decoding token:", error.message);
        setAlert({ message: "Invalid token", type: "error" });
      }
    } else {
      console.error("No token found in localStorage");
    }
  }, []);

  // Redirect to login if the user is not authenticated
  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const handleSidebarToggle = (isOpen) => {
    setIsSidebarOpen(isOpen);
  };

  return (
    <div>
      <Navbar />
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-orange-50 to-white px-4 mt-8">
  <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-8 sm:p-14 transition-all duration-500 ease-in-out hover:shadow-orange-200">
    {/* Alert */}
    {alert && (
      <div className="mb-6">
        <Alert
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert(null)}
        />
      </div>
    )}

    {/* Header */}
    <div className="text-center mb-10">
      <h1 className="text-3xl sm:text-4xl font-bold text-orange-600">Welcome to</h1>
      <p className="text-2xl sm:text-3xl font-bold text-orange-700 mt-2">Retail Target Software Solutions</p>
    </div>

    {/* Profile Card */}
    {details && (
      <div className="flex justify-center">
        <div className="p-8 bg-orange-50 rounded-xl shadow-md w-full max-w-md transition transform hover:scale-105">
          <h2 className="text-center text-2xl font-bold mb-6 text-gray-800">User Profile</h2>
          <div className="space-y-4 text-center text-gray-700">
            <p>
              <strong>Username:</strong> {details.username}
            </p>
            <p>
              <strong>Email:</strong> {details.email}
            </p>
          </div>
        </div>
      </div>
    )}

    {/* Company Info */}
    <div className="mt-12 text-center text-sm text-gray-500">
      <p>Retail Target Software Solutions Pvt Ltd</p>
      <p>No.375/1/1B, Galle road, Pallimankada, Wadduwa</p>
      <p>No.2A, Elliot road, Galle</p>
      <p>Tel: +94 763 165 700 | +94 777 121 757</p>
      <p>Email: retailtarget@gmail.com</p>
      <p>Website: www.retailtarget.lk</p>
    </div>
  </div>
</div>


    </div>
  );
};

export default Profile;
