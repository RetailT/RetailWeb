import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext'; // Make sure the AuthContext path is correct

const InvoicePreview = () => {
  const { authToken, userPermissions } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const documentNo = searchParams.get('docNo');
  const company = searchParams.get('company');

  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("authToken");

  // Permission check (adjust according to your permission structure)
  const hasPermission = true;


  useEffect(() => {
    // 1. Token / authentication check
    if (!authToken || !token) {
      navigate('/login');
      return;
    }

    // 2. Permission check – block access if not allowed
    if (!hasPermission) {
      setError("You do not have permission to view the invoice preview.");
      setLoading(false);
      return;
    }

    // 3. Required parameter check
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

  const handlePrint = () => {
    window.print();
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
          {/* <button
            onClick={() => navigate('/invoice')}
            className="bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition"
          >
            Go Back
          </button> */}
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

  const cashPaid = parseFloat(
    invoiceData.cashPaid ||
      invoiceData.paymentAmount ||
      invoiceData.cashAmount ||
      invoiceData.paidAmount ||
      0
  );

  const balance = cashPaid - subTotal;

  const shopName = invoiceData.companyName?.trim() || "SHOP NAME";
  const shopAddress = (invoiceData.address || "").trim() || "";
  const shopTel = (invoiceData.phone || "").trim() || "N/A";

  return (
    <div className="w-[420px] mx-auto my-4 bg-white font-mono text-sm leading-tight shadow-lg border border-gray-300 print-container">
      {/* Header */}
      <div className="text-center py-3 px-4 border-b-2 border-dashed border-black">
        <h1 className="text-2xl font-bold uppercase">{shopName}</h1>
        {shopAddress && <p className="text-sm mt-1">{shopAddress}</p>}
        {shopTel !== "N/A" && <p className="text-sm mt-1">TEL - {shopTel}</p>}
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-2 text-sm px-4 py-2 border-b border-dashed border-black">
        <div>CASHIER: {invoiceData.cashierName || "CASHIER"}</div>
        <div className="text-right">INVOICE NO : {documentNo}</div>
      </div>

      {/* Items */}
      <div className="border-t-2 border-b-2 border-dashed border-black py-2 px-4">
        <div className="grid grid-cols-5 text-xs border-b border-black pb-1 mb-1 font-bold">
          <div>PRODUCT</div>
          <div className="text-center">QTY</div>
          <div className="text-right">U/PRICE</div>
          <div className="text-right">DISC</div>
          <div className="text-right">VALUE</div>
        </div>

        {invoiceData.items.map((item, idx) => (
          <div key={idx} className="mb-2">
            <div className="font-bold">
              {item.PRODUCT_CODE} {item.PRODUCT_NAME}
            </div>
            <div className="grid grid-cols-5 text-xs">
              <div></div>
              <div className="text-center">
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

      {/* Totals */}
      <div className="px-4 text-sm">
        <div className="flex justify-between border-b-2 border-dashed border-black py-1 font-bold">
          <span>SUB TOTAL</span>
          <span>{subTotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between font-bold text-lg mt-3">
          <span>CREDIT</span>
          <span>{subTotal.toFixed(2)}</span>
        </div>
        <div className="border-t-2 border-dotted border-black my-2"></div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 text-sm px-4 mt-2">
        <div>NO OF PIECES</div>
        <div className="text-right">{noOfPieces.toFixed(3)}</div>
        <div>NO OF PRODUCTS</div>
        <div className="text-right">{invoiceData.items.length}</div>
      </div>

      {/* Date & Time */}
      <div className="flex justify-between text-xs px-4 mt-3 pb-2">
        <span>DATE : {new Date().toLocaleDateString('en-GB')}</span>
        <span>
          END TIME :{" "}
          {new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Discount Box – only show if there is actual discount */}
      {totalDiscount > 0.001 && (  // hide if = 0
        <div className="text-center border-4 border-black py-3 mx-8 my-3 font-bold text-xl">
          YOU HAVE TOTAL DISCOUNT
          <br />
          {totalDiscount.toFixed(2)}
        </div>
      )}

      {/* Footer Message */}
      <div className="text-center text-sm px-4 pb-2">
        {invoiceData.message?.trim() && (
          <div className="whitespace-pre-line leading-snug mb-3 text-xs">
            {invoiceData.message.trim()}
          </div>
        )}
        <p className="font-bold text-lg">THANK YOU COME AGAIN</p>
      </div>

      {/* Signature */}
      <div className="text-center text-xs px-4 pb-4 border-t border-dashed border-black pt-2">
        <p className="font-bold">
          © Retail Target Software Solutions (Pvt) Ltd Sri Lanka.
        </p>
        <p>+94 76 3 165700 / +94 76 3 165701</p>
      </div>

      {/* Print Button */}
      <div className="text-center pb-6 no-print">
        <button
          onClick={handlePrint}
          className="bg-black text-white px-10 py-4 rounded-xl text-xl hover:bg-gray-800 transition shadow-md"
        >
          🖨️ Print Invoice
        </button>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
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
            width: 80mm;
            padding: 8mm 6mm;
            margin: 0;
            box-shadow: none;
            border: none;
          }
          @page {
            margin: 0;
            size: 80mm auto;
          }
        }
      `}</style>
    </div>
  );
};

export default InvoicePreview;
