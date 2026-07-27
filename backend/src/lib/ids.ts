import type { Tx } from "./db";

/**
 * Human-friendly sequential ids (BACKEND.md §4.12): orders are "ZT-10242",
 * purchase orders are "PO-2212", invoices "INV-1001", warranties "WR-4401".
 * Backed by the Counter table and incremented inside the caller's transaction
 * so ids are gap-free under concurrency. Counter.id is a free-text PK, so a
 * new sequence needs no migration — just a row, created on first use.
 */

const SEQUENCES = {
  order: { prefix: "ZT-", start: 10241 },
  po: { prefix: "PO-", start: 2211 },
  invoice: { prefix: "INV-", start: 1000 },
  warranty: { prefix: "WR-", start: 4400 },
} as const;

export async function nextId(tx: Tx, kind: keyof typeof SEQUENCES) {
  const { prefix, start } = SEQUENCES[kind];
  const counter = await tx.counter.upsert({
    where: { id: kind },
    create: { id: kind, value: start + 1 },
    update: { value: { increment: 1 } },
  });
  return { id: `${prefix}${counter.value}`, number: counter.value };
}
