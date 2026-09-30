import { notFound } from "next/navigation";

/** Decodes a dynamic route segment, or null when it is not valid percent-encoding (`/order/%E0%A4%A`). */
export function decodeParam(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Like `decodeParam`, but a malformed segment is a real 404 instead of a crash. */
export function routeParam(value: string): string {
  const decoded = decodeParam(value);
  if (decoded === null) notFound();
  return decoded;
}
