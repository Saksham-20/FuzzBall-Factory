import type { Category, Product, Swatch } from "@/lib/types";

/*
 * PLACEHOLDER(catalogue): the mock catalogue is four whale keychains (the maker's own photos, web/public/maker),
 * so dev and tests have something to render. Their price, stock and lead time are stand-ins, and they carry
 * sample=true. The real catalogue is entered through the admin; nothing else is seeded.
 */

export const categories: Category[] = [
  { slug: "plushies", name: "Plushies", word: "squishy", blurb: "Amigurumi friends", image: "/maker/crew-turtle.jpg" },
  { slug: "bouquets", name: "Bouquets & Flowers", word: "bouquets", blurb: "Flowers that never wilt", image: "/maker/crew-hedgehog.jpg" },
  { slug: "keychains", name: "Keychains & Charms", word: "charms", blurb: "For bags, keys, zips", image: "/maker/whale-pod.jpg" },
  { slug: "wearables", name: "Wearables", word: "wearables", blurb: "Hats, tops, bags", image: "/maker/crew-hedgehog.jpg" },
  { slug: "hair", name: "Hair Accessories", word: "hair", blurb: "Clips and ties", image: "/maker/crew-hedgehog.jpg" },
  { slug: "home", name: "Home & Desk", word: "cozy", blurb: "Coasters, plant pals", image: "/maker/crew-hedgehog.jpg" },
  { slug: "baby", name: "Baby", word: "tiny", blurb: "Soft, small, safe", image: "/maker/crew-hedgehog.jpg" },
  { slug: "gifting", name: "Gift Sets", word: "gifts", blurb: "Wrapped and ready", image: "/maker/crew-hedgehog.jpg" },
];

const whaleSwatch = {
  red: { name: "Red", hex: "#c9403f" },
  yellow: { name: "Yellow", hex: "#f4cd52" },
  blue: { name: "Blue", hex: "#3d6fb0" },
  pink: { name: "Pink", hex: "#e79ab0" },
} satisfies Record<string, Swatch>;

const CARE = ["Wipe with a damp cloth", "Avoid soaking; dry flat", "Keep away from sharp edges"];

const whale = (n: number, key: keyof typeof whaleSwatch, name: string): Product => {
  const swatch = whaleSwatch[key];
  return {
    id: `p${n}`,
    slug: `whale-${key}`,
    batch: n,
    name: `${name} Whale Keychain`,
    tagline: "A pocket-sized whale for your keys",
    description: `A whale crocheted by hand in ${name.toLowerCase()} with a white belly and a gold clasp. Clip it to your keys, a bag or a zip.`,
    category: "keychains",
    price: 399,
    fulfilment: "READY",
    leadTimeDays: 2,
    fiber: "Cotton",
    sizeCm: "8 cm",
    weightG: 25,
    care: CARE,
    images: [{ src: `/maker/clips/whale-${key}.jpg`, alt: `A ${name.toLowerCase()} crochet whale keychain with a white belly and a gold clasp` }],
    swatches: [swatch],
    variants: [{ id: `whale-${key}-0`, colour: swatch.name, priceDelta: 0, stock: 4 }],
    isOneOfAKind: false,
    customizable: true,
    giftable: true,
    occasions: ["Just because", "Birthday"],
    tags: [],
    status: "PUBLISHED",
    sample: true,
    createdAt: new Date(Date.UTC(2026, 9, n)).toISOString(),
  };
};

export const products: Product[] = [whale(1, "red", "Red"), whale(2, "yellow", "Yellow"), whale(3, "blue", "Blue"), whale(4, "pink", "Pink")];

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const productsIn = (category: string) => products.filter((p) => p.category === category);
export const productById = (id: string) => products.find((p) => p.id === id);

export const lowestPrice = (list: Product[]) => Math.min(...list.map((p) => p.price));
