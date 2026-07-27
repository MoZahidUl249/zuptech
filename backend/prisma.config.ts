import { defineConfig } from "prisma/config";

// Prisma 7 keeps datasource URLs out of schema.prisma.
// Bun auto-loads .env, so run CLI commands with `bunx --bun prisma …`.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun run prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
