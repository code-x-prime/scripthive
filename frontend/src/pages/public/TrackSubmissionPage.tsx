import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { PublicNavbar } from "@/components/public/Navbar";
import { StatusBadge } from "@/components/common/StatusBadge";

type TrackPayload = {
  id: string;
  status: string;
  reviewNotes?: string | null;
  updatedAt: string;
};

export const TrackSubmissionPage = () => {
  const { id } = useParams<{ id: string }>();
  const submissionId = (id ?? "").trim();
  const [data, setData] = useState<TrackPayload | null>(null);
  const [loading, setLoading] = useState(() => submissionId.length > 0);

  useEffect(() => {
    if (!submissionId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setData(null);
      try {
        const res = await fetch(`/api/submissions/track/${encodeURIComponent(submissionId)}`);
        const body = (await res.json().catch(() => ({}))) as TrackPayload & { message?: string };
        if (!res.ok) {
          throw new Error(body.message ?? "Could not load submission");
        }
        if (!cancelled) setData(body as TrackPayload);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load submission");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-heading text-3xl text-gray-900">Track submission</h1>
        <p className="mt-2 text-sm text-gray-500">
          Tracking ID:{" "}
          <span className="font-mono font-medium text-green-800">{submissionId || "—"}</span>
        </p>

        {!submissionId ? (
          <p className="mt-8 text-sm text-gray-600">
            Invalid link.{" "}
            <Link to="/submit" className="text-green-700 hover:underline">
              Submit a paper
            </Link>
          </p>
        ) : loading ? (
          <div className="mt-8 animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-6">
            <div className="h-4 w-40 rounded bg-gray-200" />
            <div className="h-6 w-full rounded bg-gray-100" />
          </div>
        ) : !data ? (
          <p className="mt-8 text-sm text-gray-600">
            Submission not found or could not be loaded.{" "}
            <Link to="/submit" className="text-green-700 hover:underline">
              Submit a paper
            </Link>
          </p>
        ) : (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Current status</p>
            <div className="mt-2">
              <StatusBadge status={data.status} />
            </div>
            {data.reviewNotes ? (
              <div className="mt-6">
                <p className="text-xs font-medium uppercase text-gray-500">Notes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{data.reviewNotes}</p>
              </div>
            ) : null}
            <p className="mt-6 text-xs text-gray-400">
              Last updated: {new Date(data.updatedAt).toLocaleString()}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
