"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate, formatINR } from "@/lib/format";

interface Day {
  date: string;
  amount: number;
}

const H = 190;
const TOP = 30;
const BOTTOM = 26;

/**
 * Plain 30-day bar chart in inline SVG. One series, one ink colour, direct labels on the best day,
 * no gridlines or legend. The figures are also available as a table for screen readers and anyone who wants exact numbers.
 */
export function RevenueChart({ days }: { days: Day[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = days.reduce((s, d) => s + d.amount, 0);
  const peakIdx = days.reduce((best, d, i) => (d.amount > days[best].amount ? i : best), 0);
  const peak = days[peakIdx];
  const max = Math.max(1, peak?.amount ?? 0);
  const slot = w / days.length;
  const gap = w < 480 ? 1.5 : 3;
  const barW = Math.max(2, slot - gap);
  const base = H - BOTTOM;
  const plotH = base - TOP;

  const summary =
    total === 0
      ? "No paid orders in the last 30 days."
      : `${formatINR(total)} from paid orders over the last 30 days. Best day ${formatDate(peak.date)} with ${formatINR(peak.amount)}.`;

  const peakX = peakIdx * slot + slot / 2;
  const peakAnchor = peakX < 90 ? "start" : peakX > w - 90 ? "end" : "middle";
  const peakLabelX = peakAnchor === "start" ? Math.max(0, peakX - barW / 2) : peakAnchor === "end" ? Math.min(w, peakX + barW / 2) : peakX;
  const labelAt = (i: number) => days[i] && formatDate(days[i].date);

  return (
    <div>
      <p className="mb-2 text-sm text-brown">{summary}</p>
      <div ref={box} className="w-full">
        {total === 0 ? null : (
          <svg role="img" aria-label={summary} width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="block max-w-full overflow-visible">
            {days.map((d, i) => {
              const h = d.amount > 0 ? Math.max(2, (d.amount / max) * plotH) : 0;
              return (
                <rect key={d.date} x={i * slot + gap / 2} y={base - h} width={barW} height={h} rx={Math.min(2, barW / 2)} className="fill-cocoa">
                  <title>{`${formatDate(d.date)}: ${formatINR(d.amount)}`}</title>
                </rect>
              );
            })}
            <line x1={0} x2={w} y1={base + 0.5} y2={base + 0.5} className="stroke-line-strong" strokeWidth={1} />
            <text x={peakLabelX} y={base - (peak.amount / max) * plotH - 8} textAnchor={peakAnchor} className="tabular fill-cocoa text-[12px] font-bold">
              {formatINR(peak.amount)}
            </text>
            <text x={0} y={H - 6} textAnchor="start" className="fill-brown text-[11px]">{labelAt(0)}</text>
            <text x={w / 2} y={H - 6} textAnchor="middle" className="fill-brown text-[11px]">{labelAt(Math.floor(days.length / 2))}</text>
            <text x={w} y={H - 6} textAnchor="end" className="fill-brown text-[11px]">Today</text>
          </svg>
        )}
      </div>
      <details className="mt-3">
        <summary className="press inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline">Daily figures as a table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto" data-lenis-prevent>
          <table className="w-full max-w-sm text-left text-sm">
            <caption className="sr-only">Paid order revenue per day, last 30 days</caption>
            <thead>
              <tr>
                <th scope="col" className="font-stencil border-b border-line py-2 text-[11px] text-brown-soft">Day</th>
                <th scope="col" className="font-stencil border-b border-line py-2 text-right text-[11px] text-brown-soft">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="border-b border-line py-1.5">{formatDate(d.date, { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td className="tabular border-b border-line py-1.5 text-right">{formatINR(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
