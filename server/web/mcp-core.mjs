// MACD Adaptive public MCP core — read-only reimplementation.
// Recovery commit after loss of the original Git objects (2026-09-15).
// Behaviour reconstructed from live-endpoint probes of the deployed candidate;
// probe parity is asserted in mcp-core.test.mjs.
import {MCP_DATA as D} from './mcp-data.mjs';

const PROTOCOL_VERSION='2024-11-05';
const SERVER_INFO={name:'macd-adaptive',version:'1.0.0'};
const CAPABILITIES={tools:{listChanged:true}};
const MAX_RESULTS=20;

function jsonType(v){
  if(v===null)return'null';if(Array.isArray(v))return'array';
  if(typeof v==='number')return Number.isInteger(v)?'integer':'number';return typeof v;
}
// Zod-style validation messages, matching the observed live wording.
export function validate(args,schema,toolName){
  const fail=d=>`Input validation error: Invalid arguments for tool ${toolName}: ${d}`;
  if(args===undefined||args===null)args={};
  if(typeof args!=='object'||Array.isArray(args))return fail(`Expected object, received ${jsonType(args)}`);
  const props=schema.properties||{};
  for(const req of schema.required||[])if(!(req in args))return fail(`Required at ${req}`);
  if(schema.additionalProperties===false){
    const extra=Object.keys(args).filter(k=>!(k in props));
    if(extra.length)return fail(`Unrecognized key(s) in object: ${extra.map(k=>`'${k}'`).join(', ')}`);
  }
  for(const [k,v] of Object.entries(args)){
    const s=props[k];if(!s)continue;
    if(s.type==='string'&&typeof v!=='string')return fail(`Expected string, received ${jsonType(v)} at ${k}`);
    if(s.type==='boolean'&&typeof v!=='boolean')return fail(`Expected boolean, received ${jsonType(v)} at ${k}`);
    if(s.type==='integer'&&(typeof v!=='number'||!Number.isInteger(v)))return fail(`Expected integer, received ${jsonType(v)} at ${k}`);
    if(s.type==='array'&&!Array.isArray(v))return fail(`Expected array, received ${jsonType(v)} at ${k}`);
    if(s.type==='object'&&(typeof v!=='object'||v===null||Array.isArray(v)))return fail(`Expected object, received ${jsonType(v)} at ${k}`);
    if(s.enum&&!s.enum.includes(v))return fail(`Invalid enum value. Expected ${s.enum.map(e=>`'${e}'`).join(' | ')}, received '${v}' at ${k}`);
    if(s.maxLength!==undefined&&typeof v==='string'&&v.length>s.maxLength)return fail(`String must contain at most ${s.maxLength} character(s) at ${k}`);
    if(s.minimum!==undefined&&typeof v==='number'&&v<s.minimum)return fail(`Number must be greater than or equal to ${s.minimum} at ${k}`);
    if(s.maximum!==undefined&&typeof v==='number'&&v>s.maximum)return fail(`Number must be less than or equal to ${s.maximum} at ${k}`);
    if(s.minItems!==undefined&&Array.isArray(v)&&v.length<s.minItems)return fail(`Array must contain at least ${s.minItems} element(s) at ${k}`);
    if(s.maxItems!==undefined&&Array.isArray(v)&&v.length>s.maxItems)return fail(`Array must contain at most ${s.maxItems} element(s) at ${k}`);
    if(s.type==='array'&&s.items&&s.items.enum&&Array.isArray(v))
      for(const item of v)if(!s.items.enum.includes(item))return fail(`Invalid enum value. Expected ${s.items.enum.map(e=>`'${e}'`).join(' | ')}, received '${item}' at ${k}`);
    if(k==='checks'&&s.type==='object'&&v&&typeof v==='object'){
      const cp=s.properties||{};
      for(const [ck,cv] of Object.entries(v)){
        if(!(ck in cp))return fail(`Unrecognized key(s) in object: '${ck}' at checks`);
        if(typeof cv!=='boolean')return fail(`Expected boolean, received ${jsonType(cv)} at checks.${ck}`);
      }
    }
  }
  return null;
}

const pickLang=a=>(a&&a.lang==='es')?'es':'en';

// Multi-concept substring search over the canonical bilingual FAQ corpus
// (window.MACD_FAQ_V2, 100 approved answers). Concepts split on " y ", " and ",
// commas and semicolons; an entry matches when any concept is a substring of
// its question+answer in the requested language. Union, corpus order, cap 20.
export function searchFaq(query,lang){
  const q=String(query||'').trim().toLowerCase();
  const STOP=new Set(('a,an,the,is,are,do,does,did,what,whats,how,how much,much,many,for,to,of,in,on,and,or,it,this,that,with,you,your,we,our,can,could,would,should,will,i,me,my,'+
    'el,la,los,las,un,una,unos,unas,de,del,en,y,o,que,qué,como,cómo,cuanto,cuánto,cuanta,cuánta,cuantos,cuántos,es,son,con,por,para,su,sus,tu,tus,mi,mis,nos,os,se,si,sí,me,te,le,les,hace,hacéis,tenéis,hay,lo').split(','));
  const tokens=q?[...new Set(q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/[^a-z0-9]+/).filter(t=>t.length>1&&!STOP.has(t)))]:[];
  let rows=[];
  if(tokens.length){
    rows=D.FAQ.map(x=>{
      const t=`${x.q[lang]} ${x.a[lang]}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const ws=new Set(t.split(/[^a-z0-9]+/).filter(Boolean));
      let score=0;
      for(const tok of tokens) if(ws.has(tok)) score++;
      return {x,score};
    }).filter(r=>r.score>0);
    rows.sort((a,b)=>b.score-a.score);
  }
  // Min-overlap gate (24/09): a result must share >=min(2,tokens) whole words
  // with the query or it is dropped, so the client falls back to handoff
  // instead of showing coincidental single-word hits. The gate applies per
  // row (not only to the top row); rows are score-sorted, so filtering before
  // the cap returns exactly the passing prefix.
  const need=Math.min(2,tokens.length);
  const capped=tokens.length>0?rows.filter(r=>r.score>=need).slice(0,MAX_RESULTS):[];
  return {lang,query:String(query||''),matches:capped.length,results:capped.map(r=>({question:r.x.q[lang],answer:r.x.a[lang]}))};
}

function estimate(a){
  const lang=pickLang(a),E=D.ESTIMATE;
  const wa=!!a.whatsapp_addon;
  const out={lang};
  if(a.custom){
    Object.assign(out,{requires_quote:true,option:'web-custom',price:E['web-custom'].price[lang],conditions:E['web-custom'].conditions[lang],whatsapp_addon:wa?E.wa_note[lang]:null,note:E.note[lang]});
  }else if(a.pages===1&&a.content_ready===true&&(a.revision_rounds===undefined||a.revision_rounds<=1)){
    Object.assign(out,{requires_quote:false,option:'web-one-page',price:wa?E['one-page'].price_wa[lang]:E['one-page'].price[lang],conditions:E['one-page'].conditions[lang],whatsapp_addon:wa?E.wa_note[lang]:null,note:E.note[lang]});
  }else if(a.pages>=4&&a.pages<=5){
    Object.assign(out,{requires_quote:true,option:'web-4-5-pages',price:E['web-4-5-pages'].price[lang],conditions:E['web-4-5-pages'].conditions[lang],whatsapp_addon:wa?E.wa_note[lang]:null,note:E.note[lang]});
  }else{
    Object.assign(out,{requires_quote:true,reason:E.reason[lang]});
  }
  return out;
}

function auditReadiness(a){
  const lang=pickLang(a),A=D.AUDIT;
  const checks=(a&&a.checks)||{};
  let passed=0,failed=0,unknown=0;
  const results=A.order.map(key=>{
    let status;
    if(checks[key]===true){passed++;status='pass';}
    else if(checks[key]===false){failed++;status='fail';}
    else{unknown++;status='unknown';}
    return {key,label:A.labels[key][lang],status};
  });
  const ready=passed===A.order.length;
  const recommendation=ready?A.recommendation.ready[lang]:unknown>0?A.recommendation.unknown[lang]:A.recommendation.fix[lang];
  return {lang,passed,failed,unknown,ready,results,recommendation,disclaimer:A.disclaimer[lang]};
}

const HANDLERS={
  get_services:a=>D.SERVICES_TEXT[pickLang(a)],
  get_pricing:a=>D.PRICING_TEXT[pickLang(a)],
  get_availability:a=>D.AVAILABILITY_TEXT[pickLang(a)],
  get_faq:a=>JSON.stringify(searchFaq(a.query,a.lang==='es'?'es':'en')),
  get_portfolio:a=>JSON.stringify(D.PORTFOLIO[pickLang(a)]),
  get_process:a=>JSON.stringify(D.PROCESS[pickLang(a)]),
  estimate_quote:a=>JSON.stringify(estimate(a)),
  compare_options:a=>JSON.stringify({lang:pickLang(a),options:a.option_ids.map(id=>({id,price:D.OPTIONS[id][pickLang(a)].price,fit:D.OPTIONS[id][pickLang(a)].fit})),note:D.COMPARE_NOTE[pickLang(a)]}),
  audit_agent_readiness:a=>JSON.stringify(auditReadiness(a)),
};

const TOOL_MAP=Object.fromEntries(D.TOOLS.map(t=>[t.name,t]));

function okText(text){return {content:[{type:'text',text}]};}
function errText(text){return {content:[{type:'text',text}],isError:true};}

export function handleRpc(msg){
  if(!msg||typeof msg!=='object'||Array.isArray(msg))
    return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}};
  const id=msg.id;
  const isNotification=id===undefined||id===null;
  const respond=resultOrError=>{
    if(isNotification)return null; // notifications: 202, no body
    return Object.assign({jsonrpc:'2.0',id},resultOrError);
  };
  switch(msg.method){
    case 'initialize':
      return respond({result:{protocolVersion:PROTOCOL_VERSION,capabilities:CAPABILITIES,serverInfo:SERVER_INFO}});
    case 'ping':
      return respond({result:{}});
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    case 'tools/list':
      return respond({result:{tools:D.TOOLS}});
    case 'tools/call':{
      const p=msg.params||{};
      const name=p.name;
      const tool=TOOL_MAP[name];
      if(!tool)return respond({result:errText(`MCP error -32602: Tool ${name} not found`)});
      const args=p.arguments===undefined?{}:p.arguments;
      const v=validate(args,tool.inputSchema,name);
      if(v)return respond({result:errText(`MCP error -32602: ${v}`)});
      return respond({result:okText(HANDLERS[name](args))});
    }
    default:
      return respond({error:{code:-32601,message:'Method not found'}});
  }
}
