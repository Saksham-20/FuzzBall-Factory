import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";
import { PlaceholderToggle } from "@/components/store/PlaceholderToggle";
import { SITE } from "@/lib/site";
import { waGeneral } from "@/lib/whatsapp";
import { categories } from "@/lib/mock/catalog";

const col = "space-y-2.5 text-[15px] [&_a]:text-kraft-light [&_a]:underline-offset-4 [&_a:hover]:text-cream [&_a:hover]:underline";
const head = "font-stencil mb-4 text-[12px] text-kraft";

export function Footer() {
  return (
    <footer className="bg-cocoa text-cream">
      <div className="shell pt-20 pb-10">
        <p className="font-display text-[clamp(2.5rem,7.2vw,6.5rem)] text-cream">Handmade with love</p>

        <div className="mt-14 grid gap-12 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div className="space-y-5">
            <LogoMark invert />
            <p className="max-w-[34ch] text-kraft-light">
              Crocheted by one pair of hands. Ready to ship, or made to order just for you.
            </p>
            <a
              href={waGeneral()}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex h-11 items-center rounded-full bg-butter px-6 font-semibold text-cocoa"
            >
              Chat on WhatsApp
            </a>
          </div>

          <nav aria-label="Shop">
            <h2 className={head}>Shop</h2>
            <ul className={col}>
              {categories.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/shop/${c.slug}`}>{c.name}</Link>
                </li>
              ))}
              <li>
                <Link href="/shop">Everything</Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Help">
            <h2 className={head}>Help</h2>
            <ul className={col}>
              <li><Link href="/custom">Start a work order</Link></li>
              <li><Link href="/track">Track your order</Link></li>
              <li><Link href="/policies/shipping">Shipping</Link></li>
              <li><Link href="/policies/refund">Returns &amp; refunds</Link></li>
              <li><Link href="/care-guide">Care guide</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
            </ul>
          </nav>

          <nav aria-label="Company">
            <h2 className={head}>Company</h2>
            <ul className={col}>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/policies/terms">Terms</Link></li>
              <li><Link href="/policies/privacy">Privacy</Link></li>
              <li><Link href="/policies/grievance">Grievance officer</Link></li>
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-cream/15 pt-6 text-sm text-kraft-light md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}. Made in India.
          </p>
          <p className="font-stencil text-[12px]">UPI · Cards · Netbanking · COD on ready-to-ship</p>
          <PlaceholderToggle />
        </div>
      </div>
    </footer>
  );
}
