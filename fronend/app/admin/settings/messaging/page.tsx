import type { Metadata } from "next";
import { MessagingSection } from "@/components/admin/section-messaging";

export const metadata: Metadata = { title: "Text messages" };

export default function Page() {
  return <MessagingSection />;
}
