import { fmtDate, fmtDateTime } from "@/utils/formatDate";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Mail, Trash2, Eye, X } from "lucide-react";
import { apiJson } from "@/services/api";

interface ContactQuery {
  id: string;
  queryId: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: string;
  ipAddress?: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = ["New", "In Progress", "Resolved", "Closed"] as const;

const STATUS_COLORS: Record<string, string> = {
  "New":         "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  "Resolved":    "bg-green-50 text-green-700 border-green-200",
  "Closed":      "bg-gray-100 text-gray-500 border-gray-200"
};

function formatDate(iso: string) {
  return fmtDate(iso);
}

export const ContactQueriesPage = () => {
  const [rows, setRows]           = useState<ContactQuery[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterStatus, setFilter] = useState("");
  const [selected, setSelected]   = useState<ContactQuery | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus ? `/contact?status=${encodeURIComponent(filterStatus)}` : "/contact";
      setRows(await apiJson<ContactQuery[]>(url));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { void load(); }, [load]);

  const onStatusChange = async (id: string, status: string) => {
    try {
      const updated = await apiJson<ContactQuery>(`/contact/${id}/status`, {
        method: "PUT", body: JSON.stringify({ status })
      });
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: updated.status } : r));
      if (selected?.id === id) setSelected((s) => s ? { ...s, status: updated.status } : s);
      toast.success("Status updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this query?")) return;
    try {
      await apiJson(`/contact/${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success("Deleted");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const newCount = rows.filter((r) => r.status === "New").length;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-gray-900">Contact Queries</h1>
          <p className="mt-1 text-sm text-gray-500">Messages from the public contact form.</p>
        </div>
        {newCount > 0 && (
          <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">{newCount} new</span>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
        <select value={filterStatus} onChange={(e) => setFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">All</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          {[1,2,3].map((k) => <div key={k} className="h-10 rounded bg-gray-100" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-400">No queries found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-[800px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left">Ref ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-gray-100 hover:bg-gray-50/80 ${r.status === "New" ? "bg-blue-50/30" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{r.queryId}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <a href={`mailto:${r.email}`} className="hover:text-blue-600">{r.email}</a>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-gray-700">{r.subject}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 text-xs">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => void onStatusChange(r.id, e.target.value)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold focus:outline-none ${STATUS_COLORS[r.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button type="button" title="View message"
                        onClick={() => setSelected(r)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <a href={`mailto:${r.email}?subject=Re: ${encodeURIComponent(r.subject)} [${r.queryId}]`}
                        title="Reply via email"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-green-50 hover:text-green-600">
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                      <button type="button" title="Delete"
                        onClick={() => void onDelete(r.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="font-mono text-sm font-bold text-blue-700">{selected.queryId}</p>
                <h2 className="font-heading text-lg font-semibold text-gray-900">{selected.subject}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs font-semibold uppercase text-gray-400">Name</p><p className="font-medium text-gray-900">{selected.name}</p></div>
                <div><p className="text-xs font-semibold uppercase text-gray-400">Email</p><a href={`mailto:${selected.email}`} className="font-medium text-blue-600 hover:underline">{selected.email}</a></div>
                <div><p className="text-xs font-semibold uppercase text-gray-400">Phone</p><p className="text-gray-700">{selected.phone || "—"}</p></div>
                <div><p className="text-xs font-semibold uppercase text-gray-400">Received</p><p className="text-gray-700 text-xs">{formatDate(selected.createdAt)}</p></div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Message</p>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selected.message}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase text-gray-400">Status</span>
                <select value={selected.status}
                  onChange={(e) => void onStatusChange(selected.id, e.target.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold focus:outline-none ${STATUS_COLORS[selected.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)} [${selected.queryId}]`}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                <Mail className="h-4 w-4" /> Reply
              </a>
              <button type="button" onClick={() => setSelected(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
