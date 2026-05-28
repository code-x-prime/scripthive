export const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-800 border-amber-200",
  UnderReview: "bg-blue-50 text-blue-800 border-blue-200",
  Revision: "bg-orange-50 text-orange-800 border-orange-200",
  Accepted: "bg-green-50 text-green-800 border-green-200",
  Rejected: "bg-red-50 text-red-800 border-red-200",
  Published: "bg-emerald-50 text-emerald-800 border-emerald-200"
};

export const STATUS_LABELS: Record<string, string> = {
  Pending: "Pending",
  UnderReview: "Under review",
  Revision: "Revision requested",
  Accepted: "Accepted",
  Rejected: "Rejected",
  Published: "Published"
};

export function formatSubmissionStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function canAuthorEditSubmission(status: string): boolean {
  return status === "Pending";
}
