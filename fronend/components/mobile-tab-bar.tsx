"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Zap, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/services", label: "Services", icon: Zap },
  { href: "/cart", label: "Cart", icon: ShoppingCart },
  { href: "/account", label: "Account", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { count } = useCart();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-75 grid h-16 grid-cols-5 border-t border-zup-body/8 bg-white/94 px-2 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden"
      aria-label="Mobile navigation"
    >
      {tabs.map(({ href, label, icon: Icon }) => (
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
          {href === "/cart" && count > 0 && (
            <span className="absolute right-[calc(50%-20px)] top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-zup-orange px-1 text-[9.5px] font-bold text-white">
              {count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
