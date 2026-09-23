const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Adds `n` business days (Mon-Sat; Sunday is the maker's day off), counting weekdays in India Standard Time.
 * Mirrors web/src/lib/format.ts `addBusinessDays`, but anchored to IST so the server gives the same answer
 * wherever it runs.
 */
export function addBusinessDays(from: Date, n: number): Date {
  const ist = new Date(from.getTime() + IST_OFFSET_MS);
  let left = n;
  while (left > 0) {
    ist.setUTCDate(ist.getUTCDate() + 1);
    if (ist.getUTCDay() !== 0) left -= 1;
  }
  return new Date(ist.getTime() - IST_OFFSET_MS);
}
