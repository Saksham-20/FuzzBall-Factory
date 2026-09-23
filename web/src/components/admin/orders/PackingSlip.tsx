"use client";

import { createPortal } from "react-dom";
import { formatDate, formatINR } from "@/lib/format";
import type { Order } from "@/lib/types";
import { countryName } from "./helpers";

/**
 * Print-only packing slip. Rendered into <body> so the print stylesheet (globals.css, "admin print")
 * can hide the whole admin shell and show only this. On screen it is display:none.
 * When `hidePrices` is set (gift orders) no amount appears anywhere on it.
 */
export function PackingSlip({ order: o, hidePrices }: { order: Order; hidePrices: boolean }) {
  if (typeof document === "undefined") return null;
  const a = o.address;
  return createPortal(
    <div className="print-slip" aria-hidden>
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div>
          <p className="font-display text-[28pt] leading-none">FuzzBall Factory</p>
          <p className="mt-1 text-[10pt]">Handmade with love</p>
        </div>
        <div className="text-right">
          <p className="font-stencil text-[11pt]">Packing slip</p>
          <p className="font-stencil text-[20pt] leading-tight">{o.number}</p>
          <p className="text-[10pt]">{formatDate(o.createdAt, { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="font-stencil text-[9pt]">Ship to</p>
          <p className="mt-1 text-[12pt] leading-snug">
            <strong>{a.name}</strong>
            <br />
            {a.line1}
            {a.line2 ? <><br />{a.line2}</> : null}
            <br />
            {a.city}, {a.state} {a.postalCode}
            <br />
            {countryName(a.country)}
            <br />
            {a.phone}
          </p>
        </div>
        <div>
          <p className="font-stencil text-[9pt]">Courier</p>
          <p className="mt-1 text-[12pt]">{o.courier ? `${o.courier}${o.awb ? `, AWB ${o.awb}` : ""}` : "To be added"}</p>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-[11pt]">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="w-10 py-1.5 font-stencil text-[9pt]">Packed</th>
            <th className="w-12 py-1.5 font-stencil text-[9pt]">Qty</th>
            <th className="py-1.5 font-stencil text-[9pt]">Item</th>
            {hidePrices ? null : <th className="py-1.5 text-right font-stencil text-[9pt]">Amount</th>}
          </tr>
        </thead>
        <tbody>
          {o.items.map((i, idx) => (
            <tr key={idx} className="border-b border-black/30 align-top">
              <td className="py-2"><span className="inline-block size-4 border-[1.5px] border-black" /></td>
              <td className="py-2 tabular">{i.qty}</td>
              <td className="py-2">
                <strong>{i.name}</strong>
                <br />
                {i.colour}{i.size ? `, ${i.size}` : ""}
                {i.personalization ? <><br />Personalization: “{i.personalization}”</> : null}
              </td>
              {hidePrices ? null : <td className="py-2 text-right tabular">{formatINR(i.unitPrice * i.qty)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {hidePrices ? null : (
        <dl className="mt-3 ml-auto w-64 text-[11pt]">
          <Row k="Subtotal" v={formatINR(o.subtotal)} />
          <Row k="Shipping" v={formatINR(o.shipping)} />
          {o.codFee ? <Row k="COD fee" v={formatINR(o.codFee)} /> : null}
          {o.giftWrap ? <Row k="Gift wrap" v={formatINR(o.giftWrap)} /> : null}
          {o.discount ? <Row k="Discount" v={`-${formatINR(o.discount)}`} /> : null}
          <div className="mt-1 flex justify-between border-t border-black pt-1 font-bold">
            <dt>Total</dt>
            <dd className="tabular">{formatINR(o.total)}</dd>
          </div>
        </dl>
      )}

      {o.giftNote ? (
        <div className="mt-8 border-2 border-dashed border-black p-4">
          <p className="font-stencil text-[9pt]">A note for you</p>
          <p className="mt-1 text-[13pt] leading-snug whitespace-pre-line">{o.giftNote}</p>
        </div>
      ) : null}

      <p className="mt-10 text-center text-[10pt]">Thank you for choosing something handmade.</p>
    </div>,
    document.body,
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt>
      <dd className="tabular">{v}</dd>
    </div>
  );
}
