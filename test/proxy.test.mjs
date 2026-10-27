import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { parseSseEvents, forward, runProxy } from "../lib/proxy.mjs";

test("parseSseEvents: extracts data payloads, skips comments and heartbeats", () => {
  const body = ": keepalive\n\nevent: message\ndata: {\"a\":1}\n\ndata: {\"b\":\ndata: 2}\n\n";
  assert.deepEqual(parseSseEvents(body), ['{"a":1}', '{"b":\n2}']);
});

test("forward: posts the message and parses an SSE answer", async () => {
  const seen = {};
  const fetchImpl = async (url, opts) => {
    seen.url = url; seen.body = JSON.parse(opts.body); seen.headers = opts.headers;
    return new Response('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n', {
      headers: { "content-type": "text/event-stream", "mcp-session-id": "s-123" },
    });
  };
  const r = await forward("https://example.invalid/mcp", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, undefined, fetchImpl);
  assert.equal(r.messages.length, 1);
  assert.deepEqual(JSON.parse(r.messages[0]).result, { ok: true });
  assert.equal(r.sessionId, "s-123");
  assert.match(seen.headers.accept, /text\/event-stream/);
});

test("forward: 202 (notification accepted) yields no messages", async () => {
  const fetchImpl = async () => new Response(null, { status: 202 });
  const r = await forward("https://example.invalid/mcp", { jsonrpc: "2.0", method: "notifications/initialized" }, undefined, fetchImpl);
  assert.deepEqual(r.messages, []);
});

test("forward: plain JSON answer passes through; session header is sent when held", async () => {
  const seen = {};
  const fetchImpl = async (url, opts) => {
    seen.headers = opts.headers;
    return new Response('{"jsonrpc":"2.0","id":2,"result":[]}', { headers: { "content-type": "application/json" } });
  };
  const r = await forward("https://example.invalid/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list" }, "s-123", fetchImpl);
  assert.equal(seen.headers["mcp-session-id"], "s-123");
  assert.deepEqual(JSON.parse(r.messages[0]).result, []);
});

test("forward: HTTP error throws with the status", async () => {
  const fetchImpl = async () => new Response("boom", { status: 500 });
  await assert.rejects(forward("https://example.invalid/mcp", { id: 1 }, undefined, fetchImpl), /endpoint 500/);
});

async function runProxyOnce(lines, fetchImpl) {
  const { PassThrough } = await import("node:stream");
  const input = new PassThrough(), output = new PassThrough();
  let out = "";
  output.on("data", (c) => (out += c));
  const p = runProxy({ input, output, endpoint: "https://example.invalid/mcp", fetchImpl });
  for (const l of lines) input.write(l + "\n");
  input.end();
  await p;
  return out.trim().split("\n").filter(Boolean).map((s) => JSON.parse(s));
}

test("runProxy: bad JSON line gets a -32700 parse error with null id", async () => {
  const fetchImpl = async () => { throw new Error("must not be called"); };
  const [res] = await runProxyOnce(["not json"], fetchImpl);
  assert.equal(res.error.code, -32700);
  assert.equal(res.id, null);
});

test("runProxy: endpoint failure gets a -32603 error carrying the request id", async () => {
  const fetchImpl = async () => new Response("bad gateway", { status: 502 });
  const [res] = await runProxyOnce(['{"jsonrpc":"2.0","id":7,"method":"tools/list"}'], fetchImpl);
  assert.equal(res.error.code, -32603);
  assert.equal(res.id, 7);
});

test("bin end-to-end: real subprocess against a mock streamable-HTTP server", async () => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const msg = JSON.parse(body);
      if (msg.method === "notifications/initialized") { res.writeHead(202).end(); return; }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { echo: msg.method } })}\n\n`);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  try {
    const child = spawn(process.execPath, ["bin/macd-mcp.mjs"], { env: { ...process.env, MACD_MCP_URL: url, MACD_MCP_ALLOW_LOOPBACK_HTTP: "1" } });
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    child.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n');
    child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    child.stdin.write('{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n');
    child.stdin.end();
    await new Promise((r, j) => { child.on("exit", r); child.on("error", j); setTimeout(() => child.kill(), 8000); });
    const msgs = out.trim().split("\n").map((s) => JSON.parse(s));
    assert.equal(msgs.length, 2, "notification must not produce a reply");
    assert.deepEqual(msgs[0].result, { echo: "initialize" });
    assert.deepEqual(msgs[1].result, { echo: "tools/list" });
  } finally {
    server.close();
  }
});
