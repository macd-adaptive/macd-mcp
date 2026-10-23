// Portable regression for the per-business MCP layer (server/web/mcp-biz-core.mjs).
// Uses an inline fixture pack and a temp BIZ_PACKS_DIR; no Docker, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pack = {
  slug: 'fixture-cafe',
  version: '1.0.0',
  business_name: 'Fixture Café',
  langs: ['en', 'es'],
  lang_default: 'en',
  services: [{ id: 'coffee', name: { en: 'Coffee', es: 'Café' }, price_eur: 2 }],
  booking: { url: 'https://example.com/book' },
};

// BIZ_PACKS_DIR binds at import time: set it before importing the module.
const dir = mkdtempSync(join(tmpdir(), 'mcp-packs-'));
mkdirSync(join(dir, 'fixture-cafe'));
writeFileSync(join(dir, 'fixture-cafe', 'pack.json'), JSON.stringify(pack));
process.env.BIZ_PACKS_DIR = dir;
const { handleRpcBiz, loadPack, isValidSlug } = await import('../server/web/mcp-biz-core.mjs');

const BIZ_TOOLS = ['get_booking_link', 'get_business_info', 'get_opening_hours', 'get_services', 'search_faq'];

test('loadPack loads and sanitizes a valid pack; unknown/invalid slugs return null', async () => {
  const p = await loadPack('fixture-cafe');
  assert.equal(p.business_name, 'Fixture Café');
  assert.equal(await loadPack('no-such-slug'), null);
  assert.equal(await loadPack('BAD SLUG!'), null);
  assert.equal(isValidSlug('fixture-cafe'), true);
  assert.equal(isValidSlug('-bad'), false);
});

test('biz initialize names the business server; tools/list is the read-only allowlist', () => {
  const init = handleRpcBiz({ jsonrpc: '2.0', id: 1, method: 'initialize' }, pack);
  assert.equal(init.result.serverInfo.name, 'fixture-cafe-mcp');
  const names = handleRpcBiz({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, pack)
    .result.tools.map(t => t.name).sort();
  assert.deepEqual(names, BIZ_TOOLS);
});

test('biz layer never exposes MACD-suite tools (zero MACD leakage)', () => {
  const r = handleRpcBiz({ jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'get_pricing', arguments: {} } }, pack);
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /Tool get_pricing not found/);
});

test('biz tools/call serves fixture service data read-only', () => {
  const r = handleRpcBiz({ jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'get_services', arguments: {} } }, pack);
  assert.notEqual(r.result.isError, true);
  assert.match(r.result.content[0].text, /Coffee/);
});
