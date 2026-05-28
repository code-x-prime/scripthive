import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Banknote, CreditCard, DollarSign, FolderOpen, IndianRupee, Link2, Plus, SlidersHorizontal, Trash2, Package } from "lucide-react";
import { MediaLibraryPanel } from "@/components/settings/MediaLibraryPanel";
import { PaymentGatewaysPanel } from "@/components/settings/PaymentGatewaysPanel";
import { CarouselPanel } from "@/components/settings/CarouselPanel";
import { settingsService } from "@/services/settings.service";
import { DEFAULT_APC_INR, DEFAULT_APC_USD, parseApcSettings } from "@/utils/apcAmounts";

interface AddonService { id: string; label: string; price: number; currency: "INR"; enabled: boolean }

const DEFAULT_ADDONS: AddonService[] = [
  { id: "doi_only",          label: "DOI Only",                          price: 350,  currency: "INR", enabled: true },
  { id: "fast_review",       label: "Fast Review",                       price: 699,  currency: "INR", enabled: true },
  { id: "plagiarism_report", label: "Plagiarism Report (350 words)",     price: 150,  currency: "INR", enabled: true },
  { id: "certificate_soft",  label: "Certificate Soft Copy",             price: 200,  currency: "INR", enabled: true },
  { id: "certificate_hard",  label: "Certificate Hard Copy (Speed Post)",price: 350,  currency: "INR", enabled: true },
  { id: "featured_paper",    label: "Featured Paper",                    price: 1000, currency: "INR", enabled: true },
  { id: "paper_hard_copy",   label: "Paper Hard Copy (Speed Post)",      price: 999,  currency: "INR", enabled: true }
];

type SettingsTab = "pricing" | "payments" | "doi" | "media" | "carousel" | "addons";

const TABS: { id: SettingsTab; label: string; icon: typeof DollarSign }[] = [
  { id: "pricing",  label: "APC pricing",       icon: Banknote },
  { id: "addons",   label: "Add-on services",   icon: Package },
  { id: "payments", label: "Payment gateways",  icon: CreditCard },
  { id: "media",    label: "Media library",     icon: FolderOpen },
  { id: "carousel", label: "Carousel",          icon: SlidersHorizontal },
  { id: "doi",      label: "DOI & site",        icon: Link2 }
];

function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("pricing");
  const [loading, setLoading] = useState(true);
  const [doiPrefix, setDoiPrefix] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteEmail, setSiteEmail] = useState("");
  const [apcUsd, setApcUsd] = useState("");
  const [apcInr, setApcInr] = useState("");
  const [addons, setAddons] = useState<AddonService[]>(DEFAULT_ADDONS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        try {
          const m = await settingsService.get();
          if (!cancelled) {
            setDoiPrefix(m.doi_prefix ?? "");
            setSiteName(m.site_name ?? "");
            setSiteEmail(m.site_email ?? "");
            setApcUsd(m.apc_usd ?? String(DEFAULT_APC_USD));
            setApcInr(m.apc_inr ?? String(DEFAULT_APC_INR));
            if (m.addon_services_parsed) {
              setAddons(m.addon_services_parsed as unknown as AddonService[]);
            }
          }
        } catch (e) {
          if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load settings");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const previewRates = useMemo(() => parseApcSettings({ apc_usd: apcUsd, apc_inr: apcInr }), [apcUsd, apcInr]);

  const savePricing = async () => {
    const usd = parseFloat(apcUsd);
    const inr = parseFloat(apcInr);
    if (Number.isNaN(usd) || usd <= 0) {
      toast.error("Enter a valid USD price (greater than 0)");
      return;
    }
    if (Number.isNaN(inr) || inr <= 0) {
      toast.error("Enter a valid INR price (greater than 0)");
      return;
    }
    setSaving(true);
    try {
      await settingsService.update({
        apc_usd: String(usd),
        apc_inr: String(Math.round(inr))
      });
      toast.success("APC prices saved. Payments and new invoices will use these amounts.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveAddons = async () => {
    setSaving(true);
    try {
      await settingsService.update({ addon_services: JSON.stringify(addons) });
      toast.success("Add-on services saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveDoi = async () => {
    if (!doiPrefix.trim()) {
      toast.error("DOI prefix is required");
      return;
    }
    setSaving(true);
    try {
      await settingsService.update({
        doi_prefix: doiPrefix.trim(),
        site_name: siteName.trim(),
        site_email: siteEmail.trim()
      });
      toast.success("DOI and site settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`mx-auto space-y-6 ${activeTab === "media" || activeTab === "payments" || activeTab === "carousel" || activeTab === "addons" ? "max-w-4xl" : "max-w-2xl"}`}>
      <div className="space-y-1">
        <h1 className="font-heading text-3xl text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">
          Configure APC prices, payment gateways (Razorpay, PhonePe, PayPal), DOI prefix, and media library.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-gray-200 p-1.5" role="tablist" aria-label="Settings sections">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(id)}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>

        {loading && activeTab !== "media" && activeTab !== "payments" && activeTab !== "carousel" && activeTab !== "addons" ? (
          <div className="animate-pulse space-y-4 p-6">
            <div className="h-24 rounded-lg bg-gray-100" />
            <div className="h-11 w-full rounded-lg bg-gray-50" />
            <div className="h-11 w-full rounded-lg bg-gray-50" />
          </div>
        ) : activeTab === "addons" ? (
          <div className="space-y-4 p-6" role="tabpanel">
            <p className="text-sm text-gray-600">
              Add-on services available for authors at submission. Price in INR. Toggle to enable/disable. Admin can edit anytime.
            </p>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 text-left">Service</th>
                    <th className="px-4 py-3 text-right w-32">Price (₹)</th>
                    <th className="px-4 py-3 text-center w-20">Enabled</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {addons.map((addon, idx) => (
                    <tr key={addon.id} className="border-b border-gray-100">
                      <td className="px-4 py-2">
                        <input
                          value={addon.label}
                          onChange={(e) => setAddons((prev) => prev.map((a, i) => i === idx ? { ...a, label: e.target.value } : a))}
                          className="w-full rounded border border-transparent px-2 py-1 text-sm hover:border-gray-200 focus:border-green-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={addon.price}
                          onChange={(e) => setAddons((prev) => prev.map((a, i) => i === idx ? { ...a, price: Number(e.target.value) } : a))}
                          className="w-24 rounded border border-gray-200 px-2 py-1 text-right font-mono text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setAddons((prev) => prev.map((a, i) => i === idx ? { ...a, enabled: !a.enabled } : a))}
                          className={`relative h-6 w-11 rounded-full transition-colors ${addon.enabled ? "bg-green-600" : "bg-gray-300"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${addon.enabled ? "translate-x-5" : ""}`} />
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <button type="button"
                          onClick={() => setAddons((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded p-1 text-gray-300 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setAddons((prev) => [...prev, { id: `custom_${Date.now()}`, label: "New service", price: 0, currency: "INR", enabled: true }])}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-green-400 hover:text-green-700"
            >
              <Plus className="h-4 w-4" /> Add service
            </button>
            <div>
              <button type="button" disabled={saving} onClick={() => void saveAddons()}
                className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save add-on services"}
              </button>
            </div>
          </div>
        ) : activeTab === "media" ? (
          <MediaLibraryPanel />
        ) : activeTab === "payments" ? (
          <PaymentGatewaysPanel />
        ) : activeTab === "carousel" ? (
          <CarouselPanel />
        ) : activeTab === "pricing" ? (
          <div className="space-y-6 p-6" role="tabpanel">
            <p className="text-sm text-gray-600">
              These amounts apply when you create invoices, switch currency on pending payments, and auto-generate draft
              APC invoices for accepted papers.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-green-100 bg-green-50/60 p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">USD · PayPal</span>
                </div>
                <p className="mt-3 font-mono text-2xl font-semibold text-gray-900">{formatUsd(previewRates.usd)}</p>
                <p className="mt-1 text-xs text-gray-500">International authors & non-India submissions</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                <div className="flex items-center gap-2 text-amber-900">
                  <IndianRupee className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">INR · Razorpay / PhonePe</span>
                </div>
                <p className="mt-3 font-mono text-2xl font-semibold text-gray-900">{formatInr(previewRates.inr)}</p>
                <p className="mt-1 text-xs text-gray-500">India country on submission → INR draft invoice</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
                Article processing charge (USD)
                <div className="flex overflow-hidden rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-green-500">
                  <span className="flex h-11 items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-500">
                    $
                  </span>
                  <input
                    value={apcUsd}
                    onChange={(e) => setApcUsd(e.target.value)}
                    type="number"
                    min={1}
                    step="0.01"
                    placeholder="140"
                    className="h-11 flex-1 px-3 text-sm outline-none"
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
                Article processing charge (INR)
                <div className="flex overflow-hidden rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-green-500">
                  <span className="flex h-11 items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-500">
                    ₹
                  </span>
                  <input
                    value={apcInr}
                    onChange={(e) => setApcInr(e.target.value)}
                    type="number"
                    min={1}
                    step="1"
                    placeholder="11500"
                    className="h-11 flex-1 px-3 text-sm outline-none"
                  />
                </div>
              </label>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void savePricing()}
              className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto sm:px-6"
            >
              {saving ? "Saving…" : "Save APC prices"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-6" role="tabpanel">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
              DOI prefix
              <input
                value={doiPrefix}
                onChange={(e) => setDoiPrefix(e.target.value)}
                placeholder="10.33545/2664844X"
                className="h-11 rounded-lg border border-gray-200 px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="font-normal text-gray-400">Used when assigning DOIs on publish.</span>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
              Site name
              <input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="ScriptHive Publication House"
                className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
              Site email
              <input
                value={siteEmail}
                onChange={(e) => setSiteEmail(e.target.value)}
                type="email"
                placeholder="info@scripthive.org"
                className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDoi()}
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save DOI & site"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
