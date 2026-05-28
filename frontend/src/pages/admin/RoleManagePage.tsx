import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { ROLE_PAGE_MATRIX } from "@/constants/rolePageMatrix";
import { roleService } from "@/services/role.service";
import type { Role } from "@/types";

function permKey(p: { resource: string; action: string }): string {
  return `${p.resource}:${p.action}`;
}

function idsForPages(
  selected: Set<string>,
  permByKey: Map<string, string>
): string[] {
  const out = new Set<string>();
  for (const page of ROLE_PAGE_MATRIX) {
    if (!selected.has(page.specId)) continue;
    for (const k of page.perms) {
      const id = permByKey.get(k);
      if (id) out.add(id);
    }
  }
  return [...out];
}

function pagesForRole(role: Role, permByKey: Map<string, string>): Set<string> {
  const keys = new Set(
    (role.permissions ?? []).map((rp) => permKey(rp.permission)).filter(Boolean)
  );
  const selected = new Set<string>();
  for (const page of ROLE_PAGE_MATRIX) {
    const need = page.perms.filter((k) => permByKey.has(k));
    if (need.length === 0) continue;
    if (need.every((k) => keys.has(k))) selected.add(page.specId);
  }
  return selected;
}

export const RoleManagePage = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Array<{ id: string; resource: string; action: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | { edit: Role } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [internalName, setInternalName] = useState("");
  const [selectedPages, setSelectedPages] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const permByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of perms) m.set(permKey(p), p.id);
    return m;
  }, [perms]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([roleService.list(), roleService.listPermissions()]);
      setRoles(r);
      setPerms(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load roles");
      setRoles([]);
      setPerms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const openCreate = () => {
    setModal("create");
    setDisplayName("");
    setDescription("");
    setInternalName(`role_${Date.now().toString(36)}`);
    setSelectedPages(new Set());
  };

  const openEdit = (role: Role) => {
    if (role.name === "super_admin") return;
    setModal({ edit: role });
    setDisplayName(role.displayName);
    setDescription(role.description ?? "");
    setInternalName(role.name);
    setSelectedPages(pagesForRole(role, permByKey));
  };

  const closeModal = () => {
    setModal(null);
  };

  const togglePage = (specId: string) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  };

  const onSave = async () => {
    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    const permissionIds = idsForPages(selectedPages, permByKey);
    if (permissionIds.length === 0) {
      toast.error("Select at least one page permission");
      return;
    }
    setSaving(true);
    try {
      if (modal === "create") {
        const name = internalName.trim() || `role_${Date.now().toString(36)}`;
        await roleService.create({
          name,
          displayName: displayName.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          permissionIds
        });
        toast.success("Role created");
      } else if (modal && "edit" in modal) {
        await roleService.update(modal.edit.id, {
          displayName: displayName.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          permissionIds
        });
        toast.success("Role updated");
      }
      closeModal();
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (role: Role) => {
    if (role.name === "super_admin" || ["editor", "accountant", "reviewer"].includes(role.name)) {
      toast.error("This role cannot be deleted");
      return;
    }
    if (!window.confirm(`Delete role “${role.displayName}”?`)) return;
    try {
      await roleService.remove(role.id);
      toast.success("Role deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl text-gray-900">Roles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Page access maps to backend permissions. System routes (Users, Settings, Roles) stay super-admin only.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          Create role
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="h-8 w-full rounded bg-gray-100" />
          <div className="h-24 w-full rounded bg-gray-50" />
        </div>
      ) : roles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">No roles found. Click "Create Role" to add one.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => (
            <article key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading text-lg text-gray-900">{r.displayName}</h2>
                  <p className="font-mono text-xs text-gray-500">{r.name}</p>
                  {r.description ? <p className="mt-2 text-sm text-gray-600">{r.description}</p> : null}
                  <p className="mt-2 text-xs text-gray-500">{r.users?.length ?? 0} user(s)</p>
                </div>
                {r.name === "super_admin" ? (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">Built-in</span>
                ) : (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="Edit"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => void onDelete(r)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-xl text-gray-900">{modal === "create" ? "Create role" : "Edit role"}</h2>
              <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={closeModal} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modal === "create" ? (
              <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-gray-600">
                Internal name (unique)
                <input
                  value={internalName}
                  onChange={(e) => setInternalName(e.target.value)}
                  className="h-10 rounded-lg border border-gray-200 px-3 font-mono text-sm"
                />
              </label>
            ) : null}

            <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-gray-600">
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
              />
            </label>
            <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-gray-600">
              Description (optional)
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Page access</p>
            <div className="mt-2 grid max-h-[40vh] gap-2 overflow-y-auto rounded-lg border border-gray-100 p-3 sm:grid-cols-2">
              {ROLE_PAGE_MATRIX.map((page) => (
                <label key={page.specId} className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600"
                    checked={selectedPages.has(page.specId)}
                    onChange={() => togglePage(page.specId)}
                  />
                  <span>{page.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Save
              </button>
              <button type="button" className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
