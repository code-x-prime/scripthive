import { apiJson } from "./api";
import type { DoiRecord, Submission } from "../types";

export type DoiMintedRow = DoiRecord & { submission?: Submission & { journal?: { id: string; name: string } } };

export const doiService = {
  pending: () => apiJson<Submission[]>("/doi/pending"),
  minted: () => apiJson<DoiMintedRow[]>("/doi/minted"),
  noDoi: () => apiJson<Submission[]>("/doi/no-doi"),
  assign: (body: { submissionId: string; journalId: string; volume: number; issue: number }) =>
    apiJson<DoiRecord>("/doi/assign", { method: "POST", body: JSON.stringify(body) })
};
