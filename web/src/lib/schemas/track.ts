import { z } from "zod";

export const trackSchema = z.object({
  number: z.string().trim().min(1, "Enter the order number from your confirmation, like FB-1023."),
  contact: z.string().trim().min(1, "Enter the phone number or email you used at checkout."),
});

export type TrackValues = z.infer<typeof trackSchema>;
