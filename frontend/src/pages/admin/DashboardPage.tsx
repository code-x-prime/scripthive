import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Pencil } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiJson } from "@/services/api";
import type { DashboardRecentManuscript, DashboardStatsResponse } from "@/types";

const journalBadgeStyles: Record<string, string> = {
  SGJVSR: "border-green-200 bg-green-50 text-green-800",
  SGMRJ: "border-teal-200 bg-teal-50 text-teal-800",
  SGJPLS: "border-cyan-200 bg-cyan-50 text-cyan-800",
  SGJETR: "border-green-200 bg-green-50 text-green-700",
  SGJSSH: "border-lime-200 bg-lime-50 text-lime-800",
  SGJASH: "border-green-200 bg-green-50 text-green-900"
};

function journalBadgeClass(code: string): string {
  return journalBadgeStyles[code] ?? "border-gray-200 bg-gray-50 text-gray-800";
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        —
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function JournalNameCell({ row }: { row: DashboardRecentManuscript }) {
  return (
    <span
      title={row.journalName}
      className={`inline-flex w-fit max-w-full rounded-full border px-2.5 py-0.5 text-xs font-semibold ${journalBadgeClass(row.journalCode)}`}
    >
      {row.journalCode}
    </span>
  );
}

function displayAuthors(authors: string[]): string {
  const list = authors.filter((s) => s.trim().length > 0 && s.toLowerCase() !== "undefined");
  return list.length > 0 ? list.join(", ") : "—";
}

function StatsSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="h-4 w-28 rounded bg-gray-200" />
          <div className="mt-3 flex justify-between gap-2">
            <div className="h-8 w-20 rounded bg-gray-200" />
            <div className="h-6 w-14 rounded-full bg-gray-100" />
          </div>
          <div className="mt-2 h-3 w-24 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="hidden h-8 w-full rounded bg-gray-100 md:block" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 w-full rounded-lg bg-gray-50 md:h-10" />
      ))}
    </div>
  );
}

function useRowSelection(rows: DashboardRecentManuscript[]) {
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectAllDesktopRef = useRef<HTMLInputElement>(null);
  const selectAllMobileRef = useRef<HTMLInputElement>(null);

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));

  useEffect(() => {
    const indeterminate = someSelected && !allSelected;
    for (const el of [selectAllDesktopRef.current, selectAllMobileRef.current]) {
      if (el) el.indeterminate = indeterminate;
    }
  }, [someSelected, allSelected]);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(ids) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return { selected, selectAllDesktopRef, selectAllMobileRef, allSelected, toggleAll, toggleOne };
}

function RecentManuscriptsTables({ rows }: { rows: DashboardRecentManuscript[] }) {
  const { selected, selectAllDesktopRef, selectAllMobileRef, allSelected, toggleAll, toggleOne } =
    useRowSelection(rows);

  return (
    <>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="min-w-[880px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="w-10 px-3 py-3">
                <span className="sr-only">Select</span>
                <input
                  ref={selectAllDesktopRef}
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  aria-label="Select all manuscripts in this list"
                />
              </th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Title</th>
              <th className="min-w-[120px] px-4 py-3">Journal</th>
              <th className="min-w-[160px] px-4 py-3">Author</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80">
                <td className="px-3 py-3 align-middle">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    checked={selected.has(row.id)}
                    onChange={(e) => toggleOne(row.id, e.target.checked)}
                    aria-label={`Select ${row.id}`}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-medium text-green-700">
                  {row.id}
                </td>
                <td className="max-w-[240px] px-4 py-3 font-medium text-gray-900">
                  <span className="line-clamp-2">{row.title}</span>
                </td>
                <td className="px-4 py-3 align-middle">
                  <JournalNameCell row={row} />
                </td>
                <td className="max-w-[200px] px-4 py-3 text-sm text-gray-800">
                  <span className="line-clamp-2">{displayAuthors(row.authors)}</span>
                </td>
                <td className="px-4 py-3 align-middle">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-right align-middle">
                  <Link
                    to={`/admin/submissions/${row.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-900"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3 md:hidden">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <input
            ref={selectAllMobileRef}
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            checked={allSelected}
            onChange={(e) => toggleAll(e.target.checked)}
            aria-label="Select all manuscripts in this list"
          />
          <span className="text-xs font-medium text-gray-600">Select all on this page</span>
        </div>
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500"
                checked={selected.has(row.id)}
                onChange={(e) => toggleOne(row.id, e.target.checked)}
                aria-label={`Select ${row.id}`}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-green-700">{row.id}</span>
                  <StatusBadge status={row.status} />
                </div>
                <p className="font-medium leading-snug text-gray-900">{row.title}</p>
                <JournalNameCell row={row} />
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Author: </span>
                  {displayAuthors(row.authors)}
                </p>
                <div className="pt-1">
                  <Link
                    to={`/admin/submissions/${row.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:border-green-300 hover:bg-green-50"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await apiJson<DashboardStatsResponse>("/dashboard/stats");
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load dashboard");
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = stats?.recentManuscripts ?? [];
  const manuscriptListKey = rows.map((r) => r.id).join(",");

  const statCards = stats
    ? [
        {
          label: "Total Submissions",
          value: String(stats.totalSubmissions),
          badge: <ChangeBadge value={stats.changes.totalSubmissionsPercent} />
        },
        {
          label: "Pending Reviews",
          value: String(stats.pendingReviews),
          badge: <ChangeBadge value={stats.changes.pendingReviewsPercent} />
        },
        {
          label: "Pending Preparation",
          value: String(stats.pendingPreparation),
          badge: <ChangeBadge value={stats.changes.pendingPreparationPercent} />
        },
        {
          label: "Pending Published Article",
          value: String(stats.pendingPublished),
          badge: <ChangeBadge value={stats.changes.pendingPublishedPercent} />
        }
      ]
    : [];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-0">
      <h1 className="font-heading text-3xl text-gray-900">Dashboard</h1>

      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => (
            <article
              key={stat.label}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                <p className="min-w-0 break-words font-heading text-2xl text-gray-900">{stat.value}</p>
                {stat.badge}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                {stat.label === "Pending Published Article"
                  ? "Paid APC, awaiting publication · change vs previous month"
                  : "Change vs previous calendar month"}
              </p>
            </article>
          ))}
        </div>
      )}

      <section className="mt-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-xl text-gray-900">Recent Manuscripts</h2>
          <Link
            to="/admin/submissions/new"
            className="text-sm font-medium text-green-700 hover:text-green-800 hover:underline"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
            No submissions yet.
          </p>
        ) : (
          <RecentManuscriptsTables key={manuscriptListKey} rows={rows} />
        )}
      </section>
    </main>
  );
};
