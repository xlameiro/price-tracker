import { auth } from "@/auth";
import { AlertCard } from "@/components/dashboard/alert-card";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const userId = session.user.id;

  const alerts = await db.priceAlert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { product: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Price Alerts</h1>

      {alerts.length === 0 ? (
        <p className="text-foreground/60">
          No alerts set.{" "}
          <Link href="/dashboard/products" className="underline">
            Go to a product
          </Link>{" "}
          to create an alert.
        </p>
      ) : (
        <ul role="list" className="space-y-3">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <AlertCard alert={alert} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
