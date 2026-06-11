import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { BookOpen, Eye, EyeOff } from "lucide-react";

import { AuthAlert } from "@/components/author/AuthAlert";
import { PasswordRequirements } from "@/components/author/PasswordRequirements";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";
import { isPasswordValid, isValidEmail, passwordValidationMessage } from "@/utils/passwordPolicy";

export function AuthorRegisterPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated, isLoading } = useAuthorAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [affiliations, setAffiliations] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/author/dashboard" replace />;
  }

  const validateForm = (): string | null => {
    const issues: string[] = [];
    if (!name.trim()) issues.push("Full name is required.");
    if (!email.trim()) issues.push("Email is required.");
    else if (!isValidEmail(email)) issues.push("Enter a valid email address (e.g. you@university.edu).");
    const passMsg = passwordValidationMessage(password);
    if (passMsg) issues.push(passMsg);
    if (password !== confirmPassword) issues.push("Password and confirm password do not match.");
    return issues.length > 0 ? issues.join(" ") : null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setSubmitting(true);
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(country.trim() ? { country: country.trim() } : {}),
        ...(state.trim() ? { state: state.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(affiliations.trim() ? { affiliations: affiliations.trim() } : {})
      });
      navigate("/author/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = name.trim() && isValidEmail(email) && isPasswordValid(password) && password === confirmPassword;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-6 py-10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 text-white">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-gray-900">Create author account</h1>
          <p className="mt-1 text-sm text-gray-500">Register to submit papers and track your manuscripts</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <AuthAlert message={error} title="Could not create account" />

          <Field label="Full name *" value={name} onChange={setName} autoComplete="name" placeholder="Dr. Jane Smith" />

          <Field
            label="Email *"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="you@university.edu"
            hint="Use the email you want on your submissions"
          />

          <div>
            <PasswordField
              label="Password *"
              value={password}
              onChange={setPassword}
              show={showPass}
              onToggle={() => setShowPass((v) => !v)}
              autoComplete="new-password"
            />
            <PasswordRequirements password={password} showWhenEmpty />
          </div>

          <PasswordField
            label="Confirm password *"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            autoComplete="new-password"
            {...(confirmPassword && password !== confirmPassword
              ? { error: "Passwords do not match." }
              : {})}
          />

          <Field label="Phone (optional)" value={phone} onChange={setPhone} autoComplete="tel" placeholder="+1-555-0100" />
          <Field label="Country (optional)" value={country} onChange={setCountry} autoComplete="country-name" placeholder="India" />
          <Field label="State / Province (optional)" value={state} onChange={setState} autoComplete="address-level1" placeholder="Maharashtra" />
          <Field label="Address (optional)" value={address} onChange={setAddress} autoComplete="street-address" placeholder="123 Street, City" />
          <label className="block text-sm font-medium text-gray-700">
            Affiliation (optional)
            <textarea
              value={affiliations}
              onChange={(e) => setAffiliations(e.target.value)}
              rows={2}
              placeholder="University or research institute"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already registered?{" "}
            <Link to="/author/login" className="font-medium text-green-600 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  hint
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-gray-400">{hint}</span> : null}
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  error
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-200 focus:border-green-500 focus:ring-green-500"
          }`}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}
