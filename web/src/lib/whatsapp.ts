import { SITE } from "@/lib/site";
import { formatINR } from "@/lib/format";

/** wa.me click-to-chat link. Number is digits only; text is URL-encoded. */
export const waLink = (text: string) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;

export const waGeneral = () =>
  waLink("Hi FuzzBall Factory! I have a question about your crochet pieces.");

export const waProduct = (name: string, price: number, url: string) =>
  waLink(`Hi! I'm interested in *${name}* (${formatINR(price)}) ${url} — is it available?`);

export const waRealLight = (name?: string) =>
  waLink(
    name
      ? `Hi! Could I see *${name}* in natural light before I order?`
      : "Hi! Could I see one of your pieces in natural light before I order?",
  );

export const waCustom = (wo: string) => waLink(`Hi! I have a question about my work order ${wo}.`);

export const waOrder = (orderNo: string) => waLink(`Hi! I have a question about my order ${orderNo}.`);

/** wa.me with no fixed number: opens the sender's own contact picker. For sharing content to a friend, not for contacting the store. */
export const waShareLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
