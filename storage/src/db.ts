import { SQL } from "bun";
import { CONFIG } from "./config";

export const sql = new SQL(CONFIG.databaseUrl);

export async function checkDbConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
