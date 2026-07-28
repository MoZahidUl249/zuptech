/*
 * Admin-shaped primitives.
 *
 * Anything generic (buttons, inputs, cards, badges, dialogs) lives in
 * components/ui/ and comes from shadcn. This folder is only for the pieces
 * that are specific to running an admin panel: data tables, filter bars,
 * page headers, empty states.
 *
 * The older ../ui.tsx still exports the previous generation of these and
 * re-exports what moved, so existing screens keep working while they migrate.
 */

export { DataTable, sortRows, type Column, type SortState } from "./data-table";
export {
  CardSkeleton,
  EmptyState,
  PageHeader,
  ResourceState,
  TableSkeleton,
} from "./shell-bits";
