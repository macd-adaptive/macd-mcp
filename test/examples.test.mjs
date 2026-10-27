import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const tools=JSON.parse(read('./fixtures/public-tools.json')).tools;
const examples=JSON.parse(read('../docs/examples/read-only.json'));
// Only the schema keywords used by this dated input fixture. Fail closed.
function check(v,s){
 const allowed=new Set(['type','properties','required','additionalProperties','enum','items','minItems','maxItems','minimum','maximum','maxLength','$schema','description']);
 for(const key of Object.keys(s))assert.ok(allowed.has(key),`unsupported schema keyword ${key}`);
 if(s.type==='object'){
  assert.ok(v!==null&&typeof v==='object'&&!Array.isArray(v));
  for(const k of s.required??[])assert.ok(Object.hasOwn(v,k),`required ${k}`);
  for(const [k,value]of Object.entries(v)){assert.ok(s.properties[k],`unknown ${k}`);check(value,s.properties[k]);}
 }else if(s.type==='array'){
  assert.ok(Array.isArray(v));assert.ok(v.length>=(s.minItems??0)&&v.length<=(s.maxItems??Infinity));for(const item of v)check(item,s.items);
 }else if(s.type==='integer'){assert.ok(Number.isInteger(v));assert.ok(v>=(s.minimum??-Infinity)&&v<=(s.maximum??Infinity));}
 else {assert.equal(typeof v,s.type);if(s.maxLength!==undefined)assert.ok(v.length<=s.maxLength);}
 if(s.enum)assert.ok(s.enum.includes(v));
}
test('18 unique read-only requests cover every dated tool in EN/ES',()=>{
 assert.equal(examples.length,18);assert.equal(new Set(examples.map(x=>x.id)).size,18);
 for(const t of tools)for(const lang of ['en','es']){
  const found=examples.filter(x=>x.params.name===t.name&&x.params.arguments.lang===lang);assert.equal(found.length,1);
  const e=found[0];assert.equal(e.jsonrpc,'2.0');assert.equal(e.method,'tools/call');check(e.params.arguments,t.inputSchema);
 }
 for(const e of examples)assert.ok(tools.some(t=>t.name===e.params.name));
});
test('all published JSON blocks match the machine-readable examples exactly',()=>{
 const blocks=[...read('../docs/EXAMPLES.md').matchAll(/```json\n([\s\S]*?)\n```/g)].map(x=>JSON.parse(x[1]));assert.deepEqual(blocks,examples);
});
test('validator rejects unknown keys, missing pages, bad lang and out-of-range pages',()=>{
 const schema=tools.find(t=>t.name==='estimate_quote').inputSchema;
 for(const bad of [{pages:1,send:true},{lang:'es'},{pages:1,lang:'fr'},{pages:0},{pages:101},{pages:1.5},{pages:'1'}])assert.throws(()=>check(bad,schema));
});
