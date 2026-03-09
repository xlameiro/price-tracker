"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface RefreshPricesButtonProps {
  readonly slug: string;
}

export function RefreshPricesButton({ slug }: RefreshPricesButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [summary, setSummary] = useState<string | null>(null);

  async function handleRefresh() {
    setStatus("loading");
    setSummary(null);

    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(slug)}/refresh`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        setStatus("error");
        setSummary(`Error ${String(response.status)}`);
        return;
      }

      const data = (await response.json()) as {
        discovered?: number;
        deleted?: number;
        stores?: string[];
      };
      setStatus("done");
      setSummary(
        `${String(data.discovered ?? 0)} tiendas encontradas (${String(data.deleted ?? 0)} entradas borradas)`,
      );
      router.refresh();
    } catch {
      setStatus("error");
      setSummary("No se pudo conectar");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={status === "loading"}
        className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        aria-busy={status === "loading"}
      >
        {status === "loading" ? "Actualizando…" : "↻ Actualizar precios"}
      </button>
      {summary && (
        <p
          className={`text-xs ${status === "error" ? "text-red-600" : "text-foreground/50"}`}
          aria-live="polite"
        >
          {summary}
        </p>
      )}
    </div>
  );
}
