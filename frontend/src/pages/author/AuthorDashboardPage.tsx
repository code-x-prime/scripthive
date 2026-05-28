import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2, Clock, Eye, FilePlus, FileText,
  Loader2, RefreshCw, XCircle, ArrowRight, BookOpen, DollarSign
} from "lucide-react";
import type { AuthorSubmissionSummary } from "@/types";
import { authorService, type AuthorStats } from "@/services/author.service";
import { formatSubmissionStatus, STATUS_COLORS } from "@/utils/authorStatus";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";

export function AuthorDashboardPage() {
  const { author } = useAuthorAuth();
  const [rows, setRows]       = useState<AuthorSubmissionSummary[]>([]);
  const [stats, setStats]     = useState<AuthorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState("");

  const fetchDashboard = useCallback(async () => {
    const [list, summary] = await Promise.all([authorService.listSubmissions(), authorService.getStats()]);
    return { list, summary };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchDashboard()
      .then(({ list, summary }) => { if (!cancelled) { setRows(list); setStats(summary); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    setError("");
    void fetchDashboard()
      .then(({ list, summary }) => { setRows(list); setStats(summary); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setRefreshing(false));
  };

  const STAT_CARDS = [
    { label: "Total",        value: stats?.total       ?? 0, icon: FileText,     bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-200" },
    { label: "Pending",      value: stats?.pending     ?? 0, icon: Clock,        bg: "bg-amber-50",    text: "text-amber-600",   border: "border-amber-200" },
    { label: "Under Review", value: stats?.underReview ?? 0, icon: Eye,          bg: "bg-blue-50",     text: "text-blue-600",    border: "border-blue-200" },
    { label: "Accepted",     value: stats?.accepted    ?? 0, icon: CheckCircle2, bg: "bg-green-50",    text: "text-green-600",   border: "border-green-200" },
    { label: "Rejected",     value: stats?.rejected    ?? 0, icon: XCircle,      bg: "bg-red-50",      text: "text-red-600",     border: "border-red-200" },
    { label: "Published",    value: stats?.published   ?? 0, icon: BookOpen,     bg: "bg-emerald-50",  text: "text-emerald-600", border: "border-emerald-200" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Welcome back, {author?.name?.split(" ")[0] ?? "Author"} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">Live data — synced with the editorial office</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onRefresh} disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link to="/author/submit"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 shadow-sm">
            <FilePlus className="h-4 w-4" /> New submission
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {STAT_CARDS.map(({ label, value, icon: Icon, bg, text, border }) => (
          <div key={label} className={`rounded-xl border ${border} bg-white p-5 shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <div className={`rounded-lg p-1.5 ${bg}`}>
                <Icon className={`h-3.5 w-3.5 ${text}`} />
              </div>
            </div>
            <p className="font-heading text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Submissions table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">My Submissions</h2>
          {rows.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{rows.length}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 p-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
            <span className="text-sm">Loading submissions…</span>
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button type="button" onClick={onRefresh} className="mt-3 text-sm font-medium text-green-600 hover:underline">Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="rounded-full bg-slate-100 p-4 mb-4"><FileText className="h-8 w-8 text-slate-400" /></div>
            <p className="font-semibold text-slate-700">No submissions yet</p>
            <p className="mt-1 text-sm text-slate-400">Submit your first paper to get started</p>
            <Link to="/author/submit"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
              <FilePlus className="h-4 w-4" /> Submit your first paper
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Journal</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Payment</th>
                    <th className="px-6 py-3">Submitted</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-green-700">{row.id}</td>
                      <td className="max-w-xs px-6 py-4">
                        <p className="truncate font-medium text-slate-900">{row.title}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{row.journalName}</td>
                      <td className="px-6 py-4"><StatusBadge status={row.status} /></td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          row.paymentStatus === "Paid"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {row.paymentStatus === "Paid" && <DollarSign className="h-3 w-3" />}
                          {row.paymentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/author/submissions/${row.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-green-300 hover:text-green-700 transition-colors">
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 md:hidden">
              {rows.map((row) => (
                <Link key={row.id} to={`/author/submissions/${row.id}`}
                  className="block rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:border-green-200 hover:bg-green-50/20 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-mono text-xs font-bold text-green-700">{row.id}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="font-semibold text-slate-900 line-clamp-2">{row.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.journalName}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <span>{new Date(row.createdAt).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>Payment: {row.paymentStatus}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
      STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
    }`}>
      {formatSubmissionStatus(status)}
    </span>
  );
}
