import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Download, Eye, X } from "lucide-react";
import { doiService, type DoiMintedRow } from "@/services/doi.service";
import type { Submission } from "@/types";
import { submissionAuthorsDisplay } from "@/utils/submissionAuthors";
import { buildCsv, downloadCsv } from "@/utils/exportCsv";
import { settingsService } from "@/services/settings.service";

export const DOIManagePage = () => {
  const { pathname } = useLocation();
  const isMinted = pathname.includes("/minted");
  const isNoDoi = pathname.includes("/no-doi");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Submission[]>([]);
  const [minted, setMinted] = useState<DoiMintedRow[]>([]);
  const [noDoi, setNoDoi] = useState<Submission[]>([]);
  const [modal, setModal] = useState<Submission | null>(null);
  const [vol, setVol] = useState("1");
  const [iss, setIss] = useState("1");
  const [part, setPart] = useState("A");
  const [saving, setSaving] = useState(false);
  const [doiPrefix, setDoiPrefix] = useState("10.55662");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isMinted) setMinted(await doiService.minted());
      else if (isNoDoi) setNoDoi(await doiService.noDoi());
      else setPending(await doiService.pending());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load DOI data");
      if (isMinted) setMinted([]);
      else if (isNoDoi) setNoDoi([]);
      else setPending([]);
    } finally {
      setLoading(false);
    }
  }, [isMinted, isNoDoi]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
      void settingsService.get().then((s) => { if (s.doi_prefix) setDoiPrefix(s.doi_prefix); }).catch(() => {});
    });
  }, [load]);

  const preview = useMemo(() => {
    if (!modal) return "";
    const jid = (modal.journal?.id ?? modal.journalId).toLowerCase();
    const v = parseInt(vol, 10) || 1;
    const i = parseInt(iss, 10) || 1;
    // slugify part: keep only alphanumeric, lowercase
    const partSlug = part.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const partSeg = partSlug && partSlug !== "a" ? partSlug : "";
    return `${doiPrefix}/${jid}.v${v}i${i}${partSeg}.XXX`; // ref no assigned on save
  }, [modal, vol, iss, part, doiPrefix]);

  const assign = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      await doiService.assign({
        submissionId: modal.id,
        journalId: modal.journal?.id ?? modal.journalId,
        volume: parseInt(vol, 10) || 1,
        issue: parseInt(iss, 10) || 1,
        part: part.trim() || "A"
      });
      toast.success("DOI assigned");
      setModal(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setSaving(false);
    }
  };

  const exportMinted = () => {
    if (!minted.length) return;
    const csv = buildCsv(minted, [
      { key: "submissionId", label: "Submission ID", getValue: (r) => r.submissionId },
      { key: "title", label: "Title", getValue: (r) => r.submission?.title ?? "" },
      { key: "authors", label: "Authors", getValue: (r) => r.submission ? submissionAuthorsDisplay(r.submission as Submission) : "" },
      { key: "journal", label: "Journal", getValue: (r) => r.submission?.journal?.id ?? "" },
      { key: "doi", label: "DOI", getValue: (r) => r.doi ?? "" },
      { key: "assigned", label: "Assigned Date", getValue: (r) => r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "" }
    ]);
    downloadCsv(csv, "doi-minted.csv");
  };

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-gray-900">
            {isMinted ? "Minted DOI" : isNoDoi ? "No DOI" : "Pending DOI"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isMinted ? "Assigned DOI records." : isNoDoi ? "Published articles without a DOI assigned." : "Accepted and paid submissions awaiting DOI assignment."}
          </p>
        </div>
        {isMinted && minted.length > 0 && (
          <button
            type="button"
            onClick={exportMinted}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="h-8 w-full rounded bg-gray-100" />
          <div className="h-10 w-full rounded bg-gray-50" />
        </div>
      ) : isMinted ? (
        minted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">No minted DOIs.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-[800px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Authors</th>
                  <th className="px-3 py-3">Journal</th>
                  <th className="px-3 py-3">DOI</th>
                  <th className="px-3 py-3">Assigned</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {minted.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-mono text-green-700">{r.submissionId}</td>
                    <td className="max-w-[220px] px-3 py-2 font-medium text-gray-900">{r.submission?.title ?? "—"}</td>
                    <td className="max-w-[160px] px-3 py-2 text-gray-800">
                      {r.submission ? submissionAuthorsDisplay(r.submission as Submission) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                        {r.submission?.journal?.id ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.doi ? (
                        <a className="text-blue-700 underline" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
                          {r.doi}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/admin/submissions/${r.submissionId}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                        title="View submission"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : isNoDoi ? (
        noDoi.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">All published articles have DOIs assigned.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Authors</th>
                  <th className="px-3 py-3">Journal</th>
                  <th className="px-3 py-3">Published</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {noDoi.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-mono text-green-700">
                      <Link to={`/admin/submissions/${s.id}`} className="hover:underline">{s.id}</Link>
                    </td>
                    <td className="max-w-[200px] px-3 py-2 font-medium text-gray-900">{s.title}</td>
                    <td className="max-w-[160px] px-3 py-2 text-gray-800">{submissionAuthorsDisplay(s)}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                        {s.journal?.id ?? s.journalId}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{new Date(s.updatedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        onClick={() => { setModal(s); setVol("1"); setIss("1"); setPart("A"); }}
                      >
                        Assign DOI
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">No pending DOI work.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-[900px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Title</th>
                <th className="px-3 py-3">Authors</th>
                <th className="px-3 py-3">Journal</th>
                <th className="px-3 py-3">Accepted</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((s) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-mono text-green-700">
                    <Link to={`/admin/submissions/${s.id}`} className="hover:underline">
                      {s.id}
                    </Link>
                  </td>
                  <td className="max-w-[200px] px-3 py-2 font-medium text-gray-900">{s.title}</td>
                  <td className="max-w-[160px] px-3 py-2 text-gray-800">{submissionAuthorsDisplay(s)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {s.journal?.id ?? s.journalId}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{new Date(s.updatedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                      onClick={() => {
                        setModal(s);
                        setVol("1");
                        setIss("1");
                        setPart("A");
                      }}
                    >
                      Assign DOI
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-heading text-lg text-gray-900">Assign DOI</h2>
              <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={() => setModal(null)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-700">{modal.title}</p>
            <p className="mt-1 text-xs text-gray-500">
              Journal: <span className="font-mono">{modal.journal?.id ?? modal.journalId}</span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Volume
                <input value={vol} onChange={(e) => setVol(e.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 text-sm" type="number" min={1} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Issue
                <input value={iss} onChange={(e) => setIss(e.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 text-sm" type="number" min={1} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Part <span className="font-normal text-gray-400">(A, B, AA…)</span>
                <input value={part} onChange={(e) => setPart(e.target.value.toUpperCase())} className="h-10 rounded-lg border border-gray-200 px-3 text-sm font-mono" placeholder="A" maxLength={4} />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-400">Part A = no suffix in DOI. Part B, AA etc → added as suffix.</p>
            <p className="mt-4 text-xs font-medium uppercase text-gray-500">Preview</p>
            <p className="mt-1 break-all font-mono text-sm text-blue-800">{preview}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void assign()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Confirm
              </button>
              <button type="button" className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
