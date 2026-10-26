import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {forward, DEFAULT_ENDPOINT} from '../lib/proxy.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/public-tools.json',import.meta.url)));
const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
const names=fixture.tools.map(t=>t.name).sort();
test('public tools fixture has unique schemas, not mutation capabilities',()=>{
  assert.equal(names.length,9);assert.equal(new Set(names).size,names.length);
  for(const t of fixture.tools){assert.equal(t.inputSchema.type,'object');assert.equal(t.inputSchema.additionalProperties,false);}
});
test('README tools snapshot matches captured tools/list exactly',()=>{
  const section=readme.split('## Tools')[1].split('## Contact')[0];
  const listed=[...section.matchAll(/`([a-z]+_[a-z_]+)`/g)].map(m=>m[1]);
  assert.deepEqual([...new Set(listed)].sort(),names);
  assert.ok(readme.includes(DEFAULT_ENDPOINT));
});
test('captured inventory is compared by the real proxy parser',async()=>{
 const response=new Response('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:1,result:{tools:fixture.tools}})+'\n\n',{headers:{'content-type':'text/event-stream'}});
 const got=await forward(DEFAULT_ENDPOINT,{jsonrpc:'2.0',id:1,method:'tools/list',params:{}},undefined,async()=>response);
 assert.deepEqual(JSON.parse(got.messages[0]).result.tools,fixture.tools);
});
test('live public inventory and cards agree with explicit supported endpoint aliases',{skip:process.env.MACD_MCP_LIVE_SMOKE!=='1'},async()=>{
 const got=await forward(DEFAULT_ENDPOINT,{jsonrpc:'2.0',id:1,method:'tools/list',params:{}});
 const live=JSON.parse(got.messages[0]).result.tools;
 assert.deepEqual(live.map(t=>t.name).sort(),names);
 for(const t of live)assert.deepEqual(t.inputSchema,fixture.tools.find(x=>x.name===t.name).inputSchema);
 for(const url of ['https://macd.ie/.well-known/mcp/server-card.json','https://macd.ie/.well-known/mcp.json']){
  const res=await fetch(url,{signal:AbortSignal.timeout(15000)});assert.equal(res.status,200);const card=await res.json();
  assert.equal(card.name,'ie.macd/macd-adaptive');
  assert.ok(card.remotes.some(r=>r.type==='streamable-http'&&['https://macd.ie/mcp','https://macd.ie/api/mcp'].includes(r.url)));
 }
});
