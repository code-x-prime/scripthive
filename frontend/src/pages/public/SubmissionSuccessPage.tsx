import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useCallback } from "react";
import { PublicNavbar } from "@/components/public/Navbar";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";

type SuccessState = {
  authorName?: string;
  title?: string;
  authorEmail?: string;
  submittedAt?: string;
};

export const SubmissionSuccessPage = () => {
  const [params] = useSearchParams();
  const { state } = useLocation() as { state?: SuccessState | null };
  const { isAuthenticated } = useAuthorAuth();
  const id = params.get("id")?.trim() ?? "";
  const authorName = state?.authorName?.trim() || "Author";
  const title = state?.title?.trim() || "your manuscript";
  const authorEmail = state?.authorEmail?.trim() || "";
  const submittedAt = state?.submittedAt || new Date().toISOString();

  const downloadReceipt = useCallback(() => {
    if (!id) return;
    const html = `<!DOCTYPE html><html><head><title>Receipt ${id}</title></head><body style="font-family:system-ui,sans-serif;padding:32px;max-width:640px;margin:0 auto">
      <h1 style="font-size:22px;">ScriptHive — Submission receipt</h1>
      <p><strong>Tracking ID:</strong> ${id}</p>
      <p><strong>Title:</strong> ${title.replace(/</g, "&lt;")}</p>
      <p><strong>Author:</strong> ${authorName.replace(/</g, "&lt;")}</p>
      <p><strong>Email:</strong> ${authorEmail.replace(/</g, "&lt;")}</p>
      <p><strong>Submitted:</strong> ${submittedAt}</p>
    </body></html>`;
    const w = window.open("", "_blank", "width=720,height=920");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }, [id, title, authorName, authorEmail, submittedAt]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-center text-4xl" aria-hidden>
            🎉
          </p>
          <h1 className="mt-4 text-center font-display text-3xl font-bold text-gray-900">Submission Successful!</h1>
          <p className="mt-4 text-center text-base text-gray-600">
            Thank you, <span className="font-semibold text-gray-900">{authorName}</span>. Your manuscript{" "}
            <span className="font-semibold text-gray-900">&quot;{title}&quot;</span> has been received for peer review.
          </p>

          {id ? (
            <div className="mt-8 rounded-xl border border-gray-200 bg-slate-50 px-4 py-6 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tracking ID</p>
              <p className="mt-1 font-mono text-2xl font-bold text-blue-700">{id}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Reference date</p>
              <p className="mt-1 font-mono text-sm text-gray-800">
                {new Date(submittedAt).toLocaleString(undefined, {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false
                })}
              </p>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-amber-800">
              No tracking ID in the URL. If you submitted successfully, check your email.
            </p>
          )}

          <div className="mt-10">
            <h2 className="font-heading text-lg font-semibold text-gray-900">What happens next?</h2>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm text-gray-700">
              <li>
                <span className="font-medium text-gray-900">Initial screening (1–2 days):</span> verification of formatting,
                plagiarism check, and journal scope alignment.
              </li>
              <li>
                <span className="font-medium text-gray-900">Peer review (7–15 days):</span> double-blind review by subject-matter
                experts.
              </li>
              <li>
                <span className="font-medium text-gray-900">Editorial decision:</span> final notification of acceptance, revisions,
                or rejection.
              </li>
            </ol>
          </div>

          <div className="mt-8">
            <h2 className="font-heading text-lg font-semibold text-gray-900">Criteria for acceptance</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
              <li>Original contribution within the journal&apos;s aims and scope.</li>
              <li>Rigorous methodology and clear, ethical reporting.</li>
              <li>Language and structure suitable for scholarly publication.</li>
            </ul>
          </div>

          {authorEmail ? (
            <p className="mt-8 text-center text-sm text-gray-600">
              A confirmation email has been dispatched to <span className="font-medium text-gray-900">{authorEmail}</span>.
            </p>
          ) : (
            <p className="mt-8 text-center text-sm text-gray-600">A confirmation email has been dispatched to your inbox.</p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Link
              to="/journals"
              className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg bg-green-600 px-6 text-sm font-medium text-white hover:bg-green-700"
            >
              Browse journals
            </Link>
            {isAuthenticated ? (
              <Link
                to="/author/dashboard"
                className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-green-200 bg-green-50 px-6 text-sm font-medium text-green-800 hover:bg-green-100"
              >
                Author dashboard
              </Link>
            ) : null}
            {id ? (
              <button
                type="button"
                className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-6 text-sm font-medium text-gray-800 hover:bg-gray-50"
                onClick={downloadReceipt}
              >
                Download receipt
              </button>
            ) : null}
            {id ? (
              <Link
                to={`/track/${encodeURIComponent(id)}`}
                className="inline-flex h-11 min-h-[44px] items-center justify-center text-sm font-medium text-green-700 hover:underline"
              >
                Track this submission
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
