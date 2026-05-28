import type { Submission } from "@/types";
import { submissionAuthorsDisplay } from "@/utils/submissionAuthors";
import type { ExportColumn } from "./exportCsv";

export const SUBMISSION_EXPORT_COLUMNS: ExportColumn<Submission>[] = [
  { key: "id", label: "Submission ID", getValue: (r) => r.id },
  { key: "title", label: "Title", getValue: (r) => r.title },
  { key: "authors", label: "Authors", getValue: (r) => submissionAuthorsDisplay(r) },
  { key: "authorEmail", label: "Author Email", getValue: (r) => r.authorEmail ?? "" },
  { key: "journal", label: "Journal", getValue: (r) => r.journal?.id ?? r.journalId },
  { key: "country", label: "Country", getValue: (r) => r.country ?? "" },
  { key: "keywords", label: "Keywords", getValue: (r) => r.keywords ?? "" },
  { key: "submittedAt", label: "Submitted At", getValue: (r) => new Date(r.createdAt).toISOString() },
  { key: "status", label: "Status", getValue: (r) => r.status },
  {
    key: "production",
    label: "Production Status",
    permission: "publish:read",
    getValue: (r) => r.productionStatus ?? ""
  },
  {
    key: "payment",
    label: "Payment Status",
    permission: "payments:read",
    getValue: (r) => r.paymentStatus ?? ""
  },
  {
    key: "invoice",
    label: "Invoice Status",
    permission: "invoices:read",
    getValue: (r) => r.invoices?.[0]?.status ?? ""
  },
  {
    key: "invoiceAmount",
    label: "Invoice Amount",
    permission: "invoices:read",
    getValue: (r) => {
      const inv = r.invoices?.[0];
      return inv ? `${inv.currency} ${inv.total}` : "";
    }
  },
  { key: "remark", label: "Admin Remark", permission: "submissions:write", getValue: (r) => r.editorNotes ?? "" },
  { key: "reviewNotes", label: "Review Notes", getValue: (r) => r.reviewNotes ?? "" },
  { key: "updatedAt", label: "Last Updated", getValue: (r) => new Date(r.updatedAt).toISOString() }
];
