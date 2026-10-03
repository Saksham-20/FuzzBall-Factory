/**
 * A guardrail for the product editor, NOT legal clearance. Listings must not name existing characters or brands in the
 * title, tags or description: it invites a takedown and reads as a claim of affiliation (docs/LEGAL_REVIEW.md, IP
 * section). The list holds well-known names; extend it freely. Matching is whole-word and ignores case and accents.
 */
const NAMES = [
  "pokemon", "pikachu", "snorlax", "charizard", "eevee", "squirtle", "bulbasaur", "jigglypuff", "psyduck", "togepi", "mewtwo", "gengar",
  "mario", "luigi", "yoshi", "zelda", "kirby", "sonic",
  "hello kitty", "kuromi", "cinnamoroll", "my melody", "sanrio", "pompompurin", "pusheen", "labubu",
  "mickey", "minnie", "disney", "winnie the pooh", "elsa", "moana",
  "totoro", "ghibli", "doraemon", "naruto", "goku", "luffy", "shin chan", "shinchan", "sailor moon",
  "spongebob", "patrick star", "peppa pig", "bluey", "paw patrol", "minion", "minions", "snoopy", "peanuts", "elmo", "barbie", "lego",
  "harry potter", "hogwarts", "marvel", "spiderman", "spider-man", "batman", "superman", "hulk", "avengers", "star wars", "baby yoda", "grogu",
  "among us", "minecraft", "fortnite", "roblox",
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(${NAMES.map((n) => escape(n).replace(/ /g, "[\\s-]+")).join("|")})(?![\\p{L}\\p{N}])`, "giu");

/** Names from the list that appear in `text` (each once, lower case). */
export function flaggedNames(text: string): string[] {
  const found = new Set<string>();
  for (const m of fold(text).matchAll(PATTERN)) found.add(m[1].replace(/[\s-]+/g, " "));
  return [...found];
}
