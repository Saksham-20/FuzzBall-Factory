import type { Category, Fulfilment, Product, Swatch } from "@/lib/types";

/*
 * PLACEHOLDER(catalogue): every product below is SAMPLE data, and every photo is an
 * openly licensed stand-in from web/public/samples (see PROVENANCE.md). None of it
 * is the maker's real stock, prices or lead times. Replace via admin / real API.
 */

export const categories: Category[] = [
  { slug: "plushies", name: "Plushies", word: "squishy", blurb: "Amigurumi friends", image: "/samples/bear.jpg" },
  { slug: "bouquets", name: "Bouquets & Flowers", word: "bouquets", blurb: "Flowers that never wilt", image: "/samples/flowers.jpg" },
  { slug: "keychains", name: "Keychains & Charms", word: "charms", blurb: "For bags, keys, zips", image: "/samples/keychain.jpg" },
  { slug: "wearables", name: "Wearables", word: "wearables", blurb: "Hats, tops, bags", image: "/samples/top.jpg" },
  { slug: "hair", name: "Hair Accessories", word: "hair", blurb: "Clips and ties", image: "/samples/hairpins.jpg" },
  { slug: "home", name: "Home & Desk", word: "cozy", blurb: "Coasters, plant pals", image: "/samples/coasters.jpg" },
  { slug: "baby", name: "Baby", word: "tiny", blurb: "Soft, small, safe", image: "/samples/chick.jpg" },
  { slug: "gifting", name: "Gift Sets", word: "gifts", blurb: "Wrapped and ready", image: "/samples/flowers.jpg" },
];

const sw = {
  cream: { name: "Cream", hex: "#f1e4d3" },
  rose: { name: "Dusty rose", hex: "#c98586" },
  cocoa: { name: "Cocoa", hex: "#6b4228" },
  butter: { name: "Butter", hex: "#f4cd52" },
  mint: { name: "Mint", hex: "#a8c9b0" },
  peach: { name: "Peach", hex: "#f0b59a" },
  red: { name: "Cherry", hex: "#c9403f" },
  navy: { name: "Navy", hex: "#2f3f66" },
  black: { name: "Black", hex: "#2a2422" },
  lilac: { name: "Lilac", hex: "#b9a3d3" },
  orange: { name: "Marigold", hex: "#ee9a2a" },
  green: { name: "Sage", hex: "#8fa876" },
} satisfies Record<string, Swatch>;

const care = {
  soft: ["Spot clean with a damp cloth", "Hand wash cold if needed, reshape and dry flat", "Keep away from direct heat"],
  wear: ["Hand wash cold with mild soap", "Do not wring", "Dry flat in shade"],
  charm: ["Wipe with a damp cloth", "Avoid soaking; dry flat", "Keep away from sharp edges"],
};

interface Seed {
  n: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  price: number;
  fulfilment: Fulfilment;
  lead: number;
  fiber: string;
  size: string;
  weight: number;
  care: string[];
  img: string;
  alt: string;
  extra?: { src: string; alt: string }[];
  swatches: Swatch[];
  sizes?: string[];
  stock?: number;
  ooak?: boolean;
  soldOut?: boolean;
  occasions?: string[];
  compareAt?: number;
}

const build = (s: Seed): Product => {
  const sizes = s.sizes ?? [undefined];
  const variants = s.swatches.flatMap((c, ci) =>
    sizes.map((size, si) => ({
      id: `${s.slug}-${ci}${si}`,
      colour: c.name,
      size,
      priceDelta: 0,
      stock: s.soldOut ? 0 : (s.stock ?? (s.fulfilment === "READY" ? 4 : 99)),
    })),
  );
  return {
    id: `p${s.n}`,
    slug: s.slug,
    batch: s.n,
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    category: s.category,
    price: s.price,
    compareAtPrice: s.compareAt,
    fulfilment: s.fulfilment,
    leadTimeDays: s.lead,
    fiber: s.fiber,
    sizeCm: s.size,
    weightG: s.weight,
    care: s.care,
    images: [{ src: s.img, alt: s.alt }, ...(s.extra ?? [])],
    swatches: s.swatches,
    variants,
    isOneOfAKind: !!s.ooak,
    customizable: !s.soldOut,
    giftable: true,
    occasions: s.occasions ?? ["Just because", "Birthday"],
    tags: [],
    status: "PUBLISHED",
    sample: true,
    createdAt: new Date(Date.UTC(2026, 8, 1 + s.n)).toISOString(),
  };
};

const closeUp = { src: "/samples/flower-single.jpg", alt: "Close-up of crochet stitches" };
const yarn = { src: "/samples/yarn-assorted.jpg", alt: "Balls of yarn in assorted colours" };

export const products: Product[] = [
  build({ n: 1, slug: "rosie-bear", name: "Rosie the Bear", tagline: "A cuddly bear in a stripy sweater", description: "A hand-crocheted bear with a tiny flower headband and a stripy sweater. Stuffed firm enough to sit up, soft enough to hug. Made to order in the colours you pick.", category: "plushies", price: 1450, fulfilment: "MADE_TO_ORDER", lead: 7, fiber: "Milk cotton, 4-ply", size: "28 cm tall", weight: 180, care: care.soft, img: "/samples/bear.jpg", alt: "Red crochet bear with a flower headband and striped sweater", extra: [closeUp, yarn], swatches: [sw.red, sw.rose, sw.cream], occasions: ["Birthday", "Anniversary"] }),
  build({ n: 2, slug: "pocket-penguins", name: "Pocket Penguin Keychain", tagline: "Two tiny penguins for your keys", description: "Small, round and slightly smug. Each penguin is crocheted in one piece, with a felt-free embroidered face and a sturdy key ring.", category: "keychains", price: 399, fulfilment: "READY", lead: 2, fiber: "Acrylic, 3-ply", size: "7 cm tall", weight: 22, care: care.charm, img: "/samples/penguin.jpg", alt: "Two black and white crochet penguin keychains held in a hand", extra: [closeUp], swatches: [sw.black, sw.navy] }),
  build({ n: 3, slug: "wildflower-bouquet", name: "Wildflower Forever Bouquet", tagline: "Flowers that never wilt", description: "A mixed bouquet of crochet blooms in violet, white and marigold, wrapped for gifting. Each stem is wired so the flowers keep their pose.", category: "bouquets", price: 1299, fulfilment: "MADE_TO_ORDER", lead: 5, fiber: "Cotton, 3-ply", size: "30 cm tall", weight: 140, care: care.charm, img: "/samples/flowers.jpg", alt: "Bouquet of crochet flowers in violet, white and orange", extra: [closeUp, yarn], swatches: [sw.lilac, sw.orange, sw.cream], occasions: ["Valentine's", "Anniversary", "Birthday"] }),
  build({ n: 4, slug: "blossom-clips", name: "Blossom Hair Clips (set of 3)", tagline: "Tiny blooms for your hair", description: "Three crochet flower snap clips in a mix of colours. Lightweight enough for all day, sturdy enough for a messy bun.", category: "hair", price: 349, fulfilment: "READY", lead: 2, fiber: "Cotton, 3-ply", size: "4 cm each", weight: 18, care: care.charm, img: "/samples/hairpins.jpg", alt: "Crochet flower hair clips on a black background", extra: [closeUp], swatches: [sw.rose, sw.butter, sw.cream] }),
  build({ n: 5, slug: "tiny-cactus", name: "Tiny Cactus Pot", tagline: "A plant you can't overwater", description: "A round little cactus in a crochet pot with a flower on top. Weighted at the base so it stays put on your desk.", category: "home", price: 549, fulfilment: "READY", lead: 2, fiber: "Milk cotton, 4-ply", size: "11 cm tall", weight: 95, care: care.soft, img: "/samples/cactus.jpg", alt: "Crochet cacti in terracotta pots", extra: [closeUp], swatches: [sw.green, sw.mint] }),
  build({ n: 6, slug: "cube-kitties", name: "Cube Kitty", tagline: "Boxy, soft and a little bit judgy", description: "A pocket-sized cat with a square face and a sleepy expression. Pick a colour and it's made just for you.", category: "plushies", price: 699, fulfilment: "MADE_TO_ORDER", lead: 4, fiber: "Milk cotton, 4-ply", size: "10 cm tall", weight: 45, care: care.soft, img: "/samples/kitty.jpg", alt: "Crochet cat figures in pink, mint and peach", extra: [yarn], swatches: [sw.rose, sw.mint, sw.peach] }),
  build({ n: 7, slug: "butter-chick", name: "Butter Chick & Egg", tagline: "A duckling and its striped egg", description: "A soft yellow chick with a tiny tuft on its head, plus a striped egg to keep it company. Baby-safe stitches and no small parts.", category: "baby", price: 649, fulfilment: "MADE_TO_ORDER", lead: 4, fiber: "Milk cotton, 4-ply", size: "9 cm tall", weight: 40, care: care.soft, img: "/samples/chick.jpg", alt: "Yellow crochet chick beside a striped egg", extra: [closeUp], swatches: [sw.butter, sw.cream], occasions: ["Baby shower", "Birthday"] }),
  build({ n: 8, slug: "midnight-beanie", name: "Midnight Stripe Beanie", tagline: "A slouchy beanie with a stripe", description: "A stretchy, warm beanie in a granite-stitch pattern with one contrast stripe. Made to fit, so pick your size.", category: "wearables", price: 1199, fulfilment: "MADE_TO_ORDER", lead: 6, fiber: "Wool blend, worsted", size: "Fits 52–58 cm head", weight: 90, care: care.wear, img: "/samples/hat.jpg", alt: "Person wearing a striped crochet beanie", extra: [closeUp, yarn], swatches: [sw.cocoa, sw.navy, sw.cream], sizes: ["S", "M", "L"] }),
  build({ n: 9, slug: "sunny-halter", name: "Sunny Halter Top", tagline: "A marigold halter for summer", description: "A cotton crochet halter with tie straps and a scalloped hem. Made to your measurements; we'll ask for them after you order.", category: "wearables", price: 1899, fulfilment: "MADE_TO_ORDER", lead: 10, fiber: "Cotton, 4-ply", size: "XS–L, or custom", weight: 120, care: care.wear, img: "/samples/top.jpg", alt: "Orange crochet halter top", extra: [closeUp, yarn], swatches: [sw.orange, sw.cream, sw.rose], sizes: ["XS", "S", "M", "L"] }),
  build({ n: 10, slug: "mandala-charm", name: "Mandala Bag Charm", tagline: "A round flower for your bag strap", description: "A circular mandala motif with a braided loop, ready to clip to a bag, zip or keyring.", category: "keychains", price: 299, fulfilment: "READY", lead: 2, fiber: "Cotton, 3-ply", size: "8 cm across", weight: 12, care: care.charm, img: "/samples/keychain.jpg", alt: "Round crochet mandala charm in green and pink", extra: [closeUp], swatches: [sw.green, sw.rose] }),
  build({ n: 11, slug: "granny-charm", name: "Granny Square Charm", tagline: "The classic, in miniature", description: "A single granny square with a braided loop. The most traditional crochet motif, made small.", category: "keychains", price: 279, fulfilment: "READY", lead: 2, fiber: "Cotton, 3-ply", size: "8 cm across", weight: 12, care: care.charm, img: "/samples/charm.jpg", alt: "Green and cream crochet granny square charm", extra: [closeUp], swatches: [sw.green, sw.cream] }),
  build({ n: 12, slug: "micro-mice", name: "Micro Mice Keychain (pair)", tagline: "Two tiny mice on ball chains", description: "A tiny grey pair with pink ears and a ball chain each. Only one pair exists. Once it's gone, it's gone.", category: "keychains", price: 449, fulfilment: "READY", lead: 2, fiber: "Acrylic, 2-ply", size: "3 cm tall", weight: 8, care: care.charm, img: "/samples/mice.jpg", alt: "Two micro crochet mouse keychains next to a crochet hook", extra: [closeUp], swatches: [sw.cream], stock: 1, ooak: true }),
  build({ n: 13, slug: "coaster-box", name: "Coaster Set in a Box", tagline: "Four coasters in a keepsake box", description: "Four square coasters with a scalloped edge, packed in a small box. Machine-washable cotton.", category: "home", price: 799, fulfilment: "READY", lead: 2, fiber: "Cotton, 4-ply", size: "10 × 10 cm each", weight: 160, care: care.wear, img: "/samples/coasters.jpg", alt: "Navy crochet coasters in a cream box", extra: [closeUp], swatches: [sw.navy, sw.cream, sw.rose] }),
  build({ n: 14, slug: "witchy-kitty", name: "Witchy Kitty", tagline: "A black cat in a witch's hat", description: "A black cat in an orange hat with a ribbon bow. This one found a home already.", category: "plushies", price: 1099, fulfilment: "READY", lead: 2, fiber: "Chenille velvet", size: "22 cm tall", weight: 110, care: care.soft, img: "/samples/cat.jpg", alt: "Black crochet cat wearing an orange witch hat", extra: [closeUp], swatches: [sw.black], stock: 0, ooak: true, soldOut: true }),
  build({ n: 15, slug: "mug-rug", name: "Mug Rug", tagline: "A tiny placemat for your tea", description: "A flat, sturdy rectangle for your mug and a biscuit. Cotton, so it can go in the wash.", category: "home", price: 249, fulfilment: "READY", lead: 2, fiber: "Cotton, 4-ply", size: "15 × 11 cm", weight: 40, care: care.wear, img: "/samples/baby-toy.jpg", alt: "Rectangular tan crochet mug rug with a green edge", extra: [closeUp], swatches: [sw.peach, sw.cream] }),
];

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const productsIn = (category: string) => products.filter((p) => p.category === category);
export const productById = (id: string) => products.find((p) => p.id === id);

export const lowestPrice = (list: Product[]) => Math.min(...list.map((p) => p.price));
