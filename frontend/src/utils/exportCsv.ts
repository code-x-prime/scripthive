export type ExportColumn<T> = {
  key: string;
  label: string;
  /** If set, user must have this permission to see/export this column */
  permission?: string;
  getValue: (row: T) => string;
};

export function escapeCsvCell(value: string): string {
  const v = value ?? "";
  if (/[",\n\r]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}

export function buildCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.getValue(row))).join(",")
  );
  return [header, ...lines].join("\n");
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
