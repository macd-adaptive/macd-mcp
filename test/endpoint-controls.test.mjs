import test from 'node:test';
import assert from 'node:assert/strict';
import {forward, validateEndpoint} from '../lib/proxy.mjs';

const malformed = ['https://exam\nple.invalid/mcp', 'https://exam\rple.invalid/mcp',
  'https://example.invalid/m\tcp', 'https://example.invalid/m\u0000cp',
  'https://example.invalid/m\u001fcp', 'https://example.invalid/m\u007fcp'];

test('endpoint validation rejects literal control characters instead of normalizing them', () => {
  for (const endpoint of malformed) assert.throws(() => validateEndpoint(endpoint), /endpoint/, JSON.stringify(endpoint));
});
test('malformed endpoint controls never reach fetch', async () => {
  let calls = 0;
  const fetchImpl = () => { calls++; return Promise.resolve(new Response('{}')); };
  for (const endpoint of malformed) {
    await assert.rejects(forward(endpoint, {id: 1}, null, fetchImpl));
  }
  assert.equal(calls, 0);
});
test('encoded URL components remain allowed and are not decoded by endpoint validation', () => {
  for (const endpoint of ['https://example.invalid/mcp', 'https://example.invalid/a%20b?name=x%09y']) {
    assert.doesNotThrow(() => validateEndpoint(endpoint));
  }
});
