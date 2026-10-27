// Boundary catalog (idea 12): lock in how the proxy treats input at the edges,
// so a future change cannot silently alter what reaches the endpoint or stdout.
import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { runProxy, validateEndpoint, parseSseEvents, forward } from "../lib/proxy.mjs";

const okReply = { jsonrpc: "2.0", id: 1, result: {} };
const mkFetch = (seen) => async (url, opts) => {
  seen.push(JSON.parse(opts.body));
  return new Response(JSON.stringify(okReply), { status: 200, headers: { "content-type": "application/json" } });
};
const mkOutput = (out) => ({ once() {}, removeListener() {}, write(l, cb) { out.push(l); cb(); } });

test("non-object JSON stdin lines are forwarded verbatim as notifications, with no reply manufactured", async () => {
  const seen = [], out = [];
  const input = Readable.from((async function* () { yield "null\n[1,2]\n\"str\"\n42\ntrue\n"; })());
  await runProxy({ input, output: mkOutput(out), endpoint: "https://macd.ie/mcp", fetchImpl: mkFetch(seen) });
  assert.deepEqual(seen, [null, [1, 2], "str", 42, true], "every line is POSTed verbatim");
  assert.deepEqual(out, [], "no JSON-RPC reply is manufactured for messages without an id");
});

test("an explicit null id still expects a reply; an absent id does not", async () => {
  const seen = [], out = [];
  const input = Readable.from((async function* () { yield '{"jsonrpc":"2.0","id":null,"method":"m"}\n{"jsonrpc":"2.0","method":"m"}\n'; })());
  await runProxy({ input, output: mkOutput(out), endpoint: "https://macd.ie/mcp", fetchImpl: mkFetch(seen) });
  assert.equal(seen.length, 2);
  assert.equal(out.length, 1, "only the null-id message gets the endpoint reply");
});

test("validateEndpoint rejects untrimmed input and backslashes before any fetch", async () => {
  for (const url of ["https://example.invalid/mcp ", " https://example.invalid/mcp", "https://example.invalid\\mcp", "https://example.invalid/mcp\t"]) {
    let calls = 0;
    await assert.rejects(forward(url, { id: 1 }, null, async () => { calls++; }));
    assert.equal(calls, 0, `no fetch for ${JSON.stringify(url)}`);
  }
});

test("parseSseEvents boundary: data-only stream, blank-line separation and leading-colon comments", () => {
  assert.deepEqual(parseSseEvents(""), []);
  assert.deepEqual(parseSseEvents("data: a"), ["a"], "unterminated final event still lands");
  assert.deepEqual(parseSseEvents("data: a\ndata: b\n\ndata: c\n\n"), ["a\nb", "c"], "multi-line data joins with LF");
  assert.deepEqual(parseSseEvents(": heartbeat\n\n: again"), [], "comments never become events");
  assert.deepEqual(parseSseEvents("event: message\n\n"), [], "metadata without data is dropped");
});

test("checkLimit boundaries: 1 is valid, 0/negative/fractional/unsafe are not", async () => {
  const seen = [];
  const f = mkFetch(seen);
  await forward("https://macd.ie/mcp", { id: 1 }, null, f, 1000, { maxResponseBytes: 1 }).catch(() => {});
  assert.ok(seen.length === 1, "maxResponseBytes=1 is accepted at validation");
  for (const bad of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(forward("https://macd.ie/mcp", { id: 1 }, null, f, 1000, { maxResponseBytes: bad }), /positive safe integer/);
  }
});
