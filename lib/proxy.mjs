// Stdio <-> streamable-HTTP proxy core. No dependencies, telemetry or storage.
import { Buffer } from "node:buffer";

export const DEFAULT_ENDPOINT = "https://macd.ie/mcp";
export const DEFAULT_MAX_LINE_BYTES = 1024 * 1024;
export const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function checkLimit(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`);
}

/** HTTP is restricted to an explicit, literal loopback override. */
export function validateEndpoint(endpoint, { allowLoopbackHttp = false } = {}) {
  let url;
  try { url = new URL(endpoint); } catch { throw new Error("endpoint must be a valid HTTPS URL"); }
  const authority = typeof endpoint === "string" ? endpoint.match(/^[a-z]+:\/\/([^/?#]*)/i)?.[1] : undefined;
  if (!authority || endpoint !== endpoint.trim() || endpoint.includes("\\") || url.username || url.password || authority.includes("@")) {
    throw new Error("endpoint must be a URL without userinfo");
  }
  if (url.protocol === "https:") return;
  if (allowLoopbackHttp === true && url.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/.test(authority)) return;
  throw new Error("endpoint requires HTTPS; HTTP requires explicit loopback opt-in");
}

/** Parse an SSE body into the list of `data:` payloads (one per event). */
export function parseSseEvents(body) {
  const out = [];
  let data = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line === "") {
      if (data.length) { out.push(data.join("\n")); data = []; }
      continue;
    }
    if (line.startsWith(":")) continue;
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length) out.push(data.join("\n"));
  return out;
}

class ProxyError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

function cancelBody(body) {
  // Cancellation must not wait for a remote peer or disclose its error text.
  try { Promise.resolve(body?.cancel()).catch(() => {}); } catch { /* best effort */ }
}

async function readBoundedBody(res, limit, signal) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const buffer = Buffer.allocUnsafe(limit);
  let length = 0;
  try {
    while (true) {
      let onAbort;
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
      });
      let part;
      try { part = await Promise.race([reader.read(), aborted]); }
      finally { signal.removeEventListener("abort", onAbort); }
      const { done, value } = part;
      if (done) return buffer.toString("utf8", 0, length);
      if (value.byteLength > limit - length) throw new ProxyError(`response exceeds ${limit} bytes`);
      buffer.set(value, length);
      length += value.byteLength;
    }
  } finally {
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* best effort */ }
    reader.releaseLock();
  }
}

/** Forward exactly one POST; never retry or follow redirects. */
export async function forward(endpoint, msg, sessionId, fetchImpl = fetch, timeoutMs = 60_000, {
  allowLoopbackHttp = false, maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
} = {}) {
  validateEndpoint(endpoint, { allowLoopbackHttp });
  checkLimit(maxResponseBytes, "maxResponseBytes");
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST", headers, body: JSON.stringify(msg), signal, redirect: "error",
    });
    const newSession = res.headers.get("mcp-session-id") ?? undefined;
    if (res.status === 202 || res.status === 204) {
      cancelBody(res.body);
      return { messages: [], sessionId: newSession };
    }
    if (!res.ok) {
      cancelBody(res.body);
      throw new ProxyError(`endpoint ${res.status}`, res.status);
    }
    const text = await readBoundedBody(res, maxResponseBytes, signal);
    const type = res.headers.get("content-type") ?? "";
    return { messages: type.includes("text/event-stream") ? parseSseEvents(text) : text.trim() ? [text.trim()] : [], sessionId: newSession };
  } catch (err) {
    if (signal.aborted || err?.name === "TimeoutError") throw new ProxyError(`endpoint did not answer within ${timeoutMs} ms`);
    if (err instanceof ProxyError) throw err;
    throw new ProxyError("endpoint request failed");
  }
}

/** JSON-RPC error object for a message we could not deliver. */
export function errorResponse(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

/** Keep at most limit bytes even if a chunk contains many or oversized lines. */
async function* inputLines(input, limit) {
  const buffer = Buffer.allocUnsafe(limit);
  let length = 0, tooLarge = false;
  for await (const chunk of input) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    let start = 0;
    while (start < bytes.length) {
      const newline = bytes.indexOf(10, start);
      const end = newline < 0 ? bytes.length : newline;
      const size = end - start;
      if (!tooLarge) {
        if (size > limit - length) tooLarge = true;
        else { buffer.set(bytes.subarray(start, end), length); length += size; }
      }
      if (newline < 0) break;
      yield tooLarge ? null : buffer.toString("utf8", 0, length);
      length = 0; tooLarge = false;
      start = newline + 1;
    }
  }
  if (tooLarge || length) yield tooLarge ? null : buffer.toString("utf8", 0, length);
}

// Waiting for the write callback bounds pending stdout, including slow pipes.
function writeLine(output, line) {
  return new Promise((resolve, reject) => {
    const onError = err => reject(err);
    output.once("error", onError);
    try {
      output.write(line + "\n", err => {
        if (err) { reject(err); return; }
        output.removeListener("error", onError);
        resolve();
      });
    } catch (err) {
      output.removeListener("error", onError);
      reject(err);
    }
  });
}

/** Sequential forwarding preserves ordering and session rotation. */
export async function runProxy({ input, output, endpoint = DEFAULT_ENDPOINT, fetchImpl,
  allowLoopbackHttp = false, maxLineBytes = DEFAULT_MAX_LINE_BYTES,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES, timeoutMs = 60_000,
}) {
  validateEndpoint(endpoint, { allowLoopbackHttp });
  checkLimit(maxLineBytes, "maxLineBytes");
  checkLimit(maxResponseBytes, "maxResponseBytes");
  let sessionId;
  for await (const raw of inputLines(input, maxLineBytes)) {
    if (raw === null) {
      await writeLine(output, errorResponse(null, -32700, `Parse error: stdin line exceeds ${maxLineBytes} bytes`));
      continue;
    }
    const line = raw.trim();
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch {
      await writeLine(output, errorResponse(null, -32700, "Parse error: stdin line is not JSON"));
      continue;
    }
    // An absent id denotes a notification. Explicit null and zero are ids.
    const hasId = msg !== null && typeof msg === "object" && Object.hasOwn(msg, "id");
    let messages;
    try {
      const result = await forward(endpoint, msg, sessionId, fetchImpl, timeoutMs, { allowLoopbackHttp, maxResponseBytes });
      if (result.sessionId) sessionId = result.sessionId;
      messages = hasId ? result.messages : [];
    } catch (err) {
      if (err.status === 404) sessionId = undefined;
      messages = hasId ? [errorResponse(msg.id, -32603, `Proxy error: ${err.message}`)] : [];
    }
    for (const message of messages) await writeLine(output, message);
  }
}
