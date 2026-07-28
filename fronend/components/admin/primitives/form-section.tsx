"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/**
 * A long form, broken into named groups.
 *
 * The product editor put ~25 fields in one flat grid — every field always
 * visible, none explained, no sense of where one topic ended and the next
 * began. An accordion was chosen over the two obvious alternatives:
 *
 *   A wizard is wrong for *editing*. Walking five steps to change one price
 *   is worse than the flat grid it replaces.
 *
 *   Tabs hide whichever group holds the thing you're looking for, and give no
 *   clue which groups are filled in.
 *
 *   An accordion shows every group title at once, each with a one-line
 *   summary of what's inside, so you can scan the whole product and open only
 *   the part you came to change. `type="multiple"` means someone who knows
 *   the form can open everything and work as before.
 */
export function FormGroups({
  defaultOpen = [],
  children,
  className,
}: {
  defaultOpen?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Accordion
      // `multiple` deliberately: an expert editing several things at once
      // shouldn't have a group snap shut every time they open another.
      multiple
      defaultValue={defaultOpen}
      className={cn("flex flex-col gap-2.5", className)}
    >
      {children}
    </Accordion>
  );
}

export function FormGroup({
  value,
  step,
  title,
  help,
  summary,
  children,
}: {
  value: string;
  /** Position in the form, so the shape of the whole job is visible. */
  step: number;
  title: string;
  /** One sentence, in plain words, about what this group is for. */
  help?: string;
  /** What's currently in here, shown while the group is closed. */
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-2xl border border-zup-body/8 bg-white"
    >
      <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
        <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zup-body/6 text-ui-xs font-extrabold text-zup-gray"
            aria-hidden
          >
            {step}
          </span>
          <span className="min-w-0">
            <span className="block text-ui-base font-bold text-zup-body">{title}</span>
            {summary ? (
              <span className="mt-0.5 block truncate text-ui-sm text-zup-gray">{summary}</span>
            ) : null}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="border-t border-zup-body/6 px-4 pt-4 pb-5">
        {help ? <p className="mb-4 text-ui-sm text-zup-gray">{help}</p> : null}
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}
