/*
 * The shop's shelves. Products are NOT seeded: the maker lists real ones through the admin.
 * PLACEHOLDER(category-images): the photos below are the maker's own, reused as shelf covers until a shelf has a
 * product of its own. A shelf with no published product is hidden from the storefront, so these only show once
 * there is something on the shelf. Replace each in /admin/categories.
 */
export interface Category { slug: string; name: string; word: string; blurb: string; image: string }

export const categories: Category[] = [
  { slug: 'plushies', name: 'Plushies', word: 'squishy', blurb: 'Amigurumi friends', image: '/maker/crew-turtle.jpg' },
  { slug: 'bouquets', name: 'Bouquets & Flowers', word: 'bouquets', blurb: 'Flowers that never wilt', image: '/maker/crew-hedgehog.jpg' },
  { slug: 'keychains', name: 'Keychains & Charms', word: 'charms', blurb: 'For bags, keys, zips', image: '/maker/whale-pod.jpg' },
  { slug: 'wearables', name: 'Wearables', word: 'wearables', blurb: 'Hats, tops, bags', image: '/maker/crew-hedgehog.jpg' },
  { slug: 'hair', name: 'Hair Accessories', word: 'hair', blurb: 'Clips and ties', image: '/maker/crew-hedgehog.jpg' },
  { slug: 'home', name: 'Home & Desk', word: 'cozy', blurb: 'Coasters, plant pals', image: '/maker/crew-hedgehog.jpg' },
  { slug: 'baby', name: 'Baby', word: 'tiny', blurb: 'Soft, small, safe', image: '/maker/crew-hedgehog.jpg' },
  { slug: 'gifting', name: 'Gift Sets', word: 'gifts', blurb: 'Wrapped and ready', image: '/maker/crew-hedgehog.jpg' },
];
