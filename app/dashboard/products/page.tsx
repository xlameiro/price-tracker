import { auth } from "@/auth";
import { ProductCard } from "@/components/dashboard/product-card";
import { ROUTES } from "@/lib/constants";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Mis productos" };

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const userId = session.user.id;

  const tracked = await db.trackedProduct.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          priceEntries: {
            orderBy: { scrapedAt: "desc" },
            take: 10,
            include: { store: true },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis productos</h1>
        <Link
          href={ROUTES.search}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          + Añadir producto
        </Link>
      </div>

      {tracked.length === 0 ? (
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-8 py-12 text-center">
          <p className="font-semibold">Todavía no sigues ningún producto.</p>
          <p className="mt-2 text-sm text-foreground/60">
            Busca un producto y añádelo a tu lista para ver la comparativa de
            precios.
          </p>
          <Link
            href={ROUTES.search}
            className="mt-6 inline-block rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
          >
            Buscar productos
          </Link>
        </div>
      ) : (
        <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracked.map(({ id, product }) => (
            <li key={id}>
              <Link
                href={ROUTES.productDetail(product.slug)}
                className="block rounded-xl border border-foreground/10 transition-all hover:border-foreground/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
                aria-label={`Ver comparativa de precios de ${product.name}`}
              >
                <ProductCard product={product} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
