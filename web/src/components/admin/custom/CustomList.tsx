"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { CustomStamp } from "@/components/ui/StatusStamp";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CustomRequest } from "@/lib/types";
import { rowStampClass } from "../orders/helpers";
import { workOrderHref } from "./CustomBoard";
import { Due } from "./Due";
import { ageLabel, budgetLabel, quotePrice } from "./workflow";


/** Table on tablet and up, stacked rows on phones. */
export function CustomList({ rows }: { rows: CustomRequest[] }) {
  const router = useRouter();
  return (
    <>
      <Panel flush className="hidden overflow-hidden md:block">
        <TableWrap>
          <caption className="sr-only">Work orders, newest first</caption>
          <thead>
            <tr>
              <Th>Work order</Th>
              <Th>Request</Th>
              <Th>Budget and quote</Th>
              <Th>Needed by</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const price = quotePrice(r);
              return (
                <tr
                  key={r.number}
                  onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) router.push(workOrderHref(r)); }}
                  className={cn("cursor-pointer transition-colors duration-150", "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/5")}
                >
                  <Td className="whitespace-nowrap">
                    <Link href={workOrderHref(r)} className="font-stencil rounded-sm text-[15px] underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">{r.number}</Link>
                    <span className="block text-sm text-brown-soft">{ageLabel(r.createdAt)}</span>
                  </Td>
                  <Td>
                    <span className="line-clamp-1 block font-semibold">{r.title}</span>
                    <span className="block text-sm text-brown">{r.customerName}</span>
                  </Td>
                  <Td className="tabular whitespace-nowrap">
                    <span className="block">{budgetLabel(r)}</span>
                    {price ? <span className="block text-sm font-semibold">Quote {formatINR(price)}</span> : null}
                  </Td>
                  <Td className="text-[15px]"><Due r={r} className="block" /></Td>
                  <Td><CustomStamp status={r.status} className={rowStampClass(r.status)} /></Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </Panel>

      <ul className="space-y-3 md:hidden" aria-label="Work orders, newest first">
        {rows.map((r) => {
          const price = quotePrice(r);
          return (
            <li key={r.number}>
              <Link href={workOrderHref(r)} className={cn("press block rounded-ticket bg-paper p-4 shadow-ticket transition-shadow duration-150", "[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lift")}>
                <span className="flex items-start justify-between gap-3">
                  <span className="font-stencil text-base">{r.number}</span>
                  <CustomStamp status={r.status} className={rowStampClass(r.status)} />
                </span>
                <span className="mt-1 block font-semibold leading-snug">{r.title}</span>
                <span className="block text-sm text-brown">{r.customerName} · {formatDate(r.createdAt)}</span>
                <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="tabular"><span className="text-brown-soft">Budget </span><span className="font-semibold">{budgetLabel(r)}</span>{price ? <span className="font-semibold"> · Quote {formatINR(price)}</span> : null}</span>
                  {r.neededBy ? <span><span className="text-brown-soft">Needed by </span><Due r={r} /></span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
