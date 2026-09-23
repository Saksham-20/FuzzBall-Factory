"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { formatQty, pluralUnit } from "@/components/admin/materials/MaterialsClient";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/misc";
import { adjustMaterialStock, listMaterials } from "@/lib/api/admin";
import { useApi } from "@/lib/api/useApi";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";

const DEFAULTS_KEY = "fbf-admin-pricing-defaults";

/** Rates and margins tend to stay the same piece to piece; remember them in this browser. */
type Defaults = { rate: string; overheadPct: string; marginPct: string; feePct: string };
const FALLBACK_DEFAULTS: Defaults = { rate: "150", overheadPct: "15", marginPct: "40", feePct: "0" };

/** Browser-only: called from an effect, never during render, so there's no server/client mismatch to worry about. */
function loadDefaults(): Defaults {
  try {
    const raw = window.localStorage.getItem(DEFAULTS_KEY);
    if (!raw) return FALLBACK_DEFAULTS;
    return { ...FALLBACK_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return FALLBACK_DEFAULTS;
  }
}

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Round up to a clean ₹5, so the sticker price isn't an odd number like ₹742. */
const roundUp5 = (n: number) => Math.ceil(n / 5) * 5;

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={cn("text-sm", strong ? "font-bold" : "text-brown")}>
        {label}
        {hint ? <span className="ml-1.5 text-xs text-brown-soft">{hint}</span> : null}
      </span>
      <span className={cn("tabular text-sm", strong && "text-base font-bold")}>{value}</span>
    </div>
  );
}

/**
 * A from-scratch pricing breakdown for one crocheted piece: yarn + notions + packaging,
 * your hours at your rate, a slice for overhead, then your margin on top. Every line is
 * shown, nothing is a black box. Pass `onApply` to add a "Use this price" action (e.g. from
 * the product form); omit it for the standalone `/admin/pricing` page.
 */
export function PriceCalculator({ onApply, className }: { onApply?: (price: number) => void; className?: string }) {
  const [skeins, setSkeins] = useState("1");
  const [costPerSkein, setCostPerSkein] = useState("180");
  const [notions, setNotions] = useState("0");
  const [packaging, setPackaging] = useState("15");
  const [hours, setHours] = useState("3");
  const [rate, setRate] = useState(FALLBACK_DEFAULTS.rate);
  const [overheadPct, setOverheadPct] = useState(FALLBACK_DEFAULTS.overheadPct);
  const [marginPct, setMarginPct] = useState(FALLBACK_DEFAULTS.marginPct);
  const [feePct, setFeePct] = useState(FALLBACK_DEFAULTS.feePct);
  const [advanced, setAdvanced] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [logging, setLogging] = useState(false);
  const { data: materialsList, error: materialsError, loading: materialsLoading, reload: reloadMaterials } = useApi(listMaterials, "pricing-materials-picker");
  const selectedMaterial = materialsList?.find((m) => m.id === materialId);

  // Adopt whatever rate/overhead/margin/fee this browser last used, once, right after mount.
  // Starting from FALLBACK_DEFAULTS above (not localStorage) keeps the very first render identical
  // on the server and the client; this is the one place that's allowed to diverge from it.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage, not state derived from props/other state */
    const saved = loadDefaults();
    setRate(saved.rate);
    setOverheadPct(saved.overheadPct);
    setMarginPct(saved.marginPct);
    setFeePct(saved.feePct);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DEFAULTS_KEY, JSON.stringify({ rate, overheadPct, marginPct, feePct }));
    } catch {
      // localStorage can be unavailable (private mode); the calculator still works, it just won't remember.
    }
  }, [rate, overheadPct, marginPct, feePct]);

  const calc = useMemo(() => {
    const yarnCost = num(skeins) * num(costPerSkein);
    const materials = yarnCost + num(notions) + num(packaging);
    const labor = num(hours) * num(rate);
    const beforeOverhead = materials + labor;
    const overhead = beforeOverhead * (num(overheadPct) / 100);
    const cost = beforeOverhead + overhead;
    const profit = cost * (num(marginPct) / 100);
    const beforeFees = cost + profit;
    const fee = num(feePct);
    const withFees = fee > 0 && fee < 100 ? beforeFees / (1 - fee / 100) : beforeFees;
    const suggested = roundUp5(withFees);
    const ruleOfThumb = roundUp5(cost * 4); // the "cost × 2 × 2" rule of thumb some makers use as a gut check
    return { yarnCost, materials, labor, overhead, cost, profit, beforeFees, feesAdded: withFees - beforeFees, suggested, ruleOfThumb };
  }, [skeins, costPerSkein, notions, packaging, hours, rate, overheadPct, marginPct, feePct]);

  const skeinsUsed = num(skeins);

  /** Records the skeins used against the picked material's stock. Independent of `onApply`: a maker may want to log usage without setting a product's price right now. */
  async function logUsage() {
    if (!selectedMaterial || skeinsUsed <= 0) return;
    setLogging(true);
    try {
      const before = selectedMaterial.qtyOnHand;
      const updated = await adjustMaterialStock(selectedMaterial.id, -skeinsUsed, "Used in the price calculator");
      const shortName = selectedMaterial.name.split(",")[0];
      toast.success(`${shortName}: ${formatQty(before)} → ${formatQty(updated.qtyOnHand)} ${pluralUnit(selectedMaterial.unit, updated.qtyOnHand)} left.`);
      reloadMaterials();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't log that. Try again.");
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className={cn("grid gap-4", className)}>
      <Panel title="What went into it">
        <div className="grid gap-4">
          {materialsError ? (
            <ErrorNote onRetry={reloadMaterials}>Couldn&apos;t load your materials.</ErrorNote>
          ) : !materialsLoading && (materialsList ?? []).length === 0 ? (
            <p className="text-sm text-brown-soft">
              No materials saved yet. <Link href="/admin/materials" className="underline">Add some</Link> to pick real costs and quantities from here.
            </p>
          ) : (
            <Field label="Pick from your materials" optional hint="Fills in the cost per skein below for you; still yours to change.">
              {(p) => (
                <Select
                  {...p}
                  value={materialId}
                  disabled={materialsLoading}
                  onChange={(e) => {
                    const id = e.target.value;
                    setMaterialId(id);
                    const m = materialsList?.find((x) => x.id === id);
                    if (m) setCostPerSkein(String(m.costPerUnit));
                  }}
                >
                  <option value="">Type in the values below</option>
                  {(materialsList ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {formatQty(m.qtyOnHand)} {pluralUnit(m.unit, m.qtyOnHand)} left
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Skeins used">{(p) => <Input {...p} inputMode="decimal" value={skeins} onChange={(e) => setSkeins(e.target.value)} />}</Field>
            <Field label="Cost per skein (₹)">{(p) => <Input {...p} inputMode="decimal" value={costPerSkein} onChange={(e) => setCostPerSkein(e.target.value)} />}</Field>
          </div>
          <Button type="button" variant="secondary" className="w-fit" disabled={!selectedMaterial || skeinsUsed <= 0 || logging} onClick={logUsage}>
            {logging ? "Logging…" : "Log this as used"}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Notions & trims (₹)" optional hint="Stuffing, safety eyes, buttons, backing.">
              {(p) => <Input {...p} inputMode="decimal" value={notions} onChange={(e) => setNotions(e.target.value)} />}
            </Field>
            <Field label="Packaging (₹)" optional hint="Mailer, tag, thank-you card.">
              {(p) => <Input {...p} inputMode="decimal" value={packaging} onChange={(e) => setPackaging(e.target.value)} />}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hours to make">{(p) => <Input {...p} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />}</Field>
            <Field label="Your hourly rate (₹)">{(p) => <Input {...p} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />}</Field>
          </div>
        </div>
      </Panel>

      <Panel title="Overhead and profit">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Overhead (%)" hint="Electricity, wear on hooks, a share of your other costs.">
              {(p) => <Input {...p} inputMode="decimal" value={overheadPct} onChange={(e) => setOverheadPct(e.target.value)} />}
            </Field>
            <Field label="Profit margin (%)" hint="What you actually take home, on top of your cost.">
              {(p) => <Input {...p} inputMode="decimal" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />}
            </Field>
          </div>
          {advanced ? (
            <Field label="Payment or platform fees (%)" optional hint="If something takes a cut before it reaches you, add it here so the fee doesn't eat your margin.">
              {(p) => <Input {...p} inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value)} />}
            </Field>
          ) : (
            <button type="button" onClick={() => setAdvanced(true)} className="press w-fit text-sm font-semibold text-brown underline hf:hover:text-cocoa">
              Add payment or platform fees
            </button>
          )}
        </div>
      </Panel>

      <Panel title="The breakdown">
        <div className="divide-y divide-line">
          <Row label="Yarn" value={formatINR(calc.yarnCost)} />
          <Row label="Materials total" hint="yarn + notions + packaging" value={formatINR(calc.materials)} />
          <Row label="Your time" hint={`${num(hours) || 0}h × ${formatINR(num(rate))}`} value={formatINR(calc.labor)} />
          <Row label="Overhead" value={formatINR(calc.overhead)} />
          <Row label="Cost to make this piece" strong value={formatINR(calc.cost)} />
          <Row label="Your profit" value={formatINR(calc.profit)} />
          {calc.feesAdded > 0.5 ? <Row label="Added back for fees" value={formatINR(calc.feesAdded)} /> : null}
        </div>
        <div className="mt-4 rounded-[12px] bg-kraft-light p-4">
          <p className="text-sm font-semibold text-brown">Suggested price</p>
          <p className="font-display text-[2.5rem] leading-none">{formatINR(calc.suggested)}</p>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-brown">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.8} />
            Rounded up to a clean ₹5. Some crafters check this against a quick rule of thumb — cost × 2, then × 2 again — which
            would put this piece around {formatINR(calc.ruleOfThumb)}. Neither is more &quot;correct&quot;; use whichever feels
            right for the piece.
          </p>
        </div>
        {onApply ? (
          <Button type="button" className="mt-4 w-full" onClick={() => onApply(calc.suggested)}>
            Use {formatINR(calc.suggested)} as the price
          </Button>
        ) : null}
      </Panel>
    </div>
  );
}
