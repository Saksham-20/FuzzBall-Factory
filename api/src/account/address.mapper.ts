import type { Address } from '../generated/prisma/client.js';

/** Wire shape: web `Address`. */
export interface AddressDto {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export const toAddressDto = (a: Address): AddressDto => ({
  id: a.id,
  label: a.label,
  name: a.name,
  phone: a.phone,
  line1: a.line1,
  ...(a.line2 ? { line2: a.line2 } : {}),
  city: a.city,
  state: a.state,
  postalCode: a.postalCode,
  country: a.country,
  isDefault: a.isDefault,
});
