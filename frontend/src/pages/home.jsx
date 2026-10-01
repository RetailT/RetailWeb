// import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import img1 from "../assets/images/img6.jpeg";
import img4 from "../assets/images/img4.png";
import img5 from "../assets/images/img5.jpg";
import img2 from "../assets/images/img7.jpeg";
import logo2 from "../assets/images/logo.png";
import logo1 from "../assets/images/rt.png";
import { FaFacebookSquare } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { FaPhoneAlt } from "react-icons/fa";
import { IoChatbox, IoLogoWhatsapp } from "react-icons/io5";
import {
  FiArrowRight,
  FiExternalLink,
  FiShield,
  FiBox,
  FiHeadphones,
  FiTag,
  FiLink,
  FiFileText,
  FiTrendingUp,
  FiTool,
} from "react-icons/fi";

const BILL_PAYMENT_URL = "https://rtpos.retailtarget.lk/";

const features = [
  { icon: FiTool, title: "Seamless Maintenance", text: "Keeps your business software running smoothly and up-to-date." },
  { icon: FiShield, title: "Advanced Security", text: "Your business data stays protected and secure." },
  { icon: FiHeadphones, title: "Reliable Support", text: "Dependable support whenever you need it." },
  { icon: FiTag, title: "Flexible Pricing", text: "Pricing that fits businesses of all sizes." },
  { icon: FiBox, title: "Smart Inventory", text: "Smart inventory management to keep stock under control." },
  { icon: FiLink, title: "Easy Integration", text: "Works with tools like scales and card machines." },
  { icon: FiFileText, title: "Custom Reports", text: "Reports tailored to the way you run your business." },
  { icon: FiTrendingUp, title: "Real-time Sales Tracking", text: "Track your sales as they happen and grow with confidence." },
];

const EMAIL = "retailtarget@gmail.com";

// Mobile -> mailto (opens the phone's mail app)
// Desktop -> Gmail compose in a new tab (works without a default mail app)
const isMobile =
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const emailHref = isMobile
  ? `mailto:${EMAIL}`
  : `https://mail.google.com/mail/?view=cm&fs=1&to=${EMAIL}`;

const socials = [
  { href: "https://www.facebook.com/share/15xcMwvrPC/?mibextid=wwXIfr", icon: FaFacebookSquare, hover: "hover:text-blue-500", external: true, label: "Facebook" },
  { href: emailHref, icon: MdEmail, hover: "hover:text-red-400", external: !isMobile, label: "Email" },
  { href: "tel:+94777108255", icon: FaPhoneAlt, hover: "hover:text-green-500", label: "Call" },
  { href: "sms:+94777121757", icon: IoChatbox, hover: "hover:text-yellow-400", label: "SMS" },
  { href: "https://wa.me/94777121757", icon: IoLogoWhatsapp, hover: "hover:text-green-400", external: true, label: "WhatsApp" },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut", delay },
  }),
};

const imageVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.96 },
  visible: (delay) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: "easeOut", delay },
  }),
};

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-[#ce521a]/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-orange-500/10 blur-[120px]" />

      {/* Navbar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="sticky top-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <img className="h-10 w-auto sm:h-12" src={logo1} alt="Retail Target" />
            <img className="h-8 w-auto sm:h-10" src={logo2} alt="RT POS" />
          </div>

          <a
            href={BILL_PAYMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-[#ce521a] px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#ce521a]/20 transition hover:bg-orange-500 hover:shadow-orange-500/30"
          >
            Bill Payment Control Panel
            <FiExternalLink className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </motion.header>

      <main className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="grid items-center gap-12 py-14 lg:grid-cols-2 lg:py-20">
          {/* Left */}
          <div>
            <motion.span
              custom={0}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="inline-flex items-center gap-2 rounded-full border border-[#ce521a]/40 bg-[#ce521a]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-orange-300"
            >
              <span className="h-2 w-2 rounded-full bg-[#ce521a]" />
              Trusted in Sri Lanka
            </motion.span>

            <motion.h1
              custom={0.1}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl"
            >
              Need to{" "}
              <span className="bg-gradient-to-r from-[#ce521a] to-orange-300 bg-clip-text text-transparent">
                Digitalize
              </span>{" "}
              Your Business?
            </motion.h1>

            <motion.p
              custom={0.2}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="mt-5 text-base leading-relaxed text-gray-300 sm:text-lg"
            >
              Retail Target Software Solutions (Pvt) Ltd. has been
              revolutionizing business software for over 15 years, empowering
              800+ organizations with customized, reliable, and cutting-edge
              solutions.
            </motion.p>

            {/* Stats */}
            <motion.div
              custom={0.3}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="mt-8 flex gap-4"
            >
              <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur">
                <p className="text-3xl font-extrabold text-[#ce521a]">15+</p>
                <p className="text-sm text-gray-400">Years of experience</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur">
                <p className="text-3xl font-extrabold text-[#ce521a]">800+</p>
                <p className="text-sm text-gray-400">Organizations empowered</p>
              </div>
            </motion.div>

            {/* CTA */}
            <motion.button
              custom={0.4}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/login")}
              className="group mt-8 inline-flex items-center gap-3 rounded-xl bg-[#ce521a] px-7 py-4 font-bold text-black shadow-lg shadow-[#ce521a]/25 transition hover:bg-orange-500"
            >
              Are You an Existing Customer?
              <FiArrowRight className="transition group-hover:translate-x-1" />
            </motion.button>

            {/* Social Links */}
            <motion.div
              custom={0.5}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="mt-8 flex flex-wrap gap-3"
            >
              {socials.map(({ href, icon: Icon, hover, external, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:-translate-y-1 hover:border-white/30 hover:bg-white/10"
                >
                  <Icon className={`text-2xl transition ${hover}`} />
                </a>
              ))}
            </motion.div>
          </div>

          {/* Right: Image Gallery */}
          <motion.div
            className="grid grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
          >
            <motion.div custom={0.2} variants={imageVariants} className="col-span-2 overflow-hidden rounded-2xl ring-1 ring-white/10">
              <img src={img1} alt="RT POS in use" className="h-56 w-full object-cover transition duration-500 hover:scale-105 sm:h-64" />
            </motion.div>
            <motion.div custom={0.4} variants={imageVariants} className="col-span-1 overflow-hidden rounded-2xl ring-1 ring-white/10">
              <img src={img2} alt="RT POS terminal" className="h-56 w-full object-cover transition duration-500 hover:scale-105 sm:h-64" />
            </motion.div>
            <motion.div custom={0.6} variants={imageVariants} className="col-span-1 overflow-hidden rounded-2xl ring-1 ring-white/10">
              <img src={img5} alt="POS in a supermarket" className="h-56 w-full object-cover transition duration-500 hover:scale-105 sm:h-64" />
            </motion.div>
            <motion.div custom={0.8} variants={imageVariants} className="col-span-2 overflow-hidden rounded-2xl ring-1 ring-white/10">
              <img src={img4} alt="Card payment at POS" className="h-56 w-full object-cover transition duration-500 hover:scale-105 sm:h-64" />
            </motion.div>
          </motion.div>
        </section>

        {/* Why Choose */}
        <section className="pb-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              Why Choose{" "}
              <span className="bg-gradient-to-r from-[#ce521a] to-orange-300 bg-clip-text text-transparent">
                Our Software?
              </span>
            </h2>
            <p className="mt-4 text-gray-400">
              Our software offers seamless maintenance, advanced security, and
              reliable support, keeping your business up-to-date. Trusted in Sri
              Lanka, it boosts efficiency and growth for businesses of all
              sizes.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }, i) => (
              <motion.div
                key={title}
                custom={i * 0.05}
                variants={fadeInUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                whileHover={{ y: -6 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-[#ce521a]/50 hover:bg-white/10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ce521a]/15 text-2xl text-[#ce521a]">
                  <Icon />
                </div>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{text}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Retail Target Software Solutions (Pvt) Ltd.
      </footer>
    </div>
  );
};

export default Home;