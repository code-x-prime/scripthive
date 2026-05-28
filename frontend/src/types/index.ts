/** ScriptHive frontend types mirror `backend/prisma/schema.prisma`, not the marketing “ideal” ERD. */
/** Author display lists are built with `submissionAuthorsDisplay()` from `authorName` + `coAuthors`. */
export type IsoDateString = string;

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Mirrors `AdminUser` + nested `Role` from Prisma (JWT/login uses flattened role.permissions). */
export interface AdminUser {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  roleId?: string;
  isActive?: boolean;
  createdAt?: IsoDateString;
  role: {
    id?: string;
    name: string;
    /** `true` when `role.name === "super_admin"` — not stored separately in DB */
    isSuper?: boolean;
    /** Backend format: `resource:action` strings, e.g. `submissions:read` */
    permissions: string[];
  };
}

export interface AuthorUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  affiliations?: string | null;
}

export interface AuthorSubmissionSummary {
  id: string;
  title: string;
  journalId: string;
  journalName: string;
  status: string;
  productionStatus?: string | null;
  paymentStatus: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  admin: AdminUser;
}

/** Values stored in Prisma `Submission.status` (PascalCase strings). */
export type SubmissionStatus =
  | "Pending"
  | "UnderReview"
  | "Revision"
  | "Accepted"
  | "Rejected"
  | "Published";

export type PaymentStatusApi = string;

export interface Journal {
  id: string;
  name: string;
  issn?: string | null;
  eIssn?: string | null;
  description?: string | null;
  scope?: string | null;
  status?: string;
  sortOrder?: number;
  createdAt?: IsoDateString;
}

export interface DoiRecord {
  id: number;
  submissionId: string;
  doi?: string | null;
  status?: string;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
}

export interface Invoice {
  id: string;
  submissionId: string;
  customerName: string;
  customerEmail: string;
  address?: string | null;
  items: unknown;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  method?: string | null;
  status: string;
  dueDate?: IsoDateString | null;
  paidAt?: IsoDateString | null;
  gatewayOrderId?: string | null;
  gatewayPayId?: string | null;
  notes?: string | null;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  submission?: Submission;
}

/** Mirrors `Submission` model in `backend/prisma/schema.prisma` (authors are derived from `authorName` + `coAuthors`). */
export interface Submission {
  id: string;
  journalId: string;
  journal?: Journal;
  title: string;
  country?: string | null;
  authorName: string;
  authorEmail: string;
  authorPhone?: string | null;
  affiliations?: string | null;
  coAuthors?: string | null;
  abstract: string;
  keywords: string;
  articleType?: string;
  manuscriptPath?: string | null;
  status: string;
  priority?: boolean;
  productionStatus?: string | null;
  reviewNotes?: string | null;
  editorNotes?: string | null;
  paymentStatus?: string;
  paymentMethod?: string | null;
  paymentId?: string | null;
  paidAt?: IsoDateString | null;
  volumeId?: number | null;
  issueId?: number | null;
  partId?: number | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  pubDate?: IsoDateString | null;
  pdfPublicPath?: string | null;
  slug?: string | null;
  apcAmount?: number;
  apcCurrency?: string;
  addons?: { id: string; label: string; price: number; currency: string }[] | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  invoices?: Invoice[];
  doiRecord?: DoiRecord | null;
  part?: {
    id: number;
    name: string;
    issue?: {
      id: number;
      number: number;
      volume?: { id: number; number: number; year: number; journalId: string };
    };
  } | null;
}

/** Admin role row from `GET /api/roles` (includes join table permissions). */
export interface RolePermissionLink {
  permissionId: string;
  permission: { id: string; resource: string; action: string };
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  permissions?: RolePermissionLink[];
  users?: { id: string }[];
}

/** @deprecated Use `Invoice` — kept for older components expecting `amount` */
export type InvoiceCurrency = "USD" | "INR";
/** @deprecated — invoice.status is a free string in DB */
export type InvoiceStatus = string;

/** Response from `GET /api/payments` (admin). */
export interface PaymentStats {
  totalRevenueUsd: number;
  totalRevenueInr: number;
  pendingCount: number;
  overdueCount: number;
  totalInvoices: number;
}

export interface PaymentsListPayload {
  stats: PaymentStats;
  invoices: Invoice[];
  apc?: { usd: number; inr: number };
}

export interface DashboardChanges {
  totalSubmissionsPercent: number | null;
  pendingReviewsPercent: number | null;
  pendingPreparationPercent: number | null;
  pendingPublishedPercent: number | null;
}

export interface DashboardRecentManuscript {
  id: string;
  title: string;
  /** Short journal code — same as `Journal.id` in seed (e.g. SGJETR). */
  journalCode: string;
  journalName: string;
  /** Derived author names for display — join with ", " for table cells. */
  authors: string[];
  status: string;
}

export interface DashboardStatsResponse {
  totalSubmissions: number;
  pendingReviews: number;
  pendingPreparation: number;
  pendingPublished: number;
  changes: DashboardChanges;
  recentManuscripts: DashboardRecentManuscript[];
}
