import type { Prisma } from "@prisma/client";
import Image from "next/image";

type ProductWithPriceHistory = Prisma.ProductGetPayload<{
  include: {
    priceEntries: {
      take: 10;
      include: { store: true };
    };
  };
}>;

interface ProductCardProps {
  product: ProductWithPriceHistory;
}

export function ProductCard({ product }: Readonly<ProductCardProps>) {
  const { name, imageUrl, brand, category, priceEntries } = product;

  const latestPrices = priceEntries.slice(0, 3);
  const lowestEntry = priceEntries.reduce<(typeof priceEntries)[number] | null>(
    (min, entry) =>
      min === null || Number(entry.price) < Number(min.price) ? entry : min,
    null,
  );

  return (
    <article
      aria-label={name}
      className="flex flex-col rounded-lg border border-foreground/10 bg-background overflow-hidden"
    >
      {imageUrl ? (
        <div className="relative h-40 w-full bg-foreground/5">
          <Image
            src={imageUrl}
            alt={`Image of ${name}`}
            fill
            className="object-contain p-2"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="flex h-40 items-center justify-center bg-foreground/5 text-foreground/20 text-sm"
        >
          No image
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-medium leading-snug">{name}</h3>
        {(brand ?? category) && (
          <p className="text-xs text-foreground/50">
            {[brand, category].filter(Boolean).join(" · ")}
          </p>
        )}

        {lowestEntry && (
          <p className="mt-auto text-sm">
            <span className="text-xs text-foreground/50">Lowest: </span>
            <span className="font-semibold">
              {Number(lowestEntry.price).toFixed(2)} {lowestEntry.currency}
            </span>
            <span className="ml-1 text-xs text-foreground/50">
              via {lowestEntry.store.name}
            </span>
          </p>
        )}

        {latestPrices.length > 0 && (
          <ul
            aria-label="Recent prices"
            className="mt-1 space-y-0.5 border-t border-foreground/10 pt-2"
          >
            {latestPrices.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between text-xs text-foreground/60"
              >
                <span>{entry.store.name}</span>
                <span className="font-medium text-foreground">
                  {Number(entry.price).toFixed(2)} {entry.currency}
                </span>
              </li>
            ))}
          </ul>
        )}

        {priceEntries.length === 0 && (
          <p className="mt-2 text-xs text-foreground/40">
            No prices tracked yet
          </p>
        )}
      </div>
    </article>
  );
}
