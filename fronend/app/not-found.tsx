import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[560px] px-5 pt-20 text-center">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-zup-soft">
        404
      </p>
      <h1 className="mb-3 text-[28px] font-bold tracking-[-0.025em]">
        Page not found
      </h1>
      <p className="mb-7 text-[15px] leading-relaxed text-zup-gray">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-zup-blue px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-zup-blue-dark"
        >
          Go home
        </Link>
        <Link
          href="/shop"
          className="rounded-full border border-zup-body/14 bg-white px-7 py-3.5 text-[15px] font-semibold text-zup-body transition-colors hover:bg-secondary"
        >
          Browse products
        </Link>
      </div>
      <div className="h-24" />
    </main>
  );
}
