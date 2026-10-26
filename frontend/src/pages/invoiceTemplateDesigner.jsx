import { useContext, useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import { AuthContext } from "../AuthContext";
import {
  PAPER_TYPES,
  normalizePaper,
  baseCss,
  buildDocument,
  printDocument,
  withRetry,
  buildTemplateData,
  toDesignerHtml,
  fieldsToPlaceholders,
  STARTER_HTML,
  STARTER_CSS,
  SAMPLE_DATA,
} from "../utils/invoiceTemplate";

const DEFAULT_PAPER = { type: "POS80", widthMm: 80, paddingMm: 3 };

// Canvas = same base CSS as the real print + a grey background around the paper.
// Live data fields (real values from the selected invoice) get an orange highlight.
const canvasCss = (paper) => `
  ${baseCss(paper)}
  html { background: #cfcfcf !important; padding: 12px 0; }
  body { margin: 0 auto !important; min-height: 80mm; background: #fff; box-shadow: 0 0 6px rgba(0,0,0,.35); }
  [data-field] { background: rgba(241,126,33,.22); outline: 1px dotted rgba(241,126,33,.9); }
`;

const rowHtml = (left, right, extra = "", attrs = "") =>
  `<div ${attrs} style="display:flex;justify-content:space-between;gap:6px;${extra}"><span>${left}</span><span>${right}</span></div>`;

// [id, label, html]
const FIELD_BLOCKS = [
  ["f-shopName", "Shop Name", `<div style="text-align:center;font-size:18px;font-weight:700;text-transform:uppercase">{{shopName}}</div>`],
  ["f-shopAddress", "Address", `<div data-if="shopAddress" style="text-align:center">{{shopAddress}}</div>`],
  ["f-shopTel", "Tel", `<div data-if="shopTel" style="text-align:center">TEL - {{shopTel}}</div>`],
  ["f-cashier", "Cashier", `<div>CASHIER: {{cashier}}</div>`],
  ["f-invoiceNo", "Invoice No", `<div>INVOICE NO: {{invoiceNo}}</div>`],
  ["f-customer", "Customer", `<div>CUSTOMER: {{customer}}</div>`],
  ["f-date", "Date", `<div>DATE : {{date}}</div>`],
  ["f-time", "Time", `<div>END TIME : {{time}}</div>`],
  ["f-subTotal", "Sub Total", rowHtml("SUB TOTAL", "{{subTotal}}", "font-weight:700")],
  ["f-refundTotal", "Refund Total", rowHtml("REFUND TOTAL", "{{refundTotal}}", "font-weight:700", `data-if="hasRefund"`)],
  ["f-cash", "Cash", rowHtml("CASH", "{{cash}}", "font-weight:700;font-size:13px")],
  ["f-credit", "Credit", rowHtml("CREDIT", "{{credit}}", "font-weight:700;font-size:13px")],
  ["f-pieces", "No of Pieces", rowHtml("NO OF PIECES", "{{noOfPieces}}")],
  ["f-products", "No of Products", rowHtml("NO OF PRODUCTS", "{{noOfProducts}}")],
  ["f-discountBox", "Discount Box", `<div data-if="hasDiscount" style="text-align:center;border:2px solid #000;padding:6px 4px;margin:8px 10px;font-weight:700;font-size:13px">YOU HAVE TOTAL DISCOUNT<br/>{{totalDiscount}}</div>`],
  ["f-message", "Footer Message", `<div style="text-align:center;font-size:9px">{{message}}</div>`],
];

const ITEMS_2LINE = `
<div style="border-top:2px dashed #000;border-bottom:2px dashed #000;padding:4px 0">
  <div style="border-bottom:1px solid #000;font-weight:700;margin-bottom:3px;padding-bottom:2px">
    <div>PRODUCT</div>
    <div style="display:flex">
      <div style="flex:1;text-align:left">QTY</div>
      <div style="flex:1;text-align:right">U/PRICE</div>
      <div style="flex:1;text-align:right">DISC</div>
      <div style="flex:1;text-align:right">VALUE</div>
    </div>
  </div>
  <div data-repeat="items" style="margin-bottom:5px">
    <div style="font-weight:700">{{code}} {{name}}{{refundTag}}</div>
    <div style="display:flex">
      <div style="flex:1;text-align:left">{{qty}}</div>
      <div style="flex:1;text-align:right">{{unitPrice}}</div>
      <div style="flex:1;text-align:right">{{discount}}</div>
      <div style="flex:1;text-align:right;font-weight:700">{{total}}</div>
    </div>
  </div>
</div>`;

const ITEMS_TABLE = `
<table style="width:100%;border-collapse:collapse">
  <thead>
    <tr>
      <th style="text-align:left;border-bottom:1px solid #000">ITEM</th>
      <th style="text-align:right;border-bottom:1px solid #000">QTY</th>
      <th style="text-align:right;border-bottom:1px solid #000">PRICE</th>
      <th style="text-align:right;border-bottom:1px solid #000">VALUE</th>
    </tr>
  </thead>
  <tbody>
    <tr data-repeat="items">
      <td style="text-align:left">{{name}}{{refundTag}}</td>
      <td style="text-align:right">{{qty}}</td>
      <td style="text-align:right">{{unitPrice}}</td>
      <td style="text-align:right">{{total}}</td>
    </tr>
  </tbody>
</table>`;

// (Re)registers the blocks. Field blocks are dropped with REAL values of the selected invoice.
const registerBlocks = (ed, data) => {
  if (!ed) return;
  const bm = ed.Blocks;
  const add = (id, def) => {
    if (bm.get(id)) bm.remove(id);
    bm.add(id, def);
  };
  const D = (html) => toDesignerHtml(html, data);

  add("b-text", {
    label: "Text box",
    category: "Basic",
    content: `<div style="padding:2px 0">Text</div>`,
  });
  add("b-logo", {
    label: "Logo / Image",
    category: "Basic",
    content: {
      type: "image",
      style: { display: "block", margin: "0 auto", width: "40mm" },
      attributes: { alt: "logo" },
      activeOnRender: 1,
    },
  });
  add("b-row", {
    label: "Row (2 columns)",
    category: "Basic",
    content: `<div style="display:flex;justify-content:space-between;gap:6px"><div style="flex:1">Left</div><div style="flex:1;text-align:right">Right</div></div>`,
  });
  add("b-divider", {
    label: "Dashed line",
    category: "Basic",
    content: `<div style="border-top:1px dashed #000;margin:4px 0;min-height:2px"></div>`,
  });
  add("b-spacer", {
    label: "Blank space",
    category: "Basic",
    content: `<div style="height:8mm"></div>`,
  });

  add("i-2line", { label: "Items (2 lines)", category: "Items", content: D(ITEMS_2LINE) });
  add("i-table", { label: "Items (table)", category: "Items", content: D(ITEMS_TABLE) });

  FIELD_BLOCKS.forEach(([id, label, html]) => {
    add(id, { label, category: "Invoice fields", content: D(html) });
  });
};

const FIELD_HELP = [
  "shopName", "shopAddress", "shopTel", "cashier", "invoiceNo", "customer",
  "date", "time", "subTotal", "refundTotal", "cash", "credit", "totalDiscount",
  "noOfPieces", "noOfProducts", "message",
];
const ITEM_HELP = ["code", "name", "qty", "unitPrice", "discount", "total", "refundTag"];

const InvoiceTemplateDesigner = () => {
  const { authToken } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem("authToken");

  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const canvasStyleRef = useRef(null);
  const designDataRef = useRef(SAMPLE_DATA);
  const companiesRef = useRef([]);
  // All backend calls of this page go one after the other (the backend shares ONE DB connection)
  const queueRef = useRef(Promise.resolve());

  const [editorReady, setEditorReady] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [company, setCompany] = useState(searchParams.get("company") || "*");
  const [paper, setPaper] = useState(DEFAULT_PAPER);
  const [invoiceNos, setInvoiceNos] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [status, setStatus] = useState(null); // { type: info|success|error, msg }
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  // true while the editor / companies / layout / invoice data are loading
  const [layoutLoading, setLayoutLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };
  const BACKEND = process.env.REACT_APP_BACKEND_URL;
  const apiUrl = `${BACKEND}invoice-template`;

  // run one backend call at a time (with retry)
  const api = (fn) => {
    const run = () => withRetry(fn);
    const p = queueRef.current.then(run);
    queueRef.current = p.catch(() => {});
    return p;
  };

  // "*" (all companies) has no invoices of its own -> use the first company's invoices
  const getListCompany = () =>
    company === "*" ? companiesRef.current[0]?.code || "" : company;

  // ---------- GrapesJS init (once) ----------
  useEffect(() => {
    if (!containerRef.current) return undefined;

    const ed = grapesjs.init({
      container: containerRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false,
      // logo upload -> stored inside the template as base64 (no file server needed)
      assetManager: { embedAsBase64: true, upload: false },
      selectorManager: { componentFirst: true },
    });
    editorRef.current = ed;

    registerBlocks(ed, SAMPLE_DATA);

    // canvas: paper style (canvas only, not saved)
    ed.on("load", () => {
      const doc = ed.Canvas.getDocument();
      if (doc) {
        const st = doc.createElement("style");
        doc.head.appendChild(st);
        canvasStyleRef.current = st;
        st.textContent = canvasCss(DEFAULT_PAPER);
      }
      setEditorReady(true);
    });

    ed.on("update", () => setDirty(true));

    return () => {
      try {
        ed.destroy();
      } catch (e) {}
      editorRef.current = null;
      canvasStyleRef.current = null;
      setEditorReady(false);
    };
  }, []);

  // ---------- paper change -> canvas ----------
  useEffect(() => {
    if (canvasStyleRef.current) {
      canvasStyleRef.current.textContent = canvasCss(normalizePaper(paper));
    }
  }, [paper, editorReady]);

  // ---------- companies ----------
  useEffect(() => {
    if (!token) {
      setCompaniesLoaded(true);
      return;
    }
    (async () => {
      try {
        const res = await api(() =>
          axios.get(`${BACKEND}companies`, { headers })
        );
        const list = (res.data.userData || [])
          .map((c) => ({
            code: c.COMPANY_CODE ? c.COMPANY_CODE.trim() : "",
            name: c.COMPANY_NAME ? c.COMPANY_NAME.trim() : "",
          }))
          .filter((c) => c.code);
        companiesRef.current = list;
        setCompanies(list);
      } catch (e) {
        console.warn("Companies could not be loaded");
      } finally {
        setCompaniesLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Put a template (placeholders) into the designer, showing the REAL values of `data`
  const setEditorContent = (html, css, data, markDirty = false) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.setComponents(toDesignerHtml(html, data));
    ed.setStyle(css || "");
    setTimeout(() => setDirty(markDirty), 400);
  };

  // ---------- load: template -> invoice list -> latest invoice (one after the other) ----------
  useEffect(() => {
    if (!editorReady || !companiesLoaded || !company) return undefined;
    let cancelled = false;

    (async () => {
      try {
        setLayoutLoading(true);
        setStatus(null);

        const tRes = await api(() =>
          axios.get(apiUrl, { headers, params: { company, exact: "1" } })
        );
        if (cancelled) return;
        const t = tRes.data.template;
        if (t) {
          setPaper({ type: t.paperType, widthMm: t.paperWidthMm, paddingMm: t.paddingMm });
        } else {
          setPaper(DEFAULT_PAPER);
        }

        // real invoice data
        const listCompany = getListCompany();
        let nos = [];
        let data = SAMPLE_DATA;
        let usedNo = "";

        if (listCompany) {
          try {
            const nRes = await api(() =>
              axios.get(`${BACKEND}saved-invoice-numbers`, {
                headers,
                params: { company: listCompany },
              })
            );
            if (cancelled) return;
            nos = nRes.data?.invoices || [];

            if (nos.length > 0) {
              const iRes = await api(() =>
                axios.get(`${BACKEND}get-invoice-preview`, {
                  headers,
                  params: { documentNo: nos[0], company: listCompany },
                })
              );
              if (cancelled) return;
              if (iRes.data?.success) {
                data = buildTemplateData(iRes.data.invoice, nos[0]);
                usedNo = nos[0];
              }
            }
          } catch (e) {
            console.warn("Real invoice data could not be loaded, using sample data");
          }
        }
        if (cancelled) return;

        setInvoiceNos(nos);
        setInvoiceNo(usedNo);
        designDataRef.current = data;
        registerBlocks(editorRef.current, data);
        setEditorContent(
          t && t.html ? t.html : STARTER_HTML,
          t && t.css ? t.css : STARTER_CSS,
          data
        );

        const layoutMsg = t
          ? "Saved layout loaded."
          : "No saved layout yet, the starter layout is loaded: edit it and press Save.";
        const dataMsg = usedNo
          ? `Showing the data of invoice ${usedNo}.`
          : "No saved invoice found, sample data is shown.";
        setStatus({ type: t ? "success" : "info", msg: `${layoutMsg} ${dataMsg}` });
        setLayoutLoading(false);
      } catch (err) {
        if (cancelled) return;
        setStatus({
          type: "error",
          msg: err.response?.data?.message || "Failed to load the layout",
        });
        setLayoutLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorReady, companiesLoaded, company]);

  // ---------- warn when leaving with unsaved changes ----------
  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  // ---------- actions ----------
  const handleCompanyChange = (e) => {
    if (dirty && !window.confirm("You have unsaved changes. Switch company anyway?")) {
      return;
    }
    setCompany(e.target.value);
  };

  // Another invoice selected -> same design, other real values
  const handleInvoiceChange = async (no) => {
    const ed = editorRef.current;
    if (!ed || !no) return;
    setInvoiceNo(no);

    try {
      const res = await api(() =>
        axios.get(`${BACKEND}get-invoice-preview`, {
          headers,
          params: { documentNo: no, company: getListCompany() },
        })
      );
      if (!res.data?.success) return;

      const data = buildTemplateData(res.data.invoice, no);
      const wasDirty = dirty;
      const html = fieldsToPlaceholders(ed.getHtml());
      const css = ed.getCss({ avoidProtected: true });

      designDataRef.current = data;
      registerBlocks(ed, data);
      ed.setComponents(toDesignerHtml(html, data));
      ed.setStyle(css);
      setTimeout(() => setDirty(wasDirty), 400);
    } catch (err) {
      setStatus({
        type: "error",
        msg: err.response?.data?.message || "Failed to load the invoice",
      });
    }
  };

  const handleSave = async () => {
    const ed = editorRef.current;
    if (!ed || !company) return;

    const p = normalizePaper(paper);
    const payload = {
      company,
      paperType: p.type,
      paperWidthMm: p.widthMm,
      paddingMm: p.paddingMm,
      // real values -> back to {{placeholders}} before saving
      html: fieldsToPlaceholders(ed.getHtml()),
      css: ed.getCss({ avoidProtected: true }),
      projectJson: "",
    };

    const bytes = new Blob([JSON.stringify(payload)]).size;
    if (bytes > 3.5 * 1024 * 1024) {
      setStatus({
        type: "error",
        msg: "Template is too large. Use a smaller logo image (under ~500 KB).",
      });
      return;
    }

    try {
      setSaving(true);
      await api(() => axios.post(apiUrl, payload, { headers }));
      setDirty(false);
      setStatus({
        type: "success",
        msg:
          company === "*"
            ? "Saved as the default layout for all companies."
            : `Saved for company ${company}.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        msg: err.response?.data?.message || "Failed to save the layout",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToStarter = () => {
    if (!window.confirm("Replace the current design with the starter layout?")) return;
    setEditorContent(STARTER_HTML, STARTER_CSS, designDataRef.current || SAMPLE_DATA, true);
  };

  const handleDeleteSaved = async () => {
    if (
      !window.confirm(
        "Remove the saved layout of this company? Invoices will use the default layout again."
      )
    ) {
      return;
    }
    try {
      await api(() => axios.delete(apiUrl, { headers, params: { company } }));
      setEditorContent(STARTER_HTML, STARTER_CSS, designDataRef.current || SAMPLE_DATA);
      setPaper(DEFAULT_PAPER);
      setStatus({ type: "success", msg: "Saved layout removed." });
    } catch (err) {
      setStatus({
        type: "error",
        msg: err.response?.data?.message || "Failed to remove the layout",
      });
    }
  };

  const handlePreview = () => {
    const ed = editorRef.current;
    if (!ed) return;
    setPreviewDoc(
      buildDocument({
        html: fieldsToPlaceholders(ed.getHtml()),
        css: ed.getCss({ avoidProtected: true }),
        paper: normalizePaper(paper),
        data: designDataRef.current || SAMPLE_DATA,
      })
    );
  };

  const statusColor =
    status?.type === "error"
      ? "text-red-600"
      : status?.type === "success"
      ? "text-green-700"
      : "text-gray-600";

  const p = normalizePaper(paper);

  return (
    <div>
      <Navbar />
      <div className="px-3 pb-6 sm:px-6 mt-28">
        <Heading text="Invoice Template Designer" />

        {/* Toolbar */}
        <div className="flex flex-wrap items-end gap-3 p-3 mt-4 mb-3 bg-[#d8d8d8] rounded-md">
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-700">Company</label>
            <select
              value={company}
              onChange={handleCompanyChange}
              className="p-2 text-sm bg-white border border-gray-300 rounded-md min-w-[220px]"
            >
              <option value="*">* All companies (default)</option>
              {companies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-700">Show data of invoice</label>
            <select
              value={invoiceNo}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              disabled={invoiceNos.length === 0}
              className="p-2 text-sm bg-white border border-gray-300 rounded-md min-w-[160px]"
            >
              {invoiceNos.length === 0 ? (
                <option value="">Sample data</option>
              ) : (
                invoiceNos.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-gray-700">Paper</label>
            <select
              value={paper.type}
              onChange={(e) => setPaper({ ...paper, type: e.target.value })}
              className="p-2 text-sm bg-white border border-gray-300 rounded-md"
            >
              {Object.entries(PAPER_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {paper.type === "CUSTOM" && (
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-medium text-gray-700">Width (mm)</label>
              <input
                type="number"
                min="30"
                max="300"
                value={paper.widthMm}
                onChange={(e) => setPaper({ ...paper, widthMm: e.target.value })}
                className="w-24 p-2 text-sm bg-white border border-gray-300 rounded-md"
              />
            </div>
          )}

          {paper.type !== "A4" && (
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-medium text-gray-700">Side margin (mm)</label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={paper.paddingMm}
                onChange={(e) => setPaper({ ...paper, paddingMm: e.target.value })}
                className="w-24 p-2 text-sm bg-white border border-gray-300 rounded-md"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              onClick={() => editorRef.current?.UndoManager.undo()}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Undo
            </button>
            <button
              onClick={() => editorRef.current?.UndoManager.redo()}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Redo
            </button>
            <button
              onClick={handleResetToStarter}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Starter layout
            </button>
            <button
              onClick={handleDeleteSaved}
              className="px-3 py-2 text-sm text-red-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Remove saved
            </button>
            <button
              onClick={handlePreview}
              className="px-3 py-2 text-sm text-white bg-gray-700 rounded-md hover:bg-gray-800"
            >
              Preview / Test print
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-5 py-2 text-sm text-white bg-[#f17e21] rounded-md hover:bg-[#efa05f] ${
                saving ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {saving ? "Saving..." : dirty ? "Save *" : "Save"}
            </button>
          </div>
        </div>

        {status && <p className={`mb-2 text-sm ${statusColor}`}>{status.msg}</p>}

        <details className="mb-3 text-sm text-gray-700">
          <summary className="cursor-pointer select-none">How to use / available fields</summary>
          <div className="p-3 mt-2 space-y-1 bg-white border border-gray-300 rounded-md">
            <p>
              The paper shows the <b>real data</b> of the selected invoice. The <b>orange highlighted</b> parts are live
              fields: they are saved as fields, so every invoice prints its own values. Normal text (labels like
              "CASHIER:") is just text you can change.
            </p>
            <p>
              Drag blocks from the <b>Blocks</b> panel (right side, grid icon) onto the paper. Double-click a text to edit it.
              Use the <b>Style</b> panel (brush icon) for font size, bold, alignment, margins and borders.
            </p>
            <p>
              <b>Items:</b> the designer shows only the <b>first item</b> (that row is repeated for every item when
              printing). Use <b>Preview / Test print</b> to see all items.
            </p>
            <p>
              <b>Add a column:</b> select a column box, press the <b>clone</b> icon in its small toolbar, then edit the
              text (do it in the heading row and in the item row).
            </p>
            <p>
              <b>Logo:</b> drag the <b>Logo / Image</b> block, upload an image (small file, under ~500 KB) and pick it.
            </p>
            <p>
              <b>Fields</b> (you can also type them in any text): {FIELD_HELP.map((k) => `{{${k}}}`).join("  ")}
            </p>
            <p>
              <b>Item fields</b> (inside the repeated item row, attribute <code>data-repeat="items"</code>):{" "}
              {ITEM_HELP.map((k) => `{{${k}}}`).join("  ")}
            </p>
            <p>
              <b>Show only when:</b> select an element, Settings panel (gear icon), add attribute <code>data-if</code> =
              <code> hasDiscount</code>, <code>hasRefund</code>, <code>shopAddress</code> ... (<code>!name</code> = the opposite).
              Those parts are always visible here, but hidden on the printed invoice when the condition is false.
            </p>
          </div>
        </details>

        {/* Editor (with the loading spinner on top of it) */}
        <div
          className="relative overflow-hidden border border-gray-300 rounded-md"
          style={{ height: "calc(100vh - 300px)", minHeight: 560 }}
        >
          <div ref={containerRef} style={{ height: "100%" }} />

          {layoutLoading && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-100"
              style={{ zIndex: 1000 }}
            >
              <div
                className="border-4 border-orange-500 rounded-full w-14 h-14 border-t-transparent animate-spin"
                role="status"
                aria-label="Loading"
              />
              <p className="text-sm font-medium text-gray-400">Loading layout...</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview modal (all items, real data) */}
      {previewDoc && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
          <div className="flex flex-col w-full max-w-[640px] max-h-[92vh] p-4 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                Preview{invoiceNo ? ` (invoice ${invoiceNo})` : " (sample data)"} - {PAPER_TYPES[p.type].label}
              </h2>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-200 border border-gray-300">
              <div className="flex justify-center py-3">
                <iframe
                  title="Preview"
                  srcDoc={previewDoc}
                  sandbox="allow-same-origin"
                  style={{
                    width: `${p.widthMm}mm`,
                    height: "70vh",
                    border: 0,
                    background: "#fff",
                    boxShadow: "0 0 6px rgba(0,0,0,.35)",
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => printDocument(previewDoc, p)}
                className="flex-1 py-2 text-white bg-black rounded-md hover:bg-gray-800"
              >
                Test print (or Save as PDF)
              </button>
              <button
                onClick={() => setPreviewDoc(null)}
                className="flex-1 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceTemplateDesigner;