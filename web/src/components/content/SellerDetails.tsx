import { LegalValue, Ph } from "@/components/content/Placeholder";
import { LEGAL } from "@/lib/legal";
import { SITE } from "@/lib/site";

/**
 * PLACEHOLDER(legal-details): seller identity required by the Consumer Protection
 * (E-Commerce) Rules, 2020: legal name, registered address, GSTIN, contact. Values come from `LEGAL`.
 */
export function LegalAddress({ className }: { className?: string }) {
  return (
    <address className={className ?? "not-italic leading-relaxed"}>
      {LEGAL.legalName ? <>{LEGAL.legalName}<br /></> : <><Ph>[Legal business name]</Ph><br /></>}
      {LEGAL.addressLines?.length ? (
        LEGAL.addressLines.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))
      ) : (
        <>
          <Ph>[Registered address, line 1]</Ph>
          <br />
          <Ph>[City, State, PIN code]</Ph>
          <br />
        </>
      )}
      India
    </address>
  );
}

/** "GSTIN 29…" when registered, "not registered for GST" when not, a placeholder until the owner answers. */
export function GstLine() {
  if (LEGAL.gstRegistered === null) return <Ph>[GSTIN, or a note that the seller is not registered]</Ph>;
  if (!LEGAL.gstRegistered) return <>Not registered for GST. No GST is charged.</>;
  return <LegalValue value={LEGAL.gstin} label="GSTIN" />;
}

export function SellerDetails() {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[11rem_1fr]">
      <dt className="font-semibold text-cocoa">Trading as</dt>
      <dd>{SITE.name}</dd>
      <dt className="font-semibold text-cocoa">Legal name</dt>
      <dd>
        <LegalValue value={LEGAL.legalName} label="Legal business name" />
        {LEGAL.constitution ? <>, {LEGAL.constitution}</> : null}
      </dd>
      <dt className="font-semibold text-cocoa">Registered address</dt>
      <dd>
        <LegalAddress />
      </dd>
      <dt className="font-semibold text-cocoa">GSTIN</dt>
      <dd>
        <GstLine />
      </dd>
      <dt className="font-semibold text-cocoa">Email</dt>
      <dd>
        <a className="text-cocoa underline" href={`mailto:${SITE.email}`}>
          {SITE.email}
        </a>
      </dd>
      <dt className="font-semibold text-cocoa">Phone</dt>
      <dd>
        <LegalValue value={LEGAL.phone} label="Business phone number" />
      </dd>
      <dt className="font-semibold text-cocoa">Country of origin</dt>
      <dd>India. Every piece is handmade in India.</dd>
    </dl>
  );
}
