import { z } from "zod";

/** Earliest "needed by" date, in days from today. */
export const MIN_NEEDED_BY_DAYS = 7;
export const MAX_REFERENCES = 5;

export const BUDGET_PRESETS = [
  { label: "Under ₹1,000", min: 300, max: 1000 },
  { label: "₹1,000 to ₹2,500", min: 1000, max: 2500 },
  { label: "₹2,500 to ₹5,000", min: 2500, max: 5000 },
  { label: "₹5,000 and up", min: 5000, max: 10000 },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local `yyyy-mm-dd` for today + `days`. */
export function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const digits = (s: string) => s.replace(/\D/g, "");

export const phoneField = z
  .string()
  .trim()
  .min(1, "Add a phone or WhatsApp number so we can reach you.")
  .refine((v) => /^\+?[0-9\s-]+$/.test(v) && digits(v).length >= 8 && digits(v).length <= 15, "Use digits with your country code, like +91 98765 43210.");

export const customSchema = z
  .object({
    // Step 1: the idea
    category: z.string().min(1, "Pick the closest category."),
    title: z.string().trim().min(3, "Give it a short name, at least 3 characters.").max(60, "Keep the name under 60 characters."),
    description: z
      .string()
      .trim()
      .min(30, "Tell us a bit more, at least 30 characters: size, colours, who it's for.")
      .max(2000, "Keep the description under 2,000 characters."),
    references: z.array(z.string()).max(MAX_REFERENCES, `Add up to ${MAX_REFERENCES} photos.`),

    // Step 2: the details
    colours: z.array(z.string()),
    colourNotes: z.string().trim().max(200, "Keep colour notes under 200 characters."),
    size: z.string().trim().max(80, "Keep the size under 80 characters."),
    quantity: z
      .number({ error: "Enter how many you need, from 1 to 50." })
      .int("Use a whole number.")
      .min(1, "Enter how many you need, from 1 to 50.")
      .max(50, "For more than 50, message us on WhatsApp."),
    personalization: z.string().trim().max(60, "Keep personalization under 60 characters."),
    occasion: z.string(),
    neededBy: z.string().refine((v) => v === "" || v >= dateInDays(MIN_NEEDED_BY_DAYS), `Pick a date at least ${MIN_NEEDED_BY_DAYS} days from today.`),

    // Step 3: budget and delivery
    budgetMin: z.number({ error: "Add the least you'd like to spend." }).min(0, "Budget can't be negative."),
    budgetMax: z.number({ error: "Add the most you'd like to spend." }).min(0, "Budget can't be negative."),
    country: z.string().min(1, "Pick a country."),
    postalCode: z.string().trim().min(1, "Add your pincode or postal code."),
    giftWrap: z.boolean(),

    // Step 4: review and send
    phone: phoneField,
    terms: z.boolean().refine((v) => v, "Tick this box to confirm you've read the terms."),
  })
  .superRefine((v, ctx) => {
    if (Number.isFinite(v.budgetMin) && Number.isFinite(v.budgetMax) && v.budgetMax < v.budgetMin) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "The most has to be at least the least." });
    }
    if (v.country === "IN" && v.postalCode && !/^[1-9][0-9]{5}$/.test(v.postalCode)) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Enter a valid 6-digit pincode." });
    }
    if (v.country !== "IN" && v.postalCode && v.postalCode.length < 3) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Enter your postal code." });
    }
  });

export type CustomFormValues = z.infer<typeof customSchema>;

/** Fields to validate before moving on from each step (0-based). */
export const CUSTOM_STEP_FIELDS: (keyof CustomFormValues)[][] = [
  ["category", "title", "description", "references"],
  ["colours", "colourNotes", "size", "quantity", "personalization", "occasion", "neededBy"],
  ["budgetMin", "budgetMax", "country", "postalCode", "giftWrap"],
  ["phone", "terms"],
];

export const CUSTOM_DEFAULTS: CustomFormValues = {
  category: "",
  title: "",
  description: "",
  references: [],
  colours: [],
  colourNotes: "",
  size: "",
  quantity: 1,
  personalization: "",
  occasion: "",
  neededBy: "",
  budgetMin: NaN,
  budgetMax: NaN,
  country: "IN",
  postalCode: "",
  giftWrap: false,
  phone: "",
  terms: false,
};
