import { useState, useRef, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Sparkles,
  Send,
  Download,
  Trash2,
  User,
  Bot,
  Loader2,
  AlertCircle,
} from "lucide-react";

const SUGGESTIONS = [
  "Today's net sales by branch",
  "Cash vs card sales today",
  "Top 10 products this month",
  "Compare this month vs last month",
  "Daily sales for the last 7 days",
];

const INTRO = {
  id: "intro",
  role: "assistant",
  intro: true,
  content:
    "Hi! I can generate sales reports for you. Ask in plain English (or Sinhala), for example by branch, product, day, month or hour. I can also show discounts, returns, VAT/NBT, and cash / card / non-cash sales.",
};

const DIM_LABEL = {
  branch: "Branch",
  product: "Product",
  day: "Date",
  month: "Month",
  hour: "Hour",
};

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

// ---- which table columns to show ----
const getColumns = (report) =>
  report.mode === "product"
    ? [
        { key: "netSales", label: "Net Sales", fmt: fmtMoney, strong: true },
        { key: "grossSales", label: "Gross", fmt: fmtMoney },
        { key: "itemDiscount", label: "Discount", fmt: fmtMoney },
        { key: "returnAmount", label: "Returns", fmt: fmtMoney, red: true },
        { key: "netQty", label: "Net Qty", fmt: fmtQty },
      ]
    : [
        { key: "netSales", label: "Net Sales", fmt: fmtMoney, strong: true },
        { key: "grossSales", label: "Gross", fmt: fmtMoney },
        { key: "totalDiscount", label: "Discount", fmt: fmtMoney },
        { key: "returnAmount", label: "Returns", fmt: fmtMoney, red: true },
        { key: "cashSales", label: "Cash", fmt: fmtMoney },
        { key: "cardSales", label: "Card", fmt: fmtMoney },
        { key: "nonCashSales", label: "Non-cash", fmt: fmtMoney },
      ];

// ---- summary figures (totals) ----
// Core items are always shown. Optional ones only when they are not zero.
const getSummaryItems = (report) => {
  const t = report.totals;
  if (report.mode === "product") {
    return [
      { label: "Net Sales (Rs.)", value: fmtMoney(t.netSales) },
      { label: "Gross Sales (Rs.)", value: fmtMoney(t.grossSales) },
      { label: "Item Discount (Rs.)", value: fmtMoney(t.itemDiscount) },
      { label: "Returns (Rs.)", value: fmtMoney(t.returnAmount) },
      { label: "Net Qty", value: fmtQty(t.netQty) },
      { label: "Returned Qty", value: fmtQty(t.returnQty) },
    ];
  }

  const core = [
    { label: "Net Sales (Rs.)", value: fmtMoney(t.netSales) },
    { label: "Gross Sales (Rs.)", value: fmtMoney(t.grossSales) },
    { label: "Item Discount (Rs.)", value: fmtMoney(t.itemDiscount) },
    { label: "Subtotal Discount (Rs.)", value: fmtMoney(t.subDiscount) },
    { label: `Returns (Rs.) [${fmtQty(t.returnCount)}]`, value: fmtMoney(t.returnAmount) },
    { label: "Cash Sales (Rs.)", value: fmtMoney(t.cashSales) },
    { label: "Card Sales (Rs.)", value: fmtMoney(t.cardSales) },
    { label: "Non-cash Sales (Rs.)", value: fmtMoney(t.nonCashSales) },
  ];
  const optional = [
    ["Gift Voucher Sales (Rs.)", t.giftVoucherSales],
    ["Credit Note (Rs.)", t.creditNote],
    ["Advance (Rs.)", t.advance],
    ["VAT (Rs.)", t.vat],
    ["NBT (Rs.)", t.nbt],
    ["Service Charge (Rs.)", t.serviceCharge],
    ["Bank Charge (Rs.)", t.bankCharge],
    ["Round Up (Rs.)", t.roundUp],
    ["Customer Payments (Rs.)", t.customerPayment],
    ["  - in Cash (Rs.)", t.customerCashPayment],
    ["  - Credit (Rs.)", t.customerCreditPayment],
    ["Paid Out (Rs.)", t.paidOut],
  ]
    .filter(([, v]) => Number(v || 0) !== 0)
    .map(([label, v]) => ({ label: label.trim(), value: fmtMoney(v) }));

  return [...core, ...optional, { label: "Net Qty", value: fmtQty(t.netQty) }];
};

const periodText = (report) =>
  report.startDate === report.endDate ? report.startDate : `${report.startDate} to ${report.endDate}`;

const filterText = (report) =>
  [
    report.branches.length ? report.branches.join(", ") : "All branches",
    report.productSearch ? `Product: "${report.productSearch}"` : null,
  ]
    .filter(Boolean)
    .join(" | ");

const isTopLimited = (report) =>
  report.dimension !== "none" &&
  report.rows.length >= report.topN &&
  (report.dimension === "product" || report.dimension === "branch");

// ---- PDF export ----
const downloadPdf = (report) => {
  const landscape = report.mode !== "product" && report.dimension !== "none";
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text(report.title, margin, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Period: ${periodText(report)}`, margin, 70);
  doc.text(filterText(report).replace(/\|/g, "  |  "), margin, 85, {
    maxWidth: pageWidth - margin * 2,
  });

  doc.setDrawColor(229, 231, 235);
  doc.line(margin, 100, pageWidth - margin, 100);

  // Summary (4 columns: label, value, label, value)
  const items = getSummaryItems(report);
  const pairs = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push([
      items[i].label,
      items[i].value,
      items[i + 1] ? items[i + 1].label : "",
      items[i + 1] ? items[i + 1].value : "",
    ]);
  }
  autoTable(doc, {
    body: pairs,
    startY: 108,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3, textColor: [55, 65, 81] },
    columnStyles: {
      0: { textColor: [107, 114, 128] },
      1: { halign: "right", fontStyle: "bold" },
      2: { textColor: [107, 114, 128] },
      3: { halign: "right", fontStyle: "bold" },
    },
  });

  let y = (doc.lastAutoTable?.finalY || 140) + 14;
  doc.line(margin, y - 6, pageWidth - margin, y - 6);

  // Table
  if (report.dimension !== "none") {
    if (report.rows.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(107, 114, 128);
      doc.text("No sales data for this period.", margin, y + 14);
    } else {
      const cols = getColumns(report);
      const hasCode = report.rows.some((r) => r.code);
      const head = [[DIM_LABEL[report.dimension] || "Item", ...(hasCode ? ["Code"] : []), ...cols.map((c) => c.label)]];
      const body = report.rows.map((r) => [
        r.label || "",
        ...(hasCode ? [r.code || ""] : []),
        ...cols.map((c) => c.fmt(r[c.key])),
      ]);

      const firstNumericCol = hasCode ? 2 : 1;
      const columnStyles = {};
      for (let c = firstNumericCol; c < head[0].length; c++) columnStyles[c] = { halign: "right" };

      autoTable(doc, {
        head,
        body,
        startY: y,
        margin: { left: margin, right: margin, bottom: 50 },
        theme: "striped",
        styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [55, 65, 81] },
        headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles,
      });
    }
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  const generated = new Date().toLocaleString("en-GB");
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`RTPOS AI Report Assistant | Generated ${generated}`, margin, pageHeight - 25);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 25, { align: "right" });
    if (i === pages && isTopLimited(report)) {
      doc.text(
        `Showing the top ${report.topN}. Totals above include all rows.`,
        margin,
        pageHeight - 38
      );
    }
  }

  const fileName = `${report.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${report.startDate}_${report.endDate}.pdf`;
  doc.save(fileName);
};

// ---- One report (totals + table) ----
const ReportCard = ({ report }) => {
  const hasCode = report.rows.some((r) => r.code);
  const cols = getColumns(report);
  const items = getSummaryItems(report);
  const headline = items.slice(0, 3);
  const rest = items.slice(3);
  const headlineStyles = [
    { bg: "bg-orange-50", text: "text-orange-600" },
    { bg: "bg-emerald-50", text: "text-emerald-600" },
    { bg: "bg-red-50", text: "text-red-500" },
  ];

  return (
    <div className="mt-3 overflow-hidden bg-white border border-gray-200 rounded-xl">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{report.title}</p>
          <p className="text-xs text-gray-400">
            {periodText(report)} | {filterText(report)}
          </p>
        </div>
        <button
          onClick={() => downloadPdf(report)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 transition bg-white border border-gray-200 rounded-lg shrink-0 hover:border-orange-300 hover:text-orange-600"
        >
          <Download className="w-3.5 h-3.5" />
          PDF
        </button>
      </div>

      {/* Headline figures */}
      <div className="grid grid-cols-3 gap-3 p-4 pb-2">
        {headline.map((it, i) => (
          <div key={it.label} className={`p-3 rounded-lg ${headlineStyles[i].bg}`}>
            <p className="text-[11px] font-medium text-gray-400">{it.label}</p>
            <p className={`text-sm font-extrabold sm:text-base ${headlineStyles[i].text}`}>
              {it.value}
            </p>
          </div>
        ))}
      </div>

      {/* Other figures */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 pb-4 sm:grid-cols-3">
        {rest.map((it) => (
          <div
            key={it.label}
            className="flex items-center justify-between py-1 text-xs border-b border-gray-50"
          >
            <span className="text-gray-400">{it.label}</span>
            <span className="font-semibold text-gray-700">{it.value}</span>
          </div>
        ))}
      </div>

      {report.dimension !== "none" && (
        <div className="px-4 pb-4 overflow-x-auto">
          {report.rows.length === 0 ? (
            <p className="py-4 text-sm text-center text-gray-400">No sales data for this period.</p>
          ) : (
            <table className="w-full text-xs text-left min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 pr-3 font-semibold text-gray-400 whitespace-nowrap">
                    {DIM_LABEL[report.dimension]}
                  </th>
                  {cols.map((c) => (
                    <th
                      key={c.key}
                      className="py-2 pr-3 font-semibold text-right text-gray-400 whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-700">
                      {r.label}
                      {hasCode && r.code && (
                        <span className="block text-[10px] text-gray-400">{r.code}</span>
                      )}
                    </td>
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className={`py-2 pr-3 text-right whitespace-nowrap ${
                          c.strong
                            ? "font-semibold text-gray-800"
                            : c.red
                            ? "text-red-400"
                            : "text-gray-500"
                        }`}
                      >
                        {c.fmt(r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {isTopLimited(report) && (
            <p className="pt-2 text-[11px] text-gray-400">
              Showing the top {report.topN}. Totals above include all rows.
            </p>
          )}
          {report.mode === "product" && (
            <p className="pt-1 text-[11px] text-gray-400">
              Product figures are item-level. Subtotal discounts, taxes and payments are not
              recorded per product.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Main chat panel ----
const AiReportChat = ({ authToken }) => {
  const [messages, setMessages] = useState([INTRO]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const idRef = useRef(1);

  // keep the chat box scrolled to the newest message (without scrolling the whole page)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const history = messages
      .filter((m) => !m.intro && !m.error)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { id: idRef.current++, role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}ai-report-chat`,
        { message: question, history },
        { headers: { Authorization: `Bearer ${authToken}` }, timeout: 60000 }
      );
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          role: "assistant",
          content: res.data.answer || "",
          reports: res.data.reports || [],
        },
      ]);
    } catch (err) {
      console.error("AI report chat failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          role: "assistant",
          error: true,
          content:
            err.response?.data?.message ||
            "Couldn't generate the report right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Show the AI assistant only to users who have the permission
  let canUseAi = false;
    try {
      canUseAi = authToken ? jwtDecode(authToken).d_ai_assistant === "T" : false;
    } catch (e) {
      canUseAi = false;
    }
    if (!canUseAi) return null;

  return (
    <div className="p-5 transition-all duration-200 bg-white border border-gray-100 shadow-lg rounded-2xl sm:p-7 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-bold text-gray-900 sm:text-lg">AI Report Chat Assistant</h2>
          </div>
          <p className="mt-1 ml-7 text-sm text-gray-400">
            Ask for any sales report in your own words
          </p>
        </div>
        {messages.length > 1 && (
          <button
            onClick={() => setMessages([INTRO])}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 transition border border-gray-200 rounded-lg hover:border-red-200 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="h-[28rem] p-4 space-y-5 overflow-y-auto bg-gray-50 rounded-xl"
      >
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex items-start justify-end gap-2">
              <div className="max-w-[85%] px-4 py-2.5 text-sm text-white shadow-sm rounded-2xl rounded-tr-sm bg-gradient-to-br from-orange-500 to-orange-600 whitespace-pre-wrap break-words">
                {m.content}
              </div>
              <div className="flex items-center justify-center w-8 h-8 text-gray-500 bg-white border border-gray-200 rounded-full shrink-0">
                <User className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 text-white rounded-full shrink-0 ${
                  m.error ? "bg-red-500" : "bg-gradient-to-br from-orange-400 to-orange-600"
                }`}
              >
                {m.error ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className="max-w-[92%] min-w-0">
                {m.content && (
                  <div
                    className={`px-4 py-2.5 text-sm bg-white border shadow-sm rounded-2xl rounded-tl-sm whitespace-pre-wrap break-words ${
                      m.error ? "border-red-200 text-red-600" : "border-gray-100 text-gray-700"
                    }`}
                  >
                    {m.content}
                  </div>
                )}
                {m.reports?.map((r, i) => (
                  <ReportCard key={i} report={r} />
                ))}
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 text-white rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Preparing your report...
            </div>
          </div>
        )}
      </div>

      {/* Suggestions (only before the first question) */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-orange-700 transition border border-orange-200 rounded-full bg-orange-50 hover:bg-orange-100 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 mt-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={500}
          placeholder="e.g. Show net sales by branch for last month"
          className="flex-1 px-4 py-3 text-sm text-gray-700 bg-white border border-gray-200 outline-none resize-none rounded-xl focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="flex items-center justify-center w-11 h-11 text-white transition shadow-md rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AiReportChat;