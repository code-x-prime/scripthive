/**
 * Maps each spec “page” checkbox to concrete backend permissions (`resource:action`).
 * Saving a role sends the union of selected pages’ permission IDs to the API.
 */
export const ROLE_PAGE_MATRIX: { specId: string; label: string; perms: readonly string[] }[] = [
  { specId: "dashboard", label: "Dashboard", perms: ["dashboard:read"] },
  { specId: "journals_manage", label: "Manage journals", perms: ["journals:read", "journals:write"] },
  {
    specId: "submissions_new",
    label: "Submissions — New",
    perms: ["submissions:read", "submissions:write", "submissions:approve"]
  },
  {
    specId: "submissions_under_review",
    label: "Submissions — Under review",
    perms: ["submissions:read", "submissions:write", "submissions:approve", "submissions:delete"]
  },
  {
    specId: "submissions_accepted",
    label: "Submissions — Accepted",
    perms: ["submissions:read", "submissions:write", "submissions:approve", "invoices:read", "invoices:write"]
  },
  {
    specId: "submissions_rejected",
    label: "Submissions — Rejected",
    perms: ["submissions:read", "submissions:write", "submissions:approve"]
  },
  {
    specId: "payments_pending",
    label: "Payments — Pending",
    perms: ["payments:read", "payments:write", "invoices:read", "invoices:write"]
  },
  { specId: "payments_completed", label: "Payments — Completed", perms: ["payments:read"] },
  { specId: "doi_pending", label: "DOI — Pending", perms: ["doi:read", "doi:write"] },
  { specId: "doi_minted", label: "DOI — Minted", perms: ["doi:read"] },
  { specId: "production_publish", label: "Production — Publish article", perms: ["publish:read", "publish:write"] },
  {
    specId: "production_preparation",
    label: "Production — Ready for preparation",
    perms: ["publish:read", "publish:write"]
  },
  { specId: "production_upload", label: "Production — Ready for upload", perms: ["publish:read", "publish:write"] },
  {
    specId: "production_ready_published",
    label: "Production — Ready to published",
    perms: ["publish:read", "publish:write"]
  },
  { specId: "archives", label: "Archives", perms: ["archive:read"] },
  { specId: "reports", label: "Reports", perms: ["reports:read"] }
];
