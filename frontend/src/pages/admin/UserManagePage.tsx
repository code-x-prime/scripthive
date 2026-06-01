import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Eye, EyeOff, KeyRound, Pencil, Plus, Power, RefreshCw, Trash2, X } from "lucide-react";
import { userService, type AdminUserRow } from "@/services/user.service";
import { roleService } from "@/services/role.service";
import type { Role } from "@/types";

function generatePassword(len = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

export const UserManagePage = () => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<"create" | { edit: AdminUserRow } | null>(null);
  const [pwModal, setPwModal] = useState<AdminUserRow | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newPw, setNewPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([userService.list(), roleService.list()]);
      setUsers(u);
      setRoles(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const openCreate = () => {
    setModal("create");
    setName("");
    setUsername("");
    setPassword("");
    setShowPw(false);
    setRoleId(roles.find((r) => r.name !== "super_admin")?.id ?? "");
    setIsActive(true);
  };

  const openEdit = (u: AdminUserRow) => {
    setModal({ edit: u });
    setName(u.name);
    setUsername(u.username ?? "");
    setRoleId(u.roleId);
    setIsActive(u.isActive);
  };

  const closeModal = () => setModal(null);

  const onSave = async () => {
    if (!name.trim() || !username.trim() || !roleId) {
      toast.error("Name, username and role are required");
      return;
    }
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username.trim().toLowerCase())) {
      toast.error("Username: 3–32 chars, lowercase letters, numbers, . _ - only");
      return;
    }
    if (modal === "create" && password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      if (modal === "create") {
        await userService.create({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          password,
          roleId
        });
        toast.success("User created — share username and password with them");
      } else if (modal && "edit" in modal) {
        await userService.update(modal.edit.id, {
          name: name.trim(),
          username: username.trim().toLowerCase(),
          roleId,
          isActive
        });
        toast.success("User updated");
      }
      closeModal();
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: AdminUserRow) => {
    const next = !u.isActive;
    if (!window.confirm(`${next ? "Activate" : "Deactivate"} ${u.name}?`)) return;
    try {
      await userService.update(u.id, {
        name: u.name,
        username: u.username ?? "",
        roleId: u.roleId,
        isActive: next
      });
      toast.success(next ? "User activated" : "User deactivated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onDelete = async (u: AdminUserRow) => {
    if (!window.confirm(`Permanently delete ${u.name}? This cannot be undone.`)) return;
    try {
      await userService.remove(u.id);
      toast.success("User deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const openResetPw = (u: AdminUserRow) => {
    setPwModal(u);
    setNewPw("");
    setShowNewPw(false);
  };

  const onResetPw = async () => {
    if (!pwModal) return;
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      await userService.resetPassword(pwModal.id, newPw);
      toast.success("Password reset — user sessions revoked");
      setPwModal(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    }
  };

  const assignableRoles = roles.filter((r) => r.name !== "super_admin");

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            Role users log in with a unique username and password (no email). Super Admin uses email.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          Add user
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="h-8 w-full rounded bg-gray-100" />
          <div className="h-8 w-full rounded bg-gray-50" />
          <div className="h-8 w-full rounded bg-gray-100" />
        </div>
      ) : users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
          No users yet. Click "Add user" to create one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-[960px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-center">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">
                    {u.role?.name === "super_admin" ? (u.email ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-green-700">
                    {u.role?.name === "super_admin" ? "—" : (u.username ?? "—")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.role?.name === "super_admin"
                        ? "bg-green-900 text-white"
                        : "border border-green-200 bg-green-50 text-green-700"
                    }`}>
                      {u.role?.displayName ?? u.role?.name ?? u.roleId}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.isActive ? (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" title="Active" />
                    ) : (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" title="Inactive" />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {u.role?.name !== "super_admin" && (
                        <>
                          <button
                            type="button"
                            title="Edit"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title={u.isActive ? "Deactivate" : "Activate"}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                              u.isActive ? "border-orange-200 text-orange-600 hover:bg-orange-50" : "border-green-200 text-green-600 hover:bg-green-50"
                            }`}
                            onClick={() => void toggleActive(u)}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Reset password"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                            onClick={() => openResetPw(u)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => void onDelete(u)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-xl text-gray-900">{modal === "create" ? "Add user" : "Edit user"}</h2>
              <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={closeModal} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-gray-600">
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 text-sm" />
            </label>

            {modal !== "create" && modal && "edit" in modal && modal.edit.role?.name === "super_admin" ? null : (() => {
              const uValid = /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username);
              const rules = [
                { ok: username.length >= 3, label: "Min 3 characters" },
                { ok: /^[a-z0-9]/.test(username), label: "Start with letter or number" },
                { ok: !/[^a-z0-9._-]/.test(username) || username.length === 0, label: "Only letters, numbers, . _ -" },
                { ok: username.length <= 32, label: "Max 32 characters" },
              ];
              return (
                <div className="mt-3 flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">
                    Username <span className="font-normal text-gray-400">(unique, for login)</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="e.g. editor.john"
                    className={`h-10 rounded-lg border px-3 font-mono text-sm transition-colors ${
                      username.length === 0 ? "border-gray-200" :
                      uValid ? "border-green-400 bg-green-50/40" : "border-red-300 bg-red-50/40"
                    }`}
                    autoComplete="off"
                  />
                  {username.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      {rules.map(r => (
                        <div key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? "text-green-600" : "text-red-500"}`}>
                          <span className="text-sm">{r.ok ? "✓" : "✗"}</span> {r.label}
                        </div>
                      ))}
                    </div>
                  )}
                  {username.length === 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">Use letters, numbers, dot (.), underscore (_) or hyphen (-)</p>
                  )}
                </div>
              );
            })()}

            {modal === "create" && (
              <div className="mt-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  Password
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-200 px-3 pr-9 font-mono text-sm"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPw((p) => !p)}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPassword(generatePassword()); setShowPw(true); }}
                      className="inline-flex h-10 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      title="Auto-generate password"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Generate
                    </button>
                  </div>
                </label>
              </div>
            )}

            <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-gray-600">
              Role
              <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 text-sm">
                <option value="">Select role…</option>
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.displayName}</option>
                ))}
              </select>
            </label>

            {modal !== "create" && (
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600"
                />
                Account active
              </label>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {modal === "create" ? "Create user" : "Save changes"}
              </button>
              <button type="button" className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg text-gray-900">Reset password</h2>
              <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={() => setPwModal(null)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Set new password for <strong>{pwModal.name}</strong>. All existing sessions will be revoked.
            </p>
            <div className="mt-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                New password
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showNewPw ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-200 px-3 pr-9 font-mono text-sm"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowNewPw((p) => !p)}
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setNewPw(generatePassword()); setShowNewPw(true); }}
                    className="inline-flex h-10 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Generate
                  </button>
                </div>
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void onResetPw()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Reset password
              </button>
              <button type="button" className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setPwModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
