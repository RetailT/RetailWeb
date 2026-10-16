import React, { useEffect, useState, useContext, useRef } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';

// POS (80mm) text sizes: one body size for everything, bigger only for the shop name
// and the key lines (marked with the "pos-big" class). The footer (copyright + message,
// marked "pos-footer") is smaller so every footer line stays on ONE line.
// Used for printing AND for measuring the page height, so both always match.
const POS_TEXT_CSS = `
  .print-container, .print-container * { font-size: 10.5px !important; line-height: 1.25 !important; }
  .print-container h1 { font-size: 18px !important; line-height: 1.2 !important; }
  .print-container .pos-big, .print-container .pos-big * { font-size: 13px !important; }
  .print-container .pos-footer, .print-container .pos-footer * { font-size: 8.5px !important; }
  .print-container .border-4 { border-width: 2px !important; }
`;

// ---- POS page height tuning ----
// Printed receipt height = measured height * POS_PRINT_SCALE.
//   * blank space still at the bottom  -> make POS_PRINT_SCALE smaller (e.g. 0.82)
//   * receipt cut off / goes to page 2 -> make it bigger (e.g. 0.88)
const POS_PRINT_SCALE = 0.85;
// Blank space kept after the phone-number line (mm). About one line of text.
const POS_END_SPACE_MM = 5;

// Shown when the company has no footer message saved in the database
const DEFAULT_MESSAGE =
  "WE ARE HAPPY TO EXCHANGE PRODUCTS RETURNED IN\nSALEABLE CONDITION. ALONG WITH RECEIPT.";

// Max characters that fit on one footer line (80mm paper, 8.5px mono)
const FOOTER_MAX_CHARS = 46;

// Footer message -> at most 2 lines, each line stays on one line when printed.
const buildMessageLines = (msg) => {
  const raw = (msg || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (raw.length === 0) return [];
  if (raw.length <= 2 && raw.every((l) => l.length <= FOOTER_MAX_CHARS)) return raw;

  const words = raw.join(" ").replace(/\s+/g, " ").split(" ");
  const lines = [];
  let current = "";
  words.forEach((w) => {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= FOOTER_MAX_CHARS || !current) {
      current = next;
    } else {
      lines.push(current);
      current = w;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const InvoicePreview = () => {
  const { authToken } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const documentNo = searchParams.get('docNo');
  const company = searchParams.get('company');

  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Customer code + name (resolved from invoice data, or looked up from the customer list)
  const [customerInfo, setCustomerInfo] = useState({ code: "", name: "" });

  // false = A4 print (default), true = POS thermal printer (80mm). Remembered per browser.
  const [usePosPrinter, setUsePosPrinter] = useState(() => {
    try {
      return localStorage.getItem("usePosPrinter") === "1";
    } catch (e) {
      return false;
    }
  });

  const receiptRef = useRef(null);

  const handlePosToggle = (e) => {
    const checked = e.target.checked;
    setUsePosPrinter(checked);
    try {
      localStorage.setItem("usePosPrinter", checked ? "1" : "0");
    } catch (err) {}
  };

  const token = localStorage.getItem("authToken");

  // Permission is enforced by the backend (t_invoicePreview)
  const hasPermission = true;

  useEffect(() => {
    if (!authToken || !token) {
      navigate('/login');
      return;
    }

    if (!hasPermission) {
      setError("You do not have permission to view the invoice preview.");
      setLoading(false);
      return;
    }

    if (!documentNo) {
      setError("Invoice number is missing.");
      setLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        const params = { documentNo: documentNo.trim().toUpperCase() };
        if (company) {
          params.company = company.trim().toUpperCase();
        }

        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}get-invoice-preview`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params,
          }
        );

        if (response.data.success) {
          setInvoiceData(response.data.invoice);
        } else {
          setError(response.data.message || "Invoice not found.");
        }
      } catch (err) {
        const errMsg =
          err.response?.data?.message ||
          err.message ||
          "Failed to load invoice preview.";
        setError(errMsg);
        console.error("Invoice fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [documentNo, company, token, authToken, hasPermission, navigate]);

  // Resolve customer CODE + NAME.
  // 1) use whatever the invoice API returns
  // 2) if only one of them is known (or both are the same), look the customer up
  //    in the customer list so both can be printed
  useEffect(() => {
    if (!invoiceData) return;

    const code = String(
      invoiceData.customerCode ?? invoiceData.customer ?? invoiceData.CUSTOMER ?? ""
    ).trim();
    const name = String(
      invoiceData.customerName ?? invoiceData.CUSTOMER_NAME ?? ""
    ).trim();

    setCustomerInfo({ code, name });

    if (code && name && code.toUpperCase() !== name.toUpperCase()) return;

    const key = (code || name).toUpperCase();
    if (!key || !token) return;

    let cancelled = false;
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}customers`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data?.userData) ? res.data.userData : [];
        const match = list.find(
          (c) =>
            (c.CUSTOMER || "").trim().toUpperCase() === key ||
            (c.CUSTOMER_NAME || "").trim().toUpperCase() === key
        );
        if (match) {
          setCustomerInfo({
            code: (match.CUSTOMER || "").trim(),
            name: (match.CUSTOMER_NAME || "").trim(),
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [invoiceData, token]);

  // POS print: the receipt is copied into a hidden iframe that is exactly 80mm wide.
  // That is the SAME width Chrome uses for the printed page, so the layout (and the
  // measured height) is identical to what gets printed -> no blank space at the bottom.
  const printPos = async () => {
    const src = receiptRef.current;
    if (!src) return;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-10000px;top:0;width:80mm;height:2000px;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    try {
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(
        "<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0;background:#fff'></body></html>"
      );
      doc.close();

      // Copy the app's CSS (Tailwind etc.) into the iframe
      const loads = [];
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        const copy = node.cloneNode(true);
        if (copy.tagName === "LINK") {
          loads.push(
            new Promise((res) => {
              copy.onload = res;
              copy.onerror = res;
            })
          );
        }
        doc.head.appendChild(copy);
      });
      const posStyle = doc.createElement("style");
      posStyle.textContent = POS_TEXT_CSS;
      doc.head.appendChild(posStyle);

      await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2000))]);
      try {
        if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
      } catch (e) {}

      const clone = src.cloneNode(true);
      clone.querySelectorAll(".no-print, style").forEach((n) => n.remove());
      clone.style.cssText =
        "position:static;width:80mm;max-width:80mm;padding:2mm 3mm;margin:0;box-sizing:border-box;border:none;box-shadow:none;";
      doc.body.appendChild(clone);

      await new Promise((r) => setTimeout(r, 100)); // let layout settle

      // Height = from the top of the receipt to the bottom of the phone-number line
      // (".pos-end"), plus ONE line of blank space. Anything after it (buttons etc.) is ignored.
      const endEl = clone.querySelector(".pos-end");
      const topPx = clone.getBoundingClientRect().top;
      const bottomPx = endEl
        ? endEl.getBoundingClientRect().bottom
        : clone.getBoundingClientRect().bottom;
      const px = bottomPx - topPx;
      // Chrome shrinks the receipt a little when it prints it, so the printed receipt is
      // shorter than the measured one. POS_PRINT_SCALE corrects for that.
      const mm = Math.ceil(((px * 25.4) / 96) * POS_PRINT_SCALE) + POS_END_SPACE_MM;

      const pageStyle = doc.createElement("style");
      pageStyle.textContent = `
        @page { size: 80mm ${mm}mm; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      `;
      doc.head.appendChild(pageStyle);

      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error("POS print failed:", err);
    } finally {
      setTimeout(cleanup, 1500);
    }
  };

  const handlePrint = () => {
    if (usePosPrinter) {
      printPos();
    } else {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl font-mono">Loading invoice preview...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-10 rounded-xl shadow-xl text-center max-w-lg border">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoiceData) return null;

  // Calculations
  const subTotal = invoiceData.items.reduce(
    (sum, item) => sum + parseFloat(item.TOTAL || 0),
    0
  );
  const totalDiscount = invoiceData.items.reduce(
    (sum, item) => sum + parseFloat(item.DISCOUNT_AMOUNT || 0),
    0
  );
  const noOfPieces = invoiceData.items.reduce(
    (sum, item) => sum + parseFloat(item.QUANTITY || 0),
    0
  );

  // Payment split (older invoices have no payment record → treat as full credit)
  const hasPaymentRecord =
    invoiceData.cashAmount !== null &&
    invoiceData.cashAmount !== undefined &&
    invoiceData.creditAmount !== null &&
    invoiceData.creditAmount !== undefined;

  const cashAmount = hasPaymentRecord ? parseFloat(invoiceData.cashAmount) || 0 : 0;
  const creditAmount = hasPaymentRecord
    ? parseFloat(invoiceData.creditAmount) || 0
    : subTotal;

  const shopName = invoiceData.companyName?.trim() || "SHOP NAME";
  const shopAddress = (invoiceData.address || "").trim() || "";
  const shopTel = (invoiceData.phone || "").trim() || "N/A";

  // Customer: "CODE NAME"
  const { code: custCode, name: custName } = customerInfo;
  const customerLabel =
    custCode && custName && custCode.toUpperCase() !== custName.toUpperCase()
      ? `${custCode} ${custName}`
      : custCode || custName || "WALK-IN";

  // Use the message saved for the company; if there is none, use the default exchange note
  const messageLines = buildMessageLines(
    invoiceData.message?.trim() ? invoiceData.message : DEFAULT_MESSAGE
  );

  return (
    <div
      ref={receiptRef}
      className="w-full sm:w-[420px] mx-auto my-2 sm:my-4 bg-white font-mono text-xs sm:text-sm leading-tight shadow-lg border border-gray-300 print-container"
    >
      {/* Header */}
      <div className="text-center py-2 sm:py-3 px-3 sm:px-4 border-b-2 border-dashed border-black">
        <h1 className="text-xl sm:text-2xl font-bold uppercase">{shopName}</h1>
        {shopAddress && <p className="text-xs sm:text-sm mt-1">{shopAddress}</p>}
        {shopTel !== "N/A" && <p className="text-xs sm:text-sm mt-1">TEL - {shopTel}</p>}
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-1 text-xs sm:text-sm px-3 sm:px-4 py-2 border-b border-dashed border-black gap-1">
        {/* Cashier (left) + Invoice No (right) on the same line */}
        <div className="flex items-baseline justify-between gap-2 info-row">
          <span className="min-w-0 break-words">
            CASHIER: {invoiceData.cashierName || "CASHIER"}
          </span>
          <span className="whitespace-nowrap">INVOICE NO: {documentNo}</span>
        </div>
        <div className="break-words">CUSTOMER: {customerLabel}</div>
      </div>

      {/* Items */}
      <div className="border-t-2 border-b-2 border-dashed border-black py-2 px-3 sm:px-4">
        <div className="border-b border-black pb-1 mb-1 font-bold text-[10px] sm:text-xs">
          <div className="text-left">PRODUCT</div>
          <div className="grid grid-cols-4 gap-x-2">
          <div className="text-left">QTY</div>
          <div className="text-right">U/PRICE</div>
          <div className="text-right">DISC</div>
          <div className="text-right">VALUE</div>
          </div>
        </div>

        {invoiceData.items.map((item, idx) => (
          <div key={idx} className="mb-2">
            <div className="font-bold text-[10px] sm:text-xs break-words">
              {item.PRODUCT_CODE} {item.PRODUCT_NAME}
            </div>
            <div className="grid grid-cols-4 gap-x-2 text-[10px] sm:text-xs">
              <div className="text-left">
                {parseFloat(item.QUANTITY || 0).toFixed(3)}
              </div>
              <div className="text-right">
                {parseFloat(item.UNITPRICE || 0).toFixed(2)}
              </div>
              <div className="text-right">
                {parseFloat(item.DISCOUNT_AMOUNT || 0).toFixed(2)}
              </div>
              <div className="text-right font-bold">
                {parseFloat(item.TOTAL || 0).toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals + Payment */}
      <div className="px-3 sm:px-4 text-xs sm:text-sm">
        <div className="flex justify-between border-b-2 border-dashed border-black py-1 font-bold">
          <span>SUB TOTAL</span>
          <span>{subTotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between font-bold text-base sm:text-lg mt-3 pos-big">
          <span>CASH</span>
          <span>{cashAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-base sm:text-lg mt-1 pos-big">
          <span>CREDIT</span>
          <span>{creditAmount.toFixed(2)}</span>
        </div>
        <div className="border-t-2 border-dotted border-black my-2"></div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 text-xs sm:text-sm px-3 sm:px-4 mt-2">
        <div>NO OF PIECES</div>
        <div className="text-right">{noOfPieces.toFixed(3)}</div>
        <div>NO OF PRODUCTS</div>
        <div className="text-right">{invoiceData.items.length}</div>
      </div>

      {/* Date & Time (always side by side, so screen / print / measuring all match) */}
      <div className="flex flex-row justify-between text-[10px] sm:text-xs px-3 sm:px-4 mt-3 pb-2 gap-1">
        <span className="whitespace-nowrap">DATE : {new Date().toLocaleDateString('en-GB')}</span>
        <span className="whitespace-nowrap">
          END TIME :{" "}
          {new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Discount Box */}
      {totalDiscount > 0.001 && (
        <div className="text-center border-4 border-black py-2 sm:py-3 mx-4 sm:mx-8 my-3 font-bold text-base sm:text-xl pos-big">
          YOU HAVE TOTAL DISCOUNT
          <br />
          {totalDiscount.toFixed(2)}
        </div>
      )}

      {/* Footer Message (max 2 lines, each line stays on one line) */}
      <div className="text-center text-xs sm:text-sm px-1 pb-2">
        {messageLines.length > 0 && (
          <div className="leading-snug mb-3 text-[10px] sm:text-xs pos-footer">
            {messageLines.map((line, i) => (
              <div key={i} className="whitespace-nowrap">
                {line}
              </div>
            ))}
          </div>
        )}
        <p className="font-bold text-base sm:text-lg pos-big">THANK YOU COME AGAIN</p>
      </div>

      {/* Signature (smaller font + no wrapping so it stays on ONE line) */}
      <div className="text-center text-[10px] sm:text-xs px-1 border-t border-dashed border-black pt-2 pos-footer pos-end">
        <p className="font-bold whitespace-nowrap">
          © Retail Target Software Solutions (Pvt) Ltd
        </p>
        <p className="whitespace-nowrap">+94 76 3 165700 / +94 76 3 165701</p>
      </div>

      {/* Print Button */}
      <div className="text-center pb-4 sm:pb-6 no-print px-3">
        <label className="flex items-center justify-center gap-2 mb-3 text-sm sm:text-base cursor-pointer select-none">
          <input
            type="checkbox"
            checked={usePosPrinter}
            onChange={handlePosToggle}
            className="w-4 h-4 sm:w-5 sm:h-5 accent-black cursor-pointer"
          />
          <span>Print with POS printer</span>
        </label>
        <button
          onClick={handlePrint}
          className="bg-black text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl text-base sm:text-xl hover:bg-gray-800 transition shadow-md w-full sm:w-auto"
        >
          🖨️ Print Invoice
        </button>
      </div>

      {/* Print Styles: @page must be top-level (not inside @media) to take effect */}
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          .no-print {
            display: none !important;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * {
            visibility: hidden;
          }
          .print-container,
          .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            box-sizing: border-box;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 190mm !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default InvoicePreview;