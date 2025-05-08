import { useState } from "react";
import { motion } from "framer-motion";
import { IoIosArrowDropleftCircle, IoIosArrowDroprightCircle } from "react-icons/io";

export default function PanelMenu({ items }) {
  const [isOpen, setIsOpen] = useState(false);
  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={togglePanel}
        className="fixed top-70 right-5 z-50 p-2 rounded-full bg-black text-white hover:bg-gray-800"
      >
        {isOpen ? <IoIosArrowDroprightCircle size={24} /> : <IoIosArrowDropleftCircle size={24} />}
      </button>

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: isOpen ? 0 : "100%" }}
        transition={{ type: "tween", duration: 0.3 }}
        className="fixed top-50 bottom-10 mt-20 right-0 w-80 bg-gray-100 shadow-2xl p-5 z-40 flex flex-col space-y-4 border-l"
      >
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">{items}</div>
      </motion.div>
    </div>
  );
}
