import { CUSTOM_DEFAULTS, type CustomFormValues } from "@/lib/schemas/custom";

const KEY = "fbf-custom-draft-v1";

export interface CustomDraft {
  values: Partial<CustomFormValues>;
  /** 0-based step the shopper was on. */
  step: number;
  /** Slug of the product being customized, if any. */
  from?: string;
  /** True once the base product's category and colours have been filled in. */
  prefilled?: boolean;
}

export function loadDraft(): CustomDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as CustomDraft;
    if (!d || typeof d !== "object" || !d.values) return null;
    // JSON turns NaN (an empty number field) into null
    const v = d.values;
    if (v.budgetMin == null) v.budgetMin = CUSTOM_DEFAULTS.budgetMin;
    if (v.budgetMax == null) v.budgetMax = CUSTOM_DEFAULTS.budgetMax;
    if (v.quantity == null) v.quantity = CUSTOM_DEFAULTS.quantity;
    return { ...d, step: Math.min(3, Math.max(0, Number(d.step) || 0)) };
  } catch {
    return null;
  }
}

export function saveDraft(d: CustomDraft) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage full or blocked: the form still works, it just won't survive a refresh */
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
