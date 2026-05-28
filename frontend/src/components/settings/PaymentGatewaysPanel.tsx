import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CreditCard, IndianRupee, ShieldCheck } from "lucide-react";
import { settingsService } from "@/services/settings.service";

type PgForm = {
  pg_razorpay_enabled: string;
  pg_razorpay_mode: string;
  pg_razorpay_key_id: string;
  pg_razorpay_key_secret: string;
  pg_razorpay_key_secret_set: boolean;
  pg_smepay_enabled: string;
  pg_smepay_mode: string;
  pg_smepay_client_id: string;
  pg_smepay_client_secret: string;
  pg_smepay_client_secret_set: boolean;
  pg_inr_provider: string;
  pg_paypal_enabled: string;
  pg_paypal_mode: string;
  pg_paypal_client_id: string;
  pg_paypal_client_secret: string;
  pg_paypal_client_secret_set: boolean;
};

const emptyForm: PgForm = {
  pg_razorpay_enabled: "false",
  pg_razorpay_mode: "test",
  pg_razorpay_key_id: "",
  pg_razorpay_key_secret: "",
  pg_razorpay_key_secret_set: false,
  pg_smepay_enabled: "false",
  pg_smepay_mode: "test",
  pg_smepay_client_id: "",
  pg_smepay_client_secret: "",
  pg_smepay_client_secret_set: false,
  pg_inr_provider: "razorpay",
  pg_paypal_enabled: "false",
  pg_paypal_mode: "sandbox",
  pg_paypal_client_id: "",
  pg_paypal_client_secret: "",
  pg_paypal_client_secret_set: false
};

function truthy(v: unknown): boolean {
  return v === true || v === "true" || v === "1";
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-green-600" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </label>
  );
}

export const PaymentGatewaysPanel = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState<PgForm>(emptyForm);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        try {
          const m = await settingsService.get();
          if (cancelled) return;
          setForm({
            pg_razorpay_enabled:        m.pg_razorpay_enabled ?? "false",
            pg_razorpay_mode:           m.pg_razorpay_mode ?? "test",
            pg_razorpay_key_id:         m.pg_razorpay_key_id ?? "",
            pg_razorpay_key_secret:     m.pg_razorpay_key_secret ?? "",
            pg_razorpay_key_secret_set: truthy(m.pg_razorpay_key_secret_set),
            pg_smepay_enabled:          m.pg_smepay_enabled ?? "false",
            pg_smepay_mode:             m.pg_smepay_mode ?? "test",
            pg_smepay_client_id:        m.pg_smepay_client_id ?? "",
            pg_smepay_client_secret:    m.pg_smepay_client_secret ?? "",
            pg_smepay_client_secret_set: truthy(m.pg_smepay_client_secret_set),
            pg_inr_provider:            m.pg_inr_provider ?? "razorpay",
            pg_paypal_enabled:          m.pg_paypal_enabled ?? "false",
            pg_paypal_mode:             m.pg_paypal_mode ?? "sandbox",
            pg_paypal_client_id:        m.pg_paypal_client_id ?? "",
            pg_paypal_client_secret:    m.pg_paypal_client_secret ?? "",
            pg_paypal_client_secret_set: truthy(m.pg_paypal_client_secret_set)
          });
        } catch (e) {
          if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load payment settings");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });
    return () => { cancelled = true; };
  }, []);

  const patch = (partial: Partial<PgForm>) => setForm((f) => ({ ...f, ...partial }));

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        pg_razorpay_enabled: form.pg_razorpay_enabled,
        pg_razorpay_mode:    form.pg_razorpay_mode,
        pg_razorpay_key_id:  form.pg_razorpay_key_id.trim(),
        pg_smepay_enabled:   form.pg_smepay_enabled,
        pg_smepay_mode:      form.pg_smepay_mode,
        pg_smepay_client_id: form.pg_smepay_client_id.trim(),
        pg_inr_provider:     form.pg_inr_provider,
        pg_paypal_enabled:   form.pg_paypal_enabled,
        pg_paypal_mode:      form.pg_paypal_mode,
        pg_paypal_client_id: form.pg_paypal_client_id.trim()
      };
      if (form.pg_razorpay_key_secret && !form.pg_razorpay_key_secret.includes("••••"))
        body.pg_razorpay_key_secret = form.pg_razorpay_key_secret;
      if (form.pg_smepay_client_secret && !form.pg_smepay_client_secret.includes("••••"))
        body.pg_smepay_client_secret = form.pg_smepay_client_secret;
      if (form.pg_paypal_client_secret && !form.pg_paypal_client_secret.includes("••••"))
        body.pg_paypal_client_secret = form.pg_paypal_client_secret;

      const updated = await settingsService.update(body);
      setForm({
        ...form,
        pg_razorpay_key_id:          updated.pg_razorpay_key_id ?? form.pg_razorpay_key_id,
        pg_razorpay_key_secret:      updated.pg_razorpay_key_secret ?? "",
        pg_razorpay_key_secret_set:  truthy(updated.pg_razorpay_key_secret_set),
        pg_smepay_client_id:         updated.pg_smepay_client_id ?? form.pg_smepay_client_id,
        pg_smepay_client_secret:     updated.pg_smepay_client_secret ?? "",
        pg_smepay_client_secret_set: truthy(updated.pg_smepay_client_secret_set),
        pg_paypal_client_id:         updated.pg_paypal_client_id ?? form.pg_paypal_client_id,
        pg_paypal_client_secret:     updated.pg_paypal_client_secret ?? "",
        pg_paypal_client_secret_set: truthy(updated.pg_paypal_client_secret_set)
      });
      toast.success("Payment gateway settings saved securely.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6">
        <div className="h-20 rounded-lg bg-gray-100" />
        <div className="h-32 rounded-lg bg-gray-50" />
        <div className="h-32 rounded-lg bg-gray-50" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" role="tabpanel">
      <div className="flex items-start gap-3 rounded-xl border border-green-100 bg-green-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
        <div className="text-sm text-gray-700">
          <p className="font-medium text-gray-900">Secure storage</p>
          <p className="mt-1 text-gray-600">
            Secret keys are encrypted in the database (AES-256-GCM). Only masked values are shown. Leave secret fields blank to keep current value.
          </p>
        </div>
      </div>

      {/* INR provider */}
      <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
        <div className="flex items-center gap-2 text-amber-900">
          <IndianRupee className="h-5 w-5" />
          <span className="text-sm font-semibold">Default INR gateway</span>
        </div>
        <p className="mt-1 text-xs text-gray-600">Used on the public payment page for INR invoices.</p>
        <select
          value={form.pg_inr_provider}
          onChange={(e) => patch({ pg_inr_provider: e.target.value })}
          className="mt-3 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 sm:max-w-xs"
        >
          <option value="razorpay">Razorpay</option>
          <option value="smepay">SMEPay</option>
        </select>
      </div>

      {/* Razorpay */}
      <section className="space-y-4 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-green-700" />
          <h2 className="font-semibold text-gray-900">Razorpay (INR)</h2>
        </div>
        <Toggle label="Enable Razorpay" checked={form.pg_razorpay_enabled === "true"}
          onChange={(v) => patch({ pg_razorpay_enabled: v ? "true" : "false" })} />
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          Mode
          <select value={form.pg_razorpay_mode} onChange={(e) => patch({ pg_razorpay_mode: e.target.value })}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm">
            <option value="test">Test</option>
            <option value="live">Live</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          Key ID
          <input value={form.pg_razorpay_key_id} onChange={(e) => patch({ pg_razorpay_key_id: e.target.value })}
            placeholder="rzp_test_…" className="h-10 rounded-lg border border-gray-200 px-3 font-mono text-sm" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          Key secret {form.pg_razorpay_key_secret_set ? "(saved — enter new value to replace)" : ""}
          <input type="password" value={form.pg_razorpay_key_secret}
            onChange={(e) => patch({ pg_razorpay_key_secret: e.target.value })}
            placeholder={form.pg_razorpay_key_secret_set ? "••••••••" : "Enter key secret"}
            className="h-10 rounded-lg border border-gray-200 px-3 font-mono text-sm" />
        </label>
      </section>

      {/* SMEPay */}
      <section className="space-y-4 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-blue-700" />
          <h2 className="font-semibold text-gray-900">SMEPay (INR)</h2>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 border border-blue-200">Wizard Checkout</span>
        </div>
        <Toggle label="Enable SMEPay" checked={form.pg_smepay_enabled === "true"}
          onChange={(v) => patch({ pg_smepay_enabled: v ? "true" : "false" })} />
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          Mode
          <select value={form.pg_smepay_mode} onChange={(e) => patch({ pg_smepay_mode: e.target.value })}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm">
            <option value="test">Test (staging)</option>
            <option value="live">Live</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          Client ID
          <input value={form.pg_smepay_client_id} onChange={(e) => patch({ pg_smepay_client_id: e.target.value })}
            placeholder="SMEPay client_id" className="h-10 rounded-lg border border-gray-200 px-3 font-mono text-sm" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          Client secret {form.pg_smepay_client_secret_set ? "(saved — enter new value to replace)" : ""}
          <input type="password" value={form.pg_smepay_client_secret}
            onChange={(e) => patch({ pg_smepay_client_secret: e.target.value })}
            placeholder={form.pg_smepay_client_secret_set ? "••••••••" : "Enter client_secret"}
            className="h-10 rounded-lg border border-gray-200 px-3 font-mono text-sm" />
        </label>
        <p className="text-xs text-gray-400">Dashboard → Integrations → View API docs to get credentials.</p>
      </section>

      {/* PayPal */}
      <section className="space-y-4 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-700" />
          <h2 className="font-semibold text-gray-900">PayPal (USD)</h2>
        </div>
        <Toggle label="Enable PayPal" checked={form.pg_paypal_enabled === "true"}
          onChange={(v) => patch({ pg_paypal_enabled: v ? "true" : "false" })} />
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          Mode
          <select value={form.pg_paypal_mode} onChange={(e) => patch({ pg_paypal_mode: e.target.value })}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm">
            <option value="sandbox">Sandbox (test)</option>
            <option value="live">Live</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          Client ID
          <input value={form.pg_paypal_client_id} onChange={(e) => patch({ pg_paypal_client_id: e.target.value })}
            placeholder="PayPal client ID" className="h-10 rounded-lg border border-gray-200 px-3 font-mono text-sm" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          Client secret {form.pg_paypal_client_secret_set ? "(saved — enter new value to replace)" : ""}
          <input type="password" value={form.pg_paypal_client_secret}
            onChange={(e) => patch({ pg_paypal_client_secret: e.target.value })}
            placeholder={form.pg_paypal_client_secret_set ? "••••••••" : "Enter client secret"}
            className="h-10 rounded-lg border border-gray-200 px-3 font-mono text-sm" />
        </label>
      </section>

      <button type="button" disabled={saving} onClick={() => void save()}
        className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto sm:px-6">
        {saving ? "Saving…" : "Save payment gateways"}
      </button>
    </div>
  );
};
