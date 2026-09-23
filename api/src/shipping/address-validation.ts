import type { FieldErrors } from '../common/errors.js';
import { INDIAN_STATES, INDIA_PINCODE } from './shipping.constants.js';

/** Same rules as the web checkout schema: Indian addresses need a valid pincode and state; others just a postal code. */
export function addressFieldErrors(a: { country: string; postalCode: string; state: string }, prefix = ''): FieldErrors {
  const fields: FieldErrors = {};
  if (a.country === 'IN') {
    if (!INDIA_PINCODE.test(a.postalCode)) fields[`${prefix}postalCode`] = 'Enter a valid 6-digit pincode.';
    if (!(INDIAN_STATES as readonly string[]).includes(a.state)) fields[`${prefix}state`] = 'Pick your state.';
  } else if (a.postalCode.length < 3) {
    fields[`${prefix}postalCode`] = 'Enter your postal code.';
  }
  return fields;
}
