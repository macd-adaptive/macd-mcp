import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { forward, parseSseEvents, runProxy } from "../lib/proxy.mjs";

const endpoint = "https://example.invalid/mcp";
function response(body = "", { status = 200, type, session } = {}) {
  const headers = new Map();
  if (type) headers.set("content-type", type);
  if (session) headers.set("mcp-session-id", session);
  return { status, ok: status >= 200 && status < 300, headers, text: async () => body };
}
async function run(chunks, fetchImpl) {
  let stdout = "";
  const output = new Writable({ write(chunk, encoding, done) { stdout += chunk; done(); } });
  await runProxy({ input: Readable.from(chunks), output, endpoint, fetchImpl });
  return stdout ? stdout.trimEnd().split("\n").map(JSON.parse) : [];
}

// No live network: every request in this file uses an injected fetch.
test("SSE accepts CRLF, metadata, heartbeats and an unterminated final event", () => {
  assert.deepEqual(parseSseEvents(': heartbeat\r\nevent: message\r\nid: 4\r\ndata: {"id":1}\r\n\r\nretry: 1000\r\ndata: {"id":2}'), ['{"id":1}', '{"id":2}']);
  assert.deepEqual(parseSseEvents(": heartbeat\n\nevent: ping\n\n"), []);
});

test("forward preserves method, params, id zero and exact POST target", async () => {
  const msg = { jsonrpc: "2.0", id: 0, method: "tools/call", params: { name: "get_faq", arguments: { query: "a&b", lang: "es" } } };
  let calls = 0;
  const result = await forward(endpoint, msg, undefined, async (url, opts) => {
    calls++;
    assert.equal(url, endpoint);
    assert.equal(opts.method, "POST");
    assert.equal(opts.headers["content-type"], "application/json");
    assert.equal(opts.headers["mcp-session-id"], undefined);
    assert.deepEqual(JSON.parse(opts.body), msg);
    return response('  {"id":0,"result":{}}\n');
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { messages: ['{"id":0,"result":{}}'], sessionId: undefined });
});

for (const status of [202, 204]) {
  test(`forward ${status} neither reads a body nor loses a returned session`, async () => {
    const result = await forward(endpoint, { method: "notifications/initialized" }, undefined, async () => ({
      ...response("", { status, session: "new-session" }),
      text: async () => { assert.fail("body must not be read"); },
    }));
    assert.deepEqual(result, { messages: [], sessionId: "new-session" });
  });
}

test("forward accepts empty success bodies and SSE content-type parameters", async () => {
  const empty = await forward(endpoint, { id: 1 }, undefined, async () => response(" \r\n"));
  assert.deepEqual(empty.messages, []);
  const sse = await forward(endpoint, { id: 2 }, undefined, async () => response('data: {"id":2}\n\ndata: {"id":3}\n\n', { type: "text/event-stream; charset=utf-8" }));
  assert.deepEqual(sse.messages, ['{"id":2}', '{"id":3}']);
});

test("HTTP errors bound diagnostic text to 200 characters", async () => {
  await assert.rejects(forward(endpoint, { id: 1 }, undefined, async () => response("x".repeat(201), { status: 503 })),
    (err) => err.message === `endpoint 503: ${"x".repeat(200)}`);
});

test("proxy handles split input, blank lines and CRLF without duplicate requests", async () => {
  const seen = [];
  const messages = await run([' \r\n{"jsonrpc":"2.0","id":', '1,"method":"tools/list"}\r\n\n{"id":2}', '\n'], async (url, opts) => {
    const msg = JSON.parse(opts.body); seen.push(msg.id);
    return response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: {} }));
  });
  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(messages.map(m => m.id), [1, 2]);
});

test("proxy reuses session through absent headers and replaces it when rotated", async () => {
  const seen = [];
  const messages = await run(['{"id":1}\n{"id":2}\n{"id":3}\n{"id":4}\n'], async (url, opts) => {
    seen.push(opts.headers["mcp-session-id"]);
    const { id } = JSON.parse(opts.body);
    return response(JSON.stringify({ id, result: {} }), { session: id === 1 ? "first" : id === 3 ? "rotated" : undefined });
  });
  assert.deepEqual(seen, [undefined, "first", "first", "rotated"]);
  assert.equal(messages.length, 4);
});

test("proxy continues after parse and network failures, preserving zero and string ids", async () => {
  const seen = [];
  const messages = await run(['not-json\n{"id":0}\n{"id":"ok"}\n'], async (url, opts) => {
    const { id } = JSON.parse(opts.body); seen.push(id);
    if (id === 0) throw new Error("network down");
    return response(JSON.stringify({ jsonrpc: "2.0", id, result: true }));
  });
  assert.deepEqual(seen, [0, "ok"]);
  assert.deepEqual(messages, [
    { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: stdin line is not JSON" } },
    { jsonrpc: "2.0", id: 0, error: { code: -32603, message: "Proxy error: network down" } },
    { jsonrpc: "2.0", id: "ok", result: true },
  ]);
});

test("proxy awaits each request instead of forwarding requests concurrently", async () => {
  const seen = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let firstStarted;
  const started = new Promise(resolve => { firstStarted = resolve; });
  const pending = run(['{"id":1}\n{"id":2}\n'], async (url, opts) => {
    const { id } = JSON.parse(opts.body); seen.push(id);
    if (id === 1) { firstStarted(); await gate; }
    return response(JSON.stringify({ id, result: {} }));
  });
  await started;
  await new Promise(resolve => setImmediate(resolve));
  try { assert.deepEqual(seen, [1]); } finally { release(); }
  assert.deepEqual((await pending).map(m => m.id), [1, 2]);
});
