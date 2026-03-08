import type { Prisma } from "@prisma/client";

type AlertWithProduct = Prisma.PriceAlertGetPayload<{
  include: { product: true };
}>;

interface AlertCardProps {
  alert: AlertWithProduct;
}

export function AlertCard({ alert }: Readonly<AlertCardProps>) {
  const { product, targetPrice, isActive, triggeredAt, createdAt } = alert;

  return (
    <article
      aria-label={`Price alert for ${product.name}`}
      className="rounded-lg border border-foreground/10 p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{product.name}</p>
          <p className="mt-1 text-sm text-foreground/60">
            Target:{" "}
            <span className="font-semibold text-foreground">
              {Number(targetPrice).toFixed(2)} EUR
            </span>
          </p>
          {triggeredAt && (
            <p className="mt-1 text-xs text-foreground/50">
              Triggered: {new Date(triggeredAt).toLocaleDateString("es-ES")}
            </p>
          )}
          <p className="mt-1 text-xs text-foreground/40">
            Created: {new Date(createdAt).toLocaleDateString("es-ES")}
          </p>
        </div>
        <span
          aria-label={isActive ? "Active alert" : "Inactive alert"}
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-foreground/10 text-foreground/50",
          ].join(" ")}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </article>
  );
}
