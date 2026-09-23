"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Camera, Link as LinkIcon, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { waShareLink } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";

export type ShareContent = {
  /** Absolute URL to share. */
  url: string;
  /** Message body used for WhatsApp and, unless `instagramText` is set, the Instagram caption. */
  text: string;
  /** Caption to copy for Instagram, if it should differ from `text`. */
  instagramText?: string;
};

/** Writes to the clipboard, with a fallback for the non-HTTPS test deploy (no Clipboard API off a secure origin). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const row =
  "flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[15px] font-semibold outline-none transition-colors duration-150 data-[highlighted]:bg-kraft-light";

const defaultTriggerClass = cn(
  "press grid size-11 shrink-0 place-items-center rounded-full bg-paper shadow-ticket transition-shadow duration-150",
  "hf:hover:shadow-lift",
);

/**
 * A "Share" trigger that opens WhatsApp, Facebook and Instagram (Facebook has no reliable
 * web share intent, so it's a copy-and-paste flow), plus a plain copy-link fallback.
 * The trigger itself is a real `<button>` rendered by Radix (not `asChild`), so `className`
 * and `children` style it directly rather than wrapping another component.
 */
export function ShareMenu({
  content,
  className,
  children,
  label = "Share",
  align = "end",
}: {
  content: ShareContent;
  className?: string;
  children?: React.ReactNode;
  label?: string;
  align?: "start" | "end";
}) {
  const { url, text, instagramText } = content;

  const onInstagram = async () => {
    const ok = await copyText(`${instagramText ?? text} ${url}`);
    toast[ok ? "success" : "error"](
      ok ? "Caption copied. Instagram doesn't take a direct link, so paste it into a story, bio link or DM." : "Couldn't copy. Try again, or copy the link yourself.",
    );
  };
  const onCopy = async () => {
    const ok = await copyText(url);
    toast[ok ? "success" : "error"](ok ? "Link copied." : "Couldn't copy. Try again, or copy it from the address bar.");
  };

  return (
    <Menu.Root>
      <Menu.Trigger type="button" aria-label={label} className={className ?? defaultTriggerClass}>
        {children ?? <Share2 className="size-[19px]" strokeWidth={1.8} />}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align={align}
          sideOffset={8}
          className="z-50 w-[248px] rounded-ticket bg-paper p-1.5 shadow-lift origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-[pop-in_180ms_var(--ease-out)]"
        >
          <Menu.Item asChild>
            <a href={waShareLink(`${text} ${url}`)} target="_blank" rel="noopener noreferrer" className={row}>
              <MessageCircle aria-hidden className="size-[18px] shrink-0" strokeWidth={1.8} />
              Share on WhatsApp
            </a>
          </Menu.Item>
          <Menu.Item asChild>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={row}
            >
              <Share2 aria-hidden className="size-[18px] shrink-0" strokeWidth={1.8} />
              Share on Facebook
            </a>
          </Menu.Item>
          <Menu.Item onSelect={(e) => { e.preventDefault(); void onInstagram(); }} className={cn(row, "w-full cursor-pointer")}>
            <Camera aria-hidden className="size-[18px] shrink-0" strokeWidth={1.8} />
            Copy caption for Instagram
          </Menu.Item>
          <Menu.Item onSelect={(e) => { e.preventDefault(); void onCopy(); }} className={cn(row, "w-full cursor-pointer")}>
            <LinkIcon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.8} />
            Copy link
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
