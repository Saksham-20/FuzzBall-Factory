import { z } from "zod";
import { INDIAN_STATES } from "@/lib/status";
import { phoneField } from "@/lib/schemas/custom";

export const GIFT_NOTE_MAX = 200;

export const checkoutSchema = z
  .object({
    // Contact
    name: z.string().trim().min(2, "Add your full name."),
    email: z.string().trim().min(1, "Add your email so we can send your receipt.").email("That email doesn't look right. Check for typos."),
    phone: phoneField,
    // Address
    recipient: z.string().trim().min(2, "Who is this going to? Add a name for the parcel."),
    country: z.string().min(1, "Pick a country."),
    line1: z.string().trim().min(3, "Add the house number and street."),
    line2: z.string().trim(),
    city: z.string().trim().min(2, "Add your city or town."),
    state: z.string().trim(),
    postalCode: z.string().trim().min(1, "Add your pincode or postal code."),
    saveAddress: z.boolean(),
    // Gift
    giftWrap: z.boolean(),
    giftNote: z.string().max(GIFT_NOTE_MAX, `Keep the note under ${GIFT_NOTE_MAX} characters.`),
    hidePrices: z.boolean(),
    // Payment + review
    paymentMethod: z.enum(["RAZORPAY", "COD"]),
    policy: z.boolean().refine((v) => v, "Tick this box to confirm you've read the policies."),
  })
  .superRefine((v, ctx) => {
    if (v.country === "IN") {
      if (!/^[1-9][0-9]{5}$/.test(v.postalCode)) ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Enter a valid 6-digit pincode." });
      if (!INDIAN_STATES.includes(v.state)) ctx.addIssue({ code: "custom", path: ["state"], message: "Pick your state." });
    } else if (v.postalCode.length < 3) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Enter your postal code." });
    }
  });

export type CheckoutValues = z.infer<typeof checkoutSchema>;

export const CHECKOUT_DEFAULTS: CheckoutValues = {
  name: "",
  email: "",
  phone: "",
  recipient: "",
  country: "IN",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  saveAddress: false,
  giftWrap: false,
  giftNote: "",
  hidePrices: false,
  paymentMethod: "RAZORPAY",
  policy: false,
};
