import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';

const InvoicePreview = () => {
  const [searchParams] = useSearchParams();
  const documentNo = searchParams.get('docNo');
  const company = searchParams.get('company');
  
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("authToken");

  useEffect(() => {
    if (!documentNo || !company) {
      setError("Invalid invoice details");
      setLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}get-invoice-preview`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { documentNo, company }
          }
        );

        if (response.data.success) {
          setInvoiceData(response.data.invoice);
        } else {
          setError(response.data.message || "Invoice not found");
        }
      } catch (err) {
        setError("Failed to load invoice");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [documentNo, company, token]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-8 text-center font-mono">Loading invoice...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!invoiceData) return null;

  // Calculations
  const subTotal = invoiceData.items.reduce((sum, item) => sum + parseFloat(item.TOTAL || 0), 0);
  const totalDiscount = invoiceData.items.reduce((sum, item) => sum + parseFloat(item.DISCOUNT_AMOUNT || 0), 0);
  const noOfPieces = invoiceData.items.reduce((sum, item) => sum + parseFloat(item.QUANTITY || 0), 0);

  const cashPaid = parseFloat(
    invoiceData.cashPaid ||
    invoiceData.paymentAmount ||
    invoiceData.cashAmount ||
    invoiceData.paidAmount ||
    0
  );

  const balance = cashPaid - subTotal;

  // Dynamic from database
  const shopName = invoiceData.companyName || invoiceData.shopName || invoiceData.COMPANY_NAME || "SHOP NAME";
  const shopAddress = (invoiceData.ADDRESS || invoiceData.address || "").trim() || "ADDRESS NOT AVAILABLE";
  const shopTel = (invoiceData.PHONE || invoiceData.phone || invoiceData.telephone || "").trim() || "N/A";

  return (
    <div className="w-[420px] mx-auto my-2 bg-white font-mono text-sm leading-tight shadow-lg border border-gray-300">
      {/* Header - Only show lines that have actual content */}
      <div className="text-center py-3 px-3 border-b-2 border-dashed border-black">
        {/* Company Name - Always show (fallback to "SHOP NAME" if completely missing) */}
        <h1 className="text-2xl font-bold uppercase">
          {shopName && shopName.trim() !== "" && shopName}
        </h1>

        {/* Address - Only show if has content */}
        {shopAddress && shopAddress.trim() !== "" && shopAddress.trim() !== "ADDRESS NOT AVAILABLE" && (
          <p className="text-sm mt-1">{shopAddress.trim()}</p>
        )}

        {/* Phone - Only show if has actual number */}
        {shopTel && shopTel.trim() !== "" && shopTel.trim() !== "N/A" && (
          <p className="text-sm mt-1">TEL - {shopTel.trim()}</p>
        )}
      </div>

      {/* Cashier & Invoice Info */}
      <div className="grid grid-cols-2 text-sm px-3 py-1 border-b border-dashed border-black">
        <div className="leading-none">
          <p>CASHIER: {invoiceData.cashierName || "CASHIER"}</p>
        </div>
        <div className="text-right font-mono leading-none">
          <p>INVOICE NO  : {documentNo}</p>
        </div>
      </div>

      {/* Items Section - Tight spacing to match image */}
      <div className="border-t-2 border-b-2 border-dashed border-black py-1 px-3">
        <div className="grid grid-cols-5 text-sm border-b border-black pb-1 mb-1">
          <div className="text-left font-bold">PRODUCT</div>
          <div className="text-center font-bold">QTY</div>
          <div className="text-right font-bold">U/PRICE</div>
          <div className="text-right font-bold">DISC</div>
          <div className="text-right font-bold">VALUE</div>
        </div>

        {invoiceData.items.map((item, index) => (
          <div key={index} className="mb-1">
            <div className="text-sm leading-none">
              <span className="font-bold">{item.PRODUCT_CODE}</span> {item.PRODUCT_NAME}
            </div>
            <div className="grid grid-cols-5 text-sm leading-none">
              <div></div>
              <div className="text-center">{parseFloat(item.QUANTITY || 0).toFixed(3)}</div>
              <div className="text-right">{parseFloat(item.UNITPRICE || 0).toFixed(2)}</div>
              <div className="text-right">{parseFloat(item.DISCOUNT_AMOUNT || 0).toFixed(2)}</div>
              <div className="text-right font-bold">{parseFloat(item.TOTAL || 0).toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub Total - Directly after bottom border, minimal space */}
      <div className="px-3 text-sm">
        <div className="flex justify-between border-b-2 border-dashed border-black pt-1 pb-1">
          <span>***** SUB TOTAL *****</span>
          <span>{subTotal.toFixed(2)}</span>
        </div>

        {/* Rest of totals */}
        <div className="mt-2">
            <div className="flex justify-between font-bold text-lg mt-2">
                <span>CREDIT</span>
                <span>{subTotal.toFixed(2)}</span>
            </div>
            <div className="border-t-2 border-dotted border-black my-1"></div>
        </div>
      </div>

      {/* Pieces & Products */}
      <div className="grid grid-cols-2 text-sm px-3 mt-2">
        <div>NO OF PIECES</div>
        <div className="text-right">{noOfPieces.toFixed(3)}</div>
        <div>NO OF PRODUCTS</div>
        <div className="text-right">{invoiceData.items.length}</div>
      </div>

      {/* Date & End Time */}
      <div className="flex justify-between text-sm px-3 mt-1 pb-1">
        <span>DATE : {invoiceData.invoiceDate || new Date().toLocaleDateString('en-GB')}</span>
        <span>END TIME : {invoiceData.endTime || new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
      </div>

      {/* Discount Box */}
      <div className="text-center border-4 border-black py-2 mx-8 my-1 font-bold text-xl">
        YOU HAVE TOTAL DISCOUNT<br />
        {totalDiscount.toFixed(2)}
      </div>

      {/* Footer - No extra space if message is empty */}
      <div className="text-center text-sm px-3 pb-1">
        {invoiceData.message && invoiceData.message.trim() !== "" && (
          <>
            <div className="whitespace-pre-line leading-snug mb-3 text-xs">
              {invoiceData.message.trim()}
            </div>
            {/* Extra spacing only if message exists */}
            <div className="mb-2"></div>
          </>
        )}

        <p className="font-bold text-lg">THANK YOU COME AGAIN</p>
      </div>

      {/* Retail Target Footer */}
      <div className="text-center text-xs px-4 pb-2 border-t border-dashed border-black pt-1">
        <p className="font-bold">© Retail Target Software Solutions (Pvt) Ltd Sri Lanka.</p>
        <p>+94 76 3 165700 / +94 76 3 165701</p>
      </div>

      {/* Print Button */}
      <div className="text-center pb-3">
        <button
          onClick={handlePrint}
          className="bg-black text-white px-8 py-3 rounded-lg text-lg hover:bg-gray-800 transition"
        >
          🖨️ Print Invoice
        </button>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body * { visibility: hidden; }
          .w-\\[420px\\], .w-\\[420px\\] * { visibility: visible; }
          .w-\\[420px\\] {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            max-width: 80mm;
            padding: 8mm 6mm;
            margin: 0;
            box-shadow: none;
            border: none;
            box-sizing: border-box;
          }
          button { display: none !important; }
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