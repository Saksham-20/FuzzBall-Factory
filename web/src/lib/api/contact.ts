import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/contact";
import { wait } from "@/lib/mock/db";
import type { ContactInput } from "@/lib/api/real/contact";

/** Real mode POSTs to the API. Mock mode sends nothing (the form says so). */
export async function sendContactMessage(input: ContactInput): Promise<void> {
  if (!SITE.useMock) return real.sendContactMessage(input);
  await wait(700);
}
