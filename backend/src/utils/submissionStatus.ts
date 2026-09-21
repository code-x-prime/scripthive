/**
 * Single source of truth for how a submission's `status` and `productionStatus`
 * relate to each other.
 *
 * `status` is the editorial state (Pending → UnderReview → Accepted → Published).
 * `productionStatus` is the position in the production pipeline that drives the
 * admin queues under /admin/production/*.
 *
 * These two fields must stay in sync: a paper that reached `status: "Published"`
 * has left the pipeline, so it must not keep a pipeline stage like
 * "ReadyToPublished" — otherwise it lingers in the "Ready to published" queue
 * forever. Route every status write through `productionStatusForStatus` so this
 * rule can never be forgotten at one call site again.
 */

/** Pipeline stages a submission moves through before it is published. */
export const PRODUCTION_STAGES = [
  "ReadyForPreparation",
  "ReadyForUpload",
  "ReadyToPublished"
] as const;

export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

/** Terminal pipeline value for papers that have been published. */
export const PRODUCTION_PUBLISHED = "Published";

/**
 * Returns the `productionStatus` value to write alongside a new `status`, or
 * `undefined` when the pipeline position should be left untouched.
 *
 * - Publishing moves the paper out of the pipeline entirely.
 * - Un-publishing (Published → anything else) sends it back to the final
 *   pre-publish stage so it reappears in the "Ready to published" queue.
 */
export function productionStatusForStatus(
  nextStatus: string,
  previousStatus: string | null
): string | undefined {
  if (nextStatus === "Published") return PRODUCTION_PUBLISHED;
  if (previousStatus === "Published") return "ReadyToPublished";
  return undefined;
}

/**
 * Builds the Prisma `data` patch for a status change, including the
 * `productionStatus` correction when one is needed.
 */
export function statusChangeData(
  nextStatus: string,
  previousStatus: string | null
): { status: string; productionStatus?: string } {
  const productionStatus = productionStatusForStatus(nextStatus, previousStatus);
  return productionStatus === undefined
    ? { status: nextStatus }
    : { status: nextStatus, productionStatus };
}
