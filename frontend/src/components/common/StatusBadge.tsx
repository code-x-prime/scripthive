const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  UnderReview: "bg-blue-100 text-blue-800 border-blue-200",
  UNDER_REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
  Revision: "bg-orange-100 text-orange-800 border-orange-200",
  Accepted: "bg-green-100 text-green-800 border-green-200",
  ACCEPTED: "bg-green-100 text-green-800 border-green-200",
  Rejected: "bg-red-100 text-red-800 border-red-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  Published: "bg-purple-100 text-purple-800 border-purple-200",
  PUBLISHED: "bg-purple-100 text-purple-800 border-purple-200",
  Paid: "bg-green-100 text-green-800 border-green-200",
  PAID: "bg-green-100 text-green-800 border-green-200",
  Overdue: "bg-red-100 text-red-800 border-red-200",
  OVERDUE: "bg-red-100 text-red-800 border-red-200",
  ReadyForPreparation: "bg-orange-100 text-orange-800 border-orange-200",
  READY_FOR_PREPARATION: "bg-orange-100 text-orange-800 border-orange-200",
  ReadyForUpload: "bg-sky-100 text-sky-800 border-sky-200",
  READY_FOR_UPLOAD: "bg-sky-100 text-sky-800 border-sky-200",
  ReadyToPublished: "bg-violet-100 text-violet-800 border-violet-200",
  READY_TO_PUBLISHED: "bg-violet-100 text-violet-800 border-violet-200"
};

const LABEL_MAP: Record<string, string> = {
  UnderReview: "Under Review",
  UNDER_REVIEW: "Under Review",
  ReadyForPreparation: "Ready for Preparation",
  READY_FOR_PREPARATION: "Ready for Preparation",
  ReadyForUpload: "Ready for Upload",
  READY_FOR_UPLOAD: "Ready for Upload",
  ReadyToPublished: "Ready to Published",
  READY_TO_PUBLISHED: "Ready to Published"
};

export const StatusBadge = ({ status }: { status?: string | null }) => {
  if (!status) return null;
  const label = LABEL_MAP[status] ?? status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
    >
      {label}
    </span>
  );
};
