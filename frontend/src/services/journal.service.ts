import type { Journal } from "../types";
import { apiJson } from "./api";

export type JournalAdminRow = Journal & { publishedPaperCount: number };

export const journalService = {
  list: () => apiJson<Journal[]>("/journals"),
  get: (code: string) => apiJson<Journal>(`/journals/${code}`),
  adminList: () => apiJson<JournalAdminRow[]>("/journals/admin"),
  updateIssn: (journalId: string, body: { issn?: string | null; eIssn?: string | null }) =>
    apiJson<Journal>(`/journals/admin/${encodeURIComponent(journalId)}/issn`, {
      method: "PUT",
      body: JSON.stringify(body)
    })
};
