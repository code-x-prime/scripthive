import { fmtDateTime } from "@/utils/formatDate";
import { useCallback, useEffect, useMemo, useState } from "react";
import JoditEditor from "jodit-react";
import toast from "react-hot-toast";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { BookOpen, DollarSign, FileSpreadsheet, FileText, Hash, Loader2, Printer, Activity, Upload, Users, X, Download, Check, Pencil } from "lucide-react";
import { reportsService, type ReportsPayload, type ActivityPayload, type UserActivitySummary, type AuditLogEntry } from "@/services/reports.service";
import { apiFetch, apiJson } from "@/services/api";
import type { Submission } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  Pending: "#3b82f6",
  UnderReview: "#f59e0b",
  Revision: "#a855f7",
  Accepted: "#14b8a6",
  Rejected: "#ef4444",
  Published: "#16a34a"
};
const PIE_FALLBACK = ["#16a34a", "#3b82f6", "#f59e0b", "#14b8a6", "#ef4444", "#8b5cf6", "#06b6d4"];

/* ── helpers ─────────────────────────────────────────────────────────────── */
function esc(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}
function row(...cells: string[]): string { return cells.map(esc).join(","); }
function section(title: string): string { return `\n${esc(title)}\n`; }

function buildExcel(data: ReportsPayload): string {
  const { summary } = data;
  const now = new Date().toLocaleString();
  const lines: string[] = [];

  lines.push(row("ScriptHive Analytics Report", now));

  lines.push(section("SUMMARY"));
  lines.push(row("Metric", "Value"));
  lines.push(row("Total Submissions",  String(summary.totalSubmissions)));
  lines.push(row("Pending",            String(summary.pending)));
  lines.push(row("Under Review",       String(summary.underReview)));
  lines.push(row("Accepted",           String(summary.accepted)));
  lines.push(row("Rejected",           String(summary.rejected)));
  lines.push(row("Published",          String(summary.published)));
  lines.push(row("Paid Invoices",      String(summary.paidInvoices)));
  lines.push(row("Pending Invoices",   String(summary.pendingInvoices)));
  lines.push(row("Revenue USD",        `$${summary.totalRevenueUsd.toFixed(2)}`));
  lines.push(row("Revenue INR",        `₹${summary.totalRevenueInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`));
  lines.push(row("DOI Minted",         String(summary.mintedDoi)));
  lines.push(row("DOI Pending",        String(summary.pendingDoi)));

  lines.push(section("SUBMISSIONS BY STATUS"));
  lines.push(row("Status", "Count"));
  data.submissionsByStatus.forEach((s) => lines.push(row(s.label, String(s.count))));

  lines.push(section("SUBMISSIONS BY JOURNAL"));
  lines.push(row("Journal", "Count"));
  data.submissionsByJournal.forEach((j) => lines.push(row(j.label, String(j.count))));

  lines.push(section("MONTHLY SUBMISSIONS (last 6 months)"));
  lines.push(row("Month", "New Submissions", "Published"));
  data.monthlySubmissions.forEach((m) => lines.push(row(m.month, String(m.submissions), String(m.published))));

  lines.push(section("MONTHLY REVENUE (last 6 months)"));
  lines.push(row("Month", "USD", "INR"));
  data.monthlyRevenue.forEach((m) => lines.push(row(m.month, `$${m.usd.toFixed(2)}`, `₹${m.inr}`)));

  lines.push(section("INVOICE STATUS"));
  lines.push(row("Status", "Count"));
  data.paymentsByStatus.forEach((p) => lines.push(row(p.label, String(p.count))));

  return lines.join("\n");
}

function downloadExcel(data: ReportsPayload): void {
  const csv = buildExcel(data);
  // UTF-8 BOM so Excel opens with correct encoding (₹ symbol etc.)
  const bom = "﻿";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scripthive-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── sub-components ──────────────────────────────────────────────────────── */
function StatCard({ title, value, sub, icon: Icon, accent = "green" }: {
  title: string; value: string; sub?: string; icon: typeof FileText; accent?: "green" | "blue" | "amber" | "teal";
}) {
  const colors = {
    green: "bg-green-50 text-green-600",
    blue:  "bg-blue-50  text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    teal:  "bg-teal-50  text-teal-600"
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none print:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 font-heading text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none print:break-inside-avoid">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4 h-72">{children}</div>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  status_change: "Status changed",
  bulk_status_change: "Bulk status change",
  production_stage: "Production stage",
  payment_received: "Payment received",
  payment_manual_paid: "Manual payment",
  doi_assigned: "DOI assigned",
  article_published: "Article published",
  manuscript_download: "Manuscript download"
};

const ACTION_COLORS: Record<string, string> = {
  login: "#6366f1",
  status_change: "#3b82f6",
  bulk_status_change: "#8b5cf6",
  production_stage: "#f59e0b",
  payment_received: "#10b981",
  payment_manual_paid: "#059669",
  doi_assigned: "#f97316",
  article_published: "#16a34a",
  manuscript_download: "#06b6d4"
};

const RESOURCE_COLORS: Record<string, string> = {
  auth: "#6366f1", submission: "#3b82f6", invoice: "#10b981",
  doi: "#f59e0b", publish: "#16a34a"
};

function exportUserCSV(user: UserActivitySummary, logs: AuditLogEntry[], days: number) {
  const esc = (v: string) => /[",\n\r]/.test(v) ? `"${v.replaceAll('"','""')}"` : v;
  const r = (...cells: string[]) => cells.map(esc).join(",");
  const lines: string[] = [];
  lines.push(r(`User Activity Report — ${user.name}`, `Generated ${new Date().toLocaleString()}`));
  lines.push(r(`Role`, user.role));
  lines.push(r(`Period`, `Last ${days} days`));
  lines.push(r(`Total Actions`, String(user.total)));
  lines.push("");
  lines.push(r("Action", "Count"));
  Object.entries(user.actions).forEach(([a, c]) => lines.push(r(ACTION_LABELS[a] ?? a, String(c))));
  lines.push("");
  lines.push(r("Date/Time", "Action", "Resource", "Resource ID", "Details"));
  logs.filter(l => l.adminId === user.adminId).forEach(l =>
    lines.push(r(fmtDateTime(l.createdAt), ACTION_LABELS[l.action] ?? l.action,
      l.resource, l.resourceId ?? "", l.details ? JSON.stringify(l.details) : ""))
  );
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `activity-${user.name.replace(/\s+/g,"-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function UserDrillDown({ user, logs, days, onClose }: {
  user: UserActivitySummary; logs: AuditLogEntry[]; days: number; onClose: () => void
}) {
  const userLogs = logs.filter(l => l.adminId === user.adminId);
  const actionPieData = Object.entries(user.actions).map(([action, count]) => ({
    name: ACTION_LABELS[action] ?? action, value: count, fill: ACTION_COLORS[action] ?? "#94a3b8"
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold">
              {user.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-slate-900">{user.name}</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{user.role}</span>
                <span className="text-xs text-slate-400">{user.total} actions in last {days} days</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => exportUserCSV(user, logs, days)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button type="button" onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Action breakdown pie */}
          {actionPieData.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Action breakdown</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={actionPieData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={80} innerRadius={35}
                        label={({ name, percent }) => `${String(name).slice(0,10)} ${((percent as number)*100).toFixed(0)}%`}
                        labelLine={false}>
                        {actionPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {actionPieData.sort((a,b)=>b.value-a.value).map((a) => (
                    <div key={a.name} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{background:a.fill}} />
                        <span className="text-sm text-slate-700">{a.name}</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900">{a.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Activity log */}
          <div>
            <h3 className="font-semibold text-slate-800 mb-3">Activity log ({userLogs.length} entries)</h3>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto rounded-xl border border-slate-200">
              {userLogs.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No logs for this user</p>
              )}
              {userLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: ACTION_COLORS[log.action] ?? "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-semibold text-slate-800">{ACTION_LABELS[log.action] ?? log.action}</span>
                      <span className="text-xs text-slate-500 capitalize">{log.resource}</span>
                      {log.resourceId && <span className="font-mono text-xs text-slate-400">{log.resourceId}</span>}
                    </div>
                    {log.details && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {Object.entries(log.details as Record<string,unknown>)
                          .filter(([k]) => !["submissionId","trigger"].includes(k))
                          .map(([k,v]) => `${k}: ${String(v)}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">
                    {fmtDateTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ activityData }: { activityData: ActivityPayload }) {
  const { dailyActivity, userSummary, recentLogs } = activityData;
  const [drillUser, setDrillUser] = useState<UserActivitySummary | null>(null);
  const [feedFilter, setFeedFilter] = useState("");
  const [_expandedUsers, _setExpandedUsers] = useState<Record<string, boolean>>({});

  const totalActions = recentLogs.length;
  const uniqueUsers = userSummary.length;
  const topAction = userSummary.reduce((acc, u) =>
    Object.entries(u.actions).reduce((a2, [k,v]) => {
      a2[k] = (a2[k] ?? 0) + v; return a2;
    }, acc), {} as Record<string,number>);
  const topActionLabel = Object.entries(topAction).sort((a,b)=>b[1]-a[1])[0];

  const filteredLogs = feedFilter
    ? recentLogs.filter(l =>
        (l.admin?.name ?? "").toLowerCase().includes(feedFilter.toLowerCase()) ||
        l.action.toLowerCase().includes(feedFilter.toLowerCase()) ||
        (l.resourceId ?? "").toLowerCase().includes(feedFilter.toLowerCase())
      )
    : recentLogs;

  function exportAllCSV() {
    const esc = (v: string) => /[",\n\r]/.test(v) ? `"${v.replaceAll('"','""')}"` : v;
    const r = (...cells: string[]) => cells.map(esc).join(",");
    const lines = [
      r("ScriptHive User Activity Report", `Generated ${new Date().toLocaleString()}`),
      r(`Period: Last ${activityData.days} days`),
      "",
      r("Date/Time", "User", "Role", "Action", "Resource", "Resource ID", "Details", "IP")
    ];
    recentLogs.forEach(l => lines.push(r(
      fmtDateTime(l.createdAt),
      l.admin?.name ?? "System",
      l.admin?.role?.displayName ?? "—",
      ACTION_LABELS[l.action] ?? l.action,
      l.resource, l.resourceId ?? "",
      l.details ? JSON.stringify(l.details) : "",
      l.ipAddress ?? ""
    )));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scripthive-activity-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      {drillUser && (
        <UserDrillDown user={drillUser} logs={recentLogs} days={activityData.days} onClose={() => setDrillUser(null)} />
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total actions logged</p>
          <p className="mt-2 font-heading text-3xl font-bold text-slate-900">{totalActions}</p>
          <p className="mt-1 text-xs text-slate-400">Last {activityData.days} days</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active users</p>
          <p className="mt-2 font-heading text-3xl font-bold text-slate-900">{uniqueUsers}</p>
          <p className="mt-1 text-xs text-slate-400">Unique admin users</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Most common action</p>
          <p className="mt-2 font-heading text-xl font-bold text-slate-900">
            {topActionLabel ? ACTION_LABELS[topActionLabel[0]] ?? topActionLabel[0] : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-400">{topActionLabel ? `${topActionLabel[1]} times` : ""}</p>
        </div>
      </div>

      {/* Daily bar chart + action breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Daily activity timeline" subtitle={`Last ${activityData.days} days — all admin actions`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyActivity} barSize={activityData.days <= 14 ? 20 : 10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }}
                  interval={Math.max(0, Math.floor(dailyActivity.length / 8) - 1)}
                  tickFormatter={(d) => d.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(l) => `Date: ${l}`} />
                <Bar dataKey="count" name="Actions" fill="#16a34a" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div>
          <ChartCard title="Actions by type" subtitle="All users combined">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(topAction).map(([k,v]) => ({
                    name: ACTION_LABELS[k] ?? k, value: v,
                    fill: ACTION_COLORS[k] ?? "#94a3b8"
                  }))}
                  dataKey="value" nameKey="name"
                  cx="50%" cy="45%" outerRadius={85} innerRadius={35}
                  label={({ name, percent }) =>
                    `${String(name).slice(0,8)} ${((percent as number)*100).toFixed(0)}%`}
                  labelLine={false}>
                  {Object.entries(topAction).map(([k], i) => (
                    <Cell key={i} fill={ACTION_COLORS[k] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Per-user summary — clickable for drill-down */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 flex items-center gap-3">
          <Users className="h-4 w-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800">User activity summary</h3>
          <span className="ml-auto text-xs text-slate-400">Click a row to drill down</span>
          <button type="button" onClick={exportAllCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100">
            <Download className="h-3.5 w-3.5" /> Export all CSV
          </button>
        </div>
        {userSummary.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No activity logged yet</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {userSummary.map((u) => {
              const pct = totalActions > 0 ? Math.round((u.total / totalActions) * 100) : 0;
              return (
                <div key={u.adminId}
                  className="px-5 py-4 hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => setDrillUser(u)}>
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold">
                      {u.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{u.name}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{u.role}</span>
                      </div>
                      {/* progress bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-green-500" style={{width:`${pct}%`}} />
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{pct}% of total</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-lg font-bold text-slate-900">{u.total}</span>
                      <p className="text-xs text-slate-400">actions</p>
                    </div>
                    <div className="flex flex-wrap gap-1 max-w-xs" onClick={(e) => e.stopPropagation()}>
                      {Object.entries(u.actions).slice(0,3).map(([action, count]) => (
                        <span key={action}
                          className="rounded-full px-2 py-0.5 text-xs font-semibold border"
                          style={{
                            background: `${ACTION_COLORS[action]}18`,
                            borderColor: `${ACTION_COLORS[action]}40`,
                            color: ACTION_COLORS[action] ?? "#475569"
                          }}>
                          {ACTION_LABELS[action] ?? action}: {count}
                        </span>
                      ))}
                      {Object.keys(u.actions).length > 3 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          +{Object.keys(u.actions).length - 3} more
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); exportUserCSV(u, recentLogs, activityData.days); }}
                      className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600"
                      title="Export this user's activity">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity feed with filter */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 flex items-center gap-3 flex-wrap">
          <Activity className="h-4 w-4 text-slate-500 shrink-0" />
          <h3 className="font-semibold text-slate-800">Activity feed</h3>
          <input
            type="text"
            placeholder="Filter by user, action, ID…"
            value={feedFilter}
            onChange={(e) => setFeedFilter(e.target.value)}
            className="ml-auto h-8 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 w-52"
          />
          <span className="text-xs text-slate-400 shrink-0">{filteredLogs.length} entries</span>
        </div>
        <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
          {filteredLogs.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No matching logs</p>
          )}
          {filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/60">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: ACTION_COLORS[log.action] ?? RESOURCE_COLORS[log.resource] ?? "#94a3b8" }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-semibold text-slate-800">{log.admin?.name ?? "System"}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {log.admin?.role?.displayName ?? "—"}
                  </span>
                  <span className="text-xs font-medium" style={{color: ACTION_COLORS[log.action] ?? "#475569"}}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  {log.resourceId && (
                    <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {log.resourceId}
                    </span>
                  )}
                </div>
                {log.details && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {Object.entries(log.details as Record<string,unknown>)
                      .filter(([k]) => !["submissionId","trigger"].includes(k))
                      .map(([k,v]) => `${k}: ${String(v)}`).join(" · ")}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">
                {fmtDateTime(log.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────────────────── */
export const ReportsPage = () => {
  const [activeTab, setActiveTab]   = useState<"analytics" | "activity" | "published">("analytics");
  const [data, setData]             = useState<ReportsPayload | null>(null);
  const [activityData, setActivityData] = useState<ActivityPayload | null>(null);
  const [loading, setLoading]       = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityDays, setActivityDays] = useState(30);
  const [publishedArticles, setPublishedArticles] = useState<Submission[]>([]);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; authorName: string; coAuthors: string; abstract: string; keywords: string; pdfPublicPath: string; country: string; affiliations: string; pageStart: string; pageEnd: string; slug: string; }>({ title: "", authorName: "", coAuthors: "", abstract: "", keywords: "", pdfPublicPath: "", country: "", affiliations: "", pageStart: "", pageEnd: "", slug: "" });
  const joditConfig = useMemo(() => ({ height: 220, toolbarAdaptive: false, buttons: "bold,italic,underline,|,ul,ol,|,link,|,source", statusbar: false, showCharsCounter: false, showWordsCounter: false, showXPathInStatusbar: false }), []);
  const [saving, setSaving] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);

  const uploadReplacePdf = async (id: string, file: File) => {
    setPdfUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch(`/submissions/${encodeURIComponent(id)}/upload-production`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { pdfPublicPath?: string; url?: string };
      const url = data.pdfPublicPath ?? data.url ?? "";
      setEditForm((p) => ({ ...p, pdfPublicPath: url }));
      toast.success("PDF uploaded — save to confirm");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setPdfUploading(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await reportsService.get()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load reports"); setData(null); }
    finally { setLoading(false); }
  }, []);

  const loadActivity = useCallback(async (days: number) => {
    setActivityLoading(true);
    try { setActivityData(await reportsService.getActivity(days)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load activity"); }
    finally { setActivityLoading(false); }
  }, []);

  const loadPublished = useCallback(async () => {
    setPublishedLoading(true);
    try { setPublishedArticles(await apiJson<Submission[]>("/submissions/published")); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load published articles"); }
    finally { setPublishedLoading(false); }
  }, []);

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        pageStart: editForm.pageStart ? parseInt(editForm.pageStart) : null,
        pageEnd: editForm.pageEnd ? parseInt(editForm.pageEnd) : null,
      };
      await apiJson(`/submissions/${encodeURIComponent(id)}/published`, { method: "PATCH", body: JSON.stringify(payload) });
      toast.success("Article updated");
      setEditingId(null);
      void loadPublished();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  useEffect(() => {
    if (activeTab === "activity") void loadActivity(activityDays);
    if (activeTab === "published") void loadPublished();
  }, [activeTab, activityDays, loadActivity, loadPublished]);

  const handlePrint = () => {
    // add class to body → CSS hides everything except our section
    document.body.classList.add("printing-report");
    window.print();
    document.body.classList.remove("printing-report");
  };

  if (loading) {
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <p className="text-sm">Loading analytics…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="space-y-4">
        <h1 className="font-heading text-3xl text-slate-900">Reports</h1>
        <p className="text-red-600">Could not load report data.</p>
        <button type="button" onClick={() => void load()}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
          Retry
        </button>
      </section>
    );
  }

  const { summary } = data;
  const usdFmt = `$${summary.totalRevenueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const inrFmt = `₹${summary.totalRevenueInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const statusPie = data.submissionsByStatus.map((s, i) => ({
    name: s.label, value: s.count,
    fill: STATUS_COLORS[s.label] ?? PIE_FALLBACK[i % PIE_FALLBACK.length]
  }));

  return (
    <section id="report-section" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-slate-900">Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live data — submissions, revenue, DOI, user activity · Generated {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="no-print flex gap-2">
          {activeTab === "analytics" ? (
            <>
              <button type="button" onClick={() => void load()}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Refresh
              </button>
              <button type="button" onClick={() => downloadExcel(data)}
                className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50">
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel (CSV)
              </button>
              <button type="button" onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                <Printer className="h-4 w-4" />
                Download PDF
              </button>
            </>
          ) : (
            <>
              <select
                value={activityDays}
                onChange={(e) => setActivityDays(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button type="button" onClick={() => void loadActivity(activityDays)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Refresh
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        {([["analytics", "Analytics", FileText], ["activity", "User Activity", Activity], ["published", "Published Articles", BookOpen]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button"
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Activity tab */}
      {activeTab === "activity" && (
        activityLoading
          ? <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>
          : activityData
            ? <ActivityTab activityData={activityData} />
            : <p className="text-sm text-slate-400 py-8 text-center">No activity data</p>
      )}

      {/* Analytics tab */}
      {activeTab === "analytics" && <>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total submissions" value={String(summary.totalSubmissions)}
          sub={`${summary.published} published`} icon={FileText} accent="green" />
        <StatCard title="Under review" value={String(summary.underReview)}
          sub={`${summary.accepted} accepted`} icon={BookOpen} accent="blue" />
        <StatCard title="Revenue (paid)" value={usdFmt}
          sub={inrFmt} icon={DollarSign} accent="teal" />
        <StatCard title="DOI &amp; invoices" value={`${summary.mintedDoi} minted`}
          sub={`${summary.pendingDoi} DOI pending · ${summary.pendingInvoices} invoices pending`}
          icon={Hash} accent="amber" />
      </div>

      {/* Monthly charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Submissions trend" subtitle="New vs published — last 6 months">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlySubmissions} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="submissions" name="New" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="published"   name="Published" fill="#16a34a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue trend" subtitle="Paid APC — last 6 months">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="usd" name="USD ($)" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="inr" name="INR (₹)" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Status + Journal + Invoice charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="By status" subtitle="All submissions">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={95} innerRadius={30}
                label={({ name, percent }) =>
                  `${String(name).slice(0,6)} ${((percent as number) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {statusPie.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.fill || PIE_FALLBACK[i % PIE_FALLBACK.length]!} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By journal" subtitle="All submissions">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.submissionsByJournal} layout="vertical" margin={{ left: 4, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={64} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" name="Submissions" fill="#16a34a" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Invoice status" subtitle="All time">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.paymentsByStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Invoices" fill="#059669" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Summary table — printable */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden print:shadow-none">
        <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Summary breakdown</h3>
          <span className="text-xs text-slate-400">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Pending",          value: summary.pending },
            { label: "Under review",     value: summary.underReview },
            { label: "Accepted",         value: summary.accepted },
            { label: "Rejected",         value: summary.rejected },
            { label: "Published",        value: summary.published },
            { label: "Paid invoices",    value: summary.paidInvoices },
            { label: "Pending invoices", value: summary.pendingInvoices },
            { label: "DOI minted",       value: summary.mintedDoi }
          ].map((r) => (
            <div key={r.label} className="bg-white px-5 py-4">
              <p className="text-xs text-slate-500">{r.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{r.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly data tables — visible in print */}
      <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden print:shadow-none">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="font-semibold text-slate-800">Monthly submissions</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left">Month</th>
                <th className="px-4 py-2 text-right">New</th>
                <th className="px-4 py-2 text-right">Published</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlySubmissions.map((m) => (
                <tr key={m.month} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-700">{m.month}</td>
                  <td className="px-4 py-2 text-right font-medium text-blue-700">{m.submissions}</td>
                  <td className="px-4 py-2 text-right font-medium text-green-700">{m.published}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden print:shadow-none">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="font-semibold text-slate-800">Monthly revenue</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left">Month</th>
                <th className="px-4 py-2 text-right">USD</th>
                <th className="px-4 py-2 text-right">INR</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlyRevenue.map((m) => (
                <tr key={m.month} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-700">{m.month}</td>
                  <td className="px-4 py-2 text-right font-medium text-green-700">${m.usd.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-medium text-teal-700">₹{m.inr.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </> /* end analytics tab */}

      {activeTab === "published" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Published Articles</h2>
            <button type="button" onClick={() => void loadPublished()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Refresh
            </button>
          </div>
          {publishedLoading ? (
            <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
          ) : publishedArticles.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">No published articles yet.</p>
          ) : (
            <div className="space-y-3">
              {publishedArticles.map((art) => (
                <div key={art.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-green-700">{art.id}</span>
                        <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">{art.journalId}</span>
                        {art.country && <span className="text-xs text-slate-400">{art.country}</span>}
                      </div>
                      <p className="font-semibold text-slate-800 line-clamp-2">{art.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{art.authorName}{art.coAuthors ? `, ${art.coAuthors}` : ""}</p>
                      {art.keywords && <p className="mt-1 text-xs text-slate-400 line-clamp-1">🏷 {art.keywords}</p>}
                      {art.pdfPublicPath && (
                        <a href={art.pdfPublicPath} target="_blank" rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <Download size={11} /> PDF
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button type="button"
                        onClick={() => {
                          setEditingId(art.id);
                          setEditForm({
                            title: art.title, authorName: art.authorName,
                            coAuthors: art.coAuthors ?? "", abstract: art.abstract,
                            keywords: art.keywords, pdfPublicPath: art.pdfPublicPath ?? "",
                            country: art.country ?? "", affiliations: art.affiliations ?? "",
                            pageStart: art.pageStart != null ? String(art.pageStart) : "",
                            pageEnd: art.pageEnd != null ? String(art.pageEnd) : "",
                            slug: art.slug ?? ""
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                        <Pencil size={12} /> Edit
                      </button>
                      <button type="button"
                        disabled={!art.pdfPublicPath}
                        onClick={() => art.pdfPublicPath && window.open(art.pdfPublicPath, "_blank")}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-40">
                        <Download size={12} /> Publish Paper
                      </button>
                      <button type="button"
                        onClick={async () => {
                          try {
                            const inv = await apiJson<{ id: string }>(`/invoices/from-submission/${encodeURIComponent(art.id)}`, { method: "POST" });
                            const invoiceId = inv?.id ?? art.id;
                            window.open(`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`, "_blank");
                          } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-700 hover:bg-green-100">
                        <FileText size={12} /> Invoice
                      </button>
                      <a href={`/api/certificate/${encodeURIComponent(art.id)}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100">
                        <Download size={12} /> Certificate
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {editingId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
                <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-800">Edit Article</h2>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-slate-600">Title
                      <input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-medium text-slate-600">Author Name
                        <input value={editForm.authorName} onChange={(e) => setEditForm((p) => ({ ...p, authorName: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">Co-Authors
                        <input value={editForm.coAuthors} onChange={(e) => setEditForm((p) => ({ ...p, coAuthors: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </label>
                    </div>
                    <label className="block text-xs font-medium text-slate-600">Affiliations
                      <input value={editForm.affiliations} onChange={(e) => setEditForm((p) => ({ ...p, affiliations: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </label>
                    <div className="block text-xs font-medium text-slate-600">Abstract
                      <div className="mt-1">
                        <JoditEditor
                          value={editForm.abstract}
                          config={joditConfig}
                          onBlur={(val) => setEditForm((p) => ({ ...p, abstract: val }))}
                        />
                      </div>
                    </div>
                    <label className="block text-xs font-medium text-slate-600">Keywords
                      <input value={editForm.keywords} onChange={(e) => setEditForm((p) => ({ ...p, keywords: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="block text-xs font-medium text-slate-600">Country
                        <input value={editForm.country} onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">Page Start
                        <input type="number" value={editForm.pageStart} onChange={(e) => setEditForm((p) => ({ ...p, pageStart: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">Page End
                        <input type="number" value={editForm.pageEnd} onChange={(e) => setEditForm((p) => ({ ...p, pageEnd: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </label>
                    </div>
                    <label className="block text-xs font-medium text-slate-600">Slug (URL)
                      <input value={editForm.slug} onChange={(e) => setEditForm((p) => ({ ...p, slug: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono" />
                    </label>
                    <div className="block text-xs font-medium text-slate-600">
                      Replace PDF File
                      <div className="mt-1 flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                          <Upload size={12} />
                          {pdfUploading ? "Uploading…" : "Choose PDF"}
                          <input type="file" accept=".pdf" className="hidden"
                            disabled={pdfUploading}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f && editingId) void uploadReplacePdf(editingId, f); e.target.value = ""; }} />
                        </label>
                        {editForm.pdfPublicPath && (
                          <a href={editForm.pdfPublicPath} target="_blank" rel="noreferrer"
                            className="text-xs text-green-700 hover:underline truncate max-w-[180px]">
                            {editForm.pdfPublicPath.split("/").pop() ?? "current.pdf"}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="button" disabled={saving} onClick={() => void saveEdit(editingId)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                        <Check size={14} /> {saving ? "Saving…" : "Save Changes"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          )}
        </div>
      )}
    </section>
  );
};
