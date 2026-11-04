import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { forward, runProxy } from "../lib/proxy.mjs";

const endpoint = "https://example.invalid/mcp";
const max = 2 ** 31 - 1;
for (const timeoutMs of [max + 1, 2 ** 32 - 1, 2 ** 32, Number.MAX_SAFE_INTEGER]) {
  test(`timeout ${timeoutMs} is rejected before fetch or stdin consumption`, async () => {
    let fetches = 0, reads = 0;
    const fetchImpl = async () => { fetches++; return new Response('{}'); };
    await assert.rejects(forward(endpoint, { id: 1 }, undefined, fetchImpl, timeoutMs), /timeoutMs must not exceed 2147483647 ms/);
    await assert.rejects(runProxy({ endpoint, timeoutMs, fetchImpl,
      input: Readable.from((async function* () { reads++; yield '{"id":1}\n'; })()),
      output: new Writable({ write(c, e, cb) { cb(); } }),
    }), /timeoutMs must not exceed 2147483647 ms/);
    assert.equal(fetches, 0);
    assert.equal(reads, 0);
  });
}
test("maximum supported timeout and the default reach fetch without aborting", async () => {
  for (const timeoutMs of [max, undefined]) {
    let fetches = 0;
    const result = await forward(endpoint, { id: 1 }, undefined, async (url, opts) => {
      fetches++;
      assert.equal(opts.signal.aborted, false);
      return new Response('{"id":1,"result":true}');
    }, timeoutMs);
    assert.equal(fetches, 1);
    assert.deepEqual(result.messages, ['{"id":1,"result":true}']);
  }
});
