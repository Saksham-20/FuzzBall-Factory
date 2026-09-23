"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Flag, Star } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Panel } from "@/components/admin/ui";
import { FilterChips, ListSkeleton } from "@/components/admin/catalogue/kit";
import { ReasonModal, type ReasonTemplate } from "@/components/admin/orders/ReasonModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { clearReviewReply, listAdminProducts, listAdminReviews, moderateReview, setReviewReply } from "@/lib/api/admin";
import { formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";

type Filter = "ALL" | Review["status"];

const TONE: Record<Review["status"], "ready" | "mto" | "sold" | "err"> = { PUBLISHED: "ready", PENDING: "mto", HIDDEN: "sold", DISPUTED: "err" };
const LABEL: Record<Review["status"], string> = { PUBLISHED: "Published", PENDING: "Waiting", HIDDEN: "Hidden", DISPUTED: "Disputed" };

const DISPUTE_TEMPLATES: ReasonTemplate[] = [
  { label: "False claim about materials", text: "This review makes a false claim about the materials or fibre used." },
  { label: "Mismatched order", text: "This review describes a different order or product than the one we delivered." },
  { label: "Suspected fake review", text: "This doesn't read like a genuine review of a piece we made." },
];

function Stars({ n }: { n: number }) {
  return (
    <span role="img" aria-label={`${n} out of 5 stars`} className="inline-flex gap-0.5 text-cocoa">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className="size-4" strokeWidth={1.8} fill={i <= n ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

/** Inline editor for the maker's public reply. Keeps its own draft text so typing doesn't fight the list's reload. */
function ReplyEditor({ review, busy, onSave, onRemove }: { review: Review; busy: boolean; onSave: (text: string) => void; onRemove: () => void }) {
  const [text, setText] = useState(review.reply ?? "");
  const trimmed = text.trim();
  const dirty = trimmed !== (review.reply ?? "");

  return (
    <div className="mt-3 border-t border-line pt-3">
      <Field label="Your reply" hint="Shown publicly under this review, labelled as the maker's reply.">
        {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Thank the customer, or set the record straight…" />}
      </Field>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy || !trimmed || !dirty} onClick={() => onSave(trimmed)}>
          {busy ? "Saving…" : review.reply ? "Update reply" : "Save reply"}
        </Button>
        {review.reply ? (
          <Button variant="ghost" disabled={busy} onClick={onRemove}>
            Remove reply
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ReviewsClient() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const reviews = useApi(() => listAdminReviews(), "admin-reviews");
  const prods = useApi(() => listAdminProducts(), "admin-reviews-products");
  const [busy, setBusy] = useState<string | null>(null);
  const [replyBusy, setReplyBusy] = useState<string | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<Review | null>(null);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const names = useMemo(() => new Map((prods.data ?? []).map((p) => [p.id, p.name])), [prods.data]);

  const all = reviews.data ?? [];
  const counts = { ALL: all.length, PENDING: 0, PUBLISHED: 0, HIDDEN: 0, DISPUTED: 0 };
  all.forEach((r) => (counts[r.status] += 1));
  const rows = all.filter((r) => filter === "ALL" || r.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function act(r: Review, to: "PUBLISHED" | "HIDDEN") {
    setBusy(r.id);
    try {
      await moderateReview(r.id, to);
      toast.success(to === "PUBLISHED" ? "Review published." : "Review hidden.");
      reviews.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update that review. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmDispute(reason: string) {
    if (!disputeTarget) return;
    setBusy(disputeTarget.id);
    setDisputeError(null);
    try {
      await moderateReview(disputeTarget.id, "DISPUTED", reason);
      toast.success("Review marked disputed. It won't show on the shop.");
      reviews.reload();
      setDisputeTarget(null);
    } catch (e) {
      setDisputeError(e instanceof Error ? e.message : "Couldn't mark that review disputed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function saveReply(r: Review, text: string) {
    setReplyBusy(r.id);
    try {
      await setReviewReply(r.id, text);
      toast.success("Reply saved.");
      reviews.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that reply. Try again.");
    } finally {
      setReplyBusy(null);
    }
  }

  async function removeReply(r: Review) {
    setReplyBusy(r.id);
    try {
      await clearReviewReply(r.id);
      toast.success("Reply removed.");
      reviews.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove that reply. Try again.");
    } finally {
      setReplyBusy(null);
    }
  }

  return (
    <AdminPage title="Reviews">
      {reviews.error ? (
        <ErrorNote onRetry={reviews.reload}>{reviews.error.message || "Reviews didn't load."}</ErrorNote>
      ) : reviews.loading && !reviews.data ? (
        <ListSkeleton rows={4} />
      ) : all.length === 0 ? (
        <Panel>
          <EmptyState title="No reviews yet">
            When customers review a piece they received, it lands here first. Nothing goes on a product page until you publish it.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <FilterChips
            label="Filter by status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "All", count: counts.ALL },
              { value: "PENDING", label: "Waiting", count: counts.PENDING },
              { value: "PUBLISHED", label: "Published", count: counts.PUBLISHED },
              { value: "HIDDEN", label: "Hidden", count: counts.HIDDEN },
              { value: "DISPUTED", label: "Disputed", count: counts.DISPUTED },
            ]}
          />
          {rows.length === 0 ? (
            <Panel><p className="py-2 text-brown">No reviews with that status.</p></Panel>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-ticket bg-paper p-4 shadow-ticket md:p-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars n={r.rating} />
                    <span className="font-semibold">{r.author}</span>
                    {r.verified ? <Badge tone="ready">Verified buyer</Badge> : null}
                    <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                    <span className="ml-auto text-sm text-brown-soft">{formatDate(r.createdAt, { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <p className="mt-1 text-sm text-brown">On {names.get(r.productId) ?? "a product that no longer exists"}</p>
                  <p className="mt-2 max-w-[68ch]">{r.body}</p>
                  {r.disputeReason ? (
                    <p className="mt-2 text-sm font-medium text-err">Dispute reason: {r.disputeReason}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status !== "PUBLISHED" ? (
                      <Button variant="secondary" disabled={busy === r.id} onClick={() => act(r, "PUBLISHED")}><Eye strokeWidth={1.8} /> {busy === r.id ? "Publishing…" : "Publish review"}</Button>
                    ) : null}
                    {r.status !== "HIDDEN" ? (
                      <Button variant="ghost" disabled={busy === r.id} onClick={() => act(r, "HIDDEN")}><EyeOff strokeWidth={1.8} /> {busy === r.id ? "Hiding…" : "Hide review"}</Button>
                    ) : null}
                    {r.status !== "DISPUTED" ? (
                      <Button variant="ghost" disabled={busy === r.id} onClick={() => { setDisputeTarget(r); setDisputeError(null); }}>
                        <Flag strokeWidth={1.8} /> Dispute…
                      </Button>
                    ) : null}
                  </div>
                  <ReplyEditor review={r} busy={replyBusy === r.id} onSave={(text) => saveReply(r, text)} onRemove={() => removeReply(r)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {disputeTarget ? (
        <ReasonModal
          open
          onOpenChange={(v) => { if (!v) { setDisputeTarget(null); setDisputeError(null); } }}
          title="Dispute this review?"
          description="Add a short internal reason (a false claim about materials, a mismatched order, and so on). The review stops showing on the shop, same as hiding it, but the reason is kept for the record."
          templates={DISPUTE_TEMPLATES}
          fieldLabel="Reason for the dispute"
          confirmLabel="Mark disputed"
          busyLabel="Marking disputed…"
          busy={busy === disputeTarget.id}
          error={disputeError}
          onConfirm={confirmDispute}
        />
      ) : null}
    </AdminPage>
  );
}
