/**
 * Maps UI “page keys” from the product spec to backend JWT permissions (`resource:action`).
 * The database seeds `Permission` rows — see `backend/prisma/seed.ts`.
 */
export const APP_PAGE_TO_PERMISSION = {
  dashboard: "dashboard:read",
  journals_manage: "journals:read",
  submissions_new: "submissions:read",
  submissions_under_review: "submissions:read",
  submissions_accepted: "submissions:read",
  submissions_rejected: "submissions:read",
  payments_pending: "payments:read",
  payments_completed: "payments:read",
  doi_pending: "doi:read",
  doi_minted: "doi:read",
  production_publish: "publish:read",
  production_preparation: "publish:read",
  production_upload: "publish:read",
  production_ready_published: "publish:read",
  archives: "archive:read",
  reports: "reports:read"
} as const;

export type AppPageKey = keyof typeof APP_PAGE_TO_PERMISSION;
