import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDemo}from '../examples/fictional-demo/core.mjs';
const rpc=(method,params,id=1)=>handleDemo({jsonrpc:'2.0',method,params,id});
test('fictional inventory has exactly 3 informational tools and defensive copies',()=>{
 const list=rpc('tools/list').result.tools;assert.equal(list.length,3);
 for(const t of list){assert.equal(t.annotations.readOnlyHint,true);assert.equal(t.annotations.openWorldHint,false);assert.equal(t.inputSchema.additionalProperties,false);}
 list[0].inputSchema.properties.lang.enum.push('fr');assert.equal(rpc('tools/list').result.tools[0].inputSchema.properties.lang.enum.length,2);
 assert.match(rpc('initialize').result.serverInfo.name,/fictional.*DRAFT/);
});
test('all fictional tools answer both languages without structured claims',()=>{
 for(const t of rpc('tools/list').result.tools)for(const lang of ['en','es']){
  const r=rpc('tools/call',{name:t.name,arguments:{lang}},`${t.name}-${lang}`);
  assert.equal(r.id,`${t.name}-${lang}`);assert.equal(r.result.isError,undefined);assert.match(r.result.content[0].text,lang==='en'?/fictional/i:/fictici/i);
 }
});
test('errors, notifications, null id and attempted actions stay local and inert',()=>{
 assert.equal(handleDemo({jsonrpc:'2.0',method:'tools/list'}),null);
 assert.equal(handleDemo({jsonrpc:'2.0',method:'tools/list',id:null}).id,null);
 assert.equal(rpc('send_email').error.code,-32601);
 for(const name of ['send_email','book','pay','__proto__'])assert.equal(rpc('tools/call',{name}).result.isError,true);
 for(const args of [null,[],{lang:'fr'},{email:'example@example.invalid'},{lang:5}])assert.equal(rpc('tools/call',{name:'demo_services',arguments:args}).result.isError,true);
 assert.equal(handleDemo([]).error.code,-32600);assert.equal(handleDemo({jsonrpc:'1.0',method:'ping',id:1}).error.code,-32600);
});
