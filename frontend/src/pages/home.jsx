import React from "react";
import { useNavigate } from "react-router-dom";
import img1 from "../assets/images/img6.jpeg";
import img4 from "../assets/images/img4.png";
import img5 from "../assets/images/img5.jpg";
import img2 from "../assets/images/img7.jpeg";
import logo2 from "../assets/images/logo.png";
import logo1 from "../assets/images/rt.png";
import { FaFacebookSquare } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { FaPhoneAlt } from "react-icons/fa";
import { IoChatbox } from "react-icons/io5";
import { motion } from "framer-motion";
import { IoLogoWhatsapp } from "react-icons/io5";

const Home = () => {
  const navigate = useNavigate();

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  const imageVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: (customDelay) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: "easeOut", delay: customDelay },
    }),
  };

  return (
    <motion.div
      className="min-h-screen bg-black text-white flex flex-col items-center p-8"
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
    >
      {/* Logo Section */}
      <motion.div className="w-full flex flex-row sm:flex-row justify-start items-center py-4 px-8">
        <img className="w-28 h-15 sm:w-40 sm:h-18" src={logo1} alt="logo" />
        <img
          className="w-28 h-12 sm:w-40 sm:h-18 sm:ml-5 ml-3"
          src={logo2}
          alt="logo"
        />
      </motion.div>

      {/* Content Section */}
      <motion.div
        className="flex flex-col md:flex-row w-full max-w-6xl"
        variants={{
          hidden: { opacity: 0, scale: 0.95 },
          visible: {
            opacity: 1,
            scale: 1,
            transition: { delay: 0.2, duration: 0.6 },
          },
        }}
      >
        {/* Left Content */}
        <div className="w-full md:w-1/2 flex flex-col justify-start p-3 mt-10">
          <h2 className="text-2xl font-bold text-white">
            Need to Digitalize Your Business?
          </h2>
          <p className="text-white mt-4">
            Retail Target Software Solutions (Pvt) Ltd. has been revolutionizing
            business software for over 15 years, empowering 800+ organizations
            with customized, reliable, and cutting-edge solutions.
          </p>

          <div className="text-xl font-bold mt-6">Why Choose Our Software?</div>
          <div className="mt-1 text-sm">
            <p>
              Our software offers seamless maintenance, advanced security, and
              reliable support, keeping your business up-to-date. Enjoy flexible
              pricing, smart inventory management, easy integration with tools
              like scales and card machines, custom reports, and real-time sales
              tracking. Trusted in Sri Lanka, it boosts efficiency and growth
              for businesses of all sizes.
            </p>
          </div>

          <button
            className="mt-6 px-6 py-3 bg-[#ce521a] text-black font-bold font-semibold rounded-lg hover:bg-orange-600 transition"
            onClick={() => navigate("/login")}
          >
            GET STARTED TODAY
          </button>

          {/* Social Links */}
          <div className="flex space-x-10 justify-center mt-10 text-white">
            <a
              href="https://www.facebook.com/share/15xcMwvrPC/?mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaFacebookSquare className="text-3xl hover:text-blue-500 transition" />
            </a>
            <a href="mailto:retailtarget@gmail.com">
              <MdEmail className="text-3xl hover:text-red-400 transition" />
            </a>
            <a href="tel:+94777108255">
              <FaPhoneAlt className="text-2xl hover:text-green-500 transition" />
            </a>
            <a href="sms:+94777121757 ">
              <IoChatbox className="text-3xl hover:text-yellow-400 transition" />
            </a>
            <a href="https://wa.me/94777121757">
              <IoLogoWhatsapp className="text-3xl hover:text-green-400 transition" />
            </a>
          </div>
        </div>

        {/* Image Gallery */}
        <motion.div
          className="w-full md:w-1/2 grid grid-cols-3 gap-4 p-8"
          initial="hidden"
          animate="visible"
        >
          <motion.img
            custom={0.2}
            variants={imageVariants}
            className="w-full h-60 object-cover col-span-2 rounded-md"
            src={img1}
            alt="img1"
          />
          <motion.img
            custom={0.4}
            variants={imageVariants}
            className="w-full h-48 object-cover col-span-1 mt-12 rounded-md"
            src={img2}
            alt="img2"
          />
          <motion.img
            custom={0.6}
            variants={imageVariants}
            className="w-full h-48 object-cover col-span-1 rounded-md"
            src={img5}
            alt="img5"
          />
          <motion.img
            custom={0.8}
            variants={imageVariants}
            className="w-full h-60 object-cover col-span-2 rounded-md"
            src={img4}
            alt="img4"
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default Home;
