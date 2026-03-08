import { AddProductForm } from "@/components/dashboard/add-product-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Add Product" };

export default function AddProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add Product</h1>
      <p className="text-sm text-foreground/60">
        Paste the product URL from a supported store to start tracking its
        price.
      </p>
      <AddProductForm />
    </div>
  );
}
