"use client";

import { useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { checkShipping, type ShippingCheck } from "@/lib/api/shipping";
import { formatDate } from "@/lib/format";
import type { Product } from "@/lib/types";

// Country codes match the zone table in the settings; "OTHER" falls into "Rest of world".
const COUNTRIES = [
  ["IN", "India"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["AE", "United Arab Emirates"],
  ["SG", "Singapore"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["NL", "Netherlands"],
  ["IT", "Italy"],
  ["ES", "Spain"],
  ["IE", "Ireland"],
  ["NZ", "New Zealand"],
  ["MY", "Malaysia"],
  ["NP", "Nepal"],
  ["LK", "Sri Lanka"],
  ["BD", "Bangladesh"],
  ["SA", "Saudi Arabia"],
  ["QA", "Qatar"],
  ["OTHER", "Somewhere else"],
] as const;

type State = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "done"; result: ShippingCheck; country: string };

interface Props {
  product: Pick<Product, "fulfilment" | "leadTimeDays">;
  /** Called with the check result, or undefined when the shopper edits the inputs. */
  onResult: (r: ShippingCheck | undefined) => void;
}

export function DeliveryCheck({ product, onResult }: Props) {
  const [country, setCountry] = useState("IN");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string>();
  const [state, setState] = useState<State>({ status: "idle" });
  const ready = product.fulfilment === "READY";

  const reset = () => {
    if (state.status !== "idle") {
      setState({ status: "idle" });
      onResult(undefined);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (country === "IN" && !/^[1-9][0-9]{5}$/.test(pin.trim())) {
      setPinError("Enter a valid 6-digit pincode, like 560038.");
      return;
    }
    setPinError(undefined);
    setState({ status: "loading" });
    try {
      const result = await checkShipping({ country, postalCode: pin, leadTimeDays: product.leadTimeDays, ready });
      if (!result.serviceable) {
        setState({ status: "error", message: result.message });
        onResult(undefined);
        return;
      }
      setState({ status: "done", result, country });
      onResult(result);
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "We couldn't check that just now. Try again in a moment." });
      onResult(undefined);
    }
  };

  const loading = state.status === "loading";

  return (
    <form onSubmit={submit} noValidate aria-label="Check delivery" className="rounded-ticket bg-paper p-4 shadow-ticket">
      <p className="font-semibold">Check delivery</p>
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Country">
          {(p) => (
            <Select
              {...p}
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setPinError(undefined);
                reset();
              }}
            >
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex items-start gap-2">
          {country === "IN" ? (
            <Field label="Pincode" error={pinError} className="min-w-0 flex-1">
              {(p) => (
                <Input
                  {...p}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setPinError(undefined);
                    reset();
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  placeholder="560038"
                />
              )}
            </Field>
          ) : (
            <p className="mt-[1.625rem] flex min-h-12 flex-1 items-center text-sm text-brown">No pincode needed. We ship worldwide.</p>
          )}
          <Button type="submit" variant="secondary" disabled={loading} className="mt-[1.625rem] h-12">
            {loading ? "Checking…" : "Check"}
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="mt-3 empty:hidden">
        {state.status === "error" ? (
          <p className="flex items-start gap-2 text-[15px] font-medium text-err">
            <CircleAlert aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.8} />
            {state.message}
          </p>
        ) : state.status === "done" ? (
          <div className="flex items-start gap-2 text-[15px]">
            <CircleCheck aria-hidden className="mt-0.5 size-[18px] shrink-0 text-ok" strokeWidth={1.8} />
            <div>
              <p className="font-semibold">
                Delivers by{" "}
                {state.result.deliverBy ? formatDate(state.result.deliverBy, { weekday: "short", day: "numeric", month: "short" }) : "soon"}
                {state.result.transitDays ? <span className="font-normal text-brown"> · {state.result.transitDays} in transit</span> : null}
              </p>
              <p className="mt-0.5 text-brown">
                {state.result.codAvailable
                  ? "Cash on delivery is available for this piece."
                  : state.country !== "IN"
                    ? "Cash on delivery is India only. Pay by card or UPI at checkout."
                    : ready
                      ? "Cash on delivery isn't available for this order."
                      : "Cash on delivery is only for ready-to-ship pieces. Pay by UPI or card."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  );
}
