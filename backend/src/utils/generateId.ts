const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const generateSubmissionId = (date = new Date(), _sequence = 1): string => {
  const yyyy = date.getUTCFullYear();
  let code = "";
  for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return `SH-${yyyy}-${code}`;
};

export const generateInvoiceId = (date = new Date(), sequence = 1): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const s = String(sequence).padStart(4, "0");
  return `INV-${y}${m}-${s}`;
};
