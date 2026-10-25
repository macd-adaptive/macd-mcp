import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import { readFileSync } from "node:fs";

// Real CLI, loopback HTTP only; no call to the public endpoint.
async function runCli(handler, input) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", part => { body += part; });
    req.on("end", () => handler(req, res, JSON.parse(body)));
  });
  let child, timer;
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    child = spawn(process.execPath, [new URL("../bin/macd-mcp.mjs", import.meta.url).pathname], {
      env: { ...process.env, MACD_MCP_URL: `http://127.0.0.1:${server.address().port}/mcp` },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "", stderr = "", stdinError;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", data => { stdout += data; });
    child.stderr.on("data", data => { stderr += data; });
    child.stdin.on("error", error => { stdinError = error; });
    const closed = once(child, "close");
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("CLI timeout after 5 seconds")); }, 5000);
    });
    child.stdin.end(input);
    const [code, signal] = await Promise.race([closed, timeout]);
    assert.equal(stdinError, undefined);
    assert.equal(code, 0, stderr);
    assert.equal(signal, null);
    assert.equal(stderr, "");
    assert.ok(stdout.endsWith("\n"), "complete newline-delimited output");
    return stdout.trimEnd().split("\n").map(JSON.parse);
  } finally {
    clearTimeout(timer);
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close");
      child.kill("SIGKILL");
      await closed;
    }
    const closed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await closed;
  }
}

test("CLI rotates sessions through 204 notifications and prints only JSON replies", { timeout: 8000 }, async () => {
  const seen = [];
  const replies = await runCli((req, res, msg) => {
    seen.push({ method: req.method, path: req.url, session: req.headers["mcp-session-id"] });
    if (msg.method === "initialize") {
      res.writeHead(200, { "content-type": "application/json", "mcp-session-id": "session-a" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 0, result: { ready: true } }));
    } else if (msg.method === "notifications/initialized") {
      res.writeHead(204, { "mcp-session-id": "session-b" }).end();
    } else {
      res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
      res.end('event: message\r\ndata: {"jsonrpc":"2.0","id":"tools","result":{"tools":[]}}\r\n\r\n');
    }
  }, '{"jsonrpc":"2.0","id":0,"method":"initialize"}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":"tools","method":"tools/list"}\n');
  assert.deepEqual(seen.map(row => row.session), [undefined, "session-a", "session-b"]);
  assert.ok(seen.every(row => row.method === "POST" && row.path === "/mcp"));
  assert.deepEqual(replies, [
    { jsonrpc: "2.0", id: 0, result: { ready: true } },
    { jsonrpc: "2.0", id: "tools", result: { tools: [] } },
  ]);
});

test("CLI recovers from malformed stdin and HTTP failure with JSON-only stdout", { timeout: 8000 }, async () => {
  const seen = [];
  const replies = await runCli((req, res, msg) => {
    seen.push(msg.id);
    if (msg.id === 0) { res.writeHead(503).end("offline"); return; }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: true }));
  }, '\nnot json\n{"id":0}\n{"id":"recovered"}\n');
  assert.deepEqual(seen, [0, "recovered"], "invalid input never reaches HTTP");
  assert.deepEqual(replies, [
    { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: stdin line is not JSON" } },
    { jsonrpc: "2.0", id: 0, error: { code: -32603, message: "Proxy error: endpoint 503: offline" } },
    { jsonrpc: "2.0", id: "recovered", result: true },
  ]);
});

test("CLI --version prints the package version and exits without proxying", async () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const child = spawn(process.execPath, [new URL("../bin/macd-mcp.mjs", import.meta.url).pathname, "--version"], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", d => { stdout += d; });
  const [code] = await once(child, "close");
  assert.equal(code, 0);
  assert.equal(stdout.trim(), pkg.version);
});

test("CLI --help prints usage and exits without proxying", async () => {
  const child = spawn(process.execPath, [new URL("../bin/macd-mcp.mjs", import.meta.url).pathname, "--help"], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", d => { stdout += d; });
  const [code] = await once(child, "close");
  assert.equal(code, 0);
  assert.match(stdout, /Usage: macd-mcp/);
  assert.match(stdout, /MACD_MCP_URL/);
});
