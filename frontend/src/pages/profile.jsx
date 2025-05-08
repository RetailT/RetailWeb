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
      <div className="flex justify-center items-center mt-10 sm:mt-16">
  <div className="flex-1 p-10 flex flex-col items-center">

    {alert && (
      <Alert
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert(null)}
      />
    )}

    <div className="p-10 w-full max-w-lg ">
    <div className="mb-10 text-center  ">
  <p className=" mb-2 text-2xl font-bold text-[#c84f19]">Welcome to </p>
  <p className="italic text-3xl font-bold text-[#c84f19]">Retail Target Software Solutions</p>
</div>


      {details && (
        <div className="flex justify-center">
          <div className="p-8 rounded-xl shadow-lg bg-white text-black text-lg w-full max-w-md">
            <h2 className="text-center text-2xl font-bold mb-6 text-gray-800">
              User Profile
            </h2>
            <div className="space-y-4 text-center">
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
    </div>
  </div>
</div>

    </div>
  );
};

export default Profile;
