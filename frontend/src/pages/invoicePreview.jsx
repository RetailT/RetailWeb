import React, { useEffect, useState, useContext, useRef } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import {
  buildDocument,
  printDocument,
  normalizePaper,
  getPrintSettings,
  savePrintSettings,
  DEFAULT_PRINT_SETTINGS,
  SINHALA_FONT_OPTIONS,
  getSinhalaFontKey,
  saveSinhalaFontKey,
  sinhalaLabelCss,
  hasSinhala,
} from '../utils/invoiceTemplate';
import { getBillTemplate } from '../utils/billTemplates';

// ---------------------------------------------------------------------------
// Which bill design is used?
//   1) A layout saved in the Invoice Template Designer for the TYPE of this company
//      (key "T1", "T2" ... = tb_COMPANY.MODIFY_TYPE)            -> used first
//   2) The code template of that type (utils/billTemplates.js)  -> html templates
//   3) Type 1 / no type / unknown type                          -> built-in receipt below
//   For testing only: add  &tpl=2  to the invoice preview URL to force the CODE template of
//   type 2 (a designer layout is ignored then).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bill language (English / Sinhala)
// ---------------------------------------------------------------------------
// Latin letters + digits stay in Courier New (mono look).
// Every Sinhala LABEL is wrapped in <span class="si-t"> and uses a real Sinhala font
// (chosen with the "Sinhala font" list) for the letters AND the spaces.
// The CSS of the span is in utils/invoiceTemplate.js -> sinhalaLabelCss().
// The Sinhala PRODUCT NAME is printed only in the Sinhala bill (English bill = English name only).

// Sinhala bill: column widths of the items table (header + every item row use the same
// widths, so the numbers stay exactly under their headings and the headings stay on ONE line)
const SI_GRID = { gridTemplateColumns: "0.95fr 1.2fr 0.85fr 1.2fr" };

// Column titles of the items table:
//   qty      = ප්‍රමාණය / QTY
//   uprice   = සිල්ලර මිල / UNIT PRICE   (the real price of the product)   <- change the English title here
//   price    = අපේ මිල / PRICE        (price after the discount)
//   value    = වටිනාකම / VALUE
const LABELS = {
  en: {
    tel: "TEL",
    cashier: "CASHIER",
    invoiceNo: "INVOICE NO",
    customer: "CUSTOMER",
    walkIn: "WALK-IN",
    product: "PRODUCT",
    qty: "QTY",
    uprice: "U/PRICE",
    price: "PRICE",
    value: "VALUE",
    subTotal: "SUB TOTAL",
    refundTotal: "REFUND TOTAL",
    cash: "CASH",
    credit: "CREDIT",
    pieces: "NO OF PIECES",
    products: "NO OF PRODUCTS",
    date: "DATE",
    endTime: "END TIME",
    totalDiscount: "YOU HAVE TOTAL DISCOUNT",
    thanks: "THANK YOU COME AGAIN",
    refundTag: " (REFUND)",
    defaultMessage:
      "WE ARE HAPPY TO EXCHANGE PRODUCTS RETURNED IN\nSALEABLE CONDITION. ALONG WITH RECEIPT.",
  },
  si: {
    tel: "දුරකථන",
    cashier: "අයකැමි",
    invoiceNo: "බිල් අංකය",
    customer: "පාරිභෝගිකයා",
    walkIn: "සාමාන්‍ය",
    product: "භාණ්ඩය",
    qty: "ප්‍රමාණය",
    uprice: "සිල්ලර මිල",
    price: "අපේ මිල",
    value: "වටිනාකම",
    subTotal: "එකතුව",
    refundTotal: "ආපසු ගෙවීම්",
    cash: "මුදල්",
    credit: "ක්‍රෙඩිට් කාඩ්",
    pieces: "කොටස් ගණන",
    products: "භාණ්ඩ ගණන",
    date: "දිනය",
    endTime: "වේලාව",
    totalDiscount: "ඔබට ලැබුණු මුළු ලාභය",
    thanks: "ස්තූතියි, නැවත එන්න",
    refundTag: " (ආපසු)",
    defaultMessage:
      "විකිණිය හැකි තත්ත්වයේ භාණ්ඩ, රිසිට්පත සමඟ\nහුවමාරු කර ගත හැකිය.",
  },
};

// Footer message translations (Sinhala bill). The English text is compared ignoring
// capital letters, spaces and punctuation. Add more messages here if a company has its own.
const MESSAGE_TRANSLATIONS = [
  { en: LABELS.en.defaultMessage, si: LABELS.si.defaultMessage },
  // { en: "THANK YOU FOR SHOPPING WITH US", si: "අප සමඟ සාප්පු සවාරි කිරීම ගැන ස්තූතියි" },
];

const normMsg = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

// Message printed in the footer for the selected bill language
const translateMessage = (msg, lang) => {
  const text = String(msg || "").trim();
  if (!text) return LABELS[lang].defaultMessage;
  if (lang !== "si") return text;
  const key = normMsg(text);
  const hit = MESSAGE_TRANSLATIONS.find((m) => normMsg(m.en) === key);
  return hit ? hit.si : text;
};

// English label (as written in the html templates / old saved layouts) -> Sinhala label
// Longest first, so "NO OF PRODUCTS" is replaced before "PRODUCT" etc.
const TEMPLATE_LABEL_MAP = [
  ["YOU HAVE TOTAL DISCOUNT", LABELS.si.totalDiscount],
  ["THANK YOU COME AGAIN", LABELS.si.thanks],
  ["NO OF PRODUCTS", LABELS.si.products],
  ["NO OF PIECES", LABELS.si.pieces],
  ["REFUND TOTAL", LABELS.si.refundTotal],
  ["INVOICE NO", LABELS.si.invoiceNo],
  ["END TIME", LABELS.si.endTime],
  ["SUB TOTAL", LABELS.si.subTotal],
  ["CUSTOMER", LABELS.si.customer],
  ["CASHIER", LABELS.si.cashier],
  ["PRODUCT", LABELS.si.product],
  ["U/PRICE", LABELS.si.uprice],
  ["RETAIL", LABELS.si.uprice],
  ["CREDIT", LABELS.si.credit],
  ["PRICE", LABELS.si.price],
  ["VALUE", LABELS.si.value],
  ["DATE", LABELS.si.date],
  ["CASH", LABELS.si.cash],
  ["QTY", LABELS.si.qty],
  ["TEL", LABELS.si.tel],
].sort((a, b) => b[0].length - a[0].length);

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

// (^|[^A-Za-z/]) = the label must start a word (no lookbehind, works in old browsers too)
const TEMPLATE_LABEL_REGEX = TEMPLATE_LABEL_MAP.map(([en, si]) => [
  new RegExp(`(^|[^A-Za-z/])${escapeRegExp(en)}(?![A-Za-z])`, "g"),
  si,
]);

// Every translated label is wrapped in <span class="si-t"> -> Sinhala font + normal spaces
const translateText = (text) => {
  let out = text;
  TEMPLATE_LABEL_REGEX.forEach(([re, si]) => {
    out = out.replace(re, (m, pre) => `${pre}<span class="si-t">${si}</span>`);
  });
  return out;
};

// Translates ONLY the text between the tags of an html template (never the tags,
// attributes or {{placeholders}}). Item name -> Sinhala name (AMILA) or English fallback.
// wrapMessage = true when the footer message is Sinhala -> {{message}} gets the Sinhala font.
const translateTemplateHtml = (html, wrapMessage) => {
  let translated = String(html || "")
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith("<") ? part : translateText(part)))
    .join("");

  if (wrapMessage) {
    translated = translated.replace(
      /\{\{\s*message\s*\}\}/g,
      `<span class="si-msg">{{message}}</span>`
    );
  }

  // {{name}} -> Sinhala name in AMILA (only one of the two is filled per item)
  return translated.replace(
    /\{\{\s*name\s*\}\}/g,
    `<span class="amila-name" style="font-family:'AMILA',sans-serif">{{nameSinhala}}</span>{{nameEnglish}}`
  );
};

// CSS added to an html template in Sinhala mode:
//  - the Sinhala label font (chosen font + normal word spaces)
//  - AMILA for the legacy Sinhala product names
const siTemplateCss = (fontKey) => `
  ${sinhalaLabelCss(fontKey)}
  .amila-name, [style*="AMILA" i] { font-family: "AMILA", sans-serif !important; word-spacing: normal !important; }
`;

// The saved designer layouts may still have the column title "DISC".
// The column shows the price after discount, so the title is changed to "PRICE".
const relabelDiscountHeader = (html) =>
  String(html || "").replace(/(>\s*)DISC\.?(\s*<)/gi, "$1PRICE$2");

// POS (80mm) text sizes: one body size for everything, bigger only for the shop name
// and the key lines (marked with the "pos-big" class). The footer (copyright + message,
// marked "pos-footer") is smaller so every footer line stays on ONE line.
// Sinhala letters look bigger than Latin letters of the same size, so the Sinhala label
// spans get their own (slightly smaller) sizes.
// Used for printing AND for measuring the page height, so both always match.
const POS_TEXT_CSS = `
  .print-container, .print-container * { font-size: 10.5px !important; line-height: 1.25 !important; }
  .print-container h1 { font-size: 18px !important; line-height: 1.2 !important; }
  .print-container .pos-big, .print-container .pos-big * { font-size: 13px !important; }
  .print-container .pos-footer, .print-container .pos-footer * { font-size: 8.5px !important; }
  .print-container .border-4 { border-width: 2px !important; }
  /* Items table heading: bigger, always ONE line */
  .print-container .items-head, .print-container .items-head * { font-size: 11px !important; white-space: nowrap !important; }
  /* Sinhala labels (more specific rules -> they win over the rules above) */
  .print-container .si-t { font-size: 9.5px !important; line-height: 1.5 !important; white-space: nowrap !important; }
  .print-container .si-msg { font-size: 8.5px !important; line-height: 1.5 !important; }
  .print-container .pos-big .si-t { font-size: 11.5px !important; }
  .print-container .items-head .si-t { font-size: 10.5px !important; }
  .print-container .pos-footer .si-t { font-size: 8px !important; }
  /* Sinhala product names are legacy AMILA text */
  .print-container .amila-name { font-family: "AMILA", sans-serif !important; word-spacing: normal !important; }
`;

// NOTE: the page height / bottom space / print width of the POS print are NOT fixed here
// any more. They come from the "Print settings" of this computer (utils/invoiceTemplate.js).

// Max characters that fit on one footer line (80mm paper, 8.5px mono)
const FOOTER_MAX_CHARS = 46;
const FOOTER_MAX_CHARS_SI = 38;

// AMILA = legacy Sinhala font (the product Sinhala names in the DB are typed with it).
// Font file: public/fonts/AMILA.ttf  (or public/fonts/amilanormal.ttf - both names are tried).
// A PC that has AMILA installed uses its own copy.
const amilaFaceCss = () =>
  `@font-face{font-family:"AMILA";src:local("AMILA"),local("AMILA Normal"),url("${window.location.origin}/fonts/AMILA.ttf") format("truetype"),url("${window.location.origin}/fonts/amilanormal.ttf") format("truetype");font-display:swap;}`;
const SINHALA_FONT = '"AMILA", sans-serif';

// ---- DOCUMENT_DATE / DOCUMENT_TIME (from tb_INVOICE_DETAILS) -> display text ----
// The API may send them as "2026-10-19T00:00:00.000Z", "2026-10-19", "14:35:10",
// "1970-01-01T14:35:10.000Z" ... so we read the parts straight from the text
// (no timezone conversion, so the value shown is exactly what is stored in the DB).
const formatDocDate = (value) => {
  if (!value) return "";
  const m = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`; // dd/mm/yyyy
  return "";
};

const formatDocTime = (value) => {
  if (!value) return "";
  const m = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${min} ${ampm}`;
};

// A refund line = REFUND flag 'T' or a minus quantity
const isRefundLine = (item) =>
  String(item.REFUND || "").toUpperCase() === "T" ||
  (parseFloat(item.QUANTITY) || 0) < 0;

// Unit price AFTER the discount (what the customer really pays for ONE unit):
// TOTAL / QUANTITY  (e.g. 2 x 575.00 with 50.00 discount -> 1100.00 / 2 = 550.00)
const netUnitPrice = (item) => {
  const qty = parseFloat(item.QUANTITY) || 0;
  if (!qty) return parseFloat(item.UNITPRICE) || 0;
  return (parseFloat(item.TOTAL) || 0) / qty;
};

// Money with thousand separators for the html templates (e.g. 2,500.00)
const fmtMoney = (n) =>
  (Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Footer message -> at most 2 lines, each line stays on one line when printed.
const buildMessageLines = (msg, maxChars = FOOTER_MAX_CHARS) => {
  const raw = (msg || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (raw.length === 0) return [];
  if (raw.length <= 2 && raw.every((l) => l.length <= maxChars)) return raw;

  const words = raw.join(" ").replace(/\s+/g, " ").split(" ");
  const lines = [];
  let current = "";
  words.forEach((w) => {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxChars || !current) {
      current = next;
    } else {
      lines.push(current);
      current = w;
    }
  });
  if (current) lines.push(current);
  return lines;
};

// The backend can fail now and then (it opens / closes ONE shared DB connection per
// request), so try up to 3 times before giving up. Only network / 5xx errors are retried.
const withRetry = async (fn, tries = 3) => {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      const retryable = !status || status >= 500;
      if (!retryable || attempt === tries) throw err;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
};

// ---------------------------------------------------------------------------
// Ruler test page (80mm): shows how much of the paper width the printer really prints.
// Ticks every 2mm, numbers staggered above / below the ticks, and a border box that
// touches both paper edges. Whatever is missing on the printed paper is outside the
// printable area of this printer.
// ---------------------------------------------------------------------------
const buildRulerHtml = (W = 80) => {
  let marks = "";
  for (let mm = 0; mm <= W; mm += 2) {
    const above = mm % 4 === 0;
    marks += `<div class="t" style="left:${mm}mm"></div>`;
    marks += `<div class="n ${above ? "up" : "down"}" style="left:${mm}mm">${mm}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${W}mm 44mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { position: relative; width: ${W}mm; height: 44mm; overflow: hidden;
           font-family: "Courier New", monospace; color: #000;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .box { position: absolute; left: 0; top: 0; width: ${W}mm; height: 44mm;
           border: 0.5mm solid #000; box-sizing: border-box; }
    .t { position: absolute; top: 13mm; height: 14mm; border-left: 0.3mm solid #000; }
    .n { position: absolute; font-size: 7px; transform: translateX(-50%); }
    .up { top: 9.5mm; }
    .down { top: 28mm; }
    .h { position: absolute; left: 2mm; top: 2mm; font-size: 8px; font-weight: bold; }
    .f { position: absolute; left: 2mm; top: 33mm; width: ${W - 4}mm; font-size: 6.5px; line-height: 1.3; }
  </style></head><body>
    <div class="box"></div>
    <div class="h">RULER TEST - paper ${W}mm</div>
    ${marks}
    <div class="f">Last number fully printed on the right = Print width (ignore 0 and ${W}).</div>
  </body></html>`;
};

const printRulerTest = async () => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("sandbox", "allow-same-origin allow-modals");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:80mm;height:200mm;border:0;visibility:hidden;";

  try {
    await new Promise((resolve) => {
      iframe.onload = resolve;
      iframe.srcdoc = buildRulerHtml(80);
      document.body.appendChild(iframe);
    });
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (err) {
    console.error("Ruler test print failed:", err);
  } finally {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1500);
  }
};

// Printer calibration of THIS computer (saved in this browser only)
const PrintSettingsPanel = () => {
  const [s, setS] = useState(() => getPrintSettings());
  const [saved, setSaved] = useState(false);

  const change = (key, value) => {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setS(savePrintSettings(s));
    setSaved(true);
  };

  const handleReset = () => {
    setS(savePrintSettings(DEFAULT_PRINT_SETTINGS));
    setSaved(true);
  };

  const inputCls =
    "w-20 px-2 py-1 text-right bg-white border border-gray-300 rounded-md";

  return (
    <div className="max-w-[380px] mx-auto mt-3 p-3 text-left text-xs bg-gray-50 border border-gray-300 rounded-md no-print">
      <p className="mb-2 font-bold">Print settings (saved on this computer only)</p>

      <div className="flex items-center justify-between gap-2 mb-2">
        <label>Page height (%)</label>
        <input
          type="number"
          min="50"
          max="150"
          value={s.scalePct}
          onChange={(e) => change("scalePct", e.target.value)}
          className={inputCls}
        />
      </div>
      <p className="mb-2 text-gray-500">
        Blank paper keeps coming after the bill: lower it (e.g. 80). Bill is cut off or goes
        to a 2nd page: raise it (e.g. 100).
      </p>

      <div className="flex items-center justify-between gap-2 mb-2">
        <label>Space at the bottom (mm)</label>
        <input
          type="number"
          min="0"
          max="60"
          value={s.extraMm}
          onChange={(e) => change("extraMm", e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="flex items-center justify-between gap-2 mb-2">
        <label>Print width (mm, 0 = paper width)</label>
        <input
          type="number"
          min="0"
          max="300"
          value={s.widthMm}
          onChange={(e) => change("widthMm", e.target.value)}
          className={inputCls}
        />
      </div>
      <p className="mb-2 text-gray-500">
        A printer cannot print the full paper width (an 80mm roll usually prints about 72mm), so the
        last digits on the right can get cut off. Press <b>Print ruler test</b>, look at the paper
        and enter the last number on the right that is fully printed (e.g. 72). The bill is then
        made that wide and centered.
      </p>
      <p className="mb-3 text-gray-500">
        In the Chrome print window use: Margins = None, Scale = Default (100), and the
        80mm roll as the paper size.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-white bg-black rounded-md hover:bg-gray-800"
        >
          Save
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
        >
          Reset
        </button>
        <button
          onClick={printRulerTest}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
        >
          Print ruler test
        </button>
        {saved && <span className="text-green-700">Saved</span>}
      </div>
    </div>
  );
};

// Bill language selector (English / Sinhala)
const BillLangSelect = ({ value, onChange }) => (
  <label className="flex items-center justify-center gap-2 mb-3 text-sm sm:text-base no-print">
    <span>Bill language:</span>
    <select
      value={value}
      onChange={onChange}
      className="px-2 py-1 bg-white border border-gray-300 rounded-md cursor-pointer"
    >
      <option value="en">English</option>
      <option value="si">සිංහල (Sinhala)</option>
    </select>
  </label>
);

// Font of the Sinhala labels (Iskoola Pota, Nirmala UI, Noto ...). Only shown in Sinhala mode.
const SinhalaFontSelect = ({ value, onChange }) => (
  <label className="flex items-center justify-center gap-2 mb-3 text-sm sm:text-base no-print">
    <span>Sinhala font:</span>
    <select
      value={value}
      onChange={onChange}
      className="px-2 py-1 bg-white border border-gray-300 rounded-md cursor-pointer w-36"
    >
      {SINHALA_FONT_OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

// Shows an html template inside an iframe. The frame height follows the content.
const TemplatePreviewFrame = ({ docHtml, widthMm }) => {
  const frameRef = useRef(null);
  const [height, setHeight] = useState(400);

  const measure = () => {
    try {
      const body = frameRef.current?.contentDocument?.body;
      if (body) setHeight(Math.ceil(body.getBoundingClientRect().height) + 4);
    } catch (e) {}
  };

  useEffect(() => {
    // measure again later (logo images / fonts may load after the first measure)
    const t1 = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [docHtml]);

  return (
    <iframe
      ref={frameRef}
      title="Invoice"
      srcDoc={docHtml}
      sandbox="allow-same-origin"
      scrolling="no"
      onLoad={measure}
      style={{
        width: `${widthMm}mm`,
        height,
        border: 0,
        display: "block",
        background: "#fff",
      }}
    />
  );
};

const InvoicePreview = () => {
  const { authToken } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const documentNo = searchParams.get('docNo');
  const company = searchParams.get('company');
  // testing only: ?tpl=2 forces the code template of that type
  const forcedType = searchParams.get('tpl');

  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Layout saved in the Invoice Template Designer for the TYPE of this company (null = none)
  const [savedTpl, setSavedTpl] = useState(null);
  // true = ignore the designer layout and show the code layout (only users who can edit layouts)
  const [useDefaultLayout, setUseDefaultLayout] = useState(false);
  // show / hide the printer calibration panel
  const [showPrintSettings, setShowPrintSettings] = useState(false);

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

  // Bill language: "en" (default) or "si". Remembered per browser.
  const [billLang, setBillLang] = useState(() => {
    try {
      return localStorage.getItem("billLang") === "si" ? "si" : "en";
    } catch (e) {
      return "en";
    }
  });

  // Font of the Sinhala labels. Remembered per browser.
  const [siFontKey, setSiFontKey] = useState(() => getSinhalaFontKey());

  const receiptRef = useRef(null);

  // StrictMode (dev) runs effects twice -> two requests at the same time -> the backend's
  // shared DB connection gets closed by the second one. Remember which invoice already started.
  const startedKeyRef = useRef("");

  const handlePosToggle = (e) => {
    const checked = e.target.checked;
    setUsePosPrinter(checked);
    try {
      localStorage.setItem("usePosPrinter", checked ? "1" : "0");
    } catch (err) {}
  };

  const handleLangChange = (e) => {
    const v = e.target.value === "si" ? "si" : "en";
    setBillLang(v);
    try {
      localStorage.setItem("billLang", v);
    } catch (err) {}
  };

  const handleSiFontChange = (e) => {
    setSiFontKey(saveSinhalaFontKey(e.target.value));
  };

  const token = localStorage.getItem("authToken");

  // Any logged-in user may view / print an invoice. Only editing the layout needs a
  // permission (the backend tells us in invoice.canEditTemplate).
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

    // Run only once per invoice (see startedKeyRef above)
    const key = `${documentNo}|${company}`;
    if (startedKeyRef.current === key) return;
    startedKeyRef.current = key;

    const fetchInvoice = async () => {
      try {
        const params = { documentNo: documentNo.trim().toUpperCase() };
        if (company) {
          params.company = company.trim().toUpperCase();
        }

        const response = await withRetry(() =>
          axios.get(`${process.env.REACT_APP_BACKEND_URL}get-invoice-preview`, {
            headers: { Authorization: `Bearer ${token}` },
            params,
          })
        );

        if (response.data.success) {
          const inv = response.data.invoice;

          // Layout saved in the designer for the TYPE of this company ("T1", "T2" ...).
          // exact = only a layout saved for THIS type (no fallback to another one).
          // Any failure / none saved -> the code layout is used.
          // The invoice is set only AFTER this, so the "customers" request (started by the
          // effect below) never runs at the same time as the template request.
          let tpl = null;
          if (!forcedType) {
            try {
              const typeId = getBillTemplate(inv.modifyType).id;
              const tRes = await withRetry(() =>
                axios.get(`${process.env.REACT_APP_BACKEND_URL}invoice-template`, {
                  headers: { Authorization: `Bearer ${token}` },
                  params: { company: `T${typeId}`, exact: "1" },
                })
              );
              tpl = tRes.data?.template || null;
            } catch (tErr) {
              console.warn("Saved layout could not be loaded, using the code layout");
            }
          }

          setSavedTpl(tpl && tpl.html ? tpl : null);
          setInvoiceData(inv);
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
  }, [documentNo, company, forcedType, token, authToken, hasPermission, navigate]);

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

  // POS print (built-in receipt): the receipt is copied into a hidden iframe that is exactly
  // 80mm wide. That is the SAME width Chrome uses for the printed page, so the layout (and the
  // measured height) is identical to what gets printed -> no blank space at the bottom.
  // Page height / bottom space / print width come from the Print settings of this computer.
  const printPos = async () => {
    const src = receiptRef.current;
    if (!src) return;

    const ps = getPrintSettings();
    const printW = ps.widthMm > 0 ? ps.widthMm : 80;

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
      // Sinhala label font (always the font that is selected right now) + POS sizes + AMILA
      const posStyle = doc.createElement("style");
      posStyle.textContent =
        sinhalaLabelCss(getSinhalaFontKey()) + POS_TEXT_CSS + amilaFaceCss();
      doc.head.appendChild(posStyle);

      await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2000))]);
      try {
        if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
      } catch (e) {}

      const clone = src.cloneNode(true);
      clone.querySelectorAll(".no-print, style").forEach((n) => n.remove());
      clone.style.cssText = `position:static;width:${printW}mm;max-width:${printW}mm;padding:2mm 3mm;margin:0 auto;box-sizing:border-box;border:none;box-shadow:none;`;
      doc.body.appendChild(clone);

      // make sure the AMILA font is loaded before measuring / printing
      try {
        await doc.fonts.load('10px "AMILA"');
        await doc.fonts.ready;
      } catch (e) {}

      await new Promise((r) => setTimeout(r, 100)); // let layout settle

      // Height = from the top of the receipt to the bottom of the phone-number line
      // (".pos-end"), plus the bottom space. Anything after it (buttons etc.) is ignored.
      const endEl = clone.querySelector(".pos-end");
      const topPx = clone.getBoundingClientRect().top;
      const bottomPx = endEl
        ? endEl.getBoundingClientRect().bottom
        : clone.getBoundingClientRect().bottom;
      const px = bottomPx - topPx;
      // Page height % (Print settings) corrects for the way the printer / Chrome scales the bill.
      const mm = Math.ceil(((px * 25.4) / 96) * (ps.scalePct / 100)) + ps.extraMm;

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-100">
        <div
          className="border-4 border-orange-500 rounded-full w-14 h-14 border-t-transparent animate-spin"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm font-medium text-gray-400">Loading invoice preview...</p>
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

  // Labels of the selected bill language
  const isSi = billLang === "si";
  const L = LABELS[billLang];
  // Labels for the built-in layout: in Sinhala mode every label is wrapped in the Sinhala
  // font span (letters AND spaces in a Sinhala font -> normal word spacing)
  const LJ = isSi
    ? Object.fromEntries(
        Object.entries(L).map(([k, v]) => [
          k,
          k === "defaultMessage" ? v : <span className="si-t">{v}</span>,
        ])
      )
    : L;

  // Only users with the "invoice designer" permission may edit the layout / switch layouts
  const canEditTemplate = !!invoiceData.canEditTemplate;

  // Calculations
  // SUB TOTAL = sales lines only. Refund lines are listed in the items but are NOT part
  // of the payment, so SUB TOTAL always equals CASH + CREDIT.
  const subTotal = invoiceData.items.reduce(
    (sum, item) =>
      isRefundLine(item) ? sum : sum + parseFloat(item.TOTAL || 0),
    0
  );
  // Refund total (a minus value) - shown as an information line when there are refund items
  const refundTotal = invoiceData.items.reduce(
    (sum, item) =>
      isRefundLine(item) ? sum + parseFloat(item.TOTAL || 0) : sum,
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

  // Date & time come from tb_INVOICE_DETAILS (DOCUMENT_DATE / DOCUMENT_TIME).
  // Very old invoices that have no value saved fall back to the current date/time.
  const displayDate =
    formatDocDate(invoiceData.documentDate) ||
    new Date().toLocaleDateString('en-GB');
  const displayTime =
    formatDocTime(invoiceData.documentTime) ||
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Customer: "CODE NAME"
  const { code: custCode, name: custName } = customerInfo;
  const customerLabel =
    custCode && custName && custCode.toUpperCase() !== custName.toUpperCase()
      ? `${custCode} ${custName}`
      : custCode || custName || L.walkIn;

  // Footer message: the message saved for the company (or the default exchange note),
  // translated to Sinhala when the bill language is Sinhala (see MESSAGE_TRANSLATIONS).
  const messageText = translateMessage(invoiceData.message, billLang);
  const messageLines = buildMessageLines(
    messageText,
    isSi ? FOOTER_MAX_CHARS_SI : FOOTER_MAX_CHARS
  );

  // ---------- Which layout? ----------
  // type of this company (tb_COMPANY.MODIFY_TYPE) -> code template
  const billTpl = getBillTemplate(forcedType || invoiceData.modifyType);
  // layout saved in the designer for this type (users who can edit layouts may switch it off)
  const useSaved = !!savedTpl && !(canEditTemplate && useDefaultLayout);
  const useTemplate = useSaved || !!billTpl.html;
  const templatePaper = useTemplate
    ? normalizePaper(useSaved ? savedTpl : billTpl.paper)
    : null;
  let templateDoc = "";

  if (useTemplate) {
    const templateData = {
      shopName,
      shopAddress,
      shopTel: shopTel === "N/A" ? "" : shopTel,
      cashier: invoiceData.cashierName || "CASHIER",
      invoiceNo: documentNo,
      customer: customerLabel,
      date: displayDate,
      time: displayTime,
      subTotal: fmtMoney(subTotal),
      refundTotal: fmtMoney(refundTotal),
      cash: fmtMoney(cashAmount),
      credit: fmtMoney(creditAmount),
      totalDiscount: fmtMoney(totalDiscount),
      noOfPieces: noOfPieces.toFixed(3),
      noOfProducts: String(invoiceData.items.length),
      message: messageText,
      hasRefund: refundTotal < -0.001,
      hasDiscount: totalDiscount > 0.001,
      items: invoiceData.items.map((item) => {
        const nameEn = String(item.PRODUCT_NAME || "").trim();
        const nameSi = String(item.PRODUCT_NAME_SINHALA || "").trim();
        return {
          code: String(item.PRODUCT_CODE || "").trim(),
          // name = English only (the Sinhala text is legacy AMILA text, it must not be mixed
          // into a normal font). Use {{nameSinhala}} in the template with font-family AMILA.
          name: nameEn,
          // Sinhala bill: only ONE of these two is filled per item
          //   Sinhala name exists  -> nameSinhala = AMILA text, nameEnglish = ""
          //   no Sinhala name      -> nameSinhala = "",         nameEnglish = English name
          // English bill: English name only (no Sinhala name)
          nameEnglish: isSi ? (nameSi ? "" : nameEn) : nameEn,
          nameSinhala: isSi ? nameSi : "",
          qty: parseFloat(item.QUANTITY || 0).toFixed(3),
          // the real (retail) price of the product
          unitPrice: fmtMoney(item.UNITPRICE),
          // price AFTER the discount ({{discount}} = same, for old saved layouts)
          discount: fmtMoney(netUnitPrice(item)),
          netPrice: fmtMoney(netUnitPrice(item)),
          // the real discount amount of the line
          discountAmount: fmtMoney(item.DISCOUNT_AMOUNT),
          total: fmtMoney(item.TOTAL),
          refundTag: isRefundLine(item) ? L.refundTag : "",
          isRefund: isRefundLine(item),
        };
      }),
    };

    let tplHtml = useSaved ? relabelDiscountHeader(savedTpl.html) : billTpl.html;
    const tplCss = useSaved ? savedTpl.css : billTpl.css;
    if (isSi) tplHtml = translateTemplateHtml(tplHtml, hasSinhala(messageText));

    templateDoc = buildDocument({
      html: tplHtml,
      css: `${amilaFaceCss()}\n${tplCss || ""}${isSi ? `\n${siTemplateCss(siFontKey)}` : ""}`,
      paper: templatePaper,
      data: templateData,
    });
  }

  const handlePrint = () => {
    if (useTemplate) {
      printDocument(templateDoc, templatePaper);
    } else if (usePosPrinter) {
      printPos();
    } else {
      window.print();
    }
  };

  // The designer opens with the template TYPE of this company selected AND this very invoice
  // shown (?type=T1&docNo=...&company=...), so it shows the same details as this page.
  const designerUrl = `/invoice-template-designer?type=${encodeURIComponent(
    `T${billTpl.id}`
  )}&docNo=${encodeURIComponent(documentNo || "")}&company=${encodeURIComponent(
    invoiceData.companyCode || company || ""
  )}`;

  // Layout links under the print button (edit links only for users who may edit layouts)
  const layoutLinks = (
    <>
      {canEditTemplate && savedTpl && (
        <button
          onClick={() => setUseDefaultLayout((v) => !v)}
          className="text-gray-600 underline hover:text-black"
        >
          {useDefaultLayout ? "Use custom layout" : "Use default layout"}
        </button>
      )}
      {canEditTemplate && (
        <a
          href={designerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 underline hover:text-black"
        >
          Edit layout
        </a>
      )}
      <button
        onClick={() => setShowPrintSettings((v) => !v)}
        className="text-gray-600 underline hover:text-black"
      >
        Print settings
      </button>
    </>
  );

  // ---------- Html template view (designer layout or MODIFY_TYPE 2, 3 ...) ----------
  if (useTemplate) {
    return (
      <div className="w-full my-2 sm:my-4">
        <div className="overflow-x-auto">
          <div
            className="mx-auto bg-white border border-gray-300 shadow-lg"
            style={{ width: `${templatePaper.widthMm}mm` }}
          >
            <TemplatePreviewFrame docHtml={templateDoc} widthMm={templatePaper.widthMm} />
          </div>
        </div>

        <div className="px-3 pb-4 text-center sm:pb-6 no-print">
          <div className="mt-4">
            <BillLangSelect value={billLang} onChange={handleLangChange} />
            {isSi && <SinhalaFontSelect value={siFontKey} onChange={handleSiFontChange} />}
          </div>
          <button
            onClick={handlePrint}
            className="bg-black text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl text-base sm:text-xl hover:bg-gray-800 transition shadow-md w-full sm:w-auto"
          >
            🖨️ Print Invoice
          </button>
          <div className="flex justify-center gap-4 mt-3 text-sm">{layoutLinks}</div>
          {showPrintSettings && <PrintSettingsPanel />}
        </div>
      </div>
    );
  }

  // ---------- Built-in receipt (MODIFY_TYPE 1 / no type) ----------
  return (
    <div
      ref={receiptRef}
      className={`w-full sm:w-[420px] mx-auto my-2 sm:my-4 bg-white font-mono text-xs sm:text-sm leading-tight shadow-lg border border-gray-300 print-container ${
        isSi ? "bill-si" : ""
      }`}
    >
      {/* Header */}
      <div className="text-center py-2 sm:py-3 px-3 sm:px-4 border-b-2 border-dashed border-black">
        <h1 className="text-xl sm:text-2xl font-bold uppercase">{shopName}</h1>
        {shopAddress && <p className="text-xs sm:text-sm mt-1">{shopAddress}</p>}
        {shopTel !== "N/A" && (
          <p className="text-xs sm:text-sm mt-1">
            {LJ.tel} - {shopTel}
          </p>
        )}
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-1 text-xs sm:text-sm px-3 sm:px-4 py-2 border-b border-dashed border-black gap-1">
        {/* Cashier (left) + Invoice No (right) on the same line (Sinhala: may wrap) */}
        <div
          className={`flex items-baseline justify-between gap-x-2 info-row ${
            isSi ? "flex-wrap" : ""
          }`}
        >
          <span className="min-w-0 break-words">
            {LJ.cashier}: {invoiceData.cashierName || "CASHIER"}
          </span>
          <span className={isSi ? "" : "whitespace-nowrap"}>
            {LJ.invoiceNo}: {documentNo}
          </span>
        </div>
        <div className="break-words">
          {LJ.customer}: {customerLabel}
        </div>
      </div>

      {/* Items */}
      <div className="border-t-2 border-b-2 border-dashed border-black py-2 px-3 sm:px-4">
        <div className="border-b border-black pb-1 mb-1 font-bold text-[11px] items-head">
          <div className="text-left whitespace-nowrap">{LJ.product}</div>
          <div
            className="grid grid-cols-4 gap-x-2"
            style={isSi ? SI_GRID : undefined}
          >
            <div className="text-left whitespace-nowrap">{LJ.qty}</div>
            <div className="text-right whitespace-nowrap">{LJ.uprice}</div>
            <div className="text-right whitespace-nowrap">{LJ.price}</div>
            <div className="text-right whitespace-nowrap">{LJ.value}</div>
          </div>
        </div>

        {invoiceData.items.map((item, idx) => {
          const sinhalaName = String(item.PRODUCT_NAME_SINHALA || "").trim();
          return (
            <div key={idx} className="mb-2">
              <div className="font-bold text-[10px] sm:text-xs break-words">
                {item.PRODUCT_CODE}{" "}
                {isSi && sinhalaName ? (
                  // Sinhala bill: the Sinhala name (AMILA font)
                  <span className="amila-name" style={{ fontFamily: SINHALA_FONT }}>
                    {sinhalaName}
                  </span>
                ) : (
                  // English bill (or no Sinhala name): the English name only
                  item.PRODUCT_NAME
                )}
                {isRefundLine(item) ? LJ.refundTag : ""}
              </div>
              <div
                className="grid grid-cols-4 gap-x-2 text-[10px] sm:text-xs"
                style={isSi ? SI_GRID : undefined}
              >
                <div className="text-left">
                  {parseFloat(item.QUANTITY || 0).toFixed(3)}
                </div>
                <div className="text-right">
                  {parseFloat(item.UNITPRICE || 0).toFixed(2)}
                </div>
                <div className="text-right">
                  {netUnitPrice(item).toFixed(2)}
                </div>
                <div className="text-right font-bold">
                  {parseFloat(item.TOTAL || 0).toFixed(2)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals + Payment */}
      <div className="px-3 sm:px-4 text-xs sm:text-sm">
        <div className="flex justify-between border-b-2 border-dashed border-black py-1 font-bold">
          <span>{LJ.subTotal}</span>
          <span>{subTotal.toFixed(2)}</span>
        </div>

        {/* Refund items total (not part of the payment) */}
        {refundTotal < -0.001 && (
          <div className="flex justify-between py-1 font-bold">
            <span>{LJ.refundTotal}</span>
            <span>{refundTotal.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-base sm:text-lg mt-3 pos-big">
          <span>{LJ.cash}</span>
          <span>{cashAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-base sm:text-lg mt-1 pos-big">
          <span>{LJ.credit}</span>
          <span>{creditAmount.toFixed(2)}</span>
        </div>
        <div className="border-t-2 border-dotted border-black my-2"></div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 text-xs sm:text-sm px-3 sm:px-4 mt-2">
        <div>{LJ.pieces}</div>
        <div className="text-right">{noOfPieces.toFixed(3)}</div>
        <div>{LJ.products}</div>
        <div className="text-right">{invoiceData.items.length}</div>
      </div>

      {/* Date & Time (from tb_INVOICE_DETAILS; side by side, so screen / print / measuring all match) */}
      <div className="flex flex-row justify-between text-[10px] sm:text-xs px-3 sm:px-4 mt-3 pb-2 gap-1">
        <span className="whitespace-nowrap">
          {LJ.date} : {displayDate}
        </span>
        <span className="whitespace-nowrap">
          {LJ.endTime} : {displayTime}
        </span>
      </div>

      {/* Discount Box */}
      {totalDiscount > 0.001 && (
        <div className="text-center border-4 border-black py-2 sm:py-3 mx-4 sm:mx-8 my-3 font-bold text-base sm:text-xl pos-big">
          {LJ.totalDiscount}
          <br />
          {totalDiscount.toFixed(2)}
        </div>
      )}

      {/* Footer Message (English: each line stays on one line; Sinhala: may wrap) */}
      <div className="text-center text-xs sm:text-sm px-1 pb-2">
        {messageLines.length > 0 && (
          <div className="leading-snug mb-3 text-[10px] sm:text-xs pos-footer">
            {messageLines.map((line, i) => (
              <div key={i} className={isSi ? "" : "whitespace-nowrap"}>
                {isSi && hasSinhala(line) ? (
                  <span className="si-msg">{line}</span>
                ) : (
                  line
                )}
              </div>
            ))}
          </div>
        )}
        <p className="font-bold text-base sm:text-lg pos-big">{LJ.thanks}</p>
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
        <BillLangSelect value={billLang} onChange={handleLangChange} />
        {isSi && <SinhalaFontSelect value={siFontKey} onChange={handleSiFontChange} />}
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

        <div className="flex justify-center gap-4 mt-3 text-sm">{layoutLinks}</div>
        {showPrintSettings && <PrintSettingsPanel />}
      </div>

      {/* Print Styles: @page must be top-level (not inside @media) to take effect */}
      <style>{`
        ${amilaFaceCss()}
        ${sinhalaLabelCss(siFontKey)}
        .print-container .items-head, .print-container .items-head * { font-size: 11px !important; white-space: nowrap !important; }
        .print-container .items-head .si-t { font-size: 10.5px !important; }
        .print-container .amila-name { font-family: "AMILA", sans-serif !important; word-spacing: normal !important; }
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