"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/misc";
import { ApiError } from "@/lib/mock/db";
import { canReview, createReview, listReviews } from "@/lib/api/reviews";
import { useApi } from "@/lib/api/useApi";
import { useAuth } from "@/lib/state/AuthContext";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

const schema = z.object({
  rating: z.number().min(1, "Choose a star rating.").max(5),
  body: z.string().trim().min(10, "Write at least 10 characters so others can learn from it.").max(600, "Keep it under 600 characters."),
});
type Values = z.infer<typeof schema>;

function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span role="img" aria-label={`${n} out of 5 stars`} className={cn("inline-flex", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn("size-[18px]", i <= n ? "fill-butter-deep stroke-butter-deep" : "stroke-brown-soft")} strokeWidth={1.8} />
      ))}
    </span>
  );
}

function ReviewForm({ product }: { product: Pick<Product, "id" | "name"> }) {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { rating: 0, body: "" } });
  const rating = useWatch({ control, name: "rating" });

  if (sent) {
    return (
      <p role="status" className="max-w-[56ch] font-semibold">
        Thank you. Your review will appear once the maker has read it.
      </p>
    );
  }

  const onSubmit = handleSubmit(async (v) => {
    setFormError(undefined);
    try {
      await createReview({ productId: product.id, rating: v.rating, body: v.body });
      setSent(true);
      toast.success("Review sent");
    } catch (e) {
      if (e instanceof ApiError && e.fields?.body) setError("body", { message: e.fields.body });
      else setFormError(e instanceof Error ? e.message : "We couldn't send your review. Try again in a moment.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex max-w-[560px] flex-col gap-4">
      <p className="font-semibold">You bought this, so you can review it. Verified buyer.</p>
      <div>
        <p id="rating-label" className="mb-1.5 text-sm font-semibold">
          Your rating
        </p>
        <div role="radiogroup" aria-labelledby="rating-label" className="flex">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i} ${i === 1 ? "star" : "stars"}`}
              onClick={() => setValue("rating", i, { shouldValidate: true })}
              className="press grid size-11 place-items-center rounded-full"
            >
              <Star className={cn("size-7", i <= rating ? "fill-butter-deep stroke-butter-deep" : "stroke-brown-soft")} strokeWidth={1.8} />
            </button>
          ))}
        </div>
        {errors.rating ? (
          <p role="alert" className="mt-1 text-sm font-medium text-err">
            {errors.rating.message}
          </p>
        ) : null}
      </div>
      <Field label="Your review" error={errors.body?.message} hint="How were the stitches, the size, the colour?">
        {(p) => <Textarea {...p} {...register("body")} />}
      </Field>
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send review"}
        </Button>
      </div>
    </form>
  );
}

/** Honest reviews: shows published reviews if any exist, otherwise says so. The form only appears for verified buyers. */
export function Reviews({ product }: { product: Pick<Product, "id" | "name"> }) {
  const { user, loading: authLoading } = useAuth();
  const reviews = useApi(() => listReviews(product.id), `reviews:${product.id}`);
  const can = useApi(() => canReview(product.id), `can-review:${product.id}:${user?.id ?? "guest"}`, !authLoading);

  return (
    <section aria-labelledby="reviews-h" className="shell py-[clamp(3.5rem,8vw,6rem)]">
      <h2 id="reviews-h" className="font-display text-[clamp(2.25rem,5vw,3.5rem)]">
        Reviews
      </h2>
      <div className="mt-6">
        {reviews.error ? (
          <ErrorNote onRetry={reviews.reload}>We couldn&apos;t load the reviews.</ErrorNote>
        ) : reviews.loading && !reviews.data ? (
          <p className="text-brown">Loading reviews…</p>
        ) : reviews.data && reviews.data.length > 0 ? (
          <ul className="flex max-w-[68ch] flex-col divide-y divide-line">
            {reviews.data.map((r) => (
              <li key={r.id} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars n={r.rating} />
                  <span className="font-semibold">{r.author}</span>
                  {r.verified ? <span className="font-stencil text-[11px] text-ok">Verified buyer</span> : null}
                  <span className="tabular text-sm text-brown">{formatDate(r.createdAt, { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <p className="mt-2 leading-relaxed">{r.body}</p>
                {r.reply ? (
                  <div className="mt-3 max-w-[60ch] rounded-ticket bg-kraft-light p-4">
                    <p className="font-stencil text-[11px] text-cocoa">FuzzBall Factory replied</p>
                    <p className="mt-1.5 leading-relaxed">{r.reply}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-[56ch] text-brown">No reviews yet. Reviews open after your order arrives.</p>
        )}
      </div>
      {can.data ? <ReviewForm product={product} /> : null}
    </section>
  );
}
