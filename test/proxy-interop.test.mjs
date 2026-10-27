import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/macd-mcp.mjs", import.meta.url));
const json = JSON.stringify;
const reply = (id, result) => ({ jsonrpc: "2.0", id, result });
const lines = messages => messages.map(json).join("\n") + "\n";

async function deadline(pending, ms, label) {
  let timer;
  try {
    return await Promise.race([pending, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms} ms`)), ms);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

// Actual loopback HTTP and actual CLI; no injected fetch, inherited environment,
// public endpoint, DNS name, package install, credentials or external client.
async function exchange(messages, respond) {
  const seen = [];
  let child, closed, fail;
  const failed = new Promise((_, reject) => { fail = reject; });
  const server = http.createServer((req, res) => {
    void (async () => {
      let body = "";
      req.setEncoding("utf8");
      for await (const part of req) body += part;
      const packet = {
        method: req.method, path: req.url,
        contentType: req.headers["content-type"], accept: req.headers.accept,
        session: req.headers["mcp-session-id"], body,
      };
      seen.push(packet);
      await respond(req, res, JSON.parse(body), seen.length - 1);
    })().catch(error => { fail(error); res.destroy(); });
  });
  server.on("error", fail);
  try {
    const run = (async () => {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      child = spawn(process.execPath, [cli], {
        env: {
          MACD_MCP_URL: `http://127.0.0.1:${server.address().port}/mcp`,
          MACD_MCP_ALLOW_LOOPBACK_HTTP: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      closed = new Promise(resolve => child.once("close", (code, signal) => resolve({ code, signal })));
      child.on("error", fail);
      child.stdin.on("error", fail);
      let stdout = "", stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", part => { stdout += part; });
      child.stderr.on("data", part => { stderr += part; });
      child.stdin.end(lines(messages));
      const exit = await closed;
      assert.deepEqual(exit, { code: 0, signal: null }, `CLI exit; stderr=${stderr}`);
      assert.equal(stderr, "", "protocol output must not contain diagnostics");
      return { stdout, seen };
    })();
    return await deadline(Promise.race([run, failed]), 6000, "loopback HTTP / real CLI exchange");
  } finally {
    // Also runs on assertion, spawn, handler, listen and timeout failures.
    try {
      if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      if (closed) await deadline(closed, 1500, "CLI cleanup after SIGKILL");
    } finally {
      const stopped = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await deadline(stopped, 1500, "loopback HTTP server cleanup");
    }
  }
}

function expectedPackets(messages, sessions) {
  return messages.map((message, index) => ({
    method: "POST", path: "/mcp", contentType: "application/json",
    accept: "application/json, text/event-stream",
    session: sessions[index], body: json(message),
  }));
}

async function fragmentedSse(res, payload) {
  const bytes = Buffer.from(`: offline heartbeat\r\n\r\nevent: message\r\ndata: ${payload}\r\n\r\n`);
  const accent = bytes.indexOf(Buffer.from("é"));
  const globe = bytes.indexOf(Buffer.from("🌍"));
  assert.ok(accent > 0 && globe > accent);
  // Deliberately cut inside data:, a two-byte character, a four-byte character
  // and the final CRLF. Buffers, rather than JS string slices, go onto HTTP.
  const cuts = [1, bytes.indexOf(Buffer.from("data:")) + 3,
    accent + 1, accent + 2, globe + 1, globe + 3, bytes.length - 1, bytes.length];
  const chunks = [];
  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
  let start = 0;
  for (const end of cuts) {
    const chunk = bytes.subarray(start, end);
    chunks.push(chunk);
    await new Promise((resolve, reject) => {
      res.write(chunk, error => error ? reject(error) : resolve());
    });
    // Yield to I/O between HTTP writes; no timing-based sleeps. The OS/fetch
    // may coalesce reads, so this asserts server byte writes, not fetch reads.
    await new Promise(resolve => setImmediate(resolve));
    start = end;
  }
  res.end();
  assert.equal(chunks.length, 8);
  assert.deepEqual(Buffer.concat(chunks), bytes);
  return chunks.length;
}

test("real CLI: initialize, 202 silence, fragmented UTF-8 SSE, 404 without retry, fresh session", { timeout: 10000 }, async () => {
  // A fixture protocol version, not a declaration of version conformance.
  const protocolVersion = "2025-03-26";
  const initialize = id => ({ jsonrpc: "2.0", id, method: "initialize", params: {
    protocolVersion, capabilities: {}, clientInfo: { name: "offline-fixture", version: "0.0.0" },
  } });
  const initialized = { jsonrpc: "2.0", method: "notifications/initialized" };
  const list = id => ({ jsonrpc: "2.0", id, method: "tools/list", params: {} });
  const requests = [initialize(0), initialized, list("list-é🌍"), list("expired"),
    initialize("fresh-initialize"), initialized, list(4)];
  const initializedResult = {
    protocolVersion, capabilities: { tools: {} },
    serverInfo: { name: "fictional-interop-fixture", version: "0.0.0" },
  };
  const inventory = { tools: [{
    name: "echo_constellation", description: "Repère étoilé 🌍 — herramienta ficticia",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  }] };
  const expected = [reply(0, initializedResult), reply("list-é🌍", inventory),
    { jsonrpc: "2.0", id: "expired", error: { code: -32603, message: "Proxy error: endpoint 404" } },
    reply("fresh-initialize", initializedResult), reply(4, inventory)];
  const statuses = [], fragments = [];
  const { stdout, seen } = await exchange(requests, async (req, res, msg, index) => {
    assert.ok(index < requests.length, "no extra POST or automatic retry");
    if (index === 0 || index === 4) {
      statuses.push(200);
      res.writeHead(200, { "content-type": "application/json", "mcp-session-id": index === 0 ? "fixture-old" : "fixture-fresh" });
      res.end(json(reply(msg.id, { ...initializedResult, protocolVersion: msg.params.protocolVersion })));
    } else if (index === 1 || index === 5) {
      statuses.push(202);
      res.writeHead(202).end(); // No JSON response to notifications/initialized.
    } else if (index === 3) {
      statuses.push(404);
      res.writeHead(404, { "mcp-session-id": "must-be-ignored" }).end("fictional expired session body");
    } else {
      statuses.push(200);
      fragments.push(await fragmentedSse(res, json(reply(msg.id, inventory))));
    }
  });
  assert.equal(seen.length, 7, "exact HTTP request count (including both notifications)");
  assert.deepEqual(seen, expectedPackets(requests,
    [undefined, "fixture-old", "fixture-old", "fixture-old", undefined, "fixture-fresh", "fixture-fresh"]));
  assert.deepEqual(statuses, [200, 202, 200, 404, 200, 202, 200]);
  assert.deepEqual(fragments, [8, 8]);
  assert.equal(stdout, lines(expected), "exact JSON text lines, no SSE metadata, extra replies or error-body leakage");
  assert.deepEqual(stdout.slice(0, -1).split("\n").map(JSON.parse), expected);
});

for (const type of ["application/json", "text/event-stream"]) {
  test(`real CLI characterizes unvalidated invalid JSON from ${type}`, { timeout: 10000 }, async () => {
    const requests = [91, 92].map(id => ({ jsonrpc: "2.0", id, method: "tools/list", params: {} }));
    const invalid = '{"jsonrpc":"2.0","id":91,"result":';
    const valid = reply(92, { tools: [] });
    const { stdout, seen } = await exchange(requests, (req, res, msg, index) => {
      assert.ok(index < 2, "no response-validation retry");
      const payload = index === 0 ? invalid : json(valid);
      res.writeHead(200, { "content-type": type });
      res.end(type === "text/event-stream" ? `event: message\ndata: ${payload}\n\n` : payload);
    });
    assert.equal(seen.length, 2);
    assert.deepEqual(seen, expectedPackets(requests, [undefined, undefined]));
    // This is existing behavior, NOT protocol compliance: the malformed text
    // reaches stdout unchanged; no local JSON-RPC parse error is manufactured.
    assert.equal(stdout, `${invalid}\n${json(valid)}\n`);
    const output = stdout.slice(0, -1).split("\n");
    assert.equal(output.length, 2);
    assert.throws(() => JSON.parse(output[0]), SyntaxError);
    assert.deepEqual(JSON.parse(output[1]), valid);
  });
}
