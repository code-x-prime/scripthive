import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { AuthAlert } from "@/components/author/AuthAlert";
import { PasswordRequirements } from "@/components/author/PasswordRequirements";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";
import { authorService } from "@/services/author.service";
import { parseApiError } from "@/utils/parseApiError";
import { isPasswordValid, passwordValidationMessage } from "@/utils/passwordPolicy";

export function AuthorProfilePage() {
  const navigate = useNavigate();
  const { author, updateAuthor, logout } = useAuthorAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [affiliations, setAffiliations] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const profile = await authorService.getProfile();
        updateAuthor(profile);
        setName(profile.name);
        setPhone(profile.phone ?? "");
        setCountry(profile.country ?? "");
        setAffiliations(profile.affiliations ?? "");
      } catch (e) {
        setProfileError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [updateAuthor]);

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    if (!name.trim()) {
      setProfileError("Full name is required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await authorService.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        country: country.trim(),
        affiliations: affiliations.trim()
      });
      updateAuthor(updated);
      toast.success("Profile saved");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    const passMsg = passwordValidationMessage(newPassword);
    if (passMsg) {
      setPasswordError(passMsg);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      await authorService.changePassword(currentPassword, newPassword);
      toast.success("Password updated. Please sign in again.");
      await logout();
      navigate("/author/login", { replace: true });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setChangingPassword(false);
    }
  };

  const onDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Delete your author account permanently? Pending submissions will be removed.")) return;
    setDeleteError("");
    setDeleting(true);
    try {
      const res = await authorService.deleteAccount(deletePassword);
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      toast.success("Account deleted");
      await logout();
      navigate("/author/register", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete account");
    } finally {
      setDeleting(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-12 text-sm text-gray-500 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-green-600" /> Loading profile…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your author information and account settings</p>
      </div>

      {/* Profile info */}
      <form onSubmit={onSaveProfile} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 border-b border-slate-100 pb-4">
          <h2 className="font-semibold text-slate-900">Personal information</h2>
          <p className="mt-0.5 text-sm text-slate-500">Used on new submissions. Email cannot be changed.</p>
        </div>
        <AuthAlert message={profileError} title="Could not save profile" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email address" value={author?.email ?? ""} readOnly />
          <Field label="Full name *" value={name} onChange={setName} placeholder="Dr. Jane Smith" />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
          <Field label="Country" value={country} onChange={setCountry} placeholder="India" />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Affiliation / Institution
          </label>
          <textarea
            value={affiliations}
            onChange={(e) => setAffiliations(e.target.value)}
            rows={3}
            placeholder="Department of Computer Science, University of Delhi"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-colors resize-none"
          />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={onChangePassword} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 border-b border-slate-100 pb-4">
          <h2 className="font-semibold text-slate-900">Change password</h2>
          <p className="mt-0.5 text-sm text-slate-500">You will be signed out after changing.</p>
        </div>
        <AuthAlert message={passwordError} title="Password not updated" />
        <div className="grid gap-4 sm:max-w-md">
          <PassField label="Current password" value={currentPassword} onChange={setCurrentPassword} />
          <div>
            <PassField label="New password" value={newPassword} onChange={setNewPassword} show={showNewPass} onToggle={() => setShowNewPass((v) => !v)} />
            <PasswordRequirements password={newPassword} />
          </div>
          <PassField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
        <button type="submit"
          disabled={changingPassword || !isPasswordValid(newPassword) || newPassword !== confirmPassword}
          className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 transition-colors">
          {changingPassword ? "Updating…" : "Update password"}
        </button>
      </form>

      {/* Delete account */}
      <form onSubmit={onDeleteAccount} className="rounded-xl border border-red-200 bg-red-50/40 p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-600" />
          <h2 className="font-semibold text-red-900">Delete account</h2>
        </div>
        <p className="text-sm text-red-700/80 mb-4">
          Permanently removes your account and all pending submissions. This cannot be undone.
        </p>
        <AuthAlert message={deleteError} title="Could not delete account" />
        <div className="sm:max-w-sm">
          <PassField label="Confirm with your current password" value={deletePassword} onChange={setDeletePassword} />
        </div>
        <button type="submit" disabled={deleting || !deletePassword}
          className="mt-4 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label, value, onChange, readOnly, placeholder
}: {
  label: string; value: string; onChange?: (v: string) => void;
  readOnly?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <input
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm transition-colors ${
          readOnly
            ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
            : "border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
        }`}
      />
    </div>
  );
}

function PassField({
  label, value, onChange, show, onToggle
}: {
  label: string; value: string; onChange: (v: string) => void;
  show?: boolean; onToggle?: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-colors"
        />
        {onToggle && (
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={onToggle}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
