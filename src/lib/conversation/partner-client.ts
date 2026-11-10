import type { ChatMessage, CustomScenario, ListenerManner, Term } from "../types";

/**
 * Talks to the AI partner route and reads its reply as it streams in.
 * Only conversation text and the scene are sent — see the "ai" consent.
 */

export class PartnerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly canRetry: boolean,
  ) {
    super(message);
    this.name = "PartnerError";
  }
}

export interface AiReplyRequest {
  sessionId: string;
  scenarioId: string;
  custom?: CustomScenario;
  manner: ListenerManner;
  replyLength: "short" | "medium";
  term: Term;
  messages: ChatMessage[];
  idempotencyKey: string;
  signal: AbortSignal;
  onDelta: (text: string) => void;
}

export interface AiReply {
  text: string;
  aside: boolean;
}

const NOT_WORTH_RETRYING = new Set(["bad_request", "session_limit", "too_large", "duplicate"]);

/** Codes that mean "there is no AI partner to reach right now". */
export const UNREACHABLE = new Set(["ai_unavailable", "offline"]);

export async function requestAiReply(request: AiReplyRequest): Promise<AiReply> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/roleplays/${encodeURIComponent(request.sessionId)}/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": request.idempotencyKey },
      body: JSON.stringify({
        scenarioId: request.scenarioId,
        custom: request.custom,
        manner: request.manner,
        replyLength: request.replyLength,
        term: request.term,
        messages: request.messages.map((m) => ({ role: m.role, text: m.text })),
      }),
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    if (request.signal.aborted) throw new PartnerError("aborted", "Cancelled.", false);
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    throw new PartnerError(
      offline ? "offline" : "connection",
      offline ? "You’re offline." : "Couldn’t reach the AI partner.",
      true,
    );
  }

  if (!response.ok || !response.body) {
    let code = "server_error";
    let message = "The AI partner had a problem.";
    try {
      const body = (await response.json()) as { code?: string; message?: string };
      if (body.code) code = body.code;
      if (body.message) message = body.message;
    } catch {
      /* keep the defaults */
    }
    throw new PartnerError(code, message, !NOT_WORTH_RETRYING.has(code));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let result: AiReply | null = null;

  const handle = (line: string) => {
    if (!line.trim()) return;
    let event: { t?: string; text?: string; aside?: boolean; code?: string; message?: string };
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (event.t === "delta" && typeof event.text === "string") request.onDelta(event.text);
    else if (event.t === "done" && typeof event.text === "string") result = { text: event.text, aside: Boolean(event.aside) };
    else if (event.t === "error") {
      const code = event.code ?? "server_error";
      throw new PartnerError(code, event.message ?? "The AI partner had a problem.", !NOT_WORTH_RETRYING.has(code));
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffered.indexOf("\n")) !== -1) {
        handle(buffered.slice(0, newline));
        buffered = buffered.slice(newline + 1);
      }
    }
    handle(buffered + decoder.decode());
  } catch (error) {
    if (error instanceof PartnerError) throw error;
    if (request.signal.aborted) throw new PartnerError("aborted", "Cancelled.", false);
    throw new PartnerError("connection", "The connection dropped while the partner was replying.", true);
  }

  if (!result) throw new PartnerError("connection", "The partner’s reply didn’t arrive in full.", true);
  return result;
}

export interface ServiceStatus {
  ai: boolean;
  accounts: boolean;
}

let cachedStatus: { at: number; value: ServiceStatus } | null = null;

/** Which optional services this deployment has. Cached briefly; false when offline. */
export async function fetchStatus(force = false): Promise<ServiceStatus> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline) return { ai: false, accounts: false };
  if (!force && cachedStatus && Date.now() - cachedStatus.at < 60_000) return cachedStatus.value;
  try {
    const res = await fetch("/api/v1/status", { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as Partial<ServiceStatus>;
    const value = { ai: Boolean(body.ai), accounts: Boolean(body.accounts) };
    cachedStatus = { at: Date.now(), value };
    return value;
  } catch {
    return { ai: false, accounts: false };
  }
}
