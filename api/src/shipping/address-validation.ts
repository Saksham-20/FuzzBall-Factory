import type { FieldErrors } from '../common/errors.js';
import { postalFieldError } from './postal.js';
import { INDIAN_STATES, INDIA_PINCODE, SHIPPING_BLOCKED_COUNTRIES } from './shipping.constants.js';

/**
 * Same rules as the web checkout schema: Indian addresses need a valid pincode and state; elsewhere the postal code
 * must have the right shape for its country (see postal.ts), and a few countries are refused outright.
 */
export function addressFieldErrors(a: { country: string; postalCode: string; state: string }, prefix = ''): FieldErrors {
  const fields: FieldErrors = {};
  if (a.country === 'IN') {
    if (!INDIA_PINCODE.test(a.postalCode)) fields[`${prefix}postalCode`] = 'Enter a valid 6-digit pincode.';
    if (!(INDIAN_STATES as readonly string[]).includes(a.state)) fields[`${prefix}state`] = 'Pick your state.';
  } else {
    if (SHIPPING_BLOCKED_COUNTRIES.includes(a.country)) fields[`${prefix}country`] = "We can't ship to that country.";
    const postal = postalFieldError(a.country, a.postalCode);
    if (postal) fields[`${prefix}postalCode`] = postal;
  }
  return fields;
}
