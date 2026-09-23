import { http } from "@/lib/api/http";
import type { StoreSettings } from "@/lib/types";

export const getSettings = () => http<StoreSettings>("/settings");
