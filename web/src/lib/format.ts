const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatINR = (n: number) => inr.format(n);

/** Zero-padded batch label: 3 → "Batch #003". */
export const batchLabel = (n: number) => `Batch #${String(n).padStart(3, "0")}`;

export const formatDate = (d: Date | string, opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", opts ?? { day: "numeric", month: "short" }).format(
    typeof d === "string" ? new Date(d) : d,
  );

/** Adds n business days (Mon–Sat; Sunday is the maker's day off). */
export function addBusinessDays(from: Date, n: number) {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left -= 1;
  }
  return d;
}

export const dispatchDate = (leadTimeDays: number, from = new Date()) =>
  addBusinessDays(from, leadTimeDays);
