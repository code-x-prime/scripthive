import { apiJson } from "./api";

export interface ReportsSummary {
  totalSubmissions: number;
  published: number;
  underReview: number;
  accepted: number;
  pending: number;
  rejected: number;
  totalRevenueUsd: number;
  totalRevenueInr: number;
  pendingInvoices: number;
  paidInvoices: number;
  mintedDoi: number;
  pendingDoi: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface MonthlySubmissions {
  month: string;
  submissions: number;
  published: number;
}

export interface MonthlyRevenue {
  month: string;
  usd: number;
  inr: number;
}

export interface ReportsPayload {
  summary: ReportsSummary;
  submissionsByStatus: LabelCount[];
  submissionsByJournal: LabelCount[];
  monthlySubmissions: MonthlySubmissions[];
  monthlyRevenue: MonthlyRevenue[];
  productionPipeline: LabelCount[];
  paymentsByStatus: LabelCount[];
}

export interface DailyActivity { date: string; count: number }

export interface UserActivitySummary {
  adminId: string;
  name: string;
  role: string;
  actions: Record<string, number>;
  total: number;
}

export interface AuditLogEntry {
  id: number;
  adminId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  admin: { id: string; name: string; role: { name: string; displayName: string } } | null;
}

export interface ActivityPayload {
  days: number;
  dailyActivity: DailyActivity[];
  userSummary: UserActivitySummary[];
  recentLogs: AuditLogEntry[];
}

export const reportsService = {
  get: () => apiJson<ReportsPayload>("/reports"),
  getActivity: (days = 30) => apiJson<ActivityPayload>(`/reports/activity?days=${days}`)
};
