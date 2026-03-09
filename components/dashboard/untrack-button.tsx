"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface UntrackButtonProps {
  productId: string;
  productName: string;
}

export function UntrackButton({
  productId,
  productName,
}: Readonly<UntrackButtonProps>) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleUntrack() {
    setIsLoading(true);
    try {
      await fetch(`/api/tracked/${productId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleUntrack()}
      disabled={isLoading}
      aria-label={`Dejar de seguir ${productName}`}
      title="Eliminar de mi lista"
      className="rounded-md px-2 py-1 text-sm text-foreground/30 transition-colors hover:text-red-500 disabled:opacity-40"
    >
      {isLoading ? "…" : "✕"}
    </button>
  );
}
