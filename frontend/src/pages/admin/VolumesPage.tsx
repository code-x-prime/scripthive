import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { apiJson } from "@/services/api";

const JOURNALS = [
  { id: "SGJVSR" }, { id: "SGMRJ"  }, { id: "SGJPLS" },
  { id: "SGJETR" }, { id: "SGJSSH" }, { id: "SGJASH" }
];

interface Part   { id: number; name: string; issueId: number }
interface Issue  { id: number; number: number; period?: string | null; volumeId: number; parts: Part[] }
interface Volume { id: number; number: number; year: number; journalId: string; issues: Issue[] }

export const VolumesPage = () => {
  const [journalId, setJournalId] = useState(JOURNALS[0]!.id);
  const [volumes, setVolumes]     = useState<Volume[]>([]);
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState<Record<number, boolean>>({});
  const [saving,   setSaving]     = useState(false);

  // create forms
  const [newVol,  setNewVol]  = useState({ number: "", year: new Date().getFullYear().toString() });
  const [newIss,  setNewIss]  = useState<Record<number, { number: string; period: string }>>({});
  const [newPart, setNewPart] = useState<Record<number, string>>({});

  // edit states
  const [editVol,  setEditVol]  = useState<Record<number, string>>({});           // volumeId → year
  const [editIss,  setEditIss]  = useState<Record<number, string>>({});           // issueId  → period
  const [editPart, setEditPart] = useState<Record<number, string>>({});           // partId   → name

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<Volume[]>(`/publish/volumes?journalId=${encodeURIComponent(journalId)}`);
      setVolumes(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, [journalId]);

  useEffect(() => { void load(); }, [load]);

  /* ── CREATE ── */
  const addVolume = async () => {
    if (!newVol.number || !newVol.year) { toast.error("Fill volume number and year"); return; }
    setSaving(true);
    try {
      await apiJson("/publish/volumes", { method: "POST", body: JSON.stringify({ journalId, number: Number(newVol.number), year: Number(newVol.year) }) });
      toast.success("Volume saved");
      setNewVol({ number: "", year: new Date().getFullYear().toString() });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const addIssue = async (volumeId: number) => {
    const f = newIss[volumeId];
    if (!f?.number) { toast.error("Fill issue number"); return; }
    setSaving(true);
    try {
      await apiJson("/publish/issues", { method: "POST", body: JSON.stringify({ volumeId, number: Number(f.number), period: f.period || null }) });
      toast.success("Issue saved");
      setNewIss((p) => ({ ...p, [volumeId]: { number: "", period: "" } }));
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const addPart = async (issueId: number) => {
    const name = newPart[issueId]?.trim();
    if (!name) { toast.error("Enter part name"); return; }
    setSaving(true);
    try {
      await apiJson("/publish/parts", { method: "POST", body: JSON.stringify({ issueId, name }) });
      toast.success("Part saved");
      setNewPart((p) => ({ ...p, [issueId]: "" }));
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  /* ── UPDATE ── */
  const saveVolume = async (id: number) => {
    const year = editVol[id];
    if (!year) return;
    setSaving(true);
    try {
      await apiJson(`/publish/volumes/${id}`, { method: "PUT", body: JSON.stringify({ year: Number(year) }) });
      toast.success("Volume updated");
      setEditVol((p) => { const n = { ...p }; delete n[id]; return n; });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const saveIssue = async (id: number) => {
    const period = editIss[id] ?? null;
    setSaving(true);
    try {
      await apiJson(`/publish/issues/${id}`, { method: "PUT", body: JSON.stringify({ period: period || null }) });
      toast.success("Issue updated");
      setEditIss((p) => { const n = { ...p }; delete n[id]; return n; });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const savePart = async (id: number) => {
    const name = editPart[id]?.trim();
    if (!name) { toast.error("Enter part name"); return; }
    setSaving(true);
    try {
      await apiJson(`/publish/parts/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
      toast.success("Part updated");
      setEditPart((p) => { const n = { ...p }; delete n[id]; return n; });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  /* ── DELETE ── */
  const delVolume = async (id: number, num: number) => {
    if (!window.confirm(`Delete Volume ${num}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await apiJson(`/publish/volumes/${id}`, { method: "DELETE" });
      toast.success("Volume deleted");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const delIssue = async (id: number, num: number) => {
    if (!window.confirm(`Delete Issue ${num}?`)) return;
    setSaving(true);
    try {
      await apiJson(`/publish/issues/${id}`, { method: "DELETE" });
      toast.success("Issue deleted");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const delPart = async (id: number, name: string) => {
    if (!window.confirm(`Delete Part ${name}?`)) return;
    setSaving(true);
    try {
      await apiJson(`/publish/parts/${id}`, { method: "DELETE" });
      toast.success("Part deleted");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const cls = "h-8 rounded-lg border border-gray-200 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl text-gray-900">Volumes &amp; Issues</h1>
        <p className="mt-1 text-sm text-gray-500">Create, edit, or delete volumes, issues, and parts per journal.</p>
      </div>

      {/* Journal selector */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Journal</span>
        <select value={journalId} onChange={(e) => setJournalId(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          {JOURNALS.map((j) => <option key={j.id} value={j.id}>{j.id}</option>)}
        </select>
      </div>

      {/* Add volume */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Add Volume</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Volume No.
            <input value={newVol.number} onChange={(e) => setNewVol((p) => ({ ...p, number: e.target.value }))}
              placeholder="e.g. 12" className={`${cls} w-24`} type="number" min={1} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Year
            <input value={newVol.year} onChange={(e) => setNewVol((p) => ({ ...p, year: e.target.value }))}
              placeholder="2026" className={`${cls} w-24`} type="number" min={2000} />
          </label>
          <button type="button" onClick={() => void addVolume()} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add Volume
          </button>
        </div>
      </div>

      {/* Volume list */}
      {loading ? (
        <div className="animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="h-8 w-1/3 rounded bg-gray-100" />
        </div>
      ) : volumes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-10 text-center text-sm text-gray-400">
          No volumes yet for {journalId}.
        </p>
      ) : (
        <div className="space-y-3">
          {volumes.map((vol) => (
            <div key={vol.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
              {/* Volume header */}
              <div className="flex items-center gap-2 px-4 py-3">
                <button type="button" onClick={() => setExpanded((p) => ({ ...p, [vol.id]: !p[vol.id] }))}>
                  {expanded[vol.id] ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                </button>
                <button type="button" className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => setExpanded((p) => ({ ...p, [vol.id]: !p[vol.id] }))}>
                  <span className="font-semibold text-gray-900">Volume {vol.number}</span>
                  {/* edit year inline */}
                  {editVol[vol.id] !== undefined ? (
                    <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input type="number" value={editVol[vol.id]} onChange={(e) => setEditVol((p) => ({ ...p, [vol.id]: e.target.value }))}
                        className={`${cls} w-24`} />
                      <button type="button" onClick={() => void saveVolume(vol.id)} disabled={saving}
                        className="rounded p-1 text-green-600 hover:bg-green-50"><Check className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setEditVol((p) => { const n={...p}; delete n[vol.id]; return n; })}
                        className="rounded p-1 text-gray-400 hover:bg-gray-50"><X className="h-4 w-4" /></button>
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Year {vol.year}</span>
                  )}
                  <span className="text-xs text-gray-400">{vol.issues.length} issue{vol.issues.length !== 1 ? "s" : ""}</span>
                </button>
                {/* volume actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button type="button" title="Edit year"
                    onClick={() => setEditVol((p) => ({ ...p, [vol.id]: String(vol.year) }))}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Delete volume"
                    onClick={() => void delVolume(vol.id, vol.number)}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {expanded[vol.id] && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  {/* Issues */}
                  {vol.issues.map((iss) => (
                    <div key={iss.id} className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-800">
                          Issue {iss.number}
                          {/* edit period */}
                          {editIss[iss.id] !== undefined ? (
                            <span className="flex items-center gap-1.5">
                              <input value={editIss[iss.id]} onChange={(e) => setEditIss((p) => ({ ...p, [iss.id]: e.target.value }))}
                                placeholder="Jan-Mar 2026" className={`${cls} w-36`} />
                              <button type="button" onClick={() => void saveIssue(iss.id)} disabled={saving}
                                className="rounded p-1 text-green-600 hover:bg-green-50"><Check className="h-4 w-4" /></button>
                              <button type="button" onClick={() => setEditIss((p) => { const n={...p}; delete n[iss.id]; return n; })}
                                className="rounded p-1 text-gray-400 hover:bg-gray-50"><X className="h-4 w-4" /></button>
                            </span>
                          ) : (
                            iss.period && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{iss.period}</span>
                          )}
                          <span className="text-xs font-normal text-gray-400">— {iss.parts.length} part{iss.parts.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" title="Edit period"
                            onClick={() => setEditIss((p) => ({ ...p, [iss.id]: iss.period ?? "" }))}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" title="Delete issue"
                            onClick={() => void delIssue(iss.id, iss.number)}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Parts */}
                      {iss.parts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {iss.parts.map((p) => (
                            <span key={p.id} className="flex items-center gap-1 rounded-full border border-green-200 bg-green-50 pl-3 pr-1 py-0.5 text-xs font-semibold text-green-700">
                              {editPart[p.id] !== undefined ? (
                                <>
                                  <input value={editPart[p.id]} onChange={(e) => setEditPart((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                    className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-xs font-normal text-gray-900 focus:outline-none" maxLength={20} />
                                  <button type="button" onClick={() => void savePart(p.id)} disabled={saving}
                                    className="rounded p-0.5 text-green-600 hover:bg-green-100"><Check className="h-3 w-3" /></button>
                                  <button type="button" onClick={() => setEditPart((prev) => { const n={...prev}; delete n[p.id]; return n; })}
                                    className="rounded p-0.5 text-gray-400 hover:bg-gray-100"><X className="h-3 w-3" /></button>
                                </>
                              ) : (
                                <>
                                  {p.name}
                                  <button type="button" title="Edit part name"
                                    onClick={() => setEditPart((prev) => ({ ...prev, [p.id]: p.name }))}
                                    className="ml-1 rounded p-0.5 text-green-500 hover:bg-green-100">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button type="button" title="Delete part"
                                    onClick={() => void delPart(p.id, p.name)}
                                    className="rounded p-0.5 text-red-400 hover:bg-red-50">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add part — free text */}
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={newPart[iss.id] ?? ""}
                          onChange={(e) => setNewPart((p) => ({ ...p, [iss.id]: e.target.value }))}
                          placeholder="Part name (A / Special Issue / etc.)"
                          className={`${cls} w-52`}
                          maxLength={30}
                        />
                        <button type="button" onClick={() => void addPart(iss.id)} disabled={saving}
                          className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-50">
                          <Plus className="h-3.5 w-3.5" /> Add Part
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add issue */}
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-gray-200 p-3">
                    <span className="text-xs font-semibold text-gray-400">Add Issue:</span>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      No.
                      <input
                        value={newIss[vol.id]?.number ?? ""}
                        onChange={(e) => setNewIss((p) => ({ ...p, [vol.id]: { ...(p[vol.id] ?? { number: "", period: "" }), number: e.target.value } }))}
                        placeholder="1" className={`${cls} w-16`} type="number" min={1} />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      Period
                      <input
                        value={newIss[vol.id]?.period ?? ""}
                        onChange={(e) => setNewIss((p) => ({ ...p, [vol.id]: { ...(p[vol.id] ?? { number: "", period: "" }), period: e.target.value } }))}
                        placeholder="Jan-Mar 2026" className={`${cls} w-36`} />
                    </label>
                    <button type="button" onClick={() => void addIssue(vol.id)} disabled={saving}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                      <Plus className="h-3.5 w-3.5" /> Issue
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
