import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env and fill it in");
}

// Prisma 7: the client always goes through a driver adapter.
// Swap PrismaPg for another adapter if the database ever changes.
const adapter = new PrismaPg({ connectionString });

/** Single shared Prisma client — import this, never `new PrismaClient()`. */
export const prisma = new PrismaClient({ adapter });

/** Handy alias for interactive-transaction callbacks. */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
