import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import {
  DEFAULT_MAX_LINE_BYTES, DEFAULT_MAX_RESPONSE_BYTES, forward, runProxy,
} from "../lib/proxy.mjs";

const endpoint = "https://example.invalid/mcp";
const reply = id => JSON.stringify({ jsonrpc: "2.0", id, result: true });
function streamResponse(chunks, { status = 200, headers = {} } = {}) {
  let index = 0, cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (index === chunks.length) controller.close();
      else controller.enqueue(Buffer.from(chunks[index++]));
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const response = new Response(body, { status, headers });
  // The proxy must use the bounded stream, never a full-body convenience API.
  response.text = () => assert.fail("unbounded response.text()");
  response.arrayBuffer = () => assert.fail("unbounded response.arrayBuffer()");
  return { response, read: () => index, cancelled: () => cancelled };
}
async function run(chunks, fetchImpl, options = {}) {
  let stdout = "";
  const output = new Writable({ write(chunk, encoding, done) { stdout += chunk; done(); } });
  await runProxy({ input: Readable.from(chunks), output, endpoint, fetchImpl, ...options });
  return stdout ? stdout.trimEnd().split("\n").map(JSON.parse) : [];
}

for (const url of [
  "http://localhost/mcp", "http://127.0.0.1/mcp", "http://[::1]/mcp",
  "http://example.invalid/mcp", "ftp://localhost/mcp", "not a URL",
  "https://user:secret@example.invalid/mcp", "https://@example.invalid/mcp",
  "https://user@example.invalid/mcp",
]) {
  test(`default URL policy rejects ${url} before fetching`, async () => {
    let calls = 0;
    await assert.rejects(forward(url, { id: 1 }, "session-secret", async () => { calls++; }));
    assert.equal(calls, 0);
  });
}
for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
  test(`explicit HTTP opt-in allows literal ${host} with a port`, async () => {
    const url = `http://${host}:1234/mcp`;
    let calls = 0;
    const result = await forward(url, { id: 1 }, undefined, async (target, opts) => {
      calls++;
      assert.equal(target, url);
      assert.equal(opts.redirect, "error");
      return new Response(reply(1));
    }, undefined, { allowLoopbackHttp: true });
    assert.equal(calls, 1);
    assert.equal(JSON.parse(result.messages[0]).id, 1);
  });
}
for (const host of [
  "example.invalid", "localhost.evil.invalid", "localhost.", "127.0.0.2", "127.1",
  "2130706433", "0x7f000001", "0177.0.0.1", "[::ffff:127.0.0.1]", "%6cocalhost",
  "user:secret@localhost", "@127.0.0.1",
]) {
  test(`HTTP opt-in still rejects ${host} before fetching`, async () => {
    let calls = 0;
    await assert.rejects(forward(`http://${host}/mcp`, { id: 1 }, undefined, async () => { calls++; }, undefined, { allowLoopbackHttp: true }));
    assert.equal(calls, 0);
  });
}

test("runProxy rejects an insecure endpoint before consuming input", async () => {
  let read = false, fetched = false;
  async function* input() { read = true; yield '{"id":1}\n'; }
  await assert.rejects(runProxy({
    input: input(), output: new Writable({ write(c, e, cb) { cb(); } }),
    endpoint: "http://example.invalid/mcp", allowLoopbackHttp: true,
    fetchImpl: async () => { fetched = true; },
  }), /requires HTTPS/);
  assert.equal(read, false);
  assert.equal(fetched, false);
});

test("redirect failures neither retry the POST nor leak client/session/body in diagnostics", async () => {
  const seen = [];
  const messages = await run(['{"id":0,"params":{"private":"client-secret"}}\n'], async (target, opts) => {
    seen.push(target);
    assert.equal(opts.redirect, "error");
    assert.match(opts.body, /client-secret/);
    throw new Error("redirect to https://user:credential@evil.invalid/client-secret");
  });
  assert.deepEqual(seen, [endpoint]);
  assert.deepEqual(messages, [{ jsonrpc: "2.0", id: 0, error: { code: -32603, message: "Proxy error: endpoint request failed" } }]);
});

test("HTTP errors cancel without reading or exposing an arbitrary endpoint payload", async () => {
  const streamed = streamResponse(["secret".repeat(1000)], { status: 503 });
  await assert.rejects(forward(endpoint, { id: 1 }, undefined, async () => streamed.response), err => err.message === "endpoint 503");
  assert.equal(streamed.read(), 0);
  assert.equal(streamed.cancelled(), true);
});

for (const notification of [false, true]) {
  test(`404 clears the held session without retry, including notification=${notification}`, async () => {
    const seen = [];
    const middle = notification ? { method: "notifications/initialized" } : { id: 2 };
    const messages = await run([`${JSON.stringify({ id: 1 })}\n${JSON.stringify(middle)}\n{"id":3}\n{"id":4}\n`], async (url, opts) => {
      const msg = JSON.parse(opts.body);
      seen.push({ id: msg.id, session: opts.headers["mcp-session-id"] });
      if (seen.length === 2) return new Response("private failure", { status: 404, headers: { "mcp-session-id": "stale-replacement" } });
      return new Response(reply(msg.id), { headers: msg.id === 1 ? { "mcp-session-id": "old" } : msg.id === 3 ? { "mcp-session-id": "fresh" } : {} });
    });
    assert.deepEqual(seen, [
      { id: 1, session: undefined }, { id: notification ? undefined : 2, session: "old" },
      { id: 3, session: undefined }, { id: 4, session: "fresh" },
    ]);
    assert.deepEqual(messages.map(m => m.id), notification ? [1, 3, 4] : [1, 2, 3, 4]);
    if (!notification) assert.equal(messages[1].error.message, "Proxy error: endpoint 404");
  });
}

for (const failure of ["HTTP", "network", "response size", "timeout"]) {
  test(`notification ${failure} failures produce no JSON-RPC error; malformed JSON retains null id`, async () => {
    const messages = await run(['{"method":"notifications/initialized"}\nnot-json\n{"id":0}\n{"id":null}\n'], async () => {
      if (failure === "HTTP") return new Response("private", { status: 500 });
      if (failure === "network") throw new Error("private");
      if (failure === "timeout") { const err = new Error("private"); err.name = "TimeoutError"; throw err; }
      return new Response("x".repeat(33));
    }, { maxResponseBytes: 32 });
    assert.equal(messages.length, 3);
    assert.deepEqual(messages.map(m => m.id), [null, 0, null]);
    assert.deepEqual(messages.map(m => m.error.code), [-32700, -32603, -32603]);
    assert.ok(messages.every(m => !m.error.message.includes("private")));
  });
}

test("stdin default is one MiB per line, with recovery in the same huge chunk", async () => {
  assert.equal(DEFAULT_MAX_LINE_BYTES, 1024 * 1024);
  const seen = [];
  const messages = await run([Buffer.from(' '.repeat(DEFAULT_MAX_LINE_BYTES + 1) + '\n{"id":7}\n')], async (url, opts) => {
    seen.push(JSON.parse(opts.body).id); return new Response(reply(7));
  });
  assert.deepEqual(seen, [7]);
  assert.equal(messages[0].id, null);
  assert.equal(messages[0].error.code, -32700);
  assert.equal(messages[1].id, 7);
});

test("many small stdin lines in one huge chunk are limited per line, not per chunk", async () => {
  let calls = 0;
  const messages = await run([Buffer.from('{"id":1}\n'.repeat(300))], async () => {
    calls++; return new Response(reply(1));
  }, { maxLineBytes: 8 });
  assert.equal(calls, 300);
  assert.equal(messages.length, 300);
  assert.ok(messages.every(m => m.result));
});

test("stdin byte limit covers a multibyte line split across chunks and resynchronizes", async () => {
  const seen = [];
  const messages = await run([Buffer.from('{"id":"é'), Buffer.from('é"}'), Buffer.from('\n{"id":2}\n')], async (url, opts) => {
    seen.push(JSON.parse(opts.body).id); return new Response(reply(2));
  }, { maxLineBytes: 12 });
  assert.deepEqual(seen, [2]);
  assert.equal(messages[0].error.code, -32700);
  assert.equal(messages[1].id, 2);
});

test("stdin preserves split UTF-8, accepts the exact byte boundary and a final line without LF", async () => {
  const encoded = Buffer.from('{"id":"é🌍"}');
  const seen = [];
  const messages = await run([...encoded].map(byte => Buffer.from([byte])), async (url, opts) => {
    seen.push(JSON.parse(opts.body).id); return new Response(reply("é🌍"));
  }, { maxLineBytes: encoded.length });
  assert.deepEqual(seen, ["é🌍"]);
  assert.equal(messages[0].id, "é🌍");
});

for (const final of ['{"id":', "x".repeat(33)]) {
  test(`incomplete final stdin line is rejected without forwarding (${final.length} bytes)`, async () => {
    let calls = 0;
    const messages = await run([final], async () => { calls++; }, { maxLineBytes: 32 });
    assert.equal(calls, 0);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, null);
    assert.equal(messages[0].error.code, -32700);
  });
}

for (const type of ["application/json", "text/event-stream"]) {
  test(`${type} response limit counts total bytes across chunks, cancels, and prints no partial response`, async () => {
    const streamed = streamResponse(['data: {"id":1}\n\n', "x".repeat(17), "not read"], { headers: { "content-type": type, "content-length": "1" } });
    const messages = await run(['{"id":1}\n'], async () => streamed.response, { maxResponseBytes: 32 });
    assert.equal(streamed.read(), 2);
    assert.equal(streamed.cancelled(), true);
    assert.deepEqual(messages, [{ jsonrpc: "2.0", id: 1, error: { code: -32603, message: "Proxy error: response exceeds 32 bytes" } }]);
  });
}

test("default response cap is two MiB, also enforced on a single large stream chunk", async () => {
  assert.equal(DEFAULT_MAX_RESPONSE_BYTES, 2 * 1024 * 1024);
  const streamed = streamResponse([Buffer.alloc(DEFAULT_MAX_RESPONSE_BYTES + 1), "not read"]);
  await assert.rejects(forward(endpoint, { id: 1 }, undefined, async () => streamed.response), /response exceeds 2097152 bytes/);
  assert.equal(streamed.read(), 1);
  assert.equal(streamed.cancelled(), true);
});

test("response limit accepts exact bytes and decodes UTF-8 split across stream chunks", async () => {
  const body = Buffer.from(reply("é🌍"));
  const streamed = streamResponse([...body].map(byte => Buffer.from([byte])));
  const result = await forward(endpoint, { id: 1 }, undefined, async () => streamed.response, undefined, { maxResponseBytes: body.length });
  assert.equal(JSON.parse(result.messages[0]).id, "é🌍");
});

test("response limit counts UTF-8 bytes rather than characters", async () => {
  const body = reply("é🌍");
  await assert.rejects(forward(endpoint, { id: 1 }, undefined, async () => new Response(body), undefined, { maxResponseBytes: body.length }), /response exceeds/);
});

test("response timeout also aborts a stalled body and cancels its reader", async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { cancelled = true; } });
  // AbortSignal.timeout is unref'ed; keep this injected mock alive until abort.
  const keepAlive = setInterval(() => {}, 100);
  try {
    await assert.rejects(forward(endpoint, { id: 1 }, undefined, async () => new Response(body), 20), /did not answer within 20 ms/);
    assert.equal(cancelled, true);
  } finally { clearInterval(keepAlive); }
});

test("slow stdout prevents subsequent forwarding until the prior reply is flushed", async () => {
  const seen = [];
  let release, firstWrite;
  const started = new Promise(resolve => { firstWrite = resolve; });
  const output = new Writable({ highWaterMark: 1, write(chunk, encoding, done) {
    if (!release) { release = done; firstWrite(); } else done();
  } });
  const pending = runProxy({ input: Readable.from(['{"id":1}\n{"id":2}\n']), output, endpoint, fetchImpl: async (url, opts) => {
    const { id } = JSON.parse(opts.body); seen.push(id); return new Response(reply(id));
  } });
  await started;
  await new Promise(resolve => setImmediate(resolve));
  try { assert.deepEqual(seen, [1]); assert.equal(output.writableLength, Buffer.byteLength(reply(1) + "\n")); }
  finally { release(); }
  await pending;
  assert.deepEqual(seen, [1, 2]);
  assert.equal(output.writableLength, 0);
});

for (const options of [{ maxLineBytes: 0 }, { maxLineBytes: 1.5 }, { maxResponseBytes: -1 }, { maxResponseBytes: Infinity }]) {
  test(`invalid byte limits fail before forwarding: ${String(Object.values(options)[0])}`, async () => {
    let calls = 0;
    await assert.rejects(run(['{"id":1}\n'], async () => { calls++; }, options), /positive safe integer/);
    assert.equal(calls, 0);
  });
}

test("a successful HTTP body cannot manufacture an error reply to a notification", async () => {
  const messages = await run(['{"method":"notifications/initialized"}\n{"id":1}\n'], async (url, opts) => {
    const msg = JSON.parse(opts.body);
    if (!Object.hasOwn(msg, "id")) return new Response('{"jsonrpc":"2.0","id":null,"error":{"code":-32603,"message":"private"}}', { headers: { "mcp-session-id": "notification-session" } });
    assert.equal(opts.headers["mcp-session-id"], "notification-session");
    return new Response(reply(1));
  });
  assert.deepEqual(messages, [JSON.parse(reply(1))]);
});

test("a failed body stream produces a fixed error without its arbitrary failure text", async () => {
  const body = new ReadableStream({ start(controller) { controller.error(new Error("private stream payload")); } });
  const messages = await run(['{"id":1}\n'], async () => new Response(body));
  assert.deepEqual(messages, [{ jsonrpc: "2.0", id: 1, error: { code: -32603, message: "Proxy error: endpoint request failed" } }]);
});

test("a failed stdout write stops forwarding without manufacturing another JSON-RPC reply", async () => {
  const seen = [];
  const output = new Writable({ write(chunk, encoding, done) { done(new Error("closed stdout")); } });
  await assert.rejects(runProxy({ input: Readable.from(['{"id":1}\n{"id":2}\n']), output, endpoint, fetchImpl: async (url, opts) => {
    seen.push(JSON.parse(opts.body).id); return new Response(reply(1));
  } }), /closed stdout/);
  assert.deepEqual(seen, [1]);
});
