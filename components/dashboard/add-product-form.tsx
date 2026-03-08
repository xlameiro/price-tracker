"use client";

import { Button } from "@/components/ui/button";
import { API_ROUTES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface FormState {
  productUrl: string;
  storeSlug: string;
  targetPrice: string;
}

const SUPPORTED_STORES = [
  { value: "amazon-es", label: "Amazon.es" },
  { value: "carrefour", label: "Carrefour" },
  { value: "elcorteingles", label: "El Corte Inglés" },
  { value: "pccomponentes", label: "PcComponentes" },
] as const;

export function AddProductForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    productUrl: "",
    storeSlug: "amazon-es",
    targetPrice: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function submitProduct() {
    setError(null);

    const targetPriceNum = form.targetPrice
      ? Number.parseFloat(form.targetPrice)
      : null;

    if (
      form.targetPrice &&
      (Number.isNaN(targetPriceNum) || (targetPriceNum ?? 0) <= 0)
    ) {
      setError("Target price must be a positive number.");
      return;
    }

    let url: URL;
    try {
      url = new URL(form.productUrl);
    } catch {
      setError("Please enter a valid product URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      const storesRes = await fetch(API_ROUTES.stores);
      if (!storesRes.ok) throw new Error("Could not load stores.");
      const storesData = (await storesRes.json()) as {
        data: Array<{ id: string; slug: string }>;
      };
      const store = storesData.data.find((s) => s.slug === form.storeSlug);
      if (!store) throw new Error("Selected store not found.");

      const productRes = await fetch(API_ROUTES.products, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: url.hostname,
          slug: crypto.randomUUID(),
        }),
      });
      if (!productRes.ok) {
        const body = (await productRes.json()) as { message?: string };
        throw new Error(body.message ?? "Could not create product.");
      }
      const productData = (await productRes.json()) as {
        data: { id: string };
      };

      await fetch(API_ROUTES.tracked, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: productData.data.id }),
      });

      await fetch(API_ROUTES.prices, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SCRAPE_CRON_SECRET ?? ""}`,
        },
        body: JSON.stringify({
          productId: productData.data.id,
          storeId: store.id,
          price: 0.01,
          url: form.productUrl,
          source: "MANUAL",
        }),
      });

      if (targetPriceNum !== null) {
        await fetch(API_ROUTES.alerts, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: productData.data.id,
            targetPrice: targetPriceNum,
          }),
        });
      }

      router.push("/dashboard/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submitProduct();
      }}
      noValidate
      aria-label="Add product form"
      className="max-w-lg space-y-5"
    >
      <div>
        <label
          htmlFor="productUrl"
          className="mb-1.5 block text-sm font-medium"
        >
          Product URL <span aria-hidden="true">*</span>
        </label>
        <input
          id="productUrl"
          name="productUrl"
          type="url"
          required
          value={form.productUrl}
          onChange={handleChange}
          placeholder="https://www.amazon.es/dp/..."
          aria-required="true"
          className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm placeholder:text-foreground/40 focus:border-foreground/50 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="storeSlug" className="mb-1.5 block text-sm font-medium">
          Store <span aria-hidden="true">*</span>
        </label>
        <select
          id="storeSlug"
          name="storeSlug"
          required
          value={form.storeSlug}
          onChange={handleChange}
          aria-required="true"
          className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/50 focus:outline-none"
        >
          {SUPPORTED_STORES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="targetPrice"
          className="mb-1.5 block text-sm font-medium"
        >
          Alert me when price drops below (optional)
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-3 flex items-center text-sm text-foreground/50"
          >
            €
          </span>
          <input
            id="targetPrice"
            name="targetPrice"
            type="number"
            min="0.01"
            step="0.01"
            value={form.targetPrice}
            onChange={handleChange}
            placeholder="49.99"
            className="w-full rounded-md border border-foreground/20 bg-background py-2 pl-7 pr-3 text-sm placeholder:text-foreground/40 focus:border-foreground/50 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? "Adding…" : "Add product"}
      </Button>
    </form>
  );
}
