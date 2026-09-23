"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api/errors";
import { uploadImage } from "@/lib/api/uploads";

const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label: string;
  hint?: string;
  className?: string;
}

export function ImageUploader({ value, onChange, max = 5, label, hint, className }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string>();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | File[]) {
    setErr(undefined);
    const list = Array.from(files);
    const room = max - value.length;
    if (list.length > room) setErr(`You can add up to ${max} images.`);
    const out: string[] = [];
    setBusy(true);
    for (const f of list.slice(0, Math.max(0, room))) {
      if (!OK_TYPES.includes(f.type)) { setErr("Use JPG, PNG, WebP or HEIC images."); continue; }
      if (f.size > MAX_BYTES) { setErr("Each image must be under 8 MB."); continue; }
      try {
        // Mock: a small data URL. Real API: POST /uploads, which returns the stored image URL.
        out.push(await uploadImage(f));
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "We couldn't upload that photo. Please try again.");
      }
    }
    setBusy(false);
    if (out.length) onChange([...value, ...out]);
  }

  return (
    <div className={className}>
      <p id={`${id}-l`} className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-3">
        {value.map((src, i) => (
          <div key={i} className="relative size-24 overflow-hidden rounded-[12px] bg-kraft-light">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Upload ${i + 1}`} className="size-full object-cover" />
            <button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="press absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-cocoa/85 text-cream">
              <X className="size-4" />
            </button>
          </div>
        ))}
        {value.length < max ? (
          <button
            type="button"
            aria-labelledby={`${id}-l`}
            disabled={busy}
            aria-busy={busy}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void add(e.dataTransfer.files); }}
            className={cn("press grid size-24 place-items-center rounded-[12px] border-2 border-dashed text-brown transition-colors duration-150", drag ? "border-rose-deep bg-rose-wash" : "border-line-strong bg-paper")}
          >
            <span className="flex flex-col items-center gap-1 text-xs font-semibold">
              <ImagePlus className="size-5" />
              {busy ? "Uploading" : "Add photo"}
            </span>
          </button>
        ) : null}
      </div>
      <input ref={input} type="file" accept={OK_TYPES.join(",")} multiple className="sr-only" tabIndex={-1} onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = ""; }} />
      {hint && !err ? <p className="mt-1.5 text-sm text-brown">{hint}</p> : null}
      {err ? <p role="alert" className="mt-1.5 text-sm font-medium text-err">{err}</p> : null}
    </div>
  );
}
