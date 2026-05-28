/**
 * Role-based access for ScriptHive admin APIs.
 *
 * JWT payloads carry `permissions` as `resource:action` strings (see `prisma/seed.ts`).
 * Use `requirePermission(resource, action)` from `auth.middleware.ts` on each route.
 * Use `requireSuperAdmin` for routes that must never be delegated (users, settings, roles).
 */
export { requireAuth, requirePermission, requireSuperAdmin, authenticate } from "./auth.middleware.js";
