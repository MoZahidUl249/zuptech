"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useAdmin } from "@/lib/admin";
import { navItemFor } from "../nav";
import { EmptyState } from "../primitives";

/**
 * Client-side permission check for whichever screen is open.
 *
 * Not a security boundary — every /admin/api route calls `assertCan` itself,
 * and that's what actually protects the data. This exists so a staff member
 * who lands on a URL they can't open gets told so, instead of the old
 * behaviour of silently swapping them onto some other section and leaving them
 * wondering why the link they were sent didn't work.
 */
export function ModuleGate({ children }: { children: React.ReactNode }) {
  const { can } = useAdmin();
  const pathname = usePathname();
  const item = navItemFor(pathname);

  if (item && can(item.module) === "none") {
    return (
      <EmptyState
        icon={Lock}
        title="You don't have access to this screen"
        help={`Ask whoever manages the team to give you access to ${item.label}.`}
        action={
          <Link
            href="/admin"
            className="rounded-full bg-zup-ink px-4 py-2 text-ui-sm font-bold text-white transition-colors hover:bg-zup-body"
          >
            Back to Today
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
