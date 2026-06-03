const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const generateSubmissionId = (date = new Date(), _sequence = 1): string => {
  const yyyy = date.getUTCFullYear();
  let code = "";
  for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return `SH-${yyyy}-${code}`;
};

export const generateInvoiceId = (date = new Date(), sequence = 1): string => {
  // Financial year: Apr-Mar. e.g. Apr 2025 - Mar 2026 = "25-26"
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1; // 1-12
  const fyStart = m >= 4 ? y : y - 1;
  const fyEnd = fyStart + 1;
  const fy = `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
  const s = String(sequence).padStart(3, "0");
  return `SH/${fy}/${s}`;
};

/** Returns the financial year string for a given date (for counting invoices in same FY) */
export const getFinancialYear = (date = new Date()): { start: Date; end: Date } => {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const fyStart = m >= 4 ? y : y - 1;
  return {
    start: new Date(`${fyStart}-04-01T00:00:00Z`),
    end: new Date(`${fyStart + 1}-03-31T23:59:59Z`)
  };
};
