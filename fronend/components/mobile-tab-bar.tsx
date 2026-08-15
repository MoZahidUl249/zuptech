"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Wrench, Factory, Phone } from "lucide-react";
import { navLinks } from "@/components/site-header";
import { cn } from "@/lib/utils";

/**
 * The mobile tab bar mirrors the desktop nav — same five sections, same order.
 * It reads `navLinks` from the header rather than keeping its own list, so the
 * two can't drift; this only supplies the icon for each.
 *
 * Cart and Account used to sit here instead of Industrial and Contact. They
 * moved into the header's hamburger menu, which is the one place on mobile
 * that holds everything the section bar doesn't.
 */
const icons: Record<string, typeof Home> = {
  "/": Home,
  "/products": ShoppingBag,
  "/services": Wrench,
  "/industrial": Factory,
  "/contact": Phone,
};

export function MobileTabBar() {
  const pathname = usePathname();

  /*
   * A product page shows the buy bar instead of this.
   *
   * Both are fixed to the bottom, and stacking them cost a third of a phone
   * screen — and buried the only action on the page under a row of section
   * links. On a product page the action IS the navigation, so this stands
   * down. Matched on the detail route only: `/products` itself is a listing
   * and keeps the bar.
   *
   * `ProductActions` renders that buy bar. If this guard and that component
   * ever disagree, a phone gets either two bars or none.
   */
  const onProductDetail = /^\/products\/[^/]+/.test(pathname);
  if (onProductDetail) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      /*
       * Full width, floating above the bottom edge.
       *
       * Two separate decisions, and they have moved independently: it is
       * edge-to-edge horizontally (no side inset), but lifted off the bottom so
       * the page runs visibly underneath it — which is what makes it read as a
       * control layer over the site rather than part of the device chrome.
       *
       * The bottom offset stacks a fixed gap ON TOP of the safe-area inset, so
       * it clears the home indicator on a notched phone and still has a gap on
       * a device that reports no inset at all. Spending that inset as internal
       * padding instead is what makes a bar look welded to the edge.
       *
       * `border-y`, not `border`: the left and right edges sit on the screen
       * edges, so a border there would be a hairline against nothing.
       */
      className="fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-75 grid h-16 grid-cols-5 rounded-none border-y border-zup-body/8 bg-white/94 px-2 py-1.5 shadow-[0_8px_28px_-6px_rgba(21,24,30,0.22)] backdrop-blur-xl md:hidden"
      aria-label="Mobile navigation"
    >
      {navLinks.map(({ href, label }) => {
        const Icon = icons[href] ?? Home;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex min-h-11 flex-col items-center justify-center gap-[3px]",
              isActive(href) ? "text-zup-blue" : "text-zup-soft",
            )}
          >
            <Icon className="h-[21px] w-[21px]" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
