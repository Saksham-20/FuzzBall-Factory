import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/settings";
import { db, wait } from "@/lib/mock/db";
import type { StoreSettings } from "@/lib/types";

export async function getSettings(): Promise<StoreSettings> {
  if (!SITE.useMock) return real.getSettings();
  await wait(80);
  return db.get().settings;
}
