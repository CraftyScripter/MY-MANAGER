import { NextResponse } from "next/server";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import {
  subscribeToTarget,
  subscribeToGlobal,
  registerTabToFile,
  SyncEventPayload,
} from "@/lib/sync-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tabId = searchParams.get("tabId");
  const fileId = searchParams.get("fileId");

  if (tabId && fileId) {
    registerTabToFile(tabId, fileId);
  }

  const encoder = new TextEncoder();
  const unsubs: Array<() => void> = [];
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "connected",
            tabId,
            fileId,
            timestamp: Date.now(),
          })}\n\n`
        )
      );

      const handleEvent = (event: SyncEventPayload) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream already closed
        }
      };

      // 1. Always subscribe to global workspace events (files created/deleted, folders created/deleted)
      unsubs.push(subscribeToGlobal(handleEvent));

      // 2. If tabId or fileId is given, subscribe to them directly
      if (tabId) {
        unsubs.push(subscribeToTarget(tabId, handleEvent));
      }
      if (fileId && fileId !== tabId) {
        unsubs.push(subscribeToTarget(fileId, handleEvent));
      }

      // Keep connection alive with heartbeat ping
      intervalId = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "ping",
                tabId,
                fileId,
                timestamp: Date.now(),
              })}\n\n`
            )
          );
        } catch {
          if (intervalId) clearInterval(intervalId);
        }
      }, 20000);
    },
    cancel() {
      unsubs.forEach((unsub) => unsub());
      if (intervalId) clearInterval(intervalId);
    },
  });

  request.signal.addEventListener("abort", () => {
    unsubs.forEach((unsub) => unsub());
    if (intervalId) clearInterval(intervalId);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
