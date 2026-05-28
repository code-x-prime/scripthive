import type { Invoice } from "../types";
import { apiJson } from "./api";

export const invoiceService = {
  list: () => apiJson<Invoice[]>("/invoices"),
  get: (id: string) => apiJson<Invoice>(`/invoices/${encodeURIComponent(id)}`)
};
