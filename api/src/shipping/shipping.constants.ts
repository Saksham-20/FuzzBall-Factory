/** Same list as web/src/lib/status.ts `INDIAN_STATES`. */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Chandigarh', 'Puducherry', 'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep',
] as const;

/** 6 digits, first digit 1-9 (India Post PIN format). */
export const INDIA_PINCODE = /^[1-9][0-9]{5}$/;

/**
 * Countries we do not ship to or take payment from (sanctions and payment-provider rules): North Korea, Iran, Syria,
 * Cuba. Same list as web/src/lib/countries.ts `BLOCKED_COUNTRIES`.
 */
export const SHIPPING_BLOCKED_COUNTRIES: readonly string[] = ['CU', 'IR', 'KP', 'SY'];
