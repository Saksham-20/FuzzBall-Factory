import { YarnBall } from "@/components/brand/YarnBall";

/**
 * Shown while this page waits on the catalogue (a product or shelf that was not built ahead of time is fetched on first
 * visit). Quiet: one slow-turning ball, no skeleton. Only here, not store-wide: pages with nothing slow to wait for would
 * just flash it, and a streamed page keeps a hidden copy of itself in the DOM until it swaps in.
 */
export default function CatalogueLoading() {
  return (
    <div role="status" className="grid min-h-[60dvh] place-items-center px-6">
      <YarnBall className="w-20" tone="kraft" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
