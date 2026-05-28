import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemoData } from "./seed-demo-data.js";

const prisma = new PrismaClient();

const PERMISSIONS = [
  "dashboard:read",
  "submissions:read",
  "submissions:write",
  "submissions:approve",
  "submissions:delete",
  "journals:read",
  "journals:write",
  "journals:delete",
  "payments:read",
  "payments:write",
  "invoices:read",
  "invoices:write",
  "doi:read",
  "doi:write",
  "publish:read",
  "publish:write",
  "archive:read",
  "reports:read",
  "users:read",
  "users:write",
  "users:delete",
  "roles:read",
  "roles:write",
  "roles:delete",
  "settings:read",
  "settings:write"
] as const;

const SETTINGS = [
  { key: "doi_prefix", value: "10.55662" },
  { key: "apc_usd", value: "140" },
  { key: "apc_inr", value: "11500" },
  { key: "site_name", value: "ScriptHive Publication House" },
  { key: "site_email", value: "info@scripthive.org" }
] as const;

const JOURNALS = [
  {
    id: "SGJVSR",
    name: "ScriptHive Global Journal of Vedic and Sanskrit Research",
    scope: "Ancient texts, language, philosophy"
  },
  {
    id: "SGMRJ",
    name: "ScriptHive Global Multidisciplinary Research Journal",
    scope: "Cross-discipline research"
  },
  {
    id: "SGJPLS",
    name: "ScriptHive Global Journal of Physical and Life Sciences",
    scope: "Physics, chemistry, biology"
  },
  {
    id: "SGJETR",
    name: "ScriptHive Global Journal of Engineering and Technology Research",
    scope: "Engineering, technology, computing"
  },
  {
    id: "SGJSSH",
    name: "ScriptHive Global Journal of Social Sciences and Humanities",
    scope: "Sociology, history, arts"
  },
  {
    id: "SGJASH",
    name: "ScriptHive Global Journal of Applied Science and Health",
    scope: "Medicine, health, pharmacy"
  }
] as const;

function parsePermissionName(name: string): { resource: string; action: string } {
  const [resource, action] = name.split(":");
  if (!resource || !action) {
    throw new Error(`Invalid permission name: ${name}`);
  }
  return { resource, action };
}

async function permissionIdsByName(names: readonly string[]): Promise<string[]> {
  const permissions = await Promise.all(
    names.map(async (name) => {
      const { resource, action } = parsePermissionName(name);
      const permission = await prisma.permission.findUnique({
        where: { resource_action: { resource, action } }
      });
      if (!permission) {
        throw new Error(`Permission not found: ${name}`);
      }
      return permission.id;
    })
  );
  return permissions;
}

async function upsertRoleWithPermissions(params: {
  name: string;
  displayName: string;
  description: string;
  permissionNames: readonly string[];
}): Promise<string> {
  const role = await prisma.role.upsert({
    where: { name: params.name },
    update: {
      displayName: params.displayName,
      description: params.description
    },
    create: {
      name: params.name,
      displayName: params.displayName,
      description: params.description
    }
  });

  const permissionIds = await permissionIdsByName(params.permissionNames);

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
    skipDuplicates: true
  });

  return role.id;
}

async function main(): Promise<void> {
  console.log("Starting ScriptHive seed...");

  for (const permissionName of PERMISSIONS) {
    const { resource, action } = parsePermissionName(permissionName);
    await prisma.permission.upsert({
      where: { resource_action: { resource, action } },
      update: {},
      create: { resource, action }
    });
  }
  console.log(`Created ${PERMISSIONS.length} permissions`);

  const superAdminRoleId = await upsertRoleWithPermissions({
    name: "super_admin",
    displayName: "Super Admin",
    description: "Full system access",
    permissionNames: PERMISSIONS
  });
  console.log("Role seeded: super_admin");

  await upsertRoleWithPermissions({
    name: "editor",
    displayName: "Editor",
    description: "Content and publication management",
    permissionNames: [
      "dashboard:read",
      "submissions:read",
      "submissions:write",
      "submissions:approve",
      "journals:read",
      "journals:write",
      "doi:read",
      "doi:write",
      "publish:read",
      "publish:write",
      "archive:read"
    ]
  });
  console.log("Role seeded: editor");

  await upsertRoleWithPermissions({
    name: "accountant",
    displayName: "Accountant",
    description: "Finance and invoice management",
    permissionNames: [
      "dashboard:read",
      "submissions:read",
      "payments:read",
      "payments:write",
      "invoices:read",
      "invoices:write",
      "reports:read"
    ]
  });
  console.log("Role seeded: accountant");

  await upsertRoleWithPermissions({
    name: "reviewer",
    displayName: "Reviewer",
    description: "Read-only reviewer access",
    permissionNames: ["dashboard:read", "submissions:read"]
  });
  console.log("Role seeded: reviewer");

  const passwordHash = await bcrypt.hash("Admin@ScriptHive123", 12);
  const superAdminUser = await prisma.adminUser.upsert({
    where: { email: "admin@scripthive.org" },
    update: {
      name: "Super Admin",
      passwordHash,
      roleId: superAdminRoleId,
      isActive: true
    },
    create: {
      name: "Super Admin",
      email: "admin@scripthive.org",
      passwordHash,
      roleId: superAdminRoleId
    }
  });
  console.log(`Admin seeded: ${superAdminUser.email}`);

  for (const setting of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting
    });
  }
  console.log("Default settings seeded");

  for (const journal of JOURNALS) {
    await prisma.journal.upsert({
      where: { id: journal.id },
      update: {},
      create: {
        id: journal.id,
        name: journal.name,
        scope: journal.scope,
        status: "Active"
      }
    });
  }
  console.log("Seeded 6 journals");

  await seedDemoData(prisma);

  console.log("Seed complete");
  console.log("Super Admin: admin@scripthive.org / Admin@ScriptHive123");
  console.log("Demo editor: editor.john / Demo@ScriptHive123");
  console.log("Demo finance: finance.priya / Demo@ScriptHive123");
  console.log("Demo reviewer: reviewer.amit / Demo@ScriptHive123");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
