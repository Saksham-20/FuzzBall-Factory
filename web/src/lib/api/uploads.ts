import { SITE } from "@/lib/site";
import { http } from "@/lib/api/http";

/** Mock only: downscales to ≤1000px JPEG so the data URL survives localStorage. */
async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

/**
 * Turns a picked image into a URL the rest of the API can store (product photos, work-order references,
 * message attachments, progress photos). Mock: a data URL. Real: POST /uploads (multipart, field `file`, login required).
 */
export async function uploadImage(file: File): Promise<string> {
  if (SITE.useMock) return toDataUrl(file);
  const form = new FormData();
  form.append("file", file);
  return (await http<{ url: string }>("/uploads", { method: "POST", form })).url;
}
