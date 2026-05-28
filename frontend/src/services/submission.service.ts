import type { Submission } from "../types";
import { apiJson } from "./api";

function buildQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const submissionService = {
  list: (filters?: { status?: string; journalId?: string; productionStatus?: string; search?: string }) =>
    apiJson<Submission[]>(`/submissions${buildQuery(filters ?? {})}`),
  get: (id: string) => apiJson<Submission>(`/submissions/${encodeURIComponent(id)}`)
};
