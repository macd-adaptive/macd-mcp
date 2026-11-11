import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable, Writable} from 'node:stream';
import {forward, runProxy} from '../lib/proxy.mjs';
const endpoint='https://example.invalid/mcp';
const malformed=[
 ['overlong slash',[0xc0,0xaf]],['UTF-16 surrogate',[0xed,0xa0,0x80]],
 ['out of range',[0xf4,0x90,0x80,0x80]],['truncated sequence',[0xe2,0x82]],
 ['lone continuation',[0x80]],
];
for(const [name,bytes] of malformed){
 test(`stdin rejects malformed UTF-8 ${name} before POST and recovers next line`,async()=>{
  const bad=Buffer.concat([Buffer.from('{"id":1,"params":{"text":"'),Buffer.from(bytes),Buffer.from('"}}\n')]);
  const seen=[];let stdout='';
  await runProxy({input:Readable.from([bad,Buffer.from('{"id":2}\n')]),output:new Writable({write(c,e,cb){stdout+=c;cb();}}),endpoint,fetchImpl:(u,o)=>{const msg=JSON.parse(o.body);seen.push(msg);return new Response(JSON.stringify({id:msg.id,result:true}));}});
  assert.deepEqual(seen,[{id:2}]);
  const messages=stdout.trim().split('\n').map(JSON.parse);
  assert.equal(messages[0].id,null);assert.equal(messages[0].error.code,-32700);
  assert.deepEqual(messages[1],{id:2,result:true});
 });
 for(const type of ['application/json','text/event-stream'])test(`${type} rejects malformed UTF-8 ${name} without payload leak`,async()=>{
  const bad=Buffer.concat([Buffer.from(type==='text/event-stream'?'data: {"id":1,"result":"private-fixture-':'{"id":1,"result":"private-fixture-'),Buffer.from(bytes),Buffer.from(type==='text/event-stream'?'"}\n\n':'"}')]);
  await assert.rejects(forward(endpoint,{id:1},undefined,()=>new Response(bad,{headers:{'content-type':type}})),e=>e.message==='endpoint request failed');
 });
}
test('valid Unicode and an intentional replacement character survive every-byte chunks',async()=>{
 const message={id:3,params:{text:'é🌍�'}};const bytes=Buffer.from(`${JSON.stringify(message)}\n`);let seen=null,stdout='';
 const reply=JSON.stringify({id:3,result:'é🌍�'});
 await runProxy({input:Readable.from(Array.from(bytes,b=>Buffer.from([b]))),output:new Writable({write(c,e,cb){stdout+=c;cb();}}),endpoint,fetchImpl:(u,o)=>{seen=JSON.parse(o.body);const body=new ReadableStream({start(c){for(const b of Buffer.from(reply))c.enqueue(Uint8Array.of(b));c.close();}});return new Response(body);}});
 assert.deepEqual(seen,message);assert.equal(stdout,`${reply}\n`);
});
test('truncated UTF-8 in final unterminated stdin line is a parse error, never POSTed',async()=>{
 let calls=0,stdout='';await runProxy({input:Readable.from([Buffer.from([0xe2,0x82])]),output:new Writable({write(c,e,cb){stdout+=c;cb();}}),endpoint,fetchImpl:()=>{calls++;return new Response('{}');}});
 assert.equal(calls,0);assert.equal(JSON.parse(stdout).error.code,-32700);
});
