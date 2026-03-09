import { streamSearchAllStores } from "@/lib/scrapers/search";
import type { NextRequest } from "next/server";

const MIN_QUERY_LENGTH = 3;

// GET /api/search/stream?q= — streams results via Server-Sent Events as each
// scraper finishes, allowing the client to render progressively.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < MIN_QUERY_LENGTH) {
    return new Response("Query too short", { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };

      await streamSearchAllStores(q, (batch) => {
        send("results", batch);
      });

      send("done", {});
      if (!closed) controller.close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      // Disable proxy/nginx buffering so events reach the client immediately
      "X-Accel-Buffering": "no",
    },
  });
}
