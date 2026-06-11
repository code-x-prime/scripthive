import type { AuthorSubmissionSummary, AuthorUser, Submission } from "@/types";
import { parseApiError } from "@/utils/parseApiError";
import { authorApiFetch, authorApiJson } from "./authorApi";
let _authorToken: () => string | null = () => null;
export const bindAuthorServiceToken = (fn: () => string | null) => {
  _authorToken = fn;
};

function getAuthorAuthHeader(): Record<string, string> {
  const token = _authorToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AuthorStats {
  total: number;
  pending: number;
  underReview: number;
  revision: number;
  accepted: number;
  rejected: number;
  published: number;
}

export const authorService = {
  getStats: () => authorApiJson<AuthorStats>("/stats"),
  getProfile: () => authorApiJson<AuthorUser>("/profile"),
  updateProfile: (body: Partial<Pick<AuthorUser, "name" | "phone" | "country" | "state" | "address" | "affiliations">>) =>
    authorApiJson<AuthorUser>("/profile", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    fetch("/api/author/auth/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(getAuthorAuthHeader()) },
      credentials: "include",
      body: JSON.stringify({ currentPassword, newPassword })
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      return (await res.json()) as { message: string };
    }),
  deleteAccount: (password: string) =>
    fetch("/api/author/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...(getAuthorAuthHeader()) },
      credentials: "include",
      body: JSON.stringify({ password })
    }),
  listSubmissions: () => authorApiJson<AuthorSubmissionSummary[]>("/submissions"),
  getSubmission: (id: string) => authorApiJson<Submission>(`/submissions/${id}`),
  createSubmission: (formData: FormData) => authorApiFetch("/submissions", { method: "POST", body: formData }),
  updateSubmission: (id: string, formData: FormData) =>
    authorApiFetch(`/submissions/${id}`, { method: "PUT", body: formData }),
  deleteSubmission: (id: string) => authorApiJson<{ message: string }>(`/submissions/${id}`, { method: "DELETE" })
};
