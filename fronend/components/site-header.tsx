"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { cn } from "@/lib/utils";
import { ProductSearch } from "@/components/product-search";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[1]![0]).toUpperCase();
}

/** The one list of sections. The desktop bar and the mobile tab bar both
 *  render it, so the two navigations cannot drift apart. */
export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/services", label: "Services" },
  { href: "/industrial", label: "Industrial" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { count } = useCart();
  const customer = useCustomer();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-60 border-b border-zup-body/6 bg-zup-bg/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-4 px-5">
        <Link
          href="/"
          className="flex flex-none items-center gap-2.5"
          aria-label="ZUP TECH — Home"
        >
          <Image
            src="/images/zup-mark.png"
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] object-contain"
            priority
          />
          {/* The wordmark yields to the search box on the narrowest screens.
              The mark stays, and the link keeps its aria-label, so the brand
              and the route home are both still there. */}
          <span className="hidden text-[19px] font-extrabold leading-none tracking-[0.05em] text-zup-body min-[400px]:inline">
            ZUP TECH
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1.5 md:flex"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                // `rounded-[999px]`, not `rounded-full`: the site is otherwise
                // flat now, and globals.css squares off `rounded-full` to make
                // that stick. The desktop nav is the one place that keeps its
                // pill, so it opts out by using a class that override cannot
                // match. Changing this to `rounded-full` silently squares it.
                "rounded-[999px] px-3.5 py-2 text-sm font-semibold transition-colors",
                isActive(link.href)
                  ? "bg-zup-blue/8 text-zup-blue"
                  : "text-zup-mid hover:bg-zup-body/5",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* In the bar at every size, not tucked behind the hamburger: on a
            catalogue site search is a primary action, and on mobile it was the
            one thing that needed two taps to reach. `min-w-0` lets it shrink
            rather than push the hamburger off the row. */}
        <ProductSearch className="min-w-0 flex-1 lg:w-40 lg:flex-none xl:w-56" />

        {/* Account is desktop-only — on mobile it lives in the sheet, which is
            the one place that holds what the bar and tab bar don't. The cart is
            no longer in that category: it sits in the bar at every size, just
            below. */}
        <div className="hidden items-center gap-2.5 md:flex">
          {customer ? (
            <Link
              href="/account"
              aria-label={`Account — ${customer.name}`}
              className="flex items-center gap-2 p-1 transition-opacity hover:opacity-75"
            >
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-zup-blue text-[13px] font-bold text-white">
                {initials(customer.name)}
              </span>
              <span className="hidden max-w-[100px] truncate text-[13.5px] font-semibold md:inline">
                {customer.name.split(/\s+/)[0]}
              </span>
            </Link>
          ) : (
            <Link
              href="/account"
              aria-label="Account"
              className="flex items-center gap-1.5 p-2 transition-opacity hover:opacity-75"
            >
              <User className="h-5 w-5" strokeWidth={1.8} aria-hidden />
              <span className="hidden text-[13.5px] font-semibold md:inline">
                Sign in
              </span>
            </Link>
          )}
        </div>

        {/* The cart, at every size — on mobile it sits immediately left of the
            hamburger. It used to be desktop-only, with the count riding on the
            hamburger instead, which meant reaching a filled basket on a phone
            took two taps and a menu that also held five other things.
            `flex-none` keeps the search box from squeezing it. */}
        <Link
          href="/cart"
          aria-label={`Cart${count > 0 ? ` (${count} items)` : ""}`}
          className="relative flex flex-none items-center justify-center p-2 transition-opacity hover:opacity-75"
        >
          <ShoppingCart className="h-[21px] w-[21px]" strokeWidth={1.8} aria-hidden />
          {count > 0 && (
            <span className="absolute right-0 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zup-orange px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </Link>

        {/* Mobile: one control for everything the bar can't hold. No count
            badge here any more — it lives on the cart button above, and two
            copies of the same number a thumb-width apart read as two different
            counts. */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            aria-label="Open menu"
            className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full text-zup-body transition-colors hover:bg-zup-body/5 md:hidden"
          >
            <Menu className="h-6 w-6" strokeWidth={2} aria-hidden />
          </SheetTrigger>

          <SheetContent side="right" className="w-[86%] max-w-xs px-0">
            <SheetHeader className="px-5">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>

            {/* No search here — it sits in the header bar at every size now,
                so a copy in the menu would be the second one on screen. */}
            <nav className="flex flex-col px-2" aria-label="Mobile menu">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "rounded-xl px-3 py-3 text-[15px] font-semibold transition-colors",
                    isActive(link.href)
                      ? "bg-zup-blue/8 text-zup-blue"
                      : "text-zup-body hover:bg-zup-body/5",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-1 border-t border-zup-body/8 px-2 pb-2 pt-3">
              <Link
                href="/cart"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-zup-body transition-colors hover:bg-zup-body/5"
              >
                <ShoppingCart className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                Cart
                {count > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-zup-orange px-1.5 text-[11px] font-bold text-white">
                    {count}
                  </span>
                )}
              </Link>
              <Link
                href="/account"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-zup-body transition-colors hover:bg-zup-body/5"
              >
                {customer ? (
                  <>
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-zup-blue text-[10px] font-bold text-white">
                      {initials(customer.name)}
                    </span>
                    {customer.name.split(/\s+/)[0]}
                  </>
                ) : (
                  <>
                    <User className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                    Sign in
                  </>
                )}
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
