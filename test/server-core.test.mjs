// Portable regression for the canonical MACD MCP server core (server/web/).
// No Docker, no network, no deps: exercises the pure JSON-RPC handlers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc, searchFaq } from '../server/web/mcp-core.mjs';

const rpc = (method, params) => handleRpc({ jsonrpc: '2.0', id: 1, method, params });

test('initialize returns server identity and protocol', () => {
  const r = rpc('initialize');
  assert.equal(r.result.serverInfo.name, 'macd-adaptive');
  assert.equal(r.result.protocolVersion, '2024-11-05');
  assert.ok(r.result.capabilities.tools);
});

test('tools/list exposes exactly the nine read-only MACD tools', () => {
  const names = rpc('tools/list').result.tools.map(t => t.name).sort();
  assert.deepEqual(names, [
    'audit_agent_readiness', 'compare_options', 'estimate_quote',
    'get_availability', 'get_faq', 'get_portfolio', 'get_pricing',
    'get_process', 'get_services',
  ]);
});

test('ping answers empty result; notifications produce no response', () => {
  assert.deepEqual(rpc('ping').result, {});
  assert.equal(handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});

test('unknown tool is an error result, never a throw', () => {
  const r = rpc('tools/call', { name: 'delete_everything', arguments: {} });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /Tool delete_everything not found/);
});

test('argument validation rejects wrong types with -32602 text', () => {
  const r = rpc('tools/call', { name: 'get_faq', arguments: { query: 42 } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /-32602/);
});

test('malformed JSON-RPC envelope returns Invalid Request', () => {
  const r = handleRpc([1, 2, 3]);
  assert.equal(r.error.code, -32600);
});

test('searchFaq: stopword-only query is capped empty; real query hits', () => {
  assert.deepEqual(searchFaq('the a an of', 'en').results, []);
  assert.ok(searchFaq('price', 'en').results.length > 0);
  assert.ok(searchFaq('precio', 'es').results.length > 0);
});
