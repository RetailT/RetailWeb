// ============================================================================
// Invoice template engine (shared by the designer page and the invoice preview)
//
// Template = HTML + CSS made in the GrapesJS designer. Placeholders:
//   {{shopName}} ...            -> replaced with invoice values
//   data-repeat="items"         -> the element is repeated for every invoice item
//   data-if="hasDiscount"       -> the element is shown only when the value is true / not empty
//   data-if="!isRefund"         -> "!" = show only when the value is false / empty
// ============================================================================

export const PAPER_TYPES = {
  POS80: { label: "POS printer 80mm", widthMm: 80 },
  POS58: { label: "POS printer 58mm", widthMm: 58 },
  A4: { label: "A4", widthMm: 190 }, // 210mm - 2 x 10mm page margin
  CUSTOM: { label: "Custom width (thermal)", widthMm: 80 },
};

// ---------------------------------------------------------------------------
// Print calibration (per computer / per printer, saved in this browser)
//   scalePct : printed page height = measured content height * scalePct / 100
//              blank paper at the bottom -> lower it  (e.g. 80)
//              bill cut off / goes to a 2nd page -> raise it (e.g. 100)
//   extraMm  : blank space kept after the last line (mm)
//   widthMm  : width of the printed content (mm). 0 = same as the paper width.
//              If the right side of the bill is cut off, use the printable width
//              of the printer (e.g. 72 for many 80mm printers).
// ---------------------------------------------------------------------------
const PRINT_SETTINGS_KEY = "posPrintSettings";

export const DEFAULT_PRINT_SETTINGS = { scalePct: 85, extraMm: 5, widthMm: 0 };

const clampNum = (v, min, max, fallback) => {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export const sanitizePrintSettings = (s = {}) => {
  const d = DEFAULT_PRINT_SETTINGS;
  const w = Number(s.widthMm);
  return {
    scalePct: clampNum(s.scalePct, 50, 150, d.scalePct),
    extraMm: clampNum(s.extraMm, 0, 60, d.extraMm),
    widthMm: w >= 40 && w <= 300 ? w : 0,
  };
};

export const getPrintSettings = () => {
  try {
    const raw = localStorage.getItem(PRINT_SETTINGS_KEY);
    return sanitizePrintSettings(raw ? JSON.parse(raw) : {});
  } catch (e) {
    return { ...DEFAULT_PRINT_SETTINGS };
  }
};

export const savePrintSettings = (s) => {
  const clean = sanitizePrintSettings(s);
  try {
    localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(clean));
  } catch (e) {}
  return clean;
};

export const normalizePaper = (p = {}) => {
  const rawType = p.paperType || p.type;
  const type = PAPER_TYPES[rawType] ? rawType : "POS80";
  let widthMm = Number(p.paperWidthMm ?? p.widthMm);
  if (type !== "CUSTOM" || !(widthMm >= 30 && widthMm <= 300)) {
    widthMm = PAPER_TYPES[type].widthMm;
  }
  let paddingMm = Number(p.paddingMm);
  if (!(paddingMm >= 0 && paddingMm <= 20)) paddingMm = 3;
  return { type, widthMm, paddingMm };
};

// Base page CSS: the template CSS comes AFTER this, so the template can override it
export const baseCss = (paperInput) => {
  const p = normalizePaper(paperInput);
  const isA4 = p.type === "A4";
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      width: ${p.widthMm}mm;
      padding: ${isA4 ? "0" : `2mm ${p.paddingMm}mm`};
      font-family: "Courier New", Courier, monospace;
      font-size: 11px;
      line-height: 1.25;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    img { max-width: 100%; }
  `;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// The backend can fail now and then (it opens / closes ONE shared DB connection per
// request), so try up to 3 times. Only network / 5xx errors are retried.
export const withRetry = async (fn, tries = 3) => {
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

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

const fill = (str, scope) =>
  str.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => {
    const v = scope[key];
    if (v === undefined || v === null || typeof v === "object") return "";
    const s = esc(v);
    return key === "message" ? s.replace(/\r?\n/g, "<br>") : s;
  });

const truthy = (scope, expr) => {
  const neg = expr.startsWith("!");
  const key = neg ? expr.slice(1) : expr;
  const v = scope[key];
  const t = Array.isArray(v) ? v.length > 0 : !!v;
  return neg ? !t : t;
};

// Templates are written by designers but shown to every cashier -> strip anything active
const sanitize = (root) => {
  root
    .querySelectorAll("script,iframe,object,embed,link,meta,base,form,style")
    .forEach((n) => n.remove());
  root.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((a) => {
      const n = a.name.toLowerCase();
      const v = String(a.value).replace(/\s/g, "").toLowerCase();
      if (n.startsWith("on")) {
        el.removeAttribute(a.name);
      } else if (
        ["href", "src", "action", "formaction", "xlink:href"].includes(n) &&
        /^(javascript:|vbscript:|data:text\/html)/.test(v)
      ) {
        el.removeAttribute(a.name);
      }
    });
  });
};

// returns false when the element itself was removed by its own data-if
const applyIfs = (root, scope) => {
  if (root.hasAttribute("data-if")) {
    if (!truthy(scope, root.getAttribute("data-if"))) return false;
    root.removeAttribute("data-if");
  }
  Array.from(root.querySelectorAll("[data-if]")).forEach((n) => {
    if (truthy(scope, n.getAttribute("data-if"))) n.removeAttribute("data-if");
    else n.remove();
  });
  return true;
};

// ---------------------------------------------------------------------------
// Rendering (real print / preview)
// ---------------------------------------------------------------------------
export const renderTemplate = (html, data) => {
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${html || ""}</body></html>`,
    "text/html"
  );
  const body = doc.body;
  sanitize(body);

  // 1) repeated blocks (invoice items)
  Array.from(body.querySelectorAll("[data-repeat]")).forEach((el) => {
    const key = el.getAttribute("data-repeat");
    const list = Array.isArray(data[key]) ? data[key] : [];
    const parent = el.parentNode;
    if (!parent) return;

    list.forEach((item) => {
      const scope = { ...data, ...item };
      const clone = el.cloneNode(true);
      clone.removeAttribute("data-repeat");
      if (!applyIfs(clone, scope)) return;
      // <template> keeps <tr> / <td> intact
      const tpl = doc.createElement("template");
      tpl.innerHTML = fill(clone.outerHTML, scope);
      parent.insertBefore(tpl.content, el);
    });
    el.remove();
  });

  // 2) conditions outside the repeated blocks
  Array.from(body.querySelectorAll("[data-if]")).forEach((n) => {
    if (truthy(data, n.getAttribute("data-if"))) n.removeAttribute("data-if");
    else n.remove();
  });

  // 3) placeholders
  return fill(body.innerHTML, data);
};

export const buildDocument = ({ html, css, paper, data }) => {
  const p = normalizePaper(paper);
  const bodyHtml = renderTemplate(html, data);
  const safeCss = String(css || "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/<\/style/gi, "");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(
    p
  )}</style><style>${safeCss}</style></head><body>${bodyHtml}</body></html>`;
};

// ---------------------------------------------------------------------------
// Designer helpers: show REAL values in the designer, save {{placeholders}}
//   toDesignerHtml       {{cashier}}  ->  <span data-field="cashier">Admin</span>
//   fieldsToPlaceholders <span data-field="cashier">Admin</span>  ->  {{cashier}}
// Inside a data-repeat row the values of the FIRST item are used.
// ---------------------------------------------------------------------------
export const toDesignerHtml = (html, data) => {
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${html || ""}</body></html>`,
    "text/html"
  );
  const body = doc.body;
  const firstItem = (Array.isArray(data.items) && data.items[0]) || {};

  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const text = node.nodeValue || "";
    if (!/\{\{\s*\w+\s*\}\}/.test(text)) return;

    const inRepeat = node.parentElement && node.parentElement.closest("[data-repeat]");
    const scope = inRepeat ? { ...data, ...firstItem } : data;

    const frag = doc.createDocumentFragment();
    const re = /\{\{\s*(\w+)\s*\}\}/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));

      const key = m[1];
      const span = doc.createElement("span");
      span.setAttribute("data-field", key);

      const v = scope[key];
      const empty =
        v === undefined || v === null || typeof v === "object" || String(v) === "";
      const shown = empty ? `{{${key}}}` : String(v);
      shown.split(/\r?\n/).forEach((line, i) => {
        if (i > 0) span.appendChild(doc.createElement("br"));
        span.appendChild(doc.createTextNode(line));
      });

      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });

  return body.innerHTML;
};

export const fieldsToPlaceholders = (html) => {
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${html || ""}</body></html>`,
    "text/html"
  );
  const body = doc.body;
  body.querySelectorAll("[data-field]").forEach((el) => {
    el.replaceWith(doc.createTextNode(`{{${el.getAttribute("data-field")}}}`));
  });
  return body.innerHTML;
};

// ---------------------------------------------------------------------------
// Printing: hidden iframe -> exact page size -> print dialog
// Uses the print calibration of this computer (see getPrintSettings above)
// ---------------------------------------------------------------------------
export const printDocument = async (docHtml, paperInput) => {
  const p = normalizePaper(paperInput);
  const isA4 = p.type === "A4";
  const ps = getPrintSettings();

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("sandbox", "allow-same-origin allow-modals");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${
    isA4 ? 210 : p.widthMm
  }mm;height:2000px;border:0;visibility:hidden;`;

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  try {
    await new Promise((resolve) => {
      iframe.onload = resolve;
      iframe.srcdoc = docHtml;
      document.body.appendChild(iframe);
    });

    const doc = iframe.contentDocument;

    // wait for logo images + fonts
    const imgs = Array.from(doc.images || []).map((img) =>
      img.complete
        ? null
        : new Promise((r) => {
            img.onload = r;
            img.onerror = r;
          })
    );
    await Promise.race([
      Promise.all(imgs),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    try {
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
    } catch (e) {}

    let pageCss;
    if (isA4) {
      pageCss = "@page { size: A4; margin: 10mm; }";
    } else {
      // printable width of this printer (0 = same as the paper)
      const printW = ps.widthMm > 0 ? ps.widthMm : p.widthMm;
      const widthStyle = doc.createElement("style");
      widthStyle.textContent = `body { width: ${printW}mm !important; margin: 0 auto !important; }`;
      doc.head.appendChild(widthStyle);
      await new Promise((r) => setTimeout(r, 100)); // let layout settle

      const px = Math.ceil(doc.body.getBoundingClientRect().height);
      const mm =
        Math.ceil(((px * 25.4) / 96) * (ps.scalePct / 100)) + ps.extraMm;
      pageCss = `@page { size: ${p.widthMm}mm ${mm}mm; margin: 0; }`;
    }

    const st = doc.createElement("style");
    st.textContent = `${pageCss} html, body { margin-top: 0 !important; }`;
    doc.head.appendChild(st);

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (err) {
    console.error("Template print failed:", err);
  } finally {
    setTimeout(cleanup, 1500);
  }
};

// ---------------------------------------------------------------------------
// Real invoice (API response of get-invoice-preview) -> template data
// (same values / formats as the invoice preview page)
// ---------------------------------------------------------------------------
export const DEFAULT_MESSAGE =
  "WE ARE HAPPY TO EXCHANGE PRODUCTS RETURNED IN\nSALEABLE CONDITION. ALONG WITH RECEIPT.";

const formatDocDate = (value) => {
  if (!value) return "";
  const m = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
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

const isRefundLine = (item) =>
  String(item.REFUND || "").toUpperCase() === "T" ||
  (parseFloat(item.QUANTITY) || 0) < 0;

const fmtMoney = (n) =>
  (Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const buildTemplateData = (inv, documentNo) => {
  const list = inv.items || [];
  const sum = (fn) => list.reduce((s, it) => s + fn(it), 0);

  const subTotal = sum((it) => (isRefundLine(it) ? 0 : parseFloat(it.TOTAL || 0)));
  const refundTotal = sum((it) => (isRefundLine(it) ? parseFloat(it.TOTAL || 0) : 0));
  const totalDiscount = sum((it) => parseFloat(it.DISCOUNT_AMOUNT || 0));
  const noOfPieces = sum((it) => parseFloat(it.QUANTITY || 0));

  const hasPay =
    inv.cashAmount !== null &&
    inv.cashAmount !== undefined &&
    inv.creditAmount !== null &&
    inv.creditAmount !== undefined;
  const cash = hasPay ? parseFloat(inv.cashAmount) || 0 : 0;
  const credit = hasPay ? parseFloat(inv.creditAmount) || 0 : subTotal;

  const code = String(inv.customerCode || "").trim();
  const name = String(inv.customerName || "").trim();
  const customer =
    code && name && code.toUpperCase() !== name.toUpperCase()
      ? `${code} ${name}`
      : code || name || "WALK-IN";

  return {
    shopName: (inv.companyName || "").trim() || "SHOP NAME",
    shopAddress: (inv.address || "").trim(),
    shopTel: (inv.phone || "").trim(),
    cashier: inv.cashierName || "CASHIER",
    invoiceNo: documentNo,
    customer,
    date: formatDocDate(inv.documentDate) || new Date().toLocaleDateString("en-GB"),
    time:
      formatDocTime(inv.documentTime) ||
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    subTotal: fmtMoney(subTotal),
    refundTotal: fmtMoney(refundTotal),
    cash: fmtMoney(cash),
    credit: fmtMoney(credit),
    totalDiscount: fmtMoney(totalDiscount),
    noOfPieces: noOfPieces.toFixed(3),
    noOfProducts: String(list.length),
    message: inv.message && inv.message.trim() ? inv.message : DEFAULT_MESSAGE,
    hasRefund: refundTotal < -0.001,
    hasDiscount: totalDiscount > 0.001,
    items: list.map((item) => ({
      code: String(item.PRODUCT_CODE || "").trim(),
      name: String(item.PRODUCT_NAME || "").trim(),
      qty: parseFloat(item.QUANTITY || 0).toFixed(3),
      unitPrice: fmtMoney(item.UNITPRICE),
      discount: fmtMoney(item.DISCOUNT_AMOUNT),
      total: fmtMoney(item.TOTAL),
      refundTag: isRefundLine(item) ? " (REFUND)" : "",
      isRefund: isRefundLine(item),
    })),
  };
};

// ---------------------------------------------------------------------------
// Sample data (used only when the company has no saved invoice yet)
// ---------------------------------------------------------------------------
export const SAMPLE_DATA = {
  shopName: "SAMPLE SHOP",
  shopAddress: "No 10, Main Street, Kalutara",
  shopTel: "034 1234567",
  cashier: "ADMIN",
  invoiceNo: "0100000123",
  customer: "C001 WALK-IN CUSTOMER",
  date: "22/10/2026",
  time: "09:45 PM",
  subTotal: "5,350.00",
  refundTotal: "-450.00",
  cash: "3,000.00",
  credit: "2,350.00",
  totalDiscount: "250.00",
  noOfPieces: "4.000",
  noOfProducts: "3",
  message:
    "WE ARE HAPPY TO EXCHANGE PRODUCTS RETURNED IN\nSALEABLE CONDITION. ALONG WITH RECEIPT.",
  hasRefund: true,
  hasDiscount: true,
  items: [
    { code: "100010000277", name: "TUX NOVA OVERSIZED", qty: "1.000", unitPrice: "2,500.00", discount: "125.00", total: "2,375.00", refundTag: "", isRefund: false },
    { code: "100010000223", name: "APEX MESH TOP", qty: "2.000", unitPrice: "1,500.00", discount: "125.00", total: "2,875.00", refundTag: "", isRefund: false },
    { code: "300010000003", name: "LINT ROLLER", qty: "-1.000", unitPrice: "450.00", discount: "0.00", total: "-450.00", refundTag: " (REFUND)", isRefund: true },
  ],
};

// ---------------------------------------------------------------------------
// Starter layout (same look as the old built-in receipt)
// ---------------------------------------------------------------------------
export const STARTER_HTML = `
<div class="hdr">
  <div class="shop">{{shopName}}</div>
  <div data-if="shopAddress">{{shopAddress}}</div>
  <div data-if="shopTel">TEL - {{shopTel}}</div>
</div>
<div class="sec">
  <div class="row"><span>CASHIER: {{cashier}}</span><span>INVOICE NO: {{invoiceNo}}</span></div>
  <div>CUSTOMER: {{customer}}</div>
</div>
<div class="items">
  <div class="ihead">
    <div>PRODUCT</div>
    <div class="cols"><div class="col l">QTY</div><div class="col r">U/PRICE</div><div class="col r">DISC</div><div class="col r">VALUE</div></div>
  </div>
  <div class="irow" data-repeat="items">
    <div class="b">{{code}} {{name}}{{refundTag}}</div>
    <div class="cols"><div class="col l">{{qty}}</div><div class="col r">{{unitPrice}}</div><div class="col r">{{discount}}</div><div class="col r b">{{total}}</div></div>
  </div>
</div>
<div class="tots">
  <div class="row b line"><span>SUB TOTAL</span><span>{{subTotal}}</span></div>
  <div class="row b" data-if="hasRefund"><span>REFUND TOTAL</span><span>{{refundTotal}}</span></div>
  <div class="row b big"><span>CASH</span><span>{{cash}}</span></div>
  <div class="row b big"><span>CREDIT</span><span>{{credit}}</span></div>
</div>
<div class="sum">
  <div class="row"><span>NO OF PIECES</span><span>{{noOfPieces}}</span></div>
  <div class="row"><span>NO OF PRODUCTS</span><span>{{noOfProducts}}</span></div>
</div>
<div class="row small dt"><span>DATE : {{date}}</span><span>END TIME : {{time}}</span></div>
<div class="disc b" data-if="hasDiscount">YOU HAVE TOTAL DISCOUNT<br>{{totalDiscount}}</div>
<div class="foot">{{message}}</div>
<div class="center b big">THANK YOU COME AGAIN</div>
<div class="sign center small"><div class="b">© Retail Target Software Solutions (Pvt) Ltd</div><div>+94 76 3 165700 / +94 76 3 165701</div></div>
`;

export const STARTER_CSS = `
.hdr { text-align: center; border-bottom: 2px dashed #000; padding: 4px 0; }
.shop { font-size: 18px; font-weight: 700; text-transform: uppercase; margin: 2px 0; }
.sec { border-bottom: 1px dashed #000; padding: 4px 0; }
.row { display: flex; justify-content: space-between; gap: 6px; }
.items { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 4px 0; margin-top: 2px; }
.ihead { border-bottom: 1px solid #000; font-weight: 700; margin-bottom: 3px; padding-bottom: 2px; }
.irow { margin-bottom: 5px; }
.cols { display: flex; }
.col { flex: 1; }
.l { text-align: left; }
.r { text-align: right; }
.b { font-weight: 700; }
.line { border-bottom: 2px dashed #000; padding: 2px 0; }
.big { font-size: 13px; margin-top: 3px; }
.tots { margin-top: 2px; }
.sum { border-top: 2px dotted #000; margin-top: 6px; padding-top: 4px; }
.small { font-size: 9px; }
.dt { margin-top: 6px; }
.disc { text-align: center; border: 2px solid #000; padding: 6px 4px; margin: 8px 10px; font-size: 13px; }
.foot { text-align: center; font-size: 9px; margin: 6px 0; }
.center { text-align: center; }
.sign { border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; }
`;