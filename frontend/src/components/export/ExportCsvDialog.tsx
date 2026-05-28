import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePermissions } from "@/hooks/usePermissions";
import { buildCsv, downloadCsv, type ExportColumn } from "@/utils/exportCsv";

type Props<T> = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  filename: string;
  rows: T[];
  columns: ExportColumn<T>[];
  /** Base permission if column has no specific permission */
  defaultPermission?: string;
};

type PickerProps<T> = {
  allowedColumns: ExportColumn<T>[];
  rows: T[];
  filename: string;
  onClose: () => void;
};

/** Mounted only while dialog is open — fresh selection state each time (no effect). */
function ExportColumnPicker<T>({ allowedColumns, rows, filename, onClose }: PickerProps<T>) {
  const [selected, setSelected] = useState(
    () => new Set(allowedColumns.map((c) => c.key))
  );

  const allSelected = selected.size === allowedColumns.length && allowedColumns.length > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allowedColumns.map((c) => c.key)));
  };

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onExport = () => {
    const cols = allowedColumns.filter((c) => selected.has(c.key));
    if (cols.length === 0) return;
    const csv = buildCsv(rows, cols);
    downloadCsv(csv, filename);
    onClose();
  };

  return (
    <>
      <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
        {allowedColumns.length === 0 ? (
          <p className="text-sm text-slate-500">You do not have permission to export any columns.</p>
        ) : (
          <>
            <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
              <Checkbox checked={allSelected} onChange={toggleAll} />
              <span className="text-sm font-semibold text-green-800">Select all</span>
            </label>
            <div className="space-y-2">
              {allowedColumns.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                >
                  <Checkbox checked={selected.has(col.key)} onChange={() => toggle(col.key)} />
                  <span className="text-sm text-slate-700">{col.label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={selected.size === 0 || rows.length === 0} onClick={onExport}>
          <Download className="h-4 w-4" />
          Export {selected.size} column{selected.size === 1 ? "" : "s"}
        </Button>
      </div>
    </>
  );
}

export function ExportCsvDialog<T>({
  open,
  onClose,
  title,
  description,
  filename,
  rows,
  columns,
  defaultPermission = "submissions:read"
}: Props<T>) {
  const { hasPermission, isSuperAdmin } = usePermissions();

  const allowedColumns = useMemo(() => {
    return columns.filter((col) => {
      if (isSuperAdmin()) return true;
      const perm = col.permission ?? defaultPermission;
      return hasPermission(perm);
    });
  }, [columns, defaultPermission, hasPermission, isSuperAdmin]);

  const pickerKey = allowedColumns.map((c) => c.key).join("|");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={
        description ??
        `Choose columns to export (${rows.length} row${rows.length === 1 ? "" : "s"}). Only fields allowed by your role are shown.`
      }
    >
      {open ? (
        <ExportColumnPicker
          key={pickerKey}
          allowedColumns={allowedColumns}
          rows={rows}
          filename={filename}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}
