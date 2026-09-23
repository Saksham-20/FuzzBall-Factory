import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { YarnBall } from "@/components/brand/YarnBall";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16 text-center">
      <div className="flex max-w-md flex-col items-center gap-5">
        <YarnBall className="w-36" spin={false} tone="kraft" />
        <h1 className="font-display text-[clamp(3rem,10vw,5rem)]">Dropped a stitch</h1>
        <p className="text-brown">
          We couldn&apos;t find that page. It may not be built yet, or the link may be old.
        </p>
        <Button asChild size="lg">
          <Link href="/">Back to the factory</Link>
        </Button>
      </div>
    </main>
  );
}
