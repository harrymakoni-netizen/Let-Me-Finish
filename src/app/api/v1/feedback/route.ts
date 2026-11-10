import { FixedWindowLimiter, clientKey } from "@/lib/server/limits";
import { logEvent } from "@/lib/server/log";

/**
 * POST /api/v1/feedback
 *
 * The reporting mechanism: a person flags a partner reply, a piece of content
 * or a safety concern. Reports are sent on to the team's inbox when one is
 * configured (LMF_FEEDBACK_WEBHOOK_URL). They are never written to the logs.
 */

const KINDS = ["partner_reply", "content", "safety", "bug", "other"] as const;
const limiter = new FixedWindowLimiter(10, 60 * 60_000);

export async function POST(request: Request) {
  const wait = limiter.hit(clientKey(request.headers));
  if (wait > 0) {
    return Response.json({ code: "rate_limited" }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "bad_request" }, { status: 400 });
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const kind = KINDS.find((k) => k === b.kind);
  const detail = typeof b.detail === "string" ? b.detail.trim().slice(0, 2000) : "";
  const context = typeof b.context === "string" ? b.context.trim().slice(0, 1000) : "";
  if (!kind || !detail) return Response.json({ code: "bad_request" }, { status: 400 });

  const webhook = process.env.LMF_FEEDBACK_WEBHOOK_URL;
  let delivered = false;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "let-me-finish", kind, detail, context, receivedAt: new Date().toISOString() }),
        signal: AbortSignal.timeout(8000),
      });
      delivered = res.ok;
    } catch {
      delivered = false;
    }
  }

  // Count it, so safety reports are visible on a dashboard — without their content.
  logEvent("feedback.received", { kind, delivered, has_inbox: Boolean(webhook) });
  return Response.json({ received: true, delivered }, { status: delivered ? 200 : 202, headers: { "Cache-Control": "no-store" } });
}
