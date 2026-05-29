import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check, Hash, Mail, Pencil, Phone, Plus, Trash2, Upload, Users } from "lucide-react";
import { apiJson } from "@/services/api";

interface EditorialMember {
  id: string;
  name: string;
  role: string;
  institution: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
}

interface JournalAdmin {
  id: string;
  name: string;
  issn?: string | null;
  eIssn?: string | null;
  status: string;
  publishedPaperCount: number;
  editorialBoard: EditorialMember[];
  doiPrefix?: string | null;
  websiteDoiLink?: string | null;
}

type MemberForm = {
  name: string;
  role: string;
  institution: string;
  email: string;
  phone: string;
  photoUrl: string;
};

const emptyMemberForm = (): MemberForm => ({
  name: "",
  role: "",
  institution: "",
  email: "",
  phone: "",
  photoUrl: ""
});

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isValidEmail(value: string): boolean {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const JournalsManagePage = () => {
  const [journals, setJournals] = useState<JournalAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIssn, setEditingIssn] = useState<string | null>(null);
  const [issnValues, setIssnValues] = useState<Record<string, { issn: string; eIssn: string }>>({});
  const [editingDoi, setEditingDoi] = useState<string | null>(null);
  const [doiValues, setDoiValues] = useState<Record<string, { doiPrefix: string; websiteDoiLink: string }>>({});
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<MemberForm>(emptyMemberForm);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      if (!res.ok) throw new Error("Photo upload failed");
      const data = await res.json() as { files: { url: string }[] };
      const url = data.files?.[0]?.url ?? "";
      setMemberForm((p) => ({ ...p, photoUrl: url }));
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<JournalAdmin[]>("/journals/admin");
      setJournals(data);
      const vals: Record<string, { issn: string; eIssn: string }> = {};
      const dVals: Record<string, { doiPrefix: string; websiteDoiLink: string }> = {};
      data.forEach((j) => {
        vals[j.id] = { issn: j.issn ?? "", eIssn: j.eIssn ?? "" };
        dVals[j.id] = { doiPrefix: j.doiPrefix ?? "", websiteDoiLink: j.websiteDoiLink ?? "" };
      });
      setIssnValues(vals);
      setDoiValues(dVals);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load journals");
      setJournals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const saveIssn = async (journalId: string) => {
    const val = issnValues[journalId];
    if (!val) return;
    setSaving(true);
    try {
      await apiJson(`/journals/admin/${encodeURIComponent(journalId)}/issn`, {
        method: "PUT",
        body: JSON.stringify({ issn: val.issn.trim() || null, eIssn: val.eIssn.trim() || null })
      });
      toast.success("ISSN saved successfully");
      setEditingIssn(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save ISSN");
    } finally {
      setSaving(false);
    }
  };

  const saveDoi = async (journalId: string) => {
    const val = doiValues[journalId];
    if (!val) return;
    setSaving(true);
    try {
      await apiJson(`/journals/admin/${encodeURIComponent(journalId)}/doi`, {
        method: "PUT",
        body: JSON.stringify({ doiPrefix: val.doiPrefix.trim() || null, websiteDoiLink: val.websiteDoiLink.trim() || null })
      });
      toast.success("DOI config saved");
      setEditingDoi(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save DOI config");
    } finally {
      setSaving(false);
    }
  };

  const addMember = async (journalId: string) => {
    if (!memberForm.name.trim() || !memberForm.role.trim() || !memberForm.institution.trim()) {
      toast.error("Please fill Name, Role, and Institution");
      return;
    }
    if (!isValidEmail(memberForm.email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: memberForm.name.trim(),
        role: memberForm.role.trim(),
        institution: memberForm.institution.trim(),
        email: memberForm.email.trim() || null,
        phone: memberForm.phone.trim() || null,
        photoUrl: memberForm.photoUrl.trim() || undefined
      };
      if (editingMember) {
        await apiJson(`/journals/${journalId}/editorial-board/${editingMember}`, {
          method: "PUT",
          body: JSON.stringify(body)
        });
        toast.success("Member updated");
      } else {
        await apiJson(`/journals/${journalId}/editorial-board`, {
          method: "POST",
          body: JSON.stringify(body)
        });
        toast.success("Member added");
      }
      setMemberForm(emptyMemberForm());
      setAddingMember(null);
      setEditingMember(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (journalId: string, memberId: string) => {
    if (!window.confirm("Remove this editorial board member?")) return;
    try {
      await apiJson(`/journals/${journalId}/editorial-board/${memberId}`, { method: "DELETE" });
      toast.success("Member removed");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  const toggleStatus = async (journalId: string) => {
    try {
      await apiJson(`/journals/admin/${encodeURIComponent(journalId)}/toggle-status`, { method: "PATCH" });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to toggle status");
    }
  };

  const openAddForm = (journalId: string) => {
    setAddingMember(addingMember === journalId ? null : journalId);
    setMemberForm(emptyMemberForm());
    setEditingMember(null);
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <h1 className="font-heading text-2xl font-bold text-slate-800">Manage Journals</h1>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-800">Manage Journals</h1>
        <p className="mt-1 text-sm text-slate-500">{journals.length} journals registered</p>
      </div>

      <div className="space-y-4">
        {journals.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
            No journals registered yet.
          </p>
        )}
        {journals.map((journal) => (
          <div key={journal.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between p-5">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-green-700">{journal.id}</span>
                  <button
                    type="button"
                    onClick={() => void toggleStatus(journal.id)}
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                      journal.status === "Active"
                        ? "border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {journal.status === "Active" ? "Active" : "Inactive"}
                  </button>
                </div>
                <h3 className="font-semibold text-slate-800">{journal.name}</h3>
                <p className="mt-0.5 text-xs text-slate-400">{journal.publishedPaperCount} Published Papers</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingIssn(editingIssn === journal.id ? null : journal.id);
                    setOpenBoard(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                >
                  <Pencil size={12} /> Edit ISSN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDoi(editingDoi === journal.id ? null : journal.id);
                    setEditingIssn(null);
                    setOpenBoard(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                >
                  <Hash size={12} /> DOI Config
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenBoard(openBoard === journal.id ? null : journal.id);
                    setEditingIssn(null);
                    setEditingDoi(null);
                    setAddingMember(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                >
                  <Users size={12} /> Editorial Board
                </button>
              </div>
            </div>

            {editingIssn === journal.id && (
              <div className="border-t border-amber-100 bg-amber-50 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-700">ISSN Numbers</p>
                <div className="flex flex-wrap gap-3">
                  <input
                    value={issnValues[journal.id]?.issn ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setIssnValues((p) => ({ ...p, [journal.id]: { issn: v, eIssn: p[journal.id]?.eIssn ?? "" } }));
                    }}
                    placeholder="ISSN (e.g. 2456-7890)"
                    className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    value={issnValues[journal.id]?.eIssn ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setIssnValues((p) => ({ ...p, [journal.id]: { issn: p[journal.id]?.issn ?? "", eIssn: v } }));
                    }}
                    placeholder="e-ISSN"
                    className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => void saveIssn(journal.id)}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    <Check size={14} /> Save ISSN
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIssn(null)}
                    className="rounded-lg border border-amber-200 px-4 py-2 text-xs text-amber-800 hover:bg-amber-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {editingDoi === journal.id && (
              <div className="border-t border-blue-100 bg-blue-50 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-700">DOI Configuration</p>
                <div className="flex flex-wrap gap-3">
                  <input
                    value={doiValues[journal.id]?.doiPrefix ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDoiValues((p) => ({ ...p, [journal.id]: { doiPrefix: v, websiteDoiLink: p[journal.id]?.websiteDoiLink ?? "" } }));
                    }}
                    placeholder="DOI Prefix (e.g. 10.55662)"
                    className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <input
                    value={doiValues[journal.id]?.websiteDoiLink ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDoiValues((p) => ({ ...p, [journal.id]: { doiPrefix: p[journal.id]?.doiPrefix ?? "", websiteDoiLink: v } }));
                    }}
                    placeholder="Website DOI Link (e.g. https://doi.org/...)"
                    className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button type="button" disabled={saving} onClick={() => void saveDoi(journal.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    <Check size={14} /> Save DOI
                  </button>
                  <button type="button" onClick={() => setEditingDoi(null)}
                    className="rounded-lg border border-blue-200 px-4 py-2 text-xs text-blue-800 hover:bg-blue-100">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {openBoard === journal.id && (
              <div className="border-t border-slate-100 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Editorial Board Members
                  </p>
                  <button
                    type="button"
                    onClick={() => openAddForm(journal.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <Plus size={12} /> Add Member
                  </button>
                </div>

                {addingMember === journal.id && (
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-green-300 bg-green-200 text-lg font-bold text-green-800">
                        {memberForm.photoUrl ? (
                          <img src={memberForm.photoUrl} alt="" className="h-full w-full object-cover" />
                        ) : memberForm.name ? (
                          getInitials(memberForm.name)
                        ) : (
                          "?"
                        )}
                      </div>
                      <div className="min-w-[200px] flex-1">
                        <p className="mb-1 text-xs text-slate-500">Photo (optional)</p>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); }}
                        />
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Upload size={12} />
                          {uploadingPhoto ? "Uploading..." : memberForm.photoUrl ? "Change Photo" : "Upload Photo"}
                        </button>
                      </div>
                    </div>
                    <div className="mb-3 grid gap-3 sm:grid-cols-3">
                      <input
                        placeholder="Full Name *"
                        value={memberForm.name}
                        onChange={(e) => setMemberForm((p) => ({ ...p, name: e.target.value }))}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <select
                        value={memberForm.role}
                        onChange={(e) => setMemberForm((p) => ({ ...p, role: e.target.value }))}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select Designation *</option>
                        <option value="Editor-in-Chief">Editor-in-Chief</option>
                        <option value="Managing Editor">Managing Editor</option>
                        <option value="Associate Editor">Associate Editor</option>
                        <option value="Editorial Board Member">Editorial Board Member</option>
                        <option value="Advisory Board Member">Advisory Board Member</option>
                      </select>
                      <input
                        placeholder="Institution *"
                        value={memberForm.institution}
                        onChange={(e) => setMemberForm((p) => ({ ...p, institution: e.target.value }))}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div className="mb-3 grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500">Email (optional)</span>
                        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus:ring-green-500">
                          <span className="flex items-center border-r border-slate-100 px-2 text-slate-400">
                            <Mail className="h-4 w-4" />
                          </span>
                          <input
                            type="email"
                            placeholder="editor@university.edu"
                            value={memberForm.email}
                            onChange={(e) => setMemberForm((p) => ({ ...p, email: e.target.value }))}
                            className="flex-1 px-3 py-2 text-sm outline-none"
                          />
                        </div>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500">Phone (optional)</span>
                        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus:ring-green-500">
                          <span className="flex items-center border-r border-slate-100 px-2 text-slate-400">
                            <Phone className="h-4 w-4" />
                          </span>
                          <input
                            type="tel"
                            placeholder="+91 98765 43210"
                            value={memberForm.phone}
                            onChange={(e) => setMemberForm((p) => ({ ...p, phone: e.target.value }))}
                            className="flex-1 px-3 py-2 text-sm outline-none"
                          />
                        </div>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void addMember(journal.id)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check size={12} /> {editingMember ? "Update Member" : "Add Member"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingMember(null);
                          setEditingMember(null);
                        }}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {journal.editorialBoard && journal.editorialBoard.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          {["#", "Photo", "Name", "Role", "Institution", "Email", "Phone", "Actions"].map((h) => (
                            <th
                              key={h}
                              className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {journal.editorialBoard.map((member, idx) => (
                          <tr key={member.id} className="hover:bg-slate-50">
                            <td className="py-3 pr-4 text-xs text-slate-400">{idx + 1}</td>
                            <td className="py-3 pr-4">
                              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-green-200 text-xs font-bold text-green-800">
                                {member.photoUrl ? (
                                  <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" />
                                ) : (
                                  getInitials(member.name)
                                )}
                              </div>
                            </td>
                            <td className="py-3 pr-4 font-medium text-slate-800">{member.name}</td>
                            <td className="py-3 pr-4 text-xs font-medium text-amber-600">{member.role}</td>
                            <td className="max-w-[140px] py-3 pr-4 text-xs text-slate-500">{member.institution}</td>
                            <td className="py-3 pr-4 text-xs text-slate-600">
                              {member.email ? (
                                <a href={`mailto:${member.email}`} className="text-green-700 hover:underline">
                                  {member.email}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 pr-4 text-xs text-slate-600">
                              {member.phone ? (
                                <a href={`tel:${member.phone.replace(/\s/g, "")}`} className="hover:underline">
                                  {member.phone}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-0.5 rounded border border-blue-200 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                                  onClick={() => {
                                    setEditingMember(member.id);
                                    setMemberForm({
                                      name: member.name,
                                      role: member.role,
                                      institution: member.institution,
                                      email: member.email ?? "",
                                      phone: member.phone ?? "",
                                      photoUrl: member.photoUrl ?? ""
                                    });
                                    setAddingMember(journal.id);
                                  }}
                                >
                                  <Pencil size={10} /> Edit
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-0.5 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                  onClick={() => void removeMember(journal.id, member.id)}
                                >
                                  <Trash2 size={10} /> Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-slate-400">
                    No members yet. Click &quot;+ Add Member&quot; to add the first one.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
