import assert from 'node:assert/strict';
import {createOrConnectInstance,getEvolutionConfig,getLiveConnection} from '../src/lib/evolution.js';

const original={url:process.env.EVOLUTION_API_URL,key:process.env.EVOLUTION_API_KEY,fetch:globalThis.fetch};
let checks=0;
try{
 process.env.EVOLUTION_API_URL='';process.env.EVOLUTION_API_KEY='';
 assert.equal(getEvolutionConfig().configured,false);
 assert.equal((await getLiveConnection('demo')).state,'unconfigured');checks++;
 process.env.EVOLUTION_API_URL='https://evolution.example.invalid';process.env.EVOLUTION_API_KEY='test-key';
 let requests=[];
 globalThis.fetch=async url=>{requests.push(String(url));return new Response(JSON.stringify({message:'Unauthorized'}),{status:401,headers:{'Content-Type':'application/json'}})};
 await assert.rejects(createOrConnectInstance({instanceName:'demo'}),/rejected the server API key/i);
 assert.equal(requests.some(url=>url.includes('/instance/create')),false);checks++;
 requests=[];
 globalThis.fetch=async url=>{requests.push(String(url));return new Response(JSON.stringify(url.includes('/instance/connect/')?{qrcode:{base64:'mock-image'}}:url.includes('/instance/fetchInstances')?[]:{instance:{state:'close'}}),{status:200,headers:{'Content-Type':'application/json'}})};
 const connection=await createOrConnectInstance({instanceName:'demo'});
 assert.equal(connection.base64,'mock-image');
 assert.equal(requests.some(url=>url.includes('/instance/create')),false);checks++;
 requests=[];
 globalThis.fetch=async (url,options)=>{requests.push(String(url));const create=String(url).includes('/instance/create'),connect=String(url).includes('/instance/connect/');return new Response(JSON.stringify(create?{message:'Unauthorized'}:connect?{message:'Not found'}:String(url).includes('/instance/fetchInstances')?[]:{instance:{state:'close'}}),{status:create?401:connect?404:200,headers:{'Content-Type':'application/json'}})};
 await assert.rejects(createOrConnectInstance({instanceName:'new-demo'}),/global.*key|global key/i);
 assert.equal(requests.some(url=>url.includes('/instance/create')),true);checks++;
 console.log(`PASS: ${checks} WhatsApp configuration and QR checks`);
}finally{
 if(original.url===undefined)delete process.env.EVOLUTION_API_URL;else process.env.EVOLUTION_API_URL=original.url;
 if(original.key===undefined)delete process.env.EVOLUTION_API_KEY;else process.env.EVOLUTION_API_KEY=original.key;
 globalThis.fetch=original.fetch;
}
