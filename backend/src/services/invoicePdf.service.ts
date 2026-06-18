// @ts-ignore — puppeteer installed on server, not in local dev
import puppeteer from "puppeteer";

interface InvoiceItem {
  description: string;
  amount: number;
}

interface InvoicePdfData {
  invoiceId: string;
  submissionId: string;
  customerName: string;
  customerEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  createdAt: Date;
  paidAt?: Date | null;
  method?: string | null;
  journalName?: string | null | undefined;
  issn?: string | null | undefined;
  eIssn?: string | null | undefined;
  paperTitle?: string | null | undefined;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtAmount(amount: number, currency: string): string {
  const sym = currency === "INR" ? "₹" : "$";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const decimals = currency === "INR" ? 0 : 2;
  return `${sym}${amount.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function buildInvoiceHtml(d: InvoicePdfData): string {
  const cur = (d.currency || "INR").toUpperCase();
  const itemRows = d.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"}">
      <td style="padding:10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #e2e8f0">${item.description}</td>
      <td style="padding:10px 16px;font-size:13px;color:#1e293b;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0">${fmtAmount(item.amount, cur)}</td>
    </tr>`).join("");

  const taxRow = d.tax > 0 ? `
    <tr>
      <td style="padding:8px 16px;font-size:12px;color:#64748b;text-align:right">Tax / GST</td>
      <td style="padding:8px 16px;font-size:12px;color:#64748b;text-align:right">${fmtAmount(d.tax, cur)}</td>
    </tr>` : "";

  const statusColor = d.status === "Paid" ? "#16a34a" : d.status === "Pending" ? "#d97706" : "#64748b";
  const statusBg = d.status === "Paid" ? "#f0fdf4" : d.status === "Pending" ? "#fffbeb" : "#f8fafc";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Invoice ${d.invoiceId}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; background: #ffffff; color: #1e293b; }
</style>
</head>
<body>
<div style="width:210mm;min-height:297mm;padding:14mm 14mm 10mm;position:relative;">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
    <div>
      <div style="font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">ScriptHive Publication</div>
      <div style="font-size:11px;color:#64748b;margin-top:3px;letter-spacing:0.5px">www.scripthive.org &nbsp;|&nbsp; info@scripthive.org</div>
      ${d.journalName ? `<div style="font-size:12px;color:#1d4ed8;margin-top:4px;font-weight:600">${d.journalName}</div>` : ""}
      ${d.issn ? `<div style="font-size:11px;color:#64748b">ISSN: ${d.issn}${d.eIssn ? ` &nbsp;|&nbsp; e-ISSN: ${d.eIssn}` : ""}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div style="font-size:28px;font-weight:800;color:#0f172a;letter-spacing:1px">INVOICE</div>
      <div style="margin-top:6px;display:inline-block;padding:4px 14px;background:${statusBg};border:1.5px solid ${statusColor};color:${statusColor};font-size:12px;font-weight:700;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px">${d.status}</div>
    </div>
  </div>

  <!-- Blue divider -->
  <div style="height:3px;background:linear-gradient(to right,#1d4ed8,#0f172a);margin-bottom:24px;"></div>

  <!-- Invoice meta + Bill To -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px">Bill To</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a">${d.customerName}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px">${d.customerEmail}</div>
      ${d.paperTitle ? `<div style="font-size:11px;color:#475569;margin-top:6px;font-style:italic;line-height:1.4">${d.paperTitle}</div>` : ""}
      <div style="font-size:11px;color:#94a3b8;margin-top:4px">Manuscript ID: <strong style="color:#475569">${d.submissionId}</strong></div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px">Invoice Details</div>
      <table style="margin-left:auto;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#64748b;padding:2px 0;padding-right:16px">Invoice No.</td><td style="font-weight:700;color:#0f172a;font-family:monospace">${d.invoiceId}</td></tr>
        <tr><td style="color:#64748b;padding:2px 0;padding-right:16px">Date</td><td style="font-weight:600;color:#334155">${fmtDate(d.createdAt)}</td></tr>
        ${d.paidAt ? `<tr><td style="color:#64748b;padding:2px 0;padding-right:16px">Paid On</td><td style="font-weight:600;color:#16a34a">${fmtDate(d.paidAt)}</td></tr>` : ""}
        ${d.method ? `<tr><td style="color:#64748b;padding:2px 0;padding-right:16px">Method</td><td style="font-weight:600;color:#334155">${d.method}</td></tr>` : ""}
        <tr><td style="color:#64748b;padding:2px 0;padding-right:16px">Currency</td><td style="font-weight:600;color:#334155">${cur}</td></tr>
      </table>
    </div>
  </div>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:0;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
    <thead>
      <tr style="background:#0f172a">
        <th style="padding:11px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;text-align:left">Description</th>
        <th style="padding:11px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || `<tr><td colspan="2" style="padding:14px 16px;font-size:13px;color:#64748b;text-align:center">Article Processing Charge (APC)</td></tr>`}
    </tbody>
    <tfoot style="background:#f8fafc;border-top:2px solid #e2e8f0">
      ${taxRow}
      <tr>
        <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#0f172a;text-align:right;border-top:2px solid #1d4ed8">Total Payable</td>
        <td style="padding:12px 16px;font-size:18px;font-weight:800;color:#1d4ed8;text-align:right;border-top:2px solid #1d4ed8;font-family:monospace">${fmtAmount(d.total, cur)}</td>
      </tr>
    </tfoot>
  </table>

  ${d.status === "Paid" ? `
  <!-- Paid stamp -->
  <div style="margin-top:20px;display:inline-block;border:3px solid #16a34a;padding:6px 20px;transform:rotate(-3deg);color:#16a34a;font-size:22px;font-weight:800;letter-spacing:3px;text-transform:uppercase;opacity:0.85">
    PAID
  </div>` : ""}

  <!-- Footer -->
  <div style="position:absolute;bottom:10mm;left:14mm;right:14mm;border-top:1px solid #e2e8f0;padding-top:10px;">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:10px;color:#94a3b8">ScriptHive Publication &nbsp;|&nbsp; scripthive.org &nbsp;|&nbsp; +91 9899916683</div>
      <div style="font-size:10px;color:#94a3b8">This is a computer-generated invoice.</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  try {
    const page = await browser.newPage();
    await page.setContent(buildInvoiceHtml(data), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
