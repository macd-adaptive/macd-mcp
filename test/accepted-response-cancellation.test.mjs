import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { forward, runProxy } from '../lib/proxy.mjs';

const endpoint = 'https://example.invalid/mcp';

function acceptedResponse(status, cancelMode = 'resolve') {
  const observed = { reads: 0, cancels: 0 };
  const response = {
    status,
    ok: true,
    headers: new Headers({ 'mcp-session-id': 'fixture-accepted-session' }),
    body: {
      getReader() {
        observed.reads++;
        assert.fail('accepted response body must not be read');
      },
      cancel() {
        observed.cancels++;
        if (cancelMode === 'throw') throw new Error('private-cancel-fixture');
        if (cancelMode === 'reject') return Promise.reject(new Error('private-cancel-fixture'));
        if (cancelMode === 'pending') return new Promise(() => {});
        return Promise.resolve();
      },
    },
  };
  return { response, observed };
}

// HTTP 202 may carry a body. HTTP 204 uses a synthetic response port here:
// native Response forbids its body, but the shared accepted branch is covered.
for (const status of [202, 204]) {
  test(`accepted ${status} cancels once without acquiring a body reader`, async () => {
    const { response, observed } = acceptedResponse(status);
    const result = await forward(endpoint, { id: 1 }, undefined, () => response);
    assert.deepEqual(result, { messages: [], sessionId: 'fixture-accepted-session' });
    assert.equal(observed.reads, 0);
    assert.equal(observed.cancels, 1);
  });
}

for (const mode of ['pending', 'throw', 'reject']) {
  test(`accepted 202 cancellation ${mode} neither stalls the next turn nor leaks an error`, { timeout: 2000 }, async () => {
    const { response, observed } = acceptedResponse(202, mode);
    const seen = [];
    let stdout = '';
    await runProxy({
      endpoint,
      input: Readable.from(['{"id":1}\n{"id":2}\n']),
      output: new Writable({ write(chunk, encoding, callback) { stdout += chunk; callback(); } }),
      fetchImpl(url, options) {
        const message = JSON.parse(options.body);
        seen.push({ id: message.id, session: options.headers['mcp-session-id'] });
        if (message.id === 1) return response;
        return new Response('{"id":2,"result":true}', { headers: { 'content-type': 'application/json' } });
      },
    });
    // Allow a rejected cancellation to surface as an unhandled rejection if
    // the best-effort guard regresses. node:test treats that as a failure.
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(seen, [
      { id: 1, session: undefined },
      { id: 2, session: 'fixture-accepted-session' },
    ]);
    assert.equal(stdout, '{"id":2,"result":true}\n');
    assert.equal(observed.reads, 0);
    assert.equal(observed.cancels, 1);
  });
}
