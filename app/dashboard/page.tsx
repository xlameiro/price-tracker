import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const userId = session.user.id;

  const [trackedCount, alertCount, recentPrices] = await Promise.all([
    db.trackedProduct.count({ where: { userId } }),
    db.priceAlert.count({ where: { userId, isActive: true } }),
    db.priceEntry.findMany({
      where: { product: { trackedByUsers: { some: { userId } } } },
      orderBy: { scrapedAt: "desc" },
      take: 5,
      select: {
        id: true,
        price: true,
        currency: true,
        scrapedAt: true,
        product: { select: { name: true, slug: true } },
        store: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Overview</h1>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Summary statistics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-foreground/10 p-6">
            <p className="text-sm text-foreground/60">Tracked Products</p>
            <p className="mt-1 text-3xl font-bold">{trackedCount}</p>
          </div>
          <div className="rounded-lg border border-foreground/10 p-6">
            <p className="text-sm text-foreground/60">Active Alerts</p>
            <p className="mt-1 text-3xl font-bold">{alertCount}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-4 text-lg font-semibold">
          Recent Price Updates
        </h2>
        {recentPrices.length === 0 ? (
          <p className="text-foreground/60">
            No price data yet.{" "}
            <Link href="/dashboard/add" className="underline">
              Add a product
            </Link>{" "}
            to start tracking.
          </p>
        ) : (
          <ul role="list" className="divide-y divide-foreground/10">
            {recentPrices.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium">{entry.product.name}</p>
                  <p className="text-sm text-foreground/60">
                    {entry.store.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {Number(entry.price).toFixed(2)} {entry.currency}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {new Date(entry.scrapedAt).toLocaleDateString("es-ES")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
