import { ROUTES } from "@/lib/constants";
import Link from "next/link";

interface ProductCatalogCardProps {
  slug: string;
  name: string;
  size: string;
  kgRange: string;
  lowestUnitPrice: number | null;
  storeCount: number;
}

export function ProductCatalogCard({
  slug,
  name,
  size,
  kgRange,
  lowestUnitPrice,
  storeCount,
}: Readonly<ProductCatalogCardProps>) {
  return (
    <Link
      href={ROUTES.productDetail(slug)}
      className="group flex flex-col rounded-xl border border-foreground/10 bg-card p-6 transition-all hover:border-foreground/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
      aria-label={`Ver precios de ${name}`}
    >
      {/* Size badge */}
      <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5 text-sm font-bold group-hover:bg-foreground/10">
        {size}
      </span>

      {/* Name */}
      <h2 className="text-base font-semibold leading-tight">{name}</h2>
      <p className="mt-1 text-sm text-foreground/50">{kgRange}</p>

      {/* Price summary */}
      <div className="mt-4 flex items-end justify-between">
        {lowestUnitPrice != null ? (
          <div>
            <p className="text-xs text-foreground/50">Desde</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-400">
              {new Intl.NumberFormat("es-ES", {
                style: "currency",
                currency: "EUR",
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              }).format(lowestUnitPrice)}
            </p>
            <p className="text-xs text-foreground/50">por pañal</p>
          </div>
        ) : (
          <p className="text-sm text-foreground/40">Sin datos aún</p>
        )}

        <span className="text-xs text-foreground/40">
          {storeCount > 0 ? `${storeCount} tiendas` : ""}
        </span>
      </div>

      {/* CTA arrow */}
      <span
        className="mt-4 self-end text-sm font-medium text-foreground/50 transition-all group-hover:translate-x-1 group-hover:text-foreground"
        aria-hidden="true"
      >
        Comparar →
      </span>
    </Link>
  );
}
