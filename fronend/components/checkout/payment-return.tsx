"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { getPaymentStatus } from "@/lib/api";
import { trackPurchase } from "@/lib/analytics";
import { takePendingPurchase } from "@/lib/pending-purchase";

/**
 * The page the payment gateway drops the customer back on.
 *
 * The URL says success, failed or cancelled — and none of that is believed.
 * `/checkout/payment/success` is a plain URL anyone can type, so treating the
 * segment as the answer would let a customer mark their own order paid. It is
 * used for one thing only: choosing the wording shown for the second or two
 * before the real answer arrives.
 *
 * The real answer comes from `GET /api/payments/:txn/status`, which makes the
 * backend ask the gateway. That call is safe to repeat, so a refresh, a
 * back-button, or a second tab all reach the same conclusion.
 */

type Phase = "checking" | "paid" | "unpaid" | "pending" | "error";

/** A return URL with no `txn` cannot be checked at all — knowable up front. */
const MISSING_REFERENCE = "This link is missing its payment reference.";

/** How the customer *arrived*. A hint for the copy, never the verdict. */
function initialCopy(hint: string): string {
  if (hint === "cancelled") return "Cancelling your payment…";
  if (hint === "failed") return "Checking what happened…";
  return "Confirming your payment…";
}

export function PaymentReturn({
  hint,
  merchantTxnId,
}: {
  hint: string;
  merchantTxnId: string;
}) {
  // Derived, not stored: without a reference there is nothing to ask about,
  // and starting in "checking" only to immediately setState in the effect is a
  // render nobody needs.
  const [phase, setPhase] = useState<Phase>(merchantTxnId ? "checking" : "error");
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState(merchantTxnId ? "" : MISSING_REFERENCE);
  /* Which transaction has already been asked about.
     
     React's development mode mounts effects twice, so the check has to be
     guarded or the status call — and the Purchase event behind it — fires
     twice per visit. A plain boolean did that, and got it wrong the other way:
     once flipped it never reset, so a client-side navigation from
     /checkout/payment/failed?txn=A to …/success?txn=B on the same mounted
     component left the page showing A's outcome forever. Remembering WHICH id
     was asked about is once-per-transaction rather than once-per-mount. */
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!merchantTxnId || asked.current === merchantTxnId) return;
    asked.current = merchantTxnId;

    let cancelled = false;
    // A second transaction on the same mount starts over rather than showing
    // the previous one's answer while this one is in flight.
    setPhase("checking");

    (async () => {
      try {
        const status = await getPaymentStatus(merchantTxnId);
        if (cancelled) return;

        setOrderId(status.orderId);

        if (status.paid) {
          setPhase("paid");
          // Only now is this a sale. Checkout parked the event rather than
          // firing it when the customer left for the gateway.
          const pending = takePendingPurchase(status.orderId);
          if (pending) {
            trackPurchase(
              pending.orderId,
              pending.total,
              pending.items,
              pending.params,
              pending.customerMatch,
            );
          }
          return;
        }

        // Still open: the customer may have got here faster than the gateway
        // settled. Say so plainly instead of declaring a failure they would
        // have to argue with.
        setPhase(status.status === "Initiated" ? "pending" : "unpaid");
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setMessage(err instanceof Error ? err.message : "We could not check the payment.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [merchantTxnId]);

  return (
    <main className="mx-auto max-w-[480px] px-5 pt-16 text-center">
      {phase === "checking" ? (
        <>
          <Loader2
            className="mx-auto mb-5.5 h-10 w-10 animate-spin text-zup-blue"
            strokeWidth={2}
            aria-hidden
          />
          <h1 className="mb-2.5 text-[28px] font-bold tracking-[-0.025em]">
            {initialCopy(hint)}
          </h1>
          <p className="text-[15px] leading-relaxed text-zup-gray">
            Please don&apos;t close this page.
          </p>
        </>
      ) : null}

      {phase === "paid" ? (
        <>
          <div className="zup-pop mx-auto mb-5.5 flex h-18 w-18 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
            <CheckCircle2 className="h-9 w-9" strokeWidth={2} aria-hidden />
          </div>
          <h1 className="mb-2.5 text-[28px] font-bold tracking-[-0.025em]">Payment received</h1>
          <p className="mb-7 text-[15px] leading-relaxed text-zup-gray">
            Order <strong>{orderId}</strong> is confirmed. We&apos;ll call before dispatch.
          </p>
        </>
      ) : null}

      {phase === "pending" ? (
        <>
          <Loader2
            className="mx-auto mb-5.5 h-10 w-10 animate-spin text-zup-blue"
            strokeWidth={2}
            aria-hidden
          />
          <h1 className="mb-2.5 text-[28px] font-bold tracking-[-0.025em]">
            Payment still processing
          </h1>
          <p className="mb-7 text-[15px] leading-relaxed text-zup-gray">
            Your order <strong>{orderId}</strong> is placed and we&apos;re waiting on the bank.
            Refresh in a moment — if money left your account, it will confirm on its own.
          </p>
        </>
      ) : null}

      {phase === "unpaid" || phase === "error" ? (
        <>
          <div className="mx-auto mb-5.5 flex h-18 w-18 items-center justify-center rounded-full bg-warn-bg text-destructive">
            <XCircle className="h-9 w-9" strokeWidth={2} aria-hidden />
          </div>
          <h1 className="mb-2.5 text-[28px] font-bold tracking-[-0.025em]">
            {phase === "error" ? "We couldn't check the payment" : "Payment not completed"}
          </h1>
          <p className="mb-7 text-[15px] leading-relaxed text-zup-gray">
            {message ||
              (orderId
                ? `Nothing was charged. Your order ${orderId} is still open — call us and we'll take it from there.`
                : "Nothing was charged. You can try again from your cart.")}
          </p>
        </>
      ) : null}

      {phase !== "checking" ? (
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/account"
            className="rounded-full bg-zup-blue px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-zup-blue-dark"
          >
            View my orders
          </Link>
          <Link
            href="/products"
            className="rounded-full border-2 border-zup-body/12 px-7 py-3.5 text-[15px] font-semibold transition-colors hover:border-zup-body/25"
          >
            Continue shopping
          </Link>
        </div>
      ) : null}
    </main>
  );
}
