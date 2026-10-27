// DRAFT: offline educational subset, not a production MCP server.
const inventory=[
 {name:'demo_services',description:'Fictional services, no prices or commitments'},
 {name:'demo_hours',description:'Fictional illustrative opening hours, not live slots'},
 {name:'demo_process',description:'Fictional information-only process'}
].map(x=>({...x,inputSchema:{type:'object',properties:{lang:{type:'string',enum:['en','es']}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));
const values={
 en:{demo_services:'Fictional business: Constellation Bicycle Workshop. Demonstration service: bicycle inspection. No real business, prices or sales.',demo_hours:'Fictional illustrative hours: Monday 10:00-12:00. Not current availability; cannot book.',demo_process:'Read fictional information, then stop. No messages, bookings, payments or customer records.'},
 es:{demo_services:'Negocio ficticio: Taller de Bicicletas Constelación. Servicio de demostración: revisión de bicicletas. Sin negocio real, precios ni ventas.',demo_hours:'Horario ficticio ilustrativo: lunes 10:00-12:00. No es disponibilidad actual; no permite reservar.',demo_process:'Leer información ficticia y parar. Sin mensajes, reservas, pagos ni registros de clientes.'}
};
const textError=()=>({isError:true,content:[{type:'text',text:'Invalid fictional tool or arguments'}]});
export function handleDemo(message){
 if(!message||typeof message!=='object'||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string')return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}};
 const notification=message.id===undefined;
 if(!notification&&!(typeof message.id==='string'||(typeof message.id==='number'&&Number.isFinite(message.id))||message.id===null))return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}};
 const reply=value=>notification?null:{jsonrpc:'2.0',id:message.id,...value};
 if(message.method==='initialize')return reply({result:{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'fictional-constellation-demo-DRAFT',version:'0.0.0-draft'}}});
 if(message.method==='notifications/initialized')return null;
 if(message.method==='ping')return reply({result:{}});
 if(message.method==='tools/list')return reply({result:{tools:inventory.map(t=>structuredClone(t))}});
 if(message.method==='tools/call'){
  const params=message.params;
  if(!params||typeof params!=='object'||Array.isArray(params)||!Object.hasOwn(values.en,params.name))return reply({result:textError()});
  const args=params.arguments===undefined?{}:params.arguments;
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>k!=='lang')||(args.lang!==undefined&&!['en','es'].includes(args.lang)))return reply({result:textError()});
  return reply({result:{content:[{type:'text',text:values[args.lang??'en'][params.name]}]}});
 }
 return reply({error:{code:-32601,message:'Method not found'}});
}
