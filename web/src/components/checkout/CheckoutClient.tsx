"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, Lock, Truck } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Radio, Select, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorNote, HookSpinner, Skeleton } from "@/components/ui/misc";
import { CheckoutSection } from "@/components/checkout/CheckoutSection";
import { OrderLines } from "@/components/checkout/OrderLines";
import { PolicyCheckbox } from "@/components/checkout/PolicyCheckbox";
import { TestPaymentModal } from "@/components/checkout/TestPaymentModal";
import { Totals } from "@/components/checkout/Totals";
import { useBasket, useCheckoutQuote, useCoupon } from "@/components/checkout/useBasket";
import { listAddresses } from "@/lib/api/account";
import { PaymentDismissedError, PaymentUnconfirmedError } from "@/lib/api/errors";
import { confirmPayment, paymentMode, placeOrder, type PlaceOrderInput } from "@/lib/api/orders";
import { checkShipping } from "@/lib/api/shipping";
import { getSettings } from "@/lib/api/settings";
import { useApi } from "@/lib/api/useApi";
import { CHECKOUT_DEFAULTS, GIFT_NOTE_MAX, checkoutSchema, type CheckoutValues } from "@/lib/schemas/checkout";
import { SITE } from "@/lib/site";
import { useAuth } from "@/lib/state/AuthContext";
import { formatDate, formatINR } from "@/lib/format";
import { COUNTRIES, INDIAN_STATES } from "@/lib/status";
import type { Address } from "@/lib/types";

const pinOk = (country: string, postal: string) => country !== "IN" || /^[1-9][0-9]{5}$/.test(postal);

export function CheckoutClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const basket = useBasket();
  const { cart } = basket;
  const [coupon, setCoupon] = useCoupon();
  const { data: settings } = useApi(getSettings, "settings");

  const form = useForm<CheckoutValues>({ resolver: zodResolver(checkoutSchema), mode: "onTouched", defaultValues: CHECKOUT_DEFAULTS });
  const { register, control, setValue, getValues, handleSubmit, formState } = form;
  const { errors } = formState;

  const country = useWatch({ control, name: "country" });
  const postalCode = useWatch({ control, name: "postalCode" });
  const giftWrap = useWatch({ control, name: "giftWrap" });
  const giftNote = useWatch({ control, name: "giftNote" });
  const payment = useWatch({ control, name: "paymentMethod" });

  const { data: q, loading: quoting, error: quoteError } = useCheckoutQuote(basket.quoteLines, { country, giftWrap, coupon: coupon || undefined, paymentMethod: payment });
  const lead = q?.maxLeadTimeDays;
  const { data: ship } = useApi(
    () => checkShipping({ country, postalCode, leadTimeDays: lead, ready: q ? !q.hasMadeToOrder : true }),
    `ship:${country}:${postalCode}:${lead}:${q?.hasMadeToOrder}`,
    !!q && pinOk(country, postalCode),
  );

  // Saved addresses for logged-in shoppers
  const { data: savedList, error: savedError } = useApi(listAddresses, `addresses:${user?.id}`, !!user);
  const saved = savedList ?? (savedError ? [] : undefined);
  const [choice, setChoice] = useState<string | null>(null);
  const defaultAddress = saved?.find((a) => a.isDefault) ?? saved?.[0];
  const activeChoice = choice ?? defaultAddress?.id ?? "new";

  function applyAddress(a: Address) {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    setValue("recipient", a.name, opts);
    setValue("country", a.country, opts);
    setValue("line1", a.line1, opts);
    setValue("line2", a.line2 ?? "", opts);
    setValue("city", a.city, opts);
    setValue("state", a.state, opts);
    setValue("postalCode", a.postalCode, opts);
  }

  // Prefill once from the account and the default saved address
  const prefilled = useRef(false);
  useEffect(() => {
    // wait for addresses so everything is filled in one pass
    if (prefilled.current || !user || !saved) return;
    prefilled.current = true;
    if (!getValues("name")) setValue("name", user.name);
    if (!getValues("email")) setValue("email", user.email);
    if (!getValues("phone") && user.phone) setValue("phone", user.phone);
    if (defaultAddress) {
      applyAddress(defaultAddress);
      if (!getValues("phone")) setValue("phone", defaultAddress.phone);
    } else if (!getValues("recipient")) {
      setValue("recipient", user.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, saved]);

  // COD may become ineligible when the country or basket changes
  useEffect(() => {
    if (payment === "COD" && q && !q.codEligible) setValue("paymentMethod", "RAZORPAY");
  }, [payment, q, setValue]);

  // Payment flow
  const [payOpen, setPayOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  /** Neutral, not an error: the customer closed the payment window and the order is waiting. */
  const [notice, setNotice] = useState<string>();
  const pending = useRef<{ number: string; total: number } | null>(null);
  const draftValues = useRef<CheckoutValues | null>(null);

  function toInput(v: CheckoutValues): PlaceOrderInput {
    return {
      lines: basket.quoteLines,
      contact: { name: v.name, email: v.email, phone: v.phone },
      address: { name: v.recipient, phone: v.phone, line1: v.line1, line2: v.line2 || undefined, city: v.city, state: v.state, postalCode: v.postalCode, country: v.country },
      giftWrap: v.giftWrap,
      giftNote: v.giftWrap && v.giftNote ? v.giftNote : undefined,
      hidePrices: v.giftWrap ? v.hidePrices : false,
      coupon: q?.couponApplied,
      paymentMethod: v.paymentMethod,
      saveAddress: !!user && v.saveAddress,
    };
  }

  /** `confirming`: Razorpay reported a payment we couldn't verify in time. The order page keeps checking and says so. */
  function finish(number: string, opts: { confirming?: boolean } = {}) {
    setRedirecting(true);
    cart.clear();
    setCoupon("");
    router.push(`/order/${number}?new=1${opts.confirming ? "&confirming=1" : ""}`);
  }

  /** The order for this basket: placed once, then reused while the total is unchanged (a retry never creates a second one). */
  async function ensureOrder(v: CheckoutValues): Promise<string> {
    if (pending.current && pending.current.total === q?.total) return pending.current.number;
    const o = await placeOrder(toInput(v));
    pending.current = { number: o.number, total: o.total };
    return o.number;
  }

  async function place(v: CheckoutValues) {
    setSubmitError(undefined);
    setNotice(undefined);
    if (!q) return;
    if (v.paymentMethod === "COD") {
      setPlacing(true);
      try {
        const o = await placeOrder(toInput(v));
        finish(o.number);
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "We couldn't place your order. Please try again.");
        setPlacing(false);
      }
      return;
    }
    draftValues.current = v;
    // Sample data (no API): the test window first, exactly as before.
    if (SITE.useMock) {
      setPayOpen(true);
      return;
    }
    await payOnline(v);
  }

  /** Real API: place the order, then open whichever window the API's payment mode calls for. */
  async function payOnline(v: CheckoutValues) {
    setPlacing(true);
    try {
      const number = await ensureOrder(v);
      // A staging API runs simulated payments: it gets the test window. Live payments get Razorpay's own.
      if ((await paymentMode(number)) === "mock") {
        setPayOpen(true);
        return;
      }
      await confirmPayment(number, true, { description: `Order ${number}`, prefill: { name: v.name, email: v.email, contact: v.phone } });
      finish(number);
    } catch (e) {
      if (e instanceof PaymentUnconfirmedError && pending.current) finish(pending.current.number, { confirming: true });
      else if (e instanceof PaymentDismissedError) {
        const n = pending.current?.number;
        setNotice(`You closed the payment window. ${n ? `Your order ${n} is saved and waiting: ` : ""}press Pay to pick up where you left off.`);
      }
      else setSubmitError(e instanceof Error ? e.message : "We couldn't start the payment. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    void handleSubmit(place)(e);
  }

  async function pay(ok: boolean) {
    const v = draftValues.current;
    if (!v || !q) return;
    const number = await ensureOrder(v);
    await confirmPayment(number, ok); // throws on failure, shown inside the modal
    finish(number);
  }

  if (redirecting) {
    return (
      <div className="grid min-h-[60dvh] place-items-center px-4 text-center" role="status">
        <div className="flex flex-col items-center gap-3">
          <HookSpinner />
          <p className="font-semibold">Taking you to your order</p>
        </div>
      </div>
    );
  }

  if (basket.loading) {
    return (
      <div className="shell py-8 md:py-12" aria-busy="true">
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)]">Checkout</h1>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-5">
            <Skeleton className="h-56" />
            <Skeleton className="h-80" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (basket.error) {
    return (
      <div className="shell py-8 md:py-12">
        <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)]">Checkout</h1>
        <div className="mt-8 max-w-xl">
          <ErrorNote onRetry={basket.reload}>We couldn&apos;t load your basket. Check your connection and try again.</ErrorNote>
        </div>
      </div>
    );
  }

  if (basket.items.length === 0) {
    return (
      <div className="shell py-8 md:py-12">
        <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)]">Checkout</h1>
        <EmptyState
          title="Nothing to check out yet"
          action={
            <Button asChild size="lg">
              <Link href="/shop">Shop the shelf</Link>
            </Button>
          }
        >
          Your basket is empty. Add a piece you love and come back here to pay.
        </EmptyState>
      </div>
    );
  }

  const isIndia = country === "IN";
  const cod = payment === "COD";
  const err = (k: keyof CheckoutValues) => errors[k]?.message as string | undefined;
  const busy = placing || formState.isSubmitting;

  return (
    <div className="shell py-8 md:py-12">
      <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)]">Checkout</h1>
      {!user && !authLoading ? (
        <p className="mt-3 max-w-[60ch] text-brown">
          You&apos;re checking out as a guest, which is fine. Have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent("/checkout")}`} className="font-semibold text-cocoa underline">
            Log in
          </Link>{" "}
          to use your saved addresses.
        </p>
      ) : null}

      {basket.missing.length > 0 ? (
        <div className="mt-6 max-w-xl">
          <ErrorNote>
            Something in your basket isn&apos;t available any more.{" "}
            <Link href="/cart" className="underline">
              Review your basket
            </Link>
          </ErrorNote>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_420px] lg:gap-12">
        <div className="space-y-5">
          <CheckoutSection n={1} title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={err("name")} className="sm:col-span-2">
                {(p) => (
                  <Input
                    {...p}
                    autoComplete="name"
                    {...register("name", {
                      onBlur: (e) => {
                        if (!getValues("recipient")) setValue("recipient", e.target.value);
                      },
                    })}
                  />
                )}
              </Field>
              <Field label="Email" error={err("email")} hint="For your receipt and order updates.">
                {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" {...register("email")} />}
              </Field>
              <Field label="Phone or WhatsApp" error={err("phone")} hint="With country code, like +91 98765 43210.">
                {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />}
              </Field>
            </div>
          </CheckoutSection>

          <CheckoutSection n={2} title="Address">
            {saved && saved.length > 0 ? (
              <fieldset className="mb-5 space-y-2.5">
                <legend className="mb-1.5 text-sm font-semibold">Deliver to</legend>
                {saved.map((a) => (
                  <Radio
                    key={a.id}
                    name="saved-address"
                    value={a.id}
                    checked={activeChoice === a.id}
                    onChange={() => {
                      setChoice(a.id);
                      applyAddress(a);
                    }}
                    label={
                      <>
                        {a.label}
                        {a.isDefault ? <span className="ml-2 text-xs font-normal text-brown-soft">Default</span> : null}
                      </>
                    }
                    description={`${a.name}, ${a.line1}, ${a.city} ${a.postalCode}`}
                  />
                ))}
                <Radio
                  name="saved-address"
                  value="new"
                  checked={activeChoice === "new"}
                  onChange={() => {
                    setChoice("new");
                    for (const k of ["line1", "line2", "city", "state", "postalCode"] as const) setValue(k, "");
                  }}
                  label="Use a different address"
                />
              </fieldset>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" error={err("country")}>
                {(p) => (
                  <Select
                    {...p}
                    autoComplete="country"
                    {...register("country", {
                      onChange: () => {
                        setValue("state", "");
                        setValue("postalCode", "");
                      },
                    })}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Recipient name" error={err("recipient")} hint="Who will sign for the parcel?">
                {(p) => <Input {...p} autoComplete="shipping name" {...register("recipient")} />}
              </Field>
              <Field label="House number and street" error={err("line1")} className="sm:col-span-2">
                {(p) => <Input {...p} autoComplete="address-line1" {...register("line1")} />}
              </Field>
              <Field label="Apartment, landmark" optional error={err("line2")} className="sm:col-span-2">
                {(p) => <Input {...p} autoComplete="address-line2" {...register("line2")} />}
              </Field>
              <Field label="City or town" error={err("city")}>
                {(p) => <Input {...p} autoComplete="address-level2" {...register("city")} />}
              </Field>
              {isIndia ? (
                <Field label="State" error={err("state")}>
                  {(p) => (
                    <Select {...p} autoComplete="address-level1" {...register("state")}>
                      <option value="">Select a state</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : (
                <Field label="State or region" optional error={err("state")}>
                  {(p) => <Input {...p} autoComplete="address-level1" {...register("state")} />}
                </Field>
              )}
              <Field label={isIndia ? "Pincode" : "Postal code"} error={err("postalCode")} hint={isIndia ? "6 digits. We'll check delivery to it." : undefined}>
                {(p) => (
                  <Input
                    {...p}
                    autoComplete="postal-code"
                    inputMode={isIndia ? "numeric" : "text"}
                    maxLength={isIndia ? 6 : 12}
                    className="tabular"
                    {...register("postalCode")}
                  />
                )}
              </Field>
            </div>
            {user ? (
              <Checkbox className="mt-3" label="Save this address to my account" {...register("saveAddress")} />
            ) : null}
          </CheckoutSection>

          <CheckoutSection n={3} title="Delivery">
            {!q ? (
              <Skeleton className="h-24" />
            ) : (
              <div className="flex items-start gap-3 rounded-[12px] border-[1.5px] border-cocoa bg-paper p-3.5">
                <Truck className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold">{q.shippingLabel}</p>
                    <p className="tabular font-bold">{q.shipping === 0 ? "Free" : formatINR(q.shipping)}</p>
                  </div>
                  <p className="mt-0.5 text-sm text-brown">
                    Dispatch by <strong className="font-semibold text-cocoa">{formatDate(q.estimatedDispatch)}</strong>, then {q.transitDays} in transit.
                  </p>
                  <p className="mt-1 text-sm text-brown" aria-live="polite">
                    {isIndia && !pinOk(country, postalCode)
                      ? "Enter your 6-digit pincode for a delivery estimate."
                      : ship
                        ? ship.serviceable
                          ? `${ship.message}${ship.deliverBy ? ` Estimated delivery by ${formatDate(ship.deliverBy)}.` : ""}`
                          : ship.message
                        : "Checking delivery"}
                  </p>
                </div>
              </div>
            )}
            {quoteError ? (
              <div className="mt-3">
                <ErrorNote>We couldn&apos;t work out delivery for this address. Check your details and try again.</ErrorNote>
              </div>
            ) : null}
            {!isIndia ? <p className="mt-3 text-sm text-brown">Prices are in INR. Your card may add currency conversion or import duties at delivery.</p> : null}
          </CheckoutSection>

          <CheckoutSection n={4} title="Gift">
            <div className="flex items-start gap-3">
              <Gift className="mt-3 size-5 shrink-0 text-brown" strokeWidth={1.8} />
              <div className="min-w-0 flex-1">
                <Checkbox
                  label={
                    <>
                      Wrap it as a gift{settings ? <span className="text-brown"> · adds {formatINR(settings.giftWrapPrice)}</span> : null}
                    </>
                  }
                  {...register("giftWrap")}
                />
                {giftWrap ? (
                  <div className="mt-3 space-y-3">
                    <Field
                      label="Gift note"
                      optional
                      error={err("giftNote")}
                      hint={
                        <span className="tabular">
                          {giftNote.length}/{GIFT_NOTE_MAX}. We&apos;ll handwrite it on a card.
                        </span>
                      }
                    >
                      {(p) => <Textarea {...p} rows={3} maxLength={GIFT_NOTE_MAX} {...register("giftNote")} />}
                    </Field>
                    <Checkbox label="Hide prices on the packing slip" {...register("hidePrices")} />
                  </div>
                ) : null}
              </div>
            </div>
          </CheckoutSection>

          <CheckoutSection n={5} title="Payment">
            <fieldset className="space-y-2.5">
              <legend className="sr-only">Payment method</legend>
              <Radio value="RAZORPAY" label="UPI, cards, netbanking, wallets" description="Pay securely with Razorpay." {...register("paymentMethod")} />
              <Radio
                value="COD"
                disabled={!q?.codEligible}
                label="Cash on delivery"
                description={q ? (q.codEligible ? (settings ? `Pay when it arrives. A ${formatINR(settings.codFee)} fee applies.` : "Pay when it arrives.") : q.codReason) : "Checking"}
                {...register("paymentMethod")}
              />
            </fieldset>
            {cod ? (
              <div className="mt-3 space-y-2">
                <p className="rounded-[12px] bg-cream px-4 py-3 text-sm text-brown">
                  We confirm cash-on-delivery orders on WhatsApp before we start making them, so please make sure your number is right.
                </p>
                {q && q.codFee > 0 ? (
                  <p className="text-sm text-brown">
                    Paying online skips the {formatINR(q.codFee)} cash-on-delivery fee.{" "}
                    <button
                      type="button"
                      onClick={() => setValue("paymentMethod", "RAZORPAY", { shouldValidate: true, shouldDirty: true })}
                      className="font-semibold underline [@media(hover:hover)_and_(pointer:fine)]:hover:text-cocoa"
                    >
                      Pay online instead
                    </button>
                  </p>
                ) : null}
              </div>
            ) : null}
          </CheckoutSection>
        </div>

        <aside aria-labelledby="co-6" className="lg:sticky lg:top-28">
          <Ticket head={["Review", `${cart.count} ${cart.count === 1 ? "piece" : "pieces"}`]} className="p-4 pt-2 md:p-5 md:pt-2">
            <h2 id="co-6" className="sr-only">
              Review your order
            </h2>
            <OrderLines items={basket.items} />

            <div className="mt-2 border-t border-cocoa/20 pt-4">
              {q ? (
                <Totals
                  subtotal={q.subtotal}
                  shipping={q.shipping}
                  shippingLabel={q.shippingLabel}
                  giftWrap={q.giftWrap}
                  codFee={q.codFee}
                  discount={q.discount}
                  couponCode={q.couponApplied}
                  total={q.total}
                  stale={quoting}
                />
              ) : (
                <Skeleton className="h-40" />
              )}
              {q?.couponError ? (
                <p role="alert" className="mt-2 text-sm font-medium text-err">
                  {q.couponError} <Link href="/cart" className="underline">Fix it in your basket</Link>
                </p>
              ) : null}
            </div>

            {q ? (
              <p className="mt-4 text-sm text-brown">
                Estimated dispatch <strong className="font-semibold text-cocoa">{formatDate(q.estimatedDispatch, { day: "numeric", month: "short" })}</strong>
                {q.hasMadeToOrder ? ". Some pieces are crocheted after you order." : ". Everything is ready to ship."}
              </p>
            ) : null}

            <div className="mt-4">
              <PolicyCheckbox error={errors.policy ? err("policy") : undefined} {...register("policy")} />
            </div>

            {submitError ? (
              <div className="mt-3">
                <ErrorNote>{submitError}</ErrorNote>
              </div>
            ) : null}
            <div aria-live="polite">
              {notice ? <p className="mt-3 rounded-[12px] bg-kraft-light px-4 py-3 text-sm text-cocoa">{notice}</p> : null}
            </div>

            <Button type="submit" size="lg" className="mt-4 w-full" disabled={!q || busy || basket.missing.length > 0} aria-busy={busy}>
              <Lock strokeWidth={1.8} />
              {busy ? (cod ? "Placing your order" : "Opening the payment window") : !q ? "Pay" : cod ? `Place order · ${formatINR(q.total)}` : `Pay ${formatINR(q.total)}`}
            </Button>
            <p className="mt-3 text-center text-xs text-brown">
              {cod ? "You'll pay the courier when it arrives." : "You'll pay in a secure window. Nothing is charged until you confirm."}
            </p>
          </Ticket>
        </aside>
      </form>

      <TestPaymentModal open={payOpen} onOpenChange={setPayOpen} amount={q?.total ?? 0} onPay={pay} />
    </div>
  );
}
