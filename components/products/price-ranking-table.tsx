import { Badge } from "@/components/ui/badge";

export interface PriceRow {
  storeId: string;
  storeName: string;
  storeUrl: string;
  freeShippingThreshold: number | null;
  shippingNote: string | null;
  price: number;
  subscribePrice: number | null;
  packageSize: number | null;
  netWeight: number | null;
  netWeightUnit: "g" | "ml" | null;
  shippingCost: number | null;
  productUrl: string | null;
  scrapedAt: Date;
}

interface PriceRankingTableProps {
  rows: PriceRow[];
}

// ---------------------------------------------------------------------------
// Comparison engine
// ---------------------------------------------------------------------------

type ComparisonMode = "per100g" | "per100ml" | "perUnit" | "rawPrice";

/**
 * Detect the best comparison unit from the available row data.
 * Uses majority vote: picks the mode that covers the most rows.
 * This prevents a small number of mis-parsed entries from overriding
 * the correct mode used by the majority of stores.
 */
export function inferComparisonMode(rows: PriceRow[]): ComparisonMode {
  let gCount = 0;
  let mlCount = 0;
  let unitOnlyCount = 0;
  for (const row of rows) {
    if (row.netWeightUnit === "g") gCount++;
    else if (row.netWeightUnit === "ml") mlCount++;
    else if (row.packageSize !== null) unitOnlyCount++;
  }
  const max = Math.max(gCount, mlCount, unitOnlyCount);
  if (max === 0) return "rawPrice";
  if (gCount === max) return "per100g";
  if (mlCount === max) return "per100ml";
  return "perUnit";
}

/**
 * Comparable price for a row given a mode, normalised to a common basis.
 * Returns null when the row lacks the data needed for the mode (goes to bottom).
 */
export function comparablePrice(
  row: PriceRow,
  mode: ComparisonMode,
): number | null {
  const effective = row.subscribePrice ?? row.price;
  switch (mode) {
    case "per100g":
    case "per100ml": {
      if (row.netWeight === null || row.netWeight <= 0) return null;
      const totalWeight = (row.packageSize ?? 1) * row.netWeight;
      return (effective / totalWeight) * 100;
    }
    case "perUnit":
      // Return null when packageSize is unknown — dividing by 1 would show the
      // full pack price as if it were a per-unit price, which is misleading.
      if (row.packageSize === null) return null;
      return effective / row.packageSize;
    case "rawPrice":
      return effective;
  }
}

const COMPARISON_HEADER: Record<ComparisonMode, string> = {
  per100g: "€/100g",
  per100ml: "€/100ml",
  perUnit: "€/ud",
  rawPrice: "€/ud",
};

function formatWeight(value: number, unit: "g" | "ml"): string {
  if (unit === "g") {
    if (value >= 1000) {
      return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value / 1000)} kg`;
    }
    return `${value}g`;
  }
  if (value >= 1000) {
    return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value / 1000)} L`;
  }
  return `${value} ml`;
}

function quantityLabel(row: PriceRow): string {
  if (row.netWeight !== null && row.netWeightUnit !== null) {
    const weightStr = formatWeight(row.netWeight, row.netWeightUnit);
    return row.packageSize !== null && row.packageSize > 1
      ? `${row.packageSize}×${weightStr}`
      : weightStr;
  }
  if (row.packageSize !== null) {
    return `${row.packageSize} uds`;
  }
  return "—";
}

// ---------------------------------------------------------------------------

function formatEUR(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function shippingLabel(
  shippingCost: number | null,
  freeShippingThreshold: number | null,
  shippingNote: string | null,
): React.ReactNode {
  if (shippingCost !== null && shippingCost === 0) {
    return <Badge variant="success">Gratis</Badge>;
  }
  if (shippingCost !== null && shippingCost > 0) {
    return (
      <span className="text-foreground/70">{formatEUR(shippingCost)}</span>
    );
  }
  if (freeShippingThreshold !== null) {
    return (
      <span className="text-foreground/50 text-xs">
        Gratis desde {formatEUR(freeShippingThreshold)}
      </span>
    );
  }
  if (shippingNote) {
    return <span className="text-foreground/50 text-xs">{shippingNote}</span>;
  }
  return <span className="text-foreground/40">—</span>;
}

export function PriceRankingTable({ rows }: Readonly<PriceRankingTableProps>) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-foreground/50">
        Todavía no hay datos de precios para este producto.
      </p>
    );
  }

  // Sort: comparable rows ascending, then unresolvable rows sorted by raw price.
  const mode = inferComparisonMode(rows);
  const sorted = [...rows].sort((a, b) => {
    const cA = comparablePrice(a, mode);
    const cB = comparablePrice(b, mode);
    if (cA !== null && cB !== null) return cA - cB;
    if (cA === null && cB === null) {
      return (a.subscribePrice ?? a.price) - (b.subscribePrice ?? b.price);
    }
    return cA === null ? 1 : -1;
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10">
      <table className="w-full text-sm">
        <thead className="border-b border-foreground/10 bg-foreground/5">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              #
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Tienda
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Precio pack
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Recurrente
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Cantidad
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              {COMPARISON_HEADER[mode]}
            </th>
            <th
              scope="col"
              className="hidden px-4 py-3 text-center font-semibold sm:table-cell"
            >
              Envío
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              &nbsp;
            </th>
          </tr>
          <tr>
            <td colSpan={8} className="px-4 pb-1 text-xs text-foreground/40">
              Todos los precios incluyen IVA (10%). Actualizados:{" "}
              {rows[0]
                ? new Date(rows[0].scrapedAt).toLocaleDateString("es-ES")
                : "—"}
            </td>
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/5">
          {sorted.map((row, index) => {
            const cPrice = comparablePrice(row, mode);
            const isFirst = index === 0;

            return (
              <tr
                key={row.storeId}
                className={`transition-colors hover:bg-foreground/5 ${
                  isFirst ? "bg-green-50/50 dark:bg-green-900/10" : ""
                }`}
              >
                <td className="px-4 py-3 tabular-nums text-foreground/50">
                  {isFirst ? (
                    <span
                      className="font-bold text-green-600 dark:text-green-400"
                      aria-label="Mejor precio"
                    >
                      🏆
                    </span>
                  ) : (
                    index + 1
                  )}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={row.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {row.storeName}
                  </a>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {formatEUR(row.price)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.subscribePrice ? (
                    <span className="font-semibold text-green-700 dark:text-green-400">
                      {formatEUR(row.subscribePrice)}
                    </span>
                  ) : (
                    <span className="text-foreground/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-mono text-xs text-foreground/70">
                  {quantityLabel(row)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span
                    className={
                      isFirst
                        ? "font-bold text-green-700 dark:text-green-400"
                        : "font-medium"
                    }
                  >
                    {cPrice !== null ? (
                      formatEUR(cPrice)
                    ) : (
                      <span className="font-normal text-foreground/40">—</span>
                    )}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-center sm:table-cell">
                  {shippingLabel(
                    row.shippingCost,
                    row.freeShippingThreshold,
                    row.shippingNote,
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.productUrl ? (
                    <a
                      href={row.productUrl}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground/50"
                      aria-label={`Ver oferta en ${row.storeName}`}
                    >
                      Ver oferta
                    </a>
                  ) : (
                    <a
                      href={row.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5 focus:outline-none focus:ring-2 focus:ring-foreground/50"
                      aria-label={`Ir a ${row.storeName}`}
                    >
                      Ir a tienda
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
