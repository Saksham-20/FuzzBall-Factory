import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Checkbox } from "@/components/ui/Field";

type Props = Omit<ComponentPropsWithoutRef<typeof Checkbox>, "label"> & { error?: string };

/** "I've read the policies" with its four links (they open in a new tab so the checkout stays put) and its error. */
export const PolicyCheckbox = forwardRef<HTMLInputElement, Props>(function PolicyCheckbox({ error, ...rest }, ref) {
  return (
    <>
      <Checkbox
        ref={ref}
        label={
          <>
            I&apos;ve read the{" "}
            <Link href="/policies/refund" target="_blank" className="font-semibold underline">
              refund policy
            </Link>
            ,{" "}
            <Link href="/policies/shipping" target="_blank" className="font-semibold underline">
              shipping policy
            </Link>
            ,{" "}
            <Link href="/policies/terms" target="_blank" className="font-semibold underline">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/policies/privacy" target="_blank" className="font-semibold underline">
              privacy notice
            </Link>
            .
          </>
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "policy-err" : undefined}
        {...rest}
      />
      {error ? (
        <p id="policy-err" role="alert" className="text-sm font-medium text-err">
          {error}
        </p>
      ) : null}
    </>
  );
});
