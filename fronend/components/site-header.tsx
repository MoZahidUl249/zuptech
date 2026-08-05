"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingCart, User } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { cn } from "@/lib/utils";
import { ProductSearch } from "@/components/product-search";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[1]![0]).toUpperCase();
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/services", label: "Services" },
  { href: "/industrial", label: "Industrial" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { count } = useCart();
  const customer = useCustomer();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-60 border-b border-zup-body/6 bg-zup-bg/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-4 px-5">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5"
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
          <span className="text-[19px] font-extrabold leading-none tracking-[0.05em] text-zup-body">
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
                "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                isActive(link.href)
                  ? "bg-zup-blue/8 text-zup-blue"
                  : "text-zup-mid hover:bg-zup-body/5",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Between the nav and the actions so it reads as part of browsing
            rather than as another call to action. Hidden on small screens,
            where the row has no room — the mobile tab bar links to /shop,
            which carries its own search box. */}
        <ProductSearch className="hidden w-40 lg:block xl:w-56" />

        <div className="flex items-center gap-2.5">
          <Link
            href="/contact?intent=quote"
            className="hidden rounded-full bg-zup-ink px-[18px] py-[9px] text-[13.5px] font-semibold text-white transition-colors hover:bg-zup-ink/85 lg:inline-block"
          >
            Request Quote
          </Link>
          <Link
            href="/shop"
            className="hidden rounded-full bg-zup-blue px-[18px] py-[9px] text-[13.5px] font-semibold text-white transition-colors hover:bg-zup-blue-dark md:inline-block"
          >
            Shop Products
          </Link>
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
          <Link
            href="/cart"
            aria-label={`Cart${count > 0 ? ` (${count} items)` : ""}`}
            className="relative flex items-center justify-center p-2 transition-opacity hover:opacity-75"
          >
            <ShoppingCart className="h-[21px] w-[21px]" strokeWidth={1.8} aria-hidden />
            {count > 0 && (
              <span className="absolute right-0 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zup-orange px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
