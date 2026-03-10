import { Badge } from "@/components/ui/badge";
import {
  COMPARISON_HEADER,
  comparablePrice,
  compareByUnitPrice,
  formatComparablePrice,
  inferComparisonMode,
  quantityLabel,
} from "@/lib/price-comparison";

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

// Re-export comparison utilities so callers that already import PriceRow
// from this module don't need to change their imports.
export { comparablePrice, inferComparisonMode } from "@/lib/price-comparison";

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

  // Sort: comparable rows ascending (including shipping cost), then unresolvable rows sorted by raw price.
  const mode = inferComparisonMode(rows);
  const sorted = [...rows].sort((a, b) => compareByUnitPrice(a, b, mode, true));

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
            const cPrice = comparablePrice(row, mode, true);
            const isFirst = index === 0;
            // Shipping was factored into the unit price — show a note so
            // users understand why the displayed unit price may differ from
            // a naive pack-price ÷ units calculation.
            const hasShipping =
              row.shippingCost !== null && row.shippingCost > 0;

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
                      <>
                        {formatComparablePrice(cPrice, mode)}
                        {hasShipping && (
                          <span
                            className="ml-1 text-xs font-normal text-foreground/40"
                            title="Incluye coste de envío"
                          >
                            +envío
                          </span>
                        )}
                      </>
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
