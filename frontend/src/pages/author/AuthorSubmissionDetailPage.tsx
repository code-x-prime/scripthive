import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Loader2, Trash2 } from "lucide-react";
import type { Submission } from "@/types";
import { authorService } from "@/services/author.service";
import { RichTextContent } from "@/components/common/RichTextContent";
import { parseKeywords } from "@/utils/formatKeywords";
import { canAuthorEditSubmission, formatSubmissionStatus, STATUS_COLORS } from "@/utils/authorStatus";

export function AuthorSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await authorService.getSubmission(id);
        if (!cancelled) setRow(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onDelete = async () => {
    if (!row || !window.confirm(`Delete submission ${row.id}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await authorService.deleteSubmission(row.id);
      toast.success("Submission deleted");
      navigate("/author/dashboard", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-12 text-sm text-gray-500 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-green-600" /> Loading…
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <p className="text-red-600">{error || "Submission not found"}</p>
        <Link to="/author/dashboard" className="mt-4 inline-block text-sm text-green-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const keywords = parseKeywords(row.keywords);
  const editable = canAuthorEditSubmission(row.status);
  const pendingInvoice = row.invoices?.find((inv) => inv.status === "Pending");
  const paidInvoice = row.invoices?.find((inv) => inv.status === "Paid");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to="/author/dashboard" className="text-sm text-green-600 hover:underline">
              ← My submissions
            </Link>
            <p className="mt-2 font-mono text-xs text-gray-400">{row.id}</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-gray-900">{row.title}</h2>
            <p className="text-sm text-gray-500">{row.journal?.name ?? row.journalId}</p>
          </div>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/author/submissions/${row.id}/edit`}
                className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" /> {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
              STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            {formatSubmissionStatus(row.status)}
          </span>
          <Badge label={`Payment: ${row.paymentStatus ?? "—"}`} />
          {row.productionStatus ? <Badge label={`Production: ${row.productionStatus}`} /> : null}
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Submitted {new Date(row.createdAt).toLocaleString()} · Updated {new Date(row.updatedAt).toLocaleString()}
        </p>

        {row.paymentStatus === "Pending" && pendingInvoice ? (
          <Link
            to={`/pay/${row.id}`}
            className="mt-4 inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Pay APC
          </Link>
        ) : null}

        {row.paymentStatus === "Paid" && paidInvoice ? (
          <Link
            to={`/author/invoices/${paidInvoice.id}`}
            className="mt-4 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
          >
            Download Invoice
          </Link>
        ) : null}
      </div>

      <Section title="Abstract">
        <RichTextContent html={row.abstract} />
      </Section>

      {keywords.length > 0 ? (
        <Section title="Keywords">
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <span key={k} className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-800">
                {k}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {row.reviewNotes ? (
        <Section title="Editor notes">
          <p className="whitespace-pre-wrap text-sm text-gray-700">{row.reviewNotes}</p>
        </Section>
      ) : null}

      <Section title="Author details">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Name" value={row.authorName} />
          <Item label="Email" value={row.authorEmail} />
          {row.authorPhone ? <Item label="Phone" value={row.authorPhone} /> : null}
          {row.country ? <Item label="Country" value={row.country} /> : null}
          {row.affiliations ? <Item label="Affiliation" value={row.affiliations} /> : null}
          {row.coAuthors ? <Item label="Co-authors" value={row.coAuthors} /> : null}
          {row.articleType ? <Item label="Article type" value={row.articleType} /> : null}
        </dl>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{label}</span>;
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}
