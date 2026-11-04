import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { runProxy } from "../lib/proxy.mjs";

for (const type of ["application/json", "text/event-stream"]) {
  test(`multiline ${type} reply stays on one stdio line`, async () => {
    const reply = { jsonrpc: "2.0", id: 1, result: { text: "first\nsecond", name: "é🌍" } };
    const pretty = JSON.stringify(reply, null, 2);
    let stdout = "";
    await runProxy({
      input: Readable.from(['{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n']),
      output: new Writable({ write(chunk, encoding, done) { stdout += chunk; done(); } }),
      endpoint: "https://example.invalid/mcp",
      fetchImpl: async () => new Response(type === "text/event-stream" ? pretty.split("\n").map(line => `data: ${line}`).join("\n") + "\n\n" : pretty, { headers: { "content-type": type } }),
    });
    assert.equal(stdout.slice(0, -1).includes("\n"), false);
    assert.equal(stdout.endsWith("\n"), true);
    assert.deepEqual(JSON.parse(stdout.slice(0, -1)), reply);
  });
}

test("framing preserves large number lexemes and escaped control characters", async () => {
  const payload = '{\r\n"id":9007199254740993,\r"result":"line\\nslash\\\\tail"\n}';
  let stdout = "";
  await runProxy({ input: Readable.from(['{"id":1}\n']),
    output: new Writable({ write(chunk, encoding, done) { stdout += chunk; done(); } }),
    endpoint: "https://example.invalid/mcp",
    fetchImpl: async () => new Response(payload, { headers: { "content-type": "application/json" } }),
  });
  assert.equal(stdout, payload.replace(/[\r\n]/g, " ") + "\n");
  assert.match(stdout, /9007199254740993/);
});

for (const payload of [
  '{"id":1,"result":"literal\\n\\r and slash\\\\"}',
  '{\r\n"id":1,\r\n"result":9007199254740993\r\n}',
]) {
  test(`framing preserves escapes and supports CRLF: ${JSON.stringify(payload)}`, async () => {
    let stdout = "";
    await runProxy({ input: Readable.from(['{"id":1}\n']),
      output: new Writable({ write(chunk, encoding, done) { stdout += chunk; done(); } }),
      endpoint: "https://example.invalid/mcp",
      fetchImpl: async () => new Response(payload, { headers: { "content-type": "application/json" } }),
    });
    assert.equal(stdout, payload.replace(/[\r\n]/g, " ") + "\n");
  });
}
