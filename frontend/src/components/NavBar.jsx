import React, { useEffect, useState, useContext } from "react";
import RTLogo from "../assets/images/rt.png";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../AuthContext";
import { jwtDecode } from "jwt-decode";
import { FaBars, FaTimes } from "react-icons/fa";
import Sidebar from "./SideBar";

const Navbar = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [username, setUsername] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setUsername(decodedToken.username);
      } catch (error) {
        console.error("Error decoding token:", error.message);
      }
    } else {
      console.error("No token found in localStorage");
    }
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem("authToken");
    logout();
    console.log("User logged out.");
    const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}close-connection`, { username });

    if (res.data.message === "Connection Closed successfully") {
      navigate("/login", { replace: true });
    } else {
      console.log("Connection closing failed");
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <>
      {/* Navbar */}
      <nav className="bg-black h-[60px] p-4 flex justify-between items-center shadow fixed w-full top-0 left-0 z-50">
        {/* Sidebar Toggle Button */}
        <button onClick={toggleSidebar} className="text-white ml-3 focus:outline-none">
          {sidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
        </button>

        {/* Logo */}
        <div className="flex items-center">
          <img src={RTLogo} alt="Logo" className=" w-16 md:w-24 h-auto ml-5" />
        </div>

        {/* Navigation Links */}
        <div className="flex items-center ml-auto mr-1 md:mr-5 space-x-4">
          {/* Profile Link */}
          <Link to="/profile" className="text-[#f17e21] font-semibold transition-colors duration-300 hover:text-white">
            {username}
          </Link>

          {/* Home Link */}
          <Link to="/" className="text-[#f17e21] font-semibold transition-colors duration-300 hover:text-white">
            Home
          </Link>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-[#f17e21] text-black font-semibold rounded-md hover:bg-[#efa05f]"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Sidebar Component */}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
    </>
  );
};

export default Navbar;
