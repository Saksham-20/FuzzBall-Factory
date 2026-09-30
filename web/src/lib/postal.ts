/**
 * Postal-code shapes for the countries we ship to most. A wrong code is the commonest reason an international parcel is
 * returned, so the checkout checks the shape before taking payment. Countries not listed here accept any 3 to 12
 * letters, digits, spaces or hyphens (and some have no postal codes at all: the form says to enter 000 then).
 *
 * The same table lives in api/src/shipping/postal.ts (the browser checks first, the API decides). Keep them identical:
 * both test files hold the same cases.
 */
const digits = (n: number) => new RegExp(`^\\d{${n}}$`);

const FORMATS: Record<string, { pattern: RegExp; example: string }> = {
  US: { pattern: /^\d{5}(-\d{4})?$/, example: '94103 or 94103-1234' },
  CA: { pattern: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i, example: 'M5V 3L9' },
  GB: { pattern: /^(GIR ?0AA|[A-PR-UWYZ]([0-9]{1,2}|([A-HK-Y][0-9]([0-9ABEHMNPRV-Y])?)|[0-9][A-HJKPS-UW]) ?[0-9][ABD-HJLNP-UW-Z]{2})$/i, example: 'N10 2LE' },
  IE: { pattern: /^([AC-FHKNPRTV-Y]\d{2}|D6W) ?[0-9AC-FHKNPRTV-Y]{4}$/i, example: 'D02 X285' },
  AU: { pattern: digits(4), example: '2000' },
  NZ: { pattern: digits(4), example: '6011' },
  SG: { pattern: digits(6), example: '238823' },
  MY: { pattern: digits(5), example: '50450' },
  DE: { pattern: digits(5), example: '10115' },
  FR: { pattern: digits(5), example: '75001' },
  IT: { pattern: digits(5), example: '00184' },
  ES: { pattern: digits(5), example: '28013' },
  NL: { pattern: /^\d{4} ?[A-Za-z]{2}$/, example: '1012 AB' },
  NP: { pattern: digits(5), example: '44600' },
  LK: { pattern: digits(5), example: '00100' },
  BD: { pattern: digits(4), example: '1205' },
  SA: { pattern: /^\d{5}(-\d{4})?$/, example: '12271' },
};

const GENERIC = /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/;

/** The error to show for a postal code outside India, or undefined when it looks right. India has its own rule. */
export function postalFieldError(country: string, postalCode: string): string | undefined {
  const code = postalCode.trim();
  const format = FORMATS[country.toUpperCase()];
  if (!code) return 'Enter your postal code.';
  if (format) return format.pattern.test(code) ? undefined : `That doesn't look like a postal code for this country. It looks like ${format.example}.`;
  return GENERIC.test(code) ? undefined : 'Enter your postal code (letters, numbers, spaces or hyphens). If your country has none, enter 000.';
}
