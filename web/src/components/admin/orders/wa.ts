/** wa.me link to a specific customer (not the store's own number), digits only. Bare 10-digit numbers are assumed to be Indian. */
export function waToCustomer(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
