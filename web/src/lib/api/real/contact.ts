import { http } from "@/lib/api/http";

export interface ContactInput {
  name: string;
  email: string;
  message: string;
  /** Honeypot: always empty from a real visitor. */
  website?: string;
}

export const sendContactMessage = (input: ContactInput) => http<void>("/contact", { method: "POST", body: input });
