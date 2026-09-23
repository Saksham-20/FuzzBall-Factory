import { Ph } from "@/components/content/Placeholder";
import { SITE } from "@/lib/site";

/**
 * PLACEHOLDER(legal-details): seller identity required by the Consumer Protection
 * (E-Commerce) Rules, 2020: legal name, registered address, GSTIN, contact.
 */
export function LegalAddress({ className }: { className?: string }) {
  return (
    <address className={className ?? "not-italic leading-relaxed"}>
      <Ph>[Legal business name]</Ph>
      <br />
      <Ph>[Registered address, line 1]</Ph>
      <br />
      <Ph>[City, State, PIN code]</Ph>
      <br />
      India
    </address>
  );
}

export function SellerDetails() {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[11rem_1fr]">
      <dt className="font-semibold text-cocoa">Trading as</dt>
      <dd>{SITE.name}</dd>
      <dt className="font-semibold text-cocoa">Legal name</dt>
      <dd>
        <Ph>[Legal business name]</Ph>
      </dd>
      <dt className="font-semibold text-cocoa">Registered address</dt>
      <dd>
        <LegalAddress />
      </dd>
      <dt className="font-semibold text-cocoa">GSTIN</dt>
      <dd>
        <Ph>[GSTIN, or a note that the seller is not registered]</Ph>
      </dd>
      <dt className="font-semibold text-cocoa">Email</dt>
      <dd>
        <a className="text-cocoa underline" href={`mailto:${SITE.email}`}>
          {SITE.email}
        </a>
      </dd>
      <dt className="font-semibold text-cocoa">Phone</dt>
      <dd>
        <Ph>[Business phone number]</Ph>
      </dd>
      <dt className="font-semibold text-cocoa">Country of origin</dt>
      <dd>India. Every piece is handmade in India.</dd>
    </dl>
  );
}
