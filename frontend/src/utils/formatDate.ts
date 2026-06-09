/** Format date as DD/MM/YYYY */
export function fmtDate(iso?: string | Date | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB"); // DD/MM/YYYY
}

/** Format date+time as DD/MM/YYYY HH:MM */
export function fmtDateTime(iso?: string | Date | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB") + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
