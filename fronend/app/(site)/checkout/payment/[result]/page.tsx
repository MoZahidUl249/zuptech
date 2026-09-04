import type { Metadata } from "next";
import { PaymentReturn } from "@/components/checkout/payment-return";

export const metadata: Metadata = { title: "Payment" };

/**
 * Where the payment gateway sends the customer back to.
 *
 * Three URLs (success / failed / cancelled) share one page, because the URL is
 * not evidence. Anyone can type `/checkout/payment/success`, so the segment
 * only decides the first thing shown — the actual outcome comes from asking
 * our backend, which asks the gateway. See `PaymentReturn`.
 */
export default async function PaymentReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ result: string }>;
  searchParams: Promise<{ txn?: string }>;
}) {
  const { result } = await params;
  const { txn } = await searchParams;

  return <PaymentReturn hint={result} merchantTxnId={txn ?? ""} />;
}
