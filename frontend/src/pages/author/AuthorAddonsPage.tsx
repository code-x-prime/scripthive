import { useEffect, useState, useCallback } from "react";
import { ChevronDown, Search, Package, Loader2, CheckCircle2, ShoppingCart } from "lucide-react";
import { authorService } from "@/services/author.service";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";
import type { AuthorSubmissionSummary } from "@/types";

interface AddonService {
  id: string;
  label: string;
  price: number;
  priceUsd?: number | null;
  enabled: boolean;
}

interface CartItem {
  id: string;
  label: string;
  price: number;
}

function getIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("doi")) return "🔗";
  if (l.includes("fast")) return "⚡";
  if (l.includes("hard copy")) return "📦";
  if (l.includes("certificate")) return "📜";
  if (l.includes("featured")) return "⭐";
  if (l.includes("plagiarism")) return "🔍";
  return "📖";
}

export function AuthorAddonsPage() {
  const { author } = useAuthorAuth();
  const [submissions, setSubmissions] = useState<AuthorSubmissionSummary[]>([]);
  const [addons, setAddons] = useState<AddonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [ddOpen, setDdOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    const [subs, cfg] = await Promise.all([
      authorService.listSubmissions(),
      fetch("/api/settings/public/addons").then(r => r.json()).catch(() => ({ addons: [] }))
    ]);
    setSubmissions(subs);
    const list: AddonService[] = Array.isArray(cfg) ? cfg : (cfg.addons ?? []);
    setAddons(list.filter((a: AddonService) => a.enabled));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = document.getElementById("dd-wrap");
      if (el && !el.contains(e.target as Node)) setDdOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const selectedMs = submissions[selectedIdx];
  const isIndia = author?.country?.toLowerCase().includes("india") ?? true;

  const filteredSubs = submissions.filter(s =>
    s.id.toLowerCase().includes(search.toLowerCase()) ||
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  function toggleAddon(addon: AddonService) {
    setCart(prev => {
      const next = { ...prev };
      if (next[addon.id]) {
        delete next[addon.id];
      } else {
        next[addon.id] = {
          id: addon.id,
          label: addon.label,
          price: isIndia ? addon.price : (addon.priceUsd ?? Math.round(addon.price / 83 * 100) / 100)
        };
      }
      return next;
    });
  }

  const cartItems = Object.values(cart);
  const total = cartItems.reduce((s, i) => s + i.price, 0);
  const sym = isIndia ? "₹" : "$";

  async function proceedPayment() {
    if (!selectedMs || cartItems.length === 0) return;
    setPaying(true);
    try {
      await fetch("/api/author/addons/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selectedMs.id,
          addons: cartItems,
          currency: isIndia ? "INR" : "USD"
        }),
        credentials: "include"
      });
      setSuccess(true);
      setCart({});
    } catch {
      // non-blocking
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span className="text-yellow-500">💎</span> Premium Author Services
        </h1>
        <p className="mt-1 text-sm text-slate-500">Select a manuscript and choose add-on services to enhance your publication.</p>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="font-semibold text-slate-600">No manuscripts found.</p>
          <p className="text-sm text-slate-400 mt-1">Submit a paper first to purchase add-on services.</p>
        </div>
      ) : (
        <>
          {/* Manuscript Dropdown */}
          <div className="relative max-w-xl" id="dd-wrap">
            <button
              type="button"
              onClick={() => setDdOpen(v => !v)}
              className={`w-full flex items-center justify-between gap-3 px-5 py-4 bg-white border-2 rounded-2xl text-left transition-all ${
                ddOpen ? "border-green-500 shadow-lg shadow-green-500/10" : "border-slate-200 hover:border-green-400"
              }`}
            >
              {selectedMs ? (
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-bold text-green-700 text-sm bg-green-50 px-2.5 py-1 rounded-lg shrink-0">{selectedMs.id}</span>
                  <span className="font-semibold text-slate-800 text-sm truncate">{selectedMs.title}</span>
                </div>
              ) : (
                <span className="text-slate-400 font-medium text-sm">Select a manuscript...</span>
              )}
              <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${ddOpen ? "rotate-180" : ""}`} />
            </button>

            {ddOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by ID or title..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {filteredSubs.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSelectedIdx(submissions.indexOf(s)); setDdOpen(false); setSearch(""); setCart({}); }}
                      className={`w-full text-left px-4 py-3 flex flex-col gap-1 hover:bg-slate-50 border-b border-slate-50 transition-colors ${selectedIdx === i ? "bg-green-50/60" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-green-700 text-xs">{s.id}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          s.status === "Accepted" ? "bg-green-100 text-green-700" :
                          s.status === "UnderReview" ? "bg-amber-100 text-amber-700" :
                          s.status === "Published" ? "bg-purple-100 text-purple-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>{s.status}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-700 line-clamp-1">{s.title}</span>
                      <span className="text-xs text-slate-400">{s.journalId}</span>
                    </button>
                  ))}
                  {filteredSubs.length === 0 && (
                    <div className="py-8 text-center text-sm text-slate-400">No results</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected manuscript info */}
          {selectedMs && (
            <div className="bg-white rounded-xl border border-blue-100 shadow-sm px-5 py-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="text-slate-500">ID: <strong className="text-slate-800 font-mono">{selectedMs.id}</strong></span>
              <span className="text-slate-500">Journal: <strong className="text-slate-800">{selectedMs.journalId}</strong></span>
              <span className="text-slate-500">Status: <strong className="text-slate-800">{selectedMs.status}</strong></span>
            </div>
          )}

          {/* Main layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
            {/* Services grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addons.map(addon => {
                const price = isIndia ? addon.price : (addon.priceUsd ?? Math.round(addon.price / 83 * 100) / 100);
                const selected = !!cart[addon.id];
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`relative text-left p-5 rounded-2xl border-2 transition-all shadow-sm hover:shadow-md ${
                      selected
                        ? "border-green-500 bg-green-50/50 shadow-green-500/10"
                        : "border-slate-200 bg-white hover:border-green-300"
                    }`}
                  >
                    {selected && (
                      <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-green-600" />
                    )}
                    <div className="text-3xl mb-3">{getIcon(addon.label)}</div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1">{addon.label}</h3>
                    <div className="flex items-baseline gap-2 mt-3">
                      <span className="text-xl font-black text-slate-900">{sym}{price.toLocaleString("en-IN")}</span>
                    </div>
                  </button>
                );
              })}
              {addons.length === 0 && (
                <div className="col-span-2 py-12 text-center text-slate-400 text-sm">No add-on services configured.</div>
              )}
            </div>

            {/* Order summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 xl:sticky xl:top-24">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-green-600" /> Order Summary
              </h3>
              {selectedMs && (
                <div className="font-mono text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg inline-block mb-4">{selectedMs.id}</div>
              )}

              {cartItems.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">No services selected yet.</p>
              ) : (
                <ul className="space-y-2 mb-4">
                  {cartItems.map(item => (
                    <li key={item.id} className="flex justify-between text-sm font-semibold py-2 border-b border-slate-100">
                      <span className="text-slate-700">{item.label}</span>
                      <span className="text-slate-900">{sym}{item.price.toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                </ul>
              )}

              {cartItems.length > 0 && (
                <div className="flex justify-between font-black text-lg pt-2 mb-5 border-t-2 border-slate-200">
                  <span className="text-slate-800">Grand Total</span>
                  <span className="text-green-700">{sym}{total.toLocaleString("en-IN")}</span>
                </div>
              )}

              <button
                type="button"
                disabled={cartItems.length === 0 || paying}
                onClick={() => void proceedPayment()}
                className="w-full py-4 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed shadow-lg shadow-green-500/20 transition-all"
              >
                {paying ? "Processing..." : "🔒 Proceed to Payment"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Success modal */}
      {success && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Request Submitted!</h2>
            <p className="text-sm text-slate-500 mb-6">Your add-on services request has been received. Our team will process it shortly.</p>
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
