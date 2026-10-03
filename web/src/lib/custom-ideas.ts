/**
 * Pieces the storefront can start a work order from, as /custom?idea=turtle: the form opens with the title (and the
 * shelf, when the shop has it) filled in. A fixed list, so a link can't write whatever it likes into the form.
 */
export const IDEAS = {
  whale: { title: "Whale keychain", category: "keychains" },
  turtle: { title: "Crochet turtle", category: "plushies" },
  octopus: { title: "Octopus and mushroom", category: "plushies" },
  hedgehog: { title: "Crochet hedgehog", category: "plushies" },
  mushroom: { title: "Brown mushroom", category: "plushies" },
} as const;

export type IdeaKey = keyof typeof IDEAS;

export const ideaKey = (v: string | undefined): IdeaKey | undefined => (v && Object.prototype.hasOwnProperty.call(IDEAS, v) ? (v as IdeaKey) : undefined);
