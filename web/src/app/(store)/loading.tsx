import { YarnBall } from "@/components/brand/YarnBall";

/** Shown while a server-rendered store page waits on the catalogue. Quiet: one slow-turning ball, no skeleton. */
export default function StoreLoading() {
  return (
    <div role="status" className="grid min-h-[60dvh] place-items-center px-6">
      <YarnBall className="w-20" tone="kraft" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
