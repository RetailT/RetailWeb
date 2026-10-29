// ============================================================================
// Bill templates (written in CODE, one per MODIFY_TYPE)
//
//   tb_COMPANY.MODIFY_TYPE = 1  ->  BILL_TEMPLATES[1]
//   tb_COMPANY.MODIFY_TYPE = 2  ->  BILL_TEMPLATES[2]
//   empty / 0 / a number that has no template here -> DEFAULT_BILL_TYPE (1)
//
// A layout saved in the Invoice Template Designer for the same type ("T1", "T2" ...) is used
// instead of the code layout. The designer starts from the code layout of the type
// (getDesignBase), so what you edit is the bill that the invoice page shows.
//
// HOW TO ADD A NEW TEMPLATE (a shop wants its own bill design):
//   1. Copy the "Type 2" block below, give it a new number (3, 4 ...).
//   2. Change the HTML / CSS as the shop wants.
//   3. Add it to BILL_TEMPLATES.
//   4. In the database set  tb_COMPANY.MODIFY_TYPE = 3  for that company.
//
// Type 1 is shown on the invoice page by the JSX receipt in InvoicePreview.jsx (builtin).
// Its html / css below (designHtml / designCss) is the SAME bill as html, used by the
// designer as the starting point.
//
// FIELDS you can use in html:  {{shopName}} {{shopAddress}} {{shopTel}} {{cashier}}
//   {{invoiceNo}} {{customer}} {{date}} {{time}} {{subTotal}} {{refundTotal}} {{cash}}
//   {{credit}} {{totalDiscount}} {{noOfPieces}} {{noOfProducts}} {{message}}
// ITEM fields (inside an element that has data-repeat="items"):
//   {{code}} {{name}} {{nameEnglish}} {{nameSinhala}} {{qty}}
//   {{unitPrice}}  (the real / retail price of the product)
//   {{netPrice}}   (price after discount)  {{discountAmount}} {{total}} {{refundTag}}
// CONDITIONS: data-if="hasDiscount"  data-if="hasRefund"  data-if="shopAddress"  (! = opposite)
//
// SINHALA BILL: English labels written between the tags (CASHIER, QTY, RETAIL, PRICE,
// SUB TOTAL ...) are translated automatically when the cashier selects the Sinhala language.
// {{nameSinhala}} is filled ONLY in the Sinhala bill (AMILA font); in the English bill it is empty.
//
// paper: { type: "POS80" | "POS58" | "A4" | "CUSTOM", widthMm, paddingMm }
// ============================================================================

export const DEFAULT_BILL_TYPE = 1;

const POS80_PAPER = { type: "POS80", widthMm: 80, paddingMm: 3 };

// ---------------------------------------------------------------------------
// Type 1 : standard receipt (the same bill as the JSX receipt on the invoice page)
// ---------------------------------------------------------------------------
const T1_HTML = `
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
    <div class="cols"><div class="col l">QTY</div><div class="col r">RETAIL</div><div class="col r">PRICE</div><div class="col r">VALUE</div></div>
  </div>
  <div class="irow" data-repeat="items">
    <div class="b">{{code}} {{nameEnglish}}<span class="amila-name" style="font-family:'AMILA',sans-serif"> {{nameSinhala}}</span>{{refundTag}}</div>
    <div class="cols"><div class="col l">{{qty}}</div><div class="col r">{{unitPrice}}</div><div class="col r">{{netPrice}}</div><div class="col r b">{{total}}</div></div>
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

const T1_CSS = `
body { font-size: 10.5px; line-height: 1.25; }
.hdr { text-align: center; border-bottom: 2px dashed #000; padding: 4px 0; }
.shop { font-size: 18px; font-weight: 700; text-transform: uppercase; margin: 2px 0; }
.sec { border-bottom: 1px dashed #000; padding: 4px 0; }
.row { display: flex; justify-content: space-between; gap: 6px; }
.items { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 4px 0; margin-top: 2px; }
.ihead { border-bottom: 1px solid #000; font-weight: 700; font-size: 11px; margin-bottom: 3px; padding-bottom: 2px; }
.irow { margin-bottom: 5px; font-size: 10px; }
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
.foot { text-align: center; font-size: 8.5px; margin: 6px 0; }
.center { text-align: center; }
.sign { border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; font-size: 8.5px; }
`;

// ---------------------------------------------------------------------------
// Type 2 : compact table receipt (80mm)
//   item = 2 rows: [code + name]  then  [qty | retail price | price | value]
// ---------------------------------------------------------------------------
const T2_HTML = `
<div class="c b shop">{{shopName}}</div>
<div class="c" data-if="shopAddress">{{shopAddress}}</div>
<div class="c" data-if="shopTel">TEL - {{shopTel}}</div>
<div class="line"></div>

<table class="meta">
  <tr><td class="l">INVOICE NO</td><td class="r">{{invoiceNo}}</td></tr>
  <tr><td class="l">DATE</td><td class="r">{{date}} {{time}}</td></tr>
  <tr><td class="l">CASHIER</td><td class="r">{{cashier}}</td></tr>
  <tr><td class="l">CUSTOMER</td><td class="r">{{customer}}</td></tr>
</table>

<table class="items">
  <colgroup>
    <col style="width:22%"><col style="width:26%"><col style="width:26%"><col style="width:26%">
  </colgroup>
  <thead>
    <tr class="h1"><th class="l" colspan="4">PRODUCT</th></tr>
    <tr class="h2"><th class="l">QTY</th><th>RETAIL</th><th>PRICE</th><th>VALUE</th></tr>
  </thead>
  <tbody data-repeat="items">
    <tr class="nm"><td class="l name" colspan="4">{{code}} {{nameEnglish}}<span class="amila-name" style="font-family:'AMILA',sans-serif">{{nameSinhala}}</span>{{refundTag}}</td></tr>
    <tr class="nums"><td class="l">{{qty}}</td><td>{{unitPrice}}</td><td>{{netPrice}}</td><td class="b">{{total}}</td></tr>
  </tbody>
</table>

<table class="tot">
  <tr class="b"><td class="l">SUB TOTAL</td><td class="r">{{subTotal}}</td></tr>
  <tr class="b" data-if="hasRefund"><td class="l">REFUND TOTAL</td><td class="r">{{refundTotal}}</td></tr>
  <tr class="big"><td class="l">CASH</td><td class="r">{{cash}}</td></tr>
  <tr class="big"><td class="l">CREDIT</td><td class="r">{{credit}}</td></tr>
</table>

<div class="line dot"></div>
<table class="tot">
  <tr><td class="l">NO OF PIECES</td><td class="r">{{noOfPieces}}</td></tr>
  <tr><td class="l">NO OF PRODUCTS</td><td class="r">{{noOfProducts}}</td></tr>
</table>

<div class="disc" data-if="hasDiscount">YOU HAVE TOTAL DISCOUNT<br>{{totalDiscount}}</div>
<div class="foot">{{message}}</div>
<div class="c b thanks">THANK YOU COME AGAIN</div>
<div class="sign c"><div class="b">© Retail Target Software Solutions (Pvt) Ltd</div><div>+94 76 3 165700 / +94 76 3 165701</div></div>
`;

const T2_CSS = `
.c { text-align: center; }
.l { text-align: left; }
.r { text-align: right; }
.b { font-weight: 700; }
.shop { font-size: 16px; text-transform: uppercase; margin-bottom: 2px; }
.line { border-top: 1px dashed #000; margin: 5px 0; }
.line.dot { border-top-style: dotted; }
table { width: 100%; border-collapse: collapse; }
.meta td { padding: 1px 0; }
.items { margin-top: 4px; table-layout: fixed; }
.items th { font-size: 11px; padding: 2px 0; white-space: nowrap; text-align: right; }
.items th.l { text-align: left; }
.items tr.h1 th { border-top: 1px solid #000; padding-bottom: 0; }
.items tr.h2 th { border-bottom: 1px solid #000; }
.items td { padding: 0; vertical-align: top; text-align: right; }
.items td.l { text-align: left; }
.items tr.nm td { padding-top: 4px; font-weight: 700; word-break: break-word; }
.items tr.nums td { padding-bottom: 3px; border-bottom: 1px dotted #999; }
.tot { margin-top: 3px; }
.tot td { padding: 1px 0; }
.big td { font-size: 13px; font-weight: 700; }
.disc { border: 2px solid #000; text-align: center; padding: 4px; margin: 8px 6px; font-weight: 700; font-size: 13px; }
.foot { text-align: center; font-size: 9px; margin: 6px 0; }
.thanks { font-size: 13px; margin: 4px 0; }
.sign { border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; font-size: 9px; }
`;

// ---------------------------------------------------------------------------
// Registry : MODIFY_TYPE number -> template
// ---------------------------------------------------------------------------
export const BILL_TEMPLATES = {
  // Shown by the JSX receipt on the invoice page (builtin). designHtml / designCss = the same
  // bill as html, the starting point of the designer.
  1: {
    name: "Standard receipt",
    builtin: true,
    paper: POS80_PAPER,
    designHtml: T1_HTML,
    designCss: T1_CSS,
  },

  2: {
    name: "Compact table receipt",
    paper: POS80_PAPER,
    html: T2_HTML,
    css: T2_CSS,
  },

  // 3: { name: "...", paper: {...}, html: T3_HTML, css: T3_CSS },
};

// MODIFY_TYPE (from tb_COMPANY) -> template. Unknown / empty / 0 -> the default (type 1).
export const getBillTemplate = (modifyType) => {
  const n = parseInt(String(modifyType ?? "").trim(), 10);
  const id = BILL_TEMPLATES[n] ? n : DEFAULT_BILL_TYPE;
  return { id, ...BILL_TEMPLATES[id] };
};

// Starting point of the designer for a template key ("T1", "T2" ... anything else -> type 1):
// the CURRENT bill design of that type, so the designer shows the same bill as the invoice page.
export const getDesignBase = (key) => {
  const m = /^T(\d+)$/.exec(String(key || "").trim());
  const tpl = getBillTemplate(m ? m[1] : DEFAULT_BILL_TYPE);
  return {
    id: tpl.id,
    name: tpl.name,
    html: tpl.html || tpl.designHtml || T1_HTML,
    css: tpl.css || tpl.designCss || T1_CSS,
    paper: { ...(tpl.paper || POS80_PAPER) },
  };
};