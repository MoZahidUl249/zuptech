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
  "/shop": ShoppingBag,
  "/services": Wrench,
  "/industrial": Factory,
  "/contact": Phone,
};

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-75 grid h-16 grid-cols-5 border-t border-zup-body/8 bg-white/94 px-2 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden"
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
