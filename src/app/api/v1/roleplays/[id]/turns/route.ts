import Anthropic from "@anthropic-ai/sdk";
import { ASIDE_PREFIX } from "@/lib/conversation/machine";
import { CONTRACT, SCENE_CUE, sceneNotes } from "@/lib/conversation/prompt";
import { CRISIS_REPLY, DECLINED_REPLY, NEUTRAL_LINE, suggestsCrisis } from "@/lib/safety/screen";
import { FixedWindowLimiter, RecentKeys, clientKey, envInt } from "@/lib/server/limits";
import { estimateCostUsd, logEvent } from "@/lib/server/log";
import {
  LIMITS,
  REGENERATE_REMINDER,
  ReplyAssembler,
  cleanPrefix,
  parseTurnRequest,
  partnerConfig,
} from "@/lib/server/partner";

/**
 * POST /api/v1/roleplays/{id}/turns
 *
 * The person has pressed "I'm finished". This asks the AI partner for its
 * reply and streams it back a sentence at a time.
 *
 * Nothing is stored. The conversation text is held only for the life of the
 * request and is never written to a log.
 */

const MAX_OUTPUT_TOKENS = 2048;

const perMinute = new FixedWindowLimiter(envInt("LMF_AI_TURNS_PER_MINUTE", 12), 60_000);
const perDay = new FixedWindowLimiter(envInt("LMF_AI_TURNS_PER_DAY", 300), 86_400_000);
const everyone = new FixedWindowLimiter(envInt("LMF_AI_DAILY_TURN_BUDGET", 5_000), 86_400_000);
const recentKeys = new RecentKeys();

type Wire =
  | { t: "delta"; text: string }
  | { t: "done"; text: string; aside: boolean }
  | { t: "error"; code: string; message: string };

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function single(text: string): Response {
  const body: Wire[] = [
    { t: "delta", text },
    { t: "done", text, aside: text.startsWith(ASIDE_PREFIX) },
  ];
  return new Response(body.map((b) => JSON.stringify(b)).join("\n") + "\n", { headers: streamHeaders });
}

const streamHeaders = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no",
};

export async function POST(request: Request, ctx: RouteContext<"/api/v1/roleplays/[id]/turns">) {
  const { id } = await ctx.params;
  const config = partnerConfig();

  if (!config.apiKey) {
    return json(503, { code: "ai_unavailable", message: "The AI partner is not set up on this server." });
  }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return json(400, { code: "bad_request", message: "Invalid session id." });

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > LIMITS.maxBodyBytes) return json(413, { code: "too_large", message: "Request is too large." });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { code: "bad_request", message: "Body must be JSON." });
  }
  const parsed = parseTurnRequest(body);
  if ("error" in parsed) return json(400, { code: "bad_request", message: parsed.error });

  const userTurns = parsed.messages.filter((m) => m.role === "user").length;
  const maxTurns = envInt("LMF_AI_MAX_TURNS_PER_SESSION", 40);
  if (userTurns > maxTurns) {
    return json(429, { code: "session_limit", message: "This conversation has reached its length limit." });
  }

  // Spending guards. The address is used as a counter key only; it is not logged or stored.
  const who = clientKey(request.headers);
  const wait = perMinute.hit(`m:${who}`) || perDay.hit(`d:${who}`) || everyone.hit("all");
  if (wait > 0) {
    logEvent("partner.rate_limited", { retry_after_s: wait });
    return json(
      429,
      { code: "rate_limited", message: "The AI partner is busy. Try again shortly, or carry on with the scripted partner." },
      { "Retry-After": String(wait) },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey && !recentKeys.claim(`${id}:${idempotencyKey}`)) {
    return json(409, { code: "duplicate", message: "This turn has already been sent." });
  }

  // A crisis phrase gets the fixed, reviewed reply. It never goes to the model.
  const lastSaid = parsed.messages.at(-1)?.text ?? "";
  if (suggestsCrisis(lastSaid)) {
    logEvent("partner.crisis_reply");
    return single(CRISIS_REPLY);
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  if (parsed.messages.length === 0 || parsed.messages[0].role === "partner") {
    messages.push({ role: "user", content: SCENE_CUE });
  }
  for (const m of parsed.messages) {
    messages.push({ role: m.role === "user" ? "user" : "assistant", content: m.text });
  }

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    // Identical for every request, so the provider can cache it across everyone.
    { type: "text", text: CONTRACT, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: sceneNotes(parsed.scenario, parsed.custom, {
        manner: parsed.manner,
        replyLength: parsed.replyLength,
        term: parsed.term,
      }),
      cache_control: { type: "ephemeral" },
    },
  ];

  const client = new Anthropic({ apiKey: config.apiKey, timeout: 45_000, maxRetries: 1 });
  const caps = config.capabilities;
  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model: config.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system,
    messages,
    // Thinking is kept short so the reply starts quickly.
    ...(caps.effort ? { output_config: { effort: config.effort } } : {}),
    // If the model declines for policy reasons, let the API retry on its
    // recommended fallback model instead of failing the turn.
    ...(caps.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };

  const started = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Wire) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const assembler = new ReplyAssembler();
      let outcome = "ok";

      try {
        const upstream = client.beta.messages.stream(params, { signal: request.signal });
        for await (const event of upstream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            for (const sentence of assembler.push(event.delta.text)) send({ t: "delta", text: `${sentence} ` });
            if (assembler.blocked) break;
          }
        }

        let finalText: string;
        if (assembler.blocked) {
          upstream.abort();
          logEvent("partner.line_withheld", { rule: assembler.blocked, model: config.model });
          outcome = "withheld";
          finalText = assembler.text;
          if (!finalText) {
            // Nothing usable yet: ask once more, with the rule restated.
            finalText = await regenerate(client, params, caps.midConversationSystem, request.signal);
          }
        } else {
          const final = await upstream.finalMessage();
          for (const sentence of assembler.end()) send({ t: "delta", text: `${sentence} ` });
          if (assembler.blocked) {
            logEvent("partner.line_withheld", { rule: assembler.blocked, model: config.model });
            outcome = "withheld";
          }
          finalText = assembler.text;

          const usage = {
            input: final.usage.input_tokens,
            output: final.usage.output_tokens,
            cacheRead: final.usage.cache_read_input_tokens ?? 0,
            cacheWrite: final.usage.cache_creation_input_tokens ?? 0,
          };
          logEvent("partner.turn", {
            model: final.model,
            requested_model: config.model,
            stop_reason: final.stop_reason,
            input_tokens: usage.input,
            output_tokens: usage.output,
            cache_read_tokens: usage.cacheRead,
            cache_write_tokens: usage.cacheWrite,
            est_cost_usd: estimateCostUsd(final.model, usage),
            ms: Date.now() - started,
            user_turns: userTurns,
          });

          if (final.stop_reason === "refusal") {
            // Declined by the provider's safeguards (and by any fallback model).
            // Anything already streamed is replaced, not kept.
            outcome = "declined";
            finalText = DECLINED_REPLY;
          } else if (!finalText) {
            if (assembler.blocked) finalText = await regenerate(client, params, caps.midConversationSystem, request.signal);
            else throw new EmptyReply();
          }
        }

        send({ t: "done", text: finalText, aside: finalText.startsWith(ASIDE_PREFIX) });
        if (outcome !== "ok") logEvent("partner.outcome", { outcome });
      } catch (error) {
        const { code, message } = describe(error);
        if (code !== "aborted") {
          logEvent("partner.error", { code, model: config.model, ms: Date.now() - started });
          // A failed turn can be sent again with the same key.
          if (idempotencyKey) recentKeys.release(`${id}:${idempotencyKey}`);
          try {
            send({ t: "error", code, message });
          } catch {
            /* the client has gone */
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, { headers: streamHeaders });
}

class EmptyReply extends Error {}

/** One more attempt after a withheld reply. Falls back to a line that is safe in any scene. */
async function regenerate(
  client: Anthropic,
  params: Anthropic.Beta.MessageCreateParamsNonStreaming,
  canRemind: boolean,
  signal: AbortSignal,
): Promise<string> {
  if (!canRemind) return NEUTRAL_LINE;
  try {
    const retry = await client.beta.messages.create(
      { ...params, messages: [...params.messages, { role: "system", content: REGENERATE_REMINDER }] },
      { signal },
    );
    if (retry.stop_reason === "refusal") return DECLINED_REPLY;
    const text = retry.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    return cleanPrefix(text).text || NEUTRAL_LINE;
  } catch {
    return NEUTRAL_LINE;
  }
}

function describe(error: unknown): { code: string; message: string } {
  if (error instanceof EmptyReply) {
    return { code: "empty", message: "The AI partner didn’t produce a reply. You can try again." };
  }
  if (error instanceof Anthropic.APIUserAbortError) return { code: "aborted", message: "Cancelled." };
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return { code: "ai_unavailable", message: "The AI partner is not set up correctly on this server." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { code: "rate_limited", message: "The AI partner is busy right now. You can try again in a moment." };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { code: "provider_rejected", message: "The AI partner couldn’t take that turn. You can try again." };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { code: "connection", message: "Couldn’t reach the AI partner. You can try again." };
  }
  if (error instanceof Anthropic.APIError) {
    return { code: "provider_error", message: "The AI partner had a problem. You can try again." };
  }
  if (error instanceof Error && error.name === "AbortError") return { code: "aborted", message: "Cancelled." };
  return { code: "server_error", message: "Something went wrong. You can try again." };
}
