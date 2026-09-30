import { SITE } from "@/lib/site";

/** Absolute URL on this site. */
export const absoluteUrl = (path: string) => new URL(path, SITE.url).toString();

/** The brand as a structured-data entity. Only facts that are already public on the site: no contact details. */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SITE.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/logo-mark-circle.png"),
    slogan: SITE.tagline,
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SITE.name,
    url: absoluteUrl("/"),
    publisher: { "@id": absoluteUrl("/#organization") },
    inLanguage: "en-IN",
  };
}

/** `items` run from the home page down to the current page; the last one needs no link target but gets one. */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Renders one JSON-LD block. "<" is escaped so catalogue copy can never close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
