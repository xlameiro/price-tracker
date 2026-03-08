import { auth } from "@/auth";
import { ProductCard } from "@/components/dashboard/product-card";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "My Products" };

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
        <h1 className="text-2xl font-bold">My Products</h1>
        <Link
          href="/dashboard/add"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Add product
        </Link>
      </div>

      {tracked.length === 0 ? (
        <p className="text-foreground/60">
          You are not tracking any products yet.{" "}
          <Link href="/dashboard/add" className="underline">
            Add your first product
          </Link>
          .
        </p>
      ) : (
        <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracked.map(({ id, product }) => (
            <li key={id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
