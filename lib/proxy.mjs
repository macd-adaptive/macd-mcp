// Stdio <-> streamable-HTTP proxy core for the public MACD MCP endpoint.
// No dependencies, no telemetry, no storage: every line from stdin is one
// JSON-RPC message, forwarded by HTTPS POST, and the answer goes to stdout
// as one line per JSON-RPC message.

export const DEFAULT_ENDPOINT = "https://macd.ie/mcp";

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
    if (line.startsWith(":")) continue; // comment / heartbeat
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length) out.push(data.join("\n"));
  return out;
}

/**
 * Forward one JSON-RPC message to the endpoint.
 * Returns { messages: string[], sessionId: string|undefined }:
 * the JSON-RPC response payloads to print, and the session id if the server set one.
 */
export async function forward(endpoint, msg, sessionId, fetchImpl = fetch, timeoutMs = 60_000) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  let res;
  try {
    res = await fetchImpl(endpoint, { method: "POST", headers, body: JSON.stringify(msg), signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err && err.name === "TimeoutError") throw new Error(`endpoint did not answer within ${timeoutMs} ms`);
    throw err;
  }
  const newSession = res.headers.get("mcp-session-id") ?? undefined;
  if (res.status === 202 || res.status === 204) return { messages: [], sessionId: newSession };
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`endpoint ${res.status}: ${text.slice(0, 200)}`);
  }
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) return { messages: parseSseEvents(text), sessionId: newSession };
  return { messages: text.trim() ? [text.trim()] : [], sessionId: newSession };
}

/** JSON-RPC error object for a message we could not deliver. */
export function errorResponse(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

/**
 * Run the proxy loop: read newline-delimited JSON-RPC from `input`,
 * write newline-delimited JSON-RPC to `output`. Sequential on purpose:
 * stdio clients expect answers in order and the endpoint is cheap.
 */
export async function runProxy({ input, output, endpoint = DEFAULT_ENDPOINT, fetchImpl }) {
  let sessionId;
  let buf = "";
  for await (const chunk of input) {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        output.write(errorResponse(null, -32700, "Parse error: stdin line is not JSON") + "\n");
        continue;
      }
      try {
        const { messages, sessionId: sid } = await forward(endpoint, msg, sessionId, fetchImpl);
        if (sid) sessionId = sid;
        for (const m of messages) output.write(m + "\n");
      } catch (err) {
        output.write(errorResponse(msg.id, -32603, `Proxy error: ${err.message}`) + "\n");
      }
    }
  }
}
